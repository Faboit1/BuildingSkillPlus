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

**Server spawn, lobby or hub?** You design and build it yourself: the interview, a plan, then you
write the spawn's recipe with the spawn parts and the build guide, build it, look at screenshots,
and fix it until it is great (next section). The one-call generator (`make_spawn`) is only for when
the user asks for it ("use the generator", "a quick one").

**Anything else:** you write a JavaScript **recipe** with the building kit, export a vanilla structure
`.nbt`, then **render it and look at the PNGs**. Quality comes from that loop. The building craft itself —
proportions, depth, palettes, roofs, styles, landscaping, lighting — lives in
`references/building/`. Read `references/building/README.md` (the handbook) before every build.

## Server spawns and lobbies: build them yourself (the main use)

You are the build team. Everything the generator knew is written down for you:
`references/spawns/build-guide.md` (how every piece is built, with the numbers, the layouts that
work, what to do for "make a winter version" or "add more stuff") and complete example spawns in
`assets/examples/spawns/` (normal round and square plazas, a spawn+ town, a PvP lobby, a tropical
island with landmarks and a warzone). Read the guide and the closest example before you write.

### Step 0: your tools

- **Plugin tools (preferred).** This plugin's MCP server `minecraft` gives you `new_spawn` (the spawn
  folder), `build_recipe` (build it; returns the overview and the view from the spawn point),
  `screenshot` (what a player sees, from any spot), `render_build` (isometric views and close-ups),
  `inspect_build` (lint), `convert_build` (in Claude Code they are named like
  `mcp__plugin_minecraft-builder_minecraft__build_recipe`). Their results include images: look at them.
- **Scripts (same results, when the tools are not listed, e.g. in claude.ai chat):**
  `node "${CLAUDE_SKILL_DIR}/scripts/new-spawn.mjs" "<name>"`, `run-build.mjs <spawn.mjs> --out-dir
  <folder> --json`, `screenshot.mjs <file.nbt> --spawn`, `isorender.mjs <file.nbt> --out x.png`
  (Node 20.19+; the dependencies are bundled in `scripts/node_modules`, nothing to install). Read the
  PNGs with the Read tool. Only if the folder is incomplete:
  `git clone https://github.com/Faboit1/BuildingSkillPlus` and use its `scripts/`.

### Step 1: the interview (never skip, never build from a one-line request)

Use the `AskUserQuestion` tool, up to 4 questions per call. **Every question has a "Let Claude
decide" option** (then you choose what fits their server best and say what you chose in the plan).
Mark the option you recommend with "(Recommended)". The user can always type their own answer.

**Round 1** (one call):
1. **Type**: *Normal spawn* (FreshSMP-like: a big flat plaza, the NPCs on plinths in rings round the
   spawn, boards and crates in the open, big buildings all round; best for most SMPs) / *Spawn+*
   (DonutSMP-like: a town, every NPC its own building) / *PvP lobby* (queue NPCs in an arc, an
   arena) / *Surprise me* (you pick everything).
2. **Size** in blocks: *Let Claude decide* (from the NPC count: ~220 normal, ~190 spawn+, ~110 PvP) /
   160 x 160 / 220 x 220 / 300 x 300.
3. **How many NPCs**: 6 / 10 / 14 / Let Claude decide (they can type any number).
4. **Theme**: the 3 themes that fit their server best + Let Claude decide; list all eight in the
   question text: autumn, medieval, white-town, japanese, winter, fantasy, crimson (dark red,
   nether-like; lifesteal), tropical (palms, sand; pirate islands). Any other look works too
   (desert, candy, sci-fi): build it from the closest theme.

**Surprise me:** ask only the server name, then pick everything at random — roll real dice
(`node -e "console.log(Math.random())"` per choice, so two surprises differ): type, theme, setting,
accent, NPC count, the options of rounds 3-4. Say what the dice picked in the plan.

**Round 2** (one call): the **server name** (block letters only if they want signs; holograms
otherwise), **which NPCs** (multiSelect: shop, auction, kits, store, quests, sell, warps, events,
vote, tutorial / PvP: unranked, ranked, FFA, kit editor, duels, events), **which leaderboards**
(multiSelect: Money, Kills, Playtime, Blocks Mined, Votes / PvP: Elo, Wins, Streak), **which crates**
(multiSelect: Vote, Common, Rare, Epic, Legendary, Seasonal). Each with Let Claude decide.

**Round 3** (one call, the options; all optional):
1. **Top-3 pillars** (the top 3 players as statues on pillars): *Top Spenders + Baltop* / *Baltop
   only* / *None* / *Let Claude decide*.
2. **Warzone** (a PvP band round the spawn behind a red concrete line): *No* / *Warzone with a
   moshpit and a KOTH hill* / *Warzone only* / *Let Claude decide*.
3. **Big things round the spawn** (multiSelect): *Giant trees* / *Landmarks* (volcano, ship,
   lighthouse, a giant statue, rock spires or an arch) / *Raised areas (1-4 blocks) and rocks here
   and there* / *Let Claude decide*.
