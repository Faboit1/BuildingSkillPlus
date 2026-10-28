// Spawn themes: every material and planting decision the parts make comes from here, so a
// theme is a complete art direction. Roles (all vanilla 1.21.1 ids, namespace optional):
//   ground     walking surface outside the paving, as kit.palette weights (clumped, never speckle)
//   paving     plaza field (≥ 70% of the floor), border (rings, kerbs), path (worn walks), inlay
//   wall       building field: { field: weights, quoin, base } — base = foundation / plinth course
//   timber     posts, beams, frames (a log/stripped log id); wood = the plank family (stairs/slabs)
//   plaster    infill between timbers (null = the theme has no timber framing)
//   roof       stair/slab family for roofs ('deepslate_tile', 'spruce', 'dark_oak'...), roofStyle
//   trim       a family with stairs for cornices, sills, frames
//   accent     the ONE accent colour (dye name): banners, awnings, glass, crate glows; ≤ 5% of surfaces
//   plinth     the 1-block NPC plinth
//   light      the hidden glow block (behind glass, under slabs); lantern = visible fixture
//   trees      featureTree style for the big plaza trees; forest species weights for the landscape
//   setting    default site: 'island' | 'valley' | 'plains' | 'mountain' | 'coast'
//   kit        materials passed to the spawn-kit components (npcSpot, leaderboards, crate, portal, sign)
// Accent default is never gold: the user dislikes gold trim.

const base = {
  light: 'ochre_froglight',
  lantern: 'lantern',
  glass: 'glass_pane',
}

