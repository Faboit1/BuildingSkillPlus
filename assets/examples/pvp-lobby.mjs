// DOJO LOBBY: a Japanese mountain-temple PvP / practice lobby on a floating island
//
// BRIEF (the spawn handbook's PvP-lobby archetype, references/spawns/README.md §2)
//   About 100 x 100 x 60. A temple precinct on a floating island over a misty void. Players
//   spawn on a raised wooden stage (a butai, like Kiyomizu-dera's) that looks north through a
//   great red torii into a sunken arena bowl (the FFA pit) and across it to the main temple,
//   the hero. Six queue shrines stand in an arc around the stage on the court below it
//   (Unranked, Ranked, FFA, Kit Editor, Events, Store). West of the court: the hall of fame
//   (Elo, Wins, Streak boards over a top-3 podium). East: two crate shrines and the start of a
//   parkour line that runs along the east cliff to a bell pavilion on the north-east crag.
//   The FFA drop is a gate on the arena's east rim.
//
// HOW IT AVOIDS THE "AI LOOK" (the §5 checklist, applied)
//   1. ONE HERO, THREE TIERS. The temple (two-tier roof, ~25 tall) > the arrival hall behind
//      the stage (~15) > the shrines (~9). Nothing else competes on the skyline.
//   2. THE FIRST VIEW IS COMPOSED. From the spawn (eye level, fov 70): the torii posts and tie
//      beam frame the picture 10 blocks out, the arena opens below, the temple sits 45 out on
//      the axis with sky behind it. Nothing tall stands in the central 30 degrees.
//   3. SYMMETRIC FRAME, ASYMMETRIC CONTENT. The stage, torii, arena and temple share the axis;
//      the six shrines do not mirror: each has its own footprint, roof form, height and props.
//   4. SHAPED FLOORS. Raked gravel fields with stone flag paths that lead to each shrine, moss
//      under trees, kerbs at every level change, a tatami pinwheel floor in the pit.
//   5. HAND-SHAPED CHERRIES. Each tree is authored (trunk line, 3-5 limbs, flat-bottomed leaf
//      pads at the limb tips), in three size classes, planted in groups with clearings.
//   6. HIDDEN LIGHT. Paper (froglight behind lattice), lanterns in stone toro and under eaves,
//      then b.spawnProof fills what is left with invisible light blocks.
//   7. ONE ACCENT. Red only on the torii, banners, the FFA gate and two points of the floor.
//
// LAYOUT (x east, z south; the axis is x = 50)
//   z  4-27   main temple on its stone platform (kidan), cherry crags NW and NE
//   z 32-56   the arena bowl: pit floor 13 deep below the rim, 3 rings of stands
//   z 57-79   rim, torii, the queue court with the six shrines, the spawn stage (x 45-55)
//   z 80-97   south terrace: the arrival hall behind the spawn
//   x 6-29    hall of fame (west wing)        x 70-94   crates + parkour start (east wing)
//
// Kit used: spawn kit (spawnPoint, npcSpot, leaderboards, crate, portal, region, sign,
// spawnProof), eastRoof (every roof except the workshop's shed), b.roof, b.curve, b.leafBlob,
// b.boulder, b.cloud, b.hangingLantern, kit.palette, kit.noise.

const SIZE = [100, 60, 100]
const M = 20 // main ground: the arena rim and the wings (players stand at 21)
const Q = 21 // queue court, one step above the rim
const D = 25 // the spawn stage and the south terrace
const T = 23 // temple platform (kidan) top; the temple's wooden floor sits on it at 24
const P = 13 // pit floor (the FFA fighting floor)
const AX = 50 // the main axis
const SPAWN = [AX, D, 66]

// ------------------------------------------------------------------------------ palette
const PLASTER = 'minecraft:calcite'
const POST = 'minecraft:dark_oak_log[axis=y]'
const BEAM = ax => `minecraft:stripped_dark_oak_log[axis=${ax}]`
const PAPER = 'minecraft:ochre_froglight' // lit shoji paper: the warm glow behind lattices
const SHOJI = f => `minecraft:jungle_trapdoor[facing=${f},open=true,half=bottom]`
const LATTICE = f => `minecraft:dark_oak_trapdoor[facing=${f},open=true,half=bottom]`
const RED = 'minecraft:red_terracotta' // the one accent: matte vermilion
const BLACK = 'minecraft:polished_blackstone'
const ROOF = { material: 'deepslate_tile', ribs: 'deepslate_brick', ridge: 'polished_blackstone', rafter: 'spruce' }
// small roofs (under ~12 across): one tile, no ribs, tile hips; a dark ridge would cluster at
// the corners and the ribs read as noise at this size
const SMALL = { material: 'deepslate_tile', ribs: null, ridge: 'deepslate_tile', rafter: 'spruce' }

const DIRS = [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]]
const VEC = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] }
const OPP = { east: 'west', west: 'east', north: 'south', south: 'north' }
const CCW = { north: 'west', west: 'south', south: 'east', east: 'north' }

