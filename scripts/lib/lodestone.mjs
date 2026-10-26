// The one runtime dependency, Lodestone (NBT, structures, the default resource pack), bundled in
// scripts/node_modules/lodestone so the plugin works without npm. The folder has a plain name
// because plugin uploads reject the '@' of its npm scope; every script imports Lodestone from here.

import { fileURLToPath } from 'node:url'

export * from '../node_modules/lodestone/lib/index.js'

// the package root (assets/default-pack holds the block states, models and texture atlas)
export const LODESTONE_ROOT = fileURLToPath(new URL('../node_modules/lodestone/', import.meta.url))
