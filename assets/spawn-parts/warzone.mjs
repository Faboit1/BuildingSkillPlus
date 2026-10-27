// The warzone: a PvP band all round a square spawn, the way SMP and crystal-PvP servers lay it out.
// The spawn is safe; a 2-wide red concrete line flush with the ground just outside it shows where
// PvP starts; outside it open fighting ground with a little cover; a moshpit and a KOTH hill in it.
//
//   const spawn = [x0, z0, x1, z1]                  the safe square (the canvas is it + the band)
//   warzoneBand(ctx, { spawn, label: 'Crystal PvP' })  separator, corridors, holograms, cover
//   moshpit(ctx, [x, z], { r: 12 })                 a sunken round pit, region 'moshpit'
//   koth(ctx, [x, z])                               a stepped hill with a capture zone, region 'koth'
//   b.region('warzone', [0, 0, 0], [S - 1, H - 1, S - 1], { pvp: 'allow', priority: 5 })
//
// Build the site with shape: 'square' so the band is land all round. Call warzoneBand after the
// spawn's own paving (it continues the four corridors out from the middle of each side) and before
// landscapePass (it reserves the band, so the woodland keeps out). Place the moshpit and the KOTH
// first if you want the cover to keep clear of them (pass them as `keepClear`).

import { featureTree } from './landscape.mjs'
import { pavePath } from './site.mjs'

export function warzoneBand(ctx, { spawn, label = 'Warzone', corridors = true, cover = true, keepClear = [] }) {
  const { b, kit, theme, S, C, grid, site, rng } = ctx
  const [lo, loz, hi, hiz] = spawn
  const [cx, cz] = C
  const inSpawn = (x, z) => x >= lo && x <= hi && z >= loz && z <= hiz
  // keep the woodland out of the band: it is open fighting ground with placed cover only
  for (let x = 0; x < S; x += 1) for (let z = 0; z < S; z += 1) if (!inSpawn(x, z)) grid.reserveCell(x, z, 'warzone')

  // the corridors out of the spawn carry on across the band
  const outer = S / 2 - 8
  if (corridors)
    for (const [dx, dz, from] of [[0, -1, [cx, loz + 2]], [1, 0, [hi - 2, cz]], [0, 1, [cx, hiz - 2]], [-1, 0, [lo + 2, cz]]]) {
      const to = [cx + dx * outer, cz + dz * outer]
      if (site.land(Math.round(to[0]), Math.round(to[1]))) pavePath(ctx, [from, to], { width: 4 })
    }

  // the separator: a 2-wide red concrete line flush with the ground just outside the spawn square
  const line = []
  for (let k = lo - 2; k <= hi + 2; k += 1) line.push([k, loz - 1], [k, loz - 2], [k, hiz + 1], [k, hiz + 2])
  for (let k = loz - 2; k <= hiz + 2; k += 1) line.push([lo - 1, k], [lo - 2, k], [hi + 1, k], [hi + 2, k])
  for (const [x, z] of line) {
    const gy = site.groundY(x, z)
    if (gy < 0 || site.isWater(x, z)) continue
    b.set(x, gy, z, 'minecraft:red_concrete')
    const above = b.nameAt(x, gy + 1, z) ?? ''
    if (/grass|fern|flower|tulip|poppy|dandelion|daisy|bluet|allium|cornflower|petals|snow|carpet|bush|roots/.test(above)) b.remove(x, gy + 1, z)
    site.paved[x + S * z] = 1
  }
  // holograms where the corridors cross the line
  for (const [x, z, id] of [[cx, loz - 4, 'n'], [hi + 4, cz, 'e'], [cx, hiz + 4, 's'], [lo - 4, cz, 'w']]) {
    const gy = site.groundY(x, z)
    if (gy > 0) ctx.hologram(`warzone-${id}`, `${label.toUpperCase()} - PvP is on past the red line`, [x, gy + 3.2, z])
  }
  if (!cover) return

  // cover: broken walls, boulders, a few trees, scattered over the band away from the features
  const area = S * S - (hi - lo + 1) * (hiz - loz + 1)
  const want = Math.round(area / 650)
  const wall = kit.palette(theme.wall.field, { scale: 3, seed: ctx.seed + 77 })
  let placed = 0
  for (let tries = 0; tries < want * 20 && placed < want; tries += 1) {
    const x = rng.int(3, S - 4)
    const z = rng.int(3, S - 4)
    if (inSpawn(x, z) || Math.min(Math.abs(x - lo), Math.abs(x - hi), Math.abs(z - loz), Math.abs(z - hiz)) < 5) continue
    if (!site.land(x, z) || site.isWater(x, z) || site.paved[x + S * z] || site.edgeE(x, z) > 0.93) continue
    if (keepClear.some(({ x: sx, z: sz, r }) => Math.hypot(x - sx, z - sz) < r + 4)) continue
    if (Math.abs(x - cx) < 5 || Math.abs(z - cz) < 5) continue // the corridors stay clear
    const gy = site.groundY(x, z)
    const roll = rng()
    if (roll < 0.45) {
      // a broken wall: 3-7 long, 1-3 high, the top ragged, a few blocks fallen beside it
      const alongX = rng.chance(0.5)
      const len = rng.int(3, 7)
      for (let k = 0; k < len; k += 1) {
        const wx = alongX ? x + k : x
        const wzz = alongX ? z : z + k
        const g = site.groundY(wx, wzz)
        if (g < 0) continue
        const h = rng.int(1, 3)
        for (let yy = 1; yy <= h; yy += 1) b.set(wx, g + yy, wzz, wall)
        if (rng.chance(0.25)) b.set(wx + (alongX ? 0 : 1), g + 1, wzz + (alongX ? 1 : 0), 'minecraft:cobblestone')
      }
    } else if (roll < 0.8) {
      b.boulder([x, gy + 1, z], [rng.range(1.2, 2.2), rng.range(1, 1.6), rng.range(1.2, 2.2)], kit.palette({ stone: 3, andesite: 2, cobblestone: 1, tuff: 1 }, { scale: 2, seed: x * 3 + z }), { mossTop: theme.key !== 'winter' && theme.key !== 'crimson' })
    } else {
      ctx.place(featureTree, [x, gy, z], { size: 'medium', seed: x * 7 + z, maxRadius: 5, maxHeight: 11 })
    }
    placed += 1
  }
}

