// The ground the figures stand on (not an element: just the stage for the do / don't pictures).

// A grass patch with a dirt edge, its top at y (things stand on it at y + 1).
export function groundPatch(ctx, { y = ctx.FY, margin = 1, top = 'minecraft:grass_block' } = {}) {
  const { b, S } = ctx
  for (let x = margin; x < S - margin; x += 1)
    for (let z = margin; z < S - margin; z += 1) {
      b.set(x, y, z, top)
      b.set(x, y - 1, z, 'minecraft:dirt')
      b.set(x, y - 2, z, 'minecraft:dirt')
    }
}

// A plaza floor for the pictures: polished andesite with clumps of andesite and stone.
export function pavedPatch(ctx, opts = {}) {
  groundPatch(ctx, { ...opts, top: ctx.kit.palette({ polished_andesite: 6, andesite: 2, stone: 1 }, { scale: 4, seed: 3 }) })
}
