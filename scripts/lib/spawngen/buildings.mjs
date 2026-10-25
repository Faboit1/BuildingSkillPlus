// Themed buildings for the spawn generator (placeholder: the full module replaces this file).
// Contract (see index.mjs for ctx):
//   building(ctx, spec) → { door, bounds, top, npc?, interior? }
//   spec = { kind, x0, z0, x1, z1, y, facing, seed, storeys?, npc?: { id, label, role }, label? }
//     x0..z1  the wall footprint (inclusive); eaves may overhang it by up to 2
//     y       the floor block level (ground at the door); walls start at y + 1
//     facing  the street side: the door (and the NPC, if any) is on that face
//   kinds: house | shop | hall | tower | arcade | pavilion
//   heroWall(ctx, { cx, z, y, facing, boards, name, width }) → { bounds }   leaderboards + name sign
//   crateHall(ctx, { x0, z0, x1, z1, y, facing, crates }) → { bounds }      the crates section

export const KINDS = {
  house: { min: [7, 7], max: [15, 13] },
  shop: { min: [7, 7], max: [15, 13] },
  hall: { min: [13, 11], max: [27, 21] },
  tower: { min: [5, 5], max: [9, 9] },
  arcade: { min: [7, 9], max: [13, 40] },
  pavilion: { min: [7, 7], max: [15, 15] },
}

export function building(ctx, spec) {
  const { b, theme } = ctx
  const { x0, z0, x1, z1, y, facing } = spec
  const top = y + 5 * (spec.storeys ?? 1)
  b.box([x0, y, z0], [x1, y, z1], 'minecraft:spruce_planks')
  b.walls([x0, y + 1, z0], [x1, top, z1], ctx.paint.wall)
  b.roof({ x0, z0, x1, z1, y: top + 1, type: 'gable', material: theme.roof, overhang: 1 })
  const cx = Math.round((x0 + x1) / 2)
  const cz = Math.round((z0 + z1) / 2)
  const door = { north: [cx, y, z0 - 1], south: [cx, y, z1 + 1], west: [x0 - 1, y, cz], east: [x1 + 1, y, cz] }[facing]
  const wallCell = { north: [cx, y + 1, z0], south: [cx, y + 1, z1], west: [x0, y + 1, cz], east: [x1, y + 1, cz] }[facing]
  b.door(wallCell, facing, { material: theme.wood })
  let npc
  if (spec.npc) npc = b.npcSpot([door[0], y, door[2]], facing, { ...ctx.M, ...spec.npc, style: 'none' })
  return { door, bounds: { min: [x0, y, z0], max: [x1, top + 8, z1] }, top: top + 8, npc }
}

export function heroWall(ctx, { cx, z, y, facing = 'south', boards = [], name, width }) {
  const { b } = ctx
  const ids = boards.map(x => x.id)
  const labels = boards.map(x => x.label)
  b.leaderboards([cx, y, z], facing, { ...ctx.M, count: boards.length, ids, labels, podium: boards.length >= 3 })
  if (name) b.sign(name, [cx, y + 20, z - 3], facing, { font: 'medium', align: 'center', board: 'polished_blackstone' })
  return { bounds: { min: [cx - width / 2, y, z - 6], max: [cx + width / 2, y + 26, z] } }
}

export function crateHall(ctx, { x0, z0, x1, z1, y, facing = 'east', crates = [] }) {
  const { b } = ctx
  const start = facing === 'east' ? [x0 + 4, y + 2, z1 - 3] : [x1 - 4, y + 2, z0 + 3]
  b.crateRow(start, facing, crates.map(c => ({ ...c, label: `${c.label} Crate` })), { ...ctx.M, spacing: 5 })
  return { bounds: { min: [x0, y, z0], max: [x1, y + 10, z1] } }
}
