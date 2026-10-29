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
| `b.set(x, y, z, paint, opts?)` | `opts.keep` only fills empty cells; `opts.only` replaces only matching blocks (`'oak_*'`, `'*_planks'`, id, array, predicate); empty cells match `'air'` in the list and predicates receive `null` for them (`only: ['air', 'water']` fills air and water only); `opts.mask(x,y,z,b)`; `opts.nbt` block entity |
| `b.get(x, y, z)` / `b.nameAt` / `b.has` / `b.is(x, y, z, test)` | read back `{ name, props }`; `is` tests against an id, id list, predicate or `null`/`'air'` |
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
| `b.curve(points, paint, { radius })` | Catmull-Rom through points; `radius` may be `t => r` for tapering limbs, cables, arches, rivers. Tube radii are clamped to ≥ 0.87; radius < 0.6 draws a face-connected thin line. `paint: null` places nothing and just returns the sampled centre line |
| `b.sdf(min, max, fn, paint)` | fill where `fn(x,y,z) <= 0`; combine `kit.sdf.*` |
| `b.lathe(base, height, (dy, t) => r, paint)` | solid of revolution: domes, onion domes, vases, fountains |
| `b.fillWhere(min, max, inside, paint)` | generic predicate rasterizer |

`kit.sdf`: `sphere(c, r)`, `ellipsoid(c, radii)`, `box(min, max)`, `capsule(a, b, r \| t => r)`,
`taper(a, b, r0, r1)` (limbs, horns, branches), `cylinder(base, r, h)`, `torus(c, R, r)`,
`union(...)`, `intersect(...)`, `subtract(a, b)`, `smoothUnion(k, ...)` (organic fillets),
`displace(f, amount, scale)` (noisy rock surfaces), `shell(f, thickness)`.
`kit.catmullRom(points, { samplesPerBlock })` returns a smooth centripetal spline through the points.

## Builder: sculpting

Organic forms, statues, ships and landmarks (`scripts/lib/kit/sculpt.mjs`; techniques and numbers
in `references/building/sculpting.md`). Block out in a placeholder (`white_wool`), check the
silhouette render, then shade.

