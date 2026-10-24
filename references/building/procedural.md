# Procedural generation

Algorithms that make builds better than hand placement can: roofs over any footprint, facades
from a grammar, terrain, organic rock, scattering, interiors, settlement layout. Each section gives
the rule, the reason, the voxel pitfalls and kit code. Every snippet here was built with
`run-build.mjs` (no block-state problems) and checked in renders.

Conventions follow `references/kit-api.md`: `+x` east, `+z` south, `y` up; `b` is the builder,
`kit = api.kit`, `rng = kit.rng(seed)`.

| Problem | Technique | Kit | § |
| --- | --- | --- | --- |
| What judges reward and punish | GDMC lessons | — | 1 |
| Random choices that look designed | scoped decisions, coherent noise | `kit.rng`, `kit.palette` | 2 |
| Round shapes without spikes | fractional radii (tie rule) | `b.sphere/dome/tube` | 3 |
| Roof over an L/T/U/H/courtyard plan | height-field roofs | `b.compoundRoof` | 4 |
| Facades with rhythm and symmetry | split grammar | `facadeGrammar` (below) | 5 |
| Material variation | patches + physical bias | `kit.palette`, `b.texture` | 6 |
| Landscapes | noise stack, warp, terraces, slope materials | `b.terrain`, `kit.noise` | 7 |
| Rocks, cliffs, organic forms | signed distance fields | `b.sdf`, `kit.sdf` | 8 |
| Beams, chains, rivers, limbs | line connectivity, splines | `b.line`, `b.curve` | 9 |
| Trees, props, lamps | Poisson-disc scatter | `poissonDisk` (below) | 10 |
| Natural tree crowns | space colonization | `forest.mjs` → nature.md §1.10 | 11 |
| Rooms, doors, furniture | constrained growth | `growRooms` (below) | 12 |
| Districts, sites, roads | BFS Voronoi, scoring, A* | `plan.*` → composition.md | 13 |
| Modular tiling | wave function collapse | — | 14 |
| Catching artifacts | lint + progressive checks | `inspect.mjs --checks` | 15 |

---

## 1. Lessons from GDMC

The Generative Design in Minecraft (GDMC) Settlement Generation Challenge (2018–2026) runs
generators on unseen maps and has human judges score the result. It is the best evidence
available on what makes generated Minecraft architecture look good or bad.

### 1.1 The four criteria (each 0–10; 5 = "naive human", 10 = superhuman)

| Criterion | Judges ask |
| --- | --- |
| Adaptation | Do structures fit the terrain without heavy alteration? Do materials match the biome? Do different maps give clearly different settlements? |
| Functionality | Can a survival player walk everywhere? Is it lit (no mob spawns)? Are there food, beds, workstations? Is it scaled to the player? |
| Narrative | Can you infer who lives here, what they do and **in what order it was built**? Does function support the story (working walls on a fortress)? |
| Aesthetics | One consistent style, **appropriate** variation, balance and proportion, and **no jarring artifacts a human would not make**. |

Aesthetics is scored as consistency plus absence of mistakes, not beauty. No automatic metric
tested (block counts, entropy, diversity) correlated with the aesthetics or adaptation scores.
The number of distinct block types correlated 0.81 with narrative.

### 1.2 What loses points (judges' recurring complaints)

- **Flattening the site and building on a grid.** It reads as a city dropped onto the map, and the
  terrain looks "carved around the buildings".
- **Floating foundations.** This was the main criticism of the 2022 winner. Other examples: a plaza
  on a 50-block pillar, a 10-block impassable step.
- **Copies.** Identical houses, variation only in size or material, no district identity.
- **Empty interiors.** "Chests and furnaces" and odd furniture.
- **Generator traces.** Half-removed trees, grass left inside walls, a big bridge over a tiny puddle.
- **Water ignored.** Doors opening onto water, rivers with no crossing.
- **Dark spaces.** Light level 0 inside means mobs spawn.
- **Density extremes.** Either sprawling and disconnected or claustrophobic. Walls far from the core.
- **Too many of one thing on big maps.** The 2026 winner's own failure list: too many windmills
  and piers because a large district "had room". Use quotas, not "fill until full".

### 1.3 What wins

| Year | Winner | Reusable idea |
| --- | --- | --- |
| 2018 | Skwarski | 5000 random candidate sites scored per structure; A* roads with steep cells blocked; local wood type; the only entry that cleared trees completely |
| 2021 | AgentCraft (2nd) | Roads appear where simulated agents walk often (traffic counter with decay) |
| 2022 | Mike's Angels | In-memory blueprint layers (road, plot, wall); agents pick the best of a random subset of valid spots; plots specialised by neighbour preference; city wall = convex hull pushed out, A*-connected, top smoothed, towers at bends; farms grow by dilation per height level so they follow contours |
| 2023 | JEB_GEN_ | Agent levels unlock building types; Poisson-disc street lights; A* with Manhattan heuristic, height cost ×2, water ×10, cost divided by (1 + traffic) so roads merge into trunks, search limited to an ellipse (\|AC\| + \|CB\| ≤ 2\|AB\|) |
| 2024 | Frightful Hobgoblin | Villagers build the town in a simulation that is replayed; roofs are continuous height functions rasterised to stairs and slabs; roof material from blurred noise plus distance to the eave; jettied upper floors; desire lines wear grass → dirt → packed mud → gravel |
| 2026 | Merge Conflict (Leiden) | Terrain features → Voronoi districts grown by BFS (blocked by water and cliffs) → suitability and centrality scores → urban core capped at ~22% → hierarchical roads with reuse reinforcement and slight cost noise → ~100 schematics placed by scoring (road access, slope, entrance facing the road) → terraced aprons; highest aesthetics score in GDMC history |

### 1.4 Rules distilled

1. **Reject bad sites instead of flattening.** If a footprint's height range is over 2–3 blocks,
   move or shrink the building. Level to the entrance height and step the foundation down.
2. **Consistency belongs to the settlement, variation to the building.** One style family and
   palette. Vary proportions, roof type and upper-storey material per building.
3. **Every structure type gets a quota and a minimum spacing**, scaled with settlement size.
4. **Show history:** older buildings more weathered, a few half-built ones, worn paths, a graveyard.
5. **Lint before you look:** floating blocks, spikes on domes, stair shapes, dark rooms, leftovers.
6. **Validate progressively:** flat ground first (nothing hides mistakes), then gentle, then
   rugged terrain. Use 2–3 seeds per change.

---

## 2. Coherent randomness

Random choices look designed when they are **made once at the right scope** and **spatially
coherent** below that.

| Decision | Scope | Tool |
| --- | --- | --- |
| Style, palette family, roof pitch range | settlement / district | `rng.pick` once |
| Footprint, storeys, roof type, upper-floor material | building | `rng.weighted` |
| Window type and height, shutters, flower boxes | floor (same for the whole storey) | `rng` per floor |
| Window or blind wall, mirrored left/right | column / bay (stacked through all floors) | grammar §5 |
| Which block of a material family | block, **clumped** | `kit.palette(..., { scale: 2–4 })`, `kit.noise.coherent01` |

