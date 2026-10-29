// RIVERS, LAKES AND WATERFALLS. Read this, look at img/river.png, then lay your own river through the
// spawn's land: another course, other widths, the theme's bed and banks (red sand and terracotta in a
// mesa, mud and mangrove roots in a swamp, packed ice at the edges in winter).
//
// DO
// - A course that meanders: a smooth spline through 6-10 points that swing left and right by uneven
//   amounts (never a straight line, never a sine). A width that changes along it (8-16 here) and a
//   pool or a lake where it widens once on its way.
// - Water SOURCE blocks at one level per stretch, 2 blocks below the land, every water block held by
//   solid blocks at its sides and under it: water next to air pours out when the build is pasted.
//   The level changes only at a waterfall, into a deep pool.
// - Depth: 1 at the edges, 3-4 in the middle, deepest on the outside of a bend, pools and lakes 4-5.
// - Banks that slope: wide and low with a sand and gravel beach on the inside of a bend, short and
//   steep on the outside (a cut bank of dirt, roots and rock); grass grading to coarse dirt, gravel,
//   sand and mud at the waterline. A bed of clumped gravel, sand and clay, mud along the edges.
// - Life: sugar cane in clumps at the waterline, short and tall grass and ferns on the banks, lily
//   pads in the calm water (the inside of bends, the lake's edge), seagrass only where it is deep, a
//   few mossy stones at the bends and either side of a waterfall.
// - A waterfall where the land steps down a terrace: the river runs shallow over a rock lip, falls
//   as a curtain with rock on both sides into a plunge pool 5 deep, then carries on at its new level.
// DON'T
// - A straight trench of one width with vertical dirt sides, 1 deep, the water flush with the grass,
//   no bank, no plants.
// - Water standing above its banks or held up by nothing (a wall of source blocks down a cliff, a
//   river at grass level that meets lower ground): it floods the land the moment it is pasted.
// - Lily pads all over, sugar cane in rows, seagrass in the shallows, the same width all the way.

const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smooth = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
// what holds water back: any block but air, water and the soft things water washes away
const SOFT = /water|grass$|fern|flower|poppy|dandelion|orchid|allium|bluet|tulip|daisy|cornflower|lily|sugar_cane|seagrass|kelp|sapling|vine|carpet|petals|roots$|bush$|azalea$|torch|lantern|_sign|^minecraft:snow$|mushroom$|button|pressure_plate|rail|dripleaf/
export const holdsWater = blk => !!blk && !SOFT.test(blk.name)
const CANE_SOIL = /grass_block|dirt|sand|mud|podzol|moss_block/

// The course: a smooth centreline through [[x, z], ...] and, for any column, the nearest point on
// it: t (0 at the first point, 1 at the last), d (blocks from the line), side (+1 or -1) and bend
// (how hard it turns there, radians per block, + when it turns toward side +1: that side is the
// inside of the bend).
export function course(ctx, points) {
  const pts = ctx.kit.catmullRom(points.map(([x, z]) => [x, 0, z]), { samplesPerBlock: 2 }).map(([x, , z]) => [x, z])
  const n = pts.length
  const L = [0]
  for (let i = 1; i < n; i += 1) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const length = L[n - 1]
  const tan = pts.map((_, i) => {
    const [a, c] = [pts[Math.max(0, i - 1)], pts[Math.min(n - 1, i + 1)]]
    const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1
    return [(c[0] - a[0]) / l, (c[1] - a[1]) / l]
  })
  const head = []
  for (let i = 0; i < n; i += 1) {
    let a = Math.atan2(tan[i][1], tan[i][0])
    if (i) while (a - head[i - 1] > Math.PI) a -= 2 * Math.PI
    if (i) while (a - head[i - 1] < -Math.PI) a += 2 * Math.PI
    head.push(a)
  }
  // the bend: the change of heading over 5 blocks either way
  const bend = pts.map((_, i) => {
    let [j0, j1] = [i, i]
    while (j0 > 0 && L[i] - L[j0] < 5) j0 -= 1
    while (j1 < n - 1 && L[j1] - L[i] < 5) j1 += 1
    return (head[j1] - head[j0]) / Math.max(1, L[j1] - L[j0])
  })
  const index = t => {
    const s = clamp(t, 0, 1) * length
    let i = 0
    while (i < n - 2 && L[i + 1] < s) i += 1
    return [i, L[i + 1] > L[i] ? (s - L[i]) / (L[i + 1] - L[i]) : 0]
  }
  const at = t => {
    const [i, u] = index(t)
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]
  }
  const tangent = t => tan[index(t)[0]]
  function nearest(x, z) {
    let best = Infinity
    let bi = 0
    for (let i = 0; i < n; i += 1) {
      const d2 = (x - pts[i][0]) ** 2 + (z - pts[i][1]) ** 2
      if (d2 < best) [best, bi] = [d2, i]
    }
    let [bd, bs] = [Math.sqrt(best), L[bi]]
    for (const j of [bi - 1, bi]) {
      if (j < 0 || j >= n - 1) continue
      const [vx, vz] = [pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]]
      const u = clamp(((x - pts[j][0]) * vx + (z - pts[j][1]) * vz) / (vx * vx + vz * vz || 1), 0, 1)
      const d = Math.hypot(x - pts[j][0] - vx * u, z - pts[j][1] - vz * u)
      if (d < bd) [bd, bs] = [d, L[j] + u * (L[j + 1] - L[j])]
    }
    const side = tan[bi][0] * (z - pts[bi][1]) - tan[bi][1] * (x - pts[bi][0]) >= 0 ? 1 : -1
    return { t: bs / length, d: bd, side, bend: bend[bi] }
  }
  return { points: pts, length, at, tangent, nearest }
}

