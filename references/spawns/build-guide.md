# The spawn manual: building a server spawn by hand

This is everything you need to build a server spawn, hub or PvP lobby that a server owner is proud of:
what makes one great, the workflow, the templates and how to change them safely, every part with its
numbers, tested code for the things users ask for, how to look at your build like a player, and how
to deliver it. The spawn generator's knowledge is written down here and in the templates, so your
spawn starts at the generator's quality. Your own judgement and the user's wishes take it further.

**How to read it.** The first time, read §1-§4 and the template you are starting from (`spawn.mjs` in
your spawn folder). After that, use it as a reference: §8 (the cookbook) maps every common request
to the change it needs, §10 is the looking-and-fixing loop, §12 is delivery. Each section starts with
what you need most.

| § | Section | Use it when |
| --- | --- | --- |
| 1 | What a great spawn is | planning, judging screenshots |
| 2 | The workflow, step by step | always: the order of work |
| 3 | Coordinates, angles and facing | writing any position or direction |
| 4 | Working in a template: the BRIEF and the CUSTOM block | every spawn |
| 5 | Layouts and their numbers | planning, or a layout the templates do not have |
| 6 | The parts, place by place | looking up a function and its options |
| 7 | Writing your own structures | anything the parts do not have |
| 8 | The cookbook: requests and their changes | "make it winter", "add more stuff", "move the crates"... |
| 9 | Themes, and making your own | the look |
| 10 | Looking at it: screenshots, critique, fixes | after every build |
| 11 | Troubleshooting | an error, a warning, a slow build |
| 12 | Delivery | the end |

Related files: `assets/examples/spawns/` (the templates and two hand-written showcases, copied into
every spawn folder as `examples/`), `assets/spawn-parts/` (the parts, copied as `parts/`: each file
starts with a header listing its functions), `references/spawns/README.md` (the spawn handbook: the
interview, the measured numbers, the don't-look-AI checklist), `references/kit-api.md` (the
building kit), `references/building/` (the building craft).

---

## 1. What a great spawn is

### 1.1 The first minute

A player joins and, in this order: sees the first view (the hero, the plaza), reads the NPC
holograms nearest them, walks to the crates or the boards, and leaves through the RTP gate or a
road. A great spawn makes each step obvious without a sign: the hero pulls the eye, the NPCs face
the player, the sections are in the open where they can be seen, and the way out is in the first
view. Everything below serves that minute.

### 1.2 The rules, with the numbers to hit

1. **The first view is the design.** From the spawn point (eye 1.62 above the floor, facing north):
   a frame close by (an arch, two trees, columns), the hero 20-45 blocks out on the axis filling a
   quarter to half of the frame height, open sky behind it, the NPCs and the way on visible.
   Nothing above eye level in the middle 30 degrees.