- **Never per-block white noise.** Don't use `palette(..., { scale: 0 })`, `Math.random()` or
  `hash01` per block for materials. The result is salt-and-pepper speckle.
- Wonka et al. found that random rule choice gets more chaotic the more rules you add, and fixed
  it by deciding attributes per floor and per column. That is why §5 decides per floor and column.
- Use one `kit.rng(seed)` stream per subsystem (layout, facades, interiors), so a change in one
  doesn't reshuffle the others. Use `kit.noise.hash01(x, y, z, seed)` for order-independent
  spatial decisions.

---

## 3. Fractional radii (the tie rule)

Block centres sit on integer coordinates and a shape keeps a block when `distance <= r`. When the
extreme block of an axis lies at distance **exactly** `r`, that row holds a single block: the
one-block spike on top of spheres, domes and towers. Measured with integer centres:

| r | Top layer of a sphere (blocks) | Top row of a circle |
| --- | --- | --- |
| 4 | **1** | **1** |
| 4.5 | 13 | 5 |
| 5 | **1** | **1** |
| 5.5 | 21 | 5 |
| 7 | **1** | **1** |
| 7.5 | 21 | 5 |

- **Odd width `w` → centre on a block, `r = w / 2`** (9 → 4.5, 15 → 7.5). The shape is exactly
  `w` wide and has a small flat cap.
- **Even width → centre between blocks (x.5), integer `r = w / 2`** (10 → centre 4.5 offset,
  r 5; 4×4 cap).
- Never mix an integer centre with an integer radius (or .5 with .5) unless you want the spike,
  for example as a finial seat. Apply the rule per axis. An x.5 centre with an integer y centre
  gives a 10-wide sphere only 9 tall, with a flat 32-block top.
- Domes follow the same rule vertically: odd width → dome centre on the first dome layer.
- 3-wide arches are the exception. The single crown block *is* the classic arch. From span 5 up,
  avoid it (strict `<` or `r + 0.25`).

```js
b.dome([30, 20, 30], 4.5, 'deepslate_tiles', { hollow: true })   // 9 wide, sits on y = 20
b.tube([30, 6, 30], 3.5, 14, 'stone_bricks')                      // 7-wide tower wall, gap-free ring
b.sphere([40.5, 12.5, 40.5], 5, 'stone')                          // 10 wide: x.5 centre on ALL axes, integer r
```

`hollow: true` keeps blocks with an outside face-neighbour. This is the thinnest watertight shell.
For 2-thick shells, subtract a smaller shape instead of testing more neighbours.

---

## 4. Height-field roofs: `b.compoundRoof`

One roof over any rectilinear plan, with correct hips, valleys, ridges and cross-gables. Use it
instead of stacking `b.roof` calls whenever the plan is not a single rectangle.

### 4.1 How it works

Every roof cell gets a **ring number** (1 = outermost eave ring) and a pitch profile maps rings to
heights (`rowLevels`, as in `b.roof`). The algorithm comes from the straight skeleton: the roof
height of a constant-pitch hip roof is the time the shrinking outline takes to reach a point.

- **Hip** uses the Chebyshev (L∞) distance to the outside of the overhang-dilated footprint. For
  rectilinear plans this *is* the straight-skeleton hip roof. Valleys at reflex corners, inner
  courtyard eaves and ridges fall out automatically.
- **Gable** gives each rectangle its own surface: the distance across it to the nearer eave. The
  union of the rectangles' roof volumes is the **max** of their surfaces, which creates valleys and
  cross-gables. Each surface continues one cell past its gable ends so the rakes stay straight.
- **Earlier rects win.** A later wing that enters an earlier one from one side (an L, T or U arm)
  continues only up to the earlier wing's ridge. The arm's ridge ends on the main ridge instead of
  punching out of the far slope. Wings that cross right through (a + plan) keep their whole surface.
- **Rasterising.** Half levels become bottom slabs. A drop of 1 or more becomes a stair facing
  uphill. Ridges become full blocks. A 0.5 drop becomes a full block inside the walls and a top slab
  on the overhang. Each column is closed down to its lowest face-neighbour, so steep rows never
  touch only along an edge. Stair corner shapes are computed by `finish()`.

Top view of a hip L (`>` = stair facing east, i.e. uphill to the east; `R` = ridge):

```
>vvvvvvvvvvvvv<
>>vvvvvvvvvvv<<
>>>vvvvvvvvv<<<
>>>>vvvvvvv<<<<
>>>>>RRRRR<<<<<
>>>>R<^^^^^<<<<      ← valley: < meets ^ on the diagonal from the inner corner
>>>>R<<^^^^^<<<
>>>>R<<<^^^^^<<
>>>>R<<<<^^^^^<
>>>>R<<<<
>>>>R<<<<
>>>>^<<<<
>>>^^^<<<
>>^^^^^<<
>^^^^^^^<
```

### 4.2 Options

```js
b.compoundRoof({
  rects: [[6, 6, 22, 14], [6, 14, 14, 24]], // wall-line rectangles [x0, z0, x1, z1], main wing FIRST
  // cells: [[x, z], ...] or Set of "x,z" — any footprint (holes = courtyards) instead of rects
  y: 11,                       // level of the roof row directly above the wall line (wall top + 1)
  type: 'gable',               // 'hip' | 'gable' | 'mixed'
  gableAxes: ['x', 'z'],       // per-rect ridge direction (default: longer side)
  material: 'spruce',          // family with stairs + slab, or { stairs, slab, block }
  pitch: 1,                    // 0.5 slab steps, 1 stairs, 2/3 steep, or a list from the eave in
  overhang: 1,                 // eaves beyond the side walls
  gableOverhang: 1,            // rake beyond the gable walls (default = overhang)
  gable: 'calcite',            // paint for wall-line cells under the roof (gable triangles)
  eaveTrim: true,              // upside-down stairs / top slabs under the outermost ring
  underside: 'stairs',         // upside-down stair under each 1:1 stair (clean 45° ceiling)
  ridgeCap: 'stone_brick_wall',// extra block on ridge cells
  thickness: 1,                // layers under the surface inside the walls
}) // → { topY, base, heights: Map "x,z" → y of the top roof block,
   //      cells: Map "x,z" → { y, top (surface, may be x.5), ring, kind, facing } }
```

- `type: 'mixed'`: rects with a `gableAxes` entry are gables, the rest hips. With no `gableAxes`,
  rect 0 is a hip and the others are gables (hipped main block with gabled wings).
- `cells` + `'gable'`/`'mixed'`: the footprint is covered with maximal rectangles first. A `+` plan
  given as cells gives the same roof as the two bars given as rects. Pass `rects` when you care
  about which wing dominates.
- `heights` places chimneys, dormers and finials: `b.chimney([x, y0, z], roof.heights.get(x + ',' + z) - y0 + 2)`.

