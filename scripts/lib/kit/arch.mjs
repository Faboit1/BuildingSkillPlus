// Architectural components. Every function takes the Builder as its first argument and is
// also installed as a Builder method (b.roof(...), b.window(...), ...).
//
// Conventions
//   facing  — for wall features: the OUTWARD direction of the wall ('north'|'east'|'south'|'west').
//   right   — when standing outside looking at the wall, right = ccw(facing).
//   Stairs  — facing is the side of the tall back; you walk up moving toward `facing`.
//   Roof `y` — block level of the roof row directly above the wall line (normally wallTop + 1).

import { DIR, ccw, cw, facingFrom, opposite, parseBlock } from './blocks.mjs'
import { material } from './materials.mjs'
import { hash01 } from './noise.mjs'

const add = (p, d, k = 1) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k]
const UP = [0, 1, 0]

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

// Allowed rises per row: 0.5 (slab step), 1 (stair step), 2 or 3 (steep: stair + full blocks).
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

// Top-surface levels (in blocks, multiples of 0.5) for rows 0..rows-1, eave row first.
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

// Places one roof cell: element whose top surface is at `top` (relative to base), closing
// the column down to the previous row so the surface never has diagonal-only contact, plus
// `thickness` blocks below. Inside the walls a half-step "top slab" becomes a full block so
// no half-block void shows under it. Returns { tb, kind } (top block level, element kind).
function roofCell(b, x, z, base, top, prevTop, facing, mat, { thickness = 0, ridge = false, overwrite = true, inside = false } = {}) {
  const opts = overwrite ? undefined : { keep: true }
  const half = top % 1 !== 0
  const rise = prevTop === null ? null : top - prevTop
  let tb
  let kind
  if (half) {
    tb = Math.floor(top)
    kind = 'slab'
    b.set(x, base + tb, z, `${mat.slab}[type=bottom]`, opts)
  } else {
    tb = top - 1
    if (ridge) {
      kind = 'block'
      b.set(x, base + tb, z, mat.block, opts)
    } else if (rise !== null && rise < 1) {
      kind = inside ? 'block' : 'topslab'
      b.set(x, base + tb, z, inside ? mat.block : `${mat.slab}[type=top]`, opts)
    } else {
      kind = 'stairs'
      b.set(x, base + tb, z, `${mat.stairs}[facing=${facing},half=bottom]`, opts)
    }
  }
  let fillFrom = tb
  if (prevTop !== null) fillFrom = rise >= 2 ? Math.ceil(prevTop) - 1 : Math.floor(prevTop)
  for (let y = tb - 1; y >= fillFrom; y -= 1) b.set(x, base + y, z, mat.block, opts)
  for (let k = 1; k <= thickness; k += 1) b.set(x, base + Math.min(tb, fillFrom) - k, z, mat.block, { keep: true })
  return { tb, kind }
}

// Decorative under-layer for the outermost row: upside-down stairs under stairs, top slabs
// under slabs. Makes eaves read as thick, finished edges instead of paper-thin ones.
function eaveTrimCell(b, x, z, base, cell, facing, mat) {
  if (!cell) return
  const y = base + cell.tb - 1
  if (cell.kind === 'slab') b.set(x, base + cell.tb - 1, z, `${mat.slab}[type=top]`, { keep: true })
  else if (cell.kind === 'stairs') b.set(x, y, z, `${mat.stairs}[facing=${facing},half=top]`, { keep: true })
}

// Fills wall-line cells from the wall top (y) up to just under the roof surface: gable
// triangles, shed high walls. cells: Map "x,z" → { tb }.
function fillUnderRoof(b, cells, base, y, footprint, paint) {
  const { minX, maxX, minZ, maxZ } = footprint
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      if (x !== minX && x !== maxX && z !== minZ && z !== maxZ) continue
      const cell = cells.get(`${x},${z}`)
      if (!cell) continue
      for (let yy = y; yy < base + cell.tb; yy += 1) b.set(x, yy, z, paint, { keep: true })
    }
  }
}

