// A REFERENCE SPAWN, for reading: how a whole spawn fits together (the plan, the reservations, the
// order of work). New spawns do not start from it: they start from the skeleton, and each of their
// elements is designed for that server (references/spawns/build-guide.md).
//
// Kirin Practice — a PVP LOBBY: compact, every game one glance away. Its layout follows a BRIEF
// block (the NPC arc widens with the count), with a CUSTOM block for additions.
//
//                 boards + podium     [top3]
//         [top3]   . o  o  o  o  o  o .            o = queue NPC on a pedestal, an arc of 150
//                        (dais)                         degrees facing the spawn dais
//    crates yard         SPAWN          pavilion (store / kits)   tower
//                          |
//                   FFA arena (south, behind its red line)
//
// The numbers (references/spawns/build-guide.md §6.3): the arc radius Rn grows with the count so the
// NPCs stay 7 apart (Rn = max(11, 7N x 180 / (pi x 150))); the plaza Rp = Rn + 5; the boards 5 behind
// the plaza rim; the arena starts 4 past the rim; canvas = 2 x (Rp + 36). Players spawn on a raised
// dais facing north, straight at the queue NPCs.
//
// Build: node scripts/run-build.mjs assets/examples/spawns/kirin-practice.mjs --out-dir minecraft-builds/kirin-practice

import { startSpawn, finishSpawn, polar, facingToward, yawToward, findSpot } from '../../spawn-parts/spawn.mjs'
import { buildSite, paveRound, paveRect, pavePath } from '../../spawn-parts/site.mjs'
import { grassBed } from '../../spawn-parts/plaza.mjs'
import { boardsPlaza, crateYard, top3Pillars } from '../../spawn-parts/features.mjs'
import { building } from '../../spawn-parts/buildings.mjs'
import { bench, bushAt, clutter, featureTree, plantTree, fountain, well, stall, planter, hedge, lamp, pvpArena, rockOutcrop, stoneLantern, bambooClump, torii, landscapePass } from '../../spawn-parts/landscape.mjs'
import { LANDMARKS, landmark, palmTree } from '../../spawn-parts/landmarks.mjs'
import { snowfall, leafLitter } from '../../spawn-parts/seasons.mjs'
import { buildExtras, extrasRoom, planGround, planLandmarks } from '../../spawn-parts/extras.mjs'
import { signStand, signStyle } from '../../spawn-parts/signs.mjs'

// ================================================================== the brief (edit this block)
const BRIEF = {
  name: 'Kirin Practice',
  theme: 'japanese', // autumn, medieval, white-town, japanese, winter, fantasy, crimson, tropical
  accent: 'red',
  setting: 'island',
  seed: 3,
  size: null, // null = recommended for the program
  npcs: [
    { id: 'unranked', label: 'Unranked' }, { id: 'ranked', label: 'Ranked' }, { id: 'ffa', label: 'FFA' },
    { id: 'kits', label: 'Kit Editor' }, { id: 'events', label: 'Events' }, { id: 'duels', label: 'Duels' },
  ],
  boards: [{ id: 'elo', label: 'Elo' }, { id: 'wins', label: 'Wins' }, { id: 'streak', label: 'Streak' }],
  crates: [{ id: 'vote', label: 'Vote', tier: 'vote' }, { id: 'rare', label: 'Rare', tier: 'rare' }],
  top3: [{ id: 'elo-top', label: 'Top Elo' }, { id: 'kills-top', label: 'Top Killers' }], // 0-2 pillar sets beside the boards
  landmarks: [],
  bigTrees: 0,
  terraces: 2,
  rocks: 4,
  signs: null, // e.g. { style: 'colorful', outline: true, thick: true } → a LEADERBOARDS title; null = holograms only
}

// ================================================================== your additions (edit these)
// Everything this server gets beyond the base layout goes here, so the layout above keeps working when
// the BRIEF changes. Every part is imported at the top. L is the plan (all build coordinates):
//   L.cx, L.cz      the spawn column (the dais; players spawn on it facing north)   L.FY  the plaza floor
//   L.S             the canvas side      L.islandR  the shore's distance from the middle
//   L.Rn, L.Rp      the NPC arc's and the plaza's radius   L.arc  the NPC places
//   L.hero (the boards' area), L.arena, L.crates, L.pavilion, L.tower, L.trees   the planned places
//   L.slot({ x0, z0, x1, z1, kind }, pad)   reserve a rectangle and level a pad under it (plan only)
const CUSTOM = {
  // 1. while planning, after the lobby's places and before the landmarks and the raised areas:
  //    reserve the ground of each piece (findSpot or L.slot) and return what you planned
  plan(ctx, L) {
    return {}
  },
  // 2. build your pieces, after the base layout's own and before the landscape pass
  build(ctx, L, mine) {},
  // 3. after the landscape pass: seasonal passes (snowfall, leafLitter) and last touches
  finish(ctx, L, mine) {},
}

