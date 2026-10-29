// THE LAND: THE LANDSCAPE OF A WHOLE SPAWN. Read this, look at img/land.png, then design your own:
// where the mountains stand, how the valley runs, where the river goes and the town sits. The tool
// is the kit's heightfield, b.land (references/kit-api.md, "Landscapes"): you shape it with
// landforms, erosion weathers it like real rain does, a map shows it in seconds, then it is painted
// into blocks by slope, height and wetness.
//
// DO
// - Design the land from landforms, biggest first: the ranges that frame the spawn (land.range,
//   tallest behind the first view, steep toward the players), a lone peak or two (land.peak), the
//   foothills along the foot of the range, a valley floor for the town and the plaza.
// - Mountains 3-8 times as wide as they are tall, never cones: ridges with spurs coming down from
//   the crest every 25-60 blocks and side valleys between, saddles and lesser summits.
// - Erode it (land.erode, then land.thermal): gullies down every slope, sharp spurs, scree under
//   the cliffs, fans of gravel where the gullies open onto the flats. This is what makes it look
//   real; skipping it is what makes terrain look generated.
// - Flat pads for everything people use (land.pad: the plaza, the town, a fort), blended into the
//   slopes over 20-40 blocks, and kept from erosion.
// - Water where water would be: the river in the valley's lowest line (land.valley carves its
//   floodplain, then river() from river.mjs cuts the channel), a lake in a basin.
// - Forests by the land: on the gentle and middle slopes in clumps with clearings, thinning to a
//   tree line well below the summits, none on the cliffs or the pads; meadows on the valley floor.
// - Look at land.preview() and the screenshots from the plaza (players see about 160-200 blocks
//   at a normal render distance): the first view must show a mountain or the hero within that.
// DON'T
// - Noise hills everywhere: height = base + n * fbm(x, z) over the whole island (lumps of the same
//   size in every direction, no valley, no ridge, nothing flat to build on).
// - Smooth cones or domes of one stone for mountains, standing on flat grass with no foothills.
// - Grass up every slope and on top of every peak; one ground block over the whole land.
// - A river as a straight trench of one width at the grass level; water higher than its banks.
// - A land that ends at the canvas edge in a vertical wall (an outline with a fall avoids it).

import { river } from './river.mjs'

