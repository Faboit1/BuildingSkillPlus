// VALLEY SPAWN — v2 site pass (terrain, water, paving plan, massing)
export default function build(api) {
  const { kit } = api
  const N = kit.noise
  const SIZE = [132, 72, 132]
  const b = api.builder(SIZE, { seed: 2207 })
  const [W, , D] = SIZE
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const lerp = (a, c, t) => a + (c - a) * t
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t) }
  const fbm = (x, z, scale, seed, oct = 4) => N.fbm2(x, z, { scale, seed, octaves: oct })
  const hash = (x, y, z, s) => N.hash01(x, y, z, s)

  const P = 22          // plaza floor block level (players stand at P + 1)
  const AX = 66         // main axis x: spawn -> gate
  const SPZ = 51        // spawn z
  const GZ0 = 78, GZ1 = 86  // gate tower inner / outer face

  // ------------------------------------------------------------------ geometry helpers
  const seg = (px, pz, ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az
    const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1)
    return [Math.hypot(px - ax - dx * t, pz - az - dz * t), t]
  }
  const polyDist = (x, z, poly) => {
    let d = Infinity
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) d = Math.min(d, seg(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1])[0])
    return kit.plan.pointInPolygon(x, z, poly) ? -d : d
  }
  // nearest point on a polyline: { d, s } (distance and arc length)
  const polyline = pts => {
    const cum = [0]
    for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    const near = (x, z) => {
      let best = Infinity, s = 0
      for (let i = 1; i < pts.length; i += 1) {
        const [d, t] = seg(x, z, ...pts[i - 1], ...pts[i])
        if (d < best) { best = d; s = cum[i - 1] + t * (cum[i] - cum[i - 1]) }
      }
      return { d: best, s }
    }
    return { pts, near, length: cum[cum.length - 1] }
  }

  // ------------------------------------------------------------------ plan
  // The shelf: the paved floor carved into the valley head. Bays: the pool (NE), the hall (E),
  // the crate shrine (W). The south edge is the wall line with the gate.
  const SHELF = [
    [43, 35], [50, 33], [60, 32], [72, 32], [84, 33], [91, 32],
    [97, 31], [101, 36], [101, 46],
    [99, 49], [102, 52], [102, 62], [99, 66],
    [94, 68], [92, 73], [91, 78], [91, 81],
    [42, 81],
    [41, 76], [38, 71], [36, 64], [36, 54], [38, 47], [41, 43],
  ]
  const shelfD = new Float32Array(W * D)
  const id2 = (x, z) => clamp(Math.round(x), 0, W - 1) * D + clamp(Math.round(z), 0, D - 1)
  for (let x = 0; x < W; x += 1) for (let z = 0; z < D; z += 1) shelfD[id2(x, z)] = polyDist(x, z, SHELF)
  const inShelf = (x, z) => shelfD[id2(x, z)] <= 0
  // the trail into the valley (west bank) and the stream (east of it), ending in a tarn
  const TRAIL = polyline([[66, 87], [66, 92], [64, 99], [63, 106], [64, 113], [61, 121], [57, 131]])
  const STREAM = polyline([[83, 84], [82, 89], [79, 95], [76, 101], [76, 107], [79, 113], [80, 118]])
  const TARN = { x: 81, z: 122, rx: 9, rz: 5.5 }
  const tarnD = (x, z) => Math.hypot((x - TARN.x) / TARN.rx, (z - TARN.z) / TARN.rz) * (1 + 0.12 * fbm(x, z, 6, 61, 2))
  // stepped water levels: a chain of rock-dammed pools (contained: no flowing water)
  const WEIRS = [5.5, 12.5, 19.5, 26.5, 32.5]
  const L0 = P - 6
  const levelAt = s => L0 - 2 * WEIRS.filter(w => s > w).length
  const TARN_L = L0 - 2 * WEIRS.length - 0
  const streamW = s => 1.6 + 0.6 * smooth(s / 20) + 0.5 * fbm(s, 0, 6, 62, 2)

  // ------------------------------------------------------------------ terrain heightfield
  const xa = z => AX + (z > 80 ? 9 * Math.sin((z - 80) / 22) : 0)       // valley axis bends east
  const bump = (x, z, cx, cz, r, h) => h * Math.max(0, 1 - ((x - cx) ** 2 + (z - cz) ** 2) / (r * r)) ** 1.6
  // The mountain: a valley head. High north, east and west; open to the south, where the floor
  // falls away between wooded slopes. Peaks of different height break the skyline.
  const mountain = (x, z) => {
    const u = Math.abs(x - xa(z))
    const south = smooth((z - 78) / 14)
    const g = z < 80 ? P - 3 + (80 - z) * 0.4 : P - 4 - (z - 80) * 0.3
    const a = lerp(0.62, 0.46, south)
    const w = lerp(15, 13, south)
    let h = g + a * Math.max(0, u - w) * (1 + 0.3 * fbm(x, z, 30, 9, 2))
    // a crag behind the hall of fame carries the VALLEY tablet; peaks NW and NE, lower hills
    h += bump(x, z, 70, 24, 19, 11) + bump(x, z, 24, 18, 30, 9) + bump(x, z, 108, 22, 26, 7) + bump(x, z, 124, 76, 24, 5) + bump(x, z, 6, 98, 24, 5)
    h += 2.2 * fbm(x, z, 28, 3) + 1.2 * fbm(x, z, 9, 6, 2)
    h += 6 * Math.max(0, N.ridged2(x, z, { scale: 36, seed: 5 }) - 0.6) * (1 - south * 0.6)
    // the diorama edge rolls off on the three high sides, so the cut faces stay modest
    const edge = Math.min(x, W - 1 - x, z)
    h -= 17 * smooth((27 - edge) / 27) ** 1.3
    return Math.min(h, P + 32 + 2 * fbm(x, z, 18, 4))
  }
  // Cliff profile out from the shelf edge: scree bed, then two tiers whose heights and ledge
  // widths wander along the rim; gullies (ridged-noise lines) notch the face.
  const ramp = (d, x, z) => {
    const t1 = 6 + 7 * (fbm(x, z, 13, 41, 2) + 0.5)
    const t2 = t1 + 6 + 9 * (fbm(x, z, 17, 42, 2) + 0.5)
    const l1 = Math.max(0, -0.4 + 2.8 * (fbm(x, z, 9, 43, 2) + 0.5))
    const l2 = Math.max(0, -0.3 + 2.8 * (fbm(x, z, 10, 44, 2) + 0.5))
    const a = 2, b1 = a + t1 / 4.5, c1 = b1 + l1, b2 = c1 + (t2 - t1) / 4.2, c2 = b2 + l2
    if (d < a) return d * 0.8
    if (d < b1) return lerp(1.6, t1, (d - a) / (b1 - a))
    if (d < c1) return t1 + (d - b1) * 0.6
    if (d < b2) return lerp(t1 + l1 * 0.6, t2, (d - c1) / (b2 - c1))
    if (d < c2) return t2 + (d - b2) * 0.6
    return t2 + l2 * 0.6 + (d - c2) * 2.6
  }
  const gully = (x, z) => 3.4 * smooth((N.ridged2(x, z, { scale: 10, seed: 71 }) - 0.72) / 0.2)
  const trailGrade = s => Math.max(P - 16, P - 0.42 * Math.max(0, s - 2))
  const Hf = new Float32Array(W * D)
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      const sd = shelfD[id2(x, z)] + 1.0 * fbm(x, z, 7, 11, 2)
      const m = mountain(x, z)
      let h
      if (sd <= 0) h = P
      else if (m >= P) h = Math.min(m, P + ramp(Math.max(0.3, sd - gully(x, z)), x, z))
      else h = Math.max(m, P - 2.4 * sd)
      // the trail: graded into the slope (an embankment just outside the gate)
      const t = TRAIL.near(x, z)
      if (z > 84 && t.d < 6.5) h = lerp(trailGrade(t.s), h, smooth((t.d - 2.2) / 4.3))
      Hf[id2(x, z)] = h
    }
  const H = new Int16Array(W * D)
  for (let i = 0; i < W * D; i += 1) H[i] = Math.round(Hf[i])
  // stream and tarn: banks at least one above the pool they hold, meadow-low around them
  const water = new Map() // "x,z" -> { top, bed }
  for (let x = 0; x < W; x += 1)
    for (let z = 76; z < D; z += 1) {
      const st = STREAM.near(x, z)
      const td = tarnD(x, z)
      const i = id2(x, z)
      if (td < 1) {
        water.set(`${x},${z}`, { top: TARN_L, bed: TARN_L - 1 - Math.round(2.5 * (1 - td * td)) })
        H[i] = TARN_L
        continue
      }
      if (td < 1.55) { H[i] = clamp(H[i], TARN_L + 1, TARN_L + 1 + Math.round((td - 1) * 6)); continue }
      if (z < 82 || st.d > streamW(st.s) + 3.5) continue
      const L = levelAt(st.s)
      const wd = streamW(st.s)
      const weir = WEIRS.some(wv => Math.abs(st.s - wv) < 0.75)
      if (st.d < wd && z >= 83) {
        if (weir) { H[i] = levelAt(st.s - 1.5); water.delete(`${x},${z}`); continue }
        water.set(`${x},${z}`, { top: L, bed: L - 1 - (st.d < wd * 0.5 ? 1 : 0) })
        H[i] = L
      } else {
        const need = levelAt(st.s - 2.5) + 1
        H[i] = clamp(H[i], need, need + 1 + Math.round(Math.max(0, st.d - wd) * 1.2))
      }
    }
  const height = (x, z) => H[id2(x, z)]
  const slope = (x, z) => Math.max(...D4.map(([dx, dz]) => Math.abs(height(x + dx, z + dz) - height(x, z))))

  // ------------------------------------------------------------------ terrain paint
  // Strata dip to the east and warp; darker and heavier toward the base; one thin calcite band.
  const pal = (o, seed, scale = 3) => kit.palette(o, { seed, scale })
  const ROCK = {
    base: pal({ tuff: 4, andesite: 3, cobblestone: 1, cobbled_deepslate: 2 }, 31),
    a: pal({ andesite: 6, stone: 2, cobblestone: 1 }, 32),
    t: pal({ tuff: 5, andesite: 2, stone: 1 }, 33),
    s: pal({ stone: 7, andesite: 2, cobblestone: 1 }, 34),
  }
  const strata = (x, y, z) => {
    const t = y + 0.34 * x - 0.22 * z + 4.5 * fbm(x, z, 20, 21, 3) + 1.6 * N.fbm3(x, y, z, { scale: 7, seed: 22, octaves: 2 })
    const r = ((Math.floor(t / 2.7) % 9) + 9) % 9
    if (y < P - 1) return ROCK.base
    if (r === 4) return N.fbm3(x, y, z, { scale: 9, seed: 23, octaves: 2 }) > 0.15 ? 'calcite' : ROCK.s
    if (r === 1 || r === 6) return ROCK.a
    if (r === 3 || r === 8) return ROCK.t
    return ROCK.s
  }
  const meadow = (x, z) => {
    const n = fbm(x, z, 11, 81, 2)
    return n > 0.42 ? 'moss_block' : n < -0.45 ? 'coarse_dirt' : 'grass_block'
  }
  const ledge = pal({ grass_block: 6, moss_block: 3, coarse_dirt: 1 }, 4, 2)
  const scree = pal({ gravel: 3, andesite: 2, cobblestone: 2, coarse_dirt: 2, tuff: 1 }, 5, 2)
  const bank = pal({ gravel: 3, coarse_dirt: 2, mud: 1, moss_block: 1 }, 6, 2)
  const bedP = pal({ gravel: 3, clay: 2, sand: 1 }, 7, 2)
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      const h = height(x, z)
      const s = slope(x, z)
      const sd = shelfD[id2(x, z)]
      const w = water.get(`${x},${z}`)
      const nearWater = !w && D4.some(([dx, dz]) => water.has(`${x + dx},${z + dz}`))
      const top = w ? w.bed : h
      for (let y = 0; y <= top; y += 1) {
        const depth = top - y
        let p
        if (depth === 0) {
          if (w) p = bedP
          else if (sd <= 0) p = 'dirt'
          else if (s >= 3) p = strata(x, y, z)
          else if (nearWater) p = bank
          else if (sd < 3 && h <= P + 3 && z < 82) p = scree
          else if (h > P + 4 && sd < 18 && z < 84) p = s >= 2 ? strata(x, y, z) : ledge
          else if (s === 2) p = hash(x, y, z, 7) < 0.5 ? strata(x, y, z) : 'coarse_dirt'
          else p = meadow(x, z)
        } else if (depth < 3 && s < 3 && sd > 0) p = 'dirt'
        else p = strata(x, y, z)
        b.set(x, y, z, p)
      }
      if (w) for (let y = w.bed + 1; y <= w.top; y += 1) b.set(x, y, z, 'water')
    }
  // Lips: rock bands that stand out of tall faces (overhang shadows), where the face drops 5+.
  for (let x = 1; x < W - 1; x += 1)
    for (let z = 1; z < D - 1; z += 1) {
      const h = height(x, z)
      if (inShelf(x, z) || water.has(`${x},${z}`)) continue
      for (const [dx, dz] of D4) {
        const hn = height(x + dx, z + dz)
        if (h - hn < 6) continue
        for (let y = hn + 4; y < h - 1; y += 1) {
          const band = N.fbm3(x, y, z, { scale: 6, seed: 91, octaves: 2 })
          if (band > 0.28 && !b.get(x + dx, y, z + dz)) b.set(x + dx, y, z + dz, strata(x, y, z))
        }
      }
    }


  // ------------------------------------------------------------------ materials and helpers
  const st = (m, f, half = 'bottom') => `${m}_stairs[facing=${f},half=${half}]`
  const sl = (m, t = 'bottom') => `${m}_slab[type=${t}]`
  const { opposite: opp, cw, ccw } = kit
  // local frame for a set: u to the player's right, d toward the player, h up
  const LF = (pos, facing) => {
    const F = kit.DIR[facing], R = kit.DIR[ccw(facing)]
    const [px, py, pz] = pos
    return { facing, back: opp(facing), right: ccw(facing), left: cw(facing), at: (u, d, h) => [px + R[0] * u + F[0] * d, py + h, pz + R[2] * u + F[2] * d] }
  }
  // masonry: wet, mossy rubble at the foot -> stone bricks -> cleaner, lighter courses up high
  const MASON = kit.gradient([
    pal({ mossy_cobblestone: 3, cobblestone: 2, mossy_stone_bricks: 3, tuff: 1 }, 111),
    pal({ mossy_stone_bricks: 2, stone_bricks: 6, cracked_stone_bricks: 2, andesite: 1 }, 112, 4),
    pal({ stone_bricks: 7, cracked_stone_bricks: 1, andesite: 2 }, 113, 4),
    pal({ stone_bricks: 6, andesite: 1, polished_andesite: 2 }, 114, 4),
  ], { t: (x, y, z) => (y - P + 3) / 18, dither: 0.8 })
  const DRESSED = pal({ stone_bricks: 5, polished_andesite: 3 }, 115, 2)
  const PLASTER = pal({ calcite: 6, white_terracotta: 1, diorite: 1 }, 116, 2)
  const TRIM = 'polished_andesite'
  const SB = 'stone_brick'
  const banner = (x, y, z, f, c = 'red') => b.set(x, y, z, `${c}_wall_banner[facing=${f}]`)
  const lantern = (x, y, z) => b.set(x, y, z, 'lantern[hanging=false]')
  // three lamp designs, used in pairs and clusters (never one post on a grid)
  const lampPost = (x, y, z) => {          // A: stone foot, spruce post, lantern on top
    b.set(x, y, z, 'stone_brick_wall'); b.set(x, y + 1, z, 'spruce_fence'); b.set(x, y + 2, z, 'spruce_fence'); lantern(x, y + 3, z)
  }
  const armLamp = (x, y, z, arm) => {      // B: log post with a bracket and a hanging lantern
    for (let k = 0; k < 4; k += 1) b.set(x, y + k, z, 'stripped_spruce_log[axis=y]')
    const [dx, , dz] = kit.DIR[arm]
    b.set(x + dx, y + 3, z + dz, 'spruce_fence')
    b.set(x + dx, y + 2, z + dz, 'lantern[hanging=true]')
    b.set(x, y + 4, z, sl('spruce'))
  }
  const bench = (x, y, z, facing, len = 3) => { // seat stairs (back away from the view) + trapdoor arms
    const along = kit.DIR[ccw(facing)]
    for (let k = 0; k < len; k += 1) b.set(x + along[0] * k, y, z + along[2] * k, st('spruce', opp(facing)))
    b.set(x - along[0], y, z - along[2], `spruce_trapdoor[facing=${cw(facing)},open=true,half=bottom]`)
    b.set(x + along[0] * len, y, z + along[2] * len, `spruce_trapdoor[facing=${ccw(facing)},open=true,half=bottom]`)
  }
  const POTS = ['potted_fern', 'potted_red_tulip', 'potted_azure_bluet', 'potted_spruce_sapling', 'potted_oxeye_daisy', 'potted_dandelion']

  // ------------------------------------------------------------------ plaza floors
  // Paving hierarchy (say it in one sentence): a stone-brick field (>= 70%), a smooth avenue
  // edged in polished andesite from the spawn to the gate, a compass rose where the cross walk
  // meets it, and darker cobble wear only along the desire lines to each NPC.
  const TERR_Z = x => 56 + Math.round(1.2 * Math.sin((x - 50) / 6))   // north terrace edge
  const terrace = (x, z) => z <= TERR_Z(x) && x >= 45 && x <= 91
  const STAGE = (x, z) => x <= 52 && z >= 44 && z <= 71                // crate stage (P + 1)
  const ROSE = [66, 66]
  const field = pal({ stone_bricks: 14, andesite: 2, cracked_stone_bricks: 2, mossy_stone_bricks: 1 }, 101, 4)
  const worn = pal({ cobblestone: 3, packed_mud: 2, andesite: 2, gravel: 1, stone_bricks: 2 }, 102, 2)
  const warmWorn = pal({ packed_mud: 3, mud_bricks: 2, coarse_dirt: 1, cobblestone: 1 }, 107, 2)
  const ROUTES = [
    [[66, 56], [66, 79], 1.6],            // avenue: spawn -> gate (worn centre line)
    [[63, 61], [54, 58], 1.3],            // crates
    [[69, 61], [85, 57], 1.3],            // auction hall
    [[70, 64], [79, 67], 1.1],            // store kiosk
    [[69, 70], [79, 72], 1.1],            // quests
    [[68, 73], [73, 75], 1.0],            // rtp
    [[63, 69], [55, 71], 1.1],            // shop
    [[62, 67], [48, 71], 1.1],            // kits
  ]
  const wear = (x, z) => {
    let best = 0
    for (const [a, c, w] of ROUTES) best = Math.max(best, w - seg(x, z, ...a, ...c)[0])
    return best
  }
  const plazaPaint = (x, z) => {
    const r = Math.hypot(x - ROSE[0], z - ROSE[1])
    if (r < 1.5) return 'chiseled_stone_bricks'
    if (r < 4.5) {
      const a = Math.atan2(z - ROSE[1], x - ROSE[0])
      const star = Math.abs(Math.cos(4 * a)) * (4.5 - r) > 1.4 || Math.abs(x - ROSE[0]) < 0.6 || Math.abs(z - ROSE[1]) < 0.6
      return star ? 'polished_andesite' : 'stone_bricks'
    }
    if (r < 5.5) return 'polished_deepslate'
    if (z > 57 && z < 79 && (x === 62 || x === 70)) return 'polished_andesite'   // avenue edges
    if (z > 57 && x > 62 && x < 70) {                                              // avenue field
      const wv = wear(x, z)
      return wv > 0 && N.coherent01(x, 0, z, { scale: 3, seed: 104 }) < 0.25 + wv * 0.25 ? warmWorn : pal({ mud_bricks: 8, packed_mud: 1 }, 105, 3)
    }
    const wv = wear(x, z)
    if (wv > 0 && N.coherent01(x, 0, z, { scale: 3, seed: 103 }) < 0.25 + wv * 0.35) return worn
    return field
  }
  for (let x = 0; x < W; x += 1)
    for (let z = 0; z < D; z += 1) {
      if (!inShelf(x, z)) continue
      if (terrace(x, z) || STAGE(x, z)) {
        b.set(x, P, z, 'stone_bricks')
        const wv = wear(x, z)
        b.set(x, P + 1, z, wv > 0 && N.coherent01(x, 1, z, { scale: 3, seed: 106 }) < 0.2 + wv * 0.3 ? worn : field)
      } else b.set(x, P, z, plazaPaint(x, z))
    }
  // the terrace and the crate stage step down to the plaza with a stair nosing
  for (let x = 45; x <= 91; x += 1) {
    const z = TERR_Z(x) + 1
    if (inShelf(x, z) && !STAGE(x, z) && !b.get(x, P + 1, z)) b.set(x, P + 1, z, st(SB, 'north'))
  }
  for (let z = 57; z <= 71; z += 1) if (!b.get(53, P + 1, z)) b.set(53, P + 1, z, st(SB, 'west'))
  for (let x = 38; x <= 52; x += 1) if (inShelf(x, 72) && !b.get(x, P + 1, 72)) b.set(x, P + 1, 72, st(SB, 'north'))

  // ------------------------------------------------------------------ spawn dais
  // An octagonal dais 1 above the terrace (2 above the plaza): players land on the chiseled
  // centre facing south, down the avenue to the gate tower and out over the valley.
  for (let dx = -3; dx <= 3; dx += 1)
    for (let dz = -3; dz <= 3; dz += 1) {
      const m = Math.abs(dx) + Math.abs(dz)
      if (m > 5) continue
      const x = AX + dx, z = SPZ + dz
      b.set(x, P + 1, z, 'stone_bricks')
      const rim = Math.max(Math.abs(dx), Math.abs(dz)) === 3 || m === 5
      if (rim) {
        const f = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : (dz > 0 ? 'north' : 'south')
        b.set(x, P + 2, z, st(SB, f))
      } else {
        const r = Math.max(Math.abs(dx), Math.abs(dz))
        b.set(x, P + 2, z, r === 0 ? 'chiseled_stone_bricks' : r === 1 ? 'polished_andesite' : (dx === 0 || dz === 0) ? 'polished_andesite' : 'stone_bricks')
      }
    }
  b.spawnPoint([AX, P + 2, SPZ], 'south', { label: 'Valley spawn' })
  // two lamps behind the dais (never in the forward view)
  lampPost(61, P + 2, 48)
  lampPost(71, P + 2, 49)

  // ------------------------------------------------------------------ the gate (the hero)
  // A square gate tower with a jettied timber storey and a hipped slate roof, flanked by two
  // round towers with cones. 27-35 blocks from the spawn it fills ~40% of the first view's
  // height, with sky above it; the low crenellated walls either side let the valley show.
  const GX0 = 61, GX1 = 71
  const foundation = (x, z, top = P) => { for (let y = Math.min(height(x, z), top); y <= top; y += 1) b.set(x, y, z, MASON) }
  for (let x = GX0; x <= GX1; x += 1) for (let z = GZ0; z <= GZ1; z += 1) foundation(x, z)
  b.box([GX0, P + 1, GZ0], [GX1, P + 10, GZ1], MASON)
  for (const [x, z] of [[GX0, GZ0], [GX1, GZ0], [GX0, GZ1], [GX1, GZ1]])
    for (let y = P + 1; y <= P + 10; y += 1) b.set(x, y, z, (y - P) % 2 ? 'polished_andesite' : 'stone_bricks')   // quoins
  // battered plinth and a string course, both faces
  for (const [z, f] of [[GZ0 - 1, 'south'], [GZ1 + 1, 'north']])
    for (let x = GX0 - 1; x <= GX1 + 1; x += 1) {
      if (x >= 63 && x <= 69) continue
      b.set(x, P + 1, z, st(SB, f))
      b.set(x, P + 7, z, st(SB, f, 'top'))
    }
  for (const [x, f] of [[GX0 - 1, 'east'], [GX1 + 1, 'west']]) for (let z = GZ0; z <= GZ1; z += 1) b.set(x, P + 7, z, st(SB, f, 'top'))
  // the passage: 5 wide, rounded head, a half-raised portcullis, a jamb-and-keystone surround
  b.box([64, P + 1, GZ0], [68, P + 6, GZ1], 'air')
  for (let z = GZ0; z <= GZ1; z += 1) {
    b.set(64, P + 6, z, st(SB, 'west', 'top'))
    b.set(68, P + 6, z, st(SB, 'east', 'top'))
    for (let x = 64; x <= 68; x += 1) b.set(x, P, z, x === 66 ? 'polished_andesite' : pal({ cobblestone: 3, stone_bricks: 2, gravel: 1 }, 121, 2))
  }
  for (let x = 64; x <= 68; x += 1) { b.set(x, P + 6, GZ0 + 2, 'iron_bars'); if (x > 64 && x < 68) b.set(x, P + 5, GZ0 + 2, 'iron_bars') }
  for (const [z, f] of [[GZ0 - 1, 'north'], [GZ1 + 1, 'south']]) {
    for (let y = P + 1; y <= P + 7; y += 1) { b.set(63, y, z, TRIM); b.set(69, y, z, TRIM) }
    for (let x = 64; x <= 68; x += 1) b.set(x, P + 7, z, x === 66 ? 'chiseled_stone_bricks' : TRIM)
    b.set(64, P + 6, z, st(TRIM.replace('polished_', 'polished_'), 'west', 'top'))
    b.set(68, P + 6, z, st(TRIM, 'east', 'top'))
    for (let x = 62; x <= 70; x += 1) b.set(x, P + 8, z, st(SB, opp(f), 'top'))           // hood mould
    b.set(62, P + 7, z, st(SB, 'east', 'top')); b.set(70, P + 7, z, st(SB, 'west', 'top'))
  }
  // banners either side of the arch, lanterns on brackets
  banner(61, P + 5, GZ0 - 1, 'north'); banner(71, P + 5, GZ0 - 1, 'north')
  for (const x of [62, 70]) { b.set(x, P + 4, GZ0 - 2, 'lantern[hanging=true]'); b.set(x, P + 5, GZ0 - 2, st(SB, 'south', 'top')) }
  // upper room behind two barred windows, lit
  b.box([62, P + 8, GZ0 + 1], [70, P + 10, GZ1 - 1], 'air')
  b.box([62, P + 7, GZ0 + 1], [70, P + 7, GZ1 - 1], 'spruce_planks')
  for (const x of [63, 69]) for (const z of [GZ0, GZ1]) { b.set(x, P + 9, z, 'iron_bars'); b.set(x, P + 10, z, 'iron_bars') }
  lantern(63, P + 8, GZ0 + 1); lantern(69, P + 8, GZ1 - 1)
  // jettied timber storey (the warm secondary colour on the hero), corbelled out 1 all round
  const TX0 = GX0 - 1, TX1 = GX1 + 1, TZ0 = GZ0 - 1, TZ1 = GZ1 + 1
  for (let x = TX0; x <= TX1; x += 1) { b.set(x, P + 10, TZ0, st(SB, 'south', 'top')); b.set(x, P + 10, TZ1, st(SB, 'north', 'top')) }
  for (let z = TZ0 + 1; z < TZ1; z += 1) { b.set(TX0, P + 10, z, st(SB, 'east', 'top')); b.set(TX1, P + 10, z, st(SB, 'west', 'top')) }
  const ring = (x, z) => x === TX0 || x === TX1 || z === TZ0 || z === TZ1
  for (let x = TX0; x <= TX1; x += 1)
    for (let z = TZ0; z <= TZ1; z += 1) {
      if (!ring(x, z)) { b.set(x, P + 10, z, 'spruce_planks'); continue }
      const corner = (x === TX0 || x === TX1) && (z === TZ0 || z === TZ1)
      const u = z === TZ0 || z === TZ1 ? x - TX0 : z - TZ0
      const post = corner || u % 3 === 0
      for (let y = P + 11; y <= P + 14; y += 1) {
        const beam = y === P + 11 || y === P + 14
        b.set(x, y, z, post ? 'stripped_dark_oak_log[axis=y]' : beam ? `dark_oak_log[axis=${z === TZ0 || z === TZ1 ? 'x' : 'z'}]` : PLASTER)
      }
    }
  for (const [x0, z] of [[61, TZ0], [64, TZ0], [67, TZ0], [70, TZ0], [61, TZ1], [70, TZ1]])
    for (let x = x0; x <= x0 + 1; x += 1) { b.set(x, P + 12, z, 'glass_pane'); b.set(x, P + 13, z, 'glass_pane') }
  b.box([TX0 + 1, P + 11, TZ0 + 1], [TX1 - 1, P + 14, TZ1 - 1], 'air')
  lantern(62, P + 11, TZ0 + 1); lantern(70, P + 11, TZ0 + 1); lantern(66, P + 11, TZ1 - 1)
  banner(66, P + 12, TZ0 - 1, 'north')
  b.roof({ x0: TX0, z0: TZ0, x1: TX1, z1: TZ1, y: P + 15, type: 'hip', material: 'deepslate_tile', pitch: 1, overhang: 1, eaveTrim: true })
  b.set(66, P + 21, 82, 'spruce_fence'); b.set(66, P + 22, 82, 'spruce_fence'); b.set(66, P + 23, 82, 'red_banner[rotation=8]')

  // flanking round towers: battered, corbelled crown, cone roof; the east one a little taller
  const roundTower = (cx, cz, top, flag = false) => {
    const R = 3.6
    for (let x = Math.floor(cx - 5); x <= Math.ceil(cx + 5); x += 1)
      for (let z = Math.floor(cz - 5); z <= Math.ceil(cz + 5); z += 1) {
        const d = Math.hypot(x - cx, z - cz)
        if (d <= R) {
          foundation(x, z)
          for (let y = P + 1; y <= top; y += 1) b.set(x, y, z, MASON)
        } else if (d <= R + 1) {
          const f = kit.facingFrom(Math.round(cx - x), Math.round(cz - z))
          if (!b.get(x, P + 1, z) && inShelf(x, z)) b.set(x, P + 1, z, st(SB, f))
          b.set(x, top, z, st(SB, f, 'top'))                                   // corbel ring
          b.set(x, top + 1, z, d <= R + 0.6 ? DRESSED : st(SB, f))
        }
      }
    for (const [a, y] of [[-Math.PI / 2 - 0.6, P + 4], [-Math.PI / 2 + 0.7, P + 7]]) {      // slits facing the plaza
      const x = Math.round(cx + Math.cos(a) * 3.4), z = Math.round(cz + Math.sin(a) * 3.4)
      b.set(x, y, z, 'air'); b.set(x, y + 1, z, 'air')
    }
    b.bellRoof([cx, top + 2, cz], 4.7, 8, { material: 'deepslate_tile', p: 1.5, lip: 0.6, wallR: 4.1, finial: flag ? ['spruce_fence', 'spruce_fence', 'red_banner[rotation=4]'] : ['lightning_rod[facing=up]'] })
  }
  roundTower(55, 82, P + 10)
  roundTower(77, 82, P + 11, true)
  for (const xs of [[59, 60], [72, 73]]) for (const x of xs) for (let z = 79; z <= 84; z += 1) {   // short curtains to the gate tower
    foundation(x, z)
    for (let y = P + 1; y <= P + 8; y += 1) b.set(x, y, z, MASON)
    b.set(x, P + 9, z, z === 79 || z === 84 ? MASON : sl(SB))
  }

  // curtain walls to the cliffs: a waist-high crenellated parapet seen from the plaza, a
  // battered retaining wall seen from the valley
  const wallSpan = (xa0, xa1) => {
    for (let x = xa0; x <= xa1; x += 1) {
      for (let z = 79; z <= 82; z += 1) {
        if (b.get(x, P + 3, z) && z > 79) continue
        foundation(x, z)
        b.set(x, P + 1, z, z === 79 ? DRESSED : MASON)
      }
      if (x % 3 !== 1) b.set(x, P + 2, 82, MASON)                            // merlons, 2 on 1 off
      b.set(x, P + 2, 79, sl(SB))
      const h = height(x, 83)
      if (h < P - 1) b.set(x, h + 1, 83, st(SB, 'north'))                    // batter at the foot
    }
  }
  wallSpan(42, 51)
  wallSpan(81, 91)
  // the culvert: the pool's overflow runs under the plaza and leaves through an arch in the
  // east wall, where the stream starts (water stays level: contained sources only)
  for (let x = 82; x <= 84; x += 1)
    for (let z = 79; z <= 83; z += 1) {
      b.set(x, L0 - 1, z, 'gravel')
      b.set(x, L0, z, z === 79 ? 'mossy_stone_bricks' : 'water')
      for (let y = L0 + 1; y <= L0 + 2; y += 1) b.set(x, y, z, z === 79 ? 'mossy_stone_bricks' : 'air')
    }
  for (let z = 80; z <= 82; z += 1) { b.set(82, L0 + 2, z, st('mossy_stone_brick', 'west', 'top')); b.set(84, L0 + 2, z, st('mossy_stone_brick', 'east', 'top')) }
  for (let x = 81; x <= 85; x += 1) for (let y = L0; y <= L0 + 3; y += 1) if (x === 81 || x === 85 || y === L0 + 3) b.set(x, y, 82, 'mossy_stone_bricks')
  b.set(83, L0 + 3, 83, 'chiseled_stone_bricks')
  // landing outside the gate, then the trail down the valley
  for (let x = 62; x <= 70; x += 1) for (let z = GZ1 + 1; z <= GZ1 + 3; z += 1) { foundation(x, z); b.set(x, P, z, x === 62 || x === 70 ? DRESSED : pal({ cobblestone: 3, stone_bricks: 2, gravel: 1 }, 121, 2)) }
  b.path(TRAIL.pts.slice(1), { width: 3, paint: pal({ dirt_path: 5, coarse_dirt: 2, gravel: 1 }, 122, 2), jitter: 0.5 })

  // ------------------------------------------------------------------ hall of fame (north)
  // The cliff behind the terrace is built up into a crag; the board wall stands against it and
  // the VALLEY tablet is set into the rock above it: quartz letters with stair bevels on a dark
  // board, a masonry frame and cornice, lit from lanterns on its sill.
  for (let x = 42; x <= 92; x += 1)
    for (let z = 22; z <= 36; z += 1) {
      const face = 34 + Math.round(1.4 * fbm(x, z, 5, 131, 2)) + (Math.abs(x - 67) > 21 ? -1 : 0)
      if (z > face) continue
      const top = P + 33 + Math.round(3 * fbm(x, z, 9, 132, 2)) - Math.round(Math.max(0, Math.abs(x - 67) - 18) * 0.9) - Math.max(0, z - 31)
      for (let y = P + 1; y <= top; y += 1) if (!b.get(x, y, z)) b.set(x, y, z, strata(x, y, z))
      if (top > height(x, z) && !b.get(x, top + 1, z)) b.set(x, top, z, ledge)
    }
  b.leaderboards([67, P + 1, 38], 'south', {
    count: 4, width: 5, height: 6, gap: 0, podium: true,
    primary: 'stone_bricks', trim: TRIM, base: 'mossy_stone_bricks', field: DRESSED, accent: 'red_terracotta',
    footlight: 'ochre_froglight',
    ids: ['money', 'kills', 'playtime', 'blocks'], labels: ['Richest', 'Top Kills', 'Playtime', 'Blocks Mined'],
  })
  const tablet = b.sign('VALLEY', [66, P + 28, 35], 'south', { font: 'medium', align: 'center', block: 'quartz_block', board: 'polished_blackstone', frame: 'polished_deepslate', pad: 1 })
  // a masonry surround: piers either side of the frame, a corbel shelf under the sill
  for (const x of [tablet.min[0] - 1, tablet.max[0] + 1])
    for (let y = P + 20; y <= P + 31; y += 1) { b.set(x, y, 35, y === P + 31 ? st(SB, 'south', 'top') : DRESSED); b.set(x, y, 34, DRESSED) }
  for (let x = tablet.min[0] - 1; x <= tablet.max[0] + 1; x += 1) { b.set(x, P + 21, 35, DRESSED); b.set(x, P + 21, 36, st(SB, 'north', 'top')) }
  for (let x = tablet.min[0] + 2; x <= tablet.max[0] - 2; x += 6) lantern(x, P + 22, 36)

  // ------------------------------------------------------------------ waterfall and pool (NE)
  // The stream falls from a notch in the crag into a pool cut in the plaza floor. Water: the
  // pool and the channel above are sources held on every side; only the falling column (in a
  // rock chute, open at the front) is flowing water, and falling water never spreads sideways.
  const POOL = { x: 96, z: 38.5, rx: 4.6, rz: 6.2 }
  const poolD = (x, z) => Math.hypot((x - POOL.x) / POOL.rx, (z - POOL.z) / POOL.rz) * (1 + 0.1 * fbm(x, z, 4, 141, 2))
  const FX = [95, 96], FZ = [30, 31]
  for (let x = 89; x <= 103; x += 1)
    for (let z = 29; z <= 47; z += 1) {
      const pd = poolD(x, z)
      const chute = FX.includes(x) && FZ.includes(z)
      if (pd < 1 || chute) {
        const bed = P - 2 - (pd < 0.6 ? 1 : 0)
        b.set(x, bed - 1, z, 'stone'); b.set(x, bed, z, pal({ gravel: 2, clay: 1, moss_block: 1 }, 142, 2))
        for (let y = bed + 1; y <= P - 1; y += 1) b.set(x, y, z, 'water')
        b.set(x, P, z, 'air')
      } else if (pd < 1.35 && inShelf(x, z)) {
        b.set(x, P - 1, z, 'stone'); b.set(x, P - 2, z, 'stone')
        b.set(x, P, z, pal({ mossy_stone_bricks: 3, stone_bricks: 2, mossy_cobblestone: 1 }, 143, 2))   // the rim
        if (fbm(x, z, 3, 144, 2) > 0.05 && !b.get(x, P + 1, z)) b.set(x, P + 1, z, fbm(x, z, 2, 145, 2) > 0.2 ? sl('mossy_stone_brick') : st('mossy_stone_brick', kit.facingFrom(Math.round(POOL.x - x), Math.round(POOL.z - z))))
      }
    }
  // the chute and the channel on the crag top
  const lipY = Math.min(...[22, 24, 26, 28].map(z => height(95, z)), P + 20)
  for (const x of [94, 97]) for (let z = 26; z <= 31; z += 1) for (let y = P; y <= lipY; y += 1) b.set(x, y, z, strata(x, y, z))
  for (const x of FX) {
    for (let y = P; y < lipY; y += 1) b.set(x, y, 29, strata(x, y, 29))                               // chute back
    for (const z of FZ) for (let y = P; y <= lipY; y += 1) b.set(x, y, z, 'water[level=8]')
    for (const z of FZ) for (let y = lipY + 1; y <= lipY + 4; y += 1) b.set(x, y, z, 'air')
    for (let z = 21; z <= 29; z += 1) {                                                                  // channel
      for (let y = lipY + 1; y <= lipY + 4; y += 1) b.set(x, y, z, 'air')
      b.set(x, lipY - 1, z, 'gravel'); b.set(x, lipY, z, z === 21 ? 'mossy_cobblestone' : 'water')
    }
  }
  for (const x of [94, 97]) for (let z = 21; z <= 31; z += 1) { b.set(x, lipY, z, 'mossy_cobblestone'); b.set(x, lipY - 1, z, 'stone') }
  b.overgrow([90, P, 22], [102, lipY + 2, 34], { amount: 0.7, maxLength: 5, seed: 5, only: ['stone', 'andesite', 'tuff', 'cobblestone', 'mossy_cobblestone', 'calcite'] })

  // ------------------------------------------------------------------ crate shrine (west)
  // Four crate stations on a raised stage, backed by a masonry wall cut into the cliff foot:
  // pilasters between the stations carry lanterns, the CRATES board sits over them, open sky
  // above every crate. The plaza in front holds the key-all crowd.
  for (let z = 43; z <= 73; z += 1)
    for (let x = 34; x <= 40; x += 1)
      for (let y = P + 1; y <= P + 21; y += 1) {
        if (x === 40) b.set(x, y, z, y >= P + 20 ? st(SB, 'east', 'top') : MASON)
        else if (!b.get(x, y, z)) b.set(x, y, z, x >= 38 ? MASON : strata(x, y, z))
      }
  for (const z of [46, 52, 58, 64, 70]) {
    b.set(41, P + 2, z, DRESSED); b.set(42, P + 2, z, st(SB, 'west'))
    for (let y = P + 3; y <= P + 9; y += 1) b.set(41, y, z, (y - P) % 3 === 0 ? TRIM : DRESSED)
    b.set(42, P + 9, z, st(SB, 'west', 'top')); b.set(41, P + 10, z, DRESSED); lantern(41, P + 11, z)
  }
  for (const z of [43, 73]) {                                   // end piers frame the stage
    for (let x = 39; x <= 43; x += 1) for (let y = P + 1; y <= P + 13; y += 1) b.set(x, y, z, x === 43 && (y - P) % 2 === 0 ? TRIM : MASON)
    for (let x = 39; x <= 44; x += 1) b.set(x, P + 14, z, x === 44 ? st(SB, 'west', 'top') : sl(SB))
    banner(44, P + 9, z, 'east')
    lantern(43, P + 15, z)
  }
  b.crateRow([46, P + 3, 67], 'east', [
    { id: 'vote', label: 'Vote Crate', tier: 'vote', block: 'chest' },
    { id: 'common', label: 'Common Crate', tier: 'common', block: 'chest' },
    { id: 'rare', label: 'Rare Crate', tier: 'rare', block: 'barrel' },
    { id: 'legendary', label: 'Legendary Crate', tier: 'legendary', block: 'ender_chest' },
  ], { spacing: 6, primary: 'stone_bricks', trim: TRIM, base: 'mossy_stone_bricks', field: DRESSED, light: 'ochre_froglight' })
  b.sign('CRATES', [43, P + 17, 58], 'east', { font: 'small', align: 'center', block: 'quartz_block', board: 'polished_blackstone', frame: 'polished_deepslate' })
  // story at the shrine: chains and lanterns, a strongbox and a little spilled gold by the
  // legendary crate, supplies stacked at the stage ends
  b.set(51, P + 2, 45, 'barrel[facing=up,open=false]'); b.set(52, P + 2, 45, 'chest[facing=south]'); b.set(51, P + 3, 45, 'barrel[facing=up,open=false]')
  b.set(50, P + 2, 44, 'decorated_pot'); b.set(52, P + 2, 44, 'barrel[facing=east,open=false]')
  b.set(44, P + 2, 46, 'raw_gold_block'); b.set(43, P + 2, 46, 'chest[facing=east]')
  b.set(51, P + 2, 71, 'barrel[facing=up,open=false]'); b.set(52, P + 2, 71, 'composter[level=7]'); b.set(51, P + 3, 71, 'potted_fern')

  // ------------------------------------------------------------------ auction hall (east)
  // A two-storey hall: stone ground floor, jettied timber-and-plaster upper floor, steep slate
  // gable, a gabled porch over the auctioneer's alcove with the podium (lectern) and the bell.
  const AH = { x0: 88, x1: 99, z0: 50, z1: 64 }
  for (let x = AH.x0; x <= AH.x1; x += 1) for (let z = AH.z0; z <= AH.z1; z += 1) foundation(x, z)
  b.box([AH.x0, P + 1, AH.z0], [AH.x1, P + 4, AH.z1], MASON)
  b.box([AH.x0 + 1, P + 1, AH.z0 + 1], [AH.x1 - 1, P + 3, AH.z1 - 1], 'air')
  b.box([AH.x0 + 1, P, AH.z0 + 1], [AH.x1 - 1, P, AH.z1 - 1], 'spruce_planks')
  b.box([AH.x0 - 1, P + 4, AH.z0], [AH.x1, P + 4, AH.z1], 'spruce_planks')                       // upper floor + jetty
  for (const [x, z] of [[AH.x0, AH.z0], [AH.x0, AH.z1], [AH.x1, AH.z0], [AH.x1, AH.z1]]) for (let y = P + 1; y <= P + 4; y += 1) b.set(x, y, z, (y - P) % 2 ? TRIM : 'stone_bricks')
  for (let z = AH.z0; z <= AH.z1; z += 1) if (z < 55 || z > 59) b.set(AH.x0 - 1, P + 4, z, st('dark_oak', 'east', 'top'))   // jetty brackets
  // upper storey: frame on a 3-4 bay rhythm, plaster infill, windows with shutters
  const upper = (x, z, along) => {
    for (let y = P + 5; y <= P + 8; y += 1) {
      const posts = along === 'z' ? [50, 53, 57, 61, 64] : [88, 91, 95, 99]
      const u = along === 'z' ? z : x
      const post = posts.includes(u)
      const beam = y === P + 5 || y === P + 8
      b.set(x, y, z, post ? 'stripped_dark_oak_log[axis=y]' : beam ? `dark_oak_log[axis=${along}]` : PLASTER)
    }
  }
  for (let z = AH.z0; z <= AH.z1; z += 1) { upper(AH.x0 - 1, z, 'z'); upper(AH.x1, z, 'z') }
  for (let x = AH.x0; x <= AH.x1; x += 1) { upper(x, AH.z0, 'x'); upper(x, AH.z1, 'x') }
  b.box([AH.x0, P + 5, AH.z0 + 1], [AH.x1 - 1, P + 8, AH.z1 - 1], 'air')
  for (const [z0, z1] of [[51, 52], [54, 56], [58, 60], [62, 63]]) {
    for (let z = z0; z <= z1; z += 1) for (let y = P + 6; y <= P + 7; y += 1) b.set(AH.x0 - 1, y, z, 'glass_pane')
    b.set(AH.x0 - 2, P + 6, z0 - 1, 'spruce_trapdoor[facing=west,open=true,half=bottom]')
    b.set(AH.x0 - 2, P + 6, z1 + 1, 'spruce_trapdoor[facing=west,open=true,half=bottom]')
  }
  for (const x of [89, 90, 96, 97]) for (let y = P + 6; y <= P + 7; y += 1) b.set(x, y, AH.z1, 'glass_pane')
  // ground floor windows and a side door
  for (const [z0, z1] of [[51, 53], [61, 63]]) {
    for (let z = z0; z <= z1; z += 1) { b.set(AH.x0, P + 2, z, 'glass_pane'); b.set(AH.x0, P + 3, z, 'glass_pane'); b.set(AH.x0 - 1, P + 1, z, st(SB, 'east', 'top')) }
  }
  b.door([94, P + 1, AH.z1], 'south', { material: 'dark_oak', frame: 'stripped_dark_oak_log' })
  b.set(94, P + 4, AH.z1 + 1, 'lantern[hanging=true]'); b.set(94, P + 5, AH.z1 + 1, st('dark_oak', 'north', 'top'))
  // interior seen through the windows: ledgers, a long table, chests, lanterns
  for (let z = 52; z <= 62; z += 1) { b.set(98, P + 1, z, z % 4 === 0 ? 'chiseled_bookshelf' : 'bookshelf'); b.set(98, P + 2, z, 'bookshelf') }
  for (let z = 53; z <= 61; z += 1) if (z !== 57) b.set(93, P + 1, z, z % 2 ? st('spruce', 'east', 'top') : 'barrel[facing=up,open=false]')
  for (const z of [53, 57, 61]) { lantern(95, P + 1, z); lantern(92, P + 5, z) }
  b.set(90, P + 1, 52, 'chest[facing=east]'); b.set(90, P + 1, 62, 'chest[facing=east]')
  // the alcove: 3 wide, 4 tall, dark panelled back with ledgers and a red glow behind the head
  for (let x = AH.x0; x <= AH.x0 + 1; x += 1) for (let z = 56; z <= 58; z += 1) for (let y = P + 1; y <= P + 4; y += 1) b.set(x, y, z, 'air')
  for (let z = 56; z <= 58; z += 1) {
    b.set(AH.x0 + 1, P, z, 'polished_andesite'); b.set(AH.x0, P, z, 'polished_andesite')
    for (let y = P + 1; y <= P + 4; y += 1) b.set(AH.x0 + 2, y, z, z === 57 ? 'dark_oak_planks' : y <= P + 2 ? 'bookshelf' : 'dark_oak_planks')
    b.set(AH.x0 + 1, P + 5, z, 'dark_oak_planks'); b.set(AH.x0, P + 5, z, 'dark_oak_log[axis=z]')
  }
  b.set(AH.x0 + 2, P + 3, 57, 'red_stained_glass'); b.set(AH.x0 + 3, P + 3, 57, 'ochre_froglight')
  for (const z of [55, 59]) for (let y = P + 1; y <= P + 4; y += 1) b.set(AH.x0, y, z, y === P + 4 ? 'chiseled_stone_bricks' : TRIM)
  b.set(AH.x0, P + 4, 56, st(TRIM, 'north', 'top')); b.set(AH.x0, P + 4, 58, st(TRIM, 'south', 'top'))
  for (let x = 85; x <= 89; x += 1) b.set(x, P + 1, 57, 'red_carpet')
  b.npcSpot([AH.x0 + 1, P, 57], 'west', { id: 'auction', label: 'Auction House', role: 'auction', style: 'none' })
  // the porch: posts, beams, its own small gable joined to the hall
  for (const z of [54, 60]) {
    b.set(84, P + 1, z, DRESSED)
    for (let y = P + 2; y <= P + 5; y += 1) b.set(84, y, z, 'stripped_dark_oak_log[axis=y]')
    for (let x = 85; x <= 87; x += 1) b.set(x, P + 5, z, 'dark_oak_log[axis=x]')
  }
  for (let z = 55; z <= 59; z += 1) b.set(84, P + 5, z, 'dark_oak_log[axis=z]')
  b.roof({ x0: 84, z0: 54, x1: 88, z1: 60, y: P + 6, type: 'gable', axis: 'x', material: 'deepslate_tile', pitch: 1, overhang: 1, gableOverhang: 1, gable: PLASTER, eaveTrim: true, overwrite: false })
  b.set(85, P + 1, 55, `lectern[facing=west,has_book=true]`)
  b.set(85, P + 1, 59, 'stripped_dark_oak_log[axis=y]'); b.set(85, P + 2, 59, 'bell[attachment=floor,facing=north]')
  b.set(84, P + 4, 57, 'lantern[hanging=true]')
  // roped-off lots either side of the porch
  for (const [za, zb, goods] of [[51, 53, ['barrel[facing=up,open=false]', 'decorated_pot', 'chest[facing=west]']], [61, 63, ['hay_block[axis=y]', 'chest[facing=west]', 'iron_block']]]) {
    goods.forEach((g, i) => b.set(AH.x0 - 1, P + 1, za + i, g))
    b.set(AH.x0 - 2, P + 1, za, 'dark_oak_fence'); b.set(AH.x0 - 2, P + 1, zb, 'dark_oak_fence')
    b.set(AH.x0 - 2, P + 1, za + 1, 'chain[axis=z]')
  }
  b.set(AH.x0 - 1, P + 2, 63, 'lantern[hanging=false]')
  // roof: slate gable over plaster gable ends; a chimney on the back slope; banners on the jetty
  b.roof({ x0: AH.x0 - 1, z0: AH.z0, x1: AH.x1, z1: AH.z1, y: P + 9, type: 'gable', axis: 'z', material: 'deepslate_tile', pitch: 1, overhang: 1, gableOverhang: 1, gable: PLASTER, eaveTrim: true })
  for (const z of [AH.z0, AH.z1]) for (let y = P + 9; y <= P + 13; y += 1) b.set(93, y, z, 'stripped_dark_oak_log[axis=y]')
  b.chimney([97, P + 9, 61], 9, { paint: pal({ stone_bricks: 3, cobblestone: 1, mossy_stone_bricks: 1 }, 151, 2) })
  banner(AH.x0 - 2, P + 7, 53, 'west'); banner(AH.x0 - 2, P + 7, 61, 'west')

  // ------------------------------------------------------------------ market corner (SW)
  // Two stalls side by side, each its own design: the shop under a red-and-white striped
  // awning with produce; the kits smithy under a dark shingle lean-to with a weapon rack.
  // Both keep the NPC column clear to y + 5 (awning and roof at + 6 over the NPC).
  {
    const L = LF([55, P, 74], 'north')
    const put = (u, d, h, p) => b.set(...L.at(u, d, h), p)
    for (const u of [-2, 2]) {
      for (let h = 1; h <= 3; h += 1) put(u, 1, h, 'stripped_spruce_log[axis=y]')
      put(u, 1, 4, 'spruce_fence')
      for (let h = 1; h <= 5; h += 1) put(u, -1, h, 'stripped_spruce_log[axis=y]')
      put(u, 0, 1, 'spruce_fence')
    }
    for (let u = -1; u <= 1; u += 1) {
      put(u, 1, 1, st('spruce', 'south', 'top'))                         // counter
      put(u, -1, 1, 'barrel[facing=up,open=false]')                       // stock on the back wall
      put(u, -1, 2, sl('spruce', 'top'))
      put(u, -1, 3, ['hay_block[axis=y]', 'melon', 'pumpkin'][u + 1])
      put(u, -1, 4, 'spruce_planks')
      put(u, -1, 5, 'spruce_planks')
    }
    put(-1, 1, 2, 'melon'); put(1, 1, 2, 'carved_pumpkin[facing=north]')
    b.set(...L.at(-1, -1, 2).map((v, i) => (i === 1 ? v + 1 : v)), 'potted_red_tulip')
    for (let u = -3; u <= 3; u += 1) {                                      // the striped awning sags to the front
      const c = (u + 9) % 2 ? 'white_wool' : 'red_wool'
      put(u, 2, 4, c); put(u, 1, 5, c); put(u, 0, 6, c); put(u, -1, 6, c)
    }
    b.set(...L.at(1, 0, 5), 'lantern[hanging=true]')
    // produce piles outside the stall, a hand cart
    put(-3, 0, 1, 'hay_block[axis=y]'); put(-3, 1, 1, 'pumpkin'); put(-3, -1, 1, 'barrel[facing=up,open=false]'); put(-3, -1, 2, 'melon'); put(-4, 1, 1, 'composter[level=7]')
    put(3, 1, 1, 'barrel[facing=up,open=false]'); put(3, 0, 1, 'decorated_pot'); put(3, 1, 2, 'potted_azure_bluet')
    for (let u = -2; u <= 2; u += 1) put(u, -2, 1, u % 2 ? 'barrel[facing=north,open=false]' : 'spruce_planks')
    b.npcSpot([55, P, 74], 'north', { id: 'shop', label: 'Shop', role: 'shop', style: 'none' })
  }
  {
    const L = LF([47, P, 74], 'north')
    const put = (u, d, h, p) => b.set(...L.at(u, d, h), p)
    for (let u = -3; u <= 3; u += 1) for (let h = 1; h <= 6; h += 1) put(u, -1, h, Math.abs(u) === 3 ? 'stripped_dark_oak_log[axis=y]' : h === 1 ? 'cobblestone' : 'dark_oak_planks')
    for (const u of [-3, 3]) for (let h = 1; h <= 4; h += 1) put(u, 1, h, 'stripped_dark_oak_log[axis=y]')
    for (let u = -4; u <= 4; u += 1) {                                      // shingle lean-to
      put(u, -1, 7, sl('dark_oak'))
      put(u, 0, 6, st('dark_oak', 'south')); put(u, 1, 5, st('dark_oak', 'south')); put(u, 2, 4, sl('dark_oak', 'top'))
    }
    // weapon rack: spears (lightning rods) on a shelf, shields (banners) above
    for (const u of [-2, -1, 1, 2]) { put(u, 0, 1, sl('spruce', 'top')); put(u, 0, 2, 'lightning_rod[facing=up]'); put(u, 0, 3, 'lightning_rod[facing=up]') }
    put(-2, 0, 5, 'red_wall_banner[facing=north]'); put(2, 0, 5, 'white_wall_banner[facing=north]'); put(0, 0, 5, 'red_wall_banner[facing=north]')
    put(-2, 1, 1, 'anvil[facing=east]'); put(2, 1, 1, 'grindstone[face=floor,facing=north]')
    put(-4, 0, 1, 'smithing_table'); put(-4, 1, 1, 'barrel[facing=up,open=true]')
    put(4, 0, 1, 'hay_block[axis=y]'); put(4, 0, 2, 'target'); put(4, 1, 1, 'chest[facing=north]')
    b.set(...L.at(3, 2, 3), 'lantern[hanging=true]')
    put(-3, 2, 3, 'red_wall_banner[facing=north]')
    b.npcSpot([47, P, 74], 'north', { id: 'kits', label: 'Kits', role: 'kits', style: 'none' })
  }

  // ------------------------------------------------------------------ store kiosk (east)
  {
    const L = LF([83, P, 67], 'west')
    const put = (u, d, h, p) => b.set(...L.at(u, d, h), p)
    for (let u = -2; u <= 2; u += 1)
      for (let d = -2; d <= 2; d += 1) {
        const edge = Math.abs(u) === 2 || Math.abs(d) === 2
        put(u, d, 1, edge ? DRESSED : 'spruce_planks')
      }
    for (let u = -1; u <= 1; u += 1) put(u, 3, 1, st(SB, L.back))
    for (let d = -1; d <= 1; d += 1) { put(3, d, 1, st(SB, L.left)); put(-3, d, 1, st(SB, L.right)) }
    for (const u of [-2, 2]) for (const d of [-2, 2]) for (let h = 2; h <= 6; h += 1) put(u, d, h, 'stripped_spruce_log[axis=y]')
    for (let u = -2; u <= 2; u += 1) for (let d = -2; d <= 2; d += 1) if (Math.abs(u) === 2 || Math.abs(d) === 2) put(u, d, 7, Math.abs(u) === 2 && Math.abs(d) === 2 ? 'spruce_planks' : `dark_oak_log[axis=${Math.abs(u) === 2 ? 'x' : 'z'}]`)
    for (let k = -1; k <= 1; k += 1) { put(k, -2, 2, 'spruce_fence'); put(-2, k, 2, 'spruce_fence'); put(2, k, 2, 'spruce_fence') }
    for (let u = -1; u <= 1; u += 1) put(u, 1, 2, st('spruce', L.back, 'top'))       // counter
    put(-1, 1, 3, 'potted_spruce_sapling'); put(1, 1, 3, 'lantern[hanging=false]')
    put(1, -1, 2, 'ender_chest[facing=west]'); put(-1, -1, 2, 'chest[facing=west]')
    for (let d = -1; d <= 0; d += 1) put(0, d, 2, 'red_carpet')
    for (const u of [-2, 2]) put(u, 3, 5, 'red_wall_banner[facing=west]')
    const [rx, , rz] = L.at(0, 0, 0)
    b.roof({ x0: rx - 2, z0: rz - 2, x1: rx + 2, z1: rz + 2, y: P + 8, type: 'pyramid', material: 'deepslate_tile', pitch: 1, overhang: 1, eaveTrim: true })
    b.set(rx, P + 11, rz, 'spruce_fence'); b.set(rx, P + 12, rz, 'red_banner[rotation=4]')
    b.npcSpot([83, P + 1, 67], 'west', { id: 'store', label: 'Store / Ranks', role: 'store', style: 'none' })
  }

  // ------------------------------------------------------------------ quests notice board (SE)
  {
    const L = LF([80, P, 73], 'north')
    const put = (u, d, h, p) => b.set(...L.at(u, d, h), p)
    for (const u of [-2, 2]) for (let h = 1; h <= 4; h += 1) put(u, -2, h, 'stripped_spruce_log[axis=y]')
    for (let u = -1; u <= 1; u += 1) { put(u, -2, 1, 'cobblestone_wall'); for (let h = 2; h <= 3; h += 1) put(u, -2, h, 'spruce_planks') }
    for (let u = -2; u <= 2; u += 1) put(u, -2, 4, 'spruce_log[axis=x]')
    for (let u = -3; u <= 3; u += 1) { put(u, -2, 5, st('spruce', 'south')); put(u, -1, 5, sl('spruce', 'bottom')) }
    // pinned notices (open trapdoors on the board), one larger poster
    put(-1, -1, 3, 'birch_trapdoor[facing=north,open=true,half=top]'); put(0, -1, 2, 'birch_trapdoor[facing=north,open=true,half=bottom]')
    put(1, -1, 3, 'birch_trapdoor[facing=north,open=true,half=bottom]'); put(1, -1, 2, 'white_wall_banner[facing=north]')
    b.set(...L.at(-3, -1, 4), 'lantern[hanging=true]')
    put(2, 0, 1, 'lectern[facing=north,has_book=true]')
    put(-2, 0, 1, 'barrel[facing=up,open=false]'); put(-2, 0, 2, 'candle[candles=3,lit=true]'); put(-3, 0, 1, 'chiseled_bookshelf[facing=north]')
    b.npcSpot([80, P, 73], 'north', { id: 'quests', label: 'Quests', role: 'quests', style: 'none' })
  }

  // ------------------------------------------------------------------ RTP travel post (at the gate)
  // The way to the wild: a map table under a lean-to at the east tower's foot, a signpost with
  // arms pointing out, travel packs, and a lodestone set in the floor where players stand.
  {
    const L = LF([74, P, 76], 'north')
    const put = (u, d, h, p) => b.set(...L.at(u, d, h), p)
    for (let u = -4; u <= -1; u += 1) { put(u, -1, 4, sl('spruce', 'top')); put(u, 0, 4, sl('spruce')) }
    put(-4, 0, 1, 'stripped_spruce_log[axis=y]'); put(-4, 0, 2, 'stripped_spruce_log[axis=y]'); put(-4, 0, 3, 'stripped_spruce_log[axis=y]')
    put(-2, 0, 1, 'cartography_table'); put(-3, 0, 1, st('spruce', L.left)); put(-1, -1, 1, 'barrel[facing=up,open=false]')
    put(-2, -1, 1, 'brown_wool'); put(-3, -1, 1, 'chest[facing=north]'); put(-2, -1, 2, 'white_wool')
    b.set(...L.at(-1, 0, 3), 'lantern[hanging=true]')
    // signpost: a post with board arms at three heights, pointing three ways
    for (let h = 1; h <= 4; h += 1) put(-5, 1, h, 'spruce_fence')
    put(-6, 1, 3, 'spruce_trapdoor[facing=east,open=true,half=top]')
    put(-4, 1, 2, 'spruce_trapdoor[facing=west,open=true,half=top]')
    put(-5, 2, 4, 'spruce_trapdoor[facing=south,open=true,half=top]')
    const [lx, , lz] = L.at(0, 2, 0)
    b.set(lx, P, lz, 'lodestone')
    b.npcSpot([74, P, 76], 'north', { id: 'rtp', label: 'Random Teleport', role: 'rtp', style: 'none' })
  }

  // ------------------------------------------------------------------ start here (by the spawn)
  b.npcSpot([59, P + 1, 54], 'east', { id: 'start', label: 'Start Here', role: 'tutorial', style: 'pedestal', primary: 'stone_bricks', trim: TRIM, base: 'mossy_stone_bricks', accent: 'red_terracotta', inlay: TRIM })
  // rules plaque (lectern) and a little map board on posts beside it
  b.set(58, P + 2, 50, 'lectern[facing=east,has_book=true]')
  for (const z of [47, 50]) for (let y = P + 2; y <= P + 4; y += 1) b.set(56, y, z, 'stripped_dark_oak_log[axis=y]')
  const MAP = ['green_terracotta', 'light_blue_terracotta', 'lime_terracotta', 'brown_terracotta']
  for (let i = 0; i < 2; i += 1) for (let k = 0; k < 2; k += 1) b.set(56, P + 3 + k, 48 + i, MAP[i * 2 + k])
  for (let z = 47; z <= 50; z += 1) b.set(56, P + 5, z, sl('dark_oak'))

  // ------------------------------------------------------------------ planting in the plaza
  // One feature oak (the left frame of the first view) in a round planter with seats, a birch
  // pair by the market (the right frame), and planted beds where the paving meets the cliff.
  {
    const [tx, tz] = [77, 60]
    for (let x = tx - 4; x <= tx + 4; x += 1)
      for (let z = tz - 4; z <= tz + 4; z += 1) {
        const d = Math.hypot(x - tx, z - tz)
        if (d > 3.6) continue
        if (d > 2.6) { b.set(x, P + 1, z, 'stone_bricks'); b.set(x, P + 2, z, sl(SB)) } else { b.set(x, P, z, 'dirt'); b.set(x, P + 1, z, d < 1.5 ? 'rooted_dirt' : 'grass_block') }
      }
    for (const [x, z, f] of [[tx - 1, tz - 1, 'fern'], [tx + 1, tz + 1, 'oxeye_daisy'], [tx - 2, tz + 1, 'azure_bluet'], [tx + 2, tz - 1, 'fern'], [tx, tz + 2, 'cornflower'], [tx - 1, tz + 2, 'moss_carpet']]) b.set(x, P + 2, z, f)
    b.tree([tx, P + 2, tz], 'oak', { seed: 4, height: 12, trunk: 1.1, leaves: ['oak_leaves', 'oak_leaves', 'azalea_leaves'], roots: 3 })
    bench(73, P + 1, 63, 'west', 3)
    lantern(tx + 3, P + 3, tz - 1)
  }
  for (const [x, z, h, s] of [[51, 77, 9, 3], [44, 77, 7, 6]]) {
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) b.set(x + dx, P, z + dz, dx || dz ? 'moss_block' : 'grass_block')
    b.set(x + 1, P + 1, z, 'fern'); b.set(x - 1, P + 1, z + 1, 'lily_of_the_valley')
    b.tree([x, P + 1, z], 'birch', { seed: s, height: h, roots: 0 })
  }
  // beds at the cliff foot: a mossy kerb, soil, ferns, bushes and flower drifts in clumps
  const built = (x, y, z) => { const n = b.nameAt(x, y, z); return n && !/(grass_block|dirt|gravel|andesite|cobblestone|tuff|stone$|moss_block|coarse_dirt|calcite|rooted_dirt|podzol|cobbled_deepslate)$/.test(n) }
  const bedCells = []
  for (let x = 30; x < 106; x += 1)
    for (let z = 26; z < 82; z += 1) {
      const sd = shelfD[id2(x, z)]
      if (sd <= 0 || sd > 3.2) continue
      const y = height(x, z)
      if (y > P + 3 || built(x, y + 1, z) || built(x, y, z) || b.get(x, y + 1, z)) continue
      b.set(x, y, z, fbm(x, z, 5, 161, 2) > 0.18 ? 'moss_block' : fbm(x, z, 4, 162, 2) < -0.3 ? 'coarse_dirt' : 'grass_block')
      if (sd <= 1.1 && y === P && !b.get(x, P + 1, z)) b.set(x, P + 1, z, fbm(x, z, 3, 163, 2) > 0 ? 'mossy_cobblestone' : 'mossy_stone_bricks')
      else bedCells.push([x, y, z])
    }
  for (const [x, y, z] of bedCells) {
    if (b.get(x, y + 1, z)) continue
    const n = hash(x, y, z, 164)
    const drift = fbm(x, z, 6, 165, 2)
    if (n < 0.05) b.bush([x, y + 1, z], { radius: 1.3 + hash(x, 0, z, 166) * 0.6, leaves: ['oak_leaves', 'azalea_leaves'], seed: x * 7 + z })
    else if (n < 0.35) b.set(x, y + 1, z, 'fern')
    else if (n < 0.55) b.set(x, y + 1, z, drift > 0.15 ? 'azure_bluet' : drift < -0.15 ? 'cornflower' : 'short_grass')
    else if (n < 0.62 && !b.get(x, y + 2, z)) { b.set(x, y + 1, z, 'large_fern[half=lower]'); b.set(x, y + 2, z, 'large_fern[half=upper]') }
  }
  for (const [x, z, r] of [[39, 40, 2.2], [100, 67, 2.4], [92, 75, 1.8], [44, 79, 1.6], [101, 47, 1.7], [87, 31, 2]]) {
    const y = height(x, z)
    b.boulder([x, y + 0.5, z], [r * 1.2, r * 0.8, r], pal({ stone: 4, andesite: 3, mossy_cobblestone: 2, tuff: 1 }, 167, 2), { seed: x + z, mossTop: 'moss_block' })
  }
  for (const [x, z, s] of [[45, 41, 2], [98, 70, 5], [36, 76, 9]]) b.tree([x, b.groundY(x, z) + 1, z], 'spruce', { seed: s, height: 8, radius: 2.6, roots: 0 })

  // ------------------------------------------------------------------ lamps and seats
  lampPost(61, P + 1, 59); armLamp(71, P + 1, 59, 'west')              // the avenue's head (two designs)
  armLamp(54, P + 1, 45, 'east'); armLamp(54, P + 1, 72, 'east')        // crate apron
  lampPost(86, P + 1, 48); armLamp(86, P + 1, 65, 'west')               // auction hall
  armLamp(90, P + 1, 46, 'south')                                       // pool
  armLamp(59, P + 1, 77, 'north')                                       // market
  bench(46, P + 2, 47, 'north', 3); bench(86, P + 2, 44, 'north', 2)    // facing the boards
  bench(89, P + 1, 38, 'east', 3)                                       // facing the waterfall
  for (const [x, z] of [[66, 96], [61, 108], [62, 120]]) { const y = b.groundY(x + 2, z); if (y > 0) lampPost(x + 2, y + 1, z) }

  // ------------------------------------------------------------------ forest
  const nearStream = (x, z) => STREAM.near(x, z).d < 5 || tarnD(x, z) < 1.8
  const forestAvoid = (x, z) => shelfD[id2(x, z)] < 4 || TRAIL.near(x, z).d < 3.5 || nearStream(x, z) || slope(x, z) >= 3 || (Math.abs(x - 68) < 24 + (z - 80) * 0.35 && z > 76 && z < 104)
  b.forest({
    x0: 1, z0: 78, x1: W - 2, z1: D - 2, seed: 7,
    ground: (x, z) => b.groundY(x, z),
    species: [[4, 'oak'], [3, 'birch'], [3, 'spruce'], [1, 'colonized'], [1, 'forester_cone']],
    density: 0.5, minSpacing: 8,
    clearings: [[58, 110, 10], [94, 102, 7], [38, 96, 7], [78, 100, 8]],
    avoid: (x, z) => forestAvoid(x, z) || height(x, z) > 44,
  })
  b.forest({
    x0: 1, z0: 1, x1: W - 2, z1: 77, seed: 8,
    ground: (x, z) => b.groundY(x, z),
    species: [[6, 'spruce'], [3, 'forester_cone'], [2, 'birch'], [2, 'oak']],
    density: 0.6, minSpacing: 7, sizes: [0, 0.55, 0.45],
    clearings: [[30, 40, 8], [104, 50, 7], [60, 14, 8]],
    avoid: (x, z) => forestAvoid(x, z) || height(x, z) > 50 || (x > 44 && x < 92 && z > 20 && z < 37),
  })
  b.scatter({ on: ['minecraft:grass_block'], density: 0.3, seed: 3, clump: 7, paints: [[12, 'short_grass'], [3, 'tall_grass'], [3, 'fern'], [1, 'oxeye_daisy'], [1, 'azure_bluet'], [1, 'cornflower'], [1, 'poppy']] })

  // ------------------------------------------------------------------ ageing
  b.overgrow([28, P + 2, 18], [106, P + 36, 84], { amount: 0.3, maxLength: 5, moss: false, seed: 11, only: ['minecraft:stone', 'minecraft:andesite', 'minecraft:tuff', 'minecraft:cobblestone', 'minecraft:calcite'] })
  for (const [a, c] of [[[44, P + 18, 33], [90, P + 36, 38]], [[41, P + 8, 42], [46, P + 24, 74]]])
    for (let x = a[0]; x <= c[0]; x += 1) for (let y = a[1]; y <= c[1]; y += 1) for (let z = a[2]; z <= c[2]; z += 1) if (b.nameAt(x, y, z) === 'minecraft:vine') b.remove(x, y, z)
  b.weather([30, P, 30], [104, P + 30, 92], {
    share: 0.25, scale: 3, seed: 9,
    variants: {
      'minecraft:deepslate_tile_stairs': ['minecraft:deepslate_brick_stairs', 'minecraft:cobbled_deepslate_stairs'],
      'minecraft:deepslate_tiles': ['minecraft:deepslate_bricks', 'minecraft:cobbled_deepslate'],
      'minecraft:deepslate_tile_slab': ['minecraft:deepslate_brick_slab', 'minecraft:cobbled_deepslate_slab'],
    },
  })

  // ------------------------------------------------------------------ gameplay: region, light
  b.region('spawn', [32, 0, 24], [106, SIZE[1] - 1, 92], { pvp: 'deny', 'mob-spawning': 'deny', 'fall-damage': 'deny', 'greeting-title': 'Valley', priority: 10 })
  const safe = (x, z) => shelfD[id2(x, z)] <= 3.5 || (x >= 60 && x <= 72 && z <= 90)
  b.spawnProof([32, P - 1, 24], [106, P + 24, 92], { inside: (x, z) => safe(x, z) })

  return b.finish({
    name: 'normal-spawn',
    description: 'Valley spawn: a FreshSMP-style normal spawn plaza carved into a forested valley head, with a gate tower hero, hall of fame under the VALLEY tablet, waterfall pool, crate shrine, timber auction hall and seven NPC sets.',
  })
}
