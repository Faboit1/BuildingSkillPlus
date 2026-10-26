// Normal spawn (FreshSMP-like, the autumn reference): a big flat plaza ringed by big buildings.
//
//   players spawn on the rose in the middle facing north
//   NPCs stand on 1-block plinths in rings round the spawn, all facing it (an inner ring, then an
//     outer ring when there are more), the rings broken by the four path mouths
//   feature trees in grass beds on the plaza between the rings
//   north   the leaderboards: holograms over low plinths with a top-3 podium (no wall, no sign)
//   west    the crates: open air, on carved plinths in an arc facing the spawn
//   east    the PvP zone, a ruin behind a red line, outside the plaza
//   south   the RTP gate and the way out
//   round the plaza a street ring, then a ring of big buildings (2-3 storey houses, halls, a tower)
//   facing it; trees beyond. Flat ground everywhere in town, no block-letter signs.

import { building } from '../../../assets/spawn-parts/buildings.mjs'
import { afkPark, bench, bushAt, clutter, featureTree, lamp, pvpArena } from '../../../assets/spawn-parts/landscape.mjs'
import { boardsPlaza, crateCourt, top3Pillars } from '../../../assets/spawn-parts/features.mjs'
import { paveRound, pavePath } from '../../../assets/spawn-parts/site.mjs'
import { facingToward, polar, yawToward } from './index.mjs'
import { buildExtras, extrasRoom, planExtras, planGround, signStand } from './extras.mjs'

const SPACING = 6 // blocks of arc between NPCs
const MOUTH = 9 // a path mouth through a ring
const R1 = 12 // the inner NPC ring

// the rings and the plaza radius for N NPCs: the inner ring takes what fits, the outer ring the rest
// (it skips the leaderboard and crate sectors as well as the path mouths)
export function ringsOf(N) {
  const c1 = Math.floor((2 * Math.PI * R1 - 4 * MOUTH) / SPACING)
  const n1 = Math.min(N, c1)
  const n2 = N - n1
  const outerShare = (360 - 2 * 44 - 2 * 12) / 360
  const R2 = n2 ? Math.max(22, Math.ceil((n2 * SPACING) / (2 * Math.PI * outerShare))) : 22
  const Rp = Math.max(40, R2 + 14)
  return { n1, n2, R1, R2, Rp }
}
export const recommendSize = brief => {
  const { Rp } = ringsOf(brief.npcs.length)
  const big = extrasRoom(brief)
  return 2 * Math.max(Rp + 70, big ? Rp + 14 + 2 * big : 0)
}

