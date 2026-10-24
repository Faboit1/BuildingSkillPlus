# Components: roofs, walls, openings, towers, structure

Every common architectural component with its proportions, a cross-section, and the kit call or
a short tested recipe. Principles behind the numbers (massing, scale tiers, depth, value) are in
[principles.md](principles.md). Small detail blocks and micro-modules (sills, shutters, awnings,
brackets, lanterns) are in [detailing.md](detailing.md); orientation rules for every state are in
[block-states.md](block-states.md); which stairs/slabs/walls exist per material is in
[materials.md](materials.md).

Snippets are recipe fragments. They assume `const { kit } = api`, `const b = api.builder([80, 48, 80])`
and `const H = { x0: 10, z0: 10, x1: 22, z1: 18, F: 1 }` (outer wall lines, inclusive; `F` = the
floor level you stand on). Every snippet was built with `problems: []` and rendered. States in
snippets (`facing`, `half`, `axis`) are written **for orientation**; `finish()` fills every other
property and computes stair corner shapes and wall/fence/pane connections.

**Legend for all diagrams** (sections are seen from the south: x grows to the right, east is right):

```text
#  full block           /  stair rising to the east (facing=east)    \  stair rising to the west (facing=west)
_  bottom slab          p  upside-down stair, solid leg on the LEFT  (facing=west, half=top)
~  top slab             q  upside-down stair, solid leg on the RIGHT (facing=east, half=top)
X  log or beam end      |  post (log axis=y)     !  fence or wall post     T  trapdoor
G  glass pane           D  door                  L  lantern               .  or blank: air
plans: > < ^ v  = stair facing east / west / north / south (the uphill side)
```

---

## 1. Roofs

### 1.1 How `b.roof` places a roof

```js
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 3, H.z1], 'white_terracotta')            // wall top = H.F + 3
const r = b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: H.F + 4,             // y = wall top + 1
  type: 'gable', axis: 'z', material: 'spruce', pitch: 1, overhang: 1, gableOverhang: 1,
  gable: 'spruce_planks', eaveTrim: true })
// r = { topY, base, axis, cells }   cells: Map "x,z" -> { tb, kind }, block at y = r.base + tb
```

Section of that roof type on a 7-wide house (walls y0–y3, `y: 4`), straight from the kit:

```text
y7               #               ridge row (odd width): full block
y6            /  #  \
y5         /  p     q  \         p / q under every 1:1 stair inside the walls: upside-down stair
y4      /  p           q  \      facing DOWN-slope -> smooth 45 deg ceiling, thick rake
y3   /  #                 #  \   eave row: 1 below y, beside the wall top
y2   q  #                 #  p   eaveTrim: upside-down stair, leg against the wall
y1      #                 #
y0      #                 #
     0  1  2  3  4  5  6  7  8   <- x   (walls at x = 1 and 7)
```

What the kit does, so you can predict it:

- **Rows** across = `ceil((W + 2·overhang) / 2)`; each row's level comes from `pitch`, listed
  **from the eave inward** (a list shorter than the rows repeats its last value). Ridge height at
  pitch 1 on an odd width W: `y + (W − 1)/2`.
- **Cells:** a stair where a row rises ≥ 1; a bottom slab on a half level; a **full block** on the
  ridge and where a whole level rises only 0.5. A roof never contains top slabs, so slab pitches
  have no see-through gaps. Columns are filled down to the previous row, so steep pitches are solid.
- **Underside** (`underside: 'stairs'`, default): an upside-down stair facing down-slope under each
  1:1 stair inside the walls. Rake rows and inner overhang rows get the same soffit stair; the
  outermost eave row stays bare unless `eaveTrim: true`. `underside: 'block'` uses full blocks.
- **`gable: paint`** fills every wall-line cell up to the roof surface (gable triangles, the high
  wall of a shed) and replaces underside stairs on that line, so the triangle is solid.
- **Rule for pitch lists:** the level at index `overhang` (the wall-line row) must be a whole
  number. The first entry counts as 0.5 if ≤ 0.5, else 1; later entries add. Good: `[0.5, 0.5, 1…]`
  with overhang 1 or 2, `[1, …]` with overhang 1, `[2, 2, …]`. Bad: `[0.5, 1, …]` with overhang 1.
