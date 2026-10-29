// BUILDINGS. Read this, look at img/buildings.png, then design each building of your spawn from its
// job (a shop, a bank, a tavern, a tower) and the theme: your own size, proportions, roof shape and
// materials. The kit's building helpers (kit/windows, doors, roofs: references/building) are tools
// you may call; what the building looks like is your design.
//
// DO
// - A plinth (1-2 of stone under the walls): a building stands on the ground, it was not dropped on it.
// - A frame you can read: corner posts and a top plate in a darker material, posts beside the door
//   and the windows; the infill lighter between them.
// - Depth on every face: windows with a sill under and shutters or a frame beside, the glass not
//   flush with a flat wall; a hood or a porch over the door; a step up to it.
// - A roof that overhangs the walls by 1 all round (eaves), at 45 degrees or steeper, with the gable
//   ends filled and a ridge; a chimney through it. The roof is a third or more of the height.
// - Proportions: taller than a box (walls 4-6 high on 5-9 wide), the door in the middle or by a
//   corner on purpose, windows in a rhythm (window, post, door, post, window).
// DON'T
// - The plank box: one material, flat walls, a flat roof, glass panes in a row flush with the wall,
//   no plinth, no overhang, the door a hole.
// - Glass walls, concrete, wool, or quartz everywhere on a medieval or rustic spawn.
// - Every building the same box at the same height in a row.

import { local } from '../../../assets/frame/frame.mjs'
import { groundPatch } from './_scene.mjs'

