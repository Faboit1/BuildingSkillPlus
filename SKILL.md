---
name: minecraft-builder
description: Design and generate high-quality Minecraft builds — above all server spawns and lobbies (SMP spawns with NPC places, leaderboards and crates, DonutSMP-style multi-building hubs, FreshSMP-style terrain spawns, PvP lobbies), plus houses, castles, cathedrals, towers, villages, temples, ships, statues, trees, terrain and whole scenes — as vanilla structure .nbt (or .schem/.litematic, or ready-to-paste region files) using a JavaScript building kit, then render them headlessly to critique and iterate. Use for any request to build, design, generate, export, preview, import or improve a Minecraft build, spawn, lobby, hub, schematic or structure.
---

# Minecraft Builder

**Paths.** Everything this skill mentions (`scripts/`, `references/`, `assets/`) is inside this
skill's own folder, `${CLAUDE_SKILL_DIR}` (the folder holding this SKILL.md; in the plugin it is the
plugin root, `${CLAUDE_PLUGIN_ROOT}`). Read files and run scripts with that prefix, e.g.
`node "${CLAUDE_SKILL_DIR}/scripts/make-spawn.mjs"`. Builds are written to `minecraft-builds/` in the
user's current folder.

**Server spawn, lobby or hub?** Follow the five steps in the next section: an interview, a brief,
one tool call (`make_spawn`), a look at the images, delivery.

**Anything else:** you write a JavaScript **recipe** with the building kit, export a vanilla structure
`.nbt`, then **render it and look at the PNGs**. Quality comes from that loop. The building craft itself —
proportions, depth, palettes, roofs, styles, landscaping, lighting — lives in
`references/building/`. Read `references/building/README.md` (the handbook) before every build.

## Server spawns and lobbies: use the generator (the main use)

For a server spawn, lobby or hub, **do not hand-write a recipe**. Follow these five steps exactly.
The generator builds the whole spawn from a short brief: island terrain, the plaza, NPC places,
leaderboards with the server name, crates, the RTP gate, the PvP zone, themed buildings, trees and
lighting, already spawn-proofed, plus the plugin setup sheet and renders.

### Step 0: pick your tools

- **Plugin tools (preferred).** This plugin's MCP server `minecraft` gives you `spawn_options`,
  `make_spawn`, `rebuild_spawn`, `render_build`, `inspect_build`, `convert_build` and `build_recipe`
  (in Claude Code they are named like `mcp__plugin_minecraft-builder_minecraft__make_spawn`). Their
  results include the renders as images, so you see the spawn straight away.
- **Scripts (same results, when the tools are not listed, e.g. in claude.ai chat).** Check with
  `node "${CLAUDE_SKILL_DIR}/scripts/make-spawn.mjs" --help` (Node 20.19+; the dependencies are
  bundled in `scripts/node_modules`, nothing to install). Only if that fails because the folder is
  incomplete: `git clone https://github.com/Faboit1/BuildingSkillPlus` and use its `scripts/`.

### Step 1: interview (never skip, never build from a one-line request)

Use the `AskUserQuestion` tool. Mark the option you recommend with "(Recommended)".

Call `spawn_options` first (scripts: read `assets/spawn-briefs/*.json` and the table in Step 2):
it lists the themes, settings, NPC ids and the recommended size for an NPC count.

**Round 1** (one call, four questions):
1. **Type**: *Normal spawn* (FreshSMP-like: a big flat plaza with the NPCs on plinths in rings round
   the spawn, trees in grass beds, big buildings all round, crates and leaderboards out in the open;
   best for most SMPs) / *Spawn+* (DonutSMP-like: a town where every NPC has its own building) /
   *PvP lobby* (queue NPCs in an arc, an FFA arena).
2. **Size** in blocks: *Recommended for the NPC count* (about 220 for a normal spawn) / 160 x 160 /
   220 x 220 / 300 x 300.
3. **How many NPCs**: e.g. 6 / 8 / 12 / 16 (the user can type any number).
4. **Theme**: autumn / medieval / white-town / japanese / winter / fantasy / crimson (dark red,
   nether-like; good for lifesteal). One question shows at most 4 options: offer the 3 that fit their
   server best plus "Other", and list all seven in the question text.

