#!/usr/bin/env node
// Smoke test for the reference spawns (assets/examples/spawns/) and the new-spawn scaffold: every
// reference spawn builds with valid block states, no part failing, no clipped blocks, a world spawn
// and its NPCs placed; a fresh scaffold's skeleton builds, a reference spawn builds from inside it,
// and a small spawn written the way the manual teaches (the frame, its own elements, the marks)
// builds with its places recorded and nothing blocking them.
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
    // the NPC list: a template's BRIEF.npcs, or an example's NPCS constant (comment lines skipped)
    const list = src.match(/\n  npcs: \[([\s\S]*?)\n  \],/)?.[1] ?? src.match(/const NPCS = \[([\s\S]*?)\n\]/)?.[1] ?? ''
    const want = (list.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n').match(/\bid:/g) ?? []).length
    if (want && npcs !== want) problems.push(`${npcs} NPCs placed, ${want} in NPCS`)
  }
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${label} ${secs}s${problems.length ? `\n     ${problems.join('\n     ')}` : ''}`)
  return problems.length === 0
}

// A small spawn in the scaffold folder, written the way the manual teaches: the frame, elements of
// its own (here the worked examples imported, each given this spawn's options), the marks.
const MINI = `import { startSpawn, finishSpawn, facingToward } from './frame/frame.mjs'
import { island } from './elements/island.mjs'
import { gridPlaza } from './elements/paving.mjs'
import { npcStand } from './elements/npc.mjs'
import { dais } from './elements/dais.mjs'
import { crateStage } from './elements/crates.mjs'
import { boardRecess } from './elements/boards.mjs'
import { gate } from './elements/gate.mjs'
import { rockGroup } from './elements/stones.mjs'
import { broadleaf } from './elements/trees.mjs'

export default function build(api) {
  const ctx = startSpawn(api, { name: 'Mini SMP', size: 72, height: 48, seed: 3 })
  const { b, FY, C } = ctx
  const [cx, cz] = C
  const groundY = island(ctx, { cx, cz, r: 30, depth: 12, seed: 4 })
  gridPlaza(ctx, { x0: cx - 16, z0: cz - 16, x1: cx + 16, z1: cz + 16, cx, cz, cell: 8, seed: 2 })
  dais(ctx, { cx, cz, R: 4, tiers: 2 })
  npcStand(ctx, [cx - 7, FY, cz - 6], facingToward([cx - 7, cz - 6], C), { label: 'Shop', npcId: 'shop', lines: ['/shop'] })
  npcStand(ctx, [cx + 7, FY, cz - 6], facingToward([cx + 7, cz - 6], C), { label: 'Warps', npcId: 'warps', stand: 'log', lantern: 'left' })
  crateStage(ctx, [cx - 10, FY, cz + 4], 'east', { label: 'Vote', colour: 'lime', crateId: 'vote' })
  crateStage(ctx, [cx - 10, FY, cz + 11], 'east', { label: 'Rare', colour: 'purple', block: 'ender_chest', crateId: 'rare' })
  boardRecess(ctx, [cx, FY, cz - 13], 'south', { label: 'Top balance', boardId: 'money' })
  gate(ctx, [cx, FY, cz + 14], 'north', { portalId: 'rtp', label: 'Random teleport' })
  for (const [x, z, s] of [[cx + 20, cz + 8, 3], [cx - 21, cz - 12, 2]]) if (groundY(x, z) >= 0) rockGroup(ctx, [x, groundY(x, z), z], { size: s, seed: x })
  for (const [x, z, h] of [[cx + 19, cz - 14, 11], [cx - 18, cz + 19, 8]]) if (groundY(x, z) >= 0) broadleaf(ctx, [x, groundY(x, z), z], { height: h, seed: z })
  return finishSpawn(ctx, { land: (x, z) => groundY(x, z) >= 0 })
}
`

let failed = 0
const only = process.argv.slice(2)
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()) {
  const name = f.replace(/\.mjs$/, '')
  if (only.length && !only.includes(name)) continue
  if (!check(path.join(dir, f), path.join(tmp, name), name)) failed += 1
}
// the scaffold: the skeleton, a reference spawn from inside the folder, a small hand-written spawn
if (!only.length || only.includes('scaffold')) {
  const out = path.join(tmp, 'scaffold')
  const r = node([path.join(root, 'scripts/new-spawn.mjs'), 'Scaffold Test', '--out-dir', out, '--size', '96'])
  if (r.status !== 0) {
    console.log(`FAIL new-spawn: ${(r.stderr || r.stdout).slice(-400)}`)
    failed += 1
  } else {
    if (!check(path.join(out, 'spawn.mjs'), out, 'new-spawn skeleton')) failed += 1
    if (!check(path.join(out, 'examples', 'kirin-practice.mjs'), path.join(out, 'ref'), 'reference spawn inside the folder')) failed += 1
    fs.writeFileSync(path.join(out, 'mini.mjs'), MINI)
    const miniOut = path.join(out, 'mini')
    if (!check(path.join(out, 'mini.mjs'), miniOut, 'hand-written spawn (frame + elements + marks)')) failed += 1
    else {
      const pl = JSON.parse(fs.readFileSync(path.join(miniOut, 'mini-smp.placements.json'), 'utf8')).placements
      const count = t => pl.filter(p => p.type === t).length
      const want = { npc: 2, crate: 2, leaderboard: 1, portal: 1, hologram: 1, spawn: 1 }
      const off = Object.entries(want).filter(([t, n]) => count(t) !== n)
      if (off.length) {
        console.log(`FAIL hand-written spawn placements: ${off.map(([t, n]) => `${count(t)} ${t} (want ${n})`).join(', ')}`)
        failed += 1
      }
    }
  }
}
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`spawn examples smoke: ${failed ? `${failed} failed` : 'all passed'}`)
process.exit(failed ? 1 : 0)
