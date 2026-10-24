# Community lessons: what skilled builders do, measured

71 community builds (houses, manors, towers, East-Asian builds, castles, churches) were converted,
rendered and fingerprinted block by block, then compared with Mojang's 152 village houses. This
chapter keeps the measured lessons, the numbers and the cross-sections; `benchmarks.md` has the
statistics of the wider 1,212-build corpus.

## 0. How to read this

- **Sections:** §1 is the short version. §2 has the numbers, §3 the cross-build patterns, §4 the lessons for AI builders (numbered and actionable), §5 the comparison with Mojang's village houses, §6 ASCII cross-sections of good houses and §7 the metric definitions.
- **Coordinates** are structure-local `[x,y,z]` in the converted `.nbt` (y up, +x east, +z south). Block states are written as in the files, e.g. `spruce_stairs[facing=north,half=top]`.
- **Metrics are heuristics**, computed by fingerprinting scripts during the study. Their exact definitions are in §7. Treat them as order-of-magnitude evidence; they are not exact architecture.
  - "Roles" are inferred from height, exposure and category.
  - "Floor-to-floor" is detected from walkable surfaces that have a ceiling above them.
  - "Wall thickness" is the solid run a horizontal ray crosses before reaching enclosed air.
- **Biases:**
  - Datapack structures (ATi, Towns and Towers, Sengoku Jidai, 1111w, Grim Kingdoms) are worldgen pieces. Their jigsaw blocks were replaced by their `final_state`, and air and `structure_void` were dropped.
  - minecraft-schematics.com uploads often include a terrain plug. That is why `terrain %` is reported separately and most metrics exclude terrain.
  - Four builds are legacy MCEdit/Schematica files. They were converted with the converter's 1.12 id table (100% coverage), so their states are reconstructions.
- **Scope:** I judged quality visually from the renders. "Good" here means the build reads well at the default isometric and elevation views an AI agent will also use.

---

## 1. The short version

The ten findings with the strongest evidence:

1. **Real houses are bigger and about twice as dense as Mojang's.** The median community house covers 342 footprint columns with 6.6 building blocks per column, 57 block ids and about 14 windows. The median Mojang village house covers 56 columns with 3.0 blocks per column, 12 ids and 1 window. The extra density is detail layers on a shell of similar thickness (frames, trim, partial blocks, props), not thicker walls.
2. **Upside-down stairs are the signature move.** In community builds 20-88% of all stairs are `half=top` (median 39%); in Mojang houses the median is 0%. They form eave fascias, corbels, jetty brackets, window lintels, cornices and arches. The most common single idiom is the eave fold: a `half=bottom` roof stair with a `half=top` stair facing the opposite way directly below it.
3. **Depth comes from layers, not thick walls.** Walls are 1-2 blocks thick in 21 of the 22 houses where thickness could be measured. Relief comes from frames standing proud of the infill, jetties (upper storeys cantilevered 1-2 blocks), sills and lintels, and shutters. In the wall band, 22-57% of neighbouring horizontal rays differ by 1-2 blocks (median 31%; Mojang median 17%).
4. **Roofs are the identity.** Pitches are 45° (stair per block) or steep 2:1 (two blocks up per block in). There is always a 1-block eave and a contrasting edge, such as a stone verge, a dark rim or a crenellated ridge. Roofs carry 35-60% of the building height (measured 32-61% on 8 houses with clean eaves; Mojang plains houses 29-43%), and cross-gables, dormers and multiple heights break up every large roof.
5. **Material changes by storey.** 16 of 25 houses put a stone-family base band on the bottom 1-2 rows (cobble, stone bricks, cobbled deepslate, mossy variants). About half switch to timber, plaster or planks above the ground floor, and roof material is a third family.
6. **Every window gets a frame.** 75% of community windows have a lintel (median per build), about 30% a sill and up to 70% open-trapdoor shutters. Windows are small (1x2 and 1x3 dominate) and often recessed 1 block. Mojang windows are bare panes.
7. **Texture is controlled noise within one family.** A wall typically mixes 4-7 blocks, each above 3% (median 5), drawn from one family: e.g. `stone_bricks` 51% + `cracked_stone_bricks` 14% + `mossy_stone_bricks` 14% on the wizard tower. Builds that use flat concrete or saturated single colours are the weakest in the set.
8. **Trapdoors and walls/fences are the second texture layer.** Trapdoors are 2-15% of all blocks: 51% open (shutters, panels, post collars), 31% closed `half=top` (soffits, roof battens, shelf lips) and 18% closed bottom (ledges, steps). Wall blocks are used as thin pilasters, mullions and crenellations (Elaine&Sparky's Tudor complex uses 1,434 `stone_brick_wall`).
9. **Lanterns light the scene, and hang.** Light density is 10-30 sources per 1,000 blocks in houses. Lanterns are 43% of sources and a third of all lights hang from chains or under eaves; campfires (31%) double as chimney smoke. Torches are only 9%.
10. **The best builds tell a story at the edges.** Common edge props are piers and finger docks, a winch with chain and cauldron, a shop counter, planters, overgrowth, flags and banners, hay and wheat, and terraced plinths with steps. The building occupies only part of the footprint; the rest is setting.

---

## 2. Numbers

### 2.1 Community houses vs Mojang village houses (medians; min/median/max where useful)

| metric | Mojang village houses (n=152) | Community houses (n=25) |
|---|---|---|
| building blocks (excl. terrain/plants) | 1 / 166 / 631 | 611 / 2,125 / 34,163 |
| footprint columns / blocks per column (median) | 56 / 3.0 | 342 / 6.6 |
| distinct block ids | 5 / 12 / 21 | 13 / 57 / 220 |
| partial blocks (all) | 36.5% | 43.9% |
| partial share of exterior surface | 43.8% | 51.7% |
| stairs that are upside-down (`half=top`) | **0%** (max 62%) | **39%** (13-74%) |
| trapdoors | ~0% (taiga 9%) | 4% (0-15%) |
| logs | 0-35% by biome | 12.5% (0-46%) |
| windows per building | 1 (0-12) | 14 (0-323) |
| windows with lintel / sill | ~0 / ~3% | 75% / 29% |
| wall materials above 3% each | 2 | 5 (2-12) |
| facade relief (neighbour rays differing by 1-2) | 17% | 31% (16-57%) |
| vertical log posts at least 3 tall / horizontal beams at least 3 long | 0-7 / 0-8 | 29 / 26 |
| light sources per 1,000 blocks | 15 (mostly torches) | 12 (lanterns, campfires) |
| eave overhang (mode) | 1 | 1 (23 of 24 measurable houses) |
| wall thickness (mode) | 1 | 1-2 |
| floor-to-floor (mode) | single storey | 5 (range 3-9) |
| roof slope (mode) | 1 (45°) | 1 in 11 of 25, 2:1 in 9, 0.5 in 5 (Asian, living roofs, decks) |

## 3. Cross-build patterns

### 3.1 The four detail layers every good house has

Mojang's village house is a massing skeleton. Every strong community house adds the same four layers on top of it:

1. **Structure made visible.** A frame stands 0-1 block proud of the infill: log posts every 3-5 blocks, floor beams that run past the corners, a jetty, brackets, and quoins on stone. Wall thickness stays 1-2.
2. **Openings dressed.** Each opening gets a lintel (slab, upside-down stair or beam), usually a sill, often shutters, and a recess. Doors sit recessed under an overhang with lanterns on either side.
3. **Roof edge defined.** The eave is folded (stair over upside-down stair), the gable has a contrasting verge, and the ridge carries a crest, a beam or finials. There is a 1-block overhang.
4. **Setting.** A plinth or podium, steps, planting, props and lights.

The builds missing a layer are the weakest:
- s4j-green-cottage has none of them.
- mineflayer-21981 lacks layers 1 and 4.
- s4j-tower lacks the diminishing proportion that layer 1 provides for towers.

### 3.2 Two successful palette strategies

| strategy | examples | how it avoids flatness |
|---|---|---|
| **Few blocks, strict grammar** (15-25 ids) | Elaine&Sparky Tudor complex (22), Elaine&Sparky clock tower (15), viking-longhall (48, but 3 dominate), prismarine-viking-house1 (14) | Relief comes from geometry: posts, mullions of wall blocks, brackets, repeated gables. Each block has one job. |
| **Many blocks, layered noise** (100-230 ids) | ATi tavern (128), ATi marble chateau (204), ATi gnome hut (146), BiggyDiggy7 manor (220), Sengoku Jidai warlord castle (233) | Texture comes from mixing 5-12 variants per surface plus trapdoor, fence-gate and sign overlays. |

Both work. The failure mode is the middle path with neither strategy: few blocks and flat geometry.

### 3.3 Recurring idioms (with counts across the corpus)

- **Eave fold:** a `*_stairs[half=bottom]` facing into the roof with a `*_stairs[half=top]` facing out directly below it. It appears in nearly every build with stair roofs. Examples: Tudor complex [47,4,22], timber house [6,4,0], Tudor tower [4,2,6], palace garden [8,17,19] (under a slab).
- **Corbel row:** `*_stairs[half=top]` under a projecting course: under jetties, tower parapets and balconies. 1,738 in the Tudor complex and 3,062 in the warlord castle.
- **Lintel beam:** a horizontal log (`axis=x/z`) or `*_slab[type=top]` directly above windows. 75% of windows have one.
- **Shutters:** open trapdoors on either side of a window (BiggyDiggy7 67%, CzornyKruk 60%, ATi tavern 64%).
- **Post collars:** trapdoors wrapped around log posts, capped with a slab (dark timber house porch).
- **Contrasting verge:** stone on a wood roof (timber house, Napoli), dark rim on stone (Rendog), dark oak on a moss roof (GeminiTay).
- **Projecting ridge beam:** a log running 1-2 past the gable (prismarine-smallhouse1); crossed rafter "horns" (Viking).
- **Bell-cast eave:** a slab skirt at 0.5 pitch, then steep (Tudor tower, s4j-mansion, Japanese roofs inverted into a concave sweep).
- **Hanging lanterns** under eaves and jetties: 531 of 1,502 house lights hang.
- **Terraced base:** stepped plinths and steps on several sides (pagoda temple, dojo, pagoda house, palace garden), or a terraced hill plug (red-roof castle, Tudor complex).
- **Thin vertical members:** wall blocks and fences as pilasters, mullions and tracery (Tudor complex 1,434 walls; clock tower 4,504 walls and fences, 30% of its blocks).
- **Repurposed textures:** `stripped_birch_wood` as marble, `mushroom_stem` as plaster, `mud_bricks` and `packed_mud` as terracotta tile, `iron_block` + `white_wool` as whitewash, `gray_carpet` on slab floors, `dried_kelp_block` as dark thatch or timber (medieval-house-terrain 8% of the wall).

### 3.4 Proportions observed

- **Floor-to-floor:** 5 typical (4-6) for houses; 7-9 for halls, taverns and castles; 3 for half-storeys and attics. Ground floors are often 1 taller than upper floors.
- **Roof height** (eave to top) as a share of building height: timber house 50%, Napoli 43%, Rendog 61%, GeminiTay 58%, Tudor tower 46%, CzornyKruk pagoda house 56%, Viking longhall 35%, m4rius_l tower house 32%. Mojang plains houses are 29-43%. Asian roofs are also wider: eave spread is about 1.3-1.6x the wall footprint on the CzornyKruk pagoda house.
- **Eave overhang:** 1 (23 of 24 measurable houses). Larger roofs use 2; Asian roofs reach 2-3 with a soffit underneath.
- **Windows:** 1x2 and 1x3 dominate; 3x3 on manors and chateau main floors. Two-wide strips appear on ground floors.
- **Tower shafts:** 5-9 wide. Jettied lantern storeys project 1-2. Spires are 1.5-3x the shaft width in height.
- **Plot coverage:** 20-60% of the plot is building; the rest is setting. Terrain is 15-60% of all blocks in schematic uploads.

### 3.5 What separates the best from the middle

Comparing the strongest builds (Tudor complex, Napoli, Rendog, GeminiTay shop, CzornyKruk pagoda house, 1111w pagoda, Sengoku Jidai palace, Tudor tower, BiggyDiggy7) with the middle (mineflayer-21981, s4j-tower, s4j-green-cottage, star fortress):

- **The best have one clear silhouette idea:** a curved hat roof, a jettied lantern storey, a tiered pagoda, stacked stave roofs, or a frame of a thick verge. The middle ones are boxes with roofs.
- **The best define every edge:** roof edges, corners (quoins or posts), floor lines (beams or string courses) and the ground line (plinth). The middle leave edges as bare block corners.
- **The best keep saturated colour to one accent:** copper cap, red tower roofs, crimson posts. The weak use saturated colour as the main material (green concrete, pink concrete ground, teal prismarine everything).
- **The best show age and use:** moss near the ground, cracked variants, vines, cobwebs, props, lit interiors.

---

## 4. Lessons for AI builders

These are numbered rules with numeric targets. "Do" items are directly implementable in recipes.

**Massing and proportion**

1. **Stack the house in bands.**
   - Plinth: 1-2 rows of rough stone (cobble, cobbled deepslate, or stone bricks with 10-20% mossy/cracked). Make it 1 wider than the wall if you can.
   - Ground storey: 4-5 tall, floor-to-floor 5.
   - Upper storey(s): 4-5 tall, jettied 1-2 out.
   - Roof: 35-60% of the total height.
2. **Never ship a single box.** Add at least one cross-gable, wing, porch, tower or chimney, and use 2-3 different roof heights. Big builds need 3+ spire or tower heights for the skyline.
3. **Diminish repeated tiers.** Pagodas and stacked roofs shrink about 2 blocks per side per tier (1111w); equal tiers read as a stack (s4j-tower). Towers taper or batter at the base and corbel out by 1 at the top.
4. **Bend the plan when it is long.** Long halls become boat-shaped (wider in the middle), and complexes wrap a courtyard. Use L-plans and octagonal or round towers to break rectangles.

**Roofs**

5. **Choose a pitch deliberately.**
   - 45° (one stair per block) is the default.
   - 2:1 (rise 2 per 1 in) suits medieval and fantasy drama; build it from full blocks plus stairs, as in the Rendog roof (§6).
   - 0.5 (slab per block) only for East Asian hip roofs with upturned corners, or for bell-cast skirts.
6. **Overhang the eave by exactly 1 (2 on big roofs) and fold it.** Place a `half=top` stair facing outward directly under the outermost roof stair, so the eave reads as a thick beam from below.
7. **Outline every roof.** Use a gable verge in a contrasting material (stone-brick stairs on a wood roof, a thick cobble band, or a dark rim around a light roof). Treat the ridge too: a `*_wall` crest, a log ridge beam that projects 1-2 past the gable, or finials (rod, fence, or wall with a candle) on peaks.
8. **Texture big roofs.** Do one of the following:
   - speckle 10-20% of a second block of similar value in patches;
   - make a gradient by height (light to dark or warm to cool);
   - lay battens of closed `half=top` trapdoors every 3-4 rows.
   Never leave 200+ identical stairs untouched.
9. **Use bell-cast or kicked eaves on towers and chateaux.** Start with 1-2 rows of slabs at low pitch, then go steep. On Japanese roofs invert this into a concave sweep: steep at the ridge, flattening and turning up at the eave.

**Walls and depth**

10. **Keep walls 1 thick (2 for stone) and build depth in front of them.** Frame members sit 0-1 block proud of the infill and windows sit 1 back. Target 25-45% of neighbouring facade rays differing by 1-2 blocks (fingerprint "relief").
11. **Use a timber-frame grammar.**
    - Posts: `*_log[axis=y]` every 3-5 blocks and at every corner.
    - Beams: `*_log[axis=x|z]` at each floor line, running 1-2 past the corners.
    - Braces: diagonals from `*_stairs[half=top]` under the beams.
12. **Jetty upper storeys 1-2 blocks** over the floor beams, with an upside-down stair bracket and a hanging lantern under each post.
13. **Change material at storey lines.** Use a stone base band, timber, plaster or brick above, and a third family on the roof. Mark floor lines with a beam or string course in an accent (yellow sandstone or gold on the white chateau; dark logs on plaster).
14. **Texture walls within one family.** One primary block at 50-70%, plus 2-4 variants at 5-15% each (e.g. `stone_bricks` / `cracked_stone_bricks` / `mossy_stone_bricks` / `andesite`). Put mossy and cracked low and at corners.
15. **Add thin vertical members.** Wall blocks and fences work as pilasters, mullions and railings in front of flat infill. One wall block every 2-3 blocks turns a flat wall into a colonnade.
16. **Use trapdoors as the all-purpose detail at 3-10% of blocks.** Open ones beside windows are shutters and around posts are collars. Closed `half=top` ones under eaves are soffits and on roofs are battens. Closed bottom ones make ledges, steps and table tops.

**Openings**

17. **Give every window a lintel and most a sill.**
    - Size: 1x2 or 1x3 (3x3 on grand floors).
    - Recess: 1 block.
    - Lintel: a log beam, `*_slab[type=top]` or `*_stairs[half=top]`.
    - Sill: `*_slab[type=top]`, an open trapdoor or a stair.
    - Shutters: on about half of them.
18. **Recess doors under a porch or overhang.** Put lanterns on both sides and 1-3 steps up from the plinth. Main entries of large buildings get double doors.

**Detail density and palette**

19. **Aim for community-level density.**
    - 45-60% of the exterior surface in partial blocks.
    - At least 25% of stairs `half=top`.
    - 3-10% trapdoors.
    - 40-100 distinct ids for a house, or 15-25 if you commit to a strict structural grammar (lesson 15 and the Tudor complex).
20. **Pick blocks for texture and value, not for their names.**
    - Marble: `stripped_birch_wood`.
    - Plaster: `mushroom_stem`, `white_wool`, calcite.
    - Tile: `mud_bricks`/`packed_mud`.
    - Thatch or timber: `dried_kelp_block`.
    - Whitewash: `iron_block` + `white_wool`.
21. **Avoid concrete and saturated colour on large surfaces.** Use a saturated colour once (Rendog's copper cap), as a family mix (tavern teal), or as a single accent family (red roofs on grey stone).
22. **Make the scheme 2-3 colours with clear value contrast.** Light walls with a dark frame and a dark roof (Tudor), or a dark field with light ridges (dojo). Contrast drives readability at render distance.

**Lighting**

23. **Hang lanterns, don't spam torches.**
    - Density: 10-30 lights per 1,000 blocks.
    - Mostly lanterns, about a third hanging: from chains under eaves, under every jetty post, and from roof tips on Asian roofs.
    - Campfires on chimneys for smoke.
    - Soul lanterns for cold or dark palettes.

**Setting and story**

24. **Put the building on something:** a plinth platform with steps on 1-4 sides, a terraced hill, a podium with a retaining wall, or a pier.
25. **Give 30-60% of the plot to setting.**
    - Paths: a mix of coarse dirt, podzol, gravel and path blocks.
    - Planting: flower beds inside low wall or fence borders, planters, a tree or bamboo stand.
    - Water where it makes sense.
26. **Add 3-5 story props** such as a winch with chain and cauldron, a shop counter, barrels, hay bales, flags and banners, carts, docks or a well. Props are about 20% of what makes GeminiTay's shop read.
27. **Age the building.** Vines or leaves on 10-30% of one or two facades, moss blocks and mossy variants near the ground, cobwebs in corners. Overgrowth is in 6 of the top 10 builds.

**Composition at scale**

28. **Shape the skyline.** Use towers and spires at 3+ heights with finials; give every peak something (a rod, spike, flag or lantern).
29. **Repeat a bay with variation.** Use post + window + post bays along long facades and repeated gables along a roofline (Tudor complex). Vary one element per repeat, such as balcony, dormer or planter.
30. **Articulate big flat masses every 4-6 blocks.** Use buttresses, pilasters, string courses at floor lines, corbel tables and crenellations. Flat 10+ block walls are the main weakness of the large castle builds.

**Process**

31. **Measure, then render.** Run `node scripts/inspect.mjs FILE --score --style NAME` on your output and compare with the target table below. Then render, including 2 close-ups (entrance and eave): flatness is invisible from the iso view but obvious at eye level.
32. **Iterate on edges first.** If a render looks flat, the fix is almost always at the edges: roof edge, corners, floor lines, window frames, ground line. Adding volume rarely helps.

**Numeric targets for a medieval or fantasy house** (from the community distribution; "weak" is the bottom of the corpus or Mojang):

| metric | weak | target (community median) | strong |
|---|---|---|---|
| distinct ids | <15 (with flat geometry) | 40-60 | 80-150 |
| exterior partial share | <30% | 45-55% | 60-74% |
| stairs `half=top` | 0-10% | 30-40% | 60-88% |
| trapdoors | 0% | 3-6% | 10-15% |
| windows with lintel | 0% | 75% | 90-100% |
| facade relief (1-2 block steps) | <15% | 30% | 45-57% |
| wall materials above 3% | 1-2 | 4-6 | 7-12 |
| lights per 1,000 blocks (lanterns) | 0 or torches only | 12 | 20-30 |
| eave overhang | 0 | 1 | 1-2, folded |
| floor-to-floor | 3 or 8+ | 5 | 5-6 (+1 on the ground floor) |

---

## 5. Comparison with Mojang's village houses

Mojang's 152 village houses (desert, plains, savanna, snowy, taiga) are deliberately low-detail worldgen pieces. Median: 166 blocks, 12 ids, 1 window, 0 upside-down stairs, 2 wall materials, 17% relief.

**What Mojang and the community agree on (so keep it):**
- 1-block eave overhang.
- 45° stair roofs.
- 1-block walls.
- Log corner posts on a cobblestone base (plains, taiga).
- Biome-specific palettes of 3-5 blocks per biome.
- Lights inside.

**What the community adds:**

| layer | Mojang plains_medium_house_1 | community equivalent |
|---|---|---|
| frame | log corners only | posts every 3-5, floor beams through corners, jetty, brackets |
| windows | bare 1-wide panes | 1x2/1x3, recessed, lintel, sill, shutters |
| roof edge | plain stair end | folded eave, verge, ridge crest or beam, finials |
| wall texture | one plank or cobble type | 4-7 variants in one family |
| base | dirt foundation | stone plinth, steps, terraced platform |
| setting | none (village paths) | gardens, props, planting, water |
| light | 1-2 torches | 10-30 lanterns per 1,000 blocks, hanging |

**Biome notes from the fingerprints:**
- Taiga houses are the most "community-like" Mojang set: 68% of windows have shutters, 9% trapdoors and 35% logs.
- Desert houses are the flattest: 9% relief, 16% slabs, no windows.
- Savanna has the most relief (34%), from acacia frames and fences.

**Upgrade path from a Mojang house to community level**, using plains_medium_house_1 (13x8x11) as the example:
1. Raise the walls to 5 tall and add a 1-row cobble or mossy-cobble plinth.
2. Make the upper half a plank storey jettied 1 out on `oak_log[axis=x/z]` beams that run 1 past the corners.
3. Replace the 45° roof with a 2:1 roof. Add folded eaves (`oak_stairs[half=top]` below the eave row), a `cobblestone_stairs` verge on the gables and a ridge beam projecting 1.
4. Change each window to 1x2, recessed 1, with an `oak_slab[type=top]` lintel, an `oak_trapdoor[open=true]` shutter pair and a `spruce_slab[type=top]` sill.
5. Add 6-10 hanging lanterns, a flower bed in a cobblestone-wall border, a barrel and a hay bale by the door.

Expected fingerprint after these steps: roughly 600-900 blocks, 25-35 ids, 45%+ exterior partials and 30%+ upside-down stairs.

---

## 6. Cross-sections of good houses

Legend:
- Solids: `#` full block, `P` planks, `L` vertical log, `-` horizontal log, `G` glass, `:` terrain/natural stone.
- Stairs: `/` and `\` are bottom stairs rising to the right or left; `>` and `<` are upside-down stairs (tall side right or left); `=` is a stair facing toward or away from the viewer.
- Slabs: `_` bottom slab, `^` top slab.
- Thin and decorative blocks: `|` pane or bars, `T` trapdoor, `F` fence or gate, `W` wall block, `D` door, `,` carpet, `~` plant, `*` light, `.` air.

```
### medieval-timber-house-g10wer, section z=3 (front wall; viewed from the south)
slice z=3 of 22x22x21; horizontal x 0..21 (west -> east)
     0123456789012345678901
  13 .........:............
  12 ..=======#=======\....
  11 ..#PPPPPPPPPPPP--P....
  10 ..#LPPPPPPPPPPPPPL\...
   9 ...L.............L....
   8 ...L....._.......L....
   7 ...L..../P\......L....
   6 .#-L-------------L-#..
   5 ...L../#...#\....L....
   4 ...L..<#...#>....L....
   3 ...L...#...#.....L....
   2 ...L...#...#.....L....
   1 ...L...#T=T#.....L....
   0 :::##:::P#P:#:::##::::

### medieval-house-napoli-rukatsu_san, section z=11 (across the house)
slice z=11 of 13x24x23; horizontal x 0..12 (west -> east)
     0123456789012
  20 ......_......
  19 ...../.\.....
  18 ..../...\....
  17 .../.....\...
  16 ...P.....P...
  15 ...P.....P...
  14 ../.......\..
  13 ._P...*...P_.
  12 #PL-------LP#
  11 ..LPPLPLPPL..
  10 ..LPPLDLPPL..
   9 ..LPPLDLPPL..
   8 #-L-------L-#
   7 .^#<.>LPPP#<.
   6 ..D...LPDP#..
   5 ..D...LPDP#\.
   4 ::PPPPPPPP:::
   3 :::::::::::::

### medieval-house-hermitcraft-s8-rendog, section z=10
slice z=10 of 16x23x20; horizontal x 0..15 (west -> east)
     0123456789012345
  18 ........._=P=_..
  17 ..........W.W...
  16 .....=....W.W...
  15 .....#....W|W...
  14 ....#.=...#=#...
  13 ....#.#...#|#...
  12 ...#...\..#=#...
  11 ...#...:..#|#...
  10 ../.....#.#.#...
   9 ./#..*.*#.#.#...
   8 ._#<^^^^^^###_..
   7 ..#.........#...
   6 ..#.........#...
   5 ..#.........#...
   4 ..#...##*..*#...
   3 .~>:::::::::<...
   2 |~~W..*..*.W.~~W
   1 ::::::::::::::::

### prismarine-smallhouse1, section z=10
slice z=10 of 21x28x20; horizontal x 0..20 (west -> east)
     012345678901234567890
  26 ..........=..........
  25 ..........P..........
  24 ........./P\.........
  23 .........P*P.........
  22 ....====/<T>\====....
  21 ....PPPP<...>PPPP....
  20 ....PPPP.....PPPP....
  19 ......|*.....*|......
  18 ......G.......|......
  17 ......D.......|......
  16 ....F.D.......|.F....
  15 ....>P<^^^^^^^>P<....
  14 ..../\........./\....
  13 ....P\........./P....
  12 .../P\........./P\...
  11 ...PP----...----PP...
  10 ../>-<.T.._^.T.>-<\..
   9 ..^.L....^*....#L.^..
   8 ....L\.........#L....
   7 ..._-#W........#-_...
   6 .../-----._^-----\...
   5 ...>-#<..^*...>#-<...
   4 ..../-#......._-\....
   3 ....FL#.......=LF....
   2 ....FL#..._^..=LF....
   1 .W~.>-=..^....=-<.~W.
   0 .>#################<.
```

## 7. Metric definitions

- **partial %**: the share of building blocks (excluding terrain and plants) in these categories: stairs, slabs, walls, fences and gates, trapdoors, doors, panes and bars, buttons and plates, carpets, chains, signs and banners, lights, and furniture blocks. **surface partial %** restricts this to blocks adjacent to exterior air.
- **Exterior air:** a 3D flood fill from the bounding-box shell through air and non-blocking blocks (fences, plants, lights, carpets, signs and similar).
- **Wall thickness:** at 1..60% of the building height, horizontal rays from exterior air count the blocking run before reaching non-exterior air. The modal run is reported.
- **Floors:** solid cells with 2 air cells above and a blocking cell within 10 above (a ceiling). y-levels with at least 25% of the maximum count are floors (merged if closer than 3 apart). Storey heights are the differences between them.
- **Roof slope:** the height map of the topmost blocks (bottom slab = +0.5). Differences between neighbouring roof columns are counted, excluding 0; the mode is reported.
- **Eave overhang:** roof columns with 2 air or exterior cells under the top block, measured inward from the roof edge.
- **Facade relief:** in the wall band (1..60% of height), horizontal rays from each of the four sides record the depth of the first hit. The report gives the share of neighbouring rays that differ by 1-2 blocks (relief) or by 3 or more (massing).
- **Windows:** connected glass/pane components of at most 40 blocks.
  - lintel: a stair (`half=top`), slab, log or trapdoor directly above the top row or 1 in front of it;
  - sill: a stair, slab, trapdoor, wall or fence 1 in front of the bottom row and 1 below;
  - shutters: open trapdoors just beyond the window ends;
  - recessed: a blocking cell beside the window projects in front of the glass.
- **Corbels:** `*_stairs[half=top]` with a roof-ish block above and air below.
- **Posts and beams:** runs of `axis=y` logs at least 3 tall, and `axis=x` or `axis=z` runs at least 3 long.
- **Lights:** torches, lanterns, sea lanterns, glowstone, froglights, end rods, candles, campfires, redstone lamps and jack-o'-lanterns. Hanging = `hanging=true`.
- **Known blind spots:**
  - Roles are heuristic (e.g. carpets on floors may be labelled roof texture).
  - Floor detection fails on open or unroofed builds.
  - The chimney detector undercounts.
  - Large castles mix many buildings, so their per-build modes describe the dominant buildings only.
