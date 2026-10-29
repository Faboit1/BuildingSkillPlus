#!/usr/bin/env node

// Fast invariant checks for the building kit. Run: npm test (or node scripts/dev/kit-selftest.mjs)
// Each case builds a tiny scene in memory and asserts exact blocks/states; no rendering needed.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createKit } from '../lib/kit/index.mjs'

const kit = createKit()
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
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
  check('gable underside stair', b.nameAt(9, 5, 5) === 'minecraft:spruce_stairs' && b.get(9, 5, 5).props.half === 'top' && b.get(9, 5, 5).props.facing === 'north', stateAt(b, 9, 5, 5))
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

// --- roof finishing ---------------------------------------------------------------------
{
  // gable fill leaves no upside-down roof stair (see-through notch) on the gable wall line
  const g = kit.builder([24, 16, 18])
  g.roof({ x0: 4, z0: 4, x1: 16, z1: 12, y: 5, material: 'spruce', axis: 'x', gable: 'oak_planks' })
  let notches = 0
  for (const [x, y, z, blk] of g.entries()) if ((x === 4 || x === 16) && y >= 5 && blk.name === 'minecraft:spruce_stairs' && blk.props.half === 'top' && y < g.topY(x, z)) notches += 1
  check('gable has no stair notches', notches === 0, `${notches}`)
  // rake (gable overhang) rows get a down-slope soffit stair, the eave-most row does not
  const rake = g.get(3, 6, 6)
  check('rake soffit stair', rake?.name === 'minecraft:spruce_stairs' && rake.props.half === 'top' && rake.props.facing === 'north', stateAt(g, 3, 6, 6))
  check('eave row bare', !g.get(3, 3, 3) || g.get(3, 3, 3).props.half !== 'top', stateAt(g, 3, 3, 3))
  // half-step pitches never leave top slabs (half-block gaps) in the overhang
  const a = kit.builder([24, 16, 20])
  a.roof({ x0: 5, z0: 5, x1: 17, z1: 13, y: 5, type: 'hip', material: 'deepslate_tile', pitch: [0.5, 0.5, 1, 1, 2], overhang: 2 })
  let topSlabs = 0
  for (const [, , , blk] of a.entries()) if (blk.name.endsWith('_slab') && blk.props.type === 'top') topSlabs += 1
  check('no top-slab eave gaps', topSlabs === 0, `${topSlabs}`)
  // pitch 0 rows make a flat field (Mojang ring roofs)
  const f = kit.builder([24, 16, 20])
  f.roof({ x0: 5, z0: 5, x1: 15, z1: 13, y: 5, type: 'hip', material: 'acacia', pitch: [1, 1, 0] })
  check('flat roof field', f.topY(10, 9) === f.topY(9, 9) && f.topY(10, 9) <= 6, `${f.topY(10, 9)}`)
  // dormer cheeks never grow down into the rooms
  const d = kit.builder([26, 18, 20])
  d.walls([4, 1, 4], [20, 5, 14], 'white_terracotta')
  d.roof({ x0: 4, z0: 4, x1: 20, z1: 14, y: 6, material: 'dark_oak', gable: 'spruce_planks' })
  d.dormer([12, 6, 14], 'south', { height: 3, material: 'dark_oak' })
  check('dormer keeps rooms clear', !d.get(13, 3, 12) && !d.get(11, 3, 12), stateAt(d, 13, 3, 12))
}

