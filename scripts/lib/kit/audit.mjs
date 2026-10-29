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
// Guide: references/spawns/build-guide.md §2.3 (the quality gate).

const SOIL = /^minecraft:(grass_block|dirt|coarse_dirt|podzol|rooted_dirt|mycelium|moss_block|mud|sand|red_sand|snow_block|snow|powder_snow|clay|farmland)$/
const PLANT = /^minecraft:(short_grass|tall_grass|fern|large_fern|dead_bush|.*_tulip|dandelion|poppy|blue_orchid|allium|azure_bluet|oxeye_daisy|cornflower|lily_of_the_valley|wither_rose|sunflower|lilac|rose_bush|peony|pink_petals|sweet_berry_bush|.*_sapling|moss_carpet|brown_mushroom|red_mushroom|torchflower|pitcher_plant|leaf_litter|bush|firefly_bush|short_dry_grass|tall_dry_grass)$/
const ROCK = /^minecraft:(stone|andesite|diorite|granite|tuff|deepslate|calcite|gravel|cobblestone|mossy_cobblestone|cobbled_deepslate|smooth_basalt|basalt|blackstone|dripstone_block|pointed_dripstone|terracotta|.*_terracotta|sandstone|red_sandstone|packed_ice|blue_ice|ice|obsidian|magma_block|amethyst_block|stone_button|andesite_slab|cobblestone_slab|stone_slab|tuff_slab|cobblestone_stairs|stone_stairs|andesite_stairs|tuff_stairs|mossy_cobblestone_slab|mossy_cobblestone_stairs)$/
const TREE = /_(log|wood|leaves|stem|hyphae)$|^minecraft:(mangrove_roots|muddy_mangrove_roots|shroomlight|nether_wart_block|warped_wart_block|bamboo|vine|hanging_roots|azalea|flowering_azalea|.*_wool)$/
const WATER = /^minecraft:(water|bubble_column|kelp|kelp_plant|seagrass|tall_seagrass|lily_pad|sugar_cane)$/

const SOIL_C = 1
const PLANT_C = 2
const ROCK_C = 3
const TREE_C = 4
const WATER_C = 5
const BUILT_C = 6

export function auditSpawn(b, { inside = () => true, placements = b.placements ?? [] } = {}) {
  const [sx, sy, sz] = b.size
  const n = sx * sz
  // a focus draft is judged on its box (one district), a full build on the whole canvas
  const box = b.focus ?? [0, 0, sx - 1, sz - 1]
  const inBox = (x, z) => x >= box[0] && x <= box[2] && z >= box[1] && z <= box[3]
  const top = new Int16Array(n).fill(-1)
  const topC = new Uint8Array(n)
  const ground = new Int16Array(n).fill(-1)
  const water = new Int16Array(n).fill(-1)
  const memo = new Map()
  const classOf = name => {
    let c = memo.get(name)
    if (c === undefined) {
      c = SOIL.test(name) ? SOIL_C : PLANT.test(name) ? PLANT_C : ROCK.test(name) ? ROCK_C : WATER.test(name) ? WATER_C : TREE.test(name) ? TREE_C : BUILT_C
      memo.set(name, c)
    }
    return c
  }
  b.blocks.each((k, block) => {
    const x = k % sx
    const rest = (k - x) / sx
    const z = rest % sz
    const y = (rest - z) / sz
    const i = z * sx + x
    const c = classOf(block.name)
    if (y > top[i]) {
      top[i] = y
      topC[i] = c
    }
    if ((c === SOIL_C || c === ROCK_C) && y > ground[i]) ground[i] = y
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

  // ---- NPCs: how far apart the stands are
  const npcs = placements.filter(p => p.type === 'npc').map(p => p.pos)
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
