// Landmarks: the big set pieces that stand round a spawn and make it memorable from the plaza (the
// pirate-island reference: a volcano, a moored ship, a lighthouse, a giant parrot, giant palms, rock
// formations). Each is one call; place 1-3 per spawn on the sightlines behind the building ring,
// never on the spawn's axis in front of the hero, and level a pad under it.
//
//   LANDMARKS[kind].r          the radius of the ground it occupies (reserve r + 2 with findSpot)
//   landmark(ctx, kind, { x, z, y, seed, facing, ...opts }) → { r, top }
//     x, z the centre, y the ground block level there, facing = the side that faces the spawn
//   volcano(ctx, o)      a 30-tall cone with ridges and gullies, a crater with a contained lava pool,
//                        magma rivulets, smoke from hidden campfires, green lower slopes
//   lighthouse(ctx, o)   a tapering striped tower (o.stripe, default red), a door facing the spawn,
//                        a corbelled gallery with a railing, a glass lantern room, a cone roof
//   ship(ctx, o)         a galleon (o.kind 'galleon') or a sloop ('sloop') moored broadside to the
//                        spawn in its own basin of water, braced square sails, a jetty to the shore
//   statue(ctx, o)       o.subject 'parrot' (a giant scarlet macaw on a perch) or 'knight' (a figure
//                        with a sword), on a carved plinth
//   giantTree(ctx, o)    a 28-34 tall tree of the theme's feature style with buttress roots
//   giantPalm(ctx, o)    a 20-27 tall palm with a root flare and broad drooping fronds
//   rockSpires(ctx, o)   3-5 tapering stone pillars with strata, moss caps and scree
//   rockArch(ctx, o)     a natural stone arch; you look through it from the spawn
//   palmTree(ctx, [x, y, z], { height, lean, seed })   a 7-12 tall palm for planting anywhere
//
// Everything stays inside the canvas and below its top. Solid parts fill down to the ground under
// them (ctx.site.groundY), so they sit on uneven land without floating.

import { palmTree, plantTree } from './landscape.mjs'

export { palmTree }

export const LANDMARKS = {
  volcano: { r: 26 },
  lighthouse: { r: 8 },
  ship: { r: 22 },
  statue: { r: 9 },
  'giant-tree': { r: 16 },
  'giant-palm': { r: 12 },
  'rock-spires': { r: 10 },
  'rock-arch': { r: 12 },
}

export function landmark(ctx, kind, opts) {
  const fn = { volcano, lighthouse, ship, statue, 'giant-tree': giantTree, 'giant-palm': giantPalm, 'rock-spires': rockSpires, 'rock-arch': rockArch }[kind]
  if (!fn) throw new Error(`unknown landmark "${kind}" (${Object.keys(LANDMARKS).join(', ')})`)
  return fn(ctx, opts)
}

const ns = id => (String(id).includes(':') ? String(id) : `minecraft:${id}`)
const DV = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }
const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
// the ground block level at a column (the site's, or the landmark's own y off the site)
const groundOf = (ctx, x, z, y) => {
  const g = ctx.site?.groundY?.(x, z)
  return g !== undefined && g >= 0 ? g : y
}
// fill a column from the ground up to `top` (the block at `top` gets `surface`, the rest `core`)
function column(ctx, x, z, y, top, core, surface = core) {
  const g = Math.min(groundOf(ctx, x, z, y), top)
  for (let yy = g; yy <= top; yy += 1) ctx.b.set(x, yy, z, yy === top ? surface : core)
}

