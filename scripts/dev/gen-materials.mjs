#!/usr/bin/env node

// Generates the material family table used by procedural recipes:
//   scripts/lib/data/materials.json
//   references/building/materials.md
//
// Everything is derived from Lodestone's bundled default pack (the vanilla
// 1.21.1 block set the previewer renders). Shape variants (stairs, slabs,
// walls, fences, doors, signs, ...) are discovered from the block list by
// suffix; the small curated tables below only cover naming irregularities,
// grouping/kind metadata and blocks that have no shape variants at all.
// Substitutes for missing variants are ranked by CIEDE2000 distance between
// average texture colors read from the pack atlas.
//
// Built-ins only. The generator validates its own output and exits non-zero
// if any id is missing from the pack.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEFAULT_PACK_DIR = path.join(SKILL_ROOT, 'node_modules', '@mattzh72', 'lodestone', 'assets', 'default-pack')
const OUT_JSON = path.join(SKILL_ROOT, 'scripts', 'lib', 'data', 'materials.json')
const OUT_MD = path.join(SKILL_ROOT, 'references', 'building', 'materials.md')
const NS = 'minecraft:'

function usage() {
  return `Usage:
  node scripts/dev/gen-materials.mjs [--check] [--pack <default-pack-dir>] [--vanilla <assets/minecraft-dir>]

Options:
  --check            Validate and compare against the files on disk without writing.
                     Exits 1 if validation fails or the outputs are stale.
  --pack <dir>       Lodestone default-pack directory (assets.json, atlas.png).
                     Default: node_modules/@mattzh72/lodestone/assets/default-pack
  --vanilla <dir>    Optional extracted vanilla assets/minecraft directory; every id
                     is also checked against <dir>/blockstates/<id>.json.
`
}

