// BUILDINGS. Read this, look at img/buildings.png, then design each big building of your spawn from
// its job (a guildhall, a bank, a tavern, the market hall) and the theme: your own massing, sizes,
// roof shapes and materials. The kit's helpers (b.roof, b.dormer, palettes: references/building) are
// tools you may call; what the building looks like is your design. A spawn's buildings are BIG:
// 25-35 wide, 15-21 deep, 2-3 storeys plus a roof that is 40-50% of the height.
//
// DO
// - Mass it: a main block, a cross wing that steps 4-6 forward with its own gable to the front, a
//   tower 1.5-2x the eaves height, a porch; each mass 1/3-1/2 of the main one, ridges 2+ apart.
//   The footprint is a union of boxes, never one box; the silhouette has 4+ peaks.
// - Keep every big wall alive in layers of 1-2 blocks: a plinth +1 with a water-table stair, quoins
//   at the corners, pilasters (+1) or posts every 5-7 so no run is flat for more than ~6, a string
//   course or a jetty (the upper storey 1 out on brackets) at each floor line, the infill 1 behind
//   the frame, glass 1 behind the face with a sill under it and a lintel or arch over it.
// - Rhythm: bays of 5-7, one window per bay, windows stacked over each other, an A-B-A beat on long
//   walls (2-3-2 wide); the entrance is the one bay that breaks it.
// - Scale cues: storeys 5-6 floor to floor, windows 2-3 wide and 2-3 tall, the door 2 + a transom
//   under an arch 3 wide x 4 high, steps up to it. A player standing there reads the size from them.
// - Roof composition: 45 degrees or steeper (rises 1, 1 at the eave, 2 up the slope, 1 into the
//   ridge), 1 overhang with a trimmed eave, one ridge per mass at different heights (2+ apart),
//   valleys where they meet, dormers with light fronts on the long slopes, chimneys 1-3 above the
//   ridge, the tower roof the one peak above everything.
// - Spawn buildings are mostly shells: put a dark block 1 behind the glass (or furnish the room) so
//   a window reads as a window, not as a hole into a lit empty box. Full glass blocks: panes and
//   open trapdoors (shutters) show as thin posts in the renders.
// - Dress the ground: a forecourt on the axis of the door, beds along the walls, hedges, lamps.
// - Neighbours are siblings, not clones: same stone, timber and roof, but mirror the plan, change the
//   width, the wing, the tower, the plaster colour (house() below is the small sibling).
// DON'T
// - The big box: the same footprint as one plank or concrete cuboid with flat walls, a flat roof and
//   a row of flush glass; or a small house scaled up (huge flat walls, one door, no articulation).
// - Detail spread evenly: put the most at the entrance and the eye-level band, less on the backs.
// - Per-block speckle (use clumped palettes, 3-5 shades per material), glass or concrete walls on a
//   medieval spawn, gold anywhere.

import { local } from '../../../assets/frame/frame.mjs'
import { groundPatch } from './_scene.mjs'

const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const K = (u, d) => `${u},${d}`
const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' }
const TALL = /^(rose_bush|peony|lilac|tall_grass|large_fern)$/
// roof materials and the two neighbours their clumps of wear are made of
const AGED_ROOF = { deepslate_tile: ['cobbled_deepslate', 'deepslate_brick'], dark_oak: ['spruce', 'mangrove'], spruce: ['dark_oak', 'oak'], brick: ['mud_brick', 'granite'], mud_brick: ['brick', 'granite'], stone_brick: ['mossy_stone_brick', 'cobblestone'] }

// Heights above pos (the ground block): plinth 1-2, ground floor at 2, stone storey 3-7, upper floor
// (the jetty beam) at 8, timber storey 9-11, top plate 12, roofs start at 13.
const H = { floor: 2, win1: 4, course: 7, beam: 8, win2: 10, plate: 12, eave: 13 }
// Roof pitch per row from the eave in: 1, 1 at the eave (a kick), 2 up the slope (about 60
// degrees), 1 into the ridge (a [1, 1, 2] list would end in a 3-block fin on odd spans)
const STEEP = (i, rows) => (i < 2 || i === rows - 1 ? 1 : 2)

