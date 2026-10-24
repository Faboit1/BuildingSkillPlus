# Composition: villages, towns, castles, megabuilds

How to lay out many buildings so the whole reads as one believable place: settlement layout,
roads, squares, lots, landmarks and skylines, walls and castles, variety without chaos,
megastructure readability, and how to frame all of it in renders. Single buildings:
[principles.md](principles.md) and [components.md](components.md). Trees, terrain, water and paths in detail:
[nature.md](nature.md). Colours: [block-colors.md](block-colors.md). Families: [materials.md](materials.md).

The settlement helpers live in `scripts/lib/kit/plan.mjs` and are exposed as `kit.plan`:

| Helper | Does |
| --- | --- |
| `plan.heightmapOf(b, test?)` | snapshot `(x, z) → y` of the current ground (ignores trees/plants); `.isWater(x, z)` |
| `plan.routeRoad(ground, [x, z], [x, z], opts)` | terrain-aware A*: smoothed, graded polyline `[[x, y, z], ...]` (+ `.water`) |
| `plan.paintRoad(b, path, opts)` | cuts/fills the road into the terrain, slabs on half steps, clears plants, bridges water |
| `plan.lotsAlongRoad(path, opts)` | building lots facing the road: `{ x0, z0, x1, z1, facing, door, front, y }` |
| `plan.plaza(b, center, size, opts)` | levelled, paved, irregular square with blended edges, well/fountain/cross, lamps |
| `plan.curtainWall(b, polygon, opts)` | wall band + crenellations + projecting towers + gatehouses along a polygon |
| `plan.skylineReport(b)` | crown ratio, accents, roof-height variety, flat runs, ASCII skylines from S and E |
| `plan.ringPolygon`, `pointInPolygon`, `gradeProfile`, `chaikin`, `simplifyPolyline`, `resamplePolyline` | geometry |

A complete, tested example (walled village on noise terrain, river bridge, church module, lots,
houses, furlongs, lamps): see §3.10.

Tags used where it matters: **(history)** measured real-world data, **(research)** what human judges
of generated settlements rewarded or penalised (GDMC competition studies), **(convention)** builder
consensus, **(taste)** one reasonable choice among several.

---

## 0. The laws of large-scale composition

1. **Legible at a glance.** In one aerial render a viewer must find the centre, the main roads, the edge
   and 1–3 landmarks (Lynch: paths, edges, districts, nodes, landmarks). Players and judges orient by
   landmarks visible from afar **(research)**.
2. **One crown.** The most important building is central (or on the high point) and tallest:
   **≥ 1.8×, ideally 2.5–4×, the median roof height**. Roofs cascade down from it.
3. **Skewed sizes.** ~60% small, ~25% medium, ~8% large buildings, 1–3 landmarks. Never 30 equal houses.
4. **Varied but related.** Fix materials, roof pitch, window kit and accent colour once; vary footprint,
   height, roof form and ridge direction per building. Too similar blends together; too different looks
   haphazard **(research)**.
5. **Terrain first.** Follow the land. Flattened pads, buildings carved into hills, and houses hanging off
   cliffs on giant foundations are the most penalised settlement faults **(research)**. Max cut/fill per
   building: 3.
6. **Density falls from centre to edge**: tight, tall rows at the core → looser, lower houses → gardens,
   fields, pasture, woods. Beyond the core, houses line only the roads.
7. **Squares are outdoor rooms**: enclosed, roughly convex, building fronts at zero setback, streets
   entering at the corners, monument off-centre.
8. **Everything connects.** Every door has a path to the network; roads join roads, follow contours, cross
   water at narrow points. Unconnected houses read as scattered props **(research)**.
9. **Every element has a reason.** A tower guards a gate or a bend, a mill sits on the river, fields lie
   outside the wall, the tavern takes the corner. Function first, decoration second.
10. **Signature buildings.** 1–3 unique, evocative structures (windmill, watchtower, bridge chapel,
    lighthouse, mine head-frame) per settlement anchor memory **(research)**. No single gimmick may eat the build.
11. **Three reading distances.** Silhouette and value contrast from far, masses and rhythm at mid range,
    texture and props up close. Spend detail where the camera will see it (§7).
12. **Many block types inside one palette.** Visible block-type diversity correlated with judges'
    aesthetic ratings (ρ ≈ 0.66) **(research)** — get it from stairs, slabs, walls, variants and props of
    the same families, not from extra colours.

---

## 1. Scale (1 block = 1 m)

