// The landscape of a whole spawn: a heightfield you shape with landforms, weather with real
// erosion, look at as a shaded map in seconds, then paint into blocks by slope, height and wetness.
// It is a toolbox, like the noise and the roofs: where the mountains stand, how the valley runs and
// where the town sits are yours to design. Guide: references/spawns/build-guide.md §5.1.
//
//   const land = b.land({ base: 40, seed: 3 })                 // the whole canvas, ground at y 40
//   land.outline({ cx: 500, cz: 500, r: 470, wobble: 0.12 })    // a floating island's edge
//   land.range([[90, 300], [300, 120], [640, 90], [900, 260]], { width: 220, height: 95 })
//   land.valley([[80, 640], [480, 560], [920, 700]], { width: 260, floor: 41 })
//   land.hills({ amp: 4, scale: 90 })
//   land.pad({ cx: 500, cz: 520, r: 90 }, { y: 42, blend: 30 })  // the plaza: flat, kept from erosion
//   land.erode()                                                // gullies, spurs, gravel fans
//   land.thermal()                                              // scree at the feet of the cliffs
//   land.preview('minecraft-builds/x/land.png')                 // a shaded map, in a second or two
//   const groundY = land.paint({ theme: 'autumn', underside: { depth: 80 } })
//
// Heights are absolute block levels (floats until painted). NaN marks columns with no land.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { parseBlock } from './blocks.mjs'
import { createRng, fbm2, hash01, perlin3, ridged2 } from './noise.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v)
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const ns = id => (String(id).includes(':') ? String(id) : `minecraft:${id}`)

// ------------------------------------------------------------------ themes
// What the ground is made of. Every list is weighted; the rock list is the strata, bottom to top
// of a repeating sequence of bands. Override any part: paint({ theme: { ...THEMES.autumn, grass: ... } }).
export const THEMES = {
  temperate: {
    grass: 'grass_block',
    patches: [['coarse_dirt', 4], ['podzol', 2], ['moss_block', 1]], // clumps on the flats
    patchShare: 0.08,
    slope: [['coarse_dirt', 4], ['grass_block', 3], ['rooted_dirt', 1], ['gravel', 1]], // 0.7-1.3 rise per block
    soil: 'dirt',
    rock: [['stone', 8], ['andesite', 4], ['tuff', 2], ['cobblestone', 1]],
    pale: 'calcite', // a thin pale band every 8-14 rows
    dark: 'deepslate', // the deep rock under the cliffs and the underside
    scree: [['gravel', 4], ['andesite', 2], ['cobblestone', 2], ['stone', 2], ['coarse_dirt', 2]],
    fan: [['gravel', 3], ['coarse_dirt', 3], ['grass_block', 4]], // where water dropped what it carried
    beach: [['sand', 3], ['gravel', 3], ['coarse_dirt', 1]],
    bed: [['gravel', 4], ['sand', 3], ['clay', 2], ['mud', 1]],
    snow: null,
  },
  autumn: {
    grass: 'grass_block',
    patches: [['podzol', 4], ['coarse_dirt', 4], ['rooted_dirt', 1], ['mud', 1]],
    patchShare: 0.12,
    slope: [['coarse_dirt', 4], ['podzol', 2], ['grass_block', 3], ['gravel', 1]],
    soil: 'dirt',
    rock: [['stone', 7], ['andesite', 4], ['tuff', 3], ['cobblestone', 1], ['granite', 1]],
    pale: 'calcite',
    dark: 'deepslate',
    scree: [['gravel', 4], ['andesite', 2], ['cobblestone', 2], ['tuff', 2], ['coarse_dirt', 2]],
    fan: [['gravel', 3], ['coarse_dirt', 3], ['podzol', 1], ['grass_block', 4]],
    beach: [['gravel', 4], ['sand', 2], ['coarse_dirt', 2]],
    bed: [['gravel', 4], ['sand', 2], ['clay', 2], ['mud', 2]],
    snow: null,
  },
  alpine: {
    grass: 'grass_block',
    patches: [['coarse_dirt', 3], ['moss_block', 1], ['podzol', 2]],
    patchShare: 0.08,
    slope: [['coarse_dirt', 3], ['gravel', 2], ['stone', 2], ['grass_block', 2]],
    soil: 'dirt',
    rock: [['stone', 7], ['andesite', 3], ['tuff', 2], ['diorite', 1]],
    pale: 'calcite',
    dark: 'deepslate',
    scree: [['gravel', 5], ['andesite', 2], ['cobblestone', 2], ['stone', 2]],
    fan: [['gravel', 4], ['coarse_dirt', 2], ['grass_block', 3]],
    beach: [['gravel', 5], ['sand', 1]],
    bed: [['gravel', 5], ['sand', 1], ['clay', 1]],
    snow: { block: 'snow_block', layer: true, line: 0.72 }, // above 72% of the relief, with a ragged edge
  },
  winter: {
    grass: 'snow_block',
    patches: [['powder_snow', 1], ['grass_block', 2], ['coarse_dirt', 1]],
    patchShare: 0.05,
    slope: [['snow_block', 3], ['stone', 2], ['gravel', 1]],
    soil: 'dirt',
    rock: [['stone', 7], ['andesite', 3], ['deepslate', 2], ['tuff', 1]],
    pale: 'calcite',
    dark: 'deepslate',
    scree: [['gravel', 3], ['stone', 3], ['andesite', 2], ['snow_block', 3]],
    fan: [['gravel', 2], ['snow_block', 5]],
    beach: [['gravel', 4], ['snow_block', 2]],
    bed: [['gravel', 4], ['sand', 1], ['clay', 1]],
    snow: { block: 'snow_block', layer: true, line: 0 },
  },
  desert: {
    grass: 'sand',
    patches: [['sandstone', 1], ['coarse_dirt', 1], ['red_sand', 1]],
    patchShare: 0.06,
    slope: [['sand', 3], ['sandstone', 3], ['smooth_sandstone', 1]],
    soil: 'sandstone',
    rock: [['sandstone', 6], ['smooth_sandstone', 2], ['cut_sandstone', 1], ['terracotta', 2]],
    pale: 'white_terracotta',
    dark: 'brown_terracotta',
    scree: [['sand', 4], ['sandstone', 2], ['gravel', 1]],
    fan: [['sand', 4], ['gravel', 1]],
    beach: [['sand', 5], ['gravel', 1]],
    bed: [['sand', 4], ['clay', 1], ['gravel', 1]],
    snow: null,
  },
  mesa: {
    grass: 'red_sand',
    patches: [['coarse_dirt', 2], ['grass_block', 1], ['terracotta', 1]],
    patchShare: 0.08,
    slope: [['red_sand', 2], ['terracotta', 3], ['coarse_dirt', 1]],
    soil: 'red_sandstone',
    rock: [['terracotta', 5], ['orange_terracotta', 3], ['red_terracotta', 2], ['yellow_terracotta', 1], ['brown_terracotta', 2], ['light_gray_terracotta', 1]],
    pale: 'white_terracotta',
    dark: 'red_sandstone',
    scree: [['red_sand', 4], ['terracotta', 2], ['gravel', 1]],
    fan: [['red_sand', 4], ['coarse_dirt', 1]],
    beach: [['red_sand', 3], ['sand', 2]],
    bed: [['red_sand', 3], ['clay', 1], ['gravel', 1]],
    snow: null,
  },
  tropical: {
    grass: 'grass_block',
    patches: [['moss_block', 2], ['coarse_dirt', 1], ['rooted_dirt', 1]],
    patchShare: 0.07,
    slope: [['grass_block', 4], ['moss_block', 2], ['coarse_dirt', 2]],
    soil: 'dirt',
    rock: [['stone', 5], ['andesite', 2], ['mossy_cobblestone', 2], ['tuff', 1]],
    pale: 'diorite',
    dark: 'deepslate',
    scree: [['gravel', 2], ['mossy_cobblestone', 3], ['andesite', 2], ['coarse_dirt', 2]],
    fan: [['sand', 2], ['coarse_dirt', 2], ['grass_block', 4]],
    beach: [['sand', 6], ['gravel', 1]],
    bed: [['sand', 4], ['gravel', 1], ['clay', 1]],
    snow: null,
  },
  dark: {
    grass: 'podzol',
    patches: [['mud', 2], ['coarse_dirt', 2], ['moss_block', 1], ['rooted_dirt', 1]],
    patchShare: 0.15,
    slope: [['coarse_dirt', 3], ['podzol', 2], ['gravel', 1], ['tuff', 1]],
    soil: 'coarse_dirt',
    rock: [['deepslate', 6], ['cobbled_deepslate', 2], ['tuff', 3], ['blackstone', 1], ['basalt', 1]],
    pale: 'smooth_basalt',
    dark: 'blackstone',
    scree: [['gravel', 3], ['cobbled_deepslate', 2], ['tuff', 2], ['blackstone', 1]],
    fan: [['gravel', 3], ['mud', 2], ['coarse_dirt', 2]],
    beach: [['gravel', 4], ['mud', 2]],
    bed: [['mud', 3], ['gravel', 2], ['clay', 1]],
    snow: null,
  },
}

