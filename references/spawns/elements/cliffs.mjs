// CLIFFS AND MOUNTAINS: A BIG ROCK LANDMARK. Read this, look at img/cliffs.png, then shape your own
// for the spawn: another outline, other peak heights, the theme's stones, its own ledges and plants.
// A massif stands free (behind the hero, at the end of an axis); a cliff walls one side of the spawn.
//
// DO
// - A skyline of 2-4 peaks of different heights with saddles between them: one steep face toward the
//   players, longer slopes behind. The highest peak is 25-45 tall, the others 0.5-0.8 of it.
// - Strata: bands 1-5 rows thick in 4-6 stones of one family (darker and heavier at the foot, lighter
//   above, a thin pale band every 8-12 rows), tilted a few degrees and wandering with noise.
// - Hard bands stand out 1-2 blocks and soft ones sink back 1-2: that is what makes the lips,
//   overhangs and ledges. Never a smooth face.
// - Benches every 6-9 rows of height with soil on them: grass, moss, bushes and small trees leaning
//   out to the light, in clumps; vines and roots hanging over their lips. Bare rock between.
// - Vertical cracks and gullies cut 2-4 deep into the face, a fan of scree under each.
// - A scree slope at the foot: gravel and the cliff's own stones, highest under the face, frayed into
//   the grass, with boulders on it and plants creeping over its edge.
// - Rock that goes on into the ground: the foot is buried, never set on the grass.
// - Optional: a cave mouth at the foot (dark inside, roots and vines on its lip), a snowline.
// DON'T
// - A noise blob or a smooth cone of one stone.
// - A vertical wall of stone with a flat top: no ledges, no foot, no skyline.
// - Speckle (stone per block at random), rainbow bands of unrelated stones, grass on vertical faces.
// - The same peak copied in a row, or every ledge the same width at the same height.

import { groundPatch } from './_scene.mjs'
import { bush } from './trees.mjs'

// The rock of a theme, from the foot up. Each band: a clumped mix, how far it stands out (+) or sinks
// back (-) from the face in blocks, and its thickness in rows. `accent` is the thin pale band put in
// every 8-12 rows; `scree` the loose stuff at the foot (`slabs` the half steps on it); `soil` the top
// of the ledges; `trees` the small trees on them.
export const STRATA = {
  grey: {
    foot: [[{ deepslate: 5, cobbled_deepslate: 1 }, 1.2, [3, 4]], [{ tuff: 4, andesite: 1 }, -1.2, [2, 3]]],
    body: [
      [{ stone: 5, andesite: 1 }, 0.8, [3, 5]],
      [{ tuff: 1 }, -1.2, [2, 3]],
      [{ andesite: 4, stone: 1 }, 0.5, [3, 4]],
      [{ tuff: 2, cobbled_deepslate: 1 }, -1, [1, 2]],
    ],
    cap: [[{ stone: 4, andesite: 3 }, 0.8, [3, 4]], [{ andesite: 3, diorite: 1 }, -0.6, [2, 3]]],
    accent: [[{ calcite: 3, diorite: 1 }, 0.8]],
    scree: { gravel: 5, andesite: 3, cobblestone: 2, tuff: 1 },
    slabs: ['andesite', 'cobblestone', 'tuff'],
    soil: { grass_block: 10, moss_block: 2, coarse_dirt: 1, podzol: 1 },
    trees: ['spruce', 'oak', 'spruce', 'spruce'],
  },
  // a desert mesa: terracotta bands, red sand at the foot, dead bushes on the benches
  mesa: {
    foot: [[{ terracotta: 3, brown_terracotta: 1 }, 1, [3, 4]], [{ red_terracotta: 1 }, -1, [2, 3]]],
    body: [
      [{ orange_terracotta: 1 }, 1, [2, 4]],
      [{ white_terracotta: 1 }, -0.8, [1, 2]],
      [{ red_terracotta: 3, terracotta: 1 }, 1, [3, 4]],
      [{ yellow_terracotta: 1 }, -1.2, [1, 2]],
      [{ light_gray_terracotta: 1 }, 0.6, [2, 3]],
      [{ brown_terracotta: 1 }, -1, [1, 2]],
    ],
    cap: [[{ red_sandstone: 3, smooth_red_sandstone: 1 }, 1.6, [2, 3]], [{ orange_terracotta: 1 }, -0.8, [2, 3]]],
    accent: [[{ white_terracotta: 1 }, 1.2]],
    scree: { red_sand: 4, terracotta: 1, coarse_dirt: 1 },
    slabs: ['red_sandstone', 'smooth_red_sandstone'],
    soil: { coarse_dirt: 3, red_sand: 2, grass_block: 1 },
    trees: [],
    green: false, // no bushes, vines, moss or roots: dead bushes on the benches
  },
  // a dark crag: deepslate, basalt and blackstone, tuff between
  dark: {
    foot: [[{ deepslate: 3, cobbled_deepslate: 1 }, 1.2, [3, 5]], [{ tuff: 1 }, -1.2, [2, 3]]],
    body: [
      [{ smooth_basalt: 3, deepslate: 1 }, 1, [3, 5]],
      [{ tuff: 3, cobbled_deepslate: 1 }, -1, [2, 3]],
      [{ blackstone: 4, basalt: 1 }, 0.8, [2, 4]],
    ],
    cap: [[{ deepslate: 3, tuff: 1 }, 0.8, [3, 4]], [{ cobbled_deepslate: 1 }, -0.6, [2, 3]]],
    accent: [[{ calcite: 1 }, 1.2]],
    scree: { gravel: 3, cobbled_deepslate: 2, tuff: 2, basalt: 1 },
    slabs: ['cobbled_deepslate', 'tuff', 'blackstone'],
    soil: { podzol: 3, moss_block: 2, grass_block: 3, coarse_dirt: 1 },
    trees: ['spruce'],
  },
}

