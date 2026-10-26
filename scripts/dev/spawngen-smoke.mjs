#!/usr/bin/env node
// Smoke test for the spawn generator: every type and theme builds without throwing, with valid block
// states, every NPC placed, and the world spawn set.   npm run test:spawns   (about a minute)

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spawngen-'))
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
  const out = path.join(tmp, brief.name.replace(/\s+/g, '-').toLowerCase())
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/make-spawn.mjs'), '--brief', JSON.stringify(brief), '--out-dir', out, '--no-render', '--no-convert'], { encoding: 'utf8', maxBuffer: 1 << 26 })
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  const problems = []
  if (r.status !== 0) problems.push(`exit ${r.status}: ${(r.stderr || '').slice(-600)}`)
  else {
    const slug = fs.readdirSync(out).find(f => f.endsWith('.placements.json'))
    const placements = JSON.parse(fs.readFileSync(path.join(out, slug), 'utf8')).placements
    const npcs = placements.filter(p => p.type === 'npc' && p.role !== 'statue').length
    const want = typeof brief.npcs === 'number' ? brief.npcs : brief.npcs.length
    if (npcs !== want) problems.push(`${npcs} NPCs placed, ${want} asked`)
    if (!placements.some(p => p.type === 'spawn')) problems.push('no world spawn')
    if (/invalid block/.test(r.stdout)) problems.push(r.stdout.split('\n').filter(l => /invalid block/.test(l)).slice(0, 3).join('; '))
    if (/failed:/.test(r.stdout)) problems.push(r.stdout.split('\n').filter(l => /failed:/.test(l)).slice(0, 3).join('; '))
  }
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${brief.name} (${brief.type}, ${brief.theme}) ${secs}s${problems.length ? `\n     ${problems.join('\n     ')}` : ''}`)
  if (problems.length) failed += 1
}
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`spawngen smoke: ${cases.length - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
