# Interiors and lighting

How to plan rooms, furnish them from vanilla blocks, and light builds inside and out. Snippets use the
kit (`references/kit-api.md`) and were built and rendered. Orientation rules for every block used here:
[block-states.md](block-states.md) (§4 trapdoors, §5 doors, §6 beds, §8 light sources, §11 furniture).
Colours: [block-colors.md](block-colors.md).

## 0. Rules

1. **Ceilings ≥ 3 clear blocks** in small rooms, 4–5 in main rooms; anything taller needs beams, a gallery
   or a truss, or it reads as an empty void.
2. **Walkways 2 wide** through used space; furniture covers ≤ 40–50% of the floor.
3. **Every room has a purpose and one focal point** (fireplace, bar, bed, throne, window); seating faces it.
4. **No flat interior wall wider than ~5 blocks**: posts every 3–4, skirting, beams, niches, shelves.
5. **Floors are designed**: a 1-block border in a darker material plus a field; rugs are coloured floor
   blocks, not carpet under furniture.
6. **Author furniture as modules facing south, stamp them rotated** — one set of correct states everywhere.
7. **Lights where people do things**: entrances, stairs, tables, counters, corners. Layer ambient
   (chandelier), wall (sconces) and task (candles, lamps) light; never a uniform grid.
8. **Spawn-proof by arithmetic**, not by the picture: block light must be ≥ 1 on every walkable cell.
9. **Hang lights from something**: chains from beams, lanterns under fence arms or slabs. A lantern with
   nothing above (hanging) or below (standing) is a bug.
10. **Interiors are block-only**: no paintings, item frames or armor stands in structure exports.
11. **Check with a cutaway**: `render.mjs --clip-y <ceiling - 1>` and `--lighting night`; run
    `inspect.mjs --checks` for support, pairing and dark spots.

---

## 1. Room planning

| Space | Interior footprint | Clear height | Notes |
| --- | --- | --- | --- |
| Closet / pantry | 2×3 – 3×4 | 3 | |
| Bedroom | 5×6 – 7×9 (suite 10×12) | 3–4 | bed head against a wall, off the door line |
| Kitchen | 5×7 – 7×9 | 3–4 | counters on 1–2 walls, 2-wide aisle |
| Living room / study | 7×9 – 9×11 | 4 | seats face the hearth or window |
| Tavern / inn hall | 9×13 – 13×21 | 5–7 | beams at 4–5, gallery at 5–6 |
| Library | 9×9 – 15×21 | 8–10 | mezzanine at 4–5 around a central void |
| Great hall / throne room | 11–17 × 21–41 (1:2 – 1:3) | 10–15 | pillars every 4, truss or vault |
| Corridor | 2–3 wide | 3–4 | 1 wide only for service or secret passages |
| Cellar / storeroom | any | 3 | vaulted stone, dim |

- Player is 1.8 tall (eyes 1.62): 2-block rooms read as cramped; 3 is cosy; 4 is generous.
- Doors 1×2 in houses, 2×3 – 3×4 in halls. Windows 1×2 – 2×3, sill 1 above the floor.
- Zones in open plans: change the floor (inlay, border), the ceiling height, or the light — not full walls.
- Palette inside: ~60% main (floor/wall field), ~30% trim (posts, beams, border), ~10% accent (rugs,
  banners, fabric colour). Keep interior wood related to the exterior frame.

---

## 2. Shell: floors, walls, ceilings

Tested tavern shell (17×21, floor at y=0, walls 6 high):