// ------------------------------------------------------------------ paths
// A smooth path through [[x, z], ...]: dense samples with their distance along it.
export function smoothPath(points, step = 2) {
  if (points.length < 2) throw new Error('land: a path needs at least two points')
  const P = [[2 * points[0][0] - points[1][0], 2 * points[0][1] - points[1][1]], ...points, [2 * points.at(-1)[0] - points.at(-2)[0], 2 * points.at(-1)[1] - points.at(-2)[1]]]
  const out = []
  for (let i = 1; i < P.length - 2; i += 1) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]]
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let j = 0; j < n; j += 1) {
      const t = j / n
      const t2 = t * t
      const t3 = t2 * t
      const f = k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
      out.push([f(0), f(1)])
    }
  }
  out.push([...points.at(-1)])
  const L = [0]
  for (let i = 1; i < out.length; i += 1) L.push(L[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]))
  return { points: out, along: L, length: L.at(-1) || 1 }
}

// ------------------------------------------------------------------ the field
export class Land {
  constructor(b, { x0 = 0, z0 = 0, x1, z1, base = 0, seed = 1 } = {}) {
    this.b = b
    this.x0 = x0
    this.z0 = z0
    this.x1 = x1 ?? b.size[0] - 1
    this.z1 = z1 ?? b.size[2] - 1
    this.W = this.x1 - this.x0 + 1
    this.D = this.z1 - this.z0 + 1
    this.n = this.W * this.D
    this.base = base
    this.seed = seed
    this.h = new Float32Array(this.n).fill(base)
    this.lock = new Float32Array(this.n) // 0-1: how much a column is kept from erosion and smoothing
    this.dep = new Float32Array(this.n) // what erosion did: + dropped (fans), - carved (gullies)
    this.edge = null // distance to the outline's edge, when there is an outline
    this.water = null // Float32Array of water levels (NaN = none), from paint({ water })
    this.painted = null // Int16Array of painted tops
    this.warnings = []
    this._slope = null
    this._flow = null
  }

  // ---------------------------------------------------------------- access
  index(x, z) {
    const ix = Math.round(x) - this.x0
    const iz = Math.round(z) - this.z0
    if (ix < 0 || iz < 0 || ix >= this.W || iz >= this.D) return -1
    return iz * this.W + ix
  }
  inside(x, z) {
    const i = this.index(x, z)
    return i >= 0 && !Number.isNaN(this.h[i])
  }
  // the height at a column (a float; NaN off the land)
  get(x, z) {
    const i = this.index(x, z)
    return i < 0 ? NaN : this.h[i]
  }
  // the height between columns, smoothly
  at(x, z) {
    const fx = Math.min(this.W - 1.001, Math.max(0, x - this.x0))
    const fz = Math.min(this.D - 1.001, Math.max(0, z - this.z0))
    const ix = Math.floor(fx)
    const iz = Math.floor(fz)
    const u = fx - ix
    const v = fz - iz
    const i = iz * this.W + ix
    const H = this.h
    return H[i] * (1 - u) * (1 - v) + H[i + 1] * u * (1 - v) + H[i + this.W] * (1 - u) * v + H[i + this.W + 1] * u * v
  }
  // the block level of the ground's top (after paint: what was placed; -1 off the land)
  top(x, z) {
    const i = this.index(x, z)
    if (i < 0) return -1
    if (this.painted) return this.painted[i]
    const v = this.h[i]
    return Number.isNaN(v) ? -1 : Math.round(v)
  }
  // rise per block (0 flat, 1 = 45 degrees, 2+ a cliff)
  slope(x, z) {
    const i = this.index(x, z)
    return i < 0 ? NaN : this.slopes()[i]
  }
  // 0 (dry ridge) to 1 (where the water of the whole valley gathers)
  wetness(x, z) {
    const i = this.index(x, z)
    if (i < 0) return 0
    const f = this.flows()
    return clamp01(Math.log(f.acc[i]) / Math.log(f.max))
  }
  // + where erosion dropped material (fans), - where it carved (gullies), in blocks
  deposit(x, z) {
    const i = this.index(x, z)
    return i < 0 ? 0 : this.dep[i]
  }
  // a test for b.forest's avoid, b.scatter and your own placement:
  //   land.where({ slope: [0, 0.8], y: [0, 110], dry: true, unlocked: true })
  where({ slope, y, dry = false, wet, unlocked = false, deposit } = {}) {
    return (x, z) => {
      const i = this.index(x, z)
      if (i < 0 || Number.isNaN(this.h[i])) return false
      if (slope && (this.slopes()[i] < slope[0] || this.slopes()[i] > slope[1])) return false
      const top = this.top(x, z)
      if (y && (top < y[0] || top > y[1])) return false
      if (dry && this.water && !Number.isNaN(this.water[i]) && this.water[i] >= top) return false
      if (wet !== undefined && this.wetness(x, z) < wet) return false
      if (unlocked && this.lock[i] > 0.5) return false
      if (deposit !== undefined && this.dep[i] < deposit) return false
      return true
    }
  }

  changed() {
    this._slope = null
    this._flow = null
    return this
  }

  // ---------------------------------------------------------------- general edits
  // h = fn(x, z, h) for every column (NaN columns are skipped)
  apply(fn) {
    const { W, D, h } = this
    for (let iz = 0; iz < D; iz += 1)
      for (let ix = 0; ix < W; ix += 1) {
        const i = iz * W + ix
        if (Number.isNaN(h[i])) continue
        h[i] = fn(ix + this.x0, iz + this.z0, h[i])
      }
    return this.changed()
  }
  add(fn, { mask } = {}) {
    return this.apply((x, z, v) => v + fn(x, z, v) * (mask ? mask(x, z) : 1))
  }
  clamp({ min = -Infinity, max = Infinity } = {}) {
    return this.apply((x, z, v) => Math.min(max, Math.max(min, v)))
  }

  // ---------------------------------------------------------------- landforms
  // The land's edge, for land that floats (an island in the void). Columns outside get no land;
  // inside, the relief fades toward `rim` over the last `fall` blocks so mountains slope down to the
  // rim instead of being cut off.
  //   shape: { cx, cz, r, wobble } (a wandering circle), { cx, cz, rx, rz, wobble }, or (x, z) => true/false
  outline(shape, { fall = 40, rim, wobble = 0.12, seed = this.seed + 11 } = {}) {
    const { W, D, h } = this
    const inside = typeof shape === 'function' ? shape : (() => {
      const { cx, cz } = shape
      const rx = shape.rx ?? shape.r
      const rz = shape.rz ?? shape.r
      const w = shape.wobble ?? wobble
      return (x, z) => {
        const dx = (x - cx) / rx
        const dz = (z - cz) / rz
        const a = Math.atan2(dz, dx)
        const k = 1 + w * (fbm2(Math.cos(a) * 2.2 + 50, Math.sin(a) * 2.2, { scale: 1, octaves: 4, seed }) * 1.6) + 0.02 * fbm2(x, z, { scale: 9, seed: seed + 1 })
        return dx * dx + dz * dz < k * k
      }
    })()
    const mask = new Uint8Array(this.n)
    for (let iz = 0; iz < D; iz += 1) for (let ix = 0; ix < W; ix += 1) mask[iz * W + ix] = inside(ix + this.x0, iz + this.z0) ? 1 : 0
    this.edge = distanceInside(mask, W, D)
    const R = rim ?? this.base
    for (let i = 0; i < this.n; i += 1) {
      if (!mask[i]) {
        h[i] = NaN
        continue
      }
      const f = smoothstep(0, fall, this.edge[i])
      if (h[i] > R) h[i] = R + (h[i] - R) * f
    }
    return this.changed()
  }

