# Quality and critique

You see your build only through PNG renders and the text inspector. This chapter covers:

- the staged workflow that keeps mistakes cheap;
- the texturing doctrine;
- how much detail to put where;
- a 12-point review rubric tuned to this renderer;
- the catalogue of amateur tells, each with its fix in kit terms.

The bar is what professional build teams and juried competitions reward, summarised in seven points:

- **Massing first.** Get the shape right before anything else.
- **Shade-ordered texture.** Gradients, never noise.
- **Depth with a structural reason.**
- **Grounded on the terrain.**
- **Believable.** Scale, physics, interiors, paths.
- **One or two signature elements** in a cohesive fabric.
- **Restraint.**

Everything below assumes the kit (`references/kit-api.md`):

```js
const { kit } = api
const b = api.builder([48, 40, 40], { seed: 11 })
```

Snippets reuse four names:

- `H = { x0, z0, x1, z1 }`: the outer wall lines of a house.
- `F`: the ground-floor level, the first air row above the floor.
- `ground(x, z)`: the heightmap returned by `b.terrain`.
- `doorX`: the door column.

---

## 0. Seeing tools: quick reference

### Build

```bash
node scripts/run-build.mjs recipe.mjs --out-dir minecraft-builds/x --json
```

- Required: `builder.problems` is `[]` and `builder.clipped` is `0`.
- Clipped placements fell outside the canvas. They are usually tree crowns or paths at the edge.

### Render

```bash
node scripts/render.mjs --nbt minecraft-builds/x/x.nbt                      # se,nw,south,top + sheet.png
node scripts/render.mjs --nbt X --views hero,low,east --zoom 1.6            # framed presentation views
node scripts/render.mjs --nbt X --yaw 20 --pitch 12 --target 19,13,21 --distance 30 --view-name door
node scripts/render.mjs --nbt X --views se --clip-y 9 --zoom 2              # cutaway: hide blocks above y=9
node scripts/render.mjs --nbt X --views se --clip 10,0,10,30,30,30          # isolate one building in a scene
node scripts/render.mjs --nbt X --views hero,south --lighting both          # day + night pair
```

Output and flags:

- Each view becomes `<out>/<view>.png`, plus `sheet.png`. Night renders get a `-night` suffix; `--lighting both` writes `-day` and `-night` files.
- Default output directory: `<nbt dir>/renders`. Change it with `--out`.
- Default size is 960×720. Use `--width 1600 --height 1200` when you need to read small detail.
- When you pass custom camera flags without `--views`, only the custom view is rendered.

| Preset | yaw / pitch / fov | Use |
| --- | --- | --- |
| `se` `sw` `ne` `nw` | 45/315/135/225 · 30° · 40° | Isometric overviews: massing, roofs, layout |
| `south` `north` `east` `west` | 0/180/90/270 · 4° · 20° | Near-flat elevations: proportions, window rhythm, terrain contact, facade depth |
| `top` | 0 · 89.5° · 30° | Plan: paths, spacing, footprint variety |
| `hero` | 30 · 12° · 50° | Presentation shot, eye-level drama |
| `low` | 210 · 6° · 55° | Street level from the north-northwest: what a visitor sees |

Yaw is the direction the camera sits at: 0 is from the south, 90 from the east, 180 from the north, 270 from the west.

### Inspect

The inspector is text output that checks what the renders cannot show.

```bash
node scripts/inspect.mjs X --checks          # quality lint (floating blocks, flat walls, support, lighting, palette...)
node scripts/inspect.mjs X --profile         # per-y block counts and top blocks (verifies vertical gradients)
node scripts/inspect.mjs X --slice y=7       # ASCII plan of one layer; also x=<n> / z=<n> sections
node scripts/inspect.mjs X --find wool       # leftover placeholders, lights, any substring of a state
```

### Pixels per block

Use this to decide what is even visible. The fov is vertical; the default image height is 720 px.

| View | px per block (default size) |
| --- | --- |
| Preset that fits the whole build | ≈ 0.7 × image width ÷ scene width. A 32-wide build gets ~20 px; 64-wide ~10 px; 128-wide ~5 px |
| Custom view (fov 45) at `--distance d` | ≈ 870 ÷ d. At d=20: 43 px; d=30: 29 px; d=60: 14 px |
| Elevation preset (fov 20) | about twice the iso value at the same distance |

What is readable at each density:

- **Below about 8 px per block:** only silhouette and colour masses read.
- **Sub-block items** need **25 px per block or more**. That covers buttons, chains, candles and trapdoor edges.

---

## 1. The staged workflow

Professional teams all run the same order. WesterosCraft lays out a wool outline, then foundation, walls, roof, weathering, gradient and interiors. Noxcrew builds a scale model and walks it for sightlines. Greenfield lays roads, then districts, then plots.

**Detail cannot rescue bad massing, and a gradient cannot rescue a bad structure.** Render after every stage and fix that stage's failures before moving on.

### 1.1 Stage table

| # | Stage | Code | Render / inspect | Pass when |
| --- | --- | --- | --- | --- |
| 0 | **Brief** (a comment block in the recipe) | Function, culture/style, era, wealth, biome/climate, *one* signature element, one story hook (§7) | none | You can say in one sentence what makes this build different |
| 1 | **Site** | `b.terrain(...)`. Pick footprint(s) on a terrain feature: high ground for the landmark, a river crossing for the bridge, a terrace for the market | `--views se,top` | Terrain has 1–3 readable features; no 1-block spikes or pits |
| 2 | **Massing** in placeholder | `b.box` / `b.prism` volumes + `b.roof` shapes only, in `white_wool` | `--views se,nw,south,top` | One dominant mass; skyline has 2–3 height tiers; roof volumes ≤ 2 storeys; footprint not a plain box (unless tiny) |
| 3 | **Structure** | Foundation to ground, walls (placeholders per surface role), floors at 4–5 block storeys, frame, roofs with overhang, door and window **openings** | `--views se,south,east` + `--clip-y` per floor | Doors at ground level; no floating corners; ridges centred; openings in a rhythm |
| 4 | **Texture** | `b.texture` per surface role (ramps §2), roof gradient, `b.weather` | close-up `--distance 25..40`, `--views south` | No speckle, no stripes, darker base and corners, brighter entrance |
| 5 | **Detail** | Window/door kits, sills, shutters, string courses, chimneys, dormers, eave trim | `--views south,east` + close-up on the hero bay | Shadows on every facade; detail concentrated at entrance, hero windows and roofline |
| 6 | **Landscape** | Ground cover, `b.path`, `b.scatter`, trees (`b.tree`, `b.bush`), rocks (`b.boulder`), water | `--views se,top,hero` | Building sits *in* the land; paths connect doors; vegetation clusters |
| 7 | **Life and story** | Interiors per profession, yard props, signage-by-shape, history layers | `--clip-y` per floor, door close-up | Every room has a purpose; you can name the inhabitants' trade |
| 8 | **Lighting** | Lanterns, lamp posts, window candles | `--lighting night` + `inspect --checks` (lighting) | Paths and the hero building read as a constellation at night |
| 9 | **Review** | Score the rubric (§4); fix the lowest item first; repeat | all of the above + `inspect --checks` | Every item ≥ 1, total ≥ 20/24 (house rule) |

