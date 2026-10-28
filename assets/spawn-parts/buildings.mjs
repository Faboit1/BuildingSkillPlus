// Themed buildings for spawns.
//
//   KINDS                                     footprint ranges { min: [w, d], max: [w, d] } per kind
//                                             (w along the street; the arcade may run either way)
//   building(ctx, spec) → { door, bounds, top, npc?, interior? }
//     spec = { kind, x0, z0, x1, z1, y, facing, seed, storeys?, npc?: { id, label, role }, label? }
//     x0..z1  the wall footprint (inclusive); eaves, porches and skirts overhang it by at most 2
//     y       the floor block level (ground at the door); walls start at y + 1
//     facing  the street side: the main door (and the NPC, if any) is on that face
//     door    the ground block just outside the main door (paths lead there)
//     npc     the npcSpot record (style 'none'): on a porch beside the door (house, hall, tower),
//             behind the shop counter (shop), inside the colonnade (arcade), under the roof
//             (pavilion); it faces the street, with 3 air above its feet and a clear stand-off
//             (registered so finish() warns if a later edit fills it)
//     interior  { min, max } of the ground-floor room
//   heroWall(ctx, { x0, x1, z0, z1, y, cx, z, width, facing, boards, name }) → { bounds }
//   crateHall(ctx, { x0, z0, x1, z1, y, facing, crates }) → { bounds }
//
// How it works. Every building is authored in a canonical frame, front = south (+z), in a module
// (b.module) and stamped rotated onto its street side, so one code path serves all four facings.
// Kit components that record placements (npcSpot, leaderboards, crateRow, sign) run afterwards in
// world coordinates. A house is a plan of rectangles (main block, front cross-wing, lean-to) whose
// union is walled storey by storey in the theme's wall system:
//   timber  posts, plates and a jetty bressumer framing flush infill (autumn, medieval, fantasy)
//   stone   coursed field with quoins (or corner posts) over a plinth
//   log     horizontal logs with notched, crossing corners (winter)
//   quartz  smooth walls, pilasters, a string course and a cornice (white town)
//   machiya posts and beams over dark wainscot and white plaster, lattice windows (japanese)
// Windows sit one block deep in their reveals with sills, shutters or flower boxes; then the roof in
// the theme (curved deepslate-brick gables with spruce bargeboards, steep tiled gables with mottled
// tiles, low hips, snowy roofs, swept East-Asian roofs with skirts), and the dressing: chimneys with
// smoke, porches, lanterns on brackets, props at the door and a furnished ground floor you can see
// through the door and windows. Variety comes from the seed (plan, roof profile and axis, jetty,
// porch, door bay, chimney, shutters and flower boxes per house, window rhythm, props), so the
// houses of one spawn read as siblings of one village. Other kinds reuse the machine: a shop opens
// its front on a counter under a striped awning in the accent colour; a hall adds a cross-gabled
// entrance pavilion, a grand door and a corner tower; towers have string courses, a belfry and the
// theme's roof (a pagoda in japanese); arcades and pavilions stand on themed columns.
//
// Themes: STYLES below adds to ctx.theme what buildings need (wall systems, roof profile, window
// dress, props); a theme may override any of it with a `buildings` object, e.g.
//   theme.buildings = { roof: { profile: 'steep', material: 'deepslate_tile' }, porch: 0.6 }

export const KINDS = {
  house: { min: [7, 7], max: [15, 13] },
  shop: { min: [7, 7], max: [15, 13] },
  hall: { min: [13, 11], max: [27, 21] },
  tower: { min: [5, 5], max: [9, 9] },
  arcade: { min: [7, 9], max: [13, 40] },
  pavilion: { min: [7, 7], max: [15, 15] },
}

const FACINGS = ['north', 'east', 'south', 'west']
const DV = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }
const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' }
const CW = { north: 'east', east: 'south', south: 'west', west: 'north' }
const CCW = { north: 'west', west: 'south', south: 'east', east: 'north' }
const TURNS = { south: 0, west: 1, north: 2, east: 3 }
const AXIS = f => (f === 'north' || f === 'south' ? 'x' : 'z') // axis along a wall that faces f
const id = s => (typeof s === 'string' && !s.includes(':') ? `minecraft:${s}` : s)
const bare = s => String(s).replace(/^minecraft:/, '').replace(/\[.*$/, '')
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// ------------------------------------------------------------------ theme styles
// Everything a building needs beyond the theme's materials (ctx.theme: wall, timber, wood, plaster,
// roof, trim, accent, light, lantern, glass): wall system, roof profile, window dress, props. A
// theme may override any field with a `buildings` object.
//   system / ground2 / single (+ singleAlt, singleAltP): wall systems for upper storeys, the ground
//     storey of a multi-storey house, a one-storey house
//   roof: type gable | hip | east; profile (PROFILES); material (overrides theme.roof); barge
//     (spruce bargeboards on the rakes); snow
const STYLES = {
  autumn: {
    system: 'timber', ground2: 'stone', single: 'timber', singleAlt: 'stone', singleAltP: 0.4, quoin: 'frame',
    infill: { calcite: 6, white_terracotta: 1 },
    plinth: { cobblestone: 4, mossy_cobblestone: 2, andesite: 1 }, plinthH: 1, skirt: 'cobblestone',
    postEvery: 3, jetty: 0.5, porch: 0.45,
    roof: { type: 'gable', profile: 'curve', material: 'deepslate_brick', barge: 'spruce', overhang: 1 },
    gable: { kind: 'frame' },
    win: { shutters: 0.5, box: 0.35, mullion: 'spruce_fence' },
    door: 'spruce', floor: 'spruce_planks', chimney: { cobblestone: 3, stone_bricks: 2, mossy_cobblestone: 1 },
    flowers: ['orange_tulip', 'red_tulip', 'fern', 'poppy', 'dandelion'],
    props: ['pumpkin', 'hay', 'barrel', 'logs', 'carved', 'composter'], rug: ['orange_carpet', 'brown_carpet'],
  },
  medieval: {
    system: 'timber', ground2: 'stone', single: 'timber',
    infill: { calcite: 5, mushroom_stem: 2 },
    plinth: { cobblestone: 4, stone_bricks: 2, andesite: 2, mossy_cobblestone: 1 }, plinthH: 2, skirt: 'stone_brick',
    postEvery: 3, jetty: 0.8, porch: 0.25,
    roof: { type: 'gable', profile: 'steep', overhang: 1 },
    gable: { kind: 'studs' },
    win: { shutters: 0.45, box: 0.35, mullion: 'dark_oak_fence' },
    door: 'spruce', floor: 'spruce_planks', chimney: { bricks: 4, stone_bricks: 1 },
    flowers: ['poppy', 'cornflower', 'oxeye_daisy', 'allium', 'azure_bluet'],
    props: ['barrel', 'hay', 'logs', 'composter', 'grindstone', 'barrel'], rug: ['red_carpet', 'brown_carpet'],
  },
  'white-town': {
    system: 'quartz', single: 'quartz',
    plinth: null, plinthH: 1, skirt: 'polished_deepslate',
    postEvery: 3, jetty: 0, porch: 0.2,
    roof: { type: 'hip', profile: 'hip', overhang: 1 },
    gable: { kind: 'plain' },
    win: { shutters: 0.75, box: 0.3, tall: true },
    door: 'dark_oak', floor: 'dark_oak_planks', chimney: { smooth_quartz: 3, quartz_bricks: 1 },
    flowers: ['azure_bluet', 'cornflower', 'allium', 'lily_of_the_valley'],
    props: ['pots', 'barrel', 'bench'], rug: ['blue_carpet', 'light_gray_carpet'],
  },
  japanese: {
    system: 'machiya', single: 'machiya',
    infill: { calcite: 5, mushroom_stem: 1 },
    plinth: { mossy_stone_bricks: 2, stone_bricks: 2, andesite: 1 }, plinthH: 1, skirt: null,
    postEvery: 3, jetty: 0, porch: 0,
    roof: { type: 'east', overhang: 2 },
    win: { shutters: 0, box: 0 },
    door: 'spruce', floor: 'spruce_planks', chimney: null,
    flowers: ['azure_bluet', 'fern'],
    props: ['pots', 'bamboo', 'barrel'], rug: ['green_carpet', 'lime_carpet'],
  },
  winter: {
    system: 'log', single: 'log',
    plinth: { stone_bricks: 3, cobblestone: 2, mossy_stone_bricks: 1 }, plinthH: 1, skirt: 'stone_brick',
    postEvery: 3, jetty: 0, porch: 0.4,
    roof: { type: 'gable', profile: 'snow', overhang: 1, snow: true },
    gable: { kind: 'boards', field: 'spruce_planks' },
    win: { shutters: 0.75, box: 0 },
    door: 'spruce', floor: 'spruce_planks', chimney: { stone_bricks: 3, cobblestone: 2 },
    flowers: ['fern'],
    props: ['logs', 'barrel', 'logs', 'lanternpost'], rug: ['red_carpet', 'white_carpet'],
  },
  crimson: {
    system: 'timber', ground2: 'stone', single: 'timber', singleAlt: 'stone', singleAltP: 0.4, quoin: 'frame',
    infill: { red_nether_bricks: 5, nether_bricks: 1 },
    plinth: { blackstone: 3, polished_blackstone_bricks: 2, cracked_polished_blackstone_bricks: 1 }, plinthH: 1, skirt: 'polished_blackstone_brick',
    postEvery: 3, jetty: 0.6, porch: 0.35,
    roof: { type: 'gable', profile: 'steep', material: 'nether_brick', barge: 'crimson', overhang: 1 },
    gable: { kind: 'frame' },
    win: { shutters: 0.4, box: 0.3, mullion: 'crimson_fence' },
    door: 'crimson', floor: 'crimson_planks', chimney: { blackstone: 3, polished_blackstone_bricks: 1 },
    flowers: ['crimson_fungus', 'crimson_roots', 'red_tulip', 'poppy'],
    props: ['barrel', 'logs', 'pots', 'composter'], rug: ['red_carpet', 'black_carpet'],
  },
  // tropical: jungle-wood frames over white plaster on a mossy stone plinth, steep bamboo thatch with
  // jungle bargeboards and a deep overhang (shade), shutters in the accent, porches common
  tropical: {
    system: 'timber', ground2: 'timber', single: 'timber', quoin: 'frame',
    infill: { white_terracotta: 5, calcite: 2, birch_planks: 1 },
    plinth: { mossy_cobblestone: 3, cobblestone: 1, sandstone: 1 }, plinthH: 1, skirt: 'sandstone',
    postEvery: 3, jetty: 0, porch: 0.6,
    roof: { type: 'gable', profile: 'steep', material: 'bamboo', barge: 'jungle', overhang: 2 },
    gable: { kind: 'boards', field: 'bamboo_planks' },
    win: { shutters: 0.7, box: 0.4, mullion: 'jungle_fence' },
    door: 'jungle', floor: 'jungle_planks', chimney: null,
    flowers: ['blue_orchid', 'dandelion', 'allium', 'oxeye_daisy'],
    props: ['barrel', 'pots', 'bamboo', 'hay'], rug: ['light_blue_carpet', 'yellow_carpet'],
  },
  fantasy: {
    system: 'timber', single: 'timber', ground2: 'stone',
    infill: { calcite: 5, polished_diorite: 1 },
    plinth: { mossy_stone_bricks: 3, stone_bricks: 2, mossy_cobblestone: 1 }, plinthH: 1, skirt: 'mossy_stone_brick',
    postEvery: 3, jetty: 0.4, porch: 0.3,
    roof: { type: 'gable', profile: 'bell', overhang: 1, barge: 'dark_oak' },
    gable: { kind: 'frame' },
    win: { shutters: 0, box: 0.45, arch: true },
    door: 'birch', floor: 'birch_planks', chimney: { mossy_stone_bricks: 2, stone_bricks: 1 },
    flowers: ['allium', 'blue_orchid', 'lily_of_the_valley', 'pink_tulip'],
    props: ['pots', 'amethyst', 'barrel'], rug: ['purple_carpet', 'magenta_carpet'],
  },
}

// Roof pitch profiles (b.roof lists, eave row first) by half span (rows from the wall line to the
// ridge). Each theme has a profile; the seed may pick the neighbouring variant (v = 1).
const PROFILES = {
  curve: (hs, v) => (hs <= 3 ? [0.5, 0.5, 1, 1, 2] : hs === 4 ? (v ? [0.5, 0.5, 1, 2, 2] : [0.5, 0.5, 1, 1, 2, 2]) : hs === 5 ? [0.5, 0.5, 1, 1, 1, 2, 2] : [0.5, 0.5, 1, 1, 1, 1, 2, 2]),
  steep: (hs, v) => (hs <= 3 ? [1, 1, 2] : hs <= 4 ? (v ? [1, 1, 2] : [1, 1, 1, 2]) : [1, 1, 1, 1, 2]),
  snow: (hs, v) => (hs <= 3 ? [1, 1, 2] : hs <= 4 ? (v ? [1, 1, 2] : [1, 1, 1, 2]) : [1, 1, 1, 1, 2]),
  bell: (hs, v) => (hs <= 3 ? [0.5, 0.5, 1, 2, 3] : hs <= 5 ? (v ? [0.5, 0.5, 1, 2, 2, 3] : [0.5, 0.5, 1, 1, 2, 3]) : [0.5, 0.5, 1, 1, 1, 2, 3]),
  hip: (hs, v) => (v ? [1, 0.5] : [1, 1, 0.5]),
}

// Resolve a building style: theme materials + STYLES, palettes seeded per building.
function styleFor(ctx, seed) {
  const { kit, theme } = ctx
  const key = STYLES[theme.key] ? theme.key : 'medieval'
  const T = { ...STYLES[key], ...(theme.buildings ?? {}) }
  T.roof = { ...STYLES[key].roof, ...(theme.buildings?.roof ?? {}) }
  const pal = (w, scale = 3, k = 0) => (typeof w === 'string' ? id(w) : kit.palette(w, { scale, seed: seed * 13 + k }))
  const wood = kit.material(theme.wood)
  const trim = kit.material(theme.trim)
  const frame = id(bare(theme.timber))
  const S = {
    key, T, theme, kit, wood, trim, frame,
    frameY: `${frame}[axis=y]`,
    beam: axis => `${frame}[axis=${axis}]`,
    field: pal(theme.wall.field, 3, 1),
    quoin: T.quoin === 'frame' ? frame : id(bare(theme.wall.quoin)),
    base: id(bare(theme.wall.base)),
    plinth: T.plinth ? pal(T.plinth, 2, 2) : id(bare(theme.wall.base)),
    infill: T.infill ? pal(T.infill, 3, 3) : theme.plaster ? id(theme.plaster) : pal(theme.wall.field, 3, 3),
    floor: id(T.floor ?? wood.planks),
    roof: T.roof.material ?? theme.roof,
    accent: theme.accent ?? 'red',
    lantern: id(bare(theme.lantern ?? 'lantern')),
    light: id(bare(theme.light ?? 'ochre_froglight')),
    glass: id(bare(theme.glass ?? 'glass_pane')),
    door: T.door ?? theme.wood,
    chimney: T.chimney ? pal(T.chimney, 2, 4) : null,
    snow: Boolean(theme.snowRoofs || T.roof.snow),
  }
  S.roofFam = kit.material(S.roof)
  S.stairs = (fam, facing, half = 'bottom') => `${(typeof fam === 'string' ? kit.material(fam) : fam).stairs}[facing=${facing},half=${half}]`
  S.slab = (fam, type = 'bottom') => `${(typeof fam === 'string' ? kit.material(fam) : fam).slab}[type=${type}]`
  S.trapdoor = (facing, open = true, half = 'bottom', fam = wood) => `${fam.trapdoor}[facing=${facing},open=${open},half=${half}]`
  S.fence = id(wood.fence)
  return S
}

// ------------------------------------------------------------------ the canonical frame
// A module the size of the plan + pad, front = south. toW maps module → world coordinates, dirW maps
// a canonical facing to the world facing, stamp() pastes the module rotated. A plan smaller than
// the given footprint is centred along the street and kept on the street line.
function makeFrame(ctx, spec, { pad = 4, below = 4, height = 48, W: wantW, D: wantD } = {}) {
  const facing = FACINGS.includes(spec.facing) ? spec.facing : 'south'
  const x0 = Math.round(Math.min(spec.x0, spec.x1))
  const x1 = Math.round(Math.max(spec.x0, spec.x1))
  const z0 = Math.round(Math.min(spec.z0, spec.z1))
  const z1 = Math.round(Math.max(spec.z0, spec.z1))
  const ns = facing === 'north' || facing === 'south'
  const fullW = ns ? x1 - x0 + 1 : z1 - z0 + 1
  const fullD = ns ? z1 - z0 + 1 : x1 - x0 + 1
  const W = Math.min(wantW ?? fullW, fullW + 8)
  const D = Math.min(wantD ?? fullD, fullD + 8)
  const sx = Math.max(W, fullW) + 2 * pad
  const sz = Math.max(D, fullD) + 2 * pad
  const m = ctx.b.module([sx, height, sz])
  const turns = TURNS[facing]
  const rot = (x, z) => {
    let rx = x
    let rz = z
    let d = sz
    let w = sx
    for (let i = 0; i < turns; i += 1) {
      const nx = d - 1 - rz
      const nz = rx
      rx = nx
      rz = nz
      ;[w, d] = [d, w]
    }
    return [rx, rz]
  }
  const offU = Math.floor((fullW - W) / 2)
  const offD = fullD - D
  const X0 = pad + Math.max(0, offU)
  const X1 = X0 + W - 1
  const Z0 = pad + Math.max(0, offD)
  const Z1 = Z0 + D - 1
  // the given footprint in module coordinates: [pad .. pad + fullW - 1] x [pad .. pad + fullD - 1]
  const c0 = rot(pad, pad)
  const c1 = rot(pad + fullW - 1, pad + fullD - 1)
  const at = [x0 - Math.min(c0[0], c1[0]), Math.round(spec.y) - below, z0 - Math.min(c0[1], c1[1])]
  const toW = (x, y, z) => {
    const [rx, rz] = rot(x, z)
    return [at[0] + rx, at[1] + y, at[2] + rz]
  }
  const dirW = f => {
    let g = f
    for (let i = 0; i < turns; i += 1) g = CW[g]
    return g
  }
  return {
    m, W, D, X0, X1, Z0, Z1, F: below, facing, toW, dirW, turns, at,
    stamp(opts = {}) {
      ctx.b.stamp(m, at, { rotate: turns, ...opts })
    },
    worldBounds() {
      const bb = m.bounds()
      if (!bb) return { min: [x0, spec.y, z0], max: [x1, spec.y, z1] }
      const a = toW(bb.min[0], bb.min[1], bb.min[2])
      const c = toW(bb.max[0], bb.max[1], bb.max[2])
      return { min: [Math.min(a[0], c[0]), a[1], Math.min(a[2], c[2])], max: [Math.max(a[0], c[0]), c[1], Math.max(a[2], c[2])] }
    },
  }
}

// ------------------------------------------------------------------ footprints and walls
// A footprint is a union of wall-line rectangles on the module grid. Wall cells have an outside
// cell among their 8 neighbours; the ring is the next layer in (timber infill); runs are straight
// stretches of wall cells sharing an outward normal, ordered left → right as seen from outside.
function footprint(sx, sz, rects) {
  const a = new Uint8Array(sx * sz)
  for (const r of rects) for (let x = r.x0; x <= r.x1; x += 1) for (let z = r.z0; z <= r.z1; z += 1) if (x >= 0 && z >= 0 && x < sx && z < sz) a[x + sx * z] = 1
  const has = (x, z) => x >= 0 && z >= 0 && x < sx && z < sz && a[x + sx * z] === 1
  const W8 = new Uint8Array(sx * sz)
  const R8 = new Uint8Array(sx * sz)
  const cells = []
  for (let x = 0; x < sx; x += 1)
    for (let z = 0; z < sz; z += 1) {
      if (!has(x, z)) continue
      cells.push([x, z])
      for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) if ((dx || dz) && !has(x + dx, z + dz)) W8[x + sx * z] = 1
    }
  const wall = (x, z) => x >= 0 && z >= 0 && x < sx && z < sz && W8[x + sx * z] === 1
  for (const [x, z] of cells) {
    if (wall(x, z)) continue
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) if ((dx || dz) && wall(x + dx, z + dz)) R8[x + sx * z] = 1
  }
  const ring = (x, z) => x >= 0 && z >= 0 && x < sx && z < sz && R8[x + sx * z] === 1
  const normals = (x, z) => FACINGS.filter(f => !has(x + DV[f][0], z + DV[f][1]))
  const runs = []
  for (const f of FACINGS) {
    const groups = new Map()
    for (const [x, z] of cells) {
      if (!wall(x, z) || has(x + DV[f][0], z + DV[f][1])) continue
      const [line, pos] = f === 'north' || f === 'south' ? [z, x] : [x, z]
      if (!groups.has(line)) groups.set(line, [])
      groups.get(line).push(pos)
    }
    for (const [line, posList] of groups) {
      posList.sort((p, q) => p - q)
      let start = 0
      for (let i = 1; i <= posList.length; i += 1) {
        if (i === posList.length || posList[i] !== posList[i - 1] + 1) {
          let seg = posList.slice(start, i).map(p => (f === 'north' || f === 'south' ? [p, line] : [line, p]))
          if (f === 'north' || f === 'east') seg = seg.reverse() // left → right seen from outside
          runs.push({ f, cells: seg, L: seg.length, axis: AXIS(f) })
          start = i
        }
      }
    }
  }
  const interior = cells.filter(([x, z]) => !wall(x, z))
  return { has, wall, ring, cells, runs, normals, interior }
}

