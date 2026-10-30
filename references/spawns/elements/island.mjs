// THE ISLAND: THE LAND THE SPAWN STANDS ON. Read this, look at img/island.png, then shape your own:
// another outline, another depth, the theme's ground and rock (snow and stone, sand and sandstone...).
// Most spawns are pasted into a void or the sky, so the island's edge and underside are seen.
//
// DO
// - An outline that wanders (a radius pushed in and out by noise), never a circle or a square.
// - Flat where people walk (the plaza and the town level), rolling a little further out, and a soft
//   shore that drops 1-3 blocks at the rim.
// - An underside that tapers to a ragged point, deepest under the middle (half to two thirds of the
//   island's radius), in bands of rock (strata) under a few blocks of soil.
// - A few roots hanging from the rim: they say "floating" better than any shape.
// DON'T
// - A cylinder: a vertical dirt wall and a flat bottom.
// - A perfect cone, or the same depth everywhere.
// - Noise hills all over the walking area (players want flat ground where the NPCs are).

// Build the island and return groundY(x, z): the walking surface's block level there (-1 off it).
export function island(ctx, { cx, cz, r, y = ctx.FY, depth = Math.min(Math.round(r * 0.75), y - 4), seed = 1, flat = 0.55, top = 'grass_block', soil = { dirt: 4, coarse_dirt: 1 }, rock = { stone: 6, andesite: 2, tuff: 1 } }) {
  const { b, kit } = ctx
  const soilPaint = kit.palette(soil, { scale: 3, seed })
  const rockPaint = kit.palette(rock, { scale: 3, seed: seed + 1 })
  const heights = new Map()
  for (let dx = -Math.ceil(r * 1.3); dx <= Math.ceil(r * 1.3); dx += 1)
    for (let dz = -Math.ceil(r * 1.3); dz <= Math.ceil(r * 1.3); dz += 1) {
      const x = cx + dx
      const z = cz + dz
      // the outline: the radius in this direction, pushed in and out by a slow noise
      const ang = Math.atan2(dz, dx)
      const R = r * (1 + 0.16 * kit.noise.fbm2(Math.cos(ang) * 3 + seed, Math.sin(ang) * 3, { scale: 1.2, seed }))
      const e = Math.hypot(dx, dz) / R // 0 in the middle, 1 at the shore
      if (e > 1) continue
      // the top: flat in the middle, a little roll further out, the shore dropping at the rim
      const roll = e < flat ? 0 : Math.round(1.6 * kit.noise.fbm2(x, z, { scale: 9, seed }) * (e - flat) / (1 - flat))
      const shore = e > 0.86 ? Math.round(((e - 0.86) / 0.14) * 2) : 0
      const t = y + Math.max(0, roll) - shore
      // the underside: deepest in the middle, tapering, ragged
      const d = Math.max(2, Math.round(depth * (1 - e ** 1.6) * (0.8 + 0.4 * (0.5 + kit.noise.fbm2(x, z, { scale: 5, seed: seed + 2 })))))
      const soilDepth = 2 + Math.round(kit.hash01(x, 0, z, seed) * 1.5)
      const strata = Math.round(2 * kit.noise.fbm2(x, z, { scale: 7, seed: seed + 4 })) // per column, not per block
      for (let yy = t - d; yy <= t; yy += 1) {
        const below = t - yy
        if (below === 0) b.set(x, yy, z, `minecraft:${top}`)
        else if (below <= soilDepth) b.set(x, yy, z, soilPaint)
        // strata: bands of rock that wander with the noise
        else b.set(x, yy, z, (yy + strata) % 5 === 0 ? 'minecraft:andesite' : rockPaint)
      }
      // roots hanging from the rim's underside
      if (e > 0.55 && kit.hash01(x, 7, z, seed) < 0.06) b.set(x, t - d - 1, z, 'minecraft:hanging_roots')
      heights.set(x + 100000 * z, t)
    }
  return (x, z) => heights.get(x + 100000 * z) ?? -1
}

// DON'T: a cylinder of dirt with a flat bottom
export function cylinder(ctx, { cx, cz, r, y = ctx.FY, depth = 4 }) {
  const { b } = ctx
  for (let dx = -r; dx <= r; dx += 1)
    for (let dz = -r; dz <= r; dz += 1) {
      if (Math.hypot(dx, dz) > r) continue
      for (let yy = y - depth; yy <= y; yy += 1) b.set(cx + dx, yy, cz + dz, yy === y ? 'minecraft:grass_block' : 'minecraft:dirt')
    }
}

export const figure = { size: 40, height: 36, floorY: 24, camera: { eye: [20, 18, 58], lookAt: [20, 18, 20], fov: 58 } }
export function demo(ctx, which) {
  const [cx, cz] = [20, 20]
  if (which === 'good') island(ctx, { cx, cz, r: 14, seed: 6 })
  else cylinder(ctx, { cx, cz, r: 14 })
}