### 4.3 Plans (all tested with pitch 1, 0.5 and `[0.5, 0.5, 1, 1, 2]`)

```js
// L, T, U, H, courtyard, cross; hip or gable
b.compoundRoof({ rects: [[0, 0, 12, 6], [0, 0, 6, 12]], y, type: 'hip' })                  // L
b.compoundRoof({ rects: [[0, 0, 16, 6], [5, 6, 11, 16]], y, type: 'gable' })               // T
b.compoundRoof({ rects: [[0, 0, 16, 6], [0, 0, 6, 14], [10, 0, 16, 14]], y, type: 'gable' }) // U
b.compoundRoof({ rects: [[0, 0, 4, 16], [12, 0, 16, 16], [4, 6, 12, 10]], y, type: 'mixed' }) // H
b.compoundRoof({ rects: [[0, 0, 16, 4], [0, 12, 16, 16], [0, 0, 4, 16], [12, 0, 16, 16]], y, type: 'hip' }) // courtyard
b.compoundRoof({ rects: [[0, 6, 18, 12], [6, 0, 12, 18]], y, type: 'gable' })              // + cross
```

### 4.4 Rules

- **Main wing first, widest first.** Its ridge runs through. Arms abut it with valleys.
- **Width parity sets the ridge.** Odd widths (including the overhang) give a 1-block ridge row of
  full blocks; add `ridgeCap` there. Even widths give back-to-back stairs, which need no cap.
- **Equal widths give equal ridge heights** and a clean ridge crossing. A narrower wing's ridge ends
  lower on the main slope. That is correct and reads as a secondary wing.
- **Flush outer corners** (a wing flush with the end of the main block) produce a valley that
  reaches the outer eave. That is the true union of the two roof volumes. If you don't want it, use
  `'mixed'` (hipped main block) or inset the wing 1–2 blocks.
- **Pitch profile = style.** `0.5` Mediterranean, `1` default, `2` Nordic/Gothic,
  `[0.5, 0.5, 1, 1, 2]` East-Asian, `[2, 2, 0.5]` gambrel. Steep rows extend the column down to the
  previous row, so the top wall rows on the eave line become roof blocks (thick eaves, intended).
- **Slab roofs** (`pitch: 0.5`) show half-block sawtooth at rakes and jagged valleys. Prefer
  them on simple plans, or use `eaveTrim` and a contrasting gable fill.
- Walls stop at `y - 1`. The `gable` paint fills the triangles. It also replaces underside notches
  and steep column fill on the gable wall line, so the triangle reads as one wall.

---

## 5. Facades from a split grammar

### 5.1 How it works

Shape and split grammars (Wonka et al. 2003 "Instant Architecture"; Müller et al. 2006 CGA)
derive a facade top-down:

1. Split into storeys.
2. Split each storey into bays with **floating sizes** (CGA `{ ~s : Tile }*`). Repeats are sized
   so they fill the wall exactly.
3. Fill bays with terminals (wall, window, door).

Coherence comes from deciding **per floor** (window type) and **per column** (window or blind,
stacked).

Rules that make generated facades read as designed:

- **Odd facade widths for a centred door.** Even widths need a 2-wide door. The window above the
  door is the strongest symmetry cue.
- **Distribute leftovers symmetrically from the centre out.** If symmetry is impossible (even
  count, odd remainder), change the count by one.
- At least one wall block between windows and from corners. Window width 1 on facades up to ~13,
  pairs (2) on wider ones.
- **Ground floor different:** door, plinth, shop windows. **Attic floor:** short windows.
- **Depth:** posts and beams on the wall line, infill and glass set back 1, sills and the plinth
  water table pushed out 1 (README laws 5–7).

### 5.2 Code

```js
// floating split: n ≈ L/target pieces, sizes differ by ≤ 1, extras in mirror pairs from the centre
function splitRepeat(L, target, minN = 1) {
  const n = Math.max(minN, Math.round(L / target))
  const s = new Array(n).fill(Math.floor(L / n))
  let rem = L - s[0] * n
  if (n % 2 === 1 && rem % 2 === 1) { s[(n - 1) / 2] += 1; rem -= 1 }
  for (let i = Math.ceil(n / 2) - 1; rem >= 2 && i >= 0; i -= 1) {
    if (i === n - 1 - i) continue
    s[i] += 1; s[n - 1 - i] += 1; rem -= 2
  }
  if (rem) s[Math.floor((n - 1) / 2)] += 1 // even n + odd remainder: pick another n for symmetry
  return s                                // splitRepeat(10, 3) → [3, 4, 3]; (13, 4) → [4, 5, 4]
}

// rows[y][u] tokens, y = 0 at the bottom: P plinth, F post, W infill, G glass, D door,
// B floor beam, K eave beam. Columns are decided once (stacked windows), styles once per floor.
function facadeGrammar(width, floors, { rng, groundH = 4, floorH = 4, door = true, winW } = {}) {
  const inner = width - 2
  const cw = inner % 2 ? 1 : 2 // centre column(s): door below, window above
  const half = (inner - cw) / 2
  const u = winW ?? (half >= 7 ? 2 : 1)
  let n = Math.max(0, Math.floor((half - 1) / (u + 1)))
  if (n === 0 && half >= u + 1) n = 1
  const gaps = n ? splitRepeat(half - n * u, (half - n * u) / (n + 1), n + 1) : [half]
  const left = []
  gaps.forEach((g, i) => {
    for (let j = 0; j < g; j += 1) left.push(g >= 3 && j === Math.floor(g / 2) && i > 0 && i < n ? 'F' : 'W')
    if (i < n) for (let j = 0; j < u; j += 1) left.push('G')
  })
  const cols = ['F', ...left, ...Array(cw).fill('C'), ...[...left].reverse(), 'F']
  const style = Array.from({ length: floors }, (_, f) => ({ winH: f === floors - 1 && floors >= 3 ? 1 : 2, centre: f > 0 && rng() < 0.8 }))
  const rows = [cols.map(() => 'P')]
  for (let f = 0; f < floors; f += 1) {
    const h = f === 0 ? groundH : floorH
    for (let y = 0; y < h; y += 1) {
      if (f > 0 && y === 0) { rows.push(cols.map(c => (c === 'F' ? 'F' : 'B'))); continue }
      const wy = y - (f > 0 ? 1 : 0) - 1
      const inWin = wy >= 0 && wy < style[f].winH
      rows.push(cols.map(c => {
        if (c === 'F') return 'F'
        if (c === 'C') return f === 0 ? (door && y < 2 ? 'D' : (!door && inWin ? 'G' : 'W')) : (style[f].centre && inWin ? 'G' : 'W')
        return c === 'G' && inWin ? 'G' : 'W'
      }))
    }
  }
  rows.push(cols.map(() => 'K'))
  return rows
}

// Paint token rows onto a wall line: posts/beams on the wall line (depth 0), infill and glass set
// back one block (depth -1), sills and the plinth's water table pushed out (+1).
function paintFacade(b, kit, rows, { from, to, y0, outward, mat }) {
  const { DIR, opposite } = kit
  const inward = opposite(outward)
  const step = [Math.sign(to[0] - from[0]), Math.sign(to[1] - from[1])]
  const along = step[0] ? 'x' : 'z'
  const w = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]) + 1
  const o = DIR[outward]
  const at = (u, y, d) => [from[0] + step[0] * u + o[0] * d, y0 + y, from[1] + step[1] * u + o[2] * d]
  rows.forEach((row, y) => row.forEach((t, u) => {
    const corner = u === 0 || u === w - 1
    const p0 = at(u, y, 0)
    const p1 = at(u, y, -1)
    if (t === 'P') {
      b.set(p0[0], p0[1], p0[2], mat.plinth)
      b.set(p1[0], p1[1], p1[2], mat.plinth)
      const q = at(u, y, 1)
      if (!corner) b.set(q[0], q[1], q[2], `stone_brick_stairs[facing=${inward},half=bottom]`)
    } else if (t === 'F') {
      b.set(p0[0], p0[1], p0[2], mat.post)
      if (!corner) b.set(p1[0], p1[1], p1[2], mat.infill)
    } else if (t === 'B' || t === 'K') {
      b.set(p0[0], p0[1], p0[2], `${mat.beam}[axis=${along}]`)
      b.set(p1[0], p1[1], p1[2], mat.infill)
    } else if (t === 'W') {
      b.set(p1[0], p1[1], p1[2], mat.infill)
    } else if (t === 'G') {
      b.set(p1[0], p1[1], p1[2], 'glass_pane')
      if (rows[y - 1][u] !== 'G') b.set(p0[0], p0[1] - 1, p0[2], `spruce_stairs[facing=${inward},half=top]`) // sill
    } else if (t === 'D' && rows[y - 1][u] !== 'D') {
      b.door(p1, outward, { material: 'spruce' })
    }
  }))
}
```