```js
const [X0, Z0, X1, Z1] = [0, 0, 16, 20]
// floor: dark border (2 rings) + parquet field (log grain alternates per cell) + stone hearth zone
b.box([X0, 0, Z0], [X1, 0, Z1], (x, y, z) => {
  if (x <= X0 + 1 || x >= X1 - 1 || z <= Z0 + 1 || z >= Z1 - 1) return 'dark_oak_planks'
  if (z <= Z0 + 3 && x >= 5 && x <= 11) return kit.palette({ stone_bricks: 3, cracked_stone_bricks: 1 })
  return (x + z) % 2 ? 'stripped_spruce_log[axis=x]' : 'stripped_spruce_log[axis=z]'
})
// walls: timber frame inside and out
const frame = 'stripped_dark_oak_log', infill = kit.palette({ calcite: 4, white_terracotta: 1 })
b.timberWall([X0, 1, Z0], [X1, 6, Z0], { frame, infill, postEvery: 4, beams: [6] })   // + the other 3 walls
// ceiling joists every 4 blocks across the short span, plank ceiling above
for (let z = 4; z <= Z1 - 4; z += 4) b.box([X0 + 1, 5, z], [X1 - 1, 5, z], 'stripped_dark_oak_log[axis=x]')
b.box([X0, 7, Z0], [X1, 7, Z1], 'spruce_planks')
```

**Floors**
- Border + field: `dark_oak_planks` ring around `spruce_planks`/`oak_planks` reads instantly as finished.
- Parquet: alternate `*_log[axis=x]` / `[axis=z]` (stripped logs) per cell — the grain changes direction.
  This is a deliberate checker; never use coordinate checkers for natural materials.
- Stone halls: `polished_andesite` field, `polished_deepslate` or `deepslate_tiles` border,
  `chiseled_stone_bricks` at crossings.
- Rugs: recolour the floor (wool or terracotta field with a contrasting 1-block border). Real `*_carpet`
  only in free cells; carpets also make floors spawn-proof.
- Hearths, kitchens, smithies: stone or brick floor 2 deep in front of the fire.

**Walls**
- Timber frame: posts every 3–4 blocks and at corners, infill one material. In renders `white_terracotta`
  reads pinkish-beige; for white plaster use `calcite`, `mushroom_stem`, `white_concrete` or
  `smooth_quartz` (see block-colors.md).
- Skirting: one course of darker planks or `*_stairs[facing=<toward the wall>]` along the base.
- Wainscot: open trapdoors on the lower 1–2 blocks (`*_trapdoor[open=true,facing=<into the room>]`) give a
  raised-panel texture without changing the wall.
- Crown moulding: `*_stairs[half=top,facing=<toward the wall>]` along the top.
- Niches 1 deep for shelves, candles, pots; deep window reveals with sills (`*_slab[type=top]`).

**Ceilings**
- Beams across the short span every 3–4 blocks (log axis along the beam) resting on posts; plank ceiling
  above; lanterns hang from the beams.
- Halls: expose the roof structure (stairs as rafters, logs as tie beams) and hang chandeliers from the ties.
- Coffered: a beam grid with the ceiling one block higher inside each cell.

---

## 3. Furniture

### 3.1 Convention: modules facing south

Author each piece in a `b.module` with its **front facing south** (+z: what a sitter looks at, the side
with drawers or the opening), then `b.stamp(module, at, { rotate })`. Stamping rotates block states with
the module: `rotate: 1` turns the front west, `2` north, `3` east (clockwise from above). Give every
directional block an explicit `facing` when authoring — default states are filled in later and would not rotate.

| Block | Rule (for a module whose front faces south) |
| --- | --- |
| Seat stair | `*_stairs[facing=north]`: the tall back is on the `facing` side, the sitter looks south |
| Armrest | open trapdoor in the side cell, `facing` = away from the seat (`west` on the left, `east` on the right) |
| Table end leg | upside-down stair `*_stairs[half=top,facing=<outward>]` (the lower half hangs on the `facing` side) |
| Cabinet front | `*_trapdoor[open=true,facing=south]` in front of a block (panel hugs the north edge of its cell) |
| Wall cabinet / shelf on a north wall | `*_trapdoor[half=top,open=true,facing=south]` at head height |
| Wardrobe | doors on a north wall: `*_door[facing=south]`, pair with `hinge=left` + `hinge=right` |
| Bed | `*_bed[facing=north,part=head]` against the north wall, `part=foot` south of it |
| Furnace/smoker, lectern, campfire, chiseled bookshelf | `facing=south` |
| Wall torch on a north wall | `wall_torch[facing=south]` (attached to the block north of it) |

