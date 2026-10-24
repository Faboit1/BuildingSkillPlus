# Style catalogue

What makes each architectural style read as itself in Minecraft: silhouette and numbers, signature
elements, palettes by role with lightness (L\*), the kit calls that produce the shape, mistakes, and
the ground that belongs around it. Palette *theory* (value structure, ramps, harmony) lives in
[palettes.md](palettes.md); every block's measured colour is in [block-colors.md](block-colors.md); which
stairs/slabs/walls exist per material is in [materials.md](materials.md); roof, window and tower
mechanics are in [components.md](components.md).

How to read an entry:

- **Shares** are the share of the visible exterior. Mixes inside a role (`stone_bricks 55 / andesite 20 / …`)
  are weights for `kit.palette` or ramp order for `b.texture`.
- **L\*** is perceived lightness (0 black, 100 white) of the role's main block. Targets: roof ≥ 20 L\*
  from the walls, frame vs infill ≥ 15, lightest-to-darkest structural block ≥ 30.
- Roof materials must be stair families (`'spruce'`, `'deepslate_tile'`, `'brick'`, `'mud_brick'`,
  `'cut_copper'`…). Calcite, terracotta, concrete, packed mud, basalt and logs have no stairs.
- "(convention)" = what skilled builders agree on; "(taste)" = one good option among several.
- Every kit call marked ✓ was built and rendered while writing this chapter; the notes say what showed up.

## Style chooser

| Style | Read-at-a-glance cue | Roof (kit) | Palette anchor (L\*) | Example |
|---|---|---|---|---|
| Medieval cottage | stone base, timber/plank upper, steep gable, chimney | `gable`, pitch `1` or `[1, 1, 2]`, overhang 1 | cobblestone 53 · spruce 38 · calcite 89 | `assets/examples/medieval-house.mjs` |
| Tudor townhouse | dark grid on white, jettied upper floor, gable to street | `gable` `[1, 1, 2]` | dark_oak_log 20 on calcite 89 | `medieval-house.mjs` |
| Castle | thick curtain walls, projecting towers, crenels, cone roofs | `coneRoof` pitch 2 flare; `pyramid` pitch 2 | stone_bricks 51 · deepslate_tiles 23 | `assets/examples/castle.mjs` |
| Nordic longhouse | low walls, roof ⅔ of height, sagging ridge, gable horns | `gable` `[1, 1, 2, 2, 2]` + ridge sag | dark_oak 20 · cobblestone 53 | `assets/examples/nordic-longhouse.mjs` |
| Stave church | 3–5 stacked steep roof tiers, dragon heads | stacked `gable` pitch 2 | stripped_dark_oak_log 25 · deepslate_tiles 23 | — |
| Elven | slender, curved, arched, grown-not-built | `coneRoof` pitch 3 / bell-cast | calcite 89 · oxidized copper 58–61 | — |
| Dwarven | carved halls, huge square piers, geometry, lava light | (halls, flat) | deepslate_bricks 30 · gold 85 accents | — |
| Wizard tower | tall thin, flared upper floors, witch-hat cone | `coneRoof` pitch 3, overhang 2 | tuff_bricks 43 · deepslate_tiles 23 · amethyst | `assets/examples/wizard-tower.mjs` |
| Cottagecore / fairy | small, round, oversized thatch/moss roof, flowers | `gable` `[0.5, 1, 2, 2]` | white_terracotta 75 · bamboo_mosaic 70 | — |
| Gothic | vertical, pointed arches, buttresses, spires | `gable` pitch 2; spires `pyramid` pitch 3 | stone_bricks 51 · deepslate_tiles 23 | `assets/examples/gothic-cathedral.mjs` |
| Japanese temple / shrine | deep curved eaves, raised floor, visible posts | `hip` `[0.5, 0.5, 1, 1]` overhang 2 (+ gable top = irimoya) | calcite 89 · deepslate_tiles 23 · mangrove red 31 | `assets/examples/japanese-shrine.mjs` |
| Pagoda | odd tiers stepping in, eave skirts, spire | per tier `hip` `[0.5, 0.5, 1]` overhang 2 | deepslate_tiles 23 · white 90 · red posts | `japanese-shrine.mjs` |
| Chinese palace | axial symmetry, white terrace, red columns, coloured brackets | `hip` `[0.5, 0.5, 1, 1]`, double eaves | red_terracotta 37 · smooth_quartz 92 | — |
| Cycladic / Santorini | white stacked cubes, flat roofs, one blue dome | flat + `b.dome` | white_concrete_powder 90 · blue_concrete 25 | `assets/examples/coastal-village.mjs` |
| Tuscan / Spanish | stucco, low red-tile roofs, arcades | `hip` pitch `0.5`, material `brick` | smooth_sandstone 86 · bricks 47 | — |
| Desert / Moorish | thick walls, flat roofs, domes, horseshoe arches | flat; `b.lathe(kit.onionProfile)` domes | sandstone 82 · cyan/blue tile accents | `assets/examples/desert-palace.mjs` |
| Greek / Roman | stepped base, colonnade, low pediment | `gable` pitch `0.5`, smooth_quartz | quartz 91 · calcite 89 | — |
| Egyptian | battered pylons, flat roofs, obelisks, monumental | flat + cavetto stairs | smooth_sandstone 86 · lapis/gold accents | — |
| Victorian | asymmetric, turret, porch, bay windows, steep cross gables | `gable` `[1, 2]`; turret `coneRoof` pitch 3 | bricks 47 + white trim 89 · slate 23 | — |
| Steampunk | Victorian + exposed copper machinery, airships | copper `gable`/domes | spruce 38 · copper 54 · deepslate 30 | `assets/examples/celestial-forge.mjs` |
| Modern | horizontal boxes, cantilevers, glass bands, flat plates | flat plates (no `b.roof`) | white_concrete 85 · black_concrete 3 | — |
| Industrial | saw-tooth sheds, brick mills, smokestacks | `shed` repeated (saw-tooth) | bricks 47 · polished_blackstone 21 | — |
| Sci-fi | panels, chamfers, glowing strips, greebles | flat / curved shells | white_concrete 85 · gray_concrete 24 · sea_lantern | `celestial-forge.mjs` |
| Farm / barn | big gambrel roof, red boards, white trim | `gable` `[2, 2, 0.5, 0.5]` | mangrove 31 · birch trim 72 | — |
| Ruins | original silhouette eroded, rubble cones, overgrowth | (remove) | stone_bricks 51 + cracked/mossy | — |
| Underwater / Atlantis | domes, prismarine, sea lanterns, quartz columns | `b.dome` glass; `dark_prismarine` | prismarine 62 · dark_prismarine 36 | — |
| Nether | dark fortress, lava light, wart foliage | `nether_brick` / `blackstone` | nether_bricks 10 + quartz/basalt trim | — |
| End | purpur pods on towers, end rods | `purpur` flat-ish | purpur 58 · end_stone_bricks 87 | — |
| Mesoamerican | stepped pyramid, steep central stair, roof comb | flat top temple | stone_bricks 51 · mossy 48 | — |
| Cherry blossom | cherry wood on white stone, dark anchor roof | host style's roof, `deepslate_tile` | cherry_planks 77 · cherry_log 16 | — |

## Verified kit recipes for style silhouettes

Built as plain massing and rendered (south/se/close-ups). Use these as starting points; each style
section repeats the relevant line.

| Silhouette | Call | What the render showed |
|---|---|---|
| Cottage gable | `b.roof({ …, pitch: 1, eaveTrim: true, gable: 'spruce_planks' })` | clean 45°; ridge = ½ width |
| Steep Nordic / Gothic | `pitch: 2` | 63° A-frame; on a 7-wide house the roof is twice the wall height — right for Nordic/Gothic, too much for cottages |
| Longhouse | walls 2–3 tall, `pitch: [1, 1, 2, 2, 2]` | eaves 2 above grade, roof dominates; ridge sag must be added (below) |
| Bell-cast / thatch | `pitch: [0.5, 1, 2, 2]` | soft flared eave, steep top |
| Gambrel barn | `type: 'gable', pitch: [2, 2, 0.5, 0.5]` | barn profile, rounded shoulder from the gable end |
| Low Mediterranean | `type: 'hip', pitch: 0.5, material: 'brick'` | low tiled hip |
| East-Asian hip | `type: 'hip', pitch: [0.5, 0.5, 1, 1], overhang: 2` | deep flat brim then gentle rise; reads Asian |
| (avoid) | `type: 'hip', pitch: [0.5, 0.5, 1, 1, 2]` | trailing steep rows on a **hip** stack into a narrow ziggurat spike; keep `2` rows for gables only |
| Irimoya (hip-and-gable) | East-Asian hip as above, then `b.roof({ x0+3…x1-3, y: hip.base + 4, type: 'gable', pitch: [1, 1, 2], gable: 'stripped_dark_oak_log[axis=y]', overwrite: false })` | reads as a temple roof |
| Double eave (Chinese) | lower `hip` `[0.5, 0.5, 1]` overhang 2 at the colonnade top, then `b.box(inner, 'air')` above it, upper walls, then the main `hip` overhang 3 | two distinct roof tiers with a wall band between |
| Pagoda tier | each tier `hip`, `pitch: [0.5, 0.5, 1]`, `overhang: 2`; tiers 1 smaller per side; next tier starts 2 above the previous roof's wall line; top `pyramid` `[0.5, 0.5, 1, 1, 2]` | convincing 3-tier pagoda |
| Mansard | `type: 'mansard'` (default profile `[2, 2, 3, 0.5]`) | steep sides, flat crown |
| Pediment | `type: 'gable', axis: <toward the front>, pitch: 0.5, material: 'smooth_quartz', gable: 'smooth_quartz'` | low classical pediment |
| Hut / lighthouse cone | `b.coneRoof(c, r, { pitch: 1, flare: false })` | low cone |
| Castle cone | `coneRoof` `pitch: 2` (flare default) | French/castle turret |
| Witch hat | `coneRoof` `pitch: 3, overhang: 2` | tall cone, wide brim |
| Bell-cast copper | `coneRoof` `pitch: [0.5, 0.5, 1, 2, 3, 3], overhang: 2, material: 'oxidized_cut_copper'` | strong flare, elven/chateau |
| Onion dome | `b.lathe([cx, y, cz], h, kit.onionProfile(r, h), 'oxidized_copper')`, r ≥ drum radius + 1, h ≈ 2.5 r | reads only with bulge + contrasting material; same-colour, same-radius onion vanished |
| Hemisphere dome | `b.dome([cx, y, cz], 2.5–3.5, 'blue_concrete')` on a 1–2 tall drum | Cycladic/Byzantine dome |
| Gothic spire | `type: 'pyramid', pitch: 3, overhang: 0` + corner pinnacles (`stone_brick_wall` ×2 + `lightning_rod`) | sharp spire |

Fixes found while testing:

- **Deep eaves.** With `overhang: 2` and a profile starting `[0.5, 0.5, …]` the kit makes the
  second row a full block (older versions left a floating top slab and a bright line under the eave).
  A dark top wall course (`stripped_dark_oak_log[axis=x|z]`) still helps: it reads as the eave beam.
- **Timber braces need big panels.** `b.timberWall` braces are stepped (face-connected) lines; in
  panels smaller than 5 wide × 4 tall inside the frame they fill the panel and leave plaster dots. Use
  `braces: true` only with `postEvery: 6` and storeys ≥ 6 tall; otherwise no braces (`postEvery: 4`) or
  close studding (`postEvery: 2`). `braces: 'all'` is almost always too busy.
- **Hogback ridge.** No pitch profile sags along the ridge. After the roof, swap the ridge blocks in the
  middle 60% for bottom slabs (verified on a 27-long longhouse; subtle but visible):

```js
const r = b.roof({ x0, z0, x1, z1, y: wallTop + 1, axis: 'x', material: 'dark_oak', pitch: [1, 1, 2, 2, 2], eaveTrim: true, gable: 'spruce_planks' })
const ridgeZ = (z0 + z1) / 2, len = x1 - x0                    // odd width → integer ridge line
for (let x = x0 + Math.round(len * 0.2); x <= x1 - Math.round(len * 0.2); x += 1)
  if (b.nameAt(x, r.topY, ridgeZ) === 'minecraft:dark_oak_planks') b.set(x, r.topY, ridgeZ, 'dark_oak_slab[type=bottom]')
```

- **Battered (sloping) walls** in boxes step 1 block every 4–6 rows; 4-row steps look like a wedding
  cake. Use 6-row steps on wide, shallow masses and put a stair on every ledge (tall side against the
  wall). Relief panels must follow the inset, not a fixed plane.
- **Wood roof ramps.** `b.texture` over a roof with `['spruce', 'spruce', 'dark_oak']` scatters dark
  blotches near the ridge with default noise. `noise: 0.12, scale: 6, base: 0.35, top: 0.2` keeps more of
  the dark at eaves and rakes; still check the render. (`b.texture` keeps stair shapes; never repaint a
  roof with `b.replace` + a block palette — that turns stairs into full blocks.)

## 1. Medieval

The most built style and the most forgiving of mess. One vocabulary — stone base, timber or stone
walls, steep roof, small openings — at four scales.

### 1.1 Rustic cottage / workshop / tavern

**Identity:** a stone-footed, timber-and-plank house whose steep roof is half its height.

**Silhouette**
- Footprint 7×9 to 9×13 (long side 1.3–1.8× the short); taverns and farmhouses L- or T-shaped.
- Eave at 4–5 above the floor for one storey, 8–10 for two; never more than 3 storeys.
- Gable roof at pitch 1 (wood shingle/slate) or `[1, 1, 2]` (steeper top); roof ≈ 40–55% of the
  facade height; overhang 1 at eaves and gables.
- Plinth 1–2 courses, visible all round, deeper on the downhill side.

**Signature:** stone ground floor + plank/timber upper; log corner posts; chimney on a gable end
rising 2+ above the ridge; 1×2 windows with trapdoor shutters; barrels, hay, a bench and a lantern at
the door.

