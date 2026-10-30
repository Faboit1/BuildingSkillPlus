// Completes blocks that only make sense with a partner or a support, the way a player would
// have placed them: the upper half of doors and tall plants, the head of a bed, and the faces
// of vines. Without this a bare 'tall_grass' or 'oak_door' exports as a lone lower half and a
// bare 'vine' has no faces (invisible). Runs after default states are filled.

import { DIR, HORIZONTAL, isFullSolid, opposite } from './blocks.mjs'

const TALL_PLANTS = /^minecraft:(tall_grass|large_fern|sunflower|lilac|rose_bush|peony|pitcher_plant|tall_seagrass|small_dripleaf)$/
// the one-block plant a tall one becomes when there is no room for its upper half
const SHORT_OF = { 'minecraft:tall_grass': 'minecraft:short_grass', 'minecraft:large_fern': 'minecraft:fern', 'minecraft:sunflower': 'minecraft:dandelion', 'minecraft:lilac': 'minecraft:allium', 'minecraft:rose_bush': 'minecraft:poppy', 'minecraft:peony': 'minecraft:pink_tulip', 'minecraft:pitcher_plant': 'minecraft:torchflower' }
const isDoor = name => /_door$/.test(name)
const isBed = name => /_bed$/.test(name)

// store: { get(x,y,z), put(x,y,z,block), entries(), inBounds?(x,y,z) }. Returns count changed.
export function completeBlocks(store) {
  const inBounds = store.inBounds ? (x, y, z) => store.inBounds(x, y, z) : () => true
  let changed = 0
  const place = (x, y, z, block) => {
    if (!inBounds(x, y, z)) return
    const here = store.get(x, y, z)
    // the upper half of tall seagrass replaces the water it grows into
    if (here && !(block.name === 'minecraft:tall_seagrass' && here.name === 'minecraft:water')) return
    store.put(x, y, z, block)
    changed += 1
  }
  const wanted = name => TALL_PLANTS.test(name) || isDoor(name) || isBed(name) || name === 'minecraft:vine'
  for (const [x, y, z, block] of store.entriesWhere ? store.entriesWhere(wanted) : store.entries()) {
    const { name } = block
    const props = block.props ?? {}
    if (TALL_PLANTS.test(name) && name !== 'minecraft:tall_seagrass' && name !== 'minecraft:small_dripleaf') {
      // a two-block plant needs both halves: complete it where there is room, else shrink a lower
      // half with something above it to its one-block kin, and drop an upper half with no lower
      const above = store.get(x, y + 1, z)
      const below = store.get(x, y - 1, z)
      if (props.half === 'upper') {
        if (!(below?.name === name && below.props?.half === 'lower')) {
          if (store.remove) store.remove(x, y, z)
          else store.put(x, y, z, null)
          changed += 1
        }
      } else if (!above) place(x, y + 1, z, { name, props: { ...props, half: 'upper' } })
      else if (!(above.name === name && above.props?.half === 'upper')) {
        store.put(x, y, z, { name: SHORT_OF[name] ?? 'minecraft:short_grass', props: {} })
        changed += 1
      }
    } else if ((TALL_PLANTS.test(name) || isDoor(name)) && props.half === 'lower') {
      place(x, y + 1, z, { name, props: { ...props, half: 'upper' } })
    } else if (isBed(name) && props.part) {
      const d = DIR[props.facing ?? 'north']
      if (props.part === 'foot') place(x + d[0], y, z + d[2], { name, props: { ...props, part: 'head' } })
      else place(x - d[0], y, z - d[2], { name, props: { ...props, part: 'foot' } })
    } else if (name === 'minecraft:vine') {
      const faces = HORIZONTAL.filter(f => props[f] === 'true')
      if (faces.length === 0 && props.up !== 'true') {
        const next = { ...props }
        let any = false
        for (const f of HORIZONTAL) {
          const d = DIR[f]
          const n = store.get(x + d[0], y, z + d[2])
          if (n && isFullSolid(n.name)) {
            next[f] = 'true'
            any = true
          }
        }
        const above = store.get(x, y + 1, z)
        if (above && isFullSolid(above.name)) {
          next.up = 'true'
          any = true
        }
        // Hanging under another vine: inherit its faces (vanilla vines spread down that way).
        if (!any && above && above.name === 'minecraft:vine') {
          for (const f of HORIZONTAL) if (above.props?.[f] === 'true') {
            next[f] = 'true'
            any = true
          }
        }
        if (any) {
          store.put(x, y, z, { name, props: next })
          changed += 1
        }
      }
    }
  }
  return changed
}

export { opposite }
