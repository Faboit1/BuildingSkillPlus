---
name: minecraft-builder
description: Design and generate high-quality Minecraft builds — above all server spawns and lobbies (SMP spawns with NPC places, leaderboards and crates, DonutSMP-style multi-building hubs, FreshSMP-style terrain spawns, PvP lobbies), plus houses, castles, cathedrals, towers, villages, temples, ships, statues, trees, terrain and whole scenes — as vanilla structure .nbt (or .schem/.litematic, or ready-to-paste region files) using a JavaScript building kit, then render them headlessly to critique and iterate. Use for any request to build, design, generate, export, preview, import or improve a Minecraft build, spawn, lobby, hub, schematic or structure.
---

# Minecraft Builder

**Paths.** Everything this skill mentions (`scripts/`, `references/`, `assets/`) is inside this
skill's own folder, `${CLAUDE_SKILL_DIR}` (the folder holding this SKILL.md; in the plugin it is the
plugin root, `${CLAUDE_PLUGIN_ROOT}`). Read files and run scripts with that prefix, e.g.
`node "${CLAUDE_SKILL_DIR}/scripts/run-build.mjs"`. Builds are written to `minecraft-builds/` in the
user's current folder.

**What kind of job is it?**

| The user wants | You do |
| --- | --- |
| A server spawn, lobby or hub | build it yourself, every element by hand: the six steps below. This is the main use |
| Any other build (a house, a castle, a statue, terrain...) | write a recipe with the building kit, render, critique, repeat ("The loop" below); read `references/building/README.md` first |

## Server spawns and lobbies: build them yourself

You are the build team, and you build every block yourself: the island, the ground, the paving,
every stone and tree, every NPC place, the boards, the crates, the gates, every building, every lamp.
Nothing is generated and nothing is pasted from a stock piece. The spawn manual,
`references/spawns/build-guide.md`, teaches each element with a picture of what to do next to what
not to do (`references/spawns/img/`) and the code of one worked example
(`references/spawns/elements/`). The examples show how an element is made. What this spawn's
elements look like you design from the user's brief and the theme. Read the manual's §1-§4 before
your first spawn, and read an element's chapter in §5 before you write that element.

| Element | Chapter | What the picture teaches |
| --- | --- | --- |
| The land | §5.1 | a landscape from `b.land`: ranges with spurs, foothills, a valley, erosion, blocks by slope; a wandering outline and a hanging underside; not a flat disc, not noise hills, not blobs on the flat |
| Ground, planting, walks | §5.2 | clumps not speckle, flower drifts, frayed walks |
| Paving | §5.3 | one field material with borders and inlay lines, or a warm grid; not speckle |
| Rivers, lakes, waterfalls | §5.4 | a meandering river with sloped banks, depth and plants, contained water; not a straight trench |
| Bridges | §5.5 | stone arches on piers with cutwaters, a humped deck 6-10 above the water, parapets, ramps into the banks; never a flat strip on the water |
| Cliffs and mountains | §5.6 | strata, ledges with plants, overhangs, scree, a varied skyline; not a noise blob or a cone |
| Stones and rocks | §5.7 | groups, sunk into the ground, noisy shapes, moss on top, not spheres |
| Trees, bushes, giant trees | §5.8 | big thick trees (14-26 tall, trunks 2-5 across, all-bark wood), forking limbs, lumpy crowns with gaps, three sizes, giant landmarks; not lollipops or 1-wide poles |
| The spawn centre (the dais) | §5.9 | a stepped dais with stripes and a medallion on a grid plaza, the NPC ring round it |
| NPC stands | §5.10 | a 1-block stand (a barrel), a soul lantern post, a ring turned to the middle; not pillars or glass boxes |
| Leaderboards, top-3 pillars | §5.11 | framed recesses; 3 x 3 pillars, diamond 3 high, gold 2, iron 1, beside the boards |
| Crates | §5.12 | a crate pavilion or court, a stage each, 6+ apart, the tier as an accent; not chests on concrete |
| Gates and gatehouses | §5.13 | twin towers, a deep arched passage, a clear opening; not an obsidian frame |
| Big buildings | §5.14 | masses (a main block, wings, a tower), storeys, depth on every wall, a roofscape; not a big box |
| Walls and towers | §5.15 | a thick battered wall, crenellations, projecting towers; not a 1-thick cobble wall |
| Lamps and light | §5.16 | posts with arms along the walks, hidden light, not glowstone grids |
| Props | §5.17 | groups that tell a story, not single blocks scattered |
| Fountains | §5.18 | a big rimmed basin, tiers with water spilling down; not a hole of water |
| Text, the PvP line | §5.19-§5.20 | holograms, a red line with a region |
| The hero | §5.21 | one landmark 60-120 tall that reads from the spawn, grown out of a crag, layered and detailed (`elements/keep.mjs`); not a striped cylinder or a castle on a cube |
| The town | §5.22 | streets first (5-9 wide, curving), houses shoulder to shoulder on lots along them, every house its own, back yards; not houses on a lawn |