// Rectangular roofs.
//   b.roof({ x0, z0, x1, z1, y, type: 'gable'|'hip'|'pyramid'|'mansard'|'shed', axis: 'x'|'z',
//            material: 'spruce', pitch: 1 | 0.5 | 2 | 'steep' | [0.5, 0.5, 1, 1, 2] | (row, rows) => rise,
//            overhang: 1, gableOverhang: 1, gable: paint, ridgeCap: paint, eaveTrim: true,
//            thickness: 1, rises: 'north' (shed only) })
// x0..x1 / z0..z1 are the outer wall lines; y is the level of the roof row directly above the
// wall line (wall top + 1). `gable` fills every wall-line cell up to the roof (gable
// triangles, the tall side of a shed). Returns { topY, axis, base, cells }.
export function roof(b, opts) {
  const {
    x0, z0, x1, z1, y,
    type = 'gable',
    overhang = 1,
    gableOverhang = 1,
    pitch = 1,
    gable,
    ridgeCap,
    eaveTrim = false,
    thickness = 1,
    overwrite = true,
  } = opts
  const mat = roofMaterial(opts.material)
  const lenX = Math.abs(x1 - x0) + 1
  const lenZ = Math.abs(z1 - z0) + 1
  const axis = opts.axis ?? (lenX >= lenZ ? 'x' : 'z')
  const minX = Math.min(x0, x1)
  const maxX = Math.max(x0, x1)
  const minZ = Math.min(z0, z1)
  const maxZ = Math.max(z0, z1)
  const footprint = { minX, maxX, minZ, maxZ }
  const inFootprint = (x, z) => x >= minX && x <= maxX && z >= minZ && z <= maxZ
  const cells = new Map()
  let topY = -Infinity
  let base

  const place = (x, z, top, prevTop, facing, extra = {}) => {
    const inside = inFootprint(x, z)
    const cell = roofCell(b, x, z, base, top, prevTop, facing, mat, { thickness: inside ? thickness : 0, overwrite, inside, ...extra })
    cells.set(`${x},${z}`, cell)
    topY = Math.max(topY, base + cell.tb)
    if (extra.ridge && ridgeCap) b.set(x, base + cell.tb + 1, z, ridgeCap)
    return cell
  }

  if (type === 'hip' || type === 'pyramid' || type === 'mansard') {
    const ax0 = minX - overhang
    const ax1 = maxX + overhang
    const az0 = minZ - overhang
    const az1 = maxZ + overhang
    const rings = Math.ceil(Math.min(ax1 - ax0 + 1, az1 - az0 + 1) / 2)
    const levels = rowLevels(type === 'mansard' && opts.pitch === undefined ? [2, 2, 3, 0.5] : pitch, rings + 1)
    base = y - (levels[Math.min(overhang, levels.length - 1)]) + 1
    for (let k = 0; k < rings; k += 1) {
      const rx0 = ax0 + k
      const rx1 = ax1 - k
      const rz0 = az0 + k
      const rz1 = az1 - k
      if (rx0 > rx1 || rz0 > rz1) break
      const longX = rx1 - rx0 >= rz1 - rz0
      const isRidge = rx0 === rx1 || rz0 === rz1
      for (let x = rx0; x <= rx1; x += 1) {
        for (let z = rz0; z <= rz1; z += 1) {
          if (x !== rx0 && x !== rx1 && z !== rz0 && z !== rz1) continue
          const corner = (x === rx0 || x === rx1) && (z === rz0 || z === rz1)
          let facing
          if (corner) facing = longX ? (x === rx0 ? 'east' : 'west') : (z === rz0 ? 'south' : 'north')
          else if (z === rz0) facing = 'south'
          else if (z === rz1) facing = 'north'
          else if (x === rx0) facing = 'east'
          else facing = 'west'
          const cell = place(x, z, levels[k], k === 0 ? null : levels[k - 1], facing, { ridge: isRidge })
          if (eaveTrim && k === 0) eaveTrimCell(b, x, z, base, cell, facing, mat)
        }
      }
    }
    if (gable) fillUnderRoof(b, cells, base, y, footprint, gable)
    return { topY, axis, base, cells }
  }

  // Gable and shed: rows run parallel to the ridge axis.
  const along = axis === 'x' ? [minX - gableOverhang, maxX + gableOverhang] : [minZ - gableOverhang, maxZ + gableOverhang]
  const across = axis === 'x' ? [minZ - overhang, maxZ + overhang] : [minX - overhang, maxX + overhang]
  const width = across[1] - across[0] + 1
  const lowSide = axis === 'x' ? 'north' : 'west'
  const highSide = axis === 'x' ? 'south' : 'east'
  const cell = (u, v) => (axis === 'x' ? [u, v] : [v, u])

  if (type === 'shed') {
    const risesToward = opts.rises ?? highSide
    const forward = risesToward === highSide
    const levels = rowLevels(pitch, width)
    base = y - levels[Math.min(overhang, width - 1)] + 1
    for (let i = 0; i < width; i += 1) {
      const v = forward ? across[0] + i : across[1] - i
      for (let u = along[0]; u <= along[1]; u += 1) {
        const [x, z] = cell(u, v)
        const c = place(x, z, levels[i], i === 0 ? null : levels[i - 1], risesToward)
        if (eaveTrim && i === 0) eaveTrimCell(b, x, z, base, c, risesToward, mat)
      }
    }
    if (gable) fillUnderRoof(b, cells, base, y, footprint, gable)
    return { topY, axis, base, cells }
  }

  const rows = Math.ceil(width / 2)
  const levels = rowLevels(pitch, rows)
  base = y - levels[Math.min(overhang, rows - 1)] + 1
  const facingLow = axis === 'x' ? 'south' : 'east'
  const facingHigh = axis === 'x' ? 'north' : 'west'
  void lowSide
  for (let i = 0; i < rows; i += 1) {
    const vLow = across[0] + i
    const vHigh = across[1] - i
    const isRidge = vLow === vHigh
    for (let u = along[0]; u <= along[1]; u += 1) {
      for (const [v, facing] of isRidge ? [[vLow, facingLow]] : [[vLow, facingLow], [vHigh, facingHigh]]) {
        const [x, z] = cell(u, v)
        const c = place(x, z, levels[i], i === 0 ? null : levels[i - 1], facing, { ridge: isRidge })
        if (eaveTrim && i === 0) eaveTrimCell(b, x, z, base, c, facing, mat)
      }
    }
  }
  if (!Number.isFinite(topY)) topY = y
  if (gable) fillUnderRoof(b, cells, base, y, footprint, gable)
  return { topY, axis, base, cells }
}