**Palettes**

*Spruce & cobble* (the most-liked community medieval palette is spruce log/planks/stripped + stone
bricks + cobblestone + andesite)

| Role | Blocks (mix) | L\* | Share |
|---|---|---|---|
| Foundation | cobblestone 50 / mossy_cobblestone 20 / andesite 15 / stone 15 | 53 | 10% |
| Ground-floor wall | stone_bricks 45 / cobblestone 30 / andesite 15 / cracked_stone_bricks 10 | 51 | 20% |
| Upper wall | spruce_planks 85 / stripped_spruce_log (horizontal boards) 15 | 38 | 20% |
| Frame | spruce_log (`axis=y` posts, `axis=x|z` beams) | 17 | 8% |
| Roof | dark_oak (or deepslate_tile) stairs | 20 / 23 | 30% |
| Trim | spruce_slab sills, spruce_trapdoor shutters, stripped_dark_oak_log ridge | 38 | 5% |
| Accent / light | barrel, red banner, lantern | – | ≤ 5% |

A spruce roof (38) over stone bricks (51) is only 13 apart — too close; use dark oak or deepslate tile.

*Oak village* (vanilla plains-village DNA)

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Foundation | cobblestone 60 / mossy_cobblestone 25 / andesite 15 | 53 | 10% |
| Wall | oak_planks 70 / stripped_oak_log 20 / birch_planks 10 | 57 | 35% |
| Frame | oak_log, or dark_oak_log for more contrast | 38 / 20 | 10% |
| Roof | spruce stairs 80 / dark_oak 20 (streaks) | 38 | 30% |
| Trim / accent | oak_trapdoor shutters, white wool awning, flower pots | – | 5% |

*Brick & plaster*

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Foundation | stone_bricks 50 / cobblestone 30 / andesite 20 | 51 | 10% |
| Infill | white_terracotta 70 / calcite 20 / smooth_sandstone 10 | 75 | 30% |
| Secondary | bricks (chimney, quoins, ground-floor nogging) | 47 | 10% |
| Frame | spruce_log / stripped_spruce_log | 17 / 40 | 10% |
| Roof | brick 60 / mud_brick 25 / granite 15 (clay tile look) | 47 | 30% |

**Kit**

```js
b.box([x0, g, z0], [x1, g + 1, z1], kit.palette({ cobblestone: 5, mossy_cobblestone: 2, andesite: 2, stone: 1 }, { scale: 2 }))
b.box([x0, g + 2, z0], [x1, g + 4, z1], 'white_wool')                        // placeholder, textured later
b.timberWall([x0, g + 5, z1], [x1, g + 8, z1], { frame: 'spruce_log', infill: 'spruce_planks', postEvery: 4 })
b.roof({ x0, z0, x1, z1, y: g + 9, material: 'dark_oak', pitch: [1, 1, 2], eaveTrim: true, gable: 'spruce_planks' })
b.texture([x0, g + 2, z0], [x1, g + 4, z1], ['andesite', 'cobblestone', 'mossy_cobblestone', 'cobbled_deepslate'], { only: 'white_wool' }) // light → dark: 57, 53, 48, 33
b.window([wx, g + 6, z1], 'south', { width: 1, height: 2, recess: 1, shutters: true, flowerBox: true, material: 'spruce' })
b.chimney([x1, g, z0 + 2], 14, { paint: kit.palette({ cobblestone: 3, bricks: 1 }) })
```

**Detail**
- Posts at corners and every 3–5; infill 1 behind the frame; a horizontal log ring at each floor.
- Sills: `spruce_stairs[facing=<into wall>,half=top]` or `smooth_stone_slab[type=top]`; shutters
  `spruce_trapdoor[open=true,facing=<out>]` both sides; lintel = stripped log.
