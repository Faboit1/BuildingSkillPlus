// ELVEN TREEHOUSE (work in progress: massing)

const SIZE = [80, 92, 80]
const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b)
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1)
  return b * (1 - h) + a * h - k * h * (1 - h)
}

export default function build(api) {
  const { kit } = api
  const { noise } = kit
  const STAGES = ['massing', 'structure', 'texture', 'detail', 'final']
  const stage = STAGES.indexOf(process.env.STAGE ?? 'final')
  const at = s => stage >= STAGES.indexOf(s)
  const b = api.builder(SIZE, { seed: 4242 })
  const [W, , D] = SIZE

  // ------------------------------------------------------------------ site
  const T = [31, 38] // main trunk axis (x, z)
  const C = [66, 26] // companion tree
  const WATER = 5
  const STREAM = [[49, -6], [47, 9], [52, 22], [51, 34], [46, 47], [49, 59], [44, 71], [46, 88]]
  const distToPolyline = (x, z, pts) => {
    let best = Infinity
    for (let i = 1; i < pts.length; i += 1) {
      const [ax, az] = pts[i - 1]
      const [bx, bz] = pts[i]
      const dx = bx - ax
      const dz = bz - az
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1)
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
    }
    return best
  }
  const streamD = (x, z) => distToPolyline(x + 1.6 * noise.fbm2(x, z, { scale: 8, seed: 5 }), z, STREAM)
  const islandR = (x, z) => 38.5 + 2.5 * noise.fbm2(x, z, { scale: 11, seed: 21 })
  const rawH = (x, z) => {
    let h = 7.2 + 1.8 * noise.fbm2(x, z, { scale: 26, seed: 2 }) + 0.7 * noise.fbm2(x, z, { scale: 9, seed: 3 })
    h += 3.4 * Math.exp(-((x - T[0]) ** 2 + (z - T[1]) ** 2) / (2 * 12 ** 2)) // knoll under the great tree
    h += 1.6 * Math.exp(-((x - C[0]) ** 2 + (z - C[1]) ** 2) / (2 * 8 ** 2))
    const rd = streamD(x, z)
    if (rd < 2.8) h = Math.min(h, WATER - 1.8 + rd * 0.35)
    else if (rd < 8) h = Math.min(h, WATER + 0.4 + (rd - 2.8) * 0.55)
    const e = Math.hypot(x - 40, z - 40) - islandR(x, z) // diorama edge: soften into a rounded rim
    if (e > -4) h -= (e + 4) * 0.8
    return h
  }
  const HM = new Map()
  for (let x = 0; x < W; x += 1) for (let z = 0; z < D; z += 1) HM.set(x * 1000 + z, rawH(x, z))
  const blurred = new Map()
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      let s = 0
      let n = 0
      for (let dx = -1; dx <= 1; dx += 1)
        for (let dz = -1; dz <= 1; dz += 1) {
          const v = HM.get((x + dx) * 1000 + z + dz)
          if (v !== undefined) { s += v; n += 1 }
        }
      blurred.set(x * 1000 + z, s / n)
    }
  const inIsland = (x, z) => Math.hypot(x - 40, z - 40) <= islandR(x, z)
  const heightAt = (x, z) => Math.round(blurred.get(x * 1000 + z) ?? 0)
  const ground = b.terrain({
    height: (x, z) => (inIsland(x, z) ? heightAt(x, z) : -1),
    layers: [
      { depth: 1, paint: 'minecraft:grass_block' },
      { depth: 3, paint: 'minecraft:dirt' },
      { paint: 'minecraft:stone' },
    ],
  })
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      if (!inIsland(x, z)) continue
      for (let y = ground(x, z) + 1; y <= WATER; y += 1) b.set(x, y, z, 'minecraft:water')
    }
  const g0 = ground(T[0], T[1]) // ground at the great trunk

  // ------------------------------------------------------------------ the great tree: SDF skeleton
  // Trunk: a near-vertical spine with radius R(y, theta): taper + root flare + twisting flutes.
  const TOPY = 50
  const spine = [[31, g0 - 4, 38], [31.4, g0 + 8, 37.6], [32.2, 24, 37.2], [32, 36, 36.6], [31, TOPY, 36]]
  const spineS = kit.catmullRom(spine, { samplesPerBlock: 2 })
  const centerAt = y => {
    if (y <= spineS[0][1]) return spineS[0]
    for (let i = 1; i < spineS.length; i += 1) {
      const p = spineS[i - 1]
      const q = spineS[i]
      if (y <= q[1]) {
        const t = (y - p[1]) / (q[1] - p[1] || 1)
        return [lerp(p[0], q[0], t), y, lerp(p[2], q[2], t)]
      }
    }
    return spineS.at(-1)
  }
  const coreR = y => 3.3 + 2.7 * Math.pow(clamp((TOPY - y) / (TOPY - g0), 0, 1.2), 1.25)
  const flare = y => 3.0 * Math.exp(-Math.max(0, y - g0) / 3.0)
  const trunkR = (y, th) => coreR(y) * (1 + 0.1 * Math.cos(5 * th + 0.07 * y + 0.8 * Math.sin(0.09 * y))) + flare(y)
  const trunkD = (x, y, z) => {
    const c = centerAt(y)
    const th = Math.atan2(z - c[2], x - c[0])
    const d = Math.hypot(x - c[0], z - c[2]) - trunkR(y, th)
    return Math.max(d, y - TOPY, spine[0][1] - y)
  }

  // Tubes (roots, limbs) as chains of tapered capsules, smooth-unioned into the trunk.
  const tubes = []
  const tube = (points, r0, r1, { k = 2, ys = 1, yRef = g0, rf } = {}) => {
    const S = kit.catmullRom(points, { samplesPerBlock: 1 })
    const L = [0]
    for (let i = 1; i < S.length; i += 1) L.push(L[i - 1] + Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1], S[i][2] - S[i - 1][2]))
    const tot = L.at(-1) || 1
    const rad = s => (rf ? rf(s) : lerp(r0, r1, s))
    const P = S.map(p => [p[0], yRef + (p[1] - yRef) * ys, p[2]])
    const segs = []
    for (let i = 1; i < P.length; i += 1) {
      const a = P[i - 1]
      const c = P[i]
      const ra = rad(L[i - 1] / tot)
      const rb = rad(L[i] / tot)
      const R = Math.max(ra, rb) + k
      segs.push({ a, c, ra, rb, min: [Math.min(a[0], c[0]) - R, Math.min(a[1], c[1]) - R, Math.min(a[2], c[2]) - R], max: [Math.max(a[0], c[0]) + R, Math.max(a[1], c[1]) + R, Math.max(a[2], c[2]) + R] })
    }
    const min = [0, 1, 2].map(i => Math.min(...segs.map(s => s.min[i])))
    const max = [0, 1, 2].map(i => Math.max(...segs.map(s => s.max[i])))
    // y bounds back in world space
    const wmin = [min[0], yRef + (min[1] - yRef) / ys, min[2]]
    const wmax = [max[0], yRef + (max[1] - yRef) / ys, max[2]]
    const t = { segs, k, ys, yRef, min: wmin, max: wmax, points, samples: S }
    tubes.push(t)
    return t
  }
  const sdTube = (t, x, y0, z) => {
    const y = t.yRef + (y0 - t.yRef) * t.ys
    let best = Infinity
    for (const s of t.segs) {
      if (x < s.min[0] || x > s.max[0] || y < s.min[1] || y > s.max[1] || z < s.min[2] || z > s.max[2]) continue
      const pa0 = x - s.a[0]
      const pa1 = y - s.a[1]
      const pa2 = z - s.a[2]
      const ba0 = s.c[0] - s.a[0]
      const ba1 = s.c[1] - s.a[1]
      const ba2 = s.c[2] - s.a[2]
      const h = clamp((pa0 * ba0 + pa1 * ba1 + pa2 * ba2) / (ba0 * ba0 + ba1 * ba1 + ba2 * ba2 || 1), 0, 1)
      const d = Math.hypot(pa0 - ba0 * h, pa1 - ba1 * h, pa2 - ba2 * h) - (s.ra + (s.rb - s.ra) * h)
      if (d < best) best = d
    }
    return best
  }
  const polar = (cx, cz, th, r) => [cx + Math.cos(th) * r, cz + Math.sin(th) * r]
  const deg = d => (d * Math.PI) / 180

  // Buttress roots: vertical fins (ys < 1 stretches them upright) that leave the trunk high and
  // dive into the soil 12-15 blocks out. Two of them drape over boulders.
  const BOULDERS = [
    { c: [17.5, 0, 46], r: [3.4, 2.6, 3.0], th: deg(150) },
    { c: [44.5, 0, 31.5], r: [3.0, 2.4, 2.8], th: deg(-25) },
  ]
  for (const bo of BOULDERS) bo.c[1] = ground(Math.round(bo.c[0]), Math.round(bo.c[2])) + 0.6
  const ROOTS = [deg(150), deg(-25), deg(35), deg(95), deg(205), deg(262), deg(-75)]
  ROOTS.forEach((th, i) => {
    const reach = 13 + 2.5 * Math.sin(i * 2.3)
    const p = (r, y) => { const [x, z] = polar(T[0], T[1], th + 0.06 * Math.sin(r * 0.4 + i), r); return [x, y, z] }
    const bo = BOULDERS.find(o => o.th === th)
    const pts = bo
      ? [p(2, g0 + 10), p(6, g0 + 6), p(9, g0 + 3.5), [bo.c[0], bo.c[1] + bo.r[1] + 0.2, bo.c[2]], p(reach + 4, g0 - 2.5)]
      : [p(2, g0 + 10), p(6, g0 + 5.5), p(10, g0 + 1.5), p(reach, g0 - 1), p(reach + 3, g0 - 3)]
    tube(pts, 2.4, 0.9, { k: 2.6, ys: bo ? 0.85 : 0.6 })
  })

  // Major limbs. L1 carries the hall platform (south), L2 the music pavilion (west).
  const LIMBS = {
    L1: tube([[31.6, 13, 40], [33, 18, 46], [34.5, 21, 52], [36.5, 22, 57], [38.5, 26, 61], [39, 33, 63]], 2.6, 1.1, { k: 2.2 }),
    L2: tube([[30, 29, 37], [25, 33, 39], [20, 35.2, 41], [15, 36.5, 43], [11.5, 40, 44.5], [10, 46, 45]], 2.4, 1.0, { k: 2.2 }),
    L3: tube([[31, 25, 35], [29, 30, 27], [27.5, 35, 20], [27, 41, 15]], 2.2, 1.0, { k: 2.0 }),
    L5: tube([[30, 20, 40], [24, 25, 46], [18, 29, 51], [14, 33, 54]], 1.9, 0.9, { k: 2.0 }),
    L4: tube([[32, 37, 37], [38, 41, 41], [44, 45, 45], [48, 50, 48]], 1.9, 0.9, { k: 2.0 }),
    FA: tube([[31, 44, 36], [27.5, 55, 32], [23.5, 65, 28], [21, 73, 25]], 2.9, 1.3, { k: 2.4 }),
    FB: tube([[31.5, 44, 36], [37, 53, 35], [43, 60, 32.5], [48, 66, 30]], 2.7, 1.2, { k: 2.4 }),
    FC: tube([[31, 44, 36.5], [30, 56, 40], [29, 67, 42], [30, 78, 41]], 2.8, 1.2, { k: 2.4 }),
  }

  const treeMin = [8, g0 - 5, 12]
  const treeMax = [56, 82, 66]
  const barkNoise = (x, y, z) => 0.55 * noise.fbm3(x, y * 0.3, z, { scale: 2.4, octaves: 2, seed: 61 })
  const treeSdf = (x, y, z) => {
    let d = trunkD(x, y, z)
    for (const t of tubes) {
      if (x < t.min[0] || x > t.max[0] || y < t.min[1] || y > t.max[1] || z < t.min[2] || z > t.max[2]) continue
      const dt = sdTube(t, x, y, z)
      if (dt < Infinity) d = smin(d, dt, t.k) // (smin with Infinity would give NaN: 0 * Infinity)
    }
    return d + barkNoise(x, y, z)
  }
  const BARK = 'minecraft:brown_wool' // placeholder: shaded into a mixed bark ramp later
  b.sdf(treeMin, treeMax, treeSdf, BARK)
  for (const bo of BOULDERS) b.boulder(bo.c, bo.r, 'minecraft:light_gray_wool', { seed: 3 })

  // ------------------------------------------------------------------ canopy massing
  const leafCluster = (c, r, seed) => b.leafBlob(c, r, ['oak_leaves'], { seed, holes: 0.12 })
  const TIPS = [
    [39, 35, 64, 6, 3], [10, 48, 45, 6.5, 3], [27, 43, 14, 6, 3], [13, 35, 55, 5, 2.6], [49, 52, 49, 5.5, 3],
    [21, 75, 24, 7, 3.4], [48, 68, 30, 7, 3.4], [30, 80, 41, 6.5, 3.2],
    [15, 66, 30, 5.5, 2.8], [38, 72, 22, 6, 3], [22, 62, 48, 6, 3], [42, 63, 44, 6, 3], [55, 58, 36, 5, 2.6],
  ]
  TIPS.forEach(([x, y, z, r, ry], i) => leafCluster([x, y, z], [r, ry, r], i * 7 + 1))

  // ------------------------------------------------------------------ companion tree massing
  const gC = ground(C[0], C[1])
  b.tubeAlong([[C[0], gC - 2, C[1]], [C[0] + 0.5, gC + 14, C[1] - 0.3], [C[0] - 0.5, gC + 30, C[1] + 0.5]], s => 2.6 * (1 - 0.5 * s) + 2.2 * (1 - s) ** 8, BARK)
  b.leafBlob([C[0], gC + 34, C[1]], [9, 4, 9], ['cherry_leaves'], { seed: 99 })

  // ------------------------------------------------------------------ platforms massing
  const DECK = 'minecraft:white_wool'
  const Y1 = 24
  const Y2 = 38
  const Y3 = 54
  b.disc([32, Y1, 51], 7.5, DECK, { keep: true })
  b.disc([32, Y1, 38], 11, DECK, { keep: true })
  b.disc([19, Y2, 42], 6, DECK, { keep: true })
  b.disc([40, Y3, 39], 4, DECK, { keep: true })
  b.disc([C[0], gC + 20, C[1]], 7, DECK, { keep: true })
  b.cylinder([32, Y1 + 1, 51], 5, 5, 'minecraft:yellow_wool')
  b.coneRoof([32, Y1 + 6, 51], 5, { material: 'oxidized_cut_copper', pitch: [0.5, 0.5, 1, 2, 3, 3], overhang: 2, finial: 'lightning_rod' })
  b.cylinder([19, Y2 + 1, 42], 3, 4, 'minecraft:yellow_wool')
  b.coneRoof([19, Y2 + 5, 42], 3, { material: 'oxidized_cut_copper', pitch: [0.5, 0.5, 1, 2, 3, 3], overhang: 2, finial: 'lightning_rod' })

  return b.finish({ name: 'elven-treehouse' })
}
