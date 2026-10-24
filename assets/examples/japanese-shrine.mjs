// JAPANESE SHRINE — a shrine-temple precinct (jingu-ji) with a five-storey pagoda
//
// DESIGN
//   A stone approach (sando) runs north from the south edge through four vermilion torii, past
//   stone lanterns, into a raked-gravel courtyard. At its head stands the main hall (honden) with
//   a big hip-and-gable (irimoya) roof and a projecting entrance canopy (kohai). To the east,
//   offset from the axis as at Horyu-ji, rises a five-storey pagoda. A stroll garden fills the
//   south-east: a koi pond with an island lantern, a vermilion drum bridge, a little cascade, a
//   leaning black pine and a weeping cherry. The west side holds a purification pavilion
//   (chozuya), a moss garden with a water basin, a dry garden in the court, and a bamboo grove
//   that wraps the north edge as a green backdrop for both roofs.
//
// WHAT MAKES IT READ AS JAPANESE (and what to copy)
//   1. ROOFS ARE THE BUILDING. Every roof here comes from one technique: a heightfield in half
//      blocks, rasterized into slabs, stairs and blocks (see "SWEPT ROOFS" below). The pitch rises
//      ring by ring from the eave inward, e.g. [0.5, 0.5, 1, 1, 1]: shallow slab eaves that steepen
//      toward the ridge give the concave sweep. A `lift` near the corners raises the eave in
//      half-block steps (sori), so every corner flicks up. One shared heightfield also gives clean
//      hip lines, irimoya gables and the valley where the kohai meets the hall roof.
//   2. STRONG HORIZONTALS. Deep eaves (overhang 3-4) with a warm spruce soffit under dark tiles
//      draw a bright band under every roof. Brackets (upside-down stairs) fill the shadow under them.
//   3. FRAME OVER WALL. Dark posts and beams always show; walls are white screens between them.
//      Shoji are light lattice trapdoors hung one block OUTSIDE the wall plane over a white block,
//      which gives the facade relief while the interior face stays flush.
//   4. RESTRAINT. One accent colour (vermilion), used only on the torii and the bridge.
//
// PALETTE (role: block, L* lightness from references/building/block-colors.md)
//   roof tile        deepslate_tiles (23) + deepslate_bricks (30) in alternate courses ("ribs")
//   ridges, hips     polished_blackstone (21): one value darker than the field, reads as a line
//   soffit/rafters   spruce (38): warm mid value under the dark roof → the horizontal bands
//   posts, beams     dark_oak_log (20) / stripped_dark_oak_log (25)
//   walls            calcite (89), shoji = jungle_trapdoor over calcite; lit paper = ochre_froglight
//   stone            stone_bricks / andesite / polished_andesite (51-57), mossy accents
//   accent           red_terracotta (37) torii and bridge posts: closest hue (9°) to real vermilion,
//                    matte like lacquer; mangrove (31) fences as the thin rails.
//   ground           grass + moss (43), raked gravel = gravel (54) / light_gray_concrete_powder (64)
//   Why tile and not copper patina? Oxidized copper is a saturated, busy teal. Next to the vermilion
//   torii it would be a second loud accent and would compete with them. Dark grey tiles keep the
//   value structure simple: dark roof, warm soffit, white wall, dark frame, grey stone.
//
// PROPORTIONS
//   Pagoda: roof spans 19, 17, 15, 13, 11 (one block less per side per storey), bodies 11-9-9-7-7,
//     an eave every 6-7 blocks, sorin (finial) about 1/4 of the total height.
//   Hall: 17 x 13 post grid, 5 bays (centre bay widest), raised 3 blocks (stone kidan + wooden
//     deck), eave overhang 3, roof about 60 % of the visible height.
//   Torii: posts 7 and 9 tall, inner gap 5 and 7, kasagi overhanging 2 + upturned ends.
//
// LAYOUT (x east, z south; north is up)
//   z  0-6   bamboo backdrop ..............................................
//   z  8-27  moss garden | MAIN HALL (x 17-39)          | PAGODA (x 45-63)
//   z 29-40  dry garden  | raked-gravel courtyard, ema rack, large toro
//   z 41-68  chozuya     | SANDO + torii (x 24-32)     | koi pond, bridge, cascade
//   z 69-71  hedge ......... entrance ............................ hedge
//
// Kit used: builder, terrain, palette, boulder, tree (cherry), leafBlob, curve, line, disc,
// scatter, hangingLantern, hash/noise, finish (stair shapes, wall/fence connections). Everything
// roof-related is custom because b.roof cannot do curved skirts, corner lifts or irimoya yet.

const SIZE = [72, 54, 72]
const G = 4 // ground surface (grass top); things stand at G + 1

// ---------------------------------------------------------------------------- palette
const TILE = { stairs: 'minecraft:deepslate_tile_stairs', slab: 'minecraft:deepslate_tile_slab', block: 'minecraft:deepslate_tiles' }
const TILE_RIB = { stairs: 'minecraft:deepslate_brick_stairs', slab: 'minecraft:deepslate_brick_slab', block: 'minecraft:deepslate_bricks' }
const RIDGE = { stairs: 'minecraft:polished_blackstone_stairs', slab: 'minecraft:polished_blackstone_slab', block: 'minecraft:polished_blackstone' }
const SPRUCE = { stairs: 'minecraft:spruce_stairs', slab: 'minecraft:spruce_slab', block: 'minecraft:spruce_planks' }
const RAFTER = SPRUCE

const POST = 'minecraft:dark_oak_log[axis=y]'
const BEAM = axis => `minecraft:stripped_dark_oak_log[axis=${axis}]`
const PLASTER = 'minecraft:calcite'
const PAPER_LIT = 'minecraft:ochre_froglight' // cream "lit paper": glows behind lattices at night
const LATTICE = f => `minecraft:dark_oak_trapdoor[facing=${f},open=true,half=bottom]` // dark grid (pagoda doors)
const SHOJI = f => `minecraft:jungle_trapdoor[facing=${f},open=true,half=bottom]` // light grid over white = shoji
const VERMILION = 'minecraft:red_terracotta'
const BLACK = 'minecraft:polished_blackstone'

const DIRS = [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]]
const OPP = { east: 'west', west: 'east', north: 'south', south: 'north' }
// the four outer faces of a square body: [outward facing, dx, dz, axis running along the face]
const FACES = [['south', 0, 1, 'x'], ['north', 0, -1, 'x'], ['east', 1, 0, 'z'], ['west', -1, 0, 'z']]

// ============================================================================ SWEPT ROOFS
// A roof is a heightfield t(x, z) in HALF blocks over its eave outline. Ring k = distance from
// the outline. Levels follow the kit's pitch convention: rise per ring from the eave inward,
// first ring 0.5 (a slab) when the first rise is 0.5. Integer sums after the slab rings matter:
// [0.5, 0.5, 1, 1] gives 0.5, 1, 2, 3, so stairs land on whole blocks. [0.5, 0.5, 0.5, 1] gives
// 1.5, 2.5 ... and every row turns into slab-on-block steps.
function ringLevels(pitch, n) {
  const rise = i => Math.max(0.5, Math.round((Array.isArray(pitch) ? pitch[Math.min(i, pitch.length - 1)] : pitch) * 2) / 2)
  const out = [rise(0) <= 0.5 ? 0.5 : 1]
  for (let i = 1; i < n; i += 1) out.push(out[i - 1] + rise(i))
  return out
}