export default function build(api) {
  const { kit } = api
  const b = api.builder(SIZE, { seed: 23 })
  const hash = (x, z, s = 0) => kit.noise.hash01(x, 0, z, s)
  const fbm = (x, z, scale, seed) => kit.noise.fbm2(x, z, { scale, seed })
  const clamp = (v, a, c) => Math.max(a, Math.min(c, v))

  const STONE = kit.palette({ stone_bricks: 6, mossy_stone_bricks: 3, cracked_stone_bricks: 1 }, { scale: 3, seed: 5 })
  const FOOT = kit.palette({ mossy_cobblestone: 3, cobblestone: 2, mossy_stone_bricks: 3, stone_bricks: 1 }, { scale: 2.5, seed: 6 })
  const GRAVEL_X = (x, z) => (x % 2 === 0 ? 'minecraft:gravel' : 'minecraft:light_gray_concrete_powder')
  const GRAVEL_Z = (x, z) => (z % 2 === 0 ? 'minecraft:gravel' : 'minecraft:light_gray_concrete_powder')
  // ishidatami: 2x2 flagstones in staggered rows, one grey per stone (not per block)
  const FLAG = (x, z) => {
    const row = Math.floor(z / 2)
    const col = Math.floor((x + (row % 2)) / 2)
    const h = kit.noise.hash01(col, 0, row, 7)
    return h < 0.4 ? 'minecraft:polished_andesite' : h < 0.75 ? 'minecraft:smooth_stone' : 'minecraft:andesite'
  }

  // Local frame for a facing place (the kit's convention): d = toward the visitor, u = across,
  // h = up from the base level. at(u, d, h) → world [x, y, z].
  const frameOf = ([px, py, pz], f) => {
    const F = VEC[f]
    const R = VEC[CCW[f]]
    return {
      f, back: OPP[f], left: CCW[f], right: OPP[CCW[f]],
      alongX: R[0] !== 0,
      at: (u, d, h = 0) => [px + R[0] * u + F[0] * d, py + h, pz + R[1] * u + F[1] * d],
      rect: (u0, d0, u1, d1) => {
        const a = [px + R[0] * u0 + F[0] * d0, pz + R[1] * u0 + F[1] * d0]
        const c = [px + R[0] * u1 + F[0] * d1, pz + R[1] * u1 + F[1] * d1]
        return { x0: Math.min(a[0], c[0]), z0: Math.min(a[1], c[1]), x1: Math.max(a[0], c[0]), z1: Math.max(a[1], c[1]) }
      },
    }
  }

  // ============================================================================ THE ISLAND
  // Footprint: a squircle (p = 3.2) so the corners carry the wings, with a wavy radius. edge()
  // is the distance (in blocks, roughly) to the cliff edge; it drives the underside depth.
  const CX = 50
  const CZ = 50
  const outlineR = (x, z) => {
    const th = Math.atan2(z - CZ, x - CX)
    return 47.2 + 1.6 * Math.sin(3 * th + 1.1) + 1.1 * Math.sin(5 * th + 0.4) + 1.8 * fbm(30 * Math.cos(th) + 60, 30 * Math.sin(th) + 60, 9, 3)
  }
  const rho = (x, z) => (Math.abs(x - CX) ** 3.2 + Math.abs(z - CZ) ** 3.2) ** (1 / 3.2)
  const edge = (x, z) => outlineR(x, z) - rho(x, z)

  // Arena geometry, needed by the ground: a rounded rectangle (Japanese plans are rectilinear).
  const BX = AX
  const BZ = 44
  const sdRR = (x, z, hx, hz, r) => {
    const qx = Math.abs(x - BX) - (hx - r)
    const qz = Math.abs(z - BZ) - (hz - r)
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r
  }
  const pitSd = (x, z) => sdRR(x, z, 7.5, 6.5, 3.5) // <= 0: the pit floor; 0..6 the stands; 6..9 the rim

  // Ground levels by zone. The main level is flat (gardens are shaped with objects, not with
  // 1-block mounds, which read as contour stripes). Height comes from rock masses built as
  // TIERS of flat-topped plateaus with wobbly edges: each tier step is a 3-block cliff of rock
  // strata, so crags read as layered stone with ledges, never as concentric lines.
  const inCourt = (x, z) => x >= 27 && x <= 73 && z >= 60 && z <= 81
  const southTerrace = (x, z) => x >= 33 && x <= 67 && z >= 82 + Math.round(1.2 * Math.sin(x / 4.5))
  const tier = (x, z, cx, cz, rx, rz, h, seed) => {
    const w = 1 + 0.3 * fbm(x, z, 4.5, seed)
    return Math.hypot((x - cx) / rx, (z - cz) / rz) <= w ? h : 0
  }
  // A crag: tiers that shrink AWAY from its steep side, so on that side the tier edges line up
  // into one tall cliff face of strata, and on the far side the rock steps down in ledges.
  // [cx, cz, steepX, steepZ, [[rx, rz, h], ...], seed]
  const CRAG_DEFS = [
    [50, 1, 0, 1, [[30, 5, 4], [19, 3.5, 7], [9, 2.5, 9]], 41], // north ridge behind the temple
    [14, 19, 0.75, 0.66, [[15, 14, 3], [12, 11, 6], [9, 8, 9], [6, 5.5, 12], [3, 3, 14]], 44], // NW crag (bell)
    [83, 19, -0.7, 0.7, [[12, 14, 3], [9.5, 11, 6], [7, 8, 9], [4.5, 5, 12]], 48], // NE crag (parkour finish)
  ]
  const CRAGS = []
  for (const [cx, cz, sx, sz, tiers, seed] of CRAG_DEFS) {
    const [r0x, r0z] = tiers[0]
    tiers.forEach(([rx, rz, h], k) => CRAGS.push([cx - sx * (r0x - rx) * 0.85, cz - sz * (r0z - rz) * 0.85, rx, rz, h, seed + k]))
  }
  const TERRACES = [
    // south-west and south-east garden terraces (stone retaining walls, not rock)
    [19, 93, 15, 8, 2, 52], [22, 96, 9, 5, 4, 53], [81, 93, 15, 8, 2, 54], [78, 96, 9, 5, 4, 55],
  ]
  const cragH = (x, z) => Math.max(0, ...CRAGS.map(c => tier(x, z, ...c)))
  const terraceH = (x, z) => Math.max(0, ...TERRACES.map(c => tier(x, z, ...c)))
  const groundY = (x, z) => {
    if (pitSd(x, z) <= 9) return M
    if (southTerrace(x, z)) return D
    if (inCourt(x, z)) return Q
    if (x >= 30 && x <= 70 && z >= 6 && z <= 28) return M // the temple's ground
    return M + Math.max(cragH(x, z), terraceH(x, z))
  }

  // Rock strata for cliffs and the underside: bands 2-4 thick, darker toward the bottom.
  const BANDS = ['minecraft:stone', 'minecraft:andesite', 'minecraft:tuff', 'minecraft:stone', 'minecraft:andesite', 'minecraft:cobbled_deepslate', 'minecraft:tuff', 'minecraft:deepslate']
  const rock = (x, y, z) => {
    const k = Math.floor((y + 2.2 * fbm(x, z, 12, 21)) / 3)
    if (y < 7 && hash(x * 7 + y, z, 4) < 0.5) return 'minecraft:deepslate'
    return BANDS[((k % BANDS.length) + BANDS.length) % BANDS.length]
  }
  // The underside: a cliff band of 5-8 under the rim that leans inward (overhangs), then an
  // inverted mountain, then rock roots hanging into the void (added below).
  const top = new Map() // x,z → ground top
  for (let x = 0; x < SIZE[0]; x += 1) {
    for (let z = 0; z < SIZE[2]; z += 1) {
      const e = edge(x, z)
      if (e < 0) continue
      const gy = groundY(x, z)
      top.set(`${x},${z}`, gy)
      const lump = 3 * fbm(x, z, 6, 11) + 4 * Math.max(0, fbm(x, z, 3.5, 12))
      const depth = e < 0.8 ? 3 + lump * 0.5 : 6 + 1.15 * Math.min(e, 22) ** 0.95 + lump
      const bottom = Math.max(3, Math.round(M - depth))
      const terrace = terraceH(x, z) > 0 && gy > M
      for (let y = bottom; y <= gy; y += 1) {
        const d = gy - y
        let paint
        if (d === 0) paint = 'minecraft:grass_block'
        else if (terrace && y > M) paint = y === gy - 1 && hash(x, z, 77) < 0.3 ? 'minecraft:mossy_stone_bricks' : FOOT
        else if (d <= 2 && e > 1.5 && gy <= M + 1) paint = 'minecraft:dirt'
        else paint = rock(x, y, z)
        b.set(x, y, z, paint)
      }
    }
  }
  const G = (x, z) => top.get(`${x},${z}`) ?? -1
  // Rock roots: tapering spikes hanging from the underside, leaning a little, with strata.
  const ROOTS = [[38, 40, 14, 4.5], [58, 52, 18, 5.5], [47, 64, 12, 4], [30, 58, 10, 3.5], [66, 36, 11, 4], [52, 30, 9, 3.5], [72, 62, 8, 3], [26, 34, 8, 3], [44, 50, 20, 6]]
  for (const [rx, rz, len, r0] of ROOTS) {
    let yTop = M
    while (yTop > 0 && b.has(rx, yTop - 1, rz)) yTop -= 1
    const lean = [(hash(rx, rz, 3) - 0.5) * 0.25, (hash(rz, rx, 4) - 0.5) * 0.25]
    for (let k = 0; k <= len; k += 1) {
      const y = yTop - k + 2
      if (y < 0) break
      const t = 1 - k / len
      const r = r0 * t ** 0.75
      const cx = rx + lean[0] * k
      const cz = rz + lean[1] * k
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x += 1)
        for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z += 1) {
          if (Math.hypot(x - cx, z - cz) <= r * (1 + 0.25 * fbm(x + y, z, 3, 61)) && !b.has(x, y, z)) b.set(x, y, z, rock(x, y, z))
        }
    }
  }
  // the grass top: clumps of moss, coarse dirt on the windy cliff rim
  for (const [k, gy] of top) {
    const [x, z] = k.split(',').map(Number)
    if (b.nameAt(x, gy, z) !== 'minecraft:grass_block') continue
    const e = edge(x, z)
    if (e < 1.6) b.set(x, gy, z, hash(x, z, 8) < 0.5 ? 'minecraft:coarse_dirt' : 'minecraft:moss_block')
    else if (kit.noise.coherent01(x, 0, z, { scale: 5, grain: 0.3, seed: 31 }) < 0.3) b.set(x, gy, z, 'minecraft:moss_block')
  }
  // Vines and hanging roots on the cliff band and the underside: strands 2-7 long, in clumps,
  // only where rock has open air beside or below it.
  {
    const cells = []
    for (const [x, y, z, blk] of b.entries()) if (y < M - 1 && y > 2 && /stone|andesite|tuff|deepslate|dirt/.test(blk.name)) cells.push([x, y, z])
    for (const [x, y, z] of cells) {
      const clump = kit.noise.coherent01(x, y, z, { scale: 6, seed: 71 })
      if (clump > 0.35) continue
      if (!b.has(x, y - 1, z) && hash(x * 3 + y, z, 72) < 0.18) {
        const len = 1 + Math.floor(hash(x, z + y, 73) * 3)
        for (let i = 1; i <= len && !b.has(x, y - i, z); i += 1) b.set(x, y - i, z, 'minecraft:hanging_roots')
        continue
      }
      for (const [side, dx, dz] of DIRS) {
        if (b.has(x + dx, y, z + dz) || hash(x + dx * 5, y, z + dz * 7, 74) > 0.22) continue
        const len = 2 + Math.floor(hash(x, y, z, 75) * 6)
        for (let i = 0; i < len; i += 1) {
          if (b.has(x + dx, y - i, z + dz) || !b.has(x, y - i, z)) break
          b.set(x + dx, y - i, z + dz, `minecraft:vine[${OPP[side]}=true]`)
        }
      }
    }
  }

  // ============================================================================ ARENA BOWL
  // Pit floor 7 below the rim, then three rings of stands (2 wide, 1 high: a stone footrest
  // and a wooden bench), then the rim. A parapet stops spectators from falling in: the way
  // into the FFA is the drop gate on the east rim.
  const ringTop = sd => (sd <= 0 ? P : sd <= 2 ? M - 3 : sd <= 4 ? M - 2 : sd <= 6 ? M - 1 : M)
  const aisle = (x, z) => (Math.abs(x - BX) <= 1 && z !== BZ) || (Math.abs(z - BZ) <= 1 && x !== BX)
  for (let x = 30; x <= 70; x += 1) {
    for (let z = 26; z <= 62; z += 1) {
      const sd = pitSd(x, z)
      if (sd > 6) continue
      const ty = ringTop(sd)
      b.clear([x, ty + 1, z], [x, M + 4, z])
      let paint
      if (sd <= 0) paint = 'minecraft:stone' // the tatami goes on later
      else {
        const inner = sd - 2 * Math.ceil(sd / 2) + 2 <= 1 // first block of each 2-wide ring
        paint = inner ? 'minecraft:polished_andesite' : 'minecraft:spruce_planks'
      }
      for (let y = ty; y >= P - 2; y -= 1) b.set(x, y, z, y === ty ? paint : y > P && sd > 0 ? STONE : 'minecraft:stone')
    }
  }
  // aisles: a stair on each bench row where an aisle climbs (the four axis directions)
  for (let x = 30; x <= 70; x += 1) {
    for (let z = 26; z <= 62; z += 1) {
      const sd = pitSd(x, z)
      if (sd <= 1 || sd > 6 || !aisle(x, z)) continue
      const ty = ringTop(sd)
      // climbing outward: facing = the side away from the centre along the aisle
      const f = Math.abs(x - BX) <= 1 ? (z > BZ ? 'south' : 'north') : (x > BX ? 'east' : 'west')
      const [dx, dz] = VEC[f]
      if (ringTop(pitSd(x + dx, z + dz)) > ty) {
        b.set(x, ty, z, 'minecraft:polished_andesite')
        b.set(x, ty + 1, z, `minecraft:stone_brick_stairs[facing=${f}]`)
      }
    }
  }
  // parapet on the front row (ring 1, first block), a stone kerb on the rim
  for (let x = 30; x <= 70; x += 1) {
    for (let z = 26; z <= 62; z += 1) {
      const sd = pitSd(x, z)
      if (sd > 0 && sd <= 1) b.set(x, M - 2, z, 'minecraft:stone_brick_wall')
      if (sd > 6 && sd <= 7) b.set(x, M, z, 'minecraft:polished_andesite')
    }
  }
  // Pit floor: light "sand" (calcite and white concrete powder in clumps) inside a dark wooden
  // border. The fighting square is drawn in dark oak, red marks only at its corners and the two
  // start lines (runs of 3), and a black ring with a red centre marks the FFA spawn.
  const SAND = kit.palette({ calcite: 3, white_concrete_powder: 2 }, { scale: 2.2, seed: 9 })
  for (let x = 40; x <= 60; x += 1) {
    for (let z = 34; z <= 54; z += 1) {
      const sd = pitSd(x, z)
      if (sd > 0) continue
      const dx = x - BX
      const dz = z - BZ
      let paint = SAND
      if (sd > -1) paint = 'minecraft:dark_oak_planks'
      else if ((Math.abs(dx) === 5 && Math.abs(dz) <= 4) || (Math.abs(dz) === 4 && Math.abs(dx) <= 5)) {
        const corner = Math.abs(dx) >= 4 && Math.abs(dz) >= 3
        paint = corner ? RED : Math.abs(dx) === 5 ? 'minecraft:stripped_dark_oak_log[axis=z]' : 'minecraft:stripped_dark_oak_log[axis=x]'
      } else if (Math.abs(dx) === 2 && Math.abs(dz) <= 1) paint = RED
      b.set(x, P, z, paint)
    }
  }
  for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) b.set(BX + dx, P, BZ + dz, dx || dz ? BLACK : RED)
  // pit lighting: lanterns in niches in the pit wall (each niche a dark recess with a lantern)
  for (const [x, z] of [[43, 37], [57, 37], [43, 51], [57, 51], [50, 37], [50, 51], [42, 44], [58, 44]]) {
    const [nx, nz] = x === 42 ? [-1, 0] : x === 58 ? [1, 0] : z === 37 ? [0, -1] : z === 51 ? [0, 1] : [0, 0]
    const wx = x + nx
    const wz = z + nz
    if (pitSd(wx, wz) > 0) {
      b.set(wx, P + 2, wz, 'minecraft:lantern[hanging=false]')
      b.set(wx, P + 1, wz, BLACK)
    }
  }
  b.region('ffa-pit', [43, P + 1, 38], [57, P + 8, 50], { pvp: 'allow', 'mob-spawning': 'deny', 'fall-damage': 'deny', priority: 20, 'greeting-title': 'FFA' })

  // ============================================================================ THE RIM WALK
  // The ring around the bowl at M: flagstones on the axes, raked gravel between.
  for (let x = 26; x <= 74; x += 1) {
    for (let z = 22; z <= 64; z += 1) {
      const sd = pitSd(x, z)
      if (sd <= 7 || sd > 10 || inCourt(x, z)) continue
      if (G(x, z) !== M) continue
      b.set(x, M, z, aisle(x, z) || Math.abs(x - BX) <= 2 ? FLAG(x, z) : sd > 9 ? 'minecraft:polished_andesite' : (Math.abs(x - BX) > Math.abs(z - BZ) ? GRAVEL_Z(x, z) : GRAVEL_X(x, z)))
    }
  }

  // ============================================================================ QUEUE COURT
  // One step above the rim, kerbed in polished andesite. Field: raked gravel (furrows along x);
  // paths of flagstones are drawn later from the stage stairs to each shrine.
  for (let x = 27; x <= 73; x += 1) {
    for (let z = 60; z <= 81; z += 1) {
      if (!inCourt(x, z) || G(x, z) !== Q) continue
      const kerb = x === 27 || x === 73 || z === 60
      b.set(x, Q, z, kerb ? 'minecraft:polished_andesite' : GRAVEL_X(x, z))
    }
  }

  // walkways: a flagstone landing at the stair foot and 4-wide flag walks along the stage's
  // sides, the worn routes to the shrines; the gravel field stays round the shrines
  for (let x = 41; x <= 59; x += 1) for (let z = 60; z <= 79; z += 1) {
    const side = (x >= 41 && x <= 44) || (x >= 56 && x <= 59)
    const landing = z <= 61
    if ((side || landing) && G(x, z) === Q) b.set(x, Q, z, FLAG(x, z))
  }

  // ============================================================================ SOUTH TERRACE
  // Ishigaki: a battered retaining wall of mossy stone along the terrace's north edge (4 high,
  // stepping back 1 every 2 rows), capped with polished andesite.
  for (let x = 33; x <= 67; x += 1) {
    let zf = 99
    for (let z = 76; z <= 90; z += 1) if (southTerrace(x, z)) { zf = z; break }
    for (let y = Q + 1; y <= D; y += 1) {
      const back = Math.floor((y - Q - 1) / 2) // batter
      for (let z = zf - 2 + back; z < zf; z += 1) b.set(x, y, z, y === D ? 'minecraft:polished_andesite' : y <= Q + 2 ? FOOT : STONE)
    }
    for (let z = zf; z <= 97; z += 1) if (G(x, z) === D) b.set(x, D, z, FLAG(x, z))
  }

  // ============================================================================ SPAWN STAGE
  // A wooden butai on a lattice of posts (kakezukuri), x 45-55, z 65-79, floor at D. Boards run
  // north-south toward the view; a dark border; the spawn crest is a ring inlaid in the boards.
  const SX0 = 46
  const SX1 = 54
  const SZ0 = 65
  const SZ1 = 81
  for (let x = SX0; x <= SX1; x += 1) {
    for (let z = SZ0; z <= SZ1; z += 1) {
      const border = x === SX0 || x === SX1 || z === SZ0
      const ring = Math.abs(Math.hypot(x - SPAWN[0], z - SPAWN[2]) - 2) < 0.5
      b.set(x, D, z, border ? 'minecraft:dark_oak_planks' : ring ? 'minecraft:stripped_dark_oak_log[axis=z]' : 'minecraft:stripped_spruce_log[axis=z]')
      if (z <= 79) b.clear([x, Q + 1, z], [x, D - 1, z])
    }
  }
  // the lattice under the stage: posts on stone footings, tie beams (nuki) both ways
  const SPX = [46, 49, 51, 54]
  const SPZ = [65, 69, 73, 77]
  for (const x of SPX) for (const z of SPZ) {
    b.set(x, Q, z, 'minecraft:polished_andesite')
    b.box([x, Q + 1, z], [x, D - 1, z], POST)
  }
  for (const z of SPZ) for (let x = SX0; x <= SX1; x += 1) if (!SPX.includes(x)) b.set(x, Q + 2, z, BEAM('x'))
  for (const x of SPX) for (let z = SZ0; z <= 79; z += 1) if (!SPZ.includes(z)) b.set(x, Q + 2, z, BEAM('z'))
  // the front stair down to the court: 7 wide, spruce treads on stone, cheek walls
  for (let i = 0; i < 4; i += 1) {
    const z = 61 + i
    for (let x = 47; x <= 53; x += 1) {
      b.box([x, Q, z], [x, Q + i, z], 'minecraft:stone_bricks')
      b.set(x, Q + 1 + i, z, 'minecraft:spruce_stairs[facing=south]')
    }
    for (const x of [46, 54]) b.box([x, Q, z], [x, Q + 1 + i, z], STONE)
  }
  // koran: a low railing along the sides and the front corners, open at the stair
  for (let z = SZ0; z <= 79; z += 1) for (const x of [SX0, SX1]) b.set(x, D + 1, z, 'minecraft:dark_oak_fence')
  for (const x of [46, 54]) b.set(x, D + 1, SZ0, 'minecraft:dark_oak_fence')
  for (const [x, z] of [[SX0, SZ0], [SX1, SZ0], [SX0, 72], [SX1, 72], [SX0, 79], [SX1, 79]]) {
    b.set(x, D + 1, z, POST)
    b.set(x, D + 2, z, 'minecraft:dark_oak_slab[type=bottom]')
  }

  // ============================================================================ TORII
  // An o-torii on the arena rim, 9 out from the spawn: its posts and tie beam frame the first
  // view, the temple sits inside the opening. Posts 1 wide x 2 deep (slim from the front, solid
  // from the side) on black feet (nemaki); the nuki pokes past the posts with wedges; a black
  // kasagi with upturned ends tops it. Red (the accent) only here, on banners, the FFA gate and
  // the pit crest.
  {
    const z0 = 57
    for (const x of [43, 57]) {
      for (const z of [z0, z0 + 1]) {
        b.box([x, M + 1, z], [x, M + 2, z], BLACK)
        b.box([x, M + 3, z], [x, M + 14, z], RED)
      }
      for (const [dx, dz, f] of [[-1, 0, 'east'], [1, 0, 'west'], [0, -1, 'south'], [0, 2, 'north']]) {
        if (dz) b.set(x, M + 1, z0 + dz, `minecraft:polished_blackstone_stairs[facing=${f}]`)
        else for (const z of [z0, z0 + 1]) b.set(x + dx, M + 1, z, `minecraft:polished_blackstone_stairs[facing=${f}]`)
      }
    }
    for (let x = 41; x <= 59; x += 1) b.set(x, M + 12, z0, RED) // nuki
    for (const x of [41, 59]) b.set(x, M + 12, z0 + 1, `minecraft:mangrove_stairs[facing=${x < 50 ? 'east' : 'west'},half=top]`) // wedges
    b.set(AX, M + 13, z0, BLACK) // gakuzuka strut
    for (let x = 42; x <= 58; x += 1) b.set(x, M + 14, z0, RED) // shimaki
    for (let x = 40; x <= 60; x += 1) for (const z of [z0, z0 + 1]) b.set(x, M + 15, z, Math.abs(x - AX) >= 9 ? 'minecraft:polished_blackstone_slab[type=top]' : BLACK) // kasagi
    for (let x = 41; x <= 59; x += 1) for (const z of [z0, z0 + 1]) if (Math.abs(x - AX) >= 8) b.set(x, M + 16, z, 'minecraft:polished_blackstone_slab[type=bottom]')
    for (const [x, f] of [[39, 'west'], [61, 'east']]) for (const z of [z0, z0 + 1]) {
      b.set(x, M + 16, z, `minecraft:polished_blackstone_stairs[facing=${OPP[f]},half=bottom]`)
    }
  }

  // ============================================================================ THE TEMPLE (HERO)
  // A two-tier hall like Horyu-ji's kondo: a pent skirt (mokoshi) wraps the ground storey, the
  // main body rises above it carrying the name board, and a big irimoya roof with deep eaves
  // and lifted corners crowns it. 45 blocks out from the spawn on the axis.
  const TK = { x0: 31, z0: 7, x1: 69, z1: 27 } // kidan (stone platform)
  const TO = { x0: 34, z0: 10, x1: 66, z1: 24 } // mokoshi posts (outer ring)
  const TB = { x0: 37, z0: 13, x1: 63, z1: 21 } // main body walls
  const TF = T + 1 // wooden floor
  {
    // kidan: battered stone, mossy at the foot, andesite cap; front stair from the rim
    for (let x = TK.x0; x <= TK.x1; x += 1) {
      for (let z = TK.z0; z <= TK.z1; z += 1) {
        const rim = x === TK.x0 || x === TK.x1 || z === TK.z0 || z === TK.z1
        for (let y = M - 3; y <= T; y += 1) b.set(x, y, z, y === T ? (rim ? 'minecraft:polished_andesite' : 'minecraft:stone') : y <= M ? FOOT : STONE)
        b.clear([x, T + 1, z], [x, T + 6, z])
      }
    }
    for (let x = 45; x <= 55; x += 1) {
      for (let i = 0; i < 3; i += 1) {
        const z = 30 - i
        b.box([x, M, z], [x, M + i, z], 'minecraft:stone_bricks')
        b.set(x, M + 1 + i, z, 'minecraft:stone_brick_stairs[facing=north]')
      }
    }
    for (const x of [44, 56]) for (let i = 0; i < 3; i += 1) b.box([x, M, 30 - i], [x, M + 1 + i, 30 - i], STONE)
    // floor: spruce veranda round a dark-oak hall floor
    b.box([TK.x0 + 1, TF, TK.z0 + 1], [TK.x1 - 1, TF, TK.z1 - 1], 'minecraft:spruce_planks')
    b.box([TB.x0 + 1, TF, TB.z0 + 1], [TB.x1 - 1, TF, TB.z1 - 1], 'minecraft:dark_oak_planks')
    for (let x = 45; x <= 55; x += 1) b.set(x, TF, TK.z1, 'minecraft:spruce_stairs[facing=north]')
  }
  const MAIN_TOP = TF + 13 // top beam of the main body (37)
  {
    // main body: posts at the corners and bays, plaster frieze, lit shoji below the skirt
    const BXS = [37, 40, 44, 47, 53, 56, 60, 63]
    const BZS = [13, 17, 21]
    for (let y = TF + 1; y <= MAIN_TOP; y += 1) {
      for (let x = TB.x0; x <= TB.x1; x += 1) for (const z of [TB.z0, TB.z1]) {
        const post = BXS.includes(x)
        const r = y - TF
        let paint = PLASTER
        if (post) paint = POST
        else if (y === MAIN_TOP || r === 7) paint = BEAM('x')
        else if (r <= 4 && z === TB.z1) paint = r === 4 ? BEAM('x') : PAPER
        else if (r === 1) paint = 'minecraft:dark_oak_planks'
        b.set(x, y, z, paint)
        if (!post && r <= 3 && z === TB.z1) b.set(x, y, z + 1, SHOJI('south'))
      }
      for (let z = TB.z0 + 1; z < TB.z1; z += 1) for (const x of [TB.x0, TB.x1]) {
        const r = y - TF
        b.set(x, y, z, BZS.includes(z) ? POST : y === MAIN_TOP || r === 7 ? BEAM('z') : r === 1 ? 'minecraft:dark_oak_planks' : PLASTER)
      }
    }
    b.box([TB.x0 + 1, MAIN_TOP, TB.z0 + 1], [TB.x1 - 1, MAIN_TOP, TB.z1 - 1], 'minecraft:dark_oak_planks') // ceiling
    // outer ring of the skirt: posts, a beam, and lattice walls on the back and sides
    const OXS = [34, 37, 41, 45, 48, 52, 55, 59, 63, 66]
    const OZS = [10, 14, 17, 21, 24]
    const skirtTop = TF + 5
    for (let x = TO.x0; x <= TO.x1; x += 1) for (const z of [TO.z0, TO.z1]) {
      if (OXS.includes(x)) b.box([x, TF + 1, z], [x, skirtTop, z], POST)
      else {
        b.set(x, skirtTop, z, BEAM('x'))
        if (z === TO.z0) b.box([x, TF + 1, z], [x, skirtTop - 1, z], (x + 1) % 2 ? PLASTER : PLASTER)
      }
    }
    for (let z = TO.z0; z <= TO.z1; z += 1) for (const x of [TO.x0, TO.x1]) {
      if (OZS.includes(z)) b.box([x, TF + 1, z], [x, skirtTop, z], POST)
      else {
        b.set(x, skirtTop, z, BEAM('z'))
        b.set(x, TF + 1, z, 'minecraft:dark_oak_planks')
        b.box([x, TF + 2, z], [x, skirtTop - 2, z], PAPER)
        b.set(x + (x === TO.x0 ? -1 : 1), TF + 3, z, SHOJI(x === TO.x0 ? 'west' : 'east'))
        b.set(x, skirtTop - 1, z, PLASTER)
      }
    }
    // the skirt roof: a hip ring that stops at the main body (stopAt), long slab brim
    const skirt = b.eastRoof({ ...ROOF, x0: TO.x0, z0: TO.z0, x1: TO.x1, z1: TO.z1, y: skirtTop + 1, type: 'hip', overhang: 2, lift: 1, pitch: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1], stopAt: [TB.x0, TB.z0, TB.x1, TB.z1], brackets: { every: 4 }, lanterns: true })
    // the main roof: irimoya, overhang 4, corner lift 2, brackets at every post
    const main = b.eastRoof({ ...ROOF, x0: TB.x0, z0: TB.z0, x1: TB.x1, z1: TB.z1, y: MAIN_TOP + 1, type: 'irimoya', axis: 'x', overhang: 4, lift: 2,
      pitch: [0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1, 1], gable: PLASTER, gableBeam: BEAM('z'), barge: true, brackets: { every: 4 }, lanterns: true })
    b.temple = { skirt, main }
    // the name board: block letters on the main body's front, framed like a hengaku
    b.sign('DOJO', [AX, MAIN_TOP - 2, TB.z1 + 1], 'south', { align: 'center', font: 'medium', block: 'minecraft:quartz_block', board: 'minecraft:dark_oak_planks', frame: BLACK, pad: 0, boardDepth: 1 })
  }

  // ============================================================================ ARRIVAL HALL
  // Behind the spawn: the secondary building. Open to the stage (the players come out of it),
  // an irimoya with a softer lift, its own stone base.
  {
    const H = { x0: 42, z0: 84, x1: 58, z1: 92 }
    const HF = D + 1
    for (let x = H.x0 - 2; x <= H.x1 + 2; x += 1) for (let z = H.z0 - 2; z <= H.z1 + 2; z += 1) {
      b.set(x, D, z, x === H.x0 - 2 || x === H.x1 + 2 || z === H.z0 - 2 || z === H.z1 + 2 ? 'minecraft:polished_andesite' : 'minecraft:stone_bricks')
      b.set(x, HF, z, 'minecraft:spruce_planks')
    }
    for (let x = H.x0 - 2; x <= H.x1 + 2; x += 1) b.set(x, HF, H.z0 - 2, 'minecraft:spruce_stairs[facing=south]')
    const XS = [42, 46, 50, 54, 58]
    const top = HF + 6
    for (let y = HF + 1; y <= top; y += 1) {
      for (let x = H.x0; x <= H.x1; x += 1) for (const z of [H.z0, H.z1]) {
        const post = XS.includes(x)
        if (z === H.z0 && !post && y < top - 1 && x > 46 && x < 54) continue // open centre bays
        b.set(x, y, z, post ? POST : y === top || y === top - 2 ? BEAM('x') : z === H.z0 ? PAPER : PLASTER)
        if (z === H.z0 && !post && y < top - 2 && y > HF + 1) b.set(x, y, z - 1, SHOJI('north'))
      }
      for (let z = H.z0 + 1; z < H.z1; z += 1) for (const x of [H.x0, H.x1]) b.set(x, y, z, z === 88 ? POST : y === top || y === top - 2 ? BEAM('z') : PLASTER)
    }
    b.box([H.x0 + 1, top, H.z0 + 1], [H.x1 - 1, top, H.z1 - 1], 'minecraft:dark_oak_planks')
    b.eastRoof({ ...ROOF, x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: top + 1, type: 'irimoya', axis: 'x', overhang: 3, lift: 1.5,
      pitch: [0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1], gable: PLASTER, gableBeam: BEAM('z'), barge: true, brackets: { every: 4 }, lanterns: true })
  }

  // ============================================================================ STONE LANTERNS
  // Toro light the routes. Small: base, wall-post shaft, platform slab, lantern, slab cap.
  // Kasuga (large): stair-flared foot and fire box, a 3 x 3 stair umbrella with a jewel on top.
  const smallToro = (x, y, z) => {
    b.set(x, y, z, 'minecraft:polished_andesite')
    b.set(x, y + 1, z, 'minecraft:andesite_wall')
    b.set(x, y + 2, z, 'minecraft:polished_andesite_slab[type=top]')
    b.set(x, y + 3, z, 'minecraft:lantern[hanging=false]')
    b.set(x, y + 4, z, 'minecraft:andesite_slab[type=bottom]')
  }
  const kasa = (cx, y, cz) => {
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
      if (!dx && !dz) { b.set(cx, y, cz, 'minecraft:polished_andesite'); continue }
      const f = Math.abs(dx) >= Math.abs(dz) ? (dx < 0 ? 'east' : 'west') : (dz < 0 ? 'south' : 'north')
      b.set(cx + dx, y, cz + dz, `minecraft:andesite_stairs[facing=${f}]`)
    }
    b.set(cx, y + 1, cz, 'minecraft:stone_button[face=floor,facing=north]')
  }
  const bigToro = (cx, y, cz) => {
    b.set(cx, y, cz, 'minecraft:polished_andesite')
    for (const [f, dx, dz] of DIRS) b.set(cx - dx, y, cz - dz, `minecraft:andesite_stairs[facing=${f}]`)
    b.set(cx, y + 1, cz, 'minecraft:andesite_wall')
    b.set(cx, y + 2, cz, 'minecraft:polished_andesite_slab[type=top]')
    for (const [f, dx, dz] of DIRS) b.set(cx - dx, y + 2, cz - dz, `minecraft:andesite_stairs[facing=${f},half=top]`)
    b.set(cx, y + 3, cz, 'minecraft:lantern[hanging=false]')
    kasa(cx, y + 4, cz)
  }
  // nobori: a tall festival flag (red banner on a dark pole), the accent at distance
  const nobori = (x, y, z, rot = 0) => {
    b.box([x, y, z], [x, y + 3, z], 'minecraft:dark_oak_fence')
    b.set(x, y + 4, z, `minecraft:red_banner[rotation=${rot}]`)
  }

  // ============================================================================ QUEUE SHRINES
  // Six small shrines round the stage, each facing the walkway (and its NPC turned to look at
  // the spawn). Shared: a stone platform 1 above the court (the NPC's +1 plinth), the NPC
  // standing in front of the open front bay under open sky (its hologram column stays clear),
  // posts and beams in dark oak. Different: footprint, post height, roof form and material,
  // walls, and 3+ props that tell what the place is for.
  const shrine = spec => {
    const { id, label, role, npc: [nx, nz], facing, width = 5, depth = 4, posts = 4, base = 0 } = spec
    const F = Q + 1 + base
    const L = frameOf([nx, F, nz], facing)
    const hw = Math.floor(width / 2)
    const dF = -2
    const dB = dF - depth + 1
    const W = (u, d, h, p, o) => { const [x, y, z] = L.at(u, d, h); b.set(x, y, z, p, o) }
    const axU = L.alongX ? 'x' : 'z'
    const axD = L.alongX ? 'z' : 'x'
    // platform with a stepped front; footing down to the court
    for (let u = -hw - 1; u <= hw + 1; u += 1) for (let d = dB - 1; d <= 1; d += 1) {
      const [x, , z] = L.at(u, d)
      b.box([x, Q - 1, z], [x, F - 1, z], FOOT)
      const rim = Math.abs(u) === hw + 1 || d === dB - 1 || d === 1
      const inside = Math.abs(u) < hw && d < dF && d > dB
      b.set(x, F, z, inside ? spec.floor ?? 'minecraft:dark_oak_planks' : rim ? 'minecraft:polished_andesite' : 'minecraft:stone_bricks')
      b.clear([x, F + 1, z], [x, F + posts + 8, z])
    }
    for (let u = -1; u <= 1; u += 1) W(u, 1, 0, `minecraft:stone_brick_stairs[facing=${L.back}]`)
    if (base) for (let u = -1; u <= 1; u += 1) { W(u, 2, -base, `minecraft:stone_brick_stairs[facing=${L.back}]`); W(u, 1, 0, 'minecraft:stone_bricks') }
    // the apron: worn flagstones from the walkway to the NPC
    for (let u = -2; u <= 2; u += 1) for (let d = 2; d <= 4; d += 1) {
      const [x, , z] = L.at(u, d)
      if (G(x, z) === Q && inCourt(x, z) && (Math.abs(u) < 2 || hash(x, z, 5) < 0.5)) b.set(x, Q, z, FLAG(x, z))
    }
    // frame: corner posts, top beams round the wall line
    for (const u of [-hw, hw]) for (const d of [dF, dB]) for (let h = 1; h <= posts; h += 1) W(u, d, h, POST)
    for (let u = -hw + 1; u < hw; u += 1) for (const d of [dF, dB]) W(u, d, posts, BEAM(axU))
    for (let d = dB + 1; d < dF; d += 1) for (const u of [-hw, hw]) W(u, d, posts, BEAM(axD))
    // back wall
    for (let u = -hw + 1; u < hw; u += 1) for (let h = 1; h < posts; h += 1) {
      if (spec.back === 'shoji') { W(u, dB, h, h === 1 ? 'minecraft:dark_oak_planks' : PAPER); if (h > 1) W(u, dB + 1, h, SHOJI(L.f)) }
      else if (spec.back === 'scroll') W(u, dB, h, u === 0 && h > 1 ? (h === 2 ? RED : 'minecraft:dark_oak_planks') : h === 1 ? 'minecraft:dark_oak_planks' : PLASTER)
      else if (spec.back === 'shelves') W(u, dB, h, h === 1 ? 'minecraft:barrel[facing=up,open=false]' : h === 2 ? 'minecraft:spruce_slab[type=top]' : 'minecraft:chiseled_bookshelf[facing=' + L.f + ']')
      else W(u, dB, h, h === 1 ? 'minecraft:dark_oak_planks' : PLASTER)
    }
    // side walls
    for (let d = dB + 1; d < dF; d += 1) for (const u of [-hw, hw]) for (let h = 1; h < posts; h += 1) {
      if (spec.sides === 'open') { if (h === 1) W(u, d, h, 'minecraft:dark_oak_fence') }
      else if (spec.sides === 'lattice') W(u, d, h, h === 1 ? 'minecraft:dark_oak_planks' : LATTICE(u < 0 ? L.right : L.left))
      else W(u, d, h, h === 1 ? 'minecraft:dark_oak_planks' : PLASTER)
    }
    // roof
    const rect = L.rect(-hw, dB, hw, dF)
    const ry = F + posts + 1
    const r = spec.roof
    let roof
    if (r.type === 'shed') {
      roof = b.roof({ ...rect, y: ry, type: 'shed', rises: L.back, material: r.material, overhang: 1, gableOverhang: 1, gable: r.gable, eaveTrim: true })
    } else {
      const axis = r.axis ? (r.axis === 'u' ? axU : axD) : undefined
      roof = b.eastRoof({ ...SMALL, ...r, ...rect, y: ry, axis, finial: undefined })
      if (r.finial && roof.apex) {
        // the apex can be a bottom slab (x.5 level): make it a block so the finial sits on it
        const [ax, ay, az] = roof.apex
        if (/_slab/.test(b.nameAt(ax, ay, az) ?? '')) b.set(ax, ay, az, 'minecraft:deepslate_tiles')
        r.finial.forEach((p, k) => b.set(ax, ay + 1 + k, az, p))
      }
    }
    // the NPC place and its record; the NPC turns to look at the spawn
    const rec = b.npcSpot(L.at(0, 0, 0), facing, { style: 'none', id, label, role })
    rec.yaw = Math.round((Math.atan2(-(SPAWN[0] - nx), SPAWN[2] - nz) * 180) / Math.PI)
    spec.props?.({ W, L, F, hw, dB, dF, posts, roof })
    return { L, F, roof }
  }

  // W1 UNRANKED: the practice hall. Gable facing the walkway (tsumairi), lit shoji at the back,
  // lattice sides. Props: a makiwara striking post, a bucket of bamboo shinai, a target.
  shrine({ id: 'unranked', label: 'Unranked', role: 'queue', npc: [39, 62], facing: 'east', width: 5, depth: 4, posts: 4, back: 'shoji', sides: 'lattice',
    floor: 'minecraft:stripped_bamboo_block[axis=x]',
    roof: { type: 'gable', axis: 'd', overhang: 1, gableOverhang: 1, lift: 0.5, pitch: [0.5, 0.5, 1, 1, 1], gable: PLASTER, barge: true, lanterns: true },
    props: ({ W, hw }) => {
      W(-hw - 1, 0, 1, 'minecraft:hay_block[axis=y]'); W(-hw - 1, 0, 2, 'minecraft:hay_block[axis=y]'); W(-hw - 1, 0, 3, 'minecraft:dark_oak_fence')
      W(1, -3, 1, 'minecraft:barrel[facing=up,open=true]'); W(1, -3, 2, 'minecraft:bamboo[age=1,stage=0,leaves=none]'); W(1, -3, 3, 'minecraft:bamboo[age=1,stage=0,leaves=small]')
      W(-1, -4, 1, 'minecraft:target'); W(-1, -3, 1, 'minecraft:spruce_trapdoor[facing=east,half=top,open=false]')
      W(hw + 1, 0, 1, 'minecraft:lantern[hanging=false]')
    } })
  // E1 RANKED: the honour shrine. Irimoya across the front, taller posts, brackets, a scroll with
  // a red seal at the back. Props: the rank bell, a lectern ledger, offerings, two nobori.
  shrine({ id: 'ranked', label: 'Ranked', role: 'queue', npc: [61, 62], facing: 'west', width: 5, depth: 5, posts: 5, back: 'scroll', sides: 'plaster',
    roof: { type: 'irimoya', axis: 'u', overhang: 1, lift: 1, pitch: [0.5, 0.5, 1, 1, 1], gable: PLASTER, barge: true, brackets: true, lanterns: true },
    props: ({ W, hw, posts }) => {
      W(0, -4, posts - 1, 'minecraft:chain[axis=y]'); W(0, -4, posts - 2, 'minecraft:bell[attachment=ceiling,facing=west]')
      W(-1, -5, 1, 'minecraft:lectern[facing=west,has_book=true]'); W(1, -5, 1, 'minecraft:decorated_pot[facing=west]'); W(1, -5, 2, 'minecraft:candle[candles=3,lit=true]')
      W(-hw - 1, -1, 1, 'minecraft:dark_oak_fence'); W(-hw - 1, -1, 2, 'minecraft:dark_oak_fence'); W(-hw - 1, -1, 3, 'minecraft:red_banner[rotation=4]')
      W(hw + 1, -1, 1, 'minecraft:dark_oak_fence'); W(hw + 1, -1, 2, 'minecraft:dark_oak_fence'); W(hw + 1, -1, 3, 'minecraft:red_banner[rotation=4]')
    } })
  // W2 FFA: the war-drum tower. Square, tall posts, pyramid roof (hogyo) with a jewel finial.
  // Props: a taiko on its stand, a spear rack, a straw target, open sides with rails.
  shrine({ id: 'ffa', label: 'FFA', role: 'queue', npc: [36, 69], facing: 'east', width: 5, depth: 5, posts: 5, back: 'plaster', sides: 'open',
    roof: { type: 'pyramid', overhang: 1, lift: 1, pitch: [0.5, 0.5, 1, 1, 1], lanterns: true, finial: [BLACK, 'minecraft:lightning_rod[facing=up]'] },
    props: ({ W, hw }) => {
      W(0, -4, 1, 'minecraft:dark_oak_fence'); W(0, -4, 2, 'minecraft:barrel[facing=east,open=false]'); W(0, -5, 2, 'minecraft:dark_oak_trapdoor[facing=west,half=bottom,open=true]')
      for (const u of [-1, 1]) { W(u, -5, 1, 'minecraft:dark_oak_fence'); W(u, -5, 2, 'minecraft:lightning_rod[facing=up]') }
      W(hw + 1, 0, 1, 'minecraft:hay_block[axis=y]'); W(hw + 1, 0, 2, 'minecraft:target')
      W(-hw - 1, -1, 1, 'minecraft:dark_oak_fence'); W(-hw - 1, -1, 2, 'minecraft:dark_oak_fence'); W(-hw - 1, -1, 3, 'minecraft:red_banner[rotation=12]')
    } })
  // W3 KIT EDITOR: the armoury workshop. Low, a shed roof of dark oak shingles rising to the back.
  // Props: anvil, smithing table, grindstone, a lit forge, a weapon chest, shelves.
  shrine({ id: 'kit-editor', label: 'Kit Editor', role: 'queue', npc: [38, 76], facing: 'east', width: 5, depth: 3, posts: 3, back: 'shelves', sides: 'plaster',
    floor: 'minecraft:spruce_planks',
    roof: { type: 'shed', material: 'dark_oak', gable: 'minecraft:dark_oak_planks' },
    props: ({ W, hw }) => {
      W(-1, -3, 1, 'minecraft:anvil[facing=north]'); W(1, -3, 1, 'minecraft:smithing_table')
      W(hw + 1, -1, 1, 'minecraft:grindstone[face=floor,facing=north]'); W(-hw - 1, -1, 1, 'minecraft:blast_furnace[facing=east,lit=true]')
      W(-hw - 1, -2, 1, 'minecraft:chest[facing=east,type=single]')
    } })
  // E2 EVENTS: the festival yagura. Raised one more step, hip roof with strong lift, lanterns
  // strung under the eaves. Props: festival drum, paper lanterns, a firework crate.
  shrine({ id: 'events', label: 'Events', role: 'queue', npc: [64, 69], facing: 'west', width: 5, depth: 4, posts: 4, base: 1, back: 'shoji', sides: 'open',
    roof: { type: 'hip', overhang: 1, lift: 1.5, pitch: [0.5, 0.5, 1, 1, 1], lanterns: true, brackets: true },
    props: ({ W, hw }) => {
      W(0, -3, 1, 'minecraft:note_block'); W(0, -3, 2, 'minecraft:barrel[facing=west,open=false]')
      for (const u of [-1, 1]) { W(u, -2, 3, 'minecraft:chain[axis=y]') ; W(u, -2, 2, 'minecraft:lantern[hanging=true]') }
      W(hw + 1, -1, 1, 'minecraft:barrel[facing=up,open=true]'); W(hw + 1, -1, 2, 'minecraft:red_candle[candles=2,lit=true]')
      W(-hw - 1, -1, 1, 'minecraft:dark_oak_fence'); W(-hw - 1, -1, 2, 'minecraft:dark_oak_fence'); W(-hw - 1, -1, 3, 'minecraft:red_banner[rotation=4]')
    } })
  // E3 STORE: the merchant stall. Low, gable across the front in spruce shingles, shelves of
  // stock at the back, a red noren hung from the front beam. Props: barrels, pots, a cash chest.
  shrine({ id: 'store', label: 'Store', role: 'queue', npc: [62, 76], facing: 'west', width: 5, depth: 3, posts: 3, back: 'shelves', sides: 'plaster',
    floor: 'minecraft:spruce_planks',
    roof: { type: 'gable', axis: 'u', material: 'spruce', ridge: 'dark_oak', ribs: null, rafter: 'dark_oak', overhang: 1, gableOverhang: 1, lift: 0.5, pitch: [0.5, 0.5, 1, 1], gable: PLASTER },
    props: ({ W, hw, posts }) => {
      for (const u of [-1, 1]) W(u, -1, posts, 'minecraft:red_wall_banner[facing=west]')
      W(hw + 1, -1, 1, 'minecraft:barrel[facing=up,open=true]'); W(hw + 1, 0, 1, 'minecraft:decorated_pot[facing=west]')
      W(-hw - 1, -1, 1, 'minecraft:chest[facing=west,type=single]'); W(-hw - 1, 0, 1, 'minecraft:potted_bamboo')
      W(0, -3, 1, 'minecraft:lectern[facing=west,has_book=false]')
    } })

  // ============================================================================ HALL OF FAME
  // Along the west cliff, facing east across a raked court toward the arena and the stage (30
  // degrees off its axis), out of the first view so the temple stands free: three framed boards
  // for hologram leaderboards (Wins, Elo, Streak), the Elo board raised over a top-3 podium. The
  // kit's wall takes the house palette: plaster field, deepslate-tile copings and sills, mossy
  // plinth, red only at the crest and the champion's step. A 12-deep reading court lies in front.
  const HOF = [9, M, 50]
  b.leaderboards(HOF, 'east', {
    count: 3, width: 5, height: 6, gap: 3, podium: true,
    ids: ['wins', 'elo', 'streak'], labels: ['Most Wins', 'Top Elo', 'Best Streak'],
    primary: 'calcite', trim: 'deepslate_tile', base: 'mossy_stone_bricks', accent: RED, backdrop: BLACK,
    podiumCaps: [RED, 'minecraft:smooth_quartz', 'minecraft:polished_andesite'],
  })
  // a tiled coping roof over the two side wings of the wall (a tsuiji-bei); the raised Elo bay
  // keeps its crest against the sky
  for (const [z0, z1] of [[HOF[2] - 15, HOF[2] - 7], [HOF[2] + 7, HOF[2] + 15]]) {
    b.eastRoof({ ...SMALL, x0: HOF[0] - 2, z0, x1: HOF[0], z1, y: M + 13, type: 'gable', axis: 'z', overhang: 1, gableOverhang: 1, lift: 0.5, pitch: [0.5, 0.5, 1], gable: PLASTER })
  }

  // ============================================================================ CRATE SHRINES
  // Two small crate altars on the east lawn, facing the court: the Vote crate (dark wood panel,
  // paper-white glow) and the Dojo crate (the premium one, the only red panel). Each gets a
  // little gabled roof (a hokora) over its arch; the crowd area in front is open lawn.
  const CRATES = [
    { pos: [74, M + 2, 50], id: 'vote', label: 'Vote Crate', tier: 'vote', block: 'chest', tierBlock: 'minecraft:dark_oak_planks', panel: 'minecraft:stripped_dark_oak_log[axis=y]', glass: 'minecraft:white_stained_glass' },
    { pos: [81, M + 2, 51], id: 'dojo', label: 'Dojo Crate', tier: 'mythic', block: 'ender_chest', tierBlock: RED, panel: RED, glass: 'minecraft:red_stained_glass', hero: true },
  ]
  for (const c of CRATES) {
    b.crate(c.pos, 'south', { ...c, primary: 'calcite', trim: 'deepslate_tile', base: 'mossy_stone_bricks', accent: RED })
    const L = frameOf(c.pos, 'south')
    // the kit lights the dais with candles in the tier colour; the vote crate's are plain wax
    for (let u = -2; u <= 2; u += 1) for (let d = -1; d <= 2; d += 1) {
      const p = L.at(u, d, 0)
      const blk = b.get(...p)
      if (blk && /green_candle$/.test(blk.name)) b.set(...p, { name: 'minecraft:candle', props: blk.props })
    }
    const top = c.hero ? 9 : 7 // above the arch's cap (and the hero's crest)
    const rect = L.rect(-2, -4, 2, -2)
    b.eastRoof({ ...SMALL, ...rect, y: c.pos[1] + top, type: 'gable', axis: 'z', overhang: 1, gableOverhang: 1, lift: 0.5, pitch: [0.5, 0.5, 1, 1], gable: PLASTER })
  }

  // ============================================================================ FFA DROP GATE
  // On the arena's east rim: the kit portal (kind 'pvp', pointed red fanlight) under a gate roof.
  // Walking west through the opening triggers the drop into the pit.
  {
    const rec = b.portal([66, M + 1, 47], [66, M + 4, 49], { id: 'ffa-drop', label: 'FFA Drop', kind: 'pvp', facing: 'east', primary: 'calcite', trim: 'deepslate_tile', base: 'mossy_stone_bricks', accent: RED })
    b.eastRoof({ ...SMALL, x0: 65, z0: 44, x1: 67, z1: 52, y: M + 1 + 10, type: 'gable', axis: 'z', overhang: 2, gableOverhang: 1, lift: 1, pitch: [0.5, 0.5, 1, 1, 1], gable: PLASTER })
    b.ffaGate = rec
  }

  // ============================================================================ GROUND FINISH
  // The lawn must not be the main read: formal areas get raked gravel inside andesite kerbs,
  // routes get worn paths (flagstone centre, gravel shoulders, a fringe of coarse dirt), the
  // gardens keep grass and moss under trees.
  const SOFT = /grass_block|moss_block|coarse_dirt|minecraft:dirt$|podzol/
  const isSoft = (x, z) => {
    const gy = G(x, z)
    return gy >= 0 && SOFT.test(b.nameAt(x, gy, z) ?? '') && !b.has(x, gy + 1, z)
  }
  const paintTop = (x, z, p) => { const gy = G(x, z); if (gy >= 0) b.set(x, gy, z, p) }
  // raked fields: a rounded rectangle, furrows along the long side, a kerb round it
  const rakeField = (cx, cz, hx, hz, r, alongX) => {
    for (let x = Math.floor(cx - hx - 1); x <= Math.ceil(cx + hx + 1); x += 1)
      for (let z = Math.floor(cz - hz - 1); z <= Math.ceil(cz + hz + 1); z += 1) {
        const qx = Math.abs(x - cx) - (hx - r)
        const qz = Math.abs(z - cz) - (hz - r)
        const sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r
        if (sd > 0.5 || !isSoft(x, z) || G(x, z) !== M) continue
        paintTop(x, z, sd > -0.5 ? 'minecraft:polished_andesite' : alongX ? GRAVEL_Z(x, z) : GRAVEL_X(x, z))
      }
  }
  rakeField(17, 50, 6.5, 13.5, 3, false) // hall of fame reading court
  rakeField(78, 56, 10, 4.5, 2, true) // crate court (the crowd at key-alls)
  // the temple's drip apron: gravel round the kidan foot
  for (let x = TK.x0 - 3; x <= TK.x1 + 3; x += 1) for (let z = TK.z0 - 2; z <= TK.z1 + 3; z += 1) {
    if (x >= TK.x0 && x <= TK.x1 && z >= TK.z0 && z <= TK.z1) continue
    if (isSoft(x, z) && G(x, z) === M) paintTop(x, z, GRAVEL_X(x, z))
  }
  // worn paths
  const wornPath = (pts, w, seed = 0) => {
    const line = kit.catmullRom(pts.map(([x, z]) => [x, 0, z]), { samplesPerBlock: 3 })
    const done = new Set()
    for (const [px, , pz] of line) {
      for (let x = Math.floor(px - w); x <= Math.ceil(px + w); x += 1)
        for (let z = Math.floor(pz - w); z <= Math.ceil(pz + w); z += 1) {
          const k = `${x},${z}`
          const d = Math.hypot(x - px, z - pz)
          if (d > w / 2 + 0.8 || !isSoft(x, z)) continue
          const prev = done.has(k)
          if (d <= 1.0) { paintTop(x, z, FLAG(x, z)); done.add(k) } else if (!prev && d <= w / 2) paintTop(x, z, hash(x, z, seed) < 0.75 ? 'minecraft:gravel' : 'minecraft:andesite')
          else if (!prev && hash(x, z, seed + 1) < 0.45) paintTop(x, z, 'minecraft:coarse_dirt')
        }
    }
  }
  wornPath([[31, 63], [28, 63], [25, 62], [23, 60]], 4, 1) // court → hall of fame
  wornPath([[69, 63], [72, 61], [76, 60], [78, 61]], 4, 2) // court → crates
  wornPath([[86, 59], [88, 63], [90, 67]], 3, 3) // crates → parkour start
  wornPath([[70, 48], [74, 47], [77, 45]], 3, 4) // FFA gate → crates (behind them)
  wornPath([[33, 33], [28, 33], [25, 35]], 3, 5) // rim → bell stair
  wornPath([[67, 30], [72, 31], [76, 33]], 3, 6) // rim → NE crag foot

  // ============================================================================ PLANTING
  // Hand-shaped cherries in three size classes. A trunk line with a kink and a lean, 3-5 limbs
  // from the upper trunk, each ending in a flat-bottomed leaf pad (a dome cut level at its base),
  // a pad over the crown, a few drips, petals on the soil below.
  const CHERRY = {
    L: { h: 9, limbs: 5, reach: 5, rise: 2.2, pad: 3.0, padH: 1.7, trunk: t => 1.3 - 0.4 * t, flare: 2 },
    M: { h: 7, limbs: 4, reach: 3.8, rise: 1.8, pad: 2.5, padH: 1.5, trunk: 0, flare: 1 },
    S: { h: 5, limbs: 3, reach: 2.6, rise: 1.3, pad: 2.0, padH: 1.2, trunk: 0, flare: 1 },
  }
  const leafPad = (c, r, h, leaves, seed) => {
    const R = Math.ceil(r * 1.3) + 1
    for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x += 1)
      for (let y = Math.floor(c[1]); y <= Math.ceil(c[1] + h + 1); y += 1)
        for (let z = Math.floor(c[2] - R); z <= Math.ceil(c[2] + R); z += 1) {
          const d = Math.hypot((x - c[0]) / r, (y - c[1]) / h, (z - c[2]) / r)
          const wob = 1 + 0.28 * kit.noise.fbm3(x, y, z, { scale: 2.6, seed })
          if (d > wob) continue
          if (d > wob - 0.3 && kit.noise.hash01(x, y, z, seed + 5) < 0.18) continue
          const old = b.get(x, y, z)
          if (old && !/_leaves$/.test(old.name)) continue
          b.set(x, y, z, Array.isArray(leaves) ? leaves[Math.floor(kit.noise.hash01(x, y, z, seed + 9) * leaves.length)] : leaves)
        }
  }
  const cherry = (x, z, size, seed, lean = [0, 0]) => {
    const S = CHERRY[size]
    const rng = kit.rng(seed)
    const y0 = G(x, z) + 1
    const at = t => [x + lean[0] * S.h * t + (t > 0.3 ? rng.range(-0.15, 0.15) : 0), y0 + (S.h - 1) * t, z + lean[1] * S.h * t]
    const top = at(1)
    const mid = [x + lean[0] * S.h * 0.45 + rng.range(-0.8, 0.8), y0 + S.h * 0.45, z + lean[1] * S.h * 0.45 + rng.range(-0.8, 0.8)]
    b.curve([[x, y0 - 1, z], [x, y0, z], mid, top], 'minecraft:cherry_wood', { radius: S.trunk })
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (rng.chance(0.6)) b.set(x + dx * S.flare, y0, z + dz * S.flare, 'minecraft:cherry_wood', { keep: true })
    const pads = []
    const a0 = rng.range(0, Math.PI * 2)
    for (let i = 0; i < S.limbs; i += 1) {
      const a = a0 + (i / S.limbs) * Math.PI * 2 + rng.range(-0.4, 0.4)
      const start = at(rng.range(0.55, 0.85))
      const reach = S.reach * rng.range(0.75, 1.15)
      const end = [start[0] + Math.cos(a) * reach, start[1] + S.rise * rng.range(0.5, 1.2), start[2] + Math.sin(a) * reach]
      const bend = [(start[0] + end[0]) / 2 + rng.range(-0.5, 0.5), Math.max(start[1], end[1]) + 0.4, (start[2] + end[2]) / 2 + rng.range(-0.5, 0.5)]
      b.curve([start, bend, end], 'minecraft:cherry_wood', { radius: 0 })
      pads.push(end)
    }
    pads.push([top[0], top[1] + 0.4, top[2]])
    for (const p of pads) leafPad([p[0], p[1] + 0.3, p[2]], S.pad * rng.range(0.85, 1.15), S.padH, 'minecraft:cherry_leaves[persistent=true]', seed * 31 + Math.round(p[0] * 7 + p[2] * 3))
    // drips: single leaves hanging under the pad rims; petals on the soil under the crown
    const R = S.reach + S.pad
    for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx += 1) for (let dz = -Math.ceil(R); dz <= Math.ceil(R); dz += 1) {
      const px = Math.round(x + lean[0] * S.h) + dx
      const pz = Math.round(z + lean[1] * S.h) + dz
      const lowest = (() => { for (let y = y0 + 1; y < y0 + S.h + 6; y += 1) if (b.nameAt(px, y, pz) === 'minecraft:cherry_leaves') return y; return -1 })()
      if (lowest > y0 + 2 && hash(px, pz, seed + 3) < 0.12 && !b.has(px, lowest - 1, pz)) b.set(px, lowest - 1, pz, 'minecraft:cherry_leaves[persistent=true]')
      if (Math.hypot(dx, dz) < R * 0.8 && isSoft(px, pz) && hash(px, pz, seed + 4) < 0.35) b.set(px, G(px, pz) + 1, pz, `minecraft:pink_petals[facing=${['north', 'east', 'south', 'west'][Math.floor(hash(px, pz, 9) * 4)]},flower_amount=${1 + Math.floor(hash(pz, px, 9) * 4)}]`)
    }
  }
  // Japanese black pine (niwaki): a crooked thin trunk and flat cloud pads of dark needles.
  const pine = (x, z, h, seed, dir = [1, 0]) => {
    const rng = kit.rng(seed)
    const y0 = G(x, z) + 1
    const pts = [[x, y0, z], [x + dir[0] * 0.6, y0 + h * 0.35, z + dir[1] * 0.6], [x + dir[0] * 1.8 + rng.range(-0.4, 0.4), y0 + h * 0.7, z + dir[1] * 1.8], [x + dir[0] * 1.2, y0 + h, z + dir[1] * 1.2]]
    b.curve(pts, 'minecraft:spruce_wood', { radius: 0.3 })
    const tiers = [[0.55, 2.2, -1], [0.75, 1.8, 1], [1.0, 1.6, 0]]
    for (const [t, r, side] of tiers) {
      const c = [x + dir[0] * (1.6 * t + side * 1.4) + dir[1] * side * 0.8, y0 + h * t, z + dir[1] * (1.6 * t + side * 1.4) + dir[0] * side * 0.8]
      b.line([x + dir[0] * 1.2 * t, y0 + h * t - 0.5, z + dir[1] * 1.2 * t], c, 'minecraft:spruce_wood', { connect: 6 })
      leafPad([c[0], c[1] + 0.2, c[2]], r * rng.range(0.9, 1.15), 0.9, ['minecraft:spruce_leaves[persistent=true]', 'minecraft:dark_oak_leaves[persistent=true]'], seed * 17 + Math.round(t * 10))
    }
  }
  const bambooClump = (cx, cz, r, seed) => {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z += 1) {
      if (Math.hypot(x - cx, z - cz) > r || !isSoft(x, z) || hash(x, z, seed) > 0.42) continue
      const gy = G(x, z)
      b.set(x, gy, z, kit.noise.hash01(x, 1, z, seed) < 0.5 ? 'minecraft:podzol' : 'minecraft:moss_block')
      const h = 7 + Math.floor(hash(x, z, seed + 1) * 6)
      for (let k = 1; k <= h; k += 1) b.set(x, gy + k, z, `minecraft:bamboo[age=${hash(x, z, seed + 2) < 0.5 ? 1 : 0},stage=0,leaves=${k >= h - 1 ? 'large' : k === h - 2 ? 'small' : 'none'}]`)
    }
  }
  const karikomi = (x, z, r, seed) => leafPad([x, G(x, z) + 1, z], r, r * 0.75, ['minecraft:azalea_leaves[persistent=true]', 'minecraft:azalea_leaves[persistent=true]', 'minecraft:flowering_azalea_leaves[persistent=true]'], seed)

  // groups: two cherries flank the temple in the first view (L west, M east, not mirrored)
  cherry(27, 31, 'L', 1, [0.08, 0.04])
  cherry(23, 35, 'S', 2)
  cherry(74, 31, 'M', 3, [-0.06, 0])
  cherry(78, 35, 'S', 4)
  // south-west garden grove: L, M, S with a clearing for the stone lantern
  cherry(16, 72, 'L', 5, [0.05, -0.05])
  cherry(23, 79, 'M', 6)
  cherry(11, 82, 'S', 7)
  // south-east garden: M and S by the parkour start, L on the terrace
  cherry(83, 75, 'L', 8, [-0.05, -0.04])
  cherry(77, 84, 'S', 9)
  cherry(89, 82, 'M', 10)
  // by the arrival hall and the crates
  cherry(36, 91, 'M', 11)
  cherry(65, 92, 'S', 12)
  cherry(90, 52, 'S', 13)
  // pines on the crags and at the court corners
  pine(31, 80, 7, 21, [1, -0.3])
  pine(69, 80, 6, 22, [-1, -0.2])
  pine(8, 22, 6, 23, [0.6, 0.8])
  pine(20, 12, 5, 24, [0.8, 0.5])
  pine(91, 22, 6, 25, [-0.8, 0.6])
  pine(34, 4, 6, 26, [0.3, 1])
  pine(70, 4, 5, 27, [-0.4, 1])
  // bamboo backdrops on the west cliff and behind the crates
  bambooClump(5, 72, 3.2, 31)
  bambooClump(8, 30, 2.5, 32)
  bambooClump(89, 36, 2.6, 33)
  bambooClump(88, 42, 2.2, 34)
  // clipped azalea mounds at path corners and building feet
  for (const [x, z, r] of [[33, 58, 1.6], [67, 58, 1.5], [28, 63, 1.2], [72, 74, 1.4], [24, 66, 1.3], [74, 58, 1.4], [38, 88, 1.6], [62, 87, 1.5], [29, 26, 1.5], [71, 27, 1.4], [86, 60, 1.3], [24, 36, 1.5]]) karikomi(x, z, r, x * 7 + z)

  // ============================================================================ LANTERNS AND BANNERS
  bigToro(39, M + 1, 58) // kasuga lanterns flank the torii (not mirrored: one big, one small)
  smallToro(61, M + 1, 58)
  for (const [x, z] of [[44, 32], [56, 32], [33, 46], [33, 42], [67, 41]]) smallToro(x, G(x, z) + 1, z)
  for (const [x, z] of [[24, 38], [25, 63], [74, 60], [82, 60], [88, 64], [20, 66], [86, 80], [12, 76]]) if (isSoft(x, z) || /gravel|andesite|concrete/.test(b.nameAt(x, G(x, z), z) ?? '')) smallToro(x, G(x, z) + 1, z)
  bigToro(30, G(30, 30) + 1, 30)
  bigToro(70, G(70, 30) + 1, 30)
  // nobori round the arena rim in pairs and a three, never evenly spaced
  for (const [x, z, rot] of [[47, 31, 8], [53, 31, 8], [35, 40, 4], [35, 48, 4], [65, 38, 12], [65, 41, 12], [62, 56, 10]]) {
    if (!b.has(x, M + 1, z)) nobori(x, M + 1, z, rot)
  }

  // ============================================================================ NW CRAG: BELL TOWER
  // A stone stair cut into the crag climbs from the hall of fame court to a shoro (bell tower)
  // on the summit: splayed posts, an irimoya roof with a strong lift, a great bell and its
  // striker log hung on chains. Story: the bell rings for every new season champion.
  const carveStair = (cells, facing) => {
    // cells: [x, z, y] step tops; fills below with stone, clears above, the tread is a stair
    for (const [x, z, y] of cells) {
      const gy = Math.max(G(x, z), y)
      b.box([x, M - 2, z], [x, y - 1, z], STONE)
      b.clear([x, y + 1, z], [x, gy + 4, z])
      b.set(x, y, z, `minecraft:stone_brick_stairs[facing=${facing}]`)
      top.set(`${x},${z}`, y)
    }
  }
  {
    const flight1 = []
    for (let z = 36; z >= 21; z -= 1) {
      const y = M + Math.min(9, Math.max(1, Math.ceil((36 - z) * 0.62)))
      for (let x = 15; x <= 17; x += 1) flight1.push([x, z, y])
    }
    carveStair(flight1, 'north')
    const flight2 = []
    for (const [x, y] of [[14, M + 10], [13, M + 11], [12, M + 12]]) for (let z = 18; z <= 20; z += 1) flight2.push([x, z, y])
    carveStair(flight2, 'west')
    // the summit pad and the shoro
    const S0 = [8, 13]
    const SY = M + 12
    for (let x = S0[0] - 1; x <= S0[0] + 5; x += 1) for (let z = S0[1] - 1; z <= S0[1] + 5; z += 1) {
      if (edge(x, z) < 0) continue
      b.box([x, M, z], [x, SY - 1, z], rock(x, SY, z), { keep: true })
      b.set(x, SY, z, x === S0[0] - 1 || x === S0[0] + 5 || z === S0[1] - 1 || z === S0[1] + 5 ? 'minecraft:mossy_stone_bricks' : 'minecraft:polished_andesite')
      b.clear([x, SY + 1, z], [x, SY + 10, z])
    }
    const [sx, sz] = [S0[0] + 2, S0[1] + 2]
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      b.set(sx + dx, SY + 1, sz + dz, 'minecraft:polished_andesite')
      b.box([sx + dx, SY + 2, sz + dz], [sx + dx, SY + 6, sz + dz], POST)
    }
    for (let k = -1; k <= 1; k += 1) for (const s2 of [-2, 2]) {
      b.set(sx + k, SY + 6, sz + s2, BEAM('x'))
      b.set(sx + s2, SY + 6, sz + k, BEAM('z'))
      b.set(sx + k, SY + 4, sz + s2, BEAM('x')) // nuki tie beams
      b.set(sx + s2, SY + 4, sz + k, BEAM('z'))
    }
    b.eastRoof({ ...SMALL, x0: sx - 2, z0: sz - 2, x1: sx + 2, z1: sz + 2, y: SY + 7, type: 'irimoya', axis: 'x', overhang: 2, lift: 1.5, pitch: [0.5, 0.5, 1, 1, 1, 1], gable: PLASTER, barge: true, lanterns: true })
    b.box([sx, SY + 5, sz], [sx, SY + 6, sz], 'minecraft:chain[axis=y]')
    b.set(sx, SY + 4, sz, 'minecraft:bell[attachment=ceiling,facing=east]')
    b.set(sx - 1, SY + 6, sz + 1, 'minecraft:chain[axis=y]')
    b.set(sx + 1, SY + 6, sz + 1, 'minecraft:chain[axis=y]')
    b.box([sx - 1, SY + 5, sz + 1], [sx + 1, SY + 5, sz + 1], 'minecraft:stripped_spruce_log[axis=x]') // shumoku striker
    smallToro(S0[0] + 5, SY + 1, S0[1] + 5)
  }

  // ============================================================================ PARKOUR
  // From a start pad on the east lawn, stepping stones run north along the cliff edge (some over
  // the void, each a floating rock with hanging roots), climb onto the north-east crag's ledges
  // and finish at a rest pavilion on its summit. Jumps: 2-block gaps, +0 or +1 per jump, one
  // checkpoint halfway. Start and finish are gold plates, the checkpoint an iron plate.
  {
    const START = [90, M, 66]
    for (let x = START[0] - 1; x <= START[0] + 1; x += 1) for (let z = START[2] - 1; z <= START[2] + 1; z += 1) b.set(x, M, z, x === START[0] && z === START[2] ? 'minecraft:polished_andesite' : 'minecraft:stone_bricks')
    b.set(START[0], M + 1, START[2], 'minecraft:light_weighted_pressure_plate[power=0]')
    nobori(START[0] + 1, M + 1, START[2] + 2, 0)
    smallToro(START[0] - 2, M + 1, START[2] + 1)
    b.region('parkour-start', [START[0], M + 1, START[2]], [START[0], M + 1, START[2]], { note: 'gold plate: start' })
    const JUMPS = [
      [92, 0, 62], [93, 1, 59], [93, 1, 56], [94, 2, 53], [95, 2, 50], [94, 3, 47], [94, 3, 44, 'check'],
      [95, 3, 41], [94, 4, 38], [95, 5, 35], [94, 5, 32], [93, 6, 29], [91, 7, 27], [89, 8, 26], [87, 9, 25],
    ]
    const TOPS = ['minecraft:polished_andesite', 'minecraft:mossy_stone_bricks', 'minecraft:andesite', 'minecraft:stone_bricks']
    JUMPS.forEach(([x, h, z, kind], i) => {
      const y = M + h
      const ground = G(x, z)
      if (kind === 'check') {
        for (let dx = 0; dx <= 1; dx += 1) for (let dz = 0; dz <= 1; dz += 1) {
          b.set(x + dx, y, z + dz, 'minecraft:polished_andesite')
          if (ground < 0 || G(x + dx, z + dz) < y) b.set(x + dx, y - 1, z + dz, 'minecraft:mossy_cobblestone')
        }
        b.set(x, y + 1, z, 'minecraft:heavy_weighted_pressure_plate[power=0]')
        b.set(x + 1, y + 1, z + 1, 'minecraft:lantern[hanging=false]')
        b.region('parkour-checkpoint', [x, y + 1, z], [x, y + 1, z], { note: 'iron plate: checkpoint' })
        return
      }
      if (ground >= y) { b.clear([x, y + 1, z], [x, ground + 3, z]); b.set(x, y, z, TOPS[i % 4]); return }
      if (ground >= 0 && i % 4 === 2) {
        // a wooden pole jump where there is ground below: fence post, slab on top (half-block jump)
        b.box([x, ground + 1, z], [x, y - 1, z], 'minecraft:dark_oak_fence')
        b.set(x, y, z, 'minecraft:spruce_slab[type=top]')
        return
      }
      // a floating rock: the top block, a smaller lump under it, roots hanging below
      b.set(x, y, z, TOPS[i % 4])
      b.set(x, y - 1, z, i % 2 ? 'minecraft:mossy_cobblestone' : 'minecraft:tuff')
      if (!b.has(x, y - 2, z) && (ground < 0 || ground < y - 2)) b.set(x, y - 2, z, 'minecraft:hanging_roots')
    })
    // finish: a pad on the summit and a rest pavilion (azumaya) with a pyramid roof
    const FY = M + 9
    const F0 = [84, 16]
    for (let x = F0[0] - 3; x <= F0[0] + 3; x += 1) for (let z = F0[1] - 3; z <= F0[1] + 3; z += 1) {
      if (edge(x, z) < 0) continue
      b.box([x, M, z], [x, FY - 1, z], rock(x, FY, z), { keep: true })
      b.set(x, FY, z, Math.max(Math.abs(x - F0[0]), Math.abs(z - F0[1])) === 3 ? 'minecraft:mossy_stone_bricks' : 'minecraft:spruce_planks')
      b.clear([x, FY + 1, z], [x, FY + 9, z])
    }
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) b.box([F0[0] + dx, FY + 1, F0[1] + dz], [F0[0] + dx, FY + 4, F0[1] + dz], POST)
    for (let k = -1; k <= 1; k += 1) for (const s2 of [-2, 2]) {
      b.set(F0[0] + k, FY + 4, F0[1] + s2, BEAM('x'))
      b.set(F0[0] + s2, FY + 4, F0[1] + k, BEAM('z'))
      if (s2 === -2) b.set(F0[0] + k, FY + 1, F0[1] + s2, 'minecraft:spruce_stairs[facing=north]') // bench
    }
    b.eastRoof({ ...SMALL, x0: F0[0] - 2, z0: F0[1] - 2, x1: F0[0] + 2, z1: F0[1] + 2, y: FY + 5, type: 'pyramid', overhang: 2, lift: 1, pitch: [0.5, 0.5, 1, 1, 1], lanterns: true, finial: ['minecraft:polished_blackstone_wall'] })
    b.set(F0[0], FY + 1, F0[1] + 1, 'minecraft:light_weighted_pressure_plate[power=0]')
    b.hangingLantern([F0[0], FY + 4, F0[1]], 0)
    b.region('parkour-finish', [F0[0], FY + 1, F0[1] + 1], [F0[0], FY + 1, F0[1] + 1], { note: 'gold plate: finish' })
    // the way down from the summit: a stair on the crag's west side to the temple's east lawn
    const down = []
    for (let i = 0; i < 9; i += 1) for (let z = 19; z <= 20; z += 1) down.push([F0[0] - 4 - i, z, FY - 1 - i])
    carveStair(down, 'east')
  }

  return finishUp()

  function finishUp() {
    b.spawnPoint(SPAWN, 'north', { label: 'Dojo spawn' })
    return b.finish({ name: 'pvp-lobby', description: 'Dojo Lobby: a Japanese mountain-temple PvP lobby on a floating island.' })
  }
}
