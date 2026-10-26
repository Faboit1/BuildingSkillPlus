# Inspecting Builds as Text

`scripts/inspect.mjs` reads a vanilla structure `.nbt` and prints exact, block-level facts about it:
a summary, ASCII slices, a per-layer profile, block search, and a quality lint. Renders show the
overall look. This tool shows what is actually stored at each coordinate. Use it after every build
to check geometry, palettes, block states and common mistakes before you look at renders.

```bash
node scripts/inspect.mjs minecraft-builds/my-build/my-build.nbt            # summary
node scripts/inspect.mjs minecraft-builds/my-build/my-build.nbt --checks   # lint
node scripts/inspect.mjs minecraft-builds/my-build/my-build.nbt --style medieval   # scorecard vs human norms
node scripts/inspect.mjs minecraft-builds/my-build/my-build.nbt --layers 0-6 --range 0,0,20,20
```

It needs only Node and Lodestone, which is bundled in `scripts/node_modules/lodestone`. The bundled default resource
pack provides block-id validation, property-value validation and model-based full-cube detection.
It reads gzip, zlib or uncompressed files of 500k+ blocks in about a second.

## Typical Loop

1. `node scripts/run-build.mjs recipe.mjs --out-dir minecraft-builds/x`
2. `node scripts/inspect.mjs minecraft-builds/x/x.nbt --checks`: fix every `WARN` that is not
   intentional.
3. `node scripts/inspect.mjs minecraft-builds/x/x.nbt --style <style>`: fix the worst
   out-of-band metrics first and track the 0-100 score between iterations.
4. `--slice` / `--layers` the areas you changed to confirm the exact geometry (window spacing,
   roof stair facing, door placement, symmetry).
5. Render with `scripts/render.mjs` for the overall look.

## Input

- Vanilla structure NBT (`size`, `palette`, `blocks`, `entities`), gzip, zlib or uncompressed.
- Multi-palette files (`palettes`, for example shipwrecks) use palette 0. `--palette <n>` picks
  another.
- `minecraft:air`, `cave_air`, `void_air` and `structure_void` are treated as empty.
- Jigsaw blocks are replaced by their `final_state` (usually air or the surrounding material).
- Coordinates are structure-local, the same as in recipes: `x` east, `y` up, `z` south, from 0.

## Options

| Flag | Meaning |
|---|---|
| *(none)* | Summary only |
| `--summary` | Include the summary alongside other commands |
| `--slice y=<n>` | Top-view ASCII map of one layer. `x=<n>` / `z=<n>` give side views. Repeatable |
| `--layers <y0>-<y1>` | Consecutive y slices (`x=a-b` / `z=a-b` also work) |
| `--range x0,z0,x1,z1` | Crop slices. y-slices use x and z, x-slices use z, z-slices use x |
| `--range x0,y0,z0,x1,y1,z1` | Crop slices in all three axes |
| `--profile` | Per-y-level stats |
| `--find <query>` | Positions of matching blocks. Repeatable |
| `--limit <n>` | Max positions per `--find` (default 200) |
| `--checks` | Quality lint |
| `--score` | Scorecard: composition vs human norms, plus geometry metrics, with a 0-100 total |
| `--style <name>` | Norm set for `--score` (implies `--score`): `medieval`, `house`, `castle`, `fantasy`, `japanese`, `gothic`, `modern`, `ship`, `statue`, `organic`, `terrain`, `other`, `curated`, `all` (default `all`) |
| `--examples <n>` | Examples shown per check (default 6) |
| `--all` | Every palette row (default top 40) |
| `--states` | Palette by full block state instead of block id |
| `--palette <n>` | Palette index for multi-palette files |
| `--json` | Everything computed, as JSON |

Flags take `--flag value` or `--flag=value`. Errors print `inspect: <message>` and exit 1.

## Summary