### 3.2 Catalogue

All pieces below are from the tested catalogue (`furniture(b, kit)` returning modules):

```js
const M = {}
M.armchair = b.module([3, 1, 1])                                            // seat + trapdoor arms
M.armchair.set(1, 0, 0, 'spruce_stairs[facing=north,half=bottom]')
M.armchair.set(0, 0, 0, 'spruce_trapdoor[facing=west,half=bottom,open=true]')
M.armchair.set(2, 0, 0, 'spruce_trapdoor[facing=east,half=bottom,open=true]')

M.dining = b.module([3, 2, 4])                                              // 3x2 table + 4 chairs
for (const z of [1, 2]) {
  M.dining.set(0, 0, z, 'dark_oak_stairs[facing=west,half=top]')
  M.dining.set(1, 0, z, 'dark_oak_slab[type=top]')
  M.dining.set(2, 0, z, 'dark_oak_stairs[facing=east,half=top]')
}
for (const x of [0, 2]) {
  M.dining.set(x, 0, 0, 'oak_stairs[facing=north,half=bottom]')            // looks south at the table
  M.dining.set(x, 0, 3, 'oak_stairs[facing=south,half=bottom]')            // looks north
}
M.dining.set(1, 1, 1, 'candle[candles=3,lit=true]'); M.dining.set(1, 1, 2, 'potted_red_tulip')

M.fireplace = b.module([5, 4, 2])                                           // brick surround, mantel
M.fireplace.box([0, 0, 0], [4, 3, 0], 'bricks')
M.fireplace.set(2, 0, 0, 'campfire[facing=south,lit=true,signal_fire=false]'); M.fireplace.set(2, 1, 0, 'air')
M.fireplace.set(1, 0, 0, 'brick_wall'); M.fireplace.set(3, 0, 0, 'brick_wall')
for (let x = 0; x <= 4; x += 1) M.fireplace.set(x, 2, 1, 'spruce_slab[type=bottom]')
M.fireplace.set(0, 3, 1, 'candle[candles=3,lit=true]'); M.fireplace.set(2, 3, 1, 'skeleton_skull[rotation=0]')

M.chandelier = b.module([3, 4, 3])                                          // stamp so y=3 is under a beam
M.chandelier.set(1, 3, 1, 'chain[axis=y]'); M.chandelier.set(1, 2, 1, 'dark_oak_fence')
for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
  M.chandelier.set(1 + dx, 2, 1 + dz, 'dark_oak_fence')                   // fences connect at finish()
  M.chandelier.set(1 + dx, 1, 1 + dz, 'lantern[hanging=true]')
}

b.stamp(M.fireplace, [6, 1, 1])                                             // north wall, faces into the room
b.stamp(M.armchair, [3, 1, 5], { rotate: 2 })                               // turned to face the fire
for (const [x, z] of [[2, 9], [6, 9], [2, 14]]) b.stamp(M.dining, [x, 1, z])
for (const [x, z] of [[7, 3], [7, 11]]) b.stamp(M.chandelier, [x, 1, z])   // chain top at y=4, joist at y=5
```

