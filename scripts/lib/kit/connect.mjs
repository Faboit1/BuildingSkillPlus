// Vanilla-accurate neighbour-dependent block states, ported from Minecraft's block logic:
// stairs shapes (StairBlock), wall sides/posts (WallBlock), fences (FenceBlock), panes and
// iron bars (IronBarsBlock) and fence gates in walls (FenceGateBlock).
// When a structure is placed with /place template the game recomputes these from
// neighbours, so computing them here makes the preview match what players will see.

import {
  DIR,
  HORIZONTAL,
  axisOf,
  ccw,
  cw,
  isFence,
  isFenceGate,
  isFullSolid,
  isLeaves,
  isPaneLike,
  isSlab,
  isStairs,
  isWall,
  opposite,
} from './blocks.mjs'

const CONNECTION_EXCEPTIONS = /(_leaves|^minecraft:barrier|carved_pumpkin|jack_o_lantern|^minecraft:melon|^minecraft:pumpkin|shulker_box)$/

const NON_COLLIDING = /(^minecraft:(short_grass|grass|tall_grass|fern|large_fern|dead_bush|vine|glow_lichen|snow|sculk_vein|light|water|lava|air|cave_air|structure_void|redstone_wire|tripwire|moss_carpet|seagrass|tall_seagrass|kelp|kelp_plant|sugar_cane|cobweb|pink_petals|sweet_berry_bush|bubble_column))$|_sapling$|(dandelion|poppy|orchid|allium|bluet|tulip|daisy|cornflower|lily_of_the_valley|wither_rose|torchflower|sunflower|lilac|rose_bush|peony)$/

const WALL_POST_OVERRIDE = /(torch|_sign|_banner|_pressure_plate|^minecraft:tripwire)$/

const isWoodenFence = name => isFence(name) && name !== 'minecraft:nether_brick_fence'

// Is the face of `block` that points toward `towardDir` sturdy (full square)?
function sturdyFace(block, towardDir) {
  if (!block) return false
  const { name, props } = block
  if (isFullSolid(name)) return true
  if (isSlab(name)) {
    const type = props?.type ?? 'bottom'
    if (type === 'double') return true
    if (towardDir === 'up') return type === 'top'
    if (towardDir === 'down') return type === 'bottom'
    return false
  }
  if (isStairs(name)) {
    const half = props?.half ?? 'bottom'
    if (towardDir === 'up') return half === 'top'
    if (towardDir === 'down') return half === 'bottom'
    return props?.facing === towardDir && (props?.shape ?? 'straight') === 'straight'
  }
  return false
}

function gateConnects(gate, dir) {
  const facing = gate.props?.facing ?? 'north'
  return axisOf(facing) === axisOf(cw(dir))
}

function stairsShape(get, x, y, z, block) {
  const facing = block.props?.facing ?? 'north'
  const half = block.props?.half ?? 'bottom'
  const at = (dir, base = [x, y, z]) => {
    const d = DIR[dir]
    return [base[0] + d[0], base[1] + d[1], base[2] + d[2]]
  }
  const sameHalfStairs = b => b && isStairs(b.name) && (b.props?.half ?? 'bottom') === half
  const canTakeShape = face => {
    const p = at(face)
    const other = get(p[0], p[1], p[2])
    return !(other && isStairs(other.name) && (other.props?.facing ?? 'north') === facing && (other.props?.half ?? 'bottom') === half)
  }
  const front = at(facing)
  const frontBlock = get(front[0], front[1], front[2])
  if (sameHalfStairs(frontBlock)) {
    const d1 = frontBlock.props?.facing ?? 'north'
    if (axisOf(d1) !== axisOf(facing) && canTakeShape(opposite(d1))) {
      return d1 === ccw(facing) ? 'outer_left' : 'outer_right'
    }
  }
  const back = at(opposite(facing))
  const backBlock = get(back[0], back[1], back[2])
  if (sameHalfStairs(backBlock)) {
    const d2 = backBlock.props?.facing ?? 'north'
    if (axisOf(d2) !== axisOf(facing) && canTakeShape(d2)) {
      return d2 === ccw(facing) ? 'inner_left' : 'inner_right'
    }
  }
  return 'straight'
}

