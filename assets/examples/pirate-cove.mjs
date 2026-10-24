// PIRATE COVE — a hidden pirate anchorage: a three-masted galleon riding at anchor inside a horseshoe
// of sea cliffs, a shanty town of stilted shacks clinging to the west cliff, a tavern on the beach,
// a lookout tower on the headland, a natural sea arch at the mouth and a treasure cave.
//
// REFERENCES  Caribbean pirate havens (Tortuga / "Shipwreck Cove" in films), cliff-ringed beaches
//   (Navagio, Zakynthos), Durdle Door for the arch, the Vasa (1628) for galleon proportions.
//
// SCALE  1 block ≈ 0.75 m. Canvas 120 x 64 x 104, sea surface at y = 8, cliffs to y ≈ 45.
//
// HERO: THE GALLEON (b.hull + castles + rig, see galleon() at the bottom)
//   hull 44 long, beam 12 (3.7 : 1), keel → main deck 10, quarterdeck +4, poop +7, forecastle +4
//   main mast 48 above the keel (1.09 × hull), fore 43 (0.9 ×), mizzen 35 (0.73 ×), bowsprit ~0.36 L
//   lowest yard 22 long (1.8 × beam), every higher yard ~0.7 × the one below; lateen mizzen.
//   Sails are SET and the yards BRACED 30°: square sails stand across the ship, so a broadside or
//   3/4 camera sees them edge-on. Braced, their bellies face the south-east hero camera.
//
// PALETTE (role → blocks, L*)
//   cliff rock (shaded dark → light by surface normal): deepslate 34, tuff 46, stone 53, andesite 57
//     accents: thin calcite beds 89, tuff/mossy cobble wet band at the waterline, moss on ledges
//   plateau: grass (+ coarse dirt, moss patches) over a dirt soil lip; beach: sand 83 over sandstone
//   sea bed, by depth: sand → sand/clay → clay/gravel → gravel/tuff → mud/tuff (the water reads
//     lighter over the shallows; the renderer's water colour is fixed, so depth = bed colour)
//   ship: dark oak 20 (bottom, castle frames) · spruce 38 (topsides) · stripped dark oak 25 (wales)
//     · stripped oak 62 (gunport stripe, the warm accent) · white wool 93 sails (the lightest mass
//     in the scene, so the hero wins the value contrast) · gold ≤ 3 blocks
//   town: mismatched planks (one main wood per shack + clumped patches of others), log posts, roofs
//     in dark oak / spruce / mangrove / jungle stairs, cobblestone tavern base
//   light: lanterns (docks, porches, deck), shroomlight behind window panes (lit rooms), campfires
//     (beacon, beach bonfire), candles + glow lichen in the cave
//
// COMPOSITION  The horseshoe opens south. From the SSE hero camera: town on the left cliff, the
//   galleon in the centre, the arch as a right-hand foreground frame, beach and cave behind. The
//   lookout tower is the secondary vertical on the west headland.
//
// PIPELINE (order matters)
//   1 arch (built while the builder is empty — b.erode inside it scans every block)
//   2 terrain decided in a typed-array voxel grid (signed shore distance + 3D noise), smoothed
//     there, written once in a placeholder → 3 surface dressing (sand, grass, sea bed)
//   4 b.shadeSurface on the placeholder (+ geology accents) → vines (b.overgrow)
//   5 galleon → 6 buildings dug into the rock (tavern, boardwalk + pier, shacks, tower, cave)
//   7 vegetation (palms, bushes, scatter, seagrass) → 8 props and lights last
//   STAGE=massing|structure|texture|detail|final renders each stage (default final).
//
// RUNTIME  ~10 s recipe on an idle machine; ~260k blocks (most of them terrain and water).

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

  // ------------------------------------------------------------------ site: a signed distance to the shore
  // s(x, z) > 0 on land (blocks inland from the waterline), < 0 at sea. The water is the union of
  // three shapes — the cove basin (a noisy ellipse), the mouth channel and the open sea south of a
  // coastline — so the land distance is their smooth minimum (rounded corners for free). Every later
  // decision (beach, cliff profile, sea-bed depth) is a function of s, which keeps them consistent.
  const COVE = { cx: 62, cz: 50, rx: 44, rz: 31 }
  const sCove = (x, z) => (Math.hypot((x - COVE.cx) / COVE.rx, (z - COVE.cz) / COVE.rz) - 1) * 34 + 3.5 * n2(x, z, 13, 3) + 7 * n2(x, z, 30, 31, 2) + 6 * beachMask(x, z)
  const sMouth = (x, z) => (z < COVE.cz ? 99 : Math.abs(x - (68 + 3 * Math.sin(z / 8))) - (14 + (z - COVE.cz) * 0.2))
  const sSea = (x, z) => 91 + 3 * n2(x, 0, 12, 4) - z - Math.max(0, x - 104) * 1.3 - Math.max(0, 12 - x) * 1.2
  const beachMask = (x, z) => clamp(Math.max(1.3 - Math.hypot((x - 31) / 22, (z - 25) / 13), 1.1 - Math.hypot((x - 75) / 14, (z - 21) / 7)), 0, 1)
  // plateau height: highest at the back (north) of the cove, falling toward the headlands
  const plateau = (x, z) => 21 + 19 * clamp((90 - z) / 66, 0, 1) ** 0.8 + (x < 34 ? 2 : 0) + 2.5 * n2(x, z, 20, 6)

  // per-column fields, computed once (noise is the expensive part): shore distance, beach mask,
  // plateau height, ledge height/width, sea-floor height, warp of the bedding planes
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
  // cliff profile across the shore distance t (0 → 1 over CLIFF_W blocks): a near-vertical lower face,
  // a ledge at 40-60 % height (varies along the coast), the upper face, then a gently rising plateau.
  // Beaches (beach mask > 0) get a sand slope of up to 15 blocks before the cliff starts.
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
  // From the headland tip out into the sea, diagonal so the hero camera sees it face-on; east of the
  // ship's sight line so it frames the scene instead of hiding the bow.
  // b.rockArch erodes and shades itself; b.erode scans every block in the builder, so building the
  // arch while the canvas is still empty keeps it fast. The terrain below is written with keep: true.
  const ROCK_RAMP = ['deepslate', 'tuff', 'stone', 'andesite']
  const AR = { a: [85, 1, 98], c: [101, 2, 93], height: 22, lintel: 4 }
  b.rockArch(AR.a, AR.c, { height: AR.height, thickness: 5, lintel: AR.lintel, ramp: ROCK_RAMP, bands: { height: 3, amount: 0.16 }, seed: 5, roughness: 1.2 })
  // the arch's opening as an elliptic tunnel (same Hu/Hv as rockArch): the terrain grid must not
  // refill it where the arch's foot stands on the headland
  const arSpan = Math.hypot(AR.c[0] - AR.a[0], AR.c[2] - AR.a[2])
  const arU = [(AR.c[0] - AR.a[0]) / arSpan, (AR.c[2] - AR.a[2]) / arSpan]
  const arM = [(AR.a[0] + AR.c[0]) / 2, Math.min(AR.a[1], AR.c[1]), (AR.a[2] + AR.c[2]) / 2]
  const arHu = arSpan / 2 - Math.max(2.5, arSpan * 0.17)
  const arHv = AR.height - AR.lintel
  const inArchOpening = (x, y, z) => {
    const u = (x - arM[0]) * arU[0] + (z - arM[2]) * arU[1]
    const w = -(x - arM[0]) * arU[1] + (z - arM[2]) * arU[0]
    return Math.abs(w) < 7 && Math.hypot(u / arHu, (y - arM[1]) / arHv) < 1
  }

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
        if (solid && y > FL[i] && inArchOpening(x, y, z)) solid = false
        if (solid) G[gi(x, y, z)] = 1
      }
    }
  // the treasure cave: a tunnel from a mouth on the north beach into a domed hall (SDF capsules +
  // ellipsoid, smooth-unioned and noise-displaced), carved from the grid before smoothing
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
  // rock placeholder: white_concrete, not white_wool — the sails are wool and shading runs after the ship
  const ROCK = 'white_concrete'
  const ROCK_ID = 'minecraft:white_concrete'
  for (let y = 0; y < H; y += 1)
    for (let z = 0; z < D; z += 1)
      for (let x = 0; x < W; x += 1) {
        if (G[gi(x, y, z)]) b.set(x, y, z, ROCK, { keep: true })
        else if (y <= SEA) b.set(x, y, z, 'water', { keep: true })
      }

  if (!at('structure')) return b.finish({ name: 'pirate-cove' })

  // ------------------------------------------------------------------ 3. dress the surface
  // Only the topmost cells change material; everything that stays placeholder becomes shaded rock.
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
  const grass = kit.palette({ grass_block: 40, coarse_dirt: 2, moss_block: 3 }, { scale: 7, seed: 41 })
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      const i = idx(x, z)
      const y = topRock[i]
      if (y < 0 || b.nameAt(x, y, z) !== ROCK_ID || b.nameAt(x, y + 1, z) === 'minecraft:water') continue
      const sl = slopeAt(x, z)
      if (BM[i] > 0.05 && y <= SEA + 5 && sl <= 2) {
        b.set(x, y, z, 'sand')
        b.set(x, y - 1, z, 'sand')
        b.set(x, y - 2, z, 'sandstone')
      } else if (y >= PL[i] - 2.5 && sl <= 2) {
        b.set(x, y, z, grass)
        for (let k = 1; k <= 2; k += 1) if (b.nameAt(x, y - k, z) === ROCK_ID) b.set(x, y - k, z, k === 1 ? 'dirt' : 'coarse_dirt')
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
      if (y >= 0 && y < SEA && b.nameAt(x, y + 1, z) === 'minecraft:water' && b.nameAt(x, y, z) === ROCK_ID) b.set(x, y, z, bedOf(x, y, z))
    }

  // vines curtain the cliff faces below the lip. b.overgrow grows on ANY full block (it has no
  // `only`), so it runs now, before the wool sails and the plank shacks exist.
  if (at('detail')) b.overgrow([1, SEA + 3, 1], [W - 2, H - 1, D - 2], { amount: 0.3, maxLength: 6, moss: false, seed: 5 })

  // ------------------------------------------------------------------ 5. the galleon (the hero)
  // bow at x 79 pointing east, centreline z 60: 6+ blocks of water around the stern gallery and the
  // jib-boom, mid-cove so the sails stand against the cliff's mid-grey (value contrast).
  const ship = galleon(b, kit, { bow: [79, 3, 60], L: 44 })
  // ------------------------------------------------------------------ 4. cliff shading (defined here, run after the buildings)
  // Shading runs after every building has dug into the rock, so freshly exposed faces are shaded
  // too (earlier, digging exposed the hidden 'darkest' interior as flat deepslate walls) and the
  // shacks occlude the rock behind them. b.shadeSurface, not b.texture: rock is a sculpted form, so value follows the surface normal ·
  // light plus occlusion (overhang undersides, gullies and the wave notch come out darkest), rank-
  // normalized so all 4 steps are used; `bands` adds horizontal strata, `base` darkens toward the
  // water. Hidden cells become the darkest step. diorite as a 5th, light step made the cliffs
  // snowy and competed with the sails — so the ramp stops at andesite.
  const shadeRock = () => {
    b.shadeSurface([0, 0, 0], [W - 1, H - 1, D - 1], ROCK_RAMP, {
      only: ROCK, light: [0.3, 0.85, 0.45], bands: { height: 3, amount: 0.16, warp: 2 }, base: 0.18, noise: 0.1, scale: 7, interior: 'darkest', seed: 3,
    })
    // geology accents: a thin pale calcite bed every 12 blocks on the lit faces, a dark wet
    // band with algae at the waterline, moss in patches on ledges that face the sky
    const exposed = (x, y, z) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !b.has(x + dx, y, z + dz) || b.nameAt(x + dx, y, z + dz) === 'minecraft:water')
    for (let x = 0; x < W; x += 1)
      for (let z = 0; z < D; z += 1)
        for (let y = SEA - 1; y <= topRock[idx(x, z)]; y += 1) {
          if (!G[gi(x, y, z)] || x === 0 || x === W - 1 || z === 0) continue
          const n = b.nameAt(x, y, z)
          if (n !== 'minecraft:stone' && n !== 'minecraft:andesite' && n !== 'minecraft:tuff') continue
          const band = (((y + Math.round(2 * BW[idx(x, z)])) % 12) + 12) % 12
          if (y <= SEA + 1 && exposed(x, y, z)) b.set(x, y, z, kit.noise.coherent01(x, y, z, { scale: 3, seed: 51 }) < 0.45 ? 'mossy_cobblestone' : 'tuff')
          else if (band === 3 && n !== 'minecraft:tuff' && exposed(x, y, z) && kit.noise.coherent01(x, 0, z, { scale: 9, seed: 53 }) < 0.55) b.set(x, y, z, 'calcite')
          else if (y > SEA + 3 && !b.has(x, y + 1, z) && kit.noise.coherent01(x, y, z, { scale: 4, seed: 52 }) < 0.4) b.set(x, y, z, 'moss_block')
        }
  }


  if (!at('detail')) {
    if (at('texture')) shadeRock()
    return b.finish({ name: 'pirate-cove' })
  }

  // ------------------------------------------------------------------ 6. buildings — helpers
  // Buildings are placed against the real rock: faceWest() reads the voxel grid, structures clear
  // (dig out) any rock inside their volume, and posts run down until they hit something solid.
  const TERR = new Set(['white_concrete', 'deepslate', 'tuff', 'stone', 'andesite', 'calcite', 'sand', 'sandstone', 'dirt', 'coarse_dirt', 'grass_block', 'rooted_dirt', 'moss_block', 'mossy_cobblestone', 'gravel', 'clay', 'mud'].map(n => `minecraft:${n}`))
  const isTerr = (x, y, z) => TERR.has(b.nameAt(x, y, z))
  const ground = (x, z) => b.topY(x, z, blk => TERR.has(blk.name))
  // first rock cell of the west cliff seen from the cove at (z, y)
  const faceWest = (z, y) => {
    for (let x = 60; x >= 0; x -= 1) if (G[gi(x, y, z)]) return x
    return 0
  }
  // posts from a deck down to whatever holds them up (rock, sand, sea bed — through the water)
  const post = (x, y, z, paint = 'stripped_spruce_log[axis=y]') => {
    for (let yy = y; yy >= 0; yy -= 1) {
      const n = b.nameAt(x, yy, z)
      if (n && n !== 'minecraft:water' && !/vine|grass|fern/.test(n)) break
      b.set(x, yy, z, paint)
    }
  }
  // mismatched planks: one main wood per building, patched with others in small clumps
  const planks = (main, seed) => kit.palette([[8, `${main}_planks`], [2, 'spruce_planks'], [2, 'oak_planks'], [1, 'dark_oak_planks'], [1, 'jungle_planks']], { scale: 1.6, seed })
  const lantern = (x, y, z) => b.set(x, y, z, 'lantern')
  const DECK = SEA + 3 // boardwalk / pier level

  // palm: a thin trunk on a curve that leans more with height (offset ∝ t²), fronds as thin arcs
  const palm = ([x, y, z], { h = 11, bend = 4, seed = 2, az } = {}) => {
    const r = kit.rng(seed)
    const a = az ?? r() * Math.PI * 2
    const pts = [0, 0.33, 0.66, 1].map(t => [x + Math.cos(a) * bend * t * t, y + h * t, z + Math.sin(a) * bend * t * t])
    // trunk: a thin curve whose offset grows with height², ringed by alternating bark tones
    b.curve(pts, (px, py) => (py % 3 === 0 ? 'stripped_jungle_wood' : 'jungle_wood'), { radius: 0.5 })
    const T = pts[3].map(Math.round)
    b.set(T[0], T[1], T[2], 'jungle_wood')
    b.set(T[0], T[1] - 1, T[2], 'jungle_wood')
    b.set(T[0], T[1] + 1, T[2], 'jungle_leaves')
    // 6 fronds: long, thin 1-block arcs that rise, then droop just below the crown (gaps between them)
    for (let i = 0; i < 6; i += 1) {
      const fa = (i * Math.PI * 2) / 6 + r.range(-0.3, 0.3)
      const Lf = r.range(5.5, 7.5)
      const mid = [T[0] + Math.cos(fa) * Lf * 0.5, T[1] + 1.8, T[2] + Math.sin(fa) * Lf * 0.5]
      const end = [T[0] + Math.cos(fa) * Lf, T[1] - 1.2, T[2] + Math.sin(fa) * Lf]
      b.curve([[T[0], T[1] + 1, T[2]], mid, end], i % 4 ? 'jungle_leaves' : 'oak_leaves', { radius: 0.5 })
    }
    for (const [dx, dz, f] of [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'north']]) b.set(T[0] + dx, T[1] - 1, T[2] + dz, `cocoa[age=2,facing=${f}]`, { keep: true })
  }

  // ------------------------------------------------------------------ 6a. the tavern on the beach
  // 11 x 8, two storeys: a stone ground floor (wet beach) under a plank upper floor, a steep dark roof,
  // and a lean-to porch facing the pier — the social centre and the brightest building at night.
  const TV = { x0: 21, x1: 31, z0: 20, z1: 27 }
  let tvF = 0
  for (let x = TV.x0; x <= TV.x1; x += 1)
    for (let z = TV.z0; z <= TV.z1 + 3; z += 1) {
      const g = ground(x, z)
      if (g <= SEA + 4) tvF = Math.max(tvF, g) // beach cells only; cliff rock behind is dug out
    }
  tvF += 1
  {
    const { x0, x1, z0, z1 } = TV
    const F = tvF
    for (let x = x0 - 1; x <= x1 + 1; x += 1) for (let z = z0 - 1; z <= z1 + 4; z += 1) for (let y = F; y <= F + 14; y += 1) if (isTerr(x, y, z)) b.set(x, y, z, 'air')
    b.box([x0, F - 4, z0], [x1, F - 1, z1], kit.palette({ cobblestone: 3, mossy_cobblestone: 1 }, { scale: 2, seed: 60 }))
    b.walls([x0, F, z0], [x1, F + 3, z1], kit.palette({ cobblestone: 5, mossy_cobblestone: 2, stone: 2, andesite: 1 }, { scale: 2, seed: 61 }))
    b.box([x0 + 1, F - 1, z0 + 1], [x1 - 1, F - 1, z1 - 1], 'spruce_planks')
    b.box([x0, F + 4, z0], [x1, F + 4, z1], 'spruce_planks')
    // upper storey: jettied 1 block over the porch side, plank walls between dark posts
    b.walls([x0, F + 5, z0], [x1, F + 8, z1 + 1], planks('spruce', 62))
    b.box([x0, F + 4, z1 + 1], [x1, F + 4, z1 + 1], 'stripped_dark_oak_wood')
    for (let x = x0; x <= x1; x += 1) b.set(x, F + 3, z1 + 1, kit.stairs('dark_oak', 'north', 'top'))
    for (const x of [x0, x0 + 5, x1]) for (const z of [z0, z1 + 1]) b.box([x, F + 5, z], [x, F + 8, z], 'stripped_dark_oak_log[axis=y]')
    for (let x = x0; x <= x1; x += 1) for (const z of [z0, z1 + 1]) b.set(x, F + 8, z, 'stripped_dark_oak_wood')
    b.roof({ x0, z0, x1, z1: z1 + 1, y: F + 9, axis: 'x', material: 'dark_oak', pitch: 1, overhang: 1, gableOverhang: 1, gable: planks('spruce', 63), eaveTrim: true })
    b.chimney([x0 + 1, F, z0 + 1], 16, { paint: kit.palette({ cobblestone: 3, stone_bricks: 1 }, { seed: 64 }), cap: 'cobblestone_wall' })
    // ground floor: door + two big windows onto the porch; upper floor: three windows with shutters
    b.door([x0 + 5, F, z1], 'south', { material: 'dark_oak', width: 2 })
    for (const x of [x0 + 2, x1 - 2]) b.window([x, F + 1, z1], 'south', { width: 1, height: 2, sill: false })
    for (const x of [x0 + 2, x0 + 7, x1 - 1]) b.window([x, F + 6, z1 + 1], 'south', { width: 1, height: 2, shutters: true, material: 'spruce', sill: true })
    b.window([x1, F + 1, z0 + 3], 'east', { width: 2, height: 2, sill: false })
    b.window([x1, F + 6, z0 + 3], 'east', { width: 2, height: 2, shutters: true, material: 'spruce' })
    // porch: plank deck, posts every 5, a lean-to roof, benches and kegs, lanterns on every post
    const pz0 = z1 + 1
    const pz1 = z1 + 3
    b.box([x0, F - 1, pz0], [x1, F - 1, pz1], 'spruce_planks')
    for (let x = x0; x <= x1; x += 1) for (let z = pz0; z <= pz1; z += 1) post(x, F - 2, z, 'spruce_planks')
    for (const x of [x0, x0 + 5, x1]) {
      b.box([x, F, pz1], [x, F + 2, pz1], 'stripped_spruce_log[axis=y]')
      b.hangingLantern([x, F + 3, pz1 - 1], 0)
    }
    b.roof({ x0, z0: pz0 + 1, x1, z1: pz1, y: F + 3, type: 'shed', rises: 'north', material: 'spruce', pitch: 0.5, overhang: 1, gableOverhang: 0 })
    for (let x = x0 + 1; x < x1; x += 1) if (x !== x0 + 5) b.set(x, F, pz1, 'spruce_fence')
    for (const x of [x0 + 1, x0 + 3]) b.set(x, F, pz0 + 1, kit.stairs('spruce', 'north'))
    b.set(x0 + 2, F, pz0 + 1, 'spruce_fence')
    b.set(x0 + 2, F + 1, pz0 + 1, 'spruce_pressure_plate')
    for (const [x, f] of [[x1 - 1, 'up'], [x1 - 2, 'up'], [x1 - 1, 'west']]) b.set(x, f === 'west' ? F + 1 : F, pz0 + 1, `barrel[facing=${f}]`)
    // inside: bar counter, kegs, tables; lanterns light the windows from within
    for (let x = x0 + 1; x <= x0 + 4; x += 1) b.set(x, F, z0 + 3, x === x0 + 4 ? 'spruce_planks' : 'barrel[facing=north]')
    b.set(x0 + 2, F + 1, z0 + 3, 'spruce_slab[type=bottom]')
    for (const x of [x0 + 7, x1 - 2]) {
      b.set(x, F, z0 + 4, 'spruce_fence')
      b.set(x, F + 1, z0 + 4, 'spruce_pressure_plate')
      b.set(x + 1, F, z0 + 4, kit.stairs('spruce', 'west'))
      b.set(x - 1, F, z0 + 4, kit.stairs('spruce', 'east'))
    }
    for (const [x, z] of [[x0 + 3, z0 + 5], [x1 - 3, z0 + 2], [x0 + 3, z0 + 2]]) b.hangingLantern([x, F + 4, z], 0)
    // a lantern just inside every window so the panes glow at night
    // window glow: a lantern is ~3 px at scene distance and vanishes at night; a full emissive
    // block (shroomlight, read as a lamp in the room) right behind each pane makes the window glow
    for (const x of [x0 + 2, x1 - 2]) b.set(x, F + 1, z1 - 1, 'shroomlight')
    for (const x of [x0 + 2, x0 + 7, x1 - 1]) b.set(x, F + 6, z1, 'shroomlight')
    b.set(x1 - 1, F + 6, z0 + 3, 'shroomlight')
    b.set(x1 - 1, F + 1, z0 + 4, 'shroomlight')
    for (const [x, z] of [[x0 + 3, z0 + 3], [x1 - 2, z0 + 3]]) lantern(x, F + 5, z)
  }

  // ------------------------------------------------------------------ 6b. the waterfront: boardwalk, pier, longboat
  // A boardwalk hugs the foot of the west cliff from the beach southward, 3 wide, on log piles
  // driven into the sea bed every 3 blocks; the pier leaves it at a right angle toward the ship.
  // "Rickety" = mismatched planks, a few slab dips and missing boards, railing only in places.
  const boardwalk = []
  for (let z = TV.z1 + 4; z <= 70; z += 1) {
    const xf = Math.max(faceWest(z, DECK), faceWest(z, DECK + 1), faceWest(z, DECK + 2)) + 1
    boardwalk.push([xf, z])
    for (let x = xf; x <= xf + 2; x += 1) {
      for (let y = DECK + 1; y <= DECK + 4; y += 1) if (isTerr(x, y, z)) b.set(x, y, z, 'air')
      const h = kit.noise.hash01(x, 0, z, 71)
      if (h < 0.03) continue
      b.set(x, DECK, z, h < 0.12 ? 'spruce_slab[type=top]' : planks('spruce', 72))
    }
    if (z % 3 === 0) for (const x of [xf, xf + 2]) post(x, DECK - 1, z)
    if (z % 9 < 6) b.set(xf + 3, DECK + 1, z, 'spruce_fence')
    if (z % 8 === 4) {
      b.set(xf + 3, DECK + 1, z, 'spruce_fence')
      b.set(xf + 3, DECK + 2, z, 'spruce_fence')
      lantern(xf + 3, DECK + 3, z)
    }
  }
  // pier: from the beach in front of the tavern straight out toward the galleon's stern
  const PX = 37
  let pierStart = TV.z1 + 3
  while (pierStart < 40 && b.nameAt(PX, SEA, pierStart) !== 'minecraft:water') pierStart += 1 // first water cell
  const PZ1 = 47
  for (let z = pierStart - 3; z <= PZ1; z += 1) {
    for (let x = PX - 1; x <= PX + 1; x += 1) {
      for (let y = DECK; y <= DECK + 3; y += 1) if (isTerr(x, y, z)) b.set(x, y, z, 'air')
      const h = kit.noise.hash01(x, 1, z, 73)
      if (h < 0.04 && z > pierStart) continue
      b.set(x, DECK, z, h < 0.14 ? 'oak_slab[type=top]' : planks('oak', 74))
    }
    if (z % 3 === 0) {
      for (const x of [PX - 2, PX + 2]) {
        post(x, DECK + 1, z)
        b.set(x, DECK - 1, z, 'stripped_spruce_log[axis=y]')
      }
      b.box([PX - 1, DECK - 1, z], [PX + 1, DECK - 1, z], 'stripped_spruce_log[axis=x]')
    }
  }
  // T-head at the end, bollards with rope (fences + chain), lanterns on tall posts
  for (let x = PX - 5; x <= PX + 5; x += 1)
    for (let z = PZ1 - 2; z <= PZ1; z += 1) {
      if (Math.abs(x - PX) <= 1) continue
      b.set(x, DECK, z, kit.noise.hash01(x, 2, z, 75) < 0.1 ? 'spruce_slab[type=top]' : planks('spruce', 76))
      if ((x - PX) % 3 === 0 && z === PZ1) post(x, DECK - 1, z)
    }
  for (const x of [PX - 5, PX + 5]) post(x, DECK - 1, PZ1 - 2)
  for (const [x, z] of [[PX - 5, PZ1], [PX + 5, PZ1], [PX - 2, pierStart + 6]]) {
    b.box([x, DECK + 1, z], [x, DECK + 3, z], 'spruce_fence')
    lantern(x, DECK + 4, z)
  }
  // nets drying on a fence frame (cobweb reads as netting), crates, barrels, a coil of rope (chain)
  b.box([PX + 2, DECK + 1, pierStart + 1], [PX + 2, DECK + 3, pierStart + 1], 'spruce_fence')
  b.box([PX + 2, DECK + 1, pierStart + 4], [PX + 2, DECK + 3, pierStart + 4], 'spruce_fence')
  b.box([PX + 2, DECK + 3, pierStart + 2], [PX + 2, DECK + 3, pierStart + 3], 'spruce_fence')
  b.box([PX + 2, DECK + 1, pierStart + 2], [PX + 2, DECK + 2, pierStart + 3], 'cobweb')
  for (const [x, y, z, blk] of [
    [PX - 1, 1, PZ1 - 1, 'barrel[facing=up]'], [PX - 1, 1, PZ1 - 2, 'barrel[facing=up]'], [PX - 1, 2, PZ1 - 1, 'barrel[facing=north]'],
    [PX + 3, 1, PZ1, 'chest[facing=north]'], [PX + 4, 1, PZ1 - 1, 'barrel[facing=up]'], [PX - 4, 1, PZ1 - 1, 'composter[level=0]'],
    [PX + 1, 1, pierStart + 9, 'barrel[facing=east]'], [PX - 3, 1, PZ1, 'chain[axis=x]'], [PX - 4, 1, PZ1, 'chain[axis=x]'],
  ]) b.set(x, DECK + y, z, blk)
  // the ship's longboat, tied alongside the pier head
  b.hull({ bow: [PX + 5, SEA - 1, pierStart + 3], heading: 'north', length: 9, beam: 4, depth: 3, bulwark: 0, rail: null, keel: null, sheerFwd: 1, sheerAft: 0.6,
    paint: { bottom: 'spruce_planks', wale: 'dark_oak_planks', side: 'spruce_planks', deck: 'spruce_slab[type=bottom]', trim: 'dark_oak_log' } })

  // ------------------------------------------------------------------ 6c. shanties clinging to the west cliff
  // Each shack: back wall against the most protruding rock (dug in where the cliff bulges), floor on
  // log stilts that run down to the boardwalk or the sea bed, plank walls of mismatched wood with log
  // corner posts, a shed roof rising toward the cliff (water runs off to the cove), a railed porch.
  const ROOFS = ['dark_oak', 'spruce', 'mangrove', 'dark_oak', 'jungle']
  const shacks = []
  const shack = ({ z0, z1, F, depth = 5, wallH = 4, wood = 'spruce', roof = 'dark_oak', door, seed = 1, porch = 2, type = 'shed' }) => {
    let xb = 0
    for (let z = z0; z <= z1; z += 1) for (let y = F; y <= F + wallH; y += 1) xb = Math.max(xb, faceWest(z, y))
    const x0 = xb
    const x1 = x0 + depth - 1
    const xp = x1 + porch
    for (let x = x0 + 1; x <= xp + 1; x += 1) for (let y = F + 1; y <= F + wallH + 6; y += 1) for (let z = z0 - 1; z <= z1 + 1; z += 1) if (isTerr(x, y, z)) b.set(x, y, z, 'air')
    const P = planks(wood, seed)
    b.box([x0, F, z0], [xp, F, z1], P)
    b.walls([x0, F + 1, z0], [x1, F + wallH, z1], P)
    for (const x of [x0, x1]) for (const z of [z0, z1]) b.box([x, F + 1, z], [x, F + wallH, z], kit.log(wood === 'mangrove' ? 'spruce' : wood, 'y'))
    for (const z of [z0, Math.round((z0 + z1) / 2), z1]) {
      post(xp, F - 1, z)
      post(x1, F - 1, z)
    }
    for (let z = z0; z <= z1; z += 1) b.set(xp, F + 1, z, 'spruce_fence')
    const dz = door ?? z0 + 1
    b.door([x1, F + 1, dz], 'east', { material: wood === 'mangrove' ? 'spruce' : wood })
    b.set(xp, F + 1, dz, 'air')
    for (let z = z0 + 1; z < z1; z += 1) {
      if (Math.abs(z - dz) <= 1 || (z - z0) % 3 !== 2) continue
      b.window([x1, F + 2, z], 'east', { width: 1, height: wallH > 4 ? 2 : 1, shutters: true, material: 'spruce', sill: false })
      b.set(x1 - 1, F + 2, z, 'shroomlight') // lamp behind the window
    }
    b.window([x0 + Math.floor(depth / 2), F + 2, z1], 'south', { width: 1, height: 1, sill: false })
    if (type === 'shed') b.roof({ x0, z0, x1, z1, y: F + wallH + 1, type: 'shed', rises: 'west', material: roof, pitch: 0.5, overhang: 1, gableOverhang: 1, gable: P })
    else b.roof({ x0, z0, x1, z1, y: F + wallH + 1, axis: 'x', material: roof, pitch: 1, overhang: 1, gableOverhang: 1, gable: P, eaveTrim: true })
    b.hangingLantern([x1 + 1, F + wallH + 1, dz + 1], 0) // from the eave (chain grows up to the roof)
    lantern(x0 + 1, F + 1, z1 - 1)
    lantern(x1 - 1, F + 1, z0 + 2)
    b.set(x0 + 1, F + 1, z0 + 1, 'barrel[facing=up]')
    const s = { x0, x1, xp, z0, z1, F }
    shacks.push(s)
    return s
  }
  // straight wooden stair along the cliff (north or south), open underneath with a post every 2 steps
  const stair = ([x, y, z], facing, rise, width = 2) => {
    b.stairway([x, y, z], facing, rise, 'spruce', { width, fill: false })
    const dz = facing === 'north' ? -1 : 1
    for (let i = 0; i < rise; i += 2) post(x, y + i - 1, z + dz * i, 'spruce_fence')
    for (let i = 0; i < rise; i += 1) for (let k = 1; k <= 3; k += 1) for (let w = -1; w <= width; w += 1) if (isTerr(x + w, y + i + k, z + dz * i)) b.set(x + w, y + i + k, z + dz * i, 'air')
  }
  // lower row on the boardwalk (floors 3-5 above it), upper row in the gaps between them (floors
  // 13-15 above): upper stilts then run past the lower roofs all the way down into the sea
  const sA = shack({ z0: 32, z1: 37, F: DECK + 4, depth: 5, wood: 'spruce', roof: ROOFS[0], seed: 81, door: 36 })
  const sB = shack({ z0: 44, z1: 50, F: DECK + 3, depth: 6, wood: 'oak', roof: ROOFS[2], seed: 82, door: 49 })
  const sC = shack({ z0: 57, z1: 62, F: DECK + 5, depth: 5, wood: 'jungle', roof: ROOFS[1], seed: 83, door: 61 })
  const sD = shack({ z0: 38, z1: 43, F: DECK + 13, depth: 4, wood: 'dark_oak', roof: ROOFS[4], seed: 84, door: 42, type: 'gable' })
  const sE = shack({ z0: 51, z1: 56, F: DECK + 15, depth: 5, wood: 'spruce', roof: ROOFS[3], seed: 85, door: 55 })
  const sF = shack({ z0: 63, z1: 68, F: DECK + 13, depth: 4, wood: 'mangrove', roof: ROOFS[0], seed: 86, door: 67, type: 'gable' })
  // stairs from the boardwalk up to each lower porch: they climb north and land at the porch's south end
  for (const s of [sA, sB, sC]) stair([s.xp, DECK + 1, s.z1 + (s.F - DECK)], 'north', s.F - DECK)
  // ladders from the boardwalk up a stilt to the upper porches
  for (const s of [sD, sF]) {
    const x = s.xp
    const z = s.z1
    for (let y = DECK + 1; y < s.F; y += 1) {
      b.set(x, y, z, 'stripped_spruce_log[axis=y]')
      b.set(x, y, z + 1, 'ladder[facing=south]')
    }
    b.set(x, s.F + 1, z, 'air')
  }
  // rope bridges (sagging plank decks with fence railings) link the upper row
  b.bridge([sD.xp - 1, sD.F, sD.z1 + 1], [sE.xp - 1, sE.F, sE.z0 - 1], { width: 2, deck: 'spruce_planks', arch: -1.2, railing: 'spruce_fence' })
  b.bridge([sE.xp - 1, sE.F, sE.z1 + 1], [sF.xp - 1, sF.F, sF.z0 - 1], { width: 2, deck: 'spruce_planks', arch: -1.2, railing: 'spruce_fence' })

  // ------------------------------------------------------------------ 6d. lookout tower on the west headland
  // a 5 x 5 log frame 13 tall with fence ring-beams every 4, a railed platform, pyramid roof, a
  // campfire beacon and a bell: the only vertical on the skyline besides the masts
  {
    const tx = 14
    const tz = 81
    let g = 0
    for (let x = tx - 2; x <= tx + 2; x += 1) for (let z = tz - 2; z <= tz + 2; z += 1) g = Math.max(g, ground(x, z))
    const top = g + 13
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      b.box([tx + dx, g - 2, tz + dz], [tx + dx, top + 3, tz + dz], 'stripped_spruce_log[axis=y]')
    }
    for (let y = g + 4; y < top; y += 4)
      for (const [a, c] of [[[-2, -2], [2, -2]], [[2, -2], [2, 2]], [[2, 2], [-2, 2]], [[-2, 2], [-2, -2]]]) b.line([tx + a[0], y, tz + a[1]], [tx + c[0], y, tz + c[1]], 'spruce_fence', { keep: true })
    b.box([tx - 3, top, tz - 3], [tx + 3, top, tz + 3], 'spruce_planks')
    for (let x = tx - 3; x <= tx + 3; x += 1) for (let z = tz - 3; z <= tz + 3; z += 1) if (Math.abs(x - tx) === 3 || Math.abs(z - tz) === 3) b.set(x, top + 1, z, 'spruce_fence')
    for (let y = g + 1; y < top; y += 1) b.set(tx, y, tz - 1, 'ladder[facing=south]')
    b.box([tx, g + 1, tz - 2], [tx, top - 1, tz - 2], 'spruce_planks')
    b.roof({ x0: tx - 2, z0: tz - 2, x1: tx + 2, z1: tz + 2, y: top + 4, type: 'pyramid', material: 'dark_oak', overhang: 1 })
    b.set(tx, top + 1, tz + 1, 'campfire[lit=true]')
    b.set(tx + 2, top + 1, tz + 2, 'bell[attachment=floor,facing=south]')
    lantern(tx - 2, top + 1, tz + 2)
    lantern(tx + 1, ground(tx + 1, tz + 1) + 1, tz + 1) // inside the frame, at the foot of the ladder
  }

  // ------------------------------------------------------------------ 6e. the treasure cave
  // sand floor raised above the tide line, the hoard as a stepped mound of gold / raw gold, chests,
  // skulls, candles and a scatter of gold pressure plates (coins); glow lichen on the walls
  {
    for (let x = 54; x <= 82; x += 1)
      for (let z = 0; z <= 26; z += 1)
        for (let y = 1; y <= SEA + 10; y += 1) {
          if (caveSdf(x, y, z) > 0 || G[gi(x, y, z)]) continue
          if (y <= SEA + 1 && z < 19) b.set(x, y, z, kit.noise.coherent01(x, y, z, { scale: 2, seed: 91 }) < 0.7 ? 'sand' : 'gravel')
        }
    const [hx, , hz] = CAVE.hall
    const F = SEA + 2
    // the hoard: a stepped mound of gold and raw gold, chests, skulls, candles
    for (let x = hx - 3; x <= hx + 2; x += 1)
      for (let z = hz - 2; z <= hz + 2; z += 1) {
        const r = Math.hypot((x - hx + 0.5) / 3.2, (z - hz) / 2.4)
        if (r > 1) continue
        b.set(x, F, z, r < 0.55 ? 'gold_block' : kit.noise.hash01(x, F, z, 92) < 0.5 ? 'raw_gold_block' : 'gold_block')
        if (r < 0.5) b.set(x, F + 1, z, kit.noise.hash01(x, F + 1, z, 93) < 0.6 ? 'gold_block' : 'raw_gold_block')
      }
    b.set(hx - 1, F + 2, hz, 'gold_block')
    for (const [x, z, f] of [[hx + 3, hz - 1, 'west'], [hx - 4, hz + 1, 'east'], [hx + 1, hz + 3, 'north']]) b.set(x, F, z, `chest[facing=${f}]`)
    b.set(hx - 4, F, hz - 1, 'barrel[facing=up,open=true]')
    for (const [x, z, r] of [[hx + 2, hz + 2, 6], [hx - 3, hz - 2, 2]]) b.set(x, F, z, `skeleton_skull[rotation=${r}]`)
    for (const [x, y, z, n] of [[hx, F + 2, hz, 3], [hx - 2, F + 1, hz + 1, 2], [hx + 3, F + 1, hz - 1, 4], [hx + 1, F, hz - 2, 1], [hx - 4, F + 1, hz - 1, 2]]) b.set(x, y, z, `candle[candles=${n},lit=true]`)
    for (const [x, z] of [[hx + 1, hz + 2], [hx - 2, hz - 2], [hx + 2, hz - 2]]) b.set(x, F, z, 'light_weighted_pressure_plate[power=0]', { keep: true })
    b.set(hx + 4, F, hz + 1, 'decorated_pot[facing=west]')
    // torch-lit mouth: lanterns on posts either side
    for (const dx of [-3, 3]) {
      const x = CAVE.mouth[0] + dx
      const z = CAVE.mouth[2]
      const g = ground(x, z) + 1
      b.box([x, g, z], [x, g + 1, z], 'spruce_fence')
      lantern(x, g + 2, z)
    }
    // glow lichen on the hall walls
    for (let x = hx - 8; x <= hx + 8; x += 1)
      for (let z = hz - 7; z <= hz + 7; z += 1)
        for (let y = F; y <= F + 6; y += 1) {
          if (b.has(x, y, z) || kit.noise.hash01(x, y, z, 94) > 0.12) continue
          for (const [dx, dz, f] of [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']])
            if (G[gi(x + dx, y, z + dz)]) {
              b.set(x, y, z, `glow_lichen[${f}=true]`)
              break
            }
        }
  }

  // ------------------------------------------------------------------ 6f. shade the cliffs, now that all digging is done
  shadeRock()

  // ------------------------------------------------------------------ 7. vegetation (after the buildings,
  // so nothing grows inside a shack; scatter after trees and bushes so no grass is cut in half)
  // palms: a grove on the beach (leaning out over the sand) and a few on the cliff tops
  const palmSpots = [[34, 26, 9, 3, 0.9], [42, 21, 12, 4, 1.3], [50, 28, 10, 4, 1.9], [82, 22, 11, 4, 1.4], [89, 25, 8, 3, 2.3]]
  for (const [i, [x, z, h, bend, az]] of palmSpots.entries()) {
    const g = ground(x, z)
    if (g > 0) palm([x, g + 1, z], { h, bend, seed: 100 + i, az })
  }
  const rng = kit.rng(7)
  for (let i = 0; i < 70; i += 1) {
    const x = rng.int(9, W - 10)
    const z = rng.int(9, D - 10)
    const g = ground(x, z)
    if (g < SEA + 6 || b.nameAt(x, g, z) !== 'minecraft:grass_block' || b.has(x, g + 1, z)) continue
    if (x < 32 && z > 22 && z < 76) continue // keep the cliff top above the shanties clear (they read against the sky)
    if (rng() < 0.2) palm([x, g + 1, z], { h: rng.int(8, 12), bend: 3, seed: 200 + i })
    else b.bush([x, g + 1, z], { radius: rng.range(1.4, 2.4), leaves: ['jungle_leaves', 'jungle_leaves', 'azalea_leaves', 'oak_leaves'], log: 'jungle_log', seed: 400 + i })
  }
  b.scatter({ on: ['minecraft:grass_block'], density: 0.3, clump: 6, seed: 9, paints: [[10, 'short_grass'], [4, 'fern'], [3, 'tall_grass'], [2, 'large_fern'], [1, 'dandelion'], [1, 'poppy']] })
  b.scatter({ on: ['minecraft:sand'], density: 0.03, clump: 4, seed: 10, paints: [[1, 'dead_bush']] })
  // seagrass meadows in the shallows (placed into the water column)
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      const y = topRock[idx(x, z)]
      if (y < 0 || y > SEA - 2 || b.nameAt(x, y + 1, z) !== 'minecraft:water') continue
      const c = kit.noise.coherent01(x, 0, z, { scale: 5, seed: 12 })
      if (c < 0.3 && kit.noise.hash01(x, y, z, 13) < 0.5) b.set(x, y + 1, z, 'seagrass')
    }
  // vines whose rock was dug away by a building no longer touch anything: remove them
  for (const [x, y, z, blk] of b.entries().filter(e => e[3].name === 'minecraft:vine').sort((p, q) => q[1] - p[1])) {
    const held = [['north', 0, -1], ['south', 0, 1], ['east', 1, 0], ['west', -1, 0]].some(([f, dx, dz]) => blk.props?.[f] === 'true' && b.has(x + dx, y, z + dz) && !/water|vine|lantern|leaves|_slab|_stairs|_fence|_trapdoor|chain|_pane|grass|fern|cobweb/.test(b.nameAt(x + dx, y, z + dz)))
    if (!held && b.nameAt(x, y + 1, z) !== 'minecraft:vine') b.remove(x, y, z)
  }

  // ------------------------------------------------------------------ 8. props and lights last
  // a bonfire on the beach between the palms: campfire ringed by log seats
  {
    const fx = 44
    const fz = 25
    const g = ground(fx, fz)
    if (b.nameAt(fx, g, fz) === 'minecraft:sand') {
      b.set(fx, g + 1, fz, 'campfire[lit=true,signal_fire=false,facing=north]')
      for (const [dx, dz, ax] of [[0, -2, 'x'], [0, 2, 'x'], [-2, 0, 'z'], [2, 0, 'z']]) b.set(fx + dx, ground(fx + dx, fz + dz) + 1, fz + dz, `stripped_spruce_log[axis=${ax}]`)
      b.set(fx + 2, ground(fx + 2, fz + 2) + 1, fz + 2, 'barrel[facing=up]')
    }
  }
  void ship
  return b.finish({ name: 'pirate-cove' })
}

