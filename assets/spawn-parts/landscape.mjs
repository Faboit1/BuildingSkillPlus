// Landscape and props for the spawn generator: feature trees, woodland, ground cover, the island's
// underside, the PvP ruin, the AFK garden and the small props (lamps, benches, planters, stalls...).
// Contract (see index.mjs for ctx). Every position is [x, y, z] with y = the GROUND block level (the
// block you stand on); things start at y + 1.
//   featureTree(ctx, [x, y, z], { size: 'large' | 'medium' | 'small', seed, style, maxRadius, maxHeight }) → { radius, height }
//     styles: autumn | oak | cherry | snowy_spruce | spruce | blossom | pine | birch | dark_oak | azalea | palm
//     (default theme.trees.feature). The crown stays within maxRadius (default large 10, medium 7,
//     small 4.5): in a tight spot a smaller tree of the same shape is planted; maxHeight caps the
//     height (e.g. the pair framing the hero, so their crowns stay below the name sign in the spawn
//     view). Returns the real crown radius and height (ground to crown top).
//   plantTree(ctx, style, [x, y, z], { size, seed, height, maxR })   the same without the ground dressing
//   lamp(ctx, [x, y, z], { kind: 'post' | 'wall' | 'hanging', facing })   themed lamp; wall: [x, z] is the
//     cell in front of the wall, facing = out of the wall; hanging: the arm points along facing
//   bench(ctx, [x, y, z], facing, { length })        the sitter faces `facing`
//   planter(ctx, [x, y, z], { r, tree, seed, style }) raised bed (r = half size), optional small tree
//   fountain(ctx, [x, y, z], { r })   well(ctx, [x, y, z], { facing })
//   stall(ctx, [x, y, z], facing, { width, colour })  market stall; [x, z] = middle of the counter,
//     the stall extends 2 behind it (away from facing), customer side = facing
//   pvpArena(ctx, { x0, z0, x1, z1, y, entrance }) → { center, radius }   ruined colonnade, red line,
//     rules hologram, region 'pvp'
//   afkPark(ctx, { x0, z0, x1, z1, y })               AFK garden pool + region 'afk'
//   clutter(ctx, [x, y, z], kind, { facing })   'barrels' | 'crates' | 'hay' | 'logs' | 'cart' | 'firewood' | 'pots'
//   torii(ctx, [x, y, z], facing, { width })          japanese gate, walk through along `facing`
//     (a second torii within 8 blocks of another is skipped)
//   hedge(ctx, [x0, z0], [x1, z1], y, { height, gaps })   rockOutcrop(ctx, [x, y, z], { r, seed })
//   stoneLantern(ctx, [x, y, z])   bambooClump(ctx, [x, y, z], { r, seed })   bushAt(ctx, [x, y, z], { r })
//   landscapePass(ctx)   runs LAST: woodland framing the spawn (densest at the outer ring and on hills,
//     clear of every reserved slot, path and building by more than its crown, low in front of the
//     features), bushes, rocks, dead wood, ground cover, flower drifts, theme details (leaf litter,
//     pumpkins, snow, moss, bamboo, stone lanterns, reeds), the island's rim and underside

const TAU = Math.PI * 2
const ns = id => (String(id).includes(':') ? String(id) : `minecraft:${id}`)
const bare = id => String(id).replace(/^minecraft:/, '')
const LEAF = id => `${ns(id)}[distance=1,persistent=true,waterlogged=false]`
const isLeaves = n => /_leaves$/.test(n ?? '')
const WOODY = /_(log|wood|stem|hyphae)$/
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const norm = v => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const DIRS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }
const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' }
const CW = { north: 'east', east: 'south', south: 'west', west: 'north' }

const PLANT = /^minecraft:(short_grass|tall_grass|fern|large_fern|dandelion|poppy|blue_orchid|allium|azure_bluet|red_tulip|orange_tulip|white_tulip|pink_tulip|oxeye_daisy|cornflower|lily_of_the_valley|torchflower|sunflower|lilac|rose_bush|peony|dead_bush|pink_petals|moss_carpet|brown_mushroom|red_mushroom|snow|sweet_berry_bush|.*_carpet)$/
const SOIL = /^minecraft:(grass_block|dirt|coarse_dirt|podzol|rooted_dirt|moss_block|mud|mycelium|snow_block)$/

function catmull(points, t) {
  const n = points.length
  const f = Math.min(n - 1 - 1e-9, Math.max(0, t * (n - 1)))
  const i = Math.floor(f)
  const u = f - i
  const p0 = points[Math.max(0, i - 1)]
  const p1 = points[i]
  const p2 = points[i + 1]
  const p3 = points[Math.min(n - 1, i + 2)]
  return [0, 1, 2].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u))
}

// Per-call module state on ctx: feature trees placed (for the woodland's clearance), canopy cells.
function state(ctx) {
  ctx._land ??= { features: [], canopy: new Map(), snowBoxes: [] }
  return ctx._land
}

// The ground level of a column: the site's height field when it exists, else the builder's surface.
function groundAt(ctx, x, z) {
  const g = ctx.site?.groundY?.(x, z)
  if (g !== undefined && g >= 0) return g
  return ctx.b.groundY(x, z)
}

// ================================================================ tree engine

// Tapered limb along a Catmull-Rom curve: logs on near-vertical runs, bark-all-round wood
// elsewhere; under radius 0.75 a face-connected single-block line (twigs never break apart).
function limb(b, pts, r0, r1, log, wood, { keep = false } = {}) {
  let len = 0
  for (let i = 1; i < pts.length; i += 1) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2])
  const n = Math.max(2, Math.ceil(len * 3))
  let last = null
  let prev = pts[0]
  const opt = keep ? { keep: true } : undefined
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    const c = catmull(pts, t)
    const nx = catmull(pts, Math.min(1, t + 1 / n))
    const d = i === n ? [c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]] : [nx[0] - c[0], nx[1] - c[1], nx[2] - c[2]]
    prev = c
    const dl = Math.hypot(d[0], d[1], d[2]) || 1
    const vertical = Math.abs(d[1]) / dl > 0.8
    const paint = vertical ? `${ns(log)}[axis=y]` : `${ns(wood)}[axis=y]`
    const r = r0 + (r1 - r0) * t
    const cell = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]
    if (r < 0.75) {
      b.line(last ?? cell, cell, paint, { connect: 6, ...(keep ? { keep: true } : {}) })
      last = cell
      continue
    }
    last = cell
    const R = Math.ceil(r)
    for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x += 1)
      for (let y = Math.floor(c[1] - R); y <= Math.ceil(c[1] + R); y += 1)
        for (let z = Math.floor(c[2] - R); z <= Math.ceil(c[2] + R); z += 1) {
          if ((x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2 > r * r) continue
          const ex = b.get(x, y, z)
          if (ex && WOODY.test(ex.name)) continue
          b.set(x, y, z, paint, opt)
        }
  }
}

// One foliage lobe: a noisy, flat-bottomed ellipsoid. paint(x, y, z, info) → block id (leaves get the
// persistent state). info = { depth: blocks in from the surface, ci: lobe index, up: 0..1 height in the
// lobe }. Only fills air or this tree's own foliage (`mine`), never wood or anything else.
function lobe(b, kit, c, [rx, ry, rz], paint, { seed = 0, holes = 0.16, rough = 0.3, flat = 0.5, ci = 0, mine, cells } = {}) {
  const R = Math.ceil(Math.max(rx, ry, rz) * (1 + rough)) + 1
  const { fbm3 } = kit.noise
  const minR = Math.min(rx, ry, rz)
  for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x += 1)
    for (let z = Math.floor(c[2] - R); z <= Math.ceil(c[2] + R); z += 1)
      for (let y = Math.floor(c[1] - ry * flat); y <= Math.ceil(c[1] + R); y += 1) {
        const dx = (x - c[0]) / rx
        const dy = (y - c[1]) / ry
        const dz = (z - c[2]) / rz
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d > 1 + rough) continue
        const w = 1 + rough * fbm3(x, y, z, { scale: 3, octaves: 2, seed: seed + 3 })
        if (d > w) continue
        const depth = (w - d) * minR
        if (depth < 0.55 && kit.hash01(x, y, z, seed + 17) < holes) continue
        const k = b.key(x, y, z)
        const ex = b.get(x, y, z)
        if (ex && !(mine && mine.has(k))) continue
        const id = paint(x, y, z, { depth, ci, up: clamp((y - c[1] + ry * flat) / (ry * (1 + flat)), 0, 1) })
        if (!id) continue
        b.set(x, y, z, isLeaves(ns(id)) ? LEAF(id) : ns(id))
        mine?.add(k)
        cells?.push([x, y, z])
      }
}

// rotate `dir` away from itself by angle `ang` toward azimuth `az` around it
function deflect(dir, ang, az) {
  const helper = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const u = norm([dir[1] * helper[2] - dir[2] * helper[1], dir[2] * helper[0] - dir[0] * helper[2], dir[0] * helper[1] - dir[1] * helper[0]])
  const v = [dir[1] * u[2] - dir[2] * u[1], dir[2] * u[0] - dir[0] * u[2], dir[0] * u[1] - dir[1] * u[0]]
  const s = Math.sin(ang)
  const co = Math.cos(ang)
  return norm([dir[0] * co + (u[0] * Math.cos(az) + v[0] * Math.sin(az)) * s, dir[1] * co + (u[1] * Math.cos(az) + v[1] * Math.sin(az)) * s, dir[2] * co + (u[2] * Math.cos(az) + v[2] * Math.sin(az)) * s])
}

// A broadleaf tree: a real trunk forking into leaders, each forking again (depth levels), radii by the
// pipe model, one foliage lobe per tip (flat-bottomed, so branches show beneath), smaller lobes on the
// last forks, a root flare. o = { height, fork: [a, b] (share of H), leaders: [a, b], depth, reach (leader
// length / H), elev: [sin of the elevation per depth], split: [a, b] radians, decay: [a, b], out
// (outward pull), cluster: [rx, ry], holes, rough, log, wood, paint(x, y, z, info), roots, seed,
// leader (a central stem), droop (hanging strands: { chance, len, id }) }
// Returns { tips, top, radius, cells (foliage cells), lobes }.
function broadleaf(ctx, [bx, by, bz], o) {
  const { b, kit } = ctx
  const rng = kit.rng((o.seed ?? 0) * 7919 + Math.round(bx) * 31 + Math.round(bz) * 17 + 101)
  const H = o.height
  const leanA = rng() * TAU
  const lean = H * (o.lean ?? 0.05) * rng.range(0.3, 1)
  const forkH = Math.max(2, H * rng.range(o.fork[0], o.fork[1]))
  const F = [bx + Math.cos(leanA) * lean, by + forkH, bz + Math.sin(leanA) * lean]
  const elev = o.elev ?? [0.75, 0.5, 0.35, 0.3]
  const nodes = []
  const tips = []
  const grow = (a, dir, len, depth) => {
    const e = add(a, dir, len)
    const node = { a, e, depth, kids: [], len }
    nodes.push(node)
    if (depth < o.depth && len > 2.2) {
      const k = rng.chance(depth === 0 ? (o.fork3 ?? 0.3) : (o.fork3deep ?? 0.15)) ? 3 : 2
      const twist = rng() * TAU
      for (let j = 0; j < k; j += 1) {
        let d = deflect(dir, rng.range(o.split[0], o.split[1]), twist + (j * TAU) / k + rng.range(-0.5, 0.5))
        // outward from the trunk and toward the depth's elevation (branches spread and level off)
        const ox = e[0] - F[0]
        const oz = e[2] - F[2]
        const ol = Math.hypot(ox, oz) || 1
        const want = elev[Math.min(elev.length - 1, depth + 1)]
        d = norm([d[0] + (ox / ol) * (o.out ?? 0.35), d[1], d[2] + (oz / ol) * (o.out ?? 0.35)])
        d = norm([d[0], d[1] * 0.5 + want * 0.5, d[2]])
        node.kids.push(grow(e, d, len * rng.range(o.decay[0], o.decay[1]), depth + 1))
      }
    } else tips.push(node)
    return node
  }
  const nLead = rng.int(o.leaders[0], o.leaders[1])
  const a0 = rng() * TAU
  const roots = []
  for (let i = 0; i < nLead; i += 1) {
    const az = a0 + (i * TAU) / nLead + rng.range(-0.35, 0.35)
    const el = elev[0] * rng.range(0.85, 1.1)
    const h = Math.sqrt(Math.max(0, 1 - el * el))
    const start = [F[0], F[1] - rng.range(0, Math.min(2.5, forkH * 0.3)), F[2]]
    roots.push(grow(start, norm([Math.cos(az) * h, el, Math.sin(az) * h]), H * o.reach * rng.range(0.85, 1.12), 0))
  }
  if (o.leader) roots.push(grow([F[0], F[1], F[2]], norm([rng.range(-0.2, 0.2), 1, rng.range(-0.2, 0.2)]), H * o.reach * 0.75, 1))
  // fit the crown to the height: scale the rise above the fork so the top lobe ends near by + H
  const cl = [...o.cluster]
  const topY = Math.max(...tips.map(t => t.e[1]))
  const want = by + H - cl[1] * 0.9
  if (topY > F[1] + 1) {
    const k = clamp((want - F[1]) / (topY - F[1]), 0.6, 1.5)
    for (const n of nodes) {
      n.a = [n.a[0], F[1] + (n.a[1] - F[1]) * k, n.a[2]]
      n.e = [n.e[0], F[1] + (n.e[1] - F[1]) * k, n.e[2]]
    }
  }
  // fit the crown into the room it has: squeeze the limbs' horizontal reach (and the lobes) to maxR
  if (o.maxR) {
    cl[0] = Math.min(cl[0], Math.max(1.6, o.maxR * 0.42))
    let reach = 0
    for (const t of tips) reach = Math.max(reach, Math.hypot(t.e[0] - bx, t.e[2] - bz))
    const want = o.maxR - cl[0] * 1.15
    if (reach > want && want > 0.5) {
      const k = want / reach
      const sq = p => [bx + (p[0] - bx) * k, p[1], bz + (p[2] - bz) * k]
      for (const n of nodes) {
        n.a = sq(n.a)
        n.e = sq(n.e)
      }
      F[0] = bx + (F[0] - bx) * k
      F[2] = bz + (F[2] - bz) * k
    }
  }
  // pipe-model radii
  const tipR = o.tipR ?? 0.45
  const rad = n => (n.r = n.kids.length ? Math.pow(n.kids.reduce((s, c) => s + rad(c) ** 2.5, 0), 0.4) : tipR)
  let sum = 0
  for (const r of roots) sum += rad(r) ** 2.5
  const pipeTrunk = Math.pow(sum, 0.4)
  const trunkR = o.trunk ?? clamp(pipeTrunk, 0.5, 2.2)
  const scale = trunkR / pipeTrunk
  // wood: trunk, limbs
  const log = o.log
  const wood = o.wood
  const mid = [bx + (F[0] - bx) * 0.35 + rng.range(-0.4, 0.4), by + forkH * 0.5, bz + (F[2] - bz) * 0.35 + rng.range(-0.4, 0.4)]
  limb(b, [[bx, by - 1, bz], [bx, by, bz], mid, F], trunkR * 1.15, trunkR * 0.82, log, wood)
  for (const n of nodes) {
    const r0 = clamp(n.r * scale, 0.5, trunkR * 0.85)
    const r1 = n.kids.length ? clamp(Math.max(...n.kids.map(c => c.r)) * scale, 0.5, r0) : 0.5
    const m = [(n.a[0] + n.e[0]) / 2, (n.a[1] + n.e[1]) / 2 + n.len * (o.bow ?? 0.08), (n.a[2] + n.e[2]) / 2]
    limb(b, [n.a, m, n.e], r0, r1, log, wood)
  }
  // root flare
  const nRoots = o.roots ?? Math.round(clamp(trunkR * 3, 0, 6))
  for (let i = 0; i < nRoots; i += 1) {
    const a = (i / nRoots) * TAU + rng.range(-0.4, 0.4) + a0
    const len = trunkR + rng.range(1.2, 2.6)
    limb(b, [[bx, by + rng.range(0.6, 1.6), bz], [bx + Math.cos(a) * len * 0.55, by + 0.2, bz + Math.sin(a) * len * 0.55], [bx + Math.cos(a) * len, by - 0.9, bz + Math.sin(a) * len]], Math.max(0.5, trunkR * 0.55), 0.5, log, wood, { keep: true })
  }
  // foliage
  const mine = new Set()
  const cells = []
  const lobes = []
  const lv = o.lobeVar ?? 0.15
  for (const [i, t] of tips.entries()) {
    const s = rng.range(1 - lv, 1 + lv)
    // outer lobes sag a little under their weight; a few sit lower still (a layered, uneven crown)
    const out = Math.hypot(t.e[0] - bx, t.e[2] - bz) / Math.max(1, H * 0.45)
    const sag = (o.sag ?? 0) * out + (rng.chance(o.dropChance ?? 0) ? rng.range(1, 2.5) : 0)
    lobes.push({ c: [t.e[0], t.e[1] + cl[1] * (o.lift ?? 0.35) - sag, t.e[2]], r: [cl[0] * s, cl[1] * s, cl[0] * s * rng.range(0.85, 1.15)], ci: i })
  }
  // smaller lobes on the last forks (leaves sit on the branches, not only at the tips)
  for (const n of nodes) {
    if (!n.kids.length || n.depth < o.depth - 1 || !rng.chance(o.inner ?? 0.55)) continue
    const s = rng.range(0.6, 0.8)
    lobes.push({ c: [n.e[0], n.e[1] + 0.3, n.e[2]], r: [cl[0] * s, cl[1] * s * 1.1, cl[0] * s], ci: lobes.length })
  }
  const crown = { y0: Math.min(...lobes.map(l => l.c[1] - l.r[1] * 0.5)), y1: Math.max(...lobes.map(l => l.c[1] + l.r[1])), cx: F[0], cz: F[2] }
  crown.r = Math.max(...lobes.map(l => Math.hypot(l.c[0] - F[0], l.c[2] - F[2]) + l.r[0]))
  const paint = o.paint(crown, rng)
  for (const l of lobes) lobe(b, kit, l.c, l.r, paint, { seed: (o.seed ?? 0) * 13 + l.ci * 7, holes: o.holes ?? 0.16, rough: o.rough ?? 0.3, flat: o.flat ?? 0.5, ci: l.ci, mine, cells })
  // hanging strands from the outer underside (cherry, willow-ish, fantasy vines)
  if (o.droop) hangFrom(ctx, cells, mine, crown, o.droop, rng)
  let reach = 0
  for (const [x, , z] of cells) reach = Math.max(reach, Math.hypot(x - bx, z - bz))
  return { tips: tips.map(t => t.e), top: crown.y1, radius: reach + 0.5, crown, cells, F, trunkR }
}

