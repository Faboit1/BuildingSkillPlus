// A small zip writer: the download bundles the schematics with the setup sheet. Files already
// compressed (.nbt, .schem, .litematic are gzip inside) are stored; text is deflated.

import pako from 'pako'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data) {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
}

// files: [{ name, data: Uint8Array | string, store?: boolean }] → Uint8Array (the .zip)
export function zip(files, date = new Date()) {
  const enc = new TextEncoder()
  const { time, day } = dosDateTime(date)
  const locals = []
  const central = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const raw = typeof f.data === 'string' ? enc.encode(f.data) : f.data
    const crc = crc32(raw)
    const deflated = f.store ? null : pako.deflateRaw(raw)
    const useDeflate = deflated && deflated.length < raw.length
    const body = useDeflate ? deflated : raw
    const method = useDeflate ? 8 : 0
    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true)
    head.setUint16(4, 20, true)
    head.setUint16(6, 0x0800, true) // UTF-8 names
    head.setUint16(8, method, true)
    head.setUint16(10, time, true)
    head.setUint16(12, day, true)
    head.setUint32(14, crc, true)
    head.setUint32(18, body.length, true)
    head.setUint32(22, raw.length, true)
    head.setUint16(26, name.length, true)
    head.setUint16(28, 0, true)
    locals.push(new Uint8Array(head.buffer), name, body)
    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014b50, true)
    dir.setUint16(4, 20, true)
    dir.setUint16(6, 20, true)
    dir.setUint16(8, 0x0800, true)
    dir.setUint16(10, method, true)
    dir.setUint16(12, time, true)
    dir.setUint16(14, day, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, body.length, true)
    dir.setUint32(24, raw.length, true)
    dir.setUint16(28, name.length, true)
    dir.setUint32(42, offset, true)
    central.push(new Uint8Array(dir.buffer), name)
    offset += 30 + name.length + body.length
  }
  const dirSize = central.reduce((n, a) => n + a.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, dirSize, true)
  end.setUint32(16, offset, true)
  const parts = [...locals, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(parts.reduce((n, a) => n + a.length, 0))
  let p = 0
  for (const a of parts) {
    out.set(a, p)
    p += a.length
  }
  return out
}
