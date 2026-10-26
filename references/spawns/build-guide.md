# Building a spawn by hand: the guide

You build every spawn yourself: you plan it from the interview, write its recipe (`spawn.mjs`),
build it, look at it, and fix it until it is great. This guide holds everything the spawn generator
"knew" — the layouts, the numbers, the parts and the rules — so your spawn can be just as good, and
then better, because you can do whatever the user asks (a winter version, more buildings, a statue
of their mascot, a different layout).

Read with it:
- `assets/examples/spawns/` (copied into every spawn folder as `examples/`): complete spawns,
  commented as teaching material. Read the one closest to your brief before you write.
- `assets/spawn-parts/` (copied as `parts/`): the parts. Each file starts with a header that lists
  its functions and options. They are yours to edit in your spawn folder.
- `references/spawns/README.md`: the spawn handbook (program, measured numbers, the don't-look-AI
  checklist). `references/building/README.md`: the building handbook (any structure you write).
- `references/kit-api.md`: the kit (`b.box`, `b.roof`, `b.tree`, `b.sign`, `b.npcSpot`...).

| Example | Type | Shows |
| --- | --- | --- |
| `ember-smp.mjs` | normal, round plaza, autumn, 220 | NPC rings on plinths, trees in grass beds, open-air boards + podium, top-3 pillars, crate arc, RTP gate, PvP ruin, a ring of big buildings, raised areas, rocks |
| `frost-smp.mjs` | normal, square plaza, winter, 180 | NPC lines along an aisle, a hand-written hero (a decorated spruce), cabins round a square, an AFK pond, `snowfall` |
| `oakhaven-hub.mjs` | spawn+ town, medieval, 192 | ring road, lot bands, a building per NPC, hero wall with the name in quartz letters, crate yard with a CRATES sign, corner gardens, stalls |
| `kirin-practice.mjs` | PvP lobby, japanese, 112 | spawn dais, queue NPCs on pedestals in an arc, boards with top-3 pillars, FFA arena, pavilion and pagoda |
| `pirate-isle.mjs` | normal + warzone, tropical | landmarks (volcano, ship, lighthouse, giant palms, statue), a warzone band with a moshpit and a KOTH hill, colourful block-letter signs |

## 1. The workflow

1. **Interview** (SKILL.md): type, size, NPCs, theme, then the program, then the options.
2. **Plan on paper first.** Write `brief.md`: the answers, then a top-view sketch with the main
   coordinates (the plaza radius, the rings, where each section goes, the canvas size). Most bad
   spawns are bad plans; fixing a plan costs nothing.
3. **`new_spawn`** makes the folder (`spawn.mjs` skeleton, `parts/`, `examples/`, `brief.md`).
4. **Write `spawn.mjs` in sections, building after each one** (`build_recipe`): site and plaza →
   NPCs, boards, crates → buildings → set pieces and planting → seasons/details. Look at what it
   returns (the overview and the spawn-point screenshot) every time, and take more screenshots of
   whatever you just built.
5. **Critique** (§10) and fix, at least two rounds after it is "done". The `spawn-critic` agent
   gives a second opinion.
6. **Deliver**: `build_recipe` with `export: true`, the setup sheet, the screenshots.

## 2. The canvas and the frame

```js
const ctx = startSpawn(api, { name, size, height, theme, accent, setting, seed })
// ... plan, buildSite, build ...
return finishSpawn(ctx)          // cleanup, the 'spawn' safe region, spawn-proofing, finish()
```

- **Coordinates:** `x` east, `y` up, `z` south. `C = [cx, cz]` is the middle; `FY` the plaza floor
  block (players stand at `FY + 1`). Angles round the middle with `polar(ctx, angle, r)`: 0 = north
  (the way players face on spawn), 90 east, 180 south, 270 west.
- **`facing`** everywhere = the side the player stands on: an NPC looks that way, a sign reads from
  there, a crate opens to it, a building's door is on it. `facingToward([x, z], C)` points a thing
  at the spawn; `yawToward` gives the NPC's exact yaw.
- **Size** (blocks across, square): the plaza and its rings set it. Normal spawns 180-260 (a 40-45
  radius plaza, a ring of buildings, ~60 of countryside), spawn+ 160-320 (the town plus ~40 each
  side), PvP lobbies 90-140. Add the warzone band twice (2 x 40-120). Bigger is slower: 220 builds in
  ~25 s, 330 with a warzone in ~60 s.
