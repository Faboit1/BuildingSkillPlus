// Schematic format conversion for the minecraft-builder-skill.
//
// Reads vanilla structure .nbt, Litematica .litematic, Sponge .schem (v1/v2/v3) and legacy
// MCEdit/Schematica .schematic files into a Lodestone `Structure`, and writes structures back out
// as vanilla .nbt, Sponge v2 .schem (WorldEdit) and single-region .litematic (Litematica).
//
// Only Node built-ins and Lodestone (bundled, see lodestone.mjs) are used. See references/formats.md.

import zlib from 'node:zlib'
import path from 'node:path'
import * as lodestone from './lodestone.mjs'

const {
  BlockState,
  NbtByteArray,
  NbtCompound,
  NbtFile,
  NbtInt,
  NbtIntArray,
  NbtList,
  NbtLong,
  NbtLongArray,
  NbtShort,
  NbtString,
  NbtType,
  Structure,
} = lodestone

export const DEFAULT_DATA_VERSION = 3955 // Java Edition 1.21.1

// Java Edition release -> DataVersion (from minecraft.wiki Module:Protocol_version/Versions).
export const DATA_VERSIONS = Object.freeze({
  '1.12': 1139, '1.12.1': 1241, '1.12.2': 1343,
  '1.13': 1519, '1.13.1': 1628, '1.13.2': 1631,
  '1.14': 1952, '1.14.1': 1957, '1.14.2': 1963, '1.14.3': 1968, '1.14.4': 1976,
  '1.15': 2225, '1.15.1': 2227, '1.15.2': 2230,
  '1.16': 2566, '1.16.1': 2567, '1.16.2': 2578, '1.16.3': 2580, '1.16.4': 2584, '1.16.5': 2586,
  '1.17': 2724, '1.17.1': 2730,
  '1.18': 2860, '1.18.1': 2865, '1.18.2': 2975,
  '1.19': 3105, '1.19.1': 3117, '1.19.2': 3120, '1.19.3': 3218, '1.19.4': 3337,
  '1.20': 3463, '1.20.1': 3465, '1.20.2': 3578, '1.20.3': 3698, '1.20.4': 3700, '1.20.5': 3837, '1.20.6': 3839,
  '1.21': 3953, '1.21.1': 3955, '1.21.2': 4080, '1.21.3': 4082, '1.21.4': 4189, '1.21.5': 4325,
  '1.21.6': 4435, '1.21.7': 4438, '1.21.8': 4440, '1.21.9': 4554, '1.21.10': 4556, '1.21.11': 4671,
  '26.1': 4786, '26.1.1': 4788, '26.1.2': 4790, '26.2': 4903, '26.3': 5023,
})

// Snapshots that renamed blocks the legacy converter can emit.
const DV_DIRT_PATH = 2681 // 20w45a: grass_path -> dirt_path (and cauldrons split into water_cauldron)
const DV_SHORT_GRASS = 3693 // 1.20.3 Pre-Release 1: grass -> short_grass

export const INPUT_EXTENSIONS = ['.nbt', '.litematic', '.schem', '.schematic']
export const OUTPUT_EXTENSIONS = ['.nbt', '.schem', '.litematic']

const AIR_NAMES = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'])
const STRUCTURE_VOID = 'minecraft:structure_void'
const AIR_STATE = new BlockState('minecraft:air')

// ---------------------------------------------------------------------------------------------
// Small NBT helpers
// ---------------------------------------------------------------------------------------------

function decompress(bytes) {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return { data: zlib.gunzipSync(buf), compression: 'gzip' }
  }
  if (buf.length >= 2 && (buf[0] & 0x0f) === 8 && ((buf[0] << 8) | buf[1]) % 31 === 0) {
    try {
      return { data: zlib.inflateSync(buf), compression: 'zlib' }
    } catch {
      // not actually zlib; fall through to raw
    }
  }
  return { data: buf, compression: 'none' }
}

function readNbtBytes(bytes) {
  const { data, compression } = decompress(bytes)
  const array = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  const file = NbtFile.read(array, { compression: 'none' })
  return { name: file.name, root: file.root, compression }
}

function writeNbtBytes(name, root, compression = 'gzip') {
  const raw = new NbtFile(name, root, 'none', false, undefined).write()
  if (compression === 'gzip') return new Uint8Array(zlib.gzipSync(raw))
  if (compression === 'zlib') return new Uint8Array(zlib.deflateSync(raw))
  return raw
}

function byteArrayValues(tag) {
  const items = tag?.items ?? []
  const out = new Uint8Array(items.length)
  for (let i = 0; i < items.length; i += 1) out[i] = items[i].getAsNumber() & 0xff
  return out
}

function intTriple(tag) {
  if (!tag) return undefined
  if (tag.isIntArray?.() || tag.isList?.()) {
    const items = tag.items ?? []
    if (items.length < 3) return undefined
    return [0, 1, 2].map(i => Math.trunc(items[i].getAsNumber()))
  }
  if (tag.isCompound?.()) return ['x', 'y', 'z'].map(k => Math.trunc(tag.getNumber(k)))
  return undefined
}

function xyzCompound([x, y, z]) {
  return new NbtCompound().set('x', new NbtInt(x)).set('y', new NbtInt(y)).set('z', new NbtInt(z))
}

function copyCompound(compound, omit = []) {
  const out = new NbtCompound()
  if (!compound) return out
  for (const [key, value] of compound.properties) {
    if (!omit.includes(key)) out.set(key, value)
  }
  return out
}

// NbtByteArray / NbtLongArray subclasses that serialize straight from typed arrays. Lodestone's
// own arrays hold one tag object per element, which is slow for multi-million block schematics.
class PackedByteArray extends NbtByteArray {
  constructor(bytes) {
    super([])
    this.bytes = bytes
  }
  get length() { return this.bytes.length }
  toBytes(output) {
    output.writeInt(this.bytes.length)
    output.writeBytes(this.bytes)
  }
}

