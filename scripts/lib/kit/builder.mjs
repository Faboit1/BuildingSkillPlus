// Builder: an in-memory voxel canvas with painting, shape rasterizers, modules and a
// finishing pass that produces a Lodestone Structure ready for run-build.mjs.
//
//   const b = api.builder([48, 32, 48], { seed: 7 })
//   b.box([0, 0, 0], [47, 0, 47], 'grass_block')
//   b.roof({ ... })
//   return b.finish({ name: 'my-build' })

import { Structure } from '@mattzh72/lodestone'
import { isAir, mirrorBlock, parseBlock, rotateBlock, stateString, validateBlock, vanillaStates, withDefaults, withProps } from './blocks.mjs'
import { persistLeaves, updateConnections } from './connect.mjs'
import { completeBlocks } from './fixups.mjs'
import { coherent01, createRng, hash01 } from './noise.mjs'
import { material as materialFamily } from './materials.mjs'
import { AGED_VARIANTS } from './paint.mjs'

const REMOVE = Symbol('remove')

const toInt = v => Math.round(v)

function minMax(a, b) {
  return [
    [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
  ]
}

// Catmull-Rom interpolation through control points.
function catmullRom(points, t) {
  const n = points.length
  if (n === 1) return points[0]
  const segs = n - 1
  const f = Math.min(segs - 1e-9, Math.max(0, t * segs))
  const i = Math.floor(f)
  const u = f - i
  const p0 = points[Math.max(0, i - 1)]
  const p1 = points[i]
  const p2 = points[i + 1]
  const p3 = points[Math.min(n - 1, i + 2)]
  const out = [0, 0, 0]
  for (let k = 0; k < 3; k += 1) {
    out[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u)
  }
  return out
}

function distToSegment(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]
  const t = len2 > 0 ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len2)) : 0
  const dx = ap[0] - ab[0] * t
  const dy = ap[1] - ab[1] * t
  const dz = ap[2] - ab[2] * t
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export class Builder {
  constructor(size, { seed = 1 } = {}) {
    if (!Array.isArray(size) || size.length !== 3 || !size.every(v => Number.isFinite(v) && v > 0)) {
      throw new Error('builder size must be [x, y, z] with positive numbers')
    }
    this.size = size.map(v => Math.trunc(v))
    this.seed = seed
    this.rng = createRng(seed)
    this.blocks = new Map()
    this.clipped = 0
    this.warnings = []
  }

  // ---------------------------------------------------------------- core access

  key(x, y, z) {
    return x + this.size[0] * (z + this.size[2] * y)
  }

  inBounds(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.size[0] && y < this.size[1] && z < this.size[2]
  }

  // Resolves a paint at a position to a block record, REMOVE, or null (leave as is).
  resolve(paint, x, y, z, depth = 0) {
    if (paint === null || paint === undefined || paint === false) return null
    if (depth > 12) throw new Error('paint nesting too deep (function returning itself?)')
    if (typeof paint === 'function') return this.resolve(paint(x, y, z, this), x, y, z, depth + 1)
    if (typeof paint === 'object' && typeof paint.at === 'function') return this.resolve(paint.at(x, y, z, this), x, y, z, depth + 1)
    const block = parseBlock(paint)
    if (isAir(block.name)) return REMOVE
    return block
  }

  // Places a paint at one position. Options:
  //   keep: true → only fill empty positions
  //   only: id | id[] | predicate(block) → only replace existing matching blocks
  //   nbt: NbtCompound block-entity data
  set(x, y, z, paint, opts) {
    x = toInt(x)
    y = toInt(y)
    z = toInt(z)
    if (!this.inBounds(x, y, z)) {
      this.clipped += 1
      // remember where: the warning names the overflow range so it can be fixed quickly
      if (!this.clippedBox) {
        // first overflow: remember the recipe line that caused it (first frame outside the kit)
        const frame = new Error().stack.split('\n').slice(2).find(l => !/scripts[\\/]lib[\\/]kit[\\/]/.test(l) && /\.m?js/.test(l))
        this.clippedFrom = frame?.trim().replace(/^at\s+/, '').replace(/^file:\/\//, '').replace(/\?v=\d+/, '')
      }
      const box = (this.clippedBox ??= { min: [x, y, z], max: [x, y, z] })
      box.min = [Math.min(box.min[0], x), Math.min(box.min[1], y), Math.min(box.min[2], z)]
      box.max = [Math.max(box.max[0], x), Math.max(box.max[1], y), Math.max(box.max[2], z)]
      return this
    }
    const k = this.key(x, y, z)
    if (opts) {
      const existing = this.blocks.get(k)
      if (opts.keep && existing) return this
      if (opts.only !== undefined && !this.matches(existing, opts.only)) return this
      if (opts.mask && !opts.mask(x, y, z, this)) return this
    }
    const block = this.resolve(paint, x, y, z)
    if (block === null) return this
    if (block === REMOVE) {
      this.blocks.delete(k)
      return this
    }
    const nbt = opts?.nbt
    this.blocks.set(k, nbt ? { name: block.name, props: block.props, nbt } : block)
    return this
  }

  matches(block, test) {
    if (!block) return test === null || test === 'air'
    if (typeof test === 'function') return Boolean(test(block))
    const list = Array.isArray(test) ? test : [test]
    return list.some(t => {
      const s = String(t)
      if (s.startsWith('*')) return block.name.endsWith(s.slice(1))
      if (s.endsWith('*')) return block.name.startsWith(s.includes(':') ? s.slice(0, -1) : `minecraft:${s.slice(0, -1)}`)
      return block.name === parseBlock(s).name
    })
  }

  get(x, y, z) {
    x = toInt(x)
    y = toInt(y)
    z = toInt(z)
    if (!this.inBounds(x, y, z)) return null
    return this.blocks.get(this.key(x, y, z)) ?? null
  }

  nameAt(x, y, z) {
    return this.get(x, y, z)?.name ?? null
  }

  has(x, y, z) {
    return this.get(x, y, z) !== null
  }

  // Whether the block at a position matches `test` (id, id list, predicate, null/'air' for empty).
  is(x, y, z, test) {
    return this.matches(this.get(x, y, z), test)
  }

  remove(x, y, z) {
    x = toInt(x)
    y = toInt(y)
    z = toInt(z)
    if (this.inBounds(x, y, z)) this.blocks.delete(this.key(x, y, z))
    return this
  }

  // Raw store interface used by the connection pass.
  put(x, y, z, block) {
    this.blocks.set(this.key(x, y, z), block)
  }

  entries() {
    const out = []
    const [sx, , sz] = this.size
    for (const [k, block] of this.blocks) {
      const x = k % sx
      const rest = (k - x) / sx
      const z = rest % sz
      const y = (rest - z) / sz
      out.push([x, y, z, block])
    }
    return out
  }

  count(test) {
    if (test === undefined) return this.blocks.size
    let n = 0
    for (const block of this.blocks.values()) if (this.matches(block, test)) n += 1
    return n
  }

  // Highest non-empty y in a column (or -1).
  topY(x, z, test) {
    for (let y = this.size[1] - 1; y >= 0; y -= 1) {
      const block = this.get(x, y, z)
      if (block && (test === undefined || this.matches(block, test))) return y
    }
    return -1
  }

  // ---------------------------------------------------------------- regions

  box(a, b, paint, opts) {
    const [min, max] = minMax(a, b)
    for (let y = toInt(min[1]); y <= toInt(max[1]); y += 1)
      for (let z = toInt(min[2]); z <= toInt(max[2]); z += 1)
        for (let x = toInt(min[0]); x <= toInt(max[0]); x += 1) this.set(x, y, z, paint, opts)
    return this
  }

  // Shell of a box (all six faces).
  hollowBox(a, b, paint, opts) {
    const [min, max] = minMax(a, b)
    return this.box(min, max, (x, y, z) => (
      x === min[0] || x === max[0] || y === min[1] || y === max[1] || z === min[2] || z === max[2] ? paint : null
    ), opts)
  }

  // Four vertical walls of a box (no floor/ceiling).
  walls(a, b, paint, opts) {
    const [min, max] = minMax(a, b)
    return this.box(min, max, (x, y, z) => (
      x === min[0] || x === max[0] || z === min[2] || z === max[2] ? paint : null
    ), opts)
  }

  // The 12 edges of a box — timber frames, scaffolds.
  edges(a, b, paint, opts) {
    const [min, max] = minMax(a, b)
    return this.box(min, max, (x, y, z) => {
      const onX = x === min[0] || x === max[0]
      const onY = y === min[1] || y === max[1]
      const onZ = z === min[2] || z === max[2]
      return (onX && onY) || (onX && onZ) || (onY && onZ) ? paint : null
    }, opts)
  }

  clear(a, b) {
    return this.box(a, b, 'minecraft:air')
  }

  // Replace blocks matching `from` (id, id[], wildcard 'oak_*', predicate) inside a box.
  replace(a, b, from, to) {
    return this.box(a, b, to, { only: from })
  }

  // Replace matching blocks everywhere.
  replaceAll(from, to) {
    for (const [x, y, z, block] of this.entries()) {
      if (this.matches(block, from)) this.set(x, y, z, to)
    }
    return this
  }

  // Apply fn(x, y, z, block) to every block; return a paint to change it, null to keep.
  map(fn) {
    for (const [x, y, z, block] of this.entries()) {
      const next = fn(x, y, z, block, this)
      if (next !== null && next !== undefined) this.set(x, y, z, next)
    }
    return this
  }

  // ---------------------------------------------------------------- rasterizers

  // Generic solid rasterizer. inside(x, y, z) → boolean. hollow keeps only voxels with an
  // outside voxel within `thickness` steps along an axis (watertight shells, no pinholes).
  fillWhere(a, b, inside, paint, { hollow = false, thickness = 1, ...opts } = {}) {
    const [min, max] = minMax(a, b)
    const x0 = Math.floor(min[0])
    const y0 = Math.floor(min[1])
    const z0 = Math.floor(min[2])
    const x1 = Math.ceil(max[0])
    const y1 = Math.ceil(max[1])
    const z1 = Math.ceil(max[2])
    const isShell = (x, y, z) => {
      for (let k = 1; k <= thickness; k += 1) {
        if (!inside(x + k, y, z) || !inside(x - k, y, z) || !inside(x, y + k, z) || !inside(x, y - k, z) || !inside(x, y, z + k) || !inside(x, y, z - k)) return true
      }
      return false
    }
    const setOpts = Object.keys(opts).length > 0 ? opts : undefined
    for (let y = y0; y <= y1; y += 1)
      for (let z = z0; z <= z1; z += 1)
        for (let x = x0; x <= x1; x += 1) {
          if (!inside(x, y, z)) continue
          if (hollow && !isShell(x, y, z)) continue
          this.set(x, y, z, paint, setOpts)
        }
    return this
  }

  // Signed-distance rasterizer: fills where sdf(x, y, z) <= 0. Use with kit.sdf helpers.
  sdf(a, b, distance, paint, opts) {
    return this.fillWhere(a, b, (x, y, z) => distance(x, y, z) <= 0, paint, opts)
  }

  // Sphere. Fractional radii (4.5, 6.5) give rounder, symmetric voxel spheres.
  sphere(c, r, paint, opts = {}) {
    return this.ellipsoid(c, [r, r, r], paint, opts)
  }

  ellipsoid(c, radii, paint, opts = {}) {
    const [rx, ry, rz] = radii
    const inside = (x, y, z) => ((x - c[0]) / rx) ** 2 + ((y - c[1]) / ry) ** 2 + ((z - c[2]) / rz) ** 2 <= 1
    return this.fillWhere([c[0] - rx, c[1] - ry, c[2] - rz], [c[0] + rx, c[1] + ry, c[2] + rz], inside, paint, opts)
  }

  // Upper half of an ellipsoid sitting on y = c[1]. opts.height overrides vertical radius.
  dome(c, r, paint, opts = {}) {
    const ry = opts.height ?? r
    const inside = (x, y, z) => y >= c[1] && ((x - c[0]) / r) ** 2 + ((y - c[1]) / ry) ** 2 + ((z - c[2]) / r) ** 2 <= 1
    const { height, ...rest } = opts
    return this.fillWhere([c[0] - r, c[1], c[2] - r], [c[0] + r, c[1] + ry, c[2] + r], (x, y, z) => inside(x, y, z), paint, { ...rest, hollow: rest.hollow, thickness: rest.thickness })
  }

  // Vertical cylinder from base center c=[x,y,z] with height h (y .. y+h-1).
  // opts.axis 'x' | 'z' lays it horizontally (c is then the start of the axis).
  cylinder(c, r, h, paint, opts = {}) {
    const axis = opts.axis ?? 'y'
    const { axis: _axis, ...rest } = opts
    if (axis === 'y') {
      const inside = (x, y, z) => y >= c[1] && y <= c[1] + h - 1 && (x - c[0]) ** 2 + (z - c[2]) ** 2 <= r * r
      return this.fillWhere([c[0] - r, c[1], c[2] - r], [c[0] + r, c[1] + h - 1, c[2] + r], inside, paint, rest.hollow ? { ...rest, hollowCaps: undefined } : rest)
    }
    if (axis === 'x') {
      const inside = (x, y, z) => x >= c[0] && x <= c[0] + h - 1 && (y - c[1]) ** 2 + (z - c[2]) ** 2 <= r * r
      return this.fillWhere([c[0], c[1] - r, c[2] - r], [c[0] + h - 1, c[1] + r, c[2] + r], inside, paint, rest)
    }
    const inside = (x, y, z) => z >= c[2] && z <= c[2] + h - 1 && (x - c[0]) ** 2 + (y - c[1]) ** 2 <= r * r
    return this.fillWhere([c[0] - r, c[1] - r, c[2]], [c[0] + r, c[1] + r, c[2] + h - 1], inside, paint, rest)
  }

  // Tube: cylinder wall only (open top/bottom), thickness in blocks.
  tube(c, r, h, paint, { thickness = 1, ...opts } = {}) {
    const inner = r - thickness
    const inside = (x, y, z) => {
      if (y < c[1] || y > c[1] + h - 1) return false
      const d2 = (x - c[0]) ** 2 + (z - c[2]) ** 2
      return d2 <= r * r
    }
    const ring = (x, z) => {
      const d2 = (x - c[0]) ** 2 + (z - c[2]) ** 2
      if (d2 > r * r) return false
      if (inner <= 0) return true
      // keep voxels with an outside 4-neighbour inside `thickness` → gap-free ring
      for (let k = 1; k <= thickness; k += 1) {
        for (const [dx, dz] of [[k, 0], [-k, 0], [0, k], [0, -k]]) {
          if ((x + dx - c[0]) ** 2 + (z + dz - c[2]) ** 2 > r * r) return true
        }
      }
      return false
    }
    return this.fillWhere([c[0] - r, c[1], c[2] - r], [c[0] + r, c[1] + h - 1, c[2] + r], (x, y, z) => inside(x, y, z) && ring(x, z), paint, opts)
  }

  // Cone from base center c, base radius r, height h (apex at y + h - 1).
  cone(c, r, h, paint, opts = {}) {
    const inside = (x, y, z) => {
      if (y < c[1] || y > c[1] + h - 1) return false
      const rr = r * (1 - (y - c[1]) / h)
      return (x - c[0]) ** 2 + (z - c[2]) ** 2 <= rr * rr + 0.25
    }
    return this.fillWhere([c[0] - r, c[1], c[2] - r], [c[0] + r, c[1] + h - 1, c[2] + r], inside, paint, opts)
  }

  // Horizontal disc at y = c[1]. opts.inner makes an annulus.
  disc(c, r, paint, opts = {}) {
    const inner = opts.inner
    const inside = (x, y, z) => {
      if (y !== c[1]) return false
      const d2 = (x - c[0]) ** 2 + (z - c[2]) ** 2
      return d2 <= r * r && (inner === undefined || inner < 0 || d2 > inner * inner)
    }
    const { inner: _inner, ...rest } = opts
    return this.fillWhere([c[0] - r, c[1], c[2] - r], [c[0] + r, c[1], c[2] + r], inside, paint, rest)
  }

  // Gap-free horizontal ring (outline of a disc), thickness in blocks.
  ring(c, r, paint, { thickness = 1, ...opts } = {}) {
    return this.tube(c, r, 1, paint, { thickness, ...opts })
  }

  // Extruded polygon footprint: points [[x, z], ...] from y0 to y1 inclusive.
  prism(points, y0, y1, paint, opts = {}) {
    const xs = points.map(p => p[0])
    const zs = points.map(p => p[1])
    const insidePoly = (x, z) => {
      let inside = false
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const [xi, zi] = points[i]
        const [xj, zj] = points[j]
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
      }
      return inside
    }
    const inside = (x, y, z) => y >= y0 && y <= y1 && insidePoly(x + 0.5, z + 0.5)
    return this.fillWhere([Math.min(...xs) - 1, y0, Math.min(...zs) - 1], [Math.max(...xs) + 1, y1, Math.max(...zs) + 1], inside, paint, opts)
  }

  // Straight line. radius 0 → one-block line (26-connected by default, `connect: 6` for a
  // face-connected walk that reads as solid); radius > 0 → round capsule (≥ 0.87 stays watertight).
  line(a, b, paint, { radius = 0, connect = 26, ...opts } = {}) {
    if (radius <= 0 && connect === 6) {
      const setOpts = Object.keys(opts).length > 0 ? opts : undefined
      let p = [toInt(a[0]), toInt(a[1]), toInt(a[2])]
      const end = [toInt(b[0]), toInt(b[1]), toInt(b[2])]
      this.set(p[0], p[1], p[2], paint, setOpts)
      let guard = 0
      while ((p[0] !== end[0] || p[1] !== end[1] || p[2] !== end[2]) && guard < 100000) {
        guard += 1
        // step along the axis that keeps the walk closest to the ideal segment
        let best = null
        let bestD = Infinity
        for (let k = 0; k < 3; k += 1) {
          if (p[k] === end[k]) continue
          const q = [...p]
          q[k] += Math.sign(end[k] - p[k])
          const d = distToSegment(q, a, b)
          if (d < bestD) {
            bestD = d
            best = q
          }
        }
        p = best
        this.set(p[0], p[1], p[2], paint, setOpts)
      }
      return this
    }
    if (radius <= 0) {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]))))
      const seen = new Set()
      const setOpts = Object.keys(opts).length > 0 ? opts : undefined
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps
        const p = [toInt(a[0] + (b[0] - a[0]) * t), toInt(a[1] + (b[1] - a[1]) * t), toInt(a[2] + (b[2] - a[2]) * t)]
        const k = p.join(',')
        if (seen.has(k)) continue
        seen.add(k)
        this.set(p[0], p[1], p[2], paint, setOpts)
      }
      return this
    }
    const min = [Math.min(a[0], b[0]) - radius, Math.min(a[1], b[1]) - radius, Math.min(a[2], b[2]) - radius]
    const max = [Math.max(a[0], b[0]) + radius, Math.max(a[1], b[1]) + radius, Math.max(a[2], b[2]) + radius]
    return this.fillWhere(min, max, (x, y, z) => distToSegment([x, y, z], a, b) <= radius, paint, opts)
  }

  // Smooth Catmull-Rom curve through points with a constant or varying radius:
  //   b.curve([[0,0,0],[5,8,2],[9,12,9]], 'oak_log', { radius: t => 2.5 - 2 * t })
  // radius < 0.6 draws a thin face-connected line; tube radii are clamped to ≥ 0.87 so the
  // tube never breaks into diagonal-only contacts. Returns the sampled centreline points.
  curve(points, paint, { radius = 0, samplesPerBlock = 3, ...opts } = {}) {
    if (points.length < 2) throw new Error('curve needs at least two points')
    let length = 0
    for (let i = 1; i < points.length; i += 1) {
      length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2])
    }
    const samples = Math.max(2, Math.ceil(length * samplesPerBlock))
    const centers = []
    for (let i = 0; i <= samples; i += 1) centers.push(catmullRom(points, i / samples))
    if (paint === null) return centers // sample only
    const radiusAt = typeof radius === 'function' ? radius : () => radius
    const setOpts = Object.keys(opts).length > 0 ? opts : undefined
    if (typeof radius !== 'function' && radius < 0.6) {
      for (let i = 1; i < centers.length; i += 1) this.line(centers[i - 1], centers[i], paint, { connect: opts.connect ?? 6, ...opts })
      return centers
    }
    const done = new Set()
    for (let i = 0; i < centers.length; i += 1) {
      const c = centers[i]
      const r = Math.max(0.87, radiusAt(i / samples, c))
      const ri = Math.ceil(r)
      for (let y = Math.floor(c[1] - ri); y <= Math.ceil(c[1] + ri); y += 1)
        for (let z = Math.floor(c[2] - ri); z <= Math.ceil(c[2] + ri); z += 1)
          for (let x = Math.floor(c[0] - ri); x <= Math.ceil(c[0] + ri); x += 1) {
            if ((x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2 > r * r) continue
            const k = `${x},${y},${z}`
            if (done.has(k)) continue
            done.add(k)
            this.set(x, y, z, paint, setOpts)
          }
    }
    return centers
  }

  // ---------------------------------------------------------------- modules

  // Copy another builder into this one at offset `at`, optionally rotated (clockwise
  // quarter turns about the module's own origin) and mirrored. Block states are rotated
  // too, so a window/door module authored facing south can be stamped on any wall.
  stamp(module, at = [0, 0, 0], { rotate = 0, mirror, keep = false, only } = {}) {
    const turns = ((rotate % 4) + 4) % 4
    const [sx, , sz] = module.size
    for (const [x, y, z, block] of module.entries()) {
      let mx = x
      let mz = z
      let state = block
      if (mirror === 'x') {
        mx = sx - 1 - mx
        state = mirrorBlock(state, 'x')
      } else if (mirror === 'z') {
        mz = sz - 1 - mz
        state = mirrorBlock(state, 'z')
      }
      let rx = mx
      let rz = mz
      // clockwise 90° about the module origin: (x, z) → (sz - 1 - z, x)
      let w = sx
      let d = sz
      for (let i = 0; i < turns; i += 1) {
        const nx = d - 1 - rz
        const nz = rx
        rx = nx
        rz = nz
        ;[w, d] = [d, w]
      }
      if (turns) state = rotateBlock(state, turns)
      const opts = keep || only !== undefined || block.nbt ? { keep, only, nbt: block.nbt } : undefined
      this.set(at[0] + rx, at[1] + y, at[2] + rz, state, opts)
    }
    return this
  }

  // New empty builder for authoring a module, sharing this builder's seed.
  module(size) {
    return new Builder(size, { seed: this.seed })
  }

  // ---------------------------------------------------------------- finishing touches

  // Swap a share of blocks for aged variants (cracked/mossy/oxidized) using coherent noise,
  // so wear appears in patches. amount ≈ share of eligible blocks replaced.
  // `share` = fraction of eligible blocks to age (0..1, exact), in organic patches (coherent
  // noise, ranked) with moss and cracks in their own clumps. `amount` is the older raw threshold
  // on blocky noise, kept for existing recipes (0.22 ≈ 10%, 0.38 ≈ 30%, 0.5 ≈ 50%, 0.62 ≈ 70%).
  weather(a, b, { amount = 0.25, share, mossBias = 0.5, scale = 4, seed = 0, variants = AGED_VARIANTS } = {}) {
    const [min, max] = minMax(a, b)
    const eligible = []
    for (const [x, y, z, block] of this.entries()) {
      if (x < min[0] || y < min[1] || z < min[2] || x > max[0] || y > max[1] || z > max[2]) continue
      if (variants[block.name]) eligible.push([x, y, z, block])
    }
    const age = ([x, y, z, block], useMoss) => {
      const options = variants[block.name]
      const target = (useMoss ? options[1] : options[0]) ?? options[0] ?? options[1]
      if (target) this.put(x, y, z, { name: target, props: block.props })
    }
    if (share !== undefined) {
      const s = this.seed + seed
      const ranked = eligible.map(e => [coherent01(e[0], e[1], e[2], { scale: scale * 1.5, grain: 0.2, seed: s }), e]).sort((p, q) => p[0] - q[0])
      const count = Math.round(Math.min(1, Math.max(0, share)) * ranked.length)
      for (let i = 0; i < count; i += 1) {
        const [x, y, z] = ranked[i][1]
        age(ranked[i][1], coherent01(x, y, z, { scale: scale * 2, grain: 0.1, seed: s + 9 }) < mossBias)
      }
      return this
    }
    for (const e of eligible) {
      const [x, y, z] = e
      const n = hash01(Math.floor(x / scale), Math.floor(y / scale), Math.floor(z / scale), seed + this.seed) * 0.6 + hash01(x, y, z, seed + 5) * 0.4
      if (n >= amount) continue
      age(e, hash01(x, y, z, seed + 9) < mossBias)
    }
    return this
  }

  // Retexture blocks in a box with an ordered light→dark ramp (WesterosCraft-style gradient):
  // darker toward the base, at exposed corners/edges and in drip streaks, brighter around
  // focal points, clustered with coherent noise, then an anti-splatter pass keeps
  // neighbouring blocks within `maxStep` ramp steps. Shapes are preserved: a stair stays a
  // stair of the chosen ramp material (ramp entries are material names or full-block ids).
  //   b.texture([x0,y0,z0], [x1,y1,z1], ['polished_andesite','andesite','stone_bricks','tuff_bricks','cobbled_deepslate'],
  //             { only: 'white_wool', base: 0.3, edge: 0.2, focus: [[20, 6, 10]], drip: 0.15 })
  texture(a, c, ramp, opts = {}) {
    const {
      only,
      mid = 0.4,
      base = 0.3,
      top = 0,
      edge = 0.18,
      drip = 0.09,
      dripLength = 4,
      focus = [],
      focusRadius = 6,
      focusAmount = 0.25,
      scale = 6,
      noise = 0.22,
      jitter = 0.06,
      maxStep = 2,
      seed = 0,
    } = opts
    const [min, max] = minMax(a, c)
    const steps = ramp.map(entry => {
      try {
        return materialFamily(entry)
      } catch {
        return { block: parseBlock(entry).name }
      }
    })
    const n = steps.length
    const cells = []
    for (const [x, y, z, block] of this.entries()) {
      if (x < min[0] || y < min[1] || z < min[2] || x > max[0] || y > max[1] || z > max[2]) continue
      if (only !== undefined && !this.matches(block, only)) continue
      cells.push([x, y, z, block])
    }
    if (cells.length === 0 || n === 0) return this
    const h = Math.max(1, max[1] - min[1])
    const solidAt = (x, y, z) => {
      const other = this.get(x, y, z)
      return other !== null && !/(_pane|_bars|_fence|_trapdoor|_door|lantern|torch|_carpet|_button|chain)$/.test(other.name)
    }
    const index = new Map()
    for (const [x, y, z] of cells) {
      const v = (y - min[1]) / h
      let t = mid + base * (1 - v) ** 1.5 - top * v ** 2
      // Corners, wall ends and opening jambs: exposed on two perpendicular axes.
      const openX = !solidAt(x + 1, y, z) || !solidAt(x - 1, y, z)
      const openZ = !solidAt(x, y, z + 1) || !solidAt(x, y, z - 1)
      if (openX && openZ) t += edge
      if (!solidAt(x, y + 1, z)) t += edge * 0.5
      if (drip > 0) {
        const streak = hash01(x, 0, z, seed + 401) < 0.12
        if (streak) {
          let k = 1
          while (k <= dripLength && solidAt(x, y + k, z) && this.matches(this.get(x, y + k, z), only ?? (() => true))) k += 1
          if (k <= dripLength) t += drip * (1 - (k - 1) / dripLength)
        }
      }
      for (const f of focus) {
        const d = Math.hypot(x - f[0], y - f[1], z - f[2])
        if (d < focusRadius) t -= focusAmount * (1 - d / focusRadius)
      }
      t += noise * (coherent01(x, y, z, { scale, grain: 0, seed: seed + 403 }) - 0.5)
      t += jitter * (hash01(x, y, z, seed + 405) - 0.5)
      const i = Math.max(0, Math.min(n - 1, Math.round(Math.max(0, Math.min(1, t)) * (n - 1))))
      index.set(this.key(x, y, z), i)
    }
    // Anti-splatter: pull outliers toward their neighbours.
    for (let pass = 0; pass < 2; pass += 1) {
      for (const [x, y, z] of cells) {
        const k = this.key(x, y, z)
        const i = index.get(k)
        let sum = 0
        let cnt = 0
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          if (!this.inBounds(x + dx, y + dy, z + dz)) continue
          const j = index.get(this.key(x + dx, y + dy, z + dz))
          if (j === undefined) continue
          sum += j
          cnt += 1
        }
        if (cnt === 0) continue
        const avg = sum / cnt
        if (Math.abs(i - avg) > maxStep) index.set(k, Math.round(avg + Math.sign(i - avg) * maxStep))
      }
    }
    // A ramp step without the needed shape (polished_andesite has no wall) uses the nearest step
    // that has it, then the step's listed substitute; only if nothing fits is the block kept.
    const shapeAt = (i, kind) => {
      for (let d = 0; d < n; d += 1) {
        for (const j of d === 0 ? [i] : [i - d, i + d]) {
          if (j < 0 || j >= n) continue
          const t = steps[j][kind] ?? (kind === 'block' ? steps[j].block : null)
          if (t) return parseBlock(t).name
        }
      }
      return steps[i].substitutes?.[kind]?.[0] ?? null
    }
    // keep only the properties the new block has (a log's axis must not land on planks)
    const fitProps = (name, props) => {
      const v = vanillaStates()?.blocks[parseBlock(name).name]?.v
      if (!v || !props) return props ?? {}
      return Object.fromEntries(Object.entries(props).filter(([k]) => k in v))
    }
    let kept = 0
    for (const [x, y, z, block] of cells) {
      const kind = /_stairs$/.test(block.name) ? 'stairs' : /_slab$/.test(block.name) ? 'slab' : /_wall$/.test(block.name) ? 'wall'
        : /_(log|wood|stem|hyphae)$/.test(block.name) ? 'log' : 'block'
      // logs stay logs: a ramp step without one borrows the nearest step's log, else the block is kept
      const target = shapeAt(index.get(this.key(x, y, z)), kind)
      if (!target) {
        kept += 1
        continue
      }
      const props = fitProps(target, block.props)
      this.put(x, y, z, block.nbt ? { name: target, props, nbt: block.nbt } : { name: target, props })
    }
    if (kept > 0) this.warnings.push(`texture: ${kept} block(s) kept their original material (no ramp step has that shape)`)
    return this
  }

  // Bounding box of placed blocks: { min, max } (inclusive) or null.
  bounds() {
    if (this.blocks.size === 0) return null
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (const [x, y, z] of this.entries()) {
      if (x < min[0]) min[0] = x
      if (y < min[1]) min[1] = y
      if (z < min[2]) min[2] = z
      if (x > max[0]) max[0] = x
      if (y > max[1]) max[1] = y
      if (z > max[2]) max[2] = z
    }
    return { min, max }
  }

  // Produces { structure, metadata } for run-build.mjs. Options:
  //   name, description: metadata
  //   connections (default true): vanilla stair shapes, walls, fences, panes, gates
  //   persistentLeaves (default true): leaves won't decay in game
  //   validate (default true): warn about unknown ids / invalid state values
  //   trim (default false): shrink the structure to the placed blocks' bounds
  finish({ name, description, connections = true, persistentLeaves = true, validate = true, trim = false, strict = false, ...metadata } = {}) {
    const report = { blocks: 0, connectionsUpdated: 0, leavesPersisted: 0, clipped: this.clipped, problems: [] }
    if (validate) {
      const checked = new Set()
      for (const block of this.blocks.values()) {
        const key = stateString(block)
        if (checked.has(key)) continue
        checked.add(key)
        for (const problem of validateBlock(block)) report.problems.push(problem)
      }
    }
    // Complete every state with vanilla defaults (the previewer needs explicit values).
    for (const [k, block] of this.blocks) {
      const full = withDefaults(block)
      if (full !== block && full.props !== block.props) this.blocks.set(k, block.nbt ? { ...full, nbt: block.nbt } : full)
    }
    report.completed = completeBlocks(this)
    if (connections) report.connectionsUpdated = updateConnections(this)
    if (persistentLeaves) report.leavesPersisted = persistLeaves(this)
    let offset = [0, 0, 0]
    let size = this.size
    if (trim) {
      const box = this.bounds()
      if (box) {
        offset = box.min
        size = [box.max[0] - box.min[0] + 1, box.max[1] - box.min[1] + 1, box.max[2] - box.min[2] + 1]
      }
    }
    const structure = new Structure(size)
    const seenStates = new Set()
    for (const [x, y, z, block] of this.entries()) {
      seenStates.add(stateString(block))
      structure.addBlock([x - offset[0], y - offset[1], z - offset[2]], block.name, block.props ?? undefined, block.nbt)
    }
    report.blocks = this.blocks.size
    report.palette = seenStates.size
    if (report.problems.length > 0) {
      const message = `builder: ${report.problems.length} block-state problem(s):\n  ${report.problems.slice(0, 25).join('\n  ')}`
      if (strict) throw new Error(message)
      console.warn(message)
    }
    // hanging lanterns must hang from something: walk up the chain to its anchor
    let floating = 0
    let firstFloating
    for (const [x, y, z, blk] of this.entries()) {
      if (!/lantern$/.test(blk.name) || blk.props?.hanging !== 'true') continue
      // vertical chains carry it up to the anchor; a horizontal chain has no bottom face to hang from
      let yy = y + 1
      while (this.get(x, yy, z)?.name === 'minecraft:chain' && (this.get(x, yy, z).props?.axis ?? 'y') === 'y') yy += 1
      const above = this.get(x, yy, z)
      const horizontalChain = above?.name === 'minecraft:chain' && above.props?.axis !== 'y'
      if (yy < this.size[1] && (!above || horizontalChain)) {
        floating += 1
        firstFloating ??= [x, y, z]
      }
    }
    if (floating > 0) this.warnings.push(`${floating} hanging lantern(s) hang from air, e.g. at ${firstFloating.join(',')} (the chain needs a block above it)`)
    for (const warning of this.warnings) console.warn(`builder: ${warning}`)
    report.warnings = this.warnings
    if (this.clipped > 0) {
      const { min, max } = this.clippedBox
      const sides = []
      for (const [i, axis] of ['x', 'y', 'z'].entries()) {
        if (min[i] < 0) sides.push(`${axis} down to ${min[i]}`)
        if (max[i] >= this.size[i]) sides.push(`${axis} up to ${max[i]} (size ${this.size[i]})`)
      }
      const from = this.clippedFrom ? `; first from ${this.clippedFrom}` : ''
      console.warn(`builder: ${this.clipped} placement(s) fell outside the ${this.size.join('x')} canvas and were skipped (${sides.join(', ')}${from})`)
      report.clippedRange = { min, max }
      if (this.clippedFrom) report.clippedFrom = this.clippedFrom
    }
    return {
      structure,
      metadata: {
        ...metadata,
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
        blockStatesUpdated: connections,
        builderReport: report,
      },
    }
  }
}

// Convenience used by kit helpers that want a state with extra props.
export { withProps }
