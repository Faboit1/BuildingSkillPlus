#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as lodestone from './lib/lodestone.mjs'
import { withDefaults } from './lib/kit/blocks.mjs'
import { persistLeaves, updateConnections } from './lib/kit/connect.mjs'
import { completeBlocks } from './lib/kit/fixups.mjs'
import { createKit } from './lib/kit/index.mjs'

const {
  BlockState,
  NbtByte,
  NbtCompound,
  NbtDouble,
  NbtFloat,
  NbtInt,
  NbtList,
  NbtLong,
  NbtShort,
  NbtString,
  NbtFile,
  Structure,
} = lodestone

// 1.21.1 — matches the preview pack and the block-state table the kit validates against.
// Newer game versions upgrade renamed blocks automatically; use --data-version for older targets.
const DEFAULT_DATA_VERSION = 3955

function usage() {
  return `Usage:
  node scripts/run-build.mjs <recipe.mjs> [--out-dir <dir>] [--name <name>] [--data-version <number>] [--compression gzip|zlib|none] [--no-block-state-updates] [--no-default-states] [--origin x,y,z] [--world <name>] [--json]

  --origin x,y,z   where the build's minimum corner will be pasted in the world (default 0,0,0);
                   used for the world coordinates in <name>.placements.json and <name>.setup.md
  --world <name>   the world name used in the plugin commands of <name>.setup.md (default world)
`
}

function parseArgs(argv) {
  const options = {
    recipe: undefined,
    outDir: undefined,
    name: undefined,
    dataVersion: DEFAULT_DATA_VERSION,
    compression: 'gzip',
    updateBlockStates: true,
    defaultStates: true,
    json: false,
    help: false,
    origin: [0, 0, 0],
    world: 'world',
  }
  const parseOrigin = value => {
    const out = String(value).split(/[,\s]+/).filter(Boolean).map(Number)
    if (out.length !== 3 || !out.every(Number.isInteger)) throw new Error('--origin must be three integers: x,y,z')
    return out
  }

  const readValue = (arg, index) => {
    const value = argv[index + 1]
    if (!value || value.startsWith('-')) throw new Error(`${arg} requires a value`)
    return value
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '-h' || arg === '--help') {
      options.help = true
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--no-block-state-updates') {
      options.updateBlockStates = false
    } else if (arg === '--no-default-states') {
      options.defaultStates = false
    } else if (arg === '--out-dir') {
      options.outDir = readValue(arg, index)
      index += 1
    } else if (arg.startsWith('--out-dir=')) {
      options.outDir = arg.slice('--out-dir='.length)
    } else if (arg === '--name') {
      options.name = readValue(arg, index)
      index += 1
    } else if (arg.startsWith('--name=')) {
      options.name = arg.slice('--name='.length)
    } else if (arg === '--data-version') {
      options.dataVersion = Number(readValue(arg, index))
      index += 1
    } else if (arg.startsWith('--data-version=')) {
      options.dataVersion = Number(arg.slice('--data-version='.length))
    } else if (arg === '--compression') {
      options.compression = readValue(arg, index)
      index += 1
    } else if (arg.startsWith('--compression=')) {
      options.compression = arg.slice('--compression='.length)
    } else if (arg === '--origin') {
      // negative coordinates look like flags to readValue, so read the next argument directly
      if (argv[index + 1] === undefined) throw new Error('--origin requires a value')
      options.origin = parseOrigin(argv[index + 1])
      index += 1
    } else if (arg.startsWith('--origin=')) {
      options.origin = parseOrigin(arg.slice('--origin='.length))
    } else if (arg === '--world') {
      options.world = readValue(arg, index)
      index += 1
    } else if (arg.startsWith('--world=')) {
      options.world = arg.slice('--world='.length)
    } else if (!options.recipe) {
      options.recipe = arg
    } else {
      throw new Error(`Unexpected argument: ${arg}`)
    }
  }

  if (!Number.isInteger(options.dataVersion) || options.dataVersion <= 0) {
    throw new Error('--data-version must be a positive integer')
  }
  if (!['gzip', 'zlib', 'none'].includes(options.compression)) {
    throw new Error('--compression must be gzip, zlib, or none')
  }

  return options
}

function slugify(value) {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'minecraft-build'
}

