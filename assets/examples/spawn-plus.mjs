// HARBOR HUB - a DonutSMP-style "spawn+" (see references/spawns/README.md)
//
//   node scripts/run-build.mjs assets/examples/spawn-plus.mjs --out-dir minecraft-builds/spawn-plus --json
//   STAGE=massing|structure|detail|final selects how far the recipe runs.
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
  const CRN = 35
  const SHELF = CRN - 4 // the garden shelf east of the vault
  const SPAWN = [AX, CRN + 2, 68] // spawn dais top block; players stand at y 38, eye 39.6

  const clamp = (v, a, c) => Math.max(a, Math.min(c, v))
  const smooth = (a, c, v) => {
    const t = clamp((v - a) / (c - a), 0, 1)
    return t * t * (3 - 2 * t)
  }
  const fbm = (x, z, scale, seed) => kit.noise.fbm2(x, z, { scale, seed })
  const hash = (x, y, z, s = 0) => kit.noise.hash01(x, y, z, s)
  const st = (mat, facing, half = 'bottom') => kit.stairs(mat, facing, half)
  const sl = (mat, type = 'bottom') => kit.slab(mat, type)
  // wall-local frame: u to the right seen from outside, v up, d outward (toward `facing`)
  const F = (o, facing) => {
    const r = DIR[ccw(facing)]
    const n = DIR[facing]
    return (u, v = 0, d = 0) => [o[0] + r[0] * u + n[0] * d, o[1] + v, o[2] + r[2] * u + n[2] * d]
  }

  // placeholders, textured per building in the detail stage
  const WALL = 'minecraft:white_wool' // white field: quartz / calcite ramp
  const PLINTH = 'minecraft:light_gray_wool' // dark base: deepslate ramp
  const RET = 'minecraft:gray_wool' // terrace masonry: stone brick ramp
  const QZ = 'minecraft:smooth_quartz'
  const TRIM = 'polished_deepslate' // frames, cornices, sills (stairs / slabs / walls)
  const DARK = 'minecraft:polished_blackstone'
  const ACC = 'minecraft:blue_concrete' // the one accent: points and short runs only
  const ROOF = 'deepslate_tile'
  const FIELD = 'minecraft:smooth_stone' // paving field

  // ------------------------------------------------------------------ 1 site: terraces
  // Four terraces step down a hill to a bay: the crown (vault, hall of fame, spawn), the plaza
  // (hero, exchange, duels), the market street and the quay. Terrace edges jog per district.
  const crownS = x => (x < 82 ? 66 : x <= 128 ? 70 : 66) // last crown row (south edge)
  const crownN = x => (x < 84 ? 34 : x <= 126 ? 40 : 32) // first crown row: the cliff with the vault
  const MKT_N = 104 // first market row (the plaza wall face is z = 103)
  const QUAY_N = 127
  const QUAY_S = 138 // last quay row; water beyond
  const level = (x, z) => {
    if (z >= crownN(x) && z <= crownS(x) && x >= 28 + Math.max(0, 40 - z) * 0.3 && x <= 186) return x >= 130 ? SHELF : CRN
    if (z > crownS(x) && z <= 75 && Math.hypot(x - AX, z - 70) <= 5.5) return CRN // belvedere
    if (z > crownS(x) && z < MKT_N && x >= 40 && x <= 190) return PLZ
    if (z >= MKT_N && z < QUAY_N && x >= 32 + (z - MKT_N) * 0.4 && x <= 180 - (z - MKT_N) * 0.3) return MKT
    if (z >= QUAY_N && z <= QUAY_S && x >= 46 + Math.max(0, 6 - (z - QUAY_N)) && x <= 168) return QUAY
    return null
  }

  // natural ground: a hill sloping south with a crest behind the vault, two headlands
  // embracing the bay (the east one higher, with cliffs)
  const hill = (x, z) => {
    let h = 9 + 37 * (1 - smooth(0, 150, z)) ** 1.15 + 7 * (1 - smooth(10, 46, z))
    h += 4 * Math.exp(-(((x - AX) / 30) ** 2)) * (1 - smooth(20, 44, z)) // crest over the vault
    h += 10 * Math.exp(-(((x - 8) / 22) ** 2)) * smooth(90, 175, z)
    h += 18 * Math.exp(-(((x - 202) / 20) ** 2)) * smooth(70, 170, z)
    h += 2.6 * fbm(x, z, 30, 3) + 1.2 * fbm(x, z, 11, 4)
    return h
  }
  // the bay: a basin south of the quay, closed at the canvas edge by the old mole
  const bayDepth = (x, z) => {
    const rx = 64 - 22 * smooth(150, 206, z) + 5 * fbm(z, 7, 16, 9)
    const ax = 1 - Math.abs(x - 108 - 6 * smooth(150, 206, z)) / rx
    const az = (z - 139 + 3 * fbm(x, 3, 14, 8)) / 40
    return Math.min(ax * 2.2, az) // > 0 inside the bay
  }

  const G = new Int16Array(W * D) // surface y per column
  const L = new Int16Array(W * D).fill(-1) // terrace level, or -1 for natural ground
  const I = (x, z) => x + W * z
  const inCanvas = (x, z) => x >= 0 && z >= 0 && x < W && z < D
  for (let z = 0; z < D; z += 1)
    for (let x = 0; x < W; x += 1) {
      const lv = level(x, z)
      if (lv !== null) L[I(x, z)] = lv
    }
  const isTown = (x, z) => inCanvas(x, z) && L[I(x, z)] >= 0
  // outside the town: inverse-distance blend of nearby terrace levels into the hill, so the
  // terraces end in embankments, never in cut edges; north of the crown the hill stays a cliff
  const R = 12
  for (let z = 0; z < D; z += 1)
    for (let x = 0; x < W; x += 1) {
      const i = I(x, z)
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
          if (!inCanvas(xx, zz)) continue
          const lv = L[I(xx, zz)]
          if (lv < 0) continue
          const d2 = dx * dx + dz * dz
          if (d2 > R * R) continue
          wsum += 1 / d2
          lsum += lv / d2
          dmin = Math.min(dmin, Math.sqrt(d2))
        }
      let h = hill(x, z)
      const bd = bayDepth(x, z)
      if (bd > 0) h = Math.min(h, SEA - 1 - Math.min(4.5, 1 + bd * 14))
      else if (bd > -0.22) h = Math.min(h, SEA + 1 + (h - SEA - 1) * smooth(0, 0.22, -bd))
      const behindCliff = x >= 30 && x <= 184 && z < crownN(x)
      if (wsum > 0 && bd <= 0 && !behindCliff) h += (lsum / wsum - h) * (1 - smooth(1, R, dmin))
      if (x <= 1 || x >= W - 2 || z >= D - 3) h = Math.max(h, SEA + 1)
      G[i] = Math.round(h)
    }
  const g = (x, z) => (inCanvas(x, z) ? G[I(x, z)] : -1)

  // fill the ground: rock strata core, soil cap on natural ground, masonry under the terraces
  const ROCK = kit.gradient([kit.palette({ calcite: 3, diorite: 1 }, { scale: 4, seed: 6 }), 'diorite', kit.palette({ stone: 3, andesite: 2 }, { scale: 5, seed: 7 }), 'andesite', 'tuff'], { axis: 'y', from: 52, to: 0, dither: 0.8, scale: 3.5, seed: 5 })
  const steepAt = (x, z) => {
    const h = g(x, z)
    let m = 0
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inCanvas(x + dx, z + dz)) m = Math.max(m, h - g(x + dx, z + dz))
    return m
  }
  for (let z = 0; z < D; z += 1)
    for (let x = 0; x < W; x += 1) {
      const h = g(x, z)
      const town = isTown(x, z)
      const drop = steepAt(x, z)
      for (let y = 0; y <= h; y += 1) {
        let p
        if (town) p = y === h ? FIELD : 'stone'
        else if (h < SEA) p = y === h ? (hash(x, 0, z, 3) < 0.3 ? 'gravel' : 'sand') : 'sandstone'
        else if (h <= SEA + 1 && bayDepth(x, z) > -0.3) p = y === h ? kit.palette({ sand: 5, gravel: 2 }, { scale: 3, seed: 2 }) : 'sandstone'
        else if (drop >= 3) p = y >= h - 1 && y === h ? (hash(x, y, z, 4) < 0.5 ? 'coarse_dirt' : ROCK) : ROCK
        else p = y === h ? 'grass_block' : y >= h - 2 ? 'dirt' : ROCK
        b.set(x, y, z, p)
      }
      for (let y = h + 1; y <= SEA; y += 1) b.set(x, y, z, 'water')
    }

  // retaining walls: every town column face that stands above its neighbour becomes masonry
  // (painted RET, textured later); the top course is the coping
  const edges = [] // { x, z, dir, hi, lo } upper cell, outward direction, levels
  for (let z = 0; z < D; z += 1)
    for (let x = 0; x < W; x += 1) {
      if (!isTown(x, z)) continue
      const h = g(x, z)
      for (const dir of ['north', 'east', 'south', 'west']) {
        const [dx, , dz] = DIR[dir]
        if (!inCanvas(x + dx, z + dz)) continue
        const lo = g(x + dx, z + dz)
        if (lo >= h - 1) continue
        edges.push({ x, z, dir, hi: h, lo })
        for (let y = Math.max(0, lo - 1); y < h; y += 1) b.set(x, y, z, RET)
      }
    }

  if (!at('structure')) {
    b.spawnPoint(SPAWN, 'south')
    return b.finish({ name: 'spawn-plus', description: 'Harbor Hub spawn+ (massing)' })
  }

  // ------------------------------------------------------------------ helpers shared by all districts
  // the four faces of a rectangle as wall frames: u runs left → right seen from outside
  const rectFaces = (x0, z0, x1, z1) => [
    { facing: 'north', w: x1 - x0 + 1, f: F([x1, 0, z0], 'north') },
    { facing: 'south', w: x1 - x0 + 1, f: F([x0, 0, z1], 'south') },
    { facing: 'east', w: z1 - z0 + 1, f: F([x1, 0, z1], 'east') },
    { facing: 'west', w: z1 - z0 + 1, f: F([x0, 0, z0], 'west') },
  ]
  const disc = (cx, y, cz, r, paint, opts) => b.fillWhere([Math.floor(cx - r), y, Math.floor(cz - r)], [Math.ceil(cx + r), y, Math.ceil(cz + r)], (x, yy, z) => (x - cx) ** 2 + (z - cz) ** 2 <= r * r, paint, opts)
  const ringAt = (cx, y, cz, r0, r1, paintFor) => {
    for (let x = Math.floor(cx - r1 - 1); x <= Math.ceil(cx + r1 + 1); x += 1)
      for (let z = Math.floor(cz - r1 - 1); z <= Math.ceil(cz + r1 + 1); z += 1) {
        const d2 = (x - cx) ** 2 + (z - cz) ** 2
        if (d2 > r0 * r0 && d2 <= r1 * r1) b.set(x, y, z, paintFor(x - cx, z - cz))
      }
  }
  // a lantern that hangs from whatever is above (chain length to reach `y`)
  const hang = (x, y, z, len = 1) => {
    for (let k = 1; k <= len; k += 1) b.set(x, y + k, z, 'chain[axis=y]', { keep: true })
    b.set(x, y, z, 'lantern[hanging=true]')
  }
  // balustrade along a straight run (inclusive), on top of floor level y: posts every `every`,
  // balusters between and a slab rail; kind 'stone' (quartz posts) or 'iron' (see-through)
  const balustrade = (x0, z0, x1, z1, y, { every = 4, kind = 'stone', post = QZ, cap = true } = {}) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0))
    const dx = Math.sign(x1 - x0)
    const dz = Math.sign(z1 - z0)
    for (let k = 0; k <= n; k += 1) {
      const x = x0 + dx * k
      const z = z0 + dz * k
      const isPost = k === 0 || k === n || k % every === 0
      if (isPost) {
        b.set(x, y + 1, z, post)
        if (cap) b.set(x, y + 2, z, sl('smooth_quartz'))
      } else if (kind === 'iron') {
        b.set(x, y + 1, z, 'iron_bars')
      } else {
        b.set(x, y + 1, z, 'diorite_wall')
        if (cap) b.set(x, y + 2, z, sl('smooth_quartz'))
      }
    }
  }

  // ------------------------------------------------------------------ 2 the hero: clock bastion
  // A rusticated bastion at the plaza's south edge carries the server name (HARBOR) on its face
  // and the clock tower on its back half; its far side drops to the market street. The tower
  // is the one monumental element: 9 x 9, finial at y 60 (37 over the plaza, 44 over the market).
  const BX0 = 85
  const BX1 = 125
  const BZ0 = 96 // bastion front face (on the plaza)
  const BZ1 = 109 // back face (on the market)
  const BTOP = 32 // floor of the terrace on the bastion
  b.box([BX0, MKT - 1, BZ0], [BX1, BTOP - 1, BZ1], RET)
  b.box([BX0, BTOP, BZ0], [BX1, BTOP, BZ1], FIELD)
  // rustication: a plinth course and a projecting cordon under the parapet on every face
  for (const { facing, w, f } of rectFaces(BX0, BZ0, BX1, BZ1)) {
    const base = facing === 'north' ? PLZ + 1 : MKT + 1
    for (let u = 0; u < w; u += 1) {
      b.set(...f(u, base, 1), st(TRIM, opposite(facing)), { keep: true })
      b.set(...f(u, BTOP, 1), st(TRIM, opposite(facing), 'top'))
      b.set(...f(u, BTOP - 1, 0), TRIM)
    }
    // corner piers: two blocks proud, the full height, each crowned by a lantern on a plinth
    for (const u of [0, w - 1]) {
      for (let y = base; y <= BTOP; y += 1) b.set(...f(u, y, 1), y % 3 === 0 ? 'polished_andesite' : RET)
      b.set(...f(u, BTOP + 1, 1), 'polished_deepslate')
      b.set(...f(u, BTOP + 2, 1), 'polished_deepslate_wall')
      b.set(...f(u, BTOP + 3, 1), 'lantern[hanging=false]')
    }
  }
  // parapet round the terrace: quartz balustrade on the plaza side, iron rails toward the sea
  balustrade(BX0, BZ0, BX1, BZ0, BTOP, { every: 5 })
  balustrade(BX0, BZ1, BX1, BZ1, BTOP, { every: 5, kind: 'iron' })
  balustrade(BX0, BZ0, BX0, BZ1, BTOP, { every: 5, kind: 'iron' })
  balustrade(BX1, BZ0, BX1, BZ1, BTOP, { every: 5, kind: 'iron' })

  // the server name, set into the bastion face on a framed blackstone board (letters 5 tall)
  const HARBOR_TOP = PLZ + 7
  b.sign('HARBOR', [AX, HARBOR_TOP, BZ0], 'north', { align: 'center', board: DARK, frame: TRIM, pad: 1, boardDepth: 2 })

  // the clock tower: plinth, shaft, clock stage, belfry, balustrade and a pyramid spire.
  // Its apex is set by the first view: from the spawn eye (y 39.6, 34.5 blocks away) the
  // pitch-5 frame tops out at about y 59, so the finial ends there with sky above it.
  const TX0 = 101
  const TX1 = 109
  const TZ0 = 99
  const TZ1 = 107
  const TC = [105, 103] // tower centre
  const T0 = BTOP + 1 // tower floor, 33
  const SHAFT = [T0 + 2, T0 + 7] // 35..40
  const CLOCK = [T0 + 9, T0 + 15] // 42..48
  const BELL = [T0 + 17, T0 + 20] // 50..53
  b.box([TX0, T0, TZ0], [TX1, T0 + 1, TZ1], PLINTH)
  b.box([TX0, T0 + 2, TZ0], [TX1, BELL[1] + 1, TZ1], WALL)
  b.clear([TX0 + 2, T0, TZ0 + 2], [TX1 - 2, BELL[1], TZ1 - 2])
  for (const { facing, f } of rectFaces(TX0, TZ0, TX1, TZ1)) {
    const inward = opposite(facing)
    // plinth skirt and a water table
    for (let u = -1; u <= 9; u += 1) b.set(...f(u, T0, 1), st('deepslate_brick', inward))
    for (let u = 0; u <= 8; u += 1) b.set(...f(u, T0 + 2, 0), 'polished_diorite')
    // shaft: corner pilasters two wide, a recessed field with one tall arched window
    for (let u = 2; u <= 6; u += 1) for (let y = SHAFT[0] + 1; y <= SHAFT[1]; y += 1) b.set(...f(u, y, 0), 'air')
    for (let y = SHAFT[0] + 2; y <= SHAFT[1] - 1; y += 1) b.set(...f(4, y, -1), 'gray_stained_glass_pane')
    b.set(...f(3, SHAFT[1], -1), st('smooth_quartz', ccw(facing), 'top'))
    b.set(...f(5, SHAFT[1], -1), st('smooth_quartz', cw(facing), 'top'))
    b.set(...f(4, SHAFT[0] + 1, 0), st(TRIM, inward, 'top')) // sill
    b.set(...f(4, SHAFT[1], -1), ACC) // keystone
    // string course, then the clock: a framed white dial, two hands, four accent hour marks
    for (let u = -1; u <= 9; u += 1) b.set(...f(u, SHAFT[1] + 1, 1), st(TRIM, inward, 'top'))
    for (let u = 0; u <= 8; u += 1) b.set(...f(u, SHAFT[1] + 1, 0), TRIM)
    for (const u of [0, 8]) for (let y = CLOCK[0]; y <= CLOCK[1]; y += 1) b.set(...f(u, y, 1), y % 2 === 0 ? QZ : 'quartz_bricks') // corner quoins, proud
    const cy = (CLOCK[0] + CLOCK[1]) / 2
    for (let u = 1; u <= 7; u += 1)
      for (let y = CLOCK[0]; y <= CLOCK[1]; y += 1) {
        const du = u - 4
        const dv = y - cy
        const r = Math.hypot(du, dv)
        if (r > 3.4) continue
        if (r > 2.4) b.set(...f(u, y, 1), (du === 0 || dv === 0) && r > 2.9 ? ACC : 'polished_deepslate')
        else {
          const hand = (du === 0 && dv >= 1) || (dv === 0 && du <= -1)
          b.set(...f(u, y, 0), hand || (du === 0 && dv === 0) ? 'polished_blackstone' : 'white_concrete')
        }
      }
    // cornice over the clock, then the belfry: one round arch per face between corner piers
    for (let u = -1; u <= 9; u += 1) b.set(...f(u, CLOCK[1] + 1, 1), st(TRIM, inward, 'top'))
    for (let u = 0; u <= 8; u += 1) b.set(...f(u, CLOCK[1] + 1, 0), TRIM)
    for (const u of [0, 8]) for (let y = BELL[0]; y <= BELL[1]; y += 1) b.set(...f(u, y, 1), QZ)
    for (let u = 3; u <= 5; u += 1) for (let y = BELL[0]; y <= BELL[1] - 1; y += 1) for (let d = 0; d >= -1; d -= 1) b.set(...f(u, y, d), 'air')
    for (let d = 0; d >= -1; d -= 1) {
      b.set(...f(3, BELL[1] - 1, d), st('smooth_quartz', ccw(facing), 'top'))
      b.set(...f(5, BELL[1] - 1, d), st('smooth_quartz', cw(facing), 'top'))
    }
    b.set(...f(4, BELL[1], 0), ACC)
    for (let u = 2; u <= 6; u += 1) b.set(...f(u, BELL[0] - 1, 1), st('smooth_quartz', inward, 'top'))
    // top cornice and a balustrade with pinnacles at the corners
    for (let u = -1; u <= 9; u += 1) b.set(...f(u, BELL[1] + 1, 1), st(TRIM, inward, 'top'))
    for (let u = 0; u <= 8; u += 1) b.set(...f(u, BELL[1] + 2, 0), u === 0 || u === 8 ? 'quartz_pillar[axis=y]' : u === 4 ? QZ : 'diorite_wall')
  }
  for (const [x, z] of [[TX0, TZ0], [TX1, TZ0], [TX0, TZ1], [TX1, TZ1]]) {
    b.set(x, BELL[1] + 3, z, 'quartz_pillar[axis=y]')
    b.set(x, BELL[1] + 4, z, 'polished_deepslate_wall')
  }
  // inside: floors, lanterns so the windows glow at night, the bell under a beam
  b.box([TX0 + 2, CLOCK[0] - 1, TZ0 + 2], [TX1 - 2, CLOCK[0] - 1, TZ1 - 2], 'dark_oak_planks')
  b.box([TX0 + 2, BELL[0] - 1, TZ0 + 2], [TX1 - 2, BELL[0] - 1, TZ1 - 2], 'dark_oak_planks')
  for (let x = TX0 + 2; x <= TX1 - 2; x += 1) b.set(x, BELL[1], TC[1], 'stripped_dark_oak_log[axis=x]')
  b.set(TC[0], BELL[1] - 1, TC[1], 'bell[attachment=ceiling,facing=north]')
  hang(TC[0], CLOCK[0] + 3, TC[1], CLOCK[1] - CLOCK[0] - 2)
  hang(TC[0], SHAFT[0] + 2, TC[1], SHAFT[1] - SHAFT[0])
  b.set(TC[0] - 1, BELL[0], TC[1] - 1, 'lantern[hanging=false]')
  // the spire: a deepslate pyramid inside the balustrade, a finial on the apex
  const spire = b.roof({ x0: TX0 + 1, z0: TZ0 + 1, x1: TX1 - 1, z1: TZ1 - 1, y: BELL[1] + 2, type: 'pyramid', material: ROOF, pitch: 1, overhang: 0, eaveTrim: false })
  b.set(TC[0], spire.topY + 1, TC[1], 'polished_deepslate_wall')
  b.set(TC[0], spire.topY + 2, TC[1], 'lightning_rod[facing=up]')

  // ------------------------------------------------------------------ 3 spawn belvedere
  const [SX, SY, SZ] = SPAWN
  // the dais: two steps up, a compass-rose top with the four points in the accent
  for (let dx = -3; dx <= 3; dx += 1)
    for (let dz = -3; dz <= 3; dz += 1) {
      const ring = Math.max(Math.abs(dx), Math.abs(dz))
      const x = SX + dx
      const z = SZ + dz
      const out = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : dz > 0 ? 'north' : 'south'
      if (ring === 3) b.set(x, SY - 1, z, st('polished_deepslate', out))
      else if (ring === 2) {
        b.set(x, SY - 1, z, 'polished_deepslate')
        b.set(x, SY, z, st('smooth_quartz', out))
      } else {
        b.set(x, SY - 1, z, 'polished_deepslate')
        b.set(x, SY, z, dx === 0 && dz === 0 ? 'chiseled_quartz_block' : dx === 0 || dz === 0 ? QZ : 'polished_deepslate')
      }
    }
  for (const [dx, dz] of [[0, -4], [0, 4], [4, 0], [-4, 0]]) b.set(SX + dx, CRN, SZ + dz, ACC)

  b.spawnPoint(SPAWN, 'south')
  return b.finish({ name: 'spawn-plus', description: 'Harbor Hub spawn+' })
}
