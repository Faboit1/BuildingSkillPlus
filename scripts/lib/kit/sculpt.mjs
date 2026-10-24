// Sculpting generators: spline tubes, surface shading, erosion smoothing, ship hulls,
// crystal clusters, huge mushrooms, clouds, rock arches and armature statues.
// Builder-first functions (fn(b, ...args)), installed as Builder methods:
//   b.tubeAlong(points, s => r, paint)          watertight tapered tube on a centripetal Catmull-Rom
//   b.shadeSurface(min, max, rampDarkToLight)   ramp by surface normal·light + occlusion (rank-normalized)
//   b.erode(min, max, { preset: 'smooth' })     VoxelSniper-style erosion/fill cellular automaton
//   b.hull({ bow, heading, length })            lofted ship hull with decks, keel, bulwark
//   b.crystalCluster(base, opts)                hexagonal crystals with pyramid tips
//   b.hugeMushroom(base, { type: 'red' })       stem + cap with correct mushroom-block faces
//   b.cloud(center, { length })                 flat-based cumulus, shaded top-light
//   b.rockArch(footA, footB, opts)              eroded natural arch with strata
//   b.figure(base, { height, pose })            smooth-unioned humanoid statue on an armature
// Numbers behind the defaults: references/building/sculpting.md.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DIR, blockExists, isFullSolid, parseBlock, withNamespace } from './blocks.mjs'
import { material as materialFamily } from './materials.mjs'
import { coherent01, createRng, fbm3, hash01 } from './noise.mjs'

// ------------------------------------------------------------------ vector helpers

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const len = a => Math.hypot(a[0], a[1], a[2])
const norm = a => {
  const l = len(a)
  return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0]
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
const FACE_NAMES = ['east', 'west', 'up', 'down', 'south', 'north'] // same order as N6
const rad = deg => (deg * Math.PI) / 180

function minMax(a, c) {
  return [
    [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])],
    [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])],
  ]
}

const setOptsOf = opts => (opts && Object.keys(opts).length > 0 ? opts : undefined)

// Rodrigues rotation of v around unit axis k by angle a (radians).
function rotate(v, k, a) {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)))
}

// Polynomial smooth minimum (k = fillet radius in blocks).
export function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b)
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1)
  return b * (1 - h) + a * h - k * h * (1 - h)
}

// Ellipsoid distance bound (Quilez k0*(k0-1)/k1): much closer to true distance than
// (k0-1)*min(r), so smooth unions of ellipsoids blend evenly.
export function sdEllipsoid(p, c, r) {
  const q = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
  const k0 = Math.hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2])
  const k1 = Math.hypot(q[0] / (r[0] * r[0]), q[1] / (r[1] * r[1]), q[2] / (r[2] * r[2]))
  return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1
}

// Capsule from a to b with radius varying linearly r0 -> r1.
export function sdTaper(p, a, b, r0, r1) {
  const pa = sub(p, a)
  const ba = sub(b, a)
  const h = clamp(dot(pa, ba) / (dot(ba, ba) || 1), 0, 1)
  return len(sub(pa, mul(ba, h))) - (r0 + (r1 - r0) * h)
}

// ------------------------------------------------------------------ splines and tubes

// Centripetal Catmull-Rom (alpha 0.5: no cusps or self-intersections inside a segment) through
// every point; ends are extrapolated. Returns samples roughly `samplesPerBlock` per block.
export function centripetalCatmullRom(points, { samplesPerBlock = 3, alpha = 0.5 } = {}) {
  if (points.length < 2) throw new Error('need at least two points')
  if (points.length === 2) {
    const n = Math.max(2, Math.ceil(len(sub(points[1], points[0])) * samplesPerBlock))
    return Array.from({ length: n + 1 }, (_, i) => add(points[0], mul(sub(points[1], points[0]), i / n)))
  }
  const P = [sub(points[0], sub(points[1], points[0])), ...points, sub(points.at(-1), sub(points.at(-2), points.at(-1)))]
  const lerpT = (a, b, ta, tb, t) => [0, 1, 2].map(k => a[k] + ((b[k] - a[k]) * (t - ta)) / (tb - ta))
  const out = []
  for (let i = 1; i < P.length - 2; i += 1) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]]
    const t0 = 0
    const t1 = t0 + Math.max(1e-4, len(sub(p1, p0)) ** alpha)
    const t2 = t1 + Math.max(1e-4, len(sub(p2, p1)) ** alpha)
    const t3 = t2 + Math.max(1e-4, len(sub(p3, p2)) ** alpha)
    const n = Math.max(2, Math.ceil(len(sub(p2, p1)) * samplesPerBlock))
    for (let j = 0; j < n; j += 1) {
      const t = t1 + ((t2 - t1) * j) / n
      const A1 = lerpT(p0, p1, t0, t1, t)
      const A2 = lerpT(p1, p2, t1, t2, t)
      const A3 = lerpT(p2, p3, t2, t3, t)
      const B1 = lerpT(A1, A2, t0, t2, t)
      const B2 = lerpT(A2, A3, t1, t3, t)
      out.push(lerpT(B1, B2, t1, t2, t))
    }
  }
  out.push([...points.at(-1)])
  return out
}

// Rasterize a tube: union of tapered capsules between consecutive spline samples, so it is
// gap-free whatever the sampling. radius = number or (s, point) => r with s = arc-length
// fraction 0..1. Radii are clamped to rMin (default 0.87 = sqrt(3)/2), the smallest radius
// that keeps a voxelized tube face-connected in every direction. A function paint receives
// s as a 5th argument: paint(x, y, z, b, s).
export function tubeAlong(b, points, radius, paint, { samplesPerBlock = 3, alpha = 0.5, rMin = 0.87, ...opts } = {}) {
  const samples = centripetalCatmullRom(points.map(p => [...p]), { samplesPerBlock, alpha })
  const L = [0]
  for (let i = 1; i < samples.length; i += 1) L.push(L[i - 1] + len(sub(samples[i], samples[i - 1])))
  const total = L.at(-1) || 1
  const rAt = typeof radius === 'function' ? radius : () => radius
  const cells = new Map()
  for (let i = 1; i < samples.length; i += 1) {
    const A = samples[i - 1]
    const B = samples[i]
    const ra = Math.max(rMin, rAt(L[i - 1] / total, A))
    const rb = Math.max(rMin, rAt(L[i] / total, B))
    const R = Math.max(ra, rb)
    for (let x = Math.floor(Math.min(A[0], B[0]) - R); x <= Math.ceil(Math.max(A[0], B[0]) + R); x += 1)
      for (let y = Math.floor(Math.min(A[1], B[1]) - R); y <= Math.ceil(Math.max(A[1], B[1]) + R); y += 1)
        for (let z = Math.floor(Math.min(A[2], B[2]) - R); z <= Math.ceil(Math.max(A[2], B[2]) + R); z += 1) {
          const d = sdTaper([x, y, z], A, B, ra, rb)
          if (d > 0) continue
          const k = `${x},${y},${z}`
          const prev = cells.get(k)
          if (!prev || d < prev.d) cells.set(k, { d, s: (L[i - 1] + L[i]) / 2 / total })
        }
  }
  const setOpts = setOptsOf(opts)
  for (const [k, { s }] of cells) {
    const [x, y, z] = k.split(',').map(Number)
    if (opts.mask && !opts.mask(x, y, z, b)) continue // masked cells are not placements (no clipping noise)
    const p = typeof paint === 'function' ? (px, py, pz, bb) => paint(px, py, pz, bb, s) : paint
    b.set(x, y, z, p, setOpts)
  }
  return { samples, length: total, cells: cells.size }
}

