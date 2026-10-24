// Settlement planning: heightmaps, terrain-aware roads, building lots, curtain walls,
// plazas and a skyline report. Reference: references/building/composition.md.
//
//   const ground = plan.heightmapOf(b)                         // (x, z) → surface y
//   const road = plan.routeRoad(ground, [2, 40], [90, 52])     // smoothed + graded polyline
//   plan.paintRoad(b, road, { width: 3, paint: kit.palette({ dirt_path: 6, coarse_dirt: 2, gravel: 1 }) })
//   const lots = plan.lotsAlongRoad(road, { roadWidth: 3, heightFn: ground })
//   plan.curtainWall(b, plan.ringPolygon([48, 48], 30, { seed: 3 }), { gate: { at: [18, 40] } })
//   plan.plaza(b, [48, 48], [16, 20], { feature: 'well' })
//   console.log(plan.skylineReport(b).text)
//
// Builder-first functions take the builder as the first argument (heightmapOf, paintRoad,
// curtainWall, plaza, skylineReport); the others are pure geometry helpers. Every function is
// deterministic for a given seed.

import { DIR, facingFrom, parseBlock } from './blocks.mjs'
import { material } from './materials.mjs'
import { createRng } from './noise.mjs'

// ------------------------------------------------------------------ block classes

const PLANTS = new Set([
  'short_grass', 'tall_grass', 'fern', 'large_fern', 'dead_bush', 'dandelion', 'poppy', 'blue_orchid', 'allium',
  'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower',
  'lily_of_the_valley', 'wither_rose', 'torchflower', 'pitcher_plant', 'sunflower', 'lilac', 'rose_bush', 'peony',
  'sweet_berry_bush', 'sugar_cane', 'vine', 'snow', 'pink_petals', 'glow_lichen', 'bamboo', 'cactus', 'lily_pad',
  'brown_mushroom', 'red_mushroom', 'hanging_roots', 'azalea', 'flowering_azalea', 'seagrass', 'tall_seagrass',
  'kelp', 'kelp_plant', 'spore_blossom', 'cave_vines', 'cave_vines_plant', 'big_dripleaf', 'big_dripleaf_stem',
  'small_dripleaf', 'sea_pickle', 'wheat', 'carrots', 'potatoes', 'beetroots', 'melon_stem', 'pumpkin_stem',
])
const DECOR_SUFFIX = /_(leaves|log|wood|stem|hyphae|sapling|carpet)$/

// Vegetation and loose cover that should not count as ground (trees, plants, snow layers, carpets).
export function isDecor(name) {
  const id = String(name).replace(/^minecraft:/, '')
  return PLANTS.has(id) || DECOR_SUFFIX.test(id)
}

const NATURAL = new Set([
  'grass_block', 'dirt', 'coarse_dirt', 'rooted_dirt', 'podzol', 'mycelium', 'stone', 'andesite', 'diorite',
  'granite', 'tuff', 'deepslate', 'calcite', 'gravel', 'sand', 'red_sand', 'sandstone', 'red_sandstone', 'clay',
  'mud', 'moss_block', 'snow_block', 'powder_snow', 'dirt_path', 'farmland', 'water', 'ice', 'packed_ice',
  'blue_ice', 'bedrock', 'dripstone_block', 'terracotta', 'lava', 'magma_block', 'obsidian',
])

// Natural terrain (used to tell ground from buildings in the skyline report).
export function isNaturalGround(name) {
  const id = String(name).replace(/^minecraft:/, '')
  return NATURAL.has(id) || /_terracotta$/.test(id) && !/glazed/.test(id)
}

// ------------------------------------------------------------------ small geometry

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const lerp = (a, b, t) => a + (b - a) * t
const median = list => {
  if (list.length === 0) return 0
  const s = [...list].sort((p, q) => p - q)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Point-in-polygon (even-odd) for [[x, z], ...].
export function pointInPolygon(x, z, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

function segDistance(px, pz, ax, az, bx, bz) {
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz
  const t = len2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1) : 0
  const cx = ax + dx * t
  const cz = az + dz * t
  return { d: Math.hypot(px - cx, pz - cz), t }
}

// Irregular closed ring (town walls, plazas): n vertices around (cx, cz), radius r
// (number or [rx, rz]), radial noise `jitter` (share of r). Returns [[x, z], ...].
export function ringPolygon(center, radius, { n = 9, jitter = 0.12, rotation = 0, seed = 0 } = {}) {
  const [cx, cz] = center
  const [rx, rz] = Array.isArray(radius) ? radius : [radius, radius]
  const rng = createRng(seed * 31 + 7)
  const pts = []
  for (let i = 0; i < n; i += 1) {
    const a = rotation + (i / n) * Math.PI * 2 + (rng() - 0.5) * (Math.PI / n) * 0.6
    const k = 1 + (rng() - 0.5) * 2 * jitter
    pts.push([Math.round(cx + Math.cos(a) * rx * k), Math.round(cz + Math.sin(a) * rz * k)])
  }
  return pts
}

// Douglas–Peucker simplification of [[x, z], ...].
export function simplifyPolyline(points, epsilon = 1.2) {
  if (points.length < 3) return points.slice()
  let best = -1
  let index = 0
  const [ax, az] = points[0]
  const [bx, bz] = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i += 1) {
    const { d } = segDistance(points[i][0], points[i][1], ax, az, bx, bz)
    if (d > best) {
      best = d
      index = i
    }
  }
  if (best <= epsilon) return [points[0], points[points.length - 1]]
  const left = simplifyPolyline(points.slice(0, index + 1), epsilon)
  const right = simplifyPolyline(points.slice(index), epsilon)
  return [...left.slice(0, -1), ...right]
}

// Chaikin corner cutting (endpoints kept). iterations 2 gives soft, natural curves.
export function chaikin(points, iterations = 2) {
  let pts = points.map(p => [p[0], p[1]])
  for (let k = 0; k < iterations; k += 1) {
    if (pts.length < 3) return pts
    const out = [pts[0]]
    for (let i = 0; i < pts.length - 1; i += 1) {
      const [x0, z0] = pts[i]
      const [x1, z1] = pts[i + 1]
      out.push([0.75 * x0 + 0.25 * x1, 0.75 * z0 + 0.25 * z1], [0.25 * x0 + 0.75 * x1, 0.25 * z0 + 0.75 * z1])
    }
    out.push(pts[pts.length - 1])
    pts = out
  }
  return pts
}

// Resample a polyline at a fixed arc-length step. Returns [[x, z], ...].
export function resamplePolyline(points, step = 1) {
  if (points.length < 2) return points.map(p => [p[0], p[1]])
  const out = [[points[0][0], points[0][1]]]
  let carry = 0
  for (let i = 1; i < points.length; i += 1) {
    const [x0, z0] = points[i - 1]
    const [x1, z1] = points[i]
    const len = Math.hypot(x1 - x0, z1 - z0)
    let t = step - carry
    while (t <= len) {
      out.push([x0 + ((x1 - x0) * t) / len, z0 + ((z1 - z0) * t) / len])
      t += step
    }
    carry = len - (t - step)
  }
  const last = points[points.length - 1]
  const tail = out[out.length - 1]
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.35) out.push([last[0], last[1]])
  return out
}

