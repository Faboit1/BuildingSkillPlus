// The site: a floating island (every setting is an island variant, so the spawn pastes into a void
// world or the sky of any world), levelled pads under the layout's slots, and the plaza paving.
//
// Settings (theme default, or brief.setting):
//   island    gentle rolling ground, a soft shore, a deep rocky underside
//   plains    nearly flat ground
//   valley    hills rising toward the rim, the plaza in the hollow
//   mountain  a rocky peak behind the hero (north), the plaza on its apron
//   coast     a lake cove on the south-east side with sand beaches
//
// Layout input (ctx.layout): { plaza: { cx, cz, r } | { x0, z0, x1, z1, round }, pads: [{ x0, z0,
// x1, z1, y, blend }], islandR, flat(x, z) → true for ground that must stay at FY }
// Output (ctx.site): groundY(x, z) walking-surface block level (-1 off the island), land(x, z),
// level(rect, y), heights.

const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function buildSite(ctx) {
  const { b, kit, S, FY, C, theme, layout, seed } = ctx
  const { noise } = kit
  const setting = theme.setting ?? 'island'
  const R = layout.islandR ?? S / 2 - 3
  const [cx, cz] = C
  const plaza = layout.plaza
  // distance outside the plaza (0 inside)
  const plazaOut = (x, z) => {
    if (plaza.r !== undefined) return Math.max(0, Math.hypot(x - plaza.cx, z - plaza.cz) - plaza.r)
    const dx = Math.max(plaza.x0 - x, 0, x - plaza.x1)
    const dz = Math.max(plaza.z0 - z, 0, z - plaza.z1)
    return Math.hypot(dx, dz)
  }
  // the coastline: radius wobbles with the angle (low-frequency) and with fbm (high)
  const edgeE = (x, z) => {
    const a = Math.atan2(z - cz, x - cx)
    const wob = 1 + 0.07 * Math.sin(3 * a + seed) + 0.05 * Math.sin(5 * a + 2 * seed) + 0.06 * noise.fbm2(x, z, { scale: 14, seed: seed + 21 })
    return Math.hypot(x - cx, z - cz) / (R * wob)
  }
  const cove = setting === 'coast' ? { x: cx + R * 0.52, z: cz + R * 0.5, r: R * 0.3 } : null
  // the mountain: a ridge round the north-west rim, behind the hero's shoulder, highest at its middle
  const ridgeDir = (-35 * Math.PI) / 180
  const peak = setting === 'mountain' ? { dir: ridgeDir, height: S * 0.3 } : null

  const relief = (x, z) => {
    const e = edgeE(x, z)
    const n1 = noise.fbm2(x, z, { scale: 18, seed: seed + 31 })
    const n2 = noise.fbm2(x, z, { scale: 7, seed: seed + 32 })
    let h = 0
    if (setting === 'plains') h = 0.6 + 0.8 * n1
    else if (setting === 'valley') h = 1 + 1.2 * n1 + 16 * smooth(0.5, 0.92, e) * (0.65 + 0.5 * n1 + 0.2 * n2)
    else h = 1.2 + 1.8 * n1 + 0.8 * n2 // island, coast, mountain
    if (peak) {
      // angle from north, clockwise; the ridge falls off over ±80° from its direction
      const a = Math.atan2(x - cx, -(z - cz))
      let da = Math.abs(a - peak.dir)
      if (da > Math.PI) da = 2 * Math.PI - da
      const along = Math.max(0, Math.cos(Math.min(Math.PI / 2, da * 1.15))) ** 1.4
      const ridged = noise.ridged2 ? noise.ridged2(x, z, { scale: 14, seed: seed + 33 }) : n2
      h += peak.height * along * smooth(0.5, 0.93, e) * (0.7 + 0.45 * ridged + 0.15 * n1)
    }
    // the shore: the ground rolls down over the last stretch to the cliff (a mountain keeps its cliffs)
    h -= (peak ? 3.5 * (1 - smooth(0.6, 0.9, h / 12)) : 3.5) * smooth(0.82, 1, e)
    return h
  }

  // heightfield
  const N = S * S
  const top = new Int16Array(N).fill(-1)
  const bottom = new Int16Array(N).fill(-1)
  const D = FY - 3
  for (let x = 0; x < S; x += 1)
    for (let z = 0; z < S; z += 1) {
      const e = edgeE(x, z)
      if (e >= 1) continue
      let h = relief(x, z)
      // the plaza and the flat ring around it (blended over 7 blocks)
      const out = plazaOut(x, z)
      const flatW = layout.flat?.(x, z) ? 0 : smooth(1, 8, out)
      h = h * flatW
      top[x + S * z] = Math.round(FY + h)
      // the underside: deepest under the middle, lumpy, with hanging lobes
      const under = D * Math.pow(Math.max(0, 1 - e), 0.55) * (0.78 + 0.22 * noise.fbm2(x, z, { scale: 9, seed: seed + 41 }))
      const lobes = Math.max(0, noise.fbm2(x, z, { scale: 5, seed: seed + 42 })) * 6 * (1 - e)
      bottom[x + S * z] = Math.max(1, Math.round(FY - 2 - under - lobes))
    }
  // pads: level the ground under every slot, blending back to the natural relief
  for (const p of layout.pads ?? []) {
    const blend = p.blend ?? 4
    for (let x = Math.max(0, p.x0 - blend); x <= Math.min(S - 1, p.x1 + blend); x += 1)
      for (let z = Math.max(0, p.z0 - blend); z <= Math.min(S - 1, p.z1 + blend); z += 1) {
        const i = x + S * z
        if (top[i] < 0) continue
        const dx = Math.max(p.x0 - x, 0, x - p.x1)
        const dz = Math.max(p.z0 - z, 0, z - p.z1)
        const t = smooth(0, blend + 1, Math.hypot(dx, dz))
        top[i] = Math.round(p.y * (1 - t) + top[i] * t)
      }
  }
  // the coast cove: a basin with water at FY - 1 and sand beaches
  const water = new Uint8Array(N)
  if (cove) {
    for (let x = 0; x < S; x += 1)
      for (let z = 0; z < S; z += 1) {
        const i = x + S * z
        if (top[i] < 0) continue
        const d = Math.hypot(x - cove.x, z - cove.z) / (cove.r * (1 + 0.15 * noise.fbm2(x, z, { scale: 8, seed: seed + 51 })))
        if (d < 1 && edgeE(x, z) < 0.9 && plazaOut(x, z) > 6 && !layout.flat?.(x, z)) {
          const depth = Math.round(4 * (1 - d) ** 0.7)
          if (depth >= 1) {
            top[i] = FY - 1 - depth
            water[i] = 1
          } else top[i] = Math.min(top[i], FY)
        } else if (d < 1.25 && top[i] > FY) top[i] = Math.round(FY + (top[i] - FY) * smooth(1, 1.25, d))
      }
    // banks: every column next to the water stands at least at the water level, so nothing spills
    for (let pass = 0; pass < 2; pass += 1)
      for (let x = 1; x < S - 1; x += 1)
        for (let z = 1; z < S - 1; z += 1) {
          if (!water[x + S * z]) continue
          for (let dx = -1; dx <= 1; dx += 1)
            for (let dz = -1; dz <= 1; dz += 1) {
              const j = x + dx + S * (z + dz)
              if (water[j]) continue
              if (top[j] < 0) {
                water[x + S * z] = 0 // the coast is too close: no water here
                top[x + S * z] = FY - 1
              } else if (top[j] < FY - 1) top[j] = FY - 1
            }
        }
  }

  // write the columns
  const ground = ctx.paint.ground
  const snowy = /snow/.test(Object.keys(theme.ground)[0])
  const soil = kit.palette(snowy ? { dirt: 3, coarse_dirt: 1 } : { dirt: 5, coarse_dirt: 2, rooted_dirt: 1 }, { scale: 3, seed: seed + 61 })
  const rock = kit.palette({ stone: 6, andesite: 3, tuff: 1, cobblestone: 1 }, { scale: 4, seed: seed + 62 })
  const deep = kit.palette({ deepslate: 4, cobbled_deepslate: 1, tuff: 2, stone: 2 }, { scale: 4, seed: seed + 63 })
  const peakRock = kit.palette({ stone: 5, andesite: 2, cobblestone: 1, gravel: 1 }, { scale: 3, seed: seed + 64 })
  const land = (x, z) => x >= 0 && z >= 0 && x < S && z < S && top[x + S * z] >= 0
  for (let x = 0; x < S; x += 1)
    for (let z = 0; z < S; z += 1) {
      const i = x + S * z
      const h = top[i]
      if (h < 0) continue
      const lo = Math.min(bottom[i], h - 4)
      // steep ground (a cliff on the mountain, or the shore drop) shows rock, not grass
      let slope = 0
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = x + dx + S * (z + dz)
        slope = Math.max(slope, land(x + dx, z + dz) ? Math.abs(top[j] - h) : 0)
      }
      const high = peak && h > FY + 14
      for (let y = Math.max(0, lo); y <= h; y += 1) {
        const d = h - y
        let p
        if (water[i]) p = d === 0 ? 'minecraft:sand' : d < 3 ? 'minecraft:sand' : rock
        else if (d === 0) p = high && slope >= 2 ? peakRock : slope >= 3 ? rock : ground
        else if (d <= 3 && !(high && slope >= 2)) p = soil
        else p = y < lo + (h - lo) * 0.45 ? deep : rock
        b.set(x, y, z, p)
      }
      if (water[i]) for (let y = h + 1; y <= FY - 1; y += 1) b.set(x, y, z, 'minecraft:water')
      if (snowy && !water[i] && h > FY + 18) b.set(x, h, z, 'minecraft:snow_block')
    }
  // sand beach ring around the cove
  if (cove) {
    for (let x = 1; x < S - 1; x += 1)
      for (let z = 1; z < S - 1; z += 1) {
        const i = x + S * z
        if (top[i] < 0 || water[i]) continue
        let near = false
        for (let dx = -3; dx <= 3 && !near; dx += 1) for (let dz = -3; dz <= 3; dz += 1) if (water[x + dx + S * (z + dz)] && dx * dx + dz * dz <= 9) { near = true; break }
        if (near && top[i] <= FY + 1 && !layout.flat?.(x, z)) b.set(x, top[i], z, kit.hash01(x, 0, z, 7) < 0.8 ? 'minecraft:sand' : 'minecraft:gravel')
      }
  }

  const groundY = (x, z) => (land(Math.round(x), Math.round(z)) ? top[Math.round(x) + S * Math.round(z)] : -1)
  // cut or fill a rectangle to block level y (used by buildings that need a flat pad later)
  const level = ({ x0, z0, x1, z1 }, y) => {
    for (let x = Math.max(0, x0); x <= Math.min(S - 1, x1); x += 1)
      for (let z = Math.max(0, z0); z <= Math.min(S - 1, z1); z += 1) {
        const i = x + S * z
        if (top[i] < 0) continue
        const h = top[i]
        if (h > y) for (let yy = y + 1; yy <= h; yy += 1) b.remove(x, yy, z)
        for (let yy = Math.min(h, y); yy <= y; yy += 1) b.set(x, yy, z, yy === y ? ground : soil)
        top[i] = y
      }
  }
  return { setting, top, groundY, land, level, isWater: (x, z) => land(x, z) && water[x + S * z] === 1, edgeE, plazaOut, ground, soil, rock }
}

