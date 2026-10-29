// CRATES. Read this, look at img/crates.png, then design the crate area of your spawn: your own
// arcade, stages, backdrops and tier colours for the theme. b.markCrate records each crate (its
// hologram, the setup command) and keeps the cells above and in front of it clear. On a big spawn
// the crates are a destination: build them a court of their own, a set piece players walk into.
//
// DO
// - A place of its own off the main path: a colonnade, an arcade or an open pavilion 25-40 wide,
//   every crate in its own bay under an arch, 6-8 apart centre to centre, so a crowd round one does
//   not block the next. The best crate in the middle, in a bigger, taller bay (a pediment, a dome).
// - A carved stage per crate (a skirt of steps, chamfered sides; the hero's 2 high), the crate at its
//   front edge facing the players. 3+ blocks of free floor in front of each.
// - The tier colour as an accent, the stone the same for all: a backdrop panel of the tier's
//   terracotta with a stained glass slot lit from behind (calcite behind the glass glows), tier
//   candles on the stage, a mat of the tier's colour in the floor; the hero's colour again in a
//   lunette in its pediment. One design, the tier only in the accent.
// - Value contrast that carries: a dark wall field with light pilasters, arch rings, cornices and
//   stages (or the reverse); the coloured slots glow against the dark.
// - A floor that leads to them: a runner to the hero, a mat in front of each bay; lamp posts in the
//   court between the bays; hidden light in the bays.
// - Nothing over the crate within 2 (its hologram floats 1.6 above it): the arch springs higher.
// DON'T
// - Chests on the grass 2 apart in a line, each on a block of a different coloured concrete.
// - Glowstone or sea lanterns next to them, signs on them, a slab or a lantern right over them.
// - Every crate a different style, or crates hidden behind pillars or sunk in an unlit hole: from
//   the court's entrance every crate (and its hologram) is in view.

import { local } from '../../../assets/frame/frame.mjs'
import { pavedPatch } from './_scene.mjs'

// An arched opening `span` wide (odd): jambs up to jambTop, then rows 2 narrower with stair
// shoulders (span 5: 3; span 7: 5, 3). kind(u, h) = 'open' | 'stair' | 'solid'.
function arch(span, jambTop) {
  const half = (span - 1) / 2
  const rows = []
  for (let w = span - 2; w >= 3; w -= 2) rows.push((w - 1) / 2)
  const top = jambTop + rows.length
  return {
    half, jambTop, top, crown: top + 1,
    kind(u, h) {
      const a = Math.abs(u)
      if (h <= 0 || h > top) return 'solid'
      if (h <= jambTop) return a <= half ? 'open' : 'solid'
      const w = rows[h - jambTop - 1]
      return a <= w ? 'open' : a === w + 1 ? 'stair' : 'solid'
    },
  }
}

