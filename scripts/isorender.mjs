// Full-map isometric renderer for huge builds (no browser, no GPU). Every visible block is drawn as a
// textured isometric cube (painter's algorithm by x+y+z), seen from the south-east (or any of the four
// diagonals), with face shading, ambient occlusion on top faces, sun shadows, translucent water and glass.
//   node tools/isorender.mjs DUMP OUT.png [--px 4] [--from se|sw|ne|nw] [--box x0,z0,x1,z1] [--ymin 0]
//        [--sun 1] [--textures DIR]
// --px = half-width of a block in pixels (cube = 2px wide, 2px tall). Writes OUT.png (and nothing else).
import fs from 'node:fs'
import path from 'node:path'
import { blockInfo, encodePng, loadGrid } from './lib/blockview.mjs'
import { ensureHeap } from './lib/heap.mjs'

ensureHeap()

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

// ------------------------------------------------------------------ world (raw dump dir or any structure file)
const { pal, G, X, Y, Z } = loadGrid(input)
const [bx0, bz0, bx1, bz1] = opt('--box', `0,0,${X - 1},${Z - 1}`).split(',').map(Number)
const ymin = Number(opt('--ymin', 0))
const gi = (x, y, z) => (y * Z + z) * X + x

const info = blockInfo(pal)

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
