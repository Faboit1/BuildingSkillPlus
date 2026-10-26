// Kirin Practice — a hand-built PVP LOBBY: compact, every game one glance away. Japanese theme,
// accent red, 112 x 112, 6 queue NPCs, 3 leaderboards with top-3 pillars either side, 2 crates.
//
//                 boards + podium     [top3]
//         [top3]   . o  o  o  o  o  o .            o = queue NPC on a pedestal, an arc of 150
//                        (dais)                         degrees facing the spawn dais
//    crates yard         SPAWN          pavilion (store / kits)   tower
//                          |
//                   FFA arena (south, behind its red line)
//
// The numbers (references/spawns/build-guide.md §5): the NPC arc radius Rn grows with the count so
// the NPCs stay 7 apart along it (Rn = max(11, 7N x 180 / (pi x 150)) = 11 for 6); the plaza
// radius Rp = Rn + 5; the leaderboards 5 behind the plaza rim; the arena starts 4 past the rim. The
// players spawn on a raised dais facing north, straight at the queue NPCs.
//
// Build: node scripts/run-build.mjs assets/examples/spawns/kirin-practice.mjs --out-dir minecraft-builds/kirin-practice

import { startSpawn, finishSpawn, polar, facingToward, yawToward } from '../../spawn-parts/spawn.mjs'
import { buildSite, paveRound, pavePath } from '../../spawn-parts/site.mjs'
import { grassBed } from '../../spawn-parts/plaza.mjs'
import { boardsPlaza, crateYard, top3Pillars } from '../../spawn-parts/features.mjs'
import { building } from '../../spawn-parts/buildings.mjs'
import { bench, featureTree, hedge, lamp, pvpArena, landscapePass } from '../../spawn-parts/landscape.mjs'

const NPCS = [
  { id: 'unranked', label: 'Unranked' }, { id: 'ranked', label: 'Ranked' }, { id: 'ffa', label: 'FFA' },
  { id: 'kits', label: 'Kit Editor' }, { id: 'events', label: 'Events' }, { id: 'duels', label: 'Duels' },
]
const BOARDS = [{ id: 'elo', label: 'Elo' }, { id: 'wins', label: 'Wins' }, { id: 'streak', label: 'Streak' }]
const CRATES = [{ id: 'vote', label: 'Vote', tier: 'vote' }, { id: 'rare', label: 'Rare', tier: 'rare' }]
const TOP3 = [{ id: 'elo-top', label: 'Top Elo' }, { id: 'kills-top', label: 'Top Killers' }]

