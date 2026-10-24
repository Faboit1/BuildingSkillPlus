# The Builder's Handbook

How to make Minecraft builds that look like a skilled human made them. Read this file
before every build; it is short on purpose. The chapters go deeper.

Everything here is written for the kit (`references/kit-api.md`): you describe the build in a
JavaScript recipe, export a vanilla structure `.nbt`, and **look at renders** to judge it. You
cannot see while you build, so the loop *build → render → critique → fix* is the craft.

## Chapters

| Chapter | Use it for |
| --- | --- |
| [quality-and-critique.md](quality-and-critique.md) | The staged workflow, texturing doctrine, detail budgets, self-review rubric, anti-patterns |
| [community-lessons.md](community-lessons.md) | 71 skilled community builds measured block by block: the idioms, numbers and cross-sections that separate them from village houses |
| [benchmarks.md](benchmarks.md) | Numbers from 1,212 human builds: palette breadth, partial-block %, lights, contrast, signature palettes per style |
| [principles.md](principles.md) | Massing, proportion, scale tiers, depth layers, framing, foundations, focal points |
| [components.md](components.md) | Roofs (every type), walls, windows, doors, towers, arches, stairs, balconies, bridges, chimneys |
| [styles.md](styles.md) | Style catalogue: silhouettes, signature elements, palettes, mistakes per style |
| [palettes.md](palettes.md) | Value structure, hue harmony, texture busyness, ramps, curated palettes |
| [detailing.md](detailing.md) | What every partial/decor block is used for, plus verified micro-modules |
| [block-states.md](block-states.md) | Orientation rules: stairs, slabs, logs, trapdoors, doors, beds, walls, signs... |
| [nature.md](nature.md) | Trees, terrain, rocks, water, paths, gardens, floating islands |
| [interiors-and-lighting.md](interiors-and-lighting.md) | Furniture recipes, room planning, light sources and schemes |
| [composition.md](composition.md) | Villages, towns, castles, megabuilds, skylines, variety vs cohesion |
| [sculpting.md](sculpting.md) | Statues, creatures, ships, airships, crystals, clouds, organic landmarks |
| [procedural.md](procedural.md) | SDFs, noise, grammars, L-systems, roof algorithms, settlement generation |
| [vanilla-lessons.md](vanilla-lessons.md) | How Mojang's own builders build (villages, trial chambers, ancient city) |
| [materials.md](materials.md) | Which stairs/slabs/walls exist for each material, substitutes |
| [block-colors.md](block-colors.md) | Measured colour of every block, gradient ladders, flat vs textured blocks |

Examples to study (all built with the kit, heavily commented): `assets/examples/*.mjs`.

## The laws

These hold for almost every build. Break one only on purpose.

**Shape first**
1. **Silhouette before surface.** Block out the masses in a placeholder (`white_wool`), render, and
   fix proportions before any texture or detail. A gradient cannot rescue a bad shape.
2. **Never a single box.** Use 2–4 volumes (L, T, U, offset wings, towers, porches). Secondary
   masses are ⅓–½ of the main one; heights differ by ≥ 2 blocks.
3. **One hero.** Every build or scene has one dominant element (tower, gate, hall, hero window)
   ≥ 25% bigger or taller than its neighbours, and detail concentrates around it.
4. **Pick a scale tier and keep everything in it** (cottage 1:1, showcase ~1.5×, monumental 2–3×,
   see below). A 1×2 window on a cathedral or 3×3 columns on a cottage reads as a toy.

**Depth**
5. **No flat runs.** No uninterrupted plane wider than ~5 blocks or taller than ~4 without a
   1-block offset or a sub-block element (post, beam, sill, band, buttress).
6. **Frame and infill on different planes.** Posts/pillars at 0, infill set back 1 (or posts pushed out 1).
   Corner posts always; intermediate posts every 3–5 blocks; beams at every floor line.
7. **Recess openings.** Glass panes or glass set one block in; doors inside the wall plane; sills
   (upside-down stairs / top slabs) and lintels around them.
8. **Every roof overhangs** — 1 block (2 on big roofs, 2–4 on East-Asian) — and has a finished edge:
   `eaveTrim: true` and the default stair underside.
9. **Depth needs a reason.** Add it at transitions: ground contact, floor lines, eaves, corners,
   openings. Leave 30–50% of each wall field calm.

**Material**
10. **3–6 main blocks + ≤ 2 accents.** Mojang's own structures put 80% of blocks into 3–6 ids.
11. **Roles with value contrast.** Foundation (darkest, roughest) → wall field (calm) → frame/trim
    (contrasts the field by ≥ 30 L*) → roof (≥ 20 L* from the walls, usually darker).
12. **Order ramps light → dark; apply them in clusters.** Neighbouring blocks differ by ≤ 1–2 ramp
    steps. Never salt-and-pepper (per-block random), never horizontal stripes, never skipped steps.
    Use `kit.palette` (clumped) and `b.texture` (gradient with logic).
13. **Weather with logic:** darker/mossier at the base, corners, under sills and eaves, in drip
    streaks and on north faces; lighter where sun and focus are. Never spread moss evenly.
