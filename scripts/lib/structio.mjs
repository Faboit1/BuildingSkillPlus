// Structure files for big builds. Lodestone keeps a Structure object and an NBT tag object for
// every block, which a 1000-wide spawn (tens of millions of blocks) cannot afford. These write and
// read the vanilla structure .nbt format directly: the same file, a fraction of the memory and time.
//
//   writeStructureNbt(path, { size, palette, blocks, count, dataVersion })  streams a gzip .nbt
//   readStructureGrid(bytes)  → { pal, G, X, Y, Z, blocks, blockEntities }  a dense grid of state ids
//
// palette: [{ name, props }] in palette order; blocks: an iterable of [x, y, z, paletteIndex, nbt]
// (nbt: a Lodestone NbtCompound or undefined). The grid's pal holds state strings with
// 'minecraft:air' at 0; G is a Uint16Array indexed (y * Z + z) * X + x.

import fs from 'node:fs'
import { once } from 'node:events'
import zlib from 'node:zlib'
import { NbtCompound, RawDataInput, RawDataOutput } from './lodestone.mjs'

const T = { end: 0, byte: 1, short: 2, int: 3, long: 4, float: 5, double: 6, byteArray: 7, string: 8, list: 9, compound: 10, intArray: 11, longArray: 12 }

// A byte buffer that hands full chunks to a sink.
class ChunkWriter {
  constructor(sink, chunkSize = 1 << 23) {
    this.sink = sink
    this.chunkSize = chunkSize
    this.buf = Buffer.allocUnsafe(chunkSize)
    this.o = 0
  }

  room(n) {
    if (this.o + n <= this.buf.length) return
    this.flush()
    if (n > this.buf.length) this.buf = Buffer.allocUnsafe(n)
  }

  flush() {
    if (this.o === 0) return
    this.sink(Buffer.from(this.buf.subarray(0, this.o)))
    this.o = 0
  }

  byte(v) {
    this.room(1)
    this.buf.writeInt8(v, this.o)
    this.o += 1
  }

  int(v) {
    this.room(4)
    this.buf.writeInt32BE(v, this.o)
    this.o += 4
  }

  str(s) {
    const n = Buffer.byteLength(s, 'utf8')
    if (n > 0xffff) throw new Error(`NBT strings cannot exceed 65535 bytes; got ${n}`)
    this.room(2 + n)
    this.buf.writeUInt16BE(n, this.o)
    this.buf.write(s, this.o + 2, n, 'utf8')
    this.o += 2 + n
  }

  bytes(u8) {
    this.room(u8.length)
    this.buf.set(u8, this.o)
    this.o += u8.length
  }

  // a named tag header: type, name
  tag(type, name) {
    this.byte(type)
    this.str(name)
  }
}

// a Lodestone NbtCompound's payload (block entities: signs, banners, chests...)
function compoundPayload(nbt) {
  const out = new RawDataOutput()
  nbt.toBytes(out)
  return out.getData()
}

// Streams a structure .nbt (gzip) to `file`, waiting for the compressor between chunks so only a
// few MB are held at a time. `blocks` is an iterable of [x, y, z, paletteIndex, nbt]. Returns the
// number of blocks written.
export async function writeStructureNbt(file, { size, palette, blocks, count, dataVersion, name = '', compression = 'gzip' }) {
  const fileStream = fs.createWriteStream(file)
  const z = compression === 'gzip' ? zlib.createGzip({ level: 6 }) : compression === 'zlib' ? zlib.createDeflate({ level: 6 }) : null
  const target = z ?? fileStream
  if (z) z.pipe(fileStream)
  const pending = []
  const w = new ChunkWriter(chunk => pending.push(chunk))
  const drain = async () => {
    while (pending.length) if (!target.write(pending.shift())) await once(target, 'drain')
  }

  w.tag(T.compound, name)
  w.tag(T.list, 'size')
  w.byte(T.int)
  w.int(3)
  for (const v of size) w.int(v)
  w.tag(T.list, 'palette')
  w.byte(T.compound)
  w.int(palette.length)
  for (const { name: id, props } of palette) {
    w.tag(T.string, 'Name')
    w.str(id)
    const keys = props ? Object.keys(props) : []
    if (keys.length) {
      w.tag(T.compound, 'Properties')
      for (const k of keys) {
        w.tag(T.string, k)
        w.str(String(props[k]))
      }
      w.byte(T.end)
    }
    w.byte(T.end)
  }
  w.tag(T.list, 'blocks')
  w.byte(T.compound)
  w.int(count)
  let written = 0
  for (const [x, y, zz, state, nbt] of blocks) {
    w.tag(T.list, 'pos')
    w.byte(T.int)
    w.int(3)
    w.int(x)
    w.int(y)
    w.int(zz)
    w.tag(T.int, 'state')
    w.int(state)
    if (nbt && nbt.size > 0) {
      w.tag(T.compound, 'nbt')
      w.bytes(compoundPayload(nbt))
    }
    w.byte(T.end)
    written += 1
    if (pending.length) await drain()
  }
  if (written !== count) throw new Error(`structure writer: ${written} blocks written, ${count} announced`)
  w.tag(T.list, 'entities')
  w.byte(T.end)
  w.int(0)
  if (dataVersion !== undefined) {
    w.tag(T.int, 'DataVersion')
    w.int(dataVersion)
  }
  w.byte(T.end)
  w.flush()
  await drain()
  target.end()
  await once(fileStream, 'finish')
  return written
}