export default function build(api) {
  const ctx = startSpawn(api, { name: 'Kirin Practice', size: 112, height: 90, theme: 'japanese', accent: 'red', setting: 'island', seed: 3 })
  const { b, kit, theme, FY, C, S, grid, rng, M } = ctx
  const [cx, cz] = C

  // ================================================================ 1. plan
  const ARC = 150
  const N = NPCS.length
  const Rn = Math.max(11, Math.ceil((7 * N * 180) / (Math.PI * ARC))) // the NPC arc
  const Rp = Rn + 5 // the plaza
  const islandR = S / 2 - 3
  ctx.layout.plaza = { cx, cz, r: Rp }
  grid.reserveDisc(cx, cz, Rp + 1.5, 'plaza')
  const pads = []
  const slot = (s, pad = 1) => {
    grid.reserve(s.x0, s.z0, s.x1, s.z1, s.kind, pad)
    pads.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, y: FY, blend: 5 })
    return s
  }
  // the arc, evenly from -75 to +75 degrees round north; the middle places go to the main queues
  const arc = NPCS.map((_, i) => {
    const ang = -ARC / 2 + (ARC * i) / (N - 1)
    const [x, z] = polar(ctx, ang, Rn)
    return { ang, x: Math.round(x), z: Math.round(z) }
  }).sort((p, q) => Math.abs(p.ang) - Math.abs(q.ang))
  // the boards 5 behind the plaza rim, north; their plaza is as wide as the row
  const heroW = Math.max(BOARDS.length * 7 + 6, 20)
  const hz = cz - Rp - 5
  const hero = slot({ kind: 'hero', x0: cx - heroW / 2, x1: cx + heroW / 2, z0: hz - 3, z1: hz + 5 })
  // the FFA arena south, the crates west, a pavilion (store / kits corner) and a tower east
  const aw = Math.max(20, Math.min(34, Math.round(islandR - Rp - 8)))
  const arena = slot({ kind: 'pvp', x0: cx - Math.floor(aw / 2), x1: cx + Math.ceil(aw / 2), z0: cz + Rp + 4, z1: Math.min(S - 6, cz + Rp + 4 + aw), y: FY, entrance: 'north' }, 2)
  const crates = slot({ kind: 'crates', x0: cx - Rp - 14, x1: cx - Rp - 3, z0: cz - 5, z1: cz + 11, y: FY, facing: 'east' })
  const pavilion = slot({ kind: 'pavilion', x0: cx + Rp + 4, x1: cx + Rp + 14, z0: cz - 2, z1: cz + 8, y: FY, facing: 'west', seed: ctx.seed + 3 }, 2)
  const tower = slot({ kind: 'tower', x0: cx + Rp + 18, x1: cx + Rp + 24, z0: cz - 12, z1: cz - 6, y: FY, facing: 'west', seed: ctx.seed + 4 }, 2)
  // trees on the plaza rim between the features (south-west, south-east, east, west-south-west)
  const trees = [215, 145, 120, 240].map((a, i) => {
    const [x, z] = polar(ctx, a + rng.range(-6, 6), Rp + 4)
    grid.reserveDisc(x, z, 4.5, 'tree')
    return { x: Math.round(x), z: Math.round(z), seed: ctx.seed + i }
  })

  // ================================================================ 2. the site
  buildSite(ctx, { pads, flat: (x, z) => Math.abs(x - cx) <= 4 && z > cz && z < arena.z0 + 2 })

  // ================================================================ 3. the plaza and the dais
  paveRound(ctx, {
    cx, cz, r: Rp, kerb: theme.paving.border,
    rings: [{ r0: 5.5, r1: 6.5, paint: theme.paving.inlay }, { r0: Rn - 2.6, r1: Rn + 2.6, paint: theme.paving.border }],
  })
  // the spawn dais: a round step 1 high, radius 4, a stair skirt all round, the rose on top
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
  // queue NPCs on pedestals (a bigger set than a plinth: fewer NPCs, each a destination)
  NPCS.forEach((npc, i) => {
    const { x, z } = arc[i]
    const rec = b.npcSpot([x, FY + 1, z], facingToward([x, z], C), { ...M, ...npc, style: 'pedestal', size: 3, screen: true })
    rec.yaw = yawToward([x, z], C)
  })

  // ================================================================ 4. boards, top 3, arena, crates, buildings
  for (let x = hero.x0; x <= hero.x1; x += 1) for (let z = hero.z0; z <= hero.z1; z += 1) b.set(x, FY, z, (x + z) % 7 === 0 ? theme.paving.inlay : ctx.paint.field)
  ctx.place(boardsPlaza, { cx, z: hz, facing: 'south', boards: BOARDS })
  TOP3.forEach((t, i) => ctx.place(top3Pillars, { x: cx + (i === 0 ? -1 : 1) * (heroW / 2 + 8), z: hz, facing: 'south', id: t.id, label: t.label }))
  ctx.place(pvpArena, arena)
  b.region('ffa', [arena.x0, FY - 2, arena.z0], [arena.x1, FY + 20, arena.z1], { pvp: 'allow', priority: 20 })
  ctx.place(crateYard, { ...crates, crates: CRATES }, { hedge, lamp })
  ctx.place(building, { ...pavilion, kind: 'pavilion' })
  ctx.place(building, { ...tower, kind: 'tower' })
  for (const t of trees) {
    grassBed(ctx, t.x, t.z, 2)
    ctx.place(featureTree, [t.x, FY, t.z], { size: 'medium', seed: t.seed })
  }
  // walks: the dais to the arena gate, to the crates, to the pavilion
  pavePath(ctx, [[cx, cz + Rp - 1], [cx, arena.z0 - 1]], { width: 5 })
  pavePath(ctx, [[cx - Rp + 1, crates.z0 + 6], [crates.x1 + 1, crates.z0 + 6]], { width: 5 })
  pavePath(ctx, [[cx + Rp - 1, cz + 3], [pavilion.x0 - 1, cz + 3]], { width: 4 })
  for (const a of [100, 260, 160, 200]) {
    const [x, z] = polar(ctx, a, Rp - 1.5)
    ctx.place(lamp, [Math.round(x), FY, Math.round(z)], { kind: 'post' })
  }
  for (const a of [125, 235]) {
    const [x, z] = polar(ctx, a, Rn - 1)
    ctx.place(bench, [Math.round(x), FY, Math.round(z)], facingToward([x, z], C), { length: 3 })
  }

  ctx.place(landscapePass)
  return finishSpawn(ctx)
}
