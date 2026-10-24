// Organic generators: trees, bushes, boulders, terrain, scatter, paths, ponds, overgrowth.
// All take the Builder first and are installed as Builder methods.

import { DIR, isFullSolid, parseBlock } from './blocks.mjs'
import { coherent01, createRng, fbm2, fbm3, hash01 } from './noise.mjs'

const norm = v => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

function catmull(points, t) {
  const n = points.length
  const segs = n - 1
  const f = Math.min(segs - 1e-9, Math.max(0, t * segs))
  const i = Math.floor(f)
  const u = f - i
  const p0 = points[Math.max(0, i - 1)]
  const p1 = points[i]
  const p2 = points[i + 1]
  const p3 = points[Math.min(n - 1, i + 2)]
  return [0, 1, 2].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u))
}

const SPECIES = {
  oak: { log: 'oak_log', wood: 'oak_wood', leaves: ['oak_leaves'], height: [9, 13], trunk: 1.0, crown: 0.55, branches: [3, 5], spread: 0.45, rise: 0.55, blob: [2.6, 3.4], squash: 0.75, roots: 4 },
  big_oak: { log: 'oak_log', wood: 'oak_wood', leaves: ['oak_leaves', 'oak_leaves', 'azalea_leaves'], height: [15, 21], trunk: 1.9, crown: 0.45, branches: [5, 7], spread: 0.55, rise: 0.45, blob: [3.4, 4.6], squash: 0.7, roots: 6 },
  birch: { log: 'birch_log', wood: 'birch_wood', leaves: ['birch_leaves'], height: [11, 15], trunk: 0.5, crown: 0.6, branches: [4, 6], spread: 0.22, rise: 0.8, blob: [2.3, 3.0], squash: 1.0, roots: 0 },
  spruce: { log: 'spruce_log', wood: 'spruce_wood', leaves: ['spruce_leaves'], height: [14, 22], trunk: 0.9, conifer: true, roots: 3 },
  pine: { log: 'spruce_log', wood: 'spruce_wood', leaves: ['spruce_leaves'], height: [16, 24], trunk: 0.9, conifer: true, bareFraction: 0.5, radius: 4, roots: 3 },
  dark_oak: { log: 'dark_oak_log', wood: 'dark_oak_wood', leaves: ['dark_oak_leaves', 'dark_oak_leaves', 'oak_leaves'], height: [10, 14], trunk: 1.6, crown: 0.6, branches: [4, 6], spread: 0.6, rise: 0.3, blob: [3.2, 4.2], squash: 0.6, roots: 6 },
  cherry: { log: 'cherry_log', wood: 'cherry_wood', leaves: ['cherry_leaves'], height: [9, 12], trunk: 0.9, crown: 0.5, branches: [3, 5], spread: 0.7, rise: 0.35, blob: [2.8, 3.8], squash: 0.65, roots: 3, lean: 0.25, ground: 'minecraft:pink_petals[facing=north,flower_amount=4]' },
  willow: { log: 'oak_log', wood: 'oak_wood', leaves: ['oak_leaves', 'azalea_leaves'], height: [10, 13], trunk: 1.2, crown: 0.5, branches: [4, 6], spread: 0.6, rise: 0.25, blob: [3.0, 3.8], squash: 0.6, roots: 5, droop: true },
  jungle: { log: 'jungle_log', wood: 'jungle_wood', leaves: ['jungle_leaves'], height: [18, 26], trunk: 1.5, crown: 0.25, branches: [3, 5], spread: 0.5, rise: 0.4, blob: [3.2, 4.2], squash: 0.55, roots: 6, vines: true },
  acacia: { log: 'acacia_log', wood: 'acacia_wood', leaves: ['acacia_leaves'], height: [8, 11], trunk: 0.7, crown: 0.4, branches: [2, 3], spread: 0.9, rise: 0.55, blob: [3.0, 3.6], squash: 0.35, roots: 2, lean: 0.35 },
  azalea: { log: 'oak_log', wood: 'oak_wood', leaves: ['azalea_leaves', 'flowering_azalea_leaves'], height: [6, 8], trunk: 0.6, crown: 0.5, branches: [2, 3], spread: 0.5, rise: 0.4, blob: [2.2, 2.8], squash: 0.75, roots: 2 },
  mangrove: { log: 'mangrove_log', wood: 'mangrove_wood', leaves: ['mangrove_leaves'], height: [9, 12], trunk: 0.8, crown: 0.5, branches: [3, 5], spread: 0.5, rise: 0.45, blob: [2.8, 3.4], squash: 0.7, roots: 7, stilts: true },
  dead: { log: 'spruce_log', wood: 'spruce_wood', leaves: [], height: [8, 12], trunk: 0.8, crown: 0.6, branches: [3, 6], spread: 0.55, rise: 0.6, roots: 3, bare: true },
  fantasy: { log: 'dark_oak_log', wood: 'dark_oak_wood', leaves: ['azalea_leaves', 'flowering_azalea_leaves', 'oak_leaves'], height: [24, 34], trunk: 3.2, crown: 0.42, branches: [6, 9], spread: 0.6, rise: 0.35, blob: [4.5, 6.0], squash: 0.6, roots: 9, vines: true },
}