| Piece | Recipe | Notes |
| --- | --- | --- |
| Chair | `*_stairs[facing=<back side>]` | sitter looks opposite to `facing` |
| Armchair | chair + open trapdoors in both side cells, `facing` outward | signs on the sides also work |
| Sofa (3) | 3 stairs in a row + trapdoor arms at the ends | L-sofa: corner stair shapes are computed at `finish()` |
| Bench | row of `*_slab[type=bottom]` (or stairs) with trapdoor ends | pews: rows of stairs facing the altar |
| Stool / bar stool | `*_slab[type=bottom]` / a single `*_fence` | |
| Side table | `*_fence` + `*_pressure_plate` (or a carpet) on top | top at 1 + 1/16 |
| Dining table | upside-down stair ends (leg outward) + top slabs | top at exactly 1 |
| Desk | `*_slab[type=top]` + upside-down stair legs; `lectern[facing=…]`, candle, flower pot | |
| Low table | `*_slab[type=bottom]` or `*_trapdoor[half=bottom]` on the floor | |
| Block tables | `barrel[facing=up]`, `crafting_table`, `smithing_table`, `fletching_table`, `cartography_table`, `cauldron` (round), `composter` (crate) | |
| Bed + nightstands | bed head to the wall; `barrel[facing=up]` + candle, trapdoor-topped block + `potted_fern` | |
| Canopy bed | 4 fence posts 3 high on a 3×4 footprint around the bed, roof of slabs or wool | |
| Wardrobe | 2 doors against a wall, mirrored hinges, upside-down stair cornice | |
| Cupboard | any block + open trapdoor in front | |
| Wall shelf | `*_trapdoor[half=top,open=false]` or `*_slab[type=top]` against a wall, items on top | |
| Bookcase bay | `bookshelf` ×3 high between `stripped_*_log` posts, ~20% `chiseled_bookshelf` (vary `slot_N_occupied`), slab cornice, `lectern` in front | |
| Kitchen run | `barrel[facing=up]` counters, `smoker[facing=…,lit=true]`, `water_cauldron[level=3]` sink + `tripwire_hook` or `lever` tap on the wall above, open top trapdoors as wall cabinets, hanging lanterns | |
| Cooking hearth | `campfire[lit=true]` with a `cauldron` above it, brick hood, chimney (`b.chimney`) | |
| Fireplace | 3–5 wide surround, campfire in a 1×2 opening, wall jambs, mantel slab projecting 1, chimney ≥ 2 above the ridge | campfire does not spread fire; smoke rises ~10 blocks (24 over a hay bale) |
| Bar | `stripped_spruce_log[axis=x]` counter, fence stools on the customer side, kegs (`barrel[facing=south]`) on upside-down stairs behind, brewing stands and pots as bottles | |
| Throne | stair seat on a 2–3 step dais, stairs or walls as arms, 2–3 block back (gold, quartz, blackstone) with banners behind | |
| Floor lamp | `*_fence` ×2 + `lantern[hanging=false]` | |
| Shade lamp | fence post + `ochre_froglight` head with 4 open trapdoors around it, `facing` outward | |
| Bathroom (modern) | cauldron basin + tripwire tap, glass shower, iron trapdoors | |

### 3.3 Block-only clutter

- Big → medium → small: furniture, then barrels/pots/lamps/chests, then candles, flower pots, buttons
  (knobs), levers (handles), `tripwire_hook` (coat hooks).
- Lived-in rooms: 20–40% of horizontal surfaces carry something; group in odd numbers; one chair pulled out.
- Useful props: `flower_pot` and the `potted_*` plants (a potted plant is its own block id), `candle`
  (1–4, 17 colours), `sea_pickle` (unlit jars), `brewing_stand` (bottles), `decorated_pot`, `cake`,
  `lantern`, `chain`, `bell`, floor heads (`skeleton_skull`, `player_head` with `rotation`), `cobweb`,
  `turtle_egg`, `end_rod` (tall candle), `lightning_rod`, `amethyst_cluster`, `azalea` (potted-shrub
  look), `hay_block` (sacks), `target`, `jukebox`, `note_block`.
- Not available in structure exports: paintings, item frames, armor stands, minecarts (entities).
  Wall-mounted heads/skulls do not render in the preview; floor variants do.

---

## 4. Room types

