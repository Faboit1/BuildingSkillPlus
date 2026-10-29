#!/usr/bin/env node

// Convert between schematic formats so builds can be imported (studied, rendered, remixed) and
// exported to the formats players paste in game. Format logic lives in scripts/lib/formats.mjs;
// see references/formats.md for the in-game steps.

import fs from 'node:fs/promises'
import path from 'node:path'
import {
  DATA_VERSIONS,
  DEFAULT_DATA_VERSION,
  GridStructure,
  INPUT_EXTENSIONS,
  OUTPUT_EXTENSIONS,
  readAnyStructure,
  summarizeStructure,
  writeStructure,
} from './lib/formats.mjs'
import { readStructureGrid } from './lib/structio.mjs'
import { ensureHeap } from './lib/heap.mjs'

ensureHeap()

const STRUCTURE_BLOCK_LIMIT = 48
// a structure .nbt above this many blocks converts through a grid (structio): no object per block,
// so whole spawns of tens of millions of blocks fit in memory. CONVERT_FAST=1 forces it (tests).
const GRID_FROM = 1_500_000

function usage() {
  return `Usage:
  node scripts/convert.mjs <input> --out <output> [options]
  node scripts/convert.mjs <input> --info [--json]

Input formats (detected from content):  ${INPUT_EXTENSIONS.join(', ')}
  .nbt        vanilla structure (structure block / jigsaw pieces)
  .litematic  Litematica (all regions are merged)
  .schem      Sponge schematic v1/v2/v3 (WorldEdit, FAWE)
  .schematic  legacy MCEdit/Schematica (pre-1.13 numeric ids, converted to modern names)
Output formats (from the --out extension): ${OUTPUT_EXTENSIONS.join(', ')}

Options:
  --out <file>            Write the converted build (.nbt, .schem or .litematic)
  --info                  Print format, size, block counts, top 20 blocks and regions
  --data-version <n>      DataVersion to write (default: the input's own DataVersion so the game
                          can upgrade it; ${DEFAULT_DATA_VERSION} = 1.21.1 when the input has none)
  --name <name>           Schematic name stored in .litematic/.schem metadata (default: output file name)
  --author <name>         Author stored in .litematic/.schem metadata
  --palette <i>           Vanilla structures with several palettes: which variant to load (default 0)
  --region <name>         Litematic: load only this region instead of merging all of them
  --keep-air              Keep explicit air blocks (vanilla structures use them to clear terrain)
  --compression gzip|zlib|none   Compression for .nbt output (default gzip)
  --json                  Print a JSON summary
`
}

function parseArgs(argv) {
  const options = {
    input: undefined,
    out: undefined,
    info: false,
    dataVersion: undefined,
    name: undefined,
    author: undefined,
    paletteIndex: undefined,
    region: undefined,
    keepAir: false,
    compression: 'gzip',
    json: false,
    help: false,
  }

  const readValue = (arg, index) => {
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`${arg} requires a value`)
    return value
  }
  const valueFlags = {
    '--out': value => { options.out = value },
    '--data-version': value => { options.dataVersion = Number(value) },
    '--name': value => { options.name = value },
    '--author': value => { options.author = value },
    '--palette': value => { options.paletteIndex = Number(value) },
    '--region': value => { options.region = value },
    '--compression': value => { options.compression = value },
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const eq = arg.indexOf('=')
    const flag = arg.startsWith('--') && eq !== -1 ? arg.slice(0, eq) : arg
    if (arg === '-h' || arg === '--help') {
      options.help = true
    } else if (arg === '--info') {
      options.info = true
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--keep-air') {
      options.keepAir = true
    } else if (valueFlags[flag]) {
      if (flag !== arg) {
        valueFlags[flag](arg.slice(eq + 1))
      } else {
        valueFlags[flag](readValue(arg, index))
        index += 1
      }
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    } else if (!options.input) {
      options.input = arg
    } else {
      throw new Error(`Unexpected argument: ${arg}`)
    }
  }

  if (options.dataVersion !== undefined && (!Number.isInteger(options.dataVersion) || options.dataVersion <= 0)) {
    throw new Error('--data-version must be a positive integer')
  }
  if (options.paletteIndex !== undefined && (!Number.isInteger(options.paletteIndex) || options.paletteIndex < 0)) {
    throw new Error('--palette must be a non-negative integer')
  }
  if (!['gzip', 'zlib', 'none'].includes(options.compression)) {
    throw new Error('--compression must be gzip, zlib, or none')
  }
  return options
}

function releaseName(dataVersion) {
  if (!dataVersion) return 'unknown'
  const entries = Object.entries(DATA_VERSIONS)
  const exact = entries.find(([, dv]) => dv === dataVersion)
  if (exact) return exact[0]
  const below = entries.filter(([, dv]) => dv < dataVersion).pop()
  return below ? `after ${below[0]}` : 'pre-1.12'
}