const ARC = 150 // degrees of the NPC arc, centred on north

export default function build(api) {
  const B = BRIEF
  const N = B.npcs.length
  const Rn = Math.max(11, Math.ceil((7 * Math.max(N, 1) * 180) / (Math.PI * ARC))) // the NPC arc
  const Rp = Rn + 5 // the plaza
  const kinds = [...B.landmarks, ...Array.from({ length: B.bigTrees }, () => ([B.theme, B.theme?.base].includes('tropical') ? 'giant-palm' : 'giant-tree'))]
  const big = extrasRoom(kinds)
  const recommended = Math.ceil((2 * Math.max(Rp + 36, big ? Rp + 16 + 2 * big : 0)) / 4) * 4
  const size = Math.max(60, Math.min(160, B.size ?? recommended))
  const ctx = startSpawn(api, { name: B.name, size, height: 90, theme: B.theme, accent: B.accent, setting: B.setting, seed: B.seed })
  const { b, kit, theme, FY, C, S, grid, rng, M } = ctx
  const [cx, cz] = C

  // ================================================================ 1. plan
  const islandR = S / 2 - 3
  if (Rp + 30 > islandR) ctx.warn(`a PvP lobby with ${N} queue NPCs wants a size of about ${2 * (Rp + 34)}`)
  ctx.layout.plaza = { cx, cz, r: Rp }
  grid.reserveDisc(cx, cz, Rp + 1.5, 'plaza')
  const pads = []
  const slot = (s, pad = 1) => {
    grid.reserve(s.x0, s.z0, s.x1, s.z1, s.kind, pad)
    pads.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, y: FY, blend: 5 })
    return s
  }
  const inside = (s, r) => [[s.x0, s.z0], [s.x1, s.z0], [s.x0, s.z1], [s.x1, s.z1]].every(([x, z]) => Math.hypot(x - cx, z - cz) < r)
  // the arc, evenly from -75 to +75 degrees round north; the middle places go to the first NPCs
  const arc = B.npcs.map((_, i) => {
    const ang = N === 1 ? 0 : -ARC / 2 + (ARC * i) / (N - 1)
    const [x, z] = polar(ctx, ang, Rn)
    return { ang, x: Math.round(x), z: Math.round(z) }
  }).sort((p, q) => Math.abs(p.ang) - Math.abs(q.ang))
  // the boards 5 behind the plaza rim, north; their plaza is as wide as the row
  const heroW = Math.max(B.boards.length * 7 + 6, 20)
  const hz = cz - Rp - 5
  const hero = slot({ kind: 'hero', x0: cx - Math.ceil(heroW / 2), x1: cx + Math.ceil(heroW / 2), z0: hz - 3, z1: hz + 5 })
  // the FFA arena south, the crates west, a pavilion (store / kits corner) and a tower east
  const aw = Math.max(20, Math.min(34, Math.round(islandR - Rp - 8)))
  const az0 = cz + Rp + 4
  const arena = slot({ kind: 'pvp', x0: cx - Math.floor(aw / 2), x1: cx + Math.ceil(aw / 2), z0: az0, z1: Math.min(S - 6, az0 + aw), y: FY, entrance: 'north' }, 2)
  let crates = null
  if (B.crates.length) {
    const len = Math.max(15, B.crates.length * 5 + 7)
    const x1 = cx - Rp - 3
    crates = slot({ kind: 'crates', x0: x1 - 11, x1, z0: cz - Math.floor(len / 2) + 3, z1: cz - Math.floor(len / 2) + 2 + len, y: FY, facing: 'east' })
  }
  const ex0 = cx + Rp + 4
  const pavilion = slot({ kind: 'pavilion', x0: ex0, x1: ex0 + 10, z0: cz - 2, z1: cz + 8, y: FY, facing: 'west', seed: ctx.seed + 3 }, 2)
  const towerSpot = { kind: 'tower', x0: ex0 + 14, x1: ex0 + 20, z0: cz - 12, z1: cz - 6, y: FY, facing: 'west', seed: ctx.seed + 4 }
  const tower = inside(towerSpot, islandR - 4) ? slot(towerSpot, 2) : null
  // trees on the plaza rim between the features
  const trees = [215, 145, 120, 240].map((a, i) => {
    const [x, z] = polar(ctx, a + rng.range(-6, 6), Rp + 4)
    grid.reserveDisc(x, z, 4.5, 'tree')
    return { x: Math.round(x), z: Math.round(z), seed: ctx.seed + i }
  })
  // your pieces (CUSTOM.plan), before the landmarks and the raised areas
  const L = { cx, cz, FY, S, islandR, Rn, Rp, arc, hero, arena, crates, pavilion, tower, trees, pads, slot }
  const mine = CUSTOM.plan(ctx, L) ?? {}
  const landmarks = planLandmarks(ctx, { kinds, ring: Rp + 10, islandR })
  for (const m of landmarks) pads.push({ x0: m.x - m.r, z0: m.z - m.r, x1: m.x + m.r, z1: m.z + m.r, y: FY, blend: 5 })
  const ground = planGround(ctx, { terraces: B.terraces, rocks: B.rocks, islandR, inner: Rp + 6 })

  // ================================================================ 2. the site
  buildSite(ctx, { pads, mounds: ground.mounds, flat: (x, z) => Math.abs(x - cx) <= 4 && z > cz && z < arena.z0 + 2 })

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
  B.npcs.forEach((npc, i) => {
    const { x, z } = arc[i]
    const rec = b.npcSpot([x, FY + 1, z], facingToward([x, z], C), { ...M, ...npc, style: 'pedestal', size: 3, screen: true })
    rec.yaw = yawToward([x, z], C)
  })

  // ================================================================ 4. boards, top 3, arena, crates, buildings
  B.top3.slice(0, 2).forEach((t, i) => ctx.place(top3Pillars, { x: cx + (i === 0 ? -1 : 1) * (Math.ceil(heroW / 2) + 8), z: hz, facing: 'south', id: t.id, label: t.label }))
  if (B.boards.length) {
    for (let x = hero.x0; x <= hero.x1; x += 1) for (let z = hero.z0; z <= hero.z1; z += 1) b.set(x, FY, z, (x + z) % 7 === 0 ? theme.paving.inlay : ctx.paint.field)
    ctx.place(boardsPlaza, { cx, z: hz, facing: 'south', boards: B.boards })
    // a title no wider than the board row (LEADERBOARDS is 40+ blocks in big letters)
    if (B.signs) ctx.place(signStand, signStyle(ctx, 'LEADERBOARDS', B.signs).width <= heroW + 6 ? 'LEADERBOARDS' : 'TOP', [cx, hero.z0 - 2], 'south', B.signs)
  }
  ctx.place(pvpArena, arena)
  b.region('ffa', [arena.x0, FY - 2, arena.z0], [arena.x1, FY + 20, arena.z1], { pvp: 'allow', priority: 20 })
  if (crates) ctx.place(crateYard, { ...crates, crates: B.crates }, { hedge, lamp })
  ctx.place(building, { ...pavilion, kind: 'pavilion' })
  if (tower) ctx.place(building, { ...tower, kind: 'tower' })
  for (const t of trees) {
    grassBed(ctx, t.x, t.z, 2)
    ctx.place(featureTree, [t.x, FY, t.z], { size: 'medium', seed: t.seed })
  }
  buildExtras(ctx, { landmarks, rocks: ground.rocks, mounds: ground.mounds })
  // walks: the dais to the arena gate, to the crates, to the pavilion
  pavePath(ctx, [[cx, cz + Rp - 1], [cx, arena.z0 - 1]], { width: 5 })
  if (crates) pavePath(ctx, [[cx - Rp + 1, crates.z0 + 6], [crates.x1 + 1, crates.z0 + 6]], { width: 5 })
  pavePath(ctx, [[cx + Rp - 1, cz + 3], [pavilion.x0 - 1, cz + 3]], { width: 4 })
  for (const a of [100, 260, 160, 200]) {
    const [x, z] = polar(ctx, a, Rp - 1.5)
    ctx.place(lamp, [Math.round(x), FY, Math.round(z)], { kind: 'post' })
  }
  for (const a of [125, 235]) {
    const [x, z] = polar(ctx, a, Rn - 1)
    ctx.place(bench, [Math.round(x), FY, Math.round(z)], facingToward([x, z], C), { length: 3 })
  }

  CUSTOM.build(ctx, L, mine)
  ctx.place(landscapePass)
  CUSTOM.finish(ctx, L, mine)
  return finishSpawn(ctx)
}
