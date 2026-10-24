# Palettes: value, hue, texture, ramps

How to choose blocks that read well in a render: value structure first, then hue, then texture.
Every number here was measured from the renderer's textures (see [block-colors.md](block-colors.md));
every palette at the end was checked with `kit.colors.paletteReport`. For which stairs, slabs and
walls exist per material, see [materials.md](materials.md).

**The six rules**

1. **Value before hue.** Decide what is dark, mid and light before choosing colours. Roof vs wall
   |ΔL\*| ≥ 20, frame vs wall field ≥ 20 (30+ for crisp timber framing), whole palette spans ≥ 30 L\*.
2. **One hue family + one accent.** Large surfaces stay low-chroma (C\* ≤ 35) and analogous; one
   contrasting accent at ≤ 10 % of the surface, at focal points only.
3. **One busy texture per view.** Pair a busy block with calm ones; never two busy blocks side by side.
4. **3–6 blocks carry the build.** Texture variants inside one surface count as that surface.
5. **Gradients use neighbours only.** Order blocks light → dark, apply in clusters, never skip a step.
6. **Check, then render.** `paletteReport` before building; look at the render (and its grayscale)
   after.

## `kit.colors` toolbox

`kit.colors` is `scripts/lib/kit/colors.mjs`. Shortcuts: `kit.colorOf`, `kit.nearestBlock`,
`kit.ramp`, `kit.sortByLightness`, `kit.contrast`, `kit.paletteReport`. It reads
`scripts/lib/data/block-colors.json` (one entry per block id) and caches everything. ΔE00 is the CIEDE2000 colour difference: about 1 is
barely visible, 3–6 is a texture-mix step, over 15 is a hard edge.

| Call | Returns |
|---|---|
| `colorOf(id)` | `{ id, side, top, bottom, avg, lab, L, C, h, family, noise, full, transparent, emissive, tags, material }` or `null` |
| `nearest(hexOrLabOrId, { full, face, kinds, include, exclude, require, count })` | closest building block `{ id, dE, side, L }` (array when `count > 1`) |
| `ramp(fromId, toId, steps, { kinds, include, exclude, require, smoothness, via, face, matchTexture, details })` | block ids forming the smoothest perceptual ladder (`details: true` → `{ ids, steps, L }`) |
| `sortByLightness(ids, { lightestFirst = true, face })` | ids sorted by L\* |
| `contrast(a, b)` | `{ dL, absL, dE, reads }`, where `reads` is `'same' \| 'texture-mix' \| 'subtle' \| 'distinct' \| 'strong'` |
| `paletteReport(idsOrRoles)` | `{ blocks, value, hue, busy, pairs, warnings, notes, ok }` |

Fields: `L` = CIELAB lightness 0–100, `C` = chroma (0 grey, 80 concrete-vivid), `h` = hue angle,
`family` = colour family as in block-colors.md, `noise` = texture busyness (std-dev of per-pixel L\*/100).

- **Defaults exclude** technical blocks, ores, glazed terracotta, `infested_`/`waxed_`/`suspicious_`
  look-alikes, functional blocks (furnaces, bookshelves, pumpkins...), light sources, live coral, and
  creative-only blocks. `ramp` also excludes terrain-topped blocks (`grass_block`, `podzol`, nylium).
- **`kinds`** restricts results to blocks with any of these tags, and opts excluded tags back in.
  Tags: material kinds `stone wood metal earth nether end ocean decorative`; colour families
  `neutral brown red orange yellow green teal blue purple pink`; and `concrete concrete_powder wool
  terracotta glazed planks log glass leaves ore functional emissive partial gravity full`.
  **`include`** only opts in (`include: ['glazed']`).
- **`exclude`** takes ids, globs (`'*_wool'`), a RegExp or a predicate.
  **`require: ['stairs', 'slab']`** keeps only blocks whose own material has those shapes (needed
  for roofs and for `b.texture` on shaped blocks).
- **`face: 'top'`** matches top faces (floors, paths, roofs seen from above).

```js
kit.colors.nearest('#8a6a50')                                    // { id: 'minecraft:mud_bricks', dE: 1.15, ... }
kit.colors.nearest('terracotta', { require: ['stairs', 'slab'] }) // bricks (ΔE00 4.6): roof stand-in for a stair-less block
kit.colors.nearest('white_concrete', { kinds: ['stone'], count: 3 }) // calcite 4.1, polished_diorite 5.4, diorite 6.6
kit.colors.contrast('stone_bricks', 'spruce_planks')              // { dL: 12.8, dE: 21.3, reads: 'distinct' }
kit.colors.contrast('oak_planks', 'jungle_planks')                // { dL: 4.2, dE: 9.2, reads: 'subtle' }: don't put these in adjacent roles
kit.colors.sortByLightness(['spruce_planks', 'calcite', 'deepslate_tiles', 'stone_bricks'])
// ['calcite', 'stone_bricks', 'spruce_planks', 'deepslate_tiles']
```

## Value structure

Value (L\*) is what survives in a small screenshot. Hue and texture vanish first with distance; a
build whose blocks all sit within ~20 L\* reads as one blob. Decide the dark/mid/light roles first.

### Role targets

| Pair | Minimum (`paletteReport` warns below) | Target | Notes |
|---|---|---|---|
| roof vs wall field | \|ΔL\*\| 20 | 25–40 (30+ for small or distant builds) | roofs render lighter than their texture: stair tops face the sun |
| frame (posts, beams) vs wall field | 20 | 30+; timber framing 40–60 | the strongest contrast on the building |
| trim (sills, bands, cornice) vs wall | 12 | 15–30 | or same value with a different shape: stairs, slabs, a 1-block step |
| foundation vs wall | 8 | 10–25 darker under light/mid walls | under dark wood/brick walls a lighter grey stone base is normal |
| accent vs wall | ΔE00 15 | ΔE00 25+, ≤ 10 % of the surface | door, shutters, banners, flower boxes, a copper cupola |
| roof vs frame | ΔE00 6 | different hue or texture | dark roof + dark frame is fine if one is brown and one grey |
| blocks mixed inside one surface | — | ΔE00 2–6, \|ΔL\*\| ≤ 8 | texture mix, not separate elements |
| whole palette (max − min L\*) | 25 | 35–60 | community median 41 (top 500 blockpalettes.com palettes) |

```
   value map of a timber house (L*)
            /\           roof        deepslate_tiles   23   darkest mass
           /  \
          /    \
   +=====+======+=====+  top plate   dark_oak_log      20   frame: |ΔL*| 55 vs wall
   |  F  | wall |  F  |  wall field  white_terracotta  75   lightest, calm
   |  r  |  75  |  r  |
   +=====+======+=====+  sill beam   dark_oak_log      20
   |    plinth 33-51   |  foundation  stone_bricks -> cobbled_deepslate (ramp)
   +-------------------+
```

### Value archetypes

Pick one per building:

- **Light walls, dark roof, dark frame.** The most legible and most common: Tudor, Japanese,
  Nordic, alpine, cottages. Example: `white_terracotta` 75 / `dark_oak_log` 20 / `deepslate_tiles` 23.