const ns = id => (id.includes(':') ? id : `minecraft:${id}`)

function woodPaint(spec, dir) {
  const d = norm(dir)
  const ax = Math.abs(d[0])
  const ay = Math.abs(d[1])
  const az = Math.abs(d[2])
  const m = Math.max(ax, ay, az)
  if (m < 0.82 && spec.wood) return ns(spec.wood)
  const axis = m === ay ? 'y' : m === ax ? 'x' : 'z'
  return `${ns(spec.log)}[axis=${axis}]`
}

// Draw a tapering limb along control points with log axis following the direction.
function limb(b, points, r0, r1, spec, { keep = false } = {}) {
  let length = 0
  for (let i = 1; i < points.length; i += 1) length += Math.hypot(...[0, 1, 2].map(k => points[i][k] - points[i - 1][k]))
  const samples = Math.max(2, Math.ceil(length * 3))
  let prev = points[0]
  let lastCell = null
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples
    const c = catmull(points, t)
    const next = catmull(points, Math.min(1, t + 1 / samples))
    const dir = i === samples ? [c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]] : [next[0] - c[0], next[1] - c[1], next[2] - c[2]]
    prev = c
    const r = r0 + (r1 - r0) * t
    const paint = woodPaint(spec, dir)
    if (r < 0.75) {
      // thin limb: face-connected walk from the previous sample so twigs never break apart
      const from = lastCell ?? [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]
      b.line(from, c, paint, { connect: 6, ...(keep ? { keep: true } : {}) })
      lastCell = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]
      continue
    }
    lastCell = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]
    const ri = Math.ceil(r)
    for (let x = Math.floor(c[0] - ri); x <= Math.ceil(c[0] + ri); x += 1)
      for (let y = Math.floor(c[1] - ri); y <= Math.ceil(c[1] + ri); y += 1)
        for (let z = Math.floor(c[2] - ri); z <= Math.ceil(c[2] + ri); z += 1) {
          if ((x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2 > r * r) continue
          const existing = b.get(x, y, z)
          if (existing && /_(log|wood)$/.test(existing.name)) continue
          b.set(x, y, z, paint)
        }
  }
}

// Noisy ellipsoid of leaves. Never overwrites wood. `mix` = secondary leaves share.
export function leafBlob(b, c, radii, leaves, { seed = 0, holes = 0.12, roughness = 0.28 } = {}) {
  const [rx, ry, rz] = radii
  const list = (Array.isArray(leaves) ? leaves : [leaves]).map(ns)
  const R = Math.ceil(Math.max(rx, ry, rz) * (1 + roughness)) + 1
  for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x += 1)
    for (let y = Math.floor(c[1] - R); y <= Math.ceil(c[1] + R); y += 1)
      for (let z = Math.floor(c[2] - R); z <= Math.ceil(c[2] + R); z += 1) {
        const d = Math.sqrt(((x - c[0]) / rx) ** 2 + ((y - c[1]) / ry) ** 2 + ((z - c[2]) / rz) ** 2)
        const wobble = 1 + roughness * fbm3(x, y, z, { scale: 3.2, octaves: 2, seed: seed + 3 })
        if (d > wobble) continue
        if (d > wobble - 0.35 && hash01(x, y, z, seed + 17) < holes) continue
        const existing = b.get(x, y, z)
        if (existing && !/_leaves$/.test(existing.name)) continue
        const pick = list.length === 1 ? list[0] : list[Math.min(list.length - 1, Math.floor(coherent01(x, y, z, { scale: 2.5, grain: 0.3, seed: seed + 29 }) * list.length))]
        b.set(x, y, z, `${pick}[persistent=true,distance=1,waterlogged=false]`)
      }
}

