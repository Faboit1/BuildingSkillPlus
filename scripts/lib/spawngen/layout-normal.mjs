// Normal spawn (FreshSMP-like, the autumn reference): one round plaza in target rings on good
// terrain. Players spawn on the rose in the middle facing north; every NPC stands on a 1-block plinth
// in a ring around them, facing the spawn, broken by four path mouths:
//   north  the hero: leaderboards with the server name above them (25-45 blocks out)
//   west   the crates hall
//   east   the PvP zone (a ruined arena behind a red line), or a landmark hall when pvp is off
//   south  the RTP gate, the path out
// Four feature trees stand on the diagonals; cottages and a landmark hall sit at the rim facing the
// plaza, in varied sizes; woodland fills the rest of the island.

import { building, crateHall, heroWall, KINDS } from './buildings.mjs'
import { bench, featureTree, lamp, pvpArena, afkPark, clutter, planter } from './landscape.mjs'
import { paveRound, pavePath } from './site.mjs'
import { facingToward, polar, yawToward } from './index.mjs'

const deg = r => (r * 180) / Math.PI

// the NPC ring radius and the plaza radius for N NPCs (≈ 5.5 blocks of arc each + four path mouths)
export const ringOf = N => {
  const Rn = N ? Math.max(10, Math.ceil((5.5 * N + 34) / (2 * Math.PI))) : 8
  return { Rn, Rp: Rn + 6 }
}
// room for the plaza, the four sections and a ring of cottages at the rim
export const recommendSize = brief => 2 * (ringOf(brief.npcs.length).Rp + 44)

