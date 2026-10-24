// East-Asian roofs: swept eaves, upturned corners (sori), hip-and-gable (irimoya), pagoda skirts,
// and roofs that join other roofs in valleys. Builder-first functions, also installed as Builder
// methods (b.eastRoof(...), b.pagoda(...), b.rasterRoof(...)).
//
//   const hall = b.eastRoof({
//     x0, z0, x1, z1,            // outer wall lines (inclusive), same as b.roof
//     y,                         // level of the roof row directly above the wall line (wall top + 1)
//                                //   or eaveY: block level of the outermost eave ring (pagoda tiers)
//     type: 'irimoya',           // 'hip' | 'gable' | 'irimoya' (hip-and-gable) | 'pyramid' (hip, for squares)
//     axis: 'x',                 // ridge direction for gable / irimoya (default: the longer side)
//     material: 'deepslate_tile',// family with stairs + slab (substitutes are used for copper_block...),
//                                //   or { stairs, slab, block }
//     ribs: 'deepslate_brick',   // optional: alternate tile courses (rows running down the slope)
//     ridge: 'polished_blackstone', // ridge line, hip lines, ridge ends (default: material)
//     rafter: 'spruce',          // everything under the top surface: soffit, eave fascia (alias underside)
//     pitch: [0.5, 0.5, 1, 1, 1],// rise per ring from the eave inward (same semantics as b.roof)
//     overhang: 2,               // eave depth beyond the wall lines; gableOverhang for gable rakes
//     lift: 1,                   // corner upturn in blocks (0, 0.5, 1, 1.5, 2 ...), liftReach, liftCurve
//     thickness: 1,              // shell depth under the surface (1.5 = heavy pagoda eaves)
//     stopRing, stopAt,          // skirts: build rings < stopRing only, or skip a wall-line rect [x0, z0, x1, z1]
//     inset,                     // irimoya: hip rings at each gable end before the gable rises
//     gable, gableBeam,          // paint for the gable triangle (+ its bottom course)
//     barge,                     // bargeboards on the gable rakes (true = rafter trapdoors, or a trapdoor id)
//     ridgeEnds: true,           // onigawara: ridge-material horns at both ridge ends (gable, irimoya)
//     brackets, lanterns,        // rafter-stair brackets under the soffit; lanterns under the four tips
//     finial,                    // paint or list stacked on the apex (hip / pyramid)
//     above: otherRoof,          // only build where this roof rises above another roof's surface (valleys)
//     only: cell => bool,        // custom subset (cell has x, z, top, y, ring, sec, hip, ridge)
//   })
//   // → { topY, base, y, axis, levels, heights: Map "x,z" → top block y, cells: Map "x,z" → cell,
//   //     surface(x, z), bottom(x, z), field (the heightfield(s)), outline, apex }
//
// How it works. The roof is a heightfield t(x, z) in half blocks over its eave outline (the wall
// lines grown by the overhang). Ring k = distance to the outline: min(ex, ez) for hips, the
// distance across the ridge for gables; ring 0 is the outermost eave row. t = levels[ring] + lift
// near the corners + a half-block bead on hip lines and ridges. Each column becomes a shell from t
// down to half a block below its lowest neighbour (at least `thickness`): neighbouring columns
// always overlap by half a block or more, so upturned corners and steep steps have no see-through
// gaps. The shell is cut into half-block pieces: a full top piece is a stair facing uphill when a
// neighbour is a whole block lower (a block on ridges), a half piece is a bottom or top slab. Top
// pieces are tile (ridge material on hips/ridges); pieces that rise above the lowest neighbour are
// visible risers (tile), everything else is rafter (warm soffit and fascia). Stair corner shapes are
// left to finish().
//
// Conventions (same as b.roof):
//   pitch  — list entry i is the rise from ring i-1 up to ring i (0.5 slab step, 1 stair step, 2/3
//            steep); entry 0 only picks the eave element (<= 0.5 → slab, else stair). The LAST value
//            repeats up to the ridge or apex. On hips and pyramids a trailing steep value therefore
//            stacks into a spike ([0.5, 0.5, 1, 1, 2] on a 19-wide hip ends in six 2-rises): end hip
//            lists in 1 (a single trailing 2 that is used once, like the pagoda top, is fine).
//            Keep an EVEN number of leading 0.5s (counting entry 0): [0.5, 0.5, 1 ...] puts the stair
//            rings on whole levels; [0.5, 0.5, 0.5, 1 ...] puts every later ring on x.5 levels, which
//            reads as slab-on-block steps instead of stairs.
//   lift   — sori: extra height near each outline corner, lift * (1 - d / liftReach) ^ liftCurve,
//            d = Manhattan distance from the corner, rounded to half blocks. Default reach 2 * lift
//            (falls by half a block per block). Typical: 1 small roofs, 1.5 pagoda tiers, 2 big halls.
//   y      — inside the wall lines, pieces below `y` only fill empty space (walls and plates survive);
//            wall-line columns reach down to `rim` (default y) so the roof always closes onto the wall.
//   joins  — build the main roof first, then the canopy with `above: main`: only canopy cells that
//            rise above the main surface are drawn, and the union of the two surfaces is the valley.

