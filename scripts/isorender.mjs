// Full-map isometric renderer for huge builds (no browser, no GPU). Every visible block is drawn as a
// textured isometric cube (painter's algorithm by x+y+z), seen from the south-east (or any of the four
// diagonals), with face shading, ambient occlusion on top faces, sun shadows, translucent water and glass.
//   node tools/isorender.mjs DUMP OUT.png [--px 4] [--from se|sw|ne|nw] [--box x0,z0,x1,z1] [--ymin 0]
//        [--sun 1] [--textures DIR]
// --px = half-width of a block in pixels (cube = 2px wide, 2px tall). Writes OUT.png (and nothing else).
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { readAnyStructure } from './lib/formats.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..')
const args = process.argv.slice(2)
if (!args.length || args.includes('--help')) {
  console.log(`Usage: node scripts/isorender.mjs <build.nbt|.schem|.litematic|dump-dir> [--out OUT.png] [options]
  --px N          half-width of a block in pixels (default 4; 2 = overview, 8 = close detail)
  --from se|sw|ne|nw   camera corner (default se)
  --box x0,z0,x1,z1    only this column range   --ymin Y   hide everything below Y
  --sun 0|1       sun shadows (default 1)      --half   also write OUT-half.png (box-filtered)
Draws every visible block as a textured isometric cube on the CPU: no browser, no size limit, so it
renders whole spawns, cities and 800x800 islands in one image (render.mjs crashes above ~1M blocks).`)
  process.exit(0)
}
const input = args[0]
const opt = (f, d) => { const i = args.indexOf(f); return i < 0 ? d : args[i + 1] }
const out = opt('--out', path.join(fs.statSync(input).isDirectory() ? input : path.dirname(input), 'renders', `${path.basename(input).replace(/\.[^.]+$/, '')}-iso-${opt('--from', 'se')}.png`))
fs.mkdirSync(path.dirname(out), { recursive: true })
const A = Number(opt('--px', 4))
const FROM = opt('--from', 'se')
const SUN = Number(opt('--sun', 1))
const colors = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/lib/data/block-colors.json'), 'utf8'))