// Recomputes connection states for every block in a Builder-like store.
// store: { get(x,y,z) → {name, props} | null, entries() → iterable of [x,y,z,block], put(x,y,z,block) }
// Returns the number of blocks whose state changed.
export function updateConnections(store, { stairs = true, walls = true, fences = true, panes = true, gates = true } = {}) {
  const get = (x, y, z) => store.get(x, y, z)
  const updates = []
  const neighbor = (x, y, z, dir) => {
    const d = DIR[dir]
    return get(x + d[0], y + d[1], z + d[2])
  }

  // Walls must be processed top-down because a wall's post depends on the wall above it.
  const wallList = []

  for (const [x, y, z, block] of store.entries()) {
    const { name } = block
    if (stairs && isStairs(name)) {
      const shape = stairsShape(get, x, y, z, block)
      if ((block.props?.shape ?? 'straight') !== shape || !block.props?.shape) {
        updates.push([x, y, z, { name, props: { facing: 'north', half: 'bottom', waterlogged: 'false', ...block.props, shape } }])
      }
    } else if (walls && isWall(name)) {
      wallList.push([x, y, z, block])
    } else if ((fences && isFence(name)) || (panes && isPaneLike(name))) {
      const props = { ...(block.props ?? {}) }
      for (const dir of HORIZONTAL) {
        const n = neighbor(x, y, z, dir)
        let connects = false
        if (n) {
          const sideSolid = !CONNECTION_EXCEPTIONS.test(n.name) && sturdyFace(n, opposite(dir))
          if (isFence(name)) {
            connects = sideSolid ||
              (isFence(n.name) && isWoodenFence(n.name) === isWoodenFence(name)) ||
              (isFenceGate(n.name) && gateConnects(n, opposite(dir)))
          } else {
            connects = sideSolid || isPaneLike(n.name) || isWall(n.name)
          }
        }
        props[dir] = connects ? 'true' : 'false'
      }
      if (props.waterlogged === undefined) props.waterlogged = 'false'
      if (HORIZONTAL.some(d => props[d] !== block.props?.[d]) || !block.props?.waterlogged) updates.push([x, y, z, { name, props }])
    } else if (gates && isFenceGate(name)) {
      const facing = block.props?.facing ?? 'north'
      const left = neighbor(x, y, z, ccw(facing))
      const right = neighbor(x, y, z, cw(facing))
      const inWall = (left && isWall(left.name)) || (right && isWall(right.name)) ? 'true' : 'false'
      if (block.props?.in_wall !== inWall) {
        updates.push([x, y, z, { name, props: { facing, open: 'false', powered: 'false', ...block.props, in_wall: inWall } }])
      }
    }
  }

  for (const [x, y, z, block] of updates) store.put(x, y, z, block)
  let changed = updates.length

  wallList.sort((a, b) => b[1] - a[1])
  for (const [x, y, z, block] of wallList) {
    const above = get(x, y + 1, z)
    const props = { ...(block.props ?? {}) }
    for (const dir of HORIZONTAL) {
      const n = neighbor(x, y, z, dir)
      let connects = false
      if (n) {
        connects = isWall(n.name) ||
          (!CONNECTION_EXCEPTIONS.test(n.name) && sturdyFace(n, opposite(dir))) ||
          isPaneLike(n.name) ||
          (isFenceGate(n.name) && gateConnects(n, dir))
      }
      if (!connects) {
        props[dir] = 'none'
      } else {
        const tall = above && (
          sturdyFace(above, 'down') ||
          /_carpet$/.test(above.name) ||
          (isWall(above.name) && (above.props?.[dir] ?? 'none') !== 'none') ||
          isFullSolid(above.name)
        )
        props[dir] = tall ? 'tall' : 'low'
      }
    }
    props.up = shouldRaisePost(props, above) ? 'true' : 'false'
    if (props.waterlogged === undefined) props.waterlogged = 'false'
    const before = block.props ?? {}
    if (['north', 'east', 'south', 'west', 'up', 'waterlogged'].some(k => before[k] !== props[k])) {
      store.put(x, y, z, { name: block.name, props })
      changed += 1
    }
  }
  return changed
}

function shouldRaisePost(props, above) {
  if (above && isWall(above.name) && above.props?.up === 'true') return true
  const n = props.north === 'none'
  const s = props.south === 'none'
  const e = props.east === 'none'
  const w = props.west === 'none'
  if ((n && s && w && e) || n !== s || w !== e) return true
  if ((props.north === 'tall' && props.south === 'tall') || (props.east === 'tall' && props.west === 'tall')) return false
  if (!above) return false
  if (WALL_POST_OVERRIDE.test(above.name)) return true
  return !NON_COLLIDING.test(above.name)
}

// Leaves placed by structures decay unless persistent=true. Returns count changed.
export function persistLeaves(store) {
  let changed = 0
  for (const [x, y, z, block] of store.entries()) {
    if (isLeaves(block.name) && block.props?.persistent !== 'true') {
      store.put(x, y, z, { name: block.name, props: { distance: '7', waterlogged: 'false', ...block.props, persistent: 'true' } })
      changed += 1
    }
  }
  return changed
}
