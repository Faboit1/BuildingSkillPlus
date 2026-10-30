# Terrain that looks real: the research behind manual §5.1

The numbers below come from pro terraformers (Minecraft.net interviews, the kette442 terraforming
series, BuildTheEarth's documentation, WorldPainter's and VoxelSniper's source code) and from
geomorphology papers. A tag in brackets names the source; the links are at the end. *(derived)*
marks arithmetic from a sourced number. The manual (§5.1) turns them into rules; `b.land`
(kit-api.md, "Landscapes") is the tool.

## 1. Landforms and proportions

- **Slope to rise per block:** 15° = 0.27, 25° = 0.47, 30° = 0.58, 35° = 0.70, 45° = 1.0, 63° = 2.0.
- **Flanks:** in steep real ranges the most common hillside is 30-35°; above that, slopes fail as
  landslides instead of steepening [GEO-slope]. So:
  - mean flanks 28-38° (0.53-0.78 a block);
  - over 45° (1.0) is cliff and turns to stone [WPH];
  - vanilla's "steep" test is 63° (2.0) [MC-steep].
- **Profile:** convex at the crest, straight in the middle, concave at the foot [GEO-hill]: "the
  rise is lower at the bottom part and becomes steeper in the middle (and in the end it becomes flat
  again)" [K1]. Only cliff bands break it.
- **Width from height *(derived)*:** crest to foot ≈ H / tan(mean slope). A 200-tall crest at 30°
  needs about 350 blocks. A 1000-wide spawn with 200-tall rim crests leaves a valley floor of about
  300-400.
- **Exaggerate:** "exaggerate and create illusions": keep trees small near mountains, use subtle
  gradients for vertical space, a high-contrast palette so landforms read [MJ2]. About 2x vertical
  exaggeration is common *(derived from [WM1])*.
- **Spurs and side valleys:** across 11 ranges, major valleys leave the range at a spacing of
  about half-width / 2.1 [GEO-Hovius]. *(derived)* With a 300-block flank, a major spur or side valley
  every 140 blocks, smaller gullies inside each.
- **Ridge lines:**
  - "flow" lines run top to bottom, ranked; the ones from the summit dominate;
  - gently curved: a completely straight flow should be changed;
  - they end by flattening out or by merging two into a spike [K2][K10];
  - skylines and edges are the most striking feature: check side views too [K10].
- **Steps and repetition:**
  - vary terrace rises (+2/+3/+2/+4, never +2/+3/+3/+3) [K1];
  - mix runs of 1, 2 and 3 blocks [EC];
  - the same tread width on consecutive levels at most 2-3 times [K2];
  - nothing organic straight for more than 7 blocks [MJ1].
- **Flats:** small flats at different heights, some clustered where a path should run [K10].
  Ultra-smooth ground only where buildings go [K9].
- **Where the range meets the valley:**
  - concave foot slopes;
  - talus cones at 30-35° under cliffs [GEO-scree];
  - alluvial fans at the gully mouths, 1.5-25°, steepest at the apex [GEO-fan].
- **Noise:**
  - noise at 30-40% at most, on top of designed landforms [TH];
  - plain Perlin looks soft and rolling, fractal still stylised; erosion makes it weathered;
    ridged noise helps mountains [GDN];
  - a cone plus noise still looked "artificial" until two erosion passes were blended [WM2].
- **Cleanup (VoxelSniper erode presets):** remove a solid block with at least E exposed faces; fill
  an air block with at least F solid neighbours. Overuse gives "unnatural smooth looking
  terrain" [MCME].

  | Preset | E | F |
  | --- | --- | --- |
  | melt | 2 | 5 |
  | smooth | 3 | 3 |
  | fill | 5 | 2 |
  | floatclean | 6 | 6 |

## 2. Surface blocks

- **By slope:**
  - flat (under 15°): grass with patches of a blend block (moss) [BTE];
  - gentle (15-35°): grass with coarse dirt, rooted dirt, podzol and gravel patches;
  - steep (35-45°): stone → andesite → gravel → coarse dirt → grass, in that order [BB];
  - cliff (45° and over): the stone family [WPH]. Vanilla's steep test checks only north and east
    faces (MC-258859): check all four [MC-steep].
- **Cliffs:**
  - deepslate, tuff, cobblestone, stone and andesite in a gradient;
  - darker streaks where the face dips in, lighter blocks on the bulges that catch the sun [PM];
  - light on exposed faces, dark in cracks, laid like ore veins, not sprayed; tuff and cobblestone
    where water touches the rock [OH];
  - dirt or grass hanging one block over the top edge [OH];
  - small fallen rocks at the foot [PM].
- **Snow:**
  - WorldPainter's default bands, above the water: grass, dirt from +32, mixed stone from +48, frost
    from +64, deep snow from +80, each edge moved ±10 by two noise layers [WP];
  - snow sloughs off slopes steeper than 50-60°: bare rock there, snow on the ledges [GEO-snow];
  - vanilla's snowy slopes: stone cliffs with snow layers and strips of powder snow [MC].
- **Banks and shores:**
  - river beds of dirt and gravel with seagrass and kelp; banks a grass mix with coarse dirt and
    path patches [MJ1][BTE];
  - ponds of sand, clay, stone and gravel, deepening to the middle [EC];
  - the beach band from 2 below the water to 1 above it [WP];
  - coarse dirt at a rock wall, lighter toward the water, sand where it piles up [PM].
- **Scree:** 30-35° concave aprons under cliffs [GEO-scree]: gravel, cobblestone, andesite and tuff
  blobs, stone buttons as pebbles [OH].
- **Palettes:**
  - temperate: grass, moss, coarse dirt, rooted dirt, podzol; cliffs of stone, andesite and tuff;
  - autumn: vanilla has no autumn leaves (leaves take the biome tint); birch and spruce keep fixed
    colours. Mixing orange, yellow and red blocks into part of the crowns is the vanilla-only
    route [MC-color][EC];
  - alpine: snow, snow layers, powder snow, calcite, packed ice [EC]; stone with calcite strips and
    gravel (vanilla's stony peaks) [MC];
  - desert and mesa: terracotta bands (red, orange, yellow, white, light grey, brown, plain); the top
    band weathers to plain terracotta [MC-bad];
  - dark: deepslate → cobbled deepslate → stone with 10-20% tuff in the transitions; blackstone →
    basalt [BB].
- **No stripes, no speckle:**
  - choose by lightness first, then colour, then texture [AC];
  - no splatter of single blocks [AC];
  - never skip a step in the palette order: A touches B, B touches C, A never touches C [AC];
  - blobs, not bands; one main block, 2-3 blend blocks and one detail layer [EC];
  - transitions 3-5 wide with 1 block of overlap [BB]; jitter every band's edge [WP].
- **Strata:** vanilla's badlands use bands indexed by height, each shifted up or down by up to 7 by
  a horizontal noise [MC-bad]. Darkest band at the foot of a wall [BB].

## 3. Water

- Rivers sit in the valley bottoms [MC-terrain]. Water flows 7 blocks on the flat from a source
  [MC-water], so *(derived)* a river is a series of level reaches of source blocks, stepping down at
  each rapid or fall.
- Depth:
  - rivers 1-2 at the edges, deeper in the channel, the bed about 3 below the banks [EC][BTE];
  - lakes 1-3 at the shore, much deeper in the middle, oval or crescent [EC].
- **Meanders:** a wavelength of about 11 times the channel's width (10-14), bends of 2-3 widths'
  radius [GEO-LW]. *(derived)* A 12-wide river bends every 130 or so.
- **Waterfalls:** a source that falls, never a column; a widened plunge pool ringed with gravel and
  moss; messier at the foot than at the top [EC]; widening as it falls, broken by ledges [K7].
- Check rivers in 3D: they can end up floating [CC].

## 4. Vegetation

- **Density (WorldPainter):**
  - each column gets a tree with probability (s² + 1) / 1280 for strength s 0-15: about 17.6% at
    full strength, 5% at half, 1.3% at a quarter;
  - each tree needs a 3x3 free of leaves;
  - trees grow with strength [WP].
  - So at a forest's edge and the tree line, lower the density and the tree size together.
- **Mix:**
  - WorldPainter's deciduous forest is 90% oak and 10% birch [WP];
  - at least 4 variants in at least 2 sizes per species [OT];
  - big trees first, spread out, then smaller ones in the gaps, then undergrowth [FR-WE];
  - dense woods mix trees with bushes, fallen trunks and ferns [FR-WP];
  - trees short near mountains, so the mountains read big [MJ2].
- **Tree line:** closed forest, then wider spacing and shorter trees, then stunted ones, then
  none [BRIT]. Vanilla: forest, then grove or meadow (lone trees), then bare slopes, then peaks [MC].
- **Meadows:** short grass well ahead of tall grass, less near paths; one dominant flower colour
  with a scattered accent [K6]; the same species can run for hundreds of blocks [MC].
- **Under trees:** coarse dirt and rooted dirt with 40% fern and 40% short grass over it [BTE], leaf
  litter, bushes, podzol [EC].

## 5. The edges of a floating island

- Shape the underside as an upside-down mountain: build it as a mountain, then flip it; smooth it
  and add spikes at the lowest points [FI1].
- Mixes by depth, swapped for the theme [FI1]:
  - upper: 40% stone, 40% dirt, 20% cobblestone;
  - middle: 50% stone;
  - tips: ice, snow and stone.
- Keep it solid, never a hollow shell; carve cliffs, overhangs and caves; no flat pancake [MH].
- The rim: a dirt lip over the stone, roots, leaves and vines down it [FI1][OH], water falling off
  the edge [FI1], lower satellite islands [MH].

## 6. The 10 mistakes that make terrain look generated

| # | Mistake | Fix |
| --- | --- | --- |
| 1 | Noise everywhere | big landforms first, noise at 30-40% at most, then erosion [TH][WM2][GDN] |
| 2 | Cones and piles of spheres | perturb, erode, shape the peaks by hand [WM2] |
| 3 | Uniform slopes and steps | convex-straight-concave profiles, varied rises (+2/+3/+2/+4) [K1] |
| 4 | Straight lines, symmetry, repeats | at most 7 straight; curved flow lines with end points; never symmetric [MJ1][K2][MAN] |
| 5 | Perfectly flat plains | small flats at several heights, 1-2 block steps [K1][K10] |
| 6 | Materials banded by height only | height and slope together, edges jittered ±5-10, strata offset ±7 [WP][MC-bad] |
| 7 | Speckle or hard stripes | blobs ordered by lightness, no skipped steps [AC] |
| 8 | Snow or grass on cliffs | test the slope in all 4 directions; no snow above 50-60° [MC-steep][GEO-snow] |
| 9 | Water that ignores the land | rivers in the valley bottoms as level reaches; waterfalls that widen; check in 3D [CC][EC][K7] |
| 10 | Trees all one size | size with density, big trees first then small, 2+ sizes per species [WP][FR-WE][OT][MJ2] |

## Sources

- [MJ1] https://www.minecraft.net/en-us/article/tutorial--tips-for-landscaping-and-terraforming
- [MJ2] https://www.minecraft.net/en-us/article/terraforming-minecraft
- [K1] [K2] [K6] [K7] [K9] [K10] kette442, "Someone's Guide to Terraforming", parts 1, 2, 6, 7, 9 and 10, planetminecraft.com/blog (e.g. https://www.planetminecraft.com/blog/someones-guide-to-terraforming-1-basic-techniques/)
- [PM] https://medium.com/@serene_iris_hamster_75/terraforming-with-pearlescentmoon-a-transcription-ef76c7197b7b
- [AC] https://www.ardacraft.me/resources/gradient-guide
- [BTE] https://resources.buildtheearth.net/s/documentation
- [WP] WorldPainter source (github.com/Captain-Chaos/WorldPainter): SimpleTheme, TreesExporter, TreeLayer, DeciduousTree, PineTree, DeciduousForest
- [WPH] https://www.planetminecraft.com/blog/worldpainter-tutorial-big-hills/
- [TH] https://www.planetminecraft.com/blog/thrives-terraforming---tips-tricks-how-tos/
- [WM1] https://www.planetminecraft.com/blog/advanced-terraforming---working-with-worldmachine/
- [WM2] https://www.planetminecraft.com/blog/terraforming-glacier-terrain-with-worldmachine-and-worldpainter/
- [VS] IntellectualSites/FastAsyncVoxelSniper, ErodeBrush.java
- [MCME] https://www.mcmiddleearth.com/community/wiki/voxel-reference-guide-tutorials/
- [MC-steep] https://minecraft.wiki/w/Material_rule and https://bugs.mojang.com/browse/MC-258859
- [MC] [MC-bad] [MC-water] [MC-terrain] [MC-color] minecraft.wiki: Badlands, Snowy Slopes, Grove, Meadow, Stony Peaks, Water, Terrain, Color
- [EC] https://ender-chest.com/building/minecraft-terraforming-landscaping-guide
- [BB] https://blockblend.app/guides/minecraft-terrain-gradients
- [OH] https://www.planetminecraft.com/blog/tutorial-5539337/
- [FI1] https://www.planetminecraft.com/blog/creating-custom-floating-island/
- [MH] https://minecraft.how/fr/blog/article/how-to-build-floating-island
- [FR-WE] https://www.planetminecraft.com/blog/how-i-create-forests-with-custom-trees-ingame-worldedit/
- [FR-WP] https://www.planetminecraft.com/blog/how-to-make-realistic-forest-w-world-painter/
- [OT] https://github.com/frogocomics/OpenTrees
- [MAN] https://wiki.manacube.com/creative/terraforming-for-beginners
- [CC] https://cardycraft.com/blog/worldpainter-beginners-guide
- [GEO-Hovius] Hovius 1996, as reported in Talling et al. 1997: https://wpg.forestry.oregonstate.edu/sites/default/files/seminars/1997_Tallingetal.pdf
- [GEO-slope] EGU2017-16074 and DiBiase et al. 2012
- [GEO-hill] https://en.wikipedia.org/wiki/Hillslope_evolution
- [GEO-scree] https://en.wikipedia.org/wiki/Scree
- [GEO-fan] https://en.wikipedia.org/wiki/Alluvial_fan
- [GEO-LW] Leopold & Wolman 1960, https://pubs.usgs.gov/publication/70185557
- [GEO-snow] https://www.rei.com/learn/expert-advice/avalanche-reducing-risk.html
- [BRIT] https://www.britannica.com/plant/tree/Tree-lines
- [GDN] https://gamedev.net/blogs/entry/2257027-procedural-terrain