// A river carved into the land that is already there. points = its course [[x, z], ...], from where
// it comes to where it goes; end it inside the land (a pool, a spring, the island's rim) so no
// water touches the canvas edge.
//   width   [min, max] (a slow noise between them) | number | t => width
//   depth   the deepest in the middle of the channel (1 at the edges)
//   bank    how far the banks reach from the water (x1.8 inside a bend, x0.4 outside)
//   level   the first stretch's water level (default: 2 below the lowest land on its course)
//   falls   [{ at: t | [x, z], drop, pool }]: where the river steps down (put it where the land
//           does); pool = the plunge pool's depth (5)
//   pools   [{ at: t | [x, z], r: n | [rx, rz], depth, bank }]: lakes and pools on its course
//   spring  true: an outcrop of mossy rock over its head, where the water comes from
//   plants, stones  false to leave out the planting or the stones at bends and falls
//   ground  (x, z) => the land's top block y (default: the highest block that holds water)
// Returns what a bridge, a path or a jetty needs to find the water:
//   centre (the sampled centreline [[x, z], ...]), length, levels (one water level per stretch),
//   waterY (the first), levelAt(t), widthAt(t), at(t) → [x, z], tangent(t) → [dx, dz] (downstream),
//   nearest(x, z) → { t, d, side, bend }, isWater(x, z), waterTop(x, z) (its level or null),
//   bedAt(x, z) (the bed block's y or null), surfaceAt(x, z) (the bank's top, or the water level),
//   falls [{ t, at, top, bottom }].
export function river(ctx, points, { width = [8, 14], depth = 3, bank = 4, level, falls = [], pools = [], spring = false, seed = 1, plants = true, stones = true, ground } = {}) {
  const { b, kit, S } = ctx
  const c = course(ctx, points)
  const H = b.size[1]
  const groundAt = ground ?? ((x, z) => {
    for (let y = H - 1; y >= 0; y -= 1) if (holdsWater(b.get(x, y, z))) return y
    return -1
  })
  const widthAt = typeof width === 'function' ? width : Array.isArray(width) ? t => width[0] + (width[1] - width[0]) * kit.noise.coherent01(t * c.length, 0, 0, { scale: 20, grain: 0, seed }) : () => width
  // every point of the course must be on the land: a source off the island would build water and
  // banks in the air
  const off = []
  for (let i = 0; i <= 200; i += 1) {
    const [x, z] = c.at(i / 200).map(Math.round)
    if (x < 0 || z < 0 || x >= b.size[0] || z >= b.size[2] || groundAt(x, z) < 0) off.push(`${x},${z}`)
  }
  if (off.length) ctx.warn(`river: ${off.length} of 201 points along the course are off the land (e.g. ${off.slice(0, 3).join(' ')}): move its points onto the land`)
  const toT = at => (typeof at === 'number' ? at : c.nearest(at[0], at[1]).t)
  const drops = falls.map(f => ({ ...f, t: toT(f.at) })).sort((p, q) => p.t - q.t)
  const stretchOf = t => drops.filter(f => f.t <= t).length
  // the water level of each stretch: given, or 2 below the lowest land along the first one
  let level0 = level
  if (level0 === undefined) {
    level0 = Infinity
    for (let i = 0; i <= 100; i += 1) {
      const t = i / 100
      if (stretchOf(t) > 0) break
      const [x, z] = c.at(t).map(Math.round)
      level0 = Math.min(level0, groundAt(x, z) - 2)
    }
  }
  const levels = [level0]
  for (const f of drops) levels.push(levels.at(-1) - f.drop)
  const lakes = pools.map((p, i) => {
    const centre = typeof p.at === 'number' ? c.at(p.at) : p.at
    const [rx, rz] = Array.isArray(p.r) ? p.r : [p.r, p.r]
    return { ...p, centre, rx, rz, k: stretchOf(c.nearest(...centre).t), depth: p.depth ?? depth + 2, bank: p.bank ?? bank, seed: seed + 50 + i }
  })

  // ---- plan every column: water (level, depth) or bank (its new top), from the shapes that claim it
  const maxW = Math.max(...Array.from({ length: 21 }, (_, i) => widthAt(i / 20)))
  const reach = maxW / 2 + bank * 1.8 + 3
  let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, z] of c.points) [x0, z0, x1, z1] = [Math.min(x0, x - reach), Math.min(z0, z - reach), Math.max(x1, x + reach), Math.max(z1, z + reach)]
  for (const p of lakes) [x0, z0, x1, z1] = [Math.min(x0, p.centre[0] - p.rx - p.bank - 3), Math.min(z0, p.centre[1] - p.rz - p.bank - 3), Math.max(x1, p.centre[0] + p.rx + p.bank + 3), Math.max(z1, p.centre[1] + p.rz + p.bank + 3)]
  ;[x0, z0, x1, z1] = [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(z0)), Math.min(S - 1, Math.ceil(x1)), Math.min(S - 1, Math.ceil(z1))]
  const plan = new Map()
  const key = (x, z) => x + 4096 * z
  for (let x = x0; x <= x1; x += 1)
    for (let z = z0; z <= z1; z += 1) {
      const near = c.nearest(x, z)
      const half = widthAt(near.t) / 2
      // inside > 0: this side is the inside of a bend (slow, shallow, a beach); < 0 the outside
      const inside = clamp(near.side * near.bend * 14, -1, 1)
      const noise = kit.noise.fbm2(x, z, { scale: 6, seed })
      const shapes = []
      {
        // the channel: deepest off-centre toward the outside of a bend, shelving gently inside it
        const off = clamp(near.d / half, 0, 1)
        const p = inside > 0 ? 2 - 1.1 * inside : 2 + 2.5 * -inside
        const dep = 1 + Math.round((depth - 1) * (1 - off ** p) + noise)
        const bw = Math.max(1.2, bank * (1 + 0.8 * Math.max(0, inside) - 0.6 * Math.max(0, -inside)) + 1.5 * kit.noise.fbm2(x, z, { scale: 10, seed: seed + 1 }))
        shapes.push({ s: near.d - half, k: stretchOf(near.t), depth: clamp(dep, 1, depth + 1), bw, inside, off, pool: false })
      }
      for (const p of lakes) {
        const [dx, dz] = [x - p.centre[0], z - p.centre[1]]
        const ang = Math.atan2(dz, dx)
        const wob = 1 + 0.18 * kit.noise.fbm2(Math.cos(ang) * 3, Math.sin(ang) * 3, { scale: 1.3, seed: p.seed })
        const e = Math.hypot(dx / p.rx, dz / p.rz) / wob
        const R = Math.hypot(p.rx * Math.cos(ang), p.rz * Math.sin(ang)) * wob
        const dep = 1 + Math.round((p.depth - 1) * Math.sqrt(Math.max(0, 1 - e * e)) + noise)
        shapes.push({ s: (e - 1) * R, k: p.k, depth: clamp(dep, 1, p.depth), bw: p.bank + 1.5 * kit.noise.fbm2(x, z, { scale: 10, seed: seed + 2 }), inside: 0.6, off: Math.min(1, e), pool: true })
      }
      const wet = shapes.filter(sh => sh.s < 0)
      const land = groundAt(x, z)
      if (wet.length) {
        // where two waters overlap, the lower one wins (a plunge pool cuts back under its fall)
        const k = Math.max(...wet.map(sh => sh.k))
        const mine = wet.filter(sh => sh.k === k)
        const sh = mine.reduce((p, q) => (q.s < p.s ? q : p))
        let dep = Math.max(...mine.map(m => m.depth))
        let lip = false
        for (const f of drops) {
          const [fx, fz] = c.at(f.t)
          if (Math.hypot(x - fx, z - fz) > widthAt(f.t) / 2 + 3) continue
          if (k === stretchOf(f.t)) dep = Math.max(dep, f.pool ?? 5) // the plunge pool under the fall
          else if (k === stretchOf(f.t) - 1) [dep, lip] = [Math.min(dep, 2), true] // shallow over the lip
        }
        plan.set(key(x, z), { x, z, water: true, k, W: levels[k], depth: dep, lip, land, ...pick(sh) })
        continue
      }
      // a bank: every shape carves its own slope (the lowest wins); the first ring is flush with the water
      let best = null
      for (const sh of shapes) {
        if (sh.s >= sh.bw + 0.5) continue
        const W = levels[sh.k]
        const rise = land - W
        const top = sh.s < 1 || rise <= 0 ? W : W + Math.round(rise * smooth((sh.s - 1) / Math.max(0.5, sh.bw - 1)))
        if (!best || top < best.top) best = { top, k: sh.k, W, ...pick(sh) }
      }
      if (best) plan.set(key(x, z), { x, z, water: false, land, ...best, top: best.s < 1.5 ? Math.max(best.top, best.W) : Math.min(best.top, land) })
    }
  function pick(sh) {
    return { s: sh.s, inside: sh.inside, off: sh.off, pool: sh.pool, bw: sh.bw }
  }

  // ---- materials (clumped mixes, never per-block speckle)
  const P = (mix, scale, s) => kit.palette(mix, { scale, seed: seed + s })
  const bedMid = P({ gravel: 4, sand: 2, clay: 2 }, 4, 3)
  const bedEdge = P({ sand: 3, mud: 2, gravel: 2, clay: 1 }, 3, 4)
  const shoreIn = P({ sand: 5, gravel: 2 }, 3, 5)
  const shoreOut = P({ coarse_dirt: 3, gravel: 2, mud: 2 }, 3, 6)
  const shoreMid = P({ coarse_dirt: 3, gravel: 2, grass_block: 2, sand: 1 }, 3, 7)
  const lowBank = P({ grass_block: 5, coarse_dirt: 2, rooted_dirt: 1 }, 3, 8)
  const lowBankIn = P({ sand: 3, grass_block: 3, gravel: 1 }, 3, 9)
  const face = P({ dirt: 4, coarse_dirt: 2, rooted_dirt: 1 }, 2, 10)
  const rock = P({ stone: 4, andesite: 3, tuff: 1, cobblestone: 1 }, 2, 11)
  const lipRock = P({ stone: 4, mossy_cobblestone: 2, andesite: 2, cobblestone: 1 }, 2, 12)
  const shore = (q, x, z) => {
    const v = q.inside + 0.35 * kit.noise.fbm2(x, z, { scale: 7, seed: seed + 13 })
    return v > 0.25 ? shoreIn : v < -0.25 ? shoreOut : shoreMid
  }

  // ---- carve: water and bed, then the banks' tops and the faces a steep bank shows
  const topOf = q => (q.water ? q.W - q.depth : q.top) // the highest solid block
  for (const q of plan.values()) {
    const { x, z } = q
    const top = topOf(q)
    for (let y = top + 1; y <= Math.max(q.land, q.W) + 3; y += 1) b.remove(x, y, z)
    if (q.water) {
      for (let y = top + 1; y <= q.W; y += 1) b.set(x, y, z, 'minecraft:water')
      b.set(x, top, z, q.lip ? lipRock : q.off > 0.6 || q.depth <= 1 ? bedEdge : bedMid)
      if (!holdsWater(b.get(x, top - 1, z))) b.set(x, top - 1, z, bedMid)
      continue
    }
    for (let y = q.land + 1; y < top; y += 1) b.set(x, y, z, face) // raised to hold the water in
    const h = top - q.W
    const inner = q.inside + 0.3 * kit.noise.fbm2(x, z, { scale: 6, seed: seed + 14 }) > 0.3
    b.set(x, top, z, h <= 0 ? shore(q, x, z) : h === 1 ? (inner ? lowBankIn : lowBank) : top < q.land ? 'minecraft:grass_block' : null)
  }
  for (const q of plan.values()) {
    if (q.water) continue
    const { x, z } = q
    let low = q.top
    for (const [dx, dz] of NB4) {
      const n = plan.get(key(x + dx, z + dz))
      if (n) low = Math.min(low, n.water ? n.W : n.top)
    }
    // a cut bank: dirt and roots, and rock where the outside of a bend has worn it deep or a fall is near
    const byFall = drops.some(f => Math.hypot(x - c.at(f.t)[0], z - c.at(f.t)[1]) < widthAt(f.t) / 2 + 7)
    const rocky = byFall || (q.inside < -0.3 && q.top - low >= 2)
    for (let y = q.top - 1; y > low; y -= 1) b.set(x, y, z, byFall ? lipRock : rocky && kit.noise.coherent01(x, y, z, { scale: 3, seed }) > 0.45 ? rock : face)
  }

  // ---- seal: every water block held at its sides and below; where an upper stretch meets lower
  // water the fall pours as a curtain (falling water, which never spreads sideways)
  const curtains = new Set()
  let atEdge = 0
  for (const q of plan.values()) {
    if (!q.water) continue
    const { x, z } = q
    for (let y = q.W - q.depth + 1; y <= q.W; y += 1)
      for (const [dx, dz] of NB4) {
        const [nx, nz] = [x + dx, z + dz]
        if (nx < 0 || nz < 0 || nx >= S || nz >= S) {
          atEdge += 1
          continue
        }
        const blk = b.get(nx, y, nz)
        if (blk?.name === 'minecraft:water' || holdsWater(blk)) continue
        const n = plan.get(key(nx, nz))
        if (n?.water && n.k > q.k && y === q.W) {
          curtains.add(key(nx, nz))
          b.set(nx, y, nz, 'minecraft:water[level=1]')
          for (let yy = y - 1; yy > n.W; yy -= 1) b.set(nx, yy, nz, 'minecraft:water[level=8]')
          continue
        }
        if (n?.water && n.k > q.k) continue // below the lip: the curtain's own cells
        // anything else (air, a plant, lower ground) becomes rock or bank up to this level
        const lowerSide = n && n.k > q.k
        for (let yy = y; yy >= 0 && !holdsWater(b.get(nx, yy, nz)); yy -= 1) b.set(nx, yy, nz, lowerSide ? lipRock : yy === y ? shore(q, nx, nz) : face)
      }
  }
  if (atEdge) ctx.warn(`river: ${atEdge} water blocks touch the canvas edge (open water when pasted): end the river inside the land`)
  const isCurtain = (x, z) => curtains.has(key(x, z))
  // the rock round a fall is wet: mossy cobblestone and moss on it, moss carpets on its ledges
  const wetRock = P({ mossy_cobblestone: 3, stone: 2, moss_block: 1, andesite: 1 }, 2, 21)
  for (const f of drops) {
    const [fx, fz] = c.at(f.t).map(Math.round)
    const [top, bottom] = [levels[stretchOf(f.t) - 1], levels[stretchOf(f.t)]]
    for (let dx = -10; dx <= 10; dx += 1)
      for (let dz = -10; dz <= 10; dz += 1) {
        const [x, z] = [fx + dx, fz + dz]
        const d = Math.hypot(dx, dz)
        if (d > 10) continue
        for (let y = bottom - 1; y <= top + 2; y += 1) {
          if (/^minecraft:(stone|andesite|tuff|cobblestone|dirt|coarse_dirt|gravel)$/.test(b.nameAt(x, y, z) ?? '') && kit.noise.coherent01(x, y, z, { scale: 3, seed: seed + 22 }) > 0.2 + d / 14) b.set(x, y, z, wetRock)
          // moss on the ledges the spray keeps wet
          if (b.get(x, y, z) && !b.get(x, y + 1, z) && y > bottom && holdsWater(b.get(x, y, z)) && kit.hash01(x, y, z, seed + 23) < 0.35 - d / 40) b.set(x, y + 1, z, 'minecraft:moss_carpet')
        }
      }
  }
  const nearCurtain = (x, z, r) => {
    for (let dx = -r; dx <= r; dx += 1) for (let dz = -r; dz <= r; dz += 1) if (curtains.has(key(x + dx, z + dz))) return true
    return false
  }

  // ---- stones: on the outside of the sharpest bends, half in the water, and either side of a fall
  if (stones) {
    const spots = []
    for (let i = 4; i <= 96; i += 1) {
      const t = i / 100
      const [x, z] = c.at(t).map(Math.round)
      const n = c.nearest(x, z)
      if (Math.abs(n.bend) < 0.045 || spots.some(s => Math.abs(s.t - t) < 0.08)) continue
      const [tx, tz] = c.tangent(t)
      const out = n.bend > 0 ? -1 : 1 // the outside is away from where it turns
      const half = widthAt(t) / 2
      spots.push({ t, x: x - tz * out * (half + 0.3), z: z + tx * out * (half + 0.3), r: 1.6 + kit.hash01(x, 0, z, seed) * 0.9 })
    }
    for (const f of drops) {
      const [x, z] = c.at(f.t - 1.5 / c.length)
      const [tx, tz] = c.tangent(f.t)
      const half = widthAt(f.t) / 2
      for (const sgn of [-1, 1]) spots.push({ t: f.t, x: x - tz * sgn * (half + 1.6), z: z + tx * sgn * (half + 1.6), r: 2.4, y: levels[stretchOf(f.t) - 1] })
    }
    for (const [i, sp] of spots.entries()) {
      const q = plan.get(key(Math.round(sp.x), Math.round(sp.z)))
      if (!q || (q.pool && sp.y === undefined)) continue // not out in a lake
      const y = sp.y ?? q.W - 1
      riverStone(ctx, [Math.round(sp.x), y, Math.round(sp.z)], { r: [sp.r, sp.r * 0.8, sp.r * 0.85], seed: seed + 20 + i, avoid: isCurtain })
    }
  }
  // ---- the spring: a river starts somewhere. Here, under an outcrop of mossy rock at its head
  if (spring) {
    const [hx, hz] = c.at(0)
    const [tx, tz] = c.tangent(0)
    const head = lakes.find(p => Math.hypot(p.centre[0] - hx, p.centre[1] - hz) < 3)
    const r0 = head ? Math.max(head.rx, head.rz) : widthAt(0) / 2
    const rocks = [[r0 + 2, 0, [3.8, 3.4, 3.2]], [r0 + 0.5, 3.5, [2.4, 2, 2.2]], [r0 + 1, -3.5, [2, 1.7, 1.9]]]
    for (const [i, [back, aside, r]] of rocks.entries()) {
      const [x, z] = [Math.round(hx - tx * back - tz * aside), Math.round(hz - tz * back + tx * aside)]
      riverStone(ctx, [x, (plan.get(key(x, z))?.top ?? groundAt(x, z)) + 1, z], { r, seed: seed + 40 + i })
    }
  }

  // ---- plants
  if (plants) {
    const fern = P({ short_grass: 6, fern: 3, tall_grass: 2, large_fern: 1 }, 2, 15)
    for (const q of plan.values()) {
      const { x, z } = q
      if (q.water) {
        const W = q.W
        if (b.nameAt(x, W, z) !== 'minecraft:water' || b.get(x, W + 1, z)) continue
        // lily pads: calm water near the edge of the lake and on the inside of bends, in clumps
        const calm = (q.pool || q.inside > 0.25) && q.off > 0.45 && !nearCurtain(x, z, 7)
        if (calm && kit.noise.coherent01(x, 0, z, { scale: 3, seed: seed + 16 }) > 0.58 && kit.hash01(x, W, z, seed) < 0.55) b.set(x, W + 1, z, 'minecraft:lily_pad')
        // seagrass where it is 2+ deep, tall where 3+
        const bed = W - q.depth
        if (q.depth >= 2 && b.nameAt(x, bed + 1, z) === 'minecraft:water' && kit.noise.coherent01(x, 0, z, { scale: 4, seed: seed + 17 }) > 0.55 && kit.hash01(x, bed, z, seed + 1) < 0.55)
          b.set(x, bed + 1, z, q.depth >= 3 && kit.hash01(x, bed, z, seed + 2) < 0.35 ? 'minecraft:tall_seagrass[half=lower]' : 'minecraft:seagrass')
        continue
      }
      const top = b.topY(x, z)
      const here = b.nameAt(x, top, z) ?? ''
      if (top !== q.top) continue // a stone sits here
      // sugar cane in clumps on the waterline, where water touches the block it grows on
      const wetSide = NB4.some(([dx, dz]) => b.nameAt(x + dx, top, z + dz) === 'minecraft:water')
      if (top === q.W && wetSide && CANE_SOIL.test(here) && kit.noise.coherent01(x, 0, z, { scale: 4, seed: seed + 18 }) > 0.57) {
        const h = 1 + Math.floor(kit.hash01(x, top, z, seed + 3) * 3)
        for (let k = 1; k <= h; k += 1) b.set(x, top + k, z, 'minecraft:sugar_cane')
        continue
      }
      // grass and ferns on the bank, thicker near the water
      if (here === 'minecraft:grass_block' && kit.hash01(x, top, z, seed + 4) < 0.55 - 0.05 * (q.s ?? 0) && kit.noise.coherent01(x, 0, z, { scale: 5, seed: seed + 19 }) > 0.3)
        b.set(x, top + 1, z, fern)
    }
  }

  const waterTop = (x, z) => {
    const q = plan.get(key(x, z))
    return q?.water ? q.W : null
  }
  return {
    centre: c.points,
    length: c.length,
    levels,
    waterY: levels[0],
    levelAt: t => levels[stretchOf(t)],
    widthAt,
    at: c.at,
    tangent: c.tangent,
    nearest: c.nearest,
    isWater: (x, z) => waterTop(x, z) !== null,
    waterTop,
    bedAt: (x, z) => {
      const q = plan.get(key(x, z))
      return q?.water ? q.W - q.depth : null
    },
    surfaceAt: (x, z) => {
      const q = plan.get(key(x, z))
      return q ? (q.water ? q.W : q.top) : groundAt(x, z)
    },
    falls: drops.map(f => ({ t: f.t, at: c.at(f.t), top: levels[stretchOf(f.t) - 1], bottom: levels[stretchOf(f.t)] })),
  }
}

