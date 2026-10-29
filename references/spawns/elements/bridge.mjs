// BRIDGES. Read this, look at img/bridge.png, then design the bridge your spawn's river needs: its own
// number of arches and spans, its stone and lamps (a red-brick viaduct, a sandstone causeway in a
// desert, deepslate and soul lanterns for a dark theme, a timber trestle over a creek).
//
// DO
// - Cross where the river runs straight, square to the flow, the road on one grid axis.
// - A stone arch bridge with weight: abutments set into both banks, 2-4 arches of 6-10 span on piers
//   3 thick, the middle arch the widest and highest; each arch springing 1-2 blocks above the water
//   (the piers show), its curve smoothed with upside-down stairs and top slabs, a ring of lighter
//   dressed stone round it, two blocks deep on the big arches.
// - Piers founded on the river bed with pointed cutwaters both ways, higher on the upstream side
//   (they split the current); moss and cracks low down, where the water reaches.
// - A deck 5-7 wide that humps gently to the middle in half-block steps (slabs) and ramps down onto
//   the land at both ends, paved in a clumped mix (cobblestone, stone bricks, andesite).
// - Parapets a block and a half above the deck with a coping of a lighter stone, a string course of
//   upside-down stairs under them (a shadow line along the bridge), lamps on pillars over the piers
//   and newel posts with lanterns where the parapets end.
// - The road carries on past both ends onto the land: a bridge always leads somewhere.
// DON'T
// - A flat strip of planks laid across the water at grass level: no rails, no supports, its ends
//   floating over the banks or stopping short of them.
// - One huge flat slab, a bridge on single fence posts, arches drawn as square holes.
// - Piers that stop above the bed (floating), arches that start under the water.

import { local } from '../../../assets/frame/frame.mjs'
import { course, holdsWater, landscape, meadow, river } from './river.mjs'

// Where a road crosses a river (river() from river.mjs): the column at t on its centreline, the road
// square to the flow (along x where the river runs north-south), the water level there, and the
// side the water comes from (upstream: +1 or -1, in local() u terms for the road's facing).
export function crossing(rv, t = 0.5) {
  const centre = rv.at(t).map(Math.round)
  const [tx, tz] = rv.tangent(t)
  const facing = Math.abs(tz) >= Math.abs(tx) ? 'east' : 'south'
  const [rx, , rz] = local([centre[0], 0, centre[1]], facing).at(1, 0, 0)
  const upstream = tx * (rx - centre[0]) + tz * (rz - centre[1]) > 0 ? -1 : 1
  return { centre, facing, waterY: rv.levelAt(t), upstream }
}