// Hanging strands under the outer underside of a crown: leaves, cave vines (glow berries), weeping vines.
function hangFrom(ctx, cells, mine, crown, { chance = 0.12, len = [1, 3], id = 'leaves', leaf = 'oak_leaves', outer = 0.55 }, rng) {
  const { b } = ctx
  for (const [x, y, z] of cells) {
    if (b.get(x, y - 1, z)) continue
    const d = Math.hypot(x - crown.cx, z - crown.cz) / (crown.r || 1)
    if (d < outer || rng() > chance) continue
    const n = rng.int(len[0], len[1])
    for (let k = 1; k <= n; k += 1) {
      if (b.get(x, y - k, z) || b.get(x, y - k - 1, z)) break
      const last = k === n
      if (id === 'leaves') {
        b.set(x, y - k, z, LEAF(leaf))
        mine.add(b.key(x, y - k, z))
      } else if (id === 'cave_vines') b.set(x, y - k, z, last ? `minecraft:cave_vines[age=25,berries=${rng.chance(0.4)}]` : `minecraft:cave_vines_plant[berries=${rng.chance(0.3)}]`)
      else if (id === 'weeping_vines') b.set(x, y - k, z, last ? 'minecraft:weeping_vines[age=25]' : 'minecraft:weeping_vines_plant')
      if (last) break
    }
  }
}

// A young broadleaf (the small size class): a slim leaning stem with 3-5 small lobes stepping up it on
// alternating sides and a top tuft, so it reads as an oval, gappy young crown rather than a ball on a stick.
function youngTree(ctx, [bx, by, bz], { height, seed = 0, log, wood, paint, maxR = 4.5 }) {
  const { b, kit } = ctx
  const rng = kit.rng(seed * 6151 + Math.round(bx) * 37 + Math.round(bz) * 19 + 5)
  const H = height
  const la = rng() * TAU
  const lean = rng.range(0.3, 1.1)
  const top = [bx + Math.cos(la) * lean, by + H - 2, bz + Math.sin(la) * lean]
  const trunk = [[bx, by - 1, bz], [bx + Math.cos(la) * lean * 0.3, by + H * 0.45, bz + Math.sin(la) * lean * 0.3], top]
  limb(b, trunk, H > 7 ? 0.8 : 0.5, 0.5, log, wood)
  const lobes = []
  const n = rng.int(3, 5)
  const a0 = rng() * TAU
  const rMax = Math.max(1.4, Math.min(2.3, maxR * 0.5))
  for (let i = 0; i < n; i += 1) {
    const t = 0.42 + (0.5 * i) / Math.max(1, n - 1)
    const p = catmull(trunk, t)
    const a = a0 + i * 2.4 + rng.range(-0.3, 0.3)
    const off = Math.min(rng.range(0.8, 1.8) * (1.1 - t * 0.5), maxR - rMax)
    const r = rMax * rng.range(0.75, 1.0) * (1.1 - t * 0.25)
    const c = [p[0] + Math.cos(a) * off, p[1] + rng.range(0, 0.8), p[2] + Math.sin(a) * off]
    if (off > 1.1) limb(b, [p, c], 0.5, 0.5, log, wood)
    lobes.push({ c, r: [r, r * 0.85, r * rng.range(0.85, 1.1)], ci: i })
  }
  lobes.push({ c: [top[0], top[1] + 1.2, top[2]], r: [rMax * 0.75, rMax * 0.8, rMax * 0.75], ci: n })
  const crown = { y0: Math.min(...lobes.map(l => l.c[1] - l.r[1] * 0.6)), y1: Math.max(...lobes.map(l => l.c[1] + l.r[1])), cx: top[0], cz: top[2], r: rMax + 1.5 }
  const pf = paint(crown, rng)
  const mine = new Set()
  const cells = []
  for (const l of lobes) lobe(b, kit, l.c, l.r, pf, { seed: seed * 13 + l.ci * 7, holes: 0.18, rough: 0.3, flat: 0.6, ci: l.ci, mine, cells })
  let reach = 0
  for (const [x, , z] of cells) reach = Math.max(reach, Math.hypot(x - bx, z - bz))
  return { radius: reach + 0.5, top: crown.y1, cells }
}

// ---------------------------------------------------------------- foliage paints

// Autumn: no orange leaves exist in 1.21.1, so the crown is coloured with leaf-like textured blocks in
// clumps: nether wart (crimson), honeycomb (amber), orange terracotta (rust), shroomlight (bright,
// glows), with green leaves left in the shaded heart (showing through the gaps). Each tree leans to a
// hue (red maple, orange, golden) and each lobe shifts a little, like branches turning at different times.
const AUTUMN_HUES = {
  red: [['dark_oak_leaves', 0.7], ['nether_wart_block', 5], ['red_terracotta', 0.6], ['orange_terracotta', 0.6], ['honeycomb_block', 1.7], ['shroomlight', 0.4]],
  orange: [['dark_oak_leaves', 0.7], ['nether_wart_block', 2], ['orange_terracotta', 0.9], ['honeycomb_block', 3.8], ['shroomlight', 0.9]],
  gold: [['oak_leaves', 0.6], ['nether_wart_block', 0.4], ['orange_terracotta', 1.0], ['honeycomb_block', 3.8], ['shroomlight', 1.1], ['yellow_terracotta', 0.3]],
  mixed: [['oak_leaves', 1.6], ['nether_wart_block', 3], ['orange_terracotta', 0.8], ['honeycomb_block', 3.2], ['shroomlight', 0.6]],
  rust: [['dark_oak_leaves', 0.8], ['nether_wart_block', 1.2], ['red_terracotta', 1.4], ['orange_terracotta', 3], ['honeycomb_block', 1.6], ['shroomlight', 0.3]],
  late: [['dark_oak_leaves', 1.5], ['oak_leaves', 3], ['nether_wart_block', 0.6], ['orange_terracotta', 0.5], ['honeycomb_block', 1.5], ['shroomlight', 0.3]],
}
function pickRamp(ramp, v) {
  const total = ramp.reduce((s, [, w]) => s + w, 0)
  let n = clamp(v, 0, 0.999) * total
  for (const [id, w] of ramp) {
    if (n < w) return id
    n -= w
  }
  return ramp[ramp.length - 1][0]
}
function autumnPaint(ctx, hueName, seed) {
  const { kit } = ctx
  const ramp = AUTUMN_HUES[hueName] ?? AUTUMN_HUES.orange
  return crown => (x, y, z, info) => {
    const h = clamp((y - crown.y0) / Math.max(1, crown.y1 - crown.y0), 0, 1)
    if (info.depth > 1.5) return kit.hash01(x, y, z, seed + 5) < 0.5 ? 'dark_oak_leaves' : 'oak_leaves'
    const n = kit.noise.coherent01(x, y, z, { scale: 2.3, grain: 0.1, seed: seed + 41 })
    const lobeShift = kit.hash01(info.ci, 0, 0, seed + 9) - 0.5
    const v = 0.62 * n + 0.38 * (0.7 * h + 0.3 * info.up) + 0.22 * lobeShift - 0.06
    return pickRamp(ramp, v)
  }
}
// a plain leaf mix shaded like light from above: under = darker, top = lighter, clumped
function shadedPaint(ctx, { base, under, over, accent, accentShare = 0, seed = 0 }) {
  const { kit } = ctx
  return crown => (x, y, z, info) => {
    const n = kit.noise.coherent01(x, y, z, { scale: 2.5, grain: 0.15, seed: seed + 11 })
    if (accent && kit.noise.coherent01(x, y, z, { scale: 2, grain: 0.2, seed: seed + 19 }) < accentShare) return accent
    const h = clamp((y - crown.y0) / Math.max(1, crown.y1 - crown.y0), 0, 1)
    const v = 0.55 * h + 0.25 * info.up + 0.35 * n - 0.1
    if (under && v < 0.28) return under
    if (over && v > 0.78) return over
    return base
  }
}

// ---------------------------------------------------------------- conifers

// A spruce: a straight trunk and whorls of drooping boughs (wide skirt, narrowing, gaps between tiers
// so the trunk shows), a spire tip. snow: snow layers on every bough top.
function conifer(ctx, [bx, by, bz], { height, radius, seed = 0, leaves = 'spruce_leaves', log = 'spruce_log', snow = false, bare = 0.18 }) {
  const { b, kit } = ctx
  const rng = kit.rng(seed * 4099 + Math.round(bx) * 13 + Math.round(bz) * 7 + 3)
  const H = height
  const R = radius ?? Math.max(2.5, H * 0.27)
  const trunkR = H > 16 ? 0.95 : 0.5
  limb(b, [[bx, by - 1, bz], [bx, by + H - 2, bz]], trunkR, 0.5, log, log.replace(/_log$/, '_wood'))
  const y0 = by + Math.max(1, Math.round(H * bare))
  const cells = []
  const phase = rng() * TAU
  let y = y0
  let tier = 0
  const leaf = LEAF(leaves)
  while (y < by + H) {
    const t = (y - y0) / Math.max(1, by + H - y0)
    const r = (R * Math.pow(1 - t, 0.85) + 0.6) * rng.range(0.92, 1.08)
    const step = r > 3.2 ? 3 : 2
    // the bough tier: a disc that droops at the rim (rim cells one lower), notched by angle noise
    for (let x = Math.floor(bx - r - 1); x <= Math.ceil(bx + r + 1); x += 1)
      for (let z = Math.floor(bz - r - 1); z <= Math.ceil(bz + r + 1); z += 1) {
        const a = Math.atan2(z - bz, x - bx)
        const rr = r * (1 + 0.2 * Math.sin(a * 5 + phase + tier * 1.7) + 0.1 * Math.sin(a * 9 + tier))
        const d = Math.hypot(x - bx, z - bz)
        if (d > rr) continue
        const rim = d > rr * 0.62
        if (rim && kit.hash01(x, y, z, seed + 31) < 0.18) continue
        const yy = rim && r > 1.6 ? y - 1 : y
        if (!b.get(x, yy, z)) {
          b.set(x, yy, z, leaf)
          cells.push([x, yy, z])
        }
        // the tier's upper layer, narrower
        if (d < rr * 0.55 && !b.get(x, yy + 1, z)) {
          b.set(x, yy + 1, z, leaf)
          cells.push([x, yy + 1, z])
        }
      }
    y += step
    tier += 1
  }
  for (let k = 0; k < 2; k += 1) b.set(bx, by + H + k, bz, leaf)
  if (snow) snowOn(ctx, cells)
  return { top: by + H + 1, radius: R + 0.6, cells }
}

// snow layers on every cell of `cells` with open sky (air) above it
function snowOn(ctx, cells, { deep = 0.35 } = {}) {
  const { b, kit } = ctx
  for (const [x, y, z] of cells) {
    if (b.get(x, y + 1, z)) continue
    const blk = b.get(x, y, z)
    if (!blk) continue
    b.set(x, y + 1, z, `minecraft:snow[layers=${kit.hash01(x, y, z, 77) < deep ? 2 : 1}]`)
  }
}

// A pine with a bare trunk and flat cloud pads near the top (Scots pine / Japanese black pine).
function pine(ctx, [bx, by, bz], { height, seed = 0, snow = false, leaves = ['spruce_leaves'], maxR = 99 }) {
  const { b, kit } = ctx
  const rng = kit.rng(seed * 6007 + Math.round(bx) * 29 + Math.round(bz) * 11 + 7)
  const H = height
  const la = rng() * TAU
  const lean = H * rng.range(0.06, 0.16)
  const top = [bx + Math.cos(la) * lean, by + H - 1, bz + Math.sin(la) * lean]
  const mid = [bx + Math.cos(la + 0.9) * lean * 0.5, by + H * 0.5, bz + Math.sin(la + 0.9) * lean * 0.5]
  const trunkR = H > 14 ? 0.9 : 0.5
  limb(b, [[bx, by - 1, bz], mid, top], trunkR, 0.5, 'spruce_log', 'spruce_wood')
  const pads = []
  const n = rng.int(4, 6)
  const a0 = rng() * TAU
  for (let i = 0; i < n; i += 1) {
    const t = 0.55 + (0.4 * i) / (n - 1) + rng.range(-0.04, 0.04)
    const o = catmull([[bx, by - 1, bz], mid, top], t)
    const a = a0 + i * 2.39996 + rng.range(-0.3, 0.3)
    const len = Math.min(H * rng.range(0.16, 0.3) * (1.15 - t * 0.5), maxR - 2.6)
    const e = [o[0] + Math.cos(a) * len, o[1] + rng.range(0.3, 1.5), o[2] + Math.sin(a) * len]
    limb(b, [o, e], 0.5, 0.5, 'spruce_log', 'spruce_wood')
    pads.push([e, rng.range(1.9, 2.8)])
  }
  pads.push([top, rng.range(1.8, 2.4)])
  const cells = []
  const mine = new Set()
  const pick = (x, y, z) => (leaves.length === 1 ? leaves[0] : leaves[Math.floor(kit.noise.coherent01(x, y, z, { scale: 2, seed }) * leaves.length) % leaves.length])
  for (const [i, [c, r]] of pads.entries()) lobe(b, kit, [c[0], c[1] + 0.4, c[2]], [r, r * 0.42, r], x => x, { seed: seed + i * 5, holes: 0.12, rough: 0.25, flat: 0.6, ci: i, mine, cells }) // placeholder ids, recoloured below
  for (const [x, y, z] of cells) b.set(x, y, z, LEAF(pick(x, y, z)))
  if (snow) snowOn(ctx, cells)
  return { top: Math.max(...pads.map(([c, r]) => c[1] + r * 0.5)), radius: Math.max(...pads.map(([c, r]) => Math.hypot(c[0] - bx, c[2] - bz) + r)), cells }
}

// ================================================================ feature trees

// Named tree styles at a size: 'large' (feature, 15-19 tall), 'medium' (9-12), 'small' (6-8).
const SIZE_H = { large: [15, 19], medium: [9, 12], small: [6, 8] }
const HUES = ['red', 'orange', 'gold', 'mixed', 'orange']
const WOOD_HUES = ['red', 'orange', 'gold', 'rust', 'late', 'orange', 'red', 'rust']

// A palm: a curved, ringed trunk leaning away from a random side, a crown of drooping fronds, cocoa
// "coconuts" under the crown. height 7-12 for a landscape palm; giant: true (20-28) is the landmark
// version, with a thick tapering trunk, a root flare and broad 3-wide fronds.
//   palmTree(ctx, [x, y, z], { height, lean, seed, giant }) → { radius, top, cells }
// The trunk bends more near the top (palms lean, then turn up toward the light); fronds rise a
// little from the crown, then fall away in an arc whose tips hang 2-6 below it.
export function palmTree(ctx, [x, y, z], { height, lean, seed = 0, giant = false } = {}) {
  const { b, kit } = ctx
  const rng = kit.rng(seed * 53 + 11)
  const H = height ?? (giant ? rng.int(21, 27) : rng.int(7, 11))
  const ang = rng.range(0, TAU)
  const L = lean ?? H * rng.range(giant ? 0.16 : 0.18, giant ? 0.26 : 0.34)
  // the trunk line: an offset growing with the square of the height (the bend sits up top), and a
  // slight turn back toward vertical in the last fifth
  const pts = []
  const N = Math.max(4, Math.round(H / 2))
  for (let i = 0; i <= N; i += 1) {
    const t = i / N
    const off = L * (t * t * 1.15 - 0.15 * Math.max(0, t - 0.8) * 5 * t)
    pts.push([x + 0.5 + Math.cos(ang) * off, y + 1 + t * H, z + 0.5 + Math.sin(ang) * off])
  }
  const top = pts[pts.length - 1].map(Math.floor)
  // ringed bark: jungle log with a band of wood every 2-3 blocks reads as the palm's leaf scars
  const ring = (px, py, pz) => (py % 3 === 0 ? 'minecraft:jungle_wood' : py % 3 === 1 ? 'minecraft:jungle_log[axis=y]' : 'minecraft:stripped_jungle_log[axis=y]')
  if (giant) {
    b.tubeAlong(pts, s => 1.75 - 0.85 * s, ring)
    // the root flare: short stubby roots splaying from the base into the ground
    for (let k = 0; k < 6; k += 1) {
      const a = ang + (k / 6) * TAU + rng.range(-0.3, 0.3)
      const r = rng.range(2.5, 3.6)
      b.tubeAlong([[x + 0.5, y + 2.2, z + 0.5], [x + 0.5 + Math.cos(a) * r * 0.6, y + 1.2, z + 0.5 + Math.sin(a) * r * 0.6], [x + 0.5 + Math.cos(a) * r, y, z + 0.5 + Math.sin(a) * r]], s => 0.95 - 0.1 * s, 'minecraft:jungle_wood')
    }
  } else {
    // one block thick: walk the line finely and set every cell it passes, face-connected
    let prev = null
    for (let i = 1; i < pts.length; i += 1) {
      const [a, c] = [pts[i - 1], pts[i]]
      const steps = Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) * 3)
      for (let k = 0; k <= steps; k += 1) {
        const q = [a[0] + ((c[0] - a[0]) * k) / steps, a[1] + ((c[1] - a[1]) * k) / steps, a[2] + ((c[2] - a[2]) * k) / steps].map(Math.floor)
        if (prev && prev[0] !== q[0] && prev[2] !== q[2]) b.set(q[0], prev[1], prev[2], ring(q[0], prev[1], prev[2]))
        if (prev && prev[1] !== q[1] && (prev[0] !== q[0] || prev[2] !== q[2])) b.set(q[0], prev[1], q[2], ring(q[0], prev[1], q[2]))
        b.set(q[0], q[1], q[2], ring(...q))
        prev = q
      }
    }
  }
  // the crown: fronds of jungle leaves (a few darker acacia/oak leaves for depth), 3 wide at the
  // base on a giant, 1 wide on a normal palm, rising then drooping
  const cells = []
  const leaf = (px, py, pz, k) => {
    const id = k < 0.12 ? 'minecraft:oak_leaves' : k < 0.2 ? 'minecraft:acacia_leaves' : 'minecraft:jungle_leaves'
    if (!b.get(px, py, pz) || /leaves/.test(b.nameAt(px, py, pz) ?? '')) {
      b.set(px, py, pz, `${id}[persistent=true]`)
      cells.push([px, py, pz])
    }
  }
  const nF = giant ? rng.int(9, 11) : rng.int(6, 8)
  const Lf = giant ? rng.range(10, 12.5) : rng.range(4, 5.8)
  const rise = giant ? 2.4 : 1.1
  const droop = giant ? 6.5 : 3.2
  const [tx, ty, tz] = [top[0] + 0.5, top[1] + 0.5, top[2] + 0.5]
  for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) if (Math.abs(dx) + Math.abs(dz) <= (giant ? 2 : 1)) leaf(top[0] + dx, top[1] + 1, top[2] + dz, 0.5)
  for (let f = 0; f < nF; f += 1) {
    const a = (f / nF) * TAU + rng.range(-0.25, 0.25)
    const len = Lf * rng.range(0.85, 1.12)
    const [ux, uz] = [Math.cos(a), Math.sin(a)]
    for (let s = 0; s <= len; s += 0.33) {
      const t = s / len
      const h = rise * Math.sin(Math.PI * Math.min(1, t * 1.4)) * (1 - t) - droop * t * t
      const px = tx + ux * s
      const py = ty + 1 + h
      const pz = tz + uz * s
      const k = kit.hash01(Math.floor(px), Math.floor(py), Math.floor(pz), seed + f)
      leaf(Math.floor(px), Math.floor(py), Math.floor(pz), k)
      // broad at the base, narrowing to the tip; a giant's frond also gets a lower edge row
      const w = giant ? (t < 0.55 ? 1.6 : t < 0.8 ? 1 : 0) : t > 0.2 && t < 0.6 ? 0.7 : 0
      if (w > 0)
        for (const side of [-1, 1]) {
          const qx = Math.floor(px - uz * side * w)
          const qz = Math.floor(pz + ux * side * w)
          leaf(qx, Math.floor(py - (giant && t > 0.3 ? 1 : 0)), qz, k)
        }
    }
  }
  // coconuts: cocoa pods on the trunk just under the crown, facing the log they hang on
  for (const [dx, dz, f] of [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'north'], [0, -1, 'south']]) {
    if (kit.hash01(top[0] + dx, top[1], top[2] + dz, seed + 7) < (giant ? 0.75 : 0.5) && !b.get(top[0] + dx, top[1] - 1, top[2] + dz) && /jungle/.test(b.nameAt(top[0], top[1] - 1, top[2]) ?? ''))
      b.set(top[0] + dx, top[1] - 1, top[2] + dz, `minecraft:cocoa[age=2,facing=${f}]`)
  }
  return { radius: Lf + L * 0.5, top: top[1] + 3, cells }
}