// Posts along a run: both ends and bay posts about `every` apart.
function runPosts(L, every) {
  if (L <= 2) return [0, L - 1]
  const n = Math.max(1, Math.round((L - 1) / (every + 1)))
  const out = []
  for (let i = 0; i <= n; i += 1) out.push(Math.round((i * (L - 1)) / n))
  return [...new Set(out)]
}

// A run-local cell: u along the run (may extend past its ends), d out of the wall (+) or in (-).
function runAt(run, u, d) {
  const c = run.cells[clamp(u, 0, run.L - 1)]
  const ext = u < 0 ? u : u > run.L - 1 ? u - (run.L - 1) : 0
  const o = DV[run.f]
  const r = DV[CCW[run.f]]
  return [c[0] + o[0] * d + r[0] * ext, c[1] + o[1] * d + r[1] * ext]
}

// Walls of one storey: footprint `foot`, rows y0..y1, wall system `sys`.
//   opts: ground (plinth courses), plate (top beam / cornice), sill (bottom beam: jetty bressumer),
//         band (string course at y0, quartz)
function paintStorey(B, foot, y0, y1, sys, opts = {}) {
  const { m, S } = B
  const posts = new Set()
  for (const run of foot.runs) {
    run.posts = runPosts(run.L, S.T.postEvery ?? 3)
    for (const u of run.posts) posts.add(run.cells[u].join(','))
  }
  for (const [x, z] of foot.cells) if (foot.wall(x, z) && foot.normals(x, z).length !== 1) posts.add(`${x},${z}`)
  B.posts = posts
  const plinthTop = opts.ground ? y0 + (S.T.plinthH ?? 1) - 1 : y0 - 1
  const axisOf = (x, z) => (foot.normals(x, z).some(f => f === 'north' || f === 'south') ? 'x' : 'z')
  for (const [x, z] of foot.cells) {
    const isWall = foot.wall(x, z)
    const isRing = !isWall && foot.ring(x, z)
    if (!isWall && !isRing) continue
    const nn = isWall ? foot.normals(x, z).length : 1
    const corner = isWall && nn !== 1
    const isPost = isWall && posts.has(`${x},${z}`)
    for (let y = y0; y <= y1; y += 1) {
      let p = null
      if (sys === 'timber') {
        if (!isWall) continue
        if (y <= plinthTop) p = S.plinth
        else if (corner) p = S.frameY
        else if ((opts.plate && y === y1) || (opts.sill && y === y0)) p = S.beam(axisOf(x, z))
        else if (isPost) p = S.frameY
        else p = S.infill
      } else if (sys === 'stone') {
        if (!isWall) continue
        if (y <= plinthTop) p = S.plinth
        else if (corner) p = S.quoin === S.frame ? S.frameY : S.quoin
        else p = S.field
      } else if (sys === 'quartz') {
        if (!isWall) continue
        if (y <= plinthTop) p = S.base
        else if (opts.band && y === y0) p = corner ? S.trim.block : 'minecraft:smooth_stone'
        else if (corner) p = `${S.quoin}[axis=y]`
        else p = S.field
      } else if (sys === 'machiya') {
        // stone base, dark wood wainscot, a beam (nageshi) at y0 + 4, white plaster above
        if (!isWall) continue
        if (y <= plinthTop) p = S.plinth
        else if (corner || isPost) p = S.frameY
        else if (y === y1 || (y1 - y0 >= 5 && y === y0 + 4)) p = S.beam(axisOf(x, z))
        else if (y < y0 + 3 && opts.ground) p = 'minecraft:dark_oak_planks'
        else p = S.infill
      } else if (sys === 'log') {
        if (!isWall) continue
        if (y <= plinthTop) p = S.plinth
        else if (corner) p = (y % 2 === 0) ? 'minecraft:spruce_log[axis=x]' : 'minecraft:spruce_log[axis=z]'
        else p = `minecraft:stripped_spruce_log[axis=${axisOf(x, z)}]`
      }
      if (p) m.set(x, y, z, p)
    }
    // notched log corners: the logs cross and run one past the corner, alternating courses
    if (sys === 'log' && corner && nn === 2) {
      const ns = foot.normals(x, z)
      const fx = ns.find(f => f === 'east' || f === 'west')
      const fz = ns.find(f => f === 'north' || f === 'south')
      for (let y = Math.max(y0, plinthTop + 1); y <= y1; y += 1) {
        if (y % 2 === 0) m.set(x + DV[fx][0], y, z, 'minecraft:spruce_log[axis=x]')
        else m.set(x, y, z + DV[fz][1], 'minecraft:spruce_log[axis=z]')
      }
    }
  }
  // quartz: a cornice of upside-down trim stairs around the top of the last storey
  if (sys === 'quartz' && opts.plate) {
    for (const run of foot.runs) {
      for (let u = -1; u <= run.L; u += 1) {
        const [x, z] = runAt(run, u, 1)
        m.set(x, y1, z, S.stairs(S.trim, OPP[run.f], 'top'), u < 0 || u >= run.L ? { keep: true } : undefined)
      }
    }
  }

}

// One opening on a run: kind 'window' | 'door', cells u0..u0+w-1, rows y..y+h-1.
function opening(B, run, u0, w, y, h, kind, opts = {}) {
  const { m, S, sys } = B
  const f = run.f
  const inward = OPP[f]
  const set = (u, d, yy, p, so) => {
    const [x, z] = runAt(run, u, d)
    m.set(x, yy, z, p, so)
  }
  const axis = run.axis
  const timberish = sys === 'timber' || sys === 'machiya'
  for (let i = 0; i < w; i += 1)
    for (let j = 0; j < h; j += 1) {
      set(u0 + i, 0, y + j, 'air')
      if (kind === 'window') {
        const mull = opts.mullion && w >= 3 && i === Math.floor(w / 2)
        set(u0 + i, -1, y + j, mull ? opts.mullion : S.glass)
      } else set(u0 + i, -1, y + j, 'air')
    }
  if (kind === 'door') {
    const [dx, dz] = runAt(run, u0, -1)
    m.door([dx, y, dz], f, { material: S.door, width: w })
    if (sys === 'quartz') {
      // pilasters, a fanlight in the accent colour and a pediment hood
      for (const u of [u0 - 1, u0 + w]) for (let j = 0; j < 3; j += 1) set(u, 0, y + j, j === 2 ? S.trim.block : 'minecraft:quartz_pillar[axis=y]')
      for (let u = u0; u < u0 + w; u += 1) {
        set(u, 0, y + 2, 'air')
        set(u, -1, y + 2, `minecraft:${S.accent}_stained_glass_pane`)
      }
      for (let u = u0 - 1; u <= u0 + w; u += 1) set(u, 1, y + 3, S.stairs(S.trim, inward, 'bottom'))
      set(u0 - 2, 1, y + 3, S.stairs(S.trim, CW[f], 'bottom'))
      set(u0 + w + 1, 1, y + 3, S.stairs(S.trim, CCW[f], 'bottom'))
      return
    }
  }
  // heads
  if (sys === 'quartz') {
    for (let u = u0; u < u0 + w; u += 1) set(u, 0, y + h, 'minecraft:chiseled_quartz_block')
  } else if (timberish) {
    if (kind === 'door') for (let u = u0; u < u0 + w; u += 1) set(u, 0, y + h, S.beam(axis))
  } else {
    for (let u = u0 - 1; u <= u0 + w; u += 1) if (u >= 0 && u <= run.L - 1) set(u, 0, y + h, S.beam(axis))
  }
  if (kind !== 'window') return
  if (sys === 'machiya') {
    // koshi lattice: slatted trapdoors in the wall plane over the glass, a sill beam below
    for (let i = 0; i < w; i += 1) {
      for (let j = 0; j < h; j += 1) set(u0 + i, 0, y + j, `minecraft:${opts.light ? 'jungle' : 'spruce'}_trapdoor[facing=${f},open=true,half=bottom]`)
      set(u0 + i, 0, y - 1, S.beam(axis))
    }
    return
  }
  // sill, flower box, shutters
  for (let i = 0; i < w; i += 1) {
    if (opts.box) {
      set(u0 + i, 0, y - 1, 'minecraft:rooted_dirt')
      set(u0 + i, 0, y, B.flowers[(B.rng.int(0, 99) + i) % B.flowers.length])
      set(u0 + i, 1, y - 1, S.trapdoor(f, true))
    } else if (timberish) {
      set(u0 + i, 0, y - 1, S.beam(axis))
      set(u0 + i, 1, y - 1, S.stairs(S.wood, inward, 'top'), { keep: true })
    } else if (sys === 'quartz') {
      set(u0 + i, 0, y - 1, S.trim.block)
      set(u0 + i, 1, y - 1, S.stairs(S.trim, inward, 'top'))
    } else set(u0 + i, 0, y - 1, S.stairs(S.wood, inward, 'bottom'))
  }
  if (opts.box) {
    set(u0 - 1, 1, y - 1, S.trapdoor(CW[f], true), { keep: true })
    set(u0 + w, 1, y - 1, S.trapdoor(CCW[f], true), { keep: true })
  }
  if (opts.shutters) {
    for (let j = 0; j < h; j += 1)
      for (const u of [u0 - 1, u0 + w]) set(u, 1, y + j, S.trapdoor(f, true, j === h - 1 && h > 1 ? 'top' : 'bottom'), { keep: true })
  }
  if (opts.arch && w >= 2 && h >= 2) {
    // a pointed head: upside-down stairs in the top corners of the glass
    set(u0, -1, y + h - 1, S.stairs(S.wood, CW[f], 'top'))
    set(u0 + w - 1, -1, y + h - 1, S.stairs(S.wood, CCW[f], 'top'))
  }
}

// Bays of a run between its posts: [a, b] inner ranges.
function baysOf(run) {
  const out = []
  const ps = run.posts ?? [0, run.L - 1]
  for (let i = 0; i + 1 < ps.length; i += 1) if (ps[i + 1] - ps[i] >= 2) out.push([ps[i] + 1, ps[i + 1] - 1])
  return out
}

