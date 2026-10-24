// JAPANESE SHRINE (v2 — iterating)

const SIZE = [72, 54, 72]
const G = 4 // ground surface level (grass top); things stand at G + 1

const TILE = { stairs: 'minecraft:deepslate_tile_stairs', slab: 'minecraft:deepslate_tile_slab', block: 'minecraft:deepslate_tiles' }
const RIDGE = { stairs: 'minecraft:polished_blackstone_stairs', slab: 'minecraft:polished_blackstone_slab', block: 'minecraft:polished_blackstone' }
const RAFTER = { stairs: 'minecraft:spruce_stairs', slab: 'minecraft:spruce_slab', block: 'minecraft:spruce_planks' }
const SPRUCE = RAFTER

const POST = 'minecraft:dark_oak_log[axis=y]'
const BEAM = axis => `minecraft:stripped_dark_oak_log[axis=${axis}]`
const PLASTER = 'minecraft:calcite'
const LATTICE = f => `minecraft:dark_oak_trapdoor[facing=${f},open=true,half=bottom]`
const SHOJI = f => `minecraft:jungle_trapdoor[facing=${f},open=true,half=bottom]`
const VERMILION = 'minecraft:red_terracotta'
const PAPER_GLOW = 'minecraft:ochre_froglight'
const BLACK = 'minecraft:polished_blackstone'

const DIRS = [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]]
const OPP = { east: 'west', west: 'east', north: 'south', south: 'north' }
const FACES = [['south', 0, 1, 'x'], ['north', 0, -1, 'x'], ['east', 1, 0, 'z'], ['west', -1, 0, 'z']]

// ------------------------------------------------------------------ swept roofs
function ringLevels(pitch, n) {
  const rise = i => Math.max(0.5, Math.round((Array.isArray(pitch) ? pitch[Math.min(i, pitch.length - 1)] : pitch) * 2) / 2)
  const out = [rise(0) <= 0.5 ? 0.5 : 1]
  for (let i = 1; i < n; i += 1) out.push(out[i - 1] + rise(i))
  return out
}

function roofField({ x0, z0, x1, z1, pitch, stopRing = Infinity, gable = null, lift = 0, liftStep = 0.5, hipBead = true }) {
  const n = Math.ceil(Math.max(x1 - x0 + 1, z1 - z0 + 1) / 2) + 1
  const L = ringLevels(pitch, n)
  const field = new Map()
  let maxRing = 0
  for (let x = x0; x <= x1; x += 1) {
    for (let z = z0; z <= z1; z += 1) {
      const ex = Math.min(x - x0, x1 - x)
      const ez = Math.min(z - z0, z1 - z)
      let ring = Math.min(ex, ez)
      let sec = 'hip'
      if (gable) {
        const along = gable.axis === 'x' ? ex : ez
        if (along >= gable.inset) {
          ring = gable.axis === 'x' ? ez : ex
          sec = 'gable'
        }
      }
      if (ring >= stopRing) continue
      let t = L[ring]
      // hip line: a 4-connected staircase along the diagonal so it reads as one ridge
      const hip = sec === 'hip' && ring >= 1 && (ex === ez || ex === ez + 1) && Math.min(ex, ez) >= 1
      if (sec === 'hip' && lift > 0) t += Math.max(0, Math.round((lift - liftStep * (ex + ez)) * 2) / 2)
      if (hip && hipBead) t += 0.5
      maxRing = Math.max(maxRing, ring)
      field.set(`${x},${z}`, { x, z, t, ring, sec, hip, ex, ez })
    }
  }
  for (const c of field.values()) c.ridge = c.sec === 'gable' && c.ring === maxRing
  field.levels = L
  return field
}

function rasterRoof(b, field, { y, mat = TILE, under = RAFTER, ridge = RIDGE, thickness = 1.5, rim = null, only = null }) {
  for (const c of field.values()) {
    if (only && !only(c)) continue
    let minN = Infinity
    const lower = []
    for (const [f, dx, dz] of DIRS) {
      const n = field.get(`${c.x + dx},${c.z + dz}`)
      if (!n || n.sec !== c.sec) continue
      minN = Math.min(minN, n.t)
      if (n.t <= c.t - 1) lower.push([f, n.t])
    }
    let bottom = Math.min(c.t - thickness, minN - 0.5)
    if (rim && rim.test(c.x, c.z)) bottom = Math.min(bottom, rim.floor - y)
    const top = y + c.t
    const bot = y + bottom
    for (let yy = Math.floor(bot); yy < Math.ceil(top); yy += 1) {
      const lo = Math.max(bot, yy)
      const hi = Math.min(top, yy + 1)
      if (hi - lo < 0.5) continue
      const isTop = hi === top
      const m = isTop ? (c.hip || c.ridge ? ridge : mat) : (hi > y + minN ? mat : under)
      let block
      if (hi - lo === 1) {
        block = m.block
        if (isTop && lower.length) {
          const dirs = lower.map(l => l[0])
          const opposite = dirs.some(d => dirs.includes(OPP[d]))
          if (!opposite && dirs.length <= 2) {
            lower.sort((a, b2) => a[1] - b2[1])
            block = `${m.stairs}[facing=${OPP[lower[0][0]]},half=bottom]`
          }
        }
      } else if (lo === yy) block = `${m.slab}[type=bottom]`
      else block = `${m.slab}[type=top]`
      b.set(c.x, yy, c.z, block)
    }
  }
}

function roofBottom(b, x, z, y0, y1) {
  for (let y = y0; y <= y1; y += 1) if (b.has(x, y, z)) return y
  return null
}

