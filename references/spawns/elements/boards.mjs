// LEADERBOARDS AND THE TOP-3 PILLARS. Read this, look at img/boards.png, then design your own: the
// frame, the backdrop and where the pillars go are yours. A leaderboard is a hologram (10-12 lines
// of text); what you build is the place it floats in. b.markBoard records it and keeps its volume
// clear; the pillars' statues are NPCs (b.markNpc with role 'statue'; the blue figures in the
// picture stand in for them).
//
// DO
// - A framed recess: piers at the sides, a base and a lintel, the backdrop set 1 back. A dark
//   backdrop only behind the text (polished blackstone, dark oak, deepslate tiles) so it reads.
// - The text at eye height: its top line 4-6 above the floor, the board 5 wide and 4 tall per 10-12
//   lines. Free floor in front (6+ deep) so players can step back and read.
// - The top-3 pillars as players know them: three 3 x 3 columns side by side, the 1st 3 high in the
//   middle, the 2nd 2 high on its left, the 3rd 1 high on its right, in the metals of the ranks:
//   diamond / gold / iron blocks, or gold / iron / copper (waxed, so it never turns green), or
//   concrete in those colours (light blue / yellow / light grey). The only place gold belongs.
// - The pillars beside the boards or between them, never in front: statues would hide the text.
//   A hologram over each statue (#1 and the name), a title over the set ("Top balance").
// - Light it with hidden light: light blocks in front of the base, a lantern on the piers.
// DON'T
// - A black wall with a glowstone grid, or the board as a flat panel in the open with no frame.
// - A roof, a slab or a lantern over the text plane: holograms render through nothing.
// - Thin 1 x 1 posts for the statues, ranks at one height, or the pillars in front of a board.

import { local } from '../../../assets/frame/frame.mjs'
import { npcStandIn, pavedPatch } from './_scene.mjs'

// One board. pos = the floor block under the middle of its backdrop, facing = toward the readers.
export function boardRecess(ctx, pos, facing, { label = 'Top players', boardId, width = 5, height = 4, stone = 'stone_brick', backdrop = 'polished_blackstone' } = {}) {
  const { b } = ctx
  const L = local(pos, facing)
  const set = (u, d, h, blk) => b.set(...L.at(u, d, h), blk)
  const half = Math.floor(width / 2)
  const W = half + 1 // the piers
  const top = height + 2 // the lintel
  for (let u = -W; u <= W; u += 1) set(u, 0, 1, `minecraft:${stone}s`) // the base
  for (let u = -half; u <= half; u += 1) set(u, 1, 1, `minecraft:${stone}_slab[type=bottom]`) // a ledge
  for (let u = -half; u <= half; u += 1) for (let h = 2; h < top; h += 1) set(u, 0, h, `minecraft:${backdrop}`)
  for (const u of [-W, W])
    for (let h = 1; h <= top; h += 1)
      for (const d of [0, 1]) set(u, d, h, h === 1 ? 'minecraft:polished_andesite' : h === top ? `minecraft:chiseled_${stone}s` : `minecraft:${stone}s`)
  for (let u = -W; u <= W; u += 1) set(u, 0, top, `minecraft:${stone}s`) // the lintel
  for (let u = -half; u <= half; u += 1) set(u, 1, top, `minecraft:${stone}_stairs[facing=${L.back},half=top]`) // its cornice
  for (let u = -W; u <= W; u += 1) set(u, 0, top + 1, u === 0 ? `minecraft:chiseled_${stone}s` : `minecraft:${stone}_slab[type=bottom]`)
  for (const u of [-W, W]) set(u, 1, top + 1, 'minecraft:lantern[hanging=false]')
  // hidden light in front of the base (invisible, no collision)
  for (const u of [-half, half]) set(u, 2, 1, 'minecraft:light[level=12]')
  // the hologram's top line: 0.5 in front of the backdrop, centred, just under the cornice
  const [ax, ay, az] = L.at(0, 1, top - 1)
  return b.markBoard([ax + 0.5, ay + 0.5, az + 0.5], facing, { id: boardId, label, size: [width, height] })
}

// The top-3 pillars. pos = the floor block under the middle of the 1st pillar, facing = toward the
// players. set: 'classic' (diamond, gold, iron), 'metals' (gold, iron, copper) or 'concrete'; or
// your own [1st, 2nd, 3rd] blocks. Statues are recorded as NPCs (role 'statue').
const PILLARS = {
  classic: ['diamond_block', 'gold_block', 'iron_block'],
  metals: ['gold_block', 'iron_block', 'waxed_copper_block'],
  concrete: ['light_blue_concrete', 'yellow_concrete', 'light_gray_concrete'],
}
export function podium(ctx, pos, facing, { set = 'classic', id = 'top', label = 'Top players' } = {}) {
  const { b } = ctx
  const L = local(pos, facing)
  const blocks = Array.isArray(set) ? set : PILLARS[set]
  const pillars = [
    { rank: 1, u: 0, H: 3 },
    { rank: 2, u: -3, H: 2 },
    { rank: 3, u: 3, H: 1 },
  ]
  const statues = []
  for (const { rank, u: uc, H } of pillars) {
    const block = blocks[rank - 1].includes(':') ? blocks[rank - 1] : `minecraft:${blocks[rank - 1]}`
    for (let u = uc - 1; u <= uc + 1; u += 1) for (let d = -1; d <= 1; d += 1) for (let h = 1; h <= H; h += 1) b.set(...L.at(u, d, h), block)
    statues.push(b.markNpc(L.at(uc, 0, H), facing, { id: `${id}-${rank}`, label: `&e#${rank} &f%name_${rank}%`, role: 'statue' }))
  }
  // the set's title floats over the 1st's statue
  const [tx, ty, tz] = L.at(0, 0, 3 + 4)
  ctx.hologram(`${id}-title`, `&6&l${label}`, [tx, ty + 0.5, tz])
  return statues
}

export const figure = { size: 30, height: 14, floorY: 3, camera: { eye: [15, 8, 31], lookAt: [15, 6, 12], fov: 66 } }
export function demo(ctx, which) {
  pavedPatch(ctx)
  const { b, FY } = ctx
  if (which === 'good') {
    boardRecess(ctx, [5, FY, 12], 'south', { label: 'Top balance', boardId: 'money' })
    podium(ctx, [15, FY, 13], 'south', { label: 'Top balance' }).forEach(st => npcStandIn(ctx, st.pos))
    boardRecess(ctx, [25, FY, 12], 'south', { label: 'Top kills', boardId: 'kills' })
  } else {
    for (let x = 6; x <= 24; x += 1)
      for (let h = 1; h <= 7; h += 1) b.set(x, FY + h, 11, (x % 3 === 0 && h % 3 === 1) ? 'minecraft:glowstone' : 'minecraft:black_concrete')
    for (let x = 6; x <= 24; x += 1) for (const z of [12, 13]) b.set(x, FY + 8, z, 'minecraft:quartz_slab[type=bottom]')
    // thin posts at one height, right in front of the board
    for (let i = 0; i < 3; i += 1) {
      for (let h = 1; h <= 3; h += 1) b.set(13 + i * 2, FY + h, 14, 'minecraft:quartz_pillar[axis=y]')
      npcStandIn(ctx, [13 + i * 2, FY + 4, 14])
    }
  }
}
