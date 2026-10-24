// NORDIC LONGHOUSE — a Viking chieftain's hall and its settlement on a fjord shore.
//
// DESIGN BRIEF
//   What: one long hall (the hero), a boathouse (naust), a smokehouse with fish racks, a storehouse
//   on stilts (stabbur), a stake palisade with a gate, a pier with a moored longship, a small field.
//   Where: a shore terrace between a pale rocky headland (west), pine-covered slopes (north, east)
//   and the fjord (south). Story hook: the ship is in, the fires are lit, the fish is drying.
//   Scale tier: cottage 1:1 — doors 1x2, 1x1 windows, 4-block walls; the hall reads big through
//   its length (39) and roof, not through inflated details.
//   References: Trelleborg/Fyrkat halls (bowed "boat-shaped" walls, external raking posts),
//   Borg/Lofotr (dark tarred timber, huge roof), Gokstad/Oseberg ships (clinker hull, dragon stem),
//   Norwegian naust and stabbur, hogback stones (a ridge that bends along its length).
//
// SILHOUETTE AND PROPORTIONS (the things that make it read as "longhouse" at any distance)
//   - Low walls: 1 stone course + 3 log courses (4 high); eaves only 5 above the floor.
//   - Roof = ~72% of the hall's height. It rises 10 blocks at mid-length and 12.5 at the gables:
//     the ridge SAGS in the middle (hogback), and the long walls BOW out (width 11 at the gables,
//     13 and 15 toward the middle). Both curves come from one height field (section 2b).
//   - Bell-cast profile: rises ~1 per row near the eave, ~2.5 per row near the ridge.
//   - Crossed horns over both gables and a smoke louver on the ridge break the skyline; a cross-
//     gabled porch breaks the long south eave (law: break every long roofline 2-3 times).
//
// PALETTE (roles, L* lightness; value steps between roles >= 15-20)
//   roof      dark_oak shingles 20, bleached to spruce 38 near the ridge, moss_block 43 in damp spots
//   walls     stripped_spruce_log 40 (horizontal courses), stripped_dark_oak_log 25 in the damp base
//   frame     dark_oak_log 20: external posts, corners, door frames, horns
//   footing   cobblestone 53 / mossy_cobblestone 48 / cobbled_deepslate 33 (textured ramp)
//   gables    stripped_spruce_log[axis=y] 40 — vertical boards against horizontal walls
//   ground    grass 43, podzol/coarse dirt 40, gravel/andesite shingle 54-57, rock strata 46-57
//   accent    red_wool 36 + white_wool 93 (sail), mangrove 29 / birch 67 trapdoor shields; one hue
//   light     lanterns, campfire braziers; the hall gets the densest cluster
//
// TECHNIQUES WORTH STEALING
//   - A curved roof is a height field T(x, z) rasterised into slabs/stairs/blocks (section 2b),
//     not a kit roof: the kit roof is rectangular and cannot bend its ridge.
//   - Every shingle course casts a shadow line: the lowest exposed riser block is an upside-down
//     stair whose open half faces down-slope.
//   - The cross gable is built on a scratch module and merged only where it rises above the main
//     roof, so it dives cleanly into the main slope.
//   - The ship is authored along +z and stamped rotated; stamp() turns every block state with it.
//   - Logs cannot go through b.texture (it maps a log to its family's planks), so the log walls
//     get a hand-written paint with the same logic: darker and damper toward the base.
//   - Terrain: designed heightmap + blur, materials by slope and distance to the shore, then an
//     "edge planting" pass that hides the dirt risers of 1-block steps behind tall plants.
//
// RENDER CHECKLIST: se/nw/south/top sheet, hero, low; close-ups of the porch, a gable, the ship's
// dragon head; --clip cutaway of the hall; --lighting night.

const SIZE = [88, 46, 72]
const WATER = 6 // top water block of the fjord