// Round/polygonal roofs for towers: concentric rings of stairs facing the centre.
//   b.coneRoof([cx, y, cz], radius, { material: 'deepslate_tile', pitch: 2, overhang: 1, finial: 'lightning_rod' })
// `y` is the level of the first ring above the wall top; radius is the tower's outer radius.
export function coneRoof(b, center, radius, { material: mat = 'spruce', pitch = 2, overhang = 1, finial, flare = true, thickness = 1 } = {}) {
  const m = roofMaterial(mat)
  const [cx, y, cz] = center
  const outer = radius + overhang
  const rows = Math.ceil(outer + 1)
  const pitchList = Array.isArray(pitch) || typeof pitch === 'function' ? pitch : (flare ? [0.5, 1, ...Array(rows).fill(pitch)] : pitch)
  const levels = rowLevels(pitchList, rows + 2)
  const base = y - (levels[Math.min(overhang, levels.length - 1)] ?? 1) + 1
  let topY = y
  const ringOf = (x, z) => {
    const d = Math.hypot(x - cx, z - cz)
    return Math.max(0, Math.floor(outer - d + 0.5))
  }
  for (let x = Math.floor(cx - outer - 1); x <= Math.ceil(cx + outer + 1); x += 1) {
    for (let z = Math.floor(cz - outer - 1); z <= Math.ceil(cz + outer + 1); z += 1) {
      const d = Math.hypot(x - cx, z - cz)
      if (d > outer + 0.5) continue
      const k = ringOf(x, z)
      if (k >= levels.length) continue
      const facing = d < 0.5 ? 'north' : facingFrom(cx - x, cz - z)
      const isApex = d < 0.75
      const { tb } = roofCell(b, x, z, base, levels[k], k === 0 ? null : levels[k - 1], facing, m, {
        thickness: d <= radius ? thickness : 0,
        ridge: isApex,
        inside: d <= radius,
      })
      topY = Math.max(topY, base + tb)
    }
  }
  if (finial) {
    const list = Array.isArray(finial) ? finial : [finial]
    list.forEach((paint, i) => b.set(cx, topY + 1 + i, cz, paint))
  }
  return { topY }
}