// One crate on a carved stage. pos = the floor block under the crate, facing = toward the players.
// The side stage is 5 wide and 1 high (steps in front, chamfered sides); hero: 7 wide, 2 high.
// colour = the tier's dye colour (candles, backdrop), block = the crate block. backdrop: a free-
// standing screen behind it (false when the stage stands in a bay with its own backdrop).
export function crateStage(ctx, pos, facing, { label, tier = 'common', colour = 'light_blue', block = 'chest', crateId, hero = false, backdrop = true, stone = 'stone_brick', base = 'polished_deepslate', top = 'polished_andesite' } = {}) {
  const { b, kit } = ctx
  const L = local(pos, facing)
  const set = (u, d, h, blk) => b.set(...L.at(u, d, h), blk)
  const fallback = kit.material('stone_brick') // for a family without stairs or a slab (a copy: kit.material is cached)
  const S = { stairs: fallback.stairs, slab: fallback.slab, ...kit.material(stone) }
  const B = { stairs: fallback.stairs, slab: fallback.slab, ...kit.material(base) }
  const st = (fam, f) => `${fam.stairs}[facing=${f},half=bottom]`
  const W = hero ? 3 : 2 // half width of the stage's footprint
  const H = hero ? 2 : 1
  for (let lv = 1; lv <= H; lv += 1) {
    const w = W - (lv - 1) // each level 1 narrower
    const front = H - lv + 2 // the front step of this level
    for (let u = -w; u <= w; u += 1)
      for (let d = -2; d <= front - 1; d += 1) {
        const side = Math.abs(u) === w
        const edge = d === front - 1
        if (side && edge) set(u, d, lv, `${B.slab}[type=bottom]`) // the front corners
        else if (edge) set(u, d, lv, st(S, L.back)) // a step up from the front
        else if (side) set(u, d, lv, st(S, u < 0 ? L.right : L.left)) // chamfered sides
        else set(u, d, lv, lv === H && Math.abs(u) <= 1 && d <= 0 ? (top.includes(':') ? top : `minecraft:${top}`) : B.block)
      }
  }
  // tier candles on the back corners of the top (on full blocks, so they stay), lit
  for (const u of [-1, 1]) set(u, -2, H + 1, `minecraft:${colour}_candle[candles=${hero ? 4 : 3},lit=true]`)
  // the crate at the front edge of the top, facing the players
  const crate = L.at(0, 0, H + 1)
  b.set(...crate, block === 'barrel' ? `minecraft:barrel[facing=${L.out}]` : `minecraft:${block}[facing=${L.out}]`)
  if (backdrop) {
    // a screen behind it: posts, the tier's terracotta round a glass slot, a capping
    const T = H + 5
    for (let h = 1; h <= T; h += 1) for (const u of [-W, W]) set(u, -3, h, S.block)
    for (let u = -W + 1; u <= W - 1; u += 1)
      for (let h = 1; h < T; h += 1) set(u, -4, h, h <= H ? S.block : u === 0 ? `minecraft:${colour}_stained_glass` : `minecraft:${colour}_terracotta`)
    for (let u = -W; u <= W; u += 1) set(u, -4, T, S.block)
    for (let u = -W; u <= W; u += 1) set(u, -3, T, `${S.stairs}[facing=${L.back},half=top]`)
  }
  return b.markCrate(crate, facing, { id: crateId, label, tier, block })
}

