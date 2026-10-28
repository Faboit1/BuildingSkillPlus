// Oakhaven — the SPAWN+ template (DonutSMP-style town): every NPC gets its own building round a
// square hub plaza. This is a tested spawn+ layout written as a recipe: change the BRIEF
// block and the whole layout follows (the plaza grows until every NPC has a lot); then make it yours
// in the CUSTOM block below it.
//
//                         HERO WALL (boards + the name)
//        [hall]  [shop] [shop]   ===============   [shop] [shop]  [hall]
//               +--------------- ring road (5) ----------------+
//   [shop]      |  garden                              garden  |      [shop]
//   CRATES      |        top3   (rose)   top3                  |      ======> PvP arena
//   (yard)      |          stalls    SPAWN    stalls           |      spoke road east
//   [shop]      |  garden                              garden  |      [shop]
//               +----------------------------------------------+
//        [hall]  [shop] [house]    RTP gate     [shop] [house]  [hall]
//    AFK park (outside the town)
//
// The numbers (references/spawns/build-guide.md §5.3): lots 11-15 wide with 2-4 gaps, 11-13 deep, 1-2
// back from the road; each side of the ring road has a centre piece (north the hero wall, west the
// crate yard, south the RTP gate, east the spoke road) with lots either side; halls on the four
// corners with forecourts; the first NPCs take the north corner halls, then the north lots (the first
// view), then west/east, then south; spare lots become houses.
//
// Build: node scripts/run-build.mjs assets/examples/spawns/oakhaven-hub.mjs --out-dir minecraft-builds/oakhaven

import { startSpawn, finishSpawn, polar, facingToward, yawToward, findSpot } from '../../spawn-parts/spawn.mjs'
import { buildSite, paveRect, paveRound, pavePath } from '../../spawn-parts/site.mjs'
import { crateYard, top3Pillars } from '../../spawn-parts/features.mjs'
import { building, heroWall } from '../../spawn-parts/buildings.mjs'
import { afkPark, bench, bushAt, clutter, featureTree, plantTree, fountain, well, hedge, lamp, planter, pvpArena, stall, rockOutcrop, stoneLantern, bambooClump, torii, landscapePass } from '../../spawn-parts/landscape.mjs'
import { LANDMARKS, landmark, palmTree } from '../../spawn-parts/landmarks.mjs'
import { snowfall, leafLitter } from '../../spawn-parts/seasons.mjs'
import { buildExtras, extrasRoom, planGround, planLandmarks } from '../../spawn-parts/extras.mjs'
import { koth, moshpit, warzoneBand } from '../../spawn-parts/warzone.mjs'
import { signStand } from '../../spawn-parts/signs.mjs'

// ================================================================== the brief (edit this block)
const BRIEF = {
  name: 'Oakhaven',
  theme: 'medieval', // autumn, medieval, white-town, japanese, winter, fantasy, crimson, tropical
  accent: 'blue',
  setting: 'valley', // valley (hills round the town) suits a spawn+; plains, island, mountain, coast
  seed: 5,
  size: null, // null = recommended for the program
  npcs: [
    { id: 'shop', label: 'Shop' }, { id: 'auction', label: 'Auction House' }, { id: 'store', label: 'Store' },
    { id: 'kits', label: 'Kits' }, { id: 'quests', label: 'Quests' }, { id: 'sell', label: 'Sell' },
    { id: 'warps', label: 'Warps' }, { id: 'events', label: 'Events' }, { id: 'bounties', label: 'Bounties' },
    { id: 'teams', label: 'Teams' }, { id: 'tutorial', label: 'Start Here' }, { id: 'vote', label: 'Vote' },
    { id: 'duels', label: 'Duels' }, { id: 'enchanter', label: 'Enchanter' },
  ],
  boards: [{ id: 'money', label: 'Money' }, { id: 'kills', label: 'Kills' }, { id: 'playtime', label: 'Playtime' }, { id: 'blocks', label: 'Blocks Mined' }],
  crates: [
    { id: 'vote', label: 'Vote', tier: 'vote' }, { id: 'common', label: 'Common', tier: 'common' }, { id: 'rare', label: 'Rare', tier: 'rare' },
    { id: 'epic', label: 'Epic', tier: 'epic' }, { id: 'legendary', label: 'Legendary', tier: 'legendary' },
  ],
  top3: [{ id: 'spenders', label: 'Top Spenders' }], // 0-2 pillar sets inside the rose
  rtp: true,
  pvp: true,
  afk: true,
  landmarks: [],
  bigTrees: 0,
  terraces: 3,
  rocks: 6,
  warzone: null, // e.g. { width: 56, moshpit: true, koth: true, label: 'Warzone' }
  signs: { style: 'classic', outline: true, thick: false }, // the name on the hero wall + CRATES; null = holograms only
}

