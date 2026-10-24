#!/usr/bin/env node

// Headless renderer: opens the Lodestone viewer in Chromium (via Playwright) and saves PNG
// screenshots of a .nbt build from several camera angles plus a labelled contact sheet.
// Agents use this to *see* their build and critique it between iterations.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { startViewerServer } from './lib/viewer-server.mjs'

const DEFAULT_VIEWS = ['se', 'nw', 'south', 'top']
const KNOWN_VIEWS = ['se', 'sw', 'ne', 'nw', 'south', 'north', 'east', 'west', 'top', 'hero', 'low']

function usage() {
  return `Usage:
  node scripts/render.mjs --nbt <build.nbt> [options]

Options:
  --out <dir>             Output directory (default: <nbt dir>/renders)
  --views <list>          Comma list of presets (default: ${DEFAULT_VIEWS.join(',')})
                          Presets: ${KNOWN_VIEWS.join(', ')}
  --yaw <deg> --pitch <deg> [--zoom <n>] [--target x,y,z] [--fov <deg>] [--distance <n>]
                          Add a custom camera view named "custom" (or --view-name <name>).
                          yaw: 0=from south, 90=from east, 180=from north, 270=from west.
  --zoom <n>              Zoom factor applied to every view (default 1 = fit whole build)
  --lighting day|night|both   (default: day)
  --clip-y <y>            Hide blocks above y (cutaway to inspect interiors)
  --clip x0,y0,z0,x1,y1,z1    Only render blocks inside this inclusive box
  --width <px> --height <px>  Size of each view (default 960x720)
  --no-sheet              Skip the combined contact sheet
  --json                  Print a JSON summary
`
}

function parseArgs(argv) {
  const options = {
    nbt: undefined,
    out: undefined,
    views: undefined,
    custom: {},
    zoom: undefined,
    lighting: 'day',
    clipY: undefined,
    clip: undefined,
    width: 960,
    height: 720,
    sheet: true,
    json: false,
    help: false,
    timeout: 300000,
  }
  const readValue = (arg, index) => {
    const value = argv[index + 1]
    if (value === undefined || (value.startsWith('--'))) throw new Error(`${arg} requires a value`)
    return value
  }
  const numberFlags = {
    '--yaw': v => { options.custom.yaw = Number(v) },
    '--pitch': v => { options.custom.pitch = Number(v) },
    '--fov': v => { options.custom.fov = Number(v) },
    '--distance': v => { options.custom.distance = Number(v) },
    '--zoom': v => { options.zoom = Number(v) },
    '--width': v => { options.width = Number(v) },
    '--height': v => { options.height = Number(v) },
    '--clip-y': v => { options.clipY = Number(v) },
    '--timeout': v => { options.timeout = Number(v) },
  }
  const stringFlags = {
    '--nbt': v => { options.nbt = v },
    '--out': v => { options.out = v },
    '--views': v => { options.views = v.split(',').map(s => s.trim()).filter(Boolean) },
    '--lighting': v => { options.lighting = v },
    '--target': v => { options.custom.target = v.split(',').map(Number) },
    '--clip': v => { options.clip = v.split(',').map(Number) },
    '--view-name': v => { options.custom.name = v },
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const [flag, inline] = arg.includes('=') && arg.startsWith('--') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined]
    if (flag === '-h' || flag === '--help') options.help = true
    else if (flag === '--json') options.json = true
    else if (flag === '--no-sheet') options.sheet = false
    else if (numberFlags[flag] || stringFlags[flag]) {
      const value = inline ?? readValue(flag, index)
      if (inline === undefined) index += 1
      ;(numberFlags[flag] ?? stringFlags[flag])(value)
    } else if (!options.nbt && !flag.startsWith('-')) options.nbt = flag
    else throw new Error(`Unexpected argument: ${arg}`)
  }
  for (const [key, value] of Object.entries({ ...options.custom, zoom: options.zoom, width: options.width, height: options.height })) {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`--${key} must be a number`)
  }
  if (options.custom.target && (options.custom.target.length !== 3 || !options.custom.target.every(Number.isFinite))) {
    throw new Error('--target must be x,y,z')
  }
  if (options.clip && (options.clip.length !== 6 || !options.clip.every(Number.isFinite))) {
    throw new Error('--clip must be x0,y0,z0,x1,y1,z1')
  }
  if (!['day', 'night', 'both'].includes(options.lighting)) throw new Error('--lighting must be day, night, or both')
  return options
}

async function loadPlaywright() {
  const attempts = ['playwright', 'playwright-core']
  for (const name of attempts) {
    try {
      return await import(name)
    } catch {
      // try the next resolution strategy
    }
  }
  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
    const require = createRequire(pathToFileURL(path.join(globalRoot, 'noop.js')))
    for (const name of attempts) {
      try {
        return require(name)
      } catch {
        // keep looking
      }
    }
  } catch {
    // npm unavailable
  }
  throw new Error('Playwright is not installed. Install it next to the skill (npm install --no-save playwright) or globally, then run `npx playwright install chromium` if no Chromium is available.')
}