// ================================================================== volcano
// The silhouette is everything: a concave cone (steeper toward the top), an irregular outline,
// radial ridges and gullies, a notched crater rim. Materials go from green lower slopes through
// grey rock to black basalt and blackstone near the top; magma rivulets run down from the rim.
// The lava sits in a flat pool on the crater floor, walled in on every side, so it never flows.
export function volcano(ctx, { x, z, y, seed = 1, height } = {}) {
  const { b, kit, H: canvasH } = ctx
  const R = LANDMARKS.volcano.r - 2
  const Hv = Math.round(Math.min(height ?? 32, canvasH - y - 8))
  const Rc = Math.round(R * 0.27) // crater radius
  const Dc = 6 // crater depth below the rim
  const noise = kit.noise
  const grass = kit.palette({ grass_block: 5, moss_block: 2, coarse_dirt: 1 }, { scale: 3, seed: seed + 1 })
  const rock = kit.palette({ stone: 4, andesite: 3, tuff: 2, gravel: 1 }, { scale: 3, seed: seed + 2 })
  const dark = kit.palette({ basalt: 3, blackstone: 3, smooth_basalt: 2, tuff: 1 }, { scale: 3, seed: seed + 3 })
  const crust = kit.palette({ blackstone: 4, basalt: 2, magma_block: 1 }, { scale: 2, seed: seed + 4 })
  const profile = d => Hv * Math.pow(Math.max(0, 1 - d / R), 1.4)
  const rimH = profile(Rc)
  const tops = new Map()
  for (let dx = -R - 3; dx <= R + 3; dx += 1)
    for (let dz = -R - 3; dz <= R + 3; dz += 1) {
      const px = x + dx
      const pz = z + dz
      const a = Math.atan2(dz, dx)
      // irregular outline and radial ridges/gullies (stronger on the mid slopes)
      const d = Math.hypot(dx, dz) * (1 + 0.1 * noise.fbm2(Math.cos(a) * 3, Math.sin(a) * 3, { scale: 1.3, seed: seed + 5 })) + 1.6 * noise.fbm2(px, pz, { scale: 6, seed: seed + 6 })
      if (d > R) continue
      const ridge = Math.abs(Math.sin(a * 7 + seed + 2 * noise.fbm2(px, pz, { scale: 9, seed: seed + 7 })))
      let h = profile(d) * (1 - 0.1 * (1 - ridge) * smooth(Rc, R * 0.8, d))
      if (d < Rc) h = rimH - Dc * (1 - (d / Rc) ** 2) + 0.8 * noise.fbm2(px, pz, { scale: 3, seed: seed + 8 })
      const top = y + Math.max(1, Math.round(h))
      tops.set(`${dx},${dz}`, top)
      const f = (top - y) / Hv
      const surface = d < Rc + 1.5 ? crust : f < 0.18 + 0.08 * noise.fbm2(px, pz, { scale: 4, seed }) ? grass : f < 0.55 ? rock : dark
      column(ctx, px, pz, y, top, f < 0.4 ? rock : dark, surface)
    }
  // the lava pool: a flat floor 1 above the crater bottom, every cell round it higher, so it stays put
  const floor = y + Math.round(rimH - Dc) + 1
  for (let dx = -Rc; dx <= Rc; dx += 1)
    for (let dz = -Rc; dz <= Rc; dz += 1) {
      const d = Math.hypot(dx, dz)
      const t = tops.get(`${dx},${dz}`)
      if (t === undefined) continue
      if (d <= Rc * 0.55) {
        for (let yy = floor; yy <= t + 1; yy += 1) b.remove(x + dx, yy, z + dz)
        for (let yy = Math.min(t, floor - 1); yy < floor; yy += 1) b.set(x + dx, yy, z + dz, yy === floor - 1 ? 'minecraft:magma_block' : 'minecraft:blackstone')
        b.set(x + dx, floor, z + dz, 'minecraft:lava')
      } else if (t <= floor) {
        for (let yy = t; yy <= floor; yy += 1) b.set(x + dx, yy, z + dz, yy === floor ? 'minecraft:magma_block' : 'minecraft:blackstone')
      }
    }
  // smoke: campfires on hay at the pool's edge (hay makes the smoke column tall)
  for (let k = 0; k < 3; k += 1) {
    const a = seed + (k * Math.PI * 2) / 3
    const px = x + Math.round(Math.cos(a) * (Rc * 0.55 + 1.2))
    const pz = z + Math.round(Math.sin(a) * (Rc * 0.55 + 1.2))
    b.set(px, floor, pz, 'minecraft:hay_block[axis=y]')
    b.set(px, floor + 1, pz, 'minecraft:campfire[lit=true,signal_fire=true]')
  }
  // magma rivulets: 3 meandering lines from the rim down the slope, 1-2 wide, set into the surface
  for (let k = 0; k < 3; k += 1) {
    let a = seed * 1.7 + k * 2.1
    for (let d = Rc + 1; d < R * 0.72; d += 0.5) {
      a += 0.08 * noise.fbm2(d, k * 10, { scale: 2, seed: seed + 9 })
      const dx = Math.round(Math.cos(a) * d)
      const dz = Math.round(Math.sin(a) * d)
      const t = tops.get(`${dx},${dz}`)
      if (t === undefined) continue
      b.set(x + dx, t, z + dz, d < R * 0.45 || kit.hash01(dx, k, dz, seed) < 0.6 ? 'minecraft:magma_block' : 'minecraft:blackstone')
      if (d < R * 0.4 && kit.hash01(dx, 2, dz, seed) < 0.4) {
        const t2 = tops.get(`${dx + 1},${dz}`)
        if (t2 !== undefined) b.set(x + dx + 1, t2, z + dz, 'minecraft:magma_block')
      }
    }
  }
  // the green foot: ferns, grass and a few bushes on the lowest slopes
  for (const [key, t] of tops) {
    const [dx, dz] = key.split(',').map(Number)
    if (t - y > Hv * 0.2 || b.get(x + dx, t + 1, z + dz)) continue
    const u = kit.hash01(x + dx, t, z + dz, seed + 10)
    if (!/grass_block|moss_block/.test(b.nameAt(x + dx, t, z + dz) ?? '')) continue
    if (u < 0.08) b.set(x + dx, t + 1, z + dz, 'minecraft:jungle_leaves[persistent=true]')
    else if (u < 0.3) b.set(x + dx, t + 1, z + dz, u < 0.15 ? 'minecraft:fern' : 'minecraft:short_grass')
  }
  return { r: LANDMARKS.volcano.r, top: y + Hv }
}

