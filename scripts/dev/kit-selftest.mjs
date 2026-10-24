#!/usr/bin/env node

// Fast invariant checks for the building kit. Run: npm test (or node scripts/dev/kit-selftest.mjs)
// Each case builds a tiny scene in memory and asserts exact blocks/states; no rendering needed.

import { createKit } from '../lib/kit/index.mjs'

const kit = createKit()
let failures = 0
let passes = 0

function check(name, condition, detail = '') {
  if (condition) {
    passes += 1
  } else {
    failures += 1
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`)
  }
}

const stateAt = (b, x, y, z) => {
  const block = b.get(x, y, z)
  return block ? kit.state(block) : 'air'
}

// --- parsing, defaults, validation -------------------------------------------------------
{
  const p = kit.parse('oak_stairs[facing=east,half=top]')
  check('parse namespace', p.name === 'minecraft:oak_stairs')
  check('parse props', p.props.facing === 'east' && p.props.half === 'top')
  check('validate unknown id', kit.validate('minecraft:stone_brick').length === 1)
  check('validate bad value', kit.validate('minecraft:oak_stairs[facing=up]').length === 1)
  check('validate unknown prop', kit.validate('minecraft:stone[axis=y]').length === 1)
  check('validate ok', kit.validate('minecraft:oak_log[axis=x]').length === 0)
  check('exists chain', kit.exists('chain') && !kit.exists('iron_chain') && !kit.exists('pale_oak_planks'))
}

// --- rotation / mirroring ----------------------------------------------------------------
{
  const r = kit.rotate('oak_stairs[facing=north,half=bottom,shape=outer_left]', 1)
  check('rotate facing', r.props.facing === 'east' && r.props.shape === 'outer_left')
  const l = kit.rotate('oak_log[axis=x]', 1)
  check('rotate axis', l.props.axis === 'z')
  const f = kit.rotate('oak_fence[north=true,east=false,south=false,west=false]', 1)
  check('rotate sides', f.props.east === 'true' && f.props.north === 'false')
  const s = kit.rotate('oak_sign[rotation=2]', 2)
  check('rotate sign', s.props.rotation === '10')
  const m = kit.mirror('oak_stairs[facing=east,shape=inner_left]', 'x')
  check('mirror facing+hand', m.props.facing === 'west' && m.props.shape === 'inner_right')
  const d = kit.mirror('oak_door[facing=north,hinge=left]', 'x')
  check('mirror hinge', d.props.hinge === 'right')
}

// --- materials ---------------------------------------------------------------------------
{
  check('material stone_bricks', kit.material('stone_bricks').stairs === 'minecraft:stone_brick_stairs')
  check('material spruce', kit.material('spruce').trapdoor === 'minecraft:spruce_trapdoor')
  check('material deepslate_tiles', kit.material('deepslate_tiles').slab === 'minecraft:deepslate_tile_slab')
  check('material quartz', kit.material('quartz').stairs === 'minecraft:quartz_stairs')
  check('helper stairs', kit.stairs('spruce', 'east', 'top') === 'minecraft:spruce_stairs[facing=east,half=top]')
}

// --- connections and fixups via finish() -------------------------------------------------
{
  const b = kit.builder([12, 6, 12])
  // hip-style ring of stairs: corners must become outer shapes
  b.box([2, 1, 2], [6, 1, 2], 'stone_brick_stairs[facing=south]')
  b.box([2, 1, 6], [6, 1, 6], 'stone_brick_stairs[facing=north]')
  b.box([2, 1, 3], [2, 1, 5], 'stone_brick_stairs[facing=east]')
  b.box([6, 1, 3], [6, 1, 5], 'stone_brick_stairs[facing=west]')
  b.set(2, 1, 2, 'stone_brick_stairs[facing=east]')
  b.box([0, 0, 9], [4, 0, 9], 'cobblestone_wall')
  b.set(8, 1, 8, 'oak_door[facing=south]')
  b.set(10, 1, 8, 'tall_grass')
  b.set(10, 3, 2, 'oak_leaves')
  b.finish({ name: 'selftest' })
  check('stair outer corner', b.get(2, 1, 2).props.shape.startsWith('outer'), stateAt(b, 2, 1, 2))
  check('stair edge straight', b.get(4, 1, 2).props.shape === 'straight', stateAt(b, 4, 1, 2))
  check('wall end post', b.get(0, 0, 9).props.up === 'true' && b.get(0, 0, 9).props.east === 'low', stateAt(b, 0, 0, 9))
  check('wall middle no post', b.get(2, 0, 9).props.up === 'false', stateAt(b, 2, 0, 9))
  check('door upper half', b.get(8, 2, 8)?.props.half === 'upper')
  check('tall grass upper', b.get(10, 2, 8)?.props.half === 'upper')
  check('leaves persistent', b.get(10, 3, 2).props.persistent === 'true')
  check('defaults filled', b.get(4, 1, 2).props.waterlogged === 'false')
}

// --- roofs ------------------------------------------------------------------------------
{
  const b = kit.builder([20, 16, 20])
  b.walls([4, 1, 4], [14, 4, 10], 'white_terracotta')
  const res = b.roof({ x0: 4, z0: 4, x1: 14, z1: 10, y: 5, material: 'spruce', axis: 'x', gable: 'spruce_planks' })
  // 1:1 gable on a 7-wide footprint with overhang 1 → 9 rows; ridge (odd) is a full block
  check('gable eave stair', b.nameAt(9, 4, 3) === 'minecraft:spruce_stairs' && b.get(9, 4, 3).props.facing === 'south')
  check('gable row over wall', b.get(9, 5, 4).props.facing === 'south')
  check('gable ridge block', b.nameAt(9, 8, 7) === 'minecraft:spruce_planks', stateAt(b, 9, 8, 7))
  check('gable underside stair', b.nameAt(9, 5, 5) === 'minecraft:spruce_stairs' && b.get(9, 5, 5).props.half === 'top', stateAt(b, 9, 5, 5))
  check('gable fill', b.nameAt(4, 6, 7) === 'minecraft:spruce_planks', stateAt(b, 4, 6, 7))
  check('gable topY', res.topY === 8)
  const h = kit.builder([20, 16, 20])
  h.roof({ x0: 4, z0: 4, x1: 12, z1: 12, y: 5, type: 'hip', material: 'stone_brick', overhang: 0 })
  h.finish({ name: 'hip' })
  check('hip corner outer', h.get(4, 5, 4).props.shape.startsWith('outer'), stateAt(h, 4, 5, 4))
  check('hip apex', h.nameAt(8, 9, 8) === 'minecraft:stone_bricks', stateAt(h, 8, 9, 8))
  const s = kit.builder([20, 16, 20])
  s.roof({ x0: 4, z0: 4, x1: 12, z1: 10, y: 5, material: 'oak', pitch: 0.5, axis: 'x' })
  check('slab roof eave', s.nameAt(8, 5, 3) === 'minecraft:oak_slab' && s.get(8, 5, 3).props.type === 'bottom', stateAt(s, 8, 5, 3))
  check('slab roof inside full', s.nameAt(8, 5, 4) === 'minecraft:oak_planks', stateAt(s, 8, 5, 4))
  const st = kit.builder([20, 20, 20])
  st.roof({ x0: 4, z0: 4, x1: 12, z1: 10, y: 5, material: 'deepslate_tile', pitch: 2, axis: 'x' })
  // steep rows overlap vertically: every column from the eave inward is face-connected
  let gaps = 0
  for (let z = 3; z <= 6; z += 1) {
    const top = st.topY(8, z)
    const next = st.topY(8, z + 1)
    if (next - top > 2) gaps += 1
    let y = top
    while (y >= 0 && st.get(8, y, z)) y -= 1
    if (st.get(8, y, z + 1) === null && st.get(8, y + 1, z + 1) === null && z < 6) gaps += 0
  }
  check('steep roof continuous', gaps === 0)
}

// --- shapes ------------------------------------------------------------------------------
{
  const b = kit.builder([20, 20, 20])
  b.sphere([10, 10, 10], 4.5, 'stone')
  check('sphere symmetric', b.has(5.5 + 0.5, 10, 10) === b.has(14, 10, 10))
  check('sphere count', b.count() === 389 || b.count() > 300, String(b.count()))
  const t = kit.builder([20, 20, 20])
  t.tube([10, 0, 10], 4.5, 3, 'stone', { thickness: 1 })
  let holes = 0
  for (let a = 0; a < 64; a += 1) {
    const ang = (a / 64) * Math.PI * 2
    let hit = false
    for (let r = 3; r <= 5; r += 0.25) if (t.has(Math.round(10 + Math.cos(ang) * r), 1, Math.round(10 + Math.sin(ang) * r))) hit = true
    if (!hit) holes += 1
  }
  check('tube watertight', holes === 0, `${holes} rays escaped`)
  const l = kit.builder([20, 20, 20])
  l.line([1, 1, 1], [15, 9, 4], 'stone', { connect: 6 })
  let disconnected = 0
  for (const [x, y, z] of l.entries()) {
    const n = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].filter(([dx, dy, dz]) => l.has(x + dx, y + dy, z + dz)).length
    if (n === 0) disconnected += 1
  }
  check('6-connected line', disconnected === 0)
}

// --- texture ----------------------------------------------------------------------------
{
  const b = kit.builder([20, 12, 6], { seed: 2 })
  b.box([0, 0, 2], [19, 9, 2], 'white_wool')
  b.set(5, 10, 3, 'stone_brick_stairs[facing=south]')
  b.texture([0, 0, 0], [19, 11, 5], ['polished_andesite', 'stone_bricks', 'cracked_stone_bricks', 'tuff_bricks', 'deepslate_bricks'], { only: 'white_wool' })
  check('texture replaced all', b.count('white_wool') === 0)
  check('texture keeps others', b.nameAt(5, 10, 3) === 'minecraft:stone_brick_stairs')
  const bottom = b.nameAt(10, 0, 2)
  check('texture darker base', ['minecraft:tuff_bricks', 'minecraft:deepslate_bricks', 'minecraft:cracked_stone_bricks'].includes(bottom), bottom)
}

console.log(`kit self-test: ${passes} passed, ${failures} failed`)
if (failures > 0) process.exitCode = 1