### 1.2 Make stages switchable

Write one recipe and gate later stages behind an environment variable. Then render each stage without editing code:

```js
const STAGES = ['massing', 'structure', 'texture', 'detail', 'final']
const stage = STAGES.indexOf(process.env.STAGE ?? 'final')
const at = s => stage >= STAGES.indexOf(s)
// ... if (!at('structure')) { /* massing volumes */ return b.finish({ name }) }
```

```bash
STAGE=massing node scripts/run-build.mjs house.mjs --out-dir out/massing --json
node scripts/render.mjs --nbt out/massing/house.nbt --views se,nw,south,top
```

### 1.3 Order of operations inside a recipe

Later writes win, and some helpers read the existing top block. Use this order:

1. Terrain.
2. Foundations and structure, with each surface role in its own **placeholder colour** (§2.3).
3. `b.texture` per role, then `b.weather`.
4. Floors and interiors. Lay floors *after* texturing, so a floor that shares a placeholder is not regraded.
5. Landscape in this order: `b.path`, then trees and rocks, then `b.scatter`. A rock or tree placed after scatter cuts tall grass in half (`inspect` reports `two-part-blocks`).
6. **Props and lights last.** `b.path` and `b.scatter` repaint the topmost block of each column. In testing, a path ran under a door lantern and replaced it with `dirt_path`.
7. `b.finish()`, then check that `inspect --find wool` returns 0 matches.

### 1.4 Worked example: a staged cottage

This recipe was tested at every stage with `problems: []`. Its renders read as a finished cottage.

```js
export default function build(api) {
  const { kit } = api
  const STAGES = ['massing', 'structure', 'texture', 'detail', 'final']
  const stage = STAGES.indexOf(process.env.STAGE ?? 'final')
  const at = s => stage >= STAGES.indexOf(s)
  const b = api.builder([48, 40, 40], { seed: 11 })
  const ground = b.terrain({ height: (x, z) => 5 + Math.round(4 * kit.noise.fbm2(x, z, { scale: 24, seed: 3 }) + 0.12 * (x - 24)) })

  const H = { x0: 14, z0: 15, x1: 24, z1: 21 }         // 11 x 7: odd width puts the ridge over the centred door
  let gmin = Infinity, gmax = -Infinity
  for (let x = H.x0; x <= H.x1; x++) for (let z = H.z0; z <= H.z1; z++) {
    gmin = Math.min(gmin, ground(x, z)); gmax = Math.max(gmax, ground(x, z))
  }
  const F = gmax + 1, doorX = 19                        // floor above the highest ground: never bury the uphill side
  const STONE = 'white_wool', PLINTH = 'light_gray_wool', DAUB = 'yellow_wool'  // one placeholder per role

  if (!at('structure')) {                               // massing
    b.box([H.x0, F, H.z0], [H.x1, F + 8, H.z1], STONE)
    b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: F + 9, axis: 'x', material: 'deepslate_tile', gable: STONE })
    return b.finish({ name: 'staged-cottage' })
  }
  for (let x = H.x0; x <= H.x1; x++) for (let z = H.z0; z <= H.z1; z++)
    b.box([x, ground(x, z) - 1, z], [x, F - 1, z], PLINTH)         // foundation reaches into the ground per column
  b.walls([H.x0, F, H.z0], [H.x1, F + 3, H.z1], STONE)             // 4-tall stone ground floor
  b.box([H.x0 + 1, F + 4, H.z0 + 1], [H.x1 - 1, F + 4, H.z1 - 1], 'spruce_planks')
  const tw = { frame: 'stripped_spruce_log', infill: DAUB, postEvery: 5 }
  b.timberWall([H.x0, F + 4, H.z1], [H.x1, F + 8, H.z1], tw)
  b.timberWall([H.x0, F + 4, H.z0], [H.x1, F + 8, H.z0], tw)
  b.timberWall([H.x0, F + 4, H.z0], [H.x0, F + 8, H.z1], { ...tw, postEvery: 3 })
  b.timberWall([H.x1, F + 4, H.z0], [H.x1, F + 8, H.z1], { ...tw, postEvery: 3 })
  b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: F + 9, axis: 'x', material: 'deepslate_tile',
    overhang: 1, gableOverhang: 1, gable: DAUB, eaveTrim: true })
  b.door([doorX, F, H.z1], 'south', { material: 'spruce', frame: 'stripped_spruce_log', awning: true })
  for (const x of [16, 22]) b.window([x, F + 1, H.z1], 'south', { recess: 1, sill: at('detail'), shutters: at('detail') })
  // upper bays are 4 cells: a 2-wide window plus 2 shutters would fill the bay, so no shutters up here
  for (const x of [16, 21]) b.window([x, F + 5, H.z1], 'south', { width: 2, recess: 1, sill: false, flowerBox: at('detail') })

  if (at('texture')) {
    b.texture([H.x0, F, H.z0], [H.x1, F + 3, H.z1], ['andesite', 'cobblestone', 'stone_bricks', 'tuff', 'tuff_bricks'],
      { only: STONE, focus: [[doorX, F + 1, H.z1]], base: 0.3, edge: 0.2 })
    b.texture([H.x0, gmin - 1, H.z0], [H.x1, F - 1, H.z1], ['tuff_bricks', 'cobbled_deepslate', 'deepslate_bricks', 'deepslate_tiles'],
      { only: PLINTH, base: 0.35 })
    b.texture([H.x0 - 1, F + 4, H.z0 - 1], [H.x1 + 1, F + 14, H.z1 + 1], ['calcite', 'smooth_sandstone', 'sandstone'],
      { only: DAUB, base: 0.25, drip: 0.15 })
    b.texture([H.x0 - 2, F + 9, H.z0 - 2], [H.x1 + 2, F + 14, H.z1 + 2],
      ['cobbled_deepslate', 'polished_deepslate', 'deepslate_bricks', 'deepslate_tiles'],
      { only: '*deepslate*', base: 0.45, top: 0.2, edge: 0.1 })   // dark eaves, lighter ridge
    b.weather([H.x0, gmin - 1, H.z0], [H.x1, F + 3, H.z1], { amount: 0.18, mossBias: 0.6 })
    b.box([H.x0 + 1, F - 1, H.z0 + 1], [H.x1 - 1, F - 1, H.z1 - 1], 'spruce_planks')
  }
  if (at('detail')) b.chimney([H.x1 - 1, F + 5, H.z0 + 1], 10, { paint: kit.palette({ bricks: 5, mud_bricks: 2 }), cap: 'cobblestone_wall' })
  if (at('final')) {
    b.path([[doorX, H.z1 + 2], [doorX + 1, 27], [26, 32], [33, 35]], { width: 2, paint: kit.palette({ dirt_path: 6, coarse_dirt: 2, gravel: 1 }) })
    for (const [x, z, sp] of [[9, 10, 'oak'], [9, 26, 'oak'], [6, 18, 'birch'], [38, 11, 'spruce']]) b.tree([x, ground(x, z) + 1, z], sp, { seed: x * 7 + z })
    b.boulder([30, ground(30, 26) + 0.5, 26], [2.2, 1.6, 1.8], kit.palette({ stone: 4, andesite: 3, cobblestone: 2 }), { mossTop: 'moss_block' })
    b.lampPost([doorX + 3, ground(doorX + 3, 26) + 1, 26], { height: 3, foot: 'cobblestone_wall', arm: 'west' })
    b.scatter({ density: 0.22, paints: [[8, 'short_grass'], [2, 'tall_grass'], [1, 'poppy'], [1, 'oxeye_daisy']] })  // after rocks/trees
  }
  if (at('detail')) {                                   // props and lights last
    b.hangingLantern([doorX - 1, F + 2, H.z1 + 1], 0)   // under the door awning
    b.set(doorX - 2, F, H.z1 + 1, 'barrel[facing=up]')
    b.hangingLantern([doorX, F + 4, H.z1 - 3], 0)       // hangs from the upper floor
    for (const x of [16, 17, 21, 22]) b.set(x, F + 5, H.z1 - 2, 'candle[candles=1,lit=true]')
  }
  for (const [x, y, z] of [...b.entries()]) {           // delete isolated strays (e.g. a conifer tip leaf)
    let alone = true
    for (let dx = -1; dx <= 1 && alone; dx++) for (let dy = -1; dy <= 1 && alone; dy++) for (let dz = -1; dz <= 1 && alone; dz++)
      if ((dx || dy || dz) && b.has(x + dx, y + dy, z + dz)) alone = false
    if (alone && y > 0) b.remove(x, y, z)
  }
  return b.finish({ name: 'staged-cottage' })
}
```