- **Dark walls, light trim.** Brick townhouse with quartz trim (`bricks` 47 / `smooth_quartz` 92),
  dark gothic with pale tracery, nether fortress with quartz bands.
- **Mid walls, darker roof, lightest trim.** Mediterranean and classical: `smooth_sandstone` 86
  walls, `granite` 48 roof, quartz trim.
- **Monochrome light with dark voids.** Santorini, modern white, marble temples. Here contrast comes
  from recessed windows, doors and colonnade shadows. Requires depth, or the render is a white blob.
- **All dark.** Nether, dwarven, dark fantasy. Needs one light element (quartz, polished andesite,
  basalt, gold, light blocks) that occupies 10–20 % of the facade, plus light pools.

### Reading values in renders

- Lodestone's lighting is uniform enough to judge by. A measured south-facing wall renders at about
  77 % of the texture's brightness with a slight cool cast (R 0.76, G 0.78, B 0.84). Top faces
  render brighter than sides.
- Because of that, a roof of stairs (mostly top faces) reads **lighter** than its block's L\*.
  Pick roof blocks a step darker than you think.
- Glass and open doorways read dark from outside. Treat windows as dark accents in the value map.
- To check value structure, look at the render in grayscale. With PIL:
  `python3 -c "from PIL import Image; Image.open('south.png').convert('L').save('south-gray.png')"`.
  Then compare roof, wall, frame and base. If two roles merge in grayscale, change one block's value,
  not its hue.

```js
const P = { foundation: 'cobbled_deepslate', wall: 'white_terracotta', frame: 'dark_oak_log', roof: 'deepslate_tiles', accent: 'bricks' }
const report = kit.colors.paletteReport(P)        // role-aware: checks the targets above
if (!report.ok) throw new Error(report.warnings.join('\n'))
// A mixed surface is a list: { wall: ['stone_bricks', 'cracked_stone_bricks'], ... } (averaged)
```

Typical warnings and fixes:

| Warning | Fix |
|---|---|
| `wall L*57 vs roof L*57: \|ΔL*\| 0 < 20` | darker roof: `spruce` 38 → `dark_oak` 20 / `deepslate_tile` 23 |
| `wall L*57 vs frame L*38: \|ΔL*\| 19 < 20` | `oak_log` (38) frame on `oak_planks` (57) is weak: use `dark_oak_log` (20) or `stripped_birch_log` (72) |
| `foundation (L*53) is lighter than the wall` | `cobbled_deepslate` 33 / `deepslate_bricks` 30 under light and mid walls |
| `X and Y are too similar to read apart` | merge them into one surface (a list role) or replace one |
| `value spread is only 19 L*` | add a dark roof/base or a light trim |

## Hue harmony

### The rule

**Analogous base + one complementary accent.** Walls, roof and foundation share one hue family or
are neutral, with C\* ≤ 35. One accent in the opposite hue goes at focal points and covers ≤ 10 %
of the surface. At most one vivid (C\* > 45) hue family per building.

Hue angles below are CIELAB `h` from `colorOf(id).h`. These are not the artist's RYB wheel.

| Hue band | Lab hue | Building blocks (L\* C\*) |
|---|---|---|
| reds / brick | 0–42 | `bricks` 47/26, `red_terracotta` 37/42, `mangrove_planks` 31/32, `nether_bricks` 11/12, `granite` 48/24 |
| oranges / browns | 42–75 | `terracotta` 46/33, `acacia_planks` 47/46, `copper_block` 55/43, `spruce_planks` 38/27, `dirt` 44/26 |
| yellows / sands | 75–113 | `oak_planks` 57/33, `sandstone` 82/26, `birch_planks` 72/30, `bamboo_planks` 71/50, `end_stone_bricks` 87/32 |
| greens | 113–160 | `moss_block` 43/38, `weathered_copper` 59/30, `green_terracotta` 34/25, `mossy_cobblestone` 49/14 |
| teals / cyans | 160–225 | `oxidized_copper` 61/33, `prismarine` 62/24, `dark_prismarine` 36/19, `warped_planks` 40/21 |
| blues | 225–308 | `lapis_block` 30/46, `light_blue_terracotta` 47/18 (lavender-grey), `blue_ice` 69/48 |
| purples / magentas | 308–345 | `purpur_block` 58/30, `amethyst_block` 49/56, `crimson_planks` 28/26, `purple_terracotta` 36/23 |
| pinks (light reds and magentas) | 345–40, L\* ≥ 55 | `cherry_planks` 77/19, `stripped_cherry_log` 67/28, `pink_wool` 70/40 |

### Neutrals have temperature

The b\* value is the warm(+)/cool(−) axis.

- **Warm whites:** `quartz_block` (b\* +4), `mushroom_stem` (+6), `bone_block` (+9),
  `smooth_sandstone`.
- **Neutral whites:** `calcite` (+2), `snow_block` (−1).
- **Cool white:** `white_concrete` (−1).
- **Greys:** `stone`/`smooth_stone`/`andesite` are dead neutral (b\* 0). `tuff` and the tuff family
  lean green (h 116–135). `clay` is blue (b\* −7). `deepslate` and `basalt` are slightly cool;
  `blackstone` is purple-black.
- **Two neutrals of the same temperature** read as one material family.
- **Warm wood + cool stone** is the most popular pairing in community palettes: spruce + deepslate
  tiles/bricks, spruce + stone bricks, dark oak + deepslate tiles.

### Complementary accents that work in Minecraft

| Base | Accent | Example |
|---|---|---|
| warm wood, terracotta, sand (h 45–100) | teal / turquoise | `oxidized_copper`, `cyan_terracotta` doors, `prismarine` |
| brick red (h 40) | teal-green | factory `bricks` + `oxidized_copper` trim (Industrial palette) |
| yellow sandstone (h 96) | deep blue | `lapis_block` inlays (Desert palette, vanilla desert pyramid uses `blue_terracotta`) |
| purpur / amethyst (h 310–330) | pale yellow-green | `end_stone_bricks` (vanilla End city) |
| imperial red walls | teal brackets + yellow roof | Imperial Chinese palette |
| cool teal (warped, prismarine) | warm orange light | `shroomlight`, `gold_block` |

### Hue clash

`paletteReport` flags two saturated blocks (C\* ≥ 30) that sit 70–150° apart in hue at similar
value (|ΔL\*| < 20). Such pairs are neither analogous nor complementary; they fight. It also flags
three or more saturated hue groups (more than 40° apart).

Fixes:
- Desaturate one of the two: `light_blue_terracotta` instead of `lapis_block`, `granite` instead of
  `red_terracotta`.
- Separate their values by ≥ 20 L\*.
- Drop one.

Example: `oxidized_copper` next to `stripped_birch_log` (both C\* ~32, 75° apart, L\* 61 vs 72)
clashes. `dark_prismarine` (C\* 19, L\* 36) gives the same teal idea without the clash.

### Chroma budget

- Concrete is the most saturated (C\* up to 80) and the flattest texture in the game, so large
  concrete or wool walls read as plastic in rustic, medieval and fantasy styles. Use concrete for
  modern, sci-fi and whimsical builds, and break it with joints every 3–6 blocks.
