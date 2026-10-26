// Open-air spawn features, the way real SMP spawns place them: nothing in a building, no block-letter
// signs, every label a hologram.
//   crateCourt(ctx, { points, facings, y, crates })   crates on carved plinths in a row or an arc
//   boardsPlaza(ctx, { cx, z, y, facing, boards })      hologram leaderboards over low plinths, a top-3
//                                                       podium for statues in front of the middle one
// Both record the same placements as the spawn kit (type 'crate' / 'leaderboard' / 'npc' statues),
// so <slug>.setup.md gets the crate, hologram and NPC commands.

const DV = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }
const r2 = v => Math.round(v * 100) / 100
const CRATE_BLOCKS = { vote: 'chest', common: 'chest', uncommon: 'chest', rare: 'ender_chest', epic: 'ender_chest', legendary: 'ender_chest', mythic: 'ender_chest', seasonal: 'barrel' }
const TIER_COLOUR = { vote: 'lime', common: 'white', uncommon: 'light_blue', rare: 'blue', epic: 'purple', legendary: 'orange', mythic: 'red', seasonal: 'cyan' }

function record(b, rec) {
  b.placements ??= []
  b.placements.push(rec)
  return rec
}

// One crate station: a 3x3 carved plinth (trim stairs round a tier-coloured core), the crate on top,
// a lantern on each side, and a clear standing area in front.
function crateStation(ctx, [x, y, z], facing, crate) {
  const { b, kit, theme } = ctx
  const trim = kit.material(theme.trim)
  const colour = TIER_COLOUR[crate.tier] ?? 'white'
  const [fx, fz] = DV[facing]
  const [rx, rz] = [-fz, fx] // to the player's left looking at the crate
  for (let u = -1; u <= 1; u += 1)
    for (let d = -1; d <= 1; d += 1) {
      const px = x + rx * u + fx * d
      const pz = z + rz * u + fz * d
      b.set(px, y, pz, theme.paving.border)
      if (u === 0 && d === 0) b.set(px, y + 1, pz, `minecraft:${colour}_glazed_terracotta`)
      else if (d === 1 && trim.stairs) b.set(px, y + 1, pz, `${trim.stairs}[facing=${kit.opposite(facing)}]`)
      else if (trim.slab) b.set(px, y + 1, pz, `${trim.slab}[type=bottom]`)
    }
  const block = crate.block ?? CRATE_BLOCKS[crate.tier] ?? 'chest'
  const state = block === 'barrel' ? `minecraft:barrel[facing=up,open=false]` : `minecraft:${block}[facing=${facing}]`
  b.set(x, y + 2, z, state)
  for (const s of [-1, 1]) {
    const lx = x + rx * s * 2
    const lz = z + rz * s * 2
    b.set(lx, y + 1, lz, `minecraft:${theme.key === 'japanese' ? 'stone_brick_wall' : 'polished_blackstone_brick_wall'}`)
    b.set(lx, y + 2, lz, theme.lantern === 'lantern' ? 'minecraft:lantern[hanging=false]' : `minecraft:${theme.lantern}`)
  }
  // keep the standing area in front clear of later props
  b.spawnClearance ??= []
  const stand = []
  for (let u = -1; u <= 1; u += 1) for (let d = 2; d <= 4; d += 1) for (const h of [1, 2]) stand.push([x + rx * u + fx * d, y + h, z + rz * u + fz * d])
  b.spawnClearance.push({ label: `crate "${crate.id}"`, cells: stand })
  ctx.site.paved[x + ctx.S * z] = 1
  return record(b, { type: 'crate', id: crate.id, label: `${crate.label} Crate`, tier: crate.tier, block, pos: [x, y + 2, z], facing, hologram: [x + 0.5, r2(y + 2 + 1.6), z + 0.5] })
}

