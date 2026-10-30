// Forest systems and algorithmic trees. Builder-first functions (like nature.mjs):
//
//   spaceColonizationTree(b, [x, y, z], opts)  natural broadleaf crowns (Runions et al. 2007)
//   foresterTree(b, [x, y, z], opts)           MCEdit Forester port: 'round' deciduous / 'cone' conifer
//   forest(b, { x0, z0, x1, z1, ground, species, density, minSpacing, clearings, seed, sizes })
//
// `base` is always the first log (ground + 1). Leaves are written persistent.
// Guide: references/building/nature.md (§1.8, §1.10).

import { parseBlock } from './blocks.mjs'
import { bush, leafBlob, tree as presetTree, TREE_SPECIES } from './nature.mjs'
import { coherent01, createRng, hash01 } from './noise.mjs'

const ns = id => (String(id).includes(':') ? String(id) : `minecraft:${id}`)
const leafState = id => `${parseBlock(ns(id)).name}[persistent=true,distance=1,waterlogged=false]`
const TAU = Math.PI * 2

function axisOf(d) {
  const ax = Math.abs(d[0])
  const ay = Math.abs(d[1])
  const az = Math.abs(d[2])
  if (ay >= ax && ay >= az) return 'y'
  return ax >= az ? 'x' : 'z'
}

// Wood paint for a segment: logs along mostly-vertical runs, bark-all-round wood elsewhere.
function woodFor(log, wood, d) {
  const len = Math.hypot(d[0], d[1], d[2]) || 1
  if (Math.abs(d[1]) / len > 0.82) return `${parseBlock(ns(log)).name}[axis=y]`
  if (wood) return `${parseBlock(ns(wood)).name}[axis=${axisOf(d)}]`
  return `${parseBlock(ns(log)).name}[axis=${axisOf(d)}]`
}

// One limb segment from a to c with radius r0 -> r1. Thin limbs are connected voxel lines.
function segment(b, a, c, r0, r1, log, wood) {
  const d = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const paint = woodFor(log, wood, d)
  const r = Math.max(r0, r1)
  if (r < 0.8) {
    b.line(a, c, paint)
    return
  }
  const steps = Math.max(1, Math.ceil(Math.hypot(d[0], d[1], d[2]) * 2))
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const p = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t]
    const rr = r0 + (r1 - r0) * t
    const R = Math.ceil(rr)
    for (let x = Math.floor(p[0] - R); x <= Math.ceil(p[0] + R); x += 1)
      for (let y = Math.floor(p[1] - R); y <= Math.ceil(p[1] + R); y += 1)
        for (let z = Math.floor(p[2] - R); z <= Math.ceil(p[2] + R); z += 1) {
          if ((x - p[0]) ** 2 + (y - p[1]) ** 2 + (z - p[2]) ** 2 > rr * rr) continue
          b.set(x, y, z, paint)
        }
  }
}

// Short roots spreading from the trunk base and dipping into the soil.
function rootFlare(b, [x, y, z], count, reach, log, wood, rng) {
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * TAU + rng.range(-0.35, 0.35)
    const len = reach * rng.range(0.7, 1.15)
    const end = [x + Math.cos(a) * len, y - 1, z + Math.sin(a) * len]
    segment(b, [x, y + rng.range(0.5, 1.5), z], end, 0.5, 0.5, log, wood ?? log)
  }
}

// Leaf pick from a list: clumped mix (main type dominates, accents in patches).
function leafPaint(list, seed) {
  const states = list.map(leafState)
  if (states.length === 1) return () => states[0]
  return (x, y, z) => states[Math.min(states.length - 1, Math.floor(coherent01(x, y, z, { scale: 2.5, grain: 0.3, seed: seed + 29 }) * states.length))]
}

const SPECIES_LOOK = {
  oak: { log: 'oak_log', wood: 'oak_wood', leaves: ['oak_leaves', 'oak_leaves', 'azalea_leaves'] },
  birch: { log: 'birch_log', wood: 'birch_wood', leaves: ['birch_leaves', 'birch_leaves', 'oak_leaves'] },
  dark_oak: { log: 'dark_oak_log', wood: 'dark_oak_wood', leaves: ['dark_oak_leaves', 'dark_oak_leaves', 'oak_leaves'] },
  spruce: { log: 'spruce_log', wood: 'spruce_wood', leaves: ['spruce_leaves'] },
  jungle: { log: 'jungle_log', wood: 'jungle_wood', leaves: ['jungle_leaves', 'oak_leaves'] },
  acacia: { log: 'acacia_log', wood: 'acacia_wood', leaves: ['acacia_leaves'] },
  cherry: { log: 'cherry_log', wood: 'cherry_wood', leaves: ['cherry_leaves'] },
  mangrove: { log: 'mangrove_log', wood: 'mangrove_wood', leaves: ['mangrove_leaves'] },
}