// ================================================================== lighthouse
// A lighthouse reads from its proportions: a tower about 6 times as tall as it is wide, tapering by
// a third, bold horizontal stripes 4 high, then a dark gallery band, the bright lantern room and a
// small dark cap. It stands on a rocky footing with a stone plinth and a door toward the spawn.
export function lighthouse(ctx, { x, z, y, seed = 1, facing = 'south', height, stripe = 'red' } = {}) {
  const { b, kit } = ctx
  const H = Math.round(Math.min(height ?? 26, ctx.H - y - 12))
  const r0 = 4.4
  const r1 = 2.9
  const rAt = yy => r0 - ((r0 - r1) * yy) / H
  const stripeA = ns(`${stripe}_concrete`)
  const stripeB = 'minecraft:white_concrete'
  // the rocky footing and the stone plinth
  const rocks = kit.palette({ stone: 4, andesite: 3, cobblestone: 2, mossy_cobblestone: 1 }, { scale: 2, seed })
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * Math.PI * 2 + seed
    b.boulder([x + Math.round(Math.cos(a) * 5.5), y + 1, z + Math.round(Math.sin(a) * 5.5)], [2.2, 1.6, 2.2], rocks, { seed: seed + k })
  }
  for (let dx = -6; dx <= 6; dx += 1)
    for (let dz = -6; dz <= 6; dz += 1) {
      const d = Math.hypot(dx, dz)
      if (d > 5.6) continue
      column(ctx, x + dx, z + dz, y, y + (d < 5 ? 2 : 1), 'minecraft:stone_bricks', d < 5 ? 'minecraft:polished_andesite' : 'minecraft:stone_bricks')
    }
  const base = y + 2
  // the tower: a 1-thick shell, banded; windows on a spiral every 5 up
  for (let yy = 1; yy <= H; yy += 1) {
    const r = rAt(yy)
    const band = Math.floor((yy - 1) / 4) % 2 === 0 ? stripeB : stripeA
    for (let dx = -5; dx <= 5; dx += 1)
      for (let dz = -5; dz <= 5; dz += 1) {
        const d = Math.hypot(dx, dz)
        if (d > r + 0.2) continue
        b.set(x + dx, base + yy, z + dz, d > r - 1.05 ? band : 'minecraft:air')
      }
  }
  const [fx, fz] = DV[facing]
  const sides = [[fx, fz], [-fz, fx], [-fx, -fz], [fz, -fx]]
  for (let k = 0, yy = 7; yy < H - 2; yy += 5, k += 1) {
    const [sx, sz] = sides[k % 4]
    const r = Math.round(rAt(yy) - 0.4)
    b.set(x + sx * r, base + yy, z + sz * r, 'minecraft:glass_pane')
    b.set(x + sx * r, base + yy + 1, z + sz * r, 'minecraft:glass_pane')
  }
  // the door toward the spawn, a step and lanterns either side
  const rd = Math.round(r0 - 0.4)
  b.door([x + fx * rd, base + 1, z + fz * rd], facing, { material: 'spruce' })
  b.set(x + fx * (rd + 1), base, z + fz * (rd + 1), `minecraft:stone_brick_stairs[facing=${ctx.kit.opposite(facing)}]`)
  for (const s of [-1, 1]) b.set(x + fx * (rd + 1) - fz * s * 2, base + 1, z + fz * (rd + 1) + fx * s * 2, 'minecraft:lantern[hanging=false]')
  // the gallery: a corbel ring of upside-down stairs, a dark floor one wider, an iron railing
  const G = base + H + 1
  const rg = r1 + 1.7
  for (let dx = -6; dx <= 6; dx += 1)
    for (let dz = -6; dz <= 6; dz += 1) {
      const d = Math.hypot(dx, dz)
      if (d > rg + 0.3) continue
      b.set(x + dx, G, z + dz, 'minecraft:polished_deepslate')
      if (d > rg - 0.8) {
        b.set(x + dx, G + 1, z + dz, 'minecraft:iron_bars')
        const f = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : dz > 0 ? 'north' : 'south'
        b.set(x + dx, G - 1, z + dz, `minecraft:polished_deepslate_stairs[facing=${f},half=top]`)
      }
    }
  // the lantern room: glass round a stack of light, dark corner posts, then the cap
  for (let yy = 1; yy <= 4; yy += 1)
    for (let dx = -2; dx <= 2; dx += 1)
      for (let dz = -2; dz <= 2; dz += 1) {
        const d = Math.hypot(dx, dz)
        if (d > 2.3) continue
        if (d > 1.3) b.set(x + dx, G + yy, z + dz, Math.abs(dx) === Math.abs(dz) ? 'minecraft:polished_deepslate_wall' : 'minecraft:glass')
        else if (dx === 0 && dz === 0) b.set(x, G + yy, z, yy === 2 || yy === 3 ? 'minecraft:sea_lantern' : 'minecraft:polished_deepslate')
      }
  b.coneRoof([x, G + 5, z], 2, { material: 'deepslate_tile', pitch: 1, overhang: 1, finial: 'minecraft:lightning_rod' })
  return { r: LANDMARKS.lighthouse.r, top: G + 9 }
}