const FACES = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }
const clamp01 = v => Math.max(0, Math.min(1, v))
const smax = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.max(a, b) + (h * h * k) / 4
}

// A MASSIF: a free-standing group of peaks. Its steep face looks `face` (toward the players).
//   cx, cz, y      the middle and the ground block level it stands on (rock goes 2 below it)
//   height         the highest peak above y (25-45); radius: half its width (the rock spans ~1.4x)
//   peaks          [{ u, v, h, r, p }] to place the peaks yourself (u across the face, v toward the
//                  players, both in radii; h, r in shares of height and radius; p the profile)
//   terrace        rows between benches (6-10); seed
//   and the rock options of rockMass below: strata, dip, cracks, cave, snow, plants, trees, scree.
// Returns topY(x, z): the highest block of rock or soil in that column (-1 off the rock).
export function massif(ctx, { cx = ctx.C[0], cz = ctx.C[1], y = ctx.FY, height = 36, radius = 26, face = 'south', peaks, seed = 1, terrace = 9, ...rest } = {}) {
  const { kit } = ctx
  const rng = kit.rng(seed * 31 + 7)
  const [fx, fz] = FACES[face]
  const [ux, uz] = [-fz, fx] // across the face
  // the shape, in face terms (u across, v toward the players): a broad plinth with steep sides (its
  // top is the grassy shoulder a third of the way up), and towers rising from it, each its own height
  // and width, the highest a little behind the middle. p: the profile (lower = steeper walls).
  const list = peaks ?? [
    { u: 0, v: 0.12, h: 0.22, r: 0.85, p: 0.22 },
    { u: rng.range(-0.06, 0.06), v: -0.1, h: 1, r: 0.44, p: 0.55 },
    { u: rng.range(-0.66, -0.58), v: rng.range(-0.04, 0.06), h: rng.range(0.6, 0.68), r: 0.34, p: 0.5 },
    { u: rng.range(0.56, 0.64), v: rng.range(-0.2, -0.1), h: rng.range(0.76, 0.84), r: 0.36, p: 0.5 },
    { u: rng.range(0, 0.25), v: -0.62, h: rng.range(0.5, 0.58), r: 0.45, p: 0.5 },
  ]
  const P = list.map(q => ({ x: cx + (q.u * ux + q.v * fx) * radius, z: cz + (q.u * uz + q.v * fz) * radius, h: q.h * height, r: q.r * radius, p: q.p ?? 0.55 }))
  const F = (x, z) => {
    let f = 0
    for (const q of P) {
      const du = (x - q.x) * ux + (z - q.z) * uz
      const dv = (x - q.x) * fx + (z - q.z) * fz
      // steeper toward the players, longer behind; lobed, not round (buttresses and bays run down)
      const t = Math.hypot(du / q.r, dv / (q.r * (dv > 0 ? 0.6 : 1.25))) * (1 + 0.22 * kit.noise.fbm2(x, z, { scale: 7, seed: seed + 30 }))
      if (t < 1) f = smax(f, q.h * (1 - t) ** q.p, 4)
    }
    // pinnacles on the summits
    if (f > height * 0.5) f += 0.16 * height * (kit.noise.ridged2(x, z, { scale: 7, octaves: 2, seed }) - 0.55) * ((f - height * 0.5) / (height * 0.5)) ** 1.5
    return f
  }
  const R = Math.ceil(radius * 1.45)
  return rockMass(ctx, { F, box: [cx - R, cz - R, cx + R, cz + R], y, seed, height, terrace, face, ...rest })
}

// A CLIFF: an escarpment along one side of a box, its face looking `face` (toward the players): a
// steep wall 0.4-0.55 of the height, with 2-4 summits of different heights set back on it, falling
// away behind. Same strata, ledges and dressing as the massif.
export function cliff(ctx, { x0, z0, x1, z1, y = ctx.FY, height = 30, face = 'south', seed = 1, terrace = 9, summits, ...rest } = {}) {
  const { kit } = ctx
  const rng = kit.rng(seed * 37 + 11)
  const [fx, fz] = FACES[face]
  const alongX = fx === 0
  const [a0, a1] = alongX ? [x0, x1] : [z0, z1]
  const front = fz > 0 ? z1 : fz < 0 ? z0 : fx > 0 ? x1 : x0
  const depth = alongX ? z1 - z0 : x1 - x0
  const len = a1 - a0
  // the summits: along the face (a) and set back from it (v), each its own height and width
  const n = Math.max(2, Math.min(4, Math.round(len / 28)))
  const heights = rng.shuffle([1, 0.72, 0.86, 0.64].slice(0, n)) // the highest is not always first
  const tops = summits ?? heights.map((k, i) => ({
    a: a0 + ((i + 0.5) / n + rng.range(-0.08, 0.08)) * len,
    v: depth * rng.range(0.3, 0.45),
    h: height * k * rng.range(0.92, 1.05),
    r: Math.min(len / n, depth) * rng.range(0.42, 0.55),
  }))
  const F = (x, z) => {
    const a = alongX ? x : z
    const v = (front - (alongX ? z : x)) * (fz + fx) // depth behind the face line
    const edge = v - 3 * kit.noise.fbm2(a, 0, { scale: 12, seed }) // the foot wanders
    if (edge < 0) return 0
    const ends = clamp01((a - a0) / 8) * clamp01((a1 - a) / 8)
    const wall = height * (0.44 + 0.1 * kit.noise.fbm2(a, 3, { scale: 16, seed: seed + 1 })) * clamp01(edge / 5) ** 0.5 * clamp01((depth - v) / (depth * 0.4))
    let f = wall
    for (const t of tops) {
      const d = Math.hypot((a - t.a) / t.r, (v - t.v) / (t.r * (v < t.v ? 0.7 : 1.2))) * (1 + 0.2 * kit.noise.fbm2(x, z, { scale: 7, seed: seed + 30 }))
      if (d < 1) f = smax(f, t.h * (1 - d) ** 0.55, 4)
    }
    if (f > height * 0.5) f += 0.16 * height * (kit.noise.ridged2(x, z, { scale: 7, octaves: 2, seed }) - 0.55) * ((f - height * 0.5) / (height * 0.5)) ** 1.5
    return f * ends
  }
  return rockMass(ctx, { F, box: [x0, z0, x1, z1], y, seed, height, terrace, face, ...rest })
}