export function plan(ctx) {
  const { brief, S, FY, C, rng, grid } = ctx
  const [cx, cz] = C
  const N = brief.npcs.length
  // the NPC ring: ~5.5 blocks of arc per NPC plus four 8-block path mouths
  const { Rn, Rp } = ringOf(N)
  const islandR = S / 2 - 3
  const room = islandR - Rp
  if (room < 26) ctx.warn(`size ${S} is tight for ${N} NPCs (plaza radius ${Rp}); a size of ${Math.ceil(2 * (Rp + 32))} gives the features room`)
  const L = { type: 'normal', plaza: { cx, cz, r: Rp }, Rn, Rp, islandR, pads: [], slots: [], paths: [], spawn: [cx, FY, cz] }
  const reserve = (s, pad = 1) => {
    grid.reserve(s.x0, s.z0, s.x1, s.z1, s.kind, pad)
    L.slots.push(s)
    return s
  }
  grid.reserveDisc(cx, cz, Rp + 1.5, 'plaza')

  // NPC ring positions, skipping the four mouths; nearest the hero first
  const mouth = Math.max(8, deg(Math.asin(Math.min(0.95, 4.5 / Rn))) * 2)
  const arcs = [0, 90, 180, 270].map(a => [a + mouth / 2, a + 90 - mouth / 2])
  const total = arcs.reduce((s, [a, b]) => s + b - a, 0)
  const spots = []
  for (let i = 0; i < N; i += 1) {
    let t = ((i + 0.5) / N) * total
    let ang = 0
    for (const [a, b] of arcs) {
      if (t <= b - a) { ang = a + t; break }
      t -= b - a
    }
    const [x, z] = polar(ctx, ang, Rn)
    spots.push({ ang, x: Math.round(x), z: Math.round(z) })
  }
  const order = spots.map((s, i) => [Math.min(s.ang, 360 - s.ang), i]).sort((a, b) => a[0] - b[0]).map(e => e[1])
  L.npcRing = brief.npcs.map((npc, k) => ({ npc, ...spots[order[k]] }))

  // north: the hero (boards + name)
  const nb = Math.max(1, brief.leaderboards.length)
  const boardsW = nb * 9 + (nb - 1) * 3 + (nb >= 3 ? 2 : 0) + 4
  // the boards' front 35-40 out, so the name above them (up to floor + 26) fits a player's view;
  // the podium steps reach 6 in front of it
  const heroZ = cz - Math.max(Rp + 13, 36)
  const heroW = Math.max(boardsW + 10, 30)
  L.hero = reserve({ kind: 'hero', x0: cx - Math.ceil(heroW / 2), x1: cx + Math.ceil(heroW / 2), z0: heroZ - 9, z1: heroZ + 7, y: FY, cx, z: heroZ, width: heroW })
  // west: the crates hall (stations 5 apart, facing the plaza)
  const nc = brief.crates.length
  if (nc) {
    const len = Math.max(15, nc * 5 + 7)
    const x1 = cx - Rp - 3
    L.crates = reserve({ kind: 'crates', x0: x1 - 11, x1, z0: cz - Math.floor(len / 2), z1: cz - Math.floor(len / 2) + len - 1, y: FY, facing: 'east' })
  }
  // south: the RTP gate on the plaza edge
  if (brief.features.rtp) L.rtp = reserve({ kind: 'rtp', x0: cx - 7, x1: cx + 7, z0: cz + Rp + 1, z1: cz + Rp + 7, y: FY, z: cz + Rp + 4 })
  // east: the PvP zone, else a landmark hall
  const ex0 = cx + Rp + 5
  const aw = Math.max(18, Math.min(30, Math.round(islandR - Rp - 10)))
  if (brief.features.pvp) L.pvp = reserve({ kind: 'pvp', x0: ex0, x1: ex0 + aw, z0: cz - Math.floor(aw / 2), z1: cz + Math.ceil(aw / 2), y: FY, entrance: 'west' }, 2)
  else L.eastHall = reserve({ kind: 'hall', x0: ex0 + 2, x1: ex0 + 18, z0: cz - 8, z1: cz + 8, y: FY, facing: 'west' }, 2)
  // the four feature trees on the diagonals, just outside the plaza
  // (the north pair stands wide of the hero and stays lower, so the name sign reads over the plaza)
  // each crown stays clear of the sections: the tree swings along the rim to the roomiest angle
  const sections = L.slots.slice()
  const gap = (x, z) => Math.min(...sections.map(r => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1))))
  L.trees = [58, 130, 230, 302].map((a0, i) => {
    const north = a0 < 90 || a0 > 270
    let best = null
    for (const da of [0, -6, 6, -12, 12, -18, 18]) {
      const a = a0 + da + rng.range(-2, 2)
      const [x, z] = polar(ctx, a, Rp + 4.5)
      const room = gap(x, z)
      if (!best || room > best.room + 1.5) best = { x, z, room }
      if (room >= 10) break
    }
    const maxRadius = Math.max(4, Math.min(north ? 7 : 9, Math.floor(best.room - 1)))
    grid.reserveDisc(best.x, best.z, Math.min(maxRadius, 7), 'tree')
    return { x: Math.round(best.x), z: Math.round(best.z), seed: ctx.seed + i, maxRadius, maxHeight: north ? 13 : maxRadius >= 8 ? 18 : 14 }
  })
  // AFK garden (optional) in the free south-west sector
  if (brief.features.afk) {
    const [x, z] = polar(ctx, 225, Rp + 18)
    const s = { kind: 'afk', x0: Math.round(x) - 7, x1: Math.round(x) + 7, z0: Math.round(z) - 7, z1: Math.round(z) + 7, y: FY }
    if (grid.free(s.x0 - 1, s.z0 - 1, s.x1 + 1, s.z1 + 1)) L.afk = reserve(s, 2)
  }

  // cottages and one landmark at the rim, facing the plaza, sizes varied
  const shapes = [[9, 9], [11, 9], [9, 11], [13, 11], [11, 13], [7, 9], [9, 7]]
  const rim = []
  const candidates = [20, 340, 62, 298, 118, 242, 160, 200, 40, 320, 140, 220]
  const maxHouses = Math.max(3, Math.min(9, Math.round((Math.PI * (islandR ** 2 - (Rp + 8) ** 2)) / 1400)))
  let landmark = !L.eastHall
  for (const a0 of candidates) {
    if (rim.length >= maxHouses) break
    const a = a0 + rng.range(-6, 6)
    const big = landmark && Math.abs(((a + 540) % 360) - 180) > 120 // the landmark goes north, behind the hero's shoulder
    const [w, d] = big ? [15, 13] : shapes[rng.int(0, shapes.length - 1)]
    for (const r of [Rp + 9, Rp + 12, Rp + 15, Rp + 18, Rp + 22, Rp + 26]) {
      const [x, z] = polar(ctx, a, r + Math.max(w, d) / 2)
      const facing = facingToward([x, z], C)
      // the long side faces the street
      const [fw, fd] = facing === 'north' || facing === 'south' ? [Math.max(w, d), Math.min(w, d)] : [Math.min(w, d), Math.max(w, d)]
      const s = { kind: big ? 'hall' : 'house', x0: Math.round(x - fw / 2), z0: Math.round(z - fd / 2), facing, y: FY, seed: ctx.seed * 31 + rim.length, storeys: big ? 2 : rng.chance(0.4) ? 2 : 1 }
      s.x1 = s.x0 + fw - 1
      s.z1 = s.z0 + fd - 1
      if (!onIsland(ctx, s, islandR - 4) || !grid.free(s.x0 - 3, s.z0 - 3, s.x1 + 3, s.z1 + 3)) continue
      rim.push(reserve(s, 2))
      if (big) landmark = false
      break
    }
  }
  L.houses = rim
  for (const s of L.slots) L.pads.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, y: s.y, blend: 5 })
  // keep the strips the paths cross flat
  const mouths = [[0, L.hero], [270, L.crates], [90, L.pvp ?? L.eastHall], [180, L.rtp]]
  L.mouths = mouths.filter(([, s]) => s).map(([a, s]) => ({ a, s }))
  L.flat = (x, z) => {
    const dx = x - cx
    const dz = z - cz
    return (Math.abs(dx) <= 5 && Math.abs(dz) <= Rp + 16) || (Math.abs(dz) <= 4 && Math.abs(dx) <= Rp + 12)
  }
  return L
}

