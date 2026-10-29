// The spawn audit: numbers from the finished blocks that say whether a spawn is done, measured the
// same way on every build so "it looks fine" is not the judge. finishSpawn's finish() runs it
// (spawn builds only) and run-build prints it; a spawn whose audit fails is not exported unless
// asked to (--force-export), because what it measures is what makes a spawn look unfinished:
//   bare land   the largest stretch of plain lawn with nothing on it, and how much of the land is
//               lawn far from anything (a big canvas must be filled: woods, rocks, buildings, water)
//   flat land   the share of the land within 2 blocks of one level (a disc with a few blobs on it)
//   bridges     decks laid flat on the water (a bridge arches 6-10 above it; §5.5)
//   repeats     buildings with the same footprint and height (every building is its own design)
//   NPCs        how far apart the stands are (§5.10: 6-8)
//   views       from the spawn, the share of directions with something standing within 160 blocks
//   physics     sand and gravel with nothing under them, sugar cane with no water, still water
//               touching air (all break or flow the moment the spawn is pasted)
// Guide: references/spawns/build-guide.md §2.3 (the quality gate).

const SOIL = /^minecraft:(grass_block|dirt|coarse_dirt|podzol|rooted_dirt|mycelium|moss_block|mud|sand|red_sand|snow_block|snow|powder_snow|clay|farmland)$/
const PLANT = /^minecraft:(short_grass|tall_grass|fern|large_fern|dead_bush|.*_tulip|dandelion|poppy|blue_orchid|allium|azure_bluet|oxeye_daisy|cornflower|lily_of_the_valley|wither_rose|sunflower|lilac|rose_bush|peony|pink_petals|sweet_berry_bush|.*_sapling|moss_carpet|brown_mushroom|red_mushroom|torchflower|pitcher_plant|leaf_litter|bush|firefly_bush|short_dry_grass|tall_dry_grass)$/
const ROCK = /^minecraft:(stone|andesite|diorite|granite|tuff|deepslate|calcite|gravel|cobblestone|mossy_cobblestone|cobbled_deepslate|smooth_basalt|basalt|blackstone|dripstone_block|pointed_dripstone|terracotta|.*_terracotta|sandstone|red_sandstone|packed_ice|blue_ice|ice|obsidian|magma_block|amethyst_block|stone_button|andesite_slab|cobblestone_slab|stone_slab|tuff_slab|cobblestone_stairs|stone_stairs|andesite_stairs|tuff_stairs|mossy_cobblestone_slab|mossy_cobblestone_stairs)$/
const TREE = /_(log|wood|leaves|stem|hyphae)$|^minecraft:(mangrove_roots|muddy_mangrove_roots|shroomlight|nether_wart_block|warped_wart_block|bamboo|vine|hanging_roots|azalea|flowering_azalea|.*_wool)$/
const WATER = /^minecraft:(water|bubble_column|kelp|kelp_plant|seagrass|tall_seagrass|lily_pad|sugar_cane)$/

const INVISIBLE = /^minecraft:(light|barrier|structure_void|air|cave_air|void_air)$/

const SOIL_C = 1
const PLANT_C = 2
const ROCK_C = 3
const TREE_C = 4
const WATER_C = 5
const BUILT_C = 6

// From the builder (finish() calls this).
export function auditSpawn(b, opts = {}) {
  const [sx, , sz] = b.size
  const src = {
    size: b.size,
    focus: b.focus,
    get: (x, y, z) => b.get(x, y, z),
    each: cb => b.blocks.each((k, block) => {
      const x = k % sx
      const rest = (k - x) / sx
      const z = rest % sz
      cb(x, (rest - z) / sz, z, block)
    }),
  }
  return auditBlocks(src, { placements: b.placements ?? [], ...opts })
}