```text
house.nbt  (gzip, DataVersion 3955)
Size 13 x 8 x 11 (x y z); 530 non-air blocks; non-air bounds x 0..12, y 0..7, z 0..10

Volume 1,144; filled 46.3%; bounds size 13 x 8 x 11
File: 1,093 block entries; 563 air/void; 4 jigsaw(s) replaced by final_state; no entities

Palette: 13 block ids, 28 states (--states for full states)
    158   29.8%  minecraft:oak_planks
    121   22.8%  minecraft:oak_stairs  (6 states)
     93   17.5%  minecraft:cobblestone
...
Categories:
  full cubes           379   71.5%
  stairs               121   22.8%
  panes/bars            10    1.9%
...
Detail ratio: 0.285 (non-cube solid blocks / all solid blocks; fluids excluded)

Lighting (approximate: block-light BFS from emitters, sky light ignored):
  sources: 6 (wall_torch x6 @14)
  walkable spots (air over a solid top inside the bounds): 49 (roofed 44, open 5)
  dark (block light 0, hostile mobs can spawn): roofed 0 (0%), open 0 (0%)
```

- **Bounds** are the bounding box of non-air blocks. Compare it with the intended footprint to
  catch off-by-one placement or a build that does not fill its structure size.
- **Categories** are shape classes: full cubes, stairs, slabs, walls, fences/gates, panes/bars,
  trapdoors, doors, buttons, pressure plates, lights (non-cube light blocks such as torches,
  lanterns, candles and end rods), plants, furniture/decor (beds, chests, carpets, signs, banners,
  pots, heads...), fluids and other partial blocks. Full-cube detection uses the default pack's
  block models. Glowstone, sea lanterns and leaves are full cubes, so they count as `full`.
- **Detail ratio** is non-cube blocks divided by all solid blocks. Detailed vanilla houses sit
  around 0.2-0.5. Below about 0.08 a build reads as boxy.
- **Lighting** is an estimate. Block light spreads from every emitter (torch 14, lantern 15,
  soul lantern/torch 10, glowstone/sea lantern/shroomlight/froglights 15, lit redstone lamp/copper
  bulb 15, end rod 14, lit candles 3 per candle, lit campfire 15, magma 3, and so on), losing 1 per
  block through non-opaque cells. Leaves and water cost 1 extra. Full opaque cubes block light,
  and slabs and stairs are treated as transparent. A **walkable spot** is an empty cell inside the
  bounds that sits on a solid top face (full cube, top slab or upside-down stairs) and has
  headroom. **Roofed** spots have a block somewhere above them. **Dark** means block light 0, where
  hostile mobs can spawn at night or indoors. The darkest roofed areas are listed as coordinate
  boxes. **Unlit** lists light blocks whose state emits nothing (`lit=false` candles, lamps, bulbs,
  campfires; sea pickles that are not waterlogged).

## Slices

```text
--- y=4  top view: north (z-) up, east (x+) right; x 0..12, z 0..10  (69 blocks)
              1
  x 0123456789012
  0 >O....O<.....
  1 >L####L<.....
  2 >O....OOvvvvv
  3 >O!...O####LO
  ...
Legend (top views; '.' = empty):
  #  cobblestone  (22)
  O  oak_planks  (16)
  >  oak_stairs facing=east half=bottom  (11)
  ^  oak_stairs facing=north half=bottom  (5)
  L  stripped_oak_log axis=y  (5)
  !  wall_torch  (2)

--- x=6  side view from the west: north (z-) left, south right, top row = highest y; z 0..10, y 0..7  (50 blocks)
 z 01234567890
 7 ...../O\...
 6 ..../O.O\..
 5 nnnOO...O\n
 4 OLOO....!#O
```

- **y-slices** are top views. North (z=0) is the top row and west (x=0) the left column.
- **x-slices** are seen from the west, with north on the left. **z-slices** are seen from the
  south, with west on the left. The top row of a side view is the highest y.
- The column ruler is printed vertically: the tens digit appears only where it changes, and the
  units row is labelled with the axis. Row labels are the other coordinate.
