// MODERN VILLA — massing pass (v1)

export default function build(api) {
  const { kit } = api
  const STAGES = ['massing', 'structure', 'texture', 'detail', 'final']
  const stage = STAGES.indexOf(process.env.STAGE ?? 'final')
  const at = s => stage >= STAGES.indexOf(s)

  const W = 70, H = 45, D = 60
  const b = api.builder([W, H, D], { seed: 5 })
  const SEA = 5
  const Y1 = 15, Y2 = 20, Y3 = 25, YR = 30
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
  const n2 = (x, z, s, seed, octaves = 3) => kit.noise.fbm2(x, z, { scale: s, seed, octaves })
  const smin = (a, c, k) => { const h = Math.max(k - Math.abs(a - c), 0) / k; return Math.min(a, c) - h * h * k * 0.25 }

  // ---------------------------------------------------------------- site
  const coastS = x => 42.5 + 1.6 * n2(x, 0, 9, 5) + (x < 16 ? (16 - x) * 0.3 : 0)
  const coastE = z => 56.5 + 1.4 * n2(0, z, 9, 6)
  const landD = (x, z) => smin(coastS(x) - z, coastE(z) - x, 6) + 0.8 * n2(x, z, 5, 9)
  const hLand = (x, z) => {
    let h = 20 - 5 * smooth((z - 28) / 7)
    h -= 6 * smooth((x - 49) / 7)
    return h + 0.7 * n2(x, z, 16, 3)
  }
  const height = (x, z) => {
    const d = landD(x, z)
    const land = hLand(x, z)
    if (d < 0) return SEA - 2.2 - Math.min(2, -d * 0.35) + 0.5 * n2(x, z, 7, 4)
    return SEA - 2 + (land - SEA + 2) * smooth(d / 2.2)
  }
  const ground = b.terrain({ height, layers: [{ depth: 1, paint: 'grass_block' }, { depth: 3, paint: 'dirt' }, { paint: 'stone' }] })
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) for (let y = ground(x, z) + 1; y <= SEA; y++) b.set(x, y, z, 'water')

  // ---------------------------------------------------------------- volumes
  const L1 = { x0: 18, x1: 50, z0: 22, z1: 33 }
  const L2 = { x0: 28, x1: 58, z0: 16, z1: 27 }
  const L3 = { x0: 36, x1: 49, z0: 12, z1: 23 }
  const DECK = { x0: 12, x1: 52, z0: 34, z1: 41 }

  // foundations under L1 + deck
  for (const r of [L1, DECK]) for (let x = r.x0; x <= r.x1; x++) for (let z = r.z0; z <= r.z1; z++)
    for (let y = Math.min(ground(x, z), Y1) - 2; y <= Y1; y++) b.set(x, y, z, 'gray_wool')
  b.box([L1.x0, Y1 + 1, L1.z0], [L1.x1, Y2, L1.z1], 'black_wool')
  b.box([L1.x0, Y2, L1.z0], [L1.x1, Y2, L1.z1 + 2], 'white_wool')       // L1 roof slab overhangs the glass by 2
  b.box([L2.x0, Y2, L2.z0], [L2.x1, Y3, L2.z1], 'white_wool')
  for (let x = L2.x0; x <= L2.x1; x++) for (let z = L2.z0; z <= L2.z1; z++) for (let y = ground(x, z) + 1; y < Y2; y++) if (x <= 50) b.set(x, y, z, 'gray_wool')
  b.box([L3.x0, Y3, L3.z0], [L3.x1, YR - 1, L3.z1], 'yellow_wool')
  b.box([L3.x0 - 2, YR, L3.z0 - 2], [L3.x1 + 2, YR, L3.z1 + 2], 'white_wool')
  // pool
  b.box([23, Y1 - 3, 36], [47, Y1, 44], 'light_gray_wool')
  b.box([24, Y1 - 2, 37], [46, Y1, 43], 'water')
  // carport plate
  b.box([14, Y3, 4], [27, Y3, 13], 'white_wool')
  for (const [x, z] of [[14, 4], [14, 13], [27, 4]]) b.box([x, Y2 + 1, z], [x, Y3 - 1, z], 'black_wool')
  // outdoor stair
  b.stairway([16, Y1 + 1, 33], 'north', 5, 'stone_brick', { width: 3 })

  return b.finish({ name: 'modern-villa' })
}
