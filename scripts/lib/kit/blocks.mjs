// Block ids, block states, directions, rotation/mirroring and pack-backed validation.
// Everything here is pure data manipulation; the Builder uses it for every placed block.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ------------------------------------------------------------------ directions

// Horizontal directions in clockwise order when viewed from above (north = -z, east = +x).
export const HORIZONTAL = ['north', 'east', 'south', 'west']

export const DIR = {
  north: [0, 0, -1],
  south: [0, 0, 1],
  east: [1, 0, 0],
  west: [-1, 0, 0],
  up: [0, 1, 0],
  down: [0, -1, 0],
}

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' }

export const opposite = dir => OPPOSITE[dir]
export const cw = (dir, turns = 1) => {
  const index = HORIZONTAL.indexOf(dir)
  if (index < 0) return dir
  return HORIZONTAL[(((index + turns) % 4) + 4) % 4]
}
export const ccw = (dir, turns = 1) => cw(dir, -turns)

// Dominant horizontal direction of a vector (dx, dz). Ties prefer the x axis.
export function facingFrom(dx, dz) {
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 'east' : 'west'
  return dz >= 0 ? 'south' : 'north'
}

// Dominant direction of a 3D vector, including up/down.
export function facing3d(dx, dy, dz) {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  const az = Math.abs(dz)
  if (ay >= ax && ay >= az) return dy >= 0 ? 'up' : 'down'
  return facingFrom(dx, dz)
}

export const axisOf = dir => (dir === 'east' || dir === 'west' ? 'x' : dir === 'up' || dir === 'down' ? 'y' : 'z')

// ------------------------------------------------------------------ block parsing

const parseCache = new Map()

export function withNamespace(name) {
  const value = String(name).trim()
  return value.includes(':') ? value : `minecraft:${value}`
}

// Parses 'oak_stairs[facing=east,half=top]' / 'minecraft:stone' / { name, props } into
// a frozen { name, props } record. props is null when the block has no properties.
export function parseBlock(spec) {
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    const name = withNamespace(spec.name ?? spec.id)
    const props = spec.props ?? spec.properties
    return { name, props: props && Object.keys(props).length > 0 ? { ...props } : null }
  }
  const key = String(spec)
  const cached = parseCache.get(key)
  if (cached) return cached
  const open = key.indexOf('[')
  let name
  let props = null
  if (open < 0) {
    name = withNamespace(key)
  } else {
    if (!key.endsWith(']')) throw new Error(`Malformed block state: ${key}`)
    name = withNamespace(key.slice(0, open))
    const body = key.slice(open + 1, -1).trim()
    if (body) {
      props = {}
      for (const part of body.split(',')) {
        const eq = part.indexOf('=')
        if (eq < 0) throw new Error(`Malformed block state property "${part}" in ${key}`)
        props[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
      }
    }
  }
  const parsed = Object.freeze({ name, props: props ? Object.freeze(props) : null })
  parseCache.set(key, parsed)
  return parsed
}

export function stateString(block) {
  const { name, props } = block
  if (!props) return name
  const keys = Object.keys(props)
  if (keys.length === 0) return name
  return `${name}[${keys.map(k => `${k}=${props[k]}`).join(',')}]`
}

export const shortName = name => String(name).replace(/^minecraft:/, '')

// Returns a new block record with merged properties.
export function withProps(block, extra) {
  const parsed = parseBlock(block)
  return { name: parsed.name, props: { ...(parsed.props ?? {}), ...extra } }
}

// ------------------------------------------------------------------ rotation / mirroring

const RAIL_SHAPES = {
  north_south: 'east_west',
  east_west: 'north_south',
  ascending_north: 'ascending_east',
  ascending_east: 'ascending_south',
  ascending_south: 'ascending_west',
  ascending_west: 'ascending_north',
  north_east: 'south_east',
  south_east: 'south_west',
  south_west: 'north_west',
  north_west: 'north_east',
}

const HANDED_SWAP = {
  inner_left: 'inner_right',
  inner_right: 'inner_left',
  outer_left: 'outer_right',
  outer_right: 'outer_left',
}

// Rotates a block state clockwise (seen from above) by 90° * turns around the Y axis.
export function rotateBlock(block, turns = 1) {
  const parsed = parseBlock(block)
  const t = ((turns % 4) + 4) % 4
  if (t === 0 || !parsed.props) return parsed
  const p = { ...parsed.props }
  const out = { ...p }
  if (HORIZONTAL.includes(p.facing)) out.facing = cw(p.facing, t)
  if (p.axis === 'x' || p.axis === 'z') out.axis = t % 2 === 1 ? (p.axis === 'x' ? 'z' : 'x') : p.axis
  if (p.rotation !== undefined && /^\d+$/.test(p.rotation)) out.rotation = String((Number(p.rotation) + 4 * t) % 16)
  if (HORIZONTAL.some(d => d in p)) {
    for (const d of HORIZONTAL) delete out[d]
    for (const d of HORIZONTAL) if (d in p) out[cw(d, t)] = p[d]
  }
  if (p.shape && RAIL_SHAPES[p.shape]) {
    let shape = p.shape
    for (let i = 0; i < t; i += 1) shape = RAIL_SHAPES[shape]
    out.shape = shape
  }
  if (p.orientation) {
    const [a, b] = p.orientation.split('_')
    out.orientation = `${HORIZONTAL.includes(a) ? cw(a, t) : a}_${HORIZONTAL.includes(b) ? cw(b, t) : b}`
  }
  return { name: parsed.name, props: out }
}