// Longitudinal road grading: limits the rise per block to `maxRise` with the least cut/fill
// (average of a forward and a backward Lipschitz pass), then snaps to half blocks.
// `minimum[i]` (optional) is a floor that must be respected (bridge decks over water).
export function gradeProfile(heights, { maxRise = 1 / 3, step = 1, window = 2, minimum } = {}) {
  const n = heights.length
  if (n === 0) return []
  const base = heights.map((h, i) => {
    let sum = 0
    let cnt = 0
    for (let k = -window; k <= window; k += 1) {
      const j = i + k
      if (j < 0 || j >= n || !Number.isFinite(heights[j])) continue
      sum += heights[j]
      cnt += 1
    }
    const v = cnt ? sum / cnt : heights[i]
    return minimum && Number.isFinite(minimum[i]) ? Math.max(v, minimum[i]) : v
  })
  const g = maxRise * step
  const fwd = base.slice()
  for (let i = 1; i < n; i += 1) fwd[i] = clamp(fwd[i], fwd[i - 1] - g, fwd[i - 1] + g)
  const bwd = base.slice()
  for (let i = n - 2; i >= 0; i -= 1) bwd[i] = clamp(bwd[i], bwd[i + 1] - g, bwd[i + 1] + g)
  return base.map((_, i) => {
    let v = (fwd[i] + bwd[i]) / 2
    if (minimum && Number.isFinite(minimum[i])) v = Math.max(v, minimum[i])
    return Math.round(v * 2) / 2
  })
}

// ------------------------------------------------------------------ heightmap

// Snapshot of the current surface: (x, z) → y of the highest "ground" block (−1 if none).
// Default ground = anything that is not vegetation/loose cover (see isDecor); pass `test`
// (id, wildcard, list or predicate, as in b.set's `only`) to choose your own.
// The function also exposes isWater(x, z), size [W, D] and the raw grid.
export function heightmapOf(b, test) {
  const [W, , D] = b.size
  const ys = new Int16Array(W * D).fill(-1)
  const water = new Uint8Array(W * D)
  const isGround = test === undefined ? block => !isDecor(block.name) : block => b.matches(block, test)
  for (const [x, y, z, block] of b.entries()) {
    const i = x + z * W
    if (y <= ys[i] || !isGround(block)) continue
    ys[i] = y
    water[i] = block.name === 'minecraft:water' ? 1 : 0
  }
  const idx = (x, z) => clamp(Math.round(x), 0, W - 1) + clamp(Math.round(z), 0, D - 1) * W
  const fn = (x, z) => ys[idx(x, z)]
  fn.isWater = (x, z) => water[idx(x, z)] === 1
  fn.size = [W, D]
  fn.grid = ys
  return fn
}

// ------------------------------------------------------------------ roads

class MinHeap {
  constructor() {
    this.keys = []
    this.vals = []
  }
  get size() {
    return this.keys.length
  }
  push(key, val) {
    const k = this.keys
    const v = this.vals
    let i = k.length
    k.push(key)
    v.push(val)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (k[p] <= key) break
      k[i] = k[p]
      v[i] = v[p]
      i = p
    }
    k[i] = key
    v[i] = val
  }
  pop() {
    const k = this.keys
    const v = this.vals
    const top = v[0]
    const lastK = k.pop()
    const lastV = v.pop()
    if (k.length > 0) {
      let i = 0
      const n = k.length
      for (;;) {
        const l = 2 * i + 1
        if (l >= n) break
        const r = l + 1
        const c = r < n && k[r] < k[l] ? r : l
        if (k[c] >= lastK) break
        k[i] = k[c]
        v[i] = v[c]
        i = c
      }
      k[i] = lastK
      v[i] = lastV
    }
    return top
  }
}

const MOVES = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]

// Terrain-aware A* between two [x, z] cells over a heightmap (from heightmapOf or any
// (x, z) => y). Costs follow composition.md §3.3: height steps are expensive, >maxStep is a
// wall, water becomes a bridge (bounded width), existing roads are cheap (trunks merge),
// turning and cross-slope are penalised (smooth, contour-following roads).
// Returns a dense polyline [[x, y, z], ...] (1-block spacing, y graded to ≤ maxRise per block
// in half-block steps = the top block of the road surface; x.5 = bottom slab on top) with
// extra fields: .water (bool per point), .raw (A* cells), .cost, .length.
export function routeRoad(heightFn, from, to, opts = {}) {
  const [W, D] = heightFn.size ?? opts.size ?? [256, 256]
  const {
    bounds = [0, 0, W - 1, D - 1],
    avoid,
    isWater = heightFn.isWater ?? (() => false),
    roads,
    slope1 = 2.5,
    stair = 10,
    maxStep = 3,
    bridge = 6,
    maxBridge = 24,
    reuse = 0.35,
    turn = 0.6,
    lateral = 0.4,
    bank = 0.8,
    maxRise = 1 / 3,
    clearance = 2,
    simplify = 1.2,
    smooth = 2,
    heuristic = 1,
  } = opts
  const [bx0, bz0, bx1, bz1] = bounds
  const bw = bx1 - bx0 + 1
  const bd = bz1 - bz0 + 1
  const N = bw * bd
  const cell = (x, z) => (x - bx0) + (z - bz0) * bw
  const inB = (x, z) => x >= bx0 && x <= bx1 && z >= bz0 && z <= bz1
  const H = new Float32Array(N)
  const wet = new Uint8Array(N)
  const blocked = new Uint8Array(N)
  const onRoad = new Uint8Array(N)
  for (let z = bz0; z <= bz1; z += 1) {
    for (let x = bx0; x <= bx1; x += 1) {
      const i = cell(x, z)
      H[i] = heightFn(x, z)
      wet[i] = isWater(x, z) ? 1 : 0
      if (avoid && avoid(x, z)) blocked[i] = 1
      if (roads && (typeof roads === 'function' ? roads(x, z) : roads.has(`${x},${z}`))) onRoad[i] = 1
    }
  }
  // Water wider than maxBridge is impassable: distance from each water cell to land.
  const distLand = new Float32Array(N).fill(Infinity)
  const queue = []
  for (let i = 0; i < N; i += 1) if (!wet[i]) {
    distLand[i] = 0
    queue.push(i)
  }
  for (let q = 0; q < queue.length; q += 1) {
    const i = queue[q]
    const x = (i % bw) + bx0
    const z = Math.floor(i / bw) + bz0
    for (const [dx, dz] of MOVES) {
      const nx = x + dx
      const nz = z + dz
      if (!inB(nx, nz)) continue
      const j = cell(nx, nz)
      if (distLand[j] <= distLand[i] + 1) continue
      distLand[j] = distLand[i] + 1
      queue.push(j)
    }
  }
  for (let i = 0; i < N; i += 1) if (wet[i] && distLand[i] > maxBridge / 2) blocked[i] = 1

  const [sx, sz] = [clamp(Math.round(from[0]), bx0, bx1), clamp(Math.round(from[1]), bz0, bz1)]
  const [tx, tz] = [clamp(Math.round(to[0]), bx0, bx1), clamp(Math.round(to[1]), bz0, bz1)]
  blocked[cell(sx, sz)] = 0
  blocked[cell(tx, tz)] = 0
  const goal = cell(tx, tz)
  const octile = (x, z) => {
    const dx = Math.abs(x - tx)
    const dz = Math.abs(z - tz)
    return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)) * heuristic
  }
  const S = N * 9
  const gScore = new Float64Array(S).fill(Infinity)
  const parent = new Int32Array(S).fill(-1)
  const closed = new Uint8Array(S)
  const start = cell(sx, sz) * 9 + 8
  gScore[start] = 0
  const open = new MinHeap()
  open.push(octile(sx, sz), start)
  let found = -1
  while (open.size > 0) {
    const s = open.pop()
    if (closed[s]) continue
    closed[s] = 1
    const ci = Math.floor(s / 9)
    const dir = s % 9
    if (ci === goal) {
      found = s
      break
    }
    const x = (ci % bw) + bx0
    const z = Math.floor(ci / bw) + bz0
    for (let m = 0; m < 8; m += 1) {
      const [dx, dz] = MOVES[m]
      const nx = x + dx
      const nz = z + dz
      if (!inB(nx, nz)) continue
      const ni = cell(nx, nz)
      if (blocked[ni]) continue
      if (dx !== 0 && dz !== 0 && (blocked[cell(x + dx, z)] || blocked[cell(x, z + dz)])) continue
      let c = dx !== 0 && dz !== 0 ? 1.414 : 1
      const anyWet = wet[ni] || wet[ci]
      const dh = Math.abs(H[ni] - H[ci])
      if (!anyWet) {
        if (dh > maxStep) continue
        if (dh >= 1 && dh < 2) c += slope1
        else if (dh >= 2) c += stair * (dh - 1)
      }
      if (wet[ni]) c *= bridge
      if (onRoad[ni]) c *= reuse
      if (dir !== 8) {
        const t = Math.abs(dir - m)
        c += turn * Math.min(t, 8 - t)
      }
      const px = -dz
      const pz = dx
      if (inB(nx + px, nz + pz) && inB(nx - px, nz - pz)) c += lateral * Math.abs(H[cell(nx + px, nz + pz)] - H[cell(nx - px, nz - pz)]) / 2
      if (!wet[ni] && distWaterNear(nx, nz)) c += bank
      const ns = ni * 9 + m
      const g = gScore[s] + c
      if (g < gScore[ns]) {
        gScore[ns] = g
        parent[ns] = s
        open.push(g + octile(nx, nz), ns)
      }
    }
  }
  function distWaterNear(x, z) {
    for (let dz = -2; dz <= 2; dz += 1)
      for (let dx = -2; dx <= 2; dx += 1) {
        const nx = x + dx
        const nz = z + dz
        if (inB(nx, nz) && wet[cell(nx, nz)]) return true
      }
    return false
  }
  if (found < 0) throw new Error(`routeRoad: no path from ${from} to ${to} (blocked, too steep, or water wider than maxBridge)`)
  const raw = []
  for (let s = found; s >= 0; s = parent[s]) {
    const ci = Math.floor(s / 9)
    raw.push([(ci % bw) + bx0, Math.floor(ci / bw) + bz0])
  }
  raw.reverse()
  const line = resamplePolyline(chaikin(simplifyPolyline(raw, simplify), smooth), 1)
  const water = line.map(([x, z]) => isWater(Math.round(x), Math.round(z)))
  const ground = line.map(([x, z], i) => (water[i] ? NaN : heightFn(Math.round(x), Math.round(z))))
  // Bridge decks: interpolate between the banks, at least `clearance` above the water block.
  const minimum = line.map(() => NaN)
  for (let i = 0; i < line.length; i += 1) {
    if (!water[i]) continue
    let a = i
    while (a > 0 && water[a - 1]) a -= 1
    let e = i
    while (e < line.length - 1 && water[e + 1]) e += 1
    const left = a > 0 ? ground[a - 1] : NaN
    const right = e < line.length - 1 ? ground[e + 1] : NaN
    const surface = heightFn(Math.round(line[i][0]), Math.round(line[i][1]))
    const banks = [left, right].filter(Number.isFinite)
    const span = banks.length === 2 ? lerp(left, right, (i - a + 1) / (e - a + 2)) : banks[0] ?? surface + clearance
    ground[i] = Math.max(span, surface + clearance)
    minimum[i] = surface + clearance
  }
  const ys = gradeProfile(ground, { maxRise, minimum })
  const path = line.map(([x, z], i) => [x, ys[i], z])
  path.water = water
  path.raw = raw
  path.cost = gScore[found]
  path.length = line.length
  return path
}

