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
| A server spawn, lobby or hub | build it yourself from a template: the six steps below. This is the main use |
| "Use the generator", "a quick one" | `make_spawn` with a brief (the end of the next section) |
| Any other build (a house, a castle, a statue, terrain...) | write a recipe with the building kit, render, critique, repeat ("The loop" below); read `references/building/README.md` first |

## Server spawns and lobbies: build them yourself

You are the build team. The spawn manual, `references/spawns/build-guide.md`, holds everything:
what makes a spawn great (with the numbers), the templates and how to change them safely, every
part, tested code for what users ask for ("a winter version", "add a market", "their own theme"),
how to look at your build like a player, and delivery. Read its §1-§4 before your first spawn and
keep it open while you work.

**The templates.** `new_spawn` starts every spawn from the template for its type: the generator's
own layout written out as a recipe, so the first build is already as good as the generator. Each has
a **BRIEF** block (what this server is: theme, NPCs, boards, crates, options) and a **CUSTOM** block
(what you add: `plan`, `build`, `finish`). You change those two, and the layout adapts by itself.

| Type | Template | The idea |
| --- | --- | --- |
| `normal` | `ember-smp` | FreshSMP-like: a big flat plaza, NPCs on plinths in rings round the spawn, boards and crates in the open, a ring of big buildings. Best for most SMPs |
| `plus` | `oakhaven-hub` | DonutSMP-like: a town round a square hub, every NPC its own building, the name on a hero wall |
| `pvp` | `kirin-practice` | a compact PvP lobby: queue NPCs in an arc facing the spawn dais, an FFA arena |

Two showcases to borrow from: `frost-smp` (a square winter plaza with a hand-written Christmas tree
and `snowfall`) and `pirate-isle` (a tropical island with landmarks and a warzone).

### Step 0: your tools

- **Plugin tools (preferred).** This plugin's MCP server `minecraft`: `new_spawn` (the spawn folder),
  `build_recipe` (build it; returns the report, the overview and the view from the spawn point),
  `screenshot` (what a player sees, from any spot), `render_build` (isometric views and close-ups),
  `inspect_build` (lint), `convert_build`. In Claude Code they are named like
  `mcp__plugin_minecraft-builder_minecraft__build_recipe`. Their results include images: look at them.
- **Scripts (the same results, when the tools are not listed, e.g. in claude.ai chat):**
  `node "${CLAUDE_SKILL_DIR}/scripts/new-spawn.mjs" "<name>" --type normal|plus|pvp`,
  `run-build.mjs <spawn.mjs> --out-dir <folder> --json`, `screenshot.mjs <file.nbt> --spawn` (or
  `--shots '<json>'`), `isorender.mjs <file.nbt> --out x.png` (Node 20.19+; the dependencies are
  bundled in `scripts/node_modules`, nothing to install). Read the PNGs with the Read tool. Only if the
  folder is incomplete: `git clone https://github.com/Faboit1/BuildingSkillPlus` and use its `scripts/`.

### Step 1: the interview (never skip it, never build from a one-line request)

Use the `AskUserQuestion` tool, up to 4 questions per call. **Every question has a "Let Claude
decide" option** (then you choose what fits their server and say what you chose in the plan). Mark
the option you recommend with "(Recommended)". The user can always type their own answer. Skip what
their request already answered.

**Round 1** (one call):
1. **Type**: *Normal spawn* (a big flat plaza, the NPCs on plinths in rings round the spawn, boards
   and crates in the open, big buildings all round; best for most SMPs) / *Spawn+* (a town, every NPC
   its own building) / *PvP lobby* (queue NPCs in an arc, an arena) / *Surprise me* (you pick everything).
2. **Size** in blocks: *Let Claude decide* (from the NPC count: ~220 normal, ~190 spawn+, ~110 PvP) /
   160 x 160 / 220 x 220 / 300 x 300.
3. **How many NPCs**: 6 / 10 / 14 / Let Claude decide (they can type any number).
4. **Theme**: the 3 themes that fit their server best + Let Claude decide; list all eight in the
   question text: autumn, medieval, white-town, japanese, winter, fantasy, crimson (dark red,
   nether-like; lifesteal), tropical (palms, sand; pirate islands). Any other look (desert, candy,
   sci-fi) becomes your own theme built on the closest one (manual §9.2).

**Surprise me:** ask only the server name, then pick everything at random. Roll real dice
(`node -e "console.log(Math.random())"` per choice, so two surprises differ): type, theme, setting,
accent, NPC count and the options of rounds 3-4. Say what the dice picked in the plan.

**Round 2** (one call): the **server name**, **which NPCs** (multiSelect: shop, auction, kits, store,
quests, sell, warps, events, vote, tutorial / PvP: unranked, ranked, FFA, kit editor, duels, events),
**which leaderboards** (multiSelect: Money, Kills, Playtime, Blocks Mined, Votes / PvP: Elo, Wins,
Streak), **which crates** (multiSelect: Vote, Common, Rare, Epic, Legendary, Seasonal). Each with Let
Claude decide.

**Round 3** (one call, the options; all optional):
1. **Top-3 pillars** (the top 3 players as statues on pillars): *Top Spenders + Baltop* / *Baltop
   only* / *None* / *Let Claude decide*.
2. **Warzone** (a PvP band round the spawn behind a red line): *No* / *Warzone with a moshpit and a
   KOTH hill* / *Warzone only* / *Let Claude decide*.