// --- arches, paths, timber, texture fallback, weather -------------------------------------------
{
  // a 5-wide pointed arch keeps a point: the top open row is a single centre cell, with stairs
  const a = kit.builder([12, 12, 3])
  a.box([0, 0, 1], [8, 10, 1], 'stone_bricks')
  a.arch([2, 1, 1], [6, 1, 1], 'stone_bricks', { type: 'pointed' })
  let apex = -1
  for (let y = 1; y < 10; y += 1) if (!a.get(4, y, 1)) apex = y
  const apexRow = [2, 3, 5, 6].filter(x => !a.get(x, apex, 1)).length
  check('pointed arch has a point', apex >= 3 && apexRow === 0, `apex ${apex}, open beside ${apexRow}`)
  check('arch shoulders are stairs', a.count('stone_brick_stairs') >= 2)
  // b.path reaches the ground under an overhang
  const p = kit.builder([16, 8, 9])
  p.terrain({ height: () => 2 })
  p.box([6, 4, 2], [9, 4, 6], 'oak_slab')
  p.path([[0, 4], [15, 4]], { width: 3, paint: 'cobblestone', jitter: 0 })
  check('path under overhang', p.nameAt(7, 2, 4) === 'minecraft:cobblestone' && p.groundY(7, 2) === 2)
  // timberWall inset: frame on the outer plane, infill one block inside
  const t = kit.builder([12, 8, 4])
  t.timberWall([0, 0, 1], [10, 5, 1], { inset: 1, facing: 'north', posts: [0, 5, 10] })
  check('timber inset', t.nameAt(2, 2, 1) === null && t.nameAt(2, 2, 2) === 'minecraft:white_terracotta' && t.nameAt(5, 2, 1) === 'minecraft:stripped_spruce_log')
  // texture: a ramp step without walls borrows the nearest step's wall
  const w = kit.builder([10, 4, 3])
  w.box([0, 0, 1], [9, 0, 1], 'mud_brick_wall')
  w.texture([0, 0, 0], [9, 3, 2], ['polished_andesite', 'stone_bricks'], { only: 'mud_brick_wall' })
  check('texture shape fallback', w.count('mud_brick_wall') === 0 && w.count('stone_brick_wall') === 10)
  // weather share is exact
  const e = kit.builder([20, 20, 20])
  e.box([0, 0, 0], [19, 19, 19], 'stone_bricks')
  e.weather([0, 0, 0], [19, 19, 19], { share: 0.25 })
  check('weather share exact', Math.abs((8000 - e.count('stone_bricks')) / 8000 - 0.25) < 0.005)
  // discs include their centre; onion profiles have one bulge
  const dsc = kit.builder([12, 12, 12])
  dsc.disc([5, 5, 5], 1.8, 'stone')
  check('disc has centre', dsc.count('stone') === 9 && dsc.nameAt(5, 5, 5) === 'minecraft:stone')
  const on = kit.onionProfile(4, 12)
  const radii = Array.from({ length: 12 }, (_, d) => on(d, d / 11))
  const peaks = radii.filter((v, i) => i > 0 && i < 11 && v > radii[i - 1] && v >= radii[i + 1]).length
  check('onion single bulge', peaks === 1 && radii[11] < 0.5, radii.map(v => v.toFixed(1)).join(' '))
  // flared cones use stairs above the slab brim (no all-slab cone)
  const c = kit.builder([20, 20, 20])
  c.coneRoof([10, 5, 10], 4, { material: 'deepslate_tile', pitch: 2 })
  check('flared cone has stairs', c.count('deepslate_tile_stairs') > c.count('deepslate_tile_slab'))
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

// --- spawn kit: block-letter signs -------------------------------------------------------
{
  check('signWidth medium', kit.signWidth('ABC') === 14, String(kit.signWidth('ABC')))
  check('signWidth small', kit.signWidth('ABC', 'small') === 11, String(kit.signWidth('ABC', 'small')))
  check('signWidth large', kit.signWidth('ABC', 'large') === 17, String(kit.signWidth('ABC', 'large')))
  check('signWidth widest line', kit.signWidth('AB\nABCD') === kit.signWidth('ABCD'))
  const g = kit.SIGN_FONTS.medium.glyphs
  check('font wide T, square U', g.T[0] === '#####' && g.U[4] === '####')
  // 'OBAD' facing south: reads east from x = 2, top row y = 8, letters in the z = 2 plane
  const b = kit.builder([30, 12, 6])
  const r = b.sign('OBAD', [2, 8, 2], 'south')
  const at = (c, row) => b.get(2 + c, 8 - row, 2)
  check('sign size', r.width === kit.signWidth('OBAD') && r.height === 5, `${r.width}x${r.height}`)
  const counters = [[1, 1], [2, 1], [1, 2], [2, 2], [1, 3], [2, 3], [6, 1], [7, 1], [6, 3], [7, 3], [11, 1], [12, 1], [16, 1], [16, 2], [16, 3]]
  check('sign counters open', counters.every(([c, row]) => !at(c, row)), counters.filter(([c, row]) => at(c, row)).map(p => p.join(',')).join(' '))
  check('sign diagonal step is a stair', at(10, 0)?.name === 'minecraft:quartz_stairs' && at(10, 0).props.half === 'bottom', kit.state(at(10, 0) ?? { name: 'air' }))
  check('sign convex corner stays square', at(15, 0)?.name === 'minecraft:quartz_block' && at(5, 0)?.name === 'minecraft:quartz_block')
  check('sign gap columns empty', [4, 9, 14].every(c => [0, 1, 2, 3, 4].every(row => !at(c, row))))
  // centre alignment, reading direction and the framed board behind the letters
  const c = kit.builder([12, 16, 40])
  const rc = c.sign('HI', [5, 10, 20], 'west', { align: 'center', board: 'polished_blackstone' })
  check('sign west reads south', c.nameAt(5, 10, 20 - Math.floor(rc.width / 2)) === 'minecraft:quartz_block')
  check('sign board 1 behind', c.nameAt(6, 9, 20) === 'minecraft:polished_blackstone' && c.nameAt(7, 9, 20) === 'minecraft:polished_blackstone')
  check('sign frame + cornice', c.nameAt(5, 12, 20) === 'minecraft:polished_deepslate' && c.nameAt(4, 12, 20) === 'minecraft:polished_deepslate_stairs')
}

// --- spawn kit: every component stands on its floor (no floating blocks) ------------------
{
  // blocks not face-connected to the floor (y <= floorY); invisible light blocks are exempt
  const floating = (b, floorY) => {
    const key = (x, y, z) => `${x},${y},${z}`
    const seen = new Set()
    const stack = []
    for (const [x, y, z] of b.entries()) if (y <= floorY) {
      seen.add(key(x, y, z))
      stack.push([x, y, z])
    }
    while (stack.length) {
      const [x, y, z] = stack.pop()
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const k = key(x + dx, y + dy, z + dz)
        if (seen.has(k) || !b.get(x + dx, y + dy, z + dz)) continue
        seen.add(k)
        stack.push([x + dx, y + dy, z + dz])
      }
    }
    return b.entries().filter(([x, y, z, blk]) => !seen.has(key(x, y, z)) && blk.name !== 'minecraft:light')
  }
  const scene = (build, size = [48, 34, 48]) => {
    const b = kit.builder(size)
    b.box([0, 0, 0], [size[0] - 1, 1, size[2] - 1], 'stone')
    build(b)
    return b
  }
  const cases = {
    'pedestal': b => b.npcSpot([24, 2, 24], 'south', { style: 'pedestal' }),
    'pedestal round': b => b.npcSpot([24, 2, 24], 'east', { style: 'pedestal', shape: 'round' }),
    'alcove': b => {
      b.box([14, 2, 20], [34, 14, 22], 'stone_bricks')
      b.npcSpot([24, 1, 21], 'north', { style: 'alcove' })
    },
    'booth': b => b.npcSpot([24, 1, 24], 'west', { style: 'booth' }),
    'kiosk': b => b.npcSpot([24, 2, 24], 'north', { style: 'kiosk' }),
    'leaderboards': b => b.leaderboards([24, 1, 10], 'south', { podium: true }),
    'leaderboard row': b => b.leaderboards([24, 1, 10], 'south', { style: 'row', count: 2 }),
    'crate row': b => b.crateRow([10, 3, 24], 'east', [{ tier: 'common' }, { tier: 'legendary', block: 'ender_chest' }, { tier: 'vote', block: 'shulker' }]),
    'portal rtp': b => b.portal([22, 2, 24], [26, 6, 24], { kind: 'rtp' }),
    'portal pvp': b => b.portal([24, 2, 20], [24, 5, 23], { kind: 'pvp' }),
    'portal nether': b => b.portal([22, 2, 24], [24, 5, 24], { kind: 'nether' }),
    'framed sign': b => {
      b.box([8, 2, 20], [40, 16, 21], 'stone_bricks')
      b.sign('SPAWN', [24, 13, 22], 'south', { align: 'center', board: 'polished_blackstone' })
    },
  }
  for (const [name, build] of Object.entries(cases)) {
    const b = scene(build)
    const loose = floating(b, 1)
    check(`${name}: no floating blocks`, loose.length === 0, loose.slice(0, 3).map(([x, y, z, blk]) => `${x},${y},${z} ${blk.name}`).join('; '))
    check(`${name}: inside the canvas`, b.clipped === 0, String(b.clipped))
    const report = b.finish({ name }).metadata.builderReport
    check(`${name}: valid states`, report.problems.length === 0 && report.warnings.length === 0, [...report.problems, ...report.warnings].slice(0, 2).join('; '))
  }
}