// Plant one tree of a named style. Returns { radius, top, cells } (cells = foliage, for snow/litter).
export function plantTree(ctx, name, [x, y, z], { size = 'medium', seed = 0, height, maxR, maxH, hues = HUES } = {}) {
  const { b, kit } = ctx
  const rng = kit.rng(seed * 31 + 7)
  const [h0, h1] = SIZE_H[size] ?? SIZE_H.medium
  let H = height ?? rng.int(h0, h1)
  // a broadleaf crown is about 0.6 (cherry 0.75) of its height in radius: in a tight spot plant a
  // smaller tree of the same shape rather than squeezing a big one into a lollipop
  const ratio = { cherry: 0.8, autumn: 0.62, oak: 0.62, big_oak: 0.62, blossom: 0.62, dark_oak: 0.7, crimson: 0.62 }[name]
  if (maxR && ratio) H = Math.max(5, Math.min(H, Math.round(maxR / ratio)))
  if (maxH) H = Math.max(4, Math.min(H, Math.round(maxH)))
  const base = [x, y + 1, z]
  const big = size === 'large'
  const small = size === 'small'
  const themeKey = ctx.theme?.key
  const snow = themeKey === 'winter'
  switch (name) {
    case 'autumn': {
      const hue = hues[Math.floor(kit.hash01(x, 0, z, seed + 3) * hues.length)]
      if (small) return youngTree(ctx, base, { height: H, seed, maxR, log: 'dark_oak_log', wood: 'dark_oak_wood', paint: autumnPaint(ctx, hue, seed * 3 + x) })
      return broadleaf(ctx, base, {
        height: H, seed, maxR, fork: big ? [0.34, 0.42] : small ? [0.4, 0.5] : [0.34, 0.44], leaders: big ? [3, 4] : small ? [2, 3] : [3, 4], depth: small ? 1 : 2,
        fork3: 0.4, reach: small ? 0.34 : big ? 0.26 : 0.27, elev: small ? [0.72, 0.5] : [0.56, 0.36, 0.26], split: [0.4, 0.75], decay: [0.6, 0.72], out: 0.2,
        cluster: big ? [3.2, 1.7] : small ? [2.2, 1.7] : [2.6, 1.95], holes: 0.22, rough: 0.34, flat: big ? 0.42 : 0.55, inner: 0.45, lobeVar: 0.25, sag: 0.8, dropChance: 0.2,
        trunk: big ? 1.45 : small ? 0.5 : 0.95, leader: !small, roots: big ? 5 : small ? 0 : 3,
        log: 'dark_oak_log', wood: 'dark_oak_wood', paint: autumnPaint(ctx, hue, seed * 3 + x),
      })
    }
    case 'crimson':
      // a crimson-forest tree grown tall: crimson stem limbs, a nether-wart crown lit by shroomlights,
      // weeping vines hanging from the rim
      if (small) return youngTree(ctx, base, { height: H, seed, maxR, log: 'crimson_stem', wood: 'crimson_hyphae', paint: crimsonPaint(ctx, seed) })
      return broadleaf(ctx, base, {
        height: H, seed, maxR, fork: [0.36, 0.44], leaders: big ? [3, 4] : [2, 3], depth: big ? 2 : 1, fork3: 0.35,
        reach: 0.3, elev: [0.58, 0.36, 0.26], split: [0.4, 0.75], decay: [0.6, 0.72], out: 0.25, bow: 0.1,
        cluster: big ? [3.1, 1.7] : [2.6, 1.6], holes: 0.16, rough: 0.34, flat: 0.5, inner: 0.4, lobeVar: 0.22, sag: 0.8,
        trunk: big ? 1.35 : 0.9, leader: !small, roots: big ? 4 : 2,
        log: 'crimson_stem', wood: 'crimson_hyphae', paint: crimsonPaint(ctx, seed),
        droop: { chance: 0.14, len: [1, 4], id: 'weeping_vines', outer: 0.45 },
      })
    case 'oak':
    case 'big_oak':
      if (small) return youngTree(ctx, base, { height: H, seed, maxR, log: 'oak_log', wood: 'oak_wood', paint: shadedPaint(ctx, { base: 'oak_leaves', under: 'dark_oak_leaves', over: 'azalea_leaves', seed }) })
      return broadleaf(ctx, base, {
        height: H, seed, maxR, fork: [0.34, 0.42], leaders: big ? [3, 5] : small ? [2, 3] : [3, 4], depth: small ? 1 : 2, fork3: 0.45,
        reach: 0.27, elev: [0.56, 0.38, 0.28], split: [0.4, 0.75], decay: [0.6, 0.72], out: 0.2,
        cluster: big ? [3.3, 2.0] : small ? [2.3, 1.6] : [2.8, 1.9], holes: 0.18, rough: 0.3, flat: 0.45, inner: 0.5, lobeVar: 0.22, sag: 0.7, dropChance: 0.18,
        trunk: big ? 1.5 : small ? 0.5 : 1.0, leader: !small, roots: big ? 5 : small ? 0 : 3,
        log: 'oak_log', wood: 'oak_wood',
        paint: shadedPaint(ctx, { base: 'oak_leaves', under: 'dark_oak_leaves', over: 'azalea_leaves', seed }),
      })
    case 'dark_oak':
      return broadleaf(ctx, base, {
        height: Math.round(H * 0.85), seed, maxR, fork: [0.35, 0.45], leaders: [3, 4], depth: big ? 2 : 1, reach: 0.38, elev: [0.5, 0.3, 0.25],
        split: [0.4, 0.7], decay: [0.6, 0.75], out: 0.4, cluster: [3.4, 1.8], holes: 0.12, rough: 0.28, flat: 0.5, trunk: big ? 1.6 : 1.1,
        log: 'dark_oak_log', wood: 'dark_oak_wood', roots: 5, paint: shadedPaint(ctx, { base: 'dark_oak_leaves', over: 'oak_leaves', seed }),
      })
    case 'cherry':
      // diagonal limbs that stay visible, each ending in a big round pink cloud, a few pink strands
      return broadleaf(ctx, base, {
        height: Math.round(H * (big ? 0.85 : 0.9)), seed, maxR, fork: [0.3, 0.38], leaders: big ? [3, 4] : small ? [2, 2] : [2, 3], depth: small ? 0 : 1, fork3: 0.35,
        reach: big ? 0.42 : 0.4, elev: [0.68, 0.42, 0.3], split: [0.45, 0.8], decay: [0.62, 0.76], out: 0.35, bow: 0.18, lift: 0.45,
        cluster: big ? [3.4, 2.1] : small ? [2.6, 1.7] : [3.0, 1.9], holes: 0.14, rough: 0.3, flat: 0.5, inner: 0.25, lobeVar: 0.2,
        trunk: big ? 1.15 : small ? 0.5 : 0.8, roots: big ? 4 : 2,
        log: 'cherry_log', wood: 'cherry_wood',
        paint: shadedPaint(ctx, { base: 'cherry_leaves', seed }),
        droop: big ? { chance: 0.1, len: [1, 2], id: 'leaves', leaf: 'cherry_leaves', outer: 0.6 } : null,
      })
    case 'blossom':
      if (small) return youngTree(ctx, base, { height: H, seed, maxR, log: 'cherry_log', wood: 'cherry_wood', paint: blossomPaint(ctx, seed) })
      return broadleaf(ctx, base, {
        height: H, seed, maxR, fork: [0.34, 0.42], leaders: big ? [3, 5] : [3, 4], depth: small ? 1 : 2, fork3: 0.5,
        reach: 0.27, elev: [0.56, 0.36, 0.26], split: [0.5, 0.85], decay: [0.6, 0.74], out: 0.25, bow: 0.14,
        cluster: big ? [3.1, 1.8] : [2.6, 1.6], holes: 0.15, rough: 0.32, flat: 0.45, lean: 0.1, inner: 0.65,
        trunk: big ? 1.3 : 0.8, leader: !small, roots: big ? 5 : 2,
        log: 'cherry_log', wood: 'cherry_wood',
        paint: blossomPaint(ctx, seed),
        droop: { chance: 0.08, len: [2, 5], id: 'cave_vines', outer: 0.4 },
      })
    case 'birch': {
      const t = b.tree(base, 'birch', { seed, height: Math.round(H * 1.05), roots: 0 })
      const cells = recolourBox(ctx, [x - 6, y + 2, z - 6], [x + 6, y + H + 6, z + 6], 'minecraft:birch_leaves', themeKey === 'autumn' ? goldenBirch(ctx, seed) : null)
      if (snow) snowOn(ctx, cells)
      return { radius: 4, top: t.top[1] + 3, cells }
    }
    case 'palm':
      return palmTree(ctx, [x, y, z], { seed, height: big ? Math.round(H * 1.1) : small ? Math.max(6, Math.round(H * 0.7)) : H })
    case 'azalea': {
      const t = b.tree(base, 'azalea', { seed, height: Math.max(4, Math.round(H * 0.6)) })
      return { radius: 3.5, top: t.top[1] + 3, cells: [] }
    }
    case 'spruce':
    case 'snowy_spruce':
      return conifer(ctx, base, { height: Math.round(H * (big ? 1.25 : 1.1)), seed, snow: snow || name === 'snowy_spruce', radius: Math.min(maxR ?? 99, big ? H * 0.3 : H * 0.27) - 0.6 })
    case 'pine':
      return pine(ctx, base, { height: Math.round(H * (big ? 1.15 : 1.05)), seed, snow, maxR: maxR ?? 99 })
    default:
      if (ctx.kit.TREE_SPECIES.includes(name)) {
        const t = b.tree(base, name, { seed, height: H })
        return { radius: H * 0.45, top: t.top[1] + 3, cells: [] }
      }
      return plantTree(ctx, 'oak', [x, y, z], { size, seed, height })
  }
}

// crimson: nether wart in clumps with darker leaves in the shade and a few shroomlights glowing
function crimsonPaint(ctx, seed) {
  const { kit } = ctx
  return crown => (x, y, z, info) => {
    if (info.depth > 1.6) return kit.hash01(x, y, z, seed + 2) < 0.06 ? 'shroomlight' : 'dark_oak_leaves'
    if (kit.hash01(x, y, z, seed + 7) < 0.035) return 'shroomlight'
    const n = kit.noise.coherent01(x, y, z, { scale: 2.4, grain: 0.12, seed: seed + 29 })
    return n < 0.14 ? 'dark_oak_leaves' : n > 0.9 ? 'red_terracotta' : 'nether_wart_block'
  }
}

// fantasy blossom: cherry pink, flowering azalea and azalea leaves in drifts, a light hidden in the heart
function blossomPaint(ctx, seed) {
  const { kit } = ctx
  return crown => (x, y, z, info) => {
    if (info.depth > 1.6) return kit.hash01(x, y, z, seed + 1) < 0.04 ? ctx.theme?.light ?? 'shroomlight' : 'azalea_leaves'
    const n = kit.noise.coherent01(x, y, z, { scale: 3, grain: 0.12, seed: seed + 23 })
    const lobeShift = kit.hash01(info.ci, 0, 0, seed + 4) - 0.5
    const v = n + 0.4 * lobeShift
    return v < 0.32 ? 'flowering_azalea_leaves' : v < 0.42 ? 'azalea_leaves' : 'cherry_leaves'
  }
}

function goldenBirch(ctx, seed) {
  const { kit } = ctx
  return (x, y, z) => {
    const v = kit.noise.coherent01(x, y, z, { scale: 2.2, grain: 0.15, seed: seed + 61 })
    return v < 0.22 ? 'birch_leaves' : v < 0.75 ? 'honeycomb_block' : v < 0.9 ? 'yellow_terracotta' : 'shroomlight'
  }
}

// recolour the leaves of `id` in a box with paint(x, y, z) (null keeps them); returns the cells
function recolourBox(ctx, min, max, id, paint) {
  const { b } = ctx
  const cells = []
  for (let x = min[0]; x <= max[0]; x += 1)
    for (let y = min[1]; y <= max[1]; y += 1)
      for (let z = min[2]; z <= max[2]; z += 1) {
        const blk = b.get(x, y, z)
        if (!blk || blk.name !== id) continue
        cells.push([x, y, z])
        if (paint) {
          const p = paint(x, y, z)
          if (p) b.set(x, y, z, isLeaves(ns(p)) ? LEAF(p) : ns(p))
        }
      }
  return cells
}

// fallen leaves: carpets clumped by colour (each drift mostly one colour)
function litterCarpet(kit, x, z, seed) {
  const c = kit.noise.coherent01(x, 11, z, { scale: 3, grain: 0.25, seed: seed + 97 })
  return c < 0.38 ? 'minecraft:orange_carpet' : c < 0.66 ? 'minecraft:red_carpet' : c < 0.86 ? 'minecraft:brown_carpet' : 'minecraft:yellow_carpet'
}

// Feature tree: a hand-shaped tree at a plaza quadrant, gate or garden, with its ground dressed
// (root flare in coarse dirt / podzol, and for autumn a sprinkle of fallen leaves and tulips).
export function featureTree(ctx, [x, y, z], { size = 'large', seed = 0, style, maxRadius, maxHeight } = {}) {
  style ??= ctx.theme?.trees?.feature ?? 'oak'
  const res = plantTree(ctx, style, [x, y, z], { size, seed, maxR: maxRadius ?? (size === 'large' ? 10 : size === 'medium' ? 7 : 4.5), maxH: maxHeight })
  if (!res) return null
  state(ctx).features.push({ x, z, r: res.radius ?? 6, top: res.top })
  dressTreeGround(ctx, [x, y, z], style, res, seed)
  return { radius: res.radius, height: (res.top ?? y + 12) - y }
}

// The ground under a feature tree: a ring of worn soil around the trunk, and for some styles the
// season on the floor (fallen leaves, petals, snow).
function dressTreeGround(ctx, [x, y, z], style, res, seed) {
  const { b, kit } = ctx
  const R = Math.max(3, Math.round((res.radius ?? 6) * 0.85))
  for (let dx = -R; dx <= R; dx += 1)
    for (let dz = -R; dz <= R; dz += 1) {
      const d = Math.hypot(dx, dz)
      if (d > R + 0.5 * kit.noise.fbm2(x + dx, z + dz, { scale: 3, seed })) continue
      const gx = x + dx
      const gz = z + dz
      const gy = groundAt(ctx, gx, gz)
      if (gy < 0) continue
      const top = b.get(gx, gy, gz)
      if (!top || !/^minecraft:(grass_block|dirt|coarse_dirt|podzol|rooted_dirt|moss_block|snow_block)$/.test(top.name)) continue
      if (b.get(gx, gy + 1, gz) && !PLANT.test(b.nameAt(gx, gy + 1, gz))) continue
      const n = kit.noise.coherent01(gx, 0, gz, { scale: 2.2, grain: 0.3, seed: seed + 91 })
      const near = 1 - d / (R + 1)
      if (style !== 'snowy_spruce' && n < 0.25 + 0.4 * near) b.set(gx, gy, gz, n < 0.2 ? 'minecraft:podzol' : n < 0.4 ? 'minecraft:coarse_dirt' : 'minecraft:rooted_dirt')
      if (b.get(gx, gy + 1, gz)) continue
      const u = kit.hash01(gx, gy, gz, seed + 92)
      if (style === 'autumn') {
        const patch = kit.noise.coherent01(gx, 7, gz, { scale: 2.2, grain: 0.2, seed: seed + 93 })
        if (patch < 0.2 + 0.18 * near && u < 0.6) b.set(gx, gy + 1, gz, litterCarpet(kit, gx, gz, seed))
        else if (u < 0.035 && d > 2) b.set(gx, gy + 1, gz, kit.hash01(gx, 2, gz, seed) < 0.5 ? 'minecraft:orange_tulip' : 'minecraft:red_tulip')
        else if (u < 0.16) b.set(gx, gy + 1, gz, 'minecraft:short_grass')
      } else if (style === 'cherry' || style === 'blossom') {
        if (u < 0.08 + 0.3 * near * near && kit.noise.coherent01(gx, 5, gz, { scale: 2.5, seed }) < 0.6) b.set(gx, gy + 1, gz, `minecraft:pink_petals[facing=${['north', 'east', 'south', 'west'][Math.floor(kit.hash01(gx, 3, gz, seed) * 4)]},flower_amount=${1 + Math.floor(kit.hash01(gx, 4, gz, seed) * 4)}]`)
      } else if (style === 'snowy_spruce') {
        if (u < 0.5) b.set(gx, gy + 1, gz, 'minecraft:snow[layers=1]')
      } else if (u < 0.12) b.set(gx, gy + 1, gz, u < 0.03 ? 'minecraft:fern' : 'minecraft:short_grass')
    }
}

// ================================================================ props