14. **Mix textures of similar value; mix values of similar texture.** Two busy textures side by
    side (cobblestone + birch log) turn to noise. Keep one busy surface per view.

**Roofs**
15. **Roofs are 40–60% of a vernacular facade** and 1–2 storeys tall. Footprints over ~15×15 need
    several roof sections (cross gables, wings, towers). Build the tallest section first.
16. **Pitch carries style:** 0.5 Mediterranean/classical, 1 default, 2 Nordic/Gothic/alpine,
    `[0.5, 0.5, 1, 1, 2]` East-Asian curve, `[2, 2, 0.5]` gambrel. Odd widths give a sharp ridge.
17. **Break every roofline** of a medium house at least 2–3 times: chimney, dormer, cross gable, tower.

**Ground and life**
18. **Ground everything.** Foundations reach below the lowest terrain point; no dirt shows under
    walls; doors meet ground or steps. Adapt to terrain — don't bulldoze a flat pad.
19. **Landscape is half the build.** Paths that connect, a 1–2 block transition ring (gravel, coarse
    dirt, flower bed) at the wall base, bushes at corners, custom trees in 3 sizes, clumped flowers.
20. **No empty shells.** Furnish interiors visible through windows and doors, with purpose
    (profession, story). Ceilings are ≥ 3 clear blocks.
21. **Light with intent.** Lanterns/candles/campfires over torches, a lamp every 8–12 blocks on
    paths, a light at every door, the hero building brightest. Always check `--lighting night`.
22. **Tell one story.** Function, age (repairs, extensions, wear), and signs of life (smoke,
    washing, crops, crates, banners).

**Scenes**
23. **Varied but related.** Across buildings vary footprint, height, roof type/orientation, door
    side, chimney; keep stone, wood, roof material, window kit and accent colour fixed.
24. **Odd and organic.** Odd numbers of bays, no more than 7 identical units in a row, no straight
    line longer than 7 in organic work (terrain, paths, canopies).
25. **Finish clean.** No floating blocks, no leftover placeholder, no hazards (lava by wood), no
    unexplained light. Let `finish()` validate states; read the warnings.

## Workflow

```
0 Brief      what/who/where/when, style, scale tier, hero element, story hook, palette roles
1 Site       terrain (b.terrain), where the build sits, what it faces
2 Massing    placeholder volumes            → render se,nw,south,top
3 Structure  frame, walls, roof, openings   → render elevations (south/east/north/west)
4 Material   b.texture / kit.palette ramps   → render se + close-ups
5 Detail     sills, shutters, trims, brackets, props, interiors → close-ups, --clip-y cutaway
6 Landscape  paths, transition ring, trees, flowers, water      → render se, hero
7 Light      lanterns, windows, path lamps  → render --lighting night
8 Review     rubric in quality-and-critique.md + inspect --score; fix the worst issue; repeat 3–8
```

Commands (run from the skill root):

```bash
node scripts/run-build.mjs recipe.mjs --out-dir minecraft-builds/NAME --json   # builder.problems must be []
node scripts/render.mjs --nbt minecraft-builds/NAME/NAME.nbt                    # sheet.png: se, nw, south, top
node scripts/render.mjs --nbt FILE --views south,east,north,west               # elevations
node scripts/render.mjs --nbt FILE --yaw 30 --pitch 20 --target X,Y,Z --distance 14 --view-name door   # close-up
node scripts/render.mjs --nbt FILE --clip-y 9                                  # interior cutaway
node scripts/render.mjs --nbt FILE --lighting night
node scripts/inspect.mjs FILE --checks                                          # text lint: flat walls, floating blocks...
node scripts/inspect.mjs FILE --slice y=5                                       # ASCII plan of one layer
node scripts/inspect.mjs FILE --score --style medieval                          # scorecard vs 1,212 human builds (benchmarks.md)
```

Look at every render you make. Write down what is wrong *before* changing code, then fix the
single biggest problem first (silhouette → proportions → roof → depth → texture → detail).

## Scale tiers

| Tier | Clear room height | Storey (floor to floor) | Window | Door | Posts / beams | Trim made of | Typical footprint |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cottage 1:1 | 3 | 4 | 1×1, 1×2 | 1×2 | 1 block, every 3–4 | stairs, slabs, trapdoors, buttons | 7×9 – 11×15 |
| Showcase ~1.5× | 4–5 | 5–6 | 2×2, 2×3 | 2×3 – 3×4 arched | 1 block, every 4–5 | stairs, slabs, walls; trapdoors for micro | 11×15 – 21×31 |
| Monumental 2–3× | 8–20 | 6–12 | 3–5 wide × 6–15 tall | 4–7 wide | 2–3 block piers | full blocks + stairs; trapdoors vanish | 30+ |

Player: 1.8 tall, eyes at 1.62. Rooms 2 blocks tall read as cramped. Walls are 1 thick in houses
(the frame makes them read as 2); castle curtain walls 3+ (walkable).

## Proportion cheats

