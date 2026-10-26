// Seasonal passes: run them near the end (after the buildings, set pieces and landscapePass, before
// finishSpawn), and they dress everything already built, your own structures included.
//
//   snowfall(ctx, { paved: 0.35, natural: 0.97, deep: 0.3, ice: true })
//       snow layers on every block that faces the open sky and can hold snow (full blocks, leaves,
//       top slabs, upside-down stairs), clumped, deeper in drifts; grass under snow turns snowy;
//       open water freezes at the edges (or all over with ice: 'all'). Paved ground gets less (swept
//       walks), NPC plinths, crates and the spawn rose get none.
//   leafLitter(ctx, { amount: 0.25 })
//       autumn carpets (orange, red, brown, yellow) in clumps on natural ground and the plaza edges.
//
// For a winter version also pick the winter theme (log cabins, snowy spruces, ice) or give your own
// theme snowy materials; snowfall then finishes the look.

const SNOW_ON = /(_leaves|_block|_bricks|_planks|_log|_wood|stone|deepslate|_tiles|terracotta|concrete|quartz|sandstone|dirt|podzol|mud|gravel|sand|_ore|calcite|tuff|basalt|andesite|diorite|granite|prismarine|purpur|bookshelf|hay_block|_wool|copper)$/
const NEVER = /(glass|ice|lantern|torch|fence|wall|pane|bars|chain|door|trapdoor|button|lever|sign|banner|carpet|rail|bed|pot|candle|head|skull|campfire|light|snow|water|lava|magma|leaves_none|chest|barrel|shulker|anvil|bell|lectern|cauldron|composter|grindstone|stonecutter|smoker|furnace|hopper|brewing|enchanting|end_rod|scaffolding|cobweb|vine|lichen|_slab$|_stairs$)/
const PLANT = /^minecraft:(short_grass|tall_grass|fern|large_fern|dandelion|poppy|blue_orchid|allium|azure_bluet|red_tulip|orange_tulip|white_tulip|pink_tulip|oxeye_daisy|cornflower|lily_of_the_valley|dead_bush|pink_petals|moss_carpet|brown_mushroom|red_mushroom|sweet_berry_bush)$/

// the cells a pass must leave alone: where NPCs stand, crates, the world spawn
function reserved(b) {
  const out = new Set()
  for (const p of b.placements ?? []) {
    if (!p.pos || !['npc', 'crate', 'spawn'].includes(p.type)) continue
    const [x, , z] = p.pos.map(Math.floor)
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) out.add(`${x + dx},${z + dz}`)
  }
  return out
}
// cells the spawn kit registered to stay clear (NPC stand-offs, crate standing areas, head room)
function clearCells(b) {
  const out = new Set()
  for (const c of b.spawnClearance ?? []) for (const [x, y, z] of c.cells ?? []) out.add(`${x},${y},${z}`)
  return out
}

// the highest block in a column and its name (scanning down from the top of the canvas)
function topOf(b, x, z, H) {
  for (let y = H - 1; y >= 0; y -= 1) {
    const blk = b.get(x, y, z)
    if (blk) return { y, name: blk.name, props: blk.properties ?? blk.props ?? {} }
  }
  return null
}

function holdsSnow(name, props) {
  if (/_slab$/.test(name)) return props.type === 'top' || props.type === 'double'
  if (/_stairs$/.test(name)) return props.half === 'top'
  if (NEVER.test(name)) return false
  return SNOW_ON.test(name) || /_leaves$/.test(name)
}

export function snowfall(ctx, { paved = 0.35, natural = 0.97, deep = 0.3, ice = true, box } = {}) {
  const { b, kit, S, H, site, seed } = ctx
  const skip = reserved(b)
  const clear = clearCells(b)
  const [x0, z0, x1, z1] = box ?? [0, 0, S - 1, S - 1]
  const drift = (x, z) => kit.noise.coherent01(x, 0, z, { scale: 6, grain: 0.2, seed: seed + 401 })
  let n = 0
  for (let x = x0; x <= x1; x += 1)
    for (let z = z0; z <= z1; z += 1) {
      if (skip.has(`${x},${z}`)) continue
      const t = topOf(b, x, z, H)
      if (!t) continue
      let { y, name, props } = t
      // water: ice at the shallow edges (or everywhere), never a snow layer on it
      if (name === 'minecraft:water') {
        if (!ice) continue
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => b.nameAt(x + dx, y, z + dz) !== 'minecraft:water')
        if (ice === 'all' || edge || drift(x, z) < 0.35) b.set(x, y, z, 'minecraft:ice')
        continue
      }
      // a plant on the ground: the snow takes its place
      if (PLANT.test(name)) {
        const below = b.get(x, y - 1, z)
        if (!below || !holdsSnow(below.name, below.properties ?? below.props ?? {})) continue
        b.remove(x, y, z)
        y -= 1
        name = below.name
        props = below.properties ?? below.props ?? {}
      }
      if (!holdsSnow(name, props) || clear.has(`${x},${y + 1},${z}`)) continue
      const d = drift(x, z)
      const isPaved = site?.paved?.[x + S * z]
      // swept paving keeps snow only in drifts (coherent patches with a dithered edge), never a speckle
      if (isPaved ? d < 1 - paved - 0.08 * kit.hash01(x, y, z, 403) : kit.hash01(x, y, z, 403) > natural) continue
      if (name === 'minecraft:grass_block') b.set(x, y, z, 'minecraft:grass_block[snowy=true]')
      const layers = !isPaved && d > 1 - deep ? (d > 1 - deep / 3 ? 3 : 2) : 1
      b.set(x, y + 1, z, `minecraft:snow[layers=${layers}]`)
      n += 1
    }
  return n
}

export function leafLitter(ctx, { amount = 0.25, box } = {}) {
  const { b, kit, S, H, site, seed } = ctx
  const skip = reserved(b)
  const clear = clearCells(b)
  const [x0, z0, x1, z1] = box ?? [0, 0, S - 1, S - 1]
  let n = 0
  for (let x = x0; x <= x1; x += 1)
    for (let z = z0; z <= z1; z += 1) {
      if (skip.has(`${x},${z}`)) continue
      const t = topOf(b, x, z, H)
      if (!t || clear.has(`${x},${t.y + 1},${z}`) || !/^minecraft:(grass_block|dirt|coarse_dirt|podzol|rooted_dirt|packed_mud|dirt_path)$/.test(t.name)) continue
      const c = kit.noise.coherent01(x, 7, z, { scale: 4, grain: 0.3, seed: seed + 405 })
      const edge = site?.paved?.[x + S * z] ? 0.4 : 1
      if (kit.hash01(x, t.y, z, 407) > amount * edge * (0.5 + c)) continue
      const colour = c < 0.38 ? 'orange' : c < 0.62 ? 'red' : c < 0.85 ? 'brown' : 'yellow'
      b.set(x, t.y + 1, z, `minecraft:${colour}_carpet`)
      n += 1
    }
  return n
}