Lessons from rendering this recipe:

- **Shutters ate the plaster.** The first version had 2-wide upper windows with shutters in 4-cell bays, and the whole upper facade rendered as wood. That is the "no calm zone" failure; §3.3 gives the rule.
- **Braces overwhelm small panels.** `braces: true` on 4-cell bays left almost no visible infill. Use braces only when a bay is 5 or more cells wide.
- **Undertone clash.** A pink-toned plaster step (`white_terracotta`, a* 8.8) next to yellow sandstone (a* −3) read as a patch of a different material, so it was dropped from the ramp.
- **Paths overwrite props.** The landscape step overwrote the door lantern until props were moved to the end.
- **The default framing was too wide.** The 48-wide terrain made the 11-wide house small. Use `--views hero --zoom 1.8` for presentation.

---

## 2. Texturing doctrine

### 2.1 Ramps: order by lightness, then undertone, then texture

A **ramp** is a list of blocks ordered light to dark. Build it from data, not intuition. Each block's perceptual lightness `L*` is in `scripts/lib/data/block-colors.json`, along with hue, texture noise and other fields; `references/building/block-colors.md` has ready-made ladders.

```js
import fs from 'node:fs'   // top of the recipe; run-build.mjs is run from the skill directory
const colors = JSON.parse(fs.readFileSync('scripts/lib/data/block-colors.json', 'utf8'))
const ramp = ids => [...ids].sort((a, b) => colors[`minecraft:${b}`].lab[0] - colors[`minecraft:${a}`].lab[0])
ramp(['tuff_bricks', 'andesite', 'stone_bricks', 'cobblestone', 'tuff'])
// → ['andesite', 'cobblestone', 'stone_bricks', 'tuff', 'tuff_bricks']
```

Rules:

- **Step count:** 3–7 steps. Use 3–4 for small panels and roofs under about 8×8; 5–7 for long walls, towers and cliffs.
- **Step size:**
  - ΔL* of 3–8 between neighbours blends.
  - ΔL* of 10 or more reads as a band. Use that only between *different* elements, such as wall vs plinth.
- **Undertone lock:** in `block-colors.json`, `lab[1]` is green–red and `lab[2]` is blue–yellow. Keep both within about ±6 across a coloured ramp; a step outside that reads as a different material (a patch), not as shading. Example: `white_terracotta` (a* 8.8) in a sandstone ramp (a* −3) shows up as pink blotches.
- **Near-greys are neutral.** Blocks with \|a*\| and \|b*\| < 4 (stone, andesite, cobblestone, tuff, deepslate, calcite, diorite) mix freely with each other. A white or black near-grey can also end a coloured ramp, reading as limewash or soot. Ignore the `hue` field for them: it is meaningless at low saturation.
- **Texture coherence:** mixing smooth and busy textures inside one ramp is fine (cobblestone next to stone bricks is a classic masonry look). Do not mix wood into a stone ramp.
- **One master palette per build.** Plinth, wall and roof ramps can be overlapping segments of the same family (the tuff and deepslate ramps below share `tuff_bricks`).

Tested ramps, with L*:

| Role | Ramp (light → dark) |
| --- | --- |
| Grey stone wall | `andesite` 56.8 → `cobblestone` 53.4 → `stone_bricks` 51.2 → `tuff` 45.8 → `tuff_bricks` 42.9 |
| Plinth / foundation | `tuff_bricks` 42.9 → `cobbled_deepslate` 33.0 → `deepslate_bricks` 30.1 → `deepslate_tiles` 23.0 |
| Slate roof | `cobbled_deepslate` → `polished_deepslate` → `deepslate_bricks` → `deepslate_tiles` (all have stairs and slabs) |
| Warm plaster / daub | `calcite` 89.2 → `smooth_sandstone` 85.5 → `sandstone` 81.8 |
| Light civic stone | `smooth_quartz` 91.8 → `calcite` 89.2 → `polished_diorite` 78.1 → `diorite` 76.4. One 11-point jump in the middle: use the clean preset (§2.2) so it stays in patches |
| Warm earth / adobe | `packed_mud` 48.0 → `mud_bricks` 46.6 → `brown_terracotta` 24.0. Large last step: use it for the base row only; `terracotta` (a* 20.9) is too red for this ramp |
| Desert | `smooth_sandstone` 85.5 → `cut_sandstone` 82.8 → `sandstone` 81.8. Plinth: `terracotta` 45.8 / `granite` 48.1 as a separate role. Don't add `white_terracotta` to the wall ramp (pink undertone) |
| Wood roof | `spruce` 38.4 → `dark_oak` 19.9. Only two steps, so add texture with `b.weather` or `kit.blend`, not more woods |

