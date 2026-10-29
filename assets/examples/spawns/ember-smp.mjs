// A REFERENCE SPAWN, for reading: how a whole spawn fits together (the plan, the reservations, the
// order of work). New spawns do not start from it: they start from the skeleton, and each of their
// elements is designed for that server (references/spawns/build-guide.md).
//
// Ember SMP — a NORMAL spawn (FreshSMP-style): a big flat plaza with the NPCs on quartz plinths in
// rings round the spawn, trees in grass beds, the boards and crates out in the open, a ring of big
// buildings, woodland beyond. Its layout follows a BRIEF block (ring sizes, plaza, canvas, extras),
// with a CUSTOM block for additions.
//
// The plan (top view, north up; players spawn in the middle facing north):
//
//                 street ring, then a ring of big buildings facing the plaza
//            [top3]   (boards + podium)   [top3]
//                  .   o  o  o  o  o   .              o = NPC on a quartz plinth
//     (crates)   tree   o   SPAWN   o   tree          inner ring r 12 (up to 6 NPCs)
//     arc               o         o          ===> PvP ruin behind a red line
//                  tree   o  o  o   tree              outer ring r 22+ (the rest)
//                        (RTP gate)
//                    path south to the wild
//
// The numbers (references/spawns/build-guide.md §6.1): NPCs 6 apart along a ring, the inner ring r 12
// broken by four 9-wide path mouths, the outer ring wide enough for the rest (r >= 22); the paved plaza
// Rp = max(40, R2 + 14) with a 5-wide street ring; the buildings from Rp + 7; feature trees between
// the rings on the diagonals; boards 6 in from the rim north, crates 6 in from the rim west, top-3
// pillars either side of the boards; canvas = 2 x (Rp + 70). Everything in town is flat. cratesSide 'east'
// mirrors the crate arc and the PvP ruin.
//
// Build: node scripts/run-build.mjs assets/examples/spawns/ember-smp.mjs --out-dir minecraft-builds/ember-smp
// (in a spawn folder made with new_spawn it sits in examples/ and imports '../parts/...').

import { startSpawn, finishSpawn, polar, facingToward, yawToward, findSpot } from '../../spawn-parts/spawn.mjs'
import { buildSite, paveRound, paveRect, pavePath } from '../../spawn-parts/site.mjs'
import { ringPoints, npcPlinth, grassBed } from '../../spawn-parts/plaza.mjs'
import { boardsPlaza, crateCourt, top3Pillars } from '../../spawn-parts/features.mjs'
import { building } from '../../spawn-parts/buildings.mjs'
import { featureTree, plantTree, lamp, bench, bushAt, clutter, planter, fountain, well, stall, hedge, rockOutcrop, stoneLantern, bambooClump, torii, pvpArena, afkPark, landscapePass } from '../../spawn-parts/landscape.mjs'
import { LANDMARKS, landmark, palmTree } from '../../spawn-parts/landmarks.mjs'
import { snowfall, leafLitter } from '../../spawn-parts/seasons.mjs'
import { buildExtras, extrasRoom, planGround, planLandmarks } from '../../spawn-parts/extras.mjs'
import { koth, moshpit, warzoneBand } from '../../spawn-parts/warzone.mjs'
import { signStand } from '../../spawn-parts/signs.mjs'