// A crate court: an arcade of bays, one crate per bay, the hero in a taller middle bay under a
// pediment. pos = the floor block at the middle of the arcade's front (the arch plane), facing =
// toward the players. crates = [{ id, label, tier, colour, block, hero }] from left to right as the
// players see them. The hero takes the middle bay (a crate marked hero is moved there; else the
// middle one is the hero); an odd count keeps the arcade symmetrical.
//   bay / heroBay  the arch openings (odd)     pier  pier width between bays
//   depth  the bays' depth behind the arches   court  the paved court in front
//   pitch  the pediment's roof pitch (1 = a clean 45 degree triangle)
//   stone / trim / base / roof  families: the wall field (dark, so the glowing slots and the trim
//          read); pilasters, rings, cornices and the stages (light); plinths and bay floors
//          (darkest); the hero's roof. field = the wall's clumped mix (default from stone),
//          keystone = the block at each arch's crown
export function cratePavilion(ctx, pos, facing, crates, {
  bay = 5, heroBay = 7, pier = 2, depth = 4, court = 12, field, pitch = 1, keystone = 'chiseled_stone_bricks',
  stone = 'deepslate_brick', trim = 'polished_diorite', base = 'polished_blackstone', roof = 'deepslate_tile', seed = 1,
} = {}) {
  const { b, kit } = ctx
  const L = local(pos, facing)
  const set = (u, d, h, blk) => b.set(...L.at(u, d, h), blk)
  // the families, copied (kit.material is cached); a missing shape falls back to the wall stone's,
  // then to stone bricks'
  const F = kit.material('stone_brick')
  const M = { stone: { stairs: F.stairs, slab: F.slab, wall: F.wall, ...kit.material(stone) } }
  M.trim = { stairs: M.stone.stairs, slab: M.stone.slab, wall: M.stone.wall, ...kit.material(trim) }
  M.base = { stairs: M.stone.stairs, slab: M.stone.slab, wall: M.stone.wall, ...kit.material(base) }
  const st = (m, f, half = 'bottom') => `${M[m].stairs}[facing=${f},half=${half}]`
  const MIX = {
    deepslate_brick: { deepslate_bricks: 7, cracked_deepslate_bricks: 2, deepslate_tiles: 1 },
    stone_brick: { stone_bricks: 7, cracked_stone_bricks: 2, mossy_stone_bricks: 1 },
  }
  const mix = field ?? MIX[stone]
  const wall = mix ? kit.palette(mix, { scale: 3, seed }) : M.stone.block

  // the plan: the hero always takes the middle bay (a crate marked hero moves there, the rest keep
  // their order); bay centres outward from it, piers between, an end pier at each side
  const marked = crates.findIndex(c => c.hero)
  const list = marked < 0 ? crates : [...crates.slice(0, marked), ...crates.slice(marked + 1)]
  const hi = Math.floor((crates.length - 1) / 2)
  if (marked >= 0) list.splice(hi, 0, crates[marked])
  const bays = list.map((c, i) => ({ ...c, i, hero: i === hi, span: i === hi ? heroBay : bay }))
  bays[hi].uc = 0
  const ends = {}
  for (const dirn of [1, -1]) {
    let edge = (heroBay - 1) / 2
    for (let i = hi + dirn; i >= 0 && i < bays.length; i += dirn) {
      const half = (bay - 1) / 2
      bays[i].uc = dirn * (edge + pier + 1 + half)
      edge += pier + 1 + 2 * half
    }
    ends[dirn] = edge + pier // the end pier's outer face
  }
  const U0 = -ends[-1]
  const U1 = ends[1]
  const sideA = arch(bay, 5)
  const heroA = arch(heroBay, 6)
  for (const c of bays) c.A = c.hero ? heroA : sideA
  const bayAt = u => bays.find(c => Math.abs(u - c.uc) <= (c.span - 1) / 2)
  const back = -(depth + 1) // the back wall's face; the wall is 4 thick (the backdrop's lightbox inside)
  const rear = back - 3 // the rear face
  const hb = (heroBay - 1) / 2 + pier // the hero block's half width
  const top = u => (Math.abs(u) <= hb ? heroA.crown + 3 : sideA.crown + 3) // cornice level

  // the arcade: piers, arches and barrel vaults, the back wall with the backdrops
  for (let u = U0; u <= U1; u += 1) {
    const c = bayAt(u)
    const T = top(u)
    for (let d = rear; d <= 0; d += 1) {
      for (let h = 1; h <= T; h += 1) {
        if (!c || d <= back) {
          set(u, d, h, wall)
          continue
        }
        const k = c.A.kind(u - c.uc, h)
        if (k === 'open') continue
        if (k === 'stair') set(u, d, h, st(d === 0 ? 'trim' : 'stone', u < c.uc ? L.left : L.right, 'top'))
        else {
          const ring = d === 0 && h > c.A.jambTop - 1 && [-1, 0, 1].some(du => [-1, 0, 1].some(dh => c.A.kind(u - c.uc + du, h + dh) !== 'solid'))
          set(u, d, h, ring ? M.trim.block : wall)
        }
      }
      if (c && d > back) set(u, d, 0, M.base.block) // the bay floor
    }
    // the cornice, 1 out, and the roof deck
    set(u, 1, T, st('trim', L.back, 'top'))
    if (!c || Math.abs(u) > hb) set(u, 0, T + 1, M.stone.wall) // the balustrade over the side bays
  }
  // keystones
  for (const c of bays) set(c.uc, 0, c.A.crown, keystone.includes(':') ? keystone : `minecraft:${keystone}`)
  // pilasters on the piers' fronts: a dark base, a light shaft, a stair capital
  for (let u = U0; u <= U1; u += 1) {
    if (bayAt(u)) continue
    const J = Math.abs(u) <= hb ? heroA.jambTop : sideA.jambTop
    set(u, 1, 1, M.base.block)
    for (let h = 2; h < J; h += 1) set(u, 1, h, M.trim.block)
    set(u, 1, J, M.trim.block)
    set(u, 2, J, st('trim', L.back, 'top'))
    set(u, 2, 1, st('base', L.back))
  }
  // the piers as runs of columns; a pier's middle (the cell nearer the hero when it is even)
  const piers = []
  for (let u = U0; u <= U1; u += 1) {
    if (bayAt(u)) continue
    if (piers.length && piers[piers.length - 1][1] === u - 1) piers[piers.length - 1][1] = u
    else piers.push([u, u])
  }
  const middle = ([a, c]) => ((a + c) / 2 > 0 ? Math.floor((a + c) / 2) : Math.ceil((a + c) / 2))
  // pedestals on the balustrade over the side piers
  for (const p of piers) {
    if (Math.abs(middle(p)) <= hb) continue
    for (let u = p[0]; u <= p[1]; u += 1) {
      set(u, 0, top(u) + 1, M.trim.block)
      set(u, 0, top(u) + 2, `${M.trim.slab}[type=bottom]`)
    }
  }
  // round the back and the ends (no flat runs): a sloped plinth, pilasters on the pier lines, the
  // cornice and the balustrade carried round; the hero block's cornice over the side roofs too
  const wrap = (u, d, f, T, pilaster) => {
    set(u, d, 1, pilaster ? M.base.block : st('base', f))
    if (pilaster) for (let h = 2; h < T; h += 1) set(u, d, h, M.trim.block)
    set(u, d, T, st('trim', f, 'top'))
  }
  for (let u = U0 - 1; u <= U1 + 1; u += 1) {
    const uu = Math.max(U0, Math.min(U1, u))
    wrap(u, rear - 1, L.out, top(uu), piers.some(p => middle(p) === u))
    if (u >= U0 && u <= U1 && Math.abs(u) > hb) set(u, rear, top(u) + 1, M.stone.wall)
  }
  const midEnd = Math.round(rear / 2)
  for (const [u, f, inward] of [[U0 - 1, L.right, U0], [U1 + 1, L.left, U1]]) {
    wrap(u, 1, f, top(inward), false)
    for (let d = rear; d <= 0; d += 1) {
      wrap(u, d, f, top(inward), d === midEnd)
      set(inward, d, top(inward) + 1, M.stone.wall)
    }
  }
  for (const [u, f] of [[-hb - 1, L.right], [hb + 1, L.left]]) for (let d = rear; d <= 1; d += 1) set(u, d, top(0), st('trim', f, 'top'))

  // the backdrops: an arched recess in the back wall, the tier's terracotta round a glass slot with
  // calcite behind (it glows), hidden light in the bay
  for (const c of bays) {
    const w = c.hero ? 2 : 1
    const h0 = c.hero ? 3 : 2
    const h1 = c.hero ? 8 : 6
    for (let u = -w; u <= w; u += 1)
      for (let h = h0; h <= h1; h += 1) {
        const uu = c.uc + u
        const head = h === h1 && Math.abs(u) === w
        set(uu, back, h, head ? st('base', u < 0 ? L.left : L.right, 'top') : 'minecraft:air')
        const glass = Math.abs(u) < w
        set(uu, back - 1, h, `minecraft:${c.colour}_${glass ? 'stained_glass' : 'terracotta'}`)
        if (glass) set(uu, back - 2, h, 'minecraft:calcite')
      }
    // a dark frame round the recess
    for (let h = h0 - 1; h <= h1 + 1; h += 1)
      for (const u of [-w - 1, w + 1]) set(c.uc + u, back, h, M.base.block)
    for (let u = -w - 1; u <= w + 1; u += 1) {
      set(c.uc + u, back, h0 - 1, M.base.block)
      set(c.uc + u, back, h1 + 1, M.base.block)
    }
    set(c.uc, back + 1, (c.hero ? heroA : sideA).top, 'minecraft:light[level=15]')
  }

  // the hero's pediment: a gable roof over its block, the gable at the front, a lunette of the
  // hero's glass in it (its colour seen from across the plaza; a plus of glass reads as a cross)
  const [ax, , az] = L.at(-hb, 1, 0)
  const [bx, , bz] = L.at(hb, rear, 0)
  b.roof({ x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz), y: pos[1] + top(0) + 1, type: 'gable', axis: L.deep, material: roof, pitch, overhang: 1, gableOverhang: 0, gable: M.trim.block })
  const oc = top(0) + 2
  for (const [u, h] of [[-1, oc], [0, oc], [1, oc], [0, oc + 1]]) {
    set(u, 1, h, `minecraft:${bays[hi].colour}_stained_glass`)
    set(u, 0, h, 'minecraft:calcite')
  }
  for (const s of [-1, 1]) set(s, 1, oc + 1, st('trim', s < 0 ? L.left : L.right, 'top')) // its round head
  set(0, 1, oc - 1, st('trim', L.back, 'top')) // a sill

  // the court: paving, a dark threshold along the arcade, a mat of the tier's colour in front of
  // each bay, a runner from the court's edge to the hero, lamp posts between the bays
  const pave = kit.palette({ polished_andesite: 5, stone_bricks: 2, andesite: 1 }, { scale: 3, seed: seed + 2 })
  for (let u = U0; u <= U1; u += 1)
    for (let d = 1; d <= court; d += 1) set(u, d, 0, d === 1 ? M.base.block : pave)
  for (const c of bays) {
    const w = (c.span - 1) / 2
    for (let u = -w; u <= w; u += 1)
      for (let d = 2; d <= 5; d += 1) {
        const rim = Math.abs(u) === w || d === 5
        set(c.uc + u, d, 0, rim ? `minecraft:${c.colour}_terracotta` : 'minecraft:smooth_stone')
      }
  }
  for (let d = 6; d <= court; d += 1)
    for (let u = -2; u <= 2; u += 1) set(u, d, 0, Math.abs(u) === 2 ? M.base.block : 'minecraft:smooth_stone')
  for (const p of piers) {
    const u = middle(p)
    set(u, 7, 1, M.base.wall)
    set(u, 7, 2, 'minecraft:dark_oak_fence')
    set(u, 7, 3, 'minecraft:dark_oak_fence')
    set(u, 7, 4, 'minecraft:lantern[hanging=false]')
  }

  // the stages and the crates
  return bays.map(c => crateStage(ctx, L.at(c.uc, -2, 0), facing, { label: c.label, tier: c.tier, colour: c.colour, block: c.block, crateId: c.id, hero: c.hero, backdrop: false, stone: trim, base, top: M.trim.block }))
}

