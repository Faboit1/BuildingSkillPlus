// Ember SMP — a hand-built NORMAL spawn (FreshSMP-style), autumn theme, 220 x 220.
//
// What the user asked for (the interview):
//   type normal, 10 NPCs, autumn, accent orange, leaderboards Money / Kills / Playtime,
//   crates Vote / Common / Rare / Legendary, top-3 pillars for Top Spenders and Baltop,
//   an RTP gate, a PvP ruin, raised areas and rocks "here and there", no block-letter signs.
//
// The plan (top view, north up; players spawn in the middle facing north):
//
//                 street ring, then a ring of big buildings facing the plaza
//            [top3]   (boards + podium)   [top3]
//                  .   o  o  o  o  o   .              o = NPC on a quartz plinth
//     (crates)   tree   o   SPAWN   o   tree          inner ring r 12 (6 NPCs)
//     arc of 4          o         o          ===> PvP ruin behind a red line
//                  tree   o  o  o   tree              outer ring r 22 (4 NPCs)
//                        (RTP gate)
//                    path south to the wild
//
// Numbers (references/spawns/build-guide.md §3): NPCs 6 apart along a ring, the inner ring r 12, the
// outer r 22, path mouths 9 wide; the paved plaza r 40 (Rp), its kerb, a 5-wide street ring to r 45,
// the buildings from r 47; feature trees between the rings on the diagonals; boards 6 in from the
// plaza rim to the north, crates 6 in from the rim to the west. Everything in town is flat.
//
// Build:  node scripts/run-build.mjs assets/examples/spawns/ember-smp.mjs --out-dir minecraft-builds/ember-smp
// (in a spawn folder made with new_spawn the imports read './parts/...').

import { startSpawn, finishSpawn, polar, facingToward, findSpot } from '../../spawn-parts/spawn.mjs'
import { buildSite, paveRound, pavePath } from '../../spawn-parts/site.mjs'
import { ringPoints, npcPlinth, grassBed } from '../../spawn-parts/plaza.mjs'
import { boardsPlaza, crateCourt, top3Pillars } from '../../spawn-parts/features.mjs'
import { building } from '../../spawn-parts/buildings.mjs'
import { featureTree, lamp, bench, bushAt, clutter, pvpArena, rockOutcrop, landscapePass } from '../../spawn-parts/landscape.mjs'

// ------------------------------------------------------------------ the brief, as answered
const NPCS = [
  { id: 'shop', label: 'Shop' }, { id: 'auction', label: 'Auction House' }, { id: 'kits', label: 'Kits' },
  { id: 'store', label: 'Store' }, { id: 'quests', label: 'Quests' }, { id: 'sell', label: 'Sell' },
  { id: 'warps', label: 'Warps' }, { id: 'events', label: 'Events' }, { id: 'vote', label: 'Vote' },
  { id: 'tutorial', label: 'Start Here' },
]
const BOARDS = [{ id: 'money', label: 'Money' }, { id: 'kills', label: 'Kills' }, { id: 'playtime', label: 'Playtime' }]
const CRATES = [
  { id: 'vote', label: 'Vote', tier: 'vote' }, { id: 'common', label: 'Common', tier: 'common' },
  { id: 'rare', label: 'Rare', tier: 'rare' }, { id: 'legendary', label: 'Legendary', tier: 'legendary' },
]
const TOP3 = [{ id: 'spenders', label: 'Top Spenders' }, { id: 'baltop', label: 'Baltop' }]

