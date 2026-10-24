// Deterministic randomness: seeded RNG, coordinate hashes, and smooth gradient noise.
// Use hashes for per-block "white" variation and noise for spatially coherent patches
// (moss streaks, weathering, terrain) — coherent patches read as natural, salt-and-pepper
// white noise reads as static.

// 32-bit integer hash of up to four integers (xxhash-style avalanche).
export function hash(x, y = 0, z = 0, seed = 0) {
  let h = (Math.imul(Math.round(x) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(y) | 0, 0x165667b1) ^ Math.imul(Math.round(z) | 0, 0x9e3779b1) ^ Math.imul(seed | 0, 0x85ebca77)) | 0
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  h ^= h >>> 15
  return h >>> 0
}

// Uniform [0, 1) value for a coordinate.
export const hash01 = (x, y = 0, z = 0, seed = 0) => hash(x, y, z, seed) / 4294967296

// Seeded PRNG (mulberry32). rng() → [0, 1).
export function createRng(seed = 1) {
  let a = (seed | 0) || 0x9e3779b9
  const rng = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  rng.range = (min, max) => min + (max - min) * rng()
  rng.int = (min, max) => Math.floor(min + (max - min + 1) * rng())
  rng.chance = p => rng() < p
  rng.pick = list => list[Math.floor(rng() * list.length)]
  rng.weighted = entries => {
    const total = entries.reduce((sum, [w]) => sum + w, 0)
    let n = rng() * total
    for (const [w, value] of entries) {
      if (n < w) return value
      n -= w
    }
    return entries[entries.length - 1][1]
  }
  rng.shuffle = list => {
    const out = [...list]
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
  rng.gauss = (mean = 0, sd = 1) => {
    const u = Math.max(1e-9, rng())
    const v = rng()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  return rng
}

// ------------------------------------------------------------------ gradient noise

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
]

const permCache = new Map()
function permutation(seed) {
  let perm = permCache.get(seed)
  if (perm) return perm
  const rng = createRng(seed * 7919 + 17)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  perm = new Uint8Array(512)
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255]
  permCache.set(seed, perm)
  return perm
}

const fade = t => t * t * t * (t * (t * 6 - 15) + 10)
const lerp = (a, b, t) => a + (b - a) * t

// Improved Perlin noise in 3D. Returns roughly [-1, 1] (typical |n| < 0.7).
export function perlin3(x, y, z, seed = 0) {
  const perm = permutation(seed)
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const X = xi & 255
  const Y = yi & 255
  const Z = zi & 255
  const g = (h, dx, dy, dz) => {
    const v = GRAD3[h % 12]
    return v[0] * dx + v[1] * dy + v[2] * dz
  }
  const aaa = perm[perm[perm[X] + Y] + Z]
  const aba = perm[perm[perm[X] + Y + 1] + Z]
  const aab = perm[perm[perm[X] + Y] + Z + 1]
  const abb = perm[perm[perm[X] + Y + 1] + Z + 1]
  const baa = perm[perm[perm[X + 1] + Y] + Z]
  const bba = perm[perm[perm[X + 1] + Y + 1] + Z]
  const bab = perm[perm[perm[X + 1] + Y] + Z + 1]
  const bbb = perm[perm[perm[X + 1] + Y + 1] + Z + 1]
  const u = fade(xf)
  const v = fade(yf)
  const w = fade(zf)
  const x1 = lerp(g(aaa, xf, yf, zf), g(baa, xf - 1, yf, zf), u)
  const x2 = lerp(g(aba, xf, yf - 1, zf), g(bba, xf - 1, yf - 1, zf), u)
  const y1 = lerp(x1, x2, v)
  const x3 = lerp(g(aab, xf, yf, zf - 1), g(bab, xf - 1, yf, zf - 1), u)
  const x4 = lerp(g(abb, xf, yf - 1, zf - 1), g(bbb, xf - 1, yf - 1, zf - 1), u)
  const y2 = lerp(x3, x4, v)
  return lerp(y1, y2, w)
}

export const perlin2 = (x, z, seed = 0) => perlin3(x, 0.5, z, seed)

// Fractal Brownian motion: octaves of perlin noise. `scale` is the feature size in blocks.
export function fbm3(x, y, z, { scale = 16, octaves = 4, lacunarity = 2, gain = 0.5, seed = 0 } = {}) {
  let amplitude = 1
  let frequency = 1 / scale
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * perlin3(x * frequency, y * frequency, z * frequency, seed + i * 101)
    norm += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }
  return sum / norm
}

export const fbm2 = (x, z, options) => fbm3(x, 0.5, z, options)

// Ridged multifractal (sharp crests) in [0, 1] — mountain ridges, cracks, veins.
export function ridged2(x, z, { scale = 32, octaves = 4, seed = 0 } = {}) {
  let amplitude = 0.5
  let frequency = 1 / scale
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i += 1) {
    const n = 1 - Math.abs(perlin3(x * frequency, 0.5, z * frequency, seed + i * 131))
    sum += amplitude * n * n
    norm += amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return sum / norm
}

// Maps fbm output (≈ normal, sd ≈ 0.22) to an approximately uniform [0, 1) value so that
// weight-based palettes keep their intended proportions while staying spatially coherent.
export function uniformize(n, sd = 0.22) {
  const x = n / (sd * Math.SQRT2)
  // Abramowitz-Stegun erf approximation.
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  const erf = x >= 0 ? y : -y
  return Math.min(0.999999, Math.max(0, 0.5 * (1 + erf)))
}

// Coherent [0, 1) value at a block: mixes fbm (clusters) with a little hash (grain).
export function coherent01(x, y, z, { scale = 6, grain = 0.15, seed = 0 } = {}) {
  const base = uniformize(fbm3(x, y, z, { scale, octaves: 3, seed }))
  if (grain <= 0) return base
  const mixed = base * (1 - grain) + hash01(x, y, z, seed + 7) * grain
  return Math.min(0.999999, mixed)
}