// THE ROCK. F(x, z) is the silhouette (the rock's height above y there); this cuts it into strata,
// pushes the hard bands out and the soft ones in, cuts cracks and a cave, then dresses it.
//   strata   'grey' | 'mesa' | 'dark' or your own { foot, body, cap, accent, scree, slabs, soil, trees }
//   dip      [dx, dz]: how much the bands climb per block east and south (0.1-0.25 reads as a tilt)
//   cracks   how many (default by size); cave: true for a mouth at the foot of the highest face
//   snow     rows above y where snow starts on the tops (null: none); plants: false for bare rock
//   trees    how many small trees on the ledges (default by ledge area); scree: false for none
function rockMass(ctx, { F, box, y: base, seed, height, terrace, face, strata = 'grey', dip = [0.2, -0.06], cracks, cave = false, snow = null, plants = true, trees, scree = true }) {
  const { b, kit, S } = ctx
  const theme = typeof strata === 'string' ? STRATA[strata] : strata
  const rng = kit.rng(seed * 13 + 1)
  const [fx, fz] = FACES[face]
  // the working grid: the box plus room for the scree, inside the canvas
  const X0 = Math.max(0, box[0] - 12)
  const Z0 = Math.max(0, box[1] - 12)
  const X1 = Math.min(S - 1, box[2] + 12)
  const Z1 = Math.min(S - 1, box[3] + 12)
  const W = X1 - X0 + 1
  const D = Z1 - Z0 + 1
  const col = (x, z) => x - X0 + W * (z - Z0)

  // 1. the silhouette, with crags and benches. Benches: the height is stepped every `terrace` rows
  // (pushed up and down by noise), flat for a while then steep: risers and ledges.
  const top = new Float32Array(W * D)
  let fMax = 0
  for (let z = Z0; z <= Z1; z += 1)
    for (let x = X0; x <= X1; x += 1) {
      let f = F(x, z)
      if (f > 0) {
        // benches: within each step of height the slope is flat for 70% and a near-vertical riser
        // for 30%; the step and the bench heights wander with noise
        const step = terrace * (1 + 0.3 * kit.noise.fbm2(x, z, { scale: 20, seed: seed + 4 }))
        const t = (f + 2 * kit.noise.fbm2(x, z, { scale: 9, seed: seed + 5 })) / step
        const benched = (Math.floor(t) + clamp01((t - Math.floor(t) - 0.55) / 0.3)) * step
        const keep = clamp01((height * 0.86 - f) / (height * 0.16)) * 0.9 // the summits stay sharp
        f = f * (1 - keep) + benched * keep
        f += 0.06 * height * kit.noise.fbm2(x, z, { scale: 6, seed: seed + 3 }) * Math.sqrt(Math.max(0, f) / height) // crags
      }
      top[col(x, z)] = f
      fMax = Math.max(fMax, f)
    }
  // the highest rock near each column (soft bands do not sink back near a summit: thin peaks stay whole)
  const near = new Float32Array(W * D)
  for (let z = Z0; z <= Z1; z += 1)
    for (let x = X0; x <= X1; x += 1) {
      let m = 0
      for (let dz = -4; dz <= 4; dz += 1)
        for (let dx = -4; dx <= 4; dx += 1) if (x + dx >= X0 && x + dx <= X1 && z + dz >= Z0 && z + dz <= Z1) m = Math.max(m, top[col(x + dx, z + dz)])
      near[col(x, z)] = m
    }

  // 2. the strata: a band table along v = height + a tilt + a slow wander. Foot, body and cap bands,
  // a pale accent every 8-12 rows.
  const tilt = (x, z) => dip[0] * (x - (X0 + X1) / 2) + dip[1] * (z - (Z0 + Z1) / 2) + 2.2 * kit.noise.fbm2(x, z, { scale: 17, seed: seed + 6 })
  const tiltMax = Math.ceil((Math.abs(dip[0]) * W + Math.abs(dip[1]) * D) / 2) + 4
  const vMin = -tiltMax - 3
  const vMax = Math.ceil(fMax) + tiltMax + 3
  const bands = []
  const table = []
  const paints = []
  {
    let v = vMin
    let toAccent = rng.int(5, 9)
    let nAccent = 0
    const at = { foot: 0, body: 0, cap: 0 }
    while (v <= vMax) {
      const frac = v / fMax // where this band lies on the rock: foot, body or cap
      const zone = frac < 0.14 ? 'foot' : frac < 0.8 ? 'body' : 'cap'
      let band
      if (toAccent <= 0 && zone !== 'foot') {
        const [mix, hard] = theme.accent[nAccent % theme.accent.length]
        nAccent += 1
        band = { mix, hard, rows: 1 }
        toAccent = rng.int(8, 12)
      } else {
        const [mix, hard, [t0, t1]] = theme[zone][at[zone] % theme[zone].length]
        at[zone] += 1
        band = { mix, hard, rows: rng.int(t0, t1) }
      }
      bands.push(band)
      paints.push(kit.palette(band.mix, { scale: 3, seed: seed + bands.length }))
      for (let k = 0; k < band.rows; k += 1) table.push(bands.length - 1)
      v += band.rows
      toAccent -= band.rows
    }
  }
  const bandAt = (x, h, z) => table[Math.max(0, Math.min(table.length - 1, Math.floor(h + tilt(x, z) - vMin)))]

  // 3. the rock, level by level: the footprint at this height (top >= h), then each band pushed out
  // or in from it by its hardness (a distance field in the plane), roughened so no face is smooth.
  const Hrock = Math.ceil(fMax) + 1
  const L = Hrock + 3 // levels: h = -2 .. Hrock
  const solid = new Uint8Array(W * D * L) // band index + 1
  const at3 = (x, h, z) => x - X0 + W * (z - Z0 + D * (h + 2))
  const inside = new Uint8Array(W * D)
  const outside = new Uint8Array(W * D)
  for (let h = -2; h <= Hrock; h += 1) {
    let any = false
    for (let i = 0; i < W * D; i += 1) {
      inside[i] = top[i] >= Math.max(1, h) ? 1 : 0
      outside[i] = 1 - inside[i]
      any ||= inside[i] === 1
    }
    if (!any) continue
    const dOut = chamfer(inside, W, D) // outside cells: distance to the rock
    const dIn = chamfer(outside, W, D) // rock cells: distance to the air
    for (let z = Z0; z <= Z1; z += 1)
      for (let x = X0; x <= X1; x += 1) {
        const i = col(x, z)
        const sd = inside[i] ? 0.5 - dIn[i] : dOut[i] - 0.5
        if (sd > 3.2) continue
        const k = bandAt(x, h, z)
        if (sd < -2.6) {
          solid[at3(x, h, z)] = k + 1
          continue
        }
        const hard = bands[k].hard
        // the band's lip: long and steady along the face, so it reads as a line
        let off = hard * (0.2 + 1.1 * kit.noise.coherent01(x, h * 0.3, z, { scale: 6, seed: seed + 7 }))
        off *= clamp01((near[i] - h) / 8) // near a summit the bands neither stand out nor sink: clean spires
        off += 0.7 * kit.noise.fbm2(x, z, { scale: 5, octaves: 2, seed: seed + 9 }) // vertical ribs and flutes
        off += 0.2 * kit.noise.fbm3(x, h, z, { scale: 4, octaves: 1, seed: seed + 8 }) // a little break-up
        if (h <= 0) off = Math.max(off, 0.5) // the buried foot is whole
        if (sd <= off) solid[at3(x, h, z)] = k + 1
      }
  }
  const isRock = (x, h, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1 && h >= -2 && h <= Hrock && solid[at3(x, h, z)] > 0
  const clear = (x, h, z) => {
    if (x >= X0 && x <= X1 && z >= Z0 && z <= Z1 && h >= 1 && h <= Hrock) solid[at3(x, h, z)] = 0
  }
  // the gradient of the silhouette: points into the rock (uphill)
  const grad = (x, z) => {
    const g = (xx, zz) => top[col(Math.max(X0, Math.min(X1, xx)), Math.max(Z0, Math.min(Z1, zz)))]
    return [(g(x + 2, z) - g(x - 2, z)) / 4, (g(x, z + 2) - g(x, z - 2)) / 4]
  }

  // 4. cracks and gullies: slots 1-2 wide cut 2-4 deep into the face, top to bottom of a stretch of it.
  // Each runs along the slope's fall line, so it reads as a crack wherever the face is.
  const crackFeet = []
  const nCracks = cracks ?? Math.round((W + D) / 9)
  const tries = []
  for (let z = Z0 + 2; z <= Z1 - 2; z += 2)
    for (let x = X0 + 2; x <= X1 - 2; x += 2) {
      const f = top[col(x, z)]
      const [gx, gz] = grad(x, z)
      const g = Math.hypot(gx, gz)
      // steep, high enough, and turned toward the players
      if (f > height * 0.25 && g > 0.9 && (-gx * fx - gz * fz) / g > 0.2) tries.push([x, z, gx / g, gz / g, f])
    }
  const made = []
  for (const [ax, az, dx, dz, f] of rng.shuffle(tries)) {
    if (made.length >= nCracks) break
    if (made.some(([mx, mz]) => Math.hypot(mx - ax, mz - az) < 7)) continue
    made.push([ax, az])
    const w = rng.chance(0.3) ? 1.1 : 0.55
    const depth = rng.int(2, 4)
    const yTop = Math.round(f + 2)
    const yBot = Math.max(1, Math.round(f - rng.range(9, 22)))
    for (let h = yBot; h <= yTop; h += 1) {
      const wob = 1.1 * kit.noise.fbm2(h, ax + az, { scale: 6, seed: seed + 10 })
      const px = ax - dz * wob
      const pz = az + dx * wob
      // find the face on the fall line at this height, then cut in from there
      let s0 = null
      for (let s = -10; s <= 14; s += 0.5)
        if (isRock(Math.round(px + dx * s), h, Math.round(pz + dz * s))) {
          s0 = s
          break
        }
      if (s0 === null) continue
      for (let s = s0 - 1; s <= s0 + depth; s += 0.5)
        for (let l = -w; l <= w; l += 0.5) clear(Math.round(px + dx * s - dz * l), h, Math.round(pz + dz * s + dx * l))
    }
    if (yBot <= 3) crackFeet.push([ax - dx * 6, az - dz * 6])
  }

  // 5. the cave: a mouth at the foot of the main face, an oval tunnel into the rock
  let caveAt = null
  if (cave) {
    // walk from the highest column toward the players until the rock is low: that is the foot
    let best = 0
    for (let i = 0; i < W * D; i += 1) if (top[i] > top[best]) best = i
    let [x, z] = [X0 + (best % W), Z0 + Math.floor(best / W)]
    while (top[col(x, z)] > 4 && x > X0 && z > Z0 && x < X1 && z < Z1) {
      x += fx
      z += fz
    }
    caveAt = new Set()
    const [r0, r1, r2] = [3.2, 4.6, 10] // half width, height, depth
    for (let dz = -12; dz <= 12; dz += 1)
      for (let dx = -12; dx <= 12; dx += 1)
        for (let h = 1; h <= 7; h += 1) {
          const d = -(dx * fx + dz * fz) // depth into the rock
          const u = dx * -fz + dz * fx
          const n = 0.25 * kit.noise.fbm3(x + dx, h, z + dz, { scale: 3, seed: seed + 11 })
          const e = (u / (r0 * (1 - 0.25 * clamp01(d / r2)))) ** 2 + ((h - 1) / r1) ** 2 + (Math.max(0, d) / r2) ** 2
          if (d > -3 && e < 1 + n && isRock(x + dx, h, z + dz)) {
            clear(x + dx, h, z + dz)
            // the column and the apron in front of the mouth stay free of scree
            for (let k = 0; k <= 4; k += 1) caveAt.add(`${x + dx + fx * k},${z + dz + fz * k}`)
          }
        }
  }

  // 6. nothing floats: keep only the rock joined to the ground
  {
    const seen = new Uint8Array(solid.length)
    const stack = []
    for (let i = 0; i < W * D; i += 1) if (solid[i]) {
      seen[i] = 1
      stack.push(i)
    }
    const WD = W * D
    while (stack.length) {
      const i = stack.pop()
      const x = i % W
      const z = Math.floor(i / W) % D
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, z > 0 ? i - W : -1, z < D - 1 ? i + W : -1, i >= WD ? i - WD : -1, i + WD < solid.length ? i + WD : -1])
        if (j >= 0 && solid[j] && !seen[j]) {
          seen[j] = 1
          stack.push(j)
        }
    }
    for (let i = 0; i < solid.length; i += 1) if (!seen[i]) solid[i] = 0
  }

  // 7. place the rock
  for (let h = -2; h <= Hrock; h += 1)
    for (let z = Z0; z <= Z1; z += 1)
      for (let x = X0; x <= X1; x += 1) {
        const k = solid[at3(x, h, z)]
        if (k && base + h >= 0 && base + h < ctx.H) b.set(x, base + h, z, paints[k - 1])
      }

  // the cave: gravel and moss underfoot, a worn track out of it, roots and glow berries under its lip
  if (caveAt) {
    const floor = kit.palette({ gravel: 3, coarse_dirt: 3, moss_block: 2, rooted_dirt: 1 }, { scale: 2, seed: seed + 23 })
    for (const key of caveAt) {
      const [x, z] = key.split(',').map(Number)
      if (x < 0 || z < 0 || x >= S || z >= S || isRock(x, 1, z)) continue
      b.set(x, base, z, floor)
      for (let h = 2; h <= 8; h += 1) {
        if (!isRock(x, h, z) || isRock(x, h - 1, z)) continue
        const r = kit.hash01(x, h, z, seed + 24)
        if (r < 0.3) b.set(x, base + h - 1, z, 'minecraft:hanging_roots')
        else if (r < 0.45 && h >= 4) {
          b.set(x, base + h - 1, z, 'minecraft:cave_vines_plant[berries=false]')
          b.set(x, base + h - 2, z, 'minecraft:cave_vines[age=25,berries=true]')
        }
        break
      }
    }
  }

  // 8. the ledges: a top face with enough room round it at the same height gets soil and plants;
  // narrow tops get moss in patches; above the snowline, snow.
  const soil = kit.palette(theme.soil, { scale: 3, seed: seed + 12 })
  const green = theme.green ?? true
  const topFace = (x, h, z) => isRock(x, h, z) && !isRock(x, h + 1, z)
  const room = (x, h, z, r) => {
    let n = 0
    for (let dz = -r; dz <= r; dz += 1) for (let dx = -r; dx <= r; dx += 1) if (topFace(x + dx, h, z + dz)) n += 1
    return n
  }
  const ledges = []
  const lips = [] // top faces vines may hang from: [x, y, z, threshold] (soil ledges hang more)
  for (let h = 1; h <= Hrock; h += 1)
    for (let z = Z0; z <= Z1; z += 1)
      for (let x = X0; x <= X1; x += 1) {
        if (!topFace(x, h, z) || base + h + 1 >= ctx.H) continue
        const yy = base + h
        const snowy = snow !== null && h > snow + 3 * kit.noise.fbm2(x, z, { scale: 7, seed: seed + 13 })
        const r2 = room(x, h, z, 2)
        if (snowy) {
          if (r2 >= 8) b.set(x, yy, z, 'minecraft:snow_block')
          else if (r2 >= 3) b.set(x, yy + 1, z, `minecraft:snow[layers=${1 + Math.floor(kit.hash01(x, h, z, seed) * 3)}]`)
          continue
        }
        if (r2 >= 11) {
          b.set(x, yy, z, soil)
          // soil under it where the face does not show it (a brown line along every lip reads as a stripe)
          if (r2 >= 18 && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => isRock(x + dx, h - 1, z + dz))) b.set(x, yy - 1, z, 'minecraft:dirt')
          ledges.push([x, yy, z, r2])
          lips.push([x, yy, z, 0.45])
        } else {
          if (green && r2 >= 4 && kit.noise.coherent01(x, h, z, { scale: 3, seed: seed + 14 }) > 0.66) b.set(x, yy + 1, z, 'minecraft:moss_carpet')
          lips.push([x, yy, z, 0.76])
        }
      }

  if (plants) {
    // bushes and small trees on the widest ledges, leaning out to the light
    const kinds = theme.trees ?? []
    const nTrees = trees ?? Math.round(ledges.length / 110)
    const spots = rng.shuffle(ledges.filter(([x, yy, z, r2]) => r2 >= 18 && !b.get(x, yy + 1, z)).map(([x, yy, z]) => [x, yy, z, room(x, yy - base, z, 3)]))
    const used = []
    let planted = 0
    for (const [x, yy, z, r3] of spots) {
      if (used.some(([ux, uy, uz]) => Math.hypot(ux - x, uz - z) < 5 && Math.abs(uy - yy) < 6)) continue
      if (planted < nTrees && kinds.length && r3 >= 24 && airAbove(b, x, yy, z, 9) && yy + 12 < ctx.H) {
        cragTree(ctx, [x, yy, z], { kind: kinds[planted % kinds.length], height: rng.int(6, 9), out: [fx, fz], seed: seed + planted })
        planted += 1
        used.push([x, yy, z])
      } else if (green && used.length < nTrees * 2 + 6 && x > 3 && z > 3 && x < S - 4 && z < S - 4 && yy + 4 < ctx.H) {
        bush(ctx, [x, yy, z], { r: rng.range(1.5, 2.3), seed: seed + used.length })
        used.push([x, yy, z])
      }
    }
    const flowers = ['minecraft:cornflower', 'minecraft:oxeye_daisy', 'minecraft:azure_bluet', 'minecraft:dandelion']
    for (const [x, yy, z] of ledges) {
      const n = b.nameAt(x, yy, z) ?? ''
      if (b.get(x, yy + 1, z)) continue
      const r = kit.hash01(x, yy, z, seed + 15)
      if (/sand|coarse_dirt/.test(n) && !/grass/.test(n)) {
        if (r < 0.12) b.set(x, yy + 1, z, 'minecraft:dead_bush') // a dry theme's ledges
        continue
      }
      if (!/grass_block|moss_block|podzol/.test(n)) continue
      const drift = kit.noise.coherent01(x, yy, z, { scale: 5, seed: seed + 16 })
      if (drift > 0.78 && r < 0.45 && /grass/.test(n)) b.set(x, yy + 1, z, flowers[Math.floor(kit.noise.coherent01(x, 0, z, { scale: 9, seed }) * flowers.length)])
      else if (r < 0.3) b.set(x, yy + 1, z, 'minecraft:short_grass')
      else if (r < 0.4) b.set(x, yy + 1, z, 'minecraft:fern')
      else if (r < 0.43 && !b.get(x, yy + 2, z)) b.set(x, yy + 1, z, 'minecraft:tall_grass[half=lower]')
      else if (r < 0.46 && /moss/.test(n)) b.set(x, yy + 1, z, 'minecraft:moss_carpet')
    }
    // vines over the lips of the ledges, roots under the soil lips
    if (green) for (const [x, yy, z, th] of lips)
      for (const [dx, dz, f] of [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'north'], [0, -1, 'south']]) {
        if (kit.noise.coherent01(x + dx, yy, z + dz, { scale: 3, seed: seed + 17 }) < th) continue
        const len = 3 + Math.floor(kit.hash01(x, yy, z + dx, seed) * 8)
        for (let k = 1; k <= len; k += 1) {
          const [vx, vy, vz] = [x + dx, yy - k, z + dz]
          if (b.get(vx, vy, vz) || !isRock(x, vy - base, z) || vy < base + 1) break
          b.set(vx, vy, vz, `minecraft:vine[${f}=true]`)
        }
      }
    if (green) for (const [x, yy, z] of ledges) {
      if (kit.hash01(x, yy, z, seed + 18) > 0.35) continue
      const under = isRock(x, yy - base - 1, z) ? yy - 2 : yy - 1 // under the soil, or under the rock it lies on
      if (under === yy - 2 && isRock(x, yy - base - 2, z)) continue
      if (!b.get(x, under, z)) b.set(x, under, z, 'minecraft:hanging_roots')
    }
  }

  // 9. the scree: a slope of loose stone at the foot, highest under the face, highest of all under
  // the cracks (fans), frayed into the grass; boulders on it.
  if (scree) {
    const foot = new Uint8Array(W * D)
    for (let z = Z0; z <= Z1; z += 1) for (let x = X0; x <= X1; x += 1) foot[col(x, z)] = isRock(x, 1, z) ? 1 : 0
    const dist = chamfer(foot, W, D)
    const loose = kit.palette(theme.scree, { scale: 2.5, seed: seed + 19 })
    const reach = Math.max(7, height * 0.34)
    const heap = []
    for (let z = Z0; z <= Z1; z += 1)
      for (let x = X0; x <= X1; x += 1) {
        const d = dist[col(x, z)]
        if (d < 1 || d > reach + 4 || caveAt?.has(`${x},${z}`)) continue
        // under a tall face there is more: the rock height a few blocks in
        const [gx, gz] = grad(x, z)
        const g = Math.hypot(gx, gz) || 1
        const back = top[col(Math.max(X0, Math.min(X1, Math.round(x + (gx / g) * 4))), Math.max(Z0, Math.min(Z1, Math.round(z + (gz / g) * 4))))]
        let hs = (2 + back / 4.5) * clamp01(1 - d / reach) ** 1.5 * (0.65 + 0.7 * kit.noise.coherent01(x, 0, z, { scale: 4, seed: seed + 20 }))
        for (const [cx, cz] of crackFeet) hs += 4.5 * clamp01(1 - Math.hypot(x - cx, z - cz) / 8) ** 1.3
        const n = Math.floor(hs)
        const half = hs - n > 0.5 // a slab on top: the slope steps by halves
        if (n < 1 && !half) {
          if (d < reach && kit.noise.coherent01(x, 1, z, { scale: 3, seed: seed + 21 }) > 0.66) b.set(x, base, z, loose) // frayed edge
          continue
        }
        for (let k = 1; k <= n && base + k < ctx.H; k += 1) if (!b.get(x, base + k, z)) b.set(x, base + k, z, loose)
        if (half && !b.get(x, base + n + 1, z)) b.set(x, base + n + 1, z, `minecraft:${theme.slabs[Math.floor(kit.noise.coherent01(x, 3, z, { scale: 2, seed }) * theme.slabs.length)]}_slab[type=bottom]`)
        else if (n >= 1) heap.push([x, base + n, z, n])
      }
    // plants creeping over the outer, lower scree
    for (const [x, yy, z, n] of heap)
      if (n <= 2 && !b.get(x, yy + 1, z) && kit.noise.coherent01(x, 2, z, { scale: 3, seed: seed + 22 }) > 0.55) {
        b.set(x, yy, z, kit.hash01(x, yy, z, seed) < 0.5 ? 'minecraft:coarse_dirt' : 'minecraft:grass_block')
        if (kit.hash01(x, yy, z, seed + 2) < 0.4) b.set(x, yy + 1, z, 'minecraft:short_grass')
      }
    // boulders that came down: on the scree and a little beyond it
    const rocks = []
    for (const [x, yy, z] of rng.shuffle(heap)) {
      if (rocks.length >= Math.round(heap.length / 90) + 2) break
      if (rocks.some(([rx, rz]) => Math.hypot(rx - x, rz - z) < 8)) continue
      rocks.push([x, z])
      lump(ctx, [x, yy - 1, z], { r: rng.range(1.4, 2.8), paint: paints[bandAt(x, 2, z)], seed: seed + rocks.length })
    }
  }

  // the height function: the highest rock or soil of a column
  return (x, z) => {
    if (x < X0 || x > X1 || z < Z0 || z > Z1) return -1
    for (let h = Hrock; h >= -2; h -= 1) if (solid[at3(x, h, z)]) return base + h
    return -1
  }
}