| Method | Notes |
| --- | --- |
| `b.tubeAlong(points, s => r, paint, opts)` | watertight tapered tube on a centripetal Catmull-Rom (tails, necks, roots, cables); never thinner than 0.87; a function paint also gets `s` (0..1 along) |
| `b.shadeSurface(min, max, rampDarkToLight, { only, light, ambient, bands, base })` | shade a sculpted volume by surface normal · light + occlusion; every ramp step used, clumped dither, stairs/slabs keep shape. Ramp is **dark → light** (auto-flipped by measured L\* if reversed). Use for statues, rocks, creatures; use `b.texture` for architecture |
| `b.erode(min, max, { preset, iterations, only, protect })` | VoxelSniper presets: `smooth`, `melt`, `fill`, `lift`, `floatclean` |
| `b.hull({ bow, heading, length, beam, ... })` | lofted ship hull (keel, sheer, tumblehome, decks, bulwark, gunports, `doubleEnded` longships); returns `at(u, w, y)`, `deckY(u)`, `mast(u)`, `halfBreadth(u)` |
| `b.crystalCluster(base, opts)` | hexagonal crystals with pyramid tips on a bed |
| `b.hugeMushroom(base, { type: 'red'\|'brown', ... })` | stem + cap with correct mushroom-block faces |
| `b.fixMushroomFaces(min, max)` | recompute mushroom-block faces after hand edits |
| `b.cloud(center, { length, ... })` | flat-based cumulus, shaded from above |
| `b.rockArch(footA, footB, opts)` | eroded natural arch with strata |
| `b.figure(base, { height, heads, build, facing, paint, pose })` | humanoid statue on an armature (pose: arm raise/swing/elbow, leg swing/spread/knee, contrapposto, headTurn, lean); returns joint positions |

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
  pitch: 1,             // rise per row: 0.5 (slabs), 1 (stairs), 2/3 (steep), 0 (flat, after row 0) — or a
                        // list per row from the eave inward, e.g. [0.5, 0.5, 1, 1, 2] (curved/Asian),
                        // [2, 2, 0.5, 0.5] (gambrel), [1, 1, 0] (Mojang low hip: two stair rings + flat field).
                        // List entry i is the rise from row i-1 up to row i; entry 0 only picks the eave
                        // element (≤ 0.5 → slab, else stair), so [2, 1, 0.5] and [1, 1, 0.5] are the same roof
  overhang: 1,          // eave overhang beyond the side walls
  gableOverhang: 1,     // overhang beyond the gable end walls
  gable: 'spruce_planks', // fills every wall-line cell up to the roof (gable triangles, shed walls)
  eaveTrim: true,       // upside-down stairs / top slabs under the outermost row (thick eaves)
  ridgeCap: 'stone_brick_wall', // extra block on the ridge line
  thickness: 1,         // solid layers under the roof surface inside the walls
  underside: 'stairs',  // 'stairs' puts an upside-down stair (facing down-slope, like vanilla) under each 1:1
                        // stair: clean 45° ceiling inside; rake and inner overhang rows get the same soffit
                        // stair, the outermost eave row stays bare. 'block' uses full blocks inside.
  rises: 'north',       // shed only: direction the roof climbs toward
  overwrite: true,      // false = only fill empty cells: lean-tos against a wall, roofs meeting existing walls
  merge: false,         // true = join roofs already built: per column the higher surface wins (cross gables
                        // and wings with their own pitch get clean valleys). Start the wing's back end where
                        // the main roof is already as high as the wing's ridge, or a hole opens behind it
})
// → { topY, base, axis, cells }   cells: Map "x,z" → { tb, kind }; the roof block of a column
//    sits at base + tb, kind is 'stairs' | 'slab' | 'block'. Use it to put things on the roof
//    (snow, moss, chimneys) or to trim another structure to the roof surface.
```

A list's last value repeats up to the ridge, so on wide roofs a trailing `2` keeps climbing. The
ridge sits about Σ(rises) above `y` over the half-span inside the walls (`(depth - 1) / 2` rows):

| Half-span inside walls | pitch 1 | `[1, 1, 2]` | pitch 2 |
| --- | --- | --- | --- |
| 3 (7 deep) | +3 | +4 | +6 |
| 4 (9 deep) | +4 | +6 | +8 |
| 5 (11 deep) | +5 | +8 | +10 |
| 6 (13 deep) | +6 | +10 | +12 |

Keep the roof ½–⅔ of the facade height: for 11–13 deep houses use `[1, 1, 1, 1, 2]` or pitch 1.

The pitch profile is the key to roof character: `1` classic, `0.5` low Mediterranean,
`2` steep Nordic/Gothic, `[0.5, 0.5, 1, 1, 2, 2]` East-Asian curve, `[2, 2, 3, 0.5]` mansard.
Half-steps on whole levels are full blocks (never top slabs), so slab-pitch eaves have no
see-through gaps. Inside the walls the roof only fills empty space below the wall-top level, so
steep rows never eat the top plate. A `gable` fill replaces the soffit stairs and the steep-row
band on the gable wall line, so the triangle is solid with a clean rake.

### `b.compoundRoof(opts)` — L, T, U, H, cross and courtyard plans

One roof over any rectilinear footprint, with correct hips, valleys, ridges and cross-gables
(no overlapping roofs or attic clutter). Same pitch profiles and finishing as `b.roof`.

```js
b.compoundRoof({
  rects: [[x0, z0, x1, z1], [wx0, wz0, wx1, wz1]],  // wall-line rectangles; list the main wing first
  // or cells: [[x, z], ...] for irregular footprints (holes = courtyards)
  y,                          // level of the roof row above the wall line (wall top + 1)
  type: 'gable',              // 'hip' | 'gable' | 'mixed' (rects with a gableAxes entry are gables)
  gableAxes: ['x', 'z'],      // ridge direction per rect (default: the rect's longer side)
  material: 'dark_oak', pitch: 1, overhang: 1, gable: 'spruce_planks', eaveTrim: true,
})
// → { topY, base, heights: Map "x,z" → y of the top roof block, cells }
```

For a gable plan, outer corners where two wings are flush get a valley running to the wall:
correct geometry, but it reads oddly. Set the wing back by 1–2 blocks or make the main block a hip
(`type: 'mixed'`). `references/building/procedural.md` covers the algorithm.

### `b.eastRoof(opts)` — East-Asian roofs (swept eaves, upturned corners, irimoya, skirts)

Hip, gable (kirizuma), hip-and-gable (irimoya) and pyramid roofs with a concave sweep, deep eaves,
corner lift (sori), a warm rafter soffit, hip and ridge lines, ridge-end horns, brackets and tip
lanterns. Skirts that stop at the storey above give pagoda tiers, mokoshi and Chinese double eaves,
and `above` joins a canopy or wing to a main roof with real valleys.

```js
const hall = b.eastRoof({
  x0, z0, x1, z1,          // outer wall lines (inclusive), same as b.roof
  y,                       // level of the roof row directly above the wall line (wall top + 1)
                           //   or eaveY: block level of the outermost eave element (pagoda tiers)
  type: 'hip',             // 'hip' | 'gable' | 'irimoya' | 'pyramid' (= hip, for square plans)
  axis: 'x',               // ridge direction for gable / irimoya (default: the longer side)
  material: 'deepslate_tile', // family with stairs + slab ('dark_oak', 'cherry', 'oxidized_cut_copper',
                           //   'bamboo_mosaic'...); copper_block-style blocks use their substitutes;
                           //   or { stairs, slab, block }
  ribs: 'deepslate_brick', // optional: alternate tile courses (rows running down the slope)
  ridge: 'polished_blackstone', // ridge line, hip lines, ridge-end horns (default: material)
  rafter: 'spruce',        // soffit and eave fascia: everything under the top surface (alias underside)
  pitch: [0.5, 0.5, 1, 1, 1], // rise per ring from the eave inward (b.roof semantics, see below)
  overhang: 2,             // eave depth beyond the wall lines (3-4 on temples and pagodas)
  gableOverhang,           // gable rake overhang (default overhang - 1, min 1; irimoya uses overhang)
  lift: 1,                 // corner upturn in blocks: 0, 1 small roofs, 1.5 pagoda tiers, 2 big halls
  liftReach: 2 * lift,     // blocks (Manhattan, from the corner) over which the lift fades out
  liftCurve: 1,            // >1 concentrates the lift at the tip
  thickness: 1,            // shell depth under the surface (1.5 = heavy pagoda eaves)
  stopRing, stopAt,        // skirts: build rings < stopRing (ring 0 = eave row), or leave out the
                           //   wall-line rect stopAt: [x0, z0, x1, z1] of the storey above
  inset,                   // irimoya: hip rings at each gable end (default max(overhang + 1, span / 4))
  gable, gableBeam,        // gable triangle paint (+ its bottom course), set back 1 (gableSetback) on irimoya
  barge: true,             // bargeboards: rafter trapdoors on the gable rakes (or a trapdoor id)
  ridgeEnds: true,         // onigawara horns at both ridge ends ('small' | 'large'; auto large at 13+ across)
  brackets: true,          // upside-down rafter stairs under the soffit along the walls, 2 deep at
                           //   the corners; { every: 3, depth: 2 } adds the 2-deep step every 3 (posts)
  lanterns: true,          // a hanging lantern under each corner tip (or a lantern id)
  finial: ['gold_block', 'lightning_rod'], // stacked on the apex (hip / pyramid)
  above: mainRoof,         // only build where this roof rises above another roof (joins, valleys)
  only: cell => true,      // custom subset; cell has x, z, top (surface y), y (top block), ring, sec, hip, ridge
  rim, overwrite: true,    // rim: lowest level of the wall-line columns (default y); overwrite: false = fill air only
})
// → { topY, base, y, axis, inset, levels, outline, apex, field,
//     heights: Map "x,z" → top block y, cells: Map "x,z" → { top, y, bottom, ring, sec, kind, facing ... },
//     surface(x, z) → surface height (may be x.5; -Infinity off the roof), bottom(x, z) → lowest block or null }
```

How it reads: the roof is a heightfield in half blocks over the eave outline. Each column is a shell
from the surface down to half a block below its lowest neighbour (at least `thickness`), so
neighbouring columns always overlap: upturned corners and steep steps have no see-through gaps.
Top pieces are tile, ridge material on hips and ridges; pieces that stand above the lowest
neighbour are visible risers (tile); everything else is rafter, and a column whose lowest piece
would be tile gets half a block of rafter under it, so the whole soffit reads warm from below.
Stairs face uphill; finish() computes their corner shapes.

- **Pitch** works like `b.roof`: entry i is the rise from ring i-1 to ring i, entry 0 only picks slab
  (≤ 0.5) or stair, and the **last value repeats** up to the ridge. On hips and pyramids a trailing
  steep value stacks into a spike (`[0.5, 0.5, 1, 1, 2]` on a 19-wide hip ends in six 2-rises; the
  builder warns), so end hip lists in `1`. A single trailing 2 that is used once is fine: the
  pagoda top uses it to lift the apex for the finial. Keep an **even number of leading 0.5s**
  (counting entry 0): `[0.5, 0.5, 1, …]` and `[0.5, 0.5, 0.5, 0.5, 1, …]` put the stair rings on
  whole levels; an odd count puts every later ring on x.5 levels (slab-on-block steps, no stairs).
- **Profiles** (verified): small roofs `[0.5, 0.5, 1, 1, 1]`; temple halls `[0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1, 1]`
  (long flat brim, then 1:1); pagoda skirts `[0.5, 0.5, 1, 1, 1]`; Chinese upper eave `[0.5, 0.5, 0.5, 0.5, 1, 1, 1]`,
  lower skirt `[0.5, 0.5, 1]`.
- **Lift** fades by half a block per block from each corner (Manhattan). Inside the lift zone the hip
  line has no bead and runs in ridge material out to the tip, so it dips and flicks up like a real
  sori hip. `lift: 2` on a 23-long hall, 1.5 on pagoda tiers, 1 on pavilions and canopies.
- **y / walls:** inside the wall lines, pieces below `y` only fill empty space (wall tops and plates
  survive); wall-line columns reach down to `rim` (default `y`), so the roof always closes onto the
  wall. Build walls first, then the roof, then posts that should cut through it.
- **Irimoya** = hip field + gable field on the same outline: the gable rises `inset` rings in from the
  hip ends, its rake is a thin shell, the triangle (`gable`) sits one block behind the rake, and
  `barge` adds bargeboards. The triangle needs about 13+ blocks across the eave outline; on smaller
  roofs the gable rises only a ring or two above the hip (a pavilion look).
- **Joins:** build the main roof first, then the canopy or wing with `above: main`. Only cells that
  rise above the main surface are drawn, so the union of the two surfaces is the valley. Start the
  canopy's footprint inside the main walls and keep its eave at or below the main eave.

```js
// Temple hall: irimoya, deep eaves, brackets, lanterns (17 x 13 walls, wall top 8)
const hall = b.eastRoof({ x0: 12, z0: 10, x1: 28, z1: 22, y: 9, type: 'irimoya',
  material: 'deepslate_tile', ribs: 'deepslate_brick', ridge: 'polished_blackstone', rafter: 'spruce',
  overhang: 3, lift: 2, pitch: [0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1, 1],
  gable: 'calcite', gableBeam: 'stripped_dark_oak_log[axis=z]', barge: true, brackets: { every: 4 }, lanterns: true })