// ------------------------------------------------------------------ colour data / ramps

const here = path.dirname(fileURLToPath(import.meta.url))
let colorTable
function lightnessOf(id) {
  if (colorTable === undefined) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(here, '..', 'data', 'block-colors.json'), 'utf8'))
      colorTable = raw.blocks ?? raw
    } catch {
      colorTable = null
    }
  }
  const entry = colorTable?.[withNamespace(id)]
  return entry?.lab?.[0]
}

// Ramp entries may be block ids or material names; each resolves to its shape family so
// stairs/slabs/walls keep their shape when retextured.
function resolveRamp(ramp) {
  return ramp.map(entry => {
    const id = parseBlock(entry).name
    let fam = null
    try {
      fam = materialFamily(entry)
    } catch {
      fam = null
    }
    // An exact block id wins (material() maps e.g. *_concrete_powder to its concrete family);
    // the family only contributes shapes when it is that block's own family.
    if (fam && fam.block && withNamespace(fam.block) === id) return { block: id, stairs: fam.stairs, slab: fam.slab, wall: fam.wall, id }
    if (fam && fam.block && !blockExists(id)) return { block: withNamespace(fam.block), stairs: fam.stairs, slab: fam.slab, wall: fam.wall, id }
    return { block: id, id }
  })
}

function orderDarkToLight(steps, order) {
  if (order === 'dark-to-light') return steps
  if (order === 'light-to-dark') return [...steps].reverse()
  const a = lightnessOf(steps[0].block)
  const z = lightnessOf(steps.at(-1).block)
  return a !== undefined && z !== undefined && a > z ? [...steps].reverse() : steps
}

function recolor(b, x, y, z, block, step) {
  const kind = /_stairs$/.test(block.name) ? 'stairs' : /_slab$/.test(block.name) ? 'slab' : /_wall$/.test(block.name) ? 'wall' : 'block'
  if (kind !== 'block' && !step[kind]) return // ramp material has no such shape: keep the block
  const target = withNamespace(kind === 'block' ? step.block : step[kind])
  const props = kind === 'block' ? undefined : block.props
  b.put(x, y, z, block.nbt ? { name: target, props, nbt: block.nbt } : { name: target, props })
}

// Blocks that hide what is behind them (for normals and occlusion).
const SEE_THROUGH = /(glass|_pane|_bars|_fence|_fence_gate|_leaves|_carpet|_button|_pressure_plate|torch|lantern|chain|vine|lichen|_rod|_sapling|_flower|grass$|fern$|^minecraft:water$|^minecraft:lava$|_coral$|_coral_fan|_trapdoor|_door|_sign|_banner|_candle|cobweb|snow$)/
function makeOccluder(b) {
  const cache = new Map()
  return (x, y, z) => {
    if (!b.inBounds(x, y, z)) return false
    const k = b.key(x, y, z)
    let v = cache.get(k)
    if (v === undefined) {
      const block = b.get(x, y, z)
      v = Boolean(block) && (isFullSolid(block.name) || /_(stairs|slab|wall)$/.test(block.name)) && !SEE_THROUGH.test(block.name)
      cache.set(k, v)
    }
    return v
  }
}

