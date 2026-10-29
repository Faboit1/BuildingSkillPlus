// THE TOWN: STREETS LINED WITH HOUSES. Read this, look at img/town.png, then lay out your own: the
// streets of this spawn, their width and curve, the houses of the theme. A spawn's town is what the
// districts are made of; a few houses standing apart on a lawn is not a town.
//
// DO
// - Streets first: 5-9 wide, leaving the plaza toward the gates and curving with the land (never
//   ruled straight for long), paved in a clumped mix with a kerb, widening into a square where they
//   meet. Then the lots along them (kit.plan.lotsAlongRoad), then a building on every lot.
// - Shoulder to shoulder: houses 0-2 blocks apart along the street, their fronts on the street
//   line, a back yard behind each (a fence or hedge, a vegetable plot, a shed, barrels).
// - Every house its own: 5-11 wide, 2-3 storeys, the gable or the eaves to the street, upper
//   storeys jettied out over the street, a stone ground storey and timber-framed plaster above,
//   its own roof material and pitch, a chimney, windows with shutters and flower boxes, a door with
//   a step; shops on the ground floor near the plaza (a wide opening, an awning, a counter).
// - Neighbours differ in height, width, front and colour; a feature building (§5.14) at each
//   square and corner; alleys of 1-2 blocks between some houses.
// DON'T
// - Houses standing apart on a lawn, 10-40 blocks between them, with no street they front on.
// - The same house again and again, in a row at equal steps along a ruled path.
// - A 1-3 wide dirt line as the street, or streets that are straight lines from end to end.

import { local } from '../../../assets/frame/frame.mjs'

const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' }

// The looks of the houses of a district: the town picks one per house, never the same as its
// neighbour's. base: the ground storey (a palette), upper: the plaster, frame: the timber, roof:
// a family with stairs and slabs, trim: the stone of the sills and the plinth.
export const LOOKS = [
  { base: { stone_bricks: 5, cobblestone: 2, andesite: 2, mossy_stone_bricks: 1 }, upper: { calcite: 5, white_terracotta: 2, white_concrete_powder: 1 }, frame: 'dark_oak', roof: 'deepslate_tile', trim: 'stone_brick' },
  { base: { bricks: 6, granite: 1, terracotta: 1 }, upper: { smooth_sandstone: 3, birch_planks: 2, calcite: 1 }, frame: 'spruce', roof: 'dark_oak', trim: 'brick' },
  { base: { cobblestone: 4, stone: 2, andesite: 2, mossy_cobblestone: 1 }, upper: { stripped_birch_wood: 3, calcite: 2, white_terracotta: 1 }, frame: 'spruce', roof: 'spruce', trim: 'cobblestone' },
  { base: { mud_bricks: 5, packed_mud: 2, bricks: 1 }, upper: { white_terracotta: 3, calcite: 2, smooth_quartz: 1 }, frame: 'dark_oak', roof: 'mud_brick', trim: 'mud_brick' },
  { base: { tuff_bricks: 4, polished_tuff: 2, tuff: 2 }, upper: { calcite: 4, light_gray_concrete_powder: 1, white_terracotta: 1 }, frame: 'dark_oak', roof: 'deepslate_tile', trim: 'tuff_brick' },
  { base: { stone_bricks: 4, andesite: 2, cracked_stone_bricks: 1 }, upper: { stripped_oak_wood: 3, oak_planks: 2, smooth_sandstone: 1 }, frame: 'dark_oak', roof: 'brick', trim: 'stone_brick' },
]

// A street: a smooth path through [[x, z], ...], `width` wide, paved on the ground with a clumped
// mix and a kerb. ground(x, z) is the land's top block. Returns { path, cells, width } (path:
// dense [[x, z]], cells: a Set of 'x,z' the street covers) for lotsAlongRoad and for avoid tests.
export function street(ctx, points, { width = 7, ground, paving = { stone_bricks: 4, andesite: 3, cobblestone: 2, polished_andesite: 2, gravel: 1 }, kerb = 'polished_andesite', seed = 1 } = {}) {
  const { b, kit } = ctx
  const p = kit.land.smoothPath(points, 1)
  const half = width / 2
  const pave = kit.palette(paving, { scale: 2.5, seed })
  const cells = new Set()
  const kerbCells = new Set()
  const gy = ground ?? ((x, z) => b.groundY(x, z))
  for (const [px, pz] of p.points)
    for (let dz = -Math.ceil(half + 1); dz <= Math.ceil(half + 1); dz += 1)
      for (let dx = -Math.ceil(half + 1); dx <= Math.ceil(half + 1); dx += 1) {
        const x = Math.round(px + dx)
        const z = Math.round(pz + dz)
        const d = Math.hypot(x - px, z - pz)
        if (d <= half) cells.add(`${x},${z}`)
        else if (d <= half + 1) kerbCells.add(`${x},${z}`)
      }
  for (const k of cells) kerbCells.delete(k)
  for (const k of cells) {
    const [x, z] = k.split(',').map(Number)
    const y = gy(x, z)
    if (y < 0) continue
    b.set(x, y, z, pave)
    for (let h = 1; h <= 3; h += 1) if (/grass|fern|flower|tulip|daisy|poppy|dandelion/.test(b.nameAt(x, y + h, z) ?? '')) b.remove(x, y + h, z)
  }
  for (const k of kerbCells) {
    const [x, z] = k.split(',').map(Number)
    const y = gy(x, z)
    if (y >= 0) b.set(x, y, z, `minecraft:${kerb}`)
  }
  return { path: p.points, cells, width }
}