// Kohai: a gabled canopy over the steps, joined to the hall slope (valleys come from `above`)
b.eastRoof({ x0: 16, z0: 20, x1: 24, z1: 27, y: 8, type: 'gable', axis: 'z', material: 'deepslate_tile',
  ridge: 'polished_blackstone', rafter: 'spruce', overhang: 1, gableOverhang: 1, lift: 1, pitch: [0.5, 0.5, 1, 1, 1, 1],
  gable: (x, y, z) => (x === 20 ? 'dark_oak_log[axis=y]' : 'calcite'), above: hall })
// Pagoda tier by hand: a skirt that stops at the next storey's walls (W = half-widths)
b.eastRoof({ x0: cx - W, z0: cz - W, x1: cx + W, z1: cz + W, eaveY: top - 1, type: 'hip', overhang: 3, lift: 1.5,
  thickness: 1.5, rim: top + 1, stopAt: [cx - Wn, cz - Wn, cx + Wn, cz + Wn], brackets: true, lanterns: true })
```

### `b.pagoda(opts)` — stacked storeys under swept skirts

```js
b.pagoda({ center: [cx, y, cz], tiers: 5, width: 11, overhang: 4, storey: 6,
  material: 'deepslate_tile', ridge: 'polished_blackstone', ribs: 'deepslate_brick', rafter: 'spruce',
  wall: 'calcite', post: 'dark_oak_log', beam: 'stripped_dark_oak_log', lift: 1.5, thickness: 1.5 })