// true when a disc of radius r round [x, z] is on solid land, away from the shore (for the pit/hill)
export function fits(ctx, [x, z], r) {
  const { site } = ctx
  for (let a = 0; a < 360; a += 30) {
    const px = Math.round(x + Math.cos((a * Math.PI) / 180) * r)
    const pz = Math.round(z + Math.sin((a * Math.PI) / 180) * r)
    if (!site.land(px, pz) || site.edgeE(px, pz) > 0.95) return false
  }
  return true
}

// A sunken round pit, terraced down three steps to a fighting floor, its rim ringed in red concrete.
// Footprint radius r + 2 (r 8-12 is usual); needs level ground (a pad) under it.
export function moshpit(ctx, [x, z], { r: R = 12 } = {}) {
  const { b, kit, theme, site, S } = ctx
  const gy = site.groundY(x, z)
  const trim = kit.material(theme.trim)
  const floor = kit.palette({ coarse_dirt: 3, packed_mud: 2, gravel: 1, cobblestone: 1 }, { scale: 2, seed: ctx.seed + 5 })
  const wall = kit.palette(theme.wall.field, { scale: 3, seed: ctx.seed + 6 })
  for (let dx = -R - 2; dx <= R + 2; dx += 1)
    for (let dz = -R - 2; dz <= R + 2; dz += 1) {
      const d = Math.hypot(dx, dz)
      const px = x + dx
      const pz = z + dz
      if (d > R + 1.5) continue
      if (d > R + 0.5) {
        b.set(px, gy, pz, 'minecraft:red_concrete')
        b.remove(px, gy + 1, pz)
        site.paved[px + S * pz] = 1
        continue
      }
      // depth by ring: 1 at the rim, 3 in the middle
      const depth = d > R - 2 ? 1 : d > R - 4 ? 2 : 3
      for (let yy = gy - depth + 1; yy <= gy + 2; yy += 1) b.remove(px, yy, pz)
      b.set(px, gy - depth, pz, depth === 3 ? floor : wall)
      // a stair nosing on each step edge, facing into the pit
      const inward = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : (dz > 0 ? 'north' : 'south')
      const edge = depth < 3 && (d > R - 2 ? d <= R - 1.2 : d <= R - 3.2)
      if (edge && trim.stairs) b.set(px, gy - depth + 1, pz, `${trim.stairs}[facing=${kit.opposite(inward)}]`)
      site.paved[px + S * pz] = 1
    }
  for (const [ox, oz] of [[R + 2, 0], [-R - 2, 0], [0, R + 2], [0, -R - 2]]) {
    b.set(x + ox, gy + 1, z + oz, 'minecraft:polished_blackstone_brick_wall')
    b.set(x + ox, gy + 2, z + oz, 'minecraft:lantern[hanging=false]')
  }
  b.region('moshpit', [x - R - 1, gy - 4, z - R - 1], [x + R + 1, gy + 12, z + R + 1], { pvp: 'allow', priority: 20 })
  ctx.hologram('moshpit', 'MOSHPIT', [x, gy + 6, z])
}

