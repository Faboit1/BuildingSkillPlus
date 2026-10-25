# The spawn handbook

How to build a server spawn or lobby that players remember: an SMP spawn with places for NPCs, a
leaderboard section and a crates section, a DonutSMP-style hub, or a PvP lobby. It sits on top of
the building handbook (`references/building/README.md`): every law there still applies; this file
adds the spawn program, the numbers and the workflow.

Companion files in this folder:

| File | What it holds |
| --- | --- |
| `corpus-study.md` | Real human-built spawns, lobbies and hubs, measured: sizes, layouts, set pieces, palettes, techniques |
| `design-research.md` | How popular servers lay out spawns, the plugin facts (NPC, hologram, crate, region), and why builds look AI vs human |
| `case-studies.md` | Critiques of earlier spawns made with this skill and the user's own spawns, with ranked lessons |

## 1. The interview: ask before you build

A spawn is a client job. A build team never starts from "make me a spawn", and neither do you. Use
the `AskUserQuestion` tool (up to 4 questions per call, 2-4 options each; the user can always type
their own answer). Ask in rounds, and let each round's answers shape the next one.

### Round 1: type, size and NPC count

Ask all four together. Size and NPC count are always explicit questions: they decide the layout.

1. **Spawn type.**
   - *Normal spawn*: FreshSMP-style. One compact, beautiful spawn plaza with all NPCs, leaderboards
     and crates around it, set in great natural terrain. Easy to navigate, quick to the wild.
   - *Spawn+*: DonutSMP-style. A larger hub where each NPC or feature gets its own building or
     place (crates hall, auction house, shop, leaderboard hall, RTP portal...), joined by streets,
     terraces or a central plaza.
   - *PvP lobby*: a compact arena-focused lobby (kit/queue NPCs, leaderboards, a view of the action).
   - *Other*: minigame hub, network lobby...
2. **Size** (in blocks, footprint × footprint). Options: *100 × 100*, *150 × 150*, *250 × 250*,
   or their own number. Recommend from the type: normal 100-160, spawn+ 200-350, PvP lobby
   60-120. If they also care about height or a hard limit (world border, paste area), note it.
3. **How many NPCs.** Options: *4-6* (essentials), *7-10*, *11-16*, *17+* or an exact number.
   Recommend from the type: normal 5-10, spawn+ 12-25 slots (fill about half, keep spare dressed
   spots for seasons), PvP lobby 4-8. Every NPC gets its own place, so the count drives the size:
   a normal spawn holds about 10 NPCs around one plaza; more than that needs a spawn+ layout or a
   bigger plaza ring. If the count and size don't fit, say so and propose a fix.
4. **Theme and style.** Offer 3-4 that fit the server name if known (medieval town, fantasy,
   modern/futuristic, Japanese, nature/organic, island/tropical, winter...) and accept their own.

### Round 2: the program

1. **Server name and branding.** Name, colours, logo or mascot, the text they want on signs.
2. **Which NPCs** (multi-select, to fill the count from round 1; ask for any missing): shop,
   crates, auction house, RTP / wild, warps, kits, ranks / store, sell, quests / battle pass, AFK,
   bounties, teams/clans, events, tutorial / rules. One place per NPC: in a normal spawn a
   pedestal, alcove or booth around the plaza; in a spawn+ its own building or district. If they
   pick fewer than the count, the rest become dressed spare spots.
3. **Leaderboards** (multi-select): money, kills, playtime, deaths, blocks mined, mobs killed,
   votes, KDR, streaks, team value... and how many boards (3-6 typical).
4. **Crates**: how many, their names and tiers (vote, common, rare, epic, legendary, seasonal), the
   plugin (ExcellentCrates, CrazyCrates, PhoenixCrates...) and the crate block if it is fixed.

### Round 3: follow-ups that perfect it

Ask what the first two rounds left open. Pick the 2-4 most important each time, and repeat the
round if answers open new questions. Typical follow-ups:

- **First view.** Which way players face on spawn, and what they should see first (the server
  logo/monument, the crates, a sweeping view of the hub).
- **Setting.** Mountains, forest valley, floating island, beach/lagoon, desert canyon, snow, void
  sky-island; day or night mood; where the wild/RTP exit is.
- **Signage.** Big block-letter signs (quartz lettering, 5 blocks tall) or holograms only. Which
  places get a sign.
- **Colours.** Main palette (light stone, dark stone, wood, terracotta...) and the single accent
  colour. Anything they hate (gold, neon, cyan...).
- **Extras.** AFK pool, PvP pit, parkour, map-art/info boards, event stage, statues of staff,
  shops of players, an arrival tunnel/portal.