// Shade a surface with a ramp: value = (1 - ambient) * wrapped lambert(normal · light)
// + ambient * openness, + optional strata/base darkening/noise, then rank-normalized over the
// visible voxels so every ramp step is used (a convex statue otherwise never reaches the dark
// end). Neighbouring voxels differ by at most `maxStep` ramp steps and dithering only mixes
// adjacent steps. Interior (hidden) voxels are left alone unless interior: 'darkest'.
//   b.shadeSurface([0,0,0], [40,60,40], ['cobbled_deepslate','tuff','stone','andesite','polished_diorite'],
//                  { light: [0.4, 0.8, 0.45], only: 'white_wool' })
export function shadeSurface(b, a, c, ramp, opts = {}) {
  const {
    light = [0.35, 0.85, 0.4],
    ambient = 0.35,
    wrap = 0.3,
    only,
    normalRadius = 2,
    aoRadius = 2,
    equalize = true,
    bias = 1,
    noise = 0.08,
    scale = 5,
    base = 0,
    bands = null,
    dither = true,
    ditherScale = 2.5,
    blur = 2,
    maxStep = 1,
    interior = 'keep',
    order = 'auto',
    seed = 0,
  } = opts
  const [min, max] = minMax(a, c)
  const steps = orderDarkToLight(resolveRamp(ramp), order)
  const n = steps.length
  if (n === 0) return b
  const L = norm(light)
  const occ = makeOccluder(b)
  const cells = []
  for (const [x, y, z, block] of b.entries()) {
    if (x < min[0] || y < min[1] || z < min[2] || x > max[0] || y > max[1] || z > max[2]) continue
    if (only !== undefined && !b.matches(block, only)) continue
    cells.push([x, y, z, block])
  }
  const offsets = []
  const R = Math.max(normalRadius, aoRadius)
  for (let dx = -R; dx <= R; dx += 1)
    for (let dy = -R; dy <= R; dy += 1)
      for (let dz = -R; dz <= R; dz += 1) {
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 === 0 || d2 > R * R + 0.5) continue
        offsets.push([dx, dy, dz, d2])
      }
  const vis = []
  const h = Math.max(1, max[1] - min[1])
  for (const [x, y, z, block] of cells) {
    const exposed = N6.some(([dx, dy, dz]) => !occ(x + dx, y + dy, z + dz))
    if (!exposed) {
      if (interior === 'darkest') recolor(b, x, y, z, block, steps[0])
      continue
    }
    let nv = [0, 0, 0]
    for (const [dx, dy, dz, d2] of offsets) {
      if (d2 > normalRadius * normalRadius + 0.5) continue
      if (!occ(x + dx, y + dy, z + dz)) nv = [nv[0] + dx / d2, nv[1] + dy / d2, nv[2] + dz / d2]
    }
    nv = norm(nv)
    let open = 0
    let tot = 0
    for (const [dx, dy, dz, d2] of offsets) {
      if (d2 > aoRadius * aoRadius + 0.5) continue
      if (dx * nv[0] + dy * nv[1] + dz * nv[2] <= 0) continue
      tot += 1
      if (!occ(x + dx, y + dy, z + dz)) open += 1
    }
    const ao = tot ? open / tot : 1
    const lambert = clamp((dot(nv, L) + wrap) / (1 + wrap), 0, 1)
    let v = (1 - ambient) * lambert + ambient * ao
    if (noise) v += noise * (coherent01(x, y, z, { scale, grain: 0, seed: seed + 11 }) - 0.5)
    if (base) v -= base * (1 - (y - min[1]) / h) ** 1.5
    if (bands) {
      const bh = bands.height ?? 3
      const warp = (bands.warp ?? 1.5) * fbm3(x, 0, z, { scale: bands.scale ?? 12, octaves: 2, seed: seed + 17 })
      const idx = Math.floor((y + warp) / bh)
      v += (bands.amount ?? 0.12) * (hash01(idx, 0, 0, seed + 19) - 0.5) * 2
    }
    vis.push({ x, y, z, block, v })
  }
  if (vis.length === 0) return b
  // Blur the value over neighbouring visible voxels: voxel normals are noisy, and unblurred
  // values turn into splatter (single light blocks in dark fields).
  if (blur > 0) {
    const at = new Map(vis.map(e => [b.key(e.x, e.y, e.z), e]))
    for (let pass = 0; pass < blur; pass += 1) {
      const next = vis.map(e => {
        let s = e.v * 2
        let w = 2
        for (let dx = -1; dx <= 1; dx += 1)
          for (let dy = -1; dy <= 1; dy += 1)
            for (let dz = -1; dz <= 1; dz += 1) {
              if (!dx && !dy && !dz) continue
              if (!b.inBounds(e.x + dx, e.y + dy, e.z + dz)) continue
              const o = at.get(b.key(e.x + dx, e.y + dy, e.z + dz))
              if (!o) continue
              s += o.v
              w += 1
            }
        return s / w
      })
      vis.forEach((e, i) => { e.v = next[i] })
    }
  }
  let rankOf = v => clamp(v, 0, 1)
  if (equalize) {
    const sorted = vis.map(e => e.v).sort((p, q) => p - q)
    rankOf = v => {
      let lo = 0
      let hi = sorted.length
      while (lo < hi) {
        const m = (lo + hi) >> 1
        if (sorted[m] < v) lo = m + 1
        else hi = m
      }
      return lo / Math.max(1, sorted.length - 1)
    }
  }
  const index = new Map()
  for (const e of vis) {
    const p = clamp(rankOf(e.v), 0, 1) ** bias
    const q = p * (n - 1) * 0.9999
    let i = Math.floor(q)
    // clumped dither: mixes only the two adjacent steps, in patches rather than single blocks
    if (dither && coherent01(e.x, e.y, e.z, { scale: ditherScale, grain: 0.1, seed: seed + 23 }) < q - i) i += 1
    index.set(b.key(e.x, e.y, e.z), clamp(i, 0, n - 1))
  }
  if (maxStep !== null && maxStep >= 0) {
    for (let pass = 0; pass < 2; pass += 1) {
      for (const e of vis) {
        const k = b.key(e.x, e.y, e.z)
        const i = index.get(k)
        let sum = 0
        let cnt = 0
        for (const [dx, dy, dz] of N6) {
          if (!b.inBounds(e.x + dx, e.y + dy, e.z + dz)) continue
          const j = index.get(b.key(e.x + dx, e.y + dy, e.z + dz))
          if (j === undefined) continue
          sum += j
          cnt += 1
        }
        if (!cnt) continue
        const avg = sum / cnt
        if (Math.abs(i - avg) > maxStep + 0.5) index.set(k, clamp(Math.round(avg + Math.sign(i - avg) * maxStep), 0, n - 1))
      }
    }
  }
  for (const e of vis) recolor(b, e.x, e.y, e.z, e.block, steps[index.get(b.key(e.x, e.y, e.z))])
  return b
}

// ------------------------------------------------------------------ erosion

// VoxelSniper erode-brush presets: [erodeFaces, erodeRepeats, fillFaces, fillRepeats].
export const EROSION_PRESETS = {
  melt: [2, 1, 5, 1], // strong removal: rounds and shrinks
  fill: [5, 1, 2, 1], // strong filling: rounds concavities, grows
  smooth: [3, 1, 3, 1], // knocks off corners, fills notches (the everyday choice)
  lift: [6, 0, 1, 1], // adds a layer on top of everything
  floatclean: [6, 1, 6, 1], // removes isolated blocks, fills enclosed holes
}

// Cellular-automaton smoothing inside a box. A solid with >= erodeFaces empty face-neighbours is
// removed; an empty cell with >= fillFaces solid face-neighbours takes its most common full-block
// neighbour. `only` limits what may be removed and what fills copy; `protect(x,y,z,block)` keeps
// thin parts (sails, fins) safe.
export function erode(b, a, c, { preset = 'smooth', iterations = 1, only, protect, faces } = {}) {
  const [min, max] = minMax(a, c)
  const [ef, ec, ff, fc] = faces ?? EROSION_PRESETS[preset] ?? EROSION_PRESETS.smooth
  const inBox = (x, y, z) => x >= min[0] && y >= min[1] && z >= min[2] && x <= max[0] && y <= max[1] && z <= max[2]
  const solid = (x, y, z) => b.has(x, y, z)
  const eligible = block => (only === undefined || b.matches(block, only))
  let removed = 0
  let added = 0
  for (let it = 0; it < iterations; it += 1) {
    for (let r = 0; r < ec; r += 1) {
      const kill = []
      for (const [x, y, z, block] of b.entries()) {
        if (!inBox(x, y, z) || !eligible(block)) continue
        if (protect && protect(x, y, z, block)) continue
        let empty = 0
        for (const [dx, dy, dz] of N6) if (!solid(x + dx, y + dy, z + dz)) empty += 1
        if (empty >= ef) kill.push([x, y, z])
      }
      for (const [x, y, z] of kill) b.remove(x, y, z)
      removed += kill.length
    }
    for (let r = 0; r < fc; r += 1) {
      const add = new Map()
      for (const [x, y, z] of b.entries()) {
        for (const [dx, dy, dz] of N6) {
          const ex = x + dx
          const ey = y + dy
          const ez = z + dz
          if (!inBox(ex, ey, ez) || !b.inBounds(ex, ey, ez) || solid(ex, ey, ez)) continue
          const k = `${ex},${ey},${ez}`
          if (add.has(k)) continue
          let count = 0
          const tally = new Map()
          for (const [px, py, pz] of N6) {
            const nb = b.get(ex + px, ey + py, ez + pz)
            if (!nb) continue
            count += 1
            if (!isFullSolid(nb.name) || !eligible(nb)) continue
            const key = nb.name + JSON.stringify(nb.props ?? {})
            const t = tally.get(key)
            if (t) t.n += 1
            else tally.set(key, { n: 1, block: nb })
          }
          if (count < ff || tally.size === 0) continue
          let best = null
          for (const t of tally.values()) if (!best || t.n > best.n) best = t
          add.set(k, best.block)
        }
      }
      for (const [k, block] of add) {
        const [x, y, z] = k.split(',').map(Number)
        b.put(x, y, z, { name: block.name, props: block.props })
      }
      added += add.size
    }
  }
  return { removed, added }
}