A timber-framed L house: six facades, one compound roof.

```js
const rng = kit.rng(5)
const mat = {
  plinth: kit.palette({ stone_bricks: 5, cobblestone: 2, andesite: 1 }, { scale: 2 }),
  post: 'dark_oak_log[axis=y]',
  beam: 'stripped_dark_oak_log',
  infill: kit.palette({ calcite: 6, white_terracotta: 1 }, { scale: 3 }),
}
const Y0 = 1
const MAIN = [6, 6, 22, 14]
const WING = [6, 14, 14, 24]
for (const [x0, z0, x1, z1] of [MAIN, WING]) {
  b.box([x0, Y0, z0], [x1, Y0, z1], 'spruce_planks')          // ground floor
  b.box([x0, Y0 + 5, z0], [x1, Y0 + 5, z1], 'spruce_planks')  // upper floor
}
const faces = [
  { from: [22, 6], to: [6, 6], outward: 'north', door: true },
  { from: [22, 14], to: [22, 6], outward: 'east', door: false },
  { from: [6, 6], to: [6, 24], outward: 'west', door: false },
  { from: [14, 14], to: [22, 14], outward: 'south', door: false },
  { from: [14, 24], to: [14, 14], outward: 'east', door: true },
  { from: [6, 24], to: [14, 24], outward: 'south', door: false },
]
for (const f of faces) {
  const w = Math.abs(f.to[0] - f.from[0]) + Math.abs(f.to[1] - f.from[1]) + 1
  paintFacade(b, kit, facadeGrammar(w, 2, { rng, door: f.door }), { ...f, y0: Y0, mat })
}
// plinth + 4 + 4 + eave beam = 10 rows → roof row at Y0 + 10
const roof = b.compoundRoof({ rects: [MAIN, WING], y: Y0 + 10, type: 'gable', material: 'spruce', gable: mat.infill })
```

`facadeGrammar(15, 3)` (top row first):

```
KKKKKKKKKKKKKKK
FWWWWWWWWWWWWWF
FWGWWGWGWGWWGWF   attic: 1-high windows, same columns
FWWWWWWWWWWWWWF
FBBBBBBBBBBBBBF   floor beam; posts run through
FWGWWGWGWGWWGWF
FWGWWGWGWGWWGWF   window above the door
FWWWWWWWWWWWWWF
FBBBBBBBBBBBBBF
FWWWWWWWWWWWWWF
FWGWWGWWWGWWGWF
FWGWWGWDWGWWGWF   2-high door in the centre column
FWWWWWWDWWWWWWF
PPPPPPPPPPPPPPP
```

Variation per building: `winW`, storey count, `groundH` (5 for shops), the token → block map
(stone ground floor + timber upper floor), and a jettied upper floor (outset 1 on the street side,
with upside-down stair brackets under it). The 2024 GDMC winner did this only when the house is at
least 9 deep. Keep the grammar and the depth layering the same across a settlement.

**Pitfalls:**

- Windows behind a neighbour or roof. Check that the cell in front of a window is air.
- Windows cutting through a floor beam. Drive interiors and facades from one storey table.
- Parity ignored, which gives off-centre doors.
- Grids that are too regular on small cottages: on walls 7 wide or less, one window per side plus
  the door is enough.

---

## 6. Material patches (texture without noise)

- **Clumped palettes:** `kit.palette(entries, { scale })` with `scale` 2–4 on walls and roofs, 3–8
  on terrain. `scale: 0` (per block) is static.
- **Ramps, not mixes:** 3–5 blocks of one texture family ordered light → dark, applied by
  `b.texture` (height, edges, drips, focus). See palettes.md and block-colors.md for ramps and
  materials.md for which stairs and slabs exist.
- **Physically biased weathering:** moss and dirt near the ground, on north faces, on wall tops
  and in crevices. Cracks on exposed edges. Streaks under sills and eaves. More on older buildings.
  Coherent noise sets the patch shape; the bias sets where patches occur.

```js
// moss patches on the plinth, favouring north faces
const moss = (x, y, z) => {
  const t = kit.noise.coherent01(x, y, z, { scale: 4, seed: 9 }) + (b.has(x, y, z - 1) ? 0 : 0.15)
  return t > 0.7 ? 'mossy_stone_bricks' : null      // null = leave as is
}
b.box([0, 1, 0], [35, 1, 35], moss, { only: 'stone_bricks' })
```

- **Roof streaks** (from the 2024 winner): pick the roof ramp step from blurred noise plus
  `−(height − base) / 5`, darkened on the outer two rings. This gives darker eaves and a lighter
  ridge with streaks.
- Weather **after** placing and rotating modules, so "north" means north.
- Weather only visible faces (skip blocks with no air neighbour).

---

## 7. Terrain stack

