# Inspecting Builds as Text

`scripts/inspect.mjs` reads a vanilla structure `.nbt` and prints exact, block-level facts about it:
a summary, ASCII slices, a per-layer profile, block search, and a quality lint. Renders show the
overall look. This tool shows what is actually stored at each coordinate. Use it after every build
to check geometry, palettes, block states and common mistakes before you look at renders.

```bash
node scripts/inspect.mjs minecraft-builds/my-build/my-build.nbt            # summary
node scripts/inspect.mjs minecraft-builds/my-build/my-build.nbt --checks   # lint
node scripts/inspect.mjs minecraft-builds/my-build/my-build.nbt --layers 0-6 --range 0,0,20,20
```

It needs only Node and the installed `@mattzh72/lodestone` package. The bundled default resource
pack provides block-id validation, property-value validation and model-based full-cube detection.
It reads gzip, zlib or uncompressed files of 500k+ blocks in about a second.

## Typical Loop

1. `node scripts/run-build.mjs recipe.mjs --out-dir minecraft-builds/x`
2. `node scripts/inspect.mjs minecraft-builds/x/x.nbt --checks`: fix every `WARN` that is not
   intentional.
3. `--slice` / `--layers` the areas you changed to confirm the exact geometry (window spacing,
   roof stair facing, door placement, symmetry).
4. Render with `scripts/render.mjs` for the overall look.

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

## Limits

- The lighting estimate ignores sky light and treats slabs and stairs as see-through.
- Wall `low`/`tall` and `up` are not compared, only whether a side connects at all. Wall and
  fence checks do not treat non-cube neighbors as solid, except straight or inner stair backs and
  open trapdoor panels.
- Exterior air for `flat-walls` comes from a flood fill. On huge sparse files (over 48M cells in
  the bounds) a 64-block ray per face is used instead.
- Checks know nothing about the world the build is placed in beyond the y=0 ground rule.
