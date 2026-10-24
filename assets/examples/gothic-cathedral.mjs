// GOTHIC CATHEDRAL
// ============================================================================
// A High-Gothic cathedral in the French manner (Reims / Amiens / Cologne read through
// Minecraft blocks): Latin-cross plan with a five-bay nave and side aisles, a projecting
// transept, a two-bay choir ending in a semicircular apse wrapped by an ambulatory (the
// "chevet"), twin west towers with octagonal crocketed spires, a copper fleche over the
// crossing, flying buttresses with pinnacles and gargoyles on every bay, a rose window over
// a triple portal with stepped archivolts, and a ribbed, vaulted interior with pews, choir
// stalls and an altar. It stands in a cathedral close: a paved forecourt with a labyrinth
// inlay, lawns and gardens, and a walled graveyard with a crypt.
//
// CANVAS 75 x 92 x 128 (x = across, y = up, z = along the nave). The liturgical "west"
// front faces +z (world south) so the default `south` render is the facade elevation.
//
// PROPORTIONS (the things that make it read as Gothic, not as a big church)
//   nave       11 wide inside, walls 26 tall -> vault crown ~28 (height ~2.5 x width)
//   aisles     6 wide, half the nave height (walls 10) under low lean-to roofs
//   bays       8 blocks: 3-wide pier + 5-wide opening; every element repeats on this rhythm
//              (pier, flyer, pinnacle, aisle window, clerestory window, arcade arch, vault bay)
//   roofs      pitch 2 (63 deg) on all high roofs, so nave, transept and apse ridges meet
//   towers     13 x 13, 50 tall (~2x the nave wall), spires 28 more -> total ~80 above grade
//   openings   pointed everywhere: lancets 3 x 7..12, clerestory 5 x 9 with a mullion,
//              portal 5 wide with 3 archivolts, rose window 11 across
//
// PALETTE (roles, light -> dark)
//   wall field   b.texture ramp polished_andesite > andesite > stone_bricks > tuff_bricks >
//                deepslate_bricks: darker and greener (tuff) low down, pale near the spire tips
//   plinth       deepslate_bricks / cobbled_deepslate / polished_deepslate, 3 courses + a
//                sloped deepslate_brick_stairs water table
//   trim         polished_andesite (+ stairs): archivolts, hood moulds, sills, pinnacle caps
//   tracery      calcite (rose ring, vault ribs, altar), diorite_wall (mullions, shafts)
//   roof         deepslate_tile: the darkest large mass, ~25 L* below the walls
//   accents      oxidized copper fleche (the only strong hue outside the glass), blue-led
//                stained glass with red and a little yellow/purple, red carpet, gold cross
//   light        lanterns on chains, candles on the altar, soul lanterns in the graveyard
//
// METHOD (read in this order; each section says why)
//   1 massing as solid placeholder volumes (mud_bricks), 2 carve interiors and vaults with
//   signed "is this void?" predicates, 3 roofs, 4 openings and buttress MODULES stamped with
//   rotation (and resampled radially round the apse), 5 towers, spires, facade, 6 b.texture
//   turns the placeholder into a graded stone ramp, 7 interior, 8 landscape and light.
// ============================================================================
export default function build(api) {
  const { kit } = api
  const { cw, ccw, opposite, DIR } = kit

  // ------------------------------------------------------------------ grid
  // All dimensions are named so the plan can be re-proportioned in one place. Odd widths
  // everywhere (11, 13, 5, 3) give every opening and ridge a true centre cell.
  const W = 75
  const H = 92
  const L = 128
  const b = api.builder([W, H, L], { seed: 1248 })

  const CX = 37 // nave axis
  const F = 5 // floor blocks; interior air starts at F + 1; grade (ground surface) is F - 1
  const NAVE_TOP = F + 26
  const AISLE_TOP = F + 10
  const TOWER_TOP = F + 50
  const SPRING = F + 19 // high vault springing line
  const ASPRING = F + 5 // aisle vault springing

  const ZN = 44 // transept north face
  const ZS = 58 // transept south face
  const ZT = 51 // transept centre line
  const ZA = 28 // apse centre (chord of the semicircle)
  const TZ0 = 97 // towers z0
  const ZF = 109 // facade face
  const NAVE_PIERS = [57, 65, 73, 81, 89, 97] // first z of each 3-wide pier
  const TOWERS = [18, 44] // x0 of each 13-wide tower
  const BAYS = [...NAVE_PIERS.slice(0, 5).map(p => p + 3), 30, 38] // first z of each 5-wide bay

  // ------------------------------------------------------------------ materials
  // Masonry is laid in a PLACEHOLDER family (mud brick has block/stairs/slab, all of which
  // b.texture can map), so shape and texture are decided separately: build the geometry,
  // then grade the whole cathedral with one ramp at the end.
  const WALL = 'minecraft:mud_bricks' // placeholder, textured at the end
  const WST = 'minecraft:mud_brick_stairs'
  const TRIM = 'minecraft:polished_andesite'
  const TST = 'minecraft:polished_andesite_stairs'
  const TRACERY = 'minecraft:calcite'
  const TRWALL = 'minecraft:diorite_wall'
  const ROOF = 'deepslate_tile'
  const COPPER = 'minecraft:oxidized_cut_copper'
  const COPPER_ST = 'minecraft:oxidized_cut_copper_stairs'

  const st = (id, facing, half = 'bottom') => `${id}[facing=${facing},half=${half}]`

  // Wall-local frame: u to the right (seen from outside), v up, d inward (d < 0 = outward).
  const frame = (o, facing) => {
    const r = DIR[ccw(facing)]
    const n = DIR[facing]
    return (u, v, d = 0) => [o[0] + r[0] * u - n[0] * d, o[1] + v, o[2] + r[2] * u - n[2] * d]
  }

  // Pointed (two-centred) arch head rasterised with 4x4 supersampling.
  // Returns rows (from the springing up) of 'open' | 'L' | 'R' | null per column.
  const headCells = (w, k = 1) => {
    const R = k * w
    const inside = (pu, pv) => (pu - R) ** 2 + pv * pv <= R * R && (pu - (w - R)) ** 2 + pv * pv <= R * R
    const apex = Math.sqrt(R * R - (R - w / 2) ** 2)
    const rows = []
    for (let v = 0; v < Math.ceil(apex); v += 1) {
      const row = []
      for (let u = 0; u < w; u += 1) {
        let c = 0
        for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) if (inside(u + (i + 0.5) / 4, v + (j + 0.5) / 4)) c += 1
        c /= 16
        const centre = w % 2 === 1 && u === (w - 1) / 2
        row.push(c >= 0.6 ? 'open' : c >= 0.2 ? (centre ? 'open' : u < (w - 1) / 2 ? 'L' : 'R') : null)
      }
      rows.push(row)
    }
    return rows
  }
  // Height of a pointed arch intrados above its springing at offset t (0..s) across span s.
  const archH = (t, s, k = 1) => {
    const R = k * s
    if (t < 0 || t > s) return -1
    return Math.min(Math.sqrt(Math.max(0, R * R - (t - R) ** 2)), Math.sqrt(Math.max(0, R * R - (t - (s - R)) ** 2)))
  }
  const octIn = (dx, dz, r) => Math.abs(dx) <= r && Math.abs(dz) <= r && Math.abs(dx) + Math.abs(dz) <= r * 1.42
  const copyFrom = (tmp, test, opts) => {
    for (const [x, y, z, blk] of tmp.entries()) if (test(x, y, z)) b.set(x, y, z, blk, opts)
  }

  // ------------------------------------------------------------------ site
  b.terrain({ x0: 0, z0: 0, x1: W - 1, z1: L - 1, base: 0, height: () => F - 1 })

  // ------------------------------------------------------------------ massing
  // Solid volumes first, interiors carved later. Thinking in solids keeps walls, piers and
  // vault shells automatically consistent: whatever is not carved is masonry.
  b.box([CX - 7, F - 1, ZA], [CX + 7, NAVE_TOP, ZF], WALL) // nave + choir + tower bay
  for (const x0 of [CX - 15, CX + 8]) b.box([x0, F - 1, ZA], [x0 + 7, AISLE_TOP, TZ0 - 1], WALL) // aisles
  b.box([CX - 26, F - 1, ZN], [CX + 26, NAVE_TOP, ZS], WALL) // transept
  const halfDisc = (r, y0, y1, paint, rIn = -1) => b.fillWhere([CX - r - 1, y0, ZA - r - 1], [CX + r + 1, y1, ZA], (x, y, z) => {
    const d = Math.hypot(x - CX, z - ZA)
    return z <= ZA && d <= r && d > rIn
  }, paint)
  halfDisc(7.5, F - 1, NAVE_TOP, WALL) // apse
  halfDisc(15.4, F - 1, AISLE_TOP, WALL) // ambulatory
  for (const tx of TOWERS) b.box([tx, F - 1, TZ0], [tx + 12, TOWER_TOP, ZF], WALL)

  // ------------------------------------------------------------------ interiors + vaults
  // Vaults as predicates. Each vessel is the union of pointed barrels: a longitudinal one
  // across the nave plus a transverse one per bay. Their union is a quadripartite (groin)
  // vault, which leaves room under each bay's lunette for a tall clerestory window, and the
  // crossing falls out for free as nave-barrel OR transept-barrel.
  const NX0 = CX - 5
  const NX1 = CX + 5
  const naveBays = [[28.5, 36.5], [36.5, 44.5], [58.5, 66.5], [66.5, 74.5], [74.5, 82.5], [82.5, 90.5], [90.5, 98.5], [98.5, 108]]
  const bayAt = zc => naveBays.find(([a, c]) => zc >= a && zc < c)
  const inNave = (x, z) => x >= NX0 && x <= NX1 && z >= ZA && z <= ZF - 2
  const inTrans = (x, z) => x >= CX - 24 && x <= CX + 24 && z >= ZN + 2 && z <= ZS - 2
  const inApse = (x, z) => z < ZA && Math.hypot(x - CX, z - ZA) <= 5.4
  const hLong = x => archH(x + 0.5 - NX0, 11)
  const hTrans = z => archH(z + 0.5 - (ZN + 2), 11)
  const hBay = (z, k = 1) => {
    const bay = bayAt(z + 0.5)
    return bay ? archH(z + 0.5 - bay[0], bay[1] - bay[0], k) : -1
  }
  const hApse = (x, z) => archH(5.5 - Math.hypot(x - CX, z - ZA), 11)
  const highVoid = (x, y, z) => {
    if (y < F + 1) return false
    const v = y + 0.5 - SPRING
    if (inNave(x, z) && (v <= 0 || v <= hLong(x) || v <= hBay(z))) return true
    if (inTrans(x, z) && (v <= 0 || v <= hTrans(z) || (x >= NX0 && x <= NX1 && v <= hLong(x)))) return true
    if (inApse(x, z) && (v <= 0 || v <= hApse(x, z))) return true
    return false
  }
  const inAisle = (x, z) => ((x >= CX - 13 && x <= CX - 8) || (x >= CX + 8 && x <= CX + 13)) && z >= ZA && z <= TZ0 - 1
  const inAmb = (x, z) => z < ZA && Math.hypot(x - CX, z - ZA) > 7.5 && Math.hypot(x - CX, z - ZA) <= 13.4
  const lowVoid = (x, y, z) => {
    if (y < F + 1) return false
    const v = y + 0.5 - ASPRING
    if (inAisle(x, z)) {
      const t = x < CX ? x + 0.5 - (CX - 13) : x + 0.5 - (CX + 8)
      return v <= 0 || v <= archH(t, 6) || v <= hBay(z, 0.8)
    }
    if (inAmb(x, z)) return v <= 0 || v <= archH(Math.hypot(x - CX, z - ZA) - 7.5, 6)
    return false
  }
  b.fillWhere([CX - 24, F + 1, ZA - 6], [CX + 24, NAVE_TOP, ZF - 2], highVoid, 'air')
  b.fillWhere([CX - 13, F + 1, ZA - 14], [CX + 13, AISLE_TOP, TZ0 - 1], lowVoid, 'air')
  for (const tx of TOWERS) b.clear([tx + 2, F + 1, TZ0 + 2], [tx + 10, TOWER_TOP - 1, ZF - 2])

  // ------------------------------------------------------------------ high roofs
  // Same width (15) and pitch (2) on nave and transept so the ridges meet at one height; the
  // apse gets a half cone with flare off whose rings line up with the gable's rows. coneRoof
  // has no mask, so it is drawn into a scratch module and copied back through a test.
  b.roof({ x0: CX - 7, x1: CX + 7, z0: ZA, z1: ZF, y: NAVE_TOP + 1, axis: 'z', material: ROOF, pitch: 2, overhang: 1, gableOverhang: 0, eaveTrim: true, gable: WALL })
  b.roof({ x0: CX - 26, x1: CX + 26, z0: ZN, z1: ZS, y: NAVE_TOP + 1, axis: 'x', material: ROOF, pitch: 2, overhang: 1, gableOverhang: 0, eaveTrim: true, gable: WALL })
  {
    const tmp = b.module(b.size)
    tmp.coneRoof([CX, NAVE_TOP + 1, ZA], 7, { material: ROOF, pitch: 2, overhang: 1, flare: false })
    copyFrom(tmp, (x, y, z) => z < ZA)
  }
  // attic fill between vault and roof so the vault has a ceiling, then re-carve the vault
  for (let x = CX - 24; x <= CX + 24; x += 1) {
    for (let z = ZA - 6; z <= ZF - 2; z += 1) {
      if (!inNave(x, z) && !inApse(x, z) && !inTrans(x, z)) continue
      const top = b.topY(x, z)
      for (let y = NAVE_TOP + 1; y < top; y += 1) b.set(x, y, z, WALL, { keep: true })
    }
  }
  b.fillWhere([CX - 24, NAVE_TOP + 1, ZA - 6], [CX + 24, NAVE_TOP + 8, ZF - 2], highVoid, 'air')
  // stone coping on the gables: a parapet one block proud of the roof slope
  const coping = (fixed, axis) => {
    for (let i = -9; i <= 9; i += 1) {
      const [x, z] = axis === 'x' ? [CX + i, fixed] : [fixed, ZT + i]
      const top = b.topY(x, z)
      if (top <= NAVE_TOP) continue
      b.set(x, top, z, WALL)
      const toward = axis === 'x' ? (i < 0 ? 'east' : 'west') : (i < 0 ? 'south' : 'north')
      b.set(x, top + 1, z, i === 0 ? WALL : st(WST, toward))
    }
  }
  coping(ZF, 'x')
  coping(CX - 26, 'z')
  coping(CX + 26, 'z')
  const cross = (x, y, z, alongX) => {
    for (let k = 0; k < 4; k += 1) b.set(x, y + k, z, 'minecraft:andesite_wall')
    for (const s of [-1, 1]) b.set(alongX ? x + s : x, y + 2, alongX ? z : z + s, 'minecraft:andesite_wall')
  }
  cross(CX, b.topY(CX, ZF) + 1, ZF, true)
  cross(CX - 26, b.topY(CX - 26, ZT) + 1, ZT, false)
  cross(CX + 26, b.topY(CX + 26, ZT) + 1, ZT, false)

  // Hollow the attic again (keep a 2-block vault shell under a 1-block roof) and frame it
  // with timber trusses on every bay line: invisible from outside, lovely in a cutaway.
  const roofish = blk => blk && /deepslate_tile/.test(blk.name)
  const inHigh = (x, z) => inNave(x, z) || inApse(x, z) || inTrans(x, z)
  for (let x = CX - 24; x <= CX + 24; x += 1) for (let z = ZA - 6; z <= ZF - 2; z += 1) {
    if (!inHigh(x, z)) continue
    let crown = SPRING
    while (crown < H - 1 && !b.get(x, crown, z)) crown += 1
    let bottom = b.topY(x, z)
    while (bottom > crown && roofish(b.get(x, bottom - 1, z))) bottom -= 1
    for (let y = crown + 2; y < bottom - 1; y += 1) b.remove(x, y, z)
  }
  const truss = (alongX, at) => {
    const [a0, a1, mid] = alongX ? [ZN + 2, ZS - 2, ZT] : [NX0, NX1, CX]
    const cell = (i, y) => (alongX ? [at, y, i] : [i, y, at])
    const empty = (i, y) => !b.get(...cell(i, y))
    const collar = NAVE_TOP + 11
    for (let i = a0; i <= a1; i += 1) {
      let y = SPRING
      while (y < H - 1 && empty(i, y)) y += 1 // through the vault void
      while (y < H - 1 && !empty(i, y)) y += 1 // through the vault shell
      const a = y // first attic cell
      while (y < H - 1 && empty(i, y)) y += 1
      const r = y // roof underside
      if (r >= H - 1 || r - a < 1) continue
      b.set(...cell(i, r - 1), 'minecraft:stripped_dark_oak_wood') // rafter under the tiles
      if (i === mid) for (let k = a; k < r - 1; k += 1) b.set(...cell(i, k), 'minecraft:dark_oak_log[axis=y]') // king post
      else if (collar >= a && collar < r - 1) b.set(...cell(i, collar), `minecraft:dark_oak_log[axis=${alongX ? 'z' : 'x'}]`)
    }
  }
  for (const z of [36, 44, 58, 66, 74, 82, 90, 98]) truss(false, z)
  for (const x of [CX - 20, CX - 13, CX + 13, CX + 20]) truss(true, x)

  // ------------------------------------------------------------------ lancet windows
  // One lancet generator for every pointed opening: a 2-deep reveal, glass on the inner
  // plane, upside-down stairs shaping the head (from 4x4 supersampled coverage), a hood
  // mould one block proud of the wall and a sloped sill. Depth comes from the reveal.
  const glassFor = (u, v, w, h) => {
    if (v >= h) return u === Math.floor(w / 2) ? 'minecraft:red_stained_glass_pane' : 'minecraft:purple_stained_glass_pane'
    if (v % 5 === 2) return u === Math.floor(w / 2) && w % 2 === 1 ? 'minecraft:yellow_stained_glass_pane' : 'minecraft:red_stained_glass_pane'
    return kit.hash01(u, v, w, 77) < 0.12 ? 'minecraft:purple_stained_glass_pane' : 'minecraft:blue_stained_glass_pane'
  }
  // o = bottom-left opening cell on the wall's outer plane (seen from outside).
  const lancet = (o, facing, { w = 3, h = 6, k = 1, depth = 2, hood = true, sill = true, mullion = false, louvre = false } = {}) => {
    const P = frame(o, facing)
    const left = cw(facing)
    const right = ccw(facing)
    const inward = opposite(facing)
    const head = headCells(w, k)
    const cells = []
    for (let v = 0; v < h; v += 1) for (let u = 0; u < w; u += 1) cells.push([u, v, 'open'])
    head.forEach((row, j) => row.forEach((kind, u) => { if (kind) cells.push([u, h + j, kind]) }))
    const open = new Set(cells.map(([u, v]) => `${u},${v}`))
    for (const [u, v, kind] of cells) {
      for (let d = 0; d < depth; d += 1) {
        const p = P(u, v, d)
        if (d === depth - 1) {
          if (louvre) b.set(...p, `minecraft:dark_oak_trapdoor[facing=${facing},half=top,open=false]`)
          else if (mullion && w >= 5 && u === Math.floor(w / 2) && v < h) b.set(...p, TRWALL)
          else b.set(...p, glassFor(u, v, w, h))
        } else if (kind === 'open') b.set(...p, 'air')
        else b.set(...p, st(TST, kind === 'L' ? left : right, 'top'))
      }
    }
    if (hood) {
      for (let v = h - 1; v <= h + head.length; v += 1) {
        for (let u = -1; u <= w; u += 1) {
          if (open.has(`${u},${v}`)) continue
          let near = false
          for (const [du, dv] of [[1, 0], [-1, 0], [0, -1], [1, -1], [-1, -1]]) if (open.has(`${u + du},${v + dv}`)) near = true
          if (near) b.set(...P(u, v, -1), st(TST, inward, 'top'), { keep: true })
        }
      }
    }
    if (sill) for (let u = 0; u < w; u += 1) b.set(...P(u, -1, 0), st(TST, inward))
  }
  // Lancet cut radially through a curved wall. theta = window axis (0 = east, 90 deg = north).
  const radialLancet = (theta, rIn, rOut, y0, { w = 3, h = 5, k = 1 } = {}) => {
    const ox = Math.cos(theta)
    const oz = -Math.sin(theta)
    const rx = oz
    const rz = -ox
    const head = headCells(w, k)
    const mid = (rIn + rOut) / 2
    const leftF = kit.facingFrom(-rx, -rz)
    const rightF = kit.facingFrom(rx, rz)
    for (let x = CX - Math.ceil(rOut) - 1; x <= CX + Math.ceil(rOut) + 1; x += 1) {
      for (let z = ZA - Math.ceil(rOut) - 1; z <= ZA; z += 1) {
        const dx = x - CX
        const dz = z - ZA
        const d = dx * ox + dz * oz
        const t = dx * rx + dz * rz
        if (d < rIn || d > rOut + 0.6 || Math.abs(t) > w / 2) continue
        const u = Math.max(0, Math.min(w - 1, Math.floor(t + w / 2)))
        for (let v = 0; v < h + head.length; v += 1) {
          const kind = v < h ? 'open' : head[v - h][u]
          if (!kind) continue
          const y = y0 + v
          if (d <= mid) b.set(x, y, z, glassFor(u, v, w, h))
          else if (kind === 'open') b.set(x, y, z, 'air')
          else b.set(x, y, z, st(TST, kind === 'L' ? leftF : rightF, 'top'))
        }
      }
    }
  }

  // ------------------------------------------------------------------ buttress modules
  // A flying buttress is pier + set-offs + pinnacle + gargoyle + flyer. The flyer lands on
  // the clerestory well above the aisle roof (a quarter-circle soffit under a straight,
  // rising coping) so the sky shows through: that gap is what makes it read as 'flying'.
  // Authored once for the WEST side (outward = -x), then stamped with rotation (and
  // resampled at arbitrary angles around the apse). Local x: 1..5 pier, 6 = aisle wall face,
  // 14 = clerestory wall face. Local y 0 = grade.
  const makeButtress = ({ flyer }) => {
    const m = b.module([15, 31, 3])
    const box = (x0, y0, x1, y1, paint) => m.box([x0, y0, 0], [x1, y1, 2], paint)
    box(1, 0, 5, 7, WALL)
    for (let z = 0; z < 3; z += 1) m.set(1, 8, z, st(WST, 'east'))
    box(2, 8, 5, 13, WALL)
    for (let z = 0; z < 3; z += 1) m.set(2, 14, z, st(WST, 'east'))
    box(3, 14, 5, 23, WALL)
    // pinnacle: trim cap, four gablets, spirelet, copper finial
    box(3, 24, 5, 24, TRIM)
    m.set(4, 25, 1, WALL)
    m.set(3, 25, 1, st(TST, 'east'))
    m.set(5, 25, 1, st(TST, 'west'))
    m.set(4, 25, 0, st(TST, 'south'))
    m.set(4, 25, 2, st(TST, 'north'))
    for (const [x, z] of [[3, 0], [5, 0], [3, 2], [5, 2]]) m.set(x, 25, z, 'minecraft:andesite_wall')
    m.set(4, 26, 1, WALL)
    m.set(4, 27, 1, 'minecraft:andesite_wall')
    m.set(4, 28, 1, 'minecraft:andesite_wall')
    m.set(4, 29, 1, 'minecraft:lightning_rod[facing=up]')
    // gargoyle: corbel + skull + copper spout
    m.set(2, 21, 1, st(TST, 'east', 'top'))
    m.set(2, 22, 1, 'minecraft:skeleton_skull[rotation=4]')
    m.set(1, 21, 1, 'minecraft:lightning_rod[facing=west]')
    if (flyer) {
      // quarter-circle soffit springing from the pier; straight coping rising to the wall
      for (let x = 6; x <= 13; x += 1) {
        const B = 13 + Math.sqrt(64 - (x + 0.5 - 14) ** 2)
        const T = Math.floor(21 + ((x - 6) * 3) / 7)
        const yb = Math.ceil(B)
        for (let y = yb; y <= T; y += 1) for (let z = 0; z < 3; z += 1) {
          if (z !== 1 && y === yb) continue // the centre rib hangs one block lower
          m.set(x, y, z, WALL)
        }
        m.set(x, yb, 1, st(WST, 'west', 'top'))
        const nextT = Math.floor(21 + ((x + 1 - 6) * 3) / 7)
        if (nextT > T && x < 13) for (let z = 0; z < 3; z += 1) m.set(x, T + 1, z, st(WST, 'east'))
      }
    }
    return m
  }
  const flyMod = makeButtress({ flyer: true })
  const pierMod = makeButtress({ flyer: false })
  for (const pz of [65, 73, 81, 89, 35]) {
    b.stamp(flyMod, [CX - 21, F - 1, pz])
    b.stamp(flyMod, [CX + 7, F - 1, pz], { rotate: 2 }) // mirror image for the east side
  }
  for (const s of [-1, 1]) {
    const ax = CX + s * 20
    b.stamp(pierMod, [ax - 1, F - 1, ZN - 6], { rotate: 1 }) // north faces of the transept arms
    b.stamp(pierMod, [ax - 1, F - 1, ZS - 8], { rotate: 3 }) // south faces
  }
  // transept end corners
  for (const z of [ZN, ZS - 2]) {
    b.stamp(pierMod, [CX - 32, F - 1, z])
    b.stamp(pierMod, [CX + 18, F - 1, z], { rotate: 2 })
  }
  // Radial flyers around the apse: the same module resampled along any angle.
  const stampPolar = (mod, theta) => {
    const ox = Math.cos(theta)
    const oz = -Math.sin(theta)
    const rx = oz
    const rz = -ox
    const turns = { west: 0, north: 1, east: 2, south: 3 }[kit.facingFrom(ox, oz)]
    for (let x = CX - 22; x <= CX + 22; x += 1) {
      for (let z = ZA - 22; z <= ZA; z += 1) {
        const dx = x - CX
        const dz = z - ZA
        const lx = Math.round(21 - (dx * ox + dz * oz))
        const lz = Math.round(dx * rx + dz * rz) + 1
        if (lx < 0 || lx > 14 || lz < 0 || lz > 2) continue
        for (let ly = 0; ly < mod.size[1]; ly += 1) {
          const blk = mod.get(lx, ly, lz)
          if (blk) b.set(x, F - 1 + ly, z, kit.rotate(blk, turns))
        }
      }
    }
  }
  for (const deg of [36, 72, 108, 144]) stampPolar(flyMod, (deg * Math.PI) / 180)

  // ------------------------------------------------------------------ low roofs (after the buttresses)
  // Lean-to aisle roofs at pitch 0.5 with overwrite:false, so piers, flyers and walls that
  // already exist are kept. Split around the transept or the roof would run through it.
  for (const [x0, rises] of [[CX - 15, 'east'], [CX + 8, 'west']]) {
    for (const [z0, z1] of [[ZA, ZN - 1], [ZS + 1, TZ0 - 1]]) {
      b.roof({ x0, x1: x0 + 7, z0, z1, y: AISLE_TOP + 1, axis: 'z', type: 'shed', rises, material: ROOF, pitch: 0.5, overhang: 1, gableOverhang: 0, eaveTrim: true, overwrite: false })
    }
  }
  {
    const tmp = b.module(b.size)
    tmp.coneRoof([CX, AISLE_TOP + 1, ZA], 15, { material: ROOF, pitch: 0.5, overhang: 1, flare: false })
    copyFrom(tmp, (x, y, z) => z < ZA && Math.hypot(x - CX, z - ZA) > 7.6, { keep: true })
  }

  // ------------------------------------------------------------------ windows
  for (const z0 of BAYS) {
    lancet([CX - 15, F + 2, z0 + 1], 'west', { w: 3, h: 5 })
    lancet([CX + 15, F + 2, z0 + 3], 'east', { w: 3, h: 5 })
    lancet([CX - 7, F + 16, z0], 'west', { w: 5, h: 5, k: 0.85, mullion: true })
    lancet([CX + 7, F + 16, z0 + 4], 'east', { w: 5, h: 5, k: 0.85, mullion: true })
  }
  for (const deg of [18, 54, 90, 126, 162]) {
    const th = (deg * Math.PI) / 180
    radialLancet(th, 5.5, 7.5, F + 16, { w: 3, h: 6 })
    radialLancet(th, 13.4, 15.4, F + 2, { w: 3, h: 5 })
  }
  // transept arms: tall lancets either side of the middle buttress
  for (const s of [-1, 1]) {
    for (const x0 of s < 0 ? [CX - 24, CX - 18] : [CX + 16, CX + 22]) {
      lancet([x0 + 2, F + 3, ZN], 'north', { w: 3, h: 12, k: 1.2 })
      lancet([x0, F + 3, ZS], 'south', { w: 3, h: 12, k: 1.2 })
    }
  }

  // ------------------------------------------------------------------ arcades (nave <-> aisles)
  for (const z0 of BAYS) {
    for (const x of [CX - 7, CX - 6, CX + 6, CX + 7]) {
      for (let v = 0; v < 6; v += 1) for (let u = 0; u < 5; u += 1) b.set(x, F + 1 + v, z0 + u, 'air')
      headCells(5, 1).forEach((row, j) => row.forEach((kind, u) => {
        const y = F + 7 + j
        if (kind === 'open') b.set(x, y, z0 + u, 'air')
        else if (kind) b.set(x, y, z0 + u, st(TST, kind === 'L' ? 'north' : 'south', 'top'))
      }))
    }
  }
  // apse arcade: openings between the radial piers into the ambulatory
  for (const deg of [18, 54, 90, 126, 162]) {
    const th = (deg * Math.PI) / 180
    const ox = Math.cos(th)
    const oz = -Math.sin(th)
    for (let x = CX - 8; x <= CX + 8; x += 1) for (let z = ZA - 8; z < ZA; z += 1) {
      const dx = x - CX
      const dz = z - ZA
      const d = dx * ox + dz * oz
      const t = dx * oz - dz * ox
      if (d < 5 || d > 8 || Math.abs(t) > 1.6) continue
      for (let y = F + 1; y <= F + 8 - (Math.abs(t) > 0.6 ? 1 : 0); y += 1) b.set(x, y, z, 'air')
    }
  }
  // tower bases open into the aisles and the nave
  for (const tx of TOWERS) {
    const west = tx < CX
    b.clear([west ? tx + 6 : tx + 2, F + 1, TZ0], [west ? tx + 10 : tx + 6, F + 8, TZ0 + 1])
    b.clear([west ? tx + 11 : tx - 1, F + 1, TZ0 + 4], [west ? tx + 13 : tx + 1, F + 8, TZ0 + 8])
  }

  // ------------------------------------------------------------------ towers
  // Three stages divided by projecting string courses (portal / window / belfry), angle
  // buttresses that step back at each stage, louvred belfry lancets, then a parapet with
  // corner pinnacles that masks the spire's base.
  for (const tx of TOWERS) {
    const outer = tx < CX ? 'west' : 'east'
    const cx = tx + 6
    for (const y of [F + 16, F + 32, TOWER_TOP]) {
      for (let x = tx - 1; x <= tx + 13; x += 1) {
        for (let z = TZ0 - 1; z <= ZF + 1; z += 1) {
          const onX = x === tx - 1 || x === tx + 13
          const onZ = z === TZ0 - 1 || z === ZF + 1
          if (!(onX || onZ) || (onX && onZ)) continue
          const f = x === tx - 1 ? 'east' : x === tx + 13 ? 'west' : z === TZ0 - 1 ? 'south' : 'north'
          b.set(x, y, z, st(TST, f, 'top'), { keep: true })
        }
      }
    }
    lancet([cx - 1, F + 19, ZF], 'south', { w: 3, h: 7 })
    // blind arcading: recessed one-light panels either side of the stage-2 window
    for (const off of [-4, 4]) {
      const P = frame([cx + off, F + 19, ZF], 'south')
      for (let v = 0; v < 8; v += 1) b.set(...P(0, v, 0), v === 7 ? st(TST, 'north', 'top') : 'air')
      b.set(...P(0, -1, 0), st(TST, 'north'))
    }
    // gargoyles at the four top corners, looking out diagonally
    for (const [gx, gz, rot] of [[tx - 1, ZF + 1, 14], [tx + 13, ZF + 1, 2], [tx - 1, TZ0 - 1, 10], [tx + 13, TZ0 - 1, 6]]) {
      b.set(gx, TOWER_TOP - 1, gz, st(TST, gz > ZF ? 'north' : 'south', 'top'))
      b.set(gx, TOWER_TOP, gz, `minecraft:skeleton_skull[rotation=${rot}]`)
    }
    lancet(outer === 'west' ? [tx, F + 19, TZ0 + 7] : [tx + 12, F + 19, TZ0 + 5], outer, { w: 3, h: 7 })
    for (const f of ['south', 'north', 'east', 'west']) {
      for (const off of [-3, 1]) {
        let o
        if (f === 'south') o = [cx + off, F + 35, ZF]
        else if (f === 'north') o = [cx - off, F + 35, TZ0]
        else if (f === 'west') o = [tx, F + 35, TZ0 + 6 - off]
        else o = [tx + 12, F + 35, TZ0 + 6 + off]
        lancet(o, f, { w: 3, h: 10, k: 1.3, louvre: true })
      }
    }
    // angle buttresses: two per free corner, stepping back at the stage lines
    const ox = outer === 'west' ? tx : tx + 12
    const corners = [[tx, ZF, 'south'], [tx + 12, ZF, 'south'], [ox, ZF, outer], [ox, TZ0, outer], [ox, TZ0, 'north']]
    for (const [x, z, f] of corners) {
      const d = DIR[f]
      const inward = opposite(f)
      const along = f === 'south' || f === 'north' ? [x === tx ? 1 : -1, 0] : [0, z === TZ0 ? 1 : -1]
      for (let i = 0; i < 2; i += 1) {
        const bx = x + along[0] * i
        const bz = z + along[1] * i
        for (let y = F - 1; y <= F + 32; y += 1) {
          const depth = y <= F + 15 ? 2 : y <= F + 31 ? 1 : 0
          for (let k = 1; k <= depth; k += 1) b.set(bx + d[0] * k, y, bz + d[2] * k, WALL)
          if (y === F + 16) b.set(bx + d[0] * 2, y, bz + d[2] * 2, st(WST, inward))
          if (y === F + 32) b.set(bx + d[0], y, bz + d[2], st(WST, inward))
        }
      }
    }
    // parapet with corner pinnacles around the spire
    for (let x = tx; x <= tx + 12; x += 1) for (let z = TZ0; z <= ZF; z += 1) {
      if (x === tx || x === tx + 12 || z === TZ0 || z === ZF) b.set(x, TOWER_TOP + 1, z, 'minecraft:stone_brick_wall')
    }
    for (const [x, z] of [[tx, TZ0], [tx + 11, TZ0], [tx, ZF - 1], [tx + 11, ZF - 1]]) {
      b.box([x, TOWER_TOP + 1, z], [x + 1, TOWER_TOP + 3, z + 1], WALL)
      b.set(x, TOWER_TOP + 4, z, st(TST, 'south'))
      b.set(x + 1, TOWER_TOP + 4, z, st(TST, 'west'))
      b.set(x, TOWER_TOP + 4, z + 1, st(TST, 'east'))
      b.set(x + 1, TOWER_TOP + 4, z + 1, st(TST, 'north'))
      const px = x + (x < tx + 6 ? 0 : 1)
      const pz = z + (z < TZ0 + 6 ? 0 : 1)
      b.set(px, TOWER_TOP + 5, pz, 'minecraft:andesite_wall')
      b.set(px, TOWER_TOP + 6, pz, 'minecraft:andesite_wall')
      b.set(px, TOWER_TOP + 7, pz, 'minecraft:lightning_rod[facing=up]')
    }
  }

  // ------------------------------------------------------------------ spires
  // Octagonal hollow spires; every exposed step becomes a stair so the taper reads as a
  // slope, crockets every 3 rows on the eight arrises, lucarnes (gabled dormers) at the foot.
  const spire = (cx, y0, cz, r0, h, paint, stairs, { crockets = 0, lucarnes = false } = {}) => {
    const rAt = y => r0 * (1 - (y - y0) / h) + 0.35
    const inside = (x, y, z) => y >= y0 && y < y0 + h && octIn(x - cx, z - cz, rAt(y))
    b.fillWhere([cx - r0 - 1, y0, cz - r0 - 1], [cx + r0 + 1, y0 + h, cz + r0 + 1], inside, paint, { hollow: true })
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = cx - r0 - 1; x <= cx + r0 + 1; x += 1) for (let z = cz - r0 - 1; z <= cz + r0 + 1; z += 1) {
        if (!inside(x, y, z) || inside(x, y + 1, z) || (x === cx && z === cz)) continue
        b.set(x, y, z, st(stairs, kit.facingFrom(cx - x, cz - z)))
      }
    }
    if (crockets) {
      for (let y = y0 + 2; y < y0 + h - 3; y += crockets) {
        for (let k = 0; k < 8; k += 1) {
          const a = ((22.5 + 45 * k) * Math.PI) / 180
          let last = null
          for (let s = 0; s <= r0 + 1; s += 0.25) {
            const x = Math.round(cx + Math.cos(a) * s)
            const z = Math.round(cz + Math.sin(a) * s)
            if (inside(x, y, z)) last = [x, z]
          }
          if (!last) continue
          const ex = Math.round(cx + Math.cos(a) * (Math.hypot(last[0] - cx, last[1] - cz) + 1))
          const ez = Math.round(cz + Math.sin(a) * (Math.hypot(last[0] - cx, last[1] - cz) + 1))
          b.set(ex, y, ez, st(TST, kit.facingFrom(cx - ex, cz - ez)), { keep: true })
        }
      }
    }
    if (lucarnes) {
      for (const f of ['north', 'south', 'east', 'west']) {
        const d = DIR[f]
        const P = frame([cx + d[0] * (r0 + 1) - DIR[ccw(f)][0], y0, cz + d[2] * (r0 + 1) - DIR[ccw(f)][2]], f)
        for (let u = 0; u < 3; u += 1) for (let v = 0; v < 4; v += 1) for (let dd = 0; dd < 3; dd += 1) b.set(...P(u, v, dd), WALL)
        b.set(...P(1, 1, 0), 'air')
        b.set(...P(1, 2, 0), 'air')
        b.set(...P(1, 1, 1), 'air')
        b.set(...P(1, 2, 1), 'air')
        for (let dd = 0; dd < 3; dd += 1) {
          b.set(...P(0, 4, dd), st(TST, ccw(f)))
          b.set(...P(2, 4, dd), st(TST, cw(f)))
          b.set(...P(1, 4, dd), TRIM)
          b.set(...P(1, 5, dd), st(TST, opposite(f)))
        }
        b.set(...P(1, 5, 0), 'minecraft:andesite_wall')
        b.set(...P(1, 6, 0), 'minecraft:lightning_rod[facing=up]')
      }
    }
    return y0 + h
  }
  for (const tx of TOWERS) {
    const top = spire(tx + 6, TOWER_TOP + 1, TZ0 + 6, 5, 28, WALL, WST, { crockets: 3, lucarnes: true })
    cross(tx + 6, top, TZ0 + 6, true)
  }
  // crossing spire (fleche): open copper drum with a bell, then a slender copper needle
  {
    const cz = ZT
    const drum0 = NAVE_TOP + 10
    const drum1 = NAVE_TOP + 19
    b.fillWhere([CX - 4, drum0, cz - 4], [CX + 4, drum1, cz + 4], (x, y, z) => octIn(x - CX, z - cz, 3.3), COPPER, { hollow: true })
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2], [2, -2], [-2, -2]]) {
      for (let y = drum0 + 3; y <= drum1 - 2; y += 1) b.set(CX + dx, y, cz + dz, 'air')
    }
    for (let y = drum0 + 5; y <= drum1 - 1; y += 1) b.set(CX, y, cz, 'minecraft:chain[axis=y]')
    b.set(CX, drum0 + 4, cz, 'minecraft:bell[attachment=ceiling,facing=north]')
    const top = spire(CX, drum1 + 1, cz, 3, 22, COPPER, COPPER_ST, { crockets: 4 })
    b.set(CX, top, cz, 'minecraft:lightning_rod[facing=up]')
    b.set(CX, top + 1, cz, 'minecraft:lightning_rod[facing=up]')
  }

  // ------------------------------------------------------------------ west facade
  // Rose window: a moulded ring flush with the wall, then one recessed layer where light
  // tracery (hub, inner ring, spokes) and full stained-glass blocks share the same plane.
  const rose = (c, facing, R, { spokes = 8 } = {}) => {
    const P = frame(c, facing)
    const n = Math.ceil(R) + 1
    for (let u = -n; u <= n; u += 1) {
      for (let v = -n; v <= n; v += 1) {
        const r = Math.hypot(u, v)
        if (r > R + 0.45) continue
        if (r > R - 0.5) {
          b.set(...P(u, v, 0), TRACERY)
          b.set(...P(u, v, 1), TRIM)
          continue
        }
        const a = Math.atan2(v, u)
        const sector = ((a / (2 * Math.PI)) * spokes + spokes) % spokes
        const off = Math.abs(sector - Math.round(sector))
        const spokeDist = off * ((2 * Math.PI) / spokes) * r
        const hub = r < 0.6
        const ring = Math.abs(r - R * 0.42) < 0.45
        const spoke = r > R * 0.42 && spokeDist < 0.42
        b.set(...P(u, v, 0), 'air')
        let g = 'blue'
        if (r < R * 0.42) g = 'yellow'
        else if (r < R * 0.6) g = 'red'
        else if (Math.abs(off - 0.5) < 0.15 && r > R * 0.75) g = 'red'
        b.set(...P(u, v, 1), hub || ring || spoke ? TRIM : `minecraft:${g}_stained_glass`)
      }
    }
  }
  // Recessed pointed panel inside the bay between the towers, holding the rose: an
  // archivolt band one block proud of the recess frames it (light trim against the shadow).
  {
    const w = 11
    const P = frame([CX - 5, F + 15, ZF], 'south')
    const head = headCells(w, 1)
    const band = headCells(w + 2, 1)
    for (let v = 0; v < 6 + band.length; v += 1) for (let u = -1; u <= w; u += 1) {
      const inner = v < 6 ? (u >= 0 && u < w ? 'open' : null) : head[v - 6]?.[u] ?? null
      const outer = v < 6 ? 'open' : band[v - 6]?.[u + 1] ?? null
      if (inner) {
        b.set(...P(u, v, 0), inner === 'open' ? 'air' : st(TST, inner === 'L' ? 'west' : 'east', 'top'))
        b.set(...P(u, v, 1), WALL, { keep: true }) // the recess must not open into the attic
      }
      else if (outer) b.set(...P(u, v, 0), TRIM)
    }
    rose([CX, F + 21, ZF - 1], 'south', 5)
  }

  // Portal with stepped archivolts and a crocketed gable (wimperg).
  // o = bottom-centre cell of the innermost opening on the wall's outer plane.
  const portal = (o, facing, { w = 5, spring = 6, layers = 3, porch = 13 } = {}) => {
    const P = frame(o, facing)
    const inward = opposite(facing)
    const half = (w - 1) / 2
    const ph = (porch - 1) / 2
    for (let L = 0; L < layers; L += 1) {
      const wl = w + 2 * L
      const hl = (wl - 1) / 2
      const head = headCells(wl, 1)
      const band = headCells(wl + 2, 1)
      const d = -L
      const ringMat = L % 2 === 0 ? TRIM : 'minecraft:stone_bricks'
      const top = spring + ph * 2 + 1
      for (let u = -ph; u <= ph; u += 1) {
        for (let v = 0; v <= top; v += 1) {
          const p = P(u, v, d)
          const au = Math.abs(u)
          let kind = 'body'
          if (v < spring) {
            if (au <= hl) kind = 'open'
            else if (au === hl + 1) kind = 'jamb'
          } else {
            const j = v - spring
            const hk = head[j]?.[u + hl]
            const bk = band[j]?.[u + hl + 1]
            if (au <= hl && hk) kind = hk
            else if (au <= hl + 1 && bk) kind = 'band'
          }
          const gableHalf = ph - Math.max(0, v - spring) / 2
          if (L > 0 && kind === 'body') {
            if (au > gableHalf + 0.25) continue
            if (au > gableHalf - 0.75) {
              b.set(...p, st(TST, u < 0 ? ccw(facing) : cw(facing)))
              continue
            }
          }
          if (L === 0 && kind === 'body') continue
          if (kind === 'open') b.set(...p, 'air')
          else if (kind === 'jamb') b.set(...p, v === spring - 1 ? 'minecraft:chiseled_stone_bricks' : L === layers - 1 ? TRIM : 'minecraft:stone_brick_wall')
          else if (kind === 'band') b.set(...p, ringMat)
          else if (kind === 'L' || kind === 'R') b.set(...p, st(TST, kind === 'L' ? cw(facing) : ccw(facing), 'top'))
          else b.set(...p, WALL)
        }
      }
    }
    // doors, trumeau, lintel and tympanum one block inside the facade plane
    const head = headCells(w, 1)
    for (let u = -half; u <= half; u += 1) {
      for (let v = 0; v < spring + head.length; v += 1) {
        const kind = v >= spring ? head[v - spring][u + half] : 'open'
        if (!kind) continue
        const p = P(u, v, 1)
        if (v === 2) b.set(...p, 'minecraft:polished_andesite_slab[type=top]')
        else if (v > 2) b.set(...p, 'minecraft:chiseled_tuff_bricks')
        else if (u === 0 && w >= 5) b.set(...p, TRIM)
        else b.set(...p, 'air')
      }
    }
    if (w >= 5) {
      b.door(P(-half, 0, 1), facing, { material: 'dark_oak', width: 2 })
      b.door(P(1, 0, 1), facing, { material: 'dark_oak', width: 2 })
    } else {
      b.door(P(-1, 0, 1), facing, { material: 'dark_oak', width: 2 })
      b.set(...P(1, 0, 1), 'air')
      b.set(...P(1, 1, 1), 'air')
    }
    const apex = P(0, spring + ph * 2 + 1, -(layers - 1))
    b.set(...apex, 'minecraft:chiseled_stone_bricks')
    b.set(apex[0], apex[1] + 1, apex[2], 'minecraft:andesite_wall')
    b.set(apex[0], apex[1] + 2, apex[2], 'minecraft:lightning_rod[facing=up]')
    for (let u = -ph; u <= ph; u += 1) {
      for (let L = 0; L < layers; L += 1) b.set(...P(u, -1, -L), TRIM) // porch floor
      b.set(...P(u, -1, -layers), st(TST, inward)) // threshold step
    }
    // lanterns flanking the door
    for (const s of [-1, 1]) {
      const p = P(s * (ph + 1), 3, -1)
      b.set(...p, st(TST, inward, 'top'), { keep: true })
      b.set(p[0], p[1] + 1, p[2], 'minecraft:lantern[hanging=false]', { keep: true })
    }
  }
  portal([CX, F + 1, ZF], 'south', { w: 5, spring: 6, layers: 3, porch: 13 })
  for (const tx of TOWERS) portal([tx + 6, F + 1, ZF], 'south', { w: 3, spring: 5, layers: 2, porch: 9 })

  // ------------------------------------------------------------------ transept facades
  for (const [x, f] of [[CX - 26, 'west'], [CX + 26, 'east']]) {
    portal([x, F + 1, ZT], f, { w: 3, spring: 5, layers: 2, porch: 9 })
    rose([x, F + 20, ZT], f, 4.5)
  }

  // ------------------------------------------------------------------ vault ribs and shafts
  // Every ceiling cell that lies on a transverse line, a groin (where two barrels meet) or the
  // ridge becomes a pale rib; slim shafts carry the ribs down the piers to the floor.
  const RIB = TRACERY
  for (let x = CX - 24; x <= CX + 24; x += 1) for (let z = ZA - 6; z <= ZF - 2; z += 1) {
    for (let y = SPRING + 1; y <= NAVE_TOP + 9; y += 1) {
      if (!b.get(x, y, z) || b.get(x, y - 1, z) || !highVoid(x, y - 1, z)) continue
      let rib = false
      if (inNave(x, z) && !inTrans(x, z)) {
        const bay = bayAt(z + 0.5)
        const lz = bay ? z + 0.5 - bay[0] : -9
        rib = (bay && (lz < 0.6 || bay[1] - (z + 0.5) < 0.6)) || Math.abs(hLong(x) - hBay(z)) < 0.9 || x === CX
      } else if (inTrans(x, z)) {
        const crossing = x >= NX0 && x <= NX1
        rib = z === ZT || (crossing ? Math.abs(hLong(x) - hTrans(z)) < 0.9 || x === CX : [CX - 6, CX - 14, CX - 22, CX + 6, CX + 14, CX + 22].includes(x))
      } else if (inApse(x, z)) {
        const ang = (Math.atan2(ZA - z, x - CX) * 180) / Math.PI
        const d = Math.hypot(x - CX, z - ZA)
        rib = d < 1 || [0, 36, 72, 108, 144, 180].some(a => Math.abs(((ang - a) * Math.PI) / 180) * d < 0.6)
      }
      if (rib) b.set(x, y, z, RIB)
    }
  }
  for (const z of [36, 44, 58, 66, 74, 82, 90]) {
    for (const x of [NX0, NX1]) {
      for (let y = F + 1; y < SPRING; y += 1) b.set(x, y, z, TRWALL)
      b.set(x, SPRING, z, RIB)
    }
  }

  // ------------------------------------------------------------------ texture
  // One graded ramp over the whole build: base/edge/drip darkening and coherent clumps come
  // from b.texture; focus lightens the stone round the main portal (the hero area).
  b.texture([0, F - 1, 0], [W - 1, H - 1, L - 1], ['polished_andesite', 'andesite', 'stone_bricks', 'tuff_bricks', 'deepslate_bricks'], {
    only: 'mud_brick*', mid: 0.42, base: 0.28, top: 0.3, edge: 0.08, drip: 0.12, focus: [[CX, F + 12, ZF + 2]], focusRadius: 14, focusAmount: 0.15,
  })
  const MASONRY = ['minecraft:polished_andesite', 'minecraft:andesite', 'minecraft:stone_bricks', 'minecraft:tuff_bricks', 'minecraft:deepslate_bricks']
  // plinth: the bottom three courses in dark deepslate
  b.replace([0, F - 1, 0], [W - 1, F + 1, L - 1], MASONRY, kit.palette({ deepslate_bricks: 5, cobbled_deepslate: 3, polished_deepslate: 2 }, { scale: 2 }))
  // water table: a sloped deepslate skirt wherever a wall meets the ground outside
  const isMasonry = blk => blk && /(deepslate|andesite|stone_bricks|tuff)/.test(blk.name) && !/_(stairs|slab|wall)$/.test(blk.name)
  for (let x = 1; x < W - 1; x += 1) for (let z = 1; z < L - 1; z += 1) {
    if (b.get(x, F, z)) continue
    for (const f of ['north', 'south', 'east', 'west']) {
      const d = DIR[f]
      if (!isMasonry(b.get(x + d[0], F, z + d[2])) || !isMasonry(b.get(x + d[0], F + 1, z + d[2]))) continue
      b.set(x, F, z, st('minecraft:deepslate_brick_stairs', f))
      break
    }
  }
  b.weather([0, F - 1, 0], [W - 1, F + 6, L - 1], { amount: 0.18, mossBias: 0.7, scale: 3 })


  // ------------------------------------------------------------------ interior
  // Furnished for the cutaway: checker floor in the main vessel, pews facing the altar, a
  // single red runner, choir stalls, a raised sanctuary, and light on every bay.
  const vessel = (x, z) => inNave(x, z) || inTrans(x, z) || inApse(x, z)
  for (let x = CX - 25; x <= CX + 25; x += 1) for (let z = ZA - 15; z <= ZF - 1; z += 1) {
    if (b.get(x, F + 1, z) || !b.get(x, F, z) || b.topY(x, z) < F + 8) continue
    const checker = (Math.floor(x / 2) + Math.floor(z / 2)) % 2 === 0
    b.set(x, F, z, vessel(x, z) ? (checker ? 'minecraft:polished_andesite' : 'minecraft:polished_deepslate') : 'minecraft:polished_andesite')
  }
  // pews facing the altar (stairs: the tall back is on the south side)
  for (let z = 62; z <= 95; z += 2) {
    for (const x0 of [CX - 4, CX + 2]) for (let x = x0; x < x0 + 3; x += 1) b.set(x, F + 1, z, st('minecraft:dark_oak_stairs', 'south'))
  }
  for (let z = ZA + 1; z <= ZF - 2; z += 1) if (!b.get(CX, F + 1, z)) b.set(CX, F + 1, z, 'minecraft:red_carpet')
  // choir stalls with panelled backs
  for (const z0 of [30, 38]) for (let z = z0; z < z0 + 5; z += 1) {
    b.set(CX - 4, F + 1, z, st('minecraft:dark_oak_stairs', 'west'))
    b.set(CX + 4, F + 1, z, st('minecraft:dark_oak_stairs', 'east'))
    for (const x of [CX - 5, CX + 5]) {
      b.set(x, F + 1, z, 'minecraft:dark_oak_planks')
      b.set(x, F + 2, z, 'minecraft:dark_oak_planks')
      b.set(x, F + 3, z, 'minecraft:dark_oak_slab[type=bottom]')
    }
  }
  // sanctuary: a raised dais in the apse, white altar, candles and a gold cross
  b.fillWhere([CX - 6, F + 1, ZA - 6], [CX + 6, F + 1, ZA - 1], (x, y, z) => inApse(x, z), TRIM)
  for (let x = CX - 4; x <= CX + 4; x += 1) b.set(x, F + 1, ZA, st(TST, 'north'))
  for (let z = ZA - 3; z <= ZA - 1; z += 1) b.set(CX, F + 2, z, 'minecraft:red_carpet')
  b.box([CX - 2, F + 2, ZA - 4], [CX + 2, F + 2, ZA - 4], TRACERY)
  b.set(CX - 2, F + 3, ZA - 4, 'minecraft:candle[candles=3,lit=true]')
  b.set(CX + 2, F + 3, ZA - 4, 'minecraft:candle[candles=3,lit=true]')
  b.set(CX, F + 3, ZA - 4, 'minecraft:candle[candles=1,lit=true]')
  for (let y = F + 4; y <= F + 8; y += 1) b.set(CX, y, ZA - 5, 'minecraft:gold_block')
  b.set(CX - 1, F + 7, ZA - 5, 'minecraft:gold_block')
  b.set(CX + 1, F + 7, ZA - 5, 'minecraft:gold_block')
  for (const x of [CX - 4, CX + 4]) b.set(x, F + 2, ZA - 2, 'minecraft:candle[candles=4,lit=true]')
  // lectern at the crossing, font by the west door
  b.set(CX + 3, F + 1, ZT + 3, 'minecraft:lectern[facing=south]')
  b.set(CX, F + 1, ZF - 5, TRIM)
  b.set(CX, F + 2, ZF - 5, 'minecraft:water_cauldron[level=3]')
  // light: lanterns on long chains from every vault crown, and in each aisle bay
  const hang = (x, z, lanternY) => {
    let y = lanternY + 1
    while (y < H - 1 && !b.get(x, y, z)) y += 1
    for (let k = lanternY + 1; k < y; k += 1) b.set(x, k, z, 'minecraft:chain[axis=y]')
    b.set(x, lanternY, z, 'minecraft:lantern[hanging=true]')
  }
  // Lanterns hung right behind the glass (aisle and clerestory) light the interior AND make
  // the stained glass glow from outside at night; light never 'leaks' out unexplained.
  for (const z of [32, 40, 62, 70, 78, 86, 94]) {
    hang(CX, z, F + 13)
    for (const x of [CX - 13, CX + 13]) hang(x, z, F + 6)
    for (const x of [NX0, NX1]) hang(x, z, F + 19)
  }
  hang(CX, ZT, F + 11)
  // candle stands at the four crossing piers and in the transept arms
  for (const [x, z] of [[NX0, ZN + 2], [NX1, ZN + 2], [NX0, ZS - 2], [NX1, ZS - 2], [CX - 19, ZT - 3], [CX - 19, ZT + 3], [CX + 19, ZT - 3], [CX + 19, ZT + 3]]) {
    b.set(x, F + 1, z, TRWALL)
    b.set(x, F + 2, z, TRWALL)
    b.set(x, F + 3, z, 'minecraft:lantern[hanging=false]')
  }
  hang(CX - 13, ZT, F + 12)
  hang(CX + 13, ZT, F + 12)
  hang(CX, ZF - 3, F + 18) // lights the rose from inside
  for (const deg of [18, 54, 90, 126, 162]) {
    const th = (deg * Math.PI) / 180
    hang(Math.round(CX + Math.cos(th) * 12.6), Math.round(ZA - Math.sin(th) * 12.6), F + 6)
    hang(Math.round(CX + Math.cos(th) * 4.6), Math.round(ZA - Math.sin(th) * 4.6), F + 19)
  }

  // ------------------------------------------------------------------ landscape
  // The close: a forecourt that gives the facade breathing room, paths that connect every
  // door, a graveyard that tells the building's age, trees in three sizes at the corners.
  const G = F - 1 // grade
  const free = (x, z) => !b.get(x, G + 1, z)
  // forecourt: paved plaza with a labyrinth inlay echoing the rose window
  const PZ0 = ZF + 4
  const LZ = PZ0 + 8
  const paving = kit.palette({ stone_bricks: 5, andesite: 2, cracked_stone_bricks: 1, tuff_bricks: 1 }, { scale: 3, seed: 5 })
  for (let x = 2; x <= W - 3; x += 1) for (let z = ZF - 1; z <= L - 3; z += 1) {
    if (!free(x, z) && z < PZ0) continue
    if (z < PZ0 && (x > CX - 22 && x < CX + 22)) { if (free(x, z)) b.set(x, G, z, paving); continue }
    if (z < PZ0) continue
    const d = Math.hypot(x - CX, z - LZ)
    let p = paving
    if (x <= 3 || x >= W - 4 || z >= L - 4) p = 'minecraft:polished_deepslate'
    else if (d <= 6.5) p = Math.floor(d) % 2 === 0 ? 'minecraft:polished_deepslate' : 'minecraft:polished_andesite'
    else if (Math.abs(x - CX) <= 2 && z < LZ) p = 'minecraft:polished_andesite'
    else if (d <= 7.5) p = 'minecraft:polished_andesite'
    b.set(x, G, z, p)
  }
  b.set(CX, G, LZ, 'minecraft:chiseled_stone_bricks')
  // flanking paths to the transept doors and round the east end
  const pathPaint = kit.palette({ gravel: 3, coarse_dirt: 2, dirt_path: 2, andesite: 1 }, { scale: 2, seed: 9 })
  b.path([[8, PZ0], [7, 95], [8, 70], [8, ZT], [7, 30], [10, 8], [CX, 3], [W - 11, 8], [W - 8, 30], [W - 8, ZT], [W - 7, 63]], { width: 3, paint: pathPaint, seed: 3 })
  b.path([[W - 9, PZ0], [W - 9, 104], [W - 9, 74]], { width: 3, paint: pathPaint, seed: 4, jitter: 0.2 })
  // graveyard on the sunny south-east lawn, inside a low mossy wall
  const GX0 = W - 15
  const GX1 = W - 3
  const GZ0 = 66
  const GZ1 = 104
  const yard = kit.palette({ grass_block: 5, podzol: 2, coarse_dirt: 2, rooted_dirt: 1 }, { scale: 2, seed: 13 })
  for (let x = GX0; x <= GX1; x += 1) for (let z = GZ0; z <= GZ1; z += 1) {
    const edge = x === GX0 || x === GX1 || z === GZ0 || z === GZ1
    if (b.nameAt(x, G, z) === 'minecraft:grass_block') b.set(x, G, z, yard)
    if (edge && !(z === GZ1 && x === GX0 + 6)) b.set(x, G + 1, z, kit.palette({ mossy_cobblestone_wall: 2, cobblestone_wall: 1 }, { scale: 2, seed: 2 }))
  }
  b.set(GX0 + 6, G + 1, GZ1, 'minecraft:spruce_fence_gate[facing=south]')
  for (const x of [GX0 + 5, GX0 + 7]) {
    b.set(x, G + 1, GZ1, 'minecraft:mossy_cobblestone')
    b.set(x, G + 2, GZ1, 'minecraft:soul_lantern[hanging=false]')
  }
  for (const [x, z] of [[GX0, GZ0], [GX1, GZ0], [GX0, GZ1], [GX1, GZ1]]) {
    b.set(x, G + 1, z, 'minecraft:mossy_cobblestone')
    b.set(x, G + 2, z, 'minecraft:soul_lantern[hanging=false]')
  }
  const rng = kit.rng(31)
  for (let z = GZ0 + 9; z <= GZ1 - 4; z += 4) {
    for (const x of [GX0 + 2, GX0 + 4, GX0 + 9, GX0 + 11]) { // two rows either side of the path
      if (rng.chance(0.18)) continue
      const kind = rng.weighted([[4, 'slab'], [2, x === GX0 + 4 || x === GX0 + 9 ? 'cross' : 'slab'], [2, 'tomb'], [1, 'obelisk']])
      const hz = z + rng.int(0, 1)
      if (kind === 'slab') {
        // headstone: a stair seen edge-on reads as a stone with a rounded shoulder
        b.set(x, G + 1, hz, st(rng.pick(['minecraft:stone_brick_stairs', 'minecraft:mossy_stone_brick_stairs', 'minecraft:andesite_stairs']), 'north', 'top'))
      } else if (kind === 'cross') {
        b.set(x, G + 1, hz, 'minecraft:andesite_wall')
        b.set(x, G + 2, hz, 'minecraft:andesite_wall')
        b.set(x - 1, G + 2, hz, 'minecraft:andesite_wall')
        b.set(x + 1, G + 2, hz, 'minecraft:andesite_wall')
        b.set(x, G + 3, hz, 'minecraft:andesite_wall')
      } else if (kind === 'tomb') {
        b.set(x, G + 1, hz, 'minecraft:mossy_stone_bricks')
        b.set(x, G + 1, hz + 1, 'minecraft:mossy_stone_bricks')
        b.set(x, G + 2, hz, 'minecraft:stone_brick_slab[type=bottom]')
        b.set(x, G + 2, hz + 1, 'minecraft:stone_brick_slab[type=bottom]')
      } else {
        b.set(x, G + 1, hz, TRIM)
        b.set(x, G + 2, hz, 'minecraft:andesite_wall')
        b.set(x, G + 3, hz, 'minecraft:andesite_wall')
        b.set(x, G + 4, hz, 'minecraft:lightning_rod[facing=up]')
      }
      if (kind !== 'tomb') {
        b.set(x, G, hz + 1, rng.pick(['minecraft:coarse_dirt', 'minecraft:podzol', 'minecraft:rooted_dirt']))
        if (rng.chance(0.4)) b.set(x, G + 1, hz + 1, rng.pick(['minecraft:poppy', 'minecraft:azure_bluet', 'minecraft:lily_of_the_valley', 'minecraft:dead_bush', 'minecraft:fern']))
      }
    }
  }
  // a small crypt at the graveyard's north end, built with the same kit roof
  {
    const x0 = GX0 + 4
    const z0 = GZ0 + 1
    b.box([x0, G, z0], [x0 + 4, G + 4, z0 + 5], kit.palette({ mossy_stone_bricks: 2, stone_bricks: 3, cracked_stone_bricks: 1 }, { scale: 2, seed: 8 }))
    b.clear([x0 + 1, G + 1, z0 + 1], [x0 + 3, G + 3, z0 + 4])
    b.roof({ x0, x1: x0 + 4, z0, z1: z0 + 5, y: G + 5, axis: 'z', material: ROOF, pitch: 1, overhang: 1, gableOverhang: 1, eaveTrim: true, gable: 'minecraft:stone_bricks' })
    b.door([x0 + 2, G + 1, z0 + 5], 'south', { material: 'spruce' })
    b.set(x0 + 2, G + 3, z0 + 5, 'minecraft:chiseled_stone_bricks')
    b.set(x0 + 2, G + 7, z0 + 5, 'minecraft:andesite_wall')
  }
  b.tree([GX1 - 3, G + 1, GZ0 + 12], 'spruce', { seed: 4, height: 9 })
  b.tree([GX0 + 2, G + 1, GZ1 - 9], 'spruce', { seed: 6, height: 11 })
  // gardens: lawn trees in three sizes, shrubs at the building corners
  const trees = [[7, 116, 'oak', 2], [W - 8, 116, 'oak', 3], [9, 80, 'oak', 5], [6, 40, 'birch', 7], [W - 7, 40, 'birch', 8], [8, 10, 'dark_oak', 9], [W - 9, 10, 'oak', 10], [CX - 21, 5, 'birch', 11], [CX + 21, 5, 'birch', 12]]
  for (const [x, z, sp, seed] of trees) b.tree([x, G + 1, z], sp, { seed })
  for (const [x, z] of [[14, 64], [14, 92], [W - 15, 40], [13, 36], [W - 20, 8], [20, 8], [3, 60], [3, 100], [W - 4, 60]]) {
    if (free(x, z)) b.bush([x, G + 1, z], { radius: 1.8, seed: x * 3 + z })
  }
  b.scatter({ x0: 0, z0: 0, x1: W - 1, z1: L - 1, density: 0.22, paints: [[10, 'minecraft:short_grass'], [3, 'minecraft:tall_grass'], [1, 'minecraft:poppy'], [1, 'minecraft:oxeye_daisy'], [1, 'minecraft:cornflower'], [1, 'minecraft:fern']], seed: 21 })
  // benches and lamp posts on the forecourt
  for (const [x, z] of [[CX - 14, PZ0 + 2], [CX + 14, PZ0 + 2], [CX - 14, L - 6], [CX + 14, L - 6], [4, 90], [4, 62], [4, 30], [W - 4, 62], [W - 4, 30], [CX, 1]]) {
    b.lampPost([x, G + 1, z], { height: 4, post: 'minecraft:dark_oak_fence', foot: 'minecraft:stone_brick_wall' })
  }
  for (const s of [-1, 1]) for (let k = 0; k < 3; k += 1) {
    const x = CX + s * (10 + k)
    b.set(x, G + 1, LZ, st('minecraft:dark_oak_stairs', s < 0 ? 'west' : 'east'))
  }

  return b.finish({ name: 'gothic-cathedral' })
}