function parseArgs(argv) {
  const options = { check: false, pack: DEFAULT_PACK_DIR, vanilla: undefined, help: false }
  const readValue = (arg, index) => {
    const value = argv[index + 1]
    if (!value || value.startsWith('-')) throw new Error(`${arg} requires a path`)
    return value
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '-h' || arg === '--help') options.help = true
    else if (arg === '--check') options.check = true
    else if (arg === '--pack') options.pack = path.resolve(readValue(arg, index++))
    else if (arg === '--vanilla') options.vanilla = path.resolve(readValue(arg, index++))
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

// ---------------------------------------------------------------------------
// Curated data
// ---------------------------------------------------------------------------

const DYE_COLORS = [
  'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black',
]

// Shape suffixes, longest first so `_wall_hanging_sign` wins over `_sign`.
const SHAPE_SUFFIXES = [
  'wall_hanging_sign', 'hanging_sign', 'wall_sign', 'sign', 'pressure_plate',
  'fence_gate', 'fence', 'trapdoor', 'door', 'button', 'stairs', 'slab', 'wall',
]

// Shape stems whose name is not the material name.
const STEM_ALIASES = {
  heavy_weighted: 'iron', // heavy_weighted_pressure_plate is crafted from iron ingots
  light_weighted: 'gold', // light_weighted_pressure_plate is crafted from gold ingots
}

// Shape blocks deliberately left out of every family.
const IGNORED_SHAPES = {
  petrified_oak_slab: 'legacy slab that looks like oak_slab but is mined like stone; use minecraft:oak_slab',
}

// Wood fields that do not follow `<wood>_<field>` naming. null = deliberately absent.
const WOOD_OVERRIDES = {
  bamboo: { log: 'bamboo_block', stripped_log: 'stripped_bamboo_block', sapling: null, mosaic: 'bamboo_mosaic' },
  crimson: { leaves: 'nether_wart_block', sapling: 'crimson_fungus' },
  warped: { leaves: 'warped_wart_block', sapling: 'warped_fungus' },
  mangrove: { sapling: 'mangrove_propagule' },
}

// Kind + group (base family of the material line) + parent (first-choice
// family for missing shape variants) for every family discovered from shapes.
// The generator fails if a discovered family is missing here.
const SHAPE_FAMILY_META = {
  stone: ['stone', 'stone'],
  cobblestone: ['stone', 'stone'],
  mossy_cobblestone: ['stone', 'stone'],
  smooth_stone: ['stone', 'stone', 'stone'],
  stone_brick: ['stone', 'stone'],
  mossy_stone_brick: ['stone', 'stone'],
  andesite: ['stone', 'andesite'],
  polished_andesite: ['stone', 'andesite'],
  diorite: ['stone', 'diorite'],
  polished_diorite: ['stone', 'diorite'],
  granite: ['stone', 'granite'],
  polished_granite: ['stone', 'granite'],
  cobbled_deepslate: ['stone', 'deepslate'],
  polished_deepslate: ['stone', 'deepslate'],
  deepslate_brick: ['stone', 'deepslate'],
  deepslate_tile: ['stone', 'deepslate'],
  tuff: ['stone', 'tuff'],
  polished_tuff: ['stone', 'tuff'],
  tuff_brick: ['stone', 'tuff'],
  brick: ['stone', 'brick'],
  sandstone: ['stone', 'sandstone'],
  cut_sandstone: ['stone', 'sandstone', 'smooth_sandstone'],
  smooth_sandstone: ['stone', 'sandstone'],
  red_sandstone: ['stone', 'red_sandstone'],
  cut_red_sandstone: ['stone', 'red_sandstone', 'smooth_red_sandstone'],
  smooth_red_sandstone: ['stone', 'red_sandstone'],
  quartz: ['stone', 'quartz'],
  smooth_quartz: ['stone', 'quartz'],
  blackstone: ['nether', 'blackstone'],
  polished_blackstone: ['nether', 'blackstone'],
  polished_blackstone_brick: ['nether', 'blackstone'],
  nether_brick: ['nether', 'nether_brick'],
  red_nether_brick: ['nether', 'red_nether_brick'],
  purpur: ['end', 'purpur'],
  end_stone_brick: ['end', 'end_stone'],
  prismarine: ['ocean', 'prismarine'],
  prismarine_brick: ['ocean', 'prismarine'],
  dark_prismarine: ['ocean', 'prismarine'],
  mud_brick: ['earth', 'mud'],
  bamboo_mosaic: ['wood', 'bamboo'],
  iron: ['metal', 'iron'],
  gold: ['metal', 'gold'],
}

// Full blocks without (their own) shape variants that builders commonly use.
// name: [block, kind, group, parent?, extra fields?]
const STANDALONE_FAMILIES = {
  deepslate: ['deepslate', 'stone', 'deepslate', 'cobbled_deepslate'],
  chiseled_deepslate: ['chiseled_deepslate', 'stone', 'deepslate', 'polished_deepslate'],
  cracked_deepslate_bricks: ['cracked_deepslate_bricks', 'stone', 'deepslate', 'deepslate_brick'],
  cracked_deepslate_tiles: ['cracked_deepslate_tiles', 'stone', 'deepslate', 'deepslate_tile'],
  chiseled_stone_bricks: ['chiseled_stone_bricks', 'stone', 'stone', 'stone_brick'],
  cracked_stone_bricks: ['cracked_stone_bricks', 'stone', 'stone', 'stone_brick'],
  chiseled_tuff: ['chiseled_tuff', 'stone', 'tuff', 'polished_tuff'],
  chiseled_tuff_bricks: ['chiseled_tuff_bricks', 'stone', 'tuff', 'tuff_brick'],
  chiseled_sandstone: ['chiseled_sandstone', 'stone', 'sandstone', 'sandstone'],
  chiseled_red_sandstone: ['chiseled_red_sandstone', 'stone', 'red_sandstone', 'red_sandstone'],
  chiseled_quartz_block: ['chiseled_quartz_block', 'stone', 'quartz', 'quartz'],
  quartz_bricks: ['quartz_bricks', 'stone', 'quartz', 'quartz'],
  quartz_pillar: ['quartz_pillar', 'stone', 'quartz', 'quartz'],
  calcite: ['calcite', 'stone', 'calcite'],
  dripstone: ['dripstone_block', 'stone', 'dripstone'],
  obsidian: ['obsidian', 'stone', 'obsidian'],
  crying_obsidian: ['crying_obsidian', 'stone', 'obsidian'],
  chiseled_polished_blackstone: ['chiseled_polished_blackstone', 'nether', 'blackstone', 'polished_blackstone'],
  cracked_polished_blackstone_bricks: ['cracked_polished_blackstone_bricks', 'nether', 'blackstone', 'polished_blackstone_brick'],
  gilded_blackstone: ['gilded_blackstone', 'nether', 'blackstone', 'blackstone'],
  chiseled_nether_bricks: ['chiseled_nether_bricks', 'nether', 'nether_brick', 'nether_brick'],
  cracked_nether_bricks: ['cracked_nether_bricks', 'nether', 'nether_brick', 'nether_brick'],
  netherrack: ['netherrack', 'nether', 'netherrack'],
  basalt: ['basalt', 'nether', 'basalt'],
  polished_basalt: ['polished_basalt', 'nether', 'basalt'],
  smooth_basalt: ['smooth_basalt', 'nether', 'basalt'],
  glowstone: ['glowstone', 'nether', 'glowstone'],
  shroomlight: ['shroomlight', 'nether', 'shroomlight'],
  end_stone: ['end_stone', 'end', 'end_stone', 'end_stone_brick'],
  purpur_pillar: ['purpur_pillar', 'end', 'purpur', 'purpur'],
  sea_lantern: ['sea_lantern', 'ocean', 'sea_lantern'],
  mud: ['mud', 'earth', 'mud'],
  packed_mud: ['packed_mud', 'earth', 'mud', 'mud_brick'],
  dirt: ['dirt', 'earth', 'dirt'],
  coarse_dirt: ['coarse_dirt', 'earth', 'dirt'],
  rooted_dirt: ['rooted_dirt', 'earth', 'dirt'],
  clay: ['clay', 'earth', 'clay'],
  sand: ['sand', 'earth', 'sand'],
  red_sand: ['red_sand', 'earth', 'sand'],
  gravel: ['gravel', 'earth', 'gravel'],
  moss: ['moss_block', 'earth', 'moss', undefined, { carpet: 'moss_carpet' }],
  snow: ['snow_block', 'earth', 'snow'],
  ice: ['ice', 'earth', 'ice'],
  packed_ice: ['packed_ice', 'earth', 'ice'],
  blue_ice: ['blue_ice', 'earth', 'ice'],
  hay: ['hay_block', 'earth', 'hay'],
  netherite: ['netherite_block', 'metal', 'netherite'],
  raw_iron: ['raw_iron_block', 'metal', 'iron'],
  raw_gold: ['raw_gold_block', 'metal', 'gold'],
  raw_copper: ['raw_copper_block', 'metal', 'copper'],
  diamond: ['diamond_block', 'decorative', 'diamond'],
  emerald: ['emerald_block', 'decorative', 'emerald'],
  lapis: ['lapis_block', 'decorative', 'lapis'],
  redstone: ['redstone_block', 'decorative', 'redstone'],
  coal: ['coal_block', 'decorative', 'coal'],
  amethyst: ['amethyst_block', 'decorative', 'amethyst'],
  bone: ['bone_block', 'decorative', 'bone'],
  ochre_froglight: ['ochre_froglight', 'decorative', 'froglight'],
  verdant_froglight: ['verdant_froglight', 'decorative', 'froglight'],
  pearlescent_froglight: ['pearlescent_froglight', 'decorative', 'froglight'],
  bookshelf: ['bookshelf', 'wood', 'oak', 'oak'],
  terracotta: ['terracotta', 'decorative', 'terracotta'],
  glass: ['glass', 'decorative', 'glass', undefined, { pane: 'glass_pane' }],
  tinted_glass: ['tinted_glass', 'decorative', 'glass'],
}

// Material-line links that cannot be derived from names (shared by the group).
const GROUP_EXTRA_LINKS = {
  stone: { cobbled: 'cobblestone' },
  deepslate: { cobbled: 'cobbled_deepslate' },
}

// Links that belong to one family only.
const FAMILY_EXTRA_LINKS = {
  iron: { bars: 'iron_bars' },
}

const COPPER_STAGES = ['', 'exposed_', 'weathered_', 'oxidized_']
const COPPER_OXIDATION = { '': 'none', exposed_: 'exposed', weathered_: 'weathered', oxidized_: 'oxidized' }

// Newer vanilla blocks this pack does not contain (1.21.2+). If any of these
// ever shows up the curated tables above need a review.
const KNOWN_NEWER_BLOCKS = {
  'pale_oak (1.21.2+)': [
    'pale_oak_planks', 'pale_oak_log', 'pale_oak_wood', 'stripped_pale_oak_log', 'stripped_pale_oak_wood',
    'pale_oak_leaves', 'pale_oak_sapling', 'pale_oak_stairs', 'pale_oak_slab', 'pale_oak_fence',
    'pale_oak_fence_gate', 'pale_oak_door', 'pale_oak_trapdoor', 'pale_oak_button', 'pale_oak_pressure_plate',
    'pale_oak_sign', 'pale_oak_hanging_sign', 'pale_moss_block', 'pale_moss_carpet', 'pale_hanging_moss', 'creaking_heart',
  ],
  'resin (1.21.4+)': ['resin_block', 'resin_bricks', 'resin_brick_stairs', 'resin_brick_slab', 'resin_brick_wall', 'chiseled_resin_bricks', 'resin_clump'],
  'copper additions (1.21.9+)': ['copper_bars', 'copper_chain', 'copper_lantern', 'copper_torch', 'copper_chest'],
}

// Ids people commonly guess that do not exist in 1.21.1 (validated as absent).
const COMMON_NONEXISTENT = [
  'stone_wall', 'smooth_stone_stairs', 'smooth_stone_wall', 'quartz_wall', 'purpur_wall',
  'polished_andesite_wall', 'polished_diorite_wall', 'polished_granite_wall', 'cut_sandstone_stairs',
  'smooth_sandstone_wall', 'prismarine_brick_wall', 'dark_prismarine_wall', 'deepslate_stairs',
  'deepslate_tile_fence', 'calcite_stairs', 'dripstone_stairs', 'packed_mud_stairs', 'end_stone_stairs',
  'white_concrete_stairs', 'white_terracotta_stairs', 'white_wool_stairs', 'terracotta_stairs',
  'oak_wall', 'oak_planks_wall', 'cut_copper_wall', 'copper_stairs', 'bamboo_mosaic_wall', 'bamboo_wood',
  'quartz_brick_stairs', 'stone_brick_fence', 'brick_fence', 'stone_brick_button', 'basalt_stairs',
]

// Field order in the JSON output.
const ID_FIELDS = [
  'block', 'planks', 'log', 'wood', 'stripped_log', 'stripped_wood', 'leaves', 'sapling',
  'stairs', 'slab', 'wall', 'fence', 'fence_gate', 'door', 'trapdoor', 'button', 'pressure_plate',
  'sign', 'wall_sign', 'hanging_sign', 'wall_hanging_sign',
  'pillar', 'chiseled', 'cracked', 'mossy', 'polished', 'smooth', 'cut', 'bricks', 'tiles',
  'cobbled', 'mosaic', 'grate', 'bulb', 'bars',
  'carpet', 'pane', 'glass', 'concrete', 'concrete_powder', 'terracotta', 'glazed_terracotta', 'wool',
  'candle', 'banner', 'bed',
]
const META_FIELDS = ['kind', 'group', 'color', 'oxidation', 'waxed']
const SHAPE_FIELDS = ['stairs', 'slab', 'wall', 'fence', 'fence_gate', 'door', 'trapdoor', 'button', 'pressure_plate']
const SIGN_FIELDS = ['sign', 'wall_sign', 'hanging_sign', 'wall_hanging_sign']
const WOOD_FIELDS = ['planks', 'log', 'wood', 'stripped_log', 'stripped_wood', 'leaves', 'sapling']
const LINK_FIELDS = ['pillar', 'chiseled', 'cracked', 'mossy', 'polished', 'smooth', 'cut', 'bricks', 'tiles', 'cobbled', 'mosaic', 'grate', 'bulb', 'bars']
const COLOR_LINK_FIELDS = ['carpet', 'pane', 'glass', 'concrete', 'concrete_powder', 'terracotta', 'glazed_terracotta', 'wool', 'candle', 'banner', 'bed']
const KINDS = ['stone', 'wood', 'metal', 'earth', 'nether', 'end', 'ocean', 'decorative']
const SUBSTITUTE_SHAPES = ['stairs', 'slab', 'wall']
const SUBSTITUTE_COUNT = 3
const TEXTURE_WEIGHT = 0.35 // ΔE units per unit of L* standard-deviation difference
const SAME_GROUP_BONUS = 6 // ΔE units
const KIND_PENALTY = { wood: 5, metal: 6 } // ΔE units when a wood/metal candidate stands in for another kind
const MAX_SUBSTITUTE_DE = 18 // colour-ranked picks further than this are not offered

// Property names a shape variant must expose in its blockstate.
const SHAPE_PROPERTY_CHECKS = {
  stairs: ['shape', 'half', 'facing'],
  slab: ['type'],
  wall: ['up', 'north'],
  fence: ['north'],
  fence_gate: ['in_wall', 'open'],
  door: ['hinge', 'half', 'open'],
  trapdoor: ['half', 'open', 'facing'],
  button: ['face', 'powered'],
  pressure_plate: [['powered', 'power']],
  log: ['axis'],
  wood: ['axis'],
  stripped_log: ['axis'],
  stripped_wood: ['axis'],
  pillar: ['axis'],
  pane: ['north'],
}

// ---------------------------------------------------------------------------
// Pack loading
// ---------------------------------------------------------------------------

function loadPack(packDir) {
  const assets = JSON.parse(fs.readFileSync(path.join(packDir, 'assets.json'), 'utf8'))
  const atlas = decodePng(fs.readFileSync(path.join(packDir, 'atlas.png')))
  return { ...assets, atlas, ids: new Set(Object.keys(assets.blockstates)) }
}

function decodePng(buffer) {
  const signature = '89504e470d0a1a0a'
  if (buffer.subarray(0, 8).toString('hex') !== signature) throw new Error('atlas.png is not a PNG')
  let offset = 8
  let header
  const chunks = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('latin1', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9], interlace: data[12] }
    } else if (type === 'IDAT') {
      chunks.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }
  if (!header || header.bitDepth !== 8 || header.colorType !== 6 || header.interlace !== 0) {
    throw new Error('atlas.png must be 8-bit RGBA, non-interlaced')
  }
  const { width, height } = header
  const raw = zlib.inflateSync(Buffer.concat(chunks))
  const bpp = 4
  const stride = width * bpp
  const pixels = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    const line = y * (stride + 1) + 1
    const row = y * stride
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? pixels[row + x - bpp] : 0
      const up = y > 0 ? pixels[row - stride + x] : 0
      const upLeft = x >= bpp && y > 0 ? pixels[row - stride + x - bpp] : 0
      let value = raw[line + x]
      if (filter === 1) value += left
      else if (filter === 2) value += up
      else if (filter === 3) value += (left + up) >> 1
      else if (filter === 4) {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter ${filter}`)
      }
      pixels[row + x] = value & 255
    }
  }
  return { width, height, pixels }
}

// ---------------------------------------------------------------------------
// Colour statistics
// ---------------------------------------------------------------------------

const srgbToLinear = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const linearToSrgb = (v) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, c)) * 255)
}

function linearToLab([r, g, b]) {
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

// CIEDE2000 colour difference.
function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cbar = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)))
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const hue = (a, b) => {
    if (a === 0 && b === 0) return 0
    const h = Math.atan2(b, a) / rad
    return h < 0 ? h + 360 : h
  }
  const h1p = hue(a1p, b1)
  const h2p = hue(a2p, b2)
  const dLp = L2 - L1
  const dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad)
  const Lbarp = (L1 + L2) / 2
  const Cbarp = (C1p + C2p) / 2
  let hbarp = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbarp += h1p + h2p < 360 ? 360 : -360
    hbarp /= 2
  }
  const T = 1 - 0.17 * Math.cos((hbarp - 30) * rad) + 0.24 * Math.cos(2 * hbarp * rad)
    + 0.32 * Math.cos((3 * hbarp + 6) * rad) - 0.2 * Math.cos((4 * hbarp - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2)
  const Sc = 1 + 0.045 * Cbarp
  const Sh = 1 + 0.015 * Cbarp * T
  const Rt = -Math.sin(2 * dTheta * rad) * Rc
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))
}

function createColorStats(pack) {
  const cache = new Map()
  const stripNs = (name) => name.replace(/^minecraft:/, '')

  function firstModel(id) {
    const state = pack.blockstates[id]
    let apply
    if (state.variants) {
      const keys = Object.keys(state.variants)
      const key = keys.find((k) => k === '' || k.includes('axis=y')) ?? keys[0]
      apply = state.variants[key]
    } else {
      apply = state.multipart[0].apply
    }
    if (Array.isArray(apply)) apply = apply[0]
    return stripNs(apply.model)
  }

  function resolveModel(name) {
    const textures = {}
    let elements
    let current = name
    for (let depth = 0; current && depth < 16; depth += 1) {
      const model = pack.models[current]
      if (!model) break
      for (const [key, value] of Object.entries(model.textures ?? {})) {
        if (!(key in textures)) textures[key] = value
      }
      if (!elements && model.elements) elements = model.elements
      current = model.parent ? stripNs(model.parent) : undefined
    }
    const lookup = (ref) => {
      let value = ref
      for (let depth = 0; value?.startsWith('#') && depth < 16; depth += 1) value = textures[value.slice(1)]
      return value && !value.startsWith('#') ? stripNs(value) : undefined
    }
    return { textures, elements, lookup }
  }

  function faceTextures(id) {
    const { textures, elements, lookup } = resolveModel(firstModel(id))
    const faces = []
    for (const element of elements ?? []) {
      const size = element.to.map((v, i) => Math.abs(v - element.from[i]))
      for (const [dir, face] of Object.entries(element.faces ?? {})) {
        const texture = lookup(face.texture)
        if (!texture) continue
        const area = dir === 'up' || dir === 'down' ? size[0] * size[2] : dir === 'north' || dir === 'south' ? size[0] * size[1] : size[1] * size[2]
        faces.push({ texture, weight: Math.max(area, 1) })
      }
    }
    if (faces.length === 0) {
      const particle = lookup(textures.particle ?? '')
      if (particle) faces.push({ texture: particle, weight: 1 })
    }
    return faces
  }

  function textureSamples(texture) {
    const rect = pack.textures[texture]
    if (!rect) return []
    const [x0, y0, w, h] = rect
    const frameHeight = h > w && h % w === 0 ? w : h // animated strips: first frame only
    const samples = []
    const { width, pixels } = pack.atlas
    for (let y = y0; y < y0 + frameHeight; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) {
        const i = (y * width + x) * 4
        const alpha = pixels[i + 3] / 255
        if (alpha === 0) continue
        samples.push({ rgb: [srgbToLinear(pixels[i]), srgbToLinear(pixels[i + 1]), srgbToLinear(pixels[i + 2])], alpha })
      }
    }
    return samples
  }

  return function stats(id) {
    if (cache.has(id)) return cache.get(id)
    let sum = [0, 0, 0]
    let total = 0
    const lightness = []
    for (const { texture, weight } of faceTextures(id)) {
      const samples = textureSamples(texture)
      if (samples.length === 0) continue
      const w = weight / samples.length
      for (const { rgb, alpha } of samples) {
        sum = sum.map((v, i) => v + rgb[i] * alpha * w)
        total += alpha * w
        lightness.push([linearToLab(rgb)[0], alpha * w])
      }
    }
    if (total === 0) {
      cache.set(id, undefined)
      return undefined
    }
    const linear = sum.map((v) => v / total)
    const lab = linearToLab(linear)
    const meanL = lightness.reduce((acc, [l, w]) => acc + l * w, 0) / total
    const sigmaL = Math.sqrt(lightness.reduce((acc, [l, w]) => acc + w * (l - meanL) ** 2, 0) / total)
    const hex = `#${linear.map((v) => linearToSrgb(v).toString(16).padStart(2, '0')).join('')}`
    const result = { hex, lab, sigmaL }
    cache.set(id, result)
    return result
  }
}