Measured ladders for every material are in `references/building/block-colors.md`; family membership (which blocks have stairs, slabs and walls) is in `references/building/materials.md`.

### 2.2 `b.texture`: the gradient engine

```js
b.texture(minCorner, maxCorner, rampLightToDark, { only, mid, base, top, edge, drip, focus, ... })
```

`b.texture` recolours every existing block in the box that matches `only`, using the ramp. Shapes are kept: a stair becomes a stair of the chosen ramp material. Ramp entries are material families or block ids.

**How the value `t` is built, with defaults in brackets:**

- Start at `mid` [0.4], the resting point in the ramp.
- Add `base·(1−v)^1.5` [0.3]: darker toward the bottom of the box. `v` is relative height inside the box.
- Subtract `top·v²` [0]: lighter toward the top. Use it for roofs, so ridges come out lighter.
- Add `edge` [0.18] at outside corners, wall ends and opening jambs (any block open on two axes). Add half of `edge` to blocks with nothing solid above them: wall tops and the cells under openings.
- Add `drip` [0.09] in vertical streaks up to `dripLength` [4] blocks long. About 12% of columns streak, starting just below an opening or the top of the surface.
- Subtract up to `focusAmount` [0.25] within `focusRadius` [6] of each `focus` point. Use this to brighten the entrance or hero window.
- Add clustered noise: `noise` [0.22] at clump size `scale` [6] blocks.
- Add per-block `jitter` [0.06].
- **Anti-splatter:** neighbouring blocks are pulled to within `maxStep` [2] ramp steps of each other.

**Practical rules:**

- Use **one call per surface role** (wall, plinth, plaster, roof), each limited with `only`.
- Make **the box the surface's own extent.** `base` darkens relative to the box bottom, so a box that includes the foundation shifts the whole wall lighter.
- Pass **`seed`** per building in a settlement so neighbours don't share a pattern.

Tested presets (16×10 walls, ramp from §2.1):

| Look | Options | Result |
| --- | --- | --- |
| Clean civic / new | `{ base: 0.15, noise: 0.12, edge: 0.1, drip: 0 }` | Reads as one material with faint corner shading |
| Default lived-in | `{ focus: [[doorX, F + 1, H.z1]] }` | Darker jambs and corners, scattered patches, bright entrance |
| Aged / ruin | `{ base: 0.45, noise: 0.35, edge: 0.25, drip: 0.2 }` then `b.weather(..., { amount: 0.2 })` | Strong patches, dark base, moss and cracks |
| Roof | `{ only: '*deepslate*', base: 0.45, top: 0.2, edge: 0.1 }` | Dark eaves, lighter ridge |

### 2.3 Placeholder per surface role

Build walls in throwaway wool colours, one colour per role. Then texture each role with `only`, without hand-masking:

```js
const STONE = 'white_wool', PLINTH = 'light_gray_wool', DAUB = 'yellow_wool', TRIM = 'brown_wool'
b.walls([H.x0, F, H.z0], [H.x1, F + 3, H.z1], STONE)
// ... structure ...
b.texture([H.x0, F, H.z0], [H.x1, F + 3, H.z1], stoneRamp, { only: STONE })
b.texture([H.x0, F - 6, H.z0], [H.x1, F - 1, H.z1], plinthRamp, { only: PLINTH })
```

- The massing render then shows roles as flat colours, which makes proportions easy to judge.
- Before finishing, `inspect --find wool` must return **0 matches**. A leftover placeholder is the most visible amateur tell.

### 2.4 Weathering follows logic, not dice

Where wear goes, in order of strength:

1. **Base.** The bottom 1–3 rows get splash, damp and moss. `b.texture` `base` handles this; add moss there with `b.weather`.
2. **Corners and jambs:** the `edge` term.
3. **Under sills, ledges and eaves:** drip streaks 1 wide and 2–4 long (the `drip` term).
4. **Shaded or north faces and roof valleys** get more moss.
5. **Sun-exposed ridges** are bleached, so lighter: `top` on roofs.

```js
// Moss and cracks only in the lower 3 rows and on the north wall:
b.weather([H.x0, F - 2, H.z0], [H.x1, F + 2, H.z1], { amount: 0.25, mossBias: 0.6 })
b.weather([H.x0, F, H.z0], [H.x1, F + 8, H.z0], { amount: 0.2, mossBias: 0.8 })
// Vines where water runs: limit the box to the shaded side
b.overgrow([H.x0, F, H.z0 - 1], [H.x1, F + 6, H.z0 - 1], { amount: 0.15, maxLength: 3 })
```

`b.weather` only ages blocks that have aged variants:

- stone bricks and their stairs, slabs and walls (cracked or mossy)
- cobblestone and its shapes (mossy)
- deepslate bricks and tiles (cracked)
- polished blackstone bricks
- nether bricks
- copper and cut copper (oxidation stages)

Other ramps age only through `b.texture`'s darkening terms.

Amounts:

- 0.1–0.2 for inhabited buildings.
- 0.3–0.5 for ruins.
- **Never apply it uniformly over a whole building at a high amount.** It reads as a green checkerboard.

### 2.5 Named failures

Each was reproduced in this renderer.

| Name | How it looks in a render | Cause | Fix |
| --- | --- | --- | --- |
| **Smallpox** | Blotchy, high-contrast speckle; wall reads as camouflage | `kit.palette({...}, { scale: 0 })` or an unordered mix of 4–5 blocks | `b.texture` with an ordered ramp; or `kit.palette` with `scale: 4–8` and one dominant weight (≥ 60%) |
| **Sandwiching** | Horizontal stripes; top edge emphasised | `kit.gradient(..., { dither: 0 })` along `y`, or hand-placed courses of different stones | `b.texture` (gradient + clusters); if you use `kit.gradient`, keep `dither ≥ 0.6` and add `noise` via `t` |
| **Splattering** | Isolated dark blocks in light areas (or the reverse) | Ramp steps skipped; ramp not sorted; ΔL* too large | Sort by L*; keep ΔL* ≤ 8 between steps; `maxStep: 1–2` |
| **Hue patch** | One "foreign" colour blob, e.g. pink in yellow plaster | A ramp step with a different undertone | Undertone lock (§2.1): a* and b* within ±6 |
| **Green checkerboard** | Moss and mossy blocks evenly everywhere | High-amount `b.weather` over the whole build, or moss blocks in a palette | Localise wear (§2.4); amount ≤ 0.2 |
| **Plastic** | Flat, untextured concrete on a "stone" building | `*_concrete` as a wall material in a rustic style | Concrete only for modern builds; otherwise stone or terracotta ramps |
| **Monotone slab** | One block makes up more than 60% of a large face; looks like a texture-pack preview | No ramp | `b.texture` (`inspect --checks` warns `dominant-block`) |

