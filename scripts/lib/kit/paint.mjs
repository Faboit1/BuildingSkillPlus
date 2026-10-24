// Paints: anything that decides which block goes at a coordinate.
// A paint is a block string ('minecraft:stone_bricks'), a block record, a function
// (x, y, z, builder) => paint | null, or one of the helpers below. Paints nest, so a
// gradient can be made of palettes, and a palette entry can be a function.

import { coherent01, hash01 } from './noise.mjs'

function normalizeEntries(entries) {
  if (Array.isArray(entries)) {
    return entries.map(entry => (Array.isArray(entry) ? [Number(entry[0]), entry[1]] : [1, entry]))
  }
  return Object.entries(entries).map(([block, weight]) => [Number(weight), block])
}

function pickWeighted(entries, total, u) {
  let n = u * total
  for (const [weight, block] of entries) {
    if (n < weight) return block
    n -= weight
  }
  return entries[entries.length - 1][1]
}

// Weighted block mix.
//   palette([[6, 'stone_bricks'], [2, 'cracked_stone_bricks'], [1, 'mossy_stone_bricks']])
//   palette({ stone_bricks: 6, andesite: 2 }, { scale: 4 })
// Options:
//   scale (default 3): clump size in blocks; 0 = per-block white noise.
//   grain (default 0.25): share of per-block randomness mixed into clumps.
//   seed: decorrelates two palettes used on the same area.
export function palette(entries, { scale = 3, grain = 0.25, seed = 0 } = {}) {
  const list = normalizeEntries(entries).filter(([w]) => w > 0)
  if (list.length === 0) throw new Error('palette needs at least one entry with positive weight')
  const total = list.reduce((sum, [w]) => sum + w, 0)
  const fn = (x, y, z) => {
    const u = scale > 0 ? coherent01(x, y, z, { scale, grain, seed }) : hash01(x, y, z, seed + 3)
    return pickWeighted(list, total, u)
  }
  fn.entries = list
  return fn
}

// Blend between paints along an axis or any scalar field.
//   gradient(['mossy_cobblestone', 'cobblestone', 'stone_bricks', 'polished_andesite'], { axis: 'y', from: 0, to: 12 })
//   gradient([...], { t: (x, y, z) => distance / radius })
// dither (0..1, default 0.6) roughens the borders between bands with coherent noise so
// they read as natural transitions rather than stripes; 0 gives hard bands.
export function gradient(stops, { axis = 'y', from = 0, to = 16, t, dither = 0.6, scale = 2.5, seed = 0 } = {}) {
  if (!Array.isArray(stops) || stops.length === 0) throw new Error('gradient needs a non-empty array of stops')
  const n = stops.length
  const field = t ?? ((x, y, z) => {
    const v = axis === 'x' ? x : axis === 'z' ? z : y
    return (v - from) / (to - from || 1)
  })
  return (x, y, z, builder) => {
    let value = field(x, y, z, builder)
    if (!Number.isFinite(value)) return null
    if (dither > 0 && n > 1) value += (coherent01(x, y, z, { scale, grain: 0.35, seed: seed + 11 }) - 0.5) * dither / (n - 1) * 1.6
    const index = Math.max(0, Math.min(n - 1, Math.floor(value * n)))
    return stops[index]
  }
}

// Choose between two paints with a coherent noise mask: `amount` is the share of `b`.
export function blend(a, b, amount = 0.3, { scale = 5, grain = 0.2, seed = 0 } = {}) {
  return (x, y, z) => (coherent01(x, y, z, { scale, grain, seed: seed + 23 }) < amount ? b : a)
}

// Repeating pattern by coordinates, e.g. checkerboards or banding:
//   pattern((x, y, z) => (x + z) % 2, ['white_concrete', 'black_concrete'])
export function pattern(indexFn, paints) {
  return (x, y, z, builder) => {
    const i = indexFn(x, y, z, builder)
    if (i === null || i === undefined) return null
    return paints[((Math.floor(i) % paints.length) + paints.length) % paints.length]
  }
}

// Horizontal bands every `period` blocks (string courses, log rings, copper banding).
export function bands(base, band, { period = 4, offset = 0, width = 1, axis = 'y' } = {}) {
  return (x, y, z) => {
    const v = axis === 'x' ? x : axis === 'z' ? z : y
    return (((v - offset) % period) + period) % period < width ? band : base
  }
}

// Aged variants for common building blocks. Used by builder.weather().
export const AGED_VARIANTS = {
  'minecraft:stone_bricks': ['minecraft:cracked_stone_bricks', 'minecraft:mossy_stone_bricks'],
  'minecraft:stone_brick_stairs': [null, 'minecraft:mossy_stone_brick_stairs'],
  'minecraft:stone_brick_slab': [null, 'minecraft:mossy_stone_brick_slab'],
  'minecraft:stone_brick_wall': [null, 'minecraft:mossy_stone_brick_wall'],
  'minecraft:cobblestone': [null, 'minecraft:mossy_cobblestone'],
  'minecraft:cobblestone_stairs': [null, 'minecraft:mossy_cobblestone_stairs'],
  'minecraft:cobblestone_slab': [null, 'minecraft:mossy_cobblestone_slab'],
  'minecraft:cobblestone_wall': [null, 'minecraft:mossy_cobblestone_wall'],
  'minecraft:deepslate_bricks': ['minecraft:cracked_deepslate_bricks', null],
  'minecraft:deepslate_tiles': ['minecraft:cracked_deepslate_tiles', null],
  'minecraft:polished_blackstone_bricks': ['minecraft:cracked_polished_blackstone_bricks', null],
  'minecraft:nether_bricks': ['minecraft:cracked_nether_bricks', null],
  'minecraft:end_stone_bricks': [null, null],
  'minecraft:copper_block': ['minecraft:exposed_copper', 'minecraft:weathered_copper'],
  'minecraft:cut_copper': ['minecraft:exposed_cut_copper', 'minecraft:weathered_cut_copper'],
  'minecraft:cut_copper_stairs': ['minecraft:exposed_cut_copper_stairs', 'minecraft:weathered_cut_copper_stairs'],
  'minecraft:cut_copper_slab': ['minecraft:exposed_cut_copper_slab', 'minecraft:weathered_cut_copper_slab'],
  'minecraft:exposed_copper': ['minecraft:weathered_copper', 'minecraft:oxidized_copper'],
  'minecraft:weathered_copper': ['minecraft:oxidized_copper', 'minecraft:oxidized_copper'],
}