function tuple(value, label) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`${label} must be a three-number array`)
  }
  const out = value.map(Number)
  if (!out.every(Number.isFinite)) {
    throw new Error(`${label} must contain finite numbers`)
  }
  return out.map(Math.trunc)
}

function normalizeSize(size) {
  const out = tuple(size, 'size')
  if (!out.every(value => value > 0)) {
    throw new Error('size values must be positive')
  }
  return out
}

function normalizeBlock(block, properties) {
  if (block instanceof BlockState) {
    return { name: block.getName().toString(), properties: normalizeProperties(properties ?? block.getProperties(), 'properties') }
  }
  if (typeof block === 'string') {
    const state = BlockState.parse(block)
    return {
      name: state.getName().toString(),
      properties: normalizeProperties(properties ?? state.getProperties(), 'properties'),
    }
  }
  if (block && typeof block === 'object') {
    const name = block.name ?? block.id
    if (!name) throw new Error('block object requires name or id')
    return { name: String(name), properties: normalizeProperties(properties ?? block.properties, 'properties') }
  }
  throw new Error('block must be a block id string, state string, BlockState, or block object')
}

function normalizeProperties(properties, label) {
  if (properties === undefined) return undefined
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    throw new Error(`${label} must be an object with string values`)
  }
  const normalized = {}
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value !== 'string') {
      throw new Error(`${label}.${key} must be a string`)
    }
    normalized[key] = value
  }
  return normalized
}

function assertInside(structure, pos) {
  if (!structure.isInside(pos)) {
    const size = structure.getSize()
    throw new Error(`Position [${pos.join(', ')}] is outside structure size [${size.join(', ')}]`)
  }
}

function setBlock(structure, posInput, block, properties, nbt) {
  const pos = tuple(posInput, 'pos')
  assertInside(structure, pos)
  const normalized = normalizeBlock(block, properties)
  structure.addBlock(pos, normalized.name, normalized.properties, nbt)
  return structure
}

function forBox(fromInput, toInput, fn) {
  const from = tuple(fromInput, 'from')
  const to = tuple(toInput, 'to')
  const min = from.map((value, index) => Math.min(value, to[index]))
  const max = from.map((value, index) => Math.max(value, to[index]))
  for (let x = min[0]; x <= max[0]; x += 1) {
    for (let y = min[1]; y <= max[1]; y += 1) {
      for (let z = min[2]; z <= max[2]; z += 1) {
        fn([x, y, z], min, max)
      }
    }
  }
}

function fill(structure, from, to, block, properties, nbt) {
  forBox(from, to, pos => setBlock(structure, pos, block, properties, nbt))
  return structure
}

function hollowBox(structure, from, to, block, properties, nbt) {
  forBox(from, to, (pos, min, max) => {
    const isSurface = pos.some((value, index) => value === min[index] || value === max[index])
    if (isSurface) setBlock(structure, pos, block, properties, nbt)
  })
  return structure
}

function line(structure, fromInput, toInput, block, properties, nbt) {
  const from = tuple(fromInput, 'from')
  const to = tuple(toInput, 'to')
  const steps = Math.max(...from.map((value, index) => Math.abs(to[index] - value)))
  if (steps === 0) return setBlock(structure, from, block, properties, nbt)
  const seen = new Set()
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    const pos = from.map((value, index) => Math.round(value + (to[index] - value) * t))
    const key = pos.join(',')
    if (!seen.has(key)) {
      seen.add(key)
      setBlock(structure, pos, block, properties, nbt)
    }
  }
  return structure
}

function sphere(structure, centerInput, radiusInput, block, options = {}) {
  const center = tuple(centerInput, 'center')
  const radius = Number(radiusInput)
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('radius must be positive')
  const filled = options.filled ?? true
  const radiusSq = radius * radius
  const innerRadiusSq = Math.max(0, radius - 1) * Math.max(0, radius - 1)
  const ceil = Math.ceil(radius)
  for (let x = center[0] - ceil; x <= center[0] + ceil; x += 1) {
    for (let y = center[1] - ceil; y <= center[1] + ceil; y += 1) {
      for (let z = center[2] - ceil; z <= center[2] + ceil; z += 1) {
        const distanceSq = (x - center[0]) ** 2 + (y - center[1]) ** 2 + (z - center[2]) ** 2
        if (distanceSq <= radiusSq && (filled || distanceSq >= innerRadiusSq)) {
          setBlock(structure, [x, y, z], block, options.properties, options.nbt)
        }
      }
    }
  }
  return structure
}