### 2.6 Which paint for which job

| Tool | Use for |
| --- | --- |
| `b.texture` | Any wall, plinth or roof that should read as one aged material |
| `kit.palette(entries, { scale: 3..8 })` | Ground cover, paths, rubble, roof moss accents; any non-directional mix. Keep one entry ≥ 60% |
| `kit.gradient(stops, { axis, from, to, dither: 0.6 })` | Deliberate large-scale transitions: tower base to top, cliff strata, sea-floor depth. Use `t` for radial fields |
| `kit.blend(a, b, amount)` | Two-material patching, e.g. 20% `coarse_dirt` in grass, or `moss_block` in stone |
| `kit.bands(base, band, { period })` | String courses, log rings, copper banding: intentional *architectural* lines (not texture) |

---

## 3. Detail by viewing distance

### 3.1 What reads at which density

| px per block | Reads | Invest here |
| --- | --- | --- |
| < 8 (fit view of a 100+ wide scene) | Silhouette, roof vs wall colour, big masses, tree clusters, road lines | Skyline tiers, roof colour contrast, one landmark, vegetation masses |
| 8–20 (fit view of a 32–64 wide build) | Openings as dark rectangles, 1-block depth (shadow lines), trim lines, texture clusters | Window rhythm, eaves and overhang shadow, plinth course, gradients, path network |
| 20–45 (close-up, distance 20–45) | Stairs vs slabs, trapdoor shutters, fences, lanterns, sills, flower boxes | Window and door kits, brackets, chimneys, dormers, balconies |
| > 45 (close-up, distance < 20) | Buttons, chains, candles, pots, carpets | Props, interior dressing seen through doors |

Consequence: in a whole-scene shot, **depth and value contrast carry the image, not small props.** Spend blocks on shadows, eaves and plinths before buttons. Then render a close-up of the hero bay to prove that the small detail exists.

### 3.2 Depth rules (consensus)

- **Depth only where structure justifies it:** eaves, window reveals, sills, plinth ledges, posts and pilasters, buttresses, jetties, chimneys. Arbitrary stacked layers read as noise.
- **One block of recess or projection is enough** for most builds. Use `b.window(..., { recess: 1 })` and a 1-block plinth ledge.
- **No run of more than about 8 identical, flat wall blocks.** Break it with a post, pilaster, buttress, recess or band. `inspect --checks` flags `flat-walls` at 6×5 and larger.
- **Prefer 2-thick walls** on stone and civic buildings. `recess: 1` removes the wall-plane cell and puts the pane one cell deeper. On a 1-thick wall it still reads as a reveal from outside (the cottage in §1.4 does this), but the pane then sits in the room's first cell, so keep furniture out of it.
- **Overhang every roof** 1 block (2 on roofs wider than 12) and use `eaveTrim: true`. A roof that meets the wall flush looks unfinished.

### 3.3 The facade bay system

Divide each facade into **bays** between posts or pilasters, 3–6 cells wide inside. Per bay, put:

- **one depth change** (a recess or a ±1 projection);
- **one horizontal line** (sill course, floor beam, eave);
- **at most one accent cluster** (shutter pair, flower box, lantern).

Calm-zone rule, learned from the cottage test: **window width + 2 (shutters) + 2 plain cells ≤ bay width.** A 4-cell bay takes a 2-wide window *without* shutters, or a 1-wide window *with* shutters. A 6-cell bay takes a 2-wide window with shutters.

```
GOOD 6-cell bay (elevation)          BAD 4-cell bay
| . S G G S . |   <- shutters S,      | S G G S |   <- no plain wall left:
| . S G G S . |      glass G          | S G G S |      reads as a solid
| . = = = = . |   <- sill (stairs)    | = = = = |      wooden panel
| . . . . . . |   plain plaster .     | . . . . |
```

**Density targets:**

| Bay | Content |
| --- | --- |
| **Hero bay** (entrance, or the gable facing the main view) | 2–3× the density of the others: door frame, awning, lantern, flanking windows with shutters, flower boxes |
| Ordinary bays | One window kit + one line |
| End bays and back walls | Window + sill only. Quieter on purpose |
| Per building | Detail concentrated in at most 2 focal zones: entrance + roofline, or entrance + hero window |

### 3.4 Element kit (kit calls)

```js
// Window with reveal, sill, lintel, shutters (pane sits 1 cell in; best on 2-thick walls)
b.window([x, F + 1, H.z1], 'south', { width: 1, height: 2, recess: 1, sill: true, lintel: true, shutters: true, material: 'spruce' })
// Arched hero window with a mullion (width >= 3)
b.window([x, F + 5, H.z1], 'south', { width: 3, height: 3, recess: 1, arch: true, mullion: 'stripped_spruce_log', material: 'stone_brick' })
// Door: frame + awning; steps when the door sits above grade
b.door([doorX, F, H.z1], 'south', { material: 'spruce', width: 2, frame: 'stripped_spruce_log', awning: true, steps: true })
// Projecting string course at the floor line (upside-down stairs, back against the wall)
for (let x = H.x0; x <= H.x1; x++) b.set(x, F + 4, H.z1 + 1, kit.stairs('stone_brick', 'north', 'top'))
// Plinth ledge (water table): stairs stepping out at the top of the foundation
for (let x = H.x0; x <= H.x1; x++) b.set(x, F - 1, H.z1 + 1, kit.stairs('tuff_brick', 'north', 'bottom'))
// Buttresses on long walls: every 4-6 blocks, capped with a sloping stair
for (const x of [H.x0 + 4, H.x1 - 4]) {
  b.box([x, F - 1, H.z1 + 1], [x, F + 2, H.z1 + 1], 'stone_bricks')
  b.set(x, F + 3, H.z1 + 1, kit.stairs('stone_brick', 'north', 'bottom'))
}
// Corner quoins: alternate a lighter block up the outside corners
for (const [x, z] of [[H.x0, H.z0], [H.x1, H.z0], [H.x0, H.z1], [H.x1, H.z1]])
  for (let y = F; y <= F + 3; y++) if ((y - F) % 2 === 0) b.set(x, y, z, 'polished_andesite')
// Chimney through the roof, 2-4 above the ridge, smoking
b.chimney([H.x1 - 1, F + 5, H.z0 + 1], 10, { paint: kit.palette({ bricks: 5, mud_bricks: 2 }), cap: 'cobblestone_wall' })
// Timber frame upper storey: posts every 3-5 (bays), braces only if a bay is >= 5 cells
b.timberWall([H.x0, F + 4, H.z1], [H.x1, F + 8, H.z1], { frame: 'stripped_spruce_log', infill: 'yellow_wool', postEvery: 5 })
```

