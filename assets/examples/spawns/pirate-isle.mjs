// Tortuga SMP — a hand-built NORMAL spawn on a tropical pirate island, with a WARZONE round it.
// It shows the optional extras together: landmarks (a volcano, a ship, a lighthouse, a parrot
// statue, giant palms), raised areas and rocks, a warzone band behind a red line with a moshpit and a
// KOTH hill, and colourful block-letter section signs.
//
// The interview: normal spawn, 8 NPCs, tropical, accent light blue; boards Money / Kills / Playtime;
// crates Vote / Common / Rare / Legendary; top-3 pillars for Baltop; landmarks volcano, ship,
// lighthouse, statue (parrot); 2 giant palms; raised areas and rocks; a warzone (moshpit + KOTH,
// "Crystal PvP"); signs: colourful, outline yes, thick "Let Claude decide" (→ yes).
//
// The canvas: the spawn square is 180, the warzone band 50 all round → 280 x 280.
//
//    +------------------------------ warzone (PvP on) ------------------------------+
//    |   (moshpit)                                                                   |
//    |     +=================== red line: the spawn square (safe) ==============+    |
//    |     |  VOLCANO          boards + top3            PARROT                  |    |
//    |     |          huts   o  o  o  o  o   huts                               |    |
//    |     | CRATES  palms  o    SPAWN    o  palms                SHIP (in its   |    |
//    |     | (arc)          o  o  o           huts                 bay)         |    |
//    |     |  giant palm       RTP gate        LIGHTHOUSE       giant palm       |    |
//    |     +===================================================================+    |
//    |                                (KOTH hill)                                    |
//    +-------------------------------------------------------------------------------+
//
// Build: node scripts/run-build.mjs assets/examples/spawns/pirate-isle.mjs --out-dir minecraft-builds/pirate-isle

import { startSpawn, finishSpawn, polar, facingToward, findSpot } from '../../spawn-parts/spawn.mjs'
import { buildSite, paveRound, pavePath } from '../../spawn-parts/site.mjs'
import { ringPoints, npcPlinth } from '../../spawn-parts/plaza.mjs'
import { boardsPlaza, crateCourt, top3Pillars } from '../../spawn-parts/features.mjs'
import { building } from '../../spawn-parts/buildings.mjs'
import { bench, lamp, rockOutcrop, landscapePass } from '../../spawn-parts/landscape.mjs'
import { LANDMARKS, landmark, palmTree } from '../../spawn-parts/landmarks.mjs'
import { warzoneBand, moshpit, koth } from '../../spawn-parts/warzone.mjs'
import { signStand } from '../../spawn-parts/signs.mjs'

const NPCS = [
  { id: 'shop', label: 'Shop' }, { id: 'auction', label: 'Auction House' }, { id: 'kits', label: 'Kits' },
  { id: 'store', label: 'Store' }, { id: 'quests', label: 'Quests' }, { id: 'sell', label: 'Sell' },
  { id: 'warps', label: 'Warps' }, { id: 'tutorial', label: 'Start Here' },
]
const BOARDS = [{ id: 'money', label: 'Money' }, { id: 'kills', label: 'Kills' }, { id: 'playtime', label: 'Playtime' }]
const CRATES = [
  { id: 'vote', label: 'Vote', tier: 'vote' }, { id: 'common', label: 'Common', tier: 'common' },
  { id: 'rare', label: 'Rare', tier: 'rare' }, { id: 'legendary', label: 'Legendary', tier: 'legendary' },
]
const SIGNS = { style: 'colorful', outline: true, thick: true }