export function plan(ctx) {
  const { brief, S, FY, C, rng, grid } = ctx
  const [cx, cz] = C
  const N = brief.npcs.length
  const { n1, n2, R2, Rp } = ringsOf(N)
  const islandR = ctx.spawnS / 2 - 3 // the spawn square (a warzone may surround it)
  if (islandR - Rp < 40) ctx.warn(`size ${ctx.spawnS} leaves little room round a ${Rp}-radius plaza for buildings; ${Math.ceil(recommendSize(brief) / 4) * 4} is recommended`)
  const L = { type: 'normal', plaza: { cx, cz, r: Rp + 5 }, Rp, R1, R2, islandR, pads: [], slots: [], paths: [], spawn: [cx, FY, cz] }
  const reserve = (s, pad = 1) => {
    grid.reserve(s.x0, s.z0, s.x1, s.z1, s.kind, pad)
    L.slots.push(s)
    return s
  }
  grid.reserveDisc(cx, cz, Rp + 5.5, 'plaza')
  // the four corridors out (paths), kept free of buildings
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const ax = dx ? cx + dx * Rp : cx - 4
    const bx = dx ? cx + dx * (islandR + 2) : cx + 4
    const az = dz ? cz + dz * Rp : cz - 4
    const bz = dz ? cz + dz * (islandR + 2) : cz + 4
    grid.reserve(ax, az, bx, bz, 'road')
  }

  // NPC places: the inner ring first (nearest the hero first), then the outer ring
  const ring = (r, n, skips) => {
    if (!n) return []
    const arcs = []
    let a = 0
    const sorted = skips.slice().sort((p, q) => p[0] - q[0])
    // free arcs between the skipped sectors [centre, half-width]
    const edges = sorted.map(([c, h]) => [c - h, c + h])
    for (let i = 0; i < edges.length; i += 1) {
      const next = edges[(i + 1) % edges.length]
      const from = edges[i][1]
      let to = next[0]
      if (to <= from) to += 360
      arcs.push([from, to])
    }
    void a
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
  const mouth1 = (MOUTH / (2 * Math.PI * R1)) * 180
  const inner = ring(R1, n1, [[0, mouth1], [90, mouth1], [180, mouth1], [270, mouth1]])
  const outer = ring(R2, n2, [[0, 44], [90, 12], [180, 12], [270, 44]])
  L.npcRing = brief.npcs.map((npc, k) => ({ npc, ...(k < inner.length ? inner[k] : outer[k - inner.length]) }))

  // the open-air sections on the plaza
  const nb = brief.leaderboards.length
  if (nb) L.boards = { cx, z: cz - (Rp - 6), facing: 'south', width: nb * 7 + 4 }
  const nc = brief.crates.length
  if (nc) {
    const r = Rp - 6
    const step = (SPACING / r) * (180 / Math.PI)
    L.crates = brief.crates.map((c, i) => {
      const ang = 270 + (i - (nc - 1) / 2) * step
      const [x, z] = polar(ctx, ang, r)
      return { crate: c, x: Math.round(x), z: Math.round(z), facing: facingToward([x, z], C) }
    })
  }
  // top-3 pillar sets either side of the leaderboards, facing the spawn
  L.top3 = brief.top3.map((t, i) => {
    const ang = [-34, 34, -52, 52][i] ?? 0
    const [x, z] = polar(ctx, ang, Rp - 6)
    return { ...t, x: Math.round(x), z: Math.round(z), facing: facingToward([x, z], C) }
  }).filter((t, i) => i < 4)
  if (brief.features.rtp) L.rtp = reserve({ kind: 'rtp', x0: cx - 7, x1: cx + 7, z0: cz + Rp + 1, z1: cz + Rp + 7, y: FY, z: cz + Rp + 3 })
  const aw = Math.max(22, Math.min(32, Math.round(islandR - Rp - 18)))
  if (brief.features.pvp) {
    const x0 = cx + Rp + 8
    L.pvp = reserve({ kind: 'pvp', x0, x1: x0 + aw, z0: cz - Math.floor(aw / 2), z1: cz + Math.ceil(aw / 2), y: FY, entrance: 'west' }, 3)
  }
  // feature trees in grass beds between the rings, on the diagonals
  const rt = Math.round((R1 + R2) / 2) + 1
  L.trees = [45, 135, 225, 315].map((a, i) => {
    const [x, z] = polar(ctx, a + rng.range(-6, 6), rt)
    return { x: Math.round(x), z: Math.round(z), seed: ctx.seed + i, bed: 4 }
  })
  if (brief.features.afk) {
    for (const a of [225, 135, 315, 45]) {
      const [x, z] = polar(ctx, a, Rp + 36)
      const s = { kind: 'afk', x0: Math.round(x) - 8, x1: Math.round(x) + 8, z0: Math.round(z) - 8, z1: Math.round(z) + 8, y: FY }
      if (onIsland(ctx, s, islandR - 3) && grid.free(s.x0 - 2, s.z0 - 2, s.x1 + 2, s.z1 + 2)) {
        L.afk = reserve(s, 2)
        break
      }
    }
  }

  // landmarks and giant trees first (right behind the street ring), so the buildings fill round them
  planExtras(ctx, L, { ring: Rp + 9 })
  // the ring of big buildings round the street, facing the plaza, varied in size and height
  const Rb = Rp + 7
  const houses = []
  let a = rng.range(0, 8)
  let k = 0
  while (a < 360 + rng.range(0, 4)) {
    const roll = rng()
    const kind = k % 3 === 1 ? 'hall' : roll < 0.1 ? 'tower' : 'house'
    const [w, d] = kind === 'hall' ? [19 + 2 * rng.int(0, 2), 13 + 2 * rng.int(0, 1)] : kind === 'tower' ? [9, 9] : [13 + 2 * rng.int(0, 1), 11 + 2 * rng.int(0, 1)]
    let placed = false
    for (const extra of [0, 3, 6]) {
      const R = Rb + extra + d / 2
      const [x, z] = polar(ctx, a, R)
      const facing = facingToward([x, z], C)
      const [fw, fd] = facing === 'north' || facing === 'south' ? [w, d] : [d, w]
      const s = { kind, x0: Math.round(x - fw / 2), z0: Math.round(z - fd / 2), facing, y: FY, seed: ctx.seed * 31 + k, storeys: kind === 'hall' ? 2 : kind === 'tower' ? 1 : rng.chance(0.3) ? 3 : 2 }
      s.x1 = s.x0 + fw - 1
      s.z1 = s.z0 + fd - 1
      if (!onIsland(ctx, s, islandR - 6) || !grid.free(s.x0 - 3, s.z0 - 3, s.x1 + 3, s.z1 + 3)) continue
      houses.push(reserve(s, 2))
      a += ((Math.max(w, d) / 2 + 4) / R) * (180 / Math.PI) * 1.6
      placed = true
      break
    }
    if (!placed) a += 3
    k += 1
  }
  // a few cottages further out where there is room
  for (const a0 of [20, 70, 110, 160, 200, 250, 290, 340]) {
    const [w, d] = [9 + 2 * rng.int(0, 1), 9]
    const [x, z] = polar(ctx, a0 + rng.range(-8, 8), Rp + 40)
    const facing = facingToward([x, z], C)
    const s = { kind: 'house', x0: Math.round(x - w / 2), z0: Math.round(z - d / 2), facing, y: FY, seed: ctx.seed * 53 + a0, storeys: 1 }
    s.x1 = s.x0 + w - 1
    s.z1 = s.z0 + d - 1
    if (onIsland(ctx, s, islandR - 6) && grid.free(s.x0 - 4, s.z0 - 4, s.x1 + 4, s.z1 + 4)) houses.push(reserve(s, 2))
  }
  L.houses = houses
  planGround(ctx, L)
  for (const s of L.slots) L.pads.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, y: s.y, blend: 5 })
  // the whole town is flat; the land rolls a little only out by the rim
  L.flat = (x, z) => Math.hypot(x - cx, z - cz) < Rp + 34
  return L
}

