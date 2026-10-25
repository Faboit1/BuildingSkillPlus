// Landscape and props for the spawn generator (placeholder: the full module replaces this file).
// Contract (see index.mjs for ctx):
//   featureTree(ctx, [x, y, z], { size: 'large' | 'medium', seed, style })   y = ground block level
//   lamp(ctx, [x, y, z], { kind })          bench(ctx, [x, y, z], facing, { length })
//   planter(ctx, [x, y, z], { r, tree, seed })    fountain(ctx, [x, y, z], { r })    well(ctx, [x, y, z])
//   stall(ctx, [x, y, z], facing, { width, colour })
//   pvpArena(ctx, { x0, z0, x1, z1, y, entrance }) → { center }   afkPark(ctx, { x0, z0, x1, z1, y })
//   clutter(ctx, [x, y, z], kind)            torii(ctx, [x, y, z], facing, { width })
//   landscapePass(ctx)   woodland, bushes, flowers on every free land column (called last)

export function featureTree(ctx, [x, y, z], { size = 'large', seed = 0 } = {}) {
  ctx.b.tree([x, y + 1, z], size === 'large' ? 'big_oak' : 'oak', { seed })
}
export function lamp(ctx, [x, y, z]) {
  ctx.b.lampPost([x, y + 1, z], { height: 4 })
}
export function bench(ctx, [x, y, z], facing, { length = 3 } = {}) {
  for (let k = 0; k < length; k += 1) ctx.b.set(x + (facing === 'north' || facing === 'south' ? k : 0), y + 1, z + (facing === 'east' || facing === 'west' ? k : 0), `${ctx.theme.wood}_stairs[facing=${ctx.kit.opposite(facing)}]`)
}
export function planter(ctx, [x, y, z], { tree = true, seed = 0 } = {}) {
  if (tree) ctx.b.tree([x, y + 1, z], 'azalea', { seed, height: 4 })
}
export function fountain(ctx, [x, y, z], { r = 3 } = {}) {
  ctx.b.ring([x, y + 1, z], r, 'minecraft:stone_bricks')
}
export function well(ctx, [x, y, z]) {
  ctx.b.ring([x, y + 1, z], 2, 'minecraft:cobblestone')
}
export function stall(ctx, [x, y, z]) {
  ctx.b.set(x, y + 1, z, 'minecraft:barrel')
}
export function pvpArena(ctx, { x0, z0, x1, z1, y }) {
  for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) if (x === x0 || x === x1 || z === z0 || z === z1) ctx.b.set(x, y, z, 'minecraft:red_concrete')
  ctx.b.region('pvp', [x0, y, z0], [x1, y + 20, z1], { pvp: 'allow', priority: 20 })
  return { center: [Math.round((x0 + x1) / 2), y, Math.round((z0 + z1) / 2)] }
}
export function afkPark(ctx, { x0, z0, x1, z1, y }) {
  ctx.b.region('afk', [x0, y, z0], [x1, y + 10, z1], { 'mob-spawning': 'deny', priority: 20 })
}
export function clutter(ctx, [x, y, z]) {
  ctx.b.set(x, y + 1, z, 'minecraft:barrel')
}
export function torii(ctx, [x, y, z]) {
  ctx.b.set(x, y + 1, z, 'minecraft:red_concrete')
}
export function landscapePass(ctx) {
  const { b, S, grid, site, theme } = ctx
  b.forest({ x0: 2, z0: 2, x1: S - 3, z1: S - 3, ground: site.groundY, species: theme.trees.forest.map(([w, s]) => [w, ctx.kit.TREE_SPECIES.includes(s) ? s : 'oak']), density: 0.8, minSpacing: 6, seed: ctx.seed, avoid: (x, z) => !site.land(x, z) || grid.tag(x, z) !== null || site.edgeE(x, z) > 0.9 })
  b.scatter({ x0: 0, z0: 0, x1: S - 1, z1: S - 1, density: 0.3, paints: theme.flowers, seed: ctx.seed })
}
