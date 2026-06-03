export default function build(api) {
  const structure = api.createStructure([21, 18, 21])

  api.fill(structure, [0, 0, 0], [20, 0, 20], 'minecraft:mossy_cobblestone')
  api.cylinder(structure, [10, 1, 10], 5, [1, 11], 'minecraft:stone_bricks', { filled: false })
  api.cylinder(structure, [10, 1, 10], 4, [1, 10], 'minecraft:spruce_planks', { filled: true })
  api.fill(structure, [6, 1, 10], [6, 3, 10], 'minecraft:air')

  api.hollowBox(structure, [4, 11, 4], [16, 15, 16], 'minecraft:dark_oak_planks')
  api.fill(structure, [5, 11, 5], [15, 11, 15], 'minecraft:spruce_planks')
  api.fill(structure, [5, 16, 5], [15, 16, 15], 'minecraft:dark_oak_slab[type=top]')

  for (const [x, z] of [[4, 4], [16, 4], [4, 16], [16, 16]]) {
    api.fill(structure, [x, 12, z], [x, 17, z], 'minecraft:stripped_spruce_log[axis=y]')
    api.setBlock(structure, [x, 18 - 1, z], 'minecraft:lantern[hanging=false]')
  }

  for (let i = 0; i < 6; i += 1) {
    api.setBlock(structure, [9, 1 + i, 7 + i], 'minecraft:ladder[facing=south]')
  }

  api.fill(structure, [8, 4, 5], [12, 5, 5], 'minecraft:glass_pane')
  api.fill(structure, [8, 4, 15], [12, 5, 15], 'minecraft:glass_pane')
  api.fill(structure, [5, 4, 8], [5, 5, 12], 'minecraft:glass_pane')
  api.fill(structure, [15, 4, 8], [15, 5, 12], 'minecraft:glass_pane')

  api.line(structure, [4, 15, 4], [10, 17, 10], 'minecraft:dark_oak_stairs[facing=east,half=bottom,shape=straight]')
  api.line(structure, [16, 15, 4], [10, 17, 10], 'minecraft:dark_oak_stairs[facing=south,half=bottom,shape=straight]')
  api.line(structure, [4, 15, 16], [10, 17, 10], 'minecraft:dark_oak_stairs[facing=north,half=bottom,shape=straight]')
  api.line(structure, [16, 15, 16], [10, 17, 10], 'minecraft:dark_oak_stairs[facing=west,half=bottom,shape=straight]')

  return {
    structure,
    metadata: {
      name: 'watchtower',
      description: 'Compact Lodestone-generated Minecraft watchtower',
    },
  }
}