// distance (chamfer 1 / √2) from every cell to the nearest cell where target is 1
function chamfer(target, W, D) {
  const d = new Float32Array(W * D)
  for (let i = 0; i < W * D; i += 1) d[i] = target[i] ? 0 : 1e9
  const R2 = Math.SQRT2
  for (let z = 0; z < D; z += 1)
    for (let x = 0; x < W; x += 1) {
      const i = x + W * z
      let v = d[i]
      if (x > 0) v = Math.min(v, d[i - 1] + 1)
      if (z > 0) {
        v = Math.min(v, d[i - W] + 1)
        if (x > 0) v = Math.min(v, d[i - W - 1] + R2)
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + R2)
      }
      d[i] = v
    }
  for (let z = D - 1; z >= 0; z -= 1)
    for (let x = W - 1; x >= 0; x -= 1) {
      const i = x + W * z
      let v = d[i]
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1)
      if (z < D - 1) {
        v = Math.min(v, d[i + W] + 1)
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + R2)
        if (x > 0) v = Math.min(v, d[i + W - 1] + R2)
      }
      d[i] = v
    }
  return d
}

function airAbove(b, x, y, z, n) {
  for (let k = 1; k <= n; k += 1) if (b.get(x, y + k, z)) return false
  return true
}

// A small tree for a ledge: it leans out over the drop, toward the light. kind 'spruce' | 'oak'.
// [x, y, z]: y is the ledge's top block. Only fills air.
function cragTree(ctx, [x, y, z], { kind = 'spruce', height = 7, out = [0, 1], seed = 1 }) {
  const { b, kit } = ctx
  const rng = kit.rng(seed * 53 + 3)
  const put = (px, py, pz, p) => {
    if (!b.get(px, py, pz) && py < ctx.H) b.set(px, py, pz, p)
  }
  const lean = rng.range(0.15, 0.3)
  const trunkAt = h => [Math.round(x + out[0] * lean * h), Math.round(z + out[1] * lean * h)]
  if (kind === 'spruce') {
    for (let h = 1; h <= height; h += 1) put(trunkAt(h)[0], y + h, trunkAt(h)[1], 'minecraft:spruce_log[axis=y]')
    for (let h = 2; h <= height + 1; h += 1) {
      const t = (h - 2) / (height - 1)
      const r = (1 - t) * 2.6 + (h % 2 ? 0.6 : 0)
      const [tx, tz] = trunkAt(Math.min(h, height))
      for (let dz = -3; dz <= 3; dz += 1)
        for (let dx = -3; dx <= 3; dx += 1)
          if (Math.hypot(dx, dz) <= r + 0.3 * kit.noise.fbm3(tx + dx, y + h, tz + dz, { scale: 2, seed })) put(tx + dx, y + h, tz + dz, 'minecraft:spruce_leaves[persistent=true]')
    }
    const [tx, tz] = trunkAt(height)
    put(tx, y + height + 2, tz, 'minecraft:spruce_leaves[persistent=true]')
    return
  }
  // a windswept oak: the trunk leans out, the branches reach out over the drop, flat leaf plates
  const top = Math.round(height * 0.55)
  for (let h = 1; h <= top; h += 1) put(trunkAt(h)[0], y + h, trunkAt(h)[1], 'minecraft:oak_log[axis=y]')
  const [tx, tz] = trunkAt(top)
  const tips = [[tx, y + top + 1, tz, 2.2]]
  const a0 = Math.atan2(out[1], out[0])
  for (let i = 0; i < 3; i += 1) {
    const a = a0 + rng.range(-1.3, 1.3)
    const len = rng.int(2, 4)
    let [bx, by, bz] = [tx, y + top - i, tz]
    for (let k = 1; k <= len; k += 1) {
      bx = Math.round(tx + Math.cos(a) * k)
      bz = Math.round(tz + Math.sin(a) * k)
      if (k > 1) by += 1
      put(bx, by, bz, `minecraft:oak_log[axis=${Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'x' : 'z'}]`)
    }
    tips.push([bx, by + 1, bz, rng.range(2.2, 3)])
  }
  for (const [cx, cy, cz, r] of tips)
    for (let dz = -3; dz <= 3; dz += 1)
      for (let dy = 0; dy <= 1; dy += 1)
        for (let dx = -3; dx <= 3; dx += 1) {
          const d = Math.hypot(dx / r, dy / 1.4, dz / r)
          if (d > 1 + 0.3 * kit.noise.fbm3(cx + dx, cy + dy, cz + dz, { scale: 2, seed })) continue
          if (d > 0.7 && kit.hash01(cx + dx, cy + dy, cz + dz, seed) < 0.25) continue // ragged edge
          put(cx + dx, cy + dy, cz + dz, 'minecraft:oak_leaves[persistent=true]')
        }
}