// ================================================================== ship
// A ship moored broadside to the spawn, so the player sees its whole length and the sails' faces:
// the yards are braced ~35 degrees, so the sails turn their bellies toward the plaza instead of an
// edge. It floats in its own basin dug into the island (water 4 deep, a sand floor and banks) with a
// plank jetty from the bank on the spawn side.
export function ship(ctx, { x, z, y, seed = 1, facing = 'south', kind = 'galleon' } = {}) {
  const { b, kit } = ctx
  const galleon = kind !== 'sloop'
  const L = galleon ? 30 : 20
  const beam = galleon ? 9 : 7
  const depth = galleon ? 5 : 4
  // the keel runs across the facing: the broadside faces the spawn
  const heading = facing === 'north' || facing === 'south' ? 'east' : 'south'
  const [hx, hz] = DV[heading]
  const [fx, fz] = DV[facing]
  const water = y - 1 // the water surface, one below the bank
  // the basin: an ellipse round the hull, 4 deep, a sand floor, sand banks
  const A = L / 2 + 4
  const Bw = beam / 2 + 4
  for (let du = -A - 2; du <= A + 2; du += 1)
    for (let dw = -Bw - 2; dw <= Bw + 2; dw += 1) {
      const e = (du / A) ** 2 + (dw / Bw) ** 2 + 0.06 * kit.noise.fbm2(du, dw, { scale: 4, seed })
      const px = x + hx * du + -hz * dw
      const pz = z + hz * du + hx * dw
      if (e <= 1) {
        const g = groundOf(ctx, px, pz, y)
        for (let yy = water + 1; yy <= Math.max(g, y) + 2; yy += 1) b.remove(px, yy, pz)
        const floor = water - 4 + Math.round(2 * smooth(0.55, 1, e))
        b.set(px, floor, pz, kit.hash01(px, 0, pz, seed) < 0.75 ? 'minecraft:sand' : 'minecraft:gravel')
        for (let yy = floor + 1; yy <= water; yy += 1) b.set(px, yy, pz, 'minecraft:water')
        if (ctx.site) ctx.site.paved[px + ctx.S * pz] = 1
      } else if (e <= 1.35) {
        // the bank: sand sloping back up to the ground, solid under the water's edge
        const g = groundOf(ctx, px, pz, y)
        for (let yy = water - 4; yy < g; yy += 1) if (!b.get(px, yy, pz)) b.set(px, yy, pz, 'minecraft:sandstone')
        b.set(px, g, pz, e < 1.15 ? 'minecraft:sand' : kit.hash01(px, 1, pz, seed) < 0.5 ? 'minecraft:sand' : 'minecraft:grass_block')
      }
    }
  // the hull: bow at +L/2 along the heading, its waterline at the water surface
  const bow = [x + hx * Math.floor(L / 2), water - Math.round(depth * 0.5), z + hz * Math.floor(L / 2)]
  const s = b.hull({
    bow, heading, length: L, beam, depth,
    maxBeamAt: 0.42, bowExp: 0.55, runExp: 2, transom: 0.72, section: 2.6, tumble: 0.14, waterline: 0.5,
    sheerFwd: galleon ? 2 : 1, sheerAft: galleon ? 3 : 1.5, bulwark: 1, rail: 'spruce_fence', keel: null,
    gunports: galleon ? { y: depth - 1, every: 3, from: 0.25, to: 0.62 } : null,
    paint: { bottom: 'dark_oak_planks', wale: 'stripped_dark_oak_log', side: 'spruce_planks', deck: 'spruce_planks', trim: 'stripped_dark_oak_log' },
  })
  const at = (u, w, yy) => s.at(u, w, yy)
  const put = (u, w, yy, p) => b.set(...at(u, w, yy), p)
  // the stern castle: a raised deck over the aft quarter with a cabin under it
  const deck = u => Math.round(s.deckY(u))
  const U_Q = Math.round(L * 0.72)
  const qd = deck(U_Q) + 3
  for (let u = U_Q; u <= L; u += 1) {
    const hw = Math.max(1, Math.floor(s.halfBreadth(u)) - 1)
    for (let w = -hw; w <= hw; w += 1) {
      for (let yy = deck(u) + 1; yy < qd; yy += 1) put(u, w, yy, Math.abs(w) === hw || u === U_Q || u === L ? (yy === deck(u) + 2 && Math.abs(w) !== hw ? 'minecraft:glass_pane' : 'minecraft:spruce_planks') : 'minecraft:air')
      put(u, w, qd, 'minecraft:dark_oak_planks')
      if (Math.abs(w) === hw || u === L) put(u, w, qd + 1, 'minecraft:spruce_fence')
    }
  }
  for (const w of [-1, 0, 1]) put(U_Q, w, qd + 1, 'minecraft:air')
  put(U_Q, 0, deck(U_Q) + 1, 'minecraft:dark_oak_door[half=lower,facing=' + kit.facingFrom(hx, hz) + ']')
  put(U_Q, 0, deck(U_Q) + 2, 'minecraft:dark_oak_door[half=upper,facing=' + kit.facingFrom(hx, hz) + ']')
  put(L - 1, 0, qd + 1, 'minecraft:lantern[hanging=false]')
  // masts with yards and braced sails, a crow's nest on the main, a black flag at the top
  const masts = galleon ? [[0.24, 15], [0.5, 19], [0.78, 13]] : [[0.42, 15]]
  const th = (35 * Math.PI) / 180
  const [dU, dW] = [Math.sin(th), Math.cos(th)]
  const [nU, nW] = [-Math.cos(th), Math.sin(th)] // the sail's belly leans toward the bow
  const sail = (u, yHead, yFoot, half, belly = 1.6) => {
    for (let yy = yFoot; yy < yHead; yy += 1) {
      const t = (yHead - yy) / (yHead - yFoot)
      for (let q = -half; q <= half + 1e-6; q += 0.3) {
        const k = belly * (1 - (q / half) ** 2) * Math.sin(Math.PI * Math.min(1, 0.2 + t * 0.85))
        const cu = Math.round(u + q * dU + k * nU)
        const cw = Math.round(q * dW + k * nW)
        put(cu, cw, yy, 'minecraft:white_wool')
        put(Math.round(u + q * dU + (k + 0.6) * nU), Math.round(q * dW + (k + 0.6) * nW), yy, 'minecraft:white_wool') // 2 thick: no slits
      }
    }
  }
  // yards: solid dark spars (fences on a braced diagonal would show as a row of separate posts)
  const yard = (u, yy, half) => {
    for (let q = -half; q <= half; q += 0.4) put(Math.round(u + q * dU), Math.round(q * dW), yy, 'minecraft:stripped_dark_oak_wood')
  }
  masts.forEach(([fu, h], i) => {
    const u = Math.round(L * fu)
    const d0 = deck(u)
    for (let yy = d0 + 1; yy <= d0 + h; yy += 1) put(u, 0, yy, 'minecraft:dark_oak_log[axis=y]')
    // two sails per mast, the upper narrower, with the mast showing between them (a solid wall of
    // canvas from deck to truck reads as a box, not a rig)
    const half = Math.floor(beam / 2) + (i === 1 ? 1 : 0)
    const lower = [d0 + Math.round(h * 0.44), d0 + 4]
    const upper = [d0 + Math.round(h * 0.8), d0 + Math.round(h * 0.44) + 3]
    yard(u, lower[0], half + 1)
    yard(u, upper[0], half)
    sail(u, lower[0], lower[1], half - 0.5)
    sail(u, upper[0], upper[1], half - 1.5, 1.1)
    yard(u, upper[1] - 1, half - 0.5)
    if (i === (galleon ? 1 : 0)) {
      const ny = d0 + Math.round(h * 0.88)
      for (let du = -1; du <= 1; du += 1)
        for (let dw = -1; dw <= 1; dw += 1) {
          put(u + du, dw, ny, 'minecraft:spruce_slab[type=top]')
          if (du || dw) put(u + du, dw, ny + 1, 'minecraft:spruce_fence')
        }
      put(u, 0, ny, 'minecraft:dark_oak_log[axis=y]')
      for (let k = 0; k < 3; k += 1) for (let j = 0; j < 2; j += 1) put(u - 1 - k, 0, d0 + h - j, 'minecraft:black_wool')
    }
  })
  // the bowsprit: a spar out and up from the bow
  for (let k = 0; k < 7; k += 1) put(-k, 0, deck(0) + 1 + Math.floor(k / 2), 'minecraft:spruce_fence')
  // deck life: barrels, a capstan, cannons at the gunports' level on deck
  put(Math.round(L * 0.36), 1, deck(Math.round(L * 0.36)) + 1, 'minecraft:barrel[facing=up,open=false]')
  put(Math.round(L * 0.37), 2, deck(Math.round(L * 0.37)) + 1, 'minecraft:barrel[facing=up,open=false]')
  put(Math.round(L * 0.62), 0, deck(Math.round(L * 0.62)) + 1, 'minecraft:spruce_fence')
  put(Math.round(L * 0.62), 0, deck(Math.round(L * 0.62)) + 2, 'minecraft:spruce_trapdoor[facing=north,half=top,open=false]')
  // the jetty: 3 wide from the bank on the spawn side to the hull's side, on posts
  const mid = Math.round(L * 0.45)
  const side = fx * -hz + fz * hx > 0 ? 1 : -1 // the hull side (w sign) that faces the spawn
  const hb = Math.ceil(s.halfBreadth(mid))
  for (let w = hb + 1; w <= Bw + 2; w += 1)
    for (const du of [-1, 0, 1]) {
      const [px, , pz] = at(mid + du, side * w, 0)
      b.set(px, y, pz, 'minecraft:spruce_planks')
      if (du !== 0 && w % 3 === 0) {
        for (let yy = water - 3; yy < y; yy += 1) b.set(px, yy, pz, 'minecraft:spruce_log[axis=y]')
        b.set(px, y + 1, pz, 'minecraft:spruce_fence')
      }
    }
  const [lx, , lz] = at(mid + 2, side * (Bw + 1), 0)
  b.set(lx, y + 1, lz, 'minecraft:spruce_fence')
  b.set(lx, y + 2, lz, 'minecraft:lantern[hanging=false]')
  return { r: LANDMARKS.ship.r, top: water + depth + 22 }
}

