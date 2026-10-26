// The spawn generator page: boots the worker (the generator) and the preview, wires the brief form,
// shows the results and offers the files. Built by apps/spawn-generator/build.mjs.

import { BlockState, Structure, loadDefaultPackResources } from '../../../scripts/node_modules/lodestone/lib/index.js'
import { TEXT, ATLAS_PNG_BASE64 } from 'virtual:data'
import BRIEFS from 'virtual:briefs'
import WORKER_CODE from 'virtual:worker'
import { BriefForm } from './form.js'
import { Preview } from './preview.js'
import { copyText, createSaver, showResults, toast } from './results.js'
import { el } from './form.js'

const $ = id => document.getElementById(id)
const PACK = '/scripts/node_modules/lodestone/assets/default-pack/'
const FIRST_BRIEF = 'cheese-smp'

const quietWarn = console.warn.bind(console)
console.warn = (...args) => {
  if (args.length === 1 && args[0] === 'parent minecraft:builtin/entity does not exist!') return
  quietWarn(...args)
}

// ------------------------------------------------------------ the worker
class Generator {
  constructor() {
    this.start()
  }

  start() {
    this.worker = new Worker(URL.createObjectURL(new Blob([WORKER_CODE], { type: 'text/javascript' })))
    this.pending = new Map()
    this.seq = 0
    this.worker.onmessage = e => {
      const m = e.data
      const job = this.pending.get(m.id)
      if (!job) return
      if (m.progress) return job.onProgress?.(m.progress)
      this.pending.delete(m.id)
      if (m.ok) job.resolve(m)
      else job.reject(Object.assign(new Error(m.error), { stack: m.stack }))
    }
    this.worker.onerror = e => {
      for (const job of this.pending.values()) job.reject(new Error(e.message || 'The generator stopped'))
      this.pending.clear()
    }
    this.ready = this.call('init', { files: TEXT })
  }

  call(type, data = {}, onProgress) {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress })
      this.worker.postMessage({ type, id, ...data })
    })
  }

  // a sync generation cannot be interrupted: stop the worker and start a fresh one
  restart() {
    this.worker.terminate()
    for (const job of this.pending.values()) job.reject(Object.assign(new Error('Cancelled'), { cancelled: true }))
    this.start()
  }
}

// ------------------------------------------------------------ the texture pack, from the page
function packResources() {
  const bytes = Uint8Array.from(atob(ATLAS_PNG_BASE64), c => c.charCodeAt(0))
  const base = 'https://pack.invalid/'
  const fetchShim = async url => {
    const rel = String(url).slice(base.length)
    if (rel === 'atlas.png') return new Response(new Blob([bytes], { type: 'image/png' }))
    const text = TEXT[PACK + rel]
    return text === undefined ? new Response('', { status: 404, statusText: rel }) : new Response(text)
  }
  return loadDefaultPackResources({ baseUrl: base, fetch: fetchShim })
}

// ------------------------------------------------------------ page
const overlay = {
  show(title, detail = '', { cancel = false, error = false } = {}) {
    $('overlay').hidden = false
    $('overlay').classList.toggle('error', error)
    $('overlay-title').textContent = title
    $('overlay-detail').textContent = detail
    $('cancel').hidden = !cancel
  },
  detail(text) {
    $('overlay-detail').textContent = text
  },
  hide() {
    $('overlay').hidden = true
  },
}

const STAGES = {
  generate: 'Shaping the ground, raising the buildings, planting trees',
  finish: 'Finishing block states and the setup sheet',
}