// Picks the slab id that matches a road block (cobblestone → cobblestone_slab); null if none.
const SLAB_FALLBACK = {
  'minecraft:dirt_path': null,
  'minecraft:grass_block': null,
  'minecraft:coarse_dirt': null,
  'minecraft:gravel': null,
  'minecraft:packed_mud': 'minecraft:mud_brick_slab',
  'minecraft:polished_andesite': 'minecraft:polished_andesite_slab',
  'minecraft:andesite': 'minecraft:andesite_slab',
  'minecraft:stone': 'minecraft:stone_slab',
  'minecraft:smooth_stone': 'minecraft:smooth_stone_slab',
}
function slabFor(name) {
  if (name in SLAB_FALLBACK) return SLAB_FALLBACK[name]
  try {
    return material(name).slab ?? null
  } catch {
    return null
  }
}

// Paints a routed road into the terrain: fills embankments and cuts banks to the graded
// profile, puts a bottom slab on half steps (slabSteps), clears plants/snow above, blends a
// shoulder into the surrounding ground and turns water crossings into a plank bridge.
//   plan.paintRoad(b, road, { width: 3, paint, edge, slab: 'cobblestone_slab', bridge: { deck: 'spruce_planks' } })
// Options: width (3), paint, edge (outer ring paint, width ≥ 3), slab (force a slab id),
// slabSteps (true), fill ('dirt'), clearAbove (4), cutLimit (6), shoulder (1),
// avoid(x, z) (skip cells, e.g. buildings), bridge { deck, rail, post, postEvery }.
// Returns { cells, bridgeCells, slabs }.
export function paintRoad(b, path, opts = {}) {
  const {
    width = 3,
    paint = 'minecraft:dirt_path',
    edge,
    slab,
    slabSteps = true,
    fill = 'minecraft:dirt',
    clearAbove = 4,
    cutLimit = 6,
    shoulder = 1,
    avoid,
    bridge = {},
  } = opts
  const deck = bridge.deck ?? 'minecraft:spruce_planks'
  const rail = bridge.rail === undefined ? 'minecraft:spruce_fence' : bridge.rail
  const post = bridge.post ?? 'minecraft:spruce_log'
  const postEvery = bridge.postEvery ?? 4
  const pts = Array.isArray(path) ? path : path.path
  const wetFlags = path.water ?? pts.map(() => false)
  const ground = heightmapOf(b)
  const half = width / 2
  const reach = half + shoulder + 1
  // Bucket segments for nearest-segment queries.
  const B = 4
  const buckets = new Map()
  for (let i = 0; i < pts.length - 1; i += 1) {
    const key = `${Math.floor(pts[i][0] / B)},${Math.floor(pts[i][2] / B)}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(i)
  }
  const nearest = (x, z) => {
    const bx = Math.floor(x / B)
    const bz = Math.floor(z / B)
    const span = Math.ceil(reach / B) + 1
    let best = { d: Infinity, y: 0, i: 0, t: 0 }
    for (let dz = -span; dz <= span; dz += 1)
      for (let dx = -span; dx <= span; dx += 1) {
        const list = buckets.get(`${bx + dx},${bz + dz}`)
        if (!list) continue
        for (const i of list) {
          const a = pts[i]
          const c = pts[i + 1]
          const { d, t } = segDistance(x, z, a[0], a[2], c[0], c[2])
          if (d < best.d) best = { d, y: lerp(a[1], c[1], t), i, t }
        }
      }
    if (pts.length === 1) {
      const d = Math.hypot(x - pts[0][0], z - pts[0][2])
      best = { d, y: pts[0][1], i: 0, t: 0 }
    }
    return best
  }
  let x0 = Infinity
  let z0 = Infinity
  let x1 = -Infinity
  let z1 = -Infinity
  for (const [x, , z] of pts) {
    x0 = Math.min(x0, x)
    z0 = Math.min(z0, z)
    x1 = Math.max(x1, x)
    z1 = Math.max(z1, z)
  }
  const report = { cells: 0, bridgeCells: 0, slabs: 0 }
  const removable = (x, y, z) => {
    const blk = b.get(x, y, z)
    return blk && (isDecor(blk.name) || isNaturalGround(blk.name))
  }
  const shoulderCells = []
  for (let z = Math.floor(z0 - reach); z <= Math.ceil(z1 + reach); z += 1) {
    for (let x = Math.floor(x0 - reach); x <= Math.ceil(x1 + reach); x += 1) {
      if (!b.inBounds(x, 0, z)) continue
      const n = nearest(x, z)
      if (n.d > half + shoulder) continue
      if (avoid && avoid(x, z)) continue
      const target = Math.round(n.y * 2) / 2
      if (n.d > half) {
        shoulderCells.push([x, z, target])
        continue
      }
      const hb = Math.floor(target)
      const isHalf = slabSteps && target - hb >= 0.5
      const g = ground(x, z)
      const onWater = ground.isWater(x, z) || (wetFlags[n.i] && g <= hb)
      const isEdge = edge !== undefined && width >= 3 && n.d > half - 1
      report.cells += 1
      if (onWater) {
        report.bridgeCells += 1
        b.set(x, hb, z, deck)
        for (let y = hb + 1; y <= hb + clearAbove; y += 1) if (removable(x, y, z)) b.remove(x, y, z)
        const railCell = n.d > half - 1
        if (railCell && rail) b.set(x, hb + 1, z, rail)
        if (railCell && n.i % postEvery === 0) for (let y = hb - 1; y >= Math.max(0, g - 3); y -= 1) b.set(x, y, z, post)
        continue
      }
      for (let y = g + 1; y < hb; y += 1) b.set(x, y, z, fill)
      for (let y = hb + 1; y <= Math.min(g, hb + cutLimit); y += 1) if (removable(x, y, z)) b.remove(x, y, z)
      b.set(x, hb, z, isEdge ? edge : paint)
      for (let y = hb + 1; y <= hb + clearAbove; y += 1) {
        const blk = b.get(x, y, z)
        if (blk && isDecor(blk.name)) b.remove(x, y, z)
      }
      if (isHalf) {
        const top = b.get(x, hb, z)
        const id = slab ? parseBlock(slab).name : top ? slabFor(top.name) : null
        if (id && !b.get(x, hb + 1, z)) {
          b.set(x, hb + 1, z, `${id}[type=bottom]`)
          report.slabs += 1
        }
      }
    }
  }
  // Shoulders: pull the ground within 1 block of the road level (cut banks, fill dips).
  for (const [x, z, target] of shoulderCells) {
    const hb = Math.floor(target)
    const g = ground(x, z)
    if (g < 0 || ground.isWater(x, z)) continue
    const surface = b.get(x, g, z)
    if (!surface || !isNaturalGround(surface.name)) continue
    if (g > hb + 1) {
      for (let y = hb + 2; y <= Math.min(g, hb + cutLimit); y += 1) if (removable(x, y, z)) b.remove(x, y, z)
      b.set(x, hb + 1, z, surface)
    } else if (g < hb - 1) {
      for (let y = g; y < hb - 1; y += 1) b.set(x, y, z, fill)
      b.set(x, hb - 1, z, surface)
    }
  }
  return report
}

// ------------------------------------------------------------------ lots

const spec = (value, ctx, fallback) => {
  if (value === undefined) return fallback
  if (typeof value === 'function') return value(ctx)
  if (Array.isArray(value)) return Math.round(lerp(value[0], value[1], ctx.rng()))
  return value
}

// Building lots along a road polyline (from routeRoad or [[x, z], ...] / [[x, y, z], ...]).
// Each lot is an axis-aligned rectangle whose front wall faces the road:
//   { x0, z0, x1, z1, facing, door: [x, z], front: [x, z], y, cutFill, width, depth, density, side }
// `facing` is the front wall's outward direction (pass it to b.door / b.window);
// `door` is the centre cell of the front wall, `front` the cell in front of it.
// Options: roadWidth (3), side 'both' | 'left' | 'right', frontage [6, 10], depth [7, 11],
// setback [0, 2], gap [1, 3] (each a number, [min, max] or ({ density, rng, x, z }) => n),
// density (x, z) => 0..1, heightFn + maxCutFill (3), avoid(x, z), inside(x, z),
// occupied (Set of 'x,z' taken by lots/buildings, shared between calls and updated),
// roads (Set of 'x,z' road cells of other roads: forbidden for lots, allowed next to them),
// margin (1 = keep a 1-block gap to other lots), startAt / endAt (arc length), seed,
// stats (object that collects rejection counts: occupied, road, avoid, outside, water, slope),
// maxPush (3: extra setback tried when a cardinal rect clips a curving road),
// size ([W, D] canvas; defaults to heightFn.size from heightmapOf) + edgeMargin (2: room for the
// roof overhang and eave trim) so no lot spills off the canvas.
export function lotsAlongRoad(path, opts = {}) {
  const {
    roadWidth = 3,
    side = 'both',
    frontage = [6, 10],
    depth = [7, 11],
    setback = [0, 2],
    gap = [1, 3],
    density,
    heightFn,
    maxCutFill = 3,
    avoid,
    inside,
    occupied = new Set(),
    roads = new Set(),
    margin = 1,
    startAt = 2,
    endAt = 2,
    seed = 1,
    stats,
    maxPush = 3,
    size = opts.heightFn?.size,
    edgeMargin = 2,
  } = opts
  const offCanvas = (x, z) => size !== undefined && (x < edgeMargin || z < edgeMargin || x > size[0] - 1 - edgeMargin || z > size[1] - 1 - edgeMargin)
  const reject = reason => {
    if (stats) stats[reason] = (stats[reason] ?? 0) + 1
  }
  const pts = path.map(p => (p.length >= 3 ? [p[0], p[2]] : [p[0], p[1]]))
  const line = resamplePolyline(pts, 1)
  const roadCells = new Set(roads)
  const rr = roadWidth / 2 + 0.2
  for (const [x, z] of line) {
    for (let dz = -Math.ceil(rr); dz <= Math.ceil(rr); dz += 1)
      for (let dx = -Math.ceil(rr); dx <= Math.ceil(rr); dx += 1) {
        const cx = Math.round(x + dx)
        const cz = Math.round(z + dz)
        if (Math.hypot(cx - x, cz - z) <= rr) roadCells.add(`${cx},${cz}`)
      }
  }
  const rng = createRng(seed * 977 + 13)
  const sides = side === 'both' ? [1, -1] : side === 'left' ? [1] : [-1]
  const lots = []
  for (const sgn of sides) {
    let s = startAt
    while (s < line.length - 1 - endAt) {
      const i = Math.round(s)
      const p = line[i]
      const a = line[Math.max(0, i - 2)]
      const c = line[Math.min(line.length - 1, i + 2)]
      let tx = c[0] - a[0]
      let tz = c[1] - a[1]
      const tl = Math.hypot(tx, tz) || 1
      tx /= tl
      tz /= tl
      // Normal pointing from the road toward the lot.
      const nx = -tz * sgn
      const nz = tx * sgn
      const d = density ? clamp(density(p[0], p[1]), 0, 1) : 0.5
      const ctx = { density: d, rng, x: p[0], z: p[1], s }
      const w = Math.max(3, spec(frontage, ctx, 8))
      const dep = Math.max(3, spec(depth, ctx, 9))
      const back = Math.max(0, spec(setback, ctx, 1))
      const gp = Math.max(0, spec(gap, ctx, 2))
      const facing = facingFrom(-nx, -nz)
      const m = gp === 0 ? 0 : margin
      // Try the rect; if it only clips the road (curved road vs. cardinal rect), push it back.
      const attempt = push => {
        const off = roadWidth / 2 + back + push + 0.7
        const fx = p[0] + nx * off
        const fz = p[1] + nz * off
        let x0
        let x1
        let z0
        let z1
        if (facing === 'south' || facing === 'north') {
          x0 = Math.round(fx - (w - 1) / 2)
          x1 = x0 + w - 1
          z1 = facing === 'south' ? Math.round(fz) : Math.round(fz) + dep - 1
          z0 = z1 - dep + 1
        } else {
          z0 = Math.round(fz - (w - 1) / 2)
          z1 = z0 + w - 1
          x1 = facing === 'east' ? Math.round(fx) : Math.round(fx) + dep - 1
          x0 = x1 - dep + 1
        }
        const hs = []
        for (let z = z0 - m; z <= z1 + m; z += 1) {
          for (let x = x0 - m; x <= x1 + m; x += 1) {
            const core = x >= x0 && x <= x1 && z >= z0 && z <= z1
            const key = `${x},${z}`
            if (occupied.has(key)) return { reason: 'occupied' }
            if (!core) continue
            if (roadCells.has(key)) return { reason: 'road' }
            if (avoid && avoid(x, z)) return { reason: 'avoid' }
            if (inside && !inside(x, z)) return { reason: 'outside' }
            if (offCanvas(x, z)) return { reason: 'outside' }
            if (heightFn) {
              if (heightFn.isWater && heightFn.isWater(x, z)) return { reason: 'water' }
              hs.push(heightFn(x, z))
            }
          }
        }
        let y
        let cutFill = 0
        if (heightFn && hs.length) {
          y = Math.round(median(hs))
          cutFill = Math.max(Math.max(...hs) - y, y - Math.min(...hs))
          if (cutFill > maxCutFill) return { reason: 'slope' }
        }
        return { x0, x1, z0, z1, y, cutFill, push }
      }
      let res = attempt(0)
      for (let push = 1; push <= maxPush && res.reason === 'road'; push += 1) res = attempt(push)
      if (res.reason) {
        reject(res.reason)
        s += 1
        continue
      }
      const { x0, x1, z0, z1, y, cutFill } = res
      for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) occupied.add(`${x},${z}`)
      const v = DIR[facing]
      const doorX = facing === 'east' ? x1 : facing === 'west' ? x0 : Math.round((x0 + x1) / 2)
      const doorZ = facing === 'south' ? z1 : facing === 'north' ? z0 : Math.round((z0 + z1) / 2)
      lots.push({
        x0, z0, x1, z1, facing,
        door: [doorX, doorZ],
        front: [doorX + v[0], doorZ + v[2]],
        y, cutFill, width: w, depth: dep, density: d, side: sgn > 0 ? 'left' : 'right', s,
      })
      s += w + gp
    }
  }
  return lots
}

// ------------------------------------------------------------------ curtain walls

// Wall band + towers + gates along a closed polygon [[x, z], ...] (clockwise or not).
// The wall follows the ground (top = ground + height, smoothed along the circuit), towers
// project outward at corners (> turnAngle°) and every `towerEvery` blocks, gates cut through
// with flanking towers. Crenellations: merlon-wide solids with crenel-wide gaps on the outer
// edge, one sill block below them (§4.3 of composition.md).
//   plan.curtainWall(b, poly, { height: 9, thickness: 3, towerEvery: 22, towerRadius: 3.5,
//     towerHeight: 5, paint, battlements: true, walkway: 'polished_andesite',
//     gate: { at: [x, z], width: 3, height: 4 }, towerRoof: 'mixed' })
// Returns { towers: [{ x, z, r, top, kind }], gates: [{ x, z, y, s }], topAt(s), inside(x, z) }.
export function curtainWall(b, polygon, opts = {}) {
  const {
    height = 9,
    thickness = 3,
    paint = 'minecraft:stone_bricks',
    walkway,
    battlements = true,
    merlon = 2,
    crenel = 1,
    towerEvery = 22,
    towerRadius = 3.5,
    towerHeight = 5,
    towerShape = 'round',
    towerPaint,
    towerRoof = 'mixed',
    roofMaterial = 'deepslate_tile',
    turnAngle = 25,
    corbels = true,
    slits = 5,
    foundation = 2,
    smooth = 4,
    heightFn,
  } = opts
  const gateList = [...(opts.gate ? [opts.gate] : []), ...(opts.gates ?? [])]
  const tPaint = towerPaint ?? paint
  const poly = polygon.map(p => [p[0], p[1]])
  const n = poly.length
  if (n < 3) throw new Error('curtainWall needs a polygon with ≥ 3 points')
  const ground = heightFn ?? heightmapOf(b)
  // Perimeter parametrisation.
  const segs = []
  let perim = 0
  for (let i = 0; i < n; i += 1) {
    const a = poly[i]
    const c = poly[(i + 1) % n]
    const len = Math.hypot(c[0] - a[0], c[1] - a[1])
    segs.push({ a, c, s0: perim, len })
    perim += len
  }
  const pointAt = s => {
    s = ((s % perim) + perim) % perim
    for (const seg of segs) {
      if (s <= seg.s0 + seg.len) {
        const t = seg.len > 0 ? (s - seg.s0) / seg.len : 0
        return [lerp(seg.a[0], seg.c[0], t), lerp(seg.a[1], seg.c[1], t)]
      }
    }
    return poly[0]
  }
  const project = (x, z) => {
    let best = { d: Infinity, s: 0 }
    for (const seg of segs) {
      const { d, t } = segDistance(x, z, seg.a[0], seg.a[1], seg.c[0], seg.c[1])
      if (d < best.d) best = { d, s: seg.s0 + t * seg.len }
    }
    return best
  }
  const inside = (x, z) => pointInPolygon(x, z, poly)
  const outward = s => {
    const p = pointAt(s)
    const q = pointAt(s + 0.5)
    const r = pointAt(s - 0.5)
    let nx = -(q[1] - r[1])
    let nz = q[0] - r[0]
    const l = Math.hypot(nx, nz) || 1
    nx /= l
    nz /= l
    if (inside(p[0] + nx * 1.5, p[1] + nz * 1.5)) {
      nx = -nx
      nz = -nz
    }
    return [nx, nz]
  }
  // Smoothed wall-top profile, sampled every block around the circuit.
  const M = Math.max(4, Math.ceil(perim))
  const raw = []
  for (let k = 0; k < M; k += 1) {
    const [x, z] = pointAt((k / M) * perim)
    raw.push(ground(x, z) + height)
  }
  const topSamples = raw.map((_, k) => {
    let sum = 0
    for (let j = -smooth; j <= smooth; j += 1) sum += raw[(k + j + M) % M]
    return Math.round(sum / (2 * smooth + 1))
  })
  const topAt = s => topSamples[Math.floor(((((s % perim) + perim) % perim) / perim) * M) % M]
  const circDist = (s, t) => {
    const d = Math.abs(s - t) % perim
    return Math.min(d, perim - d)
  }
  // Gates.
  const gates = gateList.map(g => {
    const pr = project(g.at[0], g.at[1])
    const [gx, gz] = pointAt(pr.s)
    const w = g.width ?? 3
    let gy = Infinity
    for (let k = -Math.ceil(w / 2); k <= Math.ceil(w / 2); k += 1) {
      const [px, pz] = pointAt(pr.s + k)
      gy = Math.min(gy, ground(px, pz))
    }
    const towers = g.towers !== false
    // With flanking towers the gate becomes a gatehouse: the band between them rises to just below the tower tops.
    const roofY = towers ? topAt(pr.s) + towerHeight : topAt(pr.s)
    return { s: pr.s, x: Math.round(gx), z: Math.round(gz), y: gy, width: w, height: g.height ?? 4, towers, floor: g.floor, top: roofY }
  })
  const gateAt = s => gates.find(g => circDist(s, g.s) <= g.width / 2 + 0.25)
  // Wall band.
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const [x, z] of poly) {
    minX = Math.min(minX, x)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxZ = Math.max(maxZ, z)
  }
  const halfT = thickness / 2
  const period = merlon + crenel
  for (let z = Math.floor(minZ - halfT - 1); z <= Math.ceil(maxZ + halfT + 1); z += 1) {
    for (let x = Math.floor(minX - halfT - 1); x <= Math.ceil(maxX + halfT + 1); x += 1) {
      const pr = project(x, z)
      if (pr.d > halfT) continue
      const gate = gateAt(pr.s)
      const top = gate ? Math.max(topAt(pr.s), gate.top) : topAt(pr.s)
      const g = ground(x, z)
      const outer = !inside(x, z) && pr.d > halfT - 1
      if (gate) {
        for (let y = gate.y + 1; y <= gate.y + gate.height; y += 1) b.remove(x, y, z)
        if (gate.floor) b.set(x, gate.y, z, gate.floor)
        for (let y = gate.y + gate.height + 1; y <= top; y += 1) b.set(x, y, z, paint)
      } else {
        for (let y = g - foundation; y <= top; y += 1) b.set(x, y, z, paint)
        if (slits && outer && Math.floor(pr.s) % slits === 0 && top - g >= 6) {
          b.remove(x, top - 3, z)
          b.remove(x, top - 4, z)
        }
      }
      if (walkway && !outer) b.set(x, top, z, walkway)
      if (outer) {
        b.set(x, top + 1, z, paint)
        if (battlements && Math.floor(pr.s) % period < merlon) b.set(x, top + 2, z, paint)
      }
    }
  }
  // Tower positions: corners, regular spacing, gate flankers.
  const anchors = []
  for (let i = 0; i < n; i += 1) {
    const prev = poly[(i - 1 + n) % n]
    const cur = poly[i]
    const next = poly[(i + 1) % n]
    const a1 = Math.atan2(cur[1] - prev[1], cur[0] - prev[0])
    const a2 = Math.atan2(next[1] - cur[1], next[0] - cur[0])
    let turn = Math.abs(a2 - a1) * (180 / Math.PI)
    if (turn > 180) turn = 360 - turn
    if (turn >= turnAngle) anchors.push({ s: segs[i].s0, kind: 'corner' })
  }
  for (const g of gates) {
    if (!g.towers) continue
    const off = g.width / 2 + towerRadius + 0.5
    anchors.push({ s: g.s - off, kind: 'gate' }, { s: g.s + off, kind: 'gate' })
  }
  anchors.sort((p, q) => (((p.s % perim) + perim) % perim) - (((q.s % perim) + perim) % perim))
  const filled = []
  const base = anchors.length ? anchors : [{ s: 0, kind: 'corner' }]
  for (let i = 0; i < base.length; i += 1) {
    const cur = base[i]
    const next = base[(i + 1) % base.length]
    filled.push(cur)
    let gap = (((next.s - cur.s) % perim) + perim) % perim
    if (base.length === 1) gap = perim
    const k = Math.ceil(gap / towerEvery) - 1
    for (let j = 1; j <= k; j += 1) filled.push({ s: cur.s + (gap * j) / (k + 1), kind: 'wall' })
  }
  const clearGate = (s, kind) => kind !== 'gate' && gates.some(g => circDist(s, g.s) < g.width / 2 + towerRadius * 2 + 1)
  const towers = []
  for (const t of filled) {
    if (clearGate(t.s, t.kind)) continue
    if (towers.some(o => circDist(o.s, t.s) < towerRadius * 2 + 2 && !(t.kind === 'gate' && o.kind !== 'gate'))) continue
    for (let i = towers.length - 1; i >= 0; i -= 1) {
      if (t.kind === 'gate' && towers[i].kind !== 'gate' && circDist(towers[i].s, t.s) < towerRadius * 2 + 2) towers.splice(i, 1)
    }
    towers.push(t)
  }
  const placed = []
  towers.forEach((t, idx) => {
    const [px, pz] = pointAt(t.s)
    const [nx, nz] = outward(t.s)
    const off = Math.max(0.5, towerRadius - halfT + 0.5)
    const cx = Math.round(px + nx * off)
    const cz = Math.round(pz + nz * off)
    const r = towerRadius
    const wallTop = topAt(t.s)
    const top = wallTop + towerHeight + (t.kind === 'gate' ? 2 : 0)
    let footY = Infinity
    for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz += 1)
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx += 1) if (dx * dx + dz * dz <= r * r) footY = Math.min(footY, ground(cx + dx, cz + dz))
    const y0 = footY - foundation
    const roofKind = towerRoof === 'mixed' ? (t.kind === 'gate' || idx % 2 === 1 ? 'flat' : 'cone') : towerRoof
    // Doorways from the wall-walk into the tower (along the wall direction), carved after the shell.
    const doorways = () => {
      for (const q of [pointAt(t.s - r - 1), pointAt(t.s + r + 1)]) {
        const dx = q[0] - cx
        const dz = q[1] - cz
        const l = Math.hypot(dx, dz) || 1
        const reach = towerShape === 'square' ? Math.round(r) / Math.max(Math.abs(dx / l), Math.abs(dz / l)) : r - 0.5
        const ex = Math.round(cx + (dx / l) * reach)
        const ez = Math.round(cz + (dz / l) * reach)
        b.remove(ex, wallTop + 1, ez)
        b.remove(ex, wallTop + 2, ez)
      }
    }
    if (towerShape === 'square') {
      const h = Math.round(r)
      b.box([cx - h, y0, cz - h], [cx + h, wallTop, cz + h], tPaint)
      b.walls([cx - h, wallTop + 1, cz - h], [cx + h, top, cz + h], tPaint)
      b.box([cx - h + 1, top, cz - h + 1], [cx + h - 1, top, cz + h - 1], tPaint)
      if (roofKind === 'cone') b.roof({ x0: cx - h, z0: cz - h, x1: cx + h, z1: cz + h, y: top + 1, type: 'pyramid', material: roofMaterial, pitch: 2, overhang: 1 })
      else b.battlements([cx - h, cz - h], [cx + h, cz + h], top + 1, tPaint, { period: 2, height: 1 })
      doorways()
    } else {
      b.cylinder([cx, y0, cz], r, wallTop - y0 + 1, tPaint)
      b.tube([cx, wallTop + 1, cz], r, top - wallTop, tPaint, { thickness: 1 })
      b.disc([cx, top, cz], r, tPaint)
      doorways()
      // Slit facing outward.
      const sx = Math.round(cx + nx * (r - 0.4))
      const sz = Math.round(cz + nz * (r - 0.4))
      if (top - wallTop >= 4) {
        b.remove(sx, top - 2, sz)
        b.remove(sx, top - 3, sz)
      }
      if (roofKind === 'cone') {
        b.coneRoof([cx, top + 1, cz], r, { material: roofMaterial, pitch: 2, overhang: 1 })
      } else {
        const R = corbels ? r + 1 : r
        const ring = []
        for (let dz = -Math.ceil(R); dz <= Math.ceil(R); dz += 1)
          for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx += 1) {
            if (dx * dx + dz * dz > R * R) continue
            const edgeCell = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ux, uz]) => (dx + ux) ** 2 + (dz + uz) ** 2 > R * R)
            if (edgeCell) ring.push([cx + dx, cz + dz, Math.atan2(dz, dx)])
          }
        ring.sort((p, q) => p[2] - q[2])
        ring.forEach(([x, z], k) => {
          const isCorbelRing = corbels && (x - cx) ** 2 + (z - cz) ** 2 > r * r
          if (isCorbelRing) {
            const f = facingFrom(cx - x, cz - z)
            let stair = 'minecraft:stone_brick_stairs'
            try {
              stair = material(parseBlock(typeof tPaint === 'string' ? tPaint : 'stone_bricks').name).stairs ?? stair
            } catch {
              // keep default
            }
            b.set(x, top, z, `${stair}[facing=${f},half=top]`)
          }
          b.set(x, top + 1, z, tPaint)
          if (k % period < merlon) b.set(x, top + 2, z, tPaint)
        })
        if (corbels) b.disc([cx, top, cz], r, tPaint)
      }
    }
    placed.push({ x: cx, z: cz, r, top, kind: t.kind, roof: roofKind })
  })
  return { towers: placed, gates, topAt, inside, perimeter: perim }
}

// ------------------------------------------------------------------ plaza

// Paved, levelled square with an irregular convex outline, a border gutter, blended edges,
// an optional centre feature and corner lamps (composition.md §3.4).
//   plan.plaza(b, [48, 50], [18, 24], { feature: 'well', paint: kit.palette({ stone_bricks: 5, andesite: 2, cobblestone: 2 }) })
// size: number or [sizeX, sizeZ]. feature: 'well' | 'fountain' | 'cross' | 'tree' | null.
// Returns { poly, y, cells, feature: [x, z] | null }.
export function plaza(b, center, size, opts = {}) {
  const {
    paint = 'minecraft:stone_bricks',
    border = 'minecraft:cobblestone',
    fill = 'minecraft:dirt',
    shape = 'irregular',
    jitter = 0.12,
    feature = 'well',
    featureOffset,
    blend = 3,
    lamps = true,
    clearAbove = 8,
    seed = 0,
  } = opts
  const [cx, cz] = center.length >= 3 ? [center[0], center[2]] : center
  const [sx, sz] = Array.isArray(size) ? size : [size, size]
  const rng = createRng(seed * 131 + 5)
  const ground = opts.heightFn ?? heightmapOf(b)
  let poly
  if (shape === 'round') {
    poly = ringPolygon([cx, cz], [sx / 2, sz / 2], { n: 14, jitter: 0.04, seed })
  } else {
    const hx = (sx - 1) / 2
    const hz = (sz - 1) / 2
    const k = shape === 'rect' ? 0 : jitter * Math.min(sx, sz)
    poly = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([x, z]) => [cx + x + (rng() - 0.5) * 2 * k, cz + z + (rng() - 0.5) * 2 * k])
  }
  const ins = (x, z) => pointInPolygon(x, z, poly)
  const cells = []
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const [x, z] of poly) {
    minX = Math.min(minX, x)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxZ = Math.max(maxZ, z)
  }
  for (let z = Math.floor(minZ); z <= Math.ceil(maxZ); z += 1)
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x += 1) if (ins(x, z)) cells.push([x, z])
  const y = opts.y ?? Math.round(median(cells.map(([x, z]) => ground(x, z))))
  const cellSet = new Set(cells.map(([x, z]) => `${x},${z}`))
  const removable = (x, yy, z) => {
    const blk = b.get(x, yy, z)
    return blk && (isDecor(blk.name) || isNaturalGround(blk.name))
  }
  for (const [x, z] of cells) {
    const g = ground(x, z)
    for (let yy = y + 1; yy <= Math.max(g, y) + clearAbove; yy += 1) if (removable(x, yy, z)) b.remove(x, yy, z)
    for (let yy = g + 1; yy < y; yy += 1) b.set(x, yy, z, fill)
    const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !cellSet.has(`${x + dx},${z + dz}`))
    b.set(x, y, z, rim && border ? border : paint)
  }
  // Blend the surrounding ground toward the plaza level.
  if (blend > 0) {
    for (let z = Math.floor(minZ - blend); z <= Math.ceil(maxZ + blend); z += 1)
      for (let x = Math.floor(minX - blend); x <= Math.ceil(maxX + blend); x += 1) {
        if (cellSet.has(`${x},${z}`) || !b.inBounds(x, 0, z)) continue
        let d = Infinity
        for (let i = 0; i < poly.length; i += 1) {
          const a = poly[i]
          const c = poly[(i + 1) % poly.length]
          d = Math.min(d, segDistance(x, z, a[0], a[1], c[0], c[1]).d)
        }
        if (d > blend) continue
        const g = ground(x, z)
        const surface = b.get(x, g, z)
        if (!surface || !isNaturalGround(surface.name)) continue
        const target = Math.round(lerp(y, g, d / (blend + 1)))
        if (g > target) {
          for (let yy = target + 1; yy <= g; yy += 1) if (removable(x, yy, z)) b.remove(x, yy, z)
          b.set(x, target, z, surface)
        } else if (g < target) {
          for (let yy = g; yy < target; yy += 1) b.set(x, yy, z, fill)
          b.set(x, target, z, surface)
        }
      }
  }
  // Feature: small greens get it near the centre; statues/crosses sit off-centre toward the longest edge.
  let featurePos = null
  if (feature) {
    let ex = cx
    let ez = cz
    const offset = featureOffset ?? (feature === 'cross' ? 0.35 : 0)
    if (offset > 0) {
      let best = -1
      let mid = [cx, cz]
      for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i]
        const c = poly[(i + 1) % poly.length]
        const len = Math.hypot(c[0] - a[0], c[1] - a[1])
        if (len > best) {
          best = len
          mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]
        }
      }
      ex = lerp(cx, mid[0], offset)
      ez = lerp(cz, mid[1], offset)
    }
    ex = Math.round(ex)
    ez = Math.round(ez)
    featurePos = [ex, ez]
    if (feature === 'well') {
      b.box([ex - 2, y + 1, ez - 2], [ex + 2, y + 1, ez + 2], 'minecraft:cobblestone')
      b.box([ex - 1, y - 2, ez - 1], [ex + 1, y + 1, ez + 1], 'minecraft:water')
      b.box([ex - 2, y - 3, ez - 2], [ex + 2, y - 3, ez + 2], 'minecraft:cobblestone')
      for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) for (let k = 2; k <= 3; k += 1) b.set(ex + dx, y + k, ez + dz, 'minecraft:spruce_fence')
      b.roof({ x0: ex - 2, z0: ez - 2, x1: ex + 2, z1: ez + 2, y: y + 4, type: 'pyramid', material: 'spruce', pitch: 1, overhang: 1 })
    } else if (feature === 'fountain') {
      b.disc([ex, y, ez], 3.5, 'minecraft:stone_bricks')
      b.ring([ex, y + 1, ez], 3.5, 'minecraft:stone_brick_wall')
      b.disc([ex, y + 1, ez], 2.5, 'minecraft:water')
      b.box([ex, y + 1, ez], [ex, y + 2, ez], 'minecraft:chiseled_stone_bricks')
      b.set(ex, y + 3, ez, 'minecraft:water')
    } else if (feature === 'cross') {
      b.box([ex - 1, y + 1, ez - 1], [ex + 1, y + 1, ez + 1], 'minecraft:polished_andesite')
      b.set(ex, y + 2, ez, 'minecraft:chiseled_stone_bricks')
      for (let k = 3; k <= 5; k += 1) b.set(ex, y + k, ez, 'minecraft:stone_brick_wall')
      b.set(ex, y + 6, ez, 'minecraft:lantern[hanging=false]')
    } else if (feature === 'tree') {
      b.ring([ex, y + 1, ez], 2.5, 'minecraft:stone_brick_wall')
      b.disc([ex, y, ez], 1.5, 'minecraft:grass_block')
      b.tree([ex, y + 1, ez], 'oak', { seed: seed + 3 })
    }
  }
  if (lamps) {
    for (const [px, pz] of poly) {
      const lx = Math.round(lerp(px, cx, 0.12))
      const lz = Math.round(lerp(pz, cz, 0.12))
      if (cellSet.has(`${lx},${lz}`)) b.lampPost([lx, y + 1, lz], { height: 3, post: 'minecraft:spruce_fence', foot: 'minecraft:stone_brick_wall' })
    }
  }
  return { poly, y, cells, feature: featurePos }
}

// ------------------------------------------------------------------ skyline report

function asciiChart(profile, rows = 10, cols = 96) {
  if (profile.length === 0) return ''
  const step = Math.max(1, Math.ceil(profile.length / cols))
  const values = []
  for (let i = 0; i < profile.length; i += step) values.push(Math.max(...profile.slice(i, i + step)))
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = Math.max(1, hi - lo)
  const lines = []
  for (let r = rows - 1; r >= 0; r -= 1) {
    const level = lo + (span * (r + 0.5)) / rows
    lines.push(`${String(Math.round(level)).padStart(4)} |${values.map(v => (v >= level ? '#' : ' ')).join('')}`)
  }
  return lines.join('\n')
}

// Skyline and landmark check (composition.md §3.8). Separates buildings from terrain
// (columns rising ≥ minHeight above natural ground), groups them into footprints, and reports
// crown ratio (tallest / median building height), accents, roof-height variety and flat
// skyline runs, with side-elevation profiles from the south and the east.
//   const r = plan.skylineReport(b); console.log(r.text)
// Returns { buildings, walls, peaks, crown, median, ratio, accents, stddev, profiles: { south, east }, warnings, text }.
export function skylineReport(b, { minHeight = 3, minArea = 6, ignore = isDecor, ground = isNaturalGround, rows = 10, cols = 96 } = {}) {
  const [W, , D] = b.size
  const groundY = new Int16Array(W * D).fill(-1)
  const topY = new Int16Array(W * D).fill(-1)
  for (const [x, y, z, block] of b.entries()) {
    if (ignore(block.name)) continue
    const i = x + z * W
    if (y > topY[i]) topY[i] = y
    if (ground(block.name) && y > groundY[i]) groundY[i] = y
  }
  const built = new Uint8Array(W * D)
  for (let i = 0; i < W * D; i += 1) if (topY[i] >= 0 && topY[i] - Math.max(groundY[i], 0) >= minHeight) built[i] = 1
  // 8-connected footprints.
  const label = new Int32Array(W * D).fill(-1)
  const buildings = []
  for (let i = 0; i < W * D; i += 1) {
    if (!built[i] || label[i] >= 0) continue
    const stack = [i]
    label[i] = buildings.length
    const bld = { x0: W, z0: D, x1: 0, z1: 0, area: 0, top: -1, height: 0, groundY: Infinity }
    while (stack.length) {
      const j = stack.pop()
      const x = j % W
      const z = Math.floor(j / W)
      bld.area += 1
      bld.x0 = Math.min(bld.x0, x)
      bld.z0 = Math.min(bld.z0, z)
      bld.x1 = Math.max(bld.x1, x)
      bld.z1 = Math.max(bld.z1, z)
      bld.top = Math.max(bld.top, topY[j])
      bld.groundY = Math.min(bld.groundY, Math.max(0, groundY[j]))
      bld.height = Math.max(bld.height, topY[j] - Math.max(0, groundY[j]))
      for (let dz = -1; dz <= 1; dz += 1)
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          const nz = z + dz
          if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue
          const k = nx + nz * W
          if (built[k] && label[k] < 0) {
            label[k] = buildings.length
            stack.push(k)
          }
        }
    }
    buildings.push(bld)
  }
  // Compact footprints are buildings; long thin ones (fill < 0.3 of their bounding box) are
  // walls/rows, judged by their tower peaks instead of their overall height.
  for (const bl of buildings) {
    const box = (bl.x1 - bl.x0 + 1) * (bl.z1 - bl.z0 + 1)
    bl.kind = bl.area >= 40 && bl.area / box < 0.3 ? 'linear' : 'building'
  }
  const real = buildings.filter(bl => bl.kind === 'building' && bl.area >= minArea).sort((p, q) => q.height - p.height)
  const linear = buildings.filter(bl => bl.kind === 'linear').sort((p, q) => q.height - p.height)
  const heights = real.map(bl => bl.height)
  const med = median(heights)
  // Tower peaks on linear footprints: clusters of columns ≥ 1.3 × median height.
  const peaks = []
  if (med > 0) {
    const seen = new Uint8Array(W * D)
    for (let i = 0; i < W * D; i += 1) {
      if (seen[i] || label[i] < 0 || buildings[label[i]].kind !== 'linear') continue
      const h = topY[i] - Math.max(0, groundY[i])
      if (h < 1.3 * med) continue
      const stack = [i]
      seen[i] = 1
      let best = h
      let at = i
      while (stack.length) {
        const j = stack.pop()
        const x = j % W
        const z = Math.floor(j / W)
        for (let dz = -1; dz <= 1; dz += 1)
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx
            const nz = z + dz
            if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue
            const k = nx + nz * W
            if (seen[k] || label[k] !== label[i] || topY[k] - Math.max(0, groundY[k]) < 1.3 * med) continue
            seen[k] = 1
            stack.push(k)
            const hk = topY[k] - Math.max(0, groundY[k])
            if (hk > best) {
              best = hk
              at = k
            }
          }
      }
      peaks.push({ x: at % W, z: Math.floor(at / W), height: best, top: topY[at] })
    }
  }
  const crown = Math.max(heights[0] ?? 0, ...peaks.map(p => p.height))
  const ratio = med > 0 ? crown / med : 0
  const accents = heights.filter(h => h >= 1.3 * med).length + peaks.length - (crown >= 1.3 * med ? 1 : 0)
  const mean = heights.reduce((s, h) => s + h, 0) / (heights.length || 1)
  const stddev = Math.sqrt(heights.reduce((s, h) => s + (h - mean) ** 2, 0) / (heights.length || 1))
  const profile = axis => {
    const len = axis === 'x' ? W : D
    const out = new Array(len).fill(0)
    for (let z = 0; z < D; z += 1)
      for (let x = 0; x < W; x += 1) {
        const i = x + z * W
        const v = Math.max(topY[i], groundY[i])
        const k = axis === 'x' ? x : z
        if (v > out[k]) out[k] = v
      }
    return out
  }
  const south = profile('x')
  const east = profile('z')
  const longestFlat = prof => {
    let best = 0
    let run = 1
    for (let i = 1; i < prof.length; i += 1) {
      if (prof[i] === prof[i - 1] && prof[i] > 0) run += 1
      else run = 1
      best = Math.max(best, run)
    }
    return best
  }
  const warnings = []
  if (real.length === 0) warnings.push('No buildings found (nothing rises ≥ minHeight above natural ground).')
  else {
    if (ratio < 1.8) warnings.push(`No dominant landmark: tallest building is ${ratio.toFixed(2)}× the median height ${med} (want ≥ 1.8, ideally 2.5–4).`)
    if (accents > 4) warnings.push(`${accents} secondary accents (buildings or wall towers ≥ 1.3× median) compete with the crown (want 1–4; wall towers in a rhythm are fine if the crown is ≥ 1.8× them).`)
    if (accents === 0 && real.length >= 6) warnings.push('No secondary accents (towers, gables ≥ 1.3× median): skyline has one spike over a flat field.')
    if (stddev < 1.5 && real.length >= 4) warnings.push(`Uniform building heights (sd ${stddev.toFixed(2)} < 1.5): vary stories and roof forms.`)
    for (const [name, prof] of [['south', south], ['east', east]]) {
      const run = longestFlat(prof)
      if (run > 0.15 * prof.length) warnings.push(`Flat skyline from the ${name}: ${run} columns at one height (> 15% of the width).`)
    }
  }
  const text = [
    `skyline: ${real.length} buildings, crown ${crown}, median ${med}, ratio ${ratio.toFixed(2)}, accents ${accents}, sd ${stddev.toFixed(2)}, walls/rows ${linear.length} with ${peaks.length} tower peaks`,
    ...real.slice(0, 5).map((bl, i) => `  #${i + 1} height ${bl.height} top y${bl.top} at x${bl.x0}-${bl.x1} z${bl.z0}-${bl.z1} (${bl.area} cols)`),
    ...peaks.sort((p, q) => q.height - p.height).slice(0, 3).map(p => `  tower peak height ${p.height} top y${p.top} at x${p.x} z${p.z}`),
    ...(warnings.length ? warnings.map(w => `  WARN ${w}`) : ['  ok']),
    'from south (x →):',
    asciiChart(south, rows, cols),
    'from east (z →):',
    asciiChart(east, rows, cols),
  ].join('\n')
  return { buildings: real, walls: linear, peaks, crown, median: med, ratio, accents, stddev, profiles: { south, east }, warnings, text }
}

// ------------------------------------------------------------------ exports for wiring

// Builder-first methods (b.method(...args) → fn(b, ...args)).
export const PLAN_METHODS = { heightmapOf, paintRoad, curtainWall, plaza, skylineReport }

// Pure helpers.
export const PLAN_HELPERS = {
  routeRoad,
  lotsAlongRoad,
  gradeProfile,
  simplifyPolyline,
  chaikin,
  resamplePolyline,
  ringPolygon,
  pointInPolygon,
  isDecor,
  isNaturalGround,
}
