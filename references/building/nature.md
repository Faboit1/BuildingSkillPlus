# Nature: trees, terrain, rocks, water, paths, gardens

Landscape is half of every build. This chapter covers custom trees and forests, terrain from
heightmaps, rocks and cliffs, water, paths, ground cover, gardens and floating islands. All
snippets use the kit (`references/kit-api.md`) and were built and rendered.
Colours of every block: [block-colors.md](block-colors.md). Orientation of vines, roots, dripstone, cocoa:
[block-states.md](block-states.md) §10.

## 0. Rules

1. **Skeleton first, foliage second.** A tree is trunk + branches + one leaf cluster per branch tip.
   Never a trunk with a sphere on top (the "lollipop").
2. **Canopies are wider than tall** (≈ 1.2–1.6 : 1), flat-bottomed, lumpy-topped, with holes.
3. **Taper and flare.** Trunks get thinner upward and spread into roots at the ground. A 1×1 trunk under a
   15-block tree looks spindly; use radius 1–1.5 at the base for trees over 12 blocks.
4. **Three sizes, clumped.** Forests mix ~15% big, ~45% medium, ~40% small trees and bushes, in groups of
   3–5 of one species, never on a grid.
5. **No straight line longer than ~7 blocks in organic work** (shorelines, path edges, cliff tops, patch outlines).
6. **Terrain = heightmap → blur → materials by slope and wetness → water → rocks → plants → trees.**
7. **Rock where it is steep** (≥ 3 blocks drop between neighbours), mixed where it is 2, soil where it is ≤ 1.
8. **Gradients need a reason**: wetness (shore), wear (paths), shade (under trees), height (snow, scree).
   Clumped noise, never per-block random.
9. **Water is made of source blocks**; only waterfalls use falling water (`water[level=8]`).
10. **Ground the build**: a 1–2 block transition ring at every wall base, bushes at corners, paths that lead
    to doors, trees in three sizes nearby.
11. **Flowers come in drifts** of one or two species, not salt-and-pepper.
12. **Look at it.** Render `se` and `sw` for terrain, a lineup of 3–4 seeds for any tree recipe.

---

## 1. Trees

### 1.1 Anatomy and proportions

```
           .-^-.  .-^^-.         crown cap above the leader
       .-(     )(      )-.       lobes: one leaf cluster per branch tip (flat bottom, rounded top)
      (    ) \  |  / (    )      canopy underside HIGH and FLAT: branches visible below it
        `-.  \  | /  .-'         secondary forks ~60% along each primary
           `--\ |/--'            primaries: 3-5, staggered heights, 30-55° up, golden-angle around the trunk
               \|                first fork at 50-60% of height (broadleaf)
                |                trunk: tapers (r 1.5 -> 0.5), leans a little, never zig-zags
              _/|\_
          ___/  |  \___          root flare: 3-5 roots, 2-3 blocks out, dipping into the soil
```

| Size class | Height | Trunk radius at base | First fork | Primaries | Leaf clusters | Crown width |
| --- | --- | --- | --- | --- | --- | --- |
| Bush / sapling | 1–4 | log heart or none | – | 0 | 1 | 2–5 |
| Small | 5–8 | 0.5 (1×1) | – | 0–2 | 1–3 | 5–7 |
| Medium | 9–15 | 0.5–1.0 | 0.5–0.6 H | 3–5 (+1 fork each) | 6–10 | 0.6–0.9 H |
| Large | 16–25 | 1.0–1.6 | 0.4–0.55 H | 4–6 (+2 forks) | 12–20 | 0.7–1.0 H |
| Giant / fantasy | 25–45 | 2–4 + buttresses | 0.3–0.5 H | 6–9, 3 levels | 25–60 | 0.8–1.2 H |

- Trunk diameter ≈ H/12 … H/8 (taste: H/5 for fantasy).
- A leaf cluster is ~5–7 blocks across, 3–5 tall. Vanilla canopies are built the same way.
- Logs go along the trunk (`axis=y`); branches and roots use `*_wood` (bark on all six faces). Stepped
  branches made of logs show end-grain rings on every step.
- Leaves are made persistent by `finish()`, so leaf distance to wood does not matter for decay. It still
  matters visually: clusters more than ~5 blocks from any wood look like floating clouds.

### 1.2 What goes wrong

| Mistake | Fix |
| --- | --- |
| Lollipop: trunk + leaf sphere | Branches with clusters at the tips; carve holes |
| One big blob canopy | Several clusters; flat undersides; `holes: 0.12–0.2` in `leafBlob` |
| Branches all at one height, same length | Stagger starts by 0–3 blocks, azimuth = previous + 137.5° ± 15°, length ± 20% |
| Abrupt kink in the trunk | Bend through a curve: `b.curve([[x,y,z], mid, top], ...)` |
| Same tree copy-pasted | Different `seed` and `height` per tree, 3 size classes, 2–3 species |
| Tree "placed on" the ground | Root flare + podzol/coarse dirt/rooted dirt ring (30–40% of cells within radius 3) |
| Leaf confetti | Main leaf 70–85%, accent 10–25%; mix in clumps or zones, not per block |
| Spindly giant | Radius ≥ 1 for trees over 12 tall; buttresses over 20 |
| Vines in mid-air | Vines need a solid block beside them or a vine above (see block-states.md §10) |

### 1.3 Kit presets: `b.tree(base, species, opts)`

`base` is the first log, one above the ground: `b.tree([x, ground(x, z) + 1, z], 'oak', { seed })`.
Returns `{ top, tips }` (leaf-cluster centres) so you can hang lanterns, vines or swings from them.

