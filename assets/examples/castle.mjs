// CASTLE (v4)
export default function build(api) {
  const { kit } = api
  const SIZE = [114, 66, 118]
  const b = api.builder(SIZE, { seed: 1187 })
  const N = kit.noise
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]

  const P = 14
  const X0 = 32, X1 = 78, X2 = 82, Z0 = 30, Z1 = 76, ZJ = 53, GX = 57
  const WALK = P + 10
  const CX = 57, CZ = 57

  const st = (mat, facing, half = 'bottom') => `minecraft:${mat}_stairs[facing=${facing},half=${half}]`
  const SB = 'stone_brick'

  // ------------------------------------------------------------------ terrain
  const rectDist = (x, z) => Math.hypot(Math.max(X0 - x, 0, x - X2), Math.max(Z0 - z, 0, z - Z1))
  const MOAT_IN = 9.5, MOAT_OUT = 15.5, WATER = P - 1
  const smooth = t => t * t * (3 - 2 * t)
  const moatWobble = (x, z) => 0.9 * N.fbm2(x, z, { scale: 10, seed: 17 })
  const inMoat = (x, z) => { const d = rectDist(x, z) + moatWobble(x, z); return d > MOAT_IN && d < MOAT_OUT }
  const onDiorama = (x, z) => Math.hypot((x - CX) / 56, (z - CZ) / 58) < 1 - 0.05 * (1 + N.fbm2(x, z, { scale: 14, seed: 9 }))
  const spurAt = (x, z) => Math.max(0, 1 - Math.abs(x - GX - 5 * Math.sin(z / 8)) / 12) * Math.max(0, Math.min(1, (z - Z1 - 14) / 20))
  const H = (x, z) => {
    const d0 = rectDist(x, z) + moatWobble(x, z)
    if (d0 > MOAT_IN && d0 < MOAT_OUT) {
      const t = (d0 - MOAT_IN) / (MOAT_OUT - MOAT_IN)
      return WATER - Math.round(0.5 + 3.5 * Math.sin(Math.PI * t) ** 0.6)
    }
    const d = d0 + 3 * N.fbm2(x, z, { scale: 16, seed: 3 })
    const spur = spurAt(x, z)
    const edge = 17 + 7 * spur
    if (d <= edge || d0 <= MOAT_IN) return P
    const s = Math.min(1, (d - edge) / (13 + 8 * spur))
    const crag = Math.max(0, N.ridged2(x, z, { scale: 22, seed: 13 }) - 0.55) * 9 * Math.sin(Math.PI * s)
    return Math.max(1, P - (P - 2) * smooth(s) + crag + 1.4 * N.fbm2(x, z, { scale: 8, seed: 5 }) * Math.min(1, s * 3))
  }
  const hcache = new Map()
  const height = (x, z) => {
    x = Math.round(x); z = Math.round(z)
    const k = x * 1000 + z
    let v = hcache.get(k)
    if (v === undefined) { v = Math.round(H(x, z)); hcache.set(k, v) }
    return v
  }
  const rock = kit.palette({ stone: 4, andesite: 3, tuff: 2, cobblestone: 1 }, { seed: 7 })
  const deep = kit.palette({ stone: 6, andesite: 2, tuff: 2, gravel: 1 }, { seed: 8 })
  const bank = kit.palette({ gravel: 3, coarse_dirt: 2, mud: 1, clay: 1 }, { seed: 11 })
  const moatBed = kit.palette({ gravel: 2, clay: 2, mud: 1, dirt: 1 }, { seed: 12 })
  for (let x = 0; x < SIZE[0]; x += 1)
    for (let z = 0; z < SIZE[2]; z += 1) {
      if (!onDiorama(x, z)) continue
      const h = height(x, z)
      const steep = Math.max(...D4.map(([dx, dz]) => h - height(x + dx, z + dz)))
      const moat = inMoat(x, z)
      // Bare rock only where the slope is really steep or on the crag ridges; softer steps get
      // coarse dirt, so the hillside reads as turf with outcrops rather than as scales.
      const craggy = steep >= 3 || (steep >= 2 && N.ridged2(x, z, { scale: 22, seed: 13 }) > 0.62)
      for (let y = 0; y <= h; y += 1) {
        const depth = h - y
        let p
        if (depth === 0) {
          if (moat) p = h < WATER ? moatBed : bank
          else if (craggy) p = rock
          else if (steep >= 1 && N.coherent01(x, y, z, { scale: 4, seed: 4 }) < 0.12 + 0.12 * steep) p = 'coarse_dirt'
          else p = 'grass_block'
        } else if (depth < 3) p = craggy ? rock : 'dirt'
        else p = deep
        b.set(x, y, z, p)
      }
      if (moat) for (let y = h + 1; y <= WATER; y += 1) b.set(x, y, z, 'water')
      if (!moat && h === P) {
        const d0 = rectDist(x, z) + moatWobble(x, z)
        if ((d0 > MOAT_IN - 1.2 && d0 <= MOAT_IN) || (d0 >= MOAT_OUT && d0 < MOAT_OUT + 1.2)) b.set(x, h, z, N.hash01(x, 1, z, 3) < 0.6 ? bank : 'grass_block')
      }
    }

  // ------------------------------------------------------------------ palettes
  // Rubble field (most of every wall): dark/mossy at the foot, lighter and cleaner up high.
  const masonry = kit.gradient([
    kit.palette({ cobbled_deepslate: 4, tuff: 3, mossy_cobblestone: 3, cobblestone: 1 }, { seed: 1 }),
    kit.palette({ tuff: 2, mossy_stone_bricks: 3, cobblestone: 3, stone_bricks: 3, andesite: 1 }, { seed: 2 }),
    kit.palette({ stone_bricks: 6, cobblestone: 2, andesite: 2, tuff: 1 }, { seed: 3, scale: 4 }),
    kit.palette({ stone_bricks: 7, andesite: 3, stone: 1, cobblestone: 0.5 }, { seed: 3, scale: 4 }),
    kit.palette({ stone_bricks: 7, andesite: 3, stone: 1 }, { seed: 5, scale: 4 }),
    kit.palette({ stone_bricks: 7, andesite: 2, polished_andesite: 2 }, { seed: 4, scale: 4 }),
  ], { t: (x, y, z) => (y - P + 3) / 24, dither: 0.8 })
  // Dressed stone: pilasters, quoins, merlons, arches. Cleaner and a touch lighter.
  const dressed = kit.palette({ stone_bricks: 5, polished_andesite: 2 }, { seed: 6, scale: 3 })
  const TRIM = 'polished_andesite'
  const ROOF = 'deepslate_tile'
  const walkFloor = kit.palette({ stone_bricks: 4, polished_andesite: 2, cobblestone: 1, gravel: 1 }, { seed: 21 })
  const cobbleFloor = kit.palette({ cobblestone: 3, stone_bricks: 2, gravel: 1, andesite: 1 }, { seed: 30 })

  // ------------------------------------------------------------------ courtyard ground
  const yard = kit.palette([[7, 'grass_block'], [2, 'coarse_dirt'], [1, 'gravel']], { seed: 40, scale: 6, grain: 0.1 })
  for (let x = X0 + 2; x <= X2 - 2; x += 1)
    for (let z = Z0 + 2; z <= Z1 - 2; z += 1)
      if (b.nameAt(x, P, z) === 'minecraft:grass_block' && !b.has(x, P + 1, z)) b.set(x, P, z, yard)
  const track = kit.palette({ dirt_path: 3, gravel: 2, coarse_dirt: 2 }, { seed: 41 })
  b.path([[GX, Z1 - 7], [GX, 64], [58, 58], [58, 55]], { width: 4, paint: cobbleFloor, jitter: 0.4 })
  b.path([[59, 61], [66, 57], [68, 52], [66, 46], [66, 38]], { width: 3, paint: track, jitter: 0.5 })
  b.path([[55, 68], [48, 69], [43, 68], [42, 62], [41, 55]], { width: 3, paint: track, jitter: 0.5 })
  b.path([[GX + 1, 63], [63, 60], [72, 59]], { width: 2, paint: track, jitter: 0.3 })

  // ------------------------------------------------------------------ curtain walls
  function curtain(ax, az, bx, bz, out) {
    const alongX = az === bz
    const o = kit.DIR[out]
    const u0 = alongX ? Math.min(ax, bx) : Math.min(az, bz)
    const u1 = alongX ? Math.max(ax, bx) : Math.max(az, bz)
    const at = (u, c) => (alongX ? [u, az + o[2] * c] : [ax + o[0] * c, u])
    const inward = kit.opposite(out)
    for (let u = u0; u <= u1; u += 1) {
      for (let c = -1; c <= 1; c += 1) {
        const [x, z] = at(u, c)
        b.box([x, P - 3, z], [x, WALK - 1, z], masonry)
        b.set(x, WALK, z, walkFloor)
      }
      const [bx2, bz2] = at(u, 2)
      b.box([bx2, P - 3, bz2], [bx2, P + 1, bz2], masonry)
      b.set(bx2, P + 2, bz2, st(SB, inward))
      b.set(bx2, WALK - 1, bz2, st(SB, inward, 'top'))
      b.box([bx2, WALK, bz2], [bx2, WALK + 1, bz2], dressed)
      if ((u % 3) !== 0) b.set(bx2, WALK + 2, bz2, dressed)
      const k = u - u0
      if (k % 8 === 4 && k > 6 && u1 - u > 6) {
        const [px, pz] = at(u, 3)
        b.box([px, P - 3, pz], [px, P + 5, pz], dressed)
        b.set(px, P + 6, pz, st(SB, inward))
        b.box([bx2, P + 2, bz2], [bx2, P + 6, bz2], dressed)
        b.set(bx2, P + 7, bz2, st(SB, inward))
      } else if (k % 8 === 0 && k > 6 && u1 - u > 6) {
        for (const c of [0, 1]) { const [sx, sz] = at(u, c); b.box([sx, P + 4, sz], [sx, P + 6, sz], 'air') }
      }
    }
  }
  curtain(X0, Z0, X1, Z0, 'north')
  curtain(X1, Z0, X1, ZJ, 'east')
  curtain(X2, ZJ, X2, Z1, 'east')
  curtain(X0, Z1, X2, Z1, 'south')
  curtain(X0, Z0, X0, Z1, 'west')

  // ------------------------------------------------------------------ towers
  function roundCells(cx, cz, R) {
    const out = []
    const ri = Math.ceil(R) + 1
    for (let x = cx - ri; x <= cx + ri; x += 1)
      for (let z = cz - ri; z <= cz + ri; z += 1) {
        const d = Math.hypot(x - cx, z - cz)
        if (d > R) continue
        const edge = D4.some(([dx, dz]) => Math.hypot(x + dx - cx, z + dz - cz) > R)
        out.push({ x, z, d, edge, a: Math.atan2(z - cz, x - cx), facing: kit.facingFrom(cx - x, cz - z) })
      }
    return out
  }
  function raySlit(cx, cz, r, a, y0, h) {
    for (let t = r - 2.2; t <= r + 0.2; t += 0.25) {
      const x = Math.round(cx + Math.cos(a) * t)
      const z = Math.round(cz + Math.sin(a) * t)
      b.box([x, y0, z], [x, y0 + h - 1, z], 'air')
    }
  }
  const ANG = { east: 0, south: Math.PI / 2, west: Math.PI, north: -Math.PI / 2 }

  function roundTower({ cx, cz, r, walk, top = 'crenel', doors = [], slitAngles = [], banner }) {
    for (const c of roundCells(cx, cz, r)) {
      if (c.d > r - 2) b.box([c.x, P - 3, c.z], [c.x, walk - 1, c.z], masonry)
      else {
        b.box([c.x, P - 3, c.z], [c.x, P, c.z], 'spruce_planks')
        b.box([c.x, P + 1, c.z], [c.x, walk - 1, c.z], 'air')
        b.set(c.x, WALK, c.z, 'spruce_planks')
      }
      b.set(c.x, walk, c.z, c.d > r - 2 ? masonry : walkFloor)
    }
    for (const c of roundCells(cx, cz, r + 1).filter(c => c.d > r)) {
      b.box([c.x, P - 3, c.z], [c.x, P + 1, c.z], masonry)
      b.set(c.x, P + 2, c.z, st(SB, c.facing))
      if (walk - WALK >= 5) b.set(c.x, WALK - 1, c.z, st('polished_andesite', c.facing, 'top'), { keep: true })
    }
    for (const dir of doors) {
      const a = ANG[dir]
      for (let t = r - 2.4; t <= r + 1.5; t += 0.25) {
        const x = Math.round(cx + Math.cos(a) * t), z = Math.round(cz + Math.sin(a) * t)
        b.box([x, WALK + 1, z], [x, WALK + 2, z], 'air')
      }
    }
    for (const a of slitAngles) {
      raySlit(cx, cz, r, a, P + 4, 2)
      if (walk - WALK > 5) raySlit(cx, cz, r, a + 0.4, WALK + 3, 2)
    }
    // interior lantern so slits glow at night
    b.set(cx, WALK + 1, cz, 'lantern')
    const ring = roundCells(cx, cz, r + 1).filter(c => c.edge).sort((p, q) => p.a - q.a)
    if (top === 'crenel' || top === 'inner-cone') {
      ring.forEach((c, i) => {
        if (i % 2 === 0) b.set(c.x, walk - 1, c.z, st(SB, c.facing, 'top'))
        b.box([c.x, walk, c.z], [c.x, walk + 1, c.z], dressed)
        if (i % 2 === 0) b.set(c.x, walk + 2, c.z, dressed)
      })
      if (top === 'inner-cone') b.coneRoof([cx, walk + 2, cz], r - 1, { material: ROOF, pitch: 2, overhang: 0, flare: false, finial: ['spruce_fence', 'spruce_fence', banner ?? 'red_banner[rotation=4]'] })
    } else if (top === 'cone') {
      b.coneRoof([cx, walk + 1, cz], r, { material: ROOF, pitch: 2, overhang: 1, flare: true, finial: ['spruce_fence', 'spruce_fence', banner ?? 'blue_banner[rotation=4]'] })
    } else if (top === 'parapet-cone') {
      ring.forEach((c, i) => {
        if (i % 2 === 0) b.set(c.x, walk - 1, c.z, st(SB, c.facing, 'top'))
        b.box([c.x, walk, c.z], [c.x, walk + 2, c.z], dressed)
      })
      b.coneRoof([cx, walk + 3, cz], r + 1, { material: ROOF, pitch: 2, overhang: 1, flare: true, finial: ['spruce_fence', 'spruce_fence', banner ?? 'red_banner[rotation=4]'] })
    }
  }

  function squareTower({ x0, z0, x1, z1, walk, top = 'crenel', doors = [] }) {
    for (let x = x0; x <= x1; x += 1)
      for (let z = z0; z <= z1; z += 1) {
        const shell = x <= x0 + 1 || x >= x1 - 1 || z <= z0 + 1 || z >= z1 - 1
        const quoin = (x === x0 || x === x1) && (z === z0 || z === z1)
        if (shell) b.box([x, P - 3, z], [x, walk - 1, z], quoin ? dressed : masonry)
        else {
          b.box([x, P - 3, z], [x, P, z], 'spruce_planks')
          b.box([x, P + 1, z], [x, walk - 1, z], 'air')
          b.set(x, WALK, z, 'spruce_planks')
        }
        b.set(x, walk, z, shell ? masonry : walkFloor)
      }
    const per = []
    for (let x = x0 - 1; x <= x1 + 1; x += 1) per.push([x, z0 - 1, 'south'])
    for (let z = z0; z <= z1 + 1; z += 1) per.push([x1 + 1, z, 'west'])
    for (let x = x1; x >= x0 - 1; x -= 1) per.push([x, z1 + 1, 'north'])
    for (let z = z1; z >= z0; z -= 1) per.push([x0 - 1, z, 'east'])
    per.forEach(([x, z, f], i) => {
      const corner = (x === x0 - 1 || x === x1 + 1) && (z === z0 - 1 || z === z1 + 1)
      b.box([x, P - 3, z], [x, P + 1, z], masonry)
      b.set(x, P + 2, z, corner ? masonry : st(SB, f))
      b.set(x, walk - 1, z, corner ? dressed : st(SB, f, 'top'))
      b.box([x, walk, z], [x, walk + 1, z], dressed)
    })
    if (top === 'crenel') b.battlements([x0 - 1, z0 - 1], [x1 + 1, z1 + 1], walk + 2, dressed, { period: 2 })
    const mx = Math.round((x0 + x1) / 2)
    const mz = Math.round((z0 + z1) / 2)
    for (const dir of doors) {
      const d = kit.DIR[dir]
      if (d[0]) for (let x = mx; x !== mx + d[0] * ((x1 - x0) / 2 + 3); x += d[0]) b.box([x, WALK + 1, mz], [x, WALK + 2, mz], 'air')
      else for (let z = mz; z !== mz + d[2] * ((z1 - z0) / 2 + 3); z += d[2]) b.box([mx, WALK + 1, z], [mx, WALK + 2, z], 'air')
    }
    for (const [f, sx, sz] of [['north', mx, z0], ['south', mx, z1], ['west', x0, mz], ['east', x1, mz]]) {
      if (doors.includes(f)) continue
      const d = kit.DIR[f]
      for (const y0 of [P + 4, walk - 5]) b.box([sx, y0, sz], [sx - d[0], y0 + 1, sz - d[2]], 'air')
    }
    b.set(mx, WALK + 1, mz, 'lantern')
    if (top === 'pyramid') b.roof({ x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1, y: walk + 2, type: 'pyramid', material: ROOF, pitch: 2, overhang: 1 })
    if (top === 'hip') b.roof({ x0: x0 - 1, z0: z0 - 1, x1: x1 + 1, z1: z1 + 1, y: walk + 2, type: 'pyramid', material: ROOF, pitch: 1, overhang: 1 })
  }

  roundTower({ cx: X0, cz: Z0, r: 5.5, walk: P + 20, top: 'crenel', doors: ['east', 'south'], slitAngles: [-2.4, -1.6, 2.6, -3.0] })
  squareTower({ x0: 52, z0: 25, x1: 58, z1: 31, walk: P + 14, top: 'hip', doors: ['east', 'west'] })
  squareTower({ x0: 74, z0: 26, x1: 82, z1: 34, walk: P + 17, top: 'pyramid', doors: ['west', 'south'] })
  roundTower({ cx: 80, cz: ZJ, r: 5, walk: P + 15, top: 'cone', doors: ['north', 'south'], slitAngles: [0, 0.8, -0.8] })
  roundTower({ cx: X2, cz: Z1, r: 5.5, walk: P + 17, top: 'inner-cone', doors: ['north', 'west'], slitAngles: [0.3, 1.2, -0.5, 2.0] })
  roundTower({ cx: X0, cz: Z1, r: 4.5, walk: P + 13, top: 'crenel', doors: ['north', 'east'], slitAngles: [2.0, 2.8, 1.2] })
  squareTower({ x0: 27, z0: 50, x1: 33, z1: 56, walk: P + 15, top: 'crenel', doors: ['north', 'south'] })

  // ------------------------------------------------------------------ gatehouse
  const GZ = Z1 + 3
  b.box([GX - 10, P - 3, Z1 - 6], [GX + 10, P + 13, Z1 + 2], masonry)
  b.box([GX - 10, P + 14, Z1 - 6], [GX + 10, P + 14, Z1 + 2], walkFloor)
  for (let x = GX - 11; x <= GX + 11; x += 1) {
    b.set(x, P + 13, Z1 - 7, st(SB, 'south', 'top'))
    b.box([x, P + 14, Z1 - 7], [x, P + 15, Z1 - 7], dressed)
    if (x % 2 === 0) b.set(x, P + 16, Z1 - 7, dressed)
  }
  for (const x of [GX - 11, GX + 11]) for (let z = Z1 - 6; z <= Z1 + 2; z += 1) {
    b.set(x, P + 13, z, st(SB, x < GX ? 'east' : 'west', 'top'))
    b.box([x, P + 14, z], [x, P + 15, z], dressed)
    if (z % 2 === 0) b.set(x, P + 16, z, dressed)
  }
  b.roof({ x0: GX - 9, z0: Z1 - 5, x1: GX + 9, z1: Z1 + 1, y: P + 15, type: 'gable', axis: 'x', material: ROOF, pitch: 2, overhang: 0, gableOverhang: 0, gable: masonry })
  roundTower({ cx: GX - 7, cz: GZ, r: 4.5, walk: P + 16, top: 'parapet-cone', slitAngles: [1.2, 2.2, 3.0] })
  roundTower({ cx: GX + 7, cz: GZ, r: 4.5, walk: P + 16, top: 'parapet-cone', slitAngles: [1.9, 0.9, 0.1] })
  // passage (5 wide, pointed vault) through the whole gatehouse
  const SPRING = P + 5
  b.box([GX - 2, P + 1, Z1 - 6], [GX + 2, SPRING - 1, GZ + 5], 'air')
  b.box([GX - 2, P, Z1 - 7], [GX + 2, P, GZ + 5], cobbleFloor)
  b.arch([GX - 2, SPRING, Z1 - 6], [GX + 2, SPRING, Z1 - 6], masonry, { type: 'pointed', depth: 9 })
  for (const z of [Z1 + 2, Z1 - 6]) {
    b.arch([GX - 2, SPRING, z], [GX + 2, SPRING, z], TRIM, { type: 'pointed', depth: 1, fill: null })
    b.set(GX, SPRING + 4, z, 'chiseled_stone_bricks')
    for (const x of [GX - 3, GX + 3]) b.box([x, P + 1, z], [x, SPRING - 1, z], TRIM)
  }
  // open the recess between the towers in front of the arch
  b.box([GX - 2, P + 1, GZ], [GX + 2, P + 12, GZ + 5], 'air')
  // portcullis, half raised: bars fill the arch head, the bottom 3 rows are open
  for (let x = GX - 2; x <= GX + 2; x += 1) for (let y = P + 4; y <= SPRING + 4; y += 1) if (!b.has(x, y, Z1 + 1)) b.set(x, y, Z1 + 1, 'iron_bars')
  // gate leaves swung open against the passage walls
  for (const [x, f] of [[GX - 2, 'east'], [GX + 2, 'west']]) for (let z = Z1 - 3; z <= Z1 - 1; z += 1) for (let y = P + 1; y <= P + 3; y += 1) b.set(x, y, z, `dark_oak_trapdoor[facing=${f},open=true,half=bottom]`)
  // lanterns in the passage
  b.hangingLantern([GX, P + 9, Z1 - 4], 0)
  b.hangingLantern([GX, P + 9, Z1 - 1], 0)
  // bretèche (box machicolation) over the gate
  for (let x = GX - 2; x <= GX + 2; x += 1) {
    if ((x - GX) % 2 === 0) b.set(x, P + 10, Z1 + 3, st(SB, 'north', 'top'))
    b.box([x, P + 11, Z1 + 3], [x, P + 13, Z1 + 3], dressed)
    if ((x - GX) % 2 === 0) b.set(x, P + 14, Z1 + 3, dressed)
  }
  b.set(GX, P + 12, Z1 + 3, 'air')
  for (const x of [GX - 1, GX + 1]) b.set(x, P + 10, Z1 + 3, 'lantern[hanging=true]')
  // banners each side of the arch, torches on the towers
  for (const x of [GX - 7, GX + 7]) b.set(x, P + 11, GZ + 5, 'red_wall_banner[facing=south]')
  b.set(GX - 3, P + 4, Z1 + 3, 'wall_torch[facing=south]')
  b.set(GX + 3, P + 4, Z1 + 3, 'wall_torch[facing=south]')

  // drawbridge + chains
  const BZ0 = Z1 + 3, BZ1 = Z1 + 17
  for (let z = BZ0; z <= BZ1; z += 1)
    for (let x = GX - 2; x <= GX + 2; x += 1) {
      const edge = x === GX - 2 || x === GX + 2
      b.set(x, P, z, edge ? 'stripped_dark_oak_log[axis=z]' : (z % 4 === 0 ? 'dark_oak_planks' : 'spruce_planks'))
      if (inMoat(x, z) && edge && z % 3 === 0) b.box([x, height(x, z) + 1, z], [x, P - 1, z], 'stripped_dark_oak_log')
    }
  for (const x of [GX - 2, GX + 2]) {
    let y = P + 10, z = Z1 + 3
    const zEnd = Z1 + 13
    b.set(x, y, z, 'chain[axis=z]')
    while (z < zEnd) {
      // staircase line ~ slope 9/10
      z += 1
      b.set(x, y, z, 'chain[axis=z]')
      if (y > P + 1) { y -= 1; b.set(x, y, z, 'chain[axis=y]') }
    }
  }
  for (const x of [GX - 3, GX + 3]) {
    b.box([x, P - 2, BZ1 - 1], [x, P + 1, BZ1 + 1], dressed)
    b.set(x, P + 2, BZ1, 'stone_brick_wall')
    b.set(x, P + 3, BZ1, 'lantern')
  }

  // ------------------------------------------------------------------ keep
  const K = { x0: 40, z0: 36, x1: 56, z1: 52, top: P + 29 }
  const FLOORS = [P, P + 8, P + 15, P + 22]
  for (let x = K.x0; x <= K.x1; x += 1)
    for (let z = K.z0; z <= K.z1; z += 1) {
      const shell = x <= K.x0 + 1 || x >= K.x1 - 1 || z <= K.z0 + 1 || z >= K.z1 - 1
      if (shell) b.box([x, P - 3, z], [x, K.top, z], masonry)
      else {
        b.box([x, P - 3, z], [x, P + 31, z], 'air')
        for (const f of FLOORS) b.set(x, f, z, f === P ? cobbleFloor : 'dark_oak_planks')
      }
    }
  const keepFaces = [
    { f: 'north', fixed: K.z0, axis: 'x', u0: K.x0, u1: K.x1 },
    { f: 'south', fixed: K.z1, axis: 'x', u0: K.x0, u1: K.x1 },
    { f: 'west', fixed: K.x0, axis: 'z', u0: K.z0, u1: K.z1 },
    { f: 'east', fixed: K.x1, axis: 'z', u0: K.z0, u1: K.z1 },
  ]
  for (const face of keepFaces) {
    const d = kit.DIR[face.f]
    const inward = kit.opposite(face.f)
    const cell = (u, off) => (face.axis === 'x' ? [u, face.fixed + d[2] * off] : [face.fixed + d[0] * off, u])
    const mid = (face.u0 + face.u1) / 2
    for (let u = face.u0; u <= face.u1; u += 1) {
      const k = u - face.u0
      const pil = k <= 2 || k >= face.u1 - face.u0 - 2 || Math.abs(u - mid) <= 1
      const [x1, z1] = cell(u, 1)
      const [x2, z2] = cell(u, 2)
      if (pil) b.box([x1, P - 3, z1], [x1, K.top - 1, z1], dressed)
      b.box([x1, P - 3, z1], [x1, P + 2, z1], masonry)
      if (!pil) b.set(x1, P + 3, z1, st(SB, inward))
      b.box([x2, P - 3, z2], [x2, P + 1, z2], masonry)
      b.set(x2, P + 2, z2, st(SB, inward))
      for (const y of [P + 8, P + 15, P + 22]) if (!pil) b.set(x1, y, z1, st('polished_andesite', inward, 'top'))
      if (!pil && u % 2 === 0) b.set(x1, K.top - 1, z1, st(SB, inward, 'top'))
    }
    for (let u = face.u0 - 1; u <= face.u1 + 1; u += 1) {
      const [x1, z1] = cell(u, 1)
      b.box([x1, K.top, z1], [x1, K.top + 1, z1], dressed)
    }
    for (const wu of [face.u0 + 4, face.u1 - 5]) {
      const rd = kit.DIR[kit.ccw(face.f)]
      const leftU = face.axis === 'x' ? (rd[0] > 0 ? wu : wu + 1) : (rd[2] > 0 ? wu : wu + 1)
      const [px, pz] = cell(leftU, 0)
      const sill = st(SB, inward, 'top')
      b.window([px, P + 3, pz], face.f, { width: 1, height: 3, glass: 'air', sill: false, recess: 1 })
      b.window([px, P + 10, pz], face.f, { width: 2, height: 4, glass: 'glass_pane', recess: 1, arch: true, material: 'stone_brick', sill })
      b.window([px, P + 17, pz], face.f, { width: 2, height: 3, glass: 'glass_pane', recess: 1, arch: true, material: 'stone_brick', sill })
      b.window([px, P + 24, pz], face.f, { width: 1, height: 2, glass: 'air', sill: false, recess: 1 })
      // a lantern just inside each hall/solar window so the keep glows at night
      const [lx, lz] = cell(leftU, -2)
      b.set(lx, P + 9, lz, 'lantern')
      b.set(lx, P + 16, lz, 'lantern')
    }
    // banner on the central pilaster under the parapet
    const [bx3, bz3] = cell(Math.round(mid), 2)
    b.set(bx3, K.top - 3, bz3, `red_wall_banner[facing=${face.f}]`)
  }
  b.battlements([K.x0 - 1, K.z0 - 1], [K.x1 + 1, K.z1 + 1], K.top + 2, dressed, { period: 2 })
  for (let x = K.x0; x <= K.x1; x += 1) for (let z = K.z0; z <= K.z1; z += 1) b.set(x, K.top, z, walkFloor)
  const keepRoof = b.roof({ x0: K.x0 + 1, z0: K.z0 + 1, x1: K.x1 - 1, z1: K.z1 - 1, y: K.top + 1, type: 'pyramid', material: ROOF, pitch: 2, overhang: 0 })
  const kmx = (K.x0 + K.x1) / 2, kmz = (K.z0 + K.z1) / 2
  // Flag: a tall pole with a wool pennant reads from across the map; a banner alone is too small.
  for (let i = 1; i <= 6; i += 1) b.set(kmx, keepRoof.topY + i, kmz, 'spruce_fence')
  b.set(kmx, keepRoof.topY + 7, kmz, 'lightning_rod')
  b.box([kmx + 1, keepRoof.topY + 5, kmz], [kmx + 2, keepRoof.topY + 6, kmz], 'red_wool')
  b.set(kmx + 3, keepRoof.topY + 6, kmz, 'red_wool')
  b.set(kmx + 1, keepRoof.topY + 5, kmz, 'yellow_wool')
  for (const [cx, cz] of [[K.x0 - 1, K.z0 - 1], [K.x0 - 1, K.z1 + 1], [K.x1 + 1, K.z1 + 1]]) {
    b.disc([cx, K.top - 3, cz], 1, dressed)
    for (const c of roundCells(cx, cz, 1.6)) b.set(c.x, K.top - 2, c.z, c.edge ? st(SB, c.facing, 'top') : dressed)
    for (const c of roundCells(cx, cz, 2.5)) {
      b.set(c.x, K.top - 1, c.z, c.edge ? st(SB, c.facing, 'top') : dressed)
      if (c.edge) b.box([c.x, K.top, c.z], [c.x, K.top + 2, c.z], dressed)
      else b.set(c.x, K.top, c.z, walkFloor)
    }
    roundCells(cx, cz, 2.5).filter(c => c.edge).sort((p, q) => p.a - q.a).forEach((c, i) => { if (i % 2 === 0) b.set(c.x, K.top + 3, c.z, dressed) })
  }
  {
    const cx = K.x1, cz = K.z0
    const tTop = K.top + 6
    for (const c of roundCells(cx, cz, 2.5)) {
      if (c.edge) b.box([c.x, P - 3, c.z], [c.x, tTop, c.z], masonry)
      else b.box([c.x, P + 1, c.z], [c.x, tTop, c.z], 'air')
    }
    b.spiralStairs([cx, 0, cz], 0, 1.6, P + 1, tTop - 1, SB, { core: 'stone_bricks', stepsPerTurn: 8 })
    for (const f of FLOORS) b.box([K.x1 - 2, f + 1, K.z0 + 1], [K.x1 - 2, f + 2, K.z0 + 1], 'air')
    for (const c of roundCells(cx, cz, 3.5).filter(c => c.edge)) b.set(c.x, tTop, c.z, c.d > 2.5 ? st(SB, c.facing, 'top') : dressed)
    raySlit(cx, cz, 2.5, -0.8, P + 6, 2)
    raySlit(cx, cz, 2.5, -0.8, P + 13, 2)
    raySlit(cx, cz, 2.5, -0.8, P + 20, 2)
    raySlit(cx, cz, 2.5, 0.4, P + 27, 2)
    b.coneRoof([cx, tTop + 1, cz], 3.5, { material: ROOF, pitch: 2, overhang: 0, flare: true, finial: ['spruce_fence', 'spruce_fence', 'blue_banner[rotation=4]'] })
  }
  // forebuilding stair to the first-floor door (south face, rising west)
  {
    const z0 = K.z1 + 2, z1 = K.z1 + 4
    for (let i = 0; i <= 8; i += 1) {
      const x = K.x1 - 1 - i
      for (let z = z0; z <= z1; z += 1) {
        b.box([x, P - 2, z], [x, P + i, z], masonry)
        b.set(x, P + 1 + i, z, st(SB, 'west'))
      }
      b.set(x, P + 2 + i, z1 + 1, 'stone_brick_wall')
      b.box([x, P - 2, z1 + 1], [x, P + 1 + i, z1 + 1], masonry)
    }
    b.box([K.x1 - 14, P - 2, z0], [K.x1 - 10, P + 8, z1 + 1], masonry)
    b.box([K.x1 - 14, P + 8, z0], [K.x1 - 10, P + 8, z1], walkFloor)
    for (let x = K.x1 - 14; x <= K.x1 - 10; x += 1) b.set(x, P + 9, z1 + 1, 'stone_brick_wall')
    b.set(K.x1 - 14, P + 9, z0, 'stone_brick_wall')
    b.set(K.x1 - 14, P + 10, z1 + 1, 'lantern')
    b.door([K.x1 - 12, P + 9, K.z1], 'south', { material: 'dark_oak', width: 2 })
    b.box([K.x1 - 12, P + 9, K.z1 - 1], [K.x1 - 11, P + 10, K.z1 - 1], 'air')
    b.box([K.x1 - 12, P + 9, K.z1 + 1], [K.x1 - 11, P + 11, K.z1 + 1], 'air')
    b.arch([K.x1 - 12, P + 11, K.z1 + 1], [K.x1 - 11, P + 11, K.z1 + 1], TRIM, { type: 'round', depth: 1 })
  }

  // ------------------------------------------------------------------ wall stairs
  function wallStair(xs, z, dirUp, xOrZ = 'x') {
    // xs: list of positions from bottom to top along the axis
    xs.forEach((u, i) => {
      const [x, zz] = xOrZ === 'x' ? [u, z] : [z, u]
      b.box([x, P + 1, zz], [x, P + i, zz], masonry)
      b.set(x, P + 1 + i, zz, st(SB, dirUp))
    })
  }
  wallStair([66, 67, 68, 69, 70, 71, 72, 73, 74, 75], Z1 - 2, 'east')
  wallStair([62, 63, 64, 65, 66, 67, 68, 69, 70, 71], Z0 + 2, 'east')
  wallStair([46, 45, 44, 43, 42, 41, 40, 39, 38, 37], X0 + 2, 'north', 'z')

  // ------------------------------------------------------------------ well
  {
    const wx = 64, wz = 59
    for (let x = wx - 2; x <= wx + 2; x += 1) for (let z = wz - 2; z <= wz + 2; z += 1) {
      const edge = Math.abs(x - wx) === 2 || Math.abs(z - wz) === 2
      if (edge) { b.box([x, P - 4, z], [x, P, z], 'cobblestone'); b.set(x, P + 1, z, (Math.abs(x - wx) === 2 && Math.abs(z - wz) === 2) ? 'stone_bricks' : 'cobblestone_wall') }
      else { b.box([x, P - 4, z], [x, P - 4, z], 'cobblestone'); b.box([x, P - 3, z], [x, P - 1, z], 'water'); b.set(x, P, z, 'air') }
    }
    for (const [x, z] of [[wx - 2, wz - 2], [wx + 2, wz - 2], [wx - 2, wz + 2], [wx + 2, wz + 2]]) b.box([x, P + 2, z], [x, P + 3, z], 'spruce_fence')
    b.roof({ x0: wx - 2, z0: wz - 2, x1: wx + 2, z1: wz + 2, y: P + 4, type: 'gable', axis: 'x', material: 'spruce', pitch: 1, overhang: 0, gableOverhang: 0 })
    b.set(wx, P + 4, wz, 'spruce_planks')
    b.box([wx, P + 1, wz], [wx, P + 3, wz], 'chain[axis=y]')
  }

  // ------------------------------------------------------------------ stables (lean-to on the east wall)
  {
    const x0 = 68, x1 = 76, z0 = 37, z1 = 47
    b.box([x0, P, z0], [x1, P, z1], kit.palette({ coarse_dirt: 2, dirt: 1, hay_block: 1 }, { seed: 50 }))
    for (let z = z0; z <= z1; z += 1) {
      const post = (z - z0) % 3 === 0 || z === z1
      if (post) { b.box([x0, P + 1, z], [x0, P + 4, z], 'stripped_spruce_log'); b.box([x0 + 1, P + 1, z], [x1, P + 2, z], 'spruce_fence') ; b.set(x0 + 1, P + 1, z, 'spruce_fence') }
    }
    // gates on each stall
    for (let z = z0 + 1; z < z1; z += 1) if ((z - z0) % 3 !== 0) b.set(x0, P + 1, z, kit.gate('spruce', 'west'))
    b.timberWall([x0, P + 1, z0], [x1, P + 5, z0], { frame: 'stripped_spruce_log', infill: 'white_terracotta', postEvery: 4, braces: true })
    b.timberWall([x0, P + 1, z1], [x1, P + 5, z1], { frame: 'stripped_spruce_log', infill: 'white_terracotta', postEvery: 4, braces: true })
    b.box([x0, P + 5, z0], [x0, P + 5, z1], 'stripped_spruce_log[axis=z]')
    b.roof({ x0, z0, x1, z1: z1, y: P + 6, type: 'shed', axis: 'z', rises: 'east', material: 'spruce', pitch: 0.5, overhang: 1, gableOverhang: 1, eaveTrim: true, gable: 'white_terracotta' })
    // the high eave tucks into the curtain wall: give the wall walk its floor back
    b.box([x1 + 1, WALK, z0 - 1], [x1 + 1, WALK, z1 + 1], walkFloor)
    b.box([x1 + 1, WALK + 1, z0 - 1], [x1 + 1, WALK + 2, z1 + 1], 'air', { only: '*_stairs' })
    b.box([x1 + 1, WALK + 1, z0 - 1], [x1 + 1, WALK + 2, z1 + 1], 'air', { only: '*_slab' })
    for (let z = z0 + 1; z < z1; z += 3) { b.set(x1, P + 1, z + 1, 'hay_block'); b.set(x1, P + 2, z + 1, 'hay_block'); b.set(x1 - 1, P + 1, z + 1, 'water_cauldron[level=3]') }
    b.set(x0 - 1, P + 4, z0 + 4, 'lantern[hanging=false]')
  }

  // ------------------------------------------------------------------ smithy (lean-to on the west wall)
  {
    const x0 = 34, x1 = 41, z0 = 59, z1 = 68
    b.box([x0, P, z0], [x1, P, z1], cobbleFloor)
    for (let z = z0; z <= z1; z += 3) b.box([x1, P + 1, z], [x1, P + 4, z], 'stripped_dark_oak_log')
    b.box([x1, P + 1, z1], [x1, P + 4, z1], 'stripped_dark_oak_log')
    b.box([x1, P + 5, z0], [x1, P + 5, z1], 'stripped_dark_oak_log[axis=z]')
    b.timberWall([x0, P + 1, z0], [x1, P + 5, z0], { frame: 'stripped_dark_oak_log', infill: 'mud_bricks', postEvery: 4, braces: true })
    b.timberWall([x0, P + 1, z1], [x1, P + 5, z1], { frame: 'stripped_dark_oak_log', infill: 'mud_bricks', postEvery: 4, braces: true })
    b.roof({ x0, z0, x1, z1, y: P + 6, type: 'shed', axis: 'z', rises: 'west', material: 'dark_oak', pitch: 0.5, overhang: 1, gableOverhang: 1, eaveTrim: true, gable: 'mud_bricks' })
    b.box([x0 - 1, WALK, z0 - 1], [x0 - 1, WALK, z1 + 1], walkFloor)
    b.box([x0 - 1, WALK + 1, z0 - 1], [x0 - 1, WALK + 2, z1 + 1], 'air', { only: '*_stairs' })
    b.box([x0 - 1, WALK + 1, z0 - 1], [x0 - 1, WALK + 2, z1 + 1], 'air', { only: '*_slab' })
    // forge: brick hearth with lava cauldron and a chimney through the roof
    b.box([x0, P + 1, z0 + 2], [x0 + 1, P + 2, z0 + 4], 'bricks')
    b.set(x0 + 1, P + 2, z0 + 3, 'lava_cauldron')
    b.set(x0 + 1, P + 1, z0 + 3, 'bricks')
    b.chimney([x0, P + 3, z0 + 3], 7, { paint: 'bricks', cap: 'mud_brick_wall' })
    b.set(x0 + 2, P + 1, z0 + 6, 'anvil[facing=north]')
    b.set(x0 + 1, P + 1, z0 + 6, 'blast_furnace[facing=east,lit=true]')
    b.set(x0 + 3, P + 1, z0 + 8, 'grindstone[face=floor,facing=north]')
    b.set(x0, P + 1, z0 + 7, 'smithing_table')
    b.set(x0, P + 1, z0 + 8, 'barrel[facing=up]')
    b.set(x0 + 2, P + 1, z0 + 2, 'water_cauldron[level=2]')
    b.set(x1 + 1, P + 1, z0 + 5, 'barrel[facing=up]')
    b.set(x1 + 1, P + 1, z0 + 6, 'barrel[facing=up]')
    b.set(x1 + 1, P + 2, z0 + 6, 'barrel[facing=up]')
    b.set(x1, P + 4, z0 + 7, 'lantern[hanging=true]')
  }

  // ------------------------------------------------------------------ barracks (stone ground floor, jettied timber upper floor)
  {
    const x0 = 65, x1 = 79, z0 = 61, z1 = 69
    for (let x = x0; x <= x1; x += 1)
      for (let z = z0; z <= z1; z += 1) {
        const wall = x === x0 || x === x1 || z === z0 || z === z1
        const corner = (x === x0 || x === x1) && (z === z0 || z === z1)
        b.box([x, P - 2, z], [x, P + 4, z], wall ? (corner ? dressed : masonry) : null)
        if (!wall) { b.set(x, P, z, cobbleFloor); b.box([x, P + 1, z], [x, P + 3, z], 'air'); b.set(x, P + 4, z, 'spruce_planks') }
      }
    // jetty: the upper floor oversails the courtyard side by one block on carved brackets
    for (let x = x0; x <= x1; x += 1) b.set(x, P + 4, z0 - 1, st('dark_oak', 'south', 'top'))
    const frame = 'stripped_dark_oak_log'
    b.timberWall([x0, P + 5, z0 - 1], [x1, P + 8, z0 - 1], { frame, infill: 'white_terracotta', postEvery: 3, braces: true })
    b.timberWall([x0, P + 5, z1], [x1, P + 8, z1], { frame, infill: 'white_terracotta', postEvery: 3 })
    b.timberWall([x0, P + 5, z0 - 1], [x0, P + 8, z1], { frame, infill: 'white_terracotta', postEvery: 3 })
    b.timberWall([x1, P + 5, z0 - 1], [x1, P + 8, z1], { frame, infill: 'white_terracotta', postEvery: 3 })
    for (let x = x0 + 1; x < x1; x += 1) for (let z = z0; z < z1; z += 1) b.set(x, P + 5, z, 'air')
    b.roof({ x0, z0: z0 - 1, x1, z1, y: P + 9, type: 'gable', axis: 'x', material: ROOF, pitch: 1, overhang: 1, gableOverhang: 1, eaveTrim: true, gable: 'white_terracotta' })
    for (const x of [x0, x1]) { b.box([x, P + 9, z0 + 4], [x, P + 12, z0 + 4], frame); b.box([x, P + 9, z0], [x, P + 9, z1 - 1], `${frame}[axis=z]`) }
    // openings: arched door + small windows below, shuttered windows above
    b.door([72, P + 1, z0], 'north', { material: 'dark_oak', width: 1 })
    b.set(72, P + 3, z0, 'chiseled_stone_bricks')
    b.set(72, P + 3, z0 - 1, 'lantern[hanging=true]')
    for (const x of [67, 69, 75, 77]) b.window([x, P + 2, z0], 'north', { width: 1, height: 1, glass: 'glass_pane', sill: false, recess: 0 })
    for (const x of [69, 72, 75]) b.window([x, P + 6, z0 - 1], 'north', { width: 2, height: 2, glass: 'glass_pane', sill: true, material: 'dark_oak' })
    b.chimney([x1 - 2, P + 5, z1 - 1], 9, { paint: 'bricks', cap: 'stone_brick_wall' })
    // a few bunks inside
    for (let x = x0 + 2; x <= x1 - 2; x += 3) { b.set(x, P + 1, z1 - 2, 'red_bed[facing=south,part=foot]'); b.set(x, P + 1, z1 - 1, 'red_bed[facing=south,part=head]') }
    b.set(x0 + 1, P + 3, z0 + 4, 'wall_torch[facing=east]')
  }

  // ------------------------------------------------------------------ kitchen garden
  {
    const x0 = 43, x1 = 52, z0 = 59, z1 = 66
    for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1
      if (edge) { b.set(x, P, z, 'coarse_dirt'); b.set(x, P + 1, z, x === x1 && z === z0 + 3 ? kit.gate('spruce', 'east') : 'spruce_fence') }
      else if (z === z0 + 3) b.set(x, P, z, 'water')
      else {
        b.set(x, P, z, 'farmland[moisture=7]')
        const crop = [null, 'wheat[age=7]', 'wheat[age=5]', null, 'carrots[age=7]', 'potatoes[age=6]', 'beetroots[age=3]'][z - z0]
        if (crop) b.set(x, P + 1, z, crop)
      }
    }
    b.set(x1 - 1, P + 1, z0 + 1, 'spruce_fence'); b.set(x1 - 1, P + 2, z0 + 1, 'hay_block'); b.set(x1 - 1, P + 3, z0 + 1, 'carved_pumpkin[facing=east]')
    b.set(x1 + 1, P + 1, z0, 'composter[level=6]')
    b.set(x1 + 1, P + 1, z0 + 1, 'composter[level=3]')
  }

  // ------------------------------------------------------------------ market stall by the gate
  {
    const x0 = 61, x1 = 63, z0 = 64, z1 = 66
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box([x, P + 1, z], [x, P + 3, z], 'spruce_fence')
    for (let x = x0; x <= x1; x += 1) for (let z = z0 - 1; z <= z1 + 1; z += 1) b.set(x, P + 4, z, x % 2 === 0 ? 'red_wool' : 'white_wool')
    for (let z = z0; z <= z1; z += 1) b.set(x0, P + 1, z, z === z0 + 1 ? 'barrel[facing=west]' : 'spruce_slab[type=top]')
    b.set(x0, P + 2, z0, 'pumpkin'); b.set(x0, P + 2, z1, 'melon'); b.set(x0, P + 2, z0 + 1, 'hay_block[axis=x]')
  }

  // ------------------------------------------------------------------ courtyard props & lights
  for (const [x, z] of [[GX + 3, 64], [60, 50], [47, 60], [70, 56]]) b.lampPost([x, P + 1, z], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall' })
  for (const [x, z] of [[GX - 4, 68], [GX - 4, 67], [GX - 5, 68]]) b.set(x, P + 1, z, 'barrel[facing=up]')
  b.set(GX + 4, P + 1, 68, 'hay_block'); b.set(GX + 5, P + 1, 68, 'hay_block'); b.set(GX + 4, P + 2, 68, 'hay_block')
  // archery targets by the west wall
  for (const z of [42, 46]) { b.set(36, P + 1, z, 'hay_block'); b.set(36, P + 2, z, 'target') }
  // inner-face wall torches
  for (let x = X0 + 6; x <= X2 - 6; x += 8) {
    if (!b.has(x, P + 5, Z0 + 2)) b.set(x, P + 5, Z0 + 2, 'wall_torch[facing=south]')
    if (!b.has(x, P + 5, Z1 - 2) && Math.abs(x - GX) > 11) b.set(x, P + 5, Z1 - 2, 'wall_torch[facing=north]')
  }

  // ------------------------------------------------------------------ keep interior
  {
    const ix0 = K.x0 + 2, ix1 = K.x1 - 2, iz0 = K.z0 + 2, iz1 = K.z1 - 2
    // ground floor: stores
    for (let x = ix0; x <= ix0 + 3; x += 1) for (let z = iz0; z <= iz0 + 1; z += 1) b.set(x, P + 1, z, 'barrel[facing=up]')
    for (let z = iz0 + 4; z <= iz1; z += 2) b.set(ix0, P + 1, z, 'chest[facing=east]')
    b.box([ix1 - 2, P + 1, iz1 - 1], [ix1, P + 2, iz1], 'hay_block')
    b.hangingLantern([K.x0 + 8, P + 7, K.z0 + 8], 1)
    // great hall
    const hy = P + 9
    b.box([ix0 + 3, hy - 1, iz0 + 6], [ix1 - 3, hy - 1, iz0 + 6], 'red_carpet', { })
    for (let x = ix0 + 2; x <= ix1 - 2; x += 1) {
      b.set(x, hy - 1 + 1, iz0 + 6, null)
    }
    for (let x = ix0 + 3; x <= ix1 - 3; x += 1) {
      b.set(x, hy, iz0 + 5, 'dark_oak_slab[type=top]')
      b.set(x, hy, iz0 + 7, 'dark_oak_slab[type=top]')
      if (x % 2 === 0) { b.set(x, hy, iz0 + 4, st('spruce', 'north')); b.set(x, hy, iz0 + 8, st('spruce', 'south')) }
      if (x % 3 === 0) { b.set(x, hy + 1, iz0 + 5, 'candle[candles=3,lit=true]'); b.set(x, hy + 1, iz0 + 7, 'candle[candles=2,lit=true]') }
    }
    // hearth on the north wall
    b.box([ix0 + 4, hy, iz0], [ix0 + 8, hy + 3, iz0], 'bricks')
    b.box([ix0 + 5, hy, iz0], [ix0 + 7, hy + 1, iz0], 'air')
    b.set(ix0 + 6, hy, iz0, 'campfire[lit=true,signal_fire=false,facing=south]')
    b.box([ix0 + 4, hy + 2, iz0 + 1], [ix0 + 8, hy + 2, iz0 + 1], st('polished_andesite', 'north', 'top'))
    // throne at the west end
    b.set(ix0, hy, iz0 + 6, st('dark_oak', 'west'))
    b.set(ix0 + 1, hy - 1 + 1, iz0 + 6, 'red_carpet')
    for (const z of [iz0 + 3, iz0 + 9]) b.set(ix0, hy + 3, z, 'red_wall_banner[facing=east]')
    for (const x of [ix0 + 4, ix1 - 4]) b.hangingLantern([x, P + 14, iz0 + 6], 2)
    b.box([ix0, hy, iz1], [ix1, hy, iz1], 'bookshelf')
    // solar (second floor)
    const sy = P + 16
    b.set(ix0 + 1, sy, iz0 + 1, 'red_bed[facing=south,part=head]')
    b.set(ix0 + 1, sy, iz0 + 2, 'red_bed[facing=south,part=foot]')
    b.set(ix0 + 2, sy, iz0 + 1, 'red_bed[facing=south,part=head]')
    b.set(ix0 + 2, sy, iz0 + 2, 'red_bed[facing=south,part=foot]')
    b.box([ix0, sy - 1 + 1, iz0 + 4], [ix0 + 4, sy - 1 + 1, iz0 + 8], 'blue_carpet')
    b.box([ix1, sy, iz0 + 2], [ix1, sy + 2, iz0 + 6], 'bookshelf')
    b.set(ix1 - 1, sy, iz0 + 8, 'lectern[facing=west]')
    b.set(ix0, sy, iz1, 'chest[facing=north]')
    b.hangingLantern([K.x0 + 8, P + 21, K.z0 + 8], 1)
    // guard room (third floor)
    const gy = P + 23
    for (let x = ix0; x <= ix0 + 3; x += 1) b.set(x, gy, iz1, 'barrel[facing=up]')
    b.set(ix1, gy, iz1, 'smithing_table'); b.set(ix1 - 1, gy, iz1, 'grindstone[face=floor,facing=north]')
    b.hangingLantern([K.x0 + 8, P + 28, K.z0 + 8], 1)
  }

  // ------------------------------------------------------------------ ground-floor tower doors
  // Mid-wall towers open onto the courtyard (the walk-level doors are cut in the tower code).
  for (const [x, z, f] of [[33, 53, 'east'], [55, 31, 'south'], [75, 53, 'west']]) {
    const d = kit.DIR[f]
    for (let k = -1; k <= 1; k += 1) b.box([x + d[0] * k, P + 1, z + d[2] * k], [x + d[0] * k, P + 2, z + d[2] * k], 'air')
    b.set(x - d[0], P, z - d[2], 'spruce_planks')
    b.door([x, P + 1, z], f, { material: 'spruce' })
    b.set(x, P + 3, z, 'chiseled_stone_bricks')
    b.set(x + d[0], P + 3, z + d[2], `wall_torch[facing=${f}]`)
  }

  // ------------------------------------------------------------------ garderobe (latrine) on the north wall
  // A tiny box corbelled out of the wall with a chute: the kind of story detail that rewards a close look.
  {
    const gx0 = 43, gx1 = 45
    for (let x = gx0; x <= gx1; x += 1) {
      if (x !== 44) b.set(x, P + 4, Z0 - 2, st(SB, 'south', 'top'))
      b.box([x, P + 5, Z0 - 3], [x, P + 7, Z0 - 2], dressed)
      b.set(x, P + 8, Z0 - 3, st(SB, 'north'))
      b.set(x, P + 8, Z0 - 2, dressed)
    }
    b.box([gx0, P + 5, Z0 - 3], [gx0, P + 5, Z0 - 2], st(SB, 'east', 'top'))
    b.box([gx1, P + 5, Z0 - 3], [gx1, P + 5, Z0 - 2], st(SB, 'west', 'top'))
    b.set(44, P + 6, Z0 - 3, 'air')
    // stain below the chute
    for (let y = P - 1; y <= P + 3; y += 1) if (b.has(44, y, Z0 - 2)) b.set(44, y, Z0 - 2, y < P + 2 ? 'mossy_cobblestone' : 'mossy_stone_bricks')
    b.set(44, P, Z0 - 3, 'coarse_dirt')
  }

  // ------------------------------------------------------------------ woodpile and stores against the south wall
  for (let x = 40; x <= 45; x += 1) {
    b.box([x, P + 1, Z1 - 2], [x, P + 2, Z1 - 2], (x + 1) % 3 === 0 ? 'stripped_oak_log[axis=x]' : 'oak_log[axis=x]')
    b.set(x, P + 3, Z1 - 2, 'spruce_slab[type=bottom]')
  }
  for (const [x, z] of [[68, 49], [69, 49], [68, 50]]) b.set(x, P + 1, z, 'hay_block')
  b.set(68, P + 2, 49, 'hay_block[axis=x]')
  for (const z of [36, 37]) b.set(67, P + 1, z, 'barrel[facing=up]')

  // ------------------------------------------------------------------ night lighting
  // Braziers (lit campfires) on the open tower tops: smoke by day, a beacon by night.
  for (const [x, y, z] of [[X0, P + 21, Z0], [X0, P + 14, Z1], [30, P + 16, 53], [55, P + 15, 28]]) {
    b.set(x, y, z, 'campfire[lit=true,signal_fire=false,facing=north]')
  }
  // Lanterns on short posts along the inner edge of the wall walks, every 8 blocks.
  const walkLights = [
    ...[40, 48, 64, 70].map(x => [x, Z0 + 1]),
    ...[40, 48, 66, 74].map(x => [x, Z1 - 1]),
    ...[38, 46, 62, 68].map(z => [X0 + 1, z]),
    ...[40, 46].map(z => [X1 - 1, z]),
    ...[62, 68].map(z => [X2 - 1, z]),
  ]
  for (const [x, z] of walkLights) { b.set(x, WALK + 1, z, 'stone_brick_wall'); b.set(x, WALK + 2, z, 'lantern') }
  // Torches on the outer faces flanking the drawbridge and on the corner towers.
  for (const [x, y, z, f] of [[GX - 7, P + 6, GZ + 5, 'south'], [GX + 7, P + 6, GZ + 5, 'south'], [X0 - 6, P + 6, Z1, 'west'], [X2 + 6, P + 6, Z1, 'east'], [X0 - 6, P + 6, Z0, 'west']]) {
    if (!b.has(x, y, z)) b.set(x, y, z, `wall_torch[facing=${f}]`)
  }

  // ------------------------------------------------------------------ landscaping
  // moat life
  for (let x = 0; x < SIZE[0]; x += 1) for (let z = 0; z < SIZE[2]; z += 1) {
    if (!inMoat(x, z) || b.nameAt(x, WATER, z) !== 'minecraft:water') continue
    if (N.coherent01(x, 0, z, { scale: 4, seed: 61 }) < 0.12 && N.hash01(x, 0, z, 62) < 0.5) b.set(x, WATER + 1, z, 'lily_pad')
    const bed = height(x, z)
    if (bed < WATER - 1 && N.hash01(x, 1, z, 63) < 0.18) b.set(x, bed + 1, z, 'seagrass')
  }
  // approach road winding down the southern spur
  b.path([[GX, BZ1 + 1], [GX + 2, 97], [GX + 7, 102], [GX + 4, 108], [GX - 4, 112], [GX - 9, 116]], { width: 3, paint: kit.palette({ dirt_path: 4, coarse_dirt: 2, gravel: 2 }, { seed: 70 }), jitter: 0.6 })
  // trees and bushes on the lower slopes (kept clear of the walls: a real castle cleared its field of fire)
  const rng = kit.rng(77)
  // Groves, not a uniform sprinkle: trees cluster around a few seed points on the lower
  // slopes (NW, NE and SW flanks) and leave the southern approach and the walls open.
  const groves = [[14, 40, 'spruce'], [20, 18, 'spruce'], [96, 22, 'oak'], [100, 60, 'oak'], [24, 96, 'oak'], [92, 98, 'birch'], [12, 70, 'oak']]
  const treeSpots = []
  for (const [gx, gz, kind] of groves) {
    let placed = 0
    for (let i = 0; i < 40 && placed < 4; i += 1) {
      const x = Math.round(gx + rng.gauss(0, 5)), z = Math.round(gz + rng.gauss(0, 5))
      if (x < 8 || z < 8 || x > SIZE[0] - 9 || z > SIZE[2] - 9) continue
      if (!onDiorama(x, z) || rectDist(x, z) < 22) continue
      if (Math.abs(x - GX) < 14 && z > Z1 + 14) continue
      if (b.nameAt(x, height(x, z), z) !== 'minecraft:grass_block') continue
      if (treeSpots.some(([a, c]) => Math.hypot(a - x, c - z) < 5)) continue
      treeSpots.push([x, z, kind])
      placed += 1
    }
  }
  treeSpots.forEach(([x, z, kind], i) => {
    const y = height(x, z) + 1
    const pick = kind === 'oak' && i % 4 === 0 ? 'birch' : kind
    b.tree([x, y, z], pick, pick === 'spruce' ? { seed: i, height: rng.int(9, 12), radius: 3.4 } : { seed: i, height: rng.int(6, 8), blob: [2.2, 2.9] })
  })
  for (let i = 0; i < 30; i += 1) {
    const x = rng.int(4, SIZE[0] - 5), z = rng.int(4, SIZE[2] - 5)
    if (!onDiorama(x, z) || rectDist(x, z) < 17) continue
    const y = height(x, z)
    if (b.nameAt(x, y, z) !== 'minecraft:grass_block' || b.has(x, y + 1, z)) continue
    b.bush([x, y + 1, z], { radius: 1.4 + rng() * 0.8, seed: i })
  }
  for (let i = 0; i < 8; i += 1) {
    const x = rng.int(6, SIZE[0] - 7), z = rng.int(6, SIZE[2] - 7)
    if (!onDiorama(x, z) || rectDist(x, z) < 18) continue
    b.boulder([x, height(x, z), z], [2 + rng() * 1.5, 1.5 + rng(), 2 + rng() * 1.5], rock, { seed: i, mossTop: 'moss_block' })
  }
  b.scatter({ on: ['grass_block'], density: 0.35, paints: [[10, 'short_grass'], [3, 'tall_grass'], [1, 'fern'], [1, 'poppy'], [1, 'dandelion'], [1, 'oxeye_daisy'], [1, 'azure_bluet']], seed: 5 })

  // ------------------------------------------------------------------ weathering
  // Slate roofs: swap patches of tiles for deepslate bricks / cobbled deepslate (same value range),
  // using weather() with custom variants — it keeps the stair facing/half of every block.
  b.weather([0, P, 0], [SIZE[0] - 1, SIZE[1] - 1, SIZE[2] - 1], {
    amount: 0.28, mossBias: 0.35, scale: 3, seed: 9,
    variants: {
      'minecraft:deepslate_tile_stairs': ['minecraft:deepslate_brick_stairs', 'minecraft:cobbled_deepslate_stairs'],
      'minecraft:deepslate_tiles': ['minecraft:deepslate_bricks', 'minecraft:cobbled_deepslate'],
      'minecraft:deepslate_tile_slab': ['minecraft:deepslate_brick_slab', 'minecraft:cobbled_deepslate_slab'],
    },
  })
  b.weather([0, P - 4, 0], [SIZE[0] - 1, P + 6, SIZE[2] - 1], { amount: 0.3, mossBias: 0.8, scale: 3, seed: 1 })
  b.weather([0, P + 7, 0], [SIZE[0] - 1, SIZE[1] - 1, SIZE[2] - 1], { amount: 0.16, mossBias: 0.3, scale: 4, seed: 2 })
  b.overgrow([X0 - 8, P, Z0 - 8], [X0 + 4, WALK + 2, Z1 + 8], { amount: 0.22, maxLength: 6, moss: false, seed: 3 })
  b.overgrow([X0 - 8, P, Z0 - 8], [X2 + 8, WALK + 2, Z0 + 2], { amount: 0.2, maxLength: 5, moss: false, seed: 4 })

  return b.finish({ name: 'castle' })
}
