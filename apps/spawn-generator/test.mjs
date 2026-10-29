#!/usr/bin/env node
// Smoke test for the spawn generator (the browser builder's engine): every type and theme builds
// without throwing, with valid block states, every NPC placed and the world spawn set; then the
// browser page builds.   node apps/spawn-generator/test.mjs   (about a minute)

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApi, fillDefaultStates } from '../../scripts/lib/pipeline.mjs'
import { generateSpawn } from './spawngen/index.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const cases = [
  { name: 'Smoke Autumn', type: 'normal', theme: 'autumn', npcs: 6 },
  { name: 'Smoke Medieval', type: 'normal', theme: 'medieval', npcs: 14, setting: 'valley' },
  { name: 'Smoke White', type: 'normal', theme: 'white-town', accent: 'blue', npcs: 4, crates: 0, setting: 'coast' },
  { name: 'Smoke Winter', type: 'normal', theme: 'winter', npcs: 8, setting: 'mountain', features: { pvp: false, afk: true } },
  { name: 'Smoke Plus', type: 'plus', theme: 'fantasy', npcs: 9, leaderboards: 2 },
  { name: 'Smoke PvP', type: 'pvp', theme: 'japanese', npcs: 5, crates: 1 },
  { name: 'Smoke Crimson', type: 'normal', theme: 'crimson', npcs: 10, leaderboards: ['Kills', 'Playtime'] },
]
let failed = 0
for (const brief of cases) {
  const t0 = Date.now()
  const problems = []
  try {
    const result = generateSpawn(createApi(), brief)
    fillDefaultStates(result.structure)
    const report = result.metadata?.builderReport ?? {}
    const placements = result.metadata?.placements ?? []
    const npcs = placements.filter(p => p.type === 'npc' && p.role !== 'statue').length
    const want = typeof brief.npcs === 'number' ? brief.npcs : brief.npcs.length
    if (npcs !== want) problems.push(`${npcs} NPCs placed, ${want} asked`)
    if (!placements.some(p => p.type === 'spawn')) problems.push('no world spawn')
    if (report.problems?.length) problems.push(`invalid blocks: ${report.problems.slice(0, 3).join('; ')}`)
    if (report.clipped) problems.push(`${report.clipped} placements clipped`)
    const failedParts = (result.metadata?.spawngen?.warnings ?? []).filter(w => /failed:/.test(w))
    if (failedParts.length) problems.push(failedParts.slice(0, 3).join('; '))
  } catch (err) {
    problems.push(err.stack ?? String(err))
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${brief.name} (${brief.type}, ${brief.theme}) ${secs}s${problems.length ? `\n     ${problems.join('\n     ')}` : ''}`)
  if (problems.length) failed += 1
}
// the browser page: the bundle builds
const b = spawnSync(process.execPath, [path.join(here, 'build.mjs'), '--quiet'], { encoding: 'utf8' })
if (b.status !== 0) {
  failed += 1
  console.log(`FAIL browser page build\n     ${(b.stderr || b.stdout).slice(-800)}`)
} else console.log('ok   browser page build')
console.log(`spawn generator: ${cases.length + 1 - failed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