// Per-theme prop materials: lamp style, stone family (walls, bases), brick family (rims, arena),
// wood family (benches, stalls), the planter rim and the lantern.
const PROP_STYLE = {
  autumn: { lamp: 'wood', stone: 'cobblestone', brick: 'stone_brick', rim: 'log', soil: { podzol: 3, rooted_dirt: 2, coarse_dirt: 1 } },
  medieval: { lamp: 'wood', stone: 'cobblestone', brick: 'stone_brick', rim: 'brick', soil: { grass_block: 3, podzol: 1, coarse_dirt: 1 } },
  'white-town': { lamp: 'deepslate', stone: 'polished_deepslate', brick: 'polished_deepslate', rim: 'quartz', soil: { grass_block: 3, podzol: 1 } },
  japanese: { lamp: 'toro', stone: 'andesite', brick: 'stone_brick', rim: 'mossy', soil: { moss_block: 3, podzol: 1, grass_block: 1 } },
  winter: { lamp: 'wood', stone: 'cobblestone', brick: 'stone_brick', rim: 'log', soil: { podzol: 2, coarse_dirt: 1, snow_block: 1 } },
  fantasy: { lamp: 'birch', stone: 'mossy_cobblestone', brick: 'mossy_stone_brick', rim: 'mossy', soil: { moss_block: 2, grass_block: 2, rooted_dirt: 1 } },
  crimson: { lamp: 'wood', stone: 'blackstone', brick: 'polished_blackstone_brick', rim: 'brick', soil: { crimson_nylium: 3, podzol: 1, rooted_dirt: 1 } },
  tropical: { lamp: 'wood', stone: 'sandstone', brick: 'sandstone', rim: 'log', soil: { grass_block: 3, sand: 1, coarse_dirt: 1 } },
}

function mats(ctx) {
  if (ctx._mats) return ctx._mats
  const { kit } = ctx
  const t = ctx.theme ?? {}
  const key = t.key ?? 'medieval'
  const st = PROP_STYLE[key] ?? PROP_STYLE.medieval
  const wood = t.wood ?? 'spruce'
  const W = kit.material(wood)
  const S = kit.material(st.stone)
  const B = kit.material(st.brick)
  ctx._mats = {
    key, st, wood, W, S, B,
    log: ns(t.timber ?? `stripped_${wood}_log`),
    bark: ns(W.log ?? 'spruce_log'),
    lantern: ns(t.lantern ?? 'lantern'),
    accent: t.accent ?? 'red',
    light: ns(t.light ?? 'ochre_froglight'),
    snowy: key === 'winter',
    soil: kit.palette(st.soil, { scale: 2, seed: 5 }),
  }
  return ctx._mats
}
const across = f => (f === 'north' || f === 'south' ? [1, 0] : [0, 1])
const hang = (b, x, y, z, lantern) => b.set(x, y, z, `${lantern}[hanging=true,waterlogged=false]`)
const stand = (b, x, y, z, lantern) => b.set(x, y, z, `${lantern}[hanging=false,waterlogged=false]`)

// A themed lamp. kind 'post' (free-standing, default), 'wall' (a bracket lantern on the wall behind
// [x, z] seen from `facing`, the side the light faces), 'hanging' (a crook post with a lantern on a chain).
export function lamp(ctx, [x, y, z], { kind = 'post', facing, seed = 0, height } = {}) {
  const { b, kit } = ctx
  const m = mats(ctx)
  const rng = kit.rng(seed * 17 + x * 7 + z * 13 + 1)
  const dirs = ['north', 'east', 'south', 'west']
  const f = facing ?? dirs[rng.int(0, 3)]
  const [dx, dz] = DIRS[f]
  if (kind === 'wall') {
    // bracket on the wall at head height: a fence arm and a hanging lantern
    b.set(x, y + 3, z, `${m.W.fence}`)
    hang(b, x, y + 2, z, m.lantern)
    return
  }
  if (kind === 'hanging') {
    const h = height ?? 4
    b.set(x, y + 1, z, m.S.wall ?? m.S.block)
    for (let k = 2; k <= h; k += 1) b.set(x, y + k, z, `${m.log}[axis=y]`)
    b.set(x, y + h + 1, z, `${m.log}[axis=y]`)
    b.set(x + dx, y + h + 1, z + dz, m.W.fence)
    b.set(x + 2 * dx, y + h + 1, z + 2 * dz, m.W.fence)
    b.set(x + 2 * dx, y + h, z + 2 * dz, 'minecraft:chain[axis=y]')
    hang(b, x + 2 * dx, y + h - 1, z + 2 * dz, m.lantern)
    if (m.snowy) b.set(x, y + h + 2, z, 'minecraft:snow[layers=1]')
    return
  }
  switch (m.st.lamp) {
    case 'toro':
      stoneLantern(ctx, [x, y, z], { seed })
      return
    case 'deepslate': {
      // a dark post: a polished deepslate foot, wall shaft, a lantern under a slab cap
      const h = height ?? 3
      b.set(x, y + 1, z, 'minecraft:polished_deepslate')
      for (let k = 2; k <= h + 1; k += 1) b.set(x, y + k, z, 'minecraft:polished_deepslate_wall')
      stand(b, x, y + h + 2, z, m.lantern)
      b.set(x, y + h + 3, z, 'minecraft:smooth_quartz_slab[type=bottom]')
      return
    }
    case 'birch': {
      // an elven post: mossy foot, pale stem, a curled arm with a lantern, a tuft of flowering leaves
      const h = height ?? 3
      b.set(x, y + 1, z, m.S.wall)
      for (let k = 2; k <= h + 1; k += 1) b.set(x, y + k, z, 'minecraft:stripped_birch_log[axis=y]')
      b.set(x, y + h + 2, z, 'minecraft:birch_fence')
      b.set(x + dx, y + h + 2, z + dz, 'minecraft:birch_fence')
      hang(b, x + dx, y + h + 1, z + dz, m.lantern)
      b.set(x, y + h + 3, z, LEAF('flowering_azalea_leaves'))
      if (rng.chance(0.5)) b.set(x - dx, y + h + 2, z - dz, LEAF('azalea_leaves'))
      return
    }
    default: {
      // a timber post on a stone foot; the head is either a T with two lanterns hanging from it, an arm
      // with one lantern on a chain, or a lantern standing on the post under a little slab roof
      const h = height ?? 3
      const style = rng.int(0, 2)
      b.set(x, y + 1, z, m.S.wall)
      for (let k = 2; k <= h + 1; k += 1) b.set(x, y + k, z, m.W.fence)
      if (style === 2) {
        stand(b, x, y + h + 2, z, m.lantern)
        b.set(x, y + h + 3, z, `${m.W.slab}[type=bottom]`)
        if (m.snowy) b.set(x, y + h + 4, z, 'minecraft:snow[layers=1]')
        return
      }
      b.set(x, y + h + 2, z, `${m.log}[axis=y]`)
      b.set(x + dx, y + h + 2, z + dz, m.W.fence)
      if (style === 1) {
        b.set(x + 2 * dx, y + h + 2, z + 2 * dz, m.W.fence)
        b.set(x + 2 * dx, y + h + 1, z + 2 * dz, 'minecraft:chain[axis=y]')
        hang(b, x + 2 * dx, y + h, z + 2 * dz, m.lantern)
      } else {
        hang(b, x + dx, y + h + 1, z + dz, m.lantern)
        b.set(x - dx, y + h + 2, z - dz, m.W.fence)
        hang(b, x - dx, y + h + 1, z - dz, m.lantern)
      }
      if (m.snowy) b.set(x, y + h + 3, z, 'minecraft:snow[layers=1]')
    }
  }
}

// Japanese stone lantern (toro): a base, a neck, a platform, the firebox lantern and a stepped roof.
export function stoneLantern(ctx, [x, y, z], { seed = 0, small = false } = {}) {
  const { b } = ctx
  const mossy = ctx.kit.hash01(x, y, z, seed + 3) < 0.5
  const block = mossy ? 'minecraft:mossy_stone_bricks' : 'minecraft:polished_andesite'
  const stairs = mossy ? 'minecraft:mossy_stone_brick_stairs' : 'minecraft:stone_brick_stairs'
  let yy = y + 1
  b.set(x, yy++, z, block)
  if (!small) b.set(x, yy++, z, 'minecraft:andesite_wall')
  b.set(x, yy++, z, 'minecraft:polished_andesite')
  stand(b, x, yy++, z, 'minecraft:lantern')
  // the roof: stairs sloping out on four sides, a full block in the middle, a finial
  for (const [f, [dx, dz]] of Object.entries(DIRS)) b.set(x + dx, yy, z + dz, `${stairs}[facing=${OPP[f]},half=bottom]`)
  for (const [dx, dz, f] of [[1, 1, 'west'], [-1, 1, 'east'], [1, -1, 'west'], [-1, -1, 'east']]) b.set(x + dx, yy, z + dz, `${stairs}[facing=${f},half=bottom]`)
  b.set(x, yy, z, block)
  b.set(x, yy + 1, z, 'minecraft:stone_button[face=floor,facing=north]')
}

// A bench: stairs (the seat) with open trapdoor armrests; sometimes a potted plant at one end.
export function bench(ctx, [x, y, z], facing, { length = 3, seed = 0 } = {}) {
  const { b, kit } = ctx
  const m = mats(ctx)
  const [ax, az] = across(facing)
  const k0 = -Math.floor((length - 1) / 2)
  const k1 = k0 + length - 1
  const seat = m.key === 'white-town' ? kit.material('dark_oak') : m.W
  for (let k = k0; k <= k1; k += 1) b.set(x + ax * k, y + 1, z + az * k, `${seat.stairs}[facing=${OPP[facing]},half=bottom]`)
  const endF = ax ? ['west', 'east'] : ['north', 'south']
  const rng = kit.rng(seed * 5 + x * 3 + z)
  for (const [k, f] of [[k0 - 1, endF[0]], [k1 + 1, endF[1]]]) {
    const ex = x + ax * k
    const ez = z + az * k
    if (b.get(ex, y + 1, ez)) continue
    if (rng.chance(0.25)) {
      b.set(ex, y + 1, ez, m.S.block ?? 'minecraft:cobblestone')
      b.set(ex, y + 2, ez, pick(rng, ['minecraft:potted_azalea_bush', 'minecraft:potted_fern', 'minecraft:potted_red_tulip', 'minecraft:flower_pot']))
    } else b.set(ex, y + 1, ez, `${seat.trapdoor}[facing=${f},half=bottom,open=true]`)
  }
}
const pick = (rng, list) => list[Math.floor(rng() * list.length)]

// A raised bed: a 1-high rim (logs, bricks, quartz or mossy stone by theme) around soil with flowers,
// ferns and grass, and optionally a small tree in the middle. r = half size (2 → 5x5).
export function planter(ctx, [x, y, z], { r = 2, tree = true, seed = 0, style } = {}) {
  const { b, kit, theme } = ctx
  const m = mats(ctx)
  const rng = kit.rng(seed * 11 + x * 5 + z * 3 + 2)
  const flowers = (theme?.flowers ?? [[1, 'short_grass']]).filter(([, f]) => !/grass|fern|dead_bush/.test(f)).map(([, f]) => f)
  for (let dx = -r; dx <= r; dx += 1)
    for (let dz = -r; dz <= r; dz += 1) {
      if (Math.abs(dx) === r && Math.abs(dz) === r && r >= 2) continue
      const edge = Math.abs(dx) === r || Math.abs(dz) === r
      const px = x + dx
      const pz = z + dz
      if (edge) {
        let rim
        if (m.st.rim === 'log') rim = `${m.bark}[axis=${Math.abs(dx) === r ? 'z' : 'x'}]`
        else if (m.st.rim === 'quartz') rim = 'minecraft:smooth_quartz'
        else if (m.st.rim === 'mossy') rim = kit.hash01(px, y, pz, seed) < 0.5 ? 'minecraft:mossy_stone_bricks' : 'minecraft:mossy_cobblestone'
        else rim = kit.hash01(px, y, pz, seed) < 0.75 ? 'minecraft:stone_bricks' : 'minecraft:mossy_stone_bricks'
        b.set(px, y + 1, pz, rim)
        continue
      }
      b.set(px, y + 1, pz, m.soil)
      if (b.get(px, y + 2, pz)) continue
      const u = rng()
      if (u < 0.3 && flowers.length) b.set(px, y + 2, pz, `minecraft:${pick(rng, flowers.slice(0, 2))}`)
      else if (u < 0.5) b.set(px, y + 2, pz, rng.chance(0.5) ? 'minecraft:fern' : 'minecraft:short_grass')
    }
  if (tree) {
    const style0 = style ?? smallTreeFor(ctx)
    for (let k = 2; k <= 3; k += 1) if (PLANT.test(b.nameAt(x, y + k, z) ?? '')) b.remove(x, y + k, z)
    plantTree(ctx, style0, [x, y + 1, z], { size: 'small', seed: seed + 3 })
  }
}
function smallTreeFor(ctx) {
  const f = ctx.theme?.trees?.feature
  return { autumn: 'autumn', cherry: 'cherry', blossom: 'blossom', snowy_spruce: 'spruce', oak: 'azalea', pine: 'pine', crimson: 'crimson', palm: 'palm' }[f] ?? 'azalea'
}

// A round fountain: a stone rim around a basin, a column carrying a small bowl of water, sea
// pickles glowing in the basin.
export function fountain(ctx, [x, y, z], { r = 3 } = {}) {
  const { b, kit } = ctx
  const m = mats(ctx)
  const rimMat = m.key === 'white-town' ? kit.material('smooth_quartz') : m.key === 'fantasy' ? kit.material('polished_diorite') : m.B
  for (let dx = -r - 1; dx <= r + 1; dx += 1)
    for (let dz = -r - 1; dz <= r + 1; dz += 1) {
      const d = Math.hypot(dx, dz)
      if (d > r + 0.5) continue
      const px = x + dx
      const pz = z + dz
      for (let k = 1; k <= 3; k += 1) if (PLANT.test(b.nameAt(px, y + k, pz) ?? '')) b.remove(px, y + k, pz)
      if (d > r - 0.5) {
        b.set(px, y, pz, m.B.block)
        b.set(px, y + 1, pz, rimMat.block)
      } else {
        b.set(px, y - 1, pz, m.B.block)
        b.set(px, y, pz, kit.hash01(px, y, pz, 4) < 0.25 ? 'minecraft:mossy_stone_bricks' : m.B.block)
        b.set(px, y + 1, pz, 'minecraft:water')
        if (d > 1.2 && kit.hash01(px, y, pz, 5) < 0.12) b.set(px, y + 1, pz, 'minecraft:sea_pickle[pickles=3,waterlogged=true]')
      }
    }
  // the column and the bowl
  b.set(x, y + 1, z, m.B.block)
  b.set(x, y + 2, z, rimMat.wall ?? m.B.wall ?? m.B.block)
  b.set(x, y + 3, z, m.B.block)
  b.set(x, y + 4, z, 'minecraft:water')
  for (const [f, [dx, dz]] of Object.entries(DIRS)) {
    b.set(x + dx, y + 4, z + dz, `${rimMat.stairs ?? m.B.stairs}[facing=${OPP[f]},half=bottom]`)
    b.set(x + dx, y + 3, z + dz, `${rimMat.stairs ?? m.B.stairs}[facing=${OPP[f]},half=top]`)
  }
}

// A village well: a round stone rim around water, two timber posts, a little gable roof, a bucket
// (cauldron) on a chain.
export function well(ctx, [x, y, z], { facing = 'south' } = {}) {
  const { b, kit } = ctx
  const m = mats(ctx)
  const roof = kit.material(ctx.theme?.roof && kit.material(ctx.theme.roof).stairs ? ctx.theme.roof : m.wood)
  // the rim: the stone with a few mossy blocks, when the stone has a mossy variant (not every one does)
  const mossy = kit.material(m.S.block)?.mossy
  for (let dx = -2; dx <= 2; dx += 1)
    for (let dz = -2; dz <= 2; dz += 1) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue
      const px = x + dx
      const pz = z + dz
      for (let k = 1; k <= 3; k += 1) if (PLANT.test(b.nameAt(px, y + k, pz) ?? '')) b.remove(px, y + k, pz)
      if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
        for (let k = 3; k >= 1; k -= 1) b.set(px, y - k, pz, k === 3 ? 'minecraft:gravel' : 'minecraft:water')
        b.set(px, y, pz, 'minecraft:water')
      } else b.set(px, y + 1, pz, mossy && kit.hash01(px, y, pz, 6) < 0.3 ? mossy : m.S.block)
    }
  const [ax, az] = across(facing)
  for (const s of [-2, 2]) {
    for (let k = 2; k <= 3; k += 1) b.set(x + ax * s, y + k, z + az * s, m.W.fence)
    b.set(x + ax * s, y + 4, z + az * s, `${m.log}[axis=y]`)
  }
  for (let s = -2; s <= 2; s += 1) b.set(x + ax * s, y + 5, z + az * s, `${m.log}[axis=${ax ? 'x' : 'z'}]`)
  // roof: two rows of stairs either side of the ridge beam, a slab ridge
  const [fx, fz] = DIRS[facing]
  for (let s = -3; s <= 3; s += 1) {
    b.set(x + ax * s + fx, y + 5, z + az * s + fz, `${roof.stairs}[facing=${OPP[facing]},half=bottom]`)
    b.set(x + ax * s - fx, y + 5, z + az * s - fz, `${roof.stairs}[facing=${facing},half=bottom]`)
    b.set(x + ax * s, y + 6, z + az * s, `${roof.slab}[type=bottom]`)
  }
  b.set(x, y + 4, z, 'minecraft:chain[axis=y]')
  b.set(x, y + 3, z, 'minecraft:cauldron')
  if (m.snowy) for (let s = -3; s <= 3; s += 1) b.set(x + ax * s, y + 7, z + az * s, 'minecraft:snow[layers=1]')
}