// ================================================================== statue
// A statue is read by its silhouette and its colour blocks, so it is built from a few clear masses
// (body, head, folded wings, a long tail, the hooked beak) with flat colour zones, like the
// reference parrot: scarlet body, a white face patch, yellow and blue bands on the wings, a long
// red-and-blue tail hanging below the perch. It looks toward `facing`.
export function statue(ctx, { x, z, y, seed = 1, facing = 'south', subject = 'parrot' } = {}) {
  const { b, kit } = ctx
  // the plinth: a stepped stone base with a stair skirt and a lantern at each front corner
  const P = 3
  for (let dx = -4; dx <= 4; dx += 1)
    for (let dz = -4; dz <= 4; dz += 1) {
      const edge = Math.max(Math.abs(dx), Math.abs(dz))
      if (edge === 4) {
        const f = Math.abs(dx) === 4 && Math.abs(dz) !== 4 ? (dx > 0 ? 'west' : 'east') : Math.abs(dz) === 4 && Math.abs(dx) !== 4 ? (dz > 0 ? 'north' : 'south') : null
        column(ctx, x + dx, z + dz, y, y, 'minecraft:stone_bricks')
        if (f) b.set(x + dx, y + 1, z + dz, `minecraft:stone_brick_stairs[facing=${f}]`)
      } else column(ctx, x + dx, z + dz, y, y + (edge === 3 ? 1 : P), 'minecraft:stone_bricks', edge === 3 ? 'minecraft:polished_andesite' : 'minecraft:chiseled_stone_bricks')
    }
  const [fx, fz] = DV[facing]
  for (const s of [-1, 1]) {
    b.set(x + fx * 3 - fz * s * 3, y + 2, z + fz * 3 + fx * s * 3, 'minecraft:stone_brick_wall')
    b.set(x + fx * 3 - fz * s * 3, y + 3, z + fz * 3 + fx * s * 3, 'minecraft:lantern[hanging=false]')
  }
  const base = y + P + 1
  if (subject !== 'parrot') {
    // a knight: the kit's armature figure in stone, leaning on a sword planted in front of it
    const stone = kit.palette({ polished_andesite: 4, andesite: 2, stone: 2, tuff: 1 }, { scale: 2, seed })
    const fig = b.figure([x, base, z], { height: 17, facing, paint: stone, build: 1.15, pose: { armL: { raise: 14, swing: 32, elbow: 50 }, armR: { raise: 14, swing: 32, elbow: 50 }, contrapposto: 0.3 } })
    const hand = fig.joints.armL.wrist.map(Math.round)
    const sx = Math.round((hand[0] + fig.joints.armR.wrist[0]) / 2) + fx
    const sz = Math.round((hand[2] + fig.joints.armR.wrist[2]) / 2) + fz
    for (let yy = base; yy <= hand[1] + 1; yy += 1) b.set(sx, yy, sz, yy > hand[1] - 1 ? 'minecraft:polished_deepslate' : 'minecraft:iron_block')
    b.set(sx - fz, hand[1] - 1, sz + fx, 'minecraft:polished_deepslate_wall')
    b.set(sx + fz, hand[1] - 1, sz - fx, 'minecraft:polished_deepslate_wall')
    return { r: LANDMARKS.statue.r, top: base + 18 }
  }
  // the parrot, in its own frame: F forward (the way it looks), R its right, U up
  const F = [fx, fz]
  const Rt = [-fz, fx]
  const toW = (f, r, u) => [Math.round(x + F[0] * f + Rt[0] * r), base + Math.round(u), Math.round(z + F[1] * f + Rt[1] * r)]
  const ell = (c, rad, p) => {
    const [cf, cr, cu] = c
    const [af, ar, au] = rad
    for (let f = Math.floor(cf - af); f <= Math.ceil(cf + af); f += 1)
      for (let r = Math.floor(cr - ar); r <= Math.ceil(cr + ar); r += 1)
        for (let u = Math.floor(cu - au); u <= Math.ceil(cu + au); u += 1) {
          const q = ((f - cf) / af) ** 2 + ((r - cr) / ar) ** 2 + ((u - cu) / au) ** 2
          if (q <= 1) b.set(...toW(f, r, u), typeof p === 'function' ? p(f, r, u) : p)
        }
  }
  const red = kit.palette({ red_concrete: 4, red_wool: 1 }, { scale: 2, seed: seed + 1 })
  // the perch: a driftwood log across the plinth, its ends cut short
  for (let r = -4; r <= 4; r += 1) b.set(...toW(0, r, 1), `minecraft:stripped_oak_log[axis=${Rt[0] ? 'x' : 'z'}]`)
  for (const r of [-4, 4]) for (let u = 0; u >= -P; u -= 1) b.set(...toW(0, r, u), 'minecraft:stripped_oak_log[axis=y]')
  // the tail first (the body overlaps its root): long, tapering, hanging below the perch at the back
  for (let k = 0; k <= 22; k += 1) {
    const t = k / 22
    const c = [-1.5 - 3 * t, 0, 3 - 9 * t]
    const rr = 1.5 - 1.1 * t
    ell(c, [Math.max(0.6, rr * 0.7), Math.max(0.6, rr), 0.8], t < 0.6 ? red : 'minecraft:blue_concrete')
  }
  // the body: upright, leaning forward a little, feet gripping the perch
  ell([0.3, 0, 7], [2.8, 3, 5.2], red)
  for (const r of [-1, 1]) {
    b.set(...toW(0.5, r * 1.2, 2), 'minecraft:gray_concrete')
    b.set(...toW(1, r * 1.2, 1.5), 'minecraft:gray_concrete')
  }
  // the folded wings: red at the shoulder, a yellow band, then blue to the tips
  for (const r of [-1, 1])
    ell([-0.6, r * 2.6, 6.2], [2.6, 1.1, 4.8], (f, rr, u) => (u > 8 ? red : u > 5.5 ? 'minecraft:yellow_concrete' : u > 3.5 ? 'minecraft:light_blue_concrete' : 'minecraft:blue_concrete'))
  // the head: round, a white face patch round each eye, a black pupil
  ell([1.4, 0, 12.6], [2.7, 2.6, 2.7], red)
  for (const r of [-1, 1]) {
    ell([2.6, r * 2, 12.4], [1, 0.8, 1.1], 'minecraft:white_concrete')
    b.set(...toW(3, r * 2.3, 13), 'minecraft:black_concrete')
  }
  // the beak: a heavy hooked upper bill in pale grey over a black lower bill
  for (let k = 0; k <= 4; k += 1) {
    const t = k / 4
    b.set(...toW(3.6 + 1.6 * t, 0, 12.6 - 1.4 * t * t), 'minecraft:white_terracotta')
    b.set(...toW(3.6 + 1.2 * t, 0, 12.6 - 1.4 * t * t - 0.4), 'minecraft:light_gray_concrete')
  }
  ell([3.6, 0, 11], [0.9, 0.9, 0.8], 'minecraft:black_concrete')
  return { r: LANDMARKS.statue.r, top: base + 16 }
}

