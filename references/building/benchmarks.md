# Benchmarks: numbers from 1,212 human-made builds

What do good builds actually contain? This chapter measures it. Use it to set targets before you
build and to check a finished build with `node scripts/inspect.mjs FILE --score --style NAME`
(see `references/inspect.md`).

- **Corpus:** 2,291 schematics were parsed (minecraft-schematics.com archive, the abfielder dataset,
  and curated vanilla datapack pieces). 1,212 builds were kept after removing redstone, farms, pixel
  art, terrain-only files, modded files, duplicates and over-represented authors.
- **Built blocks:** every ratio below is over *built* blocks: non-air blocks minus terrain (grass, dirt,
  raw stone, sand, gravel, water, snow, short/tall grass...) and technical blocks.
- **Cells** read `median [P25–P75]`. The interquartile band is the target: below P25 usually reads plain,
  above P75 busy. The **CURATED 60** row is the visually vetted showcase set; for a showcase build aim
  at the upper half of each band.
- **Partial blocks** = stairs + slabs + walls + fences/gates + trapdoors + panes/bars + buttons/plates + carpets.

How to use the numbers:

1. Before building, pick the style row and the size row. Write the targets into the recipe BRIEF:
   distinct ids, top-1 cap, partial %, upside-down stair %, lights per 1,000.
2. After the first full pass, run `inspect --score`. Fix whatever falls outside the band, starting
   with partial blocks (detail) and top-1 share (monotony).
3. Numbers never replace renders. A build can hit every band and still have a bad silhouette;
   the rubric in `quality-and-critique.md` comes first.

## 1. Numeric targets

All ranges are interquartile ranges (P25–P75) from the tables below, measured over **built blocks** (terrain excluded). "Typical" means the median. Treat the range as the band a build should land in; below P25 usually reads as plain, above P75 as busy. The 60 curated showcase builds sit toward the richer end on palette breadth and upside-down stairs, so for "high quality" aim at the upper half of each band.

1. **Palette breadth for small medieval and rustic houses (longest side ≤ 32).** Use 25–46 distinct block ids (typical 32). Medium medieval builds (33–64) use 27–70 (typical 49). Builds with under 20 ids are in the bottom ~15% of medieval/house builds.
2. **Palette breadth for large builds.** Castles reach 36–75 ids at 33–64 blocks and 66–146 at 65–128. Fantasy builds use 36–76 at 33–64. Modern builds use 33–62 overall. The curated showcase set has a median of 74 [45–106]. Distinct ids rise with size (Spearman ρ = 0.37 against block count).
3. **Dominance cap.** The most-used block should be 16–28% of built blocks for medieval houses and 13–25% for Japanese/Asian builds. Only about 21% of medieval and 4% of Asian builds let one block exceed 30%. Castles (21–45%), statues (34–55%) and organics (31–48%) may be more monolithic.
4. **Top-5 concentration.** In medieval, house and fantasy builds the five most-used blocks cover 55–75% of the build. Asian builds are flatter (46–63%); modern (65–83%) and organic (67–92%) are more concentrated. The remaining 25–45% is spread across 20+ accent ids, which is where detail comes from.
5. **Partial-block ratio by style.** Partial blocks are stairs, slabs, walls, fences, trapdoors, panes/bars, buttons/plates and carpets. Medieval runs 33–47% (83% of medieval builds are at or above 30%). Generic survival houses run 30–46%, Japanese/Asian 28–46%, ships 34–42%, castles 22–35%, fantasy 14–32%, modern 17–34%. Statues and organics are mostly full blocks (statues ~0–13%, organics 5–23%).
6. **Partial ratio falls with scale.** By longest side: up to 32 → 23–44%; 33–64 → 17–38%; 65–128 → 8–31%; over 128 → 3–22% (ρ = −0.32 against block count). A 150-block castle at 40% partial blocks is atypical, while a 25-block cottage at 15% looks blocky.
7. **Medieval detailing mix.** As shares of built blocks:

   | Part | Range |
   |---|---|
   | stairs | 10–19% |
   | slabs | 5.5–14% |
   | trapdoors | 1.5–7.6% |
   | fences/gates | 1.4–4.3% |
   | panes/bars | 0.4–2.6% |
   | walls | 0.1–1.8% |

   95% of medieval builds use trapdoors and 75% use walls.
8. **Asian roofs are slab- and fence-heavy.** Slabs run 5–21% (at 33–64 blocks a median of 18%), fences 1.6–5.6% and trapdoors 1–6.6%. Panes are nearly absent (median 0.2%) and glass is 0–1%.
9. **Modern builds swap stairs for glass.** Stairs are only 2–7% while panes/bars are 2.3–8%. Glass overall is 5–10% of built blocks, against 0.7–2.9% for medieval and under 2% for castle, fantasy and Asian builds.
10. **Castles and gothic builds use walls and stair trim, not trapdoors.** Walls run 0.3–6% and stairs 8–15%, while trapdoors are only 0.1–2.4%.
11. **Upside-down stairs.** 27–51% of stairs in medieval builds have half=top (typical 38%), as do 42–65% in fantasy, 35–66% in Asian and 50–70% in ships. The curated set's median is 48%. Use top-half stairs for eaves, overhang soffits, corbels and window sills, not only for right-side-up roof slopes.
12. **Horizontal logs.** 20–55% of logs and wood in medieval builds lie along x or z (typical 37%), and 35–70% in castles and 34–59% in ships. These are beams, sills, lintels and frame bands. All-vertical log frames are atypical.
13. **Lighting density.** Medieval builds carry 6–18 light sources per 1,000 built blocks (typical 12); across all builds the range is 4.5–23.5. Modern builds use 10–27; ships and churches are sparser at 2–14. Over 94% of medieval, house, castle, fantasy, Asian and modern builds contain lights.
14. **Leaves.** Medieval houses and generic houses typically use 0–2.5% leaves, as small garden or planter accents. Organics run 5–48% (typical 33%) and terrain scenes 1–21%.
15. **Light–dark contrast.** The weighted standard deviation of CIELAB L* is 12–18 for medieval and house builds, 8–15 for castles (homogeneous stone), 14–21 for Asian builds (dark roof against light walls) and 19–27 for modern (white against black glass). The P10–P90 L* spread is 20–47 for medieval and 44–66 for modern.
16. **Overall brightness.** Mean L* is 39–47 for medieval (mid-dark wood and stone), 44–51 for castles and 54–65 for modern.
17. **Saturation.** Mean chroma is 16–24 for medieval and house builds (warm woods), 8–16 for castles, 8–17 for modern and 26–38 for organics. Castles that read as colourful usually come from accent roofs, not walls.
18. **Typical footprint.** Medieval houses have a longest side of 24–37 and 1.3k–3.2k built blocks. Japanese/Asian builds are 29–64 and 1.7k–8.3k. Castles are 40–86 and 2.6k–26k. Modern builds are 32–62 and 2.7k–9.3k. Ships are 28–76 and 1.0k–5.0k.
19. **Ground plugs.** Schematics commonly ship with terrain: 8–31% of all non-air blocks for medieval, 10–48% for castles. Shaping and decorating the base is part of the build, so budget for it.
20. **Medieval signature materials.**
    - Spruce (planks, stairs, slabs, trapdoors) is in the top-5 of 78% of medieval builds.
    - Spruce logs, including stripped, appear in 53%.
    - Stone bricks, dark oak, cobblestone and oak each appear in 34%, and oak logs in 27%.
    - The most frequent exact pairs are spruce_planks + spruce_stairs (36 builds), spruce_slab + spruce_stairs (25) and spruce_log + spruce_planks (20).
    - The Tudor cluster (dark oak + spruce wood + white wool walls + gray carpet roofs) comes mostly from one prolific author and shrinks to 8% after the per-author cap.
21. **Castle and modern signature materials.**
    - Castles: stone bricks in the top-5 of 67%, spruce 56%, cobblestone 44%, polished andesite 17%. stone_bricks + cobblestone is the top pair.
    - Modern: quartz 59%, white concrete 33%, polished andesite 25%, black stained glass 19%, gray concrete 16%. gray_concrete + white_concrete is the top pair.