// A stone half in the water: a noisy ellipsoid sunk into the bed, moss where rain lands. `avoid`
// keeps it out of a waterfall's curtain (a rock in a falling column spreads the water sideways).
export function riverStone(ctx, [x, y, z], { r = [2, 1.6, 1.8], seed = 1, avoid = () => false } = {}) {
  const { b, kit } = ctx
  const stone = kit.palette({ stone: 5, andesite: 3, cobblestone: 1, tuff: 1 }, { scale: 2, seed })
  const [rx, ry, rz] = r
  for (let dx = -Math.ceil(rx + 1); dx <= Math.ceil(rx + 1); dx += 1)
    for (let dz = -Math.ceil(rz + 1); dz <= Math.ceil(rz + 1); dz += 1) {
      if (avoid(x + dx, z + dz)) continue
      for (let dy = -Math.ceil(ry + 1); dy <= Math.ceil(ry + 1); dy += 1) {
        const flat = dy > ry * 0.5 ? 1.2 : 1
        const d = (dx / rx) ** 2 + ((dy * flat) / ry) ** 2 + (dz / rz) ** 2
        if (d > 1 + 0.4 * kit.noise.fbm3(x + dx, y + dy, z + dz, { scale: 3, seed })) continue
        b.set(x + dx, y + dy, z + dz, stone)
      }
      // moss on the top, in patches
      const top = b.topY(x + dx, z + dz)
      if (top > y && /stone|andesite|tuff/.test(b.nameAt(x + dx, top, z + dz) ?? '') && kit.noise.coherent01(x + dx, top, z + dz, { scale: 2.5, seed: seed + 9 }) > 0.5)
        b.set(x + dx, top, z + dz, 'minecraft:moss_block')
    }
}