function onIsland(ctx, s, r) {
  const [cx, cz] = ctx.C
  return [[s.x0, s.z0], [s.x1, s.z0], [s.x0, s.z1], [s.x1, s.z1]].every(([x, z]) => Math.hypot(x - cx, z - cz) < r)
}

export function build(ctx) {
  const { b, kit, theme, brief, FY, C, layout: L, M } = ctx
  const [cx, cz] = C
  const { Rn, Rp } = L

  // ---------------------------------------------------------------- the plaza
  const border = theme.paving.border
  const inlay = theme.paving.inlay
  paveRound(ctx, {
    cx, cz, r: Rp,
    kerb: border,
    rings: [
      { r0: 0, r1: 1.5, paint: 'minecraft:chiseled_quartz_block' },
      { r0: 1.5, r1: 3.5, paint: theme.plinth.includes('quartz') ? 'minecraft:smooth_quartz' : 'minecraft:polished_diorite' },
      { r0: 3.5, r1: 4.6, paint: border },
      { r0: 6.5, r1: 7.4, paint: inlay },
      { r0: Rn - 1.6, r1: Rn + 1.6, paint: border },
      { r0: Rn + 3.6, r1: Rn + 4.4, paint: inlay },
    ],
  })
  // the rose's four points (toward the mouths)
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) for (let k = 2; k <= 3; k += 1) b.set(cx + dx * k, FY, cz + dz * k, border)
  b.spawnPoint([cx, FY, cz], 'north')

  // the NPC ring: 1-block plinths with a stair skirt, the NPC facing the spawn
  const plinth = theme.plinth
  const skirt = kit.material(theme.trim)
  for (const { npc, x, z } of L.npcRing) {
    b.set(x, FY + 1, z, plinth)
    const face = facingToward([x, z], C)
    for (const [dx, dz, f] of [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']]) {
      if (f === kit.opposite(face)) continue // the back stays open: no skirt behind
      if (skirt.stairs) b.set(x + dx, FY + 1, z + dz, `${skirt.stairs}[facing=${kit.opposite(f)}]`)
    }
    const rec = b.npcSpot([x, FY + 1, z], face, { ...M, ...npc, style: 'none' })
    rec.yaw = yawToward([x, z], C)
  }

  // ---------------------------------------------------------------- the four sections
  ctx.place(heroWall, { cx, z: L.hero.z, y: FY, facing: 'south', boards: brief.leaderboards, name: brief.features.signs ? brief.name : null, width: L.hero.width })
  if (L.crates) ctx.place(crateHall, { ...L.crates, crates: brief.crates })
  if (L.rtp) {
    const z = L.rtp.z
    b.portal([cx - 2, FY + 1, z], [cx + 2, FY + 5, z], { ...M, id: 'rtp', label: 'Random Teleport', kind: 'rtp', facing: 'north' })
  }
  if (L.pvp) ctx.place(pvpArena, L.pvp)
  if (L.eastHall) ctx.place(building, { ...L.eastHall, seed: ctx.seed + 5, storeys: 2 })
  if (L.afk) ctx.place(afkPark, L.afk)
  for (const t of L.trees) ctx.place(featureTree, [t.x, ctx.site.groundY(t.x, t.z), t.z], { size: 'large', seed: t.seed, maxRadius: t.maxRadius, maxHeight: t.maxHeight })
  for (const h of L.houses) {
    const res = ctx.place(building, h)
    if (res?.door) L.paths.push([[res.door[0], res.door[2]], towardPlaza(ctx, res.door, Rp - 1)])
  }

  // ---------------------------------------------------------------- paths, lamps, benches
  const mouthPaths = [
    [[cx, cz - Rp + 1], [cx, L.hero.z1 + 1]],
    L.crates && [[cx - Rp + 1, cz], [L.crates.x1 + 1, cz]],
    (L.pvp || L.eastHall) && [[cx + Rp - 1, cz], [(L.pvp ?? L.eastHall).x0 - 1, cz]],
    L.rtp && [[cx, cz + Rp - 1], [cx, L.rtp.z1 + 2], [cx + ctx.rng.range(-6, 6), Math.min(ctx.S - 4, cz + L.islandR - 6)]],
  ].filter(Boolean)
  for (const p of mouthPaths) pavePath(ctx, p, { width: 5 })
  for (const p of L.paths) pavePath(ctx, p, { width: 3 })
  // lamps flank every mouth on the kerb; benches face the spawn between the NPC arcs
  for (const a of [0, 90, 180, 270]) {
    for (const s of [-1, 1]) {
      const [x, z] = polar(ctx, a + s * 13, Rp - 1.5)
      ctx.place(lamp, [Math.round(x), FY, Math.round(z)], { kind: 'post' })
    }
  }
  for (const a of [45, 135, 225, 315]) {
    const [x, z] = polar(ctx, a, Rn + 4)
    const f = facingToward([x, z], C)
    ctx.place(bench, [Math.round(x), FY, Math.round(z)], f, { length: 3 })
  }
  // signs of life by the houses
  for (const h of L.houses) {
    const side = h.facing === 'north' || h.facing === 'south' ? [h.x1 + 2, FY, Math.round((h.z0 + h.z1) / 2)] : [Math.round((h.x0 + h.x1) / 2), FY, h.z1 + 2]
    if (ctx.grid.tag(side[0], side[2]) === h.kind || ctx.grid.tag(side[0], side[2]) === null) ctx.place(clutter, [side[0], ctx.site.groundY(side[0], side[2]), side[2]], ['barrels', 'logs', 'crates', 'hay'][h.seed % 4])
  }
  void planter
}

// A round grass bed in the paving for a plaza tree: a raised kerb of the trim slab with a gap-free rim
export function treeBed(ctx, x, z, r) {
  const { b, FY, theme, kit } = ctx
  const trim = kit.material(theme.trim)
  for (let dx = -r - 1; dx <= r + 1; dx += 1)
    for (let dz = -r - 1; dz <= r + 1; dz += 1) {
      const d = Math.hypot(dx, dz)
      if (d <= r - 0.5) {
        b.set(x + dx, FY, z + dz, kit.hash01(x + dx, 3, z + dz, 5) < 0.2 ? 'minecraft:moss_block' : 'minecraft:grass_block')
        b.remove(x + dx, FY + 1, z + dz)
      } else if (d <= r + 0.5) {
        b.set(x + dx, FY, z + dz, theme.paving.border)
        b.set(x + dx, FY + 1, z + dz, trim.slab ? `${trim.slab}[type=bottom]` : theme.paving.border)
      }
    }
}

function towardPlaza(ctx, door, r) {
  const [cx, cz] = ctx.C
  const a = Math.atan2(door[2] - cz, door[0] - cx)
  return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]
}
