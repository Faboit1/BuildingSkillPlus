// Shared by the CPU renderers (isorender.mjs: isometric, screenshot.mjs: first person): a minimal
// PNG codec, the vanilla textures from Lodestone's default pack (as luminance + alpha, coloured with
// the measured block colours), the build loader (any structure file or a raw dump dir) into a
// palette + Uint16 grid, and the per-palette render info (shape class, colours, textures, flags).

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { readAnyStructure } from './formats.mjs'
import { readStructureGrid } from './structio.mjs'
import { LODESTONE_ROOT } from './lodestone.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
export const colors = JSON.parse(fs.readFileSync(path.join(here, 'data/block-colors.json'), 'utf8'))

// ------------------------------------------------------------------ minimal PNG decoder (8-bit and palette)
export function decodePng(buf) {
  let p = 8, w = 0, h = 0, depth = 8, ctype = 6, pal = null, trns = null
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ctype = d[9] }
    else if (type === 'PLTE') pal = d
    else if (type === 'tRNS') trns = d
    else if (type === 'IDAT') idat.push(d)
    p += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype]
  const bpp = Math.max(1, (ch * depth) >> 3)
  const stride = Math.ceil((w * ch * depth) / 8)
  const px = Buffer.alloc(stride * h)
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = px.subarray(y * stride, (y + 1) * stride)
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0
      let v = line[i]
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      cur[i] = v & 255
    }
    prev = cur
  }
  const rgba = new Uint8Array(w * h * 4)
  const sample = (y, i) => { // i-th sample in row y
    if (depth === 8) return px[y * stride + i]
    const bit = i * depth, byte = px[y * stride + (bit >> 3)], shift = 8 - depth - (bit & 7)
    return (byte >> shift) & ((1 << depth) - 1)
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4
    if (ctype === 6) for (let k = 0; k < 4; k++) rgba[o + k] = px[y * stride + x * 4 + k]
    else if (ctype === 2) { for (let k = 0; k < 3; k++) rgba[o + k] = px[y * stride + x * 3 + k]; rgba[o + 3] = 255 }
    else if (ctype === 3) { const i = sample(y, x); rgba[o] = pal[i * 3]; rgba[o + 1] = pal[i * 3 + 1]; rgba[o + 2] = pal[i * 3 + 2]; rgba[o + 3] = trns && i < trns.length ? trns[i] : 255 }
    else if (ctype === 0) { const v = depth === 8 ? px[y * stride + x] : sample(y, x) * (255 / ((1 << depth) - 1)); rgba[o] = rgba[o + 1] = rgba[o + 2] = v; rgba[o + 3] = 255 }
    else if (ctype === 4) { const v = px[y * stride + x * 2]; rgba[o] = rgba[o + 1] = rgba[o + 2] = v; rgba[o + 3] = px[y * stride + x * 2 + 1] }
  }
  return { w, h, rgba }
}
export function encodePng(W, H, rgb) {
  const raw = Buffer.alloc((W * 3 + 1) * H)
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; rgb.copy ? rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3) : raw.set(rgb.subarray(y * W * 3, (y + 1) * W * 3), y * (W * 3 + 1) + 1) }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))])
}

// ------------------------------------------------------------------ textures (Lodestone atlas + vanilla models)
// Each texture is stored as relative luminance (texel / mean) plus alpha; faces are coloured with the
// measured average colour of the block (block-colors.json, biome tint included) times that luminance.
// resolved directly (not via viewer-server.mjs, which needs vite): isorender only needs Lodestone
const packRoot = path.join(LODESTONE_ROOT, 'assets', 'default-pack')
const assets = JSON.parse(fs.readFileSync(path.join(packRoot, 'assets.json'), 'utf8'))
const atlas = decodePng(fs.readFileSync(path.join(packRoot, 'atlas.png')))
const texCache = new Map()
export function loadTex(name) {
  if (!name) return null
  name = name.replace(/^minecraft:/, '').replace(/^block\//, '')
  if (texCache.has(name)) return texCache.get(name)
  let t = null
  const r = assets.textures[`block/${name}`]
  if (r) {
    const [ax, ay, aw] = r
    const n = aw
    const lum = new Float32Array(n * n), alpha = new Uint8Array(n * n)
    let sum = 0, cnt = 0
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const o = ((ay + y) * atlas.w + ax + x) * 4, i = y * n + x
      lum[i] = 0.3 * atlas.rgba[o] + 0.59 * atlas.rgba[o + 1] + 0.11 * atlas.rgba[o + 2]
      alpha[i] = atlas.rgba[o + 3]
      if (alpha[i] > 128) { sum += lum[i]; cnt++ }
    }
    const mean = cnt ? sum / cnt : 128
    for (let i = 0; i < n * n; i++) lum[i] = mean > 1 ? Math.min(1.6, Math.max(0.45, lum[i] / mean)) : 1
    t = { n, lum, alpha }
  }
  texCache.set(name, t)
  return t
}
// top / side texture names from the block's model (first variant / first multipart part)
function modelTextures(model, depth = 0) {
  const m = assets.models[model.replace(/^minecraft:/, '')]
  if (!m || depth > 8) return {}
  const parent = m.parent ? modelTextures(m.parent, depth + 1) : {}
  const own = { ...(m.textures ?? {}) }
  const merged = { ...parent, ...own }
  for (const k of Object.keys(merged)) { let v = merged[k], g = 0; while (typeof v === 'string' && v.startsWith('#') && g++ < 6) v = merged[v.slice(1)]; merged[k] = v }
  return merged
}
export function texturesFor(n) {
  const bs = assets.blockstates[n]
  let model = null
  if (bs?.variants) { const v = Object.values(bs.variants)[0]; model = (Array.isArray(v) ? v[0] : v)?.model }
  else if (bs?.multipart) { const v = bs.multipart[0]?.apply; model = (Array.isArray(v) ? v[0] : v)?.model }
  const t = model ? modelTextures(model) : {}
  const top = t.top ?? t.end ?? t.up ?? t.all ?? t.texture ?? t.cross ?? t.plant ?? t.pane ?? t.particle
  const side = t.side ?? t.north ?? t.front ?? t.all ?? t.texture ?? t.cross ?? t.plant ?? t.edge ?? t.wall ?? t.particle
  return { top: loadTex(top), side: loadTex(side) }
}
export const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

