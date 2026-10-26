// The frame of a hand-written spawn recipe. Every spawn recipe starts and ends with it:
//
//   import { startSpawn, finishSpawn, polar, facingToward, yawToward, findSpot } from './parts/spawn.mjs'
//   import { buildSite, paveRound, pavePath } from './parts/site.mjs'
//   export default function build(api) {
//     const ctx = startSpawn(api, { name: 'Ember SMP', size: 220, theme: 'autumn', seed: 7 })
//     // 1. plan: decide every place, reserve its ground on ctx.grid, fill ctx.layout for the site
//     // 2. ctx.site = buildSite(ctx, { plaza, pads, mounds, setting })
//     // 3. build: paving, the spawn point, NPCs, boards, crates, buildings, set pieces
//     // 4. landscapePass(ctx): woodland, flowers and lamps on the ground nobody reserved
//     return finishSpawn(ctx)
//   }
//
// Nothing in here decides the design: where things go, how big they are and what they look like is
// the recipe's job (see references/spawns/build-guide.md and assets/examples/spawns/).
//
// ctx (what every part takes as its first argument):
//   api, kit, b            the run-build api, the kit, the Builder (b.set, b.box, b.sign, b.npcSpot...)
//   name, slug, theme      the server name, its file-safe slug, the resolved theme (themes.mjs)
//   rng, seed              a seeded random generator (rng(), rng.int(a, b), rng.range(a, b), rng.chance(p))
//   S, H, FY, C            canvas side, height, the plaza floor block level (players stand at FY + 1),
//                          C = [cx, cz], the middle column (put the world spawn there or near it)
//   M                      spawn-kit materials from the theme (pass to npcSpot/leaderboards/crate/portal)
//   paint                  ready kit.palette paints: ground, field (plaza), path, wall
//   grid                   occupancy, one tag per column: reserve(x0, z0, x1, z1, tag, pad),
//                          reserveDisc(cx, cz, r, tag), free(x0, z0, x1, z1), freeDisc(cx, cz, r), tag(x, z)
//   layout                 an object you fill while planning; buildSite reads plaza / pads / mounds /
//                          flat from it, landscapePass keeps the woodland back from layout.plaza
//   site                   set it to buildSite's result: groundY(x, z), land(x, z), isWater(x, z),
//                          level(rect, y), paved[] (columns the landscape must keep off)
//   hologram(id, text, [x, y, z])  a free-standing hologram for setup.md (rules, district names):
//                          x, z = the block column, y = the height of the top line (floor + 3 reads well)
//   warn(msg)              a note for the build summary
//   place(fn, ...args)     run fn(ctx, ...args), log a warning instead of crashing if it throws

import { resolveTheme } from './themes.mjs'
import { cleanupSpawn } from './cleanup.mjs'

export function startSpawn(api, { name = 'Spawn', size = 200, height = 100, theme = 'medieval', accent, setting, seed = 7, floorY } = {}) {
  const { kit } = api
  const t = resolveTheme(theme, accent)
  if (setting) t.setting = setting
  const S = size
  const H = height
  const b = api.builder([S, H, S], { seed })
  const rng = kit.rng(seed * 7919 + 13)
  // the plaza floor: an island needs room for its underside; the rest is sky for roofs and trees
  const FY = floorY ?? Math.max(14, Math.min(Math.round(H * 0.34), Math.round(S * 0.22) + 6))
  const C = [Math.floor(S / 2), Math.floor(S / 2)]
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'spawn'
  const ctx = {
    api, kit, b, name, slug, theme: t, rng, seed, S, H, FY, C,
    M: { ...t.kit, light: t.light },
    paint: {
      ground: kit.palette(t.ground, { scale: 5, seed: seed + 1 }),
      field: kit.palette(t.paving.field, { scale: 4, seed: seed + 2 }),
      path: kit.palette(t.paving.path, { scale: 3, seed: seed + 3 }),
      wall: kit.palette(t.wall.field, { scale: 3, seed: seed + 4 }),
    },
    layout: {},
    site: null,
    warnings: [],
    warn(msg) { ctx.warnings.push(msg) },
    hologram(id, text, [x, y, z]) {
      b.placements ??= []
      const rec = { type: 'hologram', id, label: text, pos: [x + 0.5, y, z + 0.5] }
      b.placements.push(rec)
      return rec
    },
    place(fn, ...args) {
      try {
        return fn(ctx, ...args)
      } catch (err) {
        ctx.warn(`${fn.name || 'part'} failed: ${err.message}`)
        if (process.env.SPAWN_DEBUG) throw err
        return null
      }
    },
  }
  ctx.grid = createGrid(S)
  return ctx
}

