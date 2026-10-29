#!/usr/bin/env node
// First-person screenshots of a build, on the CPU (no browser, no GPU): what a player sees standing
// somewhere in it. Every pixel casts a ray through the block grid; the first block it meets is drawn
// with its vanilla texture and measured colour, Minecraft-style face shading, sun shadows, ambient
// occlusion in corners, see-through leaves and plants, translucent water and glass, and distance
// fog. Slabs, stairs, carpets, snow layers, fences/posts and plant sprites keep their shapes.
//
//   node scripts/screenshot.mjs BUILD.nbt --spawn                       from the world spawn, as you join
//   node scripts/screenshot.mjs BUILD.nbt --pos 110,35,140 --look-at 110,40,90
//   node scripts/screenshot.mjs BUILD.nbt --pos 110,35,140 --yaw 180 --pitch 10
//   node scripts/screenshot.mjs BUILD.nbt --shots shots.json --out-dir renders/
//
// Coordinates are build coordinates (x east, y up, z south). --pos is where the player STANDS (the
// feet block, like F3 in game); the eye is 1.62 above it. --eye x,y,z sets the camera point itself
// (a high or flying view). Yaw/pitch as in Minecraft: yaw 0 = looking south, 90 = west, 180 = north,
// -90 = east; pitch > 0 looks down.

import fs from 'node:fs'
import path from 'node:path'
import { blockInfo, encodePng, loadGrid } from './lib/blockview.mjs'
import { ensureHeap } from './lib/heap.mjs'

ensureHeap()

const args = process.argv.slice(2)
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node scripts/screenshot.mjs <build.nbt|.schem|.litematic> [camera] [options]
camera (one of):
  --spawn                  stand on the world spawn (from <build>.placements.json), look its way
  --pos x,y,z              stand on this block (feet); with --yaw/--pitch or --look-at x,y,z
  --pos x,z                stand on the ground at this column (the height is found for you)
  --eye x,y,z              put the camera exactly here (e.g. high above the plaza)
  --shots FILE|JSON        several shots in one run: [{"name":"crates","pos":[x,y,z],"lookAt":[x,y,z]},
                           {"name":"spawn","spawn":true}, {"name":"top","eye":[x,y,z],"yaw":0,"pitch":60},
                           {"name":"gate","pos":[x,z],"yaw":180}]  (pos [x,z] = on the ground)
options:
  --yaw D --pitch D        Minecraft angles (yaw 0 south, 90 west, 180 north, -90 east; pitch>0 down)
  --look-at x,y,z          aim at this point instead of yaw/pitch
  --fov 70                 vertical field of view (degrees)     --width 1280 --height 720
  --far 260                view distance in blocks              --sun 0|1 (shadows, default 1)
  --out FILE.png           (single shot)  --out-dir DIR (shots; default <build dir>/renders)