**When a spawn is done.** Only when the export went through: the audit passed (every build prints
it; the export refuses while it fails) and the quality gate of manual §2.3 holds. Until then there
is no report to write. A list of open items, a question like "should I continue?" or a summary of
what is left is stopping early. Take the next item and build again. Expect 40-100 builds and hours
of work for a big spawn: that is the job, not a sign that something is wrong.

The frame (`frame/frame.mjs` in the spawn folder) is plumbing only: the canvas, a reservation grid,
angles, the world spawn, the records the server admin needs (NPC, hologram, crate, board and portal
positions, regions), spawn-proofing and the export. The kit is your toolbox (palettes, noise, block
states, modules, and roof, window and door helpers): use it freely, the design is yours.

### Step 0: your tools

- **Plugin tools (preferred).** This plugin's MCP server `minecraft`:
  - `new_spawn` creates the spawn folder;
  - `build_recipe` builds it and returns the report, the overview and the view from the spawn point;
  - `screenshot` shows what a player sees, from any spot;
  - `render_build` gives isometric views and close-ups;
  - `inspect_build` lints the build;
  - `convert_build` converts between formats.

  In Claude Code they are named like `mcp__plugin_minecraft-builder_minecraft__build_recipe`. Their
  results include images: look at them.
- **Scripts (the same results, when the tools are not listed, e.g. in claude.ai chat):**
  - `node "${CLAUDE_SKILL_DIR}/scripts/new-spawn.mjs" "<name>" --brief "<plan>"`
  - `run-build.mjs <spawn.mjs> --out-dir <folder> --json`
  - `screenshot.mjs <file.nbt> --spawn` (or `--shots '<json>'`)
  - `isorender.mjs <file.nbt> --out x.png`

  They need Node 20.19+. The dependencies are bundled in `scripts/node_modules`, so there is nothing
  to install. Read the PNGs with the Read tool. Only if the folder is incomplete, run
  `git clone https://github.com/Faboit1/BuildingSkillPlus` and use its `scripts/`.

### Step 1: the interview (never skip it, never build from a one-line request)

Use the `AskUserQuestion` tool, up to 4 questions per call. **Every question has a "Let Claude
decide" option** (then you choose what fits their server and say what you chose in the plan). Mark
the option you recommend with "(Recommended)". The user can always type their own answer. Skip what
their request already answered.

**Round 1** (one call):
1. **Type:**
   - *Normal spawn*: a big plaza, NPC places round the spawn, boards and crates in the open,
     buildings all round. Best for most SMPs.
   - *Spawn+*: a town, every NPC its own building.
   - *PvP lobby*: queue NPCs in an arc, an arena.
   - *Surprise me*: you pick everything.
2. **Size** in blocks: *Let Claude decide* (about 1000 for a normal spawn, 1100 for spawn+, 550 for
   PvP) / 800 x 800 / 1100 x 1100 / 1500 x 1500. Big spawns are the point: a town, districts and a
   landscape round a compact centre (manual §6).
