// The spawn generator: one brief in, a finished server spawn out. It is the engine of the browser
// spawn builder (apps/spawn-generator) and not part of the plugin, where Claude builds every spawn by
// hand from the templates. The layouts and the brief live here; the terrain, buildings, trees,
// crates, boards and set pieces are the plugin's spawn parts (assets/spawn-parts/).
//
//   import { generateSpawn } from './apps/spawn-generator/spawngen/index.mjs'
//   export default api => generateSpawn(api, { name: 'CheeseSMP', type: 'normal', npcs: 8, theme: 'autumn' })
//
// The app's worker (src/worker.js) runs it and exports the files. The pipeline, in order:
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
import { resolveTheme } from '../../../assets/spawn-parts/themes.mjs'
import { buildSite } from '../../../assets/spawn-parts/site.mjs'
import { landscapePass } from '../../../assets/spawn-parts/landscape.mjs'
import { cleanupSpawn } from '../../../assets/frame/cleanup.mjs'
import { createGrid } from '../../../assets/spawn-parts/spawn.mjs'
import { buildWarzone } from './warzone.mjs'
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
    const half = Math.floor(brief.size / 2) + (brief.warzone?.width ?? 0)
    if (raw?.origin == null) brief.origin = [-half, 64, -half]
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
  else if (brief.type === 'normal') theme.setting = 'plains' // normal spawns sit on flat ground
  const { kit } = api
  // the canvas: the spawn square, plus the warzone band all round it when there is one
  const W = brief.warzone ? brief.warzone.width : 0
  const S = brief.size + 2 * W
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
    spawnS: brief.size, // the spawn square's side (the layouts plan inside it)
    W, // the warzone band's width (0 without one)
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

// the grid and the angle helpers are the shared frame's (assets/spawn-parts/spawn.mjs)
export { createGrid, polar, facingToward, yawToward } from '../../../assets/spawn-parts/spawn.mjs'

export function generateSpawn(api, input, opts = {}) {
  const ctx = createContext(api, input)
  const { b, brief, S, H } = ctx
  const L = LAYOUTS[brief.type]
  ctx.layout = L.plan(ctx)
  if (ctx.W) Object.assign(ctx.layout, { siteR: S / 2 - 3, shape: 'square' }) // the island carries the warzone too
  ctx.site = buildSite(ctx)
  L.build(ctx)
  if (brief.warzone) ctx.place(buildWarzone)
  ctx.place(landscapePass)
  if (opts.after) opts.after(ctx)
  const cleaned = ctx.place(cleanupSpawn) ?? 0
  // gameplay regions: the whole spawn is safe; layouts add pvp / afk regions with a higher priority
  const W = ctx.W
  b.region('spawn', [W, 0, W], [W + ctx.spawnS - 1, H - 1, W + ctx.spawnS - 1], { pvp: 'deny', 'mob-spawning': 'deny', 'fall-damage': 'deny', 'item-drop': 'deny', priority: 10 })
  if (W) b.region('warzone', [0, 0, 0], [S - 1, H - 1, S - 1], { pvp: 'allow', 'mob-spawning': 'deny', priority: 5 })
  const land = ctx.site.land
  for (const w of ctx.warnings) b.warnings.push(`spawngen: ${w}`)
  const result = b.finish({
    name: brief.slug,
    description: `${brief.name} ${brief.type === 'plus' ? 'spawn+' : brief.type === 'pvp' ? 'PvP lobby' : 'spawn'} (${ctx.theme.label}, ${S}x${S}, ${brief.npcs.length} NPCs) generated by spawngen`,
    spawnProof: { min: [0, ctx.FY - 6, 0], max: [S - 1, H - 1, S - 1], inside: (x, z) => land(x, z) },
  })
  result.metadata ??= {}
  result.metadata.spawngen = { brief, theme: ctx.theme.key, setting: ctx.theme.setting, warnings: ctx.warnings, floorY: ctx.FY, spawn: ctx.layout.spawn, cleaned }
  return result
}