// roofField: builds the heightfield.
//   hip roof    ring = min(distance to x edges, distance to z edges)
//   gable       { axis, inset }: cells at least `inset` from the gable ends use only the cross
//               distance, so a gabled upper roof sits on the hip skirt. inset 0 = plain gable.
//               Irimoya = rasterize the hip field, then this field's gable cells on top.
//   stopRing    build only rings < stopRing: a pagoda "skirt" that stops at the storey above.
//   lift        sori: extra height near the outline corners, falling off by liftStep per block
//               of Manhattan distance from the corner. 1.5 = tips 1.5 blocks up.
//   hipBead     hip lines (diagonal staircase cells) are raised half a block and later painted
//               in the ridge material, so they read as continuous ridges.
function roofField({ x0, z0, x1, z1, pitch, stopRing = Infinity, gable = null, lift = 0, liftStep = 0.5, hipBead = true }) {
  const L = ringLevels(pitch, Math.ceil(Math.max(x1 - x0 + 1, z1 - z0 + 1) / 2) + 1)
  const field = new Map()
  let maxRing = 0
  for (let x = x0; x <= x1; x += 1) {
    for (let z = z0; z <= z1; z += 1) {
      const ex = Math.min(x - x0, x1 - x)
      const ez = Math.min(z - z0, z1 - z)
      let ring = Math.min(ex, ez)
      let sec = 'hip'
      if (gable && (gable.axis === 'x' ? ex : ez) >= gable.inset) {
        ring = gable.axis === 'x' ? ez : ex
        sec = 'gable'
      }
      if (ring >= stopRing) continue
      let t = L[ring]
      // a 4-connected staircase along the diagonal: diagonal-only contact would read as dots
      const hip = sec === 'hip' && Math.min(ex, ez) >= 1 && (ex === ez || ex === ez + 1)
      if (lift > 0) t += Math.max(0, Math.round((lift - liftStep * (ex + ez)) * 2) / 2)
      if (hip && hipBead) t += 0.5
      maxRing = Math.max(maxRing, ring)
      // `along` runs parallel to the eave; alternating materials on it draws the tile courses
      const along = sec === 'gable' ? (gable.axis === 'x' ? x : z) : ez <= ex ? x : z
      field.set(`${x},${z}`, { x, z, t, ring, sec, hip, along })
    }
  }
  for (const c of field.values()) c.ridge = c.sec === 'gable' && c.ring === maxRing
  field.levels = L
  return field
}

// rasterRoof: turns the heightfield into blocks. For each column the roof is a shell from the
// top surface `t` down to half a block below the lowest neighbour (min `thickness`), so the
// underside steps smoothly and there are no see-through gaps. The shell is cut into half-block
// pieces: full piece → block, or a stair (facing uphill) when a neighbour is a whole block lower;
// lower half → bottom slab; upper half → top slab.
//   Materials: the top piece uses the tile (ribs on alternate courses), hip and ridge cells use
//   `ridge`; pieces that stick out above the lowest neighbour are visible risers, so they get the
//   tile too; everything else is soffit and gets `under` (warm spruce rafters).
//   rim { test(x, z), floor }: extend matching columns (the wall line) down to `floor`, so the
//   roof closes onto the wall top.
//   only(cell): rasterize a subset (gable cells of an irimoya, or cells above another roof).
function rasterRoof(b, field, { y, mat = TILE, ribs = TILE_RIB, under = RAFTER, ridge = RIDGE, thickness = 1.5, rim = null, only = null }) {
  for (const c of field.values()) {
    if (only && !only(c)) continue
    let minN = Infinity
    const lower = []
    for (const [f, dx, dz] of DIRS) {
      const n = field.get(`${c.x + dx},${c.z + dz}`)
      if (!n || n.sec !== c.sec) continue // gable cells ignore the hip below them: thin rakes
      minN = Math.min(minN, n.t)
      if (n.t <= c.t - 1) lower.push([f, n.t])
    }
    let bottom = Math.min(c.t - thickness, minN - 0.5)
    if (rim && rim.test(c.x, c.z)) bottom = Math.min(bottom, rim.floor - y)
    const top = y + c.t
    const bot = y + bottom
    const face = ribs && c.along % 2 === 0 ? ribs : mat
    for (let yy = Math.floor(bot); yy < Math.ceil(top); yy += 1) {
      const lo = Math.max(bot, yy)
      const hi = Math.min(top, yy + 1)
      if (hi - lo < 0.5) continue
      const isTop = hi === top
      const m = isTop ? (c.hip || c.ridge ? ridge : face) : hi > y + minN ? face : under
      let block
      if (hi - lo === 1) {
        block = m.block
        if (isTop && lower.length) {
          const dirs = lower.map(l => l[0])
          const ridgeCell = dirs.some(d => dirs.includes(OPP[d])) || dirs.length > 2
          if (!ridgeCell) {
            lower.sort((p, q) => p[1] - q[1])
            block = `${m.stairs}[facing=${OPP[lower[0][0]]},half=bottom]` // kit finish() shapes the corners
          }
        }
      } else block = lo === yy ? `${m.slab}[type=bottom]` : `${m.slab}[type=top]`
      b.set(c.x, yy, c.z, block)
    }
  }
}

// Irimoya (hip-and-gable) = a hip field plus a gable field on the same outline, pitch and eave
// level: their long slopes coincide and the gable rises out of the hip ends. Hip cells under the
// gable part are skipped when they would poke through it (the raised hip beads near the ridge);
// the rest stay, because the hip ring at the gable end is the "shelf" the gable triangle stands on.
function irimoya(b, outline, { pitch, inset, axis = 'x', y, lift = 0, thickness = 1, rim = null }) {
  const hipF = roofField({ ...outline, pitch, lift })
  const gabF = roofField({ ...outline, pitch, gable: { axis, inset } })
  rasterRoof(b, hipF, { y, thickness, rim, only: c => { const g = gabF.get(`${c.x},${c.z}`); return g.sec === 'hip' || c.t <= g.t } })
  rasterRoof(b, gabF, { y, thickness, only: c => c.sec === 'gable' })
  return { hipF, gabF }
}

// lowest occupied block between y0 and y1 in a column (the underside of an eave), or null
function roofBottom(b, x, z, y0, y1) {
  for (let y = y0; y <= y1; y += 1) if (b.has(x, y, z)) return y
  return null
}