function hangStrand(b, x, y, z, length, kind = 'cave_vines') {
  for (let i = 0; i < length; i += 1) {
    if (b.get(x, y - i, z)) return
    const last = i === length - 1 || b.get(x, y - i - 1, z)
    if (kind === 'leaves') b.set(x, y - i, z, 'minecraft:oak_leaves[persistent=true,distance=1,waterlogged=false]')
    else b.set(x, y - i, z, last ? 'minecraft:cave_vines[age=25,berries=false]' : 'minecraft:cave_vines_plant[berries=false]')
    if (last) return
  }
}

// Custom tree. species: oak | big_oak | birch | spruce | pine | dark_oak | cherry | willow |
// jungle | acacia | azalea | mangrove | dead | fantasy. Override any preset field via opts
// (height, trunk radius, leaves list, log, wood, branches [min,max], blob [min,max], ...).
//   b.tree([x, y, z], 'oak', { seed: 3 })   // y = first log block (ground level + 1)
export function tree(b, base, species = 'oak', opts = {}) {
  const preset = { ...(SPECIES[species] ?? SPECIES.oak), ...opts }
  const rng = createRng((opts.seed ?? 0) * 977 + Math.round(base[0]) * 31 + Math.round(base[2]) * 17 + 5)
  const height = opts.height ?? rng.int(preset.height[0], preset.height[1])
  const [bx, by, bz] = base
  const leanAngle = rng() * Math.PI * 2
  const lean = (preset.lean ?? 0.12) * height
  const top = [bx + Math.cos(leanAngle) * lean, by + height, bz + Math.sin(leanAngle) * lean]
  const mid = [bx + Math.cos(leanAngle) * lean * 0.35 + rng.range(-0.6, 0.6), by + height * 0.5, bz + Math.sin(leanAngle) * lean * 0.35 + rng.range(-0.6, 0.6)]
  const trunkPts = [[bx, by, bz], mid, top]
  const r0 = preset.trunk
  const r1 = Math.max(0.5, preset.trunk * 0.45)

  if (preset.conifer) {
    limb(b, [[bx, by, bz], [bx, by + height - 1, bz]], r0 > 0.8 ? r0 : 0.5, 0.5, preset)
    const bare = preset.bareFraction ?? 0.18
    const crownStart = by + Math.floor(height * bare)
    const crownH = by + height - crownStart
    const maxR = opts.radius ?? Math.max(2.5, height * (preset.bareFraction ? 0.22 : 0.3))
    for (let y = crownStart; y <= by + height + 1; y += 1) {
      const t = (y - crownStart) / crownH
      const tier = (y - crownStart) % 3
      let r = maxR * (1 - t) ** 0.9 * (tier === 0 ? 1 : tier === 1 ? 0.72 : 0.5) + 0.5
      if (preset.bareFraction) r = maxR * (0.35 + 0.65 * Math.sin(Math.min(1, t * 0.95 + 0.05) * Math.PI * 0.85)) * (1 - t * 0.55) * (tier === 0 ? 1 : 0.75) + 0.6
      for (let x = Math.floor(bx - r - 1); x <= Math.ceil(bx + r + 1); x += 1)
        for (let z = Math.floor(bz - r - 1); z <= Math.ceil(bz + r + 1); z += 1) {
          const ang = Math.atan2(z - bz, x - bx)
          const rr = r * (1 + 0.18 * Math.sin(ang * 5 + y * 1.3 + (opts.seed ?? 0)))
          const d = Math.hypot(x - bx, z - bz)
          if (d > rr) continue
          if (d > rr - 0.8 && hash01(x, y, z, 77) < 0.3) continue
          b.set(x, y, z, `${ns(preset.leaves[0])}[persistent=true,distance=1,waterlogged=false]`, { keep: true })
        }
    }
    // tip leaf only when it sits on leaves (never a floating block)
    const under = b.get(bx, by + height + 1, bz)
    if (under && /_leaves$/.test(under.name)) b.set(bx, by + height + 2, bz, `${ns(preset.leaves[0])}[persistent=true,distance=1,waterlogged=false]`, { keep: true })
  } else {
    limb(b, trunkPts, r0, r1, preset)
  }

  // Root flare: short curved roots spreading and dipping into the ground.
  const roots = preset.roots ?? 0
  for (let i = 0; i < roots; i += 1) {
    const a = (i / roots) * Math.PI * 2 + rng.range(-0.3, 0.3)
    const len = r0 + rng.range(1.2, preset.stilts ? 4 : 2.6)
    const rise = preset.stilts ? rng.range(2.5, 4) : rng.range(0.6, 1.6)
    const pts = [
      [bx, by + rise, bz],
      [bx + Math.cos(a) * len * 0.55, by + rise * 0.45, bz + Math.sin(a) * len * 0.55],
      [bx + Math.cos(a) * len, by - (preset.stilts ? 1 : 0.4), bz + Math.sin(a) * len],
    ]
    limb(b, pts, Math.max(0.5, r0 * 0.6), 0.5, preset, { keep: true })
  }

  if (preset.conifer) return { top }

  // Branches.
  const count = opts.branchCount ?? rng.int(preset.branches[0], preset.branches[1])
  const tips = []
  const golden = 2.39996
  const startAngle = rng() * Math.PI * 2
  for (let i = 0; i < count; i += 1) {
    const t = 1 - preset.crown + (preset.crown * 0.9) * (count === 1 ? 0.5 : i / (count - 1)) + rng.range(-0.05, 0.05)
    const origin = catmull(trunkPts, Math.min(0.97, t))
    const az = startAngle + i * golden + rng.range(-0.35, 0.35)
    const len = height * preset.spread * rng.range(0.7, 1.1)
    const up = len * preset.rise * rng.range(0.7, 1.2)
    const end = [origin[0] + Math.cos(az) * len, origin[1] + up, origin[2] + Math.sin(az) * len]
    const bend = [origin[0] + Math.cos(az) * len * 0.45, origin[1] + up * 0.75 + rng.range(-0.5, 0.8), origin[2] + Math.sin(az) * len * 0.45]
    limb(b, [origin, bend, end], Math.max(0.5, r0 * 0.55), 0.5, preset)
    tips.push(end)
    // A twig or two for older trees.
    if (len > 5 && rng.chance(0.6)) {
      const tAz = az + rng.range(-1.1, 1.1)
      const tl = len * 0.4
      const tEnd = [bend[0] + Math.cos(tAz) * tl, bend[1] + tl * 0.6, bend[2] + Math.sin(tAz) * tl]
      limb(b, [bend, tEnd], 0.5, 0.5, preset)
      tips.push(tEnd)
    }
  }
  tips.push(top)

  if (preset.bare) {
    for (const tip of tips) {
      for (let k = 0; k < 2; k += 1) {
        const a = rng() * Math.PI * 2
        b.line(tip, [tip[0] + Math.cos(a) * 2, tip[1] + rng.range(0.5, 2), tip[2] + Math.sin(a) * 2], `${ns(preset.log.replace(/_log$/, '_fence'))}`, { keep: true })
      }
    }
    return { top, tips }
  }

  // Leaf clusters at every tip, plus a crown cluster.
  for (const [i, tip] of tips.entries()) {
    const r = rng.range(preset.blob[0], preset.blob[1]) * (i === tips.length - 1 ? 1.1 : 1)
    leafBlob(b, [tip[0], tip[1] + 0.5, tip[2]], [r, r * preset.squash, r], preset.leaves, { seed: (opts.seed ?? 0) + i * 13 })
  }

  if (preset.droop || preset.vines) {
    const reach = Math.max(...tips.map(t => Math.hypot(t[0] - bx, t[2] - bz))) + preset.blob[1]
    for (let x = Math.floor(bx - reach); x <= Math.ceil(bx + reach); x += 1)
      for (let z = Math.floor(bz - reach); z <= Math.ceil(bz + reach); z += 1) {
        const col = b.topY(x, z, '*_leaves')
        if (col < 0) continue
        let bottom = col
        while (bottom > 0 && b.get(x, bottom - 1, z) && /_leaves$/.test(b.get(x, bottom - 1, z).name)) bottom -= 1
        const chance = preset.droop ? 0.55 : 0.12
        if (hash01(x, bottom, z, 61) > chance) continue
        const len = preset.droop ? 2 + Math.floor(hash01(x, 0, z, 62) * (height * 0.55)) : 1 + Math.floor(hash01(x, 0, z, 63) * 5)
        hangStrand(b, x, bottom - 1, z, len, preset.droop && hash01(x, 1, z, 64) < 0.6 ? 'leaves' : 'cave_vines')
      }
  }

  if (preset.ground) {
    for (let i = 0; i < 18; i += 1) {
      const a = rng() * Math.PI * 2
      const d = rng.range(1.5, height * 0.6)
      const x = Math.round(bx + Math.cos(a) * d)
      const z = Math.round(bz + Math.sin(a) * d)
      if (!b.get(x, by, z) && b.get(x, by - 1, z)) b.set(x, by, z, preset.ground)
    }
  }
  return { top, tips }
}