// The last step: tidy floating leftovers, the safe-zone region, spawn-proofing (invisible light in
// every dark walkable cell), finish(). safeZone = [x0, z0, x1, z1] (default the whole canvas); add
// any other region (a PvP pit, a warzone) with b.region before this, with a higher priority.
export function finishSpawn(ctx, { safeZone, description, cleanup = true } = {}) {
  const { b, S, H, FY, site } = ctx
  if (!ctx.b.placements?.some(p => p.type === 'spawn')) ctx.warn('no world spawn: call b.spawnPoint([x, FY, z], facing) on the plaza')
  const cleaned = cleanup && site ? ctx.place(cleanupSpawn) ?? 0 : 0
  const [x0, z0, x1, z1] = safeZone ?? [0, 0, S - 1, S - 1]
  b.region('spawn', [x0, 0, z0], [x1, H - 1, z1], { pvp: 'deny', 'mob-spawning': 'deny', 'fall-damage': 'deny', 'item-drop': 'deny', priority: 10 })
  for (const w of ctx.warnings) b.warnings.push(`spawn: ${w}`)
  const land = site ? site.land : () => true
  const result = b.finish({
    name: ctx.slug,
    description: description ?? `${ctx.name} spawn (${ctx.theme.label}, ${S}x${S})`,
    spawnProof: { min: [0, Math.max(0, FY - 6), 0], max: [S - 1, H - 1, S - 1], inside: (x, z) => land(x, z) },
  })
  result.metadata ??= {}
  result.metadata.spawn = { name: ctx.name, theme: ctx.theme.key, setting: ctx.theme.setting, floorY: FY, warnings: ctx.warnings, cleaned }
  return result
}

// Occupancy grid: one tag per column. Reserve the footprint of every place (plus a pad) while
// planning, so later places, the woodland and the flowers keep off it.
export function createGrid(S) {
  const cells = new Array(S * S).fill(null)
  const clamp = v => Math.max(0, Math.min(S - 1, v))
  const each = (x0, z0, x1, z1, fn) => {
    const [ax, bx] = [clamp(Math.min(x0, x1)), clamp(Math.max(x0, x1))]
    const [az, bz] = [clamp(Math.min(z0, z1)), clamp(Math.max(z0, z1))]
    for (let x = ax; x <= bx; x += 1) for (let z = az; z <= bz; z += 1) if (fn(x, z) === false) return false
    return true
  }
  const inside = (x0, z0, x1, z1) => Math.min(x0, x1) >= 0 && Math.min(z0, z1) >= 0 && Math.max(x0, x1) < S && Math.max(z0, z1) < S
  return {
    S,
    reserve(x0, z0, x1, z1, tag = 'used', pad = 0) {
      each(Math.round(x0) - pad, Math.round(z0) - pad, Math.round(x1) + pad, Math.round(z1) + pad, (x, z) => {
        cells[x + S * z] ??= tag
      })
    },
    reserveDisc(cx, cz, r, tag = 'used') {
      each(Math.floor(cx - r), Math.floor(cz - r), Math.ceil(cx + r), Math.ceil(cz + r), (x, z) => {
        if (Math.hypot(x - cx, z - cz) <= r) cells[x + S * z] ??= tag
      })
    },
    reserveCell(x, z, tag = 'used') {
      if (x >= 0 && z >= 0 && x < S && z < S) cells[x + S * z] ??= tag
    },
    free(x0, z0, x1, z1) {
      if (!inside(Math.round(x0), Math.round(z0), Math.round(x1), Math.round(z1))) return false
      return each(Math.round(x0), Math.round(z0), Math.round(x1), Math.round(z1), (x, z) => cells[x + S * z] === null)
    },
    freeDisc(cx, cz, r) {
      if (!inside(Math.floor(cx - r), Math.floor(cz - r), Math.ceil(cx + r), Math.ceil(cz + r))) return false
      return each(Math.floor(cx - r), Math.floor(cz - r), Math.ceil(cx + r), Math.ceil(cz + r), (x, z) => Math.hypot(x - cx, z - cz) > r || cells[x + S * z] === null)
    },
    tag(x, z) {
      if (x < 0 || z < 0 || x >= S || z >= S) return 'outside'
      return cells[x + S * z]
    },
  }
}

