# How Mojang builds

This chapter is the design language Mojang's own builders use, extracted from the 1,180 structure
templates in the Minecraft 1.21.1 jar (`data/minecraft/structure/**`) and from the worldgen
processor lists that age those templates. Every number comes from scripts run over those files.
Evidence pointers look like `plains_library_1 (3,5,0)`: template file, then local x,y,z. y=0 is the
template's bottom layer.

Use this chapter three ways:
- **Copy** the palettes in section 5 verbatim, with their roles and shares.
- **Apply** the 60 lessons in section 3. They are the rules the vanilla builds actually follow.
- **Start** from the verified kit recipes in sections 4, 6, 7 and 9. They reproduce a plains house,
  a taiga house, a desert house, a trial-chamber wall and an ancient-city wall, and each one was
  built and rendered with 0 problems.

Related chapters:
- [materials.md](materials.md): which stairs, slabs and walls exist for each material.
- [block-colors.md](block-colors.md): block values and colour ladders.
- [block-states.md](block-states.md): orientation rules for stairs, logs, trapdoors, doors and more.

## 1. Two traps (and a reminder) when you read vanilla structures

1. **Stored stair `shape` is unreliable.** Shipwreck templates store `shape=outer_right` on every
   stair, and the game recomputes shapes from the neighbours when it places a template. Trust
   `facing` and `half` only. The kit's `finish()` computes shapes for you, so never hand-set
   `shape`.
2. **Jigsaw blocks are not air.** At placement each jigsaw block becomes its `final_state`:
   - In villages, the jigsaw in front of a door usually becomes a **doorstep stair**.
   - In trial chambers and the ancient city, it becomes wall material.

   If you analyse vanilla `.nbt` files yourself, replace every `minecraft:jigsaw` with the block
   in its `final_state` NBT before counting or rendering.

3. **Templates are the clean design.** Worldgen processors then age them: cobblestone gets mossy,
   bricks crack, bulbs dim, blocks go missing. Copy both the design and the aging (section 8).

## 2. Fingerprints

Shares exclude terrain, crops, water and snow layers.
- "Partial" means stairs, slabs, walls, fences and trapdoors.
- "Air/light" is covered interior air per light of level 10 or more. Bigger means darker.
- "Light NN" is the median distance from each light source to its nearest neighbour.

| Family | Ids making 80% | Effective palette | Partial % | Lights /100 blocks | Air/light | Light NN | Upside-down stairs % | Vertical logs % | Wall thick | Clear height |
|---|---|---|---|---|---|---|---|---|---|---|
| Plains houses | 4 | 8.2 | 32 | 2.2 | 19 | 2 | 13 | 70 | 1 | 3-4 |
| Desert houses | 4 | 6.6 | 24 | 2.2 | 15 | 2 | 6 | – | 1 | 2-3 |
| Savanna houses | 6 | 9.8 | 38 | 2.0 | 33 | 2 | **0** | 76 | 1 | 4 |
| Snowy houses | 4 | 7.5 | 16 | 1.9 | 17 | 3 | 3 | 85 | 1 | 4 |
| Taiga houses | 4 | 6.3 | 12 | 2.7 | 16 | 2 | 25 | **12** | 1 | 3 |
| Pillager outpost | 6 | 9.0 | 17 | 0.3 | 397 | 10 | 59 | 61 | 1 | 3-4 |
| Woodland mansion | 11 | 13.0 | 13 | 0.3 | 159 | 1 | 48 | 42 (exterior 0) | 1 | 5 |
| Trial chambers | **3** | 3.5 | 0.6 | 0.65 | 124 | 3-5 (grid) | **0** | – | **2** | 3 / 5 / 10 |
| Ancient city | 5 | 8.8 | 7 | 0.85 | 71 | **1** (clusters) | 31 | 68 | 1 | 3 |
| End city | 3 | 4.4 | 20 | 1.3 | 23 | 9 | **53** | – | 1 | 3 |
| Bastion | **2** | **2.8** | 0.7 | 0.15 | 222 | 5 | 4 | – | 1-2 | 2-3 |
| Shipwreck | 3 | 5.3 | 42 | 0 | – | – | 58 | 73 | 1 | 2-3 |
| Underwater ruin | 5 | 7.7 | 1 | 1.2 | 111 | – | 52 | – | 1 | 4 |

What the table says:
- **Every family is palette-disciplined.** 2-6 ids make up 80% of the blocks, and the effective
  palette size is 3-10. Variety comes from block *states* (axis, half, facing) and from small
  accents.
- **Houses get detail from partials; dungeons get it from material changes.** House partials are
  12-38% of blocks; dungeon partials are about 1%. Dungeon walls get detail from bands of different
  full blocks.
- **Walls are 1 block thick everywhere except trial chambers.** Depth comes from things that stick
  out: posts, jetties, corbels, overhangs.
- **Houses are bright, dungeons are dark on purpose.** Houses have one light per 15-33 interior air
  blocks; dungeons have one per 70-400.
- **Each family lights in its own way.** Trial chambers use a strict grid, the ancient city uses
  clusters, the end city uses sparse posts.
- **Floor-to-floor height** in multi-storey houses: 4 for plains, desert and taiga; 5 for savanna
  and snowy. Small desert rooms are only 2 blocks clear.

## 3. The 60 lessons

Each line gives the rule, then the evidence.
- "stat" means an aggregate over the whole family.
- ★ marks the 15 most valuable lessons.

### Palette and material

1. ★ **3-6 ids make 80% of the build; variety comes from states and accents.** Stat: 80% coverage
   takes plains 4 ids, taiga 4, trial chambers 3, end city 3, bastion 2.
2. ★ **One material per surface orientation.** Trial chamber floors are 62% oxidized copper (97% of
   it is top-exposed). Ceilings are 88% polished tuff (98% bottom-exposed). Walls are tuff bricks
   with copper and chiseled bands. End stone bricks in the end city are 100% side-exposed: never a
   floor.
3. **Put complementary colours on a neutral base, then lock them.** Orange `waxed_copper_block` goes
   on walls and teal `waxed_oxidized_copper` on floors, over grey-green tuff. All of it is waxed so
   it never ages.
4. **Keep the warm accent to 5-15% of the wall surface** (taste). Plains white terracotta is 8% of
   the exterior wall surface; savanna terracotta 25%; bastion gold under 0.2%.
5. **Save one rare block for the focal piece.** `reinforced_deepslate` appears only in the 22x8
   portal frame of `city_center_*`. `obsidian` appears only on frames.
6. **Use the biome's own wood for every door and wooden accent.** Doors are 100% oak (plains),
   jungle (desert), acacia (savanna) and spruce (snowy, taiga). The desert, which has no native tree,
   uses jungle for doors, buttons and trapdoors.
7. **Use two-tone wood: dark for the frame, light for floors.** Outpost floors are 60% birch inside
   dark-oak walls. Mansion floors are 58% birch.

### Roofs

8. ★ **Build the roof from bottom-half stairs facing up-slope, each backed by a full block.**
   Stat: 89% of plains and 96% of savanna roof stairs face the building centre. The block on the
   high side is planks 42% of the time (plains) and 82% (savanna).
9. ★ **Overhang exactly 1 block on eaves and rakes, and start the eave beside the top wall
   course.** Stat: 100 of 112 plains sides and 92 of 100 savanna sides overhang exactly 1. The eave
   sits at door_y+2 or +3.
10. ★ **Put upside-down stairs under the overhanging rake stairs, facing down-slope (opposite to the
    stair above).** The gable edge then reads as a solid, smooth bargeboard. Stat: in villages, 233 such
    pairs have opposite facings, 3 the same facing and 9 a perpendicular one (at corners). Example: `plains_library_1` (3,5,0), (4,6,0), (5,7,0).
    The eave-most stair stays bare. See section 4.
11. **Cap the ridge to fit the span.** Odd span: a full-block ridge row. Even span: two stairs back
    to back. Examples: `plains_library_1` y=8 `stair|plank|stair`; `plains_medium_house_1` y=7.
12. **Hip small square houses with concentric stair rings.** Inset each ring by 1 and cap with one
    block. Example: `plains_small_house_1` rings at y=4/5/6 and a plank cap at (3,6,3). Savanna stops
    after 2 rings and fills the middle with `acacia_slab[type=top]`.
13. **Use inner/outer stair shapes only at hips and valleys.** 95% of plains roof stairs are
    straight. Valley: `plains_medium_house_1` (7,4,10).
14. **Mark the gable triangle.** Use a horizontal log collar in the top 3-wide row
    (`plains_library_1` y=7), a log-framed gable window (`plains_medium_house_1` (11,5,5..7)), or
    cobblestone at the apex (taiga).
15. **The roof material is the biome's signature.** Share of each type's top surfaces:
    - Plains: oak stairs, 74%.
    - Savanna: acacia stairs, 72%, on low hips.
    - Snowy: full spruce-plank steps carrying a snow layer, 68%.
    - Taiga: spruce logs, 93%.
    - Desert: flat slab roofs with a parapet.