// Small shrub: a squat leaf blob with an optional log heart.
export function bush(b, base, { radius = 1.6, leaves = ['oak_leaves', 'azalea_leaves'], log = 'oak_log', seed = 0 } = {}) {
  const [x, y, z] = base
  if (log) b.set(x, y, z, `${ns(log)}[axis=y]`)
  leafBlob(b, [x, y + radius * 0.35, z], [radius, radius * 0.75, radius], leaves, { seed, holes: 0.18 })
  return b
}

// Natural rock: noise-displaced ellipsoid painted with a paint (use a palette/gradient).
//   b.boulder([x, y, z], [4, 3, 3.5], kit.palette({ stone: 5, andesite: 3, cobblestone: 2, mossy_cobblestone: 1 }))
export function boulder(b, c, radii, paint = 'minecraft:stone', { seed = 0, roughness = 0.3, mossTop: mossOpt } = {}) {
  const mossTop = mossOpt === true ? 'minecraft:moss_block' : mossOpt
  const r = Array.isArray(radii) ? radii : [radii, radii * 0.75, radii]
  const R = Math.ceil(Math.max(...r) * (1 + roughness)) + 1
  for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x += 1)
    for (let y = Math.floor(c[1] - R); y <= Math.ceil(c[1] + R); y += 1)
      for (let z = Math.floor(c[2] - R); z <= Math.ceil(c[2] + R); z += 1) {
        const d = Math.sqrt(((x - c[0]) / r[0]) ** 2 + ((y - c[1]) / r[1]) ** 2 + ((z - c[2]) / r[2]) ** 2)
        if (d > 1 + roughness * fbm3(x, y, z, { scale: 4, octaves: 3, seed: seed + 41 })) continue
        b.set(x, y, z, paint)
      }
  if (mossTop) {
    for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x += 1)
      for (let z = Math.floor(c[2] - R); z <= Math.ceil(c[2] + R); z += 1) {
        const y = b.topY(x, z)
        if (y < 0 || y < c[1]) continue
        if (coherent01(x, y, z, { scale: 3, seed: seed + 5 }) < 0.55) b.set(x, y, z, mossTop)
      }
  }
  return b
}