**Tavern** (tested; 17×21, ceiling 7)
```
 N  #### fireplace ####         T = dining set (table + 4 chairs)      a = armchair facing the fire
    #   a    ...    a  #        chandeliers on the joists every ~8 blocks
    #  T    T          #        B = bar counter along a side wall, stools on the room side,
    #             BBBB #            keg rack + bottle shelves behind
    #  T          BBBB #        door centred on the south wall, windows either side
 S  ####### door ######
```
Light: 2 chandeliers + wall torches + candles on tables + the fire. Floor: parquet field, dark border,
stone hearth. Outside: a hanging sign on a fence bracket and a bell.

**Library**: shelves floor to ceiling broken by log posts every 3–4 and by windows; mezzanine at +4/+5
around a central void with fence or trapdoor railings and a spiral stair (`b.spiralStairs`); reading tables
and armchairs in the void; `lectern`s; an `enchanting_table` alcove ringed by bookshelves 2 blocks away;
candles and lanterns (warm, low), one large chandelier in the void.

**Throne room / great hall**: nave 13–17 wide and 3× as long; pillars every 4 (`b.column`) with banners
between; clerestory windows; a 3-wide carpet runner over polished stone from the door to a 2–3 step dais;
braziers (`campfire`/`soul_campfire` on stone pedestals, or `lava_cauldron`); chandeliers every 6–8 blocks
on chains from the tie beams.

**Blacksmith / forge**: half-open front, stone/cobble/gravel floor; a brick or stone forge mass with
`blast_furnace[lit=true]` and a `lava_cauldron`, chimney; `anvil[facing]` and `grindstone[face=floor]`
2 blocks from the forge; quench `water_cauldron[level=3]`; tool wall of chains, tripwire hooks and lightning
rods; `coal_block` and barrels; `smithing_table`.

**Bedroom**: bed, two nightstands, wardrobe, rug inlay beside the bed, a desk under the window, one lamp
and one candle. Quietest palette of the house.

**Kitchen**: counter run on one wall (smoker, sink, barrels, cabinets above), table in the middle, hanging
lanterns, pantry corner (`hay_block`, pumpkins, melons, `beehive`), herbs (`hanging_roots`, `spore_blossom`
under beams — taste).

**Cellar / storeroom**: barrels in the walls with alternating `facing`, chests, crates (`barrel[facing=up]`),
`hay_block`, cobwebs in corners, one lantern every 8–10 blocks.

**Chapel**: pews facing an altar block with carpet and candle clusters (3–4 of mixed white/yellow), stained
glass windows, a bell tower.

**Alchemist / mage**: brewing stands, cauldrons (water, `powder_snow_cauldron`, lava), shelves of potted
mushrooms and flowers, coloured candles, `amethyst_cluster`, soul lanterns, a `respawn_anchor` or
`crying_obsidian` accent.

---

## 5. Lighting

### 5.1 Light levels (Java 1.21.1)

