#!/usr/bin/env node

// Builds the spawn generator app into one self-contained HTML file (no server, no network):
//
//   node apps/spawn-generator/build.mjs
//
// dist/spawn-generator.html            open it in any browser (double-click works)
// dist/spawn-generator.artifact.html   the same page without the document skeleton, for a
//                                      claude.ai Artifact (the platform adds doctype/head/body)
//
// Two bundles: the worker (the generator: spawngen, the spawn parts, the kit, Lodestone's core)
// and the page (the form, the Lodestone/three.js preview, downloads). The page carries the worker
// as a string and the data files as text (the texture atlas as base64) and hands the worker the
// data it reads. Node built-ins resolve to the small shims in src/shims.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'rolldown'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const src = path.join(here, 'src')
const dist = path.join(here, 'dist')
const lodestone = path.join(root, 'scripts/node_modules/lodestone')
const pack = path.join(lodestone, 'assets/default-pack')
const quiet = process.argv.includes('--quiet')
const minify = !process.argv.includes('--no-minify')
const log = (...a) => { if (!quiet) console.log(...a) }

// the data files the kit and the renderer read, keyed by their path inside the plugin
const DATA_FILES = [
  'scripts/lib/data/block-states.json',
  'scripts/lib/data/block-colors.json',
  'scripts/lib/data/materials.json',
  'scripts/node_modules/lodestone/assets/default-pack/assets.json',
  'scripts/node_modules/lodestone/assets/default-pack/block-flags/opaque.txt',
  'scripts/node_modules/lodestone/assets/default-pack/block-flags/transparent.txt',
  'scripts/node_modules/lodestone/assets/default-pack/block-flags/non_self_culling.txt',
  'scripts/node_modules/lodestone/assets/default-pack/block-flags/emissive.json',
]
const BRIEFS = path.join(here, 'briefs')

const SHIMS = {
  'node:fs': 'fs.js', fs: 'fs.js', 'node:fs/promises': 'fs.js',
  'node:path': 'path.js', path: 'path.js',
  'node:url': 'url.js', url: 'url.js',
  'node:zlib': 'zlib.js', zlib: 'zlib.js',
}

function appPlugin({ worker = false, workerCode = '' } = {}) {
  return {
    name: 'spawn-generator',
    async resolveId(source, importer) {
      if (SHIMS[source]) return path.join(src, 'shims', SHIMS[source])
      if (source.startsWith('virtual:')) return `\0${source}`
      // one copy of three / gl-matrix / pako: Lodestone's
      if (['three', 'gl-matrix', 'pako'].includes(source) && importer && !importer.startsWith(lodestone)) {
        return this.resolve(source, path.join(lodestone, 'lib/index.js'), { skipSelf: true })
      }
      // the worker gets Lodestone without its renderer
      if (worker && importer && /scripts[\\/]lib[\\/]lodestone\.mjs$/.test(path.resolve(path.dirname(importer), source))) {
        return path.join(src, 'shims', 'lodestone-core.js')
      }
      return null
    },
    load(id) {
      if (id === '\0virtual:data') {
        const text = {}
        for (const rel of DATA_FILES) text[`/${rel}`] = fs.readFileSync(path.join(root, rel), 'utf8')
        const atlas = fs.readFileSync(path.join(pack, 'atlas.png')).toString('base64')
        return `export const TEXT = ${JSON.stringify(text)}\nexport const ATLAS_PNG_BASE64 = ${JSON.stringify(atlas)}\n`
      }
      if (id === '\0virtual:briefs') {
        const briefs = {}
        for (const f of fs.readdirSync(BRIEFS).filter(f => f.endsWith('.json')).sort()) briefs[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(BRIEFS, f), 'utf8'))
        return `export default ${JSON.stringify(briefs)}\n`
      }
      if (id === '\0virtual:worker') return `export default ${JSON.stringify(workerCode)}\n`
      return null
    },
    // every module gets a file:///<path in the plugin> import.meta.url, so the generator's
    // new URL('../data/x.json', import.meta.url) lands on the keys of the data table
    transform(code, id) {
      if (!code.includes('import.meta.url') || id.startsWith('\0')) return null
      const rel = path.relative(root, id).split(path.sep).join('/')
      return { code: code.replaceAll('import.meta.url', JSON.stringify(`file:///${rel}`)), map: null }
    },
  }
}

async function bundle(input, { worker = false, workerCode, minify = true } = {}) {
  const out = await build({
    input,
    plugins: [appPlugin({ worker, workerCode })],
    platform: 'browser',
    logLevel: 'warn',
    write: false,
    output: { format: worker ? 'iife' : 'es', minify, codeSplitting: false, comments: false },
  })
  const chunk = (out.output ?? out).find(o => o.type === 'chunk')
  return chunk.code
}

// inline <script> text must not close the tag or open an HTML comment early
const scriptSafe = js => js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--')

const t0 = Date.now()
const workerCode = await bundle(path.join(src, 'worker.js'), { worker: true, minify })
log(`worker  ${(workerCode.length / 1024).toFixed(0)} KB`)
const appCode = await bundle(path.join(src, 'main.js'), { workerCode, minify })
if (process.argv.includes('--worker-file')) fs.writeFileSync(path.join(dist, 'worker.js'), workerCode)
log(`page    ${(appCode.length / 1024 / 1024).toFixed(2)} MB (with the worker and the data)`)

const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8')
const body = fs.readFileSync(path.join(src, 'page.html'), 'utf8')
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">'
const head = `<title>Minecraft Spawn Generator</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<meta name="description" content="Generate a Minecraft server spawn in the browser and download it as a schematic.">\n<style>\n${css}\n</style>\n${fonts}`
const script = `<script type="module">\n${scriptSafe(appCode)}\n</script>`

fs.mkdirSync(dist, { recursive: true })
const fragment = `${head}\n${body}\n${script}\n`
fs.writeFileSync(path.join(dist, 'spawn-generator.artifact.html'), fragment)
const reset = 'html{color-scheme:light}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}'
const standalone = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<style>${reset}</style>\n${head}\n</head>\n<body>\n${body}\n${script}\n</body>\n</html>\n`
fs.writeFileSync(path.join(dist, 'spawn-generator.html'), standalone)
log(`wrote   ${path.relative(process.cwd(), path.join(dist, 'spawn-generator.html'))} (${(standalone.length / 1024 / 1024).toFixed(2)} MB) in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