**Round 2** (one call): the **server name** (block letters on the hero wall), **which NPCs**
(multiSelect from the type's list below, or they type their own), **which leaderboards**
(multiSelect: Money, Kills, Playtime, Blocks Mined, Deaths, Votes / for PvP: Elo, Wins, Streak),
**which crates** (multiSelect: Vote, Common, Rare, Epic, Legendary, Seasonal).

**Round 3** (one call, follow-ups): the **setting** (island / valley / mountain / coast / plains),
an **accent colour** (blue, red, orange, purple, cyan...; never gold), **extras** (PvP zone, AFK
area, RTP gate; multiSelect), and **where it goes** (paste corner and world name, or "centred on 0,0").

Then show the brief as JSON and ask "Build this?". Build only after a yes.

### Step 2: write the brief

The brief is a small JSON object (the `brief` argument of `make_spawn`; with the scripts, save it as
`minecraft-builds/<slug>/brief.json`). Only `name` and `type` are required; leave out what the user
did not decide (good defaults fill it). Examples: `assets/spawn-briefs/*.json`.

| Field | Values | Default |
| --- | --- | --- |
| `name` | the server name | `"Spawn"` |
| `type` | `"normal"`, `"plus"`, `"pvp"` | `"normal"` |
| `size` | blocks across (square) | recommended for the NPC count |
| `npcs` | a number, or a list of ids/labels: `["shop", "auction", "rtp"]` or `[{ "id": "crates_guy", "label": "Crate Keys" }]` | 7 / 12 / 6 |
| `theme` | `autumn`, `medieval`, `white-town`, `japanese`, `winter`, `fantasy`, `crimson` | `medieval` (pvp: `japanese`) |
| `setting` | `island`, `plains`, `valley`, `mountain`, `coast` | the theme's |
| `accent` | a dye colour: `blue`, `red`, `orange`, `purple`, `cyan`, `lime`... | the theme's |
| `leaderboards` | a number or labels: `["Money", "Kills", "Playtime"]` | 3 (plus: 4) |
| `crates` | a number, labels, or `[{ "id", "label", "tier" }]` (tiers: common, uncommon, rare, epic, legendary, mythic, vote, seasonal) | 4 (pvp: 2) |
| `features` | `{ "rtp": true, "pvp": true, "afk": false, "signs": false }` | rtp; pvp zone except in a pvp lobby; afk in spawn+; no block-letter signs (real spawns label everything with holograms; `signs: true` puts the server name in quartz letters on the spawn+ town hall) |
| `seed` | any number: a different variation of the same brief | 7 |
| `origin` | `[x, y, z]` where the minimum corner is pasted | centred on 0, 0 at y 64 |
| `world` | the world name used in the setup commands | `"world"` |

A look that is not one of the themes (e.g. "ocean", "desert", "candy"): pick the closest theme, set
`accent` to their colour, tell the user which theme you used, and add the missing touches in Step 4's
`after(ctx)` (extra trees, statues, banners in their colour).

NPC ids the generator knows (any other id works too and becomes its own label):
normal/plus: `shop, auction, rtp, store, kits, quests, sell, warps, events, bounties, teams,
tutorial, afk, vote, duels, enchanter`; pvp: `unranked, ranked, ffa, kits, events, store, duels, bots`.

### Step 3: generate

Call `make_spawn` with `{ "brief": { ... } }`. With the scripts:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/make-spawn.mjs" minecraft-builds/<slug>/brief.json
```

Either way it reports every file it wrote (`.recipe.mjs`, `.nbt`, `.schem`, `.litematic`, `.placements.json`,
`.setup.md`, `renders/*.png`), the world spawn, the NPC list and any warnings. A warning that the size
is small: raise `size` (or leave it out) and run again.

### Step 4: look at the renders, fix, rebuild

Look at the images `make_spawn` returned, and open the other PNGs in `minecraft-builds/<slug>/renders/`
with the Read tool (overviews from two sides, the plaza close-up and, if Playwright is installed, the
eye-level spawn view); `render_build` makes more views (another corner, `px` 6-8 with a `box` crop). Check: the name sign reads;
the plaza, the NPC places, the boards and the crates are visible and not buried in trees; nothing
floats or overlaps. Leaderboard text, NPC names and crate titles are holograms set up from
`setup.md`, so renders show only the dark board backdrops, the plinths and the chests: that is
expected. Then lint it with `inspect_build` (mode `checks`) on `minecraft-builds/<slug>/<slug>.nbt`,
or `node "${CLAUDE_SKILL_DIR}/scripts/inspect.mjs" minecraft-builds/<slug>/<slug>.nbt --checks`.

Only `flat-walls` and `palette-size` notes are normal for a spawn; anything else (floating blocks,
support, plant-soil, fluids) is worth fixing in `after(ctx)`. (In `--score`, "base columns over air"
is always high for a floating island; ignore it.) To change something:
- Different look of the same plan: change `seed` (or `theme`, `setting`, `accent`) in the brief and
  run Step 3 again.
- Hand additions (a statue, an extra tree, a fountain...): edit `after(ctx)` in
  `minecraft-builds/<slug>/<slug>.recipe.mjs` (it has the builder `ctx.b`, `ctx.FY` = plaza floor
  level, `ctx.C` = spawn column, `ctx.layout` = every slot) and rebuild with `rebuild_spawn`
  (`node "${CLAUDE_SKILL_DIR}/scripts/make-spawn.mjs" --recipe minecraft-builds/<slug>/<slug>.recipe.mjs`).
- A second opinion: the plugin's `spawn-critic` agent reviews the renders and lint against the
  spawn handbook and returns ranked fixes.

### Step 5: deliver

Give the user: the `.schem` (WorldEdit/FAWE) and `.litematic` (Litematica), the `.setup.md` (world
spawn, Citizens/FancyNpcs NPCs, DecentHolograms, crates, WorldGuard regions with ready commands), and
the renders. Tell them the paste corner and the world spawn printed in Step 3.

To go beyond the generator (a hand-built spawn, a custom layout), read `references/spawns/README.md`
(the spawn handbook: interview, program, measured numbers, anti-AI checklist) and use the spawn kit
(`references/kit-api.md` → "Spawn & lobby kit"); `assets/examples/spawn-kit-demo.mjs` uses every part.

## Setup (only for the browser renderer)

Building, inspecting, converting, `make-spawn` and `scripts/isorender.mjs` work out of the box: their
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
| Server spawn, lobby, hub, PvP lobby | the five steps above (`scripts/make-spawn.mjs`); for hand-built spawns `references/spawns/README.md`, then `corpus-study.md`, `design-research.md`, `case-studies.md` |
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
