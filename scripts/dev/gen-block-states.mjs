#!/usr/bin/env node

// Generates scripts/lib/data/block-states.json from Minecraft's own block report.
//
// 1. Download the server jar for the target version (1.21.1 matches the preview pack):
//      https://piston-data.mojang.com/v1/objects/59353fb40c36d304f2035d51e7d6e6baa98dc05c/server.jar
// 2. Run Mojang's data generator:
//      java -DbundlerMainClass=net.minecraft.data.Main -jar server.jar --reports --output generated
// 3. node scripts/dev/gen-block-states.mjs generated/reports/blocks.json [--version 1.21.1]
//
// Output: { version, blocks: { "minecraft:oak_stairs": { d: {default props}, v: {prop: [values]} } } }
// Blocks without properties are stored as {} so the file doubles as the list of valid ids.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const input = args.find(a => !a.startsWith('--'))
const versionIndex = args.indexOf('--version')
const version = versionIndex >= 0 ? args[versionIndex + 1] : '1.21.1'
if (!input) {
  console.error('usage: node scripts/dev/gen-block-states.mjs <reports/blocks.json> [--version 1.21.1]')
  process.exit(1)
}
const report = JSON.parse(fs.readFileSync(input, 'utf8'))
const blocks = {}
for (const [id, def] of Object.entries(report).sort(([a], [b]) => a.localeCompare(b))) {
  if (!def.properties) {
    blocks[id] = {}
    continue
  }
  const defaultState = def.states.find(state => state.default) ?? def.states[0]
  blocks[id] = { d: defaultState.properties, v: def.properties }
}
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'data', 'block-states.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
const lines = Object.entries(blocks).map(([id, value]) => `${JSON.stringify(id)}:${JSON.stringify(value)}`)
fs.writeFileSync(out, `{"version":${JSON.stringify(version)},"blocks":{\n${lines.join(',\n')}\n}}\n`)
console.log(`wrote ${Object.keys(blocks).length} blocks to ${out}`)