// A stone arch bridge across a crossing. site = crossing(rv, t) or your own { centre: [x, z],
// facing (the road's direction), waterY, upstream }. The arcade is centred on site.centre.
//   spans      the clear span of each arch, in order (the middle one widest)
//   pier       pier thickness; abutment = how far the solid ends reach past the outer arches
//   width      the deck, parapets included (odd: 7 = 5 to walk on)
//   arch       'round' | 'pointed' | 'segmental'; springing = its start above the water
//   hump       how much higher the deck's middle is than its ends (0 for a level deck)
//   road       how far the road runs on past each end, onto the land
//   face, low, paving, landRoad: clumped mixes (the faces, the faces near the water, the deck, the
//              road on the land); ring, coping: material families with stairs and slabs; pillar:
//              the lamp pillars' block; lantern: 'lantern' or 'soul_lantern'
// Returns { length, deckY(d), ends: [[x, y, z], [x, y, z]] } (the road's ends at ground level).
export function archBridge(ctx, site, { spans = [8, 10, 8], pier = 3, abutment = 3, width = 7, arch = 'round', springing = 2, hump = 2.5, road = 24, lamps = true, seed = 1, face = { stone_bricks: 5, andesite: 2, cracked_stone_bricks: 1, mossy_stone_bricks: 1, cobblestone: 1 }, low = { mossy_cobblestone: 3, mossy_stone_bricks: 3, cobblestone: 1, andesite: 1 }, paving = { cobblestone: 4, stone_bricks: 3, andesite: 2, mossy_cobblestone: 1 }, landRoad = { cobblestone: 3, gravel: 3, coarse_dirt: 2, andesite: 1 }, ring = 'polished_andesite', coping = 'polished_andesite', pillar = 'chiseled_stone_bricks', lantern = 'lantern' } = {}) {
  const { b, kit } = ctx
  const L = local([site.centre[0], 0, site.centre[1]], site.facing)
  const set = (u, d, y, blk) => b.set(...L.at(u, d, y), blk)
  const get = (u, d, y) => b.get(...L.at(u, d, y))
  // the top block that holds anything up (the bed under the water, the bank, the ground)
  const solidTop = (u, d) => {
    const [x, , z] = L.at(u, d, 0)
    for (let y = b.size[1] - 1; y > 0; y -= 1) if (holdsWater(b.get(x, y, z))) return y
    return 0
  }
  const W = site.waterY
  const ys = W + springing // the springing line: where the arches start to curve
  const hw = Math.floor(width / 2) // the parapets stand at u = ±hw
  const M = name => kit.material(name)
  const faceP = kit.palette(face, { scale: 3, seed })
  const lowP = kit.palette(low, { scale: 2, seed: seed + 1 })
  const paveP = kit.palette(paving, { scale: 3, seed: seed + 2 })
  const slabOf = name => M(name).slab ?? M(ring).slab
  const stairs = (fam, facing, half) => `${M(fam).stairs}[facing=${facing},half=${half}]`
  const toward = u => (u > 0 ? L.left : L.right) // facing back toward the bridge from side u

  // ---- the arcade along d: abutment, arch, pier, arch, ..., abutment
  const parts = []
  let d = -Math.floor((2 * abutment + spans.reduce((s, v) => s + v, 0) + pier * (spans.length - 1)) / 2)
  parts.push({ kind: 'abutment', a: d, b: d + abutment - 1 })
  d += abutment
  spans.forEach((s, i) => {
    parts.push({ kind: 'arch', a: d, b: d + s - 1, s })
    d += s
    if (i < spans.length - 1) parts.push({ kind: 'pier', a: d, b: d + pier - 1 })
    if (i < spans.length - 1) d += pier
  })
  parts.push({ kind: 'abutment', a: d, b: d + abutment - 1 })
  const [d0, d1] = [parts[0].a, parts.at(-1).b]
  const partAt = dd => parts.find(p => dd >= p.a && dd <= p.b)
  // an arch's opening over column dd: its height above the springing, to half a block
  const open = (p, dd) => {
    const R = p.s / 2
    const x = Math.abs(dd - (p.a + p.b) / 2)
    let h
    if (arch === 'pointed') {
      const Rp = p.s * 0.8
      h = Math.sqrt(Math.max(0, Rp * Rp - (x + Rp - R) ** 2))
    } else if (arch === 'segmental') {
      const r = p.s / 3
      const Rs = (R * R + r * r) / (2 * r)
      h = Math.sqrt(Math.max(0, Rs * Rs - x * x)) - (Rs - r)
    } else h = Math.sqrt(Math.max(0, R * R - x * x))
    return Math.round(h * 2) / 2
  }

  // ---- the deck's walking level T(d) (feet height, half blocks): the lowest smooth hump that clears
  // every arch's ring by a block; flat at the crown, falling at most half a block a step at the ends,
  // then ramps on down until they meet the land
  const need = dd => {
    const p = partAt(dd)
    return p?.kind === 'arch' ? ys + Math.floor(open(p, dd)) + 2 : ys + 2
  }
  const fall = x => (0.5 * x * x) / (x + 8)
  const groundT = dd => Math.max(solidTop(-hw, dd), solidTop(0, dd), solidTop(hw, dd)) + 1
  const crown = dd => {
    let v = -Infinity
    for (let k = d0; k <= d1; k += 1) v = Math.max(v, need(k) - fall(Math.abs(dd - k)))
    for (const k of [d0, d1]) v = Math.max(v, groundT(k))
    return Math.ceil(v * 2) / 2
  }
  const T = new Map()
  for (let dd = d0; dd <= d1; dd += 1) T.set(dd, crown(dd))
  // and a visible hump: the middle at least `hump` above the ends, a parabola between
  const lo = Math.min(T.get(d0), T.get(d1))
  const [dc, Lh] = [(d0 + d1) / 2, (d1 - d0) / 2 + 1]
  for (let dd = d0; dd <= d1; dd += 1) T.set(dd, Math.max(T.get(dd), Math.ceil((lo + hump * (1 - ((dd - dc) / Lh) ** 2)) * 2) / 2))
  let [r0, r1] = [d0, d1] // the ramps' far ends
  while (T.get(r0) - 0.5 > groundT(r0 - 1) && r0 > d0 - 40) T.set(r0 - 1, T.get(r0) - 0.5), (r0 -= 1)
  while (T.get(r1) - 0.5 > groundT(r1 + 1) && r1 < d1 + 40) T.set(r1 + 1, T.get(r1) - 0.5), (r1 += 1)

  // ---- the masonry, column by column across the road
  for (let dd = r0; dd <= r1; dd += 1) {
    const p = partAt(dd)
    const t = T.get(dd)
    const walk = Math.ceil(t) - 1 // the block the deck's surface is (a slab when t ends in .5)
    const top = t + 1.5 // the parapet's coping surface
    for (let u = -hw; u <= hw; u += 1) {
      const edge = Math.abs(u) === hw
      // where the masonry starts: the arch's soffit, or a block into the bed or the bank
      let bottom = p?.kind === 'arch' ? ys + Math.floor(open(p, dd)) : solidTop(u, dd) - (p ? 1 : 0)
      if (!p) bottom = Math.min(bottom + 1, walk) // a ramp sits on the ground
      const hi = edge ? Math.ceil(top) - 1 : walk
      for (let y = bottom; y <= hi; y += 1) {
        let blk = y <= W + 2 ? lowP : faceP
        if (p?.kind === 'arch' && y === bottom) {
          // the soffit: a curve of upside-down stairs and top slabs where the arch steps
          const h = open(p, dd)
          const out = dd < (p.a + p.b) / 2 ? -1 : 1
          const nb = partAt(dd + out)?.kind === 'arch' ? open(p, dd + out) : 0
          blk = h % 1 ? (h - nb >= 1 ? stairs(ring, out < 0 ? L.back : L.out, 'top') : `${M(ring).slab}[type=top]`) : M(ring).block
        } else if (p?.kind === 'arch' && edge && y <= bottom + (p.s >= 9 ? 1 : 0)) blk = M(ring).block // the ring on the faces
        else if (edge && p?.kind === 'arch' && [-1, 1].some(k => partAt(dd + k)?.kind === 'arch' && y < ys + Math.floor(open(partAt(dd + k), dd + k)) + 1 && y >= ys)) blk = M(ring).block
        if (!edge && y === walk) blk = t % 1 ? null : paveP // the paving (slabs placed below)
        if (edge && y === hi) blk = top % 1 ? null : M(coping).block
        if (blk) set(u, dd, y, blk)
      }
      if (!edge && t % 1) set(u, dd, walk, (x, y, z) => `${slabOf(paveP(x, y, z))}[type=bottom]`)
      if (edge && top % 1) set(u, dd, Math.floor(top), `${M(coping).slab}[type=bottom]`)
      // clear what grew where people walk
      for (let y = (edge ? Math.ceil(top) : Math.ceil(t)); y <= Math.ceil(top) + 3; y += 1) if (get(u, dd, y) && !holdsWater(get(u, dd, y))) set(u, dd, y, 'minecraft:air')
    }
    // the string course: upside-down stairs under the parapets, a shadow line along the bridge
    for (const u of [-hw - 1, hw + 1]) {
      const y = Math.ceil(t) - 2
      if (y > solidTop(u, dd) + 1 && !get(u, dd, y)) set(u, dd, y, stairs(ring, toward(u), 'top'))
    }
  }

  // ---- cutwaters: every pier pointed both ways, higher upstream where they split the current
  for (const p of parts.filter(q => q.kind === 'pier')) {
    const mid = Math.floor((p.a + p.b) / 2)
    for (const side of [site.upstream, -site.upstream]) {
      const cap = side === site.upstream ? ys + 4 : ys + 3
      for (const [e, a, z, h] of [[1, p.a, p.b, cap], [2, mid, mid, cap - 1]])
        for (let dd = a; dd <= z; dd += 1) {
          const u = side * (hw + e)
          for (let y = solidTop(u, dd) - 1; y < h; y += 1) set(u, dd, y, y <= W + 2 ? lowP : faceP)
          set(u, dd, h, stairs(ring, toward(u), 'bottom'))
        }
    }
  }

  // ---- lamps: on pillars over the piers, and newel posts where the parapets end
  const post = (u, dd, tall) => {
    const top = T.get(dd) + 1.5
    const y0 = top % 1 ? Math.floor(top) : top
    set(u, dd, y0, `minecraft:${pillar}`)
    if (tall) set(u, dd, y0 + 1, M(ring).block)
    set(u, dd, y0 + 1 + (tall ? 1 : 0), M(ring).wall ?? M(coping).wall ?? 'minecraft:stone_brick_wall')
    set(u, dd, y0 + 2 + (tall ? 1 : 0), `minecraft:${lantern}[hanging=false]`)
  }
  if (lamps) {
    for (const p of parts.filter(q => q.kind === 'pier')) for (const u of [-hw, hw]) post(u, Math.floor((p.a + p.b) / 2), false)
    for (const dd of [r0, r1]) for (const u of [-hw, hw]) post(u, dd, true)
  }

  // ---- wing walls: the parapets splay out 45 degrees at both ends, low, into the bank
  for (const [dd0, step] of [[r0, -1], [r1, 1]])
    for (const side of [-1, 1])
      for (let k = 1; k <= 2; k += 1) {
        const [u, dd] = [side * (hw + k), dd0 + step * k]
        const g = solidTop(u, dd)
        set(u, dd, g + 1, faceP)
        set(u, dd, g + 2, k === 2 ? `${M(coping).slab}[type=bottom]` : M(coping).block)
        if (k === 1) set(u, dd, g + 3, `${M(coping).slab}[type=bottom]`)
      }

  // ---- the road goes on past both ends, on the land, its edges frayed: a looser mix than the deck
  const roadP = kit.palette(landRoad, { scale: 3, seed: seed + 3 })
  const ends = []
  for (const [dd0, step] of [[r0 - 1, -1], [r1 + 1, 1]]) {
    for (let k = 0; k < road; k += 1) {
      const dd = dd0 + step * k
      for (let u = -hw; u <= hw; u += 1) {
        const [x, , z] = L.at(u, dd, 0)
        if (x < 0 || z < 0 || x >= b.size[0] || z >= b.size[2]) continue
        if (Math.abs(u) >= hw - 1 && kit.hash01(x, k, z, seed) < (Math.abs(u) === hw ? 0.7 : 0.25)) continue
        const y = solidTop(u, dd)
        if (b.nameAt(x, y + 1, z) === 'minecraft:water') continue // not across another water
        set(u, dd, y, k < 3 ? paveP : roadP)
        for (let yy = y + 1; yy <= y + 2; yy += 1) if (get(u, dd, yy) && !holdsWater(get(u, dd, yy))) set(u, dd, yy, 'minecraft:air')
      }
    }
    ends.push(L.at(0, dd0, solidTop(0, dd0)))
  }
  return { length: r1 - r0 + 1, deckY: dd => T.get(dd), ends }
}