| Level | Blocks (state) | Glows in the preview |
| --- | --- | --- |
| 15 | `lantern`, `glowstone`, `sea_lantern`, `shroomlight`, `ochre/verdant/pearlescent_froglight`, `jack_o_lantern`, `campfire[lit=true]`, `copper_bulb[lit=true]`, `redstone_lamp[lit=true]`, `beacon`, `conduit`, `lava`, `lava_cauldron`, `fire`, `respawn_anchor[charges=4]`, 4 waterlogged `sea_pickle` | yes, except redstone lamp and sea pickles |
| 14 | `torch`, `wall_torch`, `end_rod`, `cave_vines[berries=true]` | torch, end rod |
| 13 | lit `furnace`, `smoker`, `blast_furnace` | no |
| 12 | `candle[candles=4,lit=true]`, `exposed_copper_bulb[lit=true]`, 3 waterlogged sea pickles | candles |
| 11 | `nether_portal`, `respawn_anchor[charges=3]` | anchor |
| 10 | `soul_lantern`, `soul_torch`, `soul_wall_torch`, `soul_campfire[lit=true]`, `soul_fire`, `crying_obsidian` | yes |
| 9 | `candle[candles=3,lit=true]`, 2 sea pickles | candles |
| 8 | `weathered_copper_bulb[lit=true]` | yes |
| 7 | `glow_lichen`, `redstone_torch`, `enchanting_table`, `ender_chest` | lichen, redstone torch |
| 6 | `candle[candles=2,lit=true]`, 1 sea pickle, `sculk_catalyst` | candles |
| 5 | `amethyst_cluster` | yes |
| 4 | `large_amethyst_bud`, `oxidized_copper_bulb[lit=true]` | yes |
| 3 | `candle[candles=1,lit=true]`, `candle_cake[lit=true]`, `magma_block` | candle, magma |
| 1–2 | `medium_amethyst_bud` (2), `small_amethyst_bud`, `brewing_stand`, `brown_mushroom` (1) | buds |
| 0–15 | `light[level=N]` — invisible light block | no (invisible) |

Copper bulbs: 15 / 12 / 8 / 4 by oxidation (waxed the same). Candles give 3 per lit candle; waterlogged
candles cannot be lit. Sea pickles only light when waterlogged.

Colour is in the fixture, not the light: vanilla block light has one warm tint whatever the source.
Warm fixtures — lantern, torch, candle, campfire, shroomlight, ochre froglight, jack o'lantern; cool —
sea lantern, end rod, pearlescent froglight; eerie — soul lantern/torch/campfire (cyan), verdant froglight,
glow lichen; arcane — crying obsidian, amethyst.

### 5.2 Spawn-proofing math

- Block light falls by 1 per block of taxicab distance (|dx| + |dy| + |dz|). Light at a floor cell =
  L − d, where d is the distance from the source block to the air block above that floor cell.
- Java 1.18+: hostile mobs spawn only where **block light = 0** (and sky light ≤ 7). So every walkable
  cell needs d ≤ L − 1.
- Square grid of sources at the walking level: spacing ≤ L − 1 − h, where h is the source's height above
  (or depth below) the air layer. Torch 13; lantern, glowstone, sea lantern 14; lantern hanging 3 up → 11;
  glowstone in the floor → 13; 4 lit candles 11; soul lantern 9.
- One-wide corridor: spacing ≤ 2 × (L − 1 − h) (torches every 26).
- Mobs never spawn on: bottom slabs, carpets, glass, leaves, dirt path, farmland, trapdoors, scaffolding,
  copper grates, ice, snow layers 2–7, or cells containing buttons, pressure plates, rails, redstone.
  Top slabs, upside-down stairs and double slabs do allow spawning.
- `node scripts/inspect.mjs FILE --checks` estimates dark roofed walkable spots ("lighting").
- Aesthetic spacing is denser than the minimum: interiors 5–8 blocks between lights, streets 8–12.

### 5.3 Hidden lights

| Technique | Works in Java? |
| --- | --- |
| Glowstone / sea lantern / froglight / shroomlight under a carpet or moss carpet | yes — carpet passes light |
| Light source inside leaves (canopies, hedges, bushes) | yes |
| Behind glass, panes, iron bars, trapdoors | yes |
| Under tall grass, ferns, flowers | **no** — plants cannot stand on a light block (they pop off); put a moss carpet or carpet over the light, or hide it in a planter beside the plants |
| `light[level=N]` blocks | yes — invisible, creative-only, ideal for generated builds |
| Lantern in water: on the bed, or hanging under a lily pad (`lantern[hanging=true,waterlogged=true]`) | yes |
| Under a slab or inside a stair | **no** — slabs, stairs, snow layers, dirt path and farmland block light with their shape |

