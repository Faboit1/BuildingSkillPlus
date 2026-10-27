#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as lodestone from './lib/lodestone.mjs'
import { DEFAULT_DATA_VERSION, createApi, fillDefaultStates, setupSheet, summarize, updateStructureConnections, worldPlacements } from './lib/pipeline.mjs'

const { NbtFile, Structure } = lodestone

function usage() {
  return `Usage:
  node scripts/run-build.mjs <recipe.mjs> [--out-dir <dir>] [--name <name>] [--data-version <number>] [--compression gzip|zlib|none] [--no-block-state-updates] [--no-default-states] [--origin x,y,z] [--world <name>] [--json]

  --origin x,y,z   where the build's minimum corner will be pasted in the world (default 0,0,0);
                   used for the world coordinates in <name>.placements.json and <name>.setup.md
  --world <name>   the world name used in the plugin commands of <name>.setup.md (default world)
`
}

function parseArgs(argv) {
  const options = {
    recipe: undefined,
    outDir: undefined,
    name: undefined,
    dataVersion: DEFAULT_DATA_VERSION,
    compression: 'gzip',
    updateBlockStates: true,
    defaultStates: true,
    json: false,
    help: false,
    origin: [0, 0, 0],
    world: 'world',
  }
  const parseOrigin = value => {
    const out = String(value).split(/[,\s]+/).filter(Boolean).map(Number)
    if (out.length !== 3 || !out.every(Number.isInteger)) throw new Error('--origin must be three integers: x,y,z')
    return out
  }

  const readValue = (arg, index) => {
    const value = argv[index + 1]
    if (!value || value.startsWith('-')) throw new Error(`${arg} requires a value`)
    return value
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '-h' || arg === '--help') {
      options.help = true
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--no-block-state-updates') {
      options.updateBlockStates = false
    } else if (arg === '--no-default-states') {
      options.defaultStates = false
    } else if (arg === '--out-dir') {
      options.outDir = readValue(arg, index)
      index += 1
    } else if (arg.startsWith('--out-dir=')) {
      options.outDir = arg.slice('--out-dir='.length)
    } else if (arg === '--name') {
      options.name = readValue(arg, index)
      index += 1
    } else if (arg.startsWith('--name=')) {
      options.name = arg.slice('--name='.length)
    } else if (arg === '--data-version') {
      options.dataVersion = Number(readValue(arg, index))
      index += 1
    } else if (arg.startsWith('--data-version=')) {
      options.dataVersion = Number(arg.slice('--data-version='.length))
    } else if (arg === '--compression') {
      options.compression = readValue(arg, index)
      index += 1
    } else if (arg.startsWith('--compression=')) {
      options.compression = arg.slice('--compression='.length)
    } else if (arg === '--origin') {
      // negative coordinates look like flags to readValue, so read the next argument directly
      if (argv[index + 1] === undefined) throw new Error('--origin requires a value')
      options.origin = parseOrigin(argv[index + 1])
      index += 1
    } else if (arg.startsWith('--origin=')) {
      options.origin = parseOrigin(arg.slice('--origin='.length))
    } else if (arg === '--world') {
      options.world = readValue(arg, index)
      index += 1
    } else if (arg.startsWith('--world=')) {
      options.world = arg.slice('--world='.length)
    } else if (!options.recipe) {
      options.recipe = arg
    } else {
      throw new Error(`Unexpected argument: ${arg}`)
    }
  }

  if (!Number.isInteger(options.dataVersion) || options.dataVersion <= 0) {
    throw new Error('--data-version must be a positive integer')
  }
  if (!['gzip', 'zlib', 'none'].includes(options.compression)) {
    throw new Error('--compression must be gzip, zlib, or none')
  }

  return options
}