3. **How many NPCs**: 6 / 10 / 14 / Let Claude decide (they can type any number).
4. **Theme**: the 3 looks that fit their server best + Let Claude decide. In the question text, list
   ideas: medieval, autumn, white town, japanese, winter, fantasy, dark (lifesteal), tropical
   (pirate islands), desert. Any look works: you choose the materials (manual §7).

**Surprise me:** ask only the server name, then pick everything at random. Roll real dice
(`node -e "console.log(Math.random())"` per choice, so two surprises differ): type, theme, accent,
NPC count and the options of rounds 3-4. Say what the dice picked in the plan.

**Round 2** (one call), each question with Let Claude decide:
1. The **server name**.
2. **Which NPCs** (multiSelect): shop, auction, kits, store, quests, sell, warps, events, vote,
   tutorial. For PvP: unranked, ranked, FFA, kit editor, duels, events.
3. **Which leaderboards** (multiSelect): Money, Kills, Playtime, Blocks Mined, Votes. For PvP: Elo,
   Wins, Streak.
4. **Which crates** (multiSelect): Vote, Common, Rare, Epic, Legendary, Seasonal.

**Round 3** (one call, the options; all optional):
1. **Top-3 pillars** (the top 3 players as statues on 3 x 3 pillars: diamond 3 high in the middle,
   gold 2 high, iron 1 high; or gold / iron / copper; or concrete in those colours): *Top Spenders +
   Baltop* / *Baltop only* / *None* / *Let Claude decide*.
2. **Warzone** (a PvP band round the spawn behind a red line): *No* / *Warzone with a moshpit and a
   KOTH hill* / *Warzone only* / *Let Claude decide*.
3. **Big things round the spawn** (multiSelect): *Mountains and cliffs* / *Rivers, lakes and
   waterfalls with bridges* / *Town walls and gatehouses* / *Giant trees* / *Landmarks* (a castle, a
   cathedral, a ship, a lighthouse, a giant statue) / *Let Claude decide*.
4. **Section signs** in block letters (real spawns mostly use holograms): *No, holograms only
   (Recommended)* / *Short quartz letters* / *Let Claude decide*.

**Round 4** (only what is still open):
1. The **setting**: plains / island / valley / mountain / coast.
2. The **accent colour**: one dye, never gold (gold belongs only on the top-3 pillars).
3. **Extras** (multiSelect): an RTP gate, a PvP ruin, an AFK pool, anything of their own (a market, a
   statue of their mascot, a building for something).
4. **Where it goes**: the world and the paste corner, or "centred on 0, 0".

### Step 2: the plan (show it, get a yes)

Write the plan into `brief.md` (manual §2.4 has an example):

- the answers and what you decided;
- the canvas size;
- the districts and their feature buildings, the hero, the land (mountains, rivers, lakes,
  forests) and the roads and bridges that join them;
- every place with its coordinates;
- a sentence on the design of each element ("the crates in an open pavilion west, each under its
  own arch, the tier in a glass strip");
- a top-view sketch with the main numbers.

Show it and ask "Build this?".

### Step 3: scaffold

`new_spawn` with `name`, `brief` (the plan) and `size`. It makes `minecraft-builds/<slug>/` with
these files:

| File | What it is |
| --- | --- |
| `spawn.mjs` | The skeleton: the frame and one empty section per element group (plan, land, floor, the spawn point, the places, buildings and the hero, life, text). |
| `frame/` | The plumbing. |
| `elements/` | The manual's worked examples. |
| `parts/` and `examples/` | Reference spawns to read: how a whole spawn fits together. |
| `brief.md` | The plan. |

### Step 4: build every element yourself, district by district

**Cook until it is perfect** (manual §2.1). The user wants the best spawn you can make, not the
quickest: take the builds, screenshots and tokens it needs (a great spawn takes 40-100+ builds).
Do the most, not the least: every element has everything its chapter lists, every district gets its
big feature, empty ground on a big canvas is a bug. Never skip a check, never stop at the first
pass. In Claude Code you can run helper agents in parallel, one district each; then put the
districts together and review the whole.

Build the land first, as a landscape (manual §5.1): shape it with `b.land` (ranges, peaks,
valleys, pads), erode it, look at `land.preview()`'s map (seconds) until the landforms are right,
then paint it and cut the rivers and lakes. Then the spawn centre, then one district at a time with
the district loop (manual §2.2): block out the big masses, draft with `build_recipe`'s `focus` (only
that box: 20-40 s on any canvas), detail, look from 4+ player spots, list every flaw, fix, repeat
until a round finds nothing (3 rounds at least). For each element:

1. Read its chapter in manual §5 and look at the do and don't picture.
2. Read its worked example in `elements/` to see how each rule becomes blocks.
3. Write this spawn's own version as a function in `spawn.mjs`, designed from the plan and the
   theme: its own shapes, sizes and materials. Every repeat is varied: no two trees, rocks, NPC
   places or buildings alike.
4. Build with `build_recipe` and look at the views before you go on. Fix every `problems`,
   `clipped` and warning line.

**The audit** (manual §2.3): every build prints `audit:` lines measured from the blocks (bare lawn,
flat land, repeated buildings, low decks over water, NPC spacing, the build count). Each `FIX` line is
work to do now; the export refuses while any is open. Never stop to ask the user whether to carry on
while the audit fails or the gate is not met: carry on. Read every screenshot you take.

Use the marks for the gameplay places (`b.spawnPoint`, `b.markNpc`, `b.markCrate`, `b.markBoard`,
`b.markPortal`, `ctx.hologram`, `b.region`; manual §4.2). They record what setup.md needs and warn
when something you build blocks an NPC's head room, a crate's front or a board's text.

### Step 5: look like a player, fix, repeat

`build_recipe` returns the overview and the spawn view. Take more with `screenshot` from the
player's spots (manual §9.1; the positions come from `<slug>.placements.json`):

- in front of the crates;
- at the boards;
- at each NPC place;
- at the plaza rim looking back;
- at the gate;
- one high view.

Use `render_build` for close-ups (`px` 6-9 with a `box`, `ymin` to cut the island away). Check every
picture against manual §9.2, each element against its chapter's picture, and the handbook's
don't-look-AI checklist (`references/spawns/README.md` §5). Lint with `inspect_build` (`checks`),
then fix and rebuild. Run the plugin's `spawn-critic` agent after every district and at the end,
until its review finds nothing above minor. Deliver only when the quality gate of manual §2.3
passes.

Later requests ("make a winter version", "add more stuff", "move the crates", "bigger") are edits
to the same `spawn.mjs`; the manual's cookbook (§8) says what to build for each.

### Step 6: deliver