export default function build(api) {
  const { kit } = api
  const b = api.builder(SIZE, { seed: 11 })
  const rng = kit.rng(11)
  const hash = (x, z, s = 0) => kit.hash01(x, 0, z, s)

  // ================================================================ GROUND
  // tsukiyama: a few low artificial hills in the garden; paths, courtyard and buildings stay at G
  const MOUNDS = [[9, 61, 7, 2], [68, 57, 5, 3], [64, 6, 7, 2], [5, 40, 5, 1]]
  const mound = (x, z) => {
    let h = 0
    for (const [mx, mz, r, mh] of MOUNDS) {
      const d = Math.hypot(x - mx, z - mz) / r
      if (d < 1) h = Math.max(h, mh * (0.5 + 0.5 * Math.cos(Math.PI * d)) + 0.6 * kit.noise.fbm2(x, z, { scale: 4, seed: 21 }) * (1 - d))
    }
    return Math.max(0, Math.round(h))
  }
  const gy = b.terrain({
    base: 0,
    height: (x, z) => G + mound(x, z),
    layers: [{ depth: 1, paint: kit.palette({ grass_block: 6, moss_block: 3 }, { scale: 5, seed: 3 }) }, { depth: 2, paint: 'dirt' }, { paint: 'stone' }],
  })
  const STONE = kit.palette({ stone_bricks: 6, andesite: 2, polished_andesite: 2, mossy_stone_bricks: 1 }, { scale: 3, seed: 5 })
  const GRAVEL = (x, z) => (z % 2 === 0 ? 'minecraft:gravel' : 'minecraft:light_gray_concrete_powder')
  const GRAVEL_X = (x, z) => (x % 2 === 0 ? 'minecraft:gravel' : 'minecraft:light_gray_concrete_powder')

  // ================================================================ PAGODA
  const PX = 54
  const PZ = 21
  const tiers = [
    { W: 5, E: 9, eave: 11, top: 12 },
    { W: 4, E: 8, eave: 18, top: 18 },
    { W: 4, E: 7, eave: 24, top: 24 },
    { W: 3, E: 6, eave: 30, top: 30 },
    { W: 3, E: 5, eave: 35, top: 35 },
  ]
  // gravel drip-apron, then the kidan
  b.box([PX - 9, G, PZ - 9], [PX + 9, G, PZ + 9], GRAVEL_X)
  b.box([PX - 7, G + 1, PZ - 7], [PX + 7, G + 1, PZ + 7], STONE)
  b.box([PX - 7, G + 2, PZ - 7], [PX + 7, G + 2, PZ + 7], 'polished_andesite')
  for (let x = PX - 2; x <= PX + 2; x += 1) {
    b.set(x, G + 1, PZ + 8, 'stone_brick_stairs[facing=north]')
    b.set(x, G + 2, PZ + 7, 'stone_brick_stairs[facing=north]')
  }
  const pFloor = G + 3
  tiers.forEach((t, i) => {
    const W = t.W
    const y0 = i === 0 ? pFloor : tiers[i - 1].top + 1
    const p = W >= 5 ? 2 : 1
    b.box([PX - W + 1, y0 - 1, PZ - W + 1], [PX + W - 1, y0 - 1, PZ + W - 1], i === 0 ? 'polished_andesite' : 'dark_oak_planks')
    for (let y = y0; y <= t.top; y += 1) {
      const r = t.top - y
      for (let u = -W; u <= W; u += 1) {
        for (const [f, nx, nz, ax] of FACES) {
          const x = nx ? PX + nx * W : PX + u
          const z = nz ? PZ + nz * W : PZ + u
          const post = Math.abs(u) === W || Math.abs(u) === p
          const centre = Math.abs(u) < p
          let paint = PLASTER
          if (post) paint = POST
          else if (r === 0) paint = BEAM(ax)
          else if (i === 0) {
            if (y === y0 || r === 3) paint = BEAM(ax)
            else if (centre && r > 3) {
              paint = PAPER_GLOW
              b.set(x + nx, y, z + nz, LATTICE(f))
            }
            else if (!centre && r === 4) paint = LATTICE(OPP[f])
          } else if (centre && (r === 1 || r === 2)) paint = LATTICE(OPP[f])
          b.set(x, y, z, paint)
        }
      }
    }
  })
  tiers.forEach((t, i) => {
    const next = tiers[i + 1]
    const field = roofField({
      x0: PX - t.E, z0: PZ - t.E, x1: PX + t.E, z1: PZ + t.E,
      pitch: next ? [0.5, 0.5, 1, 1, 1] : [0.5, 0.5, 1, 1, 1, 2],
      stopRing: next ? t.E - next.W : Infinity,
      lift: 1.5,
    })
    rasterRoof(b, field, { y: t.eave, rim: { test: (x, z) => Math.max(Math.abs(x - PX), Math.abs(z - PZ)) === t.W, floor: t.top + 1 } })
    t.field = field
    // brackets: one cove row under the eave, a second step at each post
    const W = t.W
    const p = W >= 5 ? 2 : 1
    for (let u = -W; u <= W; u += 1) {
      for (const [f, nx, nz] of FACES) {
        for (const k of [1, 2]) {
          if (k === 2 && !(Math.abs(u) === W || Math.abs(u) === p)) continue
          const x = nx ? PX + nx * (W + k) : PX + u
          const z = nz ? PZ + nz * (W + k) : PZ + u
          const rb = roofBottom(b, x, z, t.top - 1, t.top + 4)
          if (rb !== null && !b.has(x, rb - 1, z)) b.set(x, rb - 1, z, `${RAFTER.stairs}[facing=${OPP[f]},half=top]`)
        }
      }
    }
    // wind-bell lanterns under the four upturned corner tips
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = PX + sx * t.E
      const z = PZ + sz * t.E
      const rb = roofBottom(b, x, z, t.eave - 2, t.eave + 3)
      if (rb !== null) b.set(x, rb - 1, z, 'minecraft:lantern[hanging=true]')
    }
  })
  // shinbashira + sorin
  const apex = b.topY(PX, PZ)
  b.box([PX, pFloor, PZ], [PX, tiers[4].top, PZ], POST)
  {
    // roban (dew basin): a slab collar on the last roof ring + a black block on the apex
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
      if (dx || dz) b.set(PX + dx, apex - 1, PZ + dz, `${RIDGE.slab}[type=bottom]`)
    }
    b.set(PX, apex, PZ, BLACK)
    b.set(PX, apex + 1, PZ, BLACK)
    // nine rings: dark wall posts separated by thin copper rods (bronze glints)
    const mast = ['polished_blackstone_wall', 'lightning_rod', 'polished_blackstone_wall', 'lightning_rod', 'polished_blackstone_wall', 'lightning_rod', 'polished_blackstone_wall', 'lightning_rod', 'polished_blackstone_wall', 'chain', 'lightning_rod']
    mast.forEach((id, k) => b.set(PX, apex + 2 + k, PZ, id))
  }

  // ================================================================ MAIN HALL
  const HX = [20, 23, 26, 30, 33, 36]
  const HZ = [11, 15, 19, 23]
  const hx0 = 20, hx1 = 36, hz0 = 11, hz1 = 23, hcx = 28
  const hFloor = G + 3
  const hTop = G + 8
  b.box([hx0 - 4, G, hz0 - 4], [hx1 + 4, G, hz1 + 4], GRAVEL_X)
  b.box([hx0 - 2, G + 1, hz0 - 2], [hx1 + 2, G + 2, hz1 + 2], STONE)
  b.box([hx0 - 2, hFloor, hz0 - 2], [hx1 + 2, hFloor, hz1 + 2], 'spruce_planks')
  b.box([hx0 + 1, hFloor, hz0 + 1], [hx1 - 1, hFloor, hz1 - 1], 'stripped_bamboo_block[axis=x]')
  for (let x = hcx - 3; x <= hcx + 3; x += 1) {
    b.set(x, G + 1, hz1 + 5, 'stone_brick_stairs[facing=north]')
    b.box([x, G + 1, hz1 + 3], [x, G + 1, hz1 + 4], 'stone_bricks')
    b.set(x, G + 2, hz1 + 4, 'stone_brick_stairs[facing=north]')
    b.set(x, G + 2, hz1 + 3, 'stone_bricks')
    b.set(x, hFloor, hz1 + 3, 'spruce_stairs[facing=north]')
  }
  const hy = G + 8
  const HPITCH = [0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1, 1]
  const hipF = roofField({ x0: hx0 - 3, z0: hz0 - 3, x1: hx1 + 3, z1: hz1 + 3, pitch: HPITCH, lift: 2 })
  const onRim = (x, z) => ((x === hx0 || x === hx1) && z >= hz0 && z <= hz1) || ((z === hz0 || z === hz1) && x >= hx0 && x <= hx1)
  rasterRoof(b, hipF, { y: hy, thickness: 1, rim: { test: onRim, floor: hTop + 1 } })
  const INSET = 4
  const gabF = roofField({ x0: hx0 - 3, z0: hz0 - 3, x1: hx1 + 3, z1: hz1 + 3, pitch: HPITCH, gable: { axis: 'x', inset: INSET } })
  rasterRoof(b, gabF, { y: hy, thickness: 1, only: c => c.sec === 'gable' })
  {
    const L = gabF.levels
    const shelfTop = hy + L[INSET]
    for (const [gx, inward, out] of [[hx0 - 3 + INSET, 1, 'west'], [hx1 + 3 - INSET, -1, 'east']]) {
      const fx = gx + inward
      for (let z = hz0 - 3; z <= hz1 + 3; z += 1) {
        const c = gabF.get(`${fx},${z}`)
        if (!c || c.sec !== 'gable') continue
        const topPiece = Math.ceil(hy + c.t) - 1
        for (let y = shelfTop; y < topPiece; y += 1) {
          const centre = z === (hz0 + hz1) / 2
          b.set(fx, y, z, y === shelfTop ? BEAM('z') : centre ? POST : PLASTER)
        }
        const rc = gabF.get(`${gx},${z}`)
        if (rc && rc.t > L[INSET]) {
          const ry = Math.ceil(hy + rc.t) - 1
          b.set(gx - inward, ry, z, `minecraft:dark_oak_trapdoor[facing=${out},open=true,half=bottom]`, { keep: true })
        }
      }
    }
    const rz = (hz0 + hz1) / 2
    const ridgeTop = hy + gabF.get(`${hcx},${rz}`).t
    for (let x = hx0 - 3 + INSET; x <= hx1 + 3 - INSET; x += 1) b.set(x, ridgeTop, rz, `${RIDGE.slab}[type=bottom]`)
    for (const [x, f] of [[hx0 - 3 + INSET, 'east'], [hx1 + 3 - INSET, 'west']]) {
      b.set(x, ridgeTop, rz, BLACK)
      b.set(x, ridgeTop + 1, rz, `${RIDGE.stairs}[facing=${f},half=bottom]`)
    }
  }
  for (const x of HX) for (const z of HZ) {
    if (x !== hx0 && x !== hx1 && z !== hz0 && z !== hz1) continue
    b.box([x, hFloor, z], [x, hTop, z], POST)
  }
  // Walls are screens between the posts. Shoji = a light lattice trapdoor hung one block OUTSIDE
  // the wall plane over a paper-white block in the plane: the facade gains relief and the
  // interior face stays flush. The front doors use ochre froglight as "lit paper" for the night.
  const PAPER_LIT = 'minecraft:ochre_froglight'
  const wallCell = (y, ax, kind) => {
    const r = y - hFloor
    if (r === 3 || y === hTop) return BEAM(ax)
    if (kind === 'door') return r <= 2 ? PAPER_LIT : PLASTER
    if (kind === 'window') return r === 1 ? 'minecraft:dark_oak_planks' : PLASTER
    return r === 1 ? 'minecraft:dark_oak_planks' : PLASTER
  }
  const shoji = (x, y, z, f) => b.set(x, y, z, SHOJI(f))
  for (let x = hx0 + 1; x < hx1; x += 1) {
    if (HX.includes(x)) continue
    const centreBay = x > 26 && x < 30
    const innerBay = (x > 23 && x < 26) || (x > 30 && x < 33)
    for (let y = hFloor + 1; y <= hTop; y += 1) {
      const r = y - hFloor
      b.set(x, y, hz0, wallCell(y, 'x', 'wall'))
      if (centreBay && r <= 2) { b.set(x, y, hz1, 'air'); continue }
      b.set(x, y, hz1, wallCell(y, 'x', innerBay ? 'door' : centreBay ? 'wall' : 'window'))
      if (innerBay && r <= 2) shoji(x, y, hz1 + 1, 'south')
      if (!innerBay && !centreBay && r === 2) shoji(x, y, hz1 + 1, 'south')
    }
  }
  for (let z = hz0 + 1; z < hz1; z += 1) {
    if (HZ.includes(z)) continue
    const midBay = z > 15 && z < 19
    for (let y = hFloor + 1; y <= hTop; y += 1) {
      for (const [x, f, out] of [[hx0, 'west', -1], [hx1, 'east', 1]]) {
        b.set(x, y, z, wallCell(y, 'z', midBay ? 'window' : 'wall'))
        if (midBay && y === hFloor + 2) shoji(x + out, y, z, f)
      }
    }
  }
  // interior: ceiling, altar
  b.box([hx0 + 1, hTop + 1, hz0 + 1], [hx1 - 1, hTop + 1, hz1 - 1], 'dark_oak_planks', { keep: true })
  b.box([hcx - 3, hFloor + 1, hz0 + 1], [hcx + 3, hFloor + 1, hz0 + 2], 'dark_oak_planks')
  b.box([hcx - 2, hFloor + 1, hz0 + 3], [hcx + 2, hFloor + 1, hz0 + 3], 'dark_oak_stairs[facing=north]')
  b.set(hcx, hFloor + 2, hz0 + 1, 'gold_block')
  b.set(hcx, hFloor + 3, hz0 + 1, 'gold_block')
  for (const dx of [-2, 2]) {
    b.set(hcx + dx, hFloor + 2, hz0 + 1, 'dark_oak_fence')
    b.set(hcx + dx, hFloor + 3, hz0 + 1, 'lantern')
    b.set(hcx + dx, hFloor + 2, hz0 + 2, 'candle[candles=3,lit=true]')
  }
  b.set(hcx - 1, hFloor + 2, hz0 + 2, 'decorated_pot[facing=south]')
  b.set(hcx + 1, hFloor + 2, hz0 + 2, 'decorated_pot[facing=south]')
  // veranda railing
  for (let x = hx0 - 2; x <= hx1 + 2; x += 1) {
    if (x < hcx - 3 || x > hcx + 3) b.set(x, hFloor + 1, hz1 + 2, 'dark_oak_fence')
    b.set(x, hFloor + 1, hz0 - 2, 'dark_oak_fence')
  }
  for (let z = hz0 - 2; z <= hz1 + 2; z += 1) {
    b.set(hx0 - 2, hFloor + 1, z, 'dark_oak_fence')
    b.set(hx1 + 2, hFloor + 1, z, 'dark_oak_fence')
  }
  // suzu bell and offering box at the open centre bay
  b.set(hcx, hFloor + 3, hz1 + 1, 'minecraft:chain')
  b.set(hcx, hFloor + 2, hz1 + 1, 'minecraft:bell[attachment=ceiling,facing=south]')
  for (const dx of [-1, 0, 1]) b.set(hcx + dx, hFloor + 1, hz1 + 2, 'spruce_trapdoor[half=top,facing=south]')
  // eave lanterns at the front corners
  for (const [x, z] of [[hx0 + 3, hz1 + 2], [hx1 - 3, hz1 + 2], [hx0 - 2, hz1 + 2], [hx1 + 2, hz1 + 2], [hx0 - 2, hz0 - 2], [hx1 + 2, hz0 - 2], [hx0 - 2, (hz0 + hz1) / 2], [hx1 + 2, (hz0 + hz1) / 2]]) {
    const rb = roofBottom(b, x, z, hFloor + 2, hTop + 4)
    if (rb !== null) b.set(x, rb - 1, z, 'lantern[hanging=true]')
  }

  // ================================================================ COURTYARD
  for (let x = 13; x <= 64; x += 1) for (let z = 29; z <= 40; z += 1) if (!b.has(x, G + 1, z)) b.set(x, G, z, GRAVEL(x, z))
  // karesansui: three set stones with raked rings in the west part of the court
  const rocks = [[16, 33, 1.8], [20, 37, 1.2], [14, 38, 0.9]]
  for (let x = 13; x <= 23; x += 1) for (let z = 30; z <= 40; z += 1) {
    let best = Infinity
    for (const [rx, rz, rr] of rocks) best = Math.min(best, Math.hypot(x - rx, z - rz) - rr)
    if (best < 4) b.set(x, G, z, Math.floor(best) % 2 === 0 ? 'minecraft:gravel' : 'minecraft:light_gray_concrete_powder')
  }
  for (const [rx, rz, rr] of rocks) {
    b.boulder([rx, G + 1, rz], [rr + 0.4, rr * 1.1, rr + 0.2], kit.palette({ andesite: 3, tuff: 2, stone: 2 }, { scale: 2 }), { seed: rx, mossTop: 'moss_block' })
    b.disc([rx, G, rz], rr + 1.2, 'moss_block', { only: ['minecraft:gravel', 'minecraft:light_gray_concrete_powder'] })
  }
  // stone curb separating the dry garden from the walkway
  for (let z = 30; z <= 40; z += 1) b.set(24, G, z, 'polished_andesite')
  for (let x = 13; x <= 24; x += 1) b.set(x, G, 29, 'polished_andesite')

  // ema-kake: a votive-plaque rack (fence frame, little open trapdoors as plaques)
  for (let x = 40; x <= 44; x += 1) {
    const end = x === 40 || x === 44
    b.set(x, G + 1, 30, end ? 'dark_oak_fence' : 'air')
    b.set(x, G + 2, 30, 'dark_oak_fence')
    b.set(x, G + 3, 30, `${RAFTER.slab}[type=bottom]`)
    if (!end) {
      b.set(x, G + 2, 31, `minecraft:birch_trapdoor[facing=south,open=true,half=top]`)
      b.set(x, G + 2, 29, `minecraft:birch_trapdoor[facing=north,open=true,half=top]`)
    }
  }

  // ================================================================ PATHS
  const flag = (x, z) => {
    const row = Math.floor(z / 2)
    const col = Math.floor((x + (row % 2)) / 2)
    const h = kit.hash01(col, 0, row, 7)
    return h < 0.4 ? 'minecraft:polished_andesite' : h < 0.75 ? 'minecraft:smooth_stone' : 'minecraft:andesite'
  }
  for (let z = 29; z <= 71; z += 1) {
    for (let x = 24; x <= 32; x += 1) {
      const centre = x >= hcx - 1 && x <= hcx + 1
      if (z <= 40 && !centre) continue
      b.set(x, G, z, centre ? flag(x, z) : x === 24 || x === 32 ? 'minecraft:polished_andesite' : GRAVEL_X(x, z))
    }
  }
  // cross path to the pagoda
  for (let x = 30; x <= PX + 1; x += 1) for (let z = 35; z <= 37; z += 1) b.set(x, G, z, flag(x, z))
  for (let x = PX - 1; x <= PX + 1; x += 1) for (let z = PZ + 9; z <= 37; z += 1) b.set(x, G, z, flag(x, z))

  // ================================================================ TORII
  const torii = (cx, z, gap, H) => {
    const half = Math.floor(gap / 2) + 1
    for (const sx of [-half, half]) {
      b.set(cx + sx, G + 1, z, BLACK)
      b.box([cx + sx, G + 2, z], [cx + sx, G + H, z], VERMILION)
    }
    b.box([cx - half - 1, G + H - 2, z], [cx + half + 1, G + H - 2, z], VERMILION)
    b.set(cx, G + H - 1, z, BLACK)
    b.box([cx - half - 1, G + H, z], [cx + half + 1, G + H, z], VERMILION)
    b.box([cx - half - 2, G + H + 1, z], [cx + half + 2, G + H + 1, z], BLACK)
    b.set(cx - half - 3, G + H + 1, z, `${RIDGE.stairs}[facing=west,half=top]`)
    b.set(cx + half + 3, G + H + 1, z, `${RIDGE.stairs}[facing=east,half=top]`)
    b.set(cx - half - 3, G + H + 2, z, `${RIDGE.slab}[type=bottom]`)
    b.set(cx + half + 3, G + H + 2, z, `${RIDGE.slab}[type=bottom]`)
  }
  torii(hcx, 64, 7, 9)
  torii(hcx, 55, 5, 7)
  torii(hcx, 49, 5, 7)
  torii(hcx, 43, 5, 7)

  // ================================================================ TORO
  const smallToro = (x, z) => {
    b.set(x, G + 1, z, 'polished_andesite')
    b.set(x, G + 2, z, 'andesite_wall')
    b.set(x, G + 3, z, 'polished_andesite_slab[type=top]')
    b.set(x, G + 4, z, 'lantern')
    b.set(x, G + 5, z, 'andesite_slab[type=bottom]')
  }
  const bigToro = (cx, cz) => {
    b.set(cx, G + 1, cz, 'polished_andesite')
    for (const [f, dx, dz] of DIRS) b.set(cx - dx, G + 1, cz - dz, `andesite_stairs[facing=${f}]`)
    b.set(cx, G + 2, cz, 'andesite_wall')
    b.set(cx, G + 3, cz, 'polished_andesite_slab[type=top]')
    for (const [f, dx, dz] of DIRS) b.set(cx - dx, G + 3, cz - dz, `andesite_stairs[facing=${f},half=top]`)
    b.set(cx, G + 4, cz, 'lantern')
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
      if (!dx && !dz) { b.set(cx, G + 5, cz, 'polished_andesite'); continue }
      const f = Math.abs(dx) >= Math.abs(dz) ? (dx < 0 ? 'east' : 'west') : (dz < 0 ? 'south' : 'north')
      b.set(cx + dx, G + 5, cz + dz, `andesite_stairs[facing=${f}]`)
    }
    b.set(cx, G + 6, cz, 'stone_button[face=floor]')
  }
  for (const z of [60, 52, 46]) { smallToro(22, z); smallToro(34, z) }
  bigToro(23, 32); bigToro(33, 32)
  bigToro(PX - 5, 33); bigToro(PX + 5, 33)

  // ================================================================ POND + BRIDGE
  const lobes = [[46, 53, 6.5, 5], [53, 53, 5, 3], [61, 56, 7.5, 7]]
  const island = [63, 58, 2.2]
  const inPond = (x, z) => {
    const w = 1 + 0.18 * kit.noise.fbm2(x, z, { scale: 6, seed: 9 })
    return lobes.some(([cx, cz, rx, rz]) => ((x - cx) / (rx * w)) ** 2 + ((z - cz) / (rz * w)) ** 2 <= 1)
  }
  const pond = new Set()
  for (let x = 36; x <= 70; x += 1) for (let z = 42; z <= 66; z += 1) if (inPond(x, z) && Math.hypot(x - island[0], z - island[1]) > island[2]) pond.add(`${x},${z}`)
  for (const k of pond) {
    const [x, z] = k.split(',').map(Number)
    let edge = false
    for (const [, dx, dz] of DIRS) if (!pond.has(`${x + dx},${z + dz}`)) edge = true
    b.clear([x, G, z], [x, G + 4, z])
    b.set(x, G - 1, z, 'water')
    b.set(x, G - 2, z, edge ? 'minecraft:gravel' : 'water')
    b.set(x, G - 3, z, kit.palette({ clay: 3, gravel: 2, mud: 1 }, { scale: 2 }))
  }
  // rocky rim: boulders sitting on the bank, half in the water
  for (const k of pond) {
    const [x, z] = k.split(',').map(Number)
    let edge = false
    for (const [, dx, dz] of DIRS) if (!pond.has(`${x + dx},${z + dz}`)) edge = true
    if (!edge || hash(x, z, 31) > 0.22) continue
    if (x >= 50 && x <= 56 && z >= 46 && z <= 59) continue // keep the bridge clear
    const r = 0.8 + hash(x, z, 32) * 0.9
    b.boulder([x, G - 0.5, z], [r + 0.3, r * 0.8, r], kit.palette({ andesite: 3, stone: 2, tuff: 2, mossy_cobblestone: 2 }, { scale: 2 }), { seed: x * 3 + z, mossTop: 'moss_block' })
  }
  for (const [x, z, c] of [[45, 52, 'orange_wool'], [47, 54, 'white_wool'], [59, 55, 'orange_wool'], [61, 57, 'orange_wool'], [58, 59, 'white_wool'], [43, 55, 'orange_wool']]) b.set(x, G - 2, z, c)
  for (let i = 0; i < 22; i += 1) {
    const x = rng.int(38, 68)
    const z = rng.int(43, 65)
    if (b.nameAt(x, G - 1, z) === 'minecraft:water' && !b.has(x, G, z)) b.set(x, G, z, 'lily_pad')
  }
  // island with a yukimi-doro (snow-viewing lantern: low, wide umbrella roof)
  {
    const [ix, iz] = island
    b.boulder([ix, G - 0.2, iz], [2.4, 1.2, 2.2], kit.palette({ andesite: 3, tuff: 2, mossy_cobblestone: 2 }, { scale: 2 }), { seed: 5, mossTop: 'moss_block' })
    const ty = b.topY(ix, iz) + 1
    b.set(ix, ty, iz, 'andesite_wall')
    b.set(ix, ty + 1, iz, 'lantern')
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
      if (!dx && !dz) { b.set(ix, ty + 2, iz, 'polished_andesite'); continue }
      const f = Math.abs(dx) >= Math.abs(dz) ? (dx < 0 ? 'east' : 'west') : (dz < 0 ? 'south' : 'north')
      b.set(ix + dx, ty + 2, iz + dz, `andesite_stairs[facing=${f}]`)
    }
    b.set(ix, ty + 3, iz, 'stone_button[face=floor]')
  }
  // cascade (taki): a rock headwall on the east hill with water stepping down into the pond
  {
    const ROCK = kit.palette({ tuff: 3, andesite: 3, stone: 2, mossy_cobblestone: 2 }, { scale: 2, seed: 17 })
    b.boulder([69, G + 2, 52.5], [2.2, 2.6, 2.0], ROCK, { seed: 3, mossTop: 'moss_block' })
    b.boulder([69, G + 2, 58.5], [2.0, 2.4, 2.2], ROCK, { seed: 4, mossTop: 'moss_block' })
    b.boulder([69.8, G + 3, 55.5], [1.6, 3.2, 2.4], ROCK, { seed: 5, mossTop: 'moss_block' })
    const steps = [[70, G + 4], [69, G + 3], [68, G + 2], [67, G + 1], [66, G]]
    for (const [x, y] of steps) {
      for (const z of [55, 56]) {
        b.clear([x, y, z], [x, y + 4, z])
        b.set(x, y, z, 'water')
        b.set(x, y - 1, z, ROCK)
        for (const side of [54, 57]) if (!b.has(x, y, side)) b.set(x, y, side, ROCK)
      }
    }
  }
  // arched bridge: the roof rasterizer drawing an arched heightfield
  {
    const deck = new Map()
    for (let z = 46; z <= 59; z += 1) {
      const d = Math.abs(z - 52.5)
      const t = d < 2 ? 3 : d < 3 ? 2.5 : d < 4 ? 2 : d < 5 ? 1.5 : d < 6 ? 1 : 0.5
      for (let x = 52; x <= 54; x += 1) deck.set(`${x},${z}`, { x, z, t, sec: 'deck', ring: 0 })
    }
    rasterRoof(b, deck, { y: G, mat: SPRUCE, under: SPRUCE, ridge: SPRUCE, thickness: 1 })
    for (let z = 46; z <= 59; z += 1) {
      const t = deck.get(`52,${z}`).t
      const ry = Math.ceil(G + t)
      for (const x of [51, 55]) {
        const end = z === 46 || z === 59
        const post = end || z === 49 || z === 56
        b.set(x, ry - 1, z, post ? VERMILION : `${SPRUCE.slab}[type=top]`)
        b.set(x, ry, z, post ? VERMILION : 'mangrove_fence')
        if (end) b.set(x, ry + 1, z, 'lantern')
        else if (post) b.set(x, ry + 1, z, `${RIDGE.slab}[type=bottom]`)
      }
    }
    for (const z of [50, 55]) for (const x of [52, 54]) b.box([x, G - 3, z], [x, G + 1, z], 'dark_oak_log')
  }

  // ================================================================ CHOZUYA (purification pavilion)
  {
    const cx0 = 12, cx1 = 18, cz0 = 43, cz1 = 45 // post lines
    b.box([cx0 - 1, G, cz0 - 1], [cx1 + 1, G, cz1 + 1], 'polished_andesite')
    for (const x of [cx0, cx1]) for (const z of [cz0, cz1]) b.box([x, G + 1, z], [x, G + 3, z], POST)
    b.box([cx0, G + 4, cz0], [cx1, G + 4, cz0], BEAM('x'))
    b.box([cx0, G + 4, cz1], [cx1, G + 4, cz1], BEAM('x'))
    b.box([cx0, G + 4, cz0], [cx0, G + 4, cz1], BEAM('z'))
    b.box([cx1, G + 4, cz0], [cx1, G + 4, cz1], BEAM('z'))
    const cF = roofField({ x0: cx0 - 2, z0: cz0 - 2, x1: cx1 + 2, z1: cz1 + 2, pitch: [0.5, 0.5, 1, 1, 1], lift: 1 })
    rasterRoof(b, cF, { y: G + 4 })
    const cG = roofField({ x0: cx0 - 2, z0: cz0 - 2, x1: cx1 + 2, z1: cz1 + 2, pitch: [0.5, 0.5, 1, 1, 1], gable: { axis: 'x', inset: 2 } })
    rasterRoof(b, cG, { y: G + 4, only: c => c.sec === 'gable' })
    const ridgeY = G + 4 + cG.get(`${(cx0 + cx1) / 2},${(cz0 + cz1) / 2}`).t
    for (let x = cx0; x <= cx1; x += 1) b.set(x, ridgeY, (cz0 + cz1) / 2, `${RIDGE.slab}[type=bottom]`)
    for (const x of [cx0, cx1]) b.set(x, ridgeY, (cz0 + cz1) / 2, BLACK)
    // stone trough (mizubane) with water
    b.box([cx0 + 2, G + 1, cz0 + 1 - 1], [cx1 - 2, G + 1, cz1 - 1 + 1], 'polished_andesite')
    b.box([cx0 + 3, G + 1, cz0 + 1], [cx1 - 3, G + 1, cz1 - 1], 'water')
    b.set(cx0 + 1, G + 1, cz0 + 1, 'polished_andesite_slab')
    b.set(cx1 - 1, G + 1, cz0 + 1, 'polished_andesite_slab')
    b.hangingLantern([(cx0 + cx1) / 2, G + 4, cz1], 0)
    // short flagstone spur from the approach
    for (let x = cx1 + 2; x <= 23; x += 1) b.set(x, G, (cz0 + cz1) / 2, 'polished_andesite')
  }

  // ================================================================ STEPPING STONES
  const stepping = (pts, seed) => {
    let acc = 0
    for (let i = 1; i < pts.length; i += 1) {
      const [ax, az] = pts[i - 1]
      const [bx, bz] = pts[i]
      const len = Math.hypot(bx - ax, bz - az)
      for (let d = 0; d < len; d += 1) {
        acc += 1
        if (acc % 2) continue
        const t = d / len
        const x = Math.round(ax + (bx - ax) * t + (hash(acc, seed) - 0.5))
        const z = Math.round(az + (bz - az) * t + (hash(seed, acc) - 0.5))
        if (b.has(x, G + 1, z) || !b.has(x, G, z)) continue
        b.set(x, G + 1, z, hash(x, z, 5) < 0.5 ? 'smooth_stone_slab' : 'polished_andesite_slab')
      }
    }
  }
  stepping([[33, 58], [40, 60], [46, 61], [52, 61], [53, 60]], 1)
  stepping([[53, 44], [53, 42]], 2)
  stepping([[15, 28], [13, 24], [12, 20], [13, 16]], 3)

  // ================================================================ MOSS GARDEN + TSUKUBAI
  b.box([8, G, 8], [16, G, 27], kit.palette({ moss_block: 5, grass_block: 1 }, { scale: 3, seed: 8 }))
  b.set(11, G + 1, 15, 'mossy_cobblestone')
  b.set(12, G + 1, 15, 'water_cauldron[level=3]')
  b.set(12, G + 1, 14, 'mossy_cobblestone')
  b.set(13, G + 1, 14, 'stone')
  for (let k = 1; k <= 3; k += 1) b.set(12, G + 1 + k, 13, 'bamboo[age=1,stage=0,leaves=none]')
  smallToro(14, 12)

  // ================================================================ VEGETATION
  const bamboo = (x, z, h, thick) => {
    for (let k = 0; k < h; k += 1) {
      const leaves = k >= h - 2 ? 'large' : k === h - 3 ? 'small' : 'none'
      b.set(x, gy(x, z) + 1 + k, z, `minecraft:bamboo[age=${thick ? 1 : 0},stage=0,leaves=${leaves}]`)
    }
  }
  for (let x = 0; x <= 71; x += 1) for (let z = 0; z <= 40; z += 1) {
    const edge = 0.9 * kit.noise.fbm2(x, z, { scale: 5, seed: 4 })
    const inGrove = x <= 6 + edge * 2 || z <= 3 + edge * 1.5 || (x >= 67 + edge * 1.5 && z <= 24)
    if (!inGrove || b.has(x, gy(x, z) + 1, z)) continue
    b.set(x, gy(x, z), z, kit.palette({ moss_block: 5, podzol: 3, coarse_dirt: 1 }, { scale: 2.5, seed: 12 }))
    if (hash(x, z, 1) < 0.34) bamboo(x, z, 8 + Math.floor(hash(x, z, 2) * 7), hash(x, z, 3) < 0.5)
  }
  const cherry = (x, z, seed, opts = {}) => b.tree([x, gy(x, z) + 1, z], 'cherry', { seed, log: 'cherry_wood', height: 8, blob: [2.3, 3.0], branches: [3, 4], ...opts })
  cherry(10, 59, 1)
  cherry(41, 63, 3)
  cherry(42, 9, 6, { height: 9 })
  cherry(62, 33, 5, { height: 7 })
  // weeping cherry by the pond: hang strands of cherry leaves under the crown
  {
    const wx = 64, wz = 45
    cherry(wx, wz, 9, { height: 8, spread: 0.5 })
    for (let x = wx - 6; x <= wx + 6; x += 1) for (let z = wz - 6; z <= wz + 6; z += 1) {
      const top = b.topY(x, z, '*_leaves')
      if (top < 0) continue
      let bottom = top
      while (b.nameAt(x, bottom - 1, z) === 'minecraft:cherry_leaves') bottom -= 1
      if (hash(x, z, 40) > 0.5) continue
      const len = 2 + Math.floor(hash(x, z, 41) * 4)
      for (let k = 1; k <= len; k += 1) {
        if (b.has(x, bottom - k, z) || bottom - k <= G + 1) break
        b.set(x, bottom - k, z, 'cherry_leaves')
      }
    }
  }
  // Japanese black pine leaning over the water: a thin crooked trunk and flat cloud pads
  {
    const trunk = [[45, G + 1, 44], [45, G + 3, 44.6], [46.4, G + 5, 45.6], [48.6, G + 6, 47]]
    b.curve(trunk, 'spruce_wood', { radius: 0.3 })
    b.line([46, G + 4, 45], [43.5, G + 5, 44.5], 'spruce_wood')
    for (const [x, y, z, r] of [[49, G + 7, 47.5, 2.4], [46.8, G + 6.2, 45.6, 1.7], [43.4, G + 5.6, 44.4, 1.5], [45.6, G + 8, 45, 1.3]]) {
      b.leafBlob([x, y, z], [r, 0.7, r], ['spruce_leaves'], { seed: x * 3 + y, holes: 0.06, roughness: 0.15 })
    }
  }
  // azalea mounds (o-karikomi)
  for (const [x, z, r] of [[20, 59, 1.8], [36, 61, 1.6], [20, 45, 1.5], [37, 47, 1.7], [40, 44, 1.8], [44, 66, 1.8], [66, 52, 2.0], [16, 26, 1.6], [40, 27, 1.8], [65, 26, 1.6], [12, 36, 1.4]]) {
    b.leafBlob([x, G + 1.2, z], [r, r * 0.7, r], ['azalea_leaves', 'flowering_azalea_leaves'], { seed: x * 7 + z })
  }
  // low clipped hedge along the south boundary, opening at the gate
  for (let x = 1; x <= 70; x += 1) {
    if (x >= 22 && x <= 34) continue
    if (b.has(x, G + 1, 69) || !b.has(x, G, 69)) continue
    b.set(x, G + 1, 69, 'azalea_leaves[persistent=true]')
    if (hash(x, 69, 2) < 0.5) b.set(x, G + 1, 70, 'azalea_leaves[persistent=true]')
  }
  // ground cover
  b.scatter({ x0: 0, z0: 0, x1: 71, z1: 71, on: ['minecraft:grass_block'], density: 0.18, paints: [[8, 'short_grass'], [2, 'fern'], [1, 'azalea'], [1, 'flowering_azalea']] })
  b.scatter({ x0: 0, z0: 0, x1: 71, z1: 71, on: ['minecraft:moss_block'], density: 0.12, paints: [[6, 'moss_carpet'], [1, 'fern']] })

  return b.finish({ name: 'japanese-shrine', description: 'v2' })
}