function slugify(value) {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'minecraft-build'
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  if (!options.recipe) {
    throw new Error(`Missing recipe file.\n${usage()}`)
  }

  const recipePath = path.resolve(options.recipe)
  const recipe = await import(`${pathToFileURL(recipePath).href}?v=${Date.now()}`)
  const buildFn = recipe.default ?? recipe.build
  if (typeof buildFn !== 'function') {
    throw new Error('Recipe must export a default function or named build function')
  }

  // With --json, stdout must stay pure JSON: send the recipe's console.log output to stderr.
  const log = console.log
  if (options.json) console.log = (...args) => console.error(...args)
  let result
  try {
    result = await buildFn(createApi())
  } finally {
    console.log = log
  }
  const structure = result instanceof Structure ? result : result?.structure
  if (!(structure instanceof Structure)) {
    throw new Error('Recipe must return a Lodestone Structure or { structure, metadata }')
  }

  const metadata = {
    ...(recipe.metadata ?? {}),
    ...(result?.metadata ?? {}),
  }
  // Builder-made structures already carry vanilla-accurate connection states. Raw-API
  // structures get the same pass here: default states first, then stairs/walls/fences/panes.
  const kitUpdated = metadata.blockStatesUpdated === true
  const outputStructure = options.updateBlockStates || options.defaultStates ? structure.clone() : structure
  const defaultsFilled = options.defaultStates ? fillDefaultStates(outputStructure) : 0
  const blockStateUpdates = options.updateBlockStates && !kitUpdated
    ? { updatedBlocks: updateStructureConnections(outputStructure) }
    : { updatedBlocks: 0 }
  const builderReport = metadata.builderReport
  delete metadata.builderReport
  const name = slugify(options.name ?? metadata.name ?? path.basename(recipePath, path.extname(recipePath)))
  const outDir = path.resolve(options.outDir ?? path.join('minecraft-builds', name))
  await fs.mkdir(outDir, { recursive: true })

  const nbtPath = path.join(outDir, `${name}.nbt`)
  const bytes = outputStructure.writeNbt({
    name: '',
    dataVersion: options.dataVersion,
    compression: options.compression,
  })
  await fs.writeFile(nbtPath, bytes)

  const file = NbtFile.read(bytes)
  const roundTrip = Structure.fromNbt(file.root)
  const stats = summarize(outputStructure)
  const roundTripStats = summarize(roundTrip)
  if (JSON.stringify(stats.size) !== JSON.stringify(roundTripStats.size) || stats.blockCount !== roundTripStats.blockCount) {
    throw new Error('Generated NBT failed Lodestone round-trip validation')
  }

  // spawn kit placements: NPC spots, hologram anchors, crates, portals, regions, the world spawn
  const placements = Array.isArray(metadata.placements) ? metadata.placements : []
  let placementsOut
  if (placements.length) {
    const counts = {}
    for (const p of placements) counts[p.type] = (counts[p.type] ?? 0) + 1
    if ((counts.spawn ?? 0) > 1) throw new Error('placements: more than one world spawn')
    const size = outputStructure.getSize()
    const list = worldPlacements(placements, options.origin)
    const jsonPath = path.join(outDir, `${name}.placements.json`)
    const setupPath = path.join(outDir, `${name}.setup.md`)
    await fs.writeFile(jsonPath, `${JSON.stringify({
      name,
      size,
      origin: options.origin,
      world: options.world,
      note: 'local = structure coordinates (minimum corner 0,0,0); world = origin + local. npc pos = the block the feet are in; hologram/anchor = hologram location (top line); crate pos = the crate block; portal and region min/max = inclusive block corners.',
      placements: list,
    }, null, 2)}\n`)
    await fs.writeFile(setupPath, setupSheet({ name, origin: options.origin, world: options.world, size, placements: list }))
    placementsOut = { count: placements.length, types: counts, origin: options.origin, world: options.world, jsonPath, setupPath }
  }

  const summary = {
    name,
    dataVersion: options.dataVersion,
    compression: options.compression,
    updateBlockStates: options.updateBlockStates,
    defaultStatesFilled: defaultsFilled,
    blockStateUpdates: kitUpdated ? { updatedBlocks: builderReport?.connectionsUpdated ?? 0, by: 'kit' } : blockStateUpdates,
    ...(builderReport ? { builder: {
      clipped: builderReport.clipped,
      ...(builderReport.clippedRange ? { clippedRange: builderReport.clippedRange, clippedFrom: builderReport.clippedFrom } : {}),
      leavesPersisted: builderReport.leavesPersisted,
      problems: builderReport.problems,
      ...(builderReport.warnings?.length ? { warnings: builderReport.warnings } : {}),
      ...(builderReport.spawnProof ? { spawnProof: builderReport.spawnProof } : {}),
    } } : {}),
    ...(placementsOut ? { placements: placementsOut } : {}),
    nbtPath,
    summaryPath: path.join(outDir, 'summary.json'),
    ...stats,
    recipePath,
  }
  await fs.writeFile(summary.summaryPath, `${JSON.stringify(summary, null, 2)}\n`)

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(`Generated ${summary.name}`)
    console.log(`  NBT: ${summary.nbtPath}`)
    console.log(`  Size: ${summary.size.join(' x ')}`)
    console.log(`  Blocks: ${summary.blockCount}`)
    console.log(`  Palette: ${summary.paletteCount}`)
    if (placementsOut) {
      console.log(`  Placements: ${placementsOut.count} (${Object.entries(placementsOut.types).map(([k, v]) => `${v} ${k}`).join(', ')})`)
      console.log(`  Setup: ${placementsOut.setupPath}`)
    }
  }
}

main().catch(err => {
  // the message, then where it happened: the first frames outside Node itself (the recipe's line first)
  const at = String(err?.stack ?? '').split('\n').filter(l => /^\s+at /.test(l) && !/node:internal|node_modules/.test(l)).slice(0, 3)
  console.error(`run-build: ${err?.message ?? err}${at.length ? `\n${at.join('\n')}` : ''}`)
  process.exitCode = 1
})
