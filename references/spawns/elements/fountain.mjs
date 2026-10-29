// FOUNTAINS AND WATER. Read this, look at img/fountain.png, then design your own: round, square
// with cut corners, a long canal, a well; tiers and materials for the theme.
//
// DO
// - A basin with a rim: a kerb 1 high (a slab on a block makes a seat), the water a block below the
//   rim's top, the basin floor 1-2 deep so it looks like water, not paint.
// - A centre that rises in tiers: a column, a bowl (upside-down stairs round it), water in the bowl
//   that spills down (sources at the top, the game makes the falls).
// - Life on the water: lily pads near the rim, a few. Planters or benches round the outside.
// - The fountain off the landing point (players spawn next to it, not in it), on an axis.
// DON'T
// - A square hole of water flush with the floor, with a glowstone or a sea lantern in the middle.
// - A pillar of glass or quartz shooting water, or water falling onto the plaza with no basin.
// - Water everywhere: more than a few small sources makes lag and floods.

import { pavedPatch } from './_scene.mjs'

export function fountain(ctx, [cx, y, cz], { r = 5, rim = 'stone_brick', floor = 'polished_andesite', centre = 'chiseled_stone_bricks', seed = 1 } = {}) {
  const { b, kit } = ctx
  const toward = (dx, dz) => (Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : dz > 0 ? 'north' : 'south') // stairs that face the middle
  for (let dx = -r; dx <= r; dx += 1)
    for (let dz = -r; dz <= r; dz += 1) {
      const d = Math.hypot(dx, dz)
      if (d > r + 0.4) continue
      const [x, z] = [cx + dx, cz + dz]
      if (d > r - 0.6) {
        // the rim: a block with a slab on it, a seat round the basin
        b.set(x, y, z, `minecraft:${rim}s`)
        b.set(x, y + 1, z, `minecraft:${rim}_slab[type=bottom]`)
      } else {
        // the basin: floor 2 down, water up to the rim
        b.set(x, y - 2, z, `minecraft:${floor}`)
        b.set(x, y - 1, z, 'minecraft:water')
        b.set(x, y, z, 'minecraft:water')
        if (d > r - 2.2 && kit.hash01(x, y, z, seed) < 0.12) b.set(x, y + 1, z, 'minecraft:lily_pad')
      }
    }
  // the centre: a column, a bowl round its top (upside-down stairs facing in, top slabs at the
  // corners) with water in it that spills over the edge into the basin, a finial in the middle
  for (let h = -1; h <= 2; h += 1) b.set(cx, y + h, cz, h === 2 ? `minecraft:${centre}` : `minecraft:${rim}s`)
  for (let dx = -1; dx <= 1; dx += 1)
    for (let dz = -1; dz <= 1; dz += 1) {
      if (!dx && !dz) continue
      b.set(cx + dx, y + 2, cz + dz, dx && dz ? `minecraft:${rim}_slab[type=top]` : `minecraft:${rim}_stairs[facing=${toward(dx, dz)},half=top]`)
      b.set(cx + dx, y + 3, cz + dz, 'minecraft:water')
    }
  b.set(cx, y + 3, cz, `minecraft:${rim}_wall`)
  b.set(cx, y + 4, cz, `minecraft:${rim}_wall`)
  b.set(cx, y + 5, cz, 'minecraft:lantern[hanging=false]')
}

export const figure = { size: 16, height: 10, floorY: 4, px: 16 }
export function demo(ctx, which) {
  pavedPatch(ctx, { margin: 0 })
  const { b, FY } = ctx
  if (which === 'good') fountain(ctx, [8, FY, 8], { r: 5 })
  else {
    for (let x = 6; x <= 10; x += 1) for (let z = 6; z <= 10; z += 1) b.set(x, FY, z, 'minecraft:water')
    b.set(8, FY, 8, 'minecraft:sea_lantern')
    for (let h = 1; h <= 3; h += 1) b.set(8, FY + h, 8, 'minecraft:glass')
    b.set(8, FY + 4, 8, 'minecraft:water')
  }
}