export default function build(api) {
  const { kit } = api
  const b = api.builder(SIZE, { seed: 7 })
  const [W, , D] = SIZE

  // ---------------------------------------------------------------- helpers
  const n2 = (x, z, scale, seed, octaves = 3) => kit.noise.fbm2(x, z, { scale, seed, octaves })
  const hash = (x, y, z, s = 0) => kit.hash01(x, y, z, s)
  const clamp = (v, a, c) => Math.max(a, Math.min(c, v))
  const smooth = t => t * t * (3 - 2 * t)
  const rng = kit.rng(7)
  const pal = (entries, seed, scale = 3) => kit.palette(entries, { scale, seed })
  const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  // Face-connected (4-connected) line of cells between two points: palisades and weirs drawn
  // with it are closed walls, never diagonal-only chains.
  const lineCells = ([ax, az], [cx, cz]) => {
    const out = [[ax, az]]
    let x = ax, z = az
    const dx = cx - ax, dz = cz - az
    while (x !== cx || z !== cz) {
      const cand = []
      if (x !== cx) cand.push([x + Math.sign(dx), z])
      if (z !== cz) cand.push([x, z + Math.sign(dz)])
      const dist = ([px, pz]) => Math.abs((px - ax) * dz - (pz - az) * dx)
      cand.sort((p, q) => dist(p) - dist(q))
      ;[x, z] = cand[0]
      out.push([x, z])
    }
    return out
  }
  // Lantern at y on a chain from whatever solid block is above (eave, beam, roof underside).
  const hang = (x, y, z) => {
    let top = y + 1
    while (top < y + 12 && !b.has(x, top, z)) top += 1
    if (top >= y + 12) return
    for (let k = y + 1; k < top; k += 1) b.set(x, k, z, 'chain[axis=y]')
    b.set(x, y, z, 'lantern[hanging=true]')
  }

  // ================================================================ 0 PLAN
  // Everything is placed from these few numbers, so the layout can be tuned in one place.
  const X0 = 24, X1 = 62, CX = 43, CZ = 27, HL = (X1 - X0) / 2 // hall: gable wall lines and centre
  const F = 11 // hall floor level (first air row above the floor)
  const N = { x0: 14, x1: 22, z0: 41, z1: 55 } // naust at the foot of the headland, open to the water
  const PIER = { x0: 35, x1: 37, z0: 42, z1: 60 } // pier from the beach out to the ship
  const SHIP = { x: 47, z: 64 } // longship: stern end x and centreline z (it lies along x, bow west)
  const SMOKE = { x0: 71, x1: 77, z0: 32, z1: 38 } // smokehouse
  const STAB = { x0: 66, x1: 71, z0: 11, z1: 16 } // stabbur (storehouse on stilts)
  const PALISADE = [[11, 12], [18, 8], [30, 6], [44, 5], [58, 6], [70, 7], [78, 11], [82, 19], [82, 31], [81, 39], [80, 46]]
  const GATE = { x: 82, z0: 24, z1: 26 } // east gate in the palisade, on the road to the hall's gable door

  // ================================================================ 1 SITE
  // Heightmap designed in layers: beach rising to a terrace, a slope rising north, a headland
  // cliff on the west, and a soft-edged ellipse pulling the ground under the hall to F - 1
  // (a terrace that blends out, not a bulldozed pad). Blurred twice except on the cliff.
  const shoreZ = x => 51 + 1.8 * Math.sin(x * 0.09 + 0.6) + 1.4 * n2(x, 3, 10, 5) - 3 * Math.exp(-(((x - 36) / 8) ** 2)) // small cove at the pier
  const cliffX = z => 12 + 2 * n2(2, z, 9, 9) + (z > 44 ? (z - 44) * 0.14 : 0)
  const raw = (x, z) => {
    const inland = shoreZ(x) - z
    let h
    if (inland >= 0) {
      h = 7.2 + Math.min(inland, 8) * 0.42 + 0.5 * n2(x, z, 12, 1)
      const back = clamp((16 - z) / 16, 0, 1)
      h += back * back * 9 + 2.2 * n2(x, z, 16, 2) * back
      h += Math.max(0, x - 79) * 0.45
    } else {
      h = Math.max(0.5, WATER - 0.5 + inland * 0.7 + 0.6 * n2(x, z, 8, 3)) // sea bed shelving away
    }
    // the headland: a fjord wall rising toward the north-west corner, ridged on top
    const cx = cliffX(z)
    if (x < cx + 3) {
      const t = smooth(clamp((cx + 3 - x) / 3.5, 0, 1))
      const crest = 3.5 * kit.noise.ridged2(x, z, { scale: 14, seed: 4 })
      const top = Math.min(33, 19 + (46 - Math.min(z, 46)) * 0.24 + (cx - x) * 0.45 + crest + 1.2 * n2(x, z, 6, 4))
      const tip = smooth(clamp((66 + 3 * n2(x, 0, 6, 6) - z) / 4, 0, 1))
      h += (top - h) * t * tip
    }
    const e = Math.hypot((x - CX) / (HL + 7), (z - CZ) / 13)
    if (e < 1.3) h += (F - 1.3 - h) * smooth(clamp((1.3 - e) / 0.4, 0, 1))
    return h
  }
  const hm = Array.from({ length: W }, (_, x) => Array.from({ length: D }, (_, z) => raw(x, z)))
  const blur = src => src.map((col, x) => col.map((h, z) => {
    if (x < cliffX(z) + 1) return h // keep the cliff face crisp
    let s = 0, n = 0
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
      const c = src[x + dx]?.[z + dz]
      if (c !== undefined) { s += c; n += 1 }
    }
    return s / n
  }))
  const sm = blur(blur(hm))
  const height = (x, z) => Math.round(sm[clamp(x, 0, W - 1)][clamp(z, 0, D - 1)])
  const slope = (x, z) => Math.max(...DIR4.map(([dx, dz]) => Math.abs(height(x + dx, z + dz) - height(x, z))))

  // Rock: wavy 2-block strata of one grey family (stone/andesite/tuff/cobble read as one rock),
  // with a darker, mossy splash zone just above the water line.
  const STRATA = ['stone', 'andesite', 'stone', 'tuff', 'andesite', 'cobblestone', 'stone', 'tuff']
  const strata = (x, y, z) => {
    if (y <= WATER + 1 + Math.round(1.5 * n2(x, z, 5, 8))) return pal({ tuff: 3, cobbled_deepslate: 2, mossy_cobblestone: 2 }, 16, 2)
    const band = Math.floor((y + 2.5 * n2(x, z, 9, 7, 2)) / 2)
    return STRATA[((band % 8) + 8) % 8]
  }
  // Shore gradient from the water up: bed of gravel/clay, wet shingle, a gravel-and-coarse-dirt
  // strand, then turf. Distance to the (noisy) shoreline picks the band; clumped palettes blur seams.
  const SHINGLE = pal({ gravel: 5, andesite: 2, cobblestone: 1, stone: 1 }, 11, 2.5)
  const STRAND = pal({ gravel: 3, coarse_dirt: 3, grass_block: 2, andesite: 1 }, 17, 2.5)
  const BED = pal({ gravel: 4, sand: 1, clay: 1, mud: 1 }, 12, 2.5)
  const TURF = pal({ grass_block: 30, coarse_dirt: 2, podzol: 2 }, 13, 6)
  const FOREST_FLOOR = pal({ podzol: 6, grass_block: 4, coarse_dirt: 2, moss_block: 1 }, 14, 4)
  const surface = (x, y, z) => {
    const s = slope(x, z)
    if (s >= 3) return strata(x, y, z)
    if (y < WATER) return BED
    const inland = shoreZ(x) - z + 1.2 * n2(x, z, 4, 18)
    if (y <= WATER + 1 || inland < 2) return SHINGLE
    if (inland < 4.5 && x > cliffX(z) + 2) return STRAND
    if (s === 2) return pal({ stone: 3, andesite: 2, coarse_dirt: 2, grass_block: 2 }, 15, 2)
    if (z < 9 || x > 81 || x < cliffX(z)) return FOREST_FLOOR
    return TURF
  }
  const ground = b.terrain({
    height,
    layers: [{ depth: 1, paint: surface }, { depth: 3, paint: (x, y, z) => (slope(x, z) >= 3 ? strata(x, y, z) : 'dirt') }, { paint: strata }],
  })
  for (let x = 0; x < W; x += 1) for (let z = 0; z < D; z += 1) {
    const g = ground(x, z)
    for (let y = g + 1; y <= WATER; y += 1) b.set(x, y, z, 'water')
    // sea-floor life in clumps (it shows through the water and breaks up the flat blue)
    const depth = WATER - g
    const c = kit.noise.coherent01(x, 0, z, { scale: 5, seed: 19 })
    if (depth >= 4 && c > 0.78) {
      const k = 1 + Math.floor(hash(x, 0, z, 20) * (depth - 1))
      for (let i = 1; i < k; i += 1) b.set(x, g + i, z, 'kelp_plant')
      b.set(x, g + k, z, 'kelp[age=20]')
    } else if (depth >= 3 && c > 0.55 && hash(x, 1, z, 21) < 0.3) {
      b.set(x, g + 1, z, 'tall_seagrass[half=lower]') // finish() does not add tall_seagrass's upper half
      b.set(x, g + 2, z, 'tall_seagrass[half=upper]')
    } else if (depth >= 2 && c > 0.55) b.set(x, g + 1, z, 'seagrass')
  }

  // ================================================================ 2 LONGHOUSE (the hero)
  // --- 2a plan: bowed long walls. u = -1..1 along the hall; the half-width grows from 5 at the
  // gables to 6.6 in the middle, rounded per slice to 5/6/7 (the jogs get external posts).
  const u = x => (x - CX) / HL
  const wReal = x => 5 + 1.6 * (1 - Math.min(1, u(x) ** 2))
  const Wd = x => Math.round(wReal(clamp(x, X0, X1)))
  const inFoot = (x, z) => x >= X0 && x <= X1 && Math.abs(z - CZ) <= Wd(x)
  const isWall = (x, z) => { // 8-neighbour boundary: the jogs of the bowed wall stay closed
    if (!inFoot(x, z)) return false
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) if (!inFoot(x + dx, z + dz)) return true
    return false
  }
  // placeholders per surface role, textured later: WALL = log courses, FOOT = stone footing.
  // Pick colours the finished build never uses (the sail is white wool), so a leftover is obvious
  // in a render and `inspect --find lime_wool` / `magenta_wool` must come back empty.
  const WALL = 'lime_wool', FOOT = 'magenta_wool'
  for (let x = X0 - 1; x <= X1 + 1; x += 1) for (let z = CZ - 9; z <= CZ + 9; z += 1) {
    if (!inFoot(x, z)) continue
    for (let y = Math.min(ground(x, z), F - 2) - 1; y <= F - 1; y += 1) b.set(x, y, z, FOOT) // footing reaches into the ground
    if (isWall(x, z)) {
      b.set(x, F, z, FOOT) // one visible stone course
      b.box([x, F + 1, z], [x, F + 3, z], WALL) // three log courses
    } else b.clear([x, F, z], [x, F + 20, z])
  }
  // external raking posts (Trelleborg style), 1 out from the wall under the eave: every 3-4
  // blocks, plus one at every jog of the bowed wall so the steps read as structure.
  const postXs = [X0, X0 + 4, X0 + 7, X0 + 11, X0 + 15, X0 + 19, CX + 4, CX + 8, CX + 12, CX + 16, X1 - 3, X1]
  for (let x = X0 + 1; x <= X1; x += 1) if (Wd(x) !== Wd(x - 1)) postXs.push(Wd(x) > Wd(x - 1) ? x : x - 1)
  postXs.sort((a, c) => a - c)
  for (const x of postXs.filter((x, i) => i === 0 || x - postXs[i - 1] > 1)) for (const s of [-1, 1]) {
    const z = CZ + s * (Wd(x) + 1)
    for (let y = Math.min(ground(x, z), F - 1) - 1; y <= F + 3; y += 1) b.set(x, y, z, 'dark_oak_log[axis=y]')
  }

  // --- 2b the hogback roof as a height field.
  //   T(x, z) = EAVE + rise(x) * profile(r), r = 0 at the eave edge .. 1 at the ridge
  //   rise(x) grows toward the gables (ridge sags 2.5 in the middle); span(x) follows the bow;
  //   profile is bell-cast (shallow at the eave, steep at the ridge).
  // Each column's top surface is rounded to half blocks: x.5 -> bottom slab; whole -> a stair
  // facing up-slope (or a full block on the ridge / where nothing drops below). Columns are filled
  // down to their lowest neighbour so the steep roof stays watertight.
  const EAVE = F + 5
  const ridgeRise = x => 10 + 2.5 * Math.min(1, u(x) ** 2)
  const span = x => wReal(x) + 1.25
  const prof = r => 0.65 * r + 0.35 * r * r
  const roofT = (x, z) => EAVE + ridgeRise(x) * prof(clamp(1 - Math.abs(z - CZ) / span(x), 0, 1))
  const roofCols = new Map()
  for (let x = X0 - 1; x <= X1 + 1; x += 1) { // one block of gable overhang at each end
    const wx = Wd(x)
    for (let z = CZ - wx - 1; z <= CZ + wx + 1; z += 1) roofCols.set(`${x},${z}`, Math.round(roofT(x, z) * 2) / 2) // one of eave overhang
  }
  // cap the ridge one block above its neighbours: where the bell-cast profile is steepest (the
  // gable ends) the ridge column would otherwise stand 2.5-3 blocks proud, a thin fin that reads
  // as a chimney
  for (let x = X0 - 1; x <= X1 + 1; x += 1) {
    const n = Math.max(roofCols.get(`${x},${CZ - 1}`), roofCols.get(`${x},${CZ + 1}`))
    roofCols.set(`${x},${CZ}`, Math.min(roofCols.get(`${x},${CZ}`), Math.ceil(n) + 1))
  }
  const tq = (x, z) => roofCols.get(`${x},${z}`)
  const topPiece = new Map() // y of each column's top block (used by the porch, moss, horns, louvre)
  for (const [key, top] of roofCols) {
    const [x, z] = key.split(',').map(Number)
    const dz = z - CZ
    const out = Math.sign(dz)
    const up = dz > 0 ? 'north' : 'south'
    const downhill = dz === 0 ? null : tq(x, z + out) ?? EAVE - 1
    let yTop
    if (top % 1 !== 0) {
      yTop = Math.floor(top)
      b.set(x, yTop, z, 'dark_oak_slab[type=bottom]')
    } else {
      yTop = top - 1
      if (dz === 0 || downhill > top - 0.5) b.set(x, yTop, z, 'dark_oak_planks')
      else b.set(x, yTop, z, `dark_oak_stairs[facing=${up},half=bottom]`)
    }
    topPiece.set(key, yTop)
    const eaveRow = tq(x, z + out) === undefined && dz !== 0
    let low = yTop
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
      const nt = tq(nx, nz)
      if (nt === undefined) continue // the eave edge and the gable rake end in a single thickness
      low = Math.min(low, Math.ceil(nt) - 1)
    }
    for (let y = yTop - 1; y >= low; y -= 1) b.set(x, y, z, 'dark_oak_planks')
    // shingle-course shadow: the lowest exposed riser block becomes an upside-down stair whose
    // open lower half faces down-slope, so every course casts a thin shadow line
    if (dz !== 0 && !eaveRow) {
      const yd = Math.ceil(tq(x, z + out)) - 1
      if (yTop - 1 > yd && yd + 1 >= low) b.set(x, yd + 1, z, `dark_oak_stairs[facing=${up},half=top]`)
    }
    if (eaveRow) b.set(x, yTop - 1, z, `dark_oak_stairs[facing=${up},half=top]`, { keep: true }) // bevelled eave edge
    else if (Math.abs(dz) <= Wd(x) && x >= X0 && x <= X1) b.set(x, low - 1, z, 'spruce_planks', { keep: true }) // ceiling boards (inside only)
  }
  // wall tops filled up to the roof; gable triangles in vertical boards
  for (let x = X0; x <= X1; x += 1) for (let z = CZ - 9; z <= CZ + 9; z += 1) {
    if (!isWall(x, z)) continue
    const gableEnd = x === X0 || x === X1
    for (let y = F + 4; y < F + 22 && !b.has(x, y, z); y += 1) b.set(x, y, z, gableEnd ? 'stripped_spruce_log[axis=y]' : WALL)
  }

  // --- 2c entrance porch: a 7-wide cross gable on the south side
  const PZ0 = CZ + Wd(CX) + 1, PZ1 = PZ0 + 2
  for (let x = CX - 3; x <= CX + 3; x += 1) for (let z = PZ0; z <= PZ1; z += 1) {
    for (let y = Math.min(ground(x, z), F - 2) - 1; y <= F - 1; y += 1) b.set(x, y, z, FOOT)
    const side = x === CX - 3 || x === CX + 3 || z === PZ1
    for (let y = F; y <= F + 3; y += 1) b.set(x, y, z, side ? WALL : 'air')
  }
  b.clear([CX - 1, F, PZ1], [CX + 1, F + 2, PZ1]) // open front
  for (let x = CX - 2; x <= CX + 2; x += 1) for (let z = PZ0; z < PZ1; z += 1) b.set(x, F - 1, z, 'spruce_planks')
  {
    // Built on a scratch module, then merged: a porch cell survives only where it sits above the
    // main roof surface, so the cross gable runs back over the main slope until it dives under it.
    const tmp = b.module(b.size)
    tmp.roof({ x0: CX - 3, x1: CX + 3, z0: PZ0 - 3, z1: PZ1, y: F + 4, type: 'gable', axis: 'z', material: 'dark_oak', pitch: 2, overhang: 1, gableOverhang: 1, gable: 'stripped_spruce_log[axis=y]', eaveTrim: true })
    for (const [x, y, z, blk] of tmp.entries()) {
      const mainTop = topPiece.get(`${x},${z}`)
      if (mainTop !== undefined && y <= mainTop) continue
      if (mainTop === undefined && inFoot(x, z)) continue
      b.set(x, y, z, blk)
    }
  }

  // --- 2d roof texture: dark oak shingles bleached to spruce in clumps toward the sunny ridge,
  // darkest at the wet eaves. (A deepslate "soot" step was tried: it read as grey stone patches.
  // Two wood steps and clumped noise are enough on a roof this big.)
  const ROOF_ONLY = ['dark_oak_stairs', 'dark_oak_slab', 'dark_oak_planks']
  b.texture([X0 - 2, EAVE - 2, CZ - 10], [X1 + 2, F + 20, CZ + 12], ['spruce', 'dark_oak', 'dark_oak'], { only: ROOF_ONLY, mid: 0.5, base: 0.3, top: 0.45, edge: 0, drip: 0, noise: 0.3, scale: 5, seed: 5 })
  // moss on exposed risers where the roof stays damp: the lowest rows and the sagging middle.
  // Moss has no stairs, so only the full-block risers (and the shadow-notch stairs) can take it.
  for (const [key, yTop] of topPiece) {
    const [x, z] = key.split(',').map(Number)
    const out = Math.sign(z - CZ)
    if (out === 0) continue
    const r = clamp(1 - Math.abs(z - CZ) / span(x), 0, 1)
    const wet = 0.7 * (1 - r) ** 2 + 0.25 * (1 - Math.min(1, Math.abs(u(x))))
    for (let y = yTop - 3; y < yTop; y += 1) {
      const blk = b.get(x, y, z)
      if (!blk || !(/_planks$/.test(blk.name) || blk.props?.half === 'top') || b.has(x, y, z + out)) continue
      if (kit.noise.coherent01(x, y, z, { scale: 3.5, seed: 91 }) + wet > 1.0) b.set(x, y, z, 'moss_block')
    }
  }

  // a dark ridge beam (bark-on log along the ridge) draws the hogback curve as one clean line
  // against the bleached upper slopes; half-step ridge cells stay dark oak slabs
  for (let x = X0 - 1; x <= X1 + 1; x += 1) {
    const y = topPiece.get(`${x},${CZ}`)
    const blk = b.get(x, y, CZ)
    b.set(x, y, CZ, blk && /_slab$/.test(blk.name) ? 'dark_oak_slab[type=bottom]' : 'dark_oak_log[axis=x]')
  }

  // --- 2e roofline: crossed gable horns, porch horns, smoke louvre (placed after texturing so
  // they keep their dark oak: they read as dark silhouettes against the sky)
  const ridgeTop = x => topPiece.get(`${x},${CZ}`)
  for (const gx of [X0 - 1, X1 + 1]) {
    const yR = ridgeTop(gx)
    // the two barge boards cross above the apex and splay into carved, outward-looking heads;
    // each arm is a face-connected staircase (a diagonal-only step reads as a detached block)
    b.set(gx, yR + 1, CZ, 'dark_oak_planks')
    for (const s of [-1, 1]) {
      for (const [dz, dy] of [[1, 0], [1, 1], [1, 2], [2, 2], [2, 3], [2, 4]]) b.set(gx, yR + dy, CZ + s * dz, 'dark_oak_planks')
      for (let y = yR - 1; y > yR - 4 && !b.has(gx, y, CZ + s); y -= 1) b.set(gx, y, CZ + s, 'dark_oak_planks') // seat it on the rake
      const inward = s > 0 ? 'north' : 'south'
      b.set(gx, yR + 5, CZ + s * 2, `dark_oak_stairs[facing=${inward},half=bottom]`) // crown
      b.set(gx, yR + 4, CZ + s * 3, `dark_oak_stairs[facing=${inward},half=top]`) // snout looking out
    }
  }
  {
    const pr = b.topY(CX, PZ1 + 1)
    for (const s of [-1, 1]) {
      b.set(CX + s, pr + 1, PZ1 + 1, 'dark_oak_planks')
      b.set(CX + s * 2, pr + 2, PZ1 + 1, `dark_oak_stairs[facing=${s > 0 ? 'west' : 'east'},half=bottom]`)
    }
  }
  // smoke hole over the hearth: open the ridge and cap it with a little louvre on fence posts
  const yS = ridgeTop(CX)
  for (let x = CX - 1; x <= CX + 1; x += 1) for (let y = yS - 3; y <= yS; y += 1) b.remove(x, y, CZ)
  for (const [x, z] of [[CX - 1, CZ - 1], [CX + 1, CZ - 1], [CX - 1, CZ + 1], [CX + 1, CZ + 1]])
    for (let y = topPiece.get(`${x},${z}`) + 1; y <= yS + 1; y += 1) b.set(x, y, z, 'dark_oak_fence')
  for (let x = CX - 2; x <= CX + 2; x += 1) {
    b.set(x, yS + 2, CZ - 1, 'dark_oak_stairs[facing=south,half=bottom]')
    b.set(x, yS + 2, CZ + 1, 'dark_oak_stairs[facing=north,half=bottom]')
    b.set(x, yS + 2, CZ, 'dark_oak_slab[type=bottom]')
  }

  // --- 2f openings. The hero bay (porch) gets the most detail: carved frame, lantern, shields.
  b.remove(CX, F, PZ0 - 1)
  b.remove(CX, F + 1, PZ0 - 1)
  b.door([CX, F, PZ0 - 1], 'south', { material: 'spruce' }) // the hall door sits inside the porch
  for (const s of [-1, 1]) b.box([CX + s * 2, F, PZ1], [CX + s * 2, F + 3, PZ1], 'dark_oak_log[axis=y]')
  for (const s of [-1, 1]) b.box([CX + s * 3, F - 1, PZ1], [CX + s * 3, F + 3, PZ1], 'dark_oak_log[axis=y]')
  b.set(CX - 1, F + 2, PZ1, 'dark_oak_stairs[facing=east,half=top]') // carved brackets
  b.set(CX + 1, F + 2, PZ1, 'dark_oak_stairs[facing=west,half=top]')
  for (let x = CX - 1; x <= CX + 1; x += 1) b.set(x, F + 3, PZ1, 'stripped_dark_oak_log[axis=x]') // lintel
  b.door([X1, F, CZ], 'east', { material: 'dark_oak', frame: 'dark_oak_log[axis=y]' }) // gable door to the gate road
  b.set(X1 + 1, F - 1, CZ, 'cobblestone_slab[type=top]')
  // few, small, high windows (dark interiors were the norm): dim pane, lintel, one shutter
  const windows = [[31, 1], [37, 1], [49, 1], [55, 1], [33, -1], [53, -1]]
  for (const [x, s] of windows) {
    const z = CZ + s * Wd(x)
    b.set(x, F + 2, z, 'brown_stained_glass_pane')
    b.set(x, F + 3, z, 'stripped_dark_oak_log[axis=x]')
    b.set(x - 1, F + 2, z + s, `spruce_trapdoor[facing=${s > 0 ? 'south' : 'north'},open=true,half=top]`, { keep: true })
  }
  // warriors' shields either side of the porch: open trapdoors, red (mangrove) and white (birch)
  for (const x of [CX - 6, CX - 5, CX + 5, CX + 6]) {
    const z = CZ + Wd(x) + 1
    if (!b.has(x, F + 2, z)) b.set(x, F + 2, z, `${x % 2 ? 'mangrove' : 'birch'}_trapdoor[facing=south,open=true,half=top]`)
  }
  for (const gx of [X0, X1]) b.set(gx, ridgeTop(gx) - 4, CZ, 'air') // gable vents ("owl holes")

  // --- 2g wall texture. b.texture cannot do logs (a log entry resolves to its family's planks), so
  // the log courses get a hand-written paint with the same logic: corners become upright posts,
  // and the lowest course is mostly darker stripped dark oak (damp, tarred), clumped by noise.
  const logWall = (x, y, z) => {
    const blk = b.get(x, y, z)
    if (!blk || blk.name !== `minecraft:${WALL}`) return null
    const along = (dx, dz) => {
      const n = b.get(x + dx, y, z + dz)
      return n !== null && n.name !== 'minecraft:air'
    }
    const alongX = along(1, 0) && along(-1, 0)
    const alongZ = along(0, 1) && along(0, -1)
    if (!alongX && !alongZ) return 'dark_oak_log[axis=y]'
    const axis = alongX ? 'x' : 'z'
    const damp = (y - F) / 4 + 0.35 * (kit.noise.coherent01(x, y, z, { scale: 5, seed: 21 }) - 0.5)
    return damp < 0.3 ? `stripped_dark_oak_log[axis=${axis}]` : `stripped_spruce_log[axis=${axis}]`
  }
  for (let x = X0 - 1; x <= X1 + 1; x += 1) for (let z = CZ - 10; z <= CZ + 12; z += 1) for (let y = F; y <= F + 8; y += 1) {
    const p = logWall(x, y, z)
    if (p) b.set(x, y, z, p)
  }
  // footing: one stone ramp, darkest at the base and on the corners
  b.texture([X0 - 2, F - 8, CZ - 10], [X1 + 2, F, CZ + 12], ['cobblestone', 'mossy_cobblestone', 'cobbled_deepslate'], { only: FOOT, base: 0.35, edge: 0.15, noise: 0.25, seed: 3 })

  // --- 2h interior: beaten-earth aisle, raised plank platforms along the walls (bench by day,
  // bed by night), a long hearth under the smoke hole, two rows of roof posts with tie beams,
  // the chieftain's high seat facing the fire, feasting tables, end rooms for sleeping and stores.
  for (let x = X0 + 1; x < X1; x += 1) for (let z = CZ - 8; z <= CZ + 8; z += 1) {
    if (!inFoot(x, z) || isWall(x, z)) continue
    const dz = Math.abs(z - CZ)
    const wx = Wd(x)
    if (dz >= wx - 2) {
      b.set(x, F - 1, z, 'spruce_planks')
      b.set(x, F, z, dz === wx - 2 ? `spruce_stairs[facing=${z > CZ ? 'south' : 'north'},half=bottom]` : 'spruce_planks')
    } else b.set(x, F - 1, z, pal({ packed_mud: 5, coarse_dirt: 3, rooted_dirt: 1 }, 31, 2))
  }
  for (let x = X0 + 6; x < X1 - 5; x += 1) for (const s of [-1, 1]) { // furs on the platforms
    const z = CZ + s * (Wd(x) - 1)
    const h = hash(x, 0, z, 33)
    if (h < 0.35) b.set(x, F + 1, z, h < 0.12 ? 'white_carpet' : h < 0.24 ? 'brown_carpet' : 'light_gray_carpet')
  }
  for (let x = CX - 4; x <= CX + 4; x += 1) for (let z = CZ - 1; z <= CZ + 1; z += 1) { // long hearth
    const rim = Math.abs(x - CX) === 4 || z !== CZ
    b.set(x, F - 1, z, 'cobblestone')
    b.set(x, F, z, rim ? 'stone_brick_slab[type=bottom]' : (Math.abs(x - CX) % 3 === 0 ? 'campfire[lit=true]' : 'gravel'))
  }
  for (const x of [X0 + 3, ...Array.from({ length: 8 }, (_, i) => X0 + 5 + 4 * i), X1 - 3]) {
    for (const s of [-1, 1]) {
      const z = CZ + s * 3
      let y = F
      while (y < F + 20 && !b.has(x, y, z)) b.set(x, y++, z, 'stripped_spruce_log[axis=y]')
    }
    for (let z = CZ - 3; z <= CZ + 3; z += 1) b.set(x, F + 6, z, 'stripped_dark_oak_log[axis=z]')
    if (Math.abs(x - CX) > 3) b.hangingLantern([x, F + 6, CZ], 1)
  }
  b.set(CX, F + 1, CZ - Wd(CX) + 1, 'dark_oak_stairs[facing=north,half=bottom]') // high seat
  for (const s of [-1, 1]) {
    b.box([CX + s, F + 1, CZ - Wd(CX) + 1], [CX + s, F + 3, CZ - Wd(CX) + 1], 'stripped_dark_oak_log[axis=y]')
    b.set(CX + s, F + 4, CZ - Wd(CX) + 1, 'dark_oak_fence')
  }
  b.set(CX, F + 1, CZ - Wd(CX) + 2, 'red_carpet')
  for (const s of [-1, 1]) for (let x = CX + s * 6; Math.abs(x - CX) <= 9; x += s) { // tables + benches
    b.set(x, F, CZ, 'spruce_slab[type=top]')
    b.set(x, F, CZ - 1, 'spruce_stairs[facing=north,half=bottom]')
    b.set(x, F, CZ + 1, 'spruce_stairs[facing=south,half=bottom]')
  }
  for (let x = X0 + 7; x <= X1 - 7; x += 2) for (const s of [-1, 1]) { // shields on the inner walls
    const z = CZ + s * (Wd(x) - 1)
    if (b.has(x, F + 2, z) || hash(x, 2, z, 35) < 0.3 || windows.some(([wx]) => Math.abs(wx - x) <= 1)) continue
    b.set(x, F + 2, z, `${(x + (s > 0 ? 1 : 0)) % 4 < 2 ? 'mangrove' : 'birch'}_trapdoor[facing=${s > 0 ? 'north' : 'south'},open=true,half=top]`)
  }
  for (const [x, z] of [[X0 + 7, CZ - Wd(X0 + 7) + 1], [X1 - 7, CZ + Wd(X1 - 7) - 1], [CX + 5, CZ - Wd(CX + 5) + 1]]) b.set(x, F + 1, z, 'barrel[facing=up]')
  for (const px of [X0 + 5, X1 - 5]) { // plank partitions with doors
    for (let z = CZ - 6; z <= CZ + 6; z += 1) {
      if (!inFoot(px, z) || isWall(px, z)) continue
      let y = F
      while (y < F + 20 && !b.has(px, y, z)) b.set(px, y++, z, 'spruce_planks')
    }
    b.clear([px, F, CZ], [px, F + 1, CZ])
    b.door([px, F, CZ], px < CX ? 'east' : 'west', { material: 'spruce' })
  }
  for (const s of [-1, 1]) b.set(X0 + 2, F + 1, CZ + s * (Wd(X0 + 2) - 1), 'red_bed[facing=west,part=foot]') // west room: beds
  b.set(X0 + 1, F, CZ + 3, 'chest[facing=north]')
  b.set(X0 + 1, F, CZ - 3, 'loom[facing=east]')
  for (const [x, z] of [[X1 - 1, CZ - 3], [X1 - 1, CZ - 4], [X1 - 2, CZ - 4], [X1 - 1, CZ + 3], [X1 - 1, CZ + 4]]) b.set(x, F, z, 'barrel[facing=up]') // east room: stores
  b.set(X1 - 2, F, CZ + 4, 'smoker[facing=west,lit=true]')
  b.set(X1 - 3, F, CZ + 4, 'crafting_table')

  // ================================================================ 3 OUTBUILDINGS
  // Varied but related: same footing, same log walls, same doors; different footprints, roof
  // axes and pitches; sod roofs on the humble buildings, dark shingles on hall and stabbur.
  const logBox = (x0, z0, x1, z1, fy, h, log, { footing = true } = {}) => { // stacked-log walls on a stone footing
    for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) {
      if (footing) for (let y = Math.min(ground(x, z), fy - 1) - 1; y <= fy - 1; y += 1) b.set(x, y, z, FOOT)
      const edge = x === x0 || x === x1 || z === z0 || z === z1
      const corner = (x === x0 || x === x1) && (z === z0 || z === z1)
      for (let y = fy; y < fy + h; y += 1) {
        if (!edge) b.remove(x, y, z)
        else b.set(x, y, z, corner ? `${log}[axis=y]` : `${log}[axis=${z === z0 || z === z1 ? 'x' : 'z'}]`)
      }
    }
  }
  // Sod roof: build a normal pitch-1 roof, then swap its surface for turf (stepped full blocks of
  // grass and moss) and keep the wooden eave stairs as the turf's retaining board.
  const TURF_ROOF = pal({ grass_block: 8, moss_block: 3, podzol: 1, rooted_dirt: 1 }, 41, 3)
  const turfRoof = (x0, z0, x1, z1, yMin) => {
    for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) {
      const y = b.topY(x, z)
      if (y < yMin) continue
      const blk = b.get(x, y, z)
      if (!/_stairs$|_slab$|_planks$/.test(blk.name)) continue
      const below = b.get(x, y - 1, z)
      const eave = !below || below.name === 'minecraft:air' || below.props?.half === 'top'
      if (eave && /_stairs$/.test(blk.name)) continue
      b.set(x, y, z, TURF_ROOF)
    }
  }

  // --- naust: dry-stone walls dug into the headland, a gravel slipway running into the water
  // under an open gable, a faering inside
  const NF = WATER + 2
  const NCX = (N.x0 + N.x1) / 2
  for (let x = N.x0 - 1; x <= N.x1 + 1; x += 1) for (let z = N.z0 - 1; z <= N.z1; z += 1) b.clear([x, NF, z], [x, NF + 14, z])
  for (let x = N.x0; x <= N.x1; x += 1) for (let z = N.z0; z <= N.z1; z += 1) {
    const side = x === N.x0 || x === N.x1 || z === N.z0
    const slip = Math.round(NF - 1 - Math.max(0, z - (N.z1 - 6)) * 0.7)
    for (let y = Math.min(ground(x, z), slip) - 2; y <= slip; y += 1) b.set(x, y, z, side ? FOOT : 'gravel')
    if (!side) for (let y = slip + 1; y < NF; y += 1) b.set(x, y, z, y <= WATER ? 'water' : 'air')
    if (side) for (let y = slip + 1; y <= NF + 2; y += 1) b.set(x, y, z, FOOT)
  }
  b.roof({ x0: N.x0, x1: N.x1, z0: N.z0, z1: N.z1, y: NF + 3, type: 'gable', axis: 'z', material: 'spruce', pitch: 1, overhang: 1, gableOverhang: 1, gable: 'spruce_planks', eaveTrim: true })
  b.clear([N.x0 + 1, NF - 1, N.z1], [N.x1 - 1, NF + 4, N.z1]) // open water gable
  for (const x of [N.x0 + 1, N.x1 - 1]) b.box([x, NF - 2, N.z1], [x, NF + 3, N.z1], 'spruce_log[axis=y]')
  for (let x = N.x0 + 1; x <= N.x1 - 1; x += 1) b.set(x, NF + 3, N.z1, 'stripped_spruce_log[axis=x]')
  b.door([NCX, NF, N.z0], 'north', { material: 'spruce' })
  turfRoof(N.x0 - 1, N.z0 - 1, N.x1 + 1, N.z1 + 1, NF + 3)
  b.texture([N.x0, 0, N.z0], [N.x1, NF + 2, N.z1], ['cobblestone', 'mossy_cobblestone', 'cobbled_deepslate'], { only: FOOT, base: 0.4, edge: 0.15, noise: 0.3, seed: 11 })

  // --- smokehouse: bark-on logs, sod roof, stone chimney; fish rails and a fire inside
  const SF = Math.max(...[SMOKE.x0, SMOKE.x1].flatMap(x => [SMOKE.z0, SMOKE.z1].map(z => ground(x, z)))) + 1
  logBox(SMOKE.x0, SMOKE.z0, SMOKE.x1, SMOKE.z1, SF, 3, 'spruce_log')
  b.box([SMOKE.x0 + 1, SF - 1, SMOKE.z0 + 1], [SMOKE.x1 - 1, SF - 1, SMOKE.z1 - 1], 'cobblestone')
  b.roof({ x0: SMOKE.x0, x1: SMOKE.x1, z0: SMOKE.z0, z1: SMOKE.z1, y: SF + 3, type: 'gable', axis: 'x', material: 'spruce', pitch: 1, overhang: 1, gableOverhang: 1, gable: 'spruce_planks', eaveTrim: true })
  turfRoof(SMOKE.x0 - 1, SMOKE.z0 - 1, SMOKE.x1 + 1, SMOKE.z1 + 1, SF + 3)
  b.chimney([SMOKE.x1 - 1, SF, SMOKE.z0 + 3], 9, { paint: pal({ cobblestone: 4, mossy_cobblestone: 2, cobbled_deepslate: 1 }, 43, 2), cap: 'cobblestone_wall' })
  b.door([SMOKE.x0, SF, SMOKE.z0 + 3], 'west', { material: 'spruce' })
  for (let x = SMOKE.x0 + 1; x <= SMOKE.x1 - 1; x += 1) { // firewood against the south wall, log ends out
    const h = 1 + (x > SMOKE.x0 + 1 && x < SMOKE.x1 - 1 ? 1 : 0)
    for (let y = SF; y < SF + h; y += 1) b.set(x, y, SMOKE.z1 + 1, 'spruce_log[axis=z]')
    b.set(x, SF + h, SMOKE.z1 + 1, 'spruce_slab[type=bottom]')
  }
  for (let x = SMOKE.x0 + 1; x <= SMOKE.x1 - 2; x += 1) b.box([x, SF + 2, SMOKE.z0 + 2], [x, SF + 2, SMOKE.z1 - 2], 'spruce_fence')
  b.set(SMOKE.x0 + 2, SF, SMOKE.z0 + 2, 'campfire[lit=true]')
  b.texture([SMOKE.x0, 0, SMOKE.z0], [SMOKE.x1, SF, SMOKE.z1], ['cobblestone', 'mossy_cobblestone', 'cobbled_deepslate'], { only: FOOT, base: 0.4, noise: 0.3, seed: 12 })

  // --- stabbur: a storehouse lifted on posts with stone pads; a gallery deck; steps that stop one
  // stride short of the gallery (the gap keeps the rats out)
  const TG = Math.max(...[STAB.x0, STAB.x1].flatMap(x => [STAB.z0, STAB.z1].map(z => ground(x, z))))
  const TF = TG + 4
  for (const [x, z] of [[STAB.x0, STAB.z0], [STAB.x1, STAB.z0], [STAB.x0, STAB.z1], [STAB.x1, STAB.z1], [STAB.x0, STAB.z0 + 3], [STAB.x1, STAB.z0 + 3]]) {
    for (let y = ground(x, z) - 1; y <= ground(x, z) + 1; y += 1) b.set(x, y, z, 'cobblestone')
    b.box([x, ground(x, z) + 2, z], [x, TF - 2, z], 'stripped_spruce_log[axis=y]')
  }
  for (let x = STAB.x0 - 1; x <= STAB.x1 + 1; x += 1) for (let z = STAB.z0 - 1; z <= STAB.z1 + 1; z += 1) b.set(x, TF - 1, z, 'spruce_planks')
  for (let x = STAB.x0 - 1; x <= STAB.x1 + 1; x += 1) b.set(x, TF - 1, STAB.z1 + 1, 'spruce_slab[type=top]')
  logBox(STAB.x0, STAB.z0, STAB.x1, STAB.z1 - 1, TF, 4, 'stripped_spruce_log', { footing: false })
  b.roof({ x0: STAB.x0, x1: STAB.x1, z0: STAB.z0, z1: STAB.z1 - 1, y: TF + 4, type: 'gable', axis: 'z', material: 'dark_oak', pitch: 2, overhang: 1, gableOverhang: 1, gable: 'stripped_spruce_log[axis=y]', eaveTrim: true })
  b.door([STAB.x0 + 2, TF, STAB.z1 - 1], 'south', { material: 'spruce' })
  for (let x = STAB.x0 - 1; x <= STAB.x1 + 1; x += 2) b.set(x, TF, STAB.z1 + 1, 'spruce_fence')
  for (let z = STAB.z1 + 3; z <= STAB.z1 + 6; z += 1) {
    const x = STAB.x0 + 2, y = TF - 1 - (z - STAB.z1 - 2)
    if (y <= ground(x, z)) break
    b.set(x, y, z, 'spruce_stairs[facing=north,half=bottom]')
    for (let yy = y - 1; yy >= ground(x, z); yy -= 1) b.set(x, yy, z, 'spruce_planks')
  }

  // ================================================================ 4 PALISADE AND GATE
  // Stakes along a polyline (face-connected cells), set into the ground and following it. Every
  // other stake is a block taller and sharpened with a fence post; the tips never touch, because
  // adjacent fence posts would join into a railing.
  const stakes = new Map()
  for (let i = 1; i < PALISADE.length; i += 1) for (const c of lineCells(PALISADE[i - 1], PALISADE[i])) stakes.set(`${c[0]},${c[1]}`, c)
  let si = 0
  for (const [x, z] of stakes.values()) {
    si += 1
    if (x === GATE.x && z >= GATE.z0 && z <= GATE.z1) continue
    const g = ground(x, z)
    const tall = si % 2 === 0
    const top = g + 3 + (tall ? 1 : 0) + (kit.noise.coherent01(x, 0, z, { scale: 5, seed: 52 }) > 0.6 ? 1 : 0)
    b.box([x, g - 1, z], [x, top, z], 'spruce_log[axis=y]')
    if (tall) b.set(x, top + 1, z, 'spruce_fence')
  }
  // gate: tall dark posts, a lintel with crossed horns echoing the hall, braziers outside
  {
    const g = ground(GATE.x, (GATE.z0 + GATE.z1) / 2)
    for (const z of [GATE.z0 - 1, GATE.z1 + 1]) b.box([GATE.x, ground(GATE.x, z) - 1, z], [GATE.x, g + 7, z], 'dark_oak_log[axis=y]')
    for (let z = GATE.z0 - 2; z <= GATE.z1 + 2; z += 1) b.set(GATE.x, g + 7, z, 'stripped_dark_oak_log[axis=z]')
    const gz = (GATE.z0 + GATE.z1) / 2
    b.set(GATE.x, g + 8, gz, 'stripped_dark_oak_log[axis=y]')
    for (const s of [-1, 1]) {
      b.set(GATE.x, g + 8, gz + s, 'stripped_dark_oak_log[axis=y]')
      b.set(GATE.x, g + 9, gz + s * 2, `dark_oak_stairs[facing=${s > 0 ? 'north' : 'south'},half=bottom]`)
    }
    for (let z = GATE.z0; z <= GATE.z1; z += 1) b.set(GATE.x, g - 1, z, 'cobblestone') // worn threshold
    for (const z of [GATE.z0 - 3, GATE.z1 + 3]) {
      const gx = GATE.x + 2
      b.set(gx, ground(gx, z) + 1, z, 'cobblestone_wall')
      b.set(gx, ground(gx, z) + 2, z, 'campfire[lit=true]')
    }
  }
  // a rune stone where the gate road forks: two-tier stone slab with one red-painted band
  {
    const rx = 77, rz = 21, g = ground(rx, rz)
    b.box([rx, g, rz], [rx, g + 3, rz], pal({ stone: 3, andesite: 2, tuff: 1 }, 77, 1.5))
    b.box([rx, g, rz + 1], [rx, g + 2, rz + 1], pal({ stone: 3, andesite: 2, tuff: 1 }, 78, 1.5))
    b.set(rx, g + 2, rz, 'red_terracotta')
    b.set(rx, g + 4, rz, 'stone_slab[type=bottom]')
    b.set(rx, g + 3, rz + 1, 'andesite_stairs[facing=north,half=bottom]')
  }

  // ================================================================ 5 SHORE: pier, longship, boats
  // pier: a plank deck two above the water on log posts that stand proud as bollards
  const PY = WATER + 2
  for (let z = PIER.z0; z <= PIER.z1; z += 1) for (let x = PIER.x0; x <= PIER.x1; x += 1) {
    if (ground(x, z) >= PY) continue
    b.set(x, PY, z, x === PIER.x0 || x === PIER.x1 ? 'stripped_spruce_log[axis=z]' : 'spruce_planks')
  }
  for (let z = PIER.z0; z <= PIER.z1; z += 3) for (const x of [PIER.x0, PIER.x1]) {
    if (ground(x, z) >= PY) continue
    b.box([x, ground(x, z), z], [x, PY + 1, z], 'spruce_log[axis=y]')
  }

  // Longship as a loft along z (bow = +z): half-breadth hb(t), keel rocker yk(t) and sheer ys(t)
  // are functions of t = 0 (stern) .. 1 (bow); each layer flares outward (longships widen above
  // the waterline). Where a layer overhangs the one below, the shell block is an upside-down stair:
  // that bevel IS the clinker strake line. `tb` is the builder or a scratch module.
  const longship = (tb, { cx, z0, z1, wy, beam = 3.4, keel = 2, free = 2, sheer = 2.5, mast = true, dragon = true, shields = true }) => {
    const L = z1 - z0
    const hb = t => beam * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.55)
    const yk = t => wy - keel + (keel + 0.2) * Math.pow(Math.abs(2 * t - 1), 3)
    const ys = t => wy + free + sheer * Math.pow(Math.abs(2 * t - 1), 2.4) + (t > 0.5 ? 0.6 * (2 * t - 1) : 0)
    const inside = (x, y, z) => {
      const t = (z - z0) / L
      if (t < 0 || t > 1) return false
      if (y < Math.round(yk(t)) || y > Math.round(ys(t))) return false
      const v = clamp((y - yk(t)) / Math.max(1, ys(t) - yk(t)), 0, 1)
      return Math.abs(x - cx) <= Math.max(0.4, hb(t) * (0.3 + 0.7 * Math.pow(v, 0.8)) + 0.15)
    }
    const R = Math.ceil(beam) + 1
    const top = Math.ceil(wy + free + sheer + 1)
    for (let z = z0; z <= z1; z += 1) for (let x = cx - R; x <= cx + R; x += 1) for (let y = wy - keel - 1; y <= top; y += 1) {
      if (!inside(x, y, z)) continue
      const shell = !inside(x + 1, y, z) || !inside(x - 1, y, z) || !inside(x, y, z + 1) || !inside(x, y, z - 1)
      const t = (z - z0) / L
      if (!shell) { // open hull above the deck (deck at the water line), solid below it
        if (y > wy) tb.remove(x, y, z)
        else tb.set(x, y, z, 'spruce_planks')
        continue
      }
      const flare = !inside(x, y - 1, z) && x !== cx
      const mat = y === Math.round(ys(t)) || y === wy ? 'dark_oak' : 'spruce' // dark gunwale and waterline strake
      tb.set(x, y, z, flare ? `${mat}_stairs[facing=${x > cx ? 'west' : 'east'},half=top]` : `${mat}_planks`)
    }
    for (let z = z0 + 4; z <= z1 - 4; z += 3) for (let x = cx - R; x <= cx + R; x += 1) // rowing benches
      if (inside(x, wy + 1, z) && !tb.has(x, wy + 1, z)) tb.set(x, wy + 1, z, 'spruce_slab[type=bottom]')
    for (let z = z0 + 3; z <= z1 - 3 && shields; z += 1) { // shield rack: open trapdoors on the gunwale
      const y = Math.round(ys((z - z0) / L))
      for (const s of [-1, 1]) {
        let x = cx
        while (inside(x + s, y, z)) x += s
        tb.set(x + s, y, z, `${z % 2 ? 'mangrove' : 'birch'}_trapdoor[facing=${s > 0 ? 'east' : 'west'},open=true,half=top]`)
      }
    }
    if (dragon) {
      // Side profile (dz forward, dy up): S-curved neck, two-block skull, an open beak (upside-down
      // stair over a slab), a swept-back crest, glowing eyes. The stern curls into a tail.
      const yb = Math.round(ys(1))
      for (const [dz, dy] of [[0, 1], [1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [2, 5], [2, 6], [3, 6]]) tb.set(cx, yb + dy, z1 + dz, 'dark_oak_planks')
      tb.set(cx, yb + 7, z1 + 3, 'dark_oak_planks')
      tb.set(cx, yb + 7, z1 + 4, 'dark_oak_stairs[facing=north,half=top]') // upper jaw
      tb.set(cx, yb + 6, z1 + 4, 'dark_oak_slab[type=bottom]') // lower jaw
      tb.set(cx, yb + 8, z1 + 2, 'dark_oak_stairs[facing=south,half=bottom]') // crest
      tb.set(cx, yb + 7, z1 + 2, 'dark_oak_stairs[facing=south,half=top]')
      for (const s of [-1, 1]) tb.set(cx + s, yb + 7, z1 + 3, `redstone_wall_torch[facing=${s > 0 ? 'east' : 'west'},lit=true]`)
      const yt = Math.round(ys(0))
      for (const [dz, dy] of [[0, 1], [-1, 1], [-1, 2], [-1, 3], [-1, 4], [0, 5]]) tb.set(cx, yt + dy, z0 + dz, 'dark_oak_planks')
      tb.set(cx, yt + 5, z0 - 1, 'dark_oak_stairs[facing=south,half=top]')
      tb.set(cx, yt + 4, z0, 'dark_oak_stairs[facing=north,half=top]')
    }
    if (mast) {
      // Square sail, wider than tall (~0.45 of the hull length), red and white strakes, billowing
      // up to 2 blocks toward the bow. Cells between bulge levels are filled so the cloth reads as
      // one surface from every side.
      const zm = Math.round(z0 + L * 0.5)
      const mh = 12, SW = 5, y0 = wy + 4, y1 = wy + mh - 2
      tb.box([cx, wy + 1, zm], [cx, wy + mh, zm], 'spruce_log[axis=y]')
      tb.box([cx - SW - 1, wy + mh - 1, zm], [cx + SW + 1, wy + mh - 1, zm], 'stripped_spruce_log[axis=x]') // yard
      const bulge = (x, y) => {
        if (Math.abs(x - cx) > SW || y < y0 || y > y1) return null
        const sx = (x - cx) / (SW + 0.5), sy = (y - (y0 + y1) / 2) / ((y1 - y0) / 2 + 0.5)
        return Math.round(1.6 * (1 - sx * sx) * (1 - 0.5 * sy * sy))
      }
      for (let x = cx - SW; x <= cx + SW; x += 1) for (let y = y0; y <= y1; y += 1) {
        const k = bulge(x, y)
        const kmin = Math.min(k, ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ax, ay]) => bulge(x + ax, y + ay) ?? k))
        const d = Math.abs(x - cx)
        for (let j = kmin; j <= k; j += 1) tb.set(x, y, zm + 1 + j, d <= 1 || d >= 4 ? 'red_wool' : 'white_wool')
      }
      tb.set(cx, wy + mh + 1, zm, 'spruce_fence')
      tb.set(cx, wy + 1, z0 + 3, 'spruce_fence')
      tb.set(cx, wy + 2, z0 + 3, 'lantern[hanging=false]') // stern lantern
    }
  }
  // The ship is authored along +z in a scratch module and stamped a quarter turn (rotate: 1 is
  // clockwise, bow south -> west), so it lies broadside to the main views with its dragon head
  // silhouetted against the pale cliff. stamp() rotates every block state (stairs, shields, torches).
  {
    const mod = b.module([13, SIZE[1], 30])
    longship(mod, { cx: 6, z0: 2, z1: 25, wy: WATER })
    b.stamp(mod, [SHIP.x - 29, 0, SHIP.z - 6], { rotate: 1 }) // module (x, z) -> world (SHIP.x - z, SHIP.z - 6 + x)
  }
  const faering = { beam: 1.6, keel: 1, free: 1, sheer: 1.2, mast: false, dragon: false, shields: false } // small rowing boat
  {
    const mod = b.module([5, SIZE[1], 12]) // tied up on the other side of the pier
    longship(mod, { cx: 2, z0: 1, z1: 10, wy: WATER, ...faering })
    b.stamp(mod, [PIER.x0 - 5, 0, PIER.z1 - 11])
  }
  longship(b, { cx: NCX, z0: N.z0 + 3, z1: N.z0 + 11, wy: NF, ...faering }) // on the naust slipway
  {
    const mod = b.module([5, SIZE[1], 12]) // pulled up on the east beach, bow up the shingle
    longship(mod, { cx: 2, z0: 1, z1: 10, wy: ground(68, 49) + 1, ...faering })
    b.stamp(mod, [66, 0, 45], { rotate: 2 })
  }
  // fish-drying racks (hjell): fence posts, a log rail, stockfish (hanging roots) below it
  const rack = (x0, z, len) => {
    const g = Math.max(...Array.from({ length: len }, (_, i) => ground(x0 + i, z)))
    for (let i = 0; i < len; i += 1) {
      const x = x0 + i
      if (i % 3 === 0) b.box([x, ground(x, z) + 1, z], [x, g + 3, z], 'spruce_fence')
      b.set(x, g + 4, z, 'stripped_spruce_log[axis=x]')
      if (i % 3 !== 0) b.set(x, g + 3, z, 'hanging_roots')
    }
  }
  rack(74, 42, 7)
  rack(72, 45, 7)

  // ================================================================ 6 LANDSCAPE
  // Order: paths, rocks, trees, field, then ground cover (scatter repaints the top block, and a
  // rock or tree placed after it would cut tall plants in half). Props and lights come last.
  const paths = [
    [[GATE.x + 2, 25], [76, 25], [69, 27], [X1 + 2, CZ]], // gate road to the gable door
    [[CX, PZ1 + 1], [CX - 3, 41], [37, 43], [PIER.x0 + 1, PIER.z0 + 1]], // porch to the pier
    [[CX - 3, 41], [30, 41], [NCX + 1, N.z0 - 2]], // to the naust
    [[CX, PZ1 + 1], [CX + 5, 42], [56, 44], [64, 42], [SMOKE.x0 - 2, SMOKE.z0 + 3]], // along the beach
    [[X1 + 2, CZ], [66, 22], [STAB.x0 + 2, STAB.z1 + 6]], // to the stabbur
  ]
  for (const [i, p] of paths.entries()) b.path(p, { width: i < 2 ? 3 : 2, paint: pal({ coarse_dirt: 6, dirt_path: 3, gravel: 2, rooted_dirt: 1 }, 61 + i, 3.5), seed: i })

  // rocks: built in a scratch module and mossed only on their own top faces (boulder({ mossTop })
  // mosses the top block of every column in its bounding square, water and grass included)
  const ROCK = pal({ stone: 5, andesite: 3, cobblestone: 2, tuff: 1 }, 71, 2)
  const rock = (c, radii, seed) => {
    const tmp = b.module(b.size)
    tmp.boulder(c, radii, ROCK, { seed })
    for (const [x, y, z, blk] of tmp.entries()) {
      const exposed = !tmp.has(x, y + 1, z)
      b.set(x, y, z, exposed && y > WATER && kit.noise.coherent01(x, y, z, { scale: 3, seed }) < 0.5 ? 'moss_block' : blk)
    }
  }
  for (const [x, z, r, s] of [[27, 50, 2.0, 1], [50, 50, 1.5, 3], [79, 51, 2.0, 4], [8, 67, 2.4, 5], [57, 60, 1.6, 7], [62, 66, 2.2, 8], [80, 63, 1.8, 9]])
    rock([x, Math.max(ground(x, z), WATER - 1) + 0.3, z], [r * 1.3, r, r], s)
  rock([72, WATER - 1, 62], [4.2, 3.2, 3.4], 10) // a skerry with a cairn (varde) as a lit sea mark
  {
    const top = b.topY(72, 62)
    for (let y = top + 1; y <= top + 2; y += 1) b.set(72, y, 62, 'cobblestone_wall')
    b.set(72, top + 3, 62, 'campfire[lit=true]')
    b.scatter({ x0: 68, z0: 58, x1: 76, z1: 66, on: ['minecraft:moss_block'], density: 0.5, clump: 2, seed: 9, paints: [[3, 'short_grass'], [1, 'fern']] })
  }
  for (const [a2, c2] of [[[64, 53], [68, 57]], [[72, 53], [68, 57]]]) // fish weir: a V of stakes in the shallows
    for (const [x, z] of lineCells(a2, c2))
      for (let y = ground(x, z) + 1; y <= WATER + 1; y += 1) b.set(x, y, z, y <= WATER ? 'spruce_fence[waterlogged=true]' : 'spruce_fence')

  // forest: pine and spruce outside the palisade (north slope, east edge) and on the headland,
  // dart-thrown with a minimum spacing, thinned by a glade noise, three height classes
  const treeSpots = []
  for (let i = 0; i < 900; i += 1) {
    const x = rng.int(4, W - 5), z = rng.int(4, D - 5)
    const g = ground(x, z)
    if (g <= WATER + 1) continue
    const north = z < 6 + 1.5 * n2(x, 0, 8, 2)
    const east = x >= 83
    const head = x < cliffX(z) - 1 && z < 60
    if (!(north || east || head)) continue
    if (kit.noise.coherent01(x, 0, z, { scale: 9, seed: 81 }) < 0.3) continue // glades
    if (treeSpots.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 5.5)) continue
    treeSpots.push([x, z])
    const big = rng.chance(0.25)
    const sp = big || rng.chance(0.4) ? 'pine' : 'spruce'
    const h = Math.min(SIZE[1] - g - 4, big ? rng.int(19, 23) : sp === 'pine' ? rng.int(14, 18) : rng.int(9, 15))
    b.tree([x, g + 1, z], sp, { seed: i, height: h, radius: sp === 'spruce' ? Math.min(3.2, rng.range(2.6, 3.6)) : 3.2 })
  }
  for (const [x, z, h] of [[30, 12, 11], [56, 12, 9], [21, 17, 13]]) b.tree([x, ground(x, z) + 1, z], 'spruce', { seed: x, height: h, radius: 3 }) // inside the stakes

  // a small fenced field behind the hall (wheat standing in for barley): ripe, green and root strips
  {
    const fx0 = 34, fx1 = 47, fz0 = 10, fz1 = 15
    for (let x = fx0; x <= fx1; x += 1) for (let z = fz0; z <= fz1; z += 1) {
      const g = ground(x, z)
      for (let y = g + 1; y <= g + 3; y += 1) b.remove(x, y, z)
      if (x === fx0 || x === fx1 || z === fz0 || z === fz1) {
        b.set(x, g + 1, z, x === 40 && z === fz1 ? 'spruce_fence_gate[facing=south,open=false]' : 'spruce_fence')
        continue
      }
      b.set(x, g, z, 'farmland[moisture=7]')
      const strip = Math.floor((x - fx0 - 1) / 4)
      b.set(x, g + 1, z, strip === 1 ? (hash(x, 0, z, 71) < 0.5 ? 'carrots[age=5]' : 'potatoes[age=6]') : strip === 2 ? 'wheat[age=4]' : 'wheat[age=7]')
    }
  }

  // Ground cover. First an edge-planting pass: tall plants on the lip of every 1-block terrain
  // step hide the brown dirt riser below, so gentle slopes stop reading as contour stripes.
  for (let x = 1; x < W - 1; x += 1) for (let z = 1; z < D - 1; z += 1) {
    const g = ground(x, z)
    const top = b.get(x, g, z)
    if (!top || top.name !== 'minecraft:grass_block' || b.has(x, g + 1, z)) continue
    if (!DIR4.some(([dx, dz]) => ground(x + dx, z + dz) < g && !b.has(x + dx, g, z + dz))) continue
    const h = hash(x, g, z, 41) + (b.has(x, g + 2, z) ? 0.34 : 0) // no two-block plants under branches
    if (h < 0.22) b.set(x, g + 1, z, 'tall_grass[half=lower]')
    else if (h < 0.34) b.set(x, g + 1, z, 'large_fern[half=lower]')
    else if (h < 0.5) b.set(x, g + 1, z, 'fern')
    else if (h < 0.56) b.set(x, g + 1, z, 'sweet_berry_bush[age=2]')
  }
  b.scatter({ density: 0.22, clump: 6, seed: 3, paints: [[10, 'short_grass'], [3, 'fern'], [2, 'tall_grass'], [1, 'large_fern']] })
  b.scatter({ x0: 0, z0: 0, x1: W - 1, z1: 10, on: ['minecraft:podzol', 'minecraft:grass_block'], density: 0.08, clump: 5, seed: 4, paints: [[3, 'sweet_berry_bush[age=3]'], [2, 'fern'], [1, 'brown_mushroom']] })
  b.scatter({ x0: 30, z0: 36, x1: 60, z1: 44, density: 0.12, clump: 4, seed: 5, paints: [[2, 'cornflower'], [1, 'oxeye_daisy']] }) // one drift in front of the hall
  b.scatter({ x0: N.x0 - 2, z0: N.z0 - 2, x1: N.x1 + 2, z1: N.z1 + 2, on: ['minecraft:grass_block', 'minecraft:moss_block'], density: 0.35, clump: 3, seed: 6, paints: [[6, 'short_grass'], [1, 'fern']] }) // sod roofs grow too
  b.scatter({ x0: SMOKE.x0 - 2, z0: SMOKE.z0 - 2, x1: SMOKE.x1 + 2, z1: SMOKE.z1 + 2, on: ['minecraft:grass_block', 'minecraft:moss_block'], density: 0.35, clump: 3, seed: 7, paints: [[6, 'short_grass'], [1, 'fern']] })

  // ================================================================ 7 PROPS AND LIGHT
  // firewood against the west gable; hay by the stabbur; barrels on the pier and at the smokehouse
  for (let z = CZ - 3; z <= CZ + 3; z += 1) for (let y = F; y <= F + 1 + (Math.abs(z - CZ) < 2 ? 1 : 0); y += 1) b.set(X0 - 1, y, z, 'spruce_log[axis=x]')
  for (const [x, z, blk] of [[STAB.x1 + 2, STAB.z0 + 1, 'hay_block[axis=x]'], [STAB.x1 + 2, STAB.z0 + 2, 'hay_block[axis=x]'], [STAB.x1 + 3, STAB.z0 + 1, 'hay_block[axis=z]'], [SMOKE.x0 - 1, SMOKE.z1 - 1, 'barrel[facing=up]']])
    b.set(x, ground(x, z) + 1, z, blk)
  for (const z of [PIER.z1 - 2, PIER.z1 - 6]) b.set(PIER.x0 + 1, PY + 1, z, 'barrel[facing=up]')

  // Light plan: the hall is the brightest cluster (porch, eaves, braziers, a beach fire in front),
  // then pier and ship, then one lamp at every other door and along the paths.
  hang(CX, F + 2, PZ1 - 1) // porch
  for (const x of [27, 31, CX - 7, CX + 7, 55, 59]) hang(x, F + 3, CZ + Wd(x) + 1) // under the south eave
  for (const x of [27, 35, CX, 51, 59]) hang(x, F + 3, CZ - Wd(x) - 1) // under the north eave
  for (const s of [-1, 1]) { // braziers flanking the porch path
    const x = CX + s * 3, z = PZ1 + 3
    b.set(x, ground(x, z) + 1, z, 'cobblestone_wall')
    b.set(x, ground(x, z) + 2, z, 'campfire[lit=true]')
  }
  { // a beach fire ring with log seats between the hall and the ship
    const fx = 52, fz = 46, g = ground(fx, fz)
    b.set(fx, g, fz, 'cobblestone')
    b.set(fx, g + 1, fz, 'campfire[lit=true]')
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      b.set(fx + dx, ground(fx + dx, fz + dz), fz + dz, dx && dz ? 'gravel' : 'cobblestone')
      b.remove(fx + dx, ground(fx + dx, fz + dz) + 1, fz + dz) // plants scattered earlier would float
    }
    b.set(fx - 3, ground(fx - 3, fz) + 1, fz, 'stripped_spruce_log[axis=z]')
    b.set(fx - 3, ground(fx - 3, fz + 1) + 1, fz + 1, 'stripped_spruce_log[axis=z]')
    b.set(fx + 1, ground(fx + 1, fz - 3) + 1, fz - 3, 'stripped_spruce_log[axis=x]')
    b.set(fx + 2, ground(fx + 2, fz - 3) + 1, fz - 3, 'stripped_spruce_log[axis=x]')
  }
  for (const [x, s] of windows) b.set(x, F + 1, CZ + s * (Wd(x) - 1), 'candle[candles=3,lit=true]') // behind each window
  b.lampPost([PIER.x1, PY + 1, PIER.z0 + 9], { height: 3, post: 'spruce_fence', arm: 'west' })
  b.lampPost([PIER.x0, PY + 1, PIER.z1], { height: 3, post: 'spruce_fence', arm: 'east' })
  hang(SMOKE.x0 - 1, SF + 2, SMOKE.z0 + 1)
  hang(NCX, NF + 2, N.z1)
  hang(STAB.x0 + 4, TF + 2, STAB.z1)
  b.lampPost([CX + 3, ground(CX + 3, PZ1 + 2) + 1, PZ1 + 2], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall' })
  b.lampPost([60, ground(60, 46) + 1, 46], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall' })
  b.lampPost([X1 + 3, ground(X1 + 3, CZ + 2) + 1, CZ + 2], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall' })
  b.lampPost([NCX + 2, ground(NCX + 2, N.z0 - 2) + 1, N.z0 - 2], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall', arm: 'west' })

  // ================================================================ 8 CLEAN-UP
  // tall seagrass cut in half by rocks placed later falls back to the short plant
  for (const [x, y, z, blk] of [...b.entries()]) {
    if (blk.name !== 'minecraft:tall_seagrass') continue
    const lower = blk.props?.half === 'lower'
    const other = b.get(x, y + (lower ? 1 : -1), z)
    if (!other || other.name !== 'minecraft:tall_seagrass') b.set(x, y, z, lower ? 'seagrass' : 'water')
  }
  // isolated strays (conifer tips) that touch nothing, not even diagonally
  for (const [x, y, z] of [...b.entries()]) {
    let alone = true
    for (let dx = -1; dx <= 1 && alone; dx += 1) for (let dy = -1; dy <= 1 && alone; dy += 1) for (let dz = -1; dz <= 1 && alone; dz += 1)
      if ((dx || dy || dz) && b.has(x + dx, y + dy, z + dz)) alone = false
    if (alone && y > 0) b.remove(x, y, z)
  }

  return b.finish({ name: 'nordic-longhouse', description: 'Viking longhouse with a hogback roof, naust, smokehouse, stabbur, palisade and a moored longship on a fjord shore' })
}
