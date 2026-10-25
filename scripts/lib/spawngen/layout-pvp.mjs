// PvP lobby: compact and readable, every game one glance away.
//
//   players spawn on a raised round dais facing north
//   north   the queue NPCs on pedestals in an arc, all facing the dais; behind them the hero wall
//           (leaderboards + the server name)
//   south   the FFA arena behind a red line (pvp allowed), entered from the north
//   west    the crates hall (if any crates)
//   east    a pavilion with a store/kits corner, a tower behind it
// The rest of the island is landscaped; the theme dresses the gates (torii for japanese).

import { building, crateHall, heroWall } from './buildings.mjs'
import { bench, featureTree, lamp, pvpArena } from './landscape.mjs'
import { paveRound, pavePath } from './site.mjs'
import { facingToward, polar, yawToward } from './index.mjs'
import { treeBed } from './layout-normal.mjs'

const ARC = 150 // degrees of the NPC arc, centred on north
export const arcOf = N => {
  const Rn = Math.max(11, Math.ceil((7 * Math.max(N, 1) * 180) / (Math.PI * ARC)))
  return { Rn, Rp: Rn + 5 }
}
export const recommendSize = brief => 2 * (arcOf(brief.npcs.length).Rp + 34)

export function plan(ctx) {
  const { brief, S, FY, C, grid, rng } = ctx
  const [cx, cz] = C
  const N = brief.npcs.length
  const arc = ARC
  const { Rn, Rp } = arcOf(N)
  const islandR = S / 2 - 3
  if (Rp + 30 > islandR) ctx.warn(`a PvP lobby with ${N} queue NPCs wants a size of about ${2 * (Rp + 34)}`)
  const L = { type: 'pvp', plaza: { cx, cz, r: Rp }, Rn, Rp, islandR, pads: [], slots: [], spawn: [cx, FY + 1, cz] }
  grid.reserveDisc(cx, cz, Rp + 1.5, 'plaza')
  const reserve = (s, pad = 1) => {
    grid.reserve(s.x0, s.z0, s.x1, s.z1, s.kind, pad)
    L.slots.push(s)
    return s
  }
  // the NPC arc
  L.npcRing = brief.npcs.map((npc, i) => {
    const a = N === 1 ? 0 : -arc / 2 + (arc * i) / (N - 1)
    const [x, z] = polar(ctx, a, Rn)
    return { npc, ang: a, x: Math.round(x), z: Math.round(z) }
  })
  // order so the first NPCs (unranked, ranked) stand in the middle of the arc
  const mid = [...L.npcRing].sort((p, q) => Math.abs(p.ang) - Math.abs(q.ang))
  brief.npcs.forEach((npc, i) => { mid[i].npc = npc })
  // hero wall behind the arc
  const nb = Math.max(1, brief.leaderboards.length)
  const heroW = Math.max(nb * 9 + (nb - 1) * 3 + 14, 30)
  const hz = cz - Rp - 6
  L.hero = reserve({ kind: 'hero', x0: cx - Math.ceil(heroW / 2), x1: cx + Math.ceil(heroW / 2), z0: hz - 9, z1: hz + 3, y: FY, cx, z: hz, width: heroW })
  // the arena to the south
  const aw = Math.max(20, Math.min(34, Math.round(islandR - Rp - 8)))
  const az0 = cz + Rp + 4
  L.pvp = reserve({ kind: 'pvp', x0: cx - Math.floor(aw / 2), x1: cx + Math.ceil(aw / 2), z0: az0, z1: Math.min(S - 6, az0 + aw), y: FY, entrance: 'north' }, 2)
  // crates west, the store pavilion and a tower east
  const nc = brief.crates.length
  if (nc) {
    const len = Math.max(15, nc * 5 + 7)
    const x1 = cx - Rp - 3
    L.crates = reserve({ kind: 'crates', x0: x1 - 11, x1, z0: cz - Math.floor(len / 2) + 3, z1: cz - Math.floor(len / 2) + 2 + len, y: FY, facing: 'east' })
  }
  const ex0 = cx + Rp + 4
  L.pavilion = reserve({ kind: 'pavilion', x0: ex0, x1: ex0 + 10, z0: cz - 2, z1: cz + 8, y: FY, facing: 'west', seed: ctx.seed + 3 }, 2)
  L.tower = reserve({ kind: 'tower', x0: ex0 + 14, x1: ex0 + 20, z0: cz - 12, z1: cz - 6, y: FY, facing: 'west', seed: ctx.seed + 4 }, 2)
  if (!inside(ctx, L.tower, islandR - 4)) {
    L.slots = L.slots.filter(s => s !== L.tower)
    L.tower = null
  }
  // trees on the plaza's rim between the features
  L.trees = [215, 145, 120, 240].map((a, i) => {
    const [x, z] = polar(ctx, a + rng.range(-6, 6), Rp + 4)
    grid.reserveDisc(x, z, 4.5, 'tree')
    return { x: Math.round(x), z: Math.round(z), seed: ctx.seed + i }
  })
  for (const s of L.slots) L.pads.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, y: s.y, blend: 5 })
  L.flat = (x, z) => Math.abs(x - cx) <= 4 && z > cz && z < L.pvp.z0 + 2
  return L
}