// Solid of revolution around a vertical axis: radius(dy, t) for dy = 0..height-1.
// Domes, onion domes, fountains, chimneys, entasis columns, turret caps.
export function lathe(b, center, height, radius, paint, opts = {}) {
  const [cx, y0, cz] = center
  const rAt = dy => Math.max(0, radius(dy, height > 1 ? dy / (height - 1) : 0))
  let maxR = 0
  for (let dy = 0; dy < height; dy += 1) maxR = Math.max(maxR, rAt(dy))
  const inside = (x, y, z) => {
    const dy = y - y0
    if (dy < 0 || dy >= height) return false
    const r = rAt(dy)
    return (x - cx) ** 2 + (z - cz) ** 2 <= r * r + 0.15
  }
  return b.fillWhere([cx - maxR - 1, y0, cz - maxR - 1], [cx + maxR + 1, y0 + height - 1, cz + maxR + 1], inside, paint, opts)
}

// Onion dome profile helper: base radius r, total height h.
export const onionProfile = (r, h) => (dy, t) => {
  const bulge = Math.sin(Math.min(1, t * 1.6) * Math.PI) * 0.35
  return t < 0.62 ? r * (0.82 + bulge) : r * 1.15 * Math.max(0, (1 - t) / 0.38) ** 1.35
}

// Windows. pos = bottom-left opening cell on the wall plane, as seen from outside.
//   b.window([x, y, z], 'south', { width: 2, height: 2, glass: 'glass_pane', frame: 'stripped_spruce_log',
//             sill: true, lintel: true, shutters: 'spruce_trapdoor', flowerBox: true, recess: 0, arch: false })
export function window(b, pos, facing, opts = {}) {
  const {
    width = 1,
    height = 2,
    glass = 'minecraft:glass_pane',
    frame,
    sill = true,
    lintel = false,
    shutters,
    flowerBox = false,
    recess = 0,
    arch = false,
    material: matName = 'spruce',
    mullion,
  } = opts
  const out = DIR[facing]
  const right = DIR[ccw(facing)]
  const inward = DIR[opposite(facing)]
  const mat = material(matName)
  const cells = []
  for (let i = 0; i < width; i += 1) for (let j = 0; j < height; j += 1) cells.push([i, j, add(add(pos, right, i), UP, j)])
  if (frame) {
    for (let i = -1; i <= width; i += 1) {
      for (let j = -1; j <= height; j += 1) {
        if (i >= 0 && i < width && j >= 0 && j < height) continue
        b.set(...add(add(pos, right, i), UP, j), frame)
      }
    }
  }
  for (const [i, j, p] of cells) {
    for (let k = 0; k < recess; k += 1) b.remove(...add(p, inward, k))
    const isMullion = mullion && width >= 3 && i === Math.floor(width / 2)
    b.set(...add(p, inward, recess), isMullion ? mullion : glass)
    if (arch && j === height - 1 && width >= 2 && (i === 0 || i === width - 1)) {
      const side = i === 0 ? opposite(ccw(facing)) : ccw(facing)
      b.set(...add(p, inward, recess), `${mat.stairs}[facing=${side},half=top]`)
    }
  }
  if (sill) {
    const sillPaint = sill === true ? `${mat.stairs}[facing=${opposite(facing)},half=top]` : sill
    for (let i = 0; i < width; i += 1) b.set(...add(add(pos, right, i), [out[0], -1, out[2]]), sillPaint)
  }
  if (lintel) {
    const lintelPaint = lintel === true ? `${mat.slab}[type=bottom]` : lintel
    for (let i = -1; i <= width; i += 1) b.set(...add(add(add(pos, right, i), UP, height), out), lintelPaint)
  }
  if (shutters) {
    const id = shutters === true ? mat.trapdoor : parseBlock(shutters).name
    for (let j = 0; j < height; j += 1) {
      for (const i of [-1, width]) {
        b.set(...add(add(add(pos, right, i), UP, j), out), `${id}[facing=${facing},open=true,half=${j === height - 1 && height > 1 ? 'top' : 'bottom'}]`)
      }
    }
  }
  if (flowerBox) {
    const flowers = Array.isArray(flowerBox) ? flowerBox : ['minecraft:poppy', 'minecraft:azure_bluet', 'minecraft:cornflower', 'minecraft:allium', 'minecraft:oxeye_daisy', 'minecraft:lily_of_the_valley', 'minecraft:fern']
    const trap = mat.trapdoor
    for (let i = 0; i < width; i += 1) {
      const p = add(add(pos, right, i), [out[0], -1, out[2]])
      b.set(...p, 'minecraft:rooted_dirt')
      b.set(...add(p, out), `${trap}[facing=${facing},open=true,half=bottom]`)
      const f = flowers[Math.floor(hash01(p[0], p[1], p[2], 41) * flowers.length)]
      b.set(...add(p, UP), f)
    }
    const l = add(add(pos, right, -1), [out[0], -1, out[2]])
    const r = add(add(pos, right, width), [out[0], -1, out[2]])
    b.set(...l, `${trap}[facing=${cw(facing)},open=true,half=bottom]`)
    b.set(...r, `${trap}[facing=${ccw(facing)},open=true,half=bottom]`)
  }
  return b
}

