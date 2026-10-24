// Material families: "give me the stairs / slab / wall / fence ... of material X".
//   const m = kit.material('stone_brick')   → { block, stairs, slab, wall, ... }
//   kit.material('spruce').stairs            → 'minecraft:spruce_stairs'
// Uses scripts/lib/data/materials.json when present (generated from the pack by
// scripts/dev/gen-materials.mjs) and falls back to naming rules validated against the
// default pack's block list, so every returned id exists.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { blockExists, withNamespace } from './blocks.mjs'

const dataPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'materials.json')
let table
function loadTable() {
  if (table !== undefined) return table
  try {
    const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
    table = raw.families ?? raw
  } catch {
    table = null
  }
  return table
}

const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'bamboo', 'crimson', 'warped']

// Irregular full-block ids → family stem used by stairs/slab/wall ids.
const STEM_OF = {
  stone_bricks: 'stone_brick',
  mossy_stone_bricks: 'mossy_stone_brick',
  bricks: 'brick',
  nether_bricks: 'nether_brick',
  red_nether_bricks: 'red_nether_brick',
  quartz_block: 'quartz',
  purpur_block: 'purpur',
  prismarine_bricks: 'prismarine_brick',
  deepslate_bricks: 'deepslate_brick',
  deepslate_tiles: 'deepslate_tile',
  mud_bricks: 'mud_brick',
  tuff_bricks: 'tuff_brick',
  end_stone_bricks: 'end_stone_brick',
  polished_blackstone_bricks: 'polished_blackstone_brick',
  resin_bricks: 'resin_brick',
}

const BLOCK_OF = Object.fromEntries(Object.entries(STEM_OF).map(([block, stem]) => [stem, block]))
BLOCK_OF.cut_copper = 'cut_copper'

function first(...candidates) {
  for (const candidate of candidates) {
    if (candidate && blockExists(candidate)) return withNamespace(candidate)
  }
  return undefined
}

function deriveFamily(input) {
  let key = String(input).replace(/^minecraft:/, '')
  // Accept variant ids: oak_stairs → oak, stone_brick_wall → stone_brick
  key = key.replace(/_(stairs|slab|wall|fence|fence_gate|door|trapdoor|button|pressure_plate)$/, '')
  key = key.replace(/_planks$/, '')
  const wood = WOODS.find(w => key === w || key === `${w}_log` || key === `${w}_wood` || key === `stripped_${w}_log` || key === `${w}_stem` || key === `${w}_hyphae`)
  if (wood) {
    const nether = wood === 'crimson' || wood === 'warped'
    const log = wood === 'bamboo' ? 'bamboo_block' : nether ? `${wood}_stem` : `${wood}_log`
    const woodBlock = wood === 'bamboo' ? undefined : nether ? `${wood}_hyphae` : `${wood}_wood`
    return clean({
      kind: 'wood',
      block: first(`${wood}_planks`),
      planks: first(`${wood}_planks`),
      stairs: first(`${wood}_stairs`),
      slab: first(`${wood}_slab`),
      fence: first(`${wood}_fence`),
      fence_gate: first(`${wood}_fence_gate`),
      door: first(`${wood}_door`),
      trapdoor: first(`${wood}_trapdoor`),
      button: first(`${wood}_button`),
      pressure_plate: first(`${wood}_pressure_plate`),
      sign: first(`${wood}_sign`),
      wall_sign: first(`${wood}_wall_sign`),
      hanging_sign: first(`${wood}_hanging_sign`),
      log: first(log),
      wood: first(woodBlock),
      stripped_log: first(`stripped_${log}`),
      stripped_wood: first(woodBlock ? `stripped_${woodBlock}` : undefined),
      leaves: first(`${wood}_leaves`, wood === 'crimson' ? 'nether_wart_block' : wood === 'warped' ? 'warped_wart_block' : undefined),
      mosaic: first(wood === 'bamboo' ? 'bamboo_mosaic' : undefined),
    })
  }
  const stem = STEM_OF[key] ?? key.replace(/s$/, '')
  const block = first(BLOCK_OF[key] ?? key, `${key}s`, BLOCK_OF[stem], `${stem}s`, `${stem}_block`, key)
  return clean({
    kind: 'stone',
    block,
    stairs: first(`${stem}_stairs`, `${key}_stairs`),
    slab: first(`${stem}_slab`, `${key}_slab`),
    wall: first(`${stem}_wall`, `${key}_wall`),
    fence: first(`${stem}_fence`),
    button: first(`${stem}_button`, `${key}_button`),
    pressure_plate: first(`${stem}_pressure_plate`, `${key}_pressure_plate`),
    pillar: first(`${stem}_pillar`, `${key}_pillar`),
    chiseled: first(`chiseled_${key}`, `chiseled_${stem}s`, `chiseled_${stem}`),
    cracked: first(`cracked_${key}`, `cracked_${stem}s`),
    mossy: first(`mossy_${key}`, `mossy_${stem}s`),
  })
}

function clean(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined))
}

const familyCache = new Map()

// Returns the material family for a name such as 'spruce', 'stone_brick', 'stone_bricks',
// 'deepslate_tiles', 'oak_stairs' or 'minecraft:cobblestone'. Throws if nothing matches.
export function material(name) {
  const key = String(name).replace(/^minecraft:/, '')
  if (familyCache.has(key)) return familyCache.get(key)
  const data = loadTable()
  let family
  if (data) {
    const direct = data[key] ?? data[STEM_OF[key]] ?? data[key.replace(/s$/, '')]
    if (direct) family = { ...direct }
    if (!family) {
      for (const entry of Object.values(data)) {
        if (entry && typeof entry === 'object' && Object.values(entry).includes(withNamespace(key))) {
          family = { ...entry }
          break
        }
      }
    }
  }
  const derived = deriveFamily(key)
  family = { ...derived, ...(family ?? {}) }
  if (!family.block && !family.stairs && !family.slab) throw new Error(`Unknown material "${name}"`)
  if (!family.block) family.block = family.planks ?? family.stairs?.replace(/_stairs$/, '')
  familyCache.set(key, family)
  return family
}

// A material's variant with a fallback chain, e.g. variant('terracotta', 'stairs', 'granite').
export function variant(name, kind, ...fallbacks) {
  let substitute
  for (const candidate of [name, ...fallbacks]) {
    try {
      const family = material(candidate)
      if (family[kind]) return family[kind]
      substitute ??= family.substitutes?.[kind]?.[0]
    } catch {
      // try next
    }
  }
  // e.g. copper_block has no stairs of its own: use the listed closest family's
  if (substitute) return substitute
  throw new Error(`No ${kind} variant for ${[name, ...fallbacks].join(' / ')}`)
}

// State-string helpers. Each accepts a family name or explicit id.
const idFor = (name, kind) => (/(_stairs|_slab|_trapdoor|_door|_fence_gate|_log|_wood|_wall|_button)$/.test(String(name)) ? withNamespace(name) : variant(name, kind))

export const stairs = (name, facing, half = 'bottom') => `${idFor(name, 'stairs')}[facing=${facing},half=${half}]`
export const slab = (name, type = 'bottom') => `${idFor(name, 'slab')}[type=${type}]`
export const trapdoor = (name, facing, { half = 'bottom', open = false } = {}) => `${idFor(name, 'trapdoor')}[facing=${facing},half=${half},open=${open}]`
export const log = (name, axis = 'y') => `${idFor(name, 'log')}[axis=${axis}]`
export const gate = (name, facing, open = false) => `${idFor(name, 'fence_gate')}[facing=${facing},open=${open}]`
