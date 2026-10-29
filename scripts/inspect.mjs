#!/usr/bin/env node

// Text inspector for vanilla structure .nbt files. Renders are too coarse to verify individual
// blocks, so agents use this to check geometry (ASCII slices), palettes, per-layer gradients and
// common build mistakes (stair shapes, flat walls, floating blocks, missing supports, dark spots).

import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { LODESTONE_ROOT, NbtFile } from './lib/lodestone.mjs'
import { ensureHeap } from './lib/heap.mjs'

ensureHeap()

const DENSE_LIMIT = 700_000_000 // max grid cells for typed-array storage (a 1500 x 250 x 1500 spawn fits); larger grids use a Map
const DEFAULT_FIND_LIMIT = 200
const DEFAULT_EXAMPLES = 6

function usage() {
  return `Usage:
  node scripts/inspect.mjs <file.nbt> [options]

With no command flags, prints the summary (size, bounds, palette, categories, detail ratio, lighting).

Commands (combine freely):
  --summary               Print the summary even when other commands are given
  --slice y=<n>           ASCII map of one layer (also x=<n> / z=<n> for side views); repeatable
  --layers <y0>-<y1>      Consecutive y slices (or x=<a>-<b> / z=<a>-<b>)
  --profile               Per-y-level stats: block count, coverage, detail, top 3 blocks
  --find <id|substring>   List positions of matching blocks (exact id with namespace, or substring
                          of the full state such as "lantern" or "facing=north"); repeatable
  --checks                Quality lint with warnings and fix hints
  --score                 Quality scorecard: metric, value, target band, fix hint, 0-100 total
  --style <name>          Compare --score composition against a style's norms (implies --score):
                          medieval, house, castle, fantasy, japanese, gothic, modern, ship, statue,
                          organic, terrain, other, curated, all (default: all, by size class)
  --json                  Print everything computed as JSON instead of text

Options:
  --range x0,z0,x1,z1     Crop slices (x/z for y-slices; z for x-slices; x for z-slices)
  --range x0,y0,z0,x1,y1,z1   Crop slices in all three axes
  --all                   Show every palette row (default: top 40)
  --states                Palette by full block state instead of block id
  --limit <n>             Max positions per --find (default ${DEFAULT_FIND_LIMIT})
  --examples <n>          Max examples per check (default ${DEFAULT_EXAMPLES})
  --palette <n>           Palette index for multi-palette ("palettes") files (default 0)
`
}

function parseArgs(argv) {
  const options = {
    file: undefined,
    summary: false,
    slices: [], // in command-line order; --layers expands into several entries
    profile: false,
    find: [],
    checks: false,
    score: false,
    json: false,
    range: undefined,
    all: false,
    states: false,
    limit: DEFAULT_FIND_LIMIT,
    examples: DEFAULT_EXAMPLES,
    palette: 0,
    style: undefined,
    help: false,
  }

  const readValue = (arg, index) => {
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`${arg} requires a value`)
    return value
  }
  const positiveInt = (flag, value) => {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 0) throw new Error(`${flag} must be a non-negative integer`)
    return n
  }
  const valueFlags = {
    '--slice': v => { options.slices.push(parseSliceSpec(v)) },
    '--layers': v => {
      const spec = parseLayersSpec(v)
      for (let value = spec.from; value <= spec.to; value += 1) options.slices.push({ axis: spec.axis, value })
    },
    '--find': v => { options.find.push(v) },
    '--range': v => { options.range = parseRange(v) },
    '--limit': v => { options.limit = positiveInt('--limit', v) },
    '--examples': v => { options.examples = positiveInt('--examples', v) },
    '--palette': v => { options.palette = positiveInt('--palette', v) },
    '--style': v => { options.style = v; options.score = true },
  }
  const boolFlags = {
    '-h': () => { options.help = true },
    '--help': () => { options.help = true },
    '--summary': () => { options.summary = true },
    '--profile': () => { options.profile = true },
    '--checks': () => { options.checks = true },
    '--score': () => { options.score = true },
    '--json': () => { options.json = true },
    '--all': () => { options.all = true },
    '--states': () => { options.states = true },
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1
    const flag = eq > 0 ? arg.slice(0, eq) : arg
    const inline = eq > 0 ? arg.slice(eq + 1) : undefined
    if (boolFlags[flag] && inline === undefined) {
      boolFlags[flag]()
    } else if (valueFlags[flag]) {
      const value = inline ?? readValue(flag, index)
      if (inline === undefined) index += 1
      valueFlags[flag](value)
    } else if (!options.file && !arg.startsWith('-')) {
      options.file = arg
    } else {
      throw new Error(`Unexpected argument: ${arg}`)
    }
  }
  return options
}

function parseSliceSpec(value) {
  const match = /^([xyz])\s*=\s*(-?\d+)$/i.exec(value.trim())
  if (!match) throw new Error(`--slice expects y=<n>, x=<n> or z=<n> (got "${value}")`)
  return { axis: match[1].toLowerCase(), value: Number(match[2]) }
}

function parseLayersSpec(value) {
  const match = /^(?:([xyz])\s*=\s*)?(-?\d+)\s*(?:-|\.\.)\s*(-?\d+)$/i.exec(value.trim())
  if (!match) throw new Error(`--layers expects <y0>-<y1> or x=<a>-<b> (got "${value}")`)
  const a = Number(match[2])
  const b = Number(match[3])
  return { axis: (match[1] ?? 'y').toLowerCase(), from: Math.min(a, b), to: Math.max(a, b) }
}

function parseRange(value) {
  const parts = value.split(',').map(s => Number(s.trim()))
  if (!parts.every(Number.isInteger) || (parts.length !== 4 && parts.length !== 6)) {
    throw new Error('--range expects x0,z0,x1,z1 or x0,y0,z0,x1,y1,z1 (integers)')
  }
  if (parts.length === 4) {
    const [x0, z0, x1, z1] = parts
    return { x: [Math.min(x0, x1), Math.max(x0, x1)], z: [Math.min(z0, z1), Math.max(z0, z1)] }
  }
  const [x0, y0, z0, x1, y1, z1] = parts
  return {
    x: [Math.min(x0, x1), Math.max(x0, x1)],
    y: [Math.min(y0, y1), Math.max(y0, y1)],
    z: [Math.min(z0, z1), Math.max(z0, z1)],
  }
}

// ---------------------------------------------------------------------------------------------
// NBT reading. A small big-endian Java NBT reader to plain JS values (about 10x faster than the
// generic tag classes on 500k-block files); Lodestone's NbtFile is the fallback.