// A guildhall. pos = the ground block under the middle of the main front wall, facing = the front.
//   width / depth   the main range (odd width), 2 storeys: stone below, timber jettied above
//   wing            the cross wing at the right end { width, ahead, behind } (false: none)
//   tower           the tower at the left end { size, height } (false: none)
//   porch           the entrance bay { width, depth } in the middle of the free front
//   mirror          wing on the left, tower on the right
//   masonry (the stone storey and the tower), plinth, dressed (quoins, surrounds), plaster, brick
//   (chimneys): palettes; trim (stairs of the sills and courses), frame (wood), roof: families;
//   glass: the window block (full blocks read as glass at every angle; panes render as thin posts);
//   backing: the dark block 1 behind the glass (the shell's interior reads dark, as in the game)
//   garden          the forecourt, beds and lamps in front (false: the building only)
export function hall(ctx, pos, facing, opts = {}) {
  const { b, kit } = ctx
  const {
    width = 25, depth = 10, mirror = false,
    wing = { width: 9, ahead: 5, behind: 2 },
    tower = { size: 7, height: 24 },
    porch = { width: 7, depth: 5 },
    masonry = { bricks: 7, granite: 1, terracotta: 1 },
    plinth = { stone_bricks: 3, cobblestone: 2, andesite: 2, mossy_stone_bricks: 1 },
    dressed = { polished_andesite: 4, stone_bricks: 1 },
    trim = 'stone_brick',
    frame = 'dark_oak',
    plaster = { calcite: 5, white_concrete_powder: 2, white_terracotta: 1 },
    roof = 'deepslate_tile',
    brick = { bricks: 6, granite: 1, terracotta: 1 },
    glass = 'gray_stained_glass',
    backing = 'polished_blackstone',
    garden = true,
    seed = 1,
  } = opts
  const L = local(pos, facing)
  const M = mirror ? -1 : 1
  const set = (u, d, h, blk, o) => b.set(...L.at(M * u, d, h), blk, o)
  const get = (u, d, h) => b.get(...L.at(M * u, d, h))
  const dir = (du, dd) => (du * M > 0 ? L.right : du * M < 0 ? L.left : dd > 0 ? L.out : L.back)
  const fam = id => {
    const m = kit.material(String(id).replace('minecraft:', ''))
    return { ...m, stairs: m.stairs ?? m.substitutes?.stairs?.[0], slab: m.slab ?? m.substitutes?.slab?.[0], wall: m.wall ?? 'minecraft:stone_brick_wall' }
  }
  const P = {
    masonry: kit.palette(masonry, { scale: 3, seed }),
    plinth: kit.palette(plinth, { scale: 3, seed: seed + 1 }),
    dressed: kit.palette(dressed, { scale: 2, seed: seed + 2 }),
    plaster: kit.palette(plaster, { scale: 3, seed: seed + 3 }),
    brick: kit.palette(brick, { scale: 2, seed: seed + 4 }),
  }
  // a stair of whatever block the palette gives here (the clumps keep their colour in the trim)
  const shaped = (paint, state) => (x, y, z) => `${fam(paint(x, y, z)).stairs}[${state}]`
  const st = (mat, f, half = 'bottom') => `${fam(mat).stairs}[facing=${f},half=${half}]`
  const log = axis => `minecraft:${frame}_log[axis=${axis}]`
  const GLASS = `minecraft:${glass}`
  const BACKING = `minecraft:${backing}`
  // world (x, z) back to plan (u, d): paint functions for the roof gables get world coordinates
  const o0 = L.at(0, 0, 0)
  const R = [L.at(1, 0, 0)[0] - o0[0], L.at(1, 0, 0)[2] - o0[2]]
  const F = [L.at(0, 1, 0)[0] - o0[0], L.at(0, 1, 0)[2] - o0[2]]
  const toPlan = (x, z) => [M * ((x - o0[0]) * R[0] + (z - o0[2]) * R[1]), (x - o0[0]) * F[0] + (z - o0[2]) * F[1]]
  const worldRect = (u0, u1, d0, d1) => {
    const a = L.at(M * u0, d0, 0)
    const c = L.at(M * u1, d1, 0)
    return { x0: Math.min(a[0], c[0]), z0: Math.min(a[2], c[2]), x1: Math.max(a[0], c[0]), z1: Math.max(a[2], c[2]) }
  }

  // ---------------------------------------------------------------- the plan: masses (u0..u1, d1..d0)
  // Each mass is a box; jetty = how far its upper storey steps out at the front.
  const W2 = width >> 1
  const back = -(depth - 1)
  const masses = []
  const main = { u0: -W2, u1: W2, d0: 0, d1: back, jetty: 1, axis: 'u' }
  masses.push(main)
  const wingR = wing && { u0: W2 - (wing.width >> 1), u1: W2 + (wing.width >> 1), d0: wing.ahead, d1: back - wing.behind, jetty: 1, axis: 'd' }
  if (wingR) masses.push(wingR)
  const towerR = tower && { u0: -W2 - tower.size + 1, u1: -W2, d0: 2, d1: 2 - tower.size + 1, jetty: 0 }
  if (towerR) masses.push(towerR)
  const pc = Math.round(((towerR ? -W2 + 1 : -W2) + (wingR ? wingR.u0 - 1 : W2)) / 2)
  const porchR = porch && { u0: pc - (porch.width >> 1), u1: pc + (porch.width >> 1), d0: porch.depth, d1: 1, jetty: 1, axis: 'd' }
  if (porchR) masses.push(porchR)
  const G = new Set() // the ground storey's footprint
  const U = new Set() // the upper storey's (jetties included)
  const inTower = (u, d) => towerR && u >= towerR.u0 && u <= towerR.u1 && d >= towerR.d1 && d <= towerR.d0
  for (const m of masses)
    for (let u = m.u0; u <= m.u1; u += 1)
      for (let d = m.d1; d <= m.d0 + m.jetty; d += 1) {
        if (d <= m.d0) G.add(K(u, d))
        U.add(K(u, d))
      }
  const edgeOf = S => (u, d) => S.has(K(u, d)) && D4.some(([a, c]) => !S.has(K(u + a, d + c)))

  // Boundary runs: straight stretches of wall with one outward normal n. r.cell(s, k) is the cell
  // s along the run and k out from its face (k = 1 the plinth / pilaster layer, -1 the inner layer).
  function runsOf(S) {
    const out = []
    for (const [nu, nd] of D4) {
      const lines = new Map()
      for (const k of S) {
        const [u, d] = k.split(',').map(Number)
        if (S.has(K(u + nu, d + nd))) continue
        const plane = nu ? u : d
        if (!lines.has(plane)) lines.set(plane, [])
        lines.get(plane).push(nu ? d : u)
      }
      for (const [plane, list] of lines) {
        list.sort((p, q) => p - q)
        let s0 = list[0]
        for (let i = 1; i <= list.length; i += 1) {
          if (i < list.length && list[i] === list[i - 1] + 1) continue
          const r = { n: [nu, nd], axis: nu ? 'd' : 'u', plane, s0, s1: list[i - 1] }
          r.cell = (s, k = 0) => (nu ? [plane + nu * k, s] : [s, plane + nd * k])
          r.out = dir(nu, nd)
          r.in = OPP[r.out]
          r.neg = nu ? dir(0, -1) : dir(-1, 0) // toward s0
          r.pos = OPP[r.neg]
          r.along = nu ? L.deep : L.across
          r.convex0 = !S.has(K(...r.cell(s0 - 1, 0)))
          r.convex1 = !S.has(K(...r.cell(r.s1 + 1, 0)))
          out.push(r)
          s0 = list[i]
        }
      }
    }
    return out
  }
  const rset = (r, s, k, h, blk, o) => set(...r.cell(s, k), h, blk, o)
  const rget = (r, s, k, h) => get(...r.cell(s, k), h)

  // Bays: verticals (quoins at convex ends, the neighbour wall at concave ends, pilasters between)
  // about every 6, and a window centred in each panel: 2 wide in even panels, 3 in odd ones.
  function bayPlan(r) {
    const a = r.convex0 ? r.s0 : r.s0 - 1
    const z = r.convex1 ? r.s1 : r.s1 + 1
    const n = Math.max(1, Math.round((z - a) / 6))
    const v = [a]
    for (let i = 1; i < n; i += 1) v.push(a + Math.round((i * (z - a)) / n))
    v.push(z)
    const wins = []
    for (let i = 0; i + 1 < v.length; i += 1) {
      const w = v[i + 1] - v[i] - 1
      const ww = w >= 4 ? (w % 2 ? 3 : 2) : w === 3 ? 1 : 0
      if (ww) wins.push({ s: v[i] + 1 + (w - ww) / 2, w: ww })
    }
    return { v, wins }
  }
  // spans of wall the generic bays keep off (the bay window, the porch arch, the chimney stack)
  const reserved = []
  const isReserved = (r, s) => {
    const [u, d] = r.cell(s, 0)
    return reserved.some(([u0, u1, d0, d1]) => u >= u0 && u <= u1 && d >= d1 && d <= d0)
  }
  const wc = wingR && (wingR.u0 + wingR.u1) >> 1
  const bay = wingR && { u0: wc - 2, u1: wc + 2, d: wingR.d0 }
  if (bay) reserved.push([bay.u0 - 1, bay.u1 + 1, bay.d, bay.d])
  if (porchR) reserved.push([porchR.u0, porchR.u1, porchR.d0, porchR.d0])
  const stack = wingR && { u: wingR.u1, d0: Math.round((wingR.d0 + wingR.d1) / 2) + 1, d1: Math.round((wingR.d0 + wingR.d1) / 2) - 2 }
  if (stack) reserved.push([stack.u, stack.u, stack.d0 + 1, stack.d1 - 1])

  // ---------------------------------------------------------------- floors
  for (const k of G) {
    const [u, d] = k.split(',').map(Number)
    for (let h = -1; h <= 1; h += 1) set(u, d, h, P.plinth)
    set(u, d, H.floor, 'minecraft:spruce_planks')
  }
  for (const k of U) {
    const [u, d] = k.split(',').map(Number)
    if (!inTower(u, d)) set(u, d, H.beam, 'minecraft:spruce_planks')
  }

  // ---------------------------------------------------------------- the stone storey (all round)
  const groundRuns = runsOf(G)
  const plans = new Map()
  for (const r of groundRuns) {
    const plan = bayPlan(r)
    plan.wins = plan.wins.filter(w => !isReserved(r, w.s) && !isReserved(r, w.s + w.w - 1))
    plans.set(r, plan)
    const jettied = s => U.has(K(...r.cell(s, 1)))
    for (let s = r.s0; s <= r.s1; s += 1) {
      for (let h = 1; h <= H.course; h += 1) {
        rset(r, s, 0, h, h <= 2 ? P.plinth : P.masonry)
        rset(r, s, -1, h, h <= 2 ? P.plinth : P.masonry, { keep: true })
      }
      // plinth +1 and its water-table stair; a string course at the floor line where no jetty is
      rset(r, s, 1, 1, P.plinth)
      rset(r, s, 1, 2, shaped(P.plinth, `facing=${r.in},half=bottom`))
      if (!jettied(s)) rset(r, s, 1, H.course, st(trim, r.in, 'top'))
    }
    // convex corners: the plinth round the corner, quoins long and short
    for (const [end, conv, step] of [[r.s0, r.convex0, 1], [r.s1, r.convex1, -1]]) {
      if (!conv) continue
      const [cu, cd] = r.cell(end - step, 1)
      set(cu, cd, 1, P.plinth)
      set(cu, cd, 2, shaped(P.plinth, `facing=${r.in},half=bottom`))
      if (!jettied(end)) set(cu, cd, H.course, st(trim, r.in, 'top'))
      for (let h = 3; h <= H.course; h += 1) {
        rset(r, end, 0, h, P.dressed)
        if ((h + (r.axis === 'u' ? 0 : 1)) % 2 === 0) rset(r, end + step, 0, h, P.dressed)
      }
    }
    // pilasters at the inner verticals: a stair foot, a dressed base, a shaft +1 in the wall's own
    // masonry, a corbel cap that carries the jetty post
    for (const s of plan.v.slice(1, -1)) {
      if (isReserved(r, s)) continue
      rset(r, s, 2, 1, st(trim, r.in))
      rset(r, s, 1, 2, P.dressed)
      for (let h = 3; h < H.course; h += 1) rset(r, s, 1, h, P.masonry)
      rset(r, s, 1, H.course, st(trim, r.in, 'top'))
    }
    // windows: 3 tall, glass 1 behind the face, a sill, dressed jambs, an arched head, a keystone
    for (const { s, w } of plan.wins) stoneWindow(r, s, w, H.win1, 3)
  }
  function stoneWindow(r, s, w, h0, ht, surround = true) {
    const top = h0 + ht - 1
    for (let i = 0; i < w; i += 1) {
      for (let h = h0; h <= top; h += 1) {
        rset(r, s + i, 0, h, 'minecraft:air')
        rset(r, s + i, -1, h, GLASS)
        rset(r, s + i, -2, h, BACKING)
      }
      rset(r, s + i, 1, h0 - 1, st(trim, r.in, 'top'))
    }
    if (surround) for (let h = h0; h <= top; h += 2) for (const j of [s - 1, s + w]) rset(r, j, 0, h, P.dressed)
    for (let i = surround ? -1 : 0; i < (surround ? w + 1 : w); i += 1) rset(r, s + i, 0, top + 1, P.dressed)
    if (w >= 2) {
      rset(r, s, 0, top, st(trim, r.neg, 'top'))
      rset(r, s + w - 1, 0, top, st(trim, r.pos, 'top'))
    }
    if (w === 3) for (let h = h0; h < top; h += 1) rset(r, s + 1, 0, h, `${fam(trim).wall}`)
    if (w % 2) rset(r, s + (w >> 1), 0, top + 1, 'minecraft:chiseled_stone_bricks')
  }

  // ---------------------------------------------------------------- the timber storey (jettied)
  // Posts and beams on the face, the plaster 1 behind them, brackets under the jettied posts, knee
  // braces in the top corners of each panel, windows over the windows below with a sill.
  const isEdgeU = edgeOf(U)
  const upperRuns = runsOf(U).filter(r => !inTower(...r.cell(r.s0, 0)))
  for (const r of upperRuns) {
    const below = groundRuns.find(g => g.n[0] === r.n[0] && g.n[1] === r.n[1] && (g.plane === r.plane || g.plane === r.plane - (r.n[0] || r.n[1])) && g.s0 <= r.s1 && g.s1 >= r.s0)
    const plan = below ? plans.get(below) : bayPlan(r)
    const posts = [...new Set([r.s0, r.s1, ...plan.v.filter(s => s > r.s0 && s < r.s1)])].sort((p, q) => p - q)
    const wins = plan.wins.filter(w => w.s > r.s0 && w.s + w.w - 1 < r.s1)
    const overhang = s => !G.has(K(...r.cell(s, 0)))
    for (let s = r.s0; s <= r.s1; s += 1) {
      rset(r, s, 0, H.beam, log(r.along))
      rset(r, s, 0, H.plate, log(r.along))
      for (let h = H.beam + 1; h < H.plate; h += 1) {
        rset(r, s, 0, h, 'minecraft:air')
        if (!isEdgeU(...r.cell(s, -1))) rset(r, s, -1, h, P.plaster)
      }
    }
    for (const s of posts) {
      for (let h = H.beam + 1; h < H.plate; h += 1) rset(r, s, 0, h, log('y'))
      if (overhang(s)) rset(r, s, 0, H.course, st(frame, r.in, 'top'))
    }
    for (let i = 0; i + 1 < posts.length; i += 1) {
      const [p, q] = [posts[i], posts[i + 1]]
      if (q - p < 4 || wins.some(w => w.s > p && w.s < q)) continue
      rset(r, p + 1, 0, H.plate - 1, st(frame, r.neg, 'top'))
      rset(r, q - 1, 0, H.plate - 1, st(frame, r.pos, 'top'))
    }
    for (const { s, w } of wins) timberWindow(r, s, w)
  }
  function timberWindow(r, s, w, h0 = H.win2, ht = 2, k = -1) {
    for (let i = 0; i < w; i += 1) {
      for (let h = h0; h < h0 + ht; h += 1) {
        rset(r, s + i, k, h, GLASS)
        rset(r, s + i, k - 1, h, BACKING)
      }
      rset(r, s + i, k + 1, h0 - 1, st(frame, r.in, 'top'))
    }
    if (w === 3) for (let h = h0; h < h0 + ht; h += 1) rset(r, s + 1, 0, h, log('y'))
  }

  // ---------------------------------------------------------------- roofs: wing, then main, then porch
  // Steep with a trimmed eave; each later roof merges in (per column the higher surface wins), so
  // the valleys come out by themselves. Gables close-studded in the frame wood.
  const studs = across => (x, y, z) => {
    const [u, d] = toPlan(x, z)
    const s = across === 'u' ? u : d
    if (y - pos[1] === H.eave) return log(across === 'u' ? L.across : L.deep)
    return Math.abs(s) % 2 === 0 ? log('y') : P.plaster(x, y, z)
  }
  const roofOf = (m, opt = {}) => b.roof({
    ...worldRect(m.u0, m.u1, m.d0 + m.jetty, opt.d1 ?? m.d1), y: pos[1] + H.eave,
    axis: m.axis === 'u' ? L.across : L.deep, material: roof, pitch: STEEP, overhang: 1, gableOverhang: 1,
    eaveTrim: true, gable: studs(m.axis === 'u' ? 'd' : 'u'), merge: opt.merge,
  })
  if (wingR) roofOf(wingR)
  roofOf(main, { merge: !!wingR })
  if (porchR) roofOf(porchR, { merge: true, d1: porchR.d1 - 4 })
  // a merged roof clears its columns from its lowest block up: put the top plates back
  const roofIds = new Set([roof, ...(AGED_ROOF[roof] ?? [])].flatMap(a => { const m = kit.material(a); return [m.stairs, m.slab, m.block] }))
  for (const r of upperRuns) for (let s = r.s0; s <= r.s1; s += 1) if (roofIds.has(rget(r, s, 0, H.plate)?.name)) rset(r, s, 0, H.plate, log(r.along))
  // dormers over the windows of the long walls (the main front, the wing's outer side): on the wall
  // line, a plaster front between two posts (it must contrast with the slates, or it reads as a
  // hole in the roof), a 1-light window
  const dormerRuns = [[0, 1, main.d0], ...(wingR ? [[1, 0, wingR.u1]] : [])]
  for (const [nu, nd, plane] of dormerRuns) {
    const below = groundRuns.filter(g => g.n[0] === nu && g.n[1] === nd && g.plane === plane)
    for (const g of below)
      for (const w of plans.get(g).wins) {
        const c = w.s + (w.w >> 1)
        const up = upperRuns.find(q => q.n[0] === nu && q.n[1] === nd && q.s0 < c && q.s1 > c)
        if (!up) continue
        const wall = (x, y, z) => (Math.abs(toPlan(x, z)[nu ? 1 : 0] - c) === 1 ? log('y') : P.plaster(x, y, z))
        b.dormer(L.at(...(nu ? [M * up.plane, c] : [M * c, up.plane]), H.eave), dir(nu, nd), { width: 3, height: 3, material: roof, wall, window: null })
        timberWindow(up, c, 1, H.eave + 1, 2, 0)
      }
  }

  // ---------------------------------------------------------------- the tower
  if (towerR) {
    const TH = tower.height
    const tRuns = runsOf(new Set([...G].filter(k => inTower(...k.split(',').map(Number)))))
    for (const r of tRuns) {
      for (let s = r.s0; s <= r.s1; s += 1) {
        for (let h = H.course + 1; h <= TH; h += 1) {
          rset(r, s, 0, h, P.masonry)
          rset(r, s, -1, h, P.masonry)
        }
        for (let h = H.course; h < TH - 2; h += 6) rset(r, s, 1, h, st(trim, r.in, 'top'), { keep: true })
        rset(r, s, 1, TH, st(trim, r.in, 'top'))
        rset(r, s, 1, TH + 1, P.dressed)
      }
      for (const [end, step] of [[r.s0, 1], [r.s1, -1]]) {
        const [cu, cd] = r.cell(end - step, 1)
        set(cu, cd, TH, P.dressed)
        set(cu, cd, TH + 1, P.dressed)
        for (let h = H.course + 6; h < TH - 2; h += 6) set(cu, cd, h, st(trim, r.in, 'top'), { keep: true })
        for (let h = H.course + 1; h < TH; h += 1) {
          rset(r, end, 0, h, P.dressed)
          if ((h + (r.axis === 'u' ? 0 : 1)) % 2 === 0) rset(r, end + step, 0, h, P.dressed)
        }
      }
      // a window per storey where the face is open air: lancets, then a paired light at the top
      const mid = Math.round((r.s0 + r.s1) / 2)
      for (const [h0, w] of [[9, 1], [15, 1], [TH - 4, 2]]) {
        if (h0 + 3 > TH - 1 || (w === 1 && h0 + 3 > TH - 5)) continue
        const s = w === 2 ? mid - (r.n[0] + r.n[1] > 0 ? 0 : 1) : mid
        let open = true
        for (let i = -1; i <= w; i += 1) for (let h = h0 - 1; h <= h0 + 3; h += 1) if (rget(r, s + i, 1, h)) open = false
        if (!open) continue
        stoneWindow(r, s, w, h0, 3, false)
      }
    }
    for (let u = towerR.u0 + 2; u <= towerR.u1 - 2; u += 1)
      for (let d = towerR.d1 + 2; d <= towerR.d0 - 2; d += 1) for (let h = 14; h < TH - 4; h += 5) set(u, d, h, 'minecraft:spruce_planks')
    // a steep pyramid roof over the corbelled top, flared at the eave, a finial
    const spire = b.roof({ ...worldRect(towerR.u0 - 1, towerR.u1 + 1, towerR.d0 + 1, towerR.d1 - 1), y: pos[1] + TH + 2, type: 'pyramid', material: roof, pitch: [1, 2, 2, 3], overhang: 1, eaveTrim: true })
    const tc = L.at(M * ((towerR.u0 + towerR.u1) >> 1), (towerR.d0 + towerR.d1) >> 1, 0)
    b.set(tc[0], spire.topY + 1, tc[2], 'minecraft:lightning_rod[facing=up]')
  }

  // ---------------------------------------------------------------- the porch: arch, vestibule, door, steps
  if (porchR) {
    const c = pc
    const f = porchR.d0
    for (let u = c - 1; u <= c + 1; u += 1) {
      for (let d = 1; d <= f; d += 1) for (let h = 3; h < H.course; h += 1) set(u, d, h, 'minecraft:air')
      for (let d = 1; d <= f; d += 1) set(u, d, H.floor, d >= f - 1 ? 'minecraft:polished_andesite' : 'minecraft:spruce_planks')
    }
    for (const d of [f, f - 1]) {
      set(c - 1, d, 6, st(trim, dir(-1, 0), 'top'))
      set(c + 1, d, 6, st(trim, dir(1, 0), 'top'))
      for (let u = c - 1; u <= c + 1; u += 1) set(u, d, H.course, P.dressed)
    }
    // the arch ring in dressed stone, 1 proud, a keystone
    for (let h = 3; h <= 6; h += 1) for (const u of [c - 2, c + 2]) { set(u, f, h, P.dressed); set(u, f + 1, h, P.dressed) }
    for (let u = c - 2; u <= c + 2; u += 1) set(u, f + 1, H.course, u === c ? 'minecraft:chiseled_stone_bricks' : st(trim, L.back, 'top'))
    for (const u of [c - 1, c + 1]) set(u, f + 1, 6, st(trim, dir(u - c, 0), 'top'))
    set(c, f + 1, 7, 'minecraft:chiseled_stone_bricks')
    // the door at the back of the vestibule under a transom, a lantern, a beamed ceiling
    for (let u = c - 1; u <= c + 1; u += 1) for (let h = 3; h <= H.course; h += 1) set(u, 0, h, P.dressed)
    set(c, 0, 3, `minecraft:${frame}_door[facing=${L.out},half=lower,hinge=left]`)
    set(c, 0, 4, `minecraft:${frame}_door[facing=${L.out},half=upper,hinge=left]`)
    set(c, 0, 5, GLASS)
    set(c, -1, 5, BACKING)
    for (let d = 1; d <= f - 2; d += 1) for (let u = c - 1; u <= c + 1; u += 1) set(u, d, H.course, log(L.deep))
    set(c, 2, 6, 'minecraft:lantern[hanging=true]')
    for (const u of [c - 1, c + 1]) set(u, 2, 3, st('spruce', dir(c - u, 0)))
    // a window over the arch, in the jettied porch front
    const pr = upperRuns.find(r => r.n[1] === 1 && r.plane === f + 1)
    if (pr) timberWindow(pr, c - 1, 3)
    // steps: two broad stairs up to the porch floor between cheeks with lanterns
    for (let u = c - 2; u <= c + 2; u += 1) {
      set(u, f + 2, 1, P.plinth)
      set(u, f + 2, 2, st(trim, L.back))
      set(u, f + 3, 1, st(trim, L.back))
      set(u, f + 1, 2, 'minecraft:polished_andesite')
    }
    for (const u of [c - 3, c + 3]) {
      for (const d of [f + 1, f + 2, f + 3]) { set(u, d, 1, P.plinth); set(u, d, 2, P.plinth) }
      set(u, f + 3, 3, `${fam(trim).wall}`)
      set(u, f + 3, 4, 'minecraft:lantern')
      set(u, f + 2, 3, `${fam(trim).slab}[type=bottom]`)
      set(u, f + 1, 3, `${fam(trim).slab}[type=bottom]`)
    }
  }

  // ---------------------------------------------------------------- the bay window on the wing front
  // Two storeys, 5 wide, 2 out: stone below, timber above, glass all round, a hipped cap.
  if (bay) {
    const f = bay.d
    for (let u = bay.u0; u <= bay.u1; u += 1)
      for (let k = 1; k <= 2; k += 1) {
        const corner = (u === bay.u0 || u === bay.u1) && k === 2
        const side = (u === bay.u0 || u === bay.u1) && k === 1
        const face = k === 2 || side
        for (let h = -1; h <= 2; h += 1) set(u, f + k, h, P.plinth)
        set(u, f + k, 3, face ? P.dressed : 'minecraft:spruce_planks')
        for (let h = 4; h <= 6; h += 1) set(u, f + k, h, corner ? P.masonry : face ? GLASS : 'minecraft:air')
        set(u, f + k, H.course, P.dressed)
        set(u, f + k, H.beam, face ? log(k === 2 ? L.across : L.deep) : 'minecraft:spruce_planks')
        for (let h = H.beam + 1; h < H.plate; h += 1) set(u, f + k, h, corner ? log('y') : face ? GLASS : 'minecraft:air')
        set(u, f + k, H.plate, face ? log(k === 2 ? L.across : L.deep) : 'minecraft:spruce_planks')
      }
    for (let u = bay.u0; u <= bay.u1; u += 1) for (let h = 3; h < H.plate; h += 1) if (h !== H.course && h !== H.beam) set(u, f, h, 'minecraft:air')
    for (let h = 4; h <= 6; h += 1) set(wc, f + 2, h, `${fam(trim).wall}`)
    for (let h = H.beam + 1; h < H.plate; h += 1) set(wc, f + 2, h, log('y'))
    for (let u = bay.u0; u <= bay.u1; u += 1) set(u, f + 3, 2, st(trim, L.back))
    // the cap: a little hipped roof of the main slates under the gable
    b.roof({ ...worldRect(bay.u0, bay.u1, f + 2, f + 1), y: pos[1] + H.eave, type: 'hip', material: roof, pitch: 1, overhang: 1, eaveTrim: true, overwrite: false })
  }

  // ---------------------------------------------------------------- chimneys
  // An outside stack on the wing's side: 4 wide at the foot, weathered in to 2, up through the eave
  // to 1 over the wing ridge; and a 3 x 2 stack on the main ridge. Each ends in a dressed band, a
  // smoking flue (a campfire) and brick pots on the other flues.
  const chimneyTop = (cells, h) => {
    cells.forEach(([u, d], i) => {
      set(u, d, h, P.dressed)
      set(u, d, h + 1, i === 0 ? 'minecraft:campfire[lit=true,signal_fire=false]' : i % 2 ? 'minecraft:brick_wall' : P.brick)
    })
  }
  if (stack) {
    const ridge = H.eave + 8
    for (let d = stack.d1; d <= stack.d0; d += 1) {
      for (let h = -1; h <= 7; h += 1) for (const k of [1, 2]) set(stack.u + k, d, h, P.brick)
      set(stack.u + 2, d, 8, st('brick', dir(-1, 0)))
    }
    for (const d of [stack.d1, stack.d0]) set(stack.u + 1, d, 8, st('brick', dir(0, d === stack.d1 ? 1 : -1)))
    const flue = []
    for (let d = stack.d1 + 1; d <= stack.d0 - 1; d += 1) {
      for (let h = 8; h < ridge; h += 1) for (const k of [0, 1]) set(stack.u + k, d, h, P.brick)
      for (const k of [0, 1]) flue.push([stack.u + k, d])
    }
    chimneyTop(flue, ridge)
  }
  {
    const cu = Math.round(-W2 / 2)
    const cd = Math.round(back / 2)
    const top = H.eave + 12
    const flue = []
    for (const u of [cu - 1, cu, cu + 1]) for (const d of [cd, cd + 1]) {
      for (let h = H.beam; h < top; h += 1) set(u, d, h, P.brick)
      flue.push([u, d])
    }
    chimneyTop(flue, top)
  }

  // roof texture: clumps of an older and a darker neighbour of the roof material
  const aged = AGED_ROOF[roof]
  if (aged) {
    const m = kit.material(roof)
    const lo = worldRect(-60, 60, 60, -60)
    b.weather([lo.x0, pos[1] + H.eave - 2, lo.z0], [lo.x1, pos[1] + 40, lo.z1], {
      share: 0.18, scale: 4, seed, mossBias: 0.7,
      variants: {
        [m.stairs]: aged.map(a => kit.material(a).stairs),
        [m.block]: aged.map(a => kit.material(a).block),
      },
    })
  }

  // ---------------------------------------------------------------- the garden
  if (garden && porchR) {
    const c = pc
    const f = porchR.d0 + 4 // first row in front of the steps
    const pave = kit.palette({ polished_andesite: 5, andesite: 2, stone: 1 }, { scale: 3, seed: seed + 7 })
    const court = { u0: c - 6, u1: c + 6, d0: f + 9, d1: f }
    for (let u = court.u0; u <= court.u1; u += 1)
      for (let d = court.d1; d <= court.d0; d += 1) {
        const rim = u === court.u0 || u === court.u1 || d === court.d0
        set(u, d, 0, rim ? 'minecraft:stone_bricks' : pave)
      }
    for (let d = court.d0 + 1; d <= court.d0 + 12; d += 1) for (let u = c - 2; u <= c + 2; u += 1) set(u, d, 0, Math.abs(u - c) === 2 ? 'minecraft:stone_bricks' : pave)
    // a low round bed in the middle of the court (low, so it never hides the door from the path)
    const mc = [c, (court.d0 + court.d1) >> 1]
    for (let u = c - 2; u <= c + 2; u += 1)
      for (let d = mc[1] - 2; d <= mc[1] + 2; d += 1) {
        const r = Math.hypot(u - c, d - mc[1])
        if (r > 2.3) continue
        if (r > 1.5) set(u, d, 1, `${fam(trim).slab}[type=bottom]`)
        else {
          set(u, d, 0, 'minecraft:rooted_dirt')
          set(u, d, 1, r < 0.5 ? 'minecraft:flowering_azalea' : (u + d) % 2 ? 'minecraft:allium' : 'minecraft:cornflower')
        }
      }
    // hedges along the sides of the court, lamps at its corners
    const hedge = kit.palette({ azalea_leaves: 3, oak_leaves: 2, flowering_azalea_leaves: 1 }, { scale: 2, seed: seed + 8 })
    for (const u of [court.u0 - 1, court.u1 + 1]) for (let d = court.d1; d <= court.d0; d += 1) set(u, d, 1, hedge)
    for (const u of [court.u0 - 1, court.u1 + 1])
      for (const d of [court.d1, court.d0]) {
        set(u, d, 1, `${fam(trim).wall}`)
        set(u, d, 2, 'minecraft:spruce_fence')
        set(u, d, 3, 'minecraft:spruce_fence')
        set(u, d, 4, 'minecraft:lantern')
      }
    // beds of clumped flowers along the front walls, kept off the paths and the steps
    const flowers = kit.palette({ rose_bush: 2, peony: 2, lilac: 1, allium: 2, cornflower: 2, oxeye_daisy: 2, azalea_leaves: 3 }, { scale: 2, seed: seed + 9 })
    const busy = new Set()
    for (let u = court.u0 - 1; u <= court.u1 + 1; u += 1) for (let d = court.d1 - 4; d <= court.d0 + 12; d += 1) busy.add(K(u, d))
    for (const r of groundRuns) {
      if (r.n[1] < 0) continue
      for (let s = r.s0 - 1; s <= r.s1 + 1; s += 1) {
        const [u, d] = r.cell(s, 2)
        if (busy.has(K(u, d)) || G.has(K(u, d)) || get(u, d, 1) || get(u, d, 0)?.name !== 'minecraft:grass_block') continue
        busy.add(K(u, d))
        set(u, d, 0, 'minecraft:rooted_dirt')
        const p = flowers(...L.at(M * u, d, 1))
        if (TALL.test(p)) { set(u, d, 1, `minecraft:${p}[half=lower]`); set(u, d, 2, `minecraft:${p}[half=upper]`) } else set(u, d, 1, `minecraft:${p}`)
      }
    }
  }
  return { main, wing: wingR, tower: towerR, porch: porchR }
}

