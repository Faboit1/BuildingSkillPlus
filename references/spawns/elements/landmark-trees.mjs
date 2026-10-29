// LANDMARK TREES: THE GIANT. Read this, look at img/landmark-trees.png, then grow your own for the
// spawn: the theme's species, another height and lean, its own seed. One per view; it is a landmark.
// The code is giantTree() in trees.mjs; this file is its picture.
//
// DO
// - 25-40 tall, a trunk 2-4 across that leans a little, flares at the foot and narrows as it climbs.
// - Buttress roots: 5-8 of them leave the trunk a few blocks up, drop steeply, run out 6-10 blocks
//   and on along the ground half sunk, the fin under each filled down to the soil; long and short.
// - 5-7 big limbs leaving the trunk at staggered heights round the fork (0.3-0.6 of the height), at
//   the golden angle, each forking 2-3 times and thinning (logs along the limb, bark on diagonals).
// - A crown as wide as the tree is tall or wider (1-1.5 of the height across) built from 25-60 flat
//   leaf clusters at the twig ends and forks: layered, with gaps you see sky and branches through,
//   darker leaves underneath, a hem that droops at the edge.
// - Things that hang (vines, glow berries) and things at the foot (litter, moss, ferns, petals).
// DON'T
// - A scaled-up lollipop: a thick pole with a ball of leaves on top.
// - A smooth sphere or dome of one leaf; a crown with no gaps; leaves floating with no limb to them.
// - Straight limbs at one height, all the same length; a trunk with no roots standing on the grass.

import { groundPatch } from './_scene.mjs'
import { bush, giantTree } from './trees.mjs'

export { giantTree }

// DON'T: the scaled-up lollipop
export function bigLollipop(ctx, [x, y, z], { height = 22, r = 10 } = {}) {
  const { b } = ctx
  b.box([x - 1, y + 1, z - 1], [x + 1, y + height, z + 1], 'minecraft:oak_log[axis=y]')
  for (let dx = -r; dx <= r; dx += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dz = -r; dz <= r; dz += 1)
        if (Math.hypot(dx, dy, dz) <= r && !b.get(x + dx, y + height + r - 2 + dy, z + dz)) b.set(x + dx, y + height + r - 2 + dy, z + dz, 'minecraft:oak_leaves[persistent=true]')
}

export const figure = { size: 112, height: 56, floorY: 3, camera: { eye: [56, 8, 111.5], lookAt: [56, 19, 42], fov: 37, width: 600, height: 440 } }
export function demo(ctx, which) {
  groundPatch(ctx)
  const { FY } = ctx
  if (which === 'good') {
    giantTree(ctx, [56, FY, 42], { species: 'oak', height: 34, seed: 3 })
    bush(ctx, [40, FY, 58], { seed: 3 })
    bush(ctx, [72, FY, 55], { r: 2, seed: 6 })
  } else bigLollipop(ctx, [56, FY, 42], { height: 21, r: 10 })
}
