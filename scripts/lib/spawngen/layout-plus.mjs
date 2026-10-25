// Spawn+ (DonutSMP-like): a town where every NPC has its own building.
//
//   players spawn in the middle of a square hub plaza facing north
//   a ring road runs round the plaza; outside it a band of lots, every lot a building facing the road
//   north   the hero wall (leaderboards + the server name) across the road, 30-45 blocks out
//   west    the crates hall in the middle of the west band
//   south   the RTP gate in the middle of the south band, a path out beyond it
//   east    a spoke road out to the PvP arena
//   corners landmark halls (the first NPCs: shop, auction...), the AFK park outside the town
// The plaza grows with the NPC count until every NPC has a lot; spare lots become plain houses.

import { building, crateHall, heroWall } from './buildings.mjs'
import { afkPark, bench, bushAt, featureTree, lamp, planter, pvpArena, stall, clutter } from './landscape.mjs'
import { paveRect, paveRound, pavePath } from './site.mjs'

const ROAD = 5 // ring road width
const BAND = 16 // lot band depth (building depth + setback)
const FORE = 6 // the corner halls' forecourts: the ends of the west and east bands, paved to the road

// the hub plaza side P that gives every NPC a lot (lots ≥ 11 wide, ≥ 2 apart, two halves per band
// either side of its centre piece, plus the four corner halls)
export function hubOf(brief) {
  const N = brief.npcs.length
  const nc = brief.crates.length
  const nb = Math.max(1, brief.leaderboards.length)
  const heroW = Math.max(nb * 9 + (nb - 1) * 3 + 16, 34)
  const crateW = nc ? Math.max(17, nc * 5 + 7) : 0
  // west/east bands also give 6 at each end to the corner halls' forecourts
  const centre = { north: heroW, west: (crateW || 9) + 12, south: 15, east: 9 + 12 }
  const capacity = P => {
    const Lb = P + 2 * ROAD
    return Object.values(centre).reduce((s, w) => s + 2 * Math.max(0, Math.floor(((Lb - w) / 2 - 3 + 2) / 13)), 0) + 4
  }
  let P = 36
  while (capacity(P) < N && P < 200) P += 2
  return { P, heroW, crateW, half: P / 2 + ROAD + BAND }
}
export const recommendSize = brief => 2 * (hubOf(brief).half + 40)