// ================================================================== your additions (edit these)
// Everything this server gets beyond the template goes here, so the layout above keeps working when
// the BRIEF changes. Every part is imported at the top. L is the plan (all build coordinates):
//   L.cx, L.cz      the spawn column (players spawn there facing north)   L.FY  the plaza floor block
//   L.S             the canvas side      L.islandR  the shore's distance from the middle
//   L.P, L.plaza    the hub plaza's side and rectangle   L.road  the ring road's outer rectangle
//   L.half          the town's half width (plaza + road + the lot band)
//   L.hero, L.crates, L.rtp, L.spoke, L.pvp, L.afk   the planned places (rectangles)
//   L.buildings     every lot with its kind and NPC (edit them in plan: kind, storeys, npc)
//   L.doors         the doors (after build)
//   L.slot({ x0, z0, x1, z1, kind }, pad)   reserve a rectangle and level a pad under it (plan only)
// The lots are fixed by the bands round the road: put your pieces on the plaza or outside the town.
// references/spawns/build-guide.md §4 shows how, with tested examples.
const CUSTOM = {
  // 1. while planning, after the town and before the landmarks and the raised areas: reserve the
  //    ground of each piece (findSpot or L.slot) and return what you planned
  plan(ctx, L) {
    return {}
  },
  // 2. build your pieces, after the template's own and before the landscape pass
  build(ctx, L, mine) {},
  // 3. after the landscape pass: seasonal passes (snowfall, leafLitter) and last touches
  finish(ctx, L, mine) {},
}

const ROAD = 5 // ring road width
const BAND = 16 // the lot band: building depth + setback
const FORE = 6 // the corner halls' forecourts at the ends of the west and east bands

// the hub plaza side P that gives every NPC a lot (lots >= 11 wide, >= 2 apart, two halves per band
// either side of its centre piece, plus the four corner halls)
function hubOf(B) {
  const nb = Math.max(1, B.boards.length)
  const heroW = Math.max(nb * 9 + (nb - 1) * 3 + 16, 34)
  const crateW = B.crates.length ? Math.max(17, B.crates.length * 5 + 7) : 0
  const centre = { north: heroW, west: (crateW || 9) + 12, south: 15, east: 9 + 12 }
  const capacity = P => Object.values(centre).reduce((s, w) => s + 2 * Math.max(0, Math.floor(((P + 2 * ROAD - w) / 2 - 3 + 2) / 13)), 0) + 4
  let P = 36
  // (2 spare: the lot widths are random, a band can come out one lot short)
  while (capacity(P) < B.npcs.length + 2 && P < 200) P += 2
  return { P, heroW, crateW, half: P / 2 + ROAD + BAND }
}

