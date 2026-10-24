# Sculpting: statues, creatures, ships and organic landmarks

Statues, busts, dragons, whales, giant animals, galleons, longships, airships, giant mushrooms, crystals,
coral, rock arches and spires, clouds, floating islands, waterfalls and lava falls, landmark trees and
fantasy props. Everything that is curved, posed or alive.

Kit methods used here (`scripts/lib/kit/sculpt.mjs`, installed on the builder):

| Method | Use |
| --- | --- |
| `b.figure(base, { height, heads, facing, pose, build })` | humanoid statue on an armature (smooth-unioned SDF) |
| `b.tubeAlong(points, s => r, paint, { rMin })` | watertight tapered tube on a centripetal Catmull-Rom spline: spines, tails, necks, limbs, trunks, roots, tentacles |
| `b.shadeSurface(min, max, rampDarkToLight, { light, only, ambient, bands, base })` | paint a sculpted surface from its normals + occlusion, rank-normalized so every ramp step is used |
| `b.erode(min, max, { preset, iterations, only, protect })` | VoxelSniper-style smoothing (`smooth`, `melt`, `fill`, `lift`, `floatclean`) |
| `b.hull({ bow, heading, length, ... })` | lofted ship hull with keel, decks, bulwark, rail, gunports; returns `at()`, `deckY()`, `mast()` |
| `b.crystalCluster(base, { count, length, apothem, spread, shell })` | hexagonal crystals with pyramid tips on a geode bed |
| `b.hugeMushroom(base, { type: 'red' \| 'brown', height })` | stem + cap with correct mushroom-block faces (pores underneath) |
| `b.cloud(center, { length, tiers })` | flat-based cumulus, shaded top-light |
| `b.rockArch(footA, footB, { height, thickness, ramp })` | eroded natural arch with strata |

Plus the general kit: `b.sdf` + `kit.sdf.*`, `b.fillWhere(..., { hollow: true })`, `b.ellipsoid`, `b.curve`,
`b.lathe`, `b.line(..., { connect: 6 })`, `b.texture`, `kit.gradient`, `kit.noise`. Trees, terrain, water and
floating-island tops are in [nature.md](nature.md); colour data in [block-colors.md](block-colors.md);
stair/slab/wall availability in [materials.md](materials.md).

---

## 0. Rules

1. **Skeleton → volumes → smooth → canvas render → shade → partial blocks → review.** Build the form in one
   placeholder block (`white_wool`), render it, fix the silhouette, and only then paint.
2. **Silhouette first.** From the main camera, head, every limb, wing, tail and neck must be separable in a
   one-colour render. Keep negative space between limbs and body. No symmetric T-poses unless the statue is
   meant to look like a Minecraft player.
3. **Round shapes use .5 radii.** Diameter D: centre on an integer for odd D, on .5 for even D, radius D/2.
   An integer radius on an integer centre always leaves 1-block pips at the six poles.
4. **Nothing thinner than radius 0.87.** Thinner tubes break into diagonal-only contacts that read as dotted
   lines. `b.tubeAlong` and `b.curve` clamp to 0.87; for 1-wide parts use `b.line(a, c, paint, { connect: 6 })`
   or a sub-block part (wall, fence, chain, end rod).
5. **Hollow with `{ hollow: true }`,** never with `kit.sdf.shell` on displaced or noisy shapes (holes).
6. **Organic lines: no straight run over ~7 blocks;** run lengths along a curve change gradually
   (6-5-3-3-2), never jitter (3-1-3).
7. **Shade by value with a ramp of 4–7 steps ΔL\* 6–12 apart;** neighbours differ by ≤ 1 step; clusters,
   never salt-and-pepper. Small sculpture: flat blocks (concrete, terracotta). Large rock: textured blocks.
8. **Scale decides partial blocks:** < 20 blocks tall they are essential, 20–60 only on top faces and
   silhouette edges, > 60–100 full blocks only.
9. **Pick the canon before the first block:** realistic 7.5 heads, heroic 8–8.5, Minecraft-skin 4,
   chibi 2–3.
10. **Ships: mast ≈ hull length, sail area huge, sails shrink upward, decks 1 floor + 2 air.**
11. **Placed structures do not flow.** Every water/lava block of a fall is placed explicitly.
12. **Review at the real camera distance.** A feature smaller than ~4 px in the render does not exist;
    make it bigger or express it as value contrast.

---

## 1. Workflow

```js
const b = api.builder([48, 56, 48], { seed: 4 })
b.box([12, 0, 12], [36, 2, 36], 'polished_andesite')           // plinth: 1.2–1.5 × footprint
b.box([14, 3, 14], [34, 3, 34], 'smooth_stone')
// 1. skeleton + volumes in a canvas block
b.figure([24, 4, 24], {
  height: 40, heads: 7.5, facing: 'south', paint: 'white_wool',
  pose: { armR: { raise: 20, swing: 50, elbow: 70 }, armL: { raise: 10, elbow: 15 }, contrapposto: 0.8, legL: { swing: 8 } },
})
// 2. render now (silhouette check), then 3. shade the canvas: ramp dark → light
b.shadeSurface([0, 4, 0], [47, 55, 47],
  ['cobbled_deepslate', 'tuff', 'stone', 'andesite', 'polished_diorite', 'quartz_block'],
  { only: 'white_wool', light: [0.35, 0.85, 0.4] })
```

Stages and what to check in the render:

| Stage | Tool | Check |
| --- | --- | --- |
| Skeleton | joint list, spline control points | pose reads; proportions in heads; weight over the feet |
| Volumes | `b.figure`, `b.tubeAlong`, `b.sdf` + `kit.sdf.smoothUnion`, `b.ellipsoid` | one-colour silhouette from the main and the side camera |
| Smooth | `kit.sdf.smoothUnion(k, ...)`, `b.erode(..., { preset: 'smooth' })` | no stair-step pimples, no seams at joins |
| Shade | `b.shadeSurface` (forms) or `b.texture` (architecture-like surfaces) | every ramp step used, creases darkest, tops lightest, no single-block speckle |
| Partial blocks | slabs/stairs pass (§3.3), trapdoors, walls, buttons | only where a full block leaves a 1-block notch on a top/silhouette edge |
| Review | `node scripts/render.mjs --views se,south,low` | §10 checklist |

---

## 2. Voxel geometry that does not break

Measured on this voxel grid (integer coordinates are block centres).

| Problem | Rule | Measurement |
| --- | --- | --- |
| Pole pips on spheres | radius = D/2; odd D → integer centre, even D → .5 centre | `d² ≤ r²` with integer r gives a 1-block top for r = 2…12; D/2 gives 9–21-block caps (D = 5…15) and exact width D |
| Broken tubes | radius ≥ √3/2 ≈ 0.87 | random 20-block segments face-connected: r 0.5 → 1%, 0.7 → 29%, 0.8 → 93%, 0.87 → 100% |
| Dotted thin lines | `b.line(a, c, p, { connect: 6 })` | default 26-connected lerp lines were face-connected in 1 of 200 random cases; fences only connect face-to-face |
| Holes in hollow shells | `{ hollow: true }` (inside + has an empty face neighbour) | 0 leaks in every test; `abs(f) ≤ 0.5` bands leaked in every test with ≥ 1 block of noise displacement |
| See-through thin sheets | sheet thickness ≥ 1 measured along the normal | 0 see-through rays at thickness 1; thinner bands let 26–32% of rays through for normals like (2,1,0) |
| Floating debris after noise | noise amplitude ÷ scale ≤ ~0.25; then `b.erode(..., { preset: 'floatclean' })` | taste |

```js
b.sphere([10, 10, 10], 4.5, 'stone')          // 9 wide, round caps
b.sphere([30.5, 10.5, 10.5], 5, 'stone')      // 10 wide: even diameter on a .5 centre
b.line([2, 20, 2], [14, 27, 7], 'spruce_fence', { connect: 6 })   // rigging/antenna that connects
```

Smooth-union fillet `k` (blocks), starting values:

| Join | k |
| --- | --- |
| fingers, ears, horns to head | 0.5–1 |
| limb to torso | 1–2.5 (≈ 0.25 × the smaller radius) |
| head to neck | 1.5–3 |
| creature torso masses | 3–6 |
| roots into a trunk, cloud puffs | 1.5–3 |
| rock and terrain masses | 4–10 |

Too large inflates joints into balloons; too small leaves seams.

```js
const { sdf } = kit
const torso = sdf.smoothUnion(2.5,
  sdf.ellipsoid([24, 30, 24], [6, 7, 4]),
  sdf.ellipsoid([24, 21, 24], [5, 5, 3.5]),
  sdf.capsule([24, 36, 24], [24, 40, 24], 2.2))
b.sdf([10, 10, 10], [38, 45, 38], torso, 'white_wool', { hollow: true })
```

Noise for organic surfaces (`kit.noise.fbm3`, then 1 × `b.erode` smooth):

| Surface | fbm scale | amplitude |
| --- | --- | --- |
| boulder r 3–8 | 4–6 | 0.15–0.3 × r |
| cliff face | 12–24 | 2–4 |
| spire, hoodoo, arch | 6–10 | 0.5–1.6 |
| island underside | 6–12 | 0.1–0.2 × R |
| cloud puffs | 6–10 | 1–2 |
| bark ridges | 2–3 | 0.3–0.6 |

**Curves by run length.** A good voxel curve has monotonic run lengths: a 31-wide circle's edge is
4-3-2-1-1-1…; a slope 6-5-3-3-2. A 3-1-3 pattern reads as a bump. Organic silhouettes never keep a
straight run longer than ~7 blocks (convention).

**Erosion presets** (`b.erode`), from VoxelSniper's erode brush: a solid with ≥ e empty faces is removed;
an empty cell with ≥ f solid faces is filled with its most common neighbour.

| Preset | e / f | Effect |
| --- | --- | --- |
| `smooth` | 3 / 3 | knocks off corners, fills notches: the everyday pass |
| `melt` | 2 / 5 | wears edges away (ruins, weathered statues); deletes 1-thick parts → `protect` sails, fins |
| `fill` | 5 / 2 | rounds concavities, grows the form |
| `lift` | 6 / 1 (no erosion) | adds one layer on everything |
| `floatclean` | 6 / 6 | deletes isolated blocks, fills enclosed holes |

---

## 3. Scale and partial blocks

### 3.1 Scale bands for figures

| Figure height | Head (blocks) | Canon | Limbs | Build it as |
| --- | --- | --- | --- | --- |
| ≤ 8 (icon) | 2–3 | chibi 2.5–3 heads | walls, fences, 1-block columns | single blocks + partial blocks; `player_head` or a coloured block is the head |
| 9–24 | 4–8 | 4 heads (skin) or 5 | 2×2 to 4×4 boxes | box model (§4.4); stairs for shoulders/feet/brow, slabs for chin/hands; painted faces |
| 25–60 | 4–9 | 6–7.5 heads | tapered tubes r 1.5–4 | `b.figure`; nose out 1–2, eye sockets in 1; partial blocks on silhouettes only |
| 60–150 | 8–19 | 7.5–8 heads | r 3–10 | `b.figure`, full blocks; detail = value; thicken wrists, ankles, neck slightly |
| > 150 | > 19 | 8–8.5 heroic | r ≥ 8 | exaggerate brow, nose, hair masses; minimum feature ≈ 3 blocks |

Minimum readable feature in a render: `minFeature ≈ 4 × buildExtent / imageWidthPx` blocks. A 200-block
statue in a 960-px view gets ~5 px per block: a 1-block eye is noise, a 3-block socket reads.

### 3.2 Which partial blocks, where

| Block | Geometry | Sculpting use |
| --- | --- | --- |
| `*_slab` (`type=top` = upside-down) | half block | brows, chins, hull curves, sail feet, top-surface smoothing |
| `*_stairs` | ¾ L-shape | shoulders, noses, feet, hull shoulders; `facing` = side of the tall back |
| `*_wall` | 8/16-wide post | thin limbs, horns, tusks, small masts, roots |
| `*_fence` | thin post + rails | rigging, railings, oars, antennae, whiskers |
| `*_trapdoor` | 3/16 plate | ears, fins, shields, gunport lids, wing edges, eyelids |
| `*_carpet`, `snow[layers=1..8]` | 1/16 and n/8 | top smoothing; snow layers give 8 sub-steps for snow caps and clouds |
| `pointed_dripstone` | spike (`thickness`, `vertical_direction`) | horns, dorsal spines, claws, stalactites under islands |
| `end_rod`, `lightning_rod`, `chain` | rods | antennae, spars, whiskers, tethers |
| `amethyst_cluster`, `large_amethyst_bud` | crystal sprite (`facing`) | crystal tips, druse |
| buttons, `player_head`, `skeleton_skull`, `dragon_head` | small cubes | eyes, rivets, shield bosses, tiny heads |

Stairs and slabs exist for stone, cobblestone, stone/mossy bricks, andesite/diorite/granite (+polished),
sandstones, quartz, prismarine, purpur, cobbled/polished deepslate and deepslate bricks/tiles, tuff family,
blackstone, bricks, mud bricks, nether bricks, end-stone bricks, cut copper and all planks. **None** for wool,
concrete, concrete powder, terracotta, calcite, dripstone block, basalt, amethyst or plain deepslate.
A small sculpture that needs stair smoothing must use a stone, sandstone, quartz or wood palette
([materials.md](materials.md)). A stair or slab must be the same material as the ramp step under it.

When:

- **< 20 blocks:** partial blocks are the only way to get curvature (fingers, faces, feet, ears).
- **20–60:** place one only where a full block leaves a 1-block notch on a **top-facing or silhouette**
  edge. On vertical curved faces they read as holes (the recessed half is shaded darker).
- **> 60–100:** full blocks. At screenshot distance stairs vanish or look like dirt specks.

### 3.3 Slab/stair pass on top surfaces

The SDF knows where the surface really is between block centres; use it.

```js
// Small/medium sculpture only. f = the shape's SDF, mat = a material with stairs + slabs.
function topPartials(b, a, c, f, mat) {
  for (let x = a[0]; x <= c[0]; x++) for (let z = a[2]; z <= c[2]; z++) {
    let y = c[1]
    while (y >= a[1] && f(x, y, z) > 0) y--
    if (y < a[1] || b.has(x, y + 1, z)) continue
    let lo = y, hi = y + 1
    for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (f(x, m, z) <= 0) lo = m; else hi = m }
    if (lo - (y + 0.5) < 0.2) continue                     // surface sits at the block top
    const gx = f(x - 1, y + 0.5, z) - f(x + 1, y + 0.5, z) // > 0: surface rises toward +x
    const gz = f(x, y + 0.5, z - 1) - f(x, y + 0.5, z + 1)
    const facing = Math.abs(gx) > Math.abs(gz) ? (gx > 0 ? 'east' : 'west') : (gz > 0 ? 'south' : 'north')
    b.set(x, y + 1, z, Math.hypot(gx, gz) > 0.5 ? kit.stairs(mat, facing) : kit.slab(mat))
  }
}
const dome = kit.sdf.ellipsoid([20, 2, 20], [9, 6, 9])
b.sdf([10, 2, 10], [30, 9, 30], dome, 'smooth_sandstone')
topPartials(b, [10, 2, 10], [30, 10, 30], dome, 'smooth_sandstone')
```

`finish()` computes stair corner shapes.

---

## 4. Shading sculpture

### 4.1 Doctrine

- **Value > hue > texture** when choosing ramp members. Hue-shift: highlights warmer/yellower, shadows
  cooler/bluer or purpler.
- **4–7 steps, ΔL\* 6–12 apart, never skip a step,** light and dark never touch.
- **Clusters, not splatter.** Blobs 3–8 blocks across; dither only between adjacent steps.
- **The renderer already lights faces and casts shadows.** Paint what lighting cannot: occlusion (creases,
  armpits, under the jaw, under cap rims and overhangs), material and age (darker near the ground, moss,
  wet rock), and a gentle top-light bias. Do not bake a hard side light that fights the sun.
