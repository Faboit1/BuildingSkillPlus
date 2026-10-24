// PIRATE COVE — work in progress

const W = 120
const H = 64
const D = 104
const SEA = 8 // top water block

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smooth = t => t * t * (3 - 2 * t)
const smin = (k, ...ds) => ds.reduce((a, b) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1)
  return b * (1 - h) + a * h - k * h * (1 - h)
})

export default function build(api) {
  const { kit } = api
  const STAGES = ['massing', 'structure', 'texture', 'detail', 'final']
  const stage = STAGES.indexOf(process.env.STAGE ?? 'final')
  const at = s => stage >= STAGES.indexOf(s)
  const b = api.builder([W, H, D], { seed: 17 })
  const n2 = (x, z, scale, seed, octaves = 3) => kit.noise.fbm2(x, z, { scale, seed, octaves })
  const n3 = (x, y, z, scale, seed, octaves = 3) => kit.noise.fbm3(x, y, z, { scale, seed, octaves })
  const idx = (x, z) => clamp(x, 0, W - 1) + W * clamp(z, 0, D - 1)

  // ------------------------------------------------------------------ site: signed distance to the shore
  const COVE = { cx: 62, cz: 50, rx: 44, rz: 31 }
  const sCove = (x, z) => (Math.hypot((x - COVE.cx) / COVE.rx, (z - COVE.cz) / COVE.rz) - 1) * 34 + 3.5 * n2(x, z, 13, 3) + 7 * n2(x, z, 30, 31, 2)
  const sMouth = (x, z) => (z < COVE.cz ? 99 : Math.abs(x - (68 + 3 * Math.sin(z / 8))) - (14 + (z - COVE.cz) * 0.2))
  const sSea = (x, z) => 91 + 3 * n2(x, 0, 12, 4) - z - Math.max(0, x - 104) * 1.3 - Math.max(0, 12 - x) * 1.2
  const beachMask = (x, z) => clamp(Math.max(1.3 - Math.hypot((x - 31) / 22, (z - 25) / 13), 1.1 - Math.hypot((x - 72) / 10, (z - 20) / 6)), 0, 1)
  const plateau = (x, z) => 21 + 19 * clamp((90 - z) / 66, 0, 1) ** 0.8 + (x < 34 ? 2 : 0) + 2.5 * n2(x, z, 20, 6)

  // per-column fields, computed once (noise is the expensive part)
  const S2 = new Float32Array(W * D)
  const BM = new Float32Array(W * D)
  const PL = new Float32Array(W * D)
  const LH = new Float32Array(W * D)
  const LW = new Float32Array(W * D)
  const FL = new Int16Array(W * D)
  const BW = new Float32Array(W * D) // warp of the bedding planes
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      const i = idx(x, z)
      S2[i] = smin(5, sCove(x, z), sMouth(x, z), sSea(x, z))
      BM[i] = beachMask(x, z)
      PL[i] = plateau(x, z)
      LH[i] = 0.42 + 0.14 * n2(x, z, 14, 8)
      LW[i] = 0.22 + 0.2 * (n2(x, z, 11, 9) + 0.5)
      BW[i] = n2(x, z, 22, 5)
      const d = -Math.min(S2[i], -0.01)
      FL[i] = clamp(Math.round(SEA - 1 - Math.min(6.5, (BM[i] > 0.3 ? 0.32 : 0.75) * d + 0.3) + 1.2 * n2(x, z, 9, 12)), 1, SEA - 1)
    }
  // cliff profile: near-vertical lower face, a narrow ledge at 40-60 % height, upper face
  const CLIFF_W = 5
  const cliffProfile = (t, i) => {
    const lh = LH[i]
    const lw = LW[i]
    if (t <= 0) return 0
    if (t < 0.35) return lh * smooth(t / 0.35)
    if (t < 0.35 + lw) return lh + (0.05 * (t - 0.35)) / lw
    return lh + 0.05 + (1 - lh - 0.05) * smooth(clamp((t - 0.35 - lw) / 0.4, 0, 1))
  }
  const landHeight = (s, i) => {
    const wb = 15 * BM[i]
    if (s < wb) return SEA + 1 + 2.5 * (s / Math.max(wb, 1)) ** 1.6
    const hb = SEA + 1 + (BM[i] > 0.05 ? 2.5 : 0)
    const t = (s - wb) / CLIFF_W
    return hb + (PL[i] - hb) * cliffProfile(t, i) + Math.max(0, s - wb - CLIFF_W) * 0.05
  }

  // ------------------------------------------------------------------ 1. the sea arch (built first)
  // b.rockArch erodes and shades itself; b.erode scans every block in the builder, so building the
  // arch while the canvas is still empty keeps it fast. The terrain below is written with keep: true.
  const ROCK_RAMP = ['deepslate', 'tuff', 'stone', 'andesite']
  b.rockArch([84, 1, 97], [100, 2, 86], { height: 21, thickness: 6, ramp: ROCK_RAMP, bands: { height: 3, amount: 0.16 }, seed: 5, roughness: 1.2 })

  // ------------------------------------------------------------------ 2. terrain mass in a voxel grid
  // The rock is decided in a typed array first, smoothed there (the same cellular automaton as
  // b.erode's 'smooth' preset, but over 800k cells in ~0.2 s), then written once as a placeholder.
  const G = new Uint8Array(W * H * D)
  const gi = (x, y, z) => x + W * (z + D * y)
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      const i = idx(x, z)
      const s = S2[i]
      const bm = BM[i]
      const top = Math.min(H - 1, Math.ceil(landHeight(Math.max(s + 3, 0), i)) + 3)
      for (let y = 0; y <= top; y += 1) {
        let solid = y <= FL[i]
        if (!solid && s > -4) {
          // 3D displacement of the shore distance: undulating, overhanging faces and a wave-cut
          // notch at the waterline. Beaches stay smooth.
          // vertical jointing (noise stretched along y → buttresses and gullies) + horizontal
          // bedding (squashed along y) + a hard 2-block bed every 6 blocks that juts out as a ledge
          const amp = 2.6 * (1 - bm) * clamp((y - SEA) / 4, 0.35, 1)
          const bed = ((y + Math.round(2 * BW[i])) % 6 + 6) % 6 < 2 ? 0.9 : 0
          let s3 = s + amp * (0.75 * n3(x, y * 0.35, z, 6, 21) + 0.5 * n3(x, y * 1.4, z, 10, 22)) + bed * (1 - bm)
          if (y >= SEA - 1 && y <= SEA + 2) s3 -= 1.4 * (1 - bm)
          solid = s3 >= 0 && y <= landHeight(s3, i)
        }
        if (solid) G[gi(x, y, z)] = 1
      }
    }
  // the treasure cave: a tunnel from a mouth on the north beach into a domed hall, noise-roughened
  const CAVE = { mouth: [73, SEA + 3, 22], bend: [70, SEA + 4, 13], hall: [65, SEA + 4, 8] }
  const caveSdf = kit.sdf.displace(kit.sdf.smoothUnion(2,
    kit.sdf.capsule(CAVE.mouth, CAVE.bend, 3.2),
    kit.sdf.capsule(CAVE.bend, CAVE.hall, 3.4),
    kit.sdf.ellipsoid(CAVE.hall, [6.5, 4.5, 5])), 0.6, 4)
  for (let x = 54; x <= 82; x += 1) for (let y = SEA + 1; y <= SEA + 10; y += 1) for (let z = 0; z <= 26; z += 1) if (caveSdf(x, y, z) <= 0) G[gi(x, y, z)] = 0
  // cellular smoothing: a solid with >= ef empty faces dies, an empty cell with >= ff solid faces fills.
  // Out-of-canvas counts as solid so the diorama's cut faces stay crisp.
  const ca = (ef, ff, y0 = 1) => {
    const next = G.slice()
    for (let y = y0; y < H; y += 1)
      for (let z = 0; z < D; z += 1)
        for (let x = 0; x < W; x += 1) {
          let n = 0
          for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            const X = x + dx
            const Y = y + dy
            const Z = z + dz
            n += X < 0 || Z < 0 || X >= W || Z >= D || Y < 0 ? 1 : Y >= H ? 0 : G[gi(X, Y, Z)]
          }
          const k = gi(x, y, z)
          if (G[k] && 6 - n >= ef) next[k] = 0
          else if (!G[k] && n >= ff) next[k] = 1
        }
    G.set(next)
  }
  ca(3, 4) // smooth
  ca(6, 6) // float-clean: lone blocks and single-cell holes
  const ROCK = 'white_wool'
  for (let y = 0; y < H; y += 1)
    for (let z = 0; z < D; z += 1)
      for (let x = 0; x < W; x += 1) {
        if (G[gi(x, y, z)]) b.set(x, y, z, ROCK, { keep: true })
        else if (y <= SEA) b.set(x, y, z, 'water', { keep: true })
      }

  if (!at('structure')) return b.finish({ name: 'pirate-cove' })

  // ------------------------------------------------------------------ 3. dress the surface
  const topRock = new Int16Array(W * D).fill(-1)
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1)
      for (let y = H - 1; y >= 0; y -= 1)
        if (G[gi(x, y, z)]) {
          topRock[idx(x, z)] = y
          break
        }
  const slopeAt = (x, z) => {
    const h = topRock[idx(x, z)]
    let m = 0
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) m = Math.max(m, Math.abs(topRock[idx(x + dx, z + dz)] - h))
    return m
  }
  // grass only on the plateau proper (with coarse/rooted dirt patches) over a brown soil lip;
  // sand over sandstone on the beach. Cliff ledges stay rock (moss is added later, in patches).
  const grass = kit.palette({ grass_block: 30, coarse_dirt: 4, rooted_dirt: 2, moss_block: 3 }, { scale: 4, seed: 41 })
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      const i = idx(x, z)
      const y = topRock[i]
      if (y < 0 || b.nameAt(x, y, z) !== 'minecraft:white_wool' || b.nameAt(x, y + 1, z) === 'minecraft:water') continue
      const sl = slopeAt(x, z)
      if (BM[i] > 0.05 && y <= SEA + 5 && sl <= 2) {
        b.set(x, y, z, 'sand')
        b.set(x, y - 1, z, 'sand')
        b.set(x, y - 2, z, 'sandstone')
      } else if (y >= PL[i] - 2.5 && sl <= 2) {
        b.set(x, y, z, grass)
        for (let k = 1; k <= 2; k += 1) if (b.nameAt(x, y - k, z) === 'minecraft:white_wool') b.set(x, y - k, z, k === 1 ? 'dirt' : 'coarse_dirt')
      }
    }
  // sea bed: colour by depth (light sand in the shallows → clay and gravel → dark mud in the channel)
  const bedOf = (x, y, z) => {
    const d = SEA - y + 0.9 * (kit.noise.coherent01(x, 0, z, { scale: 3, seed: 7 }) - 0.5)
    if (d < 2.2) return 'sand'
    if (d < 3.4) return kit.noise.coherent01(x, 1, z, { scale: 2, seed: 3 }) < 0.7 ? 'sand' : 'clay'
    if (d < 4.6) return kit.noise.coherent01(x, 1, z, { scale: 2.5, seed: 8 }) < 0.5 ? 'clay' : 'gravel'
    if (d < 5.8) return kit.noise.coherent01(x, 2, z, { scale: 2.5, seed: 9 }) < 0.6 ? 'gravel' : 'tuff'
    return kit.noise.coherent01(x, 3, z, { scale: 2.5, seed: 10 }) < 0.5 ? 'mud' : 'tuff'
  }
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      const y = topRock[idx(x, z)]
      if (y >= 0 && y < SEA && b.nameAt(x, y + 1, z) === 'minecraft:water' && b.nameAt(x, y, z) === 'minecraft:white_wool') b.set(x, y, z, bedOf(x, y, z))
    }

  // ------------------------------------------------------------------ 5. shade the cliffs
  // Surface normal · light + occlusion, rank-normalized over the ramp; strata bands every ~3 blocks;
  // darker toward the waterline (base). Hidden cells become the darkest step.
  if (at('texture')) {
    b.shadeSurface([0, 0, 0], [W - 1, H - 1, D - 1], ROCK_RAMP, {
      only: ROCK, light: [0.3, 0.85, 0.45], bands: { height: 3, amount: 0.16, warp: 2 }, base: 0.18, noise: 0.1, scale: 7, interior: 'darkest', seed: 3,
    })
  }

  // ------------------------------------------------------------------ 6. the galleon
  const ship = galleon(b, kit, { bow: [82, 3, 58], L: 44 })
  void ship

  return b.finish({ name: 'pirate-cove' })
}