// Windows (and the door) on the runs of a storey. Returns the door { run, u } if one was placed.
function fenestrate(B, foot, y0, y1, { door, doorU, density = 0.7, skip } = {}) {
  const { S, rng } = B
  const win = S.T.win ?? {}
  const wy = y0 + 1
  const h = Math.min(win.tall && y1 - wy >= 3 ? 3 : 2, y1 - wy)
  let doorAt = null
  const frontLine = Math.max(...foot.runs.filter(r => r.f === 'south').map(r => r.cells[0][1]))
  for (const run of foot.runs) {
    const bays = baysOf(run)
    if (!bays.length) continue
    const isFront = run.f === 'south'
    let doorBay = -1
    if (door && isFront && !doorAt && run.L >= 3 && run.cells[0][1] === frontLine) {
      let best = Infinity
      bays.forEach(([a, b], i) => {
        const d = Math.abs((a + b) / 2 - (doorU ?? (run.L - 1) / 2))
        if (d < best) {
          best = d
          doorBay = i
        }
      })
    }
    let calm = 0
    bays.forEach(([a, b], i) => {
      const bw = b - a + 1
      if (i === doorBay) {
        const u = a + Math.floor((bw - 1) / 2)
        if (!skip?.(run, u, 1)) {
          opening(B, run, u, 1, y0, 2, 'door')
          doorAt = { run, u }
          return
        }
      }
      // keep some bays calm: back walls mostly blank, never two blank bays on the front
      const p = isFront ? density + 0.2 : run.f === 'north' ? density - 0.35 : density - 0.1
      if (rng() > p && !(isFront && calm >= 1)) {
        calm += 1
        return
      }
      let w = bw >= 3 && rng.chance(0.35) ? 3 : bw >= 2 && rng.chance(0.55) ? 2 : 1
      if (B.sys === 'timber' && bw <= 3 && rng.chance(0.5)) w = bw
      if (w > bw) w = bw
      const u = a + Math.floor((bw - w) / 2)
      if (skip?.(run, u, w)) return
      opening(B, run, u, w, wy, h, 'window', {
        shutters: B.sys !== 'timber' && w <= 2 && B.shutters && !(isFront && w === 1 && rng.chance(0.2)),
        box: B.boxes && (isFront ? rng.chance(0.7) : rng.chance(0.2)),
        mullion: w === 3 ? id(win.mullion ?? S.fence) : null,
        arch: win.arch,
        light: B.sys === 'machiya' && wy > y0 + 3,
      })
    })
  }
  return doorAt
}

// ------------------------------------------------------------------ roofs

// Gable-triangle paint for a roof over rect r with ridge axis `axis`; ye = wall top.
function gablePaint(B, r, axis, ye) {
  const { S } = B
  const g = S.T.gable ?? { kind: 'plain' }
  const field = g.field ? id(g.field) : S.infill
  const along = axis === 'x' ? 'z' : 'x'
  const c = axis === 'x' ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2
  const posts = B.posts ?? new Set()
  const collar = ye + 3
  return (x, y, z) => {
    const u = axis === 'x' ? z : x
    const k = Math.abs(u - c)
    if (g.kind === 'plain') return S.sysTop === 'quartz' ? S.field : field
    if (y === collar && k >= 1) return S.beam(along)
    if (posts.has(`${x},${z}`) && y < collar) return S.frameY
    if (k < 0.75) return S.frameY
    if (g.kind === 'studs' && Math.round(k) % 2 === 0 && y > collar) return S.frameY
    if (g.kind === 'boards' && Math.round(k) % 2 === 1) return S.frameY
    return field
  }
}

const roofProfile = (B, span) => {
  const { S } = B
  const hs = Math.max(2, Math.floor((span - 1) / 2))
  return (PROFILES[S.T.roof.profile] ?? PROFILES.steep)(hs, B.roofVariant)
}

// Roof over the top storey: one rect (b.roof) or several (b.compoundRoof), in the theme's
// profile; bargeboards, snow and a ridge beam after. Returns the kit result.
function buildRoof(B, rects, ye, { axis } = {}) {
  const { m, S } = B
  const R = S.T.roof
  const snowy = S.snow
  const mat = snowy ? { stairs: 'minecraft:smooth_quartz_stairs', slab: 'minecraft:smooth_quartz_slab', block: 'minecraft:snow_block' } : S.roof
  const r0 = rects[0]
  const ax0 = rects.length === 1 ? axis : r0.axis
  const span = ax0 === 'x' ? r0.z1 - r0.z0 + 1 : r0.x1 - r0.x0 + 1
  const pitch = R.type === 'hip' ? PROFILES.hip(0, B.roofVariant) : roofProfile(B, span)
  let res
  if (R.type === 'east') return eastRoofFor(B, rects, ye, axis)
  if (R.type === 'hip') {
    if (rects.length === 1) res = m.roof({ ...rects[0], y: ye, type: 'hip', material: mat, pitch, overhang: R.overhang ?? 1, eaveTrim: false })
    else res = m.compoundRoof({ rects: rects.map(r => [r.x0, r.z0, r.x1, r.z1]), y: ye, type: 'hip', material: mat, pitch, overhang: R.overhang ?? 1, eaveTrim: false })
  } else if (rects.length === 1) {
    const r = rects[0]
    res = m.roof({ ...r, y: ye, type: 'gable', axis, material: mat, pitch, overhang: R.overhang ?? 1, gableOverhang: 1, eaveTrim: true, gable: gablePaint(B, r, axis, ye - 1) })
    if (R.barge) bargeboards(B, res, r, axis, R.barge)
  } else {
    res = m.compoundRoof({ rects: rects.map(r => [r.x0, r.z0, r.x1, r.z1]), y: ye, type: 'gable', gableAxes: rects.map(r => r.axis), material: mat, pitch, overhang: R.overhang ?? 1, eaveTrim: true })
    for (const r of rects) fillGables(B, res, r, rects, ye)
    if (R.barge) for (const r of rects) bargeboards(B, res, r, r.axis, R.barge, rects)
  }
  if (snowy) snowEdges(B, res)
  else mottle(B, res)
  return res
}

// Mottled tiles: clumps of a sister material on the roof surface (shape and facing kept).
const SISTERS = {
  'minecraft:deepslate_tile': ['minecraft:cobbled_deepslate', 'minecraft:deepslate_brick'],
  'minecraft:deepslate_brick': ['minecraft:deepslate_tile', 'minecraft:polished_deepslate'],
  'minecraft:dark_oak': ['minecraft:spruce'],
  'minecraft:spruce': ['minecraft:dark_oak'],
}
function mottle(B, res, share = B.S.key === 'medieval' ? 0.2 : 0.13) {
  const { m, S, kit } = B
  const fam = S.roofFam
  const key = id(bare(fam.stairs).replace(/_stairs$/, ''))
  const sis = SISTERS[key]
  if (!sis) return
  const alt = sis.map(n => kit.material(n))
  const swap = { [fam.stairs]: 'stairs', [fam.slab]: 'slab', [fam.block]: 'block' }
  const seed = B.rng.int(0, 1e5)
  for (const [k] of res.cells) {
    const [x, z] = k.split(',').map(Number)
    const y = cellTop(res, x, z)
    const bl = m.get(x, y, z)
    if (!bl || !swap[bl.name]) continue
    const n = kit.noise.coherent01(x, y, z, { scale: 2.5, grain: 0.3, seed })
    if (n > share) continue
    const a = alt[n < share * 0.35 && alt[1] ? 1 : 0]
    const to = a[swap[bl.name]] ?? (swap[bl.name] === 'block' ? a.block : null)
    if (to) m.set(x, y, z, { name: id(bare(to)), props: bl.props })
  }
}

// Gable triangles of a compound roof: the wall-line cells of each rect's free gable ends, filled
// from the wall top to two below the roof surface (the tile and its riser stay).
function fillGables(B, res, r, all, ye) {
  const { m } = B
  const paint = gablePaint(B, r, r.axis, ye - 1)
  const ends = r.axis === 'x' ? [r.x0, r.x1] : [r.z0, r.z1]
  for (const e of ends) {
    const lo = r.axis === 'x' ? r.z0 : r.x0
    const hi = r.axis === 'x' ? r.z1 : r.x1
    for (let v = lo; v <= hi; v += 1) {
      const [x, z] = r.axis === 'x' ? [e, v] : [v, e]
      const out = r.axis === 'x' ? [x + (e === r.x0 ? -1 : 1), z] : [x, z + (e === r.z0 ? -1 : 1)]
      if (all.some(q => q !== r && out[0] >= q.x0 && out[0] <= q.x1 && out[1] >= q.z0 && out[1] <= q.z1)) continue
      const top = cellTop(res, x, z)
      for (let y = ye; y <= top - 2; y += 1) {
        const bl = m.get(x, y, z)
        if (!bl || /(_stairs|_slab|_tiles|_bricks|_planks|^minecraft:snow_block)$/.test(bl.name)) m.set(x, y, z, paint)
      }
    }
  }
}

// East-Asian roofs (japanese): hip, irimoya or gable on the kit's eastRoof, with a pent skirt
// over the ground storey of a two-storey house.
function eastRoofFor(B, rects, ye, axis) {
  const { m, S, rng } = B
  const r = rects[0]
  const W = r.x1 - r.x0 + 1
  const D = r.z1 - r.z0 + 1
  const type = B.eastType ?? (W >= 11 && D >= 9 ? rng.pick(['irimoya', 'irimoya', 'gable']) : rng.pick(['hip', 'gable', 'irimoya']))
  B.eastType = type
  const gAxis = type === 'gable' ? (rng.chance(0.6) ? 'z' : 'x') : axis
  const res = m.eastRoof({
    x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, y: ye, type, axis: gAxis,
    material: S.roof, ridge: 'deepslate_tile', rafter: 'spruce',
    pitch: [0.5, 0.5, 1, 1, 1], overhang: S.T.roof.overhang ?? 2, gableOverhang: 1, lift: Math.min(W, D) >= 9 ? 1 : 0.5,
    gable: S.infill, gableBeam: S.beam(gAxis === 'x' ? 'z' : 'x'), barge: type === 'irimoya' && Math.min(W, D) >= 11, brackets: true, lanterns: W >= 11,
  })
  // a pent skirt (hisashi) over the ground storey of a two-storey house
  if (B.levels.length >= 2) {
    const lv0 = B.levels[0]
    m.eastRoof({ x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, y: lv0.y1 + 1, type: 'hip', material: S.roof, ridge: 'deepslate_tile', rafter: 'spruce', pitch: [0.5, 0.5, 1], overhang: 2, lift: 0.5, stopAt: [r.x0, r.z0, r.x1, r.z1], brackets: true, overwrite: false })
  }
  return res
}

const cellTop = (res, x, z) => {
  const c = res.cells.get(`${x},${z}`)
  if (!c) return -1
  return c.y ?? res.base + c.tb
}

// Bargeboards on the rakes of a gable over rect r: the rake column turns wood and rises one above
// the tiles; the ridge ends stand up as horns.
function bargeboards(B, res, r, axis, wood, all = [r]) {
  const { m, kit } = B
  const W = kit.material(wood)
  const ends = axis === 'x' ? [r.x0 - 1, r.x1 + 1] : [r.z0 - 1, r.z1 + 1]
  const lo = axis === 'x' ? r.z0 - 1 : r.x0 - 1
  const hi = axis === 'x' ? r.z1 + 1 : r.x1 + 1
  const toWood = bl => (bl.name.endsWith('_stairs') ? { name: W.stairs, props: bl.props } : bl.name.endsWith('_slab') ? { name: W.slab, props: bl.props } : W.planks)
  for (const e of ends) {
    // a rake that runs into another wing's roof is a valley, not a gable end
    const inOther = v => all.some(q => q !== r && (axis === 'x' ? e >= q.x0 - 1 && e <= q.x1 + 1 && v >= q.z0 - 1 && v <= q.z1 + 1 : e >= q.z0 - 1 && e <= q.z1 + 1 && v >= q.x0 - 1 && v <= q.x1 + 1))
    for (let v = lo; v <= hi; v += 1) {
      if (inOther(v)) continue
      const [x, z] = axis === 'x' ? [e, v] : [v, e]
      const top = cellTop(res, x, z)
      if (top < 0) continue
      for (let y = top; y >= top - 3; y -= 1) {
        const bl = m.get(x, y, z)
        if (bl && /(_stairs|_slab|_bricks|_planks|_tiles|^minecraft:snow_block)$/.test(bl.name)) m.set(x, y, z, toWood(bl))
      }
      const bl = m.get(x, top, z)
      if (!bl) continue
      m.set(x, top + 1, z, bl.name.endsWith('_slab') ? `${W.slab}[type=bottom]` : toWood(bl))
      m.set(x, top, z, W.planks)
    }
  }
}

// Snowy roofs: a white top surface over spruce eaves, soffits and rakes.
function snowEdges(B, res) {
  const { m } = B
  for (const [k] of res.cells) {
    const [x, z] = k.split(',').map(Number)
    const top = cellTop(res, x, z)
    for (let y = top - 1; y >= top - 4; y -= 1) {
      const b = m.get(x, y, z)
      if (!b) continue
      if (b.name === 'minecraft:smooth_quartz_stairs') m.set(x, y, z, { name: 'minecraft:spruce_stairs', props: b.props })
      else if (b.name === 'minecraft:smooth_quartz_slab') m.set(x, y, z, { name: 'minecraft:spruce_slab', props: b.props })
      else if (b.name === 'minecraft:snow_block') m.set(x, y, z, 'minecraft:spruce_planks')
    }
  }
}

// Chimney: a stone stack from the floor to 2 above the roof there, a corbelled cap, smoke.
function chimney(B, res, x, z, size = 1) {
  const { m, S, F } = B
  if (!S.chimney) return
  let top = -1
  for (let i = 0; i < size; i += 1) for (let k = 0; k < size; k += 1) top = Math.max(top, cellTop(res, x + i, z + k))
  if (top < 0) return
  for (let i = 0; i < size; i += 1) for (let k = 0; k < size; k += 1) for (let y = F + 1; y <= top + 2; y += 1) m.set(x + i, y, z + k, S.chimney)
  for (let i = -1; i <= size; i += 1)
    for (let k = -1; k <= size; k += 1) {
      if ((i < 0 || i >= size) === (k < 0 || k >= size)) continue // corners and the stack itself
      const f = i < 0 ? 'east' : i >= size ? 'west' : k < 0 ? 'south' : 'north'
      m.set(x + i, top + 2, z + k, `minecraft:stone_brick_stairs[facing=${f},half=top]`, { keep: true })
    }
  m.set(x, top + 2, z, 'minecraft:campfire[lit=true,signal_fire=false,facing=north]')
  for (let i = 0; i < size; i += 1) for (let k = 0; k < size; k += 1) if (i || k) m.set(x + i, top + 3, z + k, 'minecraft:stone_brick_wall')
}

// ------------------------------------------------------------------ small details

// A lantern at (x, y, z) hanging on a chain from the first block above (within `reach`).
function hangLantern(B, x, y, z, reach = 8) {
  const { m, S } = B
  if (m.get(x, y, z)) return false
  let top = y + 1
  while (top <= y + reach && !m.get(x, top, z)) top += 1
  if (top > y + reach) return false
  for (let yy = y + 1; yy < top; yy += 1) m.set(x, yy, z, 'minecraft:chain[axis=y]')
  m.set(x, y, z, `${S.lantern}[hanging=true]`)
  return true
}

// Lantern on a bracket beside a door: an upside-down stair out of the wall, the lantern below.
function wallLantern(B, run, u, y) {
  const { m, S } = B
  const [x, z] = runAt(run, u, 1)
  if (m.get(x, y, z) || m.get(x, y + 1, z)) return
  m.set(x, y + 1, z, S.stairs(S.wood, OPP[run.f], 'top'))
  m.set(x, y, z, `${S.lantern}[hanging=true]`)
}