  // Gentle roll: fbm of `amp` blocks at the feature size `scale`.
  hills({ amp = 4, scale = 90, octaves = 4, seed = this.seed + 21, mask } = {}) {
    return this.add((x, z) => amp * fbm2(x, z, { scale, octaves, seed }) * 2, { mask })
  }

  // Rugged texture where the land is already steep (spurs, ribs), little on the flats.
  roughen({ amp = 5, scale = 28, seed = this.seed + 31, steep = 0.6 } = {}) {
    const s = this.slopes()
    const { W } = this
    return this.apply((x, z, v) => {
      const k = smoothstep(steep * 0.4, steep * 1.6, s[(z - this.z0) * W + (x - this.x0)])
      return v + k * amp * (ridged2(x, z, { scale, octaves: 4, seed }) - 0.45) * 2
    })
  }

  // A mountain range along a path: a crest whose height wanders along it, a cross-section that is
  // steep near the crest and long at the foot (concave), spurs running down from the crest every
  // `spurs` blocks with side valleys between them, and a wandering foot. `height` is above the
  // ground there; `asym` > 0 makes the right-hand side (looking along the path) shorter and
  // steeper, < 0 the left.
  range(points, { width = 160, height = 70, sharp = 1.6, rough = 0.45, spurs, warp = 0.3, vary = 0.35, asym = 0, taper = true, seed = this.seed + 41 } = {}) {
    const p = smoothPath(points)
    const hw = width / 2
    const spacing = spurs ?? Math.max(18, hw * 0.45)
    const reach = hw * (1 + Math.abs(asym)) * (1 + warp) + 2
    const near = pathDistance(this, p, reach)
    const { h } = this
    for (const i of near.cells) {
      if (Number.isNaN(h[i])) continue
      const x = (i % this.W) + this.x0
      const z = Math.floor(i / this.W) + this.z0
      let d = near.d[i] * (1 + warp * fbm2(x, z, { scale: hw * 0.9, octaves: 3, seed }) * 2)
      if (asym) d *= near.side[i] > 0 ? 1 + asym : 1 / (1 + Math.max(0, -asym))
      const u = d / hw
      if (u >= 1) continue
      const t = near.t[i]
      const a = t * p.length
      let H = height * (1 - vary + vary * (0.5 + fbm2(a, 0, { scale: hw * 1.1, octaves: 3, seed: seed + 2 }) * 1.4))
      if (taper) H *= 0.3 + 0.7 * smoothstep(0, 0.18, t) * smoothstep(1, 0.82, t)
      h[i] += H * profile(u, sharp) * relief(a, near.side[i] * d, x, z, spacing, rough, seed)
    }
    return this.changed()
  }

  // One mountain: the radial version of a range, never a cone: stretched along `angle` by
  // `stretch`, with `summits` lesser tops round the main one, spurs running down its flanks every
  // `spurs` blocks with gullies between, curving and forking.
  peak([cx, cz], { r = 80, height = 80, sharp = 1.7, rough = 0.5, spurs, warp = 0.35, stretch = 1.4, angle, summits = 2, seed = this.seed + 51 } = {}) {
    const rng = createRng(seed * 7 + 3)
    const ang0 = angle ?? rng() * Math.PI
    const tops = [{ x: cx, z: cz, r, height }]
    for (let k = 0; k < summits; k += 1) {
      const a = ang0 + (k % 2 ? Math.PI : 0) + (rng() - 0.5) * 1.2
      const off = r * (0.3 + 0.25 * rng())
      tops.push({ x: cx + Math.cos(a) * off * stretch, z: cz + Math.sin(a) * off, r: r * (0.45 + 0.2 * rng()), height: height * (0.45 + 0.3 * rng()) })
    }
    const { W, h } = this
    const reach = Math.ceil(r * stretch * (1 + warp) * 1.3)
    const spacing = spurs ?? Math.max(16, r * 0.4)
    const ca = Math.cos(ang0)
    const sa = Math.sin(ang0)
    for (let z = Math.max(this.z0, cz - reach); z <= Math.min(this.z1, cz + reach); z += 1)
      for (let x = Math.max(this.x0, cx - reach); x <= Math.min(this.x1, cx + reach); x += 1) {
        const i = (z - this.z0) * W + (x - this.x0)
        if (Number.isNaN(h[i])) continue
        const wx = x + warp * r * 0.5 * fbm2(x, z, { scale: r * 0.7, octaves: 3, seed })
        const wz = z + warp * r * 0.5 * fbm2(x + 917, z - 413, { scale: r * 0.7, octaves: 3, seed })
        let best = 0
        let dist = 0
        for (const t of tops) {
          const dx = wx - t.x
          const dz = wz - t.z
          // distance in the mountain's own frame, long along ang0
          const u = Math.hypot((dx * ca + dz * sa) / stretch, -dx * sa + dz * ca) / t.r
          if (u >= 1) continue
          const v = t.height * profile(u, sharp)
          if (v > best) { best = v; dist = u * t.r }
        }
        if (best <= 0) continue
        // spurs round the mountain: ridged noise on a circle (no seam), stretched down the slope,
        // its angle bent by noise so they curve and fork instead of making a star
        const ang = Math.atan2(z - cz, x - cx) + 0.8 * fbm2(x, z, { scale: r * 0.6, octaves: 3, seed: seed + 7 })
        const k = (r * 0.9) / spacing
        const spur = ridged3(Math.cos(ang) * k, Math.sin(ang) * k, (dist * 0.3) / spacing, seed + 5)
        const knob = ridged2(x, z, { scale: spacing * 1.2, octaves: 5, seed: seed + 3 })
        h[i] += best * (1 - rough + rough * (0.4 * spur + 0.6 * knob) * 1.55)
      }
    return this.changed()
  }

  // A valley along a path, carved down to `floor` (a level, or t => level along the path, 0-1): a
  // flat floor over the middle `flat` share, sides that rise to the land at the edge of `width`.
  // shape 'u' (a glacier's valley: flat floor, steep sides) or 'v' (a river's).
  // The floor is kept from erosion (lock, default true), so the rain does not fill a river's
  // floodplain back in with fans; lock: false lets it weather like the rest.
  valley(points, { width = 200, floor, depth = 20, flat = 0.35, shape = 'u', warp = 0.2, lock = true, seed = this.seed + 61 } = {}) {
    const p = smoothPath(points)
    const hw = width / 2
    const near = pathDistance(this, p, hw * (1 + warp) + 2)
    const { h } = this
    const power = shape === 'v' ? 0.8 : 1.7
    for (const i of near.cells) {
      if (Number.isNaN(h[i])) continue
      const x = (i % this.W) + this.x0
      const z = Math.floor(i / this.W) + this.z0
      const u = (near.d[i] * (1 + warp * fbm2(x, z, { scale: hw * 0.8, octaves: 3, seed }) * 2)) / hw
      if (u >= 1) continue
      const F = floor === undefined ? h[i] - depth : typeof floor === 'function' ? floor(near.t[i]) : floor
      const s = smoothstep(flat, 1, u)
      const carved = F + (h[i] - F) * s ** power
      if (carved < h[i]) h[i] = carved
      if (lock) this.lock[i] = Math.max(this.lock[i], 1 - s)
    }
    return this.changed()
  }

