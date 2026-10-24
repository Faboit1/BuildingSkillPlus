// COASTAL VILLAGE — v2 (work in progress)

const SIZE = [96, 50, 80]
const SEA = 5 // top water block
const TOP = 16 // height of the lower volcanic cliff's top edge
const SLOPE = 0.56 // rise per block of the village slope above the cliff
const PLATEAU = 36
const CY = 22 // chapel floor / courtyard level

const smooth = t => t * t * (3 - 2 * t)
function curve(pts, x) {
  if (x <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i += 1) {
    if (x <= pts[i][0]) {
      const [x0, v0] = pts[i - 1]
      const [x1, v1] = pts[i]
      return v0 + (v1 - v0) * smooth((x - x0) / (x1 - x0))
    }
  }
  return pts[pts.length - 1][1]
}
const strHash = s => Math.abs([...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7))

const CLIFF_TOP = [[0, 45], [12, 46], [24, 47], [36, 48], [46, 51], [58, 52], [66, 55], [76, 57], [86, 54], [95, 50]]
const SHORE = [[0, 57], [36, 57], [40, 61], [56, 62], [62, 61], [76, 63], [90, 60], [95, 57]]

const HOUSES = [
  { id: 'a1', x0: 1, z0: 38, x1: 9, z1: 44, floors: 1, roof: 'flat', door: 3, stair: 'right', upper: { x0: 1, z0: 38, x1: 5, z1: 41 }, vine: 1 },
  { id: 'a2', x0: 10, z0: 39, x1: 16, z1: 44, floors: 2, roof: 'vault', vaultAxis: 'z', door: 3, balcony: true },
  { id: 'a3', x0: 20, z0: 38, x1: 26, z1: 44, floors: 1, roof: 'flat', door: 4, tone: 'cream', pergola: true, stair: 'left' },
  { id: 'a4', x0: 31, z0: 38, x1: 40, z1: 44, floors: 1, roof: 'hip', door: 4, doorWidth: 2, taverna: true },
  { id: 'b1', x0: 0, z0: 29, x1: 7, z1: 35, floors: 2, roof: 'flat', door: 2, chimney: true, terrace: true },
  { id: 'b2', x0: 8, z0: 29, x1: 15, z1: 34, floors: 1, roof: 'vault', vaultAxis: 'x', door: 5, vine: 3 },
  { id: 'b3', x0: 19, z0: 29, x1: 27, z1: 35, floors: 1, roof: 'flat', door: 4, tone: 'peach', upper: { x0: 23, z0: 29, x1: 27, z1: 32 }, stair: 'left' },
  { id: 'b4', x0: 30, z0: 30, x1: 36, z1: 35, floors: 1, roof: 'flat', front: 'east', door: 2, chimney: true, terrace: true },
  { id: 'b5', x0: 42, z0: 31, x1: 51, z1: 38, floors: 1, roof: 'flat', door: 3, pool: true, terrace: true },
  { id: 'c1', x0: 2, z0: 19, x1: 11, z1: 26, floors: 2, roof: 'hip', door: 4 },
  { id: 'c3', x0: 21, z0: 19, x1: 28, z1: 26, floors: 1, roof: 'vault', vaultAxis: 'x', door: 2, tone: 'cream', vine: 5 },
  { id: 'c4', x0: 35, z0: 20, x1: 43, z1: 26, floors: 2, roof: 'flat', door: 2, balcony: true, chimney: true, terrace: true },
  { id: 'c5', x0: 48, z0: 20, x1: 55, z1: 26, floors: 1, roof: 'flat', front: 'west', door: 3, stair: 'right', terrace: true },
  { id: 'd1', x0: 14, z0: 9, x1: 22, z1: 16, floors: 1, roof: 'flat', door: 5, pergola: true, stair: 'left' },
  { id: 'd2', x0: 26, z0: 8, x1: 35, z1: 16, floors: 2, roof: 'flat', door: 4, chimney: true, vine: 2, terrace: true },
  { id: 'e1', x0: 61, z0: 26, x1: 68, z1: 32, floors: 1, roof: 'vault', vaultAxis: 'z', door: 3 },
  { id: 'e2', x0: 74, z0: 6, x1: 81, z1: 12, floors: 1, roof: 'hip', door: 3 },
]