export function plan(ctx) {
  const { brief, S, FY, C, rng, grid } = ctx
  const [cx, cz] = C
  const N = brief.npcs.length
  const nc = brief.crates.length
  const { P, heroW, crateW, half } = hubOf(brief)
  const islandR = S / 2 - 3
  if (half + 12 > islandR) ctx.warn(`a spawn+ with ${N} NPCs needs a size of about ${Math.ceil(2 * (half + 34))}; ${S} is tight`)
  const L = { type: 'plus', P, islandR, pads: [], slots: [], paths: [], lots: [], spawn: [cx, FY, cz] }
  const px0 = cx - P / 2
  const px1 = px0 + P - 1
  const pz0 = cz - P / 2
  const pz1 = pz0 + P - 1
  L.plaza = { x0: px0, z0: pz0, x1: px1, z1: pz1 }
  L.road = { x0: px0 - ROAD, z0: pz0 - ROAD, x1: px1 + ROAD, z1: pz1 + ROAD }
  grid.reserve(L.road.x0, L.road.z0, L.road.x1, L.road.z1, 'plaza')
  const reserve = (s, pad = 1) => {
    grid.reserve(s.x0, s.z0, s.x1, s.z1, s.kind, pad)
    L.slots.push(s)
    return s
  }
  const R = L.road
  // the four bands, as [along-axis range, the band's inner edge, facing toward the road]
  const bands = {
    north: { a0: R.x0, a1: R.x1, inner: R.z0 - 1, facing: 'south' },
    south: { a0: R.x0, a1: R.x1, inner: R.z1 + 1, facing: 'north' },
    west: { a0: R.z0 + FORE, a1: R.z1 - FORE, inner: R.x0 - 1, facing: 'east' },
    east: { a0: R.z0 + FORE, a1: R.z1 - FORE, inner: R.x1 + 1, facing: 'west' },
  }
  // rect of a band segment [a, a + w) at depth d from the road
  const rectOf = (side, a, w, d, setback = 1) => {
    const B = bands[side]
    if (side === 'north') return { x0: a, x1: a + w - 1, z1: B.inner - setback, z0: B.inner - setback - d + 1 }
    if (side === 'south') return { x0: a, x1: a + w - 1, z0: B.inner + setback, z1: B.inner + setback + d - 1 }
    if (side === 'west') return { z0: a, z1: a + w - 1, x1: B.inner - setback, x0: B.inner - setback - d + 1 }
    return { z0: a, z1: a + w - 1, x0: B.inner + setback, x1: B.inner + setback + d - 1 }
  }
  const mid = side => Math.round((bands[side].a0 + bands[side].a1) / 2)

  // the centre pieces of each band
  // the boards' podium steps reach 6 in front of the boards, so the boards stand 7 back from the road
  L.hero = reserve({ kind: 'hero', ...rectOf('north', cx - Math.floor(heroW / 2), heroW, 17, 1), y: FY, cx, width: heroW })
  L.hero.z = L.hero.z1 - 7
  if (nc) L.crates = reserve({ kind: 'crates', ...rectOf('west', mid('west') - Math.floor(crateW / 2), crateW, 12, 1), y: FY, facing: 'east' })
  if (brief.features.rtp) {
    const r = rectOf('south', cx - 7, 15, 7, 0)
    L.rtp = reserve({ kind: 'rtp', ...r, y: FY, z: r.z0 + 3 })
  }
  const spoke = { x0: R.x1 + 1, x1: Math.min(S - 4, R.x1 + BAND + 2), z0: cz - 3, z1: cz + 3 }
  grid.reserve(spoke.x0, spoke.z0, spoke.x1, spoke.z1, 'road')

  // the lots: walk each band from its corner, skipping the centre piece, lots 11-15 wide with 2-4 gaps
  const lots = []
  const corners = [
    { side: 'north', corner: 'nw', rect: { x0: R.x0 - BAND, x1: R.x0 - 2, z0: R.z0 - BAND, z1: R.z0 - 2 }, facing: 'south' },
    { side: 'north', corner: 'ne', rect: { x0: R.x1 + 2, x1: R.x1 + BAND, z0: R.z0 - BAND, z1: R.z0 - 2 }, facing: 'south' },
    { side: 'south', corner: 'sw', rect: { x0: R.x0 - BAND, x1: R.x0 - 2, z0: R.z1 + 2, z1: R.z1 + BAND }, facing: 'north' },
    { side: 'south', corner: 'se', rect: { x0: R.x1 + 2, x1: R.x1 + BAND, z0: R.z1 + 2, z1: R.z1 + BAND }, facing: 'north' },
  ]
  for (const c of corners) lots.push({ ...c.rect, facing: c.facing, corner: true, rank: c.corner.startsWith('n') ? 0 : 3 })
  // each corner hall faces its forecourt (between it and the side band), which opens onto the road
  L.forecourts = corners.map(c => {
    const f = c.corner.startsWith('n') ? { z0: R.z0, z1: R.z0 + FORE - 1 } : { z0: R.z1 - FORE + 1, z1: R.z1 }
    const r = { x0: c.rect.x0, x1: c.rect.x1 + 1, ...f }
    grid.reserve(r.x0, r.z0, r.x1, r.z1, 'road')
    return r
  })
  const centreSpan = { north: [L.hero.x0, L.hero.x1], west: L.crates ? [L.crates.z0, L.crates.z1] : [mid('west') - 4, mid('west') + 4], south: L.rtp ? [L.rtp.x0, L.rtp.x1] : [cx - 4, cx + 4], east: [spoke.z0 - 1, spoke.z1 + 1] }
  for (const side of ['north', 'west', 'east', 'south']) {
    const B = bands[side]
    const [c0, c1] = centreSpan[side]
    for (const [s0, s1] of [[B.a0, c0 - 3], [c1 + 3, B.a1]]) {
      let a = s0
      const segs = []
      while (s1 - a + 1 >= 11) {
        const w = Math.min(s1 - a + 1, 11 + 2 * rng.int(0, 2))
        segs.push([a, w])
        a += w + 2 + rng.int(0, 2)
      }
      // spread any leftover evenly so the street wall has steady gaps
      const used = segs.reduce((s, [, w]) => s + w, 0)
      const gap = segs.length > 1 ? Math.floor((s1 - s0 + 1 - used) / (segs.length - 1)) : 0
      let at = s0 + (segs.length === 1 ? Math.floor((s1 - s0 + 1 - used) / 2) : 0)
      for (const [, w] of segs) {
        const d = 11 + 2 * rng.int(0, 1)
        const r = rectOf(side, at, w, d, 1 + rng.int(0, 1))
        // how far from the hero's view: north band first, then the near halves of west/east, then south
        const dz = (r.z0 + r.z1) / 2 - cz
        const rank = side === 'north' ? 1 : side === 'south' ? 4 : 2 + (dz > 0 ? 1 : 0) + Math.abs(dz) / 1000
        lots.push({ ...r, facing: B.facing, rank })
        at += w + gap
      }
    }
  }
  lots.sort((a, b) => a.rank - b.rank)
  // NPCs: the first two get the north corner halls, the rest shops in view order; spare lots are houses
  const npcs = [...brief.npcs]
  for (const lot of lots) {
    const npc = npcs.shift()
    const kind = lot.corner ? 'hall' : npc ? 'shop' : 'house'
    const s = reserve({ kind, ...lot, y: FY, seed: ctx.seed * 17 + L.lots.length, storeys: kind === 'hall' ? 2 : rng.chance(0.45) ? 2 : 1, npc, label: npc?.label }, 1)
    if (kind === 'hall' && !npc) s.storeys = 2
    L.lots.push(s)
  }
  if (npcs.length) ctx.warn(`${npcs.length} NPC(s) did not get a building (${npcs.map(n => n.label).join(', ')}); raise the size`)

  // outside the town: the PvP arena east, the AFK park south-west
  const ax0 = spoke.x1 + 2
  const aw = Math.min(32, Math.round(islandR - (ax0 - cx) - 6))
  if (brief.features.pvp && aw >= 16) L.pvp = reserve({ kind: 'pvp', x0: ax0, x1: ax0 + aw, z0: cz - Math.floor(aw / 2), z1: cz + Math.ceil(aw / 2), y: FY, entrance: 'west' }, 2)
  else spoke.x1 = R.x1 + BAND
  if (brief.features.afk) {
    for (const [ox, oz] of [[-1, 1], [-1, -1], [1, 1]]) {
      const x = cx + ox * (half + 14)
      const z = cz + oz * (half + 10)
      const s = { kind: 'afk', x0: Math.round(x - 9), x1: Math.round(x + 9), z0: Math.round(z - 8), z1: Math.round(z + 8), y: FY }
      if (inside(ctx, s, islandR - 3) && grid.free(s.x0 - 2, s.z0 - 2, s.x1 + 2, s.z1 + 2)) {
        L.afk = reserve(s, 2)
        break
      }
    }
  }
  L.spoke = spoke
  for (const s of L.slots) L.pads.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, y: s.y, blend: 5 })
  // the whole town (plaza, road, lots) is level; the land rolls outside it
  const T = { x0: R.x0 - BAND - 1, x1: R.x1 + BAND + 1, z0: R.z0 - BAND - 1, z1: R.z1 + BAND + 1 }
  L.town = T
  L.flat = (x, z) => (x >= T.x0 && x <= T.x1 && z >= T.z0 && z <= T.z1) || (z >= spoke.z0 - 2 && z <= spoke.z1 + 2 && x >= R.x1 && x <= spoke.x1 + 4)
  return L
}

