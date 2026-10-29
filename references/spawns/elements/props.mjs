// PROPS: BENCHES, BARRELS, CARTS, STALL GOODS. Read this, look at img/props.png, then dress your
// spawn with props that tell what happens in each place (a market, a well, a smithy, a dock).
//
// DO
// - Props in groups that tell a story: barrels and a crate by a stall, a bench under a tree facing
//   the view, an anvil and a grindstone by the smithy, nets and barrels at the dock.
// - Built props, not single blocks: a bench of stairs with armrests (trapdoors or signs) and a back
//   against a hedge; a cart with wheels; a table (a fence or a slab top) with things on it.
// - Barrels on their sides and upright, stacked unevenly, with a flower pot or a lantern on top.
// - Out of the way: along edges, against walls and hedges, never in the middle of a path.
// DON'T
// - Random single blocks scattered on the grass: an anvil, a cauldron, a hay bale, a bookshelf,
//   a jukebox, each alone, in a grid or a ring.
// - The same prop copied at every lamp post, or a prop for every block of a wall.

import { local } from '../../../assets/frame/frame.mjs'
import { groundPatch } from './_scene.mjs'

// A bench: stairs facing the view, trapdoor armrests, a hedge behind. pos = the ground under its
// middle, facing = the way people sit (toward the view).
export function bench(ctx, pos, facing, { length = 3, wood = 'spruce', hedge = 'oak_leaves' } = {}) {
  const { b } = ctx
  const L = local(pos, facing)
  const half = Math.floor(length / 2)
  for (let u = -half; u <= half; u += 1) b.set(...L.at(u, 0, 1), `minecraft:${wood}_stairs[facing=${L.back},half=bottom]`)
  b.set(...L.at(-half - 1, 0, 1), `minecraft:${wood}_trapdoor[facing=${L.left},half=bottom,open=true]`)
  b.set(...L.at(half + 1, 0, 1), `minecraft:${wood}_trapdoor[facing=${L.right},half=bottom,open=true]`)
  for (let u = -half - 1; u <= half + 1; u += 1) for (let h = 1; h <= 2; h += 1) b.set(...L.at(u, -1, h), `minecraft:${hedge}[persistent=true]`)
}

// Stall goods: barrels upright and on their sides, a crate, a sack, things on top.
export function stallGoods(ctx, pos, facing) {
  const { b } = ctx
  const L = local(pos, facing)
  const set = (u, d, h, blk) => b.set(...L.at(u, d, h), blk)
  set(0, 0, 1, 'minecraft:barrel[facing=up]')
  set(0, 0, 2, `minecraft:barrel[facing=${L.right}]`)
  set(1, 0, 1, `minecraft:barrel[facing=${L.out}]`)
  set(-1, 0, 1, 'minecraft:barrel[facing=up]')
  set(-1, 0, 2, 'minecraft:flower_pot')
  set(1, 1, 1, 'minecraft:composter[level=0]')
  set(2, 0, 1, 'minecraft:hay_block[axis=x]')
  set(1, 0, 2, 'minecraft:lantern[hanging=false]')
  set(-2, 1, 1, `minecraft:spruce_trapdoor[facing=${L.out},half=top,open=false]`) // a crate lid on the ground
}

// A hand cart: a slab bed on fence legs, wheels of trapdoors, a barrel in it.
export function cart(ctx, pos, facing) {
  const { b } = ctx
  const L = local(pos, facing)
  const set = (u, d, h, blk) => b.set(...L.at(u, d, h), blk)
  for (const d of [0, -1]) for (const u of [-1, 0]) set(u, d, 2, 'minecraft:spruce_slab[type=bottom]')
  set(-2, 0, 1, `minecraft:dark_oak_trapdoor[facing=${L.right},half=bottom,open=true]`)
  set(-2, -1, 1, `minecraft:dark_oak_trapdoor[facing=${L.right},half=bottom,open=true]`)
  set(1, 0, 1, `minecraft:dark_oak_trapdoor[facing=${L.left},half=bottom,open=true]`)
  set(1, -1, 1, `minecraft:dark_oak_trapdoor[facing=${L.left},half=bottom,open=true]`)
  set(0, 1, 1, 'minecraft:spruce_fence')
  set(-1, -1, 3, 'minecraft:barrel[facing=up]')
}

export const figure = { size: 16, height: 8, floorY: 3, px: 18 }
export function demo(ctx, which) {
  groundPatch(ctx)
  const { b, FY } = ctx
  if (which === 'good') {
    bench(ctx, [4, FY, 5], 'south')
    stallGoods(ctx, [11, FY, 5], 'south')
    cart(ctx, [11, FY, 11], 'east')
  } else {
    const junk = ['anvil[facing=north]', 'cauldron', 'hay_block[axis=y]', 'bookshelf', 'jukebox', 'barrel[facing=up]', 'crafting_table', 'furnace[facing=south,lit=false]', 'chest[facing=south]']
    let i = 0
    for (let x = 3; x <= 12; x += 4) for (let z = 3; z <= 12; z += 4) b.set(x, FY + 1, z, `minecraft:${junk[i++ % junk.length]}`)
  }
}