// ------------------------------------------------------------------ world (raw dump dir or any structure file)
// → { pal: block state strings (0 = air), G: Uint16Array indexed (y * Z + z) * X + x, X, Y, Z }
export function loadGrid(input) {
  let pal, G, X, Y, Z
  if (fs.statSync(input).isDirectory()) {
    const meta = JSON.parse(fs.readFileSync(path.join(input, 'meta.json'), 'utf8'))
    pal = JSON.parse(fs.readFileSync(path.join(input, 'palette.json'), 'utf8'))
    const gbuf = fs.readFileSync(path.join(input, 'grid.bin'))
    G = new Uint16Array(gbuf.buffer, gbuf.byteOffset, gbuf.length / 2)
    ;({ X, Y, Z } = meta)
  } else {
    const bytes = fs.readFileSync(input)
    // a structure .nbt reads straight into the grid (no object per block: big spawns fit)
    const fast = /\.nbt$/i.test(input) ? readStructureGrid(bytes) : null
    if (fast) return { pal: fast.pal, G: fast.G, X: fast.X, Y: fast.Y, Z: fast.Z }
    const { structure } = readAnyStructure(bytes, input)
    ;[X, Y, Z] = structure.getSize()
    G = new Uint16Array(X * Y * Z)
    pal = ['minecraft:air']
    const ids = new Map([['minecraft:air', 0]])
    for (const blk of structure.getBlocks()) {
      const name = blk.state.getName().toString()
      if (/^minecraft:(air|cave_air|void_air|structure_void)$/.test(name)) continue
      const props = blk.state.getProperties()
      const keys = Object.keys(props)
      const st = keys.length ? `${name}[${keys.map(k => `${k}=${props[k]}`).join(',')}]` : name
      let id = ids.get(st)
      if (id === undefined) { id = pal.length; pal.push(st); ids.set(st, id) }
      const [x, y, z] = blk.pos
      G[(y * Z + z) * X + x] = id
    }
  }
  return { pal, G, X, Y, Z }
}

// shapes: 0 skip, 1 cube, 2 slab (half), 3 thin (carpet/snow), 4 post (narrow full-height), 5 plant (cross), 6 water, 7 glass
export function blockInfo(pal) {
  return pal.map(st => {
    const name = st.split('[')[0], n = name.replace('minecraft:', '')
    const c = colors[name]
    let shape = 1
    if (/^(air|cave_air|void_air|light|barrier|structure_void)$/.test(n)) shape = 0
    else if (n === 'water' || n === 'bubble_column') shape = 6
    else if (/glass$/.test(n) || n === 'ice') shape = 7
    else if (/_slab$/.test(n)) shape = /type=top/.test(st) ? 8 : /type=double/.test(st) ? 1 : 2
    else if (/_carpet$|^snow$|pressure_plate$|^lily_pad$|_trapdoor$|^moss_carpet$|^pink_petals$|rail$/.test(n)) shape = /_trapdoor$/.test(n) && /open=true/.test(st) ? 4 : 3
    else if (/_(fence|wall|pane)$|^iron_bars$|^chain$|^end_rod$|^lightning_rod$|_fence_gate$|^lantern$|^soul_lantern$|torch$|^bell$|_button$|^ladder$|_sign$|_banner$|^vine$|^scaffolding$|candle$/.test(n)) shape = 4
    else if (c && !c.full && /(short_grass|tall_grass|fern|flower|poppy|dandelion|allium|bluet|tulip|daisy|cornflower|lily_of_the_valley|rose|peony|lilac|sunflower|sapling|bush|seagrass|kelp|dripleaf|azalea$|berry|petals|roots|sprouts|wheat|carrots|potatoes|beetroots|sugar_cane|bamboo$|vine|dead_bush|mushroom$|coral|pickle|torchflower|pitcher)/.test(n)) shape = 5
    let top = c ? hex(c.top) : [255, 0, 255], side = c ? hex(c.side) : [255, 0, 255]
    if (n === 'water') top = side = [46, 92, 168]
    const { top: tt, side: ts } = texturesFor(n)
    const emissive = !!c?.emissive
    const opaque = shape === 1 && !!c?.full && !!c?.opaque && !/leaves/.test(n)
    const leaves = /leaves$/.test(n)
    return { shape, top, side, tt, ts, emissive, opaque, leaves, n }
  })
}