```js
const { fbm2, ridged2 } = kit.noise                      // fbm2 ≈ ±0.5 (sd 0.22): scale amplitudes ×2
const smooth = (a, c, t) => { const u = Math.min(1, Math.max(0, (t - a) / (c - a))); return u * u * (3 - 2 * u) }
const SEA = 8
const H = (x, z) => {
  const u = x + 10 * fbm2(x, z, { scale: 40, seed: 1 })   // domain warp: bends ridges and shores
  const v = z + 10 * fbm2(x + 97, z, { scale: 40, seed: 2 })
  const hills = 14 * fbm2(u, v, { scale: 48, octaves: 5, seed: 3 })
  const mountain = 30 * ridged2(u, v, { scale: 56, seed: 4 }) ** 2 * smooth(-0.1, 0.2, fbm2(x, z, { scale: 90, seed: 5 }))
  let h = 11 + hills + mountain
  const T = 3                                             // terraces on mountains only
  if (mountain > 6) h = Math.floor(h / T) * T + T * smooth(0.65, 1, (h / T) % 1)
  return h
}
const slope = (x, z) => Math.max(Math.abs(H(x + 1, z) - H(x - 1, z)), Math.abs(H(x, z + 1) - H(x, z - 1))) / 2
const surface = (x, y, z) => {
  if (y <= SEA + 1) return kit.noise.hash01(x, 0, z, 3) < 0.7 ? 'sand' : 'gravel'
  const s = slope(x, z)
  if (s > 1.6) return y % 3 === 0 ? 'andesite' : 'stone'            // cliffs: banded strata
  if (s > 0.9) return kit.noise.coherent01(x, 0, z, { scale: 3 }) < 0.5 ? 'coarse_dirt' : 'grass_block'
  return y > 30 ? 'snow_block' : 'grass_block'
}
const ground = b.terrain({ height: H, surface, layers: [{ depth: 1, paint: 'grass_block' }, { depth: 3, paint: 'dirt' }, { paint: 'stone' }] })
for (let x = 0; x < 96; x += 1) for (let z = 0; z < 96; z += 1)
  for (let y = ground(x, z) + 1; y <= SEA; y += 1) b.set(x, y, z, 'water')
```

| Layer | Why |
| --- | --- |
| fBm, gain 0.5 | Matches the measured spectrum of real mountain profiles; larger gain gets rough. Octaves ≈ log2(wavelength / 2): smaller octaves are per-block noise |
| ridged², masked by low-frequency fBm | Sharp crests in some areas only, not everywhere |
| Domain warp (±10 at scale 40) | Removes blobby isotropy; bends coasts and ridges |
| Terraces on steep zones | Make 1-block quantisation intentional (benches and risers) |
| Slope-driven surface | Grass on gentle slopes, coarse dirt at slope 1–1.6, banded stone above. Snow only on gentle slopes. Sand and gravel at the waterline |

- **Erosion without simulation** (Inigo Quilez): accumulate each octave's gradient `d` and add
  `amp * n / (1 + |d|²)`. Detail dies on steep slopes, giving smooth valleys and crisp crests.