22. **Asian and ship signature materials.**
    - Japanese/Asian: spruce 50%, dark oak 46%, stone bricks 38%, then dark oak logs and cherry (25% each), polished blackstone bricks and cherry logs (21% each), and deepslate tiles (17%).
    - Ships: spruce 85%, dark oak 69%, oak 69%, spruce logs 54%, white wool sails 31%. Ships use slabs heavily (9.5–21%) and stairs at half=top 50–70%.

## 2. By style

### 2a. Size, palette breadth and dominance

| Style | N | Max dim | Built blocks | Distinct ids | Top-1 % | Top-5 % | Terrain % of all |
|---|---|---|---|---|---|---|---|
| medieval | 92 | 28 [24–37] | 1,975 [1,336–3,249] | 34 [26–56] | 22 [16–28] | 64 [55–73] | 17 [8–31] |
| house (generic) | 157 | 26 [19–35] | 1,421 [797–2,423] | 33 [23–45] | 23 [17–29] | 65 [56–78] | 22 [6–32] |
| castle | 36 | 52 [40–86] | 10,498 [2,648–25,716] | 50 [38–84] | 32 [21–45] | 73 [59–83] | 30 [10–48] |
| fantasy | 35 | 51 [34–98] | 2,859 [1,314–19,240] | 49 [30–76] | 22 [17–32] | 62 [51–75] | 30 [15–65] |
| japanese/asian | 24 | 38 [29–64] | 3,980 [1,716–8,296] | 44 [34–67] | 17 [13–25] | 54 [46–63] | 9 [1–25] |
| gothic/church | 11 | 80 [33–126] | 7,649 [953–28,235] | 35 [20–42] | 25 [19–40] | 68 [54–87] | 22 [7–29] |
| modern | 63 | 43 [32–62] | 4,391 [2,748–9,340] | 51 [33–62] | 29 [22–40] | 75 [65–83] | 25 [8–42] |
| ship | 13 | 41 [28–76] | 1,812 [1,048–5,005] | 30 [23–41] | 21 [19–31] | 72 [51–76] | 43 [15–54] |
| statue | 24 | 68 [45–105] | 2,398 [856–19,895] | 18 [10–38] | 48 [34–55] | 82 [74–96] | 18 [2–42] |
| tree/organic | 23 | 36 [26–54] | 1,475 [954–4,227] | 25 [14–48] | 39 [31–48] | 88 [67–92] | 20 [4–31] |
| terrain | 11 | 102 [48–134] | 13,580 [4,387–22,301] | 48 [32–132] | 31 [22–39] | 77 [49–84] | 70 [58–82] |
| other | 53 | 38 [27–50] | 1,768 [774–3,433] | 16 [11–23] | 31 [21–43] | 80 [66–94] | 18 [1–36] |
| unlabeled | 670 | 42 [26–74] | 3,079 [1,154–9,709] | 24 [15–40] | 32 [23–48] | 80 [66–91] | 17 [2–42] |
| CURATED 60 (visually vetted) | 60 | 62 [46–114] | 12,414 [3,213–29,686] | 74 [45–106] | 23 [17–36] | 63 [47–74] | 26 [12–45] |
| ALL kept builds | 1212 | 39 [25–62] | 2,512 [1,103–7,884] | 28 [17–47] | 29 [20–42] | 75 [62–87] | 19 [4–39] |

### 2b. Partial-block usage (share of built blocks)

| Style | N | Partial % | Stairs % | Slabs % | Walls % | Fences/gates % | Trapdoors % | Panes/bars % | Buttons/plates % | Carpets % |
|---|---|---|---|---|---|---|---|---|---|---|
| medieval | 92 | 41 [33–47] | 15.7 [9.8–19.4] | 10.0 [5.5–14.3] | 0.4 [0.1–1.8] | 2.7 [1.4–4.3] | 3.9 [1.5–7.6] | 1.4 [0.4–2.6] | 0.2 [0.0–1.0] | 0.0 [0.0–1.4] |
| house (generic) | 157 | 39 [30–46] | 15.5 [8.0–22.0] | 9.0 [3.8–14.9] | 0.1 [0.0–1.2] | 1.4 [0.2–3.3] | 3.5 [1.1–6.5] | 1.3 [0.0–3.1] | 0.1 [0.0–0.6] | 0.0 [0.0–1.2] |
| castle | 36 | 30 [22–35] | 11.3 [8.4–14.5] | 7.1 [2.6–11.0] | 1.5 [0.3–5.8] | 1.0 [0.7–2.4] | 0.5 [0.1–2.4] | 0.9 [0.2–1.9] | 0.0 [0.0–0.1] | 0.2 [0.0–0.7] |
| fantasy | 35 | 25 [14–32] | 7.3 [4.8–14.4] | 4.3 [2.5–8.4] | 0.4 [0.0–2.7] | 1.2 [0.1–3.0] | 0.8 [0.0–2.4] | 0.4 [0.0–1.3] | 0.0 [0.0–0.2] | 0.0 [0.0–0.2] |
| japanese/asian | 24 | 39 [28–46] | 11.1 [8.7–14.6] | 10.5 [5.4–21.1] | 0.2 [0.0–1.1] | 3.4 [1.6–5.6] | 3.2 [1.0–6.6] | 0.2 [0.0–1.2] | 0.0 [0.0–0.6] | 0.1 [0.0–1.6] |
| gothic/church | 11 | 30 [20–45] | 11.8 [7.6–18.0] | 2.3 [0.9–6.8] | 1.8 [0.3–6.4] | 0.3 [0.2–2.0] | 0.6 [0.0–1.6] | 1.5 [0.0–2.6] | 0.0 [0.0–0.2] | 0.0 [0.0–0.0] |
| modern | 63 | 25 [17–34] | 3.8 [2.1–6.9] | 4.9 [1.4–12.0] | 0.1 [0.0–0.9] | 0.1 [0.0–0.7] | 0.5 [0.1–1.3] | 6.3 [2.3–8.0] | 0.0 [0.0–0.1] | 0.7 [0.0–2.0] |
| ship | 13 | 39 [34–42] | 8.2 [4.5–14.5] | 15.8 [9.5–21.2] | 0.1 [0.0–0.2] | 4.3 [0.0–6.4] | 3.2 [0.8–4.8] | 0.1 [0.0–1.2] | 0.1 [0.0–0.8] | 0.0 [0.0–0.3] |
| statue | 24 | 1 [0–13] | 0.0 [0.0–5.3] | 0.0 [0.0–6.2] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] |
| tree/organic | 23 | 9 [5–23] | 1.7 [0.0–4.3] | 1.2 [0.1–10.0] | 0.0 [0.0–0.0] | 1.2 [0.1–3.5] | 0.3 [0.0–2.3] | 0.0 [0.0–0.2] | 0.0 [0.0–0.1] | 0.1 [0.0–1.0] |
| terrain | 11 | 17 [6–20] | 5.0 [1.3–8.5] | 2.6 [1.0–10.0] | 0.2 [0.0–1.3] | 1.5 [0.2–2.9] | 0.2 [0.0–1.9] | 0.1 [0.0–0.7] | 0.0 [0.0–0.0] | 0.1 [0.0–0.3] |
| other | 53 | 34 [23–52] | 8.7 [3.0–13.8] | 11.5 [6.2–22.3] | 0.6 [0.0–4.6] | 0.0 [0.0–2.4] | 0.7 [0.0–4.1] | 0.0 [0.0–0.1] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] |
| unlabeled | 670 | 24 [11–36] | 5.4 [0.9–13.8] | 3.6 [0.4–11.3] | 0.0 [0.0–1.4] | 0.3 [0.0–2.1] | 0.1 [0.0–1.4] | 0.4 [0.0–2.7] | 0.0 [0.0–0.1] | 0.0 [0.0–0.2] |
| CURATED 60 (visually vetted) | 60 | 28 [18–38] | 7.3 [4.8–11.8] | 7.0 [3.1–10.9] | 0.5 [0.2–2.3] | 1.9 [0.5–3.7] | 1.2 [0.4–4.6] | 0.7 [0.1–2.0] | 0.1 [0.0–0.4] | 0.4 [0.1–1.5] |
| ALL kept builds | 1212 | 29 [15–40] | 7.9 [2.1–16.0] | 5.5 [1.3–13.2] | 0.1 [0.0–1.5] | 0.6 [0.0–2.7] | 0.5 [0.0–3.0] | 0.7 [0.0–2.8] | 0.0 [0.0–0.2] | 0.0 [0.0–0.6] |