// Props on the frontage, clear of the door and the NPC.
function frontProps(B, run, keepOut, y, n) {
  const { m, S, rng } = B
  const spots = []
  for (let u = 0; u < run.L; u += 1) if (keepOut.every(k => Math.abs(u - k) >= 2)) spots.push(u)
  const order = rng.shuffle(spots)
  const kinds = rng.shuffle(S.T.props ?? ['barrel'])
  const count = Math.min(order.length, n ?? rng.int(1, 3))
  for (let i = 0; i < count; i += 1) {
    const u = order[i]
    const [x, z] = runAt(run, u, 1)
    const [nx, nz] = runAt(run, u + 1, 1)
    const k = kinds[i % kinds.length]
    if (m.get(x, y + 1, z)) continue
    const along = run.axis
    const cross = along === 'x' ? 'z' : 'x'
    if (k === 'barrel') {
      m.set(x, y + 1, z, 'minecraft:barrel[facing=up,open=false]')
      if (rng.chance(0.5) && !m.get(x, y + 2, z)) m.set(x, y + 2, z, rng.pick(['minecraft:potted_fern', 'minecraft:barrel[facing=up,open=false]', 'minecraft:flower_pot']))
    } else if (k === 'pumpkin') {
      m.set(x, y + 1, z, 'minecraft:pumpkin')
      if (rng.chance(0.6)) m.set(nx, y + 1, nz, `minecraft:carved_pumpkin[facing=${run.f}]`, { keep: true })
    } else if (k === 'carved') m.set(x, y + 1, z, `minecraft:jack_o_lantern[facing=${run.f}]`)
    else if (k === 'hay') {
      m.set(x, y + 1, z, `minecraft:hay_block[axis=${along}]`)
      if (rng.chance(0.5)) m.set(nx, y + 1, nz, `minecraft:hay_block[axis=${along}]`, { keep: true })
    } else if (k === 'logs') {
      m.set(x, y + 1, z, `minecraft:spruce_log[axis=${cross}]`)
      m.set(nx, y + 1, nz, `minecraft:spruce_log[axis=${cross}]`, { keep: true })
      if (!m.get(x, y + 2, z)) m.set(x, y + 2, z, `minecraft:spruce_log[axis=${cross}]`)
    } else if (k === 'composter') m.set(x, y + 1, z, 'minecraft:composter[level=5]')
    else if (k === 'grindstone') m.set(x, y + 1, z, `minecraft:grindstone[face=floor,facing=${CW[run.f]}]`)
    else if (k === 'pots') m.set(x, y + 1, z, rng.pick(['minecraft:potted_azalea_bush', 'minecraft:potted_flowering_azalea_bush', 'minecraft:potted_fern']))
    else if (k === 'bamboo') m.set(x, y + 1, z, 'minecraft:potted_bamboo')
    else if (k === 'amethyst') {
      m.set(x, y + 1, z, 'minecraft:amethyst_block')
      if (!m.get(x, y + 2, z)) m.set(x, y + 2, z, 'minecraft:amethyst_cluster[facing=up]')
    } else if (k === 'bench') m.set(x, y + 1, z, S.stairs(S.wood, OPP[run.f]))
    else if (k === 'lanternpost') {
      if (m.get(x, y + 2, z) || m.get(x, y + 3, z)) continue
      m.set(x, y + 1, z, S.fence)
      m.set(x, y + 2, z, `${S.lantern}[hanging=false]`)
    }
  }
}

// A front porch from u = a to b on the run: deck, posts at the outer corners (skipping any next
// to `clear`), a fascia beam and a pent roof of the roof material sloping to the street.
function porch(B, run, a, b, top, { clear = [] } = {}) {
  const { m, S } = B
  const f = run.f
  const roofFam = S.snow ? S.wood : S.roofFam
  for (let u = a; u <= b; u += 1)
    for (let d = 1; d <= 2; d += 1) {
      const [x, z] = runAt(run, u, d)
      m.set(x, B.F, z, S.floor)
      m.remove(x, B.F + 1, z)
    }
  for (const u of [a, b]) {
    if (clear.some(c => Math.abs(c - u) <= 1)) continue
    const [x, z] = runAt(run, u, 2)
    for (let y = B.F + 1; y < top; y += 1) m.set(x, y, z, S.frameY)
  }
  for (let u = a; u <= b; u += 1) {
    const [x2, z2] = runAt(run, u, 2)
    const [x1, z1] = runAt(run, u, 1)
    m.set(x2, top, z2, S.beam(run.axis))
    m.set(x2, top + 1, z2, S.stairs(roofFam, OPP[f]), { keep: true })
    m.set(x1, top + 1, z1, S.stairs(roofFam, OPP[f]), { keep: true })
    m.set(x1, top + 2, z1, S.stairs(roofFam, OPP[f]), { keep: true })
  }
  // a lantern under the porch roof
  const [lx, lz] = runAt(run, clear.length ? a + 1 : Math.round((a + b) / 2), 1)
  hangLantern(B, lx, top - 1, lz, 3)
}

// Japanese frontage: an engawa (veranda deck of slabs) under the deep eave, a stepping stone at
// the door, a noren (accent banner) over it and a stone lantern (toro) beside the house.
function engawa(B, run, u, npcU) {
  const { m, S, rng, F } = B
  for (let k = 0; k < run.L; k += 1) {
    if (Math.abs(k - u) <= 0 || (npcU !== null && Math.abs(k - npcU) <= 1)) continue
    const [x, z] = runAt(run, k, 1)
    if (!m.get(x, F + 1, z) || /_stairs$/.test(m.nameAt(x, F + 1, z) ?? '')) m.set(x, F + 1, z, 'minecraft:spruce_slab[type=bottom]')
  }
  const [sx, sz] = runAt(run, u, 1)
  m.set(sx, F + 1, sz, 'minecraft:polished_andesite_slab[type=bottom]')
  const [bx, bz] = runAt(run, u, 0)
  void bx
  void bz
  const [nx, nz] = runAt(run, u, 1)
  if (!m.get(nx, F + 4, nz)) m.set(nx, F + 4, nz, `minecraft:${S.accent}_wall_banner[facing=${run.f}]`)
  // toro: a stone lantern off one corner of the frontage
  const side = rng.chance(0.5) ? -2 : run.L + 1
  const [tx, tz] = runAt(run, side, 2)
  m.set(tx, F + 1, tz, 'minecraft:andesite_wall')
  m.set(tx, F + 2, tz, 'minecraft:polished_andesite')
  m.set(tx, F + 3, tz, `${S.lantern}[hanging=false]`)
  m.set(tx, F + 4, tz, 'minecraft:polished_andesite_slab[type=bottom]')
}

// Interior: rug, furniture against the back wall, a table, a hanging lantern.
function furnish(B, foot, y, ceil, { beds = true, use } = {}) {
  const { m, S, rng } = B
  const inner = foot.interior.length ? foot.interior : foot.cells.filter(([x, z]) => !foot.wall(x, z))
  if (!inner.length) return
  const set = new Set(inner.map(c => `${c[0]},${c[1]}`))
  const xs = inner.map(c => c[0])
  const zs = inner.map(c => c[1])
  const ix0 = Math.min(...xs)
  const ix1 = Math.max(...xs)
  const iz0 = Math.min(...zs)
  const iz1 = Math.max(...zs)
  const free = (x, z, yy = y + 1) => set.has(`${x},${z}`) && !m.get(x, yy, z)
  const cx = Math.round((ix0 + ix1) / 2)
  const cz = Math.round((iz0 + iz1) / 2)
  const rug = id(rng.pick(S.T.rug ?? ['brown_carpet']))
  for (let x = cx - 1; x <= cx + 1; x += 1) for (let z = cz - 1; z <= cz; z += 1) if (free(x, z)) m.set(x, y + 1, z, rug)
  const kinds = use === 'shop' ? ['barrel', 'chest', 'barrel', 'shelf', 'barrel', 'chest']
    : use === 'hall' ? ['shelf', 'shelf', 'lectern', 'shelf', 'chest', 'shelf']
      : rng.shuffle(['bed', 'chest', 'barrel', 'crafting', 'shelf', 'furnace', 'barrel', 'table'])
  let k = 0
  for (let x = ix0; x <= ix1 && k < kinds.length; x += 1) {
    const z = iz0
    if (!free(x, z)) continue
    const kind = kinds[k]
    k += 1
    if (kind === 'bed') {
      if (beds && free(x, z + 1)) {
        m.set(x, y + 1, z, `minecraft:${S.accent}_bed[part=head,facing=north]`)
        m.set(x, y + 1, z + 1, `minecraft:${S.accent}_bed[part=foot,facing=north]`)
        x += 1
      }
    } else if (kind === 'chest') m.set(x, y + 1, z, 'minecraft:chest[facing=south]')
    else if (kind === 'barrel') m.set(x, y + 1, z, 'minecraft:barrel[facing=up,open=false]')
    else if (kind === 'crafting') m.set(x, y + 1, z, 'minecraft:crafting_table')
    else if (kind === 'shelf') {
      m.set(x, y + 1, z, 'minecraft:bookshelf')
      if (ceil - y >= 4) m.set(x, y + 2, z, 'minecraft:bookshelf')
    } else if (kind === 'furnace') m.set(x, y + 1, z, 'minecraft:furnace[facing=south,lit=false]')
    else if (kind === 'lectern') m.set(x, y + 1, z, 'minecraft:lectern[facing=south,has_book=true]')
    else if (kind === 'table') {
      m.set(x, y + 1, z, S.slab(S.wood, 'top'))
      m.set(x, y + 2, z, rng.pick(['minecraft:candle[candles=2,lit=true]', 'minecraft:flower_pot', 'minecraft:potted_red_tulip']))
    }
  }
  if (free(cx, cz + 1) && free(cx - 1, cz + 1) && free(cx + 1, cz + 1) && ix1 - ix0 >= 3) {
    m.set(cx, y + 1, cz + 1, S.fence)
    m.set(cx, y + 2, cz + 1, id(S.wood.pressure_plate))
    m.set(cx - 1, y + 1, cz + 1, S.stairs(S.wood, 'east'))
    m.set(cx + 1, y + 1, cz + 1, S.stairs(S.wood, 'west'))
  }
  hangLantern(B, cx, Math.min(ceil - 2, y + 4), cz, 10)
}

// The best NPC position on a run among candidate u's: two cells or more from the run's ends (the
// corners carry quoins and notched logs), its click stand-off (u-1..u+1, 1-3 out) clear of the
// building. Falls back to the first candidate inside the run.
function npcSlot(B, run, cands, doorU) {
  const foot = B.foot0
  const ok = u => {
    if (u < 2 || u > run.L - 3 || Math.abs(u - doorU) < 1) return false
    for (let d = 1; d <= 3; d += 1) for (let k = -1; k <= 1; k += 1) {
      const [x, z] = runAt(run, u + k, d)
      if (foot?.has(x, z)) return false
    }
    return true
  }
  return cands.find(ok) ?? cands.find(u => u >= 1 && u <= run.L - 2 && u !== doorU) ?? clamp(doorU + 1, 0, run.L - 1)
}

// a hall NPC spot: off the run's ends, 2+ from the door, its stand-off (u-1..u+1, 1-3 out) free of
// the building and of anything already built there (the grand door's steps)
function hallNpcOk(B, run, u, doorU) {
  if (u < 2 || u > run.L - 3 || Math.abs(u - doorU) < 2) return false
  for (let d = 1; d <= 3; d += 1)
    for (let k = -1; k <= 1; k += 1) {
      const [x, z] = runAt(run, u + k, d)
      if (B.foot0?.has(x, z)) return false
      for (let h = 1; h <= 2; h += 1) if (B.m.get(x, B.F + h, z)) return false
    }
  return true
}

// ------------------------------------------------------------------ the house machine
function planHouse(B, W, D, storeys) {
  const { X0, X1, Z0, Z1, rng, S } = B
  const plans = ['block', 'block']
  if (W >= 11 && D >= 9) plans.push('wing', 'wing')
  if (W >= 11) plans.push('leanto')
  let plan = B.forcePlan ?? rng.pick(plans)
  if (S.T.roof.type === 'hip' && plan === 'leanto') plan = 'block'
  if (S.T.roof.type === 'east') plan = 'block'
  const rects = []
  if (plan === 'wing') {
    const k = D >= 11 ? 3 : 2
    const ww = W >= 13 ? 7 : 5
    const left = rng.chance(0.5)
    const wx0 = left ? X0 : X1 - ww + 1
    rects.push({ x0: X0, x1: X1, z0: Z0, z1: Z1 - k, axis: 'x', storeys, role: 'main' })
    rects.push({ x0: wx0, x1: wx0 + ww - 1, z0: Z0, z1: Z1, axis: 'z', storeys, role: 'wing', left })
  } else if (plan === 'leanto') {
    const L = W >= 13 ? 4 : 3
    const left = rng.chance(0.5)
    const mx0 = left ? X0 + L : X0
    const mx1 = left ? X1 : X1 - L
    const mw = mx1 - mx0 + 1
    rects.push({ x0: mx0, x1: mx1, z0: Z0, z1: Z1, axis: D > mw ? 'z' : mw - D >= 2 ? 'x' : rng.chance(0.5) ? 'x' : 'z', storeys, role: 'main' })
    rects.push({ x0: left ? X0 : mx1 + 1, x1: left ? X0 + L - 1 : X1, z0: Z0 + 1, z1: Z1 - 1, axis: 'z', storeys: 1, role: 'leanto', left })
  } else {
    let axis = W - D >= 2 ? 'x' : D - W >= 2 ? 'z' : rng.chance(0.5) ? 'x' : 'z'
    if (W - D >= 2 && rng.chance(0.25) && W <= 11) axis = 'z'
    rects.push({ x0: X0, x1: X1, z0: Z0, z1: Z1, axis, storeys, role: 'main' })
  }
  return { plan, rects }
}

// Builds walls, floors and roofs of a house plan. B.* gets the results (levels, roofRes, doorAt).
function buildHouse(B, { storeys, plan, rects, noDoor, skip } = {}) {
  const { m, S, rng, F } = B
  const main = rects[0]
  const [sx, , sz] = m.size
  const sysOf = s => {
    if (storeys === 1) return B.singleAlt ? S.T.singleAlt : S.T.single ?? S.T.system
    if (s === 0 && S.T.ground2) return S.T.ground2
    return S.T.system
  }
  const levels = []
  let y = F + 1
  for (let s = 0; s < storeys; s += 1) {
    const h = S.T.system === 'machiya' ? (storeys === 1 ? 6 : s === 0 ? 6 : 4) : S.T.system === 'quartz' ? (storeys === 1 ? 6 : 5) : storeys === 1 ? 5 : s === 0 ? 4 : 5
    levels.push({ s, y0: y, y1: y + h - 1 })
    y += h
  }
  const jetty = storeys >= 2 && rng() < (S.T.jetty ?? 0) && plan !== 'wing' ? 1 : 0
  const jettyBack = jetty && main.axis === 'x' && rng.chance(0.4)
  // floor and foundation
  const foot0 = footprint(sx, sz, rects)
  B.foot0 = foot0
  for (const [x, z] of foot0.cells) {
    m.set(x, F, z, foot0.wall(x, z) ? S.plinth : S.floor)
    for (let yy = F - 1; yy >= F - 2; yy -= 1) m.set(x, yy, z, S.plinth)
  }
  if (S.T.skirt) {
    for (const run of foot0.runs) for (let u = 0; u < run.L; u += 1) {
      const [x, z] = runAt(run, u, 1)
      if (!foot0.has(x, z)) m.set(x, F + 1, z, S.stairs(S.T.skirt, OPP[run.f]), { keep: true })
    }
  }
  let doorAt = null
  for (const lv of levels) {
    const active = rects.filter(r => r.storeys > lv.s)
    const rs = lv.s >= 1 && jetty ? active.map(r => (r === main ? { ...r, z1: r.z1 + 1, z0: jettyBack ? r.z0 - 1 : r.z0 } : r)) : active
    const foot = footprint(sx, sz, rs)
    const sys = sysOf(lv.s)
    B.sys = sys
    paintStorey(B, foot, lv.y0, lv.y1, sys, { ground: lv.s === 0, plate: lv.s === storeys - 1 || sys !== 'timber', sill: lv.s > 0 && sys === 'timber', band: lv.s > 0 })
    if (lv.s > 0) {
      for (const [x, z] of foot.cells) if (!foot.wall(x, z)) m.set(x, lv.y0, z, S.floor)
      if (jetty && lv.s === 1) {
        for (const run of foot.runs) {
          if (run.f !== 'south' && !(jettyBack && run.f === 'north')) continue
          for (const u of run.posts ?? []) {
            const [x, z] = run.cells[u]
            m.set(x, lv.y0 - 1, z, S.stairs(S.wood, OPP[run.f], 'top'))
          }
        }
      }
    }
    const d = fenestrate(B, foot, lv.y0, lv.y1, { door: lv.s === 0 && !noDoor, doorU: B.doorU, density: lv.s === 0 ? 0.7 : 0.8, skip: (run, u, w) => skip?.(run, u, w, lv) ?? false })
    if (d && !doorAt) doorAt = d
    lv.foot = foot
    lv.rects = rs
    lv.sys = sys
  }
  B.sysTop = levels[levels.length - 1].sys
  S.sysTop = B.sysTop
  const top = levels[levels.length - 1]
  const ye = top.y1 + 1
  const topRects = top.rects.filter(r => r.role !== 'leanto')
  B.levels = levels
  const res = buildRoof(B, topRects, ye, { axis: main.axis })
  const lean = rects.find(r => r.role === 'leanto')
  if (lean) {
    const ly = levels[0].y1 + 1
    const lr = m.roof({ x0: lean.x0, x1: lean.x1, z0: lean.z0, z1: lean.z1, y: ly, type: 'shed', axis: 'z', rises: lean.left ? 'east' : 'west', material: S.snow ? 'spruce' : S.roof, pitch: 1, overhang: 1, gableOverhang: 1, eaveTrim: true, overwrite: false })
    if (S.T.roof.barge) bargeboards(B, lr, lean, 'z', S.T.roof.barge)
  }
  Object.assign(B, { roofRes: res, levels, rects, plan, doorAt, ye, jetty })
  return B
}