- **Droplet erosion** (Lague's parameters): radius 3, inertia 0.05, capacity 4, erode/deposit 0.3,
  evaporation 0.01, lifetime 30. Run about 50k droplets on a 256² *float* heightmap, then round once.
  Gullies narrower than 3 blocks read as glitches: blur afterwards. A **talus pass** (move material
  when the height step exceeds about 1.2) makes scree slopes at cliff feet.
- **Fit the buildings:** stepped foundations to the lowest corner, terraced aprons, entrances level
  with the path. See §13 for site scoring and nature.md §2 for terrain detailing.

---

## 8. Signed distance fields

`b.sdf(min, max, fn, paint)` fills where `fn(x, y, z) <= 0`. Combine `kit.sdf.*` primitives with
`union`, `subtract`, `intersect`, `smoothUnion(k, ...)` (fillets) and `displace(f, amount, scale, seed)`.

```js
const { sdf } = kit
const site = [70, ground(70, 24), 24]
const rock = sdf.displace(sdf.smoothUnion(3,
  sdf.ellipsoid([site[0], site[1] + 2, site[2]], [8, 6, 7]),
  sdf.ellipsoid([site[0] - 6, site[1], site[2] + 4], [5, 4, 5]),
  sdf.capsule([site[0] + 3, site[1], site[2] - 4], [site[0] + 1, site[1] + 9, site[2] - 2], 2.5)), 1.4, 5, 7)
const tower = sdf.cylinder([site[0], site[1] + 4, site[2]], 3.5, 14)   // r 3.5 → 7 wide, no tie
const both = sdf.smoothUnion(2.5, rock, tower)                          // tower grows out of the rock
b.sdf([site[0] - 16, site[1] - 6, site[2] - 14], [site[0] + 14, site[1] + 20, site[2] + 14], both,
  (x, y, z) => (tower(x, y, z) <= 0.5 ? 'stone_bricks'                 // crisp material split by sub-SDF
    : kit.noise.coherent01(x, y, z, { scale: 4 }) < 0.3 ? 'andesite' : 'stone'))
b.dome([site[0], site[1] + 18, site[2]], 4.5, 'deepslate_tiles', { hollow: true })
```

- **Blend size `k`:** kit's `smoothUnion(k)` widens joins by up to `k / 4`. Use 1.5–3 for rocks and
  roots, 2–4 for terrain-to-building blends, and 0 for anything that should look built.
- **Bounding box** = union of the parts + displacement amount + `k`. Too small cuts flat faces.
- **Thin features vanish** between block centres. Keep capsule radii ≥ 0.87 (watertight), or sample
  the thin part with `<= 0.5`.
- **Displacement ≤ 1.5 blocks** at scale ≥ 4. Larger values tear off floating crumbs; lint for them.
- **Domain warp:** wrap the point before evaluating, e.g.
  `(x, y, z) => f(x + 2 * kit.noise.fbm3(x, y, z, { scale: 9 }), y, z)`. This gives strata and
  organic bulges.
- **Materials:** decide by which sub-shape is nearest (`tower(...) <= 0.5`), by height and by
  exposure. Not by the blended field alone.
- `kit.sdf.ellipsoid` is an approximation. It is fine for the inside test but distorted for
  thresholds other than 0.

---

## 9. Lines and curves

| Need | Call | Why |
| --- | --- | --- |
| Chains, ropes, fences, decorative diagonals | `b.line(a, c, p)` (`connect: 26`) | One block per step along the main axis. Diagonal steps touch only at edges |
| Anything walkable or watertight: wall polylines, channels, ramps, pipes | `b.line(a, c, p, { connect: 6 })` | Face-connected walk (supercover family): no see-through gaps |
| Round beams, cables, columns | `b.line(a, c, p, { radius })` | Capsule. Radius ≥ 0.87 stays watertight |
| Rivers, arches, limbs, buttresses through chosen points | `b.curve(points, p, { radius: t => r })` | Catmull-Rom through the points; tapering radius; thin curves are face-connected |

- Rasterising sampled curves: never just round the samples, because gaps appear wherever the curve
  moves more than one block per sample. Connect consecutive samples (`b.curve` does).
- Long 45° runs look jagged in Minecraft. Prefer axis-aligned runs with gentle bends, or draw
  diagonals 2–3 wide.
- Walkable curves change `y` by at most 1 per step, with stairs or slabs at each change (§13 roads).

---

## 10. Poisson-disc scatter

Bridson's algorithm places points at least `r` apart with no clumps and no grid (blue noise). Use
it for trees, rocks, props, lamp posts and district seeds. JEB_GEN_ used it for street lights.

```js
function poissonDisk(x0, z0, x1, z1, r, rng, { k = 30, accept = () => true } = {}) {
  const cell = r / Math.SQRT2
  const W = Math.ceil((x1 - x0 + 1) / cell)
  const H = Math.ceil((z1 - z0 + 1) / cell)
  const grid = new Int32Array(W * H).fill(-1)
  const pts = []
  const active = []
  const gi = (x, z) => Math.floor((z - z0) / cell) * W + Math.floor((x - x0) / cell)
  const fits = (x, z) => {
    if (x < x0 || z < z0 || x > x1 || z > z1 || !accept(Math.round(x), Math.round(z))) return false
    const cx = Math.floor((x - x0) / cell)
    const cz = Math.floor((z - z0) / cell)
    for (let j = Math.max(0, cz - 2); j <= Math.min(H - 1, cz + 2); j += 1)
      for (let i = Math.max(0, cx - 2); i <= Math.min(W - 1, cx + 2); i += 1) {
        const q = grid[j * W + i]
        if (q >= 0 && (pts[q][0] - x) ** 2 + (pts[q][1] - z) ** 2 < r * r) return false
      }
    return true
  }
  const add = p => { pts.push(p); active.push(pts.length - 1); grid[gi(p[0], p[1])] = pts.length - 1 }
  for (let t = 0; t < 200 && !pts.length; t += 1) { const p = [rng.range(x0, x1), rng.range(z0, z1)]; if (fits(...p)) add(p) }
  while (active.length) {
    const ai = rng.int(0, active.length - 1)
    const [px, pz] = pts[active[ai]]
    let found = false
    for (let t = 0; t < k && !found; t += 1) {
      const a = rng.range(0, 2 * Math.PI)
      const d = rng.range(r, 2 * r)
      const q = [px + Math.cos(a) * d, pz + Math.sin(a) * d]
      if (fits(...q)) { add(q); found = true }
    }
    if (!found) active.splice(ai, 1)
  }
  return pts.map(([x, z]) => [Math.round(x), Math.round(z)])
}

// trees in coherent patches, inset from the canvas edge (crowns clip otherwise);
// add `&& !insidePlot(x, z)` to keep them off building plots
const trees = poissonDisk(6, 6, 89, 89, 7, rng, {
  accept: (x, z) => ground(x, z) > SEA && kit.noise.coherent01(x, 0, z, { scale: 18 }) < 0.55,
})
for (const [x, z] of trees) b.tree([x, ground(x, z) + 1, z], rng.chance(0.7) ? 'oak' : 'birch', { seed: x * 31 + z })
```

| Item | r (blocks) |
| --- | --- |
| Big trees | 7–10 |
| Small trees, bushes | 3–5 |
| Boulders | 6–12, clustered by a mask |
| Lamp posts along a road | 8–12, within 3 of the road |
| District seeds | 18–30 |

Vary density with the `accept` mask (forest edge, clearings), not by changing `r` per point. Leave
1–2 blocks around buildings and paths.

---

## 11. Trees: space colonization

Use `spaceColonizationTree` and `forest` from `scripts/lib/kit/forest.mjs`, documented in
nature.md §1.10. This guide does not duplicate them. The algorithm (Runions, Lane & Prusinkiewicz
2007) works like this:

- Attraction points fill the crown envelope.
- Each point pulls its nearest branch node within the influence radius.
- Each pulled node grows one segment toward the average direction.
- Points within the kill distance are removed.
- Branch radius follows the pipe model `rⁿ = Σ r_childⁿ`, with n = 2–3.

It gives the most natural crowns because branches compete for space and never cross. Fewer points
or a larger kill distance give a sparser, more irregular crown. A small influence radius gives
meandering tips. Points only near the envelope give a hollow shrub.

L-systems (bracketed strings plus a 3D turtle) suit regular or ornamental plants: vines, ferns,
bamboo, wrought iron. They are a poor fit for natural crowns, because branches ignore each other.

---

## 12. Interiors

Three layers: **partition → circulation → furnishing by role**. Empty or "chest and furnace"
interiors are among judges' top complaints.

```js
// Constrained growth (Lopes 2010; Green, Salge & Togelius 2019): 2x2 seeds take turns growing one
// cell into free 4-neighbours that do not touch another room, leaving 1-thick walls.
// g[z][x]: -2 wall, room id >= 0. The border of the W x D grid is the outer wall.
function growRooms(W, D, nRooms, rng) {
  const g = Array.from({ length: D }, (_, z) => Array.from({ length: W }, (_, x) => (x === 0 || z === 0 || x === W - 1 || z === D - 1 ? -2 : -1)))
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]]
  const rooms = []
  for (let tries = 0; rooms.length < nRooms && tries < 200; tries += 1) {
    const x = rng.int(1, W - 3)
    const z = rng.int(1, D - 3)
    let ok = true
    for (let dz = -1; dz <= 2; dz += 1) for (let dx = -1; dx <= 2; dx += 1) if ((g[z + dz]?.[x + dx] ?? -2) >= 0) ok = false
    if (!ok) continue
    for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g[z + c][x + a] = rooms.length
    rooms.push(rooms.length)
  }
  for (let grew = true; grew;) {
    grew = false
    for (const r of rng.shuffle([...rooms])) {
      const cand = []
      for (let z = 1; z < D - 1; z += 1) for (let x = 1; x < W - 1; x += 1) {
        if (g[z][x] !== -1) continue
        if (N4.some(([a, c]) => g[z + c][x + a] === r) && !N8.some(([a, c]) => g[z + c][x + a] >= 0 && g[z + c][x + a] !== r)) cand.push([x, z])
      }
      if (cand.length) { const [x, z] = rng.pick(cand); g[z][x] = r; grew = true }
    }
  }
  for (const row of g) row.forEach((v, i) => { if (v === -1) row[i] = -2 })
  return g
}
// One door per pair of touching rooms: the middle wall cell with room A on one side and B opposite.
function roomDoors(g) {
  const runs = new Map()
  for (let z = 1; z < g.length - 1; z += 1) for (let x = 1; x < g[0].length - 1; x += 1) {
    if (g[z][x] !== -2) continue
    for (const [a, c] of [[1, 0], [0, 1]]) {
      const r1 = g[z - c][x - a]
      const r2 = g[z + c][x + a]
      if (r1 >= 0 && r2 >= 0 && r1 !== r2) {
        const key = `${Math.min(r1, r2)}-${Math.max(r1, r2)}`
        if (!runs.has(key)) runs.set(key, [])
        runs.get(key).push([x, z, a ? 'east' : 'south'])
      }
    }
  }
  return [...runs.values()].map(cells => cells[Math.floor(cells.length / 2)])
}

// ground floor of the 17x9 main wing above: grid over the infill ring (wall line + 1)
const [gx0, gz0] = [7, 7]
const g = growRooms(15, 7, 3, rng)
g.forEach((row, z) => row.forEach((v, x) => {
  if (v === -2 && x > 0 && z > 0 && x < 14 && z < 6) b.box([gx0 + x, Y0 + 1, gz0 + z], [gx0 + x, Y0 + 4, gz0 + z], 'spruce_planks')
}))
for (const [x, z, facing] of roomDoors(g)) b.door([gx0 + x, Y0 + 1, gz0 + z], facing, { material: 'spruce' })
const roles = [['crafting_table', 'barrel', 'smoker'], ['bookshelf', 'lectern', 'chest'], ['barrel', 'chest', 'loom']]
const roomCells = new Map()
g.forEach((row, z) => row.forEach((v, x) => { if (v >= 0) { if (!roomCells.has(v)) roomCells.set(v, []); roomCells.get(v).push([x, z]) } }))
for (const [r, cells] of roomCells) {
  const againstWall = cells.filter(([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, c]) => g[z + c][x + a] === -2).length === 1)
  rng.shuffle(againstWall).slice(0, 3).forEach(([x, z], i) => b.set(gx0 + x, Y0 + 1, gz0 + z, roles[r % roles.length][i], { keep: true }))
  const [lx, lz] = cells[Math.floor(cells.length / 2)]
  b.set(gx0 + lx, Y0 + 4, gz0 + lz, 'lantern[hanging=true]', { keep: true })
}
b.remove(14, Y0 + 1, 8); b.remove(14, Y0 + 2, 8)       // keep the cell behind the front door free
```

| Rule | Number |
| --- | --- |
| Rooms per floor | about interior area / 30–40 (a 13×5 interior gets 2–3). The paper's `cbrt(area)` over-splits small houses |
| Smallest room | 3×3 interior. Merge smaller rooms into a neighbour |
| Doors | One per touching pair is enough. For loops in big houses, add 1–2 extra doors |
| Front door | The cell behind it stays free. The room it opens into is the hall or living room |
| Stairs | Reserve the stairwell before partitioning: along a wall, 3 blocks of headroom under the roof, not in front of a door or chimney |
| Furniture | Against walls first (beds with the head to the wall, storage); centrepiece (table) second; carpet in about 40% of rooms with a side over 3 |
| Lights | Every floor cell within about 6 blocks of a light. The 2024 winner spaced torches more than 9 apart (Manhattan) on room borders |

- **Roles from the building:** smithy gets smithing table, grindstone, blast furnace. Library gets
  bookshelf and lectern. Farmhouse gets composter and barrels. Every bedroom gets a bed (both
  halves are completed by `finish()`).
- **Marker furnishing** (2026 winner): mark *where* furniture may go in a module and fill the
  clusters from role pools on every stamp. The same house gets a different arrangement each time.
- More furniture recipes are in interiors-and-lighting.md.

---

## 13. Settlements: districts, sites, roads

### 13.1 Districts by obstacle-aware Voronoi (2026 winner)

```js
// Multi-source BFS from seeds over passable cells (water/cliffs block), Lloyd-relaxed.
function voronoiDistricts(x0, z0, x1, z1, seeds, passable, iters = 3) {
  const W = x1 - x0 + 1
  const D = z1 - z0 + 1
  let label
  for (let it = 0; it <= iters; it += 1) {
    label = new Int32Array(W * D).fill(-1)
    const q = []
    seeds.forEach(([x, z], i) => { const c = (z - z0) * W + (x - x0); label[c] = i; q.push(c) })
    for (let h = 0; h < q.length; h += 1) {
      const c = q[h]
      const x = c % W
      const z = (c - x) / W
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const nz = z + dz
        const n = nz * W + nx
        if (nx >= 0 && nz >= 0 && nx < W && nz < D && label[n] < 0 && passable(nx + x0, nz + z0)) { label[n] = label[c]; q.push(n) }
      }
    }
    if (it === iters) break
    const sum = seeds.map(() => [0, 0, 0])
    label.forEach((l, c) => { if (l >= 0) { sum[l][0] += c % W; sum[l][1] += Math.floor(c / W); sum[l][2] += 1 } })
    seeds = seeds.map((s, i) => {
      if (!sum[i][2]) return s
      const p = [x0 + Math.round(sum[i][0] / sum[i][2]), z0 + Math.round(sum[i][1] / sum[i][2])]
      return passable(...p) ? p : s
    })
  }
  return { at: (x, z) => label[(z - z0) * W + (x - x0)], seeds }
}
const passable = (x, z) => ground(x, z) > SEA && slope(x, z) < 1.2
const seeds = poissonDisk(4, 4, 91, 91, 22, rng, { accept: passable }).slice(0, 8)
const districts = voronoiDistricts(0, 0, 95, 95, seeds, passable)   // districts.at(x, z) → id, -1 unreachable
```

Then classify each district once, using its mean slope, water share, distance to water and
centrality:

- The **urban core** is the flattest and most central districts, capped at ~20–25% of buildable land.
- **Farms and orchards** go on flat land near water, next to the core.
- **Forest buffers** go where trees already stand.
- **Harbours** go where the district has coastline.
- **Off-limits:** steep or wet districts.
- **Landmarks** take terrain features: castle or church on the highest central district,
  watchtowers on hilltops, windmills on raised flat farmland.
- Density, height and stone share fall from the core outward. The graveyard goes at the edge.

### 13.2 Scored placement with quotas

```js
// best of a random subset of candidates; -Infinity = rejected
function bestSite(candidates, score, { tries = 400, rng }) {
  let best = null
  for (let i = 0; i < Math.min(tries, candidates.length); i += 1) {
    const c = candidates[rng.int(0, candidates.length - 1)]
    const s = score(c)
    if (s > -Infinity && (!best || s > best.s)) best = { ...c, s }
  }
  return best
}
const placed = []
const candidates = []
for (let x = 6; x < 84; x += 1) for (let z = 6; z < 84; z += 1) candidates.push({ x, z })
const lot = bestSite(candidates, ({ x, z }) => {
  let lo = Infinity
  let hi = -Infinity
  for (const [dx, dz] of [[0, 0], [6, 0], [0, 6], [6, 6], [3, 3]]) { const h = ground(x + dx, z + dz); lo = Math.min(lo, h); hi = Math.max(hi, h) }
  if (hi - lo > 2 || lo <= SEA || districts.at(x, z) < 0) return -Infinity    // reject, don't flatten
  const near = Math.min(...placed.map(p => Math.hypot(p.x - x, p.z - z)), 99)
  if (near < 12) return -Infinity                                            // spacing to own kind
  return -(hi - lo) * 3 - Math.abs(near - 16)                               // flat and clustered
}, { rng })
if (lot) placed.push(lot)                                                    // repeat per building
```

- Score **all four rotations** with the entrance facing the road. Add bonuses for road access and
  for civic buildings facing the centre.
- **Quotas:** one town hall, one church, about one windmill per 3–4 fields, piers per coastline
  length. Count what is placed; never "fill while space remains".
- **Neighbour preferences** produce districts for free. In 2022, shops liked houses and shops and
  avoided industry.
- **Foundations:** fill each column from the ground up to the floor with a foundation material;
  never leave air under walls.

### 13.3 Roads

Use `plan.routeRoad` and `plan.paintRoad` (settlement helpers in `scripts/lib/kit/plan.mjs`;
see composition.md):

```js
const hm = plan.heightmapOf(b)
const road = plan.routeRoad(hm, [20, 30], [70, 60], { size: [96, 96] })
plan.paintRoad(b, road, { width: 3, paint: kit.palette({ dirt_path: 6, coarse_dirt: 2, gravel: 1 }, { scale: 2 }) })
```

| Cost term | Effect |
| --- | --- |
| Height step (×2–2.5 per block), steps over 1–3 blocked | Roads follow contours and switchback up hills |
| Water ×6–10, finite only at chosen bridge sites | Bridges where rivers are narrow, not over every puddle |
| Existing road cells cheaper (reuse ≈ 0.35, or cost / (1 + traffic)) | Later roads merge into trunks: main streets emerge |
| Turn and cross-slope penalties, slight cost noise | Gentle curves, not ruler-straight or zig-zag |
| Search limited to an ellipse around the endpoints | Fast, no wild detours |

- **Grade** the profile to ≤ 0.5 block per step (`routeRoad` defaults to 1/3). Use a bottom slab
  on x.5 heights. Cut through crests and fill dips (embankments) rather than following every bump.
- **Hierarchy:** first the backbone (gates, centre, castle, harbour), then each district to the
  nearest road, then field tracks. Widths 5 / 3 / 1–2. Materials go from stone to dirt path to
  coarse dirt.
- **Wear:** desire lines are footstep counts. Thresholds: grass → dirt (> 7), packed mud (> 17),
  gravel (> 24).

---

## 14. Wave function collapse

WFC keeps the set of possible tiles per cell, collapses the lowest-entropy cell, and propagates
adjacency constraints. On contradiction it restarts. A GDMC-graded thesis found **basic WFC
unsuitable for whole settlements**: it was slow, failed often, and had no global structure.

Use it only inside a frame that a planner has fixed:

- floor layouts of modular complexes (dungeons, libraries; Niels-NTG 2024 ran parallel restarts)
- facade tile rows inside grammar-decided bays
- roofscapes of row houses
- garden and plaza paving

Make it work:

- **Sockets on faces.** Generate rotated variants automatically.
- **Exclusion rules** for legal-but-ugly pairs.
- **Fixed border cells**: air on top, solid at the bottom, entrances pre-placed.
- **Path constraints** so no room is isolated.
- **Tiles at least as wide at the base as on top**, so nothing floats.
- Very low weights on junction tiles.
- Small regions and restarts rather than deep backtracking.

---

## 15. Lint and progressive checks

```bash
node scripts/run-build.mjs recipe.mjs --out-dir out --json          # builder.problems [] and clipped 0
node scripts/inspect.mjs out/x.nbt --checks                         # floating blocks, stair shapes, dark spots, gravity...
node scripts/inspect.mjs out/x.nbt --score                          # metrics vs human-build bands
node scripts/render.mjs --nbt out/x.nbt --views se,nw --zoom 1.3    # silhouette, roof junctions
node scripts/render.mjs --nbt out/x.nbt --views se --clip-y 6       # interiors (cutaway)
node scripts/render.mjs --nbt out/x.nbt --yaw 200 --pitch 18 --target 14,7,10 --distance 34 --view-name street
```

Procedural artifacts to look for, with the check that finds each:

| Artifact | Check |
| --- | --- |
| One-block spikes on domes, towers, arches | Render; §3 radii |
| Ridge or valley seams on multi-wing roofs | Render from two opposite corners; use `b.compoundRoof`, main wing first |
| Stair corners not updated | `--checks stair-shapes` (computed at `finish()`) |
| Floating crumbs from displaced SDFs or erosion | `--checks floating-blocks`, `detached-fragments` |
| Air under walls on slopes | `--checks support`; stepped foundations |
| Trees cut by the canvas | `clipped` > 0; inset scatter bounds |
| Dark interiors | `--checks lighting`; one light per room at minimum |
| Same building everywhere | Overview render; vary per-building parameters (§2) |
| Too many of one structure | Count placements against quotas |
| Speckled materials | Close-up render; palette `scale` ≥ 2, ramps of one family |

**Progressive validation** (2026 winner):

1. Run the generator on flat ground, where nothing hides placement mistakes.
2. Run it on gentle terrain.
3. Run it on rugged terrain with water.

At each stage, use 2–3 seeds and render overview, street-level and close-up views. A change is
done only when all of them look right.

---

## Sources

- GDMC evaluation criteria and results 2018–2026: gendesignmc.wikidot.com (wiki:evaluation, wiki:20XX-settlement-generation-competition)
- Salge et al., *The AI Settlement Generation Challenge in Minecraft: First Year Report* (arXiv 2103.14950)
- Salge et al., *Impressions of the GDMC AI Settlement Generation Challenge in Minecraft* (FDG 2022, arXiv 2108.02955)
- *Believable Minecraft Settlements by Means of Decentralised Iterative Planning* (2022 winner, arXiv 2309.10871)
- JEB_GEN_ write-up (2023 winner) and NTNU-GDMC/GDMC; Frightful Hobgoblin source (2024 winner, codeberg.org/mira-morgana/frightful_hobgoblin); Merge Conflict technical report (2026 winner, github.com/Merge-Conflict-Leiden/GDMC-2026)
- Hervé & Salge, *Comparing PCG Metrics with Human Evaluation in Minecraft Settlement Generation* (arXiv 2107.02457)
- Green, Salge & Togelius, *Organic Building Generation in Minecraft* (arXiv 1906.05094)
- Wonka, Wimmer, Sillion & Ribarsky, *Instant Architecture* (SIGGRAPH 2003); Müller et al., *Procedural Modeling of Buildings* (SIGGRAPH 2006); Esri CityEngine CGA tutorials
- Aichholzer et al., *Straight Skeletons of Simple Polygons* (1995), and the L∞-Voronoi equivalence for rectilinear input
- Parish & Müller, *Procedural Modeling of Cities* (SIGGRAPH 2001); Vanegas et al., *Procedural Generation of Parcels in Urban Modeling* (Eurographics 2012)
- Runions, Lane & Prusinkiewicz, *Modeling Trees with a Space Colonization Algorithm* (2007)
- Bridson, *Fast Poisson Disk Sampling in Arbitrary Dimensions* (SIGGRAPH 2007)
- Inigo Quilez, articles on smooth minimum, distance functions, domain warping, fBm and noise derivatives (iquilezles.org)
- Sebastian Lague, Hydraulic-Erosion (droplet model parameters)
- Gumin, WaveFunctionCollapse; marian42, infinite WFC city; Boris the Brave, WFC tips and tricks
