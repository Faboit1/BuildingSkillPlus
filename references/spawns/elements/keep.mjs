// THE HERO: A CASTLE KEEP ON A CRAG. Read this, look at img/keep.png, then design this spawn's
// own hero: its silhouette, its height, the theme's stone. A keep is one hero among many (a statue,
// a cathedral, a giant tree, a lighthouse); what it teaches holds for all of them: big, layered,
// grown out of its ground, detailed at every scale.
//
// DO
// - A silhouette that reads from the spawn: a main mass, smaller masses round it (corner turrets,
//   a stair tower rising above the rest), and a roofscape with a spire that is the highest point.
//   60-120 tall from the plaza's level, 1.5-2 times every building round it.
// - Grown out of the ground: a natural crag (rock with strata, ledges, scree) under a battered
//   masonry plinth that steps out as it goes down and meets the rock; never a cube to stand on.
// - Depth on every face: pilaster buttresses, string courses at every storey, windows in groups
//   that get bigger as they climb (slits low down, paired arched windows high up), a corbelled
//   parapet with machicolations and merlons, turrets corbelled out from the corners.
// - A curtain wall round the crag's top, open to a forecourt, and a road that winds up the crag.
// - Lit at night (lanterns at the gate, glow in the high windows).
// DON'T
// - A cylinder in rings of two stones with a cone on top, standing on the flat.
// - A castle on a plain block of stone, or on a flat lawn with nothing under it.
// - One flat face: no buttresses, no courses, windows in a grid, a flat roof.

import { massif } from './cliffs.mjs'
import { tower } from './walls.mjs'