// Builds the valley of the picture: a range round the north and west, a lone mountain east, a
// river from the range's foot to a lake, woods and meadows. Returns { land, groundY }.
export function valleyLand(ctx, { seed = 5, floor = 70, theme = 'autumn' } = {}) {
  const { b, kit, S } = ctx
  const land = b.land({ base: floor, seed })
  // the edge of the floating land: the relief falls to the rim over 40 blocks, so no wall shows
  land.outline({ cx: S / 2, cz: S / 2, r: S * 0.48, wobble: 0.1 }, { fall: 40, rim: floor })
  // 1. the range round the north and west: the tallest landform, steep toward the valley (asym < 0:
  //    the left side looking along the path, the valley side, is the steep one)
  land.range([[30, S * 0.78], [45, S * 0.4], [S * 0.3, 60], [S * 0.62, 34], [S * 0.92, 110]], { width: 220, height: 108, asym: -0.3, sharp: 1.8, seed: seed + 1 })
  // 2. a lone mountain east: stretched, with lesser summits (never a cone)
  land.peak([Math.round(S * 0.84), Math.round(S * 0.52)], { r: 92, height: 62, stretch: 1.5, angle: 1.2, seed: seed + 2 })
  // 3. foothills along the range's foot: low, rough, broken
  land.range([[S * 0.16, S * 0.66], [S * 0.22, S * 0.36], [S * 0.42, S * 0.22], [S * 0.66, S * 0.26]], { width: 90, height: 16, rough: 0.7, seed: seed + 3 })
  // 4. the river's floodplain from the foot of the range to the lake, and the lake's basin
  const lake = { cx: Math.round(S * 0.66), cz: Math.round(S * 0.82), r: 34 }
  // the river ends where it meets the lake's shore (inside the lake it would build banks in the water)
  const mouth = [S * 0.47, S * 0.74]
  const dir = Math.atan2(lake.cz - mouth[1], lake.cx - mouth[0])
  const riverPath = [[S * 0.4, S * 0.3], [S * 0.43, S * 0.45], [S * 0.36, S * 0.6], mouth, [lake.cx - Math.cos(dir) * (lake.r + 4), lake.cz - Math.sin(dir) * (lake.r + 4)]]
  // the floodplain stays above the water (floor + 1): river() cuts the channel itself, and a lake
  // fills everything joined to it below its level, so a floodplain below it would flood
  land.valley([...riverPath, [lake.cx, lake.cz]], { width: 60, floor: floor + 1, shape: 'v', flat: 0.3 })
  land.pad(lake, { y: floor - 6, blend: 34, lock: false })
  // 5. a gentle roll on the floor, then the plaza's pad, kept flat and kept from erosion
  land.hills({ amp: 2.2, scale: 110 })
  land.hills({ amp: 0.8, scale: 26, seed: seed + 9 })
  const plaza = { cx: Math.round(S * 0.6), cz: Math.round(S * 0.58), r: 46 }
  land.pad(plaza, { y: floor + 1, blend: 32 })
  // 6. weather it: rain cuts the gullies and lays the fans, then the cliffs shed scree
  land.erode({ strength: 1.5 })
  land.thermal({ talus: 1.3, iterations: 8 })
  // 7. into blocks: the theme's ground by slope and height, strata on the steep faces, a lake
  const groundY = land.paint({
    theme,
    underside: { depth: 46, ramp: 90 },
    water: { level: floor - 2, from: [lake.cx, lake.cz] },
  })
  // 8. the river: its channel cut into the painted land, from the foot of the range to the lake
  river(ctx, riverPath, { width: [6, 11], depth: 3, level: floor - 2, ground: groundY, seed: seed + 4 })
  // 9. woods by the land: gentle and middle slopes, a tree line 55 above the floor, not on the plaza
  const woods = land.where({ slope: [0, 0.95], y: [0, floor + 55], unlocked: true, dry: true })
  b.forest({
    x0: 12, z0: 12, x1: S - 13, z1: S - 13,
    ground: groundY, density: 0.55, minSpacing: 8, seed: seed + 5,
    species: [[5, 'spruce'], [3, 'birch'], [3, 'oak'], [1, 'dark_oak']],
    // clearings and meadows: a slow noise opens the woods on the valley floor
    avoid: (x, z) => !woods(x, z) || (groundY(x, z) < floor + 8 && kit.noise.fbm2(x, z, { scale: 70, seed: seed + 6 }) < 0.04),
  })
  // 10. the meadows: grass and flower drifts on the open flats
  const flats = land.where({ slope: [0, 0.5], unlocked: true, dry: true })
  for (let z = 4; z < S - 4; z += 1)
    for (let x = 4; x < S - 4; x += 1) {
      if (!flats(x, z)) continue
      const y = groundY(x, z)
      if (y < 0 || b.nameAt(x, y, z) !== 'minecraft:grass_block' || b.get(x, y + 1, z)) continue
      const n = kit.noise.coherent01(x, 0, z, { scale: 5, seed: seed + 7 })
      const r = kit.hash01(x, y, z, seed + 8)
      if (n > 0.5 && r < 0.45) b.set(x, y + 1, z, r < 0.03 ? (n > 0.8 ? 'minecraft:oxeye_daisy' : 'minecraft:cornflower') : r < 0.34 ? 'minecraft:short_grass' : 'minecraft:fern')
    }
  return { land, groundY, plaza, lake }
}

// ------------------------------------------------------------------ don't
// The fake look: noise bumps over the whole island, cone mountains on the flat, grass everywhere,
// a straight trench of water, trees in a grid.
function noiseLandBad(ctx, { floor = 70 } = {}) {
  const { b, kit, S } = ctx
  const ground = b.terrain({ x0: 8, z0: 8, x1: S - 9, z1: S - 9, base: floor - 30, height: (x, z) => floor + 12 * kit.noise.fbm2(x, z, { scale: 45, seed: 3 }) })
  for (const [cx, cz, r, h] of [[S * 0.3, S * 0.22, 60, 80], [S * 0.62, S * 0.18, 70, 95], [S * 0.84, S * 0.5, 55, 70]])
    for (let z = Math.round(cz - r); z <= cz + r; z += 1)
      for (let x = Math.round(cx - r); x <= cx + r; x += 1) {
        const d = Math.hypot(x - cx, z - cz)
        if (d > r) continue
        const top = Math.round(ground(x, z) + h * (1 - d / r))
        for (let y = ground(x, z); y <= top; y += 1) b.set(x, y, z, y === top ? 'minecraft:grass_block' : 'minecraft:stone')
      }
  for (let z = Math.round(S * 0.3); z < S * 0.85; z += 1)
    for (let x = Math.round(S * 0.45); x < S * 0.45 + 6; x += 1) {
      const y = b.topY(x, z)
      b.set(x, y, z, 'minecraft:water')
    }
  for (let z = 60; z < S - 30; z += 34)
    for (let x = 40; x < S - 30; x += 34) {
      const y = b.topY(x, z)
      if (b.nameAt(x, y, z) === 'minecraft:grass_block') b.tree([x, y + 1, z], 'oak', { seed: x + z })
    }
}

export const figure = { size: 560, height: 200, floorY: 70, camera: { eye: [330, 118, 470], lookAt: [200, 104, 120], fov: 66, width: 640, height: 400, far: 520 } }

export function demo(ctx, which) {
  if (which === 'good') valleyLand(ctx)
  else noiseLandBad(ctx)
}
