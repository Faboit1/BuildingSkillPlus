#!/usr/bin/env node
// The big-build test: builds scripts/dev/scale-spawn.mjs (a 1000 x 200 x 1000 spawn of 15+ million
// blocks from the manual's element examples), then renders its overview and the spawn view, and
// converts it to .schem, checking each step and timing it.
//   npm run test:scale   (about 3 minutes)

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { heapTargetMb } from '../lib/heap.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scale-test-'))
const node = args => spawnSync(process.execPath, [`--max-old-space-size=${heapTargetMb()}`, ...args], { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, MC_HEAP_SET: '1' } })
let failed = 0
const step = (label, args, check) => {
  const t0 = Date.now()
  const r = node(args)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  const problem = r.status !== 0 ? `exit ${r.status}: ${(r.stderr || r.stdout).slice(-600)}` : check?.(r)
  console.log(`${problem ? 'FAIL' : 'ok  '} ${label} ${secs}s${problem ? `\n     ${problem}` : ''}`)
  if (problem) failed += 1
  return r
}

const nbt = path.join(tmp, 'scale-test.nbt')
step('build 1000 x 200 x 1000', [path.join(root, 'scripts/run-build.mjs'), path.join(root, 'scripts/dev/scale-spawn.mjs'), '--out-dir', tmp, '--json'], r => {
  const s = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')))
  if (s.blockCount < 10e6) return `only ${s.blockCount} blocks`
  if (s.builder?.problems?.length) return `invalid blocks: ${JSON.stringify(s.builder.problems).slice(0, 300)}`
  if (s.builder?.clipped) return `${s.builder.clipped} blocks clipped`
  const types = s.placements?.types ?? {}
  if (types.spawn !== 1 || (types.npc ?? 0) < 13 || types.crate !== 5 || types.portal !== 1) return `placements ${JSON.stringify(types)}`
  console.log(`     ${s.blockCount} blocks, ${s.paletteCount} states, placements ${JSON.stringify(types)}`)
})
if (fs.existsSync(nbt)) {
  step('overview (isorender px 1)', [path.join(root, 'scripts/isorender.mjs'), nbt, '--out', path.join(tmp, 'iso.png'), '--px', '1'], () => (fs.existsSync(path.join(tmp, 'iso.png')) ? undefined : 'no image'))
  step('spawn view (screenshot)', [path.join(root, 'scripts/screenshot.mjs'), nbt, '--spawn', '--out', path.join(tmp, 'view.png')], () => (fs.existsSync(path.join(tmp, 'view.png')) ? undefined : 'no image'))
  step('.schem export', [path.join(root, 'scripts/convert.mjs'), nbt, '--out', path.join(tmp, 'scale-test.schem'), '--force'], () => (fs.statSync(path.join(tmp, 'scale-test.schem')).size > 1e6 ? undefined : 'schem too small'))
}
if (process.argv.includes('--keep')) console.log(`files kept in ${tmp}`)
else fs.rmSync(tmp, { recursive: true, force: true })
console.log(`scale test: ${failed ? `${failed} failed` : 'all passed'}`)
process.exit(failed ? 1 : 0)