Pick the scale tier once ([README](README.md#scale-tiers)) and keep every building in it.

### 1.1 Buildings

| Building | Footprint | Height | Notes |
| --- | --- | --- | --- |
| Shed, hut | 4×5 – 5×7 | 1 storey | vanilla simple hut 5×5 |
| Cottage | 5×7 – 7×9 | 1–1.5 | |
| Row / town house | frontage 5–8 × depth 8–12 | 2–4 storeys | rarely over 8×10; medieval lot 8×24 m (house front, yard behind) **(history)** |
| Farmhouse, longhouse | 7×11 – 11×17 | 1–2 | |
| Merchant / patrician house | 9×11 – 13×17, often courtyard | 2–4 | |
| Inn (corner lot) | 9×13 – 13×19, L-shaped | 2–3 | **(convention)** |
| Market hall | 8×16 – 14×30, open arcade below | 2 | |
| Parish church | nave 8–12 × 20–40; tower 6–9 square | tower 20–35 + spire | |
| Cathedral at 0.5–1× | 60–130 long, 25–60 at transepts | vault 25–40, towers 50–110 | real: Notre-Dame 128×48 m, Chartres vault 37 m, towers 105–113 m, Cologne towers 157 m **(history)** |
| Keep | 15×15 – 25×25 | 20–35 (2.5–4× the curtain) | Rochester 21×21 m, 34 m; White Tower 36×32 m, 27 m **(history)** |
| Windmill | tower 5–7 wide | 12–18, sails 9–15 across | |

Story = 4 blocks (3 clear + floor), 5 for halls. Roof = 1–2 storeys tall. Footprints over ~15×15 need
several roof sections.

### 1.2 Fortifications (real → blocks)

| Element | Real **(history)** | Use |
| --- | --- | --- |
| Curtain wall height | early ≤ 6 m; Rochester 6.7 m; Ávila 12 m; Constantinople inner 12 m, outer 8.5–9 m | town 8–12, castle 10–16 |
| Wall thickness | Ávila 3 m; Constantinople inner 4.5–6 m | 3–5 (walk 2–3 + parapet 1) |
| Tower spacing | Carcassonne (Roman) 18–30 m; Ávila ≈ 29 m (2,516 m / 88 towers); Constantinople 40–60 m | **20–30** (default 24) + every corner over ~25° |
| Tower size | Constantinople 10–12 m; Rochester round tower 9 m | Ø 7–11 (flankers 5) |
| Tower height | Constantinople 15–20 m on a 12 m wall; Ávila gate towers 20 m on 12 m | **1.3–1.7× the wall**, or wall + 4–8 |
| Merlon / crenel | crenel 0.6–0.9 m, merlon 1.2–1.5 m wide | merlon 2 wide × 2 high, crenel 1, sill 1 (1:1 at small scale) |
| Moat | Beaumaris ≈ 5.5 m; Constantinople > 20 m wide, ~10 m deep, 20 m out | 5–9 wide, 3–4 deep, 2–6 from the wall foot |
| Concentric gap | Beaumaris ≈ 18 m; inner ward 59×54 m | gap 10–18; inner ward 35–60; outer wall 4–6 lower |
| Gate passage | — | 3–5 wide × 4–6 tall; gatehouse 9–15 wide, 10–16 deep, 3–6 above the walk |
| Motte | 3–30 m high (69% under 5 m), Ø 30–90 m | 6–15 high, Ø 25–60, flat top |

### 1.3 Streets, squares, settlements

| Element | Size |
| --- | --- |
| Lane / alley | 1–2 (medieval alleys 2–6 m) |
| Village street | 3 |
| Main street | 4–5 (medieval main streets 6–10 m) |
| Approach road / highway | 5–7 |
| Width ratio main : street : alley | **2 : 1 : 0.6** (watabou's town generator) |
| Max grade | trail ½, street ⅓, main street ¼ (rise per block) |
| Village green / well square | 12×16 – 20×24 (Alexander: 14–21 m short side; bigger "feels deserted") |
| Market square | 24×32 – 50×55 (bastide squares 50–55 m) **(history)** |
| City main square | 50×60 – 70×90; Kraków 3.79 ha is an extreme |
| Square proportion | short side ≈ height of the main facade on it; long side ≤ 2× short (Sitte) |

| Tier | Across | Buildings | Square | Landmarks | Walls |
| --- | --- | --- | --- | --- | --- |
| Hamlet / farmstead | 25–70 | 1–6 | yard | 0–1 (barn, mill) | fences, hedges |
| Village | 70–150 | 10–40 | green 12–20 | 1–2 (church, mill, tower) | none or palisade |
| Town | 150–300 | 40–200 | market 24–50 | 2–4 (church, keep, hall, gate towers) | optional, 2–4 gates |
| City | 300–700 | 200+ | main 50–70 + 2–5 small | 4–10 | yes, 3–6 gates, suburbs outside |

Density targets: built footprint / area ≈ 0.45–0.65 in a medieval core, 0.10–0.20 in a village.
A "game-believable" village has ≈ 5 buildings per 64×64 blocks and one field per 5 villagers **(research)**.

---

## 2. Choosing a layout

| Family | Use when | Character |
| --- | --- | --- |
| **Organic** (default) | medieval villages/towns, hills, rivers | curving streets, Y/T junctions, irregular squares, stepped fronts |
| **Street village** | along a road, river or ridge; small | one street, lots both sides, fields behind |
| **Radial** | around a castle, church or hill; spawn hubs | streets converge, ring roads, ring walls |
| **Planned grid (bastide)** | new towns, Roman, colonial, military | grid blocks, square off the main axis, church at an angle to the square, 8×24 lots **(history)** |
| **Grid + diagonals** | large cities | grid cut by angled and curved arteries |
| **Terrain-following** | steep sites | main roads along contours, short steep connectors |

Rule: organic if the site is hilly or has a river; grid only when the brief says planned.

---

## 3. The settlement pipeline

Build in this order — each step constrains the next, the way towns actually grow:

```
1 site       heightmap, slope, water; pick centre, castle hill, crossing points
2 square     carve the market square / green at the centre
3 roads      main roads square ↔ gates/map edges (A*), then bridges
4 walls      polygon around the planned core; gates where main roads cross
5 landmarks  reserve church, hall, keep sites next to the square / high ground
6 lanes      secondary streets inside, avoiding landmark sites
7 lots       frontage lots along every street and around the square
8 buildings  variants by density, district and anti-repetition rules
9 outskirts  ribbon houses on approach roads, gardens, fields, pasture
10 landscape trees (groves outside, few inside), hedges, ground cover
11 light     lamps every 8-12 on streets, one at every door and gate
12 review    skylineReport + renders (§9) → fix the biggest problem → repeat
```

### 3.1 Site

```js
const { kit } = api
const { plan } = kit
const b = api.builder([128, 64, 128], { seed: 11 })
b.terrain({ height: (x, z) => 14 + 6 * kit.noise.fbm2(x, z, { scale: 46, seed: 3 }) + 2.5 * kit.noise.fbm2(x, z, { scale: 14, seed: 4 }) })
let ground = plan.heightmapOf(b)          // re-take after every step that changes the ground
```

- **Centre**: flattish (slope ≤ 1 over ~20 blocks), 10–40 blocks from water, on the through-route.
  A low rise reads well: add a broad bump (+3 over radius 30) to the heightmap.
- **Castle / citadel**: prominence ≥ 8 over a 40-block radius, steep or wet on ≥ 2 sides, at the edge of town.
- **Avoid**: lava, unsupported sand/gravel, flood cells. Don't bridge puddles or treat them as lakes **(research)**.

### 3.2 Roads

Hierarchy (pick widths once per class and keep them):

| Class | Width | Paint (examples) |
| --- | --- | --- |
| Approach / main | 3–5 | `kit.palette({ dirt_path: 6, coarse_dirt: 2, gravel: 1 })`, edge `coarse_dirt`; in towns `cobblestone`/`stone_bricks`/`andesite` |
| Street | 3 | `dirt_path` + `coarse_dirt` + `gravel` |
| Lane / alley | 1–2 | `dirt_path`, `packed_mud`, `rooted_dirt` |
| Trail | 1–2 | `dirt_path`, `podzol`, `coarse_dirt`, `moss_block` edges |

```js
const square = plan.plaza(b, [56, 62], [15, 19], { feature: 'well', paint: kit.palette({ stone_bricks: 5, andesite: 2, cobblestone: 2, polished_andesite: 1 }) })
const inSquare = new Set(square.cells.map(([x, z]) => `${x},${z}`))
ground = plan.heightmapOf(b)
const roadCells = new Set()
const route = (from, to) => {
  const p = plan.routeRoad(ground, from, to, { avoid: (x, z) => inSquare.has(`${x},${z}`), roads: roadCells })
  for (const [x, , z] of p) roadCells.add(`${Math.round(x)},${Math.round(z)}`)   // later roads merge into it
  return p
}
const west = route([0, 56], [47, 60])                    // map edge → square rim
const east = route([65, 64], [127, 70])                  // crosses the river → plank bridge
const main = kit.palette({ dirt_path: 6, coarse_dirt: 2, gravel: 1 }, { seed: 5 })
for (const r of [west, east]) plan.paintRoad(b, r, { width: 3, paint: main, edge: 'coarse_dirt', bridge: { deck: 'spruce_planks' } })
ground = plan.heightmapOf(b)
```

What `routeRoad` does (defaults, all overridable):

| Cost | Default | Effect |
| --- | --- | --- |
| step of 1 block | +2.5 | prefers level ground |
| step of 2–3 | +10 per extra block; > 3 impassable | stairs/switchbacks only when unavoidable |
| water | ×6 per cell; wider than 24 impassable | crosses at narrow points |
| existing road (`roads`) | ×0.35 | later roads merge into trunks (organic branching) |
| turning | +0.6 per 45° | smooth, natural curves |
| cross-slope | +0.4 × side height difference | follows contours |
| within 2 of water | +0.8 | keeps off the banks |

Then: Douglas–Peucker (ε 1.2) → 2× Chaikin smoothing → resample every block → grade so the rise
never exceeds `maxRise` (⅓ default; use ¼ for main streets) with the least cut/fill → snap to half
blocks (`x.5` = bottom slab on the block below). Bridge decks stay ≥ `clearance` (2) above the water.

`paintRoad` fills embankments with `fill` (dirt), cuts banks (`cutLimit` 6), places a matching
bottom slab on half steps (cobblestone → `cobblestone_slab`; dirt-type roads have no slab, so pass
`slab: 'mud_brick_slab'` or accept the half step), clears plants/snow above, pulls a 1-block shoulder
toward the road level, and turns water cells into a deck with fence rails and log posts every 4.
Pass `avoid(x, z)` to protect buildings.

Junctions and curves:
- Organic towns are **T and Y junctions**; ≤ ~20% four-way crossings.
- Where ≥ 3 main roads meet, widen into a small square.
- Curves: radius 8–20 on streets, 25–60 on approaches. No 90° kink on a road narrower than ~7 meant to be driven.
- Never straight up a slope steeper than ⅓ — route along the contour or switch back.
- Add a direct link when the network detour between two anchors exceeds ~1.6× the straight distance
  (towns are nets, not trees). A minimum spanning tree over anchors + these loops is a good network.

### 3.3 Squares and plazas

```
           ┌──────┐ street enters at a corner, at an angle ("turbine" / pinwheel)
   ════════╛      │
   ║ church front ╟───┐          fronts at zero setback, arcade on 1–4 sides
   ║  (diagonal   │   │
   ║   view)   ●  │   │  ● statue / cross: off-centre, 20–60% toward the longest edge
   ║        ◯     │   │  ◯ well / fountain: near the centre in small squares
   ╚══╗           └───┘
      ╚════════════ street leaves at another corner, offset
```

- **Size**: short side 12–20 (village), 24–50 (town), 50–70 (city); long side 1.15–1.9× short.
  Short side ≈ facade height of the main building on it. Too big reads dead — prefer two medium squares.
- **Shape**: irregular but enclosed, roughly convex (trapezoid, kinked quadrilateral, widened street).
- **Edges**: continuous fronts, zero setback; streets enter at corners so you cannot see straight out.
- **Church**: on a corner or edge, front visible diagonally — almost never in the middle **(history)**.
- **Town hall / market hall**: fronts the square.

```js
plan.plaza(b, [56, 62], [15, 19], {
  shape: 'irregular',          // 'irregular' | 'rect' | 'round'; jitter 0.12 of the short side
  paint: kit.palette({ stone_bricks: 5, andesite: 2, cobblestone: 2 }),
  border: 'cobblestone',       // 1-block gutter around the rim
  feature: 'well',             // 'well' | 'fountain' | 'cross' (offset to an edge) | 'tree' | null
  blend: 3,                    // ground within 3 blocks eased toward the square level
  lamps: true,                 // lamp post near each corner
})                              // → { poly, y, cells, feature }
```

Buildings that front the square: run `lotsAlongRoad` around its outline (§3.5).

### 3.4 Districts and the density gradient

```js
const C = [56, 62]
const rho = (x, z) => Math.max(0.08, 1 - Math.pow(Math.hypot(x - C[0], z - C[1]) / 46, 1.5))   // 1 at centre → 0.08
// per lot: frontage 11 - 6ρ (± 1), storeys 1 + (ρ > 0.55) + 25% chance of +1, gap 0 when ρ > 0.75 (party walls)
```

| District (watabou generator) | Lot size | Regularity | Empty lots (courtyards) | Where |
| --- | --- | --- | --- | --- |
| Craftsmen (most of town) | small → large | medium | 4% | anywhere |
| Merchant | medium → large | medium | 15% | next to the square |
| Patrician | large | medium | 20% | beside parks, away from slums |
| Administration | large | regular | 4% | on the square |
| Poor quarter | small | chaotic | 3% | farthest from the centre |
| Military | large | regular | 25% | against the citadel or wall |
| Gate quarter | small → medium | medium | 4% | at gates, also outside them |

Mix in a city: ~58% ordinary fabric, ~14% poor, ~6% each merchant/patrician/market, 1 cathedral,
1 hall, 1 barracks, 1 park. Wealth shows as **more open space** (gardens), poverty as packed lots.
Give each district one visible trait inside the shared palette (roof colour mix, infill, lot size).
Put industry (tannery, smithy, quarry) downstream/downwind with a green or river buffer.

### 3.5 Lots

```js
const occupied = new Set(inSquare)                       // add landmark sites before lanes and lots
const insideTown = (x, z) => plan.pointInPolygon(x, z, poly)   // poly = wall polygon (§5.2); also keep ≥ 5 from it
const lots = plan.lotsAlongRoad(west, {
  roadWidth: 3, heightFn: ground, density: rho, occupied, roads: roadCells,
  inside: (x, z) => insideTown(x, z),                     // e.g. inside the wall, ≥ 5 from it
  frontage: ({ density, rng }) => Math.round(11 - 6 * density + rng() * 2),
  depth: ({ rng }) => 7 + Math.floor(rng() * 4),
  setback: ({ density }) => (density > 0.7 ? 0 : 1),
  gap: ({ density, rng }) => (density > 0.75 ? 0 : 1 + Math.floor(rng() * 3)),
  stats: {},                                              // collects rejection reasons when lots are scarce
})
// lots around the square: its outline is a "street" of width 1
const ring = [...square.poly, square.poly[0]]
lots.push(...plan.lotsAlongRoad(ring, { roadWidth: 1, heightFn: ground, occupied, roads: roadCells, frontage: [5, 7], depth: [8, 10], setback: 0, gap: 0 }))
```

- Each lot is an axis-aligned rectangle whose **front wall faces the road** (`facing` = outward direction
  of that wall; `door` = its centre cell; `front` = the cell in front). Along curves the cardinal snapping
  makes stepped, organic fronts; a lot that clips the road is pushed back up to 3 blocks.
- Lots with cut/fill > 3 (`maxCutFill`), water, or overlaps are skipped. If you get few lots, read
  `stats` (`outside`, `occupied`, `road`, `slope`) and widen the town, shrink the square, or add lanes.
- Core rows: zero gap (party walls) with a 1-block alley every 3–6 lots to the back yards.
- Corner lots get the larger or L-shaped building (inn, merchant). Long lots: house at the street, yard behind.
- Ribbon development outside the walls: `lotsAlongRoad(approachRoad, { inside: outsideTown, gap: [6, 12], setback: [2, 4] })`.

### 3.6 Houses from lots (with variation)

```js
const rng = kit.rng(11)
const roofs = [[6, 'dark_oak'], [3, 'deepslate_tile'], [1, 'mud_brick']]                 // 2–3 roof families, 60/30/10
const infills = [[3, kit.palette({ white_terracotta: 4, calcite: 1 })], [1, kit.palette({ mushroom_stem: 3, white_terracotta: 1 })]]
let prevFloors = 1
for (const lot of lots) {
  const { x0, z0, x1, z1, facing, y: y0 } = lot
  let lo = Infinity
  for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) lo = Math.min(lo, ground(x, z))
  let floors = Math.min(3, 1 + (lot.density > 0.55 ? 1 : 0) + (rng.chance(0.25) ? 1 : 0))
  if (Math.abs(floors - prevFloors) > 1) floors = prevFloors + Math.sign(floors - prevFloors)   // rows step ≤ 1 storey
  prevFloors = floors
  const top = y0 + floors * 4
  b.box([x0, lo - 1, z0], [x1, y0, z1], 'cobblestone')                                    // plinth to the lowest ground
  b.walls([x0, y0 + 1, z0], [x1, top, z1], rng.weighted(infills))
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box([cx, y0 + 1, cz], [cx, top, cz], 'spruce_log')
  b.box([x0 + 1, y0, z0 + 1], [x1 - 1, y0, z1 - 1], 'spruce_planks')
  const along = facing === 'north' || facing === 'south' ? 'x' : 'z'
  const axis = rng.chance(0.7) ? along : (along === 'x' ? 'z' : 'x')                     // 70% eaves to street, 30% gable
  const roof = b.roof({ x0, z0, x1, z1, y: top + 1, axis, material: rng.weighted(roofs), pitch: 1, gable: 'spruce_planks', eaveTrim: true })
  const [dx, dz] = lot.door
  b.door([dx, y0 + 1, dz], facing, { material: 'spruce' })
  if (floors > 1) b.window([dx, y0 + 6, dz], facing, { width: 1, height: 2 })
  if (rng.chance(0.6)) b.chimney([x0 + 1, y0 + 1, z0 + 1], roof.topY - y0 + 1, { paint: kit.palette({ bricks: 3, stone_bricks: 1 }) })
}
```

This is the minimum. For real quality build each house from parts (footprint × massing × roof ×
facade × details, §5.2) and follow [principles.md](principles.md) and [styles.md](styles.md).

### 3.7 Landmarks

| Settlement | Landmarks |
| --- | --- |
| Hamlet | 0–1 (barn, mill, shrine) |
| Village | 1–2 (church, windmill, watchtower) |
| Town | 2–4 (church, keep or castle, town / market hall, gate towers) |
| City | 4–10 (cathedral, citadel, town hall, parish towers, gate towers) |

Placement:
- **Church / cathedral**: on or beside the main square, tower end toward it, on a rise if possible.
  Make its tower **terminate a vista**: a straight street of ≥ 30 blocks points at it, or the approach road
  bends so it appears ahead (the Cinderella Castle principle: the landmark pulls visitors up the main street).
- **Castle / citadel**: highest defensible ground at the edge, backed by river or cliff.
- **Hall**: fronting the square. **Windmills**: ridges and open fields. **Watermills**: on the river below town.
- **Watchtowers, gate towers**: high points and road entries; space watchtowers apart.
- **Visibility test**: from points 60–200 blocks out on the approach roads, at least one landmark crown is in view.

Reserve landmark sites **before** lanes and lots. A landmark authored once as a module, stamped with the
rotation that turns it toward the square:

```js
const church = b.module([11, 44, 21])           // tower at z = 0, door facing north, floor at y = 4
// ... m.walls / m.roof / m.box / m.door / m.window on `church` ...
b.stamp(church, [x0, y0 - 4, z0], { rotate })    // rotate 1 → tower east, 2 → south, 3 → west
```

### 3.8 Skyline

```js
const sky = plan.skylineReport(b)
console.log(sky.text)            // crown, median, ratio, accents, warnings, ASCII skyline from S and E
```

| Check | Target |
| --- | --- |
| Crown ratio (tallest / median building height) | ≥ 1.8, ideally 2.5–4 |
| Secondary accents (≥ 1.3× median) | 1–4 (a rhythm of wall towers is fine if the crown dominates them) |
| Roof-height spread (sd of building heights) | ≥ 1.5 |
| Flat run (one height) | ≤ 15% of the skyline width |
| Twin equal peaks | avoid unless the composition is formal |

- Heights rise toward the crown: cascade of roofs from the main building down to the edge.
- Read the skyline in 3 planes: foreground roofs, landmark cluster, background ridge/mountains.
- The report separates long thin footprints (walls, rows) from buildings and counts tower peaks on them.

### 3.9 Edges and outskirts

```
core rows → fringe (gardens, sheds, orchards, workshops) → fields (furlong strips) → pasture/meadow (fences, hedges) → woodland edge
            each band 10–40 blocks                                                                         ↑ groves, not a wall of trees
```

- Walls make a hard edge: keep 4–8 clear inside (access to stairs), 2–6 outside to the moat, and
  10–30 clear beyond (cleared ground in front of fortifications) **(history)**. Suburbs still grow along roads outside the gates.
- Without walls, end the settlement with fields, a river, a hedge line or a forest edge — never a hard cut.

### 3.10 Worked example (tested)

`assets/examples/walled-village.mjs`, 128×64×128: noise terrain with a river, `plaza` with a well, four `routeRoad`
roads (one bridges the river), `curtainWall` on a 10-gon (18 towers, 3 gatehouses at the road crossings),
a church module stamped toward the square, four inner lanes, 16 lots in town plus a ribbon lot outside,
houses as in §3.6, three furlongs of crops, groves outside the wall, lamps every 10 blocks, and a skyline
report (crown ratio 2.24). Render it with `--views top,se,hero,low,south`.

---

## 4. Infrastructure

### 4.1 Road surfaces

Keep the walking line clean and the variety on the shoulders; vary in clumps (`kit.palette`), never
per block. Start at ~70% main / 20% secondary / 10% accent **(taste)**.

| Road | Centre | Edges / accents |
| --- | --- | --- |
| Village dirt (3) | `dirt_path` 65% | `coarse_dirt` 20%, `gravel` 10%, `rooted_dirt`, grass intruding |
| Medieval cobble (3–5) | `cobblestone` 40%, `stone_bricks` 15% | `mossy_cobblestone` 25%, `gravel` 20%; stone bricks near gates, wells, bridges |
| Muddy town road | `cobblestone` / `stone_bricks` near buildings | `packed_mud`, `mud`, `coarse_dirt` at the edges |
| Forest trail (1–2) | `dirt_path` | `podzol`, `coarse_dirt`, `moss_block`; ferns at edges |
| Mountain path (2) | `stone_bricks` 60%, `cobblestone` 40% | `andesite`, `gravel`; stairs/slabs for steps, walls on the drop side |
| Desert (3) | `cut_sandstone`, `smooth_sandstone` | `sand` spilling over the edges |
| Boardwalk / dock (3) | `spruce_planks` / `oak_planks` 80% | `stripped_oak_log` edge beams, fences |
| Plaza | `stone_bricks`, `polished_andesite`, `andesite` | `cobblestone` gutter; chiseled/polished pattern under the feature |

Slab ramps on graded roads are the main difference between a game road and a built one (`paintRoad`
does this for every material with a slab).

### 4.2 Bridges

```
   lamp  rail(wall/fence)                         deck 3–7 wide (Charles Bridge 9.5 m, 16 arches, max span 13.4 m)
 ──┬──────────────────────────────────────┬──     clearance ≥ 3–4 above water
   │\__/‾‾‾‾\__/‾‾‾‾‾‾\__/‾‾‾‾\__/│        arches: semicircular rise = span/2, segmental = span/4–span/3
   │▓▓|  ~~~~  |▓▓|  ~~~~~~  |▓▓|  ~~~~ |▓▓|    piers 2–4 thick (≥ span/5) with pointed cutwaters upstream
```

- Cross at the **narrowest** point within ±20 blocks of the desired line, **perpendicular** to the flow (± 20°).
- Small rural bridges hump 1–3 blocks at midspan. Important town bridges get a tower or chapel at one end.
- Stone: `stone_bricks` arches with upside-down `stone_brick_stairs` along the curve (smooth intrados),
  `stone_brick_wall` parapets, `cobblestone` piers. Timber: `spruce_log` posts every 3–5, `spruce_planks` deck,
  `spruce_fence` rails. Waterlog stairs/slabs below the water line.

### 4.3 Rivers and canals

- Meander wavelength ≈ **10–14 × river width** (≈ 11), bend radius ≈ 2–3 × width, meander belt ≈ 15–18 × width **(history)**.
  A 7-wide river swings on a period of ~77 blocks.
- Deep side on the outside of each bend (steep cut bank), sand/gravel point bar inside.
- Canal in town: straight, 5–9 wide, `stone_bricks` quay walls 1–2 above water, steps down every 20–40.
- Towns sit beside the river on the higher bank; bridges become nodes; mills on the river, tanneries downstream.
- Water mechanics, banks and beaches: [nature.md](nature.md) §3.

```js
// W, H, D = canvas size; WATER = water level; carve after b.terrain, before heightmapOf/roads
const riverX = z => 112 + 4 * Math.sin(z / 14)                 // centreline (period ≈ 88 for width ~9)
for (let z = 0; z < D; z += 1) for (let x = 0; x < W; x += 1) {
  const d = Math.abs(x - riverX(z))
  if (d > 4) continue
  const bed = WATER - (d < 2.5 ? 3 : 1)
  for (let y = bed + 1; y < H; y += 1) b.remove(x, y, z)
  b.set(x, bed, z, d < 2.5 ? 'gravel' : 'sand')
  for (let y = bed + 1; y <= WATER; y += 1) b.set(x, y, z, 'water')
}
```

### 4.4 Docks and harbours (convention)

- **Quay**: continuous stone wall 1–2 above the water, promenade 4–8 wide, warehouses at zero setback
  with doors or gables to the water, a timber crane, barrels and crates.
- **Piers**: perpendicular to the shore, 3–5 wide, 8–30 long, 10–20 apart. `spruce_log` posts every 3–4 down
  to the bed, deck 1–2 above water, trapdoor or slab edges.
- **Breakwater**: rough `cobblestone` / `andesite` / `stone` arm curving round the basin; a lighthouse or tower at the mouth is the waterfront landmark.
- Water at berths ≥ 2–3 deep. A castle that meets the harbour (Beaumaris had a tidal dock at its gate) is a strong composition **(history)**.

### 4.5 Fields

Real open fields **(history)**: 2–3 great fields per village, divided into furlongs (bundles of parallel
strips) ~200 m long and 5–20 m wide, with a slight reverse-S; a third lay fallow each year.
Minecraft: water hydrates farmland 4 blocks horizontally, so a strip is **9 wide: 4 farmland + 1 water + 4 farmland**.

```js
// fx, fz = furlong corner outside the town; ground = plan.heightmapOf(b); rng = kit.rng(seed)
const crops = [[4, 'wheat[age=7]'], [2, 'carrots[age=7]'], [2, 'potatoes[age=7]'], [1, 'beetroots[age=3]']]
for (let s = 0; s < 3; s += 1) {                         // one furlong: 3 parallel strips
  const crop = rng.weighted(crops)
  for (let t = 0; t < 22; t += 1) for (let k = 0; k < 9; k += 1) {
    const x = fx + t
    const z = fz + s * 10 + k                            // 1-block track between strips
    const gy = ground(x, z)
    b.remove(x, gy + 1, z)
    if (k === 4) b.set(x, gy, z, 'water')
    else { b.set(x, gy, z, 'farmland[moisture=7]'); b.set(x, gy + 1, z, crop) }
  }
}
```

- Strips run perpendicular to the village road, or along the contours on slopes (expand per height level).
  Rotate neighbouring furlongs 90° for a patchwork. Leave ~⅓ fallow (`coarse_dirt`/grass) or pasture.
- Boundaries: 1–2 block tracks, hedgerows (`oak_leaves` on `coarse_dirt`), fences, `cobblestone_wall` drystone walls, a tree in the hedge.
- Props: `hay_block` stacks, `composter`, a scarecrow (`oak_fence` + `hay_block` + `carved_pumpkin`), a small barn.
  Orchards: fruit trees on a 5–7 grid.

### 4.6 Trees, lamps, life

- Trees outside the walls in **groves** (noise mask), ~2.5× denser outside than inside; inside only in squares
  (1–2 feature trees), churchyards, gardens, riversides. Big trees: custom, 10–25 tall ([nature.md](nature.md) §1).
- Forest edge: a 6–12 block band of flowers → tall grass, ferns, bushes → small trees → full trees.
- Lamps every **8–12** blocks along streets, alternating sides on streets ≥ 5 wide, one at every door,
  gate and junction. Hostile mobs spawn only at block light 0 (lantern 15, torch 14, −1 per block):
  lanterns ≤ 24 apart along a street keep it spawn-proof.
- Props at doors and nodes (barrels, carts, stalls, benches, signposts, washing) are "proof of human
  activity" judges reward **(research)**; keep long street runs quieter.

---

## 5. Castles and fortifications

### 5.1 Pick a type and follow its logic

| Type | Plan | Composition |
| --- | --- | --- |
| Motte-and-bailey | mound with tower + kidney-shaped bailey, ditches in a figure-8 | tower on the motte is the crown |
| Keep-and-bailey | great square tower inside a walled bailey | keep 2.5–5× the curtain height |
| Enclosure | curtain + flanking towers, no keep | towers at every corner; strong gatehouse |
| Concentric | 2+ rings, **outer wall lower**, gates offset | big round inner towers, small D-towers outside |
| Spur / hilltop | walls follow contours, irregular | strongest side faces the only approach |
| Town walls | ring with gates on the roads | towers every 20–30, gate towers ~1.7× wall |

Defensive logic that makes a castle believable:
1. High ground, cleared approaches. 2. **One route of attack** — water, cliffs and slopes everywhere else,
gate on the long exposed approach. 3. Towers **project** so they fire along the wall face (flush towers add
nothing). 4. Double gate with a murder zone, portcullis with space to rise. 5. Inner sections separable.

### 5.2 `curtainWall`

```js
const poly = plan.ringPolygon([56, 62], [44, 41], { n: 10, jitter: 0.08, seed: 4 })   // or your own [[x, z], ...]
const wall = plan.curtainWall(b, poly, {
  height: 8, thickness: 3,                         // above local ground; top smoothed along the circuit
  paint: kit.palette({ stone_bricks: 6, andesite: 2, cobblestone: 2, mossy_stone_bricks: 1 }),
  walkway: 'polished_andesite',
  towerEvery: 22, towerRadius: 3, towerHeight: 5,  // + towers at turns > 25°
  towerShape: 'round',                             // 'round' | 'square'
  towerRoof: 'mixed',                              // 'cone' | 'flat' | 'mixed' (gate towers flat)
  roofMaterial: 'deepslate_tile',
  gates: crossings.map(at => ({ at, width: 3, height: 4 })),   // where main roads cross the polygon
})                                                 // → { towers, gates, topAt(s), inside(x, z), perimeter }
```

Gate positions: walk each main road and take the first point where `pointInPolygon` changes. Paint
roads **before** the wall; the gate keeps the road surface and the gatehouse rises between two flanking
towers to just below their tops. Flat towers get an overhanging parapet on upside-down stair corbels
(`corbels: true`) and crenels; arrow slits every `slits` (5) blocks along the outer face.

```
cross-section (outside ←→ inside)
   M M . M M . M M      y = top+2   merlons 2 wide, crenels 1 (2:1)
   P P P P P P P P      y = top+1   parapet sill, 1 high (chest height)
   ▒ W W W              y = top     wall-walk 2–3 wide
   ▒ █ █ █              body; slits 1×2 every 3–5 on the field side
  ▒▒ █ █ █              optional batter: 1-block step out over the bottom 2–4 courses
```

Hand-built variants:
- Small/toy look: 1:1 merlons (`b.battlements(..., { period: 2 })` on rectangles). Realistic: 2:1.
- Machicolations: parapet pushed out 1 over corbels (`stone_brick_stairs[half=top,facing=<toward the wall>]`), 1×1 holes between them.
- Hoardings: a timber gallery (`spruce_planks`, `spruce_fence`, `spruce_stairs` roof) on 1–2 towers — a strong silhouette accent.
- Regional merlons: swallowtail (Italy), rounded (Islamic/North African), stepped (Irish).

### 5.3 Gatehouse and barbican

```
        bailey
   ┌──┬─────────┬──┐  inner door
   │T │ passage │T │  murder holes every 2–3 in the ceiling
   │  │  3–5 w  │  │  portcullis #2 (iron_bars / chain), 4–6 clear above it
   │T │ murder  │T │  zone 4–8 long
   │  │  zone   │  │  portcullis #1
   └D─┘         └─D┘  D-towers r 3–5, projecting 3–6 beyond the wall face
         ▲ drawbridge 3–5 wide over the moat
   barbican: walled passage 10–25 long in front, own outer gate, one 90° bend
```

### 5.4 Keep and concentric layout

- Keep on the highest ground, at the far side of the ward from the gate (or on the motte). 15–25 wide,
  20–35 tall, corner turrets 3–4 above the battlements, pilaster buttresses.
- Bailey: hall (10–12 clear), chapel, kitchen, stables and barracks against the curtain, well, smithy;
  keep a 4–8 block route to the wall stairs.
- Concentric: inner ward 35–60, gap 10–18, inner wall 4–6 higher, outer towers ~60% of inner, gates offset ≥ 15 along the circuit.
- Moat 5–9 wide, 3–4 deep, 2–6 out from the wall foot; stone-lined or dry (`coarse_dirt`/`gravel`). Water from source blocks.

### 5.5 Castle palette

`stone_bricks` base clustered with `cracked_stone_bricks`, `mossy_stone_bricks`, `andesite`, `cobblestone`,
`tuff_bricks`, `polished_tuff`; moss low and on north/wet faces, cracks near openings and corners. Trim
`polished_andesite`, `chiseled_stone_bricks`, `stone_brick_stairs/slab/wall`. Dark accents `deepslate_bricks`,
`deepslate_tiles`. Timber `spruce`. Roofs `deepslate_tile` (slate), `spruce`, `waxed_oxidized_cut_copper`
(verdigris spires). Iron `iron_bars`, `chain`, `lantern`. Banners for colour at towers and gates.

---

## 6. Variety vs cohesion

GDMC judges sort building properties into three kinds **(research)**; map them like this:

| Fix once (settlement or district) | Vary per building | Maximise |
| --- | --- | --- |
| stone, frame wood, roof families (2–3) | footprint w × d (± 1–2) | doors reachable: 100% |
| roof pitch family, eave depth | storeys 1–3 (neighbours ± 1) | no floating or hanging foundations |
| window kit, frame pattern | roof form: gable / hip / cross-gable / jettied | lit streets (no light-0 cells) |
| lamp, fence, sign styles | ridge direction vs street (70/30) | plausible scale |
| street material per road class | roof colour (60/30/10), infill (1 of 2) | props and activity at doors |
| foundation logic | chimney, dormers, annexes, door side, weathering seed | interiors behind windows |

Rules:
- **Build from parts, not whole templates**: footprint × massing (main + 0–2 annexes) × roof (form, ridge,
  colour) × facade × details. 4 × 3 × 4 × 2 × 3 × 3 = 1,728 combinations from ~20 parts.
- **Vary the silhouette first** (height, ridge direction, roof form). Rotation and mirroring alone do not
  hide a repeated template.
- **No clone next door**: same template + same roof colour never within 3 lots on a street or 16 blocks.
- Row houses differ by 0–1 storey; 70% eaves-to-street, 30% gable-to-street **(taste)**.
- Seed per lot (`seed = hash(settlementSeed, lotIndex)`) so regeneration is stable while tuning.
- 1–3 **signature buildings** per settlement, authored with extra care.
- Biome-matched materials are expected, not impressive: judges called biome swaps "innovative" in year one and "boring" by year four **(research)**.

---

## 7. Megastructures and level of detail

### 7.1 Make very large things readable

- **Three nested scales**, each ~3–5× smaller: primary masses (read from 200+), secondary elements
  (bays, buttresses, turrets, dormers, string courses: 50–200), tertiary detail (frames, shutters, gradients: < 50).
  The classic failure is a missing middle level: huge plain boxes with tiny detail that vanishes **(taste)**.
- **Bay rhythm**: module 3–5 (houses), 5–7 (halls), 7–12 (palaces, naves; Chartres's nave is seven bays).
  Odd bay counts give a centre; break long runs A-A-B-A-A with a tower or pavilion every 5–9 bays;
  strengthen corners.
- **Tripartite**: base 15–25% (darker, battered, fewer openings), middle 55–70% (repeated bays),
  top 10–20% (the most complex silhouette: cornice, battlements, roofs, spires).
- **Quiet areas**: leave 50–70% of each surface calm; concentrate detail at entrances, corners, crown, eye level.
- **Depth scales with size**: 1-block reveals for houses; 2–5 block setbacks and buttresses on megastructures
  so their shadows still read from far away.
- **Forced perspective**: scale windows and ornament down on upper levels (2×3 → 1×2 → slits; blocks →
  walls/slabs/trapdoors) and the building reads taller (Cinderella Castle does this) **(history)**.

### 7.2 What survives at each distance

Pixels per block in a perspective render: `px = imageHeight / (2 · d · tan(fov / 2))` (fov is vertical,
as in `render.mjs`). At the default 960×720:

| Distance | fov 20 (elevations) | fov 40 (`se`, `nw`) | fov 50 (`hero`) | What reads |
| --- | --- | --- | --- | --- |
| 15 | 136 | 66 | 52 | every texture |
| 40 | 51 | 25 | 19 | textures, trapdoors, buttons |
| 80 | 26 | 12 | 10 | 1-block features (windows, merlons) |
| 160 | 13 | 6 | 5 | 2-block features; 1-block marginal |
| 320 | 6 | 3 | 2.4 | masses, colour fields, silhouettes |

Fit-all views put roughly **500–650 / W px per block** on a build W blocks wide (≈ 4 px for a 128-wide town):
judge the plan, masses, skyline and colour zones there; check 1-block detail only in close-ups.

- **Far tier**: skyline, value contrast roof / wall / ground / sky, voids (courtyards, gates), 2–3 accent colours.
- **Mid tier**: bays, towers, roof forms, street lines, density gradient, field patchwork, groves.
- **Near tier**: gradients, weathering, props, flowers, path edges.
- Distance lowers contrast and saturation (aerial perspective) **(history)**: far-reading elements need
  more value contrast — dark slate roofs on light towers against the sky, light walls against dark forest.

---

## 8. Terrain at settlement scale

Terrain recipes, slope materials and rivers: [nature.md](nature.md) §2–3. For settlements:

- **Frame the town**: a backdrop ridge 150–400 blocks behind the hero view (0.25–0.4× as tall as its
  distance), water in front, woods at the flanks, the town on a gentle rise or river terrace.
- **Don't flatten the site.** Flattened land reads as a city; building in place reads as a village that
  belongs to its landscape **(research)**. Terrace instead.
- **Seat each building**: pad at the median ground height of its lot, reject lots with cut/fill > 3,
  plinth down to the lowest ground (no dirt visible under walls), ≤ 3–4 exposed foundation courses; on
  steeper ground use a retaining wall and a terrace with steps, or move the building.
- Re-take `plan.heightmapOf(b)` after squares, roads and walls, before placing lots.

---

## 9. Spawn hubs and formal plazas

- **Hub and spoke**: an entry axis leads to a central plaza dominated by one landmark; districts branch off
  the hub (theme-park layout: main street → hub → lands, with a castle as the visual magnet) **(history)**.
- **First view**: spawn 20–40 blocks from the landmark, on its axis, facing it. Landmark ≥ 2× the height of the ring buildings.
- **Size**: vanilla spawn protection is 33×33. Hub plaza 30–60 across; spokes 5–9 wide; whole spawn 100–300 **(convention)**.
- **Symmetry is allowed** (bilateral or 4-fold, 4–8 spokes on cardinal/diagonal axes). Vary heights and give each spoke its own district identity (material, banner colour) so players know where they are.
- **Gateways** mark each spoke's start: an arch or gate with a change of floor, light or level.
- Signs at every spoke, no dark cells, no mazes, sightlines from the spawn point to every exit.

---

## 10. Framing: the render shot list

Render the **same shots every iteration** so comparisons are fair (`node scripts/render.mjs --nbt FILE ...`).
Presets: yaw = compass position of the camera (0 south, 90 east, 180 north, 270 west), pitch = degrees
above the horizon, fov vertical.

| Shot | Command | Judge |
| --- | --- | --- |
| Establishing aerial | `--views se,nw` (pitch 30, fov 40) | centre, roads, density gradient, edges, wall rhythm |
| Plan | `--views top` | road network, squares, lot pattern, fields; no lot overlaps |
| Skyline elevations | `--views south,east` (pitch 4, fov 20 — telephoto) | crown, accents, plateaus, cascade |
| Low approach | `--views low` (yaw 210, pitch 6, fov 55) | what a visitor sees arriving; landmark pull |
| Hero | `--views hero` (yaw 30, pitch 12, fov 50) | overall appeal; layered planes |
| Gate / approach close-up | `--yaw Y --pitch 15 --target GX,GY+4,GZ --distance 30 --fov 50 --view-name gate` | gatehouse, merlons, road entry |
| Street view | `--yaw Y --pitch 8 --target X,Y+3,Z --distance 16 --fov 60 --clip x0,y0,z0,x1,y1,z1` | fronts, doors, props, lamps (clip away blocking houses) |
| Night | `--lighting night --views se,hero` | lamp coverage, lit doors and gates |

- Put the camera on the side the main road arrives from: yaw = compass direction of that road.
- For towns over ~100 wide, raise `--width 1920 --height 1440` or add close-ups; fit-all views show ~4 px per block.
- Rule of thirds for hero and aerial (landmark on a third line); horizon near the middle for eye-level
  street views; foreground objects (trees, a wall corner) at the frame sides lead the eye in.

---

## 11. Critique checklist

Run `plan.skylineReport(b)` and the shot list, then answer:

1. **Centre**: can you point at it in the `se` render within two seconds (square + landmark)?
2. **Crown**: ratio ≥ 1.8 with 1–4 accents, no long flat run, roofs cascading toward it?
3. **Roads**: every door connected; contour-following curves; T/Y junctions; nothing straight up a steep slope; bridges at narrow points, perpendicular.
4. **Terrain**: no exposed foundations over 3–4 courses, no hanging buildings, no bulldozed plateau bigger than the core.
5. **Gradient**: tight and taller at the core, looser outward, fields and groves beyond, ribbons along roads.
6. **Edge**: wall, river, fields or forest edge — not an abrupt stop at the canvas.
7. **Variety**: neighbours differ in height, roof form or ridge, but share the culture; no clone within 3 lots.
8. **Squares**: shaped rooms, fronts at zero setback, corner entries, feature off-centre in big squares.
9. **Silhouette**: a 256-px blurred thumbnail of `se` still shows centre, crown, main road and edge.
10. **Value contrast**: roofs, walls and ground separate in greyscale.
11. **Scale cues**: doors 2 tall, lamps, trees and props read right next to big structures.
12. **Life and light**: lamps every 8–12, props at doors and nodes, crops in the fields, chimney smoke; check `--lighting night`.
13. **Fortifications**: towers every 20–30 and projecting, gates on roads, wall top stepped not cliffed, outer ring lower than inner.
14. **Story**: can you say what the place does (market town, port, frontier fort, mining village) and what was built first?

Faults human judges penalised most **(research)**: over-flattened or carved terrain; buildings hanging off
cliffs on giant foundations; implausible scale ("a straw hut several hundred meters on the side");
houses with no paths between them; repetition that shows "the limits of what the generator can express";
one gimmick crowding out the settlement; bridged puddles; lava, floods, collapsing sand and dark streets.

---

## Sources

- Salge et al., *Generative Design in Minecraft: Settlement Generation Competition* (2018) — judging criteria.
- Hervé, Salge, Warpefelt, *An Examination of the Hidden Judging Criteria in the GDMC Competition* (2023) — what judges rewarded and penalised.
- *Impressions of the GDMC AI Settlement Generation Challenge* (arXiv 2108.02955); Hervé et al., *Comparing PCG metrics with human evaluation* and *Automated isovist computation for Minecraft* (block diversity vs ratings).
- van der Staaij et al., *Believable Minecraft Settlements by Means of Decentralised Iterative Planning* (2022 GDMC winner: centre-outward growth, hull walls, terrain-hugging farms).
- watabou, *Medieval Fantasy City Generator* source (TownGeneratorOS: wards, street widths, lot subdivision, gates, towers).
- Parish & Müller, *Procedural Modeling of Cities* (SIGGRAPH 2001) — road growth, local constraints, bridges.
- C. Alexander, *A Pattern Language* (Small Public Squares, Density Rings, Activity Nodes, Main Gateways, Main Building, Cascade of Roofs, High Places); C. Sitte, *City Planning According to Artistic Principles* (via secondary summaries); K. Lynch, *The Image of the City*.
- Wikipedia: Walls of Constantinople, Walls of Ávila, Cité de Carcassonne, Concentric castle, Rochester Castle, White Tower, Motte-and-bailey, Battlement, Bastide, Open-field system, Ridge and furrow, Meander, Charles Bridge, Cinderella Castle, Aerial perspective.
- minecraft.wiki: *Tutorial:Building a metropolis* (road widths and grades), *Roof construction guidelines*, *Settlement guide*, *Farmland*, *Light*, *Options*.
- WesterosCraft *Building Fundamentals* (layout, foundations, gradients); MCME *Castle realism guide*; Clappers 2021, *Simulation-based believable procedurally generated villages*.
