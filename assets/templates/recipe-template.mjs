// BRIEF — fill this in before writing code (references/building/README.md, "Workflow").
//   What:        e.g. a fishing hamlet's net-maker's house
//   Style:       e.g. Nordic timber (references/building/styles.md)
//   Scale tier:  cottage 1:1 | showcase ~1.5x | monumental (README "Scale tiers")
//   Hero:        the one element that dominates (tower, gable, gate, window...)
//   Story:       who lives/works here, how old, what changed over time
//   Palette:     role -> block (foundation / wall field / frame / roof / accent / light)
//
// Copy this file, rename it, and work through the stages in order. Render after each stage:
//   node scripts/run-build.mjs recipe.mjs --out-dir minecraft-builds/NAME --json
//   node scripts/render.mjs --nbt minecraft-builds/NAME/NAME.nbt

const SIZE = [64, 48, 64]
const SEED = 1

// Palette roles. Keep 3-6 main blocks + <= 2 accents; ramps are ordered light -> dark.
const P = {
  foundation: ['cobblestone', 'mossy_cobblestone', 'andesite'],
  wallRamp: ['polished_andesite', 'stone_bricks', 'cracked_stone_bricks', 'tuff_bricks', 'deepslate_bricks'],
  frame: 'stripped_spruce_log',
  infill: { calcite: 4, white_terracotta: 1 },
  roof: 'dark_oak',
  trim: 'spruce',
  accent: 'red_wool',
  light: 'lantern',
}

export default function build(api) {
  const { kit } = api
  const b = api.builder(SIZE, { seed: SEED })

  // 1. SITE — terrain first; remember the heightmap for placing things on the ground.
  const ground = b.terrain({
    height: (x, z) => 6 + 3 * kit.noise.fbm2(x, z, { scale: 28, seed: SEED }),
    layers: [{ depth: 1, paint: 'grass_block' }, { depth: 3, paint: 'dirt' }, { paint: 'stone' }],
  })

  // 2. MASSING — placeholder volumes only (white_wool). Render and fix proportions here.
  //    2-4 volumes, secondaries 1/3-1/2 of the main, heights differ by >= 2.
  const floorY = Math.round(ground(32, 32)) + 1
  b.box([24, floorY, 26], [40, floorY + 4, 36], 'white_wool')

  // 3. STRUCTURE — foundation to below the lowest terrain point, frame/infill planes,
  //    openings, roof with overhang. Render elevations (--views south,east,north,west).
  b.box([23, floorY - 4, 25], [41, floorY - 1, 37], kit.palette(P.foundation))
  b.box([25, floorY, 27], [39, floorY + 4, 35], 'air')
  b.roof({ x0: 24, z0: 26, x1: 40, z1: 36, y: floorY + 5, material: P.roof, gable: 'spruce_planks', eaveTrim: true })

  // 4. MATERIAL — replace placeholders with ordered ramps applied in clusters.
  b.texture([23, floorY - 4, 25], [41, floorY + 5, 37], P.wallRamp, { only: 'white_wool', focus: [[32, floorY + 1, 36]] })

  // 5. DETAIL — windows (recessed, sills, shutters), door (frame, awning, steps), trims,
  //    brackets, chimney, props. Close-ups: --yaw/--pitch/--target/--distance. Interiors: --clip-y.
  b.door([32, floorY, 36], 'south', { material: P.trim, awning: true })
  b.window([27, floorY + 1, 36], 'south', { width: 2, height: 2, shutters: true, material: P.trim })
  b.window([36, floorY + 1, 36], 'south', { width: 2, height: 2, shutters: true, material: P.trim })

  // 6. LANDSCAPE — path to the door, transition ring at the wall base, trees in 3 sizes,
  //    bushes at corners, clumped flowers.
  b.path([[32, 60], [32, 38]], { width: 2, paint: kit.palette({ dirt_path: 5, coarse_dirt: 2, gravel: 1 }) })
  b.tree([12, Math.round(ground(12, 14)) + 1, 14], 'oak', { seed: SEED })
  b.scatter({ density: 0.2, paints: [[8, 'short_grass'], [2, 'tall_grass'], [1, 'poppy'], [1, 'cornflower']] })

  // 7. LIGHT — a light at every door, lamps every 8-12 blocks on paths. Check --lighting night.
  b.lampPost([29, Math.round(ground(29, 39)) + 1, 39], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall' })

  return b.finish({ name: 'my-build', description: 'Replace with a one-line description.' })
}