// ===================================================================== galleon
function galleon(b, kit, { bow, L = 46, beam = 12, depth = 10, sea = 8, brace = 30 }) {
  const ship = b.hull({
    bow, heading: 'east', length: L, beam, depth,
    maxBeamAt: 0.42, bowExp: 0.55, runExp: 2.0, transom: 0.74, section: 2.6, tumble: 0.16, waterline: 0.45,
    sheerFwd: 3, sheerAft: 3, decks: [6], bulwark: 1, rail: null,
    gunports: { y: 7, every: 3, from: 0.2, to: 0.6 },
    paint: { bottom: 'dark_oak_planks', wale: 'stripped_dark_oak_log[axis=x]', side: 'spruce_planks', deck: 'spruce_planks', trim: 'stripped_dark_oak_log' },
  })
  const at = (u, w, y) => ship.at(u, w, y)
  const put = (u, w, y, paint, opts) => b.set(...at(u, w, y), paint, opts)
  const get = (u, w, y) => b.get(...at(u, w, y))
  const solidAt = (u, w, y) => {
    const blk = get(u, w, y)
    return blk && blk.name !== 'minecraft:water'
  }
  // local → world facing: heading east, so −u (toward the bow) is east and +w (starboard) is south
  const face = (du, dw) => kit.facingFrom(-du, dw)
  const OUT = s => face(0, s) // outward from the side with sign s
  const FWD = face(-1, 0)
  const AFT = face(1, 0)
  const outerW = (u, y, sgn) => {
    for (let w = Math.ceil(beam / 2) + 2; w >= 0; w -= 1) if (solidAt(u, sgn * w, y)) return w
    return -1
  }
  const MAIN = 10 // main deck level amidships (local y above the keel)
  const QD = 14 // quarterdeck
  const PD = 17 // poop deck
  const FC = 14 // forecastle deck
  const U_QD = Math.round(0.62 * L)
  const U_PD = Math.round(0.82 * L)
  const U_FC = Math.round(0.18 * L)
  const deckW = []
  for (let u = 0; u <= L; u += 1) deckW[u] = Math.max(outerW(u, ship.deckY(u), 1), outerW(u, ship.deckY(u), -1))

  // ---- hull bands: dark below the waterline, black wales, an ochre gunport stripe
  for (let u = 0; u <= L; u += 1)
    for (const sgn of [-1, 1])
      for (let y = 5; y <= 9; y += 1) {
        const w = outerW(u, y, sgn)
        if (w < 0) continue
        const blk = get(u, sgn * w, y)
        if (!/planks|log/.test(blk.name)) continue
        const paint = y === 5 || y === 9 ? 'stripped_dark_oak_wood' : y >= 7 ? 'stripped_oak_wood' : null
        if (paint) put(u, sgn * w, y, paint)
      }

  // ---- castles: raised decks fore and aft. Walls follow the hull line and lean inward
  // (tumblehome: 1 block per 4 up), floors at 3-block storeys (1 floor + 2 air).
  const hwAt = (u, y) => Math.max(1, deckW[Math.min(L, Math.max(0, u))] - Math.floor((y - MAIN + 1) / 4))
  const castle = (u0, u1, floor, top, { front = true, back = false } = {}) => {
    for (let u = u0; u <= u1; u += 1) {
      for (let y = floor + 1; y <= top; y += 1) {
        const hw = hwAt(u, y)
        for (let w = -hw - 1; w <= hw + 1; w += 1) {
          if (Math.abs(w) > hw) {
            // clear the old bulwark/rail outside the leaning castle wall
            if (y > ship.deckY(u) && solidAt(u, w, y)) put(u, w, y, 'air')
            continue
          }
          const edge = Math.abs(w) === hw || (front && u === u0) || (back && u === u1)
          if (y === top) put(u, w, y, 'spruce_planks')
          else put(u, w, y, edge ? 'spruce_planks' : 'air')
        }
      }
      const hw = hwAt(u, floor)
      for (let w = -hw + 1; w <= hw - 1; w += 1) put(u, w, floor, 'spruce_planks')
    }
  }
  castle(U_QD, L, MAIN, QD, { back: true })
  castle(U_PD, L, QD, PD, { back: true })
  castle(0, U_FC, 11, FC, { front: false })
  // a dark plank band at each castle floor line and dark frame posts every 3: relief and rhythm
  for (const sgn of [-1, 1]) {
    for (let u = U_QD; u <= L; u += 1) {
      put(u, sgn * hwAt(u, QD), QD, 'stripped_dark_oak_wood')
      if (u >= U_PD) put(u, sgn * hwAt(u, PD), PD, 'stripped_dark_oak_wood')
      if (u % 3 === 1)
        for (let y = MAIN + 1; y < PD; y += 1) {
          if ((u < U_PD && y >= QD) || y === QD) continue
          put(u, sgn * hwAt(u, y), y, 'stripped_dark_oak_log[axis=y]')
        }
    }
    for (let u = 0; u <= U_FC; u += 1) if (hwAt(u, FC) > 1) put(u, sgn * hwAt(u, FC), FC, 'stripped_dark_oak_wood')
  }
  // windows between the posts (quarterdeck cabin and poop cabin)
  for (const sgn of [-1, 1])
    for (let u = U_QD + 2; u <= L - 3; u += 3) {
      put(u, sgn * hwAt(u, MAIN + 2), MAIN + 2, 'glass_pane')
      if (u > U_PD) put(u, sgn * hwAt(u, QD + 2), QD + 2, 'glass_pane')
    }
  // quarter galleries: little bay windows bulging out at the stern corners, roofed with stairs
  for (const sgn of [-1, 1]) {
    for (let u = L - 4; u <= L - 1; u += 1) {
      const w = hwAt(u, MAIN + 2) + 1
      put(u, sgn * w, MAIN + 1, 'dark_oak_slab[type=top]')
      put(u, sgn * w, MAIN + 2, u === L - 4 || u === L - 1 ? 'dark_oak_planks' : 'glass_pane')
      put(u, sgn * w, MAIN + 3, `dark_oak_stairs[facing=${OUT(-sgn)},half=bottom]`)
    }
  }
  // rails: fence railings on every deck edge, dark slab cap on the waist bulwark
  const railRun = (u0, u1, y) => {
    for (let u = u0; u <= u1; u += 1) for (const sgn of [-1, 1]) put(u, sgn * hwAt(u, y - 1), y, 'spruce_fence')
  }
  railRun(U_QD, U_PD - 1, QD + 1)
  railRun(U_PD, L, PD + 1)
  railRun(1, U_FC, FC + 1)
  for (let u = U_FC + 1; u < U_QD; u += 1)
    for (const sgn of [-1, 1]) {
      const y = ship.deckY(u) + 1
      const w = outerW(u, y, sgn)
      if (w >= 0) put(u, sgn * w, y + 1, 'dark_oak_slab[type=bottom]')
    }
  // break of the quarterdeck: transverse rail, two stairs up from the waist, a door into the cabin
  for (let w = -hwAt(U_QD, QD) + 1; w <= hwAt(U_QD, QD) - 1; w += 1) put(U_QD, w, QD + 1, 'spruce_fence')
  for (const w of [-3, 3]) {
    for (let k = 0; k < 3; k += 1) put(U_QD - 3 + k, w, MAIN + 1 + k, `spruce_stairs[facing=${AFT}]`)
    put(U_QD, w, QD + 1, 'air')
  }
  b.door(at(U_QD, 0, MAIN + 1), FWD, { material: 'dark_oak' })
  b.door(at(U_PD, 0, QD + 1), FWD, { material: 'dark_oak' })
  // stern: transom windows on two tiers, an open gallery, three great lanterns, gilded crown
  const hwS = hwAt(L, PD)
  for (let w = -hwAt(L, MAIN + 2) + 1; w <= hwAt(L, MAIN + 2) - 1; w += 1) put(L, w, MAIN + 2, Math.abs(w) % 2 ? 'stripped_dark_oak_log[axis=y]' : 'glass_pane')
  for (let w = -hwS + 1; w <= hwS - 1; w += 1) put(L, w, QD + 2, Math.abs(w) % 2 ? 'stripped_dark_oak_log[axis=y]' : 'glass_pane')
  for (let w = -hwAt(L, QD); w <= hwAt(L, QD); w += 1) {
    put(L + 1, w, QD, 'dark_oak_slab[type=top]')
    put(L + 1, w, QD + 1, 'dark_oak_fence')
  }
  for (let w = -hwS; w <= hwS; w += 1) put(L, w, PD, w === 0 ? 'gold_block' : 'stripped_oak_wood')
  for (const w of [-hwS, 0, hwS]) {
    put(L, w, PD + 1, 'dark_oak_fence')
    put(L, w, PD + 2, 'dark_oak_fence')
    put(L, w, PD + 3, 'lantern')
  }

  // ---- masts, yards and sails. Yards are braced `brace` degrees so the sails turn their
  // bellies toward the south-east camera instead of showing an edge to the broadside view.
  const th = (brace * Math.PI) / 180
  const dU = Math.sin(th)
  const dW = Math.cos(th)
  const nU = -Math.cos(th)
  const nW = Math.sin(th)
  const yard = (u, y, half) => {
    b.line(at(Math.round(u - half * dU), Math.round(-half * dW), y), at(Math.round(u + half * dU), Math.round(half * dW), y), 'spruce_fence', { connect: 6 })
  }
  // set sail between a head yard (yHead, halfHead) and a foot row (yFoot, halfFoot), bellied forward,
  // rasterized 2 thick so neighbouring rows never leave see-through slits
  const setSail = (u, yHead, halfHead, yFoot, halfFoot, belly = 2) => {
    const rows = yHead - yFoot
    for (let y = yFoot; y < yHead; y += 1) {
      const t = (yHead - y) / rows
      const half = halfHead + (halfFoot - halfHead) * t
      let prev = null
      for (let s = -half; s <= half + 1e-6; s += 0.25) {
        const q = s / half
        const k = 1 + belly * (1 - q * q) * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.9))
        const cu = Math.round(u + s * dU + k * nU)
        const cw = Math.round(s * dW + k * nW)
        const bu = Math.round(u + s * dU + (k - 1) * nU)
        const bw = Math.round(s * dW + (k - 1) * nW)
        put(cu, cw, y, 'white_wool', { keep: true })
        if (k > 1.4) put(bu, bw, y, 'white_wool', { keep: true })
        if (prev && prev[0] !== cu && prev[1] !== cw) put(prev[0], cw, y, 'white_wool', { keep: true })
        prev = [cu, cw]
      }
    }
  }
  const mastLine = (u, top, fenceFrom) => {
    for (let y = ship.deckY(u) - 3; y <= top; y += 1) put(u, 0, y, y >= fenceFrom ? 'spruce_fence' : 'spruce_log[axis=y]')
  }
  // main mast ≈ 1.05 × hull length above the keel; fore ≈ 0.88 ×, mizzen ≈ 0.7 ×
  const uF = Math.round(0.2 * L)
  const uM = Math.round(0.47 * L)
  const uZ = Math.round(0.76 * L)
  const masts = [
    { u: uM, top: 48, yards: [[27, 11], [37, 8], [45, 5]] },
    { u: uF, top: 43, yards: [[25, 10], [34, 7], [40, 4]] },
  ]
  for (const m of masts) {
    const [[yc, hc], [yt, ht], [yg, hg]] = m.yards
    mastLine(m.u, m.top, yg - 1)
    for (const [y, h] of m.yards) yard(m.u, y, h)
    setSail(m.u, yc, hc - 1, ship.deckY(m.u) + 4, hc - 2, 2) // course
    setSail(m.u, yt, ht - 1, yc + 1, hc - 1, 2) // topsail
    setSail(m.u, yg, hg - 1, yt + 1, ht - 1, 1) // topgallant
    // top: a slab platform just above the lower yard
    for (let du = -1; du <= 1; du += 1) for (let w = -2; w <= 2; w += 1) if (du || w) put(m.u + du, w, yc + 2, 'spruce_slab[type=bottom]', { keep: true })
    put(m.u + 1, 0, yc, 'lantern[hanging=true]', { keep: true })
  }
  mastLine(uZ, 35, 31)
  // crow's nest on the main topmast: a ring of open trapdoors around a slab floor
  for (let du = -1; du <= 1; du += 1)
    for (let w = -1; w <= 1; w += 1) {
      if (!du && !w) continue
      put(uM + du, w, 41, 'spruce_slab[type=top]')
      put(uM + du, w, 42, `spruce_trapdoor[facing=${face(-du, -w)},half=bottom,open=true]`)
    }
  // mizzen: lateen yard slung diagonally with a triangular sail on the starboard side
  {
    const a = [uZ - 6, 19]
    const c = [uZ + 9, 33]
    b.line(at(a[0], 0, a[1]), at(c[0], 0, c[1]), 'spruce_fence', { connect: 6 })
    for (let u = a[0] + 1; u <= c[0]; u += 1) {
      const yTopLine = a[1] + ((c[1] - a[1]) * (u - a[0])) / (c[0] - a[0])
      const yFoot = (u < U_PD ? QD : PD) + 3
      for (let y = yFoot; y < yTopLine - 0.5; y += 1) if (u !== uZ) put(u, 1, y, 'white_wool', { keep: true })
    }
  }
  // bowsprit rising ~22° ahead of the stem (log, then a fence jib-boom) with a set spritsail
  b.line(at(-1, 0, 13), at(-12, 0, 16), 'stripped_spruce_wood', { connect: 6 })
  b.line(at(-12, 0, 17), at(-16, 0, 18), 'spruce_fence', { connect: 6 })
  for (let w = -4; w <= 4; w += 1) {
    put(-8, w, 15, 'spruce_fence', { keep: true })
    if (Math.abs(w) < 4) put(-8, w, 14, Math.abs(w) === 2 ? 'light_gray_wool' : 'white_wool') // furled spritsail
  }
  // beakhead: a projecting grating below the bowsprit with a skull figurehead
  for (let u = -1; u >= -4; u -= 1)
    for (let w = -(4 + u); w <= 4 + u; w += 1) put(u, w, 11, 'spruce_slab[type=top]')
  put(-5, 0, 11, 'stripped_dark_oak_log[axis=x]')
  put(-5, 0, 12, 'skeleton_skull[rotation=12]')

  // ---- rigging: shrouds fan from each masthead to channels (top slabs) outside the rail;
  // fences connect face-to-face only, so every diagonal is drawn with connect: 6
  const shrouds = (u, yTop, n) => {
    for (const sgn of [-1, 1])
      for (let i = 0; i < n; i += 1) {
        const ur = u + i * 2
        const y = ship.deckY(ur) + 1
        const w = outerW(ur, y, sgn) + 1
        put(ur, sgn * w, y, 'dark_oak_slab[type=top]')
        b.line(at(u, sgn, yTop), at(ur, sgn * w, y + 1), 'spruce_fence', { connect: 6, keep: true })
      }
  }
  shrouds(uM, 28, 3)
  shrouds(uF, 26, 3)
  shrouds(uZ, 27, 2)
  // stays along the centreline (drawn with keep: they pass behind the sails)
  b.line(at(uF, 0, 26), at(-11, 0, 17), 'spruce_fence', { connect: 6, keep: true })
  b.line(at(uM - 1, 0, 28), at(uF + 1, 0, ship.deckY(uF) + 1), 'spruce_fence', { connect: 6, keep: true })
  b.line(at(uZ - 1, 0, 28), at(uM + 1, 0, MAIN + 2), 'spruce_fence', { connect: 6, keep: true })

  // ---- flags: a Jolly Roger at the main truck, red pennants on fore and mizzen
  const JR = ['.WWW...', 'W.W.W..', '.WWW...', 'W...W..', '.W.W...']
  for (let r = 0; r < JR.length; r += 1)
    for (let c = 0; c < 7; c += 1) put(uM + 1 + c, 0, masts[0].top - r, JR[r][c] === 'W' ? 'white_wool' : 'black_wool')
  for (const [u, y] of [[uF, masts[1].top], [uZ, 35]]) for (let c = 1; c <= 5; c += 1) put(u + c, 0, y, 'red_wool')

  // ---- deck furniture: hatch gratings, capstan, wheel, barrels, bell
  for (const u of [13, 14, 17, 18]) for (let w = -1; w <= 1; w += 1) put(u, w, ship.deckY(u), `spruce_trapdoor[facing=${FWD},half=top,open=false]`)
  put(25, 0, ship.deckY(25) + 1, 'stripped_spruce_log[axis=y]')
  for (const [du, dw] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) put(25 + du, dw, ship.deckY(25) + 1, 'spruce_fence', { keep: true })
  put(uZ + 3, 0, QD + 1, 'spruce_fence')
  put(uZ + 3, 0, QD + 2, `spruce_trapdoor[facing=${AFT},half=bottom,open=true]`)
  for (const [u, w] of [[15, 3], [16, 3], [15, -3], [24, -3], [11, 2]]) put(u, w, ship.deckY(u) + 1, 'barrel[facing=up]')
  put(3, 0, FC + 1, `bell[attachment=floor,facing=${FWD}]`)

  // ---- gunport lids (closed top-half trapdoor outside the port = a lid propped open) + cannon
  for (let u = Math.round(L * 0.2); u <= Math.round(L * 0.6); u += 3)
    for (const sgn of [-1, 1]) {
      const w = outerW(u, 8, sgn)
      if (w < 0) continue
      put(u, sgn * (w + 1), 8, `dark_oak_trapdoor[facing=${OUT(sgn)},half=top,open=false]`)
      put(u, sgn * (w - 1), 7, `dispenser[facing=${OUT(sgn)}]`)
    }

  // ---- lights: cabin lanterns behind the stern and gallery panes
  for (let w = -hwS + 2; w <= hwS - 2; w += 2) {
    put(L - 1, w, MAIN + 1, 'lantern')
    put(L - 1, w, QD + 1, 'lantern')
  }
  // anchor cable from the hawse on the starboard bow down into the water
  {
    const w = outerW(3, 10, 1) + 1
    put(3, w, 12, 'dark_oak_log[axis=z]')
    for (let y = 11; y >= 1; y -= 1) put(3, w, y, 'chain[axis=y]')
  }
  return { ship, masts, uZ, U_QD, U_PD, QD, PD, MAIN }
}