class PackedLongArray extends NbtLongArray {
  constructor(words) {
    super([])
    this.words = words // Uint32Array: [low0, high0, low1, high1, ...]
  }
  get length() { return this.words.length / 2 }
  toBytes(output) {
    const count = this.words.length / 2
    output.writeInt(count)
    for (let i = 0; i < count; i += 1) {
      output.writeInt(this.words[2 * i + 1] | 0)
      output.writeInt(this.words[2 * i] | 0)
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Block-state helpers
// ---------------------------------------------------------------------------------------------

/** Parse `minecraft:oak_stairs[facing=north,half=top]` (an optional trailing `{nbt}` is ignored). */
export function parseStateString(input) {
  let str = String(input ?? '').trim()
  const nbtStart = str.indexOf('{')
  if (nbtStart !== -1) str = str.slice(0, nbtStart).trim()
  if (!str) return AIR_STATE
  const bracket = str.indexOf('[')
  if (bracket === -1) return new BlockState(str)
  const name = str.slice(0, bracket)
  const end = str.lastIndexOf(']')
  const body = str.slice(bracket + 1, end === -1 ? undefined : end)
  const properties = {}
  for (const part of body.split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    if (key) properties[key] = part.slice(eq + 1).trim()
  }
  return new BlockState(name, properties)
}

function stateFromPaletteCompound(tag) {
  const name = tag.getString('Name') || 'minecraft:air'
  const properties = {}
  const props = tag.get('Properties')
  if (props?.isCompound()) {
    for (const [key, value] of props.properties) properties[key] = value.getAsString()
  }
  return new BlockState(name, properties)
}

function stateName(state) {
  return state.getName().toString()
}

function isAirName(name) {
  return AIR_NAMES.has(name)
}

/** Best-guess block entity id for a block that carries nbt but no `id` key. */
export function blockEntityIdFor(blockName) {
  const name = String(blockName).replace(/^minecraft:/, '')
  const rules = [
    [/_wall_hanging_sign$|_hanging_sign$/, 'hanging_sign'],
    [/_wall_sign$|_sign$/, 'sign'],
    [/(^|_)shulker_box$/, 'shulker_box'],
    [/_wall_banner$|_banner$/, 'banner'],
    [/_bed$/, 'bed'],
    [/_skull$|_wall_skull$|_head$|_wall_head$/, 'skull'],
    [/^(soul_)?campfire$/, 'campfire'],
    [/^(chain_|repeating_)?command_block$/, 'command_block'],
    [/^(beehive|bee_nest)$/, 'beehive'],
    [/^suspicious_(sand|gravel)$/, 'brushable_block'],
    [/^moving_piston$/, 'piston'],
  ]
  for (const [pattern, id] of rules) {
    if (pattern.test(name)) return `minecraft:${id}`
  }
  return `minecraft:${name}`
}

// ---------------------------------------------------------------------------------------------
// Structure builder (palette dedupe + optional position dedupe for overlapping regions)
// ---------------------------------------------------------------------------------------------

class StructureBuilder {
  constructor(size, { dedupe = false } = {}) {
    this.size = size.map(v => Math.max(0, Math.trunc(v)))
    this.palette = []
    this.paletteIndex = new Map()
    this.blocks = []
    this.byIndex = dedupe ? new Map() : null
  }

  stateId(state) {
    const key = state.toString()
    let id = this.paletteIndex.get(key)
    if (id === undefined) {
      id = this.palette.length
      this.palette.push(state)
      this.paletteIndex.set(key, id)
    }
    return id
  }

  add(x, y, z, stateId, nbt) {
    const block = { pos: [x, y, z], state: stateId, nbt: nbt && nbt.size > 0 ? nbt : undefined }
    if (this.byIndex) {
      const key = (x * this.size[1] + y) * this.size[2] + z
      const existing = this.byIndex.get(key)
      if (existing) {
        existing.state = block.state
        existing.nbt = block.nbt
        return
      }
      this.byIndex.set(key, block)
    }
    this.blocks.push(block)
  }

  build() {
    return new Structure(this.size, this.palette, this.blocks)
  }
}

function newMeta(extra = {}) {
  return {
    name: undefined,
    author: undefined,
    description: undefined,
    formatVersion: undefined,
    regions: [],
    blockEntities: 0,
    entities: 0,
    dropped: { air: 0, structureVoid: 0 },
    warnings: [],
    ...extra,
  }
}

function countBlockEntities(structure) {
  let count = 0
  for (const block of structure.getBlocks()) if (block.nbt && block.nbt.size > 0) count += 1
  return count
}

function oldNameWarning(meta, dataVersion) {
  if (dataVersion && dataVersion < 1519) {
    meta.warnings.push(`DataVersion ${dataVersion} predates the 1.13 flattening; block names were kept as-is (not upgraded).`)
  }
}

// ---------------------------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------------------------

function readVanillaStructure(root, options) {
  const meta = newMeta({ formatVersion: 'structure' })
  const dataVersion = root.has('DataVersion') ? root.getNumber('DataVersion') : undefined
  const size = intTriple(root.get('size')) ?? [0, 0, 0]

  let paletteTag = root.getList('palette', NbtType.Compound)
  if (root.has('palettes')) {
    const palettes = root.getList('palettes', NbtType.List)
    meta.palettes = palettes.length
    const index = Math.min(Math.max(0, options.paletteIndex ?? 0), Math.max(0, palettes.length - 1))
    meta.paletteIndex = index
    paletteTag = palettes.get(index) ?? NbtList.create()
    if (palettes.length > 1) {
      meta.warnings.push(`Structure has ${palettes.length} palettes (random variants); using palette ${index}. Pick another with --palette <i>.`)
    }
  }
  const palette = paletteTag.map(tag => stateFromPaletteCompound(tag))

  const builder = new StructureBuilder(size)
  // Resolve each palette entry once: builder id, -1 air, -2 structure void, -4 jigsaw (per block).
  const resolve = state => {
    const name = stateName(state)
    if (name === STRUCTURE_VOID) return -2
    if (isAirName(name) && !options.keepAir) return -1
    return builder.stateId(state)
  }
  const paletteIds = palette.map(state => (stateName(state) === 'minecraft:jigsaw' ? -4 : resolve(state)))
  const finalStates = new Map()
  let jigsaws = 0
  for (const tag of root.getList('blocks', NbtType.Compound).items) {
    const posItems = tag.get('pos')?.items
    if (!posItems || posItems.length < 3) continue
    let id = paletteIds[tag.getNumber('state')]
    if (id === undefined) continue
    let nbt = tag.get('nbt')
    if (!nbt?.isCompound()) nbt = undefined
    if (id === -4) {
      // Jigsaw blocks turn into their final_state once the structure is assembled.
      jigsaws += 1
      const finalState = nbt?.getString('final_state') || 'minecraft:air'
      id = finalStates.get(finalState)
      if (id === undefined) { id = resolve(parseStateString(finalState)); finalStates.set(finalState, id) }
      nbt = undefined
    }
    if (id === -2) { meta.dropped.structureVoid += 1; continue }
    if (id === -1) { meta.dropped.air += 1; continue }
    builder.add(posItems[0].getAsNumber(), posItems[1].getAsNumber(), posItems[2].getAsNumber(), id, nbt)
  }
  if (jigsaws) meta.jigsawsReplaced = jigsaws
  meta.entities = root.getList('entities').length
  const structure = builder.build()
  meta.blockEntities = countBlockEntities(structure)
  meta.regions.push({ name: 'structure', origin: [0, 0, 0], size, blocks: structure.getBlocks().length })
  oldNameWarning(meta, dataVersion)
  return { structure, format: 'structure-nbt', dataVersion, meta }
}

function bitsForPalette(length) {
  return Math.max(2, 32 - Math.clz32(Math.max(1, length) - 1))
}

function readLitematic(root, options) {
  const meta = newMeta()
  const version = root.getNumber('Version')
  const subVersion = root.has('SubVersion') ? root.getNumber('SubVersion') : undefined
  meta.formatVersion = subVersion !== undefined ? `${version}.${subVersion}` : String(version)
  const dataVersion = root.has('MinecraftDataVersion') ? root.getNumber('MinecraftDataVersion') : undefined
  const md = root.getCompound('Metadata')
  meta.name = md.getString('Name') || undefined
  meta.author = md.getString('Author') || undefined
  meta.description = md.getString('Description') || undefined
  if (md.hasCompound('EnclosingSize')) meta.enclosingSize = intTriple(md.getCompound('EnclosingSize'))

  const regionsTag = root.getCompound('Regions')
  const regions = []
  for (const name of regionsTag.keys()) {
    if (options.region && name !== options.region) continue
    const tag = regionsTag.getCompound(name)
    const pos = intTriple(tag.getCompound('Position')) ?? [0, 0, 0]
    const rawSize = intTriple(tag.getCompound('Size')) ?? [0, 0, 0]
    // Litematica: the far corner is pos + size - 1 (or + size + 1 when size is negative);
    // block data is stored relative to the region's minimum corner.
    const end = rawSize.map((s, i) => pos[i] + (s >= 0 ? s - 1 : s + 1))
    const min = pos.map((p, i) => Math.min(p, end[i]))
    const dims = rawSize.map(Math.abs)
    regions.push({ name, tag, min, dims })
  }
  if (options.region && regions.length === 0) throw new Error(`Region '${options.region}' not found in litematic`)
  if (regions.length === 0) throw new Error('Litematic has no regions')
  if (version < 4 || (dataVersion && dataVersion < 1631)) {
    meta.warnings.push(`Litematic Version ${version} / MinecraftDataVersion ${dataVersion}: pre-1.13 block names are not upgraded.`)
  }

  const nonEmpty = regions.filter(r => r.dims.every(d => d > 0))
  const gmin = [0, 1, 2].map(i => Math.min(...nonEmpty.map(r => r.min[i])))
  const gmax = [0, 1, 2].map(i => Math.max(...nonEmpty.map(r => r.min[i] + r.dims[i] - 1)))
  const size = nonEmpty.length ? gmax.map((v, i) => v - gmin[i] + 1) : [0, 0, 0]
  const builder = new StructureBuilder(size, { dedupe: regions.length > 1 })

  for (const region of regions) {
    const { tag, dims } = region
    const offset = nonEmpty.length ? region.min.map((v, i) => v - gmin[i]) : [0, 0, 0]
    const palette = tag.getList('BlockStatePalette', NbtType.Compound).map(stateFromPaletteCompound)
    const paletteIds = palette.map(state => {
      const name = stateName(state)
      if (name === STRUCTURE_VOID) return -2
      if (isAirName(name) && !options.keepAir) return -1
      return builder.stateId(state)
    })
    const bits = bitsForPalette(palette.length)
    const volume = dims[0] * dims[1] * dims[2]
    const longs = tag.getLongArray('BlockStates').items
    const expected = Math.ceil((volume * bits) / 64)
    if (volume > 0 && longs.length < expected) {
      meta.warnings.push(`Region '${region.name}': BlockStates has ${longs.length} longs, expected ${expected} (${bits} bits x ${volume}); missing entries read as air.`)
    }
    const words = new Uint32Array(longs.length * 2 + 2)
    for (let i = 0; i < longs.length; i += 1) {
      const [high, low] = longs[i].getAsPair()
      words[2 * i] = low >>> 0
      words[2 * i + 1] = high >>> 0
    }

    const tiles = new Map()
    for (const te of tag.getList('TileEntities', NbtType.Compound).items) {
      const p = ['x', 'y', 'z'].map(k => te.getNumber(k))
      tiles.set(`${p[0]},${p[1]},${p[2]}`, copyCompound(te, ['x', 'y', 'z']))
    }
    meta.entities += tag.getList('Entities').length

    const mask = bits >= 32 ? 0xffffffff : (1 << bits) - 1
    let bitPos = 0
    let placed = 0
    let outOfPalette = 0
    for (let y = 0; y < dims[1]; y += 1) {
      for (let z = 0; z < dims[2]; z += 1) {
        for (let x = 0; x < dims[0]; x += 1, bitPos += bits) {
          const w = Math.floor(bitPos / 32)
          const s = bitPos - w * 32
          let v = words[w] >>> s
          if (s + bits > 32) v |= words[w + 1] << (32 - s)
          v = (v & mask) >>> 0
          const id = paletteIds[v]
          if (id === undefined) { outOfPalette += 1; continue }
          if (id === -1) { meta.dropped.air += 1; continue }
          if (id === -2) { meta.dropped.structureVoid += 1; continue }
          const nbt = tiles.get(`${x},${y},${z}`)
          builder.add(x + offset[0], y + offset[1], z + offset[2], id, nbt)
          placed += 1
        }
      }
    }
    if (outOfPalette) meta.warnings.push(`Region '${region.name}': ${outOfPalette} entries referenced missing palette ids (skipped).`)
    meta.regions.push({ name: region.name, origin: offset, size: dims, blocks: placed, bits, paletteSize: palette.length })
  }

  const structure = builder.build()
  meta.blockEntities = countBlockEntities(structure)
  return { structure, format: 'litematic', dataVersion, meta }
}

function decodeSpongeBlocks({ width, height, length, palette, data, blockEntities, nested, keepAir, meta, regionName }) {
  const builder = new StructureBuilder([width, height, length])
  const idMap = new Map()
  for (const [key, value] of palette.properties) {
    idMap.set(Math.trunc(value.getAsNumber()), parseStateString(key))
  }
  const builderIds = new Map()
  const tiles = new Map()
  for (const te of blockEntities?.items ?? []) {
    const pos = intTriple(te.get('Pos'))
    if (!pos) continue
    const id = te.getString('Id') || te.getString('id')
    const body = nested ? copyCompound(te.getCompound('Data'), ['x', 'y', 'z', 'id']) : copyCompound(te, ['Pos', 'Id', 'id', 'x', 'y', 'z', 'ContentVersion'])
    const nbt = new NbtCompound()
    if (id) nbt.set('id', new NbtString(id))
    for (const [key, value] of body.properties) nbt.set(key, value)
    tiles.set(pos[0] + pos[2] * width + pos[1] * width * length, nbt)
  }

  const volume = width * height * length
  let i = 0
  let x = 0
  let y = 0
  let z = 0
  let index = 0
  let unknown = 0
  for (; index < volume && i < data.length; index += 1) {
    let value = 0
    let shift = 0
    let b
    do {
      b = data[i++]
      value |= (b & 0x7f) << shift
      shift += 7
    } while (b & 0x80 && shift < 35)

    let id = builderIds.get(value)
    if (id === undefined) {
      const state = idMap.get(value)
      if (!state) id = -3
      else {
        const name = stateName(state)
        id = name === STRUCTURE_VOID ? -2 : (isAirName(name) && !keepAir ? -1 : builder.stateId(state))
      }
      builderIds.set(value, id)
    }
    if (id === -1) meta.dropped.air += 1
    else if (id === -2) meta.dropped.structureVoid += 1
    else if (id === -3) unknown += 1
    else builder.add(x, y, z, id, tiles.get(index))

    x += 1
    if (x === width) {
      x = 0
      z += 1
      if (z === length) { z = 0; y += 1 }
    }
  }
  if (index < volume) meta.warnings.push(`Block data ended early (${index} of ${volume} entries); the rest is treated as air.`)
  if (unknown) meta.warnings.push(`${unknown} block entries referenced ids missing from the palette (skipped).`)
  const structure = builder.build()
  meta.blockEntities = countBlockEntities(structure)
  meta.regions.push({ name: regionName, origin: [0, 0, 0], size: [width, height, length], blocks: structure.getBlocks().length })
  return structure
}

function readSponge(schematic, version, options) {
  const meta = newMeta({ formatVersion: String(version) })
  const width = schematic.getNumber('Width') & 0xffff
  const height = schematic.getNumber('Height') & 0xffff
  const length = schematic.getNumber('Length') & 0xffff
  // Sponge v1 has no DataVersion; WorldEdit assumes 1.13.2 (1631) for it.
  let dataVersion = schematic.has('DataVersion') ? schematic.getNumber('DataVersion') : undefined
  if (dataVersion === undefined && version === 1) {
    dataVersion = 1631
    meta.warnings.push('Sponge v1 has no DataVersion; assuming 1631 (1.13.2) like WorldEdit does.')
  }
  const md = schematic.getCompound('Metadata')
  meta.name = md.getString('Name') || undefined
  meta.author = md.getString('Author') || undefined
  const offset = intTriple(schematic.get('Offset'))
  if (offset) meta.offset = offset
  if (md.has('WEOffsetX')) meta.weOffset = ['WEOffsetX', 'WEOffsetY', 'WEOffsetZ'].map(k => md.getNumber(k))

  let palette
  let data
  let blockEntities
  let nested = false
  if (version >= 3) {
    const blocks = schematic.getCompound('Blocks')
    palette = blocks.getCompound('Palette')
    data = byteArrayValues(blocks.getByteArray('Data'))
    blockEntities = blocks.getList('BlockEntities', NbtType.Compound)
    nested = true
  } else {
    palette = schematic.getCompound('Palette')
    data = byteArrayValues(schematic.getByteArray('BlockData'))
    blockEntities = schematic.has('BlockEntities')
      ? schematic.getList('BlockEntities', NbtType.Compound)
      : schematic.getList('TileEntities', NbtType.Compound)
  }
  meta.entities = schematic.getList('Entities').length
  const structure = decodeSpongeBlocks({
    width, height, length, palette, data, blockEntities, nested, keepAir: options.keepAir, meta, regionName: 'schematic',
  })
  oldNameWarning(meta, dataVersion)
  return { structure, format: `sponge-v${version}`, dataVersion, meta }
}

// ---------------------------------------------------------------------------------------------
// Legacy (pre-1.13) numeric block ids -> modern block states
// ---------------------------------------------------------------------------------------------

const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']
const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak']
const H4 = ['south', 'west', 'north', 'east'] // legacy horizontal index
const F6 = ['down', 'up', 'north', 'south', 'west', 'east'] // legacy 3D facing
const F2345 = { 2: 'north', 3: 'south', 4: 'west', 5: 'east' }
const STAIR_FACING = ['east', 'west', 'south', 'north']
const DOOR_FACING = ['east', 'south', 'west', 'north']
const TRAPDOOR_FACING = ['north', 'south', 'west', 'east']
const RAIL_SHAPES = ['north_south', 'east_west', 'ascending_east', 'ascending_west', 'ascending_north', 'ascending_south', 'south_east', 'south_west', 'north_west', 'north_east']
const LOG_AXIS = ['y', 'x', 'z']
const STONE_SLABS = ['smooth_stone', 'sandstone', 'oak', 'cobblestone', 'brick', 'stone_brick', 'nether_brick', 'quartz']
const SKULLS = [['skeleton_skull', 'skeleton_wall_skull'], ['wither_skeleton_skull', 'wither_skeleton_wall_skull'], ['zombie_head', 'zombie_wall_head'], ['player_head', 'player_wall_head'], ['creeper_head', 'creeper_wall_head'], ['dragon_head', 'dragon_wall_head']]
const FLOWERS = ['poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy']
const DOUBLE_PLANTS = ['sunflower', 'lilac', 'tall_grass', 'large_fern', 'rose_bush', 'peony']
const MUSHROOM_SIDES = {
  0: [], 1: ['up', 'west', 'north'], 2: ['up', 'north'], 3: ['up', 'north', 'east'], 4: ['up', 'west'], 5: ['up'],
  6: ['up', 'east'], 7: ['up', 'south', 'west'], 8: ['up', 'south'], 9: ['up', 'east', 'south'],
  14: ['up', 'down', 'north', 'east', 'south', 'west'],
}

const bool = v => (v ? 'true' : 'false')
const S = (name, props) => ({ name: `minecraft:${name}`, props })

const LEGACY = new Map()
const def = (id, fn) => LEGACY.set(id, typeof fn === 'function' ? fn : () => S(fn))
const byData = (id, names, mask = 0xf) => def(id, d => S(names[d & mask] ?? names[0]))
const colored = (id, suffix) => def(id, d => S(`${COLORS[d & 15]}_${suffix}`))
const stairs = (id, name) => def(id, d => S(name, { facing: STAIR_FACING[d & 3], half: d & 4 ? 'top' : 'bottom', shape: 'straight', waterlogged: 'false' }))
const slab = (id, names) => def(id, d => S(`${names[d & 7] ?? names[0]}_slab`, { type: d & 8 ? 'top' : 'bottom', waterlogged: 'false' }))
const log = (id, woods) => def(id, d => {
  const wood = woods[d & 3] ?? woods[0]
  const axis = (d >> 2) & 3
  return axis === 3 ? S(`${wood}_wood`, { axis: 'y' }) : S(`${wood}_log`, { axis: LOG_AXIS[axis] })
})
const facing6 = (id, name, extra = () => ({})) => def(id, d => S(name, { facing: F6[d & 7] ?? 'up', ...extra(d) }))
const facingWall = (id, name, extra = {}) => def(id, d => S(name, { facing: F2345[d & 7] ?? 'north', ...extra }))
const facingH4 = (id, name, extra = () => ({})) => def(id, d => S(name, { facing: H4[d & 3], ...extra(d) }))
const fenceGate = (id, wood) => facingH4(id, `${wood}_fence_gate`, d => ({ open: bool(d & 4), in_wall: 'false', powered: 'false' }))
const torch = (id, standing, wall, extra = {}) => def(id, d => {
  const wallFacing = { 1: 'east', 2: 'west', 3: 'south', 4: 'north' }[d & 7]
  return wallFacing ? S(wall, { facing: wallFacing, ...extra }) : S(standing, { ...extra })
})
const button = (id, name) => def(id, d => {
  const [face, facing] = [['ceiling', 'north'], ['wall', 'east'], ['wall', 'west'], ['wall', 'south'], ['wall', 'north'], ['floor', 'north']][d & 7] ?? ['floor', 'north']
  return S(name, { face, facing, powered: bool(d & 8) })
})
const door = (id, name) => def(id, (d, ctx) => {
  let lower = d
  let upper = d
  if (d & 8) {
    const below = ctx.at(0, -1, 0)
    lower = below && below.id === id && !(below.data & 8) ? below.data : 0
  } else {
    const above = ctx.at(0, 1, 0)
    upper = above && above.id === id && above.data & 8 ? above.data : 8
  }
  return S(name, {
    facing: DOOR_FACING[lower & 3],
    half: d & 8 ? 'upper' : 'lower',
    hinge: upper & 1 ? 'right' : 'left',
    open: bool(lower & 4),
    powered: bool(upper & 2),
  })
})
const trapdoor = (id, name) => def(id, d => S(name, { facing: TRAPDOOR_FACING[d & 3], half: d & 8 ? 'top' : 'bottom', open: bool(d & 4), powered: 'false', waterlogged: 'false' }))
const rail = (id, name, powered) => def(id, d => (powered
  ? S(name, { shape: RAIL_SHAPES[d & 7] ?? 'north_south', powered: bool(d & 8) })
  : S(name, { shape: RAIL_SHAPES[d] ?? 'north_south' })))
const mushroomBlock = (id, name) => def(id, d => {
  if (d === 10 || d === 15) {
    const all = d === 15
    return S('mushroom_stem', { up: bool(all), down: bool(all), north: 'true', east: 'true', south: 'true', west: 'true' })
  }
  const sides = MUSHROOM_SIDES[d] ?? MUSHROOM_SIDES[14]
  const props = {}
  for (const side of ['up', 'down', 'north', 'east', 'south', 'west']) props[side] = bool(sides.includes(side))
  return S(name, props)
})
const doubleSlab = (id, names, smooth = {}) => def(id, d => (d & 8 && smooth[d] ? S(smooth[d]) : S(`${names[d & 7] ?? names[0]}_slab`, { type: 'double', waterlogged: 'false' })))
const age = (id, name, max) => def(id, d => S(name, { age: String(Math.min(d, max)) }))
const axisBlock = (id, name) => def(id, d => S(name, { axis: LOG_AXIS[(d >> 2) & 3] ?? 'y' }))

def(0, () => null)
byData(1, ['stone', 'granite', 'polished_granite', 'diorite', 'polished_diorite', 'andesite', 'polished_andesite'])
def(2, () => S('grass_block', { snowy: 'false' }))
byData(3, ['dirt', 'coarse_dirt', 'podzol'])
def(4, 'cobblestone')
def(5, d => S(`${WOODS[d & 7] ?? 'oak'}_planks`))
def(6, d => S(`${WOODS[d & 7] ?? 'oak'}_sapling`, { stage: String((d >> 3) & 1) }))
def(7, 'bedrock')
def(8, d => S('water', { level: String(d & 15) }))
def(9, d => S('water', { level: String(d & 15) }))
def(10, d => S('lava', { level: String(d & 15) }))
def(11, d => S('lava', { level: String(d & 15) }))
byData(12, ['sand', 'red_sand'])
def(13, 'gravel')
def(14, 'gold_ore')
def(15, 'iron_ore')
def(16, 'coal_ore')
log(17, ['oak', 'spruce', 'birch', 'jungle'])
def(18, d => S(`${['oak', 'spruce', 'birch', 'jungle'][d & 3]}_leaves`, { persistent: 'true' }))
byData(19, ['sponge', 'wet_sponge'])
def(20, 'glass')
def(21, 'lapis_ore')
def(22, 'lapis_block')
facing6(23, 'dispenser', d => ({ triggered: bool(d & 8) }))
byData(24, ['sandstone', 'chiseled_sandstone', 'cut_sandstone'])
def(25, 'note_block')
def(26, (d, ctx) => S(`${COLORS[ctx.te?.getNumber('color') ?? 14] ?? 'red'}_bed`, { facing: H4[d & 3], part: d & 8 ? 'head' : 'foot', occupied: 'false' }))
rail(27, 'powered_rail', true)
rail(28, 'detector_rail', true)
facing6(29, 'sticky_piston', d => ({ extended: bool(d & 8) }))
def(30, 'cobweb')
def(31, (d, ctx) => S([ 'dead_bush', ctx.dv >= DV_SHORT_GRASS ? 'short_grass' : 'grass', 'fern'][d & 3] ?? 'dead_bush'))
def(32, 'dead_bush')
facing6(33, 'piston', d => ({ extended: bool(d & 8) }))
facing6(34, 'piston_head', d => ({ type: d & 8 ? 'sticky' : 'normal', short: 'false' }))
colored(35, 'wool')
def(36, () => null) // moving piston: transient
def(37, 'dandelion')
byData(38, FLOWERS)
def(39, 'brown_mushroom')
def(40, 'red_mushroom')
def(41, 'gold_block')
def(42, 'iron_block')
doubleSlab(43, STONE_SLABS, { 8: 'smooth_stone', 9: 'smooth_sandstone', 15: 'smooth_quartz' })
slab(44, STONE_SLABS)
def(45, 'bricks')
def(46, 'tnt')
def(47, 'bookshelf')
def(48, 'mossy_cobblestone')
def(49, 'obsidian')
torch(50, 'torch', 'wall_torch')
def(51, 'fire')
def(52, 'spawner')
stairs(53, 'oak_stairs')
facingWall(54, 'chest', { type: 'single', waterlogged: 'false' })
def(55, d => S('redstone_wire', { power: String(d & 15), north: 'none', east: 'none', south: 'none', west: 'none' }))
def(56, 'diamond_ore')
def(57, 'diamond_block')
def(58, 'crafting_table')
age(59, 'wheat', 7)
def(60, d => S('farmland', { moisture: String(d & 7) }))
facingWall(61, 'furnace', { lit: 'false' })
facingWall(62, 'furnace', { lit: 'true' })
def(63, d => S('oak_sign', { rotation: String(d & 15), waterlogged: 'false' }))
door(64, 'oak_door')
facingWall(65, 'ladder', { waterlogged: 'false' })
rail(66, 'rail', false)
stairs(67, 'cobblestone_stairs')
facingWall(68, 'oak_wall_sign', { waterlogged: 'false' })
def(69, d => {
  const [face, facing] = [['ceiling', 'west'], ['wall', 'east'], ['wall', 'west'], ['wall', 'south'], ['wall', 'north'], ['floor', 'north'], ['floor', 'west'], ['ceiling', 'north']][d & 7]
  return S('lever', { face, facing, powered: bool(d & 8) })
})
def(70, d => S('stone_pressure_plate', { powered: bool(d & 1) }))
door(71, 'iron_door')
def(72, d => S('oak_pressure_plate', { powered: bool(d & 1) }))
def(73, () => S('redstone_ore', { lit: 'false' }))
def(74, () => S('redstone_ore', { lit: 'true' }))
torch(75, 'redstone_torch', 'redstone_wall_torch', { lit: 'false' })
torch(76, 'redstone_torch', 'redstone_wall_torch', { lit: 'true' })
button(77, 'stone_button')
def(78, d => S('snow', { layers: String((d & 7) + 1) }))
def(79, 'ice')
def(80, 'snow_block')
age(81, 'cactus', 15)
def(82, 'clay')
age(83, 'sugar_cane', 15)
def(84, () => S('jukebox', { has_record: 'false' }))
def(85, 'oak_fence')
facingH4(86, 'carved_pumpkin')
def(87, 'netherrack')
def(88, 'soul_sand')
def(89, 'glowstone')
def(90, d => S('nether_portal', { axis: (d & 3) === 2 ? 'z' : 'x' }))
facingH4(91, 'jack_o_lantern')
def(92, d => S('cake', { bites: String(Math.min(d & 7, 6)) }))
facingH4(93, 'repeater', d => ({ delay: String(((d >> 2) & 3) + 1), locked: 'false', powered: 'false' }))
facingH4(94, 'repeater', d => ({ delay: String(((d >> 2) & 3) + 1), locked: 'false', powered: 'true' }))
colored(95, 'stained_glass')
trapdoor(96, 'oak_trapdoor')
byData(97, ['infested_stone', 'infested_cobblestone', 'infested_stone_bricks', 'infested_mossy_stone_bricks', 'infested_cracked_stone_bricks', 'infested_chiseled_stone_bricks'])
byData(98, ['stone_bricks', 'mossy_stone_bricks', 'cracked_stone_bricks', 'chiseled_stone_bricks'])
mushroomBlock(99, 'brown_mushroom_block')
mushroomBlock(100, 'red_mushroom_block')
def(101, 'iron_bars')
def(102, 'glass_pane')
def(103, 'melon')
age(104, 'pumpkin_stem', 7)
age(105, 'melon_stem', 7)
def(106, d => S('vine', { south: bool(d & 1), west: bool(d & 2), north: bool(d & 4), east: bool(d & 8), up: bool(d === 0) }))
fenceGate(107, 'oak')
stairs(108, 'brick_stairs')
stairs(109, 'stone_brick_stairs')
def(110, () => S('mycelium', { snowy: 'false' }))
def(111, 'lily_pad')
def(112, 'nether_bricks')
def(113, 'nether_brick_fence')
stairs(114, 'nether_brick_stairs')
age(115, 'nether_wart', 3)
def(116, 'enchanting_table')
def(117, 'brewing_stand')
def(118, (d, ctx) => {
  const level = Math.min(d & 3, 3)
  if (!level) return S('cauldron')
  return ctx.dv >= DV_DIRT_PATH ? S('water_cauldron', { level: String(level) }) : S('cauldron', { level: String(level) })
})
def(119, 'end_portal')
facingH4(120, 'end_portal_frame', d => ({ eye: bool(d & 4) }))
def(121, 'end_stone')
def(122, 'dragon_egg')
def(123, () => S('redstone_lamp', { lit: 'false' }))
def(124, () => S('redstone_lamp', { lit: 'true' }))
doubleSlab(125, WOODS)
slab(126, WOODS)
facingH4(127, 'cocoa', d => ({ age: String(Math.min((d >> 2) & 3, 2)) }))
stairs(128, 'sandstone_stairs')
def(129, 'emerald_ore')
facingWall(130, 'ender_chest', { waterlogged: 'false' })
facingH4(131, 'tripwire_hook', d => ({ attached: bool(d & 4), powered: bool(d & 8) }))
def(132, d => S('tripwire', { attached: bool(d & 4), disarmed: bool(d & 8), powered: bool(d & 1) }))
def(133, 'emerald_block')
stairs(134, 'spruce_stairs')
stairs(135, 'birch_stairs')
stairs(136, 'jungle_stairs')
facing6(137, 'command_block', d => ({ conditional: bool(d & 8) }))
def(138, 'beacon')
byData(139, ['cobblestone_wall', 'mossy_cobblestone_wall'])
def(140, (d, ctx) => {
  const plant = legacyPottedPlant(ctx.te)
  return S(plant ? `potted_${plant}` : 'flower_pot')
})
age(141, 'carrots', 7)
age(142, 'potatoes', 7)
button(143, 'oak_button')
def(144, (d, ctx) => {
  const type = Math.trunc(ctx.te?.getNumber('SkullType') ?? 0)
  const [floor, wall] = SKULLS[type] ?? SKULLS[0]
  const placement = d & 7
  if (placement === 1 || !F2345[placement]) return S(floor, { rotation: String(Math.trunc(ctx.te?.getNumber('Rot') ?? 0) & 15) })
  return S(wall, { facing: F2345[placement] })
})
def(145, d => S(['anvil', 'chipped_anvil', 'damaged_anvil'][(d >> 2) & 3] ?? 'anvil', { facing: H4[d & 3] }))
facingWall(146, 'trapped_chest', { type: 'single', waterlogged: 'false' })
def(147, d => S('light_weighted_pressure_plate', { power: String(d & 15) }))
def(148, d => S('heavy_weighted_pressure_plate', { power: String(d & 15) }))
facingH4(149, 'comparator', d => ({ mode: d & 4 ? 'subtract' : 'compare', powered: bool(d & 8) }))
facingH4(150, 'comparator', d => ({ mode: d & 4 ? 'subtract' : 'compare', powered: 'true' }))
def(151, d => S('daylight_detector', { power: String(d & 15), inverted: 'false' }))
def(152, 'redstone_block')
def(153, 'nether_quartz_ore')
def(154, d => S('hopper', { facing: { 0: 'down', 2: 'north', 3: 'south', 4: 'west', 5: 'east' }[d & 7] ?? 'down', enabled: bool(!(d & 8)) }))
def(155, d => [S('quartz_block'), S('chiseled_quartz_block'), S('quartz_pillar', { axis: 'y' }), S('quartz_pillar', { axis: 'x' }), S('quartz_pillar', { axis: 'z' })][d] ?? S('quartz_block'))
stairs(156, 'quartz_stairs')
rail(157, 'activator_rail', true)
facing6(158, 'dropper', d => ({ triggered: bool(d & 8) }))
colored(159, 'terracotta')
colored(160, 'stained_glass_pane')
def(161, d => S(`${['acacia', 'dark_oak'][d & 1]}_leaves`, { persistent: 'true' }))
log(162, ['acacia', 'dark_oak', 'acacia', 'dark_oak'])
stairs(163, 'acacia_stairs')
stairs(164, 'dark_oak_stairs')
def(165, 'slime_block')
def(166, 'barrier')
trapdoor(167, 'iron_trapdoor')
byData(168, ['prismarine', 'prismarine_bricks', 'dark_prismarine'])
def(169, 'sea_lantern')
axisBlock(170, 'hay_block')
colored(171, 'carpet')
def(172, 'terracotta')
def(173, 'coal_block')
def(174, 'packed_ice')
def(175, (d, ctx) => {
  let type = d & 7
  if (d & 8) {
    const below = ctx.at(0, -1, 0)
    type = below && below.id === 175 && !(below.data & 8) ? below.data & 7 : 2
  }
  return S(DOUBLE_PLANTS[type] ?? 'tall_grass', { half: d & 8 ? 'upper' : 'lower' })
})
def(176, (d, ctx) => S(`${legacyBannerColor(ctx.te)}_banner`, { rotation: String(d & 15) }))
def(177, (d, ctx) => S(`${legacyBannerColor(ctx.te)}_wall_banner`, { facing: F2345[d & 7] ?? 'north' }))
def(178, d => S('daylight_detector', { power: String(d & 15), inverted: 'true' }))
byData(179, ['red_sandstone', 'chiseled_red_sandstone', 'cut_red_sandstone'])
stairs(180, 'red_sandstone_stairs')
doubleSlab(181, ['red_sandstone'], { 8: 'smooth_red_sandstone' })
slab(182, ['red_sandstone'])
fenceGate(183, 'spruce')
fenceGate(184, 'birch')
fenceGate(185, 'jungle')
fenceGate(186, 'dark_oak')
fenceGate(187, 'acacia')
def(188, 'spruce_fence')
def(189, 'birch_fence')
def(190, 'jungle_fence')
def(191, 'dark_oak_fence')
def(192, 'acacia_fence')
door(193, 'spruce_door')
door(194, 'birch_door')
door(195, 'jungle_door')
door(196, 'acacia_door')
door(197, 'dark_oak_door')
facing6(198, 'end_rod')
def(199, 'chorus_plant')
age(200, 'chorus_flower', 5)
def(201, 'purpur_block')
axisBlock(202, 'purpur_pillar')
stairs(203, 'purpur_stairs')
def(204, () => S('purpur_slab', { type: 'double', waterlogged: 'false' }))
def(205, d => S('purpur_slab', { type: d & 8 ? 'top' : 'bottom', waterlogged: 'false' }))
def(206, 'end_stone_bricks')
age(207, 'beetroots', 3)
def(208, (d, ctx) => S(ctx.dv >= DV_DIRT_PATH ? 'dirt_path' : 'grass_path'))
def(209, 'end_gateway')
facing6(210, 'repeating_command_block', d => ({ conditional: bool(d & 8) }))
facing6(211, 'chain_command_block', d => ({ conditional: bool(d & 8) }))
age(212, 'frosted_ice', 3)
def(213, 'magma_block')
def(214, 'nether_wart_block')
def(215, 'red_nether_bricks')
axisBlock(216, 'bone_block')
def(217, () => null) // structure_void
facing6(218, 'observer', d => ({ powered: bool(d & 8) }))
for (let i = 0; i < 16; i += 1) {
  facing6(219 + i, `${COLORS[i]}_shulker_box`)
  facingH4(235 + i, `${COLORS[i]}_glazed_terracotta`)
}
colored(251, 'concrete')
colored(252, 'concrete_powder')
def(255, d => S('structure_block', { mode: ['save', 'load', 'corner', 'data'][d & 3] }))

const LEGACY_POT_IDS = { 6: 'sapling', 31: 'tallgrass', 32: 'deadbush', 37: 'yellow_flower', 38: 'red_flower', 39: 'brown_mushroom', 40: 'red_mushroom', 81: 'cactus' }
function legacyPottedPlant(te) {
  if (!te) return undefined
  const itemTag = te.get('Item')
  let item = itemTag?.isString() ? itemTag.getAsString() : LEGACY_POT_IDS[Math.trunc(itemTag?.getAsNumber() ?? 0)]
  if (!item) return undefined
  item = item.replace(/^minecraft:/, '')
  const data = Math.trunc(te.getNumber('Data'))
  switch (item) {
    case 'red_flower': return FLOWERS[data] ?? 'poppy'
    case 'yellow_flower': return 'dandelion'
    case 'sapling': return `${WOODS[data] ?? 'oak'}_sapling`
    case 'cactus': return 'cactus'
    case 'brown_mushroom': return 'brown_mushroom'
    case 'red_mushroom': return 'red_mushroom'
    case 'deadbush': return 'dead_bush'
    case 'tallgrass': return data === 2 ? 'fern' : 'dead_bush'
    default: return undefined
  }
}

function legacyBannerColor(te) {
  // 1.8-1.12 banners store the dye damage value: 0 = black ... 15 = white.
  const base = te?.has('Base') ? Math.trunc(te.getNumber('Base')) & 15 : 15
  return COLORS[15 - base]
}

function readMcedit(root, options) {
  const meta = newMeta({ formatVersion: root.getString('Materials') || 'Alpha' })
  const width = root.getNumber('Width') & 0xffff
  const height = root.getNumber('Height') & 0xffff
  const length = root.getNumber('Length') & 0xffff
  const materials = root.getString('Materials')
  if (materials && materials !== 'Alpha') meta.warnings.push(`Materials '${materials}' is not 'Alpha' (Pocket/Classic ids); conversion may be wrong.`)
  // Schematica ('SchematicaMapping': name -> id) and MCEdit-Unified ('BlockIDs': "id" -> name) store
  // the id registry used when saving. Vanilla ids are fixed (even under Forge), so the mapping is only
  // used to name modded ids in the report.
  const mappedNames = new Map()
  if (root.hasCompound('SchematicaMapping')) {
    for (const [name, tag] of root.getCompound('SchematicaMapping').properties) mappedNames.set(Math.trunc(tag.getAsNumber()), name)
  }
  if (root.hasCompound('BlockIDs')) {
    for (const [id, tag] of root.getCompound('BlockIDs').properties) mappedNames.set(Number(id), tag.getAsString())
  }
  const modded = [...mappedNames.entries()].filter(([, name]) => !name.startsWith('minecraft:'))
  if (modded.length) {
    meta.warnings.push(`Id mapping lists ${modded.length} non-vanilla blocks (${modded.slice(0, 8).map(([id, name]) => `${id}=${name}`).join(', ')}); these are skipped.`)
  }

  const ids = byteArrayValues(root.getByteArray('Blocks'))
  const datas = byteArrayValues(root.getByteArray('Data'))
  const volume = width * height * length
  const blockIds = new Uint16Array(volume)
  const addBlocks = root.has('AddBlocks') ? byteArrayValues(root.getByteArray('AddBlocks')) : null
  const add = root.has('Add') ? byteArrayValues(root.getByteArray('Add')) : null
  for (let i = 0; i < volume && i < ids.length; i += 1) {
    let high = 0
    if (addBlocks && (i >> 1) < addBlocks.length) {
      // Same nibble order as WorldEdit's MCEditSchematicReader: even index -> low nibble.
      high = i & 1 ? (addBlocks[i >> 1] >> 4) & 0x0f : addBlocks[i >> 1] & 0x0f
    } else if (add && i < add.length) {
      high = add[i] & 0x0f
    }
    blockIds[i] = (high << 8) | ids[i]
  }

  const tiles = new Map()
  for (const te of root.getList('TileEntities', NbtType.Compound).items) {
    tiles.set((te.getNumber('y') * length + te.getNumber('z')) * width + te.getNumber('x'), te)
  }
  meta.entities = root.getList('Entities').length
  const dv = options.targetDataVersion ?? DEFAULT_DATA_VERSION
  const layer = width * length
  const ctx = { dv, te: undefined, at: undefined }

  const builder = new StructureBuilder([width, height, length])
  const stateIds = new Map()
  const unknown = {}
  let converted = 0
  let nonAir = 0
  for (let y = 0; y < height; y += 1) {
    for (let z = 0; z < length; z += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * layer + z * width + x
        const id = blockIds[i]
        if (id === 0) {
          if (options.keepAir) builder.add(x, y, z, builder.stateId(AIR_STATE))
          else meta.dropped.air += 1
          continue
        }
        nonAir += 1
        const fn = LEGACY.get(id)
        if (!fn) { unknown[id] = (unknown[id] ?? 0) + 1; continue }
        const data = datas[i] & 0x0f
        ctx.te = tiles.get(i)
        ctx.at = (dx, dy, dz) => {
          const nx = x + dx; const ny = y + dy; const nz = z + dz
          if (nx < 0 || ny < 0 || nz < 0 || nx >= width || ny >= height || nz >= length) return undefined
          const j = ny * layer + nz * width + nx
          return { id: blockIds[j], data: datas[j] & 0x0f }
        }
        const st = fn(data, ctx)
        if (!st) { if (id === 217) meta.dropped.structureVoid += 1; converted += 1; continue }
        const key = `${id}:${data}:${st.name}${JSON.stringify(st.props ?? {})}`
        let sid = stateIds.get(key)
        if (sid === undefined) {
          sid = builder.stateId(new BlockState(st.name, st.props ?? {}))
          stateIds.set(key, sid)
        }
        builder.add(x, y, z, sid)
        converted += 1
      }
    }
  }
  const structure = builder.build()
  // Fences/panes store no connection data before 1.13; derive it so they render and place connected.
  const updates = structure.updateBlockStates()
  const unknownTotal = Object.values(unknown).reduce((a, b) => a + b, 0)
  meta.legacy = {
    targetDataVersion: dv,
    nonAirBlocks: nonAir,
    converted,
    unknownBlocks: unknownTotal,
    unknownIds: unknown,
    coverage: nonAir ? Math.round((converted / nonAir) * 10000) / 100 : 100,
    tileEntities: tiles.size,
    connectionUpdates: updates.updatedBlocks,
  }
  if (unknownTotal) {
    const list = Object.entries(unknown).sort((a, b) => b[1] - a[1])
      .map(([id, n]) => `${id}${mappedNames.has(Number(id)) ? `(${mappedNames.get(Number(id))})` : ''} x${n}`).join(', ')
    meta.warnings.push(`Skipped ${unknownTotal} blocks with unmapped legacy ids: ${list}`)
  }
  if (tiles.size) {
    meta.warnings.push(`${tiles.size} legacy tile entities: used for bed/banner/skull/flower-pot states, but their contents (chest items, sign text) were dropped.`)
  }
  meta.regions.push({ name: 'schematic', origin: [0, 0, 0], size: [width, height, length], blocks: structure.getBlocks().length })
  return { structure, format: 'mcedit', dataVersion: undefined, meta }
}

// ---------------------------------------------------------------------------------------------
// Public API: reading
// ---------------------------------------------------------------------------------------------

/**
 * Detect the schematic format of an already-parsed NBT root.
 * @returns {'litematic'|'sponge-v1'|'sponge-v2'|'sponge-v3'|'mcedit'|'structure-nbt'|undefined}
 */
export function detectFormat(root) {
  if (root.hasCompound('Regions') && (root.has('MinecraftDataVersion') || root.has('Metadata') || root.has('Version'))) return 'litematic'
  if (root.hasCompound('Schematic')) {
    const inner = root.getCompound('Schematic')
    if (inner.hasCompound('Blocks') || inner.getNumber('Version') >= 3) return 'sponge-v3'
  }
  if (root.getNumber('Version') >= 3 && root.hasCompound('Blocks') && root.has('Width')) return 'sponge-v3'
  if (root.has('BlockData') && root.hasCompound('Palette')) return `sponge-v${Math.max(1, Math.min(2, root.getNumber('Version') || 1))}`
  if (root.get('Blocks')?.isByteArray()) return 'mcedit'
  if (root.has('blocks') && root.has('size') && (root.has('palette') || root.has('palettes'))) return 'structure-nbt'
  return undefined
}

/**
 * Read any supported schematic into a Lodestone Structure.
 *
 * @param {Uint8Array} bytes   File contents (gzip, zlib or uncompressed NBT).
 * @param {string} [filename]  Used for error messages and Bedrock detection only; the format is detected from content.
 * @param {object} [options]
 * @param {number} [options.paletteIndex=0]   Vanilla structures with `palettes`: which variant to load.
 * @param {boolean} [options.keepAir=false]   Keep explicit air blocks (vanilla structures use them to clear terrain).
 * @param {string} [options.region]           Litematic: load only this region.
 * @param {number} [options.targetDataVersion=3955]  Legacy .schematic: version whose block names to emit.
 * @returns {{ structure: Structure, format: string, dataVersion: number|undefined, meta: object }}
 */
export function readAnyStructure(bytes, filename = '', options = {}) {
  const ext = path.extname(String(filename)).toLowerCase()
  if (ext === '.mcstructure') throw new Error('Bedrock .mcstructure files are not supported (Java Edition formats only)')
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let parsed
  try {
    parsed = readNbtBytes(input)
  } catch (err) {
    throw new Error(`${filename || 'input'} is not readable NBT (${err.message})`)
  }
  const { root, compression } = parsed
  const format = detectFormat(root)
  let result
  switch (format) {
    case 'litematic': result = readLitematic(root, options); break
    case 'sponge-v3': {
      const schematic = root.hasCompound('Schematic') ? root.getCompound('Schematic') : root
      result = readSponge(schematic, schematic.getNumber('Version') || 3, options)
      break
    }
    case 'sponge-v1':
    case 'sponge-v2': result = readSponge(root, Number(format.slice(-1)), options); break
    case 'mcedit': result = readMcedit(root, options); break
    case 'structure-nbt': result = readVanillaStructure(root, options); break
    default: {
      const keys = [...root.keys()].slice(0, 12).join(', ')
      throw new Error(`${filename || 'input'}: unrecognized schematic layout (root keys: ${keys || 'none'})`)
    }
  }
  result.meta.compression = compression
  if (ext && !INPUT_EXTENSIONS.includes(ext)) result.meta.warnings.push(`Unusual extension ${ext}; detected ${result.format} from content.`)
  return result
}

// ---------------------------------------------------------------------------------------------
// Public API: writing
// ---------------------------------------------------------------------------------------------

/** Vanilla structure .nbt (wraps Lodestone's writer). */
export function writeStructureNbt(structure, { dataVersion = DEFAULT_DATA_VERSION, compression = 'gzip', name = '' } = {}) {
  return structure.writeNbt({ name, dataVersion, compression })
}

function blockEntityTag(block) {
  const nbt = block.nbt
  const id = nbt.getString('id') || blockEntityIdFor(stateName(block.state))
  return { id, body: copyCompound(nbt, ['id', 'x', 'y', 'z', 'Id', 'Pos']) }
}

function denseIds(structure, order) {
  // Returns { ids: Uint32Array in the requested order, palette: BlockState[] with air at 0, entities: [] }
  const [sx, sy, sz] = structure.getSize()
  const palette = [AIR_STATE]
  const index = new Map([[AIR_STATE.toString(), 0]])
  const ids = new Uint32Array(sx * sy * sz)
  const withNbt = []
  for (const block of structure.getBlocks()) {
    const [x, y, z] = block.pos
    const name = stateName(block.state)
    if (name === STRUCTURE_VOID) continue
    let id = 0
    if (!isAirName(name)) {
      const key = block.state.toString()
      id = index.get(key)
      if (id === undefined) {
        id = palette.length
        palette.push(block.state)
        index.set(key, id)
      }
    }
    ids[order(x, y, z)] = id
    if (block.nbt && block.nbt.size > 0 && id !== 0) withNbt.push(block)
  }
  return { ids, palette, withNbt, size: [sx, sy, sz] }
}

/**
 * Sponge Schematic v2 (.schem, gzip) for WorldEdit / FAWE (`//schem load <name>` then `//paste`).
 * The clipboard origin is the structure's minimum corner, so `//paste` puts that corner at your feet.
 */
export function writeSpongeSchem(structure, { dataVersion = DEFAULT_DATA_VERSION, name, author, date = Date.now() } = {}) {
  const [W, H, L] = structure.getSize()
  if (W > 0xffff || H > 0xffff || L > 0xffff) throw new Error('Sponge schematics are limited to 65535 blocks per axis')
  const { ids, palette, withNbt } = denseIds(structure, (x, y, z) => x + z * W + y * W * L)

  let total = 0
  for (let i = 0; i < ids.length; i += 1) {
    const v = ids[i]
    total += v < 0x80 ? 1 : v < 0x4000 ? 2 : v < 0x200000 ? 3 : 4
  }
  const bytes = new Uint8Array(total)
  let o = 0
  for (let i = 0; i < ids.length; i += 1) {
    let v = ids[i]
    while (v >= 0x80) {
      bytes[o++] = (v & 0x7f) | 0x80
      v >>>= 7
    }
    bytes[o++] = v
  }

  const paletteTag = new NbtCompound()
  palette.forEach((state, id) => paletteTag.set(state.toString(), new NbtInt(id)))

  const blockEntities = withNbt.map(block => {
    const { id, body } = blockEntityTag(block)
    const tag = new NbtCompound()
      .set('Id', new NbtString(id))
      .set('Pos', new NbtIntArray(block.pos.slice()))
    for (const [key, value] of body.properties) tag.set(key, value)
    return tag
  })

  const metadata = new NbtCompound()
  if (name) metadata.set('Name', new NbtString(String(name)))
  if (author) metadata.set('Author', new NbtString(String(author)))
  metadata.set('Date', new NbtLong(BigInt(Math.trunc(date))))
  metadata.set('WEOffsetX', new NbtInt(0)).set('WEOffsetY', new NbtInt(0)).set('WEOffsetZ', new NbtInt(0))

  const root = new NbtCompound()
    .set('Version', new NbtInt(2))
    .set('DataVersion', new NbtInt(dataVersion))
    .set('Metadata', metadata)
    .set('Width', new NbtShort(W))
    .set('Height', new NbtShort(H))
    .set('Length', new NbtShort(L))
    .set('Offset', new NbtIntArray([0, 0, 0]))
    .set('PaletteMax', new NbtInt(palette.length))
    .set('Palette', paletteTag)
    .set('BlockData', new PackedByteArray(bytes))
    .set('BlockEntities', new NbtList(blockEntities, NbtType.Compound))
  return writeNbtBytes('Schematic', root, 'gzip')
}

/** Litematica schematic format version for a Minecraft DataVersion (7 since 1.20.5's item components). */
export function litematicVersionFor(dataVersion) {
  return dataVersion >= 3837 ? 7 : 6
}

/**
 * Single-region Litematica .litematic (gzip). Load it from `.minecraft/schematics/`.
 */
export function writeLitematic(structure, {
  name = 'Unnamed',
  author = 'minecraft-builder-skill',
  description = '',
  regionName,
  dataVersion = DEFAULT_DATA_VERSION,
  version,
  subVersion = 1,
  time = Date.now(),
} = {}) {
  const [sx, sy, sz] = structure.getSize()
  const layer = sx * sz
  const { ids, palette, withNbt } = denseIds(structure, (x, y, z) => y * layer + z * sx + x)
  const bits = bitsForPalette(palette.length)
  const volume = sx * sy * sz
  const longCount = volume > 0 ? Math.ceil((volume * bits) / 64) : 1
  const words = new Uint32Array(longCount * 2)
  let totalBlocks = 0
  for (let i = 0; i < volume; i += 1) {
    const v = ids[i]
    if (v === 0) continue
    totalBlocks += 1
    const bitPos = i * bits
    const w = Math.floor(bitPos / 32)
    const s = bitPos - w * 32
    words[w] |= v << s
    if (s + bits > 32) words[w + 1] |= v >>> (32 - s)
  }

  const tileEntities = withNbt.map(block => {
    const { id, body } = blockEntityTag(block)
    const tag = new NbtCompound()
    for (const [key, value] of body.properties) tag.set(key, value)
    tag.set('id', new NbtString(id))
    tag.set('x', new NbtInt(block.pos[0])).set('y', new NbtInt(block.pos[1])).set('z', new NbtInt(block.pos[2]))
    return tag
  })

  const region = new NbtCompound()
    .set('Position', xyzCompound([0, 0, 0]))
    .set('Size', xyzCompound([sx, sy, sz]))
    .set('BlockStatePalette', new NbtList(palette.map(state => state.toNbt()), NbtType.Compound))
    .set('BlockStates', new PackedLongArray(words))
    .set('TileEntities', new NbtList(tileEntities, NbtType.Compound))
    .set('Entities', new NbtList())
    .set('PendingBlockTicks', new NbtList())
    .set('PendingFluidTicks', new NbtList())

  const stamp = new NbtLong(BigInt(Math.trunc(time)))
  const metadata = new NbtCompound()
    .set('Name', new NbtString(String(name)))
    .set('Author', new NbtString(String(author)))
    .set('Description', new NbtString(String(description)))
    .set('RegionCount', new NbtInt(1))
    .set('TotalVolume', new NbtInt(volume))
    .set('TotalBlocks', new NbtInt(totalBlocks))
    .set('TimeCreated', stamp)
    .set('TimeModified', stamp)
    .set('EnclosingSize', xyzCompound([sx, sy, sz]))

  const root = new NbtCompound()
    .set('MinecraftDataVersion', new NbtInt(dataVersion))
    .set('Version', new NbtInt(version ?? litematicVersionFor(dataVersion)))
    .set('SubVersion', new NbtInt(subVersion))
    .set('Metadata', metadata)
    .set('Regions', new NbtCompound().set(String(regionName ?? name ?? 'Main'), region))
  return writeNbtBytes('', root, 'gzip')
}

/** Write a structure in the format implied by `format` ('nbt' | 'schem' | 'litematic' or an extension). */
export function writeStructure(structure, format, options = {}) {
  const key = String(format).replace(/^\./, '').toLowerCase()
  if (key === 'nbt') return writeStructureNbt(structure, options)
  if (key === 'schem') return writeSpongeSchem(structure, options)
  if (key === 'litematic') return writeLitematic(structure, options)
  throw new Error(`Unsupported output format: ${format} (use ${OUTPUT_EXTENSIONS.join(', ')})`)
}

// ---------------------------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------------------------

/** Block counts for --info and round-trip checks. */
export function summarizeStructure(structure, { top = 20 } = {}) {
  const byId = new Map()
  const stateObjects = new Set()
  let blockEntities = 0
  let blockCount = 0
  for (const block of structure.getBlocks()) {
    if (!stateObjects.has(block.state)) stateObjects.add(block.state)
    const name = stateName(block.state)
    if (isAirName(name) || name === STRUCTURE_VOID) continue
    blockCount += 1
    byId.set(name, (byId.get(name) ?? 0) + 1)
    if (block.nbt && block.nbt.size > 0) blockEntities += 1
  }
  const states = new Set()
  for (const state of stateObjects) {
    const name = stateName(state)
    if (!isAirName(name) && name !== STRUCTURE_VOID) states.add(state.toString())
  }
  const ranked = [...byId.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return {
    size: [...structure.getSize()],
    blockCount,
    blockEntities,
    stateCount: states.size,
    blockIdCount: byId.size,
    top: ranked.slice(0, top).map(([name, count]) => ({ name, count })),
  }
}