// → { tiers: [{ W, E, floor, top, roof }], apex: [x, y, z], topY }
```

`y` is the first storey's bottom row (build the platform below it). Body half-widths shrink by one
every second storey (`taper: 0.5`: W = 5, 4, 4, 3, 3), roof half-widths by one per storey
(E = 9, 8, 7, 6, 5), so the eaves stay 2-4 deep and the tower tapers; each skirt stops at the next
body, the top is a pyramid whose apex ring rises 2 (`topPitch`), and a sorin (`finial` list, default
about 22 % of the height; `false` for none) stands on it. Bodies get corner and bay posts, a top
beam, lattice doors over a lit panel (`door`) on the ground storey, lattice panels above, a lantern
on every storey floor and a central pillar. `storey` may be a list; 5 rows or fewer hide the upper
bodies behind the skirts.

### `b.roofField(opts)` — any roof from a height function

The same shell, stair, soffit and watertightness rules as `eastRoof`, for surfaces that no
rectangle-based roof can make: hogback (sagging) ridges, bowed walls, bell-cast and ogee profiles,
round bell roofs, arched decks.

```js
const roof = b.roofField({
  x0, z0, x1, z1,          // box to sample (inclusive)
  y: 0,                    // level where height 0 sits
  height: (x, z) => h,     // surface in blocks above y (rounded to half blocks); null = no roof there
  material, ribs, ridge, rafter, thickness: 1, only,
  capRidge: 1,             // a column above all its neighbours stands at most 1 above the highest (no fins)
  ridgeAt: (x, z) => bool, // ridge-material cells (default: both opposite neighbours on one axis lower,
                           //   which follows a sagging ridge)
  section: (x, z) => label,// neighbours in other sections are ignored (thin rakes over a lower roof)
  edge: (x, z) => bool,    // which missing neighbours are eave edges (default all: whole-level eave cells become stairs)
  rim: { test(x, z), level }, keepBelow: { test(x, z), level }, // close onto walls / spare walls below a level
})
// → { topY, base, heights, cells, field, surface(x, z), bottom(x, z) }
```

```js
// Viking longhouse: bowed long walls (half-width 5 at the gables, 6.6 mid-length) and a hogback
// ridge 2.5 lower in the middle; bell-cast profile (shallow eave, steep ridge). From the plan:
// X0..X1 gable walls, CX/CZ centre, HL = half length, inFoot(x, z), isLongWall(x, z) (wall cells
// except the gable ends), wallTop, EAVE = wallTop + 2.
const u = x => (x - CX) / HL
const wReal = x => 5 + 1.6 * (1 - Math.min(1, u(x) ** 2))
const Wd = x => Math.round(wReal(Math.max(X0, Math.min(X1, x))))
const rise = x => 10 + 2.5 * Math.min(1, u(x) ** 2)
const prof = r => 0.65 * r + 0.35 * r * r
const roof = b.roofField({ x0: X0 - 1, z0: CZ - 9, x1: X1 + 1, z1: CZ + 9,
  height: (x, z) => (Math.abs(z - CZ) <= Wd(x) + 1
    ? EAVE + rise(x) * prof(Math.max(0, Math.min(1, 1 - Math.abs(z - CZ) / (wReal(x) + 1.25)))) : null),
  material: 'dark_oak', ridge: 'spruce', rafter: 'spruce',
  rim: { test: (x, z) => isLongWall(x, z), level: wallTop + 1 }, keepBelow: { test: inFoot, level: wallTop + 1 } })
for (const x of [X0, X1]) for (let z = CZ - 9; z <= CZ + 9; z += 1) {   // gable boards up to the roof
  const bot = roof.bottom(x, z)
  if (inFoot(x, z) && bot !== null) for (let yy = wallTop + 1; yy < bot; yy += 1) b.set(x, yy, z, 'stripped_spruce_log[axis=y]')
}
// Bell roof on a round tower: height from the distance to the centre
b.roofField({ x0: tx - 6, z0: tz - 6, x1: tx + 6, z1: tz + 6, y: towerTop + 1, material: 'oxidized_cut_copper', rafter: 'spruce',
  height: (x, z) => { const d = Math.hypot(x - tx, z - tz); return d > 6 ? null : 0.5 + 7 * (1 - d / 6) ** 1.8 } })