// ================================================================== trees
// A giant tree: the theme's feature tree grown to 28-34 blocks with buttress roots spreading into
// the ground (tropical themes get a giant palm instead). Big enough to read as a landmark from the
// plaza, its crown well above the rooftops.
export function giantTree(ctx, { x, z, y, seed = 1, style, height } = {}) {
  style ??= ctx.theme?.trees?.feature ?? 'oak'
  if (style === 'palm') return giantPalm(ctx, { x, z, y, seed, height })
  const { b, kit } = ctx
  const H = Math.min(height ?? 30 + (seed % 5), ctx.H - y - 6)
  // (a broadleaf crown is ~0.62 of its height in radius: maxR 18 lets it grow to ~29)
  const res = plantTree(ctx, style, [x, y, z], { size: 'large', seed, height: H, maxR: LANDMARKS['giant-tree'].r + 2 })
  // buttress roots: 5-7 tapering flanges from the trunk foot down and out into the soil
  const log = /cherry/.test(style) ? 'minecraft:cherry_wood' : /spruce|pine/.test(style) ? 'minecraft:spruce_wood' : /crimson/.test(style) ? 'minecraft:crimson_hyphae' : /oak|autumn/.test(style) ? 'minecraft:dark_oak_wood' : 'minecraft:oak_wood'
  const rng = kit.rng(seed * 7 + 3)
  const n = rng.int(5, 7)
  for (let k = 0; k < n; k += 1) {
    const a = (k / n) * Math.PI * 2 + rng.range(-0.3, 0.3)
    const r = rng.range(4.5, 6.5)
    b.tubeAlong([[x + 0.5, y + 3.5, z + 0.5], [x + 0.5 + Math.cos(a) * r * 0.55, y + 1.4, z + 0.5 + Math.sin(a) * r * 0.55], [x + 0.5 + Math.cos(a) * r, y - 0.5, z + 0.5 + Math.sin(a) * r]], s => 1.6 - 0.8 * s, log)
  }
  return { r: LANDMARKS['giant-tree'].r, top: res?.top ?? y + H }
}

