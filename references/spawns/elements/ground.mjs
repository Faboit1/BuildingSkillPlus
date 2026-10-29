// GROUND, PLANTING AND PATHS. Read this, look at img/ground.png, then pick your own mix for the theme.
//
// DO
// - One main ground block (grass) with 2-3 others in clumps a few blocks across (coarse dirt, moss,
//   podzol), from coherent noise: patches, not dots.
// - Flowers in drifts: one or two species per patch, many of the same together, grass round them.
// - Walks 3-5 wide that follow the ground, with frayed edges (the edge cells sometimes grass).
// DON'T
// - Per-block random speckle of five ground blocks (it reads as noise, from any distance).
// - Flowers one per block in rows or a rainbow of every colour.
// - A 1-wide line of gravel ruled straight across the grass.

import { groundPatch } from './_scene.mjs'

// natural ground: the main block with clumps of others (weights), on columns you choose
export function naturalGround(ctx, cells, { y = ctx.FY, mix = { grass_block: 8, coarse_dirt: 1, moss_block: 1, podzol: 1 }, seed = 1 } = {}) {
  const { b, kit } = ctx
  const ground = kit.palette(mix, { scale: 5, seed }) // scale = the clump size in blocks
  for (const [x, z] of cells) b.set(x, y, z, ground)
}

// flower drifts and grass on the grass blocks of an area
export function plantDrifts(ctx, [x0, z0, x1, z1], { y = ctx.FY, flowers = ['dandelion', 'poppy', 'cornflower'], seed = 1 } = {}) {
  const { b, kit } = ctx
  for (let x = x0; x <= x1; x += 1)
    for (let z = z0; z <= z1; z += 1) {
      if (b.nameAt(x, y, z) !== 'minecraft:grass_block' || b.get(x, y + 1, z)) continue
      // which species grows here: a slow noise picks one per patch
      const patch = kit.noise.coherent01(x, 0, z, { scale: 9, seed: seed + 3 })
      const dense = kit.noise.coherent01(x, 0, z, { scale: 3, seed: seed + 7 })
      const h = kit.hash01(x, y, z, seed)
      if (dense > 0.63 && h < 0.8) b.set(x, y + 1, z, `minecraft:${flowers[Math.floor(patch * flowers.length) % flowers.length]}`)
      else if (h < 0.22) b.set(x, y + 1, z, 'minecraft:short_grass')
    }
}

// a walk along points, frayed at the edges, following the ground at y
export function walk(ctx, points, { y = ctx.FY, width = 4, seed = 1 } = {}) {
  const { b, kit } = ctx
  const field = kit.palette({ dirt_path: 5, coarse_dirt: 2, gravel: 1 }, { scale: 3, seed })
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) * 2)
    for (let s = 0; s <= steps; s += 1) {
      const px = ax + ((bx - ax) * s) / steps
      const pz = az + ((bz - az) * s) / steps
      for (let dx = -width; dx <= width; dx += 1)
        for (let dz = -width; dz <= width; dz += 1) {
          const d = Math.hypot(dx, dz)
          const x = Math.round(px + dx)
          const z = Math.round(pz + dz)
          if (d > width / 2 + 0.3) continue
          if (d > width / 2 - 0.7 && kit.hash01(x, y, z, seed) < 0.45) continue // frayed edge
          b.set(x, y, z, field)
          if (b.get(x, y + 1, z)) b.remove(x, y + 1, z)
        }
    }
  }
}

export const figure = { size: 24, height: 10, floorY: 3, camera: { eye: [12, 11, 30], lookAt: [12, 3, 11], fov: 62 } }
export function demo(ctx, which) {
  groundPatch(ctx)
  const { b, FY, S, kit } = ctx
  const cells = []
  for (let x = 1; x < S - 1; x += 1) for (let z = 1; z < S - 1; z += 1) cells.push([x, z])
  if (which === 'good') {
    naturalGround(ctx, cells, { seed: 2 })
    walk(ctx, [[3, 18], [9, 14], [15, 13], [20, 9]], { width: 4, seed: 2 })
    plantDrifts(ctx, [1, 1, S - 2, S - 2], { seed: 5 })
  } else {
    const kinds = ['grass_block', 'dirt', 'coarse_dirt', 'podzol', 'moss_block', 'sand']
    const flowers = ['poppy', 'dandelion', 'blue_orchid', 'allium', 'azure_bluet', 'cornflower']
    for (const [x, z] of cells) b.set(x, FY, z, `minecraft:${kinds[Math.floor(kit.hash01(x, 0, z, 9) * kinds.length)]}`)
    for (let x = 2; x < S - 2; x += 3) for (let z = 2; z < S - 2; z += 3) if (b.nameAt(x, FY, z) !== 'minecraft:sand') b.set(x, FY + 1, z, `minecraft:${flowers[(x + z) % flowers.length]}`)
    for (let x = 1; x < S - 1; x += 1) b.set(x, FY, 12, 'minecraft:gravel')
  }
}