- **Limits.** Maximum size, view distance, performance (entity counts), what must stay free for
  holograms and NPC plugins, and the paste coordinates.
- **Version and platform.** Minecraft version and server software (Paper, Folia, Purpur...), and
  how it will be placed (WorldEdit/FAWE paste, Litematica, or region files for a fresh world).
- **Delivery.** `.schem`, `.litematic`, region files for a fresh world, a server upload.

### The brief

Write the answers back as a short brief and get a yes:

```
SPAWN BRIEF — <Server>
Type: spawn+ (DonutSMP-style), 260 x 260, 14 NPC places (8 used + 6 spare), Paper/Folia 1.21.x or 26.x, region files at 0,0
Theme: white stone + dark oak + deep blue accent; nature setting: forested mountain valley
First view: facing south, the CRATES hall across a fountain plaza, mountains behind
NPCs (own place each): Shop (market hall), Auction (auction house), RTP (portal gate), Kits,
  Ranks/Store, Sell, Quests, AFK (garden pool)
Leaderboards: money, kills, playtime, blocks mined (4 boards + top-3 podium) in a leaderboard hall
Crates: vote, common, rare, legendary, seasonal (5, ExcellentCrates, ender chests)
Signage: block letters on the 4 main buildings, holograms elsewhere
Extras: PvP pit next to the arena entrance; night lighting warm
Delivery: .schem + region files + placements/setup commands
```

Only then build.

## 2. The three archetypes

| | Normal spawn (FreshSMP-like) | Spawn+ (DonutSMP-like) | PvP lobby |
| --- | --- | --- | --- |
| Footprint | 80-140 incl. terrain; built core 35-70 | 180-300 (districts on spokes or terraces) | 60-120 |
| The hero | the terrain: cliffs, waterfall, big trees frame one plaza | one landmark 1.5-2× the height of every other building | the arena / FFA pit, seen from the spawn |
| Structure | one plaza, NPC crescent around it, a crate alcove, a board wall, one gate out | central plaza + landmark, then 5-9 feature places each with its own building | spawn platform facing the arena, queue NPCs in a short arc |
| NPCs | 5-10 | 12-25 slots (fill ~half, keep 3-6 dressed spares) | 4-8 (unranked, ranked, FFA, kit editor, events, store) |
| Crates | 3-5 in one alcove or arc | 4-6 in a crate vault + 1-2 seasonal slots | 0-3 |
| Leaderboards | 3-4 on one wall + top-3 podium | 4-6 in a hall of fame + top-3 statues | 3-6 (Elo, wins, streak) + parkour |
| Spawn → core NPCs | ≤ 15-25 blocks | ≤ 25 to the plaza ring, ≤ 75 to the farthest district | ≤ 15 |
| Way out | gate or RTP portal on the main axis, in the first view | RTP gate / portal hall, Nether and End portals | hotbar + an FFA drop or portal |

### Layout patterns (pick one, then break its symmetry)

```
NORMAL SPAWN (crescent)           SPAWN+ (hub and spokes)            PVP LOBBY (overlook)
      cliffs / trees                    [CRATES VAULT]                  ######## arena ########
   (shop)  (AH)  (store)            [AH]    |     [SHOP]               #    sunken FFA pit    #
 (rtp)  \   |    /  (boards)            \   |    /                     ####### ramp ##########
   \     PLAZA   /                [TOPS]--( PLAZA + HERO )--[RTP]         (q1)(q2)(q3)(q4)
 [crates] fountain   (start)          /   |    \                            SPAWN deck
        \   *spawn  /                [AFK]  [DUELS] [STORE]               (store) (boards)
         gate to the wild                 gate / wild
```

- **Normal spawn:** the plaza is a stage carved into a slope or valley; the terrain wraps it on
  2-3 sides (a horseshoe), the open side is the view and the way out. NPCs stand in a crescent at
  the plaza rim, each with its own small set (booth, alcove, kiosk), never 8 identical pedestals.
- **Spawn+:** a hub plaza with the landmark on the spawn axis. Districts sit on spokes or terraces
  and **each has its own building type** (vault, exchange hall, market street, hall of fame, travel
  gate, arena gatehouse, AFK garden). Vary footprint, height and roof per district; keep one shared
  material family so it reads as one town.
- **PvP lobby:** the player spawns on a deck that overlooks the action (an arena bowl, an FFA pit,
  a parkour line). Queue NPCs stand in a short arc between the deck and the arena; leaderboards
  face the deck.

## 3. The program: places and numbers

Use the spawn kit for every gameplay place (`scripts/lib/kit/spawn.mjs`; each function is also a
Builder method). They build the place **and** record its coordinates for the admin.

