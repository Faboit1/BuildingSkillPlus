# Components: roofs, walls, openings, towers, structure

Every common architectural component with its proportions, a cross-section, and the kit call or
a short tested recipe. The numbers behind them (massing, scale tiers, depth, value) are in
[principles.md](principles.md). Small detail blocks and micro-modules (sills, shutters, awnings,
brackets, signs) are in [detailing.md](detailing.md); orientation rules for every block state are
in [block-states.md](block-states.md); which stairs, slabs and walls exist per material is in
[materials.md](materials.md); style-specific silhouettes are in [styles.md](styles.md).

Snippets are recipe fragments. They assume `const { kit } = api`, `const b = api.builder([80, 48, 80])`
and `const H = { x0: 10, z0: 10, x1: 22, z1: 18, F: 1 }` (outer wall lines, inclusive; `F` = the
level you stand on). Every snippet was built with `problems: []` and rendered. States written in
snippets (`facing`, `half`, `axis`) are there **for orientation**; `finish()` fills every other
property and computes stair corner shapes and wall/fence/pane connections.

Diagram legend. Sections are seen **from the south** (x grows to the right, east is right) unless
marked "seen from the west" (z grows to the right, south is right). Most diagrams are printed
straight from kit output.

```text
#  full block            /  stair rising to the right       \  stair rising to the left
_  bottom slab           p  upside-down stair, leg on the left    q  upside-down stair, leg on the right
~  top slab              X  log or beam (horizontal)   |  post (log axis=y)   !  fence or wall post
G  glass pane            D  door    T  trapdoor    L  lantern    i  end rod / lightning rod
plans: > < ^ v = stair facing east / west / north / south (its tall, uphill side)
```

---

## 1. Roofs

### 1.1 How `b.roof` builds a roof

```js
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 3, H.z1], 'white_terracotta')              // wall top = H.F + 3
const r = b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: H.F + 4,               // y = wall top + 1
  type: 'gable', axis: 'z', material: 'spruce', pitch: 1, overhang: 1, gableOverhang: 1,
  gable: 'spruce_planks', eaveTrim: true })
// r = { topY, base, axis, cells }; cells: Map "x,z" -> { tb, kind }, the top block of a cell is at y = r.base + tb
```

A 7-wide house (walls y0–y3, `y: 4`), section through the middle:

```text
y7               #               ridge row (odd width): full block
y6            /  #  \
y5         /  p     q  \         under every 1:1 stair inside the walls: an upside-down stair
y4      /  p           q  \      facing DOWN-slope -> smooth 45° ceiling and a thick rake
y3   /  #                 #  \   eave row: one below y, beside the wall top
y2   q  #                 #  p   eaveTrim: upside-down stair, leg against the wall
y1      #                 #
y0      #                 #
     0  1  2  3  4  5  6  7  8   <- x   (walls at x = 1 and 7)
```

What the kit does, so you can predict the result:

- **Rows** across the roof = `ceil((W + 2·overhang) / 2)`. `pitch` gives each row's rise,
  **listed from the eave inward**; a list shorter than the rows repeats its last value. At pitch 1
  on an odd width W the ridge is at `y + (W − 1)/2`. The eave row sits one below `y` at pitch 1,
  two below at pitch 2, and level with `y` (a slab) at pitch 0.5.
- **Cells:** a stair where a row rises ≥ 1, a bottom slab on a half level, and a **full block** on
  the ridge and where a whole level rises only 0.5. A roof never contains top slabs, so slab pitches
  have no see-through gaps. Each column is filled down to the previous row, so steep roofs are solid.
- **Underside** (`underside: 'stairs'`, the default): an upside-down stair facing down-slope under
  each 1:1 stair inside the walls. Rake rows and inner overhang rows get the same soffit stair; the
  outermost eave row stays bare unless `eaveTrim: true`. `underside: 'block'` uses full blocks.
- **`gable: paint`** fills every wall-line cell up to the roof surface (gable triangles, the high
  wall of a shed), replacing underside stairs on that line, so the triangle is solid.
- **Pitch-list rule:** the level of the wall-line row (index `overhang`) must be whole. The first
  entry counts as 0.5 if it is ≤ 0.5, otherwise 1; later entries add their rise. Good: `[0.5, 0.5, 1, …]`
  with overhang 1 or 2, `[1, …]` or `[2, …]` with overhang 1. Bad: `[0.5, 1, …]` with overhang 1.