// ---------------------------------------------------------------------------
// Family derivation
// ---------------------------------------------------------------------------

function deriveFamilies(pack) {
  const has = (id) => id != null && pack.ids.has(id)
  const families = {}
  const diagnostics = { unassignedShapes: [], ignoredShapes: [], aliasedStems: [] }
  const ensure = (name) => (families[name] ??= {})

  // 1. Shape variants by suffix.
  const shapeIds = new Set()
  for (const id of [...pack.ids].sort()) {
    const suffix = SHAPE_SUFFIXES.find((s) => id.endsWith(`_${s}`))
    if (!suffix) continue
    if (IGNORED_SHAPES[id]) {
      diagnostics.ignoredShapes.push(id)
      continue
    }
    shapeIds.add(id)
    let stem = id.slice(0, -(suffix.length + 1))
    if (STEM_ALIASES[stem]) {
      diagnostics.aliasedStems.push(`${id} -> ${STEM_ALIASES[stem]}`)
      stem = STEM_ALIASES[stem]
    }
    ensure(stem)[suffix] = id
  }

  // 2. The full block for each stem: <stem>_planks, <stem>s, <stem>_block, <stem>.
  for (const [name, family] of Object.entries(families)) {
    const block = [`${name}_planks`, `${name}s`, `${name}_block`, name].find(has)
    if (!block) throw new Error(`No full block found for shape stem "${name}"`)
    family.block = block
  }

  // 3. Wood types are every <wood>_planks.
  const woods = [...pack.ids].filter((id) => id.endsWith('_planks')).map((id) => id.slice(0, -'_planks'.length)).sort()
  for (const wood of woods) {
    const family = ensure(wood)
    const overrides = WOOD_OVERRIDES[wood] ?? {}
    const pick = (field, ...candidates) => {
      const value = field in overrides ? overrides[field] : candidates.find(has)
      if (value != null) {
        if (!has(value)) throw new Error(`Wood override ${wood}.${field} = ${value} is not in the pack`)
        family[field] = value
      }
    }
    family.block = `${wood}_planks`
    pick('planks', `${wood}_planks`)
    pick('log', `${wood}_log`, `${wood}_stem`)
    pick('wood', `${wood}_wood`, `${wood}_hyphae`)
    pick('stripped_log', `stripped_${wood}_log`, `stripped_${wood}_stem`)
    pick('stripped_wood', `stripped_${wood}_wood`, `stripped_${wood}_hyphae`)
    pick('leaves', `${wood}_leaves`)
    pick('sapling', `${wood}_sapling`)
    if (overrides.mosaic) pick('mosaic')
    family.kind = 'wood'
    family.group = wood
  }

  // 4. Shape-family metadata.
  for (const [name, family] of Object.entries(families)) {
    if (family.kind) continue
    const copper = parseCopperName(name)
    if (copper) continue
    const meta = SHAPE_FAMILY_META[name]
    if (!meta) throw new Error(`Shape family "${name}" (block ${family.block}) has no SHAPE_FAMILY_META entry`)
    const [kind, group, parent] = meta
    Object.assign(family, { kind, group })
    if (parent) family.parent = parent
  }

  // 5. Copper oxidation ladder: copper / cut_copper for every stage, waxed and not.
  for (const waxed of ['', 'waxed_']) {
    for (const stage of COPPER_STAGES) {
      const base = `${waxed}${stage}copper`
      const cut = `${waxed}${stage}cut_copper`
      const links = {
        chiseled: `${waxed}${stage}chiseled_copper`,
        cut: `${waxed}${stage}cut_copper`,
        grate: `${waxed}${stage}copper_grate`,
        bulb: `${waxed}${stage}copper_bulb`,
      }
      for (const name of [base, cut]) {
        const family = ensure(name)
        family.block ??= name === base ? (stage === '' ? `${waxed}copper_block` : base) : cut
        Object.assign(family, { kind: 'metal', group: base, oxidation: COPPER_OXIDATION[stage], waxed: waxed !== '' })
        for (const [field, id] of Object.entries(links)) {
          if (has(id) && id !== family.block) family[field] = id
        }
        if (name === base) family.parent = cut
      }
    }
  }

  // 6. Curated full blocks without shapes.
  for (const [name, [block, kind, group, parent, extra]] of Object.entries(STANDALONE_FAMILIES)) {
    if (families[name]) throw new Error(`Standalone family "${name}" collides with a derived family`)
    families[name] = { block, kind, group, ...(parent ? { parent } : {}), ...(extra ?? {}) }
  }

  for (const [name, links] of Object.entries(FAMILY_EXTRA_LINKS)) {
    if (!families[name]) throw new Error(`FAMILY_EXTRA_LINKS names unknown family "${name}"`)
    Object.assign(families[name], links)
  }

  // 7. Colour families (concrete, terracotta, wool, stained glass) + colour section.
  const colorSection = {}
  for (const color of DYE_COLORS) {
    const set = {
      wool: `${color}_wool`,
      carpet: `${color}_carpet`,
      concrete: `${color}_concrete`,
      concrete_powder: `${color}_concrete_powder`,
      terracotta: `${color}_terracotta`,
      glazed_terracotta: `${color}_glazed_terracotta`,
      stained_glass: `${color}_stained_glass`,
      stained_glass_pane: `${color}_stained_glass_pane`,
      candle: `${color}_candle`,
      candle_cake: `${color}_candle_cake`,
      banner: `${color}_banner`,
      wall_banner: `${color}_wall_banner`,
      bed: `${color}_bed`,
      shulker_box: `${color}_shulker_box`,
    }
    colorSection[color] = set
    const links = {
      carpet: set.carpet,
      pane: set.stained_glass_pane,
      glass: set.stained_glass,
      concrete: set.concrete,
      concrete_powder: set.concrete_powder,
      terracotta: set.terracotta,
      glazed_terracotta: set.glazed_terracotta,
      wool: set.wool,
      candle: set.candle,
      banner: set.banner,
      bed: set.bed,
    }
    const lines = { concrete: set.concrete, terracotta: set.terracotta, wool: set.wool, glass: set.stained_glass }
    for (const [group, block] of Object.entries(lines)) {
      const family = { block, kind: 'decorative', group, color }
      for (const [field, id] of Object.entries(links)) if (id !== block) family[field] = id
      families[block] = family
    }
  }

  // 8. Material-line links (chiseled, polished, bricks, ...) from names, shared within a group.
  const exactLinks = (block) => {
    const base = block.replace(/_block$/, '')
    // A chiseled/cracked/mossy block is itself a variant: `chiseled_tuff_bricks` is not the bricks of chiseled_tuff.
    const derived = /^(chiseled|cracked|mossy)_/.test(block)
    const candidates = {
      pillar: [`${base}_pillar`],
      chiseled: [`chiseled_${block}`, `chiseled_${base}`],
      cracked: [`cracked_${block}`],
      mossy: [`mossy_${block}`],
      polished: [`polished_${block}`],
      smooth: [`smooth_${base}`],
      cut: [`cut_${base}`],
      bricks: [`${base}_bricks`],
      tiles: [`${base}_tiles`],
    }
    const out = {}
    for (const [field, list] of Object.entries(candidates)) {
      if (derived && !['chiseled', 'cracked', 'mossy'].includes(field)) continue
      const id = list.find(has)
      if (id && id !== block) out[field] = id
    }
    return out
  }
  const NON_INHERITED = new Set(['cracked', 'mossy'])
  const groupLinks = {}
  const ordered = Object.entries(families).sort(([a, fa], [b, fb]) => (a === fa.group ? -1 : 0) - (b === fb.group ? -1 : 0))
  for (const [, family] of ordered) {
    if (family.color || family.oxidation || family.kind === 'wood') continue
    const links = (groupLinks[family.group] ??= { ...(GROUP_EXTRA_LINKS[family.group] ?? {}) })
    for (const [field, id] of Object.entries(exactLinks(family.block))) {
      if (!NON_INHERITED.has(field)) links[field] ??= id
    }
  }
  for (const family of Object.values(families)) {
    if (family.color || family.oxidation) continue
    const own = exactLinks(family.block)
    const shared = family.kind === 'wood' ? {} : groupLinks[family.group] ?? {}
    for (const field of LINK_FIELDS) {
      const id = own[field] ?? (NON_INHERITED.has(field) ? undefined : shared[field])
      if (id && id !== family.block && family[field] == null) family[field] = id
    }
  }

  // Coverage: every shape id must have landed in some family.
  const assigned = new Set(Object.values(families).flatMap((f) => SHAPE_FIELDS.concat(SIGN_FIELDS).map((k) => f[k]).filter(Boolean)))
  diagnostics.unassignedShapes = [...shapeIds].filter((id) => !assigned.has(id))

  return { families, colorSection, diagnostics }
}

