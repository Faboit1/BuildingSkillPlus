// LAMPS AND LIGHT. Read this, look at img/lamps.png, then design your own lamps for the theme (an
// iron post, a wooden post with a lantern arm, a stone column with a brazier). The spawn must be
// light level 8+ everywhere a mob could spawn: finishSpawn() spawn-proofs what you leave dark with
// invisible light blocks, but the lamps you can see are part of the design.
//
// DO
// - Lamps where people walk: on posts along the paths, every 7-10 blocks, alternating sides or in
//   pairs at a junction; at doors, gates, NPC places and crates.
// - A post with a base and a cap and an arm that holds the lantern out over the path.
// - Hidden light for the rest: light blocks (invisible), a lantern inside a hedge, shroomlight
//   in a tree crown, sea lanterns under carpet, a candle on a table.
// - Warm light (lanterns, candles, campfires) in a medieval or rustic spawn; soul lanterns or end
//   rods only where the theme is cold or magical.
// DON'T
// - Glowstone or sea lanterns set into the floor in a grid, or in the walls in rows.
// - Torches every 2 blocks on the ground, on every wall, on top of everything.
// - Lamps in the way: in a doorway, in front of an NPC, under a board's text.

import { local } from '../../../assets/frame/frame.mjs'
import { groundPatch } from './_scene.mjs'

// A lamp post. pos = the ground block under it, armToward = where the arm points (over the path).
export function lampPost(ctx, pos, armToward, { height = 4, wood = 'spruce', base = 'stone_brick_wall' } = {}) {
  const { b } = ctx
  const L = local(pos, armToward)
  const set = (d, h, blk) => b.set(...L.at(0, d, h), blk)
  set(0, 1, `minecraft:${base}`)
  for (let h = 2; h <= height; h += 1) set(0, h, `minecraft:${wood}_fence[${L.out}=${h === height}]`)
  set(0, height + 1, `minecraft:${wood}_slab[type=bottom]`) // the cap
  set(1, height, `minecraft:${wood}_fence[${L.back}=true]`) // the arm
  set(1, height - 1, 'minecraft:lantern[hanging=true]')
}

// A walk with lamp posts on alternating sides (the walk itself is a strip of paving here).
function lamplitWalk(ctx, z, x0, x1) {
  const { b, kit, FY } = ctx
  const paving = kit.palette({ dirt_path: 4, coarse_dirt: 2, gravel: 1 }, { scale: 3, seed: 4 })
  for (let x = x0; x <= x1; x += 1) for (let dz = -1; dz <= 1; dz += 1) b.set(x, FY, z + dz, paving)
  let side = 1
  for (let x = x0 + 2; x <= x1; x += 8) {
    lampPost(ctx, [x, FY, z + side * 3], side > 0 ? 'north' : 'south')
    side = -side
  }
}

export const figure = { size: 24, height: 10, floorY: 3, camera: { eye: [-3, 7, 22], lookAt: [12, 4, 12], fov: 60 } }
export function demo(ctx, which) {
  groundPatch(ctx)
  const { b, FY } = ctx
  if (which === 'good') lamplitWalk(ctx, 12, 1, 22)
  else {
    for (let x = 1; x <= 22; x += 1) for (let dz = -1; dz <= 1; dz += 1) b.set(x, FY, 12 + dz, x % 3 === 0 && dz === 0 ? 'minecraft:glowstone' : 'minecraft:gravel')
    for (let x = 2; x <= 22; x += 2) for (const z of [10, 14]) b.set(x, FY + 1, z, 'minecraft:torch')
  }
}