  // A flat pad (the plaza, the town, a building's yard): the land inside at level `y` ('mean' =
  // the mean there), blending to the land round it over `blend` blocks, and kept from erosion.
  //   shape: { cx, cz, r } | { x0, z0, x1, z1, round } | { points: [[x, z], ...] }
  pad(shape, { y = 'mean', blend = 24, wobble = 0.35, lock = true, seed = this.seed + 71 } = {}) {
    const sd = signedDistance(shape)
    const bb = boundsOf(shape, blend * 2 + 4)
    const { W, h } = this
    const cells = []
    for (let z = Math.max(this.z0, bb[1]); z <= Math.min(this.z1, bb[3]); z += 1)
      for (let x = Math.max(this.x0, bb[0]); x <= Math.min(this.x1, bb[2]); x += 1) cells.push([x, z, (z - this.z0) * W + (x - this.x0)])
    let level = y
    if (y === 'mean') {
      let s = 0
      let c = 0
      for (const [x, z, i] of cells) if (sd(x, z) <= 0 && !Number.isNaN(h[i])) { s += h[i]; c += 1 }
      level = c ? s / c : this.base
    }
    // the edge of the blend wanders by up to `wobble` of the blend, so no circle or rectangle shows
    const wob = wobble * blend
    for (const [x, z, i] of cells) {
      if (Number.isNaN(h[i])) continue
      let d = sd(x, z)
      if (d > 0) d = Math.max(0, d + wob * (0.5 + fbm2(x, z, { scale: Math.max(12, blend), octaves: 3, seed }) * 1.6) - wob * 0.5)
      if (d >= blend) continue
      const t = d <= 0 ? 0 : d / blend
      const w = 1 - t * t * t * (t * (t * 6 - 15) + 10) // smootherstep: no crease at either end
      h[i] += (level - h[i]) * w
      if (lock) this.lock[i] = Math.max(this.lock[i], w)
    }
    this.changed()
    return level
  }

  // Smooth with a box blur of radius r, `iterations` times; locked columns stay, and mask(x, z)
  // (0-1) limits it to part of the land.
  smooth({ r = 1, iterations = 1, mask } = {}) {
    const { W, D, h, lock } = this
    const before = h.slice()
    const tmp = new Float32Array(this.n)
    for (let it = 0; it < iterations; it += 1) {
      for (let pass = 0; pass < 2; pass += 1) {
        const src = pass === 0 ? h : tmp
        const dst = pass === 0 ? tmp : h
        for (let iz = 0; iz < D; iz += 1)
          for (let ix = 0; ix < W; ix += 1) {
            const i = iz * W + ix
            if (Number.isNaN(src[i])) { dst[i] = NaN; continue }
            let s = 0
            let c = 0
            for (let k = -r; k <= r; k += 1) {
              const jx = pass === 0 ? ix + k : ix
              const jz = pass === 0 ? iz : iz + k
              if (jx < 0 || jz < 0 || jx >= W || jz >= D) continue
              const v = src[jz * W + jx]
              if (Number.isNaN(v)) continue
              s += v
              c += 1
            }
            dst[i] = s / c
          }
      }
    }
    // locked and masked-out columns keep what they were
    for (let i = 0; i < this.n; i += 1) {
      if (Number.isNaN(h[i])) continue
      let k = 1 - lock[i]
      if (mask) k *= clamp01(mask((i % W) + this.x0, Math.floor(i / W) + this.z0))
      h[i] = before[i] + (h[i] - before[i]) * k
    }
    return this.changed()
  }

  // Hydraulic erosion: hundreds of thousands of raindrops run downhill, pick up soil where they
  // speed up and drop it where they slow down. It cuts gullies down the slopes, sharpens the spurs
  // between them and lays fans of gravel at their feet: the look of real mountains. Pads stay.
  //   strength 1 is a good default; 2-3 for deep gullies; res 1-4 (blocks per cell; auto for big land)
  erode({ strength = 1, res, radius = 3, lifetime = 40, inertia = 0.05, capacity = 4, deposition = 0.3, erosion = 0.3, evaporation = 0.015, gravity = 4, seed = this.seed + 81 } = {}) {
    const R = res ?? (this.n > 600000 ? 2 : 1)
    const Wc = Math.floor(this.W / R)
    const Dc = Math.floor(this.D / R)
    if (Wc < 8 || Dc < 8) return this
    // the coarse grid, normalised to 0-1 (the dynamics are tuned for that)
    const g = new Float32Array(Wc * Dc)
    const lk = new Float32Array(Wc * Dc)
    let lo = Infinity
    let hi = -Infinity
    for (let cz = 0; cz < Dc; cz += 1)
      for (let cx = 0; cx < Wc; cx += 1) {
        let s = 0
        let c = 0
        let l = 0
        for (let dz = 0; dz < R; dz += 1)
          for (let dx = 0; dx < R; dx += 1) {
            const i = (cz * R + dz) * this.W + cx * R + dx
            const v = this.h[i]
            l = Math.max(l, this.lock[i])
            if (Number.isNaN(v)) { c = -1; break }
            s += v
            c += 1
          }
        const j = cz * Wc + cx
        if (c <= 0) { g[j] = NaN; continue }
        g[j] = s / c
        lk[j] = l
        if (g[j] < lo) lo = g[j]
        if (g[j] > hi) hi = g[j]
      }
    const relief = Math.max(1, hi - lo)
    // scale so the droplets see slopes like on a 256-cell map 0-1 high
    const vscale = (relief / Math.max(Wc, Dc)) * 256
    for (let j = 0; j < g.length; j += 1) if (!Number.isNaN(g[j])) g[j] = (g[j] - lo) / vscale
    // near the land's edge (where the water leaves) erosion fades out, as at a river's mouth
    if (this.edge)
      for (let cz = 0; cz < Dc; cz += 1)
        for (let cx = 0; cx < Wc; cx += 1) {
          const e = this.edge[(cz * R) * this.W + cx * R] / R
          if (e < 14) lk[cz * Wc + cx] = Math.max(lk[cz * Wc + cx], 1 - smoothstep(2, 14, e))
        }
    const before = g.slice()
    const drops = Math.round(Wc * Dc * 1.2 * strength)
    // nothing is carved below the lowest land there was (the base level every valley drains to)
    erodeGrid(g, Wc, Dc, lk, { drops, radius, lifetime, inertia, capacity, deposition, erosion, evaporation, gravity, rng: createRng(seed), floor: -2 / vscale })
    // back to blocks: the change, spread smoothly over the full field
    const delta = new Float32Array(Wc * Dc)
    for (let j = 0; j < g.length; j += 1) delta[j] = Number.isNaN(g[j]) ? 0 : (g[j] - before[j]) * vscale
    for (let iz = 0; iz < this.D; iz += 1)
      for (let ix = 0; ix < this.W; ix += 1) {
        const i = iz * this.W + ix
        if (Number.isNaN(this.h[i])) continue
        const fx = Math.min(Wc - 1.001, Math.max(0, (ix + 0.5) / R - 0.5))
        const fz = Math.min(Dc - 1.001, Math.max(0, (iz + 0.5) / R - 0.5))
        const cx = Math.floor(fx)
        const cz = Math.floor(fz)
        const u = fx - cx
        const v = fz - cz
        const j = cz * Wc + cx
        const d = delta[j] * (1 - u) * (1 - v) + delta[j + 1] * u * (1 - v) + delta[j + Wc] * (1 - u) * v + delta[j + Wc + 1] * u * v
        const keep = 1 - this.lock[i]
        this.h[i] += d * keep
        this.dep[i] += d * keep
      }
    return this.changed()
  }

