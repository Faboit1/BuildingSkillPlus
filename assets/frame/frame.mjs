// The frame of a spawn recipe: the plumbing every spawn needs and nothing you can see. It makes the
// canvas, keeps track of what is reserved, finds room, converts angles, and at the end removes what
// the game would drop, adds the safe region, spawn-proofs and exports the placements. Every block of
// the spawn itself (the island, the paving, the stones, the trees, the NPC places, the buildings...)
// is yours to write: references/spawns/build-guide.md, with do and don't examples for each.
//
//   import { startSpawn, finishSpawn, polar, facingToward, yawToward, findSpot, local } from './frame/frame.mjs'
//   export default function build(api) {
//     const ctx = startSpawn(api, { name: 'Ember SMP', size: 200, seed: 7 })
//     // ...plan, then build every element...
//     return finishSpawn(ctx)
//   }
//
// ctx:
//   api, kit, b            the run-build api, the kit, the Builder (b.set, b.box, b.markNpc...)
//   name, slug             the server name and its file-safe slug
//   rng, seed              a seeded random generator: rng(), rng.int(a, b), rng.range(a, b), rng.chance(p)
//   S, H, FY, C            canvas side, height, the plaza floor block level (players stand at FY + 1),
//                          C = [cx, cz], the middle column (put the world spawn there or near it)
//   grid                   occupancy, one tag per column: reserve(x0, z0, x1, z1, tag, pad),
//                          reserveDisc(cx, cz, r, tag), free(x0, z0, x1, z1), freeDisc(cx, cz, r), tag(x, z)
//   layout                 an object for your own plan (anything you want to keep between sections)
//   hologram(id, text, [x, y, z])  a free-standing hologram for setup.md (y = its top line)
//   warn(msg)              a note in the build report
//   place(fn, ...args)     run fn(ctx, ...args); an error becomes a warning instead of a crash

import { cleanupSpawn } from './cleanup.mjs'

export function startSpawn(api, { name = 'Spawn', size = 200, height = 100, seed = 7, floorY } = {}) {
  const { kit } = api
  const S = size
  const H = height
  const b = api.builder([S, H, S], { seed })
  const rng = kit.rng(seed * 7919 + 13)
  // the plaza floor: a floating island needs room for its underside; the rest is sky
  const FY = floorY ?? Math.max(14, Math.min(Math.round(H * 0.34), Math.round(S * 0.22) + 6))
  const C = [Math.floor(S / 2), Math.floor(S / 2)]
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'spawn'
  const ctx = {
    api, kit, b, name, slug, rng, seed, S, H, FY, C,
    layout: {},
    warnings: [],
    warn(msg) { ctx.warnings.push(msg) },
    hologram(id, text, [x, y, z]) {
      return b.markHologram(id, text, [x, y, z])
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

// The last step: drop what the game would pop off (flowers on stone, lanterns hanging from air...),
// the safe region, spawn-proofing (invisible light in every dark walkable cell), finish().
//   safeZone = [x0, z0, x1, z1] (default the whole canvas); add other regions (a PvP pit, a
//   warzone) with b.region before this, with a higher priority. land(x, z) = true on the island
//   (spawn-proofing stays on it; default everywhere).
export function finishSpawn(ctx, { safeZone, description, cleanup = true, land } = {}) {
  const { b, S, H, FY } = ctx
  if (!b.placements?.some(p => p.type === 'spawn')) ctx.warn('no world spawn: call b.spawnPoint([x, FY, z], facing) on the plaza')
  const cleaned = cleanup ? ctx.place(cleanupSpawn) ?? 0 : 0
  const [x0, z0, x1, z1] = safeZone ?? [0, 0, S - 1, S - 1]
  b.region('spawn', [x0, 0, z0], [x1, H - 1, z1], { pvp: 'deny', 'mob-spawning': 'deny', 'fall-damage': 'deny', 'item-drop': 'deny', priority: 10 })
  for (const w of ctx.warnings) b.warnings.push(`spawn: ${w}`)
  const inside = land ?? ctx.site?.land ?? (() => true)
  const result = b.finish({
    name: ctx.slug,
    description: description ?? `${ctx.name} spawn (${S}x${S})`,
    spawnProof: { min: [0, Math.max(0, FY - 6), 0], max: [S - 1, H - 1, S - 1], inside: (x, z, y) => inside(x, z, y) },
    // the quality numbers run-build prints and the export gate checks (scripts/lib/kit/audit.mjs)
    audit: { inside: (x, z) => inside(x, z) },
  })
  result.metadata ??= {}
  result.metadata.spawn = { name: ctx.name, floorY: FY, warnings: ctx.warnings, cleaned, ...(ctx.theme?.key ? { theme: ctx.theme.key, setting: ctx.theme.setting } : {}) }
  return result
}

// Occupancy grid: one tag per column. Reserve the footprint of every place (plus a margin) while
// planning, so what you place later keeps off it.
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

// Find room for something round (a tree, a rock group, a statue) and reserve it.
//   findSpot(ctx, { r: 14, ring: [70, 95] })                   somewhere 70-95 from the middle
//   findSpot(ctx, { r: 6, ring: [20, 40], angles: [45, 315] }) try these directions first (0 = north)
//   findSpot(ctx, { r: 8, box: [x0, z0, x1, z1] })             anywhere inside a rectangle
// `edge` keeps the disc that far inside the canvas (default 8). Returns { x, z, r } or null.
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

// Angles round the middle: 0 = north (the way players look when they spawn), clockwise in degrees,
// so 90 = east, 180 = south, 270 = west. polar(ctx, a, r) → [x, z] (not rounded).
export function polar(ctx, angleDeg, r) {
  const a = (angleDeg * Math.PI) / 180
  return [ctx.C[0] + Math.sin(a) * r, ctx.C[1] - Math.cos(a) * r]
}
// the side of `from` that faces `to` (for facings of NPCs, crates, doors)
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

// Building something that faces a way (an NPC place, a crate, a gate, a house front) without
// working out x and z for each facing. local(pos, facing).at(u, d, h) is the block u to the right
// (as the players in front see it), d toward the players and h up from pos. The names give the
// block states: out (the facing), back, left, right (as the players see them), and the log axes
// along the front (across) and front-to-back (deep).
const STEP = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }
const RIGHT_OF = { south: 'east', north: 'west', east: 'north', west: 'south' }
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' }
export function local(pos, facing) {
  if (!STEP[facing]) throw new Error(`facing must be north | east | south | west (got ${facing})`)
  const [px, py, pz] = pos.map(v => Math.round(v))
  const F = STEP[facing]
  const R = STEP[RIGHT_OF[facing]]
  const right = RIGHT_OF[facing]
  return {
    out: facing,
    back: OPPOSITE[facing],
    right,
    left: OPPOSITE[right],
    across: F[0] === 0 ? 'x' : 'z',
    deep: F[0] === 0 ? 'z' : 'x',
    at: (u, d = 0, h = 0) => [px + R[0] * u + F[0] * d, py + h, pz + R[1] * u + F[1] * d],
  }
}
