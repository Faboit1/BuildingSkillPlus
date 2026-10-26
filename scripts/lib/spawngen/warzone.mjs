// The generator's warzone: reads brief.warzone = { width, moshpit, koth, label } and places the
// shared parts (assets/spawn-parts/warzone.mjs): the band round the spawn square, the moshpit
// north-west of the north corridor, the KOTH hill south.

import { fits, koth, moshpit, warzoneBand } from '../../../assets/spawn-parts/warzone.mjs'

export function buildWarzone(ctx) {
  const { brief, W, spawnS, C } = ctx
  const wz = brief.warzone
  const [cx] = C
  const lo = W
  const hi = W + spawnS - 1
  const mid = W / 2
  const spots = []
  if (wz.moshpit) {
    const p = [Math.round(cx - spawnS / 4), Math.round(lo - mid)]
    if (fits(ctx, p, 15)) {
      moshpit(ctx, p, { r: Math.min(12, Math.floor(mid - 6)) })
      spots.push({ x: p[0], z: p[1], r: 16 })
    } else ctx.warn('the warzone is too narrow or off the island for the moshpit; raise warzone.width')
  }
  if (wz.koth) {
    const p = [cx + Math.round(spawnS / 6), Math.round(hi + mid)]
    if (fits(ctx, p, 10)) {
      koth(ctx, p)
      spots.push({ x: p[0], z: p[1], r: 12 })
    } else ctx.warn('the warzone is too narrow or off the island for the KOTH hill; raise warzone.width')
  }
  warzoneBand(ctx, { spawn: [lo, lo, hi, hi], label: wz.label ?? 'Warzone', keepClear: spots })
}
