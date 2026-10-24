// MODERN VILLA — a contemporary cliff house over the sea (example recipe for the kit)
//
// DESIGN
//   Style: contemporary / late-modern coastal villa (think Mediterranean cliff houses, Casa Brutale,
//   Malibu glass houses). Identity = horizontal volumes that slide past each other, thin flat
//   plates, floor-to-ceiling glass, a warm timber accent and an infinity pool that dissolves into
//   the sea. No pitched roofs, no torches, no texture noise on the white planes.
//
//   Massing (three storeys of 5 = 1 slab + 4 clear, the "tray stack"):
//     L1  glass living pavilion  x18..50 z22..33  dug into the hill at the back, all glass to the sea
//     L2  white bedroom bar      x28..58 z16..27  sits on L1 + the hill, CANTILEVERS 8 east over the cliff
//     L3  timber sky-lounge      x30..44 z13..22  set back south, overhangs the entry 3 to the north
//     + pool terrace, carport plate, roof garden, two outdoor stairs, a cove with a jetty.
//   Every volume is offset from the one below on at least two sides: that is what makes the
//   composition read as "interlocking" instead of a stacked wedding cake. The hero is the L2
//   cantilever + the floating infinity pool, both seen from the sea (south-east).
//
//   Palette (roles, L* from block-colors.json):
//     plates / slab edges   smooth_quartz              92   brightest: the horizontal lines
//     wall field (L2)       white_concrete             85   calm, one block per plane (no mixing)
//     feature stone         polished_deepslate+tiles   31/23 base fin, stair walls: dark anchor
//     timber                stripped_spruce_log/wood   40   L3 cladding, soffits, decks (warmth)
//     mullions              polished_blackstone_wall   ~20  thin dark verticals
//     glass                 light_gray / gray stained panes (light for living, darker ribbon)
//     rock                  tuff / andesite / deepslate strata  46-57: the white villa pops
//     accent                cherry pink + azalea, pool turquoise (prismarine lining)
//   Value structure: dark rock base -> white tray edges -> dark glass bands -> white -> wood box ->
//   white lid. Measured: L* mean 60, L* std 25 (modern band 19-27), glass 6 %, 72 ids.
//
// HOW TO READ THIS FILE
//   Stages (STAGE=massing|structure|detail|final env var) follow the handbook workflow; render
//   each one. Sections explain WHY a technique is used; numbers are the ones that survived ~10
//   render-critique iterations (see notes at the bottom).