3. **Big things round the spawn** (multiSelect): *Giant trees* / *Landmarks* (volcano, ship,
   lighthouse, a giant statue, rock spires or an arch) / *Raised areas and rocks* / *Let Claude decide*.
4. **Section signs** in block letters (real spawns mostly use holograms): *No, holograms only
   (Recommended)* / *Short* (small quartz letters) / *Colourful* (concrete and terracotta) / *Let
   Claude decide*.

**Round 4** (only what is still open): the **setting** (plains / island / valley / mountain / coast),
the **accent colour** (one dye; never gold), **extras** (RTP gate, PvP ruin, AFK pool, anything of
their own: a market, a statue of their mascot, a building for something; multiSelect), **where it
goes** (the world and the paste corner, or "centred on 0, 0"). For signs: outline and thick text. For
landmarks: which ones.

### Step 2: the plan (show it, get a yes)

Write the plan into `brief.md` (manual §2 has an example): the answers and what you decided, which
BRIEF field or CUSTOM piece each answer becomes, the canvas size, and a top-view sketch with the
main numbers (the rings or the town, where each section, landmark and extra goes, the first view
from the spawn). Show it and ask "Build this?".

### Step 3: the base

1. `new_spawn` with `name`, `type` (`normal`, `plus` or `pvp`) and `brief` (the plan). It makes
   `minecraft-builds/<slug>/` with `spawn.mjs` (the template), `parts/` (your own editable copy of
   the spawn parts), `examples/` and `brief.md`.
2. **Set the BRIEF block** to the answers (manual §4.1 lists every field) and build with
   `build_recipe`. The layout adapts to the BRIEF (the rings, the town's plaza, the canvas), so never
   hand-edit layout numbers to fit a different program. Fix every `problems`, `clipped` and warning
   line before going on.

### Step 4: make it theirs

Everything the BRIEF cannot say goes in the **CUSTOM block** (manual §4.3-§4.4):

- `plan(ctx, L)`: reserve the ground of each piece (`findSpot`, `L.slot`); return what you planned.
  In the normal template it runs before the buildings, so they fill round your pieces.
- `build(ctx, L, mine)`: build them, before the landscape pass (the woodland grows round them).
- `finish(ctx, L, mine)`: seasonal passes (`snowfall`, `leafLitter`) and last touches.

The manual's cookbook (§8) maps every common request to its change, with tested code: a gateway
arch framing the first view, a market square, a building of their own with its NPC, a statue, a
winter version, the crates on the other side, a theme of their own. Add one piece at a time, build
after each, look at the images every time.

### Step 5: look like a player, fix, repeat

`build_recipe` returns the overview and the spawn view. Take more with `screenshot` from the
player's spots (manual §10.1: the positions come from `<slug>.placements.json`): in front of the
crates, at the boards, at the plaza rim looking back, at the gate, each of your pieces, one high
view; `render_build` close-ups (`px` 6-9 with a `box`, `ymin` to cut the island away). Check every
picture against manual §10.2 and the handbook's don't-look-AI checklist (`references/spawns/README.md`
§5), lint with `inspect_build` (`checks`), fix, rebuild. At least two rounds after you think it is
done. The plugin's `spawn-critic` agent gives a second opinion with ranked fixes.

Later requests ("make a winter version", "add more stuff", "move the crates", "bigger") are edits to
the same `spawn.mjs`: the cookbook says which.

### Step 6: deliver

`build_recipe` with `export: true`, `origin` (the world block where the schematic's minimum corner
goes) and `world` writes the `.schem` (WorldEdit/FAWE), `.litematic` (Litematica) and `.setup.md`
(world spawn, NPCs, holograms, crates, WorldGuard regions, ready commands). Give them those files,
3-4 screenshots, the paste corner and the world spawn (manual §12 has the note to send). Leaderboard
text, NPC names and crate titles are holograms from `setup.md`, so the build shows only their
plinths and boards: that is expected.

### The quick generator (only when the user asks for it)

`make_spawn` builds a whole spawn from a JSON brief in one call (fixed layouts: normal, spawn+,
PvP), `rebuild_spawn` rebuilds its editable `<slug>.recipe.mjs`, `spawn_options` lists what the
brief takes (themes, settings, NPC ids, top3, warzone, landmarks, bigTrees, terraces, rocks,
surprise, signs). Scripts: `node "${CLAUDE_SKILL_DIR}/scripts/make-spawn.mjs" brief.json`. Examples of
briefs are in `assets/spawn-briefs/`.

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
| Server spawn, lobby, hub, PvP lobby | the steps above, the spawn manual `references/spawns/build-guide.md`, the templates in `assets/examples/spawns/`, the spawn handbook `references/spawns/README.md`; research: `corpus-study.md`, `design-research.md`, `case-studies.md` |
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
| `spawns/ember-smp.mjs` | **the normal template** (round plaza, autumn): NPC rings, open-air boards and crates, top-3 pillars, a ring of buildings; BRIEF + CUSTOM |
| `spawns/frost-smp.mjs` | hand-built normal spawn (square plaza, winter): a hand-written hero tree, cabins, `snowfall` |
| `spawns/oakhaven-hub.mjs` | **the spawn+ template**: a town with a building per NPC, a hero wall with the name, a crate yard; BRIEF + CUSTOM |
| `spawns/kirin-practice.mjs` | **the PvP template**: a dais, a queue arc, an FFA arena; BRIEF + CUSTOM |
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