| Species | Height | Footprint to reserve | Character |
| --- | --- | --- | --- |
| `oak` | 9–13 | 15×15 | rounded broadleaf, 3–5 branches |
| `big_oak` | 15–21 | 24×24 | thick trunk, wide multi-lobed crown, azalea accents |
| `birch` | 11–15 | 11×11 | white trunk, narrow crown |
| `spruce` | 14–22 | 13×13 | tiered cone to the ground |
| `pine` | 16–24 | 11×11 | bare lower half, high crown |
| `dark_oak` | 10–14 | 22×22 | thick trunk, wide flat crown, heavy roots |
| `cherry` | 9–12 | 20×20 | dark trunk, pink umbrella, petals on the ground |
| `willow` | 10–13 | 20×20 | domed crown, leaf and cave-vine curtains |
| `jungle` | 18–26 | 22×22 | tall, top-heavy, vines |
| `acacia` | 8–11 | 20×20 | leaning trunk, flat spreading pads |
| `azalea` | 6–8 | 9×9 | small, flowering |
| `mangrove` | 9–12 | 16×16 | stilt roots |
| `dead` | 8–12 | 14×14 | bare branches with fence twigs |
| `fantasy` | 24–34 | 40×40, 45 tall | huge trunk (r 3.2), mixed azalea canopy, vines |

Override any preset field through `opts`: `height`, `trunk` (base radius), `log`, `wood`, `leaves`
(list = clumped mix), `branches` [min,max], `branchCount`, `blob` [min,max] cluster radius, `squash`
(cluster height/width), `spread` (branch length / height), `rise` (branch climb), `crown` (share of the
trunk carrying branches), `lean` (× height), `roots`, `stilts`, `droop`, `vines`, `ground` (scatter block
under the crown); conifers also take `radius` and `bareFraction`.

```js
b.tree([x, y, z], 'big_oak', { seed: 2, height: 17, leaves: ['oak_leaves', 'oak_leaves', 'jungle_leaves', 'azalea_leaves'] })
b.tree([x, y, z], 'oak', { seed: 5, log: 'birch_log', wood: 'birch_wood', leaves: ['birch_leaves', 'oak_leaves'] }) // oak shape, birch look
b.tree([x, y, z], 'spruce', { seed: 1, height: 12, radius: 3.5 })                                                   // small spruce
```

Seeds matter: always render 3–4 seeds side by side before choosing; presets vary a lot per seed.

### 1.4 Leaves: colours and mixing

The renderer uses fixed foliage colours (no biomes). As rendered:

| Leaves | Reads as | Use |
| --- | --- | --- |
| `oak_leaves`, `jungle_leaves`, `acacia_leaves`, `dark_oak_leaves` | same bright green (texture differs slightly) | main foliage; mixing them only changes texture |
| `spruce_leaves` | dark blue-green | conifers; **shadow** in broadleaf canopies |
| `birch_leaves` | grey-olive | birches; add 10–20% oak leaves for a fresher green |
| `mangrove_leaves` | darker green, vertical streaks | mangroves, swamp shade |
| `azalea_leaves` | yellow-green, lighter | **sunlit highlights**, hedges |
| `flowering_azalea_leaves` | yellow-green with magenta flowers | spring, gardens (≤ 10%) |
| `cherry_leaves` | pink | cherry, fantasy |
| `moss_block` | flat yellow-olive solid | mossy hearts of bushes, never as leaves at distance |

Shade a canopy so it reads as lit from above: darker leaves on the underside, lighter on top (taste, but it
reads clearly in renders):

```js
function shadeCanopy(b, kit, min, max, { under = 'spruce_leaves', over = 'azalea_leaves', base = 'oak_leaves' } = {}) {
  b.map((x, y, z, blk) => {
    if (x < min[0] || x > max[0] || z < min[2] || z > max[2] || blk.name !== `minecraft:${base}`) return null
    if (!b.get(x, y - 1, z) && kit.hash01(x, y, z, 5) < 0.4) return under   // underside
    if (!b.get(x, y + 1, z) && kit.hash01(x, y, z, 6) < 0.25) return over   // top
    return null
  })
}
```

### 1.5 A custom broadleaf from primitives

When the presets do not fit, build the tree from `b.curve` (tapered limbs; `radius` may be a function of
`t` 0→1 along the curve) and `b.leafBlob` (noisy ellipsoid that never overwrites wood).

```js
function oakTree(b, kit, [x, y, z], { h = 15, seed = 1, wood = 'oak', leaves = ['oak_leaves', 'oak_leaves', 'azalea_leaves'] } = {}) {
  const r = kit.rng(seed)
  const lean = [r.range(-1.5, 1.5), r.range(-1.5, 1.5)]
  const fork = [x + lean[0], y + h * 0.55, z + lean[1]]
  // trunk: starts 1 below ground, bends gently, tapers 1.5 -> 0.5
  b.curve([[x, y - 1, z], [x + lean[0] * 0.3, y + h * 0.3, z + lean[1] * 0.3], fork], `${wood}_log`, { radius: t => 1.5 - 1.0 * t })
  const tips = [[fork[0], y + h * 0.8, fork[2]]]
  b.curve([fork, tips[0]], `${wood}_wood`, { radius: t => 0.9 - 0.3 * t })              // leader
  const n = r.int(3, 5), az0 = r() * Math.PI * 2
  for (let i = 0; i < n; i += 1) {
    const az = az0 + i * 2.39996 + r.range(-0.3, 0.3)                                    // golden angle
    const len = h * r.range(0.32, 0.42), el = r.range(0.5, 0.9)                          // 30-50° up
    const s = [fork[0], fork[1] - r.int(0, 3), fork[2]]                                   // staggered starts
    const e = [s[0] + Math.cos(az) * Math.cos(el) * len, s[1] + Math.sin(el) * len, s[2] + Math.sin(az) * Math.cos(el) * len]
    const m = [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2 + 0.8, (s[2] + e[2]) / 2]           // slight upward bow
    b.curve([s, m, e], `${wood}_wood`, { radius: t => 0.8 - 0.3 * t })
    tips.push(e)
  }
  for (const [i, t] of tips.entries()) b.leafBlob([t[0], t[1] + 0.8, t[2]], [3.2, 2.2, 3.2], leaves, { seed: seed * 7 + i, holes: 0.15 })
  for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]])                    // root flare
    if (r.chance(0.75)) b.curve([[x, y + 1, z], [x + dx * 1.6, y - 1, z + dz * 1.6]], `${wood}_wood`, { radius: 0.7 })
  return tips
}
```

