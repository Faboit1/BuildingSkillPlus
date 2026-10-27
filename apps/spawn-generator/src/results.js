// The results under the preview: the numbers, the warnings, the setup sheet (setup.md rendered,
// with a copy button on every command block) and the downloads.

import { el } from './form.js'

const $ = id => document.getElementById(id)
const TYPE_NAMES = { normal: 'Spawn', plus: 'Spawn+', pvp: 'PvP lobby' }

export function showResults({ brief, stats, warnings, setupMd, themeLabel }) {
  $('res-empty').hidden = true
  $('res-body').hidden = false
  $('res-name').textContent = brief.name
  const [x, y, z] = stats.size
  $('res-meta').textContent = `${TYPE_NAMES[brief.type]} · ${themeLabel} · seed ${brief.seed} · paste corner ${brief.origin.join(' ')} in ${brief.world}`
  const c = stats.counts ?? {}
  const numbers = [
    ['Size', `${x} × ${z}`],
    ['Height', `${y}`],
    ['Blocks', stats.blockCount.toLocaleString('en-US')],
    ['NPCs', c.npc ?? 0],
    ['Boards', c.leaderboard ?? 0],
    ['Crates', c.crate ?? 0],
    ['Built in', `${stats.seconds.toFixed(1)} s`],
  ]
  $('res-numbers').replaceChildren(...numbers.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v))))
  const box = $('warnings')
  box.hidden = !warnings.length
  if (warnings.length) {
    box.replaceChildren(
      el('b', {}, warnings.length === 1 ? 'One note from the generator' : `${warnings.length} notes from the generator`),
      el('ul', {}, ...warnings.map(w => el('li', {}, w.replace(/^spawngen: /, '')))),
    )
  }
  $('setup').replaceChildren(...renderMarkdown(setupMd))
}

// ------------------------------------------------------------ setup.md → DOM (the subset it uses)
function inline(text) {
  const frag = document.createDocumentFragment()
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) frag.append(text.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('`')) frag.append(el('code', {}, t.slice(1, -1)))
    else if (t.startsWith('**')) frag.append(el('strong', {}, t.slice(2, -2)))
    else frag.append(el('em', {}, t.slice(1, -1)))
    last = m.index + t.length
  }
  if (last < text.length) frag.append(text.slice(last))
  return frag
}

export function renderMarkdown(md) {
  const out = []
  const lines = md.split('\n')
  let i = 0
  let para = []
  const flush = () => {
    if (para.length) out.push(el('p', {}, inline(para.join(' '))))
    para = []
  }
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      flush()
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++
      const text = code.join('\n')
      const copy = el('button', { type: 'button', class: 'ghost small copy' }, 'Copy')
      copy.addEventListener('click', () => copyText(text, copy))
      out.push(el('div', { class: 'code' }, el('pre', {}, el('code', {}, text)), copy))
      continue
    }
    const h = /^(#{1,3}) (.*)$/.exec(line)
    if (h) {
      flush()
      out.push(el(`h${h[1].length + 2}`, {}, inline(h[2])))
      i++
      continue
    }
    if (line.startsWith('|')) {
      flush()
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++])
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const head = cells(rows[0])
      const body = rows.slice(2).map(cells)
      out.push(el('div', { class: 'table-wrap' }, el('table', {},
        el('thead', {}, el('tr', {}, ...head.map(c => el('th', {}, inline(c))))),
        el('tbody', {}, ...body.map(r => el('tr', {}, ...r.map(c => el('td', {}, inline(c)))))),
      )))
      continue
    }
    if (line.startsWith('- ')) {
      flush()
      const items = []
      while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i++].slice(2))
      out.push(el('ul', {}, ...items.map(t => el('li', {}, inline(t)))))
      continue
    }
    if (!line.trim()) flush()
    else para.push(line.trim())
    i++
  }
  flush()
  return out
}

// ------------------------------------------------------------ clipboard and toast
let toastTimer = 0
export function toast(text) {
  const t = $('toast')
  t.textContent = text
  t.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { t.hidden = true }, 2600)
}

export async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text)
    if (button) {
      const label = button.textContent
      button.textContent = 'Copied'
      setTimeout(() => { button.textContent = label }, 1400)
    } else toast('Copied')
  } catch {
    toast('Copying is blocked here: select the text and copy it yourself')
  }
}

// ------------------------------------------------------------ downloads
// Inside claude.ai the page offers files through the downloads capability (the viewer confirms
// each one; .nbt/.schem/.litematic are not on its list, so those travel in the zip). Opened as a
// file, plain download links work and every file is offered on its own too.
export async function createSaver() {
  const framed = (() => {
    try {
      return window.top !== window
    } catch {
      return true
    }
  })()
  if (window.claude?.use) {
    let api = null
    try {
      api = await window.claude.use('downloads')
    } catch {
      api = null
    }
    if (api) {
      return {
        mode: 'claude',
        async save(filename, data) {
          try {
            await api.save({ filename, data: data instanceof Blob ? data : new Blob([data]) })
            toast(`Saved ${filename}`)
          } catch (err) {
            if (err?.code === 'declined') return
            if (err?.code === 'rate_limited') toast('Another save is waiting for you: answer it first')
            else toast(`Could not save ${filename} (${err?.code ?? err?.message ?? 'unavailable'})`)
          }
        },
      }
    }
    if (framed) return { mode: 'none', async save() { toast('Downloads are not available in this view') } }
  }
  return {
    mode: 'link',
    async save(filename, data) {
      const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]))
      const a = el('a', { href: url, download: filename })
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    },
  }
}
