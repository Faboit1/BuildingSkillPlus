// Oakhaven — a hand-built SPAWN+ (DonutSMP-style town): every NPC gets its own building.
// Medieval theme, accent blue, 192 x 192, 14 NPCs, 4 leaderboards, 5 crates, a top-3 set, an AFK
// park, a PvP arena, and the server name in classic quartz block letters on the hero wall (the user
// asked for block letters).
//
//                         HERO WALL (boards + name)
//        [hall]  [shop] [shop]   ===============   [shop] [shop]  [hall]
//               +--------------- ring road (5) ----------------+
//   [shop]      |  garden                              garden  |      [shop]
//   CRATES      |        top3   (rose)   top3                  |      ======> PvP arena
//   (yard)      |          stalls    SPAWN    stalls           |      spoke road east
//   [shop]      |  garden                              garden  |      [shop]
//               +----------------------------------------------+
//        [hall]  [shop] [house]    RTP gate     [shop] [house]  [hall]
//    AFK park (south-west, outside town)
//
// How the numbers were chosen (references/spawns/build-guide.md §4):
//   - lots are 11-15 wide with 2-4 gaps, 11-13 deep, 1-2 back from the road: a street wall
//   - each side of the ring road has a centre piece (north the hero wall, west the crates, south
//     the RTP gate, east the spoke road) and lots either side of it; the four corners get halls
//   - 14 NPCs need 14 lots: 4 corner halls + 10 band lots, which first fit with a 70-wide plaza
//     (P); then the town is 70 + 2 x 5 (road) + 2 x 16 (lot band) = 112 across, and the canvas adds
//     ~40 of countryside each side for the arena, the AFK park and woodland: 192
//   - the first NPCs (shop, auction) get the north corner halls, the next ones the north lots (in the
//     first view), then west/east, then south
//
// Build: node scripts/run-build.mjs assets/examples/spawns/oakhaven-hub.mjs --out-dir minecraft-builds/oakhaven

import { startSpawn, finishSpawn, findSpot } from '../../spawn-parts/spawn.mjs'
import { buildSite, paveRect, paveRound, pavePath } from '../../spawn-parts/site.mjs'
import { crateYard, top3Pillars } from '../../spawn-parts/features.mjs'
import { building, heroWall } from '../../spawn-parts/buildings.mjs'
import { afkPark, bench, bushAt, clutter, featureTree, hedge, lamp, planter, pvpArena, rockOutcrop, stall, landscapePass } from '../../spawn-parts/landscape.mjs'
import { signStand } from '../../spawn-parts/signs.mjs'

const NPCS = [
  { id: 'shop', label: 'Shop' }, { id: 'auction', label: 'Auction House' }, { id: 'store', label: 'Store' },
  { id: 'kits', label: 'Kits' }, { id: 'quests', label: 'Quests' }, { id: 'sell', label: 'Sell' },
  { id: 'warps', label: 'Warps' }, { id: 'events', label: 'Events' }, { id: 'bounties', label: 'Bounties' },
  { id: 'teams', label: 'Teams' }, { id: 'tutorial', label: 'Start Here' }, { id: 'vote', label: 'Vote' },
  { id: 'duels', label: 'Duels' }, { id: 'enchanter', label: 'Enchanter' },
]
const BOARDS = [{ id: 'money', label: 'Money' }, { id: 'kills', label: 'Kills' }, { id: 'playtime', label: 'Playtime' }, { id: 'blocks', label: 'Blocks Mined' }]
const CRATES = [
  { id: 'vote', label: 'Vote', tier: 'vote' }, { id: 'common', label: 'Common', tier: 'common' }, { id: 'rare', label: 'Rare', tier: 'rare' },
  { id: 'epic', label: 'Epic', tier: 'epic' }, { id: 'legendary', label: 'Legendary', tier: 'legendary' },
]
const SIGNS = { style: 'classic', outline: true, thick: false } // the interview's sign answers