- **Avoid pillow shading** (concentric rings ignoring form) and **banding** (parallel stripes).
- **Creases darkest, ridges +1 step:** eye sockets, mouth line, between fingers, under scale rows → bottom
  of the ramp; brow, cheekbones, spine ridge, knuckles → one step up. This is the 3D version of an outline.
  Do not outline a silhouette with black blocks.
- **Separate parts by material:** skin vs cloth vs armour vs hair at ΔL\* ≥ 15.
- **Small sculpture: flat blocks** (concrete noise ≈ 0.003, terracotta ≤ 0.01 in
  [block-colors.md](block-colors.md) units) so form shading reads. **Large rock: textured blocks** (andesite
  0.06, tuff 0.08, cobblestone 0.12, diorite 0.13) add free detail; keep busy blocks (≥ 0.08) off small faces.

### 4.2 `b.shadeSurface` vs `b.texture`

| | `b.shadeSurface(min, max, ramp, opts)` | `b.texture(min, max, ramp, opts)` |
| --- | --- | --- |
| Ramp order | **dark → light** (auto-detected from measured L\* if reversed) | light → dark |
| Driver | surface normal · light (wrapped lambert) + ambient occlusion, rank-normalized | height, edges, drips, focal points, noise |
| Use for | statues, creatures, rocks, arches, clouds, mushrooms, hulls of creatures | walls, towers, architecture-like masses |

Options: `light` (default `[0.35, 0.85, 0.4]`: from above, east, south), `ambient` 0.35 (occlusion weight),
`only` (repaint only the canvas block), `bands: { height, amount }` (strata), `base` (darken toward the
bottom of the box), `noise`, `blur` (2 passes; raise for large smooth forms), `maxStep` 1, `interior:
'darkest'`. Stairs, slabs and walls keep their shape when the ramp material has them.

### 4.3 Ramps (dark → light)

Measured L\* in brackets ([block-colors.md](block-colors.md) has every block). Members marked `*` have
stairs and slabs.

| Use | Ramp |
| --- | --- |
| White marble, flat | `gray_concrete` (24) → `gray_concrete_powder` (34) → `light_gray_concrete` (52) → `light_gray_concrete_powder` (64) → `white_concrete` (85) → `quartz_block`\* (92) → `snow_block` (99) |
| Marble with partials | `polished_deepslate`\* (32) → `cobbled_deepslate`\* (34) → `polished_tuff`\* (44) → `stone`\* (53) → `polished_andesite`\* (57) → `polished_diorite`\* (79) → `smooth_quartz`\* (92) |
| Grey stone statue | `deepslate_tiles`\* (24) → `cobbled_deepslate`\* (34) → `tuff`\* (47) → `stone`\* (53) → `andesite`\* (57) → `smooth_stone` (66) → `polished_diorite`\* (79) |
| Sandstone idol | `brown_terracotta` (24) → `terracotta` (46) → `yellow_terracotta` (59) → `white_terracotta` (75) → `sandstone`\* (82) → `smooth_sandstone`\* (86) |
| Gold | `brown_terracotta` (24) → `orange_terracotta` (44) → `yellow_terracotta` (59) → `honeycomb_block` (70) → `yellow_concrete` (76) → `gold_block` (85) |
| Verdigris bronze | `dark_prismarine`\* (37) → `cyan_terracotta` (38) → `warped_wart_block` (46) → `weathered_copper` (60) → `oxidized_cut_copper`\* (62) → `prismarine`\* (63) |
| Fresh bronze | `brown_terracotta` (24) → `brown_concrete` (29) → `terracotta` (46) → `cut_copper`\* (55) → `exposed_copper` (56) |
| Light skin | `brown_terracotta` (24) → `terracotta` (46) → `polished_granite`\* (51) → `exposed_copper` (56) → `white_terracotta` (75) → `smooth_sandstone`\* (86) |
| Dark skin | `black_terracotta` (9) → `gray_terracotta` (19) → `brown_terracotta` (24) → `brown_concrete` (29) → `brown_concrete_powder` (40) → `packed_mud` (48) |
| Green scales | `dried_kelp_block` (22) → `green_terracotta` (34) → `green_concrete` (36) → `moss_block` (44) → `lime_terracotta` (47) → `lime_concrete_powder` (70) |
| Red scales | `red_nether_bricks`\* (13) → `nether_wart_block` (23) → `crimson_planks`\* (29) → `red_concrete` (32) → `red_terracotta` (37) → `orange_terracotta` (44) |
| Whale grey-blue | `black_concrete` (3) → `gray_concrete` (24) → `cyan_terracotta` (38) → `light_gray_concrete` (52) → `clay` (68) → `white_concrete` (85) (`light_blue_terracotta`/`blue_terracotta` render purple: avoid) |
| Purple crystal | `obsidian` (5) → `crying_obsidian` (14) → `purple_concrete` (30) → `purple_concrete_powder` (40) → `amethyst_block` (51) → `purpur_block`\* (59) |
| Ice crystal | `blue_concrete` (25) → `cyan_concrete` (46) → `light_blue_concrete` (54) → `blue_ice` (69) → `packed_ice` (73) → `snow_block` (99) |
| Cloud | `light_gray_wool` (59) → `light_gray_concrete_powder` (64) → `white_concrete` (85) → `white_concrete_powder` (90) → `white_wool` (94) → `snow_block` (99) |
| Ship wood | `dark_oak_planks`\* (21) → `mangrove_planks`\* (32) → `spruce_planks`\* (39) → `jungle_planks`\* (53) → `oak_planks`\* (58) → `birch_planks`\* (72) |
| Canyon strata | `brown_terracotta` (24) → `red_terracotta` (37) → `orange_terracotta` (44) → `terracotta` (46) → `white_terracotta` (75) → `smooth_sandstone`\* (86) |

Surprises in the data: `andesite` (57) is lighter than `stone` (53) and `cobblestone` (55);
`white_concrete` (85) is darker than `white_wool` (94), `quartz_block` (92) and `snow_block` (99); each concrete
powder is 5–12 L\* lighter than its concrete, so a concrete/powder pair is a ready 2-step ramp of one hue.

---

## 5. Human figures, statues, busts

### 5.1 Proportions

| Canon | Heads tall | Use |
| --- | --- | --- |
| Average adult | 7.5 | realistic statues |
| Ideal (Greek/Renaissance) | 8 | monuments, saints, kings |
| Heroic | 8.5 (extra length in chest and legs) | gods, titans, heroes |
| Minecraft skin | 4 (head 8 of 32 px) | player statues |
| Chibi | 2–3 | tiny icons, mascots |

Landmarks in an 8-head figure (from the floor): chin 7, nipples/armpits 6, navel and elbows 5, crotch 4
(half height), fingertips 3 (mid-thigh), knees 2. Arm ≈ 3 heads, hand ≈ face length, foot ≈ 1 head,
shoulders ≈ 2 heads wide (male) / 1.5–1.75 (female), hips 1.5 / 1.75–2 (convention).

Head: width ≈ ⅔–¾ of height, depth ≈ 0.85–0.9; eyes on the horizontal midline, one eye-width apart (head ≈ 5
eye-widths wide); nose base halfway from eyes to chin; mouth a third of the way from nose to chin; ears
between eye line and nose base. A 16-tall head: 11–12 wide, 14 deep, eyes on row 8 (3 wide, 3 apart), nose base
row 12, mouth row 13–14.

### 5.2 `b.figure`

```js
const fig = b.figure([24, 4, 24], {
  height: 40,            // soles to crown
  heads: 7.5,            // canon (8 ideal, 4–5 stylized: bigger head, same body girths)
  facing: 'south',       // the way the figure looks
  build: 1.1,            // girth multiplier (1 = athletic, 1.3 = heavy, 0.85 = slender)
  smooth: 0.3,           // smooth-union fillet in canon units (head heights of an 8-head figure)
  paint: 'white_wool',   // canvas; shade afterwards
  pose: {
    armR: { raise: 20, swing: 50, elbow: 70 },  // degrees: raise = sideways, swing = forward, elbow = bend
    armL: { raise: 10, swing: -5, elbow: 15 },
    legL: { swing: 8, spread: 4, knee: 0 },
    contrapposto: 0.8,   // weight on the right leg: pelvis and shoulders tilt opposite, left knee relaxes
    headTurn: 15, lean: 0,
  },
})
// fig.joints.armR.wrist → world position to attach a sword, torch, book or staff
b.line(fig.joints.armR.wrist, [fig.joints.armR.wrist[0], fig.joints.armR.wrist[1] + 12, fig.joints.armR.wrist[2] + 2], 'gold_block', { radius: 0.9 })
```