// ------------------------------------------------------------------ reading
function inflate(bytes) {
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (b[0] === 0x1f && b[1] === 0x8b) return zlib.gunzipSync(b, { maxOutputLength: 2 ** 32 - 1 })
  if (b[0] === 0x78) return zlib.inflateSync(b, { maxOutputLength: 2 ** 32 - 1 })
  return b
}

// Reads a vanilla structure .nbt into a dense grid. Returns null when the file is not a structure
// .nbt (no size / palette / blocks), so callers can fall back to the general reader.
export function readStructureGrid(bytes) {
  const d = inflate(bytes)
  const view = new DataView(d.buffer, d.byteOffset, d.byteLength)
  let o = 0
  const u8 = () => d[o++]
  const i32 = () => {
    const v = view.getInt32(o)
    o += 4
    return v
  }
  const str = () => {
    const n = view.getUint16(o)
    o += 2
    const s = d.toString('utf8', o, o + n)
    o += n
    return s
  }
  const skip = type => {
    switch (type) {
      case T.byte: o += 1; return
      case T.short: o += 2; return
      case T.int: case T.float: o += 4; return
      case T.long: case T.double: o += 8; return
      case T.byteArray: o += 4 + view.getInt32(o); return
      case T.string: o += 2 + view.getUint16(o); return
      case T.list: {
        const t = u8()
        const n = i32()
        for (let i = 0; i < n; i += 1) skip(t)
        return
      }
      case T.compound:
        for (;;) {
          const t = u8()
          if (t === T.end) return
          o += 2 + view.getUint16(o)
          skip(t)
        }
      case T.intArray: o += 4 + 4 * view.getInt32(o); return
      case T.longArray: o += 4 + 8 * view.getInt32(o); return
      default: throw new Error(`structure reader: unknown NBT tag ${type} at byte ${o}`)
    }
  }
  if (u8() !== T.compound) return null
  str()
  let size = null
  let pal = null
  let blk = null // [x, y, z, state] * n
  let n = 0
  let dataVersion
  const nbtAt = [] // [block index, start, end] of each block entity's compound
  for (;;) {
    const t = u8()
    if (t === T.end) break
    const key = str()
    if (key === 'size' && t === T.list) {
      const et = u8()
      const len = i32()
      if (et !== T.int || len !== 3) return null
      size = [i32(), i32(), i32()]
    } else if (key === 'palette' && t === T.list) {
      u8()
      const len = i32()
      pal = new Array(len)
      for (let i = 0; i < len; i += 1) {
        let id = 'minecraft:air'
        const props = []
        for (;;) {
          const ft = u8()
          if (ft === T.end) break
          const fk = str()
          if (fk === 'Name' && ft === T.string) id = str()
          else if (fk === 'Properties' && ft === T.compound) {
            for (;;) {
              const pt = u8()
              if (pt === T.end) break
              const pk = str()
              if (pt === T.string) props.push(`${pk}=${str()}`)
              else skip(pt)
            }
          } else skip(ft)
        }
        pal[i] = props.length ? `${id}[${props.join(',')}]` : id
      }
    } else if (key === 'blocks' && t === T.list) {
      u8()
      n = i32()
      blk = new Int32Array(Math.max(0, n) * 4)
      for (let i = 0; i < n; i += 1) {
        const at = i * 4
        for (;;) {
          const ft = u8()
          if (ft === T.end) break
          const fk = str()
          if (fk === 'pos' && ft === T.list) {
            u8()
            i32()
            blk[at] = i32()
            blk[at + 1] = i32()
            blk[at + 2] = i32()
          } else if (fk === 'state' && ft === T.int) blk[at + 3] = i32()
          else if (fk === 'nbt' && ft === T.compound) {
            const start = o
            skip(T.compound)
            nbtAt.push([i, start, o])
          } else skip(ft)
        }
      }
    } else if (key === 'DataVersion' && t === T.int) dataVersion = i32()
    else skip(t)
  }
  if (!size || !pal || !blk) return null
  const [X, Y, Z] = size
  // grid ids: 0 = air; every other palette state gets its own id (air-like states stay 0)
  const ids = new Uint16Array(pal.length)
  const out = ['minecraft:air']
  const seen = new Map([['minecraft:air', 0]])
  for (let i = 0; i < pal.length; i += 1) {
    const st = pal[i]
    if (/^minecraft:(air|cave_air|void_air|structure_void)$/.test(st)) continue
    let id = seen.get(st)
    if (id === undefined) {
      id = out.length
      out.push(st)
      seen.set(st, id)
    }
    ids[i] = id
  }
  const G = new Uint16Array(X * Y * Z)
  for (let i = 0; i < n; i += 1) {
    const at = i * 4
    const x = blk[at]
    const y = blk[at + 1]
    const z = blk[at + 2]
    if (x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z) continue
    G[(y * Z + z) * X + x] = ids[blk[at + 3]]
  }
  // block entities (signs, chests, banners: a handful) as Lodestone compounds, by grid index
  const blockEntities = new Map()
  for (const [i, start, end] of nbtAt) {
    const at = i * 4
    const tag = NbtCompound.fromBytes(new RawDataInput(d.subarray(start, end)))
    if (tag.size > 0) blockEntities.set((blk[at + 1] * Z + blk[at + 2]) * X + blk[at], tag)
  }
  return { pal: out, G, X, Y, Z, blocks: n, blockEntities, dataVersion }
}