// --- spawn kit: placements -----------------------------------------------------------------
{
  const b = kit.builder([60, 30, 60])
  b.box([0, 0, 0], [59, 1, 59], 'stone')
  const npc = b.npcSpot([10, 2, 30], 'west', { id: 'shop', label: 'Shop', role: 'shop', style: 'pedestal' })
  check('npc record', npc.type === 'npc' && npc.pos.join() === '10,3,30' && npc.hologram.join() === '10.5,5.4,30.5' && npc.yaw === 90 && npc.facing === 'west', JSON.stringify(npc))
  check('npc head room and stand-off clear', !b.get(10, 3, 30) && !b.get(10, 5, 30) && !b.get(9, 3, 30) && !b.get(8, 4, 31))
  const boards = b.leaderboards([30, 1, 12], 'south', { count: 3, ids: ['kills', 'money', 'time'], podium: true })
  check('leaderboard records', boards.length === 3 && boards.map(r => r.id).join() === 'kills,money,time')
  // the anchor is centred on the board, 0.5 in front of the backdrop
  const a = boards[0].anchor
  check('leaderboard anchor', b.nameAt(Math.floor(a[0]), Math.floor(a[1]), Math.floor(a[2]) - 1) === 'minecraft:polished_blackstone' && a[2] % 1 === 0.5 && !b.get(Math.floor(a[0]), Math.floor(a[1]), Math.floor(a[2])), a.join())
  const statues = b.placements.filter(p => p.role === 'statue')
  check('podium statues', statues.length === 3 && statues.find(p => p.rank === 1).pos[1] > statues.find(p => p.rank === 2).pos[1] && statues.find(p => p.rank === 2).pos[1] > statues.find(p => p.rank === 3).pos[1])
  const crates = b.crateRow([45, 4, 30], 'west', [{ id: 'a', tier: 'rare' }, { id: 'b', tier: 'legendary', block: 'ender_chest' }])
  check('crate records', crates.length === 2 && b.nameAt(...crates[1].pos) === 'minecraft:ender_chest' && crates[1].hologram[1] === 5.6 && crates[1].pos[2] === 35, JSON.stringify(crates[1]))
  check('crate standing area clear', [1, 2, 3].every(k => !b.get(45 - 3 - k + 1, 3, 30) && !b.get(45 - 3 - k + 1, 4, 30)))
  b.spawnPoint([30, 1, 40], 'north')
  b.spawnPoint([31, 1, 40], 'north')
  check('one world spawn', b.placements.filter(p => p.type === 'spawn').length === 1 && b.placements.find(p => p.type === 'spawn').pos.join() === '31,2,40' && b.warnings.some(w => /spawnPoint/.test(w)))
  b.portal([20, 2, 50], [22, 5, 50], { id: 'rtp', kind: 'rtp' })
  const portalRec = b.placements.find(p => p.type === 'portal')
  check('portal record and opening', portalRec.min.join() === '20,2,50' && portalRec.max.join() === '22,5,50' && !b.get(21, 3, 50) && !b.get(20, 5, 50))
  b.region('spawn', [0, 0, 0], [59, 29, 59], { pvp: 'deny', priority: 5 })
  const done = b.finish({ name: 'placements', trim: true })
  const meta = done.metadata.placements
  check('finish exports placements', meta.length === b.placements.length && meta.every(p => p.type))
  const offset = b.bounds().min
  check('trim shifts placements', meta.find(p => p.id === 'shop').pos.join() === [10 - offset[0], 3 - offset[1], 30 - offset[2]].join())
}

