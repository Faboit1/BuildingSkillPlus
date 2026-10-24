// DESERT PALACE (work in progress)
export default function build(api) {
  const { kit } = api
  const { DIR, cw, ccw, opposite } = kit
  const STAGES = ['massing', 'structure', 'texture', 'detail', 'final']
  const stage = STAGES.indexOf(process.env.STAGE ?? 'final')
  const at = s => stage >= STAGES.indexOf(s)
  const TAU = Math.PI * 2

  // ------------------------------------------------------------------ grid
  const W = 92
  const H = 60
  const D = 96
  const b = api.builder([W, H, D], { seed: 1001 })

  const CX = 44 // palace axis
  const G = 5 // desert floor around the palace (surface block y)
  const FLOOR = 9 // platform surface
  const F = FLOOR + 1 // first air row on the platform
  const X0 = CX - 22 // complex outer walls
  const X1 = CX + 22
  const Z0 = 10
  const Z1 = 65
  const HX0 = CX - 13 // hall 27 x 27
  const HX1 = CX + 13
  const HZ1 = Z0 + 26
  const HCZ = Z0 + 13 // hall / dome centre z
  const COURT_N = HZ1 + 4 // north arcade column line (z = 40)
  const COURT_S = Z1 - 5 // south arcade column line (z = 60)
  const COURT_W = X0 + 5 // west arcade column line (x = 27)
  const COURT_E = X1 - 5
  const HALL_TOP = F + 12 // hall roof slab
  const WING_TOP = F + 8
  const ARC_TOP = F + 6
  const PISH_TOP = F + 23
  const GATE_TOP = F + 11
  const DRUM_Y = HALL_TOP + 1
  const DOME_Y = F + 21
  const MINARETS = [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]

  // placeholders, one per surface role (textured in the texture stage)
  const WALL = 'minecraft:white_wool'
  const PLINTH = 'minecraft:light_gray_wool'
  const DOME = 'minecraft:cyan_wool'
  const TRIM = 'smooth_sandstone' // stairs/slabs placed directly (wool has no stairs)

  const st = (mat, facing, half = 'bottom') => kit.stairs(mat, facing, half)
  const sl = (mat, type = 'bottom') => kit.slab(mat, type)

  // ------------------------------------------------------------------ helpers
  // Wall-local frame: u to the right seen from outside, v up, d inward (d < 0 = outward).
  const frame = (o, facing) => {
    const r = DIR[ccw(facing)]
    const n = DIR[facing]
    return (u, v, d = 0) => [o[0] + r[0] * u - n[0] * d, o[1] + v, o[2] + r[2] * u - n[2] * d]
  }

  // Arch head classification with 2x2 supersampling per cell. Returns cells relative to the
  // springing (j = 0 is the first row of the head) for an opening w wide.
  //   pointed: two-centred, R = k * w (k 1 = equilateral gothic, 0.6-0.8 = squat Persian)
  //   horseshoe: the same arcs with centres raised by `lift`, so the opening bulges 0.5 past
  //   the jambs just above the springing (Moorish).
  const archHead = (w, { k = 0.75, horseshoe = false, ring = 0 } = {}) => {
    const a = w / 2
    const ap = horseshoe ? a + 0.5 : a
    const R = k * 2 * ap
    const e = horseshoe ? Math.sqrt(Math.max(0, R * R - (R - 0.5) ** 2)) : 0
    const inside = (u, v, extra = 0) => {
      if (v < 0) return Math.abs(u) <= a
      const du = Math.abs(u) + R - ap
      return du * du + (v - e) ** 2 <= (R + extra) ** 2 && (horseshoe || Math.abs(u) <= a + extra)
    }
    const cells = []
    const apex = e + Math.sqrt(R * R - (R - ap) ** 2)
    const margin = horseshoe ? 1 : 0
    for (let j = 0; j <= Math.ceil(apex + ring) + 1; j += 1) {
      for (let i = -margin - ring; i < w + margin + ring; i += 1) {
        const u = i - (w - 1) / 2
        const side = u < 0 ? -1 : u > 0 ? 1 : 0
        const inner = u === 0 ? 0 : -Math.sign(u) * 0.25
        const outer = -inner
        const bi = inside(u + inner, j + 0.25)
        const bo = inside(u + outer, j + 0.25)
        const ti = inside(u + inner, j + 0.75)
        const to = inside(u + outer, j + 0.75)
        const n = bi + bo + ti + to
        let kind = null
        if (n >= 3) kind = 'air'
        else if (bi && bo) kind = 'slabTop'
        else if (ti && to) kind = 'slabBottom'
        else if (bi) kind = 'stairTop'
        else if (ti) kind = 'stairBottom'
        else if (ring > 0) {
          let hit = false
          for (const du of [-0.4, 0, 0.4]) for (const dv of [0.1, 0.5, 0.9]) if (inside(u + du, j + dv, ring)) hit = true
          if (hit) kind = 'ring'
        }
        if (kind) cells.push({ i, j, kind, side })
      }
    }
    return cells
  }

  // Cut an arched opening into a wall. o = outer-face cell of the left jamb at floor level,
  // facing = outward normal. Rows 0..spring-1 are cleared full width, the head above.
  const cutArch = (o, facing, { w = 3, spring = 3, depth = 1, k = 0.75, horseshoe = false, mat = TRIM, fill = 'air', ring = 0, ringPaint, from = 0 } = {}) => {
    const p = frame(o, facing)
    const left = cw(facing)
    const right = ccw(facing)
    for (let d = from; d < from + depth; d += 1) {
      for (let v = 0; v < spring; v += 1) for (let u = 0; u < w; u += 1) b.set(...p(u, v, d), fill)
      for (const c of archHead(w, { k, horseshoe, ring })) {
        const pos = p(c.i, spring + c.j, d)
        const out = c.side < 0 ? left : right
        if (c.kind === 'air') b.set(...pos, fill)
        else if (c.kind === 'slabTop') b.set(...pos, sl(mat, 'top'))
        else if (c.kind === 'slabBottom') b.set(...pos, sl(mat, 'bottom'))
        else if (c.kind === 'stairTop') b.set(...pos, st(mat, c.side === 0 ? left : out, 'top'))
        else if (c.kind === 'stairBottom') b.set(...pos, st(mat, c.side === 0 ? left : out, 'bottom'))
        else if (c.kind === 'ring' && ringPaint && d === from) b.set(...pos, ringPaint)
      }
    }
  }

  // Onion dome profile: a sphere of radius R whose centre sits `neck`*R above the base (so the
  // base is a narrower neck and the bulb overhangs the drum), continued from the `turn` angle
  // by a concave ogee tip. kit.onionProfile has a kink at t = 0.62 (see notes), hence this one.
  const onion = (R, { neck = 0.7, turn = 58, tip = 2.4 } = {}) => {
    const c = neck * R
    const th = (turn * Math.PI) / 180
    const y1 = c + Math.sin(th) * R
    const r1 = Math.cos(th) * R
    const L = (tip * r1) / Math.tan(th) // slope-continuous join between bulb and tip
    const r = y => (y < y1 ? Math.sqrt(Math.max(0, R * R - (y - c) ** 2)) : r1 * Math.max(0, 1 - (y - y1) / L) ** tip)
    return { radius: dy => r(dy + 0.5), height: Math.round(y1 + L) }
  }

  const disc = (cx, y, cz, r, paint, opts) => b.disc([cx, y, cz], r, paint, opts)

  // ------------------------------------------------------------------ 1 site
  // Sculpted dunes: a few big asymmetric mounds (long gentle windward back, short steep lee face)
  // around the edges, faded to a level zone that holds the palace, its forecourt, the market
  // street and the oasis. Noise alone gives lumpy hills; dunes need a directional profile.
  const DUNES = [
    // x, z, radius, height, angle of the lee side (radians, 0 = east)
    [4, 4, 18, 12, 0.7], [40, -4, 16, 8, 1.3], [72, -2, 17, 11, 1.1], [94, 20, 15, 9, 2.7],
    [-2, 40, 14, 10, 0.1], [2, 72, 14, 8, 0.3], [10, 100, 16, 7, -0.7], [94, 98, 15, 8, 3.7], [96, 64, 11, 7, 3.1],
  ]
  const OASIS = { x: 80, z: 45, r: 7 }
  const levelDist = (x, z) => {
    const dx = Math.max(X0 - 6 - x, 0, x - (X1 + 6))
    const dz = Math.max(Z0 - 6 - z, 0, z - (Z1 + 12))
    const palace = Math.hypot(dx, dz)
    const street = z > Z1 ? Math.max(Math.abs(x - CX) - 12, 0) : 99
    const oasis = Math.max(0, Math.hypot(x - OASIS.x, z - OASIS.z) - OASIS.r - 5)
    return Math.min(palace, street, oasis)
  }
  const duneHeight = (x, z) => {
    let h = 0
    for (const [dx, dz, r, hh, a] of DUNES) {
      const s = (x - dx) * Math.cos(a) + (z - dz) * Math.sin(a)
      const t = -(x - dx) * Math.sin(a) + (z - dz) * Math.cos(a)
      const rho = Math.hypot(s / (s < 0 ? r : 0.5 * r), t / (1.4 * r))
      if (rho < 1) h = Math.max(h, hh * (1 - rho * rho) ** 1.5)
    }
    return h
  }
  // Strata for the diorama's cut faces: terracotta bedrock grading up into sandstone.
  const STRATA = kit.gradient(['terracotta', 'white_terracotta', 'sandstone', 'smooth_sandstone', 'sandstone'], { axis: 'y', from: 0, to: 11, dither: 0.7, scale: 3 })
  const ground = b.terrain({
    base: 0,
    layers: [{ depth: 2, paint: 'sand' }, { depth: 1, paint: 'sandstone' }, { paint: STRATA }],
    height: (x, z) => {
      const m = Math.min(1, Math.max(0, (levelDist(x, z) - 1) / 9))
      const swell = 1 + 1.6 * kit.noise.fbm2(x, z, { scale: 20, seed: 4 })
      return G + m * Math.max(0, duneHeight(x, z) + swell)
    },
  })

  // ------------------------------------------------------------------ 2 platform (podium)
  // Mughal and Moorish palaces stand on a podium of darker stone: it lifts the building off
  // the sand, gives the "heavy base" of the tripartite facade and is the darkest role.
  const PX0 = X0 - 3
  const PX1 = X1 + 3
  const PZ0 = Z0 - 3
  const PZ1 = Z1 + 3
  b.box([PX0, 2, PZ0], [PX1, FLOOR, PZ1], PLINTH)
  b.box([CX - 7, 2, PZ1 + 1], [CX + 7, FLOOR, PZ1 + 2], PLINTH) // landing before the stair
  for (const [mx, mz] of MINARETS) b.box([mx - 3, 2, mz - 3], [mx + 3, F + 1, mz + 3], PLINTH)

  if (!at('structure')) {
    b.box([HX0, F, Z0], [HX1, HALL_TOP, HZ1], WALL)
    b.box([X0, F, Z0], [X1, WING_TOP, HZ1], WALL)
    b.box([X0, F, HZ1 + 1], [X1, ARC_TOP, Z1], WALL)
    b.box([CX - 9, F, HZ1 + 1], [CX + 9, PISH_TOP, COURT_N + 1], WALL)
    b.cylinder([CX, DRUM_Y, HCZ], 7.5, 8, WALL)
    const on = onion(9.5)
    b.lathe([CX, DOME_Y, HCZ], on.height, on.radius, DOME)
    return b.finish({ name: 'desert-palace' })
  }

  // ------------------------------------------------------------------ 3 masses and interiors
  b.box([X0, F, Z0], [CX - 14, WING_TOP, HZ1], WALL) // wings: two storeys
  b.box([CX + 14, F, Z0], [X1, WING_TOP, HZ1], WALL)
  b.box([HX0, F, Z0], [HX1, HALL_TOP, HZ1], WALL) // great hall: one domed room
  b.box([X0, F, HZ1 + 1], [COURT_W, ARC_TOP, Z1], WALL) // arcades (riwaq) on all four sides
  b.box([COURT_E, F, HZ1 + 1], [X1, ARC_TOP, Z1], WALL)
  b.box([X0, F, COURT_S], [X1, ARC_TOP, Z1], WALL)
  b.box([X0, F, HZ1 + 1], [X1, ARC_TOP, COURT_N], WALL)
  b.clear([COURT_W + 1, F, COURT_N + 1], [COURT_E - 1, H - 1, COURT_S - 1]) // the court
  b.clear([X0 + 2, F, HZ1 + 1], [COURT_W - 1, ARC_TOP - 1, Z1 - 2]) // galleries
  b.clear([COURT_E + 1, F, HZ1 + 1], [X1 - 2, ARC_TOP - 1, Z1 - 2])
  b.clear([X0 + 2, F, COURT_S + 1], [X1 - 2, ARC_TOP - 1, Z1 - 2])
  b.clear([X0 + 2, F, HZ1 + 1], [X1 - 2, ARC_TOP - 1, COURT_N - 1])
  b.clear([HX0 + 2, F, Z0 + 2], [HX1 - 2, HALL_TOP - 1, HZ1 - 2]) // great hall
  disc(CX, HALL_TOP, HCZ, 5.5, 'air') // oculus into the drum
  for (const [x0, x1] of [[X0 + 2, HX0 - 1], [HX1 + 1, X1 - 2]]) {
    b.clear([x0, F, Z0 + 2], [x1, WING_TOP - 1, HZ1 - 2])
    b.box([x0, F + 4, Z0 + 2], [x1, F + 4, HZ1 - 2], 'spruce_planks') // upper floor of the wing
  }

  // Court arcades: pointed arches 3 wide on 1-wide columns, a 4-block bay rhythm.
  const arcadeBays = []
  for (let z = COURT_N; z < COURT_S; z += 4) {
    arcadeBays.push([[COURT_W, F, z + 3], 'east'])
    arcadeBays.push([[COURT_E, F, z + 1], 'west'])
  }
  for (const x of [COURT_W + 1, COURT_W + 5, COURT_E - 7, COURT_E - 3]) arcadeBays.push([[x, F, COURT_N], 'south'])
  const SOUTH_BAYS = [COURT_W + 1, COURT_W + 5, COURT_W + 9, COURT_E - 11, COURT_E - 7, COURT_E - 3]
  for (const x of SOUTH_BAYS) arcadeBays.push([[x + 2, F, COURT_S], 'north'])
  for (const [o, facing] of arcadeBays) cutArch(o, facing, { w: 3, spring: 3, k: 1, mat: TRIM })

  // ------------------------------------------------------------------ 4 roofline
  // Stepped Moorish merlons: stair, block + wall post, stair, gap (period 4) on a parapet course.
  const crenel = (a, c, y, { merlons = true } = {}) => {
    const dx = Math.sign(c[0] - a[0])
    const dz = Math.sign(c[1] - a[1])
    const n = Math.max(Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1])) + 1
    const centres = []
    for (let i = 0; i < n; i += 4) centres.push(i)
    if (centres[centres.length - 1] !== n - 1) centres.push(n - 1)
    for (let i = 0; i < n; i += 1) {
      const x = a[0] + dx * i
      const z = a[1] + dz * i
      b.set(x, y, z, WALL)
      if (!merlons) continue
      let best = Infinity
      let toward = 0
      for (const m of centres) if (Math.abs(m - i) < best) { best = Math.abs(m - i); toward = Math.sign(m - i) }
      if (best === 0) {
        b.set(x, y + 1, z, WALL)
        b.set(x, y + 2, z, 'sandstone_wall')
      } else if (best === 1) {
        b.set(x, y + 1, z, st(TRIM, kit.facingFrom(dx * toward, dz * toward)))
      }
    }
  }
  const crenelRect = (x0, z0, x1, z1, y, skip = {}) => {
    if (!skip.north) crenel([x0, z0], [x1, z0], y)
    if (!skip.south) crenel([x0, z1], [x1, z1], y)
    if (!skip.west) crenel([x0, z0], [x0, z1], y)
    if (!skip.east) crenel([x1, z0], [x1, z1], y)
  }
  crenelRect(X0, Z0, HX0 - 1, HZ1, WING_TOP + 1, { east: true })
  crenelRect(HX1 + 1, Z0, X1, HZ1, WING_TOP + 1, { west: true })
  crenelRect(HX0, Z0, HX1, HZ1, HALL_TOP + 1)
  crenel([X0, HZ1 + 1], [X0, Z1], ARC_TOP + 1)
  crenel([X1, HZ1 + 1], [X1, Z1], ARC_TOP + 1)
  crenel([X0, Z1], [X1, Z1], ARC_TOP + 1)
  crenelRect(COURT_W, COURT_N, COURT_E, COURT_S, ARC_TOP + 1)

  // A small dome over every gallery bay (the riwaq roofs of caravanserais and mosques).
  const miniDome = (x, y, z) => {
    b.set(x, y, z, WALL)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]])
      b.set(x + dx, y, z + dz, st(TRIM, kit.facingFrom(-dx, -dz)))
    b.set(x, y + 1, z, sl(TRIM))
  }
  const galW = X0 + 3
  const galE = X1 - 3
  const galN = HZ1 + 2
  const galS = Z1 - 3
  for (let z = COURT_N + 2; z < COURT_S; z += 4) {
    miniDome(galW, ARC_TOP + 1, z)
    miniDome(galE, ARC_TOP + 1, z)
  }
  for (const x of SOUTH_BAYS) miniDome(x + 1, ARC_TOP + 1, galS)
  for (const x of [COURT_W + 2, COURT_W + 6, COURT_E - 6, COURT_E - 2]) miniDome(x, ARC_TOP + 1, galN)
  for (const [x, z] of [[galW, galN], [galE, galN], [galW, galS], [galE, galS]]) miniDome(x, ARC_TOP + 1, z)

  // ------------------------------------------------------------------ 5 pishtaq and iwan (hero)
  // A tall rectangular frame (pishtaq) projecting from the hall, holding a deep pointed vault
  // (iwan). The field inside the frame is recessed one block so the frame casts a shadow.
  const PZF = COURT_N + 1 // pishtaq front face z
  const PW = 9 // pishtaq half width
  b.box([CX - PW, F, HZ1 + 1], [CX + PW, PISH_TOP, PZF], WALL)
  for (let x = CX - PW + 2; x <= CX + PW - 2; x += 1) for (let y = F; y <= PISH_TOP - 2; y += 1) b.remove(x, y, PZF)
  cutArch([CX - 5, F, PZF - 1], 'south', { w: 11, spring: 10, depth: 4, k: 0.68, mat: TRIM, ring: 1, ringPaint: 'cut_sandstone' })
  // muqarnas hood: staggered corbels of upside-down stairs and top slabs at the back of the vault
  for (let y = F + 10; y <= PISH_TOP - 4; y += 1) {
    for (let x = CX - 5; x <= CX + 5; x += 1) {
      for (const [z, yMin] of [[HZ1 + 1, F + 10], [HZ1 + 2, F + 12], [HZ1 + 3, F + 14]]) {
        if (y < yMin || b.has(x, y, z)) continue
        b.set(x, y, z, (x + y + z) % 2 === 0 ? st(TRIM, 'north', 'top') : sl(TRIM, 'top'))
      }
    }
  }
  // the real door into the great hall: a horseshoe arch at the back of the iwan
  cutArch([CX - 1, F, HZ1], 'south', { w: 3, spring: 3, depth: 2, k: 0.9, horseshoe: true, mat: TRIM })
  // guldasta turrets at the frame corners
  const turret = (x, z, y0, y1) => {
    for (let y = y0; y <= y1; y += 1) for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(x + dx, y, z + dz, WALL)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(x + dx, y1 + 1, z + dz, st(TRIM, kit.facingFrom(-dx, -dz)))
    b.set(x, y1 + 1, z, WALL)
    b.set(x, y1 + 2, z, 'gold_block')
    b.set(x, y1 + 3, z, 'lightning_rod')
  }
  turret(CX - PW, PZF, F, PISH_TOP + 2)
  turret(CX + PW, PZF, F, PISH_TOP + 2)
  crenel([CX - PW + 1, PZF], [CX + PW - 1, PZF], PISH_TOP + 1)

  // ------------------------------------------------------------------ 6 gatehouse
  const GX0 = CX - 5
  const GX1 = CX + 5
  const GZF = Z1 + 2
  b.box([GX0, F, COURT_S], [GX1, GATE_TOP, GZF], WALL)
  for (let x = GX0 + 2; x <= GX1 - 2; x += 1) for (let y = F; y <= GATE_TOP - 2; y += 1) b.remove(x, y, GZF)
  cutArch([CX - 2, F, GZF - 1], 'south', { w: 5, spring: 5, depth: GZF - COURT_S, k: 0.8, mat: TRIM, ring: 1, ringPaint: 'cut_sandstone' })
  cutArch([GX0, F, COURT_S + 1], 'west', { w: 3, spring: 3, depth: 3, k: 1, mat: TRIM }) // into the S gallery
  cutArch([GX1, F, Z1 - 2], 'east', { w: 3, spring: 3, depth: 3, k: 1, mat: TRIM })
  turret(GX0, GZF, F, GATE_TOP + 2)
  turret(GX1, GZF, F, GATE_TOP + 2)
  crenel([GX0 + 1, GZF], [GX1 - 1, GZF], GATE_TOP + 1)
  crenel([GX0, COURT_S], [GX1, COURT_S], GATE_TOP + 1)
  crenel([GX0, COURT_S], [GX0, GZF], GATE_TOP + 1)
  crenel([GX1, COURT_S], [GX1, GZF], GATE_TOP + 1)

  // ------------------------------------------------------------------ 7 drum and domes
  b.tube([CX, DRUM_Y, HCZ], 7.5, 8, WALL, { thickness: 2 })
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * TAU
    for (let r = 5; r <= 8; r += 0.5) {
      const x = Math.round(CX + r * Math.cos(a))
      const z = Math.round(HCZ + r * Math.sin(a))
      for (let y = DRUM_Y + 2; y <= DRUM_Y + 4; y += 1) b.remove(x, y, z)
    }
  }
  const ringOf = (cx, cz, y, r0, r1, paintFor) => {
    for (let x = Math.floor(cx - r1 - 1); x <= Math.ceil(cx + r1 + 1); x += 1)
      for (let z = Math.floor(cz - r1 - 1); z <= Math.ceil(cz + r1 + 1); z += 1) {
        const d2 = (x - cx) ** 2 + (z - cz) ** 2
        if (d2 > r0 * r0 && d2 <= r1 * r1) b.set(x, y, z, paintFor(x - cx, z - cz))
      }
  }
  ringOf(CX, HCZ, DRUM_Y + 7, 7.5, 8.6, (dx, dz) => st(TRIM, kit.facingFrom(-dx, -dz), 'top')) // cornice
  const DOME_PROFILE = onion(9.5)
  b.lathe([CX, DOME_Y, HCZ], DOME_PROFILE.height, DOME_PROFILE.radius, DOME, { hollow: true })
  const DOME_TOP = DOME_Y + DOME_PROFILE.height - 1
  b.set(CX, DOME_TOP + 1, HCZ, 'gold_block')
  b.set(CX, DOME_TOP + 2, HCZ, 'gold_block')
  b.set(CX, DOME_TOP + 3, HCZ, 'lightning_rod')

  // secondary domes over the wings: same language, a third of the size
  for (const cx of [CX - 18, CX + 18]) {
    b.cylinder([cx, WING_TOP + 1, HCZ], 2.5, 2, WALL)
    ringOf(cx, HCZ, WING_TOP + 2, 2.5, 3.3, (dx, dz) => st(TRIM, kit.facingFrom(-dx, -dz), 'top'))
    const p = onion(3.6, { neck: 0.72, turn: 55, tip: 2 })
    b.lathe([cx, WING_TOP + 3, HCZ], p.height, p.radius, DOME)
    b.set(cx, WING_TOP + 3 + p.height, HCZ, 'lightning_rod')
  }

  // ------------------------------------------------------------------ 8 minarets
  // 46 blocks tall on a 5-wide octagonal shaft (9:1): two balconies on corbels, an open
  // lantern stage, a small gilded onion. Slender verticals frame the dome without rivalling it.
  const minaret = (mx, mz) => {
    b.cylinder([mx, F + 2, mz], 2.5, 18, WALL)
    ringOf(mx, mz, F + 19, 2.5, 3.6, (dx, dz) => st(TRIM, kit.facingFrom(-dx, -dz), 'top'))
    disc(mx, F + 20, mz, 3.6, 'smooth_sandstone')
    b.ring([mx, F + 21, mz], 3.6, 'sandstone_wall')
    b.cylinder([mx, F + 20, mz], 2.0, 11, WALL)
    ringOf(mx, mz, F + 30, 2.0, 3.0, (dx, dz) => st(TRIM, kit.facingFrom(-dx, -dz), 'top'))
    disc(mx, F + 31, mz, 3.0, 'smooth_sandstone')
    b.ring([mx, F + 32, mz], 3.0, 'sandstone_wall')
    for (let y = F + 32; y <= F + 34; y += 1) for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.set(mx + dx, y, mz + dz, WALL)
    disc(mx, F + 35, mz, 1.8, WALL)
    ringOf(mx, mz, F + 35, 1.5, 2.3, (dx, dz) => st(TRIM, kit.facingFrom(-dx, -dz), 'top'))
    const cap = [1.5, 2.1, 2.1, 1.5, 0.9]
    b.lathe([mx, F + 36, mz], cap.length, dy => cap[dy], DOME)
    b.set(mx, F + 36 + cap.length, mz, 'gold_block')
    b.set(mx, F + 37 + cap.length, mz, 'lightning_rod')
  }
  for (const [mx, mz] of MINARETS) minaret(mx, mz)


  // ------------------------------------------------------------------ 9 facades
  // Persian/Moorish walls are never flat: shallow pointed niches (blind arcades) in bays
  // separated by piers, with the real window set one block deeper inside the niche.
  // nicheAt: c = niche centre along the wall, face = outer wall coordinate.
  const nicheAt = (facing, face, c, y, { w = 3, spring = 3, window = null, winY = [], k = 1 } = {}) => {
    const off = (w - 1) / 2
    const alongX = facing === 'north' || facing === 'south'
    const sign = facing === 'south' || facing === 'west' ? -1 : 1 // left jamb is at c - off for S/W faces
    const left = c + sign * off
    const o = alongX ? [left, y, face] : [face, y, left]
    cutArch(o, facing, { w, spring, depth: 1, k, mat: TRIM })
    if (window) {
      const n = DIR[facing]
      for (const wy of winY) {
        const p = alongX ? [c, wy, face - n[2]] : [face - n[0], wy, c]
        b.set(...p, window)
      }
    }
  }
  const GRILLE = 'minecraft:iron_bars'
  // great hall: two tiers of five niches on the north face, clerestory windows above the wings
  for (const c of [CX - 10, CX - 5, CX, CX + 5, CX + 10]) {
    nicheAt('north', Z0, c, F + 1, { spring: 4, window: GRILLE, winY: [F + 2, F + 3] })
    nicheAt('north', Z0, c, F + 8, { spring: 1, window: GRILLE, winY: [F + 9, F + 10] })
  }
  for (const c of [HCZ - 8, HCZ - 4, HCZ, HCZ + 4, HCZ + 8]) {
    nicheAt('west', HX0, c, WING_TOP + 1, { w: 1, spring: 2, k: 1, window: GRILLE, winY: [WING_TOP + 1, WING_TOP + 2] })
    nicheAt('east', HX1, c, WING_TOP + 1, { w: 1, spring: 2, k: 1, window: GRILLE, winY: [WING_TOP + 1, WING_TOP + 2] })
  }
  for (const c of [CX - 11, CX + 11]) nicheAt('south', HZ1, c, F + 8, { spring: 1, window: GRILLE, winY: [F + 9, F + 10] })
  // wings: one tall niche per bay spanning both storeys, a window on each floor inside it
  for (const c of [HCZ - 10, HCZ - 5, HCZ, HCZ + 5, HCZ + 10]) {
    nicheAt('west', X0, c, F + 1, { spring: 5, window: GRILLE, winY: [F + 1, F + 2, F + 5, F + 6] })
    nicheAt('east', X1, c, F + 1, { spring: 5, window: GRILLE, winY: [F + 1, F + 2, F + 5, F + 6] })
  }
  for (const c of [CX - 18, CX + 18]) nicheAt('north', Z0, c, F + 1, { spring: 5, window: GRILLE, winY: [F + 1, F + 2, F + 5, F + 6] })
  // arcade outer walls: a blind arcade matching the gallery bays, a slit window in each
  for (let z = COURT_N + 2; z < COURT_S; z += 4) {
    nicheAt('west', X0, z, F + 1, { spring: 2, window: GRILLE, winY: [F + 2, F + 3] })
    nicheAt('east', X1, z, F + 1, { spring: 2, window: GRILLE, winY: [F + 2, F + 3] })
  }
  for (const x of SOUTH_BAYS) nicheAt('south', Z1, x + 1, F + 1, { spring: 2, window: GRILLE, winY: [F + 2, F + 3] })

  // podium: blind arcade of low niches between the bastions, cornice of upside-down stairs
  for (let x = CX - 15; x <= CX + 15; x += 5) {
    nicheAt('north', PZ0, x, G + 1, { spring: 0 })
    if (Math.abs(x - CX) > 8) nicheAt('south', PZ1, x, G + 1, { spring: 0 })
  }
  for (let z = HCZ - 5; z <= Z1 - 7; z += 5) {
    nicheAt('west', PX0, z, G + 1, { spring: 0 })
    nicheAt('east', PX1, z, G + 1, { spring: 0 })
  }
  for (let x = PX0 - 1; x <= PX1 + 1; x += 1) {
    if (x >= CX - 7 && x <= CX + 7) continue
    b.set(x, FLOOR, PZ0 - 1, st('granite', 'south', 'top'))
    b.set(x, FLOOR, PZ1 + 1, st('granite', 'north', 'top'))
  }
  for (let z = PZ0; z <= PZ1; z += 1) {
    b.set(PX0 - 1, FLOOR, z, st('granite', 'east', 'top'))
    b.set(PX1 + 1, FLOOR, z, st('granite', 'west', 'top'))
  }
  // grand stair down to the market street, cheek walls stepping with it
  b.stairway([CX, G + 1, PZ1 + 6], 'north', 4, 'granite', { width: 11, sides: PLINTH })

  // ------------------------------------------------------------------ 10 the court (chahar bagh)
  // Axial reflecting pool from the gate to the iwan, a cross channel, four garden beds.
  const POOL = { x0: CX - 3, x1: CX + 3, z0: COURT_N + 3, z1: COURT_S - 3 }
  const CROSS_Z = Math.round((COURT_N + COURT_S) / 2)
  b.box([POOL.x0 - 1, FLOOR - 3, POOL.z0 - 1], [POOL.x1 + 1, FLOOR, POOL.z1 + 1], 'smooth_sandstone')
  b.box([POOL.x0, FLOOR - 3, POOL.z0], [POOL.x1, FLOOR - 3, POOL.z1], 'dark_prismarine')
  b.box([POOL.x0, FLOOR - 2, POOL.z0], [POOL.x1, FLOOR, POOL.z1], 'water')
  for (let x = COURT_W + 3; x <= COURT_E - 3; x += 1) {
    if (x >= POOL.x0 - 1 && x <= POOL.x1 + 1) continue
    b.set(x, FLOOR - 1, CROSS_Z, 'dark_prismarine')
    b.set(x, FLOOR, CROSS_Z, 'water')
  }
  // garden beds: grass a block below the paving, a raised curb, citrus and flowers later
  const BEDS = []
  for (const [x0, x1] of [[COURT_W + 2, POOL.x0 - 3], [POOL.x1 + 3, COURT_E - 2]])
    for (const [z0, z1] of [[COURT_N + 2, CROSS_Z - 2], [CROSS_Z + 2, COURT_S - 2]]) BEDS.push({ x0, x1, z0, z1 })
  for (const bed of BEDS) {
    b.box([bed.x0, FLOOR - 1, bed.z0], [bed.x1, FLOOR, bed.z1], 'grass_block')
    b.walls([bed.x0 - 1, FLOOR + 1, bed.z0 - 1], [bed.x1 + 1, FLOOR + 1, bed.z1 + 1], sl(TRIM))
  }
  // fountain: octagonal basin, column, bowl
  const FX = CX
  const FZ = CROSS_Z
  b.disc([FX, FLOOR + 1, FZ], 2.6, 'smooth_sandstone')
  b.disc([FX, FLOOR + 1, FZ], 1.6, 'water')
  b.set(FX, FLOOR + 1, FZ, 'chiseled_sandstone')
  b.set(FX, FLOOR + 2, FZ, 'sandstone_wall')
  b.set(FX, FLOOR + 3, FZ, 'chiseled_sandstone')
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(FX + dx, FLOOR + 3, FZ + dz, st(TRIM, kit.facingFrom(-dx, -dz), 'top'))
  b.set(FX, FLOOR + 4, FZ, 'water')


  if (!at('texture')) return b.finish({ name: 'desert-palace' })

  // ------------------------------------------------------------------ 11 texture
  // Walls: the desert ramp smooth -> cut -> plain sandstone (L* 85.5 / 82.8 / 81.8). The values
  // are nearly equal, so the ramp reads as plaster variation, not as shading: the real value
  // structure comes from shadowed niches, the darker podium and the teal dome.
  const STUCCO = ['smooth_sandstone', 'cut_sandstone', 'sandstone']
  const stucco = (a, c, opts = {}) => b.texture(a, c, STUCCO, { only: WALL, base: 0.3, edge: 0.15, drip: 0.06, noise: 0.25, scale: 5, ...opts })
  for (const [mx, mz] of MINARETS) stucco([mx - 4, F, mz - 4], [mx + 4, F + 36, mz + 4], { seed: mx + mz })
  stucco([CX - 10, F, HZ1 + 1], [CX + 10, PISH_TOP + 4, PZF + 1], { focus: [[CX, F + 2, PZF]], seed: 3 })
  stucco([CX - 6, F, COURT_S], [CX + 6, GATE_TOP + 3, GZF + 1], { focus: [[CX, F + 2, GZF]], seed: 4 })
  stucco([CX - 9, DRUM_Y, HCZ - 9], [CX + 9, DRUM_Y + 8, HCZ + 9], { seed: 5 })
  stucco([HX0, F, Z0], [HX1, HALL_TOP + 3, HZ1], { seed: 6 })
  stucco([X0, F, Z0], [X1, WING_TOP + 6, HZ1], { seed: 7 })
  stucco([X0, F, HZ1 + 1], [X1, ARC_TOP + 3, Z1], { seed: 8 })
  // Podium: Mughal palaces sit on red sandstone; here granite and terracotta (L* 48-46) give
  // the darkest, heaviest role a 35-point value gap below the walls.
  b.texture([PX0 - 1, 0, PZ0 - 1], [PX1 + 1, F + 2, PZ1 + 3], ['polished_granite', 'granite', 'terracotta'], { only: PLINTH, base: 0.35, edge: 0.2, noise: 0.3, scale: 4, seed: 9 })
  // Domes: glazed turquoise, lighter (sun-bleached) at the crown, darker at the neck.
  b.texture([X0 - 4, WING_TOP, Z0 - 4], [X1 + 4, H - 1, Z1 + 4], ['prismarine_bricks', 'oxidized_cut_copper', 'dark_prismarine'], { only: DOME, base: 0.25, top: 0.25, edge: 0.05, noise: 0.15, scale: 3, drip: 0, seed: 10 })
  return b.finish({ name: 'desert-palace' })
}