- Without `--range`, slices are cropped to the non-air bounds, and every slice in one run shares
  the same crop so layers line up.
- Each symbol stands for exactly one block variant. Symbols stay the same across every slice of
  the same view in one run, and the legend after each group lists symbol, variant and count.
  Common blocks claim their preferred symbol first. When a symbol is taken, the block falls back to
  a letter from its name, so always read the legend.

Preferred symbols:

| Symbol | Meaning |
|---|---|
| `.` | empty (air, structure void) |
| `#` `%` | stone-like full blocks (stone, bricks, deepslate, tuff, quartz...) |
| `A`-`Z` | other full blocks, by name letter (`O` oak_planks, `S` spruce_planks) |
| `^ v > <` | top view: stairs facing north/south/east/west, i.e. the side that rises. `A V ) (` are the same for upside-down (top-half) stairs |
| `/` `\` | side view: bottom stairs rising to the right/left. `7` `r` are upside-down stairs. `n`/`u` are stairs facing toward or away from the viewer |
| `_` `=` | bottom / top slab (a double slab counts as a full block) |
| `\|` `-` `+` | top view: fence/wall/pane running north-south / east-west / post or junction. `I` `:` are wall and pane alternates |
| `/` `g` | fence gate |
| `L` `x` `z` | logs/wood/stems with axis y / x / z |
| `D` `T` | door, trapdoor |
| `!` `i` `*` `@` | torches and end rods; candles; lanterns; light-emitting full blocks |
| `~` `%` | water, lava |
| `&` | leaves |
| `"` | plants (flowers, grass, crops, vines) |
| `:` | glass blocks |
| `H` `$` `B` `C` `,` | ladder, chain, bed, chest/barrel, carpet or pressure plate |

## Profile

```text
Profile (highest y first; coverage = blocks / bounds footprint; detail = non-cube share):
     y  blocks  cover  ids  detail  top blocks
     7      33    59%    6     15%  ########     spruce_log 18, spruce_planks 10, spruce_trapdoor 2  <- dense layer (floor/roof?)
     6      21    38%    6     29%  #####        spruce_planks 11, spruce_log 4, spruce_stairs 2
     5      27    48%    2     63%  ######       spruce_stairs 17, spruce_planks 10
```

- **cover** is the layer's block count divided by the bounds footprint (x by z). Floors, ceilings
  and roofs show up as high-coverage layers, marked `<- dense layer`, between thinner wall layers.
- **detail** is the share of non-cube blocks in the layer. Roof layers full of stairs and slabs sit
  high. A tall run of 0% layers is a boxy, undetailed wall.
- The top-3 blocks show vertical material gradients, such as a stone base, plank walls and a dark
  roof. Runs of empty layers are collapsed.

## Find

```bash
node scripts/inspect.mjs build.nbt --find lantern                  # substring: lantern, soul_lantern...
node scripts/inspect.mjs build.nbt --find minecraft:oak_door       # exact id (has a namespace, no [ or =)
node scripts/inspect.mjs build.nbt --find "hanging=true" --find chest --limit 20
```

Every match counts toward the total and the bounding box of matches. Up to `--limit` positions are
listed, sorted by y, z, x, each with its full state. Blocks with block-entity data show
`{nbt: <id>}`, and blocks that came from a jigsaw show `(jigsaw final_state)`.

## Checks

```text
Checks: 11 warning(s), 3 note(s), 6 passed
WARN  stair-shapes  1 of 3 stairs have a shape vanilla neighbor logic would change (straight -> inner_left x1)
                    e.g. (3,1,13) oak_stairs facing=north half=bottom: shape=straight -> inner_left
                    fix: set shape to the expected value ...
WARN  support       2 attached block(s) have no supporting block (wall_torch x1, lantern x1)
                    e.g. (5,4,3) wall_torch facing=north: nothing to the south
                    e.g. (16,6,16) lantern hanging=true: nothing above
...
OK    leaves-persistent  no leaves
```