import { parseBlock } from './blocks.mjs'
import { material } from './materials.mjs'

const K = (x, z) => `${x},${z}`
const N4 = [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]]
const OPP = { east: 'west', west: 'east', north: 'south', south: 'north' }
const mod2 = v => ((v % 2) + 2) % 2

function roofMaterial(spec, fallback) {
  if (spec === undefined || spec === null) spec = fallback
  if (typeof spec === 'string') {
    const m = material(spec)
    // materials without their own stairs/slabs (copper_block, calcite...) use the closest family's
    const stairs = m.stairs ?? m.substitutes?.stairs?.[0]
    const slab = m.slab ?? m.substitutes?.slab?.[0]
    if (!stairs || !slab) throw new Error(`eastRoof: material "${spec}" needs stairs and slab variants`)
    return { stairs, slab, block: m.block ?? m.planks }
  }
  if (spec && spec.stairs && spec.slab && spec.block) {
    return { stairs: parseBlock(spec.stairs).name, slab: parseBlock(spec.slab).name, block: spec.block }
  }
  throw new Error('eastRoof: material must be a family name or { stairs, slab, block }')
}

// Same pitch semantics as arch.mjs roof(): rises per ring of 0, 0.5, 1, 2 or 3 (multiples of 0.5);
// ring 0 sits at 0.5 for a slab start and 1 otherwise.
function riseList(pitch, rows) {
  const named = { flat: 0, shallow: 0.5, low: 0.5, normal: 1, medium: 1, steep: 2, 'very-steep': 3 }
  const at = i => {
    let r
    if (typeof pitch === 'function') r = pitch(i, rows)
    else if (Array.isArray(pitch)) r = pitch[Math.min(i, pitch.length - 1)]
    else if (typeof pitch === 'string') r = named[pitch]
    else r = pitch
    if (r === undefined || !Number.isFinite(r)) r = 1
    return Math.max(i === 0 ? 0.5 : 0, Math.round(r * 2) / 2)
  }
  return Array.from({ length: rows }, (_, i) => at(i))
}

export function rowLevels(pitch, rows) {
  const rises = riseList(pitch, rows)
  const levels = [rises[0] <= 0.5 ? 0.5 : 1]
  for (let i = 1; i < rows; i += 1) levels.push(levels[i - 1] + rises[i])
  return levels
}

// Level of the block that carries a surface at `t` (a bottom slab for x.5, else the block below).
const topBlock = t => (t % 1 !== 0 ? Math.floor(t) : t - 1)