16. **Taiga roof logs run parallel to the ridge.** The gable shows round end grain and the roof
    shows bark stripes. Example: `taiga_medium_house_1` uses 49 `spruce_log[axis=z]` with the ridge
    along z.
17. **Break long eaves with small "eyebrow" gables over the windows.** Example: `plains_temple_3`,
    z=0, y=4-5.
18. **A mansard is a steep stair rim around a flat field.** Mansion roof pieces: a cobblestone
    cornice, 3 dark-oak stair rows, an upside-down stair soffit, then an 8x1x8 plank field.
19. **Snowy roofs are stepped full planks with `snow[layers=1..4]` on every tread,** and they do
    not overhang. Stat: 55 of 76 sides are flush.

### Walls, frames, corners

20. ★ **Put a vertical log post at every corner and every 4-5 blocks, with contrasting infill
    between.** Plains corners are oak logs 79 times and cobblestone only 16. Savanna exterior wall
    surface is 73% acacia log or wood.
21. ★ **Lay horizontal logs as plates and girts at the floor and eave lines.** Examples:
    `plains_library_1` y=4 ring; `plains_big_house_1` y=4; `savanna_temple_1` y=4.
22. **Use the log axis to draw.** Posts are vertical; plates are horizontal; logs whose axis points
    out of the wall show end grain, used for joist ends, friezes and door frames. Examples:
    outpost y=10-11 band `log|plank|log`; mansion `entrance` z=15 at y=2/16. The mansion exterior
    has 0 vertical logs.
23. **Frame a window by changing grain or material, not by adding blocks.**
    - `savanna_medium_house_2`: `acacia_wood[axis=x]` directly above and below a pane in an
      all-wood wall.
    - `plains_library_1` (5,2,1)/(7,2,1): logs laid along the wall as jambs.
24. ★ **Stone at the bottom, lighter material above, and a different block at every floor line.**
    Examples: plains cobblestone base under planks or terracotta; the taiga cobblestone base; the
    mansion's cobblestone plinth and string course (`entrance` z=15, y=8); the desert cut-sandstone
    base ring.
25. **Chamfer small round buildings by leaving out the corner blocks** of the walls and of the
    first roof ring. Examples: `savanna_small_house_1`; `snowy_small_house_1`; the octagonal outpost.
26. ★ **Jetty upper floors out by 1 and show it with a corbel or toothed band.**
    - `snowy_medium_house_2` y=3: top slabs alternating with planks, then a plank row 1 out at y=4.
    - `taiga_medium_house_1` y=5: upside-down stair corbels under the upper floor.
27. ★ **Keep walls 1 block thick.** Stat: the thickness mode is 1 (64-79% of samples) for villages,
    outpost, mansion and end city.
28. **Use porch posts.** Extend the corner posts 1 block past the gable walls to carry a 2-block
    roof overhang. Example: `taiga_small_house_1`, posts at z=1 and z=7, walls at z=2..6.
29. **Desert vigas:** a jungle button on every wall block at each floor and roof line. Example:
    `desert_medium_house_2` rows at y=3 and y=6, 41 buttons.
30. **Parapet rhythm:** double-slab corners with bottom slabs between. Example:
    `desert_medium_house_2` y=7 `double|bottom|bottom|bottom|double`.

### Openings

31. ★ **Windows are 1x1 panes at eye level (floor+1), one per bay.** Use 1x2 or 3x4 only on
    important buildings. Stat: 1x1 is 82% (plains), 85% (savanna), 99% (taiga). Mansion windows are
    3x4 grids; end city windows are 1x2 slits (93%).
32. **Doors are single 1x2 doors with a stair doorstep at y-1.** Stat: 22 of 43 plains doors (14
    cobblestone stairs, 8 oak), 17 of 32 snowy, 10 of 31 taiga.
33. **In hot climates, leave openings unglazed:** a potted plant on the sill and a top-slab lintel.
    Desert houses have 0 glass. Example: `desert_temple_1` (1,2,0) plus (1,3,0).
34. **Make an arch from two upside-down stairs facing away from each other** across a 2-wide
    opening. Example: `desert_temple_1` (1,2,4) facing north and (1,2,5) facing south.
35. **Shutters:** open trapdoors flat on the façade, one each side of the window. Stat: 82 taiga
    trapdoors are `half=top, open`, attached to cobblestone.
36. **Stained-glass gradient:** warm below, light above, in 2-tall windows. Examples:
    `plains_temple_3` yellow under white; `savanna_temple_1` orange under yellow.

### Lighting

37. ★ **Put a light above or beside every door, and interior lights at eye level about 2 blocks
    apart.**
    - Outside light within 2 blocks: plains 27 of 43 doors, taiga 24 of 31, snowy 22 of 32.
    - Most common spot: a wall torch 1 block out, centred, 2 blocks above the door's lower half.
    - Interior lights at door_y+1 or +2: 89 of 136 in plains.
38. **Lamp posts are a torch on a cobblestone wall or a fence post.** Stat: taiga 21; savanna 17
    on fences.
39. **Let the biome pick the fixture:**
    - Snowy: hanging lanterns (48% of its lights).
    - Ancient city: candles, soul fire, soul lanterns.
    - Trial chambers: copper bulbs.
    - End city: end rods.
    - Bastion: lanterns on chains.
40. ★ **Build lights into the wall on a grid.** Trial chambers: 743 of 811 bulbs sit flush in a
    wall face; 490 have a copper band directly below and a chiseled band directly above; one bulb
    per 5-block bay.
41. **Vary light levels on purpose.** Mojang ages about 70% of trial bulbs to light 12, 8 or 4,
    removes 5% of ancient-city soul lanterns, and leaves about 10% of ancient-city candles unlit.
42. **In moody builds, cluster the lights.** The ancient city has a nearest-light median of 1:
    candle groups and soul-fire rows with dark gaps between. Its air/light is 71, against 15-33 in
    houses.
43. **Hang a lantern from a "hook" block,** not from a plain ceiling. Stat: soul lanterns hang from
    `chiseled_deepslate` 63 times and from `polished_deepslate_wall` 44 times.

### Large stone structures

44. ★ **Big walls are horizontal course stacks repeated on a 5-block module:** colour band, light
    course, textured band, then 2 plain courses. Piers carry the same courses. See section 6.
45. ★ **Big rooms use 5-block bays: 3 recessed plus 2 pier.** Lights and doors are centred in the
    recesses (`chamber_1` bulbs at z=4, 9, 14…). Corridors are 5-long slices.
46. **Ceilings use one smooth block in a field, ringed by a band at the wall junction.** Example:
    `chamber_1` y=16 copper ring, y=17 polished tuff.
47. **Edge floors with the "cut" variant of the floor material.** Oxidized cut copper is 11% of
    trial floors: bay borders, thresholds, and 461 step-edge stairs.
48. **Catwalks are see-through grates.** 661 trial grates have air above and below. A walkway is
    built as polished soffit, oxidized deck, cut edge strip, then copper lip
    (`corridor/straight_1` y=7-8).
49. **Alternate two chiseled variants inside one band** for a 2-beat rhythm. Examples:
    `corridor/straight_1` alternates `chiseled_tuff` and `chiseled_tuff_bricks`; ancient-city walls
    put chiseled or polished accents every 6 blocks.
50. **Rough at the base, refined in the middle, broken at the top.** Examples: the barracks façade;
    the bastion entrance, whose top rows are raw blackstone; the bastion `high_rampart`, whose
    erosion grows with height.
51. **Ancient-city walls have an "I-beam" section:** a thin banded spine with rib-edged flanges and
    gray-wool infill. Gray wool is 25-45% of the wall pieces.
52. **Make the focal piece monumental:** big scale, a toothed reveal and symmetric "ears". Example:
    the ancient-city portal, a 22x8 frame with alternating 2-block teeth and side loops.
53. **End city plates use upside-down stair fascias** and a ragged, toothed underside. Stat: 53% of
    end-city stairs are upside-down; the roof overhangs 2.

### Detail and aging

54. **Furniture idioms:**
    - Table: a fence with a pressure plate on top.
    - Chairs: stairs.
    - Stove: open trapdoors around a furnace.
    - Chimney: a cobblestone flue with a lit campfire inside, an upside-down-stair hood and a
      bottom-stair crown (`taiga_medium_house_4`).
55. **Floor medallion:** 4 glazed terracotta blocks rotated north, west, east and south. Example:
    `desert_temple_1` (5..6,0,4..5).
56. **Cloth:**
    - Banners as valances hanging from canopy edges (savanna: 30 attached to planks or slabs).
    - Wool in a 2-colour checkerboard for market awnings (`plains_meeting_point_4`, white and
      yellow).
57. **Dress the ground:**
    - Patchwork plazas mixing grass, dirt path, cobblestone and mossy cobblestone.
    - Snow drifts of layers 1-8 against the walls.
    - Raised flower beds edged with open trapdoors.
    - Hay bales on dirt by the stables.