  // Thermal erosion: slopes steeper than `talus` (rise per block) slump, the loose material piling
  // at the foot as scree. Run it after erode() for screes under the cliffs; a low talus (0.6-0.9)
  // softens everything, a high one (1.5+) only trims spikes.
  thermal({ talus = 1.25, iterations = 12, rate = 0.45 } = {}) {
    const { W, D, h, lock } = this
    const delta = new Float32Array(this.n)
    const off = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, -1, Math.SQRT2]]
    for (let it = 0; it < iterations; it += 1) {
      delta.fill(0)
      for (let iz = 1; iz < D - 1; iz += 1)
        for (let ix = 1; ix < W - 1; ix += 1) {
          const i = iz * W + ix
          const v = h[i]
          if (Number.isNaN(v) || lock[i] > 0.5) continue
          let total = 0
          let dmax = 0
          const ex = []
          for (const [dx, dz, dist] of off) {
            const j = i + dz * W + dx
            const w = h[j]
            if (Number.isNaN(w)) continue
            const diff = (v - w) / dist
            if (diff > talus) {
              ex.push(j, diff - talus)
              total += diff - talus
              if (diff - talus > dmax) dmax = diff - talus
            }
          }
          if (!total) continue
          const move = rate * dmax * 0.5
          delta[i] -= move
          for (let k = 0; k < ex.length; k += 2) delta[ex[k]] += (move * ex[k + 1]) / total
        }
      for (let i = 0; i < this.n; i += 1) if (delta[i]) { h[i] += delta[i]; this.dep[i] += delta[i] > 0 ? delta[i] * 0.5 : 0 }
    }
    return this.changed()
  }

  // ---------------------------------------------------------------- analysis
  slopes() {
    if (this._slope) return this._slope
    const { W, D, h } = this
    const s = new Float32Array(this.n)
    for (let iz = 0; iz < D; iz += 1)
      for (let ix = 0; ix < W; ix += 1) {
        const i = iz * W + ix
        const v = h[i]
        if (Number.isNaN(v)) { s[i] = NaN; continue }
        const at = (jx, jz) => {
          if (jx < 0 || jz < 0 || jx >= W || jz >= D) return v
          const w = h[jz * W + jx]
          return Number.isNaN(w) ? v : w
        }
        s[i] = Math.hypot((at(ix + 1, iz) - at(ix - 1, iz)) / 2, (at(ix, iz + 1) - at(ix, iz - 1)) / 2)
      }
    this._slope = s
    return s
  }

  // where water gathers: each column passes its rain to its lowest neighbour (D8)
  flows() {
    if (this._flow) return this._flow
    const { W, D, h } = this
    const order = new Uint32Array(this.n)
    for (let i = 0; i < this.n; i += 1) order[i] = i
    const key = Float32Array.from(h, v => (Number.isNaN(v) ? -1e9 : v))
    order.sort((a, b) => key[b] - key[a])
    const acc = new Float32Array(this.n).fill(1)
    let max = 1
    for (const i of order) {
      if (key[i] < -1e8) continue
      const ix = i % W
      const iz = (i - ix) / W
      let best = -1
      let drop = 0
      for (let dz = -1; dz <= 1; dz += 1)
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dz) continue
          const jx = ix + dx
          const jz = iz + dz
          if (jx < 0 || jz < 0 || jx >= W || jz >= D) continue
          const j = jz * W + jx
          const dd = (key[i] - key[j]) / (dx && dz ? Math.SQRT2 : 1)
          if (dd > drop) { drop = dd; best = j }
        }
      if (best >= 0) {
        acc[best] += acc[i]
        if (acc[best] > max) max = acc[best]
      }
    }
    this._flow = { acc, max }
    return this._flow
  }

  // numbers to judge the land by (see the manual's §5.1 for the targets)
  stats() {
    const s = this.slopes()
    let n = 0
    let lo = Infinity
    let hi = -Infinity
    let sum = 0
    const bins = [0, 0, 0, 0, 0] // flat <0.15, gentle <0.5, sloping <1, steep <1.8, cliff
    for (let i = 0; i < this.n; i += 1) {
      const v = this.h[i]
      if (Number.isNaN(v)) continue
      n += 1
      sum += v
      if (v < lo) lo = v
      if (v > hi) hi = v
      const k = s[i] < 0.15 ? 0 : s[i] < 0.5 ? 1 : s[i] < 1 ? 2 : s[i] < 1.8 ? 3 : 4
      bins[k] += 1
    }
    const pct = k => Math.round((1000 * bins[k]) / Math.max(1, n)) / 10
    return { columns: n, min: Math.round(lo), max: Math.round(hi), mean: Math.round(sum / Math.max(1, n)), relief: Math.round(hi - lo), flat: pct(0), gentle: pct(1), sloping: pct(2), steep: pct(3), cliff: pct(4) }
  }

  // ---------------------------------------------------------------- the map
  // A shaded relief map of the land (north up), coloured like the blocks paint() would place,
  // with contour lines every `contour` blocks: the quickest way to judge the landforms. Water:
  // a level, or the levels paint() used. Takes a second or two; build only once the map is right.
  preview(file, { theme = 'temperate', water, contour = 10, px, light = [-1, 1.6, -1] } = {}) {
    const T = resolveTheme(theme)
    const colors = blockColors()
    const step = px ? 1 / px : Math.max(1, Math.ceil(Math.max(this.W, this.D) / 1000))
    const Wp = Math.floor(this.W / step)
    const Dp = Math.floor(this.D / step)
    const rgb = Buffer.alloc(Wp * Dp * 3)
    const s = this.slopes()
    const L = Math.hypot(...light)
    const [lx, ly, lz] = light.map(v => v / L)
    const st = this.stats()
    const colorOf = name => {
      const c = colors[ns(name)]?.top ?? '#808080'
      return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
    }
    const grass = ns(T.grass) === 'minecraft:grass_block' ? [92, 138, 62] : colorOf(T.grass)
    const pal = {
      grass,
      slope: [118, 112, 84],
      rock: colorOf(T.rock[0][0]),
      scree: colorOf(T.scree[0][0]),
      fan: [126, 120, 104],
      snow: [240, 244, 248],
      beach: colorOf(T.beach[0][0]),
      water: [52, 92, 170],
    }
    for (let pz = 0; pz < Dp; pz += 1)
      for (let pxi = 0; pxi < Wp; pxi += 1) {
        const ix = Math.min(this.W - 1, Math.floor(pxi * step))
        const iz = Math.min(this.D - 1, Math.floor(pz * step))
        const i = iz * this.W + ix
        const o = (pz * Wp + pxi) * 3
        const v = this.h[i]
        if (Number.isNaN(v)) { rgb[o] = 24; rgb[o + 1] = 26; rgb[o + 2] = 34; continue }
        const hx = (this.h[Math.min(i + 1, this.n - 1)] - this.h[Math.max(i - 1, 0)]) / 2
        const hz = (this.h[Math.min(i + this.W, this.n - 1)] - this.h[Math.max(i - this.W, 0)]) / 2
        const nl = Math.hypot(hx, 1, hz)
        const shade = Number.isNaN(hx + hz) ? 0.8 : Math.max(0.25, (-hx * lx + ly - hz * lz) / nl)
        const wl = typeof water === 'number' ? water : this.water ? this.water[i] : NaN
        let c
        if (!Number.isNaN(wl) && wl >= Math.round(v)) c = pal.water
        else {
          const k = classify(T, s[i], v, this.dep[i], st, ix + this.x0, iz + this.z0, this.seed)
          c = pal[k] ?? pal.grass
        }
        let f = (0.55 + 0.6 * shade) * (0.92 + 0.16 * ((v - st.min) / Math.max(1, st.relief)))
        if (contour && Math.floor(v / contour) !== Math.floor((v + Math.max(Math.abs(hx), Math.abs(hz)) * step) / contour)) f *= 0.78
        rgb[o] = Math.min(255, c[0] * f)
        rgb[o + 1] = Math.min(255, c[1] * f)
        rgb[o + 2] = Math.min(255, c[2] * f)
      }
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
    fs.writeFileSync(file, encodePng(Wp, Dp, rgb))
    return { file, size: [Wp, Dp], stats: st }
  }

  // ---------------------------------------------------------------- blocks
  // Paint the land into the builder, column by column, and return groundY(x, z): the top block's
  // level (-1 off the land). Per column, by slope, height, wetness and what erosion did:
  //   flats: the theme's grass with clumped patches; slopes 0.7-1.3: the slope mix; steeper: bare
  //   rock in strata (tilted, wandering bands, a pale line every 8-14 rows), the exposed side of
  //   every step in rock too; fans where erosion dropped material; snow above the theme's line;
  //   soil 1-4 deep under the top, deeper on the flats.
  // options:
  //   theme: a THEMES name or your own object (any part of one overrides the 'temperate' default)
  //   bottom: the lowest block of each column: a level, or (x, z, top) => level (default: 6 below
  //           the lowest neighbour, so steps and cliffs are solid)
  //   underside: { depth, ramp, ragged, y } for floating land: under the outline the land hangs down
  //           to a ragged point `depth` deep in the middle, reaching full depth `ramp` blocks in
  //   water: { level, from: [x, z] } fills the basin round `from` below `level` with still water (a
  //          lake; a list for several); { level, where(x, z) } fills every column below the level
  //          where says so (a sea round the land). The bed and the shore get the theme's bed and
  //          beach; a level that would spill warns. Rivers: carve them after, with river() (§5.4).
  //   surface: ({ x, z, y, slope, wet, deposit, kind }) => block | null to decide the top yourself
  //   tilt: the strata's dip, [dx, dz] rows per block (default a gentle one from the seed)
  paint({ theme = 'temperate', bottom, underside, water, surface, tilt, seed = this.seed } = {}) {
    const b = this.b
    const T = resolveTheme(theme)
    const { W, D, h } = this
    const s = this.slopes()
    const st = this.stats()
    const P = name => parseBlock(ns(name))
    const pick = list => {
      const total = list.reduce((a, [, w]) => a + w, 0)
      const parsed = list.map(([n, w]) => [P(n), w / total])
      return u => {
        for (const [blk, w] of parsed) {
          if (u < w) return blk
          u -= w
        }
        return parsed.at(-1)[0]
      }
    }
    const grass = P(T.grass)
    const patches = pick(T.patches)
    const slopeMix = pick(T.slope)
    const scree = pick(T.scree)
    const fan = pick(T.fan)
    const beach = pick(T.beach)
    const bed = pick(T.bed)
    const soil = P(T.soil)
    const dark = P(T.dark)
    const waterBlock = P('water')
    const snowBlock = T.snow ? P(T.snow.block) : null
    const strata = strataTable(T, seed)
    // the patches cover patchShare of the flats, in blobs 10-40 across (fbm of 4 octaves, sd ~0.2)
    const patchCut = 0.2 * Math.SQRT2 * inverfc(2 * T.patchShare)
    const rng = createRng(seed + 5)
    const [tx, tz] = tilt ?? [(rng() - 0.5) * 0.06, (rng() - 0.5) * 0.06]
    // the water levels
    this.water = null
    if (water) {
      this.water = new Float32Array(this.n).fill(NaN)
      const lakes = Array.isArray(water) ? water : [water]
      for (const lake of lakes) {
        const below = i => !Number.isNaN(h[i]) && Math.round(h[i]) < lake.level
        if (lake.from) {
          // a lake fills its basin: every column below the level joined to `from`
          const start = this.index(lake.from[0], lake.from[1])
          if (start < 0 || !below(start)) {
            this.warnings.push(`land.paint: the lake at ${lake.from} is not below its level ${lake.level} there`)
            continue
          }
          const stack = [start]
          this.water[start] = lake.level
          while (stack.length) {
            const i = stack.pop()
            const ix = i % W
            for (const j of [ix > 0 ? i - 1 : -1, ix < W - 1 ? i + 1 : -1, i - W, i + W]) {
              if (j < 0 || j >= this.n || !Number.isNaN(this.water[j]) || !below(j)) continue
              if (lake.where && !lake.where((j % W) + this.x0, Math.floor(j / W) + this.z0)) continue
              this.water[j] = lake.level
              stack.push(j)
            }
          }
          continue
        }
        for (let iz = 0; iz < D; iz += 1)
          for (let ix = 0; ix < W; ix += 1) {
            const i = iz * W + ix
            const x = ix + this.x0
            const z = iz + this.z0
            if (!below(i) || (lake.where && !lake.where(x, z))) continue
            this.water[i] = lake.level
          }
      }
    }
    const top = new Int16Array(this.n).fill(-1)
    for (let i = 0; i < this.n; i += 1) if (!Number.isNaN(h[i])) top[i] = Math.round(h[i])
    this.painted = top
    // hold every lake: water beside the void (the edge of the land or the canvas) gives way to
    // shore, again and again until none is left there; a dry neighbour lower than the water is
    // raised to its level, so nothing spills when the spawn is pasted
    if (this.water) {
      let changed = true
      let shrunk = 0
      let raised = 0
      while (changed) {
        changed = false
        for (let i = 0; i < this.n; i += 1) {
          if (Number.isNaN(this.water[i])) continue
          const ix = i % W
          const wl = this.water[i]
          for (const j of [ix > 0 ? i - 1 : -1, ix < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i + W < this.n ? i + W : -1]) {
            if (j < 0 || top[j] < 0) {
              this.water[i] = NaN
              top[i] = Math.max(top[i], Math.round(wl))
              shrunk += 1
              changed = true
              break
            }
            if (Number.isNaN(this.water[j]) && top[j] < wl) {
              top[j] = Math.round(wl)
              raised += 1
            }
          }
        }
      }
      if (shrunk) this.warnings.push(`land.paint: ${shrunk} water columns touched the edge of the land and became shore: keep lakes inside the outline`)
      void raised
    }
    const f = b.focus
    const [sx, sy, sz] = b.size
    let clipped = 0
    let spill = 0
    for (let iz = 0; iz < D; iz += 1) {
      const z = iz + this.z0
      if (f && (z < f[1] || z > f[3])) continue
      for (let ix = 0; ix < W; ix += 1) {
        const x = ix + this.x0
        if (f && (x < f[0] || x > f[2])) continue
        const i = iz * W + ix
        const t = top[i]
        if (t < 0) continue
        // the lowest neighbour: the side of the column is seen from there up
        let low = t
        let rim = false
        for (const j of [ix > 0 ? i - 1 : -1, ix < W - 1 ? i + 1 : -1, iz > 0 ? i - W : -1, iz < D - 1 ? i + W : -1]) {
          if (j < 0 || top[j] < 0) { rim = true; continue }
          if (top[j] < low) low = top[j]
        }
        const face = t - low
        const sl = s[i]
        const wl = this.water ? this.water[i] : NaN
        const submerged = !Number.isNaN(wl)
        // next to water: the shore
        let shore = false
        if (this.water && !submerged)
          for (const j of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1]) if (j >= 0 && j < this.n && !Number.isNaN(this.water[j]) && t <= this.water[j] + 1) shore = true
        const kind = submerged ? 'bed' : shore ? 'beach' : classify(T, sl, h[i], this.dep[i], st, x, z, seed)
        const u = hash01(x, 0, z, seed + 13)
        const clump = 0.5 + fbm2(x, z, { scale: 7, octaves: 2, seed: seed + 17 }) * 1.2
        const patch = fbm2(x, z, { scale: 26, octaves: 4, seed: seed + 37 }) + (u - 0.5) * 0.08
        let topBlock
        const custom = surface?.({ x, z, y: t, slope: sl, wet: this._flow ? this.wetness(x, z) : undefined, deposit: this.dep[i], kind })
        if (custom) topBlock = P(custom)
        else if (kind === 'bed') topBlock = bed(clamp01(clump * 0.7 + u * 0.3))
        else if (kind === 'beach') topBlock = beach(clamp01(clump * 0.7 + u * 0.3))
        else if (kind === 'snow') topBlock = snowBlock
        else if (kind === 'rock') topBlock = null // strata
        else if (kind === 'scree') topBlock = scree(clamp01(clump * 0.6 + u * 0.4))
        else if (kind === 'fan') topBlock = fan(clamp01(clump * 0.6 + u * 0.4))
        else if (kind === 'slope') topBlock = slopeMix(clamp01(clump * 0.65 + u * 0.35))
        else topBlock = patch > patchCut ? patches(clamp01(clump * 0.7 + u * 0.3)) : grass
        // how deep the soil is under the top
        const soilDepth = kind === 'rock' || kind === 'snow' && sl > 1 ? 0 : kind === 'slope' || kind === 'scree' ? 1 + (u < 0.5 ? 1 : 0) : 3 + (u < 0.4 ? 1 : 0)
        const warp = fbm2(x, z, { scale: 40, octaves: 3, seed: seed + 19 }) * 6 + x * tx + z * tz
        // the bottom of the column
        let y0
        if (typeof bottom === 'function') y0 = bottom(x, z, t)
        else if (typeof bottom === 'number') y0 = bottom
        else y0 = rim && !underside ? t - 8 : low - 6
        if (underside && this.edge) {
          const { depth = 60, ramp = 120, ragged = 0.35, y: uy } = underside
          const rimTop = Math.min(t, uy ?? t)
          const e = clamp01(this.edge[i] / ramp)
          const d = depth * e ** 0.7 * (1 - ragged + ragged * (0.5 + fbm2(x, z, { scale: 11, octaves: 3, seed: seed + 23 }) * 1.6))
          y0 = Math.min(y0, Math.round(rimTop - Math.max(3, d)))
        }
        if (y0 < 0) { clipped += 1; y0 = 0 }
        const yTop = Math.min(t, sy - 1)
        if (t > sy - 1) clipped += 1
        for (let y = y0; y <= yTop; y += 1) {
          const depthBelow = t - y
          let blk
          if (depthBelow === 0 && topBlock) blk = topBlock
          else if (depthBelow <= soilDepth && depthBelow > 0 && !(face >= 3 && y > low && kind !== 'flat')) blk = soil
          else blk = y < st.min - 8 && depthBelow > 12 ? dark : strata(y + warp, x, z)
          b.put(x, y, z, blk)
        }
        // water above the bed
        if (submerged) {
          for (let y = t + 1; y <= Math.min(wl, sy - 1); y += 1) b.put(x, y, z, waterBlock)
          for (const j of [i - 1, i + 1, i - W, i + W]) if (j < 0 || j >= this.n || top[j] < 0 || (Number.isNaN(this.water[j]) && top[j] < wl)) spill += 1
        }
        // snow layers as deep as the land's true surface stands above the block: the steps of a
        // snowy slope fill in smoothly instead of showing as a staircase
        if (kind === 'snow' && T.snow?.layer && sl < 1.1 && t + 1 < sy) {
          const frac = h[i] - t + 0.5 // 0-1: how far up toward the next block the surface is
          const layers = Math.min(7, Math.max(sl < 0.2 ? 1 : 0, Math.round(frac * 8)))
          if (layers > 0) b.put(x, t + 1, z, P(`snow[layers=${layers}]`))
        }
      }
    }
    void sx
    void sz
    if (clipped) {
      b.clipped += clipped
      this.warnings.push(`land.paint: ${clipped} columns reach outside the canvas (y 0-${sy - 1}): lower the land or raise the canvas`)
    }
    if (spill) this.warnings.push(`land.paint: water at ${spill} places is not held in (a lower or empty neighbour): raise the shore or lower the level`)
    for (const w of this.warnings) b.warnings?.push?.(w)
    return (x, z) => this.top(x, z)
  }
}