function describeFormat(result) {
  const v = result.meta.formatVersion
  switch (result.format) {
    case 'structure-nbt': return 'vanilla structure .nbt'
    case 'litematic': return `Litematica .litematic (schematic version ${v})`
    case 'mcedit': return `legacy MCEdit/Schematica .schematic (${v})`
    default: return `Sponge schematic v${v} .schem`
  }
}

// position -> state string for non-air blocks, caching toString() per palette state object.
function blockMap(structure) {
  const names = new Map()
  const map = new Map()
  const [, sy, sz] = structure.getSize()
  for (const block of structure.getBlocks()) {
    let key = names.get(block.state)
    if (key === undefined) {
      key = block.state.toString()
      names.set(block.state, key)
    }
    if (key === 'minecraft:air' || key === 'minecraft:cave_air' || key === 'minecraft:void_air' || key === 'minecraft:structure_void') continue
    map.set((block.pos[0] * sy + block.pos[1]) * sz + block.pos[2], { key, nbt: Boolean(block.nbt && block.nbt.size > 0) })
  }
  return map
}

function verifyRoundTrip(source, written) {
  const a = source.getSize()
  const b = written.getSize()
  if (a.join(',') !== b.join(',')) return `size changed from ${a.join('x')} to ${b.join('x')}`
  const before = blockMap(source)
  const after = blockMap(written)
  if (before.size !== after.size) return `block count changed from ${before.size} to ${after.size}`
  let nbtBefore = 0
  let nbtAfter = 0
  for (const [index, block] of before) {
    const other = after.get(index)
    if (!other || other.key !== block.key) return `block at index ${index} changed from ${block.key} to ${other?.key ?? 'nothing'}`
    if (block.nbt) nbtBefore += 1
    if (other.nbt) nbtAfter += 1
  }
  if (nbtBefore !== nbtAfter) return `block entity count changed from ${nbtBefore} to ${nbtAfter}`
  return undefined
}

function nextSteps(outPath) {
  const ext = path.extname(outPath).toLowerCase()
  const base = path.basename(outPath, ext)
  if (ext === '.nbt') {
    const id = base.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_')
    const lines = [`Copy to <world>/generated/minecraft/structures/${id}.nbt, then /place template minecraft:${id} ~ ~ ~ (or a structure block in LOAD mode)`]
    if (id !== base) lines.unshift(`Rename the file to ${id}.nbt first: structure ids must be lowercase a-z, 0-9, _ . -`)
    return lines
  }
  if (ext === '.schem') {
    return [`Copy to plugins/WorldEdit/schematics/ (Fabric/Forge: config/worldedit/schematics/), then //schem load ${base} and //paste`]
  }
  return ['Copy to .minecraft/schematics/, then open Litematica (M) > Load Schematics and place it']
}