// A boulder of the cliff's own stone, half sunk where it came to rest
function lump(ctx, [x, y, z], { r = 2, paint, seed = 1 }) {
  const { b, kit } = ctx
  const R = Math.ceil(r + 1)
  for (let dz = -R; dz <= R; dz += 1)
    for (let dy = -1; dy <= R; dy += 1)
      for (let dx = -R; dx <= R; dx += 1) {
        const d = Math.hypot(dx / r, (dy * 1.3) / r, dz / (r * 0.85))
        if (d > 1 + 0.35 * kit.noise.fbm3(x + dx, y + dy, z + dz, { scale: 3, seed })) continue
        const [px, py, pz] = [x + dx, y + 1 + dy, z + dz]
        if (px < 0 || pz < 0 || px >= ctx.S || pz >= ctx.S || py >= ctx.H) continue
        b.set(px, py, pz, paint)
      }
}

// DON'T: a smooth cone of one stone
export function coneBad(ctx, [x, y, z], { r = 22, height = 38 } = {}) {
  const { b } = ctx
  for (let dz = -r; dz <= r; dz += 1)
    for (let dx = -r; dx <= r; dx += 1) {
      const h = Math.round(height * (1 - Math.hypot(dx, dz) / r))
      for (let k = 1; k <= h; k += 1) b.set(x + dx, y + k, z + dz, 'minecraft:stone')
    }
}
// DON'T: a vertical wall with a flat top
export function wallBad(ctx, [x0, y, z0], [x1, z1], { height = 24 } = {}) {
  ctx.b.box([x0, y + 1, z0], [x1, y + height, z1], 'minecraft:stone')
}