Tuning: cluster radii `[3.2, 2.2, 3.2]` (wide, flat) for oaks; `[2.4, 3.4, 2.4]` for birch-like columns;
`[4.2, 1.8, 4.2]` with `squash`-like flatness for cherry/acacia plates.

### 1.6 Species notes

What makes each species read correctly at render scale:

- **Oak** – leaning, forked trunk; 3–5 lobes; canopy 1.3× wider than tall. Mix 10–20% azalea on top.
- **Birch** – dead-straight white trunk, short twigs, narrow tall crown (width:height ≈ 1:1.4). Groups of
  3–5, 3–5 blocks apart.
- **Spruce / fir** – dense cone from 20–25% of the height to a pointed tip; tiers by alternating ring
  radius (wide, mid, narrow); drooping ring edges; `podzol` and ferns underneath. Snow layers on each tier
  in winter scenes.
- **Pine** – bare trunk for the lower 50–60%, clumpy flat pads near the top, a few stub branches.
- **Dark oak** – 2×2-equivalent trunk (radius 1.5+), heavy root flare, wide flat crown 3–4 thick and
  11–15 across; canopies of neighbours touch.
- **Jungle** – very tall, crown only in the top 20–25%, vines on trunk faces, cocoa (`cocoa[facing=<toward
  the log>,age=2]`), understory of bushes (1 log + 2 layers of leaves) and ferns.
- **Acacia** – trunk leans then forks diagonally; 1–2 flat pads (radius 3–4, 1–2 thick); grey bark.
- **Cherry** – dark trunk, branches run out nearly horizontally then turn up; pink plates 9–11 wide,
  3–4 thick; sparse hanging leaves on the outer underside only; `pink_petals` (random `facing`,
  `flower_amount` 1–4) on 30–50% of the ground under the crown.
- **Willow** – short trunk, limbs arching out, domed crown, curtains of leaves ending in `cave_vines`
  from the outer underside (the `willow` preset does this). Put it at water.
- **Mangrove** – trunk lifted 2–4 blocks on 5–7 arching `mangrove_roots` stilts, `muddy_mangrove_roots`
  where they meet `mud`, `mangrove_propagule[hanging=true,age=4]` under ~14% of leaves, vines.
- **Palm** – curved trunk (offset grows with height²), 6–8 drooping fronds, coconuts:

```js
function palm(b, kit, [x, y, z], { h = 11, bend = 4, seed = 2 } = {}) {
  const r = kit.rng(seed), az = r() * Math.PI * 2
  const pts = [0, 0.33, 0.66, 1].map(t => [x + Math.cos(az) * bend * t * t, y + h * t, z + Math.sin(az) * bend * t * t])
  b.curve(pts, 'jungle_log', { radius: t => 0.9 - 0.4 * t })
  const T = pts[3].map(Math.round)
  b.set(T[0], T[1] + 1, T[2], 'jungle_leaves')
  for (let i = 0; i < 7; i += 1) {
    const a = i * Math.PI * 2 / 7 + r.range(-0.2, 0.2), L = r.range(4.5, 6)
    const mid = [T[0] + Math.cos(a) * L * 0.5, T[1] + 1.2, T[2] + Math.sin(a) * L * 0.5]   // frond rises...
    const end = [T[0] + Math.cos(a) * L, T[1] - 2.5, T[2] + Math.sin(a) * L]              // ...then droops
    b.curve([[T[0], T[1] + 1, T[2]], mid, end], 'jungle_leaves', { radius: t => (t > 0.2 && t < 0.8 ? 0.9 : 0.5) })
  }
  for (const [dx, dz, f] of [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'north']])        // facing = toward the trunk
    b.set(T[0] + dx, T[1] - 1, T[2] + dz, `cocoa[age=2,facing=${f}]`)
}
```

- **Dead / spooky** – crooked limbs (two segments with a kink each), last generation as `*_fence` twigs,
  no leaves; dark oak or spruce wood, stripped logs for bleached deadwood. Add `cobweb`, a hanging
  `soul_lantern`, a floor `skeleton_skull`.
- **Giant / fantasy** – `fantasy` preset or a custom tree with buttresses (5–9 `*_wood` limbs from the
  trunk at 40% height down to a ring 1–1.5 trunk-radii out), 3 levels of branching, `shroomlight`
  hidden in a few clusters (it glows), `vine`/`cave_vines` curtains, `glow_lichen` on bark.
  Reserve 40×40×45.

### 1.7 Seasons

| Season | Recipe |
| --- | --- |
| Spring | cherry and azalea trees, 5–10% `flowering_azalea_leaves`, `pink_petals`, tulips/alliums/lilacs in drifts |
| Summer | default greens; tall grass 4–6%; ferns in shade |
| Autumn | no autumn leaves exist in 1.21.1: recolour canopies with solid blocks (below), keep 10–20% green |
| Winter | `snow[layers=1..2]` on every flat top (also on leaves: they have a full top face), `grass_block[snowy=true]` under any snow layer, `snow_block` drifts against walls, spruces, `ice`/`packed_ice` on water |
| Dry / savanna | acacia, `coarse_dirt` patches 20–30%, `dead_bush`, sparse `short_grass`, `terracotta` outcrops |

Autumn: build the tree normally, then recolour its leaves with a clumped palette.

```js
const autumn = kit.palette({ nether_wart_block: 3, honeycomb_block: 3, orange_terracotta: 2, red_terracotta: 1, oak_leaves: 2 }, { scale: 2.5, seed: 8 })
b.map((x, y, z, blk) => (x >= x0 && x <= x1 && z >= z0 && z <= z1 && /_leaves$/.test(blk.name) ? autumn : null))
// fallen leaves: orange/red/brown carpets on 10-20% of the free ground under the crown
```