- **Height:** 90-110. `FY` defaults to about a third up (room for the island's underside below).
- **Themes:** `autumn`, `medieval`, `white-town`, `japanese`, `winter`, `fantasy`, `crimson`,
  `tropical` (§8). **Accent:** one dye colour, never gold.
- **Settings** (`buildSite`): `plains` (flat, most normal spawns), `island` (gentle rolling),
  `valley` (hills round the rim), `mountain` (a ridge north-west behind the hero), `coast` (a lake
  cove south-east). Every setting is a floating island, so it pastes into a void world or the sky.

## 3. Planning: the grid, pads and the order of work

Plan everything before placing a block, in this order: the plaza → the spawn point → the
gameplay places (NPCs, boards, crates, gates, arenas) → the buildings → set pieces → raised areas
and rocks in what is left.

- **Reserve every footprint** on `ctx.grid` (`reserve(x0, z0, x1, z1, tag, pad)`, `reserveDisc`),
  so later places and the woodland keep off it; test with `grid.free(...)` / `grid.freeDisc(...)`.
  `findSpot(ctx, { r, ring: [r0, r1] })` finds and reserves room for anything round.
- **Pads:** every building and set piece gets a level pad `{ x0, z0, x1, z1, y: FY, blend: 5 }`
  passed to `buildSite`, so it stands on flat ground that blends back into the land.
- **Keep it on the island:** every corner of a slot at least 6-8 blocks inside the shore
  (`S / 2 - 3` from the middle on a round island). Check corners with `Math.hypot`.
- **Keep the corridors free:** reserve the four walks out (5 wide) before the buildings.
- **Flat town:** pass `flat: (x, z) => ...` so the town is level and only the rim rolls. Real spawns
  are flat where people walk.
- `ctx.layout.plaza` must hold the plaza (`{ cx, cz, r }` or a rectangle): the landscape keeps the
  woodland back from it.

Then build in this order: `buildSite` → paving → spawn point → NPCs/boards/crates/gates →
buildings (then the walks from their doors) → set pieces, rocks, trees, props → `landscapePass` →
seasonal passes → `finishSpawn`.

## 4. Layouts that work

### 4a. Normal spawn, round plaza (FreshSMP-style; `ember-smp.mjs`)

A big flat plaza with the NPCs on 1-block plinths in rings round the spawn, trees in grass beds,
the boards and crates in the open on the plaza, big buildings all round it.

| Piece | Number |
| --- | --- |
| Inner NPC ring | r 12, NPCs 6 apart along it, broken by 4 path mouths 9 wide (6 NPCs fit) |
| Outer NPC ring | r 22 (more if needed: r = n x 6 / (2 pi x 0.69)), skipping the boards' (north, 44 degrees each side) and crates' sectors |
| Plaza | radius Rp = max(40, R2 + 14); kerb in the border block; a 5-wide street ring to Rp + 5 |
| Paving rings | the rose r 0-1.5 (chiseled quartz) and 1.5-3.5 (smooth quartz), a border ring 3.5-4.6, inlay 7.4-8.4, a border band under each NPC ring (r +- 1.6), inlay at Rp - 9 |
| Feature trees | 4, on the diagonals between the rings (+- 6 degrees, not exact), in grass beds r 4, crowns <= 8 radius, <= 16 tall |
| Leaderboards | `boardsPlaza` 6 in from the rim, north, facing south, boards 7 apart, a top-3 podium in front of the middle one |
| Top-3 pillars | either side of the boards at +-34 degrees, 6 in from the rim, facing the spawn |
| Crates | an arc 6 in from the rim, west, 6 apart along the arc, each facing the spawn |
| RTP gate | on the south axis just outside the plaza (`b.portal`, 5 wide opening) |
| PvP ruin | east, beyond the street: `pvpArena` 28 x 28 with its red line and region |
| Buildings | a ring from Rp + 7 out, facing the plaza: every 3rd a hall (19-23 x 13-15), now and then a tower (9 x 9, never two side by side), houses 13-15 x 11-13, 2-3 storeys; step on by width + 4; cottages (1 storey) further out where there is room |
| Size | 2 x (Rp + 70): 220 for up to ~14 NPCs |

### 4b. Normal spawn, square plaza (`frost-smp.mjs`)

A 61-square plaza on a cross of avenues, the NPCs in two lines either side of a central aisle (6
apart, 9 off the axis), the hero 19 north of the spawn on the axis, the boards on one side and the
crates on the other, cabins in a square ring outside the street. Few, long, straight inlay lines
(the aisle, a frame 16 out); dotted or scattered inlay reads as noise.

### 4c. Spawn+ town (DonutSMP-style; `oakhaven-hub.mjs`)

A square hub plaza (P) with a ring road (5) and a band of lots (16 deep) round it; every NPC gets its
own building facing the road.

- Each side has a centre piece: north the hero wall (boards + the name), west the crate yard, south
  the RTP gate, east the spoke road to the PvP arena. Lots either side, 11-15 wide, 2-4 apart,
  11-13 deep, 1-2 back from the road. Halls on the four corners with forecourts.
- P grows until every NPC has a lot (14 NPCs → P 70). The town is P + 10 + 32 across; add ~40 each
  side for the arena, the AFK park and woodland.
- The first NPCs (shop, auction) get the north corner halls, then the north lots (the first view),
  then west/east, then south. Spare lots become houses.
- Dress the plaza: quarter-round gardens in the corners (a feature tree, flowers, a bench facing
  the rose, a lamp), market stalls along the sides, planters on the rose's diagonals, a rose ring
  (r ~28) round the spawn with cross walks to the road.

### 4d. PvP lobby (`kirin-practice.mjs`)

A raised round spawn dais (r 4, stair skirt) facing north; the queue NPCs on pedestals in a
150-degree arc (radius Rn = max(11, 7N x 180 / (pi x 150)), 7 apart), the plaza Rp = Rn + 5; the
boards 5 behind the plaza rim with top-3 pillars either side; the FFA arena south behind its red
line; crates west; a store pavilion and a tower east.

### 4e. Compose your own

Mix them: a round plaza with a spawn+ ring of shops, a warzone round any of them, a town on a
mountain terrace. Keep the rules: one hero on the spawn's axis, everything important within 15-25
blocks of the spawn (25-75 for a town), places that face the spawn, corridors out, nothing mirrored
exactly, ≤ 3 identical modules in one view.

## 5. The parts, place by place

Every part takes `ctx` first; positions are ground block levels (things start at `y + 1`).

### The spawn point and the first view
`b.spawnPoint([x, FY, z], 'north')` exactly once. Stand there in a screenshot: the hero 20-45 blocks
out on the axis, filling a quarter to a half of the frame height, sky behind it; nothing above eye
level in the middle; NPCs and the way on visible.

### NPCs
- Plinths in rings (normal spawns): `ringPoints(ctx, { r, n, skips })` then
  `npcPlinth(ctx, npc, [x, z])` (quartz plinth, stair skirt, faces the spawn).
- Pedestals, alcoves, booths, kiosks (fewer, more important NPCs): `b.npcSpot(pos, facing,
  { ...ctx.M, ...npc, style: 'pedestal' | 'alcove' | 'booth' | 'kiosk', size: 3 })`.
- In their own building (spawn+): `building(ctx, { kind: 'shop' | 'hall' | 'house', ..., npc })`.
- NPCs 4-7 apart, 2 blocks clear in front, 3 of air above (the hologram). An NPC is `{ id, label }`.

### Leaderboards and top 3
- `boardsPlaza(ctx, { cx, z, facing, boards })`: hologram boards over low lit plinths with a top-3
  podium (statues) in front of the middle one. Open air: the normal-spawn way.
- `heroWall(ctx, { x0, x1, z0, z1, y, cx, z, width, facing, boards, name })`: boards set into a
  themed wall with towers, the server name in quartz letters on it (spawn+ hero).
- `b.leaderboards(pos, facing, { count, labels, podium })`: the kit's framed board wall.
- `top3Pillars(ctx, { x, z, facing, id, label })`: 2nd / 1st / 3rd columns (4 / 6 / 3 tall) with
  rank caps and statue NPCs, the title as a hologram. Put them beside the boards.

### Crates
- `crateCourt(ctx, { points, facings, crates })`: crates on carved plinths at the points you give
  (an arc, a row). Open air: the normal-spawn way (real normal spawns never put crates in a hall).
- `crateYard(ctx, { x0, z0, x1, z1, facing, crates }, { hedge, lamp })`: a paved yard with a hedge
  and lamps, crates in a row facing its open side (spawn+, PvP).
- Crates ≥ 5-6 apart (their holograms are ~5 wide), 3 x 3 clear in front, open sky above.
  A crate is `{ id, label, tier }`; tiers vote, common, uncommon, rare, epic, legendary, mythic,
  seasonal pick the plinth colour and the chest.

### Gates, arenas, AFK
- `b.portal([x0, y0, z], [x1, y1, z], { ...ctx.M, id: 'rtp', label, kind: 'rtp' | 'warp' | 'pvp' | 'nether', facing })`
- `pvpArena(ctx, { x0, z0, x1, z1, y, entrance })`: a ruined colonnade behind a red line with a
  rules hologram; add `b.region('pvp', min, max, { pvp: 'allow', priority: 20 })`.
- `afkPark(ctx, { x0, z0, x1, z1, y })`: a garden pool (~17 x 17) with its region.

### Buildings
`building(ctx, { kind, x0, z0, x1, z1, y: FY, facing, seed, storeys, npc })` → `{ door, bounds }`.
Kinds and footprints (w along the street x d): house 7-15 x 7-13, shop 7-15 x 7-13 (counter and
awning), hall 13-27 x 11-21 (entrance pavilion, grand door, corner tower), tower 5-9 square,
arcade 7-13 x 9-40, pavilion 7-15 square. Each theme has its own wall system, roof and dressing;
the seed varies plan, roof, porch, chimney and windows, so neighbours are siblings, not clones.
Pave a walk from each `door` to the street. Vary sizes, storeys and set-backs along a street.

### Trees, planting, props
- `featureTree(ctx, [x, y, z], { size: 'large' | 'medium' | 'small', style, seed, maxRadius, maxHeight })`:
  hand-shaped trees (styles autumn, oak, cherry, snowy_spruce, spruce, blossom, pine, birch,
  dark_oak, azalea, palm), with dressed ground. `grassBed(ctx, x, z, r)` for a tree in the paving.
- `planter`, `bushAt`, `hedge`, `rockOutcrop`, `bambooClump`, `stoneLantern`, `torii` (japanese).
- `lamp(ctx, [x, y, z], { kind: 'post' | 'wall' | 'hanging' })` every ~12-13 along streets, at
  corners and gates, never in a path mouth. `bench`, `stall`, `fountain`, `well`,
  `clutter(ctx, pos, 'barrels' | 'crates' | 'hay' | 'logs' | 'cart' | 'firewood' | 'pots')` by doors.
- `landscapePass(ctx)` LAST (before seasons): woodland on every free column (densest at the rim and
  on hills, low in front of features), bushes, rocks, flower drifts, theme details, the island's
  rim and underside.

### Paving and terrain
- `paveRound(ctx, { cx, cz, r, rings, kerb, field, wobble })`, `paveRect(ctx, { x0, z0, x1, z1, border, field, corner })`,
  `pavePath(ctx, points, { width, fray })` (walks follow the ground, frayed edges).
- Floors: one field material ≥ 70%, borders and inlays every 7-12 blocks that point at exits, no
  plain patch over 16 x 16, level changes and planters, never per-block random speckle.
- **Raised areas:** `buildSite(ctx, { mounds: [{ x, z, r: 8-14, h: 1-4 }] })` — smooth rises for
  empty ground, a tree on the bigger ones. **Rocks:** `rockOutcrop(ctx, [x, gy, z], { r: 1.8-3.2 })`
  here and there (find room with `findSpot`).

### Landmarks (big set pieces round the spawn)
`landmark(ctx, kind, { x, z, y, seed, facing })` → `{ r, top }`; kinds (ground radius r, height):
volcano (26, ~32: a crater with a contained lava pool, magma rivulets, smoke), lighthouse (8, ~36:
striped in `stripe`, gallery, lantern room), ship (22: a galleon or `kind: 'sloop'` moored in its own
basin, broadside to `facing`, with a jetty), statue (9, ~20: `subject: 'parrot'` or `'knight'`),
giant-tree (16, ~30: the theme's tree with buttress roots; a giant palm for tropical), giant-palm
(12, ~25), rock-spires (10, ~28), rock-arch (12, ~14: you look through it from `facing`). All of them
side by side: `assets/examples/spawn-parts/landmarks.mjs`. Place them with
`findSpot(ctx, { r: LANDMARKS[kind].r + 3, ring: [Rp + 9, S / 2 - r - 8] })` before the
buildings so the town fills round them; `facing` toward the spawn; level a pad under them. 1-3
landmarks per spawn, on the sightlines from the plaza (diagonals behind the building ring), never
on the spawn's axis in front of the hero. `palmTree(ctx, [x, y, z], { height, lean })` for palms.

### Warzone (PvP band round the spawn)
The canvas is the spawn square plus a band of width W (40-120) all round:
`size = spawnSize + 2W`, the spawn square `[W, W, W + spawnSize - 1, W + spawnSize - 1]`, the site
`shape: 'square'`. Then `warzoneBand(ctx, { spawn, label })` (red concrete line 2 wide just outside
the spawn square, the corridors continued, holograms at the crossings, cover: broken walls,
boulders, a few trees), `moshpit(ctx, [x, z], { r: 8-12 })` (a terraced sunken pit, region),
`koth(ctx, [x, z])` (a stepped hill with a capture zone, region), and
`b.region('warzone', [0, 0, 0], [S - 1, H - 1, S - 1], { pvp: 'allow', priority: 5 })`;
`finishSpawn(ctx, { safeZone: spawnSquare })`. The usual places: the moshpit in the middle of
the band north-west, the KOTH in the band south. Plan both before the band (pass them as
`keepClear`).

### Block-letter signs (optional, off unless asked)
Real spawns label with holograms; letters are for the server name and at most 2-3 titles (CRATES,
LEADERBOARDS or TOP, PVP). `signStand(ctx, text, [x, z], facing, { style, outline, thick })`:
style `slim` (small quartz letters smoothed with stairs: short), `classic` (5-tall quartz with
stair bevels on a dark board), `colorful` (accent concrete letters outlined in terracotta);
`outline` true/false; `thick` (bold) true/false; each `'auto'` picks for the theme. `posts: false`
to set it against your own wall. Letters ≥ viewing distance / 12 tall, ≥ 30 L* contrast to the board.

### Holograms, regions, safety
- `ctx.hologram(id, text, [x, y, z])` for free-standing text (rules, district names): it goes into
  setup.md. NPC, crate and board holograms are recorded by their parts.
- `b.region(id, min, max, flags)` for every PvP or AFK zone (priority above the spawn's 10).
- `finishSpawn` spawn-proofs (invisible light in dark walkable cells) and adds the safe region.

## 6. Writing your own structures

Anything the parts don't have, you build: the server's mascot statue, a fountain shaped like their
logo, a portal hall, a Christmas tree (`frost-smp.mjs` → `christmasTree`). Write a function
`myThing(ctx, { x, z, ... })` in `spawn.mjs` (or a new file in `parts/`), with plain loops over
`b.set`, and the kit's shapes: `b.box`, `b.cylinder`, `b.sphere`, `b.roof`, `b.window`, `b.door`,
`b.stairway`, `b.boulder`, `b.hull` (ships), `b.figure` (statues), `b.texture`, `kit.palette`
(clumped material mixes) — see `references/kit-api.md`, and `references/building/` for the craft
(proportions, depth, palettes, roofs, sculpting). Rules that keep it human:

- Silhouette first: render it from 3 sides before adding detail.
- 3-5 shades per material in clumps (`kit.palette` with a scale), partial blocks (stairs, slabs,
  walls, trapdoors) for 16-28% of the visible blocks, ~half the stairs upside down (eaves, sills).
- Depth: nothing flat — reveals, overhangs, a base course, a cornice.
- Light it with hidden sources (shroomlight in leaves, lights under slabs, lanterns).
- Reserve its footprint and give it a pad.

To change how a part looks for this spawn only, edit your copy in `parts/` (e.g. a different
plinth block in `plaza.mjs`, snow on a roof in `buildings.mjs`); the change stays in this spawn.

## 7. Doing what the user asks

| Request | How |
| --- | --- |
| "Make a winter version" | theme `winter` (log cabins, snowy spruces, snowy roofs), then `snowfall(ctx)` last; frozen ponds come with it; red or blue accent; a decorated hero tree or an ice sculpture |
| "Autumn feel" | theme `autumn`, `leafLitter(ctx)` after `landscapePass`, pumpkins by doors |
| "Tropical / pirate" | theme `tropical`, palms, sand, `landmark` ship / lighthouse / volcano / giant-palm, the setting `coast` |
| "Add more stuff" | find free ground with `findSpot` or `grid.free`, then add: landmarks, a fountain, market stalls, a well, statues, planters, a second tree ring, a small garden; keep the plaza readable and the corridors free |
| "Bigger" | raise `size` and Rp, add a second building ring or cottages further out, more woodland |
| "More NPCs" | a second/third ring (normal), more lots (spawn+), a wider arc (PvP) |
| "A different layout" | the closest example's ideas, re-planned: write the new sketch in brief.md first |
| "Their logo / mascot" | a hand-written statue (§6) on the axis as the hero, 15-30 tall, 3-5 shades |
| "Signs on the sections" | `signStand` with the style they picked (§5) |
| "A warzone / moshpit / KOTH" | §5 Warzone: enlarge the canvas by 2W first |

## 8. Themes

| Theme | Look | Default setting |
| --- | --- | --- |
| autumn | stone bricks, spruce timber, dark-oak roofs, red/orange/yellow feature trees, orange accent | island |
| medieval | stone and plaster with dark timber, deepslate tile roofs, oak and birch, red accent | valley |
| white-town | smooth quartz, dark deepslate frames, blue accent | coast |
| japanese | white plaster, dark oak, deepslate roofs with East-Asian eaves, cherry and pine, red accent | island |
| winter | log cabins, snowy roofs, snowy spruces, red accent | mountain |
| fantasy | calcite, birch, prismarine roofs, blossom trees, purple accent | island |
| crimson | blackstone, crimson wood, nether bricks, crimson fungi trees, red accent (lifesteal) | island |
| tropical | sand and grass, light wood huts, palms, light blue accent | coast |

A look that is not in the list (desert, candy, ocean, sci-fi): pass a theme object to `startSpawn`
built from the closest theme with your overrides (every role is listed at the top of
`parts/themes.mjs`), and dress it with your own structures. Tell the user which theme you started
from.

## 9. Testing: look, then fix

After every section:
1. `build_recipe` on `spawn.mjs`: `problems: []`, `clipped: 0`, and read every warning (a
   "must stay clear" warning means something blocks an NPC or a crate; a part that failed is
   logged as `spawn: <part> failed`).
2. Look at the overview and the spawn-point screenshot it returns.
3. `screenshot` for what you just built, like a player standing there. Each shot is
   `{ name, pos: [x, z] }` (stands on the ground at that column; `[x, y, z]` = the feet block) with
   `lookAt: [x, y, z]` or `yaw`/`pitch` (yaw 0 south, 90 west, 180 north, -90 east; pitch > 0 looks
   down), `{ spawn: true }` for the join view, or `{ eye: [x, y, z], yaw, pitch }` for a camera in
   the air (over the plaza: 40 up, 60 back, pitch 30-35). A good set per pass: the spawn view; in
   front of the crates looking at them; at the boards; the plaza rim looking back at the spawn; the
   gate looking out; one high view. Scripts:
   `node scripts/screenshot.mjs <build.nbt> --shots '[{"name":"crates","pos":[80,110],"lookAt":[70,36,110]}]'`.
   `render_build` gives isometric close-ups from above (`px` 6-8, `box` round the area, `ymin` to
   cut away the island underneath) and the other corners.
4. `inspect_build` (`checks`) before delivering: floating blocks, plants on stone, fluids.

What to check in every picture:
- The first view: hero on the axis, framed, sky behind it, NPCs visible, the way out visible.
- Every NPC, crate and board readable and reachable, nothing in front of them, no tree over them.
- No floating or buried pieces, no building cut by a path, no tree in a doorway.
- The floor: structured, not speckled; not one big plain patch.
- Variety: no two identical neighbours, no exact mirror, 3 height tiers.
- The rim: the town meets the land with planting and steps, the island's edge is natural.

| Problem | Fix |
| --- | --- |
| A part warns "failed" | read the message; usually a slot off the canvas or a missing option |
| Buildings overlap or sit in the woods | reserve every slot on the grid and pass its pad |
| Something floats at the shore | keep slots 8 inside the shore; give set pieces a pad |
| The plaza looks empty | add a second ring, planters, benches, a fountain, inlay lines |
| The plaza looks crowded | widen the rings (r + 2), drop props, keep the corridors 9 wide |
| Trees cover NPCs or boards | lower `maxRadius`/`maxHeight`, move the tree bed 2-3 off the line |
| Everything looks the same | vary sizes, storeys, set-backs and seeds; break symmetry on purpose |

## 10. Delivery

`build_recipe` with `export: true` (and `origin` / `world` when the user gave the paste corner)
writes `.schem` (WorldEdit/FAWE), `.litematic` (Litematica) and `.setup.md` (the world spawn, the
NPC, hologram, crate and region commands). Send them with 3-4 screenshots (the spawn view, the
overview, the main sections) and say the paste corner and the world spawn.