Only once the audit passes and the gate of manual §2.3 holds. `build_recipe` with `export: true`,
`origin` (the world block where the schematic's minimum corner goes) and `world` writes these files
(with the scripts: `convert.mjs <slug>.nbt --out <slug>.schem`, and `.litematic`):

- the `.schem` (WorldEdit/FAWE);
- the `.litematic` (Litematica);
- the `.setup.md`: the world spawn, NPCs, holograms, crates and WorldGuard regions, as ready
  commands.

Give them those files, 3-4 screenshots, the paste corner and the world spawn (manual §11 has the
note to send). Leaderboard text, NPC names and crate titles are holograms from `setup.md`, so the
build shows only their stages and frames: that is expected.

## Setup (only for the browser renderer)

Building, inspecting, converting, `new-spawn`, `screenshot.mjs` and `isorender.mjs` work out of the box: their
one dependency (Lodestone) is bundled in `scripts/node_modules/lodestone`. Only `scripts/render.mjs`
and `preview.mjs` (perspective renders, the eye-level spawn view, the interactive viewer) need more:
run `npm install` in the skill folder, then `npx playwright install chromium` if no Chromium is found.

## The loop

With the plugin tools: `build_recipe` builds a recipe and shows an overview, `render_build` renders any
view, `inspect_build` lints and scores, `convert_build` exports. With the scripts:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/run-build.mjs" path/to/recipe.mjs --out-dir minecraft-builds/NAME --json
node "${CLAUDE_SKILL_DIR}/scripts/render.mjs" --nbt minecraft-builds/NAME/NAME.nbt          # → renders/sheet.png (se, nw, south, top)
# read sheet.png, critique, edit the recipe, repeat
```

- `--json` must report `builder.problems: []`, `builder.clipped: 0` and no `builder.warnings`
  (floating lanterns, texture leftovers...); `clippedFrom` names the recipe line that overflowed.
- Files: one PNG per view plus `sheet.png` (only when 2+ views); with `--lighting both` the files
  get `-day`/`-night` suffixes and the sheets are `sheet-day.png` / `sheet-night.png`.
- More views: `--views se,sw,ne,nw,south,north,east,west,top,hero,low`; close-up:
  `--yaw 30 --pitch 20 --target X,Y,Z --distance 14 --fov 40 --view-name door`; interiors: `--clip-y Y`;
  `--lighting night` (or `both`).
- Text checks: `node "${CLAUDE_SKILL_DIR}/scripts/inspect.mjs" FILE --checks` (flat walls, floating blocks, bad states,
  dark spots), `--slice y=N` (ASCII plan) and `--score --style medieval` (a 0–100 scorecard against
  1,212 human builds: palette breadth, partial blocks, upside-down stairs, lights, contrast, relief,
  overhangs — each out-of-band metric comes with a fix). Aim for 85+ with nothing far out of band.
- Interactive viewer for the user: `node "${CLAUDE_SKILL_DIR}/scripts/preview.mjs" --nbt FILE` (`--no-open` when headless).
- Big builds (whole spawns, islands, cities; `render.mjs` crashes above ~1M visible blocks):
  `node "${CLAUDE_SKILL_DIR}/scripts/isorender.mjs" FILE --out OUT.png --px 4 [--from se|sw|ne|nw] [--box x0,z0,x1,z1]
  [--ymin Y] [--half]` draws every block as a textured isometric cube on the CPU, any size, one image.
  `--px 2` overview, `--px 8` district close-up.

Iterate at least: massing → structure → material → detail → landscape → night. Fix the biggest
problem first (silhouette, proportions, roof, depth, texture, detail — in that order).

## Recipe skeleton

```js
export default function build(api) {
  const { kit } = api
  const b = api.builder([48, 40, 48], { seed: 7 })
  const ground = b.terrain({ height: (x, z) => 4 + 2 * kit.noise.fbm2(x, z, { scale: 24 }) })
  b.box([14, 4, 16], [30, 8, 26], 'white_wool')                       // massing placeholder
  b.box([15, 5, 17], [29, 8, 25], 'air')
  b.texture([14, 3, 16], [30, 8, 26], ['polished_andesite', 'stone_bricks', 'cracked_stone_bricks', 'tuff_bricks', 'deepslate_bricks'], { only: 'white_wool' })
  b.window([17, 5, 26], 'south', { width: 2, height: 2, recess: 1, shutters: true })
  b.door([22, 5, 26], 'south', { material: 'spruce', awning: true })
  b.roof({ x0: 14, z0: 16, x1: 30, z1: 26, y: 9, material: 'dark_oak', gable: 'spruce_planks', eaveTrim: true })
  b.tree([8, ground(8, 8) + 1, 8], 'oak', { seed: 1 })
  return b.finish({ name: 'my-build' })
}
```

The full API is in **`references/kit-api.md`**: shapes, SDFs and splines; `b.roof` (pitch
profiles, `merge` for cross gables), `b.compoundRoof` (L/T/U/courtyard plans), `b.eastRoof` and
`b.pagoda` (East-Asian), `b.coneRoof`, `b.bellRoof`, `b.roofField` (any height function), dormers;
windows, doors, arches, columns, stairways, bridges, timber framing; `b.texture` and `b.weather`;
trees, `b.forest`, terrain, `b.groundY`, paths, ponds; sculpting (`b.hull`, `b.figure`,
`b.shadeSurface`, `b.erode`, `b.rockArch`...); settlements (`kit.plan`); modules and
`b.importStructure`. The raw API (`api.setBlock`, `api.fill`, Lodestone classes) is in
`references/recipe-api.md` and still works.

Reading budget for a first build (~1,500 lines): the handbook README (laws, workflow), the kit-api
sections you need, your style's section in `styles.md`, and the closest example recipe. Open the
other chapters when the build needs them.

## What to read

| Task | Read |
| --- | --- |
| Any build | `references/building/README.md` (laws, workflow, scale tiers, cheat sheets) |
| Server spawn, lobby, hub, PvP lobby | the steps above, the spawn manual `references/spawns/build-guide.md` with its element pictures and examples, the spawn handbook `references/spawns/README.md`; research: `corpus-study.md`, `design-research.md`, `case-studies.md`; reference spawns: `assets/examples/spawns/` |
| Judging and fixing your renders | `references/building/quality-and-critique.md` |
| Numeric targets (distinct ids, partial-block %, lights, contrast) per style and size | `references/building/benchmarks.md` |
| What skilled community builders do differently (measured idioms, cross-sections) | `references/building/community-lessons.md` |
| A specific style (medieval, gothic, Japanese, nordic, desert, fantasy, modern...) | `references/building/styles.md` |
| Roofs, windows, doors, towers, arches, walls, balconies, bridges | `references/building/components.md` |
| Massing, proportion, depth, framing, foundations | `references/building/principles.md` |
| Choosing blocks and colours | `references/building/palettes.md`, `block-colors.md`, `materials.md` |
| Small detail blocks and furniture-like modules | `references/building/detailing.md` |
| Getting a block's orientation right | `references/building/block-states.md` |
| Trees, terrain, rocks, water, gardens | `references/building/nature.md` |
| Interiors and lighting | `references/building/interiors-and-lighting.md` |
| Villages, cities, castles, megabuilds | `references/building/composition.md` |
| Statues, creatures, ships, crystals, clouds | `references/building/sculpting.md` |
| Generative algorithms (SDFs, grammars, L-systems, roof solvers) | `references/building/procedural.md` |
| Mojang's own building language | `references/building/vanilla-lessons.md` |
| Importing/exporting .schem/.litematic/.schematic, getting builds into the game | `references/formats.md` |
| Lodestone internals (renderer, NBT, structure) | `references/lodestone/` |

Search before guessing: `rg -n "keyword" references/`.

## Examples

Start new recipes from `assets/templates/recipe-template.mjs` (staged: brief → site → massing →
structure → material → detail → landscape → light). `assets/examples/` holds complete showcase
recipes, each commented as teaching material (design brief, palette roles with L*, proportions, why
each technique is used). Read the one closest to your task first; reuse its structure, not its
exact numbers.

| Example | Shows |
| --- | --- |
| `medieval-house.mjs` | Wealden hall + jettied cross-wing, clay-tile roofs, porch, bay window, furnished rooms, cottage garden |
| `tavern.mjs` | coaching inn whose interior is the star: taproom, kitchen, guest rooms; cutaway renders |
| `castle.mjs` | moated hilltop castle: curtain walls, varied tower tops, gatehouse, furnished keep, courtyard |
| `gothic-cathedral.mjs` | Latin-cross cathedral: flying-buttress modules, rose windows, spires, groin vaults, graveyard |
| `wizard-tower.mjs` | leaning fantasy tower on an eroded crag, witch-hat roof, spiral stairs, night magic |
| `japanese-shrine.mjs` | torii approach, irimoya hall, five-storey pagoda, koi pond, bamboo and cherry garden |
| `nordic-longhouse.mjs` | Viking longhouse with turf roof on a fjord, longship, pine forest |
| `desert-palace.mjs` | Moorish palace: onion dome, iwan, minarets, arcaded court, oasis, market |
| `coastal-village.mjs` | Cycladic cliff village: generated houses, blue-domed chapel, harbour, windmill |
| `modern-villa.mjs` | cantilevered cliff villa, infinity pool, glazing with furnished interiors |
| `elven-treehouse.mjs` | colossal buttressed tree with platforms, pavilions, bridges, glowing night |
| `pirate-cove.mjs` | sculpted cove with a three-masted galleon (`b.hull`), stilted shanty town, docks |
| `walled-village.mjs` | settlement planning with `kit.plan`: roads, lots, curtain wall, plaza, skyline |
| `celestial-forge.mjs` | the original raw-API example (no kit) |
| `spawn-kit-demo.mjs` | a compact SMP spawn using every spawn-kit component: leaderboard wall with podium, crate arcade, NPC pedestal/alcove/booth/kiosk, RTP gate, signs, spawn-proofing, placements export |
| `spawns/ember-smp.mjs` | reference spawn, normal (round plaza, autumn): NPC rings, open-air boards and crates, top-3 pillars, a ring of buildings |
| `spawns/frost-smp.mjs` | reference spawn, normal (square plaza, winter): a hand-written hero tree, cabins, `snowfall` |
| `spawns/oakhaven-hub.mjs` | reference spawn, spawn+: a town with a building per NPC, a hero wall with the name, a crate yard |
| `spawns/kirin-practice.mjs` | reference spawn, PvP lobby: a dais, a queue arc, an FFA arena |
| `spawns/pirate-isle.mjs` | reference spawn, tropical island: landmarks, a warzone with a moshpit and KOTH, colourful signs |

## Facts that prevent most mistakes

- Players see about 160-200 blocks at a normal render distance (10-12 chunks): what the first view
  must show (a mountain, the hero) stands within that of the spawn point; screenshots use
  `--far 260` by default, more for overviews.
- Coordinates: `x` east, `y` up, `z` south. Everything must fit inside the builder size; out-of-range
  placements are skipped and counted.
- Stairs `facing` = side of the tall back (you walk up toward it). Wall features (windows, doors,
  shutters) take the wall's **outward** facing. See `block-states.md` for every other block.
- Block set is **Minecraft Java 1.21.1** (tuff bricks, copper bulbs, trial blocks: yes; pale oak,
  resin, 1.21.9 copper chains/lanterns: no). The chain block is `minecraft:chain`.
- `finish()` and `run-build` validate every state against the official 1.21.1 block table, fill
  missing properties with vanilla defaults (the previewer renders a block with missing properties
  as nothing), add door/bed/tall-plant partners and vine faces, make leaves persistent, and compute
  stair corners, wall posts/heights, fence/pane links and gates like the game does on placement.
  Hand-set stair `shape` values are recomputed.
- Output DataVersion defaults to 3955 (1.21.1); newer games upgrade it automatically. Use
  `--data-version` for older targets.
- Entities (item frames, armor stands, paintings) are not exported. Sign text and banner patterns
  render unreliably — build detail from blocks. The previewer does not propagate light; night mode
  shows emissive blocks glowing.
- Standing sign/banner/head `rotation` previews mirrored east↔west; write the vanilla value anyway.
- Vanilla structure blocks load at most 48×48×48; `/place template` and WorldEdit/Litematica have no
  such limit (`references/formats.md`).

## Export to other formats

```bash
node "${CLAUDE_SKILL_DIR}/scripts/convert.mjs" minecraft-builds/NAME/NAME.nbt --out NAME.schem       # WorldEdit
node "${CLAUDE_SKILL_DIR}/scripts/convert.mjs" minecraft-builds/NAME/NAME.nbt --out NAME.litematic   # Litematica
node "${CLAUDE_SKILL_DIR}/scripts/convert.mjs" some-download.litematic --out study.nbt               # import to study/render/remix
```

Stamp an existing schematic into a recipe (study, remix or reuse it), rotated or mirrored:
`b.importStructure('path/to/build.schem', [x, y, z], { rotate: 1 })` (any of the formats above).