- **Rows may rise 0** (`pitch: [1, 1, 0]`): a flat field after two stair rings (Mojang's low hip).
- **`overwrite: false`** keeps blocks already there: use it for a lower roof that dies into a taller
  wall, so the wall stays intact.
- **Materials without their own stairs** (`calcite`, `copper_block`...) fall back to their nearest
  family; pass `{ stairs, slab, block }` ids for full control.

### 1.2 Pitch

| `pitch` | Angle | Profile (eave → ridge) | Use |
| --- | --- | --- | --- |
| `0.5` | 26.6° | slab, block, slab, block… (rises 1 per 2) | Mediterranean, classical, porches, wide roofs, modern |
| `1` | 45° | one stair per row | **default**: cottages, medieval, most houses (consensus) |
| `2` | 63.4° | stair over 1 block | Nordic, Gothic, alpine; thatch needs ≥ 45° |
| `3` | 71.6° | stair over 2 blocks | spires, helm faces, mansard lower slopes |
| `[2, 2, 2, 2, 1]` | steep | last row rises 1 | any steep gable: a final rise of 2 leaves a 2-block fin at the ridge |
| `[0.5, 0.5, 1]` | kicked | flat eave, then 1:1 | bell-cast / sprocketed eave |
| `[0.5, 0.5, 1, 1, 1, 2, 1]` + `overhang: 2` | curved | flat → 1:1 → 2:1 | East-Asian |
| `[2, 2, 2, 0.5]` | broken | steep low, shallow high | gambrel (barn) |
| `[2, 2, 3, 0.5]` | broken | very steep, flat top | mansard (default for `type: 'mansard'`) |
| `[1, 1, 0]` | low | two stair rings + flat field | Mojang-style low hip, flat roofs with a sloped edge |

Sections on an 11-wide house (walls y0–y3, `y: 4`):

```text
pitch 0.5                                   pitch 2 ([2,2,2,2,1])
y7                     _                    y11                    #
y6               _  #  #  #  _              y10                 /  #  \
y5         _  #  #  #     #  #  #  _        y9               /  p     q  \
y4   _  #  #  #                 #  #  #  _  y8            /  p           q  \
y3      #                             #     y7            #                 #
                                            y6         /  #                 #  \
                                            y5         #  #                 #  #
                                            y4      /  #                       #  \
                                            y3      #  #                       #  #
                                            y2   /  #                             #  \
     1  2  3  4  5  6  7  8  9 10 11 12 13       1  2  3  4  5  6  7  8  9 10 11 12 13
```

- **Never mix pitches on faces that meet** (hips, valleys, cross gables): the ridges will not line
  up (consensus). Changing pitch *within* a face (gambrel, mansard, bell-cast, Asian) is fine.
- **Steeper in wet and snowy climates**, lower in dry ones (wiki).
- **Large roofs:** a pitch of 0.5 or a broken profile calms a big slope; 1:1 stepping on a 20-row
  roof reads busy (Astroworld guide).

### 1.3 Gable roof

The workhorse; best up to ~12 wide (wiki). Wider plans: split into sections (§1.8) or lower the pitch.

Gable end (south elevation, same 7-wide house with `gable` fill) and the rake in front of it:

```text
gable wall (z = 9)                 rake row (z = 10, one in front)
y7               #                 y7               #
y6            /  #  \              y6            /     \
y5         /  #  #  #  \           y5         /  p     q  \
y4      /  #  #  #  #  #  \        y4      /  p           q  \
y3   /  #  #  #  #  #  #  #  \     y3   /  p                 q  \
y2   q  #  #  #  #  #  #  #  p     y2   q                       p
```

The rake overhangs the gable by 1 (`gableOverhang: 1`), so the triangle already sits one block
behind the roof edge, which is the recess good builders add by hand. Gable-end options:

- **Top plate** across the gable at the eave line (log along the wall) separates wall and triangle.
- **One opening on the centre line:** a 1×1 or 1×2 window, a trapdoor vent, a round window (§3.4).
- **Contrasting triangle:** vertical planks, a timber pattern, or the wall infill (convention).
- **Bargeboard:** open trapdoors on the outer face of the rake stairs, or a rake in a darker wood.
- **Crow steps, Dutch curves, parapet ends:** §1.7, §1.12.

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
| odd | 1 full block (kit default) | `ridgeCap: 'deepslate_tile_wall'` (cresting; posts appear at ends), a bottom slab cap, a log ridge beam showing at the gable |
| even | two stairs back to back | cap both top rows with bottom slabs or a wall; or use an odd width |

```js
b.walls([H.x0, H.F, H.z0], [H.x1, H.F + 3, H.z1], 'white_terracotta')
b.roof({ x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1, y: H.F + 4, axis: 'x', material: 'deepslate_tile', gable: 'white_terracotta', ridgeCap: 'deepslate_tile_wall' })
for (const x of [H.x0 - 1, H.x1 + 1]) b.set(x, b.topY(x, 14) + 1, 14, 'lightning_rod[facing=up]')   // finials at the ridge ends
// even width (8): cap the two top rows
b.walls([30, H.F, 10], [37, H.F + 3, 18], 'white_terracotta')
const e = b.roof({ x0: 30, z0: 10, x1: 37, z1: 18, y: H.F + 4, axis: 'z', material: 'spruce', gable: 'white_terracotta' })
for (const [k, c] of e.cells) if (e.base + c.tb === e.topY) { const [x, z] = k.split(',').map(Number); b.set(x, e.topY + 1, z, 'spruce_slab[type=bottom]') }
```

Ridge material: the roof's darker variant or the frame wood. Walls on the ridge read strongly
against the sky. Finials: lightning rod, end rod, wall post + slab, `dragon_head` (Viking).

### 1.5 Eaves and overhangs

Overhang 1 by default, 2 on big roofs, 2–4 on East-Asian and alpine roofs (consensus). No
overhang = "stuck-on" roof, the most common roof mistake. Eave variants (west eave, outside left):

```text
E1 plain           E2 eaveTrim        E3 fascia          E4 kicked          E5 rafter tails
y5      /  p       y5      /  p       y5      /  p       y5      /  p       y5      /  p
y4   /  p          y4   /  p          y4   /  p          y4   /  p          y4   /  p
y3   #             y3   #             y3   #             y3   #             y3   #
y3 /  #            y3 /  #           y3 T /  #         y3 _ #  #          y3 /  #
y2    #            y2 q  #           y2    #           y2 ~    #          y2 X  #
```

Hmm placeholder

### 1.6 Hip and pyramid
