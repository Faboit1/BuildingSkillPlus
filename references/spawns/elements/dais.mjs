// THE SPAWN CENTRE: the dais players land on, the floor round it and the NPC ring. Read this, look
// at img/dais.png, then design your own centre: the dais's shape and size, its pattern, the floor
// and the ring are yours for the theme. This is the first thing every player sees: make it the
// richest floor of the spawn.
//
// DO
// - A stepped dais in the middle: 2-4 tiers, each 1 high, every tier's edge a ring of stairs
//   (you walk off it, never jump), 15-31 across at the bottom.
// - Pattern on it: stripes of a light block running out on the axes and the diagonals across the
//   tiers, a medallion on the top tier (a turned checker of 3-4 warm tones), a glowing centre
//   (light-blue glass over a sea lantern) where the world spawn is.
// - The floor round it in the same family of colours, on a grid that leads to it (gridPlaza in
//   paving.mjs), the NPC ring 4-8 out from the dais's foot, every NPC turned to the middle.
// - Room: 6+ blocks of open floor between the dais and the NPCs, so the landing crowd can spread.
// DON'T
// - A ziggurat of full blocks you have to jump up, too tall to see over from the floor.
// - The spawn point as one glowstone in a flat floor, with the NPCs in a row along one side.
// - More than 4 tiers or 4 high: the dais is a stage, not a tower; the view from it is the design.

import { gridPlaza } from './paving.mjs'
import { npcRing } from './npc.mjs'
import { npcStandIn } from './_scene.mjs'

const id = s => (s.includes(':') ? s : `minecraft:${s}`)
// stairs that face the middle (the tall back toward it: you walk up toward the middle)
const inward = (dx, dz) => (Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : dz > 0 ? 'north' : 'south')

// The dais. [cx, cz] = its middle, y = the floor level, R = the bottom tier's half-width.
// tones = the medallion's colours, in order out from the middle. Places the world spawn on top.
export function dais(ctx, { cx, cz, y = ctx.FY, R = 10, tiers = 3, body = 'polished_granite', stripe = 'smooth_sandstone', tones = ['smooth_sandstone', 'packed_mud', 'polished_granite', 'mud_bricks'], centre = 'light_blue_stained_glass', facing = 'north' }) {
  const { b, kit } = ctx
  // a tier's edge stair of any stone (kit.material finds the real id; no stair: the block itself)
  const edge = (mat, f) => {
    const F = kit.material(mat)
    return F.stairs ? `${F.stairs}[facing=${f},half=bottom]` : id(mat)
  }
  for (let k = 0; k < tiers; k += 1) {
    const r = R - 2 * k
    const top = k === tiers - 1
    for (let dx = -r; dx <= r; dx += 1)
      for (let dz = -r; dz <= r; dz += 1) {
        const ring = Math.max(Math.abs(dx), Math.abs(dz))
        const onStripe = dx === 0 || dz === 0 || Math.abs(dx) === Math.abs(dz)
        const mat = onStripe ? stripe : body
        let block
        if (ring === r) block = edge(mat, inward(dx, dz)) // the tier's edge
        else if (!top) block = id(mat)
        else if (Math.abs(dx) + Math.abs(dz) <= 1) block = id(centre) // the glowing middle
        else {
          // the medallion: a checker turned 45 degrees, its tones changing outward in diamond rings
          const ringNo = Math.floor((Math.abs(dx) + Math.abs(dz)) / 2)
          const check = (Math.floor((dx + dz + 64) / 2) + Math.floor((dx - dz + 64) / 2)) % 2
          block = id(check ? tones[ringNo % tones.length] : tones[(ringNo + 1) % tones.length])
        }
        b.set(cx + dx, y + 1 + k, cz + dz, block)
      }
  }
  b.set(cx, y + tiers - 1, cz, 'minecraft:sea_lantern') // under the glass
  b.spawnPoint([cx, y + tiers, cz], facing)
  return { top: y + tiers, R }
}

// DON'T: a ziggurat of full blocks with a glowstone on top
function ziggurat(ctx, { cx, cz, y = ctx.FY }) {
  const { b } = ctx
  for (let k = 0; k < 4; k += 1)
    for (let dx = -4 + k; dx <= 4 - k; dx += 1) for (let dz = -4 + k; dz <= 4 - k; dz += 1) b.set(cx + dx, y + 1 + k, cz + dz, 'minecraft:white_concrete')
  b.set(cx, y + 4, cz, 'minecraft:glowstone')
}

const NPCS = [
  { id: 'shop', label: '&a&lSHOP', lines: ['&7/shop'] },
  { id: 'quests', label: '&6&lQUESTS', lines: ['&7/quests'] },
  { id: 'jobs', label: '&b&lJOBS', lines: ['&7/jobs'] },
  { id: 'teams', label: '&3&lTEAMS', lines: ['&7/teams'] },
  { id: 'rtp', label: '&d&lRANDOM TELEPORT', lines: ['&7/rtp'] },
  { id: 'guide', label: '&e&lGUIDE', lines: ['&7/guide'] },
  { id: 'settings', label: '&c&lSETTINGS', lines: ['&7/settings'] },
  { id: 'warps', label: '&9&lWARPS', lines: ['&7/warps'] },
]
const SHIRTS = ['red', 'light_blue', 'lime', 'purple', 'orange', 'cyan', 'yellow', 'magenta']

export const figure = { size: 49, height: 16, floorY: 3, camera: { eye: [36, 21, 47], lookAt: [24, 4, 24], fov: 60 } }
export function demo(ctx, which) {
  const { b, S, FY } = ctx
  const [cx, cz] = [24, 24]
  if (which === 'good') {
    gridPlaza(ctx, { x0: 1, z0: 1, x1: S - 2, z1: S - 2, cx, cz, cell: 9, seed: 2 })
    dais(ctx, { cx, cz, R: 8, tiers: 3 })
    const ring = npcRing(ctx, { cx, cz, r: 16, npcs: NPCS, from: 20, gaps: [[0, 12], [90, 12], [180, 12], [270, 12]] })
    ring.forEach((npc, i) => npcStandIn(ctx, npc.pos, { shirt: `${SHIRTS[i]}_concrete` }))
  } else {
    for (let x = 1; x < S - 1; x += 1) for (let z = 1; z < S - 1; z += 1) b.set(x, FY, z, 'minecraft:smooth_stone')
    ziggurat(ctx, { cx, cz })
    b.spawnPoint([cx, FY + 4, cz], 'north')
    for (let i = 0; i < 8; i += 1) {
      const x = 10 + i * 3
      b.set(x, FY + 1, 10, 'minecraft:quartz_block')
      npcStandIn(ctx, [x, FY + 2, 10], { shirt: `${SHIRTS[i]}_concrete` })
    }
  }
}
