// WALLS AND TOWERS (a town wall round the spawn, a castle curtain, the edge of a PvP arena). Read
// this, look at img/walls.png, then design your own for the theme: its height, thickness, the
// rhythm of its towers and their tops. A wall is a building 60-200 blocks long: it needs the same
// care as a hall (a base, a body, a top; depth in layers; a rhythm; one hero, the gatehouse).
//
// DO
// - Thick and tall: a curtain 6-10 high above the ground and 3-4 thick, so a wall-walk runs on top
//   behind the parapet; foundations 3+ below the lowest ground so it never floats.
// - A battered (sloped) foot: the bottom 3-4 courses step out 1-2 with stair tops; the base darkest
//   (deepslate, tuff, mossy cobble), the body mid, the top cleanest (a clumped gradient by height).
// - A parapet 1 out on corbels (machicolations: a corbel on every other block, the gaps dark from
//   below), a breastwork 1 high, merlons 2 high in a 2-on 1-off beat, slab sills in the embrasures.
// - Break the long face: a pilaster-buttress every 8-10 rising into the parapet, an arrow slit
//   (1 x 3, through 2 layers so it reads dark) in each bay between them.
// - Towers every 20-30 blocks and at every corner and end, projecting 2/3 of their width outside the
//   wall, 5-8 taller than the walk: round (d 9-11) or square (7-9), with a batter, string courses,
//   slits on the rays, and a top of their own (a cone on a corbelled parapet, an open crenellated
//   deck, a pyramid); vary the tops along one wall, never all the same.
// - Follow the ground: the walk level is the smoothed ground + the height, so it climbs a hill in
//   1-block steps (stairs on the walk); the batter follows each column's own ground.
// DON'T
// - The fence: a 1-thick flat cobblestone wall, a row of single blocks on top, random gaps, the
//   top copying every bump of the ground, no towers, no walk, no base.
// - Towers flush with the wall, all one height and one top; crenellations on both edges of the walk
//   (they go on the outer edge only); a wall that ends in the air (end it in a tower or a gate).

// the facing nearest to a direction (x east, z south)
const FACE = ([dx, dz]) => (Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : (dz > 0 ? 'south' : 'north'))

function materials(kit, { foot, body, crown, dressed, floor, seed = 1 }) {
  return {
    foot: kit.palette(foot, { scale: 3, seed }),
    body: kit.palette(body, { scale: 4, seed: seed + 1 }),
    crown: kit.palette(crown, { scale: 4, seed: seed + 2 }),
    dressed: kit.palette(dressed, { scale: 2, seed: seed + 3 }),
    floor: kit.palette(floor, { scale: 2, seed: seed + 4 }),
  }
}
const DEFAULTS = {
  foot: { cobbled_deepslate: 3, tuff: 3, cobblestone: 2, mossy_cobblestone: 1 },
  body: { stone_bricks: 7, andesite: 2, cracked_stone_bricks: 1 },
  crown: { stone_bricks: 6, andesite: 2, polished_andesite: 1, cracked_stone_bricks: 1 },
  dressed: { stone_bricks: 4, polished_andesite: 2 },
  floor: { stone_bricks: 3, polished_andesite: 2, cobblestone: 1 },
}
// masonry by height in the wall: the foot palette low, the body, the crown palette high (dithered)
const masonryAt = (M, kit, ground, top) => kit.gradient([M.foot, M.body, M.body, M.body, M.crown], { t: (x, y, z) => (y - ground(x, z) + 1.5) / Math.max(4, top(x, z) - ground(x, z) + 2), dither: 0.3, scale: 3 })

