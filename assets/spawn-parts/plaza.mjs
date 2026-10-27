// Plaza pieces for a FreshSMP-style normal spawn (the autumn reference): NPCs on 1-block plinths in
// rings round the spawn, trees in grass beds in the paving.
//
//   ringPoints(ctx, { r: 12, n: 8, skips: [[0, 21], [90, 21], [180, 21], [270, 21]] })
//       n points spread evenly over a ring of radius r round ctx.C, leaving out the skipped sectors
//       ([centre angle, half width] in degrees, 0 = north): path mouths, the boards, the crates.
//       Sorted so the first points are nearest north (the way players face): give them the main NPCs.
//   npcPlinth(ctx, npc, [x, z], { lookAt })   a plinth with a stair skirt, the NPC recorded on it
//   grassBed(ctx, x, z, r)                    a grass-and-dirt bed in the paving with a slab rim
//
// Numbers that work (from real spawns): NPCs 5-7 apart along the ring, the inner ring at radius
// 11-13 from the spawn, the next ring 9-12 further out, path mouths 9 wide.

import { facingToward, polar, yawToward } from './spawn.mjs'

export function ringPoints(ctx, { r, n, skips = [] }) {
  if (!n) return []
  // the free arcs between the skipped sectors
  const edges = skips.map(([c, h]) => [c - h, c + h]).sort((p, q) => p[0] - q[0])
  const arcs = []
  if (!edges.length) arcs.push([0, 360])
  for (let i = 0; i < edges.length; i += 1) {
    const from = edges[i][1]
    let to = edges[(i + 1) % edges.length][0]
    if (to <= from) to += 360
    arcs.push([from, to])
  }
  const total = arcs.reduce((s, [p, q]) => s + q - p, 0)
  const out = []
  for (let i = 0; i < n; i += 1) {
    let t = ((i + 0.5) / n) * total
    for (const [p, q] of arcs) {
      if (t <= q - p) {
        const ang = (p + t) % 360
        const [x, z] = polar(ctx, ang, r)
        out.push({ ang, x: Math.round(x), z: Math.round(z) })
        break
      }
      t -= q - p
    }
  }
  return out.sort((p, q) => Math.min(p.ang, 360 - p.ang) - Math.min(q.ang, 360 - q.ang))
}

// The NPC stands on a 1-block plinth (theme.plinth, quartz by default) with a stair skirt on the three
// sides away from the reader, facing `lookAt` (the spawn by default). The hologram over it (name,
// "click me") comes from setup.md. npc = { id, label, role }.
export function npcPlinth(ctx, npc, [x, z], { y = ctx.FY, lookAt = ctx.C, block, skirt = true } = {}) {
  const { b, kit, theme, M } = ctx
  const trim = kit.material(theme.trim)
  b.set(x, y + 1, z, block ?? theme.plinth)
  const face = facingToward([x, z], lookAt)
  if (skirt && trim.stairs)
    for (const [dx, dz, f] of [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']]) {
      if (f === kit.opposite(face)) continue
      b.set(x + dx, y + 1, z + dz, `${trim.stairs}[facing=${kit.opposite(f)}]`)
    }
  const rec = b.npcSpot([x, y + 1, z], face, { ...M, ...npc, style: 'none' })
  rec.yaw = yawToward([x, z], lookAt)
  return rec
}

// A grass bed in the paving for a plaza tree: grass with a few coarse-dirt patches, the rim a step of
// the trim slab on the border block (like the reference: the trees grow out of grass patches).
export function grassBed(ctx, x, z, r, { y = ctx.FY } = {}) {
  const { b, theme, kit } = ctx
  const trim = kit.material(theme.trim)
  const ground = ctx.paint.ground
  for (let dx = -r - 1; dx <= r + 1; dx += 1)
    for (let dz = -r - 1; dz <= r + 1; dz += 1) {
      const d = Math.hypot(dx, dz) + 0.5 * kit.noise.fbm2(x + dx, z + dz, { scale: 3, seed: 9 })
      if (d <= r - 0.3) {
        b.set(x + dx, y, z + dz, kit.hash01(x + dx, 3, z + dz, 5) < 0.25 ? 'minecraft:coarse_dirt' : ground)
        b.remove(x + dx, y + 1, z + dz)
        if (ctx.site) ctx.site.paved[x + dx + ctx.S * (z + dz)] = 0
      } else if (d <= r + 0.7) {
        b.set(x + dx, y, z + dz, theme.paving.border)
        b.set(x + dx, y + 1, z + dz, trim.slab ? `${trim.slab}[type=bottom]` : theme.paving.border)
      }
    }
}
