// The building kit exposed to recipes as `api.kit` and `api.builder(size, opts)`.
// Reference: references/kit-api.md. Guide: references/building/README.md.

import * as blocks from './blocks.mjs'
import { ARCH_METHODS, onionProfile } from './arch.mjs'
import { Builder } from './builder.mjs'
import { FOREST_METHODS } from './forest.mjs'
import { IMPORT_METHODS } from './importer.mjs'
import * as colors from './colors.mjs'
import * as materials from './materials.mjs'
import { NATURE_METHODS, TREE_SPECIES } from './nature.mjs'
import * as noise from './noise.mjs'
import * as paint from './paint.mjs'
import * as plan from './plan.mjs'
import { ROOFPLAN_METHODS } from './roofplan.mjs'
import { EROSION_PRESETS, SCULPT_METHODS, centripetalCatmullRom, sdEllipsoid, sdTaper } from './sculpt.mjs'

for (const [name, fn] of Object.entries({ ...ARCH_METHODS, ...ROOFPLAN_METHODS, ...NATURE_METHODS, ...FOREST_METHODS, ...plan.PLAN_METHODS, ...SCULPT_METHODS, ...IMPORT_METHODS })) {
  Builder.prototype[name] = function method(...args) {
    return fn(this, ...args)
  }
}

// Signed distance functions (negative inside) for b.sdf(min, max, fn, paint).
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z)
export const sdf = {
  sphere: (c, r) => (x, y, z) => len3(x - c[0], y - c[1], z - c[2]) - r,
  // Quilez bound: close to the true distance, so smooth unions of ellipsoids blend evenly
  ellipsoid: (c, radii) => (x, y, z) => sdEllipsoid([x, y, z], c, radii),
  // capsule from a to b whose radius tapers linearly from r0 to r1 (limbs, branches, horns)
  taper: (a, b, r0, r1) => (x, y, z) => sdTaper([x, y, z], a, b, r0, r1),
  box: (min, max) => (x, y, z) => {
    const cx = (min[0] + max[0]) / 2
    const cy = (min[1] + max[1]) / 2
    const cz = (min[2] + max[2]) / 2
    const qx = Math.abs(x - cx) - (max[0] - min[0]) / 2
    const qy = Math.abs(y - cy) - (max[1] - min[1]) / 2
    const qz = Math.abs(z - cz) - (max[2] - min[2]) / 2
    return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0)
  },
  capsule: (a, b, r) => (x, y, z) => {
    const pa = [x - a[0], y - a[1], z - a[2]]
    const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const h = Math.max(0, Math.min(1, (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / (ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2 || 1)))
    return len3(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h) - (typeof r === 'function' ? r(h) : r)
  },
  cylinder: (c, r, h) => (x, y, z) => {
    const d = Math.hypot(x - c[0], z - c[2]) - r
    const dy = Math.abs(y - (c[1] + h / 2)) - h / 2
    return Math.min(Math.max(d, dy), 0) + Math.hypot(Math.max(d, 0), Math.max(dy, 0))
  },
  torus: (c, R, r) => (x, y, z) => Math.hypot(Math.hypot(x - c[0], z - c[2]) - R, y - c[1]) - r,
  union: (...fs) => (x, y, z) => Math.min(...fs.map(f => f(x, y, z))),
  intersect: (...fs) => (x, y, z) => Math.max(...fs.map(f => f(x, y, z))),
  subtract: (a, b) => (x, y, z) => Math.max(a(x, y, z), -b(x, y, z)),
  // Smooth union: blends shapes with a fillet of size k (organic joins, tree roots, rocks).
  smoothUnion: (k, ...fs) => (x, y, z) => fs.map(f => f(x, y, z)).reduce((d1, d2) => {
    const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (d2 - d1)) / k))
    return d2 * (1 - h) + d1 * h - k * h * (1 - h)
  }),
  // Displace a shape's surface with fbm noise of `amount` blocks.
  displace: (f, amount = 1.5, scale = 6, seed = 0) => (x, y, z) => f(x, y, z) + amount * noise.fbm3(x, y, z, { scale, octaves: 3, seed }),
  shell: (f, thickness = 1) => (x, y, z) => Math.abs(f(x, y, z)) - thickness / 2,
}

export function createKit() {
  return {
    Builder,
    builder: (size, opts) => new Builder(size, opts),
    // blocks & states
    blocks,
    parse: blocks.parseBlock,
    state: blocks.stateString,
    rotate: blocks.rotateBlock,
    mirror: blocks.mirrorBlock,
    exists: blocks.blockExists,
    validate: blocks.validateBlock,
    DIR: blocks.DIR,
    HORIZONTAL: blocks.HORIZONTAL,
    cw: blocks.cw,
    ccw: blocks.ccw,
    opposite: blocks.opposite,
    facingFrom: blocks.facingFrom,
    // materials
    material: materials.material,
    variant: materials.variant,
    stairs: materials.stairs,
    slab: materials.slab,
    trapdoor: materials.trapdoor,
    log: materials.log,
    gate: materials.gate,
    // paints
    palette: paint.palette,
    gradient: paint.gradient,
    blend: paint.blend,
    pattern: paint.pattern,
    bands: paint.bands,
    AGED_VARIANTS: paint.AGED_VARIANTS,
    // colours (measured from the vanilla 1.21.1 textures; see references/building/block-colors.md)
    colors,
    colorOf: colors.colorOf,
    nearestBlock: colors.nearest,
    ramp: colors.ramp,
    sortByLightness: colors.sortByLightness,
    contrast: colors.contrast,
    paletteReport: colors.paletteReport,
    // noise & randomness
    noise,
    rng: noise.createRng,
    hash01: noise.hash01,
    // settlement planning (roads, lots, curtain walls, plazas, skyline report): composition.md
    plan,
    // shapes
    sdf,
    catmullRom: centripetalCatmullRom,
    EROSION_PRESETS,
    onionProfile,
    TREE_SPECIES,
  }
}