// Height-field terrain over [x0..x1] × [z0..z1].
//   b.terrain({ x0, z0, x1, z1, base: 0, height: (x, z) => 4 + 3 * kit.noise.fbm2(x, z, { scale: 24 }),
//               layers: [{ depth: 1, paint: 'grass_block' }, { depth: 3, paint: 'dirt' }, { paint: 'stone' }] })
// Returns a heightmap function (x, z) → surface y.
export function terrain(b, { x0 = 0, z0 = 0, x1, z1, base = 0, height, layers, surface } = {}) {
  x1 ??= b.size[0] - 1
  z1 ??= b.size[2] - 1
  const L = layers ?? [{ depth: 1, paint: 'minecraft:grass_block' }, { depth: 3, paint: 'minecraft:dirt' }, { paint: 'minecraft:stone' }]
  const heights = new Map()
  for (let x = x0; x <= x1; x += 1) {
    for (let z = z0; z <= z1; z += 1) {
      const h = Math.round(typeof height === 'function' ? height(x, z) : height ?? base + 3)
      heights.set(`${x},${z}`, h)
      for (let y = base; y <= h; y += 1) {
        const depth = h - y
        let acc = 0
        let paint = L[L.length - 1].paint
        for (const layer of L) {
          if (layer.depth === undefined) {
            paint = layer.paint
            break
          }
          if (depth < acc + layer.depth) {
            paint = layer.paint
            break
          }
          acc += layer.depth
        }
        if (depth === 0 && surface) paint = surface
        b.set(x, y, z, paint)
      }
    }
  }
  return (x, z) => heights.get(`${Math.round(x)},${Math.round(z)}`) ?? base
}