export const THEMES = {
  autumn: {
    ...base,
    label: 'Autumn',
    setting: 'island',
    ground: { grass_block: 6, coarse_dirt: 2, rooted_dirt: 1, podzol: 1 },
    paving: { field: { coarse_dirt: 3, packed_mud: 2, dirt_path: 0, rooted_dirt: 1, grass_block: 1 }, border: 'orange_terracotta', path: { coarse_dirt: 3, packed_mud: 2 }, inlay: 'red_terracotta' },
    wall: { field: { stone_bricks: 6, cracked_stone_bricks: 1, mossy_stone_bricks: 1 }, quoin: 'stone_bricks', base: 'cobblestone' },
    timber: 'stripped_spruce_log', wood: 'spruce', plaster: null,
    roof: 'dark_oak', roofStyle: 'steep-gable',
    trim: 'stone_brick',
    accent: 'orange',
    plinth: 'chiseled_quartz_block',
    trees: { feature: 'autumn', forest: [[5, 'autumn'], [2, 'birch'], [1, 'spruce']] },
    flowers: [[6, 'short_grass'], [2, 'fern'], [1, 'orange_tulip'], [1, 'red_tulip'], [1, 'dead_bush']],
    kit: { primary: 'stone_bricks', trim: 'stone_brick', base: 'cobblestone', wood: 'spruce', roof: 'dark_oak', accent: 'orange_terracotta', colour: 'orange' },
  },
  medieval: {
    ...base,
    label: 'Medieval town',
    setting: 'valley',
    ground: { grass_block: 7, coarse_dirt: 1, moss_block: 1 },
    paving: { field: { stone_bricks: 4, andesite: 2, polished_andesite: 2, cobblestone: 1 }, border: 'polished_deepslate', path: { cobblestone: 2, andesite: 2, gravel: 1 }, inlay: 'bricks' },
    wall: { field: { stone_bricks: 5, andesite: 2, cobblestone: 1, mossy_stone_bricks: 1 }, quoin: 'polished_andesite', base: 'cobblestone' },
    timber: 'stripped_dark_oak_log', wood: 'spruce', plaster: 'white_terracotta',
    roof: 'deepslate_tile', roofStyle: 'gable',
    trim: 'stone_brick',
    accent: 'red',
    plinth: 'chiseled_stone_bricks',
    trees: { feature: 'oak', forest: [[4, 'oak'], [2, 'birch'], [2, 'spruce'], [1, 'big_oak']] },
    flowers: [[8, 'short_grass'], [2, 'tall_grass'], [1, 'poppy'], [1, 'dandelion'], [1, 'oxeye_daisy'], [1, 'cornflower']],
    kit: { primary: 'stone_bricks', trim: 'stone_brick', base: 'cobblestone', wood: 'spruce', roof: 'deepslate_tile', accent: 'red_terracotta', colour: 'red' },
  },
  'white-town': {
    ...base,
    label: 'White town',
    setting: 'coast',
    ground: { grass_block: 7, moss_block: 1, coarse_dirt: 1 },
    paving: { field: { polished_andesite: 5, smooth_stone: 2, andesite: 1 }, border: 'polished_deepslate', path: { smooth_stone: 3, polished_andesite: 2 }, inlay: 'blue_concrete' },
    wall: { field: { smooth_quartz: 5, quartz_bricks: 1, calcite: 1 }, quoin: 'quartz_pillar', base: 'polished_deepslate' },
    timber: 'stripped_dark_oak_log', wood: 'dark_oak', plaster: null,
    roof: 'deepslate_tile', roofStyle: 'hip',
    trim: 'polished_deepslate',
    accent: 'blue',
    plinth: 'chiseled_quartz_block',
    trees: { feature: 'oak', forest: [[4, 'oak'], [2, 'azalea'], [1, 'birch'], [1, 'cherry']] },
    flowers: [[7, 'short_grass'], [1, 'azure_bluet'], [1, 'cornflower'], [1, 'lily_of_the_valley'], [1, 'allium']],
    kit: { primary: 'smooth_quartz', trim: 'polished_deepslate', base: 'deepslate_tiles', wood: 'dark_oak', roof: 'deepslate_tile', accent: 'blue_concrete', colour: 'blue' },
  },
  japanese: {
    ...base,
    label: 'Japanese',
    setting: 'island',
    ground: { grass_block: 6, moss_block: 2, coarse_dirt: 1 },
    paving: { field: { gravel: 3, stone_bricks: 2, andesite: 1 }, border: 'polished_andesite', path: { stone_bricks: 3, andesite: 1, mossy_stone_bricks: 1 }, inlay: 'mossy_stone_bricks' },
    wall: { field: { white_terracotta: 4, calcite: 1 }, quoin: 'stripped_dark_oak_log', base: 'mossy_stone_bricks' },
    timber: 'stripped_dark_oak_log', wood: 'dark_oak', plaster: 'white_terracotta',
    roof: 'deepslate_tile', roofStyle: 'east',
    trim: 'dark_oak',
    accent: 'red',
    plinth: 'polished_andesite',
    trees: { feature: 'cherry', forest: [[4, 'cherry'], [3, 'pine'], [1, 'azalea']] },
    flowers: [[6, 'short_grass'], [2, 'fern'], [1, 'pink_petals'], [1, 'azure_bluet']],
    kit: { primary: 'white_terracotta', trim: 'dark_oak', base: 'mossy_stone_bricks', wood: 'dark_oak', roof: 'deepslate_tile', accent: 'red_terracotta', colour: 'red' },
  },
  winter: {
    ...base,
    label: 'Winter village',
    setting: 'mountain',
    ground: { snow_block: 6, grass_block: 1, packed_ice: 0, powder_snow: 0 },
    paving: { field: { stone_bricks: 4, polished_andesite: 2, cobblestone: 1 }, border: 'spruce_planks', path: { stone_bricks: 2, cobblestone: 2, gravel: 1 }, inlay: 'red_terracotta' },
    wall: { field: { spruce_planks: 4, stripped_spruce_log: 1 }, quoin: 'spruce_log', base: 'stone_bricks' },
    timber: 'stripped_spruce_log', wood: 'spruce', plaster: null,
    roof: 'spruce', roofStyle: 'steep-gable', snowRoofs: true,
    trim: 'spruce',
    accent: 'red',
    plinth: 'polished_diorite',
    trees: { feature: 'snowy_spruce', forest: [[5, 'spruce'], [3, 'pine'], [1, 'birch']] },
    flowers: [[1, 'fern']],
    kit: { primary: 'spruce_planks', trim: 'spruce', base: 'stone_bricks', wood: 'spruce', roof: 'spruce', accent: 'red_terracotta', colour: 'red' },
  },
  fantasy: {
    ...base,
    label: 'Fantasy',
    setting: 'island',
    ground: { grass_block: 6, moss_block: 2 },
    paving: { field: { calcite: 3, polished_diorite: 2, diorite: 1 }, border: 'purpur_block', path: { calcite: 2, mossy_stone_bricks: 1, stone_bricks: 1 }, inlay: 'amethyst_block' },
    wall: { field: { calcite: 4, polished_diorite: 2, mossy_stone_bricks: 1 }, quoin: 'stripped_birch_log', base: 'mossy_stone_bricks' },
    timber: 'stripped_birch_log', wood: 'birch', plaster: 'calcite',
    roof: 'dark_prismarine', roofStyle: 'cone',
    trim: 'prismarine_brick',
    accent: 'purple',
    plinth: 'amethyst_block',
    trees: { feature: 'blossom', forest: [[3, 'cherry'], [3, 'azalea'], [2, 'big_oak'], [1, 'birch']] },
    flowers: [[5, 'short_grass'], [2, 'allium'], [1, 'pink_petals'], [1, 'lily_of_the_valley'], [1, 'blue_orchid']],
    light: 'pearlescent_froglight',
    kit: { primary: 'calcite', trim: 'prismarine_brick', base: 'mossy_stone_bricks', wood: 'birch', roof: 'dark_prismarine', accent: 'amethyst_block', colour: 'purple' },
  },
  crimson: {
    ...base,
    label: 'Crimson (nether)',
    setting: 'island',
    light: 'shroomlight',
    ground: { grass_block: 7, crimson_nylium: 2, podzol: 1, coarse_dirt: 1 },
    paving: { field: { polished_blackstone_bricks: 4, polished_blackstone: 2, blackstone: 1, cracked_polished_blackstone_bricks: 1 }, border: 'red_nether_bricks', path: { blackstone: 2, polished_blackstone: 2, coarse_dirt: 1 }, inlay: 'nether_bricks' },
    wall: { field: { polished_blackstone_bricks: 5, cracked_polished_blackstone_bricks: 1, blackstone: 1 }, quoin: 'polished_blackstone', base: 'blackstone' },
    timber: 'stripped_crimson_stem', wood: 'crimson', plaster: 'red_nether_bricks',
    roof: 'nether_brick', roofStyle: 'steep-gable',
    trim: 'polished_blackstone',
    accent: 'red',
    plinth: 'polished_blackstone',
    trees: { feature: 'crimson', forest: [[4, 'crimson'], [2, 'dark_oak'], [1, 'autumn']] },
    flowers: [[5, 'short_grass'], [2, 'crimson_roots'], [1, 'red_tulip'], [1, 'poppy'], [1, 'crimson_fungus']],
    kit: { primary: 'polished_blackstone_bricks', trim: 'polished_blackstone', base: 'blackstone', wood: 'crimson', roof: 'nether_brick', accent: 'red_nether_bricks', colour: 'red' },
  },
  tropical: {
    ...base,
    label: 'Tropical island',
    setting: 'coast',
    // grass with sandy patches; a warm sandstone plaza with teal borders and light-blue inlay (the
    // sea colour), jungle-wood huts under bamboo thatch, palms everywhere
    ground: { grass_block: 9, moss_block: 1, coarse_dirt: 1 },
    paving: { field: { smooth_sandstone: 4, sandstone: 2, cut_sandstone: 1 }, border: 'cyan_terracotta', path: { sand: 3, coarse_dirt: 1, packed_mud: 1 }, inlay: 'light_blue_terracotta' },
    wall: { field: { white_terracotta: 4, smooth_sandstone: 2, birch_planks: 1 }, quoin: 'stripped_jungle_log', base: 'mossy_cobblestone' },
    timber: 'stripped_jungle_log', wood: 'jungle', plaster: 'white_terracotta',
    roof: 'bamboo', roofStyle: 'steep-gable',
    trim: 'smooth_sandstone',
    accent: 'light_blue',
    plinth: 'chiseled_quartz_block',
    trees: { feature: 'palm', forest: [[6, 'palm'], [2, 'azalea'], [1, 'oak']] },
    flowers: [[6, 'short_grass'], [2, 'fern'], [1, 'blue_orchid'], [1, 'dandelion'], [1, 'allium']],
    kit: { primary: 'smooth_sandstone', trim: 'smooth_sandstone', base: 'cut_sandstone', wood: 'jungle', roof: 'bamboo', accent: 'light_blue_terracotta', colour: 'light_blue' },
  },
}