// One town house on a lot. pos = the ground block under the middle of its front wall, facing =
// toward the street. width along the street, depth away from it (the house takes `deep` of it,
// the rest is the back yard).
//   storeys 1-3 (4 high each), front 'gable' | 'eaves', jetty (upper storeys 1 out over the street),
//   look (one of LOOKS or your own), shop (a ground-floor shop with an awning), seed
export function townHouse(ctx, pos, facing, { width = 7, depth = 11, deep, storeys = 2, front = 'gable', jetty = true, look = LOOKS[0], shop = false, awning = 'yellow', seed = 1, yard = true, ground } = {}) {
  const { b, kit } = ctx
  const rng = kit.rng(seed * 7919 + 13)
  const L = local(pos, facing)
  const W = Math.max(5, width)
  const D = Math.max(6, deep ?? Math.min(depth - 3, Math.round(depth * 0.7)))
  const uL = -Math.floor((W - 1) / 2)
  const uR = uL + W - 1
  const set = (u, d, h, blk, o) => b.set(...L.at(u, d, h), blk, o)
  // the ground under a column; b.groundY gives -1 where something is built over the ground, so
  // fall back to the house's own level there instead of sinking the plinth to the canvas floor
  const gy0 = ground ?? ((x, z) => b.groundY(x, z))
  const gy = (x, z) => {
    const g = gy0(x, z)
    return g >= 0 ? g : pos[1]
  }
  const base = kit.palette(look.base, { scale: 2.5, seed })
  const upper = kit.palette(look.upper, { scale: 3, seed: seed + 1 })
  const F = look.frame
  const log = axis => `minecraft:${F}_log[axis=${axis}]`
  const trim = kit.material(look.trim)
  const STOREY = 4
  const top = storeys * STOREY // the wall top, above pos
  const jet = jetty && storeys > 1 ? 1 : 0
  // 1. the plinth: from the ground up to the floor, so a sloping lot does not leave the house hanging
  for (let u = uL; u <= uR; u += 1)
    for (let d = 0; d >= -(D - 1); d -= 1) {
      const [x, , z] = L.at(u, d, 0)
      for (let y = Math.min(gy(x, z), pos[1]); y <= pos[1]; y += 1) b.set(x, y, z, y === pos[1] ? `minecraft:${F}_planks` : trim.block)
    }
  // 2. the walls, storey by storey: stone below, timber-framed plaster above (jettied out)
  for (let s = 0; s < storeys; s += 1) {
    const out = s > 0 ? jet : 0 // the front wall of an upper storey stands 1 out over the street
    for (let k = 1; k <= STOREY; k += 1) {
      const h = s * STOREY + k
      for (let u = uL; u <= uR; u += 1)
        for (let d = out; d >= -(D - 1); d -= 1) {
          const edgeU = u === uL || u === uR
          const edgeD = d === out || d === -(D - 1)
          if (!edgeU && !edgeD) continue
          let blk
          if (s === 0) blk = base
          else if (edgeU && edgeD) blk = log('y') // corner posts
          else if (k === 1 || k === STOREY) blk = log(edgeD ? L.across : L.deep) // sill and head beams
          else if ((edgeD && (u - uL) % 3 === 0) || (edgeU && (-d) % 3 === 0)) blk = log('y') // studs
          else blk = upper
          set(u, d, h, blk)
        }
      // the floor of the storey above, and a jetty's corbels under its overhang
      if (s > 0 && k === 1 && jet)
        for (let u = uL; u <= uR; u += 1) set(u, 1, h - 1, `${trim.stairs}[facing=${L.back},half=top]`)
    }
  }
  // 3. windows and the door: a rhythm along the front, shutters and boxes upstairs, dark behind
  const glass = 'minecraft:gray_stained_glass'
  const dark = 'minecraft:polished_blackstone'
  const windowAt = (u, d, h, wall) => {
    set(u, d, h, glass)
    set(u, d, h + 1, glass)
    set(u, d - 1, h, dark, { keep: true })
    set(u, d - 1, h + 1, dark, { keep: true })
    if (wall !== 'side' && h > STOREY) {
      if (rng() < 0.6) set(u, d + 1, h - 1, `minecraft:${F}_trapdoor[facing=${L.out},half=top,open=false]`) // a sill shelf
      if (rng() < 0.45) set(u, d + 1, h, rng() < 0.5 ? 'minecraft:potted_red_tulip' : 'minecraft:potted_azure_bluet')
    }
  }
  const doorU = W >= 7 && rng() < 0.5 ? uL + 2 : 0
  if (shop) {
    // a wide shop opening with a counter, and a striped awning over the street
    const w0 = doorU === 0 ? 1 : doorU + 2
    for (let u = w0; u <= Math.min(uR - 1, w0 + 2); u += 1) {
      set(u, 0, 1, 'minecraft:barrel[facing=up]')
      set(u, 0, 2, 'minecraft:air')
      set(u, 0, 3, 'minecraft:air')
      set(u, -1, 2, 'minecraft:air')
    }
    for (let u = uL; u <= uR; u += 1) set(u, 1, 4, `minecraft:${(u - uL) % 2 ? 'white' : awning}_carpet`)
    for (let u = uL; u <= uR; u += 1) if (!b.get(...L.at(u, 1, 3))) set(u, 1, 3, `minecraft:${F}_trapdoor[facing=${L.back},half=top,open=false]`)
  } else
    for (let u = uL + 1; u <= uR - 1; u += 1) if (Math.abs(u - doorU) >= 2 && (u - uL) % 2 === 1) windowAt(u, 0, 2, 'front')
  b.door(L.at(doorU, 0, 1), L.out, { material: F })
  set(doorU, 1, 0, `${trim.slab}[type=top]`, { keep: true }) // the step
  for (let s = 1; s < storeys; s += 1)
    for (let u = uL + 1; u <= uR - 1; u += 1) if ((u - uL) % 2 === 1) windowAt(u, jet, s * STOREY + 2, 'front')
  // a window in each side storey where the side is free (the end of a row, an alley)
  for (const side of [uL, uR])
    for (let s = 1; s < storeys; s += 1) {
      const [sx, , sz] = L.at(side + (side === uL ? -1 : 1), -Math.floor(D / 2), s * STOREY + 2)
      if (!b.get(sx, s * STOREY + 2 + pos[1], sz)) windowAt(side, -Math.floor(D / 2), s * STOREY + 2, 'side')
    }
  // 4. the roof: the gable or the eaves to the street, a steep pitch, overhangs, plaster gables
  const corners = [L.at(uL, jet, top + 1), L.at(uR, -(D - 1), top + 1)]
  const x0 = Math.min(corners[0][0], corners[1][0])
  const x1 = Math.max(corners[0][0], corners[1][0])
  const z0 = Math.min(corners[0][2], corners[1][2])
  const z1 = Math.max(corners[0][2], corners[1][2])
  const ridgeAlongStreet = front === 'eaves'
  const axis = ridgeAlongStreet ? L.across : L.deep
  const roof = b.roof({ x0, z0, x1, z1, y: pos[1] + top + 1, type: 'gable', axis, material: look.roof, pitch: [1, 1, 2, 1], overhang: 1, gableOverhang: 1, gable: upper, eaveTrim: true })
  // 5. a chimney at the back, above the ridge
  const [cx, , cz] = L.at(rng() < 0.5 ? uL + 1 : uR - 1, -(D - 2), 0)
  b.chimney([cx, pos[1] + top + 1, cz], Math.max(3, roof.topY - (pos[1] + top + 1) + 2), { paint: kit.palette(look.base, { scale: 2, seed: seed + 5 }) })
  // 6. the back yard: a fence or hedge round it, a plot, a barrel or a shed
  if (yard) {
    const yd = depth - D
    if (yd >= 3) {
      const fence = rng() < 0.5 ? `minecraft:${F}_fence` : 'minecraft:oak_leaves[persistent=true]'
      for (let u = uL; u <= uR; u += 1)
        for (let d = -D; d >= -(depth - 1); d -= 1) {
          const [x, , z] = L.at(u, d, 0)
          const y = gy(x, z)
          if (y < 0) continue
          const rim = u === uL || u === uR || d === -(depth - 1)
          if (rim) b.set(x, y + 1, z, fence, { keep: true })
          else if (d <= -D - 1 && d >= -(depth - 2) && u > uL + 1 && u < uR - 1 && (u - uL) % 2 === 0) {
            b.set(x, y, z, 'minecraft:farmland[moisture=7]')
            b.set(x, y + 1, z, rng() < 0.5 ? 'minecraft:carrots[age=7]' : 'minecraft:potatoes[age=7]')
          }
        }
      const [bx, , bz] = L.at(uR - 1, -(depth - 2), 0)
      if (gy(bx, bz) >= 0) b.set(bx, gy(bx, bz) + 1, bz, rng() < 0.5 ? 'minecraft:barrel[facing=up]' : 'minecraft:composter[level=4]', { keep: true })
    }
  }
  return { top: roof.topY, width: W, deep: D }
}

