// GATES AND PORTALS (RTP, warps, the way to the PvP arena). Read this, look at img/gate.png, then
// design your own gate for the theme. A portal is a region a plugin watches (b.markPortal records the
// opening for setup.md); what players see is the gate you build round it. On a big spawn the RTP
// gate is a landmark: build it as a gatehouse, a monument players see from the spawn point.
//
// DO
// - Monumental scale: 15-25 wide, 14-22 tall; the opening 5-7 wide and 7-10 high (a player is 2 tall:
//   a 3 x 4 hole reads as a door, not a gate). Twin towers or massive piers flank it and rise 3+
//   above the middle; the middle carries a parapet with merlons (or a pediment on a classical gate).
// - Depth on every face: the arch in orders (each ring 1 deeper and 1 narrower), a voussoir ring in a
//   second stone with a keystone, a passage 3-6 deep with a vault and a portcullis groove, a battered
//   plinth, string courses, quoins, a corbelled parapet; banners or lanterns on the faces.
// - A threshold: a podium with a broad flight of steps, a runner in the paving that leads through
//   the passage; lights on pedestals at the steps.
// - The opening clear (it is where players walk): mark it with b.markPortal; show it is a portal with
//   what the server adds (the portal plugin's particles, the title on a hologram over the arch).
// - At the end of a path or an axis from the spawn point, so it is seen from far.
// DON'T
// - A bare obsidian rectangle (the nether portal cliche), or a frame of glowstone or beacons.
// - Filling the opening with glass, water or nether portal blocks players cannot walk through.
// - A gate in the middle of the plaza with nothing leading to it, or a small arch on a big spawn.

import { local } from '../../../assets/frame/frame.mjs'
import { pavedPatch } from './_scene.mjs'

// An arched opening: `span` wide (odd), the jambs straight up to `jambTop`, then a round head of
// stair-shouldered rows, each 2 narrower (span 7: 5, 3). kind(u, h) = 'open' | 'stair' | 'solid'.
export function archOpening(span, jambTop) {
  const half = (span - 1) / 2
  const rows = []
  for (let w = span - 2; w >= 3; w -= 2) rows.push((w - 1) / 2)
  const top = jambTop + rows.length
  return {
    half, jambTop, top, crown: top + 1,
    kind(u, h) {
      const a = Math.abs(u)
      if (h <= 0 || h > top) return 'solid'
      if (h <= jambTop) return a <= half ? 'open' : 'solid'
      const w = rows[h - jambTop - 1]
      return a <= w ? 'open' : a === w + 1 ? 'stair' : 'solid'
    },
  }
}

