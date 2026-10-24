// THE PRANCING PONY — WIP structure pass
export default function build(api) {
  const { kit } = api
  const STAGES = ['massing', 'structure', 'texture', 'interior', 'landscape', 'final']
  const stage = STAGES.indexOf(process.env.STAGE ?? 'final')
  const at = s => stage >= STAGES.indexOf(s)

  const b = api.builder([52, 38, 46], { seed: 23 })

  // ------------------------------------------------------------------ levels and plan
  const FL0 = 7       // ground-floor deck (taproom floor); rooms are y 8..11 (4 clear)
  const FL1 = 12      // first-floor deck; guest rooms y 13..15 (3 clear)
  const FL2 = 16      // attic deck
  const PLATE = 17    // wall plate (1-high knee wall in the attic)
  const ROOF_Y = 18   // roof row directly above the wall line
  const MAIN = { x0: 12, x1: 34, z0: 19, z1: 30 }       // ground-floor outer walls
  const UP = { x0: 12, x1: 34, z0: 19, z1: 31 }         // upper floor, jettied 1 over the street
  const BAY = { x0: 17, x1: 25, z0: 31, z1: 34 }        // cross-gabled bay over the porch
  const WING = { x0: 24, x1: 32, z0: 10, z1: 19 }       // rear kitchen wing (shares the z=19 wall)
  const STABLE = { x0: 35, x1: 41, z0: 18, z1: 30 }     // lean-to stable on the east gable
  const CH = { x0: 8, x1: 11, z0: 21, z1: 27 }          // west chimney stack (base)
  const DOOR_X = 21
  const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

  // placeholders, one per surface role (textured later with b.texture)
  const STONE = 'white_wool'
  const PLINTH = 'light_gray_wool'
  const DAUB = 'yellow_wool'
  const CHIM = 'gray_wool'
  const ROOF = 'deepslate_tile'
  const FRAME = 'dark_oak_log'
  const beam = ax => `${FRAME}[axis=${ax}]`
  const POST = beam('y')

  // ------------------------------------------------------------------ 1. site
  const ground = b.terrain({
    height: (x, z) => 5.4 + 1.1 * ((22 - z) / 22) + 0.4 * ((26 - x) / 26) + 0.6 * kit.noise.fbm2(x, z, { scale: 22, seed: 4 }),
    layers: [{ depth: 1, paint: 'grass_block' }, { depth: 3, paint: 'dirt' }, { paint: 'stone' }],
  })

  // ------------------------------------------------------------------ 2. foundations
  const PORCH = { x0: 17, x1: 25, z0: 31, z1: 34 }
  const onPad = (x, z) => inR(MAIN, x, z) || inR(WING, x, z) || inR(CH, x, z) || inR(PORCH, x, z)
  const nearPad = (x, z) => !onPad(x, z) && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dz]) => onPad(x + dx, z + dz))
  for (let x = 0; x < 52; x += 1) for (let z = 0; z < 46; z += 1) {
    const g = ground(x, z)
    if (onPad(x, z)) {
      for (let y = Math.min(g, FL0) - 2; y <= FL0; y += 1) b.set(x, y, z, PLINTH)
    } else if (nearPad(x, z) && !inR(STABLE, x, z)) {
      // the water table: foundation one block wider, topped with a sloped stair course
      for (let y = Math.min(g, FL0 - 1) - 1; y <= FL0 - 1; y += 1) b.set(x, y, z, PLINTH)
      const n = [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]].find(([, dx, dz]) => onPad(x + dx, z + dz))
      if (n) b.set(x, FL0, z, `stone_brick_stairs[facing=${n[0]},half=bottom]`)
    }
  }

  // ------------------------------------------------------------------ 3. ground floor (stone)
  // street fronts (south, west) are 2 thick: deep window reveals and a recessed door
  const stoneWall = (x0, z0, x1, z1) => b.box([x0, FL0, z0], [x1, FL1 - 1, z1], STONE)
  stoneWall(MAIN.x0, MAIN.z1 - 1, MAIN.x1, MAIN.z1)   // south, 2 thick
  stoneWall(MAIN.x0, MAIN.z0, MAIN.x0 + 1, MAIN.z1)   // west, 2 thick
  stoneWall(MAIN.x0, MAIN.z0, MAIN.x1, MAIN.z0)       // north
  stoneWall(MAIN.x1, MAIN.z0, MAIN.x1, MAIN.z1)       // east
  stoneWall(WING.x0, WING.z0, WING.x1, WING.z0)
  stoneWall(WING.x0, WING.z0, WING.x0, WING.z1)
  stoneWall(WING.x1, WING.z0, WING.x1, WING.z1)

  // floors
  b.box([MAIN.x0 + 2, FL0, MAIN.z0 + 1], [MAIN.x1 - 1, FL0, MAIN.z1 - 2], 'spruce_planks')
  b.box([WING.x0 + 1, FL0, WING.z0 + 1], [WING.x1 - 1, FL0, WING.z1 - 1], 'spruce_planks')
  b.box([UP.x0, FL1, UP.z0], [UP.x1, FL1, UP.z1], 'spruce_planks')
  b.box([BAY.x0, FL1, BAY.z0], [BAY.x1, FL1, BAY.z1], 'spruce_planks')
  b.box([WING.x0, FL1, WING.z0], [WING.x1, FL1, WING.z1], 'spruce_planks')
  b.box([UP.x0, FL2, UP.z0], [UP.x1, FL2, UP.z1], 'spruce_planks')
  b.box([BAY.x0, FL2, BAY.z0], [BAY.x1, FL2, BAY.z1], 'spruce_planks')
  b.box([WING.x0, FL2, WING.z0], [WING.x1, FL2, WING.z1], 'spruce_planks')

  // ------------------------------------------------------------------ 4. jetty + timber upper floor
  // Timber elevation painter: posts (vertical logs), rails (horizontal logs), plaster infill.
  function timber({ along, at: w, u0, u1, y0, y1, posts, rails = [y0, y1], braces = [] }) {
    for (let u = u0; u <= u1; u += 1) for (let y = y0; y <= y1; y += 1) {
      const p = along === 'x' ? [u, y, w] : [w, y, u]
      let paint = DAUB
      if (rails.includes(y)) paint = beam(along)
      else if (posts.includes(u)) paint = POST
      b.set(...p, paint)
    }
    for (const [ua, ya, ub, yb] of braces) {
      const n = Math.max(Math.abs(ub - ua), Math.abs(yb - ya))
      for (let i = 0; i <= n; i += 1) {
        const u = Math.round(ua + ((ub - ua) * i) / n)
        const y = Math.round(ya + ((yb - ya) * i) / n)
        b.set(...(along === 'x' ? [u, y, w] : [w, y, u]), 'dark_oak_wood')
      }
    }
  }
  const range = (a, c, s) => Array.from({ length: Math.floor((c - a) / s) + 1 }, (_, i) => a + i * s)
  // street front: close studding (posts every 2) reads as a prosperous Tudor front
  timber({ along: 'x', at: UP.z1, u0: UP.x0, u1: BAY.x0 - 1, y0: FL1, y1: PLATE, posts: range(12, 16, 2) })
  timber({ along: 'x', at: UP.z1, u0: BAY.x1 + 1, u1: UP.x1, y0: FL1, y1: PLATE, posts: range(26, 34, 2) })
  // bay: side walls and the street gable
  timber({ along: 'z', at: BAY.x0, u0: BAY.z0, u1: BAY.z1, y0: FL1, y1: PLATE, posts: [31, 34] })
  timber({ along: 'z', at: BAY.x1, u0: BAY.z0, u1: BAY.z1, y0: FL1, y1: PLATE, posts: [31, 34] })
  timber({ along: 'x', at: BAY.z1, u0: BAY.x0, u1: BAY.x1, y0: FL1, y1: PLATE, posts: range(17, 25, 2) })
  // gable ends and back: square panels (posts every 4), braces in the end panels
  timber({ along: 'z', at: UP.x0, u0: UP.z0, u1: UP.z1, y0: FL1, y1: PLATE, posts: [19, 23, 27, 31] })
  timber({ along: 'z', at: UP.x1, u0: UP.z0, u1: UP.z1, y0: FL1, y1: PLATE, posts: [19, 23, 27, 31],
    braces: [[20, 13, 22, 16], [30, 13, 28, 16]] })
  timber({ along: 'x', at: UP.z0, u0: UP.x0, u1: WING.x0, y0: FL1, y1: PLATE, posts: [12, 16, 20, 24] })
  timber({ along: 'x', at: UP.z0, u0: WING.x1, u1: UP.x1, y0: FL1, y1: PLATE, posts: [32, 34] })
  // wing upper floor
  timber({ along: 'z', at: WING.x0, u0: WING.z0, u1: WING.z1, y0: FL1, y1: PLATE, posts: [10, 14, 19], braces: [[11, 13, 13, 16]] })
  timber({ along: 'z', at: WING.x1, u0: WING.z0, u1: WING.z1, y0: FL1, y1: PLATE, posts: [10, 14, 19], braces: [[11, 13, 13, 16]] })
  timber({ along: 'x', at: WING.z0, u0: WING.x0, u1: WING.x1, y0: FL1, y1: PLATE, posts: [24, 26, 30, 32] })
  // jetty corbels: an upside-down stair under every street-front post, back against the stone
  for (let x = UP.x0; x <= UP.x1; x += 2) if (x < BAY.x0 || x > BAY.x1) b.set(x, FL1 - 1, UP.z1, 'dark_oak_stairs[facing=north,half=top]')

  // ------------------------------------------------------------------ 5. porch under the bay
  b.clear([PORCH.x0, FL0 + 1, PORCH.z0], [PORCH.x1, FL1 - 1, PORCH.z1])
  for (const x of [PORCH.x0, PORCH.x1]) b.box([x, FL0 + 1, PORCH.z1], [x, FL1 - 1, PORCH.z1], POST)
  b.box([PORCH.x0, FL1, PORCH.z1], [PORCH.x1, FL1, PORCH.z1], beam('x'))
  for (const z of [PORCH.z0, PORCH.z1]) for (const x of [PORCH.x0, PORCH.x1]) b.set(x, FL1, z, POST)

  // ------------------------------------------------------------------ 6. roofs
  // Secondary roofs are built on a scratch canvas and merged column by column: wherever the
  // new roof is higher than what is already there it wins (and clears the old roof inside its
  // own attic), elsewhere the old roof stays. That gives clean valleys where roofs meet.
  function mergeRoof(opts, { floorY = ROOF_Y, keepCell = () => true } = {}) {
    const tmp = b.module(b.size)
    const r = tmp.roof(opts)
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
    return r
  }
  const studGable = (u, every) => (u % every === 0 ? POST : DAUB)
  const mainRoof = b.roof({ x0: UP.x0, z0: UP.z0, x1: UP.x1, z1: UP.z1, y: ROOF_Y, axis: 'x', material: ROOF, pitch: [1, 1, 1, 1, 2],
    eaveTrim: true, gable: (x, y, z) => (y === 21 || y === 24 ? beam('z') : (z - 1) % 4 === 0 ? POST : DAUB) })
  // the bay's eave rows would land inside the bay walls: clear them first
  b.clear([BAY.x0 - 1, FL2 - 1, UP.z1 + 1], [BAY.x1 + 1, ROOF_Y, UP.z1 + 1])
  mergeRoof({ x0: BAY.x0, z0: 25, x1: BAY.x1, z1: BAY.z1, y: ROOF_Y, axis: 'z', material: ROOF, pitch: [1, 1, 2], eaveTrim: true,
    gable: (x, y, z) => (z !== BAY.z1 ? null : y === 22 ? beam('x') : studGable(x - 1, 2)) }, { floorY: FL2 + 1 })
  mergeRoof({ x0: WING.x0, z0: WING.z0, x1: WING.x1, z1: 22, y: ROOF_Y, axis: 'z', material: ROOF, pitch: [1, 1, 1, 1, 2], eaveTrim: true,
    gable: (x, y, z) => (z !== WING.z0 ? null : y === 21 ? beam('x') : studGable(x, 4)) })
  // stable lean-to: a shed roof climbing toward the main gable wall
  mergeRoof({ x0: STABLE.x0, z0: STABLE.z0, x1: STABLE.x1, z1: STABLE.z1, y: 10, type: 'shed', rises: 'west', material: 'spruce', pitch: 0.5, eaveTrim: true },
    { floorY: 9, keepCell: x => x > UP.x1 })
  // dormers either side of the bay, lighting the attic
  for (const cx of [14, 28]) b.dormer([cx, ROOF_Y, UP.z1], 'south', { width: 3, height: 3, material: ROOF, wall: DAUB, window: { width: 1, height: 2 } })

  // ------------------------------------------------------------------ 7. chimneys
  // West stack: a broad breast that steps in twice (sloped stair weatherings on each setback)
  // and ends 3 above the ridge in a corbelled cap with two brick pots.
  for (let x = CH.x0; x <= CH.x1; x += 1) for (let z = CH.z0; z <= CH.z1; z += 1) b.box([x, ground(x, z) - 2, z], [x, 12, z], CHIM)
  b.box([CH.x0, 13, CH.z0 + 1], [CH.x1, 16, CH.z1 - 1], CHIM)
  b.box([CH.x0, 17, 23], [CH.x0 + 2, 29, 25], CHIM)
  for (let z = CH.z0; z <= CH.z1; z += 1) b.set(CH.x0 - 1, 12, z, 'stone_brick_stairs[facing=east,half=bottom]')
  for (const [z, f] of [[CH.z0, 'south'], [CH.z1, 'north']]) for (let x = CH.x0; x <= CH.x1; x += 1) b.set(x, 13, z, `stone_brick_stairs[facing=${f},half=bottom]`)
  for (let z = CH.z0 + 1; z <= CH.z1 - 1; z += 1) b.set(CH.x0 - 1, 16, z, 'stone_brick_stairs[facing=east,half=bottom]')
  for (const [z, f] of [[22, 'south'], [26, 'north']]) for (let x = CH.x0; x <= CH.x0 + 2; x += 1) b.set(x, 17, z, `stone_brick_stairs[facing=${f},half=bottom]`)
  // oversailing cap course, brick crown, pots
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
  // kitchen stack on the wing's north gable (cooking range behind it)
  for (let x = 27; x <= 29; x += 1) for (let z = 8; z <= 9; z += 1) b.box([x, ground(x, z) - 2, z], [x, 11, z], CHIM)
  for (const x of [27, 29]) b.set(x, 12, 8, `stone_brick_stairs[facing=south,half=bottom]`)
  b.box([28, 12, 8], [29, 26, 9], CHIM)
  b.set(27, 12, 9, 'stone_brick_stairs[facing=east,half=bottom]')
  b.box([28, 27, 8], [29, 27, 9], 'bricks')
  b.set(28, 27, 9, 'campfire[lit=true,signal_fire=false,facing=north]')
  b.set(29, 28, 8, 'brick_wall')

  // ------------------------------------------------------------------ 8. doors and windows
  // front door: recessed in the 2-thick wall behind a chamfered stone opening
  b.clear([DOOR_X - 1, FL0 + 1, MAIN.z1], [DOOR_X + 1, FL0 + 2, MAIN.z1])
  b.set(DOOR_X, FL0 + 3, MAIN.z1, 'air')
  b.set(DOOR_X - 1, FL0 + 3, MAIN.z1, 'stone_brick_stairs[facing=west,half=top]')
  b.set(DOOR_X + 1, FL0 + 3, MAIN.z1, 'stone_brick_stairs[facing=east,half=top]')
  b.door([DOOR_X, FL0 + 1, MAIN.z1 - 1], 'south', { material: 'dark_oak' })
  b.set(DOOR_X, FL0 + 3, MAIN.z1 - 1, beam('x'))
  for (const x of [DOOR_X - 1, DOOR_X + 1]) b.box([x, FL0 + 1, MAIN.z1 - 1], [x, FL0 + 3, MAIN.z1 - 1], POST)
  const SILL_STONE = 'stone_brick_stairs[facing=north,half=top]'
  // ground floor, street front: 2x2 windows recessed into the thick wall
  for (const x of [14, 28, 32]) b.window([x, FL0 + 2, MAIN.z1], 'south', { width: 2, height: 2, recess: 1, sill: SILL_STONE, shutters: true, material: 'spruce' })
  for (const x of [18, 23]) b.window([x, FL0 + 2, MAIN.z1], 'south', { width: 2, height: 2, recess: 1, sill: SILL_STONE, material: 'spruce' })
  // north side (1 thick)
  for (const x of [14, 18]) b.window([x, FL0 + 2, MAIN.z0], 'north', { width: 2, height: 2, sill: 'stone_brick_stairs[facing=south,half=top]', shutters: true })
  b.window([WING.x0, FL0 + 2, 12], 'west', { width: 2, height: 2, sill: 'stone_brick_stairs[facing=east,half=top]', shutters: true })
  b.window([WING.x1, FL0 + 2, 17], 'east', { width: 2, height: 2, sill: 'stone_brick_stairs[facing=west,half=top]', shutters: true })
  b.door([WING.x0, FL0 + 1, 16], 'west', { material: 'spruce', frame: 'stripped_spruce_log' })
  b.door([WING.x1, FL0 + 1, 13], 'east', { material: 'spruce', frame: 'stripped_spruce_log' })
  // upper floor: leaded lancets between the close studs, no sills (the jetty beam is the line)
  for (const x of [13, 15, 27, 29, 31, 33]) b.window([x, FL1 + 2, UP.z1], 'south', { width: 1, height: 2, sill: false })
  for (const x of [20, 22]) b.window([x, FL1 + 2, BAY.z1], 'south', { width: 1, height: 2, sill: false })
  // one long flower box under the bay's two lights (soil boxed in by open trapdoors)
  for (let x = 19; x <= 23; x += 1) {
    b.set(x, FL1 + 1, BAY.z1 + 1, 'rooted_dirt')
    b.set(x, FL1 + 1, BAY.z1 + 2, 'spruce_trapdoor[facing=south,open=true,half=bottom]')
    b.set(x, FL1 + 2, BAY.z1 + 1, ['poppy', 'cornflower', 'oxeye_daisy', 'allium', 'azure_bluet'][x - 19])
  }
  b.set(18, FL1 + 1, BAY.z1 + 1, 'spruce_trapdoor[facing=west,open=true,half=bottom]')
  b.set(24, FL1 + 1, BAY.z1 + 1, 'spruce_trapdoor[facing=east,open=true,half=bottom]')
  b.set(19, FL1, BAY.z1 + 1, 'dark_oak_stairs[facing=north,half=top]')
  b.set(23, FL1, BAY.z1 + 1, 'dark_oak_stairs[facing=north,half=top]')
  for (const x of [20, 22]) b.window([x, 19, BAY.z1], 'south', { width: 1, height: 2, sill: false })
  for (const x of [14, 18, 22]) b.window([x, FL1 + 2, UP.z0], 'north', { width: 1, height: 2, sill: false })
  for (const z of [20, 29]) b.window([UP.x0, FL1 + 2, z], 'west', { width: 1, height: 2, sill: false })
  b.window([UP.x1, FL1 + 2, 25], 'east', { width: 1, height: 2, sill: false })
  b.window([UP.x1, 19, 24], 'east', { width: 3, height: 2, sill: false, mullion: POST })
  for (const z of [16, 17]) for (const x of [WING.x0, WING.x1]) b.window([x, FL1 + 2, z], x === WING.x0 ? 'west' : 'east', { width: 1, height: 2, sill: false })

  // ------------------------------------------------------------------ 9. porch and stable carpentry
  b.box([PORCH.x0, FL0, PORCH.z0], [PORCH.x1, FL0, PORCH.z1], PLINTH)
  for (let x = PORCH.x0 + 1; x <= PORCH.x1 - 1; x += 1) b.set(x, FL0, PORCH.z1 + 1, 'stone_brick_stairs[facing=north,half=bottom]')
  // knee braces between the porch posts and the bay's sill beams
  b.set(PORCH.x0 + 1, FL1 - 1, PORCH.z1, 'dark_oak_stairs[facing=west,half=top]')
  b.set(PORCH.x1 - 1, FL1 - 1, PORCH.z1, 'dark_oak_stairs[facing=east,half=top]')
  for (const x of [PORCH.x0, PORCH.x1]) {
    b.set(x, FL1 - 1, PORCH.z1 - 1, 'dark_oak_stairs[facing=south,half=top]')
    b.set(x, FL1 - 1, PORCH.z0, 'dark_oak_stairs[facing=north,half=top]')
  }
  // stable: posts on the yard side, boarded ends, earth floor
  const shedUnder = (x, z) => { for (let y = 9; y < 20; y += 1) if (b.has(x, y, z) && /spruce/.test(b.nameAt(x, y, z))) return y; return 10 }
  for (let x = STABLE.x0; x <= STABLE.x1; x += 1) for (let z = STABLE.z0; z <= STABLE.z1; z += 1) {
    for (let y = ground(x, z) - 1; y <= 5; y += 1) b.set(x, y, z, 'dirt')
    b.set(x, 6, z, 'coarse_dirt')
  }
  for (const z of [STABLE.z0, STABLE.z1]) for (let x = STABLE.x0; x <= STABLE.x1; x += 1) {
    const top = shedUnder(x, z)
    for (let y = 6; y < top; y += 1) b.set(x, y, z, x === STABLE.x1 ? POST : y === 6 ? PLINTH : 'stripped_spruce_log[axis=y]')
  }
  for (const z of [22, 26]) b.box([STABLE.x1, 6, z], [STABLE.x1, 9, z], POST)
  for (let z = STABLE.z0; z <= STABLE.z1; z += 1) b.set(STABLE.x1, 9, z, z === STABLE.z0 || z === STABLE.z1 || z === 22 || z === 26 ? POST : beam('z'))

  // ------------------------------------------------------------------ 10. texture (one call per surface role)
  if (at('texture')) {
    const stoneRamp = ['andesite', 'cobblestone', 'stone_bricks', 'tuff', 'tuff_bricks']
    b.texture([MAIN.x0, FL0, WING.z0], [MAIN.x1, FL1 - 1, MAIN.z1], stoneRamp, { only: STONE, focus: [[DOOR_X, FL0 + 2, MAIN.z1]], seed: 3 })
    b.texture([0, 0, 0], [51, FL0, 45], ['tuff_bricks', 'cobbled_deepslate', 'deepslate_bricks', 'deepslate_tiles'], { only: PLINTH, base: 0.35, seed: 5 })
    b.texture([0, FL1, 0], [51, 30, 45], ['calcite', 'smooth_sandstone', 'sandstone'], { only: DAUB, base: 0.2, drip: 0.15, noise: 0.18, seed: 7 })
    b.texture([0, 0, 0], [51, 31, 45], ['cobblestone', 'stone_bricks', 'tuff', 'tuff_bricks', 'cobbled_deepslate'], { only: CHIM, base: 0.25, top: -0.35, seed: 9 })
    b.texture([0, FL2 - 1, 0], [51, 30, 45], ['cobbled_deepslate', 'polished_deepslate', 'deepslate_bricks', 'deepslate_tiles'],
      { only: n => /deepslate/.test(n.name), base: 0.45, top: 0.2, edge: 0.1, noise: 0.16, seed: 11 })
    // age: moss and cracks low on the walls and on the shaded north side only
    b.weather([0, 0, 0], [51, FL0 + 1, 45], { share: 0.2, mossBias: 0.7, seed: 2 })
    b.weather([0, FL0, 0], [51, FL1, MAIN.z0], { share: 0.12, mossBias: 0.8, seed: 3 })
  }

  return b.finish({ name: 'tavern' })
}