function onIsland(ctx, s, r) {
  const [cx, cz] = ctx.C
  return [[s.x0, s.z0], [s.x1, s.z0], [s.x0, s.z1], [s.x1, s.z1]].every(([x, z]) => Math.hypot(x - cx, z - cz) < r)
}

export function build(ctx) {
  const { b, kit, theme, brief, FY, C, layout: L, M, rng } = ctx
  const [cx, cz] = C
  const { Rp, R1, R2 } = L

  // ---------------------------------------------------------------- the street ring and the plaza
  paveRound(ctx, { cx, cz, r: Rp + 5, field: ctx.paint.path, wobble: 1.2 })
  const border = theme.paving.border
  const inlay = theme.paving.inlay
  paveRound(ctx, {
    cx, cz, r: Rp,
    kerb: border,
    wobble: 0.6,
    rings: [
      { r0: 0, r1: 1.5, paint: 'minecraft:chiseled_quartz_block' },
      { r0: 1.5, r1: 3.5, paint: theme.plinth.includes('quartz') ? 'minecraft:smooth_quartz' : 'minecraft:polished_diorite' },
      { r0: 3.5, r1: 4.6, paint: border },
      { r0: 7.4, r1: 8.4, paint: inlay },
      { r0: R1 - 1.6, r1: R1 + 1.6, paint: border },
      { r0: R2 - 1.6, r1: R2 + 1.6, paint: border },
      { r0: Rp - 9.5, r1: Rp - 8.5, paint: inlay },
    ],
  })
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) for (let k = 2; k <= 3; k += 1) b.set(cx + dx * k, FY, cz + dz * k, border)
  b.spawnPoint([cx, FY, cz], 'north')

  // ---------------------------------------------------------------- NPCs on 1-block plinths
  const skirt = kit.material(theme.trim)
  for (const { npc, x, z } of L.npcRing) {
    b.set(x, FY + 1, z, theme.plinth)
    const face = facingToward([x, z], C)
    for (const [dx, dz, f] of [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']]) {
      if (f === kit.opposite(face)) continue
      if (skirt.stairs) b.set(x + dx, FY + 1, z + dz, `${skirt.stairs}[facing=${kit.opposite(f)}]`)
    }
    const rec = b.npcSpot([x, FY + 1, z], face, { ...M, ...npc, style: 'none' })
    rec.yaw = yawToward([x, z], C)
  }

  // ---------------------------------------------------------------- feature trees in grass beds
  for (const t of L.trees) {
    grassBed(ctx, t.x, t.z, t.bed)
    ctx.place(featureTree, [t.x, FY, t.z], { size: 'large', seed: t.seed, maxRadius: 8, maxHeight: 16 })
  }

  // ---------------------------------------------------------------- the open-air sections
  if (L.boards) ctx.place(boardsPlaza, { cx: L.boards.cx, z: L.boards.z, facing: 'south', boards: brief.leaderboards })
  for (const t of L.top3) ctx.place(top3Pillars, { x: t.x, z: t.z, facing: t.facing, id: t.id, label: t.label })
  if (L.crates) ctx.place(crateCourt, { points: L.crates.map(c => [c.x, c.z]), facings: L.crates.map(c => c.facing), crates: L.crates.map(c => c.crate) })
  if (L.rtp) b.portal([cx - 2, FY + 1, L.rtp.z], [cx + 2, FY + 5, L.rtp.z], { ...M, id: 'rtp', label: 'Random Teleport', kind: 'rtp', facing: 'north' })
  if (L.pvp) ctx.place(pvpArena, L.pvp)
  if (L.afk) ctx.place(afkPark, L.afk)

  // ---------------------------------------------------------------- the buildings
  buildExtras(ctx, L)
  if (brief.features.signs) {
    if (L.crates) ctx.place(signStand, 'CRATES', [cx - (Rp - 2), cz], 'east')
    if (L.boards) ctx.place(signStand, kit.signWidth('LEADERBOARDS', 'small') <= 44 ? 'LEADERBOARDS' : 'TOP', [cx, cz - (Rp - 1)], 'south')
    if (L.pvp) ctx.place(signStand, 'PVP', [L.pvp.x0 - 3, cz + 9], 'west')
  }
  for (const h of L.houses) {
    const res = ctx.place(building, h)
    if (res?.door) L.paths.push(res.door)
  }
  // short walks from each door to the street ring
  for (const door of L.paths) {
    const [dx, dz] = [cx - door[0], cz - door[2]]
    const len = Math.hypot(dx, dz)
    const to = [cx - (dx / len) * (Rp + 4), cz - (dz / len) * (Rp + 4)]
    pavePath(ctx, [[door[0], door[2]], to], { width: 3, fray: false })
  }
  // the corridors out of town
  const far = L.islandR - 6
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    if (dx === 1 && L.pvp) {
      pavePath(ctx, [[cx + Rp + 5, cz], [L.pvp.x0 - 1, cz]], { width: 5 })
      continue
    }
    pavePath(ctx, [[cx + dx * (Rp + 5), cz + dz * (Rp + 5)], [cx + dx * far + rng.range(-3, 3) * Math.abs(dz), cz + dz * far + rng.range(-3, 3) * Math.abs(dx)]], { width: 5 })
  }

  // ---------------------------------------------------------------- lamps, benches, life
  // lamps on the street ring between the plaza and the buildings
  const nLamps = Math.round((2 * Math.PI * (Rp + 2.5)) / 13)
  for (let i = 0; i < nLamps; i += 1) {
    const ang = (i / nLamps) * 360 + 7
    if ([0, 90, 180, 270].some(m => Math.abs(((ang - m + 540) % 360) - 180) > 174)) continue
    const [x, z] = polar(ctx, ang, Rp + 2.5)
    ctx.place(lamp, [Math.round(x), FY, Math.round(z)], { kind: 'post', seed: i })
  }
  // benches round each tree bed, facing the spawn
  for (const t of L.trees) {
    const [x, z] = [t.x + Math.sign(cx - t.x) * (t.bed + 2), t.z + Math.sign(cz - t.z) * (t.bed + 2)]
    ctx.place(bench, [x, FY, z], facingToward([x, z], C), { length: 3 })
  }
  // bushes and planters along the plaza kerb on the diagonals
  for (const ang of [30, 60, 120, 150, 210, 240, 300, 330]) {
    const [x, z] = polar(ctx, ang + rng.range(-4, 4), Rp - 3)
    const gx = Math.round(x)
    const gz = Math.round(z)
    if (!b.get(gx, FY + 1, gz)) ctx.place(bushAt, [gx, FY, gz], { r: 1.3, seed: Math.round(ang) })
  }
  for (const h of L.houses) {
    const side = h.facing === 'north' || h.facing === 'south' ? [h.x1 + 2, Math.round((h.z0 + h.z1) / 2)] : [Math.round((h.x0 + h.x1) / 2), h.z1 + 2]
    const tag = ctx.grid.tag(side[0], side[1])
    if (tag === h.kind || tag === null) ctx.place(clutter, [side[0], ctx.site.groundY(side[0], side[1]), side[1]], ['barrels', 'logs', 'crates', 'hay', 'cart'][h.seed % 5])
  }
}