// A street lined on both sides: lots from kit.plan.lotsAlongRoad, a house on each, every house
// different from its neighbours; shops in the first `shops` lots from the start (the plaza end).
export function townStreet(ctx, st, { ground, looks = LOOKS, occupied = new Set(), shops = 4, frontage = [6, 10], depth = [12, 16], seed = 1 } = {}) {
  const { kit, S } = ctx
  const heightFn = Object.assign((x, z) => ground(x, z), { size: [S, S] })
  const lots = kit.plan.lotsAlongRoad(st.path, { roadWidth: st.width + 2, frontage, depth, setback: [0, 0], gap: [0, 1], heightFn, occupied, roads: st.cells, margin: 0, seed })
  const rng = kit.rng(seed * 31 + 7)
  let prev = null
  const houses = []
  for (const [i, lot] of lots.entries()) {
    // a look, a height and a front different from the previous house's
    let look
    do look = rng.pick(looks)
    while (looks.length > 1 && prev && look === prev.look)
    const storeys = prev?.storeys === 3 ? 2 : rng() < 0.35 ? 3 : 2
    const front = prev?.front === 'gable' ? (rng() < 0.7 ? 'eaves' : 'gable') : rng() < 0.7 ? 'gable' : 'eaves'
    const y = Math.round(lot.y ?? ground(lot.door[0], lot.door[1]))
    const h = townHouse(ctx, [lot.door[0], y, lot.door[1]], lot.facing, { width: lot.width, depth: lot.depth, storeys, front, look, shop: i < shops, seed: seed * 100 + i, ground })
    prev = { look, storeys, front }
    houses.push({ lot, ...h })
  }
  return houses
}

