// Optional set pieces round a spawn, placed the way the reference spawns place them: landmarks and giant
// trees on rings just outside the town, raised areas and rocks in the ground that is left.
//
//   planLandmarks(ctx, { kinds, ring, islandR, angles }) → [{ kind, x, z, r }]
//       call while planning, after the plaza and the gameplay places but BEFORE the buildings, so
//       the town fills round them. ring = the first radius they may use (just outside the street
//       ring), islandR = how far from the middle the land reaches (keep 2 inside it). Diagonals are
//       tried first (they keep the corridors and the first view clear). Reserves each disc.
//   planGround(ctx, { terraces, rocks, islandR, inner }) → { mounds, rocks }
//       call last while planning. Raised areas (smooth 1-4 block rises, r 8-14) are NOT reserved:
//       the woodland still grows on them, they only lift the ground; rocks reserve a small disc.
//       Pass mounds to buildSite.
//   buildExtras(ctx, { landmarks, rocks, mounds }, { facingOf })
//       call while building, before landscapePass: every landmark facing the spawn, the rock
//       outcrops, a tree on each big raised area.
//   extrasRoom(kinds) → the radius the biggest set piece needs (size the island for it)

import { LANDMARKS, landmark } from './landmarks.mjs'
import { featureTree, rockOutcrop } from './landscape.mjs'
import { facingToward, polar } from './spawn.mjs'

export const extrasRoom = kinds => (kinds.length ? Math.max(...kinds.map(k => LANDMARKS[k]?.r ?? 10)) : 0)

const discFree = (ctx, x, z, r) => {
  for (let a = 0; a < 360; a += 20)
    for (const f of [0.35, 0.7, 1]) {
      const px = Math.round(x + Math.cos((a * Math.PI) / 180) * r * f)
      const pz = Math.round(z + Math.sin((a * Math.PI) / 180) * r * f)
      if (ctx.grid.tag(px, pz) !== null) return false
    }
  return ctx.grid.tag(Math.round(x), Math.round(z)) === null
}
const onIsland = (ctx, x, z, r, islandR) => Math.hypot(x - ctx.C[0], z - ctx.C[1]) + r < islandR

export function planLandmarks(ctx, { kinds = [], ring, islandR, angles = [45, 315, 135, 225, 25, 335, 155, 205, 65, 295, 115, 245] }) {
  const out = []
  const taken = new Set()
  for (const kind of kinds) {
    const r = LANDMARKS[kind]?.r ?? 10
    let spot = null
    for (const a of angles) {
      // one landmark per direction (giant trees may share one)
      if (taken.has(a) && kind !== 'giant-tree' && kind !== 'giant-palm') continue
      for (let R = ring + r; R + r < islandR - 2; R += 4) {
        const [x, z] = polar(ctx, a + ctx.rng.range(-4, 4), R)
        if (onIsland(ctx, x, z, r + 2, islandR) && discFree(ctx, x, z, r + 3)) {
          spot = { kind, x: Math.round(x), z: Math.round(z), r, a }
          break
        }
      }
      if (spot) break
    }
    if (!spot) {
      ctx.warn(`no room for the ${kind}; a bigger size (about ${Math.ceil((2 * (ring + 2 * r + 8)) / 4) * 4}) gives it a spot`)
      continue
    }
    taken.add(spot.a)
    ctx.grid.reserveDisc(spot.x, spot.z, r + 3, 'landmark')
    out.push(spot)
  }
  return out
}

export function planGround(ctx, { terraces = 0, rocks = 0, islandR, inner = 20 }) {
  const { rng } = ctx
  const [cx, cz] = ctx.C
  const mounds = []
  const stones = []
  for (let tries = 0; tries < terraces * 80 && mounds.length < terraces; tries += 1) {
    const r = rng.int(8, 14)
    const [x, z] = polar(ctx, rng.range(0, 360), rng.range(inner, islandR - r - 6))
    if (!onIsland(ctx, x, z, r + 4, islandR) || !discFree(ctx, x, z, r + 4)) continue
    if (mounds.some(m => Math.hypot(m.x - x, m.z - z) < m.r + r + 6)) continue
    if (Math.abs(x - cx) < 6 || Math.abs(z - cz) < 6) continue // the corridors stay level
    mounds.push({ x: Math.round(x), z: Math.round(z), r, h: rng.int(1, 4) })
  }
  for (let tries = 0; tries < rocks * 60 && stones.length < rocks; tries += 1) {
    const [x, z] = polar(ctx, rng.range(0, 360), rng.range(inner - 4, islandR - 8))
    if (!onIsland(ctx, x, z, 5, islandR) || !discFree(ctx, x, z, 4)) continue
    if (stones.some(m => Math.hypot(m.x - x, m.z - z) < 10)) continue
    stones.push({ x: Math.round(x), z: Math.round(z), r: rng.range(1.8, 3.2) })
    ctx.grid.reserveDisc(x, z, 3, 'rock')
  }
  return { mounds, rocks: stones }
}

export function buildExtras(ctx, { landmarks = [], rocks = [], mounds = [] }) {
  const { site } = ctx
  for (const m of landmarks) {
    const y = site.groundY(m.x, m.z)
    if (y < 0) continue
    ctx.place(landmark, m.kind, { x: m.x, z: m.z, y, seed: ctx.seed * 13 + m.x, facing: facingToward([m.x, m.z], ctx.C), ...(m.opts ?? {}) })
  }
  for (const r of rocks) {
    const y = site.groundY(r.x, r.z)
    if (y > 0) ctx.place(rockOutcrop, [r.x, y, r.z], { r: r.r, seed: r.x * 7 + r.z })
  }
  // a tree or two on the bigger raised areas
  for (const m of mounds) {
    if (m.r < 11) continue
    const y = site.groundY(m.x, m.z)
    if (y > 0) ctx.place(featureTree, [m.x, y, m.z], { size: 'medium', seed: m.x + m.z, maxRadius: 6, maxHeight: 12 })
  }
}
