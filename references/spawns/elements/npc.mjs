// NPC STANDS. Read this, look at img/npc.png, then give every NPC of your spawn its stand: the
// stand block, the post beside it and the hologram lines are yours to choose for the theme. The
// block on top of the stand is where the NPC stands (the blue figures in the picture stand in for
// the NPCs); b.markNpc records it for setup.md (Citizens / FancyNpcs and its hologram) and keeps its
// head room clear.
//
// DO
// - A stand of one block: the NPC 1 above the players' floor, so they look it in the face. A barrel
//   (standing up), a stripped log, a polished block or a stump; the same stand for every NPC of a
//   ring, so the ring reads as one design and the NPCs (their skins) are the variety.
// - A lantern on a short post beside each stand (a soul lantern on a fence: it marks the NPC at
//   night and frames it), at the side or just behind, never in front of its face.
// - NPCs in a ring round the spawn (the dais), 6-8 apart, every one turned to the middle (its own
//   yaw, not just the nearest of four sides): players see every hologram from where they land.
// - A rich hologram: the name, the command, a line or two on what it does, "Tap below" (markNpc's
//   `lines`); it rises with its lines so they stay above the head.
// - Head room: 3 clear above its feet, nothing within 2 in front, nothing over the hologram.
// DON'T
// - A pillar that puts it 4+ blocks up (players see its feet), or a glass box round it.
// - NPCs on the bare floor with nothing marking their place, or in a row against a wall 2 apart.
// - Anything in its face: a sign, a lantern, leaves, a fence post, a crate.

import { local, yawToward } from '../../../assets/frame/frame.mjs'
import { groundPatch, npcStandIn } from './_scene.mjs'

const STANDS = {
  barrel: 'minecraft:barrel[facing=up,open=false]',
  log: 'minecraft:stripped_spruce_log[axis=y]',
  stump: 'minecraft:spruce_wood[axis=y]',
  polished: 'minecraft:polished_andesite',
}

// One NPC stand. pos = the floor block under the stand, facing = the side players stand on (for the
// keep-clear cells), yaw = the exact way the NPC looks (default: the facing's). lantern: 'left' |
// 'right' | null puts the lantern post 2 to that side and 1 back (as the players see it).
export function npcStand(ctx, pos, facing, { stand = 'barrel', post = 'dark_oak_fence', light = 'soul_lantern', lantern = 'right', label = 'NPC', role = '', npcId, lines = [], yaw } = {}) {
  const { b } = ctx
  const L = local(pos, facing)
  b.set(...L.at(0, 0, 1), STANDS[stand] ?? (stand.includes(':') ? stand : `minecraft:${stand}`))
  if (lantern) {
    const u = lantern === 'left' ? -2 : 2
    b.set(...L.at(u, -1, 1), `minecraft:${post}`)
    b.set(...L.at(u, -1, 2), `minecraft:${light}[hanging=false]`)
  }
  const rec = b.markNpc(L.at(0, 0, 1), facing, { id: npcId, label, role, lines })
  if (yaw !== undefined) rec.yaw = yaw
  return rec
}

// A ring of stands round [cx, cz] at radius r, every NPC turned to the middle. npcs = [{ id, label,
// lines }]; from = the angle of the first (0 = north, clockwise), gaps = [[angle, halfWidth]]
// sectors to leave open (the paths in).
export function npcRing(ctx, { cx, cz, r, y = ctx.FY, npcs, from = 0, gaps = [], ...opts }) {
  const free = a => !gaps.some(([g, w]) => Math.abs(((a - g + 540) % 360) - 180) <= w)
  // spread the NPCs over the free part of the circle
  const angles = []
  for (let a = 0; a < 360; a += 1) if (free((from + a) % 360)) angles.push((from + a) % 360)
  return npcs.map((npc, i) => {
    const a = angles[Math.floor(((i + 0.5) * angles.length) / npcs.length)]
    const rad = (a * Math.PI) / 180
    const x = Math.round(cx + Math.sin(rad) * r)
    const z = Math.round(cz - Math.cos(rad) * r)
    // the keep-clear side is the one nearest the middle; the yaw looks exactly at it
    const dx = cx - x
    const dz = cz - z
    const facing = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : dz > 0 ? 'south' : 'north'
    return npcStand(ctx, [x, y, z], facing, { ...opts, ...npc, npcId: npc.id, lantern: i % 2 ? 'left' : 'right', yaw: yawToward([x, z], [cx, cz]) })
  })
}

// DON'T: a quartz pillar 4 up, and a glass booth
function pillarNpc(ctx, [x, y, z]) {
  const { b } = ctx
  for (let h = 1; h <= 4; h += 1) b.set(x, y + h, z, 'minecraft:quartz_pillar[axis=y]')
  b.set(x, y + 1, z + 1, 'minecraft:glowstone')
}
function boothNpc(ctx, [x, y, z]) {
  const { b } = ctx
  for (let dx = -1; dx <= 1; dx += 1)
    for (let dz = -1; dz <= 1; dz += 1) {
      b.set(x + dx, y + 1, z + dz, 'minecraft:glowstone')
      b.set(x + dx, y + 5, z + dz, 'minecraft:quartz_block')
      if (dx || dz) for (let h = 2; h <= 4; h += 1) b.set(x + dx, y + h, z + dz, 'minecraft:glass')
    }
}

export const figure = { size: 21, height: 10, floorY: 3, camera: { eye: [10, 9, 24], lookAt: [10, 3, 9], fov: 62 } }
export function demo(ctx, which) {
  const { kit, FY } = ctx
  groundPatch(ctx, { top: kit.palette({ mud_bricks: 6, packed_mud: 1 }, { scale: 4, seed: 2 }) })
  if (which === 'good') {
    const ring = npcRing(ctx, {
      cx: 10, cz: 10, r: 6, from: 200,
      npcs: [
        { id: 'shop', label: '&a&lSHOP', lines: ['&7/shop', '&fBuy blocks, items and gear', '&e▶ Tap below ◀'] },
        { id: 'quests', label: '&6&lQUESTS', lines: ['&7/quests', '&fDaily tasks, real rewards', '&e▶ Tap below ◀'] },
        { id: 'jobs', label: '&b&lJOBS', lines: ['&7/jobs', '&fPick a job, earn money', '&e▶ Tap below ◀'] },
        { id: 'rtp', label: '&d&lRANDOM TELEPORT', lines: ['&7/rtp', '&fInto the wild', '&e▶ Tap below ◀'] },
      ],
      gaps: [[20, 60]],
    })
    ring.forEach((npc, i) => npcStandIn(ctx, npc.pos, { shirt: ['red_concrete', 'light_blue_concrete', 'lime_concrete', 'purple_concrete'][i] }))
  } else {
    pillarNpc(ctx, [6, FY, 9])
    npcStandIn(ctx, [6, FY + 5, 9])
    boothNpc(ctx, [13, FY, 10])
    npcStandIn(ctx, [13, FY + 2, 10])
  }
}