// ------------------------------------------------------------------ helpers
// The texture of a mountain's flank, 0-1.5 times its smooth profile: ridged noise stretched down
// the slope (so the ridges run from the crest to the foot: spurs, with gullies between them) mixed
// with plain ridged noise (knobs, saddles, side crests). `a` runs along the crest, `c` down the slope.
function relief(a, c, x, z, spacing, rough, seed) {
  const w = fbm2(x, z, { scale: spacing * 2.5, octaves: 2, seed: seed + 9 }) * spacing * 0.8
  const spur = ridged2(a + w, c * 0.22, { scale: spacing, octaves: 4, seed: seed + 5 })
  const knob = ridged2(x, z, { scale: spacing * 1.3, octaves: 5, seed: seed + 3 })
  return 1 - rough + rough * (0.62 * spur + 0.38 * knob) * 1.55
}

// the inverse of the complementary error function (Giles' approximation), for share cut-offs
function inverfc(y) {
  const x = 1 - y
  const w = -Math.log((1 - x) * (1 + x))
  let p
  if (w < 5) {
    const v = w - 2.5
    p = 2.81022636e-8
    for (const c of [3.43273939e-7, -3.5233877e-6, -4.39150654e-6, 0.00021858087, -0.00125372503, -0.00417768164, 0.246640727, 1.50140941]) p = c + p * v
  } else {
    const v = Math.sqrt(w) - 3
    p = -0.000200214257
    for (const c of [0.000100950558, 0.00134934322, -0.00367342844, 0.00573950773, -0.0076224613, 0.00943887047, 1.00167406, 2.83297682]) p = c + p * v
  }
  return p * x
}