// ================================================================== the brief (edit this block)
const BRIEF = {
  name: 'Ember SMP',
  theme: 'autumn', // autumn, medieval, white-town, japanese, winter, fantasy, crimson, tropical
  accent: 'orange', // one dye colour, never gold
  setting: 'plains', // plains (flat, best for normal spawns), island, valley, mountain, coast
  seed: 7, // another number = another variation
  size: null, // blocks across the spawn; null = recommended for the program
  npcs: [
    { id: 'shop', label: 'Shop' }, { id: 'auction', label: 'Auction House' }, { id: 'kits', label: 'Kits' },
    { id: 'store', label: 'Store' }, { id: 'quests', label: 'Quests' }, { id: 'sell', label: 'Sell' },
    { id: 'warps', label: 'Warps' }, { id: 'events', label: 'Events' }, { id: 'vote', label: 'Vote' },
    { id: 'tutorial', label: 'Start Here' },
  ],
  boards: [{ id: 'money', label: 'Money' }, { id: 'kills', label: 'Kills' }, { id: 'playtime', label: 'Playtime' }],
  crates: [
    { id: 'vote', label: 'Vote', tier: 'vote' }, { id: 'common', label: 'Common', tier: 'common' },
    { id: 'rare', label: 'Rare', tier: 'rare' }, { id: 'legendary', label: 'Legendary', tier: 'legendary' },
  ],
  top3: [{ id: 'spenders', label: 'Top Spenders' }, { id: 'baltop', label: 'Baltop' }], // 0-4 pillar sets
  cratesSide: 'west', // 'west' or 'east': the crate arc's side of the plaza (the PvP ruin takes the other)
  rtp: true, // the RTP gate south
  pvp: true, // the PvP ruin, opposite the crates
  afk: false, // an AFK garden pool outside the town
  landmarks: [], // 'volcano', 'lighthouse', 'ship', 'statue', 'giant-tree', 'giant-palm', 'rock-spires', 'rock-arch'
  bigTrees: 0, // giant trees round the town
  terraces: 4, // raised areas (1-4 blocks, smooth) in the free ground
  rocks: 8, // rock outcrops here and there
  warzone: null, // e.g. { width: 56, moshpit: true, koth: true, label: 'Warzone' }
  signs: null, // block-letter titles, e.g. { style: 'classic', outline: true, thick: false }; null = holograms only
}

// ================================================================== your additions (edit these)
// Everything this server gets beyond the base layout goes here, so the layout above keeps working when
// the BRIEF changes. Every part is imported at the top. L is the plan (all build coordinates):
//   L.cx, L.cz      the spawn column (players spawn there facing north)   L.FY  the plaza floor block
//   L.S             the canvas side      L.islandR  the shore's distance from the middle
//   L.R1, L.R2      the NPC rings        L.Rp       the plaza radius (the street ring runs to Rp + 5)
//   L.npcSpots, L.crates, L.top3, L.trees, L.rtp, L.pvp, L.afk, L.landmarks   the planned places
//   L.houses        the buildings (filled after plan; edit them before build)  L.doors  their doors
//   L.slot({ x0, z0, x1, z1, kind }, pad)   reserve a rectangle and level a pad under it (plan only)
//   L.onIsland(rect, r)                     every corner of rect within r of the middle
const CUSTOM = {
  // 1. while planning, after the gameplay places and BEFORE the buildings (they fill round what you
  //    reserve): reserve the ground of each piece (findSpot or L.slot) and return what you planned
  plan(ctx, L) {
    return {}
  },
  // 2. build your pieces, after the base layout's own and before the landscape pass (the woodland, the
  //    flowers and the path lamps then grow round them)
  build(ctx, L, mine) {},
  // 3. after the landscape pass: seasonal passes (snowfall, leafLitter) and last touches
  finish(ctx, L, mine) {},
}

// ================================================================== the layout's numbers
const SPACING = 6 // blocks of arc between NPCs
const MOUTH = 9 // a path mouth through a ring
const R1 = 12 // the inner NPC ring
// the inner ring takes what fits between the 4 mouths; the outer ring the rest (it also skips the
// boards' and the crates' sectors); the plaza reaches 14 past the outer ring
function ringsOf(N) {
  const c1 = Math.floor((2 * Math.PI * R1 - 4 * MOUTH) / SPACING)
  const n1 = Math.min(N, c1)
  const n2 = N - n1
  const outerShare = (360 - 2 * 44 - 2 * 12) / 360
  const R2 = n2 ? Math.max(22, Math.ceil((n2 * SPACING) / (2 * Math.PI * outerShare))) : 22
  return { n1, n2, R2, Rp: Math.max(40, R2 + 14) }
}