// From a saved build: a palette of state strings (0 = air) and a grid indexed (y * Z + z) * X + x,
// as blockview's loadGrid gives it (the judge uses this on any .nbt).
export function auditGrid({ pal, G, X, Y, Z }, opts = {}) {
  const blocks = pal.map(st => {
    if (!st || /^minecraft:(air|cave_air|void_air|structure_void)$/.test(st.split('[')[0])) return null
    const [name, rest] = st.split('[')
    const props = rest ? Object.fromEntries(rest.slice(0, -1).split(',').map(kv => kv.split('='))) : undefined
    return { name, props }
  })
  const src = {
    size: [X, Y, Z],
    get: (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z ? null : blocks[G[(y * Z + z) * X + x]]),
    each: cb => {
      for (let y = 0; y < Y; y += 1)
        for (let z = 0; z < Z; z += 1) {
          const row = (y * Z + z) * X
          for (let x = 0; x < X; x += 1) {
            const id = G[row + x]
            if (id && blocks[id]) cb(x, y, z, blocks[id])
          }
        }
    },
  }
  return auditBlocks(src, opts)
}

function auditBlocks(src, { inside = () => true, placements = [] } = {}) {
  const b = { get: (x, y, z) => { const blk = src.get(x, y, z); return blk && !INVISIBLE.test(blk.name) ? blk : null }, focus: src.focus }
  const [sx, sy, sz] = src.size
  const n = sx * sz
  // a focus draft is judged on its box (one district), a full build on the whole canvas
  const box = b.focus ?? [0, 0, sx - 1, sz - 1]
  const inBox = (x, z) => x >= box[0] && x <= box[2] && z >= box[1] && z <= box[3]
  const top = new Int16Array(n).fill(-1)
  const topC = new Uint8Array(n)
  const ground = new Int16Array(n).fill(-1)
  const water = new Int16Array(n).fill(-1)
  const groundName = new Uint16Array(n) // which block the ground is, per column (an index into names)
  const topName = new Uint16Array(n)
  const nameIds = new Map([['', 0]])
  const idOf = name => {
    let id = nameIds.get(name)
    if (id === undefined) {
      id = nameIds.size
      nameIds.set(name, id)
    }
    return id
  }
  const memo = new Map()
  const classOf = name => {
    let c = memo.get(name)
    if (c === undefined) {
      c = SOIL.test(name) ? SOIL_C : PLANT.test(name) ? PLANT_C : ROCK.test(name) ? ROCK_C : WATER.test(name) ? WATER_C : TREE.test(name) ? TREE_C : BUILT_C
      memo.set(name, c)
    }
    return c
  }
  // physics: what breaks the moment the spawn is pasted (checked only for the blocks it concerns)
  const GRAVITY = /^minecraft:(sand|red_sand|gravel|suspicious_sand|suspicious_gravel|anvil|chipped_anvil|damaged_anvil|.*_concrete_powder)$/
  const CANE_SOIL = /^minecraft:(grass_block|dirt|coarse_dirt|podzol|rooted_dirt|mud|sand|red_sand|moss_block|mycelium|suspicious_sand)$/
  const physics = { falling: [], cane: [], leaks: [], floating: [] }
  const note = (list, x, y, z) => { if (list.length < 6) list.push([x, y, z]); list.n = (list.n ?? 0) + 1 }
  const isWater = blk => blk && (blk.name === 'minecraft:water' || blk.props?.waterlogged === 'true' || /^minecraft:(kelp|kelp_plant|seagrass|tall_seagrass|bubble_column)$/.test(blk.name))
  const physicsOf = new Map()
  const kindOf = name => {
    let v = physicsOf.get(name)
    if (v === undefined) {
      v = GRAVITY.test(name) ? 1 : name === 'minecraft:sugar_cane' ? 2 : name === 'minecraft:water' ? 3 : PLANT.test(name) ? 4 : 0
      physicsOf.set(name, v)
    }
    return v
  }
  src.each((x, y, z, block) => {
    // invisible blocks (spawn-proofing's lights, barriers) are not things on the land
    if (INVISIBLE.test(block.name)) return
    const i = z * sx + x
    const kind = kindOf(block.name)
    if (kind && y > 0) {
      const below = b.get(x, y - 1, z)
      if (kind === 1 && (!below || below.name === 'minecraft:water' || PLANT.test(below.name))) note(physics.falling, x, y, z)
      else if (kind === 2 && !(below?.name === 'minecraft:sugar_cane' || (below && CANE_SOIL.test(below.name) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => isWater(b.get(x + dx, y - 1, z + dz)))))) note(physics.cane, x, y, z)
      else if (kind === 3 && (block.props?.level ?? '0') === '0' && (!below || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !b.get(x + dx, y, z + dz)))) note(physics.leaks, x, y, z)
      else if (kind === 4 && !below) note(physics.floating, x, y, z)
    }
    const c = classOf(block.name)
    if (y > top[i]) {
      top[i] = y
      topC[i] = c
      topName[i] = idOf(block.name)
    }
    if ((c === SOIL_C || c === ROCK_C) && y > ground[i]) {
      ground[i] = y
      groundName[i] = idOf(block.name)
    }
    if (c === WATER_C && block.name === 'minecraft:water' && y > water[i]) water[i] = y
  })
  void sy
  // the land: columns with ground or anything on them, inside the spawn's land
  let landN = 0
  const land = new Uint8Array(n)
  for (let z = 0; z < sz; z += 1)
    for (let x = 0; x < sx; x += 1) {
      const i = z * sx + x
      if (top[i] >= 0 && inBox(x, z) && inside(x, z)) { land[i] = 1; landN += 1 }
    }
  const failures = []
  const warnings = []
  const stats = { land: landN }
  if (landN < 100) return { passed: true, failures, warnings, stats }
  const big = Math.max(box[2] - box[0], box[3] - box[1]) >= 200
  stats.region = b.focus ? `focus ${box.join(',')}` : 'whole canvas'

  // ---- bare land: distance from each lawn column to the nearest thing on the land
  const feature = new Uint8Array(n)
  let bare = 0
  let trees = 0
  let built = 0
  for (let i = 0; i < n; i += 1) {
    if (!land[i]) continue
    const c = topC[i]
    if (c === SOIL_C || c === PLANT_C) bare += 1
    else feature[i] = 1
    if (c === TREE_C) trees += 1
    if (c === BUILT_C) built += 1
  }
  const dist = chamfer(feature, sx, sz)
  let far = 0
  let worst = 0
  let worstAt = null
  for (let i = 0; i < n; i += 1) {
    if (!land[i] || feature[i]) continue
    const d = dist[i]
    if (d > 12) far += 1
    if (d > worst) { worst = d; worstAt = [i % sx, Math.floor(i / sx)] }
  }
  stats.bare = pct(bare, landN)
  stats.trees = pct(trees, landN)
  stats.built = pct(built, landN)
  stats.farFromAnything = pct(far, landN)
  stats.biggestBare = Math.round(worst * 2)
  if (big && worst > 24) failures.push(`bare land: a stretch of plain lawn about ${Math.round(worst * 2)} across round ${worstAt.join(',')} has nothing on it (the most allowed is about 48): put woods, rocks, a building, water or a garden there`)
  if (big && far / landN > 0.2) failures.push(`bare land: ${pct(far, landN)}% of the land is lawn more than 12 blocks from anything (at most 20%): fill the districts and the landscape (manual §1.2, §5.1, §5.8)`)
  else if (big && far / landN > 0.1) warnings.push(`bare land: ${pct(far, landN)}% of the land is lawn more than 12 blocks from anything`)
  if (big && trees / landN < 0.08) warnings.push(`trees: only ${pct(trees, landN)}% of the land is under trees: woods in clumps with clearings make a landscape (manual §5.8)`)

  // ---- flat land: the share of the ground within 2 of the most common level
  const hist = new Map()
  let gN = 0
  for (let i = 0; i < n; i += 1) {
    if (!land[i] || ground[i] < 0) continue
    hist.set(ground[i], (hist.get(ground[i]) ?? 0) + 1)
    gN += 1
  }
  let mode = 0
  let modeN = -1
  for (const [y, c] of hist) if (c > modeN) { mode = y; modeN = c }
  let near = 0
  for (const [y, c] of hist) if (Math.abs(y - mode) <= 2) near += c
  const levels = [...hist.keys()].sort((p, q) => p - q)
  stats.flat = pct(near, gN)
  stats.relief = levels.length ? levels.at(-1) - levels[0] : 0
  if (big && gN && near / gN > 0.8) failures.push(`flat land: ${pct(near, gN)}% of the ground lies within 2 blocks of y ${mode} (at most 80%): shape a landscape (ranges, foothills, valleys, rolling ground: manual §5.1, b.land)`)
  else if (big && gN && near / gN > 0.65) warnings.push(`flat land: ${pct(near, gN)}% of the ground lies within 2 blocks of y ${mode}`)

  // ---- flat bridges: a deck right on the water, in runs of 6+
  const deck = new Uint8Array(n)
  for (let i = 0; i < n; i += 1) if (land[i] && water[i] >= 0 && topC[i] === BUILT_C && top[i] > water[i] && top[i] - water[i] <= 2) deck[i] = 1
  const decks = components(deck, sx, sz).filter(c => c.cells >= 6 && Math.max(c.w, c.d) >= 6)
  stats.lowDecks = decks.length
  for (const c of decks.slice(0, 3)) warnings.push(`low deck over water round ${c.cx},${c.cz} (${c.w} x ${c.d}, 1-2 above the water): a bridge arches 6-10 above it on piers (manual §5.5); a pier or a dock may sit low`)

  // ---- repeats: buildings with the same footprint and height
  const builtMask = new Uint8Array(n)
  for (let i = 0; i < n; i += 1) if (land[i] && topC[i] === BUILT_C) builtMask[i] = 1
  const groups = components(builtMask, sx, sz, i => top[i], i => ground[i]).filter(c => c.cells >= 30 && c.cells <= 6000)
  const sig = new Map()
  for (const c of groups) {
    const key = `${Math.min(c.w, c.d)}x${Math.max(c.w, c.d)}x${c.h}`
    if (!sig.has(key)) sig.set(key, [])
    sig.get(key).push(c)
  }
  stats.buildings = groups.length
  for (const [key, list] of sig)
    if (list.length >= 4) failures.push(`repeats: ${list.length} buildings are the same size (${key.replace(/x(\d+)$/, ', $1 tall')}), e.g. at ${list.slice(0, 4).map(c => `${c.cx},${c.cz}`).join(' ')}: design each one (manual §5.14)`)
    else if (list.length === 3) warnings.push(`repeats: 3 buildings are the same size (${key}), e.g. at ${list.map(c => `${c.cx},${c.cz}`).join(' ')}`)

  // ---- speckle: single blocks unlike all four neighbours, on the lawn (dirt dots) and on floors
  // (paving salted with odd blocks); clumped patches have almost none
  let lawnN = 0
  let lawnDots = 0
  let floorN = 0
  let floorDots = 0
  for (let z = 1; z < sz - 1; z += 1)
    for (let x = 1; x < sx - 1; x += 1) {
      const i = z * sx + x
      if (!land[i]) continue
      const c = topC[i]
      const lawn = c === SOIL_C || c === PLANT_C
      const floor = c === BUILT_C && Math.abs(top[i] - (top[i - 1] + top[i + 1] + top[i - sx] + top[i + sx]) / 4) < 0.3
      if (!lawn && !floor) continue
      const key = lawn ? groundName : topName
      const v = key[i]
      let same = 0
      let comparable = 0
      for (const j of [i - 1, i + 1, i - sx, i + sx]) {
        if (!land[j] || (lawn ? !(topC[j] === SOIL_C || topC[j] === PLANT_C) : topC[j] !== BUILT_C)) continue
        comparable += 1
        if (key[j] === v) same += 1
      }
      if (comparable < 4) continue
      if (lawn) { lawnN += 1; if (!same) lawnDots += 1 }
      else { floorN += 1; if (!same) floorDots += 1 }
    }
  stats.lawnSpeckle = pct(lawnDots, lawnN)
  stats.floorSpeckle = pct(floorDots, floorN)
  if (big && lawnN > 1000 && lawnDots / lawnN > 0.03) failures.push(`speckle: ${pct(lawnDots, lawnN)}% of the lawn is single blocks unlike their neighbours (dots of dirt, podzol or sand): ground patches are clumps 10-40 across (manual §5.2), at most 3% single dots`)
  if (floorN > 500 && floorDots / floorN > 0.09) warnings.push(`speckle: ${pct(floorDots, floorN)}% of the paved floor is single blocks unlike their neighbours: one field material in clumped shades with borders and inlays (manual §5.3)`)

  // ---- physics: falling sand and gravel, sugar cane with no water, water that will flow out
  const where = list => list.map(p => p.join(',')).join(' ')
  stats.falling = physics.falling.n ?? 0
  stats.leaks = physics.leaks.n ?? 0
  if (physics.falling.n) failures.push(`falling: ${physics.falling.n} sand, gravel or concrete powder block(s) have nothing under them and fall when pasted, e.g. ${where(physics.falling)}: put a solid block under each, or use sandstone, packed mud, tuff`)
  if (physics.cane.n) failures.push(`sugar cane: ${physics.cane.n} cane with no soil next to water under it (it breaks), e.g. ${where(physics.cane)}: cane stands on dirt, grass, sand or mud with water beside that block`)
  if (physics.leaks.n) failures.push(`water: ${physics.leaks.n} still water block(s) touch air at a side or below and will flow out when pasted, e.g. ${where(physics.leaks)}: seal them with blocks (manual §5.4)`)
  if (physics.floating.n > 10) warnings.push(`plants: ${physics.floating.n} plant(s) float over air, e.g. ${where(physics.floating)}`)

  // ---- the views from the spawn: in each 45-degree sector, does something stand up within 160
  // blocks (a building, trees, the hero, a mountain), or only floor and sky?
  const sp = placements.find(p => p.type === 'spawn')
  if (sp && big) {
    const [px0, py0, pz0] = sp.pos
    const sectors = new Array(8).fill(0)
    for (let a = 0; a < 72; a += 1) {
      const ang = (a * 5 * Math.PI) / 180
      const dx = Math.sin(ang)
      const dz = Math.cos(ang)
      for (let d = 6; d <= 160; d += 1) {
        const x = Math.round(px0 + dx * d)
        const z = Math.round(pz0 + dz * d)
        if (x < 0 || z < 0 || x >= sx || z >= sz) break
        // something that reads: at least 8 above the spawn's floor and 3.4 degrees up (a building,
        // a tree, the hero, a hill; a lamp post or a bench does not)
        if (top[z * sx + x] - py0 >= Math.max(8, d * 0.06)) {
          sectors[Math.floor(a / 9)] += 1
          break
        }
      }
    }
    const filled = sectors.filter(n => n >= 5).length
    const names = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east']
    stats.views = `${filled}/8`
    const empty = names.filter((_, k) => sectors[k] < 5)
    if (filled < 5) failures.push(`views: from the spawn only ${filled} of 8 directions show something standing within 160 blocks (empty: ${empty.join(', ')}): bring buildings, trees, the hero or the land within view, or make the plaza smaller (manual §1.1)`)
    else if (filled < 7) warnings.push(`views: from the spawn ${empty.join(', ')} show only floor and sky within 160 blocks`)
  }

  // ---- NPCs: how far apart the stands are
  // (the ring round the spawn only: a spawn+ town puts its NPCs in their own buildings, far apart)
  const spawnAt = placements.find(p => p.type === 'spawn')?.pos
  const npcs = placements.filter(p => p.type === 'npc' && p.role !== 'statue' && (!spawnAt || Math.hypot(p.pos[0] - spawnAt[0], p.pos[2] - spawnAt[2]) <= 60)).map(p => p.pos)
  if (npcs.length >= 3) {
    const nearest = npcs.map((p, i) => Math.min(...npcs.filter((_, j) => j !== i).map(q => Math.hypot(p[0] - q[0], p[2] - q[2]))))
    nearest.sort((p, q) => p - q)
    const median = nearest[Math.floor(nearest.length / 2)]
    stats.npcSpacing = Math.round(median * 10) / 10
    if (median > 12) failures.push(`NPCs: the stands are ${Math.round(median)} apart (manual §5.10: 6-8): a tighter ring, two rings, or groups`)
    else if (median > 9) warnings.push(`NPCs: the stands are ${Math.round(median)} apart (manual §5.10: 6-8)`)
  }
  return { passed: failures.length === 0, failures, warnings, stats }
}