// ------------------------------------------------------------------ the figure
// DON'T: the same house again and again, standing apart on a lawn along a ruled dirt line
function lawnHousesBad(ctx) {
  const { b, FY, S } = ctx
  for (let x = 6; x < S - 6; x += 1) for (const z of [S / 2, S / 2 + 1]) b.set(x, FY, z, 'minecraft:dirt_path')
  for (let x = 16; x < S - 12; x += 22) townHouse(ctx, [x, FY, S / 2 - 6], 'south', { width: 7, depth: 9, deep: 7, storeys: 2, front: 'gable', look: LOOKS[0], seed: 1, yard: false })
}

export const figure = { size: 112, height: 48, floorY: 4, camera: { eye: [2, 38, 112], lookAt: [62, 4, 52], fov: 56, width: 640, height: 420 } }

export function demo(ctx, which) {
  const { b, FY, S } = ctx
  for (let x = 1; x < S - 1; x += 1)
    for (let z = 1; z < S - 1; z += 1) {
      b.set(x, FY, z, 'minecraft:grass_block')
      b.set(x, FY - 1, z, 'minecraft:dirt')
    }
  if (which === 'bad') return lawnHousesBad(ctx)
  const ground = () => FY
  // a street that curves through the town from the plaza (south-west) toward a gate (north-east),
  // and a lane leaving it
  const main = street(ctx, [[8, 96], [34, 74], [58, 60], [84, 40], [106, 26]], { width: 7, ground, seed: 3 })
  const lane = street(ctx, [[50, 64], [44, 40], [48, 14]], { width: 5, ground, seed: 4 })
  const occupied = new Set()
  for (const k of [...main.cells, ...lane.cells]) occupied.add(k)
  townStreet(ctx, main, { ground, occupied, shops: 3, seed: 5 })
  townStreet(ctx, lane, { ground, occupied, shops: 0, frontage: [5, 8], seed: 9 })
}
