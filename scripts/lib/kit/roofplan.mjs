// Compound roofs from a height field: one roof over any rectilinear footprint (L, T, U, H,
// courtyard, irregular cell sets) with correct hips, valleys, ridges and cross-gables.
//
//   b.compoundRoof({
//     rects: [[x0, z0, x1, z1], ...],   // wall-line rectangles (inclusive), may overlap
//     // or cells: Set|Array of [x, z] (or "x,z") wall-line footprint cells
//     y,                                // level of the roof row directly above the wall line (wall top + 1)
//     type: 'hip' | 'gable' | 'mixed',  // mixed: rects with a gableAxes entry are gables, the others hips
//                                       //        (no gableAxes at all: rect 0 hip, the rest gables)
//     gableAxes: ['x', 'z', ...],       // per-rect ridge direction (default: the rect's longer side)
//     material: 'spruce',               // family with stairs + slab, or { stairs, slab, block }
//     pitch: 1,                         // rise per ring: 0.5 slab steps, 1 stairs, 2/3 steep, or a list from the eave in
//     overhang: 1, gableOverhang: overhang,
//     gable: paint,                     // fills wall-line cells up to the roof surface (gable triangles)
//     eaveTrim: true, underside: 'stairs' | 'block', ridgeCap: paint, thickness: 1,
//   })  // → { topY, base, heights: Map "x,z" → y of the top roof block,
//          cells: Map "x,z" → { y, top (surface height, may be x.5), ring, kind: stairs|slab|topslab|block|ridge, facing } }
//
// How it works. Every roof cell gets a ring number (1 = outermost eave ring):
//   hip   — Chebyshev distance to the outside of the overhang-dilated footprint. For rectilinear
//           footprints this equals the straight-skeleton (constant-pitch) hip roof, so hips,
//           valleys at reflex corners and courtyard eaves come out exactly.
//   gable — per rectangle, distance across the rect to its nearer eave; the union of the wings
//           is the max, which produces valleys and cross-gables where wings meet. Gable ends do
//           not "drop" (the rect's surface continues one cell past its rake), so rakes stay straight.
// Ring numbers map to surface levels with the same pitch profile as b.roof() (rowLevels), and the
// base is chosen so the ring above the wall line sits at `y`. Each cell then becomes: a bottom slab
// on half levels; a stair facing uphill where the surface drops by >= 1 (4-neighbour gradient, or
// the diagonal gradient where a valley meets the ridge); a full block on ridges and where it drops
// by 0.5 inside the walls (top slab on the overhang). Columns are closed down to the lowest
// face-neighbour (rise >= 2 extends to the previous row's level) so no surface touches only along
// an edge. Stair shapes (hip/valley corners) are left to finish().

import { parseBlock } from './blocks.mjs'
import { material } from './materials.mjs'

function roofMaterial(spec) {
  if (!spec) spec = 'spruce'
  if (typeof spec === 'string') {
    const m = material(spec)
    if (!m.stairs || !m.slab) throw new Error(`Roof material "${spec}" needs stairs and slab variants (got ${JSON.stringify(m)})`)
    return { stairs: m.stairs, slab: m.slab, block: m.block ?? m.planks }
  }
  if (!spec.stairs || !spec.slab || !spec.block) throw new Error('roof material object needs { stairs, slab, block }')
  return spec
}

// Same pitch semantics as arch.mjs roof(): rises per row of 0.5, 1, 2 or 3; the eave row's top is
// 0.5 for a slab start and 1 otherwise.
function riseList(pitch, rows) {
  const named = { shallow: 0.5, low: 0.5, normal: 1, medium: 1, steep: 2, 'very-steep': 3 }
  const at = i => {
    let r
    if (typeof pitch === 'function') r = pitch(i, rows)
    else if (Array.isArray(pitch)) r = pitch[Math.min(i, pitch.length - 1)]
    else if (typeof pitch === 'string') r = named[pitch]
    else r = pitch
    if (r === undefined || !Number.isFinite(r)) r = 1
    return Math.max(0.5, Math.round(r * 2) / 2)
  }
  return Array.from({ length: rows }, (_, i) => at(i))
}

function rowLevels(pitch, rows) {
  const rises = riseList(pitch, rows)
  const levels = []
  let t = rises[0] <= 0.5 ? 0.5 : 1
  levels.push(t)
  for (let i = 1; i < rows; i += 1) {
    t += rises[i]
    levels.push(t)
  }
  return levels
}

// Level of the block that carries a surface at `top` (a slab for x.5, otherwise the block below).
const topBlock = top => (top % 1 !== 0 ? Math.floor(top) : top - 1)

const K = (x, z) => `${x},${z}`

