// MEDIEVAL HOUSE: a Wealden-style timber-framed yeoman's house on a small garden plot
// ===================================================================================
//
// STYLE & REFERENCES
//   Late-medieval / Tudor English vernacular: the "hall and cross-wing" house of Kent and
//   Sussex (Bayleaf Farmhouse at the Weald & Downland museum is the archetype), with the
//   black-and-white close-studding of Cheshire houses (Little Moreton Hall) and the
//   storybook clay-tile roofs of the Weald. Minecraft-side reference: the Blockwerks
//   medieval timber-frame house (frame first, then infill; jetty on upside-down stairs).
//
// MASSING (block it out first; everything else hangs off these three volumes)
//   1. CROSS-WING (dominant): two storeys, jettied 1 block over the street (south) AND the
//      garden side (east). Its tall gable faces the viewer and carries the richest framing.
//   2. HALL (secondary): one tall storey open to the roof, ridge 6 blocks below the wing's
//      ridge, so the hierarchy is never in doubt. Its long roof is broken by a gabled porch.
//   3. EXTERNAL CHIMNEY on the hall's far gable: the vertical counterweight to the wing.
//   Tertiary: gabled porch, a wall dormer on the wing's long east slope, a bay window.
//   Asymmetry with a reason: the wing sits at the "low" end of the hall (service end),
//   the chimney at the "high" end (where the hearth and the high table were).
//
// PROPORTIONS
//   storeys 4 blocks clear (ground F+1..F+4, upper F+6..F+9, floor/jetty deck at F+5);
//   hall walls 5 tall (an open hall is taller than a chamber); plinth 1-3 courses showing,
//   growing on the downhill side; roof ≈ 50 % of the wing's visible height; overhang 1 on
//   eaves and verges; doors 1x2, windows 2x2 / 3x2 (mullioned), hall bay 3x3.
//   Roof pitch [1, 1, 2]: one 45° "kicked" course at the eave, then 2:1 (≈63°) - steep and
//   English, and the kick keeps the eave from cutting into the wall below.
//
// PALETTE (role → blocks, L* = lightness from references/building/block-colors.md)
//   FOUNDATION  cobblestone / stone / andesite / mossy_cobblestone   L≈50, rough texture
//   WATER TABLE stone_brick_stairs ring sloping off the plinth          L 51
//   INFILL      calcite 5 : mushroom_stem 3, clumped (lime plaster)     L 89 / 80
//   FRAME       dark_oak_log posts & beams, dark_oak_wood braces,
//               dark_oak_stairs (upside-down) as jetty brackets          L 20
//   ROOF        bricks as clay tiles + granite clumps, moss at the eaves,
//               mud-brick ridge course                                   L 47
//   CHIMNEY     stone_bricks / cobblestone (NOT brick: it must read against the roof)
//   ACCENT      spruce (door, shutters, flower boxes, furniture)         L 38
//   Value structure = three clear steps: light walls (≈85) / mid roof (47) / dark frame (20).
//   LESSON: a deepslate-tile roof (L 23) was tried first; roof and frame then collapsed into
//   one dark mass and the cross-gables stopped reading. A mid-value roof shows its facets.
//
// BUILD ORDER: terrain → foundation → frame+infill → roofs (primary first, then
// cross-gables trimmed against it) → roof weathering → chimney → openings → interior →
// lights → garden (hard landscaping, then plants last so they sit on the final surface).