### 2c. Orientation, lighting, glass, foliage, colour

| Style | N | Stairs half=top % | Logs horizontal % | Lights /1k | Glass % | Leaves % | L* mean | L* std | L* P10–P90 | Chroma mean |
|---|---|---|---|---|---|---|---|---|---|---|
| medieval | 92 | 38 [27–51] | 37 [20–55] | 12.4 [6.3–17.5] | 1.7 [0.7–2.9] | 0.2 [0.0–2.2] | 43 [39–47] | 15.1 [12.1–18.3] | 35 [20–47] | 20.8 [15.9–24.1] |
| house (generic) | 157 | 32 [17–45] | 35 [14–51] | 13.0 [7.3–23.3] | 1.8 [0.4–3.5] | 0.2 [0.0–2.5] | 46 [40–53] | 15.0 [11.2–18.5] | 34 [20–45] | 20.5 [15.6–24.5] |
| castle | 36 | 46 [31–61] | 45 [35–70] | 10.7 [6.1–21.9] | 0.6 [0.1–1.8] | 0.1 [0.0–0.8] | 49 [44–51] | 11.3 [7.7–14.8] | 21 [16–35] | 10.9 [7.6–15.8] |
| fantasy | 35 | 55 [42–65] | 19 [10–43] | 9.3 [6.1–14.2] | 0.4 [0.0–1.7] | 0.3 [0.0–6.5] | 47 [41–54] | 15.8 [12.2–18.7] | 36 [25–53] | 19.1 [11.9–22.2] |
| japanese/asian | 24 | 54 [35–66] | 45 [33–58] | 13.7 [6.3–17.5] | 0.3 [0.0–1.0] | 0.0 [0.0–0.4] | 44 [39–55] | 17.7 [14.1–21.2] | 48 [34–62] | 18.1 [16.2–21.9] |
| gothic/church | 11 | 31 [21–53] | 20 [3–40] | 5.7 [2.3–14.3] | 0.8 [0.0–5.0] | 0.0 [0.0–0.1] | 48 [42–55] | 15.0 [12.7–22.3] | 34 [26–58] | 19.6 [13.4–22.3] |
| modern | 63 | 37 [24–55] | 41 [0–67] | 15.1 [9.5–26.7] | 7.4 [5.1–10.0] | 0.4 [0.0–2.4] | 61 [54–65] | 21.9 [18.6–26.7] | 56 [44–66] | 11.9 [8.2–17.3] |
| ship | 13 | 65 [50–70] | 53 [34–59] | 4.8 [1.8–10.0] | 0.3 [0.0–0.9] | 0.0 [0.0–0.0] | 45 [39–53] | 16.6 [10.4–20.3] | 44 [27–55] | 22.7 [19.9–27.3] |
| statue | 24 | 43 [33–47] | 15 [1–52] | 8.0 [0.0–31.9] | 0.0 [0.0–0.2] | 0.0 [0.0–3.4] | 56 [45–74] | 18.2 [11.0–21.6] | 48 [18–53] | 15.9 [5.1–29.9] |
| tree/organic | 23 | 47 [24–58] | 27 [3–52] | 8.9 [3.4–17.9] | 0.1 [0.0–2.7] | 32.8 [5.1–47.5] | 42 [37–52] | 12.0 [7.0–19.6] | 24 [13–55] | 30.8 [25.6–38.1] |
| terrain | 11 | 40 [29–51] | 25 [6–41] | 10.9 [5.0–20.5] | 0.0 [0.0–0.6] | 7.5 [1.0–20.9] | 47 [44–51] | 11.2 [10.0–14.9] | 24 [19–40] | 12.4 [9.3–19.0] |
| other | 53 | 47 [32–64] | 18 [0–52] | 7.5 [0.0–23.1] | 0.0 [0.0–2.4] | 0.0 [0.0–0.1] | 50 [42–62] | 9.7 [6.0–16.6] | 20 [7–38] | 14.2 [5.1–21.7] |
| unlabeled | 670 | 38 [20–53] | 23 [1–49] | 12.5 [4.0–28.1] | 1.7 [0.0–6.3] | 0.0 [0.0–0.8] | 51 [43–61] | 15.6 [11.1–20.9] | 36 [21–52] | 17.7 [11.0–25.3] |
| CURATED 60 (visually vetted) | 60 | 48 [37–59] | 37 [20–61] | 12.0 [5.7–18.6] | 0.7 [0.1–2.4] | 0.2 [0.0–2.8] | 47 [41–55] | 14.8 [11.9–21.5] | 36 [23–54] | 17.6 [12.2–21.8] |
| ALL kept builds | 1212 | 39 [23–53] | 29 [4–53] | 12.2 [4.5–23.5] | 1.5 [0.0–4.8] | 0.0 [0.0–1.6] | 49 [41–58] | 15.4 [11.0–20.3] | 36 [21–52] | 18.2 [11.6–24.7] |

## 3. By size class (longest side; all kept builds)

### 3a. Size, palette breadth and dominance

| Size class | N | Max dim | Built blocks | Distinct ids | Top-1 % | Top-5 % | Terrain % of all |
|---|---|---|---|---|---|---|---|
| S (<=32) | 483 | 23 [18–27] | 994 [600–1,770] | 25 [16–37] | 26 [19–39] | 74 [61–86] | 18 [4–31] |
| M (33-64) | 440 | 43 [38–52] | 3,416 [1,978–6,039] | 30 [19–51] | 28 [20–39] | 73 [60–85] | 20 [5–41] |
| L (65-128) | 169 | 89 [75–107] | 12,722 [6,448–25,704] | 31 [17–56] | 35 [23–51] | 80 [67–92] | 21 [3–51] |
| XL (>128) | 120 | 189 [158–257] | 67,691 [21,869–144,721] | 44 [23–93] | 37 [25–49] | 81 [67–91] | 31 [3–78] |
| ALL | 1212 | 39 [25–62] | 2,512 [1,103–7,884] | 28 [17–47] | 29 [20–42] | 75 [62–87] | 19 [4–39] |

### 3b. Partial-block usage

| Size class | N | Partial % | Stairs % | Slabs % | Walls % | Fences/gates % | Trapdoors % | Panes/bars % | Buttons/plates % | Carpets % |
|---|---|---|---|---|---|---|---|---|---|---|
| S (<=32) | 483 | 35 [23–44] | 12.4 [4.0–19.9] | 7.8 [2.5–15.4] | 0.0 [0.0–1.0] | 1.2 [0.0–3.3] | 1.9 [0.0–5.0] | 1.2 [0.0–2.9] | 0.0 [0.0–0.3] | 0.0 [0.0–0.7] |
| M (33-64) | 440 | 28 [17–38] | 8.2 [2.5–14.2] | 4.3 [1.1–12.1] | 0.3 [0.0–2.3] | 0.7 [0.0–2.8] | 0.6 [0.0–2.6] | 0.7 [0.0–3.4] | 0.0 [0.0–0.2] | 0.0 [0.0–0.8] |
| L (65-128) | 169 | 19 [8–31] | 4.8 [0.8–10.4] | 4.5 [1.0–11.6] | 0.0 [0.0–1.0] | 0.1 [0.0–1.6] | 0.1 [0.0–0.8] | 0.2 [0.0–1.9] | 0.0 [0.0–0.1] | 0.0 [0.0–0.7] |
| XL (>128) | 120 | 11 [3–22] | 2.1 [0.3–5.2] | 2.6 [0.4–7.0] | 0.1 [0.0–0.9] | 0.1 [0.0–0.6] | 0.0 [0.0–0.3] | 0.1 [0.0–1.0] | 0.0 [0.0–0.0] | 0.0 [0.0–0.1] |
| ALL | 1212 | 29 [15–40] | 7.9 [2.1–16.0] | 5.5 [1.3–13.2] | 0.1 [0.0–1.5] | 0.6 [0.0–2.7] | 0.5 [0.0–3.0] | 0.7 [0.0–2.8] | 0.0 [0.0–0.2] | 0.0 [0.0–0.6] |

### 3c. Orientation, lighting, glass, foliage, colour

