// Stamp an existing schematic (.nbt / .schem / .litematic / legacy .schematic) into a build:
// study a downloaded build, remix it, or reuse a module you exported earlier.
//   const info = b.importStructure('downloads/tavern.schem', [10, 4, 12], { rotate: 1 })
//   // → { size: [x, y, z], format, blocks, skipped }
// `at` is where the structure's min corner lands (before rotation, like b.stamp). Options:
// rotate (quarter turns clockwise seen from above), mirror ('x' | 'z'), keep (only fill empty
// cells), only (replace only matching blocks), keepAir (true clears the destination where the
// file has air), region (litematic), paletteIndex (vanilla structures with several palettes).
// Block entities (chests, signs) keep their NBT; entities are dropped.

import fs from 'node:fs'
import { readAnyStructure } from '../formats.mjs'

export function importStructure(b, source, at = [0, 0, 0], { rotate = 0, mirror, keep = false, only, keepAir = false, region, paletteIndex } = {}) {
  const bytes = typeof source === 'string' ? fs.readFileSync(source) : source
  const { structure, format } = readAnyStructure(bytes, typeof source === 'string' ? source : '', { keepAir, region, paletteIndex })
  const size = [...structure.getSize()]
  const module = b.module(size)
  let blocks = 0
  let skipped = 0
  for (const block of structure.getBlocks()) {
    const name = block.state.getName().toString()
    if (name === 'minecraft:structure_void') continue
    const isAir = /^minecraft:(cave_|void_)?air$/.test(name)
    if (isAir && !keepAir) continue
    const [x, y, z] = block.pos
    const props = { ...block.state.getProperties() }
    const entry = { name: isAir ? 'minecraft:air' : name, props }
    if (block.nbt && block.nbt.size > 0) entry.nbt = block.nbt
    module.put(x, y, z, entry)
    if (isAir) skipped += 1
    else blocks += 1
  }
  b.stamp(module, at, { rotate, mirror, keep, only }) // air entries clear their destination cell
  return { size, format, blocks, skipped }
}

export const IMPORT_METHODS = { importStructure }
