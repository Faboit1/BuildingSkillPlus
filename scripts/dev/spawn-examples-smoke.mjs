#!/usr/bin/env node
// Smoke test for the hand-built example spawns (assets/examples/spawns/) and the new-spawn scaffold:
// every example builds with valid block states, no part failing, no clipped blocks, a world spawn and
// its NPCs placed; a fresh scaffold (and one started from an example) builds too.
//   npm run test:examples   (about two minutes)

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dir = path.join(root, 'assets/examples/spawns')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spawn-examples-'))
const node = (args, opts = {}) => spawnSync(process.execPath, ['--max-old-space-size=6144', ...args], { encoding: 'utf8', maxBuffer: 1 << 26, ...opts })

function check(recipe, out, label) {
  const t0 = Date.now()
  const r = node([path.join(root, 'scripts/run-build.mjs'), recipe, '--out-dir', out, '--json'])
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  const problems = []
  if (r.status !== 0) problems.push(`exit ${r.status}: ${(r.stderr || r.stdout || '').slice(-600)}`)
  else {
    const summary = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')))
    if (summary.builder?.problems?.length) problems.push(`invalid blocks: ${JSON.stringify(summary.builder.problems).slice(0, 300)}`)
    if (summary.builder?.clipped) problems.push(`${summary.builder.clipped} blocks clipped`)
    const failedParts = (r.stderr || '').split('\n').filter(l => /failed/.test(l))
    if (failedParts.length) problems.push(failedParts.slice(0, 3).join('; '))
    const clear = (r.stderr || '').split('\n').filter(l => /must stay clear/.test(l))
    if (clear.length) problems.push(`${clear.length} keep-clear warnings, e.g. ${clear[0]}`)
    const pl = fs.readdirSync(out).find(f => f.endsWith('.placements.json'))
    const placements = pl ? JSON.parse(fs.readFileSync(path.join(out, pl), 'utf8')).placements : []
    if (!placements.some(p => p.type === 'spawn')) problems.push('no world spawn')
    const npcs = placements.filter(p => p.type === 'npc' && p.role !== 'statue').length
    const src = fs.readFileSync(recipe, 'utf8')
    const want = (src.match(/const NPCS = \[([\s\S]*?)\n\]/)?.[1].match(/\bid:/g) ?? []).length
    if (want && npcs !== want) problems.push(`${npcs} NPCs placed, ${want} in NPCS`)
  }
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${label} ${secs}s${problems.length ? `\n     ${problems.join('\n     ')}` : ''}`)
  return problems.length === 0
}

let failed = 0
const only = process.argv.slice(2)
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()) {
  const name = f.replace(/\.mjs$/, '')
  if (only.length && !only.includes(name)) continue
  if (!check(path.join(dir, f), path.join(tmp, name), name)) failed += 1
}
// the scaffold: a blank skeleton and a copy of an example, each in its own folder
if (!only.length) {
  for (const [label, extra] of [['new-spawn (skeleton)', []], ['new-spawn --from frost-smp', ['--from', 'frost-smp']]]) {
    const out = path.join(tmp, `scaffold-${extra.length ? 'from' : 'blank'}`)
    const r = node([path.join(root, 'scripts/new-spawn.mjs'), 'Scaffold Test', '--out-dir', out, ...extra])
    if (r.status !== 0) {
      console.log(`FAIL ${label}: ${(r.stderr || r.stdout).slice(-400)}`)
      failed += 1
      continue
    }
    if (!check(path.join(out, 'spawn.mjs'), out, label)) failed += 1
  }
}
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`spawn examples smoke: ${failed ? `${failed} failed` : 'all passed'}`)
process.exit(failed ? 1 : 0)