export default function build(api) {
  const { kit } = api
  const b = api.builder([44, 36, 44], { seed: 11 })

  // ---------------------------------------------------------------- key levels & plan
  const F = 7 // ground-floor level (top of the foundation)
  const G0 = F + 1 // first course of the ground storey (sole plate)
  const G1 = F + 4 // last course of the ground storey
  const DECK = F + 5 // upper floor / jetty bressumer level
  const U0 = F + 6 // upper storey
  const U1 = F + 9 // upper top plate
  const H1 = F + 5 // hall top plate (hall is one tall storey)

  // Footprints. The wing's upper storey (ux1/uz1) is one block bigger on the south and east:
  // that single block of offset IS the jetty.
  const WING = { x0: 24, x1: 31, z0: 7, z1: 21, ux1: 32, uz1: 22 }
  const HALL = { x0: 11, x1: 24, z0: 11, z1: 17 }
  const PORCH = { x0: 15, x1: 19, z0: 18, z1: 20 }
  const inBox = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1
  const inFoot = (x, z) => inBox(WING, x, z) || inBox(HALL, x, z) || inBox(PORCH, x, z)

  // ---------------------------------------------------------------- palette
  const stone = kit.palette({ cobblestone: 4, stone: 2, andesite: 2, mossy_cobblestone: 1 }, { scale: 2 })
  // Plaster: two near-whites of different warmth, clumped (scale 3) so whole panels vary
  // like separately daubed infill. (white_terracotta was dropped: its pink reads as stains.)
  const plaster = kit.palette({ calcite: 5, mushroom_stem: 3 }, { scale: 3 })
  const POST = 'dark_oak_log[axis=y]'
  const beam = along => `dark_oak_log[axis=${along}]` // horizontal timbers show end grain at corners
  const roofMat = 'brick'
  const isTile = n => n === 'minecraft:bricks' || (n ?? '').startsWith('minecraft:brick_')

  // ---------------------------------------------------------------- terrain
  // A gentle fall toward the south-east (≈2 blocks over the plot) plus soft noise. Gentle
  // matters: every 1-block step shows a dirt riser, and steep noise turns a garden into
  // stripes. The house does not flatten the hill; its plinth absorbs the slope instead.
  const ground = b.terrain({
    height: (x, z) => 5.3 + 1.0 * ((18 - z) / 22) + 0.4 * ((20 - x) / 22) + 0.7 * kit.noise.fbm2(x, z, { scale: 26, seed: 3 }),
    layers: [{ depth: 1, paint: 'grass_block' }, { depth: 3, paint: 'dirt' }, { paint: 'stone' }],
  })

  // ---------------------------------------------------------------- foundation + water table
  // Rubble from below the terrain up to F under every wall, so no dirt ever shows beneath the
  // house: 1 course at the uphill back, 2-3 at the downhill front ("steps with the terrain").
  // A ring one block outside the walls ends in a sloped stone-brick stair course (a water
  // table): +1 depth at the ground line and a crisp shadow under the sole plate.
  for (let x = 0; x < 44; x += 1) for (let z = 0; z < 44; z += 1) {
    const g = ground(x, z)
    if (inFoot(x, z)) {
      for (let y = Math.min(g, F) - 1; y <= F; y += 1) b.set(x, y, z, stone)
      continue
    }
    const n = [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]].find(([, dx, dz]) => inFoot(x + dx, z + dz))
    const diag = !n && [[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dz]) => inFoot(x + dx, z + dz))
    if (!n && !diag) continue
    for (let y = Math.min(g, F - 1) - 1; y <= F - 1; y += 1) b.set(x, y, z, stone)
    // stair faces the wall (tall back against it) so the slope sheds water outward;
    // corner cells are resolved to outer-corner shapes by finish()
    b.set(x, F, z, n ? `stone_brick_stairs[facing=${n[0]},half=bottom]` : 'stone_bricks')
  }

  // ---------------------------------------------------------------- timber framing
  // One wall plane: plaster everywhere, posts at explicit positions, `plates` = continuous
  // horizontals (sole plate, top plate) that win over posts, `rails` = mid rails that posts
  // interrupt, `braces` = diagonal runs of dark_oak_wood (bark on every face, so diagonals
  // don't show log rings). Explicit post lists (not "every N") let posts frame each opening
  // and leave 1-wide close-studded bays beside the windows, the Tudor look.
  // Frame and infill share one plane (true to Tudor walls); depth comes from the jetty,
  // plinth, eaves, sills, shutters and flower boxes instead.
  function timber({ along, at, u0, u1, y0, y1, posts = [], plates = [], rails = [], braces = [] }) {
    for (let u = u0; u <= u1; u += 1) for (let y = y0; y <= y1; y += 1) {
      const p = along === 'x' ? [u, y, at] : [at, y, u]
      let paint = plaster
      if (plates.includes(y)) paint = beam(along)
      else if (posts.includes(u)) paint = POST
      else if (rails.includes(y)) paint = beam(along)
      b.set(...p, paint)
    }
    for (const [ua, ya, ub, yb] of braces) {
      const n = Math.max(Math.abs(ub - ua), Math.abs(yb - ya))
      for (let i = 0; i <= n; i += 1) {
        const u = Math.round(ua + ((ub - ua) * i) / n)
        const y = Math.round(ya + ((yb - ya) * i) / n)
        b.set(...(along === 'x' ? [u, y, at] : [at, y, u]), 'dark_oak_wood')
      }
    }
  }

  // Wing, ground storey: sole plate on the plinth, no head rail (the jetty band above is
  // already heavy - stacking another dark horizontal there turned the façade into stripes).
  timber({ along: 'x', at: WING.z1, u0: WING.x0, u1: WING.x1, y0: G0, y1: G1, posts: [24, 26, 29, 31], plates: [G0] })
  timber({ along: 'z', at: WING.x1, u0: WING.z0, u1: WING.z1, y0: G0, y1: G1, posts: [7, 11, 14, 18, 21], plates: [G0] })
  timber({ along: 'x', at: WING.z0, u0: WING.x0, u1: WING.x1, y0: G0, y1: G1, posts: [24, 27, 31], plates: [G0] })
  timber({ along: 'z', at: WING.x0, u0: WING.z0, u1: WING.z1, y0: G0, y1: G1, posts: [7, 11, 17, 21], plates: [G0] })

  // THE JETTY. The upper floor deck is one block wider than the ground storey on the south
  // and east. Its outer edge is a bressumer (log laid along the façade, end grain showing at
  // the corner), carried on brackets = upside-down dark oak stairs under it, their legs
  // against the ground-floor posts. Brackets go only where a post is below (structural logic).
  b.box([WING.x0, DECK, WING.z0], [WING.ux1, DECK, WING.uz1], 'spruce_planks')
  for (let x = WING.x0; x <= WING.ux1; x += 1) { b.set(x, DECK, WING.uz1, beam('x')); b.set(x, DECK, WING.z0, beam('x')) }
  for (let z = WING.z0; z <= WING.uz1; z += 1) { b.set(WING.ux1, DECK, z, beam('z')); b.set(WING.x0, DECK, z, beam('z')) }
  for (const x of [24, 26, 29, 31]) b.set(x, DECK - 1, WING.uz1, 'dark_oak_stairs[facing=north,half=top]')
  for (const z of [7, 11, 14, 18]) b.set(WING.ux1, DECK - 1, z, 'dark_oak_stairs[facing=west,half=top]')

  // Wing, upper storey: top plate under the eaves, K-braces in the end bays of the long side.
  timber({ along: 'x', at: WING.uz1, u0: WING.x0, u1: WING.ux1, y0: U0, y1: U1, posts: [24, 26, 30, 32], plates: [U1] })
  timber({ along: 'z', at: WING.ux1, u0: WING.z0, u1: WING.uz1, y0: U0, y1: U1, posts: [7, 11, 14, 18, 22], plates: [U1], braces: [[8, F + 6, 10, F + 8], [21, F + 6, 19, F + 8]] })
  timber({ along: 'x', at: WING.z0, u0: WING.x0, u1: WING.ux1, y0: U0, y1: U1, posts: [24, 26, 30, 32], plates: [U1] })
  timber({ along: 'z', at: WING.x0, u0: WING.z0, u1: WING.uz1, y0: U0, y1: U1, posts: [7, 11, 17, 22], plates: [U1] })

  // Hall: one tall storey, sole and top plates.
  timber({ along: 'x', at: HALL.z1, u0: HALL.x0, u1: HALL.x1 - 1, y0: G0, y1: H1, posts: [11, 14, 20], plates: [G0, H1] })
  timber({ along: 'x', at: HALL.z0, u0: HALL.x0, u1: HALL.x1 - 1, y0: G0, y1: H1, posts: [11, 14, 18, 21], plates: [G0, H1] })
  timber({ along: 'z', at: HALL.x0, u0: HALL.z0, u1: HALL.z1, y0: G0, y1: H1, posts: [11, 17], plates: [G0, H1] })

  // ---------------------------------------------------------------- roofs
  // Cross-gables: build the primary roof, then each secondary roof with keep (overwrite:
  // false) extended INTO the primary, then delete whatever the secondary left hidden under
  // the primary's surface (inside `trim`). The result is the max of the two roof height
  // fields: clean valleys, no stubs poking through, no clutter in the attic.
  const subRoof = (primary, opts) => {
    const before = new Set(b.entries().map(([x, y, z]) => `${x},${y},${z}`))
    const r = b.roof({ ...opts, overwrite: false })
    for (const [x, y, z] of b.entries()) {
      if (before.has(`${x},${y},${z}`)) continue
      const cell = primary.cells.get(`${x},${z}`)
      if (cell && y < primary.base + cell.tb && inBox(opts.trim, x, z)) b.remove(x, y, z)
    }
    return r
  }
  // Gable planes: with a 2:1 pitch every roof column is stair + fill + thickness, and in
  // the gable wall plane that stack reads as a 3-block dark band eating the gable. Keep the
  // top two blocks (they are the visible risers of the verge) and hand the rest back to the
  // gable's timber pattern. (Replacing top-1 too leaves white "holes" between verge steps.)
  const openGable = (r, along, at, from, to, paint) => {
    for (let u = from; u <= to; u += 1) {
      const [x, z] = along === 'x' ? [u, at] : [at, u]
      const cell = r.cells.get(`${x},${z}`)
      if (!cell) continue
      const top = r.base + cell.tb
      for (let y = top - 2; y > top - 5; y -= 1) if (isTile(b.nameAt(x, y, z))) b.set(x, y, z, paint)
    }
  }

  // Wing gables: studs at 26/30 up to a collar beam, a king post above it, an attic
  // window between. The roof's `gable` option accepts a paint function, which is how a
  // timber pattern goes into the triangle in one call.
  const gableWing = (x, y) => ([26, 30].includes(x) && y <= F + 12 ? POST : x === 28 && y > F + 12 ? POST : y === F + 12 ? beam('x') : plaster)
  const wingRoof = b.roof({ x0: WING.x0, z0: WING.z0, x1: WING.ux1, z1: WING.uz1, y: F + 10, axis: 'z', material: roofMat, pitch: [1, 1, 2], eaveTrim: true, gable: gableWing })
  openGable(wingRoof, 'x', WING.uz1, WING.x0 + 1, WING.ux1 - 1, gableWing)
  openGable(wingRoof, 'x', WING.z0, WING.x0 + 1, WING.ux1 - 1, gableWing)

  // Wall dormer on the wing's 16-block east slope: the façade rises through the eave over
  // the 3-light window below (aligned bays), with its own small gable 3 below the main ridge.
  b.clear([WING.ux1, F + 10, 15], [WING.ux1, F + 16, 17])
  b.clear([WING.ux1 + 1, F + 8, 15], [WING.ux1 + 1, F + 16, 17])
  timber({ along: 'z', at: WING.ux1, u0: 15, u1: 17, y0: F + 10, y1: F + 12, posts: [15, 17], plates: [F + 12] })
  b.clear([WING.ux1 - 1, F + 10, 16], [WING.ux1 - 1, F + 11, 16])
  const gableDormer = (x, y, z) => (z === 16 ? POST : plaster)
  const dormerRoof = subRoof(wingRoof, { x0: 30, z0: 15, x1: WING.ux1, z1: 17, y: F + 13, axis: 'x', material: roofMat, pitch: [1, 1, 2], eaveTrim: true, gable: gableDormer, trim: { x0: 0, x1: 31, z0: 0, z1: 99 } })
  openGable(dormerRoof, 'z', WING.ux1, 16, 16, gableDormer)
  b.window([WING.ux1, F + 10, 16], 'east', { width: 1, height: 2, material: 'spruce', sill: false })

  // Hall roof: extended 3 blocks into the wing (x1 = 27) so its ridge dies cleanly into the
  // wing's slope; trimmed against the wing roof.
  const gableHall = (x, y, z) => ([12, 16].includes(z) ? POST : y === F + 9 ? beam('z') : plaster)
  const hallRoof = subRoof(wingRoof, { x0: HALL.x0, z0: HALL.z0, x1: 27, z1: HALL.z1, y: F + 6, axis: 'x', material: roofMat, pitch: [1, 1, 2], eaveTrim: true, gable: gableHall, trim: { x0: 24, x1: 99, z0: 0, z1: 99 } })
  openGable(hallRoof, 'z', HALL.x0, HALL.z0 + 1, HALL.z1 - 1, gableHall)

  // PORCH. Open gabled porch on four posts. LESSON: its eave must sit BELOW the hall eave
  // (F+3 vs F+5); with equal or higher eaves the little gable merged into the hall roof as
  // a shapeless lump. Ridge F+8 runs back until it dies into the hall slope.
  b.clear([PORCH.x0, F + 4, HALL.z1 + 1], [PORCH.x1, F + 5, HALL.z1 + 1]) // hall eave over the porch
  for (const x of [PORCH.x0, PORCH.x1]) for (const z of [PORCH.z0, PORCH.z1]) b.box([x, F + 1, z], [x, F + 3, z], POST)
  for (const x of [PORCH.x0, PORCH.x1]) { b.set(x, F + 1, 19, 'spruce_fence'); b.set(x, F + 3, 19, beam('z')) }
  b.box([PORCH.x0, F + 3, PORCH.z1], [PORCH.x1, F + 3, PORCH.z1], beam('x'))
  const gablePorch = (x, y) => (y === F + 4 ? beam('x') : x === 17 ? POST : plaster)
  const porchRoof = subRoof(hallRoof, { x0: PORCH.x0, z0: 16, x1: PORCH.x1, z1: PORCH.z1, y: F + 4, axis: 'z', material: roofMat, pitch: [1, 1, 2], eaveTrim: true, gable: gablePorch, trim: { x0: 0, x1: 99, z0: 0, z1: 17 } })
  openGable(porchRoof, 'x', PORCH.z1, PORCH.x0 + 1, PORCH.x1 - 1, gablePorch)
  // a "Tudor arch": upside-down stairs soften the corners of the opening
  b.set(16, F + 3, PORCH.z1, 'dark_oak_stairs[facing=west,half=top]')
  b.set(18, F + 3, PORCH.z1, 'dark_oak_stairs[facing=east,half=top]')
  b.set(17, F + 3, PORCH.z1, 'air')
  b.box([16, F, 18], [18, F, PORCH.z1], 'polished_andesite')
  b.door([17, F + 1, HALL.z1], 'south', { material: 'spruce' })
  b.box([16, F + 1, 18], [16, F + 1, 19], 'spruce_stairs[facing=west]') // benches either side
  b.box([18, F + 1, 18], [18, F + 1, 19], 'spruce_stairs[facing=east]')
  b.set(17, F + 4, 19, 'chain[axis=y]') // lantern hangs below the tie beam so it shows
  b.set(17, F + 3, 19, 'lantern[hanging=true]') // through the arch

  // ROOF WEATHERING WITH LOGIC (not random speckle): moss only in the lowest courses where
  // water runs off (3x more on the shaded north/east-facing slopes), redder granite tiles in
  // broad clumps, and the ridge course in darker mud brick so it reads as ridge tiles.
  // LESSON: scattered single mud-brick tiles across the slopes read as "smallpox"; a
  // feature either follows a logic (ridge, eave) or it reads as noise.
  const TILE = { stairs: 'minecraft:brick_stairs', block: 'minecraft:bricks', slab: 'minecraft:brick_slab' }
  const ALT = {
    granite: { stairs: 'minecraft:granite_stairs', block: 'minecraft:granite', slab: 'minecraft:granite_slab' },
    mud: { stairs: 'minecraft:mud_brick_stairs', block: 'minecraft:mud_bricks', slab: 'minecraft:mud_brick_slab' },
    moss: { stairs: 'minecraft:mossy_cobblestone_stairs', block: 'minecraft:mossy_cobblestone', slab: 'minecraft:mossy_cobblestone_slab' },
  }
  const inPorchRoof = (x, z) => x >= 14 && x <= 20 && z >= 16 && z <= 21
  const eaveOf = (x, z) => (inPorchRoof(x, z) ? F + 3 : x >= 23 ? F + 9 : F + 5)
  const ridgeOf = (x, z) => (inPorchRoof(x, z) ? F + 8 : x >= 23 ? F + 18 : F + 12)
  b.map((x, y, z, block) => {
    const kind = Object.keys(TILE).find(k => TILE[k] === block.name)
    if (!kind) return null
    const t = (y - eaveOf(x, z)) / (ridgeOf(x, z) - eaveOf(x, z)) // 0 at the eave, 1 at the ridge
    const shaded = ['south', 'east'].includes(block.props?.facing) // stairs rising south/east = slope faces north/west
    const m = kit.noise.coherent01(x, y, z, { scale: 2.5, grain: 0.3, seed: 9 })
    if (t < 0.25 && m < (shaded ? 0.3 : 0.12) * (1 - t * 3)) return { name: ALT.moss[kind], props: block.props }
    const n = kit.noise.coherent01(x, y, z, { scale: 3, grain: 0.25, seed: 5 })
    if (n < 0.2) return { name: ALT.granite[kind], props: block.props }
    if (t >= 0.99) return { name: ALT.mud[kind], props: block.props }
    return null
  })

  // ---------------------------------------------------------------- chimney (hall's west gable)
  // Stepped like a real stack: a wide rubble breast (fireplace inside), a sloped weathering
  // where it steps in, a slimmer dressed-stone shaft with one string course, a corbelled cap
  // of upside-down stairs, wall-block "pots", and campfires sunk one course into the flue
  // (smoke in game, no flames sticking out on top). It passes straight through the verge.
  const chim = kit.palette({ stone_bricks: 5, cobblestone: 2, andesite: 1, cracked_stone_bricks: 1 }, { scale: 2, seed: 4 })
  for (let y = ground(8, 14) - 1; y <= F + 3; y += 1) for (let x = 8; x <= 10; x += 1) for (let z = 12; z <= 16; z += 1) b.set(x, y, z, stone)
  for (let z = 12; z <= 16; z += 1) b.set(8, F + 4, z, 'stone_brick_stairs[facing=east,half=bottom]')
  for (const x of [9, 10]) { b.set(x, F + 4, 12, 'stone_brick_stairs[facing=south,half=bottom]'); b.set(x, F + 4, 16, 'stone_brick_stairs[facing=north,half=bottom]') }
  for (let y = F + 4; y <= F + 15; y += 1) for (let x = 9; x <= 10; x += 1) for (let z = 13; z <= 15; z += 1) b.set(x, y, z, y === F + 11 ? 'stone_bricks' : chim)
  for (let z = 13; z <= 15; z += 1) b.set(8, F + 15, z, 'stone_brick_stairs[facing=east,half=top]')
  for (const x of [9, 10]) { b.set(x, F + 15, 12, 'stone_brick_stairs[facing=south,half=top]'); b.set(x, F + 15, 16, 'stone_brick_stairs[facing=north,half=top]') }
  for (let x = 9; x <= 10; x += 1) for (let z = 13; z <= 15; z += 1) b.set(x, F + 16, z, z === 14 ? 'air' : 'stone_brick_wall')
  b.set(9, F + 15, 14, 'campfire[lit=true,facing=north]')
  b.set(10, F + 15, 14, 'campfire[lit=true,facing=north]')

  // ---------------------------------------------------------------- bay window
  // A full-height 3x3 bay lighting the hall's high end, pushed 1 block out under the hall
  // eave (the eave becomes its roof). +1 depth exactly where the eye lands beside the porch.
  b.clear([21, F + 2, HALL.z1], [23, F + 4, HALL.z1])
  b.box([20, F + 1, 18], [20, F + 4, 18], POST)
  b.box([21, F + 1, 18], [23, F + 1, 18], beam('x'))
  b.box([21, F + 2, 18], [23, F + 4, 18], 'glass_pane')
  b.box([22, F + 2, 18], [22, F + 4, 18], 'dark_oak_fence') // mullion
  b.box([20, F, 18], [23, F, 18], 'stone_bricks')

  // ---------------------------------------------------------------- windows & doors
  // kit window(): pos = bottom-left opening cell seen from OUTSIDE ("right" = ccw(facing)),
  // so on north walls the window grows toward -x, on east walls toward -z.
  // Windows sit between posts (the frame is the window frame), heads align across a storey,
  // and the gable windows stack over the storey windows below.
  const win = (pos, facing, opts) => b.window(pos, facing, { material: 'spruce', ...opts })
  win([27, F + 2, WING.z1], 'south', { width: 2, height: 2, shutters: true })
  win([27, F + 7, WING.uz1], 'south', { width: 3, height: 2, mullion: 'dark_oak_fence', flowerBox: true })
  win([27, F + 10, WING.uz1], 'south', { width: 3, height: 2, mullion: 'dark_oak_fence', sill: false })
  win([WING.x1, F + 2, 13], 'east', { width: 2, height: 2, shutters: true })
  win([WING.x1, F + 2, 16], 'east', { width: 1, height: 2 })
  win([WING.x1, F + 2, 9], 'east', { width: 1, height: 2 })
  win([WING.ux1, F + 7, 13], 'east', { width: 2, height: 2, flowerBox: true })
  win([WING.ux1, F + 7, 17], 'east', { width: 3, height: 2, mullion: 'dark_oak_fence' })
  win([26, F + 2, WING.z0], 'north', { width: 2, height: 2, shutters: true })
  b.door([29, F + 1, WING.z0], 'north', { material: 'spruce' })
  win([29, F + 7, WING.z0], 'north', { width: 3, height: 2, mullion: 'dark_oak_fence' })
  win([29, F + 10, WING.z0], 'north', { width: 3, height: 2, mullion: 'dark_oak_fence', sill: false })
  win([WING.x0, F + 2, 20], 'west', { width: 1, height: 2 })
  win([WING.x0, F + 7, 19], 'west', { width: 2, height: 2 })
  win([WING.x0, F + 7, 9], 'west', { width: 2, height: 2 })
  win([12, F + 2, HALL.z1], 'south', { width: 2, height: 2, shutters: true, flowerBox: true })
  win([17, F + 2, HALL.z0], 'north', { width: 3, height: 2, mullion: 'dark_oak_fence' })
  win([13, F + 2, HALL.z0], 'north', { width: 2, height: 2, shutters: true })
  b.door([20, F + 1, HALL.z0], 'north', { material: 'spruce' })
  win([HALL.x0, F + 6, 12], 'west', { width: 1, height: 1, sill: false })
  win([HALL.x0, F + 6, 16], 'west', { width: 1, height: 1, sill: false })

  // ---------------------------------------------------------------- interior
  // Glass shows the inside, so every room is furnished for its purpose (empty rooms behind
  // windows are a classic amateur tell), and every room has a light source.

  // HALL: plank floor, open to the roof with tie beams + king posts (a real roof truss
  // you can see from inside), fireplace in the chimney breast, long table, dresser.
  b.box([12, F, 12], [23, F, 16], 'spruce_planks')
  b.box([21, F + 1, 18], [23, F + 1, 18], beam('x'))
  for (const x of [14, 18, 21]) {
    b.box([x, F + 6, 12], [x, F + 6, 16], beam('z'))
    b.box([x, F + 7, 14], [x, F + 10, 14], POST)
  }
  b.box([11, F + 1, 12], [11, F + 3, 16], 'stone_bricks') // fireplace surround
  b.clear([9, F + 1, 13], [11, F + 2, 15]) // opening into the breast
  b.box([9, F, 13], [11, F, 15], 'stone_bricks')
  b.set(9, F + 1, 14, 'campfire[lit=true,facing=east]')
  b.set(9, F + 1, 13, 'stripped_oak_log[axis=x]')
  for (let z = 12; z <= 16; z += 1) b.set(12, F + 3, z, 'stone_brick_stairs[facing=west,half=top]') // mantel
  b.box([12, F, 13], [12, F, 15], 'stone_bricks') // hearth
  b.set(12, F + 4, 13, 'candle[candles=2,lit=true]')
  b.set(12, F + 4, 15, 'potted_red_tulip')
  b.box([15, F + 1, 14], [19, F + 1, 14], 'spruce_slab[type=top]') // long table
  b.box([15, F + 1, 13], [19, F + 1, 13], 'spruce_stairs[facing=north]') // benches face the table
  b.box([15, F + 1, 15], [19, F + 1, 15], 'spruce_stairs[facing=south]')
  b.set(20, F + 1, 14, 'spruce_stairs[facing=east]')
  b.set(14, F + 1, 14, 'spruce_stairs[facing=west]')
  b.set(16, F + 2, 14, 'candle[candles=3,lit=true]')
  b.set(17, F + 2, 14, 'cake')
  b.set(18, F + 2, 14, 'candle[candles=2,lit=true]')
  b.set(22, F + 1, 12, 'chest[facing=south]')
  b.set(23, F + 1, 12, 'barrel[facing=up]')
  b.set(23, F + 2, 12, 'barrel[facing=up]')
  b.set(21, F + 1, 12, 'bookshelf')
  b.set(12, F + 1, 16, 'barrel[facing=up]')
  b.set(12, F + 2, 16, 'flower_pot')
  b.set(12, F + 1, 12, 'oak_log[axis=x]')
  b.set(13, F + 1, 16, 'spruce_stairs[facing=south]')
  b.set(14, F + 1, 16, 'barrel[facing=up]')
  b.set(14, F + 2, 16, 'candle[candles=3,lit=true]')
  b.set(16, F + 4, 12, 'red_wall_banner[facing=south]')
  b.box([21, F + 1, 17], [23, F + 1, 17], 'red_carpet') // window seat in the bay
  for (const x of [14, 18]) b.set(x, F + 5, 14, 'lantern[hanging=true]')
  b.set(22, F + 4, 17, 'lantern[hanging=true]')

  // WING GROUND: kitchen at the back, parlour at the front, a straight stair along the east
  // wall with barrels stored underneath, a doorway through to the hall.
  b.box([25, F, 8], [30, F, 20], kit.palette({ polished_andesite: 3, stone_bricks: 2, andesite: 1 }, { scale: 2, seed: 8 }))
  b.clear([24, F + 1, 14], [24, F + 2, 14])
  b.clear([30, DECK, 10], [30, DECK, 12]) // stairwell
  for (let i = 0; i < 4; i += 1) b.set(30, F + 1 + i, 9 + i, 'spruce_stairs[facing=south]')
  b.set(30, F + 1, 11, 'barrel[facing=up]')
  b.box([30, F + 1, 12], [30, F + 2, 12], 'barrel[facing=up]')
  b.set(25, F + 1, 8, 'smoker[facing=east]')
  b.set(25, F + 1, 9, 'water_cauldron[level=3]')
  b.set(25, F + 1, 10, 'crafting_table')
  b.set(25, F + 1, 11, 'barrel[facing=east]')
  b.set(26, F + 1, 8, 'barrel[facing=up]')
  b.set(27, F + 1, 8, 'chest[facing=south]')
  b.box([27, F + 1, 11], [28, F + 1, 11], 'spruce_slab[type=top]')
  b.set(27, F + 2, 11, 'potted_fern')
  b.set(25, F + 1, 16, 'spruce_trapdoor[facing=south,open=true]') // settle: stairs with
  b.box([25, F + 1, 17], [25, F + 1, 19], 'spruce_stairs[facing=west]') // trapdoor arms
  b.set(25, F + 1, 20, 'spruce_trapdoor[facing=north,open=true]')
  b.set(27, F + 1, 18, 'spruce_slab[type=top]')
  b.set(27, F + 2, 18, 'potted_blue_orchid')
  b.set(30, F + 1, 20, 'loom[facing=west]')
  b.box([30, F + 1, 15], [30, F + 2, 15], 'bookshelf')
  b.set(30, F + 1, 19, 'lectern[facing=west]')
  b.box([26, F + 1, 17], [28, F + 1, 19], 'brown_carpet', { keep: true })
  for (const z of [11, 18]) b.set(27, DECK - 1, z, 'lantern[hanging=true]')

  // WING UPPER: bedroom in the jettied front (double bed = two beds side by side), a
  // second chamber at the back, tie beams across the open roof, railing round the stairwell.
  for (const z of [11, 14, 18]) b.box([25, F + 10, z], [31, F + 10, z], beam('x'))
  for (const z of [17, 18]) { b.set(25, U0, z, 'blue_bed[part=head,facing=west]'); b.set(26, U0, z, 'blue_bed[part=foot,facing=west]') }
  b.set(25, U0, 16, 'chest[facing=east]')
  b.set(25, U0, 19, 'barrel[facing=up]')
  b.set(25, U0 + 1, 19, 'candle[candles=1,lit=true]')
  b.box([27, U0, 16], [29, U0, 19], 'red_carpet')
  b.box([27, U0, 21], [29, U0, 21], 'spruce_slab[type=top]') // writing desk in the jetty window
  b.set(28, U0, 20, 'spruce_stairs[facing=north]')
  b.set(28, U0 + 1, 21, 'lantern')
  b.set(31, U0, 21, 'barrel[facing=up]')
  b.set(31, U0, 20, 'chiseled_bookshelf[facing=west]')
  b.box([31, U0, 15], [31, U0 + 1, 16], 'barrel[facing=west]')
  b.set(30, U0, 14, 'chest[facing=west]')
  b.set(27, U0, 14, 'loom[facing=south]')
  b.set(25, U0, 9, 'white_bed[part=head,facing=west]')
  b.set(26, U0, 9, 'white_bed[part=foot,facing=west]')
  b.box([25, U0, 8], [25, U0 + 1, 8], 'barrel[facing=up]')
  b.set(28, U0, 8, 'chest[facing=south]')
  b.box([31, U0, 8], [31, U0, 9], 'barrel[facing=up]')
  b.box([26, U0, 10], [27, U0, 12], 'brown_carpet')
  for (const z of [10, 11, 12]) { b.set(29, U0, z, 'spruce_fence'); b.set(31, U0, z, 'spruce_fence') }
  b.set(30, U0, 9, 'spruce_fence')
  for (const z of [11, 18]) b.set(28, F + 9, z, 'lantern[hanging=true]')

  // ---------------------------------------------------------------- exterior lights & finish
  // Lanterns hang from structure (bressumer, fence brackets), never float: one at the
  // jettied "dragon" corner, one by the porch, one at each back door.
  b.set(32, DECK - 1, 22, 'lantern[hanging=true]')
  b.set(25, DECK - 1, 22, 'lantern[hanging=true]')
  b.set(32, DECK - 1, 9, 'lantern[hanging=true]')
  b.set(28, F + 4, 6, 'dark_oak_fence') // bracket
  b.set(28, F + 3, 6, 'lantern[hanging=true]')
  b.set(21, F + 4, 10, 'dark_oak_fence')
  b.set(21, F + 3, 10, 'lantern[hanging=true]')
  for (const z of [6, 23]) { b.set(28, F + 19, z, 'dark_oak_fence'); b.set(28, F + 20, z, 'lightning_rod') } // gable finials
  // ivy creeping up the chimney (sheltered stone is where it would grow)
  b.overgrow([8, F - 2, 12], [10, F + 12, 16], { amount: 0.45, maxLength: 5, moss: false, seed: 4 })

  // ---------------------------------------------------------------- garden: hard landscaping
  // Porch steps: stairs descend one course per block until they meet the terrain.
  for (let z = 22, y = F - 1; y > ground(17, z) - 1 && z < 27; z += 1, y -= 1) {
    for (let x = 16; x <= 18; x += 1) {
      b.set(x, y, z, 'stone_brick_stairs[facing=north]')
      for (let yy = y - 1; yy >= ground(x, z) - 1; yy -= 1) b.set(x, yy, z, stone)
    }
  }
  // Path with a story: worn flagstones at the door, gravel, then a trodden dirt track to
  // the gate. kit.gradient along z blends palettes; dither keeps the bands from striping.
  const pathPaint = kit.gradient([
    kit.palette({ cobblestone: 3, andesite: 2, stone: 2, gravel: 1 }, { scale: 1.5 }),
    kit.palette({ dirt_path: 4, gravel: 2, cobblestone: 1 }, { scale: 2 }),
    kit.palette({ dirt_path: 6, coarse_dirt: 1 }, { scale: 2 }),
  ], { axis: 'z', from: 23, to: 40, dither: 0.8 })
  b.path([[17, 23], [17, 27], [16, 31], [17, 35], [18, 39], [18, 43]], { width: 3, paint: pathPaint, jitter: 0.3 })
  // Stepping stones to the well (a second continuous path read as a stripe across the lawn).
  for (const [x, z] of [[20, 31], [22, 30], [24, 31], [26, 30], [28, 31], [30, 30]]) b.set(x, ground(x, z), z, 'polished_andesite')

  // Front boundary: a dry-stone wall that follows the ground, lantern-topped gate piers;
  // a light spruce fence on the other three sides.
  const wallPaint = kit.palette({ cobblestone_wall: 3, mossy_cobblestone_wall: 2 }, { scale: 2 })
  for (let x = 1; x <= 42; x += 1) {
    if (x === 18) continue
    const y = ground(x, 41) + 1
    b.set(x, y, 41, x === 17 || x === 19 ? 'stone_bricks' : wallPaint)
    if (x === 17 || x === 19) { b.set(x, y + 1, 41, 'stone_bricks'); b.set(x, y + 2, 41, 'stone_brick_slab'); b.set(x, y + 3, 41, 'lantern') }
  }
  b.set(18, ground(18, 41) + 1, 41, 'spruce_fence_gate[facing=south]')
  for (let z = 2; z <= 40; z += 1) for (const x of [1, 42]) b.set(x, ground(x, z) + 1, z, 'spruce_fence')
  for (let x = 1; x <= 42; x += 1) b.set(x, ground(x, 1) + 1, 1, 'spruce_fence')

  // Well: rubble drum sunk into the ground with water, two posts, a 3x3 gable roof.
  // (A 5x5 overhanging roof was tried: it read as a wooden box sitting on the well.)
  {
    const gx = 34
    const gz = 30
    const y = ground(gx, gz)
    const rubble = kit.palette({ cobblestone: 2, mossy_cobblestone: 1, stone_bricks: 1 }, { scale: 1 })
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) b.box([gx + dx, y - 3, gz + dz], [gx + dx, y + 1, gz + dz], rubble)
    b.box([gx, y - 2, gz], [gx, y, gz], 'water')
    b.set(gx, y + 1, gz, 'air')
    for (const dx of [-1, 1]) b.box([gx + dx, y + 2, gz], [gx + dx, y + 4, gz], 'spruce_fence')
    b.box([gx - 1, y + 5, gz], [gx + 1, y + 5, gz], 'stripped_spruce_log[axis=x]')
    b.box([gx - 1, y + 6, gz], [gx + 1, y + 6, gz], 'spruce_slab')
    b.box([gx - 1, y + 5, gz - 1], [gx + 1, y + 5, gz - 1], 'spruce_stairs[facing=south]')
    b.box([gx - 1, y + 5, gz + 1], [gx + 1, y + 5, gz + 1], 'spruce_stairs[facing=north]')
    b.box([gx, y + 3, gz], [gx, y + 4, gz], 'chain[axis=y]')
    b.set(gx + 2, ground(gx + 2, gz + 1) + 1, gz + 1, 'cauldron')
    b.set(gx + 1, y + 2, gz + 1, 'lantern') // a lamp left on the rim
  }

  // Woodpile stacked against the chimney breast under a pent roof, log ends outward
  // (mixed species, per-block random = scale 0, because cut logs ARE individually random).
  {
    const logs = kit.palette({ 'oak_log[axis=z]': 3, 'spruce_log[axis=z]': 2, 'birch_log[axis=z]': 1 }, { scale: 0 })
    for (let x = 6; x <= 7; x += 1) for (let z = 12; z <= 16; z += 1) {
      const top = F + 1 + (z === 12 || z === 16 ? 0 : 1)
      for (let y = ground(x, z) + 1; y <= top; y += 1) b.set(x, y, z, logs)
    }
    b.box([5, F + 3, 11], [5, F + 3, 17], 'spruce_stairs[facing=east]')
    b.box([6, F + 3, 11], [7, F + 3, 17], 'spruce_slab[type=bottom]')
    b.box([6, F + 4, 11], [7, F + 4, 17], 'air')
    for (const z of [11, 17]) for (let y = ground(5, z) + 1; y <= F + 2; y += 1) b.set(5, y, z, 'spruce_fence')
    b.set(4, ground(4, 19) + 1, 19, 'stripped_oak_log[axis=y]') // chopping block
    b.set(3, ground(3, 20) + 1, 20, 'oak_log[axis=x]')
    b.set(5, F + 2, 14, 'lantern[hanging=true]')
  }

  // Raised vegetable beds (log-edged, levelled into the slope) with a scarecrow.
  const BED_Y = 6
  for (const [x0, x1] of [[35, 37], [39, 41]]) {
    for (let x = x0; x <= x1; x += 1) for (let z = 9; z <= 22; z += 1) {
      const edge = x === x0 || x === x1 || z === 9 || z === 22
      for (let yy = ground(x, z) + 1; yy < BED_Y; yy += 1) b.set(x, yy, z, 'dirt')
      for (let yy = BED_Y + 1; yy <= ground(x, z); yy += 1) b.remove(x, yy, z)
      b.set(x, BED_Y, z, edge ? beam(z === 9 || z === 22 ? 'x' : 'z') : 'farmland[moisture=7]')
      if (!edge) b.set(x, BED_Y + 1, z, z < 13 ? 'carrots[age=7]' : z < 17 ? 'wheat[age=7]' : z < 20 ? 'potatoes[age=7]' : 'beetroots[age=3]')
    }
  }
  b.set(38, ground(38, 8) + 1, 8, 'composter[level=6]')
  b.set(38, ground(38, 23) + 1, 23, 'hay_block') // scarecrow
  b.set(38, ground(38, 23) + 2, 23, 'carved_pumpkin[facing=south]')

  // Lamp post where the path bends; props telling the back-door story (hay, barrels, compost).
  b.lampPost([14, ground(14, 29) + 1, 29], { height: 3, foot: 'stone_brick_wall', post: 'dark_oak_fence' })
  for (const [x, z, id] of [[26, 4, 'barrel[facing=up]'], [27, 4, 'barrel[facing=up]'], [26, 5, 'hay_block'], [31, 5, 'composter[level=4]']]) b.set(x, ground(x, z) + 1, z, id)
  b.set(26, ground(26, 4) + 2, 4, 'hay_block')

  // ---------------------------------------------------------------- garden: planting (last)
  // Trees frame the house rather than hide it: an old oak behind the chimney and a birch
  // behind the wing give the roofline a backdrop; two blossoming fruit trees (oak with
  // azalea leaves) bracket the front garden like a picture frame, staggered in depth
  // (front-left, mid-right) so neither hides the house, the well or the beds from the
  // usual 3/4 viewpoint. Check `builder.clipped`: canopies easily spill past the canvas.
  b.tree([8, ground(8, 6) + 1, 6], 'oak', { height: 11, seed: 3, roots: 2 })
  b.tree([38, ground(38, 5) + 1, 5], 'birch', { height: 12, seed: 2 })
  const blossom = ['oak_leaves', 'flowering_azalea_leaves', 'azalea_leaves']
  b.tree([8, ground(8, 32) + 1, 32], 'oak', { height: 8, seed: 5, roots: 2, trunk: 0.8, leaves: blossom })
  b.tree([39, ground(39, 26) + 1, 26], 'oak', { height: 6, seed: 8, roots: 1, trunk: 0.6, leaves: blossom })
  // bench under the apple tree
  b.box([10, ground(10, 34) + 1, 34], [11, ground(10, 34) + 1, 34], 'spruce_stairs[facing=south]')
  b.set(9, ground(10, 34) + 1, 34, 'spruce_trapdoor[facing=west,open=true]')
  b.set(12, ground(10, 34) + 1, 34, 'spruce_trapdoor[facing=east,open=true]')
  b.set(13, ground(13, 34) + 1, 34, 'lantern')
  for (const [x, z, r] of [[8, 21, 1.6], [33, 24, 1.5], [12, 39, 1.8], [26, 39, 1.6], [40, 30, 1.8], [3, 25, 1.7]]) {
    b.bush([x, ground(x, z) + 1, z], { radius: r, seed: x + z })
  }
  // A low hedge inside the front wall softens the stone (1-2 high by coherent noise).
  for (let x = 2; x <= 41; x += 1) {
    if (x >= 15 && x <= 21) continue
    const y = ground(x, 40) + 1
    const h = kit.noise.coherent01(x, 0, 40, { scale: 3, seed: 21 }) > 0.55 ? 2 : 1
    for (let k = 0; k < h; k += 1) b.set(x, y + k, 40, kit.noise.hash01(x, k, 40, 3) < 0.7 ? 'oak_leaves' : 'azalea_leaves', { keep: true })
  }
  // Flower beds hugging the house front: tall flowers (rose bush, peony, lilac) mixed with
  // low ones, on rooted dirt. Colour at the base of a white wall is the cottage signature.
  const bedFlowers = ['rose_bush', 'peony', 'lilac', 'allium', 'azure_bluet', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'red_tulip']
  for (const [x0, x1, z0, z1] of [[10, 14, 19, 20], [20, 23, 19, 21], [24, 32, 23, 24]]) {
    for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) {
      const y = ground(x, z)
      if (b.nameAt(x, y, z) !== 'minecraft:grass_block' || b.has(x, y + 1, z)) continue
      b.set(x, y, z, 'rooted_dirt')
      const f = bedFlowers[Math.floor(kit.hash01(x, 0, z, 7) * bedFlowers.length)]
      if (['rose_bush', 'peony', 'lilac'].includes(f)) { b.set(x, y + 1, z, `${f}[half=lower]`); b.set(x, y + 2, z, `${f}[half=upper]`) } else b.set(x, y + 1, z, f)
    }
  }
  // Wildflower drifts (clumped scatter), then the lawn: mostly grass, few flowers.
  b.scatter({ x0: 2, z0: 24, x1: 41, z1: 39, on: ['grass_block'], density: 0.08, clump: 4, seed: 7, paints: [[3, 'cornflower'], [3, 'oxeye_daisy'], [2, 'allium'], [2, 'azure_bluet'], [1, 'lily_of_the_valley']] })
  b.scatter({ on: ['grass_block'], density: 0.3, paints: [[10, 'short_grass'], [3, 'tall_grass'], [2, 'fern'], [1, 'dandelion'], [1, 'poppy'], [1, 'oxeye_daisy'], [1, 'azure_bluet']] })

  return b.finish({
    name: 'medieval-house',
    description: 'Wealden hall-and-cross-wing timber-framed house: jettied two-storey wing, open hall, gabled porch, stone chimney, clay-tile roofs, furnished interior and a cottage garden with well, vegetable beds and woodpile.',
  })
}