export default function build(api) {
  const ctx = startSpawn(api, { name: 'Ember SMP', size: 220, height: 100, theme: 'autumn', accent: 'orange', setting: 'plains', seed: 7 })
  const { b, kit, theme, FY, C, S, grid, rng, M } = ctx
  const [cx, cz] = C

  // ================================================================ 1. plan (no blocks yet)
  const R1 = 12 // inner NPC ring
  const R2 = 22 // outer NPC ring
  const Rp = 40 // the paved plaza
  const islandR = S / 2 - 3
  ctx.layout.plaza = { cx, cz, r: Rp + 5 } // the plaza plus the street ring stays flat at FY
  grid.reserveDisc(cx, cz, Rp + 5.5, 'plaza')
  // the four corridors out stay free of buildings
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const [ax, bx] = dx ? [cx + dx * Rp, cx + dx * (islandR + 2)] : [cx - 4, cx + 4]
    const [az, bz] = dz ? [cz + dz * Rp, cz + dz * (islandR + 2)] : [cz - 4, cz + 4]
    grid.reserve(ax, az, bx, bz, 'road')
  }
  const pads = []
  const slot = (s, pad = 1) => {
    grid.reserve(s.x0, s.z0, s.x1, s.z1, s.kind, pad)
    pads.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, y: FY, blend: 5 })
    return s
  }

  // NPC rings. 6 fit on the inner ring between the 4 path mouths (9 wide = 21 degrees each at r 12);
  // the other 4 go on the outer ring, which also skips the boards (north, 44 degrees each side)
  // and the crates (west). The first NPCs in the list land nearest north, in the first view.
  const mouth = (9 / (2 * Math.PI * R1)) * 180
  const inner = ringPoints(ctx, { r: R1, n: 6, skips: [[0, mouth], [90, mouth], [180, mouth], [270, mouth]] })
  const outer = ringPoints(ctx, { r: R2, n: 4, skips: [[0, 44], [90, 12], [180, 12], [270, 44]] })
  const npcSpots = [...inner, ...outer]

  // the leaderboards: a row of hologram plinths 6 in from the plaza rim, north, facing the spawn
  const boardsZ = cz - (Rp - 6)
  // the crates: an arc 6 in from the rim, west, 6 blocks apart along the arc, facing the spawn
  const crateR = Rp - 6
  const crateStep = (6 / crateR) * (180 / Math.PI)
  const crates = CRATES.map((crate, i) => {
    const [x, z] = polar(ctx, 270 + (i - (CRATES.length - 1) / 2) * crateStep, crateR)
    return { crate, x: Math.round(x), z: Math.round(z), facing: facingToward([x, z], C) }
  })
  // top-3 pillar sets either side of the boards, on the plaza, facing the spawn
  const top3 = TOP3.map((t, i) => {
    const [x, z] = polar(ctx, i === 0 ? -34 : 34, Rp - 6)
    return { ...t, x: Math.round(x), z: Math.round(z), facing: facingToward([x, z], C) }
  })
  // the RTP gate on the south axis just outside the plaza, the PvP ruin east beyond the street
  const rtp = slot({ kind: 'rtp', x0: cx - 7, x1: cx + 7, z0: cz + Rp + 1, z1: cz + Rp + 7 })
  const pvp = slot({ kind: 'pvp', x0: cx + Rp + 8, x1: cx + Rp + 36, z0: cz - 14, z1: cz + 14 }, 3)
  // feature trees on the diagonals between the rings, a little off the exact 45s (hand-placed look)
  const trees = [45, 135, 225, 315].map((a, i) => {
    const [x, z] = polar(ctx, a + rng.range(-6, 6), Math.round((R1 + R2) / 2) + 1)
    return { x: Math.round(x), z: Math.round(z), seed: ctx.seed + i }
  })

  // The ring of big buildings round the street (r 47 and out), all facing the plaza. Walk round the
  // circle placing a house, a hall or now and then a tower, each as big as its kind allows, and step
  // on by its width plus a gap; when a spot is taken (a corridor, the PvP ruin), push it out or skip.
  const houses = []
  let a = rng.range(0, 8)
  for (let k = 0; a < 360; k += 1) {
    // every third a hall; now and then a tower, never two side by side (cloned neighbours read AI)
    const prev = houses[houses.length - 1]?.kind
    const kind = k % 3 === 1 ? 'hall' : prev !== 'tower' && rng() < 0.12 ? 'tower' : 'house'
    const [w, d] = kind === 'hall' ? [19 + 2 * rng.int(0, 2), 13 + 2 * rng.int(0, 1)] : kind === 'tower' ? [9, 9] : [13 + 2 * rng.int(0, 1), 11 + 2 * rng.int(0, 1)]
    let placed = false
    for (const extra of [0, 3, 6]) {
      const R = Rp + 7 + extra + d / 2
      const [x, z] = polar(ctx, a, R)
      const facing = facingToward([x, z], C)
      const [fw, fd] = facing === 'north' || facing === 'south' ? [w, d] : [d, w]
      const s = { kind, x0: Math.round(x - fw / 2), z0: Math.round(z - fd / 2), facing, y: FY, seed: ctx.seed * 31 + k, storeys: kind === 'hall' ? 2 : kind === 'tower' ? 1 : rng.chance(0.3) ? 3 : 2 }
      s.x1 = s.x0 + fw - 1
      s.z1 = s.z0 + fd - 1
      const corners = [[s.x0, s.z0], [s.x1, s.z0], [s.x0, s.z1], [s.x1, s.z1]]
      if (corners.some(([px, pz]) => Math.hypot(px - cx, pz - cz) > islandR - 6) || !grid.free(s.x0 - 3, s.z0 - 3, s.x1 + 3, s.z1 + 3)) continue
      houses.push(slot(s, 2))
      a += ((Math.max(w, d) / 2 + 4) / R) * (180 / Math.PI) * 1.6
      placed = true
      break
    }
    if (!placed) a += 3
  }
  // a few one-storey cottages further out where there is room: the town thins toward the wild
  for (const a0 of [20, 70, 110, 160, 200, 250, 290, 340]) {
    const [x, z] = polar(ctx, a0 + rng.range(-8, 8), Rp + 40)
    const facing = facingToward([x, z], C)
    const s = { kind: 'house', x0: Math.round(x - 5), z0: Math.round(z - 4), facing, y: FY, seed: ctx.seed * 53 + a0, storeys: 1 }
    s.x1 = s.x0 + 8 + 2 * rng.int(0, 1)
    s.z1 = s.z0 + 8
    if (Math.hypot(x - cx, z - cz) < islandR - 14 && grid.free(s.x0 - 4, s.z0 - 4, s.x1 + 4, s.z1 + 4)) houses.push(slot(s, 2))
  }
  // raised areas (1-4 blocks, smooth) and rocks in the ground that is still free: they break up the
  // flat land between the town and the shore without blocking anything
  const mounds = []
  for (let i = 0; i < 4; i += 1) {
    const r = rng.int(8, 14)
    const spot = findSpot(ctx, { r: r + 2, ring: [Rp + 14, islandR - r - 4], tag: 'mound', pad: 3 })
    if (spot) mounds.push({ x: spot.x, z: spot.z, r, h: rng.int(1, 4) })
  }
  const rocks = []
  for (let i = 0; i < 8; i += 1) {
    const spot = findSpot(ctx, { r: 3, ring: [Rp + 10, islandR - 6], tag: 'rock' })
    if (spot) rocks.push(spot)
  }

  // ================================================================ 2. the site
  buildSite(ctx, {
    plaza: ctx.layout.plaza,
    pads,
    mounds,
    flat: (x, z) => Math.hypot(x - cx, z - cz) < Rp + 34, // the whole town is flat; it rolls only by the rim
  })

  // ================================================================ 3. the plaza
  // the street ring (path field), then the plaza on top of it in target rings round the spawn
  paveRound(ctx, { cx, cz, r: Rp + 5, field: ctx.paint.path, wobble: 1.2 })
  const border = theme.paving.border
  const inlay = theme.paving.inlay
  paveRound(ctx, {
    cx, cz, r: Rp, kerb: border, wobble: 0.6,
    rings: [
      { r0: 0, r1: 1.5, paint: 'minecraft:chiseled_quartz_block' }, // the rose the players land on
      { r0: 1.5, r1: 3.5, paint: 'minecraft:smooth_quartz' },
      { r0: 3.5, r1: 4.6, paint: border },
      { r0: 7.4, r1: 8.4, paint: inlay },
      { r0: R1 - 1.6, r1: R1 + 1.6, paint: border }, // a band under each NPC ring
      { r0: R2 - 1.6, r1: R2 + 1.6, paint: border },
      { r0: Rp - 9.5, r1: Rp - 8.5, paint: inlay },
    ],
  })
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) for (let k = 2; k <= 3; k += 1) b.set(cx + dx * k, FY, cz + dz * k, border)
  b.spawnPoint([cx, FY, cz], 'north')

  // NPCs on quartz plinths, every one facing the spawn
  NPCS.forEach((npc, i) => npcPlinth(ctx, npc, [npcSpots[i].x, npcSpots[i].z]))
  // feature trees in grass beds, a bench in front of each bed facing the spawn
  for (const t of trees) {
    grassBed(ctx, t.x, t.z, 4)
    ctx.place(featureTree, [t.x, FY, t.z], { size: 'large', seed: t.seed, maxRadius: 8, maxHeight: 16 })
    const [x, z] = [t.x + Math.sign(cx - t.x) * 6, t.z + Math.sign(cz - t.z) * 6]
    ctx.place(bench, [x, FY, z], facingToward([x, z], C), { length: 3 })
  }

  // ================================================================ 4. the open-air sections
  ctx.place(boardsPlaza, { cx, z: boardsZ, facing: 'south', boards: BOARDS })
  for (const t of top3) ctx.place(top3Pillars, { x: t.x, z: t.z, facing: t.facing, id: t.id, label: t.label })
  ctx.place(crateCourt, { points: crates.map(c => [c.x, c.z]), facings: crates.map(c => c.facing), crates: crates.map(c => c.crate) })
  b.portal([cx - 2, FY + 1, cz + Rp + 3], [cx + 2, FY + 5, cz + Rp + 3], { ...M, id: 'rtp', label: 'Random Teleport', kind: 'rtp', facing: 'north' })
  ctx.place(pvpArena, { ...pvp, y: FY, entrance: 'west' })
  b.region('pvp', [pvp.x0, FY - 2, pvp.z0], [pvp.x1, FY + 20, pvp.z1], { pvp: 'allow', priority: 20 })

  // ================================================================ 5. the buildings
  const doors = []
  for (const h of houses) {
    const res = ctx.place(building, h)
    if (res?.door) doors.push(res.door)
  }
  // a short walk from each door to the street ring
  for (const door of doors) {
    const [dx, dz] = [cx - door[0], cz - door[2]]
    const len = Math.hypot(dx, dz)
    pavePath(ctx, [[door[0], door[2]], [cx - (dx / len) * (Rp + 4), cz - (dz / len) * (Rp + 4)]], { width: 3, fray: false })
  }
  // the corridors out of town (east goes to the PvP ruin's entrance)
  const far = islandR - 6
  pavePath(ctx, [[cx + Rp + 5, cz], [pvp.x0 - 1, cz]], { width: 5 })
  for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0]])
    pavePath(ctx, [[cx + dx * (Rp + 5), cz + dz * (Rp + 5)], [cx + dx * far + rng.range(-3, 3) * Math.abs(dz), cz + dz * far + rng.range(-3, 3) * Math.abs(dx)]], { width: 5 })

  // ================================================================ 6. set pieces and life
  for (const r of rocks) ctx.place(rockOutcrop, [r.x, ctx.site.groundY(r.x, r.z), r.z], { r: rng.range(1.8, 3.2), seed: r.x * 7 + r.z })
  for (const m of mounds) if (m.r >= 11) ctx.place(featureTree, [m.x, ctx.site.groundY(m.x, m.z), m.z], { size: 'medium', seed: m.x + m.z, maxRadius: 6, maxHeight: 12 })
  // lamps on the street ring every ~13 blocks, never in a path mouth
  const nLamps = Math.round((2 * Math.PI * (Rp + 2.5)) / 13)
  for (let i = 0; i < nLamps; i += 1) {
    const ang = (i / nLamps) * 360 + 7
    if ([0, 90, 180, 270].some(m => Math.abs(((ang - m + 540) % 360) - 180) > 174)) continue
    const [x, z] = polar(ctx, ang, Rp + 2.5)
    ctx.place(lamp, [Math.round(x), FY, Math.round(z)], { kind: 'post', seed: i })
  }
  // bushes on the plaza rim between the sections, props beside the houses
  for (const ang of [30, 60, 120, 150, 210, 240, 300, 330]) {
    const [x, z] = polar(ctx, ang + rng.range(-4, 4), Rp - 3)
    if (!b.get(Math.round(x), FY + 1, Math.round(z))) ctx.place(bushAt, [Math.round(x), FY, Math.round(z)], { r: 1.3, seed: Math.round(ang) })
  }
  for (const h of houses) {
    const [x, z] = h.facing === 'north' || h.facing === 'south' ? [h.x1 + 2, Math.round((h.z0 + h.z1) / 2)] : [Math.round((h.x0 + h.x1) / 2), h.z1 + 2]
    if ([h.kind, null].includes(grid.tag(x, z))) ctx.place(clutter, [x, ctx.site.groundY(x, z), z], ['barrels', 'logs', 'crates', 'hay', 'cart'][h.seed % 5])
  }
  // woodland, flowers and path lamps on every column nobody reserved
  ctx.place(landscapePass)

  return finishSpawn(ctx)
}