// a mountain's cross-section, 1 at the crest to 0 at the foot: concave at the foot ((1 - u)^sharp),
// rounded over the last few percent at the top (a convex crest, not a needle)
function profile(u, sharp) {
  const c = 0.06
  const uu = (Math.sqrt(u * u + c * c) - c) / (Math.sqrt(1 + c * c) - c)
  return (1 - uu) ** sharp
}

// ridged noise in 3D, 0-1 (sharp crests), for patterns on a circle
function ridged3(x, y, z, seed, octaves = 4) {
  let amp = 0.5
  let f = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i += 1) {
    const n = 1 - Math.abs(perlin3(x * f, y * f, z * f, seed + i * 131))
    sum += amp * n * n
    norm += amp
    amp *= 0.5
    f *= 2
  }
  return sum / norm
}

// what the surface of a column is: 'flat' | 'slope' | 'scree' | 'rock' | 'fan' | 'snow'
function classify(T, sl, v, dep, st, x, z, seed) {
  const n = fbm2(x, z, { scale: 16, octaves: 3, seed: seed + 29 })
  if (T.snow) {
    const line = st.min + st.relief * T.snow.line + n * 10 - sl * 4
    // snow lies on ledges and gentle slopes; steeper than about 48 degrees it slides off the rock
    if (v > line) return sl + n * 0.2 > 1.1 ? 'rock' : 'snow'
  }
  // the thresholds of terrain-research.md §2, each edge moved by a noise so no contour shows:
  // 30-44 degrees the slope mix, 44-51 scree, steeper bare rock
  const s = sl + n * 0.25
  if (s > 1.25) return 'rock'
  if (dep > 1.6 && s < 0.9 && s > 0.15) return 'fan'
  if (s > 0.95) return 'scree'
  if (s > 0.56) return 'slope'
  if (dep < -1.5 && s > 0.35) return 'scree' // a gully: bare and stony
  return 'flat'
}

function resolveTheme(theme) {
  const base = THEMES.temperate
  if (typeof theme === 'string') {
    if (!THEMES[theme]) throw new Error(`land: unknown theme '${theme}' (${Object.keys(THEMES).join(', ')}), or pass your own object`)
    return { ...base, ...THEMES[theme] }
  }
  return { ...base, ...theme }
}

// the rock bands: a sequence of bands 1-5 rows thick from the theme's rock weights, a pale line
// every 8-14 rows; a lookup by (warped) level
function strataTable(T, seed) {
  const rng = createRng(seed * 31 + 7)
  const total = T.rock.reduce((a, [, w]) => a + w, 0)
  const rocks = T.rock.map(([n, w]) => [parseBlock(ns(n)), w / total])
  const pale = T.pale ? parseBlock(ns(T.pale)) : null
  const rows = []
  let sincePale = 0
  let nextPale = 8 + Math.floor(rng() * 7)
  while (rows.length < 512) {
    if (pale && sincePale >= nextPale) {
      rows.push(pale)
      sincePale = 0
      nextPale = 8 + Math.floor(rng() * 7)
      continue
    }
    let u = rng()
    let blk = rocks.at(-1)[0]
    for (const [r, w] of rocks) {
      if (u < w) { blk = r; break }
      u -= w
    }
    const thick = 1 + Math.floor(rng() * 4)
    for (let k = 0; k < thick && rows.length < 512; k += 1) rows.push(blk)
    sincePale += thick
  }
  const main = rocks[0][0]
  return (y, x, z) => {
    const r = rows[((Math.floor(y) % 512) + 512) % 512]
    // a little coherent mottling of the main rock so wide faces are not flat stripes
    if (r === main && hash01(x, Math.floor(y), z, seed + 3) < 0.04) return rocks[Math.min(1, rocks.length - 1)][0]
    return r
  }
}

// cells near a path, with their distance, the share along it (0-1) and the side (+1 right, -1 left)
function pathDistance(land, p, reach) {
  const { W, D, x0, z0 } = land
  const d = new Float32Array(land.n).fill(Infinity)
  const t = new Float32Array(land.n)
  const side = new Int8Array(land.n)
  const touched = new Uint8Array(land.n)
  const cells = []
  const pts = p.points
  for (let k = 1; k < pts.length; k += 1) {
    const [ax, az] = pts[k - 1]
    const [bx, bz] = pts[k]
    const ex = bx - ax
    const ez = bz - az
    const len2 = ex * ex + ez * ez || 1
    const minX = Math.max(0, Math.floor(Math.min(ax, bx) - reach) - x0)
    const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + reach) - x0)
    const minZ = Math.max(0, Math.floor(Math.min(az, bz) - reach) - z0)
    const maxZ = Math.min(D - 1, Math.ceil(Math.max(az, bz) + reach) - z0)
    for (let iz = minZ; iz <= maxZ; iz += 1)
      for (let ix = minX; ix <= maxX; ix += 1) {
        const x = ix + x0
        const z = iz + z0
        const q = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / len2))
        const px = ax + ex * q
        const pz = az + ez * q
        const dist = Math.hypot(x - px, z - pz)
        if (dist > reach) continue
        const i = iz * W + ix
        if (!touched[i]) { touched[i] = 1; cells.push(i) }
        if (dist < d[i]) {
          d[i] = dist
          t[i] = (p.along[k - 1] + q * Math.sqrt(len2)) / p.length
          side[i] = ex * (z - az) - ez * (x - ax) > 0 ? 1 : -1
        }
      }
  }
  return { d, t, side, cells }
}