export default function build(api) {
  const { kit } = api
  const STAGES = ['massing', 'structure', 'detail', 'final']
  const stage = STAGES.indexOf(process.env.STAGE ?? 'final')
  const at = s => stage >= STAGES.indexOf(s)

  const W = 70, H = 45, D = 60
  const b = api.builder([W, H, D], { seed: 5 })
  const SEA = 5                                    // top water block
  const Y1 = 15, Y2 = 20, Y3 = 25, YR = 30         // floor slabs of L1, L2, L3 and the top plate: storey = 5
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
  const n2 = (x, z, s, seed, octaves = 3) => kit.noise.fbm2(x, z, { scale: s, seed, octaves })
  const smin = (a, c, k) => { const h = Math.max(k - Math.abs(a - c), 0) / k; return Math.min(a, c) - h * h * k * 0.25 }
  const hash = (x, y, z, s) => kit.noise.hash01(x, y, z, s)
  const set = (x, y, z, p) => b.set(x, y, z, p)

  // ---------------------------------------------------------------- palette (roles)
  // Modern = vary by PLANE, not by block. Only the stone fin gets a (clumped, scale 4) mix; the
  // white render and the plates are single blocks so they read as crisp cast surfaces.
  const WHITE = 'white_concrete'
  const PLATE = 'smooth_quartz'
  const STONE = kit.palette({ polished_deepslate: 5, deepslate_tiles: 1 }, { scale: 4, seed: 2 })
  const MULL = 'polished_blackstone_wall'          // a wall post between two panes reads ~half a block wide:
                                                   // much thinner than a full black block (tested: 8 black
                                                   // concrete columns looked like prison bars)
  const GLASS = 'light_gray_stained_glass_pane'    // smooth tinted glass; plain glass_pane shows a frame per
                                                   // block and reads as a greenhouse grid
  const RAIL = 'glass_pane'                        // frameless glass balustrades
  const WOOD = 'stripped_spruce_log[axis=y]'       // vertical grain = vertical board cladding
  const SOFFIT = 'stripped_spruce_wood'
  const DECK = 'smooth_stone'                      // pale stone tiles (its top has a frame = large-format tiles)
  const FLOOR = 'stripped_oak_wood'
  const BOARD = 'spruce_slab[type=bottom]'         // raised timber decking on the roofs
  const LIGHT = 'ochre_froglight'                  // warm, flush, no lantern clutter

  // ---------------------------------------------------------------- 1. site
  // A DESIGNED landform, not raw noise: upper plateau (y20, driveway), lower bench (y15, pool
  // terrace), east ledge (y14) joined by 2.5-block ROCK banks. One long smooth grass slope made
  // brown contour stripes (every 1-block grass step shows its dirt side), so height changes are
  // concentrated into short steep banks that get rock paint.
  const UP = 20, LOW = 15, LEDGE = 14
  const coastS = x => 43.2 + 1.8 * n2(x, 0, 6, 5) + (x < 14 ? (14 - x) * 0.5 : 0)
  const coastE = z => 56.8 + 1.5 * n2(0, z, 6, 6)
  // signed distance to the coast (positive = land); two noise octaves push the cliff in and out
  // by 2-3 blocks so the cliff face never reads as one flat retaining wall
  const landD = (x, z) => smin(coastS(x) - z, coastE(z) - x, 6) + 0.9 * n2(x, z, 4, 9) + 0.6 * n2(x, z, 2.5, 19)
  const hLand = (x, z) => {
    let h = UP - (UP - LOW) * smooth((z - 29.5 - 1.6 * n2(x, 0, 7, 1)) / 2.5)    // west bank
    h -= (h - LEDGE) * smooth((x - 49.5 - 1.5 * n2(0, z, 7, 2)) / 2.5)          // east bank
    h -= 6 * smooth((14 - x) / 10) * smooth((z - 40) / 8)                        // falls toward the cove
    return h + 0.35 * n2(x, z, 14, 3)
  }
  const BEACH = (x, z) => smooth((17 - x) / 7) * smooth((z - 38) / 5)            // 0..1: the SW cove
  const raw = (x, z) => {
    const d = landD(x, z)
    const land = hLand(x, z)
    const bch = BEACH(x, z)
    const seabed = SEA - 2.2 - Math.min(2.2, -d * 0.4) + 0.6 * n2(x, z, 7, 4)
    if (d < 0) return seabed
    // cliff: a 3-block profile with noise added to the ramp parameter -> ledges and buttresses.
    // In the cove the cliff foot is pushed 6 blocks inland and a flat sand shelf fills the gap.
    const dc = d - 6 * bch
    const cliff = SEA - 2 + (land - SEA + 2) * smooth(dc / 3 + 0.35 * n2(x, z, 3, 8))
    return bch > 0.15 ? Math.max(SEA + (d > 1.2 ? 1 : 0), cliff) : cliff
  }
  const HM = Array.from({ length: W }, (_, x) => Array.from({ length: D }, (_, z) => Math.round(raw(x, z))))
  const hAt = (x, z) => HM[Math.max(0, Math.min(W - 1, x))][Math.max(0, Math.min(D - 1, z))]
  const slope = (x, z) => Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => Math.abs(hAt(x + dx, z + dz) - hAt(x, z))))
  // Rock: wavy 2.5-block strata of ONE grey family (tuff dominant), darker and wetter at the
  // waterline. A darker volcanic coast was chosen on purpose: a pale limestone cliff merged with
  // the white villa; mid-dark rock makes the white plates pop (value contrast > hue).
  const ROCK = ['tuff', 'tuff', 'andesite', 'tuff', 'deepslate', 'tuff', 'stone', 'tuff', 'deepslate']
  const strata = (x, y, z) => {
    if (y <= SEA + 1 && hash(x, y, z, 3) < 0.6) return hash(x, y, z, 4) < 0.5 ? 'deepslate' : 'tuff'
    const band = Math.floor((y + 3 * n2(x, z, 10, 7, 2)) / 2.5)
    return ROCK[((band % ROCK.length) + ROCK.length) % ROCK.length]
  }
  const grassMix = kit.palette({ grass_block: 30, coarse_dirt: 2, podzol: 1 }, { scale: 5, seed: 3 })
  const surface = (x, y, z) => {
    const s = slope(x, z)
    if (y < SEA) return kit.palette({ sand: 3, gravel: 2, clay: 1 }, { scale: 2, seed: 9 })
    if (BEACH(x, z) > 0.15 && y <= SEA + 1) return kit.palette({ sand: 6, gravel: 1 }, { scale: 2, seed: 10 })
    // banks: rock with moss in coherent CLUMPS (per-block 18 % moss read as green salt-and-pepper)
    if (s >= 2) return kit.noise.coherent01(x, y, z, { scale: 3, seed: 21 }) > 0.72 ? 'moss_block' : strata(x, y, z)
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
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) for (let y = ground(x, z) + 1; y <= SEA; y++) set(x, y, z, 'water')

  // ---------------------------------------------------------------- 2. plan
  const L1 = { x0: 18, x1: 50, z0: 22, z1: 33 }
  const L2 = { x0: 28, x1: 58, z0: 16, z1: 27 }
  const L3 = { x0: 30, x1: 44, z0: 13, z1: 22 }
  const TER = { x0: 12, x1: 52, z0: 34, z1: 41 }       // pool terrace
  const POOL = { x0: 25, x1: 45, z0: 37, z1: 44 }      // water cells; the lip is z1+1..z1+2
  const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

  if (!at('structure')) {
    // MASSING: one wool colour per volume; judge proportions in se/south/top before anything else
    b.box([L1.x0, Y1, L1.z0], [L1.x1, Y2, L1.z1], 'black_wool')
    b.box([L2.x0, Y2, L2.z0], [L2.x1, Y3, L2.z1], 'white_wool')
    b.box([L3.x0, Y3, L3.z0], [L3.x1, YR - 1, L3.z1], 'yellow_wool')
    b.box([L3.x0 - 2, YR, L3.z0 - 2], [L3.x1 + 6, YR, L3.z1 + 2], 'white_wool')
    b.box([TER.x0, Y1, TER.z0], [TER.x1, Y1, TER.z1], 'light_gray_wool')
    b.box([POOL.x0, 12, POOL.z0], [POOL.x1, Y1, POOL.z1 + 2], 'light_blue_wool')
    b.box([12, Y3, 4], [29, Y3, 15], 'white_wool')
    return b.finish({ name: 'modern-villa' })
  }

  // ---------------------------------------------------------------- 3. structure
  // --- foundations. The deck sits on the rock, but its outer row is a 1-thick cantilevered slab
  // and the next row a 3-deep beam: only the core is filled down to the rock. Result: a white deck
  // edge with a shadow under it and the natural cliff below (a full-depth fill was a flat wall).
  for (let x = 11; x <= 53; x++) for (let z = 21; z <= 42; z++) {
    if (!inR(L1, x, z) && !inR(TER, x, z)) continue
    const e = inR(L1, x, z) ? 9 : Math.min(TER.z1 - z, x - TER.x0, TER.x1 - x)
    const bottom = e === 0 ? Y1 : e === 1 ? Y1 - 3 : -1
    for (let y = Math.max(ground(x, z) + 1, bottom); y < Y1; y++) set(x, y, z, strata(x, y, z))
    for (let y = Y1 + 1; y <= Y2 + 3; y++) if (!inR(L1, x, z) || y <= Y2) b.remove(x, y, z)   // cut the hill
    set(x, Y1, z, DECK)
  }
  for (let x = TER.x0; x <= TER.x1; x++) set(x, Y1, TER.z1, PLATE)                // white deck edge
  for (let z = TER.z0; z <= TER.z1; z++) { set(TER.x0, Y1, z, PLATE); set(TER.x1, Y1, z, PLATE) }

  // --- L1: glass living pavilion. Back wall buried in the hill (interior face calcite), a dark
  // stone FIN at the west end (2 thick, runs 3 past the glass, rises 1 above the roof: the anchor),
  // glass to the sea with a mullion every 4 and a frameless glass corner at the east end.
  b.box([L1.x0 + 1, Y1, L1.z0 + 1], [L1.x1 - 1, Y1, L1.z1], FLOOR)
  b.box([L1.x0 + 1, Y1 + 1, L1.z0], [L1.x1, Y2 - 1, L1.z0], 'calcite')
  b.box([L1.x0 - 1, Y1 + 1, L1.z0 - 1], [L1.x0, Y2 + 1, TER.z0 + 2], STONE)
  b.box([L1.x1, Y1 + 1, L1.z0], [L1.x1, Y2 - 1, 26], STONE)
  for (let y = Y1 + 1; y < Y2; y++) {
    for (let x = L1.x0 + 1; x <= L1.x1; x++) set(x, y, L1.z1, (x - L1.x0) % 4 === 0 && x !== L1.x1 ? MULL : GLASS)
    for (let z = 27; z < L1.z1; z++) set(L1.x1, y, z, z === 30 ? MULL : GLASS)
  }
  // L1 roof = L2 floor = upper terrace. It overhangs the glass by 2: the deepest shadow line of the
  // facade and the first of the white horizontal bands.
  b.box([L1.x0 + 1, Y2, L1.z0 - 1], [L1.x1 + 1, Y2, L1.z1 + 2], PLATE)

  // --- L2: white bar. Walls 1 thick, slabs 1 thick (y20, y25), roof plate overhangs 1.
  b.box([L2.x0, Y2, L2.z0], [L2.x1, Y2, L2.z1], PLATE)
  for (let x = L2.x0; x <= L1.x1; x++) for (let z = L2.z0; z < L1.z0 - 1; z++) for (let y = ground(x, z) + 1; y < Y2; y++) set(x, y, z, STONE)
  b.walls([L2.x0, Y2 + 1, L2.z0], [L2.x1, Y3 - 1, L2.z1], WHITE)
  b.box([L2.x0 + 1, Y2 + 1, L2.z0 + 1], [L2.x1 - 1, Y3 - 1, L2.z1 - 1], 'air')
  b.box([L2.x0 - 1, Y3, L2.z0 - 1], [L2.x1 + 1, Y3, L2.z1 + 1], PLATE)
  // the cantilever's underside: a wood soffit RECESSED one block inside the white slab edge, so a
  // shadow gap separates them and the 1-thick white edge still reads as a knife-thin plate
  b.box([L1.x1 + 2, Y2 - 1, L2.z0 + 1], [L2.x1 - 1, Y2 - 1, L2.z1 - 1], SOFFIT)
  // the open end of the bar: glass set back 3 inside the white frame (a "framed tube" loggia)
  b.box([L2.x1, Y2 + 1, L2.z0 + 1], [L2.x1, Y3 - 1, L2.z1 - 1], 'air')
  for (let y = Y2 + 1; y < Y3; y++) for (let z = L2.z0 + 1; z < L2.z1; z++) set(L2.x1 - 3, y, z, (z - L2.z0) % 4 === 0 ? MULL : GLASS)
  for (let z = L2.z0 + 1; z < L2.z1; z++) { set(L2.x1, Y2 + 1, z, RAIL); set(L2.x1 - 1, Y2 + 1, z, BOARD); set(L2.x1 - 2, Y2 + 1, z, BOARD) }
  // south: a 2-high ribbon window recessed 1 (bedrooms keep a white band above and below, so the
  // bar stays a solid white volume), then full-height glass for the master suite onto the terrace
  const MULL2 = [33, 36, 39, 43, 46, 49, 52]                                         // on the partitions
  for (let x = L2.x0 + 3; x <= 48; x++) for (const y of [Y2 + 2, Y2 + 3]) {
    set(x, y, L2.z1, 'air')
    set(x, y, L2.z1 - 1, MULL2.includes(x) ? MULL : 'gray_stained_glass_pane')
  }
  for (let x = 50; x <= 54; x++) for (let y = Y2 + 1; y < Y3; y++) { set(x, y, L2.z1, 'air'); set(x, y, L2.z1 - 1, x === 52 ? MULL : GLASS) }
  // north (street side, private): entry niche, high clerestory ribbon, panel joints, timber panel
  b.box([32, Y2 + 1, L2.z0], [35, Y3 - 1, L2.z0], 'air')
  for (let y = Y2 + 1; y < Y3; y++) { set(32, y, L2.z0 + 1, WOOD); set(35, y, L2.z0 + 1, WOOD) }
  for (const x of [33, 34]) for (const y of [Y2 + 3]) set(x, y, L2.z0 + 1, GLASS)  // transom
  b.door([33, Y2 + 1, L2.z0 + 1], 'north', { material: 'dark_oak', width: 2 })
  for (let x = 39; x <= 56; x++) set(x, Y3 - 1, L2.z0, x % 6 === 0 ? WHITE : 'gray_stained_glass_pane')
  // panel joints: 1-deep vertical shadow gaps under the clerestory mullions break the 30-long wall
  // (inspect flagged > 50 % of wall faces in flat runs > 8 before this)
  for (const x of [42, 48, 54]) for (let y = Y2 + 1; y < Y3 - 1; y++) { b.remove(x, y, L2.z0); set(x, y, L2.z0 + 1, WHITE) }
  // the timber of L3 threads down beside the door: a wood-clad panel marks the entrance
  for (let x = L2.x0 + 1; x <= 38; x++) for (let y = Y2 + 1; y < Y3; y++) if (x < 32 || x > 35) set(x, y, L2.z0, WOOD)
  for (const x of [30, 37]) for (const y of [Y2 + 1, Y2 + 2, Y2 + 3]) set(x, y, L2.z0, 'gray_stained_glass_pane')
  // west: glass doors onto the roof garden
  for (let z = 23; z <= 26; z++) for (let y = Y2 + 1; y < Y3 - 1; y++) set(L2.x0, y, z, z === 23 ? MULL : GLASS)

  // --- L3: timber box, glass to the south and east, a horizontal slot window to the north.
  // Its roof plate is the boldest line of the build: overhang 2, extended 6 east as a canopy over
  // the roof terrace on one slender column.
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

  // --- infinity pool. Water is flush with the deck; the far edge is two WATERLOGGED bottom slabs,
  // so the water surface runs over the lip with no fluid that could spill in game. Beyond the cliff
  // the pool is a shallow ledge: the visible face is 3 high (white lip over a dark body) and the
  // pool reads as a floating tray. (First version: a 5-high black box - heavy and dead.)
  const PZ = POOL.z1 + 2                                                    // outer face of the shell
  b.box([POOL.x0 - 2, 11, POOL.z0 - 1], [POOL.x1 + 2, Y1 - 1, PZ], 'polished_deepslate')
  b.box([POOL.x0 - 1, 12, POOL.z0 - 1], [POOL.x1 + 1, Y1 - 1, POOL.z1 + 1], 'prismarine_bricks')  // teal tile lining
  b.box([POOL.x0, 13, POOL.z0], [POOL.x1, Y1, POOL.z1], 'water')
  for (let x = POOL.x0 - 2; x <= POOL.x1 + 2; x++) for (let z = 42; z <= PZ; z++) {
    b.remove(x, 11, z)
    if (z <= POOL.z1 && x >= POOL.x0 && x <= POOL.x1) set(x, 13, z, 'prismarine_bricks')
  }
  for (let x = POOL.x0 - 2; x <= POOL.x1 + 2; x++) {
    set(x, Y1 - 1, PZ, PLATE)
    if (x >= POOL.x0 - 1 && x <= POOL.x1 + 1) { set(x, Y1, POOL.z1 + 1, 'smooth_quartz_slab[type=bottom,waterlogged=true]'); set(x, Y1, PZ, 'smooth_quartz_slab[type=bottom,waterlogged=true]') }
  }
  for (let x = POOL.x0 - 1; x <= POOL.x1 + 1; x++) set(x, Y1, POOL.z0 - 1, PLATE)               // coping
  for (let z = POOL.z0; z <= POOL.z1; z++) { set(POOL.x0 - 1, Y1, z, PLATE); set(POOL.x1 + 1, Y1, z, PLATE) }
  for (const z of [POOL.z1 + 1, PZ]) { set(POOL.x0 - 2, Y1, z, PLATE); set(POOL.x1 + 2, Y1, z, PLATE) }
  for (const x of [28, 35, 42]) set(x, 12, POOL.z1 + 1, LIGHT)                       // downlights under the floating pool
  for (const x of [28, 33, 38, 43]) set(x, 13, POOL.z0 - 1, 'sea_lantern')          // pool lights in the lining

  // --- carport: one more white plate at roof level of L2, so the horizontal line runs on, on three
  // slender posts (walls read as round steel columns)
  b.box([12, Y3, 4], [29, Y3, 15], PLATE)
  for (const [x, z] of [[12, 4], [12, 15], [20, 4]]) b.box([x, Y2 + 1, z], [x, Y3 - 1, z], 'polished_blackstone_wall')

  // --- garden stair: plateau (y20) down to the pool terrace (y15) between the stone fin and a dark
  // cheek wall that retains the bank; solid dark treads.
  for (let x = 14; x <= 16; x++) for (let z = 28; z <= 34; z++) for (let y = Y1 + 1; y <= Y2 + 3; y++) b.remove(x, y, z)
  b.box([13, Y1 + 1, 28], [13, Y2 + 1, 33], STONE)
  b.stairway([14, Y1 + 1, 33], 'north', 5, 'polished_deepslate', { width: 3 })
  for (let x = 14; x <= 16; x++) for (let z = 29; z <= 33; z++) for (let y = ground(x, z) - 2; y < Y1 + 33 - z; y++) set(x, y, z, 'polished_deepslate')

  // --- cliff stair to the cove: 9 treads along the rock face, CUT into the cliff (rock cleared above,
  // rock left below), a thin stepped rail of wall posts on the sea side. A solid dark parapet here
  // read as a big black triangle; rock under the treads makes the stair look carved, not added.
  b.stairway([3, SEA + 2, 41], 'east', 9, 'polished_deepslate', { width: 2, fill: false })
  for (let i = 0; i < 9; i++) {
    const x = 3 + i, y = SEA + 2 + i
    for (const z of [40, 41]) {
      for (let yy = y + 1; yy <= Y1 + 3; yy++) if (!inR(TER, x, z)) b.remove(x, yy, z)
      for (let yy = 1; yy < y; yy++) set(x, yy, z, strata(x, yy, z))
    }
    for (let yy = 1; yy <= y; yy++) set(x, yy, 42, strata(x, yy, 42))
    set(x, y + 1, 42, 'polished_blackstone_wall')
  }
  for (let x = 0; x <= 2; x++) for (const z of [40, 41]) for (let y = SEA + 2; y <= Y1; y++) b.remove(x, y, z)
  // jetty: plank deck between two horizontal log stringers, posts every 3, mooring posts at the end
  for (let z = 43; z <= 55; z++) {
    set(2, SEA + 1, z, 'stripped_spruce_log[axis=z]'); set(5, SEA + 1, z, 'stripped_spruce_log[axis=z]')
    set(3, SEA + 1, z, 'spruce_planks'); set(4, SEA + 1, z, 'spruce_planks')
    if (z % 3 === 1) for (const x of [2, 5]) for (let y = 0; y <= SEA; y++) set(x, y, z, 'stripped_spruce_log[axis=y]')
  }
  for (const x of [2, 5]) { set(x, SEA + 2, 55, 'stripped_spruce_log[axis=y]'); set(x, SEA + 3, 55, 'spruce_slab[type=bottom]') }

  if (at('detail')) {
    // ============================================================== 4. roofs (the fifth facade)
    // Seen from the hero angle the roofs are half the picture: a sea of white plates looked
    // unfinished. Each roof gets a use: garden, deck, green roof, solar array.
    // L1 roof: lawn garden west of L2, raised timber deck in front of L2, glass balustrade
    for (let x = L1.x0 + 1; x <= L1.x1 + 1; x++) for (let z = L1.z0 - 1; z <= L1.z1 + 2; z++) {
      if (inR(L2, x, z)) continue
      const edge = z === L1.z1 + 2 || x === L1.x1 + 1
      if (edge) { set(x, Y2 + 1, z, RAIL); continue }
      if (x <= 26 && z <= 30) set(x, Y2 + 1, z, 'grass_block')
      else set(x, Y2 + 1, z, BOARD)
    }
    // L2 roof: moss-carpet green roof (keeps the plate visually 1 thick from the side), skylights,
    // a timber deck under the top canopy
    for (let x = L2.x0 - 1; x <= L2.x1 + 1; x++) for (let z = L2.z0 - 1; z <= L2.z1 + 1; z++) {
      if (inR(L3, x, z)) continue
      const edge = x === L2.x0 - 1 || x === L2.x1 + 1 || z === L2.z0 - 1 || z === L2.z1 + 1
      if (edge) { set(x, Y3 + 1, z, RAIL); continue }
      const sky = (x >= 29 && x <= 31 && z >= 24 && z <= 25) || (x >= 38 && x <= 41 && z === 24) || (x >= 51 && x <= 53 && z === 20)
      if (sky) { set(x, Y3, z, 'glass'); continue }
      set(x, Y3 + 1, z, x >= 45 && x <= 50 ? BOARD : 'moss_carpet')
    }
    // L3 roof: photovoltaic array (daylight detectors) - it also hides the ceiling lights below
    for (let x = L3.x0 + 1; x <= L3.x1 - 1; x++) for (let z = L3.z0 + 1; z <= L3.z1 - 1; z++) if ((z - L3.z0) % 3 !== 0) set(x, YR + 1, z, 'daylight_detector')

    // ============================================================== 5. interiors
    // Visible through the glass and in --clip-y cutaways. Furniture is block-built (stairs = seats,
    // top slabs = tables, trapdoors = arms/shades). LIGHTS are hidden: froglights flush in slabs
    // where the floor above is covered (deck boards, rugs, moss, solar panels, walls), so they read
    // as recessed downlights, never as glowing floor tiles.
    const F1 = Y1 + 1
    // kitchen run on the back wall: fridge, tall unit, oven, sink + tap, open shelf with LED strip
    set(19, F1, 23, 'iron_block'); set(19, F1 + 1, 23, 'iron_block'); set(19, F1 + 2, 23, WHITE); set(19, F1 + 3, 23, WHITE)
    for (let y = F1; y <= F1 + 3; y++) set(20, y, 23, WHITE)
    for (let x = 21; x <= 27; x++) set(x, F1, 23, WHITE)
    set(23, F1, 23, 'smoker[facing=south,lit=false]')
    set(23, F1 + 1, 23, 'heavy_weighted_pressure_plate')                               // cooktop
    set(25, F1, 23, 'water_cauldron[level=3]')
    set(25, F1 + 1, 23, 'tripwire_hook[facing=south]')                                 // tap
    for (let x = 21; x <= 27; x++) set(x, F1 + 2, 23, 'spruce_slab[type=top]')
    for (const x of [21, 22, 26, 27]) set(x, F1 + 1, 23, 'end_rod[facing=east]')      // LED strip under the shelf
    set(22, F1 + 3, 23, 'potted_fern'); set(26, F1 + 3, 23, 'decorated_pot')
    for (const x of [21, 24, 27]) set(x, F1 + 3, L1.z0, LIGHT)                          // cove light over the shelf
    // island (dark base, white breakfast bar) + fence stools + slim pendants (chain + end rod)
    for (let x = 21; x <= 25; x++) { set(x, F1, 26, 'polished_deepslate'); set(x, F1, 27, 'smooth_quartz_slab[type=top]') }
    for (const x of [21, 23, 25]) { set(x, F1, 28, 'dark_oak_fence'); set(x, F1 + 1, 28, 'dark_oak_pressure_plate') }
    for (const x of [22, 24]) { set(x, F1 + 3, 26, 'chain[axis=y]'); set(x, F1 + 2, 26, 'end_rod[facing=down]') }
    // stair up to L2: floating treads along the back wall, slab opened above for headroom
    for (let i = 0; i < 5; i++) for (const z of [23, 24]) set(29 + i, F1 + i, z, 'polished_deepslate_stairs[facing=east]')
    for (let x = 29; x <= 32; x++) for (const z of [23, 24]) b.remove(x, Y2, z)
    // dining: dark table, white chairs (stairs facing away from the table), pendants
    for (let x = 30; x <= 34; x++) for (const z of [28, 29]) set(x, F1, z, 'dark_oak_slab[type=top]')
    for (const x of [30, 32, 34]) { set(x, F1, 27, 'smooth_quartz_stairs[facing=north]'); set(x, F1, 30, 'smooth_quartz_stairs[facing=south]') }
    set(29, F1, 28, 'smooth_quartz_stairs[facing=west]'); set(35, F1, 29, 'smooth_quartz_stairs[facing=east]')
    for (const x of [31, 33]) { set(x, F1 + 3, 28, 'chain[axis=y]'); set(x, F1 + 2, 28, 'end_rod[facing=down]') }
    set(32, F1 + 1, 28, 'potted_white_tulip')
    // living: dark stone feature wall with a linear fire (row of campfires) and lit shelf niches,
    // L-sofa (stairs with their backs to the room edge) facing it around a low table on a rug
    for (let x = 38; x <= 48; x++) for (let y = F1; y <= F1 + 3; y++) set(x, y, 23, 'polished_deepslate')
    for (let x = 41; x <= 45; x++) set(x, F1 + 1, 23, 'campfire[lit=true,signal_fire=false,facing=south]')
    for (const x of [38, 39, 47, 48]) { for (let y = F1; y <= F1 + 2; y++) set(x, y, 23, 'bookshelf'); set(x, F1 + 3, 23, LIGHT) }
    for (let x = 40; x <= 46; x++) set(x, F1, 27, 'deepslate_tile_stairs[facing=south]')
    for (const z of [25, 26]) set(39, F1, z, 'deepslate_tile_stairs[facing=west]')
    set(39, F1, 27, 'deepslate_tile_stairs[facing=south]')
    set(47, F1, 27, 'spruce_trapdoor[facing=east,open=true,half=bottom]')              // sofa arms
    set(39, F1, 24, 'spruce_trapdoor[facing=north,open=true,half=bottom]')
    for (let x = 41; x <= 45; x++) { set(x, F1, 24, 'white_carpet'); set(x, F1, 26, 'white_carpet') }
    for (let x = 42; x <= 44; x++) set(x, F1, 25, 'dark_oak_slab[type=bottom]')
    set(41, F1, 25, 'white_carpet'); set(45, F1, 25, 'white_carpet')
    set(49, F1, 32, 'potted_flowering_azalea_bush'); set(37, F1, 32, 'potted_bamboo'); set(49, F1, 24, 'potted_fern')
    // two lounge chairs at the glass corner, facing the view
    set(47, F1, 31, 'deepslate_tile_stairs[facing=north]'); set(45, F1, 31, 'deepslate_tile_stairs[facing=north]')
    set(46, F1, 31, 'spruce_slab[type=bottom]')
    // shade lamps (fence stem + froglight head wrapped in open trapdoors): visible warm points at night
    const lamp = (x, y, z, h = 1) => {
      for (let i = 0; i < h; i++) set(x, y + i, z, 'dark_oak_fence')
      set(x, y + h, z, LIGHT)
      for (const [dx, dz, f] of [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']]) if (!b.has(x + dx, y + h, z + dz)) set(x + dx, y + h, z + dz, `birch_trapdoor[facing=${f},open=true,half=bottom]`)
    }
    lamp(48, F1, 27); lamp(43, F1, 31); lamp(20, F1, 31)
    // ceiling lights: in the slab under the upper deck boards (hidden from above), one row 4 apart,
    // plus soffit downlights in the overhang over the terrace
    for (let x = 21; x <= 49; x += 4) set(x, Y2, 30, LIGHT)
    for (const x of [20, 28, 36, 44]) set(x, Y2, L1.z1 + 1, LIGHT)                // (kept clear of the planter cells above)

    // --- L2: corridor along the north, three rooms to the south between white partitions
    const F2 = Y2 + 1
    for (let x = 29; x <= 32; x++) { set(x, F2, 22, RAIL); set(x, F2, 25, RAIL) }    // stairwell guard
    for (const x of [36, 43, 49]) for (let z = 19; z <= 25; z++) for (let y = F2; y < Y3; y++) set(x, y, z, WHITE)
    for (let x = 36; x <= 49; x++) for (let y = F2; y < Y3; y++) if (![38, 39, 45, 46].includes(x) || y > F2 + 1) set(x, y, 19, WHITE)
    // stair to L3 in the hall
    for (let i = 0; i < 5; i++) for (const z of [19, 20]) set(30 + i, F2 + i, z, 'polished_deepslate_stairs[facing=east]')
    for (let x = 31; x <= 33; x++) for (const z of [19, 20]) b.remove(x, Y3, z)
    // bedroom module: double bed (head north) with a backlit headboard, nightstands with lamps,
    // rug (which also hides a light for the room below), desk + chair + lamp at the ribbon window
    const bedroom = (x0, x1, col) => {
      const cx = Math.floor((x0 + x1) / 2)
      for (const x of [cx, cx + 1]) { set(x, F2, 20, `${col}_bed[facing=north,part=head]`); set(x, F2 + 1, 19, LIGHT) }
      for (const x of [cx - 1, cx + 2]) { set(x, F2, 20, 'spruce_slab[type=top]'); set(x, F2 + 1, 20, 'end_rod[facing=up]') }
      for (let x = cx - 1; x <= cx + 2; x++) for (const z of [23, 24]) set(x, F2, z, `${col === 'white' ? 'light_gray' : 'white'}_carpet`)
      set(cx, Y2, 24, LIGHT)
      set(x0, F2, 24, 'spruce_stairs[facing=north]'); set(x0 + 1, F2, 25, 'spruce_slab[type=top]'); set(x0 + 1, F2 + 1, 25, 'end_rod[facing=up]')
      set(x1, F2, 24, 'potted_azalea_bush')
    }
    bedroom(37, 42, 'light_gray'); bedroom(44, 48, 'white')
    // master: bed facing the sea through the framed end, dresser, two chairs in the loggia
    for (const z of [21, 22]) { set(51, F2, z, 'white_bed[facing=west,part=head]'); set(49, F2 + 1, z, LIGHT) }
    for (const z of [20, 23]) { set(50, F2, z, 'spruce_slab[type=top]'); set(50, F2 + 1, z, 'end_rod[facing=up]') }
    for (let z = 20; z <= 23; z++) set(53, F2, z, 'light_gray_carpet')
    for (let x = 51; x <= 53; x++) set(x, F2, 17, 'spruce_slab[type=top]')
    set(51, F2 + 1, 17, 'potted_white_tulip'); set(53, F2 + 1, 17, 'end_rod[facing=up]')
    set(56, F2, 19, 'deepslate_tile_stairs[facing=west]'); set(56, F2, 24, 'deepslate_tile_stairs[facing=west]')
    set(29, F2, 17, 'potted_bamboo'); set(36, F2, 17, 'spruce_slab[type=top]'); set(36, F2 + 1, 17, 'potted_white_tulip')
    // ceiling lights in the roof slab (covered above by moss / deck / the L3 rug)
    for (const [x, z] of [[33, 24], [40, 23], [46, 24], [52, 24], [53, 17], [47, 17], [40, 18], [56, 22]]) set(x, Y3, z, LIGHT)
    for (const z of [19, 24]) set(54, Y2 - 1, z, LIGHT)                           // downlights in the cantilever soffit

    // --- L3: sky lounge / study - library wall, desk at the slot window, two chairs facing the view
    const F3 = Y3 + 1
    for (let x = 31; x <= 34; x++) { set(x, F3, 18, RAIL); set(x, F3, 21, RAIL) }
    for (let z = 14; z <= 17; z++) { for (let y = F3; y <= F3 + 2; y++) set(31, y, z, 'bookshelf'); set(31, F3 + 3, z, z % 2 ? LIGHT : 'bookshelf') }
    for (let x = 36; x <= 40; x++) set(x, F3, 14, 'dark_oak_slab[type=top]')
    set(38, F3, 15, 'dark_oak_stairs[facing=south]'); set(37, F3 + 1, 14, 'potted_cactus'); set(39, F3 + 1, 14, 'lectern[facing=south]')
    for (const x of [37, 41]) set(x, F3, 20, 'spruce_stairs[facing=north]')
    set(39, F3, 20, 'spruce_slab[type=bottom]')
    for (let x = 36; x <= 42; x++) for (const z of [18, 19]) set(x, F3, z, 'light_gray_carpet')
    set(43, F3, 14, 'potted_flowering_azalea_bush'); set(36, F3 + 1, 14, 'end_rod[facing=up]')
    lamp(43, F3, 19)
    for (const [x, z] of [[37, 17], [41, 17], [41, 14]]) set(x, YR, z, LIGHT)
    for (const x of [33, 37, 41]) set(x, Y3, L3.z0, LIGHT)        // entry soffit downlights (the L3 wall above hides them)

    // ============================================================== 6. terraces (outdoor rooms)
    // pool deck: loungers on the east, a sunken fire-pit lounge on the west
    for (const z of [35, 38]) {
      set(48, F1, z, 'smooth_quartz_stairs[facing=north]'); set(48, F1, z + 1, 'smooth_quartz_slab[type=bottom]')
      set(50, F1, z, 'smooth_quartz_stairs[facing=north]'); set(50, F1, z + 1, 'smooth_quartz_slab[type=bottom]')
    }
    set(19, F1 - 1, 38, 'campfire[lit=true,signal_fire=false]')
    for (const [x, z, f] of [[17, 38, 'west'], [21, 38, 'east'], [19, 36, 'north'], [19, 40, 'south']]) set(x, F1, z, `deepslate_tile_stairs[facing=${f}]`)
    for (const [x, z] of [[18, 37], [20, 37], [18, 39], [20, 39]]) set(x, F1, z, 'polished_deepslate_slab[type=bottom]')
    // L1 roof terrace: furniture REPLACES the deck board in its cell (a block on a bottom slab
    // floats half a block above the boards)
    for (let x = 31; x <= 35; x++) set(x, F2, 31, 'smooth_quartz_stairs[facing=north]')   // outdoor sofa facing the sea
    for (let x = 32; x <= 34; x++) set(x, F2, 33, 'dark_oak_slab[type=top]')
    set(30, F2, 33, 'smooth_quartz_stairs[facing=west]'); set(36, F2, 33, 'smooth_quartz_stairs[facing=east]')
    const planter = (x0, z) => {                    // timber planter box: plank curb, rooted dirt, clipped azalea
      for (let x = x0 - 1; x <= x0 + 3; x++) for (let dz = -1; dz <= 1; dz++) set(x, F2, z + dz, 'spruce_planks')
      for (let x = x0; x < x0 + 3; x++) { set(x, F2, z, 'rooted_dirt'); set(x, F2 + 1, z, `${x % 2 ? 'flowering_azalea_leaves' : 'azalea_leaves'}[persistent=true]`) }
    }
    // (an open-trapdoor rim was tried first: a trapdoor fills 3 px of its cell, so the white slab
    // under the removed deck board showed through as white squares)
    planter(40, 33); planter(46, 33); planter(23, 33)
    for (let x = 13; x <= 28; x++) for (let z = 5; z <= 14; z++) set(x, Y3 + 1, z, 'moss_carpet')   // carport green roof
    // L2 roof: hot tub under the top canopy
    for (let x = 45; x <= 49; x++) for (let z = 23; z <= 27; z++) {
      const rim = x === 45 || x === 49 || z === 23 || z === 27
      set(x, Y3 + 1, z, rim ? PLATE : 'water')
    }
    // glass balustrades along the pool-deck edges (gap at the top of the cliff stair)
    for (let x = TER.x0; x <= TER.x1; x++) if (x < POOL.x0 - 2 || x > POOL.x1 + 2) set(x, F1, TER.z1, RAIL)
    for (let z = TER.z0; z <= TER.z1; z++) { set(TER.x1, F1, z, RAIL); if (z > 35 && z < 40) set(TER.x0, F1, z, RAIL) }
  }

  if (at('final')) {
    // ============================================================== 7. landscape
    // Order matters: paving -> rocks -> trees -> scatter -> lights/props (scatter and paths repaint
    // the top block of a column, so anything placed before them can be overwritten).
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
    for (let z = 17; z <= 27; z += 2) { set(14, UP, z, 'smooth_stone'); set(15, UP, z, 'smooth_stone') }   // stepping stones to the stair

    // rocks: land boulders get moss on their own top blocks only (b.boulder's mossTop also mosses
    // water and terrain in its bounding square - see notes); sea rocks stay bare (salt spray)
    const rock = kit.palette({ stone: 5, andesite: 3, tuff: 2, cobblestone: 1 }, { scale: 2, seed: 4 })
    const boulder = (c, radii, seed) => {
      b.boulder(c, radii, rock, { seed })
      const R = Math.ceil(Math.max(...radii) * 1.3) + 1
      for (let x = Math.floor(c[0] - R); x <= c[0] + R; x++) for (let z = Math.floor(c[2] - R); z <= c[2] + R; z++) {
        const y = b.topY(x, z)
        if (y >= c[1] && /stone|andesite|tuff|cobblestone/.test(b.nameAt(x, y, z) ?? '') && kit.noise.coherent01(x, y, z, { scale: 3, seed }) > 0.5) set(x, y, z, 'moss_block')
      }
    }
    const seaRock = kit.palette({ tuff: 4, deepslate: 2, andesite: 1 }, { scale: 2, seed: 6 })
    for (const [x, z, r] of [[16, 46, 2.2], [19, 47, 1.3], [51, 45, 2.2], [59, 40, 2.6], [61, 36, 1.5], [59, 24, 2], [60, 12, 2.4], [62, 15, 1.3]])
      b.boulder([x, SEA - 1, z], [r * 1.3, r, r], seaRock, { seed: x * 7 + z })
    for (const [x, z, r] of [[54, 32, 1.6], [55, 12, 1.8], [8, 31, 1.4], [3, 30, 1.8]]) boulder([x, hAt(x, z), z], [r * 1.3, r * 0.8, r], x + z)

    // trees, sparse and in three sizes: a birch grove behind (white trunks echo the house), one
    // cherry as the specimen tree on the east ledge (pink accent beside the cantilever), azaleas
    // on the lower lawn and in the roof garden, flowering azalea bushes along the entry wall
    const T = (x, z, sp, o = {}) => b.tree([x, g(x, z) + 1, z], sp, o)
    T(6, 18, 'birch', { seed: 1, height: 12 }); T(9, 23, 'birch', { seed: 2, height: 10 }); T(5, 26, 'birch', { seed: 4, height: 9 })
    T(10, 17, 'azalea', { seed: 3 })
    T(52, 7, 'cherry', { seed: 2, height: 8 })
    T(7, 36, 'azalea', { seed: 5, height: 7 })
    b.tree([22, Y2 + 2, 25], 'azalea', { seed: 6, height: 6 })
    for (const [x, z] of [[38, 14], [42, 14], [47, 14], [52, 14], [12, 3], [26, 3]]) b.bush([x, UP + 1, z], { radius: 1.3, leaves: ['azalea_leaves', 'flowering_azalea_leaves'], seed: x })
    for (const [x, y, z] of [[20, Y2 + 2, 22], [25, Y2 + 2, 22], [20, Y2 + 2, 29]]) b.bush([x, y, z], { radius: 1.2, leaves: ['azalea_leaves', 'oak_leaves'], seed: z })

    // ground cover: ornamental grasses + a few single-species drifts; paving is not grass so it stays clear
    b.scatter({ density: 0.22, clump: 6, seed: 2, paints: [[10, 'short_grass'], [3, 'tall_grass'], [3, 'fern'], [1, 'large_fern']] })
    b.scatter({ x0: 0, z0: 14, x1: 12, z1: 28, density: 0.12, clump: 4, seed: 7, paints: [[2, 'white_tulip'], [1, 'oxeye_daisy'], [1, 'lily_of_the_valley']] })
    b.scatter({ x0: 0, z0: 30, x1: 12, z1: 44, density: 0.1, clump: 4, seed: 8, paints: [[2, 'cornflower'], [1, 'allium']] })
    b.scatter({ x0: 19, z0: 21, x1: 27, z1: 31, density: 0.35, clump: 3, seed: 9, paints: [[4, 'short_grass'], [2, 'fern'], [1, 'allium'], [1, 'white_tulip']] })

    // ============================================================== 8. exterior lights (last)
    // slim bollards (wall post + end rod) every ~6 along driveway and walk, downlights under the
    // carport, flush wall lights in the stair cheek, hidden uplights at two trees
    const bollard = (x, z) => { const y = g(x, z) + 1; set(x, y, z, 'polished_blackstone_wall'); set(x, y + 1, z, 'end_rod[facing=up]') }
    for (const x of [2, 8]) { bollard(x, 6); bollard(x + 3, 12) }
    for (const x of [29, 32, 35]) bollard(x, 11)
    bollard(13, 18); bollard(16, 24)
    for (const [x, z] of [[17, 9], [23, 9]]) set(x, Y3 - 1, z, 'end_rod[facing=down]')
    set(13, Y1 + 2, 32, LIGHT); set(13, Y1 + 4, 30, LIGHT)
    // tree uplights: froglight flush in the ground under a moss carpet (carpet passes light and is
    // valid on any block; a fern or grass on top of a light block would pop off in game)
    for (const [x, z] of [[5, 21], [50, 7]]) { const y = g(x, z); set(x, y, z, LIGHT); set(x, y + 1, z, 'moss_carpet'); b.remove(x, y + 2, z) }
  }

  // ---------------------------------------------------------------- 9. tidy
  // plants must stand on soil (the cherry's petal scatter and scatter on rock edges can miss)
  for (const [x, y, z, blk] of [...b.entries()]) {
    if (!/pink_petals|_grass$|fern$|tulip|daisy|cornflower|allium|lily_of_the_valley/.test(blk.name) || /grass_block/.test(blk.name)) continue
    const below = b.nameAt(x, y - 1, z) ?? ''
    if (!/grass_block|dirt|podzol|moss_block|rooted_dirt|mud|_grass$|fern$/.test(below)) { b.remove(x, y, z); if (/tall_grass|large_fern/.test(blk.name)) b.remove(x, y + 1, z) }
  }
  // remove isolated strays (tree tips, plant bits) so nothing floats
  for (const [x, y, z] of [...b.entries()]) {
    let alone = true
    for (let dx = -1; dx <= 1 && alone; dx++) for (let dy = -1; dy <= 1 && alone; dy++) for (let dz = -1; dz <= 1 && alone; dz++)
      if ((dx || dy || dz) && b.has(x + dx, y + dy, z + dz)) alone = false
    if (alone && y > 0) b.remove(x, y, z)
  }

  return b.finish({ name: 'modern-villa', description: 'Contemporary cliff villa: three interlocking volumes, 8-block cantilever, infinity pool, furnished interiors, cove with jetty' })
}

// NOTES FROM THE ITERATIONS (what the renders taught)
// - Massing: L2 offset on two sides from L1 and L3 offset on two sides from L2 is what reads as
//   "interlocking". The carport plate at the same height as L2's roof extends the main horizontal.
// - A smooth heightmap slope makes grass contour stripes; short rock banks between flat benches don't.
// - The cliff face needs 2-3 blocks of in/out noise and a noisy profile; a straight coast reads as a wall.
// - Thin mullions: polished_blackstone_wall between panes (~half the visual weight of black_concrete).
// - Modern night glow in this renderer is subtle (each surface takes only its strongest light,
//   about +50 % warm). Hidden ceiling lights warm the floors; VISIBLE emissives behind the glass
//   (lamp heads, lit shelf niches, backlit headboards, the fire slot) are what read as "lit rooms".
// - Furniture on bottom-slab decks must replace the slab, not sit on it (half-block float).