// The heightfield over an EAVE outline (inclusive). Pure function: Map "x,z" → cell
//   { x, z, ex, ez, ring, sec: 'hip'|'gable', hip, ridge, along, lift, t }
// plus field.levels / field.outline / field.axis / field.type.
//   type 'hip'   ring = min(ex, ez)
//   type 'gable' cells at least `inset` from the gable ends use the distance across the ridge
//                (sec 'gable'); inset 0 = plain gable, inset k = the gable part of an irimoya.
//   stopRing / hole [x0, z0, x1, z1]: leave out rings >= stopRing / cells inside the rect.
//   bead: hip lines (a 4-connected staircase along the diagonals) and the ridge rise half a block.
export function roofField({ x0, z0, x1, z1, pitch = [0.5, 0.5, 1, 1, 1], type = 'hip', axis, inset = 0, stopRing = Infinity, hole = null, lift = 0, liftReach, liftCurve = 1, bead = true }) {
  const minX = Math.min(x0, x1)
  const maxX = Math.max(x0, x1)
  const minZ = Math.min(z0, z1)
  const maxZ = Math.max(z0, z1)
  const ax = axis ?? (maxX - minX >= maxZ - minZ ? 'x' : 'z')
  const levels = rowLevels(pitch, Math.ceil(Math.max(maxX - minX + 1, maxZ - minZ + 1) / 2) + 2)
  const reach = liftReach ?? 2 * lift
  const liftAt = d => (lift > 0 && d < reach ? Math.round(lift * (1 - d / reach) ** liftCurve * 2) / 2 : 0)
  const inHole = hole ? (x, z) => x >= Math.min(hole[0], hole[2]) && x <= Math.max(hole[0], hole[2]) && z >= Math.min(hole[1], hole[3]) && z <= Math.max(hole[1], hole[3]) : () => false
  const field = new Map()
  const maxRing = { hip: -1, gable: -1 }
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      const ex = Math.min(x - minX, maxX - x)
      const ez = Math.min(z - minZ, maxZ - z)
      let ring = Math.min(ex, ez)
      let sec = 'hip'
      if (type === 'gable' && (ax === 'x' ? ex : ez) >= inset) {
        ring = ax === 'x' ? ez : ex
        sec = 'gable'
      }
      if (ring >= stopRing || inHole(x, z)) continue
      const lifted = liftAt(ex + ez)
      // a 4-connected staircase along the diagonal: diagonal-only cells read as a dotted line
      const hip = sec === 'hip' && Math.min(ex, ez) >= 1 && (ex === ez || ex === ez + 1)
      // `along` runs parallel to the eave: alternating materials on it draws tile courses
      const along = sec === 'gable' ? (ax === 'x' ? x : z) : ez <= ex ? x : z
      field.set(K(x, z), { x, z, ex, ez, ring, sec, hip, ridge: false, along, lift: lifted, t: levels[ring] + lifted })
      maxRing[sec] = Math.max(maxRing[sec], ring)
    }
  }
  const closed = stopRing === Infinity && !hole
  for (const c of field.values()) {
    c.ridge = c.sec === 'gable' ? c.ring === maxRing.gable : type === 'hip' && closed && c.ring === maxRing.hip
    if (bead && (c.hip || c.ridge)) c.t += 0.5
  }
  field.levels = levels
  field.outline = { x0: minX, z0: minZ, x1: maxX, z1: maxZ }
  field.axis = ax
  field.type = type
  field.maxRing = maxRing
  return field
}

// Rasterises a heightfield (from roofField, or any Map "x,z" → { x, z, t, sec?, hip?, ridge?, along? },
// e.g. an arched bridge deck) at `base` (the level of t = 0). Returns per-column records.
//   material / ribs / ridge / rafter as in eastRoof; thickness; only(cell);
//   rim { test(x, z), level }: matching columns reach down to `level` (closes onto a wall top);
//   keepBelow { test(x, z), level }: pieces below `level` in matching columns only fill empty space;
//   overwrite: false → every piece only fills empty space.
export function rasterRoof(b, field, opts = {}) {
  const base = opts.base ?? opts.y ?? 0
  const mat = roofMaterial(opts.material, 'deepslate_tile')
  const ribs = opts.ribs ? roofMaterial(opts.ribs) : null
  const ridgeMat = roofMaterial(opts.ridge, mat)
  const under = roofMaterial(opts.rafter ?? opts.underside, mat)
  const { thickness = 1, only = null, rim = null, keepBelow = null, overwrite = true, placed = null, tag = 'roof', cols = new Map() } = opts
  const ol = field.outline
  const outsideOutline = ol ? (x, z) => x < ol.x0 || x > ol.x1 || z < ol.z0 || z > ol.z1 : () => false
  for (const c of field.values()) {
    c.top = base + c.t
    c.y = base + topBlock(c.t)
  }
  for (const c of field.values()) {
    if (only && !only(c)) continue
    let minN = Infinity
    const lower = []
    const outside = []
    for (const [f, dx, dz] of N4) {
      const n = field.get(K(c.x + dx, c.z + dz))
      if (!n) {
        if (outsideOutline(c.x + dx, c.z + dz)) outside.push(f)
        continue
      }
      if ((n.sec ?? 'hip') !== (c.sec ?? 'hip')) continue // gable cells ignore the hip below them: thin rakes
      minN = Math.min(minN, n.t)
      if (n.t <= c.t - 1) lower.push([f, n.t])
    }
    let bottom = Math.min(c.t - thickness, minN - 0.5)
    if (rim && rim.test(c.x, c.z)) bottom = Math.min(bottom, rim.level - base)
    // Warm soffit: when the lowest piece would be tile (the top piece itself, or a visible riser),
    // its underside shows from below as a tile stripe across the soffit. Hang half a block of
    // rafter under it.
    if (under !== mat) {
      const hi = Math.min(c.t, Math.floor(bottom) + 1)
      if (hi === c.t || hi > minN) bottom -= 0.5
    }
    const top = base + c.t
    const bot = base + bottom
    const face = ribs && mod2(c.along ?? 0) === 0 ? ribs : mat
    let kind = null
    let facing = null
    let lowest = Infinity
    for (let yy = Math.floor(bot); yy < Math.ceil(top); yy += 1) {
      const lo = Math.max(bot, yy)
      const hi = Math.min(top, yy + 1)
      if (hi - lo < 0.5) continue
      const isTop = hi === top
      const m = isTop ? (c.hip || c.ridge ? ridgeMat : face) : hi > base + minN ? face : under
      let block
      if (hi - lo === 1) {
        block = m.block
        if (isTop) {
          kind = 'block'
          const dirs = lower.map(l => l[0])
          const ridgeCell = dirs.some(d => dirs.includes(OPP[d])) || dirs.length > 2
          if (lower.length && !ridgeCell) {
            lower.sort((p, q) => p[1] - q[1])
            facing = OPP[lower[0][0]]
          } else if (!lower.length && outside.length && !c.ridge && !c.hip) {
            facing = OPP[outside[0]] // whole-level eave row: a stair stepping down to the edge
          }
          if (facing) {
            kind = 'stairs'
            block = `${m.stairs}[facing=${facing},half=bottom]`
          }
        }
      } else {
        block = lo === yy ? `${m.slab}[type=bottom]` : `${m.slab}[type=top]`
        if (isTop) kind = 'slab'
      }
      const keep = !overwrite || (keepBelow && yy < keepBelow.level && keepBelow.test(c.x, c.z))
      if (keep && b.has(c.x, yy, c.z)) continue
      b.set(c.x, yy, c.z, block)
      if (placed) placed.set(`${c.x},${yy},${c.z}`, `${tag}:${isTop ? 'top' : m === under ? 'under' : 'riser'}`)
      lowest = Math.min(lowest, yy)
    }
    const key = K(c.x, c.z)
    const prev = cols.get(key)
    const rec = { x: c.x, z: c.z, t: c.t, top, y: base + topBlock(c.t), bottom: lowest, ring: c.ring, sec: c.sec, hip: c.hip, ridge: c.ridge, kind, facing }
    if (!prev) cols.set(key, rec)
    else if (top >= prev.top) cols.set(key, { ...rec, bottom: Math.min(prev.bottom, lowest) })
    else prev.bottom = Math.min(prev.bottom, lowest)
  }
  return cols
}