The preview does not propagate light (§7): a light under a carpet shows nothing in a render, a light in
the ceiling appears to light the room even through solid blocks. Each surface takes only its brightest
nearby light, and a ceiling never lights itself, so for a glowing night render put *visible* sources
(lanterns, lamps, candles) behind the glass. Trust the rules above for the game.

### 5.4 Schemes

- **Layer**: ambient (chandeliers, hanging lanterns on beams), wall (sconces, torches), task (candles on
  tables, a lamp by the bed, light over the counter). Uniform grids flatten a room.
- **Height**: hanging lanterns 2.5–3.5 above the floor (≥ 2 clear head room), sconces at +2/+3, street
  lamps 3–5 tall, candles at table height. Floor-level lanterns glare and light little.
- **One family per building** (warm medieval, cool modern, eerie ruin) plus at most one accent.
- **Rhythm**: lamps every 8–12 blocks on paths, alternating sides on wide streets; one light at every door;
  the hero building brightest; landscapes darker than settlements.

### 5.5 Light plans by room (taste, spawn-safe)

| Space | Ambient | Wall / task | Typical count |
| --- | --- | --- | --- |
| Bedroom 6×8 | 1 hanging lantern or none | candle on each nightstand, lamp by the desk | 2–3 sources |
| Kitchen 7×9 | lanterns on the beams over the counter | campfire/smoker glow, candle on the table | 3–4 |
| Living room 9×11 | 1 chandelier over the seating | fire, 1 floor lamp, sconces either side of the hearth | 4–6 |
| Tavern 13×21 | 2–3 chandeliers on the joists | candle on every table, torches between windows, the fire | 10–15 |
| Library 2-storey | 1 big chandelier in the void | lanterns on the mezzanine edge every 4–6, candles on desks | 8–14 |
| Great hall | chandeliers every 6–8 along the axis | braziers by the dais, sconces on every pillar | 12–20 |
| Cellar | 1 lantern per 8–10 blocks | none | few, dim on purpose |
| Shop | lanterns over the counter and the door | 1 per display niche | 3–5 |
| Street | lamp post every 8–12, alternating sides | lantern by every door | — |

### 5.6 Common lighting mistakes

| Mistake | Fix |
| --- | --- |
| Torches in a grid on every wall | lanterns on beams + task lights; torches only in utility spaces |
| Lantern floating (nothing above/below) | hang from a fence stub, chain, slab or beam; `inspect --checks` lists unsupported lanterns |
| Light under slabs "hidden" | carpet over the light, or `light[level=N]` blocks |
| Dark corners in big halls | sconces on pillars; check spacing with the formula in §5.2 |
| One colour everywhere | one main family + one accent (soul lanterns in a crypt corner, a sea lantern in a magic room) |
| Lights at floor level | raise to 2.5–5 blocks: they read as fixtures and light the floor |
| Glowing blocks in the facade by accident | shroomlight, froglights and magma read as lamps at night — use them on purpose |

### 5.7 Fixtures

```js
b.lampPost([x, y, z], { height: 3, post: 'spruce_fence' })                                         // post lamp
b.lampPost([x, y, z], { height: 4, post: 'spruce_fence', foot: 'cobblestone_wall', arm: 'south' })  // crook: lantern hangs over the path
b.hangingLantern([x, beamY, z], 2)                                    // anchor = an existing beam block; 2 chains + lantern below it
b.hangingLantern([x, beamY, z], 1, { lantern: 'soul_lantern' })
```

Street lamp designs (tested):

```
 post       crook          stone pillar        double arm      tree lamp
   L         F F            s s s  slab cap      F F F          leaf ball with a
   F         F L <-hangs    C    L <-hangs       L W L          shroomlight inside,
   F         F              W                      W            on a 4-high fence
   F         W              W                      W
             cobble wall    B  stone bricks        W
```

- Stone pillar: `stone_bricks` plinth, `stone_brick_wall` ×2, `chiseled_stone_bricks` head, a 3-long
  `stone_brick_slab` cap that overhangs so a lantern can hang under it. (A standing lantern needs a block
  below; a hanging one needs a block above.)