// keep(ctx, { cx, cz, y, crag, w, d, height, face, seed, ...materials })
//   cx, cz      the keep's centre; y the ground round the crag
//   crag        { height, radius } of the rock under it (false: the keep stands on y)
//   w, d        the main keep's footprint (odd); height its walls above the platform
//   face        the side toward the spawn: the gate, the road and the stair tower's view
// Returns { top, platform, gate: [x, y, z] }: the highest block, the platform level, the gate's
// threshold (for a portal mark or the road).
export function keep(ctx, { cx, cz, y = ctx.FY, crag = { height: 30, radius: 46 }, w = 21, d = 19, height = 44, face = 'south', seed = 1, foot = { cobbled_deepslate: 3, deepslate_bricks: 2, tuff_bricks: 1 }, body = { stone_bricks: 6, andesite: 2, cracked_stone_bricks: 1, tuff_bricks: 1 }, crown = { polished_andesite: 3, stone_bricks: 2 }, trim = 'stone_brick', roof = 'deepslate_tile' } = {}) {
  const { b, kit } = ctx
  const rng = kit.rng(seed * 53 + 9)
  const F = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }[face]
  const T = kit.material(trim)
  const footP = kit.palette(foot, { scale: 3, seed })
  const bodyP = kit.palette(body, { scale: 3, seed: seed + 1 })
  const crownP = kit.palette(crown, { scale: 3, seed: seed + 2 })
  const stair = (f, half = 'bottom') => `${T.stairs}[facing=${f},half=${half}]`
  const OUT = { '1,0': 'east', '-1,0': 'west', '0,1': 'south', '0,-1': 'north' }
  const IN = { east: 'west', west: 'east', south: 'north', north: 'south' }

  // 1. the crag: a natural rock with strata, ledges and scree (§5.6); its top is uneven
  const topY = crag ? massif(ctx, { cx, cz, y, height: crag.height, radius: crag.radius, face, seed: seed + 3, cave: false, trees: 3 }) : () => y
  const ground = (x, z) => {
    const t = topY(x, z)
    return t >= 0 ? t : y
  }
  // 2. the platform: a battered masonry plinth that fills up to one level over the crag's top and
  // steps out as it goes down, until it meets the rock (or the ground)
  const Rc = Math.ceil(Math.hypot(w, d) / 2) + 7 // the compound inside the curtain
  // the platform is cut into the rock at a level most of the crag's top reaches (its 60th
  // percentile): the rock above it inside the compound is quarried away, the hollows below are
  // filled with masonry; the crag stays rock all round
  const tops = []
  for (let dz = -Rc; dz <= Rc; dz += 1) for (let dx = -Rc; dx <= Rc; dx += 1) if (Math.hypot(dx, dz) <= Rc) tops.push(ground(cx + dx, cz + dz))
  tops.sort((p, q) => p - q)
  const P = Math.max(y + 1, tops[Math.floor(tops.length * 0.6)] + 1)
  for (let dz = -Rc - 1; dz <= Rc + 1; dz += 1)
    for (let dx = -Rc - 1; dx <= Rc + 1; dx += 1) {
      if (Math.hypot(dx, dz) > Rc + 1) continue
      for (let yy = P + 1; yy <= P + 60; yy += 1) if (b.get(cx + dx, yy, cz + dz)) b.remove(cx + dx, yy, cz + dz)
    }
  const skirt = 3
  for (let dz = -Rc - skirt; dz <= Rc + skirt; dz += 1)
    for (let dx = -Rc - skirt; dx <= Rc + skirt; dx += 1) {
      const r = Math.hypot(dx, dz) + 0.6 * kit.noise.fbm2(cx + dx, cz + dz, { scale: 6, seed })
      if (r > Rc + skirt) continue
      // the batter: the plinth's top falls 3 a block outside the compound's edge
      const t = r <= Rc ? P : P - Math.ceil((r - Rc) * 3)
      const g = Math.min(ground(cx + dx, cz + dz), P)
      for (let yy = g + 1; yy <= t; yy += 1) b.set(cx + dx, yy, cz + dz, yy > t - 1 && r <= Rc ? crownP : footP)
    }
  // 3. the curtain: a parapet round the platform's edge (merlons 2-on 1-off), open at the front
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180
    const x = Math.round(cx + Math.cos(rad) * Rc)
    const z = Math.round(cz + Math.sin(rad) * Rc)
    const front = Math.cos(rad) * F[0] + Math.sin(rad) * F[1] > 0.93 // the gate's gap
    if (front) continue
    b.set(x, P + 1, z, bodyP)
    b.set(x, P + 2, z, bodyP)
    if (a % 3 !== 2) b.set(x, P + 3, z, crownP)
  }
  // 4. the keep's walls: a stepped plinth, the body in storeys of 7, buttresses, courses
  const x0 = cx - Math.floor(w / 2)
  const x1 = x0 + w - 1
  const z0 = cz - Math.floor(d / 2)
  const z1 = z0 + d - 1
  const H = height
  const onEdge = (x, z) => x === x0 || x === x1 || z === z0 || z === z1
  const outward = (x, z) => (x === x0 ? 'west' : x === x1 ? 'east' : z === z0 ? 'north' : 'south')
  for (let h = 1; h <= H; h += 1)
    for (let x = x0; x <= x1; x += 1)
      for (let z = z0; z <= z1; z += 1) {
        if (!onEdge(x, z)) continue
        b.set(x, P + h, z, h <= 4 ? footP : h >= H - 2 ? crownP : bodyP)
      }
  // the plinth steps out 2, then 1, at the foot of the keep, a stair course on each step
  for (const [k, top] of [[2, 2], [1, 4]])
    for (let x = x0 - k; x <= x1 + k; x += 1)
      for (let z = z0 - k; z <= z1 + k; z += 1) {
        const edge = x === x0 - k || x === x1 + k || z === z0 - k || z === z1 + k
        if (!edge) continue
        for (let h = 1; h < top; h += 1) b.set(x, P + h, z, footP)
        const ox = x < x0 ? 'west' : x > x1 ? 'east' : z < z0 ? 'north' : 'south'
        b.set(x, P + top, z, stair(IN[ox]))
      }
  // pilaster buttresses 1 proud every 5-6 along each face, up to the parapet
  const every = 6
  for (let x = x0; x <= x1; x += 1)
    for (let z = z0; z <= z1; z += 1) {
      if (!onEdge(x, z)) continue
      const along = x === x0 || x === x1 ? z - z0 : x - x0
      const corner = (x === x0 || x === x1) && (z === z0 || z === z1)
      if (corner || along % every !== 3) continue
      const o = outward(x, z)
      const [ox, oz] = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] }[o]
      for (let h = 4; h <= H - 3; h += 1) b.set(x + ox, P + h, z + oz, h % 7 === 0 ? stair(IN[o], 'top') : bodyP)
      b.set(x + ox, P + H - 2, z + oz, stair(IN[o]))
    }
  // string courses: a ring of upside-down stairs 1 out at every storey
  for (let h = 7; h < H - 2; h += 7)
    for (let x = x0 - 1; x <= x1 + 1; x += 1)
      for (let z = z0 - 1; z <= z1 + 1; z += 1) {
        const edge = x === x0 - 1 || x === x1 + 1 || z === z0 - 1 || z === z1 + 1
        if (!edge || ((x === x0 - 1 || x === x1 + 1) && (z === z0 - 1 || z === z1 + 1))) continue
        if (!b.get(x, P + h, z)) b.set(x, P + h, z, stair(IN[x < x0 ? 'west' : x > x1 ? 'east' : z < z0 ? 'north' : 'south'], 'top'))
      }
  // windows: per storey, between the buttresses; slits low, pairs higher, arched pairs at the top
  const glass = 'minecraft:gray_stained_glass'
  const dark = 'minecraft:polished_blackstone'
  for (let s = 1; s * 7 + 2 < H - 4; s += 1) {
    const h = s * 7 + 2
    const big = s >= 3
    for (let x = x0; x <= x1; x += 1)
      for (let z = z0; z <= z1; z += 1) {
        if (!onEdge(x, z) || ((x === x0 || x === x1) && (z === z0 || z === z1))) continue
        const along = x === x0 || x === x1 ? z - z0 : x - x0
        const m = along % every
        if (!(m === 0 || (big && m === 5 && along < (x === x0 || x === x1 ? d : w) - 1))) continue
        const [ix, iz] = { east: [-1, 0], west: [1, 0], south: [0, -1], north: [0, 1] }[outward(x, z)]
        const tall = s === 1 ? 2 : big ? 4 : 3
        for (let k = 0; k < tall; k += 1) {
          b.set(x, P + h + k, z, s === 1 ? 'minecraft:air' : glass)
          b.set(x + ix, P + h + k, z + iz, dark)
        }
        if (big) b.set(x, P + h + tall, z, stair(outward(x, z), 'top')) // a round head
        b.set(x - ix, P + h - 1, z - iz, `${T.slab}[type=top]`, { keep: true }) // the sill
      }
  }
  // 5. the corbelled parapet: corbels, machicolations, a parapet 1 out, merlons 2-on 1-off
  for (let x = x0 - 1; x <= x1 + 1; x += 1)
    for (let z = z0 - 1; z <= z1 + 1; z += 1) {
      const edge = x === x0 - 1 || x === x1 + 1 || z === z0 - 1 || z === z1 + 1
      if (!edge) continue
      const o = x < x0 ? 'west' : x > x1 ? 'east' : z < z0 ? 'north' : 'south'
      const along = o === 'west' || o === 'east' ? z : x
      if ((along & 1) === 0) b.set(x, P + H - 1, z, stair(IN[o], 'top')) // corbels, holes between them
      b.set(x, P + H, z, crownP)
      b.set(x, P + H + 1, z, crownP)
      if (along % 3 !== 2) b.set(x, P + H + 2, z, crownP)
    }
  // 6. the roof: a steep hip inside the parapet walk, dormers, a ridge spire
  const rf = b.roof({ x0: x0 + 1, z0: z0 + 1, x1: x1 - 1, z1: z1 - 1, y: P + H + 1, type: 'hip', material: roof, pitch: [2, 2, 2, 1], overhang: 0, eaveTrim: true })
  // 7. corner turrets corbelled out from two-thirds up, rising above the parapet with cones
  const turretH = Math.round(H * 0.4) + 10
  for (const [tx, tz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    const ty = P + Math.round(H * 0.62)
    for (let k = 0; k < 3; k += 1) // the corbel cone under it
      for (let dx = -2; dx <= 2; dx += 1)
        for (let dz = -2; dz <= 2; dz += 1) {
          const r = Math.hypot(dx, dz)
          if (r > 3 - k * 0.8 || r < 1.5 - k * 0.6) continue
          const o = OUT[`${Math.sign(dx)},0`] && Math.abs(dx) >= Math.abs(dz) ? OUT[`${Math.sign(dx)},0`] : OUT[`0,${Math.sign(dz)}`] ?? 'south'
          if (!b.get(tx + dx, ty - k, tz + dz)) b.set(tx + dx, ty - k, tz + dz, stair(IN[o], 'top'))
        }
    tower(ctx, [tx, ty, tz], { shape: 'round', r: 3, height: turretH, top: 'cone', roof, trim, ground: () => ty, seed: seed + tx })
  }
  // 8. the stair tower: round, on the side away from the gate, rising highest, with a spire
  const sx = cx - F[0] * (Math.floor((F[0] ? w : d) / 2) + 2)
  const sz = cz - F[1] * (Math.floor((F[1] ? d : w) / 2) + 2)
  const st = tower(ctx, [sx, P, sz], { shape: 'round', r: 5, height: H + 16, top: 'cone', roof, trim, ground: () => P, seed: seed + 77 })
  // 9. the gate in the front face, lanterns either side, and a road winding down the crag
  const gx = cx + F[0] * (Math.floor((F[0] ? w : d) / 2))
  const gz = cz + F[1] * (Math.floor((F[1] ? d : w) / 2))
  for (let k = -1; k <= 1; k += 1)
    for (let h = 1; h <= 4; h += 1) b.set(gx + (F[1] ? k : 0), P + h, gz + (F[0] ? k : 0), 'minecraft:air')
  b.set(gx + (F[1] ? 2 : 0) + F[0], P + 4, gz + (F[0] ? 2 : 0) + F[1], 'minecraft:lantern[hanging=false]')
  b.set(gx - (F[1] ? 2 : 0) + F[0], P + 4, gz - (F[0] ? 2 : 0) + F[1], 'minecraft:lantern[hanging=false]')
  // the road: from the foot of the crag in front up to the gap in the curtain, in two bends
  const side = [F[1], -F[0]] // to the right, looking out
  const R0 = (crag ? crag.radius : Rc) + 10
  const pts = [
    [cx + F[0] * R0 + side[0] * 14, y, cz + F[1] * R0 + side[1] * 14],
    [cx + F[0] * (R0 - 12) - side[0] * 10, Math.round(y + (P - y) * 0.4), cz + F[1] * (R0 - 12) - side[1] * 10],
    [cx + F[0] * (Rc + 8) + side[0] * 9, Math.round(y + (P - y) * 0.8), cz + F[1] * (Rc + 8) + side[1] * 9],
    [cx + F[0] * (Rc - 1), P, cz + F[1] * (Rc - 1)],
  ]
  const path = kit.catmullRom(pts, { samplesPerBlock: 2 })
  const paving = kit.palette({ cobblestone: 3, stone_bricks: 2, andesite: 2, gravel: 1 }, { scale: 2, seed: seed + 5 })
  for (const [px, py, pz] of path)
    for (let dx = -2; dx <= 2; dx += 1)
      for (let dz = -2; dz <= 2; dz += 1) {
        if (Math.hypot(dx, dz) > 2.3) continue
        const x = Math.round(px + dx)
        const z = Math.round(pz + dz)
        const yy = Math.round(py)
        for (let k = ground(x, z) + 1; k < yy; k += 1) b.set(x, k, z, footP) // a retaining bank under it
        b.set(x, yy, z, paving)
        for (let k = 1; k <= 3; k += 1) if (b.get(x, yy + k, z) && !/_log|_wood|stone|brick|andesite|tuff|deepslate/.test(b.nameAt(x, yy + k, z))) b.remove(x, yy + k, z)
      }
  void rng
  return { top: Math.max(rf.topY ?? 0, st.top ?? 0), platform: P, gate: [gx + F[0] * 2, P, gz + F[1] * 2] }
}

