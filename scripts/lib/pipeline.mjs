// The build pipeline shared by scripts/run-build.mjs and the browser spawn builder
// (apps/spawn-generator, not part of the plugin): the recipe api, the export passes (default states, connections), the
// placements in world coordinates and the setup sheet. No Node built-ins here, so it bundles for
// the browser as is.

import * as lodestone from './lodestone.mjs'
import { withDefaults } from './kit/blocks.mjs'
import { persistLeaves, updateConnections } from './kit/connect.mjs'
import { completeBlocks } from './kit/fixups.mjs'
import { createKit } from './kit/index.mjs'

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
  Structure,
} = lodestone

// 1.21.1 — matches the preview pack and the block-state table the kit validates against.
// Newer game versions upgrade renamed blocks automatically; use --data-version for older targets.
export const DEFAULT_DATA_VERSION = 3955

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

// focus: [x0, z0, x1, z1] makes every builder keep only that column box (run-build --focus)
export function createApi({ focus = null } = {}) {
  const kit = createKit()
  return {
    kit,
    builder: (size, opts) => kit.builder(size, { focus, ...opts }),
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
export function fillDefaultStates(structure) {
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
export function updateStructureConnections(structure) {
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

export function worldPlacements(placements, origin) {
  return placements.map(p => {
    const world = {}
    for (const key of ['pos', 'hologram', 'anchor', 'min', 'max']) if (p[key]) world[key] = addOrigin(p[key], origin)
    if (p.board) world.board = { center: addOrigin(p.board.center, origin) }
    return { ...p, world }
  })
}

// An NPC's feet go on the block centre; the record's pos is the integer feet block.
const feetOf = p => [p.world.pos[0] + 0.5, p.world.pos[1], p.world.pos[2] + 0.5]

// changeHint: how the reader changes the paste corner and world (the CLI flags by default)
export function setupSheet({ name, origin, world, size, placements, changeHint = '`run-build --origin x,y,z --world name` changes both' }) {
  const L = []
  const code = (lines, lang = '') => {
    L.push('```' + lang)
    L.push(...lines)
    L.push('```', '')
  }
  const of = type => placements.filter(p => p.type === type)
  L.push(`# ${name}: server setup`, '')
  L.push(`Paste the structure (${size.join(' x ')}) with its minimum corner at **${origin.join(' ')}** in world \`${world}\``)
  L.push(`(${changeHint}), e.g. \`/place template <namespace>:${name} ${origin.join(' ')}\` from a`)
  L.push('datapack, or a WorldEdit paste whose minimum corner lands there. *Local* coordinates are inside the')
  L.push('structure (minimum corner 0 0 0); *world* = origin + local. NPCs and holograms stand on block centres (.5).', '')
  L.push('Commands are written for the server console (no leading slash; type `/` first in game). Syntax checked')
  L.push('against the plugin sources in October 2026: Citizens 2.0.44, FancyNpcs 2.12.1, DecentHolograms 2.10.3,')
  L.push('ExcellentCrates 6.6.1, CrazyCrates 5.2.0, WorldEdit 7.4.7, WorldGuard 7.0.21, vanilla Java 1.21.1.', '')
  // a spawn-sized paste: what it takes on a server
  const cells = size[0] * size[1] * size[2]
  if (cells > 20_000_000) {
    L.push('## Pasting a build this big', '')
    L.push(`It is ${Math.round(cells / 1e6)} million cells: paste the .schem with **FastAsyncWorldEdit** (plain WorldEdit`)
    L.push('runs out of memory or stalls the server), on a server started with plenty of heap (8 GB or more), ideally')
    L.push('while no players are on. Stand on the paste corner (or `//pos1` it) and run:', '')
    L.push('```', `//schem load ${name}`, '//paste -a', '```', '')
    L.push('`-a` skips the air in the schematic, so the paste does not carve a box out of existing terrain; leave it')
    L.push('off in an empty void world if you want the box cleared. Expect the paste to take minutes and the lighting')
    L.push('to settle after it (`//fixlighting` in FAWE, or relog). The vanilla `/place template` route only works')
    L.push('for structures up to 48 x 48 x 48 per piece, so it is not for this one.', '')
  }

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
      L.push('Name plates over the NPCs (2.4 above their feet, higher by 0.28 per extra line):', '')
      code(npcs.flatMap(p => [`dh hologram create npc-${slugId(p.id)} -l:${world}:${p.world.hologram.join(':')} ${p.label}`, ...(p.lines ?? []).map(line => `dh line add npc-${slugId(p.id)} 1 ${line}`)]))
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
    // prefixed like the others (npc-, lb-, crate-), so a hologram never takes an NPC's or a board's name
    code(holos.flatMap(p => [`dh hologram create holo-${slugId(p.id)} -l:${world}:${p.world.pos.join(':')} ${p.label}`, ...(p.lines ?? []).map(line => `dh line add holo-${slugId(p.id)} 1 ${line}`)]))
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

export function summarize(structure) {
  const blocks = structure.getBlocks()
  return {
    size: structure.getSize(),
    blockCount: blocks.length,
    paletteCount: new Set(blocks.map(block => block.state.toString())).size,
  }
}
