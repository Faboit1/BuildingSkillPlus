// The scale test's spawn (npm run test:scale): a 1000-wide spawn made of the manual's element
// examples together (a mountain, a river and a bridge, the spawn centre, the crate pavilion, the
// gatehouse, six halls, a town wall, giant trees), to check the big-build pipeline end to end.
// It is a test, not a design: a real spawn fills the canvas with far more (manual §1.2).
const E = '../../references/spawns/elements/'
const { startSpawn, finishSpawn, facingToward, polar } = await import('../../assets/frame/frame.mjs')
const { island } = await import(E + 'island.mjs')
const { gridPlaza } = await import(E + 'paving.mjs')
const { dais } = await import(E + 'dais.mjs')
const { npcRing } = await import(E + 'npc.mjs')
const { boardRecess, podium } = await import(E + 'boards.mjs')
const { cratePavilion, CRATES } = await import(E + 'crates.mjs')
const { gate } = await import(E + 'gate.mjs')
const { hall } = await import(E + 'buildings.mjs')
const { wall } = await import(E + 'walls.mjs')
const { massif } = await import(E + 'cliffs.mjs')
const { river } = await import(E + 'river.mjs')
const { crossing, archBridge } = await import(E + 'bridge.mjs')
const { giantTree } = await import(E + 'trees.mjs')
const { fountain } = await import(E + 'fountain.mjs')

export default function build(api) {
  const t0 = Date.now()
  const lap = what => console.error(`  ${what}: ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  const ctx = startSpawn(api, { name: 'Scale Test', size: 1000, height: 200, seed: 5 })
  const { b, FY, C } = ctx
  const [cx, cz] = C
  const groundY = island(ctx, { cx, cz, r: 440, depth: 50, seed: 4, flat: 0.75 })
  lap('island')
  massif(ctx, { cx: cx - 30, cz: cz - 300, height: 80, radius: 70, seed: 2, face: 'south' })
  lap('massif')
  const rv = river(ctx, [[cx + 60, cz - 230], [cx + 160, cz - 150], [cx + 200, cz - 20], [cx + 300, cz + 120], [cx + 330, cz + 260]], { width: [14, 20], depth: 3, bank: 5, seed: 3 })
  lap('river')
  const site = crossing(rv, 0.42)
  archBridge(ctx, site, { spans: [8, 12, 8], road: 30, seed: 2 })
  lap('bridge')
  gridPlaza(ctx, { x0: cx - 60, z0: cz - 60, x1: cx + 60, z1: cz + 60, cx, cz, cell: 10, seed: 2 })
  dais(ctx, { cx, cz, R: 11, tiers: 3 })
  npcRing(ctx, { cx, cz, r: 26, from: 15, gaps: [[0, 10], [90, 10], [180, 10], [270, 10]], npcs: ['shop', 'auction', 'kits', 'store', 'quests', 'sell', 'warps', 'events', 'vote', 'guide'].map(id => ({ id, label: id.toUpperCase(), lines: [`/${id}`] })) })
  boardRecess(ctx, [cx - 16, FY, cz - 48], 'south', { label: 'Top balance', boardId: 'money' })
  podium(ctx, [cx, FY, cz - 46], 'south', { label: 'Top kills' })
  boardRecess(ctx, [cx + 16, FY, cz - 48], 'south', { label: 'Top playtime', boardId: 'time' })
  cratePavilion(ctx, [cx - 52, FY, cz], 'east', CRATES)
  gate(ctx, [cx, FY, cz + 62], 'north', { portalId: 'rtp' })
  fountain(ctx, [cx + 40, FY, cz + 38], { r: 9, inner: 6 })
  lap('centre')
  for (const [a, r] of [[45, 120], [135, 125], [225, 118], [315, 122], [20, 170], [200, 175]]) {
    const [x, z] = polar(ctx, a, r).map(Math.round)
    hall(ctx, [x, FY, z], facingToward([x, z], C), { seed: a })
  }
  lap('halls')
  wall(ctx, [[cx - 220, cz + 200], [cx - 220, cz - 160], [cx - 60, cz - 220]], { out: 'left', height: 10, seed: 3, ground: (x, z) => Math.max(FY, groundY(x, z)) })
  lap('wall')
  for (const [a, r, s] of [[70, 230, 'oak'], [160, 240, 'cherry'], [250, 220, 'dark_oak'], [300, 200, 'oak'], [110, 300, 'jungle']]) {
    const [x, z] = polar(ctx, a, r).map(Math.round)
    if (groundY(x, z) >= 0) giantTree(ctx, [x, groundY(x, z), z], { species: s, seed: a })
  }
  lap('trees')
  return finishSpawn(ctx, { land: (x, z) => groundY(x, z) >= 0 })
}