- Texture-preserving stand-ins:

  | Instead of | Use |
  |---|---|
  | white concrete | `calcite`, `white_concrete_powder`, `diorite` |
  | red | `bricks`, `mangrove_planks`, `red_terracotta`, `granite` |
  | blue | `light_blue_terracotta` (muted), `lapis_block` (vivid, textured), `dark_prismarine` (teal) |
  | green | `moss_block`, `green_terracotta`, `weathered_copper` |
  | yellow | `bamboo_planks`, `hay_block`, `smooth_sandstone` |
  | purple | `purpur_block`, `purple_terracotta`, `amethyst_block` |

- `kit.colors.nearest(hex, { exclude: '*_concrete' })` finds them for any colour.

### Names lie

`white_terracotta` is peach-cream (`#d2b2a1`). `cyan_terracotta` is a neutral grey (C\* 2).
`light_blue_terracotta` is lavender-grey. `pink_terracotta` is dusty red. `spruce_log` bark (L\* 17)
is darker than `dark_oak_log` (20), and `cherry_log` bark (16) is the darkest log. Always check
`colorOf(id).side`.

## Texture busyness

`noise` (busyness) = std-dev of per-pixel L\*/100 in the side texture.

| Class | noise | Blocks | Use |
|---|---|---|---|
| flat | < 0.015 | all concrete (0.002–0.004), all terracotta (0.005–0.009), `snow_block`, `smooth_quartz`, `brown_mushroom_block` | modern, signage, pixel art; plastic at scale |
| smooth | 0.015–0.03 | `quartz_block`, `smooth_sandstone`, `smooth_red_sandstone`, `bone_block`, stripped mangrove/dark oak/acacia/cherry/spruce logs, `clay`, `mushroom_stem` | calm wall fields, crisp trim |
| subtle | 0.03–0.08 | `stone` 0.042, `stone_bricks` 0.073, `calcite`, `andesite`, sandstones, `mud_bricks`, `deepslate_tiles`, spruce/dark oak planks, wool | the sweet spot for large surfaces |
| busy | 0.08–0.10 | `oak_planks` 0.099, `jungle_planks`, `deepslate_bricks`, `polished_andesite`, `tuff` 0.082, `tuff_bricks`, `prismarine` | fine as one surface, not two side by side |
| strongly textured | ≥ 0.10 | `cobblestone` 0.115, `diorite` 0.127, `birch_log` 0.204, `glowstone` 0.237, `coarse_dirt`, `podzol`, `amethyst_block`, `warped_planks`, `raw_iron_block` | plinths, rubble, small accents; noise on big walls |

Rules:

- **One strongly textured block per view.** `paletteReport` warns when two or more (noise ≥ 0.10)
  are in a palette. Cobblestone plinth + birch-log frame + diorite trim = noise.
- **Busy foundation, calm wall, crisp frame.** This is the default distribution: rough at the base,
  calm in the field, clean lines on the structure.
- **Frames and trims are not mixed.** Keep posts, beams and string courses one block (at most 15 %
  of a close variant). Clean lines read as structure; noisy lines read as damage.
- **Mix textures of similar value; mix values of similar texture.** `stone_bricks` + `andesite`
  + `cracked_stone_bricks` (ΔE00 2–4) is a texture mix. `stone_bricks` + `deepslate_bricks` is a
  value step: put it on a different plane or role.
- **Flat blocks need depth or joints.** A 6 × 6 field of concrete or terracotta needs a recess,
  a slab band or a pilaster.
- **Similar-value woods side by side look like a mistake.** `oak_planks`/`jungle_planks`
  (ΔE00 9, ΔL\* 4) or `spruce`/`mangrove`. Two woods per building are fine when they are ≥ 15 L\*
  apart and in different roles (dark frame, light infill).

## The 3–6 block rule

- **3–6 block ids carry ~80 % of a building.** The worked example below: the top 6 ids cover 96 %.
  Typical split by role: foundation 1–2, wall field 1–3 (texture mix), frame 1, roof 1, plus 1–2
  accents. Mojang's structures and top community palettes both sit here.
- **Proportions:** 60 % dominant / 30 % secondary / 10 % accent (convention). Inside one surface:
  dominant 60–75 %, 1–2 transition blocks 20–35 %, worn variants 5–15 % at the base and corners.
  Never 50 / 50.
- **Not counted:** glass, doors, trapdoors, lanterns, plants and other detail blocks.
- **Stairs, slabs and walls of a role's material count as that role.** Pick roof and trim
  materials that have them (`require: ['stairs', 'slab']`).
- `paletteReport` warns above 6 distinct ids. Count a finished build like this:

```js
const counts = {}
for (const [, , , block] of b.entries()) counts[block.name] = (counts[block.name] ?? 0) + 1
const total = Object.values(counts).reduce((s, n) => s + n, 0)
const top6 = Object.values(counts).sort((a, c) => c - a).slice(0, 6).reduce((s, n) => s + n, 0)
// top6 / total should be >= 0.8
```

- **Share one palette across a settlement**, varying proportions and one accent per house.
  Cohesion beats individually pretty houses.

## Ramps and gradients

A ramp is an ordered list of blocks, light → dark, whose neighbours differ by a small, even step
(ΔE00 3–8, ΔL\* 3–10). Use one for weathering, value transitions on tall walls, roofs and terrain.

### Building a ramp

```js
const stone = kit.colors.ramp('calcite', 'blackstone', 7, { kinds: ['stone', 'nether'] })
// calcite > diorite > smooth_stone > stone_bricks > polished_basalt > cracked_deepslate_bricks > blackstone
const info = kit.colors.ramp('polished_andesite', 'blackstone', 'auto', { details: true })
// ids: polished_andesite, cracked_stone_bricks, polished_tuff, polished_basalt, basalt, mud, blackstone
// steps (ΔE00): 6.6 8.1 8.2 5.5 5.2 7.4    L*: 56 50 43 38 31 25 15
```

- **Endpoints:** pass the light block first to get light → dark. Endpoints can be any block; the
  steps are full opaque building blocks (defaults above).
- **`steps`:** a number gives the exact count (it can come back shorter when nothing lies between).
  `'auto'` picks the most even count between 4 and 10.
- **`kinds`** keeps one material world: `['stone']`, `['wood']`, `['planks']`,
  `['concrete', 'concrete_powder', 'terracotta']`. Without it a quartz → deepslate ramp can pick
  `birch_log` because the colour fits.
- **`require: ['stairs', 'slab']`** when the ramp feeds `b.texture` over stairs and slabs, or a roof:
  `ramp('stone_bricks', 'deepslate_tiles', 4, { kinds: ['stone'], require: ['stairs', 'slab'] })` →
  `stone_bricks, polished_tuff, cobbled_deepslate, deepslate_tiles`.
- **`via: ['moss_block']`** forces a waypoint. Example: grass green → moss → dark,
  `ramp('lime_wool', 'dried_kelp_block', 7, { via: ['moss_block'] })` →
  `lime_wool, bamboo_block, green_concrete_powder, moss_block, green_concrete, green_terracotta,
  dried_kelp_block`.
