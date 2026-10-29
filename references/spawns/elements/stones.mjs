// STONES AND ROCKS. Read this, look at img/stones.png, then write your own for the spawn you are
// building: change the sizes, the stone mix and the grouping every time.
//
// DO
// - Groups, not singles: one big stone with one or two small ones leaning on it, and a few loose
//   bits round them. Odd numbers, uneven sizes (big 1, medium 0.6, small 0.35).
// - Irregular shapes: an ellipsoid pushed in and out by noise, wider than tall, a flatter top.
// - Sunk into the ground by a block: a stone grows out of the ground, it was never dropped on it.
// - A clumped mix of 3-4 grey stones (stone, andesite, cobblestone, tuff), more of the main one.
// - Moss where rain lands: on the faces that look up, in patches, not everywhere.
// - Plants at the foot (grass, ferns): they soften the line where the stone meets the ground.
// DON'T
// - A sphere of one block sitting on the grass (it touches at one point and looks dropped).
// - Per-block random speckle of five materials (noise, not stone).
// - The same rock copied in a row or a ring.
// - Stones on paving the players walk on, in a doorway, or in front of an NPC.

import { groundPatch } from './_scene.mjs'

// One boulder. [x, y, z]: y is the ground block level. r = [rx, ry, rz] its half sizes.
export function boulder(ctx, [x, y, z], { r = [3, 2, 2.5], seed = 1, moss = 0.45 } = {}) {
  const { b, kit } = ctx
  const [rx, ry, rz] = r
  const stone = kit.palette({ stone: 5, andesite: 3, cobblestone: 1, tuff: 1 }, { scale: 2, seed })
  const placed = []
  for (let dx = -Math.ceil(rx + 1); dx <= Math.ceil(rx + 1); dx += 1)
    for (let dy = -1; dy <= Math.ceil(ry + 1); dy += 1)
      for (let dz = -Math.ceil(rz + 1); dz <= Math.ceil(rz + 1); dz += 1) {
        // the shape: an ellipsoid whose surface the noise pushes in and out by up to a third
        const top = dy > ry * 0.6 ? 1.15 : 1 // a flatter top
        const d = (dx / rx) ** 2 + ((dy * top) / ry) ** 2 + (dz / rz) ** 2
        const wobble = 0.4 * kit.noise.fbm3(x + dx, y + dy, z + dz, { scale: 4, seed })
        if (d > 1 + wobble) continue
        b.set(x + dx, y + 1 + dy, z + dz, stone) // dy = -1 is one block into the ground
        placed.push([x + dx, y + 1 + dy, z + dz])
      }
  // moss on the cells that look up, in patches
  for (const [px, py, pz] of placed) {
    if (b.get(px, py + 1, pz)) continue
    if (kit.noise.coherent01(px, py, pz, { scale: 2.5, seed: seed + 9 }) < 1 - moss) continue
    b.set(px, py, pz, 'minecraft:moss_block')
    if (kit.hash01(px, py, pz, seed) < 0.3) b.set(px, py + 1, pz, 'minecraft:moss_carpet')
  }
  return placed.length
}

// A group: the big stone, two smaller ones leaning on it, loose bits and plants round the foot.
export function rockGroup(ctx, [x, y, z], { size = 3, seed = 1 } = {}) {
  const { b, kit } = ctx
  boulder(ctx, [x, y, z], { r: [size, size * 1.05, size * 0.8], seed })
  boulder(ctx, [x + Math.round(size * 1.2), y, z + Math.round(size * 0.5)], { r: [size * 0.6, size * 0.5, size * 0.55], seed: seed + 1 })
  boulder(ctx, [x - Math.round(size * 0.8), y, z + Math.round(size * 1.0)], { r: [size * 0.38, size * 0.32, size * 0.4], seed: seed + 2, moss: 0.2 })
  // loose bits and plants on the free ground round it
  for (let dx = -size - 3; dx <= size + 4; dx += 1)
    for (let dz = -size - 3; dz <= size + 4; dz += 1) {
      const px = x + dx
      const pz = z + dz
      if (b.get(px, y + 1, pz) || !/grass_block/.test(b.nameAt(px, y, pz) ?? '')) continue
      const h = kit.hash01(px, y, pz, seed + 5)
      const near = Math.hypot(dx / (size + 2), dz / (size + 2)) < 1.2
      if (!near) continue
      if (h < 0.05) b.set(px, y + 1, pz, kit.hash01(px, 1, pz, seed) < 0.5 ? 'minecraft:cobblestone_slab[type=bottom]' : 'minecraft:mossy_cobblestone_slab[type=bottom]')
      else if (h < 0.3) b.set(px, y + 1, pz, 'minecraft:short_grass')
      else if (h < 0.4) b.set(px, y + 1, pz, 'minecraft:fern')
    }
}

// DON'T: a sphere of one block put on top of the grass
export function rockBad(ctx, [x, y, z], { r = 2.6 } = {}) {
  const { b } = ctx
  const cy = y + 1 + r
  for (let dx = -3; dx <= 3; dx += 1)
    for (let dy = -3; dy <= 3; dy += 1)
      for (let dz = -3; dz <= 3; dz += 1) if (Math.hypot(dx, dy, dz) <= r) b.set(x + dx, Math.round(cy + dy), z + dz, 'minecraft:cobblestone')
}

export const figure = { size: 22, height: 16, floorY: 3, px: 10 }
export function demo(ctx, which) {
  groundPatch(ctx)
  const { FY } = ctx
  if (which === 'good') rockGroup(ctx, [9, FY, 9], { size: 4, seed: 4 })
  else {
    rockBad(ctx, [7, FY, 8])
    rockBad(ctx, [14, FY, 13])
  }
}