const pct = (a, b) => Math.round((1000 * a) / Math.max(1, b)) / 10

// distance (in blocks) from every cell to the nearest set cell (chamfer 3-4)
function chamfer(mask, W, D) {
  const big = 1e6
  const d = new Float32Array(W * D)
  for (let i = 0; i < W * D; i += 1) d[i] = mask[i] ? 0 : big
  for (let z = 0; z < D; z += 1)
    for (let x = 0; x < W; x += 1) {
      const i = z * W + x
      let v = d[i]
      if (!v) continue
      if (x > 0) v = Math.min(v, d[i - 1] + 1)
      if (z > 0) v = Math.min(v, d[i - W] + 1)
      if (x > 0 && z > 0) v = Math.min(v, d[i - W - 1] + 1.4142)
      if (x < W - 1 && z > 0) v = Math.min(v, d[i - W + 1] + 1.4142)
      d[i] = v
    }
  for (let z = D - 1; z >= 0; z -= 1)
    for (let x = W - 1; x >= 0; x -= 1) {
      const i = z * W + x
      let v = d[i]
      if (!v) continue
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1)
      if (z < D - 1) v = Math.min(v, d[i + W] + 1)
      if (x < W - 1 && z < D - 1) v = Math.min(v, d[i + W + 1] + 1.4142)
      if (x > 0 && z < D - 1) v = Math.min(v, d[i + W - 1] + 1.4142)
      d[i] = v
    }
  return d
}