export const THEME_ALIASES = { fall: 'autumn', halloween: 'autumn', town: 'medieval', castle: 'medieval', white: 'white-town', classic: 'white-town', modern: 'white-town', greek: 'white-town', asian: 'japanese', japan: 'japanese', sakura: 'japanese', snow: 'winter', christmas: 'winter', elven: 'fantasy', magic: 'fantasy', nether: 'crimson', hell: 'crimson', lifesteal: 'crimson', red: 'crimson', dark: 'crimson', blood: 'crimson', beach: 'tropical', pirate: 'tropical', island: 'tropical', caribbean: 'tropical', tiki: 'tropical', jungle: 'tropical', summer: 'tropical' }

// A theme name, or a theme of your own built on one: { base: 'tropical', label: 'Desert oasis', ...roles }.
// The roles you give replace the base's; paving, wall, trees, kit and buildings merge one level deep
// ({ paving: { border: 'cut_red_sandstone' } } keeps the base's field, path and inlay), every other
// role (ground, flowers, roof...) is replaced whole. The buildings and the landscape follow the base.
const MERGED = ['paving', 'wall', 'trees', 'kit', 'buildings']
export function resolveTheme(name, accent) {
  if (name && typeof name === 'object') {
    const { base = 'medieval', ...roles } = name
    const key = THEMES[base] ? base : THEME_ALIASES[base] ?? 'medieval'
    const t = { key, ...THEMES[key] }
    for (const [role, value] of Object.entries(roles)) t[role] = MERGED.includes(role) && value && typeof value === 'object' ? { ...(t[role] ?? {}), ...value } : value
    const colour = accent ?? roles.accent
    if (colour && !roles.kit?.colour) {
      t.accent = colour
      t.kit = { ...t.kit, colour, accent: roles.kit?.accent ?? `${colour}_terracotta` }
    }
    return t
  }
  const key = THEMES[name] ? name : THEME_ALIASES[name] ?? 'medieval'
  const t = { key, ...THEMES[key] }
  if (accent && accent !== t.accent) {
    t.accent = accent
    t.kit = { ...t.kit, colour: accent, accent: `${accent}_terracotta` }
  }
  return t
}