// ---- the stage for the pictures (not part of the river): land from a height function, grass over
// three blocks of dirt over stone, bare rock where it is steep. Returns heightAt(x, z).
export function landscape(ctx, height, { bottom = 2, seed = 1 } = {}) {
  const { b, kit, S } = ctx
  const hs = new Int16Array(S * S)
  for (let x = 0; x < S; x += 1) for (let z = 0; z < S; z += 1) hs[x + S * z] = Math.round(height(x, z))
  const h = (x, z) => hs[clamp(x, 0, S - 1) + S * clamp(z, 0, S - 1)]
  const grass = kit.palette({ grass_block: 16, coarse_dirt: 1, podzol: 1 }, { scale: 5, seed })
  const dirt = kit.palette({ dirt: 5, coarse_dirt: 1 }, { scale: 3, seed })
  const rock = kit.palette({ stone: 5, andesite: 3, tuff: 1, cobblestone: 1 }, { scale: 3, seed: seed + 1 })
  for (let x = 0; x < S; x += 1)
    for (let z = 0; z < S; z += 1) {
      const top = h(x, z)
      const drop = top - Math.min(...NB4.map(([dx, dz]) => h(x + dx, z + dz)))
      for (let y = bottom; y <= top; y += 1) {
        const below = top - y
        let blk
        if (drop >= 3 && below < drop) blk = below === 0 && kit.hash01(x, y, z, seed) < 0.4 ? 'minecraft:moss_block' : rock // a crag
        else if (below === 0) blk = grass
        else if (below <= 3) blk = dirt
        else blk = (y + Math.round(2 * kit.noise.fbm2(x, z, { scale: 9, seed }))) % 6 === 0 ? 'minecraft:andesite' : rock
        b.set(x, y, z, blk)
      }
    }
  return h
}