// East-Asian roof over a rectangle of wall lines. See the header for options.
export function eastRoof(b, opts = {}) {
  const {
    type = 'hip',
    overhang = 2,
    pitch = [0.5, 0.5, 1, 1, 1],
    lift = 1,
    liftReach,
    liftCurve = 1,
    thickness = 1,
    bead = true,
    stopRing = Infinity,
    stopAt = null,
    overwrite = true,
    gable,
    gableBeam,
    gableSetback = 1,
    barge,
    brackets = false,
    lanterns = false,
    finial,
    only,
    above,
  } = opts
  if (!['hip', 'gable', 'irimoya', 'pyramid'].includes(type)) throw new Error(`eastRoof: unknown type "${type}" (hip | gable | irimoya | pyramid)`)
  for (const k of ['x0', 'z0', 'x1', 'z1']) if (!Number.isFinite(opts[k])) throw new Error(`eastRoof: ${k} (wall line) is required`)
  const mat = roofMaterial(opts.material, 'deepslate_tile')
  const ridgeMat = roofMaterial(opts.ridge, mat)
  const rafter = roofMaterial(opts.rafter ?? opts.underside, 'spruce')
  const ribs = opts.ribs ? roofMaterial(opts.ribs) : null
  const minX = Math.min(opts.x0, opts.x1)
  const maxX = Math.max(opts.x0, opts.x1)
  const minZ = Math.min(opts.z0, opts.z1)
  const maxZ = Math.max(opts.z0, opts.z1)
  const axis = opts.axis ?? (maxX - minX >= maxZ - minZ ? 'x' : 'z')
  const gableOverhang = opts.gableOverhang ?? (type === 'gable' ? Math.max(1, overhang - 1) : overhang)
  const ovX = type === 'gable' && axis === 'x' ? gableOverhang : overhang
  const ovZ = type === 'gable' && axis === 'z' ? gableOverhang : overhang
  const outline = { x0: minX - ovX, z0: minZ - ovZ, x1: maxX + ovX, z1: maxZ + ovZ }
  const spanX = outline.x1 - outline.x0 + 1
  const spanZ = outline.z1 - outline.z0 + 1
  const levels = rowLevels(pitch, Math.ceil(Math.max(spanX, spanZ) / 2) + 2)
  const ovAcross = type === 'gable' ? (axis === 'x' ? ovZ : ovX) : overhang
  let base
  if (Number.isFinite(opts.eaveY)) base = opts.eaveY
  else if (Number.isFinite(opts.y)) base = opts.y - topBlock(levels[Math.min(ovAcross, levels.length - 1)])
  else throw new Error('eastRoof: y (level of the roof row above the wall line) or eaveY is required')
  const y = base + topBlock(levels[Math.min(ovAcross, levels.length - 1)])

  // stopAt: wall lines of the storey above → cells inside are left out (skirts)
  const hole = stopAt ? (Array.isArray(stopAt) ? stopAt : [stopAt.x0, stopAt.z0, stopAt.x1, stopAt.z1]) : null
  const fieldOpts = { ...outline, pitch, lift, liftReach, liftCurve, bead, stopRing, hole }
  const minSpan = Math.min(spanX, spanZ)
  const alongSpan = axis === 'x' ? spanX : spanZ
  // irimoya: by default the gable rises one ring inside the wall line (the hip skirt covers the whole
  // overhang); bigger roofs use a quarter of the short span
  const inset = Math.max(1, Math.min(opts.inset ?? Math.max(overhang + 1, Math.floor(minSpan / 4)), Math.floor((alongSpan - 1) / 2) - 1))

  // trailing steep rises repeated on a hip stack into a spike
  if ((type === 'hip' || type === 'pyramid') && Array.isArray(pitch) && pitch.length && pitch[pitch.length - 1] > 1) {
    const rings = Math.min(stopRing, Math.ceil(minSpan / 2))
    if (rings - pitch.length >= 2) b.warnings.push(`eastRoof: pitch ends in ${pitch[pitch.length - 1]}, which repeats over ${rings - pitch.length + 1} rings of this ${type}: the top becomes a spike; end hip pitch lists in 1`)
  }

  const inFoot = (x, z) => x >= minX && x <= maxX && z >= minZ && z <= maxZ
  const onWall = (x, z) => inFoot(x, z) && (x === minX || x === maxX || z === minZ || z === maxZ)
  const others = above ? (Array.isArray(above) ? above : [above]) : []
  const otherTop = (x, z) => Math.max(-Infinity, ...others.map(o => (o.surface ? o.surface(x, z) : -Infinity)))
  const userOnly = c => (!only || only(c)) && (!others.length || c.top > otherTop(c.x, c.z))
  const placed = new Map() // "x,y,z" → "<field>:<top|riser|under>": what a later fill may replace
  const cols = new Map()
  const rOpts = {
    base, material: mat, ribs, ridge: ridgeMat, rafter, thickness, overwrite, placed, cols,
    rim: opts.rim === false ? null : { test: onWall, level: Number.isFinite(opts.rim) ? opts.rim : y },
    keepBelow: { test: inFoot, level: y },
  }

  let field
  let gabF = null
  if (type === 'irimoya') {
    // Irimoya = a hip field plus a gable field on the same outline, pitch and lift: their long slopes
    // coincide and the gable rises out of the hip ends. Hip cells that would poke through the gable
    // (raised hip beads near the ridge) are skipped; the hip ring at the gable end is the shelf the
    // gable triangle stands on.
    field = roofField({ ...fieldOpts, type: 'hip' })
    gabF = roofField({ ...fieldOpts, type: 'gable', axis, inset })
    for (const c of gabF.values()) c.top = base + c.t
    rasterRoof(b, field, { ...rOpts, tag: 'hip', only: c => { const g = gabF.get(K(c.x, c.z)); return (!g || g.sec === 'hip' || c.t <= g.t) && userOnly(c) } })
    rasterRoof(b, gabF, { ...rOpts, tag: 'gable', rim: null, only: c => c.sec === 'gable' && userOnly(c) })
  } else {
    field = roofField({ ...fieldOpts, type: type === 'gable' ? 'gable' : 'hip', axis, inset: 0 })
    rasterRoof(b, field, { ...rOpts, only: userOnly })
  }
  const gField = type === 'irimoya' ? gabF : type === 'gable' ? field : null
  // A gable fill replaces only empty cells, soffit pieces, and (irimoya) hip pieces hidden under
  // the gable: never the tile surface or visible risers (the ridge riser shows from both slopes).
  const fillCell = (x, yy, z, paint) => {
    const role = placed.get(`${x},${yy},${z}`)
    if (!b.has(x, yy, z) || (role && (role.endsWith(':under') || role.startsWith('hip:')))) {
      b.set(x, yy, z, paint)
      placed.delete(`${x},${yy},${z}`)
    }
  }
  const across = c => (axis === 'x' ? c.z : c.x)

  // Gable triangles: on the gable-end wall lines (gable), or set back `gableSetback` behind the
  // rake (irimoya) so the rake casts a shadow line over the triangle.
  const gableEnds = []
  if (gField) {
    const a0 = axis === 'x' ? outline.x0 : outline.z0
    const a1 = axis === 'x' ? outline.x1 : outline.z1
    const k = type === 'irimoya' ? inset : 0
    gableEnds.push({ rake: a0 + k, plane: type === 'irimoya' ? a0 + k + gableSetback : (axis === 'x' ? minX : minZ), out: axis === 'x' ? 'west' : 'north', step: -1 })
    gableEnds.push({ rake: a1 - k, plane: type === 'irimoya' ? a1 - k - gableSetback : (axis === 'x' ? maxX : maxZ), out: axis === 'x' ? 'east' : 'south', step: 1 })
  }
  const at = (u, v) => (axis === 'x' ? [u, v] : [v, u])
  if (gField && gable) {
    const v0 = axis === 'x' ? (type === 'gable' ? minZ : outline.z0) : (type === 'gable' ? minX : outline.x0)
    const v1 = axis === 'x' ? (type === 'gable' ? maxZ : outline.z1) : (type === 'gable' ? maxX : outline.x1)
    const start = type === 'irimoya' ? base + Math.ceil(levels[inset]) : y
    for (const end of gableEnds) {
      for (let v = v0; v <= v1; v += 1) {
        const [x, z] = at(end.plane, v)
        const c = gField.get(K(x, z))
        const col = cols.get(K(x, z))
        if (!c || c.sec !== 'gable' || !col) continue
        for (let yy = start; yy < col.y; yy += 1) fillCell(x, yy, z, gableBeam && yy === start ? gableBeam : gable)
      }
    }
  }
  // Bargeboards: thin boards on the outer face of the rake, above the hip shelf.
  if (gField && barge) {
    const id = barge === true ? (material(parseBlock(rafter.stairs).name).trapdoor ?? 'minecraft:spruce_trapdoor') : parseBlock(barge).name
    const shelf = type === 'irimoya' ? levels[inset] : -Infinity
    for (const end of gableEnds) {
      for (const c of gField.values()) {
        if (c.sec !== 'gable' || (axis === 'x' ? c.x : c.z) !== end.rake || c.t <= shelf) continue
        const col = cols.get(K(c.x, c.z))
        if (!col) continue
        const [x, z] = at(end.rake + end.step, across(c))
        b.set(x, col.y, z, `${id}[facing=${end.out},open=true,half=bottom]`, { keep: true })
      }
    }
  }
  // Ridge ends (onigawara): the ridge flicks up at both ends with a stair whose tall back faces
  // outward. Small roofs swap the ridge-cap slab for the stair (+0.5); roofs 13+ wide across the
  // ridge (or ridgeEnds: 'large') stack a block and the stair (+1.5).
  if (gField && opts.ridgeEnds !== false) {
    const crossSpan = axis === 'x' ? spanZ : spanX
    const big = opts.ridgeEnds === 'large' || (opts.ridgeEnds !== 'small' && crossSpan >= 13)
    for (const end of gableEnds) {
      for (const c of gField.values()) {
        if (!c.ridge || (axis === 'x' ? c.x : c.z) !== end.rake) continue
        const col = cols.get(K(c.x, c.z))
        if (!col || col.sec !== 'gable') continue
        const stair = `${ridgeMat.stairs}[facing=${end.out},half=bottom]`
        if (big) {
          b.set(c.x, col.y, c.z, ridgeMat.block)
          b.set(c.x, col.y + 1, c.z, stair)
          col.y += 1
        } else if (col.kind === 'slab') {
          b.set(c.x, col.y, c.z, stair)
        } else {
          b.set(c.x, col.y + 1, c.z, stair)
          col.y += 1
        }
        col.top = col.y + 1
      }
    }
  }

  // Brackets: an upside-down rafter stair under the soffit one block out from every wall cell (a
  // cove that fills the dark gap between wall and eave), stepping out a second time at the corners
  // and every `every` blocks (posts).
  if (brackets) {
    const every = brackets === true ? 0 : brackets.every ?? 0
    const depth = brackets === true ? 2 : brackets.depth ?? 2
    const set = (x, yy, z, f) => { if (!b.has(x, yy, z)) b.set(x, yy, z, `${rafter.stairs}[facing=${f},half=top]`) }
    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        if (!onWall(x, z)) continue
        for (const [f, dx, dz] of N4) {
          if ((dx === 1 && x !== maxX) || (dx === -1 && x !== minX) || (dz === 1 && z !== maxZ) || (dz === -1 && z !== minZ)) continue
          const u = dx ? z - minZ : x - minX
          const len = dx ? maxZ - minZ : maxX - minX
          const post = u === 0 || u === len || (every > 0 && u % every === 0)
          for (let kk = 1; kk <= (post ? depth : 1); kk += 1) {
            const col = cols.get(K(x + dx * kk, z + dz * kk))
            if (!col || !Number.isFinite(col.bottom) || col.bottom > y + 1) continue
            set(x + dx * kk, col.bottom - 1, z + dz * kk, OPP[f])
          }
        }
      }
    }
  }
  // Lanterns hung under the four corner tips.
  if (lanterns) {
    const id = lanterns === true ? 'minecraft:lantern' : parseBlock(lanterns).name
    for (const [x, z] of [[outline.x0, outline.z0], [outline.x1, outline.z0], [outline.x0, outline.z1], [outline.x1, outline.z1]]) {
      const col = cols.get(K(x, z))
      if (col && Number.isFinite(col.bottom) && !b.has(x, col.bottom - 1, z)) b.set(x, col.bottom - 1, z, `${id}[hanging=true]`)
    }
  }

  const heights = new Map()
  let topY = -Infinity
  for (const [key, col] of cols) {
    heights.set(key, col.y)
    topY = Math.max(topY, col.y)
  }
  // apex: the centre column (hip/pyramid); finial stacked on it
  const cx = Math.floor((outline.x0 + outline.x1) / 2)
  const cz = Math.floor((outline.z0 + outline.z1) / 2)
  const apexCol = cols.get(K(cx, cz))
  const apex = apexCol ? [cx, apexCol.y, cz] : null
  if (finial && apex) {
    const list = Array.isArray(finial) ? finial : [finial]
    list.forEach((paint, i) => b.set(cx, apex[1] + 1 + i, cz, paint))
    topY = Math.max(topY, apex[1] + list.length)
  }
  if (!Number.isFinite(topY)) topY = y
  return {
    topY,
    base,
    y,
    axis,
    type,
    inset: type === 'irimoya' ? inset : undefined,
    levels,
    outline,
    heights,
    cells: cols,
    field: gabF ? { hip: field, gable: gabF } : field,
    apex,
    surface: (x, z) => cols.get(K(x, z))?.top ?? -Infinity,
    bottom: (x, z) => cols.get(K(x, z))?.bottom ?? null,
  }
}

