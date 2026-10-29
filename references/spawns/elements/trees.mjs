// TREES. Read this, look at img/trees.png, then shape your own for the spawn: another height, another
// branch count, the species of the theme. Never the same tree twice in one view.
//
// DO
// - A trunk that flares at the foot (roots running out along the ground) and narrows as it climbs.
// - 3-5 branches leaving the trunk at different heights and directions, rising as they go out.
// - Leaves in clusters at the branch ends and the top, so the crown is lumpy, with gaps you can see
//   sky through, wider than tall for an oak; the trunk shows under it.
// - Three size classes on a spawn (feature, medium, small), in groups, never in a grid.
// - Near the plaza: crowns kept above head height and off NPCs, boards and signs.
// DON'T
// - The lollipop: a one-block pole with a ball of leaves on top.
// - Perfect spheres or cubes of leaves, every tree the same height, trees in a row at equal steps.
// - Coloured wool or concrete as foliage (use leaves; colour comes from the species).

import { groundPatch } from './_scene.mjs'

const AXIS = (dx, dz) => (Math.abs(dx) > Math.abs(dz) ? 'x' : 'z')

// A broadleaf tree. [x, y, z]: y is the ground block level.
export function broadleaf(ctx, [x, y, z], { height = 12, seed = 1, log = 'oak_log', leaves = 'oak_leaves', branches = 4 } = {}) {
  const { b, kit } = ctx
  const rng = kit.rng(seed * 97 + 5)
  const trunkTop = y + Math.round(height * 0.62)
  // the trunk, with roots flaring out at the foot
  for (let yy = y + 1; yy <= trunkTop; yy += 1) b.set(x, yy, z, `minecraft:${log}[axis=y]`)
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const len = rng.int(1, 2)
    for (let k = 1; k <= len; k += 1) b.set(x + dx * k, y + (k === 1 ? 1 : 0), z + dz * k, `minecraft:${log}[axis=${AXIS(dx, dz)}]`)
  }
  // branches: out and up from different heights, each ending in a leaf cluster
  const tips = []
  const a0 = rng.range(0, 360)
  for (let i = 0; i < branches; i += 1) {
    const a = ((a0 + (i * 360) / branches + rng.range(-25, 25)) * Math.PI) / 180
    const [dx, dz] = [Math.cos(a), Math.sin(a)]
    let [bx, by, bz] = [x, y + Math.round(height * rng.range(0.48, 0.62)), z]
    const len = rng.int(2, 3)
    for (let k = 1; k <= len; k += 1) {
      bx = x + Math.round(dx * k)
      bz = z + Math.round(dz * k)
      by += 1
      b.set(bx, by, bz, `minecraft:${log}[axis=${AXIS(dx, dz)}]`)
    }
    tips.push([bx, by + 1, bz, rng.range(2.2, 2.8)])
  }
  // the crown: one mass round the top of the trunk, wider than tall, with the branch clusters
  // bulging out of it; ragged at the edge, with a few gaps
  const leaf = (lx, ly, lz) => {
    if (!b.get(lx, ly, lz)) b.set(lx, ly, lz, `minecraft:${leaves}[persistent=true]`)
  }
  const cy = y + Math.round(height * 0.74)
  const [rx, ry] = [height * 0.34, height * 0.24]
  for (let dx = -Math.ceil(rx + 1); dx <= Math.ceil(rx + 1); dx += 1)
    for (let dy = -Math.ceil(ry + 1); dy <= Math.ceil(ry + 1); dy += 1)
      for (let dz = -Math.ceil(rx + 1); dz <= Math.ceil(rx + 1); dz += 1) {
        const d = Math.hypot(dx / rx, dy / ry, dz / rx)
        if (d > 1 + 0.3 * kit.noise.fbm3(x + dx, cy + dy, z + dz, { scale: 3, seed })) continue
        if (d > 0.85 && kit.hash01(x + dx, cy + dy, z + dz, seed) < 0.3) continue
        leaf(x + dx, cy + dy, z + dz)
      }
  for (const [tx, ty, tz, r] of tips)
    for (let dx = -3; dx <= 3; dx += 1)
      for (let dy = -2; dy <= 2; dy += 1)
        for (let dz = -3; dz <= 3; dz += 1) {
          const d = Math.hypot(dx / r, (dy * 1.4) / r, dz / r)
          if (d > 1 + 0.25 * kit.noise.fbm3(tx + dx, ty + dy, tz + dz, { scale: 3, seed: seed + 1 })) continue
          if (d > 0.8 && kit.hash01(tx + dx, ty + dy, tz + dz, seed + 2) < 0.3) continue
          leaf(tx + dx, ty + dy, tz + dz)
        }
}

// A bush: a low lump of leaves, wider than tall, often with a second species mixed in. Put them at
// the feet of trees, along walls and paths, in twos and threes.
export function bush(ctx, [x, y, z], { r = 2.4, seed = 1, leaves = { oak_leaves: 3, azalea_leaves: 1 } } = {}) {
  const { b, kit } = ctx
  const paint = kit.palette(Object.fromEntries(Object.entries(leaves).map(([k, v]) => [`${k}[persistent=true]`, v])), { scale: 2, seed })
  for (let dx = -3; dx <= 3; dx += 1)
    for (let dy = 0; dy <= 2; dy += 1)
      for (let dz = -3; dz <= 3; dz += 1) {
        const d = Math.hypot(dx / r, (dy * 1.3) / r, dz / r)
        if (d > 1 + 0.3 * kit.noise.fbm3(x + dx, y + dy, z + dz, { scale: 2, seed })) continue
        if (!b.get(x + dx, y + 1 + dy, z + dz)) b.set(x + dx, y + 1 + dy, z + dz, paint)
      }
}

// DON'T: the lollipop
export function lollipop(ctx, [x, y, z], { height = 6 } = {}) {
  const { b } = ctx
  for (let yy = y + 1; yy <= y + height; yy += 1) b.set(x, yy, z, 'minecraft:oak_log[axis=y]')
  for (let dx = -3; dx <= 3; dx += 1)
    for (let dy = -3; dy <= 3; dy += 1)
      for (let dz = -3; dz <= 3; dz += 1) if (Math.hypot(dx, dy, dz) <= 3 && !(dx === 0 && dz === 0 && dy <= 0)) b.set(x + dx, y + height + 2 + dy, z + dz, 'minecraft:oak_leaves[persistent=true]')
}

export const figure = { size: 30, height: 24, floorY: 3, camera: { eye: [15, 6, 36], lookAt: [15, 9, 13], fov: 62 } }
export function demo(ctx, which) {
  groundPatch(ctx)
  const { FY } = ctx
  if (which === 'good') {
    broadleaf(ctx, [10, FY, 12], { height: 14, seed: 3 })
    broadleaf(ctx, [21, FY, 16], { height: 9, seed: 8, branches: 3 })
    bush(ctx, [13, FY, 15], { seed: 2 })
    bush(ctx, [16, FY, 19], { r: 1.8, seed: 5 })
  } else {
    lollipop(ctx, [10, FY, 12])
    lollipop(ctx, [21, FY, 16])
  }
}