function cylinder(structure, centerInput, radiusInput, yRangeInput, block, options = {}) {
  const center = tuple(centerInput, 'center')
  const yRange = Array.isArray(yRangeInput) ? yRangeInput.map(Number) : [center[1], Number(yRangeInput)]
  if (yRange.length !== 2 || !yRange.every(Number.isFinite)) throw new Error('yRange must be [minY, maxY]')
  const radius = Number(radiusInput)
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('radius must be positive')
  const filled = options.filled ?? true
  const radiusSq = radius * radius
  const innerRadiusSq = Math.max(0, radius - 1) * Math.max(0, radius - 1)
  const ceil = Math.ceil(radius)
  const minY = Math.trunc(Math.min(...yRange))
  const maxY = Math.trunc(Math.max(...yRange))
  for (let x = center[0] - ceil; x <= center[0] + ceil; x += 1) {
    for (let z = center[2] - ceil; z <= center[2] + ceil; z += 1) {
      const distanceSq = (x - center[0]) ** 2 + (z - center[2]) ** 2
      if (distanceSq <= radiusSq && (filled || distanceSq >= innerRadiusSq)) {
        for (let y = minY; y <= maxY; y += 1) {
          setBlock(structure, [x, y, z], block, options.properties, options.nbt)
        }
      }
    }
  }
  return structure
}

function toNbtTag(value) {
  if (value && typeof value.getId === 'function') return value
  if (typeof value === 'string') return new NbtString(value)
  if (typeof value === 'boolean') return new NbtByte(value ? 1 : 0)
  if (typeof value === 'number') return Number.isInteger(value) ? new NbtInt(value) : new NbtDouble(value)
  if (Array.isArray(value)) return new NbtList(value.map(toNbtTag))
  if (value && typeof value === 'object') return createBlockNbt(value)
  throw new Error(`Unsupported NBT value: ${value}`)
}

function createBlockNbt(object) {
  const compound = new NbtCompound()
  for (const [key, value] of Object.entries(object)) {
    compound.set(key, toNbtTag(value))
  }
  return compound
}

function createApi() {
  const kit = createKit()
  return {
    kit,
    builder: kit.builder,
    lodestone,
    Structure,
    BlockState,
    NbtByte,
    NbtCompound,
    NbtDouble,
    NbtFloat,
    NbtInt,
    NbtList,
    NbtLong,
    NbtShort,
    NbtString,
    createStructure: size => new Structure(normalizeSize(size)),
    normalizeBlock,
    setBlock,
    fill,
    hollowBox,
    line,
    sphere,
    cylinder,
    createBlockNbt,
  }
}

// Gives every block its full vanilla default state (e.g. grass_block → snowy=false). The game
// fills these implicitly, but the previewer renders a block with missing properties as nothing.
function fillDefaultStates(structure) {
  const updates = []
  for (const block of structure.getBlocks()) {
    const name = block.state.getName().toString()
    const props = block.state.getProperties()
    const full = withDefaults({ name, props })
    if (full.props && Object.keys(full.props).length !== Object.keys(props).length) updates.push([block.pos, name, full.props, block.nbt])
  }
  for (const [pos, name, props, nbt] of updates) structure.addBlock(pos, name, props, nbt)
  return updates.length
}

// Runs the kit's fix-up passes over a Lodestone structure: completes door/bed/tall-plant
// partners and vine faces, makes leaves persistent, then computes vanilla neighbour states.
function updateStructureConnections(structure) {
  const [sx, , sz] = structure.getSize()
  const key = (x, y, z) => x + sx * (z + sz * y)
  const map = new Map()
  const nbts = new Map()
  for (const block of structure.getBlocks()) {
    const [x, y, z] = block.pos
    map.set(key(x, y, z), { name: block.state.getName().toString(), props: block.state.getProperties() })
    if (block.nbt) nbts.set(key(x, y, z), block.nbt)
  }
  const changed = []
  const store = {
    get: (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= sx || z >= sz ? null : map.get(key(x, y, z)) ?? null),
    put: (x, y, z, block) => {
      map.set(key(x, y, z), block)
      changed.push([x, y, z])
    },
    entries: () => [...map.entries()].map(([k, block]) => {
      const x = k % sx
      const rest = (k - x) / sx
      const z = rest % sz
      return [x, (rest - z) / sz, z, block]
    }),
  }
  const count = completeBlocks(store) + persistLeaves(store) + updateConnections(store)
  const seen = new Set()
  for (const [x, y, z] of changed) {
    const k = key(x, y, z)
    if (seen.has(k)) continue
    seen.add(k)
    const block = map.get(k)
    structure.addBlock([x, y, z], block.name, block.props, nbts.get(k))
  }
  return count
}

