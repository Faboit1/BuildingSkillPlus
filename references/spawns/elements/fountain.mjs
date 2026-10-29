// FOUNTAINS AND WATER. Read this, look at img/fountain.png, then design your own: octagonal,
// round, quatrefoil, a long canal with jets; tiers and materials for the theme. A big spawn's
// plaza centre deserves a set piece: a fountain players see from the spawn point and walk round.
//
// DO
// - Scale it to the plaza: a basin 15-25 across, a second basin raised inside it, a centre of 2-3
//   tiers 8-14 tall. Each tier smaller than the one below (about 2/3), so the falls land in water.
// - A moulded rim you can sit on: a stair seat on the outside, a coping block behind it, the water a
//   hand below the coping; the basin floor 2 down so it reads as water, not paint.
// - Water that spills from tier to tier: source blocks in each cup behind a lip of slabs, a notch in
//   the lip on each axis; the stream steps 1 out and falls into the water below (the game makes it;
//   draw it too so renders show it). Each cup 2 smaller than the water under it, so streams land in.
//   A saucer, not a cone: a thin plate with an upside-down-stair edge on a small cone and a stem.
// - Spouts from the raised basin the same way: a notch in its lip, a carved block under it.
// - Pillars and life round it: lamp standards and lanterns on the rim, buttresses on the drum,
//   planters with clipped trees on the diagonals, benches that look at the water, paths in on the
//   axes, lily pads in clumps. Hidden light under the water (waterlogged light blocks).
// - The fountain off the landing point (players spawn next to it, not in it), on an axis.
// DON'T
// - A square hole of water flush with the floor, with a glowstone or a sea lantern in the middle.
// - A pillar of glass or quartz shooting water, or water falling onto the plaza with no basin.
// - Water that can escape: every fall must land in water; a source on an open edge floods the plaza.

import { pavedPatch } from './_scene.mjs'

// the octagon distance: |x|, |z| and the diagonals cut at 45 degrees (a regular octagon)
const oct = (dx, dz) => Math.max(Math.abs(dx), Math.abs(dz), (Math.abs(dx) + Math.abs(dz)) / Math.SQRT2)
const ringOf = (dx, dz) => Math.round(oct(dx, dz)) // ring k = the cells at octagon distance about k
// stairs whose tall back faces the middle (for rings round [0, 0])
const toward = (dx, dz) => (Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : dz > 0 ? 'north' : 'south')
const away = (dx, dz) => ({ west: 'east', east: 'west', north: 'south', south: 'north' })[toward(dx, dz)]