- **Keep busy blocks out** with a predicate: `exclude: (id, c) => c.noise >= 0.1`. Expect gaps. Between
  `smooth_stone` (L\* 65) and `calcite` (89) the only stones are the speckled diorites (76–78), so a
  calm light-grey ladder jumps 17 ΔE00 there; bridge it with `white_concrete_powder` or
  `light_gray_concrete_powder`, or accept diorite as a small share.
- **`smoothness`** (0–1, default 0.5): higher keeps the hue on the straight line and spaces steps
  evenly; lower allows hue detours for more even value steps.
- **`matchTexture`** (default true) adds a 4 ΔE00 penalty for stepping between flat (concrete,
  terracotta) and textured blocks, so stone ladders stay stone.
- **Read `steps` with `details: true`.** Anything over ~12 is a visible band: dither those two
  blocks, add a block by hand, or change material there. [block-colors.md](block-colors.md#gradient-ladders)
  lists precomputed ladders and the known gaps (no full block between light blue and deep blue;
  sparse mid-dark greens).
- **Copper is a hue ladder at constant value** (`copper_block` 55 → `exposed_copper` 56 →
  `weathered_copper` 59 → `oxidized_copper` 61). Use the fixed sequence, not `ramp`, and write
  `waxed_*` ids so it does not oxidise further.

### Applying a ramp

| Tool | Use for | Ramp order |
|---|---|---|
| `kit.gradient(stops, { axis, from, to, dither })` | bands along an axis or a field: walls darker at the base, towers, terrain by height, roofs bleaching upward | stops run from `from` to `to`: for dark at the bottom pass `[...ramp].reverse()` |
| `b.texture(a, c, ramp, opts)` | weathering with logic: darker at the base, exposed corners, drip streaks; lighter at `focus` points; anti-splatter keeps neighbours within `maxStep` (2) steps | light → dark |
| `kit.palette({ id: weight })` | one surface with gentle variation: 2–3 **adjacent** ramp steps at 60/30/10 | any |
| `kit.blend(a, b, amount)` | moss or dirt patches over a base | — |

```js
// Vertical: dark base, light top, ragged band edges. Calm stones only (noise < 0.1):
// smooth_stone > andesite > cracked_stone_bricks > polished_tuff > deepslate > deepslate_tiles
const ramp = kit.colors.ramp('smooth_stone', 'deepslate_tiles', 6, { kinds: ['stone'], exclude: (id, c) => c.noise >= 0.1 })
b.walls([0, 0, 0], [15, 14, 9], kit.gradient([...ramp].reverse(), { axis: 'y', from: 0, to: 14, dither: 0.6 }))

// Logic-driven: build the shape in a placeholder, then retexture it. Stairs, slabs and walls in the
// box become the same ramp step's stairs/slabs/walls, so require those shapes.
const wall = kit.colors.ramp('polished_andesite', 'cobbled_deepslate', 5, { kinds: ['stone'], require: ['stairs', 'slab', 'wall'] })
b.texture([0, 0, 0], [20, 11, 0], wall, { only: 'white_wool', base: 0.35, edge: 0.2, drip: 0.1, focus: [[10, 6, 0]] })

// One calm surface: neighbouring steps only, clumped.
b.walls([0, 0, 0], [15, 6, 9], kit.palette({ stone_bricks: 6, cracked_stone_bricks: 3, andesite: 1 }, { scale: 3 }))
```

Rules:

- **Neighbours only.** A block may touch its ramp neighbour (±1, at most ±2 steps). Skipping steps
  ("splattering") is the most common gradient mistake.
- **Clusters, not speckle.** Per-block random (`kit.palette(..., { scale: 0 })`) reads as static.
  Use clumps 2–6 blocks across (default `scale: 3`).
- **No straight strata.** Hard horizontal bands look like sediment. Keep `dither` around 0.4–0.7, or
  let `b.texture` raggedise the borders.
- **Weather with logic.** Darker and mossier at the base, corners, under sills and eaves, in drip
  streaks and on north faces; lighter around focal points and near the top. The top gets the
  interest; the base gets the weight.
- **Shapes keep their material.** If a ramp step has no stairs/slab/wall, `b.texture` leaves those
  shaped blocks as they were. Use `require` or check the result.
- **Each step is a 2–4 block band** with a ragged ±1–2 block boundary. For a wall 12 high, 4–6
  steps are plenty.

## Picking and substituting blocks

- **Match a reference colour:** `nearest('#hex')`. Restrict the material with `kinds` and keep
  shapes with `require`.
- **Substitute a block:** `nearest('calcite', { count: 3 })` → `white_concrete_powder` 2.3,
  `iron_block` 2.3, `birch_log` 2.4. Judge texture yourself: same colour, different busyness.
- **Roof in a stair-less colour** (terracotta, concrete, packed mud, calcite):
  `nearest(id, { require: ['stairs', 'slab'] })`. Red terracotta → `mangrove_planks` (6.5);
  terracotta → `bricks` (4.6). `paletteReport` suggests it automatically for a `roof` role. Or build
  the roof from full blocks or domes.
- **Floors and paths:** `nearest(hex, { face: 'top' })` matches what you see from above (logs show
  rings, `grass_block` shows green).
- **Biome match** (convention): sandstone in deserts, spruce and stone in taiga and snow, dark oak
  and mossy stone in dark forest, mangrove and mud in swamps, prismarine under water.

## Worked example

Palette → check → ramp → build. Built and rendered: `builder.problems` empty, top 6 ids cover 96 %.

```js
export default function build(api) {
  const { kit } = api
  const b = api.builder([22, 18, 18], { seed: 4 })
  const P = { foundation: 'cobbled_deepslate', wall: 'white_terracotta', frame: 'dark_oak_log', roof: 'deepslate_tiles', accent: 'bricks' }
  const report = kit.colors.paletteReport(P)
  if (!report.ok) throw new Error(report.warnings.join('\n'))
  // stone_bricks > polished_tuff > cobbled_deepslate
  const plinth = kit.colors.ramp('stone_bricks', P.foundation, 3, { kinds: ['stone'], require: ['stairs', 'slab'] })

  const [x0, z0, x1, z1] = [4, 4, 16, 12]
  b.box([x0, 0, z0], [x1, 1, z1], 'white_wool')                       // placeholder plinth
  b.walls([x0, 2, z0], [x1, 7, z1], P.wall)                            // calm light field (L* 75)
  for (let x = x0; x <= x1; x += 4) for (const z of [z0, z1]) b.box([x, 2, z], [x, 7, z], kit.log('dark_oak', 'y'))
  for (let z = z0; z <= z1; z += 4) for (const x of [x0, x1]) b.box([x, 2, z], [x, 7, z], kit.log('dark_oak', 'y'))
  for (const y of [2, 7]) {                                            // sill beam + top plate (L* 20)
    b.box([x0, y, z0], [x1, y, z0], kit.log('dark_oak', 'x'))
    b.box([x0, y, z1], [x1, y, z1], kit.log('dark_oak', 'x'))
    b.box([x0, y, z0], [x0, y, z1], kit.log('dark_oak', 'z'))
    b.box([x1, y, z0], [x1, y, z1], kit.log('dark_oak', 'z'))
  }
  for (const x of [x0 + 2, x1 - 2]) b.window([x, 4, z1], 'south', { width: 1, height: 2, shutters: true, material: 'spruce' })
  b.door([x0 + 6, 2, z1], 'south', { material: 'spruce' })
  b.roof({ x0, z0, x1, z1, y: 8, type: 'gable', axis: 'x', material: P.roof, gable: P.wall })   // L* 23
  b.chimney([x1 - 2, 2, z0 + 1], 12, { paint: P.accent })              // brick accent
  b.texture([x0, 0, z0], [x1, 1, z1], plinth, { only: 'white_wool', base: 0.4, edge: 0.2 })
  return b.finish({ name: 'palette-house' })
}
```

The render shows the value map from the diagram above. Dark roof and frame (20–23) against a light
field (75); a plinth that darkens from `stone_bricks` at the top to `cobbled_deepslate` at the base
and corners; one red-brown accent.

## Curated palettes

35 palettes, each checked with `kit.colors.paletteReport` and its roles: no warnings, all ids exist in
1.21.1. L\* is the side face's CIELAB lightness; a mixed role (`a` + `b`) is one surface, mixed with
`kit.palette`. Notes give roof materials and alternatives. A role-object copy of each table works
directly with `paletteReport` and with the worked example above. Use these as starting points:
shift one role by a ramp step for variety between houses, but keep the value structure.

| # | Palette | Mood | L* range | Roof |
|---|---|---|---|---|
| 1 | [Warm medieval cottage](#1-warm-medieval-cottage) | timber-framed village house, warm and lived-in | 20–80 | `spruce_planks` 38 |
| 2 | [Tudor half-timber](#2-tudor-half-timber) | black-and-white framing, English town | 20–75 | `deepslate_tiles` 23 |
| 3 | [Grey stone keep](#3-grey-stone-keep) | castle curtain walls, towers, gatehouse | 20–65 | `dark_oak_planks` 20 |
| 4 | [Brick townhouse](#4-brick-townhouse) | Georgian/Victorian street front | 20–92 | `deepslate_tiles` 23 |
| 5 | [Red barn](#5-red-barn) | rural farmstead | 37–72 | `smooth_stone` 65 |
| 6 | [Autumn forest cabin](#6-autumn-forest-cabin) | log cabin under orange trees | 20–62 | `mangrove_planks` 31 |
| 7 | [Alpine chalet](#7-alpine-chalet) | snowy mountain lodge | 20–72 | `dark_oak_planks` 20 |
| 8 | [Dark-forest cottage](#8-dark-forest-cottage) | witch hut, gloomy woods | 20–48 | `deepslate_tiles` 23 |
| 9 | [Desert town](#9-desert-town) | sun-baked sandstone, Middle-Eastern / Egyptian | 30–83 | flat / none |
| 10 | [Mesa adobe](#10-mesa-adobe) | pueblo / South-West | 17–75 | flat / none |
| 11 | [Tuscan villa](#11-tuscan-villa) | Mediterranean countryside | 38–86 | `granite` 48 |
| 12 | [Aegean whitewash](#12-aegean-whitewash) | Santorini: white cubes, blue domes | 25–85 | `blue_concrete` 25 |
| 13 | [Classical temple](#13-classical-temple) | Greek/Roman marble | 48–91 | `granite` 48 |
| 14 | [Japanese (Edo)](#14-japanese-edo) | pagoda, temple, machiya | 23–85 | `deepslate_tiles` 23 |
| 15 | [Imperial Chinese](#15-imperial-chinese) | palace hall on a white terrace | 37–92 | `bamboo_mosaic` 70 |
| 16 | [Cherry grove](#16-cherry-grove) | soft pink, spring garden | 16–77 | `deepslate_tiles` 23 |
| 17 | [Cold northern longhouse](#17-cold-northern-longhouse) | Viking/Nordic hall | 17–93 | `moss_block` 43 |
| 18 | [Coastal fishing village](#18-coastal-fishing-village) | harbour houses and piers | 17–72 | `dark_prismarine` 36 |
| 19 | [Swamp stilt village](#19-swamp-stilt-village) | mangrove bayou | 20–47 | `dark_oak_planks` 20 |
| 20 | [Sunken temple](#20-sunken-temple) | Atlantis, sea-green stone | 33–92 | `dark_prismarine` 36 |
| 21 | [Elven / high fantasy](#21-elven--high-fantasy) | light, slender, nature-bound | 36–89 | `dark_prismarine` 36 |
| 22 | [Wizard tower](#22-wizard-tower) | arcane slate and purple | 15–85 | `purpur_block` 58 |
| 23 | [Fairy-tale cottage](#23-fairy-tale-cottage) | storybook, mushroom caps | 25–75 | `red_mushroom_block` 45 |
| 24 | [Dark fortress](#24-dark-fortress) | menacing citadel | 11–56 | `nether_bricks` 11 |
| 25 | [Dwarven hall](#25-dwarven-hall) | underground forge-city | 23–85 | flat / none |
| 26 | [Nether fortress](#26-nether-fortress) | brick bastion over lava | 11–91 | flat / none |
| 27 | [Crimson fungus houses](#27-crimson-fungus-houses) | nether mushroom village | 15–80 | `nether_wart_block` 23 |
| 28 | [Warped grove](#28-warped-grove) | teal alien fantasy | 15–69 | `dark_prismarine` 36 |
| 29 | [End city](#29-end-city) | pale yellow stone and lilac purpur | 4–87 | `purpur_block` 58 |
| 30 | [Modern villa](#30-modern-villa) | white render, dark frames, wood | 24–85 | flat / none |
| 31 | [Industrial brick and copper](#31-industrial-brick-and-copper) | factory, warehouse, rail yard | 23–65 | `deepslate_tiles` 23 |
| 32 | [Steampunk](#32-steampunk) | copper, brass and dark wood | 18–85 | `deepslate_tiles` 23 |
| 33 | [Art deco](#33-art-deco) | cream, black and gold | 3–92 | flat / none |
| 34 | [Gothic cathedral](#34-gothic-cathedral) | grey stone, dark slate, coloured glass | 23–65 | `deepslate_tiles` 23 |
| 35 | [Overgrown ruins](#35-overgrown-ruins) | abandoned, mossy, weathered | 33–65 | flat / none |

### Warm vernacular and medieval

#### 1. Warm medieval cottage

Timber-framed village house, warm and lived-in. L* 20–80 (spread 60); 2 saturated blocks within 32° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `cobblestone` + `mossy_cobblestone` | 53 / 49 | `#807f80` / `#6e775f` |
| wall | `mushroom_stem` | 80 | `#cbc5ba` |
| frame | `dark_oak_log` | 20 | `#3c2f1a` |
| roof | `spruce_planks` | 38 | `#735531` |
| accent | `bricks` | 47 | `#976253` |

Roof `material: 'spruce'`; brick chimney. `white_terracotta` (L* 75) gives a creamier plaster.

#### 2. Tudor half-timber

Black-and-white framing, English town. L* 20–75 (spread 55); one saturated block; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `stone_bricks` | 51 | `#7a7a7a` |
| wall | `white_terracotta` | 75 | `#d2b2a1` |
| frame | `dark_oak_log` | 20 | `#3c2f1a` |
| roof | `deepslate_tiles` | 23 | `#373737` |
| accent | `bricks` | 47 | `#976253` |

The look *is* the 55 L* frame contrast. Jetty the upper floor 1 block out over a beam.

#### 3. Grey stone keep

Castle curtain walls, towers, gatehouse. L* 20–65 (spread 45); 2 saturated blocks within 6° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `cobbled_deepslate` | 33 | `#4d4d51` |
| wall | `stone_bricks` + `cracked_stone_bricks` | 51 / 50 | `#7a7a7a` / `#767676` |
| trim | `smooth_stone` | 65 | `#9f9f9f` |
| roof | `dark_oak_planks` | 20 | `#432b14` |
| accent | `spruce_planks` | 38 | `#735531` |

String courses and merlon caps in `smooth_stone_slab`; hoardings, doors and shutters in spruce.

#### 4. Brick townhouse

Georgian/Victorian street front. L* 20–92 (spread 72); 2 saturated blocks within 26° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `deepslate_bricks` | 30 | `#474747` |
| wall | `bricks` | 47 | `#976253` |
| trim | `smooth_quartz` | 92 | `#ede6e0` |
| roof | `deepslate_tiles` | 23 | `#373737` |
| accent | `dark_oak_planks` | 20 | `#432b14` |

White quartz sills, lintels and cornice on brick; dark oak doors and shutters.

#### 5. Red barn

Rural farmstead. L* 37–72 (spread 35); 2 saturated blocks within 56° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `cobblestone` | 53 | `#807f80` |
| wall | `red_terracotta` | 37 | `#8f3d2f` |
| trim | `birch_planks` | 72 | `#c0af79` |
| roof | `smooth_stone` | 65 | `#9f9f9f` |

Grey `smooth_stone` reads as a metal roof; it has slabs but no stairs (use `pitch: 0.5` or `stone_stairs`, L* 53).

#### 6. Autumn forest cabin

Log cabin under orange trees. L* 20–62 (spread 42); 3 saturated blocks within 51° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `cobblestone` + `mossy_cobblestone` | 53 / 49 | `#807f80` / `#6e775f` |
| wall | `stripped_oak_log` | 62 | `#b19056` |
| frame | `dark_oak_log` | 20 | `#3c2f1a` |
| roof | `mangrove_planks` | 31 | `#763631` |
| accent | `orange_terracotta` | 44 | `#a25426` |

Pair with `acacia_leaves`/`dark_oak_leaves`; pumpkins and hay bales as props.

#### 7. Alpine chalet

Snowy mountain lodge. L* 20–72 (spread 52); 4 saturated blocks within 54° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `stone_bricks` | 51 | `#7a7a7a` |
| wall | `stripped_spruce_log` | 40 | `#745a34` |
| frame | `stripped_birch_log` | 72 | `#c5b076` |
| roof | `dark_oak_planks` | 20 | `#432b14` |
| accent | `red_terracotta` | 37 | `#8f3d2f` |

Light frame on a mid wall (inverted timber look); `pitch: 2` with `snow` layers on the roof.

#### 8. Dark-forest cottage

Witch hut, gloomy woods. L* 20–48 (spread 28); 2 saturated blocks within 65° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `cobbled_deepslate` | 33 | `#4d4d51` |
| wall | `packed_mud` | 48 | `#8e6b50` |
| frame | `dark_oak_log` | 20 | `#3c2f1a` |
| roof | `deepslate_tiles` | 23 | `#373737` |
| accent | `purple_terracotta` | 36 | `#764656` |

Crooked massing matters more than colour here; mauve terracotta for door and shutters.

### Southern, dry and Mediterranean

#### 9. Desert town

Sun-baked sandstone, Middle-Eastern / Egyptian. L* 30–83 (spread 53); 4 saturated blocks within 169° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `smooth_red_sandstone` | 50 | `#b5621f` |
| wall | `sandstone` + `cut_sandstone` + `smooth_sandstone` | 82 / 83 / 86 | `#d8cb9c` / `#dacea0` / `#e0d6aa` |
| frame | `stripped_spruce_log` | 40 | `#745a34` |
| accent | `lapis_block` | 30 | `#1f438c` |

Flat roofs. The three sandstones are one surface (texture mix); trims read through shape (stairs, slabs, recesses). Lapis is the complementary accent.

#### 10. Mesa adobe

Pueblo / South-West. L* 17–75 (spread 58); one saturated block; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `brown_terracotta` | 24 | `#4d3324` |
| wall | `terracotta` | 46 | `#985e44` |
| trim | `white_terracotta` | 75 | `#d2b2a1` |
| frame | `spruce_log` | 17 | `#3b2611` |
| accent | `cyan_terracotta` | 38 | `#575b5b` |

Protruding `spruce_log` vigas under a flat roof; turquoise doors.

#### 11. Tuscan villa

Mediterranean countryside. L* 38–86 (spread 48); 4 saturated blocks within 52° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `stone_bricks` | 51 | `#7a7a7a` |
| wall | `smooth_sandstone` | 86 | `#e0d6aa` |
| frame | `stripped_oak_log` | 62 | `#b19056` |
| roof | `granite` | 48 | `#956756` |
| accent | `spruce_planks` | 38 | `#735531` |

Tile-red roof in `granite` stairs at `pitch: 0.5`; spruce or green shutters.

#### 12. Aegean whitewash

Santorini: white cubes, blue domes. L* 25–85 (spread 60); 2 saturated blocks within 40° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `tuff` | 46 | `#6c6d67` |
| wall | `white_concrete` | 85 | `#cfd5d6` |
| roof | `blue_concrete` | 25 | `#2d2f8f` |
| accent | `light_blue_concrete` | 54 | `#2489c7` |

Domes with `b.dome` in blue concrete (no stairs needed); flat white roofs elsewhere; `smooth_quartz` for steps.

#### 13. Classical temple

Greek/Roman marble. L* 48–91 (spread 43); 2 saturated blocks within 44° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `polished_andesite` | 56 | `#848786` |
| wall | `quartz_bricks` + `quartz_pillar` | 91 / 92 | `#ebe5de` / `#ece7e0` |
| roof | `granite` | 48 | `#956756` |
| accent | `gold_block` | 85 | `#f6d03e` |

Columns and wall share one value: separate them by depth (columns 1-2 blocks proud) and shadow, not colour.

### East Asian

#### 14. Japanese (Edo)

Pagoda, temple, machiya. L* 23–85 (spread 62); one saturated block; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `polished_andesite` | 56 | `#848786` |
| wall | `white_concrete` | 85 | `#cfd5d6` |
| frame | `stripped_dark_oak_log` | 25 | `#493924` |
| roof | `deepslate_tiles` | 23 | `#373737` |
| accent | `crimson_planks` | 28 | `#653147` |

Curved roof `pitch: [0.5, 0.5, 1, 1, 2]`; torii and railings in crimson or `red_terracotta`.

#### 15. Imperial Chinese

Palace hall on a white terrace. L* 37–92 (spread 55); 3 saturated blocks within 58° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `smooth_quartz` | 92 | `#ede6e0` |
| wall | `red_terracotta` | 37 | `#8f3d2f` |
| roof | `bamboo_mosaic` | 70 | `#beaa4e` |
| trim | `gold_block` | 85 | `#f6d03e` |
| accent | `cyan_terracotta` | 38 | `#575b5b` |

Red walls and columns, yellow roof (`bamboo_mosaic` stairs/slabs), teal-blue brackets under the eaves.

#### 16. Cherry grove

Soft pink, spring garden. L* 16–77 (spread 61); one saturated block; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `stone_bricks` | 51 | `#7a7a7a` |
| wall | `cherry_planks` | 77 | `#e3b3ad` |
| frame | `cherry_log` | 16 | `#37212c` |
| roof | `deepslate_tiles` | 23 | `#373737` |
| accent | `pink_concrete` | 58 | `#d6658f` |

`cherry_leaves` canopies (L* 76); keep the roof neutral so the pink carries.

### Cold, coastal and wet

#### 17. Cold northern longhouse

Viking/Nordic hall. L* 17–93 (spread 76); 2 saturated blocks within 42° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `cobblestone` | 53 | `#807f80` |
| wall | `spruce_log` | 17 | `#3b2611` |
| trim | `stripped_spruce_log` | 40 | `#745a34` |
| roof | `moss_block` | 43 | `#596e2d` |
| accent | `white_wool` | 93 | `#eaeced` |

Turf roof: stepped `moss_block`, or `b.roof({ material: { stairs: 'mossy_cobblestone_stairs', slab: 'mossy_cobblestone_slab', block: 'moss_block' } })`. Slate alternative: `dark_prismarine` (L* 36, 1 L* short of the roof target).

#### 18. Coastal fishing village

Harbour houses and piers. L* 17–72 (spread 55); one saturated block; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `stone_bricks` | 51 | `#7a7a7a` |
| wall | `birch_planks` | 72 | `#c0af79` |
| frame | `spruce_log` | 17 | `#3b2611` |
| roof | `dark_prismarine` | 36 | `#345c4c` |
| accent | `light_blue_terracotta` | 47 | `#716d8a` |

Piers in spruce on `stripped_spruce_log` piles; `mossy_stone_bricks` at the waterline.

#### 19. Swamp stilt village

Mangrove bayou. L* 20–47 (spread 27); 3 saturated blocks within 57° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `muddy_mangrove_roots` | 25 | `#443b30` |
| wall | `mud_bricks` | 47 | `#89684f` |
| posts | `mangrove_log` | 29 | `#544329` |
| roof | `dark_oak_planks` | 20 | `#432b14` |
| accent | `moss_block` | 43 | `#596e2d` |

Stilts and posts in `mangrove_log`; moss and vines on the roof edges; lily pads around.

#### 20. Sunken temple

Atlantis, sea-green stone. L* 33–92 (spread 59); 2 saturated blocks within 90° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `cobbled_deepslate` | 33 | `#4d4d51` |
| wall | `prismarine_bricks` | 65 | `#63ac9e` |
| trim | `smooth_quartz` | 92 | `#ede6e0` |
| roof | `dark_prismarine` | 36 | `#345c4c` |
| accent | `gold_block` | 85 | `#f6d03e` |

Sea lanterns (emissive) for light. Prismarine is busy, so keep the quartz trim smooth.

### Fantasy

#### 21. Elven / high fantasy

Light, slender, nature-bound. L* 36–89 (spread 53); 2 saturated blocks within 90° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `polished_andesite` | 56 | `#848786` |
| wall | `stripped_birch_log` | 72 | `#c5b076` |
| trim | `calcite` | 89 | `#dfe0dd` |
| roof | `dark_prismarine` | 36 | `#345c4c` |
| accent | `prismarine_bricks` | 65 | `#63ac9e` |

Birch-white walls and teal roofs; `oxidized_copper` clashes with birch at equal value (paletteReport flags it).

#### 22. Wizard tower

Arcane slate and purple. L* 15–85 (spread 70); 2 saturated blocks within 125° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `blackstone` | 15 | `#2a2429` |
| wall | `deepslate_bricks` | 30 | `#474747` |
| trim | `polished_andesite` | 56 | `#848786` |
| roof | `purpur_block` | 58 | `#aa7eaa` |
| accent | `gold_block` | 85 | `#f6d03e` |

`b.coneRoof` in purpur; amethyst clusters and soul lanterns as props.

#### 23. Fairy-tale cottage

Storybook, mushroom caps. L* 25–75 (spread 50); 2 saturated blocks within 31° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `mossy_cobblestone` | 49 | `#6e775f` |
| wall | `white_terracotta` | 75 | `#d2b2a1` |
| frame | `stripped_dark_oak_log` | 25 | `#493924` |
| roof | `red_mushroom_block` | 45 | `#c82f2d` |
| accent | `brown_mushroom_block` | 50 | `#957051` |

Mushroom-cap roofs with `b.dome`; stems in `mushroom_stem`.

#### 24. Dark fortress

Menacing citadel. L* 11–56 (spread 45); one saturated block; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `blackstone` | 15 | `#2a2429` |
| wall | `deepslate_bricks` + `cobbled_deepslate` | 30 / 33 | `#474747` / `#4d4d51` |
| trim | `polished_andesite` | 56 | `#848786` |
| roof | `nether_bricks` | 11 | `#2c161a` |
| accent | `red_nether_bricks` | 12 | `#460709` |

The wall is mid-dark so the near-black roof and base still separate by 17-20 L*. Light with soul lanterns and magma.

#### 25. Dwarven hall

Underground forge-city. L* 23–85 (spread 62); 2 saturated blocks within 48° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `deepslate_tiles` | 23 | `#373737` |
| wall | `polished_deepslate` | 31 | `#484949` |
| frame | `polished_andesite` | 56 | `#848786` |
| trim | `cut_copper` | 54 | `#bf6b51` |
| accent | `gold_block` | 85 | `#f6d03e` |

Pale andesite pillars against dark deepslate; copper and gold inlays; lava and lanterns for warm light.

### Nether and End

#### 26. Nether fortress

Brick bastion over lava. L* 11–91 (spread 80); 2 saturated blocks within 33° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `basalt` | 31 | `#49494e` |
| wall | `nether_bricks` | 11 | `#2c161a` |
| band | `red_nether_bricks` | 12 | `#460709` |
| trim | `quartz_bricks` | 91 | `#ebe5de` |
| accent | `shroomlight` | 69 | `#f19347` |

Nether blocks are all dark (L* 10-40): value structure comes from quartz trim and light blocks. Roofs, if any: `crimson` stairs (L* 28).

#### 27. Crimson fungus houses

Nether mushroom village. L* 15–80 (spread 65); 3 saturated blocks within 36° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `blackstone` | 15 | `#2a2429` |
| wall | `mushroom_stem` | 80 | `#cbc5ba` |
| frame | `crimson_stem` | 21 | `#5d1a1e` |
| roof | `nether_wart_block` | 23 | `#730302` |
| accent | `shroomlight` | 69 | `#f19347` |

Pale stem walls under wart-block caps (`b.dome`); shroomlight as lamps.

#### 28. Warped grove

Teal alien fantasy. L* 15–69 (spread 54); 2 saturated blocks within 132° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `blackstone` | 15 | `#2a2429` |
| wall | `stripped_warped_stem` | 57 | `#3a9794` |
| frame | `warped_stem` | 26 | `#3a3b4e` |
| roof | `dark_prismarine` | 36 | `#345c4c` |
| accent | `shroomlight` | 69 | `#f19347` |

Cool teal set with one warm accent (shroomlight is complementary); `warped_wart_block` for foliage.

#### 29. End city

Pale yellow stone and lilac purpur. L* 4–87 (spread 83); 3 saturated blocks within 153° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `obsidian` | 4 | `#0f0b19` |
| wall | `end_stone_bricks` | 87 | `#dae0a2` |
| roof | `purpur_block` | 58 | `#aa7eaa` |
| accent | `magenta_stained_glass` | 51 | `#b24cd8` |

`purpur_pillar` differs from `purpur_block` by texture only: use it within the purpur parts, not as a separate role.

### Modern, industrial and stylised

#### 30. Modern villa

White render, dark frames, wood. L* 24–85 (spread 61); one saturated block; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `polished_deepslate` | 31 | `#484949` |
| wall | `white_concrete` | 85 | `#cfd5d6` |
| frame | `gray_concrete` | 24 | `#373a3e` |
| trim | `smooth_stone` | 65 | `#9f9f9f` |
| accent | `stripped_spruce_log` | 40 | `#745a34` |

Flat roofs in `smooth_stone_slab`; big glass (`light_gray_stained_glass`, `tinted_glass`).

#### 31. Industrial brick and copper

Factory, warehouse, rail yard. L* 23–65 (spread 42); 2 saturated blocks within 125° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `polished_deepslate` | 31 | `#484949` |
| wall | `bricks` | 47 | `#976253` |
| trim | `smooth_stone` | 65 | `#9f9f9f` |
| roof | `deepslate_tiles` | 23 | `#373737` |
| accent | `oxidized_copper` | 61 | `#52a385` |

Teal oxidized copper is the complement of brick. Iron bars, chains and `iron_block` as detail.

#### 32. Steampunk

Copper, brass and dark wood. L* 18–85 (spread 67); 2 saturated blocks within 48° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `polished_blackstone_bricks` | 18 | `#302b32` |
| wall | `cut_copper` | 54 | `#bf6b51` |
| frame | `dark_oak_log` | 20 | `#3c2f1a` |
| trim | `gold_block` | 85 | `#f6d03e` |
| roof | `deepslate_tiles` | 23 | `#373737` |

Copper oxidises in game; use `waxed_cut_copper` to freeze the colour (identical look).

#### 33. Art deco

Cream, black and gold. L* 3–92 (spread 89); 2 saturated blocks within 8° of hue; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `polished_blackstone` | 21 | `#353139` |
| wall | `smooth_sandstone` | 86 | `#e0d6aa` |
| frame | `black_concrete` | 3 | `#080a0f` |
| piers | `quartz_pillar` | 92 | `#ece7e0` |
| accent | `gold_block` | 85 | `#f6d03e` |

Vertical quartz piers, black spandrels and frames, gold crowns.

### Ruins and sacred stone

#### 34. Gothic cathedral

Grey stone, dark slate, coloured glass. L* 23–65 (spread 42); one saturated block; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `cobbled_deepslate` | 33 | `#4d4d51` |
| wall | `stone_bricks` + `cracked_stone_bricks` | 51 / 50 | `#7a7a7a` / `#767676` |
| trim | `smooth_stone` | 65 | `#9f9f9f` |
| roof | `deepslate_tiles` | 23 | `#373737` |
| accent | `purple_stained_glass` | 40 | `#7f3fb2` |

Steep roofs (`pitch: 2`); buttresses and tracery in the trim block; stained glass in red, blue and purple.

#### 35. Overgrown ruins

Abandoned, mossy, weathered. L* 33–65 (spread 32); one saturated block; `paletteReport` clean.

| role | block | L* | side |
|---|---|---|---|
| foundation | `cobbled_deepslate` | 33 | `#4d4d51` |
| wall | `stone_bricks` + `cracked_stone_bricks` + `mossy_stone_bricks` | 51 / 50 / 50 | `#7a7a7a` / `#767676` / `#737969` |
| trim | `smooth_stone` | 65 | `#9f9f9f` |
| accent | `moss_block` | 43 | `#596e2d` |

Low contrast by nature: carry it with broken silhouettes, depth, `b.weather` and `b.overgrow`.

## Checklist before you render

- [ ] Roles assigned: foundation, wall field, frame/trim, roof, 1–2 accents. `paletteReport(roles).ok`.
- [ ] Roof vs wall |ΔL\*| ≥ 20, frame vs wall ≥ 20 (30+ for timber), palette spans ≥ 30 L\*.
- [ ] One hue family on large surfaces (C\* ≤ 35); one accent in the opposite hue, ≤ 10 %, at focal points.
- [ ] At most one strongly textured block (noise ≥ 0.10) per view; frames and trims unmixed.
- [ ] 3–6 ids cover ≥ 80 % of the blocks; texture variants stay inside their surface.
- [ ] Ramps ordered light → dark, neighbours only, clustered (`kit.palette` scale ≥ 2, `dither` 0.4–0.7, or `b.texture`).
- [ ] Roof and trim materials have stairs + slabs (`require: ['stairs', 'slab']`).
- [ ] Render, then check the grayscale version: roof, wall, frame and base must separate.

## Sources

- Measured data: `scripts/lib/data/block-colors.json` (`node scripts/dev/gen-block-colors.mjs`), from
  Lodestone's default pack, whose atlas matches the vanilla 1.21.1 textures pixel for pixel.
- minecraft.wiki, *Tutorial:Color palette* and *Tutorial:Best building materials*
  (https://minecraft.wiki/w/Tutorial:Color_palette).
- minecraft.wiki structure pages (End City, Ancient City, Trial Chambers, Bastion Remnant, Desert Pyramid):
  vanilla theme palettes.
- WesterosCraft, Building fundamentals: Gradients (value > colour > texture; splattering, smallpox,
  sandwiching) (https://westeroscraft.com/docs/building/fundamentals/gradients).
- ArdaCraft, Gradient Guide (https://www.ardacraft.me/resources/gradient-guide).
- Conquest Reforged, Gradienting your Builds (drip vs cluster patterns) (https://www.conquestreforged.com/guides/gradients).
- blockpalettes.com: statistics over the 1,700 most-liked community palettes (pairings, value ranges).
- minecraftgradient.blog, Minecraft Wall Gradient Ideas (mix ratios; opinion).
- G. Sharma, W. Wu, E. N. Dalal, "The CIEDE2000 colour-difference formula: implementation notes",
  *Color Research & Application* 30(1), 2005 (ΔE00 as used by `kit.colors`).
- CIE 15:2004 *Colorimetry* (CIELAB, D65).
