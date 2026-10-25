// HARBOR HUB - a DonutSMP-style "spawn+" (see references/spawns/README.md)
//
// STAGE=massing node scripts/run-build.mjs assets/examples/spawn-plus.mjs --out-dir minecraft-builds/spawn-plus --json
export default function build(api) {
  const { kit } = api
  const { DIR, cw, ccw, opposite } = kit
  const STAGES = ['massing', 'structure', 'detail', 'final']
  const stage = STAGES.indexOf(process.env.STAGE ?? 'final')
  const at = s => stage >= STAGES.indexOf(s)

  // ------------------------------------------------------------------ grid and levels
  const W = 210
  const H = 90
  const D = 210
  const b = api.builder([W, H, D], { seed: 2026 })
  const AX = 105 // the ceremonial axis (x)
  const SEA = 7 // water surface
  const QUAY = 9
  const MKT = 16
  const PLZ = 23
  const CRN = 33
  const SPAWN = [AX, CRN + 1, 67] // spawn dais top block; players stand at y 35, eye 36.6

  const smooth = (a, c, v) => {
    const t = Math.max(0, Math.min(1, (v - a) / (c - a)))
    return t * t * (3 - 2 * t)
  }
  const fbm = (x, z, scale, seed) => kit.noise.fbm2(x, z, { scale, seed })

  // ------------------------------------------------------------------ 1 site: terraces
  // The town is four terraces cut into a hill that falls south to a bay. Each terrace edge jogs
  // per district so no retaining wall runs straight for more than one building.
  const crownS = x => (x < 84 ? 63 : x <= 126 ? 69 : 65) // last crown row (south edge)
  const MKT_N = 104 // first market row
  const QUAY_N = 127
  const QUAY_S = 138 // quay wall face; water beyond
  const level = (x, z) => {
    if (z >= 14 && z <= crownS(x) && x >= 26 && x <= 186) {
      if (x >= 134 && z >= 20) return CRN - 3 // the garden shelf, three steps down
      return CRN
    }
    // belvedere bastion: a half disc projecting over the plaza
    if (z > crownS(x) && Math.hypot(x - AX, z - 70) <= 7.5 && x > 96 && x < 114) return CRN
    if (z > crownS(x) && z < MKT_N && x >= 40 && x <= 190) return PLZ
    if (z >= MKT_N && z < QUAY_N && x >= 30 && x <= 180) return MKT
    if (z >= QUAY_N && z <= QUAY_S && x >= 44 + Math.max(0, 6 - (z - QUAY_N)) && x <= 166) return QUAY
    return null
  }

  // natural ground: a hill sloping south, two headlands embracing the bay (the east one higher)
  const hill = (x, z) => {
    let h = 9 + 37 * (1 - smooth(0, 150, z)) ** 1.15
    h += 10 * Math.exp(-(((x - 10) / 22) ** 2)) * smooth(90, 175, z)
    h += 17 * Math.exp(-(((x - 200) / 20) ** 2)) * smooth(70, 170, z)
    h += 2.2 * fbm(x, z, 26, 3)
    return h
  }
  // the bay: a rounded basin south of the quay, closed at the canvas edge by the old mole
  const bayDepth = (x, z) => {
    const rx = 56 + 12 * smooth(139, 205, z) + 4 * fbm(z, 7, 16, 9)
    const ax = 1 - Math.abs(x - 106) / rx
    const az = (z - 139) / 40
    return Math.min(ax * 2.2, az) // > 0 inside the bay
  }

  const G = new Int16Array(W * D) // surface y per column
  const L = new Int16Array(W * D).fill(-1) // terrace level or -1
  const idx = (x, z) => x + W * z
  const townCells = []
  for (let z = 0; z < D; z += 1)
    for (let x = 0; x < W; x += 1) {
      const lv = level(x, z)
      if (lv !== null) {
        L[idx(x, z)] = lv
        townCells.push([x, z, lv])
      }
    }
  // outside the town: weighted blend of nearby terrace levels into the natural hill
  const R = 13
  for (let z = 0; z < D; z += 1)
    for (let x = 0; x < W; x += 1) {
      const i = idx(x, z)
      if (L[i] >= 0) {
        G[i] = L[i]
        continue
      }
      let wsum = 0
      let lsum = 0
      let dmin = Infinity
      for (let dz = -R; dz <= R; dz += 1)
        for (let dx = -R; dx <= R; dx += 1) {
          const xx = x + dx
          const zz = z + dz
          if (xx < 0 || zz < 0 || xx >= W || zz >= D) continue
          const lv = L[idx(xx, zz)]
          if (lv < 0) continue
          const d = Math.hypot(dx, dz)
          if (d > R) continue
          const w = 1 / (d * d)
          wsum += w
          lsum += w * lv
          dmin = Math.min(dmin, d)
        }
      let h = hill(x, z)
      const bd = bayDepth(x, z)
      if (bd > 0) h = Math.min(h, SEA - 1 - Math.min(4.5, 1 + bd * 14))
      else if (bd > -0.25) h = Math.min(h, SEA + 1 + (h - SEA - 1) * smooth(0, 0.25, -bd))
      if (wsum > 0 && bd <= 0) h = h + (lsum / wsum - h) * (1 - smooth(1, R, dmin))
      if (x <= 1 || x >= W - 2 || z >= D - 2) h = Math.max(h, SEA + 1)
      G[i] = Math.round(h)
    }

  // fill the ground: stone core, soil cap on natural ground, a paving course on terraces
  const ROCK = kit.gradient(['calcite', 'diorite', 'stone', 'andesite', 'tuff'], { axis: 'y', from: 46, to: 0, dither: 0.7, scale: 4, seed: 5 })
  for (let z = 0; z < D; z += 1)
    for (let x = 0; x < W; x += 1) {
      const g = G[idx(x, z)]
      const town = L[idx(x, z)] >= 0
      for (let y = 0; y <= g; y += 1) {
        let p
        if (town) p = y === g ? 'smooth_stone' : y >= g - 2 ? 'stone_bricks' : 'stone'
        else if (g < SEA) p = y === g ? 'sand' : 'sandstone'
        else p = y === g ? 'grass_block' : y >= g - 2 ? 'dirt' : ROCK
        b.set(x, y, z, p)
      }
      for (let y = g + 1; y <= SEA; y += 1) b.set(x, y, z, 'water')
    }

  // ------------------------------------------------------------------ massing placeholders
  const MASS = 'white_wool'
  const box = (a, c, p = MASS) => b.box(a, c, p)
  // hero: the clock bastion with the tower
  box([85, PLZ, 97], [125, CRN, 109], 'light_gray_wool')
  box([100, CRN + 1, 98], [110, CRN + 22, 108])
  box([102, CRN + 23, 100], [108, CRN + 26, 106])
  // spawn dais
  box([AX - 2, CRN + 1, SPAWN[2] - 2], [AX + 2, CRN + 1, SPAWN[2] + 2], 'blue_wool')
  // crates vault (crown, behind the spawn)
  box([89, CRN + 1, 18], [121, CRN + 12, 44])
  // hall of fame (crown west)
  box([34, CRN + 1, 22], [76, CRN + 9, 56])
  // AFK garden (shelf east)
  box([140, CRN - 2, 24], [180, CRN - 2 + 4, 58], 'lime_wool')
  // auction exchange (plaza west)
  box([50, PLZ + 1, 72], [80, PLZ + 16, 100])
  // duels gatehouse + arena (plaza east)
  box([128, PLZ + 1, 78], [140, PLZ + 15, 92])
  box([142, PLZ + 1, 68], [184, PLZ + 6, 102], 'orange_wool')
  // market street shophouses (south side) and stalls
  for (let x = 38; x <= 170; x += 9) if (x < 98 || x > 112) box([x, MKT + 1, 117], [x + 7, MKT + 11, 126])
  // RTP gate pavilion on the pier
  box([100, QUAY, 139], [110, QUAY, 152], 'spruce_planks')
  box([101, QUAY + 1, 145], [109, QUAY + 9, 152], 'cyan_wool')

  b.spawnPoint(SPAWN, 'south')
  return b.finish({ name: 'spawn-plus', description: 'Harbor Hub spawn+ (massing)' })
}