- Eaves: `eaveTrim: true`, plus fence "rafter tails" under the gable overhang.
- Chimney 1×1 or 2×2 cobble/brick, `campfire[lit=true]` smoke (the kit's `b.chimney` does this).
- Props by the door: `barrel`, `hay_block[axis=x]`, `composter`, `grindstone`, a lantern on a fence post.

**Mistakes:** wall and roof in the same material; flat roofs; perfect symmetry and window grids;
all-cobblestone walls (too busy); white concrete infill (blue-white, flat — use calcite or white
terracotta); no plinth; every house identical (vary footprint, roof axis, wall material, one accent).

**Ground:** streets of `dirt_path` 5 / `coarse_dirt` 2 / `gravel` 2 / `cobblestone` 1 (cobble patches near
doors); fenced plots; crop strips with a water channel; wells, carts, hay stacks; oak/birch/spruce trees;
hedges of leaves on fences; lanterns on posts every 8–12 blocks.

### 1.2 Tudor / timber-frame townhouse

**Identity:** a dark timber grid over pale infill, upper floors jutting over the street.

**Silhouette**
- Frontage 5–9, depth 9–15, 2–4 storeys; **each upper storey jettied 1 block** toward the street,
  carried on upside-down stair brackets.
- Steep gable facing the street (`[1, 1, 2]` or pitch 2); manors add cross gables and dormers.
- Ground floor stone or brick, 3–4 tall; timber storeys 4 tall.

**Signature:** close-studded or square-panel framing, braces in end bays, jetty brackets, leaded
(mullioned) windows, tall brick chimney stacks, oriel/bay windows.

**Palettes**

*Black & white*

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Ground floor | cobblestone 40 / stone_bricks 40 / andesite 20 (or bricks) | 52 | 15% |
| Infill | calcite 70 / white_terracotta 20 / diorite 10 | 89 | 30% |
| Frame | dark_oak_log (or stripped_dark_oak_log) | 20 | 15% |
| Roof | deepslate_tile 85 / cobbled_deepslate 15 | 23 | 30% |
| Ridge / chimney | bricks | 47 | 3% |
| Windows | glass_pane, `dark_oak_fence` mullions | – | 5% |

Frame vs infill 69 apart, roof vs infill 66: reads from any distance.

*Cream & spruce*: infill white_terracotta 60 / smooth_sandstone 25 / birch_planks 15 (L 72–86),
frame spruce_log + stripped_spruce_log rails, roof spruce 70 / dark_oak 30, foundation stone bricks with
mossy 20%. *Pastel* (community favourite): dark_oak_log frame, white_terracotta with pink_terracotta
panels, dark_oak roof, deepslate_bricks base.

**Kit** (✓ jetty and close studding rendered)

```js
const plaster = kit.palette({ calcite: 5, white_terracotta: 2 }, { scale: 3 })
b.box([x0, g + 4, z0], [x1, g + 4, z1 + 1], 'spruce_planks')                         // floor deck, jettied +1 south
for (let x = x0; x <= x1; x += 2) b.set(x, g + 3, z1 + 1, 'dark_oak_stairs[facing=north,half=top]') // brackets
b.timberWall([x0, g + 5, z1 + 1], [x1, g + 8, z1 + 1], { frame: 'dark_oak_log', infill: plaster, postEvery: 2 })  // close studding
b.window([x0 + 3, g + 6, z1 + 1], 'south', { width: 3, height: 2, recess: 1, mullion: 'dark_oak_fence', material: 'dark_oak' })
b.roof({ x0, z0, x1, z1: z1 + 1, y: g + 9, axis: 'z', material: 'deepslate_tile', pitch: [1, 1, 2], eaveTrim: true,
  gable: (x, y, z) => ((x - x0) % 2 === 0 ? 'dark_oak_log[axis=y]' : plaster) })     // studded gable
```

**Detail:** posts every 2 (prestige) or 4 (plain); rails at floor, sill and head height; braces only in
large end panels (see the brace rule above); oriel = 3-wide bay out 1 with stair brackets and its own
mini roof; tall 2×1 brick stacks with `brick_wall` pots.

**Mistakes:** braces in small panels (dotted noise); white concrete daub; frame and infill of similar
value (oak log on oak planks: 19 apart); no jetty on multi-storey townhouses; grids with no rhythm change
between floors.

**Ground:** cobble/stone-brick streets with andesite and gravel worn into the centre, slab gutters,
shop signs, hanging lanterns, window boxes, a market square with a well.

### 1.3 Castle / keep

**Identity:** walls you could not climb, towers that stick out to watch them, one keep above all.

**Silhouette**
- Keep tallest (20–35); curtain walls 8–14 tall, **3 thick at the base tapering to 2**, battered foot;
  towers rise 3–6 above the wall walk and project 2–4 beyond the wall face; round towers 7–11 across,
  square 6–9; a tower every 15–30 blocks of wall; gatehouse = the richest pair of towers.
- Break the skyline: different tower heights, cone roofs against open battlements, turrets on corbels.
- Great hall ceiling 10–12.

**Signature:** crenellations ≥ 2 tall (cover), corbelled parapets/machicolations on upside-down stairs,
arrow slits, portcullis, drawbridge, banners, conical or pyramidal tower roofs, string courses.

**Palettes**

*Grey castle*

| Role | Blocks (mix) | L\* | Share |
|---|---|---|---|
| Foundation / batter | deepslate_bricks 35 / cobbled_deepslate 25 / cobblestone 25 / mossy_cobblestone 15 | 30–53 | 12% |
| Wall (ramp, light → dark) | andesite, polished_andesite, stone_bricks, cracked_stone_bricks, tuff_bricks, cobbled_deepslate | 57 → 33 | 55% |
| Trim | polished_andesite / chiseled_stone_bricks bands every ~6; `stone_brick_slab` copings | 56 | 6% |
| Crenels | stone_bricks + `stone_brick_wall` caps; upside-down `stone_brick_stairs` corbels | 51 | 5% |
| Roofs | deepslate_tile (cones), dark_oak or spruce (halls) | 23 / 20 | 15% |
| Accent / light | red/blue banners, `iron_bars` portcullis, chain, lantern, soul_lantern | – | 3% |

*Dark keep*: walls deepslate_bricks 50 / deepslate_tiles 20 / cobbled_deepslate 15 /
cracked_deepslate_bricks 10 / tuff_bricks 5, **with polished_tuff (43) bands and tuff-brick crenels** —
an all-deepslate mass renders as a black silhouette (✓ the tuff trim fixed it). *Warm limestone*
(crusader): sandstone 40 / smooth_sandstone 30 / cut_sandstone 20 / end_stone_bricks 10, granite base.
*Brick (Baltic)*: bricks 60 / granite 15 / mud_bricks 15 / polished_granite 10, calcite bands,
oxidized-copper spires.

**Kit** (✓ wall ramp and dark keep rendered)

```js
b.box([x0, g, z0], [x1, g + 11, z0 + 2], 'white_wool')                                  // 3-thick curtain
b.battlements([x0, z0], [x1, z0 + 2], g + 12, 'white_wool', { period: 2, height: 2 })
b.texture([x0, g, z0], [x1, g + 13, z0 + 2],
  ['andesite', 'polished_andesite', 'stone_bricks', 'cracked_stone_bricks', 'tuff_bricks', 'cobbled_deepslate'],
  { only: 'white_wool', focus: [[gateX, g + 2, z0 + 2]] })
b.cylinder([tx, g, tz], 4.5, 18, 'stone_bricks')                                          // round tower Ø9
b.coneRoof([tx, g + 18, tz], 4.5, { material: 'deepslate_tile', pitch: 2, overhang: 1, finial: ['spruce_fence', 'red_banner'] })
```

**Detail:** merlon patterns 1:1 (`period: 2`) or 2 solid : 1 gap; parapet pushed out 1 on a row of
`stone_brick_stairs[half=top]`; arrow slits 1×3 (cross slits on keeps); portcullis of `iron_bars`; string
courses every 5–8; buttresses every 6–10 on long walls; mossy low and on north faces, cracked high.

**Mistakes:** thin, short walls ("a fancy fence"); towers flush with the wall; one tower height and one
roof everywhere; perfectly symmetric window rows; huge empty courtyards; all-grey with no ramp;
cobblestone-only castles (busy); unlit castles.

**Ground:** high ground with one approach; moat with lily pads; stone bridge; cleared ground at the
wall foot; switchback road; rock outcrops grading stone → andesite → tuff → gravel. See
`assets/examples/castle.mjs`.

### 1.4 Fortified town

Irregular ring wall 6–10 tall following the terrain, towers every 20–40, 1–3 gatehouses; inside, 2–4
storey houses touching side by side, gables to narrow (3–5) winding streets, ±2 blocks of height
variation, one landmark (church spire or keep) on the high point. Use one stone, one roof material and
one window kit for every building; vary footprint, roof axis, infill colour and one accent per house.
Mistakes: grid streets, equal house sizes, wide streets, no landmark. See [composition.md](composition.md).

## 2. Nordic / Viking

### 2.1 Longhouse

**Identity:** a long, low hall that is almost all roof.

**Silhouette**
- Length : width 2.5–4 : 1 (9×25, 11×33, 13×41).
- Side walls only 2–3 tall on a 1-course stone plinth; **roof ≈ ⅔ of the height**, eaves 2–3 above
  grade, pitch `[1, 1, 2, 2, 2]` (✓).
- Ridge sags toward the middle (hogback) — use the ridge-slab swap above; optional 1-block outward bow
  of the long walls at mid-length.
- Few or no windows; doors on the long side or gable.

**Signature:** crossed gable horns or dragon heads at both apexes, external posts every 3, turf or
shingle roof, carved door frame, shields (banners), smoke hole.

**Palettes**

*Dark timber hall* (community top-3 palette: spruce log/stripped spruce/barrel + deepslate tiles/bricks)

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Plinth | cobblestone 40 / mossy_cobblestone 25 / cobbled_deepslate 20 / andesite 15 | 33–53 | 12% |
| Wall | stripped_spruce_log `axis` along the wall 60 / spruce_planks 40 | 40 | 15% |
| Posts | spruce_log every 3, dark_oak_log at corners | 17 / 20 | 8% |
| Roof | dark_oak 60 / spruce 30 / deepslate_tile 10 (shingle variation) | 20 | 55% |
| Gable / horns | spruce_planks gable; dark_oak_fence or stairs horns | 38 | 4% |
| Accent / light | barrel, banners as shields, campfire, lantern | – | ≤ 5% |

*Turf farmstead*: same walls; roof surface `moss_block` / `grass_block` stepped over a `spruce` stair eave
row, topped with `moss_carpet`, `short_grass`, `fern`; birch-bark (`birch_log`) barge boards. Turf is
not a stair family: build the roof in spruce (gable in logs, not planks), then repaint everything inside
the wall lines (✓ reads as turf; the spruce eave row stays as the edge):

```js
const r = b.roof({ x0, z0, x1, z1, y: g + 3, axis: 'x', material: 'spruce', pitch: [1, 1, 2, 2, 2], eaveTrim: true, gable: 'stripped_spruce_log[axis=y]' })
b.box([x0 - 1, g + 3, z0], [x1 + 1, r.topY, z1], kit.palette({ moss_block: 3, grass_block: 2, rooted_dirt: 1 }), { only: ['spruce_stairs', 'spruce_planks', 'spruce_slab'] })
b.scatter({ x0: x0 - 1, z0, x1: x1 + 1, z1, density: 0.35, paints: [[6, 'short_grass'], [2, 'fern'], [1, 'moss_carpet']] })
```

*Snowy*: add `snow[layers=1|2]` on roof tops and ridge, spruce trees, packed ice.

**Kit** (✓)

```js
b.box([x0, g, z0], [x1, g, z1], kit.palette({ cobblestone: 3, mossy_cobblestone: 2, cobbled_deepslate: 1 }, { scale: 2 }))
b.walls([x0, g + 1, z0], [x1, g + 2, z1], 'stripped_spruce_log[axis=x]')
for (let x = x0; x <= x1; x += 3) for (const z of [z0, z1]) b.box([x, g, z], [x, g + 2, z], 'spruce_log[axis=y]')
const r = b.roof({ x0, z0, x1, z1, y: g + 3, axis: 'x', material: 'dark_oak', pitch: [1, 1, 2, 2, 2], eaveTrim: true, gable: 'spruce_planks' })
// sag the middle 60% of the ridge (see "Hogback ridge"), then horns: a V of fences at each gable apex
for (const gx of [x0 - 1, x1 + 1]) for (const [dy, dz] of [[1, 1], [2, 2]]) {
  b.set(gx, r.topY + dy, ridgeZ - dz, 'dark_oak_fence'); b.set(gx, r.topY + dy, ridgeZ + dz, 'dark_oak_fence')
}
```

**Mistakes:** normal wall height with a small roof (reads as a barn); light oak/birch; dead-straight
ridge on a 30-long hall; glass windows.

**Ground:** fjord shore or hillside; jetty on posts; a longship; drying racks (fences + banners); dry-stone
field walls (`cobblestone_wall`); spruce forest; ground of `stone` / `andesite` / `gravel` / `coarse_dirt` /
`podzol` with snow in cold biomes; standing rune stones (`chiseled_stone_bricks`).

### 2.2 Stave church

**Identity:** a small timber church that is a stack of steep roofs.

**Silhouette:** footprint 9×13 – 15×21; total height 2.5–4× width; **3–5 roof tiers** (pitch 2, each
tier's walls stepped in 1–2 per side, eaves 3–6 above the tier below); central bell turret with a spire
≈ ⅓ of the total height; a low lean-to gallery (`shed` roof, pitch 1) around the base; apse with its own
small cone.

**Signature:** dragon heads at upper gable ends, dark tarred shingles, carved portal, tiny round
windows high up, crossed gable boards.

**Palette:** walls `stripped_dark_oak_log[axis=y]` 60 / dark_oak_planks 40 (L 20–25, vertical boards);
posts dark_oak_log; roofs deepslate_tile 50 / dark_oak 40 / blackstone 10 (L 15–23); plinth cobblestone /
mossy / stone; accents `bell`, a red door (`crimson_door`), lanterns. Everything dark, so the value
contrast comes from the lit roof tops vs shadowed eaves — keep eaves deep (`eaveTrim: true`, overhang 1).

**Kit:** stack `b.roof({ type: 'gable', pitch: 2, axis, material: 'deepslate_tile', eaveTrim: true })` per
tier, largest first, then the tower with `b.roof({ type: 'pyramid', pitch: 3, overhang: 0 })`; gallery
`b.roof({ type: 'shed', pitch: 1, rises: <toward the nave> })`.

**Mistakes:** fewer than 3 tiers (a plain chapel), equal-size tiers, light woods, no spire.
**Ground:** churchyard wall of `cobblestone_wall`, gravel path, birch and spruce, headstones of
`andesite_wall` / `cobblestone_wall`.

## 3. Fantasy

Good fantasy exaggerates real architecture (taller, steeper, more organic); it does not ignore it.

### 3.1 Elven (high halls and wood-elf treehouses)

**Identity:** slender, curved, pale or living-wood architecture that looks grown.

**Silhouette:** towers 3–7 wide and 25–60 tall (height ≥ 4× width); oval/round plans; arches instead
of rectangular openings; tall pointed or leaf-shaped windows (1×4, 3×7); bell-cast or very steep cones;
bridges and terraces; no 90° corners where a curve or chamfer will do.

**Signature:** sweeping ribs (stripped logs) from ground to roof, flared copper roofs, terraces with
fountains, lanterns hung from branches; gold only as thin filigree.

**Palettes**

*High elven*

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Base | polished_diorite 40 / diorite 30 / calcite 30 | 76–89 | 10% |
| Wall | calcite 60 / smooth_quartz 25 / quartz_bricks 15 | 89–92 | 45% |
| Ribs / frame | stripped_birch_log 60 / quartz_pillar 40 | 72 / 92 | 10% |
| Roof | oxidized_cut_copper 60 / weathered_cut_copper 25 / prismarine 15 (or dark_prismarine for more contrast) | 57–62 | 25% |
| Accent / light | gold_block ≤ 1%, light_blue/white stained glass panes, sea_lantern, verdant_froglight, end_rod | – | 5% |

Roof ~30 below the walls; add deep shadowed arcades — an all-white elven build without recesses has no
value structure.

*Wood elf*: base mossy_stone_bricks / mossy_cobblestone / moss_block (43–50); walls stripped_birch_log /
birch_planks / stripped_oak_log (62–72); trunks dark_oak_log or spruce_log (17–20); roofs of leaves
(`azalea_leaves`, `flowering_azalea_leaves`, `oak_leaves` — persistent is set by `finish()`) over a
`dark_oak` stair edge; vines, `glow_lichen`, `spore_blossom`, `cave_vines[berries=true]` lights.

*Moon elf*: calcite + light_blue_terracotta (lavender grey 47) + amethyst accents + purpur trim +
stripped_warped_stem ribs (57, teal) + pearlescent_froglight.

**Kit** (✓ bell-cast copper cone and rib pilasters; a free `b.curve` rib read as a detached pole)

```js
b.cylinder([cx, g, cz], 3.5, 24, kit.palette({ calcite: 6, smooth_quartz: 2, quartz_bricks: 1 }))
b.coneRoof([cx, g + 24, cz], 3.5, { material: 'oxidized_cut_copper', pitch: [0.5, 0.5, 1, 2, 3, 3], overhang: 2, finial: 'lightning_rod' })
for (const [dx, dz, f] of [[-4, 0, 'east'], [4, 0, 'west'], [0, -4, 'south'], [0, 4, 'north']]) {        // 4 rib pilasters
  b.box([cx + dx, g + 1, cz + dz], [cx + dx, g + 22, cz + dz], 'stripped_birch_log[axis=y]')
  b.set(cx + dx, g, cz + dz, `quartz_stairs[facing=${f},half=bottom]`)                                   // flared foot
}
```

Treehouses: `b.tree(base, 'fantasy' | 'big_oak' | 'dark_oak', { height, trunk })` for a 3×3–5×5 trunk,
platforms of slabs ringing it every 6–10 blocks, `b.spiralStairs` of slabs around the trunk, rope bridges
of `*_slab` + `chain` rails sagging 1 at mid-span.

**Mistakes:** boxy footprints; squat proportions; too much gold or any concrete; white everything with
no dark roof or recess.

**Ground:** old forest with custom trees in three sizes, waterfalls and pools, `fern`, `large_fern`,
`moss_carpet`, `azalea` bushes, `lily_of_the_valley`, `allium`, `blue_orchid`; winding paths of
`polished_diorite` / `calcite` slabs — never straight.

### 3.2 Dwarven / underground hold

**Identity:** monumental, angular, symmetric halls carved out of the mountain, lit by fire and lava.

**Silhouette:** gate in a cliff face 7–15 wide × 11–25 tall framed by 2–4 stepped jambs; flanking
statues 15–30 tall; halls 15–40 wide and tall; **square or octagonal piers 3×3 – 7×7**, spaced 2–3 pier
widths; 45° chamfers, stepped (corbelled) arches and vaults; bridges over chasms.

**Signature:** geometric inlays (diamonds, chevrons) in floors and walls, runic bands
(`chiseled_deepslate`, `chiseled_polished_blackstone`), braziers, lava behind `iron_bars`, gold and copper
trim, huge doors.

**Palette** (community: deepslate tiles/bricks + polished deepslate + basalt; gold used sparingly)

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Floor | polished_deepslate 50 / deepslate_tiles 30 + inlays of polished_andesite / gold | 31 / 23 | 25% |
| Wall | deepslate_bricks 50 / deepslate_tiles 25 / cobbled_deepslate 15 / cracked_deepslate_bricks 10 | 30 | 40% |
| Piers | polished_basalt[axis=y] 50 / polished_deepslate 50; caps `deepslate_brick_stairs` | 38 / 31 | 15% |
| Trim | polished_blackstone_bricks bands, chiseled_deepslate runes, gilded_blackstone ≤ 3% | 18–23 | 10% |
| Light trim (needed!) | polished_andesite / stone_bricks / tuff_bricks bands at eye height | 43–56 | 5% |
| Accent / light | gold_block ≤ 1%, cut_copper pipes, lava + iron_bars, lantern, shroomlight, magma_block | – | 5% |

Alternative *mountain hall*: stone_bricks 40 / polished_andesite 30 / andesite 15 / tuff_bricks 15 walls,
polished_andesite piers, smooth_stone + polished_andesite checker floor, coal_block inlays, iron plates.

**Mistakes:** one dark block everywhere (add a lighter trim band and strong light pools); gold everywhere;
low ceilings; organic curves (that is elven).

**Ground:** cliffs grading stone → andesite → tuff → deepslate downward; a paved road to the gate;
`pointed_dripstone`, `dripstone_block`, ore specks in cave walls; waterfalls.

### 3.3 Wizard tower

**Identity:** an implausibly tall, thin tower that grows wider toward the top and wears a witch hat.

**Silhouette:** diameter 7–13, height 4–8× diameter; stone shaft, then 1–3 timber storeys **flaring out
1 block per storey** on corbels; balcony rings; one or two side turrets at different heights; cone roof
≥ 2× as tall as wide (pitch 3, overhang 2); optional slight offset per segment or a 1-block tip curl.

**Signature:** observatory or open top, floating crystals (`amethyst_cluster`, `end_rod`), spiral outer
stair, irregular arched windows with purple/blue glass, chains and hanging cages.

**Palettes**

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Base | cobbled_deepslate 40 / deepslate_bricks 30 / mossy_cobblestone 15 / tuff 15 | 30–48 | 10% |
| Shaft (ramp, light → dark) | andesite, stone_bricks, cracked_stone_bricks, mossy_stone_bricks, tuff_bricks | 57 → 43 | 35% |
| Upper storeys | calcite infill (89) in dark_oak_log frame (20) | 89 / 20 | 15% |
| Roof | deepslate_tile — or purpur for a purple hat (the only purple stair family) | 23 / 58 | 30% |
| Accent / light | amethyst_block, purple/magenta stained glass panes, soul_lantern, pearlescent_froglight, candles | – | 5% |

*Amethyst & calcite* (community): calcite + polished_diorite walls, polished_basalt trim, deepslate_tile
roof, amethyst accents, pearlescent_froglight. *Dark sorcerer*: blackstone / polished_blackstone_bricks
shaft, crying_obsidian accents, deepslate_tile roof, soul fire only.

**Kit** (✓ rendered as written; full build in `assets/examples/wizard-tower.mjs`)

```js
b.cylinder([cx, g, cz], 4.5, 20, 'white_wool')                                       // shaft, textured later
b.cylinder([cx, g + 20, cz], 5.5, 6, kit.palette({ calcite: 4, white_terracotta: 1 }))  // flared study
b.ring([cx, g + 19, cz], 5.5, (x, y, z) => `dark_oak_stairs[facing=${kit.facingFrom(cx - x, cz - z)},half=top]`) // corbels, tall side to the shaft
b.coneRoof([cx, g + 26, cz], 5.5, { material: 'deepslate_tile', pitch: 3, overhang: 2, finial: 'end_rod' })
b.texture([cx - 5, g, cz - 5], [cx + 5, g + 19, cz + 5], ['andesite', 'stone_bricks', 'cracked_stone_bricks', 'tuff_bricks', 'cobbled_deepslate'], { only: 'white_wool' })
```

**Mistakes:** a straight uniform cylinder with a small hat; a shallow cone (reads as a lighthouse — pitch
1); one dark material (silhouette goes flat); purple concrete.

**Ground:** a lone crag or cliff edge; twisted dead trees (`b.tree(…, 'dead')`), mushrooms, mycelium and
podzol patches, standing stones, a crooked path.

### 3.4 Cottagecore / fairy / mushroom houses

**Identity:** small, round, overgrown, hand-made.

**Silhouette:** footprint 5×5 – 9×11; walls 3–4; **oversized roof 60–70% of the height**, curved or
bell-cast (`[0.5, 1, 2, 2]` ✓), eave corners drooping; asymmetric; leaning chimney; round door and
windows; mushroom houses = stem trunk + cap.

**Palettes**

*Cottagecore* (community favourites: moss + dark oak + green terracotta; dark oak + pink/white terracotta)

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Foundation | mossy_cobblestone 50 / cobblestone 25 / moss_block 25 | 43–53 | 10% |
| Wall | white_terracotta 50 / birch_planks 30 / stripped_birch_log 20 | 72–75 | 30% |
| Frame | dark_oak_log / spruce_log, slightly crooked | 17–20 | 10% |
| Roof (thatch) | bamboo_mosaic 40 / bamboo 30 / birch 30, `hay_block` ridge | 70–72 | 35% |
| Accent | flowering_azalea_leaves, red_mushroom_block spots, pink terracotta ≤ 3% | – | 8% |
| Light | lantern, `cave_vines[berries=true]`, candles, ochre_froglight | – | – |

The thatch is light (70) and the walls light (75): give contrast with the dark frame, deep eaves and a
mossy base, or swap the roof to `dark_oak` / moss for a dark-roof variant.

*Mushroom house*: cap `red_mushroom_block` (45, vivid red with texture) with `mushroom_stem` spots;
trunk `mushroom_stem` (80) / white_terracotta; base moss / rooted_dirt; `shroomlight` windows. Mushroom
blocks have six booleans (`north|south|east|west|up|down`): `true` shows the skin, `false` the pores — keep
every exposed face `true` (the defaults are all `true`).

**Kit** (✓)

```js
b.roof({ x0, z0, x1, z1, y: g + 4, material: 'bamboo_mosaic', pitch: [0.5, 1, 2, 2], eaveTrim: true, gable: 'white_terracotta' })
b.ellipsoid([cx, g + 7, cz], [5, 3, 5], 'red_mushroom_block', { hollow: true })     // mushroom cap
b.overgrow([x0 - 1, g, z0 - 1], [x1 + 1, g + 8, z1 + 1], { amount: 0.25, moss: true })
```

**Mistakes:** saturated concrete/wool (toy, not fairy); symmetric and clean; no moss or flowers; big
scale (charm needs cottage scale).

**Ground:** flower meadows (`poppy`, `dandelion`, `oxeye_daisy`, `cornflower`, `allium`, `azure_bluet`,
`pink_petals`), berry bushes, vegetable beds, a loose cobble/gravel path, a pond, giant mushrooms,
`azalea` shrubs, stepping-stone slabs, stumps; let flowers spill to the door.

## 4. Gothic (cathedral, chapel, dark gothic)

**Identity:** height, light and pointed arches, held up by buttresses you can see.

**Silhouette**
- Latin-cross plan: nave + aisles, transept, choir, rounded or polygonal apse; twin west towers with a
  rose window between them (see `assets/examples/gothic-cathedral.mjs`).
- Cathedral nave 9–15 wide, walls 25–45 tall (2.5–3× the nave width); aisles half the nave height
  under `shed` roofs at pitch 0.5; nave roof `gable` pitch 2 (✓); west towers 1.5–2× nave height, spires
  another 1–1.5× tower height (`pyramid` pitch 3 ✓).
- **Bay rhythm 5–7 blocks:** buttress pier + tall window + pinnacle, repeated 6–12 times.
- Chapel: single nave 7–11 wide × 15–30 long, walls 10–16, buttress every bay, small bell tower or
  flèche (✓ 9×21 chapel with pitch-2 roof, buttresses every 5, pinnacles, pointed windows reads at once).

**Signature:** pointed (lancet) windows 1×5 – 5×15, rose window, flying buttresses with pinnacles,
recessed portals (3–4 nested pointed arches), tracery, gargoyles, ribbed vaults inside.

**Palettes**

*Light limestone*

| Role | Blocks (mix) | L\* | Share |
|---|---|---|---|
| Plinth | stone_bricks 40 / cobblestone 20 / andesite 20 / mossy_stone_bricks 20 | 50 | 8% |
| Wall (ramp, light → dark) | andesite, polished_andesite, stone_bricks, cracked_stone_bricks, tuff_bricks | 57 → 43 | 45% |
| Piers, ribs, buttresses | polished_andesite / chiseled_stone_bricks / smooth_stone | 50–65 | 12% |
| Tracery, string courses | calcite / polished_diorite; `stone_brick_wall` and `andesite_wall` mullions | 78–89 | 5% |
| Roof | deepslate_tile 70 / cobbled_deepslate 15 / polished_blackstone 15 — or oxidized_cut_copper (green patina) | 23 / 58 | 25% |
| Glass | stained glass panes in 2–3 colours (blue + red + yellow), rose window in full stained glass blocks | – | 4% |
| Light | lantern, `candle[candles=1..4,lit=true]` | – | – |

*Dark gothic* (community: deepslate tiles + dark oak + blackstone + basalt): walls deepslate_bricks 50 /
polished_deepslate 20 / deepslate_tiles 15 / cracked_deepslate_bricks 15 (L 22–31); piers
polished_blackstone_bricks / polished_basalt[axis=y]; **tracery and copings in tuff_bricks or
polished_tuff (43) — mandatory for legibility**; roof blackstone / deepslate_tile; glass red, purple,
gray panes and `tinted_glass`; soul lanterns, soul campfire braziers. *Brick gothic* (Northern Europe):
bricks 60 / granite 15 / mud_bricks 15 / polished_granite 10, calcite blind panels, copper spires.

**Kit** (✓ chapel)

```js
b.box([x0, g, z0], [x1, g + 12, z1], kit.palette({ stone_bricks: 4, polished_andesite: 1, andesite: 1, tuff_bricks: 1 }, { scale: 2 }))
b.roof({ x0, z0, x1, z1, y: g + 13, axis: 'z', material: 'deepslate_tile', pitch: 2, overhang: 1, eaveTrim: true, gable: 'stone_bricks' })
for (let z = z0 + 2; z <= z1 - 2; z += 5) {                                   // bay = 5
  b.box([x0 - 1, g, z], [x0 - 1, g + 10, z], 'stone_bricks')                   // pier
  b.box([x0 - 2, g, z], [x0 - 2, g + 6, z], 'stone_bricks')                    // stepped buttress
  b.set(x0 - 2, g + 7, z, 'stone_brick_stairs[facing=east,half=bottom]')
  for (const dy of [11, 12]) b.set(x0 - 1, g + dy, z, 'stone_brick_wall'); b.set(x0 - 1, g + 13, z, 'lightning_rod') // pinnacle
  if (z + 4 <= z1) b.arch([x0, g + 3, z + 1], [x0, g + 3, z + 3], 'polished_andesite', { type: 'pointed', depth: 1, fill: 'purple_stained_glass_pane' })
}
b.arch([x0 + 2, g, z1], [x1 - 2, g, z1], 'polished_andesite', { type: 'pointed', depth: 1, fill: 'air' })   // west portal
```

**Detail:** flying buttress = free pier 3–6 out from the wall, flyer of upside-down stairs climbing to
the clerestory; rose window = circle of glass blocks in an upside-down-stair frame, 3 deep (panes read too
thin); crockets = single stairs on spire edges; gargoyle = 1–2 stairs + `skeleton_skull` at the cornice;
ribbed vault = upside-down stair ribs crossing the ceiling diagonally.

**Mistakes:** round arches and squat walls (that's Romanesque); small windows; no buttresses; spires
too short; all-black dark gothic with no lighter trim; rainbow glass everywhere.

**Ground:** a paved close (`stone_bricks`, `polished_andesite`, `smooth_stone_slab`); graveyard with
`andesite_wall` headstones, mossy tombs, `cobweb`s, dead trees on `podzol` / `coarse_dirt`; iron fences
(`iron_bars`).

## 5. East-Asian

### 5.1 Roof grammar (all East-Asian styles)

- **Deep curved eaves are the style.** Profile from the eave inward: shallow slabs first, steepening to
  the ridge; overhang 2 (3–4 on temples); corners lifted half a block. In the kit: `type: 'hip'`,
  `pitch: [0.5, 0.5, 1, 1]`, `overhang: 2` ✓. A trailing `2` on a hip makes a ziggurat spike — steep rows
  only on gables or the top gable of an irimoya.
- **Irimoya (hip-and-gable)** = hip skirt + small gable on the inner core (✓, verified recipe above);
  **kirizuma** = plain gable with the same profile (✓ `[0.5, 0.5, 1, 1, 2]`); **yosemune** = hip.
- Make the top wall course a dark beam (`stripped_dark_oak_log[axis=x|z]`) — it hides the soffit gap and
  is authentic.
- Corner lift beyond the kit profile: `assets/examples/japanese-shrine.mjs` builds its own roof
  heightfield with lifted corners and a hip bead — copy it for hero roofs.
- Posts always visible; walls are screens between posts; floor raised 1–3 on posts or a stone plinth.

```
eave  2 out  1 out  wall           ridge
 ▁▁    ▁▁     ▄      ▟  ▟  █  █        profile [0.5, 0.5, 1, 1, 2]  (gable)
 slab  slab   stair  stairs → blocks
```

### 5.2 Pagoda

**Silhouette:** **odd tiers (3 or 5)**, footprint 7×7 – 15×15 (odd), each tier 1 smaller per side
(✓ radii 4/3/2), storeys 4–5 tall, every tier with a 2-deep eave skirt; total height 3–4× base width; a
mast finial ¼–⅓ of the height (`chain` + `lightning_rod`, gold rings); stone platform 2–4 high with steps.

**Palette**

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Platform | stone_bricks 40 / andesite 25 / polished_andesite 20 / mossy_stone_bricks 15 | 50–57 | 10% |
| Wall screens | white_concrete_powder 40 / calcite 40 / white_terracotta 20 | 75–90 | 15% |
| Posts / beams | stripped_mangrove_log (brick red) — or dark_oak_log for natural wood | 31 / 20 | 15% |
| Roof skirts | deepslate_tile (+ polished_deepslate stairs 15%) | 23 | 50% |
| Ridge / finial | polished_blackstone, chain, lightning_rod, gold_block rings | 21 | 5% |
| Light | lantern on chains at eave corners | – | – |

**Kit** (✓)

```js
const tiers = [{ r: 4, h: 5 }, { r: 3, h: 4 }, { r: 2, h: 4 }]
let y = g + 1
b.box([cx - 6, g - 1, cz - 6], [cx + 6, g, cz + 6], 'stone_bricks')
tiers.forEach((t, i) => {
  const [x0, x1, z0, z1] = [cx - t.r, cx + t.r, cz - t.r, cz + t.r]
  b.walls([x0, y, z0], [x1, y + t.h - 1, z1], 'white_concrete_powder')
  for (const [px, pz] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1]]) b.box([px, y, pz], [px, y + t.h - 1, pz], 'stripped_mangrove_log[axis=y]')
  b.walls([x0, y + t.h - 1, z0], [x1, y + t.h - 1, z1], 'stripped_mangrove_log[axis=x]')       // eave beam
  const top = i === tiers.length - 1
  const r = b.roof({ x0, z0, x1, z1, y: y + t.h, type: top ? 'pyramid' : 'hip', material: 'deepslate_tile', pitch: top ? [0.5, 0.5, 1, 1, 2] : [0.5, 0.5, 1], overhang: 2, eaveTrim: true })
  if (top) for (let k = 1; k <= 4; k += 1) b.set(cx, r.topY + k, cz, k === 4 ? 'lightning_rod' : 'chain[axis=y]')
  y += t.h + 2
})
```

(The beam ring uses `axis=x` on all four sides for brevity; use `axis=z` on the east/west walls.)

**Mistakes:** even tier count; equal tiers; straight 45° roofs without brim; no finial; tall gaps between
tiers (a pagoda is a dense stack of roofs).

### 5.3 Shrine hall and torii

**Shrine:** 7×9 – 13×17; raised floor 1–3 on posts with a veranda (`spruce_slab` deck + `spruce_fence`
rail); irimoya roof 50–60% of the height with eaves 2–3 out; vermilion (stripped mangrove) or natural
(stripped spruce/dark oak) posts; white screens; deepslate-tile, dark-oak (cypress-bark) or oxidized-copper
roof; polished-blackstone ridge.

**Torii** (✓): two posts (hashira), tie beam (nuki) through the posts and 1 past them, upper lintel
(shimaki), black top lintel (kasagi) overhanging 2–3 past each post with upturned ends, black post
feet (nemaki), central tablet. Inner gap 5–7, posts 6–8 tall.

| Part | Block |
|---|---|
| Posts | `stripped_mangrove_log[axis=y]` (31, brick red); `red_concrete` (32, flat pure red) if you want flat |
| Feet | `polished_blackstone` (or `deepslate_tiles`) on a stone footing |
| Nuki, shimaki | `mangrove_planks` (mangrove is the only red family with stairs, slabs, fences, trapdoors) |
| Kasagi | `polished_blackstone_slab[type=bottom]` along the top; end stairs `polished_blackstone_stairs[facing=<outward>,half=bottom]` (tall side outward = upturn) |
| Tablet | `mangrove_planks` + `dark_oak_trapdoor[open=true,facing=<out>]` |

```js
for (const px of [tx, tx + 6]) { b.set(px, g, tz, 'polished_blackstone'); b.box([px, g + 1, tz], [px, g + 6, tz], 'stripped_mangrove_log[axis=y]') }
b.box([tx - 1, g + 4, tz], [tx + 7, g + 4, tz], 'mangrove_planks')                     // nuki
b.box([tx - 1, g + 7, tz], [tx + 7, g + 7, tz], 'mangrove_planks')                     // shimaki
b.box([tx - 2, g + 8, tz], [tx + 8, g + 8, tz], 'polished_blackstone_slab[type=bottom]') // kasagi
b.set(tx - 3, g + 8, tz, 'polished_blackstone_stairs[facing=west,half=bottom]')
b.set(tx + 9, g + 8, tz, 'polished_blackstone_stairs[facing=east,half=bottom]')
```

Approach: a row of torii 1–2 apart (Fushimi style), stone lanterns (`stone_brick_wall` post + `lantern`
firebox + `stone_brick_slab` cap) lining a gravel path, a water basin (`water_cauldron` under a tiny roof).

### 5.4 Minka and machiya (houses)

Minka: single or 1.5 storeys under a **massive steep thatch (60°+)**, low eaves, dark timber, white or
earth walls, engawa veranda, raised floor. Machiya: narrow, 2 storeys, wooden lattice front, tiled roof
with a pent eave between floors.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Base | cobblestone / andesite / stone | 53–57 | 8% |
| Walls | white_terracotta 50 / calcite 30 / packed_mud 20 | 48–89 | 20% |
| Frame | dark_oak_log / stripped_dark_oak_log / spruce_log | 17–25 | 12% |
| Thatch | bamboo_mosaic 40 / bamboo 20 / spruce 20 / `hay_block` ridge 20 — or dark_oak for old thatch | 38–71 | 50% |
| Screens | `spruce_trapdoor` / `birch_trapdoor` lattice over `white_stained_glass_pane` | – | 5% |

Kit: `b.roof({ type: 'gable', pitch: 2, material: 'bamboo_mosaic', overhang: 1, eaveTrim: true, gable: 'dark_oak_log[axis=y]' })`
for gassho thatch; machiya roofs `type: 'gable', pitch: [0.5, 1, 1]`, material `deepslate_tile`.

**Mistakes (all Japanese):** posts hidden inside walls; no raised floor; straight European 45° roofs;
frame lighter than the walls (frame must be darker); red on every building (vermilion belongs to
shrines and torii); missing overhang.

**Ground:** koi pond with irregular edges, `lily_pad`s, stepping stones (`smooth_stone_slab`); raked
`gravel` field with `andesite` / `tuff` boulders and moss islands; arched bridge of `mangrove_stairs`;
cherry trees with `pink_petals` beneath, pruned pines (flat `spruce_leaves` pads on `spruce_log`), bamboo
groves, `azalea`, `fern`.

### 5.5 Chinese palace / temple

**Silhouette:** strict axial symmetry (gate → courtyard → main hall → rear hall); halls broad and low,
odd number of bays (5/7/9, 3–5 blocks each), columns 6–10 tall; roof as tall as the column zone,
gentler curve than Japanese, **double eaves** on the most important hall; **white terrace 2–6 high**
with balustrades and a central stair; eaves 2–4 out.

**Signature:** red columns and walls; blue-green bracket sets (dougong) under the eaves with gold dots;
imperial yellow or grey/green tile roofs; lattice doors; moon gates; stone lions; pailou gates.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Terrace | smooth_quartz 40 / quartz_bricks 20 / calcite 20 / polished_diorite 20; `diorite_wall` balusters | 78–92 | 15% |
| Walls | red_terracotta 70 / red_concrete 20 / mangrove_planks 10 | 31–37 | 15% |
| Columns | stripped_mangrove_log / red_concrete; `stripped_dark_oak_log` lintels | 31 | 10% |
| Brackets | oxidized_cut_copper / warped / prismarine / dark_prismarine stairs and trapdoors | 36–62 | 7% |
| Roof | imperial yellow: bamboo_mosaic 50 / bamboo 30 / smooth_sandstone 20 (the only yellow stair families); or grey deepslate_tile; or green oxidized_cut_copper / prismarine | 70 / 23 / 58 | 45% |
| Ridge / accent | gold_block, honeycomb_block ornaments; lapis / blue_terracotta frieze panels | – | 4% |
| Light | lantern; red paper lanterns (`shroomlight` in a `mangrove_fence` cage) | – | – |

**Kit** (✓ double-eave hall; build order matters — the skirt is a full hip, so clear its middle)

```js
b.box([x0 - 3, g, z0 - 3], [x1 + 3, g + 2, z1 + 3], kit.palette({ smooth_quartz: 4, quartz_bricks: 2, calcite: 2, polished_diorite: 2 }))
b.walls([x0 - 3, g + 3, z0 - 3], [x1 + 3, g + 3, z1 + 3], 'diorite_wall')                                   // balustrade
for (let x = x0; x <= x1; x += 4) for (const z of [z0, z1]) b.box([x, g + 3, z], [x, g + 7, z], 'stripped_mangrove_log[axis=y]') // colonnade (same on x0/x1)
b.roof({ x0, z0, x1, z1, y: g + 8, type: 'hip', material: 'deepslate_tile', pitch: [0.5, 0.5, 1], overhang: 2, eaveTrim: true }) // lower eave
b.box([x0 + 2, g + 8, z0 + 2], [x1 - 2, g + 40, z1 - 2], 'air')                                            // keep only the skirt
const top = g + 12
b.walls([x0 + 2, g + 3, z0 + 2], [x1 - 2, top, z1 - 2], 'red_terracotta')
for (let x = x0 + 2; x <= x1 - 2; x += 1) for (const [z, f] of [[z0 + 1, 'south'], [z1 - 1, 'north']])
  b.set(x, top, z, `oxidized_cut_copper_stairs[facing=${f},half=top]`)                                       // bracket row (same on x sides)
b.walls([x0 + 2, top, z0 + 2], [x1 - 2, top, z1 - 2], 'stripped_dark_oak_log[axis=x]')
b.roof({ x0: x0 + 2, z0: z0 + 2, x1: x1 - 2, z1: z1 - 2, y: top + 1, type: 'hip', material: 'deepslate_tile', pitch: [0.5, 0.5, 1, 1], overhang: 3, eaveTrim: true })
```

`bamboo_mosaic` gives an imperial-yellow roof (✓ reads, but it is bright straw yellow, C\* 49 — keep it to
the one hero hall); `pitch: [0.5, 0.5, 0.5, 1]` makes a gentler, more Chinese curve than the Japanese
`[0.5, 0.5, 1, 1]`.

**Mistakes:** asymmetry; plain dark Japanese wood (Chinese palaces are colourful); saturated concrete
everywhere (red on columns/walls, blue-green on brackets only); flat or straight roofs; no terrace.
**Ground:** paved courtyards (stone bricks, polished andesite, smooth stone), symmetric trees, rockeries
(tall twisted `andesite` / `tuff` / `calcite`), lotus ponds, zig-zag bridges, willows (`b.tree(…, 'willow')`).

## 6. Mediterranean

### 6.1 Cycladic / Santorini

**Identity:** white cubes stacked down a cliff, flat roofs, one blue dome.

**Silhouette:** houses 5×5 – 9×11, 1–2 storeys (4–8), **flat roofs** that are the terrace of the house
above, clustered organically on terraces; barrel-vaulted roofs on some; **domes only on churches**
(blue domes are rarer than postcards suggest — one dome or blue trim accents, not blue houses);
exterior stairs everywhere; pierced bell walls.

**Palette** (✓ cluster)

| Role | Blocks (mix) | L\* | Share |
|---|---|---|---|
| Walls | white_concrete_powder 35 / calcite 35 / smooth_quartz 20 / white_concrete 10 (clumped; whites vary only in grain) | 85–92 | 60% |
| Parapets, steps | `smooth_quartz_slab`, `quartz_stairs`, `diorite_wall` caps | 92 | 8% |
| Roofs | flat smooth_quartz / white_concrete_powder; vaults `smooth_quartz` stairs+slabs | 90 | 10% |
| Dome | blue_concrete 60 / lapis_block 25 / blue_concrete_powder 15 (vivid) or light_blue_concrete | 25–30 | 5% |
| Doors, shutters | no door is blue: `warped_door` / `warped_trapdoor` (teal), or blue_concrete surrounds around birch/oak doors | – | 5% |
| Cliff | stone, andesite, tuff, basalt / blackstone (lava strata), granite / dripstone (red-brown strata) | 15–57 | 10% |

All-white walls have no value structure: contrast must come from **deep openings (recess 1–2), shadowed
alleys, stepped masses, the blue accent and the dark cliff**.

**Kit** (✓)

```js
const white = kit.palette({ white_concrete_powder: 3, calcite: 3, smooth_quartz: 2 }, { scale: 2 })
for (const [x, y, z, w, h, d] of cubes) {                                   // stacked, offset boxes
  b.box([x, y, z], [x + w - 1, y + h - 1, z + d - 1], white)
  b.walls([x, y + h, z], [x + w - 1, y + h, z + d - 1], 'smooth_quartz_slab[type=bottom]')   // parapet lip
}
b.cylinder([dx, dy, dz], 2.5, 1, white); b.dome([dx, dy + 1, dz], 2.5, 'blue_concrete')        // church dome on a drum
b.window([wx, wy, wz], 'south', { width: 1, height: 2, recess: 1, sill: false, shutters: 'warped_trapdoor' })
```

**Mistakes:** pitched roofs; one flat white block (plastic — mix 3 whites); blue everywhere; grid
layout; green lawns.

**Ground:** dry stone terraces and retaining walls, `coarse_dirt`, `gravel`, white-edged steps, sea
below, bougainvillea = `cherry_leaves` or `flowering_azalea_leaves` clumps over doors, pots, cypress
(narrow `spruce_leaves` columns). See `assets/examples/coastal-village.mjs`.

### 6.2 Tuscan / Spanish / Italian villa

**Identity:** warm stucco, low red-tile hip roofs, arcades and shutters.

**Silhouette:** rectangle or courtyard plan, 2–3 storeys; **low roofs ≈ 22–27° (`pitch: 0.5`, ✓ hip)**,
short overhang with rafter tails; arcaded loggia of round arches; a campanile tower on villas; deep
window reveals with shutters; small wrought-iron balconies.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Stucco | smooth_sandstone 40 / white_terracotta 30 / sandstone 15 / end_stone_bricks 15 | 75–87 | 45% |
| Base | stone_bricks / andesite / cobblestone / granite | 48–57 | 8% |
| Trim, quoins, arches | cut_sandstone, `smooth_sandstone_slab`, `sandstone_stairs` arches, calcite | 83–89 | 7% |
| Roof | brick 50 / mud_brick 20 / granite 15 / acacia 15 (sun-faded orange) | 47 | 30% |
| Shutters, rails | `dark_oak_trapdoor` / `spruce_trapdoor`, `iron_bars` balconies, `decorated_pot`s | – | 5% |

Stucco ~35 above the roof — the roof reads as a warm dark lid. *Andalusian* variant: walls calcite /
white_concrete_powder, brick roofs, `iron_bars` window grilles, blue/light-blue glazed terracotta tile
panels, courtyard fountain.

Kit: `b.roof({ type: 'hip', pitch: 0.5, material: 'brick', overhang: 1, eaveTrim: true })`;
loggia `b.arch(a, c, 'smooth_sandstone', { type: 'round' })` per bay on `quartz_pillar` or sandstone piers.

**Mistakes:** 45° roofs; a single white; no shutters or reveals; lawns. **Ground:** dry ground
(`coarse_dirt`, `gravel`, `dirt_path`), terraces, olive trees (twisted trunk + sparse `azalea_leaves` /
`birch_leaves`), cypress columns, vine pergolas (`spruce_fence` + `stripped_spruce_log` + `vine`), pots.

## 7. Desert, Arabian and Moorish

**Identity:** thick earth-coloured walls, flat roofs, shade, and jewel-coloured tile and domes.

**Silhouette**
- Cubic masses with **flat roofs and parapets**, small openings, courtyards (riad) with a fountain.
- Domes 5–15 across: hemispherical (`b.dome`) or onion (`b.lathe` with `kit.onionProfile`, radius ≥ drum
  radius + 1, height ≈ 2.5 r, contrasting material ✓); drums with small arched windows.
- Minarets 5×5 – 7×7, height 4–8× width, 1–3 corbelled balconies, onion or lantern top (✓).
- Arches: pointed and horseshoe; iwan (big arched portal in a rectangular frame) on palaces.

**Signature:** muqarnas (stepped upside-down stairs) under domes and portals; lattice screens; zellige
tile dados; stepped merlons; palms and water channels; bazaar awnings.

**Palettes**

*Sandstone town* (vanilla desert village; community: sand + sandstone + cut + chiseled + birch)

| Role | Blocks (mix) | L\* | Share |
|---|---|---|---|
| Walls | sandstone 45 / smooth_sandstone 35 / cut_sandstone 10 / end_stone_bricks 10 | 82–87 | 55% |
| Base | sandstone + granite / dripstone_block / brown_terracotta stains at the foot | 48–82 | 8% |
| Trim | cut_sandstone bands, chiseled_sandstone friezes, `sandstone_wall` parapets, `smooth_sandstone_slab` copings | 82 | 10% |
| Roof | flat smooth_sandstone; domes smooth_sandstone | 86 | 12% |
| Beams | stripped_birch_log / stripped_jungle_log ends poking out below the roofline | 58–72 | 5% |
| Accent | orange / cyan / blue terracotta tiles, carpet awnings on fences | 28–47 | 7% |
| Light | lantern, campfire, ochre_froglight | – | – |

All sandstone variants sit within 4 L\* of each other: they give texture, not value. Value comes from
shadowed openings, terracotta accents and dark doors.

*Moorish palace*: stucco white_terracotta 40 / smooth_sandstone 30 / calcite 20 / bone_block 10; dado of
glazed terracotta (`cyan_`, `light_blue_`, `white_`, `blue_glazed_terracotta`, rotated by `facing` per
cell into 2×2 rosettes); arches `smooth_sandstone_stairs` on `sandstone_wall` columns; domes gold_block /
oxidized_copper / light_blue_terracotta; screens `copper_grate` (a ready-made lattice), `iron_bars`; water
in prismarine basins.

*Adobe / mud brick* (community: mud bricks + packed mud + exposed copper + bricks + terracotta):
packed_mud 50 / mud_bricks 35 / terracotta 15 (L 46–48), `mud_brick_slab` copings and `mud_brick_wall`
parapets, `stripped_jungle_log` vigas protruding 1 below the roofline, exposed copper accents.

*Red mesa*: red_sandstone + smooth_red_sandstone walls (50–51), orange/brown terracotta upper storeys,
white_terracotta trim, red sand ground.

**Kit** (✓ minaret)

```js
b.cylinder([mx, g, mz], 2.5, 20, 'smooth_sandstone')                                 // 5-wide shaft
b.ring([mx, g + 14, mz], 3.5, 'smooth_sandstone_stairs[facing=north,half=top]')       // corbel row (uniform facing reads fine at this size)
b.disc([mx, g + 15, mz], 3.5, 'smooth_sandstone_slab[type=bottom]')                  // balcony floor
b.ring([mx, g + 16, mz], 3.5, 'sandstone_wall')                                       // balustrade
b.cylinder([mx, g + 19, mz], 1.5, 2, 'cut_sandstone')                                 // neck
b.lathe([mx, g + 21, mz], 8, kit.onionProfile(3.0, 8), 'oxidized_copper')            // onion: wider than the shaft, contrasting
b.set(mx, g + 29, mz, 'lightning_rod')
```

**Mistakes:** one sandstone everywhere; pitched wooden roofs; more than one jewel colour family
(earth + blue/turquoise + gold is the classic); lawns; big glass windows; onion domes the same colour and
radius as their drum (they disappear).

**Ground:** sand, red sand, `coarse_dirt`, `dead_bush`, `cactus`; oases grading grass → dirt → coarse
dirt → sand outward; palms (curved `jungle_log` trunk + leaf fronds), `sugar_cane`, `bamboo`; symmetric
garden channels with fountains.

## 8. Greek and Roman (classical)

**Identity:** a colonnade on a stepped platform under a low pediment.

**Silhouette**
- **Column height = 7–10 diameters** (Doric ~7, Ionic ~8–9, Corinthian ~10): a 1-wide column is 6–9
  tall; a 3-wide column 18–28. Gaps between 1-wide columns = 2 (✓); 3-wide columns 4–6.
- Stepped base (stylobate) of **3 steps**; front of 6 or 8 columns; colonnade 2+ deep from the cella wall
  so it throws shadow.
- **Entablature ≈ ¼ of column height in 3 bands**: architrave (plain), frieze (alternating blocks),
  cornice (projecting). **Pediment low:** `gable` pitch 0.5 with the gable facing the front (✓).
- Roman: round arches, barrel vaults, domes (dome span = height in the Pantheon), arcades (aqueduct
  spans 3–7 on piers 2–3), stacked orders.

**Palettes**

*Marble temple*

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Steps | smooth_quartz + `smooth_quartz_stairs/_slab` 60 / polished_diorite 25 / calcite 15 | 78–92 | 15% |
| Columns | `quartz_pillar[axis=y]`, capital chiseled_quartz_block or upside-down `quartz_stairs` ring | 90–92 | 20% |
| Cella | calcite 50 / quartz_bricks 30 / smooth_quartz 20 | 89–92 | 25% |
| Entablature | smooth_quartz architrave; frieze alternating chiseled_quartz_block / quartz_bricks; cornice upside-down quartz stairs | 90 | 10% |
| Roof | smooth_quartz (marble) — or brick / mud_brick (Roman red tile, L 47, gives the needed value contrast) | 92 / 47 | 25% |
| Accent | gold_block statues ≤ 1%, blue terracotta painted friezes, cut copper (bronze) doors | – | 3% |

All-quartz is one value (~91): the design lives in shadow — deep colonnade, recessed tympanum,
projecting cornice — or use a red-tile roof.

*Aged/ruined*: quartz_pillar 50 / diorite 25 / calcite 25 columns broken at varying heights, bone_block
and smooth_sandstone patches (yellowed marble), andesite at the base, vines, fallen drums
(`quartz_pillar[axis=x]`). *Roman brick*: bricks 40 / smooth_sandstone 30 (travertine) / tuff 15 /
granite 15, brick or mud-brick tile roofs, mosaic floors of terracotta colours.

**Kit** (✓ hexastyle temple)

```js
const W = 22, D = 28                                                               // column ring 16 x 22: spans are multiples of 3
for (let s = 0; s < 3; s += 1) b.box([x0 + s, g + s, z0 + s], [x0 + W - 1 - s, g + s, z0 + D - 1 - s], 'smooth_quartz')  // stylobate
const [cx0, cx1, cz0, cz1, y0, H] = [x0 + 3, x0 + W - 4, z0 + 3, z0 + D - 4, g + 3, 7]
for (let x = cx0; x <= cx1; x += 3) for (const z of [cz0, cz1]) b.column([x, y0, z], H, { shaft: 'quartz_pillar[axis=y]', capital: 'chiseled_quartz_block' })
for (let z = cz0 + 3; z < cz1; z += 3) for (const x of [cx0, cx1]) b.column([x, y0, z], H, { shaft: 'quartz_pillar[axis=y]', capital: 'chiseled_quartz_block' })
b.box([cx0 + 2, y0, cz0 + 3], [cx1 - 2, y0 + H - 1, cz1 - 3], 'calcite')                                    // cella
b.box([cx0, y0 + H, cz0], [cx1, y0 + H, cz1], 'smooth_quartz')                                              // architrave
b.box([cx0, y0 + H + 1, cz0], [cx1, y0 + H + 1, cz1], (x, y, z) => ((x + z) % 2 ? 'chiseled_quartz_block' : 'quartz_bricks')) // frieze
b.roof({ x0: cx0, z0: cz0, x1: cx1, z1: cz1, y: y0 + H + 2, axis: 'z', material: 'smooth_quartz', pitch: 0.5, overhang: 1, eaveTrim: true, gable: 'smooth_quartz' })
```

Keep `cx1 − cx0` and `cz1 − cz0` multiples of the column pitch (3) so columns land on the corners;
W = 22 gives 6 front columns (hexastyle) with a 2-wide central gap for the door. `b.column`
`flare: 'quartz'` adds stair bases/capitals around 1-wide shafts (reads as a fatter column).

**Mistakes:** spindly or stubby columns; columns spaced like a fence or touching; no entablature
(columns ending in the roof); steep roof; rainbow paint; one white block with no depth.

**Ground:** acropolis on a hill with retaining walls; agora paved in smooth stone / polished diorite /
calcite slabs; cypress and olive trees; statues; Roman roads of stone / andesite with kerbs; aqueducts.

## 9. Egyptian

**Identity:** monumental, symmetric, battered walls under a flat sky-line, in sandstone with gold
and lapis.

**Silhouette**
- Axis: sphinx avenue → pair of obelisks → **pylon gateway** (two wide, shallow, battered towers with a
  lower gate between) → courtyard → hypostyle hall → small dark sanctuary.
- Pylon towers wide and shallow (13 × 6 × 18 ✓), **batter 1 block per 6 rows** with a stair on every
  ledge, **cavetto cornice** of upside-down stairs; relief panels that follow the batter; flagpoles.
- Columns fat (3×3 – 5×5) and close (gap 1–1.5 diameters), papyrus capitals flaring 1.
- Obelisk height ≈ 9–10× base width, slight taper, gold pyramidion. Pyramids: 1:1 stairs or 2-up / 2-in
  steps with a gold capstone.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Walls (pylons, halls) | smooth_sandstone 50 / sandstone 25 / cut_sandstone 15 / end_stone_bricks 10 | 82–87 | 55% |
| Bands, cornice, frames | chiseled_sandstone (relief), cut_sandstone, `smooth_sandstone_stairs` cavetto | 82 | 12% |
| Columns | sandstone / cut_sandstone, capitals chiseled_sandstone + stairs, painted bands green/lime terracotta | 34–83 | 10% |
| Base | sandstone with granite / red_sandstone (Aswan granite) | 48–51 | 8% |
| Accent | blue_terracotta / light_blue_terracotta / lapis ≤ 4%, orange_terracotta ≤ 3%, gold_block ≤ 1% | 28–85 | 8% |
| Light | campfire braziers, lantern, ochre_froglight | – | – |

Royal variant: polished_blackstone / blackstone statues and obelisks, polished_granite obelisks, gold,
lapis stripes. Painted interior: blue ceilings (blue_terracotta / lapis) with gold specks, green columns,
orange capitals (colour lives mostly inside; exterior paint has faded).

**Kit** (✓ pylon v2)

```js
const sand = kit.palette({ smooth_sandstone: 5, sandstone: 2, cut_sandstone: 1 }, { scale: 2 })
for (let y = g; y < g + H; y += 1) { const i = Math.floor((y - g) / 6); b.box([tx + i, y, z0 + i], [tx + W - 1 - i, y, z0 + D - 1 - i], sand) }
// on every ledge (y = g + 6, g + 12, …) put smooth_sandstone_stairs with the tall side against the wall;
// at the top a ring of smooth_sandstone_stairs[half=top] facing the wall = cavetto cornice
```

**Mistakes:** thin walls; pitched roofs; small scale (Egypt only reads monumental); 1×1 columns; plain
sandstone with no accent; 4-row batter steps (wedding cake); wrong obelisk ratio.

**Ground:** desert sand with sandstone outcrops; a green Nile strip (palms, `sugar_cane`, bamboo
"papyrus", lily pads, irrigated farmland); paved causeways; a rectangular sacred pool with stair edges.

## 10. Victorian and steampunk

### 10.1 Victorian (Queen Anne house, terrace row)

**Identity:** a picturesque, asymmetric brick or painted-wood house with a turret, a porch and steep
crossing gables.

**Silhouette:** main block 11×13 – 15×19, 2–3 storeys of 5; **corner turret** (round or octagonal, Ø 5–7)
rising 1–2 storeys above the main ridge under a tall cone (`coneRoof` pitch 3); steep cross gables
(`[1, 2]` or pitch 2) and dormers; projecting bay windows; **wrap-around porch** 3–4 deep on thin posts
with a low roof (`shed` pitch 0.5–1); ground floor raised 1–2; tall chimneys. Terrace rows are the
exception: symmetric, repeated units 5–7 wide with bay windows and party-wall chimneys.

**Signature:** gingerbread trim at gables and porch (fences, trapdoors), fish-scale shingle rows, finials
and roof cresting, white trim against brick, stained-glass transoms.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Base | stone_bricks 50 / polished_andesite 25 / cobbled_deepslate 25 | 33–56 | 8% |
| Walls | bricks 70 / granite 10 / mud_bricks 10 / polished_granite 10 | 47–50 | 40% |
| Trim (quoins, lintels, cornice, porch) | calcite / smooth_quartz / white_terracotta; `quartz_stairs` hoods; `birch_fence` spindles | 75–92 | 10% |
| Porch frame, bargeboards | dark_oak_planks / dark_oak_fence / stripped_dark_oak_log | 20–25 | 5% |
| Roof | deepslate_tile 70 / polished_blackstone 15 / cobbled_deepslate 15 (rows → fish-scale) | 21–33 | 30% |
| Cresting / finials | `iron_bars`, `polished_blackstone_wall`, `lightning_rod` | – | 2% |
| Accent | one door colour (green or red), flower pots, porch lanterns | – | 2% |

Brick (47) between white trim (89) and slate (23): three clear values. *Painted lady*: walls in one muted
terracotta (`light_blue_`, `pink_`, `lime_` or `yellow_terracotta`) or `birch_planks`, white trim, a second
deeper colour for accents, brick base. *Gothic revival*: deepslate_bricks / polished_blackstone_bricks
walls, tuff/calcite tracery, oxidized-copper turret cap, purple/red glass.

**Kit:** turret `b.cylinder([tx, g, tz], 3.5, H + 6, …)` + `b.coneRoof([tx, g + H + 6, tz], 3.5, { material: 'deepslate_tile', pitch: 3, overhang: 1, finial: 'lightning_rod' })`;
main roof `b.roof({ …, pitch: [1, 2], eaveTrim: true })` then cross gables with `overwrite: false`;
porch `b.roof({ …, type: 'shed', pitch: 0.5, rises: <toward the house> })` on `dark_oak_fence` posts;
dormers with `b.dormer` (see [components.md](components.md)).

**Mistakes:** a symmetric box (except terraces); shallow roofs; no porch; brick without white trim (reads as
a blob); more than three paint colours.

**Ground:** picket fences (`birch_fence`), hedged front gardens, gas lamps (`b.lampPost` with a
`polished_blackstone_wall` foot), cobbled or stone-brick streets with `smooth_stone_slab` pavements.

### 10.2 Steampunk

**Identity:** Victorian buildings wearing their machinery: copper, pipes, gears, smokestacks, airships.

**Silhouette:** Victorian or industrial massing exaggerated vertically, stacked platforms, domes and
clock towers; airships (envelope 2–3× the gondola length, fins, propellers). Machinery must look
purposeful — pipes go from something to something.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Base / machinery | cobbled_deepslate 40 / deepslate_bricks 30 / polished_deepslate 30 | 30–33 | 12% |
| Walls | spruce_planks 40 / dark_oak_planks 30 / bricks 30 | 20–47 | 35% |
| Metal | waxed copper: copper_block 30 / cut_copper 30 / exposed 20 / weathered_cut_copper 20 | 54–59 | 20% |
| Frame | stripped_spruce_log / dark_oak_log / polished_blackstone | 17–40 | 8% |
| Roof | cut_copper → exposed → oxidized stair families (patina gradient), or deepslate_tile | 54–58 | 20% |
| Accent / light | `copper_bulb[lit=true]`, `copper_grate`, `chain`, `iron_bars`, `lightning_rod` pipes, grindstones as gears | – | 5% |

Copper's oxidation stages keep L\* 54–61 and change only hue (salmon → tan → sage → teal): mixing stages
gives a weathered metal gradient with no value noise. Always use `waxed_*` ids. Community favourite:
stripped spruce + acacia planks + quartz bricks + oxidized/weathered cut copper + cobbled deepslate.
See `assets/examples/celestial-forge.mjs` for machinery at megabuild scale.

**Mistakes:** random greebles; all-shiny orange copper; forgetting the Victorian base.
**Ground:** cobbled yards, rails, cranes, airship docks, steam (`campfire` under grates), gas lamps.

## 11. Modern / contemporary

**Identity:** horizontal boxes that slide past each other, glass bands, thin flat plates.

**Silhouette** (✓ cantilever massing)
- 2–4 offset volumes, **horizontal emphasis**, flat roofs as 1-thick plates overhanging 1–2 in a dark
  fascia; an upper volume **cantilevering 3–6 blocks**; storeys 4–5.
- Ribbon windows and full-height glass set 1 back; solid walls elsewhere; vertical wood slats as
  screens; windows grouped in odd numbers.
- No `b.roof` stairs: modern roofs are flat plates (or a mono-pitch `shed` at pitch 0.5).

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Main volume | white_concrete 50 / smooth_quartz 30 / calcite 20 — one block per plane, not mixed per block | 85–92 | 45% |
| Feature volume | stripped_birch_log / stripped_spruce_log slats, or polished_deepslate / deepslate_tiles | 72 / 23–31 | 15% |
| Frames, plates, fascia | black_concrete / polished_blackstone / gray_concrete | 3–24 | 8% |
| Glass | glass, light_gray_stained_glass, `tinted_glass` (privacy) | – | 20% |
| Accent | one colour ≤ 3% (orange concrete, a mangrove panel, oxidized copper) | – | 2% |
| Light | flush sea_lantern / ochre_froglight / pearlescent_froglight, `end_rod` strips; no torches | – | – |

*Brutalist*: light_gray_concrete 40 / smooth_stone 30 / polished_andesite 20 / tuff 10 (board-formed
look), deep-set tinted glass, wood soffits — iconic or ugly, so keep massing bold and simple.
*Warm contemporary*: white walls + mud_bricks / packed_mud feature volumes + mangrove or dark_oak slats.

**Kit** (✓)

```js
b.box([x0, g, z0], [x0 + 15, g + 3, z0 + 12], 'white_concrete')                         // ground volume
b.box([x0 + 1, g + 1, z0 + 12], [x0 + 14, g + 2, z0 + 12], 'air')                       // ribbon window…
b.box([x0 + 1, g + 1, z0 + 11], [x0 + 14, g + 2, z0 + 11], 'glass')                     // …glass 1 back
b.box([x0 + 6, g + 4, z0 - 4], [x0 + 21, g + 4, z0 + 14], 'black_concrete')             // floor plate, cantilevers 6 east, 4 north
b.box([x0 + 6, g + 5, z0 - 4], [x0 + 21, g + 8, z0 + 8], 'smooth_quartz')               // upper volume
b.box([x0 + 7, g + 6, z0 + 8], [x0 + 20, g + 7, z0 + 8], 'tinted_glass')
b.box([x0 + 5, g + 9, z0 - 5], [x0 + 22, g + 9, z0 + 9], 'black_concrete')              // roof plate, 1 overhang
b.box([x0 + 2, g, z0 + 13], [x0 + 5, g + 2, z0 + 16], 'stripped_spruce_log[axis=y]', { mask: (x) => x % 2 === 0 }) // slat screen
```

**Mistakes:** a white box with punched holes; glass with no frame; per-block noise on modern planes
(vary by volume, not by block); torches and glowstone; pitched stair roofs; too many materials.

**Ground:** lawn with straight slab paths (gaps between slabs), gravel beds, ornamental grass and bamboo,
one specimen tree, a pool lined with `light_blue_concrete` or `prismarine` and a `smooth_quartz_slab` coping.

## 12. Industrial / dieselpunk

**Identity:** sheds, mills and stacks built for work, covered in grime.

**Silhouette:** long sheds with **saw-tooth roofs** (repeated `shed` roofs, all glazed faces pointing the
same way) or monitor roofs; brick mills 3–6 storeys with regular window grids; **smokestacks** 2×2 –
4×4 and 25–60 tall, banded every 6–8; water towers, gantries, conveyors. Dieselpunk adds Art-Deco
set-backs and vertical fins.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Base | stone_bricks 50 / polished_andesite 30 / cobbled_deepslate 20 | 33–56 | 8% |
| Walls | bricks 60 / granite 15 / mud_bricks 10 / terracotta 10 / black_concrete_powder soot 5 (drip streaks under openings) | 47 | 45% |
| Trim | smooth_stone lintels and bands | 65 | 7% |
| Steel | polished_blackstone / gray_concrete / iron_block columns, `iron_bars` bracing | 21–88 | 8% |
| Roof | deepslate_tile / cobbled_deepslate; saw-tooth glazing light_gray_stained_glass | 23–33 | 20% |
| Accent | exposed/weathered copper pipes, raw_iron_block rust, yellow hazard bands ≤ 2% | – | 5% |

*Concrete & rust plant* (community: oxidized copper grate + tuff bricks + deepslate): light_gray_concrete /
smooth_stone / tuff walls, iron and weathered-copper metal, gray glass, yellow + black hazard bands.
*Basalt foundry*: polished_basalt (upright) 50 / smooth_basalt 25 / blackstone 15 / magma 10.

**Kit** (✓ saw-tooth): for each 4-wide bay `bx = x0, x0 + 4, …`

```js
b.roof({ x0: bx, x1: bx + 3, z0, z1, y: wallTop + 1, type: 'shed', axis: 'z', rises: 'east', pitch: 1, overhang: 0, gableOverhang: 0, material: 'deepslate_tile' })
b.box([bx + 3, wallTop + 1, z0 + 1], [bx + 3, wallTop + 3, z1 - 1], 'light_gray_stained_glass')   // glaze the tall face
```

A `kit.bands('bricks', 'stone_bricks', { period: 7 })` paint on a 2×2 box makes a banded smokestack.

**Mistakes:** clean colourful factories; random pipes; no stacks or towers; even grids with no wear.
**Ground:** gravel and coal yards, rails, canals with stone quays, material piles, `iron_bars` fences.

## 13. Sci-fi / futuristic (and cyberpunk)

**Identity:** panelled shells with chamfered corners, glowing seams and clustered mechanical detail.

**Silhouette:** sweeping or faceted forms, large glass expanses, towers with rings, domes, landing pads;
a consistent **panel module of 2–4 blocks**; curves approximated with stairs/slabs and 45° chamfers.
Cyberpunk: dense dark towers with neon signage and stained-glass light boxes.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Hull panels | white_concrete 50 / smooth_quartz 25 / iron_block 15 / calcite 10 (per panel) | 85–92 | 45% |
| Seams, recessed bands | light_gray_concrete / smooth_stone / polished_andesite / `iron_trapdoor` | 52–65 | 15% |
| Structure | gray_concrete / polished_deepslate / black_concrete | 3–31 | 15% |
| Glass | light_blue / cyan stained glass, `tinted_glass` | – | 15% |
| Accent | one hue stripe ≤ 3% (cyan, light blue or orange concrete) | – | 3% |
| Light | sea_lantern, `end_rod`, verdant / pearlescent froglight, `redstone_lamp[lit=true]` | – | 7% |

Greeble kit (cluster along seams and bases, leave big panels calm): `iron_trapdoor`, buttons, `lever`,
`iron_bars`, `chain`, `lightning_rod`, `end_rod`, `hopper`, `observer`, `daylight_detector`,
`grindstone`, `copper_grate`, wall stubs. Cyberpunk: black/gray concrete and polished blackstone towers,
magenta/cyan/purple stained glass over sea lanterns or shroomlights, crying obsidian.

**Mistakes:** greebles everywhere; wood or rustic blocks; random colours; no module; boxy (add chamfers).
**Ground:** minimal; alien terrain (end stone, warped nylium, basalt), glass domes over gardens.

## 14. Rustic farm and barn

**Identity:** a big-roofed red barn with white trim among fields and fences.

**Silhouette:** barn 9×15 – 15×27, walls 5–8, **gambrel roof** `[2, 2, 0.5, 0.5]` (✓) or a big gable,
roof ≈ half the height; gable-end double doors 3–5 wide × 4–6 tall with X-bracing, hayloft door above with
a hoist beam projecting 1–2; lean-to sheds (`shed` roofs); silo Ø 5–7, 2–3× the eave height, domed or
conical cap; farmhouse 2 storeys with a porch; windmill tapering 1 block per floor with four 5-block sails.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Foundation | cobblestone 50 / mossy_cobblestone 25 / stone 25 | 48–53 | 8% |
| Boards | mangrove_planks 60 / stripped_mangrove_log[axis=y] 25 / red_terracotta 15 (faded) | 31–37 | 40% |
| Trim (corners, door X, frames) | stripped_birch_log / birch_planks / `birch_fence` / white_terracotta | 72–75 | 8% |
| Roof | dark_oak / spruce / deepslate_tile, or weathered_cut_copper (tin roof) | 20–57 | 35% |
| Accent / light | hay_block, `lightning_rod` weathervane, `bell`, lantern | – | 4% |

Reds with stairs and texture: mangrove (31). Red concrete is the "plastic barn". *Weathered timber barn*:
spruce_planks 50 / stripped_spruce_log 30 / dark_oak_planks 20, stripped oak trim, dark oak roof.

**Kit:** `b.roof({ x0, z0, x1, z1, y: wallTop + 1, axis: 'z', material: 'dark_oak', pitch: [2, 2, 0.5, 0.5], eaveTrim: true, gable: 'mangrove_planks' })`;
cupola = 3×3 louvred box of open trapdoors with a small `pyramid` roof and a `lightning_rod`.

**Mistakes:** saturated red concrete; no white trim; low roof; a barn without fields and fences.
**Ground:** crop rows (`farmland` + `wheat` / `carrots` / `potatoes` / `beetroots` with varied `age`, a water
row every 9), paddocks of `oak_fence` with gates, `dirt_path` / `coarse_dirt` tracks, hay stacks, pumpkin
patches, orchards, composters, scarecrows, beehives, sunflowers.

## 15. Ruins and post-apocalyptic

**Identity:** a recognisable building, partly gone, being taken back by the ground.

**How decay works** (convention): roofs and floors go first, upper walls next; corners, piers and arches
survive longest; rubble cones collect at wall feet; plants climb from the ground and grow inside;
water pools in hollows. The original form must stay legible.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Surviving walls | stone_bricks 30 / cracked_stone_bricks 25 / mossy_stone_bricks 20 / andesite 10 / cobblestone 10 / tuff 5 | 46–57 | 55% |
| Broken tops | random-facing `stone_brick_stairs` / slabs, `cobblestone_wall`, `mossy_stone_brick_wall` | 50 | 10% |
| Rubble | cobblestone 30 / gravel 25 / andesite 15 / mossy_cobblestone 15 / stone-brick slabs and stairs 15 | 48–57 | 15% |
| Overgrowth | moss_block, moss_carpet, vine, azalea / oak leaves, short_grass, fern, glow_lichen | – | 15% |
| Accent | dead coral blocks (grey with grain), cobweb, skull, exposed stripped-log beams | – | 5% |

Post-apocalyptic city: light_gray_concrete / gray_concrete_powder / smooth_stone / tuff / cobbled_deepslate
shells, brick older buildings, empty window grids (air, a few panes), rust (raw_iron_block, exposed and
weathered copper), soot (black_concrete_powder, coal_block), dead bushes and vines.

**Recipe:** build the intact building first; erode with a top-down mask
`noise(x, z) * k + (y - ground) / height > threshold`, lower threshold at corners and arches; delete roof
and most floors (leave 1–2 beams); for each removed block drop rubble near the base with p ≈ 0.2 (full
blocks low, slabs/stairs on top); `b.weather(a, c, { amount: 0.35, mossBias: 0.6 })` for cracked/mossy
patches; `b.overgrow(a, c, { amount: 0.4, moss: true })`; raise soil 1–3 against the walls.

**Mistakes:** Swiss-cheese random holes; floating fragments; no rubble; clean ruins without plants; so
much destruction that the original building can't be read.

## 16. Underwater / Atlantis

**Identity:** domes and pressure shapes in prismarine and glass, lit from within.

**Silhouette:** glass domes and cylinders linked by tubes; a central citadel or monument-like tiered
mass with spires; Atlantis = classical forms (columns, domes, pediments) half-ruined and encrusted.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Walls | prismarine_bricks 45 / prismarine 35 / dark_prismarine 20 (dark low) | 36–65 | 50% |
| Columns, trim | quartz_pillar / smooth_quartz / chiseled_quartz_block | 90–92 | 15% |
| Roofs, domes | dark_prismarine / prismarine_brick stairs; glass or light_blue_stained_glass domes (`b.dome`) | 36 / – | 20% |
| Accent | gold_block ≤ 2%, oxidized_copper, coral blocks | – | 5% |
| Light | sea_lantern grids or strips, `sea_pickle[pickles=1..4,waterlogged=true]`, conduit | 78 | 10% |

Fill flooded space with `water` blocks; every stair, slab, wall, fence, trapdoor, bars, chain and
lantern underwater needs `waterlogged=true`; corals stay alive only next to water; kelp = `kelp_plant`
column topped by `kelp`. Vanilla ocean monument = prismarine + prismarine bricks + dark prismarine + sea
lanterns + a gold core.

**Mistakes:** forgetting the water blocks (the structure places air pockets); prismarine-only (add quartz
or dark contrast); bubbles around non-waterlogged blocks; sea-lantern spam.
**Ground:** sand / gravel / clay sea floor, kelp forests at varied heights, coral on slopes, rocks,
shipwrecks, sunken columns.

## 17. Nether-themed

**Identity:** a dark fortress lit by lava and fungus, with one light material to hold its shape.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Walls | nether_bricks 40 / polished_blackstone_bricks 30 / cracked_nether_bricks 10 / cracked_polished_blackstone_bricks 10 / blackstone 10 | 10–18 | 55% |
| Trim | red_nether_bricks / chiseled_polished_blackstone, **plus a light trim: quartz_bricks / smooth_quartz or basalt** | 12 / 91 / 31 | 12% |
| Roof | nether_brick / red_nether_brick / blackstone stairs | 10–15 | 15% |
| Accent | gilded_blackstone ≤ 5–8%, gold_block, `nether_brick_fence` grilles | – | 8% |
| Light | magma_block (recessed), lava behind `iron_bars`, soul_lantern on chains, shroomlight, glowstone | – | 10% |

Every Nether block sits at L\* 10–28: without quartz (91), basalt (31), gold or strong lights the build
is a black blob. Variants: *crimson grove house* (crimson_planks 70 / stripped_crimson_stem 30 walls,
nether-brick base, nether_wart_block canopies, shroomlight); *warped base* (warped planks + stripped warped
stems, warped wart, dark prismarine, sea lanterns); *soul valley tomb* (soul soil floors, nether bricks +
bone blocks, soul fire only); *bastion hoard* (blackstone family + gilded + gold + magma + chains).
Pick crimson **or** warped per building (convention).

**Ground:** netherrack, crimson/warped nylium, soul sand, lava lakes with magma shores, basalt columns,
nether sprouts and roots, weeping/twisting vines, glowstone on ceilings, bone-block fossils.

## 18. End-themed

**Identity:** lavender pods on tall pale towers, every corner tipped with an end rod.

**Silhouette** (vanilla end city): stacked rectangular pods on tall narrow towers, platforms cantilevered
2–3, bridges, ships with dragon heads; floating islands with tapering undersides.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Walls | purpur_block 70 / purpur_pillar (bands every 4–6, columns) 30 | 58–60 | 50% |
| Light trim / base | end_stone_bricks | 87 | 20% |
| Roof | purpur / end_stone_brick stairs and slabs (flat-ish) | 58 / 87 | 15% |
| Glass | magenta / purple stained glass | – | 5% |
| Accent / light | obsidian, crying_obsidian, `dragon_head`, `end_rod` on every corner, pearlescent_froglight | – | 10% |

*Arcane* (community: purpur + amethyst + purple concrete + pearlescent froglight + crying obsidian):
purpur 50 / quartz 30 / calcite 20 walls, amethyst and purple terracotta panels, quartz-pillar frames.

**Mistakes:** purple everything (no end-stone trim); purple concrete; no end rods; flat-bottomed islands.
**Ground:** end stone islands (`b.island`), chorus trees (`chorus_plant` + `chorus_flower`), obsidian pillars,
purpur-slab bridges.

## 19. Mesoamerican (Maya / Aztec / Teotihuacan)

**Identity:** a stepped pyramid with a steep central stair and a temple on its flat top.

**Silhouette** (✓ 5-terrace pyramid)
- 4–9 terraces, each 3–6 tall and recessed 2–4; **flat top with a temple** (not a point); one or four
  steep central staircases 3–7 wide flanked by balustrades.
- **Talud-tablero**: each terrace = a sloping lower face (stairs / a step) under a vertical framed panel.
- Maya temples tall and steep with a **roof comb** (pierced wall on the roof); small dark interiors.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Terraces | stone_bricks 30 / mossy_stone_bricks 25 / andesite 15 / cobblestone 15 / mossy_cobblestone 15 | 48–57 | 45% |
| Panels, friezes | chiseled_stone_bricks / polished_andesite / tuff_bricks; step-fret relief of stairs | 43–56 | 15% |
| Stairs | stone_brick / mossy_stone_brick stairs | 50 | 10% |
| Temple | stone_bricks / calcite / polished_diorite; roof comb of `stone_brick_wall` lattice | 51–89 | 10% |
| Overgrowth | moss, moss carpet, vines, jungle/azalea leaves, ferns | – | 15% |
| Accent / light | gold idols, jade (emerald / green terracotta) ≤ 1%, campfire braziers | – | 5% |

*Painted Aztec*: stone / andesite / tuff / smooth_stone terraces with red_terracotta + white_terracotta
painted panels, turquoise (oxidized copper, prismarine) and gold accents, serpent-head stair ends.
*Teotihuacan*: tuff / tuff_bricks / cobbled_deepslate / basalt terraces with red_terracotta tableros.

**Kit** (✓)

```js
const terr = kit.palette({ stone_bricks: 3, mossy_stone_bricks: 2, andesite: 1, mossy_cobblestone: 1 }, { scale: 2 })
let y = g
for (let t = 0; t < 5; t += 1) {
  const r = R0 - t * 2
  b.box([cx - r, y, cz - r], [cx + r, y + 2, cz + r], terr)
  b.box([cx - r, y + 2, cz - r], [cx + r, y + 2, cz + r], 'chiseled_stone_bricks', { only: 'minecraft:stone_bricks' }) // panel course
  y += 3
}
// then a 5-wide stair on the south face: stone_brick_stairs[facing=north] rising 1 per block, wall blocks as balustrades
```

**Mistakes:** a pointed (Egyptian) top; shallow stairs; uniform grey with no moss or paint; terraces
with no vertical panels; too much gold.
**Ground:** jungle (giant jungle trees, vines, cocoa, bamboo), cleared plazas of smooth stone / andesite /
coarse dirt, a cenote, causeways, stelae.

## 20. Cherry-blossom style (1.20 cherry)

**Identity:** pale-pink cherry wood on white stone, under a dark roof, in pink trees.

A 1.20 community idiom rather than a historical style: cherry wood dresses East-Asian, cottage or fairy
silhouettes (use that section's shape). Cherry planks (77), stripped cherry (67) and cherry leaves (76)
are all light; **cherry_log bark (16) is the darkest log in the game** — the natural dark anchor.

| Role | Blocks | L\* | Share |
|---|---|---|---|
| Foundation | stone_bricks 50 / andesite 25 / mossy_stone_bricks 25 | 50–57 | 12% |
| Walls | calcite 60 / cherry_planks 25 / white_terracotta 15 | 75–89 | 35% |
| Frame | cherry_log posts (16) or stripped_cherry_log beams (67) | 16 / 67 | 12% |
| Roof | deepslate_tile (dark, for contrast) — or cherry stairs with a dark_oak / deepslate-tile ridge and eave band | 23 / 77 | 30% |
| Accent | cherry_leaves canopies, pink_stained_glass_pane | – | 6% |
| Light | lantern, pearlescent_froglight | – | – |

Community favourites: `cherry_planks, stripped_cherry_log, calcite, cherry_leaves, pink_stained_glass,
stone_bricks`; `bamboo_block, cherry_planks, cherry_leaves, lime_stained_glass, verdant_froglight,
stripped_cherry_log` (green bamboo poles as frame); cherry + dark_oak_log + spruce roof; cherry + crimson
(a deeper wine accent; crimson stairs at 28 make a dark roof).

**Mistakes:** pink on pink (cherry walls + cherry roof + cherry leaves = candy); pink concrete or wool
beside cherry (saturation clash); cherry leaves everywhere at one height.
**Ground:** cherry groves (`b.tree(…, 'cherry')`), `pink_petals[flower_amount=1..4]` carpets under every
tree, ponds with stepping stones, stone lanterns, moss, bamboo, white birch as contrast trees.

## Appendix A — what 1,700 popular community palettes say

Data: the 1,700 most-liked palettes on blockpalettes.com (6 blocks each, 16–1,780 likes), plus top-30 lists
filtered by ~75 individual blocks; L\* from [block-colors.md](block-colors.md). Use it to sanity-check a
palette, not as rules.

**Most frequent blocks** (palettes containing them): spruce_planks 304, deepslate_tiles 294,
deepslate_bricks 262, cherry_planks 236, calcite 232, moss_block 218, stone_bricks 207, quartz_block 204,
spruce_log 193, stripped_cherry_log 182, stripped_spruce_log 179, dark_oak_planks 170, amethyst_block 147,
mud_bricks 127, barrel 124, mossy_cobblestone 123, pearlescent_froglight 121, tuff_bricks 108,
quartz_pillar 105, stripped_dark_oak_log 105. (Pale oak also scores high but is 1.21.4+ and not available here.)

**Most frequent pairs:** cherry_planks + stripped_cherry_log 165 · deepslate_bricks + deepslate_tiles 135 ·
spruce_log + spruce_planks 126 · spruce_planks + stripped_spruce_log 112 · deepslate_bricks + spruce_planks 83 ·
deepslate_tiles + spruce_planks 81 · cherry_leaves + cherry_planks 80 · spruce_planks + stone_bricks 73 ·
moss_block + mossy_cobblestone 72 · amethyst_block + pearlescent_froglight 55 · quartz_block + quartz_pillar 53 ·
amethyst_block + calcite 49 · cobblestone + stone_bricks 47 · mud_bricks + packed_mud 40.

**Patterns**
1. **Warm wood + cool dark stone** is the dominant pairing (spruce with deepslate tiles/bricks or stone bricks).
2. **One species' log + planks + stripped log** is the backbone of wood palettes (frame / wall / beam).
3. **Calcite** is the community's textured white (paired with quartz, diorite, amethyst, cherry, spruce).
4. **Two woods are normal:** 183 of the top 500 palettes use ≥ 2 species; common pairs dark_oak + spruce
   127, oak + spruce 67, cherry + spruce 34, birch + cherry 33, cherry + dark_oak 23. Keep the two ≥ 15 L\*
   apart and give them different roles.
5. **Wide value range:** median lightest-to-darkest spread in the top 500 is 41 L\* (25th percentile 28).
6. **Little concrete:** 11% of top palettes contain any concrete; 22% contain glass; 20% a light block.

**Top palettes by style** (likes): medieval `spruce_log, spruce_planks, stripped_spruce_log, stone_bricks,
cobblestone, andesite` (1,044) · Nordic `spruce_log, stripped_spruce_log, barrel, deepslate_tiles,
deepslate_bricks, quartz_block` (1,195) · white modern/classical `quartz_block, white_concrete,
deepslate_tiles, bone_block, white_stained_glass, quartz_pillar` (1,458) · warm fantasy `mud_bricks,
jungle_planks, crimson_planks, stripped_crimson_stem, pearlescent_froglight, tinted_glass` (1,780) ·
forest cottage `moss_block, stripped_dark_oak_log, green_terracotta, dark_oak_planks, green_stained_glass,
spruce_planks` (866) · Tudor pastel `dark_oak_planks, pink_terracotta, white_terracotta, dark_oak_log,
light_gray_stained_glass, deepslate_bricks` (828) · cherry `cherry_planks, stripped_cherry_log, calcite,
cherry_leaves, pink_stained_glass, stone_bricks` (816) · desert `terracotta, orange_stained_glass,
ochre_froglight, yellow_terracotta, stripped_birch_log, gilded_blackstone` (680) · dark gothic/dwarven
`deepslate_tiles, gray_stained_glass, deepslate_bricks, polished_deepslate, basalt, polished_basalt` (659) ·
End/arcane `purpur_block, amethyst_block, purple_concrete, pearlescent_froglight, purple_stained_glass,
crying_obsidian` (611) · steampunk `stripped_spruce_log, acacia_planks, quartz_bricks, oxidized_cut_copper,
weathered_cut_copper, cobbled_deepslate` (543) · ruins `cobblestone, gravel, dead_horn_coral_block, stone,
andesite, stone_bricks` (478) · castle `andesite, polished_andesite, dark_oak_planks, spruce_log,
stone_bricks, chiseled_stone_bricks` (435) · Atlantis `quartz_pillar, quartz_block, sea_lantern,
prismarine_bricks, dark_prismarine, stripped_warped_stem` (307) · adobe `mud_bricks, packed_mud,
exposed_copper, bricks, terracotta, granite` (227).

## Appendix B — vanilla structures as reference palettes

| Structure | Palette | Lesson |
|---|---|---|
| Plains village | oak log/planks, cobblestone, oak/cobble stair roofs, glass panes | log frame + plank fill + cobble base |
| Taiga village | spruce log/planks, cobblestone, mossy cobblestone | dark wood on grey stone |
| Desert village | sandstone, cut/smooth/chiseled sandstone, coloured terracotta accents | flat roofs, colour only as small accents |
| Savanna village | acacia, orange/yellow/white terracotta | warm orange wood on earth |
| Woodland mansion | dark oak frame, birch infill bands, cobblestone base and roof cornice, dark oak roof | dark frame / light infill at scale |
| Desert pyramid | sandstone family, orange + blue terracotta inlays | Egyptian accents |
| Jungle pyramid | cobblestone, mossy cobblestone, chiseled stone bricks, vines | jungle ruin |
| Ocean monument | prismarine, prismarine bricks, dark prismarine, sea lanterns, gold core | underwater |
| Bastion | blackstone family, gilded blackstone, gold, basalt, magma, chains | dark stone + gold + lava light |
| End city | purpur, end stone bricks, magenta glass, end rods | lavender + pale trim + rods |
| Ancient city | deepslate tiles/bricks, polished deepslate, basalt, soul lanterns, cool wool | all-deepslate held by soft accents and light |
| Trial chambers | tuff bricks, chiseled tuff, waxed copper (fresh + oxidized), stained glass | olive-grey + copper patina (1.21 industrial-arcane) |

More in [vanilla-lessons.md](vanilla-lessons.md).

## Sources

- WesterosCraft building fundamentals — gradients, faults, exteriors, foundations (westeroscraft.com/docs/building/fundamentals)
- Minecraft Wiki tutorials — Roof types, Roof construction guidelines, Walls and buttresses, Color palette,
  Adding beauty to constructions, Building a metropolis/Themes; structure pages for village, mansion, pyramids,
  monument, bastion, end city, ancient city, trial chambers (minecraft.wiki)
- MC Middle-Earth, "Castle realism guide" (mcmiddleearth.com)
- blockpalettes.com public palette data (top 1,700 by likes, block-filtered top lists)
- Blockwerks, medieval timber-frame house spec (blockwerks.netlify.app)
- game.guide, Viking style building (curved longhouse roofs)
- minecraft.how, castle guide and building styles
- Wikipedia: Classical order, Torii, Pagoda, Stave church, Jettying, Talud-tablero, Pylon (architecture),
  Obelisk, Flying buttress, Horseshoe arch, Muqarnas, Queen Anne style architecture
- Render tests for every ✓ in this chapter (kit `b.roof`, `coneRoof`, `lathe`, `dome`, `timberWall`, `texture`)