- Double arm: wall post ×4, `dark_oak_fence` crossbar ×3, two hanging lanterns.
- Tree lamp: fence ×4 + `b.leafBlob` ball with `shroomlight` inside.
- Sconces: `wall_torch[facing=<into the room>]`; a 1-block fence stub against the wall with a hanging
  lantern under it; a candle on an upside-down stair bracket.
- Chandeliers: chain → fence cross → lanterns under the arms (catalogue above, 3×3, 3 tall); candle wheel:
  hub block on a chain, fence arms, lit candles (3–4) on the arm tips (candles stand on fence posts);
  great hall: a ring of walls or iron bars (radius 2) with candles on top and lanterns under, a smaller ring
  below. Width ≈ ⅓ of the room; bottom ≥ 2.5 above the floor (≥ 4 over tables); always hang from a beam.

### 5.8 Outdoors

- Lanterns hanging from tree branches (`b.tree` returns `tips`), shroomlight hidden in canopies,
  `glow_lichen` on rocks, glow-berry curtains (`cave_vines[berries=true]`), sea pickle clusters in ponds,
  campfires at camps, soul campfires at ruins.
- Bollards along garden paths: a lantern on a 1-high wall or fence every 6–8 blocks, staggered.
- Bridges: lanterns under the arch or on posts at both ends.
- Windows: a light just inside every lit window so night renders show warm openings.

---

## 6. Checklist

- [ ] Every room: purpose, focal point, 2-wide circulation, ≥ 3 clear height.
- [ ] Floors bordered; walls broken every ≤ 5 blocks; ceilings with beams.
- [ ] Furniture stamped from south-facing modules; fronts face the focal point.
- [ ] Every lantern has support; every door/bed/tall plant has both halves (`inspect --checks`).
- [ ] Light at every door, stair, table and counter; spacing within the spawn-proof limit.
- [ ] Cutaway render (`--clip-y`) and night render (`--lighting night`) inspected.

## 7. What the preview can and cannot show

- Light is not simulated. Night mode adds a warm glow around emissive blocks (all light is drawn warm,
  even soul lanterns; range ~16 blocks; light passes through walls). Use it to judge **where** lights are,
  not how bright a room is.
- Not drawn glowing: `redstone_lamp`, sea pickles, glow berries, lit furnaces/smokers, `light` blocks.
- Small props (candles, buttons, pots) are sub-pixel in overview renders; check them in close-ups:
  `--clip x0,y0,z0,x1,y1,z1` (crop) and `--clip-y` (cutaway) with a custom `--yaw/--pitch`.
- Sign text and banner patterns render unreliably; wall heads do not render; entities do not exist.
- `finish()` fills missing properties, completes door/bed/tall-plant partners and computes stair, wall,
  fence and pane connections, so the preview matches the game — but it cannot guess a `facing` you meant.

## Sources

- minecraft.wiki: *Light* (light-emitting block table), *Opacity* (shape-based light occlusion of slabs,
  stairs, snow, dirt path, farmland), *Mob spawning* and *Tutorial:Spawn-proofing*, *Copper Bulb*, *Candle*,
  *Campfire*, *Lantern*, *Chain*, *Tutorial:Furniture*.
- Minecraft Gradient, *Minecraft interior design* (2-wide circulation, 60/30/10, room sizes, layered lighting).
- Interior design round-ups (ExitLag, Switchblade Gaming, Bricks and Blocks): ceilings ≥ 3, beams for tall rooms.
- Chandelier and lamp-post guides (ExitLag, Gamer Empire, Sportskeeda hidden lighting): hanger + frame +
  lights; lanterns under lily pads.
- Renderer source (`@mattzh72/lodestone` `ThreeStructureRenderer.js`, `block-flags/emissive.json`) for what the
  preview shows.
