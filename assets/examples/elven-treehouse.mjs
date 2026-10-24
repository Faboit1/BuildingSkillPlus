// ELVEN TREEHOUSE (work in progress)

const SIZE = [80, 92, 80]
const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const deg = d => (d * Math.PI) / 180
const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b)
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1)
  return b * (1 - h) + a * h - k * h * (1 - h)
}
const norm3 = v => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

export default function build(api) {
  const { kit } = api
  const { noise } = kit
  const STAGES = ['massing', 'structure', 'texture', 'detail', 'final']
  const stage = STAGES.indexOf(process.env.STAGE ?? 'final')
  const at = s => stage >= STAGES.indexOf(s)
  const b = api.builder(SIZE, { seed: 4242 })
  const [W, H, D] = SIZE
  const inB = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D

  // ------------------------------------------------------------------ site
  const T = [31, 38] // great trunk axis (x, z)
  const C = [66, 26] // companion tree
  const WATER = 5
  const STREAM = [[53, 8], [49, 15], [52, 24], [51, 34], [46, 47], [49, 59], [45, 68]]
  const POOL = [45, 69, 4.2]
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
  const streamD = (x, z) => Math.min(
    distToPolyline(x + 1.4 * noise.fbm2(x, z, { scale: 8, seed: 5 }), z, STREAM),
    Math.hypot(x - POOL[0], z - POOL[1]) - POOL[2] + 2.8,
  )
  const islandR = (x, z) => 38.5 + 2.5 * noise.fbm2(x, z, { scale: 11, seed: 21 })
  const inIsland = (x, z) => Math.hypot(x - 40, z - 40) <= islandR(x, z)
  const rawH = (x, z) => {
    let h = 7 + 1.3 * noise.fbm2(x, z, { scale: 30, seed: 2 }) + 0.45 * noise.fbm2(x, z, { scale: 11, seed: 3 })
    h += 3.2 * Math.exp(-((x - T[0]) ** 2 + (z - T[1]) ** 2) / (2 * 13 ** 2)) // knoll under the great tree
    h += 1.5 * Math.exp(-((x - C[0]) ** 2 + (z - C[1]) ** 2) / (2 * 8 ** 2))
    const rd = streamD(x, z)
    if (rd < 2.8) h = Math.min(h, WATER - 1.9 + rd * 0.35)
    else if (rd < 8) h = Math.min(h, WATER + 0.45 + (rd - 2.8) * 0.5)
    const e = Math.hypot(x - 40, z - 40) - islandR(x, z) // diorama rim: a short bevel
    if (e > -2.5) h -= (e + 2.5) * 0.9
    return h
  }
  let HM = new Map()
  for (let x = -1; x <= W; x += 1) for (let z = -1; z <= D; z += 1) HM.set(x * 1000 + z, rawH(x, z))
  for (let pass = 0; pass < 2; pass += 1) {
    const next = new Map()
    for (let x = -1; x <= W; x += 1)
      for (let z = -1; z <= D; z += 1) {
        let s = 0
        let n = 0
        for (let dx = -1; dx <= 1; dx += 1)
          for (let dz = -1; dz <= 1; dz += 1) {
            const v = HM.get((x + dx) * 1000 + z + dz)
            if (v !== undefined) { s += v; n += 1 }
          }
        next.set(x * 1000 + z, s / n)
      }
    HM = next
  }
  const heightAt = (x, z) => Math.round(HM.get(x * 1000 + z) ?? 0)
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
  const g0 = ground(T[0], T[1])

  // ------------------------------------------------------------------ great trunk (analytic)
  const TOPY = 44
  const spine = [[31, g0 - 4, 38], [31.4, g0 + 8, 37.6], [32, 24, 37.2], [31.6, 34, 36.8], [31, TOPY + 2, 36.5]]
  const spineS = kit.catmullRom(spine, { samplesPerBlock: 2 })
  const centerAt = y => {
    if (y <= spineS[0][1]) return [spineS[0][0], y, spineS[0][2]]
    for (let i = 1; i < spineS.length; i += 1) {
      const p = spineS[i - 1]
      const q = spineS[i]
      if (y <= q[1]) {
        const t = (y - p[1]) / (q[1] - p[1] || 1)
        return [lerp(p[0], q[0], t), y, lerp(p[2], q[2], t)]
      }
    }
    return [spineS.at(-1)[0], y, spineS.at(-1)[2]]
  }
  const coreR = y => 4.5 + 2.3 * Math.pow(clamp((TOPY - y) / (TOPY - g0), 0, 1.25), 1.2)
  const flare = y => 3.2 * Math.exp(-Math.max(0, y - g0) / 3.2)
  const trunkR = (y, th) => coreR(y) * (1 + 0.1 * Math.cos(5 * th + 0.07 * y + 0.8 * Math.sin(0.09 * y))) + flare(y)
  const trunkD = (x, y, z) => {
    const c = centerAt(y)
    const th = Math.atan2(z - c[2], x - c[0])
    return Math.max(Math.hypot(x - c[0], z - c[2]) - trunkR(y, th), y - TOPY, spine[0][1] - y)
  }
  const polarAt = (y, th, r) => {
    const c = centerAt(y)
    return [c[0] + Math.cos(th) * r, y, c[2] + Math.sin(th) * r]
  }

  // ------------------------------------------------------------------ reserved space
  // Platforms, the stair and the bridge are planned BEFORE the tree is rasterized, so roots,
  // limbs and leaves are masked out of them: the tree grows around the architecture.
  const RES = new Set()
  const reserve = (x, y, z) => { if (inB(x, y, z)) RES.add(b.key(x, y, z)) }
  const isRes = (x, y, z) => inB(x, y, z) && RES.has(b.key(x, y, z))
  const free = (x, y, z) => !isRes(x, y, z)
  const reserveCyl = (cx, cz, r, y0, y1) => {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z += 1)
        if (Math.hypot(x - cx, z - cz) <= r) for (let y = y0; y <= y1; y += 1) reserve(x, y, z)
  }

  // Spiral stair: helix of birch stairs hugging the trunk. Segment A climbs from the ground
  // (east) to the hall platform, segment B continues round the north side to the music
  // platform (west). theta decreases as it climbs.
  const Y1 = 24 // hall platform deck (blocks); floor surface Y1 + 1
  const Y2 = 38 // music platform deck
  const STAIR_W = 2.6
  const stairCells = new Map()
  const helix = (th0, th1, yb0, yb1) => {
    const n = yb1 - yb0 + 1
    for (let i = 0; i < n; i += 1) {
      const y = yb0 + i
      const a0 = th0 + ((th1 - th0) * i) / n
      const a1 = th0 + ((th1 - th0) * (i + 1)) / n
      const lo = Math.min(a0, a1)
      const hi = Math.max(a0, a1)
      const c = centerAt(y)
      const rMax = trunkR(y, 0) * 1.25 + STAIR_W + 2
      for (let x = Math.floor(c[0] - rMax); x <= Math.ceil(c[0] + rMax); x += 1)
        for (let z = Math.floor(c[2] - rMax); z <= Math.ceil(c[2] + rMax); z += 1) {
          let th = Math.atan2(z - c[2], x - c[0])
          while (th < lo) th += TAU
          while (th >= lo + TAU) th -= TAU
          if (th >= hi) continue
          const r = Math.hypot(x - c[0], z - c[2])
          const rin = trunkR(y, th) + 0.45
          if (r < rin || r > rin + STAIR_W) continue
          const s = Math.sign(th1 - th0)
          const facing = kit.facingFrom(-Math.sin(th) * s, Math.cos(th) * s)
          stairCells.set(b.key(x, y, z), { x, y, z, facing, outer: r > rin + STAIR_W - 1, th, step: i, r, rin })
        }
    }
  }
  const footTh = deg(23)
  const foot = polarAt(g0 + 1, footTh, trunkR(g0 + 1, footTh) + 1.8)
  const footY = ground(Math.round(foot[0]), Math.round(foot[2])) + 1
  const thA1 = deg(-74)
  const thB1 = deg(-200)
  helix(footTh, thA1, footY, Y1)
  helix(thA1, thB1, Y1 + 1, Y2)
  for (const s of stairCells.values()) for (let k = 0; k <= 3; k += 1) reserve(s.x, s.y + k, s.z)

  // Platforms
  const HALL = [30, 54] // hall pavilion centre on the south lobe of the lower platform
  const HALL_R = 5
  const MUSIC = [18.7, 40.4] // music pavilion on the west limb
  const MUSIC_R = 3.5
  const deck1 = (x, z) => {
    const c = centerAt(Y1)
    const th = Math.atan2(z - c[2], x - c[0])
    const ring = Math.hypot(x - c[0], z - c[2]) <= trunkR(Y1, th) + 5.2 + 0.8 * noise.fbm2(x, z, { scale: 5, seed: 8 })
    const lobe = Math.hypot(x - HALL[0], z - HALL[1]) <= 8 + 0.5 * noise.fbm2(x, z, { scale: 4, seed: 9 })
    return ring || lobe
  }
  const deck2 = (x, z) => Math.hypot(x - MUSIC[0], z - MUSIC[1]) <= 6 + 0.5 * noise.fbm2(x, z, { scale: 4, seed: 10 })
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      if (deck1(x, z)) for (let y = Y1; y <= Y1 + 3; y += 1) reserve(x, y, z)
      if (deck2(x, z)) for (let y = Y2; y <= Y2 + 3; y += 1) reserve(x, y, z)
    }
  reserveCyl(HALL[0], HALL[1], HALL_R + 3.5, Y1, Y1 + 20)
  reserveCyl(MUSIC[0], MUSIC[1], MUSIC_R + 3.5, Y2, Y2 + 14)
  const gC = ground(C[0], C[1])
  const YC = 26 // companion platform deck
  reserveCyl(C[0], C[1], 8, YC, YC + 15)

  // Bridge: P1 east rim -> companion platform west rim, sagging, curved in plan.
  const BR = [[42.5, Y1, 36], [51, Y1 - 1.2, 31], [59.5, YC, 27.5]]
  const bridgeS = kit.catmullRom(BR, { samplesPerBlock: 3 })
  for (const p of bridgeS)
    for (let dx = -3; dx <= 3; dx += 1)
      for (let dz = -3; dz <= 3; dz += 1)
        if (Math.hypot(dx, dz) <= 2.6) for (let k = -1; k <= 4; k += 1) reserve(Math.round(p[0] + dx), Math.round(p[1]) + k, Math.round(p[2] + dz))

  // ------------------------------------------------------------------ tubes (roots and limbs)
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
    const t = { segs, k, ys, yRef, min: [min[0], yRef + (min[1] - yRef) / ys, min[2]], max: [max[0], yRef + (max[1] - yRef) / ys, max[2]], samples: S, radius: s => rad(s) }
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

  // Buttress roots: vertical fins (ys < 1 stretches the section upright) that leave the trunk
  // high and dive into the soil 12-16 blocks out; two of them grip boulders.
  const BOULDERS = [
    { th: deg(150), r: [3.4, 2.6, 3.0] },
    { th: deg(-25), r: [3.0, 2.4, 2.8] },
  ]
  for (const bo of BOULDERS) {
    const [x, , z] = polarAt(g0, bo.th, 14)
    bo.c = [x, ground(Math.round(x), Math.round(z)) + 0.6, z]
  }
  const ROOTS = [deg(150), deg(-25), deg(50), deg(100), deg(205), deg(262), deg(-80)]
  ROOTS.forEach((th, i) => {
    const reach = 13 + 2.5 * Math.sin(i * 2.3)
    const p = (r, y) => polarAt(y, th + 0.07 * Math.sin(r * 0.4 + i), r)
    const bo = BOULDERS.find(o => o.th === th)
    const pts = bo
      ? [p(2, g0 + 10), p(6, g0 + 6), p(9, g0 + 3.5), [bo.c[0], bo.c[1] + bo.r[1] + 0.2, bo.c[2]], p(reach + 4, g0 - 2.5)]
      : [p(2, g0 + 10), p(6, g0 + 5.5), p(10, g0 + 1.5), p(reach, g0 - 1), p(reach + 3, g0 - 3)]
    tube(pts, 2.4, 0.9, { k: 2.6, ys: bo ? 0.85 : 0.6 })
  })

  // Limbs. Fork limbs FA-FD split from the crotch at y ~40; lateral limbs L1-L5 carry the
  // platforms and the lower crown. L1 runs under the hall and drops to the ground beyond it as
  // a banyan prop root, so the cantilevered lobe has a visible support.
  const LIMBS = {
    FA: tube([[31, 36, 36.5], [27, 47, 32.5], [22, 57, 28], [17, 64, 24], [14, 68, 22]], 3.3, 1.4, { k: 2.6 }),
    FB: tube([[32, 36, 36.5], [38, 46, 34.5], [45, 54, 32], [51, 60, 30], [54, 64, 29]], 3.1, 1.3, { k: 2.6 }),
    FC: tube([[31.5, 36, 37], [32, 49, 40.5], [31, 61, 43], [30, 72, 43], [30.5, 79, 42]], 3.3, 1.3, { k: 2.6 }),
    FD: tube([[31, 36, 37.5], [27, 46, 42], [22, 54, 47], [17, 60, 51], [14, 63, 53]], 2.8, 1.2, { k: 2.4 }),
    L1: tube([[31.4, 12, 40], [31, 16, 45], [30.5, 19, 51], [30.2, 20.2, 56], [30.6, 21.4, 61], [31.2, 19, 65.5], [31.8, 13, 68], [32, ground(32, 69) - 2, 69]], 2.8, 1.2, { k: 2.2, rf: s => (s < 0.75 ? lerp(2.8, 1.35, s / 0.75) : lerp(1.35, 1.7, (s - 0.75) / 0.25)) }),
    L2: tube([[30, 27, 37.5], [25, 31.5, 38.6], [20, 34.6, 39.8], [15, 35.6, 40.8], [11, 38, 41.5], [8, 42, 42], [6.5, 47, 42]], 2.5, 1.0, { k: 2.2 }),
    L3: tube([[31, 17, 34], [30, 21, 28], [28.5, 25, 22], [27, 30, 17], [26, 35, 13]], 2.3, 1.0, { k: 2.2 }),
    L4: tube([[33, 30, 37.5], [39, 34, 39.5], [45, 38, 41.5], [50, 43, 43], [53, 48, 44]], 2.0, 0.9, { k: 2.0 }),
    L5: tube([[30, 19, 40], [25, 23, 45], [20, 27, 50], [16, 31, 54], [13, 35, 57]], 2.0, 0.9, { k: 2.0 }),
  }

  const BARK = 'minecraft:brown_wool' // placeholder: shaded into a mixed bark ramp later
  const barkNoise = (x, y, z) => 0.55 * noise.fbm3(x, y * 0.3, z, { scale: 2.4, octaves: 2, seed: 61 })
  const treeSdf = (x, y, z) => {
    let d = trunkD(x, y, z)
    for (const t of tubes) {
      if (x < t.min[0] || x > t.max[0] || y < t.min[1] || y > t.max[1] || z < t.min[2] || z > t.max[2]) continue
      const dt = sdTube(t, x, y, z)
      if (dt < Infinity) d = smin(d, dt, t.k) // (smin with Infinity is NaN: 0 * Infinity)
    }
    return d + barkNoise(x, y, z)
  }
  b.sdf([4, g0 - 6, 10], [60, 82, 74], treeSdf, BARK, { mask: free })
  for (const bo of BOULDERS) b.boulder(bo.c, bo.r, 'minecraft:light_gray_wool', { seed: 3 })

  // ------------------------------------------------------------------ crown
  // Secondary branches sprout from the outer part of every limb (alternating sides, rising
  // 20-50 degrees); each tip carries a flat-bottomed leaf cluster. Clusters overlap into
  // lumpy tiers but leave gaps where the limbs show through.
  const LEAF = 'minecraft:oak_leaves'
  const crown = []
  const rng = kit.rng(77)
  // One branch: a bowed tapered tube (or a 1-wide connected line when thin); recurses into
  // 2 children that fan out around the vertical. Leaves go on the last generation's tips.
  const branch = (p, head, el, len, r, depth, blobR) => {
    const e = [p[0] + Math.cos(head) * Math.cos(el) * len, p[1] + Math.sin(el) * len, p[2] + Math.sin(head) * Math.cos(el) * len]
    if (!inB(Math.round(e[0]), Math.round(e[1]), Math.round(e[2])) || e[0] < 3 || e[0] > W - 4 || e[2] < 3 || e[2] > D - 4) return
    const m = [(p[0] + e[0]) / 2, (p[1] + e[1]) / 2 + len * 0.08, (p[2] + e[2]) / 2]
    if (r >= 0.8) b.tubeAlong([p, m, e], q => r * (1 - 0.35 * q), BARK, { mask: free })
    else b.curve([p, m, e], BARK, { radius: 0, mask: free })
    if (depth === 0) {
      crown.push([e, blobR * rng.range(0.85, 1.1)])
      return
    }
    for (const side of [-1, 1]) {
      const h2 = head + side * rng.range(0.45, 0.85)
      const el2 = clamp(el + rng.range(-0.25, 0.3), 0.15, 1.0)
      branch(e, h2, el2, len * rng.range(0.55, 0.7), r * 0.62, depth - 1, blobR)
    }
  }
  const sprout = (t, { count, from = 0.45, len = [7, 10], up = [0.3, 0.7], r0 = 1.4, blob = 4.6, tipBlob = 6, depth = 1 }) => {
    const S = t.samples
    for (let i = 0; i < count; i += 1) {
      const s = from + ((1 - from) * (i + 0.5)) / count
      const idx = clamp(Math.round(s * (S.length - 1)), 1, S.length - 2)
      const p = S[idx]
      const dir = norm3([S[idx + 1][0] - S[idx - 1][0], S[idx + 1][1] - S[idx - 1][1], S[idx + 1][2] - S[idx - 1][2]])
      const head = Math.atan2(dir[2], dir[0]) + (i % 2 ? 1 : -1) * rng.range(0.7, 1.3)
      branch(p, head, rng.range(up[0], up[1]), rng.range(len[0], len[1]), Math.min(r0, t.radius(s) * 0.75), depth, blob)
    }
    // the limb's own tip forks once more into a crown lobe
    const tip = S.at(-1)
    const d = norm3([tip[0] - S.at(-3)[0], tip[1] - S.at(-3)[1], tip[2] - S.at(-3)[2]])
    const head = Math.atan2(d[2], d[0])
    for (const side of [-1, 1]) branch(tip, head + side * 0.6, 0.5, 6, 1.0, 0, tipBlob)
    crown.push([tip, tipBlob])
  }
  sprout(LIMBS.FA, { count: 4, blob: 4.8, tipBlob: 6 })
  sprout(LIMBS.FB, { count: 4, blob: 4.8, tipBlob: 6 })
  sprout(LIMBS.FC, { count: 4, blob: 5, tipBlob: 6.5, up: [0.4, 0.9] })
  sprout(LIMBS.FD, { count: 3, blob: 4.6, tipBlob: 5.5 })
  sprout(LIMBS.L2, { count: 2, from: 0.7, blob: 4.2, tipBlob: 5, depth: 0 })
  sprout(LIMBS.L3, { count: 3, from: 0.4, blob: 4.4, tipBlob: 5.5 })
  sprout(LIMBS.L4, { count: 3, from: 0.4, blob: 4.4, tipBlob: 5.5 })
  sprout(LIMBS.L5, { count: 3, from: 0.4, blob: 4.2, tipBlob: 5 })

  const cluster = ([cx, cy, cz], r, seed, leaf = LEAF) => {
    const ryUp = r * 0.6
    const ryDown = r * 0.32
    const R = Math.ceil(r * 1.35) + 1
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x += 1)
      for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y += 1)
        for (let z = Math.floor(cz - R); z <= Math.ceil(cz + R); z += 1) {
          if (!inB(x, y, z) || isRes(x, y, z)) continue
          const ry = y >= cy ? ryUp : ryDown
          const d = Math.sqrt(((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / r) ** 2)
          const wob = 1 + 0.3 * noise.fbm3(x, y, z, { scale: 3.2, octaves: 2, seed: seed + 3 })
          if (d > wob) continue
          if (d > wob - 0.35 && kit.hash01(x, y, z, seed + 17) < 0.14) continue
          if (b.get(x, y, z)) continue
          b.set(x, y, z, leaf)
        }
  }
  crown.forEach(([c, r], i) => {
    cluster([c[0], c[1] + 1, c[2]], r, i * 13 + 5)
    const off = [rng.range(-1.5, 1.5), r * 0.45, rng.range(-1.5, 1.5)]
    cluster([c[0] + off[0], c[1] + 1 + off[1], c[2] + off[2]], r * 0.6, i * 13 + 9)
  })

  // ------------------------------------------------------------------ companion tree
  // A younger tree across the stream: leaning trunk with a small root flare, four limbs and
  // cherry-blossom plates (the scene's one warm accent hue).
  const CHERRY = 'minecraft:cherry_leaves'
  const cTrunk = [[C[0], gC - 3, C[1]], [C[0] + 0.8, gC + 10, C[1] - 0.6], [C[0] - 0.2, gC + 22, C[1] + 0.3], [C[0] + 1.2, gC + 32, C[1] - 0.8]]
  const cR = s => 2.3 * (1 - 0.45 * s) + 2.0 * (1 - s) ** 10
  b.tubeAlong(cTrunk, cR, BARK)
  for (let i = 0; i < 5; i += 1) {
    const th = deg(20 + i * 72 + 12 * Math.sin(i * 3))
    const p = (r, y) => [C[0] + Math.cos(th) * r, y, C[1] + Math.sin(th) * r]
    b.tubeAlong([p(1, gC + 4), p(4, gC + 1.5), p(7.5, gC - 1)], s => 1.5 - 0.6 * s, BARK)
  }
  const cTop = cTrunk.at(-1)
  const cCrown = []
  ;[deg(25), deg(115), deg(200), deg(290)].forEach((th, i) => {
    const s0 = [cTop[0], cTop[1] - 4 + i, cTop[2]]
    const L = 7 + (i % 2) * 2
    const e = [s0[0] + Math.cos(th) * L, s0[1] + 3.5, s0[2] + Math.sin(th) * L]
    b.tubeAlong([s0, [lerp(s0[0], e[0], 0.5), s0[1] + 2.5, lerp(s0[2], e[2], 0.5)], e], q => 1.2 * (1 - 0.35 * q), BARK)
    for (const side of [-1, 1]) {
      const t2 = [e[0] + Math.cos(th + side * 0.7) * 4, e[1] + 1.5, e[2] + Math.sin(th + side * 0.7) * 4]
      b.curve([e, t2], BARK, { radius: 0 })
      cCrown.push(t2)
    }
    cCrown.push(e)
  })
  cCrown.push([cTop[0], cTop[1] + 2, cTop[2]])
  cCrown.forEach((c, i) => cluster([c[0], c[1] + 0.5, c[2]], 4.2 + (i % 3) * 0.5, 500 + i * 7, CHERRY))

  // ------------------------------------------------------------------ structure
  const lantern = 'minecraft:lantern[hanging=false]'
  const soulLantern = 'minecraft:soul_lantern[hanging=false]'
  const stairHead = new Set()
  for (const s of stairCells.values()) for (let k = 1; k <= 3; k += 1) if (inB(s.x, s.y + k, s.z)) stairHead.add(b.key(s.x, s.y + k, s.z))
  const isStair = (x, y, z) => inB(x, y, z) && stairCells.has(b.key(x, y, z))
  const isHead = (x, y, z) => inB(x, y, z) && stairHead.has(b.key(x, y, z))

  // Platform decks: birch planks, a stripped-birch rim beam (log axis along the edge), an
  // upside-down stair corbel under the rim, a birch fence railing with lantern posts.
  const platform = (inside, Y, { center, postEvery = 7, open = () => false, light = lantern }) => {
    const cells = []
    for (let x = 0; x < W; x += 1)
      for (let z = 0; z < D; z += 1) {
        if (!inside(x, z) || isStair(x, Y, z) || isHead(x, Y, z)) continue
        const n = b.nameAt(x, Y, z)
        if (n && !/_leaves$/.test(n)) continue // bark of the tree stays
        cells.push([x, z])
      }
    const set = new Set(cells.map(([x, z]) => x * 1000 + z))
    const isDeck = (x, z) => set.has(x * 1000 + z)
    const rim = []
    for (const [x, z] of cells) {
      let nx = 0
      let nz = 0
      let edge = false
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (isDeck(x + dx, z + dz)) continue
        if (b.nameAt(x + dx, Y, z + dz) === BARK) continue // against the trunk
        if (isStair(x + dx, Y, z + dz) || isStair(x + dx, Y + 1, z + dz)) continue // stair joins the deck
        edge = true
        nx += dx
        nz += dz
      }
      if (edge) rim.push({ x, z, nx, nz })
    }
    for (const [x, z] of cells) b.set(x, Y, z, 'minecraft:birch_planks')
    for (const r of rim) {
      const axis = Math.abs(r.nx) >= Math.abs(r.nz) ? 'z' : 'x'
      b.set(r.x, Y, r.z, `minecraft:stripped_birch_log[axis=${axis}]`)
      if (!b.get(r.x, Y - 1, r.z)) b.set(r.x, Y - 1, r.z, `minecraft:birch_stairs[facing=${kit.facingFrom(-r.nx, -r.nz)},half=top]`)
    }
    rim.sort((a, c) => Math.atan2(a.z - center[1], a.x - center[0]) - Math.atan2(c.z - center[1], c.x - center[0]))
    let k = 0
    for (const r of rim) {
      if (open(r.x, r.z)) continue
      if (b.get(r.x, Y + 1, r.z)) continue
      b.set(r.x, Y + 1, r.z, 'minecraft:birch_fence')
      if (k % postEvery === 0 && !b.get(r.x, Y + 2, r.z)) b.set(r.x, Y + 2, r.z, light)
      k += 1
    }
    return { cells, rim, isDeck }
  }

  // Curved knee-brace struts: pale stripped birch ribs from the bark up to the deck rim. They
  // bow outward first, then rise, like a bracket fungus.
  const STRUT = 'minecraft:stripped_birch_wood'
  const strut = (a, c) => {
    const m = [lerp(a[0], c[0], 0.65), lerp(a[1], c[1], 0.3), lerp(a[2], c[2], 0.65)]
    b.curve([a, m, c], STRUT, { radius: 0, mask: (x, y, z) => !isStair(x, y, z) && !isHead(x, y, z) && b.nameAt(x, y, z) !== 'minecraft:birch_planks' })
  }

  const BRIDGE_A = [42, 36]
  const BRIDGE_B = [60, 27]
  const p1 = platform(deck1, Y1, { center: T, open: (x, z) => Math.hypot(x - BRIDGE_A[0], z - BRIDGE_A[1]) < 2.2 })
  const p2 = platform(deck2, Y2, { center: MUSIC, postEvery: 6, light: soulLantern })
  const pC = platform((x, z) => Math.hypot(x - C[0], z - C[1]) <= 6.6 + 0.4 * noise.fbm2(x, z, { scale: 4, seed: 12 }), YC, { center: C, postEvery: 5, open: (x, z) => Math.hypot(x - BRIDGE_B[0], z - BRIDGE_B[1]) < 2.2 })

  // struts under the ring of the hall platform (skipping the stair) and under the lobe
  for (let a = -170; a < 190; a += 32) {
    const th = deg(a)
    const rr = trunkR(Y1, th) + 4.6
    const top = polarAt(Y1 - 1, th, rr)
    const bot = polarAt(Y1 - 8, th, trunkR(Y1 - 8, th) - 0.5)
    strut(bot, top)
  }
  for (const [dx, dz] of [[-6.5, -2], [6.5, -2], [-6.5, 3], [6.5, 3], [-3.5, 6.5], [3.5, 6.5]]) {
    const top = [HALL[0] + dx, Y1 - 1, HALL[1] + dz]
    const bot = [HALL[0] + 0.3, 18.5, HALL[1] + dz * 0.6]
    strut(bot, top)
  }
  for (const a of [-60, 0, 60, 120, 180, 240]) {
    const th = deg(a)
    strut([C[0] + Math.cos(th) * 1.2, YC - 6, C[1] + Math.sin(th) * 1.2], [C[0] + Math.cos(th) * 6, YC - 1, C[1] + Math.sin(th) * 6])
  }
  for (const a of [-40, 40, 110, 250]) {
    const th = deg(a)
    strut([MUSIC[0] + 3.5, Y2 - 5, MUSIC[1]], [MUSIC[0] + Math.cos(th) * 5.5, Y2 - 1, MUSIC[1] + Math.sin(th) * 5.5])
  }

  // ------------------------------------------------------------------ pavilions
  // Round plans, stripped-birch columns standing proud of a calcite wall ring, pointed openings
  // (upside-down stairs as the arch head), a cornice, and a bell-cast oxidized copper roof.
  const ringCells = (cx, cz, r) => {
    const out = []
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x += 1)
      for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z += 1) {
        const inside = (px, pz) => Math.hypot(px - cx, pz - cz) <= r + 0.5
        if (!inside(x, z)) continue
        let edge = false
        for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) if (!inside(x + dx, z + dz)) edge = true
        if (edge) out.push([x, z, Math.atan2(z - cz, x - cx)])
      }
    return out
  }
  const angDiff = (a, c) => Math.atan2(Math.sin(a - c), Math.cos(a - c))
  const ROOF = 'oxidized_cut_copper'
  const pavilion = ({ c: [cx, cz], r, F, wallH, cols, door, bays, roofPitch, finial, glass = 'minecraft:white_stained_glass_pane', open = false }) => {
    // floor
    b.disc([cx, F - 1, cz], r - 0.5, 'minecraft:calcite')
    const wall = ringCells(cx, cz, r)
    const colAng = Array.from({ length: cols }, (_, k) => door + Math.PI / cols + (k * TAU) / cols)
    for (const [x, z, a] of wall) {
      for (let y = F; y < F + wallH; y += 1) {
        // nearest bay centre
        const k = Math.round(angDiff(a, door) / (TAU / cols))
        const bayA = door + (k * TAU) / cols
        const off = Math.abs(angDiff(a, bayA)) * r
        const isDoor = Math.abs(angDiff(bayA, door)) < 0.01 || bays?.[((k % cols) + cols) % cols] === 'arch'
        const width = isDoor ? 1.6 : 1.1
        const top = isDoor ? F + wallH - 3 : F + wallH - 3
        const bottom = isDoor ? F : F + 1
        if (open) {
          if (y === F + wallH - 1) b.set(x, y, z, `minecraft:stripped_birch_log[axis=${Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'z' : 'x'}]`)
          else if (y === F && !isDoor) b.set(x, y, z, 'minecraft:birch_fence')
          continue
        }
        if (off < width && y >= bottom && y < top) {
          b.set(x, y, z, isDoor ? 'air' : glass)
        } else if (off < width && y === top) {
          const tang = angDiff(a, bayA) > 0 ? 1 : -1
          const dirA = a + tang * Math.PI / 2 // away from the bay centre
          b.set(x, y, z, `minecraft:smooth_quartz_stairs[facing=${kit.facingFrom(-Math.cos(dirA), -Math.sin(dirA))},half=top]`)
        } else if (y === F + wallH - 1) {
          b.set(x, y, z, `minecraft:stripped_birch_log[axis=${Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'z' : 'x'}]`)
        } else {
          b.set(x, y, z, 'minecraft:calcite')
        }
      }
    }
    // columns one block proud of the wall, with a stepped foot and a corbel capital
    for (const a of colAng) {
      const x = Math.round(cx + Math.cos(a) * (r + 1))
      const z = Math.round(cz + Math.sin(a) * (r + 1))
      const inward = kit.facingFrom(cx - x, cz - z)
      for (let y = F; y < F + wallH; y += 1) b.set(x, y, z, 'minecraft:stripped_birch_log[axis=y]')
      b.set(x, F + wallH, z, `minecraft:birch_stairs[facing=${inward},half=top]`)
    }
    const roof = b.coneRoof([cx, F + wallH + 1, cz], r + 0.5, { material: ROOF, pitch: roofPitch, overhang: 2, finial })
    return { roof, colAng }
  }
  const hallDoor = Math.atan2(T[1] - HALL[1], T[0] - HALL[0])
  const hall = pavilion({ c: HALL, r: HALL_R, F: Y1 + 1, wallH: 6, cols: 8, door: hallDoor, bays: { 4: 'arch' }, roofPitch: [0.5, 0.5, 1, 1, 2, 2, 3, 3], finial: ['minecraft:end_rod[facing=up]'] })
  const musicDoor = Math.atan2(centerAt(Y2)[2] - MUSIC[1], centerAt(Y2)[0] - MUSIC[0])
  const music = pavilion({ c: MUSIC, r: MUSIC_R, F: Y2 + 1, wallH: 4, cols: 6, door: musicDoor, roofPitch: [0.5, 1, 1, 2, 3, 4], finial: ['minecraft:end_rod[facing=up]'], open: true })

  // Companion "collar" pavilion: posts in a ring round the trunk and a bell-cast roof that the
  // trunk grows straight through.
  const CR = 4.6
  for (const [x, z, a] of ringCells(C[0], C[1], CR)) {
    const post = Math.round((a + Math.PI) / (TAU / 8)) * (TAU / 8) - Math.PI
    const isPost = Math.abs(angDiff(a, post)) * CR < 0.6
    for (let y = YC + 1; y <= YC + 4; y += 1) {
      if (y === YC + 4) b.set(x, y, z, `minecraft:stripped_birch_log[axis=${Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'z' : 'x'}]`)
      else if (isPost) b.set(x, y, z, 'minecraft:stripped_birch_log[axis=y]')
    }
  }
  b.coneRoof([C[0], YC + 5, C[1]], CR + 0.5, { material: ROOF, pitch: [0.5, 0.5, 1, 1, 2, 2], overhang: 2 })
  b.tubeAlong(cTrunk, cR, BARK, { mask: (x, y, z) => y > YC + 4 })

  // ------------------------------------------------------------------ spiral stair
  // Birch stairs with a top-slab soffit (the ribbon reads 1.5 blocks thick from afar), a fence
  // railing on the outer edge, lantern posts every 4 steps and a strut every 3.
  const steps = new Map()
  for (const s of stairCells.values()) {
    b.set(s.x, s.y, s.z, `minecraft:birch_stairs[facing=${s.facing},half=bottom]`)
    if (!b.get(s.x, s.y - 1, s.z)) b.set(s.x, s.y - 1, s.z, 'minecraft:birch_slab[type=top]')
    const key = `${s.y}`
    if (!steps.has(key) || steps.get(key).r < s.r) steps.set(key, s)
    for (let k = 1; k <= 3; k += 1) {
      const n = b.nameAt(s.x, s.y + k, s.z)
      if (n && /_leaves$|wool/.test(n)) b.remove(s.x, s.y + k, s.z)
    }
  }
  for (const s of stairCells.values()) {
    if (!s.outer) continue
    if (s.y === Y1 || s.y === Y2) continue
    if (deck1(s.x, s.z) && s.y >= Y1 - 1 && s.y <= Y1 + 1) continue
    if (!b.get(s.x, s.y + 1, s.z)) b.set(s.x, s.y + 1, s.z, 'minecraft:birch_fence')
  }
  for (const s of steps.values()) {
    if (s.y === Y1 || s.y === Y2 || s.y === footY) continue
    if (s.step % 4 === 2 && b.nameAt(s.x, s.y + 1, s.z) === 'minecraft:birch_fence') b.set(s.x, s.y + 2, s.z, soulLantern)
    if (s.step % 3 === 0) strut(polarAt(s.y - 5, s.th, trunkR(s.y - 5, s.th) - 0.3), [s.x, s.y - 1, s.z])
  }

  // ------------------------------------------------------------------ rope bridge
  // Catenary sag in elevation, gentle S in plan; birch slab deck quantized to half blocks so the
  // walking surface is smooth, fence rails, lantern posts at the thirds.
  const bridgeCells = new Map()
  for (let i = 0; i < bridgeS.length; i += 1) {
    const p = bridgeS[i]
    const q = bridgeS[Math.min(bridgeS.length - 1, i + 1)]
    const o = bridgeS[Math.max(0, i - 1)]
    const tx = q[0] - o[0]
    const tz = q[2] - o[2]
    const tl = Math.hypot(tx, tz) || 1
    const sx = -tz / tl
    const sz = tx / tl
    const surf = Math.round((p[1] + 1) * 2) / 2
    for (const w of [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]) {
      const x = Math.round(p[0] + sx * w)
      const z = Math.round(p[2] + sz * w)
      const k = `${x},${z}`
      const edge = Math.abs(w) > 1.25
      const prev = bridgeCells.get(k)
      if (!prev || (prev.edge && !edge)) bridgeCells.set(k, { x, z, surf, edge, t: i / (bridgeS.length - 1) })
    }
  }
  for (const c of bridgeCells.values()) {
    if (deck1(c.x, c.z) || Math.hypot(c.x - C[0], c.z - C[1]) <= 6.6) continue
    const whole = c.surf % 1 === 0
    const y = whole ? c.surf - 1 : c.surf - 0.5
    b.set(c.x, y, c.z, whole ? 'minecraft:birch_slab[type=top]' : 'minecraft:birch_slab[type=bottom]')
    if (c.edge) {
      b.set(c.x, y + 1, c.z, 'minecraft:birch_fence')
      if (Math.abs(c.t - 0.33) < 0.02 || Math.abs(c.t - 0.66) < 0.02) b.set(c.x, y + 2, c.z, lantern)
    }
  }

  return b.finish({ name: 'elven-treehouse' })
}