function parseCopperName(name) {
  const match = /^(waxed_)?(exposed_|weathered_|oxidized_)?(cut_)?copper$/.exec(name)
  return match ? { waxed: Boolean(match[1]), stage: match[2] ?? '', cut: Boolean(match[3]) } : undefined
}

// ---------------------------------------------------------------------------
// Substitutes
// ---------------------------------------------------------------------------

function computeSubstitutes(families, stats) {
  const report = {}
  for (const [name, family] of Object.entries(families)) {
    if (family.kind === 'wood' || family.group === 'glass') continue
    const target = stats(family.block)
    if (!target) continue
    for (const shape of SUBSTITUTE_SHAPES) {
      if (family[shape]) continue
      const picks = []
      const parent = family.parent ? families[family.parent] : undefined
      if (parent?.[shape]) picks.push({ id: parent[shape], family: family.parent, reason: 'parent' })
      const ranked = []
      for (const [candidateName, candidate] of Object.entries(families)) {
        if (candidateName === name || !candidate[shape]) continue
        if (candidate.oxidation && candidate.waxed !== Boolean(family.waxed)) continue
        const s = stats(candidate.block)
        if (!s) continue
        const dE = deltaE2000(target.lab, s.lab)
        if (dE > MAX_SUBSTITUTE_DE) continue
        const sameGroup = candidate.group === family.group
        const kindPenalty = candidate.kind !== family.kind ? KIND_PENALTY[candidate.kind] ?? 0 : 0
        const score = dE + TEXTURE_WEIGHT * Math.abs(target.sigmaL - s.sigmaL) - (sameGroup ? SAME_GROUP_BONUS : 0) + kindPenalty
        ranked.push({ id: candidate[shape], family: candidateName, dE, score, reason: candidate.group === family.group ? 'group' : 'color' })
      }
      ranked.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
      if (picks.length === 0 && ranked.length === 0) {
        // Nothing close enough: remember the nearest candidate for the docs only.
        let closest
        for (const [candidateName, candidate] of Object.entries(families)) {
          if (candidateName === name || !candidate[shape] || (candidate.oxidation && candidate.waxed !== Boolean(family.waxed))) continue
          const dE = deltaE2000(target.lab, stats(candidate.block).lab)
          if (!closest || dE < closest.dE) closest = { id: candidate[shape], dE }
        }
        if (closest) (report[name] ??= {})[shape] = { none: true, closest }
        continue
      }
      for (const entry of ranked) {
        if (picks.length >= SUBSTITUTE_COUNT) break
        if (!picks.some((p) => p.id === entry.id)) picks.push(entry)
      }
      for (const pick of picks) pick.dE ??= deltaE2000(target.lab, stats(families[pick.family].block).lab)
      if (picks.length) {
        family.substitutes ??= {}
        family.substitutes[shape] = picks.map((p) => p.id)
        ;(report[name] ??= {})[shape] = picks
      }
    }
  }
  return report
}