Rendered: `nether_wart_block` = saturated crimson with a leafy texture (best red), `honeycomb_block` =
orange-amber (best orange), `orange/red/yellow_terracotta` = muted, `*_wool` = bright and flat,
`shroomlight` = orange with white spots and **glows at night** (≤ 5%). Solid blocks look heavier than
leaves: use smaller clusters and more holes.

### 1.8 Forests as a system

| Rule | Value |
| --- | --- |
| Spacing between trunks | small 5–9, medium 8–12, large 12–20 (Poisson-disc, never a grid) |
| Size mix | 15% large, 45% medium, 40% small trees + bushes; heights ± 30% |
| Clumping | groups of 3–5 of one species; 2–3 species per forest; one dominant (60–70%) |
| Openings | glades every 30–50 blocks; never plant on paths or within 3 of water |
| Edge | feather outward: smaller trees, then bushes, then tall grass |
| Floor | podzol / coarse dirt / moss under canopies, ferns 10–20%, mushrooms, `sweet_berry_bush[age=3]` in conifer woods |
| Dead wood | 1 fallen log per ~400 m² of forest: a 1–2 block stump + a horizontal `*_log[axis=x\|z]` 3–6 long 1–2 blocks away, moss carpet or mushrooms on top |

The kit's forest module does all of this (see §1.10).

### 1.9 Bushes, hedges, topiary

```js
b.bush([x, y, z], { radius: 2 })                                                          // leaf blob around a log heart
b.bush([x, y, z], { radius: 1.4, leaves: ['azalea_leaves', 'flowering_azalea_leaves'] })
b.set(x, y, z, 'flowering_azalea')                                                        // 1-block flowering bush
// hedge: 2 wide x 2 tall with rounded ends
b.box([x0, y, z], [x1, y + 1, z + 1], kit.palette({ oak_leaves: 5, azalea_leaves: 1 }, { scale: 2 }))
for (const hx of [x0, x1]) for (const hz of [z, z + 1]) b.remove(hx, y + 1, hz)
// topiary: log stem + leaf ball
b.set(x, y, z, 'oak_log'); b.set(x, y + 1, z, 'oak_log'); b.sphere([x, y + 3, z], 1.6, 'oak_leaves')
```

Bushes go at building corners, path bends, rock bases and forest edges (0.5–2% of grass cells).

### 1.10 Forest module

`scripts/lib/kit/forest.mjs` adds three Builder methods: `b.forest`, `b.spaceColonizationTree` and
`b.foresterTree` (reference in kit-api.md):

```js
const ground = b.terrain({ height: (x, z) => 6 + 5 * (kit.noise.fbm2(x, z, { scale: 48, seed: 2 }) + 0.7) })
b.path(pathPts, { width: 3, paint: kit.palette({ dirt_path: 6, coarse_dirt: 2, gravel: 1 }, { scale: 2 }) })
b.scatter({ density: 0.28, paints: [[10, 'short_grass'], [2, 'tall_grass'], [2, 'fern'], [1, 'poppy']] })
const trees = b.forest({
  x0: 2, z0: 2, x1: W - 3, z1: D - 3, ground,
  species: [[5, 'colonized'], [3, 'birch'], [2, 'oak'], [2, 'forester_cone']],
  density: 0.7, minSpacing: 8, clearings: [[40, 80, 11]], seed: 4,
  avoid: (x, z) => nearPath(x, z, 3),          // keep trees 3 blocks off the path
})
// → [{ x, y, z, species, size: 0 large | 1 medium | 2 small, kind: 'tree' | 'bush' | 'fallen' }]
```

