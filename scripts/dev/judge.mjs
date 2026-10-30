#!/usr/bin/env node
// The judge: the same look at every spawn, so builds can be compared fairly (the agent tests in
// docs/agent-test-log.md). From a spawn's .nbt (and its .placements.json) it takes a fixed shot
// list, lays them out on one contact sheet, and measures the audit numbers from the blocks
// themselves (so it works on any build, old or new):
//   1 iso-se   2 iso-nw          the whole spawn from two corners
//   3 spawn    the view on joining
//   4-7        eye level at the spawn looking north, east, south, west (in-game view distance)
//   8-11       high views from the four edges toward the centre (everything in view)
//
//   node scripts/dev/judge.mjs <spawn folder | build.nbt> [--out DIR] [--label "Haiku high r1"]
// Writes DIR/sheet.png, the single shots, and DIR/judge.json (the audit and the shot paths).

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng, loadGrid } from '../lib/blockview.mjs'
import { auditGrid } from '../lib/kit/audit.mjs'
import { ensureHeap } from '../lib/heap.mjs'

ensureHeap()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const argv = process.argv.slice(2)
const opt = (name, d) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : d
}
const target = argv.find((a, i) => !a.startsWith('--') && !['--out', '--label'].includes(argv[i - 1]))
if (!target) {
  console.error('usage: node scripts/dev/judge.mjs <spawn folder | build.nbt> [--out DIR] [--label NAME]')
  process.exit(1)
}
let nbt = target
if (fs.statSync(target).isDirectory()) {
  const nbts = fs.readdirSync(target).filter(f => f.endsWith('.nbt')).map(f => path.join(target, f))
  nbts.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size) // the spawn: the biggest
  nbt = nbts[0]
}
if (!nbt || !fs.existsSync(nbt)) throw new Error(`judge: no .nbt in ${target}`)
const stem = nbt.replace(/\.nbt$/, '')
const out = path.resolve(opt('--out', path.join(path.dirname(nbt), 'judge')))
fs.mkdirSync(out, { recursive: true })
const label = opt('--label', path.basename(stem))
const placementsFile = `${stem}.placements.json`
const placements = fs.existsSync(placementsFile) ? JSON.parse(fs.readFileSync(placementsFile, 'utf8')).placements ?? [] : []
const spawn = placements.find(p => p.type === 'spawn')

