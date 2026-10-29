// GATES AND PORTALS (RTP, warps, the way to the PvP arena). Read this, look at img/gate.png, then
// design your own gate for the theme. A portal is a region a plugin watches (b.markPortal records the
// opening for setup.md); what players see is the gate you build round it.
//
// DO
// - A gate that frames the way through: two piers with a base and a cap, an arch or a lintel with a
//   keystone, 2 deep so it has weight; the opening 3+ wide and 4+ high.
// - The opening clear (it is where players walk): mark it with b.markPortal; show it is a portal
//   with what the server adds (particles from the portal plugin, the title hologram above).
// - A threshold: the floor changes under the opening, steps or a path lead to it; lanterns on
//   the piers. The name on a hologram above the arch (ctx.hologram).
// - Put it at the end of a path or an axis from the spawn point so it is seen from far.
// DON'T
// - A bare obsidian rectangle (the nether portal cliche), or a frame of glowstone or beacons.
// - Filling the opening with glass, water or nether portal blocks players cannot walk through.
// - A gate in the middle of the plaza with nothing leading to it.

import { local } from '../../../assets/frame/frame.mjs'
import { pavedPatch } from './_scene.mjs'

// A gate. pos = the floor block under the middle of the opening, facing = toward the players
// (who walk through it away from you). width = the opening (odd), height = up to the arch.
export function gate(ctx, pos, facing, { label = 'Random teleport', portalId, kind = 'rtp', width = 3, height = 4, stone = 'stone_brick', threshold = 'polished_deepslate' } = {}) {
  const { b } = ctx
  const L = local(pos, facing)
  const set = (u, d, h, blk) => b.set(...L.at(u, d, h), blk)
  const half = Math.floor(width / 2)
  const P = half + 1 // the piers
  for (const u of [-P - 1, -P, P, P + 1])
    for (const d of [0, -1]) {
      const outer = Math.abs(u) === P + 1
      const H = outer ? height - 1 : height + 1
      for (let h = 1; h <= H; h += 1) set(u, d, h, h === 1 ? 'minecraft:polished_andesite' : `minecraft:${stone}s`)
      if (outer) set(u, d, H + 1, `minecraft:${stone}_stairs[facing=${u < 0 ? L.right : L.left},half=bottom]`)
    }
  // the arch: the opening's top corners rounded by upside-down stairs, a lintel, a keystone
  for (const d of [0, -1]) {
    set(-half, d, height, `minecraft:${stone}_stairs[facing=${L.left},half=top]`)
    set(half, d, height, `minecraft:${stone}_stairs[facing=${L.right},half=top]`)
    for (let u = -P; u <= P; u += 1) set(u, d, height + 1, `minecraft:${stone}s`)
    for (let u = -P; u <= P; u += 1) set(u, d, height + 2, u === 0 ? `minecraft:chiseled_${stone}s` : `minecraft:${stone}_slab[type=bottom]`)
  }
  for (const u of [-P, P]) set(u, 1, height - 1, 'minecraft:lantern[hanging=false]')
  for (const u of [-P, P]) set(u, 1, height - 2, `minecraft:${stone}_wall`)
  for (const u of [-P, P]) for (let h = 1; h < height - 2; h += 1) set(u, 1, h, `minecraft:${stone}_wall`)
  // the threshold under the opening, steps up to it in front
  for (let u = -half; u <= half; u += 1) {
    for (const d of [0, -1]) set(u, d, 0, `minecraft:${threshold}`)
    set(u, 1, 0, `minecraft:${threshold}`)
  }
  // record the opening (the cells players walk through) and the title above
  const lo = L.at(-half, -1, 1)
  const hi = L.at(half, 0, height - 1)
  ctx.hologram(portalId ?? 'gate', label, L.at(0, 1, height + 4))
  return b.markPortal(lo, hi, { id: portalId, label, kind, facing })
}

export const figure = { size: 18, height: 12, floorY: 3, camera: { eye: [13, 5, 19], lookAt: [9, 5, 7], fov: 60 } }
export function demo(ctx, which) {
  pavedPatch(ctx)
  const { b, FY } = ctx
  if (which === 'good') gate(ctx, [9, FY, 7], 'south', { portalId: 'rtp' })
  else {
    for (let x = 7; x <= 11; x += 1)
      for (let h = 1; h <= 5; h += 1) {
        const edge = x === 7 || x === 11 || h === 1 || h === 5
        b.set(x, FY + h, 7, edge ? 'minecraft:obsidian' : 'minecraft:purple_stained_glass')
      }
  }
}
