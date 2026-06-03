const SIZE = [73, 56, 73]
const CENTER = [36, 0, 36]
const TAU = Math.PI * 2

export default function build(api) {
  const structure = api.createStructure(SIZE)
  const [cx, , cz] = CENTER

  const set = (x, y, z, block, nbt) => {
    x = Math.trunc(x)
    y = Math.trunc(y)
    z = Math.trunc(z)
    if (x < 0 || y < 0 || z < 0 || x >= SIZE[0] || y >= SIZE[1] || z >= SIZE[2]) return
    api.setBlock(structure, [x, y, z], block, undefined, nbt)
  }

  const fillBox = (from, to, block) => {
    const min = from.map((value, index) => Math.min(value, to[index]))
    const max = from.map((value, index) => Math.max(value, to[index]))
    for (let x = min[0]; x <= max[0]; x += 1) {
      for (let y = min[1]; y <= max[1]; y += 1) {
        for (let z = min[2]; z <= max[2]; z += 1) {
          set(x, y, z, block)
        }
      }
    }
  }

  const pillar = (x, z, y1, y2, block) => {
    for (let y = y1; y <= y2; y += 1) set(x, y, z, block)
  }

  const disc = (y, radius, block, options = {}) => {
    const inner = options.inner ?? -1
    const r2 = radius * radius
    const inner2 = inner * inner
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      for (let z = cz - radius; z <= cz + radius; z += 1) {
        const d2 = (x - cx) ** 2 + (z - cz) ** 2
        if (d2 <= r2 && d2 > inner2) set(x, y, z, typeof block === 'function' ? block(x, z, d2) : block)
      }
    }
  }

  const circle = (y, radius, block, options = {}) => {
    const steps = options.steps ?? Math.max(96, Math.ceil(radius * 16))
    for (let i = 0; i < steps; i += 1) {
      const angle = i / steps * TAU
      const x = Math.round(cx + Math.cos(angle) * radius)
      const z = Math.round(cz + Math.sin(angle) * radius)
      set(x, y, z, typeof block === 'function' ? block(i, angle) : block)
    }
  }

  const verticalRing = (plane, centerY, radius, block, options = {}) => {
    const steps = options.steps ?? 192
    for (let i = 0; i < steps; i += 1) {
      const angle = i / steps * TAU
      const major = Math.round(Math.cos(angle) * radius)
      const y = Math.round(centerY + Math.sin(angle) * radius)
      const x = plane === 'xz' ? cx + major : cx
      const z = plane === 'yz' ? cz + major : cz
      set(x, y, z, typeof block === 'function' ? block(i, angle) : block)
    }
  }

  const tiltedRing = (centerY, radius, tilt, phase, block) => {
    const steps = 240
    for (let i = 0; i < steps; i += 1) {
      const angle = i / steps * TAU
      const xLocal = Math.cos(angle) * radius
      const zLocal = Math.sin(angle) * radius * Math.cos(tilt)
      const yLocal = Math.sin(angle) * radius * Math.sin(tilt)
      const x = Math.round(cx + Math.cos(phase) * xLocal - Math.sin(phase) * zLocal)
      const z = Math.round(cz + Math.sin(phase) * xLocal + Math.cos(phase) * zLocal)
      const y = Math.round(centerY + yLocal)
      set(x, y, z, typeof block === 'function' ? block(i, angle) : block)
    }
  }

  const stairsForDirection = direction => `minecraft:dark_prismarine_stairs[facing=${direction},half=bottom,shape=straight]`

  // Floating island body.
  for (let y = 2; y <= 18; y += 1) {
    for (let x = cx - 30; x <= cx + 30; x += 1) {
      for (let z = cz - 30; z <= cz + 30; z += 1) {
        const nx = (x - cx) / 31
        const nz = (z - cz) / 31
        const ny = (y - 16) / 12
        if (nx * nx + nz * nz + ny * ny > 1) continue

        const d = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2)
        if (y >= 16 && d < 25) set(x, y, z, 'minecraft:moss_block')
        else if (y >= 13) set(x, y, z, d > 25 ? 'minecraft:tuff' : 'minecraft:cobbled_deepslate')
        else if (y >= 8) set(x, y, z, 'minecraft:cobbled_deepslate')
        else set(x, y, z, y % 2 === 0 ? 'minecraft:basalt[axis=y]' : 'minecraft:blackstone')
      }
    }
  }

  for (const [dx, dz, height] of [
    [0, 0, 8], [-10, -7, 5], [12, -6, 6], [-14, 9, 4], [15, 11, 5],
    [-23, 2, 4], [22, -1, 4], [5, 23, 3], [-5, -23, 3],
  ]) {
    for (let y = 1; y <= height; y += 1) set(cx + dx, y, cz + dz, y === 1 ? 'minecraft:amethyst_block' : 'minecraft:basalt[axis=y]')
  }

  // Main platform and celestial inlay.
  disc(18, 27, (x, z, d2) => d2 > 25 ** 2 ? 'minecraft:polished_blackstone' : 'minecraft:deepslate_tiles')
  disc(19, 23, 'minecraft:dark_prismarine', { inner: 21 })
  disc(19, 16, 'minecraft:smooth_quartz', { inner: 14 })
  circle(20, 26, (i) => i % 12 === 0 ? 'minecraft:sea_lantern' : 'minecraft:polished_blackstone')
  circle(20, 19, (i) => i % 10 === 0 ? 'minecraft:copper_bulb[lit=true,powered=false]' : 'minecraft:dark_prismarine_slab[type=top]')
  fillBox([cx - 2, 20, cz - 2], [cx + 2, 20, cz + 2], 'minecraft:sea_lantern')
  set(cx, 21, cz, 'minecraft:beacon')
  set(cx, 22, cz, 'minecraft:tinted_glass')

  // Four bridges and satellite ritual pads.
  const satellites = [
    { dx: 0, dz: -28, facing: 'north' },
    { dx: 28, dz: 0, facing: 'east' },
    { dx: 0, dz: 28, facing: 'south' },
    { dx: -28, dz: 0, facing: 'west' },
  ]
  for (const { dx, dz, facing } of satellites) {
    const length = Math.abs(dx || dz)
    const stepX = Math.sign(dx)
    const stepZ = Math.sign(dz)
    const sideX = stepZ
    const sideZ = stepX

    for (let t = 12; t <= length; t += 1) {
      const x = cx + stepX * t
      const z = cz + stepZ * t
      for (let w = -2; w <= 2; w += 1) set(x + sideX * w, 18, z + sideZ * w, Math.abs(w) === 2 ? 'minecraft:polished_blackstone' : 'minecraft:dark_prismarine')
      set(x + sideX * 3, 19, z + sideZ * 3, 'minecraft:chain[axis=y]')
      set(x - sideX * 3, 19, z - sideZ * 3, 'minecraft:chain[axis=y]')
      if (t % 5 === 0) set(x, 19, z, 'minecraft:sea_lantern')
    }

    const px = cx + dx
    const pz = cz + dz
    for (let y = 17; y <= 19; y += 1) {
      discAt(px, pz, y, 6, y === 19 ? 'minecraft:smooth_quartz' : 'minecraft:deepslate_tiles')
    }
    ringAt(px, pz, 20, 6, (i) => i % 8 === 0 ? 'minecraft:sea_lantern' : 'minecraft:polished_blackstone')
    for (let y = 20; y <= 31; y += 1) set(px, y, pz, y % 3 === 0 ? 'minecraft:sea_lantern' : 'minecraft:amethyst_block')
    set(px, 32, pz, 'minecraft:lightning_rod[facing=up,powered=true]')
    set(px + stepZ * 4, 21, pz + stepX * 4, stairsForDirection(facing))
    api.line(structure, [cx, 43, cz], [px, 31, pz], 'minecraft:chain[axis=y]')
  }

  function discAt(px, pz, y, radius, block) {
    for (let x = px - radius; x <= px + radius; x += 1) {
      for (let z = pz - radius; z <= pz + radius; z += 1) {
        if ((x - px) ** 2 + (z - pz) ** 2 <= radius * radius) set(x, y, z, block)
      }
    }
  }

  function ringAt(px, pz, y, radius, block) {
    for (let i = 0; i < 96; i += 1) {
      const angle = i / 96 * TAU
      set(Math.round(px + Math.cos(angle) * radius), y, Math.round(pz + Math.sin(angle) * radius), typeof block === 'function' ? block(i, angle) : block)
    }
  }

  // Observatory tower, windows, and dome.
  api.cylinder(structure, [cx, 19, cz], 11, [19, 32], 'minecraft:polished_blackstone_bricks', { filled: false })
  api.cylinder(structure, [cx, 20, cz], 9, [20, 20], 'minecraft:deepslate_tiles', { filled: true })
  api.cylinder(structure, [cx, 31, cz], 9, [31, 31], 'minecraft:deepslate_tiles', { filled: true })
  disc(33, 13, 'minecraft:polished_blackstone', { inner: 10 })

  for (let i = 0; i < 8; i += 1) {
    const angle = i / 8 * TAU
    const x = Math.round(cx + Math.cos(angle) * 11)
    const z = Math.round(cz + Math.sin(angle) * 11)
    pillar(x, z, 19, 36, 'minecraft:polished_basalt[axis=y]')
    set(x, 37, z, i % 2 === 0 ? 'minecraft:sea_lantern' : 'minecraft:copper_bulb[lit=true,powered=false]')
  }

  for (let y = 23; y <= 29; y += 1) {
    for (let o = -4; o <= 4; o += 1) {
      set(cx + o, y, cz - 11, 'minecraft:black_stained_glass_pane')
      set(cx + o, y, cz + 11, 'minecraft:black_stained_glass_pane')
      set(cx - 11, y, cz + o, 'minecraft:black_stained_glass_pane')
      set(cx + 11, y, cz + o, 'minecraft:black_stained_glass_pane')
    }
  }

  const domeCenterY = 35
  const domeRadius = 11
  for (let y = 32; y <= 47; y += 1) {
    for (let x = cx - domeRadius; x <= cx + domeRadius; x += 1) {
      for (let z = cz - domeRadius; z <= cz + domeRadius; z += 1) {
        const dx = x - cx
        const dy = y - domeCenterY
        const dz = z - cz
        if (dy < -2) continue
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d < domeRadius - 1.1 || d > domeRadius + 0.35) continue
        const angleAccent = Math.abs(Math.atan2(dz, dx) / (Math.PI / 4) - Math.round(Math.atan2(dz, dx) / (Math.PI / 4))) < 0.08
        if (y === 47 || angleAccent && y % 3 === 0) set(x, y, z, 'minecraft:amethyst_block')
        else if ((x + y + z) % 17 === 0) set(x, y, z, 'minecraft:sea_lantern')
        else set(x, y, z, 'minecraft:tinted_glass')
      }
    }
  }
  set(cx, 48, cz, 'minecraft:lightning_rod[facing=up,powered=true]')
  set(cx, 49, cz, 'minecraft:end_rod[facing=up]')

  // Telescope barrel pointing out from the dome.
  for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1]]) {
    api.line(structure, [cx + ox, 37 + oy, cz - 9], [cx + ox, 41 + oy, cz - 23], 'minecraft:polished_blackstone')
  }
  set(cx, 42, cz - 24, 'minecraft:sea_lantern')
  set(cx, 42, cz - 25, 'minecraft:tinted_glass')

  // Orbital rings around the dome.
  circle(39, 18, (i) => i % 16 === 0 ? 'minecraft:sea_lantern' : i % 8 === 0 ? 'minecraft:amethyst_block' : 'minecraft:end_rod[facing=east]', { steps: 240 })
  verticalRing('xz', 38, 17, (i) => i % 18 === 0 ? 'minecraft:copper_bulb[lit=true,powered=false]' : 'minecraft:end_rod[facing=up]')
  verticalRing('yz', 38, 17, (i) => i % 18 === 0 ? 'minecraft:sea_lantern' : 'minecraft:end_rod[facing=up]')
  tiltedRing(39, 21, 0.45, Math.PI / 4, (i) => i % 20 === 0 ? 'minecraft:amethyst_block' : 'minecraft:chain[axis=y]')

  // Floating star helix and constellations.
  for (let i = 0; i < 190; i += 1) {
    const angle = i * 0.32
    const radius = 4 + i * 0.09
    const x = Math.round(cx + Math.cos(angle) * radius)
    const z = Math.round(cz + Math.sin(angle) * radius)
    const y = Math.round(42 + Math.sin(i * 0.18) * 4)
    const block = i % 17 === 0 ? 'minecraft:sea_lantern' : i % 9 === 0 ? 'minecraft:copper_bulb[lit=true,powered=false]' : 'minecraft:end_rod[facing=up]'
    set(x, y, z, block)
  }
  for (const [a, b] of [
    [[12, 44, 14], [20, 47, 19]], [[20, 47, 19], [30, 45, 13]], [[30, 45, 13], [43, 48, 18]],
    [[54, 45, 52], [47, 49, 42]], [[47, 49, 42], [58, 43, 35]], [[15, 42, 55], [27, 46, 48]],
  ]) {
    api.line(structure, a, b, 'minecraft:end_rod[facing=up]')
  }

  // Decorative railing, lamps, and stair-caps.
  circle(21, 27, 'minecraft:chain[axis=y]', { steps: 96 })
  for (let i = 0; i < 32; i += 1) {
    const angle = i / 32 * TAU
    const x = Math.round(cx + Math.cos(angle) * 24)
    const z = Math.round(cz + Math.sin(angle) * 24)
    set(x, 22, z, i % 2 === 0 ? 'minecraft:soul_lantern[hanging=false]' : 'minecraft:lantern[hanging=false]')
  }
  for (let i = 0; i < 16; i += 1) {
    const angle = i / 16 * TAU
    const x = Math.round(cx + Math.cos(angle) * 14)
    const z = Math.round(cz + Math.sin(angle) * 14)
    const facing = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))
      ? Math.cos(angle) > 0 ? 'west' : 'east'
      : Math.sin(angle) > 0 ? 'north' : 'south'
    set(x, 34, z, `minecraft:dark_prismarine_stairs[facing=${facing},half=top,shape=straight]`)
  }

  return {
    structure,
    metadata: {
      name: 'celestial-observatory',
      description: 'Floating astral observatory with orbital rings, crystal pylons, glowing helix, and night-preview-friendly lighting.',
    },
  }
}
