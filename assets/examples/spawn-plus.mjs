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
  const SPAWN = [AX, CRN + 2, 59] // spawn dais top block; players stand at y 38, eye 39.6

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
  const FIELD = 'minecraft:polished_andesite' // paving field (mid value, so the white architecture pops)

  // ------------------------------------------------------------------ 1 site: terraces
  // Four terraces step down a hill to a bay: the crown (vault, hall of fame, spawn), the plaza
  // (hero, exchange, duels), the market street and the quay. Terrace edges jog per district.
  const crownS = x => (x < 82 ? 64 : x <= 128 ? 66 : 64) // last crown row (south edge)
  const crownN = x => (x < 84 ? 34 : x <= 126 ? 40 : 32) // first crown row: the cliff with the vault
  const MKT_N = 110 // first market row (the plaza wall face is z = 109)
  const QUAY_N = 133
  const QUAY_S = 144 // last quay row; water beyond
  const level = (x, z) => {
    if (z >= crownN(x) && z <= crownS(x) && x >= 28 + Math.max(0, 40 - z) * 0.3 && x <= 186) return x >= 130 ? SHELF : CRN
    if (z > crownS(x) && z < MKT_N && x >= 40 && x <= 190) return PLZ
    if (z >= MKT_N && z < QUAY_N && x >= 32 + (z - MKT_N) * 0.4 && x <= 180 - (z - MKT_N) * 0.3) return MKT
    if (z >= QUAY_N && z <= QUAY_S && x >= 46 + Math.max(0, 6 - (z - QUAY_N)) && x <= 168) return QUAY
    return null
  }

  // natural ground: a hill sloping south with a crest behind the vault, two headlands
  // embracing the bay (the east one higher, with cliffs)
  const hill = (x, z) => {
    let h = 9 + 37 * (1 - smooth(0, 150, z)) ** 1.15 + 7 * (1 - smooth(10, 46, z))
    h += 11 * Math.exp(-(((x - AX) / 34) ** 4)) * (1 - smooth(26, 41, z)) // the rock the vault is cut into
    h += 10 * Math.exp(-(((x - 8) / 22) ** 2)) * smooth(90, 175, z)
    h += 18 * Math.exp(-(((x - 202) / 20) ** 2)) * smooth(70, 170, z)
    h += 2.6 * fbm(x, z, 30, 3) + 1.2 * fbm(x, z, 11, 4)
    return h
  }
  // the bay: a basin south of the quay, closed at the canvas edge by the old mole
  const bayDepth = (x, z) => {
    const rx = 64 - 22 * smooth(156, 206, z) + 5 * fbm(z, 7, 16, 9)
    const ax = 1 - Math.abs(x - 108 - 6 * smooth(156, 206, z)) / rx
    const az = (z - QUAY_S - 1 + 3 * fbm(x, 3, 14, 8)) / 36
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

  // Arch heads at half-block resolution (ported from desert-palace.mjs): each cell of the head is
  // sampled at 4 points; 3-4 inside → open, the bottom pair → top slab, an inner bottom quarter
  // → upside-down stair, an inner top quarter → bottom stair. k = 0.5 is a semicircle, k > 0.5
  // a pointed two-centred arch. Cells are relative to the springing (j = 0: first head row).
  const archHead = (w, k = 0.5) => {
    const a = w / 2
    const Rr = k * 2 * a
    const inside = (u, v) => {
      if (v < 0) return Math.abs(u) <= a
      const du = Math.abs(u) + Rr - a
      return du * du + v * v <= Rr * Rr && Math.abs(u) <= a
    }
    const cells = []
    const apex = Math.sqrt(Rr * Rr - (Rr - a) ** 2)
    for (let j = 0; j <= Math.ceil(apex) + 1; j += 1)
      for (let i = 0; i < w; i += 1) {
        const u = i - (w - 1) / 2
        const side = u < 0 ? -1 : u > 0 ? 1 : 0
        const inner = u === 0 ? 0 : -Math.sign(u) * 0.25
        const bi = inside(u + inner, j + 0.25)
        const bo = inside(u - inner, j + 0.25)
        const ti = inside(u + inner, j + 0.75)
        const to = inside(u - inner, j + 0.75)
        const n = bi + bo + ti + to
        let kind = null
        if (n >= 3) kind = 'air'
        else if (bi && bo) kind = 'slabTop'
        else if (ti && to) kind = 'slabBottom'
        else if (bi) kind = 'stairTop'
        else if (ti) kind = 'stairBottom'
        if (kind) cells.push({ i, j, kind, side })
      }
    return cells
  }
  // cut an arched opening into a face frame f (u right, v = absolute y, d outward): u0 = left
  // jamb, w wide, open rows y0..y0+spring-1, head above, from d = d0 inward `depth` layers
  const cutArch = (f, facing, u0, w, y0, spring, { depth = 1, d0 = 0, mat = 'smooth_quartz', k = 0.5, fill = 'air' } = {}) => {
    const left = cw(facing)
    const right = ccw(facing)
    for (let d = d0; d > d0 - depth; d -= 1) {
      for (let v = 0; v < spring; v += 1) for (let i = 0; i < w; i += 1) b.set(...f(u0 + i, y0 + v, d), fill)
      for (const c of archHead(w, k)) {
        const p = f(u0 + c.i, y0 + spring + c.j, d)
        const out = c.side < 0 ? left : right
        if (c.kind === 'air') b.set(...p, fill)
        else if (c.kind === 'slabTop') b.set(...p, sl(mat, 'top'))
        else if (c.kind === 'slabBottom') b.set(...p, sl(mat, 'bottom'))
        else if (c.kind === 'stairTop') b.set(...p, st(mat, c.side === 0 ? left : out, 'top'))
        else if (c.kind === 'stairBottom') b.set(...p, st(mat, c.side === 0 ? left : out, 'bottom'))
      }
    }
  }

  // ------------------------------------------------------------------ shared ground-level helpers
  const FIELD_ID = 'minecraft:polished_andesite'
  // paint the floor only where it is still the untouched field (buildings and features win)
  const pave = (x, y, z, p) => {
    if (b.nameAt(x, y, z) === FIELD_ID) b.set(x, y, z, p)
  }
  // worn desire paths: clumped andesite / stone / cobble along a polyline, densest on its centre
  const wear = (pts, y, width = 3, seed = 0) => {
    for (let i = 1; i < pts.length; i += 1) {
      const [ax, az] = pts[i - 1]
      const [cx, cz] = pts[i]
      const n = Math.ceil(Math.hypot(cx - ax, cz - az))
      for (let k = 0; k <= n; k += 1) {
        const px = ax + ((cx - ax) * k) / n
        const pz = az + ((cz - az) * k) / n
        for (let x = Math.floor(px - width); x <= Math.ceil(px + width); x += 1)
          for (let z = Math.floor(pz - width); z <= Math.ceil(pz + width); z += 1) {
            const d = Math.hypot(x - px, z - pz) / width
            if (d > 1) continue
            const t = kit.noise.coherent01(x, 0, z, { scale: 2.5, seed: 70 + seed }) * (1 - d * 0.8)
            if (t > 0.55) pave(x, y, z, t > 0.75 ? 'cobblestone' : t > 0.65 ? 'stone' : 'andesite')
          }
      }
    }
  }
  // a straight stair flight descending toward `dir` from level hi to level lo; `at(k)` gives the
  // [x, z] origin of row k, `across` the cells across the flight; a landing after `landingAfter`
  const flight = (cellsOf, dir, hi, lo, { landingAfter = 0, landing = 2, mat = 'stone_brick', clearTo } = {}) => {
    const up = opposite(dir)
    let y = hi - 1
    let k = 0
    let row = 0
    while (y > lo) {
      for (const [x, z] of cellsOf(row)) {
        b.box([x, Math.max(0, lo - 1), z], [x, y - 1, z], 'stone')
        b.set(x, y, z, st(mat, up))
        b.clear([x, y + 1, z], [x, clearTo ?? hi + 3, z])
      }
      row += 1
      k += 1
      if (landingAfter && k === landingAfter)
        for (let j = 0; j < landing; j += 1) {
          for (const [x, z] of cellsOf(row)) {
            b.box([x, Math.max(0, lo - 1), z], [x, y, z], 'stone')
            b.set(x, y, z, 'polished_andesite')
            b.clear([x, y + 1, z], [x, clearTo ?? hi + 3, z])
          }
          row += 1
        }
      y -= 1
    }
    return row
  }
  // benches: stair seats with trapdoor arms, `n` long, facing `facing` (the way a sitter looks)
  const bench = (x, y, z, facing, n = 3, wood = 'dark_oak') => {
    const r = DIR[ccw(facing)]
    for (let k = 0; k < n; k += 1) b.set(x + r[0] * k, y, z + r[2] * k, st(wood, opposite(facing)))
    b.set(x - r[0], y, z - r[2], `${wood}_trapdoor[facing=${cw(facing)},open=true,half=bottom]`)
    b.set(x + r[0] * n, y, z + r[2] * n, `${wood}_trapdoor[facing=${ccw(facing)},open=true,half=bottom]`)
  }
  // street lamps in three designs (never more than a few of one kind in a view)
  const lamp = (x, y, z, kind = 'post', facing = 'north') => {
    if (kind === 'post') {
      b.set(x, y, z, 'polished_deepslate')
      b.set(x, y + 1, z, 'polished_deepslate_wall')
      b.set(x, y + 2, z, 'dark_oak_fence')
      b.set(x, y + 3, z, 'dark_oak_fence')
      b.set(x, y + 4, z, 'lantern[hanging=false]')
    } else if (kind === 'arm') {
      const d = DIR[facing]
      b.set(x, y, z, 'polished_deepslate_wall')
      for (let k = 1; k <= 3; k += 1) b.set(x, y + k, z, 'dark_oak_fence')
      b.set(x, y + 4, z, sl('dark_oak', 'top'))
      b.set(x + d[0], y + 4, z + d[2], 'dark_oak_trapdoor[facing=' + facing + ',half=top,open=false]')
      b.set(x + d[0], y + 3, z + d[2], 'lantern[hanging=true]')
    } else if (kind === 'candelabra') {
      b.set(x, y, z, 'polished_deepslate')
      for (let k = 1; k <= 4; k += 1) b.set(x, y + k, z, k === 1 ? 'polished_deepslate_wall' : 'dark_oak_fence')
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        b.set(x + dx, y + 4, z + dz, 'dark_oak_fence')
        b.set(x + dx, y + 3, z + dz, 'lantern[hanging=true]')
      }
      b.set(x, y + 5, z, 'lantern[hanging=false]')
    } else if (kind === 'bollard') {
      b.set(x, y, z, 'polished_deepslate_wall')
      b.set(x, y + 1, z, 'lantern[hanging=false]')
    }
  }
  // a planter box with spill-over: trim kerb, soil, moss, two heights of flowers, a fern or two
  const planter = (x0, z0, x1, z1, y, { kerb = 'polished_deepslate', cap = 'smooth_quartz', flowers = ['azure_bluet', 'cornflower', 'oxeye_daisy', 'lily_of_the_valley', 'allium'], seed = 0, tall = true } = {}) => {
    for (let x = x0; x <= x1; x += 1)
      for (let z = z0; z <= z1; z += 1) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1
        if (edge) {
          b.set(x, y, z, kerb)
          b.set(x, y + 1, z, sl(cap))
        } else {
          b.set(x, y, z, 'dirt')
          b.set(x, y + 1, z, 'grass_block')
          const r = hash(x, y, z, seed + 3)
          if (r < 0.28) b.set(x, y + 2, z, 'moss_carpet')
          else if (r < 0.62) b.set(x, y + 2, z, flowers[Math.floor(hash(x, z, y, seed) * flowers.length)])
          else if (r < 0.74) b.set(x, y + 2, z, 'fern')
          else if (tall && r < 0.82) {
            b.set(x, y + 2, z, 'peony[half=lower]')
            b.set(x, y + 3, z, 'peony[half=upper]')
          }
        }
      }
  }

  const npcStyle = { primary: 'smooth_quartz', trim: TRIM, accent: ACC, glass: 'light_blue_stained_glass', light: 'pearlescent_froglight', backdrop: 'polished_blackstone' }
  // ------------------------------------------------------------------ 2 the hero: the Clock Gate
  // A two-storey gate front closes the plaza's south side and straddles the step down to the
  // market: the axis runs through its central arch as a vaulted stair (compression) and out onto
  // the market and the harbour view (release). Ground floor: five arches between pilasters (the
  // middle one the passage, the others a shaded loggia), windows in the outer bays; above, the
  // server name on a frieze band one storey tall; then the cornice and a balustraded roof.
  // The clock tower rises from the middle in stages that step in: clock (11) → belfry (9) →
  // balustrade with pinnacles → spire. The apex is set by the first view: from the spawn eye
  // (y 39.6, 48 blocks out) the pitch-5 frame tops out near y 67, so the finial ends near 66.
  const GX0 = 83
  const GX1 = 127
  const GZ0 = 102 // front face, on the plaza
  const GZ1 = 112 // back face, on the market
  const GTOP = 41 // gate cornice
  const TX0 = 100
  const TX1 = 110
  const TC = [105, 107] // tower centre
  const CLK = [GTOP + 4, GTOP + 10] // clock stage 45..51, dial centre y 48
  const BEL = [CLK[1] + 2, CLK[1] + 6] // belfry 53..57
  const PIERS = [83, 89, 95, 101, 109, 115, 121, 127] // pilaster lines (the middle bay is the passage)
  b.box([GX0, MKT - 1, GZ0], [GX1, GTOP, GZ1], WALL)
  b.box([GX0, MKT - 1, GZ0], [GX1, PLZ, GZ1], PLINTH)
  b.box([GX0 + 1, PLZ + 1, GZ0 + 4], [GX1 - 1, GTOP - 1, GZ1 - 1], 'stone') // core (hidden)
  const gateFaces = rectFaces(GX0, GZ0, GX1, GZ1)
  for (const { facing, w, f } of gateFaces) {
    const inward = opposite(facing)
    const base = facing === 'north' ? PLZ + 1 : MKT + 1
    // base course, water table, crowning cornice and a balustraded roof
    for (let u = -1; u <= w; u += 1) {
      b.set(...f(u, base, 1), st('deepslate_brick', inward), { keep: true })
      b.set(...f(u, GTOP, 1), st(TRIM, inward, 'top'))
    }
    for (let u = 0; u < w; u += 1) {
      b.set(...f(u, base, 0), 'deepslate_bricks')
      b.set(...f(u, GTOP, 0), TRIM)
      b.set(...f(u, GTOP - 1, 1), st('smooth_quartz', inward, 'top'))
      const post = u % 5 === 0 || u === w - 1
      b.set(...f(u, GTOP + 1, 0), post ? QZ : 'iron_bars')
      b.set(...f(u, GTOP + 2, 0), post ? 'polished_deepslate_wall' : sl('smooth_quartz'))
    }
    for (const u of [0, w - 1]) for (let y = base + 1; y < GTOP - 1; y += 1) b.set(...f(u, y, 1), (y - base) % 2 === 0 ? 'quartz_bricks' : QZ)
  }
  // plaza face: pilasters on the bay lines (full height on the outer four, under the frieze
  // on the inner four), five arches, a loggia behind the side arches, windows in the outer bays
  const NF = gateFaces[0].f // u = 0 at x 127, u grows west
  const ux = x => GX1 - x
  for (const x of PIERS) {
    const full = x <= 89 || x >= 121
    const top = full ? GTOP - 2 : PLZ + 8
    for (let y = PLZ + 2; y <= top; y += 1) b.set(x, y, GZ0 - 1, y === PLZ + 2 ? 'polished_deepslate' : y === top ? st('smooth_quartz', 'south', 'top') : 'quartz_pillar[axis=y]')
  }
  for (const [x0, w] of [[91, 3], [97, 3], [111, 3], [117, 3]]) cutArch(NF, 'north', ux(x0 + w - 1), w, PLZ + 1, 4, { depth: 2, mat: 'smooth_quartz' })
  b.clear([91, PLZ + 1, GZ0 + 1], [99, PLZ + 5, GZ0 + 2])
  b.clear([111, PLZ + 1, GZ0 + 1], [119, PLZ + 5, GZ0 + 2])
  for (const x0 of [91, 97, 111, 117]) {
    b.set(x0 + 1, PLZ + 5, GZ0, ACC) // keystones: points of the accent
    bench(x0, PLZ + 1, GZ0 + 2, 'north', 3)
  }
  for (const x of [95, 115]) hang(x, PLZ + 4, GZ0 + 1, 1)
  cutArch(NF, 'north', ux(107), 5, PLZ + 1, 6, { depth: 1, mat: 'smooth_quartz' })
  for (let x = 102; x <= 108; x += 1) b.set(x, PLZ + 10, GZ0 - 1, st(TRIM, 'south', 'top'))
  b.set(105, PLZ + 9, GZ0 - 1, ACC)
  for (const x0 of [85, 123]) {
    // outer bays: a tall recessed window below, a square one at the frieze level
    for (const [y0, hgt] of [[PLZ + 3, 4], [PLZ + 11, 3]]) {
      for (let x = x0; x <= x0 + 1; x += 1) for (let y = y0; y < y0 + hgt; y += 1) {
        b.set(x, y, GZ0, 'air')
        b.set(x, y, GZ0 + 1, 'gray_stained_glass_pane')
      }
      for (let x = x0 - 1; x <= x0 + 2; x += 1) {
        b.set(x, y0 - 1, GZ0 - 1, st(TRIM, 'south', 'top'))
        b.set(x, y0 + hgt, GZ0 - 1, sl(TRIM))
      }
      for (const x of [x0 - 1, x0 + 2]) for (let y = y0; y < y0 + hgt; y += 1) b.set(x, y, GZ0 - 1, 'dark_oak_trapdoor[facing=north,open=true,half=bottom]')
    }
  }
  // the vaulted stair passage: landing, seven steps down, landing, barrel vault, lanterns
  b.clear([103, MKT + 1, GZ0], [107, PLZ + 7, GZ1])
  for (let z = GZ0; z <= GZ1; z += 1) {
    const k = clamp(z - (GZ0 + 2), 0, 7)
    const y = PLZ - k
    for (let x = 103; x <= 107; x += 1) {
      b.box([x, MKT - 1, z], [x, y - 1, z], 'stone')
      b.set(x, y, z, z > GZ0 + 2 && z <= GZ0 + 9 ? st('stone_brick', 'north') : x === 105 ? 'polished_deepslate' : 'stone_bricks')
    }
    for (const x of [103, 107]) b.set(x, PLZ + 7, z, st('smooth_quartz', x === 103 ? 'west' : 'east', 'top'))
    for (const x of [102, 108]) b.set(x, PLZ + 6, z, z % 3 === 0 ? 'quartz_pillar[axis=y]' : QZ)
  }
  for (const z of [GZ0 + 2, GZ1 - 2]) hang(105, PLZ + 6, z, 1)
  // the market (south) face: a tall portal at the foot of the stair, shop arches in the wings
  const SF = gateFaces[1].f // u = 0 at x 83, u grows east
  cutArch(SF, 'south', 103 - GX0, 5, MKT + 1, 9, { depth: 1, mat: 'smooth_quartz' })
  for (const x of [101, 109]) for (let y = MKT + 1; y <= MKT + 12; y += 1) b.set(x, y, GZ1 + 1, y === MKT + 12 ? st(TRIM, 'north', 'top') : 'quartz_pillar[axis=y]')
  b.set(105, MKT + 12, GZ1, ACC)
  for (const x0 of [87, 93, 115, 121]) {
    cutArch(SF, 'south', x0 - GX0, 3, MKT + 1, 3, { depth: 3, mat: 'smooth_quartz' })
    b.box([x0, MKT + 1, GZ1 - 3], [x0 + 2, MKT + 4, GZ1 - 3], 'dark_oak_planks')
    b.set(x0 + 1, MKT + 1, GZ1 - 2, 'barrel[facing=south]')
    for (let y = MKT + 8; y <= MKT + 10; y += 1) b.set(x0 + 1, y, GZ1, 'gray_stained_glass_pane')
    b.set(x0 + 1, MKT + 7, GZ1 + 1, st(TRIM, 'north', 'top'))
    b.set(x0 + 1, MKT + 11, GZ1, sl(TRIM, 'top'))
  }
  // the name: on the frieze band, quartz letters standing one proud of a blackstone board that
  // is set into the wall, between a stair sill and a projecting cornice
  b.sign('HARBOR', [AX, PLZ + 15, GZ0 - 1], 'north', { align: 'center', board: DARK, frame: false, pad: 1, boardDepth: 2 })
  for (let x = 89; x <= 121; x += 1) {
    b.set(x, PLZ + 10, GZ0 - 1, st(TRIM, 'south', 'top'))
    b.set(x, PLZ + 17, GZ0 - 1, st('smooth_quartz', 'south', 'top'))
  }
  for (const x of [89, 121]) for (let y = PLZ + 11; y <= PLZ + 16; y += 1) b.set(x, y, GZ0 - 1, 'quartz_pillar[axis=y]')

  // the tower, stage 1: a plain plinth storey rising from the roof terrace
  b.box([TX0, GTOP + 1, GZ0], [TX1, CLK[0] - 1, GZ1], WALL)
  // stage 2: the clock (11 wide, a dial on every face, quoined corners)
  b.box([TX0, CLK[0], GZ0], [TX1, CLK[1], GZ1], WALL)
  b.clear([TX0 + 2, GTOP + 1, GZ0 + 2], [TX1 - 2, CLK[1], GZ1 - 2])
  for (const { facing, f } of rectFaces(TX0, GZ0, TX1, GZ1)) {
    const inward = opposite(facing)
    for (let u = -1; u <= 11; u += 1) b.set(...f(u, CLK[0] - 1, 1), st(TRIM, inward, 'top'))
    for (const u of [0, 10]) for (let y = CLK[0]; y <= CLK[1]; y += 1) b.set(...f(u, y, 1), (y - CLK[0]) % 2 === 0 ? 'quartz_bricks' : QZ)
    for (let y = GTOP + 1; y <= CLK[0] - 2; y += 1) b.set(...f(5, y, 0), 'gray_stained_glass_pane')
    const cy = (CLK[0] + CLK[1]) / 2
    for (let u = 2; u <= 8; u += 1)
      for (let y = CLK[0]; y <= CLK[1]; y += 1) {
        const du = u - 5
        const dv = y - cy
        const r = Math.hypot(du, dv)
        if (r > 3.4) continue
        if (r > 2.4) b.set(...f(u, y, 1), (du === 0 || dv === 0) && r > 2.9 ? ACC : 'polished_deepslate')
        else {
          const hand = (du === 0 && dv >= 1) || (dv === 0 && du <= -1)
          b.set(...f(u, y, 0), hand || (du === 0 && dv === 0) ? 'polished_blackstone' : 'white_concrete')
        }
      }
    for (let u = -1; u <= 11; u += 1) b.set(...f(u, CLK[1] + 1, 1), st(TRIM, inward, 'top'))
    for (let u = 0; u <= 10; u += 1) b.set(...f(u, CLK[1] + 1, 0), TRIM)
  }
  // stage 3: the belfry, set in by one, twin arched lights (bifora) with a column on every face
  b.box([TX0 + 1, BEL[0], GZ0 + 1], [TX1 - 1, BEL[1] + 1, GZ1 - 1], WALL)
  b.clear([TX0 + 2, BEL[0], GZ0 + 2], [TX1 - 2, BEL[1], GZ1 - 2])
  for (const { facing, f } of rectFaces(TX0 + 1, GZ0 + 1, TX1 - 1, GZ1 - 1)) {
    const inward = opposite(facing)
    for (const u0 of [2, 5]) cutArch(f, facing, u0, 2, BEL[0], 3, { depth: 2, mat: 'smooth_quartz' })
    for (let y = BEL[0]; y <= BEL[0] + 2; y += 1) b.set(...f(4, y, 0), 'quartz_pillar[axis=y]')
    for (let u = 1; u <= 7; u += 1) b.set(...f(u, BEL[0] - 1, 1), st('smooth_quartz', inward, 'top'))
    for (const u of [0, 8]) for (let y = BEL[0]; y <= BEL[1]; y += 1) b.set(...f(u, y, 1), 'quartz_pillar[axis=y]')
    for (let u = -1; u <= 9; u += 1) b.set(...f(u, BEL[1] + 1, 1), st(TRIM, inward, 'top'))
    b.set(...f(4, BEL[1], 0), ACC)
  }
  for (let x = TX0 + 2; x <= TX1 - 2; x += 1) b.set(x, BEL[1], TC[1], 'stripped_dark_oak_log[axis=x]')
  b.set(TC[0], BEL[1] - 1, TC[1], 'bell[attachment=ceiling,facing=north]')
  b.box([TX0 + 2, BEL[0] - 1, GZ0 + 2], [TX1 - 2, BEL[0] - 1, GZ1 - 2], 'dark_oak_planks')
  b.box([TX0 + 2, CLK[0] - 1, GZ0 + 2], [TX1 - 2, CLK[0] - 1, GZ1 - 2], 'dark_oak_planks')
  b.box([TX0 + 2, GTOP, GZ0 + 2], [TX1 - 2, GTOP, GZ1 - 2], 'dark_oak_planks')
  hang(TC[0], CLK[0] + 3, TC[1], CLK[1] - CLK[0] - 2)
  hang(TC[0], GTOP + 2, TC[1], 1)
  b.set(TC[0] + 1, BEL[0], TC[1] + 1, 'lantern[hanging=false]')
  // the crown: balustrade with corner pinnacles, a steep deepslate spire, a finial
  const SPY = BEL[1] + 2
  for (const { f } of rectFaces(TX0 + 1, GZ0 + 1, TX1 - 1, GZ1 - 1))
    for (let u = 0; u <= 8; u += 1) b.set(...f(u, SPY, 0), u === 0 || u === 8 ? 'quartz_pillar[axis=y]' : u === 4 ? QZ : 'iron_bars')
  for (const [x, z] of [[TX0 + 1, GZ0 + 1], [TX1 - 1, GZ0 + 1], [TX0 + 1, GZ1 - 1], [TX1 - 1, GZ1 - 1]]) {
    b.set(x, SPY + 1, z, 'quartz_pillar[axis=y]')
    b.set(x, SPY + 2, z, 'polished_deepslate_wall')
  }
  const spire = b.roof({ x0: TX0 + 2, z0: GZ0 + 2, x1: TX1 - 2, z1: GZ1 - 2, y: SPY, type: 'pyramid', material: ROOF, pitch: [1, 2, 2], overhang: 0, eaveTrim: false })
  b.set(TC[0], spire.topY + 1, TC[1], 'polished_deepslate_wall')
  b.set(TC[0], spire.topY + 2, TC[1], 'lightning_rod[facing=up]')

  // ------------------------------------------------------------------ blocking of the districts
  // CRATES VAULT: a treasury facade cut into the cliff behind the crown terrace, crates court in front
  // MARKET: stalls against the plaza wall (north side), shophouses (south side)
  const houses = [[36, 7, 3, 11], [44, 9, 2, 8], [54, 6, 3, 12], [61, 8, 2, 9], [70, 10, 3, 11], [81, 7, 2, 9], [89, 8, 3, 12], [113, 8, 2, 9], [122, 9, 3, 11], [132, 7, 2, 10], [140, 10, 3, 12], [151, 6, 2, 8], [158, 9, 3, 11], [168, 7, 2, 9]]
  for (const [x0, w, , h] of houses) {
    b.box([x0, QUAY + 1, 123], [x0 + w - 1, MKT + h, 131], WALL)
    b.roof({ x0, z0: 123, x1: x0 + w - 1, z1: 131, y: MKT + h + 1, type: 'gable', axis: w > 8 ? 'x' : 'z', material: ROOF, pitch: 1 })
  }
  // HARBOUR: RTP gate pavilion on the axis pier, a harbour master's house, the mole + light
  b.box([101, QUAY - 1, 145], [109, QUAY, 158], 'spruce_planks')
  b.box([102, QUAY + 1, 151], [108, QUAY + 9, 157], WALL)
  b.roof({ x0: 102, z0: 151, x1: 108, z1: 157, y: QUAY + 10, type: 'pyramid', material: ROOF, pitch: 1 })
  b.box([150, QUAY + 1, 134], [160, QUAY + 10, 142], WALL)
  b.cylinder([172, SEA + 1, 196], 3, 14, WALL)

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

  // ------------------------------------------------------------------ 4 crown terrace and the grand stair
  // From the spawn the axis drops straight down a grand stair to the plaza (12 steps with a
  // landing), flanked at its head by two lamp columns that frame the first view.
  const GS = [AX - 5, AX + 5] // grand stair, 11 wide
  const gsRows = flight(k => Array.from({ length: GS[1] - GS[0] + 1 }, (_, i) => [GS[0] + i, 67 + k]), 'south', CRN, PLZ, { landingAfter: 6, landing: 2 })
  for (let k = 0; k < gsRows; k += 1) {
    const z = 67 + k
    let y = PLZ
    while (y < CRN + 2 && b.has(GS[0], y + 1, z)) y += 1
    for (const x of [GS[0] - 1, GS[1] + 1]) {
      b.box([x, PLZ, z], [x, y, z], RET)
      b.set(x, y + 1, z, (k % 4 === 0) ? QZ : 'iron_bars')
      b.set(x, y + 2, z, sl('smooth_quartz'))
    }
  }
  // the crown's edge over the plaza: see-through iron railing between quartz posts
  for (let x = 78; x <= 132; x += 1)
    for (let z = 60; z <= 68; z += 1) {
      if (g(x, z) !== CRN || !isTown(x, z) || (x >= GS[0] - 1 && x <= GS[1] + 1)) continue
      if (!['east', 'west', 'south'].some(dir => g(x + DIR[dir][0], z + DIR[dir][2]) < CRN - 1)) continue
      b.set(x, CRN + 1, z, x % 5 === 0 ? QZ : 'iron_bars')
      b.set(x, CRN + 2, z, sl('smooth_quartz'))
    }
  // two lamp columns frame the view from the spawn
  for (const x of [GS[0] - 2, GS[1] + 2]) {
    const z = 66
    b.set(x, CRN + 1, z, 'polished_deepslate')
    for (let y = CRN + 2; y <= CRN + 7; y += 1) b.set(x, y, z, 'quartz_pillar[axis=y]')
    for (const f of ['north', 'south', 'east', 'west']) {
      const d = DIR[f]
      b.set(x + d[0], CRN + 1, z + d[2], st(TRIM, opposite(f)), { keep: true })
      b.set(x + d[0], CRN + 8, z + d[2], st('smooth_quartz', opposite(f), 'top'))
    }
    b.set(x, CRN + 8, z, QZ)
    b.set(x, CRN + 9, z, ACC)
    b.set(x, CRN + 10, z, 'lantern[hanging=false]')
  }
  // crown paving: a compass rose round the dais, calcite bands to the vault and the terraces
  for (let x = 70; x <= 140; x += 1)
    for (let z = 40; z <= 66; z += 1) {
      const r = Math.hypot(x - SX, z - SZ)
      if (r >= 5.5 && r < 6.5) pave(x, CRN, z, 'calcite')
      else if (r >= 6.5 && r < 7.3) pave(x, CRN, z, 'polished_deepslate')
    }
  for (const [dx, dz] of [[0, -6], [6, 0], [-6, 0]]) b.set(SX + dx, CRN, SZ + dz, ACC)
  for (let z = SZ + 7; z <= 66; z += 1) for (const x of [AX - 1, AX + 1]) pave(x, CRN, z, 'calcite')
  for (let z = 44; z <= SZ - 8; z += 1) for (const x of [AX - 1, AX + 1]) pave(x, CRN, z, 'calcite')
  for (let x = 72; x <= 138; x += 1) for (const z of [SZ - 1, SZ + 1]) if (Math.abs(x - SX) > 8) pave(x, CRN, z, 'calcite')
  wear([[AX, 46], [AX, SZ - 4]], CRN, 2.2, 1)
  wear([[AX, SZ + 4], [AX, 66]], CRN, 2.4, 2)
  // Start Here beside the spawn (facing it), the Store kiosk on the terrace's west side
  b.npcSpot([AX + 6, CRN, SZ + 3], 'west', { id: 'start', label: 'Start Here', role: 'tutorial', style: 'pedestal', shape: 'round', ...npcStyle, inlay: 'calcite' })
  b.npcSpot([AX - 13, CRN, SZ + 1], 'east', { id: 'store', label: 'Store', role: 'store', style: 'kiosk', ...npcStyle, roof: ROOF, post: 'quartz_pillar[axis=y]' })
  planter(AX + 10, SZ - 7, AX + 14, SZ - 3, CRN, { seed: 4 })
  b.tree([AX + 12, CRN + 2, SZ - 5], 'azalea', { seed: 5, height: 6, roots: 0 })

  // ------------------------------------------------------------------ 5 the plaza
  // One field (polished andesite) with a dark border; a calcite axis band from the grand stair
  // to the gate's arch, a cross band from the Exchange to the Duels gate. The fountain stands
  // off the axis on a round step (west), a feature tree balances it (east), so the walk from
  // the stair to the gate stays clear.
  const PZ = 92 // the cross band
  for (let x = 78; x <= 132; x += 1)
    for (let z = 66; z <= 102; z += 1) {
      if (g(x, z) !== PLZ) continue
      const nearEdge = ['north', 'east', 'south', 'west'].some(dir => g(x + DIR[dir][0], z + DIR[dir][2]) !== PLZ)
      if (nearEdge) pave(x, PLZ, z, 'polished_deepslate')
      else if (Math.abs(x - AX) <= 2 && z >= 80) pave(x, PLZ, z, Math.abs(x - AX) === 2 ? 'calcite' : 'smooth_stone')
      else if (Math.abs(z - PZ) <= 1) pave(x, PLZ, z, Math.abs(z - PZ) === 1 ? 'calcite' : 'smooth_stone')
    }
  for (const z of [84, 88, 96, 100]) b.set(AX, PLZ, z, ACC)
  const PC = [93, 89] // fountain centre
  disc(PC[0] + 0.5, PLZ + 1, PC[1] + 0.5, 7.1, 'smooth_stone_slab[type=bottom]')
  disc(PC[0] + 0.5, PLZ + 1, PC[1] + 0.5, 5.4, 'polished_andesite')
  const octa = (x, z, r) => Math.max(Math.abs(x - PC[0]), Math.abs(z - PC[1])) <= r && Math.abs(x - PC[0]) + Math.abs(z - PC[1]) <= r * 1.42
  b.fillWhere([PC[0] - 6, PLZ + 1, PC[1] - 6], [PC[0] + 6, PLZ + 2, PC[1] + 6], (x, y, z) => octa(x, z, 5) && !octa(x, z, 4), (x, y, z) => (y === PLZ + 2 ? sl('smooth_quartz') : QZ))
  b.fillWhere([PC[0] - 5, PLZ + 1, PC[1] - 5], [PC[0] + 5, PLZ + 1, PC[1] + 5], (x, y, z) => octa(x, z, 4), 'polished_deepslate')
  b.fillWhere([PC[0] - 5, PLZ + 2, PC[1] - 5], [PC[0] + 5, PLZ + 2, PC[1] + 5], (x, y, z) => octa(x, z, 4), 'water')
  for (const [dx, dz] of [[0, -5], [0, 5], [5, 0], [-5, 0]]) b.set(PC[0] + dx, PLZ + 2, PC[1] + dz, ACC)
  for (let y = PLZ + 2; y <= PLZ + 5; y += 1) b.set(PC[0], y, PC[1], y === PLZ + 2 ? 'polished_deepslate' : 'quartz_pillar[axis=y]')
  for (const f of ['north', 'south', 'east', 'west']) {
    const d = DIR[f]
    b.set(PC[0] + d[0], PLZ + 2, PC[1] + d[2], st('polished_deepslate', opposite(f)))
    b.set(PC[0] + d[0], PLZ + 5, PC[1] + d[2], st('smooth_quartz', opposite(f), 'top'))
    b.set(PC[0] + d[0] * 2, PLZ + 6, PC[1] + d[2] * 2, st('smooth_quartz', opposite(f)))
  }
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.set(PC[0] + dx, PLZ + 6, PC[1] + dz, QZ)
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) b.set(PC[0] + dx, PLZ + 6, PC[1] + dz, 'water')
  b.set(PC[0], PLZ + 6, PC[1], QZ)
  b.set(PC[0], PLZ + 7, PC[1], 'chiseled_quartz_block')
  b.set(PC[0], PLZ + 8, PC[1], 'polished_deepslate_wall')
  b.set(PC[0], PLZ + 9, PC[1], 'lantern[hanging=false]')
  bench(PC[0] - 2, PLZ + 1, PC[1] - 8, 'south', 3)
  bench(PC[0] + 8, PLZ + 1, PC[1] - 2, 'west', 3)
  // the feature tree east of the axis in a raised round bed, with a seat ring
  const FT = [121, 72]
  disc(FT[0] + 0.5, PLZ + 1, FT[1] + 0.5, 4.2, 'polished_deepslate')
  disc(FT[0] + 0.5, PLZ + 2, FT[1] + 0.5, 4.2, sl('smooth_quartz'))
  disc(FT[0] + 0.5, PLZ + 1, FT[1] + 0.5, 3.2, 'dirt')
  disc(FT[0] + 0.5, PLZ + 2, FT[1] + 0.5, 3.2, 'grass_block')
  for (let x = FT[0] - 3; x <= FT[0] + 3; x += 1) for (let z = FT[1] - 3; z <= FT[1] + 3; z += 1) if (b.nameAt(x, PLZ + 2, z) === 'minecraft:grass_block' && hash(x, 1, z, 9) < 0.5) b.set(x, PLZ + 3, z, hash(x, 2, z, 9) < 0.5 ? 'moss_carpet' : 'lily_of_the_valley')
  b.tree([FT[0], PLZ + 3, FT[1]], 'big_oak', { seed: 31, height: 15, roots: 3, blob: [2.8, 3.6] })
  // corner planters by the stair foot and the gate
  planter(86, 68, 91, 72, PLZ, { seed: 11 })
  b.tree([88, PLZ + 2, 70], 'azalea', { seed: 21, height: 6, roots: 0 })
  planter(116, 96, 120, 100, PLZ, { seed: 12 })
  b.tree([118, PLZ + 2, 98], 'azalea', { seed: 25, height: 5, roots: 0 })
  lamp(PC[0] + 7, PLZ + 1, PC[1] + 6, 'candelabra')
  lamp(GS[0] - 2, PLZ + 1, 81, 'post')
  lamp(GS[1] + 2, PLZ + 1, 81, 'post')
  lamp(98, PLZ + 1, 100, 'arm', 'east')
  lamp(112, PLZ + 1, 100, 'arm', 'west')
  b.npcSpot([126, PLZ, 81], 'west', { id: 'events', label: 'Events', role: 'events', style: 'pedestal', ...npcStyle, inlay: 'calcite' })
  wear([[AX, 80], [AX, GZ0 - 1]], PLZ, 2.4, 4)
  wear([[82, PZ], [100, PZ]], PLZ, 1.8, 6)
  wear([[110, PZ], [128, PZ]], PLZ, 1.8, 7)

  // ------------------------------------------------------------------ 6 the Crates Vault
  // The vault yard: a court behind the spawn, open to the sky (crate effects) and wide enough for
  // a key-all crowd. The treasury closes it to the north, cut into the rock: a rusticated ground
  // storey with the round vault door on the axis (its iron door stands swung open beside it),
  // CRATES on the frieze, a cornice and a low pediment. Two wings hold three crate niches each,
  // facing each other across the court; the queue aprons in front of them are worn dark.
  const VX0 = 89
  const VX1 = 121
  const VZ = 41 // treasury facade plane
  const VTOP = CRN + 19 // cornice 54
  b.box([VX0 - 1, CRN + 1, VZ - 12], [VX1 + 1, VTOP + 1, VZ - 1], 'stone') // the rock it is cut into
  b.box([VX0, CRN + 1, VZ - 4], [VX1, VTOP, VZ], WALL)
  b.box([VX0, CRN, VZ - 4], [VX1, CRN + 4, VZ], PLINTH)
  const VF = F([VX0, 0, VZ], 'south') // u grows east from x 89
  const vw = VX1 - VX0
  for (let u = -1; u <= vw + 1; u += 1) {
    b.set(...VF(u, CRN + 1, 1), st('deepslate_brick', 'north'))
    b.set(...VF(u, CRN + 5, 1), st(TRIM, 'north', 'top'))
    b.set(...VF(u, VTOP, 1), st(TRIM, 'north', 'top'))
    b.set(...VF(u, VTOP, 0), TRIM)
  }
  for (let u = 0; u <= vw; u += 1) {
    if (u % 3 === 1) for (let y = CRN + 2; y <= CRN + 4; y += 1) b.set(...VF(u, y, 0), 'polished_deepslate') // rustication joints
    b.set(...VF(u, VTOP - 1, 1), st('smooth_quartz', 'north', 'top'))
  }
  // the pediment: a smooth low gable (two stair courses per rise) with the accent in the tympanum
  for (let x = VX0 - 1; x <= VX1 + 1; x += 1) {
    const k = Math.min(x - (VX0 - 1), VX1 + 1 - x)
    const yk = VTOP + 1 + Math.floor(k / 3)
    for (let y = VTOP + 1; y < yk; y += 1) b.set(x, y, VZ, WALL)
    const half = k % 3 === 2 ? 'top' : 'bottom'
    const p = x === AX ? sl(TRIM, 'bottom') : k % 3 === 2 ? sl(TRIM, 'top') : st(TRIM, x < AX ? 'east' : 'west')
    b.set(x, yk, VZ, p)
    b.set(x, yk, VZ + 1, p)
    void half
  }
  b.set(AX, VTOP + 4, VZ + 1, ACC)
  b.set(AX, VTOP + 6, VZ, 'polished_deepslate_wall')
  // engaged columns and corner pilasters, proud by one
  for (const x of [VX0, VX0 + 1, VX1 - 1, VX1])
    for (let y = CRN + 6; y < VTOP - 1; y += 1) b.set(x, y, VZ + 1, y === CRN + 6 ? 'polished_deepslate' : y === VTOP - 2 ? 'chiseled_quartz_block' : 'quartz_pillar[axis=y]')
  for (const x of [AX - 6, AX + 6]) {
    for (let y = CRN + 1; y <= CRN + 9; y += 1) b.set(x, y, VZ + 1, y === CRN + 1 ? 'polished_deepslate' : y === CRN + 9 ? 'chiseled_quartz_block' : 'quartz_pillar[axis=y]')
    b.set(x, CRN + 10, VZ + 1, st('smooth_quartz', 'north', 'top'))
  }
  // the title on the frieze above the door, between the inner columns
  b.sign('CRATES', [AX, VTOP - 4, VZ + 1], 'south', { align: 'center', font: 'small', board: DARK, frame: false, pad: 1, boardDepth: 2 })
  for (let x = AX - 13; x <= AX + 13; x += 1) b.set(x, VTOP - 8, VZ + 1, st(TRIM, 'north', 'top'))
  // windows in the outer bays of the upper storey
  for (const x of [VX0 + 4, VX1 - 4]) {
    for (let y = CRN + 8; y <= CRN + 11; y += 1) {
      b.set(x, y, VZ, 'air')
      b.set(x, y, VZ - 1, 'gray_stained_glass_pane')
    }
    b.set(x, CRN + 7, VZ + 1, st(TRIM, 'north', 'top'))
    b.set(x, CRN + 12, VZ + 1, ACC)
  }
  // the round vault door: a ring of iron and deepslate round a 7-wide opening, a dark strong
  // room behind it with stacked loot; the door itself stands swung open on the east side
  const DC = [AX, CRN + 4.5] // door centre (x, y)
  for (let x = AX - 5; x <= AX + 5; x += 1)
    for (let y = CRN + 1; y <= CRN + 9; y += 1) {
      const r = Math.hypot(x - DC[0], y - DC[1])
      if (r <= 3.6) for (let z = VZ - 6; z <= VZ; z += 1) b.set(x, y, z, 'air')
      else if (r <= 4.8) {
        b.set(x, y, VZ + 1, (Math.round(Math.atan2(y - DC[1], x - DC[0]) * 8 / Math.PI) & 1) ? 'iron_block' : 'polished_deepslate')
        b.set(x, y, VZ, 'polished_blackstone')
      }
    }
  b.box([AX - 4, CRN, VZ - 7], [AX + 4, CRN, VZ], 'polished_blackstone_bricks')
  b.box([AX - 4, CRN + 1, VZ - 7], [AX + 4, CRN + 9, VZ - 7], 'polished_blackstone_bricks')
  b.box([AX - 4, CRN + 9, VZ - 6], [AX + 4, CRN + 9, VZ - 1], 'polished_blackstone_bricks')
  for (const [x, z, p] of [[AX - 2, VZ - 6, 'chest[facing=south]'], [AX + 2, VZ - 6, 'chest[facing=south]'], [AX - 3, VZ - 4, 'barrel[facing=up]'], [AX + 3, VZ - 5, 'iron_block'], [AX + 3, VZ - 4, 'barrel[facing=up]'], [AX, VZ - 6, 'ender_chest[facing=south]']]) b.set(x, CRN + 1, z, p)
  hang(AX, CRN + 7, VZ - 4, 1)
  const DOOR_X = AX + 8 // the swung-open door: a disc in the x plane, hinged at the facade
  for (let y = CRN + 1; y <= CRN + 8; y += 1)
    for (let z = VZ + 2; z <= VZ + 9; z += 1) {
      const r = Math.hypot(y - DC[1], z - (VZ + 5.5))
      if (r > 3.6) continue
      b.set(DOOR_X, y, z, r > 2.7 ? 'polished_deepslate' : r < 1.2 ? 'polished_blackstone' : 'iron_block')
      if (r > 1.6 && r <= 2.4) b.set(DOOR_X - 1, y, z, 'iron_trapdoor[facing=west,open=true,half=bottom]')
    }
  for (let y = CRN + 2; y <= CRN + 7; y += 1) b.set(DOOR_X, y, VZ + 1, 'chain[axis=y]')
  // the crate wings: a wall behind each row of niches, capped and balustraded
  const crateStyle = { primary: 'smooth_quartz', trim: TRIM, base: 'deepslate_tile', accent: ACC, light: 'sea_lantern', tierBlock: 'polished_blackstone' }
  for (const [x0, x1] of [[79, 84], [126, 131]]) {
    b.box([x0, CRN - 4, VZ + 1], [x1, CRN + 7, 59], WALL)
    b.box([x0, CRN - 4, VZ + 1], [x1, CRN + 1, 59], PLINTH)
    for (let z = VZ + 1; z <= 59; z += 1) for (let x = x0; x <= x1; x += 1) b.set(x, CRN + 8, z, x === x0 || x === x1 || z === 59 ? QZ : sl('smooth_quartz'))
    for (let x = x0; x <= x1; x += 1) for (let y = CRN + 2; y <= CRN + 7; y += 1) b.set(x, y, 59, y === CRN + 7 ? st(TRIM, 'north', 'top') : WALL)
  }
  b.crateRow([88, CRN + 2, 55], 'east', [
    { id: 'vote', label: 'Vote Crate', tier: 'vote', block: 'chest', glass: 'light_gray_stained_glass' },
    { id: 'common', label: 'Common Crate', tier: 'common', block: 'chest', glass: 'white_stained_glass' },
    { id: 'rare', label: 'Rare Crate', tier: 'rare', block: 'chest', glass: 'light_blue_stained_glass' },
  ], { spacing: 5, ...crateStyle, hero: false })
  b.crateRow([122, CRN + 2, 45], 'west', [
    { id: 'legendary', label: 'Legendary Crate', tier: 'legendary', block: 'ender_chest', glass: 'blue_stained_glass', tierBlock: ACC, hero: true },
    { id: 'epic', label: 'Epic Crate', tier: 'epic', block: 'chest', glass: 'cyan_stained_glass', hero: false },
    { id: 'seasonal', label: 'Seasonal Crate', tier: 'seasonal', block: 'barrel', glass: 'white_stained_glass', tierBlock: 'calcite', hero: false },
  ], { spacing: 5, ...crateStyle })
  // the keys NPC in a niche in the treasury's west bay, facing the court
  b.npcSpot([AX - 11, CRN, VZ - 1], 'south', { id: 'keys', label: 'Crate Keys', role: 'crates', style: 'alcove', ...npcStyle })
  // court paving: dark queue aprons in front of the niches, a worn path to the door
  for (let z = VZ + 1; z <= 58; z += 1) {
    for (const x of [89, 90, 91, 92]) pave(x, CRN, z, x === 92 ? 'calcite' : 'polished_deepslate')
    for (const x of [118, 119, 120, 121]) pave(x, CRN, z, x === 118 ? 'calcite' : 'polished_deepslate')
  }
  wear([[AX, VZ + 2], [AX, 54]], CRN, 2.6, 9)
  wear([[95, 47], [95, 56]], CRN, 1.6, 10)
  wear([[115, 45], [115, 56]], CRN, 1.6, 11)
  lamp(94, CRN + 1, 43, 'post')
  lamp(116, CRN + 1, 52, 'post')

  // ------------------------------------------------------------------ texture passes
  // white field: quartz → quartz bricks → calcite → polished diorite, darker toward the base and in
  // drip streaks, brighter around the focal points; plinths: polished deepslate → tiles
  const WHITE_RAMP = ['smooth_quartz', 'quartz_bricks', 'calcite', 'polished_diorite']
  const DARK_RAMP = ['polished_deepslate', 'deepslate_bricks', 'deepslate_tiles']
  const RET_RAMP = ['polished_andesite', 'stone_bricks', 'cracked_stone_bricks', 'tuff_bricks']
  const textureBuilding = (min, max, focus = [], seed = 0) => {
    b.texture(min, max, WHITE_RAMP, { only: WALL, mid: 0.28, base: 0.24, edge: 0.1, drip: 0.12, focus, focusRadius: 8, scale: 5, noise: 0.25, seed })
    b.texture(min, max, DARK_RAMP, { only: PLINTH, base: 0.3, scale: 4, noise: 0.3, seed: seed + 1 })
  }
  textureBuilding([GX0 - 2, MKT - 1, GZ0 - 3], [GX1 + 2, 70, GZ1 + 3], [[AX, PLZ + 4, GZ0], [AX, CLK[0] + 3, GZ0]], 1)
  textureBuilding([76, CRN - 5, VZ - 8], [134, VTOP + 8, 60], [[AX, CRN + 5, VZ]], 2)
  b.texture([0, 0, 0], [W - 1, CRN + 2, D - 1], RET_RAMP, { only: RET, base: 0.35, edge: 0.15, drip: 0.15, scale: 6, noise: 0.3, seed: 9 })

  b.spawnPoint(SPAWN, 'south')
  return b.finish({ name: 'spawn-plus', description: 'Harbor Hub spawn+' })
}
