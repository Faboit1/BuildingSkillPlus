# Principles: massing, proportion, depth, material, focus

The rules behind every good build, with the numbers to apply them. [README.md](README.md) states
them as laws in one line each; this chapter gives the reasoning, the measurements and kit code.
Component recipes (roofs, windows, towers...) are in [components.md](components.md); the staged
workflow and review rubric are in [quality-and-critique.md](quality-and-critique.md); colour tools
and curated palettes are in [palettes.md](palettes.md).

Snippets are recipe fragments: they assume `const { kit } = api`, `const b = api.builder([64, 48, 64])`
and, where used, a house record `const H = { x0: 10, z0: 10, x1: 22, z1: 18, F: 1 }` (outer wall
lines, inclusive, and the finished floor level). Every snippet was built with `problems: []` and
rendered. States written in snippets (`facing`, `half`, `axis`) are there **for orientation**;
`finish()` fills every other property and computes stair shapes and wall/fence/pane connections
([block-states.md](block-states.md)).

Tags: **(consensus)** = most expert sources agree; **(convention)** = a working default with no
single authority; **(taste)** = a defensible opinion. Untagged numbers are measured or geometric.

---

## 1. Build order

Every serious guide uses the same order (consensus): **massing → palette → structure (frame,
roof, openings) → depth → material → detail → landscape → light → review.** The stage table, the
`STAGE` switch and the order of kit calls are in [quality-and-critique.md §1](quality-and-critique.md#1-the-staged-workflow).

Why the order matters:

- **Massing decides 70% of the result.** A gradient cannot rescue a bad shape (consensus:
  ArdaCraft, WesterosCraft, Grian's mega-build process). Settle proportions in placeholder wool,
  render `se,nw,south,top`, and only then add material.
- **Start from the outline, not the centrepiece.** Building the hero element first produces "a
  very beautiful front" and a mess behind it (Raeyzeus). Place corners and footprints first.
- **Openings carve, later passes paint.** Cut doors/windows after walls; texture after all
  geometry (so `b.texture({ only })` can find the placeholders); place details after texturing
  (so the texture does not eat them); paths and plants before props and lights.
- **Roofs belong to massing.** The roof is the second-largest surface. Put real `b.roof` calls in
  the massing pass so the silhouette render is honest.

Role placeholders: one wool per role, so each role is textured on its own later. This snippet is
also a complete massing study: main block, lower wing, taller tower.

```js
const WALL = 'white_wool', BASE = 'gray_wool', TOWER = 'light_gray_wool'
// main 15x11, two 4-block storeys; wing 9x7 one storey, 3 back from the front; tower 5x5 at a corner
b.box([8, 0, 10], [22, 0, 20], BASE)
b.walls([8, 1, 10], [22, 8, 20], WALL)
b.box([22, 0, 13], [30, 0, 19], BASE); b.walls([22, 1, 13], [30, 4, 19], WALL)
b.walls([4, 0, 17], [8, 15, 21], TOWER)
b.roof({ x0: 8, z0: 10, x1: 22, z1: 20, y: 9, axis: 'x', material: 'deepslate_tile', gable: WALL, eaveTrim: true })
b.roof({ x0: 23, z0: 13, x1: 30, z1: 19, y: 5, type: 'hip', material: 'deepslate_tile', eaveTrim: true, overwrite: false })  // dies into the main wall
b.roof({ x0: 4, z0: 17, x1: 8, z1: 21, y: 16, type: 'pyramid', pitch: 2, material: 'deepslate_tile' })
// later, pass 4: texture each role with its own ramp (light -> dark)
b.texture([0, 0, 0], [40, 16, 30], ['calcite', 'mushroom_stem', 'white_terracotta'], { only: WALL, base: 0.3, edge: 0.1 })
b.texture([0, 0, 0], [40, 2, 30], ['stone_bricks', 'cobblestone', 'cobbled_deepslate'], { only: BASE, base: 0.5 })
b.texture([0, 0, 0], [40, 16, 30], ['polished_andesite', 'stone_bricks', 'cracked_stone_bricks', 'tuff_bricks'], { only: TOWER, base: 0.4, edge: 0.15 })
```

Numbers in that study: wing footprint 63 cells = 38% of the main block (target ⅓–½); wing ridge
at y 8, 6 below the main ridge at 14 (≥ 2); tower top 20 = 1.4× the main ridge (hero ≥ 1.25×). A lower
roof that dies into a taller wall takes `overwrite: false` so it keeps the wall blocks it meets.
Before finishing, `node scripts/inspect.mjs FILE --find wool` must return 0 matches.

---

## 2. Massing and silhouette

- **Never a single box** (consensus). Use 2–4 volumes: L, T, U, offset wings, an attached tower,
  a lean-to, a porch, a bay. A footprint that fits in one rectangle reads as a box from every angle.
- **Primary + secondary.** Secondary masses are **⅓–½** of the primary by footprint (Craftdex).
  Tertiary pieces (porch, bay, chimney breast, dormer) are smaller again.
- **Heights differ by ≥ 2.** A 1-block step between masses reads as an error (convention). The
  wiki's join examples use 2, 4 and 6-tall wings against a 4-tall main wall. A wing within 1 of
  the main height should be made equal and roofed as one.
- **Offset by 1–3.** Shifting a wing 1–3 blocks back from the main front costs nothing and kills
  the box (convention). Flush wing fronts merge into one wall.
- **Silhouette test.** Render `--views south,top`: the building must read as **3–4 distinct
  cuboids at different heights** as a dark shape against the sky (Craftdex).
- **Break the roofline.** A medium house (footprint 100–250 cells) breaks its roofline 2–3 times:
  chimney, dormer, cross gable, tower, cupola (convention). A large complex: one dominant vertical
  plus 2–4 subordinate ones.
- **Don't add wings for the sake of it.** Each mass should have a reason (hall, kitchen, stair
  tower, workshop). Purposeless offshoots read as noise (WesterosCraft).

Common plans (top view, `#` = wall line):

```
L (house + wing)        T (hall + cross wing)     offset pair             hall + corner tower
#########               ###############           #########               ###
#       #               #             #           #       #####           # #########
#       #               ###############           #       #   #           ###       #
#   #####                    #     #              #########   #             #       #
#   #                        #     #                  #########             #########
#####                        #######
```

Proportion of the masses (convention):

| Relation | Target |
| --- | --- |
| Secondary / primary footprint | 0.33–0.5 |
| Hero height / next tallest | ≥ 1.25 |
| Tower height / tower width | 2–4 (watchtower 4–6) |
| Tower above the wall it rises from | ≥ 1.5× the wall height, or +2–4 blocks on curtain walls |
| Single roof section | ≤ 15 × 15 footprint; larger → cross gables, wings, hips |
| Building length / depth | 1.3–2.0 for houses; a square house needs a strong roof or tower |

---

## 3. Proportion and scale

**Player:** 1.8 tall, 0.6 wide, eyes at 1.62; crawls under 1.5; jumps ~1.25. Everything is
judged against this figure, even in renders.

| Clear height (floor to ceiling) | Reads as |
| --- | --- |
| 2 | cramped; the classic beginner mistake |
| 2.5 (slab ceiling) | cellar, attic |
| 3 | minimum comfortable room (cottage) |
| 4–5 | normal room in a showcase build |
| 5–6 | hall in a house, shop ground floor |
| 8–12 | great hall, church nave (coving with upside-down stairs reads from 6+) |

**Storey (floor to floor):** 4 for cottages and villages (3 clear + 1 floor), 5 for showcase builds
(convention). Ground floors of shops and halls get +1–2.

**Scale tiers.** Pick one and keep every opening, beam and trim in it. The table in
[README.md](README.md#scale-tiers) gives rooms, windows and doors; the extra rules:

| Tier | Trim reads as | Columns | Arch openings | Stair flights | Roof overhang |
| --- | --- | --- | --- | --- | --- |
| Cottage 1:1 | stairs, slabs, trapdoors, buttons | fence/wall posts, 1×1 logs | 1–3 wide | 1 wide | 1 |
| Showcase ~1.5× | stairs, slabs, walls | 1×1 + stair base/capital | 3–5 wide | 2 wide | 1–2 |
| Monumental 2–3× | full blocks + stairs (trapdoors vanish) | 3×3 with 5×5 base | 5–11 wide | 3–5 wide | 2–3 |

Mixing tiers is the "toy" mistake: a 1×2 window on a 30-tall cathedral, 3×3 columns on a cottage.

**Openings at 1:1** (consensus + convention):

- Door 1×2; grand door 2×3 or a 3×4 arched opening with the door set back.
- Windows 1×1 (attic, stair), 1×2 (cottage), 2×2–2×3 (manor), 3×4+ (hall). Lancets ≥ 1:2.5.
- Sill 1 above the floor; window head level with the door head on the same floor.
- Hallways 2 wide in houses, 3–4 in large buildings.

**Roof to wall.** In vernacular buildings the roof is **40–60%** of the visible façade height and
1–2 storeys tall (5–7 blocks at 4-block storeys). At pitch 1 the roof rises half the building
width: a 9-wide house gets a 5-tall roof, a 15-wide one 8. Past ~8 the roof dominates: split the
footprint, use a lower pitch over a wide plan, or put a floor (dormers) in the roof. A 2–3 block
roof on a two-storey house looks like a lid.

**Wall thickness.** Houses 1 block (the frame makes them read as 2). Stone civic buildings 2 (room
for recessed windows). Castle curtain walls ≥ 3 so they can be walked on; realism guides want
⅓–⅔ of the height.

---

## 4. Odd and even

| Width | Gives | Use for |
| --- | --- | --- |
| Odd (5, 7, 9, 11, 13) | a true centre column: 1-wide ridge, centred door, single keystone | most façades, gables, towers with a point, arches with a keystone |
| Even (6, 8, 10) | a 2-wide centre | double doors, paired windows; the ridge is 2 wide and needs a cap |

- **Gable at pitch 1, outer width W, overhang o:** odd W → `(W − 1)/2 + o` stair rows per side
  plus one ridge column; the ridge sits `(W − 1)/2` above the roof's wall-line row. Even W → `W/2 + o`
  rows per side meeting back to back; cap them (slab, wall, or full blocks).
- **Steep roofs, helms and spires need odd widths** for a point (wiki).
- **Circles, cones, domes:** all rings odd or all even diameters. Switching parity inside one stack
  is always a mistake (wiki). An integer centre gives odd diameters (`b.tube([x, y, z], 4.5, ...)`
  is 9 across); a `.5` centre gives even ones.
- **Wall segments of 5, 7, 9** have a centre: a 5-block bay is post + 3 + post.
- **Bay counts odd (3, 5, 7)** so the entrance gets the centre bay (classical convention). Even
  bay counts suit asymmetric, vernacular fronts.

---

## 5. Façade composition

**Bays.** Divide every wall longer than ~6 with vertical members every **3–5 blocks** (posts,
pilasters, buttresses). Working pitches: **4** (1 post + 3 infill) or **5** (1 + 4) (convention).
Choose the façade length so the bays come out equal: with pitch 4, lengths 9, 13, 17, 21; with
pitch 5, 11, 16, 21.

```js
// posts every `pitch` from x0 to x1; the centre of each bay gets the window
function bays(x0, x1, pitch = 4) {
  const posts = []
  for (let x = x0; x <= x1; x += pitch) posts.push(x)
  if (posts[posts.length - 1] !== x1) posts.push(x1)        // pick x1 - x0 divisible by pitch to avoid a short bay
  return { posts, centres: posts.slice(1).map((p, i) => (posts[i] + p) / 2) }
}
const { centres } = bays(H.x0, H.x1, 4)                     // 13 wide: posts 10,14,18,22 -> centres 12,16,20
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 3, H.z1], 'stone_bricks')
b.walls([H.x0, H.F + 4, H.z0], [H.x1, H.F + 7, H.z1], 'calcite')
b.timberWall([H.x0, H.F + 4, H.z1], [H.x1, H.F + 7, H.z1], { frame: 'stripped_dark_oak_log', infill: 'calcite', postEvery: 4 })
for (const x of centres) {
  if (x === 16) b.door([x, H.F, H.z1], 'south', { material: 'spruce', frame: 'stripped_spruce_log' })
  else b.window([x, H.F + 1, H.z1], 'south', { width: 1, height: 2, shutters: true })
  b.window([x, H.F + 5, H.z1], 'south', { width: 1, height: 2 })            // stacked over the bay below
}
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: H.F + 8, axis: 'x', material: 'dark_oak', gable: 'calcite', eaveTrim: true })
```

Rules (convention unless marked):

- **One opening per bay, centred.** 3-wide infill → a 1-wide window; 5-wide infill → 1 or 3 wide.
  A window plus shutters needs `width + 2 + 2` cells to leave calm wall beside it
  ([quality-and-critique.md §3.3](quality-and-critique.md#33-the-facade-bay-system)).
- **Stack openings vertically** across floors; align window heads with the door head.
  Misaligned windows read as accidental.
- **Rhythm:** at most ~7 identical bays in a row. Group as A‑B‑A, A‑B‑B‑A, or make the centre
  (entrance) bay wider by 1–2.
- **Tripartite façade** (consensus):

```
  TOP     eaves, cornice, dormers, brackets   bold, chunky, few     reads from far away
  MIDDLE  wall field + windows                calmest surface       one element per bay
  BASE    plinth + ground floor + entrance    darkest, heaviest     most depth and detail at eye level
```

- **Continuous horizontals tie the bays:** a beam or stringcourse at every floor line, a sill
  course, a cornice or top plate. Posts plus windows without horizontals read as a grid.
- **Gable fronts** are compositions of their own: door and windows centred under the ridge (odd
  width), one small window or vent in the triangle, the top plate across the eave line.

Elevation of a 13-wide, 2-storey front (posts every 4, upper floor jettied, door in the centre bay):

```
y10  X  X  X  X  X  X  X  X  X  X  X  X  X     top plate (log, axis along the wall) under the eave
y9   |  q  #  p  |  q  #  p  |  q  #  p  |     knee braces (upside-down stairs, leg against the post)
y8   |  #  G  #  |  #  G  #  |  #  G  #  |     | posts, # infill set back 1, G 1x2 pane windows
y7   |  #  G  #  |  #  G  #  |  #  G  #  |
y6   |  #  #  #  |  #  #  #  |  #  #  #  |
y5   X  X  X  X  X  X  X  X  X  X  X  X  X     jetty beam / floor girt (+1)
y4   k  s  s  s  k  s  s  s  k  s  s  s  k     k = bracket under each post (upside-down stair)
y3   s  s  G  s  s  s  s  s  s  s  G  s  s
y2   s  s  G  s  s  s  D  s  s  s  G  s  s     s stone ground floor, D door
y1   s  s  s  s  s  s  D  s  s  s  s  s  s
y0   =  =  =  =  =  =  =  =  =  =  =  =  =     plinth (+1, darkest)
     0  1  2  3  4  5  6  7  8  9 10 11 12
```

---

## 6. Depth

Depth makes walls read from every distance because recesses and projections create shadow lines.
It is the single most cited difference between amateur and skilled builds (consensus).

**Layer model** (plan through a wall, `+` = outward; 0 = the structural plane):

```
+2  buttress, bay window, porch, balcony, jettied upper floor (+1 per floor)
+1  plinth / water table, pilaster, post pushed out, cornice, sill, eave overhang
 0  structural frame: corner posts, posts every 3-5, floor beams, quoins
-1  infill (plaster, planks, brick) set back behind the frame
-1  glass in the infill plane; a pane is centred in its cell, so it sits 7 px deeper still
```

Plan of a timber wall, outside up (two equivalent ways to get the offset):

```
infill set back                      posts pushed out
 . . . . . . . . . . . . .            X . . . X . . . X      <- +1 posts
 X . . . X . . . X . . . X  <- 0      # # # # # # G # #      <-  0 infill + window
 # # # # # # G # # # # # #  <- -1
```

**Sub-block depth vocabulary** (exact model boxes, px of 16):

| Element | Depth from the face it sits on | Reads at |
| --- | --- | --- |
| ladder, carpet | ~1 px | close-up only |
| button | 2 px | close-up only |
| open trapdoor (shutter, fascia) | 3 px plate | ≥ 20 px per block |
| fence post | 4 px post, 6 px gap from the cell edge | ≥ 20 px per block |
| wall post | 8 px post, 4 px gap | 8–20 px per block |
| glass pane / iron bars in the wall plane | 7 px recess, 2 px thick | always (dark slot) |
| slab, stair step | 8 px | always |
| full block | 16 px | always |
| `dirt_path`, farmland | 1 px below grass | close-up |
| daylight detector | 6 px tall plate | close-up |

**Face shading.** Vanilla shades top faces 100%, north/south 80%, east/west 60%, bottoms 50%. The
same block therefore reads darker on east/west walls, and every underside (eave, arch soffit,
bracket, balcony) is the darkest surface in the scene. That is why a 1-block overhang reads from
far away while a 3-px trapdoor only reads up close. Pixel-per-block thresholds:
[quality-and-critique.md §3.1](quality-and-critique.md#31-what-reads-at-which-density).

**Rules:**

- **No flat run wider than 5 or taller than 4** without a 1-block offset or a sub-block element
  (Craftdex's threshold: "more than 5 blocks wide without one layer of depth looks flat from a
  distance"). `inspect --checks` warns `flat-walls` at 6×5.
- **Put depth at transitions** (convention): ground contact (plinth), floor lines (beam,
  stringcourse, jetty), eaves (overhang, brackets), corners (posts, quoins), openings (reveal,
  sill, lintel). A large field can stay flat if its edges are articulated.
- **One good layer + micro detail.** WesterosCraft calls the old over-layered style "cumbersome and
  thick" (opinion, widely shared). Pick 1–2 wall-depth recipes per building
  ([components.md §2](components.md#2-walls)).
- **Leave negative space.** Raeyzeus: a wall "should never be completely covered in detail".
- **Glass panes beat glass blocks** in houses: a free 7 px reveal and thin frame lines. Full glass
  belongs set back a whole block, or in greenhouses and modern curtain walls.

Frame at 0, infill at −1, for a whole upper storey (frame plane = the ground-floor wall face):

```js
const y0 = H.F + 4, y1 = H.F + 8
b.walls([H.x0, H.F, H.z0], [H.x1, y0 - 1, H.z1], 'stone_bricks')                   // ground floor on the 0 plane
b.walls([H.x0 + 1, y0, H.z0 + 1], [H.x1 - 1, y1, H.z1 - 1], 'calcite')            // infill plane -1
for (const [a, c] of [[[H.x0, y0, H.z0], [H.x1, y1, H.z0]], [[H.x0, y0, H.z1], [H.x1, y1, H.z1]],
                      [[H.x0, y0, H.z0], [H.x0, y1, H.z1]], [[H.x1, y0, H.z0], [H.x1, y1, H.z1]]])
  b.timberWall(a, c, { frame: 'stripped_dark_oak_log', infill: 'air', postEvery: 4 })   // frame only, on plane 0
for (const x of [12, 16, 20]) b.window([x, y0 + 2, H.z1 - 1], 'south', { width: 1, height: 2 })  // sill sits in the recess, above the beam
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: y1 + 1, axis: 'x', material: 'dark_oak', gable: 'calcite', eaveTrim: true })
```

Plinth +1 with a water-table stair around the whole footprint (corners resolve to outer stairs):

```js
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 4, H.z1], 'white_terracotta')
for (let x = H.x0 - 1; x <= H.x1 + 1; x++) for (let z = H.z0 - 1; z <= H.z1 + 1; z++) {
  if (x >= H.x0 && x <= H.x1 && z >= H.z0 && z <= H.z1) continue                   // ring just outside the wall
  const toWall = z > H.z1 ? 'north' : z < H.z0 ? 'south' : x < H.x0 ? 'east' : 'west'
  b.set(x, H.F - 1, z, 'cobbled_deepslate')                                          // plinth course, +1 proud
  b.set(x, H.F, z, kit.stairs('stone_brick', toWall, 'bottom'))                      // tall side on the wall: sheds water
}
b.box([H.x0, H.F - 1, H.z0], [H.x1, H.F - 1, H.z1], 'cobbled_deepslate')
```

---

## 7. Texture and block mixing

**Mix blocks of similar value with different textures** (consensus): stone + stone bricks +
andesite + cobble for grey; calcite + white terracotta + mushroom stem for plaster; two woods
≥ 15 L\* apart in different roles. Never mix values of the same texture as a "texture".

How many blocks (convention):

| Scope | Count |
| --- | --- |
| Whole small build | 3–6 main ids + ≤ 2 accents (Raeyzeus: ~4 colours + 1 for the roof) |
| One surface, small wall | 2–4 blocks |
| One surface, large wall | 4–7 blocks |
| Huge builds | 15–30 ids in total, still 3–6 per role |

Ratios inside one surface (convention): **dominant 60–75%, 1–2 transition blocks 20–35%,
accents ≤ 10% (each ≤ 5%)**. Never 50/50: "a handful of texture blocks reads as detail; an even
mix looks messy." Role split across the build ≈ 60/30/10 (wall field / frame+roof+trim / accent).

Anti-noise rules (consensus: ArdaCraft, Conquest, WesterosCraft):

1. **Value-adjacent only.** Order the surface's blocks by L\*. A block may touch its neighbour in
   that order (±1, at most ±2), never jump. "Dark and light materials never touch directly."
2. **Clusters, not speckle.** Clumps 2–6 blocks across of varied size; never per-block random,
   never rows or columns of clusters, never straight horizontal stripes.
3. **Repeat every colour** in several places; an isolated patch of a colour reads as a mistake.
4. **One busy texture per view** (busyness ≥ 0.10: cobblestone, diorite, birch log, coarse dirt).
   Busy goes low (plinth, rubble), calm goes in the field, crisp on the frame.
5. **Frames and trims are not mixed** (at most one close variant ≤ 15%). Clean lines read as
   structure; noisy lines read as damage.
6. **Reduce shape changes before colours.** If a façade is busy, remove stairs and slabs first.
7. **Stairs, slabs and walls on a surface come from the surface's own family**, so edges line up.
8. **Don't mix stone families** (sandstone with cobble) inside one wall field.

Which tool (details in [palettes.md](palettes.md#applying-a-ramp) and
[quality-and-critique.md §2.6](quality-and-critique.md#26-which-paint-for-which-job)):

```js
// calm field: adjacent ramp steps, one dominant (>= 60%), clumped
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 3, H.z1], kit.palette({ stone_bricks: 6, cracked_stone_bricks: 3, andesite: 1 }, { scale: 3 }))
// aged material with logic: darker base and corners, drips under ledges, lighter at the door
b.walls([H.x0, H.F + 4, H.z0], [H.x1, H.F + 8, H.z1], 'white_wool')
b.texture([H.x0, H.F + 4, H.z0], [H.x1, H.F + 8, H.z1], ['polished_andesite', 'stone_bricks', 'cracked_stone_bricks', 'tuff_bricks', 'deepslate_bricks'],
  { only: 'white_wool', base: 0.3, edge: 0.18, drip: 0.08, focus: [[16, H.F + 5, H.z1]], focusRadius: 5, seed: 2 })
// cracks and moss as an exact share, only low on the walls
b.weather([H.x0, H.F, H.z0], [H.x1, H.F + 2, H.z1], { share: 0.15, mossBias: 0.6 })
```

---

## 8. Gradients and measured values

A gradient is a deliberate value transition across 3–6 ordered blocks (consensus; ArdaCraft calls
it the most important technique).

**Direction:** dark at the bottom on walls (consensus): ground splash, damp, foot traffic. "Keep
the upper section calm so towers and windows stay readable." Grian's opposite advice (light
bottom, colourful top on mega builds) is about where the *interest* goes, not weathering; both
agree the top gets interest and the base gets weight.

**Logic, not dice** (where each darkening goes):

| Where | What | Kit |
| --- | --- | --- |
| Bottom 1–3 courses | darkest steps, moss, splash | `b.texture` `base`; `b.weather` on a low box |
| Corners, jambs, wall ends | 1 step darker, cracks | `edge` |
| Under sills, gargoyles, ledges, eaves | 1-wide streaks, 2–5 tall | `drip` |
| North faces, valleys, near water and soil | moss, vines | `b.weather({ mossBias })`, `b.overgrow` on that face only |
| Around arches and openings | a lighter ring defines the opening | `focus` points, or a lighter arch block |
| Entrance / hero | 1–2 steps lighter, cleaner | `focus`, `focusRadius` |
| Roof ridge (sun) vs eaves and valleys (water) | lighter at the ridge, darker/mossy low | `b.texture` on the roof stairs (shapes kept) |

**Band size:** each step occupies a 2–4 block band whose border is ragged by ±1–2 (convention).
A 12-tall wall carries 4–6 steps. `b.texture` does this; `kit.gradient` needs `dither` 0.4–0.7.

**Measured L\*** (CIE lightness of the side texture, 0 black–100 white, from the vanilla 1.21.1
atlas; the same data as [block-colors.md](block-colors.md) and `kit.colorOf(id).L`). Adjacent
steps 3–8 apart give a smooth ramp; frame vs infill wants ≥ 30.

```
GREY STONE   cobbled_deepslate 33 > tuff 46 > mossy_cobblestone 49 > cracked_stone_bricks 50 = mossy_stone_bricks 50
             > stone_bricks 51 > stone 53 = cobblestone 53 (busy) > polished_andesite 56 > andesite 57 > smooth_stone 65
DARK STONE   blackstone 15 > polished_blackstone_bricks 18 > polished_blackstone 21 > deepslate_tiles 23
             > deepslate_bricks 30 > polished_deepslate 31 > cobbled_deepslate 33 > deepslate 34
TUFF         chiseled_tuff 39 > tuff_bricks 43 = polished_tuff 43 > tuff 46          (greenish, quiet)
WARM / BRICK mud 25 ... terracotta 46 > bricks 47 = mud_bricks 47 > packed_mud 48 = granite 48 = dripstone_block 48
             > polished_granite 50                                                    (one value: mix by texture)
SAND         red_sandstone 51 > cut_red_sandstone 52 ... sandstone 82 > cut_sandstone 83 = sand 83
             > smooth_sandstone 86 > end_stone_bricks 87
WHITE        white_terracotta 75 > mushroom_stem 80 > white_concrete 85 (flat) > calcite 89 > bone_block 90
             > quartz_bricks 91 > quartz_block 92 = smooth_quartz 92 > white_wool 93 > snow_block 99
PLANKS       dark_oak 20 > crimson 28 > mangrove 31 > spruce 38 > warped 40 > acacia 47 > jungle 52 > oak 57
             > bamboo 71 > birch 72 > cherry 77
STRIPPED LOG dark_oak 25 > mangrove 32 > spruce 40 > acacia 49 > jungle 58 > oak 62 > cherry 67 > birch 72
LOG (BARK)   cherry 16, spruce 17, dark_oak 20, mangrove 29, jungle 30, oak 38, acacia 41, birch 86 (very busy)
EARTH        coarse_dirt 39 > podzol 40 > grass_block side 43 = moss_block 43 > dirt 44 > dirt_path 46
             > rooted_dirt 47 > gravel 54
ROOFS        nether_bricks 11, dark_oak 20, deepslate_tiles 23, polished_deepslate 31, cobbled_deepslate 33,
             dark_prismarine 36, spruce 38, bricks 47, cut_copper 54 > oxidized_cut_copper 58, hay_block 58
```

Notes: copper is a hue ladder at nearly constant value (54 → 58); red sandstones and bricks are
one value, so mix them by texture; the light-grey gap between `smooth_stone` 65 and `calcite` 89
has only the busy diorites. Build ladders with `kit.colors.ramp(light, dark, n, { kinds, require })`
([palettes.md](palettes.md#building-a-ramp)).

---

## 9. Contrast and value roles

Value survives distance; hue and texture vanish first. Decide the dark/mid/light roles before
choosing blocks. Targets (aligned with `kit.colors.paletteReport`, which warns below the minimum):

| Pair | Minimum \|ΔL\*\| | Target | Example (measured) |
| --- | --- | --- | --- |
| frame vs infill | 20 | 30+; 40–60 for half-timbering | `stripped_dark_oak_log` / `calcite` 64; `stripped_spruce_log` / `white_terracotta` 35 |
| roof vs wall field | 20 | 25–40 | `deepslate_tiles` / `stone_bricks` 28; `deepslate_tiles` / `calcite` 66 |
| trim vs wall | 12 | 15–30, or same value with a shape change | `polished_andesite` / `bricks` 9 (too close: rely on the stair/slab shape) |
| foundation vs wall | 8 | 10–25, darker under light walls | `cobbled_deepslate` / `white_terracotta` 42 |
| accent vs wall | ΔE 15 | ΔE 25+, ≤ 5–10% of the surface | one hue: door, shutters, banners, flowers |

- **Three value groups per façade** (convention): darkest = roof + openings (glass reads dark from
  outside), middle = frame and plinth, lightest = infill; or the inverse for dark-stone castles.
  Keep ≥ 20 L\* between groups.
- **The roof contrasts the walls in value and material** (consensus). Same block on wall and roof
  border is the flat-roof mistake.
- **Accent colour only at focal points** ("you don't want to build a rainbow").
- **Match the biome**: sandstone in desert, spruce in taiga, local stone everywhere.
- **Check in grayscale**: if two roles merge, change one block's value, not its hue.

```js
const roles = { foundation: 'cobbled_deepslate', wall: ['calcite', 'white_terracotta'], frame: 'stripped_dark_oak_log', roof: 'deepslate_tiles', accent: 'red_terracotta' }
const report = kit.colors.paletteReport(roles)       // checks the pairs above
if (!report.ok) console.warn(report.warnings.join('\n'))
```

---

## 10. Focus, hierarchy and detail density

- **One hero** per build or scene: gatehouse, keep, entrance tower, hero window, glass front.
  Make it **≥ 25% taller or wider** than the supporting masses (Craftdex).
- **Detail increases toward the focus; entrances get more than windows** (consensus). The
  hero bay carries 2–3× the density of ordinary bays.
- **Placement (taste):** on asymmetric compositions put the dominant vertical about ⅓ along the
  façade, not at the end and not dead centre. Symmetric civic buildings put it on the axis.
- **Quiet surface:** keep **30–50% of every wall field** free of attachments (texture only).
  Negative space is what lets the detail read.

Detail budget by zone (convention; counts per façade):

| Zone | Height | Budget | 13-wide house front, typical |
| --- | --- | --- | --- |
| Z0 eye level | ground to +4 | highest: 1 element per 2–3 blocks of façade | door surround + step, 2 lanterns, bench or barrels, planter, plinth |
| Z1 middle | +4 to eaves | 1 element per bay | 3 window kits, beam line, 1 banner or flower box |
| Z2 roofline | eaves and above | few, large | chimney, 1 dormer, eave brackets, a finial |
| Focus | ±3 around the hero | ×2 | richer material, layered surround |
| Sides and back | — | ×0.5, never 0 | same window kit, fewer extras |

Readable from far away = large and dark (overhangs, recesses, openings); readable up close =
small and light-catching (trapdoors, buttons, chains). Spend blocks on the first group first.

---

## 11. Symmetry

- **Formal** (temples, churches, civic halls, palaces, castle gate fronts): symmetric about the
  entrance axis, odd bay count, hero on the axis.
- **Vernacular** (cottages, farms, town houses): asymmetric massing, but **every element is
  symmetric in itself** (each window, dormer, door, gable).
- **Symmetric blob** (mirrored masses, door dead centre, nothing dominant) is a failure: enlarge one
  side, add a tower or porch on one side, move the chimney off centre.
- **Break perfect mirroring in small things** (convention): a bench on one side, a planter on the
  other; vary one window kit. Exact mirroring of every block reads as machine-made, a known tell of
  generated settlements (GDMC judges).

---

## 12. Framing (posts and beams)

- **Corner posts always; intermediate posts every 3–5; beams at the sill, every floor line and the
  top plate**, each a continuous ring (consensus: PirateMC, Blockwerks).
- **Frame first, infill one block behind** (or posts pushed out): §6.
- **The frame is the strongest value contrast** on the building: dark frame on light infill
  (Tudor) or light stone frame on dark brick (§9).
- Posts are logs `axis=y`; beams use `axis` along their run; corner beams with bark on every face
  use `*_wood`. `b.timberWall` orients them for you.
- **Braces only in bays ≥ 4 wide**; one brace direction per panel, mirrored about the bay centre.
  Knee braces (upside-down stairs, leg on the post) work in any bay.
- **Floor beams span the short direction** of the house (WesterosCraft).
- Details and recipes: [components.md §2.1](components.md#21-timber-framing).

---

## 13. Foundations and ground contact

- **Foundations reach solid ground plus 1–2** (WesterosCraft: dirt or sand visible under walls
  "makes the build look incomplete"). Fill under every footprint column, including overhanging
  floors on slopes.
- **Floor level = highest ground point under the footprint + 1** (convention), so nothing is dug in
  and the downhill side shows more plinth.
- **Steps at every door** above grade (consensus); a door meets ground or a step, never air.
- **Plinth:** 1–3 courses of the darkest, roughest material of the build, +1 proud or flared with a
  water-table stair (§6).
- **Slopes:** level each section separately and give each its own roof, or let the downhill side
  become a full basement storey with its own door (wiki + GDMC praise). Don't flatten a pad.

```js
const ground = b.terrain({ height: (x, z) => 3 + 2 * kit.noise.fbm2(x, z, { scale: 20, seed: 2 }) + (z - 14) * 0.25 })
let F = 0
for (let x = H.x0; x <= H.x1; x++) for (let z = H.z0; z <= H.z1; z++) F = Math.max(F, ground(x, z) + 1)
const plinth = kit.palette({ cobblestone: 5, cobbled_deepslate: 3, mossy_cobblestone: 2 }, { scale: 3 })
for (let x = H.x0; x <= H.x1; x++) for (let z = H.z0; z <= H.z1; z++)
  for (let y = ground(x, z) - 1; y < F; y++) b.set(x, y, z, plinth)          // down to solid ground + 1
b.walls([H.x0, F, H.z0], [H.x1, F + 4, H.z1], 'spruce_planks')
b.door([16, F, H.z1], 'south', { material: 'spruce', steps: true })
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: F + 5, axis: 'x', material: 'dark_oak', gable: 'spruce_planks', eaveTrim: true })
```

---

## 14. Weathering and story

- **Age through variants with logic** (consensus): cracked/mossy at corners, openings, wall
  junctions, the base and north faces. "The placement of cracks shouldn't be random but
  intentional" (ArdaCraft). Kit: `b.texture` terms (§8) + `b.weather({ share })` on targeted boxes
  ([quality-and-critique.md §2.4](quality-and-critique.md#24-weathering-follows-logic-not-dice)).
- **Shares:** 0.1–0.2 for inhabited buildings, 0.3–0.5 for ruins; never one high share over the
  whole build.
- **Repairs read as history:** a patch of different stone, a newer timber wing, a lean-to added
  later with a different roof pitch (old buildings that were extended mix roof styles: wiki).
- **Every block has a purpose** (WesterosCraft): brackets hold eaves, bolts hold beams, lamps light
  doors. Give each house a profession and a back yard (washing, woodpile, crops, pen).
- **Wealth gradient** in towns: poor = darker wood, more stone, less glass, moss and vines,
  gravel paths, slabs over holes; rich = larger, more glass, more light, healthy plants (game.guide).
- **Signs of life raise GDMC scores**: lights, flags, chimney smoke, varied functions. Empty
  interiors behind clear glass, lava fires and identical repeated houses lower them.

---

## 15. Landscape integration

- **Transition ring:** 1–2 blocks of gravel, coarse dirt, path or flower bed at the wall base, then
  grass. Never let grass touch a timber wall without a stone plinth (convention).
- **Bushes at 2–3 corners**, one tree in the composition for scale, paths from every door to
  somewhere.
- **7-block rule** (BlueNerd, consensus for organic work): never more than 7 blocks in a straight
  line in terrain, paths, gardens or canopies. Curves are runs that lengthen and shorten
  gradually (e.g. 6‑5‑3‑3‑2), refined with slabs and layers (ArdaCraft).
- **Adapt, don't flatten** (GDMC): stilts, terraces, retaining walls, steps and ladders between
  levels; keep the hill. Judges criticise bulldozed pads, cut-off cliffs and floating sheets of
  rock or leaves.
- Paths, planting and terrain detail: [nature.md](nature.md).

```js
const ground = b.terrain({ height: (x, z) => 3 + 1.5 * kit.noise.fbm2(x, z, { scale: 18, seed: 4 }) })
let F = 0
for (let x = H.x0; x <= H.x1; x++) for (let z = H.z0; z <= H.z1; z++) F = Math.max(F, ground(x, z) + 1)
for (let x = H.x0; x <= H.x1; x++) for (let z = H.z0; z <= H.z1; z++) for (let y = ground(x, z) - 1; y < F; y++) b.set(x, y, z, 'cobblestone')
b.walls([H.x0, F, H.z0], [H.x1, F + 4, H.z1], 'oak_planks')
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: F + 5, axis: 'x', material: 'spruce', gable: 'oak_planks', eaveTrim: true })
// transition ring: 1 block all round, a ragged second block where clumped noise says so
const ring = kit.palette({ gravel: 3, coarse_dirt: 3, dirt_path: 2, andesite: 1 }, { scale: 2, seed: 6 })
for (let x = H.x0 - 2; x <= H.x1 + 2; x++) for (let z = H.z0 - 2; z <= H.z1 + 2; z++) {
  const d = Math.max(H.x0 - x, x - H.x1, H.z0 - z, z - H.z1)                       // 1 = touching the wall
  if (d < 1 || d > 2) continue
  if (d === 2 && kit.noise.coherent01(x, 0, z, { scale: 3, seed: 6 }) < 0.55) continue
  b.set(x, ground(x, z), z, ring)
}
b.path([[16, H.z1 + 2], [17, 30], [21, 40]], { width: 2, paint: kit.palette({ dirt_path: 5, coarse_dirt: 2, gravel: 1 }) })
for (const [x, z] of [[H.x0 - 2, H.z1 + 2], [H.x1 + 2, H.z0 - 2]]) b.bush([x, ground(x, z) + 1, z], { radius: 1.5 })
b.lampPost([18, ground(18, H.z1 + 3) + 1, H.z1 + 3], { post: 'spruce_fence', foot: 'cobblestone_wall' })
```

---

## 16. Readability at scale

- **Split big volumes**: several roof sections, wings and towers (wiki). One roof over 30×30 reads
  as a warehouse.
- **Scale details with the build.** At monumental scale mouldings are stairs and full blocks,
  columns 3×3, cornices 2 courses deep; trapdoor and button detail disappears (§3).
- **Hierarchy:** one dominant mass, 2–4 secondary masses, then tertiary features.
- **Repeat the palette across a complex** and repeat each colour in several places; vary within a
  theme (footprint, height, roof type, door side, chimney) so no two houses are identical.
- **Plain fields make the detailed parts readable**: "the cleaner, the better" (Raeyzeus).
- **What survives at each distance** (whole-scene shots, < 8 px per block): silhouette, roof vs wall
  value, overhang shadows, window rhythm as dark rectangles. Invest there before props
  ([composition.md §7](composition.md#7-megastructures-and-level-of-detail)).

---

## 17. Why builds look amateur, and the fix

| Symptom in the render | Fix (numbers) |
| --- | --- |
| Single box | 2–4 volumes; secondary ⅓–½; heights differ ≥ 2; offset wings 1–3 |
| Flat walls | frame 0 / infill −1; posts every 3–5; no flat run > 5 wide or > 4 tall |
| One material everywhere | 3–6 roles; inside a surface 60–75 / 20–35 / ≤ 10 |
| Speckled, noisy texture | value-adjacent steps, clumps 2–6, never 50/50 (`b.texture`) |
| Horizontal stripes | ragged band borders (`dither` 0.4–0.7, or `b.texture`) |
| Roof "stuck on" | overhang 1 (2 on big roofs), `eaveTrim: true`, rake overhang 1 |
| Paper-thin roof edge | default stair underside; double rake; trapdoor bargeboard |
| Roof too tall (barn) or a lid | roof 40–60% of the façade, ≤ 2 storeys; split wide plans |
| Glass flush in the wall | panes (7 px reveal) or glass set back 1; frame, sill, lintel |
| Windows scattered | one per bay, stacked; heads level with the door head |
| Building floats or is dug in | floor = highest ground + 1; foundation to ground + 1–2; steps |
| Toy scale | one scale tier for every opening, beam and trim |
| Over-detailed mess of stairs and slabs | 30–50% quiet wall; detail at edges and the focus only |
| Beautiful front, empty back | sides and back at 0.5× detail, never 0 |
| Symmetric blob | one dominant side, off-centre chimney, porch or tower on one side |
| Same house repeated | shared palette, varied footprint, height, roof, door side |
| Grass to the wall | plinth + 1–2 block transition ring, bushes at corners |
| Empty rooms behind clear glass | furnish, or tinted/brown/gray panes, curtains |
| Torches everywhere | lanterns at doors and every 8–12 on paths; hide raw light blocks |
| Leftover placeholder | `inspect --find wool` = 0 |

---

## 18. All of it in one recipe

A two-storey house on a slope: offset wing, plinth to terrain, stone ground floor, recessed timber
upper floor with bays, stacked windows, door in the centre bay, roof 46% of the façade, wing ridge
5 below the main ridge, chimney off centre, stone gradient, transition ring, path, bushes, lamp.

```js
export default function build(api) {
  const { kit } = api
  const b = api.builder([48, 32, 44], { seed: 21 })
  const ground = b.terrain({ height: (x, z) => 3 + 1.5 * kit.noise.fbm2(x, z, { scale: 18, seed: 2 }) + (z - 20) * 0.08 })
  const M = { x0: 10, z0: 14, x1: 22, z1: 22 }, W = { x0: 23, z0: 9, x1: 29, z1: 17 }    // main 13x9, wing 7x9 set 5 back
  let F = 0
  for (const R of [M, W]) for (let x = R.x0; x <= R.x1; x++) for (let z = R.z0; z <= R.z1; z++) F = Math.max(F, ground(x, z) + 1)
  // foundation to ground; plinth ring +1 one course lower
  for (const R of [M, W]) for (let x = R.x0 - 1; x <= R.x1 + 1; x++) for (let z = R.z0 - 1; z <= R.z1 + 1; z++) {
    const ring = x < R.x0 || x > R.x1 || z < R.z0 || z > R.z1
    for (let y = Math.min(ground(x, z), F - 1) - 1; y <= (ring ? F - 1 : F); y++) b.set(x, y, z, 'gray_wool', { keep: ring })
  }
  // ground floor in a stone placeholder; upper floor: infill at -1, frame at 0
  b.walls([M.x0, F + 1, M.z0], [M.x1, F + 4, M.z1], 'white_wool')
  b.walls([W.x0, F + 1, W.z0], [W.x1, F + 4, W.z1], 'white_wool')
  b.walls([M.x0 + 1, F + 5, M.z0 + 1], [M.x1 - 1, F + 8, M.z1 - 1], kit.palette({ calcite: 5, white_terracotta: 1 }))
  for (const [a, c] of [[[M.x0, F + 5, M.z0], [M.x1, F + 8, M.z0]], [[M.x0, F + 5, M.z1], [M.x1, F + 8, M.z1]],
                        [[M.x0, F + 5, M.z0], [M.x0, F + 8, M.z1]], [[M.x1, F + 5, M.z0], [M.x1, F + 8, M.z1]]])
    b.timberWall(a, c, { frame: 'stripped_dark_oak_log', infill: 'air', postEvery: 4 })
  for (const x of [12, 20]) {
    b.window([x, F + 2, M.z1], 'south', { width: 1, height: 2, shutters: true })
    b.window([x, F + 6, M.z1 - 1], 'south', { width: 1, height: 2 })
  }
  b.window([16, F + 6, M.z1 - 1], 'south', { width: 1, height: 2 })
  b.window([26, F + 2, W.z1], 'south', { width: 1, height: 2, shutters: true })
  b.door([16, F + 1, M.z1], 'south', { material: 'spruce', frame: 'stripped_dark_oak_log', awning: true, steps: true })
  // roofs: main gable, lower hip on the wing, chimney off centre on the back slope
  b.roof({ x0: M.x0, z0: M.z0, x1: M.x1, z1: M.z1, y: F + 9, axis: 'x', material: 'deepslate_tile', gable: 'calcite', eaveTrim: true })
  b.roof({ x0: W.x0, z0: W.z0, x1: W.x1, z1: W.z1, y: F + 5, type: 'hip', material: 'deepslate_tile', eaveTrim: true, overwrite: false })
  b.chimney([13, F + 1, M.z0 + 1], 15, { paint: kit.palette({ bricks: 4, granite: 1 }) })
  // material: stone ramp on the placeholders (dark base and corners, light at the door)
  b.texture([0, 0, 0], [47, F + 5, 43], ['polished_andesite', 'andesite', 'stone_bricks', 'cobblestone', 'mossy_cobblestone', 'cobbled_deepslate'],
    { only: ['white_wool', 'gray_wool'], base: 0.4, edge: 0.18, focus: [[16, F + 2, M.z1 + 1]], focusRadius: 5, seed: 4 })
  // ground: transition ring, path to the door, bushes at two corners, lamp
  const ring = kit.palette({ gravel: 3, coarse_dirt: 3, dirt_path: 2 }, { scale: 2, seed: 6 })
  for (let x = M.x0 - 3; x <= W.x1 + 3; x++) for (let z = W.z0 - 3; z <= M.z1 + 3; z++) {
    const d = Math.min(...[M, W].map(R => Math.max(R.x0 - 1 - x, x - R.x1 - 1, R.z0 - 1 - z, z - R.z1 - 1)))
    if (d < 1 || d > 2 || (d === 2 && kit.noise.coherent01(x, 0, z, { scale: 3, seed: 6 }) < 0.55)) continue
    b.set(x, ground(x, z), z, ring)
  }
  b.path([[16, M.z1 + 3], [17, 34], [20, 43]], { width: 2, paint: kit.palette({ dirt_path: 5, coarse_dirt: 2, gravel: 1 }) })
  b.bush([M.x0 - 3, ground(M.x0 - 3, M.z1 + 3) + 1, M.z1 + 3], { radius: 1.5 })
  b.bush([W.x1 + 3, ground(W.x1 + 3, W.z0 - 2) + 1, W.z0 - 2], { radius: 1.2 })
  b.lampPost([19, ground(19, M.z1 + 4) + 1, M.z1 + 4], { post: 'spruce_fence', foot: 'cobblestone_wall' })
  return b.finish({ name: 'principles-house' })
}
```

---

## Sources

- Minecraft Wiki tutorials: Roof construction guidelines, Roof types, Curved roofs, Walls and
  buttresses, Adding beauty to constructions, Color palette (minecraft.wiki, 2026).
- WesterosCraft, *Basic Building Guide for Applicants* (block variation, foundations, depth, purpose).
- ArdaCraft, *Gradient Guide* and *Layering Guide* (value adjacency, logic-driven cracks, terrain runs).
- Conquest Reforged, *Gradienting your Builds* (drip vs cluster, roofs, roads).
- minecraft.net: *Raeyzeus' Top 5 Building Tips*; *Make Your Houses Better* (Avomance); *How to do
  MEGA builds* (Grian, Pearlescent Moon); *Tips for Landscaping and Terraforming* (BlueNerd).
- Craftdex, *The Architecture of Builds* (massing ratios, +25% hero, 5-block depth threshold).
- PirateMC, *Houses: Better builds*; Blockwerks, *Medieval Timber-Frame House* (frame first, bays).
- Salge et al., *Impressions of the GDMC AI Settlement Generation Challenge*; M. R. Johnson, *GDMC
  Judging* (adaptation, repetition, signs of life).
- Measured values: vanilla 1.21.1 textures via `scripts/lib/data/block-colors.json`; model boxes
  from the renderer's default resource pack.
