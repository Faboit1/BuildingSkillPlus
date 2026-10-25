// The spawn generator: one brief in, a finished server spawn out.
//
//   import { generateSpawn } from './scripts/lib/spawngen/index.mjs'
//   export default api => generateSpawn(api, { name: 'CheeseSMP', type: 'normal', npcs: 8, theme: 'autumn' })
//
// scripts/make-spawn.mjs wraps this (brief.json → .nbt/.schem/.litematic, placements, setup.md,
// renders). The pipeline, in order:
//   1. normalizeBrief (brief.mjs) and resolveTheme (themes.mjs)
//   2. createContext: the builder, the theme's paints, the occupancy grid
//   3. layout (layout-normal / layout-plus / layout-pvp): pure geometry, no blocks. It decides the
//      plaza, the spawn, every slot (npc ring, boards, crates, rtp, pvp, buildings, trees) and the
//      paths, and reserves their ground in the grid
//   4. site (site.mjs): the island terrain, levelled pads under the slots, the plaza paving
//   5. the layout's build(): kit components (npcSpot, leaderboards, crateRow, portal, sign),
//      buildings (buildings.mjs) and props (landscape.mjs) on the slots
//   6. landscape: feature trees, woodland on the free ground, flowers, path lamps
//   7. opts.after(ctx) (the editable recipe's hook), regions, spawn-proofing, finish()
//
// ctx (passed to every module):
//   api, kit, b            the run-build api, the kit, the Builder
//   brief, theme, rng      normalized brief, resolved theme, seeded rng (kit.rng)
//   S, H, FY, C            canvas side, height, plaza floor block level (players stand at FY + 1),
//                          C = [cx, cz] the spawn column
//   M                      spawn-kit materials (theme.kit) for npcSpot/leaderboards/crate/portal/sign
//   paint                  ready kit.palette paints: ground, field, path, wall
//   grid                   occupancy: reserve(x0, z0, x1, z1, tag, pad), free(x0, z0, x1, z1), tag(x, z)
//   site                   after step 4: groundY(x, z), land(x, z), level(rect, y)
//   layout                 after step 3: the plan (see layout-*.mjs)
//   hologram(id, text, [x, y, z])  record a free-standing hologram (rules, district names, tips):
//                          x, z = the block column, y = the height of the top line (e.g. floor + 3)
//   warn(msg)              collect a warning for the summary
//   place(fn, ...)         run a module function and keep going if it throws (logs a warning)

import { normalizeBrief, TYPES } from './brief.mjs'
import { resolveTheme } from './themes.mjs'
import { buildSite } from './site.mjs'
import { landscapePass } from './landscape.mjs'
import * as normal from './layout-normal.mjs'
import * as plus from './layout-plus.mjs'
import * as pvp from './layout-pvp.mjs'

const LAYOUTS = { normal, plus, pvp }

// normalizeBrief + the layout's recommended size when the brief gives none (inside the type's range)
export function resolveBrief(input) {
  const { brief, warnings } = normalizeBrief(input)
  const raw = typeof input === 'string' ? JSON.parse(input) : input
  if (raw?.size == null) {
    const T = TYPES[brief.type]
    brief.size = Math.max(T.min, Math.min(T.max, Math.ceil(LAYOUTS[brief.type].recommendSize(brief) / 4) * 4))
    if (raw?.origin == null) brief.origin = [-Math.floor(brief.size / 2), 64, -Math.floor(brief.size / 2)]
  } else {
    const rec = LAYOUTS[brief.type].recommendSize(brief)
    if (brief.size < rec - 8) warnings.push(`size ${brief.size} is small for ${brief.npcs.length} NPCs in a ${brief.type} spawn; ${Math.ceil(rec / 4) * 4} is recommended`)
  }
  return { brief, warnings }
}

