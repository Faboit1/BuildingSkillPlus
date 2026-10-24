// THE PRANCING PONY — a two-and-a-half-storey coaching inn at a crossroads
//
// BRIEF
//   A prosperous medieval/Tudor coaching inn ("Prancing Pony"-like) on the corner of two cart
//   roads. Stone ground floor, jettied close-studded timber upper floor, a steep slate roof with
//   a tall cross gable over the porch, one wide wall dormer and a massive stepped chimney on the
//   gable that faces the crossroads. Behind: a kitchen wing with its own chimney, a cellar under
//   it, a fenced kitchen garden. To the east: a lean-to stable and a cobbled stable yard (well,
//   hay wagon, trough, hitching rail). THE INTERIOR IS THE STAR: every room is furnished at 1:1
//   scale and meant to be shown with cutaways (--clip-y per floor) and sections (--clip).
//   Story hook: a busy evening — fire lit under the cooking pot, cake on a table, casks tapped,
//   beds turned down upstairs, the stable boy's cot in the attic, smoke from both chimneys.
//
// SCALE TIER: cottage 1:1. Doors 2 tall, windows 1-2 wide x 2 tall, posts 1 block.
//   y 7      ground-floor deck (FL0)       taproom air y 8..11 = 4 clear
//   y 12     first-floor deck (FL1)        guest rooms y 13..15 = 3 clear
//   y 16     attic deck (FL2)              attic under the rafters, ridge at y 26
//   y 17     wall plate (a 1-block knee wall: the "half" storey)
//   Roof ≈ 45% of the street facade; chimney tops out 4-5 above the ridge.
//
// PLAN (x east, z south; one character ≈ 2 blocks)
//              x 6        12   17  21  25        34      41        51
//   z  2        +-garden-+                    (oak)
//              | beds hives|      +-WING-+ <- kitchen chimney
//   z 10        +----------+      |kitchen|   stable yard: well, wagon,
//                     [CH]+-------+-------+--+------+   trough, hay
//   z 19                  |fire snug | bar  |st| lean |
//                         |  tables  door   |  | -to  |
//   z 30                  +-----+porch+-----+--+------+
//   z 38   ==== E-W road ============================================  N-S road at x 1..5
//
// PALETTE (roles, L* of the main block; contrast first, then texture)
//   foundation  tuff_bricks 43 -> cobbled_deepslate 33 -> deepslate_bricks 30   (darkest, roughest)
//   ground wall andesite 57 -> cobblestone 53 -> stone_bricks 51 -> tuff_bricks 43   (b.texture ramp)
//   upper infill calcite 89 / smooth_sandstone 86 (warm limewash, calm, 2 close values)
//   frame       dark_oak_log 20 posts, stripped_dark_oak_log 25 rails  (>= 60 L* off the infill)
//   roof        deepslate_tiles 23 dominant, deepslate_bricks 30 patches, cobbled 33 near ridges
//   trim/accent spruce (bargeboards, sills, shutters, furniture), bricks 47 chimney pots,
//               red as the one accent hue (rugs, beds, runner, flowers)
//
// TECHNIQUES WORTH STEALING (each is explained where it happens)
//   * Placeholder wool per surface role, textured at the end with one b.texture call per role.
//   * Secondary roofs (bay, wing, lean-to) built on a scratch canvas and merged column by column:
//     the higher roof wins, which gives clean valleys (mergeRoof).
//   * Slab-kicked eaves [0.5, 0.5, 1, ...]: a bell-cast flare that also lifts the eave line.
//   * Jettied upper floor on stair corbels, plus a jettied cross gable over the porch.
//   * Upper decks of top slabs: same floor, but a coffered ceiling between the beams below.
//   * Furniture authored once as south-facing modules and stamped rotated (beds, desks,
//     wardrobes, kegs, cabinets, dining sets, armchairs, chandeliers).
//   * Hollow foundations filled with dirt, a hollow chimney flue: no hidden stone plugs.
//
// RENDERS (see the notes file for the full list)
//   node scripts/run-build.mjs assets/examples/tavern.mjs --out-dir minecraft-builds/tavern --json
//   node scripts/render.mjs --nbt minecraft-builds/tavern/tavern.nbt --views se,nw,hero,low --zoom 1.4
//   taproom cutaway:  --clip 6,0,8,34,10,36 --yaw 20 --pitch 55 --target 23,8,22 --distance 34
//   rooms upstairs:   --clip 6,0,8,34,15,36 --yaw 20 --pitch 55 --target 23,13,24 --distance 34
//   dollhouse section through wing, cellar and attic: --clip 0,0,0,28,37,45 --yaw 90 --pitch 10 --target 28,13,22 --distance 50
//   fireside at eye level: --clip 0,0,19,25,11,30 --yaw 75 --pitch 12 --target 16,9,24 --distance 18 --fov 50
//   STAGE=massing|structure|texture|interior|landscape node scripts/run-build.mjs ... renders each stage.

