# Detailing: the Detail-Block Vocabulary

What every partial and decorative block is for, the exact states that make it work, which materials
have it, what to use when they don't, and 32 tested micro-modules you can stamp onto any wall.

- Orientation rules (what `facing`, `half`, `open`, `attachment`, `rotation` mean) live in
  [block-states.md](block-states.md). This chapter links there instead of re-deriving them.
- Which material family has stairs/slab/wall/fence/... and colour-matched substitutes:
  [materials.md](materials.md) (`kit.material(name)` reads the same table).
- Trim contrast and average colours: [block-colors.md](block-colors.md). Kit API: [../kit-api.md](../kit-api.md).

Verification: every micro-module in §6 was built with `run-build.mjs` (0 state problems) and rendered
close-up; the wall modules were stamped on all four faces of a test house to check rotated states.
Every other state string in this chapter was rendered in a sampler build. Tags: **(convention)** =
common builder practice, **(taste)** = a judgement call.

---

## 1. Principles

1. **Break the plane.** A flat wall reads as wallpaper. Every 2-4 blocks along a facade, something
   should sit at depth +1 (sill, shutter, beam end, lamp, corbel) or -1 (window recessed one block).
   Check any 3×3 patch of facade: at least one cell should not be flush. (taste)
2. **Small things are made of partial blocks.** Thicknesses: carpet / pressure plate 1/16, trapdoor
   3/16, button 2/16 deep, fence post 4/16 wide, wall post 8/16, slab and stair step 1/2. A sill, frame
   or shutter built from full blocks is twice the scale of the house around it. (convention)
3. **Three materials per element.** Wall, trim, accent. Trim should differ from the wall by ΔE ≥ 10
   (look both up in [block-colors.md](block-colors.md)): stone bricks + polished diorite, white
   terracotta + stripped spruce, bricks + stone bricks. Use **one wood family** for all doors,
   shutters, trapdoors and signs of one building. (convention)
4. **Repeat, then vary.** Author a detail once (`b.module`), stamp it on every opening, then vary
   10-25 %: one shutter closed, different flowers, one window without a box. Per-block randomness
   on every cell reads as noise, not as life. (taste)