// ---------------------------------------------------------------------------
// Output shaping & validation
// ---------------------------------------------------------------------------

const withNs = (id) => (id.startsWith(NS) ? id : `${NS}${id}`)
const short = (id) => id.replace(/^minecraft:/, '')

function finalize(families, colorSection, stats) {
  const out = {}
  const sortedNames = Object.keys(families).sort((a, b) => {
    const ka = KINDS.indexOf(families[a].kind)
    const kb = KINDS.indexOf(families[b].kind)
    return ka - kb || families[a].group.localeCompare(families[b].group) || (a === families[a].group ? -1 : 0) - (b === families[b].group ? -1 : 0) || a.localeCompare(b)
  })
  for (const name of sortedNames) {
    const family = families[name]
    const entry = {}
    for (const field of META_FIELDS) if (family[field] != null) entry[field] = family[field]
    for (const field of ID_FIELDS) if (family[field] != null) entry[field] = withNs(family[field])
    const s = stats(family.block)
    if (s) entry.avg_color = s.hex
    if (family.substitutes) {
      entry.substitutes = {}
      for (const shape of SUBSTITUTE_SHAPES) {
        if (family.substitutes[shape]) entry.substitutes[shape] = family.substitutes[shape].map(withNs)
      }
    }
    out[name] = entry
  }
  out.color = {}
  for (const color of DYE_COLORS) {
    out.color[color] = Object.fromEntries(Object.entries(colorSection[color]).map(([k, v]) => [k, withNs(v)]))
  }
  return out
}

