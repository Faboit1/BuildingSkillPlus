# Building Kit API

The kit is the high-level layer on top of the raw recipe API (`references/recipe-api.md`).
Use it for every new build: it gives you painting with palettes and gradients, shape
rasterizers, architecture generators (roofs, windows, doors, arches, stairs...), organic
generators (trees, terrain, rocks...), modules with rotation, and a finishing pass that makes
the export match what the game will show.

```js
export default function build(api) {
  const { kit } = api
  const b = api.builder([48, 40, 48], { seed: 7 })      // canvas size [x, y, z]
  b.terrain({ height: (x, z) => 4 + 2 * kit.noise.fbm2(x, z, { scale: 20 }) })
  b.box([10, 5, 10], [20, 9, 18], kit.palette({ stone_bricks: 6, cracked_stone_bricks: 2, andesite: 1 }))
  b.roof({ x0: 10, z0: 10, x1: 20, z1: 18, y: 10, material: 'spruce', gable: 'spruce_planks' })
  return b.finish({ name: 'my-build' })                  // → { structure, metadata }
}
```

Run it exactly like any recipe: `node scripts/run-build.mjs recipe.mjs`, then
`node scripts/render.mjs --nbt <out>.nbt` to look at it.

## Coordinates and conventions

- `x` = east (+) / west (−), `y` = up, `z` = south (+) / north (−). Points are `[x, y, z]`.
- Integer coordinates are block positions. Shape centres may be fractional:
  a sphere centred on `10` with radius `4.5` is symmetric; centre `10.5` makes an even-width shape.
- Out-of-canvas placements are skipped silently and counted (`finish()` warns).
- Directions: `'north' | 'east' | 'south' | 'west' | 'up' | 'down'`. `kit.cw(f)`, `kit.ccw(f)`,
  `kit.opposite(f)`, `kit.facingFrom(dx, dz)`, `kit.DIR[f]` → unit vector.
- Wall features take the wall's **outward** facing. "Right" when you stand outside looking at
  the wall is `kit.ccw(facing)`.
- Stairs: `facing` = side of the tall back; you walk up moving toward `facing`.
  `half=top` = upside-down. Shapes (inner/outer corners) are computed for you at `finish()`.

## Paints

Anywhere a block is expected you may pass a **paint**:

| Paint | Example |
| --- | --- |
| block id (namespace optional) | `'stone_bricks'`, `'minecraft:oak_log[axis=x]'` |
| block record | `{ name: 'minecraft:oak_stairs', props: { facing: 'east' } }` |
| function `(x, y, z, b) => paint \| null` | `(x, y, z) => (y % 4 === 0 ? 'chiseled_stone_bricks' : 'stone_bricks')` |
| `kit.palette(...)` | weighted, spatially clumped mix |
| `kit.gradient(...)` | banded blend along an axis or any field |
| `'air'` | removes the block |

Returning `null` from a function leaves the position untouched (great for masks).

- `kit.palette(entries, { scale = 3, grain = 0.25, seed })` — entries as `{ id: weight }` or
  `[[weight, paint], ...]`. `scale` is clump size in blocks (0 = per-block random). Clumped
  noise reads as natural material variation; per-block random reads as static.
- `kit.gradient(stops, { axis = 'y', from, to, t, dither = 0.6, scale = 2.5, seed })` — `stops`
  ordered from `from` to `to` (each stop may itself be a palette). `t: (x,y,z) => 0..1` for
  radial/custom fields. `dither` roughens band borders with coherent noise.
- `kit.blend(a, b, amount, { scale })` — `amount` share of `b` in noisy patches.
- `kit.bands(base, band, { period, offset, width, axis })` — string courses, rings.
- `kit.pattern(indexFn, paints)` — checkerboards, stripes, tiled floors.

## Builder: core

| Method | Notes |
| --- | --- |
| `b.set(x, y, z, paint, opts?)` | `opts.keep` only fills empty cells; `opts.only` replaces only matching blocks (`'oak_*'`, `'*_planks'`, id, array, predicate); `opts.mask(x,y,z,b)`; `opts.nbt` block entity |
| `b.get(x, y, z)` / `b.nameAt` / `b.has` | read back `{ name, props }` |
| `b.remove(x, y, z)` | delete |
| `b.topY(x, z, test?)` | highest block in a column (optionally matching `test`) |
| `b.count(test?)`, `b.bounds()`, `b.entries()` | inspection |
| `b.box(a, c, paint, opts)` | filled cuboid (inclusive corners) |
| `b.hollowBox(a, c, paint)` | six faces |
| `b.walls(a, c, paint)` | four vertical sides only |
| `b.edges(a, c, paint)` | 12 edges (frames, scaffolds) |
| `b.clear(a, c)` | set air |
| `b.replace(a, c, from, to)` / `b.replaceAll(from, to)` | material swaps |
| `b.map((x, y, z, block) => paint)` | post-process every block |