// Place decorations on top of surface blocks. paints: [[weight, block], ...]; two-block
// plants (tall_grass, large_fern, rose_bush, lilac, peony, sunflower) get both halves.
//   b.scatter({ x0, z0, x1, z1, on: ['grass_block'], density: 0.25, paints: [[6, 'short_grass'], [2, 'tall_grass'], [1, 'poppy']] })
export function scatter(b, { x0 = 0, z0 = 0, x1, z1, on = ['minecraft:grass_block', 'minecraft:moss_block'], density = 0.2, paints, seed = 0, clump = 6 } = {}) {
  x1 ??= b.size[0] - 1
  z1 ??= b.size[2] - 1
  const TALL = /(tall_grass|large_fern|rose_bush|lilac|peony|sunflower|pitcher_plant|tall_seagrass)$/
  const total = paints.reduce((s, [w]) => s + w, 0)
  for (let x = x0; x <= x1; x += 1) {
    for (let z = z0; z <= z1; z += 1) {
      const y = b.topY(x, z)
      if (y < 0 || y + 1 >= b.size[1]) continue
      const ground = b.get(x, y, z)
      if (!b.matches(ground, on)) continue
      const local = density * (0.4 + 1.2 * coherent01(x, 0, z, { scale: clump, seed: seed + 91 }))
      if (hash01(x, y, z, seed + 92) > local) continue
      let n = hash01(x, y, z, seed + 93) * total
      let pick = paints[paints.length - 1][1]
      for (const [w, p] of paints) {
        if (n < w) {
          pick = p
          break
        }
        n -= w
      }
      const id = parseBlock(pick).name
      if (TALL.test(id)) {
        if (y + 2 >= b.size[1] || b.get(x, y + 2, z)) continue
        b.set(x, y + 1, z, `${id}[half=lower]`)
        b.set(x, y + 2, z, `${id}[half=upper]`)
      } else {
        b.set(x, y + 1, z, pick)
      }
    }
  }
  return b
}

// Paint a winding path onto the top surface along 2D control points [[x, z], ...].
const PLANTISH = /(short_grass|tall_grass|fern|_flower|dandelion|poppy|orchid|allium|bluet|tulip|daisy|cornflower|lily_of_the_valley|rose_bush|lilac|peony|sunflower|_sapling|moss_carpet|_carpet|snow|dead_bush|sweet_berry_bush|pink_petals|vine|lichen|mushroom)$/
const TERRAIN = ['minecraft:grass_block', 'minecraft:dirt', 'minecraft:coarse_dirt', 'minecraft:podzol', 'minecraft:rooted_dirt', 'minecraft:mud', 'minecraft:moss_block', 'minecraft:dirt_path', 'minecraft:gravel', 'minecraft:sand', 'minecraft:red_sand', 'minecraft:snow_block', 'minecraft:stone', 'minecraft:andesite', 'minecraft:mycelium', 'minecraft:packed_mud', 'minecraft:clay']

export function path(b, points, { width = 3, paint = 'minecraft:dirt_path', jitter = 0.6, seed = 0, on = TERRAIN } = {}) {
  const pts = points.map(p => [p[0], 0, p[1]])
  let length = 0
  for (let i = 1; i < pts.length; i += 1) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2])
  const samples = Math.ceil(length * 2)
  const done = new Set()
  for (let i = 0; i <= samples; i += 1) {
    const c = catmull(pts, i / samples)
    const w = width / 2 + jitter * (fbm2(c[0], c[2], { scale: 6, seed: seed + 7 }))
    for (let x = Math.floor(c[0] - w - 1); x <= Math.ceil(c[0] + w + 1); x += 1)
      for (let z = Math.floor(c[2] - w - 1); z <= Math.ceil(c[2] + w + 1); z += 1) {
        if (Math.hypot(x - c[0], z - c[2]) > w) continue
        const key = `${x},${z}`
        if (done.has(key)) continue
        done.add(key)
        // walk down through plants/carpets to the ground; only paint terrain blocks so
        // paths never overwrite lanterns, fences or building parts
        let y = b.topY(x, z)
        while (y > 0 && b.get(x, y, z) && PLANTISH.test(b.get(x, y, z).name)) y -= 1
        if (y < 0 || !b.matches(b.get(x, y, z), on)) continue
        for (let k = y + 1; k <= y + 2; k += 1) if (b.get(x, k, z) && PLANTISH.test(b.get(x, k, z).name)) b.remove(x, k, z)
        b.set(x, y, z, paint)
      }
  }
  return b
}