// Door: pos = lower door cell on the wall plane. width 1 or 2 (double door).
//   b.door([x, y, z], 'south', { material: 'spruce', width: 2, frame: 'stripped_spruce_log', awning: true })
export function door(b, pos, facing, { material: matName = 'spruce', width = 1, hinge = 'left', open = false, frame, awning = false, steps = false } = {}) {
  const mat = material(matName)
  const right = DIR[ccw(facing)]
  const out = DIR[facing]
  const id = mat.door ?? 'minecraft:spruce_door'
  for (let i = 0; i < width; i += 1) {
    const p = add(pos, right, i)
    const h = width === 2 ? (i === 0 ? 'left' : 'right') : hinge
    b.set(...p, `${id}[facing=${facing},half=lower,hinge=${h},open=${open},powered=false]`)
    b.set(...add(p, UP), `${id}[facing=${facing},half=upper,hinge=${h},open=${open},powered=false]`)
  }
  if (frame) {
    for (let i = -1; i <= width; i += 1) b.set(...add(add(pos, right, i), UP, 2), frame)
    for (let j = 0; j < 2; j += 1) {
      b.set(...add(add(pos, right, -1), UP, j), frame)
      b.set(...add(add(pos, right, width), UP, j), frame)
    }
  }
  if (awning) {
    const paint = awning === true ? `${mat.stairs}[facing=${opposite(facing)},half=bottom]` : awning
    for (let i = -1; i <= width; i += 1) b.set(...add(add(add(pos, right, i), UP, 2), out), paint)
  }
  if (steps) {
    const paint = steps === true ? `${mat.stairs}[facing=${opposite(facing)},half=bottom]` : steps
    for (let i = 0; i < width; i += 1) b.set(...add(add(add(pos, right, i), out), [0, -1, 0]), paint)
  }
  return b
}