export const figure = { size: 96, height: 64, floorY: 4, camera: { eye: [47, 7, 94.5], lookAt: [47, 22, 46], fov: 58, width: 600, height: 440 } }
// the stage: a meadow round the foot (grass in clumps, a few flowers), so the picture has a foreground
function meadow(ctx) {
  const { b, kit, S, FY } = ctx
  for (let z = 1; z < S - 12; z += 1)
    for (let x = 1; x < S - 1; x += 1) {
      if (b.nameAt(x, FY, z) !== 'minecraft:grass_block' || b.get(x, FY + 1, z)) continue
      const n = kit.noise.coherent01(x, 0, z, { scale: 4, seed: 41 })
      const r = kit.hash01(x, FY, z, 42)
      const near = z > S - 30 // thinner near the camera, so the foot of the rock shows
      if (n > 0.55 && r < (near ? 0.2 : 0.5)) b.set(x, FY + 1, z, r < 0.03 && !near ? 'minecraft:oxeye_daisy' : r < 0.4 ? 'minecraft:short_grass' : 'minecraft:fern')
    }
}

export function demo(ctx, which) {
  groundPatch(ctx)
  const { FY } = ctx
  if (which === 'good') massif(ctx, { cx: 47, cz: 46, height: 44, radius: 30, seed: 3, cave: true })
  else {
    coneBad(ctx, [31, FY, 42], { r: 15, height: 40 })
    wallBad(ctx, [52, FY, 32], [78, 46], { height: 28 })
  }
  meadow(ctx)
}