// ---------------------------------------------------------------- spawn kit placements export
// Placements come from the kit's spawn module (b.npcSpot, b.leaderboards, b.crate, b.portal,
// b.region, b.spawnPoint) in structure coordinates. They are written as <name>.placements.json
// (local + world coordinates) and <name>.setup.md (a table and ready-to-paste plugin commands).
// Command syntax verified against the plugins' source (October 2026): Citizens 2.0.44 (--at
// x:y:z:world:yaw:pitch, console-safe), FancyNpcs 2.12.1 (--location x y z --world w; its docs
// page says --position), DecentHolograms 2.10.3 (-l:world:x:y:z, console-safe, names
// [a-zA-Z0-9_-]+, pages from 1), ExcellentCrates 6.6.1 (no bind command: editor link tool or
// Block.Positions "x,y,z,world"), CrazyCrates 5.2.0 (/crazycrates set <crate>, player looking at
// the block within 5), WorldEdit 7.4.7 (//pos1 x,y,z; console: /world <w> first), WorldGuard 7.0.21
// (/rg define [-w world] <id>, /rg flag <id> <flag> <value>, /rg setpriority <id> <n>), and vanilla
// Java 1.21.1 /setworldspawn <pos> <angle>.
const YAW_OF = { south: 0, west: 90, north: 180, east: -90 }
const OPPOSITE_OF = { north: 'south', south: 'north', east: 'west', west: 'east' }
const STEP_OF = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }
const round2 = v => Math.round(v * 100) / 100
const addOrigin = (p, origin) => p.map((v, i) => round2(v + origin[i]))
const fmt = p => p.map(v => round2(v)).join(' ')
const slugId = value => String(value).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'spot'

function worldPlacements(placements, origin) {
  return placements.map(p => {
    const world = {}
    for (const key of ['pos', 'hologram', 'anchor', 'min', 'max']) if (p[key]) world[key] = addOrigin(p[key], origin)
    if (p.board) world.board = { center: addOrigin(p.board.center, origin) }
    return { ...p, world }
  })
}

// An NPC's feet go on the block centre; the record's pos is the integer feet block.
const feetOf = p => [p.world.pos[0] + 0.5, p.world.pos[1], p.world.pos[2] + 0.5]