// ===================================================================== galleon
// A galleon on b.hull, built in ship-local coordinates: u from the bow (0) to the stern (L), w to
// starboard, y above the keel; ship.at(u, w, y) converts to world. Everything that depends on the
// hull shape (bands, castles, channels, gunport lids) scans the real hull with outerW() instead of
// re-deriving the loft. Order: hull → bands → smoothing → castles → rig → rigging → flags →
// deck furniture → gunports → lights.
//   hull:   b.hull, heading east, depth 10 (keel → main deck), waterline 0.45, tumblehome 0.16,
//           transom 0.74 × beam, sheer 3 fore and aft, a gun deck at y 6 with ports at y 7 every 3
//   bands:  dark oak below the waterline, black wales at y 5 and 9, ochre stripe through the ports
//   castles: quarterdeck (u ≥ 0.62 L) +4, poop (u ≥ 0.82 L) +7, forecastle (u ≤ 0.18 L) +4; walls
//           lean in 1 per 4 up, framed by dark posts every 3, glazed between them, deck edges on
//           upside-down-stair cornices, quarter galleries at the stern corners, gilded taffrail
//   rig:    masts at 0.2 / 0.47 / 0.76 L, 3 square sails each on fore and main (course, topsail,
//           topgallant; wider at the foot), lateen mizzen, bowsprit with a furled spritsail,
//           shrouds fanned to channels, stays along the centreline, tops and a crow's nest
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
  const ALONG = FWD === 'east' || FWD === 'west' ? 'x' : 'z'
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
        // logs laid along the hull where the run is straight; *_wood (bark on every face) where the
        // hull turns, so no end-grain rings show at the bow and the transom
        const run = solidAt(u - 1, sgn * w, y) && solidAt(u + 1, sgn * w, y)
        const tone = y === 5 || y === 9 ? 'stripped_dark_oak' : y >= 7 ? 'stripped_oak' : null
        if (tone) put(u, sgn * w, y, run ? `${tone}_log[axis=${ALONG}]` : `${tone}_wood`)
      }

  // ---- hull smoothing: a stair on every 1-block tumblehome ledge above the waterline and an
  // upside-down stair under every 1-block step of the bilge below it. Turns the stepped midship
  // section into a curve (and is where most of a ship's upside-down stairs come from).
  const stairOf = y => (y <= 5 || y === 9 ? 'dark_oak' : y === 7 || y === 8 ? 'oak' : 'spruce')
  for (let u = 1; u < L; u += 1)
    for (const sgn of [-1, 1])
      for (let y = 1; y < ship.deckY(u); y += 1) {
        const w = outerW(u, y, sgn)
        const wUp = outerW(u, y + 1, sgn)
        if (w < 0 || wUp < 0) continue
        if (y >= 5 && wUp === w - 1 && !solidAt(u, sgn * w, y + 1)) put(u, sgn * w, y + 1, kit.stairs(stairOf(y + 1), OUT(-sgn)))
        if (y <= 4 && wUp === w + 1 && !solidAt(u, sgn * wUp, y)) put(u, sgn * wUp, y, kit.stairs('dark_oak', OUT(-sgn), 'top'))
      }
  // sheer steps in the waist deck become two half-steps (a bottom slab on the lower deck cell)
  for (let u = U_FC + 1; u < U_QD - 1; u += 1)
    for (const du of [-1, 1]) {
      if (ship.deckY(u + du) !== ship.deckY(u) + 1) continue
      for (let w = -deckW[u] + 1; w <= deckW[u] - 1; w += 1) if (!solidAt(u, w, ship.deckY(u) + 1)) put(u, w, ship.deckY(u) + 1, 'spruce_slab[type=bottom]')
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
  // deck edges project one block over the castle walls on upside-down stairs (a cornice)
  for (const sgn of [-1, 1]) {
    for (let u = U_QD; u <= L; u += 1) put(u, sgn * (hwAt(u, QD) + 1), QD, kit.stairs('dark_oak', OUT(-sgn), 'top'), { keep: true })
    for (let u = U_PD; u <= L; u += 1) put(u, sgn * (hwAt(u, PD) + 1), PD, kit.stairs('dark_oak', OUT(-sgn), 'top'), { keep: true })
    for (let u = 2; u <= U_FC; u += 1) put(u, sgn * (hwAt(u, FC) + 1), FC, kit.stairs('dark_oak', OUT(-sgn), 'top'), { keep: true })
  }
  // windows between the posts (quarterdeck cabin and poop cabin)
  for (const sgn of [-1, 1])
    for (let u = U_QD + 2; u <= L - 3; u += 3) {
      put(u, sgn * hwAt(u, MAIN + 2), MAIN + 2, 'glass_pane')
      put(u, sgn * (hwAt(u, MAIN + 2) - 1), MAIN + 2, 'shroomlight') // cabin lamp behind the pane
      if (u > U_PD) {
        put(u, sgn * hwAt(u, QD + 2), QD + 2, 'glass_pane')
        put(u, sgn * (hwAt(u, QD + 2) - 1), QD + 2, 'shroomlight')
      }
    }
  // quarter galleries: little bay windows bulging out at the stern corners, roofed with stairs
  for (const sgn of [-1, 1]) {
    for (let u = L - 4; u <= L - 1; u += 1) {
      const w = hwAt(u, MAIN + 2) + 1
      put(u, sgn * w, MAIN + 1, kit.stairs('dark_oak', OUT(-sgn), 'top'))
      put(u, sgn * w, MAIN + 2, u === L - 4 || u === L - 1 ? 'dark_oak_planks' : 'glass_pane')
      put(u, sgn * w, MAIN + 3, `dark_oak_stairs[facing=${OUT(-sgn)},half=bottom]`)
    }
  }
  // rails: fence railings on every deck edge, dark slab cap on the waist bulwark
  // castle rails: a balustrade of open trapdoor panels (panel on the outer edge) between fence posts
  const railRun = (u0, u1, y) => {
    for (let u = u0; u <= u1; u += 1)
      for (const sgn of [-1, 1]) put(u, sgn * hwAt(u, y - 1), y, u % 3 === 1 || u === u0 || u === u1 ? 'spruce_fence' : `spruce_trapdoor[facing=${OUT(-sgn)},half=bottom,open=true]`)
  }
  railRun(U_QD, U_PD - 1, QD + 1)
  railRun(U_PD, L, PD + 1)
  railRun(1, U_FC, FC + 1)
  for (let u = U_FC + 1; u < U_QD; u += 1)
    for (const sgn of [-1, 1]) {
      const y = ship.deckY(u) + 1
      const w = outerW(u, y, sgn)
      if (w < 0) continue
      put(u, sgn * w, y + 1, 'dark_oak_slab[type=bottom]')
      put(u, sgn * (w - 1), y, 'spruce_slab[type=bottom]', { keep: true }) // gangway along the bulwark
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
    put(L + 1, w, QD, kit.stairs('dark_oak', FWD, 'top'))
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
    const rows = new Map()
    for (let y = yFoot; y < yHead; y += 1) {
      const t = (yHead - y) / (yHead - yFoot)
      const half = halfHead + (halfFoot - halfHead) * t
      const row = new Set()
      let prev = null
      for (let s = -half; s <= half + 1e-6; s += 0.25) {
        const q = s / half
        const k = 1 + belly * (1 - q * q) * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.9))
        const cu = Math.round(u + s * dU + k * nU)
        const cw = Math.round(s * dW + k * nW)
        row.add(`${cu},${cw}`)
        if (prev && prev[0] !== cu && prev[1] !== cw) row.add(`${prev[0]},${cw}`) // keep the row face-connected
        prev = [cu, cw]
      }
      rows.set(y, row)
    }
    // rows whose cells meet only along an edge leave see-through slits: add the cell above there
    for (let y = yFoot; y < yHead - 1; y += 1) {
      const up = rows.get(y + 1)
      for (const key of rows.get(y)) {
        if (up.has(key)) continue
        const [cu, cw] = key.split(',').map(Number)
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => up.has(`${cu + a},${cw + c}`))) up.add(key)
      }
    }
    for (const [y, row] of rows) for (const key of row) {
      const [cu, cw] = key.split(',').map(Number)
      put(cu, cw, y, 'white_wool', { keep: true })
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
    put(m.u + 1, 0, yc + 1, 'lantern[hanging=true]', { keep: true }) // hangs from the top's slab
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
  for (let u = -1; u >= -3; u -= 1) put(u, 0, 10, kit.stairs('dark_oak', AFT, 'top'))
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
  shrouds(uF, 26, 2)
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
  for (let w = -hwS + 1; w <= hwS - 1; w += 2) {
    put(L - 1, w, MAIN + 2, 'shroomlight') // the great cabin glows through the stern windows
    put(L - 1, w, QD + 2, 'shroomlight')
  }
  // rudder hung on the sternpost, its head through the counter; gilded figurehead plinth at the beak
  for (let y = 1; y <= MAIN - 1; y += 1) put(L + 1, 0, y, y < 5 ? 'dark_oak_planks' : 'stripped_dark_oak_log[axis=y]')
  put(L + 1, 0, 0, kit.stairs('dark_oak', FWD, 'top'))
  put(-5, 0, 11, 'gold_block')
  // deck lanterns on posts along the waist rail and at the bow; lanterns in the gun deck and hold
  for (const u of [12, 24])
    for (const sgn of [-1, 1]) {
      const y = ship.deckY(u) + 1
      const w = outerW(u, y, sgn)
      put(u, sgn * w, y + 2, 'spruce_fence')
      put(u, sgn * w, y + 3, 'lantern')
    }
  put(1, 0, FC + 2, 'spruce_fence')
  put(1, 0, FC + 3, 'lantern')
  for (const u of [8, 16, 30, L - 4]) {
    put(u, 2, 7, 'lantern')
    let y = 1
    while (y < 6 && solidAt(u, -2, y)) y += 1
    if (y < 6) put(u, -2, y, 'lantern')
  }
  // anchor cable from the hawse on the starboard bow down into the water
  {
    const w = outerW(3, 10, 1) + 1
    put(3, w, 12, 'dark_oak_log[axis=z]')
    for (let y = 11; y >= 1; y -= 1) put(3, w, y, 'chain[axis=y]')
  }
  return { ship, masts, uZ, U_QD, U_PD, QD, PD, MAIN }
}