export default function build(api) {
  const B = BRIEF
  const { P, heroW, crateW, half } = hubOf(B)
  const kinds = [...B.landmarks, ...Array.from({ length: B.bigTrees }, () => ([B.theme, B.theme?.base].includes('tropical') ? 'giant-palm' : 'giant-tree'))]
  const big = extrasRoom(kinds)
  // the town is square: its corners reach half x 1.42 from the middle, and landmarks go on the
  // diagonals beyond them
  const recommended = Math.ceil((2 * Math.max(half + 40, big ? Math.round(half * 1.42) + 8 + 2 * big : 0)) / 4) * 4
  const spawnS = Math.max(160, Math.min(320, B.size ?? recommended))
  const W = B.warzone ? B.warzone.width ?? 56 : 0
  const ctx = startSpawn(api, { name: B.name, size: spawnS + 2 * W, height: 110, theme: B.theme, accent: B.accent, setting: B.setting, seed: B.seed })
  const { b, kit, theme, FY, C, S, grid, rng, M } = ctx
  const [cx, cz] = C
  const islandR = spawnS / 2 - 3
  if (half + 12 > islandR) ctx.warn(`a spawn+ with ${B.npcs.length} NPCs needs a size of about ${Math.ceil(2 * (half + 34))}`)

  // ================================================================ 1. plan
  const plaza = { x0: cx - P / 2, z0: cz - P / 2, x1: cx + P / 2 - 1, z1: cz + P / 2 - 1 }
  const R = { x0: plaza.x0 - ROAD, z0: plaza.z0 - ROAD, x1: plaza.x1 + ROAD, z1: plaza.z1 + ROAD } // the ring road
  ctx.layout.plaza = plaza
  grid.reserve(R.x0, R.z0, R.x1, R.z1, 'plaza')
  const pads = []
  const slot = (s, pad = 1) => {
    grid.reserve(s.x0, s.z0, s.x1, s.z1, s.kind, pad)
    pads.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, y: FY, blend: 5 })
    return s
  }
  // the four lot bands round the road: the range along the road, the edge next to it, the facing
  const bands = {
    north: { a0: R.x0, a1: R.x1, inner: R.z0 - 1, facing: 'south' },
    south: { a0: R.x0, a1: R.x1, inner: R.z1 + 1, facing: 'north' },
    west: { a0: R.z0 + FORE, a1: R.z1 - FORE, inner: R.x0 - 1, facing: 'east' },
    east: { a0: R.z0 + FORE, a1: R.z1 - FORE, inner: R.x1 + 1, facing: 'west' },
  }
  const rectOf = (side, a, w, d, setback = 1) => {
    const Bd = bands[side]
    if (side === 'north') return { x0: a, x1: a + w - 1, z1: Bd.inner - setback, z0: Bd.inner - setback - d + 1 }
    if (side === 'south') return { x0: a, x1: a + w - 1, z0: Bd.inner + setback, z1: Bd.inner + setback + d - 1 }
    if (side === 'west') return { z0: a, z1: a + w - 1, x1: Bd.inner - setback, x0: Bd.inner - setback - d + 1 }
    return { z0: a, z1: a + w - 1, x0: Bd.inner + setback, x1: Bd.inner + setback + d - 1 }
  }
  const mid = side => Math.round((bands[side].a0 + bands[side].a1) / 2)
  // the centre pieces: the hero wall north (the boards 7 back from the road: the podium steps reach
  // 6 in front of them), the crate yard west, the RTP gate south, the spoke road east
  const hero = slot({ kind: 'hero', ...rectOf('north', cx - Math.floor(heroW / 2), heroW, 17, 1), y: FY, cx, width: heroW })
  hero.z = hero.z1 - 7
  const crates = B.crates.length ? slot({ kind: 'crates', ...rectOf('west', mid('west') - Math.floor(crateW / 2), crateW, 12, 1), y: FY, facing: 'east' }) : null
  const rtp = B.rtp ? slot({ kind: 'rtp', ...rectOf('south', cx - 7, 15, 7, 0), y: FY }) : null
  if (rtp) rtp.z = rtp.z0 + 3
  const spoke = { x0: R.x1 + 1, x1: Math.min(S - 4, R.x1 + BAND + 2), z0: cz - 3, z1: cz + 3 }
  grid.reserve(spoke.x0, spoke.z0, spoke.x1, spoke.z1, 'road')

  // the lots: the four corner halls (with forecourts open to the road), then each band's halves
  // either side of its centre piece, lots 11-15 wide with the leftover spread evenly
  const lots = []
  for (const [corner, rect, facing] of [
    ['nw', { x0: R.x0 - BAND, x1: R.x0 - 2, z0: R.z0 - BAND, z1: R.z0 - 2 }, 'south'],
    ['ne', { x0: R.x1 + 2, x1: R.x1 + BAND, z0: R.z0 - BAND, z1: R.z0 - 2 }, 'south'],
    ['sw', { x0: R.x0 - BAND, x1: R.x0 - 2, z0: R.z1 + 2, z1: R.z1 + BAND }, 'north'],
    ['se', { x0: R.x1 + 2, x1: R.x1 + BAND, z0: R.z1 + 2, z1: R.z1 + BAND }, 'north'],
  ]) {
    lots.push({ ...rect, facing, corner: true, rank: corner[0] === 'n' ? 0 : 3 })
    const f = corner[0] === 'n' ? { z0: R.z0, z1: R.z0 + FORE - 1 } : { z0: R.z1 - FORE + 1, z1: R.z1 }
    grid.reserve(rect.x0, f.z0, rect.x1 + 1, f.z1, 'road')
  }
  const forecourts = lots.map(l => (l.rank === 0 ? { x0: l.x0, x1: l.x1 + 1, z0: R.z0, z1: R.z0 + FORE - 1 } : { x0: l.x0, x1: l.x1 + 1, z0: R.z1 - FORE + 1, z1: R.z1 }))
  const centreSpan = { north: [hero.x0, hero.x1], west: crates ? [crates.z0, crates.z1] : [mid('west') - 4, mid('west') + 4], south: rtp ? [rtp.x0, rtp.x1] : [cx - 4, cx + 4], east: [spoke.z0 - 1, spoke.z1 + 1] }
  for (const side of ['north', 'west', 'east', 'south']) {
    const Bd = bands[side]
    const [c0, c1] = centreSpan[side]
    for (const [s0, s1] of [[Bd.a0, c0 - 3], [c1 + 3, Bd.a1]]) {
      const segs = []
      for (let a = s0; s1 - a + 1 >= 11;) {
        const w = Math.min(s1 - a + 1, 11 + 2 * rng.int(0, 2))
        segs.push(w)
        a += w + 2 + rng.int(0, 2)
      }
      const used = segs.reduce((s, w) => s + w, 0)
      const gap = segs.length > 1 ? Math.floor((s1 - s0 + 1 - used) / (segs.length - 1)) : 0
      let at = s0 + (segs.length === 1 ? Math.floor((s1 - s0 + 1 - used) / 2) : 0)
      for (const w of segs) {
        const r = rectOf(side, at, w, 11 + 2 * rng.int(0, 1), 1 + rng.int(0, 1))
        const dz = (r.z0 + r.z1) / 2 - cz
        lots.push({ ...r, facing: Bd.facing, rank: side === 'north' ? 1 : side === 'south' ? 4 : 2 + (dz > 0 ? 1 : 0) + Math.abs(dz) / 1000 })
        at += w + gap
      }
    }
  }
  lots.sort((p, q) => p.rank - q.rank)
  // the NPCs move in: halls on the corners, shops in view order, spare lots become houses
  const queue = [...B.npcs]
  const buildings = lots.map((lot, i) => {
    const npc = queue.shift()
    const kind = lot.corner ? 'hall' : npc ? 'shop' : 'house'
    return slot({ kind, ...lot, y: FY, seed: ctx.seed * 17 + i, storeys: kind === 'hall' || rng.chance(0.45) ? 2 : 1, npc, label: npc?.label })
  })
  if (queue.length) ctx.warn(`${queue.length} NPC(s) got no building (${queue.map(n => n.label).join(', ')}); raise the size`)

  // outside the town: the PvP arena at the end of the spoke road, the AFK park in a free corner
  const ax0 = spoke.x1 + 2
  const aw = Math.min(32, Math.round(islandR - (ax0 - cx) - 6))
  const pvp = B.pvp && aw >= 16 ? slot({ kind: 'pvp', x0: ax0, x1: ax0 + aw, z0: cz - Math.floor(aw / 2), z1: cz + Math.ceil(aw / 2), y: FY, entrance: 'west' }, 2) : null
  if (!pvp) spoke.x1 = R.x1 + BAND
  let afk = null
  if (B.afk)
    for (const [ox, oz] of [[-1, 1], [-1, -1], [1, 1]]) {
      const x = cx + ox * (half + 14)
      const z = cz + oz * (half + 10)
      const s = { kind: 'afk', x0: Math.round(x - 9), x1: Math.round(x + 9), z0: Math.round(z - 8), z1: Math.round(z + 8), y: FY }
      const inside = [[s.x0, s.z0], [s.x1, s.z0], [s.x0, s.z1], [s.x1, s.z1]].every(([px, pz]) => Math.hypot(px - cx, pz - cz) < islandR - 3)
      if (inside && grid.free(s.x0 - 2, s.z0 - 2, s.x1 + 2, s.z1 + 2)) {
        afk = slot(s, 2)
        break
      }
    }
  // your pieces (CUSTOM.plan), before the landmarks and the raised areas
  const L = { cx, cz, FY, S, spawnS, W, islandR, P, plaza, road: R, half, hero, crates, rtp, spoke, buildings, pvp, afk, pads, slot, doors: [] }
  const mine = CUSTOM.plan(ctx, L) ?? {}
  const landmarks = planLandmarks(ctx, { kinds, ring: Math.round(half * 1.42) + 2, islandR })
  for (const m of landmarks) pads.push({ x0: m.x - m.r, z0: m.z - m.r, x1: m.x + m.r, z1: m.z + m.r, y: FY, blend: 5 })
  const lo = W
  const hi = W + spawnS - 1
  const pit = B.warzone?.moshpit !== false && W ? { x: Math.round(cx - spawnS / 4), z: Math.round(lo - W / 2), r: Math.min(12, Math.floor(W / 2 - 6)) } : null
  const hill = B.warzone?.koth !== false && W ? { x: cx + Math.round(spawnS / 6), z: Math.round(hi + W / 2), r: 8 } : null
  for (const p of [pit, hill]) if (p) pads.push({ x0: p.x - p.r - 3, z0: p.z - p.r - 3, x1: p.x + p.r + 3, z1: p.z + p.r + 3, y: FY, blend: 4 })
  const ground = planGround(ctx, { terraces: B.terraces, rocks: B.rocks, islandR, inner: half + 2 })

  // ================================================================ 2. the site: the town level, the land rolling round it
  const T = { x0: R.x0 - BAND - 1, x1: R.x1 + BAND + 1, z0: R.z0 - BAND - 1, z1: R.z1 + BAND + 1 }
  buildSite(ctx, {
    pads,
    mounds: ground.mounds,
    flat: (x, z) => (x >= T.x0 && x <= T.x1 && z >= T.z0 && z <= T.z1) || (z >= spoke.z0 - 2 && z <= spoke.z1 + 2 && x >= R.x1 && x <= spoke.x1 + 4),
    ...(W ? { shape: 'square', radius: S / 2 - 3 } : {}),
  })

  // ================================================================ 3. paving: road, plaza, the rose
  paveRect(ctx, { ...R, field: ctx.paint.path, border: theme.paving.border })
  paveRect(ctx, { ...plaza, field: ctx.paint.field, border: theme.paving.border, corner: 0 })
  const rr = Math.max(8, Math.floor(P / 2) - 7) // the rose ring round the spawn
  paveRound(ctx, {
    cx, cz, r: rr, wobble: 0,
    rings: [
      { r0: 0, r1: 1.5, paint: 'minecraft:chiseled_quartz_block' },
      { r0: 1.5, r1: 3.5, paint: theme.plinth.includes('quartz') ? 'minecraft:smooth_quartz' : 'minecraft:polished_diorite' },
      { r0: 3.5, r1: 4.6, paint: theme.paving.border },
      { r0: 7.5, r1: 8.4, paint: theme.paving.inlay },
      { r0: rr - 1, r1: rr + 1, paint: theme.paving.border },
    ],
  })
  // cross walks from the rose out to the four road mouths
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]])
    for (let k = rr + 1; k <= P / 2; k += 1)
      for (let w = -2; w <= 2; w += 1) b.set(cx + dx * k + (dz ? w : 0), FY, cz + dz * k + (dx ? w : 0), Math.abs(w) === 2 ? theme.paving.border : ctx.paint.path)
  b.spawnPoint([cx, FY, cz], 'north')
  for (const f of forecourts) paveRect(ctx, { ...f, field: ctx.paint.path })

  // ================================================================ 4. the town
  ctx.place(heroWall, { ...hero, facing: 'south', boards: B.boards, name: B.signs ? B.name.toUpperCase() : null })
  if (crates) {
    ctx.place(crateYard, { ...crates, crates: B.crates }, { hedge, lamp })
    if (B.signs) ctx.place(signStand, 'CRATES', [crates.x0 + 1, Math.round((crates.z0 + crates.z1) / 2)], 'east', B.signs)
  }
  if (rtp) b.portal([cx - 2, FY + 1, rtp.z], [cx + 2, FY + 5, rtp.z], { ...M, id: 'rtp', label: 'Random Teleport', kind: 'rtp', facing: 'north' })
  for (const s of buildings) {
    const res = ctx.place(building, s)
    if (!res?.door) continue
    L.doors.push(res.door)
    // a 3-wide walk from the door straight to the road
    const [dx, dz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[s.facing]
    let [x, , z] = res.door
    for (let k = 0; k < 6 && grid.tag(x, z) !== 'plaza'; k += 1, x += dx, z += dz)
      for (const w of [-1, 0, 1]) {
        const px = x + (dz ? w : 0)
        const pz = z + (dx ? w : 0)
        if (ctx.site.groundY(px, pz) === FY && /grass|dirt|podzol|moss|snow|mud|sand/.test(b.nameAt(px, FY, pz) ?? '')) {
          b.set(px, FY, pz, ctx.paint.path)
          ctx.site.paved[px + S * pz] = 1
        }
      }
  }
  if (pvp) {
    ctx.place(pvpArena, pvp)
    pavePath(ctx, [[R.x1, cz], [pvp.x0 - 1, cz]], { width: 5 })
  } else pavePath(ctx, [[R.x1, cz], [spoke.x1, cz]], { width: 5 })
  if (rtp) pavePath(ctx, [[cx, rtp.z1 + 1], [cx + rng.range(-5, 5), Math.min(S - 4, cz + islandR - 5)]], { width: 3 })
  if (afk) {
    ctx.place(afkPark, afk)
    const ax = Math.round((afk.x0 + afk.x1) / 2)
    const az = Math.round((afk.z0 + afk.z1) / 2)
    pavePath(ctx, [[ax < cx ? R.x0 : R.x1, az < cz ? R.z0 : R.z1], [ax, az]], { width: 3 })
  }
  buildExtras(ctx, { landmarks, rocks: ground.rocks, mounds: ground.mounds })

  // ================================================================ 5. plaza dressing
  // a quarter-round garden in every plaza corner (grass, a feature tree, flower drifts, bushes, a
  // bench facing the rose, a lamp), so the hub has no dead floor
  const Rg = Math.max(7, Math.min(Math.round(0.207 * P + 4), Math.floor(P / 2) - 12))
  const trim = kit.material(theme.trim)
  const flowers = kit.palette(Object.fromEntries(theme.flowers.map(([w, f]) => [f, w])), { scale: 2, seed: ctx.seed + 9 })
  ;[[plaza.x0, plaza.z0, 1, 1], [plaza.x1, plaza.z0, -1, 1], [plaza.x0, plaza.z1, 1, -1], [plaza.x1, plaza.z1, -1, -1]].forEach(([gx, gz, sx, sz], i) => {
    for (let dx = 0; dx <= Rg + 1; dx += 1)
      for (let dz = 0; dz <= Rg + 1; dz += 1) {
        const [x, z] = [gx + sx * dx, gz + sz * dz]
        const d = Math.hypot(dx, dz)
        if (d > Rg + 0.5) continue
        if (d > Rg - 0.5) {
          b.set(x, FY, z, theme.paving.border)
          b.set(x, FY + 1, z, trim.slab ? `${trim.slab}[type=bottom]` : theme.paving.border)
          continue
        }
        b.set(x, FY, z, kit.hash01(x, 5, z, ctx.seed) < 0.15 ? 'minecraft:moss_block' : theme.ground.snow_block ? 'minecraft:snow_block' : 'minecraft:grass_block')
        ctx.site.paved[x + S * z] = 0
        if (d > 3 && kit.noise.coherent01(x, 0, z, { scale: 3, seed: ctx.seed + i }) > 0.45 && kit.hash01(x, 7, z, ctx.seed) < 0.7) b.set(x, FY + 1, z, flowers)
      }
    const [tx, tz] = [gx + sx * Math.round(Rg * 0.42), gz + sz * Math.round(Rg * 0.42)]
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) b.remove(tx + dx, FY + 1, tz + dz)
    ctx.place(featureTree, [tx, FY, tz], { size: 'medium', seed: ctx.seed + 40 + i, maxRadius: Math.max(4, Rg - 3), maxHeight: 14 })
    for (const [ox, oz] of [[Math.round(Rg * 0.75), 2], [2, Math.round(Rg * 0.75)]]) ctx.place(bushAt, [gx + sx * ox, FY, gz + sz * oz], { r: 1.4, seed: ctx.seed + i + ox })
    const ba = Math.round(Rg / Math.SQRT2)
    const [bx, bz] = [gx + sx * (ba + 1), gz + sz * (ba + 1)]
    ctx.place(bench, [bx, FY, bz], Math.abs(bx - cx) > Math.abs(bz - cz) ? (sx > 0 ? 'east' : 'west') : (sz > 0 ? 'south' : 'north'), { length: 3, seed: i })
    ctx.place(lamp, [gx + sx * (ba + 3), FY, gz + sz * (ba - 1)], { kind: 'post', seed: i })
  })
  // top-3 pillar sets inside the rose, north, either side of the walk, facing the spawn
  B.top3.slice(0, 2).forEach((t, i) => ctx.place(top3Pillars, { x: cx + (i === 0 ? -11 : 11), z: cz - rr + 2, facing: 'south', id: t.id, label: t.label }))
  // planters on the rose's diagonals, stalls along the east and west plaza edges between the gardens
  const pr = Math.round(rr * 0.62)
  ;[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], i) => ctx.place(planter, [cx + sx * pr, FY, cz + sz * pr], { r: 2, tree: P >= 50, seed: ctx.seed + 60 + i }))
  const stallZ = Math.round((P / 2 - Rg + 4) / 2)
  if (P / 2 - Rg >= 12) for (const [x, f] of [[plaza.x0 + 3, 'east'], [plaza.x1 - 3, 'west']]) for (const sgn of [-1, 1]) ctx.place(stall, [x, FY, cz + sgn * stallZ], f, { width: 5, seed: ctx.seed + sgn })
  for (const [x, z, f] of [[cx - 6, cz - rr - 3, 'south'], [cx + 6, cz + rr + 3, 'north'], [cx - rr - 3, cz + 6, 'east'], [cx + rr + 3, cz - 6, 'west']]) ctx.place(bench, [x, FY, z], f, { length: 3 })
  // lamps along both kerbs of the ring road, props by every third shop
  for (let a = R.x0 + 4; a <= R.x1 - 4; a += 12) for (const z of [plaza.z0 - 1, plaza.z1 + 1]) if (Math.abs(a - cx) > 4) ctx.place(lamp, [a, FY, z], { kind: 'post' })
  for (let a = R.z0 + 10; a <= R.z1 - 4; a += 12) for (const x of [plaza.x0 - 1, plaza.x1 + 1]) if (Math.abs(a - cz) > 4) ctx.place(lamp, [x, FY, a], { kind: 'post' })
  for (const s of buildings.filter(l => !l.corner && l.seed % 3 === 0)) {
    const x = s.facing === 'east' ? s.x0 - 1 : s.facing === 'west' ? s.x1 + 1 : s.x1 + 2
    const z = s.facing === 'north' ? s.z1 + 1 : s.facing === 'south' ? s.z0 - 1 : s.z1 + 2
    if (grid.tag(x, z) !== 'plaza') ctx.place(clutter, [x, ctx.site.groundY(x, z), z], ['barrels', 'crates', 'pots', 'firewood'][s.seed % 4])
  }

  // ================================================================ 6. the warzone (optional)
  if (W) {
    if (pit) ctx.place(moshpit, [pit.x, pit.z], { r: pit.r })
    if (hill) ctx.place(koth, [hill.x, hill.z])
    ctx.place(warzoneBand, { spawn: [lo, lo, hi, hi], label: B.warzone.label ?? 'Warzone', keepClear: [pit, hill && { ...hill, r: 12 }].filter(Boolean) })
    b.region('warzone', [0, 0, 0], [S - 1, ctx.H - 1, S - 1], { pvp: 'allow', 'mob-spawning': 'deny', priority: 5 })
  }

  CUSTOM.build(ctx, L, mine)
  ctx.place(landscapePass)
  CUSTOM.finish(ctx, L, mine)
  return finishSpawn(ctx, { safeZone: [lo, lo, hi, hi] })
}