// KOTH: a stepped hill (13 → 9 → 5) with stairs up each side; the 5x5 top is the capture zone.
// Footprint 15 x 15 (radius 8 with the stairs); needs level ground under it.
export function koth(ctx, [x, z]) {
  const { b, kit, theme, site, S } = ctx
  const gy = site.groundY(x, z)
  const trim = kit.material(theme.trim)
  const body = kit.palette(theme.wall.field, { scale: 3, seed: ctx.seed + 8 })
  const tiers = [[6, 1], [4, 2], [2, 3]]
  for (const [r, h] of tiers)
    for (let dx = -r; dx <= r; dx += 1)
      for (let dz = -r; dz <= r; dz += 1) {
        for (let yy = gy + 1; yy <= gy + h; yy += 1) b.set(x + dx, yy, z + dz, yy === gy + h && (Math.abs(dx) === r || Math.abs(dz) === r) ? theme.paving.border : body)
        site.paved[x + dx + S * (z + dz)] = 1
      }
  // the capture zone on top: the accent colour inside a border
  for (let dx = -2; dx <= 2; dx += 1)
    for (let dz = -2; dz <= 2; dz += 1) b.set(x + dx, gy + 3, z + dz, Math.abs(dx) === 2 || Math.abs(dz) === 2 ? theme.paving.border : `minecraft:${theme.accent}_concrete`)
  // stairs up the middle of each side
  if (trim.stairs)
    for (const [fx, fz, f] of [[0, 1, 'south'], [0, -1, 'north'], [1, 0, 'east'], [-1, 0, 'west']])
      for (const [r, h] of tiers)
        for (let w = -1; w <= 1; w += 1) {
          const px = x + fx * (r + 1) + (fz ? w : 0)
          const pz = z + fz * (r + 1) + (fx ? w : 0)
          if (b.get(px, gy + h, pz)) continue
          b.set(px, gy + h, pz, `${trim.stairs}[facing=${kit.opposite(f)}]`)
          for (let yy = gy + 1; yy < gy + h; yy += 1) b.set(px, yy, pz, body)
        }
  for (const [ox, oz] of [[6, 6], [-6, 6], [6, -6], [-6, -6]]) {
    b.set(x + ox, gy + 2, z + oz, 'minecraft:polished_blackstone_brick_wall')
    b.set(x + ox, gy + 3, z + oz, `minecraft:${theme.accent}_banner[rotation=0]`)
  }
  b.region('koth', [x - 2, gy + 3, z - 2], [x + 2, gy + 10, z + 2], { pvp: 'allow', priority: 20 })
  ctx.hologram('koth', 'KING OF THE HILL', [x, gy + 9, z])
}