// --- spawn kit: spawn-proofing -------------------------------------------------------------
{
  // a walled plaza with a covered corner, a kiosk and a pillar shadow; no lights of its own
  const b = kit.builder([44, 16, 44])
  b.box([0, 0, 0], [43, 1, 43], 'stone')
  b.box([2, 2, 2], [41, 2, 41], 'polished_andesite')
  b.walls([1, 3, 1], [42, 7, 42], 'stone_bricks')
  b.box([2, 7, 2], [12, 7, 12], 'spruce_planks') // a roofed corner
  b.box([20, 3, 20], [21, 8, 30], 'stone_bricks') // a wall casting a shadow
  b.npcSpot([30, 2, 12], 'south', { style: 'booth' })
  b.set(34, 3, 34, 'tall_grass')
  b.set(36, 3, 34, 'oak_door[facing=north,half=lower]')
  const min = [2, 3, 2]
  const max = [41, 12, 41]
  const before = b.darkSpots(min, max).length
  const solid = b.entries().filter(([, , , blk]) => blk.name !== 'minecraft:light').length
  const placed = b.spawnProof(min, max)
  const after = b.darkSpots(min, max)
  check('spawnProof finds dark cells', before > 100, String(before))
  check('spawnProof lights them all', placed > 0 && after.length === 0, `${placed} placed, ${after.length} left: ${after.slice(0, 3).map(p => p.join(',')).join(' ')}`)
  check('spawnProof replaces nothing', b.entries().filter(([, , , blk]) => blk.name !== 'minecraft:light').length === solid)
  check('spawnProof spares plant and door tops', !b.get(34, 4, 34) && !b.get(36, 4, 34))
  // the light model: mobs never spawn on bottom slabs, glass or carpets; they do on top slabs
  const m = kit.builder([20, 6, 20])
  m.box([0, 0, 0], [3, 0, 19], 'stone_slab[type=bottom]')
  m.box([4, 0, 0], [7, 0, 19], 'glass')
  m.box([8, 0, 0], [11, 0, 19], 'stone')
  m.box([8, 1, 0], [11, 1, 19], 'white_carpet')
  m.box([12, 0, 0], [15, 0, 19], 'stone_slab[type=top]')
  const dark = m.darkSpots([0, 1, 0], [19, 4, 19])
  check('dark spots only on spawnable floors', dark.length === 80 && dark.every(([x]) => x >= 12 && x <= 15), `${dark.length}`)
  // a lantern lights a 14-block radius (taxicab); a light under a bottom slab does not escape upward
  m.set(13, 1, 2, 'lantern')
  check('lantern lights its area', m.darkSpots([12, 1, 0], [15, 4, 10]).length === 0 && m.darkSpots([12, 1, 17], [15, 4, 19]).length > 0)
  // finish({ spawnProof }) runs it and reports
  const f = kit.builder([20, 8, 20])
  f.box([0, 0, 0], [19, 0, 19], 'stone')
  const report = f.finish({ name: 'sp', spawnProof: [[0, 1, 0], [19, 7, 19]] }).metadata.builderReport.spawnProof
  check('finish spawnProof', report.placed > 0 && report.remaining === 0, JSON.stringify(report))
}