| Size class | N | Stairs half=top % | Logs horizontal % | Lights /1k | Glass % | Leaves % | L* mean | L* std | L* P10–P90 | Chroma mean |
|---|---|---|---|---|---|---|---|---|---|---|
| S (<=32) | 483 | 35 [20–50] | 36 [14–56] | 12.9 [6.9–23.5] | 1.5 [0.0–3.5] | 0.0 [0.0–1.7] | 46 [40–54] | 14.7 [10.5–18.8] | 34 [19–47] | 19.9 [14.2–25.5] |
| M (33-64) | 440 | 40 [26–54] | 29 [4–51] | 13.1 [5.5–26.6] | 1.7 [0.0–6.3] | 0.0 [0.0–1.4] | 50 [41–59] | 15.4 [10.9–21.0] | 36 [21–53] | 17.2 [10.8–24.1] |
| L (65-128) | 169 | 43 [25–55] | 24 [3–52] | 9.5 [1.5–19.7] | 1.5 [0.0–6.6] | 0.0 [0.0–1.4] | 53 [46–64] | 16.9 [12.2–21.8] | 41 [26–54] | 15.6 [9.2–23.9] |
| XL (>128) | 120 | 45 [33–58] | 7 [0–34] | 6.9 [0.6–17.5] | 1.4 [0.1–5.6] | 0.1 [0.0–2.5] | 52 [43–66] | 17.3 [12.4–22.0] | 40 [25–56] | 15.5 [10.1–22.3] |
| ALL | 1212 | 39 [23–53] | 29 [4–53] | 12.2 [4.5–23.5] | 1.5 [0.0–4.8] | 0.0 [0.0–1.6] | 49 [41–58] | 15.4 [11.0–20.3] | 36 [21–52] | 18.2 [11.6–24.7] |

## 4. Style × size (buckets with N ≥ 5)

| Style · size | N | Distinct ids | Top-1 % | Partial % | Stairs % | Slabs % | Trapdoors % | Lights /1k | L* std |
|---|---|---|---|---|---|---|---|---|---|
| medieval · S (<=32) | 62 | 32 [25–46] | 21 [16–29] | 41 [34–48] | 16.2 [10.1–19.5] | 11.9 [5.3–16.2] | 4.3 [2.2–8.2] | 12.9 [7.4–17.4] | 15.1 [12.0–17.7] |
| medieval · M (33-64) | 24 | 49 [27–70] | 22 [17–27] | 41 [33–46] | 16.1 [9.2–20.4] | 9.2 [6.3–13.8] | 4.4 [1.3–8.1] | 11.8 [4.3–14.6] | 14.2 [12.0–17.0] |
| medieval · L (65-128) | 5 | 20 [18–75] | 25 [20–26] | 33 [29–46] | 13.4 [12.9–15.8] | 11.1 [9.3–12.8] | 0.7 [0.2–0.9] | 7.6 [4.0–22.9] | 18.9 [15.2–23.6] |
| house (generic) · S (<=32) | 111 | 31 [21–45] | 22 [16–26] | 42 [32–48] | 17.0 [9.4–23.3] | 9.2 [4.5–17.3] | 4.2 [1.8–6.8] | 12.9 [6.6–23.8] | 15.0 [11.5–17.3] |
| house (generic) · M (33-64) | 42 | 38 [29–50] | 25 [19–31] | 32 [21–40] | 13.2 [4.6–17.9] | 6.3 [2.4–11.7] | 2.8 [0.6–4.9] | 13.0 [9.2–22.2] | 13.7 [11.0–18.7] |
| castle · S (<=32) | 5 | 30 [22–47] | 31 [25–31] | 35 [33–35] | 14.4 [11.4–16.0] | 11.8 [9.5–16.1] | 0.5 [0.0–2.3] | 22.6 [10.3–35.9] | 8.7 [7.7–9.7] |
| castle · M (33-64) | 19 | 49 [36–75] | 32 [18–45] | 31 [24–35] | 11.3 [8.3–14.7] | 4.7 [2.0–10.8] | 1.1 [0.4–3.7] | 15.0 [5.6–20.5] | 10.8 [7.4–15.8] |
| castle · L (65-128) | 8 | 88 [66–146] | 30 [26–43] | 25 [21–29] | 10.7 [9.2–12.7] | 7.7 [6.5–11.0] | 0.1 [0.0–0.7] | 10.4 [9.4–12.1] | 12.7 [11.5–13.3] |
| fantasy · S (<=32) | 8 | 22 [17–50] | 26 [22–42] | 29 [14–53] | 15.2 [4.6–48.2] | 4.1 [2.4–7.0] | 0.0 [0.0–2.0] | 11.3 [7.7–13.5] | 13.8 [8.5–17.3] |
| fantasy · M (33-64) | 12 | 46 [36–76] | 19 [14–27] | 28 [23–30] | 7.2 [5.7–9.8] | 4.9 [3.8–7.1] | 2.2 [0.7–6.8] | 10.2 [6.2–11.6] | 15.5 [13.0–18.2] |
| fantasy · L (65-128) | 8 | 72 [44–80] | 19 [16–24] | 22 [16–31] | 8.0 [6.6–11.8] | 3.0 [2.4–7.2] | 1.4 [0.7–2.0] | 10.0 [7.2–19.6] | 13.5 [11.8–17.7] |
| fantasy · XL (>128) | 7 | 78 [63–142] | 30 [24–41] | 14 [11–18] | 6.1 [1.0–9.2] | 4.4 [2.9–9.2] | 0.3 [0.0–0.4] | 7.1 [0.3–12.9] | 18.4 [17.1–21.9] |
| japanese/asian · S (<=32) | 9 | 34 [22–47] | 25 [15–26] | 44 [30–46] | 14.5 [14.0–16.1] | 9.5 [5.4–16.7] | 4.4 [1.6–6.6] | 13.7 [9.3–15.7] | 17.5 [16.0–19.9] |
| japanese/asian · M (33-64) | 9 | 43 [37–79] | 13 [11–15] | 40 [37–46] | 10.4 [8.8–11.1] | 18.2 [6.6–24.1] | 4.3 [2.4–6.9] | 13.9 [6.4–17.1] | 15.8 [13.6–20.7] |
| modern · S (<=32) | 16 | 43 [28–55] | 31 [24–40] | 27 [13–34] | 4.2 [1.7–11.7] | 6.3 [0.5–15.1] | 0.1 [0.0–1.0] | 14.2 [9.6–31.9] | 22.2 [17.5–27.1] |
| modern · M (33-64) | 32 | 46 [34–61] | 26 [20–38] | 26 [20–34] | 4.1 [2.7–7.1] | 4.6 [0.8–11.2] | 0.9 [0.2–1.3] | 17.1 [8.4–26.1] | 22.5 [19.4–26.5] |
| modern · L (65-128) | 14 | 58 [48–79] | 33 [24–39] | 20 [16–33] | 2.1 [1.4–5.2] | 4.6 [2.3–12.2] | 0.4 [0.1–1.2] | 13.1 [9.3–19.7] | 21.4 [18.9–25.6] |
| ship · S (<=32) | 5 | 24 [23–28] | 20 [16–31] | 40 [39–42] | 14.5 [9.3–15.3] | 21.2 [11.8–21.9] | 4.3 [3.4–4.8] | 2.7 [1.8–12.8] | 10.4 [10.1–20.3] |
| statue · M (33-64) | 8 | 18 [18–23] | 42 [29–51] | 18 [5–34] | 6.3 [0.3–14.4] | 11.3 [1.5–18.2] | 0.0 [0.0–0.0] | 0.0 [0.0–3.0] | 16.3 [12.1–20.4] |
| statue · L (65-128) | 9 | 17 [8–24] | 37 [27–61] | 3 [0–7] | 0.0 [0.0–4.7] | 0.0 [0.0–1.8] | 0.0 [0.0–0.0] | 8.1 [0.0–20.9] | 18.3 [8.0–20.1] |
| tree/organic · S (<=32) | 10 | 16 [9–23] | 41 [35–46] | 23 [8–33] | 1.6 [0.0–9.0] | 3.6 [0.4–25.1] | 0.2 [0.0–3.3] | 5.9 [0.0–19.0] | 10.5 [6.2–15.0] |
| tree/organic · M (33-64) | 9 | 44 [18–49] | 36 [33–50] | 9 [4–10] | 0.7 [0.6–1.7] | 0.8 [0.0–2.4] | 1.3 [0.1–3.0] | 8.9 [6.1–17.5] | 15.7 [6.9–20.1] |
| other · S (<=32) | 20 | 16 [10–24] | 31 [20–47] | 36 [29–48] | 8.4 [4.0–12.2] | 10.5 [8.0–22.3] | 1.6 [0.0–6.4] | 11.5 [0.0–28.1] | 8.9 [4.6–16.4] |
| other · M (33-64) | 27 | 19 [12–23] | 35 [20–40] | 34 [26–60] | 10.6 [3.6–16.9] | 11.8 [5.6–19.5] | 1.1 [0.0–3.0] | 11.9 [0.9–20.7] | 9.2 [6.5–16.8] |
| unlabeled · S (<=32) | 231 | 21 [12–30] | 30 [21–47] | 30 [18–40] | 9.4 [2.2–19.2] | 5.9 [0.5–13.6] | 0.3 [0.0–2.9] | 13.6 [7.0–26.1] | 14.6 [10.2–19.1] |
| unlabeled · M (33-64) | 248 | 25 [16–41] | 30 [22–45] | 27 [15–35] | 7.5 [1.9–13.8] | 3.2 [0.5–11.2] | 0.1 [0.0–1.4] | 15.0 [6.1–33.9] | 15.5 [11.3–21.8] |
| unlabeled · L (65-128) | 99 | 26 [16–44] | 41 [27–58] | 18 [7–30] | 3.5 [0.4–8.8] | 3.3 [0.3–10.9] | 0.1 [0.0–0.5] | 8.9 [0.0–21.8] | 17.0 [12.0–21.9] |
| unlabeled · XL (>128) | 92 | 40 [23–86] | 37 [25–49] | 9 [3–24] | 1.8 [0.2–4.2] | 2.5 [0.2–7.6] | 0.0 [0.0–0.2] | 6.3 [0.5–16.4] | 16.9 [13.3–21.3] |