Each check prints `WARN` (fix unless intentional), `INFO` (worth a look) or `OK`, with
coordinates and a short fix hint. Rules about the world around the file:

- The bottom layer (y=0) is assumed to rest on the ground. Blocks there never count as floating,
  falling or unsupported, and fluid there does not flow down.
- An attachment whose support would lie outside the file's size box counts as supported, because
  that block is unknown.
- Everything else outside the file counts as air.

| Check | Level | What it detects | How to fix |
|---|---|---|---|
| `unknown-blocks` | warn | Ids missing from the default pack: typos (`oak_plank`), modded or newer blocks. The preview renders them as nothing and the game may drop them | Correct the id. Search `references/lodestone/default-pack-block-states.md` |
| `property-values` | warn | Values the renderer does not know, e.g. a wall `north=true` (walls take `none/low/tall`) or a fence `north=low` (fences take `true/false`) | Use the listed values |
| `floating-blocks` | warn | Blocks touching nothing, not even at an edge or corner. Lights, chains, end rods and lightning rods are exempt | Delete strays or connect them. Use lights or end rods for intentional floating accents |
| `detached-fragments` | info | Parts of 2-8 blocks, not on y=0, that are separated from everything else. Also reports how many separate parts there are and how big the largest is | Usually off-by-one placements. Floating islands can be intentional |
| `diagonal-only` | info | Blocks that share no face with the build, only edges or corners | Normal for curves and checker patterns. Thicken 1-block diagonal lines that look dotted |
| `gravity-blocks` | warn | Sand, red sand, gravel, concrete powder, anvils or dragon eggs over air, fluid or plants. They fall on the first block update | Support them, or use sandstone, concrete, tuff or packed mud |
| `flat-walls` | warn | Vertical rectangles of one block, at least 6x5, whose faces all look onto outside air (air reachable from beyond the build, so interior walls are ignored). Reports plane, facing, extent and flat-face count. A one-block wall flat on both sides shows `facing north+south` | Add depth: pillars or buttresses every 3-5 blocks, recessed windows, stair/slab/trapdoor ledges, or texture variants. Buried or underground pieces trigger this harmlessly |
| `flat-roofs` | info | Top surfaces of one block, at least 7x7, open to the sky | Fine for plazas. Roofs want pitch, parapets or texture |
| `leaves-persistent` | warn | Leaves without `persistent=true`. They decay away from logs | Add `persistent=true` |
| `stair-shapes` | warn | Stored `shape` that differs from vanilla `StairBlock.getStairsShape` (see below). Lists `stored -> expected` counts and examples. Mismatches next to the file edge or a jigsaw are flagged as uncertain | Set the expected shape. The preview and jigsaw pieces use stored shapes as-is |
| `wall-states` | warn | Walls that are invisible (`up=false`, no sides), lack properties (render as lone posts), or whose side connections disagree with neighbors | Set sides to `low` (`tall` under a block) toward walls, panes, gates and solid faces, `none` elsewhere. Set `up=true` at ends, corners, junctions and posts. run-build derives these unless `--no-block-state-updates` is used |
| `fence-pane-connections` | warn | Fences, panes or bars whose `north/east/south/west` disagree with vanilla connection rules | Same as above, `true`/`false` |
| `two-part-blocks` | warn | Doors or tall plants without the matching `half=upper/lower` above or below. Doors whose halves disagree on facing, hinge or open. Beds without the other part (head = foot + facing direction) | Place both halves with matching states |
| `support` | warn | Attachments with nothing to hold them: wall torches, wall signs, wall banners, ladders, wall heads and coral fans (attached opposite their `facing`, so `facing=north` hangs on the block to the south); buttons and levers (by `face`); lanterns (`hanging=true` needs a block above, otherwise below); torches, signs, banners, candles, carpets, rails, redstone, plates, plants and lower door halves (below); hanging roots and spore blossoms (above); vines and lichen (an attached face) | Add the support block or flip `facing`/`hanging` |
| `plant-soil` | warn | Flowers, saplings, grass or ferns not on a dirt-family block; crops not on farmland; nether wart not on soul sand; cactus not on sand. They pop off on the next block update | Put them on proper soil, or use `potted_*` for decor |
| `fluids` | warn | Sources and flowing fluid, plus fluid cells with air beside or below them. Those flow in game | Contain fluids with blocks on every side and below |
| `palette-size` | warn | Fewer than 4 block ids in a build over 500 blocks (monotone), or more than 40 ids (noisy) | Use 4-10 related materials |
| `dominant-block` | warn | One block id is over 70% of all blocks | Break it up with variants, trim courses or a different floor |
| `detail-ratio` | warn | Detail ratio below 0.08 in a build over 500 blocks | Add stairs, slabs, walls, trapdoors, lanterns and plants |
| `lighting` | warn | Over 10% of roofed walkable spots have block light 0 (approximate) | Add lights so no floor spot is more than about 6-7 blocks from a torch or lantern |
| `unlit-lights` | info | Light blocks whose state emits nothing | Set `lit=true`, or waterlog sea pickles |

