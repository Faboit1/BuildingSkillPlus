// NPC PLACES. Read this, look at img/npc.png, then give every NPC of your spawn a place of its own:
// change the base, the backdrop and the lights to suit the NPC (a shop gets a stall, the quests a
// notice board, the warps a little gate) and the theme. The empty block on top of the plinth is
// where the NPC stands; b.markNpc records it for setup.md and keeps its head room clear.
//
// DO
// - Stand it 1 block above the players' floor (2 at most): they look it in the face, not at its feet.
// - A place of its own: a low plinth with a skirt of steps, something behind it (a hedge, a wall, a
//   stall's back) and an apron in front where players gather (a change of paving, 3-4 deep).
// - Face it where players come from (the spawn point, the main path): facingToward(npc, spawn).
// - Head room: 3 clear above its feet, nothing within 2 in front; its hologram floats 2.4 above its
//   feet, so nothing hangs over it (no roof, no lantern, no tree crown).
// - Light from the sides: lanterns on posts left and right, never a glowstone under its feet.
// DON'T
// - A pillar that puts it 4+ blocks up (players see its feet), or a glass box round it.
// - NPCs in a row against a wall, 2 apart, all alike: each its own place, 8+ apart, varied by role.
// - Anything in its face: a sign, a lantern, leaves, a fence post, a crate.

import { local } from '../../../assets/frame/frame.mjs'
import { groundPatch } from './_scene.mjs'

const id = s => (s.includes(':') ? s : `minecraft:${s}`)

// One NPC place. pos = the floor block under the middle of the plinth, facing = toward the players.
export function npcPlace(ctx, pos, facing, { label = 'NPC', role = '', npcId, plinth = 'polished_andesite', top = 'chiseled_stone_bricks', skirt = 'stone_brick', apron = { stone_bricks: 4, mossy_stone_bricks: 1, cracked_stone_bricks: 1 }, hedge = { azalea_leaves: 3, flowering_azalea_leaves: 1 }, post = 'spruce', seed = 1 } = {}) {
  const { b, kit } = ctx
  const L = local(pos, facing)
  const set = (u, d, h, block) => b.set(...L.at(u, d, h), block)
  // the plinth: 3 x 3, 1 high, the NPC's own block in the middle
  for (let u = -1; u <= 1; u += 1) for (let d = -1; d <= 1; d += 1) set(u, d, 1, id(u === 0 && d === 0 ? top : plinth))
  // the skirt: steps up from three sides (stairs face the way you climb), slabs at the corners
  for (let k = -1; k <= 1; k += 1) {
    set(k, 2, 1, `minecraft:${skirt}_stairs[facing=${L.back},half=bottom]`)
    set(-2, k, 1, `minecraft:${skirt}_stairs[facing=${L.right},half=bottom]`)
    set(2, k, 1, `minecraft:${skirt}_stairs[facing=${L.left},half=bottom]`)
  }
  set(-2, 2, 1, `minecraft:${skirt}_slab[type=bottom]`)
  set(2, 2, 1, `minecraft:${skirt}_slab[type=bottom]`)
  // behind it: a hedge that curves round, higher in the middle
  const leaves = kit.palette(hedge, { scale: 2, seed })
  for (let u = -3; u <= 3; u += 1) {
    const d = Math.abs(u) === 3 ? -1 : -2
    const tall = Math.abs(u) <= 1 ? 3 : 2
    for (let h = 1; h <= tall; h += 1) set(u, d, h, leaves)
    if (Math.abs(u) === 3) set(u, 0, 1, leaves)
  }
  // lanterns on posts at the front corners, clear of its face
  for (const u of [-3, 3]) {
    set(u, 2, 1, 'minecraft:stone_brick_wall')
    set(u, 2, 2, `minecraft:${post}_fence`)
    set(u, 2, 3, `minecraft:${post}_fence`)
    set(u, 2, 4, 'minecraft:lantern[hanging=false]')
  }
  // the apron: where players stand to talk to it, a paving of its own
  const paving = kit.palette(apron, { scale: 2, seed: seed + 1 })
  for (let u = -2; u <= 2; u += 1) for (let d = 3; d <= 5; d += 1) if (!(Math.abs(u) === 2 && d === 5)) set(u, d, 0, paving)
  // record it: the block it stands on is the plinth's middle
  return b.markNpc(L.at(0, 0, 1), facing, { id: npcId, label, role })
}

// DON'T: a quartz pillar 4 up, and a glass booth
function pillarNpc(ctx, [x, y, z]) {
  const { b } = ctx
  for (let h = 1; h <= 4; h += 1) b.set(x, y + h, z, 'minecraft:quartz_pillar[axis=y]')
  b.set(x, y + 1, z + 1, 'minecraft:glowstone')
}
function boothNpc(ctx, [x, y, z]) {
  const { b } = ctx
  for (let dx = -1; dx <= 1; dx += 1)
    for (let dz = -1; dz <= 1; dz += 1) {
      b.set(x + dx, y + 1, z + dz, 'minecraft:glowstone')
      b.set(x + dx, y + 5, z + dz, 'minecraft:quartz_block')
      if (dx || dz) for (let h = 2; h <= 4; h += 1) b.set(x + dx, y + h, z + dz, 'minecraft:glass')
    }
}

export const figure = { size: 15, height: 10, floorY: 3, px: 18 }
export function demo(ctx, which) {
  groundPatch(ctx)
  const { FY } = ctx
  if (which === 'good') npcPlace(ctx, [7, FY, 5], 'south', { label: 'Shop', role: 'shop', seed: 2 })
  else {
    pillarNpc(ctx, [4, FY, 6])
    boothNpc(ctx, [10, FY, 7])
  }
}