// A fountain. [cx, y, cz] = the plaza floor block at its middle (players stand at y + 1).
//   r      the outer basin's rim (octagon distance; the seat ring is r + 1, so 2r + 3 across)
//   inner  the raised basin's rim (about 0.6 r; the cups are inner - 2 and inner - 4, so 2 cups
//          need inner 6+)                             tiers  cups on the centre column (1 or 2)
//   stone / coping / carve  families: the basin walls, the rims and lips, the bowls (a lighter stone)
//   bed    the basin floor (it colours the water)     falls  draw the falls the game will make
//   surround  the apron, planters, benches and lamp posts round it
export function fountain(ctx, [cx, y, cz], {
  r = 10, inner = 6, tiers = 2, stone = 'stone_brick', coping = 'polished_diorite', carve = 'polished_diorite',
  bed = 'prismarine_bricks', falls = true, surround = true, seed = 1,
} = {}) {
  const { b, kit } = ctx
  const M = { stone: kit.material(stone), coping: kit.material(coping), carve: kit.material(carve) }
  const set = (dx, h, dz, blk) => b.set(cx + dx, y + h, cz + dz, blk)
  const get = (dx, h, dz) => b.nameAt(cx + dx, y + h, cz + dz)
  for (const k of Object.keys(M)) M[k] = { stairs: M.stone.stairs, slab: M.stone.slab, ...M[k] } // no stairs or slab: the wall stone's (a copy: kit.material is cached)
  const st = (m, f, half = 'bottom') => `${M[m].stairs}[facing=${f},half=${half}]`
  const wall = kit.palette({ stone_bricks: 6, cracked_stone_bricks: 1, mossy_stone_bricks: 2 }, { scale: 2.5, seed })
  const water = (dx, h, dz, level = 0) => set(dx, h, dz, `minecraft:water[level=${level}]`)
  const each = (R, fn) => {
    for (let dx = -R; dx <= R; dx += 1) for (let dz = -R; dz <= R; dz += 1) fn(dx, dz, ringOf(dx, dz))
  }

  // 1 the outer basin: seat ring, rim, water 2 deep over a coloured bed
  const lipR = inner + 1
  each(r + 1, (dx, dz, k) => {
    if (k === r + 1) {
      set(dx, 0, dz, M.stone.block)
      set(dx, 1, dz, st('stone', toward(dx, dz)))
    } else if (k === r) {
      for (let h = -2; h <= 0; h += 1) set(dx, h, dz, wall)
      set(dx, 1, dz, M.coping.block)
    } else if (k < r) {
      set(dx, -2, dz, `minecraft:${bed}`)
      if (k > inner) {
        water(dx, -1, dz)
        water(dx, 0, dz)
        water(dx, 1, dz)
      }
    }
  })
  // lily pads in a few clumps near the rim
  each(r - 1, (dx, dz, k) => {
    if (k >= r - 2 && k <= r - 1 && kit.noise.coherent01(cx + dx, 0, cz + dz, { scale: 2.5, seed }) > 0.78) set(dx, 2, dz, 'minecraft:lily_pad')
  })
  // lanterns on carved blocks at the rim's 8 corners (where a straight side meets a diagonal), and a
  // lamp standard in the middle of each diagonal side: a carved base, a slender shaft, a lantern
  const corner = R => Math.floor((R + 0.5) * Math.SQRT2 - R)
  const dg = Math.round(r / Math.SQRT2)
  const post = M.carve.wall ?? kit.material(carve.replace(/^polished_/, '')).wall ?? M.stone.wall // polished_diorite has no wall: diorite_wall
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      for (const [a, c] of [[r, corner(r)], [corner(r), r]]) {
        set(sx * a, 2, sz * c, 'minecraft:chiseled_stone_bricks')
        set(sx * a, 3, sz * c, 'minecraft:lantern[hanging=false]')
      }
      set(sx * dg, 2, sz * dg, 'minecraft:chiseled_stone_bricks')
      for (let h = 3; h <= 5; h += 1) set(sx * dg, h, sz * dg, post)
      set(sx * dg, 6, sz * dg, 'minecraft:lantern[hanging=false]')
    }

  // 2 the raised basin: a drum standing in the outer water, a corbelled lip, water 2 deep, spouts
  each(lipR, (dx, dz, k) => {
    if (k === lipR) {
      set(dx, 4, dz, st('coping', toward(dx, dz), 'top')) // the lip, 1 out over the outer water
    } else if (k === inner) {
      for (let h = -1; h <= 3; h += 1) set(dx, h, dz, h === 2 ? M.coping.block : wall)
      set(dx, 4, dz, M.coping.block)
    } else {
      for (let h = -1; h <= 2; h += 1) set(dx, h, dz, M.stone.block)
      water(dx, 3, dz)
      water(dx, 4, dz)
    }
  })
  // buttresses at the drum's 8 corners, standing in the outer water under the lip
  const v = corner(inner)
  for (const [a, c] of [[inner + 1, v], [v, inner + 1]])
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (let h = -1; h <= 3; h += 1) set(sx * a, h, sz * c, h >= 2 ? M.coping.block : M.stone.block)
  // a spout: a notch in a rim at (dx, dz) on level h; the water steps 1 out along (ux, uz) and drops
  // until it meets water (the game makes this from the source behind the notch; we draw it too)
  const spout = (dx, dz, ux, uz, h) => {
    water(dx, h, dz, 1)
    const [ox, oz] = [dx + ux, dz + uz]
    if (!falls) return set(ox, h, oz, 'minecraft:air')
    water(ox, h, oz, 2)
    let lv = h - 1
    while (lv > -2 && (!get(ox, lv, oz) || /air$/.test(get(ox, lv, oz)))) water(ox, lv--, oz, 8)
    if (!/water/.test(get(ox, lv, oz) ?? '')) ctx.warn(`fountain: the fall at ${cx + ox},${y + lv},${cz + oz} lands on stone, not water`)
  }
  const AXES = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  // the raised basin's spouts on the axes, a carved block under each notch
  for (const [ux, uz] of AXES) {
    set(ux * inner, 3, uz * inner, 'minecraft:chiseled_stone_bricks')
    set(ux * lipR, 4, uz * lipR, 'minecraft:air')
    spout(ux * inner, uz * inner, ux, uz, 4)
  }

  // 3 the centre: a pedestal, saucers on a slender stem, a slab lip round each with water inside;
  // a notch on each axis pours into the cup below, a spout on top
  const cup = (h, R) => {
    // a saucer: the plate at level h (its edge ring upside-down stairs), a smaller cone under it
    // (half the radius) on the stem, a lip of slabs on h + 1 holding the water
    const ring = (lv, rr) => each(rr, (dx, dz, k) => k <= rr && set(dx, lv, dz, k === rr ? st('carve', toward(dx, dz), 'top') : M.carve.block))
    ring(h, R)
    ring(h - 1, Math.ceil(R / 2))
    each(R, (dx, dz, k) => {
      if (k === R) set(dx, h + 1, dz, `${M.carve.slab}[type=bottom]`) // a slab lip: smooth all round (stairs read as teeth on the diagonals)
      else if (k < R && (dx || dz)) water(dx, h + 1, dz)
    })
    for (const [ux, uz] of AXES) spout(ux * R, uz * R, ux, uz, h + 1)
  }
  // the pedestal: 3 x 3 in the raised basin, a chamfered top
  each(1, (dx, dz, k) => {
    set(dx, 3, dz, M.carve.block)
    set(dx, 4, dz, k === 1 ? st('carve', toward(dx, dz)) : M.carve.block)
  })
  // each cup 2 smaller than the water below it, so its streams (1 out from its lip) land inside that
  // water: the first inner - 2 (the raised basin's water ends at inner - 1), the second 2 less again
  const R1 = inner - 2
  const R2 = R1 - 2
  const rings = tiers >= 2 && R2 >= 2 ? [[7, R1], [11, R2]] : [[8, R1]] // [plate level, radius] per cup
  let shaft = 5
  for (const [h, R] of rings) {
    for (let lv = shaft; lv < h - 1; lv += 1) set(0, lv, 0, lv === h - 2 && lv > shaft ? `minecraft:chiseled_${stone}s` : M.carve.block) // the stem
    cup(h, R)
    shaft = h + 1
  }
  // the top: the shaft through the last cup, a carved cap, a source on it
  set(0, shaft, 0, M.carve.block)
  set(0, shaft + 1, 0, `minecraft:chiseled_${stone}s`)
  water(0, shaft + 2, 0)
  if (falls)
    for (const [ux, uz] of AXES) {
      water(ux, shaft + 2, uz, 1)
      water(ux, shaft + 1, uz, 8)
    }
  // hidden light under the water (invisible, waterlogged)
  for (const [dx, dz] of [[r - 2, 0], [-(r - 2), 0], [0, r - 2], [0, -(r - 2)]]) set(dx, -1, dz, 'minecraft:light[level=13,waterlogged=true]')

  // 4 round it: an apron with spokes, planters on the diagonals with lamp posts, benches facing in
  if (!surround) return
  const apron = kit.palette({ polished_andesite: 4, stone_bricks: 2, andesite: 1 }, { scale: 3, seed: seed + 2 })
  each(r + 5, (dx, dz, k) => {
    if (k < r + 2) return
    const spoke = dx === 0 || dz === 0 || Math.abs(dx) === Math.abs(dz)
    set(dx, 0, dz, k === r + 2 || k === r + 5 ? M.stone.block : spoke ? 'minecraft:polished_deepslate' : apron)
  })
  // planters on the diagonals: a kerbed bed with a small flowering tree, flowers, a lamp post
  const c = Math.round((r + 4) / Math.SQRT2) + 3 // the bed's middle, just off the apron
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const [px, pz] = [sx * c, sz * c]
      for (let i = -2; i <= 2; i += 1)
        for (let j = -2; j <= 2; j += 1) {
          const edge = Math.abs(i) === 2 || Math.abs(j) === 2
          set(px + i, 0, pz + j, edge ? M.stone.block : 'minecraft:dirt')
          set(px + i, 1, pz + j, edge ? `${M.stone.slab}[type=top]` : 'minecraft:grass_block')
          const n = kit.noise.coherent01(cx + px + i, 7, cz + pz + j, { scale: 1.5, seed })
          if (!edge && (i || j)) set(px + i, 2, pz + j, n > 0.6 ? 'minecraft:allium' : n > 0.35 ? 'minecraft:oxeye_daisy' : 'minecraft:short_grass')
        }
      // a clipped standard: a trunk and a ball of flowering azalea (a formal plaza's tree)
      for (let h = 2; h <= 4; h += 1) set(px, h, pz, 'minecraft:oak_log[axis=y]')
      b.leafBlob([cx + px, y + 5.6, cz + pz], [1.7, 1.4, 1.7], ['azalea_leaves', 'flowering_azalea_leaves'], { seed: seed + sx * 3 + sz, holes: 0.05 })
      // a lamp post on the bed's corner nearest the water
      const [lx, lz] = [px - sx * 2, pz - sz * 2]
      set(lx, 2, lz, 'minecraft:stone_brick_wall')
      for (let h = 3; h <= 5; h += 1) set(lx, h, lz, 'minecraft:dark_oak_fence')
      set(lx, 6, lz, 'minecraft:lantern[hanging=false]')
    }
  // benches on the straight sides of the apron, either side of the path in, looking at the water
  for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
    for (const s of [-1, 1])
      for (let i = 2; i <= 4; i += 1) {
        const [dx, dz] = [ux * (r + 4) + uz * s * i, uz * (r + 4) + ux * s * i]
        set(dx, 1, dz, `minecraft:dark_oak_stairs[facing=${away(ux, uz)}]`)
      }
}

export const figure = { size: 56, height: 22, floorY: 3, camera: { eye: [34, 8, 50.5], lookAt: [28, 7, 28], fov: 56, width: 640, height: 440 } }
export function demo(ctx, which) {
  pavedPatch(ctx)
  const { b, FY } = ctx
  if (which === 'good') fountain(ctx, [28, FY, 28])
  else {
    // a square hole of water flush with the floor, a glowstone in it, a glass pillar spouting
    for (let x = 26; x <= 32; x += 1) for (let z = 32; z <= 38; z += 1) b.set(x, FY, z, 'minecraft:water')
    b.set(29, FY, 35, 'minecraft:glowstone')
    for (let h = 1; h <= 4; h += 1) b.set(29, FY + h, 35, 'minecraft:glass')
    b.set(29, FY + 5, 35, 'minecraft:water')
  }
}
