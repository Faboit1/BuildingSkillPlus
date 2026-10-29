// PAVING: THE PLAZA FLOOR. Read this, look at img/paving.png, then design the floor of your plaza:
// your own field, border and inlay for the theme, rings or a grid that fit its shape.
//
// DO
// - One field material for 70% or more of the floor, in 2-3 close shades clumped together
//   (polished andesite with some andesite and stone): it reads as one floor.
// - Borders and inlays of a contrasting block every 7-12 blocks, as rings round the spawn or lines
//   that point at the exits: they give the floor structure and lead the eye.
// - A rose (a small figure of the best stone) where players land, a kerb where the plaza ends.
// - Or a grid: a warm field (mud bricks and packed mud, or bricks and granite) with darker lines
//   every 8-12 blocks and a lighter band on the axes leading to the middle (gridPlaza).
// DON'T
// - Per-block random speckle of six stones, or a checkerboard over the whole floor (a patterned
//   medallion on the spawn dais is fine): busy from close, noise from far.
// - One flat block over a huge area with nothing in it.
// - Dotted or scattered inlay blocks: few, long, continuous lines read as design.

import { groundPatch } from './_scene.mjs'

// A round plaza centred on [cx, cz] at level y: the field, a rose, rings, inlay lines to the exits.
export function roundPlaza(ctx, { cx, cz, r, y = ctx.FY, field = { polished_andesite: 6, andesite: 2, stone: 1 }, border = 'stone_bricks', inlay = 'polished_deepslate', rose = 'chiseled_stone_bricks', seed = 1 }) {
  const { b, kit } = ctx
  const paint = kit.palette(field, { scale: 4, seed })
  const id = s => (s.includes(':') ? s : `minecraft:${s}`)
  for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx += 1)
    for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz += 1) {
      const d = Math.hypot(dx, dz)
      if (d > r + 0.5) continue
      const x = cx + dx
      const z = cz + dz
      let block = paint
      if (d <= 1.5) block = id(rose) // where players land
      else if (d > 3.4 && d <= 4.5) block = id(border) // a ring round the rose
      else if (d > r - 0.6) block = id(border) // the kerb
      else if (d > r - 3.6 && d <= r - 2.6) block = id(inlay) // an inner ring near the edge
      else if ((Math.abs(dx) <= 0 || Math.abs(dz) <= 0) && d > 4.5 && d < r - 3.6) block = id(inlay) // lines to the exits
      b.set(x, y, z, block)
    }
}

// A square plaza on a grid (the warm brick look of many big servers): a field in close shades,
// lines of a darker block every `cell` blocks from the middle, a lighter band 3 wide on the two
// axes (the ways in) and a kerb of the line block. [x0, z0, x1, z1] inclusive, around [cx, cz].
export function gridPlaza(ctx, { x0, z0, x1, z1, cx = Math.round((x0 + x1) / 2), cz = Math.round((z0 + z1) / 2), y = ctx.FY, field = { mud_bricks: 6, packed_mud: 1 }, line = 'brown_terracotta', band = 'polished_granite', cell = 10, seed = 1 }) {
  const { b, kit } = ctx
  const paint = kit.palette(field, { scale: 4, seed })
  const id = s => (s.includes(':') ? s : `minecraft:${s}`)
  for (let x = x0; x <= x1; x += 1)
    for (let z = z0; z <= z1; z += 1) {
      const dx = x - cx
      const dz = z - cz
      let block = paint
      if (x === x0 || x === x1 || z === z0 || z === z1) block = id(line) // the kerb
      else if (Math.abs(dx) <= 1 || Math.abs(dz) <= 1) block = id(band) // the axes
      else if (dx % cell === 0 || dz % cell === 0) block = id(line) // the grid
      b.set(x, y, z, block)
    }
}

export const figure = { size: 26, height: 8, floorY: 2, px: 10 }
export function demo(ctx, which) {
  groundPatch(ctx)
  const { b, kit, FY } = ctx
  const [cx, cz] = [13, 13]
  if (which === 'good') roundPlaza(ctx, { cx, cz, r: 11, seed: 3 })
  else {
    const kinds = ['andesite', 'diorite', 'granite', 'cobblestone', 'gravel', 'stone', 'polished_blackstone']
    for (let dx = -11; dx <= 11; dx += 1)
      for (let dz = -11; dz <= 11; dz += 1) if (Math.hypot(dx, dz) <= 11.5) b.set(cx + dx, FY, cz + dz, `minecraft:${kinds[Math.floor(kit.hash01(cx + dx, 0, cz + dz, 4) * kinds.length)]}`)
  }
}
