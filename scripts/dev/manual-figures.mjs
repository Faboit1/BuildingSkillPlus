#!/usr/bin/env node
// The do / don't figures of the spawn manual. Every references/spawns/elements/<name>.mjs exports
// `figure` ({ size, height, floorY, px, from }) and `demo(ctx, which)`; this builds demo(ctx, 'good')
// and demo(ctx, 'bad') on their own canvases, renders both and writes them side by side, under a
// green DO and a red DON'T bar, to references/spawns/img/<name>.png.
//
//   node scripts/dev/manual-figures.mjs                 every element
//   node scripts/dev/manual-figures.mjs stones trees    some of them
//   node scripts/dev/manual-figures.mjs --check         build only (the test): no invalid blocks, nothing clipped

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createApi } from '../lib/pipeline.mjs'
import { decodePng, encodePng } from '../lib/blockview.mjs'
import { startSpawn } from '../../assets/frame/frame.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dir = path.join(root, 'references/spawns/elements')
const out = path.join(root, 'references/spawns/img')
const argv = process.argv.slice(2)
const check = argv.includes('--check')
const only = argv.filter(a => !a.startsWith('--'))
const names = fs.readdirSync(dir).filter(f => f.endsWith('.mjs') && !f.startsWith('_')).map(f => f.replace(/\.mjs$/, '')).filter(n => !only.length || only.includes(n)).sort()
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'figures-'))

// a 5x7 font for the two labels
const GLYPHS = {
  D: ['1110', '1001', '1001', '1001', '1001', '1001', '1110'],
  O: ['0110', '1001', '1001', '1001', '1001', '1001', '0110'],
  N: ['1001', '1101', '1101', '1011', '1011', '1001', '1001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  "'": ['1', '1', '0', '0', '0', '0', '0'],
  ' ': ['00', '00', '00', '00', '00', '00', '00'],
}
function label(img, W, text, x0, y0, scale, rgb) {
  let x = x0
  for (const ch of text) {
    const g = GLYPHS[ch]
    for (let r = 0; r < g.length; r += 1)
      for (let c = 0; c < g[r].length; c += 1)
        if (g[r][c] === '1')
          for (let dy = 0; dy < scale; dy += 1)
            for (let dx = 0; dx < scale; dx += 1) {
              const p = ((y0 + r * scale + dy) * W + (x + c * scale + dx)) * 3
              img[p] = rgb[0]
              img[p + 1] = rgb[1]
              img[p + 2] = rgb[2]
            }
    x += (g[0].length + 1) * scale
  }
}

function buildOne(mod, name, which) {
  const f = mod.figure ?? {}
  const api = createApi()
  const ctx = startSpawn(api, { name: `${name}-${which}`, size: f.size ?? 24, height: f.height ?? 24, floorY: f.floorY ?? 3, seed: f.seed ?? 7 })
  mod.demo(ctx, which)
  const result = ctx.b.finish({ name: `${name}-${which}` })
  // the good half must keep what it marks clear (an NPC's head room, a crate's front, a board's text)
  const blocked = which === 'good' ? (ctx.b.warnings ?? []).filter(w => /must stay clear/.test(w)) : []
  const report = result.metadata?.builderReport ?? {}
  return { structure: result.structure, report: { ...report, problems: [...(report.problems ?? []), ...blocked] } }
}

let failed = 0
for (const name of names) {
  const mod = await import(pathToFileURL(path.join(dir, `${name}.mjs`)).href)
  const pngs = []
  for (const which of ['good', 'bad']) {
    let built
    try {
      built = buildOne(mod, name, which)
    } catch (err) {
      console.log(`FAIL ${name} ${which}: ${err.stack}`)
      failed += 1
      continue
    }
    const { structure, report } = built
    const problems = [...(report.problems ?? []), ...(report.clipped ? [`${report.clipped} clipped`] : [])]
    if (problems.length) {
      console.log(`FAIL ${name} ${which}: ${problems.slice(0, 3).join('; ')}`)
      failed += 1
    }
    if (check) continue
    const nbt = path.join(tmp, `${name}-${which}.nbt`)
    fs.writeFileSync(nbt, structure.writeNbt({ name: '', dataVersion: 3955, compression: 'gzip' }))
    const png = path.join(tmp, `${name}-${which}.png`)
    const f = mod.figure ?? {}
    // an isometric view by default; figure.camera = { eye, lookAt, fov } shoots it like a player sees it
    const cam = f.camera
    const args = cam
      ? [path.join(root, 'scripts/screenshot.mjs'), nbt, '--eye', cam.eye.join(','), '--look-at', cam.lookAt.join(','), '--fov', String(cam.fov ?? 60), '--width', String(cam.width ?? 560), '--height', String(cam.height ?? 380), '--out', png]
      : [path.join(root, 'scripts/isorender.mjs'), nbt, '--out', png, '--px', String(f.px ?? 8), '--from', f.from ?? 'se']
    const r = spawnSync(process.execPath, args, { encoding: 'utf8' })
    if (r.status !== 0) {
      console.log(`FAIL ${name} ${which} render: ${r.stderr.slice(-400)}`)
      failed += 1
      continue
    }
    pngs.push(decodePng(fs.readFileSync(png)))
  }
  if (check) {
    if (!failed) console.log(`ok   ${name}`)
    continue
  }
  if (pngs.length !== 2) continue
  // side by side: DO left, DON'T right, a coloured bar with the label over each
  const bar = 34
  const gap = 12
  const [a, c] = pngs
  const W = a.w + gap + c.w
  const H = bar + Math.max(a.h, c.h)
  const img = Buffer.alloc(W * H * 3, 255)
  const blit = (p, x0) => {
    for (let y = 0; y < p.h; y += 1)
      for (let x = 0; x < p.w; x += 1) {
        const s = (y * p.w + x) * 4
        const d = ((y + bar) * W + x + x0) * 3
        const al = p.rgba[s + 3] / 255
        img[d] = Math.round(p.rgba[s] * al + 255 * (1 - al))
        img[d + 1] = Math.round(p.rgba[s + 1] * al + 255 * (1 - al))
        img[d + 2] = Math.round(p.rgba[s + 2] * al + 255 * (1 - al))
      }
  }
  const fillBar = (x0, w, rgb) => {
    for (let y = 0; y < bar - 4; y += 1)
      for (let x = x0; x < x0 + w; x += 1) {
        const d = (y * W + x) * 3
        img[d] = rgb[0]
        img[d + 1] = rgb[1]
        img[d + 2] = rgb[2]
      }
  }
  blit(a, 0)
  blit(c, a.w + gap)
  fillBar(0, a.w, [46, 125, 50])
  fillBar(a.w + gap, c.w, [198, 40, 40])
  label(img, W, 'DO', 10, 5, 3, [255, 255, 255])
  label(img, W, "DON'T", a.w + gap + 10, 5, 3, [255, 255, 255])
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, `${name}.png`), encodePng(W, H, img))
  console.log(`ok   ${name} → references/spawns/img/${name}.png (${W}x${H})`)
}
fs.rmSync(tmp, { recursive: true, force: true })
if (check) console.log(`manual figures: ${names.length - failed} of ${names.length} built clean`)
process.exitCode = failed ? 1 : 0
