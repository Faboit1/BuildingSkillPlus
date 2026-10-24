// ELVEN TREEHOUSE: the Heartwood, an ancient buttressed tree carrying an elven settlement
//
// BRIEF. One hero: a colossal ancient tree whose silhouette carries a small elven settlement.
// A hall pavilion stands on a lobe of the lower platform, a music gazebo sits on a west limb,
// a spiral stair winds round the trunk, and a sagging rope bridge crosses a stream to a younger
// cherry tree with a "collar" pavilion round its trunk. The stream runs from a spring under a
// mossy outcrop to a lily pool. The forest floor has ferns, moss, mushrooms, fallen logs and
// rim trees. The lighting is planned for a magical night shot.
// References: Lothlorien and Rivendell (pale curved architecture inside living wood), kapok and
// ceiba buttress roots, banyan prop roots, community elven treehouses (platform rings, curved
// brackets, lanterns on chains).
//
// SCALE (canvas 80 x 92 x 80). The tree is 79 tall. The trunk radius is 6.8 at the ground plus
// 3.2 of root flare (about 20 across with the flutes) and 4.5 at the fork (y 44). Seven fin
// buttress roots reach 13-17 out. The crown is about 58 wide and 25 tall: five big masses and
// one lower shelf, each about 2.3 : 1 wide-to-tall. The platforms are at y 24 (hall; the
// deck is ring plus lobe, ~30 across), y 38 (music) and y 26 (companion). The hall is 13
// across, with walls 6 tall and a roof 12 tall (elven roofs run about twice their walls).
// Openings are at player scale: arches 2 wide x 3 tall, stair steps rise 1.
//
// PALETTE (role: blocks, L*)
//   bark    spruce_wood 17 / dark_oak_wood 20 / mangrove_wood 29 / oak_wood 38, shaded by surface
//           normal + occlusion (b.shadeSurface); moss_block 43 on upward faces, heavier low down
//   leaves  spruce leaves 29 (shadowed underside) -> oak / dark oak 38-40 (body) -> azalea 45 +
//           flowering azalea (sunlit top); cherry leaves 76 on the companion (the warm accent)
//   walls   calcite 89 (wall field); stripped birch 72 (columns, ring beams, deck rims, brackets);
//           birch planks 72 (decks); smooth quartz stairs (arch heads, column feet)
//   roofs   oxidized cut copper 58: 31 L* below the calcite walls. The teal is the cool
//           complement to the pink cherry and the warm lanterns.
//   lights  lantern, soul lantern, pearlescent froglight capitals, shroomlights in the bracket
//           tips and canopy hearts, end-rod finials, glow lichen, glow berries
//   ground  grass / podzol / moss / coarse dirt by shade and wetness; calcite + polished diorite
//           stepping stones; stone / andesite / tuff / mossy cobble rocks
//
// TECHNIQUES WORTH STEALING (each section explains why)
//   1. The trunk is a signed-distance field, not a cylinder. Its radius(y, theta) combines a
//      taper, an exponential root flare and five twisting flutes. It is smooth-unioned (smin)
//      with fin-shaped buttress roots and the limbs, plus vertically stretched bark noise
//      (furrows) that the shading pass picks up.
//   2. The architecture is planned BEFORE the tree is rasterized. Decks, pavilion volumes, the
//      stair helix and the bridge corridor are reserved, and every bark/leaf placement is
//      masked out of them. The tree grows around the settlement; nothing is carved afterwards.
//   3. The crown is a few large, flattened masses with lumpy sub-lobes, ragged undersides,
//      see-through gaps and a vertical leaf-shade gradient. It is not one ball per branch
//      ("broccoli"). Secondary branches are steered so they end inside a mass.
//   4. The roofs are bell-cast solids of revolution quantized to half blocks: a stair on every
//      sloped course, slabs on the flared eave, an upturned lip.
//   5. Ground work (paths, plants) reads the heightmap, never b.topY: under a canopy, the top
//      block of a column is a leaf.
//   6. Night: the renderer lights each face from its brightest emitter within 18 blocks, so
//      the glow comes from full-block emitters placed where they wash surfaces: froglight
//      column capitals, shroomlights cupped in the deck brackets, lanterns hung on chains.
//
// STAGES: STAGE=structure renders the placeholders (brown wool bark, grey wool rock);
// STAGE=texture adds shading and moss; the default (detail) adds plants, lights and props.

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
  const STAGES = ['structure', 'texture', 'detail']
  const stage = STAGES.indexOf(process.env.STAGE ?? 'detail')
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
  // A placed structure does not flow, but in game water touching air at its side would spill
  // (low spots on the rim bevel): give every such cell a little earth levee instead.
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1)
      for (let y = 1; y <= WATER; y += 1) {
        if (b.nameAt(x, y, z) !== 'minecraft:water') continue
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (b.get(x + dx, y, z + dz) || !inB(x + dx, y, z + dz)) continue
          for (let yy = 0; yy <= y; yy += 1) if (!b.get(x + dx, yy, z + dz)) b.set(x + dx, yy, z + dz, yy === y ? 'minecraft:grass_block' : 'minecraft:dirt')
        }
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
  const HALL = [30, 55] // hall pavilion centre on the south lobe of the lower platform
  const HALL_R = 6
  const MUSIC = [18.7, 40.4] // music pavilion on the west limb
  const MUSIC_R = 4
  const deck1 = (x, z) => {
    const c = centerAt(Y1)
    const th = Math.atan2(z - c[2], x - c[0])
    const ring = Math.hypot(x - c[0], z - c[2]) <= trunkR(Y1, th) + 5.2 + 0.8 * noise.fbm2(x, z, { scale: 5, seed: 8 })
    const lobe = Math.hypot(x - HALL[0], z - HALL[1]) <= 9.5 + 0.5 * noise.fbm2(x, z, { scale: 4, seed: 9 })
    return ring || lobe
  }
  const deck2 = (x, z) => Math.hypot(x - MUSIC[0], z - MUSIC[1]) <= 6 + 0.5 * noise.fbm2(x, z, { scale: 4, seed: 10 })
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      if (deck1(x, z)) for (let y = Y1; y <= Y1 + 3; y += 1) reserve(x, y, z)
      if (deck2(x, z)) for (let y = Y2; y <= Y2 + 3; y += 1) reserve(x, y, z)
    }
  reserveCyl(HALL[0], HALL[1], HALL_R + 3.5, Y1, Y1 + 22)
  reserveCyl(MUSIC[0], MUSIC[1], MUSIC_R + 3.5, Y2, Y2 + 14)
  const gC = ground(C[0], C[1])
  const YC = 26 // companion platform deck
  reserveCyl(C[0], C[1], 8, YC, YC + 15)

  // Bridge: P1 east rim -> companion platform west rim. Plan: a gentle S (Catmull-Rom through
  // three points). Elevation: a catenary hung between the two deck surfaces, sagging 3 blocks.
  const BR_PLAN = [[42.5, 36], [51, 30.5], [59.5, 27.5]]
  const BR_Y = [Y1 + 1, YC + 1] // walking surfaces at the ends
  const SAG = 3
  const cat = t => { const a = 1.6; return (Math.cosh(a * (2 * t - 1)) - 1) / (Math.cosh(a) - 1) } // 1 at ends, 0 mid
  const bridgeS = kit.catmullRom(BR_PLAN.map(([x, z]) => [x, 0, z]), { samplesPerBlock: 4 }).map((p, i, arr) => {
    const t = i / (arr.length - 1)
    return [p[0], lerp(BR_Y[0], BR_Y[1], t) - SAG * (1 - cat(t)) - 1, p[2]]
  })
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

  // Limbs. Fork limbs FA-FD split from the crotch at y ~40; lateral limbs L1-L4 carry the
  // platforms and the lower crown. L1 runs under the hall and drops to the ground beyond it as
  // a banyan prop root, so the cantilevered lobe has a visible support.
  const LIMBS = {
    FA: tube([[31, 36, 36.5], [27, 47, 32.5], [22, 57, 28], [17, 64, 24], [14, 68, 22]], 3.3, 1.4, { k: 2.6 }),
    FB: tube([[32, 36, 36.5], [38, 46, 34.5], [45, 54, 32], [51, 60, 30], [54, 64, 29]], 3.1, 1.3, { k: 2.6 }),
    FC: tube([[31.5, 36, 37], [32, 49, 40.5], [31, 60, 43], [30, 69, 43], [30.5, 75, 42]], 3.3, 1.3, { k: 2.6 }),
    FD: tube([[31, 36, 37.5], [27, 46, 42], [22, 54, 47], [17, 60, 51], [14, 63, 53]], 2.8, 1.2, { k: 2.4 }),
    L1: tube([[31.4, 12, 40], [31, 16, 45], [30.5, 19, 51], [30.2, 20.2, 56], [30.6, 21.4, 61], [31.2, 19, 65.5], [31.8, 13, 68], [32, ground(32, 69) - 2, 69]], 2.8, 1.2, { k: 2.2, rf: s => (s < 0.75 ? lerp(2.8, 1.35, s / 0.75) : lerp(1.35, 1.7, (s - 0.75) / 0.25)) }),
    L2: tube([[30, 27, 37.5], [25, 31.5, 38.6], [20, 34.6, 39.8], [15, 35.6, 40.8], [11, 38.5, 41.5], [8.5, 43, 43], [8, 50, 46], [9.5, 56, 49]], 2.5, 1.0, { k: 2.2 }),
    L3: tube([[31, 17, 34], [30, 21, 28], [28.5, 25, 22], [27, 30, 17], [26, 35, 13]], 2.3, 1.0, { k: 2.2 }),
    L4: tube([[33, 30, 37.5], [39, 34, 39.5], [45, 39, 41.5], [50, 46, 42], [52, 55, 39.5]], 2.0, 0.9, { k: 2.0 }),
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
  // The crown is a few big, flattened (about 2.5:1), overlapping leaf masses sitting on the limb
  // ends, NOT one ball per branch tip (the "broccoli" look). The masses are planned first; then
  // secondary branches sprout from the outer half of every limb and are steered so their tips
  // end inside a mass (no bare twig ends, no satellite puffs). Gaps between and inside the
  // masses let the limbs show through.
  const MASSES = [
    { c: [30, 72, 40], r: [14, 6, 13], seed: 101 }, // crown top, on the leader FC
    { c: [18, 66, 26], r: [13, 5.5, 11], seed: 102 }, // north-west, on FA
    { c: [47, 64, 33], r: [12, 5.5, 11], seed: 103 }, // east, on FB
    { c: [17, 62, 50], r: [12, 5, 10.5], seed: 104 }, // south-west, on FD and L2
    { c: [38, 65, 52], r: [10, 4.8, 9], seed: 105 }, // south, a roof of leaves over the hall
    { c: [26, 39, 15], r: [10, 3.2, 8], seed: 106 }, // one lower shelf (north, behind the trunk), on L3
  ]
  const massD = ([x, y, z], { c, r }) => Math.sqrt(((x - c[0]) / r[0]) ** 2 + ((y - c[1]) / r[1]) ** 2 + ((z - c[2]) / r[2]) ** 2)
  const inMass = (p, k = 0.8) => MASSES.some(m => massD(p, m) <= k)
  const nearestMass = p => MASSES.reduce((best, m) => (massD(p, m) < massD(p, best) ? m : best), MASSES[0])

  const LEAF = 'minecraft:oak_leaves'
  const rng = kit.rng(77)
  const twigs = [] // [start, end] of every secondary branch (for the bark-grain pass)
  // One branch: a bowed tapered tube (or a 1-wide connected line when thin); recurses into
  // 2 children that fan out round the vertical. Final tips are pulled into the nearest mass.
  const branch = (p, head, el, len, r, depth) => {
    let e = [p[0] + Math.cos(head) * Math.cos(el) * len, p[1] + Math.sin(el) * len, p[2] + Math.sin(head) * Math.cos(el) * len]
    if (depth === 0 && !inMass(e)) {
      const m = nearestMass(e)
      for (let k = 0; k < 10 && !inMass(e); k += 1) e = e.map((v, i) => lerp(v, m.c[i], 0.15))
    }
    if (e[0] < 3 || e[0] > W - 4 || e[2] < 3 || e[2] > D - 4 || e[1] > H - 4) return
    const m = [(p[0] + e[0]) / 2, (p[1] + e[1]) / 2 + len * 0.08, (p[2] + e[2]) / 2]
    twigs.push([p, e])
    if (r >= 0.8) b.tubeAlong([p, m, e], q => r * (1 - 0.35 * q), BARK, { mask: free })
    else b.curve([p, m, e], BARK, { radius: 0, mask: free })
    if (depth === 0) return
    for (const side of [-1, 1]) {
      const h2 = head + side * rng.range(0.45, 0.85)
      const el2 = clamp(el + rng.range(-0.25, 0.3), 0.15, 1.0)
      branch(e, h2, el2, len * rng.range(0.55, 0.7), r * 0.62, depth - 1)
    }
  }
  const sprout = (t, { count, from = 0.45, len = [7, 10], up = [0.3, 0.7], r0 = 1.4, depth = 1 }) => {
    const S = t.samples
    for (let i = 0; i < count; i += 1) {
      const s = from + ((1 - from) * (i + 0.5)) / count
      const idx = clamp(Math.round(s * (S.length - 1)), 1, S.length - 2)
      const p = S[idx]
      const dir = norm3([S[idx + 1][0] - S[idx - 1][0], S[idx + 1][1] - S[idx - 1][1], S[idx + 1][2] - S[idx - 1][2]])
      const head = Math.atan2(dir[2], dir[0]) + (i % 2 ? 1 : -1) * rng.range(0.7, 1.3)
      branch(p, head, rng.range(up[0], up[1]), rng.range(len[0], len[1]), Math.min(r0, t.radius(s) * 0.75), depth)
    }
  }
  sprout(LIMBS.FA, { count: 4 })
  sprout(LIMBS.FB, { count: 4 })
  sprout(LIMBS.FC, { count: 5, up: [0.3, 0.8] })
  sprout(LIMBS.FD, { count: 3 })
  sprout(LIMBS.L2, { count: 2, from: 0.75, depth: 0 })
  sprout(LIMBS.L3, { count: 3, from: 0.5, len: [5, 7] })
  sprout(LIMBS.L4, { count: 3, from: 0.5, len: [5, 7] })

  // Leaves are shaded by height inside each mass: shadowed underside in spruce leaves (dark
  // blue-green), body in oak / dark oak (same green, different texture), sunlit top in azalea
  // with flowering clumps. Coherent noise keeps every accent in clumps.
  const leafShade = (x, y, z, v) => {
    const n = noise.coherent01(x, y, z, { scale: 3, grain: 0.1, seed: 41 })
    const t = v + 0.18 * (noise.coherent01(x, y, z, { scale: 4, seed: 42 }) - 0.5)
    if (t < 0.3) return n < 0.65 ? 'minecraft:spruce_leaves' : 'minecraft:dark_oak_leaves'
    if (t < 0.68) return n < 0.55 ? 'minecraft:oak_leaves' : 'minecraft:dark_oak_leaves'
    return n < 0.45 ? 'minecraft:azalea_leaves' : n < 0.58 ? 'minecraft:flowering_azalea_leaves' : 'minecraft:oak_leaves'
  }
  // A mass: a main ellipsoid plus three offset sub-lobes (a lumpy, cloud-like outline instead of
  // a smooth lens), a ragged underside (2D noise lets lobes hang down) and see-through gaps.
  const crownMass = ([cx, cy, cz], [rx, ry, rz], seed, paint = leafShade) => {
    const down = ry * 0.6
    const lr = kit.rng(seed)
    const lobes = [{ c: [cx, cy, cz], r: [rx, ry, rz] }]
    for (let i = 0; i < 3; i += 1) {
      const a = lr() * TAU
      lobes.push({ c: [cx + Math.cos(a) * rx * 0.55, cy + ry * lr.range(0.1, 0.45), cz + Math.sin(a) * rz * 0.55], r: [rx * 0.55, ry * 0.75, rz * 0.55] })
    }
    const bottom = cy - down
    const top = cy + ry * 1.3
    for (let x = Math.floor(cx - rx * 1.4); x <= Math.ceil(cx + rx * 1.4); x += 1)
      for (let z = Math.floor(cz - rz * 1.4); z <= Math.ceil(cz + rz * 1.4); z += 1) {
        const hang = 0.6 * noise.fbm2(x, z, { scale: 3, seed: seed + 5 }) + 0.35 * noise.fbm2(x, z, { scale: 7, seed: seed + 6 })
        for (let y = Math.floor(cy - down * 2.4); y <= Math.ceil(top + 2); y += 1) {
          if (!inB(x, y, z) || isRes(x, y, z)) continue
          let d = Infinity
          for (const L of lobes) {
            const dy = y - L.c[1]
            const ryy = dy >= 0 ? L.r[1] : L.r[1] * 0.6 * (1 + Math.max(0, hang) * 1.8)
            d = Math.min(d, Math.sqrt(((x - L.c[0]) / L.r[0]) ** 2 + (dy / ryy) ** 2 + ((z - L.c[2]) / L.r[2]) ** 2))
          }
          const wob = 1 + 0.26 * noise.fbm3(x, y, z, { scale: 6, octaves: 2, seed: seed + 3 }) + 0.12 * noise.fbm3(x, y, z, { scale: 2.4, octaves: 1, seed: seed + 4 })
          if (d > wob) continue
          if ((wob - d) * Math.min(rx, ry) > 2.6) continue // hollow: only a shell ~2.5 thick is ever seen
          if (d > 0.45 && noise.coherent01(x, y * 1.6, z, { scale: 5, grain: 0, seed: seed + 8 }) < 0.12) continue // gaps
          if (b.get(x, y, z)) continue
          b.set(x, y, z, paint(x, y, z, clamp((y - bottom) / (top - bottom), 0, 1)))
        }
      }
  }
  for (const m of MASSES) crownMass(m.c, m.r, m.seed)
  const cluster = ([cx, cy, cz], r, seed, paint = leafShade) => crownMass([cx, cy, cz], [r, r * 0.45, r], seed, paint)
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
  // cherry crown: one wide plate over the top and two lower side lobes, plus small clusters on
  // twig ends that stick out
  const cherry = () => CHERRY
  const cherryMasses = [
    { c: [cTop[0], cTop[1] + 4, cTop[2]], r: [9, 3.4, 8.5] },
    { c: [cTop[0] + 6, cTop[1] + 1.5, cTop[2] + 3], r: [5.5, 2.6, 5] },
    { c: [cTop[0] - 5, cTop[1] + 2, cTop[2] - 4], r: [5, 2.5, 5] },
  ]
  cherryMasses.forEach((m, i) => crownMass(m.c, m.r, 501 + i, cherry))
  cCrown.forEach((c, i) => { if (!cherryMasses.some(m => massD(c, m) <= 1.1)) cluster([c[0], c[1] + 0.5, c[2]], 3, 500 + i * 7, cherry) })

  // ------------------------------------------------------------------ structure
  const lantern = 'minecraft:lantern[hanging=false]'
  const soulLantern = 'minecraft:soul_lantern[hanging=false]'
  const stairHead = new Set()
  for (const s of stairCells.values()) for (let k = 1; k <= 3; k += 1) if (inB(s.x, s.y + k, s.z)) stairHead.add(b.key(s.x, s.y + k, s.z))
  const isStair = (x, y, z) => inB(x, y, z) && stairCells.has(b.key(x, y, z))
  const isHead = (x, y, z) => inB(x, y, z) && stairHead.has(b.key(x, y, z))

  // Platform decks: birch planks, a stripped-birch rim beam (log axis along the edge), an
  // upside-down stair corbel under the rim, a birch fence railing with lantern posts.
  const platform = (inside, Y, { center, postEvery = 5, open = () => false, light = lantern }) => {
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
      b.set(r.x, Y, r.z, 'minecraft:stripped_birch_wood')
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

  // Rib brackets: 1-wide pale fins radiating from the bark (or a limb) to the deck rim. The
  // underside follows a concave curve (deep at the trunk, thin at the rim) and every step of it
  // gets an upside-down stair, so the fin reads as a smooth bracket-fungus curve, not a stair.
  const STRUT = 'minecraft:stripped_birch_wood'
  const rib = (cx, cz, th, Y, rFrom, rTo, depth, light = false) => {
    const seen = new Set()
    let last = null
    const inward = kit.facingFrom(-Math.cos(th), -Math.sin(th))
    for (let r = rFrom; r <= rTo; r += 0.3) {
      const x = Math.round(cx + Math.cos(th) * r)
      const z = Math.round(cz + Math.sin(th) * r)
      if (seen.has(x * 1000 + z)) continue
      seen.add(x * 1000 + z)
      const u = clamp((r - rFrom) / (rTo - rFrom), 0, 1)
      const bot = Y - 1 - depth * (1 - u) ** 2
      const yb = Math.round(bot)
      for (let y = yb; y <= Y - 1; y += 1) if (!b.get(x, y, z) && !isStair(x, y, z) && !isHead(x, y, z)) b.set(x, y, z, STRUT)
      if (!b.get(x, yb - 1, z) && !isHead(x, yb - 1, z)) b.set(x, yb - 1, z, `minecraft:birch_stairs[facing=${inward},half=top]`)
      last = [x, yb, z]
    }
    // a shroomlight cupped in the bracket tip: the deck rim glows from below at night
    if (light && last) b.set(last[0], last[1], last[2], 'minecraft:shroomlight')
  }

  const BRIDGE_A = [42, 36]
  const BRIDGE_B = [60, 27]
  const p1 = platform(deck1, Y1, { center: T, open: (x, z) => Math.hypot(x - BRIDGE_A[0], z - BRIDGE_A[1]) < 2.2 })
  const p2 = platform(deck2, Y2, { center: MUSIC, postEvery: 6, light: soulLantern })
  const pC = platform((x, z) => Math.hypot(x - C[0], z - C[1]) <= 6.6 + 0.4 * noise.fbm2(x, z, { scale: 4, seed: 12 }), YC, { center: C, postEvery: 5, open: (x, z) => Math.hypot(x - BRIDGE_B[0], z - BRIDGE_B[1]) < 2.2 })

  // ribs under the ring of the hall platform, under the lobe (springing from limb L1), under the
  // music platform and round the companion trunk
  for (let a = -180; a < 180; a += 30) {
    const th = deg(a)
    const c = centerAt(Y1)
    rib(c[0], c[2], th, Y1, trunkR(Y1 - 3, th) - 0.5, trunkR(Y1, th) + 4.6, 5, a % 60 === 0)
  }
  for (let a = 0; a < 360; a += 45) rib(HALL[0], HALL[1], deg(a + 22.5), Y1, 1.5, 8.6, 2.5, true)
  for (let a = 0; a < 360; a += 60) rib(MUSIC[0], MUSIC[1], deg(a + 30), Y2, 1, 5.6, 2.5, true)
  for (let a = 0; a < 360; a += 60) rib(C[0], C[1], deg(a + 15), YC, 1.5, 6.3, 3, true)

  // ------------------------------------------------------------------ pavilions
  // Round plans: a calcite wall ring, stripped-birch columns standing one block proud of it
  // (depth), pointed openings (upside-down quartz stairs as the arch head), a birch ring beam,
  // and a bell-cast roof of revolution in oxidized copper.
  const ringCells = (cx, cz, r) => {
    const out = []
    const inside = (px, pz) => Math.hypot(px - cx, pz - cz) <= r + 0.5
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x += 1)
      for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z += 1) {
        if (!inside(x, z)) continue
        let edge = false
        for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) if (!inside(x + dx, z + dz)) edge = true
        if (edge) out.push([x, z, Math.atan2(z - cz, x - cx)])
      }
    return out
  }
  const angDiff = (a, c) => Math.atan2(Math.sin(a - c), Math.cos(a - c))
  const tangentAxis = a => (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'z' : 'x')

  // Bell-cast roof of revolution: height above the eave h(d) = H * (1 - d/R)^p (concave: a
  // flared skirt rising into a spire) plus an upturned lip at the eave. The surface is quantized
  // to half blocks; half steps become stairs facing the apex (or slabs where the roof is flat),
  // and the shell is as thick as the local slope so it never shows a gap.
  const ROOF = kit.material('oxidized_cut_copper')
  const bellRoof = ([cx, y0, cz], R, H, { p = 1.7, lip = 0.7, wallR = 0, finial } = {}) => {
    const h0 = d => H * Math.pow(clamp(1 - d / R, 0, 1), p) + lip * clamp((d - (R - 2)) / 2, 0, 1) ** 2
    const hAt = d => (d < 1.5 ? h0(1.5) + (1.5 - d) * 1.2 : h0(d)) // no needle: the apex rises at 45 degrees
    const slopeAt = d => (hAt(Math.max(0, d - 0.5)) - hAt(d + 0.5))
    // steep rows: whole-block heights, every top cell a stair facing the apex (smooth 45-degree
    // courses, like vanilla roofs); gentle eave flare: half-block heights with slabs
    const top = d => (slopeAt(d) >= 0.6 ? Math.round(y0 + hAt(d)) : Math.round((y0 + hAt(d)) * 2) / 2)
    const cells = []
    for (let x = Math.floor(cx - R - 1); x <= Math.ceil(cx + R + 1); x += 1)
      for (let z = Math.floor(cz - R - 1); z <= Math.ceil(cz + R + 1); z += 1) {
        const d = Math.hypot(x - cx, z - cz)
        if (d > R + 0.35) continue
        const t = top(d)
        let drop = 0
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) drop = Math.max(drop, t - top(Math.hypot(x + dx - cx, z + dz - cz)))
        const whole = t % 1 === 0
        const yTop = whole ? t - 1 : Math.floor(t)
        const thick = Math.max(1, Math.ceil(drop + 0.5))
        let yBot = yTop - thick + 1
        if (wallR && Math.abs(d - wallR) < 0.9) yBot = Math.min(yBot, y0) // seat the roof on the ring beam
        for (let y = yBot; y < yTop; y += 1) b.set(x, y, z, ROOF.block)
        const facing = kit.facingFrom(cx - x, cz - z)
        if (!whole) b.set(x, yTop, z, `${ROOF.slab}[type=bottom]`)
        else if (drop >= 0.5 && d > 0.8) b.set(x, yTop, z, `${ROOF.stairs}[facing=${facing},half=bottom]`)
        else b.set(x, yTop, z, ROOF.block)
        // soffit: an upside-down stair under the outermost eave cells
        if (d > R - 0.8 && !b.get(x, yBot - 1, z)) b.set(x, yBot - 1, z, `${ROOF.stairs}[facing=${facing},half=top]`)
        cells.push([x, yTop, z])
      }
    const apex = Math.max(...cells.map(c => c[1]))
    if (finial) finial.forEach((f, i) => b.set(Math.round(cx), apex + 1 + i, Math.round(cz), f))
    return { apex, cells }
  }

  const pavilion = ({ c: [cx, cz], r, F, wallH, cols, door, bays = {}, roof, open = false, glass = 'minecraft:white_stained_glass_pane' }) => {
    b.disc([cx, F - 1, cz], r - 0.5, 'minecraft:calcite')
    const wall = ringCells(cx, cz, r)
    const step = TAU / cols
    for (const [x, z, a] of wall) {
      const k = Math.round(angDiff(a, door) / step)
      const bayA = door + k * step
      const kind = k === 0 ? 'door' : (bays[((k % cols) + cols) % cols] ?? 'solid')
      const off = Math.abs(angDiff(a, bayA)) * r
      const width = kind === 'window' ? 0.75 : 1.3
      const bottom = kind === 'window' ? F + 1 : F
      const head = F + wallH - 3
      for (let y = F; y < F + wallH; y += 1) {
        if (y === F + wallH - 1) {
          b.set(x, y, z, 'minecraft:stripped_birch_wood')
          continue
        }
        if (open) {
          if (y === F && kind !== 'door') b.set(x, y, z, 'minecraft:birch_fence')
          continue
        }
        const inOpening = kind !== 'solid' && off < width
        if (inOpening && y >= bottom && y < head) b.set(x, y, z, kind === 'window' ? glass : 'air')
        else if (inOpening && y === head && off > 0.35) {
          const dirA = a + (angDiff(a, bayA) > 0 ? 1 : -1) * (Math.PI / 2) // away from the bay centre
          b.set(x, y, z, `minecraft:smooth_quartz_stairs[facing=${kit.facingFrom(-Math.cos(dirA), -Math.sin(dirA))},half=top]`)
        } else if (inOpening && y === head) b.set(x, y, z, kind === 'window' ? glass : 'air')
        else b.set(x, y, z, 'minecraft:calcite')
      }
    }
    for (let k = 0; k < cols; k += 1) {
      const a = door + step / 2 + k * step
      const x = Math.round(cx + Math.cos(a) * (r + 1))
      const z = Math.round(cz + Math.sin(a) * (r + 1))
      const inward = kit.facingFrom(cx - x, cz - z)
      b.set(x, F - 1, z, 'minecraft:stripped_birch_wood')
      for (let y = F; y < F + wallH; y += 1) b.set(x, y, z, 'minecraft:stripped_birch_log[axis=y]')
      b.set(x, F + wallH - 1, z, 'minecraft:pearlescent_froglight[axis=y]') // glowing capital
      b.set(x, F, z, `minecraft:smooth_quartz_stairs[facing=${inward},half=bottom]`)
      b.set(x, F + wallH, z, `minecraft:birch_stairs[facing=${inward},half=top]`)
    }
    return bellRoof([cx, F + wallH, cz], r + 2.6, roof.H, { p: roof.p, wallR: r, finial: roof.finial })
  }
  const hallDoor = Math.atan2(T[1] - HALL[1], T[0] - HALL[0])
  const hall = pavilion({ c: HALL, r: HALL_R, F: Y1 + 1, wallH: 6, cols: 8, door: hallDoor,
    bays: { 2: 'window', 3: 'window', 4: 'arch', 5: 'window', 6: 'window' }, roof: { H: 12, p: 1.8, finial: ['minecraft:end_rod[facing=up]'] },
    glass: 'minecraft:light_blue_stained_glass_pane' })
  const musicC = centerAt(Y2)
  const musicDoor = Math.atan2(musicC[2] - MUSIC[1], musicC[0] - MUSIC[0])
  const music = pavilion({ c: MUSIC, r: MUSIC_R, F: Y2 + 1, wallH: 4, cols: 6, door: musicDoor, open: true, roof: { H: 9, p: 1.9, finial: ['minecraft:end_rod[facing=up]'] } })

  // Companion "collar" pavilion: posts in a ring round the trunk and a bell-cast roof that the
  // trunk grows straight through.
  const CR = 4.6
  for (const [x, z, a] of ringCells(C[0], C[1], CR)) {
    const post = Math.round((a + Math.PI) / (TAU / 8)) * (TAU / 8) - Math.PI
    const isPost = Math.abs(angDiff(a, post)) * CR < 0.6
    for (let y = YC + 1; y <= YC + 4; y += 1) {
      if (y === YC + 4) b.set(x, y, z, 'minecraft:stripped_birch_wood')
      else if (isPost) b.set(x, y, z, y === YC + 3 ? 'minecraft:pearlescent_froglight[axis=y]' : 'minecraft:stripped_birch_log[axis=y]')
    }
  }
  bellRoof([C[0], YC + 4, C[1]], CR + 2.6, 8, { p: 2.1, wallR: CR })
  b.tubeAlong(cTrunk, cR, BARK, { mask: (x, y, z) => y > YC + 4 })

  // ------------------------------------------------------------------ spiral stair
  // Birch stairs with a top-slab soffit (the ribbon reads 1.5 blocks thick from afar), a fence
  // railing on the outer edge, soul-lantern posts every 4 steps and a small corbel every 3.
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
    if (s.step % 3 === 0 && !b.get(s.x, s.y - 2, s.z)) b.set(s.x, s.y - 2, s.z, `minecraft:birch_stairs[facing=${kit.facingFrom(-Math.cos(s.th), -Math.sin(s.th))},half=top]`)
  }
  for (const s of steps.values()) {
    if (s.y === Y1 || s.y === Y2 || s.y === footY) continue
    if (s.step % 3 === 1 && b.nameAt(s.x, s.y + 1, s.z) === 'minecraft:birch_fence') b.set(s.x, s.y + 2, s.z, soulLantern)
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
      if ([0.17, 0.33, 0.5, 0.66, 0.83].some(f => Math.abs(c.t - f) < 0.015)) b.set(c.x, y + 2, c.z, lantern)
    }
  }


  // ------------------------------------------------------------------ landscape
  // Ground work uses the heightmap (ground(x, z)), never b.topY: under a canopy the top block
  // of a column is a leaf, so topY-based helpers (b.path, b.scatter) would paint the crown.
  const RIVER = (x, z) => streamD(x, z)
  const surfaceMix = {
    bank: kit.palette({ coarse_dirt: 4, gravel: 3, dirt: 1 }, { scale: 4, seed: 31 }),
    roots: kit.palette({ podzol: 6, moss_block: 4, grass_block: 3, coarse_dirt: 1 }, { scale: 5, seed: 32 }),
    floor: kit.palette({ grass_block: 12, podzol: 4, moss_block: 2, coarse_dirt: 1 }, { scale: 6, seed: 33 }),
    meadow: kit.palette({ grass_block: 20, coarse_dirt: 1, podzol: 1 }, { scale: 5, seed: 34 }),
  }
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      if (!inIsland(x, z)) continue
      const y = ground(x, z)
      if (b.nameAt(x, y, z) !== 'minecraft:grass_block') continue
      const dT = Math.hypot(x - T[0], z - T[1]) + 3 * noise.fbm2(x, z, { scale: 6, seed: 35 })
      if (RIVER(x, z) < 4.2 && y <= WATER + 1) b.set(x, y, z, surfaceMix.bank)
      else if (dT < 15) b.set(x, y, z, surfaceMix.roots)
      else if (dT < 26) b.set(x, y, z, surfaceMix.floor)
      else b.set(x, y, z, surfaceMix.meadow)
    }

  // Footpath: from the south rim, between the prop root and the pool, to the stair foot.
  // Pale stepping stones (calcite / polished diorite) down the middle, worn earth at the edges.
  const PATH = [[40, 79], [39, 71], [40.5, 62], [42.5, 53], [43, 47], [foot[0] + 0.5, foot[2] + 1.5]]
  const pathS = kit.catmullRom(PATH.map(([x, z]) => [x, 0, z]), { samplesPerBlock: 3 })
  const onPath = new Set()
  for (const p of pathS) {
    const w = 1.3 + 0.4 * noise.fbm2(p[0], p[2], { scale: 6, seed: 36 })
    for (let x = Math.floor(p[0] - 2); x <= Math.ceil(p[0] + 2); x += 1)
      for (let z = Math.floor(p[2] - 2); z <= Math.ceil(p[2] + 2); z += 1) {
        const d = Math.hypot(x - p[0], z - p[2])
        if (d > w || onPath.has(x * 1000 + z) || !inIsland(x, z)) continue
        const y = ground(x, z)
        if (!/grass_block|podzol|moss_block|coarse_dirt|rooted_dirt|gravel/.test(b.nameAt(x, y, z) ?? '')) continue
        onPath.add(x * 1000 + z)
        const stone = d < 0.75 && kit.hash01(Math.round(p[0] / 2), 0, Math.round(p[2] / 2), 37) < 0.8
        b.set(x, y, z, stone ? (kit.hash01(x, y, z, 38) < 0.5 ? 'minecraft:calcite' : 'minecraft:polished_diorite') : kit.palette({ dirt_path: 5, coarse_dirt: 2, moss_block: 1 }, { scale: 2, seed: 39 }))
      }
  }
  const nearPath = (x, z, r = 2) => {
    for (let dx = -r; dx <= r; dx += 1) for (let dz = -r; dz <= r; dz += 1) if (onPath.has((x + dx) * 1000 + z + dz)) return true
    return false
  }

  // Spring: a mossy rock outcrop on the north rim with a little fall feeding the stream.
  const gS = ground(54, 4)
  const rockSdf = kit.sdf.displace(kit.sdf.smoothUnion(2.5,
    kit.sdf.ellipsoid([55, gS + 2, 3], [5.5, 6, 4]),
    kit.sdf.ellipsoid([49.5, gS + 1, 2.5], [4, 4, 3.5]),
    kit.sdf.ellipsoid([60, gS, 6], [3.5, 3.5, 3.5])), 0.8, 4, 71)
  const ROCK = 'minecraft:light_gray_wool'
  b.sdf([42, Math.max(0, gS - 3), 0], [66, gS + 10, 12], rockSdf, ROCK, { mask: (x, y, z) => inIsland(x, z) && y > ground(x, z) - 3 })
  {
    let top = gS + 1
    for (let y = gS + 10; y > gS; y -= 1) if (b.get(53, y, 5)) { top = y; break }
    b.set(53, top, 5, 'minecraft:water') // source in a notch at the lip
    for (let y = top; y > WATER; y -= 1) b.set(53, y, 6, 'minecraft:water[level=8]')
    for (let y = top; y > WATER; y -= 1) if (y < top - 1) b.set(53, y, 7, b.get(53, y, 7) ? 'minecraft:water[level=8]' : null)
    for (let x = 52; x <= 54; x += 1) for (let z = 6; z <= 8; z += 1) {
      if (ground(x, z) < WATER) for (let y = ground(x, z) + 1; y <= WATER; y += 1) b.set(x, y, z, 'minecraft:water')
    }
  }

  // ------------------------------------------------------------------ texture
  if (at('texture')) {
    // Bark: one shading pass over everything still in the placeholder. The ramp (dark -> light)
    // mixes four barks of close value: spruce 17, dark oak 20, mangrove 29, oak 38. Occluded
    // creases, root junctions and undersides go dark, sunlit ridges and limb tops go light; the
    // vertical furrow noise baked into the SDF gives the shading something to grip.
    b.shadeSurface([0, 0, 0], [W - 1, H - 1, D - 1], ['spruce_wood', 'dark_oak_wood', 'mangrove_wood', 'oak_wood'], { only: BARK, base: 0.25, noise: 0.16, scale: 4, interior: 'darkest', seed: 5 })
    b.shadeSurface([0, 0, 0], [W - 1, H - 1, D - 1], ['tuff', 'stone', 'andesite', 'mossy_cobblestone'], { only: ROCK, noise: 0.2, scale: 3, interior: 'darkest', seed: 6 })
    b.shadeSurface([0, 0, 0], [W - 1, H - 1, D - 1], ['tuff', 'stone', 'andesite'], { only: 'minecraft:light_gray_wool', interior: 'darkest', seed: 7 })

    // Bark grain: shadeSurface writes plain *_wood (axis y). Re-orient every bark block along
    // the limb it belongs to (nearest limb or branch axis), so horizontal limbs show their grain
    // running along them instead of vertical stripes.
    const segs = []
    for (const t of tubes) for (const s of t.segs) segs.push([[s.a[0], t.yRef + (s.a[1] - t.yRef) / t.ys, s.a[2]], [s.c[0], t.yRef + (s.c[1] - t.yRef) / t.ys, s.c[2]]])
    for (const tw of twigs) segs.push(tw)
    const axisAt = (x, y, z) => {
      let best = trunkD(x, y, z) + 0.5 // the trunk itself (vertical) wins ties
      let dir = [0, 1, 0]
      for (const [a, c] of segs) {
        const ba = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
        if (Math.abs(x - a[0]) > 12 && Math.abs(x - c[0]) > 12) continue
        const L2 = ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2 || 1
        const h = clamp(((x - a[0]) * ba[0] + (y - a[1]) * ba[1] + (z - a[2]) * ba[2]) / L2, 0, 1)
        const d = Math.hypot(x - a[0] - ba[0] * h, y - a[1] - ba[1] * h, z - a[2] - ba[2] * h) - 1.5
        if (d < best) { best = d; dir = ba }
      }
      const [ax, ay, az] = dir.map(Math.abs)
      return ay >= ax && ay >= az ? 'y' : ax >= az ? 'x' : 'z'
    }
    for (const [x, y, z, blk] of b.entries()) {
      if (!/^minecraft:(spruce|dark_oak|mangrove|oak)_wood$/.test(blk.name) || y < g0 - 2) continue
      if (Math.hypot(x - C[0], z - C[1]) < 14 && y > gC) continue // companion keeps its own
      const axis = axisAt(x, y, z)
      if (axis !== 'y') b.set(x, y, z, `${blk.name}[axis=${axis}]`)
    }

    // Moss where water and leaf litter collect: on upward faces, heavier near the ground and in
    // clumps; never an even green coat.
    const BARKS = /^minecraft:(spruce|dark_oak|mangrove|oak)_wood$|^minecraft:(tuff|stone|andesite)$/
    for (const [x, y, z, blk] of b.entries()) {
      if (!BARKS.test(blk.name) || b.get(x, y + 1, z)) continue
      const low = y < g0 + 7
      const m = noise.coherent01(x, y, z, { scale: 4, seed: 31 })
      if (m < (low ? 0.5 : 0.3)) {
        b.set(x, y, z, 'minecraft:moss_block')
        if (low && m < 0.22 && free(x, y + 1, z)) b.set(x, y + 1, z, 'minecraft:moss_carpet')
      }
    }
  }

  // ------------------------------------------------------------------ detail: forest floor
  if (at('detail')) {
    const SOIL = /^minecraft:(grass_block|podzol|moss_block|coarse_dirt|rooted_dirt)$/
    const canPlant = (x, z, h = 1) => {
      if (!inIsland(x, z) || onPath.has(x * 1000 + z)) return null
      const y = ground(x, z)
      if (!SOIL.test(b.nameAt(x, y, z) ?? '')) return null
      for (let k = 1; k <= h; k += 1) if (b.get(x, y + k, z) || isRes(x, y + k, z)) return null
      return y
    }
    const plant = (x, z, id) => {
      const tall = /(tall_grass|large_fern|lilac|peony|rose_bush)$/.test(id)
      const y = canPlant(x, z, tall ? 2 : 1)
      if (y === null) return false
      if (tall) {
        b.set(x, y + 1, z, `${id}[half=lower]`)
        b.set(x, y + 2, z, `${id}[half=upper]`)
      } else b.set(x, y + 1, z, id)
      return true
    }

    // Rim trees in three sizes and two species groups (birch on the north-west rim, spruce and
    // azalea south-west, oak and birch east), so the giant has a forest to stand in.
    const RIM_TREES = [
      [9, 22, 'birch', 12], [13, 15, 'birch', 10], [6, 30, 'birch', 9],
      [12, 71, 'spruce', 13], [19, 75, 'azalea', 6], [8, 63, 'spruce', 10],
      [72, 47, 'birch', 11], [72, 58, 'oak', 9], [74, 38, 'azalea', 6], [62, 7, 'birch', 11],
    ]
    RIM_TREES.forEach(([x, z, sp, h], i) => {
      const y = canPlant(x, z, 2)
      if (y !== null) b.tree([x, y + 1, z], sp, { seed: 30 + i, height: h })
    })
    for (const [x, z, r] of [[24, 70, 1.6], [37, 72, 1.3], [62, 52, 1.3], [21, 30, 1.4], [44, 22, 1.5], [10, 52, 1.6], [60, 70, 1.4]]) {
      const y = canPlant(x, z, 1)
      if (y !== null) b.bush([x, y + 1, z], { radius: r, leaves: ['azalea_leaves', 'flowering_azalea_leaves', 'oak_leaves'], seed: x * 3 + z })
    }

    // Mossy boulders along the stream, fallen logs with moss and mushrooms, one huge red
    // toadstool by the pool.
    const stone = kit.palette({ stone: 4, andesite: 3, tuff: 2, mossy_cobblestone: 2 }, { scale: 2, seed: 61 })
    for (const [x, z, r] of [[55, 40, 1.6], [42, 58, 1.3], [57, 18, 1.8], [50, 72, 1.4], [38, 12, 1.5]]) {
      if (!inIsland(x, z)) continue
      b.boulder([x, ground(x, z) + 0.4, z], [r * 1.3, r * 0.8, r], stone, { seed: x + z, mossTop: 'minecraft:moss_block' })
    }
    const fallenLog = (x0, z0, along, len, log) => {
      const y = Math.max(...Array.from({ length: len }, (_, k) => ground(x0 + (along === 'x' ? k : 0), z0 + (along === 'z' ? k : 0))))
      for (let k = 0; k < len; k += 1) {
        const x = x0 + (along === 'x' ? k : 0)
        const z = z0 + (along === 'z' ? k : 0)
        for (let yy = ground(x, z) + 1; yy <= y; yy += 1) b.set(x, yy, z, 'minecraft:coarse_dirt')
        b.set(x, y + 1, z, `minecraft:${log}[axis=${along}]`)
        const u = kit.hash01(x, y, z, 62)
        if (u < 0.45) b.set(x, y + 2, z, 'minecraft:moss_carpet')
        else if (u < 0.6) b.set(x, y + 2, z, u < 0.52 ? 'minecraft:brown_mushroom' : 'minecraft:red_mushroom')
      }
    }
    fallenLog(14, 60, 'x', 6, 'spruce_log')
    fallenLog(58, 46, 'z', 5, 'oak_log')
    fallenLog(20, 8, 'x', 4, 'birch_log')
    b.hugeMushroom([12, ground(12, 40) + 1, 40], { type: 'brown', height: 5, seed: 6, glow: true }) // shroomlight gills: a lamp for the west floor

    // Ground plants by zone: shade-loving ferns, moss and mushrooms under the giant; grass and
    // flower drifts (one or two species per drift) in the open; petals under the cherry; reeds
    // and orchids at the water.
    for (let x = 0; x < W; x += 1)
      for (let z = 0; z < D; z += 1) {
        if (canPlant(x, z) === null) continue
        const y = ground(x, z)
        const dT = Math.hypot(x - T[0], z - T[1])
        const dC = Math.hypot(x - C[0], z - C[1])
        const u = kit.hash01(x, y, z, 71)
        const zone = noise.coherent01(x, 0, z, { scale: 7, grain: 0, seed: 72 })
        const wet = RIVER(x, z) < 5.5
        if (wet && u < 0.25) plant(x, z, zone < 0.5 ? 'minecraft:blue_orchid' : 'minecraft:fern')
        else if (dC < 9 && u < 0.45) b.set(x, y + 1, z, `minecraft:pink_petals[facing=${['north', 'east', 'south', 'west'][Math.floor(u * 40) % 4]},flower_amount=${1 + (Math.floor(u * 97) % 4)}]`)
        else if (dT < 24) {
          if (u < 0.16) plant(x, z, 'minecraft:fern')
          else if (u < 0.21) plant(x, z, 'minecraft:large_fern')
          else if (u < 0.3 && b.nameAt(x, y, z) === 'minecraft:moss_block') plant(x, z, 'minecraft:moss_carpet')
          else if (u < 0.32) plant(x, z, zone < 0.5 ? 'minecraft:brown_mushroom' : 'minecraft:red_mushroom')
          else if (u < 0.37 && zone > 0.6) plant(x, z, 'minecraft:lily_of_the_valley')
          else if (u < 0.45) plant(x, z, 'minecraft:short_grass')
        } else {
          if (u < 0.24) plant(x, z, 'minecraft:short_grass')
          else if (u < 0.28) plant(x, z, 'minecraft:tall_grass')
          else if (u < 0.36 && zone < 0.22) plant(x, z, u < 0.32 ? 'minecraft:allium' : 'minecraft:azure_bluet')
          else if (u < 0.36 && zone > 0.8) plant(x, z, u < 0.32 ? 'minecraft:oxeye_daisy' : 'minecraft:cornflower')
          else if (u < 0.38) plant(x, z, 'minecraft:fern')
        }
      }
    // reeds on bank cells that touch water
    for (let x = 1; x < W - 1; x += 1)
      for (let z = 1; z < D - 1; z += 1) {
        const y = ground(x, z)
        if (y !== WATER || b.get(x, y + 1, z) || !/grass_block|podzol|coarse_dirt|mud|gravel/.test(b.nameAt(x, y, z) ?? '')) continue
        const wetSide = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => /water/.test(b.nameAt(x + dx, y, z + dz) ?? ''))
        if (!wetSide || kit.hash01(x, y, z, 73) > 0.35) continue
        if (/gravel|mud/.test(b.nameAt(x, y, z))) b.set(x, y, z, 'minecraft:dirt')
        const n = 1 + Math.floor(kit.hash01(x, 0, z, 74) * 3)
        for (let k = 1; k <= n; k += 1) b.set(x, y + k, z, 'minecraft:sugar_cane')
      }
    // water: lily pads on calm water, seagrass on deeper beds, sea pickles glowing in the pool
    for (let x = 0; x < W; x += 1)
      for (let z = 0; z < D; z += 1) {
        if (b.nameAt(x, WATER, z) !== 'minecraft:water' || b.get(x, WATER + 1, z)) continue
        const u = kit.hash01(x, 0, z, 75)
        const depth = WATER - ground(x, z)
        if (u < 0.09 && RIVER(x, z) > 1.2) b.set(x, WATER + 1, z, 'minecraft:lily_pad')
        if (depth >= 2 && u > 0.7) b.set(x, ground(x, z) + 1, z, 'minecraft:seagrass')
        if (depth >= 2 && u > 0.55 && u < 0.6 && Math.hypot(x - POOL[0], z - POOL[1]) < POOL[2]) b.set(x, ground(x, z) + 1, z, 'minecraft:sea_pickle[pickles=3,waterlogged=true]')
      }
  }

  // ------------------------------------------------------------------ detail: the living tree
  if (at('detail')) {
    const isBark = n => /^minecraft:(spruce|dark_oak|mangrove|oak|cherry)_wood$/.test(n ?? '')
    const air = (x, y, z) => inB(x, y, z) && !b.get(x, y, z) && free(x, y, z)
    // glow berries: a strand of cave vines (berries on most segments) under a leaf or bark block
    const glowBerries = (x, y, z, len) => {
      let n = 0
      while (n < len && air(x, y - n - 1, z) && y - n - 1 > ground(x, z) + 2) n += 1
      for (let k = 1; k <= n; k += 1) {
        const berries = kit.hash01(x, y - k, z, 83) < 0.6
        b.set(x, y - k, z, k === n ? `minecraft:cave_vines[age=25,berries=${berries}]` : `minecraft:cave_vines_plant[berries=${berries}]`)
      }
    }
    const entries = b.entries()
    for (const [x, y, z, blk] of entries) {
      const leaf = /_leaves$/.test(blk.name)
      const bark = isBark(blk.name)
      if (!leaf && !bark) continue
      if (y <= ground(x, z) + 1) continue
      const u = kit.hash01(x, y, z, 84)
      const clump = noise.coherent01(x, y, z, { scale: 4, grain: 0, seed: 85 })
      // underside: glow berries in clumps, shroomlight hearts showing through the leaves (the
      // masses are hollow, so "underside" means no leaves anywhere in the 10 blocks below)
      let under = air(x, y - 1, z)
      for (let k = 2; under && k <= 10; k += 1) if (/_leaves$/.test(b.nameAt(x, y - k, z) ?? '')) under = false
      if (under) {
        if (clump < 0.3 && u < (leaf ? 0.09 : 0.05)) glowBerries(x, y, z, 2 + Math.floor(kit.hash01(x, 0, z, 86) * 5))
        else if (leaf && blk.name !== 'minecraft:cherry_leaves' && u > 0.988) b.set(x, y, z, 'minecraft:shroomlight')
      }
      if (!bark) continue
      // glow lichen on shaded (north-facing) bark, in patches
      if (air(x, y, z - 1) && noise.coherent01(x, y, z, { scale: 3, grain: 0, seed: 81 }) < 0.1) b.set(x, y, z - 1, 'minecraft:glow_lichen[south=true]')
      // vine curtains on the west and north faces, longest where the bark is mossy
      for (const [dx, dz, face] of [[-1, 0, 'east'], [0, -1, 'south']]) {
        if (!air(x + dx, y, z + dz) || clump > 0.22 || u > 0.4) continue
        const len = 2 + Math.floor(kit.hash01(x, y, z, 87) * 5)
        for (let k = 0; k < len && air(x + dx, y - k, z + dz) && b.get(x, y - k, z) && y - k > ground(x + dx, z + dz) + 1; k += 1) b.set(x + dx, y - k, z + dz, `minecraft:vine[${face}=true]`)
      }
    }

    // spore blossoms under the decks, lanterns hung on chains from the limbs above them
    for (const p of [p1, p2, pC]) {
      for (const [x, z] of p.cells) {
        const Y = p === p1 ? Y1 : p === p2 ? Y2 : YC
        if (kit.hash01(x, Y, z, 88) < 0.035 && !b.get(x, Y - 1, z)) b.set(x, Y - 1, z, 'minecraft:spore_blossom')
      }
    }
    const hangFromAbove = (x, Y, z, light) => {
      if (b.get(x, Y + 1, z) || b.get(x, Y + 2, z) || b.get(x, Y + 3, z)) return false
      let yA = -1
      for (let y = Y + 4; y <= Y + 18; y += 1) if (b.get(x, y, z)) { yA = y; break }
      if (yA < 0 || !/_wood$|_leaves$|moss_block/.test(b.nameAt(x, yA, z))) return false
      for (let y = Y + 4; y < yA; y += 1) b.set(x, y, z, 'minecraft:chain[axis=y]')
      b.set(x, Y + 3, z, `${light.split('[')[0]}[hanging=true]`)
      return true
    }
    let hung = 0
    for (const [p, Y, n] of [[p1, Y1, 14], [p2, Y2, 6], [pC, YC, 4]]) {
      const cells = [...p.cells].sort((a, c) => kit.hash01(a[0], 0, a[1], 89) - kit.hash01(c[0], 0, c[1], 89))
      let k = 0
      for (const [x, z] of cells) {
        if (k >= n) break
        if (hangFromAbove(x, Y, z, k % 2 ? soulLantern : lantern)) { k += 1; hung += 1 }
      }
    }

    // ------------------------------------------------------------------ detail: interiors
    // Hall: round table with candles and chairs, shelves in the solid bays, plants by the windows,
    // a long-chain chandelier from the roof spire.
    {
      const [hx, hz] = HALL
      const F = Y1 + 1
      b.disc([hx, F, hz], 2.6, 'minecraft:light_blue_carpet')
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(hx + dx, F, hz + dz, 'minecraft:birch_slab[type=top]')
      b.set(hx + 1, F + 1, hz, 'minecraft:white_candle[candles=3,lit=true]')
      b.set(hx - 1, F + 1, hz, 'minecraft:white_candle[candles=2,lit=true]')
      b.set(hx, F, hz, 'minecraft:pearlescent_froglight[axis=y]') // the table's glowing heart
      b.set(hx, F + 1, hz, 'minecraft:potted_flowering_azalea_bush')
      for (const [dx, dz, f] of [[2, 0, 'east'], [-2, 0, 'west'], [0, 2, 'south'], [0, -2, 'north']]) b.set(hx + dx, F, hz + dz, `minecraft:birch_stairs[facing=${f},half=bottom]`)
      const step = TAU / 8
      for (const k of [1, 7]) {
        const a = hallDoor + k * step
        for (const off of [-0.18, 0, 0.18]) {
          const x = Math.round(hx + Math.cos(a + off) * (HALL_R - 1))
          const z = Math.round(hz + Math.sin(a + off) * (HALL_R - 1))
          const f = kit.facingFrom(hx - x, hz - z)
          b.set(x, F, z, `minecraft:chiseled_bookshelf[facing=${f},slot_0_occupied=true,slot_1_occupied=true,slot_3_occupied=true,slot_5_occupied=true]`)
          b.set(x, F + 1, z, 'minecraft:bookshelf')
        }
      }
      for (const k of [3, 5]) {
        const a = hallDoor + k * step
        const x = Math.round(hx + Math.cos(a) * (HALL_R - 1))
        const z = Math.round(hz + Math.sin(a) * (HALL_R - 1))
        b.set(x, F, z, 'minecraft:potted_azalea_bush')
      }
      {
        const a = hallDoor + 2.5 * step
        const x = Math.round(hx + Math.cos(a) * (HALL_R - 2))
        const z = Math.round(hz + Math.sin(a) * (HALL_R - 2))
        b.set(x, F, z, `minecraft:lectern[facing=${kit.facingFrom(hx - x, hz - z)},has_book=true]`)
      }
      let yR = F + 6
      while (yR < F + 22 && !b.get(hx, yR, hz)) yR += 1
      for (let y = F + 5; y < yR; y += 1) b.set(hx, y, hz, 'minecraft:chain[axis=y]')
      b.set(hx, F + 4, hz, 'minecraft:lantern[hanging=true]')
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(hx + dx, F + 5, hz + dz, 'minecraft:end_rod[facing=down]')
    }
    // Music pavilion: a jukebox and note blocks, benches facing the middle, a soul-lantern chandelier.
    {
      const [mx, mz] = [Math.round(MUSIC[0]), Math.round(MUSIC[1])]
      const F = Y2 + 1
      b.set(mx, F, mz, 'minecraft:jukebox[has_record=true]')
      b.set(mx + 1, F, mz + 1, 'minecraft:note_block[instrument=bell,note=12]')
      b.set(mx - 1, F, mz - 1, 'minecraft:note_block[instrument=flute,note=7]')
      for (const [dx, dz, f] of [[0, 2, 'south'], [0, -2, 'north'], [-2, 0, 'west']]) b.set(mx + dx, F, mz + dz, `minecraft:birch_stairs[facing=${f},half=bottom]`)
      let yR = F + 4
      while (yR < F + 18 && !b.get(mx, yR, mz)) yR += 1
      for (let y = F + 3; y < yR; y += 1) b.set(mx, y, mz, 'minecraft:chain[axis=y]')
      b.set(mx, F + 2, mz, 'minecraft:soul_lantern[hanging=true]')
    }
    // Companion tea ring: benches against the trunk, a brewing stand on a barrel, pots, lanterns
    // hung from the ring beam.
    {
      const F = YC + 1
      for (let k = 0; k < 8; k += 1) {
        const a = (k * TAU) / 8 + 0.2
        const x = Math.round(C[0] + Math.cos(a) * 3.2)
        const z = Math.round(C[1] + Math.sin(a) * 3.2)
        if (b.get(x, F, z)) continue
        if (k === 2) { b.set(x, F, z, 'minecraft:barrel[facing=up]'); b.set(x, F + 1, z, 'minecraft:brewing_stand[has_bottle_0=true,has_bottle_2=true]') }
        else if (k === 5) b.set(x, F, z, 'minecraft:decorated_pot')
        else if (k % 2) b.set(x, F, z, `minecraft:birch_stairs[facing=${kit.facingFrom(x - C[0], z - C[1])},half=bottom]`)
        else b.set(x, F, z, 'minecraft:potted_flowering_azalea_bush')
      }
      for (let k = 0; k < 4; k += 1) {
        const a = (k * TAU) / 4 + TAU / 16
        const x = Math.round(C[0] + Math.cos(a) * (CR - 0.2))
        const z = Math.round(C[1] + Math.sin(a) * (CR - 0.2))
        if (b.get(x, YC + 4, z) && !b.get(x, YC + 3, z)) b.set(x, YC + 3, z, 'minecraft:lantern[hanging=true]')
      }
    }

    // ------------------------------------------------------------------ detail: approaches
    // Stair foot: a pale stone landing, two lamp posts. Path: lamp posts every ~11 blocks,
    // alternating sides. Bridge: a soul lantern hung under mid-span.
    for (let dx = -1; dx <= 1; dx += 1)
      for (let dz = -1; dz <= 1; dz += 1) {
        const x = Math.round(foot[0]) + dx
        const z = Math.round(foot[2]) + dz + 1
        const y = ground(x, z)
        if (y === footY - 1 && !isStair(x, y + 1, z) && /grass|podzol|moss|dirt/.test(b.nameAt(x, y, z) ?? '')) b.set(x, y, z, kit.hash01(x, y, z, 91) < 0.5 ? 'minecraft:calcite' : 'minecraft:polished_diorite')
      }
    const lamp = (x, z) => {
      const y = ground(x, z)
      if (b.get(x, y + 1, z) && !/grass|fern|flower|petals|orchid|tulip|daisy|allium|bluet|cornflower|lily/.test(b.nameAt(x, y + 1, z))) return
      b.lampPost([x, y + 1, z], { height: 3, post: 'minecraft:birch_fence', foot: 'minecraft:diorite_wall', lantern: 'minecraft:lantern' })
    }
    // Underslung lanterns: chains from the deck undersides light the floor below each platform
    for (const [p, Y, n] of [[p1, Y1, 5], [pC, YC, 2], [p2, Y2, 2]]) {
      const cells = [...p.cells].filter(([x, z]) => !b.get(x, Y - 1, z) && !b.get(x, Y - 2, z) && !b.get(x, Y - 3, z) && !b.get(x, Y - 4, z))
        .sort((a, c) => kit.hash01(a[0], 1, a[1], 93) - kit.hash01(c[0], 1, c[1], 93))
      cells.slice(0, n).forEach(([x, z], i) => {
        const len = 1 + (i % 3)
        for (let k = 1; k <= len; k += 1) b.set(x, Y - k, z, 'minecraft:chain[axis=y]')
        b.set(x, Y - len - 1, z, i % 2 ? 'minecraft:soul_lantern[hanging=true]' : 'minecraft:lantern[hanging=true]')
      })
    }
    // Waystones on the west floor: a mossy calcite pillar crowned with a soul lantern
    for (const [x, z] of [[20, 47], [15, 33], [24, 62]]) {
      const y = ground(x, z)
      if (b.get(x, y + 1, z) && !/grass|fern|flower|petals|lily|mushroom|carpet/.test(b.nameAt(x, y + 1, z))) continue
      b.set(x, y + 1, z, 'minecraft:mossy_stone_brick_wall')
      b.set(x, y + 2, z, 'minecraft:calcite')
      b.set(x, y + 3, z, 'minecraft:soul_lantern[hanging=false]')
    }
    lamp(Math.round(foot[0]) + 3, Math.round(foot[2]) + 3)
    lamp(Math.round(foot[0]) - 3, Math.round(foot[2]) + 4)
    pathS.forEach((p, i) => {
      if (i % 26 !== 13) return
      const side = Math.floor(i / 26) % 2 ? 2.6 : -2.6
      lamp(Math.round(p[0] + side), Math.round(p[2]))
    })
    {
      const mid = bridgeS[Math.floor(bridgeS.length / 2)]
      const y = Math.round(mid[1])
      const x = Math.round(mid[0])
      const z = Math.round(mid[2])
      let yd = y + 1
      while (yd > y - 3 && !b.get(x, yd, z)) yd -= 1
      if (b.get(x, yd, z)) { b.set(x, yd - 1, z, 'minecraft:chain[axis=y]'); b.set(x, yd - 2, z, 'minecraft:soul_lantern[hanging=true]') }
    }
  }

  return b.finish({ name: 'elven-treehouse' })
}