// Dress a built house: chimney, porch, lanterns, props, interior.
function dressHouse(B, { npc = false, props = true } = {}) {
  const { m, S, rng, F } = B
  const res = B.roofRes
  const main = B.rects[0]
  if (res && S.chimney && rng.chance(0.8)) {
    const size = main.x1 - main.x0 >= 10 && rng.chance(0.5) ? 2 : 1
    if (main.axis === 'x') {
      const left = rng.chance(0.5)
      chimney(B, res, left ? main.x0 + 1 : main.x1 - size, Math.round((main.z0 + main.z1) / 2) + (rng.chance(0.5) ? 1 : -1) * 2, size)
    } else chimney(B, res, rng.chance(0.5) ? main.x0 + 2 : main.x1 - 1 - size, main.z0 + 1, size)
  }
  const lv0 = B.levels[0]
  const out = {}
  if (B.doorAt) {
    const { run, u } = B.doorAt
    const top = lv0.y1 >= F + 5 ? F + 4 : F + 3
    let npcU = null
    if (npc) {
      // the NPC stands on the frontage beside the door, under the porch roof
      npcU = npcSlot(B, run, [u + 2, u - 2, u + 3, u - 3, u + 1, u - 1], u)
      const a = Math.max(0, Math.min(u, npcU) - 1)
      const b = Math.min(run.L - 1, Math.max(u, npcU) + 1)
      porch(B, run, a, b, top, { clear: [npcU] })
      const [nx, nz] = runAt(run, npcU, 1)
      out.npcPos = [nx, F, nz]
      m.set(nx, F, nz, S.T.roof.type === 'east' ? 'minecraft:polished_andesite' : S.trim.block)
    } else if (rng() < (S.T.porch ?? 0)) {
      porch(B, run, Math.max(0, u - 2), Math.min(run.L - 1, u + 2), top)
    } else {
      const side = rng.chance(0.5) ? -1 : 1
      wallLantern(B, run, u + side, F + 3)
    }
    if (S.key === 'japanese') engawa(B, run, u, npcU)
    if (props) frontProps(B, run, npcU === null ? [u] : [u, npcU], F)
    const [dx, dz] = runAt(run, u, 1)
    out.door = [dx, F, dz]
  }
  furnish(B, lv0.foot, F, lv0.y1 + 1, { beds: B.levels.length === 1, use: B.use })
  if (B.levels.length >= 2) furnish(B, B.levels[1].foot, B.levels[1].y0, B.levels[1].y1 + 1, { beds: true })
  return out
}

// ------------------------------------------------------------------ kinds

function kindHouse(ctx, spec, B) {
  const plan = planHouse(B, B.W, B.D, B.storeys)
  buildHouse(B, { storeys: B.storeys, ...plan })
  return dressHouse(B, { npc: Boolean(spec.npc) })
}

// Shop: a house whose street front opens on a counter under a striped awning in the accent colour,
// goods at the counter's ends, a hanging sign on a bracket; the NPC stands behind the counter.
function kindShop(ctx, spec, B) {
  const { m, S, rng, F, X0, X1, Z1 } = B
  const W = B.W
  B.use = 'shop'
  B.forcePlan = 'block'
  const sw = W >= 11 ? 5 : 3
  const left = rng.chance(0.5)
  // the shop front sits off-centre, the door in the remaining bay
  const s0 = left ? 1 : W - 1 - sw
  const s1 = s0 + sw - 1
  B.doorU = left ? Math.min(W - 2, s1 + 2.5) : Math.max(1, s0 - 2.5)
  const plan = planHouse(B, W, B.D, B.storeys)
  plan.rects[0].axis = W - B.D >= 2 ? 'x' : plan.rects[0].axis
  buildHouse(B, { storeys: B.storeys, ...plan, skip: (run, u, w, lv) => lv.s === 0 && run.f === 'south' && u + w - 1 >= s0 - 1 && u <= s1 + 1 })
  const lv0 = B.levels[0]
  const run = lv0.foot.runs.find(r => r.f === 'south' && r.cells[0][1] === Z1)
  const out = {}
  if (run) {
    const f = run.f
    const head = Math.min(lv0.y1, F + 4)
    // the opening: posts at its ends, a lintel beam, the counter
    for (let u = s0; u <= s1; u += 1) {
      for (let y = F + 1; y < head; y += 1) {
        const [x, z] = runAt(run, u, 0)
        m.set(x, y, z, 'air')
      }
      const [x, z] = runAt(run, u, 0)
      m.set(x, head, z, B.sys === 'quartz' ? S.trim.block : S.beam(run.axis))
      m.set(x, F + 1, z, S.stairs(S.wood, OPP[f], 'top'))
    }
    for (const u of [s0 - 1, s1 + 1]) {
      const [x, z] = runAt(run, u, 0)
      for (let y = F + 1; y <= head; y += 1) m.set(x, y, z, B.sys === 'quartz' ? 'minecraft:quartz_pillar[axis=y]' : S.frameY)
    }
    const npcU = Math.round((s0 + s1) / 2)
    // wares on the counter, clear of the NPC
    const wares = rng.shuffle(['minecraft:potted_red_tulip', 'minecraft:candle[candles=3,lit=true]', 'minecraft:flower_pot', 'minecraft:potted_fern', 'minecraft:cake'])
    let wi = 0
    for (let u = s0; u <= s1; u += 1) if (Math.abs(u - npcU) >= 2 || (sw === 3 && u !== npcU && rng.chance(0.5))) {
      const [x, z] = runAt(run, u, 0)
      m.set(x, F + 2, z, wares[wi++ % wares.length])
    }
    // the awning: accent and white stripes stepping down to the street
    const stripe = u => ((u - s0) % 2 === 0 ? `minecraft:${S.accent}_wool` : 'minecraft:white_wool')
    for (let u = s0 - 1; u <= s1 + 1; u += 1) {
      const [x1, z1] = runAt(run, u, 1)
      const [x2, z2] = runAt(run, u, 2)
      m.set(x1, head, z1, stripe(u), { keep: true })
      m.set(x2, head - 1, z2, stripe(u), { keep: true })
      if (u === s0 - 1 || u === s1 + 1) m.set(x2, head - 2, z2, S.trapdoor(f, true, 'bottom'), { keep: true })
    }
    // stock behind the counter and goods at its ends
    for (let u = s0; u <= s1; u += 1) {
      if (u === npcU) continue
      const [x, z] = runAt(run, u, -2)
      if (lv0.foot.has(x, z) && !lv0.foot.wall(x, z)) m.set(x, F + 1, z, rng.chance(0.5) ? 'minecraft:barrel[facing=up,open=false]' : 'minecraft:chest[facing=south,type=single]')
    }
    const goods = S.key === 'autumn' ? ['minecraft:pumpkin', 'minecraft:hay_block[axis=y]', 'minecraft:barrel[facing=up,open=false]', 'minecraft:melon']
      : S.key === 'winter' ? ['minecraft:barrel[facing=up,open=false]', 'minecraft:spruce_log[axis=y]', 'minecraft:barrel[facing=up,open=false]']
        : ['minecraft:barrel[facing=up,open=false]', 'minecraft:hay_block[axis=y]', 'minecraft:barrel[facing=up,open=false]', 'minecraft:melon']
    for (const u of [s0 - 2, s1 + 2]) {
      if (u < 0 || u > run.L - 1) continue
      const [x, z] = runAt(run, u, 1)
      if (m.get(x, F + 1, z) && !/_stairs$/.test(m.nameAt(x, F + 1, z) ?? '')) continue
      m.set(x, F + 1, z, rng.pick(goods))
      if (rng.chance(0.5)) m.set(x, F + 2, z, rng.pick(['minecraft:potted_fern', 'minecraft:barrel[facing=up,open=false]', 'minecraft:flower_pot']))
    }
    // the hanging sign on a bracket beside the opening
    const su = left ? s1 + 2 : s0 - 2
    if (su >= 0 && su <= run.L - 1) {
      const [x, z] = runAt(run, su, 1)
      if (!m.get(x, head, z)) m.set(x, head, z, `${id(S.wood.wall_hanging_sign ?? 'minecraft:spruce_wall_hanging_sign')}[facing=${CW[f]}]`)
    }
    // a lantern over the counter, off the NPC
    const [lx, lz] = runAt(run, npcU + (left ? 1 : -1), -1)
    hangLantern(B, lx, head - 1, lz, 4)
    const [nx, nz] = runAt(run, npcU, -1)
    out.npcPos = [nx, F, nz]
    out.counter = true
    B.reserve = new Set([`${nx},${nz}`])
  }
  const d = dressHouse(B, { npc: false })
  return { ...d, ...out, door: d.door ?? (out.npcPos ? [out.npcPos[0], F, out.npcPos[2] + 2] : undefined) }
}

// Hall: the landmark. A two-storey main block with a cross-gabled entrance pavilion on the street,
// a tower at one corner, a grand door with a stone surround, banners, chimneys.
function kindHall(ctx, spec, B) {
  const { m, S, rng, F, X0, X1, Z0, Z1 } = B
  const W = B.W
  const D = B.D
  const storeys = Math.max(2, B.storeys)
  void rng
  const p = D >= 15 ? 4 : 3
  const pw = W >= 21 ? 9 : 7
  const px0 = X0 + Math.floor((W - pw) / 2)
  const rects = [
    { x0: X0, x1: X1, z0: Z0, z1: Z1 - p, axis: 'x', storeys, role: 'main' },
    { x0: px0, x1: px0 + pw - 1, z0: Z0, z1: Z1, axis: 'z', storeys, role: 'wing' },
  ]
  const east = S.T.roof.type === 'east'
  if (east) {
    rects.splice(1, 1)
    rects[0].z1 = Z1
  }
  const cu = px0 + Math.floor(pw / 2) - X0 // the entrance column (u on the pavilion front)
  B.use = 'hall'
  buildHouse(B, { storeys, plan: 'hall', rects, noDoor: true, skip: (run, u, w, lv) => lv.s === 0 && run.f === 'south' && run.cells[0][1] === Z1 && Math.abs(u + run.cells[0][0] - X0 + (w - 1) / 2 - cu) <= 2 })
  const lv0 = B.levels[0]
  const zf = Z1
  const run = lv0.foot.runs.find(r => r.f === 'south' && r.cells[0][1] === zf && r.cells.some(c => c[0] === X0 + cu))
  const out = {}
  if (run) {
    const u = run.cells.findIndex(c => c[0] === X0 + cu)
    grandDoor(B, run, u)
    const [dx, dz] = runAt(run, u, 1)
    out.door = [dx, F, dz]
    // banners in the accent colour flanking the door, lanterns on brackets
    for (const s of [-3, 3]) {
      const [bx, bz] = runAt(run, u + s, 1)
      if (u + s > 0 && u + s < run.L - 1 && !m.get(bx, F + 4, bz)) m.set(bx, F + 4, bz, `minecraft:${S.accent}_wall_banner[facing=${run.f}]`)
    }
    if (spec.npc) {
      // beside the grand door when the entrance front is wide enough, else on the main front to
      // one side of the entrance wing (its click stand-off must clear the wing and the door steps)
      let nrun = run
      let nu = [u + 3, u - 3, u + 4, u - 4].find(k => hallNpcOk(B, run, k, u))
      if (nu === undefined) {
        const doorX = run.cells[u][0]
        for (const r of lv0.foot.runs.filter(r => r.f === 'south' && r !== run)) {
          const ks = r.cells.map((c, k) => k).sort((a, b) => Math.abs(r.cells[a][0] - doorX) - Math.abs(r.cells[b][0] - doorX))
          const k = ks.find(k => hallNpcOk(B, r, k, -9) && Math.abs(r.cells[k][0] - doorX) >= 4)
          if (k !== undefined) {
            nrun = r
            nu = k
            break
          }
        }
      }
      nu ??= npcSlot(B, run, [u + 3, u - 3, u + 4, u - 4], u)
      porch(B, nrun, nu - 1, nu + 1, lv0.y1 >= F + 5 ? F + 4 : F + 3, { clear: [nu] })
      const [nx, nz] = runAt(nrun, nu, 1)
      out.npcPos = [nx, F, nz]
      m.set(nx, F, nz, S.trim.block)
    } else {
      for (const s of [-2, 2]) wallLantern(B, run, u + s, F + 3)
    }
    if (east) engawa(B, run, u, null)
  }
  // the tower: at a back corner, or on the street corner beside the pavilion
  const ts = W >= 19 && D >= 13 ? 7 : 5
  const front = !east && rng.chance(0.5) && p >= 3
  const leftT = rng.chance(0.5)
  const tx0 = leftT ? X0 : X1 - ts + 1
  const tz0 = front ? Z1 - p - ts + Math.min(p, 3) : Z0
  const ridge = B.roofRes ? B.roofRes.topY : B.ye + 6
  const tTop = Math.max(ridge + 3, B.ye + 7)
  tower(B, { x0: tx0, z0: tz0, size: ts, y0: F + 1, top: tTop, front: 'south', door: false, belfry: true })
  // chimneys on the main block
  const res = B.roofRes
  if (res && S.chimney) {
    const cx = leftT ? X1 - 2 : X0 + 1
    chimney(B, res, cx, Z0 + 2, 1)
  }
  const lv1 = B.levels[1]
  furnish(B, lv0.foot, F, lv0.y1 + 1, { beds: false, use: 'hall' })
  if (lv1) furnish(B, lv1.foot, lv1.y0, lv1.y1 + 1, { beds: true })
  return out
}

// A grand door on a run at u: a double-height stone or timber surround with a round head, the
// door in the middle, sidelights, steps, lanterns.
function grandDoor(B, run, u) {
  const { m, S, F } = B
  const f = run.f
  const set = (uu, d, y, p, o) => {
    const [x, z] = runAt(run, uu, d)
    m.set(x, y, z, p, o)
  }
  const stone = B.sys === 'quartz' ? { block: 'minecraft:quartz_bricks', stairs: S.trim } : { block: id(bare(S.theme.wall.quoin === S.theme.timber ? 'stone_bricks' : S.theme.wall.quoin)), stairs: S.trim }
  const jamb = B.sys === 'quartz' ? 'minecraft:quartz_pillar[axis=y]' : B.sys === 'log' ? 'minecraft:spruce_log[axis=y]' : stone.block
  // opening 3 wide, 4 tall, recessed one; the door (2 wide) at the back with a transom
  for (let i = -1; i <= 1; i += 1) for (let y = F + 1; y <= F + 4; y += 1) {
    set(u + i, 0, y, 'air')
    set(u + i, -1, y, 'air')
  }
  const [ddx, ddz] = runAt(run, u - 1, -1)
  m.door([ddx, F + 1, ddz], f, { material: S.door, width: 2 })
  set(u + 1, -1, F + 1, B.sys === 'quartz' ? 'minecraft:quartz_pillar[axis=y]' : S.frameY)
  set(u + 1, -1, F + 2, B.sys === 'quartz' ? 'minecraft:quartz_pillar[axis=y]' : S.frameY)
  for (let i = -1; i <= 1; i += 1) set(u + i, -1, F + 3, `minecraft:${S.accent}_stained_glass_pane`)
  for (let i = -1; i <= 1; i += 1) set(u + i, -1, F + 4, S.frameY)
  // the surround: jambs, a round head of stairs, a keystone
  for (const i of [-2, 2]) for (let y = F + 1; y <= F + 4; y += 1) set(u + i, 0, y, jamb)
  set(u - 1, 0, F + 4, S.stairs(S.trim, CCW[f], 'top'))
  set(u + 1, 0, F + 4, S.stairs(S.trim, CW[f], 'top'))
  for (let i = -2; i <= 2; i += 1) set(u + i, 0, F + 5, i === 0 ? S.trim.block : stone.block)
  for (let i = -3; i <= 3; i += 1) set(u + i, 1, F + 5, S.stairs(S.trim, OPP[f], 'top'), { keep: true })
  // steps
  for (let i = -1; i <= 1; i += 1) set(u + i, 1, F + 1, S.slab(S.trim, 'bottom'), { keep: true })
  for (const i of [-2, 2]) set(u + i, 1, F + 1, S.stairs(S.trim, OPP[f]), { keep: true })
}