// 8-connected groups of set cells: size, bounding box, centre, and the height of `hAt` over the
// lowest `gAt` (a building's top over its ground)
function components(mask, W, D, hAt, gAt) {
  const seen = new Uint8Array(W * D)
  const out = []
  const stack = []
  for (let s = 0; s < W * D; s += 1) {
    if (!mask[s] || seen[s]) continue
    seen[s] = 1
    stack.push(s)
    let cells = 0
    let x0 = Infinity
    let x1 = -Infinity
    let z0 = Infinity
    let z1 = -Infinity
    let h0 = Infinity
    let h1 = -Infinity
    let g0 = Infinity
    while (stack.length) {
      const i = stack.pop()
      const x = i % W
      const z = (i - x) / W
      cells += 1
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (z < z0) z0 = z
      if (z > z1) z1 = z
      if (hAt) {
        const h = hAt(i)
        if (h < h0) h0 = h
        if (h > h1) h1 = h
      }
      if (gAt) {
        const g = gAt(i)
        if (g >= 0 && g < g0) g0 = g
      }
      for (let dz = -1; dz <= 1; dz += 1)
        for (let dx = -1; dx <= 1; dx += 1) {
          const jx = x + dx
          const jz = z + dz
          if (jx < 0 || jz < 0 || jx >= W || jz >= D) continue
          const j = jz * W + jx
          if (mask[j] && !seen[j]) { seen[j] = 1; stack.push(j) }
        }
    }
    out.push({ cells, w: x1 - x0 + 1, d: z1 - z0 + 1, cx: Math.round((x0 + x1) / 2), cz: Math.round((z0 + z1) / 2), h: hAt ? h1 - (Number.isFinite(g0) ? g0 : h0) : 0, top: h1 })
  }
  return out
}
