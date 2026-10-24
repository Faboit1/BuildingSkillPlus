<p align="center">
<img width="600" height="338" alt="MyMovie-ezgif com-optimize" src="https://github.com/user-attachments/assets/2a0f99a0-bb8e-42b2-9624-a4d1c1684e84" />
</p>

# minecraft-builder-skill (BuildingSkillPlus)

An agent skill for building Minecraft structures that look hand-made by a skilled builder. The
agent writes a JavaScript recipe with a building kit, exports a vanilla structure `.nbt` (or
`.schem` / `.litematic`), renders it headlessly from several angles, critiques the renders and
iterates. A builder's handbook in `references/building/` teaches it the craft: proportions, depth,
palettes, roofs, styles, landscaping, interiors, lighting and composition.

## What's inside

- **Building kit** (`api.builder`, `api.kit`; reference in `references/kit-api.md`):
  - Painting with clumped palettes, gradients and `b.texture` (gradient retexturing in the
    WesterosCraft style).
  - Shapes: spheres, tubes, curves, SDFs and lathe.
  - Roofs driven by a pitch profile: gable, hip, pyramid, mansard, gambrel, shed, curved East-Asian
    and cone.
  - Architecture pieces: windows, doors, arches, columns, battlements, spiral stairs, timber
    framing, lamps and chimneys.
  - Nature: trees for 14 species, terrain, paths, ponds, overgrowth and floating islands.
  - Modules you can stamp with rotation and mirroring.
- **Exports match the game.**
  - Every block state is checked against Minecraft's own 1.21.1 block report.
  - Missing properties are filled with vanilla defaults, and paired blocks are completed (both
    halves of doors and tall plants, both parts of beds).
  - Stair corners, wall posts, and fence and pane connections are computed the way the game does
    when the structure is placed.
- **Headless renders** (`scripts/render.mjs`): multi-angle PNGs and contact sheets, close-ups,
  cutaways and night lighting. Daylight is colour-neutral, so block colours read true.
- **Inspector** (`scripts/inspect.mjs`): palette and category stats, ASCII slices, and lint
  checks for flat walls, floating blocks, bad states and dark spots.
- **Converter** (`scripts/convert.mjs`): `.nbt` ⇄ `.schem` ⇄ `.litematic`, plus import of legacy
  `.schematic`, so community builds can be studied and remixed.
- **Data:** material families, measured block colours with gradient ladders, and the official
  state table.
- **Examples** (`assets/examples/`): fully commented showcase recipes in several styles.

## Requirements

- Node.js 20.19 or newer and `npx`
- An agent that can load Skills CLI skills
- For renders: Playwright with Chromium (the skill tells the agent how to install it if it's missing)

## Setup

```bash
npx skills install Faboit1/BuildingSkillPlus
# or target a specific agent
npx skills install Faboit1/BuildingSkillPlus --agent claude-code
```

Restart or reload your agent. On first use the skill installs its Node dependencies.

## Use

```text
Use minecraft-builder-skill to build a timber-framed medieval inn on a hillside with a garden,
export it as .schem, and show me renders from all sides plus a night view.
```

Manual commands, run from the skill directory:

```bash
npm install --omit=dev
node scripts/run-build.mjs assets/examples/medieval-house.mjs --out-dir minecraft-builds/medieval-house
node scripts/render.mjs --nbt minecraft-builds/medieval-house/medieval-house.nbt --lighting both
node scripts/convert.mjs minecraft-builds/medieval-house/medieval-house.nbt --out medieval-house.schem
node scripts/preview.mjs --nbt minecraft-builds/medieval-house/medieval-house.nbt
npm test   # kit self-test
```

To get a build into the game, use `/place template` with a structure file, WorldEdit `//schem load`, or
Litematica. Details are in `references/formats.md`.