// A curtain wall along a polyline. points = [[x, z], ...] (world), the wall's OUTER FACE line;
// out = 'left' | 'right': the outside as you walk from the first point to the last.
//   height     walk floor above the (smoothed) ground (7)       thickness   the body (3)
//   towers     { every: 30 (the most blocks between two), project, list: [{ t, shape, r, rise, top, roof, banner }] }
//              or false; by default one at each end and corner, more where a run is longer
//   foot, body, crown, dressed, floor: palettes (base, field, top courses, trim blocks, walk);
//   trim: the stairs family; roof: the tower roofs (each tower's own `roof` in the list wins);
//   banner: the flags' colour (the theme's accent; false for none)
//   ground     (x, z) => y of the ground (default b.groundY: build the terrain first)
// Returns { length, at(t) → { x, z, G, W, nx, nz }, towers }.
export function wall(ctx, points, opts = {}) {
  const { b, kit } = ctx
  const {
    out = 'left', height = 7, thickness = 3, trim = 'stone_brick', roof = 'deepslate_tile', seed = 1,
    towers = { every: 30 }, buttressEvery = 9,
  } = opts
  const M = materials(kit, { ...DEFAULTS, ...opts, seed })
  const T = thickness
  // the ground as it was before the wall: snapshot it now (once the wall stands on a column,
  // b.groundY no longer finds the grass under it, and a tower built later would sink)
  let groundOf = opts.ground
  if (!groundOf) {
    const snap = new Map()
    const xs0 = points.map(p => p[0])
    const zs0 = points.map(p => p[1])
    for (let x = Math.floor(Math.min(...xs0)) - T - 12; x <= Math.ceil(Math.max(...xs0)) + T + 12; x += 1)
      for (let z = Math.floor(Math.min(...zs0)) - T - 12; z <= Math.ceil(Math.max(...zs0)) + T + 12; z += 1) snap.set(`${x},${z}`, b.groundY(x, z))
    // (where something already stands, b.groundY finds no ground: the ground under it then)
    groundOf = (x, z) => {
      const g = snap.get(`${x},${z}`) ?? b.groundY(x, z)
      return g >= 0 ? g : b.groundUnder(x, z)
    }
  }
  // ------------------------------------------------------------ the line: segments, arc length
  const segs = []
  let length = 0
  for (let i = 0; i + 1 < points.length; i += 1) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const s = out === 'left' ? 1 : -1
    segs.push({ ax, az, dx: (bx - ax) / len, dz: (bz - az) / len, len, t0: length, nx: (s * (bz - az)) / len, nz: (-s * (bx - ax)) / len })
    length += len
  }
  const near = (x, z) => {
    let best = null
    for (const g of segs) {
      const u = Math.max(0, Math.min(g.len, (x - g.ax) * g.dx + (z - g.az) * g.dz))
      const px = g.ax + u * g.dx
      const pz = g.az + u * g.dz
      const d = Math.hypot(x - px, z - pz)
      if (best && d >= best.d - 1e-6) continue
      const side = (x - px) * g.nx + (z - pz) * g.nz
      best = { d, t: g.t0 + u, o: side >= 0 ? d : -d, nx: g.nx, nz: g.nz }
    }
    return best
  }
  const at = t => {
    const g = segs.find(q => t <= q.t0 + q.len + 1e-6) ?? segs[segs.length - 1]
    const u = Math.max(0, Math.min(g.len, t - g.t0))
    const x = g.ax + u * g.dx
    const z = g.az + u * g.dz
    return { x, z, nx: g.nx, nz: g.nz, dx: g.dx, dz: g.dz, G: groundOf(Math.round(x), Math.round(z)), W: walkAt(t) }
  }
  // the walk follows the ground smoothed over 11 blocks, so it climbs in whole steps
  const prof = []
  for (let t = 0; t <= Math.ceil(length); t += 1) {
    const g = segs.find(q => t <= q.t0 + q.len + 1e-6) ?? segs[segs.length - 1]
    const u = Math.max(0, Math.min(g.len, t - g.t0))
    const x = g.ax + u * g.dx - g.nx * (T / 2)
    const z = g.az + u * g.dz - g.nz * (T / 2)
    prof.push(groundOf(Math.round(x), Math.round(z)))
  }
  const walkAt = t => {
    const i = Math.max(0, Math.min(prof.length - 1, Math.round(t)))
    let sum = 0
    let n = 0
    for (let k = i - 5; k <= i + 5; k += 1) if (k >= 0 && k < prof.length) { sum += prof[k]; n += 1 }
    return Math.round(sum / n) + height
  }

  // ------------------------------------------------------------ the cells of the wall
  const xs = points.map(p => p[0])
  const zs = points.map(p => p[1])
  const cells = []
  const byKey = new Map()
  for (let x = Math.floor(Math.min(...xs)) - T - 3; x <= Math.ceil(Math.max(...xs)) + T + 3; x += 1)
    for (let z = Math.floor(Math.min(...zs)) - T - 3; z <= Math.ceil(Math.max(...zs)) + T + 3; z += 1) {
      const n = near(x, z)
      if (!n || n.o <= -T || n.o > 2) continue
      // the line's ends: no wall past them (a tower or a gate closes them)
      if (n.t <= 0.01 && segs[0] && ((x - segs[0].ax) * segs[0].dx + (z - segs[0].az) * segs[0].dz) < -0.5) continue
      const last = segs[segs.length - 1]
      if (n.t >= length - 0.01 && ((x - last.ax) * last.dx + (z - last.az) * last.dz) > last.len + 0.5) continue
      const c = { x, z, ...n, layer: n.o <= 0 ? 'body' : n.o <= 1 ? 'outer' : 'batter', G: groundOf(x, z), W: walkAt(n.t), tt: Math.round(n.t) }
      c.in = FACE([-n.nx, -n.nz])
      cells.push(c)
      byKey.set(`${x},${z}`, c)
    }
  const masonry = masonryAt(M, kit, (x, z) => byKey.get(`${x},${z}`)?.G ?? 0, (x, z) => byKey.get(`${x},${z}`)?.W ?? 8)
  const st = (f, half = 'bottom', mat = trim) => `${kit.material(mat).stairs}[facing=${f},half=${half}]`
  const slab = (type = 'bottom') => `${kit.material(trim).slab}[type=${type}]`
  const isButtress = tt => buttressEvery > 0 && tt > 4 && tt < length - 4 && (tt % buttressEvery === 0 || tt % buttressEvery === 1)
  const isSlit = tt => buttressEvery > 0 && tt > 4 && tt < length - 4 && tt % buttressEvery === Math.floor(buttressEvery / 2) + 1
  const merlon = tt => tt % 3 !== 2

  for (const c of cells) {
    const { x, z, G, W, tt } = c
    const base = Math.min(G, W - height) - 3
    if (c.layer === 'body') {
      for (let y = base; y < W; y += 1) b.set(x, y, z, masonry)
      b.set(x, W, z, M.floor)
      // an arrow slit through the two outer layers of the body, between the buttresses
      if (isSlit(tt) && c.o > -2) {
        const mid = Math.round((G + W) / 2)
        for (let y = mid - 1; y <= mid + 1; y += 1) b.set(x, y, z, 'minecraft:air')
        if (c.o > -1) {
          b.set(x, mid - 2, z, M.dressed)
          b.set(x, mid + 2, z, M.dressed)
        }
      }
    } else if (c.layer === 'outer') {
      // the batter course, then the parapet on its corbels (machicolations between them)
      for (let y = base; y <= G + 2; y += 1) b.set(x, y, z, masonry)
      if (isButtress(tt)) {
        for (let y = G + 3; y < W; y += 1) b.set(x, y, z, M.dressed)
      } else {
        b.set(x, G + 3, z, st(c.in))
        if (tt % 2 === 0) b.set(x, W - 1, z, st(c.in, 'top'))
      }
      b.set(x, W, z, M.dressed)
      b.set(x, W + 1, z, M.dressed)
      if (merlon(tt)) {
        b.set(x, W + 2, z, M.dressed)
        b.set(x, W + 3, z, M.dressed)
      } else b.set(x, W + 2, z, slab())
    } else {
      // the outer step of the batter
      for (let y = base; y <= G; y += 1) b.set(x, y, z, masonry)
      b.set(x, G + 1, z, isButtress(tt) ? masonry : st(c.in))
      if (isButtress(tt)) b.set(x, G + 2, z, st(c.in))
    }
  }
  // steps on the walk where it climbs a block
  for (const c of cells) {
    if (c.layer !== 'body') continue
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = byKey.get(`${c.x + dx},${c.z + dz}`)
      if (n && n.layer === 'body' && n.W === c.W + 1) {
        b.set(c.x, c.W + 1, c.z, st(FACE([dx, dz])))
        break
      }
    }
  }

  // ------------------------------------------------------------ towers
  const placed = []
  if (towers) {
    const every = towers.every ?? 30
    let list = towers.list
    if (!list) {
      const ts = [0, length]
      for (const g of segs) if (g.t0 > 0) ts.push(g.t0)
      ts.sort((p, q) => p - q)
      list = []
      for (let i = 0; i < ts.length; i += 1) {
        list.push({ t: ts[i] })
        if (i + 1 < ts.length) {
          const n = Math.ceil((ts[i + 1] - ts[i]) / every) - 1
          for (let k = 1; k <= n; k += 1) list.push({ t: ts[i] + ((ts[i + 1] - ts[i]) * k) / (n + 1) })
        }
      }
    }
    // by default the towers take turns: round with a cone, round and crenellated, square with a
    // pyramid; and four heights over the walk, so no two neighbours are alike
    list.forEach((spec, i) => {
      const p = at(spec.t)
      const shape = spec.shape ?? (i % 3 === 2 ? 'square' : 'round')
      const r = spec.r ?? (shape === 'round' ? 4.5 : 4)
      const proj = spec.project ?? towers.project ?? Math.round(r - 1.5)
      const cx = Math.round(p.x + p.nx * proj - p.nx * (T / 2))
      const cz = Math.round(p.z + p.nz * proj - p.nz * (T / 2))
      const top = spec.top ?? (shape === 'square' ? 'pyramid' : i % 3 === 1 ? 'crenel' : 'cone')
      const rise = spec.rise ?? [6, 8, 5, 7][i % 4]
      const tw = tower(ctx, [cx, groundOf(cx, cz), cz], {
        shape, r, top, walk: p.W, height: p.W - groundOf(cx, cz) + rise, roof: spec.roof ?? roof, trim, banner: spec.banner ?? opts.banner ?? 'red', seed: seed + i,
        out: FACE([p.nx, p.nz]), ground: groundOf, foot: opts.foot, body: opts.body, crown: opts.crown, dressed: opts.dressed, floor: opts.floor,
      })
      placed.push(tw)
    })
    // doorways from the walk into each tower: the walk's middle line, 2 high
    for (const tw of placed)
      for (const c of cells) {
        if (c.layer !== 'body' || Math.abs(c.o + T / 2 - 0.5) > 0.6) continue
        if (!tw.inShell(c.x, c.z)) continue
        b.set(c.x, c.W + 1, c.z, 'minecraft:air')
        b.set(c.x, c.W + 2, c.z, 'minecraft:air')
        b.set(c.x, c.W, c.z, M.floor)
      }
  }
  return { length, at, towers: placed }
}