// Pond: carve a bowl into the terrain and fill with water up to `level`.
export function pond(b, center, radius, { depth = 2, rim = 'minecraft:gravel', bed = 'minecraft:clay', seed = 0 } = {}) {
  const [cx, level, cz] = center
  for (let x = Math.floor(cx - radius - 2); x <= Math.ceil(cx + radius + 2); x += 1)
    for (let z = Math.floor(cz - radius - 2); z <= Math.ceil(cz + radius + 2); z += 1) {
      const d = Math.hypot(x - cx, z - cz) / (radius * (1 + 0.2 * fbm2(x, z, { scale: 5, seed })))
      if (d > 1.25) continue
      if (d > 1) {
        if (b.get(x, level, z)) b.set(x, level, z, rim)
        continue
      }
      const bottom = level - Math.max(1, Math.round(depth * (1 - d * d)))
      for (let y = level + 1; y <= level + 3; y += 1) b.remove(x, y, z)
      for (let y = bottom + 1; y <= level; y += 1) b.set(x, y, z, 'minecraft:water')
      b.set(x, bottom, z, d > 0.75 ? rim : bed)
    }
  return b
}

// Vines/moss growing on exposed wall faces inside a box (ruins, old towers, cliffs).
export function overgrow(b, a, c, { amount = 0.25, maxLength = 5, moss = true, seed = 0 } = {}) {
  const min = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])]
  const max = [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])]
  for (const [x, y, z, block] of b.entries()) {
    if (x < min[0] || y < min[1] || z < min[2] || x > max[0] || y > max[1] || z > max[2]) continue
    if (!isFullSolid(block.name)) continue
    if (moss && !b.get(x, y + 1, z) && coherent01(x, y, z, { scale: 4, seed: seed + 3 }) < amount * 0.8) {
      b.set(x, y + 1, z, 'minecraft:moss_carpet', { keep: true })
    }
    for (const side of ['north', 'east', 'south', 'west']) {
      const d = DIR[side]
      const px = x + d[0]
      const pz = z + d[2]
      if (b.get(px, y, pz) || b.get(px, y + 1, pz)) continue
      if (coherent01(x, y, z, { scale: 5, seed: seed + 11 }) > amount) continue
      if (hash01(x, y, z, seed + 12) > 0.35) continue
      const attach = { north: 'south', south: 'north', east: 'west', west: 'east' }[side]
      const len = 1 + Math.floor(hash01(px, y, pz, seed + 13) * maxLength)
      for (let i = 0; i < len; i += 1) {
        if (b.get(px, y - i, pz)) break
        const wall = b.get(x, y - i, z)
        if (!wall || !isFullSolid(wall.name)) break
        b.set(px, y - i, pz, `minecraft:vine[${attach}=true]`)
      }
    }
  }
  return b
}

// Floating island: flat top disc and a tapered, noise-eroded underside.
export function island(b, center, radius, { depth, top = 'minecraft:grass_block', soil = 'minecraft:dirt', rock = 'minecraft:stone', seed = 0 } = {}) {
  const [cx, cy, cz] = center
  const D = depth ?? Math.round(radius * 1.1)
  for (let y = cy - D; y <= cy; y += 1) {
    const f = (y - (cy - D)) / D
    const r = radius * Math.pow(Math.max(f, 0.02), 0.55)
    for (let x = Math.floor(cx - r - 3); x <= Math.ceil(cx + r + 3); x += 1)
      for (let z = Math.floor(cz - r - 3); z <= Math.ceil(cz + r + 3); z += 1) {
        const rr = r * (1 + 0.22 * fbm3(x, y, z, { scale: 6, seed: seed + 2 }))
        if (Math.hypot(x - cx, z - cz) > rr) continue
        const depthBelowTop = cy - y
        const paint = depthBelowTop === 0 ? top : depthBelowTop <= 3 ? soil : rock
        b.set(x, y, z, paint)
      }
  }
  return b
}

export const NATURE_METHODS = { tree, bush, leafBlob, boulder, terrain, scatter, path, pond, overgrow, island }
export const TREE_SPECIES = Object.keys(SPECIES)