export default function build(api) {
  const { kit } = api
  const b = api.builder(SIZE, { seed: 23 })
  const [W, , D] = SIZE
  const n2 = (x, z, s, seed) => kit.noise.fbm2(x, z, { scale: s, seed })
  const { DIR, cw, ccw, opposite } = kit
  const HZ = ['north', 'east', 'south', 'west']
  const R = kit.rng(99)
  if (process.env.CV_CLIP) { const set0 = b.set.bind(b); b.set = (x, y, z, ...r) => { if (!b.inBounds(Math.round(x), Math.round(y), Math.round(z))) console.log('clip', Math.round(x), Math.round(y), Math.round(z), new Error().stack.split('\n')[2].trim()); return set0(x, y, z, ...r) } }

  // ------------------------------------------------------------------ palettes
  const pal = (entries, seed, scale = 3) => kit.palette(entries, { scale, seed })
  const TONE = {
    white: s => [pal({ smooth_quartz: 6, quartz_bricks: 2, calcite: 1.5 }, s, 1.8), pal({ calcite: 3, smooth_quartz: 3, mushroom_stem: 0.5 }, s + 1, 1.5)],
    cream: s => [pal({ smooth_sandstone: 6, cut_sandstone: 1, smooth_quartz: 1 }, s, 1.8), pal({ smooth_sandstone: 3, sandstone: 2, calcite: 1 }, s + 1, 1.5)],
    peach: s => [pal({ white_terracotta: 6, smooth_sandstone: 1, calcite: 0.5 }, s, 1.8), pal({ white_terracotta: 4, mushroom_stem: 1, calcite: 1 }, s + 1, 1.5)],
  }
  const WHITE = TONE.white(5)[0]
  const ROCK = {
    dark: pal({ basalt: 3, smooth_basalt: 2, blackstone: 1 }, 31, 2.5),
    red: pal({ terracotta: 4, granite: 3, brown_terracotta: 1 }, 32, 2.5),
    grey: pal({ tuff: 4, andesite: 2, stone: 1 }, 33, 2.5),
    ash: pal({ andesite: 3, diorite: 1, stone: 2 }, 34, 2.5),
  }
  const STRATA = [[3, 'dark'], [2, 'grey'], [3, 'red'], [1, 'dark'], [2, 'ash'], [3, 'red'], [2, 'grey'], [1, 'dark'], [4, 'red'], [3, 'grey'], [2, 'red'], [2, 'ash']]
  const STRATA_LEN = STRATA.reduce((s, [t]) => s + t, 0)
  const rock = (x, y, z) => {
    let w = y + 2.4 * n2(x, z, 18, 8) + 0.7 * n2(x * 2, z * 2, 6, 9)
    w = ((w % STRATA_LEN) + STRATA_LEN) % STRATA_LEN
    for (const [t, k] of STRATA) {
      if (w < t) return ROCK[k]
      w -= t
    }
    return ROCK.grey
  }
  const SOIL = pal({ coarse_dirt: 6, rooted_dirt: 1, gravel: 1, packed_mud: 1 }, 41, 2)
  const PAVE = pal({ polished_andesite: 4, andesite: 2, stone: 1 }, 51, 2)
  const QUAY = pal({ stone_bricks: 5, andesite: 2, cracked_stone_bricks: 1 }, 52, 2.5)
  const DRYSTONE = pal({ cobblestone: 3, stone: 2, andesite: 2, mossy_cobblestone: 1, tuff: 1 }, 53, 1.6)
  const RETAIN = pal({ stone_bricks: 3, andesite: 2, cobblestone: 1, tuff: 1 }, 81, 2)
  const DOME = pal({ light_blue_concrete: 8, light_blue_wool: 2 }, 71, 2)
  const BOUG = ['cherry_leaves', 'flowering_azalea_leaves', 'cherry_leaves', 'cherry_leaves']
  const leaf = id => `${id}[persistent=true,distance=1,waterlogged=false]`

  // ------------------------------------------------------------------ terrain
  const H = new Int16Array(W * D)
  const cx = x => Math.max(0, Math.min(W - 1, x))
  const cz = z => Math.max(0, Math.min(D - 1, z))
  const hAt = (x, z) => H[cx(x) + cz(z) * W]
  const setH = (x, z, y) => { if (x >= 0 && z >= 0 && x < W && z < D) H[x + z * W] = y }
  const TERRAIN = new Set()
  for (const p of [...Object.values(ROCK), SOIL, DRYSTONE]) for (const [, id] of p.entries) TERRAIN.add(`minecraft:${id}`)
  for (const id of ['sand', 'sandstone', 'gravel', 'clay', 'dirt', 'grass_block', 'short_grass', 'dead_bush', 'water', 'stone']) TERRAIN.add(`minecraft:${id}`)
  const isTerrain = blk => blk && TERRAIN.has(blk.name)

  const isBeach = x => x >= 39 && x <= 58
  const inChapelPad = (x, z) => {
    const dx = Math.max(0, 60 - x, x - 83) / 3
    const dz = Math.max(0, 39 - z, z - 52) / 3
    return dx * dx + dz * dz <= 1
  }
  for (let x = 0; x < W; x += 1) {
    for (let z = 0; z < D; z += 1) {
      const n = n2(x, z, 14, 3)
      const ct = curve(CLIFF_TOP, x) + n * 3
      const sh = curve(SHORE, x) + n * 2
      let y
      if (z <= ct) y = Math.min(PLATEAU + n * 2, TOP + (ct - z) * SLOPE + n * 1.5)
      else if (z <= ct + 4) y = TOP + (SEA + 2 - TOP) * ((z - ct) / 4) + n
      else if (z <= sh) y = isBeach(x) ? SEA + 1 + (z < ct + 7 ? 1 : 0) : SEA + 1 + n
      else y = SEA - 1 - Math.min(3.5, (z - sh) * 0.35)
      // the ridge falls away toward the east edge so the scene ends in a headland, not a cut
      if (x > 84 && z <= ct) y = Math.min(y, PLATEAU - (x - 84) * 1.7 + n)
      if (z < 6) y = Math.min(y, PLATEAU - (6 - z) * 1.4 + n)
      setH(x, z, Math.round(y))
    }
  }
  // harbor quay: everything between the cliff foot and z 57 west of the beach is one level
  for (let x = 0; x <= 38; x += 1) for (let z = 46; z <= 57; z += 1) if (hAt(x, z) <= SEA + 3 && z > curve(CLIFF_TOP, x) + 2) setH(x, z, SEA + 1)
  // agricultural terraces east of the village: quantise the slope into 4-high steps
  for (let x = 57; x < W; x += 1) for (let z = 0; z < 40; z += 1) {
    if (inChapelPad(x, z)) continue
    const h = hAt(x, z)
    if (h < CY) continue
    setH(x, z, Math.min(h, CY + Math.round((h - CY + n2(x, z, 9, 4) * 1.5) / 4) * 4))
  }
  const isQuay = (x, z) => x <= 38 && hAt(x, z) === SEA + 1 && z > curve(CLIFF_TOP, x) + 2
  const paintColumn = (x, z) => {
    const h = hAt(x, z)
    const drop = Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => h - hAt(x + dx, z + dz)))
    const terraced = x >= 57 && z < 40 && h >= CY
    for (let y = 0; y <= h; y += 1) {
      const depth = h - y
      let p = rock
      if (h <= SEA) p = 'sand'
      else if (isBeach(x) && h <= SEA + 3 && !isQuay(x, z)) p = depth < 2 ? 'sand' : 'sandstone'
      else if (isQuay(x, z)) p = depth === 0 ? QUAY : 'stone'
      else if (terraced && drop >= 2 && depth < drop) p = DRYSTONE
      else if (drop <= 1 && depth === 0) p = SOIL
      else if (drop <= 1 && depth < 2) p = 'dirt'
      b.set(x, y, z, p)
    }
    for (let y = h + 1; y <= SEA; y += 1) b.set(x, y, z, 'water')
  }
  for (let x = 0; x < W; x += 1) for (let z = 0; z < D; z += 1) paintColumn(x, z)

  // ------------------------------------------------------------------ house generator
  const SIDE = {
    south: { len: h => h.x1 - h.x0 + 1, at: (h, i) => [h.x0 + i, h.z1] },
    north: { len: h => h.x1 - h.x0 + 1, at: (h, i) => [h.x1 - i, h.z0] },
    east: { len: h => h.z1 - h.z0 + 1, at: (h, i) => [h.x1, h.z1 - i] },
    west: { len: h => h.z1 - h.z0 + 1, at: (h, i) => [h.x0, h.z0 + i] },
  }
  // local frame: u along the front facade (left → right seen from outside), v inward from it
  const local = (h, u, v) => {
    const [x, z] = SIDE[h.front].at(h, u)
    const inn = DIR[opposite(h.front)]
    return [x + inn[0] * v, z + inn[2] * v]
  }
  const protectedCols = new Set()
  const colKey = (x, z) => x * 1000 + z
  const SHUTTERS = ['warped_trapdoor', 'warped_trapdoor', 'warped_trapdoor', 'waxed_oxidized_copper_trapdoor', 'spruce_trapdoor']
  const DOORS = { warped_trapdoor: 'warped', waxed_oxidized_copper_trapdoor: 'waxed_oxidized_copper', spruce_trapdoor: 'spruce' }
  const step = (p, f, k = 1) => [p[0] + DIR[f][0] * k, p[1], p[2] + DIR[f][2] * k]
  const free = (x, y, z) => !b.has(x, y, z)

  function houseShell(h) {
    h.front ??= 'south'
    h.floors ??= 1
    const rng = kit.rng(strHash(h.id))
    const len = SIDE[h.front].len(h)
    const [fx, fz] = local(h, h.door ?? 2, -1)
    const fy = h.fy ?? hAt(fx, fz)
    const roofY = fy + 4 * h.floors
    const seed = strHash(h.id) & 1023
    const [main, base] = TONE[h.tone ?? 'white'](seed)
    // whitewash is dirtier near the ground: a noisy band of the "base" mix on the lowest courses
    const wall = (x, y, z) => (y <= fy + 1 + Math.floor(kit.hash01(x, 0, z, seed) * 2.2) ? base : main)
    const shutter = h.shutterMat ?? SHUTTERS[Math.floor(rng() * SHUTTERS.length)]
    // footprint mask: the rectangle minus an optional stair notch at a front corner
    const notch = new Set()
    if (h.stair) {
      const u0 = h.stair === 'left' ? 0 : len - 2
      for (let u = u0; u < u0 + 2; u += 1) for (let v = 0; v < 4; v += 1) notch.add(colKey(...local(h, u, v)))
    }
    const inFp = (x, z) => x >= h.x0 && x <= h.x1 && z >= h.z0 && z <= h.z1 && !notch.has(colKey(x, z))
    const edge = (x, z) => HZ.some(f => !inFp(x + DIR[f][0], z + DIR[f][2]))
    Object.assign(h, { fy, roofY, wall, rng, shutter, len, inFp, edge, notch })
    for (let x = h.x0; x <= h.x1; x += 1) {
      for (let z = h.z0; z <= h.z1; z += 1) {
        protectedCols.add(colKey(x, z))
        const g = hAt(x, z)
        for (let y = fy + 1; y <= Math.max(g, roofY + 3); y += 1) b.remove(x, y, z)
        if (!inFp(x, z)) continue
        const e = edge(x, z)
        for (let y = Math.min(g, fy) - 1; y < fy; y += 1) b.set(x, y, z, e ? wall : 'stone')
        b.set(x, fy, z, e ? wall : 'spruce_planks')
        for (let y = fy + 1; y <= roofY; y += 1) if (e) b.set(x, y, z, wall)
        for (let k = 1; k < h.floors; k += 1) if (!e) b.set(x, fy + 4 * k, z, 'spruce_planks')
        b.set(x, roofY, z, e ? wall : 'smooth_quartz')
        setH(x, z, roofY)
      }
    }
    // door landing: paved cells in front of the door, cut/filled to the floor level
    for (let du = -1; du <= (h.doorWidth ?? 1); du += 1) {
      for (let dv = 1; dv <= 2; dv += 1) {
        const [x, z] = local(h, (h.door ?? 2) + du, -dv)
        if (protectedCols.has(colKey(x, z))) continue
        for (let y = fy + 1; y <= fy + 5; y += 1) if (isTerrain(b.get(x, y, z))) b.remove(x, y, z)
        for (let y = hAt(x, z); y < fy; y += 1) b.set(x, y, z, 'stone')
        b.set(x, fy, z, PAVE)
        setH(x, z, fy)
      }
    }
    if (h.stair) exteriorStair(h)
    roofOf(h, h.x0, h.z0, h.x1, h.z1, roofY, h.roof, inFp)
    if (h.upper) {
      const u = h.upper
      const uy = roofY + 4
      const uIn = (x, z) => x >= u.x0 && x <= u.x1 && z >= u.z0 && z <= u.z1
      for (let x = u.x0; x <= u.x1; x += 1) for (let z = u.z0; z <= u.z1; z += 1) {
        const p = x === u.x0 || x === u.x1 || z === u.z0 || z === u.z1
        for (let y = roofY + 1; y <= uy; y += 1) b.set(x, y, z, p ? wall : 'air')
        b.set(x, uy, z, p ? wall : 'smooth_quartz')
        setH(x, z, uy)
      }
      roofOf(h, u.x0, u.z0, u.x1, u.z1, uy, 'flat', uIn)
      h.upperBox = { ...u, fy: roofY, roofY: uy }
    }
  }

  // Exterior stair in the front-corner notch: the inner column climbs along the house wall to
  // the roof terrace; the outer column is a stepped whitewashed balustrade (a Cycladic staple).
  function exteriorStair(h) {
    const inner = h.stair === 'left' ? 1 : h.len - 2
    const outer = h.stair === 'left' ? 0 : h.len - 1
    const up = opposite(h.front)
    for (let v = 0; v < 4; v += 1) {
      const [ix, iz] = local(h, inner, v)
      const [ox, oz] = local(h, outer, v)
      const y = h.fy + 1 + v
      for (let yy = h.fy; yy < y; yy += 1) { b.set(ix, yy, iz, h.wall); b.set(ox, yy, oz, h.wall) }
      b.set(ix, y, iz, `smooth_quartz_stairs[facing=${up},half=bottom]`)
      b.set(ox, y, oz, h.wall)
      b.set(ox, y + 1, oz, 'smooth_quartz_slab[type=bottom]')
    }
    h.stairTop = local(h, inner + (h.stair === 'left' ? 1 : -1), 3)
  }

  function roofOf(h, x0, z0, x1, z1, roofY, type, inFp) {
    if (type === 'flat') {
      // parapet: one course of whitewash with a rounded smooth-quartz slab cap
      for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) {
        if (!inFp(x, z) || !HZ.some(f => !inFp(x + DIR[f][0], z + DIR[f][2]))) continue
        if (b.has(x, roofY + 1, z)) continue
        if (h.stairTop && h.stairTop[0] === x && h.stairTop[1] === z) continue
        b.set(x, roofY + 1, z, h.wall)
        b.set(x, roofY + 2, z, 'smooth_quartz_slab[type=bottom]')
      }
    } else if (type === 'vault') {
      // barrel vault: steep first row, then flattening (a semicircle sampled in half-blocks)
      b.roof({ x0, z0, x1, z1, y: roofY + 1, type: 'gable', axis: h.vaultAxis, material: 'smooth_quartz', pitch: [2, 1, 0.5, 0.5, 0.5], overhang: 0, gableOverhang: 0, gable: h.wall, thickness: 0 })
    } else if (type === 'hip') {
      // low (1:2) terracotta hip roof; tile colours varied with a sun-faded ramp
      b.roof({ x0, z0, x1, z1, y: roofY + 1, type: 'hip', material: 'brick', pitch: 0.5, overhang: 1, eaveTrim: true, thickness: 0 })
      b.texture([x0 - 1, roofY, z0 - 1], [x1 + 1, roofY + 8, z1 + 1], ['polished_granite', 'granite', 'brick', 'mud_brick'], { only: ['*brick_stairs', '*brick_slab', 'bricks'], base: 0, edge: 0.1, drip: 0, noise: 0.5, seed: strHash(h.id) & 63 })
    }
  }

  // ------------------------------------------------------------------ walkways
  // Axis-aligned polylines [[x, z, y?], ...]. Waypoint levels default to the current ground
  // (H), so a walkway laid after the houses meets their door landings exactly. Levels are
  // interpolated per segment; a rise between two cells becomes a stair facing uphill.
  const pathCells = new Map()
  function walkway(points, { width = 2, tread = PAVE, stairs = 'polished_andesite_stairs', clear = 4, name = '?' } = {}) {
    const cells = []
    const idx = [0]
    for (let i = 1; i < points.length; i += 1) {
      const [ax, az] = points[i - 1]
      const [bx, bz] = points[i]
      const dir = kit.facingFrom(bx - ax, bz - az)
      const n = Math.abs(bx - ax) + Math.abs(bz - az)
      for (let k = i === 1 ? 0 : 1; k <= n; k += 1) cells.push({ x: ax + DIR[dir][0] * k, z: az + DIR[dir][2] * k, dir })
      idx.push(cells.length - 1)
    }
    const wl = points.map(p => p[2] ?? hAt(p[0], p[1]))
    // ending on an existing walkway: reach its level one cell early so the junction is flat
    const last = points[points.length - 1]
    const endOn = pathCells.has(colKey(last[0], last[1]))
    for (let i = 1; i < points.length; i += 1) {
      const a = idx[i - 1]
      const e = idx[i] - (i === points.length - 1 && endOn ? 1 : 0)
      const span = Math.max(1, e - a)
      if (Math.abs(wl[i] - wl[i - 1]) > span) console.warn(`walkway ${name}: segment ${i} rises ${wl[i] - wl[i - 1]} over ${span}`)
      for (let k = idx[i - 1]; k <= idx[i]; k += 1) cells[k].L = Math.round(wl[i - 1] + (wl[i] - wl[i - 1]) * Math.min(1, (k - a) / span))
    }
    const lo = -Math.floor((width - 1) / 2)
    cells.forEach((c, k) => {
      let facing = null
      if (k > 0 && cells[k - 1].L < c.L) facing = c.dir
      else if (k < cells.length - 1 && cells[k + 1].L < c.L) facing = opposite(cells[k + 1].dir)
      const perp = DIR[cw(c.dir)]
      for (let o = lo; o < lo + width; o += 1) {
        const x = c.x + perp[0] * o
        const z = c.z + perp[2] * o
        if (x < 0 || z < 0 || x >= W || z >= D) continue
        const key = colKey(x, z)
        if (protectedCols.has(key) || pathCells.has(key)) continue
        pathCells.set(key, { x, z, L: c.L })
        for (let y = c.L + 1; y <= c.L + clear; y += 1) if (isTerrain(b.get(x, y, z))) b.remove(x, y, z)
        for (let y = hAt(x, z) + 1; y < c.L; y += 1) b.set(x, y, z, y >= c.L - 1 ? WHITE : RETAIN)
        b.set(x, c.L, z, facing ? `${stairs}[facing=${facing},half=bottom]` : tread)
        setH(x, z, c.L)
      }
    })
  }
  // After all walkways: whitewashed parapets on the downhill side, stone retaining faces uphill.
  function walkwayEdges() {
    for (const { x, z, L } of pathCells.values()) {
      for (const f of HZ) {
        const nx = x + DIR[f][0]
        const nz = z + DIR[f][2]
        const key = colKey(nx, nz)
        if (nx < 0 || nz < 0 || nx >= W || nz >= D || pathCells.has(key) || protectedCols.has(key)) continue
        const g = hAt(nx, nz)
        if (g <= L - 2) {
          for (let y = g + 1; y <= L + 1; y += 1) b.set(nx, y, nz, y >= L ? WHITE : RETAIN)
          b.set(nx, L + 2, nz, 'smooth_quartz_slab[type=bottom]')
          setH(nx, nz, L + 1)
          protectedCols.add(key)
        } else if (g >= L + 2) {
          for (let y = L + 1; y <= g; y += 1) if (isTerrain(b.get(nx, y, nz))) b.set(nx, y, nz, RETAIN)
        }
      }
    }
  }

  // ------------------------------------------------------------------ openings & dressing
  function placeDoor(h) {
    const f = h.front
    const slot = h.door ?? 2
    const dw = h.doorWidth ?? 1
    const right = ccw(f)
    const inn = opposite(f)
    const at = i => { const [x, z] = SIDE[f].at(h, i); return [x, h.fy + 1, z] }
    const doorMat = DOORS[h.shutter]
    const niche = dw === 1 && slot >= 2 && slot <= h.len - 3
    if (niche) {
      // Arched niche: 3 wide x 3 tall opening in the wall plane, door set one block deeper,
      // upside-down stairs in the top corners round the head, a blue fanlight above the door.
      for (let i = -1; i <= 1; i += 1) for (let j = 0; j < 3; j += 1) { const [x, y, z] = at(slot + i); b.remove(x, y + j, z) }
      const [lx, ly, lz] = at(slot - 1)
      const [rx, ry, rz] = at(slot + 1)
      b.set(lx, ly + 2, lz, `smooth_quartz_stairs[facing=${opposite(right)},half=top]`)
      b.set(rx, ry + 2, rz, `smooth_quartz_stairs[facing=${right},half=top]`)
      for (const i of [-1, 1]) for (let j = 0; j < 3; j += 1) { const p = step(at(slot + i), inn); b.set(p[0], p[1] + j, p[2], h.wall) }
      const d = step(at(slot), inn)
      b.door(d, f, { material: doorMat })
      b.set(d[0], d[1] + 2, d[2], 'light_blue_stained_glass_pane')
    } else {
      b.door(at(slot), f, { material: doorMat, width: dw })
      for (let i = 0; i < dw; i += 1) { const [x, y, z] = at(slot + i); b.set(x, y + 2, z, 'light_blue_stained_glass_pane') }
    }
    // lamp bracket: an upside-down stair corbel beside the door with a lantern hanging below
    const lp = step(at(slot + (niche ? 2 : dw)), f)
    if (!protectedCols.has(colKey(lp[0], lp[2])) && free(lp[0], lp[1] + 2, lp[2]) && free(lp[0], lp[1] + 1, lp[2])) {
      b.set(lp[0], lp[1] + 2, lp[2], `smooth_quartz_stairs[facing=${inn},half=top]`)
      b.set(lp[0], lp[1] + 1, lp[2], 'lantern[hanging=true]')
    }
    h.doorSlots = new Set()
    for (let i = -2; i <= dw + 1; i += 1) h.doorSlots.add(slot + i)
    if (h.balcony && h.floors >= 2) balcony(h, slot)
  }

  // Juliet balcony over the front door: a top-slab ledge on stair corbels, wrought-iron railing,
  // and a second door behind it. It throws a shadow over the niche below (depth at eye level).
  function balcony(h, slot) {
    const f = h.front
    const y = h.fy + 4
    for (let i = -1; i <= 1; i += 1) {
      const [x, z] = SIDE[f].at(h, slot + i)
      const o = step([x, y, z], f)
      b.set(o[0], y, o[2], 'smooth_quartz_slab[type=top]')
      b.set(o[0], y + 1, o[2], 'iron_bars')
    }
    for (const i of [-1, 1]) {
      const [x, z] = SIDE[f].at(h, slot + i)
      const o = step([x, y - 1, z], f)
      if (free(...o)) b.set(...o, `smooth_quartz_stairs[facing=${opposite(f)},half=top]`)
    }
    const [x, z] = SIDE[f].at(h, slot)
    b.door([x, y + 1, z], f, { material: DOORS[h.shutter] })
  }

  function placeWindows(h) {
    const boxes = [{ box: h, floors: h.floors, fy: h.fy, inFp: h.inFp }]
    if (h.upperBox) {
      const u = h.upperBox
      boxes.push({ box: u, floors: 1, fy: u.fy, inFp: (x, z) => x >= u.x0 && x <= u.x1 && z >= u.z0 && z <= u.z1 })
    }
    const period = 3 + (strHash(h.id) % 2)
    for (const { box, floors, fy, inFp } of boxes) {
      for (let x = box.x0; x <= box.x1; x += 1) for (let z = box.z0; z <= box.z1; z += 1) {
        if (!inFp(x, z)) continue
        const outs = HZ.filter(f => !inFp(x + DIR[f][0], z + DIR[f][2]))
        if (outs.length !== 1) continue
        const f = outs[0]
        const along = f === 'north' || f === 'south' ? x : z
        if ((along + strHash(h.id + f)) % period !== 0) continue
        if (box === h && f === h.front) {
          const i = f === 'south' ? x - h.x0 : f === 'north' ? h.x1 - x : f === 'east' ? h.z1 - z : z - h.z0
          if (h.doorSlots.has(i)) continue
        }
        for (let k = 0; k < floors; k += 1) {
          const y = fy + 2 + 4 * k
          const o = step([x, y, z], f)
          if (!b.inBounds(o[0], y, o[2]) || !free(o[0], y, o[2]) || !free(o[0], y + 1, o[2])) continue
          if (!b.has(x, y, z) || !b.has(x, y + 1, z) || /stairs|door|pane|bars/.test(b.nameAt(x, y, z) ?? '')) continue
          if (k > 0 && h.rng() < 0.3) b.set(x, y + 1, z, 'light_blue_stained_glass_pane')
          else b.window([x, y, z], f, { width: 1, height: 2, glass: 'glass_pane', recess: 1, shutters: h.shutter, sill: 'smooth_quartz_slab[type=top]' })
        }
      }
    }
  }

  // ------------------------------------------------------------------ plants
  // Bougainvillea: a woody stem climbing a wall, a flattened blossom cloud over the top and a
  // few blossoms dropped on the ground. Cherry leaves (pink) + flowering azalea (magenta on green).
  function bougainvillea(x, y, z, height, seed = 0) {
    for (let k = 0; k < height; k += 1) if (free(x, y + k, z)) b.set(x, y + k, z, 'mangrove_roots[waterlogged=false]')
    b.leafBlob([x, y + height, z], [2.2, 1.3, 2.2], BOUG, { seed, holes: 0.25, roughness: 0.35 })
    for (let k = 0; k < 4; k += 1) {
      const px = x + Math.round((kit.hash01(seed, k, 1) - 0.5) * 4)
      const pz = z + Math.round((kit.hash01(seed, k, 2) - 0.5) * 4)
      const gy = hAt(px, pz)
      if (free(px, gy + 1, pz) && b.has(px, gy, pz)) b.set(px, gy + 1, pz, `pink_petals[facing=${HZ[k]},flower_amount=${1 + (k % 4)}]`)
    }
  }
  // Olive: short, leaning, grey-barked (acacia log), sparse silvery-green crown.
  function olive(x, z, seed) {
    const y = hAt(x, z) + 1
    b.tree([x, y, z], 'acacia', { log: 'acacia_wood', wood: 'acacia_wood', leaves: ['azalea_leaves', 'birch_leaves', 'azalea_leaves'], height: 4 + (seed % 2), trunk: 0.6, blob: [1.2, 1.7], branches: [2, 3], spread: 0.6, rise: 0.4, roots: 0, lean: 0.25, squash: 0.6, seed })
  }
  // Cypress: a dark, narrow flame. Lathe of spruce leaves, widest at a third of its height.
  function cypress(x, z, h = 9) {
    const y = hAt(x, z) + 1
    b.set(x, y, z, 'spruce_log[axis=y]')
    b.lathe([x, y + 1, z], h, (dy, t) => 0.55 + 1.05 * Math.sin(Math.min(1, t * 2.4 + 0.25) * Math.PI / 2) * (1 - t) ** 0.8, leaf('spruce_leaves'), { keep: true })
    b.set(x, y + h + 1, z, leaf('spruce_leaves'), { keep: true })
  }

  // ------------------------------------------------------------------ build: houses & paths
  for (const h of HOUSES) houseShell(h)

  // contour alleys first, then the stairs that climb between them
  walkway([[0, 45], [4, 45], [13, 45], [24, 45], [35, 45], [44, 45]], { name: 'promenade' })
  walkway([[0, 36], [3, 36], [13, 36], [23, 36], [33, 36], [41, 36]], { name: 'alleyB' })
  walkway([[0, 27], [6, 27], [16, 27], [23, 27], [37, 27], [47, 27]], { name: 'alleyC' })
  walkway([[12, 17], [19, 17], [30, 17], [43, 17], [48, 17]], { name: 'alleyD' })
  walkway([[17, 44], [17, 37]], { name: 's1a' })
  walkway([[16, 35], [16, 28]], { name: 's1b' })
  walkway([[19, 26], [19, 18]], { name: 's1c' })
  walkway([[28, 44], [28, 37]], { name: 's2a' })
  walkway([[28, 35], [28, 28]], { name: 's2b' })
  walkway([[30, 26], [30, 18]], { name: 's2c' })
  walkway([[23, 16], [23, 6]], { name: 's2d' })
  walkway([[41, 44], [41, 37]], { name: 's3a' })
  walkway([[38, 35], [38, 28]], { name: 's3b' })
  walkway([[45, 26], [45, 18]], { name: 's3c' })
  walkway([[37, 51, SEA + 1], [25, 51, 15], [25, 47]], { name: 'harbor' })
  walkway([[44, 45], [56, 45, CY]], { name: 'chapel' })
  walkwayEdges()
  for (const h of HOUSES) { placeDoor(h); placeWindows(h) }

  // ------------------------------------------------------------------ flagstones
  // Irregular flagstones with whitewashed joints (Cycladic courtyards): a jittered-grid Voronoi;
  // a cell is a joint where its two nearest sites are almost equidistant.
  const flagstone = (size = 3.2, seed = 0) => (x, y, z) => {
    let d1 = 1e9
    let d2 = 1e9
    let id = 0
    const gx = Math.floor(x / size)
    const gz = Math.floor(z / size)
    for (let i = -1; i <= 1; i += 1) for (let j = -1; j <= 1; j += 1) {
      const sx = (gx + i + kit.hash01(gx + i, 0, gz + j, seed)) * size
      const sz = (gz + j + kit.hash01(gx + i, 1, gz + j, seed)) * size
      const d = Math.hypot(x + 0.5 - sx, z + 0.5 - sz)
      if (d < d1) { d2 = d1; d1 = d; id = (gx + i) * 7919 + gz + j } else if (d < d2) d2 = d
    }
    if (d2 - d1 < 0.55) return 'smooth_quartz'
    return ['polished_andesite', 'andesite', 'polished_andesite', 'stone', 'smooth_stone'][Math.floor(kit.hash01(id, 2, 3, seed) * 5)]
  }

  // ------------------------------------------------------------------ chapel (the hero)
  const CW = pal({ smooth_quartz: 8, quartz_bricks: 1, calcite: 1 }, 77, 2) // cleanest whitewash on the hero
  const FLAG = flagstone(4, 5)
  for (let x = 56; x <= 86; x += 1) for (let z = 36; z <= 56; z += 1) {
    if (!inChapelPad(x, z)) continue
    for (let y = hAt(x, z) + 1; y <= CY; y += 1) b.set(x, y, z, rock)
    for (let y = CY + 1; y <= hAt(x, z) + 1; y += 1) b.remove(x, y, z)
    b.set(x, CY, z, FLAG)
    setH(x, z, CY)
    protectedCols.add(colKey(x, z))
  }
  // courtyard parapet wherever the ground falls away, with a lantern on every 6th cap
  let lampCount = 0
  for (let x = 56; x <= 86; x += 1) for (let z = 36; z <= 56; z += 1) {
    if (!inChapelPad(x, z)) continue
    const outside = HZ.filter(f => !inChapelPad(x + DIR[f][0], z + DIR[f][2]))
    if (outside.length === 0) continue
    const low = outside.some(f => hAt(x + DIR[f][0], z + DIR[f][2]) < CY - 1)
    if (!low || (x <= 58 && z >= 44 && z <= 47)) continue
    b.set(x, CY + 1, z, CW)
    b.set(x, CY + 2, z, 'smooth_quartz_slab[type=bottom]')
    if ((lampCount += 1) % 6 === 0) b.set(x, CY + 3, z, 'lantern[hanging=false]')
  }
  // nave: 15 x 9, walls 6 high on a grey stone plinth step
  const NV = { x0: 64, x1: 78, z0: 42, z1: 50 }
  for (let x = NV.x0 - 1; x <= NV.x1 + 1; x += 1) for (let z = NV.z0 - 1; z <= NV.z1 + 1; z += 1) {
    const inside = x >= NV.x0 && x <= NV.x1 && z >= NV.z0 && z <= NV.z1
    if (!inside) { b.set(x, CY + 1, z, 'polished_andesite_slab[type=bottom]'); continue }
    const wallCell = x === NV.x0 || x === NV.x1 || z === NV.z0 || z === NV.z1
    b.set(x, CY, z, wallCell ? CW : ((x + z) % 2 ? 'polished_andesite' : 'smooth_quartz'))
    for (let y = CY + 1; y <= CY + 6; y += 1) b.set(x, y, z, wallCell ? CW : 'air')
    b.set(x, CY + 6, z, CW)
  }
  // cornice: upside-down stairs under the vault springing line along both long walls
  for (let x = NV.x0; x <= NV.x1; x += 1) {
    b.set(x, CY + 6, NV.z0 - 1, 'smooth_quartz_stairs[facing=south,half=top]')
    b.set(x, CY + 6, NV.z1 + 1, 'smooth_quartz_stairs[facing=north,half=top]')
  }
  b.roof({ ...NV, y: CY + 7, type: 'gable', axis: 'x', material: 'smooth_quartz', pitch: [1, 1, 0.5, 0.5, 0.5], overhang: 0, gableOverhang: 0, gable: CW, thickness: 1 })
  // drum (7 across) with four arched lights, a slab cornice, then the blue dome and its cross
  const DC = [71, 46]
  b.tube([DC[0], CY + 7, DC[1]], 3.5, 8, CW)
  b.disc([DC[0], CY + 14, DC[1]], 3.2, 'smooth_quartz')
  b.ring([DC[0], CY + 14, DC[1]], 4.2, 'smooth_quartz_slab[type=top]', { thickness: 1 })
  b.lathe([DC[0], CY + 15, DC[1]], 6, (dy, t) => 3.9 * Math.sqrt(Math.max(0, 1 - (t * 0.97) ** 2)) + 0.1, DOME)
  const domeTop = CY + 21
  b.set(DC[0], domeTop, DC[1], 'smooth_quartz')
  b.set(DC[0], domeTop + 1, DC[1], 'end_rod[facing=up]')
  b.set(DC[0], domeTop + 2, DC[1], 'end_rod[facing=up]')
  b.set(DC[0] - 1, domeTop + 2, DC[1], 'end_rod[facing=west]')
  b.set(DC[0] + 1, domeTop + 2, DC[1], 'end_rod[facing=east]')
  b.set(DC[0], domeTop + 3, DC[1], 'end_rod[facing=up]')
  for (const f of HZ) {
    for (let k = 4; k >= 2; k -= 1) {
      const x = DC[0] + DIR[f][0] * k
      const z = DC[1] + DIR[f][2] * k
      if (!b.has(x, CY + 11, z)) continue
      b.set(x, CY + 11, z, 'light_blue_stained_glass_pane')
      b.set(x, CY + 12, z, 'light_blue_stained_glass_pane')
      b.set(...step([x, CY + 13, z], f), `smooth_quartz_slab[type=top]`)
      break
    }
  }
  // apse: a half-cylinder on the east end capped by a quarter dome
  b.fillWhere([NV.x1 + 1, CY + 1, NV.z0], [NV.x1 + 5, CY + 10, NV.z1], (x, y, z) => {
    const dy = y - (CY + 5)
    const r = dy <= 0 ? 3.6 : 3.6 * Math.sqrt(Math.max(0, 1 - (dy / 4.2) ** 2))
    return (x - NV.x1) ** 2 + (z - DC[1]) ** 2 <= r * r + 0.2
  }, (x, y) => (y > CY + 5 ? 'smooth_quartz' : CW))
  b.set(NV.x1 + 3, CY + 3, DC[1], 'light_blue_stained_glass_pane')
  b.set(NV.x1 + 3, CY + 4, DC[1], 'light_blue_stained_glass_pane')
  // west portal: arched niche with marble columns, a recessed door and a rose window above
  const wx = NV.x0
  for (let z = 45; z <= 47; z += 1) for (let y = CY + 1; y <= CY + 4; y += 1) b.remove(wx, y, z)
  b.set(wx, CY + 4, 45, 'smooth_quartz_stairs[facing=north,half=top]')
  b.set(wx, CY + 4, 47, 'smooth_quartz_stairs[facing=south,half=top]')
  b.set(wx, CY + 3, 46, 'light_blue_stained_glass_pane')
  b.set(wx, CY + 4, 46, 'light_blue_stained_glass_pane')
  for (let y = CY + 1; y <= CY + 4; y += 1) { b.set(wx + 1, y, 45, CW); b.set(wx + 1, y, 47, CW) }
  b.door([wx + 1, CY + 1, 46], 'west', { material: 'warped' })
  b.set(wx + 1, CY + 3, 46, CW)
  for (const z of [44, 48]) {
    b.column([wx - 1, CY + 1, z], 4, { shaft: 'quartz_pillar[axis=y]', plinth: 'chiseled_quartz_block', capital: 'chiseled_quartz_block' })
  }
  for (let z = 44; z <= 48; z += 1) b.set(wx - 1, CY + 5, z, z === 46 ? 'chiseled_quartz_block' : 'smooth_quartz_slab[type=bottom]')
  for (const [dz, dy] of [[0, 7], [-1, 7], [1, 7], [0, 6], [0, 8]]) b.set(wx, CY + dy, 46 + dz, 'light_blue_stained_glass')
  // arched side windows (2 x 3) on both long walls, a bench under each
  for (const [x, f, z] of [[66, 'south', NV.z1], [75, 'south', NV.z1], [67, 'north', NV.z0], [76, 'north', NV.z0]]) {
    b.window([x, CY + 2, z], f, { width: 2, height: 3, glass: 'light_blue_stained_glass_pane', arch: true, material: 'smooth_quartz', sill: 'smooth_quartz_slab[type=top]' })
  }
  for (const x of [68, 69, 72, 73]) b.set(x, CY + 2, NV.z1 + 1, 'smooth_quartz_stairs[facing=north,half=bottom]')
  // interior: pews, an iconostasis screen, candles, a hanging lamp under the dome
  for (let x = 66; x <= 73; x += 2) for (const z of [43, 44, 48, 49]) b.set(x, CY + 1, z, 'spruce_stairs[facing=west,half=bottom]')
  for (let z = NV.z0 + 1; z <= NV.z1 - 1; z += 1) {
    b.set(NV.x1 - 2, CY + 1, z, z === 46 ? 'air' : 'dark_oak_planks')
    b.set(NV.x1 - 2, CY + 2, z, z === 46 ? 'air' : (z % 2 ? 'gold_block' : 'dark_oak_planks'))
    b.set(NV.x1 - 2, CY + 3, z, 'dark_oak_slab[type=bottom]')
  }
  for (const z of [43, 49]) b.set(NV.x1 - 3, CY + 1, z, 'candle[candles=4,lit=true]')
  b.hangingLantern([DC[0], CY + 6, DC[1]], 1)
  // bell tower: three tiers stepping in, arched belfry with a bell, a small blue cupola on top
  const T = { x0: 58, z0: 38, x1: 62, z1: 42 }
  const tc = [60, 40]
  for (let x = T.x0; x <= T.x1; x += 1) for (let z = T.z0; z <= T.z1; z += 1) {
    const p = x === T.x0 || x === T.x1 || z === T.z0 || z === T.z1
    for (let y = CY + 1; y <= CY + 12; y += 1) if (p || y === CY + 8 || y === CY + 12) b.set(x, y, z, CW)
  }
  b.ring([tc[0], CY + 8, tc[1]], 3.1, 'smooth_quartz_slab[type=top]', { thickness: 1 })
  for (const f of HZ) {
    const r = DIR[ccw(f)]
    const c = [tc[0] + DIR[f][0] * 2, tc[1] + DIR[f][2] * 2]
    for (let i = -1; i <= 1; i += 1) for (let y = CY + 9; y <= CY + 11; y += 1) b.remove(c[0] + r[0] * i, y, c[1] + r[2] * i)
    b.set(c[0] - r[0], CY + 11, c[1] - r[2], `smooth_quartz_stairs[facing=${opposite(ccw(f))},half=top]`)
    b.set(c[0] + r[0], CY + 11, c[1] + r[2], `smooth_quartz_stairs[facing=${ccw(f)},half=top]`)
  }
  b.set(tc[0], CY + 11, tc[1], 'bell[attachment=ceiling,facing=south]')
  b.door([tc[0], CY + 1, T.z1], 'south', { material: 'warped' })
  b.set(tc[0], CY + 4, T.z1, 'light_blue_stained_glass_pane')
  b.set(T.x0, CY + 5, tc[1], 'light_blue_stained_glass_pane')
  b.ring([tc[0], CY + 12, tc[1]], 3.1, 'smooth_quartz_slab[type=bottom]', { thickness: 1 })
  for (let x = tc[0] - 1; x <= tc[0] + 1; x += 1) for (let z = tc[1] - 1; z <= tc[1] + 1; z += 1) {
    for (let y = CY + 13; y <= CY + 15; y += 1) b.set(x, y, z, (x === tc[0] || z === tc[1]) && y < CY + 15 && (x !== tc[0] || z !== tc[1]) ? 'air' : CW)
  }
  b.set(tc[0], CY + 14, tc[1], 'lantern[hanging=true]')
  b.lathe([tc[0], CY + 16, tc[1]], 3, (dy, t) => 1.9 * Math.sqrt(Math.max(0, 1 - (t * 0.9) ** 2)), DOME)
  b.set(tc[0], CY + 19, tc[1], 'end_rod[facing=up]')
  b.set(tc[0], CY + 20, tc[1], 'end_rod[facing=up]')
  b.set(tc[0] - 1, CY + 20, tc[1], 'end_rod[facing=west]')
  b.set(tc[0] + 1, CY + 20, tc[1], 'end_rod[facing=east]')
  // courtyard furniture: benches facing the sea, the gate the path enters through
  for (let x = 66; x <= 76; x += 1) if (x % 5 !== 1 && b.has(x, CY + 1, 54)) b.set(x, CY + 1, 53, 'smooth_quartz_stairs[facing=south,half=bottom]')
  for (const z of [43, 48]) { for (let y = CY + 1; y <= CY + 3; y += 1) b.set(57, y, z, CW); b.set(57, CY + 4, z, 'smooth_quartz_slab[type=bottom]'); b.set(57, CY + 4, z, 'lantern[hanging=false]') }

  // ------------------------------------------------------------------ harbor
  // quay face: dressed stone with weed-dark courses at the waterline
  for (let x = 0; x <= 38; x += 1) {
    for (let z = 50; z <= 58; z += 1) {
      if (!isQuay(x, z) || hAt(x, z + 1) > SEA) continue
      for (let y = 1; y <= SEA + 1; y += 1) b.set(x, y, z, y <= SEA - 1 ? pal({ mossy_stone_bricks: 2, stone_bricks: 1 }, 91) : QUAY)
      if (x % 6 === 2) b.set(x, SEA + 2, z, 'stone_brick_wall')
    }
  }
  // breakwater: rubble mound with a paved crest, ending in a small harbour light
  const MOLE = [[2, 58, 2, 70], [2, 70, 15, 70]]
  for (const [x0, z0, x1, z1] of MOLE) {
    for (let x = x0 - 2; x <= x1 + 2; x += 1) for (let z = z0 - 2; z <= z1 + 2; z += 1) {
      const d = Math.max(Math.abs(x - Math.max(x0, Math.min(x1, x))), Math.abs(z - Math.max(z0, Math.min(z1, z))))
      if (d > 2) continue
      const top = d <= 1 ? SEA + 1 : SEA - 1 + (kit.hash01(x, 0, z, 3) < 0.5 ? 1 : 0)
      for (let y = 0; y <= top; y += 1) b.set(x, y, z, d <= 1 && y === top ? QUAY : DRYSTONE)
      setH(x, z, top)
    }
  }
  for (let i = 0; i < 14; i += 1) {
    const t = R()
    const onX = R() < 0.55
    const x = onX ? Math.round(2 + t * 13) : 2 + (R() < 0.5 ? -3 : 3)
    const z = onX ? 70 + (R() < 0.5 ? -3 : 3) : Math.round(58 + t * 12)
    b.boulder([x, SEA - 0.5, z], [1.6, 1.2, 1.6], DRYSTONE, { seed: i })
  }
  // harbour light: a slim whitewashed column, iron gallery, green lamp, slab cap
  b.lathe([15, SEA + 2, 70], 6, (dy, t) => 1.25 - t * 0.2, CW)
  for (const f of HZ) b.set(15 + DIR[f][0], SEA + 8, 70 + DIR[f][2], 'iron_bars')
  b.set(15, SEA + 8, 70, 'sea_lantern')
  b.set(15, SEA + 9, 70, 'green_stained_glass')
  b.set(15, SEA + 10, 70, 'smooth_quartz_slab[type=bottom]')
  // wooden jetty on log piles
  for (let z = 58; z <= 68; z += 1) for (let x = 22; x <= 24; x += 1) {
    b.set(x, SEA + 1, z, x === 23 ? 'spruce_planks' : 'stripped_spruce_log[axis=z]')
    if ((x === 22 || x === 24) && z % 3 === 1) for (let y = 1; y <= SEA + 2; y += 1) b.set(x, y, z, y === SEA + 1 ? 'stripped_spruce_log[axis=z]' : 'spruce_log[axis=y]')
  }
  // fishing boats: white hulls with a coloured sheer strake, built along +x or +z
  function boat(x0, z0, len, dir, band, { half = 1, cabin = false } = {}) {
    const fwd = DIR[dir]
    const side = DIR[cw(dir)]
    for (let u = 0; u < len; u += 1) {
      const end = Math.min(u, len - 1 - u)
      const hw = end === 0 ? 0 : end === 1 ? Math.max(0, half - 1) : half
      for (let w = -hw; w <= hw; w += 1) {
        const x = x0 + fwd[0] * u + side[0] * w
        const z = z0 + fwd[2] * u + side[2] * w
        const rim = Math.abs(w) === hw
        b.set(x, SEA, z, rim ? band : 'spruce_planks')
        if (rim) b.set(x, SEA + 1, z, end === 0 ? `smooth_quartz_stairs[facing=${u === 0 ? opposite(dir) : dir},half=bottom]` : 'smooth_quartz_slab[type=bottom]')
        else if (u === Math.floor(len / 2)) b.set(x, SEA + 1, z, 'spruce_slab[type=bottom]')
      }
    }
    const bow = [x0 + fwd[0] * (len - 1), SEA + 2, z0 + fwd[2] * (len - 1)]
    b.set(...bow, 'spruce_fence')
    if (cabin) {
      for (let u = 1; u <= 3; u += 1) for (let w = -1; w <= 1; w += 1) {
        const x = x0 + fwd[0] * u + side[0] * w
        const z = z0 + fwd[2] * u + side[2] * w
        for (let y = SEA + 1; y <= SEA + 2; y += 1) b.set(x, y, z, Math.abs(w) === 1 || u === 1 ? (y === SEA + 2 && u !== 1 ? 'glass_pane' : 'smooth_quartz') : 'air')
        b.set(x, SEA + 3, z, 'spruce_slab[type=bottom]')
      }
      const m = [x0 + fwd[0] * 6, SEA + 1, z0 + fwd[2] * 6]
      for (let y = 1; y <= 4; y += 1) b.set(m[0], SEA + y, m[2], 'spruce_fence')
      b.set(m[0], SEA + 5, m[2], 'lantern[hanging=false]')
    }
  }
  boat(28, 59, 11, 'south', 'lapis_block', { half: 2, cabin: true })
  boat(19, 61, 7, 'south', 'red_terracotta')
  boat(7, 63, 7, 'east', 'cyan_terracotta')
  boat(31, 66, 6, 'east', 'lapis_block')
  // boathouses carved into the cliff foot, framed by whitewashed arches
  for (const bx of [4, 11]) {
    let zf = 52
    while (zf > 40 && hAt(bx + 1, zf) < SEA + 6) zf -= 1
    for (let x = bx - 1; x <= bx + 3; x += 1) for (let y = SEA + 2; y <= SEA + 6; y += 1) b.set(x, y, zf, CW)
    for (let x = bx; x <= bx + 2; x += 1) for (let z = zf - 4; z <= zf; z += 1) for (let y = SEA + 2; y <= SEA + 4; y += 1) b.remove(x, y, z)
    b.set(bx, SEA + 4, zf, 'smooth_quartz_stairs[facing=west,half=top]')
    b.set(bx + 2, SEA + 4, zf, 'smooth_quartz_stairs[facing=east,half=top]')
    b.set(bx + 1, SEA + 2, zf - 3, 'barrel[facing=up]')
    b.set(bx + 1, SEA + 4, zf - 1, 'lantern[hanging=true]')
    for (let x = bx - 1; x <= bx + 3; x += 1) b.set(x, SEA + 7, zf, 'smooth_quartz_slab[type=bottom]')
  }
  // quay life: barrels, crates, nets (cobweb heaps), benches, lamps
  for (const [x, z, blk] of [[9, 53, 'barrel[facing=up]'], [10, 53, 'barrel[facing=up]'], [9, 54, 'barrel[facing=north]'], [30, 54, 'spruce_planks'], [31, 54, 'barrel[facing=up]'], [30, 53, 'cobweb'], [17, 55, 'cobweb'], [35, 53, 'composter']]) b.set(x, SEA + 2, z, blk)
  for (const x of [6, 16, 28, 36]) b.lampPost([x, SEA + 2, 56], { height: 3, post: 'dark_oak_fence', foot: 'stone_brick_wall' })

  // ------------------------------------------------------------------ beach
  for (const [x, z, f] of [[44, 57, 'blue'], [51, 58, 'white']]) {
    for (let y = SEA + 2; y <= SEA + 4; y += 1) b.set(x, y, z, 'spruce_fence')
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(x + dx, SEA + 5, z + dz, (dx + dz) % 2 ? 'light_blue_wool' : 'white_wool')
    void f
    for (const dx of [-1, 1]) { b.set(x + dx, SEA + 2, z + 1, 'birch_slab[type=bottom]'); b.set(x + dx, SEA + 2, z, 'birch_stairs[facing=north,half=bottom]') }
  }
  boat(55, 55, 5, 'west', 'cyan_terracotta')
  for (let i = 0; i < 40; i += 1) {
    const x = Math.round(R.range(38, 60))
    const z = Math.round(R.range(60, 70))
    const y = hAt(x, z)
    if (y < SEA - 1 && y >= 0 && !b.has(x, y + 1, z, 'water')) continue
    if (y < SEA) b.set(x, y + 1, z, R() < 0.7 ? 'seagrass' : 'sea_pickle[pickles=3,waterlogged=true]')
  }
  for (const [x, z, r] of [[39, 59, 1.8], [58, 60, 2.2], [62, 62, 2.6], [70, 64, 2.0], [84, 62, 2.4], [90, 59, 2.4]]) b.boulder([x, SEA, z], [r, r * 0.8, r], ROCK.dark, { seed: x })

  // ------------------------------------------------------------------ windmill (a second landmark)
  // Cycladic mill on the falling headland ridge: a squat whitewashed drum, a conical timber cap
  // and a wheel of eight spars carrying triangular cloth sails. It silhouettes against the sky
  // and balances the dense village on the far side of the chapel.
  const MW = [86, 24]
  const my = hAt(...MW)
  for (let x = MW[0] - 5; x <= MW[0] + 5; x += 1) for (let z = MW[1] - 5; z <= MW[1] + 5; z += 1) {
    if (Math.hypot(x - MW[0], z - MW[1]) > 5.2) continue
    for (let y = hAt(x, z) + 1; y <= my; y += 1) b.set(x, y, z, DRYSTONE)
    for (let y = my + 1; y <= my + 4; y += 1) b.remove(x, y, z)
    b.set(x, my, z, PAVE)
    setH(x, z, my)
    protectedCols.add(colKey(x, z))
  }
  b.cylinder([MW[0], my - 1, MW[1]], 3.5, 12, (x, y, z) => (y <= my ? 'polished_andesite' : CW))
  for (let y = my + 1; y <= my + 10; y += 1) b.disc([MW[0], y, MW[1]], 2.4, 'air')
  b.coneRoof([MW[0], my + 11, MW[1]], 3.5, { material: 'spruce', pitch: 1, overhang: 1, flare: true })
  b.door([MW[0], my + 1, MW[1] + 3], 'south', { material: 'spruce' })
  b.set(MW[0] + 3, my + 5, MW[1], 'glass_pane')
  b.set(MW[0] - 3, my + 3, MW[1], 'glass_pane')
  // four spars in a cross (axis-aligned, so the fences connect into clean lines), each carrying
  // a triangular cloth sail that widens toward the tip
  const hub = [MW[0], my + 9, MW[1] + 5]
  b.set(MW[0], hub[1], MW[1] + 4, 'stripped_spruce_log[axis=z]')
  b.set(...hub, 'spruce_planks')
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const [px, py] = [-dy, dx]
    for (let t = 1; t <= 6; t += 1) {
      b.set(hub[0] + dx * t, hub[1] + dy * t, hub[2], 'spruce_fence')
      for (let k = 1; k <= Math.round((t - 1) * 0.55); k += 1) b.set(hub[0] + dx * t + px * k, hub[1] + dy * t + py * k, hub[2], 'white_wool')
    }
  }

  // ------------------------------------------------------------------ terrace life
  // Flat roofs are the Cycladic living room: tables, loungers facing the sea, pots on the
  // parapet, a chimney pot, sometimes a pergola. Everything checks that its cells are free.
  const POTS = ['potted_red_tulip', 'potted_cactus', 'potted_flowering_azalea_bush', 'potted_azalea_bush', 'potted_fern', 'potted_orange_tulip', 'potted_cornflower']
  const roofFree = (h, x, z) => h.inFp(x, z) && !h.edge(x, z) && free(x, h.roofY + 1, z) && free(x, h.roofY + 2, z) && !(h.upperBox && x >= h.upperBox.x0 && x <= h.upperBox.x1 && z >= h.upperBox.z0 && z <= h.upperBox.z1)
  function parasol(x, y, z, seed) {
    for (let k = 0; k < 3; k += 1) b.set(x, y + k, z, 'spruce_fence')
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(x + dx, y + 3, z + dz, (dx + dz + seed) % 2 ? 'light_blue_wool' : 'white_wool', { keep: dx !== 0 || dz !== 0 })
  }
  function tableSet(x, y, z) {
    b.set(x, y, z, 'spruce_fence')
    b.set(x, y + 1, z, 'white_carpet')
    if (free(x - 1, y, z)) b.set(x - 1, y, z, 'spruce_stairs[facing=west,half=bottom]')
    if (free(x + 1, y, z)) b.set(x + 1, y, z, 'spruce_stairs[facing=east,half=bottom]')
  }
  function roofTerrace(h) {
    if (h.roof !== 'flat') return
    const y = h.roofY + 1
    const cells = []
    for (let x = h.x0; x <= h.x1; x += 1) for (let z = h.z0; z <= h.z1; z += 1) if (roofFree(h, x, z)) cells.push([x, z])
    if (cells.length === 0) return
    const rng = kit.rng(strHash(h.id) + 5)
    if (h.chimney) {
      const [x, z] = cells.find(([x, z]) => z === Math.min(...cells.map(c => c[1]))) ?? cells[0]
      b.set(x, y, z, h.wall); b.set(x, y + 1, z, h.wall); b.set(x, y + 2, z, 'mud_brick_wall')
    }
    if (h.pergola) {
      const xs = cells.map(c => c[0])
      const zs = cells.map(c => c[1])
      const x0 = Math.min(...xs)
      const z1 = Math.max(...zs)
      const x1 = Math.min(Math.max(...xs), x0 + 3)
      const z0 = Math.max(Math.min(...zs), z1 - 2)
      for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { b.set(px, y, pz, 'spruce_fence'); b.set(px, y + 1, pz, 'spruce_fence') }
      for (let x = x0; x <= x1; x += 1) { b.set(x, y + 2, z0, 'stripped_spruce_log[axis=x]'); b.set(x, y + 2, z1, 'stripped_spruce_log[axis=x]') }
      for (let z = z0 + 1; z < z1; z += 1) for (let x = x0; x <= x1; x += 2) b.set(x, y + 2, z, 'stripped_spruce_log[axis=z]')
      b.leafBlob([x0 + 1, y + 3, (z0 + z1) / 2], [2.2, 0.6, 1.6], BOUG, { seed: strHash(h.id), holes: 0.35 })
      tableSet(Math.round((x0 + x1) / 2), y, Math.round((z0 + z1) / 2))
    } else if (h.terrace && cells.length > 10) {
      // loungers along the seaward edge, a parasol, a table
      const seaward = cells.filter(([x, z]) => !roofFree(h, x, z + 1) && roofFree(h, x, z - 1)).slice(0, 4)
      seaward.forEach(([x, z], i) => { if (i % 2 === 0 && free(x, y, z)) { b.set(x, y, z, 'birch_slab[type=bottom]'); b.set(x, y, z - 1, 'birch_stairs[facing=north,half=bottom]') } })
      const mid = cells[Math.floor(cells.length / 2)]
      if (free(mid[0], y, mid[1]) && free(mid[0] + 1, y, mid[1]) && free(mid[0] - 1, y, mid[1])) tableSet(mid[0], y, mid[1])
      const ps = cells.find(([x, z]) => free(x, y, z) && free(x + 1, y + 3, z) && free(x, y + 1, z) && Math.abs(x - mid[0]) + Math.abs(z - mid[1]) >= 3)
      if (ps) parasol(ps[0], y, ps[1], strHash(h.id))
    }
    // pots on the parapet caps
    for (let x = h.x0; x <= h.x1; x += 1) for (let z = h.z0; z <= h.z1; z += 1) {
      if (!h.inFp(x, z) || !h.edge(x, z) || rng() > 0.12) continue
      if (b.nameAt(x, y + 1, z) === 'minecraft:smooth_quartz_slab' && free(x, y + 2, z)) b.set(x, y + 2, z, rng() < 0.3 ? 'decorated_pot' : POTS[Math.floor(rng() * POTS.length)])
    }
  }

  // String lights: a sagging-free chain line with lanterns hung every other block.
  function stringLights(a, c, y) {
    const dir = kit.facingFrom(c[0] - a[0], c[1] - a[1])
    const n = Math.abs(c[0] - a[0]) + Math.abs(c[1] - a[1])
    const axis = dir === 'east' || dir === 'west' ? 'x' : 'z'
    for (let k = 0; k <= n; k += 1) {
      const x = a[0] + DIR[dir][0] * k
      const z = a[1] + DIR[dir][2] * k
      if (!free(x, y, z)) continue
      b.set(x, y, z, `chain[axis=${axis}]`)
      if (k % 2 === 1 && free(x, y - 1, z)) b.set(x, y - 1, z, 'lantern[hanging=true]')
    }
  }

  // Interiors: whitewashed rooms with a table, chairs, a bed against the back wall, a barrel,
  // and a lantern hanging from the ceiling (it is what glows through the windows at night).
  function furnish(h) {
    const BEDS = ['light_blue_bed', 'white_bed', 'cyan_bed']
    for (let k = 0; k < h.floors; k += 1) {
      const y = h.fy + 1 + 4 * k
      const cells = []
      for (let x = h.x0 + 1; x < h.x1; x += 1) for (let z = h.z0 + 1; z < h.z1; z += 1) {
        if (h.inFp(x, z) && !h.edge(x, z) && free(x, y, z) && free(x, y + 1, z)) cells.push([x, z])
      }
      if (cells.length < 6) continue
      const mx = (h.x0 + h.x1) >> 1
      const mz = (h.z0 + h.z1) >> 1
      b.hangingLantern([mx, y + 3, mz], 0)
      // bed: head against the back (uphill) wall
      const back = cells.filter(([x, z]) => !h.inFp(x, z - 1) || h.edge(x, z - 1)).filter(([x, z]) => free(x, y, z + 1) && cells.some(c => c[0] === x && c[1] === z + 1))
      if (back.length) {
        const [bx, bz] = back[back.length - 1]
        const bed = BEDS[strHash(h.id + k) % BEDS.length]
        b.set(bx, y, bz, `${bed}[facing=north,part=head,occupied=false]`)
        b.set(bx, y, bz + 1, `${bed}[facing=north,part=foot,occupied=false]`)
      }
      if (free(mx, y, mz) && free(mx, y + 1, mz)) tableSet(mx, y, mz)
      const corner = cells.find(([x, z]) => free(x, y, z) && (x === h.x0 + 1 || x === h.x1 - 1) && (z === h.z0 + 1 || z === h.z1 - 1))
      if (corner) b.set(corner[0], y, corner[1], k === 0 ? 'barrel[facing=up]' : 'decorated_pot')
      if (k === 0) {
        const rug = cells.filter(([x, z]) => Math.abs(x - mx) <= 1 && Math.abs(z - mz) <= 1 && free(x, y, z))
        for (const [x, z] of rug) b.set(x, y, z, 'blue_carpet')
      }
    }
  }

  for (const h of HOUSES) { roofTerrace(h); furnish(h) }

  // ------------------------------------------------------------------ pool terrace (b5)
  // Cantilevered terrace in front of b5 with a plunge pool: tiled lining, lit from below.
  {
    const h = HOUSES.find(q => q.id === 'b5')
    const y = h.fy
    for (let x = 43; x <= 51; x += 1) for (let z = 39; z <= 44; z += 1) {
      const key = colKey(x, z)
      if (protectedCols.has(key) || pathCells.has(key)) continue
      for (let yy = hAt(x, z) + 1; yy < y; yy += 1) b.set(x, yy, z, yy >= y - 1 ? h.wall : RETAIN)
      for (let yy = y + 1; yy <= y + 4; yy += 1) if (isTerrain(b.get(x, yy, z))) b.remove(x, yy, z)
      b.set(x, y, z, FLAG)
      setH(x, z, y)
      protectedCols.add(key)
      if (z === 44 || x === 51) { b.set(x, y + 1, z, h.wall); b.set(x, y + 2, z, 'smooth_quartz_slab[type=bottom]') }
    }
    for (let x = 45; x <= 49; x += 1) for (let z = 40; z <= 42; z += 1) {
      b.set(x, y - 2, z, 'light_blue_concrete')
      b.set(x, y - 1, z, 'water')
      b.set(x, y, z, 'water')
      for (const f of HZ) { const nx = x + DIR[f][0]; const nz = z + DIR[f][2]; if (nx < 45 || nx > 49 || nz < 40 || nz > 42) { b.set(nx, y - 1, nz, 'light_blue_concrete'); b.set(nx, y, nz, 'smooth_quartz') } }
    }
    b.set(45, y - 2, 41, 'sea_lantern')
    b.set(49, y - 2, 41, 'sea_lantern')
    for (const x of [44, 50]) { b.set(x, y + 1, 40, 'birch_stairs[facing=north,half=bottom]'); b.set(x, y + 1, 41, 'birch_slab[type=bottom]') }
    parasol(44, y + 1, 42, 1)
  }

  // ------------------------------------------------------------------ taverna terrace (a4)
  // Across the promenade from the taverna: a terrace on the cliff edge with tables under a
  // vine pergola strung with lanterns, looking down on the beach.
  {
    const L = hAt(35, 45)
    for (let x = 30; x <= 41; x += 1) for (let z = 47; z <= 50; z += 1) {
      const key = colKey(x, z)
      if (pathCells.has(key)) continue
      for (let yy = hAt(x, z) + 1; yy < L; yy += 1) b.set(x, yy, z, yy >= L - 1 ? WHITE : RETAIN)
      for (let yy = L + 1; yy <= L + 5; yy += 1) if (isTerrain(b.get(x, yy, z)) || b.nameAt(x, yy, z) === 'minecraft:smooth_quartz_slab' || /quartz|calcite/.test(b.nameAt(x, yy, z) ?? '')) b.remove(x, yy, z)
      const rim = z === 50 || x === 30 || x === 41
      b.set(x, L, z, rim ? WHITE : 'spruce_planks')
      setH(x, z, L)
      protectedCols.add(key)
      if (rim) { b.set(x, L + 1, z, WHITE); b.set(x, L + 2, z, 'smooth_quartz_slab[type=bottom]') }
    }
    for (const x of [32, 36, 39]) tableSet(x, L + 1, 48)
    for (const [x, z] of [[31, 47], [40, 47], [31, 49], [40, 49]]) for (let k = 1; k <= 3; k += 1) b.set(x, L + k, z, 'spruce_fence')
    for (let x = 31; x <= 40; x += 1) { b.set(x, L + 4, 47, 'stripped_spruce_log[axis=x]'); b.set(x, L + 4, 49, 'stripped_spruce_log[axis=x]') }
    for (let x = 31; x <= 40; x += 3) b.set(x, L + 4, 48, 'spruce_fence')
    b.leafBlob([33, L + 5, 48], [2.4, 0.6, 1.5], ['azalea_leaves', 'flowering_azalea_leaves', 'oak_leaves'], { seed: 3, holes: 0.4 })
    for (const x of [33, 37]) b.set(x, L + 3, 48, 'lantern[hanging=true]')
    for (const x of [35]) b.set(x, L + 3, 48, 'lantern[hanging=true]')
  }

  // ------------------------------------------------------------------ village ground
  // Leftover slope between houses and alleys: stone terrace walls where it steps, small gardens
  // (dry grass, herbs, flowers, a bush) on top — never raw dirt next to a whitewashed wall.
  const GARDEN = [[6, 'short_grass'], [2, 'fern'], [1, 'poppy'], [1, 'cornflower'], [1, 'allium'], [1, 'oxeye_daisy'], [1, 'azure_bluet']]
  for (let x = 0; x <= 58; x += 1) for (let z = 2; z <= 47; z += 1) {
    const key = colKey(x, z)
    if (protectedCols.has(key) || pathCells.has(key)) continue
    const g = hAt(x, z)
    const top = b.get(x, g, z)
    if (!isTerrain(top)) continue
    const drop = Math.max(...HZ.map(f => g - hAt(x + DIR[f][0], z + DIR[f][2])))
    for (let k = 0; k < Math.min(drop, 8); k += 1) if (isTerrain(b.get(x, g - k, z))) b.set(x, g - k, z, RETAIN)
    const nearWalk = HZ.some(f => pathCells.has(colKey(x + DIR[f][0], z + DIR[f][2])))
    if (kit.noise.coherent01(x, 0, z, { scale: 4, seed: 12 }) < 0.35 && !nearWalk) b.set(x, g, z, 'gravel')
    else {
      b.set(x, g, z, 'grass_block')
      if (free(x, g + 1, z)) {
        const r = kit.hash01(x, g, z, 77)
        if (r < 0.06) b.leafBlob([x, g + 1, z], [1, 0.8, 1], ['azalea_leaves', 'flowering_azalea_leaves'], { seed: x * 31 + z })
        else if (r < 0.55) {
          let t = kit.hash01(x, g, z, 78) * 13
          for (const [w, id] of GARDEN) { if (t < w) { b.set(x, g + 1, z, id); break } t -= w }
        }
      }
    }
  }

  // ------------------------------------------------------------------ lights
  stringLights([3, 46], [44, 46], hAt(20, 46) + 4)
  stringLights([2, 55], [37, 55], SEA + 5)

  // ------------------------------------------------------------------ vegetation
  for (const h of HOUSES) {
    if (!h.vine) continue
    const [x, z] = local(h, h.vine, -1)
    bougainvillea(x, h.fy + 1, z, 3, strHash(h.id))
  }
  for (const [x, z, s] of [[60, 16, 1], [72, 20, 2], [76, 26, 3], [80, 12, 4], [70, 13, 5], [79, 33, 6], [64, 36, 7], [91, 34, 8], [62, 4, 9], [74, 4, 10], [66, 21, 11], [86, 6, 12], [87, 13, 13], [58, 26, 14]]) olive(x, z, s)
  for (const [x, z, h] of [[59, 35, 10], [84, 41, 9], [57, 12, 11], [51, 14, 9], [3, 8, 10], [9, 4, 8], [38, 6, 9], [73, 30, 8]]) cypress(x, z, h)

  return b.finish({ name: 'coastal-village' })
}