// A timber-framed house. pos = the ground block under the middle of the front wall, facing = the
// front. w = width along the front (odd), d = depth, h = wall height above the plinth.
export function house(ctx, pos, facing, { w = 9, d = 7, h = 4, plinth = { cobblestone: 3, mossy_cobblestone: 1, stone: 1 }, post = 'spruce_log', fill = 'white_terracotta', roof = 'dark_oak', gable = 'spruce_planks', seed = 1 } = {}) {
  const { b, kit } = ctx
  const L = local(pos, facing)
  const set = (u, dd, hh, blk) => b.set(...L.at(u, dd, hh), blk)
  const half = Math.floor(w / 2)
  const back = -(d - 1) // the walls run from d = 0 (front) to d = back
  const stone = kit.palette(plinth, { scale: 2, seed })
  const isCorner = (u, dd) => Math.abs(u) === half && (dd === 0 || dd === back)
  const onWall = (u, dd) => Math.abs(u) === half || dd === 0 || dd === back
  const top = h + 1 // the top plate's level
  // the plinth (and the floor inside)
  for (let u = -half; u <= half; u += 1)
    for (let dd = back; dd <= 0; dd += 1) set(u, dd, 1, onWall(u, dd) ? stone : 'minecraft:spruce_planks')
  // the walls: posts at the corners, beside the door and in the middle of the sides; infill between
  const mid = Math.round(back / 2)
  const isPost = (u, dd) => isCorner(u, dd) || ((dd === 0) && Math.abs(u) === 1) || (Math.abs(u) === half && dd === mid)
  for (let u = -half; u <= half; u += 1)
    for (let dd = back; dd <= 0; dd += 1) {
      if (!onWall(u, dd)) continue
      for (let hh = 2; hh <= top; hh += 1) {
        let blk = isPost(u, dd) ? `minecraft:${post}[axis=y]` : `minecraft:${fill}`
        if (hh === top) blk = `minecraft:${post}[axis=${Math.abs(u) === half && !isCorner(u, dd) ? L.deep : L.across}]`
        set(u, dd, hh, blk)
      }
    }
  // windows, 2 high: glass in the wall, a sill under it outside; shutters on the front ones
  const flip = { north: 'south', south: 'north', east: 'west', west: 'east' }
  const windows = []
  for (const u of [-half + 1, half - 1]) windows.push({ u, dd: 0, out: L.out, shutters: true }, { u, dd: back, out: L.back })
  for (const side of [-1, 1]) for (const dd of [mid + 2, mid - 2]) if (dd < 0 && dd > back) windows.push({ u: side * half, dd, out: side < 0 ? L.left : L.right })
  for (const win of windows) {
    const side = Math.abs(win.u) === half && win.dd !== 0 && win.dd !== back
    const [ou, od] = side ? [Math.sign(win.u), 0] : [0, win.dd === 0 ? 1 : -1] // one step outside
    for (const hh of [3, 4]) set(win.u, win.dd, hh, 'minecraft:glass_pane')
    set(win.u + ou, win.dd + od, 2, `minecraft:spruce_stairs[facing=${flip[win.out]},half=top]`)
    if (win.shutters) for (const s of [-1, 1]) for (const hh of [3, 4]) set(win.u + s, win.dd + od, hh, `minecraft:spruce_trapdoor[facing=${win.out},half=bottom,open=true]`)
  }
  // the door in the middle of the front, a hood over it, a step up to it
  set(0, 0, 2, `minecraft:spruce_door[facing=${L.out},half=lower,hinge=left,open=false]`)
  set(0, 0, 3, `minecraft:spruce_door[facing=${L.out},half=upper,hinge=left,open=false]`)
  set(0, 1, 1, `minecraft:cobblestone_stairs[facing=${L.back},half=bottom]`)
  for (let u = -1; u <= 1; u += 1) set(u, 1, 5, `minecraft:${roof}_stairs[facing=${L.back},half=bottom]`)
  for (const u of [-1, 1]) set(u, 1, 4, `minecraft:${roof}_stairs[facing=${L.back},half=top]`)
  // the roof: a gable along the front, overhanging by 1 all round, a slab ridge
  const rows = d + 2 // from d = 1 (front eave) to d = back - 1 (back eave)
  for (let k = 0; k < Math.ceil(rows / 2); k += 1) {
    const front = 1 - k
    const rear = back - 1 + k
    const hh = top + k
    for (let u = -half - 1; u <= half + 1; u += 1) {
      if (front === rear) set(u, front, hh, `minecraft:${roof}_slab[type=bottom]`)
      else {
        set(u, front, hh, `minecraft:${roof}_stairs[facing=${L.back},half=bottom]`)
        set(u, rear, hh, `minecraft:${roof}_stairs[facing=${L.out},half=bottom]`)
      }
    }
    // fill the gable ends under this course, with a small window in the middle at the top
    for (let dd = rear + 1; dd < front; dd += 1)
      for (const u of [-half, half]) set(u, dd, hh, k >= 2 && dd === Math.round(back / 2) ? 'minecraft:glass_pane' : `minecraft:${gable}`)
  }
  // the chimney through the back slope
  const ridge = top + Math.ceil(rows / 2) - 1
  for (let hh = 2; hh <= ridge + 1; hh += 1) set(half - 1, back + 1, hh, 'minecraft:bricks')
  set(half - 1, back + 1, ridge + 2, 'minecraft:campfire[lit=true,signal_fire=false]')
  // a lantern by the door and a barrel against the wall: someone lives here
  set(2, 1, 1, 'minecraft:barrel[facing=up]')
  set(-2, 1, 1, 'minecraft:flower_pot')
}

// DON'T: the plank box
function plankBox(ctx, [x0, y, z0], { w = 7, d = 5, h = 4 } = {}) {
  const { b } = ctx
  for (let x = x0; x < x0 + w; x += 1)
    for (let z = z0; z < z0 + d; z += 1)
      for (let hh = 1; hh <= h + 1; hh += 1) {
        const wall = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1
        if (hh === h + 1) b.set(x, y + hh, z, 'minecraft:oak_planks')
        else if (wall) b.set(x, y + hh, z, 'minecraft:oak_planks')
      }
  const door = x0 + Math.floor(w / 2)
  for (let x = x0 + 1; x < x0 + w - 1; x += 1) if (x !== door) b.set(x, y + 3, z0 + d - 1, 'minecraft:glass_pane')
  b.remove(door, y + 1, z0 + d - 1)
  b.remove(door, y + 2, z0 + d - 1)
}

export const figure = { size: 20, height: 16, floorY: 3, camera: { eye: [17, 7, 22], lookAt: [9, 6, 8], fov: 62 } }
export function demo(ctx, which) {
  groundPatch(ctx)
  const { FY } = ctx
  if (which === 'good') house(ctx, [9, FY, 12], 'south', { w: 9, d: 7, seed: 2 })
  else plankBox(ctx, [5, FY, 6], { w: 9, d: 7 })
}
