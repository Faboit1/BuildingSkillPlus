// The themed frame the example spawns use: the plain frame (../frame/frame.mjs: the canvas, the grid,
// the angle helpers, the finish) plus a theme's materials as ctx.theme, ctx.M and ctx.paint. An
// example, like the other parts: your own spawns start from ../frame/frame.mjs and choose their own
// materials. The examples start and end with it:
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
import { startSpawn as startFrame, finishSpawn as finishFrame, createGrid, findSpot, polar, facingToward, yawToward, local } from '../frame/frame.mjs'

export { createGrid, findSpot, polar, facingToward, yawToward, local }

export function startSpawn(api, { theme = 'medieval', accent, setting, ...rest } = {}) {
  const t = resolveTheme(theme, accent)
  if (setting) t.setting = setting
  const ctx = startFrame(api, rest)
  const { kit, seed } = ctx
  ctx.theme = t
  ctx.M = { ...t.kit, light: t.light }
  ctx.paint = {
    ground: kit.palette(t.ground, { scale: 5, seed: seed + 1 }),
    field: kit.palette(t.paving.field, { scale: 4, seed: seed + 2 }),
    path: kit.palette(t.paving.path, { scale: 3, seed: seed + 3 }),
    wall: kit.palette(t.wall.field, { scale: 3, seed: seed + 4 }),
  }
  ctx.site = null
  return ctx
}

// The frame's finish, with the theme in the description; the cleanup runs once the site is built.
export function finishSpawn(ctx, { safeZone, description, cleanup = true } = {}) {
  return finishFrame(ctx, { safeZone, description: description ?? `${ctx.name} spawn (${ctx.theme.label}, ${ctx.S}x${ctx.S})`, cleanup: cleanup && !!ctx.site })
}