export default function build(api) {
  const { kit } = api
  const STAGES = ['massing', 'structure', 'texture', 'interior', 'landscape', 'final']
  const stage = STAGES.indexOf(process.env.STAGE ?? 'final')
  const at = s => stage >= STAGES.indexOf(s)

  const b = api.builder([52, 38, 46], { seed: 23 })

  // ------------------------------------------------------------------ levels and plan
  const FL0 = 7       // ground-floor deck (taproom floor)
  const FL1 = 12      // first-floor deck
  const FL2 = 16      // attic deck
  const PLATE = 17    // wall plate: a 1-high knee wall in the attic
  const ROOF_Y = 18   // roof row directly above the wall line
  const MAIN = { x0: 12, x1: 34, z0: 19, z1: 30 }       // ground-floor outer walls (23 x 12)
  const UP = { x0: 12, x1: 34, z0: 19, z1: 31 }         // upper floor, jettied 1 over the street
  const BAY = { x0: 17, x1: 25, z0: 31, z1: 34 }        // cross-gabled bay over the porch (9 wide: odd, so a sharp ridge over the door)
  const PORCH = { x0: 17, x1: 25, z0: 31, z1: 34 }
  const WING = { x0: 24, x1: 32, z0: 10, z1: 19 }       // rear kitchen wing (shares the z=19 wall)
  const STABLE = { x0: 35, x1: 41, z0: 18, z1: 30 }     // lean-to stable on the east gable
  const CH = { x0: 8, x1: 11, z0: 21, z1: 27 }          // west chimney stack (base)
  const DOOR_X = 21
  const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

  // placeholders, one per surface role (each gets its own b.texture call later)
  const STONE = 'white_wool'
  const PLINTH = 'light_gray_wool'
  const DAUB = 'yellow_wool'
  const CHIM = 'gray_wool'
  const ROOF = 'deepslate_tile'
  const POST = 'dark_oak_log[axis=y]'
  // horizontal members (rails, plates, girders) in stripped dark oak: a shade lighter than the
  // bark-dark posts, so the grid reads as carpentry rather than a printed pattern
  const beam = ax => (ax === 'y' ? POST : `stripped_dark_oak_log[axis=${ax}]`)
  // pitch profiles: a slab kick at the eave (bell-cast flare), 45 degrees, steep near the ridge
  const MAIN_PITCH = [0.5, 0.5, 1, 1, 1, 1, 2]
  const BAY_PITCH = [0.5, 0.5, 2]          // steeper: the street gable stands tall and narrow

  // ------------------------------------------------------------------ 1. site
  // Gentle fall from the garden (north-west) to the road (south-east): about 2 blocks over the
  // site, enough that the street side shows a plinth course and the porch needs two steps.
  const ground = b.terrain({
    height: (x, z) => 5.4 + 1.1 * ((22 - z) / 22) + 0.4 * ((26 - x) / 26) + 0.6 * kit.noise.fbm2(x, z, { scale: 22, seed: 4 }),
    layers: [{ depth: 1, paint: 'grass_block' }, { depth: 3, paint: 'dirt' }, { paint: 'stone' }],
    base: 2,
  })

  // ------------------------------------------------------------------ 0. massing (STAGE=massing)
  // Placeholder volumes only: judge the silhouette before anything else.
  if (!at('structure')) {
    b.box([MAIN.x0, FL0, MAIN.z0], [MAIN.x1, FL1 - 1, MAIN.z1], STONE)
    b.box([UP.x0, FL1, UP.z0], [UP.x1, PLATE, UP.z1], DAUB)
    b.box([BAY.x0, FL1, BAY.z0], [BAY.x1, PLATE, BAY.z1], DAUB)
    b.box([WING.x0, FL0, WING.z0], [WING.x1, PLATE, WING.z1], DAUB)
    b.box([CH.x0, FL0, CH.z0], [CH.x1, 12, CH.z1], CHIM)
    b.box([CH.x0, 13, 23], [CH.x0 + 2, 30, 25], CHIM)
    b.roof({ x0: UP.x0, z0: UP.z0, x1: UP.x1, z1: UP.z1, y: ROOF_Y, axis: 'x', material: ROOF, pitch: MAIN_PITCH })
    b.roof({ x0: BAY.x0, z0: 26, x1: BAY.x1, z1: BAY.z1 + 1, y: ROOF_Y, axis: 'z', material: ROOF, pitch: BAY_PITCH, overwrite: false })
    b.roof({ x0: WING.x0, z0: WING.z0, x1: WING.x1, z1: 22, y: ROOF_Y, axis: 'z', material: ROOF, pitch: MAIN_PITCH, overwrite: false })
    return b.finish({ name: 'tavern' })
  }

  // ------------------------------------------------------------------ 2. foundations
  // Floor level = above the highest ground under the footprint, so nothing is buried uphill.
  // Only the perimeter is masonry; inside the pad is packed earth (terrain, not build material:
  // a solid stone plug would be thousands of hidden blocks and wreck the partial-block ratio).
  // Around the pad runs a water table: foundation one block wider, topped by a sloped stair course.
  const onPad = (x, z) => inR(MAIN, x, z) || inR(WING, x, z) || inR(CH, x, z) || inR(PORCH, x, z)
  const nearPad = (x, z) => !onPad(x, z) && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dz]) => onPad(x + dx, z + dz))
  for (let x = 0; x < 52; x += 1) for (let z = 0; z < 46; z += 1) {
    const g = ground(x, z)
    if (onPad(x, z)) {
      const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !onPad(x + dx, z + dz))
      if (!rim) for (let y = g; y < FL0; y += 1) b.set(x, y, z, 'dirt')
      for (let y = rim ? Math.min(g, FL0) - 2 : FL0; y <= FL0; y += 1) b.set(x, y, z, PLINTH)
    } else if (nearPad(x, z) && !inR(STABLE, x, z)) {
      for (let y = Math.min(g, FL0 - 1) - 1; y <= FL0 - 1; y += 1) b.set(x, y, z, PLINTH)
      const n = [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]].find(([, dx, dz]) => onPad(x + dx, z + dz))
      if (n) b.set(x, FL0, z, `stone_brick_stairs[facing=${n[0]},half=bottom]`)
    }
  }

  // ------------------------------------------------------------------ 3. ground floor (stone)
  // The street fronts (south, west) are 2 thick: deep window reveals outside, a recessed door,
  // and an inner layer we can limewash. North and east are 1 thick (the wing and stable hide them).
  const stoneWall = (x0, z0, x1, z1) => b.box([x0, FL0, z0], [x1, FL1 - 1, z1], STONE)
  stoneWall(MAIN.x0, MAIN.z1 - 1, MAIN.x1, MAIN.z1)   // south
  stoneWall(MAIN.x0, MAIN.z0, MAIN.x0 + 1, MAIN.z1)   // west
  stoneWall(MAIN.x0, MAIN.z0, MAIN.x1, MAIN.z0)       // north
  stoneWall(MAIN.x1, MAIN.z0, MAIN.x1, MAIN.z1)       // east
  stoneWall(WING.x0, WING.z0, WING.x1, WING.z0)
  stoneWall(WING.x0, WING.z0, WING.x0, WING.z1)
  stoneWall(WING.x1, WING.z0, WING.x1, WING.z1)
  b.box([WING.x0 + 1, FL0, WING.z0 + 1], [WING.x1 - 1, FL0, WING.z1 - 1], 'spruce_planks')
  // Upper decks are top slabs: the same walking surface from above, and from below the ceiling
  // sits half a block up between the beams (a coffered look) instead of a flat plank lid.
  const DECK = 'spruce_slab[type=top]'
  for (const r of [UP, BAY, WING]) for (const y of [FL1, FL2]) b.box([r.x0, y, r.z0], [r.x1, y, r.z1], DECK)

  // ------------------------------------------------------------------ 4. jetty + timber upper floor
  // Timber elevation painter: posts (vertical logs), rails (horizontal logs), plaster infill
  // between. Explicit post positions let each facade have its own rhythm.
  function timber({ along, at: w, u0, u1, y0, y1, posts, rails = [y0, y1], braces = [] }) {
    for (let u = u0; u <= u1; u += 1) for (let y = y0; y <= y1; y += 1) {
      let paint = DAUB
      if (rails.includes(y)) paint = beam(along)
      else if (posts.includes(u)) paint = POST
      b.set(...(along === 'x' ? [u, y, w] : [w, y, u]), paint)
    }
    for (const [ua, ya, ub, yb] of braces) {               // stepped diagonal, face-connected
      const n = Math.max(Math.abs(ub - ua), Math.abs(yb - ya))
      for (let i = 0; i <= n; i += 1) {
        const u = Math.round(ua + ((ub - ua) * i) / n)
        const y = Math.round(ya + ((yb - ya) * i) / n)
        b.set(...(along === 'x' ? [u, y, w] : [w, y, u]), POST)
      }
    }
  }
  const range = (a, c, s) => Array.from({ length: Math.floor((c - a) / s) + 1 }, (_, i) => a + i * s)
  // street front: close studding (posts every 2) = the prosperous Tudor front; leaded lancets
  // go between the studs, so the windows need no frames of their own
  timber({ along: 'x', at: UP.z1, u0: UP.x0, u1: BAY.x0 - 1, y0: FL1, y1: PLATE, posts: range(12, 16, 2) })
  timber({ along: 'x', at: UP.z1, u0: BAY.x1 + 1, u1: UP.x1, y0: FL1, y1: PLATE, posts: range(26, 34, 2) })
  timber({ along: 'z', at: BAY.x0, u0: BAY.z0, u1: BAY.z1, y0: FL1, y1: PLATE, posts: [31, 34] })
  timber({ along: 'z', at: BAY.x1, u0: BAY.z0, u1: BAY.z1, y0: FL1, y1: PLATE, posts: [31, 34] })
  timber({ along: 'x', at: BAY.z1, u0: BAY.x0, u1: BAY.x1, y0: FL1, y1: PLATE, posts: range(17, 25, 2) })
  // gable ends and back: plainer square panels (posts every 4); braces only where a panel is big
  timber({ along: 'z', at: UP.x0, u0: UP.z0, u1: UP.z1, y0: FL1, y1: PLATE, posts: [19, 23, 27, 31] })
  timber({ along: 'z', at: UP.x1, u0: UP.z0, u1: UP.z1, y0: FL1, y1: PLATE, posts: [19, 23, 27, 31], braces: [[20, 13, 22, 16], [30, 13, 28, 16]] })
  timber({ along: 'x', at: UP.z0, u0: UP.x0, u1: WING.x0, y0: FL1, y1: PLATE, posts: [12, 16, 20, 24] })
  timber({ along: 'x', at: UP.z0, u0: WING.x1, u1: UP.x1, y0: FL1, y1: PLATE, posts: [32, 34] })
  timber({ along: 'z', at: WING.x0, u0: WING.z0, u1: WING.z1, y0: FL1, y1: PLATE, posts: [10, 14, 19], braces: [[11, 13, 13, 16]] })
  timber({ along: 'z', at: WING.x1, u0: WING.z0, u1: WING.z1, y0: FL1, y1: PLATE, posts: [10, 14, 19], braces: [[11, 13, 13, 16]] })
  timber({ along: 'x', at: WING.z0, u0: WING.x0, u1: WING.x1, y0: FL1, y1: PLATE, posts: [24, 26, 30, 32] })
  // jetty corbels: an upside-down stair under every street-front post, its step against the stone
  for (let x = UP.x0; x <= UP.x1; x += 2) if (x < BAY.x0 || x > BAY.x1) b.set(x, FL1 - 1, UP.z1, 'dark_oak_stairs[facing=north,half=top]')

  // ------------------------------------------------------------------ 5. porch under the bay
  // The bay's upper room rides on two stout corner posts; the ground under it is an open porch.
  b.clear([PORCH.x0, FL0 + 1, PORCH.z0], [PORCH.x1, FL1 - 1, PORCH.z1])
  for (const x of [PORCH.x0, PORCH.x1]) b.box([x, FL0 + 1, PORCH.z1], [x, FL1 - 1, PORCH.z1], POST)
  b.box([PORCH.x0, FL1, PORCH.z1], [PORCH.x1, FL1, PORCH.z1], beam('x'))
  for (const z of [PORCH.z0, PORCH.z1]) for (const x of [PORCH.x0, PORCH.x1]) b.set(x, FL1, z, POST)

  // ------------------------------------------------------------------ 6. roofs
  // Secondary roofs are built on a scratch canvas and merged column by column: wherever the new
  // roof is higher than what is already there it wins (and clears the old roof inside its own
  // attic), elsewhere the old roof stays. That yields clean valleys where roofs meet, and lets
  // each section keep its own pitch (b.compoundRoof does one pitch for a whole plan).
  // Lesson: start a cross roof's back end where the main roof is already as high as its ridge,
  // or its rear overhang pokes out and leaves a hole (a section render caught this).
  function mergeRoof(opts, { floorY = ROOF_Y, keepCell = () => true } = {}) {
    const tmp = b.module(b.size)
    tmp.roof(opts)
    const cols = new Map()
    for (const [x, y, z, block] of tmp.entries()) {
      if (!keepCell(x, y, z)) continue
      const k = `${x},${z}`
      if (!cols.has(k)) cols.set(k, [])
      cols.get(k).push([y, block])
    }
    for (const [k, list] of cols) {
      const [x, z] = k.split(',').map(Number)
      const top = Math.max(...list.map(([y]) => y))
      let cur = -1
      for (let y = b.size[1] - 1; y >= floorY; y -= 1) if (b.has(x, y, z)) { cur = y; break }
      if (top <= cur) continue
      for (let y = floorY; y <= top; y += 1) b.remove(x, y, z)
      for (const [y, block] of list) b.set(x, y, z, block)
    }
  }
  const studGable = (u, every) => (u % every === 0 ? POST : DAUB)
  // main roof: gables east and west framed with posts and two collar rails, a slate ridge crest
  b.roof({ x0: UP.x0, z0: UP.z0, x1: UP.x1, z1: UP.z1, y: ROOF_Y, axis: 'x', material: ROOF, pitch: MAIN_PITCH,
    eaveTrim: true, ridgeCap: 'deepslate_tile_wall', gable: (x, y, z) => (y === 21 || y === 24 ? beam('z') : (z - 1) % 4 === 0 ? POST : DAUB) })
  // the main roof's eave would run through the bay walls: clear it there first
  b.clear([BAY.x0 - 1, FL2 - 1, UP.z1 + 1], [BAY.x1 + 1, ROOF_Y, UP.z1 + 1])
  // The bay's street gable is jettied once more: the triangle stands one block forward of the
  // wall below on a sill beam and corbels, so it casts its own shadow line and leads the roof.
  const GZ = BAY.z1 + 1
  mergeRoof({ x0: BAY.x0, z0: 26, x1: BAY.x1, z1: GZ, y: ROOF_Y, axis: 'z', material: ROOF, pitch: BAY_PITCH, eaveTrim: true,
    gable: (x, y, z) => (z !== GZ ? null : y === ROOF_Y || y === 22 ? beam('x') : y < 22 ? studGable(x - 1, 2) : x === 21 ? POST : DAUB) }, { floorY: FL2 + 1 })
  for (let x = BAY.x0; x <= BAY.x1; x += 2) b.set(x, PLATE, GZ, 'dark_oak_stairs[facing=north,half=top]')
  mergeRoof({ x0: WING.x0, z0: WING.z0, x1: WING.x1, z1: 22, y: ROOF_Y, axis: 'z', material: ROOF, pitch: MAIN_PITCH, eaveTrim: true,
    gable: (x, y, z) => (z !== WING.z0 ? null : y === 21 ? beam('x') : studGable(x, 4)) })
  // stable lean-to: a slab-stepped shed climbing toward the gable wall; same slate as the inn
  // (one roof material for the whole group), cells inside the main wall are dropped
  mergeRoof({ x0: STABLE.x0, z0: STABLE.z0, x1: STABLE.x1, z1: STABLE.z1, y: 10, type: 'shed', rises: 'west', material: ROOF, pitch: 0.5, eaveTrim: true },
    { floorY: 9, keepCell: x => x > UP.x1 })
  // Dormers. The street slope gets ONE wide wall dormer east of the bay: chimney west, gable in
  // the middle, dormer east is an asymmetric but balanced front (3-wide dormers set back a row
  // read as dark holes on a roof this big). A small one on the back slope lights the corridor
  // end of the attic. Fronts are framed like the wall below: corner posts, plaster between.
  for (const [cx, cz, y0, w, facing] of [[30, UP.z1, ROOF_Y, 5, 'south'], [16, UP.z0 + 1, ROOF_Y + 2, 3, 'north']]) {
    const half = (w - 1) / 2
    const wall = (x, y, z) => (z === cz && (Math.abs(x - cx) === half || (w === 5 && x === cx && y >= y0 + 3)) ? POST : DAUB)
    b.dormer([cx, y0, cz], facing, { width: w, height: 3, material: ROOF, wall, window: { width: w - 2, height: 2, mullion: POST } })
  }
  // bargeboards: the soffit stairs under every rake become warm spruce, outlining each gable
  for (const [x, y, z, block] of [...b.entries()]) {
    if (y < ROOF_Y - 1 || block.name !== 'minecraft:deepslate_tile_stairs' || block.props?.half !== 'top') continue
    const rake = ((x === UP.x0 - 1 || x === UP.x1 + 1) && z >= UP.z0 - 1 && z <= UP.z1 + 1) ||
      (z === GZ + 1 && x >= BAY.x0 - 1 && x <= BAY.x1 + 1) || (z === WING.z0 - 1 && x >= WING.x0 - 1 && x <= WING.x1 + 1)
    if (rake) b.set(x, y, z, { name: 'minecraft:spruce_stairs', props: block.props })
  }

  // ------------------------------------------------------------------ 7. chimneys
  // West stack: a broad breast on the gable facing the crossroads that steps in twice (sloped
  // stair weatherings on each setback), ends 4 above the ridge in an oversailing cap with two
  // brick pots, and smokes (campfires). It is hollow: a real flue, and no hidden blocks.
  for (let x = CH.x0; x <= CH.x1; x += 1) for (let z = CH.z0; z <= CH.z1; z += 1) b.box([x, ground(x, z) - 2, z], [x, 12, z], CHIM)
  b.box([CH.x0, 13, CH.z0 + 1], [CH.x1, 16, CH.z1 - 1], CHIM)
  b.box([CH.x0, 17, 23], [CH.x0 + 2, 29, 25], CHIM)
  for (let z = CH.z0; z <= CH.z1; z += 1) b.set(CH.x0 - 1, 12, z, 'stone_brick_stairs[facing=east,half=bottom]')
  for (const [z, f] of [[CH.z0, 'south'], [CH.z1, 'north']]) for (let x = CH.x0; x <= CH.x1; x += 1) b.set(x, 13, z, `stone_brick_stairs[facing=${f},half=bottom]`)
  for (let z = CH.z0 + 1; z <= CH.z1 - 1; z += 1) b.set(CH.x0 - 1, 16, z, 'stone_brick_stairs[facing=east,half=bottom]')
  for (const [z, f] of [[22, 'south'], [26, 'north']]) for (let x = CH.x0; x <= CH.x0 + 2; x += 1) b.set(x, 17, z, `stone_brick_stairs[facing=${f},half=bottom]`)
  for (let x = CH.x0 - 1; x <= CH.x0 + 3; x += 1) for (let z = 22; z <= 26; z += 1) {
    if (x >= CH.x0 && x <= CH.x0 + 2 && z >= 23 && z <= 25) continue
    const f = x === CH.x0 - 1 ? 'east' : x === CH.x0 + 3 ? 'west' : z === 22 ? 'south' : 'north'
    b.set(x, 29, z, `stone_brick_stairs[facing=${f},half=top]`)
  }
  b.box([CH.x0, 30, 23], [CH.x0 + 2, 30, 25], 'bricks')
  for (const z of [23, 25]) {
    b.set(CH.x0 + 1, 30, z, 'campfire[lit=true,signal_fire=false,facing=north]')
    b.set(CH.x0 + 1, 31, z, 'brick_wall')
  }
  b.clear([CH.x0 + 1, ground(9, 24), CH.z0 + 1], [CH.x1 - 1, 12, CH.z1 - 1])
  b.clear([CH.x0 + 1, 13, CH.z0 + 2], [CH.x1 - 1, 16, CH.z1 - 2])
  b.clear([CH.x0 + 1, 17, 24], [CH.x0 + 1, 29, 24])
  // kitchen stack on the wing's north gable (the cooking range is set into the wall behind it)
  for (let x = 27; x <= 29; x += 1) for (let z = 8; z <= 9; z += 1) b.box([x, ground(x, z) - 2, z], [x, 11, z], CHIM)
  for (const x of [27, 29]) b.set(x, 12, 8, 'stone_brick_stairs[facing=south,half=bottom]')
  b.box([28, 12, 8], [29, 26, 9], CHIM)
  b.set(27, 12, 9, 'stone_brick_stairs[facing=east,half=bottom]')
  b.box([28, 27, 8], [29, 27, 9], 'bricks')
  b.set(28, 27, 9, 'campfire[lit=true,signal_fire=false,facing=north]')
  b.set(29, 28, 8, 'brick_wall')

  // ------------------------------------------------------------------ 8. doors and windows
  // Front door: recessed in the 2-thick wall behind a chamfered stone opening (upside-down stairs
  // in the top corners), framed in the inner layer by posts and a lintel.
  b.clear([DOOR_X - 1, FL0 + 1, MAIN.z1], [DOOR_X + 1, FL0 + 2, MAIN.z1])
  b.set(DOOR_X, FL0 + 3, MAIN.z1, 'air')
  b.set(DOOR_X - 1, FL0 + 3, MAIN.z1, 'stone_brick_stairs[facing=west,half=top]')
  b.set(DOOR_X + 1, FL0 + 3, MAIN.z1, 'stone_brick_stairs[facing=east,half=top]')
  b.door([DOOR_X, FL0 + 1, MAIN.z1 - 1], 'south', { material: 'dark_oak' })
  b.set(DOOR_X, FL0 + 3, MAIN.z1 - 1, beam('x'))
  for (const x of [DOOR_X - 1, DOOR_X + 1]) b.box([x, FL0 + 1, MAIN.z1 - 1], [x, FL0 + 3, MAIN.z1 - 1], POST)
  // ground floor: 2x2 windows, heads level with the door head; on the thick street wall the pane
  // sits one block in (recess 1) above a stone sill; shutters only where the wall has room
  const SILL_STONE = 'stone_brick_stairs[facing=north,half=top]'
  for (const x of [14, 28, 32]) b.window([x, FL0 + 2, MAIN.z1], 'south', { width: 2, height: 2, recess: 1, sill: SILL_STONE, shutters: true })
  for (const x of [18, 23]) b.window([x, FL0 + 2, MAIN.z1], 'south', { width: 2, height: 2, recess: 1, sill: SILL_STONE })
  const hood = 'stone_brick_slab[type=bottom]'
  for (const x of [14, 18]) b.window([x, FL0 + 2, MAIN.z0], 'north', { width: 2, height: 2, sill: 'stone_brick_stairs[facing=south,half=top]', shutters: true, lintel: hood })
  b.window([WING.x0, FL0 + 2, 12], 'west', { width: 2, height: 2, sill: 'stone_brick_stairs[facing=east,half=top]', shutters: true, lintel: hood })
  b.window([WING.x1, FL0 + 2, 17], 'east', { width: 2, height: 2, sill: 'stone_brick_stairs[facing=west,half=top]', shutters: true, lintel: hood })
  b.door([WING.x0, FL0 + 1, 16], 'west', { material: 'spruce', frame: 'stripped_spruce_log' })
  b.door([WING.x1, FL0 + 1, 13], 'east', { material: 'spruce', frame: 'stripped_spruce_log' })
  // upper floor: leaded lancets between the close studs, one thin sill board per group
  for (const x of [13, 15, 27, 29, 31, 33]) b.window([x, FL1 + 2, UP.z1], 'south', { width: 1, height: 2, sill: false })
  for (const x of [20, 22]) b.window([x, FL1 + 2, BAY.z1], 'south', { width: 1, height: 2, sill: false })
  for (const [x0, x1] of [[13, 15], [27, 29], [31, 33]]) b.box([x0, FL1 + 1, UP.z1 + 1], [x1, FL1 + 1, UP.z1 + 1], 'spruce_slab[type=top]')
  for (const x of [14, 18, 22]) b.set(x, FL1 + 1, UP.z0 - 1, 'spruce_slab[type=top]')
  for (const z of [20, 29]) b.set(UP.x0 - 1, FL1 + 1, z, 'spruce_slab[type=top]')
  for (const z of [16, 17]) { b.set(WING.x0 - 1, FL1 + 1, z, 'spruce_slab[type=top]'); b.set(WING.x1 + 1, FL1 + 1, z, 'spruce_slab[type=top]') }
  // one long flower box under the bay's two lights (soil boxed in by open trapdoors, on corbels)
  for (let x = 19; x <= 23; x += 1) {
    b.set(x, FL1 + 1, BAY.z1 + 1, 'rooted_dirt')
    b.set(x, FL1 + 1, BAY.z1 + 2, 'spruce_trapdoor[facing=south,open=true,half=bottom]')
    b.set(x, FL1 + 2, BAY.z1 + 1, ['poppy', 'cornflower', 'oxeye_daisy', 'cornflower', 'poppy'][x - 19])
  }
  b.set(18, FL1 + 1, BAY.z1 + 1, 'spruce_trapdoor[facing=west,open=true,half=bottom]')
  b.set(24, FL1 + 1, BAY.z1 + 1, 'spruce_trapdoor[facing=east,open=true,half=bottom]')
  for (const x of [19, 23]) b.set(x, FL1, BAY.z1 + 1, 'dark_oak_stairs[facing=north,half=top]')
  for (const x of [20, 22]) b.window([x, 19, GZ], 'south', { width: 1, height: 2, sill: false })
  for (const x of [14, 18, 22]) b.window([x, FL1 + 2, UP.z0], 'north', { width: 1, height: 2, sill: false })
  for (const z of [20, 29]) b.window([UP.x0, FL1 + 2, z], 'west', { width: 1, height: 2, sill: false, shutters: true })
  b.window([UP.x1, FL1 + 2, 25], 'east', { width: 1, height: 2, sill: false, shutters: true })
  b.window([UP.x1, 19, 24], 'east', { width: 3, height: 2, sill: false, mullion: POST })
  for (const z of [16, 17]) for (const x of [WING.x0, WING.x1]) b.window([x, FL1 + 2, z], x === WING.x0 ? 'west' : 'east', { width: 1, height: 2, sill: false })
  // a pair of 2-light windows on the wing gets one pair of shutters (outside the pair, not between)
  for (const x of [WING.x0, WING.x1]) for (const z of [15, 18]) for (const y of [FL1 + 2, FL1 + 3]) {
    b.set(x + (x === WING.x0 ? -1 : 1), y, z, `spruce_trapdoor[facing=${x === WING.x0 ? 'west' : 'east'},open=true,half=${y === FL1 + 3 ? 'top' : 'bottom'}]`)
  }

  // ------------------------------------------------------------------ 9. porch and stable carpentry
  b.box([PORCH.x0, FL0, PORCH.z0], [PORCH.x1, FL0, PORCH.z1], PLINTH)
  for (let x = PORCH.x0 + 1; x <= PORCH.x1 - 1; x += 1) {                 // two steps down to the forecourt
    b.set(x, FL0, PORCH.z1 + 1, 'stone_brick_stairs[facing=north,half=bottom]')
    b.set(x, FL0 - 1, PORCH.z1 + 2, 'stone_brick_stairs[facing=north,half=bottom]')
    for (let y = ground(x, PORCH.z1 + 2); y < FL0 - 1; y += 1) b.set(x, y, PORCH.z1 + 2, PLINTH)
  }
  // knee braces between the porch posts and the bay's sill beams (upside-down stairs)
  b.set(PORCH.x0 + 1, FL1 - 1, PORCH.z1, 'dark_oak_stairs[facing=west,half=top]')
  b.set(PORCH.x1 - 1, FL1 - 1, PORCH.z1, 'dark_oak_stairs[facing=east,half=top]')
  for (const x of [PORCH.x0, PORCH.x1]) {
    b.set(x, FL1 - 1, PORCH.z1 - 1, 'dark_oak_stairs[facing=south,half=top]')
    b.set(x, FL1 - 1, PORCH.z0, 'dark_oak_stairs[facing=north,half=top]')
  }
  // stable: earth floor a step below the inn, boarded ends filled up to the roof underside,
  // posts on the yard side. Rougher carpentry than the inn: spruce in the bark, not dark oak.
  const shedUnder = (x, z) => { for (let y = 9; y < 20; y += 1) if (b.has(x, y, z) && /deepslate/.test(b.nameAt(x, y, z))) return y; return 10 }
  for (let x = STABLE.x0; x <= STABLE.x1; x += 1) for (let z = STABLE.z0; z <= STABLE.z1; z += 1) {
    for (let y = ground(x, z) - 1; y <= 5; y += 1) b.set(x, y, z, 'dirt')
    b.set(x, 6, z, 'coarse_dirt')
  }
  for (const z of [STABLE.z0, STABLE.z1]) for (let x = STABLE.x0; x <= STABLE.x1; x += 1) {
    for (let y = 6; y < shedUnder(x, z); y += 1) b.set(x, y, z, x === STABLE.x1 ? 'spruce_log[axis=y]' : y === 6 ? PLINTH : 'stripped_spruce_log[axis=y]')
  }
  for (const z of [22, 26]) b.box([STABLE.x1, 6, z], [STABLE.x1, 9, z], 'spruce_log[axis=y]')
  for (let z = STABLE.z0; z <= STABLE.z1; z += 1) b.set(STABLE.x1, 9, z, [STABLE.z0, STABLE.z1, 22, 26].includes(z) ? 'spruce_log[axis=y]' : 'spruce_log[axis=z]')

  // ------------------------------------------------------------------ 10. texture (one call per surface role)
  // Each call's box is the role's own extent, so "darker toward the base" means the base of that
  // surface. maxStep 1 keeps neighbours on adjacent ramp steps (no splatter).
  if (at('texture')) {
    b.texture([MAIN.x0, FL0, WING.z0], [MAIN.x1, FL1 - 1, MAIN.z1], ['andesite', 'cobblestone', 'stone_bricks', 'tuff_bricks'],
      { only: STONE, focus: [[DOOR_X, FL0 + 2, MAIN.z1]], maxStep: 1, seed: 3 })                // brighter round the door
    b.texture([0, 0, 0], [51, FL0, 45], ['tuff_bricks', 'cobbled_deepslate', 'deepslate_bricks'], { only: PLINTH, base: 0.35, seed: 5 })
    b.texture([0, FL1, 0], [51, 30, 45], ['calcite', 'smooth_sandstone'], { only: DAUB, mid: 0.7, base: 0.2, drip: 0.15, noise: 0.18, maxStep: 1, seed: 7 })
    // roof: tiles dominate, brick patches, lighter (sun-faded) toward the ridges
    b.texture([0, 9, 0], [51, 30, 45], ['cobbled_deepslate', 'deepslate_bricks', 'deepslate_tiles'],
      { only: n => /deepslate/.test(n.name), mid: 0.75, base: 0.3, top: 0.35, edge: 0.1, noise: 0.2, maxStep: 1, seed: 11 })
    // chimneys after the roof (their sooty top is cobbled deepslate, which the roof pass would
    // catch); a negative `top` darkens toward the top: soot
    b.texture([0, 0, 0], [51, 31, 45], ['cobblestone', 'stone_bricks', 'tuff_bricks', 'cobbled_deepslate'], { only: CHIM, base: 0.25, top: -0.35, seed: 9 })
    // age with logic: moss and cracks low on the walls, and on the shaded north side only
    b.weather([0, 0, 0], [51, FL0 + 1, 45], { share: 0.2, mossBias: 0.7, seed: 2 })
    b.weather([0, FL0, 0], [51, FL1, MAIN.z0], { share: 0.12, mossBias: 0.8, seed: 3 })
  }

  if (at('interior')) interior()
  if (at('landscape')) landscape()
  if (at('final')) propsAndLights()
  return b.finish({ name: 'tavern', description: 'Two-and-a-half-storey Tudor coaching inn at a crossroads, fully furnished inside' })

  // ------------------------------------------------------------------ 11. interior
  function interior() {
    const G = FL0 + 1   // first air row of the ground floor
    const U = FL1 + 1   // first air row upstairs
    const A = FL2 + 1   // first air row in the attic
    const plaster = kit.palette({ smooth_sandstone: 3, calcite: 2 }, { scale: 3, seed: 2 })

    // ---- furniture modules: authored once with their front facing south, stamped rotated
    //      (rotate 1 = front west, 2 = north, 3 = east); block states rotate with them
    const M = {}
    M.dining = b.module([3, 1, 4])                     // 3x2 trestle table (stair legs + top slab), 4 stair chairs
    for (const z of [1, 2]) {
      M.dining.set(0, 0, z, 'dark_oak_stairs[facing=west,half=top]')
      M.dining.set(1, 0, z, 'dark_oak_slab[type=top]')
      M.dining.set(2, 0, z, 'dark_oak_stairs[facing=east,half=top]')
    }
    for (const x of [0, 2]) {
      M.dining.set(x, 0, 0, 'spruce_stairs[facing=north,half=bottom]')
      M.dining.set(x, 0, 3, 'spruce_stairs[facing=south,half=bottom]')
    }
    M.armchair = b.module([3, 1, 1])                   // stair seat, open-trapdoor arms
    M.armchair.set(1, 0, 0, 'spruce_stairs[facing=north,half=bottom]')
    M.armchair.set(0, 0, 0, 'spruce_trapdoor[facing=west,half=bottom,open=true]')
    M.armchair.set(2, 0, 0, 'spruce_trapdoor[facing=east,half=bottom,open=true]')
    M.bed = color => {                                 // single bed, head against the north wall
      const m = b.module([1, 1, 2])
      m.set(0, 0, 0, `${color}_bed[facing=north,part=head]`)
      m.set(0, 0, 1, `${color}_bed[facing=north,part=foot]`)
      return m
    }
    M.nightstand = b.module([1, 2, 1])
    M.nightstand.set(0, 0, 0, 'barrel[facing=up]')
    M.nightstand.set(0, 1, 0, 'candle[candles=2,lit=true]')
    M.wardrobe = b.module([2, 3, 1])                   // two doors against a wall + stair cornice
    M.wardrobe.set(0, 0, 0, 'spruce_door[facing=south,half=lower,hinge=left]')
    M.wardrobe.set(1, 0, 0, 'spruce_door[facing=south,half=lower,hinge=right]')
    M.wardrobe.set(0, 2, 0, 'spruce_stairs[facing=north,half=top]')
    M.wardrobe.set(1, 2, 0, 'spruce_stairs[facing=north,half=top]')
    M.desk = b.module([2, 2, 2])                       // desk on a north wall, chair facing it
    M.desk.set(0, 0, 0, 'spruce_stairs[facing=west,half=top]')
    M.desk.set(1, 0, 0, 'spruce_stairs[facing=east,half=top]')
    M.desk.set(0, 0, 1, 'spruce_stairs[facing=south,half=bottom]')
    M.desk.set(0, 1, 0, 'candle[candles=1,lit=true]')
    M.desk.set(1, 1, 0, 'flower_pot')
    M.chandelier = b.module([3, 2, 3])                 // fence cross under the deck, 4 lanterns hung 1 above the table
    for (const [x, z] of [[1, 1], [0, 1], [2, 1], [1, 0], [1, 2]]) M.chandelier.set(x, 1, z, 'dark_oak_fence')
    for (const [x, z] of [[0, 1], [2, 1], [1, 0], [1, 2]]) M.chandelier.set(x, 0, z, 'lantern[hanging=true]')
    M.keg = b.module([1, 2, 2])                        // two casks on their side, a lever spigot on the lower
    M.keg.set(0, 0, 0, 'barrel[facing=south]')
    M.keg.set(0, 1, 0, 'barrel[facing=south]')
    M.keg.set(0, 0, 1, 'lever[face=wall,facing=south]')
    M.cabinet = b.module([1, 3, 2])                    // cupboard (planks + trapdoor door), shelf board above
    M.cabinet.set(0, 0, 0, 'spruce_planks')
    M.cabinet.set(0, 0, 1, 'spruce_trapdoor[facing=south,half=bottom,open=true]')
    M.cabinet.set(0, 2, 0, 'spruce_trapdoor[facing=south,half=top,open=false]')

    // ---- ground floor: the taproom (x 14..33, z 20..28, 4 clear) ------------------------
    // Zones without partitions: fireside snug (west), bar (north-east), tables (south), stair (east).
    // The thick street walls are limewashed inside above a plank skirting; stone shows only in
    // the reveals, so a cutaway reads "rubble wall + plaster lining".
    const stoneIds = /andesite|cobblestone|stone_bricks|tuff/
    const lining = (x, y, z) => { if (stoneIds.test(b.nameAt(x, y, z) ?? '')) b.set(x, y, z, y === G ? 'spruce_planks' : plaster) }
    for (let y = G; y <= FL1 - 1; y += 1) {
      for (let z = MAIN.z0 + 1; z <= MAIN.z1 - 1; z += 1) lining(MAIN.x0 + 1, y, z)
      for (let x = MAIN.x0 + 2; x <= MAIN.x1 - 1; x += 1) lining(x, y, MAIN.z1 - 1)
    }
    // floor: dark border ring around a spruce field, stone hearth, rug, flags behind the bar
    b.box([14, FL0, 20], [33, FL0, 28], (x, y, z) => {
      if (x === 15 && z >= 21 && z <= 27) return 'stone_bricks'
      if (x >= 16 && x <= 17 && z >= 21 && z <= 27) return z === 21 || z === 27 ? 'brown_wool' : 'red_wool'
      if (x >= 25 && z <= 22) return kit.palette({ polished_andesite: 3, stone_bricks: 2 }, { scale: 2, seed: 5 })
      if (x === 14 || x === 33 || z === 20 || z === 28) return 'dark_oak_planks'
      return 'spruce_slab[type=top]'
    })
    // The great fireplace (the room's focal point): a stone breast projecting from the thick west
    // wall, a timber bressummer, and a deep firebox cut through the wall to the chimney, with the
    // cooking pot (water cauldron) hanging on a chain over the fire.
    const hearthStone = kit.palette({ stone_bricks: 4, cracked_stone_bricks: 1, mossy_stone_bricks: 0.3 }, { scale: 1.5, seed: 8 })
    b.box([14, G, 21], [14, FL1 - 1, 27], hearthStone)
    b.clear([12, G, 23], [14, G + 1, 25])
    b.box([12, G + 2, 23], [13, G + 2, 25], 'air')
    b.box([11, G, 23], [11, G + 3, 25], 'cobbled_deepslate')                  // soot-black fireback
    b.box([12, FL0, 23], [14, FL0, 25], 'bricks')
    b.set(13, G, 24, 'campfire[lit=true,signal_fire=false,facing=east]')
    b.set(13, G + 1, 24, 'water_cauldron[level=3]')
    b.set(13, G + 2, 24, 'chain[axis=y]')
    for (const z of [23, 25]) b.set(12, G, z, 'oak_log[axis=x]')
    b.box([14, G + 2, 22], [14, G + 2, 26], beam('z'))
    b.box([15, G + 2, 21], [15, G + 2, 27], 'spruce_slab[type=top]')           // mantel shelf
    b.set(15, G + 3, 22, 'candle[candles=3,lit=true]')
    b.set(15, G + 3, 24, 'decorated_pot[facing=east]')
    b.set(15, G + 3, 26, 'candle[candles=2,lit=true]')
    b.box([15, G, 27], [15, G + 1, 27], 'oak_log[axis=x]')                     // firewood stack
    b.set(15, G, 21, 'oak_log[axis=z]')
    b.stamp(M.armchair, [17, G, 21], { rotate: 1 })                             // the snug: two chairs face the fire
    b.stamp(M.armchair, [17, G, 24], { rotate: 1 })
    // Ceiling: girders across the short span every 4, upside-down-stair knee braces where they
    // meet the walls, and two free-standing posts braced both ways (they frame the snug and the bar).
    for (const x of [18, 22, 26, 30]) {
      b.box([x, FL1 - 1, 20], [x, FL1 - 1, 28], beam('z'))
      b.set(x, FL1 - 1, MAIN.z0, beam('z'))                                     // beam end shows in the wall
      b.set(x, FL1 - 2, 20, 'dark_oak_stairs[facing=north,half=top]')
      b.set(x, FL1 - 2, 28, 'dark_oak_stairs[facing=south,half=top]')
    }
    for (const x of [18, 26]) {
      b.box([x, G, 24], [x, FL1 - 2, 24], POST)
      b.set(x, FL1 - 2, 23, 'dark_oak_stairs[facing=south,half=top]')
      b.set(x, FL1 - 2, 25, 'dark_oak_stairs[facing=north,half=top]')
    }
    // the bar: an L-shaped counter of stripped spruce, fence-and-plate stools on the guest side
    for (let x = 24; x <= 31; x += 1) b.set(x, G, 23, 'stripped_spruce_log[axis=x]')
    for (let z = 20; z <= 22; z += 1) b.set(24, G, z, 'stripped_spruce_log[axis=z]')
    for (const x of [25, 27, 29, 31]) { b.set(x, G, 24, 'spruce_fence'); b.set(x, G + 1, 24, 'dark_oak_pressure_plate') }
    for (const [x, z, id] of [[25, 23, 'candle[candles=3,lit=true]'], [27, 23, 'brewing_stand[has_bottle_0=true,has_bottle_1=false,has_bottle_2=true]'],
      [28, 23, 'flower_pot'], [30, 23, 'decorated_pot[facing=south]'], [24, 21, 'potted_fern']]) b.set(x, G + 1, z, id)
    // behind the bar: tapped casks on the north wall, cupboards with bottles (brewing stands,
    // pots, candles), more casks along the east wall, the kitchen door, a lantern over the till
    for (const x of [25, 26, 27]) b.stamp(M.keg, [x, G, 20])
    for (const x of [28, 30, 31]) b.stamp(M.cabinet, [x, G, 20])
    b.set(28, G + 1, 20, 'brewing_stand[has_bottle_0=true,has_bottle_1=true,has_bottle_2=false]')
    b.set(30, G + 1, 20, 'potted_red_tulip')
    b.set(31, G + 1, 20, 'candle[candles=4,lit=true]')
    b.set(28, G + 3, 20, 'flower_pot')
    b.set(31, G + 3, 20, 'brewing_stand[has_bottle_0=false,has_bottle_1=true,has_bottle_2=true]')
    for (const z of [20, 21, 22]) b.stamp(M.keg, [32, G, z], { rotate: 3 })
    b.door([29, G, MAIN.z0], 'north', { material: 'spruce' })
    b.set(28, FL1 - 1, 21, 'lantern[hanging=true]')
    // tables, each with its own light; chandeliers hang between the girders over the tables
    b.stamp(M.dining, [19, G, 20])
    b.stamp(M.dining, [23, G, 26], { rotate: 1 })
    b.stamp(M.dining, [27, G, 26], { rotate: 1 })
    for (const [x, z, id] of [[20, 21, 'candle[candles=3,lit=true]'], [20, 22, 'potted_red_tulip'], [24, 27, 'candle[candles=2,lit=true]'],
      [25, 26, 'cake'], [29, 27, 'candle[candles=3,lit=true]'], [28, 28, 'flower_pot']]) b.set(x, G + 1, z, id)
    b.stamp(M.chandelier, [23, FL1 - 2, 26])
    b.stamp(M.chandelier, [27, FL1 - 2, 26])
    b.set(20, FL1 - 1, 21, 'lantern[hanging=true]')
    // settle and table in the window corner west of the door
    for (let x = 15; x <= 18; x += 1) b.set(x, G, 28, 'spruce_stairs[facing=south,half=bottom]')
    b.set(15, G, 28, 'spruce_trapdoor[facing=west,half=bottom,open=true]')
    b.set(16, G, 27, 'dark_oak_stairs[facing=west,half=top]')
    b.set(17, G, 27, 'dark_oak_stairs[facing=east,half=top]')
    b.set(16, G + 1, 27, 'candle[candles=2,lit=true]')
    // wainscot: open trapdoors along the lowest course wherever nothing stands (keep: true)
    for (let x = 14; x <= 23; x += 1) b.set(x, G, 20, 'spruce_trapdoor[facing=south,half=bottom,open=true]', { keep: true })
    for (let x = 19; x <= 30; x += 1) if (x !== DOOR_X) b.set(x, G, 28, 'spruce_trapdoor[facing=north,half=bottom,open=true]', { keep: true })
    b.set(14, G, 28, 'spruce_trapdoor[facing=east,half=bottom,open=true]', { keep: true })
    // staircase up the east wall: open, with upside-down stairs as stringers, casks under it;
    // the deck above is opened so there is headroom on every step
    b.stairway([33, G, 27], 'north', 4, 'spruce', { width: 2, fill: false })
    for (let i = 1; i < 4; i += 1) for (const x of [32, 33]) b.set(x, G + i - 1, 27 - i, 'spruce_stairs[facing=south,half=top]')
    b.set(33, G, 24, 'barrel[facing=up]')
    b.set(32, G, 24, 'barrel[facing=west]')
    b.clear([32, FL1, 24], [33, FL1, 25])
    b.set(22, G + 1, 28, 'spruce_fence')                                        // lamp by the door
    b.set(22, G + 2, 28, 'lantern[hanging=false]')
    b.set(20, G, 28, 'barrel[facing=up]')

    // ---- kitchen wing (x 25..31, z 11..18) -------------------------------------------------
    b.box([25, FL0, 11], [31, FL0, 18], kit.palette({ stone_bricks: 3, polished_andesite: 2, cobblestone: 1 }, { scale: 2, seed: 6 }))
    // cooking range set into the north gable (smoker, open fire, oven), brick hood, stack outside
    b.set(27, G, 10, 'smoker[facing=south,lit=true]')
    b.set(28, G, 10, 'campfire[lit=true,signal_fire=false,facing=south]')
    b.set(29, G, 10, 'furnace[facing=south,lit=true]')
    b.set(28, G + 1, 10, 'air')
    for (const x of [27, 28, 29]) b.set(x, G + 2, 11, 'brick_stairs[facing=north,half=top]')
    b.set(26, G + 2, 11, 'brick_stairs[facing=east,half=top]')
    b.set(30, G + 2, 11, 'brick_stairs[facing=west,half=top]')
    b.box([26, G + 3, 11], [30, G + 3, 11], 'bricks')
    // counter run under the garden window: cask, sink, cupboard + chopping board, crock
    b.set(25, G, 11, 'barrel[facing=east]')
    b.set(25, G, 12, 'water_cauldron[level=3]')
    b.set(25, G, 13, 'spruce_planks')
    b.set(26, G, 13, 'spruce_trapdoor[facing=east,half=bottom,open=true]')
    b.set(25, G + 1, 13, 'dark_oak_pressure_plate')
    b.set(25, G, 14, 'barrel[facing=up]')
    b.set(25, G + 1, 14, 'potted_fern')
    // work table in the middle, pantry corner (sacks, roots, casks), shelf over the dresser
    b.set(27, G, 14, 'spruce_stairs[facing=west,half=top]')
    b.set(28, G, 14, 'spruce_slab[type=top]')
    b.set(29, G, 14, 'spruce_stairs[facing=east,half=top]')
    b.set(28, G + 1, 14, 'cake')
    b.set(27, G + 1, 14, 'melon')
    b.set(28, G, 15, 'spruce_stairs[facing=south,half=bottom]')
    for (const [x, y, z, id] of [[25, G, 18, 'hay_block[axis=x]'], [26, G, 18, 'barrel[facing=up]'], [25, G + 1, 18, 'pumpkin'], [25, G, 17, 'barrel[facing=east]'],
      [31, G, 11, 'barrel[facing=up]'], [31, G, 12, 'chest[facing=west]'], [31, G + 3, 11, 'flower_pot'], [31, G + 3, 12, 'decorated_pot[facing=west]']]) b.set(x, y, z, id)
    for (const z of [11, 12]) b.set(31, G + 2, z, 'spruce_trapdoor[facing=west,half=top,open=false]')
    b.set(28, FL1 - 1, 13, 'lantern[hanging=true]')
    // cellar under the wing (3 clear), reached by a stone stair in the south-east corner that
    // drops through a railed opening in the kitchen floor
    b.box([24, 2, 10], [32, FL0 - 1, 19], kit.palette({ cobblestone: 3, stone_bricks: 2, mossy_cobblestone: 1 }, { scale: 2, seed: 12 }))
    b.box([25, 2, 11], [31, 2, 18], kit.palette({ stone: 3, cobblestone: 2, andesite: 1 }, { scale: 2, seed: 13 }))
    b.clear([25, 3, 11], [31, FL0 - 1, 18])
    for (let k = 0; k < 4; k += 1) for (const x of [30, 31]) {
      b.set(x, FL0 - 1 - k, 15 + k, 'stone_brick_stairs[facing=north,half=bottom]')
      for (let y = 3; y < FL0 - 1 - k; y += 1) b.set(x, y, 15 + k, 'cobblestone')
    }
    b.clear([30, FL0, 15], [31, FL0, 16])
    for (const z of [15, 16]) b.set(29, G, z, 'spruce_fence')
    for (const x of [30, 31]) b.set(x, G, 17, 'spruce_fence')
    for (const z of [11, 12, 13, 14, 15, 16]) { b.set(25, 3, z, 'barrel[facing=east]'); b.set(25, 4, z, 'barrel[facing=east]') }
    for (const x of [26, 27, 28]) b.set(x, 3, 11, 'barrel[facing=south]')
    for (const [x, y, z, id] of [[29, 3, 11, 'chest[facing=south]'], [27, 3, 17, 'hay_block[axis=x]'], [26, 3, 18, 'barrel[facing=up]'], [26, 5, 11, 'cobweb']]) b.set(x, y, z, id)
    b.set(28, FL0 - 1, 14, 'lantern[hanging=true]')

    // ---- first floor: corridor along the back, three guest rooms on the street, landing --------
    // timber partitions: posts every 4, plank skirting, plaster panel, beam under the ceiling
    const partition = (along, w, u0, u1) => {
      for (let u = u0; u <= u1; u += 1) for (let y = U; y <= FL2 - 1; y += 1) {
        const post = u === u0 || u === u1 || (u - u0) % 4 === 0
        const paint = y === FL2 - 1 ? beam(along) : post ? POST : y === U ? 'spruce_planks' : plaster
        b.set(...(along === 'x' ? [u, y, w] : [w, y, u]), paint)
      }
    }
    partition('x', 22, 12, 30)        // corridor wall
    partition('z', 17, 22, 31)        // S1 | S2 (in line with the bay's west wall)
    partition('z', 25, 22, 31)        // S2 | S3 (in line with the bay's east wall)
    partition('z', 30, 22, 31)        // S3 | landing
    for (const x of [15, 21, 28]) b.door([x, U, 22], 'north', { material: 'spruce' })
    b.door([27, U, UP.z0], 'north', { material: 'spruce' })                   // to the innkeeper's room
    for (const x of [15, 19, 23, 27, 31]) b.box([x, FL2, 20], [x, FL2, 30], 'dark_oak_planks')   // ceiling joists
    // corridor: red runner, lanterns from the joists, a side table with a plant
    for (let x = 13; x <= 30; x += 1) b.set(x, U, 21, 'red_carpet')
    for (const [x, z] of [[16, 20], [24, 20], [32, 28]]) b.set(x, FL2 - 1, z, 'lantern[hanging=true]')
    b.set(13, U, 20, 'barrel[facing=up]')
    b.set(13, U + 1, 20, 'potted_fern')
    // landing: railing round the stairwell, a ladder up through a hatch to the attic, linen chest
    for (const z of [24, 25, 26]) b.set(31, U, z, 'spruce_fence')
    for (const x of [32, 33]) b.set(x, U, 27, 'spruce_fence')
    for (let y = U; y <= FL2; y += 1) b.set(33, y, 21, 'ladder[facing=west]')
    b.set(33, U, 29, 'chest[facing=west]')
    b.set(33, U, 30, 'barrel[facing=up]')
    b.set(33, U + 1, 30, 'candle[candles=1,lit=true]')
    // S1 (west): bed head to the gable wall, nightstand, desk under the window, wardrobe, rug
    b.stamp(M.bed('red'), [13, U, 25], { rotate: 3 })
    b.stamp(M.nightstand, [13, U, 24])
    b.stamp(M.desk, [14, U, 29], { rotate: 2 })
    b.stamp(M.wardrobe, [16, U, 27], { rotate: 1 })
    b.set(15, U, 25, 'chest[facing=west]')
    b.box([14, FL1, 26], [15, FL1, 28], 'brown_wool')
    // S2 (the best room, running out into the bay): canopy double bed, window seat in the bay
    b.stamp(M.bed('blue'), [18, U, 25], { rotate: 3 })
    b.stamp(M.bed('blue'), [18, U, 26], { rotate: 3 })
    for (const [x, z] of [[18, 24], [18, 27], [20, 24], [20, 27]]) b.box([x, U, z], [x, U + 1, z], 'dark_oak_fence')
    b.box([18, U + 2, 24], [20, U + 2, 27], 'dark_oak_slab[type=bottom]')
    b.box([18, U + 2, 25], [19, U + 2, 26], 'blue_wool')                        // fabric tester
    b.stamp(M.nightstand, [18, U, 23])
    b.stamp(M.nightstand, [18, U, 28])
    b.set(21, U, 25, 'chest[facing=east]')
    b.box([21, FL1, 27], [23, FL1, 30], (x, y, z) => (x === 21 || x === 23 || z === 27 || z === 30 ? 'blue_wool' : 'brown_wool'))
    b.stamp(M.wardrobe, [24, U, 23], { rotate: 1 })
    for (let x = 19; x <= 23; x += 1) b.set(x, U, 33, 'spruce_stairs[facing=south,half=bottom]')   // window seat
    b.set(21, U, 32, 'dark_oak_fence')
    b.set(21, U + 1, 32, 'dark_oak_pressure_plate')
    for (const x of [19, 23]) b.set(x, U, 31, 'spruce_stairs[facing=north,half=bottom]')
    b.set(24, U, 29, 'barrel[facing=up]')
    b.set(24, U + 1, 29, 'candle[candles=3,lit=true]')
    b.set(21, FL2 - 1, 29, 'lantern[hanging=true]')
    // S3 (east): twin beds sharing a nightstand, desk, wardrobe, runner
    b.stamp(M.bed('red'), [28, U, 24], { rotate: 1 })
    b.stamp(M.bed('red'), [28, U, 27], { rotate: 1 })
    b.stamp(M.nightstand, [29, U, 25])
    b.set(29, U, 26, 'chest[facing=west]')
    b.stamp(M.desk, [26, U, 29], { rotate: 2 })
    b.stamp(M.wardrobe, [26, U, 23], { rotate: 3 })
    b.box([27, FL1, 25], [27, FL1, 28], 'red_wool')

    // ---- innkeeper's room over the kitchen: double bed, strongboxes, ledger desk, books -----
    b.stamp(M.bed('red'), [29, U, 11])
    b.stamp(M.bed('red'), [30, U, 11])
    b.stamp(M.nightstand, [31, U, 11])
    b.set(28, U, 11, 'barrel[facing=up]')
    b.set(28, U + 1, 11, 'potted_red_tulip')
    for (const x of [29, 30]) b.set(x, U, 13, 'chest[facing=south]')
    b.stamp(M.desk, [25, U, 14], { rotate: 3 })
    b.set(25, U, 12, 'lectern[facing=east,has_book=true]')
    b.box([25, U, 11], [25, U + 2, 11], 'bookshelf')
    b.set(25, U + 2, 12, 'bookshelf')
    b.stamp(M.wardrobe, [31, U, 15], { rotate: 1 })
    b.box([27, FL1, 14], [29, FL1, 16], (x, y, z) => (x === 28 && z === 15 ? 'red_wool' : 'brown_wool'))
    b.set(25, U, 18, 'chest[facing=east]')
    b.set(28, FL2 - 1, 15, 'lantern[hanging=true]')

    // ---- attic: storage under the rafters, a stable boy's cot by the west gable --------------
    for (const [x, y, z, id] of [[16, A, 24, 'barrel[facing=up]'], [16, A + 1, 24, 'barrel[facing=up]'], [16, A, 25, 'barrel[facing=up]'], [17, A, 24, 'barrel[facing=north]'],
      [23, A, 23, 'chest[facing=south]'], [27, A, 23, 'hay_block[axis=x]'], [28, A, 23, 'hay_block[axis=x]'], [28, A + 1, 23, 'hay_block[axis=x]'],
      [27, A, 27, 'barrel[facing=up]'], [30, A, 27, 'brown_wool'], [31, A, 27, 'red_wool'], [29, A, 23, 'composter[level=0]'],
      [32, A, 26, 'chest[facing=west]'], [31, A, 24, 'barrel[facing=up]'], [31, A + 1, 24, 'cobweb'], [13, A, 22, 'cobweb'],
      [13, A, 26, 'hay_block[axis=y]'], [14, A, 28, 'candle[candles=1,lit=true]']]) b.set(x, y, z, id)
    b.stamp(M.bed('brown'), [14, A, 26])
    b.set(24, A + 5, 25, 'chain[axis=y]')
    b.set(24, A + 4, 25, 'lantern[hanging=true]')
  }

  // ------------------------------------------------------------------ 12. landscape
  // Order: paved ground and paths -> garden and trees -> scatter. Props and lights come after
  // all of it, because b.path and b.scatter repaint the top block of each column.
  function landscape() {
    const top = (x, z) => ground(x, z)
    const isGrass = (x, z) => b.nameAt(x, top(x, z), z) === 'minecraft:grass_block' && !b.has(x, top(x, z) + 1, z)
    const pave = (x, z, paint) => { if (isGrass(x, z) || /dirt|gravel|cobble/.test(b.nameAt(x, top(x, z), z) ?? '')) b.set(x, top(x, z), z, paint) }
    // The crossroads: two cart roads, slightly wandering. One dominant block (>= 70%) in big
    // clumps; a first try with four equal materials at clump size 2 read as salt-and-pepper.
    const road = kit.palette({ dirt_path: 8, coarse_dirt: 2, gravel: 1 }, { scale: 4, seed: 31 })
    b.path([[3, -1], [2.6, 12], [3.4, 26], [3, 40], [2.6, 46]], { width: 5, paint: road, jitter: 0.5, seed: 1 })
    b.path([[-1, 40], [12, 39.6], [26, 40.4], [40, 40], [52, 39.6]], { width: 5, paint: road, jitter: 0.5, seed: 2 })
    // cobbled forecourt with a ragged edge; a flagged walk from the road to the porch steps
    const cobbles = kit.palette({ cobblestone: 7, andesite: 2, gravel: 1 }, { scale: 3, seed: 5 })
    const flags = kit.palette({ stone_bricks: 5, polished_andesite: 2, cracked_stone_bricks: 1 }, { scale: 2, seed: 4 })
    for (let x = 8; x <= 36; x += 1) for (let z = 31; z <= 38; z += 1) {
      const ragged = Math.abs(x - 22) > 13 + 2.5 * kit.noise.fbm2(x, z, { scale: 4, seed: 9 }) || z > 36 + kit.noise.hash01(x, 0, z, 9) * 2
      if (!ragged) pave(x, z, x >= 18 && x <= 24 && z <= 37 ? flags : cobbles)
    }
    // stable yard: an oval of hard-standing in front of the stable and a cart track to the road
    const yard = kit.palette({ coarse_dirt: 6, gravel: 3, cobblestone: 1 }, { scale: 3.5, seed: 8 })
    for (let x = 36; x <= 51; x += 1) for (let z = 12; z <= 38; z += 1) {
      const oval = ((x - 45) / 6.5) ** 2 + ((z - 23) / 11) ** 2 + 0.25 * kit.noise.fbm2(x, z, { scale: 3, seed: 7 })
      const track = Math.abs(x - 44.5 - 0.6 * Math.sin(z / 3)) < 2 && z > 30
      if ((oval < 1 || track) && !inR(STABLE, x, z)) pave(x, z, yard)
    }
    // transition ring on the garden side: gravel and coarse dirt at the wall base
    const ring = kit.palette({ coarse_dirt: 3, gravel: 2, rooted_dirt: 1 }, { scale: 1.5 })
    for (let x = 6; x <= 34; x += 1) for (let z = 8; z <= 20; z += 1) {
      if (onPad(x, z) || nearPad(x, z)) continue
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dz]) => nearPad(x + dx, z + dz))
      if (near && kit.noise.hash01(x, 1, z, 4) < 0.7) pave(x, z, ring)
    }

    // kitchen garden behind the inn: fenced, gates to the kitchen door and the road side
    const GD = { x0: 6, x1: 22, z0: 2, z1: 17 }
    for (let x = GD.x0; x <= GD.x1; x += 1) for (let z = GD.z0; z <= GD.z1; z += 1) {
      if (x !== GD.x0 && x !== GD.x1 && z !== GD.z0 && z !== GD.z1) continue
      const gate = (x === GD.x1 && z === 16) || (z === GD.z1 && x === 9)
      b.set(x, top(x, z) + 1, z, gate ? `spruce_fence_gate[facing=${x === GD.x1 ? 'east' : 'south'}]` : (x + z) % 6 === 0 ? 'spruce_log[axis=y]' : 'spruce_fence')
    }
    b.path([[24, 16], [20, 16], [16, 15.5], [12, 15], [9, 16], [9, 18]], { width: 1.6, paint: kit.palette({ coarse_dirt: 3, gravel: 2, dirt_path: 2 }, { scale: 1 }), jitter: 0.2, seed: 5 })
    b.path([[11.5, 15], [11.5, 4]], { width: 1.2, paint: kit.palette({ dirt_path: 3, coarse_dirt: 2 }, { scale: 1 }), jitter: 0.1, seed: 6 })
    // raised beds: log kerbs, farmland, ripe crops
    const crops = ['carrots[age=7]', 'wheat[age=7]', 'potatoes[age=7]', 'beetroots[age=3]']
    for (const [x0, x1, z0, z1, i] of [[8, 10, 4, 13, 0], [13, 15, 4, 8, 1], [13, 15, 10, 13, 2], [17, 20, 4, 7, 3]]) {
      for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) {
        const y = top(x, z) + 1
        const kerb = x === x0 || x === x1 || z === z0 || z === z1
        b.set(x, y - 1, z, 'dirt')
        b.set(x, y, z, kerb ? `spruce_log[axis=${z === z0 || z === z1 ? 'x' : 'z'}]` : 'farmland[moisture=7]')
        if (!kerb) b.set(x, y + 1, z, crops[(i + (z > (z0 + z1) / 2 ? 1 : 0)) % 4])
      }
    }
    // herb and berry bed, beehives on a stand, compost, water butt by the kitchen door
    for (let x = 17; x <= 20; x += 1) for (let z = 10; z <= 12; z += 1) {
      b.set(x, top(x, z), z, 'rooted_dirt')
      b.set(x, top(x, z) + 1, z, ['sweet_berry_bush[age=3]', 'poppy', 'fern', 'oxeye_daisy', 'cornflower'][(x * 3 + z) % 5])
    }
    for (const x of [7, 8]) { b.set(x, top(x, 15) + 1, 15, 'spruce_slab[type=top]'); b.set(x, top(x, 15) + 2, 15, 'beehive[facing=east,honey_level=3]') }
    b.set(21, top(21, 3) + 1, 3, 'composter[level=6]')
    b.set(23, top(23, 14) + 1, 14, 'barrel[facing=up]')
    // a small apple standard by the herb bed: short trunk, one round crown (tree presets are too big here)
    const ag = top(20, 15)
    b.box([20, ag + 1, 15], [20, ag + 2, 15], 'oak_log[axis=y]')
    b.leafBlob([20, ag + 4, 15], [2.2, 1.5, 2.2], ['oak_leaves', 'flowering_azalea_leaves'], { seed: 8, holes: 0.12 })
    // woodpile against the chimney, sheltered by its weathering
    for (let z = 22; z <= 26; z += 1) for (let y = top(7, z) + 1; y <= top(7, z) + (z === 22 || z === 26 ? 1 : 2); y += 1) b.set(7, y, z, (y + z) % 3 ? 'oak_log[axis=x]' : 'spruce_log[axis=x]')
    // one shade tree behind the yard and a few bushes at corners, kept off the street front
    b.tree([45, top(45, 8) + 1, 8], 'oak', { seed: 3, height: 7, roots: 2 })
    for (const [x, z, r] of [[36, 8, 1.2], [6, 19, 1.1], [36, 33, 1.0], [50, 34, 1.2]]) b.bush([x, top(x, z) + 1, z], { radius: r, seed: x * 3 + z })
    // grass and flowers last among the landscape: clumped, never on paths or paving
    b.scatter({ density: 0.28, seed: 4, paints: [[12, 'short_grass'], [4, 'tall_grass'], [2, 'fern'], [1, 'poppy'], [1, 'oxeye_daisy'], [1, 'cornflower']] })
  }

  // ------------------------------------------------------------------ 13. props and lights (last)
  function propsAndLights() {
    const top = (x, z) => ground(x, z)
    // The sign: a fence bracket off the corner post toward the crossroads, braced by an
    // upside-down stair, the board hanging below and a lantern at the tip.
    for (let k = 1; k <= 3; k += 1) b.set(UP.x0 - k, FL1 + 3, UP.z1, 'dark_oak_fence')
    b.set(UP.x0 - 1, FL1 + 2, UP.z1, 'dark_oak_stairs[facing=east,half=top]')
    b.set(UP.x0 - 2, FL1 + 2, UP.z1, 'dark_oak_hanging_sign[attached=true,rotation=0]')
    b.set(UP.x0 - 3, FL1 + 2, UP.z1, 'lantern[hanging=true]')
    // porch: built-in benches facing each other, lanterns flanking the door and over the steps
    for (let z = PORCH.z0; z <= PORCH.z1 - 1; z += 1) {
      b.set(PORCH.x0 + 1, FL0 + 1, z, 'spruce_stairs[facing=west,half=bottom]')
      b.set(PORCH.x1 - 1, FL0 + 1, z, 'spruce_stairs[facing=east,half=bottom]')
    }
    for (const x of [DOOR_X - 2, DOOR_X + 2]) b.set(x, FL1 - 1, PORCH.z1 - 1, 'lantern[hanging=true]')
    b.set(DOOR_X, FL1 - 1, PORCH.z1, 'lantern[hanging=true]')
    // goods at the door: casks, hay, potted flowers; a bench against the jettied front
    for (const [x, z, id] of [[15, 32, 'barrel[facing=up]'], [15, 33, 'barrel[facing=up]'], [14, 32, 'barrel[facing=south]'], [27, 32, 'barrel[facing=up]'], [28, 32, 'hay_block[axis=x]']]) b.set(x, top(x, z) + 1, z, id)
    b.set(15, top(15, 32) + 2, 32, 'flower_pot')
    b.set(27, top(27, 32) + 2, 32, 'potted_red_tulip')
    for (let x = 30; x <= 32; x += 1) b.set(x, top(x, 32) + 1, 32, 'spruce_stairs[facing=north,half=bottom]')
    b.set(29, top(29, 32) + 1, 32, 'spruce_trapdoor[facing=west,open=true]')
    b.set(33, top(33, 32) + 1, 32, 'spruce_trapdoor[facing=east,open=true]')
    // horse trough by the road
    for (let x = 9; x <= 11; x += 1) b.set(x, top(x, 35) + 1, 35, 'water_cauldron[level=3]')
    for (const x of [8, 12]) b.set(x, top(x, 35) + 1, 35, 'spruce_fence')
    // lamp posts: crossroads corner, yard entrance, garden gate, stable front
    b.lampPost([7, top(7, 37) + 1, 37], { height: 4, post: 'dark_oak_fence', foot: 'cobblestone_wall', arm: 'east' })
    b.lampPost([41, top(41, 36) + 1, 36], { height: 4, post: 'dark_oak_fence', foot: 'cobblestone_wall', arm: 'west' })
    b.lampPost([10, top(10, 18) + 1, 18], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall' })
    b.lampPost([43, top(43, 25) + 1, 25], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall' })
    // a signpost at the crossroads
    for (let y = 1; y <= 3; y += 1) b.set(6, top(6, 43) + y, 43, 'spruce_fence')
    b.set(5, top(6, 43) + 3, 43, 'spruce_wall_sign[facing=west]')
    b.set(6, top(6, 43) + 2, 42, 'spruce_wall_sign[facing=north]')

    // stable: stall rails, hay mangers with trapdoor fronts, water, tack chest, lanterns
    for (const z of [22, 26]) for (let x = STABLE.x0; x <= STABLE.x0 + 3; x += 1) b.set(x, 7, z, 'spruce_fence')
    for (const z of [20, 24, 28]) {
      b.set(STABLE.x0, 7, z, 'hay_block[axis=z]')
      b.set(STABLE.x0, 7, z + 1, 'water_cauldron[level=3]')
      b.set(STABLE.x0 + 1, 7, z, 'spruce_trapdoor[facing=east,half=bottom,open=true]')
    }
    for (const [x, y, z, id] of [[STABLE.x0, 7, 19, 'chest[facing=east]'], [STABLE.x0, 8, 19, 'brown_carpet'], [STABLE.x0 + 2, 7, 29, 'hay_block[axis=x]'],
      [STABLE.x0 + 3, 7, 29, 'hay_block[axis=z]'], [STABLE.x0 + 2, 8, 29, 'hay_block[axis=x]'], [STABLE.x1, 8, 24, 'lantern[hanging=true]'], [37, 11, 24, 'lantern[hanging=true]']]) b.set(x, y, z, id)
    // stable yard: a roofed well (authored as a module), the hay wagon, trough and hitching rail
    const well = b.module([5, 6, 5])
    for (let x = 1; x <= 3; x += 1) for (let z = 1; z <= 3; z += 1) {
      const rim = x !== 2 || z !== 2
      well.set(x, 0, z, rim ? 'cobblestone' : 'water')
      if (rim) well.set(x, 1, z, x === 2 || z === 2 ? 'cobblestone_wall' : 'mossy_cobblestone_wall')
    }
    for (const x of [1, 3]) for (let y = 2; y <= 3; y += 1) well.set(x, y, 2, 'spruce_fence')
    well.set(2, 3, 2, 'spruce_fence')
    well.set(2, 2, 2, 'chain[axis=y]')
    for (let x = 0; x <= 4; x += 1) {
      well.set(x, 4, 1, 'spruce_stairs[facing=south,half=bottom]')
      well.set(x, 4, 3, 'spruce_stairs[facing=north,half=bottom]')
      well.set(x, 4, 2, 'spruce_planks')
      well.set(x, 5, 2, 'spruce_slab[type=bottom]')
    }
    b.stamp(well, [45, top(47, 18), 16])
    b.set(47, top(47, 18) - 1, 18, 'water')
    b.set(48, top(48, 21) + 1, 21, 'water_cauldron[level=2]')
    // the hay wagon: slab bed on grindstone wheels, trapdoor side boards, shafts to the ground
    const cx = 44, cz = 27, cy = top(45, 29) + 1
    for (let z = cz; z <= cz + 3; z += 1) {
      for (let x = cx; x <= cx + 2; x += 1) b.set(x, cy, z, 'spruce_slab[type=top]')
      const wheel = z === cz || z === cz + 3
      b.set(cx - 1, cy, z, wheel ? 'grindstone[face=wall,facing=west]' : 'spruce_trapdoor[facing=west,open=true]')
      b.set(cx + 3, cy, z, wheel ? 'grindstone[face=wall,facing=east]' : 'spruce_trapdoor[facing=east,open=true]')
    }
    for (const [x, z, id] of [[cx, cz + 1, 'hay_block[axis=z]'], [cx + 1, cz + 1, 'hay_block[axis=z]'], [cx + 1, cz + 2, 'hay_block[axis=z]'],
      [cx + 2, cz + 2, 'barrel[facing=south]'], [cx, cz + 3, 'barrel[facing=up]']]) b.set(x, cy + 1, z, id)
    for (const z of [cz + 4, cz + 5]) b.set(cx + 1, cy, z, 'spruce_fence')
    for (let z = 19; z <= 23; z += 1) b.set(43, top(43, z) + 1, z, z === 19 || z === 23 ? 'spruce_log[axis=y]' : 'spruce_fence')
    for (let z = 20; z <= 22; z += 1) b.set(44, top(44, z) + 1, z, 'water_cauldron[level=3]')
    // hay stack in the yard corner; casks and compost by the kitchen's yard door
    for (const [x, z, h] of [[49, 11, 2], [50, 11, 1], [49, 12, 1], [50, 12, 2], [48, 11, 1]]) for (let k = 1; k <= h; k += 1) b.set(x, top(x, z) + k, z, 'hay_block[axis=y]')
    for (const [x, z, id] of [[33, 11, 'barrel[facing=up]'], [34, 11, 'barrel[facing=east]'], [33, 10, 'barrel[facing=up]'], [34, 12, 'composter[level=3]']]) b.set(x, top(x, z) + 1, z, id)
    b.set(33, top(33, 11) + 2, 11, 'barrel[facing=north]')
    // door lights on fence stubs: both kitchen doors, the street corners under the jetty
    for (const [x, z] of [[WING.x1 + 1, 12], [WING.x0 - 1, 15]]) { b.set(x, FL1 - 1, z, 'spruce_fence'); b.set(x, FL1 - 2, z, 'lantern[hanging=true]') }
    for (const x of [13, 33]) { b.set(x, FL1, UP.z1 + 1, 'dark_oak_fence'); b.set(x, FL1 - 1, UP.z1 + 1, 'lantern[hanging=true]') }
    // lanterns hung straight from the jetty beam between the corbels light the street front
    for (const x of [15, 27, 31]) b.set(x, FL1 - 1, UP.z1, 'lantern[hanging=true]')
    // lit dormers and a lit gable window make the roof read at night
    for (const [x, z] of [[30, UP.z1 - 1], [16, UP.z0 + 2]]) {
      for (let y = 25; y > 21; y -= 1) if (b.has(x, y, z)) { b.set(x, y - 1, z, 'lantern[hanging=true]'); break }
    }
    b.set(20, ROOF_Y, BAY.z1, 'barrel[facing=up]')
    b.set(20, ROOF_Y + 1, BAY.z1, 'lantern[hanging=false]')
  }
}