// Arch between two springer cells a and b (inclusive opening width, same y, axis-aligned).
//   b.arch([10, 5, 4], [16, 5, 4], 'stone_bricks', { type: 'pointed', thickness: 1, depth: 2, fill: 'air', spandrel: 'stone_bricks', top: 14 })
// type: 'round' | 'pointed' (equilateral gothic) | 'segmental' (opts.rise) | 'flat'
export function arch(b, a, bEnd, paint, { type = 'round', thickness = 1, depth = 1, fill = 'minecraft:air', spandrel, top, rise, direction } = {}) {
  const alongX = a[2] === bEnd[2]
  const u0 = alongX ? Math.min(a[0], bEnd[0]) : Math.min(a[2], bEnd[2])
  const u1 = alongX ? Math.max(a[0], bEnd[0]) : Math.max(a[2], bEnd[2])
  const w = u1 - u1 + (u1 - u0) + 1
  const mid = (u0 + u1) / 2
  const y0 = a[1]
  const normal = direction ? DIR[direction] : alongX ? [0, 0, 1] : [1, 0, 0]
  const s = w
  let opening
  let ring
  if (type === 'pointed') {
    const R = s * 0.85
    const cL = -s / 2 + (s - R)
    const cR = s / 2 - (s - R)
    opening = (u, v) => v >= 0 && (u - cL) ** 2 + v * v <= R * R && (u - cR) ** 2 + v * v <= R * R
    ring = (u, v) => v >= 0 && (u - cL) ** 2 + v * v <= (R + thickness) ** 2 && (u - cR) ** 2 + v * v <= (R + thickness) ** 2
  } else if (type === 'segmental') {
    const h = rise ?? Math.max(1, Math.round(s / 4))
    const R = (s * s / 4 + h * h) / (2 * h)
    const cv = h - R
    opening = (u, v) => v >= 0 && u * u + (v - cv) ** 2 <= R * R
    ring = (u, v) => v >= 0 && u * u + (v - cv) ** 2 <= (R + thickness) ** 2
  } else if (type === 'flat') {
    opening = (u, v) => v >= 0 && Math.abs(u) <= s / 2 && v <= 0
    ring = (u, v) => v >= 0 && Math.abs(u) <= s / 2 + thickness && v <= thickness
  } else {
    const R = s / 2
    opening = (u, v) => v >= 0 && u * u + v * v <= R * R
    ring = (u, v) => v >= 0 && u * u + v * v <= (R + thickness) ** 2
  }
  const halfSpan = s / 2 + thickness + 1
  const maxV = top !== undefined ? top - y0 : Math.ceil(s + thickness + 1)
  for (let vi = 0; vi <= maxV; vi += 1) {
    for (let ui = Math.floor(mid - halfSpan); ui <= Math.ceil(mid + halfSpan); ui += 1) {
      const u = ui - mid
      const v = vi + 0.5 - 0.5
      let p = null
      if (opening(u, v + 0.5)) p = fill
      else if (ring(u, v + 0.5) && Math.abs(u) <= s / 2 + thickness) p = paint
      else if (spandrel && Math.abs(u) <= s / 2 + thickness && vi <= maxV) p = spandrel
      if (p === null) continue
      for (let d = 0; d < depth; d += 1) {
        const x = alongX ? ui : a[0] + normal[0] * d
        const z = alongX ? a[2] + normal[2] * d : ui
        b.set(x, y0 + vi, z, p)
      }
    }
  }
  return b
}

// Column with optional plinth and capital. size 1 = single-block shaft; size 3 adds stair flares.
export function column(b, base, height, { shaft = 'minecraft:quartz_pillar[axis=y]', plinth, capital, flare } = {}) {
  const [x, y, z] = base
  for (let j = 0; j < height; j += 1) b.set(x, y + j, z, shaft)
  if (plinth) b.set(x, y, z, plinth)
  if (capital) b.set(x, y + height - 1, z, capital)
  if (flare) {
    const m = material(flare)
    for (const f of ['north', 'east', 'south', 'west']) {
      const d = DIR[f]
      b.set(x + d[0], y, z + d[2], `${m.stairs}[facing=${opposite(f)},half=bottom]`, { keep: true })
      b.set(x + d[0], y + height - 1, z + d[2], `${m.stairs}[facing=${opposite(f)},half=top]`, { keep: true })
    }
  }
  return b
}

