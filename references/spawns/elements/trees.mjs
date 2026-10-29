// TREES. Read this, look at img/trees.png, then shape your own for the spawn: another height, another
// branch count, the species of the theme. Never the same tree twice in one view.
//
// DO
// - Big, thick trees: the everyday tree of a spawn is 14-26 tall with a trunk 2-4 across (bigTree);
//   on a big spawn most trees have trunks 2-5 across, and even a small build gets a trunk 2 across
//   where there is room. The vanilla 1-wide pole reads as small and generated.
// - A trunk that flares at the foot (roots running out along the ground) and narrows as it climbs.
// - 4-7 limbs leaving the trunk at different heights and directions, rising as they go out and
//   forking, so the wood shows inside the crown.
// - Leaves in clusters at the limb ends and the top, so the crown is lumpy, with gaps you can see
//   sky through, wider than tall for an oak; the trunk shows under it.
// - Three size classes on a spawn (feature 20-30, medium 14-20, small 8-12 and bushes), in groups,
//   never in a grid; big trees first, small ones in the gaps.
// - Near the plaza: crowns kept above head height and off NPCs, boards and signs.
// - A landmark (giantTree, img/landmark-trees.png): 25-60 tall, a trunk 3-6 across with buttress
//   roots running out over the ground, 5-7 big limbs that fork 2-3 times, a crown 1-1.5 of its
//   height across, layered, with gaps, its hem drooping. One per view.
// - Autumn: vanilla has no orange leaves, so mix 20-40% orange, red or yellow blocks (honeycomb,
//   orange or red terracotta, shroomlight, nether wart blocks) into part of the crowns, in clumps,
//   with birch and spruce kept as they are.
// DON'T
// - The lollipop: a one-block pole with a ball of leaves on top.
// - Perfect spheres or cubes of leaves, every tree the same height, trees in a row at equal steps.
// - A crown made only of wool, concrete or terracotta.
// - A giant made by scaling the lollipop up: a thick pole with a ball on top.

import { groundPatch } from './_scene.mjs'

// leaves stay where they are put (persistent); a crown may mix in other blocks (autumn wool,
// shroomlight, moss), which have no such state
const leafState = id => (/_leaves$/.test(id.split('[')[0]) ? `${id}[persistent=true]` : id)

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
  const paint = kit.palette(Object.fromEntries(Object.entries(leaves).map(([k, v]) => [leafState(k), v])), { scale: 2, seed })
  for (let dx = -3; dx <= 3; dx += 1)
    for (let dy = 0; dy <= 2; dy += 1)
      for (let dz = -3; dz <= 3; dz += 1) {
        const d = Math.hypot(dx / r, (dy * 1.3) / r, dz / r)
        if (d > 1 + 0.3 * kit.noise.fbm3(x + dx, y + dy, z + dz, { scale: 2, seed })) continue
        if (!b.get(x + dx, y + 1 + dy, z + dz)) b.set(x + dx, y + 1 + dy, z + dz, paint)
      }
}