export const CRATES = [
  { id: 'vote', label: 'Vote Crate', tier: 'vote', colour: 'lime' },
  { id: 'common', label: 'Common Crate', tier: 'common', colour: 'light_blue' },
  { id: 'mythic', label: 'Mythic Crate', tier: 'mythic', colour: 'purple', block: 'ender_chest' },
  { id: 'rare', label: 'Rare Crate', tier: 'rare', colour: 'cyan' },
  { id: 'legendary', label: 'Legendary Crate', tier: 'legendary', colour: 'orange' },
].map(c => ({ block: 'chest', ...c }))

export const figure = { size: 56, height: 24, floorY: 3, camera: { eye: [30.5, 8.5, 50.5], lookAt: [28, 8, 22], fov: 64, width: 640, height: 440 } }
export function demo(ctx, which) {
  pavedPatch(ctx)
  const { b, FY } = ctx
  if (which === 'good') cratePavilion(ctx, [28, FY, 24], 'south', CRATES)
  else {
    // the cliche: chests 2 apart on coloured concrete, glowstone between, nothing to frame them
    const colours = ['red', 'lime', 'purple', 'yellow', 'light_blue', 'orange']
    for (let i = 0; i < 6; i += 1) {
      const x = 23 + i * 2
      b.set(x, FY + 1, 32, `minecraft:${colours[i]}_concrete`)
      b.set(x, FY + 2, 32, 'minecraft:chest[facing=south]')
      if (i % 2) b.set(x, FY + 1, 33, 'minecraft:glowstone')
    }
  }
}