Limbs never go below radius 0.87, so figures under ~24 blocks get chunky limbs; switch to the box model.
Face sockets and nose appear only when the head is ≥ 5 blocks tall.

Posing that reads:

- **Line of action:** one S or C curve through spine and weight leg. A straight vertical figure reads
  as a mannequin.
- **Contrapposto:** weight on one leg, hips tilt up on that side, shoulders the other way, free knee bent.
- **Arms off the body:** raise ≥ 10° or swing ≥ 15° so the torso silhouette stays clean; a raised arm with a
  prop is the strongest monument pose.
- **Turn the head** 10–25° toward the action; face the figure ~3/4 to the hero camera.
- **Asymmetry:** different elbow bends left and right.

Clothing and armour: build the body, then add offset shells (a slightly larger ellipsoid or tube in another
material, `{ keep: false }`) for robes, breastplates and helmets; capes are 1-thick sheets (§6.3 membrane
helper). Hair is a smooth-unioned blob over the skull in a darker step.

### 5.3 Box-model (Minecraft player) statue

Skin layout (1 skin pixel = k blocks): head 8×8×8, torso 8 wide × 4 deep × 12 tall, arms and legs 4×4×12,
whole figure 16 × 32 × 8. Build legs → torso → arms → head.

```js
const k = 2, X = 30, Y = 1, Z = 30                         // feet-level front-left corner, faces +z
const part = (px, py, pz, w, h, d, paint) =>
  b.box([X + px * k, Y + py * k, Z + pz * k], [X + (px + w) * k - 1, Y + (py + h) * k - 1, Z + (pz + d) * k - 1], paint)
part(4, 0, 2, 4, 12, 4, 'blue_terracotta')       // legs
part(8, 0, 2, 4, 12, 4, 'blue_terracotta')
part(4, 12, 2, 8, 12, 4, 'cyan_terracotta')      // torso
part(0, 12, 2, 4, 12, 4, 'white_terracotta')     // arms (skin)
part(12, 12, 2, 4, 12, 4, 'white_terracotta')
part(4, 24, 0, 8, 8, 8, 'white_terracotta')      // head
part(4, 30, 0, 8, 2, 8, 'brown_terracotta')      // hair
part(5, 27, 7.5, 1, 1, 0.5, 'white_concrete'); part(6, 27, 7.5, 1, 1, 0.5, 'blue_concrete')   // eyes painted into
part(9, 27, 7.5, 1, 1, 0.5, 'blue_concrete');  part(10, 27, 7.5, 1, 1, 0.5, 'white_concrete') // the front face
```

Raise the statue on a plinth or a hill (one guide: 5 blocks of walls); posing a box model = rotating whole
boxes, so keep it to one raised arm (a sloped column of boxes).

### 5.4 Busts and heads

```js
const { sdf } = kit
const C = [24, 30, 24], h = 16                                   // head centre and head height
const head = sdf.ellipsoid(C, [0.37 * h, 0.5 * h, 0.44 * h])
const neck = sdf.capsule([24, 14, 24], [24, 24, 24], 3.2)
const shoulders = sdf.ellipsoid([24, 12, 24], [11, 5, 5])
const eye = s => sdf.sphere([24 + s * 0.17 * h, C[1], C[2] + 0.43 * h], 0.1 * h + 0.3)
const nose = sdf.capsule([24, C[1] - 0.05 * h, C[2] + 0.38 * h], [24, C[1] - 0.25 * h, C[2] + 0.5 * h], 1)
const bust = sdf.subtract(sdf.union(sdf.smoothUnion(2, head, neck, shoulders), nose), sdf.union(eye(1), eye(-1)))
b.sdf([8, 8, 10], [40, 40, 38], bust, 'white_wool')
b.box([16, 4, 18], [32, 7, 30], 'polished_blackstone')            // base
b.shadeSurface([8, 8, 10], [40, 40, 38], ['tuff', 'stone', 'andesite', 'polished_diorite', 'quartz_block'], { only: 'white_wool' })
```

---

## 6. Creatures

Build every creature from 5–9 masses on one spine spline (snout → tail tip) with a radius profile, then legs,
wings, fins as separate tubes or sheets, then shade.

### 6.1 Proportion shorthand (convention)

| Creature | Shorthand |
| --- | --- |
| Western dragon | head ≈ 1/10–1/12 of length, neck ≈ 1/5, body ≈ 1/5, tail ≈ 2/5–1/2; wingspan 1–1.5 × length; 3–4 finger bones per wing, membrane sags 1–3 blocks |
| Serpent / sea dragon | `r(s) = rMax · sin(πs)^0.6`, tip clamped to 0.87; S or helix coils |
| Horse | barrel ≈ 2.5 : 1.2 : 1 (L:H:W); leg ≈ chest depth; knees and hocks bend opposite ways |
| Dog / cat / lion | torso ≈ 2 : 1 : 1; chest mass + smaller pelvis mass blended (k ≈ 0.3 × torso radius) |
| Bear | 1.8 : 1.2 : 1.2, short thick legs, hump over the shoulders |
| Whale | L:D ≈ 4:1 (humpback) to 6–7:1 (blue/fin); max girth 30–40% back from the snout; humpback flippers up to ⅓ of length; flukes ¼–⅓ of length; eye small, low, behind the mouth corner |
| Insects, crabs | chitin = offset shells of ellipsoids; legs = capsule chains (r ≥ 0.87, or end in end rods/fences) |

### 6.2 Dragon

```js
// spine from snout (s = 0) to tail tip (s = 1); profile in units of the max body radius R
const spine = [[10, 26, 60], [16, 31, 54], [26, 30, 48], [40, 26, 48], [54, 24, 56], [66, 20, 64], [78, 16, 60], [90, 14, 50]]
const R = 6
const keys = [[0, .3], [.05, .45], [.09, .55], [.13, .38], [.25, .45], [.35, 1], [.48, .85], [.6, .55], [.8, .25], [1, 0]]
const profile = s => {
  for (let i = 1; i < keys.length; i++) if (s <= keys[i][0]) {
    const [s0, r0] = keys[i - 1], [s1, r1] = keys[i], u = (s - s0) / (s1 - s0)
    return R * (r0 + (r1 - r0) * u * u * (3 - 2 * u))
  }
  return 0
}
const body = b.tubeAlong(spine, profile, 'white_wool')
const at = s => body.samples[Math.round(s * (body.samples.length - 1))]
// legs: hip/shoulder → knee → foot, tapering
for (const [s, side] of [[0.36, 1], [0.36, -1], [0.5, 1], [0.5, -1]]) {
  const p = at(s)
  b.tubeAlong([[p[0], p[1] - 2, p[2] + side * 3], [p[0] + 2, p[1] - 9, p[2] + side * 6], [p[0] - 1, 2, p[2] + side * 6]], t => 2.6 - 1.4 * t, 'white_wool')
}
// wings: arm bone + 3 fingers, membrane = 1-thick triangles between them
function sheet(A, B, C, paint) {
  const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const nl = Math.hypot(...n), uu = u[0] ** 2 + u[1] ** 2 + u[2] ** 2, vv = v[0] ** 2 + v[1] ** 2 + v[2] ** 2, uv = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const den = uu * vv - uv * uv
  const lo = [0, 1, 2].map(i => Math.min(A[i], B[i], C[i]) - 1), hi = [0, 1, 2].map(i => Math.max(A[i], B[i], C[i]) + 1)
  b.fillWhere(lo, hi, (x, y, z) => {
    const w = [x - A[0], y - A[1], z - A[2]]
    if (Math.abs((w[0] * n[0] + w[1] * n[1] + w[2] * n[2]) / nl) > 0.5) return false   // thickness 1
    const wu = w[0] * u[0] + w[1] * u[1] + w[2] * u[2], wv = w[0] * v[0] + w[1] * v[1] + w[2] * v[2]
    const s = (vv * wu - uv * wv) / den, t = (uu * wv - uv * wu) / den
    return s >= -0.05 && t >= -0.05 && s + t <= 1.05
  }, paint, { keep: true })
}
for (const side of [1, -1]) {
  const root = at(0.37), shoulder = [root[0], root[1] + 4, root[2] + side * 3]
  const wrist = [shoulder[0] + 4, shoulder[1] + 12, shoulder[2] + side * 16]
  const tips = [[wrist[0] + 16, wrist[1] + 2, wrist[2] + side * 8], [wrist[0] + 20, wrist[1] - 6, wrist[2] + side * 2], [wrist[0] + 18, wrist[1] - 14, wrist[2] - side * 4]]
  b.tubeAlong([shoulder, wrist], t => 1.8 - 0.6 * t, 'white_wool')
  for (const tip of tips) b.tubeAlong([wrist, tip], t => 1.1 - 0.2 * t, 'white_wool')
  const anchors = [tips[0], tips[1], tips[2], at(0.55)]
  for (let i = 0; i < 3; i++) sheet(wrist, anchors[i], anchors[i + 1], 'red_terracotta')
}
b.shadeSurface([0, 0, 0], [110, 60, 110],
  ['red_nether_bricks', 'nether_wart_block', 'crimson_planks', 'red_concrete', 'red_terracotta', 'orange_terracotta'],
  { only: 'white_wool' })
```