// A grass bed in the paving for a plaza tree, its rim a step of the trim slab (like the reference:
// grass and dirt patches the trees grow out of)
function grassBed(ctx, x, z, r) {
  const { b, FY, theme, kit } = ctx
  const trim = kit.material(theme.trim)
  const ground = ctx.paint.ground
  for (let dx = -r - 1; dx <= r + 1; dx += 1)
    for (let dz = -r - 1; dz <= r + 1; dz += 1) {
      const d = Math.hypot(dx, dz) + 0.5 * kit.noise.fbm2(x + dx, z + dz, { scale: 3, seed: 9 })
      if (d <= r - 0.3) {
        b.set(x + dx, FY, z + dz, kit.hash01(x + dx, 3, z + dz, 5) < 0.25 ? 'minecraft:coarse_dirt' : ground)
        b.remove(x + dx, FY + 1, z + dz)
        ctx.site.paved[x + dx + ctx.S * (z + dz)] = 0
      } else if (d <= r + 0.7) {
        b.set(x + dx, FY, z + dz, theme.paving.border)
        b.set(x + dx, FY + 1, z + dz, trim.slab ? `${trim.slab}[type=bottom]` : theme.paving.border)
      }
    }
}

// the plaza tree bed used by the spawn+ and PvP layouts
export function treeBed(ctx, x, z, r) {
  grassBed(ctx, x, z, r)
}