58. ★ **Age with percentages, not by hand:**
    - 10% moss on cobblestone.
    - 30% cracked bricks and tiles.
    - 5% of blocks deleted.
    - More erosion higher up.
    - Use 70-80% only for "abandoned". See section 8.
59. **Leave empty plots.** About 14% of plains house slots are empty (pool weight 10 against 1-5 per
    house).
60. **Ruined stone ages in thirds.** Underwater ruins split stone bricks evenly: 10.6% normal,
    10.6% cracked, 10.6% mossy.

★ ranking:
1. Roof stairs face up-slope and are backed (8).
2. Upside-down stairs under the rake, facing down-slope (10).
3. Posts at corners and every 4-5 (20).
4. Horizontal plates at the floor and eave lines (21).
5. 3-6 ids make 80% (1).
6. One material per surface direction (2).
7. Course stacks on a 5-block module (44).
8. 3+2 bays (45).
9. Lights built into a grid (40).
10. Lights at doors and at eye level (37).
11. 1x1 windows at floor+1 (31).
12. Exact 1-block overhang (9).
13. Percentage aging (58).
14. Stone base and floor-line bands (24).
15. 1-thick walls with depth from jetties and corbels (26/27).

## 4. Roofs the Mojang way, with the kit

Section through a plains gable (`plains_medium_house_1`, x across the roof).
- `/` and `\` = oak stairs facing up-slope.
- `#` = plank backing.
- `W` = wall.

```
y7      / \          ridge: even span -> two stairs back to back; odd span -> one plank
y6     / # \
y5    / #   \        each upper stair has a full block under its step
y4   / W     W \     eave stair at the level of the top wall course, 1 block out
y3     W     W
```

Rake profile, seen on the gable end. Mojang puts an upside-down stair **facing down-slope** under
every rake-row stair except the eave-most one. The underside is then a smooth 45° line parallel to
the roof:

```
same facing (sawtooth, notches)      opposite facing = Mojang (smooth, parallel to the roof)
             █                                    █
            ██                                   ██
           ███                                  ███
          ██ █                                 ███
         ███                                  ███
        ██ █                                 ███
       ███                                  ███
      ██ █                                 ███
     ███                                  ███
    ██ █                                 ███
(slope rising east, half-block resolution; verified by rendering both)
```

Kit settings that reproduce the Mojang look:
- `underside: 'block'` puts plank backing inside, like vanilla.
- `eaveTrim: false`, because vanilla leaves the eave-most stair bare.
- The kit already finishes rakes the Mojang way: every rake-row stair except the eave-most gets an
  upside-down stair facing **down-slope** under it (opposite to the stair above), and a `gable`
  fill keeps the gable wall-line cells solid.

```js
const R = { x0: 2, z0: 4, x1: 14, z1: 12, axis: 'x', material: 'oak' }
b.roof({ ...R, y: 5, type: 'gable', overhang: 1, gableOverhang: 1, gable: 'oak_planks', underside: 'block', eaveTrim: false })
```

Per-style roof settings:

| Style | Roof | Extra |
|---|---|---|
| Plains | `b.roof({ type: 'gable', material: 'oak', pitch: 1, overhang: 1, gableOverhang: 1, underside: 'block' })` | Log collar in the top gable row |
| Savanna | `ringRoof(..., { material: 'acacia', rings: 2 })` (below) | Plank wall plate under the eave ring; eave-ring corners omitted |
| Snowy | `b.roof` with `overhang: 0`, then stairs → planks and snow on every tread (below) | No overhang |
| Taiga | No `b.roof`: rows of `spruce_log[axis=<ridge axis>]` at 45°, eave at door_y+2, 2-block gable overhang on porch posts | Recipe 9.2 |
| Desert | Flat `smooth_sandstone` slab | Parapet of `smooth_sandstone_slab` with `[type=double]` corners |
| Mansion | `ringRoof(..., { material: 'dark_oak', rings: 3, field: 'planks', omitEaveCorners: false })` | Cobblestone cornice course under the eave |

Mojang's low hips and mansards are stair rings around a **flat** field. The kit does this with
zero rises: `b.roof({ type: 'hip', pitch: [1, 1, 0], ... })` (two stair rings, then a flat plank
field). The helper below gives finer control (top-slab field, omitted eave corners); verified:

```js
// Mojang low hip / mansard: `rings` stair rings stepping in 1 and up 1 from the eave, then a flat field.
// x0..x1, z0..z1 = wall lines; y = level of the ring over the wall line (wall top + 1); the eave ring sits at y - 1.
function ringRoof(b, x0, z0, x1, z1, y, { material = 'acacia', rings = 2, field = 'slab', omitEaveCorners = true } = {}) {
  const st = `${material}_stairs`
  for (let k = 0; k < rings; k++) {
    const a0 = x0 - 1 + k, c0 = z0 - 1 + k, a1 = x1 + 1 - k, c1 = z1 + 1 - k, yy = y - 1 + k
    for (let x = a0; x <= a1; x++) for (let z = c0; z <= c1; z++) {
      if (x !== a0 && x !== a1 && z !== c0 && z !== c1) continue
      const corner = (x === a0 || x === a1) && (z === c0 || z === c1)
      if (corner && k === 0 && omitEaveCorners) continue
      const f = z === c0 ? 'south' : z === c1 ? 'north' : x === a0 ? 'east' : 'west'
      b.set(x, yy, z, `${st}[facing=${f},half=bottom]`)
    }
  }
  const k = rings - 1
  b.box([x0 + k, y - 1 + k, z0 + k], [x1 - k, y - 1 + k, z1 - k], field === 'slab' ? `${material}_slab[type=top]` : `${material}_planks`, { keep: true })
}

// savanna hut: chamfered 5x5 walls, acacia plank wall plate, 2 rings + top-slab field
b.walls([3, 0, 4], [7, 2, 8], 'yellow_terracotta')
b.walls([3, 3, 4], [7, 3, 8], 'acacia_planks')
for (const [x, z] of [[3, 4], [7, 4], [3, 8], [7, 8]]) b.box([x, 0, z], [x, 3, z], 'air')
ringRoof(b, 3, 4, 7, 8, 4, { material: 'acacia', rings: 2 })

// snowy: stepped full spruce planks, no overhang, a snow layer on every tread
const rn = b.roof({ x0: 14, z0: 3, x1: 20, z1: 9, y: 4, type: 'gable', axis: 'x', material: 'spruce', overhang: 0, gableOverhang: 0, gable: 'spruce_planks', underside: 'block' })
b.replace([13, 0, 2], [21, 11, 10], 'spruce_stairs', 'spruce_planks')
for (const [k, c] of rn.cells) { const [x, z] = k.split(',').map(Number); b.set(x, rn.base + c.tb + 1, z, 'snow[layers=1]', { keep: true }) }
```

## 5. Copy-ready palettes

How each share is measured:
- **Exterior surface:** % of the house surfaces that touch outside air.
- **Overall:** % of all non-terrain blocks.
- **Floor / ceiling / wall:** % of the room surfaces facing that way.

Read `stairs (top)` as upside-down.

### 5.1 Plains

| Role | Block id | Share |
|---|---|---|
| Wall field, ground course, plinth | `cobblestone` | 42% of exterior surface; 66% of foundation |
| Posts, jambs | `oak_log[axis=y]` | 29% of exterior surface |
| Plates, girts, collars, mullions | `oak_log[axis=x/z]` | 30% of oak logs |
| Upper infill, floor, roof backing, ridge | `oak_planks` | 19% of exterior surface; 44% of floors |
| Plaster panels (temples, shops) | `white_terracotta` | 8% of exterior surface |
| Small-house corner posts | `stripped_oak_log` | 2% |
| Roof surface | `oak_stairs` | 68% of roof |
| Rake and dormer soffits | `oak_stairs (top)` | 10% of roof |
| Doorsteps | `cobblestone_stairs` | 0.9% overall |
| Windows | `glass_pane` / `yellow_stained_glass_pane` / `white_stained_glass_pane` | 80 / 10 / 9% of glass |
| Door | `oak_door` | 100% |
| Light | `wall_torch` 87%, `torch` on `oak_fence` or `cobblestone_wall` 13% | |
| Yards and tables | `oak_fence`, `oak_pressure_plate`, `hay_block`, `composter` | |
| Aging | `mossy_cobblestone` | 10% of cobblestone |

### 5.2 Desert

| Role | Block id | Share |
|---|---|---|
| Walls, floors, flat roofs | `smooth_sandstone` | 69% of exterior walls; 90% of floors |
| Base ring, corners, trim | `cut_sandstone` | 24% of exterior walls |
| Roof surface and parapets | `smooth_sandstone_slab[type=bottom]` | 77% of slabs |
| Flush ceilings and lintels | `smooth_sandstone_slab[type=top]` | 19% of slabs |
| Raised parapet corners | `smooth_sandstone_slab[type=double]` | 5% of slabs |
| Merlon caps | `sandstone_slab` | 4.6% overall |
| Exterior stairs; arches as `(top)` | `smooth_sandstone_stairs` | 3.7% overall |
| Parapet and lamp posts | `sandstone_wall` | 2.9% overall |
| Door, vigas | `jungle_door`, `jungle_button` | 1.5%, 1.3% overall |
| Floor accents, medallions | `terracotta`, `light_blue_glazed_terracotta`, `white_glazed_terracotta` | about 1.5% overall |
| Niche plants | `potted_cactus`, `potted_dead_bush` | |