function buildViewList(options) {
  const views = (options.views ?? (Object.keys(options.custom).some(k => k !== 'name') ? [] : DEFAULT_VIEWS)).map(name => {
    if (!KNOWN_VIEWS.includes(name)) throw new Error(`Unknown view preset "${name}". Known: ${KNOWN_VIEWS.join(', ')}`)
    return { name, spec: name }
  })
  const { name: customName, ...custom } = options.custom
  if (Object.keys(custom).length > 0) {
    views.push({ name: customName ?? 'custom', spec: { yaw: 30, pitch: 25, fov: 45, ...custom } })
  }
  if (options.zoom !== undefined) {
    for (const view of views) view.zoom = options.zoom
  }
  return views
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  if (!options.nbt) throw new Error(`Missing --nbt path.\n${usage()}`)

  const nbtPath = path.resolve(options.nbt)
  const outDir = path.resolve(options.out ?? path.join(path.dirname(nbtPath), 'renders'))
  await fs.mkdir(outDir, { recursive: true })
  const views = buildViewList(options)
  const lightings = options.lighting === 'both' ? ['day', 'night'] : [options.lighting]

  const { chromium } = await loadPlaywright()
  const { server, url } = await startViewerServer({ nbtPath, port: 0, logLevel: 'silent' })
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  const written = []
  try {
    const page = await browser.newPage({ viewport: { width: options.width, height: options.height } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    url.searchParams.set('capture', '1')
    if (options.clip) {
      // --clip-y together with --clip lowers the box top
      const box = [...options.clip]
      if (options.clipY !== undefined) box[4] = Math.min(box[4], Number(options.clipY))
      url.searchParams.set('clip', box.join(','))
    } else if (options.clipY !== undefined) {
      url.searchParams.set('clipY', String(options.clipY))
    }
    await page.goto(url.toString(), { waitUntil: 'load' })
    await page.waitForFunction(
      () => Boolean(window.__mcbViewer || window.__mcbViewerError),
      null,
      { timeout: options.timeout, polling: 250 },
    )
    const viewerError = await page.evaluate(() => window.__mcbViewerError)
    if (viewerError) throw new Error(`Viewer failed: ${viewerError}`)
    const info = await page.evaluate(() => ({
      size: window.__mcbViewer.size,
      bounds: window.__mcbViewer.bounds,
      blockCount: window.__mcbViewer.blockCount,
    }))

    for (const lighting of lightings) {
      await page.evaluate(mode => window.__mcbViewer.setLighting(mode), lighting)
      const shots = []
      for (const view of views) {
        const spec = typeof view.spec === 'string' ? view.spec : view.spec
        const dataUrl = await page.evaluate(
          ({ spec, zoom, width, height }) => {
            const viewer = window.__mcbViewer
            const resolved = typeof spec === 'string' ? { ...viewer.presets[spec] } : { ...spec }
            if (zoom !== undefined) resolved.zoom = zoom
            return viewer.renderView(resolved, width, height)
          },
          { spec, zoom: view.zoom, width: options.width, height: options.height },
        )
        const suffix = lightings.length > 1 || lighting === 'night' ? `-${lighting}` : ''
        const filePath = path.join(outDir, `${view.name}${suffix}.png`)
        await fs.writeFile(filePath, Buffer.from(dataUrl.split(',')[1], 'base64'))
        written.push(filePath)
        shots.push({ label: `${view.name}${suffix}`, dataUrl })
      }
      if (options.sheet && shots.length > 1) {
        const sheetUrl = await page.evaluate(async ({ shots, width, height, title }) => {
          const columns = shots.length <= 4 ? 2 : 3
          const rows = Math.ceil(shots.length / columns)
          const scale = Math.min(1, 1800 / (columns * width))
          const cellW = Math.round(width * scale)
          const cellH = Math.round(height * scale)
          const header = 34
          const sheet = document.createElement('canvas')
          sheet.width = cellW * columns
          sheet.height = cellH * rows + header
          const ctx = sheet.getContext('2d')
          ctx.fillStyle = '#10161c'
          ctx.fillRect(0, 0, sheet.width, sheet.height)
          ctx.fillStyle = '#e8f0f4'
          ctx.font = '600 18px sans-serif'
          ctx.fillText(title, 12, 23)
          for (let i = 0; i < shots.length; i += 1) {
            const image = new Image()
            image.src = shots[i].dataUrl
            await image.decode()
            const x = (i % columns) * cellW
            const y = header + Math.floor(i / columns) * cellH
            ctx.drawImage(image, x, y, cellW, cellH)
            ctx.fillStyle = 'rgba(10,14,18,0.72)'
            ctx.fillRect(x + 8, y + 8, ctx.measureText(shots[i].label).width + 20, 28)
            ctx.fillStyle = '#ffffff'
            ctx.fillText(shots[i].label, x + 18, y + 28)
            ctx.strokeStyle = '#10161c'
            ctx.lineWidth = 2
            ctx.strokeRect(x, y, cellW, cellH)
          }
          return sheet.toDataURL('image/png')
        }, {
          shots,
          width: options.width,
          height: options.height,
          title: `${path.basename(nbtPath)} — ${info.size.join('x')} — ${info.blockCount.toLocaleString()} blocks — ${lighting}`,
        })
        const sheetPath = path.join(outDir, lightings.length > 1 || lighting === 'night' ? `sheet-${lighting}.png` : 'sheet.png')
        await fs.writeFile(sheetPath, Buffer.from(sheetUrl.split(',')[1], 'base64'))
        written.unshift(sheetPath)
      }
    }
    if (errors.length > 0) console.error(`render: page errors:\n${errors.join('\n')}`)

    const summary = { nbtPath, outDir, ...info, views: views.map(v => v.name), lighting: lightings, files: written }
    if (options.json) console.log(JSON.stringify(summary, null, 2))
    else {
      console.log(`Rendered ${path.basename(nbtPath)} (${info.blockCount.toLocaleString()} blocks, bounds ${info.bounds.min.join(',')} -> ${info.bounds.max.join(',')})`)
      for (const file of written) console.log(`  ${file}`)
    }
  } finally {
    await browser.close()
    await server.close()
  }
}

main().catch(err => {
  console.error(`render: ${err.message}`)
  process.exitCode = 1
})