### 3.5 Roof rules

- **Height:** 1–2 storeys (4–10 blocks) above the wall top for inhabited buildings. If a roof would be taller, split it, use a mansard, or make that part a tower.
- **Footprints over about 15×15** need several roof sections: cross gables, wings, hips with gable ends. Build the largest or highest roof first, then the wings; the kit resolves stair corners at the joins.
- **Odd width** puts the ridge over a 1-wide centred door or window. Use an even width for double doors.
- **Pitch by climate and style:**

| `pitch` | Style |
| --- | --- |
| `0.5` | Mediterranean / low |
| `1` | Temperate |
| `2` | Nordic / Gothic / wet |
| `[0.5, 0.5, 1, 1, 2, 2]` | East-Asian curve |
| `[2, 2, 3, 0.5]` | Mansard |
| `[2, 2, 0.5, 0.5]` | Gambrel |

- **Vary roof type across a settlement** (`'gable' | 'hip' | 'pyramid' | 'mansard' | 'shed'`), but keep **one roof material**.
- **Ridge accents:** `ridgeCap` (a wall or slab) on long ridges; dormers every 4–6 blocks on roofs longer than 10.
- **Seen from inside,** a roof should show structure: rows of stairs as rafters or tie beams, not a flat ceiling of the roof's underside.

### 3.6 Proportion numbers (consensus)

| Item | Rule |
| --- | --- |
| Storey | 4–5 blocks floor to floor; rooms ≥ 3 clear; never 2-tall rooms |
| Ground floor | Shops and halls 5–6 |
| Door | 2 tall, 1–2 wide; frame 1 around; awning or lintel above |
| Windows | 1–2 wide × 2–3 tall on houses; aligned vertically between floors |
| Tower | Height ≥ 2.5× width to read as a tower (taste); walls thicker at the base (taper or plinth) |
| Building | Width 7–11 for houses (convention); landmark 1.5–2× the height of the fabric (taste) |

---

## 4. Self-review rubric

Score each item **0 (fail) / 1 (acceptable) / 2 (strong)** from the listed views. Fix the lowest-scoring item first, re-render, and re-score. Ship when there are no zeros and the total is at least 20/24 (house rule).

For multi-building scenes, isolate each building with `--clip` and score items 3–6 per building; score the rest at scene level.

| # | Check | Look with | Fail signals | Fix (kit) |
| --- | --- | --- | --- | --- |
| 1 | **Silhouette and focal hierarchy** | `se`, `nw`, `hero` (fit) | No dominant mass; all ridges at one height; plain box; two equal landmarks competing | Raise the hero to 1.5–2× the fabric height (tower, cross gable, `pitch: 2`); vary ridge heights ±2–4; add one wing (L/T) with its own roof; demote the competing landmark |
| 2 | **Terrain fit** | `south`, `east`, `low`; `inspect --slice x=<n>` | Floating corner; dirt or grass under a wall; door above grade with no steps; house on a flattened pad with cliff edges; plaza on stilts | Foundation per column from `ground(x,z)-1` to `F-1`; `F = max ground + 1`; `b.door(..., { steps: true })`; retaining wall plus terrace for big cuts; re-grade 1–3 blocks around the footprint rather than flattening the map |
| 3 | **Roof** | `south`, `east`, `se` | No overhang; one huge roof on > 15×15; roof taller than 2 storeys; ridge off-centre over the door; wrong stair corners | `overhang: 1–2`, `eaveTrim: true`; split into sections (largest first); lower `pitch` or add a floor; odd width; let `finish()` compute stair shapes (never hand-set `shape`) |
| 4 | **Facade depth** | `south` and `east` elevations; `inspect --checks` `flat-walls` | Shadowless planes; windows flush; > 8 identical blocks in a row | `recess: 1`; sills and lintels; posts every 3–5; string course; buttresses; jettied upper floor (+1 overhang) |
| 5 | **Texture** | Close-up `--distance 25..40`; `inspect --checks` `dominant-block`, `palette-size` | Speckle, stripes, splatter, hue patch, monotone slab | §2: sorted ramp + `b.texture` per role; undertone lock; `maxStep: 1–2` |
| 6 | **Restraint and focus** | Close-up of the hero bay + `south` | Every bay equally busy; shutters filling bays; accents scattered on the ground; > 12 block families on one building | Bay rule (§3.3); move accents to the entrance, windows and roofline; consolidate to wall, trim, roof, accent and wood families |
| 7 | **Variety vs cohesion** (scenes) | `se`, `top` | Clones (same footprint, roof and door); or every house a different material | §6: fix the style, seed the variables, 1–2 signature buildings |
| 8 | **Connectivity** | `top`, `se` | Doors without paths; paths through walls or up 2+ block steps; dead ends | `b.path` from every door to a network; route along contours; bridge water; widen the main road (3–5) and narrow lanes (1–2) |
| 9 | **Life and interiors** | `--clip-y` at each floor (+1 above the floor), door close-up | Empty shells; 2-tall rooms; floating furniture; no clue to the trade | Partition rooms; furnish by profession (§7.2); stair-row ceiling beams; yard props |
| 10 | **Lighting** | `--lighting night` (`hero`, `se`); `inspect --checks` `lighting`, `unlit-lights` | Dark paths and doorways; unlit hero; torch spam; candles or bulbs with `lit=false` | `b.lampPost` every 8–12 blocks of road and at junctions; `b.hangingLantern` under eaves and at doors; candles in hero windows; `lit=true` |
| 11 | **Integrity and plausibility** | `inspect --checks` (all), `--find wool` | Floating blocks; unsupported lanterns or plants; half doors or beds; gravity blocks over air; leaking fluids; leftover placeholders; impossible cantilevers | Delete or connect strays (tree tips are a common source); give hanging lanterns a block above; pair two-part blocks; support or swap gravity blocks; contain water; texture or remove wool |
| 12 | **Presentation** | `hero`, `low` with `--zoom` / `--target` | Build tiny in frame; cut off; raw stone cross-section dominating; boring angle | `--zoom 1.5–2.5` or a custom `--target` on the hero; frame with foreground trees or terrain; crop the canvas (`trim: true`) or soften diorama edges; pick the view where the signature element overlaps the skyline |

**`inspect --checks` false positives to recognise:**

- **`lighting`** counts dark spots under tree canopies as "roofed walkable spots". Read the example coordinates and only act on interiors and covered walkways.
- **`flat-walls`** flags the cut faces at the edge of a terrain diorama. Ignore those, or hide the cut faces by tapering the island edge.
- **`palette-size`** counts every flower and leaf type, so scenes with nature go over 40 quickly. Judge the palette per building instead (`--clip` render, `--find`).
- **`detail-ratio`** is dragged down by terrain volume. Check partial-block use on the buildings themselves.