// ------------------------------------------------------------------ ship hull

// Lofted hull. `bow` = bow tip at keel-bottom level on the centreline; the hull runs back from it
// opposite to `heading`. Sections: superellipse below the waterline (section 2 round bilge, 3-4
// full U, 1.3-1.6 V), tumblehome (> 0) or flare (< 0) above it, sheer rising toward the ends.
// Returns helpers: at(u, w, y) local→world, deckY(u) (local deck surface), mast(u) (world pos of
// the first block above the main deck on the centreline), and the dimensions.
export function hull(b, opts = {}) {
  const {
    bow = [0, 0, 0],
    heading = 'east',
    length: Lh = 40,
    beam = Math.max(5, Math.round(Lh / 3.8)),
    depth = Math.max(3, Math.round(Lh / 5.5)),
    maxBeamAt = 0.4,
    bowExp = 0.6,
    runExp = 2.2,
    transom = 0.6,
    doubleEnded = false,
    section = 2.5,
    waterline = 0.55,
    tumble = 0.12,
    sheerFwd = Lh / 16,
    sheerAft = Lh / 12,
    forefoot = 0.6,
    forefootLength = 0.2,
    rocker = 0.2,
    rockerLength = 0.1,
    thickness = 1,
    decks = [],
    bulwark = 1,
    rail = 'spruce_fence',
    keel = 'dark_oak_slab[type=top]',
    stem = true,
    gunports = null,
    paint = {},
  } = opts
  const P = { bottom: 'dark_oak_planks', wale: 'stripped_dark_oak_log', side: 'spruce_planks', deck: 'spruce_planks', trim: 'stripped_spruce_log', ...paint }
  const hv = DIR[heading]
  if (!hv || hv[1] !== 0) throw new Error(`hull heading must be north/east/south/west, got ${heading}`)
  const rv = [-hv[2], 0, hv[0]] // starboard (right-hand side looking forward)
  const halfBreadth = u => {
    const t = clamp(u / Lh, 0, 1)
    if (doubleEnded) return (beam / 2) * Math.sin(Math.PI * t) ** bowExp
    return t < maxBeamAt
      ? (beam / 2) * Math.sin((Math.PI / 2) * (t / maxBeamAt)) ** bowExp
      : (beam / 2) * (1 - (1 - transom) * ((t - maxBeamAt) / (1 - maxBeamAt)) ** runExp)
  }
  const deckAt = u => {
    const t = clamp(u / Lh, 0, 1)
    return depth + (t < 0.5 ? sheerFwd * ((0.5 - t) / 0.5) ** 2 : sheerAft * ((t - 0.5) / 0.5) ** 2)
  }
  const yw = Math.max(1, waterline * depth)
  // keel line: rises toward the bow (forefoot) and slightly toward the stern (rocker)
  const keelAt = u => {
    const t = clamp(u / Lh, 0, 1)
    let r = t < forefootLength ? forefoot * yw * ((forefootLength - t) / forefootLength) ** 2 : 0
    const rl = doubleEnded ? forefootLength : rockerLength
    const ra = doubleEnded ? forefoot : rocker
    if (1 - t < rl) r = Math.max(r, ra * yw * ((rl - (1 - t)) / rl) ** 2)
    return r
  }
  // plan/section test ignoring the deck cap (so sheer steps are not mistaken for sides)
  const inPlan = (u, y, w) => {
    if (u < 0 || u > Lh || y < 0) return false
    const hb = halfBreadth(u)
    if (hb <= 0.05) return false
    const yk = keelAt(u)
    if (y < yk - 0.5) return false
    if (y <= yw) {
      const dy = (yw - y) / Math.max(0.5, yw - yk)
      return (Math.abs(w) / hb) ** section + dy ** section <= 1
    }
    const k = (y - yw) / Math.max(1, deckAt(u) - yw)
    return Math.abs(w) <= hb * (1 - tumble * Math.min(1.2, k))
  }
  const inside = (u, y, w) => inPlan(u, y, w) && y <= deckAt(u)
  const toWorld = (u, w, y) => [bow[0] - hv[0] * u + rv[0] * w, bow[1] + y, bow[2] - hv[2] * u + rv[2] * w]
  const toLocal = (x, y, z) => {
    const dx = x - bow[0]
    const dz = z - bow[2]
    return [-(dx * hv[0] + dz * hv[2]), y - bow[1], dx * rv[0] + dz * rv[2]]
  }
  const W = Math.ceil(beam / 2 + 2)
  const topMax = Math.ceil(depth + Math.max(sheerFwd, sheerAft) + 1)
  const corners = [toWorld(-2, -W, -2), toWorld(Lh + 2, W, topMax + bulwark + 2)]
  const [lo, hi] = minMax(corners[0], corners[1])
  const deckSet = new Set(decks.map(d => Math.round(d)))
  const top = []
  for (let x = Math.floor(lo[0]); x <= Math.ceil(hi[0]); x += 1)
    for (let z = Math.floor(lo[2]); z <= Math.ceil(hi[2]); z += 1)
      for (let y = Math.floor(lo[1]); y <= Math.ceil(hi[1]); y += 1) {
        const [u, ly, w] = toLocal(x, y, z)
        if (!inside(u, ly, w)) continue
        let side = false
        let shell = false
        for (let k = 1; k <= thickness; k += 1) {
          for (const [du, dw] of [[k, 0], [-k, 0], [0, k], [0, -k]]) if (!inPlan(u + du, ly, w + dw)) side = true
          if (!inside(u, ly - k, w)) shell = true
        }
        const isTop = !inside(u, ly + 1, w)
        if (side || shell) {
          const paintId = ly <= yw ? P.bottom : ly <= yw + 1 ? P.wale : P.side
          b.set(x, y, z, paintId)
          if (isTop && side) top.push([u, ly, w])
        } else if (isTop || deckSet.has(ly)) {
          b.set(x, y, z, P.deck)
        } else {
          b.set(x, y, z, 'air')
        }
      }
  // bulwark + rail on the gunwale
  for (const [u, ly, w] of top) {
    for (let k = 1; k <= bulwark; k += 1) {
      const p = toWorld(u, w, ly + k)
      b.set(p[0], p[1], p[2], P.side)
    }
    if (rail) {
      const p = toWorld(u, w, ly + bulwark + 1)
      b.set(p[0], p[1], p[2], rail)
    }
  }
  // keel row under the centreline
  if (keel) {
    for (let u = Math.round(Lh * 0.03); u <= Math.round(Lh * 0.98); u += 1) {
      let y = 0
      while (y < depth && !inside(u, y, 0)) y += 1
      if (y >= depth) continue
      const p = toWorld(u, 0, y - 1)
      b.set(p[0], p[1], p[2], keel)
    }
  }
  // stem (and sternpost for double-enders)
  if (stem) {
    const posts = doubleEnded ? [0, Lh] : [0]
    for (const u0 of posts) {
      const u = u0 === 0 ? 1 : Lh - 1
      const yTop = Math.round(deckAt(u)) + bulwark + (doubleEnded ? 3 : 1)
      for (let y = 0; y <= yTop; y += 1) {
        const p = toWorld(u0 === 0 ? 0 : Lh, 0, y)
        if (y >= Math.round(deckAt(u) * 0.3)) b.set(p[0], p[1], p[2], P.trim)
      }
      if (doubleEnded) {
        // curl the post tip outward
        const dir = u0 === 0 ? -1 : 1
        const p = toWorld(u0 + dir, 0, yTop)
        b.set(p[0], p[1], p[2], P.trim)
      }
    }
  }
  // gunports: 1x1 openings along both sides
  if (gunports) {
    const { y: gy, every = 3, from = 0.2, to = 0.85, frame = null } = gunports
    for (let u = Math.round(Lh * from); u <= Math.round(Lh * to); u += every) {
      for (const sgn of [1, -1]) {
        for (let w = 0; w <= W; w += 1) {
          if (inside(u, gy, w * sgn) && !inside(u, gy, (w + 1) * sgn)) {
            const p = toWorld(u, w * sgn, gy)
            b.set(p[0], p[1], p[2], 'air')
            if (frame) {
              const q = toWorld(u, w * sgn, gy + 1)
              b.set(q[0], q[1], q[2], frame)
            }
            break
          }
        }
      }
    }
  }
  const deckY = u => {
    let y = Math.floor(deckAt(u))
    while (y > 0 && !inside(u, y, 0)) y -= 1
    return y
  }
  return {
    length: Lh,
    beam,
    depth,
    waterline: yw,
    at: toWorld,
    deckY,
    mast: u => toWorld(u, 0, deckY(u) + 1),
    halfBreadth,
  }
}