```

`b.rasterRoof(field, { base, material, ribs, ridge, rafter, thickness, only, rim, keepBelow, overwrite })`
is the low-level rasteriser underneath. Field format: a `Map` `"x,z"` → `{ x, z, t, sec?, hip?, ridge?, along? }`,
`t` = surface height in blocks above `base` (multiples of 0.5: x.5 → bottom slab, whole → stair or
block), `sec` labels sections that ignore each other, `hip`/`ridge` cells use the ridge material and
`along` (integer) alternates `ribs`; optional `field.outside(x, z)` marks eave edges. A hand-made Map
works for arched bridge decks. `eastField(opts)` (exported, not a Builder method) builds the
East-Asian field on its own.

**Caveats.** Hip lines are a 4-connected two-cell staircase, so they read bold. On small roofs
(under about 12 across) a high-contrast ridge material clusters at the corners; use the roof
material or a near value there. Even spans give a 2-wide ridge, doubled ridge-end horns and a 2×2
pyramid top (the finial goes on the north-west centre column), so use odd spans for pagodas and
pyramids. `above` cuts a canopy where it dips under the main roof, so a canopy meant to slide
*under* a main eave loses that part. The irimoya keeps the hip shell hidden under its gable,
which shows as a second layer in cutaways.

### Other components

| Method | Notes |
| --- | --- |
| `b.dormer([cx, y0, cz], facing, { width: 3, height: 3, depth?, material, wall, window: { width, height } })` | gable dormer on a sloped roof (build after the main roof); front wall bottom-centre on the slope, `y0` = roof level there; depth auto-extends until the main roof covers its ridge; warns if it is too tall. Put the front **on the wall line** (or 1 row in): width 3 on roofs up to 11 deep, width 5 only on roofs ≥ 13 deep (otherwise its ridge rises above the main roof and it warns). A dormer set further back reads as a hole; give it a contrasting front wall (plaster, framed gable) or a darker roof so it does not vanish into the slope. `wall` may be a paint function (timbered gable). For a full-height wall dormer / cross-gable use `b.compoundRoof` with a second rect |
| `b.coneRoof([cx, y, cz], radius, { material, pitch = 2, overhang = 1, flare = true, finial })` | round tower roofs; `flare` starts with shallow rows for a bell-shaped eave |
| `b.bellRoof([cx, y, cz], R, H, { material, p: 1.7, lip: 0.7, wallR, finial })` | bell-cast roof of revolution: concave skirt rising to a spire, stairs on every steep course, a flared slab lip and an eave soffit; no 1x1 needle. Best for round pavilions and towers of radius 4–10 (`coneRoof` suits straight cones) |
| `b.window(pos, facing, { width, height, glass, frame, sill, lintel, shutters, flowerBox, recess, arch, mullion, material })` | `pos` = bottom-left opening cell seen from outside; `shutters: true` uses the material's trapdoor; `arch: true` gives 2-wide windows a pointed head |
| `b.door(pos, facing, { material, width: 1\|2, hinge, frame, awning, steps })` | places both halves (and both doors) |
| `b.arch(a, c, paint, { type: 'round'\|'pointed'\|'segmental'\|'flat', thickness, depth, fill, spandrel, top, rise })` | `a`/`c` = springer cells (same y, axis-aligned); opening is cleared with `fill` (`fill: null` draws only the arch ring, e.g. a relieving arch on a wall) |
| `b.column(base, height, { shaft, plinth, capital, flare })` | `flare: 'quartz'` adds stair base/capital |
| `b.battlements([x0, z0], [x1, z1], y, paint, { period, height, cap })` | crenellated rectangle; for walls along any polygon (round towers, corbelled parapets, walkways, gatehouses) use `kit.plan.curtainWall` |
| `b.spiralStairs(c, rInner, rOuter, y0, y1, material, { stepsPerTurn, core, clockwise })` | tower stairs |
| `b.timberWall(a, c, { frame, infill, postEvery \| posts: [u...], beams, braces: true\|'all', inset: 1, facing, joints: 'beams'\|'posts' })` | posts, beams, end-bay braces on a 1-thick plane. `inset: 1` + `facing` (outward side) puts the infill one block inside so the frame stands proud (Law 6). `posts` sets explicit post positions; `joints` says whether beams or posts run through. Braces read only in panels ≥ 5 wide × 4 tall |
| `b.stairway(from, facing, rise, material, { width, fill, base, sides, landing })` | straight flight of stairs climbing toward `facing`, filled underneath, optional side walls; `from` is the bottom step and `width` extends to the climber's left (`ccw(facing)`) |
| `b.bridge(a, c, { width, deck, edge, arch, railing, posts, postEvery, lanterns, beam })` | deck between two points in any direction, sine arch of `arch` blocks, railings with posts and lanterns |
| `b.lampPost(base, { height, post, foot, lantern, arm })` | `arm: 'east'` hangs the lantern |
| `b.hangingLantern(anchor, length)` | chain + lantern below an anchor block |
| `b.chimney(base, height, { paint, cap, smoke, size })` | campfire smoke inside |

## Builder: nature

| Method | Notes |
| --- | --- |
| `b.tree(base, species, opts)` | species: `oak, big_oak, birch, spruce, pine, dark_oak, cherry, willow, jungle, acacia, azalea, mangrove, dead, fantasy`. `base` = first log (ground + 1). Leaves are persistent; branches use bark-all-round wood. Knobs (preset defaults in `scripts/lib/kit/nature.mjs`): `height` ([min, max] or n), `trunk` (base radius), `lean` (fraction of height), `crown` (where branches start, 0–1), `branches` ([min, max]), `spread`, `rise`, `blob` (leaf blob radius [min, max]), `squash` (blob height ratio: < 0.7 flattens canopies into plates), `roots` (number of root flares; use 0–2 on trees under 9 tall), `leaves` (list, mixed), `log`, `wood`, `droop`, `vines`, `ground` (cover under the crown, only on soil), `seed`. Changing any knob reshuffles the random stream, so tune one at a time |
| `b.leafBlob(c, [rx, ry, rz], leaves, { holes, roughness })` | custom canopies, hedges |
| `b.forest({ x0, z0, x1, z1, ground, species, density, minSpacing, clearings, avoid, seed, sizes })` | whole woodland: Poisson placement thinned by clumping noise, species clumped (`[[6, 'oak'], [3, 'birch'], [1, 'colonized_dark_oak']]`; any `b.tree` preset, `'colonized[_oak\|birch\|dark_oak]'`, `'forester_round'`, `'forester_cone'` or a function), three size classes, bush-feathered edges, clearings `[[cx, cz, r]]`, `avoid(x, z)` for paths, stumps and fallen logs, podzol under big crowns. Keeps big trees ≥ 15 blocks from the canvas edge. Returns the placed trees |
| `b.spaceColonizationTree(base, { height, crown, species \| log, wood, leaves })` | the most natural broadleaf crowns (branches grow toward points in a crown volume; pipe-model thickness) |
| `b.foresterTree(base, { height, shape: 'round'\|'cone' })` | MCEdit Forester port; `cone` makes the best spruces |
| `b.bush(base, { radius, leaves, log })` | |
| `b.boulder(c, radii, paint, { roughness, mossTop })` | noise-displaced rock |
| `b.terrain({ x0, z0, x1, z1, base, height: (x, z) => y, layers, surface })` | returns `(x, z) => surfaceY` |
| `b.scatter({ x0, z0, x1, z1, on, density, paints, clump })` | grass/flowers on the walking surface (also under overhangs and canopies); tall plants get both halves |
| `b.groundY(x, z, on?)` | walking surface of a column: highest terrain (or `on`) block with only air/plants above; -1 if none. Use it instead of `b.topY` to place props under canopies, brims and jetties |
| `b.path(points2d, { width, paint, jitter, on })` | winding path on the walking surface: the highest terrain block with only air/plants above (continues under jetties and canopies, never repaints props or floors). `dirt_path` is 1/16 lower than full blocks: use it alone (lanes, ruts) or mix only full blocks (`coarse_dirt`, `gravel`, `packed_mud`, `rooted_dirt`), otherwise close-ups show a maze of tiny steps |
| `b.pond([cx, level, cz], r, { depth, rim, bed })` | |
| `b.overgrow(a, c, { amount, maxLength, moss, only })` | vines on exposed walls + moss carpet; `only` limits it to some blocks (stone, not sails or planks). Run it after the last dig, or vines may hang in air |
| `b.island([cx, topY, cz], r, { depth, top, soil, rock })` | floating island |
| `b.weather(a, c, { share, mossBias, scale, variants })` | swaps blocks for cracked/mossy/oxidized variants in organic patches; `share` is the exact fraction aged (0.1–0.3 typical), moss and cracks form their own clumps (`mossBias` = moss share). `variants: { 'minecraft:deepslate_tiles': ['minecraft:cracked_deepslate_tiles', 'minecraft:cobbled_deepslate'] }` turns it into a general patchy material swap (mottled roofs, worn floors). The older `amount` is a raw threshold on blocky noise (0.22 ≈ 10%, 0.38 ≈ 30%) |

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

All options (defaults): `only`, `mid` (0.4, where the ramp centres), `base` (0.3, darkening toward
the bottom), `top` (0; negative darkens toward the top, e.g. soot on a chimney), `edge` (0.18,
exposed corners/jambs), `drip` (0.09) and `dripLength` (4) under overhangs, `focus` (points that
get brighter), `focusRadius` (6), `focusAmount` (0.25), `scale` (6, clump size), `noise` (0.22),
`jitter` (0.06), `maxStep` (2, max ramp steps between neighbours), `seed`. A ramp step without the
needed shape (no wall/stair/slab) borrows the nearest step's, so placeholders never survive.

Use ramps of one texture family (bricks → bricks) for walls; mixing very different textures
(cobble next to bricks) reads as patchwork.

### Importing schematics

`b.importStructure(fileOrBytes, at, { rotate, mirror, keep, only, keepAir, region, paletteIndex })`
stamps a `.nbt`, `.schem`, `.litematic` or legacy `.schematic` into the build (block entities keep
their NBT) and returns `{ size, format, blocks }`. Use it to study a downloaded build in the
renderer, to remix one, or to reuse a module exported from another recipe.

## Settlement planning: `kit.plan`

For villages, towns and castles (`scripts/lib/kit/plan.mjs`; method and numbers in
`references/building/composition.md`; full example `assets/examples/walled-village.mjs`).
The functions that take the builder are also Builder methods (`b.paintRoad(path, opts)` = `kit.plan.paintRoad(b, path, opts)`).

| Function | Does |
| --- | --- |
| `kit.plan.heightmapOf(b)` | snapshot `(x, z) → y` of the current ground (ignores trees/plants); `.isWater(x, z)`, `.size` |
| `kit.plan.routeRoad(ground, [x, z], [x, z], { avoid, roads })` | terrain-aware A* road: smoothed, graded `[[x, y, z], ...]`; existing `roads` are cheaper so roads merge |
| `kit.plan.paintRoad(b, path, { width, paint, edge, slabSteps, bridge })` | cut/fill the road into terrain, slabs on half steps, plank bridge over water |
| `kit.plan.lotsAlongRoad(path, { roadWidth, heightFn, density, inside, occupied, roads, frontage, depth, setback, gap })` | lots facing the road `{ x0, z0, x1, z1, facing, door, front, y }`; stays 2 blocks inside the canvas |
| `kit.plan.plaza(b, center, size, { feature: 'well'\|'fountain'\|'cross'\|'tree' })` | levelled irregular square with blended edges and lamps |
| `kit.plan.curtainWall(b, polygon, { gate, towers, ... })` | ground-following wall with crenellations, walkway, arrow slits, towers and gatehouses |
| `kit.plan.skylineReport(b)` | crown ratio, accents, height variety, flat runs, ASCII skylines (`.text`) |
| `kit.plan.ringPolygon`, `pointInPolygon`, `chaikin`, `resamplePolyline`, `gradeProfile` | geometry helpers |

## Spawn & lobby kit

Server spawns, hubs and PvP lobbies (`scripts/lib/kit/spawn.mjs`; full example
`assets/examples/spawn-kit-demo.mjs`). Each component is built with depth (plinths,
stair skirts, reveals, cornices) and lights itself with a fixture or a light set behind tinted glass,
never a bare light block in view. Components that a plugin has to finish **record a placement**
(NPC spots, hologram anchors, crate blocks, portal triggers, regions, the world spawn); `finish()`
puts them in `metadata.placements` and `run-build.mjs` writes `<name>.placements.json` and
`<name>.setup.md` (below).

Conventions: `facing` is the side the **player** stands on (where an NPC looks, a sign reads, a crate
opens). Materials come from the same options everywhere: `primary` (light field, default
`smooth_quartz`), `trim` (frames and cornices, needs stairs; `polished_deepslate`), `base` (plinths and
skirts; `deepslate_tiles`), `wood` (posts, stalls; `dark_oak`), `roof` (`deepslate_tile`), `accent`
(keystones and finials; `blue_concrete`; never gold by default), `field` (any paint for big surfaces), `colour` (dye for the
glow glass; from the accent), `glass` and `light` (the glow; `ochre_froglight`).

**Marks: recording places you build yourself.** A hand-built spawn designs its own NPC places,
boards, crates and gates (`references/spawns/build-guide.md` §5), then records each one with a mark.
A mark places no block. It records the placement for `placements.json` and `setup.md`, and it watches
the cells the place needs: `finish()` warns, naming the cell, when anything fills one.

| Mark | Records | Watches |
| --- | --- | --- |
| `b.markNpc(pos, facing, { id, label, role })` | `npc`, `style: 'own'`: `pos` = the block it stands on (feet at y + 1), its hologram 2.4 above the feet | 3 above the feet, 2 in front |
| `b.markCrate(pos, facing, { id, label, tier, block })` | `crate`: `pos` = the crate block you placed (`block` read from it when not given), its hologram 1.6 above | 2 above, 2 in front |
| `b.markBoard([x, y, z], facing, { id, label, size: [5, 4] })` | `leaderboard`: the top line's anchor (fractions allowed; 0.5 in front of your backdrop) | the board's volume: `size[0]` across, `size[1]` down |
| `b.markPortal(min, max, { id, label, kind, facing })` | `portal`: the opening players walk through, as the trigger region | the opening |
| `b.markHologram(id, text, [x, y, z])` | `hologram`: free-standing text, top line at `y` (the spawn frame's `ctx.hologram`) | nothing |

Without an `id`, a mark numbers its kind (`npc-1`, `crate-2`...). The spawn frame
(`assets/frame/frame.mjs`: `startSpawn`, `finishSpawn`, the reservation grid, `polar`,
`facingToward`, `yawToward`, `local(pos, facing)` for building in front/right/up terms) is
documented in build-guide.md §3-§4.

The methods below are finished designs: the reference spawns use them. A hand-built spawn designs
its own places and records them with the marks above.

| Method | Notes |
| --- | --- |
| `b.sign(text, at, facing, opts)` | block letters; `at` = top-left letter cell as the reader sees it (top-centre with `align: 'center'`, top-right with `'right'`); `font: 'small'` (3x5) \| `'medium'` (5 tall, default) \| `'large'` (5x7); `block` / `stairs` (quartz_block / quartz; any block with its own stairs smooths, others stay square); `depth`; `'\n'` for lines (`leading`). `board` adds a framed panel: the field `boardDepth` (2) deep sits 1 behind the letters inside a `frame` ring (polished_deepslate; `false` for a bare board with an optional flat `boardEdge`) with a stair cornice and sill, returned ends and a slab `cap`; `pad` (1) cells of field around the text. Returns `{ width, height, min, max }` |
| `kit.signWidth(text, font)` / `kit.signHeight(text, font)` | size of the lettering (widest line), to centre or fit it before drawing |
| `b.npcSpot(pos, facing, { id, label, role, style })` | `pos` = the block the NPC stands on (feet at y + 1). `style`: `'pedestal'` (5x5, `size: 3`, or `shape: 'round'`), `'alcove'`, `'booth'`, `'kiosk'`, `'none'`. Keeps 2 + 1 blocks of head room and a 2-deep click stand-off clear (finish warns if a later edit fills them) |
| `b.leaderboards(pos, facing, { count: 3, width: 5, height: 6, gap: 3, style, ids, labels, podium })` | framed hologram boards in a wall (`style: 'wall'`) or as steles (`'row'`); `pos` = floor block in the middle of the wall face (the wall lies 1-4 blocks behind it). The middle board of 3+ is the hero (2 wider, 1 taller, raised bay with a crest); `podium: true` adds 2nd/1st/3rd steps in front of it whose statues are recorded as NPC spots (`role: 'statue'`, `rank`). `backdrop` (polished_blackstone), `footlight`, `strip`, `podiumCaps` |
| `b.crate(pos, facing, { id, label, tier, block, hero })` | `pos` = the crate block, on a 1-tall dais (floor at y - 2; a footing fills down). `block`: `'ender_chest'` \| `'chest'` \| `'barrel'` \| `'shulker'` \| any id; `tier`: common, uncommon, rare, epic, legendary, mythic, vote, seasonal (`kit.CRATE_TIERS`) or a dye colour; a clear 3x3 standing area in front |
| `b.crateRow(start, facing, crates[], { spacing: 5, ...shared })` | stations along the players' right from `start`; the highest tier (or the middle) of 3+ becomes the hero (taller arch, crest) |
| `b.spawnPoint(pos, facing)` | the world spawn (`pos` = floor block, players at y + 1); exactly one, a second call moves it and warns |
| `b.portal(a, c, { id, label, kind, facing })` | gate around a 1-thick opening `a`..`c` (inclusive); `kind`: `'rtp'` \| `'warp'` \| `'pvp'` (pointed arch) \| `'nether'` (obsidian, `nether_portal` fill); the opening stays air otherwise and is recorded as the trigger region. Footprint: width + 8 by 7 deep |
| `b.region(id, min, max, flags)` | a WorldGuard-style region record; `flags` e.g. `{ pvp: 'deny', 'mob-spawning': 'deny', priority: 10 }` |
| `b.spawnProof(min, max, { inside, maxStep: 10, maxRounds: 8, level: 15 })` | propagates block light and puts invisible `light[level=15]` in dark walkable cells (feet height, or head height over a plant; never replacing a block or a door / tall plant top), lights placed in one round ≥ `maxStep` apart, repeated while dark cells remain (2-3 rounds usually). `inside(x, z, y)` limits it. Returns the number placed |
| `b.darkSpots(min, max, { inside })` | mob-spawnable cells (feet positions) for checks: 2 tall no-collision space on a spawnable floor (full blocks, top slabs, upside-down stairs; not glass, leaves, ice, bottom slabs, carpets, paths) at block light 0 |

The styles, from the street inward:

- **pedestal**: stair skirt, a light inlay ring around the NPC on a glass inset lit from below,
  corner blocks with lanterns (front) and potted plants (back), a ring inlaid in the floor and a
  backdrop screen behind (`screen: false` to omit) with a glowing panel lit from behind.
- **alcove**: built into an existing wall (it only fills empty cells around it); `pos` is 1 block in
  from the wall's face. Pilasters with stair bases and capitals, entablature, cornice and crest
  (proud), a trim reveal in the wall plane, a 3x4 niche with a stair-rounded head, a dark backdrop
  (`backdrop`) with an arched halo window lit from behind, a floor plate, bracket lanterns.
- **booth**: market stall 5 wide (`width`): log posts, stock on the back wall (barrels, chest,
  shelf, bookshelves), a lectern, an upside-down-stair counter with a candle and a pot, a striped
  awning (`awning: ['mangrove', 'birch']`, any two stair families) sloping to the front with a valance
  and eave lanterns, and a framed `board` over the awning, recorded as `board: { center, facing }`.
- **kiosk**: 7x7 deck with a stair skirt, log posts on bases with knee braces, rails with potted
  plants on three sides, a lectern, a hipped roof level with the beams (`roof`, `pitch`), eave lanterns,
  a finial and a lantern over the NPC.
- **leaderboard board**: stiles with bases and capitals, cornice, a sill over a lit pane strip on the
  plinth; a reveal 1 larger than the display with stair bevels; the display 1 deeper on a dark
  backdrop; a footlight trough behind the bottom bevel; piers with bracket lanterns between boards.
- **crate station**: stair skirt, glass corner tiles lit from below with tier candles, a slab
  collar, the crate; an arch (piers on stair bases, stair shoulders, tier keystone, frieze, cornice)
  onto a reveal panel 1 deeper in the tier's terracotta with a glowing glass slot.
- **portal**: plinth, 2-wide pilasters with stair bases and capitals, an outer arch ring with a
  glazed keystone, the inner reveal stepped 1 deeper with glass strips lit from inside, impost band,
  entablature and cornice, a threshold inset that glows.

```js
// north: three boards with a podium; west: five crates; a framed sign on the arcade wall
b.leaderboards([42, 4, 12], 'south', { ids: ['kills', 'money', 'playtime'], labels: ['Top Kills', 'Richest', 'Playtime'], podium: true })
b.crateRow([13, 6, 54], 'east', [
  { id: 'common', tier: 'common' }, { id: 'rare', tier: 'rare' }, { id: 'legendary', tier: 'legendary', block: 'ender_chest' },
  { id: 'epic', tier: 'epic', block: 'barrel' }, { id: 'vote', tier: 'vote', block: 'shulker' },
])
b.sign('CRATES', [10, 21, 44], 'east', { font: 'small', align: 'center', board: 'polished_blackstone' })
b.npcSpot([67, 4, 44], 'west', { id: 'shop', label: 'Shop', role: 'shop', style: 'alcove' })   // in the hall's west wall
b.npcSpot([38, 4, 66], 'north', { id: 'market', label: 'Market', style: 'booth', awning: ['warped', 'birch'] })
b.portal([10, 5, 17], [14, 9, 17], { id: 'rtp', label: 'Random Teleport', kind: 'rtp', facing: 'south' })
b.spawnPoint([42, 4, 44], 'north')
b.region('spawn', [0, 0, 0], [83, 37, 83], { pvp: 'deny', 'mob-spawning': 'deny', priority: 10 })
return b.finish({ name: 'spawn', spawnProof: { min: [0, 5, 0], max: [83, 37, 83], inside: (x, z) => inPlaza(x, z) } })
```

Placement records (structure coordinates; shifted with the structure when `trim: true`):

| type | record |
| --- | --- |
| `npc` | `{ id, label, role, style, pos: [x, y + 1, z] (the feet block), facing, yaw, hologram: [x + .5, y + 3.4, z + .5], board?, rank? }` (`style: 'own'` from `markNpc`) |
| `hologram` | `{ id, label, pos: [x + .5, y, z + .5] }` |
| `leaderboard` | `{ id, label, anchor: [x, y, z], facing, size }`: the hologram's top line, centred on the board, 0.5 in front of the backdrop; the recess fits 10-12 lines at 0.25-0.3 |
| `crate` | `{ id, label, tier, block, pos: [crate block], facing, hologram: [x + .5, y + 1.6, z + .5] }` |
| `portal` | `{ id, label, kind, min, max, facing }` (the trigger region) |
| `region` | `{ id, min, max, flags }` |
| `spawn` | `{ id: 'spawn', pos: [x, y + 1, z], facing, yaw }` |

Yaw follows Minecraft (`kit.YAW`): south 0, west 90, north 180, east -90.

**Export.** `node scripts/run-build.mjs recipe.mjs --origin x,y,z [--world name]` (`--origin` = where
the structure's minimum corner is pasted, default 0,0,0; `--world` default `world`) writes, next to the
`.nbt`:

- `<name>.placements.json`: `{ name, size, origin, world, placements }`, each record with its local
  coordinates and a `world` copy (origin + local);
- `<name>.setup.md`: a placements table (id, label, type, local and world coordinates) and
  ready-to-paste commands: `setworldspawn x y z yaw`; Citizens `npc create <label> --at x:y:z:world:yaw:0`;
  FancyNpcs `npc create <id> --location x y z --world <w>` + `npc rotate` + `npc displayname`;
  DecentHolograms `dh hologram create <name> -l:world:x:y:z <text>` (NPC name plates, leaderboard top
  lines, crate titles); ExcellentCrates `Block.Positions` entries (`x,y,z,world`, no bind command
  exists; or the editor's link tool); CrazyCrates `/tp` + `/crazycrates set <crate>` (player-only,
  looking at the block); WorldEdit/WorldGuard `//pos1 x,y,z`, `//pos2`, `/rg define`, `/rg flag`,
  `/rg setpriority`, plus the console form (`/world <w>` first, one slash fewer). Syntax was checked
  against the plugin sources in October 2026: Citizens 2.0.44, FancyNpcs 2.12.1, DecentHolograms
  2.10.3, ExcellentCrates 6.6.1, CrazyCrates 5.2.0, WorldEdit 7.4.7, WorldGuard 7.0.21.

The JSON summary gains `placements: { count, types, origin, world, jsonPath, setupPath }` and
`builder.spawnProof: { placed, remaining }`.

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

Before that, `spawnProof: [min, max]` (or `{ min, max, inside, maxStep }`, or `true` for the whole
canvas) runs `b.spawnProof`, and NPC stand-offs, crate standing areas and the spawn that a later edit
filled are reported as warnings. After it, the spawn kit's placements are added as
`metadata.placements` (see "Spawn & lobby kit").

`run-build.mjs` applies steps 2–5 to raw-API recipes too.

`run-build.mjs` reports `builder.problems` and `builder.clipped` in its JSON summary.
