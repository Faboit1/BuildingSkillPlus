#!/usr/bin/env node
// Self-test for scripts/screenshot.mjs: a tiny scene (a floor, a red wall north of the camera, a
// blue pillar east of it), photographed looking north and looking east; the middle pixel must show
// the red wall and the blue pillar respectively, and the top row must be sky.
//   npm run test:screenshot

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-test-'))
const recipe = path.join(tmp, 'scene.mjs')
fs.writeFileSync(recipe, `export default function build(api) {
  const b = api.builder([32, 16, 32])
  b.box([0, 0, 0], [31, 0, 31], 'stone')
  b.box([8, 1, 4], [24, 8, 4], 'red_concrete')      // north of the camera at [16, 1, 16]
  b.box([26, 1, 15], [27, 10, 17], 'blue_concrete') // east of it
  b.spawnPoint([16, 0, 16], 'north')
  return b.finish({ name: 'scene' })
}
`)
const run = args => spawnSync(process.execPath, args, { encoding: 'utf8', cwd: root })
let r = run([path.join(root, 'scripts/run-build.mjs'), recipe, '--out-dir', tmp, '--json'])
if (r.status !== 0) throw new Error(r.stderr)
r = run([path.join(root, 'scripts/screenshot.mjs'), path.join(tmp, 'scene.nbt'), '--shots', JSON.stringify([{ name: 'north', spawn: true }, { name: 'east', pos: [16, 16], yaw: -90 }]), '--width', '160', '--height', '90', '--out-dir', tmp])
if (r.status !== 0) throw new Error(r.stderr)

// minimal decoder for the RGB PNGs screenshot.mjs writes (8-bit, colour type 2, filter 0 rows)
function rgbAt(file, px, py) {
  const buf = fs.readFileSync(file)
  let p = 8
  let w = 0
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    if (type === 'IHDR') w = buf.readUInt32BE(p + 8)
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len))
    p += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const o = py * (w * 3 + 1) + 1 + px * 3
  return [raw[o], raw[o + 1], raw[o + 2]]
}
let failed = 0
const check = (label, ok, got) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` (got rgb ${got.join(',')})`}`)
  if (!ok) failed += 1
}
const north = path.join(tmp, 'scene-north.png')
const east = path.join(tmp, 'scene-east.png')
const n = rgbAt(north, 80, 45)
check('looking north (yaw 180) the middle shows the red wall', n[0] > 90 && n[0] > 2 * n[2] && n[0] > 1.5 * n[1], n)
const e = rgbAt(east, 80, 45)
check('looking east (yaw -90) the middle shows the blue pillar', e[2] > 60 && e[2] > 1.5 * e[0], e)
const s = rgbAt(north, 80, 1)
check('the top row is sky', s[2] > 180 && s[2] > s[0], s)
const f = rgbAt(north, 80, 88)
check('the bottom row is the stone floor', Math.abs(f[0] - f[2]) < 30 && f[0] < 180, f)
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`screenshot selftest: ${failed ? `${failed} failed` : 'all passed'}`)
process.exit(failed ? 1 : 0)