### 5.3 Savanna

| Role | Block id | Share |
|---|---|---|
| Posts and wall columns | `acacia_log[axis=y]` | 51% of exterior surface |
| Bark wall blocks; axis-flipped lintels and sills | `acacia_wood` | 22% of exterior surface |
| Wall panels, totem caps | `yellow_terracotta` | 15% of exterior surface |
| Panels, totem shafts | `orange_terracotta` / `red_terracotta` | 7% / 3% of exterior surface |
| Floors, roof backing, flat tops, canopies | `acacia_planks` | 53% of floors |
| Low hip roofs | `acacia_stairs` (never upside-down) | 77% of roof |
| Flat roof caps, canopies | `acacia_slab` (top / bottom / double) | 4.6% overall |
| Canopy posts, pens, lamp posts | `acacia_fence` | 7.6% overall |
| Door | `acacia_door` | |
| Windows | `glass_pane`; temples stack `orange_stained_glass_pane` under `yellow_stained_glass_pane` | |
| Cloth | `brown_wall_banner` | 36% of décor |

### 5.4 Snowy

| Role | Block id | Share |
|---|---|---|
| Infill, floors, stepped roofs, jetty bands | `spruce_planks` | 43% of exterior surface; 59% of roof |
| Posts, foundations | `stripped_spruce_log[axis=y]` | 21% of exterior surface |
| Posts, sills, lintels, beams | `stripped_spruce_wood` | 18% of exterior surface |
| Toothed bands, ceilings | `spruce_slab[type=top]` | 35% of slabs |
| Roof half-steps | `spruce_slab[type=bottom]` | 62% of slabs |
| Roof treads, drifts | `snow[layers=1..8]` | 16.6% of all blocks |
| Huts, accents | `snow_block`, `packed_ice`, `blue_ice` | |
| Stone accents, hearths | `diorite`, `diorite_wall` | |
| Light | `lantern[hanging=true]` from fences | 48% of lights |

### 5.5 Taiga

| Role | Block id | Share |
|---|---|---|
| Walls, floors, gable apex, chimneys | `cobblestone` | 71% of exterior surface |
| A-frame roof, axis parallel to the ridge | `spruce_log` | 93% of roof surface |
| Corner and porch posts | `spruce_log[axis=y]` | 19% of exterior surface (with gable logs) |
| Upper walls, floors | `spruce_planks` | |
| Shutters, planter borders, skirting, stove surrounds | `spruce_trapdoor[open=true]` | 6.3% overall |
| Doorsteps, chimney hood `(top)` and crown | `cobblestone_stairs` | |
| Lamp posts with `torch` | `cobblestone_wall` | |
| Upper-floor corbels | `spruce_stairs (top)` | |
| Hearth | `campfire[lit=true]` inside the flue | |
| Aging | `mossy_cobblestone` | 10% of cobblestone |

### 5.6 Pillager outpost (watchtower)

| Role | Block id | Share |
|---|---|---|
| Walls, roof dome | `dark_oak_planks` | 30.0% |
| Every floor and deck | `birch_planks` | 25.1% |
| Base drum, corner quoins (half mossy in the overgrown variant) | `cobblestone` | 17.9% |
| Octagon posts, roof columns, buttresses | `dark_oak_log[axis=y]` | 7.6% |
| Joist ends, deck rim beams | `dark_oak_log[axis=x/z]` | 4.8% |
| Deck railing (with `cobblestone_wall` corner posts) | `dark_oak_fence` | 4.2% |
| Buttress caps, corbel corners | `dark_oak_slab` | 3.9% |
| Deck corbels | `cobblestone_stairs (top)`, `dark_oak_stairs (top)` | 3.1% |
| Hung from the deck rim | `white_wall_banner` | 0.7% |

### 5.7 Woodland mansion (exterior pieces)

| Role | Block id | Share |
|---|---|---|
| Walls, flat roof field | `dark_oak_planks` | 32.8% |
| Plinth, string courses, roof cornice | `cobblestone` | 14.9% |
| End-grain friezes, window frames, door surrounds, hoods (never vertical) | `dark_oak_log[axis=x/z]` | 7.7% |
| Sill boxes, cornices | `cobblestone_stairs` (bottom / top) | 4.1 / 2.7% |
| Mansard rim / eave soffit | `dark_oak_stairs` (bottom / top) | 2.2 / 2.3% |
| 3x4 and 2x4 window grids | `glass_pane` | 2.3% |
| Balustrades under windows | `cobblestone_wall` | 1.7% |
| Floors | `birch_planks` | 15.9% |
| Halls | `red_carpet` with a `white_carpet` border | 8.6 / 1.8% |

### 5.8 Trial chambers

| Role | Block id | Share overall | Share of its surface |
|---|---|---|---|
| Bulk walls and fill | `tuff_bricks` | 68.3% | 46% of walls |
| Ceilings, walkway soffits, lintels | `polished_tuff` | 8.9% | 88% of ceilings |
| Wall bands, cornice ring, walkway lips | `waxed_copper_block` | 7.1% | 22% of walls |
| Floors and decks | `waxed_oxidized_copper` | 6.5% | 62% of floors |
| Textured band above each bulb course | `chiseled_tuff_bricks` | 4.3% | 14% of walls |
| Alternating beat inside chiseled bands | `chiseled_tuff` | 0.1% | |
| Bay floor borders, thresholds, walkway edges | `waxed_oxidized_cut_copper` | 1.6% | 11% of floors |
| Step edges, pit rims | `waxed_oxidized_cut_copper_stairs` | 0.5% | 5% of floors |
| Catwalks, balconies, bridges | `waxed_copper_grate`, `waxed_oxidized_copper_grate` | 0.9% | 5% of floors |
| Wall lights, one per bay per tier | `waxed_copper_bulb[lit=true]` | 0.6% | 2.2% of walls |
| Medallions in copper pilasters | `waxed_chiseled_copper` | 0.1% | |
| Pit floors under grates | `magma_block` | 0.1% | |

### 5.9 Ancient city

| Role | Block id | Share | Where it shows (exposure) |
|---|---|---|---|
| Main walls, ceilings | `deepslate_bricks` | 26.5% | 40% side |
| Main walls, floors, reveals | `deepslate_tiles` | 25.4% | 44% side |
| Bulk core, plinths | `deepslate[axis=y]` | 15.7% | **60% hidden** |
| Matte infill between ribs | `gray_wool` | 10.1% | 36% hidden |
| Copings (bottom), ceiling cornices (top) | `deepslate_tile_stairs` | 4.6% | |
| Damage streaks, camps | `cobbled_deepslate` | 3.5% | 61% side |
| String courses, pilasters | `polished_deepslate`, `polished_deepslate_wall` | 3.5% | **80% side** |
| Accents, caps, lantern hooks | `chiseled_deepslate` | 1.9% | **92% side** |
| Columns | `polished_basalt[axis=y]` | 1.0% | |
| Floor inlays, candle stands | `smooth_basalt` | 0.3% | 98% top |
| Light | `candle` (1-4, about 10% unlit), `soul_lantern`, `soul_fire` on `soul_sand` | about 1% | |
| Portal frame only | `reinforced_deepslate` | 0.2% | |
| Aging | `cracked_deepslate_bricks`, `cracked_deepslate_tiles` | 30% of bricks and tiles | |

### 5.10 End city

| Role | Block id | Share |
|---|---|---|
| Floor plates, roofs, upper walls | `purpur_block` | 49.1% |
| Fascias, corbels, steps (53% upside-down) | `purpur_stairs` | 18.6% |
| Wall panels only (never a floor or cap) | `end_stone_bricks` | 12.7% |
| Frames, posts, tower shafts | `purpur_pillar[axis=y]` | 12.3% |
| 1-wide slit windows | `magenta_stained_glass` | 3.0% |
| Edges | `purpur_slab` | 1.7% |
| Corner light posts | `end_rod[facing=up]` | 1.3% |

### 5.11 Bastion

| Role | Block id | Share |
|---|---|---|
| Bulk walls | `polished_blackstone_bricks` | 55.7% |
| Rough crown, edges, erosion patches | `blackstone` | 35.8% |
| Corner columns, pillars | `basalt[axis=y]` | 4.5% |
| Wear (plus 30-50% more from processors) | `cracked_polished_blackstone_bricks` | 2.7% |
| Steps, edges | `polished_blackstone_brick_stairs`, `blackstone_slab` | 0.6% |
| Accents, always in pairs | `chiseled_polished_blackstone` | 0.1% |
| Treasure accents | `gold_block`, `gilded_blackstone` | 0.2% |
| Sparse light | `lantern` on `chain` | 0.1% |