export default function build(api) {
  const B = BRIEF
  const N = B.npcs.length
  const { n1, n2, R2, Rp } = ringsOf(N)
  const CR = B.cratesSide === 'east' ? 90 : 270 // the crate arc's angle round the spawn (0 = north)
  const PV = (CR + 180) % 360 // the PvP ruin's side
  const kinds = [...B.landmarks, ...Array.from({ length: B.bigTrees }, () => ([B.theme, B.theme?.base].includes('tropical') ? 'giant-palm' : 'giant-tree'))]
  const big = extrasRoom(kinds)
  const recommended = Math.ceil((2 * Math.max(Rp + 70, big ? Rp + 16 + 2 * big : 0)) / 4) * 4
  const spawnS = Math.max(120, Math.min(320, B.size ?? recommended))
  const W = B.warzone ? B.warzone.width ?? 56 : 0 // a warzone band round the spawn square
  const ctx = startSpawn(api, { name: B.name, size: spawnS + 2 * W, height: 100, theme: B.theme, accent: B.accent, setting: B.setting, seed: B.seed })
  const { b, theme, FY, C, S, grid, rng, M } = ctx
  const [cx, cz] = C
  if (B.size && B.size < recommended - 8) ctx.warn(`size ${B.size} is small for ${N} NPCs; ${recommended} is recommended`)

  // ================================================================ 1. plan (no blocks yet)
  const islandR = spawnS / 2 - 3 // the spawn square (the warzone, if any, lies outside it)
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
  const onIsland = (s, r) => [[s.x0, s.z0], [s.x1, s.z0], [s.x0, s.z1], [s.x1, s.z1]].every(([x, z]) => Math.hypot(x - cx, z - cz) < r)

  // NPC rings: the first NPCs in the list land nearest north, in the first view
  const mouth1 = (MOUTH / (2 * Math.PI * R1)) * 180
  const inner = ringPoints(ctx, { r: R1, n: n1, skips: [[0, mouth1], [90, mouth1], [180, mouth1], [270, mouth1]] })
  const outer = ringPoints(ctx, { r: R2, n: n2, skips: [[0, 44], [CR, 44], [PV, 12], [180, 12]] })
  const npcSpots = [...inner, ...outer]

  // the open-air sections on the plaza: boards north, crates in an arc on their side, top-3 sets beside the boards
  const boardsZ = cz - (Rp - 6)
  const crateR = Rp - 6
  const crateStep = (SPACING / crateR) * (180 / Math.PI)
  const crates = B.crates.map((crate, i) => {
    const [x, z] = polar(ctx, CR + (i - (B.crates.length - 1) / 2) * crateStep, crateR)
    return { crate, x: Math.round(x), z: Math.round(z), facing: facingToward([x, z], C) }
  })
  // top-3 sets beside the boards (+-34 degrees), then +-52; a set that would land on the crate arc
  // (its half span, plus a set's own half width of ~9 degrees) moves round to 70 on the other side
  const crateHalf = ((B.crates.length - 1) / 2) * crateStep + 18
  const onCrates = a => Math.abs(((a - CR + 540) % 360) - 180) < crateHalf
  const top3Angles = [-34, 34, -52, 52].map(a => (onCrates(a) ? (a < 0 ? 70 : -70) : a))
  const top3 = B.top3.slice(0, 4).map((t, i) => {
    const [x, z] = polar(ctx, top3Angles[i], Rp - 6)
    return { ...t, x: Math.round(x), z: Math.round(z), facing: facingToward([x, z], C) }
  })
  const rtp = B.rtp ? slot({ kind: 'rtp', x0: cx - 7, x1: cx + 7, z0: cz + Rp + 1, z1: cz + Rp + 7 }) : null
  const aw = Math.max(22, Math.min(32, Math.round(islandR - Rp - 18)))
  const px0 = PV === 90 ? cx + Rp + 8 : cx - Rp - 8 - aw
  const pvp = B.pvp ? slot({ kind: 'pvp', x0: px0, x1: px0 + aw, z0: cz - Math.floor(aw / 2), z1: cz + Math.ceil(aw / 2) }, 3) : null
  // feature trees on the diagonals between the rings, a little off the exact 45s (hand-placed look)
  const trees = [45, 135, 225, 315].map((a, i) => {
    const [x, z] = polar(ctx, a + rng.range(-6, 6), Math.round((R1 + R2) / 2) + 1)
    return { x: Math.round(x), z: Math.round(z), seed: ctx.seed + i }
  })
  let afk = null
  if (B.afk)
    for (const a of [225, 135, 315, 45]) {
      const [x, z] = polar(ctx, a, Rp + 36)
      const s = { kind: 'afk', x0: Math.round(x) - 8, x1: Math.round(x) + 8, z0: Math.round(z) - 8, z1: Math.round(z) + 8 }
      if (onIsland(s, islandR - 3) && grid.free(s.x0 - 2, s.z0 - 2, s.x1 + 2, s.z1 + 2)) {
        afk = slot(s, 2)
        break
      }
    }
  // landmarks and giant trees right behind the street ring, before the buildings (they fill round them)
  const landmarks = planLandmarks(ctx, { kinds, ring: Rp + 9, islandR })
  for (const m of landmarks) pads.push({ x0: m.x - m.r, z0: m.z - m.r, x1: m.x + m.r, z1: m.z + m.r, y: FY, blend: 5 })
  // your pieces (CUSTOM.plan), before the buildings so they fill round them
  const L = { cx, cz, FY, S, spawnS, W, islandR, R1, R2, Rp, npcSpots, crates, top3, boardsZ, rtp, pvp, afk, trees, landmarks, pads, slot, onIsland, houses: [], doors: [] }
  const mine = CUSTOM.plan(ctx, L) ?? {}

  // The ring of big buildings round the street (Rp + 7 and out), all facing the plaza: walk round the
  // circle placing a hall every third, now and then a tower (never two side by side), houses between,
  // each as big as its kind allows, stepping on by its width plus a gap; a taken spot (a corridor, the
  // PvP ruin, a landmark) is pushed out or skipped.
  const houses = L.houses
  let a = rng.range(0, 8)
  for (let k = 0; a < 360; k += 1) {
    const prev = houses[houses.length - 1]?.kind
    const kind = k % 3 === 1 ? 'hall' : prev !== 'tower' && rng() < 0.1 ? 'tower' : 'house'
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
      if (!onIsland(s, islandR - 6) || !grid.free(s.x0 - 3, s.z0 - 3, s.x1 + 3, s.z1 + 3)) continue
      houses.push(slot(s, 2))
      a += ((Math.max(w, d) / 2 + 4) / R) * (180 / Math.PI) * 1.6
      placed = true
      break
    }
    if (!placed) a += 3
  }
  // one-storey cottages further out where there is room: the town thins toward the wild
  for (const a0 of [20, 70, 110, 160, 200, 250, 290, 340]) {
    const w = 9 + 2 * rng.int(0, 1)
    const [x, z] = polar(ctx, a0 + rng.range(-8, 8), Rp + 40)
    const facing = facingToward([x, z], C)
    const s = { kind: 'house', x0: Math.round(x - w / 2), z0: Math.round(z - 4.5), facing, y: FY, seed: ctx.seed * 53 + a0, storeys: 1 }
    s.x1 = s.x0 + w - 1
    s.z1 = s.z0 + 8
    if (onIsland(s, islandR - 6) && grid.free(s.x0 - 4, s.z0 - 4, s.x1 + 4, s.z1 + 4)) houses.push(slot(s, 2))
  }
  // the warzone's pit and hill: the middle of the band, north-west and south (planned before the band
  // so its cover keeps clear of them)
  const lo = W
  const hi = W + spawnS - 1
  const pit = B.warzone?.moshpit !== false && W ? { x: Math.round(cx - spawnS / 4), z: Math.round(lo - W / 2), r: Math.min(12, Math.floor(W / 2 - 6)) } : null
  const hill = B.warzone?.koth !== false && W ? { x: cx + Math.round(spawnS / 6), z: Math.round(hi + W / 2), r: 8 } : null
  for (const p of [pit, hill]) if (p) pads.push({ x0: p.x - p.r - 3, z0: p.z - p.r - 3, x1: p.x + p.r + 3, z1: p.z + p.r + 3, y: FY, blend: 4 })
  // raised areas and rocks in what is left (the woodland still grows on the raised areas)
  const ground = planGround(ctx, { terraces: B.terraces, rocks: B.rocks, islandR, inner: 20 })

  // ================================================================ 2. the site
  buildSite(ctx, {
    pads,
    mounds: ground.mounds,
    flat: (x, z) => Math.hypot(x - cx, z - cz) < Rp + 34, // the whole town is flat; it rolls only by the rim
    ...(W ? { shape: 'square', radius: S / 2 - 3 } : {}),
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
      { r0: 1.5, r1: 3.5, paint: theme.plinth.includes('quartz') ? 'minecraft:smooth_quartz' : 'minecraft:polished_diorite' },
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
  B.npcs.forEach((npc, i) => npcSpots[i] && npcPlinth(ctx, npc, [npcSpots[i].x, npcSpots[i].z]))
  // feature trees in grass beds, crowns kept below the boards' line of sight
  for (const t of trees) {
    grassBed(ctx, t.x, t.z, 4)
    ctx.place(featureTree, [t.x, FY, t.z], { size: 'large', seed: t.seed, maxRadius: 8, maxHeight: 16 })
  }

  // ================================================================ 4. the open-air sections
  if (B.boards.length) ctx.place(boardsPlaza, { cx, z: boardsZ, facing: 'south', boards: B.boards })
  for (const t of top3) ctx.place(top3Pillars, { x: t.x, z: t.z, facing: t.facing, id: t.id, label: t.label })
  if (crates.length) ctx.place(crateCourt, { points: crates.map(c => [c.x, c.z]), facings: crates.map(c => c.facing), crates: crates.map(c => c.crate) })
  if (rtp) b.portal([cx - 2, FY + 1, cz + Rp + 3], [cx + 2, FY + 5, cz + Rp + 3], { ...M, id: 'rtp', label: 'Random Teleport', kind: 'rtp', facing: 'north' })
  if (pvp) ctx.place(pvpArena, { ...pvp, y: FY, entrance: PV === 90 ? 'west' : 'east' })
  if (afk) ctx.place(afkPark, { ...afk, y: FY })
  // block-letter titles only when the user asked for them
  if (B.signs) {
    if (crates.length) ctx.place(signStand, 'CRATES', [CR === 270 ? cx - (Rp - 2) : cx + (Rp - 2), cz], CR === 270 ? 'east' : 'west', B.signs)
    if (B.boards.length) ctx.place(signStand, ctx.kit.signWidth('LEADERBOARDS', 'small') <= 44 ? 'LEADERBOARDS' : 'TOP', [cx, cz - (Rp - 1)], 'south', B.signs)
    if (pvp) ctx.place(signStand, 'PVP', [PV === 90 ? pvp.x0 - 3 : pvp.x1 + 3, cz + 9], PV === 90 ? 'west' : 'east', B.signs)
  }

  // ================================================================ 5. landmarks, buildings, walks
  buildExtras(ctx, { landmarks, rocks: ground.rocks, mounds: ground.mounds })
  const doors = L.doors
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
  // the corridors out of town (the PvP side's goes to the ruin's entrance when there is one)
  const far = islandR - 6
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    if (pvp && dx === (PV === 90 ? 1 : -1)) {
      pavePath(ctx, [[cx + dx * (Rp + 5), cz], [PV === 90 ? pvp.x0 - 1 : pvp.x1 + 1, cz]], { width: 5 })
      continue
    }
    pavePath(ctx, [[cx + dx * (Rp + 5), cz + dz * (Rp + 5)], [cx + dx * far + rng.range(-3, 3) * Math.abs(dz), cz + dz * far + rng.range(-3, 3) * Math.abs(dx)]], { width: 5 })
  }

  // ================================================================ 6. the warzone (optional)
  if (W) {
    if (pit) ctx.place(moshpit, [pit.x, pit.z], { r: pit.r })
    if (hill) ctx.place(koth, [hill.x, hill.z])
    ctx.place(warzoneBand, { spawn: [lo, lo, hi, hi], label: B.warzone.label ?? 'Warzone', keepClear: [pit, hill && { ...hill, r: 12 }].filter(Boolean) })
    b.region('warzone', [0, 0, 0], [S - 1, ctx.H - 1, S - 1], { pvp: 'allow', 'mob-spawning': 'deny', priority: 5 })
  }

  // ================================================================ 7. lamps, benches, life
  // lamps on the street ring every ~13 blocks, never in a path mouth
  const nLamps = Math.round((2 * Math.PI * (Rp + 2.5)) / 13)
  for (let i = 0; i < nLamps; i += 1) {
    const ang = (i / nLamps) * 360 + 7
    if ([0, 90, 180, 270].some(m => Math.abs(((ang - m + 540) % 360) - 180) > 174)) continue
    const [x, z] = polar(ctx, ang, Rp + 2.5)
    ctx.place(lamp, [Math.round(x), FY, Math.round(z)], { kind: 'post', seed: i })
  }
  // a bench facing the spawn by each tree bed
  for (const t of trees) {
    const [x, z] = [t.x + Math.sign(cx - t.x) * 6, t.z + Math.sign(cz - t.z) * 6]
    ctx.place(bench, [x, FY, z], facingToward([x, z], C), { length: 3 })
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
  // your pieces (CUSTOM.build), then woodland, flowers and path lamps on every column nobody reserved,
  // then your last touches (CUSTOM.finish)
  CUSTOM.build(ctx, L, mine)
  ctx.place(landscapePass)
  CUSTOM.finish(ctx, L, mine)

  return finishSpawn(ctx, { safeZone: [lo, lo, hi, hi] })
}