export function createContext(api, input) {
  const { brief, warnings } = resolveBrief(input)
  const theme = resolveTheme(brief.theme, brief.accent)
  if (brief.setting) theme.setting = brief.setting
  const { kit } = api
  const S = brief.size
  const H = brief.height
  const b = api.builder([S, H, S], { seed: brief.seed })
  const rng = kit.rng(brief.seed * 7919 + 13)
  // the plaza floor: an island needs room for its underside; the rest is sky for roofs and trees
  const FY = Math.max(14, Math.min(Math.round(H * 0.34), Math.round(S * 0.22) + 6))
  const C = [Math.floor(S / 2), Math.floor(S / 2)]
  const seed = brief.seed
  const paint = {
    ground: kit.palette(theme.ground, { scale: 5, seed: seed + 1 }),
    field: kit.palette(theme.paving.field, { scale: 4, seed: seed + 2 }),
    path: kit.palette(theme.paving.path, { scale: 3, seed: seed + 3 }),
    wall: kit.palette(theme.wall.field, { scale: 3, seed: seed + 4 }),
  }
  const ctx = {
    api, kit, b, brief, theme, rng, seed, S, H, FY, C,
    M: { ...theme.kit, light: theme.light },
    paint,
    warnings: [...warnings],
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
        ctx.warn(`${fn.name || 'module'} failed: ${err.message}`)
        if (process.env.SPAWNGEN_DEBUG) throw err
        return null
      }
    },
  }
  ctx.grid = createGrid(S)
  return ctx
}

// Occupancy grid: one tag per column. Layouts reserve the footprint of every slot (plus a pad), so
// the woodland, flowers and later slots keep off them.
export function createGrid(S) {
  const cells = new Array(S * S).fill(null)
  const clamp = v => Math.max(0, Math.min(S - 1, v))
  const each = (x0, z0, x1, z1, fn) => {
    const [ax, bx] = [clamp(Math.min(x0, x1)), clamp(Math.max(x0, x1))]
    const [az, bz] = [clamp(Math.min(z0, z1)), clamp(Math.max(z0, z1))]
    for (let x = ax; x <= bx; x += 1) for (let z = az; z <= bz; z += 1) if (fn(x, z) === false) return false
    return true
  }
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
      return each(Math.round(x0), Math.round(z0), Math.round(x1), Math.round(z1), (x, z) => (cells[x + S * z] === null ? true : false))
    },
    tag(x, z) {
      if (x < 0 || z < 0 || x >= S || z >= S) return 'outside'
      return cells[x + S * z]
    },
  }
}

// Local frames for anything placed at an angle around the spawn: angle 0 = north (forward, the way
// players look when they spawn), clockwise in degrees, so 90 = east, 180 = south, 270 = west.
export function polar(ctx, angleDeg, r) {
  const a = (angleDeg * Math.PI) / 180
  return [ctx.C[0] + Math.sin(a) * r, ctx.C[1] - Math.cos(a) * r]
}
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

export function generateSpawn(api, input, opts = {}) {
  const ctx = createContext(api, input)
  const { b, brief, S, H } = ctx
  const L = LAYOUTS[brief.type]
  ctx.layout = L.plan(ctx)
  ctx.site = buildSite(ctx)
  L.build(ctx)
  ctx.place(landscapePass)
  if (opts.after) opts.after(ctx)
  // gameplay regions: the whole spawn is safe; layouts add pvp / afk regions with a higher priority
  b.region('spawn', [0, 0, 0], [S - 1, H - 1, S - 1], { pvp: 'deny', 'mob-spawning': 'deny', 'fall-damage': 'deny', 'item-drop': 'deny', priority: 10 })
  const land = ctx.site.land
  for (const w of ctx.warnings) b.warnings.push(`spawngen: ${w}`)
  const result = b.finish({
    name: brief.slug,
    description: `${brief.name} ${brief.type === 'plus' ? 'spawn+' : brief.type === 'pvp' ? 'PvP lobby' : 'spawn'} (${ctx.theme.label}, ${S}x${S}, ${brief.npcs.length} NPCs) generated by spawngen`,
    spawnProof: { min: [0, ctx.FY - 6, 0], max: [S - 1, H - 1, S - 1], inside: (x, z) => land(x, z) },
  })
  result.metadata ??= {}
  result.metadata.spawngen = { brief, theme: ctx.theme.key, setting: ctx.theme.setting, warnings: ctx.warnings, floorY: ctx.FY, spawn: ctx.layout.spawn }
  return result
}