function setupSheet({ name, origin, world, size, placements }) {
  const L = []
  const code = (lines, lang = '') => {
    L.push('```' + lang)
    L.push(...lines)
    L.push('```', '')
  }
  const of = type => placements.filter(p => p.type === type)
  L.push(`# ${name}: server setup`, '')
  L.push(`Paste the structure (${size.join(' x ')}) with its minimum corner at **${origin.join(' ')}** in world \`${world}\``)
  L.push(`(\`run-build --origin x,y,z --world name\` changes both), e.g. \`/place template <namespace>:${name} ${origin.join(' ')}\` from a`)
  L.push('datapack, or a WorldEdit paste whose minimum corner lands there. *Local* coordinates are inside the')
  L.push('structure (minimum corner 0 0 0); *world* = origin + local. NPCs and holograms stand on block centres (.5).', '')
  L.push('Commands are written for the server console (no leading slash; type `/` first in game). Syntax checked')
  L.push('against the plugin sources in October 2026: Citizens 2.0.44, FancyNpcs 2.12.1, DecentHolograms 2.10.3,')
  L.push('ExcellentCrates 6.6.1, CrazyCrates 5.2.0, WorldEdit 7.4.7, WorldGuard 7.0.21, vanilla Java 1.21.1.', '')

  L.push('## Placements', '', '| id | label | type | local | world |', '| --- | --- | --- | --- | --- |')
  for (const p of placements) {
    const local = p.min ? `${fmt(p.min)} → ${fmt(p.max)}` : fmt(p.pos ?? p.anchor)
    const wpos = p.min ? `${fmt(p.world.min)} → ${fmt(p.world.max)}` : fmt(p.world.pos ?? p.world.anchor)
    const type = p.type === 'npc' && p.role ? `npc (${p.role})` : p.type === 'crate' ? `crate (${p.tier})` : p.type === 'portal' ? `portal (${p.kind})` : p.type
    L.push(`| ${p.id} | ${String(p.label ?? '').replace(/\|/g, '/')} | ${type} | ${local} | ${wpos} |`)
  }
  L.push('')

  const spawn = of('spawn')[0]
  if (spawn) {
    L.push('## World spawn', '')
    code([`setworldspawn ${fmt(spawn.world.pos)} ${spawn.yaw}`])
  }

  const npcs = of('npc')
  if (npcs.length) {
    L.push('## NPCs', '')
    L.push('Each NPC faces its spot\'s `facing` (the yaw below). `statue` spots stand on the leaderboard podium.', '')
    L.push('### Citizens', '')
    L.push('`npc create` selects the new NPC, so its skin and traits can follow each line (`npc skin <player>`,')
    L.push('`npc lookclose`). The nameplate is hidden because the hologram lines below carry the label; drop')
    L.push('`--nameplate false` to keep the NPC\'s own name (player NPC names are cut at 16 characters).', '')
    code(npcs.map(p => `npc create ${p.label} --at ${feetOf(p).join(':')}:${world}:${p.yaw}:0 --nameplate false`))
    L.push('### FancyNpcs', '')
    code(npcs.flatMap(p => {
      const id = slugId(p.id)
      return [`npc create ${id} --location ${fmt(feetOf(p))} --world ${world}`, `npc rotate ${id} ${p.yaw} 0`, `npc displayname ${id} ${p.label}`]
    }))
  }

  const boards = of('leaderboard')
  if (npcs.length || boards.length || of('crate').length) {
    L.push('## Holograms (DecentHolograms)', '')
    if (npcs.length) {
      L.push('Name plates over the NPCs (2.4 above their feet):', '')
      code(npcs.map(p => `dh hologram create npc-${slugId(p.id)} -l:${world}:${p.world.hologram.join(':')} ${p.label}`))
    }
    if (boards.length) {
      L.push('Leaderboards: the location is the top line, centred on the board and 0.5 in front of its backdrop.')
      L.push('Add one line per rank with your leaderboard plugin\'s placeholders (`dh line add <hologram> 1 <text>`).', '')
      code(boards.flatMap(p => [`dh hologram create lb-${slugId(p.id)} -l:${world}:${p.world.anchor.join(':')} &6&l${p.label}`, `dh line add lb-${slugId(p.id)} 1 &7#1 ...`]))
    }
    if (of('crate').length) {
      L.push('Crate titles (ExcellentCrates and CrazyCrates can also draw their own over a linked block: use one):', '')
      code(of('crate').map(p => `dh hologram create crate-${slugId(p.id)} -l:${world}:${p.world.hologram.join(':')} ${p.label}`))
    }
  }

  const holos = of('hologram')
  if (holos.length) {
    L.push('## Other holograms (DecentHolograms)', '')
    L.push('Free-standing text: rules, district names, tips. The location is the top line.', '')
    code(holos.map(p => `dh hologram create ${slugId(p.id)} -l:${world}:${p.world.pos.join(':')} ${p.label}`))
  }

  const crates = of('crate')
  if (crates.length) {
    // where to stand: the middle of the clear area in front of the station, looking at the crate
    const standAt = p => {
      const [dx, dz] = STEP_OF[p.facing]
      return [p.world.pos[0] + 0.5 + dx * 4, p.world.pos[1] - 1, p.world.pos[2] + 0.5 + dz * 4]
    }
    L.push('## Crates', '')
    L.push('Crate blocks (local → world): ' + crates.map(p => `\`${p.id}\` ${fmt(p.world.pos)}`).join(', ') + '.', '')
    L.push('### ExcellentCrates', '')
    L.push('No command binds a block. Either add the positions to each crate\'s file and reload:', '')
    for (const p of crates) code([`# plugins/ExcellentCrates/crates/${slugId(p.id)}.yml`, 'Block:', '  Positions:', `  - ${p.world.pos.join(',')},${world}`], 'yaml')
    L.push('then `crates reload`; or in game open `/crates editor`, pick the crate, click **Linked Block** to get the')
    L.push('link tool and click the crate block (teleport lines below).', '')
    L.push('### CrazyCrates', '')
    L.push('Player only: stand in front of the crate looking at it (within 5 blocks) and run the set command.', '')
    code(crates.flatMap(p => [`/tp @s ${fmt(standAt(p))} ${YAW_OF[OPPOSITE_OF[p.facing]]} 5`, `/crazycrates set ${p.id}`]))
  }

  const regions = [...of('region'), ...of('portal').map(p => ({ ...p, id: `portal-${slugId(p.id)}`, flags: {} }))]
  if (regions.length) {
    L.push('## Regions (WorldEdit + WorldGuard)', '')
    L.push('Portals are listed as trigger regions (`portal-<id>`): point your portal, warp or RTP plugin at them.', '')
    L.push('In game:', '')
    code(regions.flatMap(r => {
      const flags = Object.entries(r.flags ?? {}).filter(([k]) => k !== 'priority')
      return [
        `//pos1 ${r.world.min.join(',')}`,
        `//pos2 ${r.world.max.join(',')}`,
        `/rg define ${r.id}`,
        ...flags.map(([k, v]) => `/rg flag ${r.id} ${k} ${v}`),
        ...(r.flags?.priority !== undefined ? [`/rg setpriority ${r.id} ${r.flags.priority}`] : []),
      ]
    }))
    L.push('From the console, set the WorldEdit world first and drop one slash from the WorldEdit commands:', '')
    code([`/world ${world}`, ...regions.flatMap(r => {
      const flags = Object.entries(r.flags ?? {}).filter(([k]) => k !== 'priority')
      return [
        `/pos1 ${r.world.min.join(',')}`,
        `/pos2 ${r.world.max.join(',')}`,
        `rg define -w ${world} ${r.id}`,
        ...flags.map(([k, v]) => `rg flag -w ${world} ${r.id} ${k} ${v}`),
        ...(r.flags?.priority !== undefined ? [`rg setpriority -w ${world} ${r.id} ${r.flags.priority}`] : []),
      ]
    })])
  }
  const boardsWithSigns = npcs.filter(p => p.board)
  if (boardsWithSigns.length) {
    L.push('## Sign boards', '')
    L.push('Booths leave a framed board for a wall sign or item frames (centre of its front face):', '')
    for (const p of boardsWithSigns) L.push(`- \`${p.id}\`: ${fmt(p.world.board.center)}, facing ${p.board.facing}`)
    L.push('')
  }
  return `${L.join('\n')}\n`
}