// points: [[x, z], ...] crate block columns; facings: the side players stand on, per crate (or one)
export function crateCourt(ctx, { points, facings, y = ctx.FY, crates }) {
  const recs = []
  crates.forEach((c, i) => {
    const p = points[i]
    if (!p) return
    const f = Array.isArray(facings) ? facings[i] : facings
    recs.push(crateStation(ctx, [Math.round(p[0]), y, Math.round(p[1])], f, c))
  })
  return recs
}

// Hologram leaderboards: a low carved plinth per board (the hologram floats 4 above it), the middle
// board raised one step, a top-3 podium in front of it. The row is centred on [cx, z], players stand
// on the `facing` side.
export function boardsPlaza(ctx, { cx, z, y = ctx.FY, facing = 'south', boards, gap = 7 }) {
  const { b, kit, theme, M } = ctx
  const trim = kit.material(theme.trim)
  const [fx, fz] = DV[facing]
  const [rx, rz] = [-fz, fx]
  const n = boards.length
  const recs = []
  boards.forEach((board, i) => {
    const u = Math.round((i - (n - 1) / 2) * gap)
    const hero = n >= 3 && i === Math.floor((n - 1) / 2)
    const bx = cx + rx * u
    const bz = z + rz * u
    const top = y + (hero ? 3 : 2)
    for (let du = -2; du <= 2; du += 1)
      for (let dd = -1; dd <= 1; dd += 1) {
        const px = bx + rx * du + fx * dd
        const pz = bz + rz * du + fz * dd
        const edge = Math.abs(du) === 2 || Math.abs(dd) === 1
        for (let h = y + 1; h < top; h += 1) b.set(px, h, pz, edge ? theme.paving.border : theme.plinth)
        if (Math.abs(du) <= 1 && dd === 0) b.set(px, top, pz, du === 0 ? theme.light : `minecraft:${M.colour}_stained_glass`)
        else if (dd === 1 && trim.stairs) b.set(px, top, pz, `${trim.stairs}[facing=${kit.opposite(facing)}]`)
        else if (trim.slab) b.set(px, top, pz, `${trim.slab}[type=bottom]`)
        ctx.site.paved[px + ctx.S * pz] = 1
      }
    recs.push(record(b, { type: 'leaderboard', id: board.id, label: board.label, anchor: [bx + 0.5, r2(top + 4.2), bz + 0.5], facing, size: [5, 4] }))
    if (hero) {
      // the podium: 2nd (left), 1st (middle), 3rd (right), 3 blocks in front of the middle board
      ;[[-2, 2, 2], [0, 3, 1], [2, 1, 3]].forEach(([du, h, rank]) => {
        const px = bx + rx * du + fx * 3
        const pz = bz + rz * du + fz * 3
        for (let k = 1; k <= h; k += 1) b.set(px, y + k, pz, k === h ? (rank === 1 ? 'minecraft:chiseled_quartz_block' : rank === 2 ? 'minecraft:iron_block' : 'minecraft:waxed_copper_block') : theme.plinth)
        const rec = b.npcSpot([px, y + h, pz], facing, { ...M, id: `${board.id}-top${rank}`, label: `#${rank} ${board.label}`, role: 'statue', style: 'none', rank })
        recs.push(rec)
      })
    }
  })
  return recs
}