- **A row may rise 0** (`pitch: [1, 1, 0]`): a flat field after two stair rings (Mojang's low hip).
- **`overwrite: false`** keeps blocks that are already there. Use it for a lower roof that dies into
  a taller wall, so the wall stays whole.
- **Materials without their own stairs** (`calcite`, `copper_block`...) fall back to their nearest
  family. Pass `{ stairs, slab, block }` ids for full control.

### 1.2 Pitch

| `pitch` | Angle | Profile, eave → ridge | Use |
| --- | --- | --- | --- |
| `0.5` | 26.6° | slab, block, slab, block (rises 1 per 2) | Mediterranean, classical, porches, wide roofs, modern |
| `1` | 45° | one stair per row | **default**: cottages, medieval, most houses (consensus) |
| `2` | 63.4° | stair over 1 block | Nordic, Gothic, alpine; thatch needs ≥ 45° |
| `3` | 71.6° | stair over 2 blocks | spires, helm faces, the lower slope of a mansard |
| `[2, 2, 2, 2, 1]` | steep | ends with a rise of 1 | every steep gable: a final rise of 2 leaves a 2-block fin on the ridge |
| `[0.5, 0.5, 1]` | kicked | flat eave, then 1:1 | bell-cast (sprocketed) eave |
| `[0.5, 0.5, 1, 1, 1, 2, 1]` + `overhang: 2` | curved | flat → 1:1 → 2:1 | East-Asian |
| `[2, 2, 2, 0.5]` | broken | steep low, shallow high | gambrel (barn) |
| `[2, 2, 3, 0.5]` | broken | very steep, then flat | mansard (`type: 'mansard'` default) |
| `[1, 1, 0]` | low | two stair rings + flat field | low hip, flat roof with a sloped edge |

Sections on an 11-wide house (walls y0–y3, `y: 4`):

```text
pitch: 0.5                                           pitch: [2, 2, 2, 2, 1]
                                                     y11                    #
                                                     y10                 /  #  \
                                                     y9               /  p     q  \
                                                     y8            /  p           q  \
                                                     y7            #                 #
y7                     _                             y6         /  #                 #  \
y6               _  #  #  #  _                       y5         #  #                 #  #
y5         _  #  #  #     #  #  #  _                 y4      /  #                       #  \
y4   _  #  #  #                 #  #  #  _           y3      #  #                       #  #
y3      #                             #              y2   /  #                             #  \
     1  2  3  4  5  6  7  8  9 10 11 12 13   <- x         1  2  3  4  5  6  7  8  9 10 11 12 13   <- x
```

- **Never mix pitches on faces that meet** (hips, valleys, cross gables): ridges stop lining up
  (consensus). A pitch change *within* one face (gambrel, mansard, bell-cast, Asian) is fine.
- **Steeper where it is wet or snowy**, lower where it is dry (wiki). Thatch ≥ 45°.
- **Big roofs read calmer** with a pitch of 0.5 or a broken profile; 20 rows of 1:1 steps read busy.

### 1.3 Gable roof

The workhorse; best up to ~12 wide (wiki). Wider plans: split the footprint (§1.8) or lower the pitch.
Gable end with `gable` fill, and the rake row one in front of it:

```text
gable wall (z = 9)                rake row (z = 10)
y7               #                y7               #
y6            /  #  \             y6            /     \
y5         /  #  #  #  \          y5         /  p     q  \
y4      /  #  #  #  #  #  \       y4      /  p           q  \
y3   /  #  #  #  #  #  #  #  \    y3   /  p                 q  \
y2   q  #  #  #  #  #  #  #  p    y2   q                       p
```

The rake overhangs the gable by 1 (`gableOverhang: 1`), so the triangle already sits one block
behind the roof edge, the recess good builders add by hand. Gable-end options (pick 1–2):

- **Top plate** across the gable at the eave line (a log along the wall) separates wall and triangle.
- **One opening on the centre line:** a 1×1 or 1×2 window, a trapdoor vent, a round window (§3.3).
- **Contrasting triangle:** vertical planks (`stripped_*_log` default axis), timber pattern, or infill.
- **Bargeboard:** open trapdoors on the outer face of the rake, or rake stairs in a darker wood.
- **Crow steps or a parapet** instead of an overhang (§1.11).

```js
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 3, H.z1], 'white_terracotta')
const r = b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: H.F + 4, axis: 'z', material: 'dark_oak', gable: 'spruce_planks', eaveTrim: true })
for (let x = H.x0; x <= H.x1; x++) b.set(x, H.F + 4, H.z1, 'stripped_dark_oak_log[axis=x]')   // top plate across the gable
b.window([16, H.F + 6, H.z1], 'south', { width: 1, height: 2, sill: false })                    // gable window on the centre line
for (const [k, c] of r.cells) {                                                                 // bargeboard on the south rake
  const [x, z] = k.split(',').map(Number)
  if (z === H.z1 + 1) b.set(x, r.base + c.tb, z + 1, 'spruce_trapdoor[facing=south,open=true]')
}
```

### 1.4 Ridges

| Width | Ridge | Options |
| --- | --- | --- |
| odd | one full block (kit default) | `ridgeCap: 'deepslate_tile_wall'` (cresting), a slab cap, a log ridge beam showing at the gable |
| even | two stairs back to back | cap both top rows with bottom slabs or a wall, or make the width odd |

```js
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 3, H.z1], 'white_terracotta')
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: H.F + 4, axis: 'x', material: 'deepslate_tile', gable: 'white_terracotta', ridgeCap: 'deepslate_tile_wall' })
for (const x of [H.x0 - 1, H.x1 + 1]) b.set(x, b.topY(x, 14) + 1, 14, 'lightning_rod[facing=up]')   // finials at the ridge ends
// even width (8): cap the two top rows
b.walls([30, H.F, 10], [37, H.F + 3, 18], 'white_terracotta')
const e = b.roof({ x0: 30, z0: 10, x1: 37, z1: 18, y: H.F + 4, axis: 'z', material: 'spruce', gable: 'white_terracotta' })
for (const [k, c] of e.cells) if (e.base + c.tb === e.topY) { const [x, z] = k.split(',').map(Number); b.set(x, e.topY + 1, z, 'spruce_slab[type=bottom]') }
```

Ridge material: the roof's darker variant or the frame wood. Wall cresting reads strongly against
the sky. Finials: lightning rod, end rod, wall post + slab, `dragon_head` for Viking ridges.

### 1.5 Eaves and overhangs

Overhang 1 by default, 2 on big roofs, 2–4 on East-Asian and alpine roofs (consensus). No overhang
is the most common roof mistake: the roof looks stuck on. Variants (west eave; outside is left):

```text
E1 plain            E2 eaveTrim         E3 fascia           E4 kick             E5 rafter tail      E6 overhang 2
y5               /  y5               /  y5               /  y5               /  y5               /  y5               /
y4            /  p  y4            /  p  y4            /  p  y4            /  p  y4            /  p  y4            /  p
y3         /  #     y3         /  #     y3      T  /  #     y3      _  #  #     y3         /  #     y3         /  #
y2            #     y2         q  #     y2            #     y2      ~     #     y2         X  #     y2      /  p  #
y1            #     y1            #     y1            #     y1            #     y1            #     y1      q     #
```

| Variant | Kit | Notes |
| --- | --- | --- |
| E1 plain | default | minimum acceptable |
| E2 bracket course | `eaveTrim: true` | thick, shadowed edge; the usual choice |
| E3 fascia board | open trapdoors on the eave's outer face | a crisp line; `facing` = outward |
| E4 kick | `pitch: [0.5, 0.5, 1]`, `overhang: 2` | bell-cast; slab + block flatten the last step |
| E5 rafter tails | a log (axis across the wall) under every 2nd eave cell | Alpine, Japanese, rustic |
| E6 deep | `overhang: 2` + `eaveTrim` | inner overhang row gets its soffit automatically |

```js
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 3, H.z1], 'white_terracotta')
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: H.F + 4, axis: 'x', material: 'spruce', gable: 'white_terracotta' })
for (let x = H.x0 - 1; x <= H.x1 + 1; x++) b.set(x, H.F + 3, H.z1 + 2, 'spruce_trapdoor[facing=south,open=true]')   // E3 fascia, south eave
for (let x = H.x0; x <= H.x1; x += 2) b.set(x, H.F + 2, H.z0 - 1, 'stripped_spruce_log[axis=z]')                    // E5 rafter tails, north eave
for (const x of [12, 20]) b.hangingLantern([x, H.F + 3, H.z1 + 1], 0)                                              // lanterns under the eave
```

- The eave course is the best place for a second material: a dark-oak eave under a spruce field,
  stone-brick stairs under deepslate tiles.
- Hang a lantern under every 2nd–3rd bracket on long façades.

### 1.6 Hip, pyramid, low hip

A hip slopes on all four sides (less attic, calmer silhouette); on a square plan it is a pyramid.
Plan of a hip on a 7 × 11 house (stairs face uphill; finish() turns the corner stairs into
`outer_*` shapes along the hips):

```text
z1   v  v  v  v  v  v  v  v  v
z2   >  v  v  v  v  v  v  v  <
z3   >  >  v  v  v  v  v  <  <
z4   >  >  >  v  v  v  <  <  <
z5   >  >  >  >  #  <  <  <  <      # = ridge, length L − W + 1 (odd W)
z6   >  >  >  >  #  <  <  <  <
z7   >  >  >  >  #  <  <  <  <
z8   >  >  >  >  #  <  <  <  <
z9   >  >  >  >  #  <  <  <  <
z10  >  >  >  ^  ^  ^  <  <  <
z11  >  >  ^  ^  ^  ^  ^  <  <
z12  >  ^  ^  ^  ^  ^  ^  ^  <
z13  ^  ^  ^  ^  ^  ^  ^  ^  ^
     1  2  3  4  5  6  7  8  9   <- x
```

```js
b.walls([10, H.F, 10], [16, H.F + 3, 20], 'white_terracotta')
b.roof({ x0: 10, z0: 10, x1: 16, z1: 20, y: H.F + 4, type: 'hip', material: 'dark_oak', eaveTrim: true })
b.walls([22, H.F, 10], [28, H.F + 3, 16], 'white_terracotta')
b.roof({ x0: 22, z0: 10, x1: 28, z1: 16, y: H.F + 4, type: 'pyramid', material: 'deepslate_tile', eaveTrim: true })
b.set(25, b.topY(25, 13) + 1, 13, 'lightning_rod[facing=up]')                         // odd pyramids end in one block: crown it
b.walls([34, H.F, 10], [46, H.F + 3, 20], 'white_terracotta')
b.roof({ x0: 34, z0: 10, x1: 46, z1: 20, type: 'hip', y: H.F + 4, pitch: [1, 1, 0], material: 'spruce', eaveTrim: true })   // low hip
```

- The hip lines are the most visible part: a darker stair or a wall-post hip roll there reads well.
- Pyramids crown towers and pavilions; odd widths end in a single block, so add a finial.
- Hip roofs suit large or formal buildings; the gable is the vernacular default.

### 1.7 Dutch gable (gablet) and half-hip

A hip below with a small gable on top (Dutch gable, Japanese *irimoya*); the reverse, a gable whose
top is clipped by a small hip, is a half-hip. Both only read on buildings larger than a cottage
(wiki); switch at ½–⅔ of the roof height. Dutch gable recipe: a hip over the whole footprint, then a
gable over the footprint shortened at both ends, without rake overhang:

```js
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 3, H.z1 + 6], 'white_terracotta')                 // 13 x 15
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1 + 6, y: H.F + 4, type: 'hip', axis: 'z', material: 'spruce', eaveTrim: true })
b.roof({ x0: H.x0, z0: H.z0 + 3, x1: H.x1, z1: H.z1 + 3, y: H.F + 4, axis: 'z', material: 'spruce', gableOverhang: 0, gable: 'stripped_spruce_log' })   // gablets 3 in
```

Put a vent (trapdoors or a fence lattice) in the gablet on East-Asian halls.

### 1.8 Cross gables, L/T/U plans and valleys

Large footprints need several roof sections (wiki: one roof over more than ~15 × 15 looks like a
barn). Joined roofs share the pitch, and a wing ridge sits ≥ 1 below the main ridge (≥ 2 looks
deliberate; a wing as tall as the main block "is nearly a tower", so make it one).

**Two roofs:** build the main roof first, then the wing roof with its footprint starting at the
main wall line. The kit resolves the valley stairs (inner corners) where the slopes meet.

```js
b.walls([8, H.F, 10], [22, H.F + 3, 18], 'white_terracotta'); b.walls([12, H.F, 18], [18, H.F + 3, 28], 'white_terracotta')
b.roof({ x0: 8, z0: 10, x1: 22, z1: 18, y: H.F + 4, axis: 'x', material: 'spruce', gable: 'spruce_planks', eaveTrim: true })    // main 15 x 9
b.roof({ x0: 12, z0: 18, x1: 18, z1: 28, y: H.F + 4, axis: 'z', material: 'spruce', gable: 'spruce_planks', eaveTrim: true })   // wing 7 wide
```

**One height field (`compoundRoof`):** exact hips, valleys and cross gables over any union of
rectangles (L, T, U, H, courtyard). It lives in `scripts/lib/kit/roofplan.mjs`; where it is not yet a
builder method, import it (path relative to your recipe) and call `compoundRoof(b, opts)`.

```js
import { compoundRoof } from '../../scripts/lib/kit/roofplan.mjs'
export default function build(api) {
  const b = api.builder([80, 40, 60], { seed: 1 })
  const L = [[2, 2, 16, 9], [2, 9, 8, 22]]                                        // L plan, wall-line rectangles
  for (const [x0, z0, x1, z1] of L) b.walls([x0, 0, z0], [x1, 3, z1], 'white_terracotta')
  compoundRoof(b, { rects: L, y: 4, type: 'hip', material: 'spruce', eaveTrim: true })
  const C = [[24, 2, 44, 6], [24, 18, 44, 22], [24, 6, 28, 18], [40, 6, 44, 18]]  // courtyard
  for (const [x0, z0, x1, z1] of C) b.walls([x0, 0, z0], [x1, 3, z1], 'white_terracotta')
  compoundRoof(b, { rects: C, y: 4, type: 'hip', material: 'deepslate_tile', eaveTrim: true })
  const T = [[50, 2, 68, 10], [56, 10, 62, 22]]                                   // T plan with gables
  for (const [x0, z0, x1, z1] of T) b.walls([x0, 0, z0], [x1, 3, z1], 'white_terracotta')
  compoundRoof(b, { rects: T, y: 4, type: 'gable', material: 'dark_oak', gable: 'spruce_planks' })
  return b.finish({ name: 'compound-roofs' })
}
```

Options: `type: 'hip' | 'gable' | 'mixed'`, `gableAxes: ['x', 'z', ...]` per rectangle, plus the
`b.roof` options `material, pitch, overhang, gableOverhang, gable, eaveTrim, underside, ridgeCap`.
Valleys collect water: give them the darkest or mossiest roof blocks when you texture (§1.18).

### 1.9 Gambrel, mansard, bell-cast

```text
gambrel, 13 wide, pitch [2, 2, 2, 0.5]                mansard, 15 x 19, type: 'mansard' (pitch [2, 2, 3, 0.5])
y9                        _                           y12                       _  #  _
y8                  _  #  #  #  _                     y11                 _  #  #  #  #  #  _
y7            _  #  #  #     #  #  #  _               y10           _  #  #  #           #  #  #  _
y6         /  #  #                 #  #  \            y9         /  #  #                       #  #  \
y5         #                             #            y8         #                                   #
y4      /  #                             #  \         y7         #                                   #
y3      #  #                             #  #         y6      /  #                                   #  \
y2   /  #                                   #  \      y5      #  #                                   #  #
                                                      y4   /  #                                         #  \
                                                      y3   q  #                                         #  p
```

- **Gambrel** (barns, Dutch colonial): steep low, shallow high; gable ends. Width 11–15; lengthen
  the steep run on wider barns (`[2, 2, 2, 2, 0.5]`). A hayloft door in the gable under a little
  shed hood is the signature detail.
- **Mansard:** a gambrel hipped on all four sides. The steep lower slope is a storey of its own and
  "will almost certainly have dormers" (wiki). It needs a large footprint (≥ 15 × 19); on small
  plans it reads as a stepped pyramid.
- **Bell-cast:** shallow at the eave, steep above: `pitch: [0.5, 0.5, 1]` (E4) on a gable or hip.
  Curves need a radius ≥ 6 to read as curves (wiki).

```js
b.walls([2, H.F, 10], [14, H.F + 3, 22], 'white_terracotta')
b.roof({ x0: 2, z0: 10, x1: 14, z1: 22, y: H.F + 4, axis: 'z', material: 'dark_oak', pitch: [2, 2, 2, 0.5], gable: 'spruce_planks', eaveTrim: true })   // gambrel
b.walls([20, H.F, 10], [34, H.F + 5, 28], 'stone_bricks')
b.roof({ x0: 20, z0: 10, x1: 34, z1: 28, y: H.F + 6, type: 'mansard', material: 'deepslate_tile', eaveTrim: true })                                  // mansard
b.walls([40, H.F, 10], [48, H.F + 3, 20], 'white_terracotta')
b.roof({ x0: 40, z0: 10, x1: 48, z1: 20, y: H.F + 4, type: 'hip', material: 'spruce', pitch: [0.5, 0.5, 1], overhang: 2, eaveTrim: true })            // bell-cast hip
```

### 1.10 Saltbox, shed, lean-to, porch roof

```text
saltbox: 2 storeys at the front (left), a lean-to continues the rear slope
y11                 /  \
y10              /  p  q  \
y9            /  p        q  \
y8         /  p              q  \
y7      /  #                    #  \
y6         #                    #  q  \
y5         #                    #     q  \
y4         #                    #        q  \
y3         #                    #           q  \
y2         #                    #              #  \
y1         #                    #              #
y0         #                    #              #
     0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16   <- x
```

- **Saltbox:** the lean-to's shed roof shares the main roof's pitch and starts at the main wall, so
  its `y` = main `y` − (distance from the main wall to the lean-to's outer wall).
- **Shed / lean-to:** slopes one way (`type: 'shed'`, `rises` = the high side). For sheds, porches,
  add-ons and modern roofs; rarely the main roof of a house (wiki). Tuck it **under** the main eave.
- **Porch roofs** sit on posts every 2–4 (fence, wall, log), over a floor raised 1 with steps.

```js
// saltbox: main block 9 deep and 2 storeys, lean-to 5 deep and 1 storey behind it (south)
b.walls([10, H.F, 4], [22, H.F + 7, 12], 'white_terracotta'); b.walls([10, H.F, 12], [22, H.F + 2, 17], 'white_terracotta')
b.roof({ x0: 10, z0: 4, x1: 22, z1: 12, y: H.F + 8, axis: 'x', material: 'dark_oak', gable: 'spruce_planks', eaveTrim: true })
b.roof({ x0: 10, z0: 12, x1: 22, z1: 17, y: H.F + 8 - (17 - 12), axis: 'x', type: 'shed', rises: 'north', material: 'dark_oak', gable: 'spruce_planks', eaveTrim: true })
// porch: shed roof under the main eave on fence posts, deck flush with the floor
b.walls([30, H.F, 4], [42, H.F + 5, 12], 'spruce_planks')
b.roof({ x0: 30, z0: 4, x1: 42, z1: 12, y: H.F + 6, axis: 'x', material: 'dark_oak', gable: 'spruce_planks', eaveTrim: true })
b.door([36, H.F, 12], 'south', { material: 'spruce' })
b.box([33, H.F - 1, 13], [39, H.F - 1, 15], 'spruce_planks')
for (const x of [33, 39]) for (let y = H.F; y <= H.F + 2; y++) b.set(x, y, 15, 'spruce_fence')
b.roof({ x0: 33, z0: 13, x1: 39, z1: 15, y: H.F + 3, type: 'shed', axis: 'x', rises: 'north', pitch: [1, 0.5, 0.5], material: 'spruce', overhang: 0, gableOverhang: 0 })
```

Other one-way forms (wiki): **monitor/clerestory** (a raised ridge section with its own windows),
**sawtooth** (glazed steep faces all facing one way), **butterfly** (a V, modern).

### 1.11 Flat roofs, parapets, crow steps

Flat roofs are easy to make and hard to make look right. Never border them with the wall block
(wiki). Code rule: a parapet 1 high + a cap (slab or stair), set flush with or 1 proud of the wall,
and a cornice of upside-down stairs one course below. Break long flat roofs with stair houses,
water tanks, chimneys or pergolas; give big ones a walkway behind a taller parapet.

```js
// flat roof: deck, cornice +1, parapet on the cornice, slab coping
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 5, H.z1], 'stone_bricks')
b.box([H.x0 + 1, H.F + 5, H.z0 + 1], [H.x1 - 1, H.F + 5, H.z1 - 1], 'smooth_stone')
for (let x = H.x0 - 1; x <= H.x1 + 1; x++) for (const z of [H.z0 - 1, H.z1 + 1]) b.set(x, H.F + 5, z, kit.stairs('stone_brick', z < H.z0 ? 'south' : 'north', 'top'))
for (let z = H.z0; z <= H.z1; z++) for (const x of [H.x0 - 1, H.x1 + 1]) b.set(x, H.F + 5, z, kit.stairs('stone_brick', x < H.x0 ? 'east' : 'west', 'top'))
b.walls([H.x0 - 1, H.F + 6, H.z0 - 1], [H.x1 + 1, H.F + 6, H.z1 + 1], 'stone_bricks')
b.walls([H.x0 - 1, H.F + 7, H.z0 - 1], [H.x1 + 1, H.F + 7, H.z1 + 1], 'stone_brick_slab[type=bottom]')
// crow-stepped gables: roof without rake overhang, gable walls raised in 2-wide steps with slab caps
b.walls([30, H.F, 10], [40, H.F + 5, 20], 'bricks')
const r = b.roof({ x0: 30, z0: 10, x1: 40, z1: 20, y: H.F + 6, axis: 'z', material: 'deepslate_tile', gableOverhang: 0, gable: 'bricks' })
for (const zg of [10, 20]) for (let x = 30; x <= 40; x += 2) {
  let top = 0
  for (const xx of [x, x + 1]) { const c = r.cells.get(`${xx},${zg}`); if (c) top = Math.max(top, r.base + c.tb) }
  for (const xx of [x, x + 1]) { if (xx > 40) continue; for (let y = H.F + 6; y <= top + 1; y++) b.set(xx, y, zg, 'bricks'); b.set(xx, top + 2, zg, 'stone_brick_slab[type=bottom]') }
}
```

Crow steps are North European (Flemish, Scottish, Hanseatic); steps 1 up per 1–2 in, capped. A
parapet gable can also run straight up the rake, capped with a stair line. Terraced houses share
walls that rise through the roof (party-wall parapets).

### 1.12 Helm roof

A square tower with four gables and four diamond faces meeting at a point (Rhenish helm). It
works on odd widths (wiki). Recipe: each column rises to `apex − (|dx| + |dz|)`, so the wall lines
rise into gables at the mid-sides and the faces are diamonds.

```js
const cx = 23, cz = 15, A = H.F + 16                                             // 7 x 7 tower, walls to H.F + 8
b.walls([cx - 3, H.F, cz - 3], [cx + 3, H.F + 8, cz + 3], 'stone_bricks')
for (let x = cx - 3; x <= cx + 3; x++) for (let z = cz - 3; z <= cz + 3; z++) {
  const top = A - (Math.abs(x - cx) + Math.abs(z - cz))
  const onWall = Math.abs(x - cx) === 3 || Math.abs(z - cz) === 3
  for (let y = H.F + 9; y <= top; y++) b.set(x, y, z, onWall && y < top ? 'stone_bricks' : 'deepslate_tiles')
}
b.set(cx, A + 1, cz, 'lightning_rod[facing=up]')
```

### 1.13 Cones and spires

`b.coneRoof([cx, y, cz], radius, { material, pitch, overhang, flare, finial })`: `y` = the level
above the tower's wall top, `radius` = the tower's radius (as passed to `b.tube`). The pitch list
works as in `b.roof` (from the eave in; keep the wall-line level whole):

```text
[0.5, 0.5, 2]                            flare: false (pitch 2)                   [1, 1, 2, 2, 3, 3, 3]
y16                                      y16                                      y16                    #
y15                                      y15                                      y15                    #
y14                    #                 y14                    #                 y14                    #
y13                    #                 y13                    #                 y13                 /  #  \
y12                 /  #  \              y12                 /  #  \              y12                 #  #  #
y11                 #  #  #              y11                 #  #  #              y11                 #     #
y10              /  #     #  \           y10              /  #     #  \           y10              /  #     #  \
y9               #  #     #  #           y9               #  #     #  #           y9               #  #     #  #
y8            /  #           #  \        y8            /  #           #  \        y8            /  #           #  \
y7            #  #           #  #        y7            #  #           #  #        y7            #  #           #  #
y6      _  #  #                 #  #  _  y6         /  #                 #  \     y6         /  #                 #  \
y5            #                 #        y5         #  #                 #  #     y5      /     #                 #     \
y4            #                 #        y4      /  #  #                 #  #  \  y4            #                 #
     flared eave, steep cone                  plain steep cone                         concave witch hat
```

```js
for (const [x, pitch] of [[12, [0.5, 0.5, 2]], [26, 2], [40, [1, 1, 2, 2, 3, 3, 3]]]) {
  b.tube([x, H.F, 14], 3.5, 10, 'stone_bricks')                                  // d = 7 tower
  b.coneRoof([x, H.F + 10, 14], 3.5, { material: 'deepslate_tile', pitch, flare: false, finial: ['lightning_rod[facing=up]'] })
}
```

- Cone base = tower + 1–2 all round (the kit's `overhang`). Keep ring diameters all odd (integer
  centre) or all even (`.5` centre), never mixed (wiki).
- Spire steepness: rises 3–5 per ring step for church spires (`pitch: 3`); witch hats are concave:
  shallow rows at the bottom, steep at the top.
- Finials: `lightning_rod`, `end_rod`, a wall post + chain, a banner on a fence.
- Octagonal spire on a square tower (broach): build the cone on the square's inscribed circle and
  fill the four corners with small pyramids of stairs.

### 1.14 Domes and onion domes

`b.lathe([cx, y0, cz], height, (dy, t) => radius, paint)` revolves any profile; `t` runs 0 → 1 up
the height. `kit.onionProfile(r, h)` is a ready onion.

```js
b.tube([14, H.F, 14], 4.5, 8, 'smooth_quartz')                                                   // drum d = 9
b.lathe([14, H.F + 8, 14], 6, (dy) => Math.sqrt(Math.max(0, 25 - (dy + 0.5) ** 2)), 'oxidized_cut_copper')   // hemisphere r 5
b.set(14, H.F + 14, 14, 'lightning_rod[facing=up]')
b.tube([32, H.F, 14], 3.5, 9, 'white_terracotta')                                                // drum d = 7
b.lathe([32, H.F + 9, 14], 10, kit.onionProfile(3.5, 10), 'gold_block')                          // onion: bulge, then a long taper
b.set(32, H.F + 19, 14, 'lightning_rod[facing=up]')
```

- **Dome rings** by hand (diameter per layer from the base, wiki-style): d 9: 9, 9, 9, 7, 5;
  d 11: 11, 11, 11, 9, 7, 5; d 13: 13, 13, 13, 11, 11, 9, 5; d 17: 17, 17, 17, 15, 15, 13, 13, 9, 5.
- **Segmental dome:** only the top rows of a larger circle (a low dome over a wide hall).
  **Surmounted dome:** repeat the base diameter 2–4 times (a drum).
- **Onion:** bulge ≈ drum + 2 (about +25%), then a fast taper and a spire. Gold, copper, cut red
  sandstone or prismarine; stripes in a second block on every 3rd ring.
- Finish with a lantern (3×3 open drum + mini dome), ribs on 4 or 8 meridians, waxed copper for
  a fixed patina in game.

### 1.15 East-Asian roofs

Concave roofs are the hardest shape to model (wiki); approximate the curve with a pitch list and
lift the corners. Profile: flat slabs at the eave, 1:1 over the walls, 2:1 near the ridge;
overhang 2–4 with bracket sets under it.

```text
y11                          #
y10                       /  #  \
y9                     /  p     q  \
y8                     #           #
y7                  /  #           #  \
y6               /  p  #           #  q  \
y5            /  p                       q  \
y4      _  #  #                             #  #  _       eave: slab, block, then stairs
y3      ~     #                             #     ~       eaveTrim under the slab: top slab
y2            #                             #
     1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17   <- x
```

```js
const A = { x0: 8, z0: 8, x1: 18, z1: 22 }
b.walls([A.x0, H.F, A.z0], [A.x1, H.F + 4, A.z1], 'white_terracotta')
b.roof({ ...A, y: H.F + 5, type: 'hip', material: 'deepslate_tile', pitch: [0.5, 0.5, 1, 1, 1, 2, 1], overhang: 2, eaveTrim: true })
const ex0 = A.x0 - 2, ex1 = A.x1 + 2, ez0 = A.z0 - 2, ez1 = A.z1 + 2, eaveY = b.topY(ex0 + 4, ez0)
for (const [cx, cz, sx, sz] of [[ex0, ez0, 1, 1], [ex1, ez0, -1, 1], [ex0, ez1, 1, -1], [ex1, ez1, -1, -1]]) {
  b.set(cx, eaveY + 1, cz, 'deepslate_tile_slab[type=bottom]')                                  // corner tip: up 1
  for (const [x, z] of [[cx + sx, cz], [cx, cz + sz]]) b.set(x, eaveY, z, 'deepslate_tiles')     // its neighbours: up 0.5
}
```

- **Upturned corners:** the last 2–3 eave cells before each corner rise in half steps (above).
- **Irimoya** (hip-and-gable): add a gablet (§1.7) with a lattice of fences or trapdoors.
- **Pagoda tiers:** each tier inset 1–2 per side, its own flared eave, tier heights falling
  (5, 4, 4, 3, 3), a spire of walls, fences, end rods and chains on top. See
  [styles.md §5](styles.md#5-east-asian).
- **Palette:** dark roof (`deepslate_tile`, `dark_prismarine`, `blackstone`, L\* 15–36), red posts
  (`stripped_mangrove_log` 32, `mangrove_planks`), pale walls (`white_terracotta`, `birch_planks`).

### 1.16 Thatch and sod

`hay_block` thatch: axis down the slope, ≥ 45°, one uninterrupted roof without cross gables (wiki),
moss as the weathering step (Conquest), a defined shape, "not a shapeless blob" (WesterosCraft).
Thatch has no stairs, so the roof is stepped full blocks, 2 thick, with a ridge roll:

```text
y9                     _              ridge roll (slab)
y8                     X
y7                  X  X  X
y6               X  X     X  X        X = hay_block[axis=x]: straw runs down the slope
y5            X  X           X  X
y4         X  X                 X  X
y3      X  #                       #  X
y2      X  #                       #  X
     0  1  2  3  4  5  6  7  8  9 10 11 12   <- x
```

```js
// stepped full-block roof, ridge along z, odd width x0..x1 (thatch, sod, snow)
function steppedRoof(x0, x1, z0, z1, y, paint, gable, ridge) {
  const half = (x1 - x0) / 2
  for (let i = 0; i <= half + 1; i++) for (let z = z0 - 1; z <= z1 + 1; z++) for (const x of [x0 - 1 + i, x1 + 1 - i]) {
    b.set(x, y - 1 + i, z, paint)                                                   // 1 up and 1 in per row
    b.set(x, y - 2 + i, z, paint, { keep: true })                                   // 2 thick
    if (x > x0 && x < x1 && (z === z0 || z === z1)) for (let yy = y; yy < y - 2 + i; yy++) b.set(x, yy, z, gable)
  }
  for (let z = z0 - 1; z <= z1 + 1; z++) b.set(x0 + half, y + half + 1, z, ridge)
}
b.walls([2, H.F, 10], [10, H.F + 3, 20], 'oak_planks')
steppedRoof(2, 10, 10, 20, H.F + 4, 'hay_block[axis=x]', 'oak_planks', 'spruce_slab[type=bottom]')              // thatch
b.walls([18, H.F, 10], [26, H.F + 3, 20], 'spruce_planks')
steppedRoof(18, 26, 10, 20, H.F + 4, kit.palette({ moss_block: 3, grass_block: 2 }), 'spruce_planks', 'moss_carpet')  // sod roof
```

Sod and green roofs (moss, grass, azalea leaves) suit Nordic and hobbit styles (wiki).

### 1.17 Dormers

`b.dormer([cx, y0, cz], facing, { width, height, depth, material, wall, window })` builds a gable
dormer: front wall bottom-centre on the slope 0–2 rows in from the wall line, `y0` = the roof level
there, `facing` = the slope's outward direction. Build it after the main roof. It runs back until
the main roof covers its ridge, clears the attic behind its window from the lowest dormer-roof
block down, and only the front wall extends down to the roof; it warns if it is too tall.

```js
b.walls([2, H.F, 10], [18, H.F + 4, 20], 'white_terracotta')
b.roof({ x0: 2, z0: 10, x1: 18, z1: 20, y: H.F + 5, axis: 'x', material: 'spruce', gable: 'spruce_planks', eaveTrim: true })
b.dormer([6, H.F + 5, 20], 'south', { material: 'spruce', wall: 'spruce_planks', width: 3, height: 3 })              // on the wall line
b.dormer([14, H.F + 6, 19], 'south', { material: 'dark_oak', wall: 'stripped_spruce_log', width: 3, height: 2 })     // one row in
```

- Outer width 3 (1-wide window) or 5 (3-wide window); ridge ≥ 1 below the main ridge.
- Align dormers with the bays and windows below; odd counts, symmetric on formal fronts; at most
  one per 4–6 blocks of roof length. Use them on every large roof (wiki: avoid "a large expanse of
  blank sloping roof").
- Types: gable (kit), shed (a `type: 'shed'` roof over a box), hipped, eyebrow, wall dormer (the
  façade continues up through the eave), blind dormer (decorative only).

### 1.18 Roof materials and texture

- **Wood roofs use ≥ 2 woods** (WesterosCraft), discoloured with logic: bleached at the ridge
  (sun), darker and mossy at eaves and valleys (water). `b.texture` keeps stair and slab shapes:

```js
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 3, H.z1], 'white_terracotta')
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: H.F + 4, axis: 'z', material: 'spruce', gable: 'spruce_planks', eaveTrim: true })
b.texture([H.x0 - 2, H.F + 2, H.z0 - 2], [H.x1 + 2, H.F + 12, H.z1 + 2], ['oak', 'spruce', 'dark_oak'],
  { only: ['spruce_stairs', 'spruce_slab', 'spruce_planks'], base: 0.35, edge: 0.1, drip: 0.05, scale: 4, seed: 3 })
```

| Look | Main (≈ 70%) | Mix-ins (20–30%) | Accent ≤ 10% |
| --- | --- | --- | --- |
| Slate | `deepslate_tile` 23 | `cobbled_deepslate` 33, `polished_deepslate` 31 | `blackstone` 15, `deepslate_brick` 30 |
| Dark wood | `dark_oak` 20 | `spruce` 38 | `mangrove` 31 |
| Warm wood | `spruce` 38 | `oak` 57 at the ridge, `dark_oak` at the eaves | `jungle` 52 |
| Clay tile | `brick` 47 | `granite` 48, `polished_granite` 50 | `mud_brick` 47 |
| Old stone | `stone_brick` 51 | `mossy_stone_brick` 50, `cobblestone` 53 | `mossy_cobblestone` 49 |
| Copper | `waxed_weathered_cut_copper` | `waxed_exposed_cut_copper`, `waxed_oxidized_cut_copper` | oxidised at eaves and drips |
| Nether | `nether_brick` 11 | `red_nether_brick` | `blackstone` |

Names are material families for `b.roof` / `b.texture`; numbers are L\* of the full block.
Blocks without stairs (terracotta, concrete, wool, calcite) have no sloped form of their own:
`b.roof` substitutes the nearest family's stairs, so for the exact colour build a stepped roof of
full blocks (§1.16). Keep ≥ 20 L\* between roof and walls ([principles.md §9](principles.md#9-contrast-and-value-roles)).
Castles get slate or flat roofs, not wood (Minecraft Forum castle guide). Low-contrast patterns (a
darker course every N rows) repeated across a settlement add flavour.

### 1.19 Roof checklist

- Roof 1–2 storeys tall, 40–60% of the vernacular façade; sections ≤ 15 × 15.
- Overhang ≥ 1 on every edge (eaves and rakes); `eaveTrim` or another finished edge.
- One pitch per family of faces that meet; ridges level; secondary ridges ≥ 1 lower.
- Even widths capped; odd widths for steep roofs, helms and spires.
- Render the roof from above at 45° (`--pitch 50`): notches in hips or valleys mean a stair was
  overwritten by hand; check `--views top` for holes.
- The roofline is broken at least 2–3 times on a medium house (chimney, dormer, cross gable, tower).

---

## 2. Walls

### 2.1 Timber framing

Half-timbered, Tudor, Fachwerk (sources: PirateMC, Blockwerks, game.guide, WesterosCraft).

```text
y10  X  X  X  X  X  X  X  X  X  X  X  X  X     top plate under the eave (log along the wall)
y9   |  q  #  p  |  q  #  p  |  q  #  p  |     knee braces: upside-down stairs, leg against the post
y8   |  #  G  #  |  #  G  #  |  #  G  #  |     | posts every 4 (logs axis=y), # infill, G 1x2 windows
y7   |  #  G  #  |  #  G  #  |  #  G  #  |
y6   X  X  X  X  X  X  X  X  X  X  X  X  X     sill beam of the upper floor
y5   X  X  X  X  X  X  X  X  X  X  X  X  X     jetty beam: upper floor 1 proud of the stone below
y4   k           k           k           k     k = bracket under each post (upside-down stair, leg on the wall)
y3   s  s  s  s  s  s  s  s  s  s  s  s  s     stone ground floor (door below)
     0  1  2  3  4  5  6  7  8  9 10 11 12
```

- **Frame first, infill one block behind it** (or posts pushed out 1): the recess is the depth.
  `b.timberWall` builds frame and infill on one plane; the recessed version is in
  [principles.md §6](principles.md#6-depth).
- **Posts:** corners always, then every 3–5 (box framing: pitch 4, square 3×3 or 3×4 panels).
  Close studding (pitch 2) on the upper floor only reads as wealth (convention).
- **Beams:** a continuous ring at the sill, every floor line and the top plate (`axis` along the run;
  `*_wood` where bark should show on every face).
- **Braces:** knee braces (upside-down stairs in the top corners of a bay, leg on the post) in any
  bay; diagonal log braces only in bays ≥ 4 wide (`braces: true` puts them in the end bays,
  `'all'` in every bay, mirrored).
- **Jetty:** each upper floor 1 wider on the street side, a bracket under every post, joist ends
  between them.
- **Contrast:** frame vs infill ΔL\* 40–60 (`stripped_dark_oak_log` 25 / `calcite` 89). Infill
  solid or with one close neighbour ≤ 20% (`calcite` + `white_terracotta`). Brick nogging
  (`bricks`) and wattle (`packed_mud`) are darker alternatives.
- **Ground floor in stone, upper floors in timber** is the most common medieval combination.

```js
const S = H.z1 + 1, y0 = H.F + 5, y1 = H.F + 9                                          // upper storey jettied 1 to the south
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 3, H.z1], kit.palette({ cobblestone: 5, stone: 2, mossy_cobblestone: 1 }))
b.box([H.x0, H.F + 4, H.z0], [H.x1, H.F + 4, S], 'spruce_planks')                       // upper floor, projecting 1
for (let x = H.x0; x <= H.x1; x++) b.set(x, H.F + 4, S, 'stripped_dark_oak_log[axis=x]') // jetty beam
for (const [a, c] of [[[H.x0, y0, S], [H.x1, y1, S]], [[H.x0, y0, H.z0], [H.x1, y1, H.z0]],
                      [[H.x0, y0, H.z0], [H.x0, y1, S]], [[H.x1, y0, H.z0], [H.x1, y1, S]]])
  b.timberWall(a, c, { frame: 'stripped_dark_oak_log', infill: kit.palette({ calcite: 5, white_terracotta: 1 }), postEvery: a[2] === c[2] ? 4 : 3 })
for (let x = H.x0; x <= H.x1; x += 4) {
  b.set(x, H.F + 3, S, 'dark_oak_stairs[facing=north,half=top]')                       // bracket under each post, leg on the wall
  if (x > H.x0) b.set(x - 1, y1 - 1, S, 'dark_oak_stairs[facing=east,half=top]')       // knee braces, leg on the post
  if (x < H.x1) b.set(x + 1, y1 - 1, S, 'dark_oak_stairs[facing=west,half=top]')
}
for (const x of [12, 16, 20]) b.window([x, y0 + 1, S], 'south', { width: 1, height: 2, sill: false })
b.door([16, H.F, H.z1], 'south', { material: 'spruce', frame: 'stripped_dark_oak_log' })
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: S, y: y1 + 1, axis: 'x', material: 'deepslate_tile', gable: 'calcite', eaveTrim: true })
```

### 2.2 Stone and brick walls

Horizontal depth: plinth, water table, stringcourse, cornice; vertical depth: pilasters, quoins,
buttresses. Section through the wall below (seen from the west; outside is right):

```text
y11           #  p    cornice step 2: block + upside-down stair (+2)
y10  #  #  #  p       cornice step 1 (+1)
y9   #  #  #
y8   #  #  #
y7   #  #  #
y6   #  #  #  p       stringcourse at the floor line (+1)
y5   #  #  #
y4   #  #  #
y3   #  #  #
y2   #  #  #  \       water table: stair, tall side on the wall, sheds water outward
y1   #  #  #  #       plinth course (+1)
    16 17 18 19 20   <- z (south ->)
```

```js
const T = H.F + 9                                                                        // wall top
b.box([H.x0, H.F, H.z1 - 2], [H.x1, T, H.z1], kit.palette({ bricks: 6, granite: 1 }))   // 3-thick brick wall, face z = H.z1
const o = H.z1 + 1                                                                       // the +1 layer
for (let x = H.x0; x <= H.x1; x++) {
  b.set(x, H.F, o, 'stone_bricks')                                                     // plinth
  b.set(x, H.F + 1, o, 'stone_brick_stairs[facing=north,half=bottom]')                 // water table
  b.set(x, H.F + 5, o, 'smooth_sandstone_stairs[facing=north,half=top]')               // stringcourse
  b.set(x, T, o, 'smooth_sandstone_stairs[facing=north,half=top]')                     // cornice step 1
  b.set(x, T + 1, o, 'smooth_sandstone'); b.set(x, T + 1, o + 1, 'smooth_sandstone_stairs[facing=north,half=top]')   // step 2
}
for (let y = H.F; y <= T; y++) for (const [cx, dir] of [[H.x0, 1], [H.x1, -1]]) {        // quoins: long and short in turn
  b.set(cx, y, H.z1, 'smooth_sandstone')
  if ((y - H.F) % 2 === 0) b.set(cx + dir, y, H.z1, 'smooth_sandstone')                // long on the front face...
  else b.set(cx, y, H.z1 - 1, 'smooth_sandstone')                                      // ...then long on the side face
}
for (const x of [14, 18]) for (let y = H.F + 2; y <= H.F + 4; y++) b.set(x, y, o, 'stone_bricks')   // pilasters on the ground floor
for (const x of [12, 16, 20]) b.window([x, H.F + 6, H.z1], 'south', { width: 1, height: 2, recess: 1, material: 'smooth_sandstone' })
```

- **Plinth / water table:** the bottom 1–2 courses +1, topped by a stair with its tall side on the
  wall. This is what makes a wall look grounded.
- **Stringcourse** at each floor line: flush in a contrasting block, or +1 with upside-down stairs.
- **Cornice:** 1–2 stepped courses of upside-down stairs (+1, +2) under the eave or parapet.
- **Pilasters / piers** every 4–6, +1, in a smoother or darker stone than the field.
- **Quoins:** long and short blocks alternating at the corners, in a contrasting stone; the side
  face takes the long block where the front has the short one.
- **Dressings on brick:** brick (L\* 47) is busy at size; break it with light stone quoins, sills,
  lintels and bands (`smooth_sandstone` 86, `polished_andesite` 56) and mix ≤ 15% `granite` /
  `terracotta` (46–50) for weathering.
- **Tapered walls:** castles and cathedrals thicken at the base (wiki): a battered base +1 for the
  bottom 2–4 courses, or a step-in of 1 every 1–2 storeys with a weathering stair course.
- **Stone ladders** (base → field → trim): `mossy_cobblestone` → `cobblestone` → `stone_bricks` →
  `polished_andesite`; `cobbled_deepslate` → `deepslate_bricks` → `tuff_bricks` → `stone_bricks`;
  desert `terracotta` → `cut_sandstone` → `smooth_sandstone` (more in [palettes.md](palettes.md)).

### 2.3 Plaster, planks and others

- **Plaster** (`calcite`, `white_terracotta`, `mushroom_stem`) stays calm; texture goes into the
  frame, the base and the bottom 1–2 courses (splash of `packed_mud` or darker stone).
- **Planks:** one plank colour alone reads unfinished (WesterosCraft); mix two woods ≥ 15 L\* apart
  in different roles, or use horizontal stripped logs (`axis=x|z`) as clapboard and vertical ones as
  board-and-batten.
- **Two-tone walls:** darker below, lighter above, a band between; a small kink in the band reads as
  craft (wiki *Walls and buttresses*).

### 2.4 Wall depth menu

Pick 1–2 per building (WesterosCraft: stacking all of them is "cumbersome and thick"):

| Recipe | Depth | Best for |
| --- | --- | --- |
| Frame proud, infill −1 | posts and beams at 0 | timber framing |
| Pilasters every 4–6 | +1 piers on a flush field | stone, classical, brick |
| Plinth + stringcourse + cornice | horizontal bands | brick, stone, civic |
| Recessed panels | infill −1 in each bay, windows framed by stairs | civic, palaces |
| Blind arcade | arch shapes −1 in a darker block along a long wall | Romanesque, Gothic |
| Buttresses | +1–2 every bay | castles, churches, barns |
| Battered base | +1 for 2–4 courses with a stair top | fortifications |

### 2.5 Buttresses

Types: angled (two at 90° at a corner), setback, clasping (wrapping the corner), diagonal (one at
45° at the corner), flying (a pier away from the wall plus an arched flyer). Space them with the bay
rhythm (every 4–6, between windows); depth 1–3 at the base, stepping in by 1 with a weathering stair
every 3–6 of height; top them with pinnacles.

```text
setback buttress (seen from the west)      flying buttress (seen from the west)
                                           y17  #  #
                                           y16  #  #  \
                                           y15  #  #  q  \
y14     #  #                               y14  #  #     q  \        i
y13     #  #                               y13  #  #        q  \     !
y12     #  #                               y12  #  #           q  \  !
y11     #  #  \                            y11  #  #              q  #  #
y10     #  #  #                            y10  #  #                 #  #
y9      #  #  #                            y9   #  #                 #  #
y8      #  #  #                            y8   #  #                 #  #
y7      #  #  #                            y7   #  #                 #  #
y6      #  #  #  \                         y6   #  #                 #  #
y5      #  #  #  #                         y5   #  #                 #  #
y4      #  #  #  #                         y4   #  #                 #  #
y3      #  #  #  #                         y3   #  #                 #  #
y2      #  #  #  #                         y2   #  #                 #  #
y1      #  #  #  #                         y1   #  #                 #  #
    19 20 21 22 23 24   <- z (south ->)        40 41 42 43 44 45 46 47 48   <- z (south ->)
```

```js
// setback buttresses, every 5 on a 14-tall wall (face z = 21)
b.box([H.x0, H.F, 20], [H.x0 + 20, H.F + 13, 21], kit.palette({ stone_bricks: 6, andesite: 2, cracked_stone_bricks: 1 }))
for (let x = H.x0 + 2; x <= H.x0 + 18; x += 5) {
  b.box([x, H.F, 22], [x, H.F + 4, 23], 'stone_bricks')                                   // 2 deep at the base
  b.set(x, H.F + 5, 23, 'stone_brick_stairs[facing=north,half=bottom]')                  // weathering, tall side on the wall
  b.box([x, H.F + 5, 22], [x, H.F + 9, 22], 'stone_bricks')                               // 1 deep above
  b.set(x, H.F + 10, 22, 'stone_brick_stairs[facing=north,half=bottom]')
}
// flying buttresses on a 18-tall clerestory wall (face z = 41)
b.box([H.x0, H.F, 40], [H.x0 + 10, H.F + 17, 41], 'stone_bricks')
for (const x of [H.x0 + 2, H.x0 + 7]) {
  b.box([x, H.F, 47], [x, H.F + 10, 48], 'stone_bricks')                                  // pier, 6 out from the wall
  b.set(x, H.F + 11, 47, 'stone_brick_wall'); b.set(x, H.F + 12, 47, 'stone_brick_wall'); b.set(x, H.F + 13, 47, 'end_rod[facing=up]')
  for (let i = 0; i < 5; i++) {                                                           // flyer rising 1:1 toward the wall
    b.set(x, H.F + 11 + i, 46 - i, 'stone_brick_stairs[facing=north,half=bottom]')
    b.set(x, H.F + 10 + i, 46 - i, 'stone_brick_stairs[facing=south,half=top]')          // soffit, facing down-slope
  }
}
```

The flyer lands just below the eave or parapet; put a pilaster strip on the wall there. The aisle
roof runs under the flyers.

---

## 3. Windows

### 3.1 Size and placement

| Tier | Window | Notes |
| --- | --- | --- |
| Cottage | 1×1 (attic, stairs), 1×2 | shutters on 1×2 |
| Manor / showcase | 2×2, 2×3 | frame + sill + lintel |
| Hall, civic | 3×4 and up, arched | mullions every 2–3 columns |
| Gothic lancet | 1×3 – 2×5 | height ≥ 2.5 × width |

- Sill 1 above the floor; heads level with the door head; one window per bay, centred, stacked
  across floors ([principles.md §5](principles.md#5-façade-composition)).
- **Panes over glass blocks** in houses (a 7 px reveal); full `glass` set back 1 or in greenhouses.
- Clear glass shows the room behind it: furnish it, or use `gray_stained_glass_pane`,
  `brown_stained_glass_pane` or `black_stained_glass_pane` so windows read as dark openings.
- **One window kit per building**, repeated (e.g. frame + sill + shutters on the ground floor,
  frame + sill upstairs, a plain lancet in the gable). Kits and micro-modules:
  [detailing.md §6](detailing.md#6-micro-modules).
- Match the style: a round window on a timber cottage reads foreign; an arch is neutral (wiki).

### 3.2 `b.window`

`b.window(pos, facing, opts)`: `pos` = the bottom-left opening cell **seen from outside**, on the
wall plane; the width extends to the viewer's right; `facing` = the wall's outward direction.

| Option | Default | Effect |
| --- | --- | --- |
| `width`, `height` | 1, 2 | opening size |
| `glass` | `glass_pane` | any pane or block |
| `frame` | none | ring of this block around the opening (in the wall plane) |
| `sill` | `true` | upside-down stair of `material` under the opening, outside; or a paint; `false` |
| `lintel` | `false` | bottom slab row above the opening, outside; or a paint |
| `shutters` | none | `true` = the material's trapdoor, open, either side |
| `flowerBox` | `false` | rooted dirt + flowers + trapdoor faces below the sill line |
| `recess` | 0 | glass that many cells deeper (needs a wall that thick, or sits in the room's first cell) |
| `arch` | `false` | upside-down stairs in the top corners (width ≥ 2) |
| `mullion` | none | centre column paint (width ≥ 3) |
| `material` | `spruce` | family for sill, arch stairs, trapdoors |

```text
section through a recessed window in a 2-thick wall (seen from the west; outside right)
y4         #  #  _      lintel slab
y3         G            pane 1 behind the face (recess: 1)
y2         G            shutters sit beside the opening, in front of the wall
y1         #  #  p      sill: upside-down stair, leg on the wall
    15 16 17 18 19   <- z (south ->)
```

```js
b.box([0, H.F, H.z1], [60, H.F + 8, H.z1], 'calcite'); b.box([0, H.F, H.z1 - 1], [60, H.F + 8, H.z1 - 1], 'spruce_planks')   // 2-thick wall
b.window([3, H.F + 2, H.z1], 'south', { width: 1, height: 2 })                                                                    // plain, sill
b.window([9, H.F + 2, H.z1], 'south', { width: 2, height: 2, frame: 'stripped_spruce_log', shutters: true })                       // framed, shutters
b.window([16, H.F + 2, H.z1], 'south', { width: 2, height: 2, recess: 1, flowerBox: true, lintel: true })                         // reveal, flower box
b.window([23, H.F + 2, H.z1], 'south', { width: 3, height: 3, frame: 'stone_bricks', arch: true, mullion: 'spruce_fence', material: 'stone_brick' })
```

### 3.3 Round, lancet, rose and bay windows

```text
oculus 3x3            lancet 2x5             rose 5x5 (cross mullion)
                      y7  # # # #
                      y6  # p q #            y6  # # # # # # #
y4  # # # # #         y5  # G G #            y5  # p G ! G q #
y3  # p G q #         y4  # G G #            y4  # G G ! G G #
y2  # G G G #         y3  # G G #            y3  # ! ! ! ! ! #
y1  # \ G / #         y2  # G G #            y2  # G G ! G G #
y0  # # # # #         y1  # G G #            y1  # \ G ! G / #
                      y0  # # # #            y0  # # # # # # #
seen from the south; corner stairs in the wall plane, glass one block behind;
every stair faces away from the opening centre
```

```js
b.box([0, H.F, 20], [40, H.F + 10, 21], 'stone_bricks')                          // 2-thick wall, face z = 20 (north)
// oculus 3x3: corner stairs in the face, panes behind
for (const [x, y, s] of [[3, 5, 'facing=west,half=top'], [5, 5, 'facing=east,half=top'], [3, 3, 'facing=west,half=bottom'], [5, 3, 'facing=east,half=bottom']])
  b.set(x, H.F + y, 20, `stone_brick_stairs[${s}]`)
for (const [x, y] of [[4, 5], [3, 4], [4, 4], [5, 4], [4, 3]]) b.set(x, H.F + y, 20, 'air')
b.box([3, H.F + 3, 21], [5, H.F + 5, 21], 'glass_pane')
// lancet 2x5 with a pointed head
b.box([10, H.F + 1, 20], [11, H.F + 5, 20], 'air'); b.box([10, H.F + 1, 21], [11, H.F + 6, 21], 'glass_pane')
b.set(10, H.F + 6, 20, 'stone_brick_stairs[facing=west,half=top]'); b.set(11, H.F + 6, 20, 'stone_brick_stairs[facing=east,half=top]')
// rose 5x5: rounded by corner stairs, cross mullion of walls, coloured glass behind
b.box([16, H.F + 3, 20], [20, H.F + 7, 20], 'air'); b.box([16, H.F + 3, 21], [20, H.F + 7, 21], 'red_stained_glass_pane')
for (const [x, y, s] of [[16, 7, 'facing=west,half=top'], [20, 7, 'facing=east,half=top'], [16, 3, 'facing=west,half=bottom'], [20, 3, 'facing=east,half=bottom']])
  b.set(x, H.F + y, 20, `stone_brick_stairs[${s}]`)
for (let y = 3; y <= 7; y++) b.set(18, H.F + y, 20, 'stone_brick_wall')
for (let x = 16; x <= 20; x++) b.set(x, H.F + 5, 20, 'stone_brick_wall')
```

Large Gothic windows: mullions (wall posts or fences) every 2–3 columns, tracery from stairs at the
head, `b.window({ arch: true, mullion })` for a 3-wide unit. Rose windows: d 7–13 discs of stained
glass with radial mullions.

**Bay window:** 3–5 wide, projecting 1–2, full height from the ground (bay) or corbelled out on
upside-down stairs from an upper floor (oriel). Give it its own roof (a slab cap or a mini
hip/shed) and a base.

```js
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 4, H.z1], 'white_terracotta')
const bx = 14, z = H.z1                                                          // canted bay, 5 wide, 2 deep
b.box([bx, H.F, z], [bx + 4, H.F + 2, z], 'air')
for (let y = H.F; y <= H.F + 2; y++) {
  b.set(bx, y, z + 1, 'glass_pane'); b.set(bx + 4, y, z + 1, 'glass_pane')        // canted sides
  for (let x = bx + 1; x <= bx + 3; x++) b.set(x, y, z + 2, 'glass_pane')          // front
}
b.box([bx, H.F - 1, z + 1], [bx + 4, H.F - 1, z + 1], 'spruce_planks'); b.box([bx + 1, H.F - 1, z + 2], [bx + 3, H.F - 1, z + 2], 'spruce_planks')
b.box([bx, H.F + 3, z + 1], [bx + 4, H.F + 3, z + 1], 'spruce_slab[type=bottom]'); b.box([bx + 1, H.F + 3, z + 2], [bx + 3, H.F + 3, z + 2], 'spruce_slab[type=bottom]')
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: H.F + 5, axis: 'x', material: 'spruce', gable: 'white_terracotta', eaveTrim: true })
```

---

## 4. Doors, entrances, porches

- **A door is never a bare hole in a flat wall** (the most beginner-looking element): give it at
  least a frame (posts + lintel) and a step or threshold. Recess it into the wall (consensus).
- **Entrances get more detail than windows** (Craftdex): they are the eye-level focal point.
  Lanterns beside the door, a bench, a planter (Blockwerks).
- Door 1×2; double doors in an even-width bay; grand entrances 3–5 wide, arched, the door 1–2 back,
  a tympanum (planks or a window) in the arch, steps in front.
- Materials: spruce / dark oak (medieval), oak / birch (light cottage), iron (prison, industrial),
  copper (steampunk), cherry / bamboo / mangrove (fantasy, East-Asian). `open: true` on shops and inns.

`b.door(pos, facing, { material, width: 1 | 2, hinge, open, frame, awning, steps })`: `pos` = the
lower door cell (bottom-left seen from outside for a double door); `frame` rings it; `awning: true`
puts a stair row above it, outside; `steps: true` puts a stair below the threshold, outside.

```js
b.walls([H.x0, H.F, H.z0], [H.x1 + 10, H.F + 5, H.z1], 'white_terracotta')
b.door([12, H.F, H.z1], 'south', { material: 'spruce' })
b.door([16, H.F, H.z1], 'south', { material: 'spruce', frame: 'stripped_spruce_log', awning: true, steps: true })
b.door([21, H.F, H.z1], 'south', { material: 'dark_oak', width: 2, frame: 'stone_bricks', awning: 'dark_oak_slab[type=top]' })
b.door([28, H.F, H.z1], 'south', { material: 'spruce', open: true, frame: 'stripped_spruce_log' })
```

Grand portal: round arch in a 3-thick wall, door set 2 back under a plank tympanum, wall-post
lanterns, steps across the front.

```js
b.box([H.x0, H.F, H.z1 - 2], [H.x1, H.F + 8, H.z1], 'stone_bricks')
b.box([15, H.F, H.z1 - 1], [17, H.F + 2, H.z1], 'air')                                       // reveal, 2 deep
b.arch([15, H.F + 3, H.z1 - 1], [17, H.F + 3, H.z1 - 1], 'polished_andesite', { type: 'round', depth: 2 })
b.box([15, H.F, H.z1 - 2], [17, H.F + 4, H.z1 - 2], 'dark_oak_planks')                      // door plane + tympanum
b.door([16, H.F, H.z1 - 2], 'south', { material: 'dark_oak' })
for (const x of [13, 19]) { b.set(x, H.F + 2, H.z1 + 1, 'stone_brick_wall'); b.set(x, H.F + 3, H.z1 + 1, 'lantern') }
for (let x = 13; x <= 19; x++) b.set(x, H.F - 1, H.z1 + 1, 'stone_brick_stairs[facing=north,half=bottom]')
```

- **Porch:** 2–3 deep, a shed roof under the main eave on posts every 2–4, a floor raised 1 with
  steps (recipe in §1.10).
- **Awnings:** a stair or slab row on brackets, top-half trapdoors as a thin canopy, wool or carpet
  on a frame for a market stall, an unlit campfire as a slatted canopy (Grian).
- **Shopfront:** a 3–4 wide opening, a counter of top slabs on barrels, a hanging sign on a fence
  arm, goods (barrels, composters, decorated pots, hay).

---

## 5. Arches

- **Round** (Roman), **pointed** (Gothic: two overlapping circles; centres further apart = pointier),
  **segmental / elliptical** (flattened; bridges, wide windows, carriage doors), **flat** (a lintel).
- Make the piers about as tall as the opening is wide; ≥ 2 thick on wide gates. Contrasting
  voussoirs (a lighter ring) and a keystone (`chiseled_stone_bricks`, `chiseled_tuff`,
  `chiseled_deepslate`) define the opening. Set the door or glass 1 behind the ring.
- **Orders** (Romanesque and Gothic portals): repeat the arch 2–3 times, each 1 deeper and 1 narrower.
- **Arcade:** arches between piers 1–3 wide; a blind arcade (−1 recess) enlivens a long wall.

`b.arch(a, c, paint, { type: 'round' | 'pointed' | 'segmental' | 'flat', thickness, depth, fill, spandrel, top, rise })`
builds full-block voussoirs: `a` and `c` are the springer cells (same y, inclusive opening width),
`depth` runs toward +z (or +x), `rise` is the segmental height, `fill` clears the opening.

```js
b.box([0, H.F, 20], [44, H.F + 13, 21], 'stone_bricks')                                        // 2-deep wall
b.box([2, H.F, 20], [8, H.F + 3, 21], 'air');   b.arch([2, H.F + 4, 20], [8, H.F + 4, 20], 'polished_andesite', { type: 'pointed', depth: 2 })
b.box([12, H.F, 20], [22, H.F + 3, 21], 'air'); b.arch([12, H.F + 4, 20], [22, H.F + 4, 20], 'polished_andesite', { type: 'segmental', rise: 2, depth: 2 })
b.box([26, H.F, 20], [34, H.F + 3, 21], 'air'); b.arch([26, H.F + 4, 20], [34, H.F + 4, 20], 'polished_andesite', { type: 'round', depth: 2 })
```

For spans up to ~9 a stair-smoothed profile reads rounder than full-block voussoirs. `rows` = the
opening width of each row above the springing (outer row first, same parity as the span):

```text
span 3, [1]: shoulders    span 5, [3]: basket         span 7, [5, 3]: round
                                                      y5   #  #  #  #  #  #  #  #  #
y4   #  #  #  #  #        y4   #  #  #  #  #  #  #    y4   #  #  p           q  #  #
y3   #  p     q  #        y3   #  p           q  #    y3   #  p                 q  #
y2   #           #        y2   #                 #    y2   #                       #
y1   #           #        y1   #                 #    y1   #                       #

span 7, [5, 3, 1]: pointed        span 9, [7, 5, 3]: round                span 2, [0]: lancet
y6   #  #  #  #  #  #  #  #  #    y6   #  #  #  #  #  #  #  #  #  #  #
y5   #  #  #  p     q  #  #  #    y5   #  #  #  p           q  #  #  #
y4   #  #  p           q  #  #    y4   #  #  p                 q  #  #    y4   #  #  #  #
y3   #  p                 q  #    y3   #  p                       q  #    y3   #  p  q  #
y2   #                       #    y2   #                             #    y2   #        #
y1   #                       #    y1   #                             #    y1   #        #
```

```js
// opening profile -> stairs; wall side of each shoulder is the stair's facing
function stairArch([x0, y0, z], span, rows, mat, depth = 1) {
  const m = kit.material(mat)
  for (let d = 0; d < depth; d++) for (let i = 0; i < rows.length; i++) {
    const w = rows[i], prev = i === 0 ? span : rows[i - 1], y = y0 + i
    const left = x0 + (span - prev) / 2, right = x0 + (span + prev) / 2 - 1          // previous (wider) row
    const inL = x0 + (span - w) / 2, inR = x0 + (span + w) / 2 - 1                  // this row's opening
    for (let x = left; x <= right; x++) {
      if (x >= inL && x <= inR) b.set(x, y, z + d, 'air')
      else if (x === inL - 1) b.set(x, y, z + d, `${m.stairs}[facing=west,half=top]`)
      else if (x === inR + 1) b.set(x, y, z + d, `${m.stairs}[facing=east,half=top]`)
      else b.set(x, y, z + d, m.block)
    }
  }
}
b.box([0, H.F, 20], [44, H.F + 10, 21], 'stone_bricks')
b.box([2, H.F, 20], [6, H.F + 3, 21], 'air');   stairArch([2, H.F + 4, 20], 5, [3], 'stone_brick', 2)
b.box([10, H.F, 20], [16, H.F + 3, 21], 'air'); stairArch([10, H.F + 4, 20], 7, [5, 3], 'stone_brick', 2)
b.box([20, H.F, 20], [26, H.F + 3, 21], 'air'); stairArch([20, H.F + 4, 20], 7, [5, 3, 1], 'stone_brick', 2)
b.box([30, H.F, 20], [38, H.F + 3, 21], 'air'); stairArch([30, H.F + 4, 20], 9, [7, 5, 3], 'stone_brick', 2)
```

The helper assumes a wall plane along x (`facing=west` is the left shoulder seen from the south).
For a wall along z, swap x and z and use `north`/`south`.

---

## 6. Columns

Classical proportions: Doric shaft ≈ 7–8 diameters, Ionic ≈ 9, Corinthian ≈ 10; entablature ≈ ¼
of the column height; clear spacing 1.5–3 diameters. Voxel versions:

| Size | Shaft | Base / capital | Height, spacing |
| --- | --- | --- | --- |
| Thin (≤ ½) | wall post (8 px), fence (4 px), chain, end rod, iron bars | a block or slab | porches, balustrades, mullions, stalls |
| 1×1 | `quartz_pillar`, `purpur_pillar`, `polished_basalt`, `bone_block`, stripped logs (all `axis=y`) | a contrasting block, or 4 stairs (`flare`) | 4–8 tall, 3–4 on centre |
| 3×3 | pillar blocks, corners chamfered | 5×5 stair base and capital | 12–25 tall, 4–9 clear |

```js
b.box([0, H.F - 1, 10], [30, H.F - 1, 18], 'polished_andesite')
for (let x = 2; x <= 14; x += 4) b.column([x, H.F, 14], 6, { shaft: 'quartz_pillar[axis=y]', flare: 'quartz' })   // 1x1 + stair base and capital
b.box([1, H.F + 6, 13], [15, H.F + 6, 15], 'smooth_quartz')                                                       // entablature
const cx = 24, cz = 14                                                                                            // 3x3 column
b.box([cx - 1, H.F, cz - 1], [cx + 1, H.F + 11, cz + 1], 'quartz_pillar[axis=y]')
for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
  if (Math.abs(dx) < 2 && Math.abs(dz) < 2) continue
  const f = Math.abs(dx) === 2 ? (dx < 0 ? 'east' : 'west') : (dz < 0 ? 'south' : 'north')                        // tall side toward the shaft
  b.set(cx + dx, H.F, cz + dz, `quartz_stairs[facing=${f},half=bottom]`)
  b.set(cx + dx, H.F + 11, cz + dz, `quartz_stairs[facing=${f},half=top]`)
}
b.box([cx - 2, H.F + 12, cz - 2], [cx + 2, H.F + 12, cz + 2], 'smooth_quartz')
```

Gothic cluster piers: a 3×3 core with wall-post shafts on the four faces rising into ribs.
Fluting on 3×3+: alternate a pillar block and a slightly darker block in vertical stripes.

---

## 7. Towers

- **Height:** 2–4× the width (watchtowers 4–6×); ≥ 1.5× the wall they rise from; wall towers 2–3
  above the curtain, corner towers ~4 above (The Little Raccoon).
- **Projection:** 2 (up to 3–4) out of the curtain wall so the wall foot is covered.
- **Spacing:** one wall tower every 12–15 blocks on small castles, 16–24 on larger walls; closer at
  corners and gates.
- **Round sizes:** d 7 small (3×3 spiral inside), d 9–11 stair towers, d 13–21 keeps; odd diameters
  give a centre column for the stair. A keep is ~15–30 per side; builders tend to make them too big.
- **Storeys:** a stringcourse every 4–6; slits low, bigger windows high; battered base +1 for 2–4 courses.
- **Tops:** cone, helm or pyramid (§1), or a flat top behind battlements with a corbelled parapet.
  Turrets/bartizans: 3×3 or d 5, corbelled out on 2–3 rings of upside-down stairs at wall-walk
  corners, with mini cones.
- **Arrow slits:** 1×2 or 1×3 openings (air, iron bars, or a stair over an upside-down stair against
  2 blocks); cross slits add 1-wide arms at ⅔ height.

```text
plan, d = 9 (tube r = 4.5), slits on the axes
z6            #  #     #  #
z7         #                 #
z8      #                       #
z9      #                       #
z10                 C               C = centre column for the spiral
z11     #                       #
z12     #                       #
z13        #                 #
z14           #  #     #  #
     5  6  7  8  9 10 11 12 13 14 15   <- x
```

```js
const c = [20, H.F, 20], R = 4.5                                                         // round tower, d = 9
b.tube(c, R, 16, kit.palette({ stone_bricks: 5, andesite: 2, cobblestone: 1 }))
b.spiralStairs(c, 1, 3.4, H.F + 1, H.F + 15, 'stone_brick', { core: 'stone_bricks', stepsPerTurn: 12 })
for (let x = c[0] - 6; x <= c[0] + 6; x++) for (let z = c[2] - 6; z <= c[2] + 6; z++) {
  const d = Math.hypot(x - c[0], z - c[2])
  if (d <= R + 0.5 || d > R + 1.5) continue                                              // the ring just outside the wall
  b.set(x, H.F + 15, z, `stone_brick_stairs[facing=${kit.facingFrom(c[0] - x, c[2] - z)},half=top]`)   // corbel, leg on the tower
  b.set(x, H.F + 16, z, 'stone_bricks')                                                    // parapet, 1 proud
  if ((x + z) % 2 === 0) b.set(x, H.F + 17, z, 'stone_bricks')                             // merlons
}
b.disc([c[0], H.F + 16, c[2]], R + 0.5, 'stone_brick_slab[type=bottom]', { keep: true })   // wall walk (cut a hatch over the top step)
for (const [dx, dz] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) for (const y of [5, 6, 10, 11]) b.set(c[0] + dx, H.F + y, c[2] + dz, 'air')   // 1x2 slits
// square tower, 2-on/1-off merlons (two offset passes)
b.walls([30, H.F, 10], [38, H.F + 18, 18], 'stone_bricks'); b.box([31, H.F + 18, 11], [37, H.F + 18, 17], 'spruce_planks')
b.battlements([30, 10], [38, 18], H.F + 19, 'stone_bricks', { period: 3 })
b.battlements([30, 10], [38, 18], H.F + 19, 'stone_bricks', { period: 3, offset: 2 })
```

A cone-roofed tower is `b.tube` + `b.coneRoof` (§1.13); a stair tower attached to a house is a d 7
tube overlapping the house corner by 1–2 with its own cone, rising ≥ 2 above the main ridge.

---

## 8. Battlements and machicolations

- Crenellations sit **only on the outer edge** (Minecraft Forum castle guide). Merlons ≥ 2 high give
  real cover (MCMiddleEarth); 1-high merlons suit small walls and houses. Overhanging (corbelled)
  crenellations look best (game.guide).
- `b.battlements([x0, z0], [x1, z1], y, paint, { period, height, cap, offset })` runs round a
  rectangle; corners are always merlons. Two passes with `period: 3` and offsets 0 and 2 give
  2-on/1-off.

```text
B1 1-on/1-off, 1 high      B2 2-on/1-off, 2 high      B3 parapet + 2-on/1-off    B4 wall posts + slab caps
y4                         y4  # #   # #   # #   #    y4  # #   # #   # #   #    y4  _   _   _   _   _
y3  #   #   #   #   #      y3  # #   # #   # #   #    y3  # # # # # # # # # #    y3  |   |   |   |   |
y2  # # # # # # # # # #    y2  # # # # # # # # # #    y2  # # # # # # # # # #    y2  # # # # # # # # # #
```

```js
b.walls([10, H.F, 10], [30, H.F + 6, 24], 'stone_bricks'); b.box([11, H.F + 6, 11], [29, H.F + 6, 23], 'stone_brick_slab[type=top]')
b.battlements([10, 10], [30, 24], H.F + 7, 'stone_brick_wall', { period: 2, cap: 'stone_brick_slab[type=bottom]' })   // B4: light, small scale
b.walls([40, H.F, 10], [52, H.F + 8, 22], 'stone_bricks'); b.box([41, H.F + 8, 11], [51, H.F + 8, 21], 'stone_brick_slab[type=top]')
b.walls([40, H.F + 9, 10], [52, H.F + 9, 22], 'stone_bricks')                                                        // B3: continuous parapet...
b.battlements([40, 10], [52, 22], H.F + 10, 'stone_bricks', { period: 3, height: 2 })                                // ...then 2-high merlons
b.battlements([40, 10], [52, 22], H.F + 10, 'stone_bricks', { period: 3, offset: 2, height: 2 })
```

- **Machicolations:** the parapet corbelled out +1 on upside-down stairs; the dark gaps between
  corbels read as murder holes (round tower recipe in §7). A 2-block overhang is too far for most
  builds (Minecraft Forum). Optional, late-medieval.
- Details: slab or stair caps on big merlons, arrow slits through 2-wide merlons, a stringcourse of
  upside-down stairs under the parapet, banners on every 3rd–4th merlon of a gate front, braziers
  (lit campfire on a stone pedestal) at the gate.
- Curtain walls: 1–4 storeys, thick enough to walk on (≥ 2–3), the wall walk bare; stairs to the
  walk inside towers or gatehouses. Gatehouses: double gate with a portcullis (iron bars or a dark
  oak lattice that has room to rise, ≥ 4) and murder holes; settlements use
  `kit.plan.curtainWall` ([composition.md §5](composition.md#5-castles-and-fortifications)).

---

## 9. Balconies

Depth 1–2 (houses) or 3+ (palaces); floor at a storey level; brackets under every 1–2 cells or log
beams through the wall; railing 1 high; covered by a mini shed roof or the main eave.

```text
section (seen from the west; outside right)
y6         #  !  !      railing: fences auto-connect; walls need posts every 2-4
y5   #  #  #  ~  ~      floor: top slabs, 2 deep, flush with the upper floor
y4         #  p         bracket: upside-down stair, leg on the wall
    16 17 18 19 20   <- z (south ->)
```

```js
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 8, H.z1], 'white_terracotta')
b.box([H.x0 + 1, H.F + 4, H.z0 + 1], [H.x1 - 1, H.F + 4, H.z1 - 1], 'spruce_planks')           // upper floor
b.box([14, H.F + 4, H.z1 + 1], [18, H.F + 4, H.z1 + 2], 'spruce_slab[type=top]')                // balcony floor
for (const x of [14, 16, 18]) b.set(x, H.F + 3, H.z1 + 1, 'spruce_stairs[facing=north,half=top]')
for (let x = 14; x <= 18; x++) b.set(x, H.F + 5, H.z1 + 2, 'spruce_fence')
for (const x of [14, 18]) b.set(x, H.F + 5, H.z1 + 1, 'spruce_fence')
b.door([16, H.F + 5, H.z1], 'south', { material: 'spruce' })
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: H.F + 9, axis: 'x', material: 'dark_oak', gable: 'white_terracotta', eaveTrim: true })
```

Railings: fences (light, rustic), walls (heavy, masonry), open trapdoors on the outer edge (a solid
wooden panel), iron bars (wrought iron). A banner or flower boxes on the railing make it a focal
accent. More balcony modules: [detailing.md §6.15](detailing.md#615-balcony).

---

## 10. Bridges

- Widths: footbridge 1–3, village road 3–5, town bridge 5–7. Lamps on the parapet every 6–10.
- **Stone arch bridges:** segmental or elliptical arches for wide spans, piers 2–3 thick with
  cutwaters (pointed, made of stairs, facing upstream), a stringcourse at deck level, a deck 1–2
  thick with a path mix on top.
- **Timber bridges:** log beams on trestles (log posts + knee braces), a plank or slab deck, rope
  railings of fences or chains.
- Never bridge a puddle (GDMC judges). Road-scale bridges: [composition.md §4.2](composition.md#42-bridges).

`b.bridge(a, c, { width, deck, edge, arch, railing, posts, postEvery, lanterns, beam })` lays a deck
between two points in any direction, with a sine arch of `arch` blocks, railings, posts and lanterns.

```js
b.box([2, 0, 10], [8, 3, 18], 'stone'); b.box([28, 0, 10], [34, 3, 18], 'stone')                // banks
b.bridge([8, 4, 14], [28, 4, 14], { width: 3, deck: 'spruce_planks', edge: 'stone_bricks', arch: 2, railing: 'spruce_fence', posts: 'stone_brick_wall', postEvery: 4, lanterns: true })
```

---

## 11. Stairs

- Headroom ≥ 3 above every step; public stairs ≥ 2 wide; slabs for long, gentle flights (wiki).
- Straight flight: `b.stairway(from, facing, rise, material, { width, fill, base, sides, landing })`
  climbs toward `facing`, filled underneath, with optional side walls.
- Spiral: `b.spiralStairs(centre, rInner, rOuter, y0, y1, material, { stepsPerTurn, core, clockwise, landing })`
  places stairs with top slabs under them; `stepsPerTurn` 12 in a d 9 shaft rises 12 per turn, so
  leave the stair every ½–1 turn. Keep one turning direction per castle (Minecraft Forum).
- **3×3 slab spiral** (d 5 shaft): 8 cells round a centre post, each 0.5 higher: one turn = 4 blocks
  = one cottage storey, with 3.5 headroom.

```text
slab spiral, walking surface heights (b = bottom slab, t = top slab at the given y)
   0.5  1.0  1.5        b@y0  t@y0  b@y1
   4.0   C   2.0        t@y3   C    t@y1
   3.5  3.0  2.5        b@y3  t@y2  b@y2
```

```js
b.stairway([4, H.F, 30], 'north', 6, 'stone_brick', { width: 3, sides: 'stone_brick_wall' })            // straight flight with side walls
b.tube([20, H.F, 30], 4.5, 12, 'stone_bricks')                                                           // spiral in a d 9 tower
b.spiralStairs([20, H.F, 30], 1, 3.6, H.F + 1, H.F + 11, 'spruce', { core: 'stripped_spruce_log', stepsPerTurn: 12 })
const sx = 34, sz = 30                                                                                   // slab spiral in a 5x5 shaft
b.walls([sx - 2, H.F, sz - 2], [sx + 2, H.F + 12, sz + 2], 'stone_bricks')
const ring = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]
for (let s = 0; s < 22; s++) { const [dx, dz] = ring[s % 8]; b.set(sx + dx, H.F + Math.floor(s / 2), sz + dz, `spruce_slab[type=${s % 2 === 0 ? 'bottom' : 'top'}]`) }
for (let y = H.F; y <= H.F + 11; y++) b.set(sx, y, sz, 'stripped_spruce_log[axis=y]')
```

---

## 12. Chimneys

- `b.chimney(base, height, { paint, cap, smoke, size })`: a `size`×`size` stack with a lit campfire
  in the top cell (smoke in game) and a cap (default wall posts).
- Section 1×1 (cottage) to 2×2 (manor); an outside chimney gets a 3–4 wide breast tapering to the
  stack with stair shoulders.
- Top ≥ 1–2 above the ridge (or above the roof within 3 blocks of it). Off-centre on vernacular
  builds; on a gable end, or through the ridge.
- Materials: `bricks`, `stone_bricks`, `cobblestone`, `mud_bricks`, `polished_blackstone_bricks`;
  1–2 darker courses at the top (soot).

```js
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 5, H.z1], 'white_terracotta')
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: H.F + 6, axis: 'x', material: 'dark_oak', gable: 'spruce_planks' })
b.chimney([18, H.F, H.z1 + 1], 15, { paint: kit.palette({ bricks: 4, stone_bricks: 1 }), size: 2 })   // outside stack on the south wall
b.box([17, H.F, H.z1 + 1], [20, H.F + 5, H.z1 + 1], 'bricks')                                          // breast, 4 wide
b.set(17, H.F + 6, H.z1 + 1, 'brick_stairs[facing=east,half=bottom]'); b.set(20, H.F + 6, H.z1 + 1, 'brick_stairs[facing=west,half=bottom]')   // shoulders
b.chimney([12, H.F + 6, 13], 9, { paint: 'cobblestone', cap: 'cobblestone_wall' })                     // 1x1 through the roof, off centre
```

---

## 13. Lamp posts and lights

```text
(a) fence post      (b) wall post + hat     (c) arm, hanging        (d) log, double arm
y4                      T                       !  !                    !  |  !
y3  L                   L                       !  L                    c  |  c       c = chain
y2  !                   !                       !                       L  |  L
y1  !                   !                       !                          |
y0  !                   #                       !                          |
```

- Lantern at 3–4 above the ground; every 8–12 blocks along paths (alternating sides on wide roads),
  at every junction, bridge end and gate; a light at every door.
- A stone base (block or ring of 4 stairs); a hat of a trapdoor, slab or daylight detector.
- Hang lights from chains under arms or eaves (`chain[axis=y]` + `lantern[hanging=true]`).
- Warm light (lantern, campfire) for medieval and fantasy; soul lanterns, end rods and sea lanterns
  for cold, magical or modern accents. Full lighting rules:
  [interiors-and-lighting.md](interiors-and-lighting.md).

```js
b.lampPost([4, H.F, 10], { height: 3, post: 'spruce_fence', foot: 'stone_brick_wall' })                // (a)
b.set(9, H.F, 10, 'stone_bricks'); b.set(9, H.F + 1, 10, 'stone_brick_wall'); b.set(9, H.F + 2, 10, 'stone_brick_wall')
b.set(9, H.F + 3, 10, 'lantern'); b.set(9, H.F + 4, 10, 'spruce_trapdoor[half=bottom]')                 // (b)
b.lampPost([14, H.F, 10], { height: 4, post: 'dark_oak_fence', foot: 'cobblestone_wall', arm: 'east' }) // (c)
b.box([20, H.F, 10], [20, H.F + 4, 10], 'stripped_spruce_log[axis=y]')                                   // (d)
for (const dx of [-1, 1]) { b.set(20 + dx, H.F + 4, 10, 'spruce_fence'); b.hangingLantern([20 + dx, H.F + 4, 10], 1) }
```

---

## 14. Detailing

The small-block vocabulary (what every partial block is for, its geometry and states) and verified
micro-modules (sills, hoods, shutters, flower boxes, awnings, door surrounds, jetty corbels, beam
bolts, lantern arms, gutters, vine curtains, fireplaces) are in [detailing.md](detailing.md). Rules
that tie them to components:

- **One vocabulary per building:** the same sill, shutter and bracket everywhere it applies.
- **Every detail has a job:** brackets hold eaves, bolts hold beams, lamps light doors, gutters
  drain roofs.
- **Where to spend it:** entrance and hero element ×2; eye level (doors, steps, planters, lamps,
  barrels); edges (corners, openings, floor lines, eaves); few, large pieces on the roofline
  (chimney, dormer, finials, cresting); 30–50% of every wall left quiet
  ([principles.md §10](principles.md#10-focus-hierarchy-and-detail-density)).
- Entities (item frames, paintings, armor stands) do not exist in these exports; build the detail
  from blocks.

---

## Sources

- Minecraft Wiki tutorials: *Roof types*, *Roof construction guidelines*, *Curved roofs* and *Roof
  decorations* (last full revisions), *Walls and buttresses*, *Adding beauty to constructions*
  (minecraft.wiki, 2026).
- WesterosCraft, *Basic Building Guide for Applicants* (roofs, thatch, planks, depth).
- Astroworld guide, *How to Build a Roof in Minecraft* (overhangs, undersides, ridges, mistakes).
- Conquest Reforged, *Gradienting your Builds* (roof drips, moss in valleys, thatch weathering).
- PirateMC, *Houses: Better builds*; Blockwerks, *Medieval Timber-Frame House*; game.guide,
  *Medieval Building Style* (timber framing, jetties, towers, crenellation).
- Minecraft Forum, *What Minecraft Castle Builders Aught to Know*; MCMiddleEarth, *Castle realism
  guide*; The Little Raccoon, *Medieval Castle Build Tutorial* (walls, towers, merlons, gatehouses).
- mcshapes, *Minecraft Arches: Exact Patterns & Block Counts*; Minecraft Circle Generator blog,
  *Minecraft Archway* (arch construction).
- Craftdex, *The Architecture of Builds* (entrances, focal detail).
- Kit behaviour: `scripts/lib/kit/arch.mjs`, `scripts/lib/kit/roofplan.mjs`; diagrams printed from
  kit output; block ids checked against `scripts/lib/data/block-states.json` (1.21.1).
