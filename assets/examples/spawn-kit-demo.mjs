// Spawn kit demo: a small SMP spawn that uses every component of the spawn & lobby kit.
//
// Brief: players spawn on a compass rose in a paved plaza sunk into a wooded hollow, facing
// north toward the leaderboard wall (three hologram boards, the hero board raised over a top-3
// podium); a guide NPC on a pedestal with a backdrop screen stands between them. West: the
// crate arcade (five tiered stations) under a CRATES sign set on the arcade wall. East: the shop
// hall, a taller centre bay between two lower wings, with the shop NPC in an arched alcove under
// a SHOP sign. South: the RTP gate leading out into the trees, a two-stall market lane and an
// info kiosk. White quartz field, charcoal deepslate frames, deepslate tile roofs, timber stalls,
// warm froglight glow behind glass; spawn-proofed with invisible lights.
//
//   node scripts/run-build.mjs assets/examples/spawn-kit-demo.mjs --out-dir minecraft-builds/spawn-kit-demo --origin -42,64,-44 --json

export default function build(api) {
  const { kit } = api
  const S = 84
  const b = api.builder([S, 38, S], { seed: 11 })
  const FY = 4 // floor block level: players stand at y 5
  const CX = 42
  const CZ = 44 // the spawn point

  // ---------------------------------------------------------------- site: a plaza in a wooded hollow
  // plaza outline: a rounded square with a noisy edge; outside it the ground rises 1-4 blocks
  const edge = (x, z) => {
    const ex = Math.abs(x - CX) / 36
    const ez = Math.abs(z - CZ) / 37
    return ex ** 4 + ez ** 4 + 0.06 * kit.noise.fbm2(x, z, { scale: 9, seed: 5 })
  }
  const inPlaza = (x, z) => edge(x, z) < 1
  const ground = b.terrain({
    height: (x, z) => {
      const e = edge(x, z)
      if (e < 1) return FY
      return FY + Math.min(4, Math.round(1 + (e - 1) * 3 + 1.2 * kit.noise.fbm2(x, z, { scale: 11, seed: 2 })))
    },
  })
  // paving: a calm clumped field, a stone-brick kerb at the edge, path bands to each feature
  const field = kit.palette({ polished_andesite: 6, andesite: 2, polished_tuff: 1 }, { scale: 4, seed: 3 })
  const path = kit.palette({ smooth_stone: 5, polished_andesite: 1 }, { scale: 3, seed: 8 })
  for (let x = 0; x < S; x += 1)
    for (let z = 0; z < S; z += 1) {
      if (!inPlaza(x, z)) continue
      const kerb = !inPlaza(x + 1, z) || !inPlaza(x - 1, z) || !inPlaza(x, z + 1) || !inPlaza(x, z - 1)
      const d = Math.hypot(x - CX, z - CZ)
      const ax = Math.abs(x - CX)
      const az = Math.abs(z - CZ)
      let p = field
      if (kerb) p = kit.hash01(x, 0, z, 4) < 0.3 ? 'mossy_stone_bricks' : 'stone_bricks'
      else if (d < 1.5) p = 'chiseled_quartz_block'
      else if (d < 3.6) p = ax === 0 || az === 0 ? 'polished_deepslate' : 'smooth_quartz'
      else if (d < 4.6) p = 'polished_deepslate'
      else if (d < 7.6) p = (x + z) % 2 === 0 ? 'calcite' : 'smooth_quartz'
      else if (d < 8.6) p = 'polished_blackstone'
      else if (ax <= 2 || az <= 2) p = path
      else if (ax === 3 || az === 3) p = 'stone_bricks'
      b.set(x, FY, z, p)
    }

  // ---------------------------------------------------------------- north: the leaderboard wall
  b.leaderboards([CX, FY, 12], 'south', {
    count: 3, width: 5, height: 6, gap: 3, podium: true,
    ids: ['kills', 'money', 'playtime'], labels: ['Top Kills', 'Richest Players', 'Playtime'],
  })
  b.npcSpot([27, FY + 1, 25], 'south', { id: 'guide', label: 'Guide', role: 'tutorial', style: 'pedestal' })

  // ---------------------------------------------------------------- west: the crate arcade
  // the arcade wall: plinth, white field, pilasters at the ends, cornice and coping; the CRATES
  // lettering sits on it in a framed board above the stations
  const AW = { x0: 3, x1: 7, z0: 29, z1: 59, top: FY + 21 }
  for (let x = AW.x0; x <= AW.x1; x += 1)
    for (let z = AW.z0; z <= AW.z1; z += 1)
      for (let y = FY + 1; y <= AW.top; y += 1) b.set(x, y, z, y <= FY + 2 ? 'deepslate_tiles' : y === AW.top ? 'polished_deepslate' : 'smooth_quartz')
  for (let z = AW.z0 - 1; z <= AW.z1 + 1; z += 1) {
    b.set(AW.x1 + 1, AW.top, z, 'polished_deepslate_stairs[facing=west,half=top]')
    for (let x = AW.x0; x <= AW.x1; x += 1) b.set(x, AW.top + 1, z, x === AW.x0 || x === AW.x1 ? 'polished_deepslate_slab[type=bottom]' : 'polished_deepslate')
  }
  for (const z of [AW.z0, AW.z1]) for (let y = FY + 1; y < AW.top; y += 1) b.set(AW.x1 + 1, y, z, y <= FY + 2 ? 'deepslate_tiles' : 'polished_deepslate')
  for (const z of [AW.z0, AW.z1]) b.set(AW.x1 + 1, AW.top + 1, z, 'lantern')
  // a ledge above the stations with lanterns, pilasters on the arcade's end faces
  for (let z = AW.z0 + 1; z < AW.z1; z += 1) b.set(AW.x1 + 1, FY + 9, z, 'polished_deepslate_stairs[facing=west,half=top]')
  for (const z of [32, 42, 46, 56]) b.set(AW.x1 + 1, FY + 8, z, 'lantern[hanging=true]')
  for (const [z, f] of [[AW.z0 - 1, 'south'], [AW.z1 + 1, 'north']]) {
    for (let y = FY + 1; y < AW.top; y += 1) b.set(5, y, z, y <= FY + 2 ? 'deepslate_tiles' : 'polished_deepslate')
    for (const x of [3, 4, 6, 7]) b.set(x, FY + 1, z, `deepslate_tile_stairs[facing=${f}]`)
  }
  // the arcade's back and ends: pilasters every 5, a plinth course
  for (let z = AW.z0; z <= AW.z1; z += 1) {
    b.set(AW.x0 - 1, FY + 1, z, 'deepslate_tile_stairs[facing=east]')
    if ((z - AW.z0) % 5 === 0) for (let y = FY + 1; y < AW.top; y += 1) b.set(AW.x0 - 1, y, z, y <= FY + 2 ? 'deepslate_tiles' : 'polished_deepslate')
    b.set(AW.x0 - 1, AW.top, z, 'polished_deepslate_stairs[facing=east,half=top]')
  }
  b.crateRow([13, FY + 2, 54], 'east', [
    { id: 'common', label: 'Common Crate', tier: 'common', block: 'chest' },
    { id: 'rare', label: 'Rare Crate', tier: 'rare', block: 'chest' },
    { id: 'legendary', label: 'Legendary Crate', tier: 'legendary', block: 'ender_chest' },
    { id: 'epic', label: 'Epic Crate', tier: 'epic', block: 'barrel' },
    { id: 'vote', label: 'Vote Crate', tier: 'vote', block: 'shulker' },
  ], { spacing: 5 })
  b.sign('CRATES', [10, FY + 17, CZ], 'east', { font: 'small', align: 'center', board: 'polished_blackstone' })

  // ---------------------------------------------------------------- east: the shop hall
  // massing: a taller centre bay (alcove + SHOP sign) between two lower wings
  const HX0 = 66
  const HX1 = 77
  const bay = { z0: 34, z1: 54, top: FY + 25 }
  const wings = [{ z0: 27, z1: 33, top: FY + 12 }, { z0: 55, z1: 61, top: FY + 12 }]
  const mass = (z0, z1, top) => {
    for (let x = HX0; x <= HX1; x += 1)
      for (let z = z0; z <= z1; z += 1)
        for (let y = FY + 1; y <= top; y += 1) {
          const shell = x === HX0 || x === HX1 || z === z0 || z === z1
          if (!shell) continue
          b.set(x, y, z, y <= FY + 2 ? 'deepslate_tiles' : y === top || y === FY + 11 ? 'polished_deepslate' : 'smooth_quartz')
        }
    // plinth stairs and the cornice on the plaza face
    for (let z = z0; z <= z1; z += 1) {
      b.set(HX0 - 1, FY + 1, z, 'deepslate_tile_stairs[facing=east]')
      b.set(HX0 - 1, top, z, 'polished_deepslate_stairs[facing=east,half=top]')
    }
    for (const z of [z0, z1]) for (let y = FY + 1; y < top; y += 1) b.set(HX0 - 1, y, z, y <= FY + 2 ? 'deepslate_tiles' : 'polished_deepslate')
  }
  mass(bay.z0, bay.z1, bay.top)
  for (const w of wings) mass(w.z0, w.z1, w.top)
  // pilasters every 5 blocks on the visible faces (and at the corners), proud by 1
  const pilaster = (x, z, y0, y1, corner) => {
    for (let y = y0; y <= y1; y += 1) b.set(x, y, z, y <= FY + 2 ? 'deepslate_tiles' : corner || y === FY + 11 ? 'polished_deepslate' : 'quartz_pillar[axis=y]', { keep: true })
  }
  for (const m of [bay, ...wings]) {
    const low = m === bay ? wings[0].top + 1 : FY + 1
    for (let x = HX0; x <= HX1; x += 1) {
      if ((x - HX0) % 5 !== 0 && x !== HX1) continue
      const corner = x === HX0 || x === HX1
      if (m !== wings[1]) pilaster(x, m.z0 - 1, m === bay ? low : FY + 1, m.top - 1, corner)
      if (m !== wings[0]) pilaster(x, m.z1 + 1, m === bay ? low : FY + 1, m.top - 1, corner)
    }
    for (let z = m.z0; z <= m.z1; z += 1) if ((z - m.z0) % 5 === 0 || z === m.z1) pilaster(HX1 + 1, z, FY + 1, m.top - 1, z === m.z0 || z === m.z1)
  }
  // windows on the side and back faces
  const sideWin = (x, y, z, facing) => b.window([x, y, z], facing, { width: 2, height: 3, glass: 'white_stained_glass_pane', frame: 'polished_deepslate', recess: 1, sill: true, material: 'dark_oak' })
  for (const y of [FY + 4, FY + 7]) {
    sideWin(HX0 + 2, y, wings[0].z0, 'north')
    sideWin(HX0 + 7, y, wings[0].z0, 'north')
    sideWin(HX0 + 3, y, wings[1].z1, 'south')
    sideWin(HX0 + 8, y, wings[1].z1, 'south')
  }
  for (const y of [FY + 15, FY + 20]) {
    sideWin(HX0 + 2, y, bay.z0, 'north')
    sideWin(HX0 + 7, y, bay.z0, 'north')
    sideWin(HX0 + 3, y, bay.z1, 'south')
    sideWin(HX0 + 8, y, bay.z1, 'south')
  }
  for (const z of [29, 37, 42, 47, 57]) b.window([HX1, FY + 4, z + 1], 'east', { width: 2, height: 3, glass: 'white_stained_glass_pane', frame: 'polished_deepslate', recess: 1, material: 'dark_oak' })
  // windows: two storeys on the wings, ground floor either side of the alcove
  const win = (z, y) => b.window([HX0, y, z], 'west', { width: 2, height: 3, glass: 'white_stained_glass_pane', frame: 'polished_deepslate', sill: 'polished_deepslate_stairs[facing=east,half=top]', lintel: 'polished_deepslate_slab[type=bottom]', recess: 1, shutters: 'dark_oak_trapdoor' })
  for (const w of wings) for (const y of [FY + 4, FY + 13 - 6]) win(w.z0 + 3, y)
  for (const z of [37, 50]) win(z, FY + 4)
  b.npcSpot([HX0 + 1, FY, CZ], 'west', { id: 'shop', label: 'Shop', role: 'shop', style: 'alcove' })
  b.sign('SHOP', [HX0 - 1, FY + 21, CZ], 'west', { font: 'small', align: 'center', board: 'polished_blackstone' })
  // roofs: a hip over the bay, gables on the wings butting into it
  b.roof({ x0: HX0, z0: bay.z0, x1: HX1, z1: bay.z1, y: bay.top + 1, type: 'hip', material: 'deepslate_tile', overhang: 1, eaveTrim: true })
  for (const w of wings) b.roof({ x0: HX0, z0: w.z0, x1: HX1, z1: w.z1, y: w.top + 1, type: 'gable', axis: 'x', material: 'deepslate_tile', overhang: 1, gable: 'smooth_quartz', eaveTrim: true, overwrite: false })

  // ---------------------------------------------------------------- centre: the spawn
  b.spawnPoint([CX, FY, CZ], 'north')

  // ---------------------------------------------------------------- south: RTP gate, market, kiosk
  const GX = 12 // the RTP gate, north-west, leading out into the trees
  const GZ = 17
  b.portal([GX - 2, FY + 1, GZ], [GX + 2, FY + 5, GZ], { id: 'rtp', label: 'Random Teleport', kind: 'rtp', facing: 'south' })
  // the RTP lettering stands on the gate's cap, double-sided (two signs sharing one board)
  b.sign('RTP', [GX, FY + 20, GZ + 1], 'south', { font: 'small', align: 'center', board: 'polished_blackstone', cap: false })
  b.sign('RTP', [GX, FY + 20, GZ - 2], 'north', { font: 'small', align: 'center', board: 'polished_blackstone', cap: false })
  b.npcSpot([CX - 4, FY, 66], 'north', { id: 'market', label: 'Market', role: 'shop', style: 'booth' })
  b.npcSpot([CX + 4, FY, 66], 'north', { id: 'blocks', label: 'Block Shop', role: 'shop', style: 'booth', awning: ['warped', 'birch'], board: 'spruce_planks' })
  b.npcSpot([24, FY + 1, 64], 'north', { id: 'info', label: 'Server Info', role: 'info', style: 'kiosk' })

  // ---------------------------------------------------------------- landscape
  // planters with trees around the spawn rose
  const planter = (x, z, species, seed) => {
    for (let dx = -2; dx <= 2; dx += 1)
      for (let dz = -2; dz <= 2; dz += 1) {
        const rim = Math.abs(dx) === 2 || Math.abs(dz) === 2
        const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2
        b.set(x + dx, FY + 1, z + dz, rim ? 'polished_deepslate' : 'grass_block')
        if (rim) b.set(x + dx, FY + 2, z + dz, corner ? 'polished_deepslate' : 'smooth_quartz_slab[type=bottom]')
        else if (dx || dz) b.set(x + dx, FY + 2, z + dz, kit.hash01(dx, dz, seed) < 0.45 ? 'moss_carpet' : ['poppy', 'azure_bluet', 'cornflower', 'oxeye_daisy', 'allium'][Math.floor(kit.hash01(dz, dx, seed) * 5)])
      }
    for (const [dx, dz] of [[2, 2], [-2, -2]]) b.set(x + dx, FY + 3, z + dz, 'lantern')
    b.tree([x, FY + 2, z], species, { seed, height: 6 + (seed % 2), roots: 0 })
  }
  planter(31, 34, 'cherry', 4)
  planter(53, 34, 'cherry', 5)
  planter(31, 54, 'azalea', 6)
  planter(53, 54, 'azalea', 7)
  // lamp posts along the paths
  for (const [x, z] of [[CX - 4, 20], [CX + 4, 20], [CX - 9, 60], [CX + 9, 60], [22, CZ - 4], [22, CZ + 4], [60, CZ - 4], [60, CZ + 4]]) {
    b.lampPost([x, FY + 1, z], { height: 4, post: 'polished_deepslate_wall', foot: 'polished_deepslate', lantern: 'lantern' })
  }
  // benches facing the rose, flanked by potted plants
  for (const [x, z, f] of [[CX - 10, CZ, 'east'], [CX + 10, CZ, 'west']]) {
    for (let k = -1; k <= 1; k += 1) b.set(x, FY + 1, z + k, `dark_oak_stairs[facing=${kit.opposite(f)}]`)
    b.set(x, FY + 1, z - 2, `dark_oak_trapdoor[facing=north,open=true]`)
    b.set(x, FY + 1, z + 2, `dark_oak_trapdoor[facing=south,open=true]`)
    b.set(x, FY + 1, z - 3, 'potted_azalea_bush')
    b.set(x, FY + 1, z + 3, 'potted_fern')
  }
  // garden beds in the plaza's outer ring, away from the features and the paths: no dead floor
  const keepOut = (x, z) => (z <= 21 && x >= 16 && x <= 68) || (x >= 20 && x <= 34 && z >= 16 && z <= 32) ||
    (x <= 21 && z >= 25 && z <= 63) || (x >= 59 && z >= 22 && z <= 65) || (x <= 23 && z <= 26) ||
    (x >= 31 && x <= 53 && z >= 59 && z <= 73) || (x >= 15 && x <= 33 && z >= 55 && z <= 73) ||
    Math.abs(x - CX) <= 4 || Math.abs(z - CZ) <= 4 ||
    [[31, 34], [53, 34], [31, 54], [53, 54], [32, 44], [52, 44]].some(([px, pz]) => Math.abs(x - px) <= 4 && Math.abs(z - pz) <= 4)
  const bed = (x, z) => {
    const e = edge(x, z)
    return e > 0.55 && e < 0.97 && kit.noise.fbm2(x, z, { scale: 6, seed: 12 }) > -0.1 && !keepOut(x, z)
  }
  const bushes = []
  for (let x = 1; x < S - 1; x += 1)
    for (let z = 1; z < S - 1; z += 1) {
      if (!bed(x, z)) continue
      const rim = !bed(x + 1, z) || !bed(x - 1, z) || !bed(x, z + 1) || !bed(x, z - 1)
      b.set(x, FY, z, rim ? 'moss_block' : 'grass_block')
      if (!rim && kit.hash01(x, 0, z, 31) < 0.05 && bushes.every(([bx, bz]) => Math.abs(bx - x) + Math.abs(bz - z) > 5)) bushes.push([x, z])
    }
  bushes.forEach(([x, z], i) => (i % 3 === 0 ? b.tree([x, FY + 1, z], 'azalea', { seed: i, height: 4, roots: 0 }) : b.bush([x, FY + 1, z], { radius: 1.6 + (i % 2) * 0.5, leaves: i % 2 ? 'flowering_azalea_leaves' : 'azalea_leaves' })))
  // the wooded rim: trees, bushes and flowers on the rising ground, kept off the buildings
  const busy = (x, z) => (x <= 8 && z >= 26 && z <= 62) || (x >= 62 && z >= 24 && z <= 64) || (z <= 13 && x >= 18 && x <= 66) || (z >= 62 && x >= 32 && x <= 52) || (x <= 22 && z <= 24)
  b.forest({
    x0: 3, z0: 3, x1: S - 4, z1: S - 4, ground,
    species: [[5, 'oak'], [3, 'birch'], [2, 'cherry'], [1, 'azalea']],
    density: 0.9, minSpacing: 5, seed: 9,
    avoid: (x, z) => edge(x, z) < 1.15 || busy(x, z),
  })
  b.scatter({ x0: 0, z0: 0, x1: S - 1, z1: S - 1, on: 'grass_block', density: 0.35, paints: [[6, 'short_grass'], [2, 'fern'], [1, 'poppy'], [1, 'dandelion'], [1, 'azure_bluet'], [1, 'cornflower']], clump: 5 })
  // a path out through the RTP gate into the trees
  b.path([[GX, GZ - 4], [GX + 1, 8], [GX - 1, 2]], { width: 3, paint: kit.palette({ gravel: 2, coarse_dirt: 3, dirt_path: 2 }, { scale: 2 }) })

  // ---------------------------------------------------------------- gameplay regions
  b.region('spawn', [0, 0, 0], [S - 1, 37, S - 1], { pvp: 'deny', 'mob-spawning': 'deny', 'fall-damage': 'deny', priority: 10 })
  b.region('afk', [20, FY + 1, 60], [28, FY + 8, 68], { 'mob-spawning': 'deny', priority: 20 })

  return b.finish({ name: 'spawnkit-demo', description: 'Spawn kit demo: plaza with NPC spots, leaderboards, crates, an RTP gate and signs', spawnProof: { min: [0, FY + 1, 0], max: [S - 1, 37, S - 1], inside: (x, z) => edge(x, z) < 1.05 } })
}