| Place | Kit call | Rules |
| --- | --- | --- |
| World spawn | `b.spawnPoint(pos, facing)` | Exactly one. Solid block under, 2 air above. Faces the hero / the way on, never a wall. Set `respawn_radius` to 0 so players land on it |
| NPC place | `b.npcSpot(pos, facing, { id, label, role, style })` | Styles: `pedestal`, `alcove` (in a wall), `booth` (counter + canopy), `kiosk` (own little pavilion), `none` (record only). 2-block-deep clear apron in front, 1 air above the head. NPCs ≥ 4 blocks apart; core NPCs within 15-25 of spawn |
| Leaderboards | `b.leaderboards(pos, facing, { count, labels, podium })` | 3-6 boards side by side, each a framed dark recess ~5 wide × 6 tall for a 10-12 line hologram (0.3 per line → 3.6 tall); the centre board bigger. A standing area 4-8 blocks in front. Top-3 podium = 2nd/1st/3rd steps |
| Crates | `b.crate(pos, facing, { id, label, tier })`, `b.crateRow(start, facing, crates, { spacing: 5 })` | ≥ 5 blocks centre to centre (holograms are ~4.8 wide). Clear 3×3 in front, safe floor 2 behind (pushback), open sky above (beacon effects). The area must hold a crowd at key-alls |
| Portals | `b.portal(a, c, { id, label, kind: 'rtp' \| 'warp' \| 'pvp' \| 'nether' })` | On the main axis, visible from spawn; each destination dressed as its place (biome portals in biome materials) |
| Regions | `b.region(id, min, max, flags)` | `spawn` (pvp deny, mob-spawning deny...), arenas, AFK |
| Signage | `b.sign(text, at, facing, { font, board })` | Block letters only for the server name and ≤ 3 big titles (CRATES, LEADERBOARDS...). Holograms carry NPC names and info |
| Spawn-proofing | `b.spawnProof(min, max)` / `b.darkSpots` | 0 dark walkable cells in the safe zone, after all lighting by design |

- **Hologram readability:** text is legible only within ~10-15 blocks and plugins show it within
  20-48 by default, so **architecture does the wayfinding**: silhouettes, colour per district,
  landmarks, banners. Never rely on text to find a place.
- **Plugin space:** leave 2.5-3 blocks of air above every NPC and crate for its hologram, and no
  roofs or leaves in that column.
- **Walking:** 4.3 blocks/s walking, 5.6 sprinting. Nothing important should be more than ~12 s
  of sprint from spawn.

## 4. Composition: what makes a spawn memorable

1. **The first view is the whole design.** From the spawn point (eye height y+1.6): a frame close
   by (arch, trees, columns), the hero 20-40 blocks out on the axis, the way on visible, the sky open
   behind the hero. Decoration goes to the sides, never between the player and the way on.