// A square tower body x0..x0+size-1, z0.. from y0 to top (wall top), with narrow windows, a
// belfry storey and the theme's roof. Used by halls (corner tower) and the tower kind.
function tower(B, { x0, z0, size, y0, top, door = true, belfry = true }) {
  const { m, S, rng, F } = B
  const r = { x0, z0, x1: x0 + size - 1, z1: z0 + size - 1 }
  const [sx, , sz] = m.size
  // clear what another roof left inside the tower
  for (let x = r.x0; x <= r.x1; x += 1) for (let z = r.z0; z <= r.z1; z += 1) for (let y = y0; y <= top + 20; y += 1) if (y > B.ye - 1 || !B.levels) m.remove(x, y, z)
  const foot = footprint(sx, sz, [r])
  const sys = S.T.system === 'machiya' ? 'machiya' : S.T.system === 'log' ? 'log' : S.T.system === 'quartz' ? 'quartz' : 'stone'
  const saved = { posts: B.posts, sys: B.sys }
  B.sys = sys
  const T0 = S.T.postEvery
  S.T.postEvery = size >= 7 ? 2 : 1
  paintStorey(B, foot, y0, top, sys, { ground: y0 === F + 1, plate: true })
  S.T.postEvery = T0
  // storey bands: a floor every 5, narrow windows, the belfry at the top
  for (let y = y0 + 4; y < top - 4; y += 5) {
    for (const [x, z] of foot.cells) if (!foot.wall(x, z)) m.set(x, y, z, S.floor)
    if (sys !== 'log') for (const run of foot.runs) for (let u = 0; u < run.L; u += 1) {
      const [x, z] = runAt(run, u, 1)
      m.set(x, y, z, S.stairs(S.trim, OPP[run.f], 'top'), { keep: true })
    }
  }
  for (const run of foot.runs) {
    const mid = Math.floor((run.L - 1) / 2)
    for (let y = y0 + 6; y < top - 5; y += 5) {
      const [x, z] = runAt(run, mid, 0)
      const [ix, iz] = runAt(run, mid, -1)
      m.set(x, y, z, 'air')
      m.set(x, y + 1, z, 'air')
      m.set(ix, y, iz, S.glass)
      m.set(ix, y + 1, iz, S.glass)
      m.set(x, y - 1, z, S.stairs(S.trim, OPP[run.f], 'bottom'))
    }
    if (belfry) {
      // belfry: arched openings 1-3 wide below the plate
      const w = run.L >= 7 ? 3 : 1
      const a = mid - Math.floor(w / 2)
      for (let i = 0; i < w; i += 1) for (let y = top - 4; y <= top - 2; y += 1) {
        const [x, z] = runAt(run, a + i, 0)
        m.set(x, y, z, 'air')
      }
      if (w === 3) {
        const [x1, z1] = runAt(run, a, 0)
        const [x3, z3] = runAt(run, a + 2, 0)
        m.set(x1, top - 2, z1, S.stairs(S.trim, CCW[run.f], 'top'))
        m.set(x3, top - 2, z3, S.stairs(S.trim, CW[run.f], 'top'))
      }
      for (let i = -1; i <= w; i += 1) {
        const [x, z] = runAt(run, a + i, 1)
        m.set(x, top - 5, z, S.slab(S.trim, 'top'), { keep: true })
      }
    }
  }
  if (belfry) {
    for (const [x, z] of foot.cells) if (!foot.wall(x, z)) m.set(x, top - 5, z, S.floor)
    const c = Math.floor(size / 2)
    m.set(x0 + c, top - 1, z0 + c, 'minecraft:bell[attachment=ceiling,facing=south]')
    hangLantern(B, x0 + c - 1, top - 3, z0 + c, 2)
  }
  if (door) {
    const run = foot.runs.find(q => q.f === 'south')
    const u = Math.floor((run.L - 1) / 2)
    opening(B, run, u, 1, F + 1, 2, 'door')
    B.doorAt = { run, u }
    for (let y = F + 1; y <= F + 3; y += 1) {
      const [x, z] = runAt(run, u, 0)
      if (y === F + 3) m.set(x, y, z, S.trim.block)
    }
  }
  B.posts = saved.posts
  B.sys = saved.sys
  return towerRoof(B, r, top + 1)
}

// The roof of a square tower in the theme: a steep pyramid (curved, tiled or snowy), a swept
// East-Asian pyramid, a low classical hip with a cornice, a bell roof on fantasy towers.
function towerRoof(B, r, y) {
  const { m, S } = B
  const size = r.x1 - r.x0 + 1
  const cx = (r.x0 + r.x1) / 2
  const cz = (r.z0 + r.z1) / 2
  const R = S.T.roof
  if (R.type === 'east') {
    return m.eastRoof({ ...r, y, type: 'pyramid', material: S.roof, ridge: 'deepslate_tile', rafter: 'spruce', pitch: [0.5, 0.5, 1, 1, 1], overhang: 2, lift: 1, brackets: true, lanterns: true, finial: ['minecraft:polished_blackstone_wall', 'minecraft:lightning_rod'] })
  }
  if (S.key === 'fantasy') {
    const res = m.bellRoof([Math.round(cx), y, Math.round(cz)], size / 2 + 1.5, size + 3, { material: S.roof, finial: ['minecraft:amethyst_block', 'minecraft:end_rod[facing=up]'] })
    return res
  }
  if (R.type === 'hip') {
    const res = m.roof({ ...r, y, type: 'pyramid', material: S.roof, pitch: [1, 1, 1, 2], overhang: 1, eaveTrim: true })
    m.set(Math.round(cx), res.topY + 1, Math.round(cz), 'minecraft:lightning_rod[facing=up]')
    return res
  }
  const snowy = S.snow
  const mat = snowy ? { stairs: 'minecraft:smooth_quartz_stairs', slab: 'minecraft:smooth_quartz_slab', block: 'minecraft:snow_block' } : S.roof
  const pitch = R.profile === 'curve' || R.profile === 'bell' ? [0.5, 0.5, 1, 2, 2, 3] : [1, 2, 2, 3]
  const res = m.roof({ ...r, y, type: 'pyramid', material: mat, pitch, overhang: 1, eaveTrim: true })
  if (snowy) snowEdges(B, res)
  m.set(Math.round(cx), res.topY + 1, Math.round(cz), S.key === 'autumn' ? 'minecraft:spruce_fence' : 'minecraft:stone_brick_wall')
  m.set(Math.round(cx), res.topY + 2, Math.round(cz), 'minecraft:lightning_rod[facing=up]')
  return res
}

// Tower kind: a standalone corner or landmark tower; japanese towers are pagodas.
function kindTower(ctx, spec, B) {
  const { m, S, F, X0, X1, Z0, Z1, rng } = B
  const size = Math.min(B.W, B.D) | 1
  const x0 = X0 + Math.floor((B.W - size) / 2)
  const z0 = Z1 - size + 1
  const out = {}
  B.levels = null
  B.ye = F + 1
  // a stone pad with a stair skirt
  for (let x = x0 - 1; x <= x0 + size; x += 1) for (let z = z0 - 1; z <= z0 + size; z += 1) {
    m.set(x, F, z, S.plinth)
    for (let yy = F - 1; yy >= F - 2; yy -= 1) m.set(x, yy, z, S.plinth)
  }
  if (S.T.roof.type === 'east') {
    const c = Math.floor(size / 2)
    m.pagoda({ center: [x0 + c, F + 1, z0 + c], tiers: size >= 9 ? 4 : 3, width: size, overhang: 2, storey: [7, 5, 5, 5], material: S.roof, ridge: 'deepslate_tile', rafter: 'spruce', wall: 'minecraft:calcite', post: 'minecraft:dark_oak_log', beam: S.frame, lift: 1, thickness: 1.5 })
    out.door = [x0 + c, F, z0 + size]
  } else {
    const storeys = clamp(spec.storeys ?? (size >= 7 ? 3 : 3), 2, 4)
    const top = F + storeys * 5 + 1
    tower(B, { x0, z0, size, y0: F + 1, top, door: true, belfry: true })
    if (B.doorAt) {
      const { run, u } = B.doorAt
      const [dx, dz] = runAt(run, u, 1)
      out.door = [dx, F, dz]
      if (spec.npc) {
        const nu = u + 1 <= run.L - 1 ? u + 1 : u - 1
        const [nx, nz] = runAt(run, nu, 1)
        out.npcPos = [nx, F, nz]
        m.set(nx, F, nz, S.trim.block)
        // a little canopy over the NPC and the door
        for (let i = Math.min(u, nu) - 1; i <= Math.max(u, nu) + 1; i += 1) {
          const [x, z] = runAt(run, i, 1)
          m.set(x, F + 4, z, S.stairs(S.snow ? S.wood : S.roofFam, OPP[run.f], 'bottom'), { keep: true })
        }
      } else wallLantern(B, run, u + (rng.chance(0.5) ? 1 : -1), F + 3)
    }
  }
  void X1
  void Z0
  return out
}

// Columns for open structures, in the theme: timber posts with knee braces, classical quartz
// columns, stone piers.
function column(B, x, z, y0, y1, along) {
  const { m, S } = B
  if (S.key === 'white-town') {
    m.set(x, y0, z, S.trim.block)
    for (let y = y0 + 1; y < y1; y += 1) m.set(x, y, z, 'minecraft:quartz_pillar[axis=y]')
    m.set(x, y1, z, 'minecraft:chiseled_quartz_block')
    return
  }
  if (S.key === 'fantasy') {
    m.set(x, y0, z, 'minecraft:mossy_stone_bricks')
    for (let y = y0 + 1; y < y1; y += 1) m.set(x, y, z, S.frameY)
    m.set(x, y1, z, 'minecraft:stripped_birch_wood')
    return
  }
  const base = S.key === 'japanese' ? 'minecraft:polished_andesite' : S.key === 'winter' ? 'minecraft:stone_bricks' : 'minecraft:cobblestone'
  m.set(x, y0, z, base)
  for (let y = y0 + 1; y <= y1; y += 1) m.set(x, y, z, S.key === 'japanese' ? 'minecraft:dark_oak_log[axis=y]' : S.frameY)
  void along
}

// Arcade: an open-fronted colonnade hall. Back and side walls in the theme's wall system, the
// street side open between columns under a beam with knee braces or arches, the theme's roof.
//   opts: cols (u positions of the front columns), height (column height), npc
function kindArcade(ctx, spec, B, opts = {}) {
  const { m, S, F, X0, X1, Z0, Z1, rng } = B
  const W = B.W
  const D = B.D
  const H = opts.height ?? (D >= 11 ? 6 : 5)
  const rect = { x0: X0, x1: X1, z0: Z0, z1: Z1, axis: 'x', storeys: 1, role: 'main' }
  const [sx, , sz] = m.size
  const foot = footprint(sx, sz, [rect])
  // floor: paving in the theme's plinth stones with a border, foundation
  for (const [x, z] of foot.cells) {
    const edge = foot.wall(x, z)
    m.set(x, F, z, edge ? S.plinth : opts.floor ?? (S.key === 'white-town' ? 'minecraft:polished_andesite' : S.key === 'japanese' ? 'minecraft:spruce_planks' : 'minecraft:stone_bricks'))
    for (let yy = F - 1; yy >= F - 2; yy -= 1) m.set(x, yy, z, S.plinth)
  }
  const sys = S.T.system === 'quartz' ? 'quartz' : S.T.system === 'log' ? 'log' : S.T.system === 'machiya' ? 'machiya' : S.T.ground2 ?? 'stone'
  B.sys = sys
  const y1 = F + H
  const wallTop = Math.max(y1, opts.wallTop ?? y1)
  paintStorey(B, foot, F + 1, wallTop, sys, { ground: true, plate: true })
  const front = foot.runs.find(r => r.f === 'south')
  const cols = opts.cols ?? (() => {
    const n = Math.max(1, Math.floor((W - 1) / 4))
    return Array.from({ length: n + 1 }, (_, i) => Math.round((i * (W - 1)) / n))
  })()
  // open the front between the columns
  for (let u = 0; u < front.L; u += 1) {
    const [x, z] = runAt(front, u, 0)
    if (cols.includes(u)) {
      column(B, x, z, F + 1, y1 - 1, 'x')
      continue
    }
    for (let y = F + 1; y < y1; y += 1) m.remove(x, y, z)
  }
  for (let u = 0; u < front.L; u += 1) {
    const [x, z] = runAt(front, u, 0)
    m.set(x, y1, z, sys === 'quartz' ? S.trim.block : S.beam('x'))
  }
  // heads between the columns: round arches (stone and quartz) or knee braces (timber)
  for (let i = 0; i + 1 < cols.length; i += 1) {
    const a = cols[i]
    const b = cols[i + 1]
    const span = b - a - 1
    if (span <= 0) continue
    if (sys === 'stone' || sys === 'quartz' || S.key === 'fantasy') {
      const [xa, za] = runAt(front, a + 1, 0)
      const [xb, zb] = runAt(front, b - 1, 0)
      m.set(xa, y1 - 1, za, S.stairs(S.trim, 'west', 'top'))
      m.set(xb, y1 - 1, zb, S.stairs(S.trim, 'east', 'top'))
      if (span >= 4) {
        const [xa2, za2] = runAt(front, a + 2, 0)
        const [xb2, zb2] = runAt(front, b - 2, 0)
        m.set(xa2, y1 - 1, za2, S.slab(S.trim, 'top'))
        m.set(xb2, y1 - 1, zb2, S.slab(S.trim, 'top'))
        m.set(xa, y1 - 2, za, S.stairs(S.trim, 'west', 'top'))
        m.set(xb, y1 - 2, zb, S.stairs(S.trim, 'east', 'top'))
      }
    } else {
      const [xa, za] = runAt(front, a + 1, 0)
      const [xb, zb] = runAt(front, b - 1, 0)
      m.set(xa, y1 - 1, za, S.stairs(S.wood, 'west', 'top'))
      m.set(xb, y1 - 1, zb, S.stairs(S.wood, 'east', 'top'))
    }
    // a lantern hanging in each bay
    const mid = Math.round((a + b) / 2)
    const [lx, lz] = runAt(front, mid, -1)
    if (!opts.noLanterns) hangLantern(B, lx, y1 - 2, lz, 3)
  }
  // windows on the back and sides
  fenestrate(B, { ...foot, runs: foot.runs.filter(r => r.f !== 'south') }, F + 1, y1, { door: false, density: 0.55 })
  if (wallTop > y1 + 3) fenestrate(B, { ...foot, runs: foot.runs.filter(r => r.f === 'east' || r.f === 'west') }, y1 + 1, wallTop, { door: false, density: 0.6 })
  B.levels = [{ s: 0, y0: F + 1, y1: wallTop, foot, rects: [rect], sys }]
  B.sysTop = sys
  S.sysTop = sys
  B.ye = wallTop + 1
  let res
  if (S.T.roof.type === 'east') res = eastRoofFor(B, [rect], wallTop + 1, 'x')
  else res = buildRoof(B, [rect], wallTop + 1, { axis: 'x' })
  B.roofRes = res
  const out = {}
  const cu = Math.round((W - 1) / 2)
  const [dx, dz] = runAt(front, cu, 1)
  out.door = [dx, F, dz]
  if (spec.npc && !opts.noNpc) {
    // the NPC stands just inside the colonnade, on a plinth block, under a lantern
    const bays = []
    for (let i = 0; i + 1 < cols.length; i += 1) if (cols[i + 1] - cols[i] >= 4) bays.push(Math.round((cols[i] + cols[i + 1]) / 2))
    let nu = bays.length ? bays.reduce((a, c) => (Math.abs(c - cu) < Math.abs(a - cu) ? c : a)) : cu
    if (cols.some(c => Math.abs(c - nu) <= 1)) nu = cu
    const [nx, nz] = runAt(front, nu, -1)
    out.npcPos = [nx, F, nz]
    m.set(nx, F, nz, S.trim.block)
    const [bx, bz] = runAt(front, nu, -2)
    m.set(bx, F + 1, bz, 'minecraft:barrel[facing=up,open=false]')
    m.set(bx, F + 2, bz, `${S.lantern}[hanging=false]`)
  }
  if (!opts.bare) {
    // benches and pots along the back wall
    const back = foot.runs.find(r => r.f === 'north')
    for (let u = 2; u < back.L - 2; u += 4) {
      const [x, z] = runAt(back, u, -1)
      if (!m.get(x, F + 1, z)) m.set(x, F + 1, z, S.stairs(S.wood, 'north'))
      const [x2, z2] = runAt(back, u + 1, -1)
      if (!m.get(x2, F + 1, z2)) m.set(x2, F + 1, z2, rng.pick(['minecraft:potted_fern', 'minecraft:barrel[facing=up,open=false]', 'minecraft:potted_azalea_bush']))
    }
  }
  return out
}