Detail pass (taste): `pointed_dripstone[vertical_direction=up]` or stairs along the spine ridge every 2–3
blocks; eyes = a glowing block (`shroomlight`, `ochre_froglight`) in a 1-block socket; horns as tubes r 0.9–1.5
swept back from the skull.

### 6.3 Whale (loft along an axis)

```js
const L = 60, R = 7, X0 = 10, Y0 = 20, Z0 = 30                 // snout at x = X0, body along +x
const r = u => (u < 0.35 ? R * Math.sqrt(1 - ((0.35 - u) / 0.35) ** 2) : R * (1 - 0.88 * ((u - 0.35) / 0.65) ** 1.6))
b.fillWhere([X0, Y0 - R, Z0 - R], [X0 + L, Y0 + R, Z0 + R], (x, y, z) => {
  const u = (x - X0) / L
  if (u < 0 || u > 1) return false
  const ru = Math.max(0.9, r(u))
  return ((y - Y0) / (0.85 * ru)) ** 2 + ((z - Z0) / ru) ** 2 <= 1   // slightly flattened section
}, 'white_wool', { hollow: true })
for (const s of [1, -1]) {
  b.ellipsoid([X0 + L + 1, Y0, Z0 + s * 6], [3.5, 1, 6.5], 'white_wool')                        // fluke lobes
  b.tubeAlong([[X0 + 18, Y0 - 3, Z0 + s * 5], [X0 + 26, Y0 - 7, Z0 + s * 12], [X0 + 33, Y0 - 9, Z0 + s * 18]], t => 1.8 - t, 'white_wool')
}
b.shadeSurface([0, 0, 0], [80, 40, 60], ['black_concrete', 'gray_concrete', 'cyan_terracotta', 'light_gray_concrete', 'clay'], { only: 'white_wool' })
// ventral grooves: pale stripes on the front 60% of the belly
b.fillWhere([X0, Y0 - R, Z0 - R], [X0 + 0.6 * L, Y0 - 0.45 * R, Z0 + R], () => true,
  (x, y, z) => (z % 2 ? 'white_concrete' : 'light_gray_concrete'), { only: () => true })
```

---

## 7. Ships and airships

### 7.1 Proportions

| Type | Hull L (blocks) | Beam | Keel→deck | Masts | Main mast (from keel) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Rowboat | 6–10 | 3–4 | 2 | 0 | — | |
| Longship | 20–40 | L/5–L/7 (≥ 5) | 3–4, freeboard 2–3 | 1 amidships | 0.5–0.6 L | double-ended; sail ≈ 0.45 L wide, wider than tall; oar/shield every 1–2 |
| Sloop | 16–25 | L/3.5 | 4–5 | 1 | 1.0–1.2 L | big fore-and-aft sail + jib |
| Frigate | 35–60 | L/3.5–L/4 | 7–10 | 3 + bowsprit | ≈ 1.0 L | bowsprit ≈ 0.4 L; gunports every 3; low castles |
| Galleon | 40–85 | L/3.5–L/4 | 8–12, sterncastle +6–10 | 3–4 + bowsprit | 1.0–1.1 L | beakhead ahead of the stem; square transom; low forecastle |
| Airship | envelope 30–250 | Ø L/5–L/6 | — | — | — | blunt nose, sharp tail; 4 tail fins ≈ 0.12 L; small gondola under the front third |

Reference points: Vasa hull 47.5 m × 11.7 m (4.1:1), mainmast top 52.5 m above the keel (1.1 × hull), draft
≈ 0.1 L; longships typically 7:1 (Skuldelev 2 8.3:1), one oar per side per ~1 m; Hindenburg 245 × 41 m
(6:1). Minecraft builds: PirateCraft frigate 50 × 20 × 40 overall on a ~35-block hull (main mast ≈ hull length,
bowsprit ≈ 15, gunports 2 apart, stern gallery = hull width − 2); a GrabCraft galleon 25 × 63 × 85 with
2,560 white wool in its sails. Fore mast ≈ 0.85–0.9 × main, mizzen ≈ 0.65–0.75 × main; masts vertical or
raked slightly aft (≤ 1 block per 15–20).

### 7.2 Hull: `b.hull`

A hull is a loft: a teardrop plan (max beam at 0.35–0.5 from the bow), a keel that rises at the forefoot,
sheer that rises toward both ends (forward rise ≈ 2 × aft), superellipse sections below the waterline and
tumblehome (galleons, frigates) or flare (longships) above it.

```
 plan (top view)                 midship section                 profile
        ____________                 __|__   tumblehome             sheer  ___________/
   ___/             |  transom      /     \                       \______/           |
  <                 |              |  ~~~  | waterline             \_________________/
   ‾‾‾\_____________|              \_____/   section 2.5             forefoot      keel
 bow  ← heading                       |  keel slab
```

```js
const ship = b.hull({
  bow: [30, 3, 30],         // bow tip, keel-bottom level, centreline (keep y ≥ 1: the keel slab goes under it)
  heading: 'west',          // the hull runs back from the bow toward east
  length: 52,               // beam defaults to L/3.8, depth to L/5.5
  transom: 0.7,             // stern width / max beam (0 = pointed, galleon 0.6–0.75)
  section: 2.5,             // 2 round bilge, 3–4 full U, 1.3–1.6 V
  tumble: 0.12,             // > 0 tumblehome, < 0 flare
  decks: [6],               // extra floor heights (local y above the keel); the main deck is the hull top
  gunports: { y: 7, every: 3, from: 0.2, to: 0.8 },
  paint: { bottom: 'dark_oak_planks', wale: 'stripped_dark_oak_log', side: 'spruce_planks', deck: 'spruce_planks', trim: 'stripped_spruce_log' },
})
// ship.at(u, w, y) → world block (u from the bow, w to starboard, y above the keel); ship.deckY(u); ship.mast(u)
```

Other options: `beam` (L/3.8), `depth` (L/5.5), `maxBeamAt` 0.4, `bowExp` 0.6 (lower = bluffer bow), `runExp`
2.2, `waterline` 0.55 of depth, `sheerFwd` L/16, `sheerAft` L/12, `forefoot` 0.6 and `rocker` 0.2 (keel rise
at bow/stern as a fraction of the waterline height), `doubleEnded` (longships), `bulwark` 1, `rail`
(`'spruce_fence'` or `null`), `keel` (slab under the bottom), `stem`, `thickness` 1.

Deck levels need 1 floor + 2 air. Paint below the waterline darkest, a wale band at the waterline, lighter
sides, trim at the rail; a black band through the gunports reads as a gun deck.

Sterncastle and forecastle:

```js
const L = ship.length, d = ship.deckY(L * 0.85), hb = Math.floor(ship.halfBreadth(L * 0.8)) - 1
b.hollowBox(ship.at(Math.round(L * 0.74), -hb, d + 1), ship.at(L - 1, hb, d + 5), 'dark_oak_planks')
b.box(ship.at(Math.round(L * 0.74), -hb, d + 6), ship.at(L - 1, hb, d + 6), 'spruce_slab[type=bottom]')
for (let u = Math.round(L * 0.78); u < L - 2; u += 3) for (const w of [-hb, hb]) {
  const p = ship.at(u, w, d + 3)
  b.set(p[0], p[1], p[2], 'glass_pane')
}
const df = ship.deckY(L * 0.08)
b.box(ship.at(2, -2, df + 1), ship.at(Math.round(L * 0.16), 2, df + 2), 'spruce_planks')   // low forecastle
```

### 7.3 Masts, yards, sails, rigging

```js
const fwd = [-1, 0, 0]                                    // heading west; yards run along z
function rig(u, height, yards) {
  const m = ship.mast(u * L)
  b.box(m, [m[0], m[1] + height, m[2]], 'stripped_spruce_log[axis=y]')
  for (const [fy, half] of yards) {                       // yard height fraction, half-length
    const y = m[1] + Math.round(fy * height), drop = Math.round(height * 0.22)
    b.box([m[0], y, m[2] - half], [m[0], y, m[2] + half], 'spruce_fence', { keep: true })
    for (let yy = y - drop; yy < y; yy++) for (let s = -half + 1; s <= half - 1; s++) {
      const t = (yy - (y - drop)) / drop, q = s / half
      const belly = Math.round(1.8 * (1 - q * q) * (1 - (2 * t - 1) ** 2))   // billow downwind
      b.set(m[0] + fwd[0] * (1 + belly), yy, m[2] + s, 'white_wool')
    }
  }
  for (const sgn of [1, -1]) {                            // shrouds: mast top → rail abaft the mast
    const rail = ship.at(u * L + 3, sgn * (Math.floor(ship.halfBreadth(u * L)) - 1), ship.deckY(u * L) + 2)
    b.line([m[0] + 1, m[1] + Math.round(0.88 * height), m[2] + sgn], rail, 'spruce_fence', { connect: 6 })
  }
  b.set(m[0], m[1] + height, m[2] - 1, 'red_wall_banner[facing=north]')   // hangs on the mast top
}
rig(0.24, 46, [[0.36, 11], [0.64, 8], [0.88, 5]])        // fore
rig(0.48, 52, [[0.36, 12], [0.64, 9], [0.88, 6]])        // main ≈ hull length
rig(0.72, 36, [[0.45, 8], [0.78, 5]])                    // mizzen
const bs = ship.at(-1, 0, ship.deckY(2) + 2)              // bowsprit ≈ 0.4 L, rising forward
b.line(bs, [bs[0] - Math.round(0.4 * L), bs[1] + 7, bs[2]], 'stripped_spruce_log[axis=x]', { connect: 6 })
```

Rules:

- Sails shrink going up; upper sails wider at the foot than the head; the lowest course draws in at the foot.
  Lowest yard ≈ 1.5–2 × beam; each higher yard ≈ 0.7–0.8 × the one below.
- Billow 1–3 blocks downwind; shade the lee side one step darker (`light_gray_wool`); an upside-down slab row
  (`smooth_sandstone_slab[type=top]`) on the foot rounds the belly.
- Build sails as rough chunks first, refine later. Sail area must look huge next to the hull.
- Furled sails: wool bundles under the yards in 3 bunches separated by fence posts.
- Rigging: fences connect only face-to-face, so every diagonal line is `connect: 6`. Shrouds run wide at the
  rail and narrow at the mast top; stays droop 3–6% of their span. `chain[axis=x|y|z]` for straight tethers.
- Crow's nests: a 3×3–5×5 ring of slabs or trapdoors above each lower yard, the lowest largest.
- Cannons: a `dispenser` in the port backed by `iron_block`, or 2-long dark barrels
  (`polished_blackstone_wall`, `anvil`); 4 on the quarterdeck. Port lids = open trapdoors.
- Flags and pennants: `*_wall_banner` with `patterns` NBT (`minecraft:skull` for pirates); stern lanterns.

### 7.4 Longship

```js
const ls = b.hull({
  bow: [10, 2, 72], heading: 'west', length: 30, beam: 6, depth: 4, doubleEnded: true, bowExp: 0.9,
  section: 1.5, tumble: -0.15, sheerFwd: 4, sheerAft: 4, rail: null, keel: 'spruce_slab[type=top]',
  paint: { bottom: 'spruce_planks', wale: 'dark_oak_planks', side: 'spruce_planks', deck: 'spruce_slab[type=bottom]', trim: 'dark_oak_log[axis=y]' },
})
for (let u = 6; u <= 24; u += 2) for (const s of [1, -1]) {      // shields hung outside the rail, alternating
  const y = ls.deckY(u) + 1
  let w = Math.ceil(ls.beam)
  while (w > 0 && !b.has(...ls.at(u, s * w, y))) w--             // scan inward to the bulwark
  b.set(...ls.at(u, s * (w + 1), y), (u / 2) % 2 ? 'yellow_terracotta' : 'red_terracotta')
}
const m = ls.mast(15)
b.box(m, [m[0], m[1] + 16, m[2]], 'spruce_log[axis=y]')
b.box([m[0], m[1] + 15, m[2] - 7], [m[0], m[1] + 15, m[2] + 7], 'spruce_fence')
for (let y = m[1] + 6; y <= m[1] + 14; y++) for (let z = m[2] - 6; z <= m[2] + 6; z++)
  b.set(m[0] - 1, y, z, Math.floor((z - m[2] + 6) / 2) % 2 ? 'red_wool' : 'white_wool')   // striped sail
```

Dragon-head prow: a short `b.tubeAlong` (r 1.2 → 0.9) curling forward from the stem top, two
glowing-eye blocks, a `dark_oak_trapdoor` jaw. Clinker planking: alternate two wood tones row by row or
alternate full blocks and stairs every row.

### 7.5 Airship

```js
const E = { x0: 10, y: 40, z: 60, L: 48, R: 8 }                        // envelope along +x, nose at x0
const rAt = u => (u < 0.38 ? E.R * Math.sqrt(1 - ((0.38 - u) / 0.38) ** 2) : E.R * (1 - ((u - 0.38) / 0.62) ** 1.8))
b.fillWhere([E.x0, E.y - E.R, E.z - E.R], [E.x0 + E.L, E.y + E.R, E.z + E.R], (x, y, z) => {
  const u = (x - E.x0) / E.L
  return u >= 0 && u <= 1 && Math.hypot(y - E.y, z - E.z) <= Math.max(0.9, rAt(u))
}, x => (Math.floor((x - E.x0) / 6) % 2 ? 'light_gray_concrete' : 'white_concrete'), { hollow: true })   // gore bands
const xf = E.x0 + Math.round(E.L * 0.8)
b.box([xf, E.y + 2, E.z], [E.x0 + E.L - 2, E.y + Math.round(E.R * 1.2), E.z], 'red_concrete')       // 4 fins
b.box([xf, E.y - Math.round(E.R * 1.2), E.z], [E.x0 + E.L - 2, E.y - 2, E.z], 'red_concrete')
b.box([xf, E.y, E.z + 2], [E.x0 + E.L - 2, E.y, E.z + Math.round(E.R * 1.2)], 'red_concrete')
b.box([xf, E.y, E.z - Math.round(E.R * 1.2)], [E.x0 + E.L - 2, E.y, E.z - 2], 'red_concrete')
const g = { x0: E.x0 + 12, x1: E.x0 + 22, y: E.y - E.R - 5 }                                      // gondola ≈ 0.2 L
b.box([g.x0, g.y, E.z - 2], [g.x1, g.y + 2, E.z + 2], 'spruce_planks')
b.walls([g.x0, g.y + 1, E.z - 2], [g.x1, g.y + 2, E.z + 2], 'spruce_planks')
for (const x of [g.x0 + 1, g.x1 - 1]) for (const z of [E.z - 1, E.z + 1]) b.line([x, g.y + 3, z], [x, E.y - E.R + 1, z], 'chain[axis=y]')
```