function summarize(structure) {
  const blocks = structure.getBlocks()
  return {
    size: structure.getSize(),
    blockCount: blocks.length,
    paletteCount: new Set(blocks.map(block => block.state.toString())).size,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  if (!options.recipe) {
    throw new Error(`Missing recipe file.\n${usage()}`)
  }

  const recipePath = path.resolve(options.recipe)
  const recipe = await import(`${pathToFileURL(recipePath).href}?v=${Date.now()}`)
  const buildFn = recipe.default ?? recipe.build
  if (typeof buildFn !== 'function') {
    throw new Error('Recipe must export a default function or named build function')
  }

  // With --json, stdout must stay pure JSON: send the recipe's console.log output to stderr.
  const log = console.log
  if (options.json) console.log = (...args) => console.error(...args)
  let result
  try {
    result = await buildFn(createApi())
  } finally {
    console.log = log
  }
  const structure = result instanceof Structure ? result : result?.structure
  if (!(structure instanceof Structure)) {
    throw new Error('Recipe must return a Lodestone Structure or { structure, metadata }')
  }

  const metadata = {
    ...(recipe.metadata ?? {}),
    ...(result?.metadata ?? {}),
  }
  // Builder-made structures already carry vanilla-accurate connection states. Raw-API
  // structures get the same pass here: default states first, then stairs/walls/fences/panes.
  const kitUpdated = metadata.blockStatesUpdated === true
  const outputStructure = options.updateBlockStates || options.defaultStates ? structure.clone() : structure
  const defaultsFilled = options.defaultStates ? fillDefaultStates(outputStructure) : 0
  const blockStateUpdates = options.updateBlockStates && !kitUpdated
    ? { updatedBlocks: updateStructureConnections(outputStructure) }
    : { updatedBlocks: 0 }
  const builderReport = metadata.builderReport
  delete metadata.builderReport
  const name = slugify(options.name ?? metadata.name ?? path.basename(recipePath, path.extname(recipePath)))
  const outDir = path.resolve(options.outDir ?? path.join('minecraft-builds', name))
  await fs.mkdir(outDir, { recursive: true })

  const nbtPath = path.join(outDir, `${name}.nbt`)
  const bytes = outputStructure.writeNbt({
    name: '',
    dataVersion: options.dataVersion,
    compression: options.compression,
  })
  await fs.writeFile(nbtPath, bytes)

  const file = NbtFile.read(bytes)
  const roundTrip = Structure.fromNbt(file.root)
  const stats = summarize(outputStructure)
  const roundTripStats = summarize(roundTrip)
  if (JSON.stringify(stats.size) !== JSON.stringify(roundTripStats.size) || stats.blockCount !== roundTripStats.blockCount) {
    throw new Error('Generated NBT failed Lodestone round-trip validation')
  }

  // spawn kit placements: NPC spots, hologram anchors, crates, portals, regions, the world spawn
  const placements = Array.isArray(metadata.placements) ? metadata.placements : []
  let placementsOut
  if (placements.length) {
    const counts = {}
    for (const p of placements) counts[p.type] = (counts[p.type] ?? 0) + 1
    if ((counts.spawn ?? 0) > 1) throw new Error('placements: more than one world spawn')
    const size = outputStructure.getSize()
    const list = worldPlacements(placements, options.origin)
    const jsonPath = path.join(outDir, `${name}.placements.json`)
    const setupPath = path.join(outDir, `${name}.setup.md`)
    await fs.writeFile(jsonPath, `${JSON.stringify({
      name,
      size,
      origin: options.origin,
      world: options.world,
      note: 'local = structure coordinates (minimum corner 0,0,0); world = origin + local. npc pos = the block the feet are in; hologram/anchor = hologram location (top line); crate pos = the crate block; portal and region min/max = inclusive block corners.',
      placements: list,
    }, null, 2)}\n`)
    await fs.writeFile(setupPath, setupSheet({ name, origin: options.origin, world: options.world, size, placements: list }))
    placementsOut = { count: placements.length, types: counts, origin: options.origin, world: options.world, jsonPath, setupPath }
  }

  const summary = {
    name,
    dataVersion: options.dataVersion,
    compression: options.compression,
    updateBlockStates: options.updateBlockStates,
    defaultStatesFilled: defaultsFilled,
    blockStateUpdates: kitUpdated ? { updatedBlocks: builderReport?.connectionsUpdated ?? 0, by: 'kit' } : blockStateUpdates,
    ...(builderReport ? { builder: {
      clipped: builderReport.clipped,
      ...(builderReport.clippedRange ? { clippedRange: builderReport.clippedRange, clippedFrom: builderReport.clippedFrom } : {}),
      leavesPersisted: builderReport.leavesPersisted,
      problems: builderReport.problems,
      ...(builderReport.warnings?.length ? { warnings: builderReport.warnings } : {}),
      ...(builderReport.spawnProof ? { spawnProof: builderReport.spawnProof } : {}),
    } } : {}),
    ...(placementsOut ? { placements: placementsOut } : {}),
    nbtPath,
    summaryPath: path.join(outDir, 'summary.json'),
    ...stats,
    recipePath,
  }
  await fs.writeFile(summary.summaryPath, `${JSON.stringify(summary, null, 2)}\n`)

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(`Generated ${summary.name}`)
    console.log(`  NBT: ${summary.nbtPath}`)
    console.log(`  Size: ${summary.size.join(' x ')}`)
    console.log(`  Blocks: ${summary.blockCount}`)
    console.log(`  Palette: ${summary.paletteCount}`)
    if (placementsOut) {
      console.log(`  Placements: ${placementsOut.count} (${Object.entries(placementsOut.types).map(([k, v]) => `${v} ${k}`).join(', ')})`)
      console.log(`  Setup: ${placementsOut.setupPath}`)
    }
  }
}

main().catch(err => {
  console.error(`run-build: ${err.message}`)
  process.exitCode = 1
})