function inside(ctx, s, r) {
  const [cx, cz] = ctx.C
  return [[s.x0, s.z0], [s.x1, s.z0], [s.x0, s.z1], [s.x1, s.z1]].every(([x, z]) => Math.hypot(x - cx, z - cz) < r)
}

export function build(ctx) {
  const { b, kit, theme, brief, FY, C, layout: L, M } = ctx
  const [cx, cz] = C
  const { Rn, Rp } = L
  paveRound(ctx, {
    cx, cz, r: Rp,
    kerb: theme.paving.border,
    rings: [
      { r0: 5.5, r1: 6.5, paint: theme.paving.inlay },
      { r0: Rn - 2.6, r1: Rn + 2.6, paint: theme.paving.border },
    ],
  })
  // the spawn dais: a round step 1 high, radius 4, stair skirt all round, the rose on top
  const trim = kit.material(theme.trim)
  for (let dx = -5; dx <= 5; dx += 1)
    for (let dz = -5; dz <= 5; dz += 1) {
      const d = Math.hypot(dx, dz)
      if (d <= 3.6) {
        b.set(cx + dx, FY + 1, cz + dz, d < 1.5 ? 'minecraft:chiseled_quartz_block' : d < 2.6 ? 'minecraft:smooth_quartz' : theme.paving.border)
        b.set(cx + dx, FY, cz + dz, theme.paving.border)
      } else if (d <= 4.6 && trim.stairs) {
        const f = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : (dz > 0 ? 'north' : 'south')
        b.set(cx + dx, FY + 1, cz + dz, `${trim.stairs}[facing=${f}]`)
      }
    }
  b.spawnPoint([cx, FY + 1, cz], 'north')
  // queue NPCs on pedestals facing the dais
  for (const { npc, x, z } of L.npcRing) {
    const face = facingToward([x, z], C)
    const rec = b.npcSpot([x, FY + 1, z], face, { ...M, ...npc, style: 'pedestal', size: 3, screen: true })
    rec.yaw = yawToward([x, z], C)
  }
  ctx.place(heroWall, { ...L.hero, facing: 'south', boards: brief.leaderboards, name: brief.features.signs ? brief.name : null })
  ctx.place(pvpArena, L.pvp)
  if (L.crates) ctx.place(crateHall, { ...L.crates, crates: brief.crates })
  ctx.place(building, { ...L.pavilion, kind: 'pavilion' })
  if (L.tower) ctx.place(building, { ...L.tower, kind: 'tower' })
  for (const t of L.trees) {
    treeBed(ctx, t.x, t.z, 2)
    ctx.place(featureTree, [t.x, FY, t.z], { size: 'medium', seed: t.seed })
  }
  // walks: the dais to the arena gate, to the crates, to the pavilion
  pavePath(ctx, [[cx, cz + Rp - 1], [cx, L.pvp.z0 - 1]], { width: 5 })
  if (L.crates) pavePath(ctx, [[cx - Rp + 1, L.crates.z0 + 6], [L.crates.x1 + 1, L.crates.z0 + 6]], { width: 5 })
  pavePath(ctx, [[cx + Rp - 1, cz + 3], [L.pavilion.x0 - 1, cz + 3]], { width: 4 })
  for (const a of [100, 260, 160, 200]) {
    const [x, z] = polar(ctx, a, Rp - 1.5)
    ctx.place(lamp, [Math.round(x), FY, Math.round(z)], { kind: 'post' })
  }
  for (const a of [125, 235]) {
    const [x, z] = polar(ctx, a, Rn - 1)
    ctx.place(bench, [Math.round(x), FY, Math.round(z)], facingToward([x, z], C), { length: 3 })
  }
}
