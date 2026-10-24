# Block-State Cookbook: Orientation, Shapes and Connections

The exact state strings for blocks whose look depends on direction, shape or neighbours, with the reasoning behind each.
Use it whenever you place stairs, slabs, logs, trapdoors, doors, beds, walls, fences, panes, gates, torches, lanterns,
signs, banners, heads, vines, tall plants, dripstone or furniture.

Search tips: `rg -n '^## |^### ' references/building/block-states.md` lists every topic. To find a block, search
`rg -n 'wall_torch' references/building/block-states.md`.

## How the claims were verified

Each section carries one or more tags:

- **[M]** Read from blockstate and model JSON (element `from`/`to` boxes after the variant's `x`/`y` rotation). The
  previewer's default pack is byte-for-byte vanilla 1.21.1 for every blockstate and model (checked by diff, ignoring
  only the `display` block), so this is how the game draws it.
- **[R]** Confirmed visually in the Lodestone preview, using close-up renders with a coloured compass in the floor.
- **[V]** Vanilla 1.21.1 game logic or data that a render cannot show: Mojang's block report defaults
  (`scripts/lib/data/block-states.json`), block tags from the 1.21.1 jar, or the Java code paths named in the text.

Rotation and mirror rules (section 12) were checked by voxelising the models: 354/354 combinations match.

## 0. Conventions and ground rules

```
            north (-z)
               ^
   west (-x) <   > east (+x)        y is up.  Clockwise seen from above:
               v                    north -> east -> south -> west -> north
            south (+z)
```

"Left" and "right" in state names are always relative to looking **toward `facing`**:

| facing | left (counter-clockwise) | right (clockwise) | opposite |
|---|---|---|---|
| north | west | east | south |
| east | north | south | west |
| south | east | west | north |
| west | south | north | east |

Top-down diagrams in this file put north at the top and east on the right. Quadrants are `NW NE / SW SE`.

### The four families of `facing`

Most mistakes come from assuming every block uses the same meaning of `facing`. There are four:

| Meaning of `facing` | Blocks |
|---|---|
| **Points away from the block it hangs on** (support is at `pos - facing`) | `wall_torch` and variants, `ladder`, `*_wall_sign`, `*_wall_banner`, `*_wall_skull`/`*_wall_head`, buttons, levers and grindstones with `face=wall`, `end_rod`, `lightning_rod`, amethyst buds/clusters, open trapdoors (panel on the side opposite `facing`) |
| **Points toward the block it hangs on** (support is at `pos + facing`) | `bell` with `attachment=single_wall` or `double_wall`, and `cocoa` (the pod's stem reaches the jungle log at `pos + facing`) [M] |
| **The front or working face looks this way** | chests, furnaces, smokers, blast furnaces, barrels, dispensers, droppers, observers (the face), pistons (the head), hoppers (the output spout), carved pumpkins, jack o'lanterns, beehives, looms, lecterns (reader side), beds (`facing` points foot to head), stairs (the tall back), doors (closed panel sits on the opposite edge) |
| **Parallel to the wall, not away from it** | `*_wall_hanging_sign` (the bar sticks out from a wall on the sign's left or right) |

### What the build runner does to your states

`node scripts/run-build.mjs --help` lists the flags. As of this writing the runner does this on export (verified by
building test structures and dumping the NBT):

1. **Default-state fill** (`--no-default-states` turns it off). Missing properties get vanilla's default value from
   the official block report. The defaults are often *not* what you want. Some examples:
   `oak_leaves` becomes `persistent=false,distance=7` (decays in-game), `tall_grass` becomes `half=lower`, `vine`
   becomes all faces `false` (invisible), `oak_door` becomes a lone `half=lower`, buttons, levers and grindstones
   become `face=wall`, `campfire` becomes `lit=true`, `pointed_dripstone` becomes `vertical_direction=up`.
   **Always write every property yourself.**
2. **Connection pass** (`--no-block-state-updates` turns it off). This recomputes and overwrites stair `shape`,
   wall `north/east/south/west/up`, fence and pane/iron-bar `north/east/south/west`, and fence-gate `in_wall` from
   the neighbours (a vanilla port in `scripts/lib/kit/connect.mjs`). On test roofs (a hip roof, a stepped pit and an
   L-shaped roof valley) it produced exactly the same 38 corner shapes as the reference algorithm in section 1.
   Walls, fences, panes and gates agreed on 95 of 96 test blocks. The exception was a wall with a carpet on top,
   which vanilla makes `tall` and the pass leaves `low`.
   Consequences:
   - `facing` and `half` must be right, because the shapes are derived from them.
   - A hand-written decorative shape that disagrees with the neighbours (for example a lone `outer_left` stair) is
     overwritten. Pass `--no-block-state-updates` if you really want it, and then you own *all* connection states.
3. **Not handled** by the runner: leaf persistence, the second half of doors, beds and tall plants, support checks
   (a torch on air), `lit` logic and waterlogging. These are covered in the sections below.

Lodestone's own `Structure.updateBlockStates()`, described in `references/lodestone/structure.md`, is simpler. It
does only fences and panes, joins no gates or walls, and handles no stairs or walls. The runner no longer depends on
it.

**What the game does when the structure is placed [V].** Placing an `.nbt` with a structure block or
`/place template` runs `Block.updateFromNeighbourShapes` on the placed blocks (unless the placement uses
"known shape"). That re-derives stair and wall shapes, and it also deletes any block that cannot survive:

- a wall torch, ladder, wall sign or button with no supporting block,
- a door, bed or tall plant whose other half is missing or mismatched,
- a hanging lantern with nothing above it,
- a vine with no supported face.

Non-persistent leaves more than 6 blocks from a log decay later. The preview shows exactly what you stored and
checks none of this.

---

## 1. Stairs

**Rule [M][R].** `facing` is the side of the **tall back**. You walk up a stair moving toward `facing`.
`half=bottom` is a normal stair. `half=top` is upside down: a full slab on top, with the step hanging below on the
`facing` side.

```
facing=north, half=bottom, shape=straight

 top-down                     side view, looking east (north on the left)
 +--------+  north            N            S
 |########|  # tall back      ########
 |########|    (y 8-16)       ################     <- low step y 0-8
 |........|  . low step       <-- you climb walking north (toward facing)
 |........|    (y 0-8)
 +--------+  south

facing=north, half=top (upside-down)
 side view, looking east:     ################     <- full slab y 8-16
                              ########             <- hanging part, north half, y 0-8
```

State strings:

```
minecraft:oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]
minecraft:stone_brick_stairs[facing=east,half=top,shape=straight,waterlogged=false]
```

### Shapes [M][R]

Quadrants of the **tall part** (for `half=top`, read "hanging part"; the same quadrants are used for both halves):

```
facing=north    straight   inner_left  inner_right  outer_left  outer_right
                # #        # #         # #          # .         . #
                . .        # .         . #          . .         . .
```

- `outer_<side>`: only one tall quarter, in the corner between `facing` and `<side>`.
- `inner_<side>`: three tall quarters, covering the `facing` half plus the `<side>` half. The single low quarter is
  in the opposite corner.

All four facings (`#` quarters = tall for bottom stairs, hanging for top stairs) [M]:

| facing | straight | inner_left | inner_right | outer_left | outer_right |
|---|---|---|---|---|---|
| north | NW NE | NW NE SW | NW NE SE | NW | NE |
| east | NE SE | NW NE SE | NE SW SE | NE | SE |
| south | SW SE | NE SW SE | NW SW SE | SE | SW |
| west | NW SW | NW SW SE | NW NE SW | SW | NW |

You want a given corner, so which state makes it? Every corner has two equivalent spellings:

| You want | state A | state B |
|---|---|---|
| single tall quarter **NW** | `facing=north,shape=outer_left` | `facing=west,shape=outer_right` |
| single tall quarter **NE** | `facing=north,shape=outer_right` | `facing=east,shape=outer_left` |
| single tall quarter **SE** | `facing=east,shape=outer_right` | `facing=south,shape=outer_left` |
| single tall quarter **SW** | `facing=south,shape=outer_right` | `facing=west,shape=outer_left` |
| single low quarter **SE** | `facing=north,shape=inner_left` | `facing=west,shape=inner_right` |
| single low quarter **SW** | `facing=north,shape=inner_right` | `facing=east,shape=inner_left` |
| single low quarter **NW** | `facing=east,shape=inner_right` | `facing=south,shape=inner_left` |
| single low quarter **NE** | `facing=south,shape=inner_right` | `facing=west,shape=inner_left` |

### When vanilla picks each shape (port of `StairBlock.getStairsShape`, 1.21) [V][R]

Only `facing` and `half` of neighbouring **stairs of the same half** matter. Any stair material joins any other.
Slabs and full blocks do not count, and the neighbours' own shapes do not matter.

1. Look at the block on the **tall side** (`pos + facing`). Suppose it is a stair with the same `half` whose
   `facing` is perpendicular to ours. Also check that the block on the far side (`pos - itsFacing`) is not a stair
   with exactly our `facing` and `half`. Then we are an **outer** corner: `outer_left` if its facing is our left
   (counter-clockwise), otherwise `outer_right`.
2. Otherwise look at the block on the **step side** (`pos - facing`). Suppose it is a same-half stair with a
   perpendicular `facing`. Also check that the block at `pos + itsFacing` is not a stair continuing our own run.
   Then we are an **inner** corner: `inner_left` if its facing is our left, otherwise `inner_right`.
3. Otherwise `straight`.

The runner applies this for you (see section 0). Use the code below with `--no-block-state-updates`, or to predict
what the game or runner will do:

```js
// Vanilla StairBlock.getStairsShape for a Lodestone Structure `s` (works on api.createStructure output).
const DIRS = { north: [0, 0, -1], east: [1, 0, 0], south: [0, 0, 1], west: [-1, 0, 0] }
const CCW = { north: 'west', west: 'south', south: 'east', east: 'north' }
const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' }
const axisOf = d => (d === 'east' || d === 'west' ? 'x' : 'z')

function stairAt(s, pos) {
  const b = s.getBlock(pos)
  if (!b || !b.state.getName().toString().endsWith('_stairs')) return null
  const p = b.state.getProperties()
  return { facing: p.facing ?? 'north', half: p.half ?? 'bottom' }
}

export function stairShape(s, pos) {
  const { facing, half } = stairAt(s, pos)
  const at = d => stairAt(s, pos.map((c, i) => c + DIRS[d][i]))
  // false when that side continues our own straight run (same facing and half)
  const canTakeShape = d => { const n = at(d); return !n || n.facing !== facing || n.half !== half }
  const front = at(facing)              // neighbour behind the tall back
  if (front && front.half === half && axisOf(front.facing) !== axisOf(facing) && canTakeShape(OPP[front.facing]))
    return front.facing === CCW[facing] ? 'outer_left' : 'outer_right'
  const back = at(OPP[facing])          // neighbour in front of the low step
  if (back && back.half === half && axisOf(back.facing) !== axisOf(facing) && canTakeShape(back.facing))
    return back.facing === CCW[facing] ? 'inner_left' : 'inner_right'
  return 'straight'
}

// Call once at the end of the recipe, after all stairs exist (shape never depends on other shapes).
export function fixStairShapes(s) {
  const todo = s.getBlocks().filter(b => b.state.getName().toString().endsWith('_stairs'))
    .map(b => [b, stairShape(s, b.pos)])
  for (const [b, shape] of todo) s.addBlock(b.pos, b.state.getName().toString(), { ...b.state.getProperties(), shape }, b.nbt)
}
```

### Roof recipes

All of these were built with only `facing` and `half` set, then shaped by the algorithm and rendered [R].

**Gable roof, ridge running east-west.** Stairs always face **uphill, toward the ridge**:

```
cross-section, looking east (north on the left).  S = facing=south, N = facing=north, = = bottom slab
y+4                       =                      ridge cap: bottom slab (or a full block)
y+3                    S     N
y+2                 S           N
y+1              S                 N
y+0           S                       N
             z0 z1 z2 z3 z4 z5 z6 z7 z8          (odd span; an even span ends with S and N back to back)
   north slope: facing=south          south slope: facing=north
```

```js
// rows k = 0, 1, ... while k < (z1 - z0) / 2. Odd width: add a ridge cap at z = (z0 + z1) / 2, height y + (z1 - z0) / 2.
// Even width: the last south-facing and north-facing rows meet back to back.
for (let k = 0; k < (z1 - z0) / 2; k++) for (let x = x0; x <= x1; x++) {
  api.setBlock(s, [x, y + k, z0 + k], 'minecraft:spruce_stairs[facing=south,half=bottom,shape=straight]') // north slope
  api.setBlock(s, [x, y + k, z1 - k], 'minecraft:spruce_stairs[facing=north,half=bottom,shape=straight]') // south slope
}
```

For a ridge running north-south, the west slope uses `facing=east` and the east slope uses `facing=west`. Gable
roofs have no corners, so every stair stays `straight`. Close the triangular gable ends with full blocks.

**Hip roof.** Stack shrinking rings, each one block up and one block in, with every stair facing the centre.
Corners become **outer** shapes. With the north and south rows owning the corners:

```
layer 0 of a hip roof, top-down
        [S ol] S  S  S  S [S or]        S = facing=south   N = facing=north
          E                  W          E = facing=east    W = facing=west
          E                  W          ol = outer_left    or = outer_right
        [N or] N  N  N  N [N ol]
```

| roof corner | tall quarter | state | same thing written the other way |
|---|---|---|---|
| NW | SE | `facing=south,shape=outer_left` | `facing=east,shape=outer_right` |
| NE | SW | `facing=south,shape=outer_right` | `facing=west,shape=outer_left` |
| SW | NE | `facing=north,shape=outer_right` | `facing=east,shape=outer_left` |
| SE | NW | `facing=north,shape=outer_left` | `facing=west,shape=outer_right` |

The top row where the rings run out is a slab or full-block ridge.

**Valleys and stepped pits** (concave corners) become **inner** shapes. In a ring of stairs facing *outward*, like a
sunken plaza or the valley of an L-shaped roof, the low quarter points to the outside corner:

| corner of the ring | state |
|---|---|
| NW | `facing=north,shape=inner_left` (low quarter SE) |
| NE | `facing=north,shape=inner_right` (low quarter SW) |
| SW | `facing=south,shape=inner_right` (low quarter NE) |
| SE | `facing=south,shape=inner_left` (low quarter NW) |

**Upside-down stairs as eaves and corbels.** Put `half=top` stairs under the overhang, pointing their `facing`
**toward the wall**. The hanging step then hugs the wall and the cut-away side faces outward, like a bracket. On a
wall whose outside faces east, the corbel sits in the cell east of the wall top:
`minecraft:spruce_stairs[facing=west,half=top,shape=straight]` [R].

**Thick sloped edge (soffit) under a gable.** Under each roof stair of row `k+1`, place an upside-down stair facing
**down-slope**, which is opposite to the roof stairs' facing. The underside then steps in parallel with the top,
giving an even 45° band [R]:

```
north slope (roof stairs facing=south), looking east (north on the left):
y+2          S                     S = spruce_stairs[facing=south,half=bottom]
y+1       S  n                     n = spruce_stairs[facing=north,half=top]   (directly under the next S)
y+0    S  n
      z0 z1 z2
```

**Window sill.** Use a `half=top` stair in the cell below the window, outside, facing **toward the wall** [R]. For an
east-facing wall that is `spruce_stairs[facing=west,half=top,shape=straight]`. Alternatives are a bottom slab or a
closed `half=top` trapdoor.

**Chair.** Use a bottom stair whose `facing` is the **backrest side**. The sitter looks the opposite way. A chair
facing a table to its south is `oak_stairs[facing=north,half=bottom,shape=straight]`. For armrests, add open
trapdoors in the cells to the east and west: the east one `facing=east,open=true` and the west one
`facing=west,open=true`. Each panel then lies against the seat [R].

**Common mistakes**
- Setting `facing` to the way the stair "points" or descends. `facing` is the **high** side.
- Making a roof slope face away from the ridge, which produces a sawtooth. The north slope of an east-west ridge is
  `facing=south`.
- Expecting `half=top` stairs to join `half=bottom` stairs into corners. Corners only form between the same half.
- Hand-writing corner shapes that disagree with neighbours. The runner overwrites them. Fix `facing` instead.
- Writing `upside_down=true` or `half=upper`. Stairs use `half=top|bottom`.

---

## 2. Slabs [M][R]

`type=bottom` fills the lower half (y 0-8), `type=top` the upper half (y 8-16), and `type=double` the full block.
Slabs have no facing.

```
minecraft:smooth_stone_slab[type=bottom,waterlogged=false]
minecraft:oak_slab[type=top,waterlogged=false]
minecraft:stone_brick_slab[type=double,waterlogged=false]
```

- **Ceilings and soffits.** Top slabs sit flush against the block above, so a top-slab ceiling at the top of a room
  keeps half a block of extra headroom compared with full blocks. It also leaves the floor above looking full.
- **Eave or overhang edge.** A row of top slabs one block out from the wall, at the height of the roof's lowest row,
  makes a thin projecting cornice.
- **Half-block roof steps** (a gentle 1:2 slope). Alternate bottom and top slabs, rising half a block per block:
  `bottom@y, top@y, bottom@y+1, top@y+1, ...` [R].
- **Ridge caps.** Use a bottom slab on the top row of a gable or hip roof.
- `type=double` looks like the full block but keeps the slab texture where the block has one (smooth stone shows
  its seam). Use the full block when you want the plain look.

**Common mistakes:** writing `half=top` (that is the stair property, not the slab one), and putting a top slab at
floor level and expecting to stand on it at floor height (its walking surface is the top of the cell).

---

## 3. Axis blocks: logs, pillars, basalt, bone, hay, chains [M][R]

`axis` is the direction the grain or length runs. `y` is vertical, `x` runs east-west and `z` runs north-south. The
end-grain or top texture appears on the two faces the axis passes through.

Blocks with `axis=x|y|z`: every `*_log`, `*_wood`, `stripped_*`, `*_stem`, `*_hyphae`, `bamboo_block`,
`stripped_bamboo_block`, `basalt`, `polished_basalt`, `bone_block`, `hay_block`, `chain`, `quartz_pillar`,
`purpur_pillar`, `deepslate`, `infested_deepslate`, `muddy_mangrove_roots`, and the three `*_froglight` blocks [V].

```
minecraft:oak_log[axis=y]           vertical post
minecraft:spruce_log[axis=x]        beam running east-west (rings visible on its east and west faces)
minecraft:dark_oak_log[axis=z]      beam running north-south
minecraft:chain[axis=y,waterlogged=false]    hanging chain; axis=x / axis=z make horizontal chains
minecraft:quartz_pillar[axis=y]
```

- **Beams.** A beam's axis equals the direction it spans. A beam from `[2,5,4]` to `[9,5,4]` is `axis=x`. A frame
  around a wall at `x=const` uses `axis=z` for the horizontals and `axis=y` for the posts.
- **Corners of a log frame.** The corner block can take either horizontal axis. Pick the one whose end grain you
  want to show, or use `*_wood` (bark on all six faces) for corners.
- Chains are thin rods. `axis=y` is the only one that supports a hanging lantern below it.

**Common mistakes:** leaving every log at the default `axis=y`, so horizontal beams show rings on top and bark on
the ends. Confusing `axis=z` with "toward the viewer": it is north-south, whatever the camera does.

---

## 4. Trapdoors [M][R]

Properties are `facing`, `half=bottom|top`, `open=true|false`, `powered` and `waterlogged`. The panel is 3 px thick.

| state | where the panel is |
|---|---|
| `open=false,half=bottom` | flat on the **floor** of the cell (y 0-3); `facing` only sets the hinge side |
| `open=false,half=top` | flat against the **ceiling** of the cell (y 13-16) |
| `open=true,facing=north` | vertical, on the **south** edge (z 13-16) |
| `open=true,facing=east` | vertical, on the **west** edge (x 0-3) |
| `open=true,facing=south` | vertical, on the **north** edge (z 0-3) |
| `open=true,facing=west` | vertical, on the **east** edge (x 13-16) |

**Rule:** an open trapdoor lies on the side **opposite** its `facing`. Think of `facing` as pointing away from the
block it is hinged to. `half` makes no difference to an open trapdoor's geometry.

```
open trapdoors, top-down (| and - are the panel)
 facing=north   facing=east   facing=south   facing=west
 +------+       +------+      +------+       +------+
 |      |       ||     |      |------|       |     ||
 |      |       ||     |      |      |       |     ||
 |------|       ||     |      |      |       |     ||
 +------+       +------+      +------+       +------+
```

Recipes [R]:

- **Shutters** on a wall whose outside faces F. Put open trapdoors in the outside cells beside the window with
  `facing=F`. For a window in an east-facing wall at `x=5`, the shutters go at `x=6`:
  `spruce_trapdoor[facing=east,half=bottom,open=true]`. They lie flat on the wall.
- **Cover a block's face (fascia, trim, flower box sides).** To clad the F side of a block, put an open trapdoor in
  the cell at `block + F` with `facing=F`.
- **Table or counter top.** A closed `half=top` trapdoor puts a thin top at table height in its own cell. For a
  classic one-block table, use `oak_fence` with `oak_pressure_plate[powered=false]` (or a carpet) on top.
- **Floor hatch over a ladder.** Use `half=top,open=false` in the floor opening, so the panel is flush with the floor
  surface. Give it the **same `facing` as the ladder**. When open, the panel then lies against the same wall as the
  ladder. In vanilla, an open trapdoor directly above a ladder with the same facing is climbable [V].
- **Armrests and low railings.** Use open trapdoors as thin vertical panels (see the chair in section 1).

**Common mistakes:** assuming `facing` is the side where the panel lies (it is the opposite side); using
`half=bottom` for a ceiling hatch, which sits 13 px below the ceiling; and forgetting `open=true` for shutters, which
leaves flat plates on the ground.

---

## 5. Doors [M][R][V]

A door is **two blocks**. `half=lower` sits at `y` and `half=upper` at `y+1`, and both carry identical `facing`,
`hinge`, `open` and `powered`. A door missing its other half is deleted by the game on placement [V]. The preview
draws a lone half as a one-block-tall panel without complaint.

```
minecraft:oak_door[facing=north,half=lower,hinge=left,open=false,powered=false]
minecraft:oak_door[facing=north,half=upper,hinge=left,open=false,powered=false]
```

- `facing` is the direction you walk when you pass through from the side the closed panel is on. The **closed panel
  sits on the edge opposite `facing`**: `facing=north` puts it on the south edge of the cell (z 13-16), and
  `facing=east` puts it on the west edge.
- The door **swings into the `facing` side** of its cell.
- `hinge=left` puts the hinge on the **left when looking toward `facing`** (counter-clockwise side). `hinge=right`
  puts it on the right. An open door lies along its hinge edge.

| facing | closed panel edge | open, hinge=left | open, hinge=right |
|---|---|---|---|
| north | south | west | east |
| east | west | north | south |
| south | north | east | west |
| west | east | south | north |

```
facing=north, hinge=left, top-down
 closed:  +--------+        open:  +--------+
          |        |               ||       |
          |        |               ||       |     panel swung to the west edge
          |========| <- panel      ||       |     (hinge in the SW corner)
          +--------+               +--------+
```

**Double door.** Both leaves get the same `facing`, with their hinges on the **outer** sides. The leaf on the left
(counter-clockwise of `facing`) is `hinge=left`, and the leaf on the right is `hinge=right`. Example for an
east-facing wall at `x=5`, entered walking west (`facing=west`), where left of west is south [R]:

```js
const door = (z, y, half, hinge) =>
  api.setBlock(s, [5, y, z], `minecraft:spruce_door[facing=west,half=${half},hinge=${hinge},open=false,powered=false]`)
door(7, 1, 'lower', 'right'); door(7, 2, 'upper', 'right')   // north leaf
door(8, 1, 'lower', 'left');  door(8, 2, 'upper', 'left')    // south leaf
```

**Common mistakes:** placing only the lower half; giving the two halves different `hinge`; reading `facing` as the
side the panel sits on (it is the opposite side); and giving both leaves of a double door the same hinge, so one
door opens into the other.

---

## 6. Beds [R][V]

A bed is **two blocks** with the same `facing`. `facing` points **from the foot toward the head**, so the
`part=head` block is at `foot + facing`. The pillow is at the head end.

```js
// bed whose head is to the north: foot at [x,y,z], head at [x,y,z-1]
api.setBlock(s, [x, y, z],     'minecraft:red_bed[facing=north,part=foot,occupied=false]')
api.setBlock(s, [x, y, z - 1], 'minecraft:red_bed[facing=north,part=head,occupied=false]')
```

| facing | head block offset from the foot |
|---|---|
| north | `[0, 0, -1]` |
| east | `[+1, 0, 0]` |
| south | `[0, 0, +1]` |
| west | `[-1, 0, 0]` |

To put a bed against a wall, give the head the cell next to the wall and point `facing` at the wall.

**Common mistakes:** putting the head at `foot - facing` (the bed renders backwards and the game deletes the
mismatched halves); omitting `part` (the default is `foot`, so two `foot` blocks); and different `facing` on the two
halves. In the preview, beds are drawn by Lodestone's special renderer, which handles `facing` and `part` correctly.

---

## 7. Fences, walls, panes, iron bars and fence gates

### What connects to what (vanilla 1.21.1) [V][R]

| block | connects horizontally to | never connects to |
|---|---|---|
| wooden fences (`*_fence` except nether brick) | other wooden fences (any wood), fence gates spanning the same line, solid full faces | walls, panes, nether brick fence |
| `nether_brick_fence` | nether brick fence, aligned fence gates, solid full faces | wooden fences, walls, panes |
| glass panes and `iron_bars` | any pane or bars, **walls**, solid full faces | fences, fence gates |
| walls (`*_wall`) | walls, panes and bars, aligned fence gates, solid full faces | fences |

A "solid full face" means a full cube, a double slab, or the back face of a stair. Leaves, pumpkins, carved
pumpkins, jack o'lanterns, melons, barriers and shulker boxes are excluded even though they are cubes. A gate is
aligned when it spans along the line: a gate with `facing=north` or `facing=south` runs east-west and joins
neighbours to its east and west.

Fence and pane states are booleans: `north=true|false`, and so on. **The runner computes all of these, including
gates and walls** (section 0). Plain Lodestone `updateBlockStates()` does not join fences to gates or panes to walls.

```
minecraft:oak_fence[east=true,north=false,south=false,waterlogged=false,west=true]
minecraft:glass_pane[east=true,north=false,south=false,waterlogged=false,west=true]
```

Part sizes [M]: a fence post is 4×4 px with 2 px rails at y 6-9 and 12-15; a pane is 2 px thick, full height; a wall
post is 8×8 px and 16 tall; a low wall arm is 6 px wide and 14 tall; a tall arm is 16 tall.

### Walls: `north|east|south|west = none|low|tall` and `up=true|false` [V][R]

Walls are **multipart**. A wall written with no properties draws **nothing at all** in the preview, because there
is no post and no arms; the runner's default fill and connection pass rescue it.

- Each side is `none` if nothing connects that way.
- A connected side is `tall` if the block **above** covers that arm with its bottom face, otherwise `low`. Blocks
  that cover it: full blocks, bottom slabs, double slabs, bottom-half stairs, carpets and snow layers, or a wall,
  fence or pane above that has an arm on the same side. So the lower courses of a wall two or more blocks high get
  `tall` sides, and the top course gets `low`.
- `up` (the raised centre post) is `true` when:
  1. the wall above has `up=true`, **or**
  2. the wall is isolated, an end, or a corner. That is the case when no side connects, `north` differs from
     `south` in being none, or `east` differs from `west`. T-junctions count, because one side of a pair is `none`.
  3. Otherwise a straight run with both opposite sides `tall` has no post (`up=false`).
  4. Otherwise (a straight low run, or a cross) the post rises only if something above sits on the centre: a torch,
     sign, banner, pressure plate or tripwire, a standing lantern, or a wall, fence or pane above.

```
straight low wall, 5 long, nothing on top (top-down, P = post):
  P----- ------ ------ -----P          ends: up=true,  middle: up=false, sides low
same wall with a torch on the middle block:
  P----- ------P------ -----P          the block under the torch gets up=true
L corner and T junction always get a post:
  P------                  ------P------
  |                              |
```

Example state: the west end of a low east-west run is
`cobblestone_wall[east=low,north=none,south=none,up=true,waterlogged=false,west=none]`, and a middle block of the
same run is `cobblestone_wall[east=low,north=none,south=none,up=false,waterlogged=false,west=low]`.

Reference implementation, used only with `--no-block-state-updates`, or to predict results:

```js
// Vanilla WallBlock logic for a Lodestone Structure. isFullFace(state, faceDir) should say whether `state` has a
// full square face on its `faceDir` side (full cubes; double slabs; a stair's `facing` side; not leaves/pumpkins).
const SIDES = { north: [0, 0, -1], east: [1, 0, 0], south: [0, 0, 1], west: [-1, 0, 0] }
const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' }
const nm = st => st.getName().toString().replace('minecraft:', '')
const isWall = n => /_wall$/.test(n) && !/(_wall_(sign|banner|head|skull|torch|hanging_sign)|wall_fan)$/.test(n)
const isPane = n => n === 'iron_bars' || n.endsWith('glass_pane')
const POST_OVERRIDE = n => /^(torch|soul_torch|redstone_torch|tripwire)$/.test(n) || (/_sign$/.test(n) && !/hanging/.test(n)) || /_banner$|_pressure_plate$/.test(n)

function wallConnects(nb, toUs, isFullFace) {
  const n = nm(nb)
  if (isWall(n) || isPane(n)) return true
  if (n.endsWith('_fence_gate')) { const f = nb.getProperties().facing; return (f === 'north' || f === 'south') !== (toUs === 'north' || toUs === 'south') }
  return isFullFace(nb, toUs)
}
function coverAbove(ab, isFullFace) {           // what the block above covers with its bottom face
  if (!ab) return {}
  const n = nm(ab), p = ab.getProperties()
  if (isWall(n) || isPane(n) || /_fence$/.test(n)) {
    const arm = d => p[d] !== undefined && p[d] !== 'none' && p[d] !== 'false'
    const c = { north: arm('north'), east: arm('east'), south: arm('south'), west: arm('west') }
    return { ...c, post: true, wallPost: isWall(n) && p.up === 'true' }
  }
  if (POST_OVERRIDE(n)) return { post: true }
  if (/_slab$/.test(n)) return p.type === 'top' ? {} : { all: true }
  if (/_stairs$/.test(n)) return p.half === 'top' ? {} : { all: true }
  if (/_carpet$|^moss_carpet$|^snow$/.test(n)) return { all: true }
  if (/lantern$/.test(n)) return p.hanging === 'true' ? {} : { post: true }
  return isFullFace(ab, 'down') ? { all: true } : {}
}
export function wallState(s, [x, y, z], isFullFace) {
  const side = {}
  const cov = coverAbove(s.getBlock([x, y + 1, z])?.state, isFullFace)
  for (const [d, o] of Object.entries(SIDES)) {
    const nb = s.getBlock([x + o[0], y, z + o[2]])?.state
    side[d] = !(nb && wallConnects(nb, OPP[d], isFullFace)) ? 'none' : (cov.all || cov[d]) ? 'tall' : 'low'
  }
  const none = d => side[d] === 'none'
  let up
  if (cov.wallPost) up = true
  else if ((none('north') && none('south') && none('east') && none('west')) || none('north') !== none('south') || none('east') !== none('west')) up = true
  else if ((side.north === 'tall' && side.south === 'tall') || (side.east === 'tall' && side.west === 'tall')) up = false
  else up = !!(cov.all || cov.post)
  return { ...side, up: String(up) }
}
// Apply top-down (highest y first) so each wall sees the final `up` of the wall above it.
```

### Fence gates [M][R][V]

Properties are `facing`, `open`, `in_wall` and `powered`.

- The gate **spans across `facing`**. With `facing=north` or `facing=south` the gate runs east-west, with its posts
  on the east and west edges, and it joins fences and walls on those sides.
- `open=true` swings both leaves **toward `facing`**, folding them against the post edges.
- `in_wall=true` lowers the whole gate by 3 px (model y 2-13 instead of 5-16) so it lines up with wall tops. Vanilla
  sets it when either neighbour along the span is a wall. The runner computes it.

```
gate in an east-west fence line, closed:   minecraft:oak_fence_gate[facing=south,in_wall=false,open=false,powered=false]
same gate between cobblestone walls:       minecraft:oak_fence_gate[facing=south,in_wall=true,open=false,powered=false]
```

**Common mistakes:** a gate facing along the fence line (`facing=east` in an east-west fence), which turns the gate
sideways; expecting fences to join walls, which never happens (use a wall or a full block between them);
`in_wall=false` between walls, which floats the gate 3 px too high; and expecting nether brick fences to join wooden
ones.

---

## 8. Light sources [M][R][V]

### Lanterns and chains
- `lantern[hanging=false]` stands on the floor (body y 0-9). `lantern[hanging=true]` hangs from the block above,
  with its body at y 1-10 and a loop reaching y=16. The block above must have a solid centre on its **underside**:
  a full block, `chain[axis=y]`, a fence, a wall, a bottom slab or a bottom-half stair. A top slab or a horizontal
  chain cannot hold it [V].
- `soul_lantern` uses the same states. `waterlogged=true` for underwater lanterns.
- A **hanging lantern with nothing above** renders floating in the preview and is removed in-game. A standing
  lantern under a ceiling is fine.

```
minecraft:chain[axis=y,waterlogged=false]                (above)
minecraft:lantern[hanging=true,waterlogged=false]        (below the chain)
```

### Torches
- Floor torches are `minecraft:torch`, `soul_torch` and `redstone_torch[lit=true]`, with no facing.
- Wall torches are separate ids: `wall_torch`, `soul_wall_torch` and `redstone_wall_torch[lit=...]`. `facing`
  points **away from the wall**, the way the torch leans, and the supporting block is at `pos - facing`.

| torch at `pos`, wall block at | state |
|---|---|
| `pos + [0,0,1]` (wall to the south) | `wall_torch[facing=north]` |
| `pos + [-1,0,0]` (wall to the west) | `wall_torch[facing=east]` |
| `pos + [0,0,-1]` (wall to the north) | `wall_torch[facing=south]` |
| `pos + [1,0,0]` (wall to the east) | `wall_torch[facing=west]` |

To mount a torch on the outside of a wall whose outer face looks F, place it in the cell at `wallBlock + F` with
`facing=F`. **Never** write `torch[facing=...]`, which ignores the facing and stands upright.

### Rods and crystals (6-way `facing`)
`end_rod`, `lightning_rod` and amethyst `*_bud`/`amethyst_cluster` **point toward `facing`**. Their base sits on the
opposite face, so they attach to the block at `pos - facing`. Use `facing=up` on a floor, `down` under a ceiling,
and `north` on the north face of a block (the rod sticks out north).

```
minecraft:end_rod[facing=down]                                     ceiling light
minecraft:lightning_rod[facing=up,powered=false,waterlogged=false]
minecraft:amethyst_cluster[facing=up,waterlogged=false]
```

### Candles, campfires, lamps
- `candle` and the 16 coloured `*_candle` blocks: `candles=1|2|3|4`, `lit=true|false`, `waterlogged`.
  `candle_cake[lit=...]` and `<color>_candle_cake` are a cake with one candle.
- `campfire` and `soul_campfire`: `lit` (the vanilla **default is `true`**), `signal_fire` (tall smoke; vanilla sets
  it when a hay bale is below) and `facing`. `facing` only rotates the log layout, so treat it as cosmetic.
  `lit=false` is the unlit look.
- `redstone_lamp[lit=true]` renders lit. In-game an unpowered lit lamp switches off at its first block update, so
  power it (for example with a redstone block hidden behind) if it must stay on.
- `furnace`, `smoker` and `blast_furnace` with `lit=true` show the glowing front and stay that way until the furnace
  actually burns fuel.
- Always-on light blocks with no lit state: `glowstone`, `sea_lantern`, `shroomlight`, the three `*_froglight`
  blocks (they have `axis`), `jack_o_lantern` (face on the `facing` side), `end_rod` and both lanterns.

**Common mistakes:** `torch` against a wall instead of `wall_torch`; `wall_torch` facing **toward** the wall;
`lantern[hanging=true]` on the floor; and forgetting `lit=true` on candles.

---

## 9. Signs, banners and heads

### Standing `rotation` (0-15) [V], with a preview caveat [R]

Standing signs (`*_sign`), ceiling hanging signs (`*_hanging_sign`), standing banners (`*_banner`) and floor heads
(`skeleton_skull`, `wither_skeleton_skull`, `zombie_head`, `creeper_head`, `dragon_head`, `piglin_head`,
`player_head`) use `rotation` in 22.5° steps, **clockwise from south**. It gives the direction the front (sign text,
banner pattern, face) looks:

```
                 8 (north)
           10          6
     12 (east)           4 (west)
           14          2
                 0 (south)

0=S  1=SSW  2=SW  3=WSW  4=W  5=WNW  6=NW  7=NNW  8=N  9=NNE  10=NE  11=ENE  12=E  13=ESE  14=SE  15=SSE
```

A sign readable from a path to its south is `rotation=0`. A head looking east at the player is `rotation=12`.

> **Preview caveat (verified by render).** Lodestone turns these models **counter-clockwise**, so the preview
> mirrors east and west. `rotation=4` *displays* facing east, `rotation=2` displays a sign board running SW-NE
> instead of NW-SE, and `0` and `8` are correct. **Write the vanilla value from the table above; do not "fix" it
> to make the preview look right.** Wall variants (below) render correctly.

### Wall-mounted variants: `facing` points away from the wall [M][R][V]
- `*_wall_sign[facing=F]`: the board is on the F side of the wall block, the text reads from the F side, and the
  support is at `pos - F`.
- `*_wall_banner[facing=F]`: hangs on the F face of the support block. The banner block sits beside the top of the
  support, and the cloth hangs down about one more block, so leave the cell below it empty.
- `*_wall_skull` and `*_wall_head[facing=F]`: the face looks toward F. **These render as nothing in the preview.**

```js
// sign on the outside of a north-facing wall: wall block at [x,y,z], sign in the cell north of it
api.setBlock(s, [x, y, z - 1], 'minecraft:oak_wall_sign[facing=north,waterlogged=false]')
```

### Hanging signs [V][R]
- **Ceiling** `*_hanging_sign[rotation=r,attached=...]`. Use `attached=false` under a block with a full bottom face:
  it gets two straight vertical chains, and vanilla only produces rotations 0, 4, 8 and 12 there. Use
  `attached=true` under a chain, fence, wall or other narrow support: the chains form a V meeting at the centre, and
  any of the 16 rotations works. In-game placement chooses `attached=true` when the block above lacks a full bottom
  face.
- **Wall** `*_wall_hanging_sign[facing=F]`: the odd one out. The board's faces look toward F and its opposite, so
  the sign hangs **perpendicular to the wall**, from a bar sticking out of the wall. The supporting wall is on the
  sign's left or right (`pos + cw(F)` or `pos + ccw(F)`), not behind it. Example: a sign sticking out south from a
  wall to its north has its faces looking east and west, so use `facing=east` or `facing=west`.

### Banners and heads
- Banner colour is the block id (`red_banner`). Patterns come from block-entity NBT (`patterns`), which the preview
  does draw.
- Floor heads sit on the floor centre (8×8×8 px). `dragon_head` is bigger.

**Common mistakes:** `rotation` on wall signs or wall banners (they use `facing`); `facing` on standing signs (they
use `rotation`); counting rotation counter-clockwise (4 is **west**); and judging a rotation from the preview.

---

## 10. Vines, plants and natural blocks

### Leaves [V]
**Always write `persistent=true`.** Otherwise any structure-placed leaf more than 6 steps (through leaves) from a
log decays in-game, which eats away most hand-made canopies. Raw-API leaves default to `persistent=false,distance=7`.

```
minecraft:oak_leaves[distance=7,persistent=true,waterlogged=false]
minecraft:azalea_leaves[distance=7,persistent=true,waterlogged=false]
```

`distance` (1-7) does not change the look. It is fine to leave it at 7 when `persistent=true`.

### Multiface blocks: vines, glow lichen, sculk vein [M][R]
- `vine[north,east,south,west,up]`: each `true` side is a vine sheet on **that face of its own cell**, clinging to
  the block in that direction. `north=true` hangs on the south face of the block to the north; `up=true` hangs
  under the block above. A vine with every side `false` is invisible and invalid.
- `glow_lichen` and `sculk_vein` add `down`: `down=true` means on the floor, `up=true` on the ceiling.

```
minecraft:vine[east=false,north=true,south=false,up=false,west=false]                  on the wall to its north
minecraft:glow_lichen[down=true,east=false,north=false,south=false,up=false,waterlogged=false,west=false]   floor patch
```

For a vine curtain down a wall whose outside faces F, every vine block sits at `wall + F` with `<opposite(F)>=true`.
Vines on the outside of an east-facing wall use `west=true`.

### Two-block plants: `half=lower` at y, `half=upper` at y+1 [R][V]
The ids are `tall_grass`, `large_fern`, `sunflower`, `lilac`, `rose_bush`, `peony`, `pitcher_plant`,
`small_dripleaf` (also has `facing`) and `tall_seagrass`. A lone half renders as half a plant, and the game deletes
it.

```
minecraft:lilac[half=lower]    at [x, y, z]
minecraft:lilac[half=upper]    at [x, y+1, z]
```

### Hanging and climbing columns [R]
The tip is the end that grows. Every other block in the column is the `_plant` id.

| column | from the anchor outward | tip id |
|---|---|---|
| weeping vines (hang down from a ceiling) | `weeping_vines_plant` ... | `weeping_vines` (lowest) |
| twisting vines (grow up from a floor) | `twisting_vines_plant` ... | `twisting_vines` (highest) |
| cave vines (hang down) | `cave_vines_plant[berries=...]` ... | `cave_vines[age=0,berries=...]` (lowest) |
| kelp (grows up, underwater) | `kelp_plant` ... | `kelp[age=0]` (highest) |

`berries=true` gives glowing glow berries. Use `hanging_roots[waterlogged=false]` under rooted dirt or another
ceiling block.

### Pointed dripstone [M][R][V]
`vertical_direction=down` is a stalactite hanging from a ceiling, and `up` is a stalagmite on a floor. List the
`thickness` values from the attached end to the point:

| length | thickness from the anchor to the point |
|---|---|
| 1 | `tip` |
| 2 | `frustum`, `tip` |
| 3 | `base`, `frustum`, `tip` |
| n ≥ 4 | `base`, `middle` × (n-3), `frustum`, `tip` |

When a stalactite tip and a stalagmite tip touch, both tips are `tip_merge`. The default is
`vertical_direction=up`, so set it.

### Dripleaf, sea pickles and others [M][R]
- **Big dripleaf**: `big_dripleaf_stem[facing=F]` × n, topped by `big_dripleaf[facing=F,tilt=none]`, all with the
  same `facing`. The leaf faces F, and its stem is offset toward the opposite side.
- **Small dripleaf**: two blocks, `small_dripleaf[facing=F,half=lower]` and `[half=upper]`.
- **Sea pickles**: `sea_pickle[pickles=1..4,waterlogged=true]`. They only glow in-game when waterlogged, and the
  default is `true`.
- **Pink petals**: `pink_petals[facing=F,flower_amount=1..4]`.
- **Snow**: `snow[layers=1..8]`. `layers=8` is a full block. Ground under snow looks right with `snowy=true`
  (`grass_block`, `podzol`, `mycelium`).
- **Moss carpet** (`moss_carpet`), **azalea** and **flowering_azalea** have no states. `azalea_leaves` and
  `flowering_azalea_leaves` are leaves, so use `persistent=true`.
- **Flower pots**: use the `potted_*` id (`potted_poppy`, `potted_fern`, `potted_cactus`, `potted_azalea_bush`,
  `potted_oak_sapling`, and so on), with no NBT. An empty pot is `flower_pot`.
- **Mushroom blocks** (`red_mushroom_block`, `brown_mushroom_block`, `mushroom_stem`): the six booleans pick which
  faces show the outer texture.

### Waterlogging [R]
Anything with a `waterlogged` property that should sit in water needs `waterlogged=true`, including stairs, slabs,
fences, walls, lanterns, chains, signs, leaves and rods. The preview then draws a full water cube around the block.
`water[level=0]` is a still source block. `kelp`, `seagrass` and `bubble_column` are implicitly underwater.

**Common mistakes:** non-persistent leaves; one-half tall flowers; a faceless vine; stalactites with
`vertical_direction=up`; and placing `kelp` everywhere instead of `kelp_plant` with a single `kelp` tip.

---

## 11. Furniture and utility blocks

| block | states | meaning [tags] |
|---|---|---|
| `chest`, `trapped_chest`, `ender_chest` | `facing`, `type=single\|left\|right`, `waterlogged` | the latch and front face `facing` [R]. For a double chest see below |
| `barrel` | `facing` (6-way), `open` | the lid is on the `facing` face: `up` is lid on top, `north` is lid facing north [R] |
| `furnace`, `smoker`, `blast_furnace` | `facing`, `lit` | the front texture is on the `facing` face [M][R] |
| `dispenser`, `dropper` | `facing` (6-way), `triggered` | front (hole) on `facing` [M] |
| `observer` | `facing` (6-way), `powered` | the face is on `facing`; it watches `pos + facing` and outputs from the back [M] |
| `piston`, `sticky_piston` | `facing` (6-way), `extended` | the head pushes toward `facing` [M] |
| `hopper` | `facing=down\|north\|east\|south\|west`, `enabled` | the output spout points to `facing` [M] |
| `lectern` | `facing`, `has_book`, `powered` | the reader stands on the `facing` side, where the slope's low edge is [M][R] |
| `anvil` (and chipped or damaged) | `facing` | the long axis runs **along** `facing`'s axis: `facing=east` is long east-west [M][R] |
| `grindstone` | `face=floor\|wall\|ceiling`, `facing` | with `face=wall`, `facing` points away from the supporting wall [M][R] |
| buttons, `lever` | `face`, `facing`, `powered` | with `face=wall`, `facing` points away from the wall (support at `pos - facing`). On floor or ceiling, `facing` only turns the button or handle. Unpowered levers use the model named `lever_on` [M] |
| `bell` | `attachment=floor\|ceiling\|single_wall\|double_wall`, `facing` | see below [M][R] |
| `ladder` | `facing`, `waterlogged` | `facing` points away from the wall (support at `pos - facing`) [M][R] |
| pressure plates | `powered` (weighted plates use `power`) | no orientation |
| `carved_pumpkin`, `jack_o_lantern`, `beehive`, `bee_nest`, `loom` | `facing` | face or front on `facing` [M] |
| `campfire` | `facing`, `lit`, `signal_fire` | `facing` is cosmetic (log layout) |

**Double chest [V].** Both halves get the same `facing`, with one `type=left` and one `type=right`. "Left" is from
**the chest's own point of view**, looking out of its front. **Standing in front of the chest, the `type=left` half
is on your right.** The partner of a `type=left` block is at its `pos + cw(facing)`.

| facing | west/north block | east/south block |
|---|---|---|
| north (front faces north) | west block `type=left` | east block `type=right` |
| south | west block `type=right` | east block `type=left` |
| east | north block `type=left` | south block `type=right` |
| west | north block `type=right` | south block `type=left` |

The preview ignores `type` and draws two single chests.

**Bells [M][R][V].**
- `attachment=floor`: the frame posts stand on the two sides **across** `facing`. With `facing=north` the frame
  spans east-west.
- `ceiling`: hangs from the block above.
- `single_wall`: the bar reaches **toward `facing`**, so the supporting block is at `pos + facing`. This is the
  opposite of torches and ladders.
- `double_wall`: the bar spans between `pos + facing` and `pos - facing`.

```
bell hanging off a wall to its north:  minecraft:bell[attachment=single_wall,facing=north,powered=false]
```

**Entities are not available.** Item frames, glow item frames, paintings and armor stands are entities. The runner
and Lodestone write no structure entities, so use blocks instead (a wall banner, a sign, or a decorated pot on a
ledge).

**Common mistakes:** a furnace whose front faces the wall; ladders and buttons facing into their support; a bell
`facing` copied from a torch (it is reversed); and both chest halves `type=single` or both `left`.

---

## 12. Rotation and mirroring helper

Write a module once in local coordinates, then stamp it in four orientations. Each change below was checked by
voxelising every model: 354/354 combinations match. The kit already implements these in
`scripts/lib/kit/blocks.mjs` (`rotateBlock`, `mirrorBlock`), and they agree with this table except that `mirrorBlock`
does not swap chest `type`.

### Rotate 90° clockwise (seen from above: north → east → south → west)

| property | change |
|---|---|
| position in a module `sx × sz` | `(x, z) → (sz - 1 - z, x)`, and the new module size is `sz × sx` |
| `facing` (horizontal) | north → east → south → west → north. `up` and `down` are unchanged |
| `axis` | `x ↔ z`. `y` is unchanged |
| `rotation` (0-15) | `(r + 4) % 16` (use `+8` for 180°, `+12` for 90° counter-clockwise) |
| side keys `north/east/south/west` (fences, panes, walls, vines, lichen, mushroom blocks) | values move one step clockwise: new `east` = old `north`, new `south` = old `east`, new `west` = old `south`, new `north` = old `west` |
| stairs `shape`, `half` | **unchanged** |
| door `hinge`, chest `type`, bed `part`, slab `type` | unchanged |
| `orientation` (crafter, jigsaw) | rotate each horizontal part: `north_up` → `east_up` |
| rail `shape` (follows from the definition; not voxel-checked) | `north_south ↔ east_west`. Ascending: north → east → south → west. Corners: `north_east → south_east → south_west → north_west → north_east` |

### Mirror

| property | mirror east↔west (`x → sx - 1 - x`) | mirror north↔south (`z → sz - 1 - z`) |
|---|---|---|
| `facing` | east ↔ west | north ↔ south |
| stairs `shape` | **always swap left↔right** (`inner_left ↔ inner_right`, `outer_left ↔ outer_right`), whatever the facing | same |
| door `hinge` | left ↔ right | left ↔ right |
| chest `type` | left ↔ right | left ↔ right |
| `rotation` | `(16 - r) % 16` | `(24 - r) % 16` |
| side keys | swap `east` and `west` | swap `north` and `south` |
| `axis` | unchanged | unchanged |

```js
// Minimal helpers for raw-API recipes (the kit's rotateBlock/mirrorBlock cover more cases).
const CW = { north: 'east', east: 'south', south: 'west', west: 'north' }
const SWAP = { inner_left: 'inner_right', inner_right: 'inner_left', outer_left: 'outer_right', outer_right: 'outer_left', left: 'right', right: 'left' }
export function rotateProps(p, turns = 1) {
  let o = { ...p }
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
    const n = { ...o }
    if (CW[o.facing]) n.facing = CW[o.facing]
    if (o.axis === 'x' || o.axis === 'z') n.axis = o.axis === 'x' ? 'z' : 'x'
    if (o.rotation !== undefined) n.rotation = String((+o.rotation + 4) % 16)
    for (const d of Object.keys(CW)) if (d in o) n[CW[d]] = o[d]
    o = n
  }
  return o
}
export function mirrorPropsX(p) {          // east <-> west
  const o = { ...p }
  if (p.facing === 'east' || p.facing === 'west') o.facing = p.facing === 'east' ? 'west' : 'east'
  if (SWAP[p.shape]) o.shape = SWAP[p.shape]
  if (SWAP[p.hinge]) o.hinge = SWAP[p.hinge]
  if (SWAP[p.type]) o.type = SWAP[p.type]                       // chest halves
  if (p.rotation !== undefined) o.rotation = String((16 - +p.rotation) % 16)
  if ('east' in p || 'west' in p) { o.east = p.west; o.west = p.east }
  return o
}
```

Remember that rotating or mirroring a module changes where its neighbours are. If stairs, walls or fences in the
module touch blocks outside it, let the runner's connection pass recompute the shapes afterwards, which it does by
default.

---

## 13. What the Lodestone preview does not show (or shows differently) [R][M]

| case | preview behaviour | in-game |
|---|---|---|
| a block with **missing properties** on a `variants` blockstate (with `--no-default-states`) | nothing is drawn, because no variant key matches | the game fills defaults |
| a **wall** with no properties (with both runner passes off) | nothing is drawn (no `up`, no arms) | default state (a post), then re-derived from neighbours |
| `*_wall_skull`, `*_wall_head` (all 7) | **invisible** | rendered |
| plain `shulker_box` (uncoloured) | **invisible**: its model has no geometry, despite the note in `references/lodestone/default-pack-block-states.md` | rendered |
| coloured `*_shulker_box` | rendered with `facing` | rendered |
| standing sign, banner, ceiling hanging sign and floor head `rotation` | east and west **mirrored** (4 shows as 12, 2 as 14) | vanilla table in section 9 |
| double chest `type` | two single chests | one double chest |
| sign text, lectern book, enchanting-table book, campfire items, chest contents, spawner mob, beacon beam | not drawn | drawn |
| `waterlogged=true` | the block plus a full water cube | water around the block |
| `end_portal`, `end_gateway`, `moving_piston` | invisible | rendered |
| `air`, `light`, `barrier`, `structure_void` | invisible (as in-game) | invisible |
| entities (item frames, paintings, armor stands) | not supported by Lodestone structure export | n/a |
| support and survival rules (hanging lantern on nothing, half doors, faceless vines) | drawn anyway | removed when placed |
| `lit=true` on a lamp without power | drawn lit | turns off on its first update |

Special renderers that **do** match vanilla, checked by render: beds (`facing`, `part`), single chests, ender and
trapped chests (`facing`), wall signs, wall banners, wall hanging signs (`facing`), coloured shulker boxes, bell
bodies, decorated pots, conduits, and water and lava `level`.

---

## Appendix: verification log

- **Stairs**: geometry for all 40 states read from the models [M]; all shapes for `facing=north` and all straight
  facings rendered [R]. Roof algorithm rendered on an inward ring, an outward pit, a 7×9 hip roof, an east-west gable
  and an L-shaped hip roof with a valley; the corners were seamless, and the runner's pass produced identical shapes.
  Eave corbels, gable soffit, window sill and chair were all rendered.
- **Slabs and axis blocks**: 3 slab types and the half-step slope; 8 axis blocks × 3 axes [R].
- **Trapdoors**: all 16 `facing × half × open` combinations [M][R]; shutters, table top and ladder hatch in a house
  scene [R].
- **Doors**: all 16 `facing × hinge × open` lower halves [M][R]; double doors, open and closed [R].
- **Beds**: 4 facings [R].
- **Walls, fences, panes and gates**: straight, two-high, torch- and lantern-capped, L, T and cross walls; wall to
  pane, wall to gate (`in_wall`), fence to gate and nether-brick fence; slab or carpet on a wall [R]. Connection
  rules come from vanilla code and the 1.21.1 tags `walls`, `wall_post_override`, `fences`, `wooden_fences` and
  `fence_gates` [V].
- **Lights**: lanterns (standing, hanging, chain, floating mistake), torches (4 wall facings and soul and redstone
  variants), end and lightning rods, candles 1-4, candle cake, campfires, lamps, chains [M][R].
- **Signs, banners and heads**: rotation 0, 2, 4, 6, 8 and 12 rendered top-down and side-on, which exposed the
  preview's mirroring; vanilla direction comes from `RotationSegment.convertToSegment(playerYaw + 180)` and the
  vanilla renderers' negative Y rotation [V]. Wall sign and wall banner facings, hanging sign `attached`, and wall
  hanging sign axis [R].
- **Plants**: vines, lichen, dripstone sequences and `tip_merge`, amethyst, tall plants (and the lone-half mistake),
  dripleaf, sea pickles, vine columns, pots, snow, petals, waterlogging, `snowy` [R]. Defaults come from the block
  report [V].
- **Furniture**: chests, furnaces, barrels, lecterns, anvils, grindstones, bells (all 4 attachments), ladders,
  buttons, levers, shulker boxes, hoppers, pressure plates and decorated pots [R]; texture faces for observer,
  piston, dispenser, carved pumpkin, beehive and loom [M].