// Crenellations along the perimeter of a rectangle at height y.
//   b.battlements([x0, z0], [x1, z1], y, 'stone_bricks', { period: 2, height: 1, cap: 'stone_brick_slab' })
export function battlements(b, a, c, y, paint, { period = 2, height = 1, cap, offset = 0 } = {}) {
  const [x0, z0] = [Math.min(a[0], c[0]), Math.min(a[1], c[1])]
  const [x1, z1] = [Math.max(a[0], c[0]), Math.max(a[1], c[1])]
  let i = 0
  const perimeter = []
  for (let x = x0; x <= x1; x += 1) perimeter.push([x, z0])
  for (let z = z0 + 1; z <= z1; z += 1) perimeter.push([x1, z])
  for (let x = x1 - 1; x >= x0; x -= 1) perimeter.push([x, z1])
  for (let z = z1 - 1; z > z0; z -= 1) perimeter.push([x0, z])
  for (const [x, z] of perimeter) {
    const corner = (x === x0 || x === x1) && (z === z0 || z === z1)
    const merlon = corner || (i + offset) % period === 0
    if (merlon) {
      for (let h = 0; h < height; h += 1) b.set(x, y + h, z, paint)
      if (cap) b.set(x, y + height, z, cap)
    }
    i += 1
  }
  return b
}

// Spiral staircase inside a round shaft. Stairs climb `blocksPerTurn` per full turn.
export function spiralStairs(b, center, rInner, rOuter, y0, y1, matName = 'stone_brick', { clockwise = true, stepsPerTurn = 12, core, landing } = {}) {
  const m = material(matName)
  const [cx, , cz] = center
  const totalSteps = y1 - y0
  for (let s = 0; s <= totalSteps; s += 1) {
    const a0 = (s / stepsPerTurn) * Math.PI * 2 * (clockwise ? 1 : -1)
    const a1 = ((s + 1) / stepsPerTurn) * Math.PI * 2 * (clockwise ? 1 : -1)
    const y = y0 + s
    for (let x = Math.floor(cx - rOuter); x <= Math.ceil(cx + rOuter); x += 1) {
      for (let z = Math.floor(cz - rOuter); z <= Math.ceil(cz + rOuter); z += 1) {
        const d = Math.hypot(x - cx, z - cz)
        if (d > rOuter || d < rInner) continue
        let ang = Math.atan2(z - cz, x - cx)
        const lo = Math.min(a0, a1)
        const hi = Math.max(a0, a1)
        while (ang < lo) ang += Math.PI * 2
        while (ang >= lo + Math.PI * 2) ang -= Math.PI * 2
        if (ang < lo || ang >= hi) continue
        const mid = (a0 + a1) / 2 + (clockwise ? Math.PI / 2 : -Math.PI / 2)
        const facing = facingFrom(Math.cos(mid), Math.sin(mid))
        b.set(x, y, z, `${m.stairs}[facing=${facing},half=bottom]`)
        b.set(x, y - 1, z, `${m.slab}[type=top]`, { keep: true })
      }
    }
  }
  if (core) for (let y = y0; y <= y1; y += 1) b.set(cx, y, cz, core)
  if (landing) b.disc([cx, y1, cz], rOuter, landing)
  return b
}

// Lamp post: post of `height` blocks with a lantern on top (or hanging from an arm).
export function lampPost(b, base, { height = 3, post = 'minecraft:spruce_fence', foot, lantern = 'minecraft:lantern', arm } = {}) {
  const [x, y, z] = base
  if (foot) b.set(x, y, z, foot)
  for (let j = foot ? 1 : 0; j < height; j += 1) b.set(x, y + j, z, post)
  if (arm) {
    const d = DIR[arm]
    b.set(x, y + height, z, post)
    b.set(x + d[0], y + height, z + d[2], post)
    b.set(x + d[0], y + height - 1, z + d[2], `${parseBlock(lantern).name}[hanging=true]`)
  } else {
    b.set(x, y + height, z, `${parseBlock(lantern).name}[hanging=false]`)
  }
  return b
}

// Hanging lantern below an anchor: `length` chain blocks then the lantern.
export function hangingLantern(b, anchor, length = 1, { lantern = 'minecraft:lantern', chain = 'minecraft:chain[axis=y]' } = {}) {
  const [x, y, z] = anchor
  for (let j = 1; j <= length; j += 1) b.set(x, y - j, z, chain)
  b.set(x, y - length - 1, z, `${parseBlock(lantern).name}[hanging=true]`)
  return b
}