// ------------------------------------------------------------------ paving

// Round plaza paving in target rings (the autumn reference): rings = [{ r0, r1, paint }] painted
// over the field from the centre out; `kerb` is the outermost band; openings = [{ angle, width }]
// keep the ring bands from crossing the path mouths (the field continues there).
export function paveRound(ctx, { cx, cz, r, rings = [], kerb, field, y = ctx.FY, wobble = 0.8 }) {
  const { b, kit, seed } = ctx
  field ??= ctx.paint.field
  for (let x = Math.floor(cx - r - 2); x <= Math.ceil(cx + r + 2); x += 1)
    for (let z = Math.floor(cz - r - 2); z <= Math.ceil(cz + r + 2); z += 1) {
      const d = Math.hypot(x - cx, z - cz)
      const edge = r + wobble * kit.noise.fbm2(x, z, { scale: 5, seed: seed + 71 })
      if (d > edge) continue
      if (!ctx.site.land(x, z)) continue
      let p = field
      for (const ring of rings) if (d >= ring.r0 && d < ring.r1) p = ring.paint
      if (kerb && d > edge - 1) p = kerb
      b.set(x, y, z, p)
      ctx.site.top[x + ctx.S * z] = y
    }
}

// Square plaza paving with an inset border and a coursed field.
export function paveRect(ctx, { x0, z0, x1, z1, border, field, y = ctx.FY, corner = 0 }) {
  const { b } = ctx
  field ??= ctx.paint.field
  for (let x = x0; x <= x1; x += 1)
    for (let z = z0; z <= z1; z += 1) {
      const cxd = Math.min(x - x0, x1 - x)
      const czd = Math.min(z - z0, z1 - z)
      if (corner && cxd < corner && czd < corner && Math.hypot(corner - cxd, corner - czd) > corner + 0.3) continue
      if (!ctx.site.land(x, z)) continue
      b.set(x, y, z, border && (cxd === 0 || czd === 0) ? border : field)
      ctx.site.top[x + ctx.S * z] = y
    }
}

// A worn walking path on the ground between two features (soft edges, follows the terrain).
export function pavePath(ctx, points, { width = 5, paint, fray = true } = {}) {
  const { b, kit, seed } = ctx
  paint ??= ctx.paint.path
  b.path(points, { width, paint })
  if (!fray) return
  // fray the edges: a few path blocks one beyond each side, grass tufts creeping in
  const sampled = ctx.kit.plan.resamplePolyline ? ctx.kit.plan.resamplePolyline(points, 1) : points
  for (const [x, z] of sampled) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const px = Math.round(x + dx * (width / 2 + 0.5))
      const pz = Math.round(z + dz * (width / 2 + 0.5))
      if (kit.hash01(px, 1, pz, seed + 81) < 0.3) {
        const gy = ctx.site.groundY(px, pz)
        if (gy > 0 && /grass_block|snow_block|moss_block|podzol/.test(b.nameAt(px, gy, pz) ?? '')) b.set(px, gy, pz, paint)
      }
    }
  }
}