// grass, ferns and flower drifts on the stage's grass (skip(x, z) keeps them off the river)
export function meadow(ctx, { seed = 1, skip = () => false } = {}) {
  const { b, kit, S } = ctx
  const plant = kit.palette({ short_grass: 10, fern: 2, tall_grass: 2 }, { scale: 2, seed })
  for (let x = 0; x < S; x += 1)
    for (let z = 0; z < S; z += 1) {
      if (skip(x, z)) continue
      const top = b.topY(x, z)
      if (b.nameAt(x, top, z) !== 'minecraft:grass_block') continue
      const h = kit.hash01(x, top, z, seed)
      const drift = kit.noise.coherent01(x, 0, z, { scale: 7, seed: seed + 3 })
      if (drift > 0.78 && h < 0.5) b.set(x, top + 1, z, drift > 0.86 ? 'minecraft:oxeye_daisy' : 'minecraft:cornflower')
      else if (h < 0.28) b.set(x, top + 1, z, plant)
    }
}

// DON'T: a straight trench, one width, 1 deep, flush with the grass; at the terrace the water stands
// as a wall down the cliff.
export function trench(ctx, { x0, x1, z0, z1, heightAt }) {
  const { b } = ctx
  const mid = Math.round((x0 + x1) / 2)
  for (let z = z0; z <= z1; z += 1) {
    const y = heightAt(mid, z)
    const hi = Math.max(y, heightAt(mid, z - 1)) // the cell behind: a wall of water where the land drops
    for (let x = x0; x <= x1; x += 1) {
      for (let yy = y + 1; yy <= y + 8; yy += 1) b.remove(x, yy, z)
      for (let yy = y; yy <= hi; yy += 1) b.set(x, yy, z, 'minecraft:water')
      b.set(x, y - 1, z, 'minecraft:dirt')
    }
  }
}