---

## 5. Anti-pattern catalogue

Each entry gives the symptom in a render, then the fix in kit terms.

### Massing and composition

1. **Shoebox.** A symmetrical box with a flat or single-pitch roof.
   - Fix: L/T/U plan with `b.prism`, or two `b.box` volumes with different heights. Each wing gets its own `b.roof`, wing ridge 1–3 lower.
   - Only add wings that have a purpose (kitchen, stair tower, porch, barn).
2. **Barn roof.** One gable over a footprint wider than about 15. Fix: split the plan and roof the sections separately, largest first; or use a `'hip'` with cross gables.
3. **Clones.** Identical houses in a row. Fix: per-building seeded variables (§6). Keep materials fixed and vary footprint, height, roof type, door side and extensions.
4. **No focal point,** or two competing ones. Fix: one landmark taller than everything (1.5–2×), on high ground or at a road focus. Shrink or move the rival.
5. **Implausible scale:** a 2-tall room, a giant hut, a door 3 wide on a cottage. Fix: §3.6 numbers; use `--clip-y` to check that storeys are 4–5.
6. **Over-sized empty plaza or meadow** around small buildings, with houses lost in the frame. Fix: add yards, fences, fields, trees and paths, or shrink the canvas. Negative space should be shaped (a plaza with edges), not leftover.

### Surface

7. **Flat single-block walls.** Fix: ramp + `b.texture` + one depth device per bay.
8. **Smallpox / sandwiching / splattering / hue patch.** Fix: §2.5.
9. **Glass block windows flush with the wall.** Fix: `b.window(..., { glass: 'glass_pane', recess: 1 })`.
10. **Doors flush with the outer face and no frame.** Fix: `b.door(..., { frame, awning })`. To recess, build the wall 2 thick, pass the inner layer as the door position, and `b.remove` the outer cells in front of it.
11. **Roof without eaves.** Fix: `overhang: 1–2`, `gableOverhang: 1`, `eaveTrim: true`.
12. **Arbitrary depth:** stacked layers of stairs and slabs with no structural meaning. Fix: delete them. Keep depth at reveals, sills, plinths, posts, buttresses and eaves.
13. **Too many unrelated materials:** more than about 12 families on one building, or two stone families on one wall. Fix: one stone, one wood, one roof, one accent (WesterosCraft rule: one stone type per build).
14. **Concrete or wool as finished materials in a rustic build.** Fix: stone, terracotta or plaster ramps. Wool belongs only to placeholders, carpets and awnings.

### Ground and nature

15. **Floating or perched buildings:** exposed dirt under the walls, a giant pillar foundation on a cliff. Fix: the foundation loop per column; step the plinth down the slope; move the footprint off the cliff edge or add a buttressed retaining wall.
16. **Bulldozed pad:** a perfectly flat rectangle with vertical cut edges. Fix: keep the natural heightmap; re-grade only 1–3 blocks around the footprint; terrace with retaining walls.
17. **Uniform vegetation:** grid-planted identical trees, lollipop spheres, grass on every block. Fix:
    - Use `b.tree` species presets with a different `seed` each.
    - Place trees in clusters with gaps, and vary their sizes (canopy trees, small trees, `b.bush`).
    - Keep `b.scatter` density at 0.15–0.25 with clumping. Leave clearings near doors.
    - **Match species to biome:** spruce/pine in cold and mountains; oak/birch in temperate; acacia in savanna; mangrove/willow in swamp.
18. **Paths that ignore terrain or connect nothing.** Fix: `b.path` through control points along contours, from every door to the main route. Use a `kit.palette` of `dirt_path`, `coarse_dirt` and `gravel`.
19. **Dead terrain edges:** a raw cross-section of stone filling the bottom of the frame. Fix: frame with `hero`/`low` and `--zoom`; or use `b.island` for floating dioramas; or `trim: true` and a shallower base.

### Life, story, light

20. **Empty shells:** a cutaway shows bare rooms. Fix: partitions, a floor per storey, furniture by profession (§7.2), stair-row beams. The interior is visible through doors and windows at close range.
21. **Torch spam,** or no light at all. Fix: §7.3. Lanterns, candles and campfires; spacing rules; light the hero hardest.
22. **Unresolved story hook:** a monorail with no station, a wall with no gate, a dock with no water. Fix: every signature element needs its functional counterpart.
23. **Leftover placeholders and stray blocks.** Fix: `inspect --find wool` and `inspect --checks` (`floating-blocks`, `support`, `two-part-blocks`) before every final render. Kit conifers can leave a lone tip leaf. The stray-removal loop at the end of the §1.4 example deletes every block that touches nothing, even diagonally.
24. **Hazard dissonance:** lava next to wood, open water on upper floors, fire on a thatch roof. Fix: contain or delete. `inspect --checks` `fluids` flags spills.

---

## 6. Variety vs cohesion in multi-building scenes

Judges reward settlements whose buildings are **"both different and alike"**, anchored by **a few signature buildings**. Too similar reads as procedural oatmeal; too different reads as haphazard.

Sort every design variable into one of three buckets:

| Fix once per settlement (style) | Vary per building (seeded) | Maximise everywhere (quality) |
| --- | --- | --- |
| Stone ramp, wood family, roof material, plaster ramp, window kit, door kit, trim style, accent colour, lamp-post design, fence style | Footprint (rectangle / L / T; width 7/9/11; depth 6–8), storeys (1–2, rarely 3), roof type and ridge axis, `pitch` (within the style's range), door side and offset, extension or lean-to, chimney position, yard contents, `b.texture` seed and wear amount | Eaves on every roof, foundations fitted to terrain, window reveals, interiors, path connection, lighting |

```js
const STYLE = {                                   // fixed: cohesion
  wall: ['andesite', 'cobblestone', 'stone_bricks', 'tuff', 'tuff_bricks'],
  plinth: ['tuff_bricks', 'cobbled_deepslate', 'deepslate_bricks', 'deepslate_tiles'],
  daub: ['calcite', 'smooth_sandstone', 'sandstone'],
  roof: 'spruce', frame: 'stripped_spruce_log', wood: 'spruce',
}
const rng = kit.rng(21)
for (const [i, [x0, z0]] of lots.entries()) {   // varied: seeded per lot
  house({ x0, z0, w: rng.pick([7, 9, 11]), d: rng.pick([6, 7]), floors: rng.chance(0.5) ? 2 : 1,
    roofType: rng.pick(['gable', 'gable', 'hip']), pitch: rng.pick([1, 1, 2]),
    facing: doorFacesRoad(x0, z0), half: rng.int(-1, 1), seed: i * 13 })
}
```

This pattern was tested on five houses plus a chapel tower: cohesive and varied, with `problems: []`. `house()` applies the bay, foundation and texture rules from §1–3. The STYLE-driven `b.texture` calls take `seed` so walls don't repeat.

**Composition rules:**

- **Roads first.** Lay the main road along the valley or contour (3–5 wide), lanes 1–2 wide off it. Doors face the road, and buildings line it with 1–3 block setbacks for yards.
- **Signature buildings:** 1 per scene, or 1–2 per 10–15 buildings. Make them:
  - the tallest (1.5–2× the fabric);
  - a unique roof type or pitch;
  - the rarest material, used only there, as an accent;
  - placed on high ground or at the end of a road.
- **Skyline tiers.** The landmark, then secondary verticals (gate, hall, tower, big tree), then fabric of 1–2 storeys with ridge heights varying by ±2–4 and ridges in both axes.
- **Value hierarchy.** The landmark gets the highest value contrast (lightest walls against the darkest roof). Background buildings use the default `b.texture` settings.
- **Shaped negative space:** a plaza at the main node (paved with a `kit.palette`), yards with fences, fields with crop rows, forest clearings. Avoid unshaped empty grass.
- **Zoning:**
  - Richer and taller buildings at the centre.
  - Workshops near their resource: sawmill by the forest, smithy on the road, dock on the water.
  - Farms at the edge.
  - Walls, a river or a treeline as the edge.
- **Adapt to the site.**
  - The biome picks the palette: sandstone and terracotta in desert, spruce and cobble in taiga, acacia and terracotta in savanna.
  - The terrain picks positions.
  - The same generator should produce visibly different settlements on different terrain.
- **History layers** (in about 20–30% of buildings): an older core in a rougher ramp (`cobblestone`, mossy, more `base`) with a newer extension in a cleaner ramp (`stone_bricks`, `polished_andesite`, clean preset). Leave a visible seam where the two meet.

---

## 7. Storytelling and lighting essentials

### 7.1 Story checklist

A judge should be able to answer these from screenshots.

- **What is this place for?** Fort, farm village, mining camp, port, shrine. Its function must be *built*: a fort has walls with gates and walkways, a farm village has fields, a port has docks and boats.
- **Who lives here and what do they do?** Profession props at doors and yards (§7.2).
- **How old is it?** Wear amount, history layers, repairs (a patch of the clean ramp in an old wall), ruins at the edge.
- **What culture?** A coherent style shorthand: timber frame and steep roofs (northern European), sandstone and flat roofs (desert), curved `pitch` profiles with `red_terracotta` accents (East-Asian). Never mix shorthands in one settlement.
- **One "wienie":** a single feature that pulls the eye and invites exploration, such as a tower, a windmill, a ruin or a waterfall shrine. Place it where the main view's sightline ends.

### 7.2 Props by profession

All are real 1.21.1 blocks.

| Trade | Props |
| --- | --- |
| Farmer | `composter`, `hay_block`, `farmland` + `wheat[age=7]` / `carrots` / `potatoes`, `barrel`, fence pens |
| Smith | `smithing_table`, `anvil`, `grindstone`, `blast_furnace`, `cauldron`, `campfire`, `chain` |
| Carpenter / sawmill | `stonecutter`, stacked logs (`spruce_log[axis=x]`), `barrel`, `crafting_table` |
| Weaver / tailor | `loom`, wool blocks as bolts, carpets |
| Scholar / cleric | `lectern`, `bookshelf`, `chiseled_bookshelf`, `brewing_stand`, `candle` |
| Fletcher / hunter | `fletching_table`, `target`, `hay_block` |
| Cartographer | `cartography_table`, `lectern` |
| Cook / inn | `smoker`, `furnace`, `barrel`, `campfire`, `decorated_pot`, `cake` |
| Fisher / port | `barrel`, `chest`, `chain`, `lantern`, fence posts (as bollards) |

Signs and banners render unreliably in this viewer, and entities (item frames, armor stands, paintings) not at all. **Tell the story with blocks.** A shop is signalled by an awning, a lantern on a bracket arm, and goods (`barrel`, `hay_block`, `decorated_pot`) at the door.

### 7.3 Lighting scheme

**Sources:**

- Warm, domestic: `lantern`, `candle[lit=true]`, `campfire[lit=true]`.
- Cold or eerie: `soul_lantern`, `soul_campfire`.
- Industrial: `copper_bulb[lit=true]`.
- Hidden ambient, used sparingly: `shroomlight` or an `ochre_froglight` under leaves, carpet or moss.

**Placement:**

| Where | Rule |
| --- | --- |
| Main road | `b.lampPost` every 8–12 blocks, alternating sides, plus at every junction |
| Doors and gates | A lantern under every awning or eave beside the main door; both sides of gates and bridge ends |
| Hero building | The densest light: lit windows on every floor (candles behind the glass), lanterns at the corners |
| Interiors | A light within about 6 blocks of every floor cell (the `inspect` lighting check) |
| Avoid | Torches as the main scheme; unexplained light (glowstone in a stone wall); equal light everywhere |

**Reading night renders.**

- In `--lighting night`, light sources glow with a short radius. Lanterns read as bright points, and window candles are faint.
- Judge the **constellation**: the path network and the hero building should be traceable as lines and clusters of points.
- If the hero isn't the brightest cluster, add exterior lanterns there. Interior candles alone won't carry a night shot.

---

## Sources

- Hervé, Salge & Warpefelt (2023), *An Examination of the Hidden Judging Criteria in the GDMC Competition*: https://doi.org/10.36227/techrxiv.22698484.v1
- Salge et al. (2018), *GDMC Settlement Generation Competition*, with the judging criteria: https://arxiv.org/abs/1803.09853
- Salge et al. (2021), *Impressions of the GDMC AI Settlement Generation Challenge*: https://arxiv.org/abs/2108.02955
- WesterosCraft building fundamentals (gradients, exteriors, layout and foundation, interiors): https://www.westeroscraft.com/docs/building/fundamentals
- WesterosCraft applicant criteria: https://www.westeroscraft.com/docs/building/apply-to-build
- Minecraft Wiki, roof construction guidelines: https://minecraft.wiki/w/Tutorial:Roof_construction_guidelines
- Minecraft Wiki, walls and buttresses: https://minecraft.wiki/w/Tutorial:Walls_and_buttresses
- Kate Compton, *So you want to build a generator*: https://galaxykate0.tumblr.com/post/139774965871/so-you-want-to-build-a-generator
- Noxcrew on scale-model planning: https://www.minecraft.net/en-us/article/community-celebration-terra-swoop-force
- Greenfield's workflow (roads → districts → plots, interior inspections): https://www.rockpapershotgun.com/400-people-spent-a-decade-building-a-11-city-in-minecraft