function inside(ctx, s, r) {
  const [cx, cz] = ctx.C
  return [[s.x0, s.z0], [s.x1, s.z0], [s.x0, s.z1], [s.x1, s.z1]].every(([x, z]) => Math.hypot(x - cx, z - cz) < r)
}

export function build(ctx) {
  const { b, kit, theme, brief, FY, C, layout: L, M, rng } = ctx
  const [cx, cz] = C
  const { plaza: P, road: R } = L

  // ---------------------------------------------------------------- paving: road, plaza, rose
  paveRect(ctx, { ...R, field: ctx.paint.path, border: theme.paving.border })
  paveRect(ctx, { ...P, field: ctx.paint.field, border: theme.paving.border, corner: 0 })
  const rr = Math.max(8, Math.floor(L.P / 2) - 7)
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
  // cross walks from the rose to the four road mouths
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    for (let k = rr + 1; k <= L.P / 2; k += 1)
      for (let w = -2; w <= 2; w += 1) {
        const x = cx + dx * k + (dz ? w : 0)
        const z = cz + dz * k + (dx ? w : 0)
        b.set(x, FY, z, Math.abs(w) === 2 ? theme.paving.border : ctx.paint.path)
      }
  }
  b.spawnPoint([cx, FY, cz], 'north')

  for (const f of L.forecourts) paveRect(ctx, { ...f, field: ctx.paint.path })

  // ---------------------------------------------------------------- the town
  ctx.place(heroWall, { ...L.hero, facing: 'south', boards: brief.leaderboards, name: brief.features.signs ? brief.name : null })
  if (L.crates) ctx.place(crateHall, { ...L.crates, crates: brief.crates })
  if (L.rtp) b.portal([cx - 2, FY + 1, L.rtp.z], [cx + 2, FY + 5, L.rtp.z], { ...M, id: 'rtp', label: 'Random Teleport', kind: 'rtp', facing: 'north' })
  for (const lot of L.lots) {
    const res = ctx.place(building, lot)
    if (res?.door) L.paths.push({ door: res.door, facing: lot.facing })
  }
  // short walks from every door to the road
  for (const { door, facing } of L.paths) {
    const [dx, dz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[facing]
    let x = door[0]
    let z = door[2]
    for (let k = 0; k < 6 && ctx.grid.tag(x, z) !== 'plaza'; k += 1) {
      for (const w of [-1, 0, 1]) {
        const px = x + (dz ? w : 0)
        const pz = z + (dx ? w : 0)
        const gy = ctx.site.groundY(px, pz)
        if (gy === FY && /grass|dirt|podzol|moss|snow|mud/.test(b.nameAt(px, gy, pz) ?? '')) {
          b.set(px, gy, pz, ctx.paint.path)
          ctx.site.paved[px + ctx.S * pz] = 1
        }
      }
      x += dx
      z += dz
    }
  }
  if (L.pvp) {
    ctx.place(pvpArena, L.pvp)
    pavePath(ctx, [[R.x1, cz], [L.pvp.x0 - 1, cz]], { width: 5 })
  } else pavePath(ctx, [[R.x1, cz], [L.spoke.x1, cz]], { width: 5 })
  if (L.rtp) pavePath(ctx, [[cx, L.rtp.z1 + 1], [cx + rng.range(-5, 5), Math.min(ctx.S - 4, cz + L.islandR - 5)]], { width: 3 })
  if (L.afk) {
    ctx.place(afkPark, L.afk)
    const ax = Math.round((L.afk.x0 + L.afk.x1) / 2)
    const az = Math.round((L.afk.z0 + L.afk.z1) / 2)
    const fromX = ax < cx ? R.x0 : R.x1
    pavePath(ctx, [[fromX, az < cz ? R.z0 : R.z1], [ax, az]], { width: 3 })
  }

  // ---------------------------------------------------------------- plaza dressing
  // a quarter-round garden in every plaza corner (grass, a feature tree, flower drifts, bushes, a
  // bench facing the rose, a lamp), so the hub has no dead floor; planters round the rose
  const Rg = Math.max(7, Math.min(Math.round(0.207 * L.P + 4), Math.floor(L.P / 2) - 12))
  const trimM = kit.material(theme.trim)
  const flowers = kit.palette(Object.fromEntries(theme.flowers.map(([w, f]) => [f, w])), { scale: 2, seed: ctx.seed + 9 })
  const gardens = [[P.x0, P.z0, 1, 1], [P.x1, P.z0, -1, 1], [P.x0, P.z1, 1, -1], [P.x1, P.z1, -1, -1]]
  gardens.forEach(([gx, gz, sx, sz], i) => {
    for (let dx = 0; dx <= Rg + 1; dx += 1)
      for (let dz = 0; dz <= Rg + 1; dz += 1) {
        const x = gx + sx * dx
        const z = gz + sz * dz
        const d = Math.hypot(dx, dz)
        if (d > Rg + 0.5) continue
        if (d > Rg - 0.5) {
          b.set(x, FY, z, theme.paving.border)
          b.set(x, FY + 1, z, trimM.slab ? `${trimM.slab}[type=bottom]` : theme.paving.border)
          continue
        }
        b.set(x, FY, z, kit.hash01(x, 5, z, ctx.seed) < 0.15 ? 'minecraft:moss_block' : theme.ground.snow_block ? 'minecraft:snow_block' : 'minecraft:grass_block')
        ctx.site.paved[x + ctx.S * z] = 0
        if (d > 3 && kit.noise.coherent01(x, 0, z, { scale: 3, seed: ctx.seed + i }) > 0.45 && kit.hash01(x, 7, z, ctx.seed) < 0.7) b.set(x, FY + 1, z, flowers)
      }
    const tx = gx + sx * Math.round(Rg * 0.42)
    const tz = gz + sz * Math.round(Rg * 0.42)
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) b.remove(tx + dx, FY + 1, tz + dz)
    ctx.place(featureTree, [tx, FY, tz], { size: 'medium', seed: ctx.seed + 40 + i, maxRadius: Math.max(4, Rg - 3), maxHeight: 14 })
    for (const [ox, oz] of [[Math.round(Rg * 0.75), 2], [2, Math.round(Rg * 0.75)]]) ctx.place(bushAt, [gx + sx * ox, FY, gz + sz * oz], { r: 1.4, seed: ctx.seed + i + ox })
    // the bench on the arc, facing the rose; a lamp beside it
    const ba = Math.round(Rg / Math.SQRT2)
    const bx = gx + sx * (ba + 1)
    const bz = gz + sz * (ba + 1)
    ctx.place(bench, [bx, FY, bz], Math.abs(bx - cx) > Math.abs(bz - cz) ? (sx > 0 ? 'east' : 'west') : (sz > 0 ? 'south' : 'north'), { length: 3, seed: i })
    ctx.place(lamp, [gx + sx * (ba + 3), FY, gz + sz * (ba - 1)], { kind: 'post', seed: i })
  })
  // planters round the rose on the diagonals
  const pr = Math.round(rr * 0.62)
  ;[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], i) => ctx.place(planter, [cx + sx * pr, FY, cz + sz * pr], { r: 2, tree: L.P >= 50, seed: ctx.seed + 60 + i }))
  // market stalls along the east and west plaza edges, clear of the gardens and the cross walk
  const stallZ = Math.round((L.P / 2 - Rg + 4) / 2)
  if (L.P / 2 - Rg >= 12) {
    for (const [x, f] of [[P.x0 + 3, 'east'], [P.x1 - 3, 'west']])
      for (const sgn of [-1, 1]) ctx.place(stall, [x, FY, cz + sgn * stallZ], f, { width: 5, seed: ctx.seed + sgn })
  }
  for (const [x, z, f] of [[cx - 6, cz - rr - 3, 'south'], [cx + 6, cz + rr + 3, 'north'], [cx - rr - 3, cz + 6, 'east'], [cx + rr + 3, cz - 6, 'west']]) ctx.place(bench, [x, FY, z], f, { length: 3 })
  // lamps on the plaza's inner kerb and along the ring road
  for (let a = R.x0 + 4; a <= R.x1 - 4; a += 12) for (const z of [P.z0 - 1, P.z1 + 1]) if (Math.abs(a - cx) > 4) ctx.place(lamp, [a, FY, z], { kind: 'post' })
  for (let a = R.z0 + 10; a <= R.z1 - 4; a += 12) for (const x of [P.x0 - 1, P.x1 + 1]) if (Math.abs(a - cz) > 4) ctx.place(lamp, [x, FY, a], { kind: 'post' })
  for (const lot of L.lots.filter(l => !l.corner && l.seed % 3 === 0)) {
    const x = lot.facing === 'east' ? lot.x0 - 1 : lot.facing === 'west' ? lot.x1 + 1 : lot.x1 + 2
    const z = lot.facing === 'north' ? lot.z1 + 1 : lot.facing === 'south' ? lot.z0 - 1 : lot.z1 + 2
    if (ctx.grid.tag(x, z) !== 'plaza') ctx.place(clutter, [x, ctx.site.groundY(x, z), z], ['barrels', 'crates', 'pots', 'firewood'][lot.seed % 4])
  }
}
