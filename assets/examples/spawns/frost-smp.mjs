// Frost SMP — a hand-built NORMAL spawn with a SQUARE plaza, winter theme, 180 x 180.
// It shows three things the round Ember SMP example does not:
//   1. another composition: a square plaza on a cross of avenues, the NPCs in two lines along the
//      central aisle, the boards on the west side and the crates on the east, cabins round it;
//   2. a hero structure written from scratch with b.set (the decorated Christmas spruce), the way
//      you build anything the parts don't have;
//   3. a seasonal pass: snowfall() snows on everything at the end, your own structures included.
//
// The interview: normal spawn, 8 NPCs, winter, accent red, boards Money / Playtime / Votes, crates
// Vote / Common / Rare / Epic / Legendary, an RTP gate, an AFK pond, no signs, valley setting.
//
//          N  (hills all round: the valley setting)
//     cabins   cabins | cabins   cabins
//            +--------+--------+
//            |   CHRISTMAS     |
//     boards |  o    TREE    o | crates      o = NPC on a plinth, two lines of 4 along the aisle
//     (west) |  o            o | (east)
//            |  o    SPAWN   o |             the spawn faces north, straight at the tree
//            |  o            o |
//            +--------+--------+
//     cabins      RTP gate      AFK pond (south-east corner)
//                    S
//
// Build: node scripts/run-build.mjs assets/examples/spawns/frost-smp.mjs --out-dir minecraft-builds/frost-smp

import { startSpawn, finishSpawn, facingToward } from '../../spawn-parts/spawn.mjs'
import { buildSite, paveRect, pavePath } from '../../spawn-parts/site.mjs'
import { npcPlinth } from '../../spawn-parts/plaza.mjs'
import { boardsPlaza, crateCourt } from '../../spawn-parts/features.mjs'
import { building } from '../../spawn-parts/buildings.mjs'
import { afkPark, bench, clutter, lamp, landscapePass } from '../../spawn-parts/landscape.mjs'
import { snowfall } from '../../spawn-parts/seasons.mjs'

const NPCS = [
  { id: 'shop', label: 'Shop' }, { id: 'auction', label: 'Auction House' }, { id: 'kits', label: 'Kits' },
  { id: 'store', label: 'Store' }, { id: 'quests', label: 'Quests' }, { id: 'sell', label: 'Sell' },
  { id: 'warps', label: 'Warps' }, { id: 'tutorial', label: 'Start Here' },
]
const BOARDS = [{ id: 'money', label: 'Money' }, { id: 'playtime', label: 'Playtime' }, { id: 'votes', label: 'Votes' }]
const CRATES = [
  { id: 'vote', label: 'Vote', tier: 'vote' }, { id: 'common', label: 'Common', tier: 'common' },
  { id: 'rare', label: 'Rare', tier: 'rare' }, { id: 'epic', label: 'Epic', tier: 'epic' },
  { id: 'legendary', label: 'Legendary', tier: 'legendary' },
]