// Pavilion: an open shelter on columns over a raised deck: a gazebo, a shrine pavilion, a market
// pavilion. Round with a bell roof in fantasy, a swept pyramid in japanese, columns and a hip
// with a cornice in the white town, a steep tiled or curved roof elsewhere.
function kindPavilion(ctx, spec, B) {
  const { m, S, F, X0, X1, Z0, Z1, rng } = B
  const W = B.W
  const D = B.D
  const H = 4
  const deck = F + 1
  const out = {}
  const cx = (X0 + X1) / 2
  const cz = (Z0 + Z1) / 2
  const round = S.key === 'fantasy'
  const inside = (x, z) => (round ? Math.hypot(x - cx, z - cz) <= Math.min(W, D) / 2 : x >= X0 && x <= X1 && z >= Z0 && z <= Z1)
  // the deck: a stone platform one high with a stair skirt, timber or stone floor
  for (let x = X0 - 1; x <= X1 + 1; x += 1)
    for (let z = Z0 - 1; z <= Z1 + 1; z += 1) {
      if (inside(x, z)) {
        for (let yy = F - 2; yy <= F; yy += 1) m.set(x, yy, z, S.plinth)
        m.set(x, deck, z, S.key === 'white-town' ? 'minecraft:polished_andesite' : S.key === 'japanese' || S.key === 'autumn' || S.key === 'winter' ? S.floor : 'minecraft:stone_bricks')
        continue
      }
      // skirt: stairs facing in where a deck cell is next door
      const n = FACINGS.find(f => inside(x + DV[f][0], z + DV[f][1]))
      if (n) m.set(x, deck, z, S.stairs(S.T.skirt ?? 'stone_brick', n), { keep: true })
    }
  // posts
  const posts = []
  if (round) {
    const R = Math.min(W, D) / 2 - 0.5
    const n = W >= 11 ? 8 : 6
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n
      posts.push([Math.round(cx + Math.cos(a) * R), Math.round(cz + Math.sin(a) * R)])
    }
  } else {
    const xs = runPosts(W, W >= 11 ? 4 : 5).map(u => X0 + u)
    const zs = runPosts(D, D >= 11 ? 4 : 5).map(u => Z0 + u)
    for (const x of xs) for (const z of [Z0, Z1]) posts.push([x, z])
    for (const z of zs) for (const x of [X0, X1]) posts.push([x, z])
  }
  const seen = new Set()
  for (const [x, z] of posts) {
    if (seen.has(`${x},${z}`)) continue
    seen.add(`${x},${z}`)
    column(B, x, z, deck + 1, deck + H, 'x')
  }
  // a beam ring on the posts (square plans) and a railing between back posts
  if (!round) {
    for (let x = X0; x <= X1; x += 1) for (const z of [Z0, Z1]) if (!seen.has(`${x},${z}`)) m.set(x, deck + H, z, S.key === 'white-town' ? S.trim.block : S.beam('x'))
    for (let z = Z0; z <= Z1; z += 1) for (const x of [X0, X1]) if (!seen.has(`${x},${z}`)) m.set(x, deck + H, z, S.key === 'white-town' ? S.trim.block : S.beam('z'))
    for (let x = X0 + 1; x < X1; x += 1) if (!seen.has(`${x},${Z0}`)) m.set(x, deck + 1, Z0, S.fence)
    // knee braces
    for (const [x, z] of posts) {
      if (S.key === 'white-town') continue
      if (x > X0 && x < X1) continue
      for (const f of ['east', 'west']) {
        const nx = x + DV[f][0]
        if (nx >= X0 && nx <= X1 && !seen.has(`${nx},${z}`)) m.set(nx, deck + H - 1, z, S.stairs(S.wood, OPP[f], 'top'), { keep: true })
      }
    }
  }
  // roof
  const y = deck + H + 1
  const r = { x0: X0, z0: Z0, x1: X1, z1: Z1 }
  let res
  if (round) {
    res = m.bellRoof([Math.round(cx), y - 1, Math.round(cz)], Math.min(W, D) / 2 + 1.5, Math.min(W, D) + 1, { material: S.roof, finial: ['minecraft:amethyst_block', 'minecraft:end_rod[facing=up]'] })
  } else if (S.T.roof.type === 'east') {
    res = m.eastRoof({ ...r, y, type: W === D ? 'pyramid' : 'irimoya', material: S.roof, ridge: 'deepslate_tile', rafter: 'spruce', pitch: [0.5, 0.5, 1, 1, 1], overhang: 2, lift: 1, brackets: true, lanterns: true, finial: W === D ? ['minecraft:polished_blackstone_wall', 'minecraft:lightning_rod'] : undefined, gable: S.infill, barge: true })
  } else if (S.T.roof.type === 'hip') {
    res = m.roof({ ...r, y, type: 'hip', material: S.roof, pitch: [1, 1, 1, 0.5], overhang: 1, eaveTrim: true })
    for (let x = X0 - 1; x <= X1 + 1; x += 1) for (const z of [Z0 - 1, Z1 + 1]) m.set(x, deck + H, z, S.stairs(S.trim, z < Z0 ? 'south' : 'north', 'top'), { keep: true })
    for (let z = Z0; z <= Z1; z += 1) for (const x of [X0 - 1, X1 + 1]) m.set(x, deck + H, z, S.stairs(S.trim, x < X0 ? 'east' : 'west', 'top'), { keep: true })
  } else {
    const snowy = S.snow
    const mat = snowy ? { stairs: 'minecraft:smooth_quartz_stairs', slab: 'minecraft:smooth_quartz_slab', block: 'minecraft:snow_block' } : S.roof
    const pitch = S.T.roof.profile === 'curve' ? [0.5, 0.5, 1, 1, 2] : [1, 1, 2]
    const sq = Math.abs(W - D) <= 2
    res = m.roof({ ...r, y, type: sq ? 'pyramid' : 'gable', axis: W >= D ? 'x' : 'z', material: mat, pitch, overhang: 1, eaveTrim: true })
    if (!sq && S.T.roof.barge) bargeboards(B, res, r, W >= D ? 'x' : 'z', S.T.roof.barge)
    if (snowy) snowEdges(B, res)
    else mottle(B, res)
    if (sq) m.set(Math.round(cx), res.topY + 1, Math.round(cz), S.key === 'autumn' ? 'minecraft:spruce_fence' : 'minecraft:lightning_rod[facing=up]')
  }
  B.roofRes = res
  // a lantern hanging in the middle, a bench or two
  const lc = [Math.round(cx), Math.round(cz)]
  const npcAt = [lc[0], Math.round(cz) + (D >= 9 ? 1 : 0)]
  if (spec.npc) {
    m.set(npcAt[0], deck, npcAt[1], S.trim.block)
    out.npcPos = [npcAt[0], deck, npcAt[1]]
    hangLantern(B, lc[0] + 1, deck + H - 1, lc[1] - 1, 6)
  } else {
    hangLantern(B, lc[0], deck + H - 1, lc[1], 6)
    if (!round) for (const x of [X0 + 1, X1 - 1]) if (!m.get(x, deck + 1, Math.round(cz))) m.set(x, deck + 1, Math.round(cz), S.stairs(S.wood, x < cx ? 'west' : 'east'))
  }
  out.door = [Math.round(cx), F, Z1 + 2]
  out.npcFloor = deck
  void rng
  return out
}

// ------------------------------------------------------------------ dispatcher

const BUILDERS = { house: kindHouse, shop: kindShop, hall: kindHall, tower: kindTower, arcade: kindArcade, pavilion: kindPavilion }

function sizeFor(ctx, spec, kind) {
  let range = KINDS[kind] ?? KINDS.house
  if (kind === 'arcade') {
    // the arcade's long side may run along the street: check the sorted dimensions
    const ns0 = spec.facing === 'north' || spec.facing === 'south' || !FACINGS.includes(spec.facing)
    const fw0 = ns0 ? Math.abs(spec.x1 - spec.x0) + 1 : Math.abs(spec.z1 - spec.z0) + 1
    const fd0 = ns0 ? Math.abs(spec.z1 - spec.z0) + 1 : Math.abs(spec.x1 - spec.x0) + 1
    if (fw0 > fd0) range = { min: [range.min[1], range.min[0]], max: [range.max[1], range.max[0]] }
  }
  const facing = FACINGS.includes(spec.facing) ? spec.facing : 'south'
  const ns = facing === 'north' || facing === 'south'
  const fw = ns ? Math.abs(spec.x1 - spec.x0) + 1 : Math.abs(spec.z1 - spec.z0) + 1
  const fd = ns ? Math.abs(spec.z1 - spec.z0) + 1 : Math.abs(spec.x1 - spec.x0) + 1
  let W = fw
  let D = fd
  if (W > range.max[0] || D > range.max[1]) {
    ctx.warn(`${kind} ${fw}x${fd} is larger than ${range.max.join('x')}: built at the largest size, centred in its slot`)
    W = Math.min(W, range.max[0])
    D = Math.min(D, range.max[1])
  }
  if (W < range.min[0] || D < range.min[1]) ctx.warn(`${kind} ${fw}x${fd} is smaller than ${range.min.join('x')}: built as small as it goes`)
  return { W: Math.max(5, W), D: Math.max(5, D) }
}

function newBuilding(ctx, spec, kind, { W, D, storeys, pad = 5, height } = {}) {
  const seed = Number.isFinite(spec.seed) ? spec.seed : ctx.rng.int(0, 1e6)
  const S = styleFor(ctx, seed)
  const rng = ctx.kit.rng(seed * 7 + 3)
  const fr = makeFrame(ctx, spec, { W, D, height: height ?? 36 + Math.max(W, D) + 6 * storeys, pad })
  const B = { ctx, kit: ctx.kit, S, rng, ...fr, flowers: (S.T.flowers ?? ['poppy']).map(id), storeys }
  B.singleAlt = Boolean(S.T.singleAlt) && rng() < (S.T.singleAltP ?? 0)
  B.roofVariant = rng.chance(0.4) ? 1 : 0
  B.shutters = rng() < (S.T.win?.shutters ?? 0)
  B.boxes = rng() < (S.T.win?.box ?? 0) * 1.6
  B.doorU = rng.pick([0.3, 0.5, 0.5, 0.7]) * (W - 1)
  return B
}

// Record the NPC: npcSpot with style 'none' at the spot the kind prepared, facing the street,
// with its head room and click stand-off registered (finish warns if a later edit fills them).
function placeNpc(ctx, B, spec, out) {
  const fr = B
  const p = fr.toW(...(out.npcPos ?? out.door ?? [Math.round((B.X0 + B.X1) / 2), B.F, B.Z1 + 1]))
  const facing = fr.dirW('south')
  const rec = ctx.b.npcSpot(p, facing, { ...ctx.M, ...spec.npc, style: 'none' })
  const [fx, fz] = DV[facing]
  const [rx, rz] = DV[CCW[facing]]
  const cells = [1, 2, 3].map(h => [p[0], p[1] + h, p[2]])
  const d0 = out.counter ? 2 : 1
  for (let d = d0; d <= d0 + 1; d += 1) for (const u of [-1, 0, 1]) for (const h of [1, 2]) cells.push([p[0] + fx * d + rx * u, p[1] + h, p[2] + fz * d + rz * u])
  for (const c of cells) {
    const n = ctx.b.nameAt(...c)
    if (!n) continue
    if (/(_stairs|_slab|_carpet|_trapdoor|grass|fern|flower|tulip|poppy|dandelion|lantern|chain|barrel|pumpkin|hay_block|composter|_log|_fence|melon|pot.*|amethyst.*)$/.test(n) && !(c[1] === p[1] + 3 && /(_log|_stairs|_slab)$/.test(n))) ctx.b.remove(...c)
    else ctx.warn(`${spec.kind} "${spec.npc.id}": ${n.replace('minecraft:', '')} in the NPC clearance at ${c.join(',')}`)
  }
  ctx.b.spawnClearance ??= []
  ctx.b.spawnClearance.push({ label: `building ${spec.kind} npc "${spec.npc.id}"`, cells: cells.filter(c => !ctx.b.nameAt(...c)) })
  return rec
}

export function building(ctx, spec) {
  const kind = KINDS[spec.kind] ? spec.kind : 'house'
  if (!KINDS[spec.kind]) ctx.warn(`unknown building kind "${spec.kind}": built a house`)
  const { W, D } = sizeFor(ctx, spec, kind)
  const seed0 = Number.isFinite(spec.seed) ? spec.seed : 0
  const storeys = clamp(Math.round(spec.storeys ?? (kind === 'hall' ? 2 : ctx.kit.rng(seed0 * 7 + 3)() < 0.35 ? 2 : 1)), 1, 3)
  const B = newBuilding(ctx, spec, kind, { W, D, storeys, height: kind === 'tower' ? 60 : undefined })
  const out = BUILDERS[kind](ctx, spec, B) ?? {}
  B.stamp()
  const bounds = B.worldBounds()
  const door = B.toW(...(out.door ?? [Math.round((B.X0 + B.X1) / 2), B.F, B.Z1 + 1]))
  const npc = spec.npc ? placeNpc(ctx, B, spec, out) : undefined
  let interior
  if (B.levels?.[0]?.foot) {
    const c = B.levels[0].foot.interior
    if (c.length) {
      const a = B.toW(Math.min(...c.map(q => q[0])), B.F, Math.min(...c.map(q => q[1])))
      const z = B.toW(Math.max(...c.map(q => q[0])), B.levels[0].y1, Math.max(...c.map(q => q[1])))
      interior = { min: [Math.min(a[0], z[0]), a[1], Math.min(a[2], z[2])], max: [Math.max(a[0], z[0]), z[1], Math.max(a[2], z[2])] }
    }
  }
  return { door, bounds, top: bounds.max[1], npc, interior }
}

// The dark field behind block letters (quartz letters need >= 30 L* of contrast).
const signWall = S => (S.key === 'white-town' ? 'minecraft:polished_deepslate' : S.key === 'fantasy' ? 'minecraft:dark_prismarine' : S.key === 'winter' ? 'minecraft:spruce_planks' : S.key === 'crimson' ? 'minecraft:polished_blackstone' : 'minecraft:dark_oak_planks')

// Repaint the non-post cells of a run between y0 and y1 (a sign band on a facade).
function paintBand(B, run, y0, y1, paint, { u0 = 1, u1 = run.L - 2 } = {}) {
  const { m } = B
  for (let u = u0; u <= u1; u += 1) {
    const [x, z] = runAt(run, u, 0)
    for (let y = y0; y <= y1; y += 1) {
      const n = m.nameAt(x, y, z) ?? ''
      if (/_log$|_wood$|quartz_pillar/.test(n) && (run.posts ?? []).includes(u)) continue
      m.set(x, y, z, paint)
    }
  }
}

// ------------------------------------------------------------------ hero wall

