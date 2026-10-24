// Walled village: settlement composition with kit.plan (references/building/composition.md).
// Shows the planning layer, not house detail — see medieval-house.mjs / tavern.mjs for that.
// Pipeline (composition.md §3): terrain → plaza → roads (A*) → wall + gates → landmark →
// lots along roads → houses → fields, trees, lamps → skyline report.


const SIZE = [128, 64, 128]
const C = [56, 62]               // town centre (x, z)
const WATER = 9                  // river level

export default function build(api) {
  const { kit } = api
  const plan = kit.plan
  const b = api.builder(SIZE, { seed: 11 })
  const rng = kit.rng(11)
  const [W, , D] = SIZE

  // ---------------------------------------------------------------- terrain + river
  const riverX = z => 112 + 4 * Math.sin(z / 14)
  const heightAt = (x, z) => {
    const hills = 14 + 6 * kit.noise.fbm2(x, z, { scale: 46, seed: 3 }) + 2.5 * kit.noise.fbm2(x, z, { scale: 14, seed: 4 })
    const rise = 3 * Math.exp(-(((x - C[0]) ** 2 + (z - C[1]) ** 2) / (2 * 30 ** 2)))   // town on a low rise
    const d = Math.abs(x - riverX(z))
    const valley = d < 14 ? (1 - d / 14) ** 1.6 * 8 : 0
    return Math.max(WATER - 3, hills + rise - valley)
  }
  b.terrain({ height: heightAt, layers: [{ depth: 1, paint: 'grass_block' }, { depth: 3, paint: 'dirt' }, { paint: 'stone' }] })
  for (let z = 0; z < D; z += 1) {
    for (let x = 0; x < W; x += 1) {
      const d = Math.abs(x - riverX(z))
      if (d > 4) continue
      const bed = WATER - (d < 2.5 ? 3 : 1)
      for (let y = bed + 1; y < SIZE[1]; y += 1) b.remove(x, y, z)
      b.set(x, bed, z, d < 2.5 ? 'gravel' : 'sand')
      for (let y = bed + 1; y <= WATER; y += 1) b.set(x, y, z, 'water')
    }
  }

  // ---------------------------------------------------------------- plaza (market square)
  const square = plan.plaza(b, C, [15, 19], {
    feature: 'well',
    paint: kit.palette({ stone_bricks: 5, andesite: 2, cobblestone: 2, polished_andesite: 1 }),
    border: 'cobblestone',
    seed: 2,
  })
  const plazaCells = new Set(square.cells.map(([x, z]) => `${x},${z}`))

  // ---------------------------------------------------------------- roads
  let ground = plan.heightmapOf(b)
  const roadCells = new Set()
  const remember = path => { for (const [x, , z] of path) roadCells.add(`${Math.round(x)},${Math.round(z)}`) }
  const avoidPlaza = (x, z) => plazaCells.has(`${x},${z}`)
  const edgeOf = (dx, dz) => {             // a plaza rim cell on one side, as road end
    let best = null
    for (const [x, z] of square.cells) {
      const score = x * dx + z * dz
      if (!best || score > best[2]) best = [x, z, score]
    }
    return [best[0] + dx, best[1] + dz]
  }
  const route = (from, to, opts = {}) => {
    const p = plan.routeRoad(ground, from, to, { avoid: avoidPlaza, roads: roadCells, ...opts })
    remember(p)
    return p
  }
  const westRoad = route([0, 56], edgeOf(-1, 0))
  const eastRoad = route(edgeOf(1, 0), [127, 70])
  const northRoad = route(edgeOf(0, -1), [70, 0])
  const southLane = route(edgeOf(0, 1), [46, 127])
  const mainPaint = kit.palette({ dirt_path: 6, coarse_dirt: 2, gravel: 1 }, { seed: 5 })
  const lanePaint = kit.palette({ dirt_path: 5, coarse_dirt: 3, rooted_dirt: 1 }, { seed: 6 })
  for (const r of [westRoad, eastRoad, northRoad]) plan.paintRoad(b, r, { width: 3, paint: mainPaint, edge: 'coarse_dirt', bridge: { deck: 'spruce_planks' } })
  plan.paintRoad(b, southLane, { width: 2, paint: lanePaint })
  ground = plan.heightmapOf(b)

  // ---------------------------------------------------------------- town wall
  const poly = plan.ringPolygon(C, [44, 41], { n: 10, jitter: 0.08, seed: 4 })
  const crossings = []
  for (const road of [westRoad, eastRoad, northRoad]) {
    for (let i = 1; i < road.length; i += 1) {
      const a = plan.pointInPolygon(road[i - 1][0], road[i - 1][2], poly)
      const c = plan.pointInPolygon(road[i][0], road[i][2], poly)
      if (a !== c) { crossings.push([road[i][0], road[i][2]]); break }
    }
  }
  const wall = plan.curtainWall(b, poly, {
    height: 8,
    thickness: 3,
    paint: kit.palette({ stone_bricks: 6, andesite: 2, cobblestone: 2, mossy_stone_bricks: 1 }, { seed: 8 }),
    towerPaint: kit.palette({ stone_bricks: 5, cobblestone: 2, andesite: 1 }, { seed: 9 }),
    walkway: 'polished_andesite',
    towerEvery: 22,
    towerRadius: 3,
    towerHeight: 5,
    roofMaterial: 'deepslate_tile',
    gates: crossings.map(at => ({ at, width: 3, height: 4 })),
  })
  const distToWall = (x, z) => {
    let d = Infinity
    for (let i = 0; i < poly.length; i += 1) {
      const [ax, az] = poly[i]
      const [cx, cz] = poly[(i + 1) % poly.length]
      const dx = cx - ax
      const dz = cz - az
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
      d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t))
    }
    return d
  }
  const insideTown = (x, z) => plan.pointInPolygon(x, z, poly) && distToWall(x, z) >= 5
  const outsideTown = (x, z) => !plan.pointInPolygon(x, z, poly) && distToWall(x, z) >= 9 && Math.abs(x - riverX(z)) > 9

  // ---------------------------------------------------------------- landmark: church facing the square
  // Authored once as a module (tower at z = 0, door facing north), stamped with the rotation
  // that turns its tower end toward the square: pipeline step 5 (landmark sites) before lanes and lots.
  const occupied = new Set(plazaCells)
  const churchModule = (() => {
    const m = b.module([11, 44, 21])
    const stone = kit.palette({ stone_bricks: 6, andesite: 2, tuff_bricks: 1 }, { seed: 12 })
    const F = 4                                                                   // floor level inside the module
    m.box([0, 0, 0], [10, F, 20], 'cobblestone')
    m.walls([0, F + 1, 6], [10, F + 9, 20], stone)                                // nave 11×15
    m.box([1, F, 7], [9, F, 19], 'spruce_planks')
    m.roof({ x0: 0, z0: 6, x1: 10, z1: 20, y: F + 10, axis: 'z', material: 'deepslate_tile', pitch: 1, gable: stone, eaveTrim: true })
    m.box([2, F + 1, 0], [8, F + 26, 6], stone)                                   // tower 7×7, 26 tall
    m.clear([3, F + 1, 1], [7, F + 25, 5])
    m.box([1, F + 27, -1 + 1], [9, F + 27, 6], 'stone_brick_slab[type=top]')
    const spire = m.roof({ x0: 2, z0: 0, x1: 8, z1: 6, y: F + 28, type: 'pyramid', material: 'deepslate_tile', pitch: 3, overhang: 1 })
    m.set(5, spire.topY + 1, 3, 'lightning_rod')
    for (const yy of [F + 20, F + 21, F + 22]) for (const [wx, wz] of [[5, 0], [2, 3], [8, 3]]) m.set(wx, yy, wz, 'air')
    m.door([5, F + 1, 0], 'north', { material: 'dark_oak' })
    for (let z = 8; z <= 18; z += 3) {
      m.window([0, F + 3, z], 'west', { width: 1, height: 3 })
      m.window([10, F + 3, z], 'east', { width: 1, height: 3 })
    }
    return m
  })()
  const church = (() => {
    let best = null
    const centroid = C
    for (let rot = 0; rot < 4; rot += 1) {
      const [w, d] = rot % 2 ? [21, 11] : [11, 21]
      for (let z0 = C[1] - 40; z0 <= C[1] + 30; z0 += 1) {
        for (let x0 = C[0] - 40; x0 <= C[0] + 30; x0 += 1) {
          const x1 = x0 + w - 1
          const z1 = z0 + d - 1
          // tower end (north side of the module) after rotation: 0 → z0, 1 → x1, 2 → z1, 3 → x0
          const towerMid = [[x0 + 5, z0], [x1, z0 + 5], [x0 + 5, z1], [x0, z0 + 5]][rot]
          const facingIn = [[0, -1], [1, 0], [0, 1], [-1, 0]][rot]
          const toward = (centroid[0] - towerMid[0]) * facingIn[0] + (centroid[1] - towerMid[1]) * facingIn[1]
          if (toward <= 0) continue                                               // tower end must face the square
          const dist = Math.min(...square.cells.map(([x, z]) => Math.hypot(x - towerMid[0], z - towerMid[1])))
          if (dist < 2 || (best && dist >= best.dist)) continue
          let ok = true
          for (let z = z0 - 1; z <= z1 + 1 && ok; z += 1)
            for (let x = x0 - 1; x <= x1 + 1; x += 1) {
              const k = `${x},${z}`
              if (occupied.has(k) || roadCells.has(k) || !insideTown(x, z)) { ok = false; break }
            }
          if (ok) best = { x0, z0, x1, z1, rot, dist }
        }
      }
    }
    return best
  })()
  if (church) {
    const { x0, z0, x1, z1, rot } = church
    for (let z = z0 - 1; z <= z1 + 1; z += 1) for (let x = x0 - 1; x <= x1 + 1; x += 1) occupied.add(`${x},${z}`)
    const hs = []
    for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) hs.push(ground(x, z))
    hs.sort((p, q) => p - q)
    const y0 = hs[hs.length >> 1]
    b.box([x0, hs[0] - 1, z0], [x1, y0 - 4, z1], 'cobblestone')
    b.stamp(churchModule, [x0, y0 - 4, z0], { rotate: rot })
    // Path from the church door to the square.
    const door = [[x0 + 5, z0 - 1], [x1 + 1, z0 + 5], [x1 - 5, z1 + 1], [x0 - 1, z1 - 5]][rot]
    const dir = [[0, -1], [1, 0], [0, 1], [-1, 0]][rot]
    for (let k = 0; k < 8; k += 1) {
      const px = door[0] + dir[0] * k
      const pz = door[1] + dir[1] * k
      if (plazaCells.has(`${px},${pz}`)) break
      const gy = ground(px, pz)
      b.box([px - 1, gy, pz - 1], [px + 1, gy, pz + 1], 'stone_bricks', { mask: (x, y, z) => !roadCells.has(`${x},${z}`) })
      for (let yy = gy + 1; yy <= gy + 3; yy += 1) b.box([px - 1, yy, pz - 1], [px + 1, yy, pz + 1], 'air', { mask: (x, y, z) => !occupied.has(`${x},${z}`) || plazaCells.has(`${x},${z}`) })
      roadCells.add(`${px},${pz}`)
    }
  }

  // ---------------------------------------------------------------- secondary lanes (inside the wall)
  const lanes = []
  for (const ang of [0.6, 2.3, 3.9, 5.4]) {
    const tx = Math.round(C[0] + Math.cos(ang) * 33)
    const tz = Math.round(C[1] + Math.sin(ang) * 30)
    if (!insideTown(tx, tz)) continue
    const corner = edgeOf(Math.sign(Math.cos(ang)), Math.sign(Math.sin(ang)))
    try {
      const lane = route(corner, [tx, tz], { avoid: (x, z) => avoidPlaza(x, z) || occupied.has(`${x},${z}`) || !plan.pointInPolygon(x, z, poly) || distToWall(x, z) < 4 })
      plan.paintRoad(b, lane, { width: 2, paint: lanePaint })
      lanes.push(lane)
    } catch (e) {
      console.log('lane skipped:', e.message)
    }
  }
  ground = plan.heightmapOf(b)

  // ---------------------------------------------------------------- lots and houses
  const rho = (x, z) => Math.max(0.08, 1 - Math.pow(Math.hypot(x - C[0], z - C[1]) / 46, 1.5))
  const lots = []
  const lotStats = {}
  for (const road of [westRoad, eastRoad, northRoad, southLane, ...lanes]) {
    const width = road === westRoad || road === eastRoad || road === northRoad ? 3 : 2
    lots.push(...plan.lotsAlongRoad(road, {
      roadWidth: width,
      heightFn: ground,
      density: rho,
      inside: insideTown,
      occupied,
      roads: roadCells,
      frontage: ({ density, rng: r }) => Math.round(11 - 6 * density + r() * 2),
      depth: ({ rng: r }) => 7 + Math.floor(r() * 4),
      setback: ({ density }) => (density > 0.7 ? 0 : 1),
      gap: ({ density, rng: r }) => (density > 0.75 ? 0 : 1 + Math.floor(r() * 3)),
      seed: lots.length + 3,
      stats: lotStats,
    }))
  }
  // Buildings fronting the square: treat its outline as a street of width 1.
  const ring = [...square.poly, square.poly[0]].map(([x, z]) => [x, z])
  lots.push(...plan.lotsAlongRoad(ring, {
    roadWidth: 1, heightFn: ground, density: () => 1, inside: insideTown, occupied, roads: roadCells, stats: lotStats,
    frontage: ({ rng: r }) => 5 + Math.floor(r() * 3), depth: [8, 10], setback: 0, gap: 0, startAt: 1, endAt: 1, seed: 77,
  }))
  const ribbon = plan.lotsAlongRoad(westRoad, {
    roadWidth: 3, heightFn: ground, inside: outsideTown, occupied, roads: roadCells,
    frontage: [8, 11], depth: [8, 10], setback: [2, 4], gap: [6, 12], seed: 41,
  })
  const roofs = [[6, 'dark_oak'], [3, 'deepslate_tile'], [1, 'mud_brick']]
  const infills = [[3, kit.palette({ white_terracotta: 4, calcite: 1 }, { seed: 14 })], [1, kit.palette({ mushroom_stem: 3, white_terracotta: 1 }, { seed: 15 })]]
  const built = []
  for (const lot of [...lots, ...ribbon]) {
    const { x0, z0, x1, z1, facing } = lot
    if (x1 - x0 < 4 || z1 - z0 < 4) continue
    let lo = Infinity
    for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) lo = Math.min(lo, ground(x, z))
    const y0 = lot.y
    const d = lot.density ?? 0.3
    let floors = 1 + (d > 0.55 ? 1 : 0) + (rng.chance(0.25) ? 1 : 0)
    floors = Math.min(floors, 3)
    const nb = built[built.length - 1]
    if (nb && Math.abs(nb.floors - floors) > 1) floors = nb.floors + Math.sign(floors - nb.floors)
    const top = y0 + floors * 4
    b.box([x0, lo - 1, z0], [x1, y0, z1], 'cobblestone')                           // plinth reaches the lowest ground
    b.box([x0, y0 + 1, z0], [x1, y0 + 1, z1], 'cobblestone', { mask: (x, y, z) => x === x0 || x === x1 || z === z0 || z === z1 })
    b.walls([x0, y0 + 2, z0], [x1, top, z1], rng.weighted(infills))
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box([cx, y0 + 1, cz], [cx, top, cz], 'spruce_log')
    if (floors > 1) b.box([x0, y0 + 5, z0], [x1, y0 + 5, z1], 'stripped_spruce_log[axis=y]', { mask: (x, y, z) => x === x0 || x === x1 || z === z0 || z === z1 })
    b.box([x0 + 1, y0, z0 + 1], [x1 - 1, y0, z1 - 1], 'spruce_planks')
    const along = facing === 'north' || facing === 'south' ? 'x' : 'z'
    const across = along === 'x' ? 'z' : 'x'
    const axis = rng.chance(0.7) ? along : across                                  // eaves vs gable to street
    const mat = rng.weighted(roofs)
    const r = b.roof({ x0, z0, x1, z1, y: top + 1, axis, material: mat, pitch: 1, gable: 'spruce_planks', eaveTrim: true })
    const [dx, dz] = lot.door
    b.door([dx, y0 + 1, dz], facing, { material: 'spruce' })
    const right = kit.DIR[kit.ccw(facing)]
    for (const k of [-2, 2]) {
      const wx = dx + right[0] * k
      const wz = dz + right[2] * k
      if (wx > x0 && wx < x1 || wz > z0 && wz < z1) {
        if ((along === 'x' && wx > x0 && wx < x1) || (along === 'z' && wz > z0 && wz < z1)) b.window([wx, y0 + 2, wz], facing, { width: 1, height: 1, shutters: true })
      }
    }
    if (floors > 1) b.window([dx, y0 + 6, dz], facing, { width: 1, height: 2 })
    if (rng.chance(0.6)) {
      const cx = facing === 'south' || facing === 'north' ? (rng.chance(0.5) ? x0 + 1 : x1 - 1) : Math.round((x0 + x1) / 2)
      const cz = facing === 'east' || facing === 'west' ? (rng.chance(0.5) ? z0 + 1 : z1 - 1) : (facing === 'south' ? z0 + 1 : z1 - 1)
      b.chimney([cx, y0 + 1, cz], r.topY - y0 + 1, { paint: kit.palette({ bricks: 3, stone_bricks: 1 }) })
    }
    // Door path to the road.
    const v = kit.DIR[facing]
    for (let k = 1; k <= 5; k += 1) {
      const px = dx + v[0] * k
      const pz = dz + v[2] * k
      if (roadCells.has(`${px},${pz}`)) break
      const gy = ground(px, pz)
      b.set(px, gy, pz, 'dirt_path')
      b.remove(px, gy + 1, pz)
    }
    built.push({ floors })
  }

  // ---------------------------------------------------------------- fields outside the west gate (furlongs)
  const crops = [[4, 'wheat[age=7]'], [2, 'carrots[age=7]'], [2, 'potatoes[age=7]'], [1, 'beetroots[age=3]']]
  const fieldOrigins = [[6, 70], [6, 28], [30, 98]]
  for (const [fx, fz] of fieldOrigins) {
    for (let s = 0; s < 3; s += 1) {
      const crop = rng.weighted(crops)
      for (let t = 0; t < 22; t += 1) {
        for (let k = 0; k < 9; k += 1) {
          const x = fx + t
          const z = fz + s * 10 + k
          if (!outsideTown(x, z) || occupied.has(`${x},${z}`) || roadCells.has(`${x},${z}`)) continue
          const gy = ground(x, z)
          if (Math.abs(gy - ground(fx, fz + s * 10 + 4)) > 1) continue
          b.remove(x, gy + 1, z)
          if (k === 4) b.set(x, gy, z, 'water')
          else { b.set(x, gy, z, 'farmland[moisture=7]'); b.set(x, gy + 1, z, crop) }
        }
      }
    }
  }

  // ---------------------------------------------------------------- trees and lamps
  ground = plan.heightmapOf(b)
  const free = (x, z, r) => {
    for (let dz = -r; dz <= r; dz += 1) for (let dx = -r; dx <= r; dx += 1) {
      const k = `${x + dx},${z + dz}`
      if (occupied.has(k) || roadCells.has(k)) return false
      const top = b.get(x + dx, ground(x + dx, z + dz), z + dz)
      if (!top || top.name !== 'minecraft:grass_block') return false
    }
    return true
  }
  const trees = []
  for (let i = 0; i < 1400 && trees.length < 70; i += 1) {
    const x = rng.int(10, W - 11)          // crowns reach ~6 blocks: keep trunks off the canvas edge
    const z = rng.int(10, D - 11)
    const outside = outsideTown(x, z)
    const grove = kit.noise.fbm2(x, z, { scale: 22, seed: 21 }) > (outside ? -0.02 : 0.25)
    if (!grove || !free(x, z, 2)) continue
    if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 7)) continue
    trees.push([x, z])
    b.tree([x, ground(x, z) + 1, z], rng.chance(0.25) ? 'birch' : rng.chance(0.3) ? 'spruce' : 'oak', { seed: i })
  }
  for (const road of [westRoad, eastRoad, northRoad]) {
    for (let i = 4; i < road.length; i += 10) {
      const [x, , z] = road[i]
      if (!plan.pointInPolygon(x, z, poly)) continue
      const a = road[Math.max(0, i - 1)]
      const c = road[Math.min(road.length - 1, i + 1)]
      const side = (i / 10) % 2 < 1 ? 1 : -1
      const nx = -(c[2] - a[2])
      const nz = c[0] - a[0]
      const l = Math.hypot(nx, nz) || 1
      const lx = Math.round(x + (nx / l) * 2.5 * side)
      const lz = Math.round(z + (nz / l) * 2.5 * side)
      if (occupied.has(`${lx},${lz}`) || roadCells.has(`${lx},${lz}`)) continue
      b.lampPost([lx, ground(lx, lz) + 1, lz], { height: 3, post: 'spruce_fence', foot: 'cobblestone_wall' })
    }
  }
  b.scatter({ density: 0.22, paints: [[10, 'short_grass'], [2, 'tall_grass'], [1, 'poppy'], [1, 'dandelion'], [1, 'cornflower']], seed: 3 })

  const sky = plan.skylineReport(b)
  console.log(sky.text)
  console.log('lot rejections', JSON.stringify(lotStats))
  console.log('gates', JSON.stringify(wall.gates.map(g => [g.x, g.y, g.z])))
  console.log(`lots: ${lots.length} in town, ${ribbon.length} ribbon; towers: ${wall.towers.length}; gates: ${wall.gates.length}; church: ${Boolean(church)}`)
  return b.finish({ name: 'walled-village', description: 'plan.mjs test: walled village on noise terrain' })
}