## 6. The trial-chamber system (bands, bays, lights)

West wall of `chamber_1`, looking from the room centre:

```
y17  ###@@@@@@@@@@@@@@@@@@@@@@@###   @ polished_tuff  ceiling field
y16  #%%%%%%%%%%%%%%%%%%%%%%%%%%%#   % waxed_copper_block  cornice ring
y14  &&&&&&&&&&&&&&&&&&&&&&&&&&&&&   & chiseled_tuff_bricks band
y13  ####$####$####$####$####$####   $ waxed_copper_bulb, one per bay (every 5)
y12  %%%%%%%%%%%%%%%%%%%%%%%%%%%%%   % copper band
y10  #&&&&&&&&&&&&&&&&&&&&&&&&&&&#   chiseled band
y7   #%%%%%%%%%%%%%%%%%%%%%%%%%%%#   copper band
y4   #&&&&&&&&&&&&&&&&&&&&&&&&&&&#   chiseled band
y3   ####$####$####$####$####$####   bulbs
y2   #%%%%%%%%%%%%%%%%%%%%%%%%%%%#   copper band
y1   ###=======================###   = waxed_oxidized_copper floor
     (unlisted rows = tuff_bricks)
```

Plan (y=5), 3-wide recesses alternating with 2-wide piers:

```
###...##...##...##...###      . = room air, # = tuff bricks
##....................##      piers are 1 block proud of the recess face
```

The rules:
1. **Course module of 5, from the floor up:** copper, bulb course, chiseled, tuff, tuff. Repeat it
   per tier. Bulbs go only in the bulb course, and only at the centre of each recess.
2. **Bays:** 3 recessed plus 2 pier. Every pier carries the same courses at the same heights, so
   the lines run unbroken.
3. **Ceiling:** a polished tuff field, with a copper ring where the wall meets it.
4. **Floor:** an oxidized copper field, cut copper inside each recess and at thresholds, and cut
   copper stairs on step edges.
5. **Walkways and balconies:** copper grates, or a polished soffit plus oxidized deck plus cut edge
   plus copper lip.
6. **Corridor cross-section** (`corridor/straight_*`, 19x19, built in 5-long slices):
   - A 3-wide nave open to the ceiling.
   - Side aisles with walkways at y=3 and y=8.
   - Grate balconies at y=13.
   - A polished tuff lintel beam at y=17.
7. **Bulb aging:** 10% oxidized, then 33% of the rest weathered, then 50% of the rest exposed, all
   still lit. That is about 30% at light 15, 30% at 12, 30% at 8 and 10% at 4.

### 6.1 Recipe: trial-chamber wall bay (verified)

```js
// Trial-chamber wall: [2-wide pier + 3-wide recess] modules stamped along the wall,
// 5-course band module (copper / bulb course / chiseled / tuff / tuff) x 2 tiers, copper cornice,
// polished-tuff ceiling, oxidized-copper floor with cut-copper bay borders, grate balcony.
export default function build(api) {
  const { kit } = api
  const BAYS = 3, TIERS = 2, FLOOR = 1
  const TOP = FLOOR + 5 * TIERS, CORNICE = TOP + 1, CEIL = TOP + 2
  const W = 5 * BAYS + 2
  const b = api.builder([W, CEIL + 2, 10], { seed: 9 })
  const course = y => ['waxed_copper_block', 'tuff_bricks', 'chiseled_tuff_bricks', 'tuff_bricks', 'tuff_bricks'][(y - FLOOR - 1) % 5]
  const bulbCourse = y => (y - FLOOR - 1) % 5 === 1

  // two modules: a 2-wide pier (face 1 block proud, z=2) and a 3-wide recess (face at z=1); z=0 = solid back
  const strip = (w, pier) => {
    const m = b.module([w, CEIL + 2, 3])
    for (let x = 0; x < w; x++) {
      for (let y = 0; y <= CEIL + 1; y++) m.set(x, y, 0, 'tuff_bricks')
      for (let y = FLOOR + 1; y <= TOP; y++) {
        if (pier) m.set(x, y, 1, 'tuff_bricks')
        m.set(x, y, pier ? 2 : 1, !pier && x === 1 && bulbCourse(y) ? 'waxed_copper_bulb[lit=true]' : course(y))
      }
      m.set(x, CORNICE, 1, pier ? 'tuff_bricks' : 'waxed_copper_block')
      m.set(x, CORNICE, 2, 'waxed_copper_block')                       // cornice ring runs over piers and recesses
    }
    return m
  }
  const pier = strip(2, true), recess = strip(3, false)
  for (let i = 0; i <= BAYS; i++) b.stamp(pier, [i * 5, 0, 0])
  for (let i = 0; i < BAYS; i++) b.stamp(recess, [i * 5 + 2, 0, 0])

  // floor, ceiling, shell
  b.box([0, 0, 0], [W - 1, 0, 9], 'tuff_bricks')
  b.box([0, FLOOR, 2], [W - 1, FLOOR, 9], 'waxed_oxidized_copper')
  for (let x = 0; x < W; x++) if (x % 5 >= 2) b.set(x, FLOOR, 2, 'waxed_oxidized_cut_copper')   // border inside each recess
  b.box([0, FLOOR, 9], [W - 1, FLOOR, 9], 'waxed_oxidized_cut_copper_stairs[facing=north,half=bottom]')
  b.box([0, CEIL, 3], [W - 1, CEIL, 9], 'polished_tuff')
  b.box([0, CEIL + 1, 0], [W - 1, CEIL + 1, 9], 'tuff_bricks')

  // grate balcony cantilevered from the middle bay on the 2nd-tier copper band, polished-tuff edge beams
  const y = FLOOR + 6, mx = 7
  b.box([mx, y, 3], [mx + 2, y, 4], 'waxed_copper_grate')
  for (const x of [mx - 1, mx + 3]) b.box([x, y, 3], [x, y, 4], 'polished_tuff')

  // trial_chambers_copper_bulb_degradation: rules in order, every bulb stays lit
  b.map((x, y, z, blk) => {
    if (blk.name !== 'minecraft:waxed_copper_bulb') return null
    const h = n => kit.noise.hash01(x, y, z, n)
    if (h(1) < 0.10) return 'waxed_oxidized_copper_bulb[lit=true]'
    if (h(2) < 0.333) return 'waxed_weathered_copper_bulb[lit=true]'
    if (h(3) < 0.5) return 'waxed_exposed_copper_bulb[lit=true]'
    return null
  })
  return b.finish({ name: 'vanilla-trial-bay' })
}
```

To scale it up: raise `TIERS` for taller rooms (`chamber_1` has 3 tiers, 17 high) and repeat the
wall on 4 sides. Keep the floor-to-ceiling course count a multiple of 5 plus the cornice.

## 7. Ancient-city deepslate roles

Façade layering (`structures/barracks`, south face):

```
y7   ragged top: brick-stair stubs, cobbled patch, soul-fire niche   (broken silhouette)
y5-6 deepslate field with chiseled / cobbled inserts
y4   deepslate_tiles band
y3   polished_deepslate string course  (+ cobbled damage streak)
y2   deepslate / polished_deepslate alternating  -> pilaster rhythm
y0-1 plain deepslate base
```

Wall section (`walls/intact_horizontal_wall_1`), an I-beam:
- **Spine:** 1 thick, banded: tiles, then bricks, then tiles with chiseled every 6, then bricks
  with polished every 6.
- **Top and bottom flanges:** deepslate edges, with `gray_wool` infill between.
- **Ruin:** ragged tops are built into the templates. Processors then crack 30% of bricks and
  tiles, delete 5% of `#ancient_city_replaceable`, and remove 5% of soul lanterns (walls also lose
  30% of tile slabs).
- **Light:** candle clusters of 1-4 (some unlit) on smooth basalt or bricks; soul fire on soul
  sand in rows; soul lanterns hung from `chiseled_deepslate`.

### 7.1 Recipe: ancient-city wall segment (verified)