function decompress(bytes) {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return { data: zlib.gunzipSync(bytes), compression: 'gzip' }
  if (bytes[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(bytes[1])) {
    return { data: zlib.inflateSync(bytes), compression: 'zlib' }
  }
  return { data: bytes, compression: 'none' }
}

function readNbtFast(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const cache = new Map()
  let o = 0
  const same = (s, at) => {
    for (let i = 0; i < s.length; i += 1) if (s.charCodeAt(i) !== data[at + i]) return false
    return true
  }
  const str = () => {
    const len = view.getUint16(o)
    o += 2
    let ascii = true
    let hash = len
    for (let i = 0; i < len; i += 1) {
      const b = data[o + i]
      if (b & 0x80) { ascii = false; break }
      hash = (hash * 31 + b) | 0
    }
    let s
    if (ascii && len <= 40) {
      s = cache.get(hash)
      if (s === undefined || s.length !== len || !same(s, o)) {
        s = data.latin1Slice(o, o + len)
        if (cache.size < 8192) cache.set(hash, s)
      }
    } else {
      s = data.toString('utf8', o, o + len)
    }
    o += len
    return s
  }
  const payload = type => {
    switch (type) {
      case 1: { const v = view.getInt8(o); o += 1; return v }
      case 2: { const v = view.getInt16(o); o += 2; return v }
      case 3: { const v = view.getInt32(o); o += 4; return v }
      case 4: { const v = view.getBigInt64(o); o += 8; return Number(v) }
      case 5: { const v = view.getFloat32(o); o += 4; return v }
      case 6: { const v = view.getFloat64(o); o += 8; return v }
      case 7: { const n = view.getInt32(o); o += 4; const v = Array.from(data.subarray(o, o + n), b => (b << 24) >> 24); o += n; return v }
      case 8: return str()
      case 9: {
        const elementType = data[o]
        o += 1
        const n = view.getInt32(o)
        o += 4
        const out = new Array(Math.max(0, n))
        for (let i = 0; i < n; i += 1) out[i] = payload(elementType)
        return out
      }
      case 10: {
        const obj = {}
        for (;;) {
          const childType = data[o]
          o += 1
          if (childType === 0) break
          const key = str()
          obj[key] = payload(childType)
        }
        return obj
      }
      case 11: { const n = view.getInt32(o); o += 4; const out = new Array(n); for (let i = 0; i < n; i += 1) { out[i] = view.getInt32(o); o += 4 } return out }
      case 12: { const n = view.getInt32(o); o += 4; const out = new Array(n); for (let i = 0; i < n; i += 1) { out[i] = Number(view.getBigInt64(o)); o += 8 } return out }
      default: throw new Error(`Unknown NBT tag type ${type} at byte ${o}`)
    }
  }
  if (data[0] !== 10) throw new Error('NBT root is not a compound')
  o = 1
  str()
  return payload(10)
}

function readNbt(bytes) {
  const { data, compression } = decompress(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  try {
    return { root: readNbtFast(data), compression }
  } catch (fastError) {
    try {
      const file = NbtFile.read(new Uint8Array(bytes))
      return { root: file.root.toSimplifiedJson(), compression: file.compression ?? compression }
    } catch {
      throw new Error(`Could not read NBT: ${fastError.message}`)
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Block knowledge: categories, light emission, attachment rules.

const EMPTY_IDS = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air', 'minecraft:structure_void'])

const CATEGORY_LABELS = {
  full: 'full cubes',
  stairs: 'stairs',
  slab: 'slabs',
  wall: 'walls',
  fence: 'fences/gates',
  pane: 'panes/bars',
  trapdoor: 'trapdoors',
  door: 'doors',
  button: 'buttons',
  plate: 'pressure plates',
  light: 'lights (non-cube)',
  plant: 'plants',
  furniture: 'furniture/decor',
  fluid: 'fluids',
  other: 'other partial',
}

const FLOWERS = new Set([
  'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip',
  'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'wither_rose', 'torchflower', 'sunflower',
  'lilac', 'rose_bush', 'peony', 'open_eyeblossom', 'closed_eyeblossom', 'cactus_flower', 'wildflowers',
  'pink_petals', 'leaf_litter',
])
const GROUND_PLANTS = new Set([
  ...FLOWERS, 'short_grass', 'grass', 'tall_grass', 'fern', 'large_fern', 'dead_bush', 'bush', 'firefly_bush',
  'short_dry_grass', 'tall_dry_grass', 'sweet_berry_bush', 'azalea', 'flowering_azalea', 'pitcher_plant',
  'mangrove_propagule',
])
const CROPS = new Set(['wheat', 'carrots', 'potatoes', 'beetroots', 'torchflower_crop', 'pitcher_crop', 'melon_stem', 'pumpkin_stem', 'attached_melon_stem', 'attached_pumpkin_stem'])
const OTHER_PLANTS = new Set([
  'vine', 'glow_lichen', 'sugar_cane', 'kelp', 'kelp_plant', 'seagrass', 'tall_seagrass', 'lily_pad', 'cactus',
  'bamboo', 'bamboo_sapling', 'cocoa', 'nether_wart', 'spore_blossom', 'big_dripleaf', 'big_dripleaf_stem',
  'small_dripleaf', 'hanging_roots', 'moss_carpet', 'pale_moss_carpet', 'pale_hanging_moss', 'chorus_plant',
  'chorus_flower', 'brown_mushroom', 'red_mushroom', 'crimson_fungus', 'warped_fungus', 'crimson_roots',
  'warped_roots', 'nether_sprouts', 'cave_vines', 'cave_vines_plant', 'weeping_vines', 'weeping_vines_plant',
  'twisting_vines', 'twisting_vines_plant', 'mangrove_roots',
])
const DOUBLE_PLANTS = new Set(['tall_grass', 'large_fern', 'sunflower', 'lilac', 'rose_bush', 'peony', 'tall_seagrass', 'pitcher_plant', 'small_dripleaf'])
const DIRT_FAMILY = new Set(['dirt', 'grass_block', 'podzol', 'coarse_dirt', 'rooted_dirt', 'moss_block', 'pale_moss_block', 'mud', 'muddy_mangrove_roots', 'farmland', 'mycelium', 'dirt_path'])
const FURNITURE = new Set([
  'chest', 'trapped_chest', 'ender_chest', 'anvil', 'chipped_anvil', 'damaged_anvil', 'lectern', 'brewing_stand',
  'cauldron', 'water_cauldron', 'lava_cauldron', 'powder_snow_cauldron', 'composter', 'grindstone', 'stonecutter',
  'bell', 'flower_pot', 'decorated_pot', 'enchanting_table', 'cake', 'end_portal_frame', 'conduit', 'shulker_box',
  'scaffolding', 'heavy_core', 'dragon_egg', 'lightning_rod', 'hopper', 'daylight_detector', 'chiseled_bookshelf_slab',
])
const TORCHES = new Set(['torch', 'wall_torch', 'soul_torch', 'soul_wall_torch', 'redstone_torch', 'redstone_wall_torch', 'copper_torch', 'copper_wall_torch'])
const CHAINS = new Set(['chain', 'iron_chain', 'copper_chain', 'exposed_copper_chain', 'weathered_copper_chain', 'oxidized_copper_chain'])
const GRAVITY = new Set(['sand', 'red_sand', 'gravel', 'suspicious_sand', 'suspicious_gravel', 'anvil', 'chipped_anvil', 'damaged_anvil', 'dragon_egg'])
// Official 1.21.1 data shipped with the skill: property values per block (block-states.json) and
// which blocks are full cubes (block-colors.json, measured from the models).
function readData(name) {
  try {
    return JSON.parse(readFileSync(fileURLToPath(new URL(`./lib/data/${name}`, import.meta.url)), 'utf8'))
  } catch {
    return null
  }
}
const OFFICIAL_STATES = readData('block-states.json')?.blocks ?? null
// The benchmark study's terrain list (ground, raw stone, sand, water...): excluded from ratios
const NORM_TERRAIN = new Set((readData('build-norms.json')?.definitions?.terrain ?? []).map(n => n.replace(/^minecraft:/, '')))
const FULL_CUBES = (() => {
  const data = readData('block-colors.json')
  const entries = data?.blocks ?? data
  if (!entries) return null
  return new Set(Object.entries(entries).filter(([, v]) => v && v.full).map(([k]) => k.replace(/^minecraft:/, '')))
})()
const officialValues = short => {
  const entry = OFFICIAL_STATES?.[`minecraft:${short}`]
  return entry ? new Map(Object.entries(entry.v ?? {}).map(([k, list]) => [k, new Set(list)])) : null
}

const FRAME_ID = /(_log|_wood|_stem|_hyphae|_pillar|^minecraft:bamboo_block|^minecraft:stripped_bamboo_block)$/

const CONNECTION_EXCEPTIONS = new Set(['barrier', 'carved_pumpkin', 'jack_o_lantern', 'melon', 'pumpkin'])
const NON_OPAQUE_FULL = /(^|_)glass$|^ice$|^frosted_ice$|^packed_ice$|^blue_ice$|^slime_block$|^honey_block$|^barrier$|^spawner$|^trial_spawner$|^vault$|^beacon$|^tinted_glass$|_leaves$|^mangrove_roots$/
const STONEISH = /(stone|cobble|brick|deepslate|andesite|diorite|granite|tuff|basalt|prismarine|quartz|purpur|calcite|obsidian|netherrack|tiles|bedrock)/

const isLog = n => /(_log|_wood|_hyphae)$/.test(n) || n === 'crimson_stem' || n === 'warped_stem' || n === 'bamboo_block' || n === 'stripped_bamboo_block'
const isLanternLike = n => n === 'lantern' || n === 'soul_lantern' || n.endsWith('copper_lantern')
const isCandle = n => n === 'candle' || n.endsWith('_candle')

function categorize(n, props, packFull) {
  if (n === 'water' || n === 'lava' || n === 'bubble_column') return 'fluid'
  if (n.endsWith('_stairs')) return 'stairs'
  if (n.endsWith('_slab')) return props.type === 'double' ? 'full' : 'slab'
  if (n.endsWith('_wall') && !n.endsWith('_wall_fan')) return 'wall'
  if (n.endsWith('_fence') || n.endsWith('_fence_gate')) return 'fence'
  if (n.endsWith('_pane') || n === 'iron_bars' || n.endsWith('copper_bars')) return 'pane'
  if (n.endsWith('_trapdoor')) return 'trapdoor'
  if (n.endsWith('_door')) return 'door'
  if (n.endsWith('_button')) return 'button'
  if (n.endsWith('_pressure_plate')) return 'plate'
  if (TORCHES.has(n) || isLanternLike(n) || isCandle(n) || n === 'end_rod' || n === 'campfire' || n === 'soul_campfire' || n === 'sea_pickle' || n === 'light') return 'light'
  if (n.startsWith('potted_')) return 'furniture'
  if (GROUND_PLANTS.has(n) || CROPS.has(n) || OTHER_PLANTS.has(n) || n.endsWith('_sapling') || n.endsWith('_coral') || n.endsWith('_coral_fan') || n.endsWith('_coral_wall_fan')) return 'plant'
  if (FURNITURE.has(n) || n.endsWith('_bed') || n.endsWith('_banner') || n.endsWith('_sign') || n.endsWith('_carpet') ||
      (n.endsWith('_head') && n !== 'piston_head') || n.endsWith('_skull') || n.startsWith('potted_') || n.endsWith('_shulker_box') ||
      n.endsWith('_candle_cake') || n === 'candle_cake' || n.endsWith('_shelf')) return 'furniture'
  if (packFull === true) return 'full'
  if (packFull === false) return 'other'
  // Not in the default pack: guess from the name.
  return /(_rail|^rail|ladder|chain|lever|tripwire|redstone_wire|repeater|comparator|snow$|cobweb|_bud$|cluster$|pointed_dripstone|_fan$|_vein$|^fire$|soul_fire|portal)/.test(n) ? 'other' : 'full'
}

function emission(n, p) {
  const lit = p.lit
  switch (n) {
    case 'torch': case 'wall_torch': case 'copper_torch': case 'copper_wall_torch': case 'end_rod': return 14
    case 'soul_torch': case 'soul_wall_torch': case 'soul_lantern': case 'soul_fire': return 10
    case 'redstone_torch': case 'redstone_wall_torch': return lit === 'false' ? 0 : 7
    case 'lantern': case 'glowstone': case 'sea_lantern': case 'shroomlight': case 'jack_o_lantern': case 'beacon':
    case 'conduit': case 'end_gateway': case 'end_portal': case 'fire': case 'lava': case 'ochre_froglight':
    case 'verdant_froglight': case 'pearlescent_froglight': return 15
    case 'redstone_lamp': return lit === 'true' ? 15 : 0
    case 'campfire': return lit === 'false' ? 0 : 15
    case 'soul_campfire': return lit === 'false' ? 0 : 10
    case 'furnace': case 'blast_furnace': case 'smoker': return lit === 'true' ? 13 : 0
    case 'magma_block': return 3
    case 'crying_obsidian': return 10
    case 'glow_lichen': return 7
    case 'light': return p.level === undefined ? 15 : Number(p.level) || 0
    case 'sea_pickle': return p.waterlogged === 'true' ? 3 * ((Number(p.pickles) || 1) + 1) : 0
    case 'nether_portal': return 11
    case 'ender_chest': case 'enchanting_table': return 7
    case 'cave_vines': case 'cave_vines_plant': return p.berries === 'true' ? 14 : 0
    case 'sculk_catalyst': return 6
    case 'amethyst_cluster': return 5
    case 'large_amethyst_bud': return 4
    case 'medium_amethyst_bud': return 2
    case 'small_amethyst_bud': case 'brewing_stand': case 'brown_mushroom': case 'dragon_egg': case 'end_portal_frame':
    case 'sculk_sensor': case 'calibrated_sculk_sensor': return 1
    case 'respawn_anchor': return [0, 3, 7, 11, 15][Number(p.charges) || 0] ?? 0
    case 'redstone_ore': case 'deepslate_redstone_ore': return lit === 'true' ? 9 : 0
    case 'trial_spawner': return p.ominous === 'true' ? 8 : 4
    case 'vault': return ['active', 'unlocking', 'ejecting'].includes(p.vault_state) ? 6 : 0
    case 'firefly_bush': return 2
    default: break
  }
  if (n.endsWith('copper_lantern')) return 15
  if (n.endsWith('copper_bulb')) {
    if (lit !== 'true') return 0
    const base = n.replace(/^waxed_/, '')
    return base.startsWith('exposed') ? 12 : base.startsWith('weathered') ? 8 : base.startsWith('oxidized') ? 4 : 15
  }
  if (n === 'candle' || n.endsWith('_candle')) return lit === 'true' ? 3 * (Number(p.candles) || 1) : 0
  if (n === 'candle_cake' || n.endsWith('_candle_cake')) return lit === 'true' ? 3 : 0
  return 0
}

// Lights that could be emitting but are switched off by their state (worth telling the agent).
function unlitNote(n, p) {
  if ((isCandle(n) || n === 'candle_cake' || n.endsWith('_candle_cake')) && p.lit !== 'true') return 'lit=false'
  if ((n === 'redstone_lamp' || n.endsWith('copper_bulb')) && p.lit !== 'true') return 'lit=false'
  if ((n === 'campfire' || n === 'soul_campfire') && p.lit === 'false') return 'lit=false'
  if (n === 'sea_pickle' && p.waterlogged !== 'true') return 'not waterlogged'
  return null
}

const DIR = { north: 0, east: 1, south: 2, west: 3 }
const DIR_NAMES = ['north', 'east', 'south', 'west', 'up', 'down']
const UP = 4
const DOWN = 5
const opposite = d => (d < 4 ? (d + 2) % 4 : d === UP ? DOWN : UP)
const ccw = d => (d + 3) % 4

// Where a block needs support. Returns a direction (0-3 horizontal, 4 up, 5 down), 'sides'
// (vine-like: at least one attached face), 'bell2' (double wall bell), or -1.
function supportRule(n, p, cat) {
  if (isLanternLike(n)) return p.hanging === 'true' ? UP : DOWN
  if (n.endsWith('wall_torch') || n.endsWith('_wall_sign') || n.endsWith('_wall_banner') || n === 'ladder' ||
      n.endsWith('_wall_head') || n.endsWith('_wall_skull') || n.endsWith('_wall_fan') || n === 'tripwire_hook') {
    return opposite(DIR[p.facing] ?? 0)
  }
  if (n.endsWith('_button') || n === 'lever') {
    if (p.face === 'floor') return DOWN
    if (p.face === 'ceiling') return UP
    return opposite(DIR[p.facing] ?? 0)
  }
  if (TORCHES.has(n)) return DOWN
  if (n.endsWith('_hanging_sign')) return n.endsWith('_wall_hanging_sign') ? -1 : UP
  if (n.endsWith('_sign') || n.endsWith('_banner') || isCandle(n) || n.endsWith('_carpet') || n.endsWith('_pressure_plate') ||
      n === 'rail' || n.endsWith('_rail') || n === 'redstone_wire' || n === 'repeater' || n === 'comparator' ||
      n === 'sea_pickle' || n === 'snow' || n === 'twisting_vines' || n === 'twisting_vines_plant') return DOWN
  if (n.endsWith('_door')) return (p.half ?? 'lower') === 'lower' ? DOWN : -1
  if (n === 'pointed_dripstone') return p.vertical_direction === 'down' ? UP : DOWN
  if (['spore_blossom', 'hanging_roots', 'cave_vines', 'cave_vines_plant', 'weeping_vines', 'weeping_vines_plant', 'pale_hanging_moss'].includes(n)) return UP
  if (n === 'bell') {
    if (p.attachment === 'ceiling') return UP
    if (p.attachment === 'single_wall') return DIR[p.facing] ?? 0
    if (p.attachment === 'double_wall') return 'bell2'
    return DOWN
  }
  if (n === 'cocoa') return DIR[p.facing] ?? 0
  if (n === 'vine' || n === 'glow_lichen' || n === 'sculk_vein' || n === 'resin_clump') return 'sides'
  if (cat === 'plant' && (GROUND_PLANTS.has(n) || CROPS.has(n) || n.endsWith('_sapling') || n === 'sugar_cane' || n === 'cactus' ||
      n === 'bamboo' || n === 'nether_wart' || n === 'brown_mushroom' || n === 'red_mushroom' || n.endsWith('_fungus') ||
      n.endsWith('_roots') || n === 'nether_sprouts' || n === 'small_dripleaf' || n === 'big_dripleaf' || n === 'moss_carpet' || n === 'pale_moss_carpet')) {
    if (p.half === 'upper') return -1
    return DOWN
  }
  return -1
}

// Which soil a plant needs below it, or null when any block is fine / not checked.
function soilRule(n, p) {
  if (p.half === 'upper') return null
  if (CROPS.has(n)) return { ok: s => s === 'farmland', label: 'farmland' }
  if (n === 'nether_wart') return { ok: s => s === 'soul_sand', label: 'soul_sand' }
  if (n === 'cactus') return { ok: s => s === 'sand' || s === 'red_sand' || s === 'suspicious_sand' || s === 'cactus', label: 'sand or cactus' }
  if (n === 'dead_bush' || n === 'short_dry_grass' || n === 'tall_dry_grass') {
    return { ok: s => DIRT_FAMILY.has(s) || s === 'sand' || s === 'red_sand' || s.endsWith('terracotta'), label: 'dirt, sand or terracotta' }
  }
  if (GROUND_PLANTS.has(n) || n.endsWith('_sapling')) {
    if (n === 'mangrove_propagule' && p.hanging === 'true') return null
    return { ok: s => DIRT_FAMILY.has(s), label: 'a dirt-family block (dirt, grass_block, podzol, moss_block, mud...)' }
  }
  return null
}

// ---------------------------------------------------------------------------------------------
// Default resource pack (bundled with Lodestone): block id validation, property values, and
// model-based full-cube detection.

async function loadPack() {
  try {
    const root = LODESTONE_ROOT
    const json = JSON.parse(await fs.readFile(path.join(root, 'assets', 'default-pack', 'assets.json'), 'utf8'))
    return { blockstates: json.blockstates ?? {}, models: json.models ?? {}, modelCache: new Map(), blockCache: new Map() }
  } catch {
    return null
  }
}

function modelIsFullCube(pack, name) {
  const key = String(name).replace(/^minecraft:/, '')
  if (pack.modelCache.has(key)) return pack.modelCache.get(key)
  let result = false
  let current = pack.models[key]
  for (let depth = 0; current && depth < 16; depth += 1) {
    if (current.elements) {
      const e = current.elements
      // full when some element spans the whole cube (grass_block adds a same-size overlay element)
      result = e.some(el => el.from?.every(v => v === 0) && el.to?.every(v => v === 16))
      break
    }
    if (!current.parent) break
    current = pack.models[String(current.parent).replace(/^minecraft:/, '')]
  }
  pack.modelCache.set(key, result)
  return result
}

// Returns { known, full, values: Map<prop, Set<value>> } for a block id.
function packInfo(pack, short) {
  if (!pack) return { known: undefined, full: undefined, values: new Map() }
  if (pack.blockCache.has(short)) return pack.blockCache.get(short)
  const bs = pack.blockstates[short]
  const info = { known: Boolean(bs), full: undefined, values: new Map() }
  const add = (k, v) => {
    if (!info.values.has(k)) info.values.set(k, new Set())
    info.values.get(k).add(v)
  }
  if (bs?.variants) {
    let allFull = true
    for (const [variantKey, variant] of Object.entries(bs.variants)) {
      if (variantKey) {
        for (const pair of variantKey.split(',')) {
          const [k, v] = pair.split('=')
          if (k && v !== undefined) add(k, v)
        }
      }
      const list = Array.isArray(variant) ? variant : [variant]
      if (!list.every(m => modelIsFullCube(pack, m.model))) allFull = false
    }
    info.full = allFull
  } else if (bs?.multipart) {
    // multipart models (mushroom blocks, chiseled bookshelves, fences...) are full cubes only when
    // the measured block data says so
    info.full = FULL_CUBES ? FULL_CUBES.has(short) : /^(mushroom_stem|brown_mushroom_block|red_mushroom_block)$/.test(short)
    const visit = when => {
      if (!when) return
      if (Array.isArray(when.OR) || Array.isArray(when.AND)) {
        for (const w of when.OR ?? when.AND) visit(w)
        return
      }
      for (const [k, v] of Object.entries(when)) {
        for (const value of String(v).split('|')) add(k, value)
      }
    }
    for (const part of bs.multipart) visit(part.when)
    for (const set of info.values.values()) {
      if (set.has('true')) set.add('false')
      if (set.has('low') || set.has('tall')) set.add('none')
      if (set.has('up') || set.has('side')) set.add('none')
      if ([...set].every(v => /^\d+$/.test(v))) set.add('0')
    }
  }
  pack.blockCache.set(short, info)
  return info
}

// ---------------------------------------------------------------------------------------------
// Structure loading

function parseStateString(text) {
  const clean = String(text).replace(/\{.*$/s, '').trim()
  const bracket = clean.indexOf('[')
  let name = bracket >= 0 ? clean.slice(0, bracket) : clean
  if (!name.includes(':')) name = `minecraft:${name}`
  const props = {}
  if (bracket >= 0) {
    const body = clean.slice(bracket + 1, clean.lastIndexOf(']') > bracket ? clean.lastIndexOf(']') : undefined)
    for (const pair of body.split(',')) {
      const [k, v] = pair.split('=').map(s => s?.trim())
      if (k && v !== undefined) props[k] = v
    }
  }
  return { name, props }
}

function stateKey(name, props) {
  const keys = Object.keys(props).sort()
  return keys.length ? `${name}[${keys.map(k => `${k}=${props[k]}`).join(',')}]` : name
}

class Grid {
  // Covers the non-air bounding box plus a 1-block empty margin, so every block's 6 neighbors
  // are addressable without bounds checks.
  constructor(min, max, paletteSize) {
    this.ox = min[0] - 1
    this.oy = min[1] - 1
    this.oz = min[2] - 1
    this.w = max[0] - min[0] + 3
    this.h = max[1] - min[1] + 3
    this.d = max[2] - min[2] + 3
    this.layer = this.w * this.d
    this.vol = this.layer * this.h
    this.dense = this.vol <= DENSE_LIMIT
    if (this.dense) {
      const data = paletteSize < 65535 ? new Uint16Array(this.vol) : new Uint32Array(this.vol)
      this.data = data
      this.get = i => data[i] - 1
      this.set = (i, s) => { data[i] = s + 1 }
    } else {
      const map = new Map()
      this.data = map
      this.get = i => (map.get(i) ?? 0) - 1
      this.set = (i, s) => { if (s < 0) map.delete(i); else map.set(i, s + 1) }
    }
    // neighbor offsets: north, east, south, west, up, down
    this.off = [-this.w, 1, this.w, -1, this.layer, -this.layer]
  }

  index(x, y, z) {
    const gx = x - this.ox
    const gy = y - this.oy
    const gz = z - this.oz
    if (gx < 0 || gy < 0 || gz < 0 || gx >= this.w || gy >= this.h || gz >= this.d) return -1
    return gx + this.w * (gz + this.d * gy)
  }

  at(x, y, z) {
    const i = this.index(x, y, z)
    return i < 0 ? -1 : this.get(i)
  }

  // Grid-local coordinates of an index.
  gx(i) { return i % this.w }
  gz(i) { return Math.floor(i / this.w) % this.d }
  gy(i) { return Math.floor(i / this.layer) }
  pos(i) { return [this.gx(i) + this.ox, this.gy(i) + this.oy, this.gz(i) + this.oz] }

  // Neighbor index of i in direction dir, or -1 when it leaves the grid (needed for empty cells).
  step(i, dir) {
    switch (dir) {
      case 0: return this.gz(i) > 0 ? i - this.w : -1
      case 1: return this.gx(i) < this.w - 1 ? i + 1 : -1
      case 2: return this.gz(i) < this.d - 1 ? i + this.w : -1
      case 3: return this.gx(i) > 0 ? i - 1 : -1
      case 4: return i + this.layer < this.vol ? i + this.layer : -1
      default: return i - this.layer >= 0 ? i - this.layer : -1
    }
  }
}

function loadStructure(root, options) {
  const size = (root.size ?? [0, 0, 0]).map(Number)
  let paletteList = root.palette
  let paletteCount = 1
  let paletteIndex = 0
  if (!paletteList && Array.isArray(root.palettes)) {
    paletteCount = root.palettes.length
    paletteIndex = Math.min(options.palette, Math.max(0, paletteCount - 1))
    paletteList = root.palettes[paletteIndex] ?? []
  }
  if (!Array.isArray(paletteList)) throw new Error('File has no palette; is this a vanilla structure .nbt?')
  if (!Array.isArray(root.blocks)) throw new Error('File has no blocks list; is this a vanilla structure .nbt?')

  const states = []
  const stateIndex = new Map()
  const intern = (name, props) => {
    const key = stateKey(name, props)
    let index = stateIndex.get(key)
    if (index === undefined) {
      index = states.length
      states.push({ name, props, key })
      stateIndex.set(key, index)
    }
    return index
  }
  const paletteMap = paletteList.map(entry => {
    let name = String(entry?.Name ?? 'minecraft:air')
    if (!name.includes(':')) name = `minecraft:${name}`
    const props = {}
    for (const [k, v] of Object.entries(entry?.Properties ?? {})) props[k] = String(v)
    return intern(name, props)
  })

  const n = root.blocks.length
  const bx = new Int32Array(n)
  const by = new Int32Array(n)
  const bz = new Int32Array(n)
  const bs = new Int32Array(n)
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  let airEntries = 0
  let jigsaws = 0
  let outside = 0
  let badState = 0
  const nbtByEntry = new Map()
  const jigsawEntries = new Set()
  for (let k = 0; k < n; k += 1) {
    const block = root.blocks[k]
    const pos = block.pos ?? [0, 0, 0]
    const x = pos[0] | 0
    const y = pos[1] | 0
    const z = pos[2] | 0
    let s = paletteMap[block.state]
    if (s === undefined) { badState += 1; s = -1 }
    if (s >= 0 && states[s].name === 'minecraft:jigsaw' && typeof block.nbt?.final_state === 'string') {
      jigsaws += 1
      jigsawEntries.add(k)
      const parsed = parseStateString(block.nbt.final_state)
      s = intern(parsed.name, parsed.props)
    }
    if (s >= 0 && EMPTY_IDS.has(states[s].name)) { airEntries += 1; s = -1 }
    if (x < 0 || y < 0 || z < 0 || x >= size[0] || y >= size[1] || z >= size[2]) outside += 1
    bx[k] = x
    by[k] = y
    bz[k] = z
    bs[k] = s
    if (s >= 0) {
      if (x < min[0]) min[0] = x
      if (y < min[1]) min[1] = y
      if (z < min[2]) min[2] = z
      if (x > max[0]) max[0] = x
      if (y > max[1]) max[1] = y
      if (z > max[2]) max[2] = z
      if (block.nbt && !jigsawEntries.has(k)) nbtByEntry.set(k, block.nbt)
    }
  }

  const empty = !Number.isFinite(min[0])
  const grid = empty ? new Grid([0, 0, 0], [0, 0, 0], states.length) : new Grid(min, max, states.length)
  const nbt = new Map()
  const fromJigsaw = new Set()
  let duplicates = 0
  for (let k = 0; k < n; k += 1) {
    const i = grid.index(bx[k], by[k], bz[k])
    if (i < 0) continue // only air can land outside the non-air bounding box
    if (grid.get(i) >= 0) duplicates += 1
    grid.set(i, bs[k])
    if (bs[k] >= 0 && nbtByEntry.has(k)) nbt.set(i, nbtByEntry.get(k))
    else nbt.delete(i)
    if (jigsawEntries.has(k)) fromJigsaw.add(i)
    else fromJigsaw.delete(i)
  }

  // Occupied cells in y, z, x order.
  let occ
  if (grid.dense) {
    let count = 0
    const data = grid.data
    for (let i = 0; i < grid.vol; i += 1) if (data[i]) count += 1
    occ = new Int32Array(count)
    let c = 0
    for (let i = 0; i < grid.vol; i += 1) if (data[i]) occ[c++] = i
  } else {
    occ = Float64Array.from(grid.data.keys()).sort()
  }

  const entities = {}
  for (const entity of Array.isArray(root.entities) ? root.entities : []) {
    const id = entity?.nbt?.id ?? 'unknown'
    entities[id] = (entities[id] ?? 0) + 1
  }

  return {
    size,
    dataVersion: root.DataVersion,
    paletteCount,
    paletteIndex,
    states,
    grid,
    occ,
    nbt,
    fromJigsaw,
    bounds: empty ? null : { min, max },
    entries: n,
    airEntries,
    jigsaws,
    outside,
    badState,
    duplicates,
    entities,
  }
}

// Per-state derived info used by all analyses.
function analyzeStates(states, pack) {
  return states.map(state => {
    const short = state.name.startsWith('minecraft:') ? state.name.slice('minecraft:'.length) : state.name
    const info = state.name.startsWith('minecraft:') ? packInfo(pack, short) : { known: pack ? false : undefined, full: undefined, values: new Map() }
    const p = state.props
    const cat = categorize(short, p, info.full)
    const emit = emission(short, p)
    const fullCube = cat === 'full'
    const glassy = NON_OPAQUE_FULL.test(short)
    const isLeaves = short.endsWith('_leaves')
    const stairs = cat === 'stairs'
    const top = (stairs && p.half === 'top') || (cat === 'slab' && p.type === 'top')
    return {
      ...state,
      short,
      cat,
      emit,
      fullCube,
      known: info.known,
      packValues: info.values,
      opaque: fullCube && !glassy, // blocks block light
      damp: isLeaves || short === 'water' || short === 'ice' ? 1 : 0,
      spawnTop: (fullCube && !glassy && short !== 'magma_block') || top,
      passable: cat === 'plant' || cat === 'button' || cat === 'plate' || TORCHES.has(short) || short === 'redstone_wire' || short === 'rail' || short.endsWith('_rail') || short === 'light',
      isLeaves,
      stairs,
      facing: DIR[p.facing] ?? 0,
      half: p.half === 'top' ? 1 : 0,
      shape: p.shape ?? 'straight',
      isWall: cat === 'wall',
      isFence: short.endsWith('_fence'),
      isGate: short.endsWith('_fence_gate'),
      isPane: cat === 'pane',
      woodenFence: short.endsWith('_fence') && short !== 'nether_brick_fence',
      sturdy: fullCube && info.known !== false && !CONNECTION_EXCEPTIONS.has(short) && !isLeaves && !short.endsWith('shulker_box'),
      support: supportRule(short, p, cat),
      soil: cat === 'plant' ? soilRule(short, p) : null,
      gravity: GRAVITY.has(short) || short.endsWith('_concrete_powder'),
      unlit: unlitNote(short, p),
    }
  })
}

// ---------------------------------------------------------------------------------------------
// Summary

function countStates(model) {
  const counts = new Int32Array(model.states.length)
  const { grid, occ } = model
  for (let k = 0; k < occ.length; k += 1) counts[grid.get(occ[k])] += 1
  return counts
}

function buildSummary(model, info, counts, options) {
  const total = model.occ.length
  const byName = new Map()
  info.forEach((s, index) => {
    if (!counts[index]) return
    const row = byName.get(s.name) ?? { id: s.name, category: s.cat, count: 0, states: 0 }
    row.count += counts[index]
    row.states += 1
    byName.set(s.name, row)
  })
  const ids = [...byName.values()].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
  const stateRows = info
    .map((s, index) => ({ state: s.key, id: s.name, category: s.cat, count: counts[index] }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state))
  for (const row of ids) row.percent = pct(row.count, total)
  for (const row of stateRows) row.percent = pct(row.count, total)

  const categories = Object.fromEntries(Object.keys(CATEGORY_LABELS).map(c => [c, 0]))
  info.forEach((s, index) => { categories[s.cat] += counts[index] })
  // detail ratio over built blocks: terrain (ground, raw stone, sand, water...) would drown it
  let terrainCount = 0
  info.forEach((s, index) => { if (NORM_TERRAIN.has(s.short) && s.cat === 'full') terrainCount += counts[index] })
  const solid = total - categories.fluid - terrainCount
  const partial = solid - (categories.full - terrainCount)
  const b = model.bounds
  return {
    size: model.size,
    volume: model.size[0] * model.size[1] * model.size[2],
    blocks: total,
    fillPercent: pct(total, model.size[0] * model.size[1] * model.size[2]),
    bounds: b ? { min: b.min, max: b.max, size: [0, 1, 2].map(a => b.max[a] - b.min[a] + 1) } : null,
    blockIds: ids.length,
    blockStates: stateRows.length,
    palette: ids,
    paletteStates: stateRows,
    categories,
    detailRatio: solid > 0 ? round(partial / solid, 3) : 0,
    entities: model.entities,
    file: {
      entries: model.entries,
      airEntries: model.airEntries,
      jigsawsResolved: model.jigsaws,
      paletteCount: model.paletteCount,
      paletteIndex: model.paletteIndex,
      duplicates: model.duplicates,
      outsideSize: model.outside,
      badStateRefs: model.badState,
    },
    showAll: options.all,
  }
}

// ---------------------------------------------------------------------------------------------
// Lighting: approximate block-light BFS plus a walkable-dark-spot estimate.

function computeLighting(model, info, counts) {
  const { grid, occ } = model
  const sources = new Map()
  const unlit = new Map()
  info.forEach((s, index) => {
    if (!counts[index]) return
    if (s.emit > 0) {
      const row = sources.get(s.name) ?? { id: s.name, count: 0, level: s.emit }
      row.count += counts[index]
      row.level = Math.max(row.level, s.emit)
      sources.set(s.name, row)
    }
    if (s.unlit) {
      const key = `${s.name} (${s.unlit})`
      unlit.set(key, (unlit.get(key) ?? 0) + counts[index])
    }
  })

  const light = grid.dense ? new Uint8Array(grid.vol) : new Map()
  const getL = grid.dense ? i => light[i] : i => light.get(i) ?? 0
  const setL = grid.dense ? (i, v) => { light[i] = v } : (i, v) => { light.set(i, v) }
  const buckets = Array.from({ length: 16 }, () => [])
  let sourceCount = 0
  for (let k = 0; k < occ.length; k += 1) {
    const i = occ[k]
    const e = info[grid.get(i)].emit
    if (e > 0) {
      sourceCount += 1
      if (e > getL(i)) {
        setL(i, e)
        buckets[e].push(i)
      }
    }
  }
  for (let level = 15; level >= 1; level -= 1) {
    const bucket = buckets[level]
    for (let q = 0; q < bucket.length; q += 1) {
      const i = bucket[q]
      if (getL(i) !== level) continue
      for (let dir = 0; dir < 6; dir += 1) {
        const n = grid.step(i, dir)
        if (n < 0) continue
        const s = grid.get(n)
        let next = level - 1
        if (s >= 0) {
          if (info[s].opaque) continue
          next -= info[s].damp
        }
        if (next > getL(n)) {
          setL(n, next)
          if (next > 0) buckets[next].push(n)
        }
      }
    }
    buckets[level] = null
  }

  // Column tops (highest non-passable block) to decide whether a spot is roofed.
  const top = new Int32Array(grid.w * grid.d).fill(-1)
  for (let k = 0; k < occ.length; k += 1) {
    const i = occ[k]
    // tree canopies do not make a spot "roofed": mobs under trees are not an interior problem
    if (info[grid.get(i)].passable || info[grid.get(i)].isLeaves) continue
    const col = i % grid.layer
    const y = Math.floor(i / grid.layer)
    if (y > top[col]) top[col] = y
  }

  const maxGy = model.bounds ? model.bounds.max[1] - grid.oy : 0
  let walkCovered = 0
  let walkOpen = 0
  let darkCovered = 0
  let darkOpen = 0
  const pockets = new Map()
  for (let k = 0; k < occ.length; k += 1) {
    const i = occ[k]
    if (!info[grid.get(i)].spawnTop) continue
    const p = i + grid.layer
    const gy = Math.floor(p / grid.layer)
    if (gy > maxGy || grid.get(p) >= 0) continue
    const above = grid.get(p + grid.layer)
    if (above >= 0 && !info[above].passable) continue
    const covered = top[p % grid.layer] > gy
    const dark = getL(p) === 0
    if (covered) {
      walkCovered += 1
      if (dark) {
        darkCovered += 1
        const [x, y, z] = grid.pos(p)
        const key = `${x >> 3},${y >> 2},${z >> 3}`
        const pocket = pockets.get(key)
        if (pocket) {
          pocket.count += 1
          pocket.min = pocket.min.map((v, a) => Math.min(v, [x, y, z][a]))
          pocket.max = pocket.max.map((v, a) => Math.max(v, [x, y, z][a]))
        } else {
          pockets.set(key, { count: 1, min: [x, y, z], max: [x, y, z], at: [x, y, z] })
        }
      }
    } else {
      walkOpen += 1
      if (dark) darkOpen += 1
    }
  }

  return {
    approximate: true,
    sourceBlocks: sourceCount,
    sources: [...sources.values()].sort((a, b) => b.count - a.count),
    unlit: [...unlit.entries()].map(([id, count]) => ({ id, count })),
    walkable: { covered: walkCovered, open: walkOpen },
    dark: {
      covered: darkCovered,
      coveredPercent: pct(darkCovered, walkCovered),
      open: darkOpen,
      openPercent: pct(darkOpen, walkOpen),
    },
    darkPockets: [...pockets.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    lightAt: getL,
  }
}

// ---------------------------------------------------------------------------------------------
// Slices

const PUNCT_POOL = '#%&@$+=-_^~:;!\'"`,<>()[]{}/\\|*'
const GENERIC_POOL = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789${PUNCT_POOL}`

function nameLetters(short, upper) {
  const words = short.split('_').filter(Boolean)
  const firsts = words.map(w => w[0])
  const all = short.replace(/[^a-z]/g, '').split('')
  const caseA = c => (upper ? c.toUpperCase() : c.toLowerCase())
  const caseB = c => (upper ? c.toLowerCase() : c.toUpperCase())
  // material word first (last word is usually the shape: planks, bricks, log...), then the rest
  const ordered = [...firsts.slice(0, -1), firsts.at(-1)].filter(Boolean)
  return [...ordered.map(caseA), ...ordered.map(caseB), ...all.map(caseA), ...all.map(caseB)]
}

function connections(s) {
  const p = s.props
  const on = v => v !== undefined && v !== 'false' && v !== 'none'
  const ns = on(p.north) || on(p.south)
  const ew = on(p.east) || on(p.west)
  if (ns && !ew) return 'ns'
  if (ew && !ns) return 'ew'
  return 'post'
}

// Variant key, preferred glyphs and legend label of a state for a given view ('y' = top view,
// 'x' / 'z' = side views).
function glyphSpec(s, view) {
  const n = s.short
  const p = s.props
  const letters = nameLetters(n, s.fullCube)
  const spec = (key, prefs, label) => ({ key, prefs, letters, label: label ?? n })
  if (s.cat === 'stairs') {
    const f = p.facing ?? 'north'
    const h = p.half ?? 'bottom'
    const label = `${n} facing=${f} half=${h}`
    if (view === 'y') {
      const arrows = { north: ['^', 'A'], south: ['v', 'V'], east: ['>', ')'], west: ['<', '('] }[f] ?? ['^']
      return spec(`${n}|${f}|${h}`, h === 'top' ? [...arrows].reverse() : arrows, label)
    }
    const horizontal = view === 'x' ? ['south', 'north'] : ['east', 'west'] // [ascends right, ascends left]
    if (f === horizontal[0]) return spec(`${n}|${f}|${h}`, h === 'top' ? ['7', 'q'] : ['/', 'J'], label)
    if (f === horizontal[1]) return spec(`${n}|${f}|${h}`, h === 'top' ? ['r', 'F'] : ['\\', 'L'], label)
    return spec(`${n}|${f}|${h}`, h === 'top' ? ['u', 'y'] : ['n', 'h'], label)
  }
  if (s.cat === 'slab') {
    const t = p.type ?? 'bottom'
    return spec(`${n}|${t}`, t === 'top' ? ['=', '^'] : ['_', ','], `${n} type=${t}`)
  }
  if (s.cat === 'wall' || s.cat === 'pane' || s.isFence) {
    if (view === 'y') {
      const c = connections(s)
      const label = `${n} (${c === 'ns' ? 'north-south run' : c === 'ew' ? 'east-west run' : 'post/corner'})`
      const base = { ns: ['|'], ew: ['-'], post: ['+'] }[c]
      const extra = s.cat === 'wall' ? { ns: ['I'], ew: ['='], post: ['o'] }[c] : s.cat === 'pane' ? [':'] : ['!']
      return spec(`${n}|${c}`, [...base, ...extra], label)
    }
    return spec(n, s.cat === 'pane' ? [':', '|', ';'] : s.cat === 'wall' ? ['I', '|', 'H'] : ['|', '!', 'i'])
  }
  if (s.isGate) return spec(n, view === 'y' ? ['/', 'g'] : ['g', 'G'])
  if (isLog(n)) {
    const a = p.axis ?? 'y'
    return spec(`${n}|${a}`, { y: ['L', 'I', 'l'], x: ['x', 'X'], z: ['z', 'Z'] }[a] ?? ['L'], `${n} axis=${a}`)
  }
  if (s.cat === 'door') return spec(n, ['D', 'd'])
  if (s.cat === 'trapdoor') return spec(n, ['T', 't'])
  if (s.cat === 'button') return spec(n, ["'", '`'])
  if (s.cat === 'plate') return spec(n, [',', '`'])
  if (s.cat === 'fluid') return spec(n, n === 'lava' ? ['%', 'W'] : ['~', 'w'])
  if (TORCHES.has(n) || n === 'end_rod') return spec(n, ['!', 'i', '*'])
  if (isLanternLike(n)) return spec(n, ['*', 'o', 'O'])
  if (isCandle(n)) return spec(n, ['i', '*', '!'])
  if (s.emit >= 10 && s.fullCube) return spec(`${n}|lit`, ['@', '*', 'O'], s.props.lit ? `${n} lit=${s.props.lit}` : n)
  if (s.emit >= 10) return spec(`${n}|lit`, ['*', '@'], s.props.lit ? `${n} lit=${s.props.lit}` : n)
  if (s.isLeaves) return spec(n, ['&', '%'])
  if (s.cat === 'plant') return spec(n, ['"', "'", ',', '`'])
  if (/(^|_)glass$/.test(n)) return spec(n, [':', ';'])
  if (n === 'ladder') return spec(n, ['H'])
  if (CHAINS.has(n)) return spec(n, ['$', '8'])
  if (n.endsWith('_carpet')) return spec(n, [',', '_'])
  if (n.endsWith('_bed')) return spec(n, ['B', 'b'])
  if (n === 'chest' || n === 'trapped_chest' || n === 'barrel' || n === 'ender_chest') return spec(n, ['C', 'c'])
  if (n === 'rail' || n.endsWith('_rail')) return spec(n, ['=', 'r'])
  if (s.fullCube && STONEISH.test(n)) return spec(n, ['#', '%'])
  return spec(n, [])
}

// Collects the cells of every requested slice, then assigns one symbol per variant key for each
// view type so symbols stay stable across all slices of that view.
function buildSlices(model, info, options) {
  const { grid } = model
  const b = model.bounds
  const requests = options.slices
  if (!requests.length) return { slices: null, legends: new Map() }
  const size = model.size
  const axisIndex = { x: 0, y: 1, z: 2 }
  const clampRange = (axis, fallback) => {
    const a = axisIndex[axis]
    const r = options.range?.[axis] ?? fallback
    return [Math.max(0, r[0]), Math.min(size[a] - 1, r[1])]
  }
  const bboxRange = axis => (b ? [b.min[axisIndex[axis]], b.max[axisIndex[axis]]] : [0, size[axisIndex[axis]] - 1])

  const specCache = { x: new Map(), y: new Map(), z: new Map() }
  const specFor = (s, view) => {
    let spec = specCache[view].get(s)
    if (!spec) {
      spec = glyphSpec(info[s], view)
      specCache[view].set(s, spec)
    }
    return spec
  }

  const slices = []
  for (const req of requests) {
    const a = axisIndex[req.axis]
    if (req.value < 0 || req.value >= size[a]) {
      throw new Error(`--slice ${req.axis}=${req.value} is outside the structure (${req.axis} 0..${size[a] - 1})`)
    }
    // horizontal (columns) and vertical (rows) axes of the map
    const [colAxis, rowAxis] = req.axis === 'y' ? ['x', 'z'] : req.axis === 'x' ? ['z', 'y'] : ['x', 'y']
    const cols = clampRange(colAxis, bboxRange(colAxis))
    const rows = clampRange(rowAxis, bboxRange(rowAxis))
    if (cols[0] > cols[1] || rows[0] > rows[1]) throw new Error(`--range does not overlap the structure (size ${size.join(' x ')})`)
    const rowValues = []
    if (req.axis === 'y') for (let v = rows[0]; v <= rows[1]; v += 1) rowValues.push(v) // north at top
    else for (let v = rows[1]; v >= rows[0]; v -= 1) rowValues.push(v) // highest y at top
    const cells = []
    let filled = 0
    for (const rv of rowValues) {
      const row = []
      for (let cv = cols[0]; cv <= cols[1]; cv += 1) {
        const pos = [0, 0, 0]
        pos[a] = req.value
        pos[axisIndex[colAxis]] = cv
        pos[axisIndex[rowAxis]] = rv
        const s = grid.at(pos[0], pos[1], pos[2])
        row.push(s)
        if (s >= 0) filled += 1
      }
      cells.push(row)
    }
    slices.push({ ...req, colAxis, rowAxis, cols, rows, rowValues, cells, filled })
  }

  // Symbol assignment per view.
  const byView = new Map()
  for (const slice of slices) {
    const view = slice.axis
    if (!byView.has(view)) byView.set(view, new Map())
    const keys = byView.get(view)
    for (const row of slice.cells) {
      for (const s of row) {
        if (s < 0) continue
        const spec = specFor(s, view)
        const entry = keys.get(spec.key) ?? { spec, count: 0 }
        entry.count += 1
        keys.set(spec.key, entry)
      }
    }
  }
  const legends = new Map()
  for (const [view, keys] of byView) {
    const used = new Set(['.', ' ', '?'])
    const assign = new Map()
    const entries = [...keys.values()].sort((p, q) => q.count - p.count || p.spec.key.localeCompare(q.spec.key))
    // Pass 1: mnemonic class symbols (arrows for stairs, D for doors, L for logs...), most common first.
    for (const entry of entries) {
      const glyph = entry.spec.prefs.find(c => !used.has(c))
      if (glyph) {
        used.add(glyph)
        assign.set(entry.spec.key, glyph)
      }
    }
    // Pass 2: letters from the block name, then anything left.
    for (const entry of entries) {
      if (assign.has(entry.spec.key)) continue
      const glyph = entry.spec.letters.find(c => !used.has(c)) ?? [...GENERIC_POOL].find(c => !used.has(c)) ?? '?'
      if (glyph !== '?') used.add(glyph)
      assign.set(entry.spec.key, glyph)
    }
    const legend = new Map()
    for (const entry of entries) {
      const glyph = assign.get(entry.spec.key)
      const row = legend.get(glyph) ?? { glyph, labels: [], count: 0 }
      row.labels.push(entry.spec.label)
      row.count += entry.count
      legend.set(glyph, row)
    }
    legends.set(view, { assign, rows: [...legend.values()] })
  }
  for (const slice of slices) {
    const { assign } = legends.get(slice.axis)
    slice.lines = slice.cells.map(row => row.map(s => (s < 0 ? '.' : assign.get(specFor(s, slice.axis).key))).join(''))
    delete slice.cells
  }
  return { slices, legends }
}

function sliceTitle(slice) {
  const colRange = `${slice.colAxis} ${slice.cols[0]}..${slice.cols[1]}`
  const rowRange = `${slice.rowAxis} ${slice.rows[0]}..${slice.rows[1]}`
  if (slice.axis === 'y') return `y=${slice.value}  top view: north (z-) up, east (x+) right; ${colRange}, ${rowRange}`
  if (slice.axis === 'x') return `x=${slice.value}  side view from the west: north (z-) left, south right, top row = highest y; ${colRange}, ${rowRange}`
  return `z=${slice.value}  side view from the south: west (x-) left, east right, top row = highest y; ${colRange}, ${rowRange}`
}

function formatSlice(slice) {
  const out = []
  out.push(`--- ${sliceTitle(slice)}  (${slice.filled} blocks)`)
  const labelWidth = Math.max(...slice.rowValues.map(v => String(v).length), slice.rowAxis.length) + 1
  const colValues = []
  for (let v = slice.cols[0]; v <= slice.cols[1]; v += 1) colValues.push(v)
  const digits = Math.max(...colValues.map(v => String(v).length))
  for (let place = digits - 1; place >= 0; place -= 1) {
    const ruler = colValues
      .map(v => {
        const s = String(v)
        const ch = s.length > place ? s[s.length - 1 - place] : ' '
        // Only print higher place digits where they change, so the ruler stays readable.
        if (place > 0 && v !== colValues[0] && v % 10 !== 0) return ' '
        return ch
      })
      .join('')
    const label = place === 0 ? slice.colAxis : ''
    out.push(`${label.padStart(labelWidth)} ${ruler}`)
  }
  slice.lines.forEach((line, r) => {
    out.push(`${String(slice.rowValues[r]).padStart(labelWidth)} ${line}`)
  })
  return out.join('\n')
}

function formatLegend(view, legend) {
  const name = view === 'y' ? 'top views' : view === 'x' ? 'x side views' : 'z side views'
  const lines = [`Legend (${name}; '.' = empty):`]
  for (const row of legend.rows) {
    const labels = row.labels.length > 3 ? [...row.labels.slice(0, 3), `+${row.labels.length - 3} more`] : row.labels
    lines.push(`  ${row.glyph}  ${labels.join(', ')}  (${row.count})`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------------------------
// Profile

function buildProfile(model, info) {
  const { grid, occ, bounds } = model
  if (!bounds) return []
  const footprint = (bounds.max[0] - bounds.min[0] + 1) * (bounds.max[2] - bounds.min[2] + 1)
  const layers = new Map()
  for (let k = 0; k < occ.length; k += 1) {
    const i = occ[k]
    const s = grid.get(i)
    const y = Math.floor(i / grid.layer) + grid.oy
    let layer = layers.get(y)
    if (!layer) {
      layer = { y, count: 0, partial: 0, fluid: 0, ids: new Map() }
      layers.set(y, layer)
    }
    layer.count += 1
    if (info[s].cat === 'fluid') layer.fluid += 1
    else if (!info[s].fullCube) layer.partial += 1
    layer.ids.set(info[s].name, (layer.ids.get(info[s].name) ?? 0) + 1)
  }
  const rows = []
  for (let y = bounds.max[1]; y >= bounds.min[1]; y -= 1) {
    const layer = layers.get(y) ?? { y, count: 0, partial: 0, fluid: 0, ids: new Map() }
    const top = [...layer.ids.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, count]) => ({ id, count }))
    const solid = layer.count - layer.fluid
    rows.push({
      y,
      blocks: layer.count,
      coveragePercent: pct(layer.count, footprint),
      distinct: layer.ids.size,
      detailPercent: pct(layer.partial, solid),
      top,
    })
  }
  for (let r = 0; r < rows.length; r += 1) {
    const above = rows[r - 1]?.blocks ?? 0
    const below = rows[r + 1]?.blocks ?? 0
    rows[r].dense = rows[r].coveragePercent >= 20 && rows[r].blocks >= 1.5 * Math.max(above, below, 1)
  }
  return rows
}

// ---------------------------------------------------------------------------------------------
// Find

function buildFind(model, info, query, limit) {
  const q = query.trim().toLowerCase()
  const exact = q.includes(':') && !q.includes('[') && !q.includes('=')
  const matches = new Set()
  info.forEach((s, index) => {
    const key = s.key.toLowerCase()
    if (exact ? s.name === q : key.includes(q) || s.short === q) matches.add(index)
  })
  const { grid, occ } = model
  const positions = []
  let total = 0
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const counts = new Map()
  for (let k = 0; k < occ.length; k += 1) {
    const i = occ[k]
    const s = grid.get(i)
    if (!matches.has(s)) continue
    total += 1
    const pos = grid.pos(i)
    for (let a = 0; a < 3; a += 1) {
      if (pos[a] < min[a]) min[a] = pos[a]
      if (pos[a] > max[a]) max[a] = pos[a]
    }
    counts.set(info[s].key, (counts.get(info[s].key) ?? 0) + 1)
    if (positions.length < limit) {
      const nbt = model.nbt.get(i)
      positions.push({ pos, state: info[s].key, ...(nbt ? { nbt: nbt.id ?? true } : {}), ...(model.fromJigsaw.has(i) ? { fromJigsaw: true } : {}) })
    }
  }
  return {
    query,
    mode: exact ? 'exact id' : 'substring',
    total,
    shown: positions.length,
    bounds: total ? { min, max } : null,
    states: [...counts.entries()].map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count),
    positions,
  }
}

// ---------------------------------------------------------------------------------------------
// Checks

function exteriorAir(model) {
  // Flood fill from the empty margin through empty cells. Air reached this way is "outside".
  // Map-backed (huge sparse) grids use a cheaper test: a 64-block ray in the face direction
  // that hits nothing counts as outside.
  const { grid } = model
  if (!grid.dense) {
    return (i, dir) => {
      let n = i
      for (let steps = 0; steps < 64; steps += 1) {
        n = grid.step(n, dir)
        if (n < 0) return true
        if (grid.get(n) >= 0) return false
      }
      return true
    }
  }
  const ext = new Uint8Array(grid.vol)
  let stack = new Int32Array(1 << 16)
  let top = 0
  const push = i => {
    if (top === stack.length) {
      const bigger = new Int32Array(stack.length * 2)
      bigger.set(stack)
      stack = bigger
    }
    stack[top++] = i
  }
  ext[0] = 1
  push(0)
  while (top > 0) {
    const i = stack[--top]
    for (let dir = 0; dir < 6; dir += 1) {
      const n = grid.step(i, dir)
      if (n < 0 || ext[n] || grid.data[n]) continue
      ext[n] = 1
      push(n)
    }
  }
  return i => ext[i] === 1
}

function largestRects(width, height, cells, minShort, minLong) {
  // cells: Int32Array (width*height, row-major by v) with state ids or -1. Labels connected
  // equal-value regions and finds each region's largest qualifying rectangle.
  const labels = new Int32Array(width * height).fill(-1)
  const areas = []
  const stack = []
  for (let start = 0; start < cells.length; start += 1) {
    if (cells[start] < 0 || labels[start] >= 0) continue
    const label = areas.length
    let area = 0
    labels[start] = label
    stack.push(start)
    while (stack.length) {
      const c = stack.pop()
      area += 1
      const u = c % width
      const v = (c - u) / width
      const neighbors = [u > 0 ? c - 1 : -1, u < width - 1 ? c + 1 : -1, v > 0 ? c - width : -1, v < height - 1 ? c + width : -1]
      for (const nb of neighbors) {
        if (nb >= 0 && labels[nb] < 0 && cells[nb] === cells[start]) {
          labels[nb] = label
          stack.push(nb)
        }
      }
    }
    areas.push(area)
  }
  const minArea = minShort * minLong
  const best = new Map()
  const heights = new Int32Array(width)
  for (let v = 0; v < height; v += 1) {
    for (let u = 0; u < width; u += 1) {
      const c = v * width + u
      const label = labels[c]
      if (label < 0 || areas[label] < minArea) { heights[u] = 0; continue }
      heights[u] = v > 0 && labels[c - width] === label ? heights[u] + 1 : 1
    }
    let u = 0
    while (u < width) {
      if (!heights[u]) { u += 1; continue }
      const label = labels[v * width + u]
      const start = u
      while (u < width && heights[u] && labels[v * width + u] === label) u += 1
      // largest rectangles in histogram heights[start..u)
      const st = []
      for (let k = start; k <= u; k += 1) {
        const h = k < u ? heights[k] : 0
        let left = k
        while (st.length && st[st.length - 1].h >= h) {
          const bar = st.pop()
          const w = k - bar.left
          const short = Math.min(w, bar.h)
          const long = Math.max(w, bar.h)
          if (short >= minShort && long >= minLong) {
            const area = w * bar.h
            const current = best.get(label)
            if (!current || area > current.area) best.set(label, { area, u0: bar.left, u1: k - 1, v0: v - bar.h + 1, v1: v })
          }
          left = bar.left
        }
        st.push({ h, left })
      }
    }
  }
  return [...best.entries()].map(([label, rect]) => ({ ...rect, regionArea: areas[label] }))
}

function findFlatSurfaces(model, info, isExterior) {
  const { grid, occ } = model
  const planes = new Map()
  const add = (key, u, v, s) => {
    let plane = planes.get(key)
    if (!plane) {
      plane = { us: [], vs: [], ss: [] }
      planes.set(key, plane)
    }
    plane.us.push(u)
    plane.vs.push(v)
    plane.ss.push(s)
  }
  // Column tops for roofs.
  const top = new Int32Array(grid.w * grid.d).fill(-1)
  for (let k = 0; k < occ.length; k += 1) {
    const i = occ[k]
    const col = i % grid.layer
    const y = Math.floor(i / grid.layer)
    if (y > top[col]) top[col] = y
  }
  for (let k = 0; k < occ.length; k += 1) {
    const i = occ[k]
    const s = grid.get(i)
    if (!info[s].fullCube) continue
    const [x, y, z] = grid.pos(i)
    for (let dir = 0; dir < 4; dir += 1) {
      const n = i + grid.off[dir]
      if (grid.get(n) >= 0 || !isExterior(n, dir)) continue
      if (dir === 1 || dir === 3) add(`${dir}|${x}`, z, y, s)
      else add(`${dir}|${z}`, x, y, s)
    }
    const up = i + grid.off[UP]
    if (grid.get(up) < 0 && top[i % grid.layer] === Math.floor(i / grid.layer)) add(`up|${y}`, x, z, s)
  }

  const walls = []
  const roofs = []
  for (const [key, plane] of planes) {
    const isRoof = key.startsWith('up|')
    const minShort = isRoof ? 7 : 5
    const minLong = isRoof ? 7 : 6
    if (plane.us.length < minShort * minLong) continue
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity
    for (let k = 0; k < plane.us.length; k += 1) {
      u0 = Math.min(u0, plane.us[k]); u1 = Math.max(u1, plane.us[k])
      v0 = Math.min(v0, plane.vs[k]); v1 = Math.max(v1, plane.vs[k])
    }
    const width = u1 - u0 + 1
    const height = v1 - v0 + 1
    const cells = new Int32Array(width * height).fill(-1)
    for (let k = 0; k < plane.us.length; k += 1) cells[(plane.vs[k] - v0) * width + (plane.us[k] - u0)] = plane.ss[k]
    const [dirKey, coordText] = key.split('|')
    const coord = Number(coordText)
    for (const rect of largestRects(width, height, cells, minShort, minLong)) {
      const s = cells[rect.v0 * width + rect.u0]
      const a = [rect.u0 + u0, rect.u1 + u0]
      const b = [rect.v0 + v0, rect.v1 + v0]
      if (isRoof) {
        roofs.push({ state: info[s].key, y: coord, x: a, z: b, width: a[1] - a[0] + 1, depth: b[1] - b[0] + 1, area: rect.area, regionArea: rect.regionArea })
      } else {
        const dir = Number(dirKey)
        const axis = dir === 1 || dir === 3 ? 'x' : 'z'
        walls.push({
          state: info[s].key,
          facing: [DIR_NAMES[dir]],
          plane: { [axis]: coord },
          [axis === 'x' ? 'z' : 'x']: a,
          y: b,
          width: a[1] - a[0] + 1,
          height: b[1] - b[0] + 1,
          area: rect.area,
          regionArea: rect.regionArea,
        })
      }
    }
  }
  // A one-block-thick freestanding wall shows the same rectangle on both faces: merge those.
  const merged = new Map()
  for (const wall of walls) {
    const key = `${JSON.stringify(wall.plane)}|${wall.state}|${wall.x ?? ''}|${wall.z ?? ''}|${wall.y}`
    const existing = merged.get(key)
    if (existing) existing.facing.push(...wall.facing)
    else merged.set(key, wall)
  }
  return {
    walls: [...merged.values()].sort((p, q) => q.area - p.area),
    roofs: roofs.sort((p, q) => q.area - p.area),
  }
}

function expectedStairShape(grid, info, i, s) {
  const f = info[s].facing
  const h = info[s].half
  const stairAt = dir => {
    const n = grid.get(i + grid.off[dir])
    return n >= 0 && info[n].stairs ? n : -1
  }
  const canTakeShape = dir => {
    const n = stairAt(dir)
    return n < 0 || info[n].facing !== f || info[n].half !== h
  }
  const front = stairAt(f)
  if (front >= 0 && info[front].half === h) {
    const ff = info[front].facing
    if ((ff & 1) !== (f & 1) && canTakeShape(opposite(ff))) return ff === ccw(f) ? 'outer_left' : 'outer_right'
  }
  const back = stairAt(opposite(f))
  if (back >= 0 && info[back].half === h) {
    const bf = info[back].facing
    if ((bf & 1) !== (f & 1) && canTakeShape(bf)) return bf === ccw(f) ? 'inner_left' : 'inner_right'
  }
  return 'straight'
}

// Whether block n has a full (sturdy) face on side `face`.
function hasSturdyFace(other, face) {
  if (other.sturdy) return true
  if (other.stairs) {
    // straight and inner stairs have a full back; inner shapes also a full side
    const f = other.facing
    if (other.shape.startsWith('outer')) return false
    if (face === f) return true
    if (other.shape === 'inner_left') return face === ccw(f)
    if (other.shape === 'inner_right') return face === (f + 1) % 4
    return false
  }
  // an open trapdoor facing F is a panel against the side opposite F
  if (other.cat === 'trapdoor' && other.props.open === 'true') return face === opposite(other.facing)
  return false
}

// Whether the block at i (wall/fence/pane) would connect toward dir, using vanilla rules.
function connectsToward(grid, info, i, s, dir) {
  const n = grid.get(i + grid.off[dir])
  if (n < 0) return false
  const self = info[s]
  const other = info[n]
  const gate = other.isGate && (other.facing & 1) !== (dir & 1)
  const sturdy = hasSturdyFace(other, opposite(dir))
  if (self.isWall) return other.isWall || other.isPane || gate || sturdy
  if (self.isPane) return other.isPane || other.isWall || sturdy
  if (self.isFence) return (other.isFence && other.woodenFence === self.woodenFence) || gate || sturdy
  return false
}

function runChecks(model, info, counts, summary, lighting, options) {
  const { grid, occ } = model
  const maxExamples = options.examples
  const checks = []
  const fmtPos = i => `(${grid.pos(i).join(',')})`
  const shortKey = s => info[s].key.replace(/^minecraft:/, '')
  const collector = () => {
    const list = { count: 0, examples: [] }
    list.add = (i, note) => {
      list.count += 1
      if (list.examples.length < maxExamples) list.examples.push({ pos: grid.pos(i), text: note })
    }
    return list
  }
  const total = occ.length
  // Positions outside the file's size box are unknown. Below y=0 is assumed to be the ground the
  // structure is placed on; sideways/above outside the file is assumed to be whatever supports it.
  const size = model.size
  const outsideFile = i => {
    const [x, y, z] = grid.pos(i)
    return x < 0 || y < 0 || z < 0 || x >= size[0] || y >= size[1] || z >= size[2]
  }
  const onGround = i => grid.pos(i)[1] === 0

  // Unknown ids and property values (against Lodestone's bundled default pack).
  {
    const unknown = []
    const badProps = []
    info.forEach((s, index) => {
      if (!counts[index]) return
      if (s.known === false) unknown.push({ id: s.name, count: counts[index] })
      const official = s.name.startsWith('minecraft:') ? officialValues(s.short) : null
      for (const [k, v] of Object.entries(s.props)) {
        const allowed = official ? official.get(k) : s.packValues.get(k)
        if (allowed && !allowed.has(v)) badProps.push({ state: s.key, prop: `${k}=${v}`, allowed: [...allowed].join('|'), count: counts[index] })
      }
    })
    const ids = new Map()
    for (const u of unknown) ids.set(u.id, (ids.get(u.id) ?? 0) + u.count)
    checks.push(unknown.length
      ? { id: 'unknown-blocks', level: 'warn', count: [...ids.values()].reduce((a, b) => a + b, 0), message: `${ids.size} block id(s) are not in Lodestone's default pack (typo, modded, or newer than the preview)`, examples: [...ids.entries()].slice(0, maxExamples).map(([id, count]) => `${id} x${count}`), hint: 'check spelling against references/lodestone/default-pack-block-states.md; unknown blocks render as nothing in the preview' }
      : { id: 'unknown-blocks', level: 'ok', message: 'all block ids exist in the default pack' })
    checks.push(badProps.length
      ? { id: 'property-values', level: 'warn', count: badProps.reduce((a, b) => a + b.count, 0), message: `${badProps.length} state(s) use property values the renderer does not know`, examples: badProps.slice(0, maxExamples).map(b => `${b.state.replace(/^minecraft:/, '')}: ${b.prop} (expected ${b.allowed}) x${b.count}`), hint: 'use the listed values (e.g. walls take none|low|tall, fences true|false)' }
      : { id: 'property-values', level: 'ok', message: 'all rendered property values are valid' })
  }

  // Connectivity (26-neighborhood, i.e. touching by a face, edge or corner counts): isolated
  // blocks, small detached fragments, and blocks that touch the rest only diagonally.
  {
    const floating = collector()
    const diagonal = collector()
    const fragments = []
    let components = 0
    let largest = 0
    const around = []
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) if (dx || dy || dz) around.push(dx + dz * grid.w + dy * grid.layer)
      }
    }
    const visited = grid.dense ? new Uint8Array(grid.vol) : new Set()
    const seen = grid.dense ? i => visited[i] === 1 : i => visited.has(i)
    const mark = grid.dense ? i => { visited[i] = 1 } : i => { visited.add(i) }
    const exempt = s => info[s].emit > 0 || CHAINS.has(info[s].short) || ['end_rod', 'light', 'barrier', 'lightning_rod'].includes(info[s].short)
    const stack = []
    for (let k = 0; k < occ.length; k += 1) {
      const start = occ[k]
      if (seen(start)) continue
      components += 1
      mark(start)
      stack.push(start)
      const members = [] // first few cells only; size counts all
      let size = 0
      let grounded = false
      while (stack.length) {
        const i = stack.pop()
        size += 1
        if (members.length < 8) members.push(i)
        if (!grounded && onGround(i)) grounded = true
        for (let a = 0; a < 26; a += 1) {
          const n = i + around[a]
          if (grid.get(n) >= 0 && !seen(n)) {
            mark(n)
            stack.push(n)
          }
        }
      }
      if (size > largest) largest = size
      if (grounded) continue
      if (size === 1) {
        const s = grid.get(start)
        if (!exempt(s)) floating.add(start, shortKey(s))
      } else if (size <= 8) {
        fragments.push({ pos: grid.pos(members[0]), size, text: [...new Set(members.map(i => info[grid.get(i)].short))].join('+') })
      }
    }
    for (let k = 0; k < occ.length; k += 1) {
      const i = occ[k]
      const s = grid.get(i)
      if (onGround(i) || exempt(s) || info[s].cat === 'plant') continue
      let faces = 0
      for (let dir = 0; dir < 6; dir += 1) if (grid.get(i + grid.off[dir]) >= 0) faces += 1
      if (faces) continue
      let touching = 0
      for (let a = 0; a < 26; a += 1) if (grid.get(i + around[a]) >= 0) touching += 1
      if (touching) diagonal.add(i, shortKey(s))
    }
    checks.push(floating.count
      ? { id: 'floating-blocks', level: 'warn', count: floating.count, message: `${floating.count} isolated block(s) touching nothing, not even diagonally (y=0 counts as resting on the ground)`, examples: floating.examples.map(e => `(${e.pos.join(',')}) ${e.text}`), hint: 'delete stray blocks or connect them; use lights/end rods/chains for intentional floating accents' }
      : { id: 'floating-blocks', level: 'ok', message: 'no isolated single blocks' })
    checks.push(fragments.length
      ? { id: 'detached-fragments', level: 'info', count: fragments.length, message: `${components} separate part(s) (largest ${largest} blocks = ${pct(largest, total)}%); ${fragments.length} small detached fragment(s) of 2-8 blocks off the ground layer`, examples: fragments.slice(0, maxExamples).map(f => `(${f.pos.join(',')}) ${f.size} blocks: ${f.text}`), hint: 'small pieces floating apart from the main build are usually off-by-one placement mistakes' }
      : { id: 'detached-fragments', level: 'ok', message: `${components} separate part(s); largest has ${largest} blocks (${pct(largest, total)}%)` })
    if (diagonal.count) {
      checks.push({ id: 'diagonal-only', level: 'info', count: diagonal.count, message: `${diagonal.count} block(s) touch the build only at edges/corners (no shared face)`, examples: diagonal.examples.map(e => `(${e.pos.join(',')}) ${e.text}`), hint: 'normal for curves and checker patterns; thicken 1-block diagonal lines if they look like dotted outlines' })
    }
  }

  // Gravity blocks over air.
  {
    const falling = collector()
    for (let k = 0; k < occ.length; k += 1) {
      const i = occ[k]
      const s = grid.get(i)
      if (!info[s].gravity) continue
      if (onGround(i)) continue
      const below = grid.get(i + grid.off[DOWN])
      if (below < 0 || info[below].cat === 'fluid' || info[below].cat === 'plant') falling.add(i, shortKey(s))
    }
    checks.push(falling.count
      ? { id: 'gravity-blocks', level: 'warn', count: falling.count, message: `${falling.count} sand/gravel/concrete powder/anvil block(s) have nothing solid below and will fall in game`, examples: falling.examples.map(e => `(${e.pos.join(',')}) ${e.text}`), hint: 'support them, or swap for a non-falling look-alike (sandstone, smooth sandstone, concrete, tuff, packed mud)' }
      : { id: 'gravity-blocks', level: 'ok', message: 'no unsupported gravity blocks' })
  }

  // Flat monotone walls and flat roofs.
  {
    const isExterior = exteriorAir(model)
    const { walls, roofs } = findFlatSurfaces(model, info, isExterior)
    const wallText = w => {
      const plane = Object.entries(w.plane).map(([k, v]) => `${k}=${v}`)[0]
      const span = w.x ? `x ${w.x[0]}..${w.x[1]}` : `z ${w.z[0]}..${w.z[1]}`
      return `${w.state.replace(/^minecraft:/, '')} facing ${w.facing.join('+')} at ${plane}, y ${w.y[0]}..${w.y[1]}, ${span} (${w.width}x${w.height}; ${w.regionArea} flat faces)`
    }
    checks.push(walls.length
      ? { id: 'flat-walls', level: 'warn', count: walls.length, message: `${walls.length} large flat single-block wall plane(s) (>= 6x5, nothing in front)`, examples: walls.slice(0, maxExamples).map(wallText), hint: 'add depth: pillars/buttresses every 3-5 blocks, recessed windows, stair/slab/trapdoor ledges, or mix 2-3 textures of the same material' }
      : { id: 'flat-walls', level: 'ok', message: 'no large flat monotone wall planes' })
    checks.push(roofs.length
      ? { id: 'flat-roofs', level: 'info', count: roofs.length, message: `${roofs.length} large flat single-block top surface(s) open to the sky (>= 7x7)`, examples: roofs.slice(0, maxExamples).map(r => `${r.state.replace(/^minecraft:/, '')} at y=${r.y}, x ${r.x[0]}..${r.x[1]}, z ${r.z[0]}..${r.z[1]} (${r.width}x${r.depth})`), hint: 'fine for plazas/floors; for roofs add pitch (stairs), parapets (walls/slabs), skylights or texture variation' }
      : { id: 'flat-roofs', level: 'ok', message: 'no large flat open top surfaces' })
  }

  // Leaves.
  {
    const leaves = collector()
    let allLeaves = 0
    for (let k = 0; k < occ.length; k += 1) {
      const i = occ[k]
      const s = grid.get(i)
      if (!info[s].isLeaves) continue
      allLeaves += 1
      if (info[s].props.persistent !== 'true') leaves.add(i, shortKey(s))
    }
    checks.push(leaves.count
      ? { id: 'leaves-persistent', level: 'warn', count: leaves.count, message: `${leaves.count} of ${allLeaves} leaves lack persistent=true and can decay in game`, examples: leaves.examples.map(e => `(${e.pos.join(',')}) ${e.text}`), hint: 'add persistent=true to leaf states (e.g. minecraft:oak_leaves[persistent=true])' }
      : { id: 'leaves-persistent', level: 'ok', message: allLeaves ? `all ${allLeaves} leaves are persistent` : 'no leaves' })
  }

  // Stair shapes (vanilla StairBlock.getStairsShape).
  {
    const wrong = collector()
    const pairs = new Map()
    let stairs = 0
    let uncertain = 0
    const size = model.size
    const unknownNeighbor = i => [0, 1, 2, 3].some(dir => {
      const n = i + grid.off[dir]
      const [x, y, z] = grid.pos(n)
      return x < 0 || z < 0 || x >= size[0] || z >= size[2] || y < 0 || y >= size[1] || model.fromJigsaw.has(n)
    })
    for (let k = 0; k < occ.length; k += 1) {
      const i = occ[k]
      const s = grid.get(i)
      if (!info[s].stairs) continue
      stairs += 1
      const expected = expectedStairShape(grid, info, i, s)
      if (expected !== info[s].shape) {
        const pair = `${info[s].shape} -> ${expected}`
        pairs.set(pair, (pairs.get(pair) ?? 0) + 1)
        const edge = unknownNeighbor(i)
        if (edge) uncertain += 1
        wrong.add(i, `${info[s].short} facing=${info[s].props.facing ?? 'north'} half=${info[s].props.half ?? 'bottom'}: shape=${info[s].shape} -> ${expected}${edge ? ' (neighbor outside the file or a jigsaw)' : ''}`)
      }
    }
    const summaryText = [...pairs.entries()].sort((a, b) => b[1] - a[1]).map(([p, c]) => `${p} x${c}`).join(', ')
    checks.push(wrong.count
      ? { id: 'stair-shapes', level: 'warn', count: wrong.count, uncertain, message: `${wrong.count} of ${stairs} stairs have a shape vanilla neighbor logic would change (${summaryText})${uncertain ? `; ${uncertain} of them border the file edge or a jigsaw, so the real neighbor is unknown` : ''}`, examples: wrong.examples.map(e => `(${e.pos.join(',')}) ${e.text}`), hint: 'set shape to the expected value (the preview and jigsaw pieces use stored shapes); usually caused by hand-set shapes, --no-block-state-updates, or editing after the block-state pass' }
      : { id: 'stair-shapes', level: 'ok', message: stairs ? `all ${stairs} stair shapes match vanilla neighbor logic` : 'no stairs' })
  }

  // Walls, fences, panes.
  {
    const invisible = collector()
    const missing = collector()
    const wallMismatch = collector()
    const fencePaneMismatch = collector()
    let wallCount = 0
    let fencePaneCount = 0
    for (let k = 0; k < occ.length; k += 1) {
      const i = occ[k]
      const s = grid.get(i)
      const b = info[s]
      if (!b.isWall && !b.isFence && !b.isPane) continue
      const p = b.props
      const expected = [0, 1, 2, 3].map(dir => connectsToward(grid, info, i, s, dir))
      const actual = ['north', 'east', 'south', 'west'].map(k2 => p[k2] !== undefined && p[k2] !== 'false' && p[k2] !== 'none')
      const diff = [0, 1, 2, 3].filter(dir => expected[dir] !== actual[dir])
      const note = diff.map(dir => `${DIR_NAMES[dir]}=${b.isWall ? (expected[dir] ? 'low/tall' : 'none') : String(expected[dir])}`).join(',')
      if (b.isWall) {
        wallCount += 1
        if (p.up === 'false' && actual.every(v => !v)) invisible.add(i, `${b.short}: up=false and no sides (renders nothing)`)
        if (p.up === undefined || p.north === undefined) missing.add(i, `${b.short}: missing properties${diff.length ? `; set ${note}` : ''}`)
        else if (diff.length) wallMismatch.add(i, `${b.short}: set ${note}`)
      } else {
        fencePaneCount += 1
        if (diff.length) fencePaneMismatch.add(i, `${b.short}: set ${note}`)
      }
    }
    const ex = list => list.examples.map(e => `(${e.pos.join(',')}) ${e.text}`)
    if (!wallCount) {
      checks.push({ id: 'wall-states', level: 'ok', message: 'no walls' })
    } else {
      const parts = []
      if (invisible.count) parts.push(`${invisible.count} invisible (up=false, no sides)`)
      if (missing.count) parts.push(`${missing.count} without up/side properties (render as lone posts)`)
      if (wallMismatch.count) parts.push(`${wallMismatch.count} with side connections that disagree with their neighbors`)
      checks.push(parts.length
        ? { id: 'wall-states', level: 'warn', count: invisible.count + missing.count + wallMismatch.count, message: `${wallCount} walls: ${parts.join('; ')}`, examples: [...ex(invisible), ...ex(missing), ...ex(wallMismatch)].slice(0, maxExamples), hint: 'set north/east/south/west=low (tall when a block sits above) toward walls, panes and solid blocks, none elsewhere; up=true on ends, corners, junctions and lone posts (run-build derives these unless --no-block-state-updates)' }
        : { id: 'wall-states', level: 'ok', message: `all ${wallCount} walls are connected consistently` })
    }
    checks.push(fencePaneMismatch.count
      ? { id: 'fence-pane-connections', level: 'warn', count: fencePaneMismatch.count, message: `${fencePaneMismatch.count} of ${fencePaneCount} fences/panes/bars have connections that disagree with their neighbors`, examples: ex(fencePaneMismatch), hint: 'set north/east/south/west=true toward fences (same family), gates, panes/walls (for panes) and solid blocks; or rebuild without --no-block-state-updates' }
      : { id: 'fence-pane-connections', level: 'ok', message: fencePaneCount ? `all ${fencePaneCount} fences/panes/bars connect consistently` : 'no fences or panes' })
  }

  // Two-block structures: doors, beds, tall plants.
  {
    const broken = collector()
    let total2 = 0
    for (let k = 0; k < occ.length; k += 1) {
      const i = occ[k]
      const s = grid.get(i)
      const b = info[s]
      const p = b.props
      const isDoor = b.cat === 'door'
      const isDouble = !isDoor && (p.half === 'lower' || p.half === 'upper' || DOUBLE_PLANTS.has(b.short))
      if (isDoor || isDouble) {
        total2 += 1
        const half = p.half ?? 'lower'
        const otherIndex = i + grid.off[half === 'lower' ? UP : DOWN]
        const o = grid.get(otherIndex)
        const want = half === 'lower' ? 'upper' : 'lower'
        if (o < 0 || info[o].name !== b.name || (info[o].props.half ?? 'lower') !== want) {
          broken.add(i, `${b.short} half=${half}: missing ${want} half ${half === 'lower' ? 'above' : 'below'}`)
        } else if (isDoor && half === 'lower' && ['facing', 'hinge', 'open'].some(key => (p[key] ?? '') !== (info[o].props[key] ?? ''))) {
          broken.add(i, `${b.short}: lower/upper halves disagree on facing/hinge/open`)
        }
      } else if (b.short.endsWith('_bed')) {
        total2 += 1
        const part = p.part ?? 'foot'
        const f = DIR[p.facing] ?? 0
        const o = grid.get(i + grid.off[part === 'foot' ? f : opposite(f)])
        const want = part === 'foot' ? 'head' : 'foot'
        if (o < 0 || info[o].name !== b.name || (info[o].props.part ?? 'foot') !== want || (info[o].props.facing ?? 'north') !== (p.facing ?? 'north')) {
          broken.add(i, `${b.short} part=${part} facing=${p.facing ?? 'north'}: missing ${want} ${part === 'foot' ? 'in the facing direction' : 'behind it'}`)
        }
      }
    }
    checks.push(broken.count
      ? { id: 'two-part-blocks', level: 'warn', count: broken.count, message: `${broken.count} door/bed/tall-plant half(s) are missing or mismatched`, examples: broken.examples.map(e => `(${e.pos.join(',')}) ${e.text}`), hint: 'doors and tall plants need half=lower + half=upper stacked; beds need part=foot and part=head (head = foot + facing direction), same facing' }
      : { id: 'two-part-blocks', level: 'ok', message: total2 ? `all ${total2} door/bed/tall-plant halves are paired` : 'no doors, beds or tall plants' })
  }

  // Support / attachment.
  {
    const unsupported = collector()
    const byName = new Map()
    const soil = collector()
    let attached = 0
    for (let k = 0; k < occ.length; k += 1) {
      const i = occ[k]
      const s = grid.get(i)
      const b = info[s]
      const rule = b.support
      if (rule === -1 || rule === null) continue
      attached += 1
      let ok
      let where
      if (rule === 'sides') {
        const sides = ['north', 'east', 'south', 'west', 'up', 'down'].map((key, dir) => [key, dir]).filter(([key]) => b.props[key] === 'true')
        ok = sides.length === 0 || sides.some(([, dir]) => grid.get(i + grid.off[dir]) >= 0 || outsideFile(i + grid.off[dir]))
        // a vine also holds on by hanging from the vine above it (vanilla canSupportAtFace)
        if (!ok && b.short === 'vine') {
          const above = grid.get(i + grid.off[4])
          ok = above >= 0 && info[above].short === 'vine'
        }
        where = 'on any attached face'
      } else if (rule === 'bell2') {
        const f = b.facing
        ok = [f, opposite(f)].some(dir => grid.get(i + grid.off[dir]) >= 0 || outsideFile(i + grid.off[dir]))
        where = 'on either side'
      } else {
        ok = grid.get(i + grid.off[rule]) >= 0 || outsideFile(i + grid.off[rule])
        where = rule === UP ? 'above' : rule === DOWN ? 'below' : `to the ${DIR_NAMES[rule]}`
      }
      if (!ok) {
        const label = b.short + (isLanternLike(b.short) ? ` hanging=${b.props.hanging ?? 'false'}` : b.props.facing && rule !== UP && rule !== DOWN ? ` facing=${b.props.facing}` : '')
        unsupported.add(i, `${label}: nothing ${where}`)
        byName.set(b.short, (byName.get(b.short) ?? 0) + 1)
      } else if (b.soil && rule === DOWN) {
        const below = grid.get(i + grid.off[DOWN])
        if (below >= 0 && !b.soil.ok(info[below].short)) soil.add(i, `${b.short} on ${info[below].short} (needs ${b.soil.label})`)
      }
    }
    const names = [...byName.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} x${c}`).join(', ')
    checks.push(unsupported.count
      ? { id: 'support', level: 'warn', count: unsupported.count, message: `${unsupported.count} attached block(s) have no supporting block (${names})`, examples: unsupported.examples.map(e => `(${e.pos.join(',')}) ${e.text}`), hint: 'wall_torch/wall_sign/ladder/wall banner facing=F attach to the block on the opposite side of F; lanterns hanging=true need a block above, hanging=false a block below; torches/carpets/rails/plants need a block below' }
      : { id: 'support', level: 'ok', message: attached ? `all ${attached} attached blocks (torches, lanterns, signs, plants...) have support` : 'no support-dependent blocks' })
    checks.push(soil.count
      ? { id: 'plant-soil', level: 'warn', count: soil.count, message: `${soil.count} plant(s) stand on a block they cannot grow on and will pop off on the next block update`, examples: soil.examples.map(e => `(${e.pos.join(',')}) ${e.text}`), hint: 'put flowers/saplings/grass on dirt-family blocks, crops on farmland; use potted_* or flower_pot for decor on other blocks' }
      : { id: 'plant-soil', level: 'ok', message: 'plants stand on valid soil' })
  }

  // Fluids.
  {
    let sources = 0
    let flowing = 0
    let waterlogged = 0
    const spill = collector()
    for (let k = 0; k < occ.length; k += 1) {
      const i = occ[k]
      const s = grid.get(i)
      const b = info[s]
      if (b.props.waterlogged === 'true') waterlogged += 1
      if (b.short !== 'water' && b.short !== 'lava') continue
      if ((b.props.level ?? '0') === '0') sources += 1
      else flowing += 1
      const open = [0, 1, 2, 3, DOWN].filter(dir => grid.get(i + grid.off[dir]) < 0 && !(dir === DOWN && onGround(i)))
      if (open.length) spill.add(i, `${b.short} flows ${open.map(dir => DIR_NAMES[dir]).join('/')}`)
    }
    const desc = `${sources} source(s), ${flowing} flowing, ${waterlogged} waterlogged block(s)`
    if (!sources && !flowing) {
      checks.push({ id: 'fluids', level: 'ok', message: waterlogged ? `no fluid blocks; ${waterlogged} waterlogged block(s)` : 'no fluids' })
    } else {
      checks.push(spill.count
        ? { id: 'fluids', level: 'warn', count: spill.count, message: `${desc}; ${spill.count} fluid block(s) touch air at the side or below and will flow in game`, examples: spill.examples.map(e => `(${e.pos.join(',')}) ${e.text}`), hint: 'contain fluids with blocks on every side and below (or accept the spill); flowing levels (level>0) dry up without a source' }
        : { id: 'fluids', level: flowing ? 'info' : 'ok', message: `${desc}; all fluids are contained` })
    }
  }

  // Palette and detail.
  {
    const ids = summary.blockIds
    const topRow = summary.palette[0]
    if (total > 500 && ids < 4) checks.push({ id: 'palette-size', level: 'warn', message: `monotone palette: only ${ids} block id(s) for ${total} blocks`, hint: 'use 4-10 related blocks: a main material, a trim, an accent, a roof, plus partial-block variants' })
    // Human showcase builds use 45-106 ids (benchmarks.md); only far beyond that is noise likely.
    else if (ids > 130) checks.push({ id: 'palette-size', level: 'warn', message: `very broad palette: ${ids} distinct block ids`, hint: 'check the ids group into a few material families with clear roles; random variety reads as noise (see --score for the style band)' })
    else checks.push({ id: 'palette-size', level: 'ok', message: `${ids} distinct block ids` })
    if (topRow && total > 100 && topRow.count / total > 0.7) {
      checks.push({ id: 'dominant-block', level: 'warn', message: `${topRow.id} is ${topRow.percent}% of all blocks`, hint: 'break it up with a secondary texture (cracked/mossy variants, a trim course, a different floor)' })
    } else if (topRow) {
      checks.push({ id: 'dominant-block', level: 'ok', message: `most common block ${topRow.id} is ${topRow.percent}%` })
    }
    const ratio = summary.detailRatio
    if (total > 500 && ratio < 0.08) checks.push({ id: 'detail-ratio', level: 'warn', message: `detail ratio ${ratio}: almost everything is full cubes (boxy)`, hint: 'add stairs/slabs for roofs and ledges, walls/fences for railings, trapdoors for shutters, lanterns and plants' })
    else checks.push({ id: 'detail-ratio', level: 'ok', message: `detail ratio ${ratio} (partial blocks / all solid blocks)` })
  }

  // Lighting.
  {
    const w = lighting.walkable.covered
    const d = lighting.dark.covered
    if (w >= 10 && d / w > 0.1) {
      checks.push({ id: 'lighting', level: 'warn', count: d, message: `${d} of ${w} roofed walkable spots (${pct(d, w)}%) have block light 0 (approximate) -> hostile mobs can spawn there`, examples: lighting.darkPockets.slice(0, maxExamples).map(p => `${p.count} dark spots around x ${p.min[0]}..${p.max[0]}, y ${p.min[1]}..${p.max[1]}, z ${p.min[2]}..${p.max[2]}`), hint: 'add lanterns/torches/glowstone so each floor area is within ~6 blocks of a light (torch 14, lantern 15)' })
    } else {
      checks.push({ id: 'lighting', level: 'ok', message: w ? `${pct(d, w)}% of ${w} roofed walkable spots are dark (approximate)` : 'no roofed walkable spots' })
    }
    if (lighting.unlit.length) {
      checks.push({ id: 'unlit-lights', level: 'info', count: lighting.unlit.reduce((a, b) => a + b.count, 0), message: 'light blocks that emit nothing in their current state', examples: lighting.unlit.map(u => `${u.id} x${u.count}`), hint: 'candles/redstone lamps/copper bulbs need lit=true; sea pickles only glow when waterlogged' })
    }
  }

  return checks
}

// ---------------------------------------------------------------------------------------------
// Scorecard: quality metrics with target bands (calibrated on human builds; see references/inspect.md).

const TERRAIN = new Set([
  'grass_block', 'dirt', 'coarse_dirt', 'podzol', 'rooted_dirt', 'mycelium', 'mud', 'sand', 'red_sand', 'gravel',
  'clay', 'dirt_path', 'farmland', 'moss_block', 'pale_moss_block', 'snow', 'powder_snow', 'suspicious_sand',
  'suspicious_gravel',
])

async function loadColors() {
  try {
    const file = fileURLToPath(new URL('./lib/data/block-colors.json', import.meta.url))
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return null
  }
}

// CIE L* (D65) of an sRGB hex colour.
function hexLightness(hex) {
  const n = Number.parseInt(String(hex).replace('#', ''), 16)
  if (!Number.isFinite(n)) return Number.NaN
  const lin = c => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const y = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y
}

// Target bands. kind: 'range' (lo..hi), 'min' (>= lo), 'max' (<= hi). soft = distance outside the
// band at which the metric's score reaches 0. Values come from the calibration in references/inspect.md.
const SCORE_BANDS = {
  roofWallContrast: { label: 'roof vs wall contrast', kind: 'min', lo: 15, soft: 15, unit: ' L*', hintLow: 'roof reads like the walls: use a roof >= 20 L* darker (or lighter) and a different material' },
  trimContrast: { label: 'trim vs wall-field contrast', kind: 'min', lo: 15, soft: 15, unit: ' L*', hintLow: 'frame/trim blends into the wall field: pick posts/trim >= 30 L* from the infill' },
  speckle: { label: 'speckle (isolated wall blocks)', kind: 'max', hi: 12, soft: 15, unit: '%', hintHigh: 'salt-and-pepper texture: mix in clusters 2-6 blocks across, not per-block random' },
  splatter: { label: 'splatter (> 2 value steps)', kind: 'max', hi: 8, soft: 10, unit: '%', hintHigh: 'neighbouring wall blocks jump > 2 value steps: only let adjacent ramp steps touch' },
  stripes: { label: 'stripes (repeated 1-high bands)', kind: 'max', hi: 3, soft: 10, unit: '%', hintHigh: 'horizontal stripes: replace repeated 1-block bands with ragged gradient bands 2-4 tall' },
  relief: { label: 'facade relief (depth within 3)', kind: 'min', lo: 90, soft: 30, unit: '%', hintLow: 'flat facades: add posts/pilasters every 3-5, recessed windows, sills, beams, buttresses' },
  flatRun: { label: 'wall faces in flat runs > 8', kind: 'max', hi: 25, soft: 25, unit: '%', hintHigh: 'long flat wall runs: break planes wider than ~5-8 blocks with a 1-block offset, post or pilaster' },
  roofOverhang: { label: 'roof edges that overhang', kind: 'min', lo: 40, soft: 40, unit: '%', hintLow: 'roof looks stuck on: extend eaves 1 block (2 on big roofs) past the walls' },
  darkSpots: { label: 'dark roofed floor spots', kind: 'max', hi: 25, soft: 40, unit: '%', hintHigh: 'dark interiors: a lantern every 8-12 blocks, a light at every door (approximate estimate)' },
  grounded: { label: 'blocks connected to the base', kind: 'min', lo: 97, soft: 15, unit: '%', hintLow: 'parts float apart from the base: connect or support them (unless a floating build)' },
  baseGaps: { label: 'base columns over air', kind: 'max', hi: 10, soft: 20, unit: '%', hintHigh: 'walls/corners hover over air at the base: extend foundations down to the ground' },
}

function bandText(band) {
  const u = band.unit === '%' ? '%' : band.unit
  if (band.kind === 'min') return `>= ${band.lo}${u}`
  if (band.kind === 'max') return `<= ${band.hi}${u}`
  return `${band.lo}-${band.hi}${u}`
}

function scoreMetric(id, value, extra = {}) {
  const band = SCORE_BANDS[id]
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { id, label: band.label, value: null, band: bandText(band), status: 'n/a', score: null, ...extra }
  }
  let status = 'ok'
  let dist = 0
  if ((band.kind === 'range' || band.kind === 'min') && value < band.lo) { status = 'low'; dist = band.lo - value }
  if ((band.kind === 'range' || band.kind === 'max') && value > band.hi) { status = 'high'; dist = value - band.hi }
  const score = status === 'ok' ? 1 : Math.max(0, 1 - dist / band.soft)
  const hint = status === 'low' ? band.hintLow : status === 'high' ? band.hintHigh : undefined
  return { id, label: band.label, value, band: bandText(band), status, score: round(score, 2), ...(hint ? { hint } : {}), ...extra }
}

function computeScore(model, info, lighting, colors) {
  const { grid, occ } = model
  const total = occ.length
  const isExterior = exteriorAir(model)
  const n = info.length
  const sideL = new Float64Array(n).fill(Number.NaN)
  const topL = new Float64Array(n).fill(Number.NaN)
  const terrain = new Uint8Array(n)
  const wallish = new Uint8Array(n) // full, opaque, architectural cubes (not terrain/foliage)
  info.forEach((s, k) => {
    const c = colors?.[s.name]
    if (c) {
      sideL[k] = Array.isArray(c.lab) ? c.lab[0] : hexLightness(c.side)
      topL[k] = c.top ? hexLightness(c.top) : sideL[k]
    }
    // ground and raw rock (cliffs, diorama cut faces) are terrain, not building walls
    terrain[k] = TERRAIN.has(s.short) || NORM_TERRAIN.has(s.short) ? 1 : 0
    const glassy = NON_OPAQUE_FULL.test(s.short)
    wallish[k] = s.fullCube && !glassy && !terrain[k] && s.emit < 10 ? 1 : 0
  })

  const off = grid.off
  const layer = grid.layer
  // in-plane axes for a face looking in horizontal direction d: u is the horizontal axis along it
  const uDir = d => (d === 0 || d === 2 ? 1 : 2) // north/south faces run east-west; east/west faces run north-south
  const exposedWall = (i, d) => {
    const s = grid.get(i)
    if (s < 0 || !wallish[s]) return false
    const f = i + off[d]
    return grid.get(f) < 0 && isExterior(f, d)
  }
  // part of a vertical surface at least 2 tall (drops the 1-high risers of stepped roofs)
  const wallFace = (i, d) => exposedWall(i, d) && (exposedWall(i + layer, d) || exposedWall(i - layer, d))

  const wallById = new Map()
  let wallFaces = 0
  let relieved = 0
  let longestRun = 0
  let longRunFaces = 0
  let speckle = 0
  let speckleBase = 0
  let splatter = 0
  const bandCells = new Map()
  const faceList = [] // [i, d] for the second pass (splatter needs value steps)

  for (let k = 0; k < occ.length; k += 1) {
    const i = occ[k]
    const s = grid.get(i)
    if (!wallish[s]) continue
    for (let d = 0; d < 4; d += 1) {
      if (!wallFace(i, d)) continue
      wallFaces += 1
      faceList.push(i, d)
      const name = info[s].name
      const row = wallById.get(name) ?? { count: 0, L: sideL[s] }
      row.count += 1
      wallById.set(name, row)
      // relief: a depth change or sub-block element within 3 blocks along the plane
      const u = uDir(d)
      const dirs = [u, opposite(u), UP, DOWN]
      let hasRelief = false
      for (const t of dirs) {
        let p = i
        for (let step = 1; step <= 3 && !hasRelief; step += 1) {
          p = grid.step(p, t)
          if (p < 0) { hasRelief = true; break }
          const ps = grid.get(p)
          if (ps < 0 || !info[ps].fullCube || grid.get(p + off[d]) >= 0) hasRelief = true
        }
        if (hasRelief) break
      }
      if (hasRelief) relieved += 1
      // flat runs: count from the start of each run along +u
      const back = grid.step(i, opposite(u))
      if (back < 0 || !wallFace(back, d)) {
        let len = 0
        let p = i
        while (p >= 0 && wallFace(p, d)) {
          len += 1
          p = grid.step(p, u)
        }
        if (len > longestRun) longestRun = len
        if (len > 8) longRunFaces += len
      }
      // stripes: 1-high band of B between two rows of the same A
      const above = i + layer
      const below = i - layer
      if (wallFace(above, d) && wallFace(below, d)) {
        const a = info[grid.get(above)].name
        if (a === info[grid.get(below)].name && a !== name) {
          const [x, y, z] = grid.pos(i)
          const key = `${d}|${d === 0 || d === 2 ? z : x}|${a}|${name}`
          let rows = bandCells.get(key)
          if (!rows) { rows = new Map(); bandCells.set(key, rows) }
          let us = rows.get(y)
          if (!us) { us = []; rows.set(y, us) }
          us.push(d === 0 || d === 2 ? x : z)
        }
      }
    }
  }

  // Value steps for the wall palette: ids sorted by L*, ids within 4 L* share a step.
  const wallIds = [...wallById.entries()].filter(([, r]) => !Number.isNaN(r.L)).sort((a, b) => a[1].L - b[1].L)
  const stepOf = new Map()
  let step = -1
  let stepStart = -Infinity
  for (const [name, r] of wallIds) {
    if (r.L - stepStart > 4) { step += 1; stepStart = r.L }
    stepOf.set(name, step)
  }
  for (let q = 0; q < faceList.length; q += 2) {
    const i = faceList[q]
    const d = faceList[q + 1]
    const u = uDir(d)
    const name = info[grid.get(i)].name
    const mine = stepOf.get(name)
    let present = 0
    let different = 0
    let jumps = 0
    for (const t of [u, opposite(u), UP, DOWN]) {
      const p = grid.step(i, t)
      if (p < 0 || !wallFace(p, d)) continue
      present += 1
      const other = info[grid.get(p)].name
      if (other !== name) different += 1
      const os = stepOf.get(other)
      // frame timbers against infill are intended contrast (timber framing), not splatter
      if (FRAME_ID.test(name) || FRAME_ID.test(other)) continue
      if (mine !== undefined && os !== undefined && Math.abs(os - mine) > 2) jumps += 1
    }
    if (present >= 3) {
      speckleBase += 1
      if (different === present) speckle += 1
    }
    if (present && jumps * 2 >= present) splatter += 1
  }
  let stripeFaces = 0
  for (const rows of bandCells.values()) {
    const bandRows = []
    for (const [, us] of rows) {
      us.sort((a, b) => a - b)
      let run = 1
      let cells = 0
      for (let k = 1; k <= us.length; k += 1) {
        if (k < us.length && us[k] === us[k - 1] + 1) { run += 1; continue }
        if (run >= 4) cells += run
        run = 1
      }
      if (cells) bandRows.push(cells)
    }
    if (bandRows.length >= 3) stripeFaces += bandRows.reduce((a, b) => a + b, 0)
  }

  // Roof: column-top stairs/slabs at least 3 above the base and not resting on terrain.
  const minGy = model.bounds ? model.bounds.min[1] - grid.oy : 0
  const top = new Int32Array(grid.w * grid.d).fill(-1)
  const bottom = new Int32Array(grid.w * grid.d).fill(-1)
  for (let k = 0; k < occ.length; k += 1) {
    const i = occ[k]
    const s = grid.get(i)
    if (info[s].passable) continue
    const col = i % layer
    const y = Math.floor(i / layer)
    if (y > top[col]) top[col] = y
    if (bottom[col] < 0 || y < bottom[col]) bottom[col] = y
  }
  const roofById = new Map()
  let roofCells = 0
  let roofEdges = 0
  let overhangs = 0
  for (let k = 0; k < occ.length; k += 1) {
    const i = occ[k]
    const s = grid.get(i)
    const b = info[s]
    if (!b.stairs && b.cat !== 'slab') continue
    const col = i % layer
    const y = Math.floor(i / layer)
    if (top[col] !== y || y - minGy < 3) continue
    const under = grid.get(i - layer)
    if (under >= 0 && terrain[under]) continue // paving on the ground, not a roof
    roofCells += 1
    const rr = roofById.get(b.name) ?? { count: 0, L: topL[s] }
    rr.count += 1
    roofById.set(b.name, rr)
    // overhang: below the edge (through up to 3 partial blocks: eave undersides, brackets) is open air
    let belowOpen = false
    for (let p = i - layer, steps = 0; p >= 0 && steps < 4; p -= layer, steps += 1) {
      const ps = grid.get(p)
      if (ps < 0) { belowOpen = isExterior(p, DOWN); break }
      if (info[ps].fullCube) break
    }
    const dirs = b.stairs && b.half === 0 ? [opposite(b.facing)] : [0, 1, 2, 3]
    const isEdge = dirs.some(d => {
      const nb = i + off[d]
      return grid.get(nb) < 0 && isExterior(nb, d) && grid.get(nb - layer) < 0
    })
    if (isEdge) {
      roofEdges += 1
      if (belowOpen) overhangs += 1
    }
  }

  // Grounding: 26-connected parts touching the lowest layer; base columns hovering over air.
  let grounded = 0
  {
    const around = []
    for (let dy = -1; dy <= 1; dy += 1) for (let dz = -1; dz <= 1; dz += 1) for (let dx = -1; dx <= 1; dx += 1) if (dx || dy || dz) around.push(dx + dz * grid.w + dy * layer)
    const visited = grid.dense ? new Uint8Array(grid.vol) : new Set()
    const seen = grid.dense ? i => visited[i] === 1 : i => visited.has(i)
    const mark = grid.dense ? i => { visited[i] = 1 } : i => { visited.add(i) }
    const stack = []
    for (let k = 0; k < occ.length; k += 1) {
      const start = occ[k]
      if (seen(start)) continue
      mark(start)
      stack.push(start)
      let size = 0
      let touches = false
      while (stack.length) {
        const i = stack.pop()
        size += 1
        if (Math.floor(i / layer) === minGy) touches = true
        for (let a = 0; a < 26; a += 1) {
          const nb = i + around[a]
          if (grid.get(nb) >= 0 && !seen(nb)) { mark(nb); stack.push(nb) }
        }
      }
      if (touches) grounded += size
    }
  }
  let baseColumns = 0
  let gapColumns = 0
  for (let col = 0; col < bottom.length; col += 1) {
    if (bottom[col] < 0 || bottom[col] > minGy + 3) continue
    baseColumns += 1
    if (bottom[col] > minGy) {
      const s = grid.get(bottom[col] * layer + col)
      if (s >= 0 && info[s].cat !== 'plant') gapColumns += 1
    }
  }

  const wallRows = [...wallById.entries()].filter(([, r]) => !Number.isNaN(r.L)).sort((a, b) => b[1].count - a[1].count)
  const roofRows = [...roofById.entries()].filter(([, r]) => !Number.isNaN(r.L)).sort((a, b) => b[1].count - a[1].count)
  let roofContrast = null
  let roofPair = null
  if (roofCells >= 8 && wallRows.length && roofRows.length && wallFaces >= 30) {
    const [roofId, roof] = roofRows[0]
    // the wall field: the most common wall-face block that is not a frame timber and not the
    // roof material itself (steep roofs expose full roof blocks on their gable-side rows)
    const family = id => id.replace(/^minecraft:/, '').replace(/_(stairs|slab|wall|planks|block)$/, '').replace(/s$/, '')
    const roofFamilies = new Set([...roofById.keys()].map(family))
    const field = wallRows.find(([id]) => !FRAME_ID.test(id) && !roofFamilies.has(family(id))) ?? wallRows[0]
    const [wallId, wall] = field
    roofContrast = Math.abs(roof.L - wall.L)
    roofPair = `roof ${strip(roofId)} ${Math.round(roof.L)} vs wall ${strip(wallId)} ${Math.round(wall.L)}`
  }
  let trim = null
  let trimPair = null
  if (wallRows.length >= 2 && wallFaces >= 30) {
    const [mainId, main] = wallRows[0]
    trim = 0
    for (const [id, r] of wallRows.slice(1)) {
      if (r.count < 0.05 * wallFaces) continue
      const delta = Math.abs(r.L - main.L)
      if (delta > trim) { trim = delta; trimPair = `${strip(mainId)} ${Math.round(main.L)} vs ${strip(id)} ${Math.round(r.L)}` }
    }
    if (!trimPair) trim = null
  }

  const enough = wallFaces >= 30
  const metrics = [
    scoreMetric('roofWallContrast', roofContrast === null ? null : round(roofContrast, 1), roofPair ? { detail: roofPair } : {}),
    scoreMetric('trimContrast', trim === null ? null : round(trim, 1), trimPair ? { detail: trimPair } : {}),
    scoreMetric('speckle', speckleBase >= 30 ? pct(speckle, speckleBase) : null),
    scoreMetric('splatter', enough ? pct(splatter, wallFaces) : null),
    scoreMetric('stripes', enough ? pct(stripeFaces, wallFaces) : null),
    scoreMetric('relief', enough ? pct(relieved, wallFaces) : null),
    scoreMetric('flatRun', enough ? pct(longRunFaces, wallFaces) : null, enough ? { detail: `longest flat run ${longestRun} blocks` } : {}),
    scoreMetric('roofOverhang', roofEdges >= 6 ? pct(overhangs, roofEdges) : null, roofEdges >= 6 ? { detail: `${overhangs} of ${roofEdges} roof edge cells` } : {}),
    scoreMetric('darkSpots', lighting && lighting.walkable.covered >= 10 ? lighting.dark.coveredPercent : null),
    scoreMetric('grounded', total ? pct(grounded, total) : null),
    scoreMetric('baseGaps', baseColumns >= 10 ? pct(gapColumns, baseColumns) : null),
  ]
  const scored = metrics.filter(m => m.score !== null)
  const overall = scored.length ? Math.round((scored.reduce((a, m) => a + m.score, 0) / scored.length) * 100) : null
  return {
    overall,
    inBand: scored.filter(m => m.status === 'ok').length,
    scored: scored.length,
    metrics,
    raw: { wallFaces, roofCells, roofEdges, colorsAvailable: Boolean(colors) },
  }
}

// Composition norms: the same block-composition metrics as the 2026-10-24 corpus study of 1,212 human
// builds (scripts/lib/data/build-norms.json), compared against the P25-P75 band of a style and size class.

async function loadNorms() {
  try {
    const file = fileURLToPath(new URL('./lib/data/build-norms.json', import.meta.url))
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return null
  }
}

const NORM_ALIAS = { grass: 'short_grass', grass_path: 'dirt_path' }
const NORM_KEYS = ['distinct', 'top1', 'top5', 'partial', 'stairs_top', 'log_horizontal', 'light_per_1k', 'glass', 'leaves', 'L_mean', 'L_std', 'chroma_mean', 'terrain_share']
const PARTIAL_KEYS = ['p_stairs', 'p_slabs', 'p_trapdoors', 'p_fences', 'p_walls', 'p_panes_bars', 'p_buttons_plates', 'p_carpets']
const NORM_HINTS = {
  distinct: ['thin palette: add trims, accents and stair/slab/wall variants of the main blocks', 'broader than most builds of this style: fine for showcase detail if ids group into a few material families'],
  top1: ['no dominant material: give the main wall or roof block more weight', 'one block dominates: break it up with close-value variants and a second texture'],
  top5: ['many equal-weight materials: let about 5 blocks carry two thirds of the build', 'too concentrated: add accent and detail ids around the main five'],
  partial: ['add stair/slab/trapdoor/fence/wall detail (roof edges, sills, frames, railings)', 'mostly partial blocks: keep walls and roofs reading as solid surfaces'],
  stairs_top: ['use upside-down stairs for eaves, sills, corbels and overhang soffits', 'many upside-down stairs: fine for soffits and corbels; check that roof slopes face up'],
  log_horizontal: ['lay some logs along x/z as beams, sills, lintels and frame bands', 'mostly horizontal logs: add vertical posts at corners and bay lines'],
  light_per_1k: ['too few lights: lanterns at doors, along paths every 8-12 blocks, inside rooms', 'dense lighting: keep it purposeful (lanterns at doors and paths, no torch spam)'],
  glass: ['few windows: add glass panes set one block into the wall', 'glass-heavy for this style: more solid wall between openings'],
  leaves: ['add foliage: bushes at corners, planters, vines or a tree', 'more foliage than most builds of this style: fine for gardens, keep it from hiding the facade'],
  L_mean: ['reads dark: lighten the wall field or the roof', 'reads pale: darken the base, frame or roof'],
  L_std: ['flat values: put a darker base/frame/roof against a lighter wall field', 'harsh value jumps: tighten the light-dark range of the main surfaces'],
  chroma_mean: ['colourless: add warm wood or a coloured roof or accent', 'more saturated than most: keep strong colour for roofs and accents, calm the wall fields'],
  terrain_share: ['no ground: add a terrain plug, a path and planting around the base', 'terrain-heavy: fine for scenes; make sure the build still reads as the focus'],
}
const NORM_LABELS = {
  distinct: 'distinct block ids', top1: 'top-1 block share', top5: 'top-5 block share', partial: 'partial blocks',
  stairs_top: 'upside-down stairs', log_horizontal: 'horizontal logs', light_per_1k: 'lights per 1k blocks', glass: 'glass',
  leaves: 'leaves', L_mean: 'L* mean (lightness)', L_std: 'L* std (value contrast)', chroma_mean: 'chroma (saturation)',
  terrain_share: 'terrain share', p_stairs: 'stairs', p_slabs: 'slabs', p_trapdoors: 'trapdoors', p_fences: 'fences',
  p_walls: 'walls', p_panes_bars: 'panes/bars', p_buttons_plates: 'buttons/plates', p_carpets: 'carpets',
}
const NORM_UNITS = { distinct: '', light_per_1k: '/1k', L_mean: '', L_std: '', chroma_mean: '' } // others are %

function computeComposition(model, info, counts, colors, norms) {
  const def = norms?.definitions ?? {}
  const terrainIds = new Set(def.terrain ?? [])
  const technical = new Set(def.technical ?? [])
  const extraLights = new Set(def.extraLights ?? [])
  const litLights = new Set(def.litLights ?? [])
  const notLights = new Set(def.notLights ?? [])
  const built = new Map()
  let nonair = 0
  let nonvanilla = 0
  let total = 0
  let stairsAll = 0
  let stairsTop = 0
  let logAll = 0
  let logH = 0
  let lights = 0
  const partial = Object.fromEntries(PARTIAL_KEYS.map(k => [k, 0]))
  info.forEach((s, k) => {
    const c = counts[k]
    if (!c) return
    const n = NORM_ALIAS[s.short] ?? s.short
    if (technical.has(n)) return
    nonair += c
    if (!s.name.startsWith('minecraft:')) { nonvanilla += c; return }
    if (terrainIds.has(n)) return
    total += c
    built.set(n, (built.get(n) ?? 0) + c)
    if (n.endsWith('_stairs')) {
      stairsAll += c
      if (s.props.half === 'top') stairsTop += c
    }
    if (/(_log|_wood|_stem|_hyphae)$/.test(n)) {
      logAll += c
      if (s.props.axis === 'x' || s.props.axis === 'z') logH += c
    }
    const bc = colors?.[`minecraft:${n}`]
    const always = ((bc?.emissive && !bc.emissiveWhen) || extraLights.has(n)) && !notLights.has(n)
    const lit = (bc?.emissiveWhen === 'lit' || litLights.has(n)) && s.props.lit === 'true'
    if (always || lit) lights += c
    const type = n.endsWith('_stairs') ? 'p_stairs' : n.endsWith('_slab') ? 'p_slabs' : n.endsWith('_wall') ? 'p_walls'
      : n.endsWith('_fence') || n.endsWith('_fence_gate') ? 'p_fences' : n.endsWith('_trapdoor') ? 'p_trapdoors'
        : n.endsWith('_pane') || n === 'iron_bars' || n.endsWith('_bars') ? 'p_panes_bars'
          : n.endsWith('_button') || n.endsWith('_pressure_plate') ? 'p_buttons_plates' : n.endsWith('_carpet') ? 'p_carpets' : null
    if (type) partial[type] += c
  })
  const m = { built: total, max_dim: Math.max(...model.size) }
  m.terrain_share = nonair ? 100 * (1 - (total + nonvanilla) / nonair) : null
  if (!total) return m
  const sorted = [...built.entries()].sort((a, b) => b[1] - a[1])
  m.distinct = built.size
  m.top1 = (100 * sorted[0][1]) / total
  m.top1_id = sorted[0][0]
  m.top5 = (100 * sorted.slice(0, 5).reduce((a, [, c]) => a + c, 0)) / total
  for (const k of PARTIAL_KEYS) m[k] = (100 * partial[k]) / total
  m.partial = PARTIAL_KEYS.reduce((a, k) => a + m[k], 0)
  m.stairs_top = stairsAll >= 10 ? (100 * stairsTop) / stairsAll : null
  m.log_horizontal = logAll >= 10 ? (100 * logH) / logAll : null
  m.light_per_1k = (1000 * lights) / total
  m.glass = (100 * sorted.filter(([n]) => n.includes('glass')).reduce((a, [, c]) => a + c, 0)) / total
  m.leaves = (100 * sorted.filter(([n]) => n.endsWith('_leaves')).reduce((a, [, c]) => a + c, 0)) / total
  if (colors) {
    const samples = []
    let weight = 0
    for (const [n, c] of built) {
      const lab = colors[`minecraft:${n}`]?.lab
      if (!lab) continue
      samples.push([lab[0], c, Math.hypot(lab[1], lab[2])])
      weight += c
    }
    if (weight) {
      const mean = samples.reduce((a, [L, w]) => a + L * w, 0) / weight
      m.L_mean = mean
      m.L_std = Math.sqrt(samples.reduce((a, [L, w]) => a + w * (L - mean) ** 2, 0) / weight)
      m.chroma_mean = samples.reduce((a, [, w, ch]) => a + w * ch, 0) / weight
      samples.sort((a, b) => a[0] - b[0])
      const wq = q => {
        let acc = 0
        for (const [L, w] of samples) {
          acc += w
          if (acc >= q * weight) return L
        }
        return samples.at(-1)[0]
      }
      m.L_p10_p90 = wq(0.9) - wq(0.1)
    }
  }
  return m
}

function resolveStyle(norms, style) {
  if (!style) return 'all'
  const key = style.toLowerCase()
  if (norms.groups[key]) return key
  for (const [name, aliases] of Object.entries(norms.styleAliases ?? {})) if (aliases.includes(key)) return name
  throw new Error(`Unknown --style "${style}". Styles: ${Object.keys(norms.groups).join(', ')}`)
}

function selectNorms(norms, styleKey, maxDim) {
  const size = maxDim <= 32 ? 'S' : maxDim <= 64 ? 'M' : maxDim <= 128 ? 'L' : 'XL'
  const sizeText = { S: '<=32', M: '33-64', L: '65-128', XL: '>128' }[size]
  const group = norms.groups[styleKey]
  const bucket = group.sizes?.[size]
  if (bucket && bucket.n >= 8) {
    return { name: `${styleKey} x ${size} (${sizeText})`, style: styleKey, size, n: bucket.n, metrics: { ...group.metrics, ...bucket.metrics } }
  }
  return { name: `${styleKey} (all sizes; ${size} ${sizeText} bucket too small)`, style: styleKey, size, n: group.n, metrics: group.metrics }
}

function normMetric(key, value, band, extra = {}) {
  const unit = NORM_UNITS[key] ?? '%'
  const label = NORM_LABELS[key]
  if (!band) return null
  const [lo, med, hi] = band
  const bandText = `${lo}-${hi}${unit === '%' ? '%' : unit}`
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { id: key, group: 'composition', label, value: null, unit, band: bandText, median: med, status: 'n/a', score: null, ...extra }
  }
  const v = round(value, key === 'distinct' ? 0 : 1)
  let status = 'ok'
  let dist = 0
  if (v < lo) { status = 'low'; dist = lo - v }
  if (v > hi) { status = 'high'; dist = v - hi }
  const soft = 1.5 * Math.max(hi - lo, Math.abs(med) * 0.5, 1)
  const score = status === 'ok' ? 1 : Math.max(0, 1 - dist / soft)
  const hint = status === 'low' ? NORM_HINTS[key]?.[0] : status === 'high' ? NORM_HINTS[key]?.[1] : undefined
  return {
    id: key, group: 'composition', label, value: v, unit, band: bandText, median: med,
    position: status === 'low' ? 'below P25' : status === 'high' ? 'above P75' : 'in band',
    status, score: round(score, 2), ...(hint ? { hint } : {}), ...extra,
  }
}

function buildScorecard(model, info, counts, summary, lighting, colors, norms, options) {
  const geometry = computeScore(model, info, lighting, colors)
  const metrics = []
  let normInfo = null
  let mix = []
  if (norms) {
    const comp = computeComposition(model, info, counts, colors, norms)
    const sel = selectNorms(norms, resolveStyle(norms, options.style), comp.max_dim)
    normInfo = { name: sel.name, style: sel.style, size: sel.size, n: sel.n, builtBlocks: comp.built, maxDim: comp.max_dim }
    for (const key of NORM_KEYS) {
      const extra = key === 'top1' && comp.top1_id ? { detail: comp.top1_id } : key === 'L_std' && comp.L_p10_p90 !== undefined ? { detail: `P10-P90 spread ${round(comp.L_p10_p90, 1)}, band ${sel.metrics.L_p10_p90?.[0]}-${sel.metrics.L_p10_p90?.[2]}` } : {}
      const metric = normMetric(key, comp[key] ?? null, sel.metrics[key], extra)
      if (metric) metrics.push(metric)
    }
    // detail mix: partial-block types outside their band (not scored separately)
    mix = PARTIAL_KEYS.map(key => normMetric(key, comp[key] ?? null, sel.metrics[key]))
      .filter(m => m && m.status !== 'ok' && m.status !== 'n/a' && !(m.status === 'low' && sel.metrics[m.id][0] < 0.5))
      .map(m => ({ id: m.id, label: m.label, value: m.value, band: m.band, status: m.status }))
  }
  for (const m of geometry.metrics) metrics.push({ ...m, group: 'geometry' })
  const scored = metrics.filter(m => m.score !== null)
  const overall = scored.length ? Math.round((scored.reduce((a, m) => a + m.score, 0) / scored.length) * 100) : null
  return {
    overall,
    inBand: scored.filter(m => m.status === 'ok').length,
    scored: scored.length,
    norms: normInfo,
    metrics,
    detailMix: mix,
    raw: geometry.raw,
  }
}

function formatScore(result) {
  const valueText = m => {
    if (m.value === null) return 'n/a'
    const unit = m.group === 'composition' ? m.unit : SCORE_BANDS[m.id].unit
    return `${m.value}${unit === '%' ? '%' : unit}`
  }
  const bandText = m => (m.group === 'composition' ? `band ${m.band}` : `target ${m.band}`)
  const out = []
  const ref = result.norms ? `composition vs ${result.norms.name}, N=${result.norms.n} human builds` : 'composition norms unavailable (scripts/lib/data/build-norms.json missing)'
  out.push(`Scorecard: ${result.overall === null ? 'n/a' : `${result.overall}/100`}, ${result.inBand} of ${result.scored} metrics in band (${ref}; geometry targets from 60 curated builds + 152 village houses)`)
  const outside = result.metrics.filter(m => m.status === 'low' || m.status === 'high').sort((a, b) => a.score - b.score)
  if (outside.length) {
    out.push('Outside band (worst first):')
    const lw = Math.max(...outside.map(m => m.label.length))
    const vw = Math.max(...outside.map(m => valueText(m).length))
    const bw = Math.max(...outside.map(m => bandText(m).length))
    for (const m of outside) {
      const where = m.group === 'composition' ? (m.status === 'low' ? 'below' : 'above') : m.status === 'low' ? 'low  ' : 'high '
      out.push(`  ${m.status.toUpperCase().padEnd(4)}  ${m.label.padEnd(lw)}  ${valueText(m).padStart(vw)}  ${where.padEnd(5)} ${bandText(m).padEnd(bw)}  ${m.hint ?? ''}`.trimEnd())
      if (m.id === 'partial' && result.detailMix.length) {
        out.push(`        detail mix: ${result.detailMix.map(d => `${d.label} ${d.value}% (band ${d.band})`).join(', ')}`)
      }
    }
  }
  if (!outside.some(m => m.id === 'partial') && result.detailMix.length) {
    out.push(`  note  detail mix outside band: ${result.detailMix.map(d => `${d.label} ${d.value}% (band ${d.band})`).join(', ')}`)
  }
  const inside = result.metrics.filter(m => m.status === 'ok')
  if (inside.length) {
    out.push('In band:')
    const items = inside.map(m => `${m.label} ${valueText(m)} (${m.band})`)
    let line = ' '
    for (const item of items) {
      if (line.length + item.length + 2 > 110) { out.push(line); line = ' ' }
      line += ` ${item};`
    }
    if (line.trim()) out.push(line)
  }
  const na = result.metrics.filter(m => m.status === 'n/a')
  if (na.length) out.push(`n/a (not enough walls, roof edges, stairs, logs or roofed floor): ${na.map(m => m.label).join(', ')}`)
  if (!result.raw.colorsAvailable) out.push('(scripts/lib/data/block-colors.json not found: value and colour metrics are n/a)')
  return out.join('\n')
}

// ---------------------------------------------------------------------------------------------
// Formatting helpers

function pct(part, whole) {
  return whole > 0 ? round((part / whole) * 100, 1) : 0
}

function round(value, digits) {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

const num = value => Number(value).toLocaleString('en-US')
const strip = id => String(id).replace(/^minecraft:/, '')

function formatHeader(file, meta, model) {
  const b = model.bounds
  const lines = [`${path.basename(file)}  (${meta.compression}, DataVersion ${model.dataVersion ?? 'n/a'}${model.paletteCount > 1 ? `, palette index ${model.paletteIndex} of ${model.paletteCount} (--palette n)` : ''})`]
  lines.push(`Size ${model.size.join(' x ')} (x y z); ${num(model.occ.length)} non-air blocks${b ? `; non-air bounds x ${b.min[0]}..${b.max[0]}, y ${b.min[1]}..${b.max[1]}, z ${b.min[2]}..${b.max[2]}` : ''}`)
  return lines.join('\n')
}

function formatSummary(summary, lighting, options) {
  const out = []
  const f = summary.file
  const b = summary.bounds
  out.push(`Volume ${num(summary.volume)}; filled ${summary.fillPercent}%${b ? `; bounds size ${b.size.join(' x ')}` : ''}`)
  const fileNotes = [`${num(f.entries)} block entries`, `${num(f.airEntries)} air/void`]
  if (f.jigsawsResolved) fileNotes.push(`${f.jigsawsResolved} jigsaw(s) replaced by final_state`)
  if (f.duplicates) fileNotes.push(`${f.duplicates} duplicate positions (last wins)`)
  if (f.outsideSize) fileNotes.push(`${f.outsideSize} entries outside size`)
  if (f.badStateRefs) fileNotes.push(`${f.badStateRefs} bad palette refs`)
  const ents = Object.entries(summary.entities)
  fileNotes.push(ents.length ? `entities: ${ents.map(([id, c]) => `${strip(id)} x${c}`).join(', ')}` : 'no entities')
  out.push(`File: ${fileNotes.join('; ')}`)
  out.push('')

  const rows = options.states ? summary.paletteStates : summary.palette
  const shown = options.all ? rows : rows.slice(0, 40)
  const notes = []
  if (rows.length > shown.length) notes.push(`top ${shown.length}, --all for all`)
  if (!options.states) notes.push('--states for full states')
  out.push(`Palette: ${summary.blockIds} block ids, ${summary.blockStates} states${notes.length ? ` (${notes.join('; ')})` : ''}`)
  const countWidth = Math.max(5, ...shown.map(r => num(r.count).length))
  for (const row of shown) {
    const extra = options.states ? '' : row.states > 1 ? `  (${row.states} states)` : ''
    out.push(`  ${num(row.count).padStart(countWidth)}  ${row.percent.toFixed(1).padStart(5)}%  ${options.states ? row.state : row.id}${extra}`)
  }
  out.push('')

  out.push('Categories:')
  const total = summary.blocks
  for (const [cat, count] of Object.entries(summary.categories)) {
    if (!count) continue
    out.push(`  ${CATEGORY_LABELS[cat].padEnd(18)} ${num(count).padStart(countWidth)}  ${pct(count, total).toFixed(1).padStart(5)}%`)
  }
  out.push(`Detail ratio: ${summary.detailRatio} (non-cube solid blocks / all solid built blocks; fluids and terrain excluded)`)
  out.push('')

  out.push('Lighting (approximate: block-light BFS from emitters, sky light ignored):')
  const src = lighting.sources
  out.push(`  sources: ${num(lighting.sourceBlocks)}${src.length ? ` (${src.slice(0, 6).map(s => `${strip(s.id)} x${s.count} @${s.level}`).join(', ')}${src.length > 6 ? ', ...' : ''})` : ''}`)
  if (lighting.unlit.length) out.push(`  unlit: ${lighting.unlit.map(u => `${strip(u.id)} x${u.count}`).join(', ')}`)
  const w = lighting.walkable
  out.push(`  walkable spots (air over a solid top inside the bounds): ${num(w.covered + w.open)} (roofed ${num(w.covered)}, open ${num(w.open)})`)
  out.push(`  dark (block light 0, hostile mobs can spawn): roofed ${num(lighting.dark.covered)} (${lighting.dark.coveredPercent}%), open ${num(lighting.dark.open)} (${lighting.dark.openPercent}%)`)
  if (lighting.darkPockets.length && lighting.dark.covered) {
    out.push('  darkest roofed areas:')
    for (const p of lighting.darkPockets.slice(0, 5)) {
      out.push(`    ${String(p.count).padStart(4)} spots around x ${p.min[0]}..${p.max[0]}, y ${p.min[1]}..${p.max[1]}, z ${p.min[2]}..${p.max[2]}`)
    }
  }
  return out.join('\n')
}

function formatProfile(rows) {
  const out = ['Profile (highest y first; coverage = blocks / bounds footprint; detail = non-cube share):']
  out.push('     y  blocks  cover  ids  detail  top blocks')
  const maxBlocks = Math.max(1, ...rows.map(r => r.blocks))
  for (let k = 0; k < rows.length; k += 1) {
    const r = rows[k]
    if (!r.blocks) {
      let end = k
      while (end + 1 < rows.length && !rows[end + 1].blocks) end += 1
      out.push(end > k ? `  ${String(r.y).padStart(4)}  (empty down to y=${rows[end].y})` : `  ${String(r.y).padStart(4)}  (empty)`)
      k = end
      continue
    }
    const top = r.top.map(t => `${strip(t.id)} ${num(t.count)}`).join(', ')
    const bar = '#'.repeat(Math.round((r.blocks / maxBlocks) * 12)).padEnd(12)
    out.push(`  ${String(r.y).padStart(4)}  ${num(r.blocks).padStart(6)}  ${r.coveragePercent.toFixed(0).padStart(4)}%  ${String(r.distinct).padStart(3)}  ${r.detailPercent.toFixed(0).padStart(5)}%  ${bar} ${top}${r.dense ? '  <- dense layer (floor/roof?)' : ''}`)
  }
  return out.join('\n')
}

function formatFind(result) {
  const out = [`Find "${result.query}" (${result.mode}): ${num(result.total)} match(es)${result.total > result.shown ? `, showing ${result.shown} (--limit to change)` : ''}`]
  if (!result.total) return out.join('\n')
  const b = result.bounds
  out.push(`  bounds x ${b.min[0]}..${b.max[0]}, y ${b.min[1]}..${b.max[1]}, z ${b.min[2]}..${b.max[2]}`)
  if (result.states.length > 1) out.push(`  states: ${result.states.slice(0, 8).map(s => `${strip(s.state)} x${s.count}`).join(', ')}${result.states.length > 8 ? ', ...' : ''}`)
  for (const p of result.positions) {
    out.push(`  (${p.pos.join(', ')})  ${strip(p.state)}${p.nbt ? `  {nbt${p.nbt === true ? '' : `: ${strip(p.nbt)}`}}` : ''}${p.fromJigsaw ? '  (jigsaw final_state)' : ''}`)
  }
  return out.join('\n')
}

function formatChecks(checks) {
  const warn = checks.filter(c => c.level === 'warn').length
  const info = checks.filter(c => c.level === 'info').length
  const ok = checks.filter(c => c.level === 'ok').length
  const out = [`Checks: ${warn} warning(s), ${info} note(s), ${ok} passed`]
  const order = { warn: 0, info: 1, ok: 2 }
  const width = Math.max(...checks.map(c => c.id.length))
  for (const c of [...checks].sort((a, b) => order[a.level] - order[b.level])) {
    out.push(`${c.level.toUpperCase().padEnd(4)}  ${c.id.padEnd(width)}  ${c.message}`)
    for (const e of c.examples ?? []) out.push(`${' '.repeat(width + 8)}e.g. ${e}`)
    if (c.level !== 'ok' && c.hint) out.push(`${' '.repeat(width + 8)}fix: ${c.hint}`)
  }
  return out.join('\n')
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  if (!options.file) throw new Error(`Missing .nbt file.\n${usage()}`)

  const filePath = path.resolve(options.file)
  const bytes = await fs.readFile(filePath)
  const meta = readNbt(bytes)
  const model = loadStructure(meta.root, options)
  const pack = await loadPack()
  const info = analyzeStates(model.states, pack)
  const counts = countStates(model)

  const hasCommand = options.slices.length || options.profile || options.find.length || options.checks || options.score
  const wantSummary = options.summary || !hasCommand
  const summary = buildSummary(model, info, counts, options)
  const needLighting = wantSummary || options.checks || options.score
  const lighting = needLighting ? computeLighting(model, info, counts) : null
  const sliceData = buildSlices(model, info, options)
  const profile = options.profile ? buildProfile(model, info) : null
  const finds = options.find.map(q => buildFind(model, info, q, options.limit))
  const checks = options.checks ? runChecks(model, info, counts, summary, lighting, options) : null
  const score = options.score ? buildScorecard(model, info, counts, summary, lighting, await loadColors(), await loadNorms(), options) : null

  if (options.json) {
    const result = {
      file: filePath,
      compression: meta.compression,
      dataVersion: model.dataVersion ?? null,
      packAvailable: Boolean(pack),
      summary: { ...summary, showAll: undefined, palette: options.all ? summary.palette : summary.palette.slice(0, 40), paletteStates: options.states || options.all ? summary.paletteStates : undefined },
    }
    if (lighting) result.lighting = { ...lighting, lightAt: undefined }
    if (sliceData.slices) {
      result.slices = sliceData.slices.map(s => ({ axis: s.axis, value: s.value, columns: { axis: s.colAxis, from: s.cols[0], to: s.cols[1] }, rows: { axis: s.rowAxis, values: s.rowValues }, blocks: s.filled, lines: s.lines }))
      result.legends = Object.fromEntries([...sliceData.legends].map(([view, legend]) => [view, legend.rows]))
    }
    if (profile) result.profile = profile
    if (finds.length) result.find = finds
    if (checks) result.checks = checks
    if (score) result.score = score
    console.log(JSON.stringify(result, null, 2))
    return
  }

  const sections = [formatHeader(filePath, meta, model)]
  if (!pack) sections.push('(Lodestone default pack not found: block id/property validation and model-based shape detection are disabled)')
  if (wantSummary) sections.push(formatSummary(summary, lighting, options))
  if (sliceData.slices) {
    const views = []
    for (const slice of sliceData.slices) if (!views.includes(slice.axis)) views.push(slice.axis)
    for (const view of views) {
      const group = sliceData.slices.filter(s => s.axis === view)
      const text = group.map(formatSlice)
      const wide = group.some(s => s.cols[1] - s.cols[0] > 160) && !options.range
      text.push(formatLegend(view, sliceData.legends.get(view)))
      if (wide) text.push('(wide map: use --range x0,z0,x1,z1 to crop)')
      sections.push(text.join('\n\n'))
    }
  }
  if (profile) sections.push(formatProfile(profile))
  for (const result of finds) sections.push(formatFind(result))
  if (checks) sections.push(formatChecks(checks))
  if (score) sections.push(formatScore(score))
  console.log(sections.join('\n\n'))
}

main().catch(err => {
  console.error(`inspect: ${err.message}`)
  process.exitCode = 1
})