function collectIds(materials) {
  const ids = []
  const walk = (value, where) => {
    if (typeof value === 'string') {
      if (value.startsWith(NS)) ids.push({ id: value, where })
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${where}[${i}]`))
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, where ? `${where}.${k}` : k)
    }
  }
  walk(materials, '')
  return ids
}

function blockstateProperties(state) {
  const props = new Set()
  if (state.variants) {
    for (const key of Object.keys(state.variants)) {
      for (const pair of key.split(',')) if (pair.includes('=')) props.add(pair.split('=')[0])
    }
  }
  const addWhen = (when) => {
    if (!when) return
    if (when.OR) when.OR.forEach(addWhen)
    else if (when.AND) when.AND.forEach(addWhen)
    else Object.keys(when).forEach((k) => props.add(k))
  }
  for (const part of state.multipart ?? []) addWhen(part.when)
  return props
}

function validate(materials, pack, vanillaDir) {
  const errors = []
  const ids = collectIds(materials)
  for (const { id, where } of ids) {
    if (!pack.ids.has(short(id))) errors.push(`missing from default pack: ${id} (${where})`)
    if (vanillaDir && !fs.existsSync(path.join(vanillaDir, 'blockstates', `${short(id)}.json`))) {
      errors.push(`missing from vanilla blockstates: ${id} (${where})`)
    }
  }
  for (const [name, family] of Object.entries(materials)) {
    if (name === 'color') continue
    if (!KINDS.includes(family.kind)) errors.push(`${name}: unknown kind "${family.kind}"`)
    if (!family.block) errors.push(`${name}: no block`)
    for (const [field, required] of Object.entries(SHAPE_PROPERTY_CHECKS)) {
      const id = family[field]
      if (!id || !pack.ids.has(short(id))) continue
      const props = blockstateProperties(pack.blockstates[short(id)])
      for (const prop of required) {
        const options = Array.isArray(prop) ? prop : [prop]
        if (!options.some((p) => props.has(p))) errors.push(`${name}.${field} = ${id} has no "${options.join('|')}" property`)
      }
    }
    if (family.wall && !blockstateProperties(pack.blockstates[short(family.wall)]).has('up')) errors.push(`${name}.wall is not a wall`)
    if (family.fence && blockstateProperties(pack.blockstates[short(family.fence)]).has('up')) errors.push(`${name}.fence is a wall`)
    for (const field of SIGN_FIELDS) {
      const id = family[field]
      if (id && !short(id).endsWith(`_${field}`)) errors.push(`${name}.${field} = ${id} has the wrong suffix`)
      if (id && field === 'sign' && /_(wall|hanging)_sign$/.test(short(id))) errors.push(`${name}.sign = ${id} is not a standing sign`)
    }
    for (const [shape, list] of Object.entries(family.substitutes ?? {})) {
      for (const id of list) if (!short(id).endsWith(`_${shape}`)) errors.push(`${name}.substitutes.${shape} has non-${shape} ${id}`)
      if (family[shape]) errors.push(`${name}.substitutes.${shape} present although ${shape} exists`)
    }
  }
  return { errors, idCount: ids.length, uniqueIds: new Set(ids.map((x) => x.id)).size }
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

function renderMarkdown(materials, report, ctx) {
  const lines = []
  const push = (...rows) => lines.push(...rows)
  const names = Object.keys(materials).filter((n) => n !== 'color')
  const families = Object.fromEntries(names.map((n) => [n, materials[n]]))
  const tick = (v) => (v ? '✓' : '–')
  const code = (v) => (v ? `\`${short(v)}\`` : '–')
  const table = (headers, rows) => {
    push(`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`)
    for (const row of rows) push(`| ${row.join(' | ')} |`)
    push('')
  }
  const nonColor = names.filter((n) => !families[n].color)
  const byKind = (kind) => nonColor.filter((n) => families[n].kind === kind)

  push(
    '<!--',
    'Generated by scripts/dev/gen-materials.mjs from the Lodestone default pack.',
    'Do not edit this file directly. Run: node scripts/dev/gen-materials.mjs',
    '-->',
    '',
    '# Material Families',
    '',
    `Machine-readable table: \`scripts/lib/data/materials.json\`. Source: Lodestone \`${ctx.lodestoneVersion}\` default pack (vanilla 1.21.1 block set, ${ctx.packIds} block ids). Every id below exists in the pack; the generator fails otherwise.`,
    '',
    `- Families: ${names.length} (${nonColor.length} materials + ${names.length - nonColor.length} colour-line families); dye colours: ${DYE_COLORS.length}`,
    `- Distinct block ids referenced: ${ctx.uniqueIds}`,
    `- Kinds: ${KINDS.map((k) => `${k} ${names.filter((n) => families[n].kind === k).length}`).join(', ')}`,
    '',
    '## Using the JSON',
    '',
    '```js',
    "import fs from 'node:fs'",
    "const materials = JSON.parse(fs.readFileSync(new URL('../lib/data/materials.json', import.meta.url), 'utf8'))",
    "const fam = materials.stone_brick",
    "fam.stairs                          // 'minecraft:stone_brick_stairs'",
    "materials.quartz.stairs             // 'minecraft:quartz_stairs' (block is quartz_block)",
    "materials.packed_mud.stairs         // undefined -> materials.packed_mud.substitutes.stairs[0]",
    "materials.color.red.glazed_terracotta // 'minecraft:red_glazed_terracotta'",
    '```',
    '',
    '- Top-level keys are family names, plus one reserved key, `color` (the 16 dye colours). Skip `color` when iterating families.',
    '- Family names are material stems: shape stems for shaped materials (`stone_brick`, `deepslate_tile`, `brick`, `nether_brick`, `quartz`, `purpur`, `iron`), the wood type for woods (`oak`, `crimson`), `<stage>copper` / `<stage>cut_copper` for copper, the block id for colour lines (`red_concrete`) and a short name for other full blocks (`moss`, `dripstone`, `snow`, `netherite`).',
    '- Id fields hold full `minecraft:` ids and appear only when the block exists. `block` is always the full cube of the material (planks for woods).',
    '- Meta fields (plain strings): `kind` (one of ' + KINDS.map((k) => `\`${k}\``).join(', ') + '), `group` (material line; it names the base family when one exists, e.g. `stone_brick.group = "stone"`), `color` (colour lines), `oxidation` (`none|exposed|weathered|oxidized`) and boolean `waxed` (copper), `avg_color` (`#rrggbb` average of the block texture as rendered by the pack atlas).',
    '- Shape fields: `stairs`, `slab`, `wall`, `fence`, `fence_gate`, `door`, `trapdoor`, `button`, `pressure_plate`, `sign`, `wall_sign`, `hanging_sign`, `wall_hanging_sign`. These are strictly the material\'s own variants (no borrowed ids).',
    '- Wood fields: `planks`, `log`, `wood`, `stripped_log`, `stripped_wood`, `leaves`, `sapling` (crimson/warped use stem/hyphae, wart blocks as leaves and fungi as saplings; bamboo uses `bamboo_block`).',
    '- Material-line links: `pillar`, `chiseled`, `cracked`, `mossy`, `polished`, `smooth`, `cut`, `bricks`, `tiles`, plus `cobbled` (stone/deepslate), `mosaic` (bamboo), `grate`/`bulb` (copper), `bars` (iron). `cracked`/`mossy` are exact (`cracked_<block>`); the others are shared by the whole group, so `cobblestone.bricks` is `stone_bricks` and `deepslate_tile.polished` is `polished_deepslate`.',
    '- Colour-line families also link same-colour blocks: `carpet`, `pane`, `glass`, `concrete`, `concrete_powder`, `terracotta`, `glazed_terracotta`, `wool`, `candle`, `banner`, `bed`.',
    '- `substitutes.{stairs,slab,wall}`: only for missing shapes; each list holds 1-3 ids **of that same shape** (so block states carry over), best first. See [Missing variants & substitutes](#missing-variants--substitutes).',
    '',
  )

  const shapeHeaders = ['Family', 'Block', 'Avg', 'stairs', 'slab', 'wall', 'fence', 'gate', 'door', 'trapdoor', 'button', 'plate']
  const shapeRow = (n) => {
    const f = families[n]
    return [`\`${n}\``, code(f.block), `\`${f.avg_color ?? '?'}\``, ...SHAPE_FIELDS.map((k) => (f[k] && k === 'pressure_plate' && !short(f[k]).startsWith(n) ? code(f[k]) : tick(f[k])))]
  }

  push('## Families by kind', '', '✓ = the variant exists (id follows the usual `<stem>_<shape>` pattern); irregular ids are spelled out. The 11 wood types are in [Wood types](#wood-types), copper in [Copper ladder](#copper-ladder) and colour lines in [Colours](#colours).', '')
  for (const kind of KINDS) {
    const list = byKind(kind).filter((n) => !(kind === 'wood' && families[n].log) && !(kind === 'metal' && families[n].oxidation))
    if (list.length === 0) continue
    push(`### ${kind}`, '')
    table(shapeHeaders, list.map(shapeRow))
  }

  push('## Wood types', '', 'Every wood has stairs, slab, fence, fence_gate, door, trapdoor, button, pressure_plate, sign, wall_sign, hanging_sign and wall_hanging_sign named `<wood>_<shape>`. No wood has a wall. Crimson/warped `leaves` are the wart blocks and `sapling` the fungi (vanilla tags do not call them leaves/saplings). Bamboo has no `wood`/`stripped_wood`, leaves or sapling (`bamboo_sapling` is the shoot of the `bamboo` plant). Azalea (`azalea_leaves`, `flowering_azalea_leaves`, `azalea`, `flowering_azalea`) grows oak-log trees and is not a wood type.', '')
  const woods = nonColor.filter((n) => families[n].kind === 'wood' && families[n].log)
  table(['Wood', 'Avg (planks)', 'planks', 'log', 'wood', 'stripped_log', 'stripped_wood', 'leaves', 'sapling', 'shapes + signs'], woods.map((n) => {
    const f = families[n]
    const complete = SHAPE_FIELDS.filter((k) => !['wall'].includes(k)).every((k) => f[k]) && SIGN_FIELDS.every((k) => f[k])
    return [`\`${n}\``, `\`${f.avg_color}\``, ...WOOD_FIELDS.map((k) => code(f[k])), complete ? '✓ all 12' : 'partial']
  }))

  push('## Copper ladder', '', 'Copper blocks oxidise (none → exposed → weathered → oxidized) unless waxed; waxed ids look identical and never change. In structure files use the `waxed_` ids when the look must stay fixed. Only cut copper has stairs/slabs; no copper has walls or fences.', '')
  const copperRows = []
  for (const waxed of [false, true]) {
    for (const stage of COPPER_STAGES) {
      const base = families[`${waxed ? 'waxed_' : ''}${stage}copper`]
      const cut = families[`${waxed ? 'waxed_' : ''}${stage}cut_copper`]
      copperRows.push([`\`${waxed ? 'waxed_' : ''}${stage}copper\``, `\`${base.avg_color}\``, code(base.block), code(base.cut), code(cut.stairs), code(cut.slab), code(base.chiseled), code(base.grate), code(base.bulb), code(base.door), code(base.trapdoor)])
    }
  }
  table(['Family', 'Avg', 'block', 'cut', 'cut stairs', 'cut slab', 'chiseled', 'grate', 'bulb', 'door', 'trapdoor'], copperRows)

  push('## Material-line links', '', 'Links shown for each non-wood, non-colour family that has at least one. Links are ids of other full blocks in the same material line.', '')
  const linkFields = LINK_FIELDS.filter((k) => !['mosaic', 'grate', 'bulb'].includes(k))
  const linkRows = nonColor
    .filter((n) => !families[n].oxidation && linkFields.some((k) => families[n][k]))
    .map((n) => [`\`${n}\``, ...linkFields.map((k) => code(families[n][k]))])
  table(['Family', ...linkFields], linkRows)

  push('## Colours', '', `All ${DYE_COLORS.length} dye colours have every variant below, named \`<color>_<variant>\` (\`materials.color.<color>.<variant>\`). Uncoloured counterparts: \`terracotta\`, \`glass\`, \`glass_pane\`, \`candle\`, \`candle_cake\`, \`shulker_box\` (there is no uncoloured wool, carpet, concrete, glazed terracotta, banner or bed).`, '')
  push(`Variants: ${Object.keys(materials.color.white).map((k) => `\`${k}\``).join(', ')}.`, '')
  push('Colour-line families (`<color>_concrete`, `<color>_terracotta`, `<color>_wool`, `<color>_stained_glass`) carry `kind: "decorative"`, the `color` and same-colour links. Average texture colours:', '')
  table(['Colour', 'wool', 'concrete', 'concrete_powder', 'terracotta', 'glazed_terracotta', 'stained_glass'], DYE_COLORS.map((c) => [
    `\`${c}\``,
    `\`${families[`${c}_wool`].avg_color}\``,
    `\`${families[`${c}_concrete`].avg_color}\``,
    `\`${ctx.stats(`${c}_concrete_powder`).hex}\``,
    `\`${families[`${c}_terracotta`].avg_color}\``,
    `\`${ctx.stats(`${c}_glazed_terracotta`).hex}\``,
    `\`${families[`${c}_stained_glass`].avg_color}\``,
  ]))

  // Missing variants & substitutes.
  push('## Missing variants & substitutes', '')
  const withoutWall = nonColor.filter((n) => families[n].stairs && !families[n].wall && families[n].kind !== 'wood' && !families[n].oxidation)
  const slabOnly = nonColor.filter((n) => families[n].slab && !families[n].stairs)
  const nonWoodFence = nonColor.filter((n) => families[n].fence && families[n].kind !== 'wood')
  const nonWoodDoor = nonColor.filter((n) => families[n].door && families[n].kind !== 'wood' && !families[n].oxidation)
  const buttons = nonColor.filter((n) => families[n].button && families[n].kind !== 'wood')
  const plates = nonColor.filter((n) => families[n].pressure_plate && families[n].kind !== 'wood')
  push(
    '### Rules of thumb',
    '',
    '- **Slab only, no stairs:** ' + slabOnly.map((n) => `\`${n}\``).join(', ') + '. `smooth_stone_stairs` does not exist: use `stone_stairs` (closest match) or stack `smooth_stone_slab` as half-steps. Cut sandstone: use `smooth_sandstone_stairs`.',
    '- **Stairs + slab but no wall:** ' + withoutWall.map((n) => `\`${n}\``).join(', ') + '. Note there is no `stone_wall` (use `cobblestone_wall`, `andesite_wall` or `stone_brick_wall`) and no `quartz_wall`/`purpur_wall`/`polished_andesite_wall`; walls of the same group come first in `substitutes.wall`.',
    '- **Woods never have walls:** use the wood\'s `fence` (thin) or a column of `stripped_log`/`log` (full) instead; for a low parapet use the `slab` or the `trapdoor` on the wall top.',
    '- **Fences:** only woods and ' + nonWoodFence.map((n) => `\`${n}\``).join(', ') + ' (`nether_brick_fence`). No stone fences: e.g. there is no `deepslate_tile_fence`; use the family\'s `wall` (`deepslate_tile_wall`), or `iron_bars`/`chain` for a thin rail.',
    '- **Doors/trapdoors:** woods, ' + nonWoodDoor.map((n) => `\`${n}\``).join(', ') + ' and every copper family (`copper_door`, `exposed_copper_door`, ... incl. `waxed_*`; same for trapdoors). **Buttons:** woods, ' + buttons.map((n) => `\`${n}\``).join(', ') + '. **Pressure plates:** woods, ' + plates.map((n) => `\`${n}\` (${code(families[n].pressure_plate)})`).join(', ') + '.',
    '- **Full blocks with no shapes at all:** deepslate (use `cobbled_deepslate`/`polished_deepslate` shapes), packed mud (→ `mud_brick`), calcite, dripstone, basalt variants, end stone (→ `end_stone_brick`), chiseled/cracked variants (→ their parent line), every concrete, terracotta, wool and glass. Concrete, terracotta and wool have no stairs/slabs/walls in vanilla: pick a similar-colour stone family (tables below) or use carpets as 1/16 "slabs" for wool.',
    '- **Glass:** no stairs/slabs; use `pane`/`stained_glass_pane` for thin walls and trapdoors for sills.',
    '- **Copper:** only cut copper has stairs/slabs (no plain-copper stairs, no copper walls). Use the same stage\'s `cut_copper` shapes (`copper.substitutes.stairs[0]`).',
    '- **Legacy/ignored:** `petrified_oak_slab` (looks like `oak_slab`) is excluded; `infested_*` blocks look like their stone counterparts but are monster eggs, so they are never used as variants.',
    '',
    `Ranking: the parent line first (marked †, e.g. \`cracked_stone_bricks\` → \`stone_brick_*\`), then CIEDE2000 colour distance (ΔE) between average texture colours plus ${TEXTURE_WEIGHT} × the difference in texture contrast (σL*), with a ${SAME_GROUP_BONUS} ΔE bonus for the same material line and a penalty when wood (+${KIND_PENALTY.wood}) or metal (+${KIND_PENALTY.metal}) stands in for another kind. Colour-ranked picks with ΔE > ${MAX_SUBSTITUTE_DE} are not offered; such cells read "no close match" and the JSON has no list for that shape, so use the full block, a contrasting trim, or carpets instead. The ΔE shown is the plain colour distance to the family's block (≈2 barely noticeable, ≈5 similar, >10 clearly different). Waxed copper only substitutes for waxed copper and vice versa.`,
    '',
  )

  const subCell = (n, shape) => {
    const picks = report[n]?.[shape]
    if (!picks) return families[n][shape] ? `(${code(families[n][shape])})` : '–'
    if (picks.none) return `no close match (nearest \`${short(picks.closest.id)}\` ${picks.closest.dE.toFixed(1)})`
    return picks.map((p) => `\`${short(p.id)}\` ${p.dE.toFixed(1)}${p.reason === 'parent' ? ' †' : ''}`).join('<br>')
  }
  const subTable = (list) => table(['Family', 'Avg', 'stairs → substitutes (ΔE)', 'slab → substitutes (ΔE)', 'wall → substitutes (ΔE)'], list.map((n) => [`\`${n}\``, `\`${families[n].avg_color}\``, subCell(n, 'stairs'), subCell(n, 'slab'), subCell(n, 'wall')]))

  push('### Shaped materials missing a variant', '', 'An existing variant is shown in parentheses.', '')
  subTable(nonColor.filter((n) => report[n] && (families[n].stairs || families[n].slab) && !families[n].waxed))
  push('### Full blocks without shapes', '')
  subTable(nonColor.filter((n) => report[n] && !families[n].stairs && !families[n].slab && !families[n].waxed && n !== 'terracotta'))
  for (const group of ['concrete', 'terracotta', 'wool']) {
    push(`### ${group[0].toUpperCase()}${group.slice(1)}`, '')
    const list = (group === 'terracotta' ? ['terracotta'] : []).concat(DYE_COLORS.map((c) => `${c}_${group}`))
    subTable(list.filter((n) => report[n]))
  }
  push('Waxed copper families mirror the unwaxed rows (their substitutes are the waxed equivalents).', '')

  push('## Absent from this pack', '', 'The pack is the vanilla 1.21.1 block set; newer blocks are not available and are not in the table:', '')
  for (const [label, list] of Object.entries(KNOWN_NEWER_BLOCKS)) push(`- ${label}: ${list.map((id) => `\`${id}\``).join(', ')}`)
  push('', `Also absent in 1.21.1 itself (common guesses, verified missing by the generator): ${COMMON_NONEXISTENT.map((id) => `\`${id}\``).join(', ')}; likewise no concrete/terracotta/wool stairs, slabs or walls in any colour.`, '')
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(usage())
    return 0
  }
  const pack = loadPack(options.pack)
  const stats = createColorStats(pack)
  const { families, colorSection, diagnostics } = deriveFamilies(pack)
  const report = computeSubstitutes(families, stats)
  const materials = finalize(families, colorSection, stats)

  let lodestoneVersion = 'unknown'
  try {
    lodestoneVersion = JSON.parse(fs.readFileSync(path.join(options.pack, '..', '..', 'package.json'), 'utf8')).version
  } catch {
    // version is informational only
  }

  const { errors, idCount, uniqueIds } = validate(materials, pack, options.vanilla)
  for (const id of diagnostics.unassignedShapes) errors.push(`shape block not assigned to any family: ${id}`)
  for (const id of COMMON_NONEXISTENT) if (pack.ids.has(id)) errors.push(`COMMON_NONEXISTENT lists ${id}, but the pack has it`)
  const newer = Object.values(KNOWN_NEWER_BLOCKS).flat().filter((id) => pack.ids.has(id))
  if (newer.length) console.warn(`warning: pack now contains newer blocks; review the curated tables: ${newer.join(', ')}`)

  const json = `${JSON.stringify(materials, null, 2)}\n`
  const md = renderMarkdown(materials, report, { lodestoneVersion, packIds: pack.ids.size, uniqueIds, stats })

  const familyCount = Object.keys(materials).length - 1
  console.log(`families: ${familyCount}, dye colours: ${Object.keys(materials.color).length}, id references: ${idCount} (${uniqueIds} distinct)`)
  console.log(`aliased stems: ${diagnostics.aliasedStems.join('; ') || 'none'}; ignored: ${diagnostics.ignoredShapes.join(', ') || 'none'}`)
  const withSubs = Object.values(materials).filter((f) => f.substitutes).length
  const noMatch = Object.entries(report).flatMap(([n, r]) => Object.entries(r).filter(([, v]) => v.none).map(([shape]) => `${n}.${shape}`))
  console.log(`families with substitutes: ${withSubs}; shapes with no close match (ΔE > ${MAX_SUBSTITUTE_DE}): ${noMatch.length}`)
  if (errors.length) {
    console.error(`validation failed (${errors.length}):`)
    for (const error of errors) console.error(`  - ${error}`)
    return 1
  }
  console.log(`validation ok: every id exists in the default pack${options.vanilla ? ' and in vanilla blockstates' : ''}`)

  if (options.check) {
    const stale = [[OUT_JSON, json], [OUT_MD, md]].filter(([file, content]) => !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content)
    if (stale.length) {
      console.error(`stale outputs (run without --check): ${stale.map(([file]) => path.relative(SKILL_ROOT, file)).join(', ')}`)
      return 1
    }
    console.log('outputs are up to date')
    return 0
  }
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true })
  fs.writeFileSync(OUT_JSON, json)
  fs.writeFileSync(OUT_MD, md)
  console.log(`wrote ${path.relative(SKILL_ROOT, OUT_JSON)} and ${path.relative(SKILL_ROOT, OUT_MD)}`)
  return 0
}

try {
  process.exitCode = main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