```js
// Ancient-city wall segment: deepslate variants by role, ragged top, damage streaks, quiet clustered light,
// then Mojang's ancient_city_generic_degradation (30% cracked bricks/tiles, 5% rot, 5% lanterns removed).
export default function build(api) {
  const { kit } = api
  const L = 20, H = 9
  const b = api.builder([L + 2, H + 4, 9], { seed: 13 })
  const h = (x, y, z, s) => kit.noise.hash01(x, y, z, s)
  b.box([0, 0, 0], [L + 1, 0, 8], 'deepslate_tiles')                       // plaza floor
  for (let x = 1; x <= L; x++) {
    // ragged top: height drops by 0-3 in coherent steps
    const top = H - Math.floor(3 * kit.noise.coherent01(x, 0, 0, { scale: 4, seed: 2 }) ** 1.5)
    for (let y = 1; y <= top; y++) {
      let face
      if (y <= 2) face = 'deepslate[axis=y]'                                 // raw base
      else if (y === 3) face = x % 2 ? 'deepslate[axis=y]' : 'polished_deepslate'   // pilaster rhythm
      else if (y === 4) face = 'polished_deepslate'                          // string course
      else if (y === 5) face = 'deepslate_tiles'                             // tile band
      else face = (x % 6 === 3 && y === 7) ? 'chiseled_deepslate' : 'deepslate_bricks'  // field + accents every 6
      b.set(x, y, 3, face)
      b.set(x, y, 4, y <= 2 ? 'deepslate[axis=y]' : 'gray_wool')            // core: matte gray wool infill
      b.set(x, y, 5, y <= 4 ? 'deepslate[axis=y]' : 'deepslate_bricks')     // back leaf
    }
    // coping: tile stairs on both edges of the wall top, rising toward the centre line
    b.set(x, top + 1, 3, 'deepslate_tile_stairs[facing=south,half=bottom]')
    b.set(x, top + 1, 5, 'deepslate_tile_stairs[facing=north,half=bottom]')
    b.set(x, top + 1, 4, 'deepslate_tile_slab[type=bottom]')
  }
  // damage streaks: vertical runs of cobbled deepslate (repairs/breaks), 2 per 20 blocks
  for (const sx of [6, 15]) for (let y = 2; y <= 6; y++) if (h(sx, y, 0, 4) < 0.8) b.set(sx + (y % 3 === 0 ? 1 : 0), y, 3, 'cobbled_deepslate')
  // upside-down tile stairs as a cornice under the tile band (depth without bulk)
  for (let x = 1; x <= L; x++) b.set(x, 5, 2, h(x, 5, 2, 6) < 0.85 ? 'deepslate_tile_stairs[facing=south,half=top]' : 'air')
  // light: candle clusters (1-4, some unlit) on smooth basalt plinths; soul fire trough; soul lantern from a chiseled hook
  for (const [x, n, lit] of [[3, 3, true], [4, 1, true], [10, 4, true], [11, 2, false], [17, 3, true]]) {
    b.set(x, 1, 1, 'smooth_basalt'); b.set(x, 2, 1, `candle[candles=${n},lit=${lit}]`)
  }
  for (let x = 7; x <= 9; x++) { b.set(x, 0, 1, 'soul_sand'); b.set(x, 1, 1, 'soul_fire') }
  b.set(13, 8, 2, 'chiseled_deepslate'); b.set(13, 7, 2, 'soul_lantern[hanging=true]')
  b.set(13, 8, 3, 'chiseled_deepslate')
  // polished basalt column at each end (columns = polished basalt, axis y)
  for (const x of [0, L + 1]) b.box([x, 1, 2], [x, H + 1, 6], 'polished_basalt[axis=y]')
  // ancient_city_generic_degradation
  b.map((x, y, z, blk) => {
    const p = h(x, y, z, 21)
    if (blk.name === 'minecraft:deepslate_bricks' && p < 0.3) return 'cracked_deepslate_bricks'
    if (blk.name === 'minecraft:deepslate_tiles' && p < 0.3) return 'cracked_deepslate_tiles'
    if (blk.name === 'minecraft:soul_lantern' && p < 0.05) return 'air'
    if (/deepslate_(bricks|tiles|brick_stairs|tile_stairs|tile_slab|brick_slab)$|^minecraft:(cobbled_deepslate|gray_wool)$/.test(blk.name) && h(x, y, z, 22) < 0.05) return 'air'
    return null
  })
  return b.finish({ name: 'vanilla-ancient-wall' })
}
```

## 8. Aging: Mojang's processors as kit calls

Mojang's `rule` processors work per block. Each block is tested on its own (`random_block_match`),
with no clumping. When several rules match the same block, the first one wins. To reproduce them
exactly, use `b.map` with `kit.noise.hash01`:

```js
// Mojang 'rule' processor: replace `from` with `to` at probability p, per block.
function ruleProcessor(b, kit, from, to, p, seed = 0) {
  const id = from.includes(':') ? from : `minecraft:${from}`
  b.map((x, y, z, blk) => (blk.name === id && kit.noise.hash01(x, y, z, seed) < p ? to : null))
}
```

`b.weather` clumps the replacements into patches, which reads more natural on smooth textures. Its
`amount` is **not** the share of blocks it replaces. Measured on a 24³ box of stone bricks
(`scale` 1 and 4 give the same result within ±2%):

| Target share | 5% | 10% | 20% | 30% | 50% | 70% | 80% |
|---|---|---|---|---|---|---|---|
| `amount` | 0.155 | 0.22 | 0.31 | 0.38 | 0.50 | 0.62 | 0.69 |

| Mojang processor (where it applies) | What it does | Exact kit call | Patchy alternative |
|---|---|---|---|
| `mossify_10_percent` (every plains and taiga house) | cobblestone → mossy 10% | `ruleProcessor(b, kit, 'cobblestone', 'mossy_cobblestone', 0.10)` | `b.weather(a, c, { amount: 0.22 })` |
| `mossify_20_percent` / `_70_percent` (plazas) | 20% / 70% | `p = 0.2` / `0.7` | `amount: 0.31` / `0.62` |
| `zombie_*` (abandoned villages) | cobblestone → mossy 80%; doors and torches removed; 5-20% of planks, logs and stairs → `cobweb`; `glass_pane` → `cobweb` 50%, the rest → `brown_stained_glass_pane` | several `b.map` rules | – |
| `ancient_city_generic_degradation` | bricks and tiles → cracked 30%; `soul_lantern` → air 5%; `block_rot` 0.95 on replaceables | section 7.1 | `b.weather(a, c, { amount: 0.38 })` (deepslate only has cracked variants) |
| `ancient_city_walls_degradation` | as above, plus `deepslate_tile_slab` → air 30% | add one rule | – |
| `bastion_generic_degradation` | `polished_blackstone_bricks` → cracked 30%; `gold_block` → cracked bricks 30%; `gilded_blackstone` → `blackstone` 50%; `blackstone` → gilded 1% | `b.map` | `amount: 0.38` for the cracking |
| `high_wall` (bastion outer walls) | bricks → air 1%, then → cracked 50%, then → `blackstone` 30% | snippet below | – |
| `roof` (bastion) | bricks → cracked 30%, → air 15%, → blackstone 30% | `b.map` | – |
| `high_rampart` | any → air, chance rising linearly with y (0 → 5% over 100 blocks) | `p = 0.05 * (y - y0) / (y1 - y0)` | – |
| `trial_chambers_copper_bulb_degradation` | bulbs → oxidized 10%, weathered 33%, exposed 50%, all lit | section 6.1 | – |
| `farm_plains` / `farm_taiga` / `farm_snowy` | wheat → carrots 30% / potatoes 20% / beetroots 10%; taiga → pumpkin stems 30%; snowy → potatoes 80% | `b.map` on `wheat` | – |
| `street_plains` / `street_snowy_or_taiga` | `dirt_path` → grass 10-20%; path over water → biome planks | `ruleProcessor(..., 'dirt_path', 'grass_block', 0.15)` | – |
| `trail_ruins_*_archaeology` | gravel → dirt 20%, coarse dirt 10%; `mud_bricks` → `packed_mud` 10% | `b.map` | – |

Rules of thumb:
- **About 10% reads as texture, about 30% as age, 70-80% as abandonment.**
- Per-block random is fine at 10% or less on an already busy texture (cobblestone). Above that,
  or on calm textures (bricks, planks), use patches (`b.weather`) or a gradient (`b.texture`).
- Mojang adds a second, *design-time* layer of aging: ragged tops, rough material at crowns and
  corners, cobbled damage streaks. Processors only add noise on top.

Bastion crown (verified). The snippet does four things:
- Textures a blockout from smooth bricks to a rough blackstone crown.
- Adds basalt corner columns.
- Bites a ragged top out of the upper rows.
- Applies the `high_wall` processor.

```js
b.box([1, 0, 1], [16, 19, 4], 'white_wool')                                  // blockout
b.texture([1, 0, 1], [16, 19, 4], ['polished_blackstone_bricks', 'cracked_polished_blackstone_bricks', 'blackstone'],
  { only: 'white_wool', mid: 0.15, base: 0, top: -0.75, edge: 0.3, drip: 0, noise: 0.35, scale: 5, seed: 4 })
for (const x of [1, 16]) b.box([x, 0, 1], [x, 19, 1], 'basalt[axis=y]')
b.map((x, y, z) => (y >= 17 && kit.noise.coherent01(x, y, z, { scale: 3, seed: 8 }) < 0.18 * (y - 16) ? 'air' : null))
b.map((x, y, z, blk) => {                                                     // high_wall, rules in order
  if (blk.name !== 'minecraft:polished_blackstone_bricks') return null
  const h = n => kit.noise.hash01(x, y, z, n)
  if (h(1) < 0.01) return 'air'
  if (h(2) < 0.5) return 'cracked_polished_blackstone_bricks'
  if (h(3) < 0.3) return 'blackstone'
  return null
})
b.set(9, 6, 1, 'chiseled_polished_blackstone'); b.set(10, 6, 1, 'chiseled_polished_blackstone')  // accents in pairs
```