export default function build(api) {
  const { kit } = api
  const b = api.builder(SIZE, { seed: 11 })
  const rng = kit.rng(11)
  const hash = (x, z, s = 0) => kit.hash01(x, 0, z, s)

  // ========================================================================== GROUND
  // Flat where people walk (court, paths, buildings), with a few low tsukiyama (artificial hills)
  // in the garden: 1-3 blocks is enough to break the plane without fighting the architecture.
  const MOUNDS = [[9, 61, 7, 2], [67, 59, 5, 2], [61, 45, 4, 3], [64, 6, 7, 2], [5, 40, 5, 1]] // x, z, radius, height
  const mound = (x, z) => {
    let h = 0
    for (const [mx, mz, r, mh] of MOUNDS) {
      const d = Math.hypot(x - mx, z - mz) / r
      if (d < 1) h = Math.max(h, mh * (0.5 + 0.5 * Math.cos(Math.PI * d)) + 0.6 * kit.noise.fbm2(x, z, { scale: 4, seed: 21 }) * (1 - d))
    }
    return Math.max(0, Math.round(h))
  }
  // grass with clumped moss (palette scale 5): Japanese gardens are mossy, and clumps read as
  // natural growth where per-block noise would read as static
  const gy = b.terrain({
    base: 0,
    height: (x, z) => G + mound(x, z),
    layers: [{ depth: 1, paint: kit.palette({ grass_block: 6, moss_block: 3 }, { scale: 5, seed: 3 }) }, { depth: 2, paint: 'dirt' }, { paint: 'stone' }],
  })
  const STONE = kit.palette({ stone_bricks: 6, andesite: 2, polished_andesite: 2, mossy_stone_bricks: 1 }, { scale: 3, seed: 5 })
  // raked gravel: alternate rows of two greys a value step apart (ΔL* 10) read as rake furrows
  const RAKED_Z = (x, z) => (z % 2 === 0 ? 'minecraft:gravel' : 'minecraft:light_gray_concrete_powder')
  const RAKED_X = (x, z) => (x % 2 === 0 ? 'minecraft:gravel' : 'minecraft:light_gray_concrete_powder')

  // ========================================================================== PAGODA (goju-no-to)
  // Five storeys, each a white body framed in dark posts under its own swept roof. Roofs shrink by
  // one block per side per storey (E), bodies step in more slowly (W), so eaves stay deep (3-4
  // blocks) and the tower tapers like Horyu-ji. `eave` = block level of each eave's slab ring;
  // the 6-7 block rhythm keeps the roofs stacked tightly, with 2-3 rows of body between them.
  const PX = 54
  const PZ = 21
  const tiers = [
    { W: 5, E: 9, eave: 11, top: 12 },
    { W: 4, E: 8, eave: 18, top: 18 },
    { W: 4, E: 7, eave: 24, top: 24 },
    { W: 3, E: 6, eave: 30, top: 30 },
    { W: 3, E: 5, eave: 35, top: 35 },
  ]
  // gravel drip apron under the eaves, two-course stone platform (kidan), steps on all four sides
  b.box([PX - 9, G, PZ - 9], [PX + 9, G, PZ + 9], RAKED_X)
  b.box([PX - 7, G + 1, PZ - 7], [PX + 7, G + 1, PZ + 7], STONE)
  b.box([PX - 7, G + 2, PZ - 7], [PX + 7, G + 2, PZ + 7], 'polished_andesite')
  for (const [f, nx, nz] of FACES) {
    for (let u = -1; u <= 1; u += 1) {
      const sx = nx ? 0 : u
      const sz = nz ? 0 : u
      b.set(PX + sx + nx * 8, G + 1, PZ + sz + nz * 8, `stone_brick_stairs[facing=${OPP[f]}]`)
      b.set(PX + sx + nx * 7, G + 2, PZ + sz + nz * 7, `stone_brick_stairs[facing=${OPP[f]}]`)
    }
  }
  const pFloor = G + 3
  // Bodies: posts at the corners and flanking a centre bay; a beam row on top; white plaster
  // between. The ground storey gets a sill and a head beam, lit lattice doors in the centre bay
  // (the lattice hangs one block out, in front of glowing paper) and a lattice band in the side
  // bays. Upper storeys show only their top 2-3 rows, so they get a small dark lattice panel.
  tiers.forEach((t, i) => {
    const W = t.W
    const y0 = i === 0 ? pFloor : tiers[i - 1].top + 1
    const p = W >= 5 ? 2 : 1 // inner post offset: bays of 2-3-2 (W 5) or 2-1-2 (W 3, 4)
    b.box([PX - W + 1, y0 - 1, PZ - W + 1], [PX + W - 1, y0 - 1, PZ + W - 1], i === 0 ? 'polished_andesite' : 'dark_oak_planks')
    for (let y = y0; y <= t.top; y += 1) {
      const r = t.top - y // rows below the top beam
      for (let u = -W; u <= W; u += 1) {
        for (const [f, nx, nz, ax] of FACES) {
          const x = nx ? PX + nx * W : PX + u
          const z = nz ? PZ + nz * W : PZ + u
          const centre = Math.abs(u) < p
          let paint = PLASTER
          if (Math.abs(u) === W || Math.abs(u) === p) paint = POST
          else if (r === 0) paint = BEAM(ax)
          else if (i === 0) {
            if (y === y0 || r === 3) paint = BEAM(ax)
            else if (centre && r > 3) {
              paint = PAPER_LIT
              b.set(x + nx, y, z + nz, LATTICE(f))
            } else if (!centre && r === 4) paint = LATTICE(OPP[f])
          } else if (centre && (r === 1 || r === 2)) paint = LATTICE(OPP[f])
          b.set(x, y, z, paint)
        }
      }
    }
  })
  // Roofs: skirts that stop at the next body (stopRing), a pyramid on top. The steeper last rise
  // of the top roof [.., 2] lifts the apex for the finial. Rim = the body's wall line, so the
  // skirt closes onto the wall top.
  tiers.forEach((t, i) => {
    const next = tiers[i + 1]
    const field = roofField({
      x0: PX - t.E, z0: PZ - t.E, x1: PX + t.E, z1: PZ + t.E,
      pitch: next ? [0.5, 0.5, 1, 1, 1] : [0.5, 0.5, 1, 1, 1, 2],
      stopRing: next ? t.E - next.W : Infinity,
      lift: 1.5,
    })
    rasterRoof(b, field, { y: t.eave, rim: { test: (x, z) => Math.max(Math.abs(x - PX), Math.abs(z - PZ)) === t.W, floor: t.top + 1 } })
    // tokyo (bracket sets): a cove of upside-down stairs tucked under the soffit along the wall,
    // stepping out a second time at every post. It fills the dark gap between wall and eave.
    const W = t.W
    const p = W >= 5 ? 2 : 1
    for (let u = -W; u <= W; u += 1) {
      for (const [f, nx, nz] of FACES) {
        for (const k of [1, 2]) {
          if (k === 2 && !(Math.abs(u) === W || Math.abs(u) === p)) continue
          const x = nx ? PX + nx * (W + k) : PX + u
          const z = nz ? PZ + nz * (W + k) : PZ + u
          const rb = roofBottom(b, x, z, t.top - 1, t.top + 4)
          if (rb !== null && !b.has(x, rb - 1, z)) b.set(x, rb - 1, z, `${RAFTER.stairs}[facing=${OPP[f]},half=top]`)
        }
      }
    }
    // a lantern hangs under each upturned corner tip, where real pagodas hang wind bells (futaku)
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = PX + sx * t.E
      const z = PZ + sz * t.E
      const rb = roofBottom(b, x, z, t.eave - 2, t.eave + 3)
      if (rb !== null) b.set(x, rb - 1, z, 'minecraft:lantern[hanging=true]')
    }
  })
  // inside: a lantern on every storey floor (also keeps mobs from spawning in the dark storeys)
  tiers.forEach((t, i) => {
    const y0 = i === 0 ? pFloor : tiers[i - 1].top + 1
    for (const [sx, sz] of [[1, 1], [-1, -1]]) b.set(PX + sx * (t.W - 1), y0, PZ + sz * (t.W - 1), 'lantern')
  })
  // shinbashira (the central pillar, visible in a cutaway) and the sorin finial
  const apex = b.topY(PX, PZ)
  b.box([PX, pFloor, PZ], [PX, tiers[4].top, PZ], POST)
  for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
    if (dx || dz) b.set(PX + dx, apex - 1, PZ + dz, `${RIDGE.slab}[type=bottom]`) // roban collar
  }
  b.set(PX, apex, PZ, BLACK)
  b.set(PX, apex + 1, PZ, BLACK)
  // the rings: thick dark wall posts separated by thin copper rods (bronze glints), so the mast
  // reads as stacked rings and not as a plain pole
  const SORIN = ['polished_blackstone_wall', 'lightning_rod', 'polished_blackstone_wall', 'lightning_rod', 'polished_blackstone_wall',
    'lightning_rod', 'polished_blackstone_wall', 'lightning_rod', 'polished_blackstone_wall', 'chain', 'lightning_rod']
  SORIN.forEach((id, k) => b.set(PX, apex + 2 + k, PZ, id))

  // ========================================================================== MAIN HALL (honden)
  // Post grid of 5 x 3 bays. The centre bay (27-29) is the widest: Japanese halls always have an
  // odd number of bays so the entrance falls on the axis.
  const HX = [20, 23, 26, 30, 33, 36]
  const HZ = [11, 15, 19, 23]
  const hx0 = 20, hx1 = 36, hz0 = 11, hz1 = 23, hcx = 28
  const hFloor = G + 3 // wooden deck (block level); people stand at hFloor + 1
  const hTop = G + 8 // wall-top beam
  const onPerimeter = (x, z) => x === hx0 || x === hx1 || z === hz0 || z === hz1
  // gravel apron, 2-course stone kidan, then the raised wooden floor: veranda (engawa) in spruce,
  // tatami-coloured floor inside
  b.box([hx0 - 4, G, hz0 - 4], [hx1 + 4, G, hz1 + 4], RAKED_X)
  b.box([hx0 - 2, G + 1, hz0 - 2], [hx1 + 2, G + 2, hz1 + 2], STONE)
  b.box([hx0 - 2, hFloor, hz0 - 2], [hx1 + 2, hFloor, hz1 + 2], 'spruce_planks')
  b.box([hx0 + 1, hFloor, hz0 + 1], [hx1 - 1, hFloor, hz1 - 1], 'stripped_bamboo_block[axis=x]')
  for (let x = hcx - 3; x <= hcx + 3; x += 1) { // front steps: stone, then one wooden step
    b.set(x, G + 1, hz1 + 5, 'stone_brick_stairs[facing=north]')
    b.box([x, G + 1, hz1 + 3], [x, G + 1, hz1 + 4], 'stone_bricks')
    b.set(x, G + 2, hz1 + 4, 'stone_brick_stairs[facing=north]')
    b.set(x, G + 2, hz1 + 3, 'stone_bricks')
    b.set(x, hFloor, hz1 + 3, 'spruce_stairs[facing=north]')
  }

  // Irimoya roof (see irimoya() above). Four 0.5 rises make a long, almost flat eave, then 1:1
  // up to the ridge. Eave overhang 3, corner lift 2 for a strong sori on this large roof.
  const hy = G + 8
  const HPITCH = [0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1, 1]
  const outline = { x0: hx0 - 3, z0: hz0 - 3, x1: hx1 + 3, z1: hz1 + 3 }
  const INSET = 4 // the gable starts 4 rings in from the hip ends
  const onRim = (x, z) => onPerimeter(x, z) && x >= hx0 && x <= hx1 && z >= hz0 && z <= hz1
  const { hipF, gabF } = irimoya(b, outline, { pitch: HPITCH, inset: INSET, y: hy, lift: 2, rim: { test: onRim, floor: hTop + 1 } })
  {
    // Gable triangles: set back one block behind the rake (the overhang casts a shadow line),
    // white plaster on a beam with a king post. Bargeboards (hafu): spruce trapdoors on the rake.
    const L = gabF.levels
    const shelfTop = hy + L[INSET]
    for (const [gx, inward, out] of [[outline.x0 + INSET, 1, 'west'], [outline.x1 - INSET, -1, 'east']]) {
      const fx = gx + inward
      for (let z = outline.z0; z <= outline.z1; z += 1) {
        const c = gabF.get(`${fx},${z}`)
        if (!c || c.sec !== 'gable') continue
        const topPiece = Math.ceil(hy + c.t) - 1
        for (let y = shelfTop; y < topPiece; y += 1) b.set(fx, y, z, y === shelfTop ? BEAM('z') : z === (hz0 + hz1) / 2 ? POST : PLASTER)
        const rc = gabF.get(`${gx},${z}`)
        if (rc && rc.t > L[INSET]) b.set(gx - inward, Math.ceil(hy + rc.t) - 1, z, `minecraft:spruce_trapdoor[facing=${out},open=true,half=bottom]`, { keep: true })
      }
    }
    // munagi (ridge cap) with onigawara ends: a block plus an outward-rising stair, the "horns"
    const rz = (hz0 + hz1) / 2
    const ridgeTop = hy + gabF.get(`${hcx},${rz}`).t
    for (let x = outline.x0 + INSET; x <= outline.x1 - INSET; x += 1) b.set(x, ridgeTop, rz, `${RIDGE.slab}[type=bottom]`)
    for (const [x, f] of [[outline.x0 + INSET, 'east'], [outline.x1 - INSET, 'west']]) {
      b.set(x, ridgeTop, rz, BLACK)
      b.set(x, ridgeTop + 1, rz, `${RIDGE.stairs}[facing=${f},half=bottom]`)
    }
  }
  // Posts go in after the roof so they cut through the rim and stand clean.
  for (const x of HX) for (const z of HZ) if (onPerimeter(x, z)) b.box([x, hFloor, z], [x, hTop, z], POST)
  // Walls between the posts, row by row from the deck: koshi (dark panel), screen, nageshi (beam),
  // white frieze, top beam. Front: open centre bay, shoji doors over lit paper in the inner bays,
  // shoji windows in the outer bays. Shoji hang one block OUTSIDE the wall plane.
  const wallCell = (y, ax, kind) => {
    const r = y - hFloor
    if (r === 3 || y === hTop) return BEAM(ax)
    if (kind === 'door') return r <= 2 ? PAPER_LIT : PLASTER
    return r === 1 ? 'minecraft:dark_oak_planks' : PLASTER
  }
  for (let x = hx0 + 1; x < hx1; x += 1) {
    if (HX.includes(x)) continue
    const centreBay = x > 26 && x < 30
    const innerBay = (x > 23 && x < 26) || (x > 30 && x < 33)
    for (let y = hFloor + 1; y <= hTop; y += 1) {
      const r = y - hFloor
      b.set(x, y, hz0, wallCell(y, 'x', 'wall'))
      if (centreBay && r <= 2) { b.set(x, y, hz1, 'air'); continue }
      b.set(x, y, hz1, wallCell(y, 'x', innerBay ? 'door' : 'wall'))
      if ((innerBay && r <= 2) || (!innerBay && !centreBay && r === 2)) b.set(x, y, hz1 + 1, SHOJI('south'))
    }
  }
  for (let z = hz0 + 1; z < hz1; z += 1) {
    if (HZ.includes(z)) continue
    const midBay = z > 15 && z < 19
    for (let y = hFloor + 1; y <= hTop; y += 1) {
      for (const [x, f, out] of [[hx0, 'west', -1], [hx1, 'east', 1]]) {
        b.set(x, y, z, wallCell(y, 'z', 'wall'))
        if (midBay && y === hFloor + 2) b.set(x + out, y, z, SHOJI(f))
      }
    }
  }
  // interior: coffered ceiling, an altar dais with a gold "mirror", lanterns, candles, offerings
  b.box([hx0 + 1, hTop + 1, hz0 + 1], [hx1 - 1, hTop + 1, hz1 - 1], 'dark_oak_planks', { keep: true })
  b.box([hcx - 3, hFloor + 1, hz0 + 1], [hcx + 3, hFloor + 1, hz0 + 2], 'dark_oak_planks')
  b.box([hcx - 2, hFloor + 1, hz0 + 3], [hcx + 2, hFloor + 1, hz0 + 3], 'dark_oak_stairs[facing=north]')
  b.box([hcx, hFloor + 2, hz0 + 1], [hcx, hFloor + 3, hz0 + 1], 'gold_block')
  for (const dx of [-2, 2]) {
    b.set(hcx + dx, hFloor + 2, hz0 + 1, 'dark_oak_fence')
    b.set(hcx + dx, hFloor + 3, hz0 + 1, 'lantern')
    b.set(hcx + dx, hFloor + 2, hz0 + 2, 'candle[candles=3,lit=true]')
  }
  for (const dx of [-1, 1]) b.set(hcx + dx, hFloor + 2, hz0 + 2, 'decorated_pot[facing=south]')
  // veranda railing, open at the steps
  for (let x = hx0 - 2; x <= hx1 + 2; x += 1) {
    if (x < hcx - 3 || x > hcx + 3) b.set(x, hFloor + 1, hz1 + 2, 'dark_oak_fence')
    b.set(x, hFloor + 1, hz0 - 2, 'dark_oak_fence')
  }
  for (let z = hz0 - 2; z <= hz1 + 2; z += 1) {
    b.set(hx0 - 2, hFloor + 1, z, 'dark_oak_fence')
    b.set(hx1 + 2, hFloor + 1, z, 'dark_oak_fence')
  }
  // masugumi: a bracket under the eave at every perimeter post, stepping out twice; it gives the
  // eave a rhythm that matches the bays
  for (const x of HX) for (const z of HZ) {
    if (!onPerimeter(x, z)) continue
    for (const [f, nx, nz] of FACES) {
      if ((nx === 1 && x !== hx1) || (nx === -1 && x !== hx0) || (nz === 1 && z !== hz1) || (nz === -1 && z !== hz0)) continue
      for (const k of [1, 2]) {
        const rb = roofBottom(b, x + nx * k, z + nz * k, hTop - 1, hTop + 4)
        if (rb !== null && !b.has(x + nx * k, rb - 1, z + nz * k)) b.set(x + nx * k, rb - 1, z + nz * k, `${RAFTER.stairs}[facing=${OPP[f]},half=top]`)
      }
    }
  }
  // Kohai: a gabled canopy projecting over the steps, on two posts. It is a second heightfield
  // (ridge along z). Only the cells that rise ABOVE the main roof are rasterized, so the union of
  // the two surfaces forms the valley where they meet. No valley code needed.
  {
    const kx0 = hcx - 5, kx1 = hcx + 5, kz0 = hz1 - 3, kz1 = hz1 + 6
    const ky = hTop - 1
    for (const x of [kx0 + 1, kx1 - 1]) {
      b.box([x, G + 1, kz1 - 1], [x, ky - 1, kz1 - 1], POST)
      b.set(x, G + 1, kz1 - 1, 'polished_andesite') // stone post footing
      b.box([x, ky - 1, hz1 + 1], [x, ky - 1, kz1 - 1], BEAM('z'))
    }
    b.box([kx0 + 1, ky - 1, kz1 - 1], [kx1 - 1, ky - 1, kz1 - 1], BEAM('x'))
    const kF = roofField({ x0: kx0, z0: kz0, x1: kx1, z1: kz1, pitch: [0.5, 0.5, 1, 1, 1, 1], gable: { axis: 'z', inset: 0 }, lift: 1 })
    const mainTop = (x, z) => {
      const g = gabF.get(`${x},${z}`)
      const h = hipF.get(`${x},${z}`)
      return Math.max(g && g.sec === 'gable' ? hy + g.t : -Infinity, h ? hy + h.t : -Infinity)
    }
    rasterRoof(b, kF, { y: ky, thickness: 1, only: c => ky + c.t > mainTop(c.x, c.z) })
    for (let x = kx0 + 1; x <= kx1 - 1; x += 1) { // front gable: plaster triangle + king post
      const topPiece = Math.ceil(ky + kF.get(`${x},${kz1 - 1}`).t) - 1
      for (let y = ky; y < topPiece; y += 1) b.set(x, y, kz1 - 1, x === hcx ? POST : PLASTER)
    }
    b.set(hcx, Math.ceil(ky + kF.get(`${hcx},${kz1}`).t), kz1, `${RIDGE.stairs}[facing=north,half=bottom]`)
    for (let z = kz0; z <= kz1; z += 1) {
      const c = kF.get(`${hcx},${z}`)
      if (ky + c.t > mainTop(hcx, z)) b.set(hcx, Math.ceil(ky + c.t), z, `${RIDGE.slab}[type=bottom]`, { keep: true })
    }
    b.hangingLantern([hcx, ky - 1, kz1 - 1], 0)
  }
  // suzu (shrine bell) on a chain in the open bay, offering box (saisen-bako) in front of it
  b.set(hcx, hFloor + 3, hz1 + 1, 'minecraft:chain')
  b.set(hcx, hFloor + 2, hz1 + 1, 'minecraft:bell[attachment=ceiling,facing=south]')
  for (const dx of [-1, 0, 1]) b.set(hcx + dx, hFloor + 1, hz1 + 2, 'spruce_trapdoor[half=top,facing=south]')
  // lanterns hung from the eave soffit around the veranda
  for (const [x, z] of [[hx0 + 3, hz1 + 2], [hx1 - 3, hz1 + 2], [hx0 - 2, hz1 + 2], [hx1 + 2, hz1 + 2], [hx0 - 2, hz0 - 2], [hx1 + 2, hz0 - 2], [hx0 - 2, (hz0 + hz1) / 2], [hx1 + 2, (hz0 + hz1) / 2]]) {
    const rb = roofBottom(b, x, z, hFloor + 2, hTop + 4)
    if (rb !== null) b.set(x, rb - 1, z, 'lantern[hanging=true]')
  }

  // ========================================================================== COURTYARD
  // Raked gravel (shiki-jari) with furrows parallel to the hall front.
  for (let x = 13; x <= 64; x += 1) for (let z = 29; z <= 40; z += 1) if (!b.has(x, G + 1, z)) b.set(x, G, z, RAKED_Z(x, z))
  // karesansui corner: three set stones on moss islands, the rake lines ringing them
  const rocks = [[16, 33, 1.8], [20, 37, 1.2], [14, 38, 0.9]]
  for (let x = 13; x <= 23; x += 1) for (let z = 30; z <= 40; z += 1) {
    let best = Infinity
    for (const [rx, rz, rr] of rocks) best = Math.min(best, Math.hypot(x - rx, z - rz) - rr)
    if (best < 4) b.set(x, G, z, Math.floor(best) % 2 === 0 ? 'minecraft:gravel' : 'minecraft:light_gray_concrete_powder')
  }
  for (const [rx, rz, rr] of rocks) {
    b.boulder([rx, G + 1, rz], [rr + 0.4, rr * 1.1, rr + 0.2], kit.palette({ andesite: 3, tuff: 2, stone: 2 }, { scale: 2 }), { seed: rx, mossTop: 'moss_block' })
    b.disc([rx, G, rz], rr + 1.2, 'moss_block', { only: ['minecraft:gravel', 'minecraft:light_gray_concrete_powder'] })
  }
  for (let z = 30; z <= 40; z += 1) b.set(24, G, z, 'polished_andesite') // curb stones
  for (let x = 13; x <= 24; x += 1) b.set(x, G, 29, 'polished_andesite')
  // ema-kake: a rack of votive plaques (fence frame, small open birch trapdoors as the plaques)
  for (let x = 40; x <= 44; x += 1) {
    const end = x === 40 || x === 44
    if (end) b.set(x, G + 1, 30, 'dark_oak_fence')
    b.set(x, G + 2, 30, 'dark_oak_fence')
    b.set(x, G + 3, 30, `${RAFTER.slab}[type=bottom]`)
    if (!end) {
      b.set(x, G + 2, 31, 'minecraft:birch_trapdoor[facing=south,open=true,half=top]')
      b.set(x, G + 2, 29, 'minecraft:birch_trapdoor[facing=north,open=true,half=top]')
    }
  }
  b.disc([62, G, 33], 2.5, 'moss_block') // moss bed for the courtyard cherry

  // ========================================================================== PATHS
  // Ishidatami flagstones: 2 x 2 stones in staggered rows; every stone gets one of three greys
  // (one hash per stone, not per block), so the joints read as cut stone.
  const flag = (x, z) => {
    const row = Math.floor(z / 2)
    const col = Math.floor((x + (row % 2)) / 2)
    const h = kit.hash01(col, 0, row, 7)
    return h < 0.4 ? 'minecraft:polished_andesite' : h < 0.75 ? 'minecraft:smooth_stone' : 'minecraft:andesite'
  }
  // sando: 3-wide flagstones in a 9-wide band of raked gravel with curb stones
  for (let z = 29; z <= 71; z += 1) {
    for (let x = 24; x <= 32; x += 1) {
      const centre = x >= hcx - 1 && x <= hcx + 1
      if (z <= 40 && !centre) continue
      b.set(x, G, z, centre ? flag(x, z) : x === 24 || x === 32 ? 'minecraft:polished_andesite' : RAKED_X(x, z))
    }
  }
  for (let x = 30; x <= PX + 1; x += 1) for (let z = 35; z <= 37; z += 1) b.set(x, G, z, flag(x, z)) // to the pagoda
  for (let x = PX - 1; x <= PX + 1; x += 1) for (let z = PZ + 9; z <= 37; z += 1) b.set(x, G, z, flag(x, z))

  // ========================================================================== TORII
  // Myojin torii: posts on black feet (nemaki), tie beam (nuki) poking 1 past the posts, a black
  // plaque (gakuzuka), the lower lintel (shimaki) and a black top lintel (kasagi) that overhangs 2
  // and ends in an upturned stair + slab. Spacing tightens toward the hall (9, 6, 6) and the gates
  // shrink after the great gate: the rhythm pulls the eye up the path.
  const torii = (cx, z, gap, H) => {
    const half = Math.floor(gap / 2) + 1
    for (const sx of [-half, half]) {
      b.set(cx + sx, G + 1, z, BLACK)
      b.box([cx + sx, G + 2, z], [cx + sx, G + H, z], VERMILION)
    }
    b.box([cx - half - 1, G + H - 2, z], [cx + half + 1, G + H - 2, z], VERMILION)
    b.set(cx, G + H - 1, z, BLACK)
    b.box([cx - half - 1, G + H, z], [cx + half + 1, G + H, z], VERMILION)
    b.box([cx - half - 2, G + H + 1, z], [cx + half + 2, G + H + 1, z], BLACK)
    for (const [sx, f] of [[-1, 'west'], [1, 'east']]) {
      b.set(cx + sx * (half + 3), G + H + 1, z, `${RIDGE.stairs}[facing=${f},half=top]`)
      b.set(cx + sx * (half + 3), G + H + 2, z, `${RIDGE.slab}[type=bottom]`)
    }
  }
  torii(hcx, 64, 7, 9) // o-torii at the entrance
  torii(hcx, 55, 5, 7)
  torii(hcx, 49, 5, 7)
  torii(hcx, 43, 5, 7)
  // shamei-hyo: the tall stone pillar bearing the shrine's name, beside the entrance
  b.box([20, G + 1, 66], [21, G + 1, 67], 'stone_bricks')
  b.box([20, G + 2, 66], [20, G + 5, 66], 'polished_andesite')
  b.set(20, G + 6, 66, 'andesite_slab[type=bottom]')

  // ========================================================================== TORO (stone lanterns)
  // Small: base, wall-post shaft (thinner than a block), platform slab, lantern firebox, slab cap.
  // Large (kasuga style): stair-flared foot and platform, and a 3 x 3 stair umbrella, the kasa.
  const smallToro = (x, z, y = G + 1) => {
    b.set(x, y, z, 'polished_andesite')
    b.set(x, y + 1, z, 'andesite_wall')
    b.set(x, y + 2, z, 'polished_andesite_slab[type=top]')
    b.set(x, y + 3, z, 'lantern')
    b.set(x, y + 4, z, 'andesite_slab[type=bottom]')
  }
  const kasa = (cx, y, cz) => { // 3 x 3 umbrella roof: stairs rising to a centre block
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
      if (!dx && !dz) { b.set(cx, y, cz, 'polished_andesite'); continue }
      const f = Math.abs(dx) >= Math.abs(dz) ? (dx < 0 ? 'east' : 'west') : (dz < 0 ? 'south' : 'north')
      b.set(cx + dx, y, cz + dz, `andesite_stairs[facing=${f}]`)
    }
    b.set(cx, y + 1, cz, 'stone_button[face=floor]') // hoju (jewel) on top
  }
  const bigToro = (cx, cz) => {
    b.set(cx, G + 1, cz, 'polished_andesite')
    for (const [f, dx, dz] of DIRS) b.set(cx - dx, G + 1, cz - dz, `andesite_stairs[facing=${f}]`)
    b.set(cx, G + 2, cz, 'andesite_wall')
    b.set(cx, G + 3, cz, 'polished_andesite_slab[type=top]')
    for (const [f, dx, dz] of DIRS) b.set(cx - dx, G + 3, cz - dz, `andesite_stairs[facing=${f},half=top]`)
    b.set(cx, G + 4, cz, 'lantern')
    kasa(cx, G + 5, cz)
  }
  for (const z of [60, 52, 46]) { smallToro(22, z); smallToro(34, z) } // between the torii
  bigToro(23, 32); bigToro(33, 32) // flanking the hall steps
  bigToro(PX - 5, 33); bigToro(PX + 5, 33) // flanking the pagoda path

  // ========================================================================== POND, CASCADE, BRIDGE
  // Pond = union of three noisy ellipses (two lobes and a waist for the bridge) minus an island.
  // Water sits one block below the banks, so the edge casts a shadow line.
  const lobes = [[46, 53, 6.5, 5], [53, 53, 5, 3], [61, 56, 7.5, 7]] // cx, cz, rx, rz
  const island = [63, 58, 2.2]
  const inPond = (x, z) => {
    const w = 1 + 0.18 * kit.noise.fbm2(x, z, { scale: 6, seed: 9 })
    return lobes.some(([cx, cz, rx, rz]) => ((x - cx) / (rx * w)) ** 2 + ((z - cz) / (rz * w)) ** 2 <= 1)
  }
  const pond = new Set()
  for (let x = 36; x <= 70; x += 1) for (let z = 42; z <= 66; z += 1) {
    if (inPond(x, z) && Math.hypot(x - island[0], z - island[1]) > island[2]) pond.add(`${x},${z}`)
  }
  const isEdge = (x, z) => DIRS.some(([, dx, dz]) => !pond.has(`${x + dx},${z + dz}`))
  for (const k of pond) {
    const [x, z] = k.split(',').map(Number)
    b.clear([x, G, z], [x, G + 4, z])
    b.set(x, G - 1, z, 'water')
    b.set(x, G - 2, z, isEdge(x, z) ? 'minecraft:gravel' : 'water') // shallow margin
    b.set(x, G - 3, z, kit.palette({ clay: 3, gravel: 2, mud: 1 }, { scale: 2 }))
  }
  // a rocky rim: about one edge cell in five gets a mossy boulder, half in the water
  for (const k of pond) {
    const [x, z] = k.split(',').map(Number)
    if (!isEdge(x, z) || hash(x, z, 31) > 0.22) continue
    if (x >= 50 && x <= 56 && z >= 46 && z <= 59) continue // keep the bridge clear
    const r = 0.8 + hash(x, z, 32) * 0.9
    b.boulder([x, G - 0.5, z], [r + 0.3, r * 0.8, r], kit.palette({ andesite: 3, stone: 2, tuff: 2, mossy_cobblestone: 2 }, { scale: 2 }), { seed: x * 3 + z, mossTop: 'moss_block' })
  }
  // koi: wool blocks one block under the surface show through the water as soft orange shapes
  for (const [x, z, c] of [[45, 52, 'orange_wool'], [47, 54, 'white_wool'], [59, 55, 'orange_wool'], [61, 57, 'orange_wool'], [58, 59, 'white_wool'], [43, 55, 'orange_wool']]) b.set(x, G - 2, z, c)
  for (let i = 0; i < 22; i += 1) {
    const x = rng.int(38, 68)
    const z = rng.int(43, 65)
    if (b.nameAt(x, G - 1, z) === 'minecraft:water' && !b.has(x, G, z)) b.set(x, G, z, 'lily_pad')
  }
  // island with a yukimi-doro (snow-viewing lantern: short shaft, wide umbrella)
  {
    const [ix, iz] = island
    b.boulder([ix, G - 0.2, iz], [2.4, 1.2, 2.2], kit.palette({ andesite: 3, tuff: 2, mossy_cobblestone: 2 }, { scale: 2 }), { seed: 5, mossTop: 'moss_block' })
    const ty = b.topY(ix, iz) + 1
    b.set(ix, ty, iz, 'andesite_wall')
    b.set(ix, ty + 1, iz, 'lantern')
    kasa(ix, ty + 2, iz)
  }
  // cascade (taki): mossy rocks frame a 2-wide channel on the north hill; water steps down one
  // block per block into the pond. It faces south so the main views see it.
  {
    const ROCK = kit.palette({ tuff: 3, andesite: 3, stone: 2, mossy_cobblestone: 2 }, { scale: 2, seed: 17 })
    const cx = [60, 61]
    let zEdge = 99
    for (const x of cx) for (let z = 40; z < 66; z += 1) if (pond.has(`${x},${z}`)) { zEdge = Math.min(zEdge, z); break }
    b.boulder([58.6, G + 2, zEdge - 4], [1.8, 2.6, 2.4], ROCK, { seed: 3, mossTop: 'moss_block' })
    b.boulder([62.6, G + 2, zEdge - 3.5], [1.8, 2.2, 2.4], ROCK, { seed: 4, mossTop: 'moss_block' })
    b.boulder([60.5, G + 3, zEdge - 6.5], [2.4, 2.8, 1.6], ROCK, { seed: 5, mossTop: 'moss_block' })
    for (let k = 0; k <= 4; k += 1) {
      const z = zEdge - 5 + k
      const y = G + 3 - k
      for (const x of cx) {
        b.clear([x, y, z], [x, y + 5, z])
        b.set(x, y, z, 'water')
        b.set(x, y - 1, z, ROCK)
        for (const side of [cx[0] - 1, cx[1] + 1]) if (!b.has(side, y, z)) b.set(side, y, z, ROCK)
      }
    }
  }
  // Taiko-bashi (drum bridge): the deck is an arched heightfield drawn by the ROOF rasterizer.
  // Stairs automatically face uphill toward the crown, slabs fill the half steps.
  {
    const deck = new Map()
    for (let z = 46; z <= 59; z += 1) {
      const d = Math.abs(z - 52.5)
      const t = d < 2 ? 3 : d < 3 ? 2.5 : d < 4 ? 2 : d < 5 ? 1.5 : d < 6 ? 1 : 0.5
      for (let x = 52; x <= 54; x += 1) deck.set(`${x},${z}`, { x, z, t, sec: 'deck' })
    }
    rasterRoof(b, deck, { y: G, mat: SPRUCE, ribs: null, under: SPRUCE, ridge: SPRUCE, thickness: 1 })
    // vermilion posts with black caps, mangrove-fence rails following the arch, lanterns at the ends
    for (let z = 46; z <= 59; z += 1) {
      const ry = Math.ceil(G + deck.get(`52,${z}`).t)
      for (const x of [51, 55]) {
        const end = z === 46 || z === 59
        const post = end || z === 49 || z === 56
        b.set(x, ry - 1, z, post ? VERMILION : `${SPRUCE.slab}[type=top]`)
        b.set(x, ry, z, post ? VERMILION : 'mangrove_fence')
        if (end) b.set(x, ry + 1, z, 'lantern')
        else if (post) b.set(x, ry + 1, z, `${RIDGE.slab}[type=bottom]`)
      }
    }
    for (const z of [50, 55]) for (const x of [52, 54]) b.box([x, G - 3, z], [x, G + 1, z], 'dark_oak_log') // piers
  }

  // ========================================================================== CHOZUYA
  // Purification pavilion beside the approach: four posts, a stone trough, and a small irimoya
  // made with the same two-field trick as the hall (lift 1 at this small scale).
  {
    const cx0 = 12, cx1 = 18, cz0 = 43, cz1 = 45 // post lines
    const cmx = (cx0 + cx1) / 2, cmz = (cz0 + cz1) / 2
    b.box([cx0 - 1, G, cz0 - 1], [cx1 + 1, G, cz1 + 1], 'polished_andesite')
    for (const x of [cx0, cx1]) for (const z of [cz0, cz1]) b.box([x, G + 1, z], [x, G + 3, z], POST)
    b.box([cx0, G + 4, cz0], [cx1, G + 4, cz0], BEAM('x'))
    b.box([cx0, G + 4, cz1], [cx1, G + 4, cz1], BEAM('x'))
    b.box([cx0, G + 4, cz0], [cx0, G + 4, cz1], BEAM('z'))
    b.box([cx1, G + 4, cz0], [cx1, G + 4, cz1], BEAM('z'))
    const co = { x0: cx0 - 2, z0: cz0 - 2, x1: cx1 + 2, z1: cz1 + 2 }
    const { gabF: cG } = irimoya(b, co, { pitch: [0.5, 0.5, 1, 1, 1], inset: 2, y: G + 4, lift: 1 })
    for (const [x, f] of [[cx0, 'east'], [cx1, 'west']]) {
      for (let z = cz0 - 2; z <= cz1 + 2; z += 1) { // close the small gable triangles with boards
        const c = cG.get(`${x},${z}`)
        for (let y = G + 5; y < Math.ceil(G + 4 + c.t) - 1; y += 1) b.set(x, y, z, 'spruce_planks', { keep: true })
      }
      b.set(x, Math.ceil(G + 4 + cG.get(`${x},${cmz}`).t), cmz, `${RIDGE.stairs}[facing=${f},half=bottom]`) // onigawara
    }
    b.box([cx0 + 2, G + 1, cz0], [cx1 - 2, G + 1, cz1], 'polished_andesite') // trough
    b.box([cx0 + 3, G + 1, cz0 + 1], [cx1 - 3, G + 1, cz1 - 1], 'water')
    b.set(cx0 + 1, G + 1, cz0 + 1, 'polished_andesite_slab')
    b.set(cx1 - 1, G + 1, cz0 + 1, 'polished_andesite_slab')
    b.hangingLantern([cmx, G + 4, cz1], 0)
    for (let x = cx1 + 2; x <= 23; x += 1) b.set(x, G, cmz, 'polished_andesite') // spur from the sando
  }

  // ========================================================================== STEPPING STONES
  // tobi-ishi: slabs every second step along a polyline, jittered ±0.5, so the path wanders
  const stepping = (pts, seed) => {
    let acc = 0
    for (let i = 1; i < pts.length; i += 1) {
      const [ax, az] = pts[i - 1]
      const [bx, bz] = pts[i]
      const len = Math.hypot(bx - ax, bz - az)
      for (let d = 0; d < len; d += 1) {
        acc += 1
        if (acc % 2) continue
        const t = d / len
        const x = Math.round(ax + (bx - ax) * t + (hash(acc, seed) - 0.5))
        const z = Math.round(az + (bz - az) * t + (hash(seed, acc) - 0.5))
        if (b.has(x, G + 1, z) || !b.has(x, G, z)) continue
        b.set(x, G + 1, z, hash(x, z, 5) < 0.5 ? 'smooth_stone_slab' : 'polished_andesite_slab')
      }
    }
  }
  stepping([[33, 58], [40, 60], [46, 61], [52, 61], [53, 60]], 1) // sando → bridge
  stepping([[53, 44], [53, 42]], 2) // bridge → courtyard
  stepping([[15, 28], [13, 24], [12, 20], [13, 16]], 3) // court → moss garden

  // ========================================================================== MOSS GARDEN + TSUKUBAI
  b.box([8, G, 8], [16, G, 27], kit.palette({ moss_block: 5, grass_block: 1 }, { scale: 3, seed: 8 }))
  b.set(11, G + 1, 15, 'mossy_cobblestone')
  b.set(12, G + 1, 15, 'water_cauldron[level=3]') // the low stone basin
  b.set(12, G + 1, 14, 'mossy_cobblestone')
  b.set(13, G + 1, 14, 'stone')
  for (let k = 0; k < 3; k += 1) b.set(12, G + 1 + k, 13, 'bamboo[age=1,stage=0,leaves=none]') // spout post
  smallToro(14, 12)

  // ========================================================================== VEGETATION
  // Bamboo grove: a noisy-edged band along the west, north and north-east edges. Clumped stalks,
  // 8-14 tall, leaves only on the top three blocks, thick and thin stalks mixed.
  const bamboo = (x, z, h, thick) => {
    for (let k = 0; k < h; k += 1) {
      const leaves = k >= h - 2 ? 'large' : k === h - 3 ? 'small' : 'none'
      b.set(x, gy(x, z) + 1 + k, z, `minecraft:bamboo[age=${thick ? 1 : 0},stage=0,leaves=${leaves}]`)
    }
  }
  const groveFloor = kit.palette({ moss_block: 5, podzol: 3, coarse_dirt: 1 }, { scale: 2.5, seed: 12 })
  for (let x = 0; x <= 71; x += 1) for (let z = 0; z <= 40; z += 1) {
    const edge = 0.9 * kit.noise.fbm2(x, z, { scale: 5, seed: 4 })
    const inGrove = x <= 6 + edge * 2 || z <= 3 + edge * 1.5 || (x >= 67 + edge * 1.5 && z <= 24)
    if (!inGrove || b.has(x, gy(x, z) + 1, z)) continue
    b.set(x, gy(x, z), z, groveFloor)
    if (hash(x, z, 1) < 0.34) bamboo(x, z, 8 + Math.floor(hash(x, z, 2) * 7), hash(x, z, 3) < 0.5)
  }
  // Cherries: few and placed, not scattered: one frames the entrance, one is a pink note behind
  // the roofs, one lights up the court, and a weeping cherry leans over the pond. Kept 8+ blocks
  // from the canvas edge (crowns are ~6 wide). `log: 'cherry_wood'` gives bark on every face
  // (horizontal cherry_log branches would show pink end-grain rings).
  const cherry = (x, z, seed, opts = {}) => b.tree([x, gy(x, z) + 1, z], 'cherry', { seed, log: 'cherry_wood', height: 8, blob: [2.3, 3.0], branches: [3, 4], ...opts })
  cherry(10, 59, 1)
  cherry(42, 9, 6, { height: 9 })
  cherry(62, 33, 5, { height: 7 })
  {
    // shidare-zakura: the kit has no weeping cherry, so hang strands of cherry leaves 2-5 long
    // under half of the crown's lowest leaf blocks
    const wx = 40, wz = 58
    cherry(wx, wz, 9, { height: 8, spread: 0.5 })
    for (let x = wx - 6; x <= wx + 6; x += 1) for (let z = wz - 6; z <= wz + 6; z += 1) {
      const top = b.topY(x, z, '*_leaves')
      if (top < 0 || hash(x, z, 40) > 0.5) continue
      let bottom = top
      while (b.nameAt(x, bottom - 1, z) === 'minecraft:cherry_leaves') bottom -= 1
      const len = 2 + Math.floor(hash(x, z, 41) * 4)
      for (let k = 1; k <= len; k += 1) {
        if (b.has(x, bottom - k, z) || bottom - k <= G + 1) break
        b.set(x, bottom - k, z, 'cherry_leaves')
      }
    }
  }
  // Japanese black pines (niwaki): thin crooked trunks (b.curve radius 0.3 = a 1-block line) and
  // flat cloud pads (leafBlob squashed to 0.6-0.7 tall) of dark blue-green spruce leaves
  {
    b.curve([[45, G + 1, 44], [45, G + 3, 44.6], [46.4, G + 5, 45.6], [48.6, G + 6, 47]], 'spruce_wood', { radius: 0.3 })
    b.line([46, G + 4, 45], [43.5, G + 5, 44.5], 'spruce_wood')
    for (const [x, y, z, r] of [[49, G + 7, 47.5, 2.4], [46.8, G + 6.2, 45.6, 1.7], [43.4, G + 5.6, 44.4, 1.5], [45.6, G + 8, 45, 1.3]]) {
      b.leafBlob([x, y, z], [r, 0.7, r], ['spruce_leaves'], { seed: x * 3 + y, holes: 0.06, roughness: 0.15 })
    }
    const bx = 66, bz = 58, by = gy(66, 58) + 1 // a smaller one on the east hill
    b.curve([[bx, by, bz], [bx - 0.5, by + 2, bz - 0.4], [bx - 1.6, by + 3.5, bz - 1]], 'spruce_wood', { radius: 0.3 })
    for (const [x, y, z, r] of [[bx - 2, by + 4, bz - 1.2, 1.9], [bx + 0.5, by + 3, bz + 0.5, 1.4], [bx - 0.8, by + 5.2, bz - 0.6, 1.1]]) {
      b.leafBlob([x, y, z], [r, 0.6, r], ['spruce_leaves'], { seed: x * 5 + z, holes: 0.06, roughness: 0.15 })
    }
  }
  // o-karikomi: clipped azalea mounds (flowering mixed in) marking path edges and corners
  for (const [x, z, r] of [[20, 59, 1.8], [36, 61, 1.6], [20, 45, 1.5], [37, 47, 1.7], [40, 44, 1.8], [44, 66, 1.8], [66, 52, 2.0], [16, 26, 1.6], [40, 27, 1.8], [65, 26, 1.6], [12, 36, 1.4]]) {
    b.leafBlob([x, gy(x, z) + 1.2, z], [r, r * 0.7, r], ['azalea_leaves', 'flowering_azalea_leaves'], { seed: x * 7 + z })
  }
  // a low clipped hedge on the south boundary, open at the entrance
  for (let x = 1; x <= 70; x += 1) {
    if ((x >= 22 && x <= 34) || b.has(x, G + 1, 69) || !b.has(x, G, 69)) continue
    b.set(x, G + 1, 69, 'azalea_leaves[persistent=true]')
    if (hash(x, 69, 2) < 0.5) b.set(x, G + 1, 70, 'azalea_leaves[persistent=true]')
  }
  smallToro(7, 57, gy(7, 57) + 1) // a garden lantern under the south-west cherry
  // The kit's cherry drops pink petals on whatever is below, gravel included; petals only
  // survive on dirt-family blocks in game, so remove the rest.
  const SOIL = /grass_block|moss_block|dirt|podzol|mud/
  for (const [x, y, z, block] of b.entries()) {
    if (block.name === 'minecraft:pink_petals' && !SOIL.test(b.nameAt(x, y - 1, z) ?? '')) b.remove(x, y, z)
  }
  // ground cover last, so it only lands on open grass and moss
  b.scatter({ on: ['minecraft:grass_block'], density: 0.18, paints: [[8, 'short_grass'], [2, 'fern'], [1, 'azalea'], [1, 'flowering_azalea']] })
  b.scatter({ on: ['minecraft:moss_block'], density: 0.12, paints: [[6, 'moss_carpet'], [1, 'fern']] })

  return b.finish({
    name: 'japanese-shrine',
    description: 'A shrine-temple precinct: torii-lined stone approach, irimoya main hall with kohai, five-storey pagoda with sorin, koi pond with drum bridge and cascade, dry garden, moss garden, bamboo grove and cherries.',
  })
}