// Mirrors a block state across the plane perpendicular to `axis` ('x' flips east/west,
// 'z' flips north/south). Handed states (stair corners, door hinges) swap sides.
export function mirrorBlock(block, axis = 'x') {
  const parsed = parseBlock(block)
  if (!parsed.props) return parsed
  const p = parsed.props
  const out = { ...p }
  const flip = d => {
    if (axis === 'x' && (d === 'east' || d === 'west')) return opposite(d)
    if (axis === 'z' && (d === 'north' || d === 'south')) return opposite(d)
    return d
  }
  if (p.facing) out.facing = flip(p.facing)
  if (HORIZONTAL.some(d => d in p)) {
    for (const d of HORIZONTAL) delete out[d]
    for (const d of HORIZONTAL) if (d in p) out[flip(d)] = p[d]
  }
  if (p.rotation !== undefined && /^\d+$/.test(p.rotation)) {
    const r = Number(p.rotation)
    out.rotation = String(axis === 'x' ? (16 - r) % 16 : (24 - r) % 16)
  }
  if (p.shape && HANDED_SWAP[p.shape]) out.shape = HANDED_SWAP[p.shape]
  if (p.shape && RAIL_SHAPES[p.shape]) {
    out.shape = p.shape.split('_').map(part => (HORIZONTAL.includes(part) ? flip(part) : part)).join('_')
    if (out.shape === 'south_north') out.shape = 'north_south'
    if (out.shape === 'west_east') out.shape = 'east_west'
    if (/^(south|north)_(east|west)$/.test(out.shape) === false && /^(east|west)_(north|south)$/.test(out.shape)) {
      const [a, b] = out.shape.split('_')
      out.shape = `${b}_${a}`
    }
  }
  if (p.hinge) out.hinge = p.hinge === 'left' ? 'right' : 'left'
  return { name: parsed.name, props: out }
}

// ------------------------------------------------------------------ pack data

let packCache

function lodestoneRoot() {
  const indexPath = fileURLToPath(import.meta.resolve('@mattzh72/lodestone'))
  return path.resolve(path.dirname(indexPath), '..')
}