// ------------------------------------------------------------------ crystals

function hexCrystalInside(base, dir, a, Lc, tipH, roll) {
  const d = norm(dir)
  const helper = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  let v = norm(cross(d, helper))
  v = rotate(v, d, roll)
  const w = cross(d, v)
  return (x, y, z) => {
    const p = sub([x, y, z], base)
    const u = dot(p, d)
    if (u < -1 || u > Lc + tipH) return false
    const pv = dot(p, v)
    const pw = dot(p, w)
    const hex = Math.max(Math.abs(pv), Math.abs(0.5 * pv + 0.866 * pw), Math.abs(0.5 * pv - 0.866 * pw))
    const ap = u <= Lc ? a : a * (1 - (u - Lc) / tipH)
    return hex <= ap
  }
}

const dominantFacing = d => {
  const ax = Math.abs(d[0])
  const ay = Math.abs(d[1])
  const az = Math.abs(d[2])
  if (ay >= ax && ay >= az) return d[1] >= 0 ? 'up' : 'down'
  if (ax >= az) return d[0] >= 0 ? 'east' : 'west'
  return d[2] >= 0 ? 'south' : 'north'
}

// A cluster of hexagonal crystals (prism + 6-sided pyramid tip) radiating from `base` around
// `normal`: 1 dominant, the rest 0.25-0.7 of its size, tilted up to `spread` degrees.
// core/shell paints (shell = outer layer, e.g. stained glass over amethyst). Crystals with an
// apothem under 1 become 1-wide spikes; `tip` is placed beyond each apex.
export function crystalCluster(b, base, opts = {}) {
  const {
    count = 7,
    length = 12,
    apothem = 2,
    spread = 35,
    normal = [0, 1, 0],
    seed = 0,
    core = 'amethyst_block',
    shell = null,
    tip = 'amethyst_cluster',
    bed = 'calcite',
    bedOuter = 'smooth_basalt',
    bedRadius = null,
  } = opts
  const rng = createRng(seed + 101)
  const nrm = norm(normal)
  const helper = Math.abs(nrm[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const e1 = norm(cross(nrm, helper))
  const e2 = cross(nrm, e1)
  const crystals = []
  for (let i = 0; i < count; i += 1) {
    const size = i === 0 ? 1 : 0.25 + 0.45 * rng() * (1 - i / (count + 2))
    const tilt = rad(i === 0 ? rng() * 8 : 10 + rng() * Math.max(0, spread - 10))
    const az = rng() * Math.PI * 2
    const side = add(mul(e1, Math.cos(az)), mul(e2, Math.sin(az)))
    const dir = norm(add(mul(nrm, Math.cos(tilt)), mul(side, Math.sin(tilt))))
    const off = i === 0 ? 0 : apothem * (0.8 + 1.4 * rng())
    const b0 = add(add(base, mul(side, off)), mul(nrm, -1))
    crystals.push({ base: b0, dir, a: Math.max(0.5, apothem * size), L: Math.max(2, length * size), roll: rng() * Math.PI })
  }
  // bed of host rock (geode-like rings) when the cluster grows upward
  if (bed && nrm[1] > 0.7) {
    const R = bedRadius ?? apothem * 3.2
    const inside = (x, y, z) => ((x - base[0]) / R) ** 2 + ((y - base[1] + 1) / (R * 0.4)) ** 2 + ((z - base[2]) / R) ** 2 <= 1 + 0.25 * fbm3(x, y, z, { scale: 4, octaves: 2, seed })
    b.fillWhere([base[0] - R - 1, base[1] - 1, base[2] - R - 1], [base[0] + R + 1, base[1] + 1, base[2] + R + 1], inside,
      (x, y, z) => (bedOuter && Math.hypot(x - base[0], z - base[2]) > R * 0.72 ? bedOuter : bed))
  }
  for (const cr of crystals) {
    const { a, L: Lc, dir } = cr
    const tipH = 1.15 * a
    if (a < 1) {
      const end = add(cr.base, mul(dir, Lc))
      b.line(cr.base, end, core, { connect: 6 })
      if (tip) {
        const f = dominantFacing(dir)
        const t = add(end.map(Math.round), DIR[f])
        b.set(t[0], t[1], t[2], `${withNamespace(parseBlock(tip).name)}[facing=${f}]`, { keep: true })
      }
      continue
    }
    const inside = hexCrystalInside(cr.base, dir, a, Lc, tipH, cr.roll)
    const R = Lc + tipH + a + 1
    const lo = cr.base.map(v => v - R)
    const hi = cr.base.map(v => v + R)
    const paint = shell
      ? (x, y, z) => (N6.some(([dx, dy, dz]) => !inside(x + dx, y + dy, z + dz)) ? shell : core)
      : core
    b.fillWhere(lo, hi, inside, paint)
    if (tip) {
      const apex = add(cr.base, mul(dir, Lc + tipH))
      const f = dominantFacing(dir)
      const t = add(apex.map(Math.round), DIR[f])
      b.set(t[0], t[1], t[2], `${withNamespace(parseBlock(tip).name)}[facing=${f}]`, { keep: true })
    }
  }
  return { crystals }
}

// ------------------------------------------------------------------ huge mushrooms

const MUSHROOM_BLOCKS = new Set(['minecraft:red_mushroom_block', 'minecraft:brown_mushroom_block', 'minecraft:mushroom_stem'])

// Set the six face properties of every mushroom block in a box: a face shows cap/stem texture
// (true) only where it touches a non-mushroom cell; cap undersides use pores (down=false) so the
// gills show. This matches what vanilla does when mushroom blocks touch.
export function fixMushroomFaces(b, a, c, { gills = true } = {}) {
  const [min, max] = minMax(a, c)
  let n = 0
  for (const [x, y, z, block] of b.entries()) {
    if (x < min[0] || y < min[1] || z < min[2] || x > max[0] || y > max[1] || z > max[2]) continue
    if (!MUSHROOM_BLOCKS.has(block.name)) continue
    const props = {}
    N6.forEach(([dx, dy, dz], i) => {
      const nb = b.get(x + dx, y + dy, z + dz)
      let face = !(nb && MUSHROOM_BLOCKS.has(nb.name))
      if (gills && FACE_NAMES[i] === 'down' && block.name !== 'minecraft:mushroom_stem') face = false
      props[FACE_NAMES[i]] = face ? 'true' : 'false'
    })
    b.put(x, y, z, { name: block.name, props })
    n += 1
  }
  return n
}

// Giant mushroom: curved, bulb-footed stem (tubeAlong) + cap. type 'red' = domed cap with a
// drooping rim and a hollow gill chamber; 'brown' = broad shallow plate. Faces are set so caps
// show their texture outside and pores (gills) underneath.
export function hugeMushroom(b, base, opts = {}) {
  const {
    type = 'red',
    height = 18,
    capRadius = (type === 'brown' ? 0.75 : 0.55) * height,
    stemRadius = Math.max(1.2, capRadius * 0.17),
    lean = 0.12,
    seed = 0,
    spots = type === 'red',
    glow = false,
    ring = false,
    stem = 'mushroom_stem',
  } = opts
  const rng = createRng(seed + 211)
  const R = capRadius
  const az = rng() * Math.PI * 2
  const top = [base[0] + Math.cos(az) * lean * height, base[1] + height, base[2] + Math.sin(az) * lean * height]
  const mid = [base[0] + Math.cos(az) * lean * height * 0.3 + (rng() - 0.5), base[1] + height * 0.5, base[2] + Math.sin(az) * lean * height * 0.3 + (rng() - 0.5)]
  tubeAlong(b, [base, mid, top], s => stemRadius * (1 + 0.7 * (1 - s) ** 5), stem, { mask: (x, y) => y >= base[1] })
  const capBlock = type === 'brown' ? 'brown_mushroom_block' : 'red_mushroom_block'
  const capC = type === 'brown' ? [top[0], top[1] - 0.05 * R, top[2]] : [top[0], top[1] - 0.25 * R, top[2]]
  const outerR = type === 'brown' ? [R, 0.3 * R, R] : [R, 0.62 * R, R]
  const thick = Math.max(2, (type === 'brown' ? 0.12 : 0.18) * R)
  const innerC = [capC[0], capC[1] - thick, capC[2]]
  const innerR = type === 'brown' ? [0.96 * R, 0.24 * R, 0.96 * R] : [0.9 * R, 0.5 * R, 0.9 * R]
  const clipY = type === 'brown' ? capC[1] - 1 : capC[1] - 0.35 * R
  const ell = (x, y, z, c, r) => ((x - c[0]) / r[0]) ** 2 + ((y - c[1]) / r[1]) ** 2 + ((z - c[2]) / r[2]) ** 2 <= 1
  const inCap = (x, y, z) => y >= clipY && ell(x, y, z, capC, outerR) && !ell(x, y, z, innerC, innerR)
  const lo = [capC[0] - R - 1, clipY - 1, capC[2] - R - 1]
  const hi = [capC[0] + R + 1, capC[1] + outerR[1] + 1, capC[2] + R + 1]
  b.fillWhere(lo, hi, inCap, capBlock)
  if (spots) {
    b.fillWhere(lo, hi, (x, y, z) => inCap(x, y, z) && !inCap(x, y + 1, z) && coherent01(x, y, z, { scale: Math.max(2, R / 4), grain: 0, seed: seed + 5 }) > 0.8, 'mushroom_stem')
  }
  if (ring) {
    const ry = base[1] + height * 0.72
    b.sdf([top[0] - stemRadius * 3, ry - 2, top[2] - stemRadius * 3], [top[0] + stemRadius * 3, ry + 2, top[2] + stemRadius * 3],
      (x, y, z) => Math.hypot(Math.hypot(x - (base[0] + (top[0] - base[0]) * 0.72), z - (base[2] + (top[2] - base[2]) * 0.72)) - stemRadius * 1.4, y - ry) - 0.9, stem)
  }
  if (glow) {
    b.fillWhere(lo, hi, (x, y, z) => inCap(x, y, z) && !inCap(x, y - 1, z) && !b.has(x, y - 1, z) && hash01(x, y, z, seed + 9) < 0.06, 'shroomlight')
  }
  const fx0 = Math.min(lo[0], base[0] - stemRadius * 2) - 1
  const fz0 = Math.min(lo[2], base[2] - stemRadius * 2) - 1
  const fx1 = Math.max(hi[0], base[0] + stemRadius * 2) + 1
  const fz1 = Math.max(hi[2], base[2] + stemRadius * 2) + 1
  fixMushroomFaces(b, [fx0, base[1] - 1, fz0], [fx1, hi[1] + 1, fz1], { gills: true })
  return { top, capCenter: capC, capRadius: R }
}

// ------------------------------------------------------------------ clouds

const WYVILL = (d2, R2) => (d2 >= R2 ? 0 : (1 - d2 / R2) ** 3)

// Flat-based cumulus: metaball puffs on 1-3 tiers along an elongated footprint, clipped at the
// base plane y = center[1], hollowed, then shaded top-light (snow on top, grey underside).
// ramp is dark→light.
export function cloud(b, center, opts = {}) {
  const {
    length = 32,
    width = length * 0.5,
    height = length * 0.32,
    tiers = 2,
    axis = 'x',
    seed = 0,
    hollow = true,
    ramp = ['light_gray_concrete_powder', 'white_concrete', 'white_concrete_powder', 'white_wool', 'snow_block'],
    light = [0.25, 1, 0.3],
  } = opts
  const rng = createRng(seed + 307)
  const y0 = center[1]
  const balls = []
  const n = Math.max(4, Math.round(length / 4))
  const along = (u, across) => (axis === 'x' ? [center[0] + u, center[2] + across] : [center[0] + across, center[2] + u])
  let maxR = 0
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 0.5 : i / (n - 1)
    const r = (0.45 + 0.55 * Math.sin(Math.PI * t)) * height * 0.62 * (0.85 + 0.3 * rng())
    const [x, z] = along((t - 0.5) * length * 0.82, (rng() - 0.5) * width * 0.55)
    balls.push({ c: [x, y0 + r * 0.25, z], R: r * 1.64 })
    maxR = Math.max(maxR, r)
    for (let k = 1; k < tiers; k += 1) {
      if (rng() > 0.75) continue
      const rk = r * (0.62 - 0.12 * k) * (0.85 + 0.3 * rng())
      const [xk, zk] = along((t - 0.5) * length * 0.82 + (rng() - 0.5) * r, (rng() - 0.5) * width * 0.3)
      balls.push({ c: [xk, y0 + r * (0.55 + 0.45 * k), zk], R: rk * 1.64 })
    }
  }
  const field = (x, y, z) => {
    if (y < y0) return false
    let s = 0
    for (const ball of balls) {
      const d2 = (x - ball.c[0]) ** 2 + (y - ball.c[1]) ** 2 + (z - ball.c[2]) ** 2
      if (d2 < ball.R * ball.R) s += WYVILL(d2, ball.R * ball.R)
    }
    return s >= 0.25
  }
  const span = length / 2 + maxR * 1.7
  const spanW = width / 2 + maxR * 1.7
  const lo = axis === 'x' ? [center[0] - span, y0, center[2] - spanW] : [center[0] - spanW, y0, center[2] - span]
  const hi = axis === 'x' ? [center[0] + span, y0 + height * 2.2, center[2] + spanW] : [center[0] + spanW, y0 + height * 2.2, center[2] + span]
  b.fillWhere(lo, hi, field, ramp.at(-1), { hollow, thickness: 2 })
  shadeSurface(b, lo, hi, ramp, { light, ambient: 0.25, wrap: 0.5, noise: 0.12, scale: 4, order: 'dark-to-light', only: ramp.at(-1), maxStep: 1, seed })
  return { balls: balls.length, min: lo, max: hi }
}

// ------------------------------------------------------------------ rock arch

// Natural arch between two feet (ground positions of the leg centres): a rounded fin minus an
// elliptical tunnel, fbm-displaced, eroded once, then shaded with horizontal strata.
// ramp is dark→light (or light→dark; auto-detected).
export function rockArch(b, footA, footB, opts = {}) {
  const span = Math.hypot(footB[0] - footA[0], footB[2] - footA[2])
  const {
    height = span * 0.75,
    thickness = Math.max(4, span * 0.3),
    leg = Math.max(2.5, span * 0.17),
    lintel = Math.max(3, height * 0.28),
    roughness = 1.6,
    scale = 9,
    embed = 2,
    seed = 0,
    smoothPasses = 1,
    ramp = ['cobbled_deepslate', 'tuff', 'stone', 'andesite', 'polished_andesite'],
    bands = { height: 3, amount: 0.14 },
    light = [0.4, 0.85, 0.35],
  } = opts
  const m = [(footA[0] + footB[0]) / 2, Math.min(footA[1], footB[1]), (footA[2] + footB[2]) / 2]
  const du = norm([footB[0] - footA[0], 0, footB[2] - footA[2]])
  const dw = [-du[2], 0, du[0]]
  const halfSpan = span / 2
  const Au = halfSpan + leg
  const Av = (height + embed) / 2
  const vc = (height - embed) / 2
  const Hu = Math.max(1, halfSpan - leg)
  const Hv = Math.max(1, height - lintel)
  const f = (x, y, z) => {
    const p = [x - m[0], y - m[1], z - m[2]]
    const u = dot(p, du)
    const w = dot(p, dw)
    const v = p[1]
    if (v < -embed) return 1
    const vn = clamp((v + embed) / (height + embed), 0, 1)
    const T = (thickness / 2) * (1 + 0.35 * (1 - vn))
    const fin = Math.max((((Math.abs(u) / Au) ** 4 + (Math.abs(v - vc) / Av) ** 4) ** 0.25 - 1) * Math.min(Au, Av), Math.abs(w) - T)
    const hole = (Math.hypot(u / Hu, v / Hv) - 1) * Math.min(Hu, Hv)
    return Math.max(fin, -hole) + roughness * fbm3(x, y, z, { scale, octaves: 3, seed })
  }
  const R = Au + roughness * 2 + 2
  const lo = [m[0] - R, m[1] - embed, m[2] - R]
  const hi = [m[0] + R, m[1] + height + roughness * 2 + 2, m[2] + R]
  b.sdf(lo, hi, f, ramp[Math.floor(ramp.length / 2)])
  const marker = withNamespace(parseBlock(ramp[Math.floor(ramp.length / 2)]).name)
  if (smoothPasses > 0) erode(b, lo, hi, { preset: 'smooth', iterations: smoothPasses, only: marker })
  erode(b, lo, hi, { preset: 'floatclean', only: marker })
  shadeSurface(b, lo, hi, ramp, { light, only: marker, bands, base: 0.15, noise: 0.1, scale: 6, seed, interior: 'darkest' })
  return { min: lo, max: hi, span }
}

// ------------------------------------------------------------------ figure (statue)

const FACING_MAP = {
  south: { fwd: [0, 0, 1], left: [1, 0, 0] },
  north: { fwd: [0, 0, -1], left: [-1, 0, 0] },
  east: { fwd: [1, 0, 0], left: [0, 0, -1] },
  west: { fwd: [-1, 0, 0], left: [0, 0, 1] },
}

// Humanoid statue on an armature, smooth-unioned. Local frame: +z forward, +x = the figure's left,
// y up from the soles. `heads` = total height in head-heights (8 ideal, 7.5 realistic, 4-5
// stylized); limb girth follows an 8-head canon scaled by `build`. Pose angles in degrees:
//   arms: { raise (sideways), swing (forward), elbow (bend) }, legs: { swing, spread, knee },
//   contrapposto 0..1 (weight on the right leg), headTurn, lean (forward, deg).
// Paint is applied as-is (use a canvas block, then b.shadeSurface()).
export function figure(b, base, opts = {}) {
  const {
    height: H = 32,
    heads = 7.5,
    facing = 'south',
    build = 1,
    smooth = 0.3,
    face = true,
    hollow = false,
    paint = 'white_wool',
    pose = {},
    rMin = 0.87,
  } = opts
  const frame = FACING_MAP[facing]
  if (!frame) throw new Error(`figure facing must be north/east/south/west, got ${facing}`)
  const armL = { raise: 12, swing: 0, elbow: 12, ...(pose.armL ?? pose.arms ?? {}) }
  const armR = { raise: 12, swing: 0, elbow: 12, ...(pose.armR ?? pose.arms ?? {}) }
  const legL = { swing: 0, spread: 4, knee: 0, ...(pose.legL ?? pose.legs ?? {}) }
  const legR = { swing: 0, spread: 4, knee: 0, ...(pose.legR ?? pose.legs ?? {}) }
  const cp = clamp(pose.contrapposto ?? 0.4, 0, 1)
  const headTurn = rad(pose.headTurn ?? 0)
  const lean = rad(pose.lean ?? 0)
  const h = H / heads // head height
  const c = H / 8 // canon unit (one ideal head) for lengths
  const body = H - h // chin height
  const shoulderY = body * 0.94
  const chestY = body * 0.84
  const waistY = body * 0.7
  const hipY = body * 0.575
  const footY = Math.max(0.5, body * 0.035)
  const X = [1, 0, 0]
  const Y = [0, 1, 0]
  const Z = [0, 0, 1]
  // contrapposto: weight on right leg (−x side), pelvis tilts up on the right, shoulders opposite
  const shift = -0.12 * c * cp
  const hip = sgn => [sgn * 0.42 * c + shift, hipY + (sgn < 0 ? 1 : -1) * 0.1 * c * cp, 0]
  const shoulder = sgn => [sgn * 1.0 * c * build ** 0.5 + shift * 1.6, shoulderY + (sgn < 0 ? -1 : 1) * 0.08 * c * cp, 0]
  const parts = []
  const g = c * build // girth unit (build scales girth, not length)
  const ell = (cc, r) => { const rr = r.map(v => Math.max(rMin, v)); parts.push(p => sdEllipsoid(p, cc, rr)) }
  const bone = (a, bb, r0, r1) => parts.push(p => sdTaper(p, a, bb, Math.max(rMin, r0), Math.max(rMin, r1)))
  // torso
  ell([shift * 1.4, chestY, 0.05 * c], [0.95 * g, 0.85 * c, 0.56 * g])
  ell([shift * 1.2, waistY, 0], [0.72 * g, 0.66 * c, 0.48 * g])
  ell([shift, hipY + 0.12 * c, -0.04 * c], [0.86 * g, 0.56 * c, 0.52 * g])
  // neck + head
  const headC = [shift * 1.6, H - h / 2, 0.02 * h]
  bone([shift * 1.6, shoulderY - 0.2 * c, 0], [headC[0], body + 0.15 * h, 0], 0.3 * g, 0.26 * g)
  ell(headC, [0.39 * h, 0.5 * h, 0.45 * h])
  // arms
  const arm = (sgn, a) => {
    const s0 = shoulder(sgn)
    let dir = [0, -1, 0]
    dir = rotate(dir, Z, sgn * rad(a.raise)) // abduction: rotate toward the figure's own side
    dir = rotate(dir, [1, 0, 0], -rad(a.swing)) // positive swing = forward (+z)
    const upper = 1.45 * c
    const elbow = add(s0, mul(dir, upper))
    let perp = sub(Z, mul(dir, dot(Z, dir)))
    if (len(perp) < 1e-3) perp = Y
    perp = norm(perp)
    const e = rad(a.elbow)
    const fore = norm(add(mul(dir, Math.cos(e)), mul(perp, Math.sin(e))))
    const wrist = add(elbow, mul(fore, 1.25 * c))
    ell(s0, [0.4 * g, 0.34 * g, 0.34 * g]) // deltoid
    bone(s0, elbow, 0.31 * g, 0.24 * g)
    bone(elbow, wrist, 0.24 * g, 0.17 * g)
    bone(wrist, add(wrist, mul(fore, 0.6 * c)), 0.18 * g, 0.13 * g)
    return { shoulder: s0, elbow, wrist }
  }
  const leg = (sgn, l) => {
    const h0 = hip(sgn)
    let dir = [0, -1, 0]
    dir = rotate(dir, Z, sgn * rad(l.spread))
    dir = rotate(dir, X, -rad(l.swing))
    const kneeBend = rad(l.knee + (sgn > 0 ? 14 * cp : 0)) // free (left) leg relaxes
    const thighLen = (hip(sgn)[1] - footY) * 0.52
    const knee = add(h0, mul(dir, thighLen))
    const calfDir = norm(rotate(dir, X, kneeBend))
    let ankle = add(knee, mul(calfDir, thighLen * 0.93))
    if (ankle[1] < footY) ankle = [ankle[0], footY, ankle[2]]
    bone(h0, knee, 0.48 * g, 0.31 * g)
    bone(knee, ankle, 0.34 * g, 0.19 * g)
    bone([ankle[0], ankle[1] - 0.05 * c, ankle[2] - 0.15 * c], [ankle[0], Math.max(0.3, ankle[1] - 0.12 * c), ankle[2] + 0.75 * c], 0.2 * g, 0.17 * g)
    return { hip: h0, knee, ankle }
  }
  const joints = { armL: arm(1, armL), armR: arm(-1, armR), legL: leg(1, legL), legR: leg(-1, legR), head: headC }
  const k = smooth * c
  // face: eye sockets and nose (only where they can read: head >= 5 blocks)
  const faceParts = face && h >= 5
  const eyeY = headC[1]
  const sdBody = p => {
    let d = Infinity
    for (const part of parts) {
      const v = part(p)
      d = d === Infinity ? v : smin(v, d, k)
    }
    if (faceParts) {
      const nose = sdTaper(p, [headC[0], eyeY - 0.02 * h, headC[2] + 0.36 * h], [headC[0], eyeY - 0.24 * h, headC[2] + 0.5 * h], 0.07 * h, 0.1 * h)
      d = Math.min(d, nose)
      for (const sx of [1, -1]) {
        const eye = Math.hypot(p[0] - (headC[0] + sx * 0.17 * h), p[1] - eyeY, p[2] - (headC[2] + 0.46 * h)) - 0.1 * h
        d = Math.max(d, -eye)
      }
    }
    return d
  }
  // world <-> local (rotate head features with headTurn is approximated by turning the whole head region)
  const toLocal = (x, y, z) => {
    const d = [x - base[0], y - base[1], z - base[2]]
    let lx = dot(d, frame.left)
    let ly = d[1]
    let lz = dot(d, frame.fwd)
    if (lean) {
      const cy = Math.cos(lean)
      const sy = Math.sin(lean)
      const yy = ly * cy + lz * sy
      lz = -ly * sy + lz * cy
      ly = yy
    }
    if (headTurn && ly > body - 0.1 * h) {
      const cx = Math.cos(-headTurn)
      const sx = Math.sin(-headTurn)
      const nx = (lx - headC[0]) * cx - lz * sx + headC[0]
      lz = (lx - headC[0]) * sx + lz * cx
      lx = nx
    }
    return [lx, ly, lz]
  }
  const sl = Math.abs(Math.sin(lean))
  const reach = Math.max(1.6 * c + 3.5 * c, 0.6 * h) + 2 + H * sl
  const lo = [base[0] - reach, base[1] - 1.5 * c * sl, base[2] - reach]
  const hi = [base[0] + reach, base[1] + H + 1, base[2] + reach]
  b.fillWhere(lo, hi, (x, y, z) => sdBody(toLocal(x, y, z)) <= 0, paint, { hollow })
  const toWorld = q => [base[0] + frame.left[0] * q[0] + frame.fwd[0] * q[2], base[1] + q[1], base[2] + frame.left[2] * q[0] + frame.fwd[2] * q[2]]
  const world = {}
  for (const [name, j] of Object.entries(joints)) world[name] = Array.isArray(j) ? toWorld(j) : Object.fromEntries(Object.entries(j).map(([kk, v]) => [kk, toWorld(v)]))
  return { joints: world, headHeight: h, canon: c, min: lo, max: hi }
}

export const SCULPT_METHODS = { tubeAlong, shadeSurface, erode, hull, crystalCluster, hugeMushroom, fixMushroomFaces, cloud, rockArch, figure }
