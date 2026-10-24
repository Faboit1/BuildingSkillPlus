// WIZARD TOWER (v2 massing)

const SIZE = [56, 88, 56]
const TAU = Math.PI * 2

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export default function build(api) {
  const { kit } = api
  const { noise } = kit
  const b = api.builder(SIZE, { seed: 1717 })
  const PH = 'minecraft:white_wool' // massing placeholder for stone masonry (textured later)

  // ------------------------------------------------------------------ ground
  const GCX = 28
  const GCZ = 28
  const groundH = new Map()
  for (let x = 0; x < SIZE[0]; x += 1) {
    for (let z = 0; z < SIZE[2]; z += 1) {
      const d = Math.hypot(x - GCX, z - GCZ)
      const edge = 25.5 + 2.2 * noise.fbm2(x, z, { scale: 9, seed: 11 })
      if (d > edge) continue
      const h = Math.round(3.5 + 1.3 * noise.fbm2(x, z, { scale: 13, seed: 3 }) - 1.2 * smoothstep(edge - 2.5, edge, d))
      groundH.set(`${x},${z}`, h)
      for (let y = 0; y <= h; y += 1) {
        const depth = h - y
        b.set(x, y, z, depth === 0 ? 'grass_block' : depth < 3 ? 'dirt' : 'stone')
      }
    }
  }
  const groundAt = (x, z) => groundH.get(`${Math.round(x)},${Math.round(z)}`) ?? 0

  // ------------------------------------------------------------------ rock outcrop
  const PLATEAU = 23
  const ROCK = 'minecraft:gray_wool' // placeholder: shaded into a stone ramp at the end
  // A crag is a cluster of tapered rock columns of different heights, blended with a
  // smooth union: the tallest carries the tower, the others are shoulders and ledges.
  const lobe = (cx, cz, top, rTop, flare, seed) => (x, y, z) => {
    const h = clamp(y / top, 0, 1.4)
    const r = rTop + flare * (1 - h) ** 3 + 0.9 * smoothstep(top - 5, top - 1, y) +
      2.4 * noise.fbm3(x, y * 0.2, z, { scale: 4.5, octaves: 2, seed }) + 0.8 * noise.fbm3(x * 0.3, y, z * 0.3, { scale: 3, octaves: 1, seed: seed + 5 })
    const d = Math.hypot(x - cx, z - cz) - r
    const rr = Math.hypot(x - cx, z - cz)
    const cap = y - (top + 0.4 * noise.fbm2(x, z, { scale: 5, seed: seed + 1 }) - 0.08 * Math.max(0, rr - rTop + 2.5) ** 2)
    return Math.max(d, cap)
  }
  const lobes = [
    lobe(27, 28, PLATEAU, 8.8, 5, 31), // main: carries the tower
    lobe(20, 31, PLATEAU - 1, 5.5, 4, 32), // west half of the plateau (garden + tree)
    lobe(20, 19, 17, 4.5, 3, 41), // NW shoulder
    lobe(16, 37, 14, 4, 3, 51), // SW shoulder
    lobe(36, 36, 8, 3, 2.5, 81), // SE knoll
    lobe(11, 26, 10, 2.2, 2.5, 91), // W pinnacle
  ]
  const rockBase = kit.sdf.smoothUnion(2.2, ...lobes)
  const rockSdf = (x, y, z) => rockBase(x, y, z) + 1.0 * noise.fbm3(x, y, z, { scale: 4, octaves: 2, seed: 77 })
  b.sdf([0, 0, 0], [55, PLATEAU + 3, 55], rockSdf, ROCK)

  // Erode the crag top a little: remove one-block spikes and fill one-block pits so ledges
  // read as walkable shelves (and can carry grass) instead of noisy studs.
  for (let pass = 0; pass < 2; pass += 1) {
    for (let x = 1; x < SIZE[0] - 1; x += 1) {
      for (let z = 1; z < SIZE[2] - 1; z += 1) {
        const y = b.topY(x, z)
        if (y < 6 || b.nameAt(x, y, z) !== ROCK) continue
        let higher = 0
        let lower = 0
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const ny = b.topY(x + dx, z + dz)
          if (ny >= y) higher += 1
          if (ny > y) lower += 0
          if (ny <= y - 1) lower += 1
        }
        if (higher <= 2) b.remove(x, y, z)
        else if (lower === 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => b.topY(x + dx, z + dz) > y)) b.set(x, y + 1, z, ROCK)
      }
    }
  }

  // Level a forecourt round the tower: within ~8 blocks of the tower axis the crag top is cut
  // and filled to exactly PLATEAU (a builder levels the site), feathered into the wild rock.
  for (let x = 14; x <= 40; x += 1) {
    for (let z = 15; z <= 41; z += 1) {
      const d = Math.hypot(x - 27, z - 28)
      if (d > 10.5) continue
      const top = b.topY(x, z)
      if (top < PLATEAU - 4 || b.nameAt(x, top, z) !== ROCK) continue
      const w = smoothstep(10.5, 8, d)
      const target = Math.round(top + (PLATEAU - top) * w)
      for (let y = top + 1; y <= target; y += 1) b.set(x, y, z, ROCK)
      for (let y = target + 1; y <= top; y += 1) b.remove(x, y, z)
    }
  }

  // ------------------------------------------------------------------ path up the rock
  // A ledge path that winds around the crag: walking height rises linearly with the angle
  // around the crag, quantised to half blocks so it can be built from full blocks + slabs
  // (slabs have no facing, so they follow a curve without the jaggies stairs would give).
  const PATH = { cx: 27, cz: 28, a0: -1.75, a1: 2.3, h0: 4, h1: 24, r0: 14.6, r1: 11.4, half: 1.1 }
  const BRIDGE = [0.46, 0.6] // stretch of the path (in t) carried by a timber bridge over a cleft
  const pathT = (x, z) => {
    let a = Math.atan2(z - PATH.cz, x - PATH.cx)
    if (a < PATH.a0 - 0.6) a += TAU
    return (a - PATH.a0) / (PATH.a1 - PATH.a0)
  }
  const pathR = t => PATH.r0 + (PATH.r1 - PATH.r0) * t
  const pathH = t => PATH.h0 + (PATH.h1 - PATH.h0) * clamp(t, 0, 1)
  const pathCells = new Map()
  const trail = kit.palette({ dirt_path: 4, coarse_dirt: 2, gravel: 1 }, { scale: 2, seed: 13 })
  const stepSlab = kit.palette({ 'minecraft:cobblestone_slab[type=bottom]': 2, 'minecraft:mossy_cobblestone_slab[type=bottom]': 2, 'minecraft:stone_brick_slab[type=bottom]': 1 }, { scale: 2, seed: 14 })
  for (let x = 0; x < SIZE[0]; x += 1) {
    for (let z = 0; z < SIZE[2]; z += 1) {
      const t = pathT(x, z)
      if (t < -0.03 || t > 1.05) continue
      const r = Math.hypot(x - PATH.cx, z - PATH.cz)
      const off = r - pathR(clamp(t, 0, 1))
      if (Math.abs(off) > PATH.half + 0.8) continue
      // integer walking height, with a half-step slab just before each rise
      const Hf = pathH(t)
      const half = Hf - Math.floor(Hf) > 0.7
      const top = Math.floor(Hf) - 1 // highest full block under the walker
      const outer = off > PATH.half
      const onBridge = t >= BRIDGE[0] && t <= BRIDGE[1]
      pathCells.set(`${x},${z}`, { top, outer, t, onBridge, half })
      // carve headroom (the cliff above becomes a little overhang over the path)
      for (let y = top + 1; y <= top + 4; y += 1) b.remove(x, y, z)
      if (onBridge) continue
      for (let y = Math.max(0, top - 7); y < top; y += 1) b.set(x, y, z, ROCK, { keep: true })
      if (outer) {
        b.set(x, top, z, ROCK)
      } else {
        b.set(x, top, z, trail)
        if (half) b.set(x, top + 1, z, stepSlab(x, top + 1, z))
      }
    }
  }

  // The cleft under the bridge: a V-shaped notch cut into the cliff, deepest mid-span, so the
  // bridge visibly spans air (a gap reads only if you can see through or down into it).
  for (let x = 0; x < SIZE[0]; x += 1) {
    for (let z = 0; z < SIZE[2]; z += 1) {
      const t = pathT(x, z)
      const u = (t - BRIDGE[0]) / (BRIDGE[1] - BRIDGE[0])
      if (u < 0.06 || u > 0.94) continue
      const r = Math.hypot(x - PATH.cx, z - PATH.cz)
      if (r < pathR(t) - PATH.half - 0.6) continue
      const top = Math.floor(pathH(t)) - 1
      const depth = 13 * Math.sin(Math.PI * u) ** 0.7
      for (let y = Math.max(0, Math.round(top - depth)); y <= top; y += 1) if (b.nameAt(x, y, z) === ROCK) b.remove(x, y, z)
    }
  }

  // ------------------------------------------------------------------ tower
  const T = {
    hall: { cx: 27, cz: 28, y0: 24, y1: 32, r: 5.5 },
    library: { cx: 28, cz: 28, y0: 33, y1: 40, r: 5.5 },
    neck: { cx: 29, cz: 27, y0: 41, y1: 46, r: 4.9 },
    study: { cx: 30, cz: 26, y0: 47, y1: 54, r: 7.5 },
  }
  const PLASTER = kit.palette({ mushroom_stem: 6, calcite: 1 }, { scale: 4, seed: 5 })
  const POST = 'minecraft:dark_oak_log[axis=y]'
  const dist = (s, x, z) => Math.hypot(x - s.cx, z - s.cz)
  const inDisk = (s, x, z) => dist(s, x, z) <= s.r
  const out = a => kit.facingFrom(Math.cos(a), Math.sin(a)) // outward facing at an angle
  const deg = d => (d * Math.PI) / 180

  // Cells of a drum's 1-thick wall ring (same test as b.tube), with their angle.
  const ringCells = s => {
    const cells = []
    for (let x = Math.floor(s.cx - s.r); x <= Math.ceil(s.cx + s.r); x += 1) {
      for (let z = Math.floor(s.cz - s.r); z <= Math.ceil(s.cz + s.r); z += 1) {
        if (!inDisk(s, x, z)) continue
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !inDisk(s, x + dx, z + dz))) cells.push([x, z, Math.atan2(z - s.cz, x - s.cx)])
      }
    }
    return cells
  }
  const angDiff = (a, c) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c)))
  // The wall cell facing a given angle (prefers cells whose outward side is open).
  const wallCell = (s, a) => {
    let best = null
    for (const [x, z, ca] of ringCells(s)) {
      const d = kit.DIR[out(a)]
      const score = angDiff(ca, a) + (inDisk(s, x + d[0], z + d[2]) ? 1 : 0)
      if (!best || score < best[2]) best = [x, z, score]
    }
    return [best[0], best[1]]
  }

  const drum = (s, paint, floor = 'minecraft:spruce_planks') => {
    b.cylinder([s.cx, s.y0, s.cz], s.r, s.y1 - s.y0 + 1, 'air')
    b.tube([s.cx, s.y0, s.cz], s.r, s.y1 - s.y0 + 1, paint)
    if (floor) b.disc([s.cx, s.y0, s.cz], s.r - 0.5, floor)
  }
  // Timber-framed drum: dark posts at even angles, stripped-log sill and top plate (log axis
  // follows the wall tangent), light plaster infill. Posts every ~4-5 blocks of perimeter.
  const timberPaint = (s, posts, phase = 0) => {
    const cells = ringCells(s)
    const postCols = new Set()
    for (let i = 0; i < posts; i += 1) {
      const a = Math.atan2(Math.sin(phase + (i * TAU) / posts), Math.cos(phase + (i * TAU) / posts))
      let best = cells[0]
      for (const c of cells) if (angDiff(c[2], a) < angDiff(best[2], a)) best = c
      postCols.add(`${best[0]},${best[1]}`)
    }
    return (x, y, z) => {
      if (y === s.y0 || y === s.y1) return `minecraft:stripped_dark_oak_log[axis=${Math.abs(x - s.cx) > Math.abs(z - s.cz) ? 'z' : 'x'}]`
      if (postCols.has(`${x},${z}`)) return POST
      return PLASTER
    }
  }

  // Stepped corbel table under the part of `upper` that overhangs `lower`: one block out per
  // block up, upside-down stairs facing the wall at the bottom of each step.
  const corbel = (upper, lower, yFloor, stairs, block) => {
    const R = upper.r + 1
    for (let x = Math.floor(upper.cx - R); x <= Math.ceil(upper.cx + R); x += 1) {
      for (let z = Math.floor(upper.cz - R); z <= Math.ceil(upper.cz + R); z += 1) {
        if (!inDisk(upper, x, z)) continue
        const dl = dist(lower, x, z)
        if (dl <= lower.r) continue
        const ux = (x - lower.cx) / (dl || 1)
        const uz = (z - lower.cz) / (dl || 1)
        const Dx = upper.cx - lower.cx
        const Dz = upper.cz - lower.cz
        const proj = ux * Dx + uz * Dz
        const tEdge = proj + Math.sqrt(Math.max(0, proj * proj - (Dx * Dx + Dz * Dz) + upper.r * upper.r))
        const J = Math.max(1, Math.round(tEdge - lower.r))
        const k = Math.max(1, Math.ceil(dl - lower.r - 0.001))
        const depth = Math.max(1, J - k + 1)
        const facing = kit.facingFrom(lower.cx - x, lower.cz - z)
        for (let j = 1; j <= depth; j += 1) {
          b.set(x, yFloor - j, z, j === depth ? `${stairs}[facing=${facing},half=top]` : block, { keep: true })
        }
      }
    }
  }
  // Ledge where `lower` sticks out past `upper`: a weathering slab on the exposed wall top.
  const ledge = (lower, upper, slab) => {
    for (const [x, z] of ringCells(lower)) {
      if (inDisk(upper, x, z)) continue
      b.set(x, upper.y0, z, `${slab}[type=bottom]`, { keep: true })
    }
  }

  // --- windows on round walls
  // Slit / lancet: glass column, a little sloped hood above and an upside-down-stair sill.
  const lancet = (s, a, y, h, { glass = 'minecraft:glass_pane', trim = 'minecraft:stone_brick_stairs', shutters } = {}) => {
    const [x, z] = wallCell(s, a)
    const f = out(a)
    const d = kit.DIR[f]
    for (let j = 0; j < h; j += 1) b.set(x, y + j, z, glass)
    if (trim) {
      b.set(x + d[0], y + h, z + d[2], `${trim}[facing=${kit.opposite(f)},half=bottom]`, { keep: true })
      b.set(x + d[0], y - 1, z + d[2], `${trim}[facing=${kit.opposite(f)},half=top]`, { keep: true })
    }
    if (shutters) {
      const rgt = kit.DIR[kit.ccw(f)]
      for (let j = 0; j < h; j += 1) {
        for (const side of [-1, 1]) {
          const px = x + d[0] + rgt[0] * side
          const pz = z + d[2] + rgt[2] * side
          if (!b.has(px, y + j, pz)) b.set(px, y + j, pz, `${shutters}[facing=${side < 0 ? kit.opposite(kit.ccw(f)) : kit.ccw(f)},open=true,half=${j === h - 1 ? 'top' : 'bottom'}]`)
        }
      }
    }
    return [x, z, f]
  }
  // Round window (oculus): 3x3 in the wall plane, corners are stairs that round it off.
  const oculus = (cx, cy, cz, facing, stairs = 'minecraft:dark_oak_stairs', glass = 'minecraft:glass_pane') => {
    const rgt = kit.DIR[kit.ccw(facing)]
    for (let i = -1; i <= 1; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        const p = [cx + rgt[0] * i, cy + j, cz + rgt[2] * i]
        if (i !== 0 && j !== 0) {
          const side = i < 0 ? kit.opposite(kit.ccw(facing)) : kit.ccw(facing)
          b.set(...p, `${stairs}[facing=${side},half=${j > 0 ? 'top' : 'bottom'}]`)
        } else {
          b.set(...p, glass)
        }
      }
    }
  }

  // --- build the shell, bottom to top
  // plinth: buried drum + sloped water-table course where the tower meets the plateau
  b.cylinder([T.hall.cx, 16, T.hall.cz], 6.5, 8, kit.palette({ cobbled_deepslate: 4, mossy_cobblestone: 2, tuff: 1 }))
  b.ring([T.hall.cx, T.hall.y0, T.hall.cz], 6.5, (x, y, z) => `minecraft:cobbled_deepslate_stairs[facing=${kit.facingFrom(T.hall.cx - x, T.hall.cz - z)},half=bottom]`)

  drum(T.hall, PH, kit.pattern((x, y, z) => (x + z) % 2, ['minecraft:spruce_planks', 'minecraft:dark_oak_planks']))
  drum(T.library, PH)
  corbel(T.library, T.hall, T.library.y0, 'minecraft:stone_brick_stairs', PH)
  ledge(T.hall, T.library, 'minecraft:stone_brick_slab')
  drum(T.neck, PH)
  ledge(T.library, T.neck, 'minecraft:stone_brick_slab')
  corbel(T.study, T.neck, T.study.y0, 'minecraft:dark_oak_stairs', 'minecraft:dark_oak_planks')
  drum(T.study, timberPaint(T.study, 12, deg(15)))

  // --- turrets: small drums carried on corbel cones (bartizans), each with its own witch-hat
  const T1 = { cx: 22, cz: 33, y0: 31, y1: 39, r: 2.5 }
  const T2 = { cx: 36, cz: 20, y0: 50, y1: 60, r: 2.5 }
  const turretBody = (t, wallPaint, corbelStairs = 'minecraft:stone_brick_stairs', corbelBlock = PH) => {
    corbel(t, { cx: t.cx, cz: t.cz, r: 0.4 }, t.y0, corbelStairs, corbelBlock)
    b.cylinder([t.cx, t.y0, t.cz], t.r - 1, t.y1 - t.y0 + 1, 'air')
    b.tube([t.cx, t.y0, t.cz], t.r, t.y1 - t.y0 + 1, wallPaint)
    b.disc([t.cx, t.y0, t.cz], t.r - 0.5, 'minecraft:spruce_planks')
    b.set(t.cx, t.y0 - 1 - Math.ceil(t.r), t.cz, 'minecraft:pointed_dripstone[thickness=tip,vertical_direction=down,waterlogged=false]')
  }
  turretBody(T1, PH)
  // The small timber turret: no posts (a 5-wide drum is too small for them), just sill, mid
  // and top beams banding the plaster.
  const T2PAINT = (x, y, z) => ((y - T2.y0) % 5 === 0 || y === T2.y1 ? `minecraft:stripped_dark_oak_log[axis=${Math.abs(x - T2.cx) > Math.abs(z - T2.cz) ? 'z' : 'x'}]` : PLASTER(x, y, z))
  turretBody(T2, T2PAINT, 'minecraft:dark_oak_stairs', 'minecraft:dark_oak_planks')
  // open the turrets into the rooms they are attached to
  for (const [t, s] of [[T1, T.hall], [T1, T.library], [T2, T.study]]) {
    for (let y = Math.max(t.y0, s.y0) + 1; y <= Math.min(t.y1, s.y1) - 1; y += 1) {
      for (let x = t.cx - 3; x <= t.cx + 3; x += 1) {
        for (let z = t.cz - 3; z <= t.cz + 3; z += 1) {
          if (dist(t, x, z) <= t.r - 1 && dist(s, x, z) <= s.r) b.remove(x, y, z)
          if (dist(s, x, z) <= s.r - 1 && dist(t, x, z) <= t.r) b.remove(x, y, z)
        }
      }
    }
  }

  // --- main witch-hat: steep concave cone (rises 0.5,0.5,1,1,2,2,3...) with a flared brim
  const ROOF_Y = T.study.y1 + 1
  const hx = T.study.cx
  const hz = T.study.cz
  const mainRoof = b.coneRoof([hx, ROOF_Y, hz], T.study.r, {
    material: 'deepslate_tile', overhang: 2, pitch: [0.5, 0.5, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3],
  })
  const tipY = mainRoof.topY
  // the tip flops over sideways: a tapering curve (radius 1.5 -> 0.5)
  const curl = [[hx, tipY - 3, hz], [hx, tipY + 1, hz], [hx + 1, tipY + 4, hz - 0.5], [hx + 3, tipY + 5.5, hz - 1.5], [hx + 4.5, tipY + 4.5, hz - 2], [hx + 5, tipY + 3, hz - 2]]
  b.curve(curl, 'minecraft:deepslate_tiles', { radius: t => 1.5 - 1.0 * t })
  // hat band: two courses of the cone just above the brim swapped to purple
  const BAND = [ROOF_Y + 2, ROOF_Y + 3]
  b.box([hx - 10, BAND[0], hz - 10], [hx + 10, BAND[1], hz + 10], (x, y, z, bb) => {
    const blk = bb.get(x, y, z)
    if (!blk) return null
    if (blk.name === 'minecraft:deepslate_tile_stairs') return { name: 'minecraft:purpur_stairs', props: blk.props }
    if (blk.name === 'minecraft:deepslate_tiles') return 'minecraft:purpur_block'
    return null
  })
  // shingle variation: clumps of slightly lighter slate so the big cone does not read as one flat black mass
  const shinglePass = (min, max) => b.box(min, max, (x, y, z, bb) => {
    const blk = bb.get(x, y, z)
    if (!blk) return null
    const n = noise.coherent01(x, y, z, { scale: 2.5, grain: 0.3, seed: 71 })
    if (blk.name === 'minecraft:deepslate_tile_stairs' && n < 0.16) return { name: 'minecraft:deepslate_brick_stairs', props: blk.props }
    if (blk.name === 'minecraft:deepslate_tile_stairs' && n > 0.9) return { name: 'minecraft:cobbled_deepslate_stairs', props: blk.props }
    if (blk.name === 'minecraft:deepslate_tiles' && n < 0.2) return 'minecraft:cracked_deepslate_tiles'
    return null
  })
  // turret hats (same family, steeper and narrower: they must stay subordinate)
  const hat1 = b.coneRoof([T1.cx, T1.y1 + 1, T1.cz], T1.r, { material: 'deepslate_tile', overhang: 1, pitch: [1, 1, 3, 3, 3], finial: ['minecraft:end_rod[facing=up]'] })
  const hat2 = b.coneRoof([T2.cx, T2.y1 + 1, T2.cz], T2.r, { material: 'deepslate_tile', overhang: 1, pitch: [1, 1, 3, 3, 3], finial: ['minecraft:end_rod[facing=up]'] })
  // the turret pokes through the main brim: clear brim blocks inside the turret
  for (let y = ROOF_Y - 2; y <= T2.y1; y += 1) {
    for (const [x, z] of ringCells(T2)) if (y > T2.y0) b.set(x, y, z, T2PAINT)
    b.cylinder([T2.cx, y, T2.cz], T2.r - 1, 1, 'air')
  }

  // dormer on the south face of the hat: a little gabled box flush with the study wall,
  // so the round window below and the dormer window above stack on one axis
  const DZ = hz + 7
  b.box([hx - 1, ROOF_Y, DZ - 4], [hx + 1, ROOF_Y + 2, DZ], PLASTER)
  b.box([hx, ROOF_Y, DZ - 4], [hx, ROOF_Y + 2, DZ - 1], 'air')
  b.roof({ x0: hx - 1, x1: hx + 1, z0: DZ - 5, z1: DZ, y: ROOF_Y + 3, axis: 'z', material: 'deepslate_tile', pitch: 1, overhang: 1, gableOverhang: 0, gable: PLASTER, eaveTrim: true })
  b.set(hx, ROOF_Y + 3, DZ, 'minecraft:dark_oak_trapdoor[facing=south,half=top,open=false]')
  b.set(hx, ROOF_Y, DZ, 'minecraft:glass_pane')
  b.set(hx, ROOF_Y + 1, DZ, 'minecraft:glass_pane')
  b.set(hx, ROOF_Y, DZ - 1, 'minecraft:lantern[hanging=false]')
  b.set(hx, ROOF_Y - 1, DZ - 1, 'minecraft:dark_oak_planks')

  shinglePass([hx - 12, ROOF_Y - 3, hz - 12], [hx + 12, tipY + 8, hz + 12])
  shinglePass([T1.cx - 4, T1.y1, T1.cz - 4], [T1.cx + 4, T1.y1 + 14, T1.cz + 4])

  // crooked chimney pipe up the north-west side of the hat
  // b.curve with a null paint only returns the sampled centre line; we stack a 2x2 flue on it
  const chim = b.curve([[hx - 6, T.study.y0 + 1, hz - 4], [hx - 6, ROOF_Y + 2, hz - 4.5], [hx - 7.5, ROOF_Y + 7, hz - 5.5], [hx - 6.5, ROOF_Y + 12, hz - 6.5]], null)
  const flue = kit.palette({ 'minecraft:stone_bricks': 3, 'minecraft:mossy_stone_bricks': 1, 'minecraft:cracked_stone_bricks': 1 }, { scale: 2 })
  for (const [px, py, pz] of chim) b.box([Math.round(px), Math.round(py), Math.round(pz)], [Math.round(px) + 1, Math.round(py), Math.round(pz) + 1], flue)
  const ct = chim[chim.length - 1].map(Math.round)
  b.box([ct[0], ct[1] + 1, ct[2]], [ct[0] + 1, ct[1] + 1, ct[2] + 1], 'minecraft:polished_blackstone_bricks')
  b.set(ct[0], ct[1] + 2, ct[2], 'minecraft:campfire[lit=true,signal_fire=false,facing=north]')
  b.set(ct[0] + 1, ct[1] + 2, ct[2], 'minecraft:polished_blackstone_wall')
  b.set(ct[0], ct[1] + 2, ct[2] + 1, 'minecraft:polished_blackstone_wall')
  b.set(ct[0] + 1, ct[1] + 2, ct[2] + 1, 'minecraft:polished_blackstone_wall')

  // --- balconies on corbels
  // Library balcony (south): a half-disc of planks with a fence rail and a door onto it.
  // Balconies: a thin deck (top slabs) with a fence rail, carried by a rim beam of
  // upside-down stairs and stepped brackets every other block along the wall - light and
  // timber-like, instead of a solid wedge.
  const balcony = (B, host, floorY, wood, rail) => {
    const cells = []
    for (let x = Math.floor(B.cx - B.r); x <= Math.ceil(B.cx + B.r); x += 1) {
      for (let z = Math.floor(B.cz - B.r); z <= Math.ceil(B.cz + B.r); z += 1) {
        if (Math.hypot(x - B.cx, z - B.cz) > B.r || dist(host, x, z) <= host.r) continue
        cells.push([x, z])
      }
    }
    const isCell = (x, z) => cells.some(([cx2, cz2]) => cx2 === x && cz2 === z)
    for (const [x, z] of cells) {
      const f = kit.facingFrom(host.cx - x, host.cz - z)
      b.set(x, floorY, z, `minecraft:${wood}_slab[type=top]`)
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !isCell(x + dx, z + dz) && dist(host, x + dx, z + dz) > host.r)
      if (edge) {
        b.set(x, floorY + 1, z, rail)
        b.set(x, floorY - 1, z, `minecraft:${wood}_stairs[facing=${f},half=top]`, { keep: true })
      }
      const wallSide = dist(host, x, z) <= host.r + 1.2
      if (wallSide && (x + z) % 2 === 0) {
        b.set(x, floorY - 1, z, `minecraft:${wood}_planks`)
        b.set(x, floorY - 2, z, `minecraft:${wood}_stairs[facing=${f},half=top]`)
      }
    }
  }
  const BAL1 = { cx: 28, cz: 33, r: 3.4 }
  balcony(BAL1, T.library, T.library.y0, 'dark_oak', 'minecraft:dark_oak_fence')
  b.door([28, T.library.y0 + 1, 33], 'south', { material: 'dark_oak' })
  b.set(28, T.library.y0 + 3, 34, 'minecraft:deepslate_tile_stairs[facing=north,half=bottom]')
  b.set(27, T.library.y0 + 3, 34, 'minecraft:deepslate_tile_stairs[facing=north,half=bottom]')
  b.set(29, T.library.y0 + 3, 34, 'minecraft:deepslate_tile_stairs[facing=north,half=bottom]')
  // Study balcony (south-east) for the crystal ball and the telescope.
  const BAL2 = { cx: 36, cz: 31, r: 3.3 }
  balcony(BAL2, T.study, T.study.y0, 'dark_oak', 'minecraft:dark_oak_fence')
  b.door([35, T.study.y0 + 1, 31], 'east', { material: 'dark_oak' })

  // --- the front door: round-headed timber surround with a little slate hood
  const DOOR = [T.hall.cx, T.hall.y0 + 1, T.hall.cz + 5]
  b.door(DOOR, 'south', { material: 'dark_oak' })
  {
    const [x, y, z] = DOOR
    for (const dx of [-1, 1]) {
      b.set(x + dx, y, z + 1, 'minecraft:stripped_dark_oak_log[axis=y]')
      b.set(x + dx, y + 1, z + 1, 'minecraft:stripped_dark_oak_log[axis=y]')
      b.set(x + dx, y + 2, z + 1, `minecraft:dark_oak_stairs[facing=${dx < 0 ? 'west' : 'east'},half=top]`)
      b.set(x + dx * 2, y + 2, z + 1, `minecraft:deepslate_tile_stairs[facing=${dx < 0 ? 'east' : 'west'},half=bottom]`)
    }
    b.set(x, y + 2, z + 1, 'minecraft:dark_oak_slab[type=top]')
    for (let dx = -1; dx <= 1; dx += 1) b.set(x + dx, y + 3, z + 1, 'minecraft:deepslate_tile_stairs[facing=north,half=bottom]')
    b.set(x, y + 3, z, 'minecraft:chiseled_stone_bricks')
    b.set(x, y - 1, z + 1, 'minecraft:spruce_stairs[facing=north,half=bottom]')
    b.lampPost([x - 2, y - 1, z + 2], { height: 2, post: 'minecraft:dark_oak_fence', lantern: 'minecraft:lantern' })
    b.lampPost([x + 2, y - 1, z + 2], { height: 2, post: 'minecraft:dark_oak_fence', lantern: 'minecraft:lantern' })
  }

  // --- windows. Lancets on the masonry, round windows + lancets on the timber study.
  const windows = []
  const addLancet = (s, adeg, y, h, opts) => windows.push({ s, y, at: lancet(s, deg(adeg), y, h, opts) })
  for (const a of [20, 160, 250, 320]) addLancet(T.hall, a, T.hall.y0 + 3, 2)
  // Round-headed 3-wide windows fit only where the drum has a flat run of 5 (the cardinal
  // points): kit window with arch corners, stone sill and lintel.
  for (const [pos, f] of [[[T.library.cx + 5, T.library.y0 + 2, T.library.cz + 1], 'east'], [[T.library.cx - 5, T.library.y0 + 2, T.library.cz - 1], 'west']]) {
    b.window(pos, f, { width: 3, height: 3, arch: true, material: 'stone_brick', lintel: 'minecraft:stone_brick_slab[type=bottom]' })
    const d = kit.DIR[f]
    windows.push({ s: T.library, y: pos[1], at: [pos[0], T.library.cz, f] })
    void d
  }
  addLancet(T.library, 300, T.library.y0 + 2, 3)
  for (const a of [45, 160, 235]) addLancet(T.neck, a, T.neck.y0 + 2, 2)
  for (const a of [60, 120, 210, 270]) addLancet(T.study, a, T.study.y0 + 2, 3, { trim: 'minecraft:dark_oak_stairs', glass: 'minecraft:yellow_stained_glass_pane' })
  for (const a of [90, 0, 180]) {
    const [x, z] = wallCell(T.study, deg(a))
    oculus(x, T.study.y0 + 3, z, out(deg(a)), 'minecraft:dark_oak_stairs', 'minecraft:yellow_stained_glass_pane')
    const d = kit.DIR[out(deg(a))]
    b.set(x + d[0], T.study.y0 + 1, z + d[2], `minecraft:dark_oak_stairs[facing=${kit.opposite(out(deg(a)))},half=top]`, { keep: true })
    windows.push({ s: T.study, y: T.study.y0 + 2, at: [x, z, out(deg(a))] })
  }
  addLancet(T1, 90, T1.y0 + 2, 2)
  addLancet(T1, 200, T1.y0 + 2, 2)
  {
    const [x, z] = wallCell(T2, 0)
    oculus(x, T2.y0 + 4, z, 'east')
  }
  addLancet(T2, 270, T2.y0 + 2, 2, { trim: null, glass: 'minecraft:yellow_stained_glass_pane' })

  // --- interior: ceilings, spiral stair flights, furniture, lights
  // Close every room at the top: the next drum is offset, so its floor does not cover all of
  // the room below (keep: never overwrite walls or floors already there).
  // Where the closing disc lies outside the drum above, it is roof, not floor: weather it with
  // the same stone slabs as the ledge.
  for (const [s, up] of [[T.hall, T.library], [T.library, T.neck]]) {
    b.disc([s.cx, s.y1 + 1, s.cz], s.r - 0.5, (x, y, z) => (inDisk(up, x, z) ? 'minecraft:spruce_planks' : 'minecraft:stone_brick_slab[type=bottom]'), { keep: true })
  }
  const flights = [[T.hall, T.hall.y0 + 1, T.hall.y1], [T.library, T.library.y0 + 1, T.library.y1], [T.neck, T.neck.y0 + 1, T.neck.y1]]
  for (const [s, y0, y1] of flights) {
    b.spiralStairs([s.cx, y0, s.cz], 0.6, 2.7, y0, y1, 'spruce', { stepsPerTurn: 12, core: 'minecraft:stripped_dark_oak_log[axis=y]' })
  }
  // headroom: clear 3 blocks above every step (this is what cuts the stair wells in the floors)
  for (const [s, y0, y1] of flights) {
    for (let x = s.cx - 3; x <= s.cx + 3; x += 1) {
      for (let z = s.cz - 3; z <= s.cz + 3; z += 1) {
        for (let y = y0; y <= y1; y += 1) {
          if (b.nameAt(x, y, z) !== 'minecraft:spruce_stairs') continue
          for (let k = 1; k <= 3; k += 1) {
            const n = b.nameAt(x, y + k, z)
            if (n && n !== 'minecraft:spruce_stairs' && n !== 'minecraft:stripped_dark_oak_log') b.remove(x, y + k, z)
          }
        }
      }
    }
  }
  const inner = (s, adeg, inset = 1) => {
    const a = deg(adeg)
    const rr = s.r - 0.5 - inset
    return [Math.round(s.cx + rr * Math.cos(a)), Math.round(s.cz + rr * Math.sin(a))]
  }
  const toCentre = (s, x, z) => kit.facingFrom(s.cx - x, s.cz - z)
  const put = (s, adeg, y, block, inset = 1) => {
    const [x, z] = inner(s, adeg, inset)
    b.set(x, y, z, typeof block === 'function' ? block(kit.facingFrom(s.cx - x, s.cz - z)) : block, { keep: true })
    return [x, z]
  }
  // ground floor: the alchemist's workshop
  {
    const s = T.hall
    const y = s.y0 + 1
    put(s, 200, y, 'minecraft:water_cauldron[level=3]')
    put(s, 225, y, 'minecraft:brewing_stand[has_bottle_0=true,has_bottle_1=false,has_bottle_2=true]')
    put(s, 275, y, f => `minecraft:barrel[facing=${f},open=false]`)
    put(s, 275, y + 1, 'minecraft:barrel[facing=up,open=false]')
    put(s, 300, y, 'minecraft:crafting_table')
    put(s, 335, y, f => `minecraft:chest[facing=${f},type=single,waterlogged=false]`)
    for (const a of [45, 60]) for (let k = 0; k < 3; k += 1) put(s, a, y + k, 'minecraft:bookshelf')
    put(s, 0, y, 'minecraft:smoker[facing=west,lit=true]')
    for (const a of [10, 190]) {
      const [x, z] = inner(s, a, 1.2)
      b.hangingLantern([x, s.y1 + 1, z], 1)
    }
  }
  // library: shelves all round (gaps for windows, the door and the turret alcove)
  const shelfRing = (s, y0, y1, gaps, block = 'minecraft:bookshelf') => {
    for (let a = 0; a < 360; a += 6) {
      if (gaps.some(g => angDiff(deg(a), deg(g)) < deg(17))) continue
      for (let y = y0; y <= y1; y += 1) put(s, a, y, block)
    }
  }
  shelfRing(T.library, T.library.y0 + 1, T.library.y0 + 3, [0, 90, 135, 180, 300])
  put(T.library, 250, T.library.y0 + 1, f => `minecraft:lectern[facing=${f},has_book=true,powered=false]`, 2)
  shelfRing(T.neck, T.neck.y0 + 1, T.neck.y1 - 1, [45, 160, 235])
  // study: enchanting nook, bed, shelves, a long chandelier from the hat's apex
  {
    const s = T.study
    const y = s.y0 + 1
    shelfRing(s, y, y + 2, [0, 45, 60, 90, 120, 180, 210, 270, 315])
    const [ex, ez] = inner(s, 230, 2.5)
    b.set(ex, y, ez, 'minecraft:enchanting_table')
    b.set(ex, y - 1, ez, 'minecraft:purple_carpet')
    put(s, 120, y, f => `minecraft:lectern[facing=${f},has_book=true,powered=false]`)
    put(s, 165, y, 'minecraft:cauldron')
    put(s, 195, y, 'minecraft:brewing_stand[has_bottle_0=true,has_bottle_1=true,has_bottle_2=false]')
    // bed along the north wall: head at the west end
    b.set(29, y, 20, 'minecraft:purple_bed[facing=west,part=head,occupied=false]', { keep: true })
    b.set(30, y, 20, 'minecraft:purple_bed[facing=west,part=foot,occupied=false]', { keep: true })
    // a purple rug ring
    b.disc([s.cx, y, s.cz], 4.5, 'minecraft:purple_carpet', { keep: true, inner: 3.5 })
    // chandelier
    let topIn = tipY - 3
    while (topIn > ROOF_Y && b.has(hx, topIn - 1, hz)) topIn -= 1
    // a long chain from the apex to a fence-cross chandelier with candles and a soul lantern
    const cy = ROOF_Y + 3
    for (let y2 = topIn - 1; y2 > cy; y2 -= 1) b.set(hx, y2, hz, 'minecraft:chain[axis=y]')
    b.set(hx, cy, hz, 'minecraft:dark_oak_fence')
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      b.set(hx + dx, cy, hz + dz, 'minecraft:dark_oak_fence')
      b.set(hx + dx, cy + 1, hz + dz, 'minecraft:candle[candles=3,lit=true,waterlogged=false]')
    }
    b.set(hx, cy - 1, hz, 'minecraft:soul_lantern[hanging=true]')
  }
  // a warm light behind every window: an inner sill (top slab) with a lantern on it
  for (const w of windows) {
    const [x, z, f] = w.at
    const d = kit.DIR[f]
    const ix = x - d[0]
    const iz = z - d[2]
    if (w.s === T.study) {
      // the study's windows each frame a glowing shroomlight lamp on a shelf: the hero windows
      // must read as lit from far away, and a block that glows is far brighter than a lantern
      b.set(ix, w.y, iz, 'minecraft:dark_oak_planks')
      b.set(ix, w.y + 1, iz, 'minecraft:shroomlight')
      continue
    }
    if (!b.has(ix, w.y - 1, iz)) b.set(ix, w.y - 1, iz, 'minecraft:spruce_slab[type=top]')
    b.set(ix, w.y, iz, 'minecraft:lantern[hanging=false]', { mask: (x2, y2, z2, bb) => !bb.has(x2, y2, z2) || /bookshelf|carpet/.test(bb.nameAt(x2, y2, z2)) })
  }

  // --- exterior lights and magic
  // soul lanterns hanging under the study corbels
  for (const a of [70, 160, 250, 340]) {
    const rr = T.neck.r + 1.2
    const x = Math.round(T.neck.cx + rr * Math.cos(deg(a)))
    const z = Math.round(T.neck.cz + rr * Math.sin(deg(a)))
    let y = T.study.y0 - 1
    while (y > T.study.y0 - 6 && b.has(x, y - 1, z)) y -= 1
    if (b.has(x, y, z)) b.set(x, y - 1, z, 'minecraft:soul_lantern[hanging=true]', { keep: true })
  }
  // a ring of warm lanterns under the hat brim: at night they wash the timber study in light
  for (let a = 22.5; a < 360; a += 45) {
    const x = Math.round(hx + 8.6 * Math.cos(deg(a)))
    const z = Math.round(hz + 8.6 * Math.sin(deg(a)))
    if (b.has(x, ROOF_Y - 1, z) && !b.has(x, ROOF_Y - 2, z)) b.hangingLantern([x, ROOF_Y - 1, z], 1)
  }
  // lit candles on the outer sills of the study and library windows
  for (const w of windows) {
    if (w.s !== T.study && w.s !== T.library) continue
    const [x, z, f] = w.at
    const d = kit.DIR[f]
    if (b.nameAt(x + d[0], w.y - 1, z + d[2])?.endsWith('_stairs')) b.set(x + d[0], w.y, z + d[2], 'minecraft:candle[candles=3,lit=true,waterlogged=false]', { keep: true })
  }
  // warm lanterns on the stone shaft: under the library balcony rim and beside the arched windows
  for (const [x, z] of [[25, 35], [31, 35], [28, 37]]) {
    let y = T.library.y0
    if (b.has(x, y, z) && !b.has(x, y - 1, z)) b.set(x, y - 1, z, 'minecraft:lantern[hanging=true]')
    else if (b.has(x, y - 1, z) && !b.has(x, y - 2, z)) b.set(x, y - 2, z, 'minecraft:lantern[hanging=true]')
  }
  for (const [x, y, z, f] of [[T.library.cx + 6, T.library.y0 + 4, T.library.cz + 3, 'east'], [T.library.cx - 6, T.library.y0 + 4, T.library.cz - 3, 'west'], [T.hall.cx + 6, T.hall.y0 + 4, T.hall.cz - 2, 'east']]) {
    const d = kit.DIR[f]
    if (!b.has(x - d[0], y, z - d[2])) continue
    b.set(x, y, z, `minecraft:stone_brick_wall`)
    b.set(x, y - 1, z, 'minecraft:lantern[hanging=true]')
  }
  // the glowing orb dangling from the curled tip on a chain
  {
    const e = curl[curl.length - 1].map(Math.round)
    let y = e[1]
    while (b.has(e[0], y - 1, e[2])) y -= 1
    for (let k = 0; k < 2; k += 1) b.set(e[0], y - 1 - k, e[2], 'minecraft:chain[axis=y]')
    const c = [e[0], y - 4, e[2]]
    for (let dx = -1; dx <= 1; dx += 1)
      for (let dy = -1; dy <= 1; dy += 1)
        for (let dz = -1; dz <= 1; dz += 1) {
          const m = Math.abs(dx) + Math.abs(dy) + Math.abs(dz)
          if (m <= 1) b.set(c[0] + dx, c[1] + dy, c[2] + dz, 'minecraft:pearlescent_froglight[axis=y]')
          else if (m === 2) b.set(c[0] + dx, c[1] + dy, c[2] + dz, 'minecraft:purple_stained_glass')
        }
  }
  // three amethyst shards orbiting the hat
  for (const [a, dy] of [[200, 8], [320, 12], [80, 15]]) {
    const x = Math.round(hx + 11.5 * Math.cos(deg(a)))
    const z = Math.round(hz + 11.5 * Math.sin(deg(a)))
    const y = ROOF_Y + dy
    b.set(x, y, z, 'minecraft:amethyst_block')
    b.set(x, y + 1, z, 'minecraft:amethyst_block')
    b.set(x, y + 2, z, 'minecraft:amethyst_cluster[facing=up,waterlogged=false]')
    b.set(x, y - 1, z, 'minecraft:large_amethyst_bud[facing=down,waterlogged=false]')
    b.set(x + 1, y, z, 'minecraft:medium_amethyst_bud[facing=east,waterlogged=false]')
    b.set(x, y + 1, z - 1, 'minecraft:small_amethyst_bud[facing=north,waterlogged=false]')
  }
  // telescope + brazier on the study balcony
  {
    const y = T.study.y0 + 1
    b.set(37, y, 32, 'minecraft:dark_oak_fence')
    b.set(37, y + 1, 32, 'minecraft:lightning_rod[facing=south,powered=false,waterlogged=false]')
    b.set(37, y + 1, 33, 'minecraft:lightning_rod[facing=south,powered=false,waterlogged=false]')
    b.set(38, y, 30, 'minecraft:soul_campfire[lit=true,signal_fire=false,facing=north,waterlogged=false]')
    b.set(35, y, 33, 'minecraft:potted_flowering_azalea_bush')
  }

  // ------------------------------------------------------------------ rock finish
  // 1) Soil caps: every rock column whose top is fairly level gets grass (or moss) over a
  //    dirt layer, so cliff lips show a band of soil like a real outcrop.
  for (let x = 0; x < SIZE[0]; x += 1) {
    for (let z = 0; z < SIZE[2]; z += 1) {
      const y = b.topY(x, z)
      if (y < 0 || b.nameAt(x, y, z) !== ROCK) continue
      let slope = 0
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) slope = Math.max(slope, Math.abs(b.topY(x + dx, z + dz) - y))
      const m = noise.coherent01(x, y, z, { scale: 4, seed: 17 })
      if (slope <= 2 || y >= PLATEAU - 1) {
        b.set(x, y, z, m < 0.22 ? 'moss_block' : 'grass_block')
        if (b.nameAt(x, y - 1, z) === ROCK && m < 0.6) b.set(x, y - 1, z, m < 0.35 ? 'dirt' : 'rooted_dirt')
      } else if (slope <= 4 && m < 0.45) {
        b.set(x, y, z, 'moss_block')
      }
    }
  }
  // moss creeping over ledges that are not the top of their column
  for (const [x, y, z, blk] of b.entries()) {
    if (blk.name !== ROCK || b.has(x, y + 1, z)) continue
    // only real shelves (2+ neighbouring cells exposed at the same height) get moss blocks;
    // single studs get a thin carpet, so the cliff is not peppered with bright green cubes
    let shelf = 0
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (b.has(x + dx, y, z + dz) && !b.has(x + dx, y + 1, z + dz)) shelf += 1
    const m = noise.coherent01(x, y, z, { scale: 5, grain: 0.1, seed: 19 })
    if (m < 0.4 && shelf >= 2) b.set(x, y, z, 'moss_block')
    else if (m < 0.5) b.set(x, y + 1, z, 'moss_carpet')
  }
  // 2) Cavity shading: a light-to-dark stone ramp indexed by height (darker low down) and by
  //    occlusion (share of solid blocks in the 5x5x5 neighbourhood: recesses dark, ridges
  //    light), with vertical noise streaks. This is what makes a voxel cliff read as rock.
  const rockRamp = [
    kit.palette({ andesite: 2, stone: 1 }, { scale: 2.5, seed: 31 }),
    kit.palette({ stone: 3, andesite: 1 }, { scale: 2.5, seed: 32 }),
    kit.palette({ stone: 2, tuff: 1, cobblestone: 1 }, { scale: 2.5, seed: 33 }),
    kit.palette({ tuff: 3, stone: 1 }, { scale: 2.5, seed: 34 }),
    kit.palette({ tuff: 2, cobbled_deepslate: 1, deepslate: 1 }, { scale: 2.5, seed: 35 }),
    kit.palette({ deepslate: 2, cobbled_deepslate: 2 }, { scale: 2.5, seed: 36 }),
  ]
  const rockCells = b.entries().filter(([, , , blk]) => blk.name === ROCK)
  for (const [x, y, z] of rockCells) {
    let solid = 0
    for (let dx = -2; dx <= 2; dx += 1)
      for (let dy = -2; dy <= 2; dy += 1)
        for (let dz = -2; dz <= 2; dz += 1) if (b.has(x + dx, y + dy, z + dz)) solid += 1
    const occ = (solid - 1) / 124
    const t = 0.55 * (1 - y / PLATEAU) + 1.8 * (occ - 0.5) + 0.35 * (noise.coherent01(x, y * 0.3, z, { scale: 4, seed: 37 }) - 0.5) + 0.2
    b.set(x, y, z, rockRamp[clamp(Math.round(t * 5), 0, 5)])
  }

  // ------------------------------------------------------------------ path furniture
  // timber bridge over the cleft: plank deck (slab half-steps), fence rails on both edges
  for (const [key, c] of pathCells) {
    if (!c.onBridge) continue
    const [x, z] = key.split(',').map(Number)
    const edge = c.outer || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !pathCells.has(`${x + dx},${z + dz}`))
    b.set(x, c.top, z, 'minecraft:spruce_planks')
    if (c.half && !edge) b.set(x, c.top + 1, z, 'minecraft:spruce_slab[type=bottom]')
    if (edge) b.set(x, c.top + 1, z, 'minecraft:spruce_fence')
    if (edge && c.half) b.set(x, c.top + 2, z, 'minecraft:spruce_fence')
    b.set(x, c.top - 1, z, 'minecraft:spruce_slab[type=top]', { keep: true })
  }
  // lamp posts every so often along the open edge of the path
  {
    const best = new Map()
    for (const [key, c] of pathCells) {
      if (!c.outer || c.onBridge || c.t < 0.04 || c.t > 0.98) continue
      const k = Math.round(c.t / 0.085)
      const err = Math.abs(c.t - k * 0.085)
      if (!best.has(k) || err < best.get(k).err) best.set(k, { key, c, err })
    }
    for (const { key, c } of best.values()) {
      const [x, z] = key.split(',').map(Number)
      b.lampPost([x, c.top + 1, z], { height: 2, post: 'minecraft:spruce_fence', lantern: 'minecraft:lantern' })
    }
    // lanterns on tall posts at both ends of the bridge
    const ends = [...pathCells].filter(([, c]) => c.outer && c.onBridge).sort((p1, p2) => p1[1].t - p2[1].t)
    for (const [key, c] of [ends[0], ends[ends.length - 1]]) {
      const [x, z] = key.split(',').map(Number)
      b.lampPost([x, c.top + 1, z], { height: 3, post: 'minecraft:spruce_fence', lantern: 'minecraft:lantern' })
    }
  }
  // the last stretch: a trail across the forecourt from the top of the path to the door step
  {
    const pts = [[19.5, 36.5], [22, 36.4], [24.5, 35.8], [27, 35.2]]
    for (let i = 1; i < pts.length; i += 1) {
      for (let k = 0; k <= 12; k += 1) {
        const px = pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * k) / 12
        const pz = pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * k) / 12
        for (let x = Math.floor(px - 1); x <= Math.ceil(px + 1); x += 1) {
          for (let z = Math.floor(pz - 1); z <= Math.ceil(pz + 1); z += 1) {
            if (Math.hypot(x - px, z - pz) > 1.05) continue
            const y = b.topY(x, z)
            if (/grass_block|moss_block|dirt$/.test(b.nameAt(x, y, z) ?? '')) b.set(x, y, z, trail)
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ rock life
  // vines from the cliff lips, glow lichen in the shade, an amethyst geode in the cliff
  b.overgrow([0, 5, 0], [55, PLATEAU, 55], { amount: 0.35, maxLength: 7, moss: false, seed: 4 })
  // ivy creeping up the north-west side of the old stone shaft (the shady, damp side)
  b.overgrow([14, PLATEAU + 2, 14], [28, T.library.y1, 30], { amount: 0.3, maxLength: 6, moss: false, seed: 8 })
  const STONEISH = /minecraft:(stone|andesite|tuff|deepslate|cobbled_deepslate|cobblestone)$/
  for (const [x, y, z, blk] of b.entries()) {
    if (!STONEISH.test(blk.name) || y < 4 || y > PLATEAU) continue
    const n = noise.coherent01(x, y, z, { scale: 3, grain: 0.2, seed: 61 })
    if (n > 0.16) continue
    for (const f of ['north', 'east', 'south', 'west']) {
      const d = kit.DIR[f]
      if (b.has(x + d[0], y, z + d[2])) continue
      b.set(x + d[0], y, z + d[2], `minecraft:glow_lichen[${kit.opposite(f)}=true]`)
      break
    }
  }
  {
    // geode: find the cliff surface south of the west lobe, carve a pocket, line it with
    // smooth basalt -> calcite -> amethyst (the vanilla geode layering) and grow clusters inwards
    let gz = 30
    while (gz < 50 && b.has(21, 12, gz + 1)) gz += 1
    const G = [21, 12, gz - 1]
    const R = 2.3
    const inPocket = (x, y, z) => Math.hypot(x - G[0], (y - G[1]) * 1.2, z - G[2]) <= R
    for (let x = G[0] - 5; x <= G[0] + 5; x += 1)
      for (let y = G[1] - 5; y <= G[1] + 5; y += 1)
        for (let z = G[2] - 5; z <= G[2] + 5; z += 1) {
          const d = Math.hypot(x - G[0], (y - G[1]) * 1.2, z - G[2])
          if (inPocket(x, y, z)) b.remove(x, y, z)
          else if (b.has(x, y, z) && d <= R + 1) b.set(x, y, z, 'minecraft:amethyst_block')
          else if (b.has(x, y, z) && d <= R + 2) b.set(x, y, z, 'minecraft:calcite')
          else if (b.has(x, y, z) && d <= R + 2.8) b.set(x, y, z, 'minecraft:smooth_basalt')
        }
    for (let x = G[0] - 3; x <= G[0] + 3; x += 1)
      for (let y = G[1] - 3; y <= G[1] + 3; y += 1)
        for (let z = G[2] - 3; z <= G[2] + 3; z += 1) {
          if (b.has(x, y, z) || !inPocket(x, y, z)) continue
          for (const f of ['up', 'down', 'north', 'south', 'east', 'west']) {
            const d = kit.DIR[f]
            if (b.nameAt(x - d[0], y - d[1], z - d[2]) !== 'minecraft:amethyst_block') continue
            if (kit.hash01(x, y, z, 5) < 0.55) b.set(x, y, z, `minecraft:${kit.hash01(x, y, z, 6) < 0.6 ? 'amethyst_cluster' : 'large_amethyst_bud'}[facing=${f},waterlogged=false]`)
            break
          }
        }
  }
  // amethyst growing out of a few ledges
  for (const [x, y, z] of [[33, 18, 37], [16, 15, 25], [37, 12, 22], [24, 9, 41]]) {
    const ty = b.topY(x, z)
    if (ty < 0) continue
    b.set(x, ty + 1, z, 'minecraft:amethyst_cluster[facing=up,waterlogged=false]', { keep: true })
    b.set(x + 1, b.topY(x + 1, z) + 1, z, 'minecraft:medium_amethyst_bud[facing=up,waterlogged=false]', { keep: true })
  }

  // ------------------------------------------------------------------ landscape
  const onGrass = (x, z) => /grass_block|moss_block/.test(b.nameAt(x, b.topY(x, z), z) ?? '')
  // Trees, each with a shroomlight hidden in the canopy: by day it is a warm fleck among the
  // leaves, by night it lights the canopy from inside (leaves let light through).
  const plantTree = (x, z, species, opts) => {
    const y = b.topY(x, z)
    b.tree([x, y + 1, z], species, opts)
    for (const [dx, dz] of [[2, 1], [-1, -2]]) {
      let ly = -1
      for (let yy = y + 2; yy < SIZE[1]; yy += 1) if (/_leaves$/.test(b.nameAt(x + dx, yy, z + dz) ?? '')) { ly = yy; break }
      if (ly > 0 && /_leaves$/.test(b.nameAt(x + dx, ly + 1, z + dz) ?? '')) b.set(x + dx, ly + 1, z + dz, 'minecraft:shroomlight')
    }
  }
  plantTree(16, 29, 'azalea', { seed: 3, height: 7 }) // the wizard's garden tree on the plateau
  plantTree(45, 15, 'fantasy', { seed: 2, height: 15, trunk: 1.4, blob: [3, 3.8], branches: [4, 5], roots: 6, leaves: ['azalea_leaves', 'flowering_azalea_leaves', 'dark_oak_leaves'] })
  plantTree(9, 37, 'dark_oak', { seed: 5, height: 10 })
  plantTree(12, 13, 'birch', { seed: 8, height: 12 })
  plantTree(44, 42, 'azalea', { seed: 7, height: 6 })
  for (const [x, z, r] of [[33, 47, 1.6], [16, 46, 1.8], [48, 25, 1.5], [6, 25, 1.7], [39, 9, 1.6]]) {
    b.bush([x, b.topY(x, z) + 1, z], { radius: r, leaves: ['azalea_leaves', 'flowering_azalea_leaves', 'oak_leaves'], seed: x })
  }
  // mossy boulders on the meadow
  const boulderPaint = kit.palette({ stone: 3, andesite: 2, cobblestone: 1, mossy_cobblestone: 1 }, { scale: 2 })
  for (const [x, z, r] of [[41, 47, 1.6], [8, 31, 1.4], [30, 49, 1.2], [47, 33, 1.3], [22, 7, 1.5]]) {
    b.boulder([x, b.topY(x, z) + 0.5, z], [r * 1.2, r * 0.8, r], boulderPaint, { seed: x * 7 + z, mossTop: 'minecraft:moss_block' })
  }
  // toadstools with shroomlight gills: whimsy at ground level, glow at night
  const toadstool = (x, z, h, r, cap) => {
    const y0 = b.topY(x, z) + 1
    for (let y = y0; y < y0 + h; y += 1) b.set(x, y, z, 'minecraft:mushroom_stem')
    b.dome([x, y0 + h, z], r, `minecraft:${cap}`, { height: r * 0.75 })
    b.disc([x, y0 + h, z], r - 1, 'minecraft:shroomlight')
    b.set(x, y0 + h, z, 'minecraft:mushroom_stem')
  }
  toadstool(37, 44, 4, 2.5, 'red_mushroom_block')
  toadstool(40, 40, 2, 1.6, 'red_mushroom_block')
  toadstool(13, 42, 3, 2.2, 'brown_mushroom_block')
  // meadow plants
  b.scatter({ on: ['minecraft:grass_block', 'minecraft:moss_block'], density: 0.42, seed: 9, clump: 5, paints: [
    [14, 'minecraft:short_grass'], [5, 'minecraft:tall_grass'], [4, 'minecraft:fern'], [2, 'minecraft:large_fern'],
    [1, 'minecraft:allium'], [1, 'minecraft:azure_bluet'], [1, 'minecraft:cornflower'], [1, 'minecraft:lily_of_the_valley'],
    [1, 'minecraft:oxeye_daisy'], [1, 'minecraft:red_mushroom'], [1, 'minecraft:brown_mushroom'], [1, 'minecraft:torchflower'],
  ] })

  // texture the masonry placeholder
  b.texture([0, 16, 0], [55, 70, 55], ['polished_andesite', 'stone_bricks', 'cracked_stone_bricks', 'tuff_bricks', 'cobbled_deepslate'], { only: PH, base: 0.35 })

  return b.finish({ name: 'wizard-tower' })
}
