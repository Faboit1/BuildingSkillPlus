// VALLEY SPAWN — v1 blocking pass (terrain + massing)
export default function build(api) {
  const { kit } = api
  const N = kit.noise
  const SIZE = [132, 72, 132]
  const b = api.builder(SIZE, { seed: 2207 })
  const [W, , D] = SIZE
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const lerp = (a, c, t) => a + (c - a) * t
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t) }

  const P = 22          // plaza floor block level (players stand at P + 1)
  const AX = 66         // main axis x: spawn -> gate
  const SPZ = 51        // spawn z
  const GZ0 = 79, GZ1 = 86  // gate block inner / outer face

  // ------------------------------------------------------------------ plan: the carved shelf
  const SHELF = [
    [43, 35], [50, 33], [60, 32], [72, 32], [84, 33], [91, 32],
    [97, 32], [101, 37], [101, 46],
    [99, 49], [102, 52], [102, 62], [99, 66],
    [94, 68], [92, 73], [91, 78], [91, 81],
    [42, 81],
    [41, 76], [38, 71], [36, 64], [36, 54], [38, 47], [41, 43],
  ]
  const seg = (px, pz, ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az
    const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1)
    return Math.hypot(px - ax - dx * t, pz - az - dz * t)
  }
  const polyDist = (x, z, poly) => {
    let d = Infinity
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) d = Math.min(d, seg(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]))
    return kit.plan.pointInPolygon(x, z, poly) ? -d : d
  }

  // ------------------------------------------------------------------ terrain
  const fbm = (x, z, scale, seed, oct = 4) => N.fbm2(x, z, { scale, seed, octaves: oct })
  const xa = z => AX + (z > 80 ? 7 * Math.sin((z - 80) / 19) : 0)       // valley axis bends east
  const PATH = [[66, 86], [66, 92], [68, 99], [73, 106], [77, 113], [76, 121], [71, 128], [69, 133]]
  const pathDist = (x, z) => { let d = Infinity; for (let i = 1; i < PATH.length; i += 1) d = Math.min(d, seg(x, z, ...PATH[i - 1], ...PATH[i])); return d }
  const pathS = (() => { // arc length along PATH at the nearest point
    const cum = [0]
    for (let i = 1; i < PATH.length; i += 1) cum.push(cum[i - 1] + Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]))
    return (x, z) => {
      let best = Infinity, s = 0
      for (let i = 1; i < PATH.length; i += 1) {
        const [ax, az] = PATH[i - 1], [bx, bz] = PATH[i]
        const dx = bx - ax, dz = bz - az
        const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1)
        const d = Math.hypot(x - ax - dx * t, z - az - dz * t)
        if (d < best) { best = d; s = cum[i - 1] + t * Math.hypot(dx, dz) }
      }
      return s
    }
  })()
  const pathGrade = s => Math.max(P - 17, P - 0.36 * Math.max(0, s - 3))

  // The mountain: a valley head. High on the north, east and west, falling south along the
  // (bending) valley axis.
  const mountain = (x, z) => {
    const u = Math.abs(x - xa(z))
    const g = z >= 80 ? P - 3 - (z - 80) * 0.32 : P - 3 + (80 - z) * 0.85
    const a = z < 80 ? 1.3 : lerp(1.3, 0.5, smooth((z - 80) / 22))
    const w = z < 80 ? 18 : lerp(18, 7, smooth((z - 80) / 16))
    let h = g + a * Math.max(0, u - w)
    h += 3 * fbm(x, z, 26, 3) + 4 * Math.max(0, N.ridged2(x, z, { scale: 30, seed: 5 }) - 0.5)
    return Math.min(h, P + 32 + 2 * fbm(x, z, 18, 4))
  }
  // Cliff profile out from the shelf edge: scree bed, then three tiers with ledges.
  const ramp = (d, x, z) => {
    const k = 1 + 0.12 * fbm(x, z, 12, 8)
    if (d < 2) return d * 0.9
    if (d < 4) return lerp(1.8, 9 * k, (d - 2) / 2)
    if (d < 5.5) return 9 * k + (d - 4) * 0.6
    if (d < 8) return lerp(9.9 * k, 19 * k, (d - 5.5) / 2.5)
    if (d < 9.5) return 19 * k + (d - 8) * 0.6
    if (d < 13) return lerp(19.9 * k, 31 * k, (d - 9.5) / 3.5)
    return 31 * k + (d - 13) * 0.6
  }
  const H0 = new Float32Array(W * D)
  const id2 = (x, z) => clamp(x, 0, W - 1) * D + clamp(z, 0, D - 1)
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      const d = polyDist(x, z, SHELF) + 1.1 * fbm(x, z, 7, 11, 2)
      const m = mountain(x, z)
      let h
      if (d <= 0) h = P
      else if (m >= P) h = Math.min(m, P + ramp(d, x, z))
      else h = Math.max(m, P - 2.2 * d)
      // the trail down the valley: graded and cut into the slope
      const pd = pathDist(x, z)
      if (z > 84 && pd < 7) h = lerp(pathGrade(pathS(x, z)), h, smooth((pd - 2.5) / 4.5))
      H0[id2(x, z)] = h
    }
  const height = (x, z) => Math.round(H0[id2(x, z)])
  const slope = (x, z) => Math.max(...D4.map(([dx, dz]) => Math.abs(height(x + dx, z + dz) - height(x, z))))
  const drop = (x, z) => Math.max(...D4.map(([dx, dz]) => height(x, z) - height(x + dx, z + dz)))

  // strata: wobbling 2-3 block bands, darker and heavier toward the base, a thin calcite band
  const strata = (x, y, z) => {
    const t = y + 2.4 * fbm(x, z, 16, 21, 3) + 0.25 * (x % 3)
    const band = Math.floor(t / 2.6)
    const r = ((band % 9) + 9) % 9
    if (y < P + 3) return kit.palette({ tuff: 4, andesite: 3, cobblestone: 1, cobbled_deepslate: 1 }, { seed: 31, scale: 3 })
    if (r === 4 && fbm(x, z, 9, 5) > -0.2) return 'calcite'
    if (r === 1 || r === 6) return kit.palette({ andesite: 6, stone: 2, cobblestone: 1 }, { seed: 32, scale: 3 })
    if (r === 3 || r === 8) return kit.palette({ tuff: 5, andesite: 2, stone: 1 }, { seed: 33, scale: 3 })
    return kit.palette({ stone: 7, andesite: 2, cobblestone: 1 }, { seed: 34, scale: 3 })
  }
  const grass = kit.palette({ grass_block: 30, coarse_dirt: 3, podzol: 2, moss_block: 1 }, { scale: 5, seed: 3 })
  const ledge = kit.palette({ grass_block: 6, moss_block: 2, coarse_dirt: 2, rooted_dirt: 1 }, { scale: 2, seed: 4 })
  const scree = kit.palette({ gravel: 3, andesite: 2, cobblestone: 2, coarse_dirt: 2, tuff: 1 }, { scale: 2, seed: 5 })
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      const h = height(x, z)
      const s = slope(x, z)
      const sd = polyDist(x, z, SHELF)
      for (let y = 0; y <= h; y += 1) {
        const depth = h - y
        let p
        if (depth === 0) {
          if (sd <= 0) p = 'dirt'
          else if (s >= 3) p = strata(x, y, z)
          else if (sd < 3 && h <= P + 3) p = scree
          else if (h > P + 4 && sd < 16) p = s >= 2 ? strata(x, y, z) : ledge
          else if (s === 2) p = N.hash01(x, y, z, 7) < 0.5 ? strata(x, y, z) : 'coarse_dirt'
          else p = grass
        } else if (depth < 3 && s < 3 && sd > 0) p = 'dirt'
        else p = strata(x, y, z)
        b.set(x, y, z, p)
      }
    }

  // ------------------------------------------------------------------ massing placeholders
  const WOOL = 'white_wool'
  // spawn dais
  b.box([63, P + 1, 48], [69, P + 2, 54], WOOL)
  // north terrace (P + 1)
  // gatehouse block + passage
  b.box([52, P + 1, GZ0], [80, P + 17, GZ1], WOOL)
  b.box([64, P + 1, GZ0], [68, P + 6, GZ1], 'air')
  b.box([42, P + 1, 79], [51, P + 2, 81], WOOL)
  b.box([81, P + 1, 79], [91, P + 2, 81], WOOL)
  // AH hall
  b.box([88, P + 1, 50], [99, P + 14, 64], WOOL)
  // pool
  // booths
  b.box([44, P + 1, 72], [50, P + 4, 76], WOOL)     // kits
  b.box([52, P + 1, 72], [58, P + 4, 76], WOOL)     // shop
  b.box([79, P + 1, 66], [85, P + 6, 72], WOOL)     // store kiosk
  b.box([78, P + 1, 74], [82, P + 4, 75], WOOL)     // quests board
  b.box([72, P + 1, 76], [77, P + 4, 78], WOOL)     // rtp
  b.box([57, P + 1, 51], [61, P + 2, 55], WOOL)     // start here

  b.leaderboards([70, P + 1, 38], 'south', { count: 4, width: 5, height: 6, gap: 1, podium: true,
    primary: 'stone_bricks', trim: 'polished_andesite', ids: ['money', 'kills', 'playtime', 'blocks'], labels: ['Money', 'Kills', 'Playtime', 'Blocks Mined'] })
  b.crateRow([46, P + 3, 67], 'east', [
    { id: 'vote', label: 'Vote Crate', tier: 'vote' },
    { id: 'common', label: 'Common Crate', tier: 'common' },
    { id: 'rare', label: 'Rare Crate', tier: 'rare' },
    { id: 'legendary', label: 'Legendary Crate', tier: 'legendary', block: 'ender_chest' },
  ], { spacing: 6, primary: 'stone_bricks', trim: 'polished_andesite' })
  b.spawnPoint([AX, P + 2, SPZ], 'south')

  return b.finish({ name: 'normal-spawn' })
}