// A GIANT: the landmark tree of a spawn, 25-40 tall (picture: img/landmark-trees.png).
// species: oak | dark_oak | cherry | jungle | spruce | dead. Every field of a preset is also an option:
//   height, trunk (2-4 across), log ('oak' -> oak_log and oak_wood), stripped, leaves ({ id: weight },
//   clumped; null for a bare tree), shade (the darker leaf under the clusters)
//   fork (where the big limbs leave the trunk, share of the height), limbs (how many), reach (limb
//   length / height), rise ([lowest, highest] limb angle above level, degrees), depth (forks, 3),
//   bow (how much a limb arches up, 0.1), lean (share of the height the trunk leans, 0.06)
//   cluster ([half width, half height] of a leaf cluster), droop (share of the hem that hangs down)
//   roots (how many), buttress (where they leave the trunk, share of the height)
//   vines (share of the outer underside with a vine; 0.2+ also climbs the trunk), cocoa, petals
//   allBark (default true: trunks and limbs of the all-bark wood block, oak_wood...; false: logs)
// and giantTree's own: seed, berries (glow berries under the crown), ground (litter under it; true).
export const GIANTS = {
  oak: { height: 32, trunk: 4, log: 'oak', leaves: { oak_leaves: 6, dark_oak_leaves: 2, azalea_leaves: 1 }, shade: 'spruce_leaves', fork: 0.4, limbs: 7, reach: 0.31, rise: [6, 52], cluster: [4.8, 2.4], droop: 0.3, roots: 7, buttress: 0.08, vines: 0.05 },
  dark_oak: { height: 26, trunk: 4, log: 'dark_oak', leaves: { dark_oak_leaves: 5, oak_leaves: 1 }, shade: 'spruce_leaves', fork: 0.4, limbs: 7, reach: 0.42, rise: [14, 38], cluster: [5, 2.1], droop: 0.4, roots: 8, buttress: 0.1, vines: 0.08 },
  // a cherry: a low fork into a few limbs that spread wide and low, an umbrella crown 1.5-2 times as
  // wide as it is tall, flat clusters, only short tufts hanging from the hem, petals under it
  cherry: { height: 22, trunk: 3, log: 'cherry', leaves: { cherry_leaves: 1 }, fork: 0.26, limbs: 5, reach: 0.58, rise: [16, 34], cluster: [5.6, 1.6], droop: 0.16, roots: 5, buttress: 0.06, lean: 0.1, petals: true },
  jungle: { height: 38, trunk: 4, log: 'jungle', leaves: { jungle_leaves: 4, oak_leaves: 1 }, shade: 'spruce_leaves', fork: 0.6, limbs: 7, reach: 0.3, rise: [12, 36], cluster: [4.6, 2.3], droop: 0.3, roots: 8, buttress: 0.17, vines: 0.3, cocoa: true },
  spruce: { height: 38, trunk: 3, log: 'spruce', leaves: { spruce_leaves: 1 }, conifer: true, roots: 6, buttress: 0.06 },
  dead: { height: 28, trunk: 3, log: 'oak', stripped: true, leaves: null, fork: 0.42, limbs: 5, reach: 0.42, rise: [18, 55], roots: 6, buttress: 0.1 },
  birch: { height: 26, trunk: 2, log: 'birch', leaves: { birch_leaves: 5, oak_leaves: 1 }, fork: 0.6, limbs: 5, reach: 0.22, rise: [38, 66], cluster: [3.4, 2.4], droop: 0.1, roots: 2, buttress: 0.02, lean: 0.015 },
}

// A BIG TREE: the everyday tree of a spawn, 14-26 tall with a trunk 2-4 across: the giant's engine
// (roots, forking limbs, clustered crown) scaled to its height. `trunk` defaults to about a
// seventh of the height (14 -> 2, 21 -> 3, 28 -> 4); any giantTree option overrides.
export function bigTree(ctx, pos, { species = 'oak', height = 18, trunk, seed = 1, ...opts } = {}) {
  const g = GIANTS[species] ?? GIANTS.oak
  const k = Math.min(1, height / g.height) // how much smaller than the giant
  const s = 0.55 + 0.45 * k
  return giantTree(ctx, pos, {
    species,
    seed,
    height,
    trunk: trunk ?? Math.max(2, Math.round(height / 7)),
    ...(g.limbs ? { limbs: Math.max(4, Math.round(g.limbs * (0.7 + 0.3 * k))) } : {}),
    ...(g.cluster ? { cluster: [Math.max(2.8, g.cluster[0] * s), Math.max(1.6, g.cluster[1] * s)] } : {}),
    roots: Math.max(4, Math.round(g.roots * (0.6 + 0.4 * k))),
    droop: (g.droop ?? 0) * k,
    ...(g.reach ? { reach: g.reach * (1 + (1 - k) * 0.3) } : {}),
    ...opts,
  })
}