// A paved crate yard in a rectangle whose open side faces `facing` (the street): the crates in a row
// 5 in from the open side, facing it, a hedge along the back, lamps at the ends. No building, no sign.
export function crateYard(ctx, { x0, z0, x1, z1, y = ctx.FY, facing, crates }, { hedge, lamp }) {
  const { b } = ctx
  for (let x = x0; x <= x1; x += 1)
    for (let z = z0; z <= z1; z += 1) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1
      b.set(x, y, z, edge ? ctx.theme.paving.border : ctx.paint.field)
      ctx.site.paved[x + ctx.S * z] = 1
    }
  const alongX = facing === 'north' || facing === 'south'
  const [a0, a1] = alongX ? [x0, x1] : [z0, z1]
  const line = { north: z0 + 5, south: z1 - 5, west: x0 + 5, east: x1 - 5 }[facing]
  const back = { north: z1 - 1, south: z0 + 1, west: x1 - 1, east: x0 + 1 }[facing]
  const n = crates.length
  const mid = (a0 + a1) / 2
  const points = crates.map((c, i) => {
    const u = Math.round(mid + (i - (n - 1) / 2) * 6)
    return alongX ? [u, line] : [line, u]
  })
  const recs = crateCourt(ctx, { points, facings: facing, y, crates })
  if (hedge) {
    if (alongX) hedge(ctx, [a0 + 1, back], [a1 - 1, back], y, { height: 2 })
    else hedge(ctx, [back, a0 + 1], [back, a1 - 1], y, { height: 2 })
  }
  if (lamp) for (const u of [a0 + 1, a1 - 1]) lamp(ctx, alongX ? [u, y, line] : [line, y, u], { kind: 'post' })
  return recs
}

// Top-3 pillars (top spenders, baltop...): 2nd, 1st, 3rd side by side, the 1st tallest, each a carved
// column on a stepped base with the rank block on top where a statue NPC (the player's skin) stands,
// its hologram over it, and the title floating above the 1st. [x, z] = the middle pillar; players
// stand on the `facing` side.
export function top3Pillars(ctx, { x, z, y = ctx.FY, facing = 'south', id, label }) {
  const { b, kit, theme, M } = ctx
  const trim = kit.material(theme.trim)
  const shaft = /log|stem/.test(theme.wall.quoin) ? `minecraft:${theme.wall.quoin.replace(/^minecraft:/, '')}[axis=y]` : theme.wall.quoin
  const [fx, fz] = DV[facing]
  const [rx, rz] = [-fz, fx]
  const recs = []
  for (const [u, h, rank] of [[-4, 4, 2], [0, 6, 1], [4, 3, 3]]) {
    const px = x + rx * u
    const pz = z + rz * u
    // base: a 3x3 course with stair nosing all round
    for (let du = -1; du <= 1; du += 1)
      for (let dd = -1; dd <= 1; dd += 1) {
        const bx = px + rx * du + fx * dd
        const bz = pz + rz * du + fz * dd
        if (du === 0 && dd === 0) b.set(bx, y + 1, bz, theme.paving.border)
        else if (trim.stairs) {
          const f = dd === 1 ? facing : dd === -1 ? kit.opposite(facing) : (rx * du > 0 || rz * du > 0) ? dirOf(rx, rz) : kit.opposite(dirOf(rx, rz))
          b.set(bx, y + 1, bz, `${trim.stairs}[facing=${kit.opposite(f)}]`)
        }
        ctx.site.paved[bx + ctx.S * bz] = 1
      }
    // the column and its capital: stairs flaring out under the rank block
    for (let k = 2; k < h; k += 1) b.set(px, y + k, pz, shaft)
    const cap = rank === 1 ? 'minecraft:chiseled_quartz_block' : rank === 2 ? 'minecraft:iron_block' : 'minecraft:waxed_copper_block'
    b.set(px, y + h, pz, cap)
    if (trim.stairs)
      for (const f of ['north', 'south', 'east', 'west']) {
        const [ox, oz] = DV[f]
        b.set(px + ox, y + h - 1, pz + oz, `${trim.stairs}[facing=${kit.opposite(f)},half=top]`)
      }
    const rec = b.npcSpot([px, y + h, pz], facing, { ...M, id: `${id}-top${rank}`, label: `#${rank} ${label}`, role: 'statue', style: 'none', rank })
    recs.push(rec)
  }
  ctx.hologram(`${id}-title`, label.toUpperCase(), [x, y + 6 + 4.4, z])
  return recs
}
const dirOf = (dx, dz) => (dx > 0 ? 'east' : dx < 0 ? 'west' : dz > 0 ? 'south' : 'north')