A negative `top` pushes the ramp toward its last (roughest) step near the top.

## 9. Kit recipes: village houses (verified)

Each recipe is a complete file. Run it with `node scripts/run-build.mjs <file>` and render it.
All three built with `builder.problems` empty and 0 clipped blocks, and their renders match the
vanilla vocabulary.

### 9.1 Plains cottage

Elements:
- A 13x9 timber frame (oak posts every 4) with a cobblestone ground course and plank infill.
- 1x1 windows framed by logs laid along the wall.
- An oak stair gable roof, overhang 1, plank backing, rake soffits and a plank ridge.
- A log collar and a framed window in the gable.
- A cobblestone stair doorstep, a torch above the door, and cobblestone-wall lamp posts.
- A table and chairs inside.
- Mossify 10%.

```js
// Plains cottage, Mojang style (plains_library_1 / medium_house_1 vocabulary)
function ruleProcessor(b, kit, from, to, p, seed = 0) {
  const id = from.includes(':') ? from : `minecraft:${from}`
  b.map((x, y, z, blk) => (blk.name === id && kit.noise.hash01(x, y, z, seed) < p ? to : null))
}
export default function build(api) {
  const { kit } = api
  const b = api.builder([17, 13, 17], { seed: 4 })
  const X0 = 2, X1 = 14, Z0 = 4, Z1 = 12            // wall lines: 13 x 9, posts every 4
  b.box([0, 0, 0], [16, 0, 16], 'grass_block')
  // floor course: cobblestone ring + oak plank floor (floor y = 1, door sill)
  b.box([X0, 1, Z0], [X1, 1, Z1], 'cobblestone')
  b.box([X0 + 1, 1, Z0 + 1], [X1 - 1, 1, Z1 - 1], 'oak_planks')
  // walls y=2..4: oak_log posts every 4, plank infill, beams top+bottom; bottom beam -> cobblestone course
  const walls = [[[X0, 2, Z0], [X1, 4, Z0]], [[X0, 2, Z1], [X1, 4, Z1]], [[X0, 2, Z0], [X0, 4, Z1]], [[X1, 2, Z0], [X1, 4, Z1]]]
  for (const [a, c] of walls) b.timberWall(a, c, { frame: 'oak_log', infill: 'oak_planks', postEvery: 4 })
  b.box([X0, 2, Z0], [X1, 2, Z1], 'cobblestone', { only: blk => blk.name === 'minecraft:oak_log' && blk.props.axis !== 'y' })
  for (const [x, z] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) b.box([x, 1, z], [x, 4, z], 'oak_log[axis=y]')  // corner posts win
  // windows: one pane per 3-wide bay at eye level (y=3 = door_y+1), jambs = logs laid along the wall
  const bayWindow = (x, z, along) => {
    b.set(x, 3, z, 'glass_pane')
    const d = along === 'x' ? [1, 0] : [0, 1]
    for (const s of [-1, 1]) b.set(x + d[0] * s, 3, z + d[1] * s, `oak_log[axis=${along}]`)
  }
  for (const x of [4, 12]) { bayWindow(x, Z0, 'x'); bayWindow(x, Z1, 'x') }
  bayWindow(8, Z0, 'x')
  for (const z of [6, 10]) { bayWindow(X0, z, 'z'); bayWindow(X1, z, 'z') }
  // door in the middle bay of the south wall: cobblestone stair doorstep, wall torch above the door
  b.door([8, 2, Z1], 'south', { material: 'oak' })
  b.set(8, 1, Z1 + 1, 'cobblestone_stairs[facing=north,half=bottom]')
  b.set(8, 4, Z1 + 1, 'wall_torch[facing=south]')
  // roof: oak stairs 1:1, overhang 1 everywhere, plank backing (Mojang), odd span -> plank ridge
  const R = { x0: X0, z0: Z0, x1: X1, z1: Z1, axis: 'x', material: 'oak' }
  const gable = (x, y, z) => {
    if (y === 7) return 'oak_log[axis=z]'                                  // collar band (top 3-wide row)
    if (y === 6 && z === 8) return 'glass_pane'                            // gable window
    if (y === 6 && (z === 7 || z === 9)) return 'oak_log[axis=y]'          // its jambs
    return 'oak_planks'
  }
  b.roof({ ...R, y: 5, type: 'gable', pitch: 1, overhang: 1, gableOverhang: 1, gable, underside: 'block', eaveTrim: false })
  b.chimney([12, 2, 6], 9, { paint: 'cobblestone', cap: 'cobblestone_wall', smoke: false })
  // interior: fence+pressure plate table, stair chairs, bed, torch at eye level
  b.set(5, 2, 8, 'oak_fence'); b.set(5, 3, 8, 'oak_pressure_plate')
  b.set(5, 2, 7, 'oak_stairs[facing=north]'); b.set(5, 2, 9, 'oak_stairs[facing=south]')
  b.set(12, 2, 9, 'white_bed[part=foot,facing=south]'); b.set(12, 2, 10, 'white_bed[part=head,facing=south]')
  b.set(9, 3, Z0 + 1, 'wall_torch[facing=south]')
  // yard: two cobblestone-wall lamp posts flanking the step, hay bale, path
  for (const x of [6, 10]) { b.set(x, 1, Z1 + 2, 'cobblestone_wall'); b.set(x, 2, Z1 + 2, 'torch') }
  b.box([7, 0, Z1 + 2], [9, 0, 16], 'dirt_path')
  b.set(15, 1, 13, 'hay_block')
  ruleProcessor(b, kit, 'cobblestone', 'mossy_cobblestone', 0.10, 3)     // mossify_10_percent
  return b.finish({ name: 'vanilla-plains-house' })
}
```

### 9.2 Taiga cabin

Elements:
- Cobblestone walls with spruce corner posts, plus porch posts carrying a 2-block gable overhang.
- A spruce-log A-frame with the logs parallel to the ridge, eave at door_y+2.
- A gable of horizontal logs with a cobblestone apex.
- Trapdoor shutters on the windows.
- A campfire chimney with a stair crown.
- A trapdoor-edged flower bed.
- Mossify 10%.

```js
// Taiga cabin, Mojang style (taiga_small_house_1 / taiga_medium_house_4 vocabulary)
function ruleProcessor(b, kit, from, to, p, seed = 0) {
  const id = from.includes(':') ? from : `minecraft:${from}`
  b.map((x, y, z, blk) => (blk.name === id && kit.noise.hash01(x, y, z, seed) < p ? to : null))
}
export default function build(api) {
  const { kit } = api
  const b = api.builder([15, 13, 19], { seed: 5 })
  const X0 = 3, X1 = 11, Z0 = 5, Z1 = 13          // wall lines 9 x 9; ridge runs along z
  b.box([0, 0, 0], [14, 0, 18], 'grass_block')
  b.box([X0, 1, Z0], [X1, 1, Z1], 'cobblestone')                     // floor course
  b.box([X0 + 1, 1, Z0 + 1], [X1 - 1, 1, Z1 - 1], 'spruce_planks')  // floor
  b.walls([X0, 2, Z0], [X1, 4, Z1], 'cobblestone')                    // 3-high cobblestone walls
  // corner posts, plus porch posts 1 block in front of both gable walls (carry the 2-block roof overhang)
  for (const x of [X0, X1]) for (const z of [Z0 - 1, Z0, Z1, Z1 + 1]) b.box([x, 1, z], [x, 4, z], 'spruce_log[axis=y]')
  // log A-frame: rows of spruce_log laid PARALLEL to the ridge (axis z), 45 degrees, eave at door_y + 2
  const eaveY = 4, zA = Z0 - 2, zB = Z1 + 2
  const half = (X1 - X0 + 2) / 2                                     // 5 rows each side, odd span -> 1 ridge log
  for (let i = 0; i <= half; i++) {
    for (const x of new Set([X0 - 1 + i, X1 + 1 - i])) b.box([x, eaveY + i, zA], [x, eaveY + i, zB], 'spruce_log[axis=z]')
  }
  // gable walls: horizontal logs (axis x) under the roof, cobblestone apex, one window
  for (const z of [Z0, Z1]) {
    for (let y = eaveY + 1; y <= eaveY + half - 1; y++) {
      const i = y - eaveY
      for (let x = X0 + i; x <= X1 - i; x++) b.set(x, y, z, y >= eaveY + half - 1 ? 'cobblestone' : 'spruce_log[axis=x]')
    }
    b.set(7, 6, z, 'glass_pane')
  }
  // 1x1 windows at eye level on the side walls, open-trapdoor shutters (no sill)
  for (const z of [7, 11]) {
    b.window([X0, 3, z], 'west', { width: 1, height: 1, material: 'spruce', shutters: true, sill: false })
    b.window([X1, 3, z], 'east', { width: 1, height: 1, material: 'spruce', shutters: true, sill: false })
  }
  // door in the south gable, stair doorstep, cobblestone-wall + torch lamp posts, torch above the door
  b.door([7, 2, Z1], 'south', { material: 'spruce' })
  b.set(7, 1, Z1 + 1, 'cobblestone_stairs[facing=north,half=bottom]')
  for (const x of [5, 9]) { b.set(x, 1, Z1 + 2, 'cobblestone_wall'); b.set(x, 2, Z1 + 2, 'torch') }
  b.set(7, 4, Z1 + 1, 'wall_torch[facing=south]')
  // chimney: cobblestone flue with a lit campfire inside and a crown of stairs rising toward the flue
  b.chimney([10, 2, 7], 9, { paint: 'cobblestone', cap: null, smoke: true })
  for (const [dx, dz, f] of [[-1, 0, 'east'], [1, 0, 'west'], [0, -1, 'south'], [0, 1, 'north']]) b.set(10 + dx, 10, 7 + dz, `cobblestone_stairs[facing=${f},half=bottom]`)
  // interior: furnace boxed by open trapdoors (stove), bed, torches at eye level
  b.set(5, 2, 7, 'furnace[facing=east]')
  b.set(5, 2, 6, 'spruce_trapdoor[facing=north,open=true]'); b.set(5, 2, 8, 'spruce_trapdoor[facing=south,open=true]')
  b.set(9, 2, 11, 'purple_bed[part=foot,facing=north]'); b.set(9, 2, 10, 'purple_bed[part=head,facing=north]')
  b.set(X0 + 1, 3, 9, 'wall_torch[facing=east]'); b.set(X1 - 1, 3, 9, 'wall_torch[facing=west]')
  // garden: raised bed of grass with a poppy and ferns, bordered by open trapdoors leaning on it
  for (let x = 2; x <= 4; x++) {
    b.set(x, 1, 16, 'grass_block'); b.set(x, 2, 16, x === 3 ? 'poppy' : 'fern')
    b.set(x, 1, 17, 'spruce_trapdoor[facing=south,open=true]')
  }
  b.set(1, 1, 16, 'spruce_trapdoor[facing=west,open=true]'); b.set(5, 1, 16, 'spruce_trapdoor[facing=east,open=true]')
  b.box([6, 0, Z1 + 2], [8, 0, 18], 'dirt_path')
  ruleProcessor(b, kit, 'cobblestone', 'mossy_cobblestone', 0.10, 11)   // mossify_10_percent
  return b.finish({ name: 'vanilla-taiga-house' })
}
```