// Chimney column with cap and campfire smoke.
export function chimney(b, base, height, { paint = 'minecraft:bricks', cap = 'minecraft:stone_brick_wall', smoke = true, size = 1 } = {}) {
  const [x, y, z] = base
  b.box([x, y, z], [x + size - 1, y + height - 1, z + size - 1], paint)
  if (smoke) b.set(x, y + height - 1, z, 'minecraft:campfire[lit=true,signal_fire=false,facing=north]')
  if (cap) {
    for (let i = 0; i < size; i += 1) for (let k = 0; k < size; k += 1) {
      if (smoke && i === 0 && k === 0) continue
      b.set(x + i, y + height, z + k, cap)
    }
  }
  return b
}

// Timber-framed wall panel on a plane (one of the box dimensions must be 1 thick).
//   b.timberWall([x0, y0, z], [x1, y1, z], { frame: 'stripped_spruce_log', infill: 'white_terracotta', postEvery: 4, beams: [y0 + 4], braces: true })
export function timberWall(b, a, c, { frame = 'minecraft:stripped_spruce_log', infill = 'minecraft:white_terracotta', postEvery = 4, beams = [], braces = false, brace } = {}) {
  const min = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])]
  const max = [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])]
  const alongX = max[0] - min[0] >= max[2] - min[2]
  const frameName = parseBlock(frame).name
  const isLogLike = /_(log|wood|stem|hyphae)$|_pillar$|basalt$/.test(frameName)
  const vertical = isLogLike ? `${frameName}[axis=y]` : frame
  const horizontal = isLogLike ? `${frameName}[axis=${alongX ? 'x' : 'z'}]` : frame
  b.box(min, max, infill)
  const u0 = alongX ? min[0] : min[2]
  const u1 = alongX ? max[0] : max[2]
  const posts = []
  for (let u = u0; u <= u1; u += postEvery) posts.push(u)
  if (posts[posts.length - 1] !== u1) posts.push(u1)
  const at = (u, y) => (alongX ? [u, y, min[2]] : [min[0], y, u])
  for (const u of posts) for (let y = min[1]; y <= max[1]; y += 1) b.set(...at(u, y), vertical)
  for (const by of [min[1], max[1], ...beams]) for (let u = u0; u <= u1; u += 1) b.set(...at(u, by), horizontal)
  if (braces) {
    // Diagonal braces as a stepped (4-connected) line of the frame block, so they read as
    // one continuous timber instead of disconnected posts.
    const braceBlock = brace ?? (isLogLike ? frameName.replace(/_log$/, '_wood').replace(/_stem$/, '_hyphae') : frame)
    const levels = [min[1], ...beams.filter(y => y > min[1] && y < max[1]), max[1]]
    const bays = posts.length - 1
    for (let i = 0; i < bays; i += 1) {
      if (braces !== 'all' && i !== 0 && i !== bays - 1) continue
      const ua = posts[i]
      const ub = posts[i + 1]
      if (ub - ua < 3) continue
      for (let l = 0; l < levels.length - 1; l += 1) {
        const ya = levels[l] + 1
        const yb = levels[l + 1] - 1
        if (yb - ya < 1) continue
        const flip = braces === 'all' ? (i + l) % 2 === 0 : i === 0
        const span = ub - ua - 2
        const rise = yb - ya
        let prevU = null
        let prevY = null
        for (let k = 0; k <= Math.max(span, rise) * 2; k += 1) {
          const t = k / (Math.max(span, rise) * 2)
          const u = Math.round(flip ? ua + 1 + span * t : ub - 1 - span * t)
          const yy = Math.round(ya + rise * t)
          if (prevU !== null && u !== prevU && yy !== prevY) b.set(...at(u, prevY), braceBlock)
          b.set(...at(u, yy), braceBlock)
          prevU = u
          prevY = yy
        }
      }
    }
  }
  return b
}

export const ARCH_METHODS = {
  roof,
  coneRoof,
  lathe,
  window,
  door,
  arch,
  column,
  battlements,
  spiralStairs,
  lampPost,
  hangingLantern,
  chimney,
  timberWall,
}
