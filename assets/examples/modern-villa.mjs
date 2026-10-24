// MODERN VILLA — v4 (structure + detail + landscape draft)

export default function build(api) {
  const { kit } = api
  const STAGES = ['massing', 'structure', 'texture', 'detail', 'final']
  const stage = STAGES.indexOf(process.env.STAGE ?? 'final')
  const at = s => stage >= STAGES.indexOf(s)

  const W = 70, H = 45, D = 60
  const b = api.builder([W, H, D], { seed: 5 })
  const SEA = 5
  const Y1 = 15, Y2 = 20, Y3 = 25, YR = 30
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
  const n2 = (x, z, s, seed, octaves = 3) => kit.noise.fbm2(x, z, { scale: s, seed, octaves })
  const smin = (a, c, k) => { const h = Math.max(k - Math.abs(a - c), 0) / k; return Math.min(a, c) - h * h * k * 0.25 }
  const hash = (x, y, z, s) => kit.noise.hash01(x, y, z, s)
  const set = (x, y, z, p) => b.set(x, y, z, p)

  // ---------------------------------------------------------------- palette (roles)
  const WHITE = 'white_concrete'
  const PLATE = 'smooth_quartz'
  const STONE = kit.palette({ polished_deepslate: 5, deepslate_tiles: 1 }, { scale: 4, seed: 2 })
  const FRAME = 'black_concrete'
  const MULL = 'polished_blackstone_wall'  // thin mullion: a wall post between panes reads ~half a block wide
  const GLASS = 'light_gray_stained_glass_pane'
  const RAIL = 'glass_pane'
  const WOOD = 'stripped_spruce_log[axis=y]'
  const SOFFIT = 'stripped_spruce_wood'
  const DECK = 'smooth_stone'
  const FLOOR = 'stripped_oak_wood'
  const BOARD = 'spruce_slab[type=bottom]'
  const LIGHT = 'ochre_froglight'

  // ---------------------------------------------------------------- site
  const UP = 20, LOW = 15, LEDGE = 14
  const coastS = x => 43.2 + 1.8 * n2(x, 0, 6, 5) + (x < 14 ? (14 - x) * 0.5 : 0)
  const coastE = z => 56.8 + 1.5 * n2(0, z, 6, 6)
  const landD = (x, z) => smin(coastS(x) - z, coastE(z) - x, 6) + 0.9 * n2(x, z, 4, 9) + 0.6 * n2(x, z, 2.5, 19)  // ragged coast: in/out 2-3 blocks
  const hLand = (x, z) => {
    let h = UP - (UP - LOW) * smooth((z - 29.5 - 1.6 * n2(x, 0, 7, 1)) / 2.5)
    h -= (h - LEDGE) * smooth((x - 49.5 - 1.5 * n2(0, z, 7, 2)) / 2.5)
    h -= 6 * smooth((14 - x) / 10) * smooth((z - 40) / 8)
    return h + 0.35 * n2(x, z, 14, 3)
  }
  const BEACH = (x, z) => smooth((17 - x) / 7) * smooth((z - 38) / 5)               // 0..1, the SW cove
  const raw = (x, z) => {
    const d = landD(x, z)
    const land = hLand(x, z)
    const bch = BEACH(x, z)
    const seabed = SEA - 2.2 - Math.min(2.2, -d * 0.4) + 0.6 * n2(x, z, 7, 4)
    if (d < 0) return seabed
    // in the cove the cliff foot is pushed 5 blocks inland and a flat sand/shingle shelf fills the gap
    const dc = d - 6 * bch
    const cliff = SEA - 2 + (land - SEA + 2) * smooth(dc / 3 + 0.35 * n2(x, z, 3, 8))  // noisy profile = ledges + buttresses
    return bch > 0.15 ? Math.max(SEA + (d > 1.2 ? 1 : 0), cliff) : cliff
  }
  const HM = Array.from({ length: W }, (_, x) => Array.from({ length: D }, (_, z) => Math.round(raw(x, z))))
  const hAt = (x, z) => HM[Math.max(0, Math.min(W - 1, x))][Math.max(0, Math.min(D - 1, z))]
  const slope = (x, z) => Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => Math.abs(hAt(x + dx, z + dz) - hAt(x, z))))
  const ROCK = ['tuff', 'andesite', 'tuff', 'cobbled_deepslate', 'stone', 'tuff', 'deepslate', 'andesite', 'tuff', 'stone']  // a darker volcanic coast: the white villa pops against it
  const strata = (x, y, z) => {
    if (y <= SEA + 1 && hash(x, y, z, 3) < 0.6) return hash(x, y, z, 4) < 0.5 ? 'deepslate' : 'tuff'
    const band = Math.floor((y + 2.2 * n2(x, z, 8, 7, 2)) / 2)
    return ROCK[((band % ROCK.length) + ROCK.length) % ROCK.length]
  }
  const grassMix = kit.palette({ grass_block: 30, coarse_dirt: 2, podzol: 1 }, { scale: 5, seed: 3 })
  const surface = (x, y, z) => {
    const s = slope(x, z)
    if (y < SEA) return kit.palette({ sand: 3, gravel: 2, clay: 1 }, { scale: 2, seed: 9 })
    if (BEACH(x, z) > 0.15 && y <= SEA + 1) return kit.palette({ sand: 6, gravel: 1 }, { scale: 2, seed: 10 })
    if (s >= 2) return kit.noise.coherent01(x, y, z, { scale: 3, seed: 21 }) > 0.72 ? 'moss_block' : strata(x, y, z)  // moss in clumps
    if (y <= SEA + 1) return kit.palette({ gravel: 2, sand: 1 }, { scale: 2, seed: 11 })
    return grassMix
  }
  const ground = b.terrain({
    height: (x, z) => HM[x][z],
    layers: [
      { depth: 1, paint: surface },
      { depth: 3, paint: (x, y, z) => (slope(x, z) >= 2 ? strata(x, y, z) : 'dirt') },
      { paint: strata },
    ],
  })
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) for (let y = ground(x, z) + 1; y <= SEA; y++) b.set(x, y, z, 'water')

  // ---------------------------------------------------------------- plan
  const L1 = { x0: 18, x1: 50, z0: 22, z1: 33 }
  const L2 = { x0: 28, x1: 58, z0: 16, z1: 27 }
  const L3 = { x0: 30, x1: 44, z0: 13, z1: 22 }
  const TER = { x0: 12, x1: 52, z0: 34, z1: 41 }
  const POOL = { x0: 25, x1: 45, z0: 37, z1: 44 }
  const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

  // foundations
  for (let x = 11; x <= 53; x++) for (let z = 21; z <= 42; z++) {
    if (!inR(L1, x, z) && !inR(TER, x, z)) continue
    // distance to the open deck edge: the outer row is a 1-thick cantilevered slab, the next row a
    // 3-deep beam; only the core is filled down to the rock. The natural cliff shows below.
    const e = inR(L1, x, z) ? 9 : Math.min(TER.z1 - z, x - TER.x0, TER.x1 - x)
    const bottom = e === 0 ? Y1 : e === 1 ? Y1 - 3 : -1
    for (let y = Math.max(ground(x, z) + 1, bottom); y < Y1; y++) set(x, y, z, strata(x, y, z))
    for (let y = Y1 + 1; y <= Y2 + 3; y++) if (!inR(L1, x, z) || y <= Y2) b.remove(x, y, z)
    set(x, Y1, z, DECK)
  }
  for (let x = TER.x0; x <= TER.x1; x++) set(x, Y1, TER.z1, PLATE)
  for (let z = TER.z0; z <= TER.z1; z++) { set(TER.x0, Y1, z, PLATE); set(TER.x1, Y1, z, PLATE) }

  // ---------------------------------------------------------------- L1
  b.box([L1.x0 + 1, Y1, L1.z0 + 1], [L1.x1 - 1, Y1, L1.z1], FLOOR)
  b.box([L1.x0 + 1, Y1 + 1, L1.z0], [L1.x1, Y2 - 1, L1.z0], 'calcite')
  b.box([L1.x0 - 1, Y1 + 1, L1.z0 - 1], [L1.x0, Y2 + 1, TER.z0 + 2], STONE)
  b.box([L1.x1, Y1 + 1, L1.z0], [L1.x1, Y2 - 1, 26], STONE)
  for (let y = Y1 + 1; y < Y2; y++) {
    for (let x = L1.x0 + 1; x <= L1.x1; x++) set(x, y, L1.z1, (x - L1.x0) % 4 === 0 && x !== L1.x1 ? MULL : GLASS)
    for (let z = 27; z < L1.z1; z++) set(L1.x1, y, z, z === 30 ? MULL : GLASS)
  }
  b.box([L1.x0 + 1, Y2, L1.z0 - 1], [L1.x1 + 1, Y2, L1.z1 + 2], PLATE)

  // ---------------------------------------------------------------- L2
  b.box([L2.x0, Y2, L2.z0], [L2.x1, Y2, L2.z1], PLATE)
  for (let x = L2.x0; x <= L1.x1; x++) for (let z = L2.z0; z < L1.z0 - 1; z++) for (let y = ground(x, z) + 1; y < Y2; y++) set(x, y, z, STONE)
  b.walls([L2.x0, Y2 + 1, L2.z0], [L2.x1, Y3 - 1, L2.z1], WHITE)
  b.box([L2.x0 + 1, Y2 + 1, L2.z0 + 1], [L2.x1 - 1, Y3 - 1, L2.z1 - 1], 'air')
  b.box([L2.x0 - 1, Y3, L2.z0 - 1], [L2.x1 + 1, Y3, L2.z1 + 1], PLATE)
  b.box([L1.x1 + 2, Y2 - 1, L2.z0 + 1], [L2.x1 - 1, Y2 - 1, L2.z1 - 1], SOFFIT)
  b.box([L2.x1, Y2 + 1, L2.z0 + 1], [L2.x1, Y3 - 1, L2.z1 - 1], 'air')
  for (let y = Y2 + 1; y < Y3; y++) for (let z = L2.z0 + 1; z < L2.z1; z++) set(L2.x1 - 3, y, z, (z - L2.z0) % 4 === 0 ? MULL : GLASS)
  for (let z = L2.z0 + 1; z < L2.z1; z++) { set(L2.x1, Y2 + 1, z, RAIL); set(L2.x1 - 1, Y2 + 1, z, BOARD); set(L2.x1 - 2, Y2 + 1, z, BOARD) }
  // south: ribbon window (bedrooms) + full-height glass for the master suite onto the terrace
  const MULL2 = [33, 36, 39, 43, 46, 49, 52]
  for (let x = L2.x0 + 3; x <= 48; x++) for (const y of [Y2 + 2, Y2 + 3]) {
    set(x, y, L2.z1, 'air')
    set(x, y, L2.z1 - 1, MULL2.includes(x) ? MULL : 'gray_stained_glass_pane')
  }
  for (let x = 50; x <= 54; x++) for (let y = Y2 + 1; y < Y3; y++) { set(x, y, L2.z1, 'air'); set(x, y, L2.z1 - 1, x === 52 ? MULL : GLASS) }
  // north: entry niche + clerestory
  b.box([32, Y2 + 1, L2.z0], [35, Y3 - 1, L2.z0], 'air')
  for (let y = Y2 + 1; y < Y3; y++) { set(32, y, L2.z0 + 1, WOOD); set(35, y, L2.z0 + 1, WOOD) }
  for (const x of [33, 34]) for (const y of [Y2 + 3, Y2 + 4 - 1]) set(x, y, L2.z0 + 1, GLASS)
  b.door([33, Y2 + 1, L2.z0 + 1], 'north', { material: 'dark_oak', width: 2 })
  for (let x = 39; x <= 56; x++) set(x, Y3 - 1, L2.z0, x % 6 === 0 ? WHITE : 'gray_stained_glass_pane')
  // west: glass door to the roof garden
  for (let z = 23; z <= 26; z++) for (let y = Y2 + 1; y < Y3 - 1; y++) set(L2.x0, y, z, z === 23 ? MULL : GLASS)

  // ---------------------------------------------------------------- L3
  b.box([L3.x0, Y3, L3.z0], [L3.x1, Y3, L3.z1], PLATE)
  b.walls([L3.x0, Y3 + 1, L3.z0], [L3.x1, YR - 1, L3.z1], WOOD)
  b.box([L3.x0 + 1, Y3 + 1, L3.z0 + 1], [L3.x1 - 1, YR - 1, L3.z1 - 1], 'air')
  for (let y = Y3 + 1; y < YR; y++) {
    for (let x = L3.x0 + 1; x < L3.x1; x++) set(x, y, L3.z1, (x - L3.x0) % 4 === 0 ? MULL : GLASS)
    for (let z = L3.z0 + 1; z < L3.z1; z++) set(L3.x1, y, z, (z - L3.z0) % 4 === 0 ? MULL : GLASS)
  }
  for (let x = 34; x <= 40; x++) for (const y of [Y3 + 2, Y3 + 3]) set(x, y, L3.z0, x === 37 ? MULL : GLASS)
  b.box([L3.x0 - 2, YR, L3.z0 - 2], [L3.x1 + 6, YR, L3.z1 + 2], PLATE)
  b.box([L3.x1 + 5, Y3 + 1, L3.z1 + 1], [L3.x1 + 5, YR - 1, L3.z1 + 1], 'polished_blackstone_wall')

  // ---------------------------------------------------------------- pool
  const PZ = POOL.z1 + 2                                                    // outer face of the shell
  b.box([POOL.x0 - 2, 11, POOL.z0 - 1], [POOL.x1 + 2, Y1 - 1, PZ], 'polished_deepslate')
  b.box([POOL.x0 - 1, 12, POOL.z0 - 1], [POOL.x1 + 1, Y1 - 1, POOL.z1 + 1], 'prismarine_bricks')
  b.box([POOL.x0, 13, POOL.z0], [POOL.x1, Y1, POOL.z1], 'water')
  // the part beyond the cliff is a shallow ledge: floor one higher, no y=11 course -> 3-block face
  for (let x = POOL.x0 - 2; x <= POOL.x1 + 2; x++) for (let z = 42; z <= PZ; z++) {
    b.remove(x, 11, z)
    if (z <= POOL.z1 && x >= POOL.x0 && x <= POOL.x1) set(x, 13, z, 'prismarine_bricks')
  }
  for (let x = POOL.x0 - 2; x <= POOL.x1 + 2; x++) {
    set(x, Y1 - 1, PZ, PLATE)
    if (x >= POOL.x0 - 1 && x <= POOL.x1 + 1) { set(x, Y1, POOL.z1 + 1, 'smooth_quartz_slab[type=bottom,waterlogged=true]'); set(x, Y1, PZ, 'smooth_quartz_slab[type=bottom,waterlogged=true]') }
  }
  for (let x = POOL.x0 - 1; x <= POOL.x1 + 1; x++) set(x, Y1, POOL.z0 - 1, PLATE)
  for (let z = POOL.z0; z <= POOL.z1; z++) { set(POOL.x0 - 1, Y1, z, PLATE); set(POOL.x1 + 1, Y1, z, PLATE) }
  for (const z of [POOL.z1 + 1, PZ]) { set(POOL.x0 - 2, Y1, z, PLATE); set(POOL.x1 + 2, Y1, z, PLATE) }
  for (const x of [28, 33, 38, 43]) set(x, 13, POOL.z0 - 1, 'sea_lantern')          // pool lights in the lining

  // ---------------------------------------------------------------- carport + outdoor stair
  b.box([12, Y3, 4], [29, Y3, 15], PLATE)
  for (const [x, z] of [[12, 4], [12, 15], [20, 4]]) b.box([x, Y2 + 1, z], [x, Y3 - 1, z], 'polished_blackstone_wall')
  for (let x = 14; x <= 16; x++) for (let z = 28; z <= 34; z++) for (let y = Y1 + 1; y <= Y2 + 3; y++) b.remove(x, y, z)
  b.box([13, Y1 + 1, 28], [13, Y2 + 1, 33], STONE)
  b.stairway([14, Y1 + 1, 33], 'north', 5, 'polished_deepslate', { width: 3 })
  for (let x = 14; x <= 16; x++) for (let z = 29; z <= 33; z++) for (let y = ground(x, z) - 2; y < Y1 + 33 - z; y++) set(x, y, z, 'polished_deepslate')

  // cliff stair from the pool deck down to the cove: 9 steps along the rock face, cut into the
  // cliff (rock cleared above the treads), dark parapet on the sea side, then a timber jetty
  b.stairway([3, SEA + 2, 41], 'east', 9, 'polished_deepslate', { width: 2, base: 1 })
  for (let i = 0; i < 9; i++) {
    const x = 3 + i, y = SEA + 2 + i
    for (const z of [40, 41]) for (let yy = y + 1; yy <= Y1 + 3; yy++) if (!inR(TER, x, z)) b.remove(x, yy, z)
    for (let yy = 1; yy <= y + 1; yy++) set(x, yy, 42, 'polished_deepslate')        // parapet, one above the tread
  }
  for (let x = 0; x <= 2; x++) for (const z of [40, 41]) for (let y = SEA + 2; y <= Y1; y++) b.remove(x, y, z)
  for (let z = 43; z <= 54; z++) for (const x of [3, 4]) {
    set(x, SEA + 1, z, 'stripped_spruce_wood')
    if (z % 3 === 0 || z === 54) for (let y = 0; y <= SEA; y++) if (!b.has(x, y, z) || b.nameAt(x, y, z) === 'minecraft:water') set(x, y, z, 'stripped_spruce_log[axis=y]')
  }

  if (at('detail')) {
    // ============================================================== roofs
    // L1 roof: lawn garden west of L2, raised timber deck in front of L2, glass balustrade
    for (let x = L1.x0 + 1; x <= L1.x1 + 1; x++) for (let z = L1.z0 - 1; z <= L1.z1 + 2; z++) {
      if (inR(L2, x, z)) continue
      const edge = z === L1.z1 + 2 || x === L1.x1 + 1
      if (edge) { set(x, Y2 + 1, z, RAIL); continue }
      if (x <= 26 && z <= 30) set(x, Y2 + 1, z, 'grass_block')
      else set(x, Y2 + 1, z, BOARD)
    }
    // L2 roof: green roof (moss carpet keeps the plate 1 thick), timber deck under the top canopy
    for (let x = L2.x0 - 1; x <= L2.x1 + 1; x++) for (let z = L2.z0 - 1; z <= L2.z1 + 1; z++) {
      if (inR(L3, x, z)) continue
      const edge = x === L2.x0 - 1 || x === L2.x1 + 1 || z === L2.z0 - 1 || z === L2.z1 + 1
      if (edge) { set(x, Y3 + 1, z, RAIL); continue }
      set(x, Y3 + 1, z, x >= 45 && x <= 50 ? BOARD : 'moss_carpet')
    }
    // L3 roof: photovoltaic array (daylight detectors) - also hides the ceiling lights
    for (let x = L3.x0 + 1; x <= L3.x1 - 1; x++) for (let z = L3.z0 + 1; z <= L3.z1 - 1; z++) if ((z - L3.z0) % 3 !== 0) set(x, YR + 1, z, 'daylight_detector')

    // ============================================================== L1 interior
    const F1 = Y1 + 1
    // kitchen run on the back wall
    set(19, F1, 23, 'iron_block'); set(19, F1 + 1, 23, 'iron_block'); set(19, F1 + 2, 23, WHITE); set(19, F1 + 3, 23, WHITE)
    for (let y = F1; y <= F1 + 3; y++) set(20, y, 23, WHITE)
    for (let x = 21; x <= 27; x++) set(x, F1, 23, WHITE)
    set(23, F1, 23, 'smoker[facing=south,lit=false]')
    set(23, F1 + 1, 23, 'heavy_weighted_pressure_plate')
    set(25, F1, 23, 'water_cauldron[level=3]')
    set(25, F1 + 1, 23, 'tripwire_hook[facing=south]')
    for (let x = 21; x <= 27; x++) set(x, F1 + 2, 23, 'spruce_slab[type=top]')
    set(22, F1 + 3, 23, 'potted_fern'); set(26, F1 + 3, 23, 'decorated_pot')
    for (const x of [21, 24, 27]) set(x, F1 + 3, L1.z0, LIGHT)              // cove light over the shelf
    // island + stools + pendants
    for (let x = 21; x <= 25; x++) { set(x, F1, 26, 'polished_deepslate'); set(x, F1, 27, 'smooth_quartz_slab[type=top]') }
    for (const x of [21, 23, 25]) { set(x, F1, 28, 'dark_oak_fence'); set(x, F1 + 1, 28, 'dark_oak_pressure_plate') }
    for (const x of [22, 24]) { set(x, F1 + 3, 26, 'chain[axis=y]'); set(x, F1 + 2, 26, 'end_rod[facing=down]') }
    // stair up to L2: floating treads along the back wall (slab opening above)
    for (let i = 0; i < 5; i++) for (const z of [23, 24]) set(29 + i, F1 + i, z, 'polished_deepslate_stairs[facing=east]')
    for (let x = 29; x <= 32; x++) for (const z of [23, 24]) b.remove(x, Y2, z)
    // dining
    for (let x = 30; x <= 34; x++) for (const z of [28, 29]) set(x, F1, z, 'dark_oak_slab[type=top]')
    for (const x of [30, 32, 34]) { set(x, F1, 27, 'smooth_quartz_stairs[facing=north]'); set(x, F1, 30, 'smooth_quartz_stairs[facing=south]') }
    set(29, F1, 28, 'smooth_quartz_stairs[facing=west]'); set(35, F1, 29, 'smooth_quartz_stairs[facing=east]')
    for (const x of [31, 33]) { set(x, F1 + 3, 28, 'chain[axis=y]'); set(x, F1 + 2, 28, 'end_rod[facing=down]') }
    set(32, F1 + 1, 28, 'potted_white_tulip')
    // living: dark stone feature wall with a linear fire and shelves, L-sofa facing it
    for (let x = 38; x <= 48; x++) for (let y = F1; y <= F1 + 3; y++) set(x, y, 23, 'polished_deepslate')
    for (let x = 41; x <= 45; x++) set(x, F1 + 1, 23, 'campfire[lit=true,signal_fire=false,facing=south]')
    for (const x of [38, 39, 47, 48]) for (let y = F1; y <= F1 + 2; y++) set(x, y, 23, 'bookshelf')
    for (let x = 40; x <= 46; x++) set(x, F1, 28, 'gray_wool')
    for (let x = 40; x <= 46; x++) set(x, F1, 27, 'light_gray_carpet')
    // sofa: stairs (seat) with the back to the south, return on the west
    for (let x = 40; x <= 46; x++) { b.remove(x, F1, 27); set(x, F1, 27, 'deepslate_tile_stairs[facing=south]') }
    for (let x = 40; x <= 46; x++) b.remove(x, F1, 28)
    for (const z of [25, 26]) set(39, F1, z, 'deepslate_tile_stairs[facing=west]')
    set(39, F1, 27, 'deepslate_tile_stairs[facing=south]')
    set(47, F1, 27, 'spruce_trapdoor[facing=east,open=true,half=bottom]')
    set(39, F1, 24, 'spruce_trapdoor[facing=north,open=true,half=bottom]')
    for (let x = 41; x <= 45; x++) { set(x, F1, 24, 'white_carpet'); set(x, F1, 26, 'white_carpet') }
    for (let x = 42; x <= 44; x++) set(x, F1, 25, 'dark_oak_slab[type=bottom]')
    set(41, F1, 25, 'white_carpet'); set(45, F1, 25, 'white_carpet')
    set(49, F1, 32, 'potted_flowering_azalea_bush'); set(37, F1, 32, 'potted_bamboo'); set(49, F1, 24, 'potted_fern')
    // lounge chairs at the glass corner
    set(47, F1, 31, 'deepslate_tile_stairs[facing=north]'); set(45, F1, 31, 'deepslate_tile_stairs[facing=north]')
    set(46, F1, 31, 'spruce_slab[type=bottom]')
    // ceiling lights: in the slab under the terrace deck (hidden from above by the boards)
    for (let x = 21; x <= 49; x += 4) set(x, Y2, 30, LIGHT)
    for (let x = 22; x <= 50; x += 6) set(x, Y2, L1.z1 + 1, LIGHT)              // soffit downlights over the terrace

    // ============================================================== L2 interior
    const F2 = Y2 + 1
    // stairwell guard + partitions
    for (let x = 29; x <= 32; x++) { set(x, F2, 22, RAIL); set(x, F2, 25, RAIL) }
    for (const x of [36, 43, 49]) for (let z = 19; z <= 25; z++) for (let y = F2; y < Y3; y++) set(x, y, z, WHITE)
    for (let x = 36; x <= 49; x++) for (let y = F2; y < Y3; y++) if (![38, 39, 45, 46].includes(x) || y > F2 + 1) set(x, y, 19, WHITE)
    // stair to L3 in the hall
    for (let i = 0; i < 5; i++) for (const z of [19, 20]) set(30 + i, F2 + i, z, 'polished_deepslate_stairs[facing=east]')
    for (let x = 31; x <= 33; x++) for (const z of [19, 20]) b.remove(x, Y3, z)
    // bedroom module: double bed (head north), nightstands with lamps, rug, desk at the window
    const bedroom = (x0, x1, col) => {
      const cx = Math.floor((x0 + x1) / 2)
      for (const x of [cx, cx + 1]) set(x, F2, 20, `${col}_bed[facing=north,part=head]`)
      for (const x of [cx - 1, cx + 2]) { set(x, F2, 20, 'spruce_slab[type=top]'); set(x, F2 + 1, 20, 'end_rod[facing=up]') }
      for (let x = cx - 1; x <= cx + 2; x++) set(x, F2, 23, `${col === 'white' ? 'light_gray' : 'white'}_carpet`)
      set(x0, F2, 24, 'spruce_stairs[facing=north]'); set(x0 + 1, F2, 25, 'spruce_slab[type=top]')
      set(x1, F2, 24, 'potted_azalea_bush')
    }
    bedroom(37, 42, 'light_gray'); bedroom(44, 48, 'white')
    // master: bed facing the sea through the framed end, armchairs, a freestanding tub
    for (const z of [21, 22]) set(51, F2, z, 'white_bed[facing=west,part=head]')
    for (const z of [20, 23]) { set(50, F2, z, 'spruce_slab[type=top]'); set(50, F2 + 1, z, 'end_rod[facing=up]') }
    for (let z = 20; z <= 23; z++) set(53, F2, z, 'light_gray_carpet')
    set(54, F2, 18, 'water_cauldron[level=3]'); set(53, F2, 18, 'water_cauldron[level=3]')
    set(56, F2, 19, 'deepslate_tile_stairs[facing=west]'); set(56, F2, 24, 'deepslate_tile_stairs[facing=west]')
    // hall: console + plant, bath behind the stair
    set(29, F2, 17, 'potted_bamboo'); set(36, F2, 17, 'spruce_slab[type=top]'); set(36, F2 + 1, 17, 'potted_white_tulip')
    // ceiling lights in the roof slab (covered above by moss / deck)
    for (const [x, z] of [[33, 24], [40, 24], [46, 24], [52, 24], [53, 17], [47, 17], [40, 17], [56, 21]]) set(x, Y3, z, LIGHT)
    for (const z of [19, 24]) set(54, Y2 - 1, z, LIGHT)                           // downlights in the cantilever soffit

    // ============================================================== L3 interior (sky lounge / study)
    const F3 = Y3 + 1
    for (let x = 31; x <= 34; x++) { set(x, F3, 18, RAIL); set(x, F3, 21, RAIL) }
    for (let z = 14; z <= 17; z++) for (let y = F3; y <= F3 + 2; y++) set(31, y, z, 'bookshelf')
    for (let x = 36; x <= 40; x++) set(x, F3, 14, 'dark_oak_slab[type=top]')
    set(38, F3, 15, 'dark_oak_stairs[facing=south]'); set(37, F3 + 1, 14, 'potted_cactus'); set(39, F3 + 1, 14, 'lectern[facing=south]')
    for (const x of [37, 41]) set(x, F3, 20, 'spruce_stairs[facing=north]')
    set(39, F3, 20, 'spruce_slab[type=bottom]')
    for (let x = 36; x <= 42; x++) for (const z of [18, 19]) set(x, F3, z, 'light_gray_carpet')
    set(43, F3, 14, 'potted_flowering_azalea_bush')
    for (const [x, z] of [[37, 17], [41, 17], [41, 14]]) set(x, YR, z, LIGHT)
    for (const x of [33, 37, 41]) set(x, Y3, L3.z0, LIGHT)                        // entry soffit downlights

    // ============================================================== terraces
    // pool deck: loungers on the east, fire pit lounge on the west
    for (const z of [35, 38]) {
      set(48, F1, z, 'smooth_quartz_stairs[facing=north]'); set(48, F1, z + 1, 'smooth_quartz_slab[type=bottom]')
      set(50, F1, z, 'smooth_quartz_stairs[facing=north]'); set(50, F1, z + 1, 'smooth_quartz_slab[type=bottom]')
    }
    set(19, F1 - 1, 38, 'campfire[lit=true,signal_fire=false]')
    for (const [x, z, f] of [[17, 38, 'west'], [21, 38, 'east'], [19, 36, 'north'], [19, 40, 'south']]) set(x, F1, z, `deepslate_tile_stairs[facing=${f}]`)
    for (const [x, z] of [[18, 37], [20, 37], [18, 39], [20, 39]]) set(x, F1, z, 'polished_deepslate_slab[type=bottom]')
    // L1 roof terrace furniture
    for (let x = 31; x <= 35; x++) set(x, F2 + 1 - 1, 32, 'spruce_stairs[facing=south]')
    // L2 roof: hot tub under the top canopy
    for (let x = 45; x <= 49; x++) for (let z = 23; z <= 27; z++) {
      const rim = x === 45 || x === 49 || z === 23 || z === 27
      set(x, Y3 + 1, z, rim ? PLATE : 'water')
    }
    // balustrades along the deck edges
    for (let x = TER.x0; x <= TER.x1; x++) if (x < POOL.x0 - 2 || x > POOL.x1 + 2) set(x, F1, TER.z1, RAIL)
    for (let z = TER.z0; z <= TER.z1; z++) { set(TER.x1, F1, z, RAIL); if (z > 35 && z < 40) set(TER.x0, F1, z, RAIL) }
  }


  if (at('final')) {
    // ============================================================== landscape (paths -> rocks/trees -> scatter -> props/lights)
    const g = (x, z) => b.topY(x, z, blk => /grass_block|dirt|moss_block|podzol|coarse_dirt|stone|andesite|tuff|sand|gravel|cobblestone|deepslate/.test(blk.name))
    // driveway: dark basalt with gravel shoulders, straight and calm (modern = no wobble)
    for (let x = 0; x <= 27; x++) for (let z = 5; z <= 13; z++) {
      const drive = x >= 12 ? z >= 5 && z <= 14 : z >= 7 && z <= 11
      const shoulder = x < 12 && (z === 6 || z === 12)
      if (drive) set(x, UP, z, 'smooth_basalt')
      else if (shoulder) set(x, UP, z, 'gravel')
    }
    for (let x = 12; x <= 27; x++) set(x, UP, 14, 'smooth_basalt')
    // entry walk: large pavers with grass joints, carport -> door under the L3 overhang
    for (let x = 28; x <= 36; x++) for (const z of [12, 13]) if ((x - 28) % 3 !== 2) set(x, UP, z, 'smooth_stone')
    for (const x of [33, 34]) for (const z of [14, 15]) set(x, UP, z, 'smooth_stone')
    // stepping stones from the carport to the garden stair
    for (let z = 17; z <= 27; z += 2) { set(14, UP, z, 'smooth_stone'); set(15, UP, z, 'smooth_stone') }

    // rocks: half-buried clusters along the cliff foot and on the banks (one big + small ones)
    const rock = kit.palette({ stone: 5, andesite: 3, tuff: 2, cobblestone: 1 }, { scale: 2, seed: 4 })
    // NOTE: boulder's own mossTop paints the top of EVERY column in its bounding box (water too),
    // so moss is added here only on the boulder's own top blocks.
    const boulder = (c, radii, seed) => {
      b.boulder(c, radii, rock, { seed })
      const R = Math.ceil(Math.max(...radii) * 1.3) + 1
      for (let x = Math.floor(c[0] - R); x <= c[0] + R; x++) for (let z = Math.floor(c[2] - R); z <= c[2] + R; z++) {
        const y = b.topY(x, z)
        if (y >= c[1] && /stone|andesite|tuff|cobblestone/.test(b.nameAt(x, y, z) ?? '') && kit.noise.coherent01(x, y, z, { scale: 3, seed }) > 0.5) set(x, y, z, 'moss_block')
      }
    }
    // sea rocks: bare (salt spray, no moss), only at the cliff foot where they break the waterline
    for (const [x, z, r] of [[15, 46, 2.4], [18, 47, 1.4], [51, 45, 2.2], [59, 40, 2.6], [61, 36, 1.5], [59, 24, 2], [60, 12, 2.4], [62, 15, 1.3]])
      b.boulder([x, SEA - 1, z], [r * 1.3, r, r], rock, { seed: x * 7 + z })
    for (const [x, z, r] of [[54, 32, 1.6], [55, 12, 1.8], [8, 31, 1.4], [3, 30, 1.8]]) boulder([x, hAt(x, z), z], [r * 1.3, r * 0.8, r], x + z)

    // trees: a birch grove on the upper lawn, stone-pine (acacia form, spruce foliage) on the
    // ledges, a cherry as the one specimen tree, a small azalea in the roof garden
    const T = (x, z, sp, o = {}) => b.tree([x, g(x, z) + 1, z], sp, o)
    T(6, 18, 'birch', { seed: 1, height: 12 }); T(9, 23, 'birch', { seed: 2, height: 10 }); T(5, 26, 'birch', { seed: 4, height: 9 })
    T(10, 17, 'azalea', { seed: 3 })
    T(56, 9, 'cherry', { seed: 2, height: 8 })
    T(8, 37, 'acacia', { seed: 5, height: 8, log: 'spruce_log', wood: 'spruce_wood', leaves: ['spruce_leaves', 'spruce_leaves', 'oak_leaves'] })
    b.tree([22, Y2 + 2, 25], 'azalea', { seed: 6, height: 6 })
    for (const [x, z] of [[38, 14], [42, 14], [47, 14], [52, 14], [12, 3], [26, 3]]) b.bush([x, UP + 1, z], { radius: 1.3, leaves: ['azalea_leaves', 'flowering_azalea_leaves'], seed: x })
    for (const [x, y, z] of [[20, Y2 + 2, 22], [25, Y2 + 2, 22], [20, Y2 + 2, 29]]) b.bush([x, y, z], { radius: 1.2, leaves: ['azalea_leaves', 'oak_leaves'], seed: z })

    // ground cover: ornamental grasses with a few white/blue drifts; never on paving
    b.scatter({ density: 0.22, clump: 6, seed: 2, paints: [[10, 'short_grass'], [3, 'tall_grass'], [3, 'fern'], [1, 'large_fern']] })
    b.scatter({ x0: 0, z0: 14, x1: 12, z1: 28, density: 0.12, clump: 4, seed: 7, paints: [[2, 'white_tulip'], [1, 'oxeye_daisy'], [1, 'lily_of_the_valley']] })
    b.scatter({ x0: 0, z0: 30, x1: 12, z1: 44, density: 0.1, clump: 4, seed: 8, paints: [[2, 'cornflower'], [1, 'allium']] })
    b.scatter({ x0: 19, z0: 21, x1: 27, z1: 31, density: 0.35, clump: 3, seed: 9, paints: [[4, 'short_grass'], [2, 'fern'], [1, 'allium'], [1, 'white_tulip']] })

    // ============================================================== exterior lights (last: nothing repaints them)
    const bollard = (x, z) => { const y = g(x, z) + 1; set(x, y, z, 'polished_blackstone_wall'); set(x, y + 1, z, 'end_rod[facing=up]') }
    for (const x of [2, 8]) { bollard(x, 6); bollard(x + 3, 12) }
    for (const x of [29, 32, 35]) bollard(x, 11)
    bollard(13, 18); bollard(16, 24)
    for (const [x, z] of [[17, 9], [23, 9]]) set(x, Y3 - 1, z, 'end_rod[facing=down]')     // carport downlights
    set(13, Y1 + 2, 32, LIGHT); set(13, Y1 + 4, 30, LIGHT)                              // stair wall lights (flush)
    for (const [x, z] of [[5, 21], [55, 9]]) { set(x, g(x, z), z, LIGHT); set(x, g(x, z) + 1, z, 'fern') } // tree uplights under ferns
  }

  // tidy: remove isolated strays (tree tips, plant bits) so nothing floats
  for (const [x, y, z] of [...b.entries()]) {
    let alone = true
    for (let dx = -1; dx <= 1 && alone; dx++) for (let dy = -1; dy <= 1 && alone; dy++) for (let dz = -1; dz <= 1 && alone; dz++)
      if ((dx || dy || dz) && b.has(x + dx, y + dy, z + dz)) alone = false
    if (alone && y > 0) b.remove(x, y, z)
  }

  return b.finish({ name: 'modern-villa' })
}