- Odd facade widths (5, 7, 9, 11) give a true centre for a door, window or ridge.
- Window head aligns with the door head; windows stack vertically across floors, one per bay.
- Sill 1 above the floor. Bay pitch 4 (1 post + 3 infill) or 5 (1 + 4).
- Roof height ≈ ½ of the building's width at pitch 1; split the roof if that exceeds 2 storeys.
- Chimney top ≥ 1–2 above the ridge. Towers ≥ 1.5× the height of the wall they rise from.
- Tripartite facade: heavy base (plinth, darkest), calm middle, bold top (eaves, cornice, dormers).

## Depth layer model (plan view through a wall, + = outward)

```
+2   buttress, bay window, porch, balcony, jettied upper floor
+1   plinth / water table, pilaster, post, cornice, sill, eave overhang
 0   structural frame: corner posts, posts every 3-5, floor beams, quoins
-1   infill (plaster, planks, brick) set back behind the frame
-1   glass pane in the infill plane (a pane is centred, so it sits 7 px deeper still)
```

Sub-block depth: open trapdoor 3 px, button 2 px, wall post 8 px centred, fence 4 px, slab/stair
step 8 px, pane 2 px centred. Undersides (eaves, arches) always render darkest — overhangs read
from far away, 3-px details only up close.

## Material roles (starting ratios)

| Role | Share of visible surface | Rule |
| --- | --- | --- |
| Wall field | 50–65% | calm; mix 2–4 similar-value blocks in clumps |
| Frame / trim | 15–25% | crisp, unmixed or one close variant ≤ 15% |
| Roof | 20–35% | ≥ 20 L* from walls; 2+ stair types for wood roofs |
| Foundation | 5–10% | darkest, roughest; 1–3 courses, stepped/flared top |
| Accent | ≤ 5% | one hue: door, shutters, banners, flowers, copper |

## Detail budget by zone

| Zone | Budget | Typical content |
| --- | --- | --- |
| Eye level (0–4 above ground) | highest: ~1 element per 2–3 blocks of facade | door surround, steps, planters, lamps, benches, barrels |
| Middle (4 → eaves) | 1 element per bay | sills, shutters, flower boxes, beams, banners |
| Roofline | few, large | brackets, dormers, chimneys, finials, cresting |
| Hero area (±3 around it) | ×2 | richer materials, more layers |
| Back and side facades | ×0.5, never 0 | same language, sparser |

## Kit cheat sheet

```js
const b = api.builder([W, H, D], { seed })
b.terrain({ height: (x, z) => 4 + 2 * kit.noise.fbm2(x, z, { scale: 24 }) })
b.box([x0, y, z0], [x1, y + 3, z1], 'white_wool')                    // massing placeholder
b.texture([x0, y, z0], [x1, y + 9, z1], ['polished_andesite', 'stone_bricks', 'cracked_stone_bricks', 'tuff_bricks', 'deepslate_bricks'], { only: 'white_wool', focus: [[doorX, y + 1, z1]] })
b.timberWall([x0, y, z1], [x1, y + 4, z1], { frame: 'stripped_spruce_log', infill: kit.palette({ white_terracotta: 4, calcite: 1 }), postEvery: 4, braces: true })
b.window([wx, y + 1, z1], 'south', { width: 2, height: 2, recess: 1, shutters: true, flowerBox: true })
b.door([dx, y, z1], 'south', { material: 'spruce', awning: true, frame: 'stripped_spruce_log' })
b.roof({ x0, z0, x1, z1, y: y + 5, material: 'dark_oak', pitch: 1, gable: 'spruce_planks', eaveTrim: true })
b.chimney([cx, y, cz], 12, { paint: kit.palette({ bricks: 3, stone_bricks: 1 }) })
b.tree([tx, ground(tx, tz) + 1, tz], 'oak', { seed: 3 })
b.path([[x0, z1 + 6], [dx, z1 + 2]], { width: 2, paint: kit.palette({ dirt_path: 5, coarse_dirt: 2, gravel: 1 }) })
b.scatter({ density: 0.25, paints: [[8, 'short_grass'], [2, 'tall_grass'], [1, 'poppy'], [1, 'cornflower']] })
b.forest({ x0: 0, z0: 0, x1: W - 1, z1: D - 1, ground, species: [[6, 'oak'], [3, 'birch'], [1, 'colonized_dark_oak']], avoid: (x, z) => nearHouse(x, z) })
b.lampPost([lx, ground(lx, lz) + 1, lz], { post: 'spruce_fence', foot: 'stone_brick_wall' })
return b.finish({ name: 'my-build' })
```

## Things the previewer can and cannot show

- Renders use the vanilla 1.21.1 textures with colour-neutral daylight: colours are trustworthy.
- Entities (item frames, armor stands, paintings, mobs) do not exist in structure exports here.
- Sign text and banner patterns need block-entity NBT and render unreliably — make detail out of blocks.
- Light does not propagate; night mode adds a glow around emissive blocks. Judge lighting
  *placement* in night renders, and use `inspect.mjs --checks` for dark-spot estimates.
- `finish()` (and `run-build`) fill missing block properties with vanilla defaults and compute
  stair/wall/fence/pane connections like the game does on placement, so the preview matches the game.
