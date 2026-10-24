---
name: minecraft-builder-skill
description: Design and generate high-quality Minecraft builds — houses, castles, cathedrals, towers, villages, temples, ships, statues, trees, terrain and whole scenes — as vanilla structure .nbt (or .schem/.litematic) using a JavaScript building kit, then render them headlessly to critique and iterate. Use for any request to build, design, generate, export, preview, import or improve a Minecraft build, schematic or structure.
---

# Minecraft Builder Skill

You write a JavaScript **recipe** with the building kit, export a vanilla structure `.nbt`, then
**render it and look at the PNGs**. Quality comes from that loop. The building craft itself —
proportions, depth, palettes, roofs, styles, landscaping, lighting — lives in
`references/building/`. Read `references/building/README.md` (the handbook) before every build.

## Setup (once)

Work from the installed skill directory.

```bash
npm install --omit=dev          # if node_modules/@mattzh72/lodestone is missing
```

`scripts/render.mjs` needs Playwright + Chromium (it finds a global install too). If it is missing:
`npm install --no-save playwright && npx playwright install chromium`.

## The loop

```bash
node scripts/run-build.mjs path/to/recipe.mjs --out-dir minecraft-builds/NAME --json
node scripts/render.mjs --nbt minecraft-builds/NAME/NAME.nbt          # → renders/sheet.png (se, nw, south, top)
# read sheet.png, critique, edit the recipe, repeat
```

- `--json` must report `builder.problems: []` and `builder.clipped: 0`.
- Files: one PNG per view plus `sheet.png` (only when 2+ views); with `--lighting both` the files
  get `-day`/`-night` suffixes and the sheets are `sheet-day.png` / `sheet-night.png`.
- More views: `--views se,sw,ne,nw,south,north,east,west,top,hero,low`; close-up:
  `--yaw 30 --pitch 20 --target X,Y,Z --distance 14 --fov 40 --view-name door`; interiors: `--clip-y Y`;
  `--lighting night` (or `both`).
- Text checks: `node scripts/inspect.mjs FILE --checks` (flat walls, floating blocks, bad states,
  dark spots), `--slice y=N` (ASCII plan) and `--score --style medieval` (a 0–100 scorecard against
  1,212 human builds: palette breadth, partial blocks, upside-down stairs, lights, contrast, relief,
  overhangs — each out-of-band metric comes with a fix). Aim for 85+ with nothing far out of band.
- Interactive viewer for the user: `node scripts/preview.mjs --nbt FILE` (`--no-open` when headless).

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

The full API (shapes, roofs, windows, doors, arches, stairs, timber framing, trees, terrain,
paths, ponds, modules with rotation, palettes, gradients, `b.texture`, noise, SDFs, materials):
**`references/kit-api.md`**. The raw API (`api.setBlock`, `api.fill`, Lodestone classes) is in
`references/recipe-api.md` and still works.

## What to read

| Task | Read |
| --- | --- |
| Any build | `references/building/README.md` (laws, workflow, scale tiers, cheat sheets) |
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
node scripts/convert.mjs minecraft-builds/NAME/NAME.nbt --out NAME.schem       # WorldEdit
node scripts/convert.mjs minecraft-builds/NAME/NAME.nbt --out NAME.litematic   # Litematica
node scripts/convert.mjs some-download.litematic --out study.nbt               # import to study/render/remix
```

Stamp an existing schematic into a recipe (study, remix or reuse it), rotated or mirrored:
`b.importStructure('path/to/build.schem', [x, y, z], { rotate: 1 })` (any of the formats above).