2. **One hero, clear tiers.** One landmark (the server's monument, gate, tower or dome) at
   1.5-2× everything else; feature buildings at ⅓-½ of it; NPC sets at human scale. At least 3
   height tiers.
3. **Each feature has a fiction.** The crates are a vault or shrine; the AH an exchange hall; the
   shop a market street; RTP a harbour, station or ancient gate; leaderboards a hall of fame with
   statues; AFK a garden pool. Players remember places, not NPCs.
4. **Symmetric frame, asymmetric content.** Keep the main axis and the gate symmetric; let the
   districts differ in footprint, roof and height. Never mirror everything.
5. **Shaped floors.** No single-material floor patch over ~100 cells; borders or inlays every
   7-12 blocks; 1-3 step level changes; planters and benches; paving changes at thresholds; worn
   paths where players queue (in front of AH, crates, RTP).
6. **Terrain with intent.** Ridges frame the view, terraces carry the build, water leads the eye.
   Cliffs get strata, overhangs and scree; foundations step down into the ground; no building sits
   on a flat pad with a cut edge.
7. **Designed boundary.** The safe-zone edge is a wall, moat, cliff or a material change with
   banners, never an invisible line.
8. **Story.** A statue of the season-1 champion, a scaffolded "coming soon" district, a seasonal
   plaza next to spawn, a ruin older than the town.

## 4b. Measured numbers (real spawns + critiques)

From 22 real spawns and lobbies (Hypixel 2026, FunTime, Mineplex 2019, Kohi, PolitMine, Renatus,
HolyWorld...; `corpus-study.md`) and the critiques of this skill's earlier spawns
(`case-studies.md`). Check your build against them.

| Measure | Target |
| --- | --- |
| Paved walks / avenues | 5-7 wide (4-8); PvP lobbies 4-6 |
| Main plaza clear span | 11-31 (a central hub plaza ~25); normal spawn plaza 25-45 incl. its rim |
| NPC spacing | 4-6 apart in a row or arc **facing the spawn point**; plinth +1 block |
| Holograms | NPC 2-4 lines; boards 10-12 lines at 0.25-0.3 → board panel height = lines × 0.3 + 1 |
| Crates | ≥ 5 apart (hologram width), each on a 1-2 high stage with its own tier backdrop, queue apron in front |
| Leaderboard apron | 10-12 deep, no water in front |
| Mirror symmetry (height match across the main axis) | ≤ 60% outside the ceremonial axis; real SMP spawns < 16% over the whole footprint |
| Identical copies of any module in one view | ≤ 3 |
| Distinct visible block ids | ~140-420 (median ~250) for a full spawn |
| Partial blocks (stairs, slabs, walls, fences, trapdoors) | 16-28% of visible blocks |
| Upside-down stairs | ~50% of all stairs (eaves, corbels, sills, soffits) |
| Accent colour | ≤ 5% of visible surface, in runs of ≤ 5 blocks (never long stripes) |
| Floor | ≤ 5% of open floor > 6 blocks from any object; no single-material patch > 16 × 16; one field material ≥ 70%, borders and inlays that point to exits |
| Tree canopy | ≤ 20% of the plaza area; one feature tree per plaza; sightlines clear |
| First view | hero 25-45 blocks out on the axis, filling 25-50% of the frame height, sky behind it, nothing above eye level in the central 30° |
| Brand monument / logo | sculpted in 3D, ≥ 25 tall on a spawn+, 3-5 shades, lit at night |
| Block-letter height | ≥ viewing distance ÷ 12 (5 tall reads from 60), ≥ 30 L* contrast to its board, never on glass |
| Lighting | every walkable cell within 7 of a light, none > 14 from one; hero uplit; 0 dark cells |
| Transition to land | a 4-10 block zone (steps, retaining walls, planting) where the build meets terrain |

**The editing pass.** Generators place modules by rule; humans then adjust at the cameras that
matter. After the build is complete, render 6-8 key cameras (spawn view, each feature front, the
gate, two overviews) and **hand-edit what each one shows**: move a tree off a sightline, break a
repeated module, add the prop that tells the story, fix a covered sign. This pass is where the
"AI look" goes away.

## 5. Don't look AI: the checklist

Run it on every render. Each line is a tell and its fix.

| Tell (reads generated) | Fix (reads hand-built) |
| --- | --- |
| Identical elements at identical spacing (8 equal booths, a lamp every 4) | A-B-A-C rhythm, pairs and clusters; each booth its own roof and props; ≤ 3 identical in one view |
| Perfect 4/8-way symmetry, every spoke equal | Hero + tiers; vary district footprints, roofs, heights |
| Per-block random speckle | Gradients and clumps of one family, wear where it is caused (ground, edges, paths, under drips) |
| Huge flat floors | Borders, inlays, level changes, planters, worn desire paths |
| Lollipop / blob trees | Hand-shaped trees: tapering trunk, 3-5 branches, leaf clusters at tips, 3 size classes, groups |
| Noise-heightmap terrain | Landforms with purpose, strata, overhangs, scree, straight edges < 7 |
| Everything the same scale | Human / showcase / monumental tiers |
| Bare NPC on a slab, crate on a block | ≥ 3 props per place tied to its function; a backdrop; floor wear in front |
| Pixel-art text everywhere, letters 1 deep | Holograms for info; block letters only for the name and ≤ 3 titles, ≥ 5 tall, quartz with stair bevels on a framed board set into architecture |
| Saturated colour everywhere, metallic gold blocks as trim | 60-30-10 value structure, one accent ≤ 10%, accent as concrete/terracotta lines and points |
| Every edge with the same trim | Edge hierarchy: rich trim on the hero and plaza rim, plain elsewhere, some edges soft with planting |
| Lights on a grid, or bare light blocks in view | Light the routes and the hero, hide sources (under slabs, in lanterns, behind glass), then spawn-proof the rest |
| Buildings dropped on flat pads | Foundations stepping down, retaining walls, stairs into the slope |
| Detail spread evenly | Detail clustered at entrances, NPC fronts, the hero, gates; 30-50% of walls calm |

Lessons from this skill's own spawns (CheeseSMP v2 → v3):
- Gold blocks as trim looked cheap; the user preferred **white quartz lettering 5 tall** on dark
  boards and a single **blue concrete** accent. Ask about the accent; never assume gold. Use the
  accent as points and short runs (≤ 5 blocks): long flat blue stripes read as cheap as gold did.
- Mirrored layouts (69-90% mirror match) and cloned modules (a dozen identical domed towers, four
  shrines from one loop) were the strongest AI signal. Vary every district and tower.
- Don't let a canopy, tree or lamp cover a name sign, and define the spawn point and its first
  view before building around it.
- A cheese (logo) statue must read as its icon at a glance: a clean silhouette (a 2:1 wedge with a
  smooth stair slope, round shadowed holes), not a voxel blob. Test it at eye level from spawn.
- 800×800 is too big for the first pass; build the core spawn first and let terrain fill the rest.

## 6. Palettes for spawns (60 / 30 / 10)

| Theme | Field (60) | Secondary + frame (30) | Accent (≤ 10) | Green and light |
| --- | --- | --- | --- | --- |
| Classic white town | smooth quartz, quartz bricks, calcite | polished deepslate / blackstone bricks frames, dark oak | blue concrete (or the server colour) | azalea, oak; lanterns, froglights under glass |
| Medieval market | stone bricks, andesite, cobble gradients | spruce / dark oak timber, white terracotta plaster, deepslate tile roofs | red or blue banners, awnings | oak, birch, spruce; lanterns on posts |
| Fantasy / elven | calcite, diorite, mossy stone | birch, stripped birch, prismarine roofs | amethyst, cyan terracotta | cherry, azalea, glow lichen, end rods |
| Japanese | white terracotta / calcite walls | dark oak frames, deepslate tile roofs, spruce | red (crimson) torii, cherry pink | cherry, bamboo; lanterns, paper glow |
| Modern / sci-fi | smooth stone, light grey concrete, white concrete | polished blackstone, tinted glass, iron | one neon (cyan or orange concrete) | flowering azalea; sea lantern strips under glass |
| Winter | snow, packed ice, calcite | spruce, dark oak, deepslate | red (wool / terracotta) ribbons | spruce with snow; lanterns, shroomlight |
| Desert / oasis | smooth sandstone, cut sandstone | terracotta, acacia, mud bricks | teal / cyan glazed terracotta | palms (jungle), cactus; lanterns |
| Nether / dark | blackstone, deepslate | crimson/warped wood, basalt | gold only as points, magma glow | crimson fungi; shroomlight |

## 7. Workflow

1. **Interview** (§1) → brief → yes.
2. **Site:** terrain first (the hero of a normal spawn). Carve the plaza and paths; set the spawn
   point and the first view.
3. **Blocking:** place every program element as a placeholder volume (`white_wool`) with the kit
   calls' footprints; render the spawn view and the overview; fix layout and distances before any
   detail.
4. **Hero and districts:** the landmark, then each feature building with its own fiction.
5. **Gameplay places:** `npcSpot`, `leaderboards`, `crateRow`, `portal`, `spawnPoint`, regions.
6. **Detail and props:** clustered at focal points; ≥ 3 props per place.
7. **Planting and terrain finish:** groups of hand-shaped trees, flower drifts, path wear, water.
8. **Light, then `b.spawnProof`.** Render at night.
9. **Checks:** `run-build --json` clean; `inspect --checks` (no flooding water, no floating
   blocks, no dark spots); the §5 checklist on renders.
10. **Renders to deliver:** the spawn-point view (eye level), each feature at eye level, the
    overview with `scripts/isorender.mjs` (any size), day and night.

Render checklist per pass:
- `render.mjs --nbt S.nbt --yaw <spawn facing> --pitch 5 --target <hero> --distance <spawn→hero> --fov 70 --view-name first-view`
- one eye-level view per feature (NPC fronts, crates, boards, gate)
- `isorender.mjs S.nbt --px 4` (whole spawn) and `--px 8 --box ...` per district
- `--lighting night`

## 8. Delivery

- `.schem` (WorldEdit/FAWE) and `.litematic` via `scripts/convert.mjs`; for a fresh world, region
  files.
- The placements (`metadata.placements` in the build summary): every NPC, hologram anchor, crate
  block, portal, region and the world spawn, in build coordinates. Convert to world coordinates
  with the paste origin and give the admin ready commands (syntax verified against plugin source
  in `design-research.md` §2): Citizens `/npc create <name> --at x:y:z:world:yaw:pitch`,
  FancyNpcs `/npc create <name> --location x y z --world w`, DecentHolograms
  `/dh create <name> -l:world:x:y:z <text>`, `/setworldspawn x y z <yaw> <pitch>`,
  `/gamerule respawn_radius 0`, WorldGuard regions and flags.
- State what is left for plugins: NPC skins and names, hologram text, crate keys and rewards.