## 5. Signature palettes by style

A "signature palette" is a set of three **material families** that all appear among a build's five most-used families (built blocks only).
- Families merge shapes of one material: `spruce` covers spruce planks, stairs, slabs, fences, doors and trapdoors, while `spruce_log` covers logs, wood and their stripped versions. Bricks, tiles and walls fold into their base material, e.g. `stone_brick`, `cobblestone`, `deepslate_tile`.
- Lists are ranked by how many builds in the style contain the triad, with ties broken by mean combined share. Only triads found in at least 2 builds are listed, up to 50 per style.
- Each style also gets its most frequent exact-id pairs, taken from the six most-used blocks per build.

### medieval (N=92)

Most frequent families in a build's top-5 (% of builds): `spruce` 78%, `spruce_log` 53%, `stone_brick` 34%, `dark_oak` 34%, `cobblestone` 34%, `oak` 34%, `oak_log` 27%, `glass` 14%, `deepslate_brick` 13%, `dark_oak_log` 12%, `deepslate_tile` 12%, `brick` 10%, `white_wool` 8%, `calcite` 7%, `oak_leaves` 7%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `oak` + `spruce` + `spruce_log` | 13 | 14% | 61% |
| 2 | `spruce` + `spruce_log` + `stone_brick` | 13 | 14% | 58% |
| 3 | `cobblestone` + `spruce` + `spruce_log` | 11 | 12% | 65% |
| 4 | `oak_log` + `spruce` + `stone_brick` | 11 | 12% | 63% |
| 5 | `glass` + `spruce` + `spruce_log` | 9 | 10% | 69% |
| 6 | `dark_oak` + `spruce` + `spruce_log` | 9 | 10% | 57% |
| 7 | `cobblestone` + `oak_log` + `spruce` | 8 | 9% | 59% |
| 8 | `oak` + `spruce` + `stone_brick` | 8 | 9% | 58% |
| 9 | `oak` + `oak_log` + `spruce` | 7 | 8% | 59% |
| 10 | `cobblestone` + `dark_oak` + `spruce_log` | 6 | 7% | 70% |
| 11 | `oak` + `oak_log` + `stone_brick` | 6 | 7% | 44% |
| 12 | `deepslate_brick` + `spruce` + `spruce_log` | 5 | 5% | 65% |