## Builder: shapes

All accept `opts.hollow` (watertight shell) and `opts.thickness` where it makes sense, plus the
`set` options (`keep`, `only`, `mask`).

| Method | Notes |
| --- | --- |
| `b.sphere(c, r, paint)` | use x.5 radii for round voxel spheres |
| `b.ellipsoid(c, [rx, ry, rz], paint)` | |
| `b.dome(c, r, paint, { height })` | upper half ellipsoid on y = c[1] |
| `b.cylinder(base, r, h, paint, { axis: 'y'\|'x'\|'z' })` | base centre, height `h` |
| `b.tube(base, r, h, paint, { thickness })` | open tube (tower walls) — gap-free ring |
| `b.ring(c, r, paint, { thickness })` | one-layer gap-free ring |
| `b.disc(c, r, paint, { inner })` | horizontal disc / annulus |
| `b.cone(base, r, h, paint)` | |
| `b.prism([[x, z], ...], y0, y1, paint)` | extruded polygon footprint |
| `b.line(a, c, paint, { radius, connect })` | radius 0 = one-block line (`connect: 6` for a face-connected walk that reads solid; default 26 is fine for chains/fences); radius > 0 = capsule (≥ 0.87 stays watertight) |
| `b.curve(points, paint, { radius })` | Catmull-Rom through points; `radius` may be `t => r` for tapering limbs, cables, arches, rivers. Tube radii are clamped to ≥ 0.87; radius < 0.6 draws a face-connected thin line |
| `b.sdf(min, max, fn, paint)` | fill where `fn(x,y,z) <= 0`; combine `kit.sdf.*` |
| `b.lathe(base, height, (dy, t) => r, paint)` | solid of revolution: domes, onion domes, vases, fountains |
| `b.fillWhere(min, max, inside, paint)` | generic predicate rasterizer |

`kit.sdf`: `sphere(c, r)`, `ellipsoid(c, radii)`, `box(min, max)`, `capsule(a, b, r \| t => r)`,
`cylinder(base, r, h)`, `torus(c, R, r)`, `union(...)`, `intersect(...)`, `subtract(a, b)`,
`smoothUnion(k, ...)` (organic fillets), `displace(f, amount, scale)` (noisy rock surfaces),
`shell(f, thickness)`.

## Builder: architecture

### `b.roof(opts)` — rectangular roofs

```js
b.roof({
  x0, z0, x1, z1,       // outer wall lines (inclusive)
  y,                    // level of the roof row directly above the wall line (= wall top + 1)
  type: 'gable',        // 'gable' | 'hip' | 'pyramid' | 'mansard' | 'shed'
  axis: 'x',            // ridge direction for gable/shed (default: longer side)
  material: 'spruce',   // any family with stairs + slab: 'dark_oak', 'deepslate_tile', 'brick', 'cut_copper', 'mud_brick', ...
                        // or { stairs, slab, block } ids
  pitch: 1,             // rise per row: 0.5 (slabs), 1 (stairs), 2/3 (steep) — or a list per row
                        // from the eave inward, e.g. [0.5, 0.5, 1, 1, 2] (curved/Asian), [2, 2, 0.5, 0.5] (gambrel)
  overhang: 1,          // eave overhang beyond the side walls
  gableOverhang: 1,     // overhang beyond the gable end walls
  gable: 'spruce_planks', // fills every wall-line cell up to the roof (gable triangles, shed walls)
  eaveTrim: true,       // upside-down stairs / top slabs under the outermost row (thick eaves)
  ridgeCap: 'stone_brick_wall', // extra block on the ridge line
  thickness: 1,         // solid layers under the roof surface inside the walls
  underside: 'stairs',  // 'stairs' puts an upside-down stair (same facing) under each 1:1 stair: clean 45° ceiling
                        // inside, double-thick rake outside. 'block' uses full blocks.
  rises: 'north',       // shed only: direction the roof climbs toward
})
// → { topY, base, axis, cells }
```