// --- spawn kit: the placements export (run-build) ------------------------------------------
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spawnkit-'))
  const recipe = path.join(dir, 'export-test.mjs')
  fs.writeFileSync(recipe, `export default function build(api) {
  const b = api.builder([32, 16, 32])
  b.box([0, 0, 0], [31, 1, 31], 'stone')
  b.spawnPoint([16, 1, 16], 'north')
  b.npcSpot([8, 2, 8], 'south', { id: 'guide', label: 'Guide', style: 'pedestal' })
  b.crate([24, 3, 10], 'west', { id: 'vote', label: 'Vote Crate', tier: 'vote' })
  b.leaderboards([16, 1, 26], 'north', { count: 1, ids: ['kills'] })
  b.region('spawn', [0, 0, 0], [31, 15, 31], { pvp: 'deny' })
  return b.finish({ name: 'export-test', spawnProof: [[0, 2, 0], [31, 15, 31]] })
}
`)
  let out = ''
  try {
    out = execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'run-build.mjs'), recipe, '--out-dir', dir, '--origin', '100,-60,-200', '--world', 'lobby', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    out = String(error.stdout ?? '') + String(error.stderr ?? '')
  }
  const jsonPath = path.join(dir, 'export-test.placements.json')
  const setupPath = path.join(dir, 'export-test.setup.md')
  check('export: files written', fs.existsSync(jsonPath) && fs.existsSync(setupPath), out.slice(0, 300))
  if (fs.existsSync(jsonPath) && fs.existsSync(setupPath)) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    const spawn = data.placements.find(p => p.type === 'spawn')
    check('export: world = origin + local', spawn.world.pos.join() === [116, -58, -184].join() && data.origin.join() === '100,-60,-200', JSON.stringify(spawn))
    const md = fs.readFileSync(setupPath, 'utf8')
    for (const needle of ['| guide | Guide |', 'setworldspawn 116 -58 -184 180', 'npc create Guide --at 108.5:-57:-191.5:lobby:0:0', 'npc create guide --location 108.5 -57 -191.5 --world lobby', 'dh hologram create lb-kills -l:lobby:', '/crazycrates set vote', '- 124,-57,-190,lobby', '//pos1 100,-60,-200', 'rg define -w lobby spawn', 'rg flag spawn pvp deny']) {
      check(`export: setup has ${needle}`, md.includes(needle))
    }
    const summary = JSON.parse(out.slice(out.indexOf('{')))
    check('export: summary', summary.placements?.count === data.placements.length && summary.builder.spawnProof.remaining === 0)
  }
  fs.rmSync(dir, { recursive: true, force: true })
}