### Stair Shape Logic

For stairs facing `F` and half `H` (left means counter-clockwise from `F`, so north to west):

1. Look at the block in direction `F`. If it is stairs with the same half and a perpendicular
   facing `G`, the shape is `outer_left` when `G` is left of `F`, otherwise `outer_right`. This
   holds only if the block in direction `-G` is not stairs with the same facing and half.
2. Otherwise look at the block behind (`-F`). If it is stairs with the same half and a
   perpendicular facing `G`, the shape is `inner_left` or `inner_right` the same way. This holds
   only if the block in direction `G` is not stairs with the same facing and half.
3. Otherwise the shape is `straight`.

Validation against all 1,180 vanilla 1.21 structure files:

- Village pieces (483 files, 5,216 stairs, authored in game) report 12 mismatches. 8 border
  jigsaw blocks that the game replaces after placement. 4 are deliberately set corner stairs in a
  desert farm.
- The ancient city, bastion, end city, trial chamber, mansion, outpost, igloo and ruin pieces
  (about 8,000 stairs) report 0.
- Shipwreck files store `outer_right` on nearly every stair (2,828 of 2,850), and the check flags
  them correctly.

## Score

```bash
node scripts/inspect.mjs build.nbt --score                 # composition vs all builds of the same size class
node scripts/inspect.mjs build.nbt --style medieval        # composition vs medieval builds (of that size if N >= 8)
node scripts/inspect.mjs build.nbt --style japanese --json # everything as JSON (result.score)
```