async function main() {
  const gen = new Generator()
  const [pack, options] = await Promise.all([packResources(), gen.ready.then(() => gen.call('options'))])
  const colors = JSON.parse(TEXT['/scripts/lib/data/block-colors.json'])
  const table = colors.blocks ?? colors
  const dyeColors = Object.fromEntries(['white', 'light_gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'light_blue', 'blue', 'purple', 'magenta', 'pink'].map(d => [d, table[`minecraft:${d}_concrete`]?.side]))
  // the downloads capability answers within 10 s (null when this view has none): don't wait for it
  let saver = { mode: 'pending', save: async () => toast('Downloads are still starting: try again in a moment') }
  createSaver().then(s => {
    saver = s
    $('shot').hidden = s.mode === 'none'
    if (current) renderDownloads()
  })

  // ---------------------------------------------------------- preview
  const viewButtons = [...document.querySelectorAll('[data-view]')]
  const preview = new Preview($('view'), pack.resources, {
    onModeChange(mode) {
      for (const b of viewButtons) b.setAttribute('aria-pressed', String(b.dataset.view === mode))
      $('viewport').classList.toggle('fly', mode === 'fly' || mode === 'spawn')
      $('fly-hint').hidden = !(mode === 'fly' || mode === 'spawn')
    },
  })
  for (const b of viewButtons) {
    b.addEventListener('click', () => {
      preview.setView(b.dataset.view)
      if (b.dataset.view === 'fly' || b.dataset.view === 'spawn') $('view').focus({ preventScroll: true })
    })
  }
  $('light-toggle').addEventListener('click', () => {
    const night = preview.lighting !== 'night'
    preview.setLighting(night ? 'night' : 'day')
    $('light-toggle').textContent = night ? 'Day' : 'Night'
    $('light-toggle').setAttribute('aria-pressed', String(night))
  })
  $('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await $('viewport').requestFullscreen()
    } catch {
      toast('Full screen is not available here')
    }
  })
  document.addEventListener('fullscreenchange', () => {
    $('fullscreen').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'
  })
  if (!document.fullscreenEnabled) $('fullscreen').hidden = true

  // ---------------------------------------------------------- form
  const presets = $('preset')
  let current = null // the last built spawn: { brief, ... }
  let exports = null // its files, once packed
  let resolveTimer = 0
  const form = new BriefForm({
    options,
    dyeColors,
    onChange(brief) {
      presets.value = ''
      clearTimeout(resolveTimer)
      resolveTimer = setTimeout(async () => {
        try {
          const r = await gen.call('resolve', { brief })
          form.setRecommended(r.brief)
        } catch {
          // a half-typed brief: keep the last recommendation
        }
      }, 250)
    },
  })

  async function applyBrief(raw) {
    const r = await gen.call('resolve', { brief: raw })
    form.set(form.fromBrief(r.brief, raw))
    form.setRecommended(r.brief)
  }

  presets.append(el('option', { value: '' }, 'Your own brief'))
  for (const [key, b] of Object.entries(BRIEFS)) {
    const kind = b.type === 'plus' ? 'spawn+' : b.type === 'pvp' ? 'PvP lobby' : 'spawn'
    presets.append(el('option', { value: key }, `${b.name} (${b.theme ?? 'medieval'} ${kind})`))
  }
  presets.addEventListener('change', async () => {
    const b = BRIEFS[presets.value]
    if (!b) return
    await applyBrief(structuredClone(b))
    generate()
  })

  $('json-apply').addEventListener('click', async () => {
    let raw
    try {
      raw = JSON.parse($('f-json').value)
    } catch (err) {
      $('json-hint').textContent = `That is not valid JSON: ${err.message}`
      return
    }
    try {
      await applyBrief(raw)
      $('json-hint').textContent = 'Brief loaded into the form. Generate to build it.'
      presets.value = ''
    } catch (err) {
      $('json-hint').textContent = `The generator could not read it: ${err.message}`
    }
  })
  $('json-copy').addEventListener('click', e => copyText($('f-json').value, e.currentTarget))

  // ---------------------------------------------------------- generate
  let running = false
  async function generate({ surprise = false } = {}) {
    if (running) return
    running = true
    $('generate').disabled = true
    $('surprise').disabled = true
    const raw = form.toBrief()
    if (surprise) {
      // keep only the name: the generator picks everything else from a fresh seed
      for (const k of Object.keys(raw)) if (k !== 'name') delete raw[k]
      raw.surprise = true
      raw.seed = Math.floor(Math.random() * 1e6)
    }
    const t0 = performance.now()
    overlay.show(`Building ${raw.name}`, STAGES.generate, { cancel: true })
    let stage = STAGES.generate
    const clock = setInterval(() => overlay.detail(`${stage} · ${Math.round((performance.now() - t0) / 1000)} s`), 500)
    try {
      const r = await gen.call('generate', { brief: raw }, p => { stage = STAGES[p] ?? stage })
      clearInterval(clock)
      exports = null
      current = r
      if (surprise) {
        form.set(form.fromBrief(r.brief, { ...r.brief, size: null, origin: null }))
        form.setRecommended(r.brief)
      }
      const { size, palette, pos, state } = r.preview
      overlay.show('Meshing the 3D view', `${r.stats.blockCount.toLocaleString('en-US')} blocks`)
      await new Promise(requestAnimationFrame)
      const blocks = new Array(state.length)
      for (let i = 0; i < state.length; i++) blocks[i] = { pos: [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], state: state[i] }
      const structure = new Structure(size, palette.map(p => new BlockState(p.name, p.props)), blocks)
      const theme = options.themes.find(t => t.key === r.brief.theme)
      $('hud').hidden = false
      $('hud-name').textContent = r.brief.name
      $('hud-stats').textContent = `${size[0]} × ${size[2]} · ${r.stats.blockCount.toLocaleString('en-US')} blocks`
      showResults({ brief: r.brief, stats: r.stats, warnings: r.warnings, setupMd: r.setupMd, themeLabel: theme?.label ?? r.brief.theme })
      renderDownloads()
      const shown = preview.show(structure, { spawn: r.spawn, floorY: r.stats.floorY })
      overlay.hide()
      await shown
    } catch (err) {
      clearInterval(clock)
      if (err.cancelled) overlay.show('Cancelled', 'Change the brief and generate again.')
      else {
        console.error(err)
        overlay.show('This brief did not build', `${err.message}. Try another seed, fewer landmarks or a bigger size.`, { error: true })
      }
    } finally {
      running = false
      $('generate').disabled = false
      $('surprise').disabled = false
    }
  }
  $('cancel').addEventListener('click', () => {
    gen.restart()
    gen.ready.catch(() => {})
  })
  $('brief').addEventListener('submit', e => {
    e.preventDefault()
    generate()
  })
  $('surprise').addEventListener('click', () => {
    presets.value = ''
    generate({ surprise: true })
  })

  // ---------------------------------------------------------- downloads
  async function files(formats) {
    if (exports && formats.every(f => exports[f])) return exports
    const r = await gen.call('export', { formats }, p => toast(`Writing the .${p === 'zip' ? 'zip' : p}…`))
    exports = { ...(exports ?? {}), ...r }
    return exports
  }
  async function offer(button, filename, get) {
    const label = button.textContent
    button.disabled = true
    button.textContent = 'Packing…'
    try {
      const data = await get()
      await saver.save(filename, data)
    } catch (err) {
      toast(`Could not make ${filename}: ${err.message}`)
    } finally {
      button.disabled = false
      button.textContent = label
    }
  }
  function renderDownloads() {
    const slug = current.brief.slug
    const zipBtn = $('dl-zip')
    zipBtn.hidden = saver.mode === 'none'
    zipBtn.disabled = saver.mode === 'pending'
    zipBtn.onclick = () => offer(zipBtn, `${slug}.zip`, async () => new Blob([(await files(['zip'])).zip], { type: 'application/zip' }))
    const list = []
    const file = (label, filename, get) => {
      const b = el('button', { type: 'button', class: 'ghost small' }, label)
      b.addEventListener('click', () => offer(b, filename, get))
      list.push(b)
    }
    if (saver.mode === 'link') {
      file('.schem', `${slug}.schem`, async () => (await files(['schem'])).schem)
      file('.litematic', `${slug}.litematic`, async () => (await files(['litematic'])).litematic)
      file('.nbt', `${slug}.nbt`, async () => (await files(['nbt'])).nbt)
    }
    if (saver.mode !== 'none') {
      file('setup.md', `${slug}.setup.md`, async () => current.setupMd)
      file('placements.json', `${slug}.placements.json`, async () => current.placementsJson)
      file('brief.json', `${slug}.brief.json`, async () => `${JSON.stringify((({ slug: _s, ...b }) => b)(current.brief), null, 2)}\n`)
    }
    const copyBrief = el('button', { type: 'button', class: 'ghost small' }, 'Copy brief for Claude')
    copyBrief.addEventListener('click', () => copyText(JSON.stringify((({ slug: _s, ...b }) => b)(current.brief), null, 2), copyBrief))
    list.push(copyBrief)
    $('dl-files').replaceChildren(...list)
    $('dl-note').textContent = saver.mode === 'claude'
      ? 'The zip holds the .schem (WorldEdit), .litematic (Litematica), .nbt (structure block), the setup sheet and the brief. Each save asks you first.'
      : saver.mode === 'link'
        ? 'The zip holds all of them with a README. .schem is for WorldEdit and FAWE, .litematic for Litematica, .nbt for a structure block.'
        : 'Downloads are not available in this view. Open the page from its claude.ai link, or use the copy buttons.'
  }

  $('shot').addEventListener('click', async () => {
    const blob = await preview.screenshot()
    if (!blob) return toast('Generate a spawn first')
    await saver.save(`${current?.brief.slug ?? 'spawn'}-${preview.mode}.png`, blob)
  })

  // ---------------------------------------------------------- first spawn
  await applyBrief(structuredClone(BRIEFS[FIRST_BRIEF] ?? { name: 'My SMP', type: 'normal' }))
  presets.value = BRIEFS[FIRST_BRIEF] ? FIRST_BRIEF : ''
  window.__spawnGenerator = { generate, form, preview, gen, get current() { return current } }
  await generate()
}

main().catch(err => {
  console.error(err)
  overlay.show('The generator could not start', err?.message ?? String(err), { error: true })
})