5. **Support.** When the structure is placed in-game, blocks that cannot survive are deleted
   ([block-states.md §0](block-states.md#0-conventions-and-ground-rules)). The preview draws them
   anyway, so check the **Support** column in §2 yourself.
6. **Write every property, but let `finish()` connect things.** It computes stair corner shapes,
   wall posts/arms, fence/pane/bar connections and gate `in_wall`. Never hand-write corner shapes;
   fix `facing`/`half` instead.

Directions used in every snippet below, for a wall whose **outside** faces `F`:

| Name | Value | Use |
| --- | --- | --- |
| out | `F` | shutters, wall signs, buttons, levers, ladders (all point away from their support) |
| in | `kit.opposite(F)` | sills, corbels, brackets, awnings (stairs whose tall back touches the wall) |
| right (seen from outside) | `kit.ccw(F)` | |
| left (seen from outside) | `kit.cw(F)` | |

The cell **in front of** wall cell `[x, y, z]` is `[x + kit.DIR[F][0], y, z + kit.DIR[F][2]]`.

---

## 2. The vocabulary at a glance

"Support" is what vanilla requires when the structure is placed (block code `canSurvive`):
**none** = can float; **face** = a full (sturdy) face on the attached side; **center** = a centred
support (full block, fence/wall post, top slab, chain...); **non-air** = anything below.

| Block | Size | Builders use it for | Key state | Support | Who has it |
| --- | --- | --- | --- | --- | --- |
| stairs | ½ step | sills, corbels, eaves, cornices, column bases/capitals, chairs, benches, awnings | `facing` = tall back, `half=top` = upside-down | none | 56 families |
| slab | ½ | ledges, sills, string courses, shelves, decks, ridge caps, half-step paths | `type=top` sits flush under the cell above | none | 59 families |
| wall | 8/16 post + arms | balusters, parapets, well rims, chimney caps, lamp bases | sides/`up` computed | none | 25 stone families |
| fence | 4/16 post + rails | railings, table legs, lamp/sign arms out of a wall, posts | connections computed | none | 11 woods + `nether_brick` |
| fence gate | panel in a line | gates, railings in a wall line (`in_wall` drops it 3 px) | `facing` across the line | none | 11 woods |
| trapdoor | 3/16 panel | shutters, cladding, flower-box sides, shelves, armrests, table tops, floor panels, vents | `open=true` panel lies **opposite** `facing`; closed `half=top` = shelf | none | 11 woods, iron, 8 copper |
| door | 2 high, 3/16 | doors, iron gates | both halves, `hinge` | face below | 11 woods, iron, 8 copper |
| button | 6×4 px stud | rivets, bolts, knobs, studs on beams and furniture | `face=wall,facing=<out>` | face | 11 woods, `stone`, `polished_blackstone` |
| pressure plate | 1/16 | table tops on fences, trays, door mats | `powered=false` (weighted: `power=0`) | center | woods, stone, polished blackstone, `light_weighted` (gold), `heavy_weighted` (iron) |
| lever | small handle | coat hooks, handles, tool racks | `face=wall,facing=<out>` | face | `lever` |
| tripwire hook | small bracket | hinges, brackets, tiny hooks | `facing=<out>` | face | `tripwire_hook` |
| glass pane | 2/16 | windows with depth, display cases | connections computed | none | `glass_pane` + 16 colours |
| iron bars | 2/16 | grilles, cages, prison windows, balcony rails | connections computed | none | `iron_bars` |
| chain | 3/16 | lantern drops, chandeliers, rope barriers | `axis=y\|x\|z` | none | `chain` |
| lantern | small | lamps on posts, corbels, under arms | `hanging=true\|false` | center above / below | `lantern`, `soul_lantern` |
| candle | 1-4 sticks | tables, mantels, chandeliers | `candles=1..4,lit=true` | center | `candle` + 16 colours |
| end rod | 2/16 rod | modern lights, rails, antennae, bollards | `facing` = pointing direction | none | `end_rod` |
| lightning rod | copper rod | copper pipes, gutters, finials | `facing` = pointing direction | none | `lightning_rod` |
| sign / wall sign | board | labels, direction arrows, armrests | standing `rotation`; wall `facing=<out>` | solid below / behind | 11 woods |
| hanging sign | board on chains | shop signs | `attached`, `rotation`; wall variant `facing` **parallel** to the wall | center above / wall at side | 11 woods |
| banner | 1×2 cloth | flags, tapestries, heraldry | standing `rotation`; wall `facing=<out>` | solid below / behind | 16 colours |
| carpet | 1/16 | rugs, table cloths, striped canvas, moss overgrowth | — | non-air | 16 colours + `moss_carpet` |
| flower pot | small | window boxes, shelves, tables | use the `potted_*` id | put it on something | `flower_pot`, `potted_*` |
| head / skull | 8×8×8 px | trophies, finials, ornaments | standing `rotation`; wall `facing` | none | 7 kinds |
| barrel | full | crates, kegs, drawers | `facing` = lid side (6-way), `open` | none | `barrel` |
| composter | full, hollow | crates, planters, bins | `level=0..8` (8 = full of compost) | none | `composter` |
| grindstone | wheel | cart wheels, workshop | `face`, `facing` | none | `grindstone` |
| anvil | heavy | smithy, heavy furniture | `facing` sets the long axis | falls if nothing below | `anvil`, `chipped_anvil`, `damaged_anvil` |
| bell | bell | town bells, shop bells | `attachment`, `facing` (wall: support at `pos + facing`) | face | `bell` |
| cauldron | basin | sinks, basins, planters | `water_cauldron[level=1..3]` | none | `cauldron`, `water_cauldron`, `lava_cauldron` |
| lectern | desk | desks, pulpits, counters | `facing` = reader side, `has_book` | none | `lectern` |
| beehive | slatted box | crates, cabinets | `facing`, `honey_level` | none | `beehive`, `bee_nest` |
| decorated pot | vase | vases, amphorae, urns | `facing`, `cracked` | none | `decorated_pot` |
| scaffolding | frame | construction scaffolds | `bottom=false,distance=0` on the ground | column to ground | `scaffolding` |
| ladder | rungs | ladders, trellises, ship rigging | `facing=<out>` | face | `ladder` |
| amethyst | crystals | fantasy accents, gem finials | `facing` = pointing direction | face | `amethyst_cluster`, `large/medium/small_amethyst_bud` |
| pointed dripstone | spike | stalactites, spikes, cave ceilings | `vertical_direction`, `thickness` | block above/below | `pointed_dripstone` |
| leaves | full, see-through | hedges, planters, overgrowth | `persistent=true` | none | 8 tree leaves + 2 azalea |
| vines / lichen | sheet | wall overgrowth, ragged curtains | face booleans | face | `vine`, `glow_lichen` |

---

## 3. Who has what, and what to use instead

Counts from `scripts/lib/data/materials.json` (vanilla 1.21.1). Full matrix in
[materials.md › Families by kind](materials.md#families-by-kind).

| Shape | Exists for | Notably missing |
| --- | --- | --- |
| stairs / slab | 56 / 59 families | concrete, terracotta, wool, glass, calcite, dripstone, packed mud, deepslate (use cobbled), smooth stone (slab only), cut sandstone (slab only), plain copper (use cut copper) |
| wall | 25: `andesite`, `brick`, `cobbled_deepslate`, `deepslate_brick`, `deepslate_tile`, `polished_deepslate`, `diorite`, `granite`, `red_sandstone`, `sandstone`, `cobblestone`, `mossy_cobblestone`, `mossy_stone_brick`, `stone_brick`, `tuff`, `polished_tuff`, `tuff_brick`, `mud_brick`, `blackstone`, `polished_blackstone`, `polished_blackstone_brick`, `nether_brick`, `red_nether_brick`, `end_stone_brick`, `prismarine` | stone, smooth stone, quartz, purpur, polished andesite/diorite/granite, smooth sandstones, prismarine bricks, dark prismarine, every wood, every copper |
| fence | 11 woods + `nether_brick` | every other stone |
| fence gate | 11 woods | all stone |
| door / trapdoor | 11 woods, `iron`, 8 copper (incl. waxed) | all stone |
| button | 11 woods, `stone`, `polished_blackstone` | all other stone |
| pressure plate | 11 woods, `stone`, `polished_blackstone`, `gold` (light weighted), `iron` (heavy weighted) | all other stone |
| sign / hanging sign | 11 woods | everything else |

Substitutes when the variant is missing:

| You need | Missing for | Use instead |
| --- | --- | --- |
| stairs / slab / wall | any family above | `kit.material(name).substitutes[shape]` (same shape, colour-ranked, see [materials.md › Missing variants & substitutes](materials.md#missing-variants--substitutes)); stacked slabs as half-steps |
| wall | woods | the wood's `fence` (thin) or `stripped_log` column (full); slab or trapdoor cap for a low parapet |
| fence | any stone | the family's `wall` (thicker), `iron_bars` (thin metal), `nether_brick_fence` (dark, wrought-iron look), `chain[axis=x\|z]` (rope) |
| fence gate | any stone | a wood gate set in the wall line (`in_wall` is computed), or `iron_bars` |
| trapdoor (stone panel) | any stone | `iron_trapdoor` (light grey), `weathered_copper_trapdoor` / `oxidized_copper_trapdoor` (green), `dark_oak_trapdoor` (near black), or a top slab |
| door | stone buildings | `iron_door`, or the darkest/lightest wood that matches the trim |
| button | most stones | `stone_button` (grey), `polished_blackstone_button` (black), `birch_button`/`bamboo_button` (pale), `mangrove_button`/`crimson_button` (red), `warped_button` (teal) |
| pressure plate | most stones | `stone_pressure_plate`, `polished_blackstone_pressure_plate`, `light_weighted_pressure_plate` (gold), `heavy_weighted_pressure_plate` (iron), or a carpet |
| sign | non-wood palettes | birch/bamboo on light stone, dark oak/crimson on dark stone, spruce as neutral |

Kit fallback that never throws:

```js
const shapeOf = (name, shape, ...fallbacks) => {
  for (const n of [name, ...fallbacks]) {
    const fam = kit.material(n)
    const id = fam[shape] ?? fam.substitutes?.[shape]?.[0]
    if (id) return id
  }
  return null // caller decides: full block, slab stepping, or skip the detail
}
shapeOf('packed_mud', 'stairs')      // 'minecraft:mud_brick_stairs'
shapeOf('white_concrete', 'slab')    // 'minecraft:smooth_quartz_slab'
kit.variant('terracotta', 'stairs', 'granite') // kit's own chain: the first family that has it
```

`kit.stairs('smooth_stone', ...)` throws (no stairs). Resolve the id first, then build the state:
`` `${shapeOf('smooth_stone', 'stairs')}[facing=north,half=top]` ``.
Copper: use `kit.material('copper')` / `'exposed_copper'`...; `kit.material('copper_block')`
currently resolves to the **cut** copper family.

---

## 4. Techniques by block

### 4.1 Stairs

| Use | State (wall outside faces F) | Notes |
| --- | --- | --- |
| window sill | `half=top`, `facing=in`, cell below the glass, outside | the step hugs the wall; flat top flush with the glass bottom ([§6.1](#61-stair-sill)) |
| corbel / bracket | `half=top`, `facing=in`, under anything that overhangs | jetties, balconies, bay windows, wall lanterns ([§6.10](#610-jetty-corbels), [§6.13](#613-sconce)) |
| eave soffit | `half=top`, `facing=in`, under the eave row | `b.roof({ eaveTrim: true })` does it ([block-states.md §1](block-states.md#1-stairs)) |
| drip hood / awning | `half=bottom`, `facing=in`, row above an opening, 1 out | sheds "water" outward ([§6.3](#63-hood-and-sill), [§6.7](#67-stair-awning)) |
| column base / capital | ring of 8 stairs around the shaft, `facing` toward the shaft; `bottom` for the base, `top` for the capital | corners become outer shapes automatically ([§6.29](#629-column-with-base-and-capital)) |
| chair / bench | `half=bottom`, `facing` = backrest side | add open trapdoors as armrests ([§6.21](#621-table-and-armchairs)) |
| arch shoulders | `half=top`, facing away from the opening centre, in the top corners | `b.window({ arch: true })` / `b.arch(...)` |
| doorstep | `half=bottom`, `facing=in`, outside a raised door | you walk up toward `facing` |

```js
const out = kit.DIR[F]
b.set(x + out[0], y - 1, z + out[2], kit.stairs('spruce', kit.opposite(F), 'top'))   // sill under window cell [x, y, z]
b.set(x + out[0], y + 2, z + out[2], kit.stairs('stone_brick', kit.opposite(F), 'bottom')) // hood over a 2-high window
```

Rules: corners only form between stairs of the **same** `half`; a row of `half=top` stairs along a
wall that turns a corner gets its outer corner computed. Stairs never need support.

### 4.2 Slabs

- **Sill / ledge / cornice:** `type=top` one block out; its top is flush with the next course. A row
  one wider than the opening on each side reads as a stone sill ([§6.2](#62-slab-sill-with-apron)).
- **String course:** a continuous row of `type=top` slabs one block out at every floor line breaks a
  tall wall into storeys. Use the trim material. (convention)
- **Shelf / counter / mantel:** `type=top` against a wall at 2-3 blocks up; put pots and candles on it
  ([§6.18](#618-fireplace)).
- **Deck / balcony floor:** `type=top` at door-sill level so the floor is flush with the doorway
  ([§6.15](#615-balcony)).
- **Handrail and caps:** a `type=bottom` slab on walls or piers ([§6.30](#630-balustrade)).
- `type=double` keeps the slab texture (smooth stone shows a seam); use the full block for plain faces.

### 4.3 Walls

- **Balusters:** isolated wall posts every other cell under a slab handrail. An isolated wall has
  no neighbours, so it stays a post (`up=true`) ([§6.30](#630-balustrade)).
- **Parapet / garden wall:** a continuous run; the runner makes arms `low`, or `tall` when a block or
  bottom slab sits on top ([block-states.md §7](block-states.md#7-fences-walls-panes-iron-bars-and-fence-gates)).
- **Well rims, chimney caps, lamp bases:** a ring of walls on a ring of full blocks ([§6.25](#625-well)).
- Walls join walls, full faces, panes/bars and gates in their line; they **never** join fences. Put a
  full block or a wall between a fence run and a wall run.

### 4.4 Fences and fence gates

- **Railings:** fences on the edge of a deck; they join each other and any full face, so a fence next
  to the wall anchors itself ([§6.15](#615-balcony)).
- **Arms out of a wall:** a fence in the cell in front of a wall joins the wall face and reads as a
  bracket; hang a lantern or a hanging sign under its end ([§6.12](#612-lantern-arm), [§6.14](#614-sign-brackets)).
- **Table legs:** fences + pressure plates (or carpet) on top; two fences side by side join into a
  table with an apron ([§6.21](#621-table-and-armchairs)).
- **Posts:** lamp posts, market-stall frames, chandelier frames (fences join into a cross).
- `nether_brick_fence` never joins wooden fences. Use it as wrought iron on its own runs.
- Gates span **across** `facing`: a gate in an east-west fence is `facing=north|south`. A gate set in
  a wall line gets `in_wall=true` (computed) and drops 3 px to match the wall top. A gate on **top** of
  a wall does not connect to anything and looks like it floats; avoid.

### 4.5 Trapdoors

The most useful detail block: 3 px panels that need no support. An **open** trapdoor stands on the
side **opposite** its `facing` ([block-states.md §4](block-states.md#4-trapdoors-mr)).

| Use | State | Where |
| --- | --- | --- |
| shutter | `open=true,facing=out` | beside the window, in front of the wall ([§6.4](#64-shutters)) |
| cladding / fascia on a block's face | `open=true,facing=<that face>` | in the cell next to the face |
| flower-box front / sides | front `facing=out`; left end `facing=cw(out)`, right end `facing=ccw(out)` | around the soil ([§6.5](#65-flower-box)) |
| armrest | `open=true`, panel against the seat | the cells beside a stair chair ([§6.21](#621-table-and-armchairs)) |
| shelf / thin deck | `open=false,half=top` | 3 px board at the top of its cell; items stand on it ([§6.19](#619-wall-shelf)) |
| floor panel / hatch | `open=false,half=bottom` (floor) or `half=top` (flush ceiling hatch) | over ladders: same `facing` as the ladder |
| vent / grate | `iron_trapdoor` or a copper trapdoor, closed | floors, chimney tops |
| counter / cupboard door | `open=true,facing=out` in front of a block | kitchens ([§6.20](#620-kitchen-counter)) |
| canopy deck | `open=false,half=top` with carpets on top | striped awning ([§6.8](#68-canvas-awning)) |

```js
const shutter = (x, y, z, F, top = false) =>
  b.set(x, y, z, kit.trapdoor('spruce', F, { open: true, half: top ? 'top' : 'bottom' })) // x,y,z = cell beside the window, in front of the wall
```

Pick the trapdoor by its pattern (rendered survey, 1.21.1 textures):

| Pattern | Trapdoors | Good for |
| --- | --- | --- |
| solid planks | `spruce` (banded), `dark_oak` (4 panels), `birch` (framed) | shutters, cupboard doors, cladding, box sides |
| slats | `acacia` (vertical slots), `crimson` (horizontal slats) | louvred shutters, vents |
| 4-pane window | `oak`, `iron_trapdoor` | windowed shutters, hatches, grates |
| fine lattice | `jungle`, `cherry`, `bamboo` | screens, trellis panels, balcony fronts |
| single porthole | `mangrove` | doors, ship details |
| openwork | `warped`, copper trapdoors | fantasy grilles, vents |

Iron trapdoors read light grey; copper ones age orange → green (`waxed_*` ids keep the colour).

### 4.6 Doors

- Doors are 2 blocks: write both halves with the same `facing`/`hinge`
  ([block-states.md §5](block-states.md#5-doors-mrv)). `b.door(pos, F, { width: 2 })` does double doors.
- Frame every important door: jambs of stripped logs or a contrasting stone, a lintel, a stair or
  slab hood ([§6.9](#69-door-surround)). A bare door in a flat wall is the most common "unfinished" tell. (taste)
- A raised door (foundation course) gets a doorstep stair outside, `facing=in`.
- `iron_door` reads as a metal gate or vault door; it needs a full block below.

### 4.7 Buttons, levers, tripwire hooks, pressure plates

- **Rivets and bolts:** `polished_blackstone_button[face=wall,facing=<out>]` on the face of a beam or
  log end; dark studs on wood read as iron fittings ([§6.11](#611-beam-ends-with-bolts)).
- **Knobs / handles:** a button on the face of a barrel, bookshelf or planks block.
- **Coat hooks / tool rack:** a row of `lever[face=wall,facing=<out>,powered=false]` on a beam.
- **Brackets / hinges:** `tripwire_hook[attached=false,facing=<out>,powered=false]`.
- **Table top / tray:** a pressure plate on a fence post; `light_weighted_pressure_plate[power=0]`
  is a gold tray, `heavy_weighted_pressure_plate[power=0]` an iron one.
- All of these need a **full face** behind (buttons, levers, hooks) or a centred support below
  (plates). A button on a fence or a stair side is deleted in-game.

```js
b.set(x, y, z, 'polished_blackstone_button[face=wall,facing=south,powered=false]') // stud on the south face of the block at z-1
b.set(x, y, z, 'lever[face=wall,facing=south,powered=false]')                       // hook
b.set(x, y, z, 'spruce_pressure_plate[powered=false]')                              // on top of a fence at y-1
```

### 4.8 Panes, iron bars, chains

- **Windows:** panes give a thin glazing line with the frame visible around it; full glass blocks are
  for greenhouses, modern curtain walls and ice. Recess the pane one block for depth
  (`b.window({ recess: 1 })`). Panes, bars and walls join each other.
- **Iron bars:** grilles, prison/castle windows, cages, balcony railings, fire screens
  ([§6.18](#618-fireplace)).
- **Chains:** `chain[axis=y]` for lantern drops and chandeliers ([§6.22](#622-chandelier));
  `chain[axis=x|z]` between two posts is a rope barrier (it does not sag or connect, it just lines up).

### 4.9 Lights

- **Lantern:** standing (`hanging=false`) on a post, wall top or corbel ([§6.13](#613-sconce));
  hanging (`hanging=true`) under a fence arm, chain or full block ([§6.12](#612-lantern-arm)).
  `soul_lantern` gives cold blue light.
- **Candles:** `candles=1..4` per block, `lit=true`; colours match the 16 dyes. Put them on top
  slabs, trapdoor shelves, fence posts or mantels. 3-4 candles per block read as a cluster.
- **End rods:** point toward `facing`. `facing=down` is a modern ceiling light; horizontal rods
  (`facing=east` in a row) are rails, towel bars or curtain rods; `facing=up` on a fence post is a
  bollard. They need no support.
- **Lightning rods:** copper pipes. Horizontal rods along an eave are a gutter; a vertical stack is a
  downpipe ([§6.16](#616-copper-pipe-and-gutter)); one rod on a spire is a finial. In 1.21.1 they do not
  oxidise.
- Light blocks with no state: `glowstone`, `sea_lantern`, `shroomlight`, `*_froglight` (have `axis`).
  The preview does not simulate light levels; place real light sources anyway (a lantern every
  6-8 blocks along a street, one per room). (convention)

### 4.10 Signs, banners, heads

- **Wall sign:** `*_wall_sign[facing=<out>]`, board on the `out` face of the block behind. Uses:
  labels, direction arrows on a post ([§6.31](#631-signpost)), armrests on benches.
- **Standing sign / banner / head:** `rotation` 0-15, clockwise from south (0 faces south).
  The preview mirrors east/west for these; write the vanilla value
  ([block-states.md §9](block-states.md#9-signs-banners-and-heads)).
- **Hanging sign:** under a fence arm use `*_hanging_sign[attached=true,rotation=4]` (board
  perpendicular to a south/north wall); against a wall use `*_wall_hanging_sign[facing=...]` where
  `facing` is **parallel** to the wall ([§6.14](#614-sign-brackets)).
- **Banners:** a wall banner's cloth fills its own cell and the one below; keep that cell empty. Use
  them as tapestries, flags on poles (standing banner on the ground or top of a post), shop colours.
  Patterns need block-entity NBT (`patterns`); a plain dyed banner needs none.
- **Heads:** floor heads (`skeleton_skull[rotation=0]` ...) on fence posts as trophies or finials.

### 4.11 Carpets and flower pots

- **Rugs:** carpets on the floor, 2-3 colours max, with a 1-block border of floor showing. (taste)
- **Table cloth:** carpet on top of a fence-post table instead of a pressure plate.
- **Striped canvas:** alternating colours on a deck of top slabs or closed `half=top` trapdoors
  ([§6.8](#68-canvas-awning), [§6.26](#626-market-stall)). A carpet only needs a non-air block below.
- **Moss overgrowth:** `moss_carpet` on roofs, ledges and paths; `b.overgrow(...)` adds it with vines.
- **Flower pots:** use the potted id directly: `potted_red_tulip`, `potted_fern`, `potted_cactus`,
  `potted_azalea_bush`, `potted_flowering_azalea_bush`, `potted_oak_sapling`, ... (no NBT). An empty
  pot is `flower_pot`. Place them on top slabs, trapdoor shelves, window sills and tables.

### 4.12 Item-like decor

Each of these reads as a recognisable object at 1:1 scale. All rendered in the sampler build.

| Block and state | Reads as |
| --- | --- |
| `barrel[facing=up,open=false]` / `[facing=south]` | crate, keg (lid on the `facing` side); `open=true` shows the contents hole |
| `composter[level=0]` / `[level=8]` | slatted crate (empty / full of soil); planter, bin |
| `beehive[facing=south,honey_level=0]` | crate or cabinet with slats |
| `grindstone[face=wall,facing=<out>]` | cart wheel on an axle (the wall side is the cart body) ([§6.28](#628-hand-cart)) |
| `anvil[facing=east]` | smithy, heavy workbench (long axis along `facing`) |
| `cauldron` / `water_cauldron[level=3]` | basin, sink, planter, well bucket |
| `lectern[facing=<reader side>,has_book=true,powered=false]` | desk, pulpit, counter |
| `decorated_pot[facing=south,cracked=false,waterlogged=false]` | vase, amphora, urn |
| `chiseled_bookshelf[facing=..., slot_N_occupied=...]` | half-filled shelf (mix `true`/`false` slots) |
| `bell[attachment=floor\|ceiling\|single_wall\|double_wall,facing=...,powered=false]` | town bell, shop bell; `single_wall` hangs from a wall at `pos + facing` |
| `brewing_stand[has_bottle_0=true,...]`, `campfire[lit=false]` | alchemy table; log pile / dead fire |
| `smoker[facing=<out>,lit=true]`, `cartography_table`, `fletching_table`, `smithing_table`, `loom`, `stonecutter` | kitchen, shops, workshops (use as furniture, one per room) |
| `hay_block[axis=x]` | hay bale, sack pile |

### 4.13 Scaffolding and ladders

- `scaffolding[bottom=false,distance=0,waterlogged=false]` in a column from the ground: construction
  scaffolds around unfinished towers, market frames. Free-hanging scaffolding falls in-game.
- `ladder[facing=<out>]` on a wall: ladders, trellises (pair with vines), ship rigging, rungs on a
  chimney. Needs a full face behind.

### 4.14 Crystals and dripstone

- `amethyst_cluster[facing=up]` on amethyst/calcite: gem finials, fantasy accents;
  `large_amethyst_bud[facing=<out>]` on a side face for small sparkles.
- Stalactites under an overhang: `pointed_dripstone[thickness=frustum,vertical_direction=down]` above
  `[thickness=tip,vertical_direction=down]`; order and thickness rules in
  [block-states.md §10](block-states.md#10-vines-plants-and-natural-blocks). Brown, so they read as
  rock or roots, not ice.

### 4.15 Leaves and vines as decoration

- Always `persistent=true` (`finish()` sets it). Leaves are see-through cubes: hedges (1-2 high,
  trimmed square), planters ([§6.32](#632-hedge-planter)), green roofs, overgrown ruins.
- `flowering_azalea_leaves` add pink flowers; mix 1:1 with `azalea_leaves`.
- **Vine curtain:** vines on the outside cells of a wall with the side toward the wall `true`
  (`north=true` on a south-facing wall), ragged lengths ([§6.17](#617-vine-curtain)).
- `glow_lichen` with the wall side `true` is a faint glowing patch; `hanging_roots` under rooted dirt,
  `weeping_vines`/`cave_vines` columns for hanging gardens (tip id at the bottom).

---

## 5. Kit patterns

### 5.1 Stamp a wall module on any facade

All wall modules in §6 are authored for a **south-facing wall**: local `x` runs left → right as seen
from outside, `y` up, `z = 0` is the wall plane and `z ≥ 1` is outside. The helper below places
local `[0, 0, 0]` on wall cell `p` (bottom-left of the module, seen from outside) for any facing;
`b.stamp` rotates every block state with it.

```js
const TURNS = { south: 0, west: 1, north: 2, east: 3 }

function stampOnWall(b, m, p, F) {
  const t = TURNS[F]
  const [sx, , sz] = m.size
  const o = [[0, 0], [sz - 1, 0], [sx - 1, sz - 1], [0, sx - 1]][t]
  b.stamp(m, [p[0] - o[0], p[1], p[2] - o[1]], { rotate: t })
}
```

`p` for a wall whose outside faces F, `u` cells right of the left corner (seen from outside):
south wall at `z1` → `[x0 + u, y, z1]`; north wall at `z0` → `[x1 - u, y, z0]`;
east wall at `x1` → `[x1, y, z1 - u]`; west wall at `x0` → `[x0, y, z0 + u]`.

Freestanding modules are authored with their front to the south; `b.stamp(m, at, { rotate: 1 })`
turns them 90° clockwise (front west), `2` → north, `3` → east.

Modules cannot carve air (air is not stored), so cut openings first: `b.clear(a, c)`.

### 5.2 A detail pass with variation

```js
const windows = [[4, 3], [9, 3], [14, 3]]                    // [u, y] of each 2×2 window on the south wall
for (const [u, y] of windows) {
  const p = [x0 + u, y, z1]
  stampOnWall(b, sillStair(b, kit), [p[0], y - 1, z1], 'south')       // sill row one below the glass
  stampOnWall(b, shutters(b, kit), [p[0] - 1, y, z1], 'south')
  if (kit.hash01(u, y, 0, 7) < 0.6) stampOnWall(b, flowerBox(b, kit, { flowers: ['poppy', 'cornflower'] }), [p[0] - 1, y - 1, z1], 'south')
}
```

Pick the variation with `kit.hash01` or `kit.rng(seed)` so a rebuild is identical.

### 5.3 Checking details

Render close-ups, not only the default fit views:

```
node scripts/render.mjs --nbt out/x.nbt --yaw 25 --pitch 15 --target 12,4,20 --distance 8
node scripts/render.mjs --nbt out/x.nbt --clip 8,0,15,16,9,24 --yaw 25 --pitch 15 --target 12,4,20 --distance 8
```

`--clip` isolates one module; check each wall from its own side (`yaw` 0 = from south, 90 = from
east, 180 = north, 270 = west).

---

## 6. Micro-modules

Each function returns a `b.module`; wall modules go through `stampOnWall` (§5.1), freestanding ones
through `b.stamp`. Arguments: `(b, kit, opts)`. All were built and rendered; defaults are the
tested values.

### Windows

#### 6.1 Stair sill
Upside-down stair under a pane window. Origin: the sill row (one below the glass). Size `[w, h+1, 2]`.

```js
function sillStair(b, kit, { w = 2, h = 2, mat = 'spruce', glass = 'glass_pane' } = {}) {
  const m = b.module([w, h + 1, 2])
  for (let x = 0; x < w; x++) {
    m.set(x, 0, 1, kit.stairs(mat, 'north', 'top')) // upside-down stair hugging the wall
    for (let y = 1; y <= h; y++) m.set(x, y, 0, glass)
  }
  return m
}
stampOnWall(b, sillStair(b, kit, { w: 2 }), [x, y, z], 'east')
```

#### 6.2 Slab sill with apron
Stone sill one wider each side, wooden apron panel below. Origin: the apron row. Size `[w+2, h+2, 2]`.

```js
function sillSlabApron(b, kit, { w = 2, h = 2, sill = 'smooth_stone', apron = 'spruce', glass = 'glass_pane' } = {}) {
  const m = b.module([w + 2, h + 2, 2])
  for (let x = 0; x < w + 2; x++) m.set(x, 1, 1, kit.slab(sill, 'top')) // sill 1 wider each side
  for (let x = 1; x <= w; x++) {
    m.set(x, 0, 1, kit.trapdoor(apron, 'south', { open: true })) // apron panel under the sill
    for (let y = 2; y <= h + 1; y++) m.set(x, y, 0, glass)
  }
  return m
}
```

#### 6.3 Hood and sill
Classical window: drip hood of bottom stairs, top-slab sill, both one wider than the glass, in a
contrasting stone. Origin: the sill row. Size `[w+2, h+2, 2]`.

```js
function hoodAndSill(b, kit, { w = 2, h = 2, mat = 'polished_diorite', glass = 'glass_pane' } = {}) {
  const m = b.module([w + 2, h + 2, 2])
  for (let x = 0; x < w + 2; x++) {
    m.set(x, 0, 1, kit.slab(mat, 'top')) // sill
    m.set(x, h + 1, 1, kit.stairs(mat, 'north', 'bottom')) // drip hood, sheds water outward
  }
  for (let x = 1; x <= w; x++) for (let y = 1; y <= h; y++) m.set(x, y, 0, glass)
  return m
}
```

#### 6.4 Shutters
Open trapdoors flat on the wall either side of the glass; top one `half=top`. Origin: the left
shutter's bottom cell. Size `[w+2, h, 2]`.

```js
function shutters(b, kit, { w = 2, h = 2, mat = 'spruce', glass = 'glass_pane' } = {}) {
  const m = b.module([w + 2, h, 2])
  for (let y = 0; y < h; y++) {
    for (let x = 1; x <= w; x++) m.set(x, y, 0, glass)
    const half = y === h - 1 && h > 1 ? 'top' : 'bottom'
    m.set(0, y, 1, kit.trapdoor(mat, 'south', { open: true, half })) // panel lies flat on the wall
    m.set(w + 1, y, 1, kit.trapdoor(mat, 'south', { open: true, half }))
  }
  return m
}
```

#### 6.5 Flower box
Soil boxed by open trapdoors (front + both ends), one flower per cell. Stamp it at the sill row, under
a window. Size `[w+2, 2, 3]`.

```js
function flowerBox(b, kit, { w = 2, mat = 'spruce', soil = 'rooted_dirt', flowers = ['poppy', 'azure_bluet', 'cornflower', 'oxeye_daisy'] } = {}) {
  const m = b.module([w + 2, 2, 3])
  for (let x = 1; x <= w; x++) {
    m.set(x, 0, 1, soil)
    m.set(x, 0, 2, kit.trapdoor(mat, 'south', { open: true })) // front panel
    m.set(x, 1, 1, flowers[(x - 1) % flowers.length])
  }
  m.set(0, 0, 1, kit.trapdoor(mat, 'west', { open: true })) // left end panel (lies on its east edge)
  m.set(w + 1, 0, 1, kit.trapdoor(mat, 'east', { open: true })) // right end panel
  return m
}
```

#### 6.6 Bay window
Projecting glazed box: corbelled stair base, log posts, lean-to stair roof. `b.clear` the wall
opening behind it first. Size `[w+2, h+2, 2]`.

```js
function bayWindow(b, kit, { w = 3, h = 2, mat = 'spruce', post = 'stripped_spruce_log', glass = 'glass_pane' } = {}) {
  const m = b.module([w + 2, h + 2, 2])
  for (let x = 0; x < w + 2; x++) {
    m.set(x, 0, 1, kit.stairs(mat, 'north', 'top')) // corbelled base
    m.set(x, h + 1, 1, kit.stairs(mat, 'north', 'bottom')) // lean-to roof
  }
  for (let y = 1; y <= h; y++) {
    m.set(0, y, 1, kit.log(post, 'y'))
    m.set(w + 1, y, 1, kit.log(post, 'y'))
    for (let x = 1; x <= w; x++) m.set(x, y, 1, glass)
  }
  return m
}
```

### Doors and awnings

#### 6.7 Stair awning
Two-deep sloped wooden awning with end brackets, over a door or shop window. Origin: the lower
(slab) row, 1 above the opening. Size `[w+2, 2, 3]`.

```js
function stairAwning(b, kit, { w = 3, mat = 'spruce' } = {}) {
  const m = b.module([w + 2, 2, 3])
  for (let x = 0; x < w + 2; x++) {
    m.set(x, 1, 1, kit.stairs(mat, 'north', 'bottom')) // upper row against the wall
    m.set(x, 0, 2, kit.slab(mat, 'top')) // lower outer row: 2-deep slope
  }
  m.set(0, 0, 1, kit.stairs(mat, 'north', 'top')) // end brackets
  m.set(w + 1, 0, 1, kit.stairs(mat, 'north', 'top'))
  return m
}
```

#### 6.8 Canvas awning
Striped carpet canvas on a deck of closed top trapdoors. Origin: 1 above the opening. Size `[w, 2, 3]`.

```js
function canvasAwning(b, kit, { w = 4, frame = 'spruce', colors = ['red', 'white'] } = {}) {
  const m = b.module([w, 2, 3])
  for (let x = 0; x < w; x++) {
    for (let z = 1; z <= 2; z++) {
      m.set(x, 0, z, kit.trapdoor(frame, 'south', { half: 'top' })) // thin closed deck
      m.set(x, 1, z, `${colors[x % colors.length]}_carpet`) // striped canvas
    }
  }
  return m
}
```

#### 6.9 Door surround
Door in stripped-log jambs and lintel, stair brackets and hood, doorstep for a raised door. Origin:
the foundation course (the door is at `y+1`). Size `[3, 5, 2]`.

```js
function doorSurround(b, kit, { mat = 'spruce', frame = 'stripped_oak_log', step = 'stone_brick' } = {}) {
  const m = b.module([3, 5, 2])
  const door = kit.material(mat).door
  m.set(1, 1, 0, `${door}[facing=south,half=lower,hinge=left,open=false,powered=false]`)
  m.set(1, 2, 0, `${door}[facing=south,half=upper,hinge=left,open=false,powered=false]`)
  for (let y = 1; y <= 3; y++) {
    m.set(0, y, 0, kit.log(frame, 'y')) // jambs
    m.set(2, y, 0, kit.log(frame, 'y'))
  }
  m.set(1, 3, 0, kit.log(frame, 'x')) // lintel
  m.set(1, 0, 1, kit.stairs(step, 'north', 'bottom')) // doorstep: walk up toward the door
  m.set(0, 3, 1, kit.stairs(mat, 'north', 'top')) // brackets
  m.set(2, 3, 1, kit.stairs(mat, 'north', 'top'))
  for (let x = 0; x < 3; x++) m.set(x, 4, 1, kit.stairs(mat, 'north', 'bottom')) // hood
  return m
}
```

### Beams and brackets

#### 6.10 Jetty corbels
Overhanging timber upper floor: sill beam on stair corbels under every post. Origin: the corbel row.
Size `[w, 4, 2]`.

```js
function jetty(b, kit, { w = 7, every = 3, mat = 'spruce', beam = 'stripped_spruce_log', infill = 'white_terracotta' } = {}) {
  const m = b.module([w, 4, 2])
  for (let x = 0; x < w; x++) {
    m.set(x, 1, 1, kit.log(beam, 'x')) // sill beam of the overhanging floor
    for (let y = 2; y < 4; y++) m.set(x, y, 1, x % every === 0 ? kit.log(beam, 'y') : infill)
    if (x % every === 0) m.set(x, 0, 1, kit.stairs(mat, 'north', 'top')) // corbel under each post
  }
  return m
}
```

#### 6.11 Beam ends with bolts
Joist ends poking out under a wall beam, dark buttons as bolt heads and rivets. Size `[w, 2, 3]`.

```js
function beamEnds(b, kit, { w = 7, every = 3, log = 'spruce_log', bolt = 'polished_blackstone_button', beam = 'stripped_spruce_log' } = {}) {
  const m = b.module([w, 2, 3])
  for (let x = 0; x < w; x++) {
    m.set(x, 1, 0, kit.log(beam, 'x')) // beam set into the wall
    if (x % every === 0) {
      m.set(x, 0, 1, kit.log(log, 'z')) // joist end poking out
      m.set(x, 0, 2, `${bolt}[face=wall,facing=south,powered=false]`) // bolt head on the end grain
    } else {
      m.set(x, 1, 1, `${bolt}[face=wall,facing=south,powered=false]`) // rivets along the beam
    }
  }
  return m
}
```

### Wall lights and signs

#### 6.12 Lantern arm
Two fences out of the wall, lantern hanging under the tip. Origin: the lantern row. Size `[1, 2, 3]`.

```js
function lanternArm(b, kit, { fence = 'spruce_fence', lantern = 'lantern' } = {}) {
  const m = b.module([1, 2, 3])
  m.set(0, 1, 1, fence) // joins the wall
  m.set(0, 1, 2, fence)
  m.set(0, 0, 2, `${lantern}[hanging=true,waterlogged=false]`)
  return m
}
```

#### 6.13 Sconce
Stair corbel with a standing lantern on its flat top. Size `[1, 2, 2]`.

```js
function sconce(b, kit, { mat = 'stone_brick', lantern = 'lantern' } = {}) {
  const m = b.module([1, 2, 2])
  m.set(0, 0, 1, kit.stairs(mat, 'north', 'top')) // corbel: flat top, step hugging the wall
  m.set(0, 1, 1, `${lantern}[hanging=false,waterlogged=false]`)
  return m
}
```

#### 6.14 Sign brackets
A: hanging sign under a fence arm. B: wall hanging sign (its own bracket). Hanging signs render as
plain boards in the preview (white or flat wood colour, no text: their textures are not in the
atlas); they are correct in-game.
Size `[3, 2, 3]`.

```js
function signBracket(b, kit, { wood = 'spruce' } = {}) {
  const m = b.module([3, 2, 3])
  // A: fence arm + ceiling hanging sign (attached=true: V-chains under a narrow support)
  m.set(0, 1, 1, `${wood}_fence`)
  m.set(0, 1, 2, `${wood}_fence`)
  m.set(0, 0, 2, `${wood}_hanging_sign[attached=true,rotation=4,waterlogged=false]`) // board runs N-S
  // B: wall hanging sign: its own bar sticks out of the wall; facing is PARALLEL to the wall
  m.set(2, 1, 1, `${wood}_wall_hanging_sign[facing=east,waterlogged=false]`)
  return m
}
```

### Facade extras

#### 6.15 Balcony
Door to a top-slab deck with fence rails and stair brackets. Origin: the bracket row (deck at `y+1`,
door at `y+2`). Size `[w, 4, 3]`.

```js
function balcony(b, kit, { w = 3, mat = 'spruce' } = {}) {
  const m = b.module([w, 4, 3])
  const door = kit.material(mat).door
  const mid = Math.floor(w / 2)
  m.set(mid, 2, 0, `${door}[facing=south,half=lower,hinge=left,open=false,powered=false]`)
  m.set(mid, 3, 0, `${door}[facing=south,half=upper,hinge=left,open=false,powered=false]`)
  for (let x = 0; x < w; x++) {
    for (let z = 1; z <= 2; z++) m.set(x, 1, z, kit.slab(mat, 'top')) // deck flush with the door sill
    m.set(x, 2, 2, `${mat}_fence`) // front rail
  }
  m.set(0, 2, 1, `${mat}_fence`) // side rails
  m.set(w - 1, 2, 1, `${mat}_fence`)
  m.set(0, 0, 1, kit.stairs(mat, 'north', 'top')) // brackets
  m.set(w - 1, 0, 1, kit.stairs(mat, 'north', 'top'))
  return m
}
```

#### 6.16 Copper pipe and gutter
Lightning rods as a gutter (horizontal) and downpipe (vertical). Size `[w, h, 2]`.

```js
function pipeAndGutter(b, kit, { w = 4, h = 4 } = {}) {
  const m = b.module([w, h, 2])
  for (let x = 0; x < w; x++) m.set(x, h - 1, 1, 'lightning_rod[facing=east,powered=false,waterlogged=false]') // gutter
  for (let y = 0; y < h - 1; y++) m.set(w - 1, y, 1, 'lightning_rod[facing=up,powered=false,waterlogged=false]') // downpipe
  return m
}
```

#### 6.17 Vine curtain
Ragged vines down a wall. Origin: bottom of the longest strand. Size `[w, h, 2]`.

```js
function vineCurtain(b, kit, { w = 4, h = 4, seed = 3 } = {}) {
  const m = b.module([w, h, 2])
  for (let x = 0; x < w; x++) {
    const len = 1 + Math.floor(kit.hash01(x, 0, 0, seed) * h) // ragged lower edge
    for (let y = h - 1; y >= h - len; y--) m.set(x, y, 1, 'vine[north=true,east=false,south=false,west=false,up=false]')
  }
  return m
}
```

### Interior

#### 6.18 Fireplace
Brick chimney breast, campfire behind iron bars, mantel shelf with candles and a pot, stone hearth.
Interior wall, room on the module's `+z` side. Size `[3, 5, 3]`.

```js
function fireplace(b, kit, { mat = 'brick', mantle = 'spruce' } = {}) {
  const m = b.module([3, 5, 3])
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
    if (x === 1 && y < 2) continue // firebox opening
    m.set(x, y, 1, kit.material(mat).block) // chimney breast
  }
  m.set(1, 0, 1, 'campfire[facing=south,lit=true,signal_fire=false,waterlogged=false]')
  m.set(1, 1, 1, 'iron_bars') // fire screen look from the room
  for (let x = 0; x < 3; x++) {
    m.set(x, 2, 2, kit.slab(mantle, 'top')) // mantel shelf
    m.set(x, 0, 2, kit.slab('smooth_stone', 'bottom')) // hearth
  }
  m.set(0, 3, 2, 'candle[candles=3,lit=true,waterlogged=false]')
  m.set(2, 3, 2, 'potted_fern')
  return m
}
```

#### 6.19 Wall shelf
Closed top trapdoors as a 3 px shelf carrying pots, candles and a vase. Size `[w, 2, 2]`.

```js
function wallShelf(b, kit, { w = 3, wood = 'spruce' } = {}) {
  const m = b.module([w, 2, 2])
  const items = ['potted_red_tulip', 'candle[candles=2,lit=true,waterlogged=false]', 'decorated_pot[facing=south,cracked=false,waterlogged=false]', 'flower_pot']
  for (let x = 0; x < w; x++) {
    m.set(x, 0, 1, kit.trapdoor(wood, 'south', { half: 'top' })) // 3 px shelf board at the top of the cell
    m.set(x, 1, 1, items[x % items.length])
  }
  return m
}
```

#### 6.20 Kitchen counter
Cupboard (planks + open trapdoor door), smoker, cauldron sink, barrel drawer, shelf over the stove.
Size `[4, 3, 3]`.

```js
function kitchenCounter(b, kit, { wood = 'spruce' } = {}) {
  const m = b.module([4, 3, 3])
  m.set(0, 0, 1, `${wood}_planks`)
  m.set(0, 0, 2, kit.trapdoor(wood, 'south', { open: true })) // cupboard door
  m.set(1, 0, 1, 'smoker[facing=south,lit=true]')
  m.set(2, 0, 1, 'water_cauldron[level=3]') // sink
  m.set(3, 0, 1, 'barrel[facing=south,open=false]') // drawer front
  m.set(0, 1, 1, 'potted_fern')
  m.set(3, 1, 1, 'stone_pressure_plate[powered=false]') // cutting board
  m.set(1, 2, 1, kit.trapdoor(wood, 'south', { half: 'top' })) // shelf over the stove
  m.set(2, 2, 1, kit.trapdoor(wood, 'south', { half: 'top' }))
  return m
}
```

#### 6.21 Table and armchairs
Fence legs + pressure-plate top, stair chairs with open-trapdoor armrests. Freestanding. Size `[4, 2, 3]`.

```js
function tableAndChairs(b, kit, { wood = 'spruce' } = {}) {
  const m = b.module([4, 2, 3])
  for (const x of [1, 2]) {
    m.set(x, 0, 1, `${wood}_fence`) // legs + apron (fences join)
    m.set(x, 1, 1, `${wood}_pressure_plate[powered=false]`) // 1/16 top
  }
  m.set(0, 0, 1, kit.stairs(wood, 'west', 'bottom')) // backrest west, sitter faces east
  m.set(3, 0, 1, kit.stairs(wood, 'east', 'bottom'))
  for (const x of [0, 3]) {
    m.set(x, 0, 0, kit.trapdoor(wood, 'north', { open: true })) // armrest on the seat's north side
    m.set(x, 0, 2, kit.trapdoor(wood, 'south', { open: true }))
  }
  return m
}
```

#### 6.22 Chandelier
Chain from the ceiling, fence cross with candles, lantern underneath. Stamp so the module's top row
is directly under the ceiling: `b.stamp(m, [x, ceilingY - m.size[1], z])`. Size `[3, drop+2, 3]`.

```js
function chandelier(b, kit, { drop = 2, wood = 'dark_oak' } = {}) {
  const m = b.module([3, drop + 2, 3]) // stamp so that y = size - 1 is directly under the ceiling
  const hub = 1
  for (let y = hub + 1; y <= hub + drop; y++) m.set(1, y, 1, 'chain[axis=y,waterlogged=false]')
  m.set(1, hub, 1, `${wood}_fence`)
  for (const [x, z] of [[0, 1], [2, 1], [1, 0], [1, 2]]) {
    m.set(x, hub, z, `${wood}_fence`)
    m.set(x, hub + 1, z, 'candle[candles=3,lit=true,waterlogged=false]')
  }
  m.set(1, 0, 1, 'lantern[hanging=true,waterlogged=false]')
  return m
}
```

### Street and yard

#### 6.23 Bench
Stair seat (backrest north, faces south) with trapdoor ends. Size `[len+2, 1, 1]`.

```js
function bench(b, kit, { len = 3, wood = 'spruce' } = {}) {
  const m = b.module([len + 2, 1, 1])
  for (let x = 1; x <= len; x++) m.set(x, 0, 0, kit.stairs(wood, 'north', 'bottom')) // backrest north, faces south
  m.set(0, 0, 0, kit.trapdoor(wood, 'west', { open: true }))
  m.set(len + 1, 0, 0, kit.trapdoor(wood, 'east', { open: true }))
  return m
}
```

#### 6.24 Lamp post
Wall base, fence shaft, cross arm with two hanging lanterns, trapdoor cap. Size `[3, 6, 1]`.

```js
function lampPost(b, kit, { base = 'stone_brick_wall', post = 'spruce_fence', cap = 'spruce' } = {}) {
  const m = b.module([3, 6, 1])
  m.set(1, 0, 0, base)
  m.set(1, 1, 0, base)
  m.set(1, 2, 0, post)
  m.set(1, 3, 0, post)
  for (const x of [0, 1, 2]) m.set(x, 4, 0, post) // cross arm (fences join)
  m.set(0, 3, 0, 'lantern[hanging=true,waterlogged=false]')
  m.set(2, 3, 0, 'lantern[hanging=true,waterlogged=false]')
  m.set(1, 5, 0, kit.trapdoor(cap, 'south')) // flat cap
  return m
}
```

#### 6.25 Well
Cobblestone ring with wall rim, water, fence posts and windlass bar, chain, small gable roof.
Size `[5, 6, 5]`.

```js
function well(b, kit, { stone = 'cobblestone', wood = 'spruce' } = {}) {
  const m = b.module([5, 6, 5])
  for (let x = 1; x <= 3; x++) for (let z = 1; z <= 3; z++) {
    const ring = x !== 2 || z !== 2
    m.set(x, 0, z, ring ? stone : 'water[level=0]')
    if (ring) m.set(x, 1, z, kit.material(stone).wall) // rim
  }
  for (const x of [1, 3]) for (let y = 2; y <= 3; y++) m.set(x, y, 2, `${wood}_fence`) // posts
  m.set(2, 3, 2, `${wood}_fence`) // windlass bar
  m.set(2, 2, 2, 'chain[axis=y,waterlogged=false]')
  m.set(2, 1, 2, 'chain[axis=y,waterlogged=false]')
  for (let x = 0; x <= 4; x++) {
    m.set(x, 4, 1, kit.stairs(wood, 'south', 'bottom')) // north slope
    m.set(x, 4, 3, kit.stairs(wood, 'north', 'bottom')) // south slope
    m.set(x, 4, 2, `${wood}_planks`)
    m.set(x, 5, 2, kit.slab(wood, 'bottom')) // ridge
  }
  return m
}
```

#### 6.26 Market stall
Counter of barrel/planks/composter with a trapdoor front, fence posts, top-slab deck with striped
carpet canvas, stock barrel behind. Front = south. Size `[3, 5, 4]`.

```js
function marketStall(b, kit, { wood = 'spruce', colors = ['red', 'white'] } = {}) {
  const m = b.module([3, 5, 4])
  for (const x of [0, 2]) {
    for (let y = 0; y < 3; y++) m.set(x, y, 0, `${wood}_fence`) // back posts
    for (let y = 1; y < 3; y++) m.set(x, y, 2, `${wood}_fence`) // front posts on the counter
  }
  m.set(0, 0, 2, 'barrel[facing=up,open=false]')
  m.set(1, 0, 2, `${wood}_planks`)
  m.set(2, 0, 2, 'composter[level=8]')
  m.set(1, 0, 3, kit.trapdoor(wood, 'south', { open: true })) // counter front panel
  m.set(1, 1, 2, 'decorated_pot[facing=south,cracked=false,waterlogged=false]')
  m.set(1, 0, 0, 'barrel[facing=south,open=false]') // stock behind
  for (let x = 0; x < 3; x++) for (let z = 0; z < 4; z++) {
    m.set(x, 3, z, kit.slab(wood, 'top')) // canopy deck
    m.set(x, 4, z, `${colors[x % colors.length]}_carpet`) // striped canvas on a flush top-slab deck
  }
  return m
}
```

#### 6.27 Crate stack
Barrels in mixed facings, composter, hay, cracked pot, loose lid. Size `[3, 3, 2]`.

```js
function crateStack(b, kit) {
  const m = b.module([3, 3, 2])
  m.set(0, 0, 0, 'barrel[facing=up,open=false]')
  m.set(1, 0, 0, 'barrel[facing=east,open=false]')
  m.set(2, 0, 0, 'composter[level=0]')
  m.set(0, 1, 0, 'barrel[facing=south,open=false]')
  m.set(1, 1, 0, 'hay_block[axis=x]')
  m.set(0, 2, 0, 'decorated_pot[facing=south,cracked=true,waterlogged=false]')
  m.set(1, 0, 1, 'spruce_trapdoor[facing=south,half=bottom,open=false,powered=false,waterlogged=false]') // loose lid
  m.set(2, 0, 1, 'flower_pot')
  return m
}
```

#### 6.28 Hand cart
Grindstone wheels on a barrel body, hay load, fence shaft, trapdoor tailboard. (taste: reads as a cart
from the side.) Size `[3, 2, 3]`.

```js
function handCart(b, kit, { wood = 'spruce' } = {}) {
  const m = b.module([3, 2, 3])
  m.set(0, 0, 1, 'grindstone[face=wall,facing=west]') // wheel
  m.set(2, 0, 1, 'grindstone[face=wall,facing=east]')
  m.set(1, 0, 1, 'barrel[facing=up,open=false]')
  m.set(1, 1, 1, 'hay_block[axis=z]')
  m.set(1, 0, 0, `${wood}_fence`) // shaft
  m.set(1, 0, 2, kit.trapdoor(wood, 'south', { open: true })) // tailboard
  return m
}
```

#### 6.29 Column with base and capital
Pillar shaft on a block plinth; rings of 8 stairs (bottom = base, top = capital), corners computed.
Size `[3, h+2, 3]`.

```js
function column(b, kit, { shaft = 'quartz_pillar', mat = 'quartz', h = 4 } = {}) {
  const m = b.module([3, h + 2, 3])
  for (let y = 1; y <= h; y++) m.set(1, y, 1, `${shaft}[axis=y]`)
  m.set(1, 0, 1, kit.material(mat).block)
  m.set(1, h + 1, 1, kit.material(mat).block)
  const ring = [[1, 0, 'south'], [1, 2, 'north'], [0, 1, 'east'], [2, 1, 'west'], [0, 0, 'south'], [2, 0, 'south'], [0, 2, 'north'], [2, 2, 'north']]
  for (const [x, z, f] of ring) {
    m.set(x, 0, z, kit.stairs(mat, f, 'bottom')) // base flare, back against the shaft
    m.set(x, h + 1, z, kit.stairs(mat, f, 'top')) // capital
  }
  return m
}
```

#### 6.30 Balustrade
Plinth course, piers every 4 with slab caps, isolated wall balusters every other cell, slab handrail.
Size `[len, 4, 1]`.

```js
function balustrade(b, kit, { len = 9, pier = 'stone_bricks', baluster = 'stone_brick_wall', rail = 'smooth_stone' } = {}) {
  const m = b.module([len, 4, 1])
  for (let x = 0; x < len; x++) {
    m.set(x, 0, 0, pier) // plinth course
    if (x % 4 === 0 || x === len - 1) {
      m.set(x, 1, 0, pier) // pier
      m.set(x, 2, 0, pier)
      m.set(x, 3, 0, kit.slab(rail, 'bottom')) // pier cap
    } else {
      if (x % 2 === 0) m.set(x, 1, 0, baluster) // isolated wall = round-ish post
      m.set(x, 2, 0, kit.slab(rail, 'bottom')) // handrail
    }
  }
  return m
}
```

#### 6.31 Signpost
Fence post with wall signs as direction boards. Size `[3, 3, 1]`.

```js
function signpost(b, kit, { wood = 'spruce' } = {}) {
  const m = b.module([3, 3, 1])
  for (let y = 0; y < 3; y++) m.set(1, y, 0, `${wood}_fence`)
  m.set(0, 2, 0, `${wood}_wall_sign[facing=west,waterlogged=false]`) // arrow pointing west
  m.set(2, 1, 0, `${wood}_wall_sign[facing=east,waterlogged=false]`) // arrow pointing east
  return m
}
```

#### 6.32 Hedge planter
Rooted dirt boxed by trapdoors, clipped azalea hedge on top. Size `[len+2, 2, 3]`.

```js
function planter(b, kit, { len = 3, wood = 'spruce', leaves = 'azalea_leaves' } = {}) {
  const m = b.module([len + 2, 2, 3])
  for (let x = 1; x <= len; x++) {
    m.set(x, 0, 1, 'rooted_dirt')
    m.set(x, 1, 1, `${x % 2 ? 'flowering_azalea_leaves' : leaves}[distance=7,persistent=true,waterlogged=false]`) // clipped hedge
    m.set(x, 0, 0, kit.trapdoor(wood, 'north', { open: true }))
    m.set(x, 0, 2, kit.trapdoor(wood, 'south', { open: true }))
  }
  m.set(0, 0, 1, kit.trapdoor(wood, 'west', { open: true }))
  m.set(len + 1, 0, 1, kit.trapdoor(wood, 'east', { open: true }))
  return m
}
```

---

## 7. Preview caveats and common mistakes

Preview (render) differences that matter for details; the full list is in
[block-states.md §13](block-states.md#13-what-the-lodestone-preview-does-not-show-or-shows-differently-rm):

| Case | Preview | In-game |
| --- | --- | --- |
| hanging signs (`*_hanging_sign`, `*_wall_hanging_sign`) | untextured white board | wood texture and chains |
| `player_head` without profile NBT | plain white cube | default skin |
| `*_wall_head`, `*_wall_skull` | invisible | rendered |
| standing sign / banner / head `rotation` | east-west mirrored | vanilla table |
| candle / campfire flames, light levels | not simulated | lit |
| unsupported pieces (button on a fence, hanging lantern on nothing) | drawn | deleted on placement |

Common mistakes:

- Sill or corbel stairs facing **out** (`facing=F`): the step sticks out like a ramp. Use `facing=in`.
- Shutters with `facing=in`: the panel lands inside the window cell. Use `facing=out`.
- Flower-box end panels with the same facing as the front: they stand on the wrong edge. Ends use
  `cw(out)` (left) and `ccw(out)` (right).
- Full blocks as trim: a 1-block frame around a 1×2 window doubles its visual weight. Use stairs,
  slabs, trapdoors.
- Wall-mounted pieces on non-full faces (buttons on fences, ladders on glass panes): deleted in-game.
- Fence next to a wall expecting a join: they never join; put a full block between.
- Hanging lantern under a top slab or a closed top trapdoor: no centred support, deleted in-game.
- One material for everything: details disappear. Trim needs ΔE ≥ 10 from the wall.
- Identical modules everywhere with no variation, or random variation on every block.

---

## Sources

- Vanilla 1.21.1 block report and property values: `scripts/lib/data/block-states.json`.
- Material families and substitutes: `scripts/lib/data/materials.json` (`scripts/dev/gen-materials.mjs`).
- Orientation and preview behaviour: [block-states.md](block-states.md) (verified by render there).
- Support rules: vanilla 1.21 block classes (`canSurvive`: `ButtonBlock`/`FaceAttachedHorizontalDirectionalBlock`,
  `LanternBlock`, `CandleBlock`, `CarpetBlock`, `BasePressurePlateBlock`, `WallSignBlock`, `CeilingHangingSignBlock`,
  `LadderBlock`, `BellBlock`, `VineBlock`); Minecraft Wiki pages for the same blocks (minecraft.wiki/w/Trapdoor,
  /w/Carpet, /w/Lantern, /w/Hanging_Sign, /w/Bell, /w/Lightning_Rod, /w/Scaffolding).
- Verification builds for this chapter: a 31-module gallery, a four-facade rotation test house and a
  12-vignette sampler, each built with `run-build.mjs` (0 problems) and rendered close-up with
  `render.mjs --clip`.