4. **Section signs** in block letters (CRATES, LEADERBOARDS...; real spawns mostly use holograms):
   *No, holograms only (Recommended)* / *Short* (small quartz letters with slabs and stairs) /
   *Colourful* (concrete and terracotta) / *Let Claude decide*.

**Round 4** (follow-ups, only what is still open): the **setting** (plains / island / valley /
mountain / coast), the **accent colour** (blue, red, orange, purple, cyan...; never gold), **extras**
(RTP gate, PvP ruin, AFK pond; multiSelect), **where it goes** (paste corner and world, or "centred on
0,0"). If they want signs: **outline** (yes / no / Let Claude decide) and **thick text** (yes / no /
Let Claude decide), and which titles. If they want landmarks: which ones.

### Step 2: the plan (show it, get a yes)

Read `references/spawns/build-guide.md` §1-5 and the closest example in `assets/examples/spawns/`.
Then write the plan: the answers (and what you decided for "Let Claude decide"), the canvas size,
and a top-view sketch with the main numbers (the plaza radius, the rings or rows, where each
section, landmark and the warzone go, the first view from the spawn). Show it and ask "Build this?".

### Step 3: build it, section by section

1. `new_spawn` with the name and the plan (`brief`): it makes `minecraft-builds/<slug>/` with
   `spawn.mjs` (a skeleton), `parts/` (your own copy of the spawn parts, editable), `examples/` and
   `brief.md`. (`from: "<example>"` starts from an example instead, only when the brief is close to
   it; then reshape every section.)
2. Write `spawn.mjs` in this order, **building with `build_recipe` after each step and looking at
   the images**: plan + site + plaza + spawn point → NPCs, boards, crates, gates → buildings and
   walks → set pieces, planting, props, `landscapePass` → seasonal passes and details.
3. Fix every `problems`, `clipped` and warning line `build_recipe` reports before going on.

### Step 4: look, critique, fix (at least two rounds after it is "done")

`build_recipe` returns the overview and the screenshot from the spawn point. Take more:
`screenshot` from a player's spots (in front of the crates, at the boards, at the plaza rim looking
back, at the gate), `render_build` close-ups (`px` 6-8 with a `box`, `ymin` to cut the island away).
Check them against the guide's §9 and the handbook's don't-look-AI checklist
(`references/spawns/README.md` §5): the first view, every NPC/crate/board reachable and readable,
nothing floating, structured floors, variety, no mirrored layout. Lint with `inspect_build`
(`checks`). The plugin's `spawn-critic` agent gives a second opinion with ranked fixes. Fix in
`spawn.mjs` (or your `parts/`), rebuild, look again.

Later requests ("make a winter version", "add more stuff", "move the crates", "bigger") are edits
to the same `spawn.mjs`: the guide's §7 says how.

### Step 5: deliver

`build_recipe` with `export: true` (plus `origin` / `world` if they gave the paste corner) writes
the `.schem` (WorldEdit/FAWE), `.litematic` (Litematica) and `.setup.md` (world spawn, NPCs,
holograms, crates, WorldGuard regions with ready commands). Give them those files, 3-4 screenshots,
the paste corner and the world spawn. Leaderboard text, NPC names and crate titles are holograms
from `setup.md`, so the build shows only their plinths and boards: that is expected.

### The quick generator (only when the user asks for it)

`make_spawn` builds a whole spawn from a JSON brief in one call (fixed layouts: normal, spawn+,
PvP), `rebuild_spawn` rebuilds its editable `<slug>.recipe.mjs`, `spawn_options` lists what the
brief takes (themes, settings, NPC ids, top3, warzone, landmarks, bigTrees, terraces, rocks,
surprise, signs). Scripts: `node "${CLAUDE_SKILL_DIR}/scripts/make-spawn.mjs" brief.json`. Use it
only when the user asks for the generator or a quick automatic spawn; examples of briefs are in
`assets/spawn-briefs/`.

## Setup (only for the browser renderer)

Building, inspecting, converting, `new-spawn`, `make-spawn`, `screenshot.mjs` and `isorender.mjs` work out of the box: their
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
| Server spawn, lobby, hub, PvP lobby | the steps above, `references/spawns/build-guide.md`, `assets/examples/spawns/`, the spawn handbook `references/spawns/README.md`; research: `corpus-study.md`, `design-research.md`, `case-studies.md` |
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
| `spawns/ember-smp.mjs` | hand-built normal spawn (round plaza, autumn): NPC rings, open-air boards and crates, top-3 pillars, a ring of buildings |
| `spawns/frost-smp.mjs` | hand-built normal spawn (square plaza, winter): a hand-written hero tree, cabins, `snowfall` |
| `spawns/oakhaven-hub.mjs` | hand-built spawn+ town: a building per NPC, hero wall with the name, crate yard with a sign |
| `spawns/kirin-practice.mjs` | hand-built PvP lobby: dais, queue arc, FFA arena |
| `spawns/pirate-isle.mjs` | hand-built tropical island: landmarks, a warzone with a moshpit and KOTH, colourful signs |

## Facts that prevent most mistakes

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
