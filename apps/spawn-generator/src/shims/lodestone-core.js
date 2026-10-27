// The worker's Lodestone: everything but the WebGL renderer and the pack loader (which pull in
// three.js), so the generator bundle stays small. Same exports scripts/lib/lodestone.mjs gives Node.

export * from '../../../../scripts/node_modules/lodestone/lib/core/index.js'
export * from '../../../../scripts/node_modules/lodestone/lib/litematic/index.js'
export * from '../../../../scripts/node_modules/lodestone/lib/math/index.js'
export * from '../../../../scripts/node_modules/lodestone/lib/nbt/index.js'
export * from '../../../../scripts/node_modules/lodestone/lib/util/index.js'

export const LODESTONE_ROOT = '/scripts/node_modules/lodestone/'