// The small sibling: a 2-storey house in the same language, no wing, no tower (cottage scale).
export function house(ctx, pos, facing, opts = {}) {
  return hall(ctx, pos, facing, { width: 13, depth: 8, wing: false, tower: false, porch: { width: 5, depth: 3 }, garden: false, ...opts })
}

// DON'T: the big box, the same footprint as the hall: flat plank walls, a flat roof, flush glass
function bigBox(ctx, [x0, y, z0], [x1, z1], h = 12) {
  const { b } = ctx
  for (let x = x0; x <= x1; x += 1)
    for (let z = z0; z <= z1; z += 1) {
      const wall = x === x0 || x === x1 || z === z0 || z === z1
      if (wall) for (let k = 1; k <= h; k += 1) b.set(x, y + k, z, 'minecraft:oak_planks')
      b.set(x, y + h + 1, z, 'minecraft:oak_planks')
    }
  for (let x = x0 + 1; x < x1; x += 1) for (const k of [4, 5, 9, 10]) b.set(x, y + k, z1, 'minecraft:glass')
  for (let z = z0 + 1; z < z1; z += 1) for (const k of [4, 5, 9, 10]) b.set(x1, y + k, z, 'minecraft:glass')
  const door = (x0 + x1) >> 1
  b.set(door, y + 1, z1, 'minecraft:oak_door[facing=south,half=lower]')
  b.set(door, y + 2, z1, 'minecraft:oak_door[facing=south,half=upper]')
}

export const figure = { size: 64, height: 44, floorY: 3, camera: { eye: [49, 9, 60], lookAt: [25, 15, 26], fov: 50, width: 640, height: 430 } }
export function demo(ctx, which) {
  groundPatch(ctx)
  const { FY } = ctx
  if (which === 'good') hall(ctx, [26, FY, 27], 'south', { seed: 2 })
  else bigBox(ctx, [8, FY, 16], [42, 33])
}