| Option | Default | Meaning |
| --- | --- | --- |
| `x0, z0, x1, z1` | whole canvas | area to plant |
| `ground(x, z)` | `b.topY` | surface y (use `b.terrain`'s return value) |
| `species` | oak 6, birch 3, dark oak 1 | `[[weight, name]]`; name = any `b.tree` preset, `'colonized'` / `'colonized_birch'` / `'colonized_dark_oak'`, `'forester_round'`, `'forester_cone'`, or `(b, base, { size, scale, seed, rng }) => …` |
| `density` | 0.6 | share of free slots that get a tree (modulated by clumping noise) |
| `minSpacing` | 7 | between medium trunks; large ×1.5, small ×0.65 |
| `sizes` | `[0.15, 0.45, 0.4]` | large / medium / small shares |
| `clump` | 18 | size of species and density patches (blocks) |
| `feather` | 6 | edge band where trees shrink and bushes take over |
| `bushes` | 0.45 | share of small slots that become bushes |
| `clearings` | `[]` | `[[x, z, r]]` glades: no trees, only small trees and bushes near the rim |
| `fallenLogs` | 0.6 | stump + fallen log (moss, mushrooms) per 400 cells |
| `floor` | true | podzol/coarse dirt under large and medium crowns |
| `avoid(x, z)` | none | skip spots (paths, buildings, water) |
| `tidy` | true | removes grass/flowers left on roots and unpaired tall-plant halves |

Trees only stand on soil (grass, dirt, podzol, coarse dirt, moss, rooted dirt, mycelium, snow block)
with nothing but plants above, so plant forests **after** paths, ponds and scatter. Near the canvas edge
sizes shrink (no large trees within 15 blocks, no medium within 11, bushes only within 5), so crowns do not clip.
A 112×112 woodland with `'colonized'` trees takes ~10 s.

Single trees:

```js
b.spaceColonizationTree([x, y, z], { height: 18, species: 'oak', seed: 1 })                        // natural crown
b.spaceColonizationTree(base, { height: 13, crown: [9, 3.5, 9], crownY: 10, species: 'acacia' })     // umbrella
b.spaceColonizationTree(base, { height: 15, species: 'birch', crown: [4, 6, 4], crownY: 11 })       // slender
b.foresterTree([x, y, z], { height: 18, shape: 'round' })                                           // park tree
b.foresterTree([x, y, z], { height: 20, shape: 'cone' })                                            // best spruce
```

- `spaceColonizationTree` grows branches toward 700 random points in a crown ellipsoid (attraction 8,
  kill 2.5, 1-block segments), sizes limbs with the pipe model `r = (Σ r_child^2.5)^(1/2.5)` (tip 0.4,
  capped at height/14), puts a leaf blob `[2.3, 1.7, 2.3]` on every tip and adds a root flare. Options:
  `height`, `trunkHeight`, `crown [rx, ry, rz]`, `crownY`, `attractors`, `species` or `log/wood/leaves`,
  `cluster`, `maxRadius`, `roots`, `seed`. Returns the tips. Most natural broadleaf crowns of any method tested.
- `foresterTree` ports MCEdit's Forester: clusters scattered by a shape function, branch probability
  `220·H/(ydist + dist)³`, disc-stack clusters (`[2, 3, 3, 2.5, 1.6]` round, `[3, 2.6, 2, 1]` cone) with a
  wood heart, root buttresses. Options: `height`, `shape`, `trunkThickness`, `trunkHeight` (round:
  0.3 = fan-shaped … 0.7), `branchDensity`, `foliageDensity`, `buttresses`, `light` (e.g. `'shroomlight'`
  in each cluster), `species`/`log`/`wood`/`leaves`, `seed`.

---

## 2. Terrain

### 2.1 Pipeline

```
heightmap (noise + designed features) -> blur -> b.terrain with paint functions (slope, wetness, strata)
-> fill water to level -> ponds / waterfalls -> paths -> rocks -> scatter plants -> trees / forest
```

Order matters: paths and scatter look at the top surface, so place them after terrain and water and before
trees; `b.boulder({ mossTop })` uses `b.topY`, so run it before trees overhang it.

### 2.2 Heightmap

`kit.noise.fbm2(x, z, { scale, octaves, seed })` returns about −0.7…0.7; `scale` is the feature size in blocks.

```js
const n2 = (x, z, scale, seed, octaves = 4) => kit.noise.fbm2(x, z, { scale, seed, octaves })
const raw = (x, z) => {
  const e = (n2(x, z, 40, 1) + 0.7) / 1.4                     // -> 0..1
  let h = 10 + 12 * Math.pow(Math.max(0, e), 1.8)             // redistribution: flat lowlands, steeper hills
  const m = Math.hypot(x - 64, z - 20)                         // designed feature: a mesa with cliff faces
  if (m < 17) h += 15 * Math.min(1, Math.pow((17 - m) / 6, 1.6))
  return h
}
// blur 2x (3x3 box) except where you want crisp cliffs; then round once
const hm = Array.from({ length: W }, (_, x) => Array.from({ length: D }, (_, z) => raw(x, z)))
const blur = src => src.map((col, x) => col.map((h, z) => {
  if (Math.hypot(x - 64, z - 20) < 19) return h
  let s = 0, n = 0
  for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
    const c = src[x + dx]?.[z + dz]; if (c !== undefined) { s += c; n += 1 }
  }
  return s / n
}))
const smooth = blur(blur(hm))
const height = (x, z) => Math.round(smooth[Math.max(0, Math.min(W - 1, x))][Math.max(0, Math.min(D - 1, z))])
const slope = (x, z) => Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => Math.abs(height(x + dx, z + dz) - height(x, z))))
```

| Lever | Effect | Typical values |
| --- | --- | --- |
| `scale` | feature size | 32–64 rolling hills, 16–24 rough hills, 80–120 plains |
| amplitude | relief | 6–12 for building sites, 15–30 for hills, 40+ mountains |
| `pow(e, p)` | p > 1 flattens valleys, sharpens peaks | 1.5–2.5 |
| blur passes | removes 1-block stair stripes | 1–2 (skip near cliffs) |
| `kit.noise.ridged2(x, z, { scale })` | sharp crests | mountain ridges: `h += 25 * ridged2(...) ** 2` |
| terraces | `Math.round(e * n) / n` | rice fields, mesas: n = 4–8 |
| designed features | add bumps (`pow` falloff), subtract basins, clamp plateaus | always: one hero landform per scene |

Every 1-block step shows a grass-block side (dirt with a green fringe); at 1:1 scale too many steps read as
brown stripes. Fewer, larger height changes look better than noisy relief.

Island-shaped maps: `h = lerp(h, base, d)` with `d = min(1, dist_from_centre / R)²` so the edges sink into water.

### 2.3 Surface materials by slope and wetness

`b.terrain` layers take paints, and a paint can be a function — so slope, wetness and strata are one call:

```js
const strata = (x, y, z) => {                                         // wavy 2-block bands on rock faces
  const band = Math.floor((y + 2.5 * n2(x, z, 9, 7, 2)) / 2)
  return ['stone', 'andesite', 'stone', 'tuff', 'stone', 'andesite'][((band % 6) + 6) % 6]
}
const grassMix = kit.palette({ grass_block: 30, coarse_dirt: 2, podzol: 1 }, { scale: 5, seed: 3 })
const surface = (x, y, z) => {
  const s = slope(x, z)
  if (s >= 3) return strata(x, y, z)                                  // cliff
  if (y < WATER) return kit.palette({ gravel: 3, clay: 1, mud: 1 }, { scale: 2, seed: 9 })   // river/lake bed
  if (y <= WATER) return kit.palette({ sand: 3, gravel: 1 }, { scale: 2, seed: 11 })          // wet shore line
  if (s === 2) return kit.palette({ grass_block: 3, coarse_dirt: 2, stone: 2 }, { scale: 2, seed: 13 })
  return grassMix
}
const ground = b.terrain({
  height,
  layers: [
    { depth: 1, paint: surface },
    { depth: 3, paint: (x, y, z) => (slope(x, z) >= 3 ? strata(x, y, z) : 'dirt') },
    { paint: strata },
  ],
})
for (let x = 0; x < W; x += 1) for (let z = 0; z < D; z += 1)
  for (let y = ground(x, z) + 1; y <= WATER; y += 1) b.set(x, y, z, 'water')
```

`b.terrain` returns `ground(x, z)` = surface y; use it for everything placed afterwards.

Palettes (taste; tune by eye):

| Context | Mix (clumped `kit.palette`, scale 3–5) |
| --- | --- |
| Lawn / meadow | grass 90, coarse dirt 6, podzol 3 |
| Oak/birch forest floor | grass 55, podzol 20, coarse dirt 12, rooted dirt 8, moss block 5 |
| Taiga floor | podzol 60, grass 25, coarse dirt 15; ferns 15% |
| Worn ground near buildings | coarse dirt 40, grass 30, dirt path 20, gravel 10 |
| Riverbank (outward from water) | sand/gravel 1–2 wide → coarse dirt/mud 1–2 wide → grass |
| Swamp | mud 40, grass 40, moss block 20; water pockets |
| Cool rock | stone 55, andesite 25, tuff 10, cobblestone 10 |
| Warm rock (desert, canyon) | granite, dripstone block, terracotta, packed mud |
| Mossy rock (north faces, near water) | stone 50, mossy cobblestone 30, moss block 20 — on tops and shaded sides only |
| Alpine | grass → stone + gravel → calcite + snow block → snow layers |

Stay inside one family: stone/andesite/tuff/cobblestone read as one rock; random granite or diorite reads
as noise. Dither borders over 2–4 blocks with the palette's clumps; never a hard straight edge.

### 2.4 Cliffs, strata, overhangs

- Steep faces (`slope ≥ 3`) get strata: 1–3 block bands, wobbling ±2 with noise, darker and heavier toward the
  base (tuff, deepslate), one thin accent band (calcite, dripstone block) per 8–12 blocks of height.
- Break flat cliff faces: push 1-block columns in and out with noise, add vertical cracks of gravel or
  cobblestone, ledges every 4–8 blocks capped with grass and a few flowers or ferns.
- Overhangs: undercut 1–3 blocks where cliffs meet water or paths; a 1–2 block soil lip on top;
  `hanging_roots` (under `rooted_dirt`) and `cave_vines` beneath the lip.
- Greenery on rock: `b.overgrow(min, max, { amount: 0.3–0.6, maxLength: 4 })` adds vines on exposed faces
  and moss carpet on tops; `glow_lichen[east=true]` etc. on shaded faces (face = side it is attached to).
- Scree: fans of gravel and andesite widening downhill below cliffs.

### 2.5 Rocks and formations

```js
const rock = kit.palette({ stone: 5, andesite: 3, cobblestone: 2 }, { scale: 2 })
b.boulder([x, ground(x, z), z], [3.4, 2.6, 2.6], rock, { seed: 1, mossTop: 'moss_block' })   // wider than tall, half-buried
```

- Boulders: radii ~1.3 : 1 : 1, centre at ground level so 30–50% is buried; clusters of one large
  (r 2–3) plus 2–3 small (r 1–1.5) touching; moss on top.
- Arches, spires, sea stacks: combine capsules with `smoothUnion`, roughen with `displace`, paint with strata:

```js
const g = ground(16, 80)
const arch = kit.sdf.displace(kit.sdf.smoothUnion(1.5,
  kit.sdf.capsule([9, g - 3, 80], [11, g + 9, 80], 2.0),     // left leg
  kit.sdf.capsule([23, g - 3, 80], [21, g + 9, 80], 2.0),    // right leg
  kit.sdf.capsule([10, g + 10, 80], [22, g + 10, 80], 1.8)), // lintel
  0.7, 5)                                                     // displacement amount, noise scale
b.sdf([4, g - 4, 74], [28, g + 14, 86], arch, strata)
```

Keep `displace` amount ≤ 0.5 × the thinnest radius or holes appear; `smoothUnion` k 1.5–3 for fillets.

### 2.6 Mountains

- Silhouette: ridged noise or overlapping bumps with `pow` falloff; one steep face, one long slope; summit
  1.5–3× the surrounding hills.
- By altitude: trees below a tree line (spruce density falls to 0 over the last 8–12 blocks, trees get
  smaller), mixed stone/gravel/grass above, rock bands on steep faces, snow above `Ysnow + 3 × noise`
  (`snow_block` on flat tops, `snow[layers=1..4]` on ledges, `powder_snow` pockets, `calcite` streaks),
  `packed_ice`/`blue_ice` tongues in gullies.

### 2.7 Caves (decor)

- **Lush:** `moss_block` floor with `moss_carpet` (25%), `azalea`, clay pools with `big_dripleaf`
  (+ `big_dripleaf_stem` below), ceiling `cave_vines` strands 2–6 long with berries (glow 14 in game),
  `spore_blossom`, `hanging_roots` under `rooted_dirt`, `glow_lichen` on walls.
- **Dripstone:** `dripstone_block` layers 2–4 thick; `pointed_dripstone` stalactites/stalagmites 1–6 long
  (thickness from the attachment: base, middle…, frustum, tip — §7 has a helper); columns where they meet.
- Mouths: overhang with hanging roots and vines; fewer plants deeper in.

---

## 3. Water

### 3.1 Facts

| State | Meaning | Renders as |
| --- | --- | --- |
| `water` / `water[level=0]` | source | surface at 14/16 height, full if water above |
| `water[level=1..7]` | flowing, lower each step | sloped surface (thin edges) |
| `water[level=8]` | falling | full column |

Water flows 7 blocks on flat ground in game; build lakes and rivers entirely from sources. Plants that
live in water (`seagrass`, `tall_seagrass`, `kelp`/`kelp_plant`, `sea_pickle[waterlogged=true]`) and any
`waterlogged=true` block draw water around themselves.

### 3.2 Ponds

```js
const level = ground(px, pz)
b.pond([px, level, pz], 5, { depth: 3, rim: kit.palette({ sand: 2, gravel: 1 }), bed: kit.palette({ clay: 1, gravel: 1 }) })
```

- Irregular outline (the kit wobbles it), depth 1 at the edge → 2–4 in the middle.
- Dress: `lily_pad` on 5–8% of surface cells (more in sheltered corners), `seagrass` on 20–30% of the bed
  where ≥ 2 deep, `sugar_cane` 1–3 tall on 20–30% of shore cells touching water, `big_dripleaf` in
  shallows, a ring of coarse dirt/mud/grass outside the rim.
- Underwater glow: `sea_pickle[pickles=3,waterlogged=true]` clusters, or a lantern on the bed.

### 3.3 Rivers

Carve the channel into the heightmap with a distance-to-polyline, then fill to the water level:

```js
const river = [[-4, 70], [20, 62], [40, 66], [58, 54], [74, 58], [92, 50]]   // (x, z) points
const distTo = (x, z, pts) => {
  let best = Infinity
  for (let i = 1; i < pts.length; i += 1) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
  }
  return best
}
// inside raw(x, z): wobble the edge with noise, deepen the middle, soften the banks
const rd = distTo(x, z + 2 * n2(x, z, 9, 4, 2), river)
if (rd < 5) h = Math.min(h, WATER - 2.5 + rd * 0.9)      // channel: 2-3 deep in the middle
else if (rd < 9) h = Math.min(h, WATER + (rd - 5) * 0.9) // banks
```

- Width 5–12, meanders with 2 sine terms (amplitude 5–10, wavelength 30–80), deeper on the outside of bends,
  gravel/sand bars on the inside.
- Banks: sand/gravel line, then coarse dirt and paths "to look realistic", then foliage (Minecraft.net
  landscaping tutorial); reeds, ferns, willows, boulders, an exposed root on cut banks.
- Bridges ≥ 2 blocks above the water. `b.path` only repaints terrain blocks (grass, dirt, sand, gravel,
  stone…), so a path stops at the water line: end it at the bank or span the river with `b.bridge(a, c, { arch, railing, lanterns })`.

### 3.4 Waterfalls

```js
// find the lip: walk from the mesa centre toward the pool until the ground drops
let lip
for (let t = 0; t <= 1; t += 0.02) {
  const x = Math.round(64 + (px - 64) * t), z = Math.round(20 + (pz - 20) * t)
  if (ground(x, z) < ground(64, 20) - 3) break
  lip = [x, z]
}
const [fx, fz] = lip, lipY = ground(fx, fz)
b.set(fx, lipY, fz, 'water')                                    // source in a notch on the lip
for (let t = 0; t <= 1; t += 0.05) {                              // falling column + run-out to the pool
  const x = Math.round(fx + (px - fx) * t), z = Math.round(fz + (pz - fz) * t)
  const yMax = Math.min(lipY, ground(x, z) + 1 + Math.round((lipY - level) * (1 - t * 2)))
  for (let y = ground(x, z) + 1; y <= yMax; y += 1) if (!b.get(x, y, z)) b.set(x, y, z, 'water[level=8]')
}
b.overgrow([fx - 4, level, fz - 4], [fx + 4, lipY, fz + 4], { amount: 0.6, maxLength: 4 })   // wet, green face
```

- Plunge pool 2–4 deep and 2+ blocks wider than the fall on each side; mossy stone and vines around;
  multi-tier falls: drops of 3–8 with pools between.
- In game, the source at the lip regenerates the fall by itself; the explicit `level=8` column is what the
  preview shows.

### 3.5 Shorelines and beaches

| Coast | Profile from land to sea |
| --- | --- |
| Sand beach | grass → coarse dirt → sand + sparse short grass/dead bush (dune 4–8 wide) → sand → sandstone/gravel under water; slope 1 block per 3–5 |
| Shingle | grass → gravel 70 / andesite 20 / cobblestone 10 → stone in the surf |
| Rocky | cliff with strata → boulders in the water → kelp from 4 deep |
| Swamp | grass → mud → muddy mangrove roots → water with lily pads |
| Lake | grass → 1 ring sand/gravel at water level → clay/gravel bed |

Driftwood: `stripped_oak_log[axis=x]` 2–4 long half in the sand. Wobble the coastline (no straight run
over 7 blocks).

---

## 4. Paths

```js
b.path([[4, 20], [18, 28], [30, 40], [38, 52], [44, 68], [52, 84]], {
  width: 3, paint: kit.palette({ dirt_path: 6, coarse_dirt: 2, gravel: 1 }, { scale: 2 }),
})
```

- Width: 2–3 footpath, 3–5 village lane, 5–7 road. The kit wobbles the edge (`jitter`, default 0.6).
- Composition: most-worn in the middle. Lanes: `dirt_path` 6, `coarse_dirt` 2, `gravel` 1. Roads:
  `cobblestone` 5, `andesite` 2, `gravel` 2, `stone` 1, `mossy_cobblestone` 1. Desert: `packed_mud`,
  `mud_bricks`, `smooth_sandstone`. Gardens: stepping stones every 2 blocks (`stone_bricks`, `smooth_stone_slab`).
- `dirt_path` is 15/16 tall: it sits a pixel below grass, which reads as worn.
- Follow the terrain; on slopes use stairs/slabs of the path material or switchbacks; never straight up a hill.
- Never mix by coordinate formulas like `(x + z) % 3` — they produce diagonals and checkerboards.
- Edges: tall grass and flowers on the shoulders; lamps every 8–12 blocks, alternating sides.

---

## 5. Ground cover and flowers

```js
b.scatter({ density: 0.32, clump: 7, paints: [[10, 'short_grass'], [2, 'tall_grass'], [1, 'fern'], [1, 'poppy'], [1, 'dandelion'], [1, 'oxeye_daisy'], [1, 'cornflower']] })
```

`density` is the share of eligible cells (`on`, default grass and moss), modulated by clumping noise of
size `clump`; tall plants get both halves.

| Layer | Coverage of grass cells | Notes |
| --- | --- | --- |
| `short_grass` | 15–30% | everywhere |
| `tall_grass` | 2–5% | more along walls, paths, tree edges |
| `fern` / `large_fern` | 1–3% open, 10–20% shade | |
| Flowers | 2–6% overall, in drifts | one call per drift, 1–2 species, `clump` 4–6 |
| Bushes | 0.5–2% | corners, rocks, edges |
| `sweet_berry_bush[age=3]` | clumps of 3–8 | taiga |
| `dead_bush` | 1–3% | sand, terracotta |
| `pink_petals` | 30–50% under cherries | random facing and amount |

Flowers (1 tall): `dandelion`, `poppy`, `blue_orchid`, `allium`, `azure_bluet`, `red_tulip`, `orange_tulip`,
`white_tulip`, `pink_tulip`, `oxeye_daisy`, `cornflower`, `lily_of_the_valley`, `torchflower`. Tall (2 halves):
`sunflower`, `lilac`, `rose_bush`, `peony`, `pitcher_plant`. Vanilla generates flowers in noise-selected
single-species patches and grass as sparse tufts; copy that.

Drifts: run `b.scatter` several times over small boxes with one or two flowers each, different seeds.

---

## 6. Gardens and landscaping around buildings

- **Transition ring** (every wall base): 1–2 blocks of `coarse_dirt`/`podzol`/`rooted_dirt`/gravel or a flower
  bed; never let grass meet a wall in a straight line.
- **Foundation planting**: a bush (1–2 leaf blocks, oak + azalea) every 3–5 blocks, tall grass and ferns
  behind flowers, moss carpet at corners.
- **Hedges** along property lines (§1.9), broken by gates; fences with leaves draped on top.
- **Beds and plots**: `farmland[moisture=7]` with `wheat[age=7]`, `carrots[age=7]`, `potatoes[age=7]`,
  `beetroots[age=3]`, edged with `*_log[axis=x|z]` or open trapdoors; water channel every 9 blocks; composter,
  scarecrow (fence + `hay_block` + `carved_pumpkin[facing=south]`).
- **Flower boxes** under windows (`b.window(..., { flowerBox: true })`).
- **Yard props**: wood piles (stacked `*_log[axis=x]`), barrels, hay bales, a well, benches (stairs with
  trapdoor arms), lamp posts (`b.lampPost`), stepping stones.
- **Trees**: 4–8 blocks from walls so the crown overlaps the eaves a little; frame entrances with a pair.
- **Paths** widen toward doors; the door gets a slab or stair stoop.

---

## 7. Floating islands

```js
const C = [32, 40, 32], R = 14
b.island(C, R, { depth: 18, rock: kit.gradient(['stone', 'andesite', 'tuff', 'dripstone_block'], { axis: 'y', from: C[1] - 4, to: C[1] - 18 }) })

// pointed dripstone hanging from (x, y, z): base -> middle... -> frustum -> tip
function stalactite(b, x, y, z, n) {
  const order = n === 1 ? ['tip'] : n === 2 ? ['frustum', 'tip'] : ['base', ...Array(n - 3).fill('middle'), 'frustum', 'tip']
  order.forEach((t, i) => b.set(x, y - i, z, `pointed_dripstone[vertical_direction=down,thickness=${t}]`))
}
// dress the underside: every block with air below gets roots, dripstone or glow berries
for (const [x, y, z, blk] of b.entries()) {
  if (b.get(x, y - 1, z) || y > C[1]) continue
  const u = kit.hash01(x, y, z, 3)
  if (blk.name === 'minecraft:dirt' && u < 0.5) b.set(x, y - 1, z, 'hanging_roots')
  else if (/dripstone_block|tuff/.test(blk.name) && u < 0.25) stalactite(b, x, y - 1, z, 1 + Math.floor(kit.hash01(x, 0, z, 4) * 4))
  else if (u < 0.08) b.set(x, y - 1, z, 'cave_vines[age=25,berries=true]')
}
```

- The underside is half the island: tapered (`depth` ≈ 1–1.3 × radius), split into lobes, dressed.
- Top: terrain, a pond, one hero tree, scatter; an edge waterfall (sources to the rim, then a `level=8`
  column falling off the edge).
- Satellites: 2–3 small islands (r 3–5) at different heights, with a bush or a single tree, for depth.
- Proportion (taste): outline irregular, 1.5–2× wider than deep at the top.

---

## 8. What the preview shows

- Foliage, grass and water colours are fixed (§1.4): biome tints do not exist, so "swamp green" or
  "badlands brown" leaves cannot be had by biome — choose leaf types instead.
- Leaves render with transparency; holes in canopies read clearly from above, less from the side.
- Water: sources slightly below the block top, flowing levels progressively lower, falling full.
- `shroomlight`, `glow_lichen`, froglights, lanterns glow at night; `cave_vines` berries and sea pickles
  do not glow in the preview although they emit light in game.
- Overview renders put ~10 px on a block for a 64-wide scene: judge silhouettes and colour zones there;
  check flowers, petals and roots in close-ups (`--yaw/--pitch/--clip`).

## Sources

- Minecraft.net, *Tutorial: tips for landscaping and terraforming* (BlueNerd): "never more than seven blocks in a
  straight line", riverbeds, banks, two-layer terrain.
- minecraft.wiki: *Tree*, *Leaves*, *Water*, *Snow*, *Vines*, *Pointed Dripstone*, *Glow Lichen*, *Hanging Roots*.
- Vanilla 1.21.1 worldgen data (misode/mcmeta `1.21.1-data`, `worldgen/configured_feature`): tree, flower,
  grass, moss and disk parameters.
- MCEdit `Forester.py` (procedural round/cone/rainforest/mangrove trees).
- Runions et al. 2007, *Modeling Trees with a Space Colonization Algorithm*; ciphrd and Procworld write-ups.
- Red Blob Games, *Making maps with noise functions* (fBm, redistribution, terraces, ridged noise, islands).
- Astroworld custom tree guide and WorldEdit brush reference; Diamond Lobby custom tree guide;
  Planet Minecraft WorldPainter hills tutorial (stone above 45°); minecraft.how floating-island guide.