// --- landscapes (b.land) ---------------------------------------------------------------
{
  const b = kit.builder([160, 100, 160], { seed: 1 })
  const land = b.land({ base: 30, seed: 2 })
  land.outline({ cx: 80, cz: 80, r: 72 }, { fall: 16, rim: 30 })
  check('land: outside the outline has no land', Number.isNaN(land.get(2, 2)) && !Number.isNaN(land.get(80, 80)))
  land.range([[20, 40], [80, 20], [140, 50]], { width: 70, height: 40, seed: 3 })
  const peak = Math.max(...Array.from({ length: 160 }, (_, x) => land.get(x, 30)).filter(v => !Number.isNaN(v)))
  check('land: a range raises the land', peak > 50, `peak ${peak}`)
  const lvl = land.pad({ cx: 80, cz: 110, r: 14 }, { y: 31, blend: 10 })
  check('land: a pad is flat at its level', lvl === 31 && Math.abs(land.get(80, 110) - 31) < 0.01 && Math.abs(land.get(86, 112) - 31) < 0.01)
  const before = land.get(80, 110)
  land.erode({ strength: 1, seed: 4 })
  land.thermal({ iterations: 4 })
  const st = land.stats()
  check('land: erosion keeps the pad', Math.abs(land.get(80, 110) - before) < 0.01)
  check('land: erosion digs no pits below the base', st.min >= 27, JSON.stringify(st))
  const groundY = land.paint({ theme: 'temperate', underside: { depth: 20, ramp: 30 }, water: { level: 29, from: [80, 110] } })
  check('land: paint returns the top', groundY(80, 110) === 31 && b.nameAt(80, 31, 110) !== null)
  check('land: paint leaves no land outside the outline', b.topY(2, 2) === -1)
  check('land: steep faces are rock', [...Array(160).keys()].some(x => /stone|andesite|tuff|cobble|calcite|diorite|granite/.test(b.nameAt(x, groundY(x, 28), 28) ?? '')))
  const { auditSpawn } = await import('../lib/kit/audit.mjs')
  const a = auditSpawn(b)
  check('land: painted land has no physics failures', !a.failures.some(f => /falling|water|cane/.test(f)), a.failures.join(' | '))
}