// A gatehouse. pos = the plaza floor block under the middle of the opening, facing = toward the
// players (they walk through it away from you). It stands on a podium `rise` high with steps across
// its front; the front arch is at d = 0, between two towers that project 2 toward the players.
//   width   the passage opening (odd, 5-7)        height  the opening, floor to the top of the arch
//   depth   the passage behind the front ring (3-6) tower  tower width (odd, 5-9)
//   towerHeight  the towers' walls (the corbels, parapet and merlons go on top; default 3 above the
//           middle block)
//   rise    the podium (steps up to it)           approach  length of the paved runner in front
//   banner  dye colour of the banners on the towers (false for none)
//   stone / trim / ring / base  material families: the walls; the dressings (quoins, courses,
//           sills); the arch rings (15+ L* off the wall, here darker: the frame round the portal);
//           the plinth and podium. keystone = the block at the crown
//   field   the wall's clumped mix (default: stone bricks, mossier in the bottom courses)
export function gate(ctx, pos, facing, {
  label = 'Random Teleport', portalId, kind = 'rtp',
  width = 7, height = 10, depth = 5, tower = 7, towerHeight, rise = 2, approach = 10, banner = 'red', field,
  stone = 'stone_brick', trim = 'polished_andesite', ring = 'deepslate_brick', base = 'polished_deepslate', keystone = 'chiseled_deepslate', seed = 1,
} = {}) {
  const { b, kit } = ctx
  const L = local(pos, facing)
  const G = rise
  const at = (u, d, h) => L.at(u, d, G + h) // h from the gate's floor (the podium top)
  const set = (u, d, h, blk) => b.set(...at(u, d, h), blk)
  const setP = (u, d, h, blk) => b.set(...L.at(u, d, h), blk) // h from the plaza floor
  const dir = (du, dd) => (du > 0 ? L.right : du < 0 ? L.left : dd > 0 ? L.out : L.back)
  const M = { stone: kit.material(stone), trim: kit.material(trim), ring: kit.material(ring), base: kit.material(base) }
  const st = (m, f, half = 'bottom') => `${M[m].stairs ?? M.stone.stairs}[facing=${f},half=${half}]` // a family without stairs borrows the wall's
  const slab = m => `${M[m].slab ?? M.stone.slab}[type=bottom]`
  const even = n => ((n % 2) + 2) % 2 === 0
  // the wall: mossier in the bottom courses, clean higher up (clumped, never speckled)
  const y0 = pos[1] + G
  const low = kit.palette({ mossy_stone_bricks: 3, stone_bricks: 4, cracked_stone_bricks: 2 }, { scale: 3, seed })
  const mid = kit.palette({ stone_bricks: 7, cracked_stone_bricks: 2, mossy_stone_bricks: 1 }, { scale: 3, seed: seed + 1 })
  const wall = field ? kit.palette(field, { scale: 3, seed })
    : stone === 'stone_brick' ? kit.gradient([low, mid, mid, mid, mid, mid], { axis: 'y', from: y0 + 1, to: y0 + 19, seed }) : M.stone.block

  // the plan, in u (right) and d (toward the players)
  const P = archOpening(width, height - (width - 3) / 2) // the passage
  const O = archOpening(width + 2, P.jambTop) // the outer order at d = 0
  const C = P.half + 2 // the middle block's half width
  const T0 = C + 1 // the towers: u = ±T0 .. ±T1, d = back .. TF
  const T1 = C + tower
  const tc = C + (tower + 1) / 2 // a tower's middle
  const TF = 2
  const back = -Math.max(3, depth) // 3+: the inner ring, the portcullis, the marked opening
  const Hc = O.crown + 2 // the middle block's wall top: corbels here, parapet + 1, merlons + 2
  const Ht = towerHeight ?? Hc + 3

  // the podium: a dark plinth, paving inset on top, steps across the whole front
  const PU = T1 + 2
  const PF = TF + 3 // its front edge
  const pave = kit.palette({ polished_andesite: 5, stone_bricks: 2, andesite: 1 }, { scale: 3, seed: seed + 2 })
  for (let u = -PU; u <= PU; u += 1)
    for (let d = back - 1; d <= PF; d += 1) {
      const edge = Math.abs(u) === PU || d === back - 1
      for (let h = 1; h <= G; h += 1) setP(u, d, h, h === G && !edge ? pave : M.base.block)
    }
  for (let k = 1; k <= G; k += 1)
    for (let u = -PU; u <= PU; u += 1) {
      for (let h = 1; h < G - k + 1; h += 1) setP(u, PF + k, h, M.base.block)
      setP(u, PF + k, G - k + 1, st('stone', L.back))
    }
  // lamp pedestals on the podium, either side of the runner
  for (const s of [-1, 1]) {
    const u = s * (C + 1)
    set(u, PF - 1, 1, M.base.block)
    set(u, PF - 1, 2, M.base.wall ?? M.base.block)
    set(u, PF - 1, 3, M.base.wall ?? M.base.block)
    set(u, PF - 1, 4, M.trim.block)
    set(u, PF - 1, 5, 'minecraft:lantern[hanging=false]')
  }

  // the towers: battered plinth, quoins, a drip course, a string course the banner hangs from,
  // slits, an upper window, a corbelled parapet with machicolations and merlons
  for (const s of [-1, 1]) {
    for (let u = T0 - 1; u <= T1 + 1; u += 1)
      for (let d = back - 1; d <= TF + 1; d += 1) {
        const uu = s * u
        const side = u === T0 - 1 || u === T1 + 1
        const outside = side || d === back - 1 || d === TF + 1 // the ring 1 out from the walls
        if (outside) {
          const inner = u === T0 - 1 && d <= 0 // against the middle block: only the top shows
          const corner = side && (d === back - 1 || d === TF + 1)
          const f = u === T0 - 1 ? dir(s, 0) : u === T1 + 1 ? dir(-s, 0) : d === back - 1 ? dir(0, 1) : dir(0, -1)
          if (!inner) {
            set(uu, d, 1, M.base.block)
            set(uu, d, 2, st('base', f))
            set(uu, d, P.jambTop - 1, st('stone', f, 'top'))
          }
          set(uu, d, Hc, st('trim', f, 'top')) // a string course level with the middle's wall top
          // machicolations: a corbel under every other cell of the parapet
          const beat = side ? even(d) : even(u)
          if (beat || corner) set(uu, d, Ht, st('stone', f, 'top'))
          set(uu, d, Ht + 1, wall)
          if (beat || corner) {
            set(uu, d, Ht + 2, wall)
            set(uu, d, Ht + 3, slab('stone'))
          }
          continue
        }
        for (let h = 1; h < Ht; h += 1) set(uu, d, h, wall)
        set(uu, d, Ht, M.stone.block)
        set(uu, d, Ht + 1, slab('stone')) // the roof behind the parapet
      }
    // quoins, long and short: the corner and one cell along a face, the face swapping every 2 courses
    const corners = [[T0, TF, 1, -1, 3], [T1, TF, -1, -1, 3], [T1, back, -1, 1, 3], [T0, back, 1, 1, Hc + 1]]
    for (const [u, d, du, dd, h0] of corners)
      for (let h = h0; h < Ht; h += 1) {
        if (h === P.jambTop - 1 || h === Hc) continue
        set(s * u, d, h, M.trim.block)
        if (even(Math.floor((h - 3) / 2))) set(s * (u + du), d, h, M.trim.block)
        else set(s * u, d + dd, h, M.trim.block)
      }
    // arrow slits: 1 x 3, 2 deep, dark at the back, a sill under
    const slit = (u, d, du, dd, h0, n = 3) => {
      for (let h = h0; h < h0 + n; h += 1) {
        set(u, d, h, 'minecraft:air')
        set(u - du, d - dd, h, 'minecraft:air')
        set(u - 2 * du, d - 2 * dd, h, 'minecraft:deepslate_tiles')
      }
      set(u, d, h0 - 1, M.trim.block)
    }
    slit(s * tc, TF, 0, 1, 4)
    slit(s * tc, TF, 0, 1, Hc + 1, 2)
    const mid2 = Math.round((TF + back) / 2)
    for (const h0 of [4, P.jambTop + 2]) slit(s * T1, mid2, s, 0, h0)
    // a banner hung from the string course, a swallowtail at the bottom (one colour: a stripe or a
    // charge in another wool reads as a letter from afar)
    if (banner)
      for (let u = tc - 1; u <= tc + 1; u += 1)
        for (let h = P.jambTop + 1; h < Hc; h += 1) {
          if (h === P.jambTop + 1 && u === tc) continue
          set(s * u, TF + 1, h, `minecraft:${banner}_wool`)
        }
  }

  // the middle block: the outer order at d = 0, the passage behind it (a vault, ribs in trim at both
  // ends), a portcullis groove
  for (let d = back; d <= 0; d += 1)
    for (let u = -C; u <= C; u += 1)
      for (let h = 1; h <= Hc; h += 1) {
        const A = d === 0 ? O : P
        const k = A.kind(u, h)
        if (k === 'open') continue
        const face = d === 0 || d === back || d === -1
        if (k === 'stair') {
          set(u, d, h, st(face ? 'ring' : 'stone', u < 0 ? L.left : L.right, 'top'))
          continue
        }
        // the voussoir ring: the solid cells round the opening's head, on the arch faces
        const voussoir = face && h > A.jambTop - 1 && [-1, 0, 1].some(du => [-1, 0, 1].some(dh => A.kind(u + du, h + dh) !== 'solid'))
        set(u, d, h, voussoir ? M.ring.block : wall)
      }
  // the keystone, proud of the ring, and the imposts at the springing
  set(0, 0, O.crown, `minecraft:${keystone}`)
  set(0, 1, O.crown, `minecraft:${keystone}`)
  for (const s of [-1, 1]) set(s * C, 0, O.jambTop, `minecraft:${keystone}`)
  // the portcullis: a groove up the jambs, the gate raised into the head (its bottom bars above
  // the marked opening), a lantern on a chain in the vault
  const pg = -2
  for (let h = 1; h <= P.jambTop; h += 1) for (const s of [-1, 1]) set(s * (P.half + 1), pg, h, 'minecraft:air')
  for (let u = -P.half; u <= P.half; u += 1)
    for (let h = P.jambTop; h <= P.top; h += 1) if (P.kind(u, h) === 'open') set(u, pg, h, 'minecraft:iron_bars')
  const ld = Math.max(back, pg - 2) // the lantern behind the portcullis, still under the vault
  set(0, ld, P.top, 'minecraft:chain[axis=y]')
  set(0, ld, P.top - 1, 'minecraft:lantern[hanging=true]')
  // the parapet: machicolations at the front (corbels with murder holes between), merlons
  for (let u = -C; u <= C; u += 1) {
    if (even(u)) set(u, 1, Hc, st('stone', L.back, 'top'))
    set(u, 1, Hc + 1, wall)
    set(u, back, Hc + 1, wall)
    if (even(u)) {
      for (const d of [1, back]) {
        set(u, d, Hc + 2, wall)
        set(u, d, Hc + 3, slab('stone'))
      }
    }
  }

  // the threshold: a runner of light stone with dark borders, from the plaza through the passage
  for (let d = back; d <= PF; d += 1) {
    const w = d <= -1 ? P.half : d === 0 ? O.half : C - 1
    for (let u = -w; u <= w; u += 1) set(u, d, 0, Math.abs(u) <= 1 ? 'minecraft:smooth_stone' : Math.abs(u) === w ? M.base.block : M.trim.block)
  }
  for (let d = PF + G + 1; d <= PF + G + approach; d += 1)
    for (let u = -2; u <= 2; u += 1) setP(u, d, 0, Math.abs(u) <= 1 ? 'minecraft:smooth_stone' : M.base.block)

  // record the opening (the middle of the passage, below the portcullis) and the title over the arch
  const lo = at(-P.half, -3, 1)
  const hi = at(P.half, -2, P.jambTop - 1)
  ctx.hologram(portalId ?? 'gate', label, at(0, 2, O.crown + 2)) // its top line under the machicolations, the dark ring below it
  return b.markPortal(lo, hi, { id: portalId, label, kind, facing })
}

export const figure = { size: 64, height: 30, floorY: 3, camera: { eye: [40, 5, 46], lookAt: [32, 13, 20], fov: 64, width: 640, height: 440 } }
export function demo(ctx, which) {
  pavedPatch(ctx)
  const { b, FY } = ctx
  if (which === 'good') gate(ctx, [32, FY, 22], 'south', { portalId: 'rtp' })
  else {
    // the nether-portal cliche at the same size: obsidian around purple glass, glowstone corners
    for (let x = 28; x <= 36; x += 1)
      for (let h = 1; h <= 11; h += 1) {
        const edge = x === 28 || x === 36 || h === 1 || h === 11
        const corner = (x === 28 || x === 36) && (h === 1 || h === 11)
        b.set(x, FY + h, 22, corner ? 'minecraft:glowstone' : edge ? 'minecraft:obsidian' : 'minecraft:purple_stained_glass')
      }
  }
}
