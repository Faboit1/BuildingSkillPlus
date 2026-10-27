// Optional set pieces any layout can add (brief.landmarks, bigTrees, terraces, rocks, features.signs):
//   planExtras(ctx, L, { ring, angles })   reserves the spots (call after the layout's own slots,
//                                          before its filler buildings, so the town fills around them)
//   planGround(ctx, L)                     raised areas and rock spots in what is still free (call last)
//   buildExtras(ctx, L)                    builds them (call in the layout's build)
//   signStand(ctx, text, [x, z], facing)   an opt-in block-letter title on two posts (CRATES...)

import { LANDMARKS, landmark } from '../../../assets/spawn-parts/landmarks.mjs'
import { featureTree, rockOutcrop } from '../../../assets/spawn-parts/landscape.mjs'
import { polar } from './index.mjs'
import { signStand as partSign } from '../../../assets/spawn-parts/signs.mjs'

// the radius of the biggest set piece a brief asks for (layouts size the island to fit it)
export const extrasRoom = brief => {
  const kinds = [...brief.landmarks, ...(brief.bigTrees ? ['giant-tree'] : [])]
  return kinds.length ? Math.max(...kinds.map(k => LANDMARKS[k]?.r ?? 10)) : 0
}

const discFree = (ctx, x, z, r) => {
  for (let a = 0; a < 360; a += 20)
    for (const f of [0.35, 0.7, 1]) {
      const [px, pz] = [Math.round(x + Math.cos((a * Math.PI) / 180) * r * f), Math.round(z + Math.sin((a * Math.PI) / 180) * r * f)]
      if (ctx.grid.tag(px, pz) !== null) return false
    }
  return ctx.grid.tag(Math.round(x), Math.round(z)) === null
}
const onIsland = (ctx, x, z, r, islandR) => Math.hypot(x - ctx.C[0], z - ctx.C[1]) + r < islandR

// landmarks and giant trees on rings round the town: `ring` = the first free radius out from the
// centre; angles = the order to try (diagonals first keeps them out of the corridors)
export function planExtras(ctx, L, { ring, angles = [45, 315, 135, 225, 25, 335, 155, 205, 65, 295, 115, 245] }) {
  const { brief } = ctx
  const islandR = L.islandR
  const tropical = ctx.theme.key === 'tropical'
  const wanted = [...brief.landmarks, ...Array.from({ length: brief.bigTrees }, () => (tropical ? 'giant-palm' : 'giant-tree'))]
  L.landmarks = []
  const taken = new Set()
  for (const kind of wanted) {
    const r = LANDMARKS[kind]?.r ?? 10
    let spot = null
    for (const a of angles) {
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
    L.landmarks.push(spot)
  }
}

// raised areas (smooth 1-4 block rises) and rock spots in the free ground that is left
export function planGround(ctx, L) {
  const { brief, rng } = ctx
  const islandR = L.islandR
  const [cx, cz] = ctx.C
  L.mounds = []
  L.rocks = []
  for (let tries = 0; tries < brief.terraces * 80 && L.mounds.length < brief.terraces; tries += 1) {
    const r = rng.int(8, 14)
    const [x, z] = polar(ctx, rng.range(0, 360), rng.range(20, islandR - r - 6))
    if (!onIsland(ctx, x, z, r + 4, islandR) || !discFree(ctx, x, z, r + 4)) continue
    if (L.mounds.some(m => Math.hypot(m.x - x, m.z - z) < m.r + r + 6)) continue
    if (Math.abs(x - cx) < 6 || Math.abs(z - cz) < 6) continue
    L.mounds.push({ x: Math.round(x), z: Math.round(z), r, h: rng.int(1, 4) })
  }
  for (let tries = 0; tries < brief.rocks * 60 && L.rocks.length < brief.rocks; tries += 1) {
    const [x, z] = polar(ctx, rng.range(0, 360), rng.range(16, islandR - 8))
    if (!onIsland(ctx, x, z, 5, islandR) || !discFree(ctx, x, z, 4)) continue
    if (L.rocks.some(m => Math.hypot(m.x - x, m.z - z) < 10)) continue
    L.rocks.push({ x: Math.round(x), z: Math.round(z), r: rng.range(1.8, 3.2) })
    ctx.grid.reserveDisc(x, z, 3, 'rock')
  }
}

export function buildExtras(ctx, L) {
  const { site } = ctx
  for (const m of L.landmarks ?? []) {
    const y = site.groundY(m.x, m.z)
    if (y < 0) continue
    ctx.place(landmark, m.kind, { x: m.x, z: m.z, y, seed: ctx.seed * 13 + m.x, facing: facingIn(ctx, m) })
  }
  for (const r of L.rocks ?? []) {
    const y = site.groundY(r.x, r.z)
    if (y > 0) ctx.place(rockOutcrop, [r.x, y, r.z], { r: r.r, seed: r.x * 7 + r.z })
  }
  // a tree or two on the bigger raised areas
  for (const m of L.mounds ?? []) {
    if (m.r < 11) continue
    const y = site.groundY(m.x, m.z)
    if (y > 0) ctx.place(featureTree, [m.x, y, m.z], { size: 'medium', seed: m.x + m.z, maxRadius: 6, maxHeight: 12 })
  }
}

function facingIn(ctx, m) {
  const dx = ctx.C[0] - m.x
  const dz = ctx.C[1] - m.z
  return Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : (dz > 0 ? 'south' : 'north')
}

// An opt-in block-letter title: brief.features.signs = { style, outline, thick } ('auto' = picked for
// the theme), built by the shared signs part.
export function signStand(ctx, text, at, facing, { y = ctx.FY } = {}) {
  const cfg = ctx.brief.features.signs || {}
  return partSign(ctx, text, at, facing, { y, style: cfg.style ?? 'auto', outline: cfg.outline ?? 'auto', thick: cfg.thick ?? 'auto' })
}