// [x, y, z]: y is the ground block level (the trunk starts at y + 1 and goes 1 into the ground).
// Returns { tips, crown }: the leaf-cluster centres (a conifer's: its tier centres; hang lanterns or
// swings from them) and the crown's radius (reserve a disc of it).
export function giantTree(ctx, [x, y, z], { species = 'oak', seed = 1, berries = false, ground = true, ...opts } = {}) {
  const { b, kit } = ctx
  // allBark: every trunk and limb cell is the all-bark wood block (oak_wood...), so no log ends with
  // their rings show where the trunk narrows or a limb turns: what big trees are made of
  const o = { depth: 3, lean: 0.06, allBark: true, ...GIANTS[species], ...opts }
  const rng = kit.rng(seed * 131 + 17)
  const H = o.height
  const W = o.trunk
  const log = o.stripped ? `minecraft:stripped_${o.log}_log` : `minecraft:${o.log}_log`
  const bark = o.stripped ? `minecraft:stripped_${o.log}_wood` : `minecraft:${o.log}_wood`
  const leaf = o.leaves && kit.palette(Object.fromEntries(Object.entries(o.leaves).map(([k, v]) => [leafState(`minecraft:${k}`), v])), { scale: 3, seed })
  const inCanvas = (px, py, pz) => px >= 0 && pz >= 0 && py >= 0 && px < ctx.S && pz < ctx.S && py < ctx.H
  const isWood = (px, py, pz) => /_(log|wood)$/.test(b.nameAt(px, py, pz) ?? '')
  const SOIL = /grass_block|dirt|podzol|moss_block|mud/
  // wood never overwrites wood (the trunk keeps its axis where a limb leaves it); it may replace
  // leaves, and soil only where a root is meant to sink into the ground
  const woodCells = []
  const putWood = (px, py, pz, paint, sink = false) => {
    if (!inCanvas(px, py, pz) || isWood(px, py, pz)) return
    const n = b.nameAt(px, py, pz)
    if (n && !/leaves/.test(n) && !(sink && SOIL.test(n))) return
    b.set(px, py, pz, paint)
    woodCells.push([px, py, pz])
  }
  // a log lies along its limb (axis x, y or z); on a true diagonal, where any axis would show end
  // grain, bark all round (wood). (The manual's screenshots draw every log with rings on top,
  // whatever its axis; the game does not.)
  const along = ([tx, ty, tz]) => {
    if (o.allBark) return bark
    const l = Math.hypot(tx, ty, tz) || 1
    const [ax, ay, az] = [Math.abs(tx) / l, Math.abs(ty) / l, Math.abs(tz) / l]
    const m = Math.max(ax, ay, az)
    if (m < 0.8) return bark
    return `${log}[axis=${m === ay ? 'y' : m === ax ? 'x' : 'z'}]`
  }
  // a limb: a quadratic curve a -> c bowed by `bow`, radius r0 -> r1. Under 1 it is a one-block line
  // that stays face to face; from 1 up it is round.
  const limb = (a, c, r0, r1, bow = [0, 0, 0], sink = false) => {
    const m = [(a[0] + c[0]) / 2 + bow[0], (a[1] + c[1]) / 2 + bow[1], (a[2] + c[2]) / 2 + bow[2]]
    const n = Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) * 3) + 1
    let prev = null
    for (let i = 0; i <= n; i += 1) {
      const t = i / n
      const p = [0, 1, 2].map(k => (1 - t) ** 2 * a[k] + 2 * (1 - t) * t * m[k] + t * t * c[k])
      const d = [0, 1, 2].map(k => 2 * (1 - t) * (m[k] - a[k]) + 2 * t * (c[k] - m[k]))
      const paint = along(d)
      const r = r0 + (r1 - r0) * t
      if (r < 1) {
        const cell = p.map(Math.round)
        if (prev) {
          // step one axis at a time from the last cell, so the line never touches only by an edge
          const q = [...prev]
          for (let k = 0; k < 3; k += 1)
            while (q[k] !== cell[k]) {
              q[k] += Math.sign(cell[k] - q[k])
              putWood(q[0], q[1], q[2], paint, sink)
            }
        } else putWood(cell[0], cell[1], cell[2], paint, sink)
        prev = cell
      } else {
        const R = Math.ceil(r)
        for (let dx = -R; dx <= R; dx += 1)
          for (let dy = -R; dy <= R; dy += 1)
            for (let dz = -R; dz <= R; dz += 1) {
              const [cx, cy, cz] = [Math.round(p[0]) + dx, Math.round(p[1]) + dy, Math.round(p[2]) + dz]
              if (Math.hypot(cx - p[0], cy - p[1], cz - p[2]) <= r) putWood(cx, cy, cz, paint, sink)
            }
        prev = p.map(Math.round)
      }
    }
  }
  const dirOf = (az, el) => [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)]
  const D2R = Math.PI / 180

  // 1. the trunk: round (2-4 across), leaning a little, flaring at the foot, narrowing as it climbs
  const c0 = W % 2 === 0 ? 0.5 : 0
  const leanAz = rng.range(0, Math.PI * 2)
  const spine = h => [x + c0 + Math.cos(leanAz) * o.lean * H * (h / H) ** 1.6, y + h, z + c0 + Math.sin(leanAz) * o.lean * H * (h / H) ** 1.6]
  const R0 = W / 2 + 0.1
  const forkH = Math.round(H * (o.fork ?? 0.4))
  const topH = o.conifer ? Math.round(H * 0.96) : forkH + Math.round(H * 0.12) // a broadleaf's trunk ends a little above the fork
  for (let h = 0; h <= topH; h += 1) {
    let r = o.conifer ? R0 * (1 - 0.78 * (h / topH)) + 0.25 : h <= forkH ? R0 * (1 - 0.15 * (h / forkH)) : R0 * 0.85 * (1 - 0.55 * ((h - forkH) / (topH - forkH)))
    r *= 1 + 0.35 * Math.max(0, 1 - h / (H * 0.1)) ** 2 // the flare
    const [sx, , sz] = spine(h)
    const R = Math.ceil(r + 1)
    for (let dx = -R; dx <= R; dx += 1)
      for (let dz = -R; dz <= R; dz += 1) {
        const [px, pz] = [Math.floor(sx) + dx, Math.floor(sz) + dz]
        // bark ridges: the radius wanders round the trunk and up it
        const rr = r + 0.3 * kit.noise.fbm3(px, (y + h) / 3, pz, { scale: 2, octaves: 1, seed: seed + 3 })
        if (Math.hypot(px - sx, pz - sz) <= rr) putWood(px, y + h, pz, o.allBark ? bark : `${log}[axis=y]`, h === 0)
      }
  }

  // 2. buttress roots: they leave the trunk a few blocks up, run down and out, and sink into the
  // ground; the fin under each is filled down to the ground
  const nRoots = o.roots ?? 6
  const a0 = rng.range(0, Math.PI * 2)
  for (let i = 0; i < nRoots; i += 1) {
    const a = a0 + (i * Math.PI * 2) / nRoots + rng.range(-0.3, 0.3)
    const [ux, uz] = [Math.cos(a), Math.sin(a)]
    const hs = Math.max(2, H * o.buttress * rng.range(0.7, 1.25))
    const reach = W * 0.8 + H * 0.14 * rng.range(0.5, 1.3) // long and short ones
    const [sx, , sz] = spine(0)
    const P0 = [sx + ux * R0 * 0.4, y + hs, sz + uz * R0 * 0.4]
    const P2 = [sx + ux * (R0 + reach), y + 0.6, sz + uz * (R0 + reach)]
    const r0 = Math.max(1, W * 0.25 + 0.25)
    // it drops steeply off the trunk, then runs low over the ground, wandering a little sideways
    const side = rng.range(-0.25, 0.25) * reach
    limb(P0, P2, r0, 0.6, [ux * reach * 0.05 - uz * side, -hs * 0.5, uz * reach * 0.05 + ux * side])
    // the fin: from the root down to the ground, one block thick
    for (let s = 0; s <= 1; s += 0.05) {
      const px = Math.round(P0[0] + (P2[0] - P0[0]) * s)
      const pz = Math.round(P0[2] + (P2[2] - P0[2]) * s)
      const top = Math.round(y + hs * (1 - s) ** 2.4)
      for (let yy = y + 1; yy <= top; yy += 1) putWood(px, yy, pz, bark)
    }
    // the tail: on along the ground, half sunk, bending, thinning out
    for (const turn of rng.chance(0.5) ? [-0.45, 0.4] : [rng.range(-0.4, 0.4)]) {
      const b2 = a + turn
      const len = rng.range(3, 7)
      limb([P2[0], y + 1, P2[2]], [P2[0] + Math.cos(b2) * len, y + 0.2, P2[2] + Math.sin(b2) * len], 0.6, 0.5, [0, 0, 0], true)
    }
  }

  const tips = []
  const forks = []
  if (o.conifer) {
    // 3a. a conifer: tiers of drooping branches, wide at the bottom, narrowing to a spire
    const crown0 = Math.round(H * 0.26)
    const Rmax = H * 0.27
    // dead stubs on the bare trunk below
    for (let k = 0; k < 4; k += 1) {
      const az = rng.range(0, Math.PI * 2)
      const h = rng.int(Math.round(H * 0.1), crown0 - 1)
      const [sx, sy, sz] = spine(h)
      limb([sx, sy, sz], [sx + Math.cos(az) * (R0 + rng.range(1, 3)), sy - 0.5, sz + Math.sin(az) * (R0 + rng.range(1, 3))], 0.5, 0.5)
    }
    let yw = crown0
    let tier = 0
    while (yw < topH - 2) {
      const t = (yw - crown0) / (topH - crown0)
      // tiers alternate wide and narrow, like a real spruce's whorls
      const Rw = (Rmax * (1 - t) ** 0.95 + 1.5) * (tier % 2 ? 0.8 : 1.05) * rng.range(0.92, 1.08)
      const [sx, sy, sz] = spine(yw)
      const n = rng.int(6, 8)
      const az0 = rng.range(0, Math.PI * 2)
      for (let k = 0; k < n; k += 1) {
        const az = az0 + (k * Math.PI * 2) / n + rng.range(-0.25, 0.25)
        const L = Rw * rng.range(0.6, 0.8)
        limb([sx, sy, sz], [sx + Math.cos(az) * L, sy - 1 - (L > 6 ? 1 : 0), sz + Math.sin(az) * L], L > 5 ? 1 : 0.6, 0.5, [0, 0.6, 0])
      }
      // the tier's leaves: a ragged disc, a second layer near the trunk, a drooping hem
      const R = Math.ceil(Rw + 2)
      for (let dx = -R; dx <= R; dx += 1)
        for (let dz = -R; dz <= R; dz += 1) {
          const [px, pz] = [Math.round(sx) + dx, Math.round(sz) + dz]
          const d = Math.hypot(px - sx, pz - sz)
          const edge = Rw * (1 + 0.22 * kit.noise.fbm2(Math.atan2(dz, dx) * 2.5, yw * 0.7, { scale: 1.2, seed: seed + 5 }))
          if (d > edge) continue
          const put = yy => inCanvas(px, yy, pz) && !b.get(px, yy, pz) && b.set(px, yy, pz, leaf)
          put(sy)
          if (d < edge * 0.62) put(sy + 1)
          if (d < 1.8) put(sy + 2)
          if (d > edge * 0.55 && kit.noise.coherent01(px, sy, pz, { scale: 2, seed: seed + 6 }) > 0.35) put(sy - 1)
          if (d > edge * 0.8 && kit.hash01(px, sy, pz, seed + 7) < 0.45) put(sy - 2)
        }
      tips.push([sx, sy, sz])
      yw += rng.int(2, 3) + (t < 0.35 ? 1 : 0)
      tier += 1
    }
    const [sx, sy, sz] = spine(topH)
    for (let h = -1; h <= 3; h += 1) {
      const r = h < 1 ? 1.2 : 0.4
      for (let dx = -1; dx <= 1; dx += 1)
        for (let dz = -1; dz <= 1; dz += 1)
          if (Math.hypot(dx, dz) <= r && inCanvas(Math.round(sx) + dx, sy + h, Math.round(sz) + dz) && !b.get(Math.round(sx) + dx, sy + h, Math.round(sz) + dz)) b.set(Math.round(sx) + dx, sy + h, Math.round(sz) + dz, leaf)
    }
  } else {
    // 3b. a broadleaf: big limbs leave the trunk round the fork, staggered, at the golden angle; each
    // forks two or three times, thinning; every last twig ends in a leaf cluster
    const grow = (p, az, el, len, r, depth) => {
      const d = dirOf(az, el)
      const end = [p[0] + d[0] * len, p[1] + d[1] * len, p[2] + d[2] * len]
      // limbs bow up (a cherry's run out flat, then turn up at the end)
      limb(p, end, r, Math.max(0.5, r * 0.82), [0, len * (o.bow ?? 0.1), 0])
      if (depth >= o.depth || r < 0.55) {
        tips.push(end)
        return
      }
      if (depth >= 2) forks.push(end) // a smaller cluster at the fork fills the crown out
      const kids = rng.chance(0.3) ? 3 : 2
      for (let k = 0; k < kids; k += 1) {
        const turn = (k - (kids - 1) / 2) * rng.range(0.55, 0.85) + rng.range(-0.2, 0.2)
        const lift = el + rng.range(-10, 10) * D2R
        grow(end, az + turn, Math.max(0, Math.min(60 * D2R, lift)), len * rng.range(0.6, 0.72), r * 0.8, depth + 1) // never down: the hem droops, not the limbs
      }
    }
    const az0 = rng.range(0, Math.PI * 2)
    for (let i = 0; i < o.limbs; i += 1) {
      const h = forkH - rng.int(0, Math.round(H * 0.14))
      const share = (forkH - h) / (H * 0.14) // lower limbs run flatter
      const el = (o.rise[1] - (o.rise[1] - o.rise[0]) * share + rng.range(-6, 6)) * D2R
      grow(spine(h), az0 + i * 2.39996 + rng.range(-0.25, 0.25), el, H * o.reach * rng.range(0.85, 1.1), R0 * rng.range(0.5, 0.62), 1)
    }
    // the leader: the trunk's top goes on up steeply and forks into the middle of the crown
    grow(spine(topH), az0 + 0.7, rng.range(62, 75) * D2R, H * 0.2, R0 * 0.5, 2)
  }

  // a log shows its rings where its end is open (a trunk narrowing, a limb stepping up): bark there
  const AX = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }
  for (const [px, py, pz] of woodCells) {
    const blk = b.get(px, py, pz)
    const a = AX[blk?.props?.axis]
    if (!blk || !/_log$/.test(blk.name) || !a) continue
    if (!isWood(px + a[0], py + a[1], pz + a[2]) || (!isWood(px - a[0], py - a[1], pz - a[2]) && py - a[1] > y)) b.set(px, py, pz, bark)
  }

  // 4. the crown: a cluster per tip, wider than tall, flat underneath, ragged at the edge, with holes
  // you can see the sky through; darker leaves on the underside where the theme has them
  const placed = []
  let crown = 0
  if (leaf && !o.conifer) {
    const [tx0, , tz0] = spine(0)
    const clusters = [...tips.map(t => [...t, 1]), ...forks.map(t => [...t, 0.55])]
    for (const [i, [cx, cy, cz, k]] of clusters.entries()) {
      const rx = o.cluster[0] * k * rng.range(0.8, 1.15)
      const ry = o.cluster[1] * Math.sqrt(k) * rng.range(0.85, 1.1)
      crown = Math.max(crown, Math.hypot(cx - tx0, cz - tz0) + rx)
      const R = Math.ceil(rx + 1)
      const Ry = Math.ceil(ry + 1)
      for (let dx = -R; dx <= R; dx += 1)
        for (let dy = -Ry; dy <= Ry; dy += 1)
          for (let dz = -R; dz <= R; dz += 1) {
            const [px, py, pz] = [Math.round(cx) + dx, Math.round(cy + 0.6) + dy, Math.round(cz) + dz]
            const ddy = py - (cy + 0.6)
            if (ddy < -ry * 0.55) continue // flat underneath
            const d = Math.hypot((px - cx) / rx, ddy / ry, (pz - cz) / rx)
            if (d > 1 + 0.28 * kit.noise.fbm3(px, py, pz, { scale: 3, seed: seed + i })) continue
            if (d > 0.4 && kit.noise.coherent01(px, py, pz, { scale: 2.5, seed: seed + 9 }) < 0.2) continue // holes
            if (!inCanvas(px, py, pz) || b.get(px, py, pz)) continue
            const under = o.shade && ddy < -0.3 && kit.noise.coherent01(px, py, pz, { scale: 3, seed: seed + 10 }) > 0.55
            b.set(px, py, pz, under ? leafState(`minecraft:${o.shade}`) : leaf)
            placed.push([px, py, pz])
          }
    }
    // the hem droops: on the outer part of the crown, leaves hang 1-3 below the underside, in clumps
    for (const [px, py, pz] of placed) {
      if (b.get(px, py - 1, pz) || Math.hypot(px - tx0, pz - tz0) < crown * 0.5) continue
      if (kit.noise.coherent01(px, py, pz, { scale: 2.5, seed: seed + 11 }) > o.droop) continue
      const n = 1 + Math.floor(kit.hash01(px, py, pz, seed + 12) * 3)
      // tufts stop 3 above the ground, so a small tree's hem never stands on it like legs
      for (let k = 1; k <= n && py - k > y + 3 && inCanvas(px, py - k, pz) && !b.get(px, py - k, pz); k += 1) b.set(px, py - k, pz, leaf)
    }
  }
  if (o.conifer) crown = H * 0.27 + 1.5

  // 5. what hangs: vines from the sides of the outer leaves; glow berries from the underside
  if (leaf && (o.vines || berries)) {
    const [tx0, , tz0] = spine(0)
    for (const [px, py, pz] of placed) {
      if (b.get(px, py - 1, pz) || Math.hypot(px - tx0, pz - tz0) < crown * 0.35) continue
      const r = kit.hash01(px, py, pz, seed + 13)
      if (o.vines && r < o.vines * 0.5) {
        const [dx, dz, face] = [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'north'], [0, -1, 'south']][Math.floor(kit.hash01(px, 0, pz, seed) * 4)]
        const len = 2 + Math.floor(kit.hash01(px, py, pz, seed + 14) * 8)
        for (let k = 0; k < len; k += 1) {
          const [vx, vy, vz] = [px + dx, py - k, pz + dz]
          if (!inCanvas(vx, vy, vz) || b.get(vx, vy, vz) || vy <= y + 1) break
          b.set(vx, vy, vz, `minecraft:vine[${face}=true]`)
        }
      } else if (berries && r > 0.97) {
        const len = 1 + Math.floor(kit.hash01(px, py, pz, seed + 15) * 4)
        for (let k = 1; k <= len; k += 1) {
          if (!inCanvas(px, py - k, pz) || b.get(px, py - k, pz) || py - k <= y + 1) break
          const last = k === len || b.get(px, py - k - 1, pz)
          b.set(px, py - k, pz, last ? 'minecraft:cave_vines[age=25,berries=true]' : `minecraft:cave_vines_plant[berries=${k % 2 === 0}]`)
          if (last) break
        }
      }
    }
  }
  // vines up the trunk and cocoa pods on it (jungle)
  if (o.cocoa || (o.vines ?? 0) >= 0.2)
    for (let h = 2; h < forkH; h += 1)
      // face: the side of this cell the trunk is on (a vine hangs on it, a cocoa pod faces it)
      for (const [dx, dz, face] of [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'north'], [0, -1, 'south']]) {
        const [sx, , sz] = spine(h)
        // walk out from the trunk's middle to its surface on this side
        let k = 0
        while (k < 4 && isWood(Math.round(sx) + dx * (k + 1), y + h, Math.round(sz) + dz * (k + 1))) k += 1
        const [px, pz] = [Math.round(sx) + dx * (k + 1), Math.round(sz) + dz * (k + 1)]
        if (!inCanvas(px, y + h, pz) || b.get(px, y + h, pz) || !isWood(px - dx, y + h, pz - dz)) continue
        const r = kit.hash01(px, y + h, pz, seed + 16)
        if (o.cocoa && r < 0.04) b.set(px, y + h, pz, `minecraft:cocoa[age=2,facing=${face}]`)
        else if (kit.noise.coherent01(px, y + h, pz, { scale: 3, seed: seed + 17 }) > 0.62) b.set(px, y + h, pz, `minecraft:vine[${face}=true]`)
      }

  // 6. the ground under it: litter in clumps (podzol, coarse and rooted dirt, moss), ferns; petals
  // under a cherry
  if (ground) {
    const [tx0, , tz0] = spine(0)
    const Rg = Math.max(6, crown * 0.8)
    const litter = kit.palette({ grass_block: 4, podzol: 3, coarse_dirt: 2, rooted_dirt: 1, moss_block: 2 }, { scale: 2.5, seed: seed + 18 })
    for (let dx = -Math.ceil(Rg); dx <= Math.ceil(Rg); dx += 1)
      for (let dz = -Math.ceil(Rg); dz <= Math.ceil(Rg); dz += 1) {
        const [px, pz] = [Math.round(tx0) + dx, Math.round(tz0) + dz]
        if (!inCanvas(px, y + 1, pz) || b.nameAt(px, y, pz) !== 'minecraft:grass_block' || b.get(px, y + 1, pz)) continue
        const e = Math.hypot(dx, dz) / Rg
        if (e > 1 || kit.noise.coherent01(px, 0, pz, { scale: 3, seed: seed + 19 }) < e * 0.8) continue
        if (!o.petals) b.set(px, y, pz, litter)
        const r = kit.hash01(px, y, pz, seed + 20)
        const top = b.nameAt(px, y, pz)
        if (o.petals && r < 0.55) b.set(px, y + 1, pz, `minecraft:pink_petals[facing=${['north', 'east', 'south', 'west'][Math.floor(r * 40) % 4]},flower_amount=${1 + (Math.floor(r * 400) % 4)}]`)
        else if (/grass_block|podzol/.test(top) && r < 0.18) b.set(px, y + 1, pz, r < 0.08 ? 'minecraft:fern' : 'minecraft:short_grass')
        else if (/moss_block/.test(top) && r < 0.3) b.set(px, y + 1, pz, 'minecraft:moss_carpet')
      }
  }
  return { tips, crown: Math.round(crown) }
}

