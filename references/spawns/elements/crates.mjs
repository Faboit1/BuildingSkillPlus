// CRATES. Read this, look at img/crates.png, then design the crate corner of your spawn: your own
// stage, backdrop and tier colours for the theme. b.markCrate records each crate (its hologram,
// the setup command) and keeps the cells above and in front of it clear.
//
// DO
// - A corner or a hall of their own off the main path, every crate on its own low stage (1 high,
//   steps in front), 6+ apart centre to centre, so a crowd round one does not block the next.
// - A backdrop behind each crate (a screen, an arch, a niche) whose accent colour is the tier's:
//   a stained glass strip, a terracotta panel, a banner. The stone stays the same for all.
// - The crate block (an ender chest, a chest, a barrel) facing the players, nothing over it: its
//   hologram floats 1.6 above it. The best crate in the middle, a little bigger.
// - 3+ blocks of free floor in front of each, lanterns at the sides.
// DON'T
// - Chests on the grass 2 apart in a line, each on a block of a different coloured concrete.
// - Glowstone or sea lanterns next to them, signs on them, a roof or a leaf block over them.
// - Every crate a different style: one design, the tier only in the accent.

import { local } from '../../../assets/frame/frame.mjs'
import { pavedPatch } from './_scene.mjs'

// One crate stage. pos = the floor block under the crate, facing = toward the players.
// colour = the tier's dye colour, block = the crate block.
export function crateStage(ctx, pos, facing, { label, tier = 'common', colour = 'light_blue', block = 'chest', stone = 'stone_brick', hero = false, crateId } = {}) {
  const { b } = ctx
  const L = local(pos, facing)
  const set = (u, d, h, blk) => b.set(...L.at(u, d, h), blk)
  // the stage: 3 wide, 2 deep, 1 high; a step in front, slab corners
  for (let u = -1; u <= 1; u += 1) for (let d = -1; d <= 0; d += 1) set(u, d, 1, `minecraft:polished_andesite`)
  for (let u = -1; u <= 1; u += 1) set(u, 1, 1, `minecraft:${stone}_stairs[facing=${L.back},half=bottom]`)
  // the backdrop: a screen with the tier's colour in the middle, posts at the sides, a capping
  const top = hero ? 5 : 4
  for (let h = 1; h <= top; h += 1) {
    set(-2, -1, h, `minecraft:${stone}s`)
    set(2, -1, h, `minecraft:${stone}s`)
  }
  for (let u = -1; u <= 1; u += 1)
    for (let h = 2; h <= top - 1; h += 1) set(u, -2, h, u === 0 ? `minecraft:${colour}_stained_glass` : `minecraft:${colour}_terracotta`)
  for (let u = -1; u <= 1; u += 1) set(u, -2, 1, `minecraft:${stone}s`)
  for (let u = -2; u <= 2; u += 1) set(u, -2, top, `minecraft:${stone}s`)
  for (const u of [-1, 1]) set(u, -2, top + 1, `minecraft:${stone}_slab[type=bottom]`)
  set(-2, -2, top + 1, `minecraft:${stone}_stairs[facing=${L.right},half=bottom]`)
  set(2, -2, top + 1, `minecraft:${stone}_stairs[facing=${L.left},half=bottom]`)
  set(0, -2, top + 1, `minecraft:chiseled_${stone}s`)
  // lanterns on the posts' fronts, to the sides of the crate
  for (const u of [-2, 2]) set(u, 0, 1, 'minecraft:stone_brick_wall')
  for (const u of [-2, 2]) set(u, 0, 2, 'minecraft:lantern[hanging=false]')
  // the crate itself, on the stage, facing the players
  const crate = L.at(0, 0, 2)
  b.set(...crate, block === 'barrel' ? `minecraft:barrel[facing=${L.out}]` : `minecraft:${block}[facing=${L.out}]`)
  return b.markCrate(crate, facing, { id: crateId, label, tier, block })
}

export const figure = { size: 24, height: 12, floorY: 3, px: 12 }
export function demo(ctx, which) {
  pavedPatch(ctx)
  const { b, FY } = ctx
  if (which === 'good') {
    crateStage(ctx, [5, FY, 9], 'south', { label: 'Vote Crate', tier: 'vote', colour: 'lime', crateId: 'vote' })
    crateStage(ctx, [12, FY, 9], 'south', { label: 'Mythic Crate', tier: 'mythic', colour: 'purple', block: 'ender_chest', hero: true, crateId: 'mythic' })
    crateStage(ctx, [19, FY, 9], 'south', { label: 'Common Crate', tier: 'common', colour: 'light_blue', crateId: 'common' })
  } else {
    const colours = ['red', 'lime', 'purple', 'yellow', 'light_blue', 'orange']
    for (let i = 0; i < 6; i += 1) {
      const x = 4 + i * 3
      b.set(x, FY + 1, 11, `minecraft:${colours[i]}_concrete`)
      b.set(x, FY + 2, 11, 'minecraft:chest[facing=south]')
      if (i % 2) b.set(x + 1, FY + 1, 11, 'minecraft:glowstone')
    }
  }
}
