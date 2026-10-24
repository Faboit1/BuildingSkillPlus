// PIRATE COVE — work in progress (massing pass)

const W = 120
const H = 64
const D = 104
const SEA = 8 // top water block

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smooth = t => t * t * (3 - 2 * t)
const smin = (k, ...ds) => ds.reduce((a, b) => {
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1)
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

  // ------------------------------------------------------------------ site: a signed distance to the shore
  // s(x, z) > 0 on land (blocks inland from the waterline), < 0 at sea. The water is the union of
  // three shapes: the cove basin (an ellipse), the mouth channel and the open sea south of the coast.
  const COVE = { cx: 60, cz: 50, rx: 41, rz: 31 }
  const sCove = (x, z) => (Math.hypot((x - COVE.cx) / COVE.rx, (z - COVE.cz) / COVE.rz) - 1) * 34 + 3.5 * n2(x, z, 15, 3)
  const sMouth = (x, z) => (z < COVE.cz ? 99 : Math.abs(x - (67 + 3 * Math.sin(z / 8))) - (14 + (z - COVE.cz) * 0.2))
  const sSea = (x, z) => 91 + 3 * n2(x, 0, 12, 4) - z
  const sOf = (x, z) => {
    // water = union of the three regions → the land distance is the smooth minimum of the three
    const a = sCove(x, z)
    const m = sMouth(x, z)
    const c = sSea(x, z)
    return smin(5, a, m, c)
  }
  // beach: the sheltered north-west corner of the cove (and a strip at the cave mouth)
  const beachMask = (x, z) => clamp(Math.max(1.25 - Math.hypot((x - 36) / 27, (z - 22) / 12), 1.1 - Math.hypot((x - 66) / 10, (z - 21) / 6)), 0, 1)
  // plateau height: highest at the back (north) of the cove, falling toward the headlands
  const plateau = (x, z) => 21 + 19 * clamp((90 - z) / 66, 0, 1) ** 0.8 + (x < 34 ? 2 : 0) + 2.5 * n2(x, z, 20, 6)
  // cliff profile: a near-vertical lower face, a narrow ledge at 40-60 % height, an upper face
  const cliffProfile = (t, x, z) => {
    const lh = 0.42 + 0.14 * n2(x, z, 14, 8)
    const lw = 0.22 + 0.2 * (n2(x, z, 11, 9) + 0.5)
    if (t <= 0) return 0
    if (t < 0.35) return lh * smooth(t / 0.35)
    if (t < 0.35 + lw) return lh + 0.05 * (t - 0.35) / lw
    const u = clamp((t - 0.35 - lw) / 0.4, 0, 1)
    return lh + 0.05 + (1 - lh - 0.05) * smooth(u)
  }
  const CLIFF_W = 7
  const landHeight = (s, x, z) => {
    const bm = beachMask(x, z)
    const wb = 13 * bm
    if (s < wb) return SEA + 1 + 2.5 * (s / Math.max(wb, 1)) ** 1.6
    const hb = SEA + 1 + (bm > 0.05 ? 2.5 : 0)
    const P = plateau(x, z)
    const t = (s - wb) / CLIFF_W
    return hb + (P - hb) * cliffProfile(t, x, z) + Math.max(0, s - wb - CLIFF_W) * 0.08
  }
  const floorY = (s, x, z) => {
    const bm = beachMask(x, z)
    const d = -s
    return clamp(Math.round(SEA - 1 - Math.min(6.5, (bm > 0.3 ? 0.32 : 0.75) * d + 0.3) + 1.2 * n2(x, z, 9, 12)), 1, SEA - 1)
  }

  // ------------------------------------------------------------------ massing: rock, soil, sand, water
  const ROCK = 'white_wool'
  const S2 = new Float32Array(W * D)
  for (let x = 0; x < W; x += 1) for (let z = 0; z < D; z += 1) S2[x + W * z] = sOf(x, z)
  const s2 = (x, z) => S2[clamp(x, 0, W - 1) + W * clamp(z, 0, D - 1)]
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      const s = s2(x, z)
      const bm = beachMask(x, z)
      const fy = floorY(Math.min(s, -0.01), x, z)
      const top = Math.ceil(landHeight(Math.max(s + 3, 0), x, z)) + 4
      for (let y = 0; y <= Math.min(H - 1, top); y += 1) {
        let solid = y <= fy
        if (!solid && s > -4) {
          // 3D displacement of the shore distance: undulating, overhanging cliff faces and a
          // wave-cut notch at the waterline. Beaches stay smooth.
          const amp = 2.6 * (1 - bm) * clamp((y - SEA) / 4, 0.35, 1)
          let s3 = s + amp * n3(x, y * 1.25, z, 9, 21)
          if (y >= SEA - 1 && y <= SEA + 2) s3 -= 1.4 * (1 - bm)
          solid = s3 >= 0 && y <= landHeight(s3, x, z)
        }
        if (solid) b.set(x, y, z, ROCK)
        else if (y <= SEA) b.set(x, y, z, 'water')
      }
    }

  return b.finish({ name: 'pirate-cove' })
}