// DON'T: the lollipop
export function lollipop(ctx, [x, y, z], { height = 6 } = {}) {
  const { b } = ctx
  for (let yy = y + 1; yy <= y + height; yy += 1) b.set(x, yy, z, 'minecraft:oak_log[axis=y]')
  for (let dx = -3; dx <= 3; dx += 1)
    for (let dy = -3; dy <= 3; dy += 1)
      for (let dz = -3; dz <= 3; dz += 1) if (Math.hypot(dx, dy, dz) <= 3 && !(dx === 0 && dz === 0 && dy <= 0)) b.set(x + dx, y + height + 2 + dy, z + dz, 'minecraft:oak_leaves[persistent=true]')
}

export const figure = { size: 60, height: 44, floorY: 3, camera: { eye: [30, 10, 82], lookAt: [30, 14, 26], fov: 60 } }
export function demo(ctx, which) {
  groundPatch(ctx)
  const { FY } = ctx
  if (which === 'good') {
    // three sizes of big tree, each its own, a bush at their feet
    bigTree(ctx, [17, FY, 22], { species: 'oak', height: 22, seed: 3 })
    bigTree(ctx, [40, FY, 18], { species: 'oak', height: 17, trunk: 2, seed: 8 })
    bigTree(ctx, [33, FY, 36], { species: 'birch', height: 15, seed: 4 })
    broadleaf(ctx, [8, FY, 38], { height: 9, seed: 6, branches: 3 })
    bush(ctx, [24, FY, 34], { seed: 2 })
    bush(ctx, [46, FY, 32], { r: 1.8, seed: 5 })
  } else {
    lollipop(ctx, [12, FY, 22])
    lollipop(ctx, [28, FY, 22])
    lollipop(ctx, [44, FY, 22])
  }
}