The scorecard lists out-of-band metrics first, worst first, each with its value, band and a one-line
fix. After that comes a compact list of in-band metrics. The 0-100 total is the mean of per-metric
scores. A metric in band scores 1, and the score falls off with distance outside the band (to 0
at 1.5 IQR-widths for composition, or at the metric's `soft` distance for geometry). Use the total
to track iterations, and fix the lowest lines first.

```text
Scorecard: 86/100, 14 of 24 metrics in band (composition vs medieval x S (<=32), N=62 human builds; ...)
Outside band (worst first):
  HIGH  distinct block ids         80  above band 25-46        broader than most builds of this style: ...
  LOW   top-1 block share       11.4%  below band 16.4-28.6%   no dominant material: give the main wall or roof block more weight
  LOW   partial blocks          25.7%  below band 33.7-48.3%   add stair/slab/trapdoor/fence/wall detail (roof edges, sills, frames, railings)
        detail mix: stairs 4.9% (band 10.1-19.5%)
  LOW   glass                      0%  below band 0.1-2.8%     few windows: add glass panes set one block into the wall
In band:
  horizontal logs 37.4% (21.5-55.9%); L* mean (lightness) 44 (40.2-45.9); roof vs wall contrast 51.9 L* (>= 15 L*); ...
```

(That is GeminiTay's Hermitcraft S8 cottage shop against medieval norms. Showcase builds often sit
above the band on palette breadth and upside-down stairs. Those hints are worded as checks, not
faults.)

### Composition Metrics (Human-Build Norms)

The composition metrics use the definitions of the 2026-10-24 corpus study of 1,212 human builds.
Its bands live in `scripts/lib/data/build-norms.json`, as `[P25, median, P75]` per style and per
size class. The band is the interquartile range: below P25 usually reads as plain, above P75 as busy.

- **Built blocks**: non-air minus terrain and technical blocks. Terrain covers grass_block, the
  dirt variants, raw stone, deepslate, tuff, granite, diorite, andesite, sand, gravel, water, lava,
  snow, ice, clay, mud, netherrack, end_stone, short and tall grass, ferns and seagrass (full list
  in the norms file). Technical blocks are structure_void, jigsaw, barrier, light, structure_block
  and moving_piston. All ratios below are over built blocks.
- **distinct block ids** (states ignored). **Top-1 / top-5 share**: the most-used block, and the
  five most-used.
- **Partial blocks**: stairs + slabs + walls + fences/gates + trapdoors + panes/bars +
  buttons/plates + carpets. When the total is out of band, a **detail mix** line shows which type
  is out of its own band, e.g. `stairs 4.9% (band 10.1-19.5%)`.
- **Upside-down stairs**: the share of stairs with half=top (needs at least 10 stairs).
  **Horizontal logs**: the share of logs, wood, stems and hyphae with axis x or z (needs at least 10).
- **Lights per 1k blocks**: blocks flagged emissive in `block-colors.json`, copper torches and
  lanterns, end rods, and lit lamps, candles, campfires, bulbs and furnaces. Lava, fire and magma
  are not counted.
- **Glass** is any id containing `glass`. **Leaves** is any id ending in `_leaves`.
- **L\* mean / L\* std** (value contrast) and **chroma**: CIELAB from `block-colors.json`, weighted
  by block count. The P10-P90 L\* spread is shown as detail.
- **Terrain share** is terrain as a share of all non-air blocks, i.e. the ground plug.

Band selection:

- With `--style S`, the band comes from the style x size-class bucket when that bucket has N >= 8.
  Otherwise the style's all-size band is used.
- Without `--style`, the band comes from all 1,212 builds in the same size class.
- Size classes use the longest side of the structure: S <= 32, M 33-64, L 65-128, XL > 128.
- Style aliases: `asian`/`chinese` mean `japanese`, `church`/`cathedral` mean `gothic`, `tree`
  means `organic`, `tudor`/`viking`/`nordic` mean `medieval`, `rustic`/`survival` mean `house`.

The implementation was checked against the study. Run over the 60 curated corpus files (converted
to `.nbt`), it reproduces the study's "CURATED 60" row:

| Metric | inspect.mjs median [P25-P75] | study |
|---|---|---|
| distinct ids | 74.5 [45-106] | 74 [45-106] |
| top-1 % | 22.7 [16.6-35.6] | 23 [17-36] |
| top-5 % | 63 [47-74] | 63 [47-74] |
| partial % | 27.9 [17.6-38.0] | 28 [18-38] |
| upside-down stairs % | 48.2 [36.7-59.0] | 48 [37-59] |
| horizontal logs % | 37.4 [20-60.7] | 37 [20-61] |
| lights /1k | 12.1 [5.7-18.6] | 12.0 [5.7-18.6] |
| glass % | 0.75 [0.1-2.4] | 0.7 [0.1-2.4] |
| L\* mean | 46.6 [41.3-54.5] | 47 [41-55] |
| L\* std | 14.8 [11.9-21.5] | 14.8 [11.9-21.5] |
| chroma | 17.6 [12.2-21.8] | 17.6 [12.2-21.8] |
| terrain % | 26.4 [12.4-45.4] | 26 [12-45] |

The small differences come from rounding, and from `inspect.mjs` replacing jigsaws with their
`final_state` where the study skips them.

### Geometry Metrics

These measure what block counts cannot. They use exposed faces: faces whose neighbor is outside
air, found by a flood fill from beyond the build, so interiors are ignored.

| Metric | What it measures | Target |
|---|---|---|
| roof vs wall contrast | \|L\*\| between the dominant roof material and the dominant wall-field material. Roof = column-top stairs/slabs at least 3 above the base and not on terrain. Wall field = full opaque non-terrain cubes on vertical surfaces at least 2 tall (drops stepped-roof risers) | >= 15 L\* (guide: >= 20) |
| trim vs wall-field contrast | Largest \|L\*\| between the dominant wall block and any other wall block covering >= 5% of wall faces | >= 15 L\* (guide: >= 30) |
| speckle | Share of wall faces whose block differs from all of its 3-4 in-plane neighbors (salt-and-pepper) | <= 12% |
| splatter | Share of wall faces that jump more than 2 value steps from at least half of their in-plane neighbors. Steps are the wall palette sorted by L\*, with ids within 4 L\* sharing a step | <= 8% |
| stripes | Share of wall faces in repeated 1-high bands: block B between two rows of A, 4 or more wide, on 3 or more rows of the same plane | <= 3% |
| facade relief | Share of wall faces with a depth change within 3 blocks along the plane: an opening or edge, a non-cube block, or something in front | >= 90% |
| wall faces in flat runs > 8 | Share of wall faces in horizontal runs of more than 8 flat full cubes, whatever the material. The longest run is shown as detail | <= 25% |
| roof edges that overhang | Of the roof's lower-edge cells (the downslope side of stairs, any open side of slabs), the share with open outside air below. Up to 3 partial blocks (soffit stairs, brackets) are looked through | >= 40% |
| dark roofed floor spots | Roofed walkable spots with block light 0 (the summary's estimate) | <= 25% |
| blocks connected to the base | Share of blocks in parts (26-connected) that touch the lowest layer | >= 97% |
| base columns over air | Share of columns whose lowest block sits 1-3 above the base layer with air below | <= 10% |

Metrics without enough data are `n/a`: fewer than 30 wall faces, fewer than 8 roof cells or 6 roof
edges, fewer than 10 roofed floor spots, or fewer than 10 stairs or logs.

### Calibration

Geometry targets were set from the 60 curated community builds (the visually vetted showcase set,
converted with `scripts/convert.mjs`). The 152 vanilla village houses and the celestial forge
example are shown for reference. Cells are P10 / median / P90, then the share of builds that pass
the target.

| Metric | Target | Curated 60 | Village houses | Forge |
|---|---|---|---|---|
| roof vs wall contrast | >= 15 | 1.5 / 15.7 / 52.5 (53%) | 0.1 / 2.8 / 18.3 (20%) | n/a |
| trim contrast | >= 15 | 5.1 / 31.3 / 73.8 (71%) | 1.6 / 15.5 / 37.5 (58%) | 70.9 |
| speckle % | <= 12 | 0 / 4.0 / 22.2 (71%) | 0 / 0 / 3.5 (97%) | 12.0 |
| splatter % | <= 8 | 0 / 2.3 / 13.4 (73%) | 0 / 0 / 0 (100%) | 5.7 |
| stripes % | <= 3 | 0 / 0 / 0 (100%) | 0 / 0 / 0 (100%) | 0 |
| facade relief % | >= 90 | 89.7 / 99.9 / 100 (88%) | 100 / 100 / 100 (100%) | 99.9 |
| flat runs > 8 % | <= 25 | 0 / 10.1 / 40.8 (68%) | 0 / 0 / 21.5 (94%) | 1.4 |
| roof overhang % | >= 40 | 15.7 / 53.8 / 91 (66%) | 0 / 90.6 / 100 (65%) | n/a |
| dark roofed spots % | <= 25 | 0 / 11.6 / 61.1 (73%) | 0 / 0 / 0 (98%) | 40.2 |
| connected to base % | >= 97 | 99.9 / 100 / 100 (98%) | 100 / 100 / 100 (100%) | 88.2 |
| base columns over air % | <= 10 | 0 / 0 / 20.6 (83%) | 0 / 0 / 26.8 (78%) | 82.1 |
| **overall score** | | 79 / 87 / 94 | 72 / 85 / 93 | 82 (73 with `--style fantasy`) |

Synthetic agent-style failures, built with grass, a 20x14 hollow box and a flat roof, score
62-73:

| Build | Score | Worst lines |
|---|---|---|
| plain stone-brick box | 63 | top-1 100%, flat runs 100%, dark spots 100%, L\* std 0 |
| per-block random stone mix | 65 | speckle 42%, flat runs 100%, partial 0% |
| alternating plank rows | 73 | stripes 70%, flat runs 100%, relief 74% |
| gable roof on the wall line, same material | 62 | roof overhang 0%, roof contrast 0.1 L\* |

Notes:

- Village houses are tiny, and many are n/a on the wall metrics. Vanilla houses often roof with the
  same wood as their walls, which is why roof contrast passes only 20%.
- The forge is a floating, glass-heavy build, which explains the grounding and glass flags.
- Buried pieces (trial chambers) and builds with large stone terrain fail flat-run and relief
  checks harmlessly.

### Norms File

`scripts/lib/data/build-norms.json` has these top-level keys: `version`, `description`,
`sizeClasses`, `metrics` (label and unit per key), `styleAliases`, `definitions` (terrain,
technical and light id lists), and `groups`.

- **Groups:** `medieval`, `house`, `castle`, `fantasy`, `japanese`, `gothic`, `modern`, `ship`,
  `statue`, `organic`, `terrain`, `other`, `curated` and `all`.
- **Each group** holds `{label, n, metrics, sizes}`. `metrics` maps a key to
  `[P25, median, P75]`, with shares in percent. `sizes` holds the same shape per size class, for
  buckets with N >= 5.
- **Source:** the corpus study's per-build `metrics.json`, summarised with linear-interpolated
  quantiles. Every number matches the study's tables.

## JSON

`--json` prints one object with these keys:

- `file`, `compression`, `dataVersion`, `packAvailable`
- `summary`: `size`, `bounds`, `blocks`, `blockIds`, `blockStates`, `palette[]` (each row
  `{id, category, count, states, percent}`), `paletteStates[]` with `--states`/`--all`,
  `categories`, `detailRatio`, `entities`, `file` stats
- `lighting`: sources, unlit, walkable, dark, darkPockets (summary or `--checks` only)
- `slices[]`: `{axis, value, columns, rows, blocks, lines[]}`, plus `legends` per view
  (`{glyph, labels, count}`)
- `profile[]`: `{y, blocks, coveragePercent, distinct, detailPercent, dense, top[]}`
- `find[]`: `{query, mode, total, bounds, states[], positions[]}`
- `checks[]`: `{id, level, message, count?, examples?, hint?}`
- `score`: `{overall, inBand, scored, norms: {name, style, size, n, builtBlocks, maxDim}, metrics[],
  detailMix[], raw}`. Each metric is `{id, group: composition|geometry, label, value, unit?, band,
  median?, position?, status: ok|low|high|n/a, score, hint?, detail?}`.

## Limits

- The lighting estimate ignores sky light and treats slabs and stairs as see-through.
- Wall `low`/`tall` and `up` are not compared, only whether a side connects at all. Wall and
  fence checks do not treat non-cube neighbors as solid, except straight or inner stair backs and
  open trapdoor panels.
- Exterior air for `flat-walls` comes from a flood fill. On huge sparse files (over 48M cells in
  the bounds) a 64-block ray per face is used instead.
- Checks know nothing about the world the build is placed in beyond the y=0 ground rule.