// Find room for something round (a landmark, a giant tree, a rock, a moshpit) and reserve it.
//   findSpot(ctx, { r: 14, ring: [70, 95] })                 somewhere 70-95 from the middle
//   findSpot(ctx, { r: 6, ring: [20, 40], angles: [45, 315] }) try these directions first (0 = north)
//   findSpot(ctx, { r: 8, box: [x0, z0, x1, z1] })           anywhere inside a rectangle
// `edge` keeps the disc that far inside the canvas (default 8: the island's shore). Returns
// { x, z, r } or null when nothing fits (then make the canvas bigger or the thing smaller).
export function findSpot(ctx, { r, ring, angles, box, tag = 'feature', edge = 8, pad = 2, tries = 400 } = {}) {
  const { grid, S, rng } = ctx
  const ok = (x, z) => x - r - edge >= 0 && z - r - edge >= 0 && x + r + edge < S && z + r + edge < S && grid.freeDisc(x, z, r + pad)
  const take = (x, z) => {
    x = Math.round(x)
    z = Math.round(z)
    if (!ok(x, z)) return null
    grid.reserveDisc(x, z, r + pad, tag)
    return { x, z, r }
  }
  if (ring) {
    const [r0, r1] = ring
    for (const a of angles ?? []) for (let k = 0; k <= 4; k += 1) {
      const hit = take(...polar(ctx, a, r0 + ((r1 - r0) * k) / 4))
      if (hit) return hit
    }
    for (let i = 0; i < tries; i += 1) {
      const hit = take(...polar(ctx, rng.range(0, 360), rng.range(r0, r1)))
      if (hit) return hit
    }
    return null
  }
  const [x0, z0, x1, z1] = box ?? [0, 0, S - 1, S - 1]
  for (let i = 0; i < tries; i += 1) {
    const hit = take(rng.range(x0, x1), rng.range(z0, z1))
    if (hit) return hit
  }
  return null
}

// Angles round the middle: 0 = north (the way players look when they spawn), clockwise in
// degrees, so 90 = east, 180 = south, 270 = west. polar(ctx, a, r) → [x, z] (not rounded).
export function polar(ctx, angleDeg, r) {
  const a = (angleDeg * Math.PI) / 180
  return [ctx.C[0] + Math.sin(a) * r, ctx.C[1] - Math.cos(a) * r]
}
// the side of `from` that faces `to` (for npcSpot / sign / crate facings)
export function facingToward(from, to) {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  if (Math.abs(dx) >= Math.abs(dz)) return dx > 0 ? 'east' : 'west'
  return dz > 0 ? 'south' : 'north'
}
// Minecraft yaw that looks from `from` to `to` (south 0, west 90, north 180, east -90)
export function yawToward(from, to) {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  let yaw = (Math.atan2(-dx, dz) * 180) / Math.PI
  if (yaw <= -180) yaw += 360
  return Math.round(yaw * 10) / 10
}