// ---- the picture: a spring under rocks in the hills, a river that winds down to a waterfall over
// the terrace's edge into a lake, and on toward you through the meadow.
const COURSE = [[73, 9], [66, 15], [57, 18], [51, 25], [50, 33], [50, 41], [47, 52], [41, 62], [40, 71], [46, 80], [51, 87]]
const FALL = [50, 40] // the terrace's edge: the land steps down 9 here, and so does the river
const DROP = 9
function stageHeight(ctx, c) {
  const { kit, FY } = ctx
  return (x, z) => {
    const n = c.nearest(x, z)
    const off = Math.abs(x - FALL[0])
    const far = smooth((off - 7) / 8) // 0 by the fall, 1 further out
    const edge = FALL[1] + (3 * kit.noise.fbm2(x, 0, { scale: 12, seed: 4 }) + 1.2 * kit.noise.fbm2(x, 1, { scale: 4, seed: 8 })) * far
    const soft = 1 + 12 * smooth((off - 18) / 22) // a sheer cliff either side of the fall, a grassy slope further off
    // two steps with a ledge between them, set back and of a height that wander along the cliff
    const ledge = Math.round(3 + 3 * kit.noise.coherent01(x, 0, 0, { scale: 7, seed: 9 }))
    const back = far * (1 + 3 * kit.noise.coherent01(x, 0, 1, { scale: 6, seed: 10 }))
    const step = e => smooth((e - z) / soft + 0.5)
    const floor = FY + ledge * step(edge) + (DROP - ledge) * step(edge - back)
    const away = Math.max(0, n.d - 10)
    return floor + Math.min(2.5, away * 0.07) + 1.2 * kit.noise.fbm2(x, z, { scale: 26, seed: 5 }) * smooth(away / 12) + Math.max(0, (16 - z) * 0.3)
  }
}