Fantasy sky-galleons: a normal hull with one or more envelopes above (balloon length 0.8–1.2 × hull),
tethered with chains or fences; quartz/copper envelopes for steampunk.

---

## 8. Organic landmarks

### 8.1 Giant mushrooms

Vanilla: 5–7 tall (1 in 12 grows to 9/11/13); brown = flat 7×7 cap minus corners; red = dome of five 3×3
layers, hollow. Mushroom blocks have six face states: `true` = cap/stem texture, `false` = pores. Vanilla sets
faces touching other mushroom blocks to `false`; red caps have `down=false` (pores underneath). Huge crimson
fungus: stem 4–13 (1 in 12 doubled), optional 3×3 trunk, wart canopy up to 3 out, shroomlights, weeping
vines, max 27 tall.

```js
b.hugeMushroom([20, 1, 20], { type: 'red', height: 22, glow: true })     // cap radius ≈ 0.55 × height
b.hugeMushroom([50, 1, 24], { type: 'brown', height: 16, lean: 0.2 })    // broad plate ≈ 0.75 × height
```

Options: `capRadius`, `stemRadius` (≈ 0.17 × cap radius; base bulb +70%), `lean` (fraction of height),
`spots` (extra `mushroom_stem` blobs on red caps), `glow` (shroomlights under the cap), `ring` (annulus at
72%), `stem` paint. Faces are recomputed (`b.fixMushroomFaces(min, max)` if you edit a cap afterwards).

Landmark proportions (taste): stem radius 0.12–0.2 × cap diameter, cap diameter 0.8–1.5 × stem height, cap
thickness 0.15–0.25 × diameter at the centre and 1–2 at the rim, rim drooping 10–20% of the radius.
Fantasy palettes: warped (`warped_wart_block`, `warped_stem`, `shroomlight`), crimson (`nether_wart_block`,
`crimson_stem`, `weeping_vines`), glowing (`glow_lichen` spots, `ochre_froglight` gills).

### 8.2 Crystals

Real habit: hexagonal prism capped by a six-sided pyramid, attached at one end, grown in clusters (druse);
vanilla geodes are amethyst inside, calcite, then smooth basalt outside.

```js
b.crystalCluster([20, 2, 20], { count: 8, length: 16, apothem: 2.6, spread: 35, shell: 'purple_stained_glass', seed: 4 })
b.crystalCluster([50, 2, 20], { count: 6, length: 12, apothem: 2, core: 'packed_ice', shell: 'light_blue_stained_glass', tip: 'end_rod', bed: 'snow_block', bedOuter: 'packed_ice' })
```

Rules: length 3–6 × apothem; 1 dominant, 2–4 secondaries at 0.4–0.7, many small at 0.1–0.3; tilts 10–40°,
never parallel; bases sunk into rock; apothem ≥ 1.5 for a hexagon to read (smaller ones become 1-wide spikes
with an `amethyst_cluster` or `end_rod` tip). `normal` grows clusters from walls and ceilings. Amethyst
clusters glow in night renders.

### 8.3 Coral

Blocks: `tube` (blue), `brain` (pink), `bubble` (magenta), `fire` (red), `horn` (yellow) as
`*_coral_block`, `*_coral`, `*_coral_fan`, `*_coral_wall_fan[facing=…]`; `dead_*` greys; `sea_pickle` glows.
Plants and fans take `waterlogged=true` underwater; living coral above water dies in game, so dry
displays use `dead_*`.

```js
const C = [20, 7, 20]
b.sdf([12, 0, 12], [28, 15, 28], (x, y, z) => {                       // brain coral: sphere with grooves
  const d = Math.hypot(x - C[0], y - C[1], z - C[2]) - 6.5
  return Math.abs(Math.sin(0.9 * x + 1.7 * Math.sin(0.5 * z))) < 0.18 && d > -1.5 ? 1 : d
}, 'brain_coral_block')
for (let i = 0; i < 5; i++) {                                          // staghorn branches
  const a = i * 1.26, top = [36 + Math.cos(a) * 5, 9 + i % 3, 20 + Math.sin(a) * 5]
  b.tubeAlong([[36, 1, 20], [36 + Math.cos(a) * 2, 5, 20 + Math.sin(a) * 2], top], t => 1.3 - 0.4 * t, 'tube_coral_block')
  b.set(Math.round(top[0]), Math.round(top[1]) + 2, Math.round(top[2]), 'tube_coral_fan[waterlogged=false]')
}
```

Forms: brain (grooved dome), staghorn (branching tubes at 30–60°), table (disc on a stalk), fan (1-thick
sheets). Mix 3–5 species per head, clustered by species, never checkerboarded.

### 8.4 Rock arches, spires, hoodoos

Geology: a hard caprock over softer layers; alcoves erode under the cap on both sides of a fin until they meet;
hoodoos are soft columns with a hard cap and a "totem-pole" profile; colour bands follow the strata.

```js
b.rockArch([20, 1, 40], [52, 1, 32], {                                // feet = leg centres on the ground
  height: 24, thickness: 10,                                         // defaults: 0.75 × span, 0.3 × span
  ramp: ['brown_terracotta', 'red_terracotta', 'terracotta', 'orange_terracotta', 'white_terracotta', 'smooth_sandstone'],
  bands: { height: 3, amount: 0.14 }, seed: 3,
})
```

Keep the lintel ≥ ⅓ of the opening span thick (thinner reads fragile); lighter, harder band on top; darker
under the lintel and toward the ground.

Spire or hoodoo from a radius profile:

```js
const S = [70, 1, 30], Hs = 36
const inSpire = (x, y, z) => {
  const t = (y - S[1]) / Hs
  if (t < 0 || t > 1) return false
  let r = 7 * (1 - t) ** 0.6 + 1
  const warp = Math.floor(4 * kit.noise.fbm3(x, 0, z, { scale: 9, seed: 4 }))
  if ((y + warp + 60) % 7 < 2) r += 1.2                               // tilted, irregular ledges every ~7
  r += 1.8 * kit.noise.fbm3(x, y, z, { scale: 7, seed: 2 })
  return Math.hypot(x - S[0], z - S[2]) <= r
}
b.fillWhere([S[0] - 10, S[1], S[2] - 10], [S[0] + 10, S[1] + Hs, S[2] + 10], inSpire, 'white_wool')
b.ellipsoid([S[0], S[1] + Hs + 1, S[2]], [4.5, 2, 4.5], 'white_wool')      // hoodoo cap
b.erode([S[0] - 11, S[1], S[2] - 11], [S[0] + 11, S[1] + Hs + 4, S[2] + 11], { preset: 'smooth', only: 'white_wool' })
b.shadeSurface([S[0] - 11, S[1], S[2] - 11], [S[0] + 11, S[1] + Hs + 4, S[2] + 11],
  ['deepslate_tiles', 'cobbled_deepslate', 'tuff', 'stone', 'andesite', 'polished_diorite'],
  { only: 'white_wool', bands: { height: 4, amount: 0.15 }, base: 0.2 })
```

Cliffs and outcrops: [nature.md](nature.md) §2.4–2.5.

### 8.5 Clouds

Cumulus: flat base, puffy "cauliflower" top; humilis flat, congestus towering; singly, in lines or clusters.

```js
b.cloud([40, 60, 30], { length: 40, tiers: 2, seed: 8 })                       // fair-weather cumulus
b.cloud([90, 55, 40], { length: 30, tiers: 3, height: 16, seed: 2 })            // towering congestus
b.cloud([60, 50, 70], { length: 34, seed: 5, ramp: ['gray_concrete_powder', 'gray_wool', 'light_gray_concrete_powder', 'light_gray_wool', 'white_concrete'] })  // storm
```

Puffs are metaballs along an elongated footprint (length : width ≈ 2 : 1), large in the middle and smaller at
the ends, a second tier seated on the first, clipped flat at the base, hollowed (2 thick) and shaded
top-light: snow on the sunlit top, grey underside. Mix whites (`white_wool`, `white_concrete_powder`, `snow_block`)
so large areas don't look like one flat material. Optional fuzz: ≤ 30% of the surface swapped to
`white_stained_glass`.

