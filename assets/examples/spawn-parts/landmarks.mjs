// Every landmark from assets/spawn-parts/landmarks.mjs on one tropical plains site, for looking at
// them side by side (and as a call reference). Middle row faces south, toward the camera's side.
//   node scripts/run-build.mjs assets/examples/spawn-parts/landmarks.mjs --out-dir minecraft-builds/landmarks

import { startSpawn, finishSpawn } from '../../spawn-parts/spawn.mjs'
import { buildSite } from '../../spawn-parts/site.mjs'
import { landmark, palmTree, LANDMARKS } from '../../spawn-parts/landmarks.mjs'

export default function build(api) {
  const ctx = startSpawn(api, { name: 'Landmarks', size: 200, height: 110, theme: 'tropical', setting: 'plains', seed: 3, floorY: 30 })
  const { b, FY } = ctx
  // a 3 x 3 grid: [kind, x, z, options]
  const spots = [
    ['volcano', 40, 42], ['ship', 104, 40], ['lighthouse', 162, 40],
    ['statue', 40, 104], ['giant-tree', 100, 104], ['giant-palm', 160, 104],
    ['rock-spires', 40, 160], ['rock-arch', 100, 160], ['statue', 160, 160, { subject: 'knight' }],
  ]
  const pads = spots.map(([kind, x, z]) => {
    const r = LANDMARKS[kind].r
    return { x0: x - r, z0: z - r, x1: x + r, z1: z + r, y: FY, blend: 4 }
  })
  buildSite(ctx, { pads, flat: () => true })
  for (const [kind, x, z, opts] of spots) ctx.place(landmark, kind, { x, z, y: FY, seed: x + z, facing: 'south', ...(opts ?? {}) })
  for (const [x, z, h] of [[70, 130, 9], [74, 134, 11], [130, 130, 8], [133, 74, 10]]) ctx.place(palmTree, [x, FY, z], { height: h, seed: x + z })
  b.spawnPoint([100, FY, 186], 'north')
  return finishSpawn(ctx)
}