// ------------------------------------------------------------------ minimal PNG decoder (8-bit and palette)
function decodePng(buf) {
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
function encodePng(W, H, rgb) {
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
const packRoot = path.join(path.dirname(fileURLToPath(import.meta.resolve('@mattzh72/lodestone'))), '..', 'assets', 'default-pack')
const assets = JSON.parse(fs.readFileSync(path.join(packRoot, 'assets.json'), 'utf8'))
const atlas = decodePng(fs.readFileSync(path.join(packRoot, 'atlas.png')))
const texCache = new Map()
function loadTex(name) {
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
function texturesFor(n) {
  const bs = assets.blockstates[n]
  let model = null
  if (bs?.variants) { const v = Object.values(bs.variants)[0]; model = (Array.isArray(v) ? v[0] : v)?.model }
  else if (bs?.multipart) { const v = bs.multipart[0]?.apply; model = (Array.isArray(v) ? v[0] : v)?.model }
  const t = model ? modelTextures(model) : {}
  const top = t.top ?? t.end ?? t.up ?? t.all ?? t.texture ?? t.cross ?? t.plant ?? t.pane ?? t.particle
  const side = t.side ?? t.north ?? t.front ?? t.all ?? t.texture ?? t.cross ?? t.plant ?? t.edge ?? t.wall ?? t.particle
  return { top: loadTex(top), side: loadTex(side) }
}
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

// ------------------------------------------------------------------ world (raw dump dir or any structure file)
let pal, G, X, Y, Z
if (fs.statSync(input).isDirectory()) {
  const meta = JSON.parse(fs.readFileSync(path.join(input, 'meta.json'), 'utf8'))
  pal = JSON.parse(fs.readFileSync(path.join(input, 'palette.json'), 'utf8'))
  const gbuf = fs.readFileSync(path.join(input, 'grid.bin'))
  G = new Uint16Array(gbuf.buffer, gbuf.byteOffset, gbuf.length / 2)
  ;({ X, Y, Z } = meta)
} else {
  const { structure } = readAnyStructure(fs.readFileSync(input), input)
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
const [bx0, bz0, bx1, bz1] = opt('--box', `0,0,${X - 1},${Z - 1}`).split(',').map(Number)
const ymin = Number(opt('--ymin', 0))
const gi = (x, y, z) => (y * Z + z) * X + x

// shapes: 0 skip, 1 cube, 2 slab (half), 3 thin (carpet/snow), 4 post (narrow full-height), 5 plant (cross), 6 water, 7 glass
const info = pal.map(st => {
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

// ------------------------------------------------------------------ view transform (rotate so the camera is always at +x,+z)
const rot = { se: [1, 0, 0, 1], sw: [0, -1, 1, 0], nw: [-1, 0, 0, -1], ne: [0, 1, -1, 0] }[FROM]
// world (x,z) -> view (u,w): u = a*x + b*z, w = c*x + d*z, with offsets so view coords are >= 0
const W0 = bx1 - bx0 + 1, D0 = bz1 - bz0 + 1
const toView = (x, z) => {
  const dx = x - bx0, dz = z - bz0
  if (FROM === 'se') return [dx, dz]
  if (FROM === 'sw') return [D0 - 1 - dz, dx] // camera at -x,+z
  if (FROM === 'nw') return [W0 - 1 - dx, D0 - 1 - dz]
  return [dz, W0 - 1 - dx] // ne
}
void rot
const VU = FROM === 'se' || FROM === 'nw' ? W0 : D0, VW = FROM === 'se' || FROM === 'nw' ? D0 : W0
const fromView = (u, w) => {
  if (FROM === 'se') return [u + bx0, w + bz0]
  if (FROM === 'sw') return [w + bx0, D0 - 1 - u + bz0]
  if (FROM === 'nw') return [W0 - 1 - u + bx0, D0 - 1 - w + bz0]
  return [W0 - 1 - w + bx0, u + bz0]
}
const getV = (u, y, w) => { if (u < 0 || w < 0 || u >= VU || w >= VW || y < 0 || y >= Y) return 0; const [x, z] = fromView(u, w); return G[gi(x, y, z)] }

// image geometry: sx = (u - w) * A, sy = (u + w) * A/2 - y * A
const IW = (VU + VW) * A + 4 * A
const IH = Math.ceil((VU + VW) * A / 2 + (Y - ymin) * A + 4 * A)
const ox = VW * A + 2 * A, oy = (Y - ymin) * A + 2 * A
const img = Buffer.alloc(IW * IH * 3)
for (let y = 0; y < IH; y++) { // sky gradient
  const t = y / IH
  const r = Math.round(150 - 60 * t), g = Math.round(185 - 70 * t), b = Math.round(220 - 70 * t)
  for (let x = 0; x < IW; x++) { const o = (y * IW + x) * 3; img[o] = r; img[o + 1] = g; img[o + 2] = b }
}

// ------------------------------------------------------------------ visibility + painter order by s = u + w + y
const isOpaque = id => info[id].opaque
const order = new Map() // s -> array of packed cells
let count = 0
for (let y = ymin; y < Y; y++)
  for (let w = 0; w < VW; w++)
    for (let u = 0; u < VU; u++) {
      const id = getV(u, y, w)
      if (!id || info[id].shape === 0) continue
      const it = info[id]
      if (it.shape === 1 && isOpaque(id) && isOpaque(getV(u, y + 1, w)) && isOpaque(getV(u + 1, y, w)) && isOpaque(getV(u, y, w + 1))) continue
      if (it.shape === 6 && info[getV(u, y + 1, w)].shape === 6 && info[getV(u + 1, y, w)].shape !== 0 && info[getV(u, y, w + 1)].shape !== 0) continue // inner water
      const s = u + w + y
      let arr = order.get(s)
      if (!arr) order.set(s, (arr = []))
      arr.push(u, y, w)
      count++
    }
console.log('visible cells', count)

// sun shadow: sun from the upper left of the view (towards -u, +y, +w... ) march toward the sun
const sunDir = [-0.55, 1, -0.25]
const shadowed = (u, y, w) => {
  if (!SUN) return false
  let fu = u + 0.5, fy = y + 1.02, fw = w + 0.5
  for (let k = 0; k < 60; k++) {
    fu += sunDir[0] * 0.9; fy += sunDir[1] * 0.9; fw += sunDir[2] * 0.9
    if (fy >= Y) return false
    const id = getV(Math.floor(fu), Math.floor(fy), Math.floor(fw))
    if (id && (info[id].opaque || info[id].leaves)) return true
  }
  return false
}

// ------------------------------------------------------------------ rasterise faces
let minX = IW, minY = IH, maxX = 0, maxY = 0
const put = (px, py, r, g, b, a = 1) => {
  px = Math.round(px); py = Math.round(py)
  if (px < 0 || py < 0 || px >= IW || py >= IH) return
  if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py
  const o = (py * IW + px) * 3
  if (a >= 1) { img[o] = r; img[o + 1] = g; img[o + 2] = b }
  else { img[o] = img[o] * (1 - a) + r * a; img[o + 1] = img[o + 1] * (1 - a) + g * a; img[o + 2] = img[o + 2] * (1 - a) + b * a }
}
const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : v)
// top face of cell (u, w) at height ytop (may be fractional), inset k (0..0.5) for narrow shapes
function drawTop(u, ytop, w, it, shade, alpha, inset = 0) {
  const cx = ox + (u - w) * A, cy = oy + (u + w) * A / 2 - ytop * A
  const tex = it.tt, n = tex?.n ?? 16
  for (let py = 0; py <= A; py++)
    for (let px = -A; px < A; px++) {
      // invert iso: a = (px/A + 2py/A)/2 in [0,1] along +u, b = (2py/A - px/A)/2 along +w
      const fu = (px / A + (2 * py) / A) / 2, fw = ((2 * py) / A - px / A) / 2
      if (fu < inset || fu > 1 - inset || fw < inset || fw > 1 - inset) continue
      let l = 1, a = alpha
      if (tex) { const ti = Math.min(n - 1, Math.floor(fw * n)) * n + Math.min(n - 1, Math.floor(fu * n)); if (tex.alpha[ti] < 100) { if (it.leaves) continue } l = tex.lum[ti] }
      put(cx + px, cy + py, clamp255(it.top[0] * l * shade), clamp255(it.top[1] * l * shade), clamp255(it.top[2] * l * shade), a)
    }
}
// side faces: 'u' face (+u plane, right half of the cube) and 'w' face (+w plane, left half), y0..y1
function drawSide(u, y0, y1, w, it, face, shade, alpha, inset = 0) {
  const tex = it.ts, n = tex?.n ?? 16
  const hgt = Math.round((y1 - y0) * A)
  for (let k = 0; k < A; k++) {
    const t = face === 'u' ? 1 - (k + 0.5) / A : (k + 0.5) / A
    if (t < inset || t > 1 - inset) continue
    const sx = face === 'u' ? ox + (u - w) * A + k : ox + (u - w - 1) * A + k
    const syBottom = face === 'u' ? oy + (u + 1 + w + t) * A / 2 - y0 * A : oy + (u + t + w + 1) * A / 2 - y0 * A
    for (let j = 0; j < hgt; j++) {
      let l = 1
      if (tex) {
        const Yw = y0 + (j + 0.5) / A, fr = Yw - Math.floor(Yw)
        const tu = Math.min(n - 1, Math.floor(t * n)), tv = Math.min(n - 1, n - 1 - Math.floor(fr * n))
        const ti = tv * n + tu
        if (tex.alpha[ti] < 100 && it.leaves) continue
        l = tex.lum[ti]
      }
      put(sx, Math.floor(syBottom - j - 0.5), clamp255(it.side[0] * l * shade), clamp255(it.side[1] * l * shade), clamp255(it.side[2] * l * shade), alpha)
    }
  }
}

const keys = [...order.keys()].sort((a, b) => a - b)
let drawn = 0
for (const s of keys) {
  const arr = order.get(s)
  for (let i = 0; i < arr.length; i += 3) {
    const u = arr[i], y = arr[i + 1], w = arr[i + 2]
    const id = getV(u, y, w), it = info[id]
    const above = getV(u, y + 1, w), ru = getV(u + 1, y, w), rw = getV(u, y, w + 1)
    const emis = it.emissive ? 1.25 : 1
    if (it.shape === 1 || it.shape === 8 || it.shape === 2) {
      const ytop = it.shape === 2 ? y + 0.5 : y + 1
      const y0 = it.shape === 8 ? y + 0.5 : y
      // ambient occlusion on top: opaque neighbours one level up
      let ao = 0
      for (const [du, dw] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isOpaque(getV(u + du, y + 1, w + dw))) ao++
      const sh = shadowed(u, y, w) ? 0.66 : 1
      if (!isOpaque(above) || it.shape !== 1) drawTop(u, ytop, w, it, 1.0 * (1 - ao * 0.07) * sh * emis, 1)
      if (!isOpaque(ru)) drawSide(u, y0, ytop, w, it, 'u', 0.62 * emis, 1)
      if (!isOpaque(rw)) drawSide(u, y0, ytop, w, it, 'w', 0.8 * emis, 1)
    } else if (it.shape === 3) {
      drawTop(u, y + 0.15, w, it, shadowed(u, y - 1, w) ? 0.66 : 1, 1)
    } else if (it.shape === 4) {
      drawTop(u, y + 1, w, it, emis, 1, 0.32)
      drawSide(u, y, y + 1, w, it, 'u', 0.62 * emis, 1, 0.32)
      drawSide(u, y, y + 1, w, it, 'w', 0.8 * emis, 1, 0.32)
    } else if (it.shape === 5) {
      // plant: a small vertical tuft
      const cx = ox + (u - w) * A, cy = oy + (u + w) * A / 2 + A / 2 - y * A
      for (let j = 0; j < A; j++) for (let k = -1; k <= 1; k++) if ((j + k) % 2 === 0) put(cx + k * Math.max(1, A >> 2), cy - j, it.top[0], it.top[1], it.top[2])
    } else if (it.shape === 6) {
      if (info[above].shape !== 6) drawTop(u, y + 0.875, w, it, 1, 0.72)
    } else if (it.shape === 7) {
      drawTop(u, y + 1, w, it, 1.05, 0.35)
      drawSide(u, y, y + 1, w, it, 'u', 0.75, 0.35)
      drawSide(u, y, y + 1, w, it, 'w', 0.9, 0.35)
    }
    drawn++
  }
}
// crop to the drawn content plus a margin, then also write a half-size copy (box filter)
const M = 6 * A
const cx0 = Math.max(0, minX - M), cy0 = Math.max(0, minY - M), cx1 = Math.min(IW - 1, maxX + M), cy1 = Math.min(IH - 1, maxY + M)
const CW = cx1 - cx0 + 1, CH = cy1 - cy0 + 1
const crop = Buffer.alloc(CW * CH * 3)
for (let y = 0; y < CH; y++) img.copy(crop, y * CW * 3, ((cy0 + y) * IW + cx0) * 3, ((cy0 + y) * IW + cx0 + CW) * 3)
fs.writeFileSync(out, encodePng(CW, CH, crop))
console.log(`wrote ${out} ${CW}x${CH} (${drawn} cells)`)
if (args.includes('--half')) {
  const HW = CW >> 1, HH = CH >> 1, half = Buffer.alloc(HW * HH * 3)
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) for (let c = 0; c < 3; c++) {
    const o = (i, j) => crop[((2 * y + j) * CW + 2 * x + i) * 3 + c]
    half[(y * HW + x) * 3 + c] = (o(0, 0) + o(1, 0) + o(0, 1) + o(1, 1)) >> 2
  }
  const hp = out.replace(/\.png$/, '-half.png')
  fs.writeFileSync(hp, encodePng(HW, HH, half))
  console.log(`wrote ${hp} ${HW}x${HH}`)
}