export default function build(api) {
  const ctx = startSpawn(api, { name: 'Oakhaven', size: 192, height: 110, theme: 'medieval', accent: 'blue', setting: 'valley', seed: 5 })
  const { b, kit, theme, FY, C, S, grid, rng, M } = ctx
  const [cx, cz] = C

  // ================================================================ 1. plan
  const P = 70 // the hub plaza side
  const ROAD = 5
  const BAND = 16 // the lot band: building depth + setback
  const FORE = 6 // the corner halls' forecourts at the ends of the west and east bands
  const islandR = S / 2 - 3
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
  // the rectangle of a band segment [a, a + w) at depth d, `setback` from the road
  const rectOf = (side, a, w, d, setback = 1) => {
    const B = bands[side]
    if (side === 'north') return { x0: a, x1: a + w - 1, z1: B.inner - setback, z0: B.inner - setback - d + 1 }
    if (side === 'south') return { x0: a, x1: a + w - 1, z0: B.inner + setback, z1: B.inner + setback + d - 1 }
    if (side === 'west') return { z0: a, z1: a + w - 1, x1: B.inner - setback, x0: B.inner - setback - d + 1 }
    return { z0: a, z1: a + w - 1, x0: B.inner + setback, x1: B.inner + setback + d - 1 }
  }
  // the centre pieces: the hero wall north (61 wide: 4 boards x 9 + gaps + towers), the crate yard
  // west (5 crates x 5 + 7 = 32 long), the RTP gate south, the spoke road east
  const heroW = 61
  const hero = slot({ kind: 'hero', ...rectOf('north', cx - 30, heroW, 17), y: FY, cx, width: heroW })
  hero.z = hero.z1 - 7 // the boards stand 7 back from the road: the podium steps reach 6 in front
  const westMid = Math.round((bands.west.a0 + bands.west.a1) / 2)
  const crates = slot({ kind: 'crates', ...rectOf('west', westMid - 16, 32, 12), y: FY, facing: 'east' })
  const rtp = slot({ kind: 'rtp', ...rectOf('south', cx - 7, 15, 7, 0), y: FY })
  rtp.z = rtp.z0 + 3
  const spoke = { x0: R.x1 + 1, x1: R.x1 + BAND + 2, z0: cz - 3, z1: cz + 3 }
  grid.reserve(spoke.x0, spoke.z0, spoke.x1, spoke.z1, 'road')

  // the lots: the four corner halls first, then walk each band's halves either side of its centre
  // piece, lots 11-15 wide with 2-4 gaps (the leftover spread evenly so the street wall is steady)
  const lots = []
  for (const [corner, rect, facing] of [
    ['nw', { x0: R.x0 - BAND, x1: R.x0 - 2, z0: R.z0 - BAND, z1: R.z0 - 2 }, 'south'],
    ['ne', { x0: R.x1 + 2, x1: R.x1 + BAND, z0: R.z0 - BAND, z1: R.z0 - 2 }, 'south'],
    ['sw', { x0: R.x0 - BAND, x1: R.x0 - 2, z0: R.z1 + 2, z1: R.z1 + BAND }, 'north'],
    ['se', { x0: R.x1 + 2, x1: R.x1 + BAND, z0: R.z1 + 2, z1: R.z1 + BAND }, 'north'],
  ]) {
    lots.push({ ...rect, facing, corner: true, rank: corner[0] === 'n' ? 0 : 3 })
    // its forecourt between it and the side band, open to the road
    const f = corner[0] === 'n' ? { z0: R.z0, z1: R.z0 + FORE - 1 } : { z0: R.z1 - FORE + 1, z1: R.z1 }
    grid.reserve(rect.x0, f.z0, rect.x1 + 1, f.z1, 'road')
  }
  const centreSpan = { north: [hero.x0, hero.x1], west: [crates.z0, crates.z1], south: [rtp.x0, rtp.x1], east: [spoke.z0 - 1, spoke.z1 + 1] }
  for (const side of ['north', 'west', 'east', 'south']) {
    const B = bands[side]
    const [c0, c1] = centreSpan[side]
    for (const [s0, s1] of [[B.a0, c0 - 3], [c1 + 3, B.a1]]) {
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
        // view order: the north band first, then the near halves of west/east, then south
        lots.push({ ...r, facing: B.facing, rank: side === 'north' ? 1 : side === 'south' ? 4 : 2 + (dz > 0 ? 1 : 0) + Math.abs(dz) / 1000 })
        at += w + gap
      }
    }
  }
  lots.sort((p, q) => p.rank - q.rank)
  // the NPCs move in: the first two take the north corner halls, the rest shops in view order;
  // lots left over become plain houses (spare places for later NPCs)
  const queue = [...NPCS]
  const buildings = lots.map((lot, i) => {
    const npc = queue.shift()
    const kind = lot.corner ? 'hall' : npc ? 'shop' : 'house'
    return slot({ kind, ...lot, y: FY, seed: ctx.seed * 17 + i, storeys: kind === 'hall' || rng.chance(0.45) ? 2 : 1, npc, label: npc?.label })
  })
  if (queue.length) ctx.warn(`${queue.length} NPCs got no building: make the plaza bigger`)

  // outside the town: the PvP arena at the end of the spoke road, the AFK park south-west
  const ax0 = spoke.x1 + 2
  const pvp = slot({ kind: 'pvp', x0: ax0, x1: ax0 + 28, z0: cz - 14, z1: cz + 14, y: FY, entrance: 'west' }, 2)
  // (every corner of a slot must stay ~8 inside the shore: the far corner here is 84 from the middle, the shore ~93)
  const afk = slot({ kind: 'afk', x0: cx - 76, x1: cx - 60, z0: cz + 18, z1: cz + 34, y: FY }, 2)
  // rocks in the countryside
  const rocks = []
  for (let i = 0; i < 6; i += 1) {
    const s = findSpot(ctx, { r: 3, ring: [70, islandR - 8], tag: 'rock' })
    if (s) rocks.push(s)
  }

  // ================================================================ 2. the site: the town level, hills round it
  const T = { x0: R.x0 - BAND - 1, x1: R.x1 + BAND + 1, z0: R.z0 - BAND - 1, z1: R.z1 + BAND + 1 }
  buildSite(ctx, {
    pads,
    flat: (x, z) => (x >= T.x0 && x <= T.x1 && z >= T.z0 && z <= T.z1) || (z >= spoke.z0 - 2 && z <= spoke.z1 + 2 && x >= R.x1 && x <= pvp.x0),
  })

  // ================================================================ 3. paving: road, plaza, the rose
  paveRect(ctx, { ...R, field: ctx.paint.path, border: theme.paving.border })
  paveRect(ctx, { ...plaza, border: theme.paving.border })
  const rr = 28 // the rose ring round the spawn
  paveRound(ctx, {
    cx, cz, r: rr, wobble: 0,
    rings: [
      { r0: 0, r1: 1.5, paint: 'minecraft:chiseled_quartz_block' },
      { r0: 1.5, r1: 3.5, paint: 'minecraft:polished_diorite' },
      { r0: 3.5, r1: 4.6, paint: theme.paving.border },
      { r0: 7.5, r1: 8.4, paint: theme.paving.inlay },
      { r0: rr - 1, r1: rr + 1, paint: theme.paving.border },
    ],
  })
  // cross walks from the rose out to the road
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]])
    for (let k = rr + 1; k <= P / 2; k += 1)
      for (let w = -2; w <= 2; w += 1) b.set(cx + dx * k + (dz ? w : 0), FY, cz + dz * k + (dx ? w : 0), Math.abs(w) === 2 ? theme.paving.border : ctx.paint.path)
  b.spawnPoint([cx, FY, cz], 'north')

  // ================================================================ 4. the town
  ctx.place(heroWall, { ...hero, facing: 'south', boards: BOARDS, name: ctx.name.toUpperCase() })
  ctx.place(crateYard, { ...crates, crates: CRATES }, { hedge, lamp })
  ctx.place(signStand, 'CRATES', [crates.x0 + 1, Math.round((crates.z0 + crates.z1) / 2)], 'east', SIGNS)
  b.portal([cx - 2, FY + 1, rtp.z], [cx + 2, FY + 5, rtp.z], { ...M, id: 'rtp', label: 'Random Teleport', kind: 'rtp', facing: 'north' })
  for (const s of buildings) {
    const res = ctx.place(building, s)
    if (!res?.door) continue
    // a 3-wide walk from the door straight to the road
    const [dx, dz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[s.facing]
    let [x, , z] = res.door
    for (let k = 0; k < 6 && grid.tag(x, z) !== 'plaza'; k += 1, x += dx, z += dz)
      for (const w of [-1, 0, 1]) {
        const px = x + (dz ? w : 0)
        const pz = z + (dx ? w : 0)
        if (ctx.site.groundY(px, pz) === FY && /grass|dirt|podzol|moss|mud/.test(b.nameAt(px, FY, pz) ?? '')) {
          b.set(px, FY, pz, ctx.paint.path)
          ctx.site.paved[px + S * pz] = 1
        }
      }
  }
  ctx.place(pvpArena, pvp)
  b.region('pvp', [pvp.x0, FY - 2, pvp.z0], [pvp.x1, FY + 20, pvp.z1], { pvp: 'allow', priority: 20 })
  pavePath(ctx, [[R.x1, cz], [pvp.x0 - 1, cz]], { width: 5 })
  pavePath(ctx, [[cx, rtp.z1 + 1], [cx + rng.range(-5, 5), cz + islandR - 5]], { width: 3 })
  ctx.place(afkPark, afk)
  // to the AFK park through the south-west hall's forecourt (the gap between the band and the hall)
  pavePath(ctx, [[R.x0, R.z1 - 3], [afk.x0 + 8, R.z1 - 3], [afk.x0 + 8, afk.z1 + 1]], { width: 3 })

  // ================================================================ 5. plaza dressing
  // a quarter-round garden in every plaza corner (grass, a feature tree, flower drifts, bushes, a
  // bench facing the rose, a lamp), so the hub has no dead floor
  const Rg = 18
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
        b.set(x, FY, z, kit.hash01(x, 5, z, ctx.seed) < 0.15 ? 'minecraft:moss_block' : 'minecraft:grass_block')
        ctx.site.paved[x + S * z] = 0
        if (d > 3 && kit.noise.coherent01(x, 0, z, { scale: 3, seed: ctx.seed + i }) > 0.45 && kit.hash01(x, 7, z, ctx.seed) < 0.7) b.set(x, FY + 1, z, flowers)
      }
    const [tx, tz] = [gx + sx * 8, gz + sz * 8]
    ctx.place(featureTree, [tx, FY, tz], { size: 'medium', seed: ctx.seed + 40 + i, maxRadius: 14, maxHeight: 14 })
    for (const [ox, oz] of [[13, 2], [2, 13]]) ctx.place(bushAt, [gx + sx * ox, FY, gz + sz * oz], { r: 1.4, seed: ctx.seed + i + ox })
    const ba = Math.round(Rg / Math.SQRT2)
    const [bx, bz] = [gx + sx * (ba + 1), gz + sz * (ba + 1)]
    ctx.place(bench, [bx, FY, bz], Math.abs(bx - cx) > Math.abs(bz - cz) ? (sx > 0 ? 'east' : 'west') : (sz > 0 ? 'south' : 'north'), { length: 3, seed: i })
    ctx.place(lamp, [gx + sx * (ba + 3), FY, gz + sz * (ba - 1)], { kind: 'post', seed: i })
  })
  // top-3 pillars inside the rose, north, left of the walk; planters on the rose's diagonals
  ctx.place(top3Pillars, { x: cx - 11, z: cz - rr + 2, facing: 'south', id: 'spenders', label: 'Top Spenders' })
  ;[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], i) => ctx.place(planter, [cx + sx * 17, FY, cz + sz * 17], { r: 2, tree: true, seed: ctx.seed + 60 + i }))
  // market stalls along the east and west plaza edges between the gardens
  for (const [x, f] of [[plaza.x0 + 3, 'east'], [plaza.x1 - 3, 'west']]) for (const sgn of [-1, 1]) ctx.place(stall, [x, FY, cz + sgn * 9], f, { width: 5, seed: ctx.seed + sgn })
  // lamps along both kerbs of the ring road, props by every third shop
  for (let a = R.x0 + 4; a <= R.x1 - 4; a += 12) for (const z of [plaza.z0 - 1, plaza.z1 + 1]) if (Math.abs(a - cx) > 4) ctx.place(lamp, [a, FY, z], { kind: 'post' })
  for (let a = R.z0 + 10; a <= R.z1 - 4; a += 12) for (const x of [plaza.x0 - 1, plaza.x1 + 1]) if (Math.abs(a - cz) > 4) ctx.place(lamp, [x, FY, a], { kind: 'post' })
  for (const s of buildings.filter(l => !l.corner && l.seed % 3 === 0)) {
    const x = s.facing === 'east' ? s.x0 - 1 : s.facing === 'west' ? s.x1 + 1 : s.x1 + 2
    const z = s.facing === 'north' ? s.z1 + 1 : s.facing === 'south' ? s.z0 - 1 : s.z1 + 2
    if (grid.tag(x, z) !== 'plaza') ctx.place(clutter, [x, ctx.site.groundY(x, z), z], ['barrels', 'crates', 'pots', 'firewood'][s.seed % 4])
  }
  for (const r of rocks) ctx.place(rockOutcrop, [r.x, ctx.site.groundY(r.x, r.z), r.z], { r: rng.range(1.8, 3), seed: r.x + r.z })

  ctx.place(landscapePass)
  return finishSpawn(ctx)
}