// DON'T: a strip of planks at grass level, laid across the water, no rails, its ends in the air
export function plankStrip(ctx, site, { from = -8, to = 8, y } = {}) {
  const L = local([site.centre[0], 0, site.centre[1]], site.facing)
  for (let d = from; d <= to; d += 1) for (let u = -1; u <= 1; u += 1) ctx.b.set(...L.at(u, d, y), 'minecraft:oak_planks')
}

// ---- the picture: a river through a meadow, broad where the bridge carries a road across it
const COURSE = [[80, 15], [70, 16], [59, 21], [51, 30], [48, 42], [47, 54], [42, 66], [45, 77], [53, 85]]
const CROSS = [48, 42]
export const figure = { size: 96, height: 44, floorY: 16, seed: 5, camera: { eye: [64, 25, 73], lookAt: [46, 18, 42], fov: 64, width: 640, height: 420 } }
export function demo(ctx, which) {
  const { b, kit, FY } = ctx
  const c = course(ctx, COURSE)
  const tc = c.nearest(...CROSS).t
  // a valley: the land rises 4 from the river's banks over 20 blocks, a little roll further out
  landscape(ctx, (x, z) => {
    const away = Math.max(0, c.nearest(x, z).d - 12)
    return FY + 4 * Math.min(1, away / 20) + 1.2 * kit.noise.fbm2(x, z, { scale: 24, seed: 5 }) * Math.min(1, away / 10)
  }, { seed: 3 })
  // 16 wide, opening to a broad reach of 26 where the bridge crosses
  const width = t => 15 + 3 * kit.noise.coherent01(t * c.length, 0, 0, { scale: 20, grain: 0, seed: 6 }) + 9 * Math.exp(-((((t - tc) * c.length) / 20) ** 2))
  const rv = river(ctx, COURSE, { width, depth: 3, bank: 5, level: FY - 3, pools: [{ at: 0, r: 7, depth: 3 }], spring: true, seed: 6 })
  const site = crossing(rv, tc)
  for (const [x, z, sp, s] of [[16, 30, 'willow', 3], [76, 56, 'oak', 5], [80, 30, 'birch', 2], [10, 66, 'oak', 8], [30, 20, 'birch', 7]]) {
    let y = b.topY(x, z)
    while (y > 0 && !holdsWater(b.get(x, y, z))) b.remove(x, y--, z)
    if (/grass_block|dirt|podzol/.test(b.nameAt(x, y, z) ?? '')) b.tree([x, y + 1, z], sp, { seed: s })
  }
  meadow(ctx, { seed: 9, skip: (x, z) => rv.nearest(x, z).d < 15 || Math.abs(z - site.centre[1]) < 5 })
  if (which === 'good') archBridge(ctx, site, { spans: [8, 10, 8], road: 40, seed: 2 })
  else plankStrip(ctx, site, { from: -10, to: 10, y: FY })
}