export default function build(api) {
  const ctx = startSpawn(api, { name: 'Frost SMP', size: 180, height: 100, theme: 'winter', accent: 'red', setting: 'valley', seed: 11 })
  const { b, kit, theme, FY, C, S, grid, rng, M } = ctx
  const [cx, cz] = C

  // ================================================================ 1. plan
  const P = 30 // the plaza runs cx-30..cx+30 (61 square), the street 5 more all round
  const plaza = { x0: cx - P, z0: cz - P, x1: cx + P, z1: cz + P }
  ctx.layout.plaza = { x0: plaza.x0 - 5, z0: plaza.z0 - 5, x1: plaza.x1 + 5, z1: plaza.z1 + 5 }
  grid.reserve(plaza.x0 - 5, plaza.z0 - 5, plaza.x1 + 5, plaza.z1 + 5, 'plaza')
  // the avenues (5 wide) from the middle of each side to the shore
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const [ax, bx] = dx ? [cx + dx * P, cx + dx * (S / 2 - 2)] : [cx - 3, cx + 3]
    const [az, bz] = dz ? [cz + dz * P, cz + dz * (S / 2 - 2)] : [cz - 3, cz + 3]
    grid.reserve(ax, az, bx, bz, 'road')
  }
  const pads = []
  const slot = (s, pad = 2) => {
    grid.reserve(s.x0, s.z0, s.x1, s.z1, s.kind, pad)
    pads.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, y: FY, blend: 5 })
    return s
  }
  // the NPC lines: x = cx -/+ 9, from 10 north of the spawn to 8 south, 6 apart
  const npcSpots = []
  for (const z of [cz - 10, cz - 4, cz + 2, cz + 8]) npcSpots.push([cx - 9, z], [cx + 9, z])
  const tree = { x: cx, z: cz - 19, h: 27 } // the hero, 19 north of the spawn: the whole first view
  // the AFK pond takes the south-east corner of the town
  const afk = slot({ kind: 'afk', x0: cx + 40, z0: cz + 40, x1: cx + 56, z1: cz + 56 })
  // cabins in a square ring outside the street, facing the plaza, gaps at the avenues; a hall on
  // three of the corners (the fourth is the pond). Sizes and storeys vary so no two neighbours match.
  const houses = []
  let k = 0
  for (const side of ['north', 'east', 'south', 'west'])
    for (const u of [-36, -19, 19, 36]) {
      const facing = { north: 'south', south: 'north', east: 'west', west: 'east' }[side]
      const [nx, nz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[side]
      const w = 11 + 2 * rng.int(0, 2)
      const d = 9 + 2 * rng.int(0, 1)
      const dist = P + 8 + Math.ceil(d / 2) + rng.int(0, 2) // set back from the street, a little ragged
      const mx = cx + nx * dist + (nx ? 0 : u)
      const mz = cz + nz * dist + (nz ? 0 : u)
      const [fw, fd] = nx ? [d, w] : [w, d]
      const s = { kind: 'house', x0: mx - Math.floor(fw / 2), z0: mz - Math.floor(fd / 2), facing, y: FY, seed: ctx.seed * 17 + k++, storeys: 1 + rng.int(0, 2) }
      s.x1 = s.x0 + fw - 1
      s.z1 = s.z0 + fd - 1
      if (grid.free(s.x0 - 2, s.z0 - 2, s.x1 + 2, s.z1 + 2)) houses.push(slot(s))
    }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1]]) {
    const mx = cx + sx * 50
    const mz = cz + sz * 50
    const s = { kind: 'hall', x0: mx - 9, z0: mz - 7, x1: mx + 9, z1: mz + 7, facing: sz < 0 ? 'south' : 'north', y: FY, seed: ctx.seed * 29 + sx * 3 + sz, storeys: 2 }
    if (grid.free(s.x0 - 2, s.z0 - 2, s.x1 + 2, s.z1 + 2)) houses.push(slot(s))
  }

  // ================================================================ 2. the site
  buildSite(ctx, { pads, flat: (x, z) => Math.max(Math.abs(x - cx), Math.abs(z - cz)) < 62 })

  // ================================================================ 3. the plaza
  // the street (path field) under everything, then the plaza: a coursed field with a border, two
  // inlay lines down the central aisle and an inlay frame 16 out: few, long, straight lines read as
  // design; dotted or scattered inlay reads as noise
  paveRect(ctx, { x0: plaza.x0 - 5, z0: plaza.z0 - 5, x1: plaza.x1 + 5, z1: plaza.z1 + 5, field: ctx.paint.path, corner: 6 })
  paveRect(ctx, { ...plaza, border: theme.paving.border, corner: 4 })
  for (let k2 = -P + 1; k2 <= P - 1; k2 += 1) {
    if (Math.abs(k2) > 3) for (const sx of [-3, 3]) b.set(cx + sx, FY, cz + k2, theme.paving.inlay)
    if (Math.abs(k2) <= 16)
      for (const [x, z] of [[cx + k2, cz - 16], [cx + k2, cz + 16], [cx - 16, cz + k2], [cx + 16, cz + k2]])
        if (Math.abs(x - cx) > 3) b.set(x, FY, z, theme.paving.inlay)
  }
  for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) b.set(cx + dx, FY, cz + dz, Math.max(Math.abs(dx), Math.abs(dz)) === 2 ? theme.paving.border : 'minecraft:polished_diorite')
  b.set(cx, FY, cz, 'minecraft:chiseled_quartz_block')
  b.spawnPoint([cx, FY, cz], 'north')

  NPCS.forEach((npc, i) => npcPlinth(ctx, npc, npcSpots[i]))
  christmasTree(ctx, tree)

  // ================================================================ 4. boards west, crates east
  ctx.place(boardsPlaza, { cx: cx - P + 6, z: cz, facing: 'east', boards: BOARDS })
  const crates = CRATES.map((c, i) => [cx + P - 6, cz + (i - (CRATES.length - 1) / 2) * 6])
  ctx.place(crateCourt, { points: crates, facings: 'west', crates: CRATES })
  b.portal([cx - 2, FY + 1, cz + P + 3], [cx + 2, FY + 5, cz + P + 3], { ...M, id: 'rtp', label: 'Random Teleport', kind: 'rtp', facing: 'north' })
  ctx.place(afkPark, { ...afk, y: FY })

  // ================================================================ 5. the cabins and walks
  for (const h of houses) {
    const res = ctx.place(building, h)
    if (!res?.door) continue
    // a walk straight from the door to the street, then props beside the door
    const [x, , z] = res.door
    const to = h.facing === 'south' ? [x, plaza.z0 - 3] : h.facing === 'north' ? [x, plaza.z1 + 3] : h.facing === 'east' ? [plaza.x0 - 3, z] : [plaza.x1 + 3, z]
    pavePath(ctx, [[x, z], to], { width: 3, fray: false })
    ctx.place(clutter, [x + 3, FY, z], ['barrels', 'logs', 'crates'][h.seed % 3])
  }
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) pavePath(ctx, [[cx + dx * (P + 5), cz + dz * (P + 5)], [cx + dx * (S / 2 - 8), cz + dz * (S / 2 - 8)]], { width: 5 })

  // lamps at the plaza corners and every 12 along the street; benches facing the tree
  for (let u = -P; u <= P; u += 12)
    for (const [x, z] of [[cx + u, plaza.z0 - 2], [cx + u, plaza.z1 + 2], [plaza.x0 - 2, cz + u], [plaza.x1 + 2, cz + u]])
      if (Math.abs(x - cx) > 4 && Math.abs(z - cz) > 4) ctx.place(lamp, [x, FY, z], { kind: 'post', seed: x + z })
  for (const sx of [-1, 1]) ctx.place(bench, [cx + sx * 5, FY, tree.z + 8], 'north', { length: 3 })

  ctx.place(landscapePass)
  // last: snow on everything (the plaza swept, drifts on the open ground, the pond's edges frozen)
  snowfall(ctx, { paved: 0.25 })
  return finishSpawn(ctx)
}