export default function build(api) {
  const SPAWN = 180 // the safe spawn square
  const W = 50 // the warzone band
  const ctx = startSpawn(api, { name: 'Tortuga SMP', size: SPAWN + 2 * W, height: 110, theme: 'tropical', accent: 'light_blue', setting: 'island', seed: 21 })
  const { b, theme, FY, C, S, grid, rng } = ctx
  const [cx, cz] = C
  const lo = W
  const hi = W + SPAWN - 1
  const spawnSquare = [lo, lo, hi, hi]

  // ================================================================ 1. plan
  // the band is reserved first, so nothing of the spawn spills into it
  grid.reserve(0, 0, S - 1, lo - 3, 'warzone')
  grid.reserve(0, hi + 3, S - 1, S - 1, 'warzone')
  grid.reserve(0, 0, lo - 3, S - 1, 'warzone')
  grid.reserve(hi + 3, 0, S - 1, S - 1, 'warzone')
  const R1 = 12
  const R2 = 22
  const Rp = 34
  ctx.layout.plaza = { cx, cz, r: Rp + 4 }
  grid.reserveDisc(cx, cz, Rp + 4.5, 'plaza')
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const [ax, bx] = dx ? [cx + dx * Rp, cx + dx * (SPAWN / 2 + 2)] : [cx - 4, cx + 4]
    const [az, bz] = dz ? [cz + dz * Rp, cz + dz * (SPAWN / 2 + 2)] : [cz - 4, cz + 4]
    grid.reserve(ax, az, bx, bz, 'road')
  }
  const pads = []
  const padFor = (x0, z0, x1, z1) => pads.push({ x0, z0, x1, z1, y: FY, blend: 5 })

  const mouth = (9 / (2 * Math.PI * R1)) * 180
  const npcSpots = [
    ...ringPoints(ctx, { r: R1, n: 6, skips: [[0, mouth], [90, mouth], [180, mouth], [270, mouth]] }),
    ...ringPoints(ctx, { r: R2, n: 2, skips: [[0, 44], [90, 30], [180, 30], [270, 44]] }),
  ]
  const crates = CRATES.map((crate, i) => {
    const [x, z] = polar(ctx, 270 + (i - 1.5) * ((6 / (Rp - 6)) * (180 / Math.PI)), Rp - 6)
    return { crate, x: Math.round(x), z: Math.round(z), facing: facingToward([x, z], C) }
  })
  // palms in sand beds between the rings, a cluster of three at each, not one per diagonal
  const palmBeds = [50, 140, 220, 310].map(a => polar(ctx, a + rng.range(-8, 8), 17).map(Math.round))

  // the landmarks go first, on the diagonals behind the hut ring (the huts take 42-58 from the
  // middle): in view from the spawn, never on its axis, and on the diagonals the square spawn has
  // the most room (127 to its corners against 90 to its sides)
  const kinds = [['volcano', 315], ['statue', 45], ['ship', 135], ['lighthouse', 225]]
  const marks = []
  for (const [kind, a] of kinds) {
    const r = LANDMARKS[kind].r
    const spot = findSpot(ctx, { r: r + 2, ring: [Rp + 24 + r, Math.max(Rp + 24 + r, 112 - r)], angles: [a, a - 8, a + 8], tag: kind })
    if (!spot) {
      ctx.warn(`no room for the ${kind}`)
      continue
    }
    marks.push({ kind, x: spot.x, z: spot.z, r })
    padFor(spot.x - r, spot.z - r, spot.x + r, spot.z + r)
  }
  // a ring of huts round the street, smaller and looser than a town: tropical spawns are open
  const huts = []
  let a = rng.range(0, 10)
  for (let k = 0; a < 360; k += 1) {
    const kind = k % 4 === 2 ? 'hall' : 'house'
    const [w, d] = kind === 'hall' ? [17, 13] : [11 + 2 * rng.int(0, 1), 9 + 2 * rng.int(0, 1)]
    const R = Rp + 8 + d / 2 + rng.int(0, 3)
    const [x, z] = polar(ctx, a, R)
    const facing = facingToward([x, z], C)
    const [fw, fd] = facing === 'north' || facing === 'south' ? [w, d] : [d, w]
    const s = { kind, x0: Math.round(x - fw / 2), z0: Math.round(z - fd / 2), facing, y: FY, seed: ctx.seed * 13 + k, storeys: kind === 'hall' ? 2 : 1 + rng.int(0, 1) }
    s.x1 = s.x0 + fw - 1
    s.z1 = s.z0 + fd - 1
    if (grid.free(s.x0 - 3, s.z0 - 3, s.x1 + 3, s.z1 + 3)) {
      grid.reserve(s.x0, s.z0, s.x1, s.z1, kind, 2)
      padFor(s.x0, s.z0, s.x1, s.z1)
      huts.push(s)
      a += ((Math.max(w, d) / 2 + 6) / R) * (180 / Math.PI) * 1.7
    } else a += 4
  }
  // two giant palms in the gaps of the hut ring, framing the views out
  for (const a of [160, 250]) {
    const r = LANDMARKS['giant-palm'].r
    const spot = findSpot(ctx, { r: 4, ring: [Rp + 9, Rp + 26], angles: [a, a - 10, a + 10, a - 20, a + 20], tag: 'giant-palm', pad: 1 })
    if (spot) marks.push({ kind: 'giant-palm', x: spot.x, z: spot.z, r })
  }
  // the warzone's pit and hill: the middle of the band, north-west and south
  const pit = { x: Math.round(cx - SPAWN / 4), z: Math.round(lo / 2), r: 12 }
  const hill = { x: Math.round(cx + SPAWN / 6), z: Math.round(hi + W / 2), r: 8 }
  for (const p of [pit, hill]) padFor(p.x - p.r - 2, p.z - p.r - 2, p.x + p.r + 2, p.z + p.r + 2)
  // raised areas and rocks in the free ground that is left inside the spawn square
  const mounds = []
  for (let i = 0; i < 3; i += 1) {
    const r = rng.int(8, 12)
    const s = findSpot(ctx, { r: r + 2, ring: [Rp + 14, SPAWN / 2 + 10], tag: 'mound', pad: 3 })
    if (s) mounds.push({ x: s.x, z: s.z, r, h: rng.int(2, 4) })
  }
  const rocks = []
  for (let i = 0; i < 7; i += 1) {
    const s = findSpot(ctx, { r: 3, ring: [Rp + 10, SPAWN / 2 + 25], tag: 'rock' })
    if (s) rocks.push(s)
  }

  // ================================================================ 2. the site: a rounded-square island
  buildSite(ctx, { shape: 'square', pads, mounds, flat: (x, z) => Math.hypot(x - cx, z - cz) < Rp + 26 })

  // ================================================================ 3. the plaza
  paveRound(ctx, { cx, cz, r: Rp + 4, field: ctx.paint.path, wobble: 1.4 })
  paveRound(ctx, {
    cx, cz, r: Rp, kerb: theme.paving.border, wobble: 0.8,
    rings: [
      { r0: 0, r1: 1.5, paint: 'minecraft:chiseled_quartz_block' },
      { r0: 1.5, r1: 3.5, paint: 'minecraft:smooth_sandstone' },
      { r0: 3.5, r1: 4.6, paint: theme.paving.border },
      { r0: R1 - 1.5, r1: R1 + 1.5, paint: theme.paving.border },
      { r0: R2 - 1.5, r1: R2 + 1.5, paint: theme.paving.inlay },
    ],
  })
  b.spawnPoint([cx, FY, cz], 'north')
  NPCS.forEach((npc, i) => npcPlinth(ctx, npc, [npcSpots[i].x, npcSpots[i].z]))
  for (const [x, z] of palmBeds) {
    // a sand bed with three palms of different heights leaning out
    for (let dx = -3; dx <= 3; dx += 1) for (let dz = -3; dz <= 3; dz += 1) if (Math.hypot(dx, dz) <= 3.2) b.set(x + dx, FY, z + dz, dx * dz % 3 === 0 ? 'minecraft:sand' : 'minecraft:sandstone')
    for (const [ox, oz, h] of [[0, 0, 11], [2, -1, 8], [-1, 2, 7]]) ctx.place(palmTree, [x + ox, FY, z + oz], { height: h + rng.int(0, 2), seed: x * 3 + ox + z })
  }

  // ================================================================ 4. the sections
  ctx.place(boardsPlaza, { cx, z: cz - (Rp - 6), facing: 'south', boards: BOARDS })
  ctx.place(top3Pillars, { x: cx + 20, z: cz - (Rp - 7), facing: facingToward([cx + 20, cz - Rp + 7], C), id: 'baltop', label: 'Baltop' })
  ctx.place(crateCourt, { points: crates.map(c => [c.x, c.z]), facings: crates.map(c => c.facing), crates: crates.map(c => c.crate) })
  b.portal([cx - 2, FY + 1, cz + Rp + 2], [cx + 2, FY + 5, cz + Rp + 2], { ...ctx.M, id: 'rtp', label: 'Random Teleport', kind: 'rtp', facing: 'north' })
  // the colourful section signs, on posts behind the sections, facing the spawn
  ctx.place(signStand, 'CRATES', [cx - Rp + 1, cz], 'east', SIGNS)
  ctx.place(signStand, 'TOP', [cx, cz - Rp + 1], 'south', SIGNS)

  // ================================================================ 5. landmarks and huts
  for (const m of marks) {
    const y = ctx.site.groundY(m.x, m.z)
    ctx.place(landmark, m.kind, { x: m.x, z: m.z, y, seed: m.x + m.z, facing: facingToward([m.x, m.z], C), subject: 'parrot' })
  }
  for (const h of huts) {
    const res = ctx.place(building, h)
    if (!res?.door) continue
    const [dx, dz] = [cx - res.door[0], cz - res.door[2]]
    const len = Math.hypot(dx, dz)
    pavePath(ctx, [[res.door[0], res.door[2]], [cx - (dx / len) * (Rp + 3), cz - (dz / len) * (Rp + 3)]], { width: 3, fray: false })
  }
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) pavePath(ctx, [[cx + dx * (Rp + 4), cz + dz * (Rp + 4)], [cx + dx * (SPAWN / 2 - 4), cz + dz * (SPAWN / 2 - 4)]], { width: 5 })

  // ================================================================ 6. the warzone
  moshpit(ctx, [pit.x, pit.z], { r: pit.r })
  koth(ctx, [hill.x, hill.z])
  warzoneBand(ctx, { spawn: spawnSquare, label: 'Crystal PvP', keepClear: [pit, { ...hill, r: 12 }] })
  b.region('warzone', [0, 0, 0], [S - 1, ctx.H - 1, S - 1], { pvp: 'allow', 'mob-spawning': 'deny', priority: 5 })

  // ================================================================ 7. life
  for (const r of rocks) ctx.place(rockOutcrop, [r.x, ctx.site.groundY(r.x, r.z), r.z], { r: rng.range(1.8, 3), seed: r.x * 5 + r.z })
  for (let i = 0; i < 16; i += 1) {
    const ang = (i / 16) * 360 + 11
    if ([0, 90, 180, 270].some(m => Math.abs(((ang - m + 540) % 360) - 180) > 172)) continue
    const [x, z] = polar(ctx, ang, Rp + 2)
    ctx.place(lamp, [Math.round(x), FY, Math.round(z)], { kind: 'post', seed: i })
  }
  for (const [x, z] of palmBeds) ctx.place(bench, [x + Math.sign(cx - x) * 5, FY, z + Math.sign(cz - z) * 5], facingToward([x, z], C), { length: 3 })
  ctx.place(landscapePass)
  return finishSpawn(ctx, { safeZone: spawnSquare })
}