// The hero of a normal spawn: the leaderboards (kit) set into a themed structure, with the server
// name in quartz block letters on a board above them. Canonical frame: the boards face south (the
// players), the structure lives north of z. Flanking towers carry the theme's roofs; the attic
// over the boards carries the name; a gallery roof over the attic ties it together.
export function heroWall(ctx, { x0, x1, z0, z1, y, cx, z, width, facing = 'south', boards = [], name }) {
  const { b, kit } = ctx
  const fwall = FACINGS.includes(facing) ? facing : 'south'
  const ns = fwall === 'north' || fwall === 'south'
  const out = DV[fwall]
  // the slot: x0..x1 along the front, z0..z1 deep; `z` is the boards' front line, `cx` their centre
  if ([x0, x1, z0, z1].some(v => v === undefined)) {
    const hw = Math.floor((width ?? 40) / 2)
    const back = 9
    if (ns) [x0, x1, z0, z1] = [cx - hw, cx + hw, Math.min(z - out[1] * back, z + out[1] * 3), Math.max(z - out[1] * back, z + out[1] * 3)]
    else [x0, x1, z0, z1] = [Math.min(z - out[0] * back, z + out[0] * 3), Math.max(z - out[0] * back, z + out[0] * 3), cx - hw, cx + hw]
  }
  const spec = { kind: 'hero', x0, x1, z0, z1, y, facing: fwall, seed: ctx.seed * 17 + 5 }
  const fullW = ns ? Math.abs(x1 - x0) + 1 : Math.abs(z1 - z0) + 1
  const fullD = ns ? Math.abs(z1 - z0) + 1 : Math.abs(x1 - x0) + 1
  const B = newBuilding(ctx, spec, 'hero', { W: fullW, D: fullD, storeys: 2, pad: 4, height: 64 })
  const { m, S, F, X0, X1, Z0, Z1 } = B
  // module position of the boards' centre and front line
  const lx = ns ? (fwall === 'south' ? (cx ?? (x0 + x1) / 2) - Math.min(x0, x1) : Math.max(x0, x1) - (cx ?? (x0 + x1) / 2)) : (fwall === 'west' ? (cx ?? (z0 + z1) / 2) - Math.min(z0, z1) : Math.max(z0, z1) - (cx ?? (z0 + z1) / 2))
  const bcx = X0 + clamp(Math.round(lx), 0, fullW - 1)
  const lz = z === undefined ? fullD - 4 : ns ? (fwall === 'south' ? z - Math.min(z0, z1) : Math.max(z0, z1) - z) : (fwall === 'east' ? z - Math.min(x0, x1) : Math.max(x0, x1) - z)
  const frontZ = Z0 + clamp(Math.round(lz), 6, fullD - 1)
  const n = boards.length
  const kitOpts = { ...ctx.M, count: n, ids: boards.map(q => q.id), labels: boards.map(q => q.label), podium: n >= 3 }
  // measure the kit's board wall on a scratch module: its span and the crown of its middle bay
  let ua = bcx - 10
  let ub = bcx + 10
  let crown = F + 14
  let wallTop = F + 14
  if (n) {
    const scratch = ctx.b.module(m.size)
    scratch.leaderboards([bcx, F, frontZ], 'south', kitOpts)
    const bb = scratch.bounds()
    ua = bb.min[0]
    ub = bb.max[0]
    wallTop = scratch.topY(ua + 2, frontZ - 1)
    for (let x = ua; x <= ub; x += 1) for (let zz = frontZ - 4; zz <= frontZ; zz += 1) crown = Math.max(crown, scratch.topY(x, zz))
  }
  // the name: medium letters if they fit over the board wall, else small, else two lines
  let text = name ? String(name).trim() : ''
  let font = 'medium'
  if (text) {
    const room = Math.max(20, ub - ua - 4)
    if (kit.signWidth(text, 'medium') > room) font = 'small'
    if (kit.signWidth(text, font) > room && text.includes(' ')) {
      // break into balanced lines: the fewest lines that fit, then the narrowest split
      const words = text.split(/\s+/)
      const splits = (ws, k) => {
        if (k === 1) return [[ws.join(' ')]]
        const out = []
        for (let a = 1; a <= ws.length - k + 1; a += 1) for (const rest of splits(ws.slice(a), k - 1)) out.push([ws.slice(0, a).join(' '), ...rest])
        return out
      }
      let best = text
      for (let k = 2; k <= Math.min(4, words.length); k += 1) {
        for (const lines of splits(words, k)) {
          const t = lines.join('\n')
          if (kit.signWidth(t, font) < kit.signWidth(best, font)) best = t
        }
        if (kit.signWidth(best, font) <= room) break
      }
      text = best
    }
    if (kit.signWidth(text, font) > fullW - 4) ctx.warn(`heroWall: the name "${name}" is wider than the hero slot (${kit.signWidth(text, font)} > ${fullW - 4})`)
  }
  const tw = text ? kit.signWidth(text, font) : 0
  const th = text ? kit.signHeight(text, font) : 0
  // the attic carries the name board just clear of the middle bay's crest
  const letterBottom = crown + 2
  const letterTop = letterBottom + th - 1
  const atticTop = text ? letterTop + 2 : wallTop + 4
  const ax0 = text ? Math.max(X0 + 1, bcx - Math.ceil(tw / 2) - 3) : bcx - 6
  const ax1 = text ? Math.min(X1 - 1, bcx + Math.ceil(tw / 2) + 3) : bcx + 6
  const az1 = frontZ - 2
  const az0 = Math.max(Z0, frontZ - 6)
  B.levels = null
  B.ye = F + 1
  // the towers rise behind the ends of the board wall (or flank it when the slot is wide)
  const flank = ua - X0 >= 8 && X1 - ub >= 8
  const ts = flank || fullD >= 13 ? 7 : 5
  const tl = flank ? ua - ts : Math.max(X0, Math.min(ua, ax0 - ts))
  const tr = flank ? ub + 1 : Math.min(X1 - ts + 1, Math.max(ub - ts + 1, ax1 + 1))
  const tz0 = flank ? frontZ - ts + 1 : Math.max(Z0, frontZ - 4 - ts)
  const towerTop = atticTop + 3
  for (const tx of [tl, tr]) {
    for (let x = tx - 1; x <= tx + ts; x += 1) for (let zz = tz0 - 1; zz <= tz0 + ts; zz += 1) for (let yy = F - 2; yy <= F; yy += 1) m.set(x, yy, zz, S.plinth)
    tower(B, { x0: tx, z0: tz0, size: ts, y0: F + 1, top: towerTop, door: false, belfry: true })
  }
  // the wall body behind the boards (the attic and galleries stand on it)
  for (let x = ua + 1; x <= ub - 1; x += 1) for (let zz = az0; zz <= frontZ - 3; zz += 1) for (let yy = F; yy < wallTop; yy += 1) m.set(x, yy, zz, S.plinth, { keep: true })
  // galleries over the wall top between the attic and the towers: a pent roof on posts
  const roofFam = S.snow ? S.wood : S.roofFam
  for (const [g0, g1] of [[tl + ts, ax0 - 1], [ax1 + 1, tr - 1]]) {
    if (g1 - g0 < 1) continue
    for (let x = g0; x <= g1; x += 1) {
      for (let zz = az0; zz <= frontZ - 4; zz += 1) m.set(x, wallTop, zz, S.floor)
      if ((x - g0) % 3 === 0 || x === g1) for (let yy = wallTop + 1; yy <= wallTop + 2; yy += 1) m.set(x, yy, frontZ - 3, S.frameY)
      else m.set(x, wallTop + 1, frontZ - 3, S.fence)
      m.set(x, wallTop + 3, frontZ - 3, S.beam('x'))
      m.set(x, wallTop + 4, frontZ - 3, S.stairs(roofFam, 'north'))
      m.set(x, wallTop + 4, frontZ - 4, S.stairs(roofFam, 'north'))
      m.set(x, wallTop + 5, frontZ - 5, S.stairs(roofFam, 'north'))
      m.set(x, wallTop + 4, az0, S.infill, { keep: true })
      for (let yy = wallTop + 1; yy <= wallTop + 4; yy += 1) m.set(x, yy, az0, yy === wallTop + 4 ? S.beam('x') : S.infill)
      if ((x - g0) % 3 === 1) hangLantern(B, x, wallTop + 2, frontZ - 4, 2)
    }
  }
  // the attic: the theme's walls around the name board, its own roof along the front
  const sys = S.T.system === 'quartz' ? 'quartz' : S.T.system === 'log' ? 'log' : S.T.system === 'machiya' ? 'machiya' : 'timber'
  B.sys = sys
  const [sx, , sz] = m.size
  const afoot = footprint(sx, sz, [{ x0: ax0, x1: ax1, z0: az0, z1: az1 }])
  for (let x = ax0; x <= ax1; x += 1) for (let zz = az0; zz <= az1; zz += 1) for (let yy = F; yy < wallTop; yy += 1) m.set(x, yy, zz, S.plinth, { keep: true })
  const T0 = S.T.postEvery
  S.T.postEvery = 4
  paintStorey(B, afoot, wallTop, atticTop, sys, { plate: true, sill: sys === 'timber' })
  S.T.postEvery = T0
  for (const [x, zz] of afoot.cells) if (!afoot.wall(x, zz)) m.set(x, wallTop, zz, S.floor)
  const afront = afoot.runs.find(r => r.f === 'south')
  if (afront && text) {
    // a dark panel behind the letters, a sill under it, a row of windows in the wall below
    const c = bcx - ax0
    paintBand(B, afront, letterBottom - 1, letterTop + 1, signWall(S), { u0: Math.max(1, c - Math.ceil(tw / 2) - 1), u1: Math.min(afront.L - 2, c + Math.ceil(tw / 2) + 1) })
    for (let u = 0; u < afront.L; u += 1) {
      const [x, zz] = runAt(afront, u, 1)
      m.set(x, letterBottom - 2, zz, S.stairs(S.trim, 'north', 'top'))
    }
    if (letterBottom - 3 - wallTop >= 4) fenestrate(B, { ...afoot, runs: [afront] }, wallTop + 1, letterBottom - 3, { door: false, density: 0.9 })
  }
  for (let y0 = wallTop + 1; y0 + 4 <= atticTop; y0 += 5) fenestrate(B, { ...afoot, runs: afoot.runs.filter(r => r.f !== 'south') }, y0, y0 + 4, { door: false, density: 0.75 })
  const roofRect = { x0: ax0, x1: ax1, z0: az0, z1: az1, axis: 'x', storeys: 1, role: 'main' }
  B.levels = [{ s: 0, y0: wallTop, y1: atticTop, foot: afoot, rects: [roofRect], sys }]
  B.sysTop = sys
  S.sysTop = sys
  if (S.T.roof.type === 'east') eastRoofFor(B, [roofRect], atticTop + 1, 'x')
  else if (S.T.roof.type === 'hip') {
    // the white town: an entablature, a low pediment roof and acroteria over the attic
    m.roof({ x0: ax0, x1: ax1, z0: az0, z1: az1, y: atticTop + 1, type: 'gable', axis: 'x', material: S.roof, pitch: [1, 0.5], overhang: 1, eaveTrim: true })
    for (let x = ax0 - 1; x <= ax1 + 1; x += 1) m.set(x, atticTop, az1 + 1, S.stairs(S.trim, 'north', 'top'))
  } else {
    // a cross gable over the middle of the name breaks the long attic roof
    const gw = 9
    const center = { x0: bcx - (gw >> 1), x1: bcx + (gw >> 1), z0: az0, z1: az1, axis: 'z', storeys: 1, role: 'wing' }
    buildRoof(B, ax1 - ax0 >= gw + 6 ? [roofRect, center] : [roofRect], atticTop + 1, { axis: 'x' })
  }
  // the towers' street faces: a door, banners in the accent colour, lanterns on brackets
  for (const tx of [tl, tr]) {
    const bx = tx + Math.floor(ts / 2)
    const tf = tz0 + ts - 1
    if (!m.get(bx, F + 7, tf + 1)) m.set(bx, F + 7, tf + 1, `minecraft:${S.accent}_wall_banner[facing=south]`)
    if (flank) {
      for (let yy = F + 1; yy <= F + 2; yy += 1) m.set(bx, yy, tf, 'air')
      m.door([bx, F + 1, tf], 'south', { material: S.door })
      for (const dx of [-1, 1]) {
        m.set(bx + dx, F + 4, tf + 1, S.stairs(S.wood, 'north', 'top'))
        m.set(bx + dx, F + 3, tf + 1, `${S.lantern}[hanging=true]`)
      }
    }
  }
  B.stamp()
  // the kit pieces in world coordinates: the leaderboards, then the name on the attic
  const fw = B.dirW('south')
  if (n) b.leaderboards(B.toW(bcx, F, frontZ), fw, kitOpts)
  if (text) {
    const board = S.key === 'white-town' ? 'minecraft:polished_deepslate' : S.key === 'fantasy' ? 'minecraft:dark_prismarine' : S.key === 'winter' ? 'minecraft:spruce_planks' : S.key === 'crimson' ? 'minecraft:polished_blackstone' : 'minecraft:dark_oak_planks'
    const frame = S.key === 'white-town' ? 'minecraft:smooth_quartz' : S.key === 'fantasy' ? 'minecraft:prismarine_bricks' : S.key === 'winter' ? 'minecraft:stripped_spruce_wood' : S.key === 'crimson' ? 'minecraft:red_nether_bricks' : 'minecraft:polished_deepslate'
    void board
    void frame
    b.sign(text, B.toW(bcx, letterTop, az1 + 1), fw, { font, align: 'center' })
  }
  return { bounds: B.worldBounds() }
}

// ------------------------------------------------------------------ crate hall

// The crates section: a two-storey arcade in the theme whose open side faces the plaza: a crate
// station (kit crateRow, 5 apart, each facing out) in every bay with its standing area under the
// roof, columns between the standing areas, and CRATES in block letters on the upper facade.
export function crateHall(ctx, { x0, z0, x1, z1, y, facing = 'east', crates = [] }) {
  const { b, kit } = ctx
  const fwall = FACINGS.includes(facing) ? facing : 'east'
  const ns = fwall === 'north' || fwall === 'south'
  const fullW = ns ? Math.abs(x1 - x0) + 1 : Math.abs(z1 - z0) + 1
  const fullD = ns ? Math.abs(z1 - z0) + 1 : Math.abs(x1 - x0) + 1
  const n = crates.length
  const W = Math.max(fullW, 5 * n + 7)
  if (W > fullW) ctx.warn(`crateHall: ${n} crates need ${W} blocks of frontage, the slot has ${fullW}`)
  const D = clamp(fullD, 12, 14)
  const spec = { kind: 'crates', x0, x1, z0, z1, y, facing: fwall, seed: ctx.seed * 19 + 3 }
  const B = newBuilding(ctx, spec, 'arcade', { W, D, storeys: 1, pad: 4, height: 48 })
  const { m, S, F, X0, Z0, Z1 } = B
  // stations: crate k at u = m0 + 5k + 2; columns at u = m0 + 5k, between the standing areas
  const m0 = Math.floor((W - 5 * n) / 2)
  const cols = new Set([0, W - 1])
  for (let k = 0; k <= n; k += 1) cols.add(m0 + 5 * k)
  const text = 'CRATES'
  const font = 'small'
  const th = kit.signHeight(text, font)
  const H = 6
  const top = F + H + th + 4
  kindArcade(ctx, { ...spec, npc: null }, B, { cols: [...cols].filter(u => u >= 0 && u < W).sort((p, q) => p - q), height: H, wallTop: top, noNpc: true, bare: true })
  const front = B.levels[0].foot.runs.find(r => r.f === 'south')
  if (front) {
    const tw = kit.signWidth(text, font)
    const c = Math.floor((W - 1) / 2)
    paintBand(B, front, F + H + 1, top - 1, signWall(S), { u0: c - Math.ceil(tw / 2) - 2, u1: c + Math.ceil(tw / 2) + 2 })
    for (let u = c - Math.ceil(tw / 2) - 3; u <= c + Math.ceil(tw / 2) + 3; u += 1) {
      const [x, zz] = runAt(front, u, 1)
      m.set(x, F + H + 1, zz, S.stairs(S.trim, 'north', 'top'), { keep: true })
    }
  }
  B.stamp()
  const fw = B.dirW('south')
  if (n) b.crateRow(B.toW(X0 + m0 + 2, F + 2, Z0 + 6), fw, crates.map(c => ({ ...c, label: `${c.label} Crate` })), { ...ctx.M, spacing: 5 })
  b.sign(text, B.toW(X0 + Math.floor((W - 1) / 2), F + H + th + 2, Z1 + 1), fw, { font, align: 'center' })
  return { bounds: B.worldBounds() }
}