function look(opts, fallback = 'oak') {
  const base = SPECIES_LOOK[opts.species ?? fallback] ?? SPECIES_LOOK.oak
  return {
    log: opts.log ?? base.log,
    wood: opts.wood ?? base.wood,
    leaves: Array.isArray(opts.leaves) ? opts.leaves : opts.leaves ? [opts.leaves] : base.leaves,
  }
}

// ------------------------------------------------------------------ space colonization

// Broadleaf tree grown toward attractor points scattered in a crown ellipsoid.
//   spaceColonizationTree(b, [x, y, z], { height: 18, species: 'oak' })
//   spaceColonizationTree(b, base, { height: 14, crown: [9, 4, 9], log: 'acacia_log', wood: 'acacia_wood', leaves: ['acacia_leaves'] })
// Options: height (overall, default 18), trunkHeight (default 0.38 * height), crown [rx, ry, rz]
// (default scales with height), crownY (centre above base, default 0.7 * height), attractors
// (default 700), attractDist 8, killDist 2.5, segment 1, pipeExp 2.5, tipRadius 0.4,
// maxRadius (default clamp(height / 14, 0.8, 1.6)), cluster [rx, ry, rz] leaf blob per tip
// (default [2.3, 1.7, 2.3]), roots (count, default 4), seed. Returns the tip positions.
export function spaceColonizationTree(b, base, opts = {}) {
  const { log, wood, leaves } = look(opts)
  const seed = opts.seed ?? 0
  const rng = createRng(seed * 7919 + Math.round(base[0]) * 31 + Math.round(base[2]) * 17 + 3)
  const height = opts.height ?? 18
  const trunkH = Math.max(2, Math.round(opts.trunkHeight ?? height * 0.38))
  const slender = opts.species === 'birch'                       // birches: thin trunk, narrow crown
  const radii = opts.crown ?? (slender ? [height * 0.24, height * 0.34, height * 0.24] : [height * 0.39, height * 0.3, height * 0.39])
  const crownY = opts.crownY ?? height * 0.7
  const count = opts.attractors ?? 700
  const attract = opts.attractDist ?? 8
  const kill = opts.killDist ?? 2.5
  const seg = opts.segment ?? 1
  const pipe = opts.pipeExp ?? 2.5
  const tipR = opts.tipRadius ?? 0.4
  const maxR = opts.maxRadius ?? (slender ? 0.5 : Math.max(0.8, Math.min(1.6, height / 14)))
  const [x0, y0, z0] = base
  const lean = [rng.range(-0.15, 0.15), rng.range(-0.15, 0.15)]
  const centre = [x0 + lean[0] * height, y0 + crownY, z0 + lean[1] * height]

  // 1. attractors, biased toward the envelope surface (sin^0.8 radial correction)
  const pts = []
  while (pts.length < count) {
    const u = [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]
    const len = Math.hypot(u[0], u[1], u[2])
    if (len > 1 || len < 1e-6) continue
    const k = Math.pow(Math.sin(rng() * Math.PI / 2), 0.8) / len
    pts.push([centre[0] + u[0] * k * radii[0], centre[1] + u[1] * k * radii[1], centre[2] + u[2] * k * radii[2]])
  }
  // 2. trunk nodes
  const nodes = [{ p: [x0, y0 - 1, z0], parent: -1, kids: 0 }]
  for (let i = 1; i <= trunkH + 1; i += 1) {
    const t = i / (trunkH + 1)
    nodes.push({ p: [x0 + lean[0] * height * t * 0.5, y0 - 1 + i, z0 + lean[1] * height * t * 0.5], parent: nodes.length - 1, kids: 0 })
    nodes[nodes.length - 2].kids += 1
  }
  // 3. colonize (grid-bucketed nearest-node search)
  const alive = new Uint8Array(pts.length).fill(1)
  const cell = Math.max(2, Math.ceil(attract))
  const grid = new Map()
  const gkey = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`
  const addNode = i => {
    const k = gkey(...nodes[i].p)
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k).push(i)
  }
  nodes.forEach((_, i) => addNode(i))
  for (let iter = 0; iter < 160; iter += 1) {
    const pull = new Map()
    for (let ai = 0; ai < pts.length; ai += 1) {
      if (!alive[ai]) continue
      const a = pts[ai]
      const cx = Math.floor(a[0] / cell)
      const cy = Math.floor(a[1] / cell)
      const cz = Math.floor(a[2] / cell)
      let best = -1
      let bd = attract
      let dead = false
      for (let dx = -1; dx <= 1 && !dead; dx += 1)
        for (let dy = -1; dy <= 1 && !dead; dy += 1)
          for (let dz = -1; dz <= 1 && !dead; dz += 1) {
            const list = grid.get(`${cx + dx},${cy + dy},${cz + dz}`)
            if (!list) continue
            for (const ni of list) {
              const p = nodes[ni].p
              const d = Math.hypot(a[0] - p[0], a[1] - p[1], a[2] - p[2])
              if (d < kill) {
                dead = true
                break
              }
              if (d < bd) {
                bd = d
                best = ni
              }
            }
          }
      if (dead) {
        alive[ai] = 0
        continue
      }
      if (best < 0) continue
      const p = nodes[best].p
      const acc = pull.get(best) ?? [0, 0, 0]
      pull.set(best, [acc[0] + (a[0] - p[0]) / bd, acc[1] + (a[1] - p[1]) / bd, acc[2] + (a[2] - p[2]) / bd])
    }
    if (pull.size === 0) break
    for (const [ni, acc] of pull) {
      const d = [acc[0] + rng.range(-0.15, 0.15), acc[1] + rng.range(-0.15, 0.15) + 0.15, acc[2] + rng.range(-0.15, 0.15)]
      const L = Math.hypot(d[0], d[1], d[2]) || 1
      const p = nodes[ni].p
      nodes.push({ p: [p[0] + (d[0] / L) * seg, p[1] + (d[1] / L) * seg, p[2] + (d[2] / L) * seg], parent: ni, kids: 0 })
      nodes[ni].kids += 1
      addNode(nodes.length - 1)
    }
  }
  // 4. pipe-model radii, tips -> root
  const rad = new Float64Array(nodes.length)
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    if (nodes[i].kids === 0) rad[i] = tipR
    const par = nodes[i].parent
    if (par >= 0) rad[par] = Math.pow(rad[par] ** pipe + rad[i] ** pipe, 1 / pipe)
  }
  // 5. wood, roots, leaves
  for (let i = 1; i < nodes.length; i += 1) {
    const n = nodes[i]
    const r0 = Math.min(rad[n.parent], maxR)
    const r1 = Math.min(rad[i], maxR)
    segment(b, nodes[n.parent].p, n.p, r0 < 0.8 ? 0.5 : r0, r1 < 0.8 ? 0.5 : r1, log, wood)
  }
  rootFlare(b, base, opts.roots ?? 4, 1.5 + maxR * 1.5, log, wood, rng)
  const tips = nodes.filter(n => n.kids === 0).map(n => n.p)
  const cl = opts.cluster ?? [2.3, 1.7, 2.3]
  tips.forEach((t, i) => leafBlob(b, [t[0], t[1] + 0.2, t[2]], cl, leaves, { seed: seed + i * 7, holes: 0.1, roughness: 0.25 }))
  return tips
}

// ------------------------------------------------------------------ Forester port

// Round disc perpendicular to an axis, Forester's (|o|+0.5)^2 test (no single-block nubs).
function crossSection(b, c, r, axis, paint, keepLeaves = false) {
  const R = Math.ceil(r + 0.618)
  const [i1, i2] = axis === 'y' ? [0, 2] : axis === 'x' ? [1, 2] : [0, 1]
  for (let o1 = -R; o1 <= R; o1 += 1)
    for (let o2 = -R; o2 <= R; o2 += 1) {
      if ((Math.abs(o1) + 0.5) ** 2 + (Math.abs(o2) + 0.5) ** 2 > r * r) continue
      const p = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]
      p[i1] += o1
      p[i2] += o2
      if (keepLeaves) {
        const existing = b.get(p[0], p[1], p[2])
        if (existing && !/_leaves$/.test(existing.name)) continue
      }
      b.set(p[0], p[1], p[2], paint)
    }
}

// Tapered cylinder stepping along the dominant axis (Forester's taperedcylinder).
function tapered(b, a, c, r0, r1, log, wood) {
  const d = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const prim = [0, 1, 2].reduce((m, k) => (Math.abs(d[k]) > Math.abs(d[m]) ? k : m), 0)
  const n = Math.abs(Math.round(d[prim]))
  if (n === 0) return
  const axis = ['x', 'y', 'z'][prim]
  const paint = woodFor(log, wood, d)
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    const p = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t]
    const r = r1 + (r0 - r1) * (1 - t)
    if (r < 0.75) b.set(p[0], p[1], p[2], paint)
    else crossSection(b, p, r, axis, paint)
  }
}

// MCEdit Forester ProceduralTree. shape: 'round' (deciduous, default) | 'cone' (conifer).
//   foresterTree(b, [x, y, z], { height: 18, shape: 'round', species: 'oak' })
//   foresterTree(b, base, { height: 20, shape: 'cone', species: 'spruce' })
// Options: height, shape, trunkThickness (1.0), trunkHeight (round: fraction where the crown
// starts, 0.7), branchDensity (1.0), foliageDensity (1.0), buttresses (true), log/wood/leaves,
// light (block id placed in each cluster heart, e.g. 'shroomlight'), seed. Returns cluster centres.
export function foresterTree(b, base, opts = {}) {
  const shape = opts.shape ?? 'round'
  const { log, wood, leaves } = look(opts, shape === 'cone' ? 'spruce' : 'oak')
  const seed = opts.seed ?? 0
  const rng = createRng(seed * 104729 + Math.round(base[0]) * 13 + Math.round(base[2]) * 7 + 11)
  const H = opts.height ?? 18
  const S = shape === 'cone'
    ? { slope: 0.15, foliage: [3, 2.6, 2, 1], trunkMul: 0.5, trunkFrac: 1 }
    : { slope: 0.382, foliage: [2, 3, 3, 2.5, 1.6], trunkMul: 0.8, trunkFrac: opts.trunkHeight ?? 0.7 }
  const trunkR = Math.max(1, 0.618 * Math.sqrt(H * (opts.trunkThickness ?? 1))) * S.trunkMul
  const trunkH = H * S.trunkFrac
  const bd = (opts.branchDensity ?? 1) / (opts.foliageDensity ?? 1)
  const [bx, by, bz] = base
  const shapefunc = y => {
    if (rng() < 100 / (H * H) && y < trunkH) return H * 0.12
    if (shape === 'cone') {
      if (y < H * (0.25 + 0.05 * Math.sqrt(rng()))) return null
      return Math.max(0, (H - y) * 0.382)
    }
    if (y < H * (0.282 + 0.1 * Math.sqrt(rng()))) return null
    const R = H / 2
    const adj = R - y
    return (Math.abs(adj) >= R ? 0 : Math.sqrt(R * R - adj * adj)) * 0.618
  }
  const perY = Math.max(1, Math.floor(1.5 + ((opts.foliageDensity ?? 1) * H / 19) ** 2))
  const clusters = []
  for (let y = Math.round(H); y > 0; y -= 1)
    for (let i = 0; i < perY; i += 1) {
      const f = shapefunc(y)
      if (f === null) continue
      const rr = (Math.sqrt(rng()) + 0.328) * f
      const th = rng() * TAU
      clusters.push([bx + Math.round(rr * Math.sin(th)), by - 1 + y, bz + Math.round(rr * Math.cos(th))])
    }
  // trunk: two tapered sections, optional root buttresses
  const topY = by - 1 + Math.round(trunkH)
  const midY = by - 1 + Math.round(trunkH * 0.382)
  const endR = Math.max(1, trunkR * (1 - trunkH / H))
  const midR = Math.max(endR, trunkR * (1 - (trunkH / H) * 0.5))
  let startR = trunkR
  if (opts.buttresses ?? true) {
    startR = trunkR * 0.8
    const nb = Math.floor(Math.sqrt(trunkR) + 3.5)
    for (let i = 0; i < nb; i += 1) {
      const a = rng() * TAU
      const pr = trunkR * (0.9 + rng() * 0.2)
      const br = Math.max(1, trunkR * 0.382 * (0.618 + rng()))
      tapered(b, [bx + Math.round(pr * Math.sin(a)), by - 1, bz + Math.round(pr * Math.cos(a))], [bx, midY, bz], br * 0.7, br * 0.7, log, wood)
    }
  }
  tapered(b, [bx, by - 1, bz], [bx, midY, bz], startR * 0.75, midR * 0.75, log, wood)
  tapered(b, [bx, midY, bz], [bx, topY, bz], midR * 0.75, endR * 0.75, log, wood)
  // branches: probability falls off with (ydist + dist)^3 (Forester's tuned magic number 220)
  for (const c of clusters) {
    const dist = Math.hypot(c[0] - bx, c[2] - bz)
    const ydist = c[1] - by
    if ((bd * 220 * H) / Math.max(1, ydist + dist) ** 3 < rng()) continue
    const slope = S.slope + (0.5 - rng()) * 0.16
    let branchY
    let baseSize
    if (c[1] - dist * slope > topY) {
      if (rng() < 1 / H) continue
      branchY = topY
      baseSize = endR
    } else {
      branchY = c[1] - dist * slope
      baseSize = endR + ((trunkR - endR) * (topY - branchY)) / Math.max(1, trunkH)
    }
    const startSize = Math.max(0.5, baseSize * (1 + rng()) * 0.618 * (dist / H) ** 0.618)
    tapered(b, [bx, Math.round(branchY), bz], c, startSize * 0.75, 0.5, log, wood)
  }
  // foliage: stacked discs (flat bottom, rounded top) with a wood heart
  const paint = leafPaint(leaves, seed)
  for (const c of clusters) {
    S.foliage.forEach((r, i) => crossSection(b, [c[0], c[1] + i, c[2]], r + rng.range(-0.3, 0.3), 'y', paint, true))
  }
  for (const c of clusters) {
    b.set(c[0], c[1], c[2], woodFor(log, wood, [0, 1, 0]))
    if (opts.light) b.set(c[0], c[1] + 1, c[2], opts.light)
  }
  return clusters
}

// ------------------------------------------------------------------ forest

// Nominal heights of the b.tree presets (mid of each preset's range) used for size classes.
const PRESET_HEIGHT = { oak: 11, big_oak: 18, birch: 13, spruce: 18, pine: 20, dark_oak: 12, cherry: 10, willow: 11, jungle: 22, acacia: 9, azalea: 7, mangrove: 10, dead: 10, fantasy: 28 }
const SMALLER = { big_oak: 'oak', fantasy: 'big_oak', jungle: 'jungle', dark_oak: 'dark_oak' }
// Log id that matches a forest species name (for stumps and fallen logs).
function logFor(name) {
  if (typeof name !== 'string') return SPECIES_LOOK.oak.log
  const key = { pine: 'spruce', forester_cone: 'spruce', dead: 'spruce', fantasy: 'dark_oak' }[name] ?? name.replace(/^colonized_?/, '')
  return (SPECIES_LOOK[key] ?? SPECIES_LOOK.oak).log
}
const PLANT = /^minecraft:(short_grass|tall_grass|fern|large_fern|dandelion|poppy|blue_orchid|allium|azure_bluet|red_tulip|orange_tulip|white_tulip|pink_tulip|oxeye_daisy|cornflower|lily_of_the_valley|torchflower|sunflower|lilac|rose_bush|peony|dead_bush|pink_petals|moss_carpet|brown_mushroom|red_mushroom)$/
const SOIL = ['minecraft:grass_block', 'minecraft:podzol', 'minecraft:coarse_dirt', 'minecraft:dirt', 'minecraft:moss_block', 'minecraft:rooted_dirt', 'minecraft:mycelium', 'minecraft:snow_block']

function plantTree(b, name, base, size, seed, rng, big = 1) {
  const scale = [1.25, 1, 0.68][size] * big
  // the trunk thickens faster than the tree grows: big woods have trunks 2-5 across
  const girth = big ** 1.25 * [1.2, 1, 0.85][size]
  if (typeof name === 'function') return name(b, base, { size, scale, girth, seed, rng })
  if (name === 'colonized' || name === 'colonized_oak' || name === 'colonized_birch' || name === 'colonized_dark_oak') {
    const species = name === 'colonized' ? 'oak' : name.replace('colonized_', '')
    const h = Math.round(17 * scale)
    return spaceColonizationTree(b, base, { height: h, species, seed })
  }
  if (name === 'forester' || name === 'forester_round') return foresterTree(b, base, { height: Math.round(17 * scale), shape: 'round', seed })
  if (name === 'forester_cone') return foresterTree(b, base, { height: Math.round(19 * scale), shape: 'cone', seed })
  if (!TREE_SPECIES.includes(name)) throw new Error(`forest: unknown species "${name}"`)
  const preset = size === 2 && SMALLER[name] && SMALLER[name] !== name ? SMALLER[name] : name
  const h = Math.max(5, Math.round((PRESET_HEIGHT[preset] ?? 11) * scale * rng.range(0.9, 1.1)))
  const extra = size === 2 ? { branches: [2, 3], blob: [2.0, 2.6].map(v => v * girth ** 0.5) } : size === 0 && preset !== 'spruce' && preset !== 'pine' ? { blob: [3.0, 4.0].map(v => v * girth ** 0.5) } : {}
  return presetTree(b, base, preset, { seed, height: h, girth, ...extra })
}

// Woodland generator over [x0..x1] × [z0..z1].
//   const trees = forest(b, { x0: 4, z0: 4, x1: 90, z1: 90, ground,
//     species: [[6, 'oak'], [3, 'birch'], [1, 'dark_oak']], density: 0.6, minSpacing: 7,
//     clearings: [[40, 50, 9]], seed: 3 })
// ground(x, z) → y of the surface block (b.terrain's return value). Trees stand on soil only.
// species: [[weight, name], ...]; name = a b.tree preset, 'colonized' / 'colonized_<oak|birch|dark_oak>',
//   'forester_round' / 'forester_cone', or a function (b, base, { size, scale, seed, rng }).
// scale: tree size (1 = the presets; default 1.6 on canvases 400+ wide, 1.3 from 150, else 1.1:
// trunks 2-5 across in big woods), spacing grows with it.
// density 0..1 (share of free Poisson-disc slots that get a tree; default 0.6), minSpacing (between
// medium trees, default 7; large ×1.5, small ×0.65), sizes [large, medium, small] shares
// (default [0.15, 0.45, 0.4]), clump (species/density patch size, default 18), feather (edge band
// width, default 6), bushes (share of small slots that become bushes, default 0.45), fallenLogs
// (per 400 cells, default 0.6), floor (podzol/coarse dirt under big crowns, default true),
// avoid(x, z) → true to skip a spot (paths, buildings), tidy (remove plants left on roots and
// unpaired tall-plant halves, default true). Returns [{ x, y, z, species, size, kind }].
export function forest(b, opts = {}) {
  const x0 = opts.x0 ?? 0
  const z0 = opts.z0 ?? 0
  const x1 = opts.x1 ?? b.size[0] - 1
  const z1 = opts.z1 ?? b.size[2] - 1
  const seed = opts.seed ?? 0
  const rng = createRng(seed * 2654435761 + 97)
  const ground = opts.ground ?? ((x, z) => b.topY(x, z))
  const species = (opts.species ?? [[6, 'oak'], [3, 'birch'], [1, 'dark_oak']]).map(e => (Array.isArray(e) ? e : [1, e]))
  const density = opts.density ?? 0.6
  // how big the trees are: 1 = the presets; by default bigger on bigger canvases (1.6 from 400
  // wide, 1.3 from 150), since thin vanilla-sized trees read small and generated
  const canvas = Math.max(b.size[0], b.size[2])
  const big = opts.scale ?? (canvas >= 400 ? 1.6 : canvas >= 150 ? 1.3 : 1.1)
  const spacing = (opts.minSpacing ?? 7) * Math.max(1, big * 0.85)
  const sizes = opts.sizes ?? [0.15, 0.45, 0.4]
  const clump = opts.clump ?? 18
  const feather = opts.feather ?? 6
  const bushShare = opts.bushes ?? 0.45
  const clearings = opts.clearings ?? []
  const on = opts.on ?? SOIL
  const avoid = opts.avoid ?? (() => false)
  const spacingOf = [1.5, 1, 0.65]
  const totalW = species.reduce((s, [w]) => s + w, 0)
  const placed = []

  const edgeDist = (x, z) => Math.min(x - x0, x1 - x, z - z0, z1 - z)
  const inClearing = (x, z, pad = 0) => clearings.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + pad)
  const soilAt = (x, z) => {
    const y = ground(x, z)
    if (y < 0) return null
    const block = b.get(x, y, z)
    if (!block || !b.matches(block, on)) return null
    const above = b.get(x, y + 1, z)
    if (above && !PLANT.test(above.name)) return null
    return y
  }
  const clearPlants = (x, y, z) => {        // remove grass/flowers where a trunk or log goes
    for (let k = 1; k <= 2; k += 1) if (PLANT.test(b.nameAt(x, y + k, z) ?? '')) b.remove(x, y + k, z)
  }
  // Clumped species choice: a slow noise field picks the slot in the cumulative weights,
  // with 20% per-tree randomness so groups are not pure.
  const pickSpecies = (x, z) => {
    const u = rng() < 0.2 ? rng() : coherent01(x, 0, z, { scale: clump, grain: 0.1, seed: seed + 401 })
    let n = u * totalW
    for (const [w, name] of species) {
      if (n < w) return name
      n -= w
    }
    return species[species.length - 1][1]
  }
  const pickSize = (x, z) => {
    const e = edgeDist(x, z)
    let w = [...sizes]
    if (e < feather) {
      const f = Math.max(0, e / feather)           // 0 at the edge -> 1 inside
      w = [w[0] * f * f, w[1] * f, w[2] + (1 - f) * (w[0] + w[1])]
    }
    if (inClearing(x, z, 4)) w = [0, w[1] * 0.4, w[2] + w[0] + w[1] * 0.6]
    const ce = Math.min(x, b.size[0] - 1 - x, z, b.size[2] - 1 - z)   // keep big crowns inside the canvas
    if (ce < 15 * big) w = [0, w[1], w[2] + w[0]]
    if (ce < 11 * big) w = [0, 0, w[2] + w[1]]
    const t = w[0] + w[1] + w[2]
    const u = rng() * t
    return u < w[0] ? 0 : u < w[0] + w[1] ? 1 : 2
  }

  // Dart throwing with per-class spacing (a Poisson-disc variant), thinned by clumped density.
  const area = (x1 - x0 + 1) * (z1 - z0 + 1)
  const attempts = Math.ceil((area / (spacing * spacing)) * 30)
  const cellSize = spacing
  const grid = new Map()
  const gk = (x, z) => `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`
  const near = (x, z, need) => {
    const gx = Math.floor(x / cellSize)
    const gz = Math.floor(z / cellSize)
    const reach = Math.ceil((need * 1.6) / cellSize) + 1
    for (let dx = -reach; dx <= reach; dx += 1)
      for (let dz = -reach; dz <= reach; dz += 1) {
        for (const t of grid.get(`${gx + dx},${gz + dz}`) ?? []) {
          if (Math.hypot(t.x - x, t.z - z) < (need + spacing * spacingOf[t.size]) / 2) return true
        }
      }
    return false
  }
  for (let i = 0; i < attempts; i += 1) {
    const x = Math.round(x0 + rng() * (x1 - x0))
    const z = Math.round(z0 + rng() * (z1 - z0))
    if (inClearing(x, z) || avoid(x, z)) continue
    const local = density * (0.25 + 1.5 * coherent01(x, 0, z, { scale: clump * 1.3, grain: 0.1, seed: seed + 503 }))
    if (rng() > local) continue
    const size = pickSize(x, z)
    if (near(x, z, spacing * spacingOf[size])) continue
    const y = soilAt(x, z)
    if (y === null) continue
    const name = pickSpecies(x, z)
    const ce = Math.min(x, b.size[0] - 1 - x, z, b.size[2] - 1 - z)
    const kind = size === 2 && (ce < 5 || rng() < bushShare) ? 'bush' : 'tree'
    const t = { x, y: y + 1, z, species: name, size, kind }
    placed.push(t)
    if (!grid.has(gk(x, z))) grid.set(gk(x, z), [])
    grid.get(gk(x, z)).push(t)
  }

  // Ground under big crowns first (so roots and logs sit on it), then trees, then dead wood.
  if (opts.floor ?? true) {
    for (const t of placed) {
      if (t.kind !== 'tree' || t.size === 2) continue
      const r = Math.round((t.size === 0 ? 4 : 3) * big)
      for (let dx = -r; dx <= r; dx += 1)
        for (let dz = -r; dz <= r; dz += 1) {
          if (Math.hypot(dx, dz) > r || hash01(t.x + dx, 0, t.z + dz, seed + 61) > 0.4) continue
          const gx = t.x + dx
          const gz = t.z + dz
          const gy = ground(gx, gz)
          if (b.nameAt(gx, gy, gz) !== 'minecraft:grass_block') continue
          b.set(gx, gy, gz, hash01(gx, gy, gz, seed + 62) < 0.6 ? 'minecraft:podzol' : 'minecraft:coarse_dirt')
          if (b.get(gx, gy + 1, gz) && /short_grass/.test(b.nameAt(gx, gy + 1, gz))) b.remove(gx, gy + 1, gz)
        }
    }
  }
  placed.sort((a, c) => a.size - c.size)   // big trees first: their crowns win over small neighbours
  for (const [i, t] of placed.entries()) {
    const s = seed * 131 + i * 17 + t.x
    clearPlants(t.x, t.y - 1, t.z)
    if (t.kind === 'bush') {
      const leaves = SPECIES_LOOK[t.species]?.leaves ?? ['oak_leaves', 'azalea_leaves']
      bush(b, [t.x, t.y, t.z], { radius: rng.range(1.2, 2.0), leaves: [leaves[0], 'azalea_leaves'], log: SPECIES_LOOK[t.species]?.log ?? 'oak_log', seed: s })
    } else {
      plantTree(b, t.species, [t.x, t.y, t.z], t.size, s, rng, big)
    }
  }

  // Dead wood: stump + fallen log lying 1-2 blocks away, along x or z on flat ground.
  const logs = Math.round((area / 400) * (opts.fallenLogs ?? 0.6))
  for (let i = 0, made = 0; i < logs * 25 && made < logs; i += 1) {
    const x = Math.round(x0 + 2 + rng() * (x1 - x0 - 4))
    const z = Math.round(z0 + 2 + rng() * (z1 - z0 - 4))
    if (inClearing(x, z) || avoid(x, z)) continue
    if (placed.some(t => Math.hypot(t.x - x, t.z - z) < (t.kind === 'tree' ? 3.5 : 2))) continue
    const y = soilAt(x, z)
    if (y === null) continue
    const name = pickSpecies(x, z)
    const logId = logFor(name)
    const along = rng() < 0.5 ? 'x' : 'z'
    const len = rng.int(3, 6)
    const d = along === 'x' ? [1, 0] : [0, 1]
    const start = [x + d[1] * 2, z + d[0] * 2]   // offset sideways from the stump
    let ok = true
    for (let k = 0; k < len && ok; k += 1) {
      const lx = start[0] + d[0] * k
      const lz = start[1] + d[1] * k
      if (soilAt(lx, lz) !== y || avoid(lx, lz)) ok = false
    }
    if (!ok) continue
    const stumpH = rng.int(1, 2)
    clearPlants(x, y, z)
    for (let k = 1; k <= stumpH; k += 1) b.set(x, y + k, z, `${ns(logId)}[axis=y]`)
    for (let k = 0; k < len; k += 1) {
      const lx = start[0] + d[0] * k
      const lz = start[1] + d[1] * k
      clearPlants(lx, y, lz)
      b.set(lx, y + 1, lz, `${ns(logId)}[axis=${along}]`)
      const u = hash01(lx, y, lz, seed + 71)
      if (u < 0.35) b.set(lx, y + 2, lz, 'minecraft:moss_carpet')
      else if (u < 0.45) b.set(lx, y + 2, lz, u < 0.4 ? 'minecraft:brown_mushroom' : 'minecraft:red_mushroom')
    }
    placed.push({ x, y: y + 1, z, species: name, size: 2, kind: 'fallen' })
    made += 1
  }
  if (opts.tidy ?? true) tidyPlants(b, x0 - 8, z0 - 8, x1 + 8, z1 + 8)
  return placed
}

// Roots and trunks replace ground blocks under existing grass/flowers and cut tall plants in
// half. Remove plants that lost their soil and unpaired tall-plant halves.
const SOIL_FOR_PLANTS = /^minecraft:(grass_block|dirt|coarse_dirt|podzol|rooted_dirt|moss_block|mud|muddy_mangrove_roots|mycelium|farmland)$/
const TALL = /^minecraft:(tall_grass|large_fern|sunflower|lilac|rose_bush|peony|pitcher_plant)$/
function tidyPlants(b, x0, z0, x1, z1) {
  for (let pass = 0; pass < 2; pass += 1) {
    for (const [x, y, z, block] of b.entries()) {
      if (x < x0 || x > x1 || z < z0 || z > z1) continue
      const { name } = block
      if (TALL.test(name)) {
        const half = block.props?.half ?? 'lower'
        const partner = b.get(x, half === 'lower' ? y + 1 : y - 1, z)
        const paired = partner && partner.name === name && (partner.props?.half ?? 'lower') !== half
        const soil = half === 'upper' || SOIL_FOR_PLANTS.test(b.nameAt(x, y - 1, z) ?? '')
        if (!paired || !soil) b.remove(x, y, z)
      } else if (PLANT.test(name) && !/(moss_carpet|_mushroom)$/.test(name)) {
        if (!SOIL_FOR_PLANTS.test(b.nameAt(x, y - 1, z) ?? '')) b.remove(x, y, z)
      }
    }
  }
}

export const FOREST_METHODS = { forest, spaceColonizationTree, foresterTree }