function signedDistance(shape) {
  if (shape.r !== undefined && shape.cx !== undefined) return (x, z) => Math.hypot(x - shape.cx, z - shape.cz) - shape.r
  if (shape.points) {
    const P = shape.points
    return (x, z) => {
      let inside = false
      let best = Infinity
      for (let i = 0, j = P.length - 1; i < P.length; j = i, i += 1) {
        const [xi, zi] = P[i]
        const [xj, zj] = P[j]
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
        const ex = xi - xj
        const ez = zi - zj
        const q = Math.max(0, Math.min(1, ((x - xj) * ex + (z - zj) * ez) / (ex * ex + ez * ez || 1)))
        best = Math.min(best, Math.hypot(x - xj - ex * q, z - zj - ez * q))
      }
      return inside ? -best : best
    }
  }
  const { x0, z0, x1, z1, round = 0 } = shape
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const hx = (x1 - x0) / 2 - round
  const hz = (z1 - z0) / 2 - round
  return (x, z) => {
    const qx = Math.abs(x - cx) - hx
    const qz = Math.abs(z - cz) - hz
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - round
  }
}

function boundsOf(shape, pad) {
  if (shape.r !== undefined) return [Math.floor(shape.cx - shape.r - pad), Math.floor(shape.cz - shape.r - pad), Math.ceil(shape.cx + shape.r + pad), Math.ceil(shape.cz + shape.r + pad)]
  if (shape.points) {
    const xs = shape.points.map(p => p[0])
    const zs = shape.points.map(p => p[1])
    return [Math.floor(Math.min(...xs) - pad), Math.floor(Math.min(...zs) - pad), Math.ceil(Math.max(...xs) + pad), Math.ceil(Math.max(...zs) + pad)]
  }
  return [Math.floor(shape.x0 - pad), Math.floor(shape.z0 - pad), Math.ceil(shape.x1 + pad), Math.ceil(shape.z1 + pad)]
}

// distance from each cell inside a mask to the nearest cell outside (chamfer 3-4, in blocks)
function distanceInside(mask, W, D) {
  const big = 1e9
  const d = new Float32Array(W * D)
  for (let i = 0; i < W * D; i += 1) d[i] = mask[i] ? big : 0
  for (let z = 0; z < D; z += 1)
    for (let x = 0; x < W; x += 1) {
      const i = z * W + x
      if (!d[i]) continue
      let v = d[i]
      if (x === 0 || z === 0 || x === W - 1 || z === D - 1) v = Math.min(v, 1)
      if (x > 0) v = Math.min(v, d[i - 1] + 1)
      if (z > 0) v = Math.min(v, d[i - W] + 1)
      if (x > 0 && z > 0) v = Math.min(v, d[i - W - 1] + 1.4142)
      if (x < W - 1 && z > 0) v = Math.min(v, d[i - W + 1] + 1.4142)
      d[i] = v
    }
  for (let z = D - 1; z >= 0; z -= 1)
    for (let x = W - 1; x >= 0; x -= 1) {
      const i = z * W + x
      if (!d[i]) continue
      let v = d[i]
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1)
      if (z < D - 1) v = Math.min(v, d[i + W] + 1)
      if (x < W - 1 && z < D - 1) v = Math.min(v, d[i + W + 1] + 1.4142)
      if (x > 0 && z < D - 1) v = Math.min(v, d[i + W - 1] + 1.4142)
      d[i] = v
    }
  return d
}

// droplet erosion on a normalised grid (after Hans Beyer 2015 and Sebastian Lague)
function erodeGrid(H, W, D, lock, o) {
  const R = o.radius
  const offX = []
  const offZ = []
  const offW = []
  let sum = 0
  for (let dz = -R; dz <= R; dz += 1)
    for (let dx = -R; dx <= R; dx += 1) {
      const dd = Math.hypot(dx, dz)
      if (dd >= R) continue
      offX.push(dx)
      offZ.push(dz)
      offW.push(1 - dd / R)
      sum += 1 - dd / R
    }
  for (let k = 0; k < offW.length; k += 1) offW[k] /= sum
  const rng = o.rng
  const hAt = (px, pz) => {
    const ix = px | 0
    const iz = pz | 0
    const u = px - ix
    const v = pz - iz
    const i = iz * W + ix
    return H[i] * (1 - u) * (1 - v) + H[i + 1] * u * (1 - v) + H[i + W] * (1 - u) * v + H[i + W + 1] * u * v
  }
  for (let it = 0; it < o.drops; it += 1) {
    let px = rng() * (W - 2)
    let pz = rng() * (D - 2)
    let dx = 0
    let dz = 0
    let speed = 1
    let water = 1
    let sed = 0
    for (let life = 0; life < o.lifetime; life += 1) {
      const ix = px | 0
      const iz = pz | 0
      const i = iz * W + ix
      const u = px - ix
      const v = pz - iz
      const a = H[i]
      const bb = H[i + 1]
      const c = H[i + W]
      const d = H[i + W + 1]
      if (Number.isNaN(a + bb + c + d)) break
      const gx = (bb - a) * (1 - v) + (d - c) * v
      const gz = (c - a) * (1 - u) + (d - bb) * u
      const hOld = a * (1 - u) * (1 - v) + bb * u * (1 - v) + c * (1 - u) * v + d * u * v
      dx = dx * o.inertia - gx * (1 - o.inertia)
      dz = dz * o.inertia - gz * (1 - o.inertia)
      const len = Math.hypot(dx, dz)
      if (len < 1e-12) {
        const ang = rng() * Math.PI * 2
        dx = Math.cos(ang)
        dz = Math.sin(ang)
      } else {
        dx /= len
        dz /= len
      }
      px += dx
      pz += dz
      if (px < 0 || pz < 0 || px >= W - 1 || pz >= D - 1) break
      const hNew = hAt(px, pz)
      if (Number.isNaN(hNew)) break
      const dh = hNew - hOld
      const cap = Math.max(-dh * speed * water * o.capacity, 0.01)
      if (sed > cap || dh > 0) {
        const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * o.deposition
        sed -= amt
        const k = 1 - lock[i]
        H[i] += amt * (1 - u) * (1 - v) * k
        H[i + 1] += amt * u * (1 - v) * k
        H[i + W] += amt * (1 - u) * v * k
        H[i + W + 1] += amt * u * v * k
      } else {
        const amt = Math.min((cap - sed) * o.erosion, -dh)
        for (let k = 0; k < offW.length; k += 1) {
          const jx = ix + offX[k]
          const jz = iz + offZ[k]
          if (jx < 0 || jz < 0 || jx >= W || jz >= D) continue
          const j = jz * W + jx
          if (Number.isNaN(H[j])) continue
          let w = amt * offW[k] * (1 - lock[j])
          if (H[j] - w < o.floor) w = Math.max(0, H[j] - o.floor)
          H[j] -= w
          sed += w
        }
      }
      speed = Math.sqrt(Math.max(0, speed * speed - dh * o.gravity))
      water *= 1 - o.evaporation
    }
  }
}

let COLORS = null
function blockColors() {
  COLORS ??= JSON.parse(fs.readFileSync(path.join(here, '../data/block-colors.json'), 'utf8'))
  return COLORS
}

function encodePng(W, H, rgb) {
  const raw = Buffer.alloc((W * 3 + 1) * H)
  for (let y = 0; y < H; y += 1) rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3)
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(zlib.crc32(td) >>> 0)
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))])
}

export const LAND_METHODS = { land: (b, opts) => new Land(b, opts) }