The pitch profile is the key to roof character: `1` classic, `0.5` low Mediterranean,
`2` steep Nordic/Gothic, `[0.5, 0.5, 1, 1, 2, 2]` East-Asian curve, `[2, 2, 3, 0.5]` mansard.
For L/T/cross plans build the larger roof first, then the wing roofs; stair corners where the
slopes meet are resolved automatically.

### Other components

| Method | Notes |
| --- | --- |
| `b.coneRoof([cx, y, cz], radius, { material, pitch = 2, overhang = 1, flare = true, finial })` | round tower roofs; `flare` starts with shallow rows for a bell-shaped eave |
| `b.window(pos, facing, { width, height, glass, frame, sill, lintel, shutters, flowerBox, recess, arch, mullion, material })` | `pos` = bottom-left opening cell seen from outside; `shutters: true` uses the material's trapdoor |
| `b.door(pos, facing, { material, width: 1\|2, hinge, frame, awning, steps })` | places both halves (and both doors) |
| `b.arch(a, c, paint, { type: 'round'\|'pointed'\|'segmental'\|'flat', thickness, depth, fill, spandrel, top, rise })` | `a`/`c` = springer cells (same y, axis-aligned); opening is cleared with `fill` |
| `b.column(base, height, { shaft, plinth, capital, flare })` | `flare: 'quartz'` adds stair base/capital |
| `b.battlements([x0, z0], [x1, z1], y, paint, { period, height, cap })` | crenellated perimeter |
| `b.spiralStairs(c, rInner, rOuter, y0, y1, material, { stepsPerTurn, core, clockwise })` | tower stairs |
| `b.timberWall(a, c, { frame, infill, postEvery, beams, braces: true\|'all' })` | posts, beams, end-bay braces on a 1-thick plane |
| `b.lampPost(base, { height, post, foot, lantern, arm })` | `arm: 'east'` hangs the lantern |
| `b.hangingLantern(anchor, length)` | chain + lantern below an anchor block |
| `b.chimney(base, height, { paint, cap, smoke, size })` | campfire smoke inside |

## Builder: nature

| Method | Notes |
| --- | --- |
| `b.tree(base, species, opts)` | species: `oak, big_oak, birch, spruce, pine, dark_oak, cherry, willow, jungle, acacia, azalea, mangrove, dead, fantasy`. `base` = first log (ground + 1). Override `height`, `trunk`, `leaves`, `blob`, `branches`, `seed`... Leaves are persistent. |
| `b.leafBlob(c, [rx, ry, rz], leaves, { holes, roughness })` | custom canopies, hedges |
| `b.bush(base, { radius, leaves, log })` | |
| `b.boulder(c, radii, paint, { roughness, mossTop })` | noise-displaced rock |
| `b.terrain({ x0, z0, x1, z1, base, height: (x, z) => y, layers, surface })` | returns `(x, z) => surfaceY` |
| `b.scatter({ x0, z0, x1, z1, on, density, paints, clump })` | grass/flowers; tall plants get both halves |
| `b.path(points2d, { width, paint, jitter })` | winding path on the surface (`paint` may be a palette) |
| `b.pond([cx, level, cz], r, { depth, rim, bed })` | |
| `b.overgrow(a, c, { amount, maxLength, moss })` | vines on exposed walls + moss carpet |
| `b.island([cx, topY, cz], r, { depth, top, soil, rock })` | floating island |
| `b.weather(a, c, { amount, mossBias, scale })` | swaps blocks for cracked/mossy/oxidized variants in patches |

### `b.texture(a, c, ramp, opts)` — gradient retexturing (the pro workflow)

Block out with a placeholder, then texture it. `ramp` is ordered **light → dark** (material names
or full-block ids). Each matching block gets a ramp step from: height (darker toward the base),
exposed corners/edges/jambs, drip streaks under overhangs, focal points (brighter), clustered noise
and a little jitter; then an anti-splatter pass keeps neighbours within `maxStep` steps. Shapes are
preserved — a stair becomes a stair of the chosen material (falls back to keeping it if that
material has no stair).

