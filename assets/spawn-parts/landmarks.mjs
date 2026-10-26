// PLACEHOLDER (the landmarks agent replaces this file): big set pieces round the spawn.
//   LANDMARKS[kind].r = footprint radius; landmark(ctx, kind, { x, z, y, seed, facing }) → { r, top }
export const LANDMARKS = { volcano: { r: 26 }, lighthouse: { r: 8 }, ship: { r: 24 }, statue: { r: 12 }, 'giant-tree': { r: 16 }, 'giant-palm': { r: 10 }, 'rock-spires': { r: 12 }, 'rock-arch': { r: 14 } }

export function landmark(ctx, kind, { x, z, y }) {
  const r = LANDMARKS[kind]?.r ?? 10
  ctx.b.cone([x, y + 1, z], Math.max(3, r - 4), r, 'minecraft:stone')
  return { r, top: y + r }
}