// A market stall: corner posts, a counter on the customer side (`facing`) with goods on it, stock at
// the back (barrels, crates, a chest), a striped wool awning with a front valance, a lantern inside.
export function stall(ctx, [x, y, z], facing = 'south', { width = 5, colour, seed = 0 } = {}) {
  const { b, kit } = ctx
  const m = mats(ctx)
  const rng = kit.rng(seed * 13 + x * 3 + z * 5 + 9)
  const c1 = colour ?? m.accent
  const c2 = rng.chance(0.5) ? 'white' : rng.chance(0.5) ? 'light_gray' : 'brown'
  const [fx, fz] = DIRS[facing]
  const [ax, az] = across(facing)
  const half = Math.max(1, Math.floor(width / 2))
  const at = (u, v) => [x + ax * u - fx * v, z + az * u - fz * v]
  for (let u = -half; u <= half; u += 1)
    for (let v = 0; v <= 2; v += 1) {
      const [px, pz] = at(u, v)
      for (let k = 1; k <= 4; k += 1) if (PLANT.test(b.nameAt(px, y + k, pz) ?? '')) b.remove(px, y + k, pz)
    }
  for (const u of [-half, half])
    for (const v of [0, 2]) {
      const [px, pz] = at(u, v)
      for (let k = 1; k <= 3; k += 1) b.set(px, y + k, pz, `${m.log}[axis=y]`)
    }
  const goods = {
    autumn: ['minecraft:pumpkin', 'minecraft:carved_pumpkin[facing=' + facing + ']', 'minecraft:hay_block[axis=y]', 'minecraft:potted_red_mushroom', 'minecraft:barrel[facing=up,open=false]'],
    japanese: ['minecraft:potted_bamboo', 'minecraft:decorated_pot[facing=' + facing + ',cracked=false]', 'minecraft:potted_azalea_bush', 'minecraft:barrel[facing=up,open=false]'],
    winter: ['minecraft:barrel[facing=up,open=false]', 'minecraft:potted_spruce_sapling', 'minecraft:snow_block', 'minecraft:chest[facing=' + facing + ',type=single,waterlogged=false]'],
  }[m.key] ?? ['minecraft:melon', 'minecraft:barrel[facing=up,open=false]', 'minecraft:potted_poppy', 'minecraft:decorated_pot[facing=' + facing + ',cracked=false]', 'minecraft:hay_block[axis=y]']
  for (let u = -half + 1; u <= half - 1; u += 1) {
    const [px, pz] = at(u, 0)
    b.set(px, y + 1, pz, `${m.W.stairs}[facing=${OPP[facing]},half=top]`)
    if (rng.chance(0.6)) b.set(px, y + 2, pz, pick(rng, goods))
    const [qx, qz] = at(u, 2)
    b.set(qx, y + 1, qz, pick(rng, ['minecraft:barrel[facing=up,open=false]', 'minecraft:composter[level=0]', `minecraft:chest[facing=${facing},type=single,waterlogged=false]`, 'minecraft:barrel[facing=' + facing + ',open=false]']))
    if (rng.chance(0.5)) b.set(qx, y + 2, qz, pick(rng, ['minecraft:barrel[facing=up,open=false]', 'minecraft:composter[level=0]', ...goods]))
  }
  // the awning: stripes across the stall, one block higher at the back, a valance at the front
  for (let u = -half - 1; u <= half + 1; u += 1) {
    const wool = `minecraft:${((u + 100) % 2 === 0 ? c1 : c2)}_wool`
    for (let v = 0; v <= 2; v += 1) {
      const [px, pz] = at(u, v)
      b.set(px, y + (v === 2 ? 5 : 4), pz, wool)
    }
    const [px, pz] = at(u, -1)
    b.set(px, y + 3, pz, `minecraft:${((u + 100) % 2 === 0 ? c1 : c2)}_carpet`)
    b.set(px, y + 4, pz, `${m.W.slab}[type=bottom]`)
  }
  for (const u of [-half, half]) {
    const [px, pz] = at(u, 2)
    b.set(px, y + 4, pz, `${m.log}[axis=y]`)
  }
  const [lx, lz] = at(0, 1)
  hang(b, lx, y + 3, lz, m.lantern)
}

// Signs of life by houses and stalls: barrels, crates, hay, a wood pile, a cart, firewood, pots.
export function clutter(ctx, [x, y, z], kind = 'barrels', { seed = 0, facing } = {}) {
  const { b, kit } = ctx
  const m = mats(ctx)
  const rng = kit.rng(seed * 7 + x * 11 + z * 13 + 5)
  const f = facing ?? pick(rng, ['north', 'east', 'south', 'west'])
  const [fx, fz] = DIRS[f]
  const [ax, az] = across(f)
  const clear = (px, pz, h = 3) => {
    for (let k = 1; k <= h; k += 1) if (PLANT.test(b.nameAt(px, y + k, pz) ?? '')) b.remove(px, y + k, pz)
  }
  const free = (px, pz) => !b.get(px, y + 1, pz) || PLANT.test(b.nameAt(px, y + 1, pz) ?? '')
  const put = (px, py, pz, id) => {
    if (py === y + 1 && !free(px, pz)) return false
    clear(px, pz)
    b.set(px, py, pz, id)
    return true
  }
  switch (kind) {
    case 'barrels':
      put(x, y + 1, z, 'minecraft:barrel[facing=up,open=false]')
      put(x + ax, y + 1, z + az, `minecraft:barrel[facing=${f},open=false]`)
      if (rng.chance(0.6)) put(x, y + 2, z, rng.chance(0.5) ? 'minecraft:barrel[facing=up,open=false]' : pick(rng, ['minecraft:potted_fern', 'minecraft:lantern[hanging=false]', 'minecraft:flower_pot']))
      if (rng.chance(0.5)) put(x + fx, y + 1, z + fz, 'minecraft:barrel[facing=up,open=false]')
      break
    case 'crates':
      put(x, y + 1, z, 'minecraft:composter[level=0]')
      put(x + ax, y + 1, z + az, 'minecraft:composter[level=0]')
      put(x, y + 2, z, 'minecraft:composter[level=0]')
      if (rng.chance(0.6)) put(x - ax, y + 1, z - az, `minecraft:barrel[facing=${CW[f]},open=false]`)
      if (rng.chance(0.5)) put(x + ax, y + 2, z + az, `${m.W.trapdoor}[half=bottom,facing=${f}]`)
      break
    case 'hay':
      put(x, y + 1, z, `minecraft:hay_block[axis=${ax ? 'x' : 'z'}]`)
      put(x + ax, y + 1, z + az, `minecraft:hay_block[axis=${ax ? 'x' : 'z'}]`)
      put(x, y + 2, z, 'minecraft:hay_block[axis=y]')
      if (m.key === 'autumn') put(x + fx, y + 1, z + fz, rng.chance(0.5) ? 'minecraft:pumpkin' : `minecraft:carved_pumpkin[facing=${f}]`)
      else if (rng.chance(0.5)) put(x + fx, y + 1, z + fz, 'minecraft:hay_block[axis=y]')
      break
    case 'logs':
    case 'firewood': {
      // a stacked wood pile (3 long, 2 high, a top log) and, for firewood, a chopping stump
      const axis = ax ? 'x' : 'z'
      for (let k = -1; k <= 1; k += 1) {
        put(x + ax * k, y + 1, z + az * k, `${m.bark}[axis=${axis}]`)
        if (k <= 0) put(x + ax * k, y + 2, z + az * k, `${m.bark}[axis=${axis}]`)
      }
      if (kind === 'firewood') {
        put(x + ax * 2 + fx, y + 1, z + az * 2 + fz, `${m.bark}[axis=y]`)
        put(x + ax * 3, y + 1, z + az * 3, `${m.W.slab}[type=bottom]`)
        put(x - ax * 2, y + 1, z - az * 2, `${m.W.trapdoor}[half=bottom,facing=${f}]`)
      } else if (rng.chance(0.6)) put(x + fx, y + 1, z + fz, `${m.bark}[axis=y]`)
      break
    }
    case 'cart': {
      // a hand cart: a slab bed on two wheel trapdoors, a load, the shafts
      const [lx, lz] = [ax, az]
      for (const k of [0, 1]) put(x + lx * k, y + 1, z + lz * k, `${m.W.slab}[type=top]`)
      for (const s of [-1, 1]) put(x + fx * s, y + 1, z + fz * s, `${m.W.trapdoor}[half=bottom,open=true,facing=${s > 0 ? f : OPP[f]}]`)
      put(x + lx * 2, y + 1, z + lz * 2, m.W.fence)
      put(x, y + 2, z, pick(rng, m.key === 'autumn' ? ['minecraft:pumpkin', 'minecraft:hay_block[axis=y]'] : ['minecraft:hay_block[axis=y]', 'minecraft:barrel[facing=up,open=false]']))
      put(x + lx, y + 2, z + lz, pick(rng, ['minecraft:barrel[facing=up,open=false]', 'minecraft:composter[level=0]', 'minecraft:hay_block[axis=y]']))
      break
    }
    case 'pots':
    default: {
      const pots = ['minecraft:decorated_pot[facing=north,cracked=false]', 'minecraft:potted_fern', 'minecraft:potted_azalea_bush', 'minecraft:potted_red_tulip', 'minecraft:potted_oxeye_daisy']
      put(x, y + 1, z, pick(rng, pots))
      put(x + ax, y + 1, z + az, pick(rng, pots))
      if (rng.chance(0.6)) put(x + fx, y + 1, z + fz, pick(rng, pots))
    }
  }
}

// A torii gate: two vermilion posts on black feet, a tie beam (nuki), a plaque, a red under-lintel and a
// dark top lintel (kasagi) whose ends turn up. facing = the way you walk through it; width = the opening.
export function torii(ctx, [x, y, z], facing = 'north', { width = 5, height } = {}) {
  const { b } = ctx
  // one gate per approach: a second torii within 8 blocks of another is skipped
  const st = state(ctx)
  st.torii ??= []
  if (st.torii.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 8)) return null
  st.torii.push([x, z])
  const [ax, az] = across(facing)
  const half = Math.floor(width / 2) + 1
  const h = height ?? width + 2
  const red = 'minecraft:red_concrete'
  for (const s of [-half, half]) {
    const px = x + ax * s
    const pz = z + az * s
    b.set(px, y, pz, 'minecraft:polished_andesite')
    b.set(px, y + 1, pz, 'minecraft:polished_blackstone')
    for (let k = 2; k <= h - 1; k += 1) b.set(px, y + k, pz, red)
  }
  for (let s = -half - 1; s <= half + 1; s += 1) b.set(x + ax * s, y + h - 3, z + az * s, red)
  b.set(x, y + h - 2, z, 'minecraft:polished_blackstone')
  for (let s = -half - 1; s <= half + 1; s += 1) b.set(x + ax * s, y + h - 1, z + az * s, red)
  const end = ax ? ['west', 'east'] : ['north', 'south']
  for (let s = -half - 2; s <= half + 2; s += 1) {
    const id = s === -half - 2 ? `minecraft:polished_blackstone_stairs[facing=${end[0]},half=bottom]` : s === half + 2 ? `minecraft:polished_blackstone_stairs[facing=${end[1]},half=bottom]` : 'minecraft:polished_blackstone_slab[type=top]'
    b.set(x + ax * s, y + h, z + az * s, id)
  }
}

// A hedge along a line: 2 high leaves with a clumped mix, following the ground.
export function hedge(ctx, [x0, z0], [x1, z1], y, { height = 2, leaves, gaps = [] } = {}) {
  const { b, kit } = ctx
  const mix = kit.palette(leaves ?? (ctx.theme?.key === 'japanese' ? { azalea_leaves: 3, oak_leaves: 2 } : { oak_leaves: 4, azalea_leaves: 1, dark_oak_leaves: 1 }), { scale: 2 })
  const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0))
  for (let i = 0; i <= n; i += 1) {
    const x = Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n))
    const z = Math.round(z0 + ((z1 - z0) * i) / Math.max(1, n))
    if (gaps.some(([gx, gz, r]) => Math.hypot(x - gx, z - gz) <= r)) continue
    const gy = y ?? groundAt(ctx, x, z)
    const hh = height - (i === 0 || i === n ? 1 : 0)
    for (let k = 1; k <= hh; k += 1) {
      const id = mix(x, gy + k, z)
      b.set(x, gy + k, z, LEAF(bare(id)))
    }
  }
}

// A rock outcrop: one big noise-displaced boulder half buried with two or three smaller ones touching
// it, moss on the tops. r = the big rock's radius.
export function rockOutcrop(ctx, [x, y, z], { r = 2.4, seed = 0, moss = true } = {}) {
  const { b, kit } = ctx
  const rng = kit.rng(seed * 19 + x * 7 + z * 3 + 4)
  const snowy = ctx.theme?.key === 'winter'
  const rock = kit.palette(snowy ? { stone: 4, andesite: 3, cobblestone: 1, tuff: 1 } : { stone: 5, andesite: 3, cobblestone: 2, tuff: 1, mossy_cobblestone: 1 }, { scale: 2, seed: seed + 1 })
  const mossTop = moss && !snowy ? 'minecraft:moss_block' : undefined
  b.boulder([x, y + r * 0.25, z], [r * rng.range(1.0, 1.3), r * rng.range(0.7, 0.9), r * rng.range(0.85, 1.1)], rock, { seed, mossTop })
  const n = rng.int(1, 3)
  const a0 = rng() * TAU
  for (let i = 0; i < n; i += 1) {
    const a = a0 + (i * TAU) / n + rng.range(-0.5, 0.5)
    const d = r * rng.range(0.9, 1.3)
    const rr = r * rng.range(0.35, 0.55)
    const px = x + Math.cos(a) * d
    const pz = z + Math.sin(a) * d
    const gy = groundAt(ctx, Math.round(px), Math.round(pz))
    if (gy < 0) continue
    b.boulder([px, gy + rr * 0.2, pz], [rr * 1.2, rr * 0.8, rr], rock, { seed: seed + i + 1, mossTop })
  }
  if (snowy) {
    const cells = []
    const R = Math.ceil(r * 2.2)
    for (let dx = -R; dx <= R; dx += 1)
      for (let dz = -R; dz <= R; dz += 1) {
        const top = b.topY(x + dx, z + dz)
        if (top > y) cells.push([x + dx, top, z + dz])
      }
    snowOn(ctx, cells)
  }
}

// A clump of bamboo: stalks of mixed heights in a small disc, leaves on the top three segments.
export function bambooClump(ctx, [x, y, z], { r = 2, seed = 0 } = {}) {
  const { b, kit } = ctx
  const rng = kit.rng(seed * 23 + x * 3 + z * 7 + 8)
  for (let dx = -r; dx <= r; dx += 1)
    for (let dz = -r; dz <= r; dz += 1) {
      const d = Math.hypot(dx, dz)
      if (d > r + 0.3 || rng() > 0.55 - d * 0.08) continue
      const px = x + dx
      const pz = z + dz
      const gy = groundAt(ctx, px, pz)
      if (gy < 0 || !SOIL.test(b.nameAt(px, gy, pz) ?? '') || (b.get(px, gy + 1, pz) && !PLANT.test(b.nameAt(px, gy + 1, pz)))) continue
      const h = Math.round(rng.range(5, 12) * (1 - d / (r + 2)))
      for (let k = 1; k <= h; k += 1) {
        const leaves = k >= h - 1 ? 'large' : k >= h - 3 ? 'small' : 'none'
        b.set(px, gy + k, pz, `minecraft:bamboo[age=1,leaves=${leaves},stage=0]`)
      }
    }
}

// ================================================================ the PvP ruin

// Ruin materials per theme: structure mix, the shaft band, stairs/slab families, rubble, floor,
// what hangs from the lintels.
function ruinMats(ctx) {
  const { kit } = ctx
  const key = ctx.theme?.key ?? 'medieval'
  const P = (o, s = 2.5, seed = 7) => kit.palette(o, { scale: s, seed })
  const stone = {
    block: P({ stone_bricks: 6, cracked_stone_bricks: 2, mossy_stone_bricks: 2 }),
    lintel: P({ stone_bricks: 5, cracked_stone_bricks: 2, mossy_stone_bricks: 2, chiseled_stone_bricks: 1 }, 2, 9),
    band: 'minecraft:chiseled_stone_bricks', stairs: ['minecraft:stone_brick_stairs', 'minecraft:mossy_stone_brick_stairs'], slab: ['minecraft:stone_brick_slab', 'minecraft:mossy_stone_brick_slab', 'minecraft:cobblestone_slab'],
    rubble: P({ cobblestone: 3, mossy_cobblestone: 2, stone_bricks: 1, cracked_stone_bricks: 1, gravel: 1 }, 1.5, 11),
    floor: P({ stone_bricks: 5, cracked_stone_bricks: 2, mossy_stone_bricks: 2, andesite: 1, cobblestone: 1 }, 2.5, 13),
    pit: P({ coarse_dirt: 3, packed_mud: 2, rooted_dirt: 1, gravel: 1 }, 2, 15),
    hang: 'vines', wall: ['minecraft:stone_brick_wall', 'minecraft:mossy_stone_brick_wall', 'minecraft:cobblestone_wall'],
  }
  if (key === 'white-town') return { ...stone,
    block: P({ smooth_quartz: 4, quartz_bricks: 2, calcite: 1 }), lintel: P({ smooth_quartz: 4, quartz_bricks: 2, chiseled_quartz_block: 1 }, 2, 9), shaft: 'minecraft:quartz_pillar[axis=y]',
    band: 'minecraft:chiseled_quartz_block', stairs: ['minecraft:smooth_quartz_stairs', 'minecraft:quartz_stairs'], slab: ['minecraft:smooth_quartz_slab', 'minecraft:quartz_slab'],
    rubble: P({ calcite: 2, quartz_bricks: 1, smooth_quartz: 1, diorite: 1, gravel: 1 }, 1.5, 11), floor: P({ polished_andesite: 3, smooth_stone: 2, calcite: 1, andesite: 1 }, 2.5, 13),
    wall: ['minecraft:diorite_wall', 'minecraft:andesite_wall'] }
  if (key === 'japanese') return { ...stone,
    block: P({ red_terracotta: 3, red_concrete: 2, stripped_mangrove_wood: 2 }), lintel: P({ dark_oak_planks: 3, stripped_dark_oak_wood: 2 }, 2, 9),
    band: 'minecraft:polished_blackstone', stairs: ['minecraft:dark_oak_stairs', 'minecraft:stone_brick_stairs'], slab: ['minecraft:dark_oak_slab', 'minecraft:stone_brick_slab'],
    floor: P({ gravel: 3, stone_bricks: 2, mossy_stone_bricks: 1, andesite: 1 }, 2.5, 13), pit: P({ gravel: 3, coarse_dirt: 1 }, 2, 15), shrine: true }
  if (key === 'winter') return { ...stone,
    block: P({ stone_bricks: 5, cracked_stone_bricks: 2, packed_ice: 1, mossy_stone_bricks: 1 }), rubble: P({ cobblestone: 2, packed_ice: 2, snow_block: 2, stone_bricks: 1 }, 1.5, 11),
    floor: P({ stone_bricks: 4, packed_ice: 1, snow_block: 2, cracked_stone_bricks: 1 }, 2.5, 13), pit: P({ snow_block: 3, packed_ice: 1, gravel: 1 }, 2, 15), hang: 'none', snow: true }
  if (key === 'fantasy') return { ...stone,
    block: P({ calcite: 4, polished_diorite: 2, mossy_stone_bricks: 1 }), lintel: P({ calcite: 3, polished_diorite: 2, mossy_stone_bricks: 1 }, 2, 9),
    band: 'minecraft:amethyst_block', stairs: ['minecraft:polished_diorite_stairs', 'minecraft:mossy_stone_brick_stairs'], slab: ['minecraft:polished_diorite_slab', 'minecraft:mossy_stone_brick_slab'],
    rubble: P({ calcite: 2, mossy_cobblestone: 2, polished_diorite: 1, moss_block: 1 }, 1.5, 11), floor: P({ calcite: 3, mossy_stone_bricks: 2, polished_diorite: 2, moss_block: 1 }, 2.5, 13),
    pit: P({ moss_block: 2, rooted_dirt: 1, coarse_dirt: 1 }, 2, 15), hang: 'cave_vines', wall: ['minecraft:diorite_wall', 'minecraft:mossy_stone_brick_wall'] }
  if (key === 'autumn') return { ...stone, hang: 'autumn' }
  return stone
}