// Pagoda: stacked square storeys, each under a swept skirt that stops at the storey above, a
// pyramid on top and a sorin finial. Numbers from the japanese-shrine pagoda (5 tiers, 48 tall).
//   b.pagoda({ center: [cx, y, cz], tiers: 5, width: 11, overhang: 4, storey: 6,
//              material: 'deepslate_tile', ridge: 'polished_blackstone', rafter: 'spruce',
//              wall: 'calcite', post: 'dark_oak_log', beam: 'stripped_dark_oak_log', lift: 1.5 })
// `y` is the level of the first storey's bottom row (stand the pagoda on a platform below it).
// Body half-widths shrink by one every second storey (W = 5, 4, 4, 3, 3), roof half-widths by one
// per storey (E = 9, 8, 7, 6, 5), so eaves stay deep and the tower tapers. Returns
// { tiers: [{ W, E, floor, top, roof }], apex, topY }.
export function pagoda(b, opts = {}) {
  const {
    center,
    tiers: n = 5,
    width = 11,
    overhang = 4,
    storey = 6,
    taper = 0.5,
    material: mat = 'deepslate_tile',
    ribs,
    ridge,
    rafter = 'spruce',
    wall = 'minecraft:calcite',
    post = 'minecraft:dark_oak_log',
    beam = 'minecraft:stripped_dark_oak_log',
    floor = 'minecraft:dark_oak_planks',
    lattice = 'minecraft:dark_oak_trapdoor',
    door = 'minecraft:ochre_froglight',
    pitch = [0.5, 0.5, 1, 1, 1],
    topPitch,
    lift = 1.5,
    thickness = 1.5,
    brackets = true,
    lanterns = true,
    finial,
  } = opts
  if (!center) throw new Error('pagoda: center [x, y, cz] is required')
  const [cx, y0, cz] = center
  const W0 = Math.floor(width / 2)
  const E0 = W0 + overhang
  const postName = parseBlock(post).name
  const beamName = parseBlock(beam).name
  const latticeName = parseBlock(lattice).name
  const heights = Array.isArray(storey) ? storey : Array.from({ length: n }, (_, i) => (i === n - 1 && n > 2 ? storey - 1 : storey))
  const tiers = []
  let f = y0
  for (let i = 0; i < n; i += 1) {
    const W = Math.max(1, W0 - Math.ceil(i * taper))
    const E = Math.max(W + 1, E0 - i)
    const h = heights[Math.min(i, heights.length - 1)]
    tiers.push({ W, E, floor: f, top: f + h - 1 })
    f += h
  }
  const FACES = [['south', 0, 1, 'x'], ['north', 0, -1, 'x'], ['east', 1, 0, 'z'], ['west', -1, 0, 'z']]
  // Bodies: posts at the corners and flanking a centre bay, a beam row on top, wall between. The
  // ground storey gets a sill, lattice doors over a lit panel in the centre bay; upper storeys a
  // small lattice panel under the beam.
  tiers.forEach((t, i) => {
    const { W } = t
    const p = W >= 5 ? 2 : 1
    if (i > 0) b.box([cx - W + 1, t.floor - 1, cz - W + 1], [cx + W - 1, t.floor - 1, cz + W - 1], floor, { keep: true })
    for (let yy = t.floor; yy <= t.top; yy += 1) {
      const r = t.top - yy
      for (let u = -W; u <= W; u += 1) {
        for (const [fc, nx, nz, ax] of FACES) {
          const x = nx ? cx + nx * W : cx + u
          const z = nz ? cz + nz * W : cz + u
          const centre = Math.abs(u) < p
          let paint = wall
          if (Math.abs(u) === W || Math.abs(u) === p) paint = `${postName}[axis=y]`
          else if (r === 0) paint = `${beamName}[axis=${ax}]`
          else if (i === 0) {
            if (yy === t.floor || r === 3) paint = `${beamName}[axis=${ax}]`
            else if (centre && r > 3) {
              paint = door
              b.set(x + nx, yy, z + nz, `${latticeName}[facing=${fc},open=true,half=bottom]`)
            }
          } else if (centre && (r === 1 || r === 2)) paint = `${latticeName}[facing=${OPP[fc]},open=true,half=bottom]`
          b.set(x, yy, z, paint)
        }
      }
    }
  })
  // Roofs: skirts that stop at the next body, a pyramid on top. Each eave ring sits one below the
  // storey's top beam; the wall-line columns close down onto the beam (rim).
  tiers.forEach((t, i) => {
    const next = tiers[i + 1]
    const last = !next
    const eaveY = t.top - (i === 0 ? 1 : 0)
    t.roof = eastRoof(b, {
      x0: cx - t.W, z0: cz - t.W, x1: cx + t.W, z1: cz + t.W,
      eaveY,
      type: last ? 'pyramid' : 'hip',
      overhang: t.E - t.W,
      pitch: last ? topPitch ?? [...pitch, 2] : pitch,
      stopRing: last ? Infinity : t.E - next.W,
      lift, thickness, material: mat, ribs, ridge, rafter,
      rim: t.top + 1,
      brackets, lanterns,
    })
  })
  // Sorin (finial): a collar of ridge slabs, two ridge blocks, then rings of walls and lightning
  // rods, about a quarter of the pagoda's height.
  const top = tiers[n - 1].roof
  const apexY = top.apex ? top.apex[1] : top.topY
  const ridgeM = roofMaterial(ridge, roofMaterial(mat, 'deepslate_tile'))
  const total = apexY - y0
  let list = finial
  if (list === undefined) {
    const rings = Math.max(4, Math.round(total * 0.22))
    list = [ridgeM.block, ridgeM.block]
    for (let k = 0; k < rings; k += 1) list.push(k === rings - 2 ? 'minecraft:chain' : k % 2 === 0 ? 'minecraft:polished_blackstone_wall' : 'minecraft:lightning_rod')
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) if (dx || dz) b.set(cx + dx, apexY, cz + dz, `${ridgeM.slab}[type=bottom]`, { keep: true })
  }
  if (list) {
    const arr = Array.isArray(list) ? list : [list]
    arr.forEach((paint, k) => b.set(cx, apexY + 1 + k, cz, paint))
  }
  // The shinbashira (central pillar) runs up through the storeys.
  b.box([cx, y0, cz], [cx, tiers[n - 1].top, cz], `${postName}[axis=y]`, { keep: true })
  return { tiers, apex: [cx, apexY, cz], topY: Math.max(top.topY, apexY + (Array.isArray(list) ? list.length : list ? 1 : 0)) }
}

export const EASTROOF_METHODS = { eastRoof, pagoda, rasterRoof }