// What a big schematic is without reading its blocks: walks the NBT and keeps only the small
// facts (a .schem's Width/Height/Length, DataVersion and palette size; a .litematic's regions and
// their sizes; a structure .nbt's size and palette), skipping the block arrays. For convert --info
// on files too big to load (a 1000-wide spawn's .schem holds 200 million entries).
export function readHeader(bytes) {
  const d = inflate(bytes)
  const view = new DataView(d.buffer, d.byteOffset, d.byteLength)
  let o = 0
  const u8 = () => d[o++]
  const str = () => {
    const n = view.getUint16(o)
    o += 2
    const s = d.toString('utf8', o, o + n)
    o += n
    return s
  }
  const out = { ints: {}, lists: {}, arrays: {}, compounds: {} }
  // read a tag's payload; scalars are kept by their path, big arrays only by their length
  const read = (type, at) => {
    switch (type) {
      case T.byte: return d.readInt8(o++)
      case T.short: { const v = view.getInt16(o); o += 2; return v }
      case T.int: { const v = view.getInt32(o); o += 4; return v }
      case T.float: o += 4; return null
      case T.long: o += 8; return null
      case T.double: o += 8; return null
      case T.string: return str()
      case T.byteArray: { const n = view.getInt32(o); o += 4 + n; out.arrays[at] = n; return null }
      case T.intArray: { const n = view.getInt32(o); o += 4 + 4 * n; out.arrays[at] = n; return null }
      case T.longArray: { const n = view.getInt32(o); o += 4 + 8 * n; out.arrays[at] = n; return null }
      case T.list: {
        const t = u8()
        const n = view.getInt32(o)
        o += 4
        out.lists[at] = n
        const items = []
        for (let i = 0; i < n; i += 1) {
          const v = read(t, `${at}[${i}]`)
          if (i < 3 && (t === T.int || t === T.short)) items.push(v)
        }
        return items
      }
      case T.compound: {
        let keys = 0
        for (;;) {
          const t = u8()
          if (t === T.end) break
          const k = str()
          keys += 1
          const v = read(t, at ? `${at}.${k}` : k)
          if (typeof v === 'number' || typeof v === 'string' || (Array.isArray(v) && v.length)) out.ints[at ? `${at}.${k}` : k] = v
        }
        out.compounds[at] = keys
        return null
      }
      default: throw new Error(`header reader: unknown NBT tag ${type} at byte ${o}`)
    }
  }
  const t = u8()
  if (t !== T.compound) return null
  str()
  read(T.compound, '')
  return out
}