// The PvP zone: a ruined colonnade on a stepped stone pad. Broken columns of differing heights, a few
// lintels still standing (one over the entrance), fallen column drums and rubble, moss, vines and
// cobwebs, grass growing through the cracked paving; a continuous red line flush in the ground marks
// the boundary, with a rules hologram over the entrance. Mostly open floor with some cover.
export function pvpArena(ctx, { x0, z0, x1, z1, y, entrance = 'west' }) {
  const { b, kit } = ctx
  const M = ruinMats(ctx)
  const rng = kit.rng((ctx.seed ?? 1) * 41 + 3)
  const cx = Math.round((x0 + x1) / 2)
  const cz = Math.round((z0 + z1) / 2)
  const Rp = Math.max(7, Math.min(x1 - x0, z1 - z0) / 2 - 2.5)
  const Rc = Rp - 2.5
  const entA = { east: 0, south: Math.PI / 2, west: Math.PI, north: -Math.PI / 2 }[entrance] ?? Math.PI
  const F = y + 1 // the floor block level (players stand on it)
  const clearUp = (x, z, from, h = 4) => {
    for (let k = 0; k < h; k += 1) if (PLANT.test(b.nameAt(x, from + k, z) ?? '')) b.remove(x, from + k, z)
  }
  const st = (fam, facing, half = 'bottom') => `${fam}[facing=${facing},half=${half}]`
  const toward = (x, z, tx, tz) => (Math.abs(tx - x) >= Math.abs(tz - z) ? (tx > x ? 'east' : 'west') : tz > z ? 'south' : 'north')

  // 1. the red line: a rounded rectangle on the region border, flush in the ground
  const rr = 3
  for (let x = x0; x <= x1; x += 1)
    for (let z = z0; z <= z1; z += 1) {
      const qx = Math.max(Math.abs(x - (x0 + x1) / 2) - ((x1 - x0) / 2 - rr), 0)
      const qz = Math.max(Math.abs(z - (z0 + z1) / 2) - ((z1 - z0) / 2 - rr), 0)
      const sd = Math.hypot(qx, qz) - rr
      if (sd > 0.5 || sd <= -0.5) continue
      const gy = groundAt(ctx, x, z)
      if (gy < 0) continue
      b.set(x, gy, z, 'minecraft:red_concrete')
      clearUp(x, z, gy + 1, 2)
    }

  // 2. the pad: raised one block, a stair step all round (broken in places), cracked paving with
  // grass through it, a worn pit in the middle
  for (let x = Math.floor(cx - Rp - 1); x <= Math.ceil(cx + Rp + 1); x += 1)
    for (let z = Math.floor(cz - Rp - 1); z <= Math.ceil(cz + Rp + 1); z += 1) {
      const d = Math.hypot(x - cx, z - cz)
      const edge = Rp + 0.6 * kit.noise.fbm2(x, z, { scale: 4, seed: 3 })
      if (d > edge) continue
      clearUp(x, z, F, 4)
      b.set(x, y, z, 'minecraft:cobblestone')
      if (d > edge - 1) {
        if (kit.noise.coherent01(x, 0, z, { scale: 3, seed: 5 }) < 0.18) continue // a gap in the step
        b.set(x, F, z, st(M.stairs[kit.hash01(x, 1, z, 4) < 0.7 ? 0 : 1], toward(x, z, cx, cz)))
        continue
      }
      const crack = kit.noise.coherent01(x, 2, z, { scale: 2.5, grain: 0.3, seed: 9 })
      if (d < Rp * 0.42 + 0.8 * kit.noise.fbm2(x, z, { scale: 3, seed: 6 })) b.set(x, F, z, M.pit)
      else if (crack < 0.13 && !M.snow) {
        b.set(x, F, z, 'minecraft:grass_block')
        b.set(x, F + 1, z, kit.hash01(x, F, z, 3) < 0.6 ? 'minecraft:short_grass' : 'minecraft:fern')
      } else b.set(x, F, z, M.floor)
    }

  // 3. the colonnade: 2x2 columns on a ring, the entrance between two whole gate columns
  const N = Math.max(5, Math.min(14, Math.floor((TAU * Rc) / 5.4)))
  const cols = []
  for (let i = 0; i < N; i += 1) {
    let a = entA + ((i + 0.5) * TAU) / N
    if (i === 0) a += 0.12
    if (i === N - 1) a -= 0.12
    const px = Math.round(cx + Rc * Math.cos(a) - 0.5)
    const pz = Math.round(cz + Rc * Math.sin(a) - 0.5)
    const gate = i === 0 || i === N - 1
    const whole = gate || rng.chance(0.42)
    const h = whole ? rng.int(9, 10) : rng.int(2, 7)
    cols.push({ i, a, px, pz, h, whole, gate })
  }
  const shaftPaint = M.shaft ?? M.block
  for (const c of cols) {
    const { px, pz, h } = c
    const top = F + h
    for (let x = px; x <= px + 1; x += 1)
      for (let z = pz; z <= pz + 1; z += 1)
        for (let yy = F + 1; yy <= top; yy += 1) {
          const band = c.whole && (yy === F + 1 || yy === F + Math.round(h * 0.55))
          b.set(x, yy, z, band ? M.band : shaftPaint)
        }
    // base: stairs around the foot; capital: upside-down stairs around the head of whole columns
    for (let x = px - 1; x <= px + 2; x += 1)
      for (let z = pz - 1; z <= pz + 2; z += 1) {
        if (x >= px && x <= px + 1 && z >= pz && z <= pz + 1) continue
        const f = toward(x, z, px + 0.5, pz + 0.5)
        if (!b.get(x, F + 1, z) || PLANT.test(b.nameAt(x, F + 1, z) ?? '')) {
          if (kit.hash01(x, F, z, 21) < 0.85) b.set(x, F + 1, z, st(M.stairs[0], f))
        }
        if (c.whole) b.set(x, top, z, st(M.stairs[kit.hash01(x, top, z, 2) < 0.75 ? 0 : 1], f, 'top'))
      }
    if (!c.whole) {
      // a jagged break: knock out one or two of the top cells, a stair chunk on another
      const cells = [[px, pz], [px + 1, pz], [px, pz + 1], [px + 1, pz + 1]]
      const order = rng.shuffle(cells)
      b.remove(order[0][0], top, order[0][1])
      if (rng.chance(0.6) && h > 2) b.remove(order[1][0], top, order[1][1])
      b.set(order[3][0], top + 1, order[3][1], st(M.stairs[1], pick(rng, ['north', 'east', 'south', 'west'])))
      if (!M.snow && rng.chance(0.7)) b.set(order[2][0], top + 1, order[2][1], 'minecraft:moss_carpet')
    }
  }
  // lintels between neighbouring whole columns (the gate pair always), some broken in the middle
  const lintels = []
  for (let i = 0; i < N; i += 1) {
    const A = cols[i]
    const B = cols[(i + 1) % N]
    const gatePair = A.i === N - 1 && B.i === 0
    if (!A.whole || !B.whole) continue
    const ly = F + Math.min(A.h, B.h) + 1
    const broken = !gatePair && rng.chance(0.35)
    const ax = A.px + 0.5
    const az = A.pz + 0.5
    const bx = B.px + 0.5
    const bz = B.pz + 0.5
    const L = Math.hypot(bx - ax, bz - az)
    const cells = new Map()
    for (let t = 0; t <= 1.0001; t += 0.25 / L) {
      if (broken && t > 0.38 && t < 0.66) continue
      const x = ax + (bx - ax) * t - 0.5
      const z = az + (bz - az) * t - 0.5
      for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) cells.set(`${Math.round(x) + ox},${Math.round(z) + oz}`, [Math.round(x) + ox, Math.round(z) + oz])
    }
    for (const [x, z] of cells.values()) b.set(x, ly, z, M.lintel)
    // a cornice on the gate lintel
    if (gatePair) for (const [x, z] of cells.values()) if (kit.hash01(x, ly, z, 31) < 0.7) b.set(x, ly + 1, z, `${M.slab[0]}[type=bottom]`)
    lintels.push({ cells: [...cells.values()], y: ly, broken, gate: gatePair })
    if (broken) {
      // the fallen middle lies below, cracked in two
      const mx = Math.round((ax + bx) / 2)
      const mz = Math.round((az + bz) / 2)
      const along = Math.abs(bx - ax) > Math.abs(bz - az) ? 'x' : 'z'
      for (let k = -1; k <= 1; k += 1) {
        const x = along === 'x' ? mx + k : mx + (k === 1 ? 1 : 0)
        const z = along === 'z' ? mz + k : mz + (k === 1 ? 1 : 0)
        if (!b.get(x, F + 1, z)) b.set(x, F + 1, z, k === 0 ? `${M.slab[0]}[type=bottom]` : M.lintel)
      }
    }
  }
  // 4. cover and ruin: a few low wall fragments on the ring, fallen drums, rubble at broken columns
  for (let i = 0; i < N - 1; i += 1) {
    const A = cols[i]
    const B = cols[i + 1]
    if (A.gate || B.gate || A.whole || B.whole || !rng.chance(0.5)) continue
    const ax = A.px + 0.5
    const az = A.pz + 0.5
    const bx = B.px + 0.5
    const bz = B.pz + 0.5
    const L = Math.hypot(bx - ax, bz - az)
    for (let t = 0.2; t <= 0.8; t += 0.5 / L) {
      const x = Math.round(ax + (bx - ax) * t)
      const z = Math.round(az + (bz - az) * t)
      const hh = Math.max(1, Math.round(1 + 2 * kit.noise.coherent01(x, 0, z, { scale: 2, seed: 17 })))
      for (let k = 1; k <= hh; k += 1) if (!b.get(x, F + k, z) || PLANT.test(b.nameAt(x, F + k, z) ?? '')) b.set(x, F + k, z, k === hh ? pick(rng, M.wall) : M.block)
    }
  }
  const drums = []
  for (const c of cols) {
    if (c.whole) continue
    // rubble around the foot
    for (let k = 0; k < 7; k += 1) {
      const a = rng() * TAU
      const d = rng.range(1.5, 3.2)
      const x = Math.round(c.px + 0.5 + Math.cos(a) * d)
      const z = Math.round(c.pz + 0.5 + Math.sin(a) * d)
      const gy = Math.hypot(x - cx, z - cz) <= Rp - 1 ? F : groundAt(ctx, x, z)
      if (gy < 0 || (b.get(x, gy + 1, z) && !PLANT.test(b.nameAt(x, gy + 1, z)))) continue
      clearUp(x, z, gy + 1, 2)
      b.set(x, gy + 1, z, rng.chance(0.5) ? `${pick(rng, M.slab)}[type=bottom]` : rng.chance(0.5) ? M.rubble : st(pick(rng, M.stairs), pick(rng, ['north', 'east', 'south', 'west'])))
    }
    if (c.h <= 6 && drums.length < 4 && rng.chance(0.75)) drums.push(c)
  }
  for (const [k, c] of drums.entries()) {
    // a fallen drum lies tangent to the ring, inside for cover on alternate ones
    const inward = k % 2 === 0
    const a = c.a + (inward ? 0 : 0.05)
    const r0 = inward ? Rc - 3.2 : Rc + 2.6
    const mx = cx + Math.cos(a) * r0
    const mz = cz + Math.sin(a) * r0
    const tx = -Math.sin(a)
    const tz = Math.cos(a)
    const along = Math.abs(tx) > Math.abs(tz) ? 'x' : 'z'
    const len = rng.int(2, 3)
    const base = inward || Math.hypot(mx - cx, mz - cz) <= Rp - 1 ? F : groundAt(ctx, Math.round(mx), Math.round(mz))
    if (base < 0) continue
    for (let s = 0; s < len; s += 1) {
      const x = Math.round(mx + (along === 'x' ? s : 0))
      const z = Math.round(mz + (along === 'z' ? s : 0))
      for (const [oy, ox] of [[1, 0], [2, 0], [1, 1], [1, -1]]) {
        const px = x + (along === 'z' ? ox : 0)
        const pz = z + (along === 'x' ? ox : 0)
        if (b.get(px, base + oy, pz) && !PLANT.test(b.nameAt(px, base + oy, pz))) continue
        clearUp(px, pz, base + oy, 1)
        b.set(px, base + oy, pz, oy === 2 || ox !== 0 ? st(M.stairs[0], ox > 0 ? (along === 'x' ? 'north' : 'west') : ox < 0 ? (along === 'x' ? 'south' : 'east') : along === 'x' ? 'north' : 'west', oy === 2 ? 'bottom' : 'bottom') : (M.shaft ?? M.block))
      }
    }
  }
  // 5. green and age: vines down the column faces, moss, cobwebs under the lintels, hanging leaves
  const vine = (x, yy, z, side) => b.set(x, yy, z, `minecraft:vine[${side}=true]`)
  for (const c of cols) {
    const top = F + c.h
    for (const [ox, oz, side] of [[-1, 0, 'east'], [-1, 1, 'east'], [2, 0, 'west'], [2, 1, 'west'], [0, -1, 'south'], [1, -1, 'south'], [0, 2, 'north'], [1, 2, 'north']]) {
      const x = c.px + ox
      const z = c.pz + oz
      if (kit.noise.coherent01(x, 0, z, { scale: 2, seed: 23 }) > 0.42 || M.snow) continue
      const len = rng.int(2, Math.max(2, c.h - 2))
      for (let k = 0; k < len; k += 1) {
        const yy = top - 1 - k
        if (yy <= F + 1 || b.get(x, yy, z)) break
        vine(x, yy, z, side)
      }
    }
  }
  for (const l of lintels) {
    for (const [x, z] of l.cells) {
      const u = kit.hash01(x, l.y, z, 41)
      if (!b.get(x, l.y + 1, z) && u < (M.snow ? 0.8 : 0.3)) b.set(x, l.y + 1, z, M.snow ? 'minecraft:snow[layers=2]' : 'minecraft:moss_carpet')
      if (b.get(x, l.y - 1, z)) continue
      const v = kit.hash01(x, l.y, z, 43)
      if (M.hang === 'autumn' && v < 0.3) {
        // autumn leaves trailing off the lintel: a short strand of wart / honeycomb / shroomlight
        const n = rng.int(1, 3)
        for (let k = 1; k <= n; k += 1) {
          if (b.get(x, l.y - k, z)) break
          b.set(x, l.y - k, z, pick(rng, ['minecraft:nether_wart_block', 'minecraft:nether_wart_block', 'minecraft:honeycomb_block', 'minecraft:shroomlight', 'minecraft:orange_terracotta']))
        }
        if (rng.chance(0.4)) b.set(x, l.y + 1, z, pick(rng, ['minecraft:nether_wart_block', 'minecraft:honeycomb_block']))
      } else if (M.hang === 'autumn' && v < 0.42) {
        const n = rng.int(2, 4)
        for (let k = 1; k <= n; k += 1) {
          if (b.get(x, l.y - k, z) || b.get(x, l.y - k - 1, z)) break
          b.set(x, l.y - k, z, k === n ? 'minecraft:weeping_vines[age=25]' : 'minecraft:weeping_vines_plant')
        }
      } else if (M.hang === 'cave_vines' && v < 0.3) {
        const n = rng.int(2, 5)
        for (let k = 1; k <= n; k += 1) {
          if (b.get(x, l.y - k, z) || b.get(x, l.y - k - 1, z)) break
          b.set(x, l.y - k, z, k === n ? `minecraft:cave_vines[age=25,berries=${rng.chance(0.5)}]` : `minecraft:cave_vines_plant[berries=${rng.chance(0.4)}]`)
        }
      } else if (v > 0.93) b.set(x, l.y - 1, z, 'minecraft:cobweb')
    }
    // a lantern on a chain under the middle of each standing lintel
    if (!l.broken) {
      const [x, z] = l.cells[Math.floor(l.cells.length / 2)]
      if (!b.get(x, l.y - 1, z) && !b.get(x, l.y - 2, z)) {
        b.set(x, l.y - 1, z, 'minecraft:chain[axis=y]')
        hang(b, x, l.y - 2, z, mats(ctx).lantern)
      }
    }
  }
  // cobwebs at a few column feet, glow lichen on fantasy stone, snow on winter tops
  for (const c of cols) {
    if (rng.chance(0.25)) {
      const [x, z] = [c.px + pick(rng, [-1, 2]), c.pz + pick(rng, [0, 1])]
      if (!b.get(x, F + 2, z)) b.set(x, F + 2, z, 'minecraft:cobweb')
    }
  }
  if (M.snow) {
    const cells = []
    for (let x = Math.floor(cx - Rp - 3); x <= Math.ceil(cx + Rp + 3); x += 1)
      for (let z = Math.floor(cz - Rp - 3); z <= Math.ceil(cz + Rp + 3); z += 1) {
        const t = b.topY(x, z)
        if (t >= y) cells.push([x, t, z])
      }
    snowOn(ctx, cells.filter(([x, t, z]) => !/_stairs|_slab|chain|lantern|vine|cobweb|snow|red_concrete|_wall$|_fence$/.test(b.nameAt(x, t, z) ?? '')))
  }
  // a broken torii at a shrine ruin's entrance
  if (M.shrine) {
    const ex = Math.round(cx + Math.cos(entA) * (Rp + 1.5))
    const ez = Math.round(cz + Math.sin(entA) * (Rp + 1.5))
    const walk = { east: 'west', west: 'east', north: 'south', south: 'north' }[entrance] ?? 'east'
    torii(ctx, [ex, groundAt(ctx, ex, ez), ez], walk, { width: 5 })
  }
  // 6. the entrance: lamps flanking the path at the line, the rules hologram over it
  const side = { west: [x0, cz], east: [x1, cz], north: [cx, z0], south: [cx, z1] }[entrance] ?? [x0, cz]
  const [ox, oz] = DIRS[entrance] ?? [-1, 0]
  const [px, pz] = [Math.abs(oz), Math.abs(ox)]
  for (const s of [-4, 4]) {
    const lx = side[0] + ox * 2 + px * s
    const lz = side[1] + oz * 2 + pz * s
    const gy = groundAt(ctx, lx, lz)
    if (gy >= 0 && !b.get(lx, gy + 1, lz)) lamp(ctx, [lx, gy, lz], { kind: 'post', facing: s < 0 ? (px ? 'west' : 'north') : px ? 'east' : 'south', seed: s })
  }
  ctx.hologram?.('pvp-rules', 'PvP ZONE - enter at your own risk', [side[0], y + 4, side[1]])
  b.region('pvp', [x0, y - 2, z0], [x1, y + 30, z1], { pvp: 'allow', priority: 20 })
  return { center: [cx, F, cz], radius: Rp }
}

// ================================================================ the AFK garden