```js
b.texture([x0, y0, z0], [x1, y1, z1],
  ['polished_andesite', 'stone_bricks', 'cracked_stone_bricks', 'tuff_bricks', 'deepslate_bricks'],
  { only: 'white_wool', base: 0.3, edge: 0.18, drip: 0.09, focus: [[doorX, doorY, doorZ]], focusRadius: 6, scale: 6, noise: 0.22, seed: 1 })
```

Use ramps of one texture family (bricks → bricks) for walls; mixing very different textures
(cobble next to bricks) reads as patchwork.

## Modules and stamping

Author a detail once, stamp it anywhere, rotated and mirrored (block states rotate with it):

```js
const lamp = b.module([3, 4, 3])
lamp.set(1, 0, 1, 'stone_brick_wall'); lamp.set(1, 1, 1, 'spruce_fence'); lamp.set(1, 2, 1, 'lantern')
b.stamp(lamp, [20, 5, 8])                       // as authored
b.stamp(lamp, [30, 5, 8], { rotate: 1 })        // 90° clockwise
b.stamp(lamp, [40, 5, 8], { mirror: 'x', keep: true })
```

`kit.rotate(block, turns)` / `kit.mirror(block, 'x' | 'z')` transform single states.

## Materials

`kit.material(name)` resolves a family from `scripts/lib/data/materials.json`
(see `references/building/materials.md`): `{ block, stairs, slab, wall, fence, fence_gate,
door, trapdoor, log, wood, stripped_log, planks, ... }`. Accepts `'spruce'`, `'stone_brick'`,
`'stone_bricks'`, `'deepslate_tiles'`, `'oak_stairs'`...

Helpers return state strings: `kit.stairs('spruce', 'east', 'top')`, `kit.slab('stone_brick', 'top')`,
`kit.trapdoor('spruce', 'south', { open: true })`, `kit.log('oak', 'x')`, `kit.gate('spruce', 'north')`.
`kit.variant('terracotta', 'stairs', 'granite')` tries fallbacks for missing shapes.

## Colours

Measured from the vanilla 1.21.1 textures (`scripts/lib/data/block-colors.json`, guide:
`references/building/block-colors.md`, `references/building/palettes.md`).

- `kit.colorOf(id)` → `{ side, top, avg, lab: [L, a, b], hue, sat, light, full, noise, ... }`
- `kit.nearestBlock('#7c5c3a' | [L, a, b], { full, exclude, count })` → closest building block(s)
- `kit.ramp(fromId, toId, steps)` → smoothest perceptual ladder of real blocks between two blocks
- `kit.sortByLightness(ids)`, `kit.contrast(a, b)` → `{ dL, dE }`
- `kit.paletteReport(ids)` → value spread, hue spread, too-similar pairs, busy textures, warnings

## Noise and randomness

`kit.noise.hash01(x, y, z, seed)`, `kit.noise.perlin3`, `fbm2(x, z, { scale, octaves, seed })`,
`fbm3`, `ridged2`, `coherent01(x, y, z, { scale, grain })`, `kit.rng(seed)` →
`rng()`, `rng.int(a, b)`, `rng.range(a, b)`, `rng.chance(p)`, `rng.pick(list)`, `rng.weighted(entries)`,
`rng.shuffle(list)`, `rng.gauss(mean, sd)`. Everything is deterministic for a given seed.

## `b.finish(opts)`

```js
return b.finish({ name: 'castle', description: '...', trim: false, connections: true, persistentLeaves: true, validate: true, strict: false })
```

In order it:

1. Validates every distinct state against the official 1.21.1 block table
   (`scripts/lib/data/block-states.json`): unknown ids, unknown properties, invalid values.
   Problems are printed (or thrown with `strict: true`).
2. Fills every block's missing properties with vanilla defaults. The previewer renders a block
   with missing properties as nothing (e.g. bare `oak_log` or `grass_block`), so this matters.
3. Completes partners: the upper half of doors and tall plants, the head of a bed, vine faces
   from adjacent solid blocks.
4. Computes vanilla neighbour states: stair corner shapes, wall sides/posts (low/tall/up),
   fence/pane/bars connections, fence gates in walls.
5. Marks leaves `persistent=true` so they do not decay after placement.
6. Builds the Lodestone `Structure` (`trim: true` shrinks it to the used bounds).

`run-build.mjs` applies steps 2–5 to raw-API recipes too.

`run-build.mjs` reports `builder.problems` and `builder.clipped` in its JSON summary.