function parseCells(cells) {
  const set = new Set()
  for (const c of cells) {
    if (typeof c === 'string') set.add(c)
    else set.add(K(c[0], c[1]))
  }
  return set
}

function normRect(r) {
  const [a, b, c, d] = Array.isArray(r) ? r : [r.x0, r.z0, r.x1, r.z1]
  return { x0: Math.min(a, c), z0: Math.min(b, d), x1: Math.max(a, c), z1: Math.max(b, d) }
}

// Greedy cover of a cell set by maximal rectangles (wings) — used when a gable roof is asked for
// a cell footprint. Tries x-first and z-first growth from every uncovered cell, keeps the larger.
function coverRects(set) {
  const has = (x, z) => set.has(K(x, z))
  const cells = [...set].map(s => s.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const covered = new Set()
  const rects = []
  const grow = (x, z, order) => {
    const r = { x0: x, x1: x, z0: z, z1: z }
    const colOk = xx => { for (let zz = r.z0; zz <= r.z1; zz += 1) if (!has(xx, zz)) return false; return true }
    const rowOk = zz => { for (let xx = r.x0; xx <= r.x1; xx += 1) if (!has(xx, zz)) return false; return true }
    const growX = () => { while (colOk(r.x1 + 1)) r.x1 += 1; while (colOk(r.x0 - 1)) r.x0 -= 1 }
    const growZ = () => { while (rowOk(r.z1 + 1)) r.z1 += 1; while (rowOk(r.z0 - 1)) r.z0 -= 1 }
    if (order === 'xz') { growX(); growZ() } else { growZ(); growX() }
    return r
  }
  const area = r => (r.x1 - r.x0 + 1) * (r.z1 - r.z0 + 1)
  for (const [x, z] of cells) {
    if (covered.has(K(x, z))) continue
    const a = grow(x, z, 'xz')
    const c = grow(x, z, 'zx')
    const r = area(a) >= area(c) ? a : c
    rects.push(r)
    for (let xx = r.x0; xx <= r.x1; xx += 1) for (let zz = r.z0; zz <= r.z1; zz += 1) covered.add(K(xx, zz))
  }
  return rects
}

// Chebyshev (L∞) distance to the outside of `area` — two-pass chamfer with unit 8-neighbour weights.
function chebyshev(area, minX, minZ, W, H) {
  const d = new Int32Array(W * H)
  for (let z = 0; z < H; z += 1) for (let x = 0; x < W; x += 1) d[z * W + x] = area.has(K(x + minX, z + minZ)) ? 1 << 29 : 0
  const at = (x, z) => (x < 0 || z < 0 || x >= W || z >= H ? 0 : d[z * W + x])
  for (let z = 0; z < H; z += 1) for (let x = 0; x < W; x += 1) {
    const i = z * W + x
    if (d[i]) d[i] = Math.min(d[i], at(x - 1, z) + 1, at(x, z - 1) + 1, at(x - 1, z - 1) + 1, at(x + 1, z - 1) + 1)
  }
  for (let z = H - 1; z >= 0; z -= 1) for (let x = W - 1; x >= 0; x -= 1) {
    const i = z * W + x
    if (d[i]) d[i] = Math.min(d[i], at(x + 1, z) + 1, at(x, z + 1) + 1, at(x + 1, z + 1) + 1, at(x - 1, z + 1) + 1)
  }
  return (x, z) => at(x - minX, z - minZ)
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const facingOf = (gx, gz) => (Math.abs(gx) >= Math.abs(gz) ? (gx > 0 ? 'east' : 'west') : (gz > 0 ? 'south' : 'north'))

export function compoundRoof(b, opts = {}) {
  const {
    y,
    type = 'hip',
    overhang = 1,
    pitch = 1,
    gable,
    ridgeCap,
    eaveTrim = true,
    thickness = 1,
    underside = 'stairs',
    overwrite = true,
  } = opts
  const gableOverhang = opts.gableOverhang ?? overhang
  if (!Number.isFinite(y)) throw new Error('compoundRoof: y (level of the roof row above the wall line) is required')
  if (!['hip', 'gable', 'mixed'].includes(type)) throw new Error(`compoundRoof: unknown type "${type}" (hip | gable | mixed)`)
  const mat = roofMaterial(opts.material)

  // ---------------------------------------------------------------- footprint (wall lines)
  let rects = opts.rects ? opts.rects.map(normRect) : null
  const foot = new Set()
  if (rects) {
    for (const r of rects) for (let x = r.x0; x <= r.x1; x += 1) for (let z = r.z0; z <= r.z1; z += 1) foot.add(K(x, z))
  } else if (opts.cells) {
    for (const k of parseCells(opts.cells)) foot.add(k)
  } else {
    throw new Error('compoundRoof: pass rects: [[x0, z0, x1, z1], ...] or cells: [[x, z], ...]')
  }
  if (foot.size === 0) return { topY: y, base: y, heights: new Map(), cells: new Map() }
  const inFoot = (x, z) => foot.has(K(x, z))

  // ---------------------------------------------------------------- ring field
  let area
  let ringAt
  if (type === 'hip') {
    area = new Set()
    for (const k of foot) {
      const [x, z] = k.split(',').map(Number)
      for (let dx = -overhang; dx <= overhang; dx += 1) for (let dz = -overhang; dz <= overhang; dz += 1) area.add(K(x + dx, z + dz))
    }
    let minX = Infinity; let minZ = Infinity; let maxX = -Infinity; let maxZ = -Infinity
    for (const k of area) {
      const [x, z] = k.split(',').map(Number)
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
    }
    ringAt = chebyshev(area, minX - 1, minZ - 1, maxX - minX + 3, maxZ - minZ + 3)
  } else {
    if (!rects) rects = coverRects(foot)
    const axes = opts.gableAxes
    const wings = rects.map((r, i) => {
      let kind = 'gable'
      if (type === 'mixed') kind = axes ? (axes[i] === 'x' || axes[i] === 'z' ? 'gable' : 'hip') : (i === 0 ? 'hip' : 'gable')
      const axis = (axes && (axes[i] === 'x' || axes[i] === 'z')) ? axes[i] : ((r.x1 - r.x0) >= (r.z1 - r.z0) ? 'x' : 'z')
      if (kind === 'hip') return { kind, axis, x0: r.x0 - overhang, x1: r.x1 + overhang, z0: r.z0 - overhang, z1: r.z1 + overhang }
      return axis === 'x'
        ? { kind, axis, x0: r.x0 - gableOverhang, x1: r.x1 + gableOverhang, z0: r.z0 - overhang, z1: r.z1 + overhang }
        : { kind, axis, x0: r.x0 - overhang, x1: r.x1 + overhang, z0: r.z0 - gableOverhang, z1: r.z1 + gableOverhang }
    })
    const inW = (w, x, z) => x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1
    const ringOf = (w, x, z) => {
      if (w.kind === 'hip') return Math.min(x - w.x0, w.x1 - x, z - w.z0, w.z1 - z) + 1
      return w.axis === 'x' ? Math.min(z - w.z0, w.z1 - z) + 1 : Math.min(x - w.x0, w.x1 - x) + 1
    }
    const ringOr0 = (w, x, z) => (inW(w, x, z) ? ringOf(w, x, z) : 0)
    // Earlier rects win. A later wing that enters an earlier one from one side (an L/T/U arm)
    // only continues into it up to that wing's crest, so the arm's ridge ends on the main ridge
    // instead of running through and popping out of the far slope. Arms that cross right through
    // (a + plan) or lie fully inside keep their whole surface.
    const entries = rects.map((ri, i) => rects.map((rj, j) => {
      if (j >= i) return []
      const d = []
      if (ri.z1 > rj.z1) d.push([0, 1])
      if (ri.z0 < rj.z0) d.push([0, -1])
      if (ri.x1 > rj.x1) d.push([1, 0])
      if (ri.x0 < rj.x0) d.push([-1, 0])
      const crossing = (ri.z1 > rj.z1 && ri.z0 < rj.z0) || (ri.x1 > rj.x1 && ri.x0 < rj.x0)
      return crossing ? [] : d
    }))
    const valid = (i, x, z) => {
      for (let j = 0; j < i; j += 1) {
        const wj = wings[j]
        if (!entries[i][j].length || !inW(wj, x, z)) continue
        const here = ringOf(wj, x, z)
        for (const [dx, dz] of entries[i][j]) if (ringOr0(wj, x + dx, z + dz) > here) return false
      }
      return true
    }
    area = new Set()
    for (const w of wings) for (let x = w.x0; x <= w.x1; x += 1) for (let z = w.z0; z <= w.z1; z += 1) area.add(K(x, z))
    ringAt = (x, z) => {
      let best = 0
      if (area.has(K(x, z))) {
        wings.forEach((w, i) => { if (inW(w, x, z) && valid(i, x, z)) best = Math.max(best, ringOf(w, x, z)) })
        return best
      }
      // Just past a gable end: continue the wing's surface so rake cells see no drop.
      for (const w of wings) {
        if (w.kind !== 'gable') continue
        if (w.axis === 'x' && z >= w.z0 && z <= w.z1 && (x === w.x0 - 1 || x === w.x1 + 1)) best = Math.max(best, ringOf(w, Math.min(w.x1, Math.max(w.x0, x)), z))
        if (w.axis === 'z' && x >= w.x0 && x <= w.x1 && (z === w.z0 - 1 || z === w.z1 + 1)) best = Math.max(best, ringOf(w, x, Math.min(w.z1, Math.max(w.z0, z))))
      }
      return best
    }
  }

  // ---------------------------------------------------------------- levels and base
  let maxRing = 1
  for (const k of area) {
    const [x, z] = k.split(',').map(Number)
    maxRing = Math.max(maxRing, ringAt(x, z))
  }
  const levels = rowLevels(pitch, maxRing + 1)
  const top = (x, z) => {
    const r = ringAt(x, z)
    return r > 0 ? levels[r - 1] : 0
  }
  const base = y - topBlock(levels[Math.min(overhang, levels.length - 1)])

  // ---------------------------------------------------------------- cells
  const cells = new Map()
  const heights = new Map()
  let topY = -Infinity
  const setOpts = overwrite ? undefined : { keep: true }
  for (const k of area) {
    const [x, z] = k.split(',').map(Number)
    const ring = ringAt(x, z)
    const t = top(x, z)
    let min8 = Infinity; let min4 = Infinity
    let g4x = 0; let g4z = 0; let g8x = 0; let g8z = 0
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dz) continue
        const tn = top(x + dx, z + dz)
        const dt = tn - t
        min8 = Math.min(min8, tn)
        g8x += dx * dt
        g8z += dz * dt
        if (!dx || !dz) { min4 = Math.min(min4, tn); g4x += dx * dt; g4z += dz * dt }
      }
    }
    const drop8 = t - min8
    const drop4 = t - min4
    const inside = inFoot(x, z)
    const half = t % 1 !== 0
    const tb = topBlock(t)
    let kind
    let state
    let facing = null
    if (half) {
      kind = 'slab'
      state = `${mat.slab}[type=bottom]`
    } else if (drop8 >= 1 && (g4x || g4z)) {
      kind = 'stairs'; facing = facingOf(g4x, g4z)
    } else if (drop8 >= 1 && drop4 < 1 && (g8x || g8z)) {
      kind = 'stairs'; facing = facingOf(g8x, g8z) // valley cell meeting the ridge: only a diagonal drop
    } else if (drop8 >= 1) {
      kind = 'ridge'
      state = mat.block
    } else if (drop8 > 0) {
      kind = inside ? 'block' : 'topslab'
      state = inside ? mat.block : `${mat.slab}[type=top]`
    } else {
      kind = 'block'
      state = mat.block
    }
    if (kind === 'stairs') state = `${mat.stairs}[facing=${facing},half=bottom]`
    b.set(x, base + tb, z, state, setOpts)

    // Close the column down to the lowest face-neighbour (no edge-only contact on steep steps).
    let fillFrom = tb
    if (min4 < t) fillFrom = t - min4 >= 2 ? Math.ceil(min4) - 1 : Math.floor(min4)
    for (let yy = tb - 1; yy >= fillFrom; yy -= 1) b.set(x, base + yy, z, mat.block, setOpts)
    if (inside) {
      for (let kk = 1; kk <= thickness; kk += 1) {
        const stairUnder = underside === 'stairs' && kk === 1 && kind === 'stairs' && fillFrom === tb
        b.set(x, base + Math.min(tb, fillFrom) - kk, z, stairUnder ? `${mat.stairs}[facing=${facing},half=top]` : mat.block, { keep: true })
      }
    }
    if (eaveTrim && ring === 1) {
      if (kind === 'slab') b.set(x, base + tb - 1, z, `${mat.slab}[type=top]`, { keep: true })
      else if (kind === 'stairs') b.set(x, base + tb - 1, z, `${mat.stairs}[facing=${facing},half=top]`, { keep: true })
    }
    if (kind === 'ridge' && ridgeCap) b.set(x, base + tb + 1, z, ridgeCap)
    cells.set(k, { y: base + tb, top: base + t, ring, kind, facing })
    heights.set(k, base + tb)
    topY = Math.max(topY, base + tb)
  }

  // Gable triangles / any wall-line cell under the roof surface.
  if (gable) {
    const stairsName = parseBlock(mat.stairs).name
    const blockName = parseBlock(mat.block).name
    for (const k of foot) {
      const [x, z] = k.split(',').map(Number)
      if (N4.every(([dx, dz]) => inFoot(x + dx, z + dz))) continue
      const cell = cells.get(k)
      if (!cell) continue
      // Underside stairs (notches) and steep-row column fill below the rake become gable wall too.
      const notch = blk => !blk || blk.name === blockName || (blk.name === stairsName && blk.props?.half === 'top')
      for (let yy = y; yy < cell.y; yy += 1) if (notch(b.get(x, yy, z))) b.set(x, yy, z, gable)
    }
  }
  if (!Number.isFinite(topY)) topY = y
  return { topY, base, heights, cells }
}

export const ROOFPLAN_METHODS = { compoundRoof }