Top exact-id pairs (both in a build's six most-used blocks): spruce_planks + spruce_stairs (36); spruce_slab + spruce_stairs (25); spruce_planks + spruce_slab (23); spruce_log + spruce_planks (20); spruce_stairs + spruce_trapdoor (17); spruce_planks + spruce_trapdoor (17); spruce_log + spruce_stairs (16); spruce_slab + spruce_trapdoor (14); spruce_planks + stone_bricks (12); spruce_stairs + stone_bricks (12); spruce_stairs + stripped_spruce_log (11); spruce_slab + stripped_spruce_log (8)

### house (generic) (N=157)

Most frequent families in a build's top-5 (% of builds): `spruce` 62%, `spruce_log` 37%, `oak` 31%, `stone_brick` 30%, `oak_log` 25%, `dark_oak` 24%, `cobblestone` 21%, `deepslate_tile` 15%, `deepslate_brick` 14%, `glass` 13%, `dark_oak_log` 11%, `birch` 10%, `quartz` 10%, `sandstone` 8%, `brick` 6%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `spruce` + `spruce_log` + `stone_brick` | 16 | 10% | 61% |
| 2 | `oak` + `oak_log` + `spruce` | 15 | 10% | 64% |
| 3 | `cobblestone` + `spruce` + `spruce_log` | 14 | 9% | 66% |
| 4 | `dark_oak` + `spruce` + `spruce_log` | 13 | 8% | 57% |
| 5 | `oak_log` + `spruce` + `stone_brick` | 12 | 8% | 63% |
| 6 | `dark_oak` + `dark_oak_log` + `spruce` | 12 | 8% | 61% |
| 7 | `oak` + `spruce` + `stone_brick` | 12 | 8% | 57% |
| 8 | `cobblestone` + `oak` + `spruce` | 12 | 8% | 54% |
| 9 | `glass` + `spruce` + `spruce_log` | 11 | 7% | 75% |
| 10 | `oak` + `spruce` + `spruce_log` | 11 | 7% | 59% |
| 11 | `oak` + `oak_log` + `stone_brick` | 10 | 6% | 62% |
| 12 | `cobblestone` + `oak` + `oak_log` | 9 | 6% | 59% |

Top exact-id pairs (both in a build's six most-used blocks): spruce_planks + spruce_stairs (31); spruce_stairs + spruce_trapdoor (22); spruce_planks + spruce_slab (22); spruce_slab + spruce_stairs (21); spruce_planks + stripped_spruce_log (17); spruce_stairs + stripped_spruce_log (16); spruce_planks + spruce_trapdoor (15); spruce_slab + stripped_spruce_log (14); oak_log + oak_planks (14); spruce_stairs + stone_bricks (13); oak_planks + oak_stairs (13); spruce_trapdoor + stone_bricks (12)

### castle (N=36)

Most frequent families in a build's top-5 (% of builds): `stone_brick` 67%, `spruce` 56%, `cobblestone` 44%, `oak` 33%, `spruce_log` 28%, `polished_andesite` 17%, `deepslate_brick` 14%, `brick` 11%, `smooth_stone` 11%, `dark_oak` 11%, `birch` 8%, `sandstone` 8%, `oak_log` 8%, `polished_blackstone_brick` 8%, `glass` 8%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `cobblestone` + `spruce` + `stone_brick` | 9 | 25% | 71% |
| 2 | `spruce` + `spruce_log` + `stone_brick` | 7 | 19% | 63% |
| 3 | `cobblestone` + `oak` + `stone_brick` | 5 | 14% | 49% |
| 4 | `cobblestone` + `spruce_log` + `stone_brick` | 4 | 11% | 54% |
| 5 | `oak` + `spruce` + `stone_brick` | 4 | 11% | 52% |
| 6 | `cobblestone` + `mossy_cobblestone` + `stone_brick` | 3 | 8% | 69% |
| 7 | `cobblestone` + `dark_oak` + `stone_brick` | 3 | 8% | 57% |
| 8 | `cobblestone` + `smooth_stone` + `stone_brick` | 3 | 8% | 57% |
| 9 | `cobblestone` + `mossy_cobblestone` + `spruce` | 3 | 8% | 56% |
| 10 | `cobblestone` + `spruce` + `spruce_log` | 3 | 8% | 51% |
| 11 | `mossy_cobblestone` + `spruce` + `stone_brick` | 3 | 8% | 48% |
| 12 | `red_carpet` + `spruce` + `stone_brick` | 2 | 6% | 84% |

_34 triads occur in at least 2 builds in this style; the rest occur once._

Top exact-id pairs (both in a build's six most-used blocks): cobblestone + stone_bricks (12); spruce_planks + stone_bricks (10); stone_brick_stairs + stone_bricks (8); cobblestone + spruce_planks (7); spruce_planks + spruce_slab (5); stone_bricks + stripped_spruce_log (5); stone_brick_stairs + stone_brick_wall (4); stone_brick_wall + stone_bricks (4); cobblestone + cobblestone_stairs (4); cracked_stone_bricks + stone_bricks (4); spruce_planks + stone_brick_stairs (4); cobblestone + spruce_slab (4)

### fantasy (N=35)

Most frequent families in a build's top-5 (% of builds): `spruce` 49%, `stone_brick` 34%, `spruce_log` 31%, `cobblestone` 26%, `quartz` 23%, `dark_oak` 20%, `oak_leaves` 20%, `deepslate_brick` 20%, `dark_prismarine` 14%, `oak` 11%, `polished_andesite` 9%, `dark_oak_log` 9%, `mangrove` 6%, `birch` 6%, `prismarine_brick` 6%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `spruce` + `spruce_log` + `stone_brick` | 5 | 14% | 48% |
| 2 | `deepslate_brick` + `spruce` + `spruce_log` | 5 | 14% | 48% |
| 3 | `deepslate_brick` + `spruce` + `stone_brick` | 3 | 9% | 60% |
| 4 | `dark_oak` + `spruce` + `spruce_log` | 3 | 9% | 44% |
| 5 | `cobblestone` + `oak_leaves` + `spruce` | 3 | 9% | 29% |
| 6 | `cobblestone` + `oak` + `oak_leaves` | 2 | 6% | 57% |
| 7 | `deepslate_brick` + `spruce_log` + `stone_brick` | 2 | 6% | 56% |
| 8 | `calcite` + `spruce` + `spruce_log` | 2 | 6% | 56% |
| 9 | `cobblestone` + `oak_leaves` + `stone_brick` | 2 | 6% | 49% |
| 10 | `dark_oak` + `mangrove` + `spruce` | 2 | 6% | 43% |
| 11 | `dark_oak` + `spruce` + `stone_brick` | 2 | 6% | 43% |
| 12 | `chest` + `spruce` + `spruce_log` | 2 | 6% | 37% |

_12 triads occur in at least 2 builds in this style; the rest occur once._

Top exact-id pairs (both in a build's six most-used blocks): cobblestone + oak_leaves (5); smooth_quartz + smooth_quartz_stairs (3); stone_brick_stairs + stone_bricks (3); spruce_stairs + spruce_trapdoor (3); spruce_stairs + stripped_spruce_log (3); cobblestone + oak_log (3); oak_leaves + oak_log (3); dark_oak_stairs + spruce_planks (3); deepslate_brick_stairs + stone_bricks (3); spruce_planks + spruce_stairs (3); spruce_planks + spruce_trapdoor (3); spruce_planks + stripped_spruce_log (3)

### japanese/asian (N=24)

Most frequent families in a build's top-5 (% of builds): `spruce` 50%, `dark_oak` 46%, `stone_brick` 38%, `spruce_log` 25%, `dark_oak_log` 25%, `cherry` 25%, `oak_log` 21%, `polished_blackstone_brick` 21%, `cherry_log` 21%, `deepslate_tile` 17%, `cobblestone` 17%, `oak` 12%, `quartz` 12%, `mossy_stone_brick` 8%, `mossy_cobblestone` 8%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `dark_oak` + `dark_oak_log` + `spruce` | 3 | 12% | 59% |
| 2 | `cherry` + `cherry_log` + `deepslate_brick` | 2 | 8% | 81% |
| 3 | `deepslate_tile` + `spruce` + `spruce_log` | 2 | 8% | 64% |
| 4 | `dark_oak` + `spruce` + `spruce_log` | 2 | 8% | 63% |
| 5 | `dark_oak` + `mossy_stone_brick` + `stone_brick` | 2 | 8% | 60% |
| 6 | `dark_oak` + `oak_log` + `spruce` | 2 | 8% | 53% |
| 7 | `oak` + `spruce` + `stone_brick` | 2 | 8% | 52% |
| 8 | `dark_oak` + `polished_blackstone` + `polished_blackstone_brick` | 2 | 8% | 52% |
| 9 | `dark_oak` + `polished_blackstone_brick` + `stone_brick` | 2 | 8% | 49% |
| 10 | `dark_oak_log` + `spruce` + `spruce_log` | 2 | 8% | 46% |
| 11 | `dark_oak` + `dark_oak_log` + `spruce_log` | 2 | 8% | 45% |
| 12 | `cobblestone` + `dark_oak` + `stone_brick` | 2 | 8% | 39% |

_13 triads occur in at least 2 builds in this style; the rest occur once._

Top exact-id pairs (both in a build's six most-used blocks): spruce_stairs + stripped_spruce_log (3); dark_oak_planks + mossy_stone_bricks (2); dark_oak_planks + stone_bricks (2); mossy_stone_bricks + stone_bricks (2); polished_blackstone_bricks + spruce_log (2); dark_oak_planks + spruce_stairs (2); polished_andesite + spruce_trapdoor (2); spruce_stairs + spruce_trapdoor (2); oak_planks + stripped_spruce_log (2); spruce_slab + spruce_stairs (2); spruce_slab + stripped_spruce_log (2); cobblestone + mossy_cobblestone (2)

### gothic/church (N=11)

Most frequent families in a build's top-5 (% of builds): `brick` 36%, `stone_brick` 36%, `spruce` 36%, `spruce_log` 27%, `polished_andesite` 27%, `quartz` 27%, `sandstone` 18%, `polished_diorite` 18%, `black_stained_glass` 18%, `oak_log` 18%, `brown_stained_glass` 18%, `dark_oak` 9%, `white_wool` 9%, `warped` 9%, `white_stained_glass` 9%

Top exact-id pairs (both in a build's six most-used blocks): stone_brick_stairs + stone_bricks (3); polished_andesite + stone_brick_stairs (2); polished_andesite + stone_bricks (2); brown_stained_glass + polished_andesite (2); bricks + dark_oak_fence (1); bricks + dark_oak_planks (1); bricks + spruce_wood (1); bricks + stone_brick_wall (1); bricks + white_wool (1); dark_oak_fence + dark_oak_planks (1); dark_oak_fence + spruce_wood (1); dark_oak_fence + stone_brick_wall (1)

### modern (N=63)

Most frequent families in a build's top-5 (% of builds): `quartz` 59%, `white_concrete` 33%, `polished_andesite` 25%, `spruce` 22%, `black_stained_glass` 19%, `gray_concrete` 16%, `stone_brick` 16%, `glass` 14%, `smooth_stone` 14%, `oak` 13%, `light_gray_concrete` 13%, `dark_oak` 11%, `birch` 11%, `gray_carpet` 8%, `cyan_stained_glass` 8%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `glass` + `spruce` + `spruce_log` | 3 | 5% | 65% |
| 2 | `gray_concrete` + `quartz` + `white_concrete` | 3 | 5% | 64% |
| 3 | `gray_concrete` + `spruce` + `white_concrete` | 3 | 5% | 56% |
| 4 | `gray_carpet` + `quartz` + `white_concrete` | 3 | 5% | 51% |
| 5 | `lantern` + `spruce` + `spruce_log` | 2 | 3% | 85% |
| 6 | `gray_terracotta` + `light_gray_stained_glass` + `quartz` | 2 | 3% | 83% |
| 7 | `birch` + `polished_andesite` + `quartz` | 2 | 3% | 74% |
| 8 | `glass` + `polished_andesite` + `white_concrete` | 2 | 3% | 67% |
| 9 | `birch` + `black_stained_glass` + `quartz` | 2 | 3% | 66% |
| 10 | `black_stained_glass` + `quartz` + `white_concrete` | 2 | 3% | 65% |
| 11 | `spruce` + `spruce_log` + `stone_brick` | 2 | 3% | 62% |
| 12 | `polished_andesite` + `polished_diorite` + `quartz` | 2 | 3% | 61% |

_40 triads occur in at least 2 builds in this style; the rest occur once._

Top exact-id pairs (both in a build's six most-used blocks): gray_concrete + white_concrete (11); smooth_quartz + white_concrete (8); quartz_block + quartz_stairs (5); gray_carpet + smooth_quartz (5); polished_andesite + smooth_stone (5); black_stained_glass_pane + white_concrete (5); gray_concrete + light_gray_concrete (4); light_gray_stained_glass_pane + white_concrete (4); polished_andesite + smooth_quartz (4); smooth_quartz + smooth_quartz_stairs (4); polished_andesite + polished_diorite (4); oak_planks + quartz_stairs (4)

### ship (N=13)

Most frequent families in a build's top-5 (% of builds): `spruce` 85%, `dark_oak` 69%, `oak` 69%, `spruce_log` 54%, `white_wool` 31%, `dark_oak_log` 15%, `light_gray_wool` 15%, `white_concrete` 15%, `birch` 15%, `blue_wool` 15%, `quartz` 8%, `deepslate_tile` 8%, `gray_wool` 8%, `stone_brick` 8%, `cyan_terracotta` 8%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `dark_oak` + `oak` + `spruce` | 6 | 46% | 73% |
| 2 | `oak` + `spruce` + `spruce_log` | 5 | 38% | 72% |
| 3 | `dark_oak` + `spruce` + `spruce_log` | 5 | 38% | 64% |
| 4 | `dark_oak` + `oak` + `spruce_log` | 4 | 31% | 41% |
| 5 | `oak` + `spruce` + `white_wool` | 3 | 23% | 67% |
| 6 | `dark_oak` + `spruce` + `white_wool` | 3 | 23% | 48% |
| 7 | `dark_oak` + `dark_oak_log` + `spruce` | 2 | 15% | 79% |
| 8 | `blue_wool` + `oak` + `spruce` | 2 | 15% | 76% |
| 9 | `blue_wool` + `spruce` + `spruce_log` | 2 | 15% | 76% |
| 10 | `blue_wool` + `dark_oak` + `spruce` | 2 | 15% | 75% |
| 11 | `oak` + `spruce_log` + `white_wool` | 2 | 15% | 70% |
| 12 | `dark_oak` + `oak` + `white_wool` | 2 | 15% | 62% |

_17 triads occur in at least 2 builds in this style; the rest occur once._

Top exact-id pairs (both in a build's six most-used blocks): spruce_slab + spruce_stairs (6); spruce_planks + spruce_stairs (5); dark_oak_planks + spruce_planks (4); oak_planks + spruce_planks (4); oak_slab + spruce_planks (4); spruce_planks + spruce_slab (4); oak_slab + spruce_slab (4); oak_slab + spruce_stairs (4); dark_oak_planks + spruce_slab (3); dark_oak_planks + spruce_stairs (3); dark_oak_planks + oak_planks (2); dark_oak_planks + stripped_dark_oak_wood (2)

### statue (N=24)

Most frequent families in a build's top-5 (% of builds): `quartz` 21%, `cobblestone` 17%, `glass` 17%, `dark_oak_leaves` 17%, `white_concrete` 17%, `sandstone` 12%, `oak_leaves` 12%, `spruce_leaves` 12%, `beacon` 12%, `glowstone` 12%, `stone` 12%, `cobbled_deepslate` 12%, `smooth_stone` 12%, `white_concrete_powder` 12%, `black_wool` 12%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `dark_oak_leaves` + `glass` + `quartz` | 4 | 17% | 56% |
| 2 | `glass` + `quartz` + `spruce_leaves` | 3 | 12% | 74% |
| 3 | `beacon` + `glass` + `quartz` | 3 | 12% | 73% |
| 4 | `beacon` + `quartz` + `spruce_leaves` | 3 | 12% | 56% |
| 5 | `dark_oak_leaves` + `quartz` + `spruce_leaves` | 3 | 12% | 56% |
| 6 | `beacon` + `dark_oak_leaves` + `quartz` | 3 | 12% | 55% |
| 7 | `beacon` + `glass` + `spruce_leaves` | 3 | 12% | 29% |
| 8 | `dark_oak_leaves` + `glass` + `spruce_leaves` | 3 | 12% | 29% |
| 9 | `beacon` + `dark_oak_leaves` + `glass` | 3 | 12% | 28% |
| 10 | `beacon` + `dark_oak_leaves` + `spruce_leaves` | 3 | 12% | 11% |
| 11 | `white_concrete` + `white_concrete_powder` + `white_wool` | 2 | 8% | 64% |
| 12 | `cobbled_deepslate` + `mangrove` + `stone` | 2 | 8% | 51% |

_12 triads occur in at least 2 builds in this style; the rest occur once._

Top exact-id pairs (both in a build's six most-used blocks): dark_oak_leaves + glass (4); beacon + dark_oak_leaves (3); beacon + glass (3); beacon + quartz_block (3); beacon + spruce_leaves (3); dark_oak_leaves + quartz_block (3); dark_oak_leaves + spruce_leaves (3); glass + quartz_block (3); glass + spruce_leaves (3); quartz_block + spruce_leaves (3); white_concrete + white_concrete_powder (3); sandstone + sandstone_stairs (2)

### tree/organic (N=23)

Most frequent families in a build's top-5 (% of builds): `spruce` 35%, `oak_log` 35%, `vine` 30%, `spruce_log` 26%, `oak_leaves` 26%, `dark_oak` 22%, `jungle_leaves` 17%, `jungle_log` 17%, `mushroom_stem` 17%, `spruce_leaves` 17%, `oak` 17%, `sandstone` 13%, `dark_oak_leaves` 9%, `glass` 9%, `bone_block` 9%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `jungle_leaves` + `jungle_log` + `vine` | 3 | 13% | 45% |
| 2 | `oak_leaves` + `oak_log` + `spruce` | 2 | 9% | 71% |
| 3 | `jungle` + `jungle_leaves` + `jungle_log` | 2 | 9% | 67% |
| 4 | `jungle` + `jungle_leaves` + `vine` | 2 | 9% | 67% |
| 5 | `jungle` + `jungle_log` + `vine` | 2 | 9% | 65% |
| 6 | `oak_log` + `spruce` + `spruce_log` | 2 | 9% | 41% |
| 7 | `oak_log` + `spruce` + `vine` | 2 | 9% | 28% |

_7 triads occur in at least 2 builds in this style; the rest occur once._

Top exact-id pairs (both in a build's six most-used blocks): spruce_fence + spruce_slab (3); jungle_leaves + jungle_wood (2); bone_block + mushroom_stem (2); oak_leaves + spruce_fence (2); oak_leaves + spruce_slab (2); oak_leaves + vine (2); spruce_button + vine (2); oak_leaves + oak_wood (2); oak_wood + spruce_trapdoor (2); spruce_fence + spruce_stairs (2); spruce_slab + spruce_stairs (2); spruce_leaves + spruce_log (2)

### terrain (N=11)

Most frequent families in a build's top-5 (% of builds): `stone_brick` 55%, `cobblestone` 55%, `spruce_leaves` 36%, `spruce` 36%, `oak` 27%, `oak_leaves` 27%, `spruce_log` 27%, `coal_ore` 18%, `polished_andesite` 18%, `jungle` 9%, `brick` 9%, `glowstone` 9%, `mossy_cobblestone` 9%, `dark_oak_leaves` 9%, `dark_oak` 9%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `coal_ore` + `spruce` + `stone_brick` | 2 | 18% | 24% |

_1 triads occur in at least 2 builds in this style; the rest occur once._

Top exact-id pairs (both in a build's six most-used blocks): cobblestone + oak_leaves (2); cobblestone + spruce_leaves (2); cracked_stone_bricks + spruce_leaves (2); spruce_leaves + spruce_log (2); bricks + cobblestone (1); bricks + jungle_stairs (1); bricks + oak_fence (1); bricks + stone_brick_stairs (1); bricks + stone_bricks (1); cobblestone + jungle_stairs (1); cobblestone + oak_fence (1); cobblestone + stone_brick_stairs (1)

### other (N=53)

Most frequent families in a build's top-5 (% of builds): `stone_brick` 38%, `spruce` 36%, `cobblestone` 23%, `quartz` 17%, `dark_oak` 17%, `stone` 17%, `spruce_log` 15%, `sandstone` 13%, `andesite` 11%, `smooth_stone` 9%, `glass` 9%, `lantern` 9%, `mossy_cobblestone` 8%, `brick` 8%, `polished_andesite` 8%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `andesite` + `cobblestone` + `stone_brick` | 4 | 8% | 73% |
| 2 | `cobblestone` + `stone` + `stone_brick` | 4 | 8% | 67% |
| 3 | `andesite` + `stone` + `stone_brick` | 4 | 8% | 52% |
| 4 | `dark_oak` + `spruce` + `spruce_log` | 3 | 6% | 67% |
| 5 | `andesite` + `cobblestone` + `stone` | 3 | 6% | 50% |
| 6 | `dark_oak` + `stone` + `stone_brick` | 2 | 4% | 80% |
| 7 | `cobblestone` + `spruce` + `spruce_log` | 2 | 4% | 73% |
| 8 | `glass` + `spruce` + `stone_brick` | 2 | 4% | 73% |
| 9 | `spruce` + `spruce_log` + `stone_brick` | 2 | 4% | 68% |
| 10 | `cobblestone` + `mossy_cobblestone` + `spruce` | 2 | 4% | 56% |
| 11 | `dark_oak` + `dark_oak_log` + `spruce_log` | 2 | 4% | 56% |
| 12 | `cobblestone` + `mossy_cobblestone` + `stone_brick` | 2 | 4% | 55% |

_20 triads occur in at least 2 builds in this style; the rest occur once._

Top exact-id pairs (both in a build's six most-used blocks): stone_brick_slab + stone_bricks (5); spruce_slab + spruce_trapdoor (5); stone_brick_stairs + stone_bricks (5); stone_brick_slab + stone_brick_stairs (4); spruce_planks + spruce_slab (4); spruce_slab + spruce_stairs (4); stone_bricks + stone_stairs (4); stone_slab + stone_stairs (4); oak_log + spruce_trapdoor (3); stone_brick_wall + stone_bricks (3); smooth_quartz + smooth_quartz_slab (3); spruce_planks + stripped_spruce_log (3)

### unlabeled (N=670)

Most frequent families in a build's top-5 (% of builds): `spruce` 29%, `stone_brick` 27%, `oak` 24%, `cobblestone` 22%, `quartz` 18%, `dark_oak` 15%, `glass` 14%, `spruce_log` 14%, `oak_log` 11%, `sandstone` 10%, `polished_andesite` 10%, `smooth_stone` 10%, `white_concrete` 9%, `birch` 7%, `brick` 7%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `dark_oak` + `spruce` + `spruce_log` | 23 | 3% | 59% |
| 2 | `cobblestone` + `spruce` + `spruce_log` | 22 | 3% | 60% |
| 3 | `cobblestone` + `oak` + `oak_log` | 21 | 3% | 63% |
| 4 | `spruce` + `spruce_log` + `stone_brick` | 20 | 3% | 70% |
| 5 | `oak` + `oak_log` + `spruce` | 20 | 3% | 62% |
| 6 | `oak` + `spruce` + `spruce_log` | 19 | 3% | 63% |
| 7 | `oak` + `spruce` + `stone_brick` | 16 | 2% | 63% |
| 8 | `cobblestone` + `oak` + `stone_brick` | 16 | 2% | 62% |
| 9 | `cobblestone` + `oak` + `spruce` | 16 | 2% | 58% |
| 10 | `cobblestone` + `spruce` + `stone_brick` | 16 | 2% | 52% |
| 11 | `cobblestone` + `dark_oak` + `stone_brick` | 15 | 2% | 63% |
| 12 | `oak` + `oak_log` + `stone_brick` | 14 | 2% | 55% |

Top exact-id pairs (both in a build's six most-used blocks): stone_brick_stairs + stone_bricks (52); spruce_planks + spruce_stairs (50); cobblestone + stone_bricks (45); spruce_planks + spruce_slab (36); stone_brick_slab + stone_bricks (33); oak_log + oak_planks (29); cobblestone + oak_planks (29); spruce_planks + stone_bricks (28); oak_planks + oak_stairs (28); cobblestone + stone_brick_stairs (27); stone_brick_slab + stone_brick_stairs (26); spruce_slab + spruce_stairs (25)

### ALL (N=1212)

Most frequent families in a build's top-5 (% of builds): `spruce` 39%, `stone_brick` 29%, `oak` 24%, `cobblestone` 22%, `spruce_log` 21%, `dark_oak` 18%, `quartz` 17%, `oak_log` 14%, `glass` 13%, `polished_andesite` 9%, `sandstone` 9%, `white_concrete` 8%, `smooth_stone` 8%, `birch` 8%, `oak_leaves` 8%

| # | Triad (material families) | Builds | % of style | Mean combined share |
|---|---|---|---|---|
| 1 | `spruce` + `spruce_log` + `stone_brick` | 68 | 6% | 62% |
| 2 | `dark_oak` + `spruce` + `spruce_log` | 59 | 5% | 59% |
| 3 | `cobblestone` + `spruce` + `spruce_log` | 54 | 4% | 62% |
| 4 | `oak` + `spruce` + `spruce_log` | 53 | 4% | 61% |
| 5 | `oak` + `oak_log` + `spruce` | 46 | 4% | 61% |
| 6 | `oak` + `spruce` + `stone_brick` | 44 | 4% | 58% |
| 7 | `cobblestone` + `spruce` + `stone_brick` | 43 | 4% | 55% |
| 8 | `cobblestone` + `oak` + `oak_log` | 37 | 3% | 62% |
| 9 | `cobblestone` + `oak` + `spruce` | 35 | 3% | 57% |
| 10 | `glass` + `spruce` + `spruce_log` | 33 | 3% | 67% |
| 11 | `oak` + `oak_log` + `stone_brick` | 31 | 3% | 54% |
| 12 | `dark_oak` + `dark_oak_log` + `spruce` | 30 | 2% | 63% |

Top exact-id pairs (both in a build's six most-used blocks): spruce_planks + spruce_stairs (138); spruce_planks + spruce_slab (99); spruce_slab + spruce_stairs (90); stone_brick_stairs + stone_bricks (87); cobblestone + stone_bricks (78); spruce_stairs + spruce_trapdoor (70); spruce_planks + spruce_trapdoor (67); spruce_planks + stone_bricks (64); spruce_log + spruce_planks (55); oak_log + oak_planks (52); spruce_stairs + stripped_spruce_log (49); cobblestone + spruce_planks (49)

Triad lists are trimmed to the top 12 per style; the full lists (50 per style) and per-build data came from
the study scripts and are not shipped.

## 6. Caveats

- **Style labels cover 45% of kept builds.** Most minecraft-schematics.com `.schem` uploads carry no title in the file. Those 670 builds are "unlabeled"; they feed the size-class tables and ALL rows only.
- **Some buckets are small.** Gothic/church (11), ship (13), terrain (11) and several style × size cells have N under 10. Treat their ranges as indicative.
- **Source bias.** The abfielder pool skews toward survival-friendly starter houses, bases and shops, which make up most of "house (generic)". minecraft-schematics.com skews toward 2019–2023 uploads (Minecraft 1.14–1.19.2).
- **Prolific authors were capped** at 3 builds per (author, style); 76 builds were dropped this way. Untitled `.schem` uploads have no author field, so series by one uploader may still cluster. For example, msc IDs 15199–15249 look like one modern-apartment set.
- **Terrain definition.** Raw stone, andesite, diorite, granite, tuff and deepslate count as terrain. This slightly understates ratios for castles that build walls from raw stone. Water counts as terrain, which is why ships show 43% terrain.
- **Datapack pieces.** The 17 curated `.nbt` files are jigsaw pieces and can include loot chests and spawners. Jigsaw blocks and structure_void are excluded from all counts.
- **Colour.** Lab values are per-block texture averages from `block-colors.json`. Pale-oak and other 1.21.4+ blocks lack entries; median colour coverage of built blocks is 100%. Values are weighted by block count, not by visible surface, so interior blocks count too.
- **Lighting.** Placed but unlit lamps and candles are not counted. Glowstone hidden under carpet is counted.