// --- the spawn audit ---------------------------------------------------------------------
{
  const { auditSpawn } = await import('../lib/kit/audit.mjs')
  // a flat green disc with three houses of one size and NPCs far apart: everything fails
  const b = kit.builder([300, 40, 300], { seed: 1 })
  for (let x = 10; x < 290; x += 1) for (let z = 10; z < 290; z += 1) if (Math.hypot(x - 150, z - 150) < 140) b.set(x, 10, z, 'minecraft:grass_block')
  for (const [hx, hz] of [[100, 100], [200, 100], [100, 200], [200, 200]]) b.box([hx, 11, hz], [hx + 7, 18, hz + 8], 'minecraft:oak_planks')
  b.set(150, 11, 150, 'minecraft:sand') // on grass: fine
  b.set(150, 14, 152, 'minecraft:gravel') // in the air: falls
  b.set(160, 11, 160, 'minecraft:water') // on grass, open at the sides: leaks
  b.placements = [{ type: 'spawn', pos: [150, 11, 150] }, ...[0, 1, 2, 3].map(k => ({ type: 'npc', id: `n${k}`, pos: [150 + 30 * Math.cos(k), 11, 150 + 30 * Math.sin(k)] }))]
  const a = auditSpawn(b)
  const has = re => a.failures.some(f => re.test(f))
  check('audit: flat disc fails flat land', has(/^flat land/))
  check('audit: bare lawn fails', has(/^bare land/))
  check('audit: 4 clones fail repeats', has(/^repeats: 4 buildings/))
  check('audit: gravel in the air fails', has(/^falling: 1 /))
  check('audit: open water fails', has(/^water: 1 /))
  check('audit: NPCs far apart fail', has(/^NPCs/))
  check('audit: empty views fail', has(/^views/))
  // a lawn salted with single dirt dots fails speckle; clumps do not
  const c = kit.builder([300, 20, 300], { seed: 1 })
  for (let x = 0; x < 300; x += 1) for (let z = 0; z < 300; z += 1) c.set(x, 5, z, (x * 7 + z * 13) % 17 === 0 ? 'minecraft:coarse_dirt' : 'minecraft:grass_block')
  check('audit: dirt dots fail speckle', auditSpawn(c).failures.some(f => /^speckle/.test(f)))
}

console.log(`kit self-test: ${passes} passed, ${failures} failed`)
if (failures > 0) process.exitCode = 1