// A quiet garden pool: an irregular pond with lily pads and a stone rim, stepping stones, benches facing
// the water, lamps, a small tree, a low hedge with an opening toward the spawn; region 'afk'.
export function afkPark(ctx, { x0, z0, x1, z1, y }) {
  const { b, kit, C } = ctx
  const m = mats(ctx)
  const rng = kit.rng((ctx.seed ?? 1) * 53 + 7)
  const cx = Math.round((x0 + x1) / 2)
  const cz = Math.round((z0 + z1) / 2)
  const R = Math.max(3, Math.min(x1 - x0, z1 - z0) / 2 - 3.5)
  const toSpawn = C ? Math.atan2(C[1] - cz, C[0] - cx) : 0
  const winter = m.snowy
  // the pond
  for (let x = Math.floor(cx - R - 2); x <= Math.ceil(cx + R + 2); x += 1)
    for (let z = Math.floor(cz - R - 2); z <= Math.ceil(cz + R + 2); z += 1) {
      const d = Math.hypot(x - cx, z - cz) / (R * (1 + 0.18 * kit.noise.fbm2(x, z, { scale: 4, seed: 61 })))
      if (d > 1.22) continue
      for (let k = 1; k <= 3; k += 1) if (PLANT.test(b.nameAt(x, y + k, z) ?? '')) b.remove(x, y + k, z)
      if (d > 1) {
        b.set(x, y, z, kit.hash01(x, y, z, 3) < 0.6 ? 'minecraft:mossy_cobblestone' : m.key === 'white-town' ? 'minecraft:smooth_quartz' : 'minecraft:cobblestone')
        continue
      }
      const depth = Math.max(1, Math.round(2.5 * (1 - d * d)))
      b.set(x, y - depth - 1, z, kit.hash01(x, 0, z, 5) < 0.5 ? 'minecraft:clay' : 'minecraft:gravel')
      for (let k = 0; k <= depth; k += 1) b.set(x, y - k, z, 'minecraft:water')
      if (winter && d < 0.85) b.set(x, y, z, 'minecraft:ice')
      else if (!winter && d > 0.35 && kit.noise.coherent01(x, 1, z, { scale: 2.5, seed: 63 }) < 0.22) b.set(x, y + 1, z, 'minecraft:lily_pad')
      else if (!winter && depth >= 2 && kit.hash01(x, 2, z, 7) < 0.25) b.set(x, y - depth, z, 'minecraft:seagrass')
      if (!winter && kit.hash01(x, 3, z, 9) < 0.04) b.set(x, y - depth, z, 'minecraft:sea_pickle[pickles=2,waterlogged=true]')
    }
  // stepping stones across the pond toward the spawn side
  for (let t = -R; t <= R; t += 2) {
    const x = Math.round(cx + Math.cos(toSpawn + 0.5) * t)
    const z = Math.round(cz + Math.sin(toSpawn + 0.5) * t)
    b.set(x, y, z, 'minecraft:polished_andesite')
    if (b.nameAt(x, y + 1, z) === 'minecraft:lily_pad') b.remove(x, y + 1, z)
  }
  // benches facing the water on three sides, lamps between them, a tree on the far side
  const places = [toSpawn + Math.PI * 0.55, toSpawn + Math.PI, toSpawn - Math.PI * 0.55]
  for (const [i, a] of places.entries()) {
    const bx = Math.round(cx + Math.cos(a) * (R + 2.5))
    const bz = Math.round(cz + Math.sin(a) * (R + 2.5))
    const gy = groundAt(ctx, bx, bz)
    if (gy < 0) continue
    const f = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'west' : 'east') : Math.sin(a) > 0 ? 'north' : 'south'
    if (i === 1) planter(ctx, [Math.round(cx + Math.cos(a) * (R + 4.5)), gy, Math.round(cz + Math.sin(a) * (R + 4.5))], { r: 2, tree: true, seed: 5 })
    else bench(ctx, [bx, gy, bz], f, { length: 3, seed: i })
    const la = a + 0.5
    const lx = Math.round(cx + Math.cos(la) * (R + 2.5))
    const lz = Math.round(cz + Math.sin(la) * (R + 2.5))
    const ly = groundAt(ctx, lx, lz)
    if (ly >= 0 && !b.get(lx, ly + 1, lz)) lamp(ctx, [lx, ly, lz], { kind: 'post', seed: i + 3 })
  }
  // a low hedge around the garden, open toward the spawn
  const hx0 = x0 + 1
  const hz0 = z0 + 1
  const hx1 = x1 - 1
  const hz1 = z1 - 1
  const gx = Math.round(cx + Math.cos(toSpawn) * 99)
  const gz = Math.round(cz + Math.sin(toSpawn) * 99)
  const gate = [[clamp(gx, hx0, hx1), clamp(gz, hz0, hz1), 2.5]]
  if (!winter) {
    hedge(ctx, [hx0, hz0], [hx1, hz0], y, { height: 1, gaps: gate })
    hedge(ctx, [hx0, hz1], [hx1, hz1], y, { height: 1, gaps: gate })
    hedge(ctx, [hx0, hz0], [hx0, hz1], y, { height: 1, gaps: gate })
    hedge(ctx, [hx1, hz0], [hx1, hz1], y, { height: 1, gaps: gate })
  }
  void rng
  b.region('afk', [x0, y - 4, z0], [x1, y + 12, z1], { 'mob-spawning': 'deny', pvp: 'deny', priority: 20 })
}

// ================================================================ the landscape pass

// Chamfer distance (blocks) from every column to the nearest source column.
function distanceField(S, src) {
  const d = new Float32Array(S * S)
  for (let i = 0; i < S * S; i += 1) d[i] = src[i] ? 0 : 1e6
  const D2 = Math.SQRT2
  for (let z = 0; z < S; z += 1)
    for (let x = 0; x < S; x += 1) {
      const i = x + S * z
      let v = d[i]
      if (x > 0) v = Math.min(v, d[i - 1] + 1)
      if (z > 0) {
        v = Math.min(v, d[i - S] + 1)
        if (x > 0) v = Math.min(v, d[i - S - 1] + D2)
        if (x < S - 1) v = Math.min(v, d[i - S + 1] + D2)
      }
      d[i] = v
    }
  for (let z = S - 1; z >= 0; z -= 1)
    for (let x = S - 1; x >= 0; x -= 1) {
      const i = x + S * z
      let v = d[i]
      if (x < S - 1) v = Math.min(v, d[i + 1] + 1)
      if (z < S - 1) {
        v = Math.min(v, d[i + S] + 1)
        if (x < S - 1) v = Math.min(v, d[i + S + 1] + D2)
        if (x > 0) v = Math.min(v, d[i + S - 1] + D2)
      }
      d[i] = v
    }
  return d
}

const ROCKY = /^minecraft:(stone|andesite|tuff|cobblestone|gravel|diorite|granite|calcite|deepslate|cobbled_deepslate|mossy_cobblestone)$/
const BUSH_LEAVES = {
  autumn: [['oak_leaves', 3], ['azalea_leaves', 2], ['dark_oak_leaves', 1]],
  japanese: [['azalea_leaves', 3], ['flowering_azalea_leaves', 2]],
  winter: [['spruce_leaves', 4], ['dark_oak_leaves', 1]],
  fantasy: [['flowering_azalea_leaves', 3], ['azalea_leaves', 2], ['cherry_leaves', 1]],
  'white-town': [['oak_leaves', 3], ['azalea_leaves', 2], ['flowering_azalea_leaves', 1]],
  crimson: [['dark_oak_leaves', 3], ['oak_leaves', 1]],
  tropical: [['jungle_leaves', 3], ['azalea_leaves', 1], ['flowering_azalea_leaves', 1]],
}

// A bush: a squat leaf lobe around a log heart, the theme's leaf mix in clumps.
export function bushAt(ctx, [x, y, z], { r = 1.6, seed = 0 } = {}) {
  const { b, kit } = ctx
  const list = BUSH_LEAVES[ctx.theme?.key] ?? [['oak_leaves', 3], ['azalea_leaves', 1]]
  const total = list.reduce((s, [, w]) => s + w, 0)
  const paint = () => (px, py, pz) => {
    let n = kit.noise.coherent01(px, py, pz, { scale: 2, grain: 0.2, seed: seed + 3 }) * total
    for (const [id, w] of list) {
      if (n < w) return id
      n -= w
    }
    return list[0][0]
  }
  if (r > 1.3) b.set(x, y + 1, z, `${ns(ctx.theme?.key === 'winter' ? 'spruce_log' : 'oak_log')}[axis=y]`)
  const cells = []
  lobe(b, kit, [x, y + 1 + r * 0.2, z], [r, r * 0.72, r * (0.85 + 0.3 * kit.hash01(x, y, z, seed))], paint(), { seed: seed + x * 3 + z, holes: 0.2, rough: 0.3, flat: 0.55, cells })
  return cells
}