export function giantPalm(ctx, { x, z, y, seed = 1, height } = {}) {
  const res = palmTree(ctx, [x, y, z], { giant: true, seed, height })
  return { r: LANDMARKS['giant-palm'].r, top: res.top }
}

// ================================================================== rocks
// Rock spires: 3-5 pillars of differing heights leaning a little, each tapering to a rounded top,
// banded in strata (the bands line up across the pillars: they were one cliff once), moss and a
// bush on the tops, scree boulders at the feet.
export function rockSpires(ctx, { x, z, y, seed = 1 } = {}) {
  const { b, kit } = ctx
  const rng = kit.rng(seed * 11 + 5)
  const strata = ['minecraft:stone', 'minecraft:andesite', 'minecraft:stone', 'minecraft:tuff', 'minecraft:granite', 'minecraft:stone', 'minecraft:andesite']
  const n = rng.int(3, 5)
  let top = y
  for (let k = 0; k < n; k += 1) {
    const a = (k / n) * Math.PI * 2 + rng.range(-0.4, 0.4)
    const d = k === 0 ? 0 : rng.range(3.5, 6.5)
    const cx = x + Math.cos(a) * d
    const cz = z + Math.sin(a) * d
    const h = Math.min(ctx.H - y - 4, Math.round(k === 0 ? rng.range(22, 28) : rng.range(10, 20)))
    const rb = k === 0 ? rng.range(3.2, 4) : rng.range(2.2, 3.2)
    const lx = rng.range(-1.5, 1.5)
    const lz = rng.range(-1.5, 1.5)
    for (let yy = 0; yy <= h; yy += 1) {
      const t = yy / h
      const r = rb * (1 - 0.7 * t ** 1.3) * (t > 0.9 ? 1 - (t - 0.9) * 4 : 1)
      const ox = cx + lx * t * t
      const oz = cz + lz * t * t
      for (let dx = -5; dx <= 5; dx += 1)
        for (let dz = -5; dz <= 5; dz += 1) {
          const px = Math.round(ox) + dx
          const pz = Math.round(oz) + dz
          if (Math.hypot(px - ox, pz - oz) > r + 0.7 * kit.noise.fbm2(px, pz + yy * 3, { scale: 2.5, seed })) continue
          const band = strata[Math.floor((y + yy + Math.round(kit.noise.fbm2(px, pz, { scale: 9, seed }))) / 3) % strata.length]
          if (yy === 0) column(ctx, px, pz, y, y + 1, band)
          else b.set(px, y + 1 + yy, pz, t > 0.92 ? 'minecraft:moss_block' : band)
        }
    }
    top = Math.max(top, y + h + 2)
    if (h > 14) b.set(Math.round(cx + lx), y + h + 2, Math.round(cz + lz), 'minecraft:azalea')
  }
  const scree = kit.palette({ stone: 3, andesite: 2, cobblestone: 2, mossy_cobblestone: 1 }, { scale: 2, seed })
  for (let k = 0; k < 6; k += 1) {
    const a = rng.range(0, Math.PI * 2)
    const d = rng.range(5.5, 8.5)
    const px = Math.round(x + Math.cos(a) * d)
    const pz = Math.round(z + Math.sin(a) * d)
    b.boulder([px, groundOf(ctx, px, pz, y) + 1, pz], [rng.range(0.9, 1.8), rng.range(0.7, 1.2), rng.range(0.9, 1.8)], scree, { seed: seed + k })
  }
  return { r: LANDMARKS['rock-spires'].r, top }
}