// A tower. pos = [x, y, z]: the ground under its centre.
//   shape 'round' (r = radius, 4.5 gives d 9) | 'square' (r = half side, 4 gives 9 x 9)
//   height    top deck above the ground (the parapet sits on it)
//   walk      the wall-walk level that runs into it (a floor there)
//   top       'cone' (a cone over a corbelled parapet) | 'crenel' (an open deck behind merlons)
//             | 'pyramid' (square towers: a steep pyramid over the parapet)
//   out       the facing of the outside (its slits look that way)
//   banner    the colour of the flag on a 'crenel' deck (the theme's accent; false for none)
//   roof, trim, foot, body, crown, dressed, floor, ground, seed: as for wall()
// Returns { x, z, top, inShell(x, z) }.
export function tower(ctx, pos, opts = {}) {
  const { b, kit } = ctx
  const { shape = 'round', r = 4.5, height = 14, walk, top = 'cone', roof = 'deepslate_tile', trim = 'stone_brick', out = 'south', banner = 'red', seed = 1 } = opts
  const M = materials(kit, { ...DEFAULTS, ...Object.fromEntries(['foot', 'body', 'crown', 'dressed', 'floor'].filter(k => opts[k]).map(k => [k, opts[k]])), seed })
  const [cx, gy, cz] = pos
  const TOP = gy + height
  const dist = shape === 'round' ? (x, z) => Math.hypot(x - cx, z - cz) : (x, z) => Math.max(Math.abs(x - cx), Math.abs(z - cz))
  const R = shape === 'round' ? r : Math.round(r)
  const ground = opts.ground ?? ((x, z) => {
    const g = b.groundY(x, z)
    return g >= 0 ? g : Math.max(b.groundUnder(x, z), pos[1])
  })
  const masonry = kit.gradient([M.foot, M.body, M.body, M.body, M.crown], { t: (x, y) => (y - gy + 1.5) / (height + 2), dither: 0.3, scale: 3 })
  const st = (f, half = 'bottom') => `${kit.material(trim).stairs}[facing=${f},half=${half}]`
  const inward = (x, z) => FACE([cx - x, cz - z])
  const ring = (lo, hi) => {
    const list = []
    const n = Math.ceil(hi) + 1
    for (let x = cx - n; x <= cx + n; x += 1) for (let z = cz - n; z <= cz + n; z += 1) {
      const d = dist(x, z)
      if (d > lo && d <= hi) list.push([x, z, Math.atan2(z - cz, x - cx)])
    }
    return list.sort((p, q) => p[2] - q[2])
  }
  const shell = ring(R - 2, R)
  const core = ring(-1, R - 2)
  const low = Math.min(...[...shell, ...ring(R, R + 2)].map(([x, z]) => ground(x, z))) - 3
  // the shell, 2 thick, from the foundation to the deck
  for (const [x, z] of shell) for (let y = low; y <= TOP; y += 1) b.set(x, y, z, masonry)
  // quoins on square towers
  if (shape === 'square') for (const [x, z] of shell) if (Math.abs(x - cx) === R && Math.abs(z - cz) === R) for (let y = gy + 3; y <= TOP; y += 1) b.set(x, y, z, M.dressed)
  // the inside: floors at the ground, the walk, the deck; empty between
  for (const [x, z] of core) {
    for (let y = low; y <= gy; y += 1) b.set(x, y, z, masonry)
    for (let y = gy + 1; y < TOP; y += 1) b.set(x, y, z, 'minecraft:air')
    if (walk !== undefined) b.set(x, walk, z, 'minecraft:spruce_planks')
    b.set(x, TOP, z, M.floor)
  }
  // the battered foot (+1 to 3 high, +2 to 1 high, stair tops), string courses every 6
  for (const [x, z] of ring(R, R + 1)) {
    const g = ground(x, z)
    for (let y = low; y <= g + 2; y += 1) b.set(x, y, z, masonry)
    b.set(x, g + 3, z, st(inward(x, z)))
    // (top slabs on round towers: a ring of stairs turns into a sawtooth of corner shapes)
    for (let y = gy + 9; y < TOP - 2; y += 6) b.set(x, y, z, shape === 'round' ? `${kit.material(trim).slab}[type=top]` : st(inward(x, z), 'top'))
  }
  for (const [x, z] of ring(R + 1, R + 2)) {
    const g = ground(x, z)
    for (let y = low; y <= g; y += 1) b.set(x, y, z, masonry)
    b.set(x, g + 1, z, st(inward(x, z)))
  }
  // slits on the rays toward the outside and the flanks, at two levels; a window high up
  const o = { east: 0, south: Math.PI / 2, west: Math.PI, north: -Math.PI / 2 }[out]
  for (const [a, y0, h] of [[o, gy + 5, 3], [o - 1.1, gy + 6, 3], [o + 1.1, gy + 6, 3], [o, TOP - 4, 2], [o + Math.PI * 0.75, TOP - 4, 2]]) {
    for (let k = R - 2.4; k <= R + 0.3; k += 0.25) {
      const x = Math.round(cx + Math.cos(a) * k)
      const z = Math.round(cz + Math.sin(a) * k)
      if (dist(x, z) <= R - 2) continue
      for (let y = y0; y < y0 + h; y += 1) b.set(x, y, z, 'minecraft:air')
    }
  }
  // the top: a corbel table (every other one: machicolations), the parapet 1 out, then the roof
  const lip = ring(R, R + 1)
  lip.forEach(([x, z], i) => {
    if (i % 2 === 0 || top === 'cone') b.set(x, TOP - 1, z, st(inward(x, z), 'top'))
    b.set(x, TOP, z, M.dressed)
    b.set(x, TOP + 1, z, M.dressed)
    if (top === 'crenel') {
      if (i % 2 === 0) b.set(x, TOP + 2, z, M.dressed)
    } else b.set(x, TOP + 2, z, M.dressed)
  })
  if (top === 'cone') {
    const pitch = [0.5, 1, 2, 2, 2, 3]
    b.coneRoof([cx, TOP + 3, cz], R + 1, { material: roof, pitch, overhang: 1, flare: false, finial: ['minecraft:lightning_rod[facing=up]'] })
  } else if (top === 'pyramid') {
    const n = Math.round(R) + 1
    const p = b.roof({ x0: cx - n, z0: cz - n, x1: cx + n, z1: cz + n, y: TOP + 3, type: 'pyramid', material: roof, pitch: [1, 2, 2, 3], overhang: 1, eaveTrim: true })
    b.set(cx, p.topY + 1, cz, 'minecraft:lightning_rod[facing=up]')
  } else {
    // an open deck: a flagpole with a banner in the middle
    b.set(cx, TOP + 1, cz, 'minecraft:spruce_fence')
    b.set(cx, TOP + 2, cz, 'minecraft:spruce_fence')
    b.set(cx, TOP + 3, cz, 'minecraft:spruce_fence')
    if (banner) b.set(cx, TOP + 4, cz, `minecraft:${banner}_banner[rotation=0]`)
  }
  return { x: cx, z: cz, top: TOP, inShell: (x, z) => dist(x, z) > R - 2.5 && dist(x, z) <= R + 0.5 }
}

