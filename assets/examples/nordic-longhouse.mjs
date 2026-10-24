// NORDIC LONGHOUSE (v1 — full layout, iterating)

const SIZE = [88, 46, 72]
const WATER = 6 // top water block

export default function build(api) {
  const { kit } = api
  const b = api.builder(SIZE, { seed: 7 })
  const [W, , D] = SIZE
  const n2 = (x, z, scale, seed, octaves = 3) => kit.noise.fbm2(x, z, { scale, seed, octaves })
  const hash = (x, y, z, s = 0) => kit.hash01(x, y, z, s)
  const clamp = (v, a, c) => Math.max(a, Math.min(c, v))
  const smooth = t => t * t * (3 - 2 * t)
  const rng = kit.rng(7)
  const pal = (entries, seed, scale = 3) => kit.palette(entries, { scale, seed })
  const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]

  // ================================================================ 0 PLAN
  // Longhouse: 39 long on the x axis, bowed long walls, hall floor at F.
  const X0 = 24, X1 = 62, CX = 43, CZ = 27, HL = (X1 - X0) / 2
  const F = 11
  // Naust (boathouse) at the foot of the headland, gable open to the water.
  const N = { x0: 14, x1: 22, z0: 41, z1: 55 }
  // Pier and longship east of the hall.
  const PIER = { x0: 35, x1: 37, z0: 42, z1: 60 }
  const SHIP = { x: 47, z: 64 } // stern end x (module z = 0 maps here) and centreline z
  // Smokehouse and storehouse on stilts.
  const SMOKE = { x0: 71, x1: 77, z0: 32, z1: 38 }
  const STAB = { x0: 66, x1: 71, z0: 11, z1: 16 }
  // Palisade (landward ring) with an east gate.
  const PALISADE = [[11, 12], [18, 8], [30, 6], [44, 5], [58, 6], [70, 7], [78, 11], [82, 19], [82, 31], [81, 39], [80, 46]]
  const GATE = { x: 82, z0: 24, z1: 26 }

  // ================================================================ 1 SITE
  // A shore terrace between a rocky headland (west) and a forested slope (north, east). The
  // heightmap is designed first (shoreline, headland, terrace under the hall), then blurred
  // twice so the grass does not break into 1-block contour stripes, except on the cliff.
  const shoreZ = x => 51 + 1.8 * Math.sin(x * 0.09 + 0.6) + 1.4 * n2(x, 3, 10, 5) - 3 * Math.exp(-(((x - 36) / 8) ** 2))
  const cliffX = z => 12 + 2 * n2(2, z, 9, 9) + (z > 44 ? (z - 44) * 0.14 : 0)
  const raw = (x, z) => {
    const inland = shoreZ(x) - z
    let h
    if (inland >= 0) {
      h = 7.2 + Math.min(inland, 8) * 0.42 + 0.5 * n2(x, z, 12, 1)
      const back = clamp((16 - z) / 16, 0, 1)
      h += back * back * 9 + 2.2 * n2(x, z, 16, 2) * back
      h += Math.max(0, x - 79) * 0.45
    } else {
      h = Math.max(0.5, WATER - 0.5 + inland * 0.7 + 0.6 * n2(x, z, 8, 3))
    }
    // the headland: a fjord wall rising toward the north-west corner, ridged on top
    const cx = cliffX(z)
    if (x < cx + 3) {
      const t = smooth(clamp((cx + 3 - x) / 3.5, 0, 1))
      const crest = 3.5 * kit.noise.ridged2(x, z, { scale: 14, seed: 4 })
      const top = Math.min(33, 19 + (46 - Math.min(z, 46)) * 0.24 + (cx - x) * 0.45 + crest + 1.2 * n2(x, z, 6, 4))
      const tip = smooth(clamp((66 + 3 * n2(x, 0, 6, 6) - z) / 4, 0, 1))
      h += (top - h) * t * tip
    }
    const e = Math.hypot((x - CX) / (HL + 7), (z - CZ) / 13)
    if (e < 1.3) h += (F - 1.3 - h) * smooth(clamp((1.3 - e) / 0.4, 0, 1))
    return h
  }
  const hm = Array.from({ length: W }, (_, x) => Array.from({ length: D }, (_, z) => raw(x, z)))
  const blur = src => src.map((col, x) => col.map((h, z) => {
    if (x < cliffX(z) + 1) return h
    let s = 0, n = 0
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
      const c = src[x + dx]?.[z + dz]
      if (c !== undefined) { s += c; n += 1 }
    }
    return s / n
  }))
  const sm = blur(blur(hm))
  const height = (x, z) => Math.round(sm[clamp(x, 0, W - 1)][clamp(z, 0, D - 1)])
  const slope = (x, z) => Math.max(...DIR4.map(([dx, dz]) => Math.abs(height(x + dx, z + dz) - height(x, z))))

  // Rock: wavy 2-block strata of one grey family, darker and wetter toward the water line.
  const STRATA = ['stone', 'andesite', 'stone', 'tuff', 'andesite', 'cobblestone', 'stone', 'tuff']
  const strata = (x, y, z) => {
    if (y <= WATER + 1 + Math.round(1.5 * n2(x, z, 5, 8))) return pal({ tuff: 3, cobbled_deepslate: 2, mossy_cobblestone: 2 }, 16, 2)
    const band = Math.floor((y + 2.5 * n2(x, z, 9, 7, 2)) / 2)
    return STRATA[((band % 8) + 8) % 8]
  }
  // Shore gradient (water -> land): bed of gravel/clay, wet shingle, a gravel and coarse-dirt
  // strand, then turf. The distance to the shoreline picks the band; clumped palettes blur the seams.
  const SHINGLE = pal({ gravel: 5, andesite: 2, cobblestone: 1, stone: 1 }, 11, 2.5)
  const STRAND = pal({ gravel: 3, coarse_dirt: 3, grass_block: 2, andesite: 1 }, 17, 2.5)
  const BED = pal({ gravel: 4, sand: 1, clay: 1, mud: 1 }, 12, 2.5)
  const TURF = pal({ grass_block: 30, coarse_dirt: 2, podzol: 2 }, 13, 6)
  const FOREST_FLOOR = pal({ podzol: 6, grass_block: 4, coarse_dirt: 2, moss_block: 1 }, 14, 4)
  const surface = (x, y, z) => {
    const s = slope(x, z)
    if (s >= 3) return strata(x, y, z)
    if (y < WATER) return BED
    const inland = shoreZ(x) - z + 1.2 * n2(x, z, 4, 18)
    if (y <= WATER + 1 || inland < 2) return SHINGLE
    if (inland < 4.5 && x > cliffX(z) + 2) return STRAND
    if (s === 2) return pal({ stone: 3, andesite: 2, coarse_dirt: 2, grass_block: 2 }, 15, 2)
    if (z < 9 || x > 81 || x < cliffX(z)) return FOREST_FLOOR
    return TURF
  }
  const ground = b.terrain({
    height,
    layers: [{ depth: 1, paint: surface }, { depth: 3, paint: (x, y, z) => (slope(x, z) >= 3 ? strata(x, y, z) : 'dirt') }, { paint: strata }],
  })
  for (let x = 0; x < W; x += 1) for (let z = 0; z < D; z += 1) {
    const g = ground(x, z)
    for (let y = g + 1; y <= WATER; y += 1) b.set(x, y, z, 'water')
    // sea floor life in clumps: seagrass in the shallows, kelp where it is deeper
    const depth = WATER - g
    const c = kit.noise.coherent01(x, 0, z, { scale: 5, seed: 19 })
    if (depth >= 4 && c > 0.78) {
      const k = 1 + Math.floor(hash(x, 0, z, 20) * (depth - 1))
      for (let i = 1; i < k; i += 1) b.set(x, g + i, z, 'kelp_plant')
      b.set(x, g + k, z, 'kelp[age=20]')
    } else if (depth >= 2 && c > 0.55) b.set(x, g + 1, z, hash(x, 1, z, 21) < 0.3 && depth >= 3 ? 'tall_seagrass[half=lower]' : 'seagrass')
  }

  // ================================================================ 2 LONGHOUSE
  const u = x => (x - CX) / HL
  const wReal = x => 5 + 1.6 * (1 - Math.min(1, u(x) ** 2))
  const Wd = x => Math.round(wReal(clamp(x, X0, X1)))
  const EAVE = F + 5
  const ridgeRise = x => 10 + 2.5 * Math.min(1.25, u(x) ** 2)
  const span = x => wReal(x) + 1.25
  const prof = r => 0.65 * r + 0.35 * r * r
  const roofT = (x, z) => EAVE + ridgeRise(x) * prof(clamp(1 - Math.abs(z - CZ) / span(x), 0, 1))
  const inFoot = (x, z) => x >= X0 && x <= X1 && Math.abs(z - CZ) <= Wd(x)
  const isWall = (x, z) => {
    if (!inFoot(x, z)) return false
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) if (!inFoot(x + dx, z + dz)) return true
    return false
  }
  const WALL = 'white_wool', FOOT = 'light_gray_wool'
  // foundation down into the ground, log walls 4 high (first course stone)
  for (let x = X0 - 1; x <= X1 + 1; x += 1) for (let z = CZ - 9; z <= CZ + 9; z += 1) {
    if (!inFoot(x, z)) continue
    for (let y = Math.min(ground(x, z), F - 2) - 1; y <= F - 1; y += 1) b.set(x, y, z, FOOT)
    if (isWall(x, z)) {
      b.set(x, F, z, FOOT)
      b.box([x, F + 1, z], [x, F + 3, z], WALL)
    } else b.clear([x, F, z], [x, F + 20, z])
  }
  // external posts: every ~3-4 blocks plus every jog of the bowed wall
  const postXs = [X0, X0 + 4, X0 + 7, X0 + 11, X0 + 15, X0 + 19, CX + 4, CX + 8, CX + 12, CX + 16, X1 - 3, X1]
  for (let x = X0 + 1; x <= X1; x += 1) if (Wd(x) !== Wd(x - 1)) postXs.push(Wd(x) > Wd(x - 1) ? x : x - 1)
  const posts = new Set()
  postXs.sort((a, c) => a - c)
  for (const x of postXs.filter((x, i) => i === 0 || x - postXs[i - 1] > 1)) for (const s of [-1, 1]) {
    const z = CZ + s * (Wd(x) + 1)
    posts.add(`${x},${z}`)
    for (let y = Math.min(ground(x, z), F - 1) - 1; y <= F + 3; y += 1) b.set(x, y, z, 'dark_oak_log[axis=y]')
  }

  // --- the hogback roof: a height field rasterised into stairs, slabs and blocks
  const roofCols = new Map()
  for (let x = X0 - 1; x <= X1 + 1; x += 1) {
    const wx = Wd(x)
    for (let z = CZ - wx - 1; z <= CZ + wx + 1; z += 1) roofCols.set(`${x},${z}`, Math.round(roofT(x, z) * 2) / 2)
  }
  const tq = (x, z) => roofCols.get(`${x},${z}`)
  const topPiece = new Map()
  for (const [key, top] of roofCols) {
    const [x, z] = key.split(',').map(Number)
    const dz = z - CZ
    const out = Math.sign(dz)
    const up = dz > 0 ? 'north' : 'south'
    const downhill = dz === 0 ? null : tq(x, z + out) ?? EAVE - 1
    let yTop
    if (top % 1 !== 0) {
      yTop = Math.floor(top)
      b.set(x, yTop, z, 'dark_oak_slab[type=bottom]')
    } else {
      yTop = top - 1
      if (dz === 0 || downhill > top - 0.5) b.set(x, yTop, z, 'dark_oak_planks')
      else b.set(x, yTop, z, `dark_oak_stairs[facing=${up},half=bottom]`)
    }
    topPiece.set(key, yTop)
    const eaveRow = tq(x, z + out) === undefined && dz !== 0
    let low = yTop
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
      const nt = tq(nx, nz)
      if (nt === undefined) continue // the eave edge and gable rake end in a single thickness
      low = Math.min(low, Math.ceil(nt) - 1)
    }
    for (let y = yTop - 1; y >= low; y -= 1) b.set(x, y, z, 'dark_oak_planks')
    // shingle course shadow: the lowest exposed riser block becomes an upside-down stair whose
    // open lower half faces down-slope, so every course casts a thin shadow line
    if (dz !== 0 && !eaveRow) {
      const yd = Math.ceil(tq(x, z + out)) - 1
      if (yTop - 1 > yd && yd + 1 >= low) b.set(x, yd + 1, z, `dark_oak_stairs[facing=${up},half=top]`)
    }
    if (eaveRow) b.set(x, yTop - 1, z, `dark_oak_stairs[facing=${up},half=top]`, { keep: true }) // bevelled eave
    else if (Math.abs(dz) <= Wd(x) && x >= X0 && x <= X1) b.set(x, low - 1, z, 'spruce_planks', { keep: true }) // ceiling boards inside only
  }
  // wall tops and gable triangles up to the roof
  for (let x = X0; x <= X1; x += 1) for (let z = CZ - 9; z <= CZ + 9; z += 1) {
    if (!isWall(x, z)) continue
    const gableEnd = x === X0 || x === X1
    for (let y = F + 4; y < F + 22 && !b.has(x, y, z); y += 1) b.set(x, y, z, gableEnd ? 'stripped_spruce_log[axis=y]' : WALL)
  }

  // ---- entrance porch on the south side: a small cross gable that breaks the long eave
  const PZ0 = CZ + Wd(CX) + 1, PZ1 = PZ0 + 2
  for (let x = CX - 3; x <= CX + 3; x += 1) for (let z = PZ0; z <= PZ1; z += 1) {
    for (let y = Math.min(ground(x, z), F - 2) - 1; y <= F - 1; y += 1) b.set(x, y, z, FOOT)
    const side = x === CX - 3 || x === CX + 3 || z === PZ1
    for (let y = F; y <= F + 3; y += 1) b.set(x, y, z, side ? WALL : 'air')
  }
  b.clear([CX - 1, F, PZ1], [CX + 1, F + 2, PZ1]) // open front
  for (let x = CX - 2; x <= CX + 2; x += 1) for (let z = PZ0; z < PZ1; z += 1) b.set(x, F - 1, z, 'spruce_planks')
  {
    const tmp = b.module(b.size)
    tmp.roof({ x0: CX - 3, x1: CX + 3, z0: PZ0 - 3, z1: PZ1, y: F + 4, type: 'gable', axis: 'z', material: 'dark_oak', pitch: 2, overhang: 1, gableOverhang: 1, gable: 'stripped_spruce_log[axis=y]', eaveTrim: true })
    // merge: a porch cell survives only where it sits above the main roof surface, so the
    // cross gable runs back over the main slope until it dives under it (a clean valley)
    for (const [x, y, z, blk] of tmp.entries()) {
      const mainTop = topPiece.get(`${x},${z}`)
      if (mainTop !== undefined && y <= mainTop) continue
      if (mainTop === undefined && inFoot(x, z)) continue
      b.set(x, y, z, blk)
    }
  }
  // roof: dark oak shingles, sun-bleached spruce clumps toward the ridge, moss where it stays damp
  b.texture([X0 - 2, EAVE - 2, CZ - 10], [X1 + 2, F + 20, CZ + 12], ['spruce', 'dark_oak', 'dark_oak'], { only: ['dark_oak_stairs', 'dark_oak_slab', 'dark_oak_planks'], mid: 0.55, base: 0.3, top: 0.35, edge: 0, drip: 0, noise: 0.3, scale: 5, seed: 5 })
  // moss on riser planks where the roof stays damp: low rows near the eave and the sagging middle
  for (const [key, yTop] of topPiece) {
    const [x, z] = key.split(',').map(Number)
    const out = Math.sign(z - CZ)
    if (out === 0) continue
    const r = clamp(1 - Math.abs(z - CZ) / span(x), 0, 1)
    const wet = 0.45 * (1 - r) + 0.25 * (1 - Math.min(1, Math.abs(u(x))))
    for (let y = yTop - 3; y < yTop; y += 1) {
      const blk = b.get(x, y, z)
      if (!blk || !/_planks$/.test(blk.name) || b.has(x, y, z + out)) continue
      if (kit.noise.coherent01(x, y, z, { scale: 3.5, seed: 91 }) + wet > 1.02) b.set(x, y, z, 'moss_block')
    }
  }
  // ---- gable ends: barge boards along the rake and crossed horns over the apex
  const ridgeTop = x => topPiece.get(`${x},${CZ}`)
  for (const gx of [X0 - 1, X1 + 1]) {
    const yR = ridgeTop(gx)
    // horns: the two barge boards cross above the apex and splay out into carved, outward-looking heads
    b.set(gx, yR + 1, CZ, 'dark_oak_planks')
    for (const s of [-1, 1]) {
      for (const [dz, dy] of [[1, 1], [1, 2], [2, 3], [2, 4]]) b.set(gx, yR + dy, CZ + s * dz, 'dark_oak_planks')
      const inward = s > 0 ? 'north' : 'south'
      b.set(gx, yR + 5, CZ + s * 3, `dark_oak_stairs[facing=${inward},half=bottom]`) // snout
      b.set(gx, yR + 5, CZ + s * 2, 'dark_oak_planks')
      b.set(gx, yR + 4, CZ + s * 3, `dark_oak_stairs[facing=${inward},half=top]`) // jaw
    }
  }
  {
    const pr = b.topY(CX, PZ1 + 1)
    for (const s of [-1, 1]) {
      b.set(CX + s, pr + 1, PZ1 + 1, 'dark_oak_planks')
      b.set(CX + s * 2, pr + 2, PZ1 + 1, `dark_oak_stairs[facing=${s > 0 ? 'west' : 'east'},half=bottom]`)
    }
  }
  // smoke hole over the hearth: open the ridge and cap it with a little louvre
  const yS = ridgeTop(CX)
  for (let x = CX - 1; x <= CX + 1; x += 1) for (let y = yS - 3; y <= yS; y += 1) b.remove(x, y, CZ)
  for (const [x, z] of [[CX - 1, CZ - 1], [CX + 1, CZ - 1], [CX - 1, CZ + 1], [CX + 1, CZ + 1]])
    for (let y = topPiece.get(`${x},${z}`) + 1; y <= yS + 1; y += 1) b.set(x, y, z, 'dark_oak_fence')
  for (let x = CX - 2; x <= CX + 2; x += 1) {
    b.set(x, yS + 2, CZ - 1, 'dark_oak_stairs[facing=south,half=bottom]')
    b.set(x, yS + 2, CZ + 1, 'dark_oak_stairs[facing=north,half=bottom]')
    b.set(x, yS + 2, CZ, 'dark_oak_slab[type=bottom]')
  }

  // door into the hall (inside the porch) and a carved frame at the porch mouth
  b.remove(CX, F, PZ0 - 1)
  b.remove(CX, F + 1, PZ0 - 1)
  b.door([CX, F, PZ0 - 1], 'south', { material: 'spruce' })
  for (const s of [-1, 1]) b.box([CX + s * 2, F, PZ1], [CX + s * 2, F + 3, PZ1], 'dark_oak_log[axis=y]')
  for (const s of [-1, 1]) b.box([CX + s * 3, F - 1, PZ1], [CX + s * 3, F + 3, PZ1], 'dark_oak_log[axis=y]')
  b.set(CX - 1, F + 2, PZ1, 'dark_oak_stairs[facing=east,half=top]')
  b.set(CX + 1, F + 2, PZ1, 'dark_oak_stairs[facing=west,half=top]')
  b.set(CX, F + 3, PZ1, 'stripped_dark_oak_log[axis=x]')
  b.set(CX - 1, F + 3, PZ1, 'stripped_dark_oak_log[axis=x]')
  b.set(CX + 1, F + 3, PZ1, 'stripped_dark_oak_log[axis=x]')

  // ---- east gable door (toward the gate) with a stoop
  b.door([X1, F, CZ], 'east', { material: 'dark_oak', frame: 'dark_oak_log[axis=y]' })
  b.set(X1 + 1, F - 1, CZ, 'cobblestone_slab[type=top]')

  // ---- small windows: dim openings with a shutter, few and high (dark interiors were the norm)
  const windows = [[31, 1], [37, 1], [49, 1], [55, 1], [33, -1], [53, -1]]
  for (const [x, s] of windows) {
    const z = CZ + s * Wd(x)
    b.set(x, F + 2, z, 'brown_stained_glass_pane')
    b.set(x, F + 3, z, 'stripped_dark_oak_log[axis=x]') // lintel
    const face = s > 0 ? 'south' : 'north'
    b.set(x - 1, F + 2, z + s, `spruce_trapdoor[facing=${face},open=true,half=top]`, { keep: true })
  }
  // gable vents (owl holes) under the apex
  for (const gx of [X0, X1]) b.set(gx, ridgeTop(gx) - 4, CZ, 'air')

  // ---- texture: log walls (custom paint: b.texture maps 'stripped_spruce_log' to the spruce
  // family's block = planks, so logs are coloured here by hand: darker, tarred courses low down)
  const logWall = (x, y, z) => {
    const blk = b.get(x, y, z)
    if (!blk || blk.name !== 'minecraft:white_wool') return null
    const along = (dx, dz) => {
      const n = b.get(x + dx, y, z + dz)
      return n !== null && n.name !== 'minecraft:air'
    }
    const alongX = along(1, 0) && along(-1, 0)
    const alongZ = along(0, 1) && along(0, -1)
    if (!alongX && !alongZ) return 'dark_oak_log[axis=y]'
    const axis = alongX ? 'x' : 'z'
    const damp = (y - F) / 4 + 0.35 * (kit.noise.coherent01(x, y, z, { scale: 5, seed: 21 }) - 0.5)
    return damp < 0.3 ? `stripped_dark_oak_log[axis=${axis}]` : `stripped_spruce_log[axis=${axis}]`
  }
  for (let x = X0 - 1; x <= X1 + 1; x += 1) for (let z = CZ - 10; z <= CZ + 12; z += 1) for (let y = F; y <= F + 8; y += 1) {
    const p = logWall(x, y, z)
    if (p) b.set(x, y, z, p)
  }
  b.texture([X0 - 2, F - 8, CZ - 10], [X1 + 2, F, CZ + 12], ['cobblestone', 'mossy_cobblestone', 'cobbled_deepslate'], { only: FOOT, base: 0.35, edge: 0.15, noise: 0.25, seed: 3 })

  // ---- interior
  for (let x = X0 + 1; x < X1; x += 1) for (let z = CZ - 8; z <= CZ + 8; z += 1) {
    if (!inFoot(x, z) || isWall(x, z)) continue
    const dz = Math.abs(z - CZ)
    const wx = Wd(x)
    if (dz >= wx - 2) { // raised sleeping/sitting platforms along the long walls
      b.set(x, F - 1, z, 'spruce_planks')
      b.set(x, F, z, dz === wx - 2 ? `spruce_stairs[facing=${z > CZ ? 'south' : 'north'},half=bottom]` : 'spruce_planks')
    } else b.set(x, F - 1, z, pal({ packed_mud: 5, coarse_dirt: 3, rooted_dirt: 1 }, 31, 2))
  }
  // furs and bedding on the platforms
  for (let x = X0 + 6; x < X1 - 5; x += 1) for (const s of [-1, 1]) {
    const z = CZ + s * (Wd(x) - 1)
    const h = hash(x, 0, z, 33)
    if (h < 0.35) b.set(x, F + 1, z, h < 0.12 ? 'white_carpet' : h < 0.24 ? 'brown_carpet' : 'light_gray_carpet')
  }
  // long hearth under the smoke hole
  for (let x = CX - 4; x <= CX + 4; x += 1) for (let z = CZ - 1; z <= CZ + 1; z += 1) {
    const rim = Math.abs(x - CX) === 4 || z !== CZ
    b.set(x, F - 1, z, 'cobblestone')
    b.set(x, F, z, rim ? 'stone_brick_slab[type=bottom]' : (Math.abs(x - CX) % 3 === 0 ? 'campfire[lit=true]' : 'gravel'))
  }
  // roof-carrying aisle posts with tie beams; lanterns hang from the beams
  for (let x = X0 + 5; x <= X1 - 5; x += 4) {
    for (const s of [-1, 1]) {
      const z = CZ + s * 3
      let y = F
      while (y < F + 20 && !b.has(x, y, z)) b.set(x, y++, z, 'stripped_spruce_log[axis=y]')
    }
    for (let z = CZ - 3; z <= CZ + 3; z += 1) b.set(x, F + 6, z, 'stripped_dark_oak_log[axis=z]')
    if (Math.abs(x - CX) > 3) b.hangingLantern([x, F + 6, CZ], 1)
  }
  // high seat on the north platform, facing the hearth, between two carved pillars
  b.set(CX, F + 1, CZ - Wd(CX) + 1, 'dark_oak_stairs[facing=north,half=bottom]')
  for (const s of [-1, 1]) {
    b.box([CX + s, F + 1, CZ - Wd(CX) + 1], [CX + s, F + 3, CZ - Wd(CX) + 1], 'stripped_dark_oak_log[axis=y]')
    b.set(CX + s, F + 4, CZ - Wd(CX) + 1, 'dark_oak_fence')
  }
  b.set(CX, F + 1, CZ - Wd(CX) + 2, 'red_carpet')
  // feasting tables at both ends of the hearth (top slabs) with stair benches
  for (const s of [-1, 1]) {
    for (let x = CX + s * 6; Math.abs(x - CX) <= 9; x += s) {
      b.set(x, F, CZ, 'spruce_slab[type=top]')
      b.set(x, F, CZ - 1, 'spruce_stairs[facing=north,half=bottom]')
      b.set(x, F, CZ + 1, 'spruce_stairs[facing=south,half=bottom]')
    }
  }
  // shields hung on the inner walls above the platforms, the same red and white as the ship
  for (let x = X0 + 7; x <= X1 - 7; x += 2) for (const s of [-1, 1]) {
    const z = CZ + s * (Wd(x) - 1)
    if (b.has(x, F + 2, z) || hash(x, 2, z, 35) < 0.3) continue
    b.set(x, F + 2, z, `${(x + (s > 0 ? 1 : 0)) % 4 < 2 ? 'mangrove' : 'birch'}_trapdoor[facing=${s > 0 ? 'north' : 'south'},open=true,half=top]`)
  }
  for (const [x, z] of [[X0 + 7, CZ - Wd(X0 + 7) + 1], [X1 - 7, CZ + Wd(X1 - 7) - 1], [CX + 5, CZ - Wd(CX + 5) + 1]]) b.set(x, F + 1, z, 'barrel[facing=up]')
  // end rooms behind plank partitions
  for (const px of [X0 + 5, X1 - 5]) {
    for (let z = CZ - 6; z <= CZ + 6; z += 1) {
      if (!inFoot(px, z) || isWall(px, z)) continue
      let y = F
      while (y < F + 20 && !b.has(px, y, z)) b.set(px, y++, z, 'spruce_planks')
    }
    b.clear([px, F, CZ], [px, F + 1, CZ])
    b.door([px, F, CZ], px < CX ? 'east' : 'west', { material: 'spruce' })
  }
  // west room: sleeping chamber; east room: stores
  b.set(X0 + 2, F, CZ - 2, 'red_bed[facing=north,part=foot]')
  b.set(X0 + 3, F, CZ - 2, 'red_bed[facing=north,part=foot]')
  b.set(X0 + 1, F, CZ + 3, 'chest[facing=north]')
  b.set(X0 + 1, F, CZ - 3, 'loom[facing=east]')
  b.hangingLantern([X0 + 3, F + 6, CZ], 1)
  for (const [x, z] of [[X1 - 1, CZ - 3], [X1 - 1, CZ - 4], [X1 - 2, CZ - 4], [X1 - 1, CZ + 3], [X1 - 1, CZ + 4]]) b.set(x, F, z, 'barrel[facing=up]')
  b.set(X1 - 2, F, CZ + 4, 'smoker[facing=west,lit=true]')
  b.set(X1 - 3, F, CZ + 4, 'crafting_table')
  b.hangingLantern([X1 - 3, F + 6, CZ], 1)

  // ================================================================ 3 OUTBUILDINGS
  // helper: stacked-log walls with a stone footing, floor at fy
  const logBox = (x0, z0, x1, z1, fy, h, log) => {
    for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) {
      for (let y = Math.min(ground(x, z), fy - 1) - 1; y <= fy - 1; y += 1) b.set(x, y, z, FOOT)
      const edge = x === x0 || x === x1 || z === z0 || z === z1
      const corner = (x === x0 || x === x1) && (z === z0 || z === z1)
      for (let y = fy; y < fy + h; y += 1) {
        if (!edge) b.remove(x, y, z)
        else b.set(x, y, z, corner ? `${log}[axis=y]` : `${log}[axis=${z === z0 || z === z1 ? 'x' : 'z'}]`)
      }
    }
  }
  // turf: replace a roof's surface with sod (stepped full blocks) and keep a wooden eave
  const TURF_ROOF = pal({ grass_block: 8, moss_block: 3, podzol: 1, rooted_dirt: 1 }, 41, 3)
  const turfRoof = (x0, z0, x1, z1, yMin) => {
    for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) {
      const y = b.topY(x, z)
      if (y < yMin) continue
      const blk = b.get(x, y, z)
      if (!/_stairs$|_slab$|_planks$/.test(blk.name)) continue
      const below = b.get(x, y - 1, z)
      const eave = !below || below.name === 'minecraft:air' || /half=top/.test(JSON.stringify(below.props ?? {}))
      if (eave && /_stairs$/.test(blk.name)) continue
      b.set(x, y, z, TURF_ROOF)
    }
  }

  // --- naust (boathouse): dry-stone walls dug into the headland, open gable to the water
  const NF = WATER + 2
  const NCX = (N.x0 + N.x1) / 2
  for (let x = N.x0 - 1; x <= N.x1 + 1; x += 1) for (let z = N.z0 - 1; z <= N.z1; z += 1) b.clear([x, NF, z], [x, NF + 14, z])
  for (let x = N.x0; x <= N.x1; x += 1) for (let z = N.z0; z <= N.z1; z += 1) {
    const side = x === N.x0 || x === N.x1 || z === N.z0
    const slip = Math.round(NF - 1 - Math.max(0, z - (N.z1 - 6)) * 0.7)
    for (let y = Math.min(ground(x, z), slip) - 2; y <= slip; y += 1) b.set(x, y, z, side ? FOOT : 'gravel')
    for (let y = slip + 1; y <= WATER; y += 1) if (!side) b.set(x, y, z, 'water')
    if (side) for (let y = slip + 1; y <= NF + 2; y += 1) b.set(x, y, z, FOOT)
  }
  b.roof({ x0: N.x0, x1: N.x1, z0: N.z0, z1: N.z1, y: NF + 3, type: 'gable', axis: 'z', material: 'spruce', pitch: 1, overhang: 1, gableOverhang: 1, gable: 'spruce_planks', eaveTrim: true })
  b.clear([N.x0 + 1, NF - 1, N.z1], [N.x1 - 1, NF + 4, N.z1]) // open water gable
  for (const x of [N.x0 + 1, N.x1 - 1]) b.box([x, NF - 2, N.z1], [x, NF + 3, N.z1], 'spruce_log[axis=y]')
  for (let x = N.x0 + 1; x <= N.x1 - 1; x += 1) b.set(x, NF + 3, N.z1, 'stripped_spruce_log[axis=x]')
  b.door([NCX, NF, N.z0], 'north', { material: 'spruce' })
  turfRoof(N.x0 - 1, N.z0 - 1, N.x1 + 1, N.z1 + 1, NF + 3)

  // --- smokehouse: bark-on logs, sod roof, stone chimney
  const SF = Math.max(...[SMOKE.x0, SMOKE.x1].flatMap(x => [SMOKE.z0, SMOKE.z1].map(z => ground(x, z)))) + 1
  logBox(SMOKE.x0, SMOKE.z0, SMOKE.x1, SMOKE.z1, SF, 3, 'spruce_log')
  b.box([SMOKE.x0 + 1, SF - 1, SMOKE.z0 + 1], [SMOKE.x1 - 1, SF - 1, SMOKE.z1 - 1], 'cobblestone')
  b.roof({ x0: SMOKE.x0, x1: SMOKE.x1, z0: SMOKE.z0, z1: SMOKE.z1, y: SF + 3, type: 'gable', axis: 'x', material: 'spruce', pitch: 1, overhang: 1, gableOverhang: 1, gable: 'spruce_planks', eaveTrim: true })
  turfRoof(SMOKE.x0 - 1, SMOKE.z0 - 1, SMOKE.x1 + 1, SMOKE.z1 + 1, SF + 3)
  b.chimney([SMOKE.x1 - 1, SF, SMOKE.z0 + 3], 9, { paint: pal({ cobblestone: 4, mossy_cobblestone: 2, cobbled_deepslate: 1 }, 43, 2), cap: 'cobblestone_wall' })
  b.door([SMOKE.x0 + 3, SF, SMOKE.z1], 'south', { material: 'spruce' })
  for (let x = SMOKE.x0 + 1; x <= SMOKE.x1 - 2; x += 1) b.box([x, SF + 2, SMOKE.z0 + 2], [x, SF + 2, SMOKE.z1 - 2], 'spruce_fence') // fish rails inside
  b.set(SMOKE.x0 + 2, SF, SMOKE.z0 + 2, 'campfire[lit=true]')

  // --- stabbur: storehouse on stilts with a gap at the top of its steps (no rats)
  const TG = Math.max(...[STAB.x0, STAB.x1].flatMap(x => [STAB.z0, STAB.z1].map(z => ground(x, z))))
  const TF = TG + 4
  for (const [x, z] of [[STAB.x0, STAB.z0], [STAB.x1, STAB.z0], [STAB.x0, STAB.z1], [STAB.x1, STAB.z1], [STAB.x0, STAB.z0 + 3], [STAB.x1, STAB.z0 + 3]]) {
    for (let y = ground(x, z) - 1; y <= ground(x, z) + 1; y += 1) b.set(x, y, z, 'cobblestone')
    b.box([x, ground(x, z) + 2, z], [x, TF - 2, z], 'stripped_spruce_log[axis=y]')
    b.set(x, TF - 1, z, 'spruce_planks')
  }
  for (let x = STAB.x0 - 1; x <= STAB.x1 + 1; x += 1) for (let z = STAB.z0 - 1; z <= STAB.z1 + 1; z += 1) b.set(x, TF - 1, z, 'spruce_planks')
  for (let x = STAB.x0 - 1; x <= STAB.x1 + 1; x += 1) b.set(x, TF - 1, STAB.z1 + 1, 'spruce_slab[type=top]')
  logBox(STAB.x0, STAB.z0, STAB.x1, STAB.z1 - 1, TF, 4, 'stripped_spruce_log')
  for (let x = STAB.x0; x <= STAB.x1; x += 1) for (let z = STAB.z0; z <= STAB.z1 - 1; z += 1) for (let y = TF - 5; y < TF - 1; y += 1) {
    const blk = b.get(x, y, z)
    if (blk && blk.name === 'minecraft:light_gray_wool') b.remove(x, y, z)
  }
  b.roof({ x0: STAB.x0, x1: STAB.x1, z0: STAB.z0, z1: STAB.z1 - 1, y: TF + 4, type: 'gable', axis: 'z', material: 'dark_oak', pitch: 2, overhang: 1, gableOverhang: 1, gable: 'stripped_spruce_log[axis=y]', eaveTrim: true })
  b.door([STAB.x0 + 2, TF, STAB.z1 - 1], 'south', { material: 'spruce' })
  for (let x = STAB.x0 - 1; x <= STAB.x1 + 1; x += 2) b.set(x, TF, STAB.z1 + 1, 'spruce_fence')
  b.stairway([STAB.x0 + 2, TG + 1, STAB.z1 + 5], 'north', 2, 'spruce', { width: 1 })
  b.hangingLantern([STAB.x0 + 4, TF + 3, STAB.z1 + 1], 0)

  // ================================================================ 4 PALISADE
  const lineCells = ([ax, az], [cx2, cz2]) => {
    const out = [[ax, az]]
    let x = ax, z = az
    const dx = cx2 - ax, dz = cz2 - az
    while (x !== cx2 || z !== cz2) {
      const cand = []
      if (x !== cx2) cand.push([x + Math.sign(dx), z])
      if (z !== cz2) cand.push([x, z + Math.sign(dz)])
      const dist = ([px, pz]) => Math.abs((px - ax) * dz - (pz - az) * dx)
      cand.sort((p, q) => dist(p) - dist(q))
      ;[x, z] = cand[0]
      out.push([x, z])
    }
    return out
  }
  const stakes = new Map()
  for (let i = 1; i < PALISADE.length; i += 1) for (const c of lineCells(PALISADE[i - 1], PALISADE[i])) stakes.set(`${c[0]},${c[1]}`, c)
  for (const [x, z] of stakes.values()) {
    if (x === GATE.x && z >= GATE.z0 && z <= GATE.z1) continue
    const g = ground(x, z)
    const top = g + 3 + (kit.noise.coherent01(x, 0, z, { scale: 4, seed: 52 }) > 0.45 ? 1 : 0) + (hash(x, 0, z, 51) < 0.3 ? 1 : 0)
    b.box([x, g - 1, z], [x, top, z], 'spruce_log[axis=y]')
    b.set(x, top + 1, z, 'spruce_fence')
  }
  // gate: tall posts, a lintel with crossed horns, open gates and braziers
  {
    const g = ground(GATE.x, (GATE.z0 + GATE.z1) / 2)
    for (const z of [GATE.z0 - 1, GATE.z1 + 1]) b.box([GATE.x, ground(GATE.x, z) - 1, z], [GATE.x, g + 7, z], 'dark_oak_log[axis=y]')
    for (let z = GATE.z0 - 2; z <= GATE.z1 + 2; z += 1) b.set(GATE.x, g + 7, z, 'stripped_dark_oak_log[axis=z]')
    const gz = (GATE.z0 + GATE.z1) / 2
    for (const s of [-1, 1]) {
      b.set(GATE.x, g + 8, gz + s, 'stripped_dark_oak_log[axis=y]')
      b.set(GATE.x, g + 9, gz + s * 2, `dark_oak_stairs[facing=${s > 0 ? 'north' : 'south'},half=bottom]`)
    }
    b.set(GATE.x, g + 8, gz, 'stripped_dark_oak_log[axis=y]')
    for (let z = GATE.z0; z <= GATE.z1; z += 1) b.set(GATE.x, g - 1, z, 'cobblestone')
    for (const z of [GATE.z0 - 3, GATE.z1 + 3]) {
      const gx = GATE.x + 2
      b.box([gx, ground(gx, z) + 1, z], [gx, ground(gx, z) + 1, z], 'cobblestone_wall')
      b.set(gx, ground(gx, z) + 2, z, 'campfire[lit=true]')
    }
  }

  // ================================================================ 5 SHORE: pier and longship
  // pier: plank deck two above the water on log posts; posts stand proud as bollards
  const PY = WATER + 2
  for (let z = PIER.z0; z <= PIER.z1; z += 1) for (let x = PIER.x0; x <= PIER.x1; x += 1) {
    if (ground(x, z) >= PY) continue
    b.set(x, PY, z, x === PIER.x0 || x === PIER.x1 ? 'stripped_spruce_log[axis=z]' : 'spruce_planks')
  }
  for (let z = PIER.z0; z <= PIER.z1; z += 3) for (const x of [PIER.x0, PIER.x1]) {
    if (ground(x, z) >= PY) continue
    b.box([x, ground(x, z), z], [x, PY + 1, z], 'spruce_log[axis=y]')
  }
  b.lampPost([PIER.x0, PY + 1, PIER.z1], { height: 3, post: 'spruce_fence', arm: 'east' })

  // longship: a lofted hull (half-breadth, keel rocker and sheer as functions along the length)
  const longship = (tb, { cx, z0, z1, wy, beam = 3.4, keel = 2, free = 2, sheer = 2.5, mast = true, dragon = true, shields = true }) => {
    const L = z1 - z0
    const hb = t => beam * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.55)
    const yk = t => wy - keel + (keel + 0.2) * Math.pow(Math.abs(2 * t - 1), 3)
    const ys = t => wy + free + sheer * Math.pow(Math.abs(2 * t - 1), 2.4) + (t > 0.5 ? 0.6 * (2 * t - 1) : 0)
    const inside = (x, y, z) => {
      const t = (z - z0) / L
      if (t < 0 || t > 1) return false
      if (y < Math.round(yk(t)) || y > Math.round(ys(t))) return false
      const v = clamp((y - yk(t)) / Math.max(1, ys(t) - yk(t)), 0, 1)
      return Math.abs(x - cx) <= Math.max(0.4, hb(t) * (0.3 + 0.7 * Math.pow(v, 0.8)) + 0.15)
    }
    const R = Math.ceil(beam) + 1
    const top = Math.ceil(wy + free + sheer + 1)
    for (let z = z0; z <= z1; z += 1) for (let x = cx - R; x <= cx + R; x += 1) for (let y = wy - keel - 1; y <= top; y += 1) {
      if (!inside(x, y, z)) continue
      const shell = !inside(x + 1, y, z) || !inside(x - 1, y, z) || !inside(x, y, z + 1) || !inside(x, y, z - 1)
      const t = (z - z0) / L
      const rail = y === Math.round(ys(t))
      if (!shell) {
        if (y > wy) tb.remove(x, y, z)
        else tb.set(x, y, z, y === wy ? 'spruce_planks' : 'spruce_planks')
        continue
      }
      const flare = !inside(x, y - 1, z) && x !== cx
      const inward = x > cx ? 'west' : 'east'
      const mat = rail || y === wy ? 'dark_oak' : 'spruce'
      tb.set(x, y, z, flare ? `${mat}_stairs[facing=${inward},half=top]` : `${mat}_planks`)
    }
    // benches
    for (let z = z0 + 4; z <= z1 - 4; z += 3) for (let x = cx - R; x <= cx + R; x += 1)
      if (inside(x, wy + 1, z) && !tb.has(x, wy + 1, z)) tb.set(x, wy + 1, z, 'spruce_slab[type=bottom]')
    // shields along the rail, red and white, one per bench room
    for (let z = z0 + 3; z <= z1 - 3 && shields; z += 1) {
      const t = (z - z0) / L
      const y = Math.round(ys(t))
      for (const s of [-1, 1]) {
        let x = cx
        while (inside(x + s, y, z)) x += s
        const face = s > 0 ? 'east' : 'west'
        tb.set(x + s, y, z, `${z % 2 ? 'mangrove' : 'birch'}_trapdoor[facing=${face},open=true,half=top]`)
      }
    }
    if (dragon) {
      // Stem post rising into a dragon head that looks forward (bow = +z), drawn as a side
      // profile (dz forward, dy up): an S-curved neck, a two-block skull, an open beak made of an
      // upside-down stair over a slab, a swept-back crest and glowing eyes. Stern: a curled tail.
      const yb = Math.round(ys(1))
      for (const [dz, dy] of [[0, 1], [1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [2, 5], [2, 6], [3, 6]]) tb.set(cx, yb + dy, z1 + dz, 'dark_oak_planks')
      tb.set(cx, yb + 7, z1 + 3, 'dark_oak_planks')
      tb.set(cx, yb + 7, z1 + 4, 'dark_oak_stairs[facing=north,half=top]') // upper jaw
      tb.set(cx, yb + 6, z1 + 4, 'dark_oak_slab[type=bottom]') // lower jaw
      tb.set(cx, yb + 8, z1 + 2, 'dark_oak_stairs[facing=south,half=bottom]') // crest
      tb.set(cx, yb + 7, z1 + 2, 'dark_oak_stairs[facing=south,half=top]')
      for (const s of [-1, 1]) tb.set(cx + s, yb + 7, z1 + 3, `redstone_wall_torch[facing=${s > 0 ? 'east' : 'west'},lit=true]`)
      const yt = Math.round(ys(0))
      for (const [dz, dy] of [[0, 1], [-1, 1], [-1, 2], [-1, 3], [-1, 4], [0, 5]]) tb.set(cx, yt + dy, z0 + dz, 'dark_oak_planks')
      tb.set(cx, yt + 5, z0 - 1, 'dark_oak_stairs[facing=south,half=top]')
      tb.set(cx, yt + 4, z0, 'dark_oak_stairs[facing=north,half=top]')
    }
    if (mast) {
      // square sail, wider than tall (~0.45 of the hull length), red and white strakes,
      // billowing up to 2 blocks toward the bow; gaps between bulge levels are filled so the
      // cloth reads as one surface from every side
      const zm = Math.round(z0 + L * 0.5)
      const mh = 12, SW = 5, y0 = wy + 4, y1 = wy + mh - 2
      tb.box([cx, wy + 1, zm], [cx, wy + mh, zm], 'spruce_log[axis=y]')
      tb.box([cx - SW - 1, wy + mh - 1, zm], [cx + SW + 1, wy + mh - 1, zm], 'stripped_spruce_log[axis=x]')
      const bulge = (x, y) => {
        if (Math.abs(x - cx) > SW || y < y0 || y > y1) return null
        const sx = (x - cx) / (SW + 0.5), sy = (y - (y0 + y1) / 2) / ((y1 - y0) / 2 + 0.5)
        return Math.round(1.6 * (1 - sx * sx) * (1 - 0.5 * sy * sy))
      }
      for (let x = cx - SW; x <= cx + SW; x += 1) for (let y = y0; y <= y1; y += 1) {
        const k = bulge(x, y)
        const kmin = Math.min(k, ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ax, ay]) => bulge(x + ax, y + ay) ?? k))
        const d = Math.abs(x - cx)
        for (let j = kmin; j <= k; j += 1) tb.set(x, y, zm + 1 + j, d <= 1 || d >= 4 ? 'red_wool' : 'white_wool')
      }
      tb.set(cx, wy + mh + 1, zm, 'spruce_fence')
      tb.set(cx, wy + 1, z0 + 3, 'spruce_fence')
      tb.set(cx, wy + 2, z0 + 3, 'lantern[hanging=false]')
    }
    return { inside, ys, yk }
  }
  // The ship is authored along +z (bow south) in a scratch module and stamped turned a quarter
  // (rotate: 1 = clockwise: bow -> west), so it lies broadside to the main views with its dragon
  // head against the pale cliff. stamp() rotates every block state (stairs, trapdoor shields, torches).
  {
    const mod = b.module([13, SIZE[1], 30])
    longship(mod, { cx: 6, z0: 2, z1: 25, wy: WATER })
    b.stamp(mod, [SHIP.x - 29, 0, SHIP.z - 6], { rotate: 1 }) // module (x, z) -> world (SHIP.x - z, SHIP.z - 6 + x)
  }
  // a small boat tied up on the other side of the pier
  {
    const mod = b.module([5, SIZE[1], 12])
    longship(mod, { cx: 2, z0: 1, z1: 10, wy: WATER, beam: 1.6, keel: 1, free: 1, sheer: 1.2, mast: false, dragon: false, shields: false })
    b.stamp(mod, [PIER.x0 - 5, 0, PIER.z1 - 11])
  }

  // faering (small rowing boat) in the naust
  longship(b, { cx: NCX, z0: N.z0 + 3, z1: N.z0 + 11, wy: NF, beam: 1.6, keel: 1, free: 1, sheer: 1.2, mast: false, dragon: false, shields: false })

  // a faering pulled up on the east beach
  {
    const mod = b.module([5, SIZE[1], 12])
    longship(mod, { cx: 2, z0: 1, z1: 10, wy: ground(68, 49) + 1, beam: 1.6, keel: 1, free: 1, sheer: 1.2, mast: false, dragon: false, shields: false })
    b.stamp(mod, [66, 0, 45], { rotate: 2 }) // bow up the beach (north)
  }
  // fish-drying racks (hjell) on the beach: fence posts, a log rail, stockfish hanging below
  const rack = (x0, z, len) => {
    const g = Math.max(...Array.from({ length: len }, (_, i) => ground(x0 + i, z)))
    for (let i = 0; i < len; i += 1) {
      const x = x0 + i
      if (i % 3 === 0) b.box([x, ground(x, z) + 1, z], [x, g + 3, z], 'spruce_fence')
      b.set(x, g + 4, z, 'stripped_spruce_log[axis=x]')
      if (i % 3 !== 0) b.set(x, g + 3, z, 'hanging_roots')
    }
  }
  rack(74, 42, 7)
  rack(72, 45, 7)

  // ================================================================ 6 LANDSCAPE
  const paths = [
    [[GATE.x + 2, 25], [76, 25], [69, 27], [X1 + 2, CZ]],
    [[CX, PZ1 + 1], [CX - 3, 41], [37, 43], [PIER.x0 + 1, PIER.z0 + 1]],
    [[CX - 3, 41], [30, 41], [NCX + 1, N.z0 - 2]],
    [[CX, PZ1 + 1], [CX + 5, 42], [56, 44], [64, 43], [SMOKE.x0 + 3, SMOKE.z1 + 2]],
    [[X1 + 2, CZ], [66, 22], [STAB.x0 + 2, STAB.z1 + 6]],
  ]
  for (const [i, p] of paths.entries()) b.path(p, { width: i < 2 ? 3 : 2, paint: pal({ coarse_dirt: 6, dirt_path: 3, gravel: 2, rooted_dirt: 1 }, 61 + i, 3.5), seed: i })

  // rocks: boulders on the beach, skerries off the headland
  const ROCK = pal({ stone: 5, andesite: 3, cobblestone: 2, tuff: 1 }, 71, 2)
  // (built in a scratch module and mossed on their own top faces: boulder({ mossTop }) mosses
  // the top block of every column in its bounding square, water and grass included)
  const rock = (c, radii, seed) => {
    const tmp = b.module(b.size)
    tmp.boulder(c, radii, ROCK, { seed })
    for (const [x, y, z, blk] of tmp.entries()) {
      const exposed = !tmp.has(x, y + 1, z)
      b.set(x, y, z, exposed && y > WATER && kit.noise.coherent01(x, y, z, { scale: 3, seed }) < 0.5 ? 'moss_block' : blk)
    }
  }
  for (const [x, z, r, s] of [[27, 50, 2.0, 1], [50, 50, 1.5, 3], [79, 51, 2.0, 4], [8, 67, 2.4, 5], [57, 60, 1.6, 7], [62, 66, 2.2, 8], [80, 63, 1.8, 9]])
    rock([x, Math.max(ground(x, z), WATER - 1) + 0.3, z], [r * 1.3, r, r], s)
  // a skerry with a cairn (varde) as a sea mark, lit at night
  rock([72, WATER - 1, 62], [4.2, 3.2, 3.4], 10)
  {
    const top = b.topY(72, 62)
    for (let y = top + 1; y <= top + 2; y += 1) b.set(72, y, 62, 'cobblestone_wall')
    b.set(72, top + 3, 62, 'campfire[lit=true]')
    b.scatter({ x0: 68, z0: 58, x1: 76, z1: 66, on: ['minecraft:moss_block'], density: 0.5, clump: 2, seed: 9, paints: [[3, 'short_grass'], [1, 'fern']] })
  }
  // fish weir: a V of stakes in the shallows off the east beach
  for (const [a2, c2] of [[[64, 53], [68, 57]], [[72, 53], [68, 57]]])
    for (const [x, z] of lineCells(a2, c2)) {
      const g = ground(x, z)
      for (let y = g + 1; y <= WATER + 1; y += 1) b.set(x, y, z, y <= WATER ? 'spruce_fence[waterlogged=true]' : 'spruce_fence')
    }

  // trees: a pine/spruce forest on the slopes outside the palisade, a grove on the headland
  const treeSpots = []
  const tryTree = (x, z, minD) => {
    if (x < 1 || x > W - 2 || z < 1 || z > D - 2) return false
    if (treeSpots.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < minD)) return false
    treeSpots.push([x, z])
    return true
  }
  for (let i = 0; i < 900; i += 1) {
    const x = rng.int(4, W - 5), z = rng.int(4, D - 5)
    const g = ground(x, z)
    if (g <= WATER + 1) continue
    const outsideN = z < 6 + 1.5 * n2(x, 0, 8, 2)
    const east = x > 84
    const head = x < cliffX(z) - 1 && z < 60
    if (!(outsideN || east || head)) continue
    if (kit.noise.coherent01(x, 0, z, { scale: 9, seed: 81 }) < 0.3) continue // glades
    if (!tryTree(x, z, 5.5)) continue
    const big = rng.chance(0.25)
    const sp = big || rng.chance(0.4) ? 'pine' : 'spruce'
    const h = Math.min(SIZE[1] - g - 4, big ? rng.int(19, 23) : sp === 'pine' ? rng.int(14, 18) : rng.int(9, 15))
    b.tree([x, g + 1, z], sp, { seed: i, height: h, radius: sp === 'spruce' ? Math.min(3.2, rng.range(2.6, 3.6)) : 3.2 })
  }
  for (const [x, z, h] of [[30, 12, 11], [56, 12, 9], [21, 17, 13]]) b.tree([x, ground(x, z) + 1, z], 'spruce', { seed: x, height: h, radius: 3 })

  // ground cover
  b.scatter({ density: 0.22, clump: 6, seed: 3, paints: [[10, 'short_grass'], [3, 'fern'], [2, 'tall_grass'], [1, 'large_fern']] })
  b.scatter({ x0: 0, z0: 0, x1: W - 1, z1: 10, on: ['minecraft:podzol', 'minecraft:grass_block'], density: 0.08, clump: 5, seed: 4, paints: [[3, 'sweet_berry_bush[age=3]'], [2, 'fern'], [1, 'brown_mushroom']] })
  b.scatter({ x0: 30, z0: 36, x1: 60, z1: 44, density: 0.12, clump: 4, seed: 5, paints: [[2, 'cornflower'], [1, 'oxeye_daisy']] })
  for (const [x0, z0, x1, z1] of [[N.x0 - 2, N.z0 - 2, N.x1 + 2, N.z1 + 2], [SMOKE.x0 - 2, SMOKE.z0 - 2, SMOKE.x1 + 2, SMOKE.z1 + 2]])
    b.scatter({ x0, z0, x1, z1, on: ['minecraft:grass_block', 'minecraft:moss_block'], density: 0.35, clump: 3, seed: x0, paints: [[6, 'short_grass'], [1, 'fern']] })

  // ================================================================ 7 PROPS AND LIGHT
  // firewood against the west gable; hay and barrels by the stabbur; barrels on the pier
  for (let z = CZ - 3; z <= CZ + 3; z += 1) for (let y = F; y <= F + 1 + (Math.abs(z - CZ) < 2 ? 1 : 0); y += 1) b.set(X0 - 1, y, z, 'spruce_log[axis=x]')
  for (const [x, z, blk] of [[STAB.x1 + 2, STAB.z0 + 1, 'hay_block[axis=x]'], [STAB.x1 + 2, STAB.z0 + 2, 'hay_block[axis=x]'], [STAB.x1 + 3, STAB.z0 + 1, 'hay_block[axis=z]'], [PIER.x0 + 1, PIER.z1 - 2, 'barrel[facing=up]'], [PIER.x0 + 1, PIER.z1 - 6, 'barrel[facing=up]'], [SMOKE.x0 - 1, SMOKE.z1 - 1, 'barrel[facing=up]']])
    b.set(x, (x >= PIER.x0 && x <= PIER.x1 && z > PIER.z0 + 4 ? PY : ground(x, z)) + 1, z, blk)
  // Light plan: the hall is the brightest cluster (porch, eaves, braziers, a beach fire in front),
  // then the pier and ship, then single lamps at every other door and along the paths.
  const hang = (x, y, z) => { // lantern at y on a chain from whatever is above it
    let top = y + 1
    while (top < y + 12 && !b.has(x, top, z)) top += 1
    if (top >= y + 12) return
    for (let k = y + 1; k < top; k += 1) b.set(x, k, z, 'chain[axis=y]')
    b.set(x, y, z, 'lantern[hanging=true]')
  }
  hang(CX, F + 2, PZ1 - 1)
  for (const x of [CX - 7, CX + 7, 31, 55]) hang(x, F + 3, CZ + Wd(x) + 1)
  for (const x of [35, 51]) hang(x, F + 3, CZ - Wd(x) - 1)
  for (const s of [-1, 1]) { // braziers flanking the porch path
    const x = CX + s * 3, z = PZ1 + 3
    b.set(x, ground(x, z) + 1, z, 'cobblestone_wall')
    b.set(x, ground(x, z) + 2, z, 'campfire[lit=true]')
  }
  // a beach fire ring with log seats between the hall and the ship
  {
    const fx = 52, fz = 46, g = ground(fx, fz)
    b.set(fx, g, fz, 'cobblestone')
    b.set(fx, g + 1, fz, 'campfire[lit=true]')
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) b.set(fx + dx, ground(fx + dx, fz + dz), fz + dz, dx && dz ? 'gravel' : 'cobblestone')
    b.set(fx - 3, ground(fx - 3, fz) + 1, fz, 'stripped_spruce_log[axis=z]')
    b.set(fx - 3, ground(fx - 3, fz + 1) + 1, fz + 1, 'stripped_spruce_log[axis=z]')
    b.set(fx + 1, ground(fx + 1, fz - 3) + 1, fz - 3, 'stripped_spruce_log[axis=x]')
    b.set(fx + 2, ground(fx + 2, fz - 3) + 1, fz - 3, 'stripped_spruce_log[axis=x]')
  }
  // window glow: a candle on the bench behind each window
  for (const [x, s] of windows) b.set(x, F + 1, CZ + s * (Wd(x) - 1), 'candle[candles=3,lit=true]')
  b.lampPost([PIER.x1, PY + 1, PIER.z0 + 9], { height: 3, post: 'spruce_fence', arm: 'west' })
  hang(SMOKE.x0 + 4, SF + 2, SMOKE.z1 + 1)
  hang(NCX, NF + 2, N.z1)
  b.lampPost([CX + 3, ground(CX + 3, PZ1 + 2) + 1, PZ1 + 2], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall' })
  b.lampPost([60, ground(60, 46) + 1, 46], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall' })
  b.lampPost([X1 + 3, ground(X1 + 3, CZ + 2) + 1, CZ + 2], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall' })
  b.lampPost([NCX + 2, ground(NCX + 2, N.z0 - 2) + 1, N.z0 - 2], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall', arm: 'west' })

  // remove isolated strays (conifer tips, cut plants)
  for (const [x, y, z] of [...b.entries()]) {
    let alone = true
    for (let dx = -1; dx <= 1 && alone; dx += 1) for (let dy = -1; dy <= 1 && alone; dy += 1) for (let dz = -1; dz <= 1 && alone; dz += 1)
      if ((dx || dy || dz) && b.has(x + dx, y + dy, z + dz)) alone = false
    if (alone && y > 0) b.remove(x, y, z)
  }
  b.texture([0, 0, 0], [W - 1, 45, D - 1], ['cobblestone', 'mossy_cobblestone', 'cobbled_deepslate'], { only: FOOT, base: 0.35, edge: 0.15, noise: 0.25, seed: 9 })

  return b.finish({ name: 'nordic-longhouse' })
}