export function landscapePass(ctx) {
  const T0 = Date.now()
  const { b, kit, S, grid, site, theme, FY } = ctx
  const L = ctx.layout ?? {}
  const st = state(ctx)
  const key = theme?.key ?? 'medieval'
  const winter = key === 'winter'
  const rng = kit.rng((ctx.seed ?? 1) * 9176 + 11)
  const seed = ctx.seed ?? 1
  const N = S * S
  const [cx, cz] = ctx.C ?? [S >> 1, S >> 1]
  const coh = (x, z, scale, s, grain = 0) => kit.noise.coherent01(x, 0, z, { scale, grain, seed: seed + s })

  // ---------------------------------------------------------------- 1. read the ground
  // cls: 0 natural free ground, 1 reserved natural ground, 2 paved / built / occupied, 3 off the island or water
  const cls = new Uint8Array(N)
  const gyA = new Int16Array(N).fill(-1)
  const ground = site.ground
  for (let x = 0; x < S; x += 1)
    for (let z = 0; z < S; z += 1) {
      const i = x + S * z
      if (!site.land(x, z) || site.isWater?.(x, z)) {
        cls[i] = 3
        continue
      }
      const gy = site.groundY(x, z)
      gyA[i] = gy
      if (site.paved?.[i]) {
        cls[i] = 2
        continue
      }
      const blk = b.get(x, gy, z)
      const above = b.get(x, gy + 1, z)
      if (!blk || (above && !PLANT.test(above.name))) {
        cls[i] = 2
        continue
      }
      let natural = false
      if (SOIL.test(blk.name) || ROCKY.test(blk.name) || /^minecraft:(sand|snow_block)$/.test(blk.name)) {
        const expect = typeof ground === 'function' ? ns(ground(x, gy, z)) : null
        natural = !expect || blk.name === expect || ROCKY.test(blk.name) || blk.name === 'minecraft:sand' || (blk.name === 'minecraft:snow_block' && winter)
        if (ROCKY.test(blk.name) && /cobblestone|gravel|andesite/.test(blk.name)) {
          // rock is natural on steep ground; on the flat it is a path
          let slope = 0
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) slope = Math.max(slope, Math.abs(site.groundY(x + dx, z + dz) - gy))
          natural = slope >= 2
        }
      }
      if (!natural) cls[i] = 2
      else cls[i] = grid.tag(x, z) !== null ? 1 : 0
    }
  // the spawn kit's stand-off cells (in front of NPCs, crates, the spawn) stay clear of everything
  for (const { cells } of b.spawnClearance ?? []) for (const [x, , z] of cells) if (x >= 0 && z >= 0 && x < S && z < S) cls[x + S * z] = 2
  // distances: to anything reserved, paved or built (crowns must not reach it); to the features
  // (slots other than feature trees, and the plaza) for the size of what stands near them
  const blocked = new Uint8Array(N)
  const feat = new Uint8Array(N)
  for (let i = 0; i < N; i += 1) {
    if (cls[i] === 1 || cls[i] === 2) blocked[i] = 1
    const x = i % S
    const z = (i - x) / S
    const tag = grid.tag(x, z)
    if (tag !== null && tag !== 'tree' && tag !== 'outside') feat[i] = 1
  }
  const dBlocked = distanceField(S, blocked)
  const dFeat = distanceField(S, feat)
  // in front of a feature: between it and the spawn (a ray outward from the column meets a slot)
  const front = new Uint8Array(N)
  const plazaR = L.plaza?.r ?? (L.plaza ? Math.max(L.plaza.x1 - L.plaza.x0, L.plaza.z1 - L.plaza.z0) / 2 : 10)
  for (let x = 0; x < S; x += 1)
    for (let z = 0; z < S; z += 1) {
      const i = x + S * z
      if (cls[i] !== 0) continue
      const dx = x - cx
      const dz = z - cz
      const r = Math.hypot(dx, dz) || 1
      if (r < plazaR + 10) {
        front[i] = 1
        continue
      }
      for (let k = 2; k <= 26; k += 2) {
        const tag = grid.tag(Math.round(x + (dx / r) * k), Math.round(z + (dz / r) * k))
        if (tag && tag !== 'tree' && tag !== 'outside' && tag !== 'plaza') {
          front[i] = 1
          break
        }
      }
    }

  // ---------------------------------------------------------------- 2. where the woods grow
  const edgeE = site.edgeE ?? ((x, z) => Math.hypot(x - cx, z - cz) / (S / 2))
  const dens = new Float32Array(N)
  for (let x = 0; x < S; x += 1)
    for (let z = 0; z < S; z += 1) {
      const i = x + S * z
      if (cls[i] !== 0) continue
      const e = edgeE(x, z)
      const hill = smooth(2, 9, gyA[i] - FY)
      const ring = smooth(0.48, 0.8, e)
      const clump = coh(x, z, 20, 101)
      let D = Math.max(ring, hill * 0.85) * (0.15 + 1.25 * clump)
      // parkland between the plaza and the woods: the odd small tree and bush
      if (!front[i] && e > 0.3) D = Math.max(D, 0.12 * smooth(0.3, 0.45, e))
      if (coh(x, z, 15, 103) > 0.78) D *= 0.12 // glades
      if (gyA[i] > FY + 22) D *= 0.2 // tree line on peaks
      if (e > 0.95) D *= 0.3
      dens[i] = clamp(D, 0, 1)
    }

  // ---------------------------------------------------------------- 3. trees
  const forest = (theme?.trees?.forest ?? [[1, 'oak']]).map(([w, s]) => [w, s])
  const totalW = forest.reduce((s, [w]) => s + w, 0)
  const speciesAt = (x, z) => {
    let n = (rng() < 0.2 ? rng() : coh(x, z, 20, 107)) * totalW
    for (const [w, s] of forest) {
      if (n < w) return s
      n -= w
    }
    return forest[0][1]
  }
  const R_OF = { large: 6.5, medium: 4.6, small: 3.0, bush: 1.7 }
  const MAXR = { large: 7.5, medium: 5.5, small: 3.8, bush: 2 }
  const trees = []
  const hash = new Map()
  const hk = (x, z) => `${Math.floor(x / 8)},${Math.floor(z / 8)}`
  const crowded = (x, z, R, k) => {
    const gx = Math.floor(x / 8)
    const gz = Math.floor(z / 8)
    for (let dx = -2; dx <= 2; dx += 1)
      for (let dz = -2; dz <= 2; dz += 1)
        for (const t of hash.get(`${gx + dx},${gz + dz}`) ?? []) if (Math.hypot(t.x - x, t.z - z) < (t.R + R) * k) return true
    return false
  }
  const featureGap = (x, z) => {
    let g = Infinity
    for (const f of st.features) g = Math.min(g, Math.hypot(f.x - x, f.z - z) - f.r)
    return g
  }
  const cand = []
  for (let x = 2; x < S - 2; x += 2) for (let z = 2; z < S - 2; z += 2) cand.push([x + rng.int(0, 1), z + rng.int(0, 1)])
  for (const [x, z] of rng.shuffle(cand)) {
    const i = x + S * z
    if (cls[i] !== 0) continue
    const D = dens[i]
    if (rng() > D * 0.9 + 0.02) continue
    const room = Math.min(dBlocked[i] - 0.5, featureGap(x, z) - 0.5, x - 0.5, S - 1.5 - x, z - 0.5, S - 1.5 - z)
    const nearF = dFeat[i]
    const e = edgeE(x, z)
    let size
    const u = rng()
    // big trees deep in the woods, smaller toward the edges and the buildings, bushes feathering out
    if (!front[i] && D > 0.62 && room >= R_OF.large && nearF > 15 && e < 0.88 && u < 0.35) size = 'large'
    else if (!front[i] && D > 0.4 && room >= R_OF.medium && nearF > 9 && u < 0.85) size = 'medium'
    else if (room >= R_OF.small && (!front[i] || u < 0.1) && nearF > 4 && (D > 0.25 || u < 0.35)) size = 'small'
    else if (room >= R_OF.bush) size = 'bush'
    else continue
    const R = R_OF[size]
    if (crowded(x, z, R, size === 'bush' ? 0.7 : 0.76)) continue
    const gy = gyA[i]
    if (!SOIL.test(b.nameAt(x, gy, z) ?? '')) continue
    const t = { x, z, gy, size, R, room, species: speciesAt(x, z) }
    trees.push(t)
    if (!hash.has(hk(x, z))) hash.set(hk(x, z), [])
    hash.get(hk(x, z)).push(t)
  }
  const canopy = new Uint8Array(N)
  const order = { large: 0, medium: 1, small: 2, bush: 3 }
  trees.sort((a, c) => order[a.size] - order[c.size])
  const snowCells = []
  for (const [k, t] of trees.entries()) {
    for (let j = 1; j <= 2; j += 1) if (PLANT.test(b.nameAt(t.x, t.gy + j, t.z) ?? '')) b.remove(t.x, t.gy + j, t.z)
    if (t.size === 'bush') {
      const cells = bushAt(ctx, [t.x, t.gy, t.z], { r: rng.range(1.2, 1.9), seed: seed + k })
      if (winter) snowCells.push(...cells)
      continue
    }
    const height = t.size === 'large' ? rng.int(12, 15) : t.size === 'medium' ? rng.int(8, 11) : rng.int(5, 7)
    const res = plantTree(ctx, t.species, [t.x, t.gy, t.z], { size: t.size, seed: seed * 7 + k, height, maxR: Math.min(t.room, MAXR[t.size]), hues: WOOD_HUES })
    const R = Math.ceil((res?.radius ?? t.R) * 0.85)
    for (let dx = -R; dx <= R; dx += 1)
      for (let dz = -R; dz <= R; dz += 1) {
        if (dx * dx + dz * dz > R * R) continue
        const px = t.x + dx
        const pz = t.z + dz
        if (px >= 0 && pz >= 0 && px < S && pz < S) canopy[px + S * pz] = t.species === 'autumn' ? 2 : 1
      }
    if (winter && res?.cells) snowCells.push(...res.cells)
  }

  // ---------------------------------------------------------------- 4. rocks and dead wood
  const area = (() => {
    let n = 0
    for (let i = 0; i < N; i += 1) if (cls[i] === 0) n += 1
    return n
  })()
  const nRocks = Math.max(2, Math.round(area / 1300))
  const rockSpots = []
  for (let tries = 0; tries < nRocks * 80 && rockSpots.length < nRocks; tries += 1) {
    const x = rng.int(3, S - 4)
    const z = rng.int(3, S - 4)
    const i = x + S * z
    if (cls[i] !== 0) continue
    const e = edgeE(x, z)
    const hill = smooth(1, 8, gyA[i] - FY)
    const score = 0.3 + hill + (e > 0.65 && e < 0.93 ? 0.6 : 0) + (dens[i] > 0.2 && dens[i] < 0.7 ? 0.4 : 0)
    if (rng() * 1.8 > score) continue
    const r = rng.range(1.5, 2.6)
    if (dBlocked[i] < r + 1.5 || dFeat[i] < 5 || front[i]) continue
    if (rockSpots.some(([px, pz]) => Math.hypot(px - x, pz - z) < 12)) continue
    if (crowded(x, z, r * 0.6, 0.8)) continue
    rockSpots.push([x, z])
    rockOutcrop(ctx, [x, gyA[i], z], { r, seed: seed + tries })
    for (let dx = -4; dx <= 4; dx += 1)
      for (let dz = -4; dz <= 4; dz += 1) {
        const px = x + dx
        const pz = z + dz
        if (px < 0 || pz < 0 || px >= S || pz >= S) continue
        const j = px + S * pz
        if (cls[j] !== 0) continue
        const top = b.topY(px, pz)
        if (top > gyA[j] && !PLANT.test(b.nameAt(px, top, pz) ?? '')) cls[j] = 2
      }
  }
  let forestArea = 0
  for (let i = 0; i < N; i += 1) if (canopy[i] && cls[i] === 0) forestArea += 1
  const nLogs = Math.round(forestArea / 450)
  const logId = { autumn: 'dark_oak_log', japanese: 'spruce_log', winter: 'spruce_log', fantasy: 'birch_log', 'white-town': 'oak_log', crimson: 'crimson_stem', tropical: 'jungle_log' }[key] ?? 'oak_log'
  for (let tries = 0, made = 0; tries < nLogs * 30 && made < nLogs; tries += 1) {
    const x = rng.int(4, S - 5)
    const z = rng.int(4, S - 5)
    const i = x + S * z
    if (cls[i] !== 0 || !canopy[i] || dBlocked[i] < 4) continue
    const along = rng.chance(0.5) ? [1, 0] : [0, 1]
    const len = rng.int(3, 5)
    const gy = gyA[i]
    let ok = true
    for (let k = -1; k <= len && ok; k += 1) {
      const px = x + along[0] * k
      const pz = z + along[1] * k
      const j = px + S * pz
      if (cls[j] !== 0 || gyA[j] !== gy || (b.get(px, gy + 1, pz) && !PLANT.test(b.nameAt(px, gy + 1, pz)))) ok = false
    }
    if (!ok) continue
    for (let k = 0; k < len; k += 1) {
      const px = x + along[0] * k
      const pz = z + along[1] * k
      for (let j = 1; j <= 2; j += 1) if (PLANT.test(b.nameAt(px, gy + j, pz) ?? '')) b.remove(px, gy + j, pz)
      b.set(px, gy + 1, pz, `minecraft:${logId}[axis=${along[0] ? 'x' : 'z'}]`)
      const u = kit.hash01(px, gy, pz, seed + 71)
      if (winter) b.set(px, gy + 2, pz, 'minecraft:snow[layers=1]')
      else if (u < 0.4) b.set(px, gy + 2, pz, 'minecraft:moss_carpet')
      else if (u < 0.5) b.set(px, gy + 2, pz, u < 0.45 ? 'minecraft:brown_mushroom' : 'minecraft:red_mushroom')
      cls[px + S * pz] = 2
    }
    // the stump it broke from
    const sx = x - along[0] * 2 + along[1] * 1
    const sz = z - along[1] * 2 + along[0] * 1
    const si = sx + S * sz
    if (cls[si] === 0 && gyA[si] === gy) {
      b.set(sx, gy + 1, sz, `minecraft:${logId}[axis=y]`)
      cls[si] = 2
    }
    made += 1
  }

  // ---------------------------------------------------------------- 5. ground cover
  const flowers = (theme?.flowers ?? []).filter(([, f]) => !/grass|fern|dead_bush/.test(f)).map(([, f]) => f)
  const isGrass = n => n === 'minecraft:grass_block' || n === 'minecraft:moss_block'
  for (let x = 0; x < S; x += 1)
    for (let z = 0; z < S; z += 1) {
      const i = x + S * z
      const c = cls[i]
      if (c === 2 || c === 3) continue
      const gy = gyA[i]
      if (b.get(x, gy + 1, z)) continue
      const name = b.nameAt(x, gy, z)
      const u = kit.hash01(x, gy, z, seed + 201)
      if (winter) {
        if (c === 1) continue
        if (/grass_block|podzol/.test(name ?? '')) b.set(x, gy, z, `${name}[snowy=true]`)
        b.set(x, gy + 1, z, `minecraft:snow[layers=${coh(x, z, 4, 203) < 0.3 ? 2 : 1}]`)
        continue
      }
      if (c === 1) {
        // reserved but natural (the margins of slots): sparse tufts only
        if (isGrass(name) && u < 0.1) b.set(x, gy + 1, z, 'minecraft:short_grass')
        continue
      }
      if (canopy[i]) {
        // forest floor: podzol / coarse dirt / moss in patches, ferns, a few mushrooms; leaf litter under autumn crowns
        const n = coh(x, z, 3, 205, 0.25)
        if (name === 'minecraft:grass_block' && n < 0.42) b.set(x, gy, z, n < 0.2 ? 'minecraft:podzol' : n < 0.32 ? 'minecraft:coarse_dirt' : key === 'japanese' || key === 'fantasy' ? 'minecraft:moss_block' : 'minecraft:rooted_dirt')
        if (canopy[i] === 2 && coh(x, z, 2.2, 207, 0.2) < 0.2 && u < 0.6) b.set(x, gy + 1, z, litterCarpet(kit, x, z, seed))
        else if (u < 0.12) b.set(x, gy + 1, z, u < 0.03 ? 'minecraft:large_fern[half=lower]' : 'minecraft:fern')
        else if (u < 0.2) b.set(x, gy + 1, z, 'minecraft:short_grass')
        else if (u < 0.215) b.set(x, gy + 1, z, u < 0.208 ? 'minecraft:brown_mushroom' : 'minecraft:red_mushroom')
        if (b.nameAt(x, gy + 1, z) === 'minecraft:large_fern' && !b.get(x, gy + 2, z)) b.set(x, gy + 2, z, 'minecraft:large_fern[half=upper]')
        else if (b.nameAt(x, gy + 1, z) === 'minecraft:large_fern') b.set(x, gy + 1, z, 'minecraft:fern')
        continue
      }
      if (!isGrass(name) && name !== 'minecraft:coarse_dirt' && name !== 'minecraft:rooted_dirt' && name !== 'minecraft:podzol') continue
      if (key === 'japanese' && name === 'minecraft:grass_block' && coh(x, z, 5, 209) < 0.22) b.set(x, gy, z, 'minecraft:moss_block')
      const g = coh(x, z, 5, 211, 0.3)
      const nearWood = dens[i] > 0.25
      if (u < 0.05 + 0.25 * g) b.set(x, gy + 1, z, 'minecraft:short_grass')
      else if (u < 0.3 * g + 0.05 + (nearWood ? 0.05 : 0.01) && !b.get(x, gy + 2, z)) {
        b.set(x, gy + 1, z, 'minecraft:tall_grass[half=lower]')
        b.set(x, gy + 2, z, 'minecraft:tall_grass[half=upper]')
      }
    }
  // flower drifts: one or two species per drift, thinning toward the rim of the drift
  if (flowers.length && !winter) {
    const nDrifts = Math.round(area / 260)
    for (let k = 0, tries = 0; k < nDrifts && tries < nDrifts * 20; tries += 1) {
      const x = rng.int(4, S - 5)
      const z = rng.int(4, S - 5)
      const i = x + S * z
      if (cls[i] !== 0 || canopy[i]) continue
      k += 1
      const a = pick(rng, flowers)
      const b2 = rng.chance(0.4) ? pick(rng, flowers) : a
      const r = rng.range(1.8, 4.2)
      for (let dx = -5; dx <= 5; dx += 1)
        for (let dz = -5; dz <= 5; dz += 1) {
          const d = Math.hypot(dx, dz) / r
          const px = x + dx
          const pz = z + dz
          if (d > 1 || px < 0 || pz < 0 || px >= S || pz >= S) continue
          const j = px + S * pz
          if (cls[j] !== 0) continue
          if (kit.hash01(px, 9, pz, seed + k) > 0.65 * (1 - d * d)) continue
          const gy = gyA[j]
          if (!/grass_block|moss_block/.test(b.nameAt(px, gy, pz) ?? '')) continue
          const above = b.nameAt(px, gy + 1, pz)
          if (above && !/short_grass/.test(above)) continue
          b.set(px, gy + 1, pz, `minecraft:${kit.hash01(px, 8, pz, k) < 0.7 ? a : b2}`)
        }
    }
  }

  // ---------------------------------------------------------------- 6. theme details
  const openSpot = (minFeat = 3, needCanopy = null) => {
    for (let tries = 0; tries < 60; tries += 1) {
      const x = rng.int(4, S - 5)
      const z = rng.int(4, S - 5)
      const i = x + S * z
      if (cls[i] !== 0 || dBlocked[i] < 2 || dFeat[i] < minFeat) continue
      if (needCanopy !== null && Boolean(canopy[i]) !== needCanopy) continue
      if (b.get(x, gyA[i] + 1, z) && !PLANT.test(b.nameAt(x, gyA[i] + 1, z))) continue
      return [x, gyA[i], z, i]
    }
    return null
  }
  const clearPlant = (x, y, z) => {
    for (let k = 1; k <= 2; k += 1) if (PLANT.test(b.nameAt(x, y + k, z) ?? '')) b.remove(x, y + k, z)
  }
  if (key === 'autumn') {
    // pumpkin patches and the odd hay bale at the field edges
    for (let k = 0; k < Math.round(area / 1800); k += 1) {
      const p = openSpot(4, false)
      if (!p) continue
      const [x, y, z] = p
      for (let j = 0; j < rng.int(2, 4); j += 1) {
        const px = x + rng.int(-2, 2)
        const pz = z + rng.int(-2, 2)
        const pi = px + S * pz
        if (px < 0 || pz < 0 || px >= S || pz >= S || cls[pi] !== 0 || gyA[pi] !== y || (b.get(px, y + 1, pz) && !PLANT.test(b.nameAt(px, y + 1, pz)))) continue
        clearPlant(px, y, pz)
        b.set(px, y + 1, pz, rng.chance(0.85) ? 'minecraft:pumpkin' : `minecraft:carved_pumpkin[facing=${pick(rng, ['north', 'south', 'east', 'west'])}]`)
        cls[pi] = 2
      }
    }
    for (let k = 0; k < Math.round(area / 3500); k += 1) {
      const p = openSpot(6, false)
      if (!p) continue
      const [x, y, z, i] = p
      clearPlant(x, y, z)
      b.set(x, y + 1, z, `minecraft:hay_block[axis=${rng.chance(0.5) ? 'x' : 'z'}]`)
      if (rng.chance(0.4)) b.set(x, y + 2, z, 'minecraft:hay_block[axis=y]')
      cls[i] = 2
    }
    // sweet berry bushes at the wood edges
    for (let k = 0; k < Math.round(area / 900); k += 1) {
      const p = openSpot(3, true)
      if (!p) continue
      const [x, y, z, i] = p
      if (b.nameAt(x, y, z) !== 'minecraft:grass_block' && b.nameAt(x, y, z) !== 'minecraft:podzol') continue
      clearPlant(x, y, z)
      b.set(x, y + 1, z, 'minecraft:sweet_berry_bush[age=3]')
      cls[i] = 2
    }
  }
  if (key === 'japanese') {
    for (let k = 0; k < Math.max(2, Math.round(area / 2500)); k += 1) {
      const p = openSpot(5, null)
      if (!p) continue
      const [x, y, z] = p
      bambooClump(ctx, [x, y, z], { r: rng.int(2, 3), seed: seed + k })
    }
    // stone lanterns in quiet spots near the paths
    let made = 0
    for (let tries = 0; tries < 400 && made < Math.max(2, Math.round(area / 3000)); tries += 1) {
      const x = rng.int(4, S - 5)
      const z = rng.int(4, S - 5)
      const i = x + S * z
      if (cls[i] !== 0 || dBlocked[i] < 2 || dBlocked[i] > 3.5 || canopy[i]) continue
      if (b.get(x, gyA[i] + 1, z) && !PLANT.test(b.nameAt(x, gyA[i] + 1, z))) continue
      clearPlant(x, gyA[i], z)
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) clearPlant(x + dx, gyA[i] + 4, z + dz)
      stoneLantern(ctx, [x, gyA[i], z], { seed: seed + tries })
      cls[i] = 2
      made += 1
    }
  }
  if (key === 'fantasy') {
    for (let k = 0; k < Math.round(area / 1500); k += 1) {
      const p = openSpot(4, null)
      if (!p) continue
      const [x, y, z, i] = p
      clearPlant(x, y, z)
      b.set(x, y + 1, z, rng.chance(0.5) ? 'minecraft:flowering_azalea' : 'minecraft:azalea')
      cls[i] = 2
    }
  }
  // reeds and sugar cane at the water's edge
  if (site.isWater) {
    for (let x = 1; x < S - 1; x += 1)
      for (let z = 1; z < S - 1; z += 1) {
        const i = x + S * z
        if (cls[i] !== 0 && cls[i] !== 1) continue
        let wet = false
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (site.isWater(x + dx, z + dz) && site.groundY(x + dx, z + dz) < gyA[i]) wet = true
        if (!wet || winter) continue
        const gy = gyA[i]
        if (!/grass_block|dirt|sand|podzol|coarse_dirt/.test(b.nameAt(x, gy, z) ?? '') || kit.hash01(x, gy, z, seed + 301) > 0.3) continue
        if (gy !== FY - 1 && gy !== FY) continue
        clearPlant(x, gy, z)
        const h = rng.int(1, 3)
        for (let k = 1; k <= h; k += 1) b.set(x, gy + k, z, 'minecraft:sugar_cane[age=0]')
      }
  }
  if (winter && snowCells.length) snowOn(ctx, snowCells)

  // ---------------------------------------------------------------- 7. the island's edge and underside
  dressIsland(ctx, { cls, gyA, rng })
  st.ms = Date.now() - T0
  st.trees = trees.length
  if (process.env.LAND_DEBUG) console.error(`landscapePass: ${trees.length} trees (${trees.filter(t => t.size === 'bush').length} bushes), ${rockSpots.length} rocks, ${st.ms} ms`)
  return { trees: trees.length, rocks: rockSpots.length, ms: st.ms }
}

// The floating island's rim and underside: vines and roots draping over the coastline, hanging roots,
// moss, glow-berry vines and dripstone under the belly, a few hanging rock lobes so it reads as a
// natural rock, not a cut block.
function dressIsland(ctx, { cls, gyA, rng }) {
  const { b, kit, S, site } = ctx
  const seed = ctx.seed ?? 1
  const winter = ctx.theme?.key === 'winter'
  const N = S * S
  const bottom = new Int16Array(N).fill(-1)
  for (let x = 0; x < S; x += 1)
    for (let z = 0; z < S; z += 1) {
      const i = x + S * z
      if (cls[i] === 3 && !site.land(x, z)) continue
      const top = site.groundY(x, z)
      for (let y = 0; y <= top; y += 1)
        if (b.get(x, y, z)) {
          bottom[i] = y
          break
        }
    }
  const dripstone = (x, y, z, n) => {
    n = Math.min(n, y + 1)
    if (n <= 0) return
    const order = n === 1 ? ['tip'] : n === 2 ? ['frustum', 'tip'] : ['base', ...Array(n - 3).fill('middle'), 'frustum', 'tip']
    order.forEach((t, k) => b.set(x, y - k, z, `minecraft:pointed_dripstone[thickness=${t},vertical_direction=down,waterlogged=false]`))
  }
  // the coastline: vines over the lip, roots and moss under the overhang
  for (let x = 1; x < S - 1; x += 1)
    for (let z = 1; z < S - 1; z += 1) {
      const i = x + S * z
      if (!site.land(x, z) || site.isWater?.(x, z)) continue
      const top = site.groundY(x, z)
      for (const [dx, dz, side] of [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'north'], [0, -1, 'south']]) {
        const ox = x + dx
        const oz = z + dz
        if (site.land(ox, oz)) continue
        const n = kit.noise.coherent01(x, 0, z, { scale: 4, seed: seed + 401 })
        if (n > 0.45 || winter) continue
        const len = 1 + Math.floor(kit.hash01(x, 1, z, seed + 403) * (2 + 6 * (0.45 - n) / 0.45))
        for (let k = 0; k < len; k += 1) {
          const yy = top - k
          if (yy <= bottom[i] || b.get(ox, yy, oz) || !b.get(x, yy, z)) break
          b.set(ox, yy, oz, `minecraft:vine[${side}=true]`)
        }
      }
    }
  // the belly
  for (let x = 0; x < S; x += 1)
    for (let z = 0; z < S; z += 1) {
      const i = x + S * z
      const y = bottom[i]
      if (y <= 1) continue
      const blk = b.nameAt(x, y, z)
      if (!blk || b.get(x, y - 1, z)) continue
      const u = kit.hash01(x, y, z, seed + 411)
      const moss = kit.noise.coherent01(x, y, z, { scale: 5, seed: seed + 413 })
      const top = site.groundY(x, z)
      const shallow = top - y <= 4
      if (moss < 0.18 && !winter) {
        b.set(x, y, z, 'minecraft:moss_block')
        if (u < 0.25) {
          const n = 1 + Math.floor(kit.hash01(x, 2, z, seed) * 5)
          for (let k = 1; k <= n; k += 1) b.set(x, y - k, z, k === n ? `minecraft:cave_vines[age=25,berries=${kit.hash01(x, k, z, 5) < 0.4}]` : `minecraft:cave_vines_plant[berries=${kit.hash01(x, k, z, 6) < 0.3}]`)
        }
      } else if ((shallow || /dirt/.test(blk)) && u < 0.35) {
        if (!/dirt/.test(blk)) b.set(x, y, z, 'minecraft:rooted_dirt')
        b.set(x, y - 1, z, 'minecraft:hanging_roots[waterlogged=false]')
      } else if (!shallow && u < 0.05) {
        b.set(x, y, z, 'minecraft:dripstone_block')
        dripstone(x, y - 1, z, 1 + Math.floor(kit.hash01(x, 3, z, seed) * 4))
      }
    }
  // hanging rock lobes: tapered cones under the belly
  const rockP = kit.palette({ stone: 4, andesite: 3, tuff: 2, deepslate: 1, dripstone_block: 1 }, { scale: 2.5, seed: seed + 421 })
  const nLobes = Math.max(3, Math.round(S / 22))
  for (let k = 0, tries = 0; k < nLobes && tries < nLobes * 30; tries += 1) {
    const x = rng.int(6, S - 7)
    const z = rng.int(6, S - 7)
    const i = x + S * z
    const y = bottom[i]
    const e = site.edgeE?.(x, z) ?? 0.5
    if (y < 8 || e > 0.75 || e < 0.15) continue
    k += 1
    const depth = rng.int(4, Math.min(12, y - 2))
    const r0 = rng.range(1.6, 3.2)
    for (let d = 0; d <= depth; d += 1) {
      const r = r0 * (1 - d / (depth + 1)) ** 0.8
      const ox = Math.sin(d * 0.6 + k) * 0.6
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx += 1)
        for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz += 1) {
          if ((dx - ox) ** 2 + dz * dz > r * r + 0.2) continue
          b.set(x + dx, y - d, z + dz, rockP)
        }
    }
    dripstone(x, y - depth - 1, z, rng.int(2, 4))
  }
}