Prints the PNG path(s). A 1280x720 view of a 300-block spawn takes a few seconds.`)
  process.exit(args.length ? 0 : 1)
}
const input = args[0]
const opt = (f, d) => {
  const i = args.indexOf(f)
  return i < 0 ? d : args[i + 1]
}
// "x,y,z", or "x,z" / "x,~,z" for "on the ground at this column" (y found from the build)
const vec = s => (s === undefined ? undefined : String(s).split(',').map(v => (v === '~' ? null : Number(v))))
const W = Number(opt('--width', 1280))
const H = Number(opt('--height', 720))
const FAR = Number(opt('--far', 260))
const SUN = Number(opt('--sun', 1)) !== 0
const stem = path.basename(input).replace(/\.[^.]+$/, '')
const baseDir = fs.statSync(input).isDirectory() ? input : path.dirname(input)

// ------------------------------------------------------------------ the world
const t0 = Date.now()
const { pal, G, X, Y, Z } = loadGrid(input)
const info = blockInfo(pal)
const N = pal.length
// render classes: 0 empty, 1 cube, 2 bottom slab, 3 thin (carpet, snow layer), 4 post, 5 plant cross,
// 6 water, 7 glass/ice, 8 top slab, 9 stairs
const SH = new Uint8Array(N)
const CUT = new Uint8Array(N) // alpha-tested cube (leaves)
const EMI = new Uint8Array(N)
const BLOCKS = new Uint8Array(N) // blocks sun light
const STAIR = new Int8Array(N) // stairs: facing 0 n, 1 e, 2 s, 3 w (+4 when upside down)
const TOPC = new Float32Array(N * 3)
const SIDEC = new Float32Array(N * 3)
const THIN = new Float32Array(N) // thin shapes: height (carpet 1/16, snow layers n/8)
const FACINGS = { north: 0, east: 1, south: 2, west: 3 }
for (let i = 0; i < N; i += 1) {
  const it = info[i]
  const st = pal[i]
  let s = it.shape
  if (/_stairs\[/.test(st) || /_stairs$/.test(st)) {
    s = 9
    const f = /facing=(\w+)/.exec(st)?.[1] ?? 'north'
    STAIR[i] = (FACINGS[f] ?? 0) + (/half=top/.test(st) ? 4 : 0)
  }
  SH[i] = s
  CUT[i] = it.leaves ? 1 : 0
  EMI[i] = it.emissive ? 1 : 0
  BLOCKS[i] = s === 1 || s === 2 || s === 8 || s === 9 ? 1 : 0
  if (s === 3) THIN[i] = /^minecraft:snow\[/.test(st) || st === 'minecraft:snow' ? Number(/layers=(\d)/.exec(st)?.[1] ?? 1) / 8 : 1 / 16
  for (let k = 0; k < 3; k += 1) {
    TOPC[i * 3 + k] = it.top[k]
    SIDEC[i * 3 + k] = it.side[k]
  }
}
const TT = info.map(it => it.tt)
const TS = info.map(it => it.ts)
const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z ? 0 : G[(y * Z + z) * X + x])
const solidAt = (x, y, z) => {
  const id = at(x, y, z)
  return id !== 0 && (SH[id] === 1 || SH[id] === 9) && !CUT[id] ? 1 : 0
}

// ------------------------------------------------------------------ the shots
let placements = null
function spawnRecord() {
  if (!placements) {
    const f = path.join(baseDir, `${stem}.placements.json`)
    if (!fs.existsSync(f)) throw new Error(`--spawn needs ${f} (build the recipe with run-build / build_recipe first)`)
    placements = JSON.parse(fs.readFileSync(f, 'utf8')).placements ?? []
  }
  const s = placements.find(p => p.type === 'spawn')
  if (!s) throw new Error('the build has no world spawn (b.spawnPoint)')
  return s
}
let shots
if (opt('--shots')) {
  const raw = opt('--shots')
  shots = JSON.parse(fs.existsSync(raw) ? fs.readFileSync(raw, 'utf8') : raw)
} else {
  shots = [{ name: args.includes('--spawn') ? 'spawn-view' : 'shot', spawn: args.includes('--spawn'), pos: vec(opt('--pos')), eye: vec(opt('--eye')), yaw: opt('--yaw'), pitch: opt('--pitch'), lookAt: vec(opt('--look-at')), fov: opt('--fov'), out: opt('--out') }]
}
const outDir = opt('--out-dir', path.join(baseDir, 'renders'))

// ------------------------------------------------------------------ light and sky
const SUNDIR = (() => {
  const v = [-0.38, 0.85, 0.5] // high, from the south-south-west: south faces lit (the spawn looks north)
  const l = Math.hypot(...v)
  return v.map(c => c / l)
})()
const FACE_LIGHT = [0.62, 0.62, 1.0, 0.5, 0.82, 0.82] // ±x, +y, -y, ±z (Minecraft's directional shade)
const sky = (dy, out, o) => {
  const t = Math.max(0, Math.min(1, dy * 1.6 + 0.12))
  out[o] = 196 - 86 * t
  out[o + 1] = 218 - 60 * t
  out[o + 2] = 236 - 20 * t
}
const HORIZON = [196, 218, 236]

// texture luminance at (u, v) in [0, 1)
const texel = (tex, u, v) => {
  if (!tex) return { l: 1, a: 255 }
  const n = tex.n
  const iu = Math.min(n - 1, Math.max(0, Math.floor(u * n)))
  const iv = Math.min(n - 1, Math.max(0, Math.floor(v * n)))
  const k = iv * n + iu
  return { l: tex.lum[k], a: tex.alpha[k] }
}

// ray vs an axis-aligned box: returns [tNear, axis*2+side] or null (side 0 = negative face)
function boxHit(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1, tmin, tmax) {
  let tn = tmin
  let tf = tmax
  let face = -1
  const o = [ox, oy, oz]
  const d = [dx, dy, dz]
  const lo = [x0, y0, z0]
  const hi = [x1, y1, z1]
  for (let a = 0; a < 3; a += 1) {
    if (Math.abs(d[a]) < 1e-12) {
      if (o[a] < lo[a] || o[a] > hi[a]) return null
      continue
    }
    let t1 = (lo[a] - o[a]) / d[a]
    let t2 = (hi[a] - o[a]) / d[a]
    let f1 = a * 2
    if (t1 > t2) {
      ;[t1, t2] = [t2, t1]
      f1 = a * 2 + 1
    }
    if (t1 > tn) {
      tn = t1
      face = f1
    }
    if (t2 < tf) tf = t2
    if (tn > tf) return null
  }
  return face < 0 ? null : [tn, face]
}
// face index (axis*2 + 0 for the -side, +1 for the +side) from boxHit's entry side: entering
// through the low plane of axis a means the face normal points to -a
const normalOf = f => {
  const a = f >> 1
  const n = [0, 0, 0]
  n[a] = f & 1 ? 1 : -1
  return n
}

// the parts of a stairs block: [x0, y0, z0, x1, y1, z1] in the cell (tall back on the facing side)
const STAIR_BOXES = []
for (let k = 0; k < 8; k += 1) {
  const f = k & 3
  const top = k >= 4
  const slab = top ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1]
  const y0 = top ? 0 : 0.5
  const y1 = top ? 0.5 : 1
  const back = [[0, y0, 0, 1, y1, 0.5], [0.5, y0, 0, 1, y1, 1], [0, y0, 0.5, 1, y1, 1], [0, y0, 0, 0.5, y1, 1]][f]
  STAIR_BOXES.push([slab, back])
}

// shadow: march toward the sun; any light-blocking cell (or a leaf) on the way shades the point
function inShadow(px, py, pz) {
  let x = Math.floor(px)
  let y = Math.floor(py)
  let z = Math.floor(pz)
  const [dx, dy, dz] = SUNDIR
  const sx = dx > 0 ? 1 : -1
  const sz = dz > 0 ? 1 : -1
  let tx = dx !== 0 ? ((dx > 0 ? x + 1 - px : px - x) / Math.abs(dx)) : Infinity
  let ty = (y + 1 - py) / dy
  let tz = dz !== 0 ? ((dz > 0 ? z + 1 - pz : pz - z) / Math.abs(dz)) : Infinity
  const ddx = Math.abs(1 / dx)
  const ddy = Math.abs(1 / dy)
  const ddz = Math.abs(1 / dz)
  for (let i = 0; i < 160; i += 1) {
    if (tx < ty && tx < tz) {
      x += sx
      tx += ddx
    } else if (ty < tz) {
      y += 1
      ty += ddy
    } else {
      z += sz
      tz += ddz
    }
    if (y >= Y || x < 0 || z < 0 || x >= X || z >= Z) return false
    const id = G[(y * Z + z) * X + x]
    if (id && (BLOCKS[id] || CUT[id])) return true
  }
  return false
}

// ------------------------------------------------------------------ render one view
function render({ eye, yaw, pitch, fov }) {
  const img = Buffer.alloc(W * H * 3)
  const cy = (yaw * Math.PI) / 180
  const cp = (pitch * Math.PI) / 180
  const f = [-Math.sin(cy) * Math.cos(cp), -Math.sin(cp), Math.cos(cy) * Math.cos(cp)]
  let r = [f[2] * 0 - 0 * 1, 0, 0] // right = f x up
  r = [-f[2], 0, f[0]]
  const rl = Math.hypot(...r) || 1
  r = r.map(c => c / rl)
  // camera up = right x forward
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]
  const th = Math.tan(((fov ?? 70) * Math.PI) / 360)
  const aspect = W / H
  const [ex, ey, ez] = eye
  const col = new Float32Array(3)
  for (let py = 0; py < H; py += 1)
    for (let px = 0; px < W; px += 1) {
      const sx = ((2 * (px + 0.5)) / W - 1) * th * aspect
      const sy = (1 - (2 * (py + 0.5)) / H) * th
      let dx = f[0] + sx * r[0] + sy * u[0]
      let dy = f[1] + sx * r[1] + sy * u[1]
      let dz = f[2] + sx * r[2] + sy * u[2]
      const dl = Math.hypot(dx, dy, dz)
      dx /= dl
      dy /= dl
      dz /= dl
      trace(ex, ey, ez, dx, dy, dz, col)
      const o = (py * W + px) * 3
      img[o] = Math.max(0, Math.min(255, col[0]))
      img[o + 1] = Math.max(0, Math.min(255, col[1]))
      img[o + 2] = Math.max(0, Math.min(255, col[2]))
    }
  return img
}

// one ray: traverse the grid (Amanatides-Woo), blend translucent cells, shade the first solid hit
function trace(ox, oy, oz, dx, dy, dz, out) {
  // clip the ray to the build's box (the camera may stand outside it, or exactly on its edge: the
  // search starts a hair before 0 so an entry at t = 0 still counts)
  const enter = boxHit(ox, oy, oz, dx, dy, dz, 0, 0, 0, X, Y, Z, -1e-9, FAR)
  let t = 0
  const inside = ox >= 0 && oy >= 0 && oz >= 0 && ox < X && oy < Y && oz < Z
  if (!inside) {
    if (!enter) return finishSky(dy, 1, 0, 0, 0, out)
    t = enter[0] + 1e-4
  }
  let x = Math.floor(ox + dx * t)
  let y = Math.floor(oy + dy * t)
  let z = Math.floor(oz + dz * t)
  const stepX = dx > 0 ? 1 : -1
  const stepY = dy > 0 ? 1 : -1
  const stepZ = dz > 0 ? 1 : -1
  const ddx = dx !== 0 ? Math.abs(1 / dx) : Infinity
  const ddy = dy !== 0 ? Math.abs(1 / dy) : Infinity
  const ddz = dz !== 0 ? Math.abs(1 / dz) : Infinity
  const px0 = ox + dx * t
  const py0 = oy + dy * t
  const pz0 = oz + dz * t
  let tx = dx !== 0 ? t + (dx > 0 ? x + 1 - px0 : px0 - x) * ddx : Infinity
  let ty = dy !== 0 ? t + (dy > 0 ? y + 1 - py0 : py0 - y) * ddy : Infinity
  let tz = dz !== 0 ? t + (dz > 0 ? z + 1 - pz0 : pz0 - z) * ddz : Infinity
  // the face we entered the current cell through (for full cubes): axis*2 + (1 if the normal is +)
  let face = !inside && enter ? enter[1] : -1
  // translucent accumulation
  let trans = 1
  let ar = 0
  let ag = 0
  let ab = 0
  let lastTrans = -1
  for (let guard = 0; guard < 2000; guard += 1) {
    if (x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z || t > FAR) break
    const id = G[(y * Z + z) * X + x]
    if (id) {
      const s = SH[id]
      const tNext = Math.min(tx, ty, tz)
      if (s === 1) {
        if (face < 0) face = 3 // started inside a block: show its top
        const hp = [ox + dx * t, oy + dy * t, oz + dz * t]
        if (CUT[id]) {
          const { a } = sampleFace(id, face, hp, x, y, z)
          if (a < 128) {
            ;({ t, face } = step())
            continue
          }
        }
        return shade(id, face, hp, x, y, z, t, trans, ar, ag, ab, out)
      }
      if (s === 6 || s === 7) {
        // water and glass: a tinted, partly see-through layer per cell (water thickens with depth)
        const first = lastTrans !== id
        const a = s === 6 ? (first ? 0.62 : 0.86) : first ? 0.78 : 1
        const c = s === 6 ? [40, 88, 150] : [SIDEC[id * 3], SIDEC[id * 3 + 1], SIDEC[id * 3 + 2]]
        ar += trans * (1 - a) * c[0]
        ag += trans * (1 - a) * c[1]
        ab += trans * (1 - a) * c[2]
        trans *= a
        lastTrans = id
        if (trans < 0.04) return finishColor(ar, ag, ab, out)
        ;({ t, face } = step())
        continue
      }
      lastTrans = -1
      if (s !== 0) {
        // partial shapes: test their boxes (or the plant's two crossed planes) inside the cell
        const hit = partHit(id, s, ox, oy, oz, dx, dy, dz, x, y, z, t, tNext)
        if (hit) {
          const hp = [ox + dx * hit[0], oy + dy * hit[0], oz + dz * hit[0]]
          return shade(id, hit[1], hp, x, y, z, hit[0], trans, ar, ag, ab, out, hit[2])
        }
      }
    } else lastTrans = -1
    ;({ t, face } = step())
  }
  return finishSky(dy, trans, ar, ag, ab, out)

  function step() {
    if (tx < ty && tx < tz) {
      x += stepX
      const tt = tx
      tx += ddx
      return { t: tt, face: stepX > 0 ? 0 : 1 }
    }
    if (ty < tz) {
      y += stepY
      const tt = ty
      ty += ddy
      return { t: tt, face: stepY > 0 ? 2 : 3 }
    }
    z += stepZ
    const tt = tz
    tz += ddz
    return { t: tt, face: stepZ > 0 ? 4 : 5 }
  }
}

function partHit(id, s, ox, oy, oz, dx, dy, dz, x, y, z, t0, t1) {
  const box = (a, b2, c, d, e, f) => boxHit(ox, oy, oz, dx, dy, dz, x + a, y + b2, z + c, x + d, y + e, z + f, t0 - 1e-6, t1 + 1e-6)
  if (s === 2) return box(0, 0, 0, 1, 0.5, 1)
  if (s === 8) return box(0, 0.5, 0, 1, 1, 1)
  if (s === 3) return box(0, 0, 0, 1, Math.max(0.0625, THIN[id]), 1)
  if (s === 4) return box(0.34, 0, 0.34, 0.66, 1, 0.66)
  if (s === 9) {
    let best = null
    for (const bx of STAIR_BOXES[STAIR[id]]) {
      const h = box(...bx)
      if (h && (!best || h[0] < best[0])) best = h
    }
    return best
  }
  if (s === 5) {
    // two vertical planes along the cell's diagonals, alpha-tested against the plant's texture
    let best = null
    for (const diag of [0, 1]) {
      // plane: (px - x) - (pz - z) = 0  or  (px - x) + (pz - z) = 1
      const denom = diag ? dx + dz : dx - dz
      if (Math.abs(denom) < 1e-9) continue
      const tt = diag ? (1 - (ox - x) - (oz - z)) / denom : (-(ox - x) + (oz - z)) / denom
      if (tt < t0 - 1e-6 || tt > t1 + 1e-6) continue
      const hx = ox + dx * tt - x
      const hy = oy + dy * tt - y
      if (hx < 0 || hx > 1 || hy < 0 || hy > 1) continue
      const tex = TS[id] ?? TT[id]
      const { a } = texel(tex, hx, 1 - hy)
      if (a < 128) continue
      if (!best || tt < best[0]) best = [tt, 4, true]
    }
    return best
  }
  return null
}

function sampleFace(id, face, hp, x, y, z) {
  const fx = hp[0] - x
  const fy = hp[1] - y
  const fz = hp[2] - z
  const a = face >> 1
  if (a === 1) return texel(TT[id], fx, fz)
  return texel(TS[id], a === 0 ? fz : fx, 1 - fy)
}

function shade(id, face, hp, x, y, z, t, trans, ar, ag, ab, out, sprite = false) {
  const a = face >> 1
  const top = a === 1 && face & 1
  const base = top || a === 1 ? TOPC : SIDEC
  const { l } = sprite ? texel(TS[id] ?? TT[id], hp[0] - x, 1 - (hp[1] - y)) : sampleFace(id, face, hp, x, y, z)
  let light
  if (EMI[id]) light = 1.08
  else {
    light = sprite ? 0.9 : FACE_LIGHT[face]
    const n = sprite ? [0, 1, 0] : normalOf(face)
    const facing = n[0] * SUNDIR[0] + n[1] * SUNDIR[1] + n[2] * SUNDIR[2]
    if (SUN && (facing <= 0 || inShadow(hp[0] + n[0] * 0.01, hp[1] + n[1] * 0.01 + (sprite ? 0.5 : 0), hp[2] + n[2] * 0.01))) light *= 0.66
    // ambient occlusion: darken toward edges that meet a solid block in front of the face
    if (!sprite) light *= ao(face, hp, x, y, z)
  }
  let r = base[id * 3] * l * light
  let g = base[id * 3 + 1] * l * light
  let b = base[id * 3 + 2] * l * light
  // distance fog toward the horizon colour
  const fog = Math.min(0.85, Math.max(0, (t - FAR * 0.42) / (FAR * 0.58)))
  r = r * (1 - fog) + HORIZON[0] * fog
  g = g * (1 - fog) + HORIZON[1] * fog
  b = b * (1 - fog) + HORIZON[2] * fog
  out[0] = ar + trans * r
  out[1] = ag + trans * g
  out[2] = ab + trans * b
}

function ao(face, hp, x, y, z) {
  const a = face >> 1
  const s = face & 1 ? 1 : -1
  const fx = hp[0] - x
  const fy = hp[1] - y
  const fz = hp[2] - z
  let occ = 0
  if (a === 1) {
    const yy = y + s
    occ = solidAt(x - 1, yy, z) * (1 - fx) + solidAt(x + 1, yy, z) * fx + solidAt(x, yy, z - 1) * (1 - fz) + solidAt(x, yy, z + 1) * fz
  } else if (a === 0) {
    const xx = x + s
    occ = solidAt(xx, y - 1, z) * (1 - fy) + solidAt(xx, y + 1, z) * fy + solidAt(xx, y, z - 1) * (1 - fz) + solidAt(xx, y, z + 1) * fz
  } else {
    const zz = z + s
    occ = solidAt(x - 1, y, zz) * (1 - fx) + solidAt(x + 1, y, zz) * fx + solidAt(x, y - 1, zz) * (1 - fy) + solidAt(x, y + 1, zz) * fy
  }
  return 1 - 0.2 * Math.min(2, occ)
}

function finishSky(dy, trans, ar, ag, ab, out) {
  sky(dy, out, 0)
  out[0] = ar + trans * out[0]
  out[1] = ag + trans * out[1]
  out[2] = ab + trans * out[2]
}
function finishColor(ar, ag, ab, out) {
  out[0] = ar
  out[1] = ag
  out[2] = ab
}

// the feet block for a pos: [x, y, z] as given, or [x, z] / [x, null, z] = standing on the highest
// walkable block of that column
function feet(pos) {
  const p = pos.length === 2 ? [pos[0], null, pos[1]] : pos
  const [x, y, z] = [Math.floor(Number(p[0])), p[1], Math.floor(Number(p[2]))]
  if (y !== null && y !== undefined && y !== '~') return [x, Number(y), z]
  for (let yy = Y - 1; yy >= 0; yy -= 1) {
    const id = at(x, yy, z)
    if (id && SH[id] !== 5 && SH[id] !== 4 && SH[id] !== 3) return [x, yy + 1, z]
  }
  return [x, 0, z]
}

// ------------------------------------------------------------------ run
const written = []
for (const [i, s] of shots.entries()) {
  let eye
  let yaw = s.yaw !== undefined && s.yaw !== null ? Number(s.yaw) : undefined
  let pitch = s.pitch !== undefined && s.pitch !== null ? Number(s.pitch) : 0
  if (s.spawn) {
    const rec = spawnRecord()
    eye = [rec.pos[0] + 0.5, rec.pos[1] + 1.62, rec.pos[2] + 0.5]
    yaw ??= rec.yaw ?? 180
    if (s.pitch === undefined || s.pitch === null) pitch = 2
  } else if (s.eye) eye = s.eye.map(Number)
  else if (s.pos) {
    const [fx, fy, fz] = feet(s.pos)
    eye = [fx + 0.5, fy + 1.62, fz + 0.5]
  }
  else throw new Error(`shot ${s.name ?? i}: give spawn, pos or eye`)
  if (s.lookAt) {
    const [lx, ly, lz] = s.lookAt.map(Number)
    const ddx = lx + 0.5 - eye[0]
    const ddy = ly + 0.5 - eye[1]
    const ddz = lz + 0.5 - eye[2]
    yaw = (Math.atan2(-ddx, ddz) * 180) / Math.PI
    pitch = (-Math.atan2(ddy, Math.hypot(ddx, ddz)) * 180) / Math.PI
  }
  yaw ??= 180
  const t1 = Date.now()
  const img = render({ eye, yaw, pitch, fov: Number(s.fov ?? 70) })
  const file = s.out || (shots.length === 1 && opt('--out')) || path.join(outDir, `${stem}-${s.name ?? `shot-${i + 1}`}.png`)
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
  fs.writeFileSync(file, encodePng(W, H, img))
  written.push(file)
  console.log(`${file}  (eye ${eye.map(v => v.toFixed(1)).join(',')}, yaw ${yaw.toFixed(0)}, pitch ${pitch.toFixed(0)}, ${((Date.now() - t1) / 1000).toFixed(1)}s)`)
}
console.error(`screenshot: ${written.length} view(s) of ${X}x${Y}x${Z} in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