// ---------------------------------------------------------------- the picture
// The stage: a flat meadow in front; the ground rises to the east along the wall and to the north
// behind it, so the wall has a slope to follow.
function hill(ctx) {
  const { b, kit, S, FY } = ctx
  const smooth = t => t * t * (3 - 2 * t)
  const ground = b.terrain({
    x0: 1, z0: 1, x1: S - 2, z1: S - 2, base: FY - 5,
    height: (x, z) => FY + 6 * smooth(Math.max(0, Math.min(1, (x - 16) / 60))) * Math.max(0, Math.min(1, (66 - z) / 14)) + 4 * smooth(Math.max(0, Math.min(1, (50 - z) / 32))) + 0.5 * kit.noise.fbm2(x, z, { scale: 22, seed: 5 }),
    layers: [{ depth: 1, paint: 'minecraft:grass_block' }, { depth: 3, paint: 'minecraft:dirt' }, { paint: 'minecraft:stone' }],
  })
  return ground
}
function meadow(ctx, ground) {
  const { b, kit, S } = ctx
  // a track along the foot of the wall (it leads the eye), boulders where the ground was cleared
  b.path([[2, 66], [30, 64], [60, 63], [86, 62], [94, 56]], { width: 3, jitter: 0.5, seed: 2, paint: kit.palette({ dirt_path: 4, coarse_dirt: 2, gravel: 1 }, { scale: 3, seed: 2 }) })
  for (const [x, z, r] of [[22, 58, 1.6], [50, 59, 1.3], [69, 57, 1.8], [86, 47, 1.4]])
    b.boulder([x, ground(x, z) + 0.6, z], [r * 1.3, r, r], kit.palette({ andesite: 3, stone: 2, cobblestone: 1, mossy_cobblestone: 1 }, { scale: 2, seed: x }), { mossTop: 'minecraft:moss_carpet' })
  // trees inside the wall, their crowns over the parapet: there is a town behind it
  // (b.tree takes a number for height: an [min, max] pair makes no tree)
  for (const [x, z, sp, h] of [[18, 40, 'pine', 17], [33, 36, 'spruce', 19], [46, 41, 'spruce', 16], [60, 33, 'pine', 21], [70, 42, 'spruce', 15]])
    b.tree([x, ground(x, z) + 1, z], sp, { seed: x, height: h, roots: 0 })
  b.scatter({ x0: 1, z0: 1, x1: S - 2, z1: S - 2, density: 0.22, seed: 4, paints: [[10, 'short_grass'], [2, 'tall_grass'], [1, 'fern'], [1, 'oxeye_daisy'], [1, 'cornflower'], [1, 'dandelion']] })
}
const LINE = [[8, 52], [78, 52], [78, 18]]

// DON'T: a 1-thick cobblestone fence along the same line, every bump copied, gaps
function fence(ctx, points, ground) {
  const { b, kit } = ctx
  for (let i = 0; i + 1 < points.length; i += 1) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const n = Math.ceil(Math.hypot(bx - ax, bz - az))
    for (let k = 0; k <= n; k += 1) {
      const x = Math.round(ax + ((bx - ax) * k) / n)
      const z = Math.round(az + ((bz - az) * k) / n)
      const g = ground(x, z)
      for (let y = g + 1; y <= g + 5; y += 1) if (kit.noise.hash01(x, y, z, 9) > 0.08) b.set(x, y, z, 'minecraft:cobblestone')
      if ((x + z) % 2 === 0) b.set(x, g + 6, z, 'minecraft:cobblestone')
    }
  }
}

export const figure = { size: 96, height: 50, floorY: 6, camera: { eye: [0.5, 26, 94.5], lookAt: [47, 16, 45], fov: 60, width: 640, height: 430 } }
export function demo(ctx, which) {
  const ground = hill(ctx)
  if (which === 'good') wall(ctx, LINE, { out: 'right', seed: 3, ground })
  else fence(ctx, LINE, ground)
  meadow(ctx, ground)
}