// Loads block ids, valid property values and render flags from Lodestone's default pack
// (the same 1.21 resource data the previewer uses). Cached after first use.
export function pack() {
  if (packCache) return packCache
  const root = path.join(lodestoneRoot(), 'assets', 'default-pack')
  const assets = JSON.parse(fs.readFileSync(path.join(root, 'assets.json'), 'utf8'))
  const readList = file => new Set(
    fs.readFileSync(path.join(root, 'block-flags', file), 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(withNamespace),
  )
  const ids = new Set()
  const propertyValues = new Map()
  for (const [id, def] of Object.entries(assets.blockstates)) {
    const name = withNamespace(id)
    ids.add(name)
    const values = new Map()
    const add = (key, value) => {
      if (!values.has(key)) values.set(key, new Set())
      for (const v of String(value).split('|')) values.get(key).add(v)
    }
    if (def.variants) {
      for (const variantKey of Object.keys(def.variants)) {
        if (!variantKey) continue
        for (const part of variantKey.split(',')) {
          const [key, value] = part.split('=')
          if (key && value !== undefined) add(key, value)
        }
      }
    }
    if (def.multipart) {
      const visit = when => {
        if (!when) return
        if (Array.isArray(when.OR)) when.OR.forEach(visit)
        else if (Array.isArray(when.AND)) when.AND.forEach(visit)
        else for (const [key, value] of Object.entries(when)) add(key, value)
      }
      for (const part of def.multipart) visit(part.when)
    }
    propertyValues.set(name, values)
  }
  // Multipart defs only list "true" sides; their implicit defaults are valid too.
  for (const values of propertyValues.values()) {
    for (const [key, set] of values) {
      if (set.has('true')) set.add('false')
      if (['north', 'east', 'south', 'west', 'up', 'down'].includes(key) && (set.has('low') || set.has('tall') || set.has('side'))) set.add('none')
    }
  }
  const emissive = JSON.parse(fs.readFileSync(path.join(root, 'block-flags', 'emissive.json'), 'utf8'))
  packCache = {
    ids,
    propertyValues,
    opaque: readList('opaque.txt'),
    transparent: readList('transparent.txt'),
    emissive: new Set(Object.keys(emissive).map(withNamespace)),
  }
  return packCache
}

// ------------------------------------------------------------------ vanilla block states

let statesCache
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')

// Official property lists and default states for every block, generated from Minecraft's
// own data report (scripts/dev/gen-block-states.mjs). Falls back to the pack data.
export function vanillaStates() {
  if (statesCache !== undefined) return statesCache
  try {
    statesCache = JSON.parse(fs.readFileSync(path.join(dataDir, 'block-states.json'), 'utf8'))
  } catch {
    statesCache = null
  }
  return statesCache
}

export function blockExists(name) {
  const id = withNamespace(name)
  const states = vanillaStates()
  if (states) return id in states.blocks
  return pack().ids.has(id)
}

// Adds the block's default value for every property that is not set. The game does this
// implicitly; the previewer does not (a block missing e.g. axis= or snowy= renders as
// nothing), so every block gets complete properties before export.
export function withDefaults(block) {
  const parsed = parseBlock(block)
  const def = vanillaStates()?.blocks[parsed.name]
  if (!def || !def.d) return parsed
  const props = parsed.props ?? {}
  let missing = false
  for (const key of Object.keys(def.d)) {
    if (!(key in props)) {
      missing = true
      break
    }
  }
  if (!missing) return parsed
  return { name: parsed.name, props: { ...def.d, ...props } }
}

// Returns human-readable problems with a block state: unknown id, unknown property,
// invalid value. Uses the official state table when available.
export function validateBlock(block) {
  const { name, props } = parseBlock(block)
  const states = vanillaStates()
  if (states) {
    const def = states.blocks[name]
    if (!def) return [`unknown block id ${name}`]
    const problems = []
    for (const [key, value] of Object.entries(props ?? {})) {
      const allowed = def.v?.[key]
      if (!allowed) problems.push(`${name}: unknown property "${key}" (valid: ${Object.keys(def.v ?? {}).join(', ') || 'none'})`)
      else if (!allowed.includes(String(value))) problems.push(`${name}: ${key}=${value} is not one of ${allowed.join('|')}`)
    }
    return problems
  }
  const data = pack()
  if (!data.ids.has(name)) return [`unknown block id ${name}`]
  const problems = []
  const values = data.propertyValues.get(name)
  if (props && values) {
    for (const [key, value] of Object.entries(props)) {
      const allowed = values.get(key)
      if (allowed && !allowed.has(value)) problems.push(`${name}: ${key}=${value} is not one of ${[...allowed].join('|')}`)
    }
  }
  return problems
}

// ------------------------------------------------------------------ block classes

const GLASS_LIKE = /(^|_)glass$|^minecraft:tinted_glass$/

let fullCubes
// A full cube whose faces are sturdy (walls/panes/fences connect to it, wall posts rise
// under it). Uses the shape-derived `full` flag from data/block-colors.json (the pack's
// opaque list has known errors), falling back to that list plus glass.
export function isFullSolid(name) {
  const n = withNamespace(name)
  if (fullCubes === undefined) {
    try {
      const colors = JSON.parse(fs.readFileSync(path.join(dataDir, 'block-colors.json'), 'utf8'))
      const entries = colors.blocks ?? colors
      fullCubes = new Set(Object.entries(entries).filter(([, v]) => v && v.full).map(([k]) => withNamespace(k)))
    } catch {
      fullCubes = null
    }
  }
  if (fullCubes) return fullCubes.has(n) || GLASS_LIKE.test(n) || /^minecraft:(ice|packed_ice|blue_ice)$/.test(n)
  return pack().opaque.has(n) || GLASS_LIKE.test(n) || n === 'minecraft:ice' || n === 'minecraft:packed_ice'
}

export const isStairs = name => /_stairs$/.test(name)
export const isSlab = name => /_slab$/.test(name)
export const isWall = name => /_wall$/.test(name) && !/(wall_torch|wall_sign|wall_banner|wall_head|wall_skull|wall_hanging_sign|_wall_fan)$/.test(name)
export const isFence = name => /_fence$/.test(name)
export const isFenceGate = name => /_fence_gate$/.test(name)
export const isPaneLike = name => /_pane$|^minecraft:iron_bars$/.test(name)
export const isLeaves = name => /_leaves$/.test(name)
export const isLog = name => /_(log|wood|stem|hyphae)$/.test(name) || /^minecraft:(bamboo_block|stripped_bamboo_block)$/.test(name)
export const isAir = name => name === 'minecraft:air' || name === 'minecraft:cave_air' || name === 'minecraft:void_air'
export const isFluid = name => name === 'minecraft:water' || name === 'minecraft:lava'
export const isEmissive = name => pack().emissive.has(withNamespace(name))