### 9.3 Desert adobe

Elements:
- A smooth-sandstone box on a cut-sandstone base ring, with cut-sandstone corners.
- A flat roof with a slab parapet and double-slab corners.
- Jungle-button vigas at the roof line.
- Unglazed niches with potted cactus under top-slab lintels.
- An exterior roof stair.

```js
// Desert adobe, Mojang style: smooth sandstone box on a cut-sandstone base ring, flat roof with a
// slab parapet (double-slab corners), jungle-button vigas at the roof line, unglazed niches.
export default function build(api) {
  const b = api.builder([13, 9, 13], { seed: 2 })
  const X0 = 3, X1 = 9, Z0 = 3, Z1 = 9, TOP = 4                    // walls y=1..4, roof slab y=5
  b.box([0, 0, 0], [12, 0, 12], 'sand')
  b.box([X0, 0, Z0], [X1, 0, Z1], 'cut_sandstone')                  // base ring / floor course
  b.box([X0 + 1, 0, Z0 + 1], [X1 - 1, 0, Z1 - 1], 'smooth_sandstone')
  b.walls([X0, 1, Z0], [X1, TOP, Z1], 'smooth_sandstone')
  b.box([X0, TOP + 1, Z0], [X1, TOP + 1, Z1], 'smooth_sandstone')   // flat roof slab
  for (const [x, z] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) b.box([x, 1, z], [x, TOP + 1, z], 'cut_sandstone')  // corner trim
  // parapet: bottom slabs on the roof edge, double slabs on the corners
  for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) {
    if (x !== X0 && x !== X1 && z !== Z0 && z !== Z1) continue
    const corner = (x === X0 || x === X1) && (z === Z0 || z === Z1)
    b.set(x, TOP + 2, z, `smooth_sandstone_slab[type=${corner ? 'double' : 'bottom'}]`)
  }
  // vigas: a jungle button on every exterior wall block at the roof line (y = TOP)
  for (let i = X0; i <= X1; i++) { b.set(i, TOP, Z0 - 1, 'jungle_button[face=wall,facing=north]'); b.set(i, TOP, Z1 + 1, 'jungle_button[face=wall,facing=south]') }
  for (let i = Z0; i <= Z1; i++) { b.set(X0 - 1, TOP, i, 'jungle_button[face=wall,facing=west]'); b.set(X1 + 1, TOP, i, 'jungle_button[face=wall,facing=east]') }
  // unglazed niches: potted cactus in the opening, top-slab lintel above
  for (const [x, z] of [[X0, 5], [X0, 7], [X1, 6], [5, Z0], [7, Z0]]) {
    b.set(x, 2, z, 'potted_cactus'); b.set(x, 3, z, 'sandstone_slab[type=top]')
  }
  // jungle door, wall torch beside the door
  b.door([6, 1, Z1], 'south', { material: 'jungle' })
  b.set(7, 2, Z1 + 1, 'wall_torch[facing=south]')
  // roof access stair along the east wall, hay bale on the sand
  for (let i = 0; i < 4; i++) b.set(X1 + 1, 1 + i, Z1 - 1 - i, 'smooth_sandstone_stairs[facing=north,half=bottom]')
  for (let i = 0; i < 3; i++) b.box([X1 + 1, 1, Z1 - 2 - i], [X1 + 1, i + 1, Z1 - 2 - i], 'smooth_sandstone')
  b.set(1, 1, 10, 'hay_block')
  return b.finish({ name: 'vanilla-desert-house' })
}
```

### 9.4 Style moves not in the recipes

- **Savanna:**
  - 5x5 walls with no corner blocks.
  - Acacia log posts with yellow, orange or red terracotta panels.
  - 1x1 windows framed by `acacia_wood` with a flipped axis.
  - `ringRoof(..., { rings: 2 })` from section 4.
  - A lean-to canopy of acacia slabs on fences, with `brown_wall_banner`s hanging from its edge.
  - Terracotta totems: 2 orange blocks topped by 1 yellow, with a banner.
- **Snowy:**
  - Stripped spruce posts every 2 with single panes between (`post|pane|post|pane`).
  - A toothed band at the upper floor line (`spruce_slab[type=top]` alternating with
    `spruce_planks`), then the upper floor 1 block proud.
  - Stepped plank roof with `snow[layers=1]` on every tread, no overhang.
  - `b.hangingLantern` under fences.
  - Snow layers 1-8 drifted against the walls.
- **Outpost:**
  - Octagonal plan.
  - Dark-oak log posts at the vertices.
  - A joist-end band (`dark_oak_planks` alternating with logs pointing out of the wall) at each
    floor line.
  - A deck 2 blocks wider than the shaft on mixed cobblestone and dark-oak upside-down stair
    corbels.
  - A birch deck with a log rim, fence railing and `cobblestone_wall` corner posts.
  - A stepped octagonal plank roof on 4 log columns.
- **Mansion façade:**
  - Dark oak plank walls on a cobblestone plinth, with a cobblestone string course at every floor
    line.
  - A frieze of end-grain dark-oak logs one block above each floor.
  - 3x4 pane grids framed by logs pointing out of the wall, under a log hood, with a
    cobblestone-wall balustrade below.
  - `ringRoof(..., { material: 'dark_oak', rings: 3, field: 'planks' })` on a cobblestone cornice.
- **End city:**
  - End stone brick panels between `purpur_pillar` posts.
  - A purpur block band at each floor line.
  - Roof plates overhanging 2, edged with upside-down purpur stairs.
  - 1x3 magenta glass slits.
  - End rods on plate corners.

## Sources

- Minecraft Java 1.21.1 client jar, `data/minecraft/structure/**`: all 1,180 templates (villages,
  pillager outpost, woodland mansion, trial chambers, ancient city, end city, bastion, igloo,
  shipwreck, trail ruins, ruined portal, underwater ruin).
- Same jar, `data/minecraft/worldgen/processor_list/*.json`: aging rules (section 8).
- Same jar, `data/minecraft/worldgen/template_pool/**`: pool weights, empty plots, which processor
  each piece gets.
- Same jar, `data/minecraft/tags/block/ancient_city_replaceable.json`: blocks eligible for rot.
- Analysis method: jigsaw blocks resolved to `final_state`; role palettes from an outside-air flood
  fill; per-material exposure (top, side, bottom, hidden); stair-context, overhang, floor-height
  and light-spacing scans; cutaway renders of 138 pieces.
