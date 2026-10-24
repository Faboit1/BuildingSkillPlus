// THE PRANCING PONY — massing pass (placeholder volumes only)
export default function build(api) {
  const { kit } = api
  const b = api.builder([52, 38, 46], { seed: 23 })
  const ground = b.terrain({
    height: (x, z) => 5.4 + 1.1 * ((22 - z) / 22) + 0.4 * ((26 - x) / 26) + 0.6 * kit.noise.fbm2(x, z, { scale: 22, seed: 4 }),
  })
  const FL0 = 7, FL1 = 12, FL2 = 16
  const MAIN = { x0: 12, x1: 34, z0: 19, z1: 30 }
  const UP = { x0: 12, x1: 34, z0: 19, z1: 31 }
  const BAY = { x0: 18, x1: 24, z0: 31, z1: 33 }
  const WING = { x0: 24, x1: 32, z0: 10, z1: 19 }
  const STABLE = { x0: 35, x1: 41, z0: 18, z1: 30 }
  const pitch = (process.env.PITCH ?? '1,1,1,1,2').split(',').map(Number)
  b.box([MAIN.x0, FL0 - 2, MAIN.z0], [MAIN.x1, FL1 - 1, MAIN.z1], 'light_gray_wool')
  b.box([UP.x0, FL1, UP.z0], [UP.x1, FL2, UP.z1], 'white_wool')
  b.box([BAY.x0, FL1, BAY.z0], [BAY.x1, FL2, BAY.z1], 'white_wool')
  b.box([WING.x0, FL0 - 2, WING.z0], [WING.x1, FL1 - 1, WING.z1], 'light_gray_wool')
  b.box([WING.x0, FL1, WING.z0], [WING.x1, FL2, WING.z1], 'white_wool')
  b.box([8, FL0 - 2, 21], [11, FL1 - 1, 27], 'light_gray_wool')
  b.box([9, FL1, 22], [10, 30, 26], 'light_gray_wool')
  b.roof({ x0: UP.x0, z0: UP.z0, x1: UP.x1, z1: UP.z1, y: FL2 + 1, axis: 'x', material: 'deepslate_tile', pitch, eaveTrim: true, gable: 'yellow_wool' })
  b.roof({ x0: WING.x0, z0: WING.z0, x1: WING.x1, z1: WING.z1 + 4, y: FL2 + 1, axis: 'z', material: 'deepslate_tile', pitch, eaveTrim: true, gable: 'yellow_wool', overwrite: false })
  b.roof({ x0: BAY.x0, z0: 27, x1: BAY.x1, z1: BAY.z1, y: FL2 + 1, axis: 'z', material: 'deepslate_tile', pitch: [1, 1, 2, 2, 2], eaveTrim: true, gable: 'yellow_wool', overwrite: false })
  b.roof({ x0: STABLE.x0, z0: STABLE.z0, x1: STABLE.x1, z1: STABLE.z1, y: 11, type: 'shed', rises: 'west', material: 'spruce', pitch: 0.5, eaveTrim: true })
  return b.finish({ name: 'tavern' })
}