// ---- the numbers
const t0 = Date.now()
const grid = loadGrid(nbt)
const { X, Y, Z } = grid
const audit = auditGrid(grid, { placements })
const S = Math.max(X, Z)
const counts = {}
for (const p of placements) counts[p.type] = (counts[p.type] ?? 0) + 1
console.log(`judge ${label}: ${X}x${Y}x${Z}, audit ${audit.passed ? 'passed' : `${audit.failures.length} failing`} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
for (const f of audit.failures) console.log(`  FIX ${f}`)
for (const w of audit.warnings) console.log(`  warn ${w}`)

// ---- the shots
const run = (script, args) => {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], { encoding: 'utf8', maxBuffer: 1 << 26 })
  if (r.status !== 0) console.error(`judge: ${script} failed: ${(r.stderr || r.stdout).slice(-400)}`)
  return r.status === 0
}
const px = S > 700 ? '1' : S > 300 ? '2' : '3'
const files = []
const shot = name => path.join(out, `${path.basename(stem)}-${name}.png`)
for (const from of ['se', 'nw']) {
  const f = path.join(out, `iso-${from}.png`)
  if (run('isorender.mjs', [nbt, '--out', f, '--px', px, '--from', from])) files.push([`iso ${from}`, f])
}
const cx = spawn ? spawn.pos[0] : Math.round(X / 2)
const cz = spawn ? spawn.pos[2] : Math.round(Z / 2)
const sy = spawn ? spawn.pos[1] : Math.round(Y * 0.34)
const eyeLevel = []
if (spawn) eyeLevel.push({ name: 'spawn', spawn: true })
for (const [name, yaw] of [['look-n', 180], ['look-e', -90], ['look-s', 0], ['look-w', 90]])
  eyeLevel.push(spawn ? { name, spawn: true, yaw, pitch: 4 } : { name, eye: [cx, sy + 1.6, cz], yaw, pitch: 4 })
const sf = path.join(out, 'eye.json')
fs.writeFileSync(sf, JSON.stringify(eyeLevel))
if (run('screenshot.mjs', [nbt, '--shots', sf, '--out-dir', out, '--width', '960', '--height', '540', '--far', '300', '--no-log']))
  for (const s of eyeLevel) files.push([s.name, shot(s.name)])
const high = []
// from outside the canvas, above the tallest land, so no mountain on the rim blocks the view
const lift = Math.round(S * 0.3)
for (const [name, dx, dz] of [['high-s', 0, 1], ['high-w', -1, 0], ['high-n', 0, -1], ['high-e', 1, 0]])
  high.push({ name, eye: [Math.round(X / 2 + dx * X * 0.62), sy + lift, Math.round(Z / 2 + dz * Z * 0.62)], lookAt: [cx, sy, cz], fov: 62 })
const hf = path.join(out, 'high.json')
fs.writeFileSync(hf, JSON.stringify(high))
if (run('screenshot.mjs', [nbt, '--shots', hf, '--out-dir', out, '--width', '960', '--height', '540', '--far', String(Math.round(S * 1.3)), '--no-log']))
  for (const s of high) files.push([s.name, shot(s.name)])

// ---- the contact sheet: 3 columns of 480 x 270 cells, each labelled
const CW = 480
const CH = 270
const BAR = 18
const cols = 3
const rows = Math.ceil(files.length / cols)
const W = cols * CW
const H = rows * (CH + BAR) + 26
const img = Buffer.alloc(W * H * 3, 24)
const FONT = {
  A: '01110100011000111111100011000110001', B: '11110100011111010001100011000111110', C: '01111100001000010000100001000001111', D: '11110100011000110001100011000111110',
  E: '11111100001111010000100001000011111', F: '11111100001111010000100001000010000', G: '01111100001011110001100011000101110', H: '10001100011111110001100011000110001',
  I: '11111001000010000100001000010011111', J: '00111000100001000010100101001001100', K: '10001100101110010010100101000110001', L: '10000100001000010000100001000011111',
  M: '10001110111010110001100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001', S: '01111100000111000001000011000101110', T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110', V: '10001100011000110001010100101000100', W: '10001100011000110101101011101110001', X: '10001010100010001010100011000110001',
  Y: '10001010100010000100001000010000100', Z: '11111000010001000100010001000011111', ' ': '00000000000000000000000000000000000', '-': '00000000000111000000000000000000000',
  0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100110010001000011111', 3: '11110000010111000001000011000111110',
  4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000111110', 6: '01110100001111010001100011000101110', 7: '11111000010001000100010000100001000',
  8: '01110100011000101110100011000101110', 9: '01110100011000101111000010000101110', '.': '00000000000000000000000000000000100', ',': '00000000000000000000000100010001000',
  '%': '11001110010001000100010001001110011', '/': '00001000010001000100010001000010000',
}
const text = (str, x0, y0, rgb = [235, 235, 235], scale = 2) => {
  let x = x0
  for (const ch of String(str).toUpperCase()) {
    const g = FONT[ch] ?? FONT[' ']
    for (let r = 0; r < 7; r += 1)
      for (let c = 0; c < 5; c += 1)
        if (g[r * 5 + c] === '1')
          for (let dy = 0; dy < scale; dy += 1)
            for (let dx = 0; dx < scale; dx += 1) {
              const px2 = x + c * scale + dx
              const py2 = y0 + r * scale + dy
              if (px2 < 0 || py2 < 0 || px2 >= W || py2 >= H) continue
              const o = (py2 * W + px2) * 3
              img[o] = rgb[0]
              img[o + 1] = rgb[1]
              img[o + 2] = rgb[2]
            }
    x += 6 * scale
  }
}
text(`${label}  ${X}X${Z}  AUDIT ${audit.passed ? 'PASSED' : `${audit.failures.length} TO FIX`}  BARE ${audit.stats.bare ?? '-'}%  FLAT ${audit.stats.flat ?? '-'}%  TREES ${audit.stats.trees ?? '-'}%  BUILT ${audit.stats.built ?? '-'}%`, 8, 6, audit.passed ? [120, 220, 120] : [240, 150, 120])
for (const [k, [name, f]] of files.entries()) {
  if (!fs.existsSync(f)) continue
  const p = decodePng(fs.readFileSync(f))
  const ox = (k % cols) * CW
  const oy = 26 + Math.floor(k / cols) * (CH + BAR)
  text(`${k + 1} ${name}`, ox + 6, oy + 2, [200, 200, 200], 2)
  // fit the picture into the cell, keeping its proportions (box-averaged)
  const s = Math.min(CW / p.w, CH / p.h)
  const w = Math.floor(p.w * s)
  const h = Math.floor(p.h * s)
  const dx0 = ox + Math.floor((CW - w) / 2)
  const dy0 = oy + BAR + Math.floor((CH - h) / 2)
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const sx0 = Math.floor(x / s)
      const sy0 = Math.floor(y / s)
      const sx1 = Math.max(sx0 + 1, Math.floor((x + 1) / s))
      const sy1 = Math.max(sy0 + 1, Math.floor((y + 1) / s))
      let r = 0
      let g = 0
      let bl = 0
      let n = 0
      for (let yy = sy0; yy < sy1; yy += 1)
        for (let xx = sx0; xx < sx1; xx += 1) {
          const o = (yy * p.w + xx) * 4
          const a = p.rgba[o + 3] / 255
          r += p.rgba[o] * a + 24 * (1 - a)
          g += p.rgba[o + 1] * a + 24 * (1 - a)
          bl += p.rgba[o + 2] * a + 24 * (1 - a)
          n += 1
        }
      const d = ((dy0 + y) * W + dx0 + x) * 3
      img[d] = r / n
      img[d + 1] = g / n
      img[d + 2] = bl / n
    }
}
const sheet = path.join(out, 'sheet.png')
fs.writeFileSync(sheet, encodePng(W, H, img))
const report = { label, nbt, size: [X, Y, Z], placements: counts, audit, shots: Object.fromEntries(files.map(([n, f]) => [n, f])), sheet }
fs.writeFileSync(path.join(out, 'judge.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(`judge: ${sheet} (${files.length} shots, ${((Date.now() - t0) / 1000).toFixed(0)}s)`)