### 8.6 Floating islands

Tops, soil and the `b.island` generator: [nature.md](nature.md) §7. Sculpting additions:

- Underside depth 0.75–1.5 × top radius; profile `r(d) = R · (1 − d/D)^0.6–0.9` (convex belly); 3–8
  downward spikes (0.2–0.5 × depth) tipped with `pointed_dripstone[vertical_direction=down]`.
- Rim: the top 1–2 layers overhang the underside by 1 block. Dirt layer broken by `coarse_dirt`/`rooted_dirt`,
  never one unbroken line; darker blocks just under the dirt.
- Hanging life on 3–8% of underside cells, strands 1–6 long:

```js
b.island([30, 40, 30], 12, { depth: 15 })
for (const [x, y, z] of b.entries().filter(([x, y, z]) => y < 40 && !b.has(x, y - 1, z))) {
  const r = kit.hash01(x, y, z, 5)
  if (r < 0.05) b.set(x, y - 1, z, 'hanging_roots')
  else if (r < 0.09) {
    const n = 1 + Math.floor(kit.hash01(x, 0, z, 7) * 5)
    for (let k = 1; k < n; k++) b.set(x, y - k, z, 'cave_vines_plant[berries=false]', { keep: true })
    b.set(x, y - n, z, 'cave_vines[berries=true]', { keep: true })
  }
}
```

### 8.7 Waterfalls and lava falls

Water mechanics and the water-fall recipe: [nature.md](nature.md) §3.4. A placed structure never flows; the
fall is an explicit 1-thick curtain of `water[level=8]` (renders full height), a `level=0` plunge pool 2–4
deep and 3–6 wider than the curtain, foam (`white_concrete_powder`, `calcite`) at the impact, wet dark rock
behind (`mossy_cobblestone`, `tuff`, `moss_block`). Vary curtain width ±1 every 3–6 blocks; break tall falls
with ledges every 4–8 blocks.

Lava fall (glows in `--lighting night` renders):

```js
b.box([30, 0, 12], [50, 30, 22], 'basalt[axis=y]')                                   // cliff, fall on its south face
b.box([34, 0, 23], [46, 0, 31], 'blackstone')                                         // pool floor
b.box([35, 1, 23], [45, 1, 29], 'lava')                                               // plunge pool (level 0)
for (let y = 2; y <= 30; y++) for (let x = 38; x <= 41 + (y % 7 === 0 ? 1 : 0); x++) b.set(x, y, 23, 'lava[level=8]')
b.walls([34, 1, 23], [46, 2, 30], 'magma_block')                                      // rim; obsidian where lava meets water
b.box([33, 1, 31], [47, 1, 31], 'obsidian')
```

### 8.8 Landmark trees

Presets (`b.tree(base, 'fantasy' | 'big_oak' | ...)`) and leaf rules: [nature.md](nature.md) §1. For a
one-off landmark tree, sculpt it:

```js
const base = [40, 1, 40]
const above = { mask: (x, y) => y >= base[1] }                                    // keep the flare above ground
b.tubeAlong([base, [41, 14, 40], [39, 26, 42]], s => 4.5 * (1 + 0.8 * (1 - s) ** 6) * (1 - 0.45 * s), 'oak_wood', above)   // trunk + flare
for (let i = 0; i < 6; i++) {                                                                                   // roots
  const a = (i / 6) * Math.PI * 2 + 0.3
  b.tubeAlong([[40 + Math.cos(a) * 3, 5, 40 + Math.sin(a) * 3], [40 + Math.cos(a) * 8, 2, 40 + Math.sin(a) * 8], [40 + Math.cos(a) * 12, 1, 40 + Math.sin(a) * 12]], s => 2.4 * (1 - s) + 0.9, 'oak_wood', above)
}
const r0 = 2.6, rc = r0 / Math.sqrt(3)                                           // pipe model: r² = Σ child r²
for (let i = 0; i < 3; i++) {
  const a = i * 2.1 + 0.5, tip = [39 + Math.cos(a) * 14, 36 + i * 2, 42 + Math.sin(a) * 14]
  b.tubeAlong([[39, 24, 42], [39 + Math.cos(a) * 6, 31, 42 + Math.sin(a) * 6], tip], s => rc * (1 - 0.6 * s), 'oak_wood')
  b.leafBlob(tip, [6, 4, 6], ['oak_leaves', 'azalea_leaves'])
}
```

Rules: trunk radius obeys the pipe model at every fork (`r_parent² ≈ Σ r_child²`); root flare 1.5–2 × the
trunk radius over the bottom 10–15%; branch angles 30–60°; first big branches at ⅓–½ height; leaf blobs with
10–15% holes and air pockets; use `*_wood` (bark on six faces) for sculpted trunks and diagonal branches,
never `*_log`, whose end grain shows on cut faces.

### 8.9 Fantasy props

Same primitives, same shading pass:

- **Sword in stone:** blade = a box tapering to a point (`b.fillWhere` with half-width `w(y)`), a 1-block
  fuller groove in a darker step, guard = box with stair ends, grip = wall or log, pommel = sphere r 1.5;
  the stone = `b.boulder` or eroded ellipsoid.
- **Skull:** ellipsoid cranium + smaller jaw box, subtract eye sockets and nasal cavity, shade bone ramp
  (`brown_terracotta` → `white_terracotta` → `bone_block`).
- **Fallen colossus:** a `b.figure` with `pose: { lean: 80 }` (face-down along `facing`), cut by a noisy
  half-space (`b.fillWhere` with `'air'`), the fracture face one step lighter, moss on upward faces
  (`b.weather`).
- **Portal ring:** `kit.sdf.torus` in `polished_blackstone` + `crying_obsidian` with a `b.crystalCluster` on
  each side.

---

## 9. Review checklist

Render `se`, `south`, a side view and `low` (statues are seen from below); add `--lighting night` when
anything glows.

1. **Silhouette:** limbs, wings, neck and tail separable; negative space; one line of action.
2. **Proportions:** canon held (count heads); creature ratios from §6.1; ships from §7.1.
3. **Topology:** no 1-block pips, no dotted thin parts, no holes in shells or hulls, no floating debris.
4. **Curves:** run lengths gradual; no straight run > 7 in organic parts.
5. **Shading:** every ramp step used; creases darkest; tops lightest; neighbours ≤ 1 step apart; no splatter.
6. **Scale:** partial blocks only where §3.2 allows; features ≥ 4 px in the render.
7. **Ground contact:** plinth, rocks or terrain; darker bottom 1–3 layers; nothing hovers unintentionally.
8. **States:** `finish()` reports no problems; mushroom faces fixed after edits; water/lava placed explicitly.

---

## Sources

- ArdaCraft, Gradient Guide and Layering Guide (value > colour > texture; clusters; run lengths) — ardacraft.me/resources
- Minecraft Wiki: Huge Mushroom, Mushroom Block, Huge Crimson Fungus, Water, Tutorial:Pixel art — minecraft.wiki
- Finem Terrae organic tutorial (wireframe → spheres → smoothing) and ManaCube "Seeing the Simple Shapes" (ovoids, joints)
- VoxelSniper erode brush presets (bruhshes wiki, GitHub ShoukaSeikyo/bruhshes-wiki); WorldEdit `EditSession.makeSphere` (+0.5 radius)
- PirateCraft "30-Gun Frigate" tutorial; Minecraft Forum "Shipbuilding Tutorial" and "[TUTORIAL] Airship"; GrabCraft galleon
- Wikipedia: Body proportions, Galleon, Vasa, Longship, Hindenburg-class airship, Cumulus cloud, Natural arch, Hoodoo, Quartz
- Blockbench Minecraft Style Guide (ramps, pillow shading, banding)
- Red Blob Games, Line drawing on a grid (face-connected walks)
- Centripetal Catmull–Rom spline (Yuksel et al.); Runions et al., space colonization and the pipe model
- Measurements: Lodestone default-pack textures (`scripts/lib/data/block-colors.json`), voxelization experiments in this repo