// The hero, written by hand: a tall spruce in tiers (each tier a ring of leaves wider at the bottom,
// its edge drooping one block), a trunk of spruce logs, baubles on the outer leaves in the theme's
// accent and two other colours, lights tucked into the foliage, a star on top, presents round the
// foot on a snowy bed. Anything the parts don't have is built like this: plain loops over b.set.
function christmasTree(ctx, { x, z, h }) {
  const { b, kit, FY } = ctx
  const y0 = FY + 1
  // the bed: a round snow patch with a log edge
  for (let dx = -6; dx <= 6; dx += 1)
    for (let dz = -6; dz <= 6; dz += 1) {
      const d = Math.hypot(dx, dz)
      if (d <= 5.2) b.set(x + dx, FY, z + dz, 'minecraft:snow_block')
      else if (d <= 6.2) b.set(x + dx, FY + 1, z + dz, `minecraft:spruce_log[axis=${Math.abs(dx) > Math.abs(dz) ? 'z' : 'x'}]`)
    }
  for (let y = y0; y < y0 + h - 2; y += 1) b.set(x, y, z, 'minecraft:spruce_log[axis=y]')
  // tiers: 6 of them, each 4-5 tall, radius shrinking from 7 to 2 as they climb
  const tiers = 6
  let base = y0 + 3
  for (let t = 0; t < tiers; t += 1) {
    const r0 = 7 - t
    const th = t < 3 ? 5 : 4
    for (let k = 0; k < th; k += 1) {
      const r = r0 * (1 - k / (th + 1)) + 0.4
      const y = base + k
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx += 1)
        for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz += 1) {
          const d = Math.hypot(dx, dz) + 0.6 * (kit.hash01(x + dx, y, z + dz, 3) - 0.5)
          if (d > r) continue
          if (dx === 0 && dz === 0) continue
          b.set(x + dx, y, z + dz, 'minecraft:spruce_leaves[persistent=true]')
          // the tier's bottom edge droops one block
          if (k === 0 && d > r - 1.1) b.set(x + dx, y - 1, z + dz, 'minecraft:spruce_leaves[persistent=true]')
        }
    }
    base += th - 1
  }
  // baubles and lights on the outer leaves (cells with air outside them), never a bare light in view
  const colours = [`minecraft:${ctx.theme.accent}_concrete`, 'minecraft:white_concrete', 'minecraft:light_blue_concrete']
  for (let y = y0 + 2; y < base; y += 1)
    for (let dx = -8; dx <= 8; dx += 1)
      for (let dz = -8; dz <= 8; dz += 1) {
        if (b.nameAt(x + dx, y, z + dz) !== 'minecraft:spruce_leaves') continue
        const outside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oz]) => !b.get(x + dx + ox, y, z + dz + oz))
        if (!outside) continue
        const r = kit.hash01(x + dx, y, z + dz, 41)
        if (r < 0.06) b.set(x + dx, y, z + dz, colours[Math.floor(r * 50) % 3])
        else if (r < 0.09) b.set(x + dx, y, z + dz, 'minecraft:shroomlight')
      }
  // the star: a little cross of yellow glass round a glowing core
  const top = base + 1
  b.set(x, top, z, 'minecraft:sea_lantern')
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) b.set(x + dx, top + dy, z + dz, 'minecraft:yellow_stained_glass')
  b.set(x, top - 1, z, 'minecraft:spruce_log[axis=y]')
  // presents: a few 1-2 block boxes round the foot in wool colours with a contrasting "ribbon" block
  const gifts = [[3, 2, 'red_wool'], [-3, 3, 'lime_wool'], [2, -3, 'light_blue_wool'], [-2, -2, 'white_wool'], [4, -1, 'red_wool']]
  for (const [dx, dz, wool] of gifts) {
    b.set(x + dx, y0, z + dz, `minecraft:${wool}`)
    if (kit.hash01(x + dx, 1, z + dz, 5) < 0.5) b.set(x + dx, y0 + 1, z + dz, `minecraft:${wool === 'white_wool' ? 'red' : 'white'}_carpet`)
  }
  // fences with lanterns at four corners of the bed
  for (const [dx, dz] of [[5, 5], [-5, 5], [5, -5], [-5, -5]]) {
    b.set(x + dx, FY + 1, z + dz, 'minecraft:spruce_fence')
    b.set(x + dx, FY + 2, z + dz, 'minecraft:lantern[hanging=false]')
  }
  void facingToward
}