// ------------------------------------------------------------------ don't
// The striped cylinder with a cone, standing on the flat; and a castle on a plain block of stone
function stripedTower(ctx, [x, y, z], { r = 6, height = 56 } = {}) {
  const { b } = ctx
  for (let h = 1; h <= height; h += 1)
    for (let dx = -r; dx <= r; dx += 1)
      for (let dz = -r; dz <= r; dz += 1) {
        const d = Math.hypot(dx, dz)
        if (d > r || d < r - 1) continue
        b.set(x + dx, y + h, z + dz, Math.floor(h / 2) % 2 ? 'minecraft:stone_bricks' : 'minecraft:andesite')
      }
  for (let k = 0; k <= r * 2; k += 1)
    for (let dx = -r; dx <= r; dx += 1)
      for (let dz = -r; dz <= r; dz += 1) if (Math.hypot(dx, dz) <= r - k / 2 && Math.hypot(dx, dz) > r - k / 2 - 1.2) b.set(x + dx, y + height + 1 + k, z + dz, 'minecraft:deepslate_tiles')
}
function castleOnCube(ctx, [x, y, z]) {
  const { b } = ctx
  b.box([x - 14, y + 1, z - 14], [x + 14, y + 22, z + 14], 'minecraft:stone')
  b.box([x - 7, y + 23, z - 7], [x + 7, y + 36, z + 7], 'minecraft:stone_bricks')
  b.box([x - 6, y + 24, z - 6], [x + 6, y + 35, z + 6], 'minecraft:air')
  for (let dx = -7; dx <= 7; dx += 2) for (const dz of [-7, 7]) b.set(x + dx, y + 37, z + dz, 'minecraft:stone_bricks')
}

export const figure = { size: 150, height: 130, floorY: 4, camera: { eye: [118, 26, 168], lookAt: [72, 46, 70], fov: 60, width: 640, height: 480, far: 320 } }

export function demo(ctx, which) {
  const { b, FY, S } = ctx
  for (let x = 1; x < S - 1; x += 1)
    for (let z = 1; z < S - 1; z += 1) {
      b.set(x, FY, z, 'minecraft:grass_block')
      b.set(x, FY - 1, z, 'minecraft:dirt')
    }
  if (which === 'good') keep(ctx, { cx: 72, cz: 70, seed: 3 })
  else {
    stripedTower(ctx, [42, FY, 70])
    castleOnCube(ctx, [104, FY, 70])
  }
}
