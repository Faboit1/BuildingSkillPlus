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

  // Horizontal disc. (b.disc skips the centre cells when no `inner` is given: its default
  // inner radius of -1 squares to 1, see notes, so this recipe rasterizes its own.)
  const disc = (cx, y, cz, r, paint) => b.fillWhere([cx - r, y, cz - r], [cx + r, y, cz + r], (x, yy, z) => (x - cx) ** 2 + (z - cz) ** 2 <= r * r, paint)

  // ------------------------------------------------------------------ 1 site
  // Sculpted dunes: a few big asymmetric mounds (long gentle windward back, short steep lee face)
  // around the edges, faded to a level zone that holds the palace, its forecourt, the market
  // street and the oasis. Noise alone gives lumpy hills; dunes need a directional profile.
  const DUNES = [
    // x, z, radius, height, angle of the lee side (radians, 0 = east)
    [4, 4, 18, 12, 0.7], [40, -4, 16, 8, 1.3], [72, -2, 17, 11, 1.1], [94, 20, 15, 9, 2.7],
    [-2, 40, 14, 10, 0.1], [2, 72, 14, 8, 0.3], [6, 96, 19, 10, -0.7], [94, 96, 19, 10, 3.7], [96, 66, 12, 7, 3.1],
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
  // Pavement: light sandstone flags with cut-sandstone joints on the 4-block column grid
  // (floors are painted before texturing so the podium ramp only touches the podium sides).
  const PAVE = (x, y, z) => {
    const gx = (x - COURT_W) % 4 === 0
    const gz = (z - COURT_N) % 4 === 0
    return gx && gz ? 'minecraft:chiseled_sandstone' : gx || gz ? 'minecraft:cut_sandstone' : 'minecraft:smooth_sandstone'
  }
  b.box([PX0 + 1, FLOOR, PZ0 + 1], [PX1 - 1, FLOOR, PZ1 - 1], PAVE)
  b.box([CX - 6, FLOOR, PZ1], [CX + 6, FLOOR, PZ1 + 1], PAVE)

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
  for (const [a, c] of [[[COURT_W, COURT_N], [COURT_E, COURT_N]], [[COURT_W, COURT_S], [COURT_E, COURT_S]], [[COURT_W, COURT_N], [COURT_W, COURT_S]], [[COURT_E, COURT_N], [COURT_E, COURT_S]]])
    crenel(a, c, ARC_TOP + 1, { merlons: false }) // calm parapet on the court side: merlons face outward only

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
  for (let x = CX - PW + 3; x <= CX + PW - 3; x += 1) for (let y = F; y <= PISH_TOP - 3; y += 1) b.remove(x, y, PZF)
  cutArch([CX - 5, F, PZF - 1], 'south', { w: 11, spring: 10, depth: 4, k: 0.68, mat: TRIM, ring: 1, ringPaint: 'cut_sandstone' })
  // muqarnas hood: tiers of corbels stepping toward the viewer with height; inside a tier,
  // corbels (upside-down stairs) alternate with recessed cells, the honeycomb of a muqarnas.
  for (let y = F + 10; y <= PISH_TOP - 4; y += 1) {
    const tier = Math.min(3, Math.floor((y - F - 10) / 2))
    for (let x = CX - 5; x <= CX + 5; x += 1) {
      for (let k = 0; k <= tier; k += 1) {
        const z = HZ1 + 1 + k
        if (b.has(x, y, z)) continue
        const corbel = (x + y + k) % 2 === 0 || k < tier
        if (corbel) b.set(x, y, z, k < tier ? sl(TRIM, 'top') : st(TRIM, 'north', 'top'))
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

  // the pishtaq's back rises 11 blocks above the hall roof: pilasters with sloped caps and a
  // tile band keep that face from reading as a blank slab when seen from the north
  for (let x = CX - PW + 1; x <= CX + PW - 1; x += 1) {
    for (const y of [HALL_TOP + 2, HALL_TOP + 3]) if (b.nameAt(x, y, HZ1) !== 'minecraft:air') b.remove(x, y, HZ1)
    b.set(x, HALL_TOP + 1, HZ1, WALL)
  }
  for (const x of [CX - PW, CX - 5, CX, CX + 5, CX + PW]) {
    for (let y = HALL_TOP + 1; y <= PISH_TOP - 3; y += 1) b.set(x, y, HZ1, WALL)
    b.set(x, PISH_TOP - 2, HZ1, st(TRIM, 'south'))
  }

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

  // chhatris: little domed kiosks on the hall roof corners; they step the skyline down from
  // the drum to the parapet and give the roof something to hold at night (a lantern each)
  const CHHATRIS = [[HX0 + 3, Z0 + 3], [HX1 - 3, Z0 + 3], [HX0 + 3, HZ1 - 3], [HX1 - 3, HZ1 - 3]]
  for (const [cx, cz] of CHHATRIS) {
    for (let y = HALL_TOP + 1; y <= HALL_TOP + 3; y += 1) for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.set(cx + dx, y, cz + dz, 'sandstone_wall')
    b.box([cx - 1, HALL_TOP + 4, cz - 1], [cx + 1, HALL_TOP + 4, cz + 1], WALL)
    ringOf(cx, cz, HALL_TOP + 4, 1.5, 2.3, (dx, dz) => st(TRIM, kit.facingFrom(-dx, -dz), 'top'))
    const cap = [1.6, 1.2, 0.5]
    b.lathe([cx, HALL_TOP + 5, cz], cap.length, dy => cap[dy], DOME)
    b.set(cx, HALL_TOP + 8, cz, 'lightning_rod')
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
  const nicheAt = (facing, face, c, y, { w = 3, spring = 3, window = null, winY = [], k = 1, mat = TRIM } = {}) => {
    const off = (w - 1) / 2
    const alongX = facing === 'north' || facing === 'south'
    const sign = facing === 'south' || facing === 'west' ? -1 : 1 // left jamb is at c - off for S/W faces
    const left = c + sign * off
    const o = alongX ? [left, y, face] : [face, y, left]
    cutArch(o, facing, { w, spring, depth: 1, k, mat })
    if (window) {
      const n = DIR[facing]
      for (const wy of winY) {
        const p = alongX ? [c, wy, face - n[2]] : [face - n[0], wy, c]
        b.set(...p, typeof window === 'function' ? window(facing) : window)
      }
    }
  }
  // wooden mashrabiya screens: an open trapdoor on the outer side of the window cell
  const GRILLE = facing => kit.trapdoor('jungle', opposite(facing), { open: true })
  const LATTICE = 'minecraft:waxed_oxidized_copper_grate' // teal lattice for the hero hall
  // great hall: two tiers of five niches on the north face, clerestory windows above the wings
  for (const c of [CX - 10, CX - 5, CX, CX + 5, CX + 10]) {
    nicheAt('north', Z0, c, F + 1, { spring: 4, window: LATTICE, winY: [F + 2, F + 3] })
    nicheAt('north', Z0, c, F + 8, { spring: 1, window: LATTICE, winY: [F + 9, F + 10] })
  }
  for (const c of [HCZ - 8, HCZ - 4, HCZ, HCZ + 4, HCZ + 8]) {
    nicheAt('west', HX0, c, WING_TOP + 1, { w: 1, spring: 2, k: 1, window: LATTICE, winY: [WING_TOP + 1, WING_TOP + 2] })
    nicheAt('east', HX1, c, WING_TOP + 1, { w: 1, spring: 2, k: 1, window: LATTICE, winY: [WING_TOP + 1, WING_TOP + 2] })
  }
  for (const c of [CX - 11, CX + 11]) nicheAt('south', HZ1, c, F + 8, { spring: 1, window: LATTICE, winY: [F + 9, F + 10] })
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
    nicheAt('north', PZ0, x, G + 1, { spring: 0, mat: 'granite' })
    if (Math.abs(x - CX) > 8) nicheAt('south', PZ1, x, G + 1, { spring: 0, mat: 'granite' })
  }
  for (let z = HCZ - 5; z <= Z1 - 7; z += 5) {
    nicheAt('west', PX0, z, G + 1, { spring: 0, mat: 'granite' })
    nicheAt('east', PX1, z, G + 1, { spring: 0, mat: 'granite' })
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
  disc(FX, FLOOR + 1, FZ, 2.6, 'smooth_sandstone')
  disc(FX, FLOOR + 1, FZ, 1.6, 'water')
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
  b.texture([PX0 - 1, 0, PZ0 - 1], [PX1 + 1, F + 2, PZ1 + 3], ['granite', 'terracotta', 'terracotta'], { only: PLINTH, base: 0.35, edge: 0.2, noise: 0.3, scale: 4, seed: 9 })
  // Domes: glazed turquoise, lighter (sun-bleached) at the crown, darker at the neck.
  b.texture([X0 - 4, WING_TOP, Z0 - 4], [X1 + 4, H - 1, Z1 + 4], ['prismarine_bricks', 'oxidized_cut_copper', 'dark_prismarine'], { only: DOME, base: 0.25, top: 0.25, edge: 0.05, noise: 0.15, scale: 3, drip: 0, seed: 10 })

  // Smooth the voxel steps of every dome into stairs of the same material (after texturing,
  // because the wool placeholder has no stairs): bottom stairs on the upper slopes, upside-down
  // stairs under the bulb's overhang. The tall side always faces the dome's axis.
  const smoothDome = (cx, cz, y0, y1, r) => {
    const cells = []
    for (let y = y0; y <= y1; y += 1)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1)
        for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z += 1) {
          const blk = b.get(x, y, z)
          if (!blk || !/(prismarine|copper)/.test(blk.name) || /_(stairs|slab)$/.test(blk.name)) continue
          const dx = x - cx
          const dz = z - cz
          if (dx === 0 && dz === 0) continue
          const out = DIR[kit.facingFrom(dx, dz)]
          if (b.has(x + out[0], y, z + out[2])) continue
          const up = b.has(x, y + 1, z)
          const down = b.has(x, y - 1, z)
          const inward = kit.facingFrom(-dx, -dz)
          const stairs = kit.material(blk.name.replace('minecraft:', '')).stairs
          if (!up && down) cells.push([x, y, z, `${stairs}[facing=${inward},half=bottom]`])
          else if (up && !down) cells.push([x, y, z, `${stairs}[facing=${inward},half=top]`])
        }
    for (const [x, y, z, blk] of cells) b.set(x, y, z, blk)
  }
  smoothDome(CX, HCZ, DOME_Y, DOME_TOP, 10.5)
  for (const [cx, cz] of CHHATRIS) smoothDome(cx, cz, HALL_TOP + 5, HALL_TOP + 7, 2)
  for (const cx of [CX - 18, CX + 18]) smoothDome(cx, HCZ, WING_TOP + 3, WING_TOP + 12, 4.5)
  for (const [mx, mz] of MINARETS) smoothDome(mx, mz, F + 36, F + 41, 3)
  // Pattern the tilework structurally instead of leaving it to noise: a field of deep teal
  // (oxidized cut copper) with 16 lighter ribs (prismarine bricks) running to the finial and a
  // dark band at the neck. Shapes are kept: a stair stays a stair of the new material.
  const retile = (cx, cz, y0, y1, r, ribs) => {
    for (let y = y0; y <= y1; y += 1)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1)
        for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z += 1) {
          const blk = b.get(x, y, z)
          if (!blk || !/(prismarine|oxidized_cut_copper)/.test(blk.name)) continue
          const u = ((Math.atan2(z - cz, x - cx) / TAU + 1) * ribs) % 1
          const rr = Math.max(1, Math.hypot(x - cx, z - cz))
          const rib = ribs > 0 && Math.min(u, 1 - u) < 0.55 / ((TAU * rr) / ribs)
          const fam = y < y0 + 2 ? 'dark_prismarine' : rib ? 'prismarine_bricks' : 'oxidized_cut_copper'
          const m = kit.material(fam)
          const kind = /_stairs$/.test(blk.name) ? 'stairs' : /_slab$/.test(blk.name) ? 'slab' : 'block'
          b.set(x, y, z, { name: m[kind], props: blk.props })
        }
  }
  retile(CX, HCZ, DOME_Y, DOME_TOP, 10.5, 16)
  for (const cx of [CX - 18, CX + 18]) retile(cx, HCZ, WING_TOP + 3, WING_TOP + 12, 4.5, 0)
  for (const [mx, mz] of MINARETS) retile(mx, mz, F + 36, F + 41, 3, 0)
  for (const [cx, cz] of CHHATRIS) retile(cx, cz, HALL_TOP + 4, HALL_TOP + 8, 2, 0)

  if (!at('detail')) return b.finish({ name: 'desert-palace' })

  // ------------------------------------------------------------------ 12 tilework (one teal hue)
  // Glazed terracotta rotated per cell makes the zellige motif; used only on the hero elements
  // (pishtaq frame, drum, hall frieze, minaret rings), never on the plain fabric.
  const TILE = (x, y, z) => `minecraft:cyan_glazed_terracotta[facing=${['north', 'east', 'south', 'west'][((x + z) & 1) * 2 + (y & 1)]}]`
  // alfiz: the tile band framing the iwan
  for (let y = F + 1; y <= PISH_TOP - 2; y += 1) {
    b.set(CX - PW + 2, y, PZF, TILE)
    b.set(CX + PW - 2, y, PZF, TILE)
  }
  for (let x = CX - PW + 2; x <= CX + PW - 2; x += 1) b.set(x, PISH_TOP - 2, PZF, TILE)
  // spandrels: carved stucco (chiseled sandstone) with a tile rosette in each
  for (let x = CX - PW + 3; x <= CX + PW - 3; x += 1)
    for (let y = F + 10; y <= PISH_TOP - 3; y += 1) {
      const blk = b.get(x, y, PZF - 1)
      if (blk && /sandstone$/.test(blk.name) && blk.name !== 'minecraft:cut_sandstone') b.set(x, y, PZF - 1, 'chiseled_sandstone')
    }
  for (const x of [CX - 5, CX + 5]) b.set(x, PISH_TOP - 4, PZF - 1, TILE)
  // zellige dado inside the iwan and the gate passage
  for (let y = F; y <= F + 1; y += 1) {
    for (let z = HZ1 + 1; z <= PZF - 1; z += 1) {
      b.set(CX - 6, y, z, TILE)
      b.set(CX + 6, y, z, TILE)
    }
    for (let x = CX - 5; x <= CX + 5; x += 1) if (b.has(x, y, HZ1)) b.set(x, y, HZ1, TILE)
  }
  // mashrabiya over the hall door, lit from inside at night
  b.box([CX - 2, F + 6, HZ1 - 1], [CX + 2, F + 8, HZ1], LATTICE)
  // hall frieze under the parapet, gate band, drum band, minaret rings
  for (let x = HX0; x <= HX1; x += 1) b.set(x, HALL_TOP, Z0, TILE)
  for (let z = Z0; z <= HZ1; z += 1) {
    b.set(HX0, HALL_TOP, z, TILE)
    b.set(HX1, HALL_TOP, z, TILE)
  }
  for (const x of [HX0, HX0 + 1, HX0 + 2, HX0 + 3, HX1, HX1 - 1, HX1 - 2, HX1 - 3]) b.set(x, HALL_TOP, HZ1, TILE)
  for (let x = GX0 + 2; x <= GX1 - 2; x += 1) b.set(x, GATE_TOP - 1, GZF, TILE)
  ringOf(CX, HCZ, DRUM_Y + 6, 6.5, 7.5, () => TILE)
  for (let k = 0; k < 12; k += 1) {
    const a = (k / 12) * TAU
    const x = Math.round(CX + 6.6 * Math.cos(a))
    const z = Math.round(HCZ + 6.6 * Math.sin(a))
    for (let y = DRUM_Y + 2; y <= DRUM_Y + 4; y += 1) if (!b.has(x, y, z)) b.set(x, y, z, LATTICE)
  }
  for (const [mx, mz] of MINARETS) {
    for (const y of [F + 9, F + 15, F + 28]) ringOf(mx, mz, y, y > F + 20 ? 1.2 : 1.6, y > F + 20 ? 2.0 : 2.5, () => TILE)
  }

  // ------------------------------------------------------------------ 13 interiors
  // Great hall: a fountain under the dome (as in the Alhambra's Hall of the Abencerrajes),
  // a runner from the iwan door to a throne dais, a lantern chandelier hanging from the dome.
  const HFLOOR = (x, y, z) => {
    const d = Math.hypot(x - CX, z - HCZ)
    if (d > 5.5 && d <= 6.5) return TILE(x, y, z)
    return (x + z) % 2 === 0 ? 'minecraft:smooth_sandstone' : 'minecraft:cut_sandstone'
  }
  b.box([HX0 + 2, FLOOR, Z0 + 2], [HX1 - 2, FLOOR, HZ1 - 2], HFLOOR)
  disc(CX, F, HCZ, 2.6, 'smooth_sandstone')
  disc(CX, F, HCZ, 1.6, 'water')
  b.set(CX, F, HCZ, 'chiseled_sandstone')
  b.set(CX, F + 1, HCZ, 'sandstone_wall') // spout (open water here would spill over the low rim)
  for (let z = HCZ + 3; z <= HZ1 - 2; z += 1) b.set(CX, F, z, 'cyan_carpet')
  for (let z = Z0 + 6; z <= HCZ - 3; z += 1) b.set(CX, F, z, 'cyan_carpet')
  b.box([CX - 4, F, Z0 + 2], [CX + 4, F, Z0 + 4], 'smooth_sandstone') // dais
  for (let x = CX - 4; x <= CX + 4; x += 1) b.set(x, F, Z0 + 5, st(TRIM, 'north'))
  b.box([CX - 3, F + 1, Z0 + 2], [CX + 3, F + 1, Z0 + 4], 'white_carpet')
  b.set(CX, F + 1, Z0 + 2, st('dark_oak', 'south'))
  b.set(CX - 1, F + 1, Z0 + 2, kit.trapdoor('dark_oak', 'west', { open: true }))
  b.set(CX + 1, F + 1, Z0 + 2, kit.trapdoor('dark_oak', 'east', { open: true }))
  b.set(CX, F + 2, Z0 + 2, 'dark_oak_trapdoor[facing=south,half=top,open=true]')
  for (const x of [CX - 3, CX + 3]) {
    b.set(x, F + 1, Z0 + 2, 'dark_oak_fence')
    b.set(x, F + 2, Z0 + 2, 'lantern')
  }
  // low divans along the side walls: stairs as benches facing the fountain
  for (let z = Z0 + 6; z <= HZ1 - 4; z += 1) {
    if (Math.abs(z - HCZ) <= 1 || (z - Z0 - 2) % 4 === 0) continue // between the engaged columns
    b.set(HX0 + 3, F, z, st('dark_oak', 'west'))
    b.set(HX1 - 3, F, z, st('dark_oak', 'east'))
  }
  // An applied arcade round the hall's inner walls: engaged columns every 4 blocks, pointed
  // heads of upside-down stairs, a frieze course above. It gives the 23-wide walls the bay
  // rhythm of the courtyard (and stops the inspector's flat-wall warnings on the interior).
  const innerArcade = (axis, fixed, a, c, wallDir, skip = () => false) => {
    for (let u = a; u <= c; u += 1) {
      if (skip(u)) continue
      const at = (y, paint) => (axis === 'x' ? b.set(u, y, fixed, paint) : b.set(fixed, y, u, paint))
      const k = (u - a) % 4
      const along = axis === 'x' ? ['west', 'east'] : ['north', 'south']
      if (k === 0) {
        at(F, 'cut_sandstone')
        for (let y = F + 1; y <= F + 4; y += 1) at(y, 'sandstone_wall')
        at(F + 5, 'chiseled_sandstone')
        at(F + 6, 'smooth_sandstone')
      } else if (k === 1) at(F + 5, st(TRIM, along[0], 'top')), at(F + 6, 'smooth_sandstone')
      else if (k === 3) at(F + 5, st(TRIM, along[1], 'top')), at(F + 6, 'smooth_sandstone')
      else at(F + 6, sl(TRIM, 'top'))
      at(F + 7, st(TRIM, wallDir, 'top'))
    }
  }
  innerArcade('x', Z0 + 2, HX0 + 2, HX1 - 2, 'north', u => Math.abs(u - CX) <= 5)
  innerArcade('x', HZ1 - 2, HX0 + 2, HX1 - 2, 'south', u => Math.abs(u - CX) <= 3)
  innerArcade('z', HX0 + 2, Z0 + 2, HZ1 - 2, 'west', u => Math.abs(u - HCZ) <= 1)
  innerArcade('z', HX1 - 2, Z0 + 2, HZ1 - 2, 'east', u => Math.abs(u - HCZ) <= 1)
  // doors between the hall and the wings
  cutArch([HX0, F, HCZ + 1], 'west', { w: 3, spring: 3, depth: 2, k: 1, mat: TRIM })
  cutArch([HX1, F, HCZ - 1], 'east', { w: 3, spring: 3, depth: 2, k: 1, mat: TRIM })
  // wings: ground floors open to the north gallery; library (W) and stores (E); bedrooms above
  for (const [cx, dir] of [[CX - 18, 1], [CX + 18, -1]]) {
    cutArch([cx - 1, F, HZ1], 'south', { w: 3, spring: 2, depth: 2, k: 1, mat: TRIM })
    b.box([cx - 3, FLOOR, Z0 + 2], [cx + 3, FLOOR, HZ1 - 2], 'smooth_sandstone')
    b.stairway([cx - 3 * dir, F, Z0 + 6], 'north', 4, 'spruce', { fill: false }) // to the upper floor
    for (let i = 0; i < 4; i += 1) b.remove(cx - 3 * dir, F + 4, Z0 + 5 - i + 0)
  }
  // library
  for (let z = Z0 + 8; z <= HZ1 - 3; z += 1) if (Math.abs(z - HCZ) > 1 && (z - HCZ) % 5 !== 0) b.set(X0 + 2, F + 1, z, 'bookshelf')
  b.set(X0 + 4, F, HCZ - 4, 'lectern[facing=west]')
  b.set(X0 + 4, F, HCZ + 4, 'lectern[facing=west]')
  b.box([X0 + 4, F, HCZ - 1], [X0 + 4, F, HCZ + 1], st('spruce', 'west', 'top'))
  // stores
  for (let z = Z0 + 8; z <= HZ1 - 3; z += 2) b.set(X1 - 2, F, z, 'barrel[facing=up]')
  b.set(X1 - 2, F, HZ1 - 2, 'smoker[facing=west,lit=false]')
  b.set(X1 - 4, F, HZ1 - 2, 'cauldron')
  b.set(X1 - 2, F + 1, Z0 + 9, 'decorated_pot')
  // bedrooms
  for (const [x, wall, inward] of [[X0 + 3, 'west', 1], [X1 - 3, 'east', -1]]) {
    for (const z of [HCZ - 6, HCZ + 6]) b.set(x, F + 5, z, `cyan_bed[facing=${wall},part=foot]`) // finish() adds the head
    for (let z = HCZ - 4; z <= HCZ + 4; z += 1) b.set(x + inward, F + 5, z, 'white_carpet')
  }

  if (!at('final')) return b.finish({ name: 'desert-palace' })

  // ------------------------------------------------------------------ 14 landscape
  // Palm: the trunk curves away from upright (offset = bend * t^2) in bark-on-all-sides wood,
  // diagonal steps bridged so it reads solid. Fronds are long and one leaf wide: they rise from
  // the crown and droop (+1, +1, 0, 0, -1, -1, -2), with a single side leaf mid-frond; a broad
  // leafy fan reads as an oak from any distance. Cocoa pods hang under the crown as dates.
  const palm = (x, y, z, { height = 9, bend = 3, az, fronds = 7, seed = 0, fruit = true } = {}) => {
    const rng = kit.rng(seed * 31 + x * 7 + z * 13)
    const a = az ?? rng() * TAU
    const BARK = 'jungle_wood[axis=y]'
    let prev = [x, y, z]
    b.set(x, y, z, BARK)
    for (let i = 1; i < height; i += 1) {
      const t = i / (height - 1)
      const off = bend * t * t
      const p = [x + Math.round(off * Math.cos(a)), y + i, z + Math.round(off * Math.sin(a))]
      if (p[0] !== prev[0]) b.set(p[0], p[1] - 1, prev[2], BARK)
      if (p[2] !== prev[2]) b.set(p[0], p[1] - 1, p[2], BARK)
      b.set(...p, BARK)
      prev = p
    }
    const [tx, ty, tz] = prev
    const LEAF = 'jungle_leaves'
    b.set(tx, ty + 1, tz, LEAF)
    if (height > 4) b.set(tx, ty + 2, tz, LEAF) // the young spear leaf
    const drop = [1, 1, 0, 0, -1, -1, -2, -3]
    const a0 = rng() * TAU
    for (let f = 0; f < fronds; f += 1) {
      const af = a0 + (f / fronds) * TAU + rng.range(-0.2, 0.2)
      const L = rng.int(4, 7)
      let last = [tx, ty + 1, tz]
      for (let k = 1; k <= L; k += 1) {
        const fx = tx + Math.round(k * Math.cos(af))
        const fz = tz + Math.round(k * Math.sin(af))
        const fy = ty + drop[k - 1]
        if (fx !== last[0] && fz !== last[2]) b.set(fx, last[1], last[2], LEAF, { keep: true }) // keep the frond face-connected
        if (fy < last[1]) b.set(fx, last[1], fz, LEAF, { keep: true })
        b.set(fx, fy, fz, LEAF, { keep: true })
        if (k === 3 || (k === 4 && L >= 6)) {
          const side = rng.chance(0.5) ? 1 : -1
          b.set(fx + side * Math.round(-Math.sin(af)), fy, fz + side * Math.round(Math.cos(af)), LEAF, { keep: true })
        }
        last = [fx, fy, fz]
      }
    }
    if (fruit) for (const [dx, dz, facing] of [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'north'], [0, -1, 'south']])
      if (rng.chance(0.6) && !b.has(tx + dx, ty - 1, tz + dz)) b.set(tx + dx, ty - 1, tz + dz, `cocoa[age=2,facing=${facing}]`)
  }
  const surface = (x, z) => b.topY(x, z, blk => !/(leaves|log|wood|cocoa|grass$|fern|bush|cane|lily)/.test(blk.name))

  // The oasis: a spring-fed pool in a dip east of the palace, rimmed by a green ring that fades
  // through coarse dirt back into sand (lush centre -> barren edge).
  const oasisD = (x, z) => Math.hypot(x - OASIS.x, (z - OASIS.z) * 0.85) / (OASIS.r * (1 + 0.2 * kit.noise.fbm2(x, z, { scale: 7, seed: 21 })))
  const SHORE = kit.gradient(['grass_block', 'grass_block', 'coarse_dirt', 'sand'], { t: (x, y, z) => (oasisD(x, z) - 1.1) / 1.0, dither: 0.8, scale: 2 })
  for (let x = OASIS.x - 18; x <= OASIS.x + 18; x += 1)
    for (let z = OASIS.z - 20; z <= OASIS.z + 20; z += 1) {
      if (x >= W || z >= D || x < 0 || z < 0) continue
      const d = oasisD(x, z)
      if (d > 2.2) continue
      const top = b.topY(x, z)
      if (d < 1) {
        const bottom = G - 1 - Math.max(1, Math.round(3 * (1 - d * d)))
        for (let y = bottom + 1; y <= top; y += 1) b.remove(x, y, z)
        b.set(x, bottom, z, d > 0.7 ? 'sand' : 'clay')
        for (let y = bottom + 1; y <= G - 1; y += 1) b.set(x, y, z, 'water')
      } else if (d < 1.1) {
        for (let y = G; y <= top; y += 1) b.remove(x, y, z)
        b.set(x, G - 1, z, 'mud')
      } else {
        const p = SHORE(x, top, z)
        if (p !== 'sand') b.set(x, top, z, p)
      }
    }

  // Market street: paved flags with granite curbs (the podium stone) from the stair to the edge.
  const ST0 = PZ1 + 7
  for (let z = ST0; z < D; z += 1)
    for (let x = CX - 3; x <= CX + 3; x += 1) {
      const y = surface(x, z)
      b.set(x, y, z, Math.abs(x - CX) === 3 ? 'polished_granite' : kit.palette({ smooth_sandstone: 5, cut_sandstone: 2, sandstone: 2 }, { scale: 2, seed: 5 }))
    }
  // trodden tracks: from the street to the oasis, and round the west side of the podium
  b.path([[CX + 4, ST0 + 4], [CX + 14, ST0 + 2], [64, 72], [72, 62], [76, 55]], { width: 2, paint: kit.palette({ packed_mud: 3, sand: 3, coarse_dirt: 1 }, { scale: 2 }), seed: 3 })
  b.path([[CX - 4, ST0 + 6], [CX - 16, ST0 + 4], [14, 68], [12, 50]], { width: 2, paint: kit.palette({ packed_mud: 2, sand: 4, coarse_dirt: 1 }, { scale: 2 }), seed: 4 })

  // Palms: a grove round the pool, an avenue along the street, four in the court beds, a few
  // strays on the dunes. Three sizes; trunks lean in different directions.
  const PALMS = [
    // x, z, height, bend, seed
    [70, 37, 11, 4, 1], [74, 54, 9, 3, 2], [86, 36, 10, 4, 3], [89, 50, 8, 3, 4], [84, 59, 12, 4, 5], [84, 31, 7, 2, 6], [72, 46, 6, 2, 7],
    [CX - 14, ST0 + 2, 10, 3, 8], [CX + 14, ST0 + 10, 9, 3, 9], [CX - 13, ST0 + 15, 8, 2, 10], [CX + 13, ST0 + 1, 7, 2, 15],
    [11, 58, 9, 3, 11], [8, 24, 7, 3, 12], [60, 84, 8, 3, 13], [26, 86, 9, 3, 14],
  ]
  for (const [x, z, h, bend, seed] of PALMS) palm(x, surface(x, z) + 1, z, { height: h, bend, seed })
  for (const bed of BEDS) palm(Math.round((bed.x0 + bed.x1) / 2), FLOOR + 1, Math.round((bed.z0 + bed.z1) / 2), { height: 7, bend: 1, seed: bed.x0 + bed.z0, fruit: false })
  // date and olive bushes: low clumps round the oasis and by the stalls
  for (const [x, z, kind] of [[76, 40, 0], [83, 54, 1], [68, 52, 1], [88, 43, 0], [78, 34, 1], [CX + 7, ST0 + 4, 1], [CX - 7, ST0 + 11, 0], [64, 30, 1], [24, 75, 0]]) {
    const y = surface(x, z) + 1
    if (kind === 0) palm(x, y, z, { height: 2, bend: 0, fronds: 6, seed: x + z, fruit: false })
    else b.bush([x, y, z], { radius: 1.5, leaves: ['azalea_leaves', 'oak_leaves', 'birch_leaves'], log: 'oak_log', seed: x * z })
  }
  // reeds and lilies at the water
  for (let x = OASIS.x - 12; x <= OASIS.x + 12; x += 1)
    for (let z = OASIS.z - 12; z <= OASIS.z + 12; z += 1) {
      const d = oasisD(x, z)
      const top = b.get(x, G - 1, z)
      if (d >= 1 && d < 1.1 && kit.hash01(x, 0, z, 5) < 0.35) for (let y = G; y < G + 1 + Math.floor(kit.hash01(x, 1, z, 6) * 3); y += 1) b.set(x, y, z, 'sugar_cane')
      if (top && top.name === 'minecraft:water' && d < 0.8 && kit.hash01(x, 2, z, 7) < 0.06) b.set(x, G, z, 'lily_pad')
    }

  // terrace balustrade on the podium edge, open at the stair landing
  const onEdge = (x, z) => {
    for (const [mx, mz] of MINARETS) if (Math.abs(x - mx) <= 3 && Math.abs(z - mz) <= 3) return false
    return true
  }
  for (let x = PX0; x <= PX1; x += 1) {
    if (onEdge(x, PZ0)) b.set(x, F, PZ0, 'sandstone_wall')
    if (onEdge(x, PZ1) && Math.abs(x - CX) > 6) b.set(x, F, PZ1, 'sandstone_wall')
  }
  for (let z = PZ0; z <= PZ1; z += 1) {
    if (onEdge(PX0, z)) b.set(PX0, F, z, 'sandstone_wall')
    if (onEdge(PX1, z)) b.set(PX1, F, z, 'sandstone_wall')
  }
  for (const x of [CX - 7, CX + 7]) for (let z = PZ1 + 1; z <= PZ1 + 2; z += 1) b.set(x, F, z, 'sandstone_wall')

  // Market stalls: four posts, a striped wool awning stepping down toward the street (fabric
  // reads as fabric when it sags), a counter of barrels with goods, a rug for the seller.
  const stall = (fx, z0, facing, [ca, cb], goods) => {
    const o = facing === 'east' ? 1 : -1 // toward the street
    const y = G + 1
    const xi = i => fx + o * (1 - i) // i = 0 overhang, 1 front, 4 back
    for (const z of [z0, z0 + 4]) {
      for (let k = 0; k < 3; k += 1) b.set(xi(1), y + k, z, 'jungle_fence')
      for (let k = 0; k < 4; k += 1) b.set(xi(4), y + k, z, 'jungle_fence')
    }
    for (let z = z0; z <= z0 + 4; z += 1) {
      const c = (z - z0) % 2 === 0 ? ca : cb
      b.set(xi(0), y + 2, z, `${c}_wool`)
      for (const i of [1, 2]) b.set(xi(i), y + 3, z, `${c}_wool`)
      for (const i of [3, 4]) b.set(xi(i), y + 4, z, `${c}_wool`)
    }
    for (let z = z0 + 1; z <= z0 + 3; z += 1) {
      b.set(xi(1), y, z, 'barrel[facing=up]')
      b.set(xi(2), y, z, `${goods.rug}_carpet`)
      b.set(xi(3), y, z, `${goods.rug}_carpet`)
    }
    goods.items.forEach((item, k) => item && b.set(xi(1), y + 1, z0 + 1 + k, item))
    if (goods.back) goods.back.forEach((item, k) => item && b.set(xi(4), y, z0 + 1 + k, item))
  }
  const ST_Z = [PZ1 + 9, PZ1 + 17]
  stall(CX - 5, ST_Z[0], 'east', ['cyan', 'white'], { rug: 'red', items: ['cyan_carpet', 'white_carpet', 'orange_carpet'], back: ['cyan_wool', 'white_wool', 'orange_wool'] })
  stall(CX - 5, ST_Z[1], 'east', ['orange', 'white'], { rug: 'cyan', items: ['orange_concrete_powder', 'yellow_concrete_powder', 'red_concrete_powder'], back: ['barrel[facing=up]', 'chest[facing=east]', 'barrel[facing=up]'] })
  stall(CX + 5, ST_Z[0], 'west', ['white', 'orange'], { rug: 'white', items: ['decorated_pot', 'potted_cactus', 'decorated_pot'], back: ['decorated_pot', 'flower_pot', 'decorated_pot'] })
  stall(CX + 5, ST_Z[1], 'west', ['white', 'cyan'], { rug: 'orange', items: ['lantern', 'hay_block', 'melon'], back: ['hay_block', 'composter', 'hay_block'] })

  // A caravan has come in to trade: a low striped goat-hair tent by the track to the oasis,
  // rugs and a chest inside, fodder and water jars outside, a fire at the door.
  const tent = (x0, z0) => {
    const y = G + 1
    for (let x = x0 - 1; x <= x0 + 5; x += 1) for (let z = z0 - 1; z <= z0 + 5; z += 1) {
      const top = b.topY(x, z)
      for (let yy = top + 1; yy <= G; yy += 1) b.set(x, yy, z, 'sand') // level the pitch
      for (let yy = G + 1; yy <= top; yy += 1) b.remove(x, yy, z)
    }
    for (const [x, z] of [[x0, z0], [x0, z0 + 4], [x0 + 4, z0], [x0 + 4, z0 + 4]]) for (let k = 0; k < 2; k += 1) b.set(x, y + k, z, 'jungle_fence')
    for (const z of [z0, z0 + 4]) for (let k = 0; k < 3; k += 1) b.set(x0 + 2, y + k, z, 'jungle_fence')
    for (let x = x0 - 1; x <= x0 + 5; x += 1)
      for (let z = z0; z <= z0 + 4; z += 1) {
        const ridge = x === x0 + 2
        const eave = x === x0 - 1 || x === x0 + 5
        b.set(x, ridge ? y + 3 : eave ? y + 1 : y + 2, z, (z - z0) % 2 === 0 ? 'brown_wool' : 'black_wool')
      }
    for (let z = z0; z <= z0 + 4; z += 1) b.set(x0 + 4, y, z, 'brown_wool') // closed back wall
    for (let x = x0; x <= x0 + 3; x += 1) for (let z = z0 + 1; z <= z0 + 3; z += 1) b.set(x, y, z, (x + z) % 2 ? 'red_carpet' : 'orange_carpet')
    b.set(x0 + 3, y, z0 + 2, 'chest[facing=west]')
    b.set(x0 - 2, y, z0 - 1, 'hay_block')
    b.set(x0 - 2, y + 1, z0 - 1, 'hay_block')
    b.set(x0 - 3, y, z0 - 1, 'hay_block')
    b.set(x0 - 2, y, z0 + 5, 'barrel[facing=up]')
    b.set(x0 - 3, y, z0 + 5, 'decorated_pot')
    b.set(x0 - 3, y, z0 + 2, 'campfire[lit=true]')
  }
  const CAMP = [74, 64]
  tent(...CAMP)

  // ground cover: dead bush and the odd cactus on the dunes, grass and ferns in the oasis ring,
  // roses and lilies in the court beds (after paths and trees, before props and lights)
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      const y = b.topY(x, z)
      if (y <= G + 1 || b.nameAt(x, y, z) !== 'minecraft:sand' || b.has(x, y + 1, z)) continue // dunes only, never the level ground
      const h = kit.hash01(x, y, z, 41)
      if (h < 0.012) b.set(x, y + 1, z, 'dead_bush')
      else if (h < 0.015 && y > G + 3) b.set(x, y + 1, z, 'cactus')
    }
  b.scatter({ x0: OASIS.x - 16, x1: W - 1, z0: OASIS.z - 18, z1: OASIS.z + 18, on: ['minecraft:grass_block'], density: 0.4, seed: 42, paints: [[8, 'short_grass'], [3, 'fern'], [1, 'tall_grass']] })
  b.scatter({ x0: COURT_W, x1: COURT_E, z0: COURT_N, z1: COURT_S, on: ['minecraft:grass_block'], density: 0.45, seed: 43, paints: [[6, 'short_grass'], [2, 'rose_bush'], [2, 'lily_of_the_valley'], [1, 'red_tulip']] })

  // ------------------------------------------------------------------ 15 lights (last: paths and scatter repaint the top block)
  // Hero brightest: a chandelier under the dome, a lantern in the iwan, rings of lanterns on
  // the minaret balconies; then a lantern in every gallery bay, braziers at the stair, lamps
  // along the street and under the awnings, a campfire at the oasis.
  const firstSolidAbove = (x, y, z) => {
    for (let yy = y; yy < H; yy += 1) if (b.has(x, yy, z)) return yy
    return null
  }
  const domeTop = firstSolidAbove(CX, HALL_TOP + 1, HCZ)
  if (domeTop) b.hangingLantern([CX, domeTop, HCZ], domeTop - (F + 8))
  for (const [dx, dz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) b.hangingLantern([CX + dx, HALL_TOP, HCZ + dz], 3)
  const iwanTop = firstSolidAbove(CX, F + 10, PZF - 2)
  if (iwanTop) b.hangingLantern([CX, iwanTop, PZF - 2], iwanTop - (F + 7))
  const gateTop = firstSolidAbove(CX, F + 5, Z1)
  if (gateTop) b.hangingLantern([CX, gateTop, Z1], 1)
  for (const [mx, mz] of MINARETS) {
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [2, -2], [-2, 2], [-2, -2]]) b.set(mx + dx, F + 22, mz + dz, 'lantern')
    for (const [dx, dz] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) b.set(mx + dx, F + 33, mz + dz, 'lantern')
    b.hangingLantern([mx, F + 35, mz], 0)
  }
  for (const [cx, cz] of CHHATRIS) b.hangingLantern([cx, HALL_TOP + 4, cz], 0)
  for (const bed of BEDS) {
    const x = bed.x0 < CX ? bed.x1 + 1 : bed.x0 - 1
    const z = bed.z0 < CROSS_Z ? bed.z1 + 1 : bed.z0 - 1
    b.set(x, F, z, 'sandstone_wall')
    b.set(x, F + 1, z, 'lantern')
  }
  for (let z = COURT_N + 2; z < COURT_S; z += 4) {
    b.hangingLantern([galW, ARC_TOP, z], 0)
    b.hangingLantern([galE, ARC_TOP, z], 0)
  }
  for (const x of SOUTH_BAYS) b.hangingLantern([x + 1, ARC_TOP, galS], 0)
  for (const x of [COURT_W + 2, COURT_W + 6, COURT_E - 6, COURT_E - 2]) b.hangingLantern([x, ARC_TOP, galN], 0)
  for (const [x, z] of [[POOL.x0 - 1, POOL.z0 - 1], [POOL.x1 + 1, POOL.z0 - 1], [POOL.x0 - 1, POOL.z1 + 1], [POOL.x1 + 1, POOL.z1 + 1]]) {
    b.set(x, F, z, 'sandstone_wall')
    b.set(x, F + 1, z, 'lantern')
  }
  for (const x of [CX - 7, CX + 7]) {
    b.set(x, G + 1, PZ1 + 7, 'chiseled_sandstone')
    b.set(x, G + 2, PZ1 + 7, 'campfire[lit=true]')
  }
  for (const x of [CX - 7, CX + 7]) b.set(x, F + 1, PZ1 + 2, 'lantern')
  for (const [x, z] of [[PX0, PZ0 + 14], [PX0, PZ0 + 26], [PX0, PZ0 + 38], [PX0, PZ0 + 50], [PX1, PZ0 + 14], [PX1, PZ0 + 26], [PX1, PZ0 + 38], [PX1, PZ0 + 50], [CX - 12, PZ1], [CX + 12, PZ1], [CX - 12, PZ0], [CX + 12, PZ0]]) {
    b.set(x, F, z, 'chiseled_sandstone')
    b.set(x, F + 1, z, 'lantern')
  }
  for (const z of [PZ1 + 13, PZ1 + 21]) for (const x of [CX - 4, CX + 4]) b.lampPost([x, G + 1, z], { height: 3, post: 'jungle_fence', foot: 'sandstone_wall' })
  for (const z of ST_Z) {
    b.hangingLantern([CX - 6, G + 4, z + 2], 0)
    b.hangingLantern([CX + 6, G + 4, z + 2], 0)
  }
  b.lampPost([OASIS.x - 9, surface(OASIS.x - 9, OASIS.z - 6) + 1, OASIS.z - 6], { height: 3, post: 'jungle_fence', foot: 'sandstone_wall' })
  return b.finish({ name: 'desert-palace' })
}