2. **One hero, three tiers.** One landmark (a monument, the boards' plaza, a gate, a big tree)
   1.5-2 times the height of what surrounds it, feature buildings at a third to a half of it, the NPC
   places at human scale.
3. **Short distances.** Core NPCs within 15-25 blocks of the spawn (a town: 25 to the plaza ring,
   75 to the farthest district). Nothing important more than ~12 seconds of sprint away
   (5.6 blocks/s).
4. **Places that work.** NPCs 4-7 apart, facing the spawn, 2 blocks clear in front, 3 of air above
   (the hologram). Crates at least 5-6 apart (their holograms are ~5 wide), 3 x 3 clear in front, open
   sky above. Boards with a 10-12 deep standing area in front.
5. **Shaped floors.** One field material for 70% or more, borders and inlays every 7-12 blocks that
   point at exits, no plain patch over 16 x 16, no per-block random speckle.
6. **Variety, not symmetry.** No exact mirror of the layout (keep the ceremonial axis symmetric, vary
   everything else), at most 3 identical modules in one view, neighbouring buildings as siblings, not
   clones (different sizes, storeys, set-backs, seeds).
7. **One accent, used sparingly.** The accent dye at 5% or less of what you see, as points and short
   runs. Never gold blocks as trim.
8. **Light by design.** Lamps every ~12-13 along streets, at corners and gates, never in a path
   mouth; hidden sources (under slabs, in leaves, behind glass). `finishSpawn` spawn-proofs the rest.
9. **A designed edge.** The town meets the land with planting, steps and set pieces; the island's
   shore and underside look natural. The PvP boundary is a visible red line.
10. **It looks hand-built.** Detail clustered at entrances and focal points, 30-50% of walls calm,
    partial blocks (stairs, slabs, walls) for 16-28% of what you see, trees that look grown.

### 1.3 The three types

| | Normal spawn (FreshSMP-like) | Spawn+ (DonutSMP-like) | PvP lobby |
| --- | --- | --- | --- |
| Template | `ember-smp` (`type: normal`) | `oakhaven-hub` (`type: plus`) | `kirin-practice` (`type: pvp`) |
| The idea | one big flat plaza, NPCs on plinths in rings round the spawn | a town round a square hub, every NPC its own building | a compact lobby, queue NPCs in an arc, an arena |
| Size | 180-260 (220 for ~14 NPCs) | 160-320 | 90-140 |
| NPCs | 5-20 | 10-30 | 4-10 |
| Boards, crates | in the open on the plaza: boards north, crates in an arc on one side | the hero wall north (boards and the name), a crate yard west | boards north behind the arc, a crate yard west |
| Way out | RTP gate south, four roads | RTP gate south, the spoke road east | the arena south |

---

## 2. The workflow, step by step

| Step | You do | Done when |
| --- | --- | --- |
| 1. Interview | ask in rounds with AskUserQuestion (SKILL.md) | you know type, size, NPCs, theme, program, options |
| 2. Plan | write the plan in `brief.md`, show it, ask "Build this?" | the user said yes |
| 3. Scaffold | `new_spawn` with the name and `type` | the folder exists |
| 4. Base | set the BRIEF block, `build_recipe` | `problems: []`, `clipped: 0`, no warnings, the images look right |
| 5. Make it theirs | the CUSTOM block, one change per build | everything they asked for is in |
| 6. Look and fix | screenshots from the player's spots (§10), two critique rounds | the §10.2 checklist passes |
| 7. Deliver | `build_recipe` with `export: true`, `origin`, `world` | they have the files and know how to paste them |

**1. Interview.** SKILL.md has the questions. Every answer becomes a BRIEF field or a CUSTOM piece:
keep a list of which, so nothing they said gets lost.

**2. Plan.** Write `brief.md`: the answers, what you decided for "Let Claude decide", the canvas size,
and a top-view sketch with the main numbers. Most bad spawns are bad plans, and a plan costs nothing
to change. For example:

```
CHEESE SMP: normal spawn, white town, accent blue, plains, 220 x 220 (10 NPCs)
NPCs (inner ring first, nearest north = first view): Shop, Auction House, Kits, Store, Quests,
  Sell, Warps, Events, Vote, Start Here
Boards north: Money, Kills, Playtime + podium. Top-3 sets: Top Spenders, Baltop
Crates west (arc): Vote, Common, Rare, Legendary. PvP ruin east. RTP gate south.
Extras (CUSTOM): a gateway arch on the axis 17 north framing the boards; a welcome hologram;
  a market square in the building ring, south-west (stalls round a fountain)

              N   [top3] boards+podium [top3]
                     (arch, r 17)
        crates   o  o  inner ring r 12  o  o     PvP ruin east (behind a red line)
         (arc)      o     SPAWN      o
                  o   outer ring r 22   o
        [market]          RTP gate
                     ring of buildings from r 47
```

**3. Scaffold.** `new_spawn` with `name`, `type` (`normal`, `plus` or `pvp`) and `brief` (the plan
text). It writes `minecraft-builds/<slug>/` with `spawn.mjs` (the template, its BRIEF named after the
server), `parts/` (your own copy of the parts), `examples/` and `brief.md`. `from: "frost-smp"` or
`"pirate-isle"` starts from a showcase instead; `from: "blank"` is an empty skeleton, only for a layout
none of them has (§5.5).

**4. The base.** Set the BRIEF block (§4.1) to the interview answers and build with `build_recipe`
(recipe: the spawn.mjs path). It returns a report, an isometric overview and the view from the spawn
point. The template adapts the whole layout to the BRIEF (ring sizes, the town's plaza, the canvas),
so this first build is already as good as the generator. Do not hand-edit the layout numbers to fit
a different program: change the BRIEF.

**5. Make it theirs.** Everything else goes in the CUSTOM block (§4.3): the user's extra asks, the
theme's touches, your own structures, the fixes the screenshots call for. Add one piece at a time,
build after each, and look at the images every time.

**6. Look and fix.** Take the screenshots of §10.1, run the checklist of §10.2, fix, rebuild. Do it at
least twice after you think it is done: the second round always finds something. The `spawn-critic`
agent gives a second opinion with ranked fixes.

**7. Deliver.** §12.

A typical spawn takes 5-10 builds: the base, 2-5 additions, 2-3 fix rounds. A 220 spawn builds in
about 25 s; screenshots take 2-3 s each.

---

## 3. Coordinates, angles and facing

```
            north (z smaller)                      angle 0
                  ^                                  |
   west  <--------+--------> east (x bigger)   270 --+-- 90      polar(ctx, angle, r)
   (x smaller)    |                                  |           0 = north, clockwise
                  v                                 180
            south (z bigger)
```

- **Axes.** `x` east, `y` up, `z` south. The canvas is `S x H x S`; `[cx, cz] = ctx.C` is its middle
  column, where the world spawn stands. Players spawn facing **north**.
- **The floor.** `FY` is the plaza's floor block; players stand at `FY + 1`. Every part takes
  positions as **ground block levels**: a thing "at `[x, FY, z]`" starts at `FY + 1`.
- **Angles round the spawn.** `polar(ctx, angle, r)` → `[x, z]` (not rounded: `Math.round` before
  using them as block positions), 0 = north, 90 = east, 180 = south, 270 = west.
- **`facing` = the side the player stands on.** An NPC looks that way, a sign reads from there, a
  crate opens to it, a building's door is on that face, an arch reads from there.
  `facingToward([x, z], [cx, cz])` gives the facing that looks at the spawn.
- **Stairs.** `facing` = the side of the tall back (you walk up toward it). Upside-down stairs
  (`half=top`) under eaves and in arches: the tall back toward the wall or the pier.
- **Yaw and pitch** (screenshots, NPCs): Minecraft's own. Yaw 0 looks south, 90 west, 180 north, -90
  east; pitch > 0 looks down. `yawToward(from, to)` computes it.
- **Local and world coordinates.** Everything in the recipe, the screenshots and `placements.json`'s
  `pos` is local (the structure's minimum corner is 0 0 0). World = the paste corner (`origin`) + local;
  setup.md and the `world` fields use world coordinates (§12).

---

## 4. Working in a template

Each template is the generator's layout written out as a recipe in four parts: the **BRIEF** (what
this server is), the **CUSTOM** block (what you add), the layout's numbers, and `build(api)`, which
plans everything, levels the site, builds the places, calls your CUSTOM functions at the right
moments and finishes.

### 4.1 The BRIEF

| Field | Values | Notes |
| --- | --- | --- |
| `name` | the server name | shown on the hero wall (spawn+) and in the files |
| `theme` | `autumn`, `medieval`, `white-town`, `japanese`, `winter`, `fantasy`, `crimson`, `tropical`, or your own theme object (§9.2) | the whole art direction |
| `accent` | one dye: `red`, `blue`, `light_blue`, `cyan`, `purple`, `magenta`, `pink`, `orange`, `yellow`, `lime`, `green`, `white`, `light_gray`, `gray`, `black`, `brown` | never gold; `null` = the theme's |
| `setting` | `plains`, `island`, `valley`, `mountain`, `coast` | every setting is a floating island (§9) |
| `seed` | a number | another number = another variation of the same plan |
| `size` | blocks across, or `null` | `null` = recommended for the program (best) |
| `npcs` | `[{ id, label }]` | order = priority: the first ones get the best places (nearest the first view) |
| `boards` | `[{ id, label }]` | 3-4 on a normal spawn, 4-5 on a town |
| `crates` | `[{ id, label, tier }]` | tiers `vote`, `common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic`, `seasonal` pick the chest and the plinth colour |
| `top3` | `[{ id, label }]` | top-3 pillar sets (statues of the top players): up to 4 (normal), 2 (spawn+, PvP) |
| `cratesSide` | `'west'` or `'east'` | normal only: the crate arc's side (the PvP ruin takes the other) |
| `rtp`, `pvp`, `afk` | `true` / `false` | the RTP gate, the PvP ruin, an AFK garden pool (not in the PvP template) |
| `landmarks` | `'volcano'`, `'lighthouse'`, `'ship'`, `'statue'`, `'giant-tree'`, `'giant-palm'`, `'rock-spires'`, `'rock-arch'` | big set pieces outside the town, on the diagonals (§6.10); 1-3 |
| `bigTrees` | 0-8 | giant trees (giant palms for tropical) |
| `terraces` | 0-10 | raised areas, 1-4 blocks, smooth, in the free ground |
| `rocks` | 0-30 | rock outcrops here and there |
| `warzone` | `null` or `{ width: 40-120, moshpit, koth, label }` | a PvP band all round the spawn (not in the PvP template); the canvas grows by 2 x width |
| `signs` | `null` or `{ style: 'slim' \| 'classic' \| 'colorful', outline, thick }` | block-letter titles (CRATES, LEADERBOARDS, PVP; the name on a spawn+ hero wall); `null` = holograms only, like real spawns |

### 4.2 What `build(api)` does, in order

| # | Section | Normal template (`ember-smp`) | Spawn+ (`oakhaven-hub`) | PvP (`kirin-practice`) |
| --- | --- | --- | --- | --- |
| 1 | plan | rings and plaza from the NPC count; reserve the plaza and the four corridors; NPC places, boards, crate arc, top-3 sets, RTP, PvP ruin, feature trees, AFK; landmarks; **CUSTOM.plan**; the ring of buildings; cottages; the warzone's pit and hill; raised areas and rocks | the plaza from the NPC count; the ring road; hero wall, crate yard, RTP, spoke road; the lots, NPCs moved in; arena, AFK; **CUSTOM.plan**; landmarks; raised areas | the NPC arc, the boards' area, the arena, crate yard, pavilion, tower, trees; **CUSTOM.plan**; landmarks; raised areas |
| 2 | site | `buildSite`: the island, level pads, mounds, the town flat | same | same |
| 3 | plaza | street ring, target rings, the spawn point, NPC plinths, trees in grass beds | road, plaza, the rose, cross walks, the spawn point | the plaza, the dais, the spawn point, queue pedestals |
| 4 | sections | boards + podium, top-3, crates, RTP gate, PvP ruin, AFK, signs | hero wall, crate yard, RTP, the buildings and their walks, arena, AFK | top-3, boards, arena, crate yard, pavilion, tower, trees |
| 5 | town | landmarks, rocks; the buildings and their walks; corridors out | landmarks, rocks | landmarks, rocks, walks, lamps, benches |
| 6 | warzone | moshpit, KOTH, the band, its region | same | (none) |
| 7 | life | street lamps, benches, rim bushes, props by the houses | plaza gardens, top-3, planters, stalls, benches, lamps, props | (in 4-5) |
| 8 | end | **CUSTOM.build**, `landscapePass`, **CUSTOM.finish**, `finishSpawn` | same | same |

Every part is imported at the top of each template, so your CUSTOM code can call any of them.

### 4.3 The CUSTOM block

```js
const CUSTOM = {
  plan(ctx, L) { return {} },   // reserve ground for your pieces; return what you planned (mine)
  build(ctx, L, mine) {},       // build your pieces
  finish(ctx, L, mine) {},      // seasonal passes and last touches
}
```

`ctx` is the spawn context (§6.1); `L` is the plan, with the template's places in build coordinates;
`mine` is whatever your `plan` returned. The fields of `L`:

| Template | `L` holds |
| --- | --- |
| all | `cx`, `cz` (the spawn column), `FY` (the floor), `S` (canvas side), `islandR` (the shore's distance from the middle), `pads` (push `{ x0, z0, x1, z1, y, blend }` to level ground), `slot(rect, pad)` (reserve a rectangle + level a pad under it; returns the rect) |
| normal | `R1`, `R2` (the NPC rings), `Rp` (the plaza radius; the street ring runs to `Rp + 5`, the buildings from `Rp + 7`), `spawnS`, `W` (warzone width), `npcSpots`, `crates` (`{ crate, x, z, facing }`), `top3`, `boardsZ`, `rtp`, `pvp`, `afk`, `trees`, `landmarks`, `houses` (empty in `plan`: a building you push there is built with the template's ring, which is planned right after; §4.4 H), `doors` (after the buildings), `onIsland(rect, r)` |
| spawn+ | `P` (the plaza's side), `plaza` (rect), `road` (the ring road's outer rect), `half` (the town's half width), `hero`, `crates`, `rtp`, `spoke`, `pvp`, `afk` (rects), `buildings` (every lot: `{ kind, x0..z1, facing, npc, storeys, seed }`, edit them in `plan`), `doors` (after the buildings) |
| PvP | `Rn` (the NPC arc), `Rp` (the plaza), `arc` (the NPC places), `hero` (the boards' area), `arena`, `crates`, `pavilion`, `tower`, `trees` |

**The four rules of adding anything.**

1. **Reserve in `plan`, build in `build`.** Find room with `findSpot(ctx, { r, ring: [r0, r1], angles })`
   (it reserves the disc it returns) or reserve a rectangle with `L.slot({ x0, z0, x1, z1, kind }, pad)`.
   In the normal template `plan` runs before the buildings, so they fill round what you reserve. A
   piece you build without reserving gets trees and flowers grown through it.
2. **Give it level ground.** `L.slot` adds a pad; after `findSpot`, push a pad yourself:
   `L.pads.push({ x0: s.x - s.r, z0: s.z - s.r, x1: s.x + s.r, z1: s.z + s.r, y: L.FY, blend: 5 })`.
   Pads only work in `plan` (the site is built right after it).
3. **On the plaza, no reservation is needed** (the plaza is reserved and paved), but keep off the NPC
   places, the crates' standing areas and the walks: check `L.npcSpots` / `L.crates`, and build
   between the rings or in the corridors' mouths.
4. **Seasonal passes go in `finish`**, after the landscape, so they cover everything.

To print a number while you work, `ctx.warn(\`Rp ${L.Rp} FY ${L.FY}\`)`: it shows in the build
report as `spawn: Rp 40 FY 34`. Remove it before delivering.

### 4.4 Tested examples

All of these were built and screenshotted on the templates. Copy them, then adapt.

**A. A gateway arch on the axis, framing the first view** (normal template; the full function is
§7.2). It stands between the two NPC rings, 17 north of the spawn, where the outer ring leaves a gap
for the boards, so players see the boards through it.

```js
build(ctx, L, mine) {
  const gz = L.cz - Math.round((L.R1 + L.R2) / 2)
  gateway(ctx, { x: L.cx, z: gz, facing: 'south' })
  ctx.hologram('welcome', '&fWelcome to &9Cheese SMP', [L.cx, L.FY + 4, gz + 2])
},
```

`ctx.hologram(id, text, [x, y, z])` adds a free-standing hologram to setup.md (x, z = the column, y =
the top line's height: floor + 3 or 4 reads well). Colour codes (`&f`, `&9`) are DecentHolograms'.

**B. A market square in the building ring** (normal template): reserved in `plan`, so the buildings
fill round it.

```js
plan(ctx, L) {
  const [mx, mz] = polar(ctx, 225, L.Rp + 20).map(Math.round)   // south-west, past the street ring
  const market = L.slot({ kind: 'market', x0: mx - 11, z0: mz - 8, x1: mx + 11, z1: mz + 8 }, 2)
  return { market, mx, mz }
},
build(ctx, L, mine) {
  const { FY, theme } = ctx
  const m = mine.market
  paveRect(ctx, { ...m, field: ctx.paint.field, border: theme.paving.border, corner: 2 })
  fountain(ctx, [mine.mx, FY, mine.mz], { r: 3 })
  stall(ctx, [mine.mx - 6, FY, m.z0 + 3], 'south', { width: 5, seed: 1 })   // facing = the customers' side
  stall(ctx, [mine.mx + 6, FY, m.z0 + 3], 'south', { width: 5, seed: 2 })
  stall(ctx, [mine.mx - 6, FY, m.z1 - 3], 'north', { width: 5, seed: 3 })
  stall(ctx, [mine.mx + 6, FY, m.z1 - 3], 'north', { width: 5, seed: 4 })
  for (const [x, z] of [[m.x0 + 1, m.z0 + 1], [m.x1 - 1, m.z0 + 1], [m.x0 + 1, m.z1 - 1], [m.x1 - 1, m.z1 - 1]]) lamp(ctx, [x, FY, z], { kind: 'post' })
  pavePath(ctx, [[mine.mx, mine.mz], polar(ctx, 225, L.Rp + 4)], { width: 5 })   // a walk to the street ring
},
```

**C. A winter version.** In the BRIEF: `theme: 'winter'`, `accent: 'red'` (or blue). Then:

```js
finish(ctx, L, mine) {
  snowfall(ctx)   // snow on every open surface, swept walks, drifts, frozen pond edges
},
```

**D. Autumn leaves.** `finish(ctx) { leafLitter(ctx, { amount: 0.2 }) }` with the autumn theme (or
any theme: it reads as late autumn).

**E. A statue outside a spawn+ town and fountains on its plaza** (spawn+ template):

```js
plan(ctx, L) {
  const statue = findSpot(ctx, { r: LANDMARKS.statue.r + 2, ring: [L.half + 10, L.islandR - 12], angles: [225, 200, 250] })
  if (statue) L.pads.push({ x0: statue.x - statue.r, z0: statue.z - statue.r, x1: statue.x + statue.r, z1: statue.z + statue.r, y: L.FY, blend: 5 })
  return { statue }
},
build(ctx, L, mine) {
  if (mine.statue) landmark(ctx, 'statue', { x: mine.statue.x, z: mine.statue.z, y: L.FY, subject: 'knight', facing: facingToward([mine.statue.x, mine.statue.z], [L.cx, L.cz]) })
  for (const sx of [-1, 1]) fountain(ctx, [L.cx + sx * Math.round(L.P / 4 + 2), L.FY, L.cz + Math.round(L.P / 4)], { r: 2 })
},
```

(A statue of the standard kinds is easier through the BRIEF: `landmarks: ['statue']`. Use CUSTOM when
you want it in a particular place.)

**F. The crates on the other side** (normal template): `cratesSide: 'east'` in the BRIEF. The crate
arc, the outer ring's gap, the top-3 sets, the PvP ruin, its walk and the signs all follow.

**G. Your own theme**: §9.2 (a desert oasis, tested).

**H. A building of your own in the ring** (normal template): a museum hall with its NPC on the porch,
reserved in `plan` and pushed into `L.houses`, so the template builds it with the others, paves its
walk and the ring fills round it.

```js
plan(ctx, L) {
  const [hx, hz] = polar(ctx, 135, L.Rp + 15).map(Math.round)   // south-east, in the building ring
  const facing = facingToward([hx, hz], [L.cx, L.cz])           // the door faces the plaza
  const [w, d] = facing === 'north' || facing === 'south' ? [21, 15] : [15, 21]
  const x0 = hx - Math.floor(w / 2)
  const z0 = hz - Math.floor(d / 2)
  L.houses.push(L.slot({ kind: 'hall', x0, z0, x1: x0 + w - 1, z1: z0 + d - 1, facing, y: L.FY, seed: 99, storeys: 2, npc: { id: 'museum', label: 'Museum' } }, 2))
  return {}
},
```

The NPC lands in setup.md like every other. `kind` may be any of §6.7; keep the footprint inside its
kind's range (a hall 13-27 x 11-21).

### 4.5 When you must edit the template itself

Only for a change to the layout that the BRIEF cannot express and CUSTOM cannot add round: a
different ring spacing, the boards on another side, a third NPC ring, another building rhythm. Then:

- Change one thing, build, look. Keep the plan-then-build order (nothing placed before `buildSite`).
- Keep every reservation: a place you move must still be reserved, or the woodland and the buildings
  will overlap it.
- Keep the spawn point, the boards' sector and the first view in agreement (§1.2 rule 1).
- If the layout itself must be different (a square plaza, a terraced hillside), start from the
  closest example (`frost-smp` is a square plaza) or from `blank` and use §5's numbers.

---

## 5. Layouts and their numbers

### 5.1 Normal spawn, round plaza (FreshSMP-style; `ember-smp`)

A big flat plaza with the NPCs on 1-block plinths in rings round the spawn, trees in grass beds, the
boards and crates in the open on the plaza, big buildings all round it.

| Piece | Number |
| --- | --- |
| Inner NPC ring | r 12, NPCs 6 apart along it, broken by 4 path mouths 9 wide (6 NPCs fit) |
| Outer NPC ring | r 22, or wider for more NPCs: r = n x 6 / (2 pi x 0.69); it skips the boards' sector (north, 44 degrees each side) and the crates' |
| Plaza | radius Rp = max(40, R2 + 14); kerb in the border block; a 5-wide street ring to Rp + 5 |
| Paving rings | the rose r 0-1.5 (chiseled quartz) and 1.5-3.5 (smooth quartz), a border ring 3.5-4.6, inlay 7.4-8.4, a border band under each NPC ring (r +- 1.6), inlay at Rp - 9 |
| Feature trees | 4, on the diagonals between the rings (+- 6 degrees, not exact), in grass beds r 4, crowns <= 8 radius, <= 16 tall |
| Leaderboards | `boardsPlaza` 6 in from the rim, north, facing south, boards 7 apart, a top-3 podium in front of the middle one |
| Top-3 pillars | beside the boards at +-34 degrees (then +-52, or 70 if that lands on the crates), 6 in from the rim, facing the spawn |
| Crates | an arc 6 in from the rim, west (or east), 6 apart along the arc, each facing the spawn |
| RTP gate | on the south axis just outside the plaza (`b.portal`, a 5-wide opening) |
| PvP ruin | opposite the crates beyond the street: `pvpArena` 22-32 square with its red line and region |
| Buildings | a ring from Rp + 7 out, facing the plaza: every third a hall (19-23 x 13-15), now and then a tower (9 x 9, never two side by side), houses 13-15 x 11-13 of 2-3 storeys; step on by width + 4; one-storey cottages further out where there is room |
| Size | 2 x (Rp + 70): 220 for up to ~14 NPCs |

### 5.2 Normal spawn, square plaza (`frost-smp`)

A 61-square plaza on a cross of avenues, the NPCs in two lines either side of a central aisle (6
apart, 9 off the axis), the hero 19 north of the spawn on the axis (a hand-written Christmas tree),
the boards on one side and the crates on the other, cabins in a square ring outside the street. Few,
long, straight inlay lines (the aisle, a frame 16 out): dotted or scattered inlay reads as noise.

### 5.3 Spawn+ town (DonutSMP-style; `oakhaven-hub`)

A square hub plaza (side P) with a ring road (5 wide) and a band of lots (16 deep) round it; every
NPC gets its own building facing the road.

- Each side has a centre piece: north the hero wall (boards + the name), west the crate yard, south
  the RTP gate, east the spoke road to the PvP arena. Lots either side, 11-15 wide, 2-4 apart,
  11-13 deep, 1-2 back from the road. Halls on the four corners with forecourts.
- P grows until every NPC has a lot (14 NPCs → P 70). The town is P + 10 + 32 across; ~40 more each
  side for the arena, the AFK park and the woodland.
- The first NPCs (shop, auction) get the north corner halls, then the north lots (the first view),
  then west and east, then south. Spare lots become houses.
- The plaza is dressed: quarter-round gardens in the corners (a feature tree, flowers, a bench facing
  the rose, a lamp), market stalls along the sides, planters on the rose's diagonals, a rose ring
  round the spawn with cross walks to the road.

### 5.4 PvP lobby (`kirin-practice`)

A raised round spawn dais (r 4, a stair skirt) facing north; the queue NPCs on pedestals in a
150-degree arc (radius Rn = max(11, 7N x 180 / (pi x 150)), 7 apart), the plaza Rp = Rn + 5; the
boards 5 behind the plaza rim with top-3 pillars either side; the FFA arena south behind its red
line; the crates west; a store pavilion and a tower east. Canvas 2 x (Rp + 36).

### 5.5 Composing your own

Mix them: a round plaza with a spawn+ ring of shops, a warzone round any of them, a town on a
mountain terrace. Start from the closest example or `blank`, and keep the rules: one hero on the
spawn's axis, everything important within 15-25 blocks of the spawn (25-75 for a town), places that
face the spawn, corridors out, nothing mirrored exactly, at most 3 identical modules in one view.
The order of work never changes: plan (reserve everything, fill `ctx.layout` and the pads) →
`buildSite` → paving and the spawn point → the gameplay places → buildings and their walks → set
pieces, rocks, trees, props → `landscapePass` → seasonal passes → `finishSpawn`.

---

## 6. The parts, place by place

Every part takes `ctx` first; positions are ground block levels (things start at `y + 1`). Each
file in `parts/` starts with a header that lists its functions and options: read it when you need
more than this table.

### 6.1 The frame (`spawn.mjs`)

| Function | Does |
| --- | --- |
| `startSpawn(api, { name, size, height, theme, accent, setting, seed, floorY })` → `ctx` | the builder and everything below; `height` 90-110 |
| `finishSpawn(ctx, { safeZone, description })` | cleanup, the `spawn` safe region (pvp, mobs, fall damage, item drop denied), spawn-proofing, `finish()`; warns if there is no world spawn |
| `ctx` | `b` (the builder), `kit`, `theme`, `rng` (`rng()`, `rng.int(a, b)`, `rng.range(a, b)`, `rng.chance(p)`), `S`, `H`, `FY`, `C`, `M` (spawn-kit materials for `b.npcSpot` and friends), `paint.ground/field/path/wall` (clumped palettes), `grid`, `layout`, `site`, `hologram()`, `warn()`, `place(fn, ...args)` (runs a part and turns an error into a warning) |
| `ctx.grid` | one tag per column: `reserve(x0, z0, x1, z1, tag, pad)`, `reserveDisc(cx, cz, r, tag)`, `free(x0, z0, x1, z1)`, `freeDisc(cx, cz, r)`, `tag(x, z)` |
| `findSpot(ctx, { r, ring: [r0, r1], angles, box, tag, edge })` → `{ x, z, r }` or `null` | finds and reserves a free disc; `angles` are tried first |
| `polar(ctx, angle, r)`, `facingToward(from, to)`, `yawToward(from, to)` | §3 |

### 6.2 The site and paving (`site.mjs`)

| Function | Does |
| --- | --- |
| `buildSite(ctx, { plaza, pads, mounds, flat, setting, shape, radius, depth })` → `site` | the floating island: the plaza flat at FY, level pads (`{ x0, z0, x1, z1, y, blend }`), mounds (`{ x, z, r: 8-14, h: 1-4 }`), `flat(x, z)` columns kept at FY, `shape: 'square'` for a warzone |
| `site.groundY(x, z)` | the walking surface's block level (-1 off the island); use it for anything off the plaza |
| `paveRound(ctx, { cx, cz, r, rings, kerb, field, wobble })` | a round plaza; `rings: [{ r0, r1, paint }]` |
| `paveRect(ctx, { x0, z0, x1, z1, border, field, corner })` | a rectangular one |
| `pavePath(ctx, points, { width, paint, fray })` | a walk following the ground, frayed edges by default |

### 6.3 NPCs

| Function | Does |
| --- | --- |
| `ringPoints(ctx, { r, n, skips: [[angle, halfWidth]] })` | n points round a ring, leaving out sectors; sorted nearest north first |
| `npcPlinth(ctx, npc, [x, z], { lookAt })` | a quartz plinth with a stair skirt; the NPC faces the spawn (normal spawns) |
| `b.npcSpot(pos, facing, { ...ctx.M, ...npc, style, size })` | the kit's places: `pedestal` (`size: 3`), `alcove` (in a wall), `booth`, `kiosk`, `none` (record only) |
| `building(ctx, { kind, ..., npc })` | an NPC on a porch, behind a counter or under a roof (spawn+) |

An NPC is `{ id, label }` (`role` optional). Keep them 4-7 apart, 2 clear in front, 3 of air above.

### 6.4 Leaderboards and top 3 (`features.mjs`, `buildings.mjs`)

| Function | Does |
| --- | --- |
| `boardsPlaza(ctx, { cx, z, facing, boards, gap })` | hologram boards over low lit plinths, 7 apart, the middle one raised, a top-3 podium (statues) 3 in front of it: the normal-spawn way |
| `top3Pillars(ctx, { x, z, facing, id, label })` | 2nd / 1st / 3rd columns (4 / 6 / 3 tall) 4 apart with statue NPCs; the title as a hologram |
| `heroWall(ctx, { x0, x1, z0, z1, y, cx, z, width, facing, boards, name })` | boards set into a themed wall with towers, the server name in quartz letters on it (`name: null` for none): the spawn+ hero |
| `b.leaderboards(pos, facing, { count, labels, podium, style })` | the kit's framed board wall (`style: 'wall'` or `'row'`) |

### 6.5 Crates (`features.mjs`)

| Function | Does |
| --- | --- |
| `crateCourt(ctx, { points, facings, crates })` | crates on 3 x 3 carved plinths (tier-coloured core, trim stairs, lanterns either side) at your points, a clear standing area in front |
| `crateYard(ctx, { x0, z0, x1, z1, facing, crates }, { hedge, lamp })` | a paved yard with a hedge behind and lamps, the crates in a row 6 apart facing its open side |
| `b.crate(pos, facing, opts)`, `b.crateRow(start, facing, crates, { spacing })` | the kit's crate stations (a dais, an arch over the hero crate) |

A crate is `{ id, label, tier }`. Keep them at least 5-6 apart, 3 x 3 clear in front, open sky above.

### 6.6 Gates, arenas, AFK

| Function | Does |
| --- | --- |
| `b.portal([x0, y0, z], [x1, y1, z], { ...ctx.M, id, label, kind, facing })` | a gate round a 1-thick opening, recorded as a trigger region; `kind`: `rtp`, `warp`, `pvp` (pointed arch), `nether` |
| `pvpArena(ctx, { x0, z0, x1, z1, y, entrance })` | a ruined colonnade behind a red line with a rules hologram and the `pvp` region |
| `afkPark(ctx, { x0, z0, x1, z1, y })` | a garden pool (~17 x 17) with the `afk` region |
| `b.region(id, min, max, flags)` | any region: `{ pvp: 'allow', priority: 20 }`; above the spawn's 10 to override it |

### 6.7 Buildings (`buildings.mjs`)

`building(ctx, { kind, x0, z0, x1, z1, y: FY, facing, seed, storeys, npc, label })` → `{ door, bounds, top }`.

| Kind | Footprint (w along the street x d) | Notes |
| --- | --- | --- |
| `house` | 7-15 x 7-13 | 1-3 storeys, porch, chimney, a furnished ground floor |
| `shop` | 7-15 x 7-13 | opens its front on a counter under a striped awning in the accent |
| `hall` | 13-27 x 11-21 | entrance pavilion, grand door, corner tower |
| `tower` | 5-9 square | string courses, a belfry, the theme's roof (a pagoda in japanese) |
| `arcade` | 7-13 x 9-40 | a colonnade |
| `pavilion` | 7-15 square | an open roof on columns |

Each theme has its own wall system (timber, stone, log, quartz, machiya), roof and dressing; the seed
varies the plan, roof, porch, chimney and windows, so neighbours are siblings. Pave a walk from each
`door` to the street. Vary sizes, storeys and set-backs along a street.

### 6.8 Trees, planting and props (`landscape.mjs`)

| Function | Does |
| --- | --- |
| `featureTree(ctx, [x, y, z], { size, style, seed, maxRadius, maxHeight })` | hand-shaped trees with dressed ground; styles `autumn`, `oak`, `cherry`, `snowy_spruce`, `spruce`, `blossom`, `pine`, `birch`, `dark_oak`, `azalea`, `palm` |
| `grassBed(ctx, x, z, r)` | a grass bed in the paving with a slab rim, for a tree on the plaza |
| `planter(ctx, [x, y, z], { r, tree })`, `bushAt`, `hedge(ctx, [x0, z0], [x1, z1], y, { height, gaps })` | planting |
| `lamp(ctx, [x, y, z], { kind: 'post' \| 'wall' \| 'hanging', facing })` | themed lamps |
| `bench(ctx, [x, y, z], facing, { length })` | the sitter faces `facing` |
| `fountain(ctx, [x, y, z], { r })`, `well(ctx, [x, y, z], { facing })` | water features |
| `stall(ctx, [x, y, z], facing, { width, colour })` | a market stall; [x, z] = the counter's middle, the customers on `facing` |
| `clutter(ctx, [x, y, z], kind)` | `barrels`, `crates`, `hay`, `logs`, `cart`, `firewood`, `pots` by doors |
| `rockOutcrop`, `stoneLantern`, `bambooClump`, `torii(ctx, [x, y, z], facing, { width })` | details (japanese) |
| `palmTree(ctx, [x, y, z], { height, lean })` | a 7-12 tall palm |
| `landscapePass(ctx)` | LAST before the seasons: woodland on every free column (densest at the rim and on hills, low in front of features), bushes, rocks, flower drifts, theme details, the island's rim and underside |

### 6.9 Raised areas, rocks and set pieces round the town (`extras.mjs`)

The templates do this from the BRIEF (`landmarks`, `bigTrees`, `terraces`, `rocks`):
`planLandmarks(ctx, { kinds, ring, islandR })` before the buildings, `planGround(ctx, { terraces, rocks,
islandR, inner })` last while planning, `buildExtras(ctx, { landmarks, rocks, mounds })` before the
landscape. Raised areas are smooth 1-4 block rises the woodland still grows on.

### 6.10 Landmarks (`landmarks.mjs`)

`landmark(ctx, kind, { x, z, y, seed, facing, ...opts })` → `{ r, top }`. Reserve `LANDMARKS[kind].r + 2`
with `findSpot` before the buildings; `facing` toward the spawn; level a pad. 1-3 per spawn, on the
sightlines from the plaza (the diagonals behind the building ring), never on the axis in front of the
hero.

| Kind | Ground radius | What |
| --- | --- | --- |
| `volcano` | 26 | a 30-tall cone with ridges, a crater with a contained lava pool, magma rivulets, smoke |
| `ship` | 22 | a galleon (`kind: 'sloop'` for a small one) moored broadside in its own basin, with a jetty |
| `giant-tree` | 12 | a 28-34 tall tree of the theme's feature style with buttress roots |
| `rock-arch` | 12 | a natural arch you look through from `facing` |
| `rock-spires` | 10 | 3-5 stone pillars with strata and moss caps |
| `lighthouse` | 8 | a striped tower (`stripe`, default red), gallery, lantern room |
| `giant-palm` | 8 | a 20-27 tall palm |
| `statue` | 7 | `subject: 'parrot'` (a giant macaw, tropical's default) or `'knight'` on a carved plinth |

### 6.11 The warzone (`warzone.mjs`)

The canvas is the spawn square plus a band of width W (40-120) all round: `size = spawnSize + 2W`, the
spawn square `[W, W, W + spawnSize - 1, W + spawnSize - 1]`, the site `shape: 'square'`.
`warzoneBand(ctx, { spawn, label, keepClear })` draws the red concrete line 2 wide just outside the
spawn square, continues the corridors, adds holograms and cover; `moshpit(ctx, [x, z], { r: 8-12 })`
(a terraced sunken pit) and `koth(ctx, [x, z])` (a stepped hill with a capture zone) add their
regions. Then `b.region('warzone', [0, 0, 0], [S - 1, H - 1, S - 1], { pvp: 'allow', priority: 5 })` and
`finishSpawn(ctx, { safeZone: spawnSquare })`. The templates do all of it from `BRIEF.warzone`.

### 6.12 Block-letter signs (`signs.mjs`; off unless asked)

Real spawns label with holograms; letters are for the server name and at most 2-3 titles.
`signStand(ctx, text, [x, z], facing, { style, outline, thick, posts, y })`: `slim` (small quartz
letters smoothed with stairs), `classic` (5-tall quartz with stair bevels on a dark board), `colorful`
(accent concrete outlined in terracotta); `'auto'` picks for the theme; `posts: false` sets it
against your own wall. `signStyle(ctx, text, opts).width` measures it first. Letters at least the
viewing distance / 12 tall, 30+ L* contrast to the board.

### 6.13 Seasons (`seasons.mjs`)

`snowfall(ctx, { paved: 0.35, natural: 0.97, deep: 0.3, ice: true })`: snow layers on every open
surface (full blocks, leaves, top slabs, upside-down stairs), deeper in drifts, swept walks, frozen
water edges; NPC plinths, crates and the spawn rose stay clear. `leafLitter(ctx, { amount: 0.25 })`:
autumn carpets in clumps on natural ground and the plaza edges. Both in `CUSTOM.finish`.

### 6.14 Holograms, regions, safety

- `ctx.hologram(id, text, [x, y, z])` for free-standing text (rules, district names, a welcome). NPC,
  crate and board holograms are recorded by their parts.
- `b.region(id, min, max, flags)` for every PvP or AFK zone, priority above the spawn's 10.
- `finishSpawn` spawn-proofs (invisible light in every dark walkable cell) and adds the safe region.

---

## 7. Writing your own structures

Anything the parts do not have, you build: the server's mascot, a monument, a gateway, a portal hall,
a Christmas tree (`frost-smp.mjs` → `christmasTree`). Write a function in `spawn.mjs` below
`build()` (or a new file in `parts/`) and call it from `CUSTOM.build`.

### 7.1 The rules that keep it hand-built

- **Silhouette first.** Get the outline right from the player's distance before any detail;
  screenshot it from the spawn and from the side.
- **Materials from the theme**, so it fits any spawn: `ctx.paint.wall` (the wall field, clumped),
  `theme.wall.base`, `kit.material(theme.trim)` (stairs and slabs), `kit.material(theme.kit.primary)`,
  `` `minecraft:${theme.accent}_glazed_terracotta` `` for the one accent point.
- **Depth.** Nothing flat: a base course, a cornice that overhangs, reveals, upside-down stairs under
  edges. Partial blocks for 16-28% of what you see.
- **3-5 shades per material, in clumps** (`kit.palette({ a: 4, b: 1 }, { scale: 3 })`), never
  per-block random speckle.
- **Light it** with hidden or fitted sources (a lantern on a cap, one hanging on a chain, light under
  slabs).
- **Author once, stamp turned.** Build it in a module whose front is south, then
  `b.stamp(m, corner, { rotate })` with `{ south: 0, west: 1, north: 2, east: 3 }[facing]`. A square
  module keeps its footprint at every turn, so you can stamp it centred on `[x, z]`.
- **Reserve its ground and give it a pad** (§4.3) unless it stands on the plaza.

### 7.2 The worked example: a gateway arch

Tested on the normal template (§4.4 A). A 13-wide, 9-tall arch with a 7-wide opening, two piers on a
base course, a stepped curve in the wall's own stone, a band with an accent keystone, an overhanging
cornice with a slab cap, lanterns on the piers and one hanging in the opening.

```js
// A gateway arch over a walk. [x, z] = the middle of the arch, facing = the side players come from.
function gateway(ctx, { x, z, facing = 'south' }) {
  const { b, kit, theme, FY } = ctx
  const trim = kit.material(theme.trim) // the cornice
  const wall = kit.material(theme.kit.primary) // the curve, in the wall's own stone when it has stairs
  const curve = wall?.stairs ? wall : trim
  const body = ctx.paint.wall
  const m = b.module([13, 10, 13]) // square, so every turn keeps the footprint; the arch runs along x at z 5-6
  for (const x0 of [1, 10])
    for (let px = x0; px <= x0 + 1; px += 1)
      for (let z = 5; z <= 6; z += 1) {
        m.set(px, 0, z, theme.wall.base) // a base course, then the wall
        for (let y = 1; y <= 6; y += 1) m.set(px, y, z, body)
      }
  for (let z = 5; z <= 6; z += 1) {
    // the curve: upside-down stairs stepping in from each pier (facing = the tall back, toward the pier)
    for (const [y, u] of [[3, 0], [4, 1], [5, 2]]) {
      m.set(3 + u, y, z, `${curve.stairs}[facing=west,half=top]`)
      m.set(9 - u, y, z, `${curve.stairs}[facing=east,half=top]`)
      for (let k = 0; k < u; k += 1) {
        m.set(3 + k, y, z, body)
        m.set(9 - k, y, z, body)
      }
    }
    m.set(6, 5, z, `${curve.slab}[type=top]`)
    for (let x = 3; x <= 9; x += 1) m.set(x, 6, z, body) // the band over the opening
  }
  m.set(6, 6, 6, `minecraft:${theme.accent}_glazed_terracotta`) // the keystone: the one accent
  // the cornice: a course of the trim with upside-down stairs overhanging front and back, a slab cap
  for (let x = 0; x <= 12; x += 1) {
    for (const z of [5, 6]) m.set(x, 7, z, trim.block)
    m.set(x, 7, 7, `${trim.stairs}[facing=north,half=top]`)
    m.set(x, 7, 4, `${trim.stairs}[facing=south,half=top]`)
    if (x !== 1 && x !== 11) for (const z of [5, 6]) m.set(x, 8, z, `${trim.slab}[type=bottom]`)
  }
  m.set(1, 8, 6, 'minecraft:lantern[hanging=false]')
  m.set(11, 8, 6, 'minecraft:lantern[hanging=false]')
  m.set(6, 4, 6, 'minecraft:chain[axis=y]')
  m.set(6, 3, 6, 'minecraft:lantern[hanging=true]')
  b.stamp(m, [x - 6, FY + 1, z - 6], { rotate: { south: 0, west: 1, north: 2, east: 3 }[facing] })
}
```

What it teaches: the module frame (y 0 = the first block above the floor), stairs facing their tall
back toward the pier for a curve, a band and a cornice that overhangs on both faces, one accent
point, fitted lights. Scale it by changing the opening and the pier width; keep the curve's steps
one block each.

### 7.3 Bigger pieces

For statues, monuments, ships, crystals and clouds read `references/building/sculpting.md` (`b.hull`,
`b.figure`, SDF shapes, `b.shadeSurface`); for towers, roofs, windows and doors
`references/building/components.md` and `kit-api.md` (`b.roof`, `b.window`, `b.door`, `b.column`,
`b.arch`). A logo or mascot statue must read as its icon at a glance from the spawn: a clean
silhouette, 15-30 tall, 3-5 shades, lit at night.

---

## 8. The cookbook: what the user asks, and what you change

| They ask | You change |
| --- | --- |
| "Make a winter version" | BRIEF `theme: 'winter'` (log cabins, snowy roofs and spruces), accent red or blue; `snowfall(ctx)` in `CUSTOM.finish` (§4.4 C); a decorated hero tree like `frost-smp`'s |
| "Autumn feel" | `theme: 'autumn'`, `leafLitter(ctx)` in finish; pumpkins and hay by doors (`clutter`) |
| "Christmas" | winter + snowfall + a decorated tree on the axis (`frost-smp.mjs` → `christmasTree`) + red and white accents |
| "Halloween" | `theme: 'autumn'` or `crimson`, accent orange, `leafLitter`, jack o'lanterns by doors, a dead tree on the axis |
| "Tropical / pirate" | `theme: 'tropical'`, `setting: 'coast'`, landmarks `ship`, `lighthouse`, `volcano`, `giant-palm` (`pirate-isle` shows them all) |
| "Lifesteal / dark / nether" | `theme: 'crimson'` (blackstone, crimson wood, nether bricks, fungi trees) |
| "Desert", "candy", "sci-fi" or any look not listed | your own theme on the closest one (§9.2) |
| "Add more stuff" | first the BRIEF's options (landmarks, big trees, raised areas, rocks, AFK, top-3 sets), then CUSTOM pieces: a market (§4.4 B), fountains, a gateway (§7.2), statues, a garden, a second tree ring, stalls along the street; keep the plaza readable and the corridors free |
| "It looks empty" | planters and benches between the rings, inlay lines, a fountain, more trees in grass beds; on the land: `terraces`, `rocks`, `bigTrees` |
| "It looks crowded" | fewer props, widen the rings (bigger `size`), keep the corridors 9 wide, lower `maxRadius` of the plaza trees |
| "Bigger" / "smaller" | BRIEF `size` (normal 120-320, spawn+ 160-320, PvP 60-160); below the recommendation the town gets tight |
| "More NPCs" / "fewer" | add or remove in `npcs`: the rings, the town or the arc resize by themselves |
| "Move the crates" | normal: `cratesSide: 'east'` (§4.4 F); anything else: §4.5 |
| "Their logo / mascot" | a hand-written statue (§7.3) as the hero on the axis, or replacing the gateway |
| "A welcome message", "rules" | `ctx.hologram(...)` (§4.4 A) |
| "Signs on the sections" | BRIEF `signs: { style, outline, thick }` (§6.12) |
| "A warzone", "a moshpit", "KOTH" | BRIEF `warzone: { width, moshpit, koth, label }` |
| "Another variation" | another `seed` |
| "A different layout" | §4.5 and §5: re-plan in brief.md first |
| "A night look" | lamps and hidden lights are already there and `finishSpawn` lights every dark cell; show it with `node scripts/render.mjs --nbt <file> --lighting night` (needs Playwright, SKILL.md Setup); add `lamp`s where streets look dark |
| "A building for X" (a museum, a guild hall, a bank) | §4.4 H, with an NPC for it |
| "Make it more unique" | a hero only this server has (their mascot, a themed monument), one set piece on a diagonal sightline, a story detail (a statue of the season-1 champion, a "coming soon" scaffold) |

---

## 9. Themes, and making your own

### 9.1 The eight themes

| Theme | Walls | Roofs | Trees | Accent | Default setting |
| --- | --- | --- | --- | --- | --- |
| `autumn` | stone bricks, spruce timber | steep dark oak | red, orange, yellow autumn trees | orange | island |
| `medieval` | stone and white plaster with dark timber | deepslate tile gables | oak, birch | red | valley |
| `white-town` | smooth quartz, dark deepslate frames | deepslate tile hips | oak | blue | coast |
| `japanese` | white plaster, dark oak (machiya) | East-Asian deepslate roofs | cherry, pine | red | island |
| `winter` | spruce log cabins | steep snowy spruce | snowy spruce, pine | red | mountain |
| `fantasy` | calcite, birch timber | prismarine bell roofs | blossom | purple | island |
| `crimson` | polished blackstone bricks, crimson stems | nether brick | crimson fungi | red | island |
| `tropical` | white terracotta, sandstone, jungle timber | bamboo | palms | light blue | coast |

Normal spawns use `plains` unless the BRIEF says otherwise (real normal spawns are flat). The
settings: `plains` (nearly flat), `island` (gentle rolling), `valley` (hills round the rim),
`mountain` (a rocky ridge behind the hero, north-west), `coast` (a lake cove south-east with
beaches). Every setting is a floating island, so it pastes into a void world or the sky of any world.

### 9.2 Your own theme

Give the BRIEF a theme object built on the closest theme. The roles you give replace the base's;
`paving`, `wall`, `trees`, `kit` and `buildings` merge one level deep; the buildings and the
landscape keep the base's style unless `buildings` overrides it. Every role is listed at the top of
`parts/themes.mjs`, every building style option in `parts/buildings.mjs` (`STYLES`). Tested:

```js
theme: {
  base: 'tropical', // palms, sand, the coast; the roles below replace its own
  label: 'Desert oasis',
  ground: { sand: 10, red_sand: 1 },
  paving: { field: { smooth_sandstone: 4, cut_sandstone: 2, sandstone: 1 }, border: 'cut_red_sandstone', path: { sand: 2, smooth_sandstone: 1 }, inlay: 'cyan_terracotta' },
  wall: { field: { smooth_sandstone: 4, cut_sandstone: 1, sandstone: 1 }, quoin: 'chiseled_sandstone', base: 'cut_red_sandstone' },
  timber: 'stripped_acacia_log', wood: 'acacia', plaster: 'smooth_sandstone',
  roof: 'smooth_sandstone', trim: 'smooth_red_sandstone',
  trees: { feature: 'palm', forest: [[3, 'palm'], [1, 'azalea']] },
  flowers: [[3, 'dead_bush'], [1, 'short_grass']],
  kit: { primary: 'smooth_sandstone', trim: 'smooth_red_sandstone', base: 'cut_red_sandstone', wood: 'acacia', roof: 'smooth_sandstone' },
  buildings: {
    system: 'stone', ground2: 'stone', single: 'stone', quoin: null,
    plinth: { cut_red_sandstone: 2, red_sandstone: 1 }, skirt: 'smooth_red_sandstone',
    roof: { type: 'hip', profile: 'hip', material: 'smooth_sandstone', overhang: 1 },
    gable: { kind: 'plain' }, win: { shutters: 0.3, box: 0.2 },
    door: 'acacia', floor: 'acacia_planks', props: ['barrel', 'pots', 'hay'], rug: ['cyan_carpet', 'orange_carpet'],
  },
},
accent: 'cyan',
```

Rules: `trim`, `roof` and `kit.trim` need a material with stairs and slabs (`kit.material(id).stairs`);
the accent is a dye name; weights are clumped palettes, so give the main material most of the
weight (a 1-in-7 contrast block reads as texture, 1-in-3 as speckle). Woodland only grows on soil
(grass, dirt, moss, podzol): a sand ground stays open, so add palms, cacti or an oasis pool in
CUSTOM if it needs life. Tell the user which theme you started from.

---

## 10. Looking at it: screenshots, critique, fixes

### 10.1 The shot list

`build_recipe` returns the overview and the spawn view. After every change, take screenshots of what
you changed; before delivering, take the whole set:

| Shot | How |
| --- | --- |
| The spawn view | `{ "name": "spawn", "spawn": true }` |
| In front of the crates | stand 4-6 out along a crate's facing, look at it |
| At the boards | stand 8-10 in front of the middle board, look at its anchor |
| The plaza rim looking back | stand at the street ring on the south axis, look at the spawn |
| The way out | stand at the RTP gate looking out, or on a corridor |
| Each CUSTOM piece | from where players first see it |
| High views | `{ "eye": [x, FY + 40, z + 60], "yaw": 180, "pitch": 32 }` over the plaza; `render_build` from two corners |

Positions come from `<slug>.placements.json` (next to the .nbt): every `crate`'s `pos` and `facing`,
every `leaderboard`'s `anchor`, every NPC's `pos`, the `spawn`'s `pos` and `yaw`, all in local
coordinates. "Stand in front of X" = X's pos plus its facing's step times the distance (north `z - d`,
south `z + d`, east `x + d`, west `x - d`), then `lookAt` X. For example, a crate at `[86, 36, 110]`
facing east: `{ "name": "crate-vote", "pos": [91, 110], "lookAt": [86, 37, 110] }`.

`screenshot` takes up to 6 shots per call: `pos: [x, z]` stands on the ground there (`[x, y, z]` = the
feet block), `eye` places the camera exactly, `lookAt` or `yaw`/`pitch` aims it, `fov` defaults to 70.
`render_build` gives isometric views from above: `px` 2-3 for the whole spawn, 6-9 with a `box`
(`x0,z0,x1,z1`) for a district, `ymin` (e.g. FY - 4) to cut the island away.

### 10.2 What to check, in every picture

- **The first view:** the hero on the axis, framed, sky behind it; NPCs visible; the way out visible.
- **The places:** every NPC, crate and board readable and reachable, nothing in front of them, no tree
  over them, nothing blocking a walk.
- **Nothing broken:** no floating or buried pieces, no building cut by a path, no tree in a doorway,
  no lantern hanging from air.
- **The floor:** structured, not speckled; not one big plain patch.
- **Variety:** no two identical neighbours, no exact mirror, three height tiers.
- **The edge:** the town meets the land with planting and steps; the shore and the underside look
  natural.
- **The brief:** everything the user asked for is there and reads the way they meant it.

Then `inspect_build` (mode `checks`): floating blocks, plants on stone, fluids, dark spots.
The `spawn-critic` agent reviews the folder and answers with ranked fixes as code.

### 10.3 Symptom → fix

| You see | Fix |
| --- | --- |
| The first view is a wall, a tree trunk or empty sky | move or shrink what blocks it; put the hero 20-45 out on the axis; lower `maxHeight` of the trees framing it |
| A tree covers an NPC, a crate or a board | lower its `maxRadius` / `maxHeight`, or move its bed 2-3 off the line |
| Your piece has woodland growing through it | reserve it in `plan` (§4.3 rule 1) |
| Your piece floats or is half buried | give it a pad in `plan`, or build on `ctx.site.groundY(x, z)` |
| Buildings overlap or stand in the woods | reserve every slot and give it a pad; check `grid.free` before you place |
| The plaza looks empty | planters, benches, inlay lines, a fountain, a gateway; more NPCs or top-3 sets |
| The plaza looks crowded | fewer props, a bigger `size`, corridors 9 wide |
| Everything looks the same | vary sizes, storeys, set-backs and seeds; break symmetry on purpose |
| Speckled ground or walls | give the main material more weight in the palette |
| Dark streets in a night view | lamps every 12-13 along them (`lamp`) |

---

## 11. Troubleshooting

| Report line | Means | Do |
| --- | --- | --- |
| `build failed: run-build: X is not defined` | a name your code uses is not imported or misspelled | every part is imported at the top of the template; check the spelling. The `at build (.../spawn.mjs:LINE:COL)` line under it is where |
| `build failed: run-build: ...` with any other message | your code threw | the `at` lines under the message name the file and line |
| `spawn: <part> failed: ...` | a part threw and was skipped (`ctx.place` catches it) | usually a slot off the canvas or a missing option; build with the script and `SPAWN_DEBUG=1` to throw it with its line (`SPAWN_DEBUG=1 node scripts/run-build.mjs <spawn.mjs> --out-dir <folder> --json`) |
| `problems: ["unknown block id ..."]` | a block id that does not exist in 1.21.1 | fix the id; check `kit.material(id)` for families (not every block has stairs, mossy or cracked variants) |
| `clipped: N` with `clippedFrom` | N placements fell outside the canvas | the line named; keep pieces inside `islandR` |
| `... cell(s) that must stay clear are filled` | something blocks an NPC's stand-off, a crate's standing area or head room | move it; the cell is named |
| `hanging lantern(s) hang from air` | a lantern with nothing above | put a chain or a block above it |
| `spawnPoint called twice` | two world spawns | keep one `b.spawnPoint` |
| `spawnProof: N dark walkable cell(s) left` | no free cell for a light there | add a lamp near the cell named |
| `size N is small for M NPCs` | the canvas is below the recommendation | `size: null`, or accept a tighter town |
| `N NPC(s) got no building` (spawn+) | not enough lots | raise `size` |
| A build takes over a minute | a big canvas (a warzone adds 2 x its width) | fine for the final build; use a smaller warzone while iterating |

---

## 12. Delivery

1. **Ask where it goes** if they have not said: the world name, and the paste corner (the world block
   where the schematic's minimum corner goes), or "centred on 0, 0". To centre the spawn on 0, 0 with
   the plaza floor at world height Y: `origin = [-cx, Y - FY, -cz]` (local `cx`, `FY`, `cz` from the
   placements' spawn: it stands at `[cx, FY + 1, cz]`).
2. **Export:** `build_recipe` with `export: true`, `origin: "x,y,z"` and `world: "name"`. It writes, next
   to `spawn.mjs`: `<slug>.schem` (WorldEdit / FAWE), `<slug>.litematic` (Litematica), `<slug>.nbt`
   (structure blocks, `/place template`), `<slug>.setup.md` (every command) and
   `<slug>.placements.json` (the same positions as data).
3. **Check the setup sheet:** the world spawn (`setworldspawn` with its angle), the NPCs (Citizens and
   FancyNpcs lines), the holograms (DecentHolograms: NPC labels, boards, crates, your free ones), the
   crates (ExcellentCrates and CrazyCrates), the regions (WorldGuard). All in world coordinates.
4. **Send** the .schem and .litematic, setup.md, 3-4 screenshots (the spawn view, the overview, the
   main sections), and a short note:

```
Cheese SMP spawn: 220 x 100 x 220, white town, 10 NPCs, 3 boards, 4 crates.
Paste: //schem load cheese-smp, stand at -110 64 -110 (the minimum corner) and //paste.
The world spawn is then 0 99 0 facing north (setworldspawn is in setup.md).
setup.md has every NPC, hologram, crate and region command, ready for the console.
Holograms carry the names and board text, so in the schematic the NPC places, boards and crates
are empty plinths until the plugins fill them.
```

WorldEdit pastes the minimum corner at your feet (`//paste -a` skips air; a void world needs no
`-a`). Litematica: put the file in `.minecraft/schematics`, load it, set the placement origin to the
corner. Vanilla structure blocks load at most 48 x 48 x 48; `/place template` from a datapack has no
such limit (`references/formats.md`).
