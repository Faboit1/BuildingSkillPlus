#!/usr/bin/env node
// Builds every example recipe and renders README gallery images into docs/gallery/
// (JPEG, one day and one night hero shot per example). Needs Playwright + Chromium and
// ImageMagick's `convert` for the JPEG step (falls back to PNG without it).
//
//   node scripts/dev/gallery.mjs                     # all assets/examples/*.mjs
//   node scripts/dev/gallery.mjs castle wizard-tower # only these
//   node scripts/dev/gallery.mjs --view hero --width 1600 --height 1000 --zoom 1.15

import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const opt = (flag, fallback) => {
  const i = args.indexOf(flag)
  if (i < 0) return fallback
  const value = args[i + 1]
  args.splice(i, 2)
  return value
}
const view = opt('--view', 'se')
const width = opt('--width', '1500')
const height = opt('--height', '1000')
const zoom = opt('--zoom', '1.15')
const quality = opt('--quality', '84')

const examplesDir = path.join(root, 'assets', 'examples')
const outDir = path.join(root, 'docs', 'gallery')
await fs.mkdir(outDir, { recursive: true })

const names = args.length
  ? args
  : (await fs.readdir(examplesDir)).filter(f => f.endsWith('.mjs')).map(f => f.slice(0, -4)).sort()

let hasConvert = true
try {
  await run('convert', ['-version'])
} catch {
  hasConvert = false
}

const results = []
for (const name of names) {
  const recipe = path.join(examplesDir, `${name}.mjs`)
  const buildDir = path.join(root, 'minecraft-builds', `gallery-${name}`)
  const started = Date.now()
  try {
    const { stdout } = await run('node', [path.join(root, 'scripts', 'run-build.mjs'), recipe, '--out-dir', buildDir, '--json'], {
      maxBuffer: 64 * 1024 * 1024,
    })
    const summary = JSON.parse(stdout)
    const renderDir = path.join(buildDir, 'renders')
    await run('node', [
      path.join(root, 'scripts', 'render.mjs'),
      '--nbt', summary.nbtPath,
      '--views', view,
      '--zoom', zoom,
      '--lighting', 'both',
      '--width', width,
      '--height', height,
      '--no-sheet',
    ], { maxBuffer: 16 * 1024 * 1024, timeout: 15 * 60 * 1000 })
    for (const lighting of ['day', 'night']) {
      const src = path.join(renderDir, `${view}-${lighting}.png`)
      const base = lighting === 'day' ? name : `${name}-night`
      if (hasConvert) await run('convert', [src, '-strip', '-quality', quality, path.join(outDir, `${base}.jpg`)])
      else await fs.copyFile(src, path.join(outDir, `${base}.png`))
    }
    results.push({ name, size: summary.size, blocks: summary.blockCount ?? summary.blocks, problems: summary.builder?.problems?.length ?? 0, seconds: Math.round((Date.now() - started) / 1000) })
    console.log(`ok   ${name} (${Math.round((Date.now() - started) / 1000)}s)`)
  } catch (error) {
    results.push({ name, error: String(error.stderr || error.message).split('\n').slice(0, 6).join('\n') })
    console.log(`FAIL ${name}\n${results.at(-1).error}`)
  }
}

await fs.writeFile(path.join(outDir, 'gallery.json'), `${JSON.stringify(results, null, 2)}\n`)
process.exitCode = results.some(r => r.error) ? 1 : 0
