// The last pass over a spawn: removes what the game would drop or pop off on the first
// block update, so a pasted spawn has no floating bells, dripstone or flowers on stone.
//   - ground plants (grass, ferns, flowers, saplings, berry bushes) on a block they cannot grow on;
//     on nylium they become the matching nether roots instead
//   - bells, hanging lanterns, hanging roots and vines with nothing to hang from (whole chains)
//   - pointed dripstone with nothing at its root (whole columns)
//   - azaleas and carpets with nothing under them
//   - sand, gravel and concrete powder with nothing under them: swapped for the stable look-alike
//     (sandstone, andesite, concrete), since they would fall on the first update
// Returns the number of blocks removed or swapped.

const DIRT = /^minecraft:(dirt|grass_block|podzol|coarse_dirt|rooted_dirt|moss_block|mud|muddy_mangrove_roots|farmland|mycelium|dirt_path)$/
const NYLIUM = /^minecraft:(crimson|warped)_nylium$/
const GROUND_PLANT = /^minecraft:(short_grass|grass|fern|tall_grass|large_fern|dandelion|poppy|blue_orchid|allium|azure_bluet|\w+_tulip|oxeye_daisy|cornflower|lily_of_the_valley|torchflower|sunflower|lilac|rose_bush|peony|sweet_berry_bush|pink_petals|\w+_sapling|wither_rose)$/
const NETHER_PLANT = /^minecraft:(crimson_roots|warped_roots|crimson_fungus|warped_fungus|nether_sprouts)$/
const HANGING = /^minecraft:(hanging_roots|weeping_vines|weeping_vines_plant|cave_vines|cave_vines_plant|spore_blossom)$/

export function cleanupSpawn(ctx) {
  const { b } = ctx
  const name = (x, y, z) => b.get(x, y, z)?.name ?? null
  const solidish = n => n && !/^minecraft:(air|light|water|lava)$/.test(n)
  let fixed = 0
  const drop = (x, y, z) => {
    b.remove(x, y, z)
    fixed += 1
  }
  for (const [x, y, z, blk] of b.entriesWhere(n => GROUND_PLANT.test(n) || NETHER_PLANT.test(n) || /^minecraft:(bell|lantern|soul_lantern)$/.test(n))) {
    const n = blk.name
    const p = blk.props ?? {}
    if (GROUND_PLANT.test(n) && p.half !== 'upper') {
      const below = name(x, y - 1, z)
      if (below && DIRT.test(below)) continue
      if (below && NYLIUM.test(below)) {
        const tall = p.half === 'lower'
        b.set(x, y, z, below.includes('warped') ? 'minecraft:warped_roots' : 'minecraft:crimson_roots')
        if (tall && /_(grass|fern|lilac|bush|peony|sunflower)$|tall_/.test(name(x, y + 1, z) ?? '')) b.remove(x, y + 1, z)
        fixed += 1
        continue
      }
      if (p.half === 'lower' && b.get(x, y + 1, z)?.props?.half === 'upper') b.remove(x, y + 1, z)
      drop(x, y, z)
    } else if (NETHER_PLANT.test(n)) {
      const below = name(x, y - 1, z)
      if (!(below && (DIRT.test(below) || NYLIUM.test(below) || below === 'minecraft:soul_soil'))) drop(x, y, z)
    } else if (n === 'minecraft:bell') {
      const a = p.attachment ?? 'floor'
      const need = a === 'ceiling' ? [0, 1, 0] : a === 'floor' ? [0, -1, 0] : null
      if (need && !solidish(name(x + need[0], y + need[1], z + need[2]))) drop(x, y, z)
    } else if (n === 'minecraft:lantern' || n === 'minecraft:soul_lantern') {
      const up = p.hanging === 'true'
      if (!solidish(name(x, up ? y + 1 : y - 1, z))) drop(x, y, z)
    }
  }
  // azaleas and carpets need something under them
  for (const [x, y, z] of b.entriesWhere(n => /^minecraft:(azalea|flowering_azalea|.*_carpet)$/.test(n))) if (!solidish(name(x, y - 1, z))) drop(x, y, z)
  // what would fall: the stable look-alike in its place
  const STABLE = { 'minecraft:sand': 'minecraft:sandstone', 'minecraft:red_sand': 'minecraft:red_sandstone', 'minecraft:gravel': 'minecraft:andesite', 'minecraft:suspicious_sand': 'minecraft:sandstone', 'minecraft:suspicious_gravel': 'minecraft:andesite' }
  for (const [x, y, z, blk] of b.entriesWhere(n => n in STABLE || /_concrete_powder$/.test(n))) {
    const below = name(x, y - 1, z)
    if (y > 0 && below && below !== 'minecraft:water' && !GROUND_PLANT.test(below)) continue
    b.set(x, y, z, STABLE[blk.name] ?? blk.name.replace('_concrete_powder', '_concrete'))
    fixed += 1
  }
  // hanging chains and dripstone: walk each column from its root
  for (const [x, y, z, blk] of b.entriesWhere(n => HANGING.test(n) || n === 'minecraft:pointed_dripstone')) {
    const n = blk.name
    if (HANGING.test(n)) {
      const above = name(x, y + 1, z)
      if (above && (HANGING.test(above) || solidish(above))) continue
      // the root of the chain hangs from nothing: remove the chain downward
      for (let yy = y; yy >= 0 && HANGING.test(name(x, yy, z) ?? ''); yy -= 1) drop(x, yy, z)
    } else if (n === 'minecraft:pointed_dripstone') {
      const down = (blk.props ?? {}).vertical_direction !== 'up'
      const step = down ? 1 : -1
      const next = name(x, y + step, z)
      if (next === 'minecraft:pointed_dripstone' || solidish(next)) continue
      for (let yy = y; name(x, yy, z) === 'minecraft:pointed_dripstone'; yy -= step) drop(x, yy, z)
    }
  }
  return fixed
}