// A natural arch; its opening faces the spawn (the feet stand either side of the line of sight).
export function rockArch(ctx, { x, z, y, seed = 1, facing = 'south', span = 14 } = {}) {
  const { b, kit } = ctx
  const [fx, fz] = DV[facing]
  const half = span / 2
  const A = [Math.round(x - fz * half), groundOf(ctx, x - fz * half, z + fx * half, y), Math.round(z + fx * half)]
  const B = [Math.round(x + fz * half), groundOf(ctx, x + fz * half, z - fx * half, y), Math.round(z - fx * half)]
  b.rockArch(A, B, { height: Math.min(ctx.H - y - 6, Math.round(span * 0.85)), seed, ramp: ['cobbled_deepslate', 'tuff', 'stone', 'andesite', 'polished_andesite'] })
  // moss and grass on the top surfaces, a few vines down the inside
  const R = Math.ceil(half + 5)
  for (let dx = -R; dx <= R; dx += 1)
    for (let dz = -R; dz <= R; dz += 1)
      for (let yy = y + span + 2; yy > y + 2; yy -= 1) {
        const n = b.nameAt(x + dx, yy, z + dz)
        if (!n) continue
        if (/stone|tuff|andesite|deepslate/.test(n) && !b.get(x + dx, yy + 1, z + dz) && kit.hash01(x + dx, yy, z + dz, seed) < 0.55) b.set(x + dx, yy, z + dz, 'minecraft:moss_block')
        break
      }
  return { r: LANDMARKS['rock-arch'].r, top: y + span + 2 }
}