function printInfo(inputPath, result, summary) {
  const { meta } = result
  console.log(`File:        ${inputPath}`)
  console.log(`Format:      ${describeFormat(result)}${meta.compression && meta.compression !== 'gzip' ? ` [${meta.compression}]` : ''}`)
  console.log(`DataVersion: ${result.dataVersion ?? 'none'}${result.dataVersion ? ` (${releaseName(result.dataVersion)})` : ''}`)
  if (meta.name || meta.author) console.log(`Name:        ${meta.name ?? '-'}${meta.author ? `  by ${meta.author}` : ''}`)
  if (meta.description) console.log(`Description: ${meta.description}`)
  const [x, y, z] = summary.size
  console.log(`Size:        ${x} x ${y} x ${z} (volume ${x * y * z})`)
  console.log(`Blocks:      ${summary.blockCount} non-air, ${summary.blockIdCount} block ids, ${summary.stateCount} states, ${summary.blockEntities} block entities`)
  if (meta.entities) console.log(`Entities:    ${meta.entities} (not imported)`)
  if (meta.palettes) console.log(`Palettes:    ${meta.palettes} variants (loaded ${meta.paletteIndex})`)
  if (meta.jigsawsReplaced) console.log(`Jigsaws:     ${meta.jigsawsReplaced} replaced by their final_state`)
  console.log(`Regions:     ${meta.regions.length}`)
  for (const region of meta.regions) {
    console.log(`  - ${region.name}: origin [${region.origin.join(', ')}] size [${region.size.join(', ')}] blocks ${region.blocks}`)
  }
  if (meta.legacy) {
    const unknown = Object.entries(meta.legacy.unknownIds).map(([id, n]) => `${id}x${n}`).join(', ')
    console.log(`Legacy ids:  ${meta.legacy.coverage}% of ${meta.legacy.nonAirBlocks} blocks converted${unknown ? `; unknown: ${unknown}` : ''}`)
  }
  const dropped = Object.entries(meta.dropped).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`)
  if (dropped.length) console.log(`Dropped:     ${dropped.join(', ')}`)
  console.log(`Top ${summary.top.length} blocks:`)
  const width = String(summary.top[0]?.count ?? 0).length
  for (const entry of summary.top) console.log(`  ${String(entry.count).padStart(width)}  ${entry.name}`)
  for (const warning of meta.warnings) console.log(`Note: ${warning}`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  if (!options.input) throw new Error(`Missing input file.\n${usage()}`)
  if (!options.out && !options.info) throw new Error(`Nothing to do: pass --out <file> or --info.\n${usage()}`)

  const inputPath = path.resolve(options.input)
  const inputExt = path.extname(inputPath).toLowerCase()
  if (inputExt === '.mcstructure') throw new Error('Bedrock .mcstructure files are not supported (Java Edition formats only)')
  let outExt
  if (options.out) {
    outExt = path.extname(options.out).toLowerCase()
    if (!OUTPUT_EXTENSIONS.includes(outExt)) {
      throw new Error(`Unsupported output extension '${outExt || '(none)'}'; use ${OUTPUT_EXTENSIONS.join(', ')}`)
    }
  }

  const bytes = new Uint8Array(await fs.readFile(inputPath))
  let result
  const grid = inputExt === '.nbt' && options.out && outExt !== '.nbt' && !options.keepAir && options.paletteIndex === undefined ? readStructureGrid(bytes) : null
  if (grid && (grid.blocks > GRID_FROM || process.env.CONVERT_FAST)) {
    const size = [grid.X, grid.Y, grid.Z]
    result = {
      format: 'structure-nbt',
      dataVersion: grid.dataVersion,
      structure: new GridStructure(grid),
      meta: { warnings: [], dropped: {}, regions: [{ name: 'structure', origin: [0, 0, 0], size, blocks: grid.blocks }], compression: 'gzip', grid: true },
    }
  } else {
    result = readAnyStructure(bytes, inputPath, {
      paletteIndex: options.paletteIndex,
      region: options.region,
      keepAir: options.keepAir,
      targetDataVersion: options.dataVersion ?? DEFAULT_DATA_VERSION,
    })
  }
  const summary = summarizeStructure(result.structure, { top: 20 })
  const report = {
    input: inputPath,
    format: result.format,
    formatVersion: result.meta.formatVersion,
    dataVersion: result.dataVersion ?? null,
    ...summary,
    meta: result.meta,
  }

  if (options.info && !options.json) printInfo(inputPath, result, summary)

  if (options.out) {
    const outPath = path.resolve(options.out)
    const dataVersion = options.dataVersion ?? result.dataVersion ?? DEFAULT_DATA_VERSION
    const name = options.name ?? path.basename(outPath, outExt)
    const outBytes = writeStructure(result.structure, outExt, {
      dataVersion,
      compression: options.compression,
      name: outExt === '.nbt' ? '' : name,
      author: options.author,
    })
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, outBytes)

    // re-read the output and compare every block (a whole spawn read through the grid is checked
    // by its block count only: re-reading it through Lodestone would need an object per block)
    const big = result.meta.grid && summary.blockCount > GRID_FROM
    const reread = big ? { format: outExt.slice(1) } : readAnyStructure(outBytes, outPath, { keepAir: options.keepAir })
    const problem = big ? undefined : verifyRoundTrip(result.structure, reread.structure)
    if (problem) throw new Error(`Output failed round-trip validation: ${problem}`)

    const [x, y, z] = summary.size
    const notes = []
    if (outExt === '.nbt' && Math.max(x, y, z) > STRUCTURE_BLOCK_LIMIT) {
      notes.push(`Larger than ${STRUCTURE_BLOCK_LIMIT} on some axis: a structure block cannot load it in one piece; use /place template.`)
    }
    if (result.meta.entities) notes.push(`${result.meta.entities} entities in the input were not carried over.`)
    if (result.dataVersion && options.dataVersion && options.dataVersion !== result.dataVersion) {
      notes.push(`DataVersion relabelled ${result.dataVersion} -> ${options.dataVersion}; block names were not upgraded.`)
    }
    report.output = {
      path: outPath,
      format: reread.format,
      dataVersion,
      bytes: outBytes.length,
      verified: big ? 'block count' : true,
      notes,
      next: nextSteps(outPath),
    }

    if (!options.json) {
      if (options.info) console.log('')
      console.log(`Converted ${result.format} -> ${reread.format}`)
      console.log(`  Input:   ${inputPath}`)
      console.log(`  Output:  ${outPath} (${outBytes.length} bytes, DataVersion ${dataVersion} = ${releaseName(dataVersion)})`)
      console.log(`  Size:    ${x} x ${y} x ${z}`)
      console.log(`  Blocks:  ${summary.blockCount} (${summary.blockEntities} block entities)`)
      console.log(big ? '  Verified: block count (a big build: the block-by-block re-read is skipped)' : '  Verified: output re-reads with identical blocks and block-entity positions')
      for (const note of [...result.meta.warnings, ...notes]) console.log(`  Note: ${note}`)
      for (const step of report.output.next) console.log(`  Next: ${step}`)
    }
  }

  if (options.json) console.log(JSON.stringify(report, null, 2))
}

main().catch(err => {
  console.error(`convert: ${err.message}`)
  process.exitCode = 1
})