export const figure = { size: 96, height: 56, floorY: 16, seed: 3, camera: { eye: [38, 44, 90], lookAt: [50, 21, 40], fov: 56, width: 640, height: 420 } }
export function demo(ctx, which) {
  const { b, FY } = ctx
  const c = course(ctx, COURSE)
  const heightAt = landscape(ctx, stageHeight(ctx, c), { bottom: 2, seed: 2 })
  const tf = c.nearest(...FALL).t
  let skip
  if (which === 'good') {
    // narrower over the lip, so the fall is a curtain 7-8 wide between rocks
    const width = t => (8 + 7 * ctx.kit.noise.coherent01(t * c.length, 0, 0, { scale: 20, grain: 0, seed: 4 })) * (1 - 0.35 * Math.max(0, 1 - Math.abs(t - tf) * 18))
    const rv = river(ctx, COURSE, { width, depth: 3, bank: 4, level: FY + DROP - 2, falls: [{ at: FALL, drop: DROP }], pools: [{ at: 0, r: 5, depth: 3, bank: 3 }, { at: [47, 53], r: [14, 10], depth: 5, bank: 5 }], spring: true, seed: 4 })
    skip = (x, z) => rv.nearest(x, z).d < 12
  } else {
    trench(ctx, { x0: 47, x1: 52, z0: 8, z1: 88, heightAt })
    skip = (x, z) => x >= 46 && x <= 53
  }
  // the same trees and meadow round both
  for (const [x, z, sp, s] of [[29, 47, 'willow', 2], [71, 64, 'oak', 5], [14, 70, 'birch', 3], [74, 30, 'oak', 9], [36, 24, 'birch', 6], [82, 14, 'birch', 4]]) {
    let y = b.topY(x, z)
    while (y > 0 && !holdsWater(b.get(x, y, z))) b.remove(x, y--, z) // under the grass and ferns
    if (/grass_block|dirt|podzol/.test(b.nameAt(x, y, z) ?? '')) b.tree([x, y + 1, z], sp, { seed: s })
  }
  meadow(ctx, { seed: 7, skip })
}
