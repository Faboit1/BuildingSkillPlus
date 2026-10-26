// The brief form: one state object, rendered into the static markup of page.html, turned into a
// brief (the same JSON make_spawn and scripts/make-spawn.mjs take) and back.

const $ = id => document.getElementById(id)

export const TYPE_INFO = {
  normal: { label: 'Normal', hint: 'A big flat plaza: NPCs on plinths in rings round the spawn, hologram leaderboards, open-air crates, a PvP ruin, the RTP gate and a ring of buildings. Right for most SMPs.' },
  plus: { label: 'Spawn+', hint: 'A town round a square hub: every NPC gets its own building, with halls, gardens, stalls, an arena and an AFK park. DonutSMP style.' },
  pvp: { label: 'PvP lobby', hint: 'Queue NPCs in an arc facing the spawn dais, leaderboards behind, an FFA arena, crates and a store pavilion.' },
}
const LANDMARK_LABELS = { volcano: 'Volcano', lighthouse: 'Lighthouse', ship: 'Pirate ship', statue: 'Statue', 'giant-tree': 'Giant tree', 'giant-palm': 'Giant palm', 'rock-spires': 'Rock spires', 'rock-arch': 'Rock arch' }
const SETTINGS = { island: 'Floating island', plains: 'Flat plains', valley: 'Valley with hills round it', mountain: 'Rocky ridge behind', coast: 'Lake cove with beaches' }
const DYES = ['white', 'light_gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'light_blue', 'blue', 'purple', 'magenta', 'pink']
const ROCKS = [[0, 'None'], [4, 'Few'], [8, 'Some'], [16, 'Many']]
const words = s => s.replace(/_/g, ' ')

export class BriefForm {
  constructor({ options, dyeColors, onChange }) {
    this.o = options
    this.dyeColors = dyeColors
    this.onChange = onChange
    this.s = null
    this.recommended = null
    this.build()
  }

  // ------------------------------------------------------------ state ⇄ brief
  defaults(type, keep = {}) {
    const T = this.o.types[type]
    return {
      name: keep.name ?? 'My SMP',
      type,
      theme: keep.theme ?? (type === 'pvp' ? 'japanese' : 'medieval'),
      setting: keep.setting ?? '',
      accent: keep.accent ?? '',
      npcs: [...T.defaultNpcs],
      custom: [],
      boards: [...T.boards],
      crates: T.crates,
      top3: 0,
      features: { rtp: !!T.features.rtp, pvp: !!T.features.pvp, afk: !!T.features.afk, signs: false },
      landmarks: keep.landmarks ?? [],
      bigTrees: keep.bigTrees ?? 0,
      terraces: keep.terraces ?? 0,
      rocks: keep.rocks ?? 0,
      warzone: { on: false, width: 64, moshpit: true, koth: true },
      sizeAuto: true,
      size: T.size,
      seed: keep.seed ?? 7,
      world: keep.world ?? 'world',
      originAuto: true,
      origin: [0, 64, 0],
    }
  }

  // a normalized brief (from the worker's resolve) → form state; raw is what the user gave
  fromBrief(full, raw = full) {
    const T = this.o.types[full.type]
    const known = new Set(T.npcIds)
    const s = this.defaults(full.type)
    s.name = full.name
    s.theme = full.theme
    s.setting = full.setting ?? ''
    s.accent = full.accent ?? ''
    s.npcs = full.npcs.filter(n => known.has(n.id) && n.label === (this.o.npcLabels[n.id] ?? n.label)).map(n => n.id)
    s.custom = full.npcs.filter(n => !s.npcs.includes(n.id)).map(n => n.label)
    s.boards = full.leaderboards.map(b => b.label)
    s.crates = full.crates.length
    s.top3 = full.top3.length
    s.features = { rtp: !!full.features.rtp, pvp: !!full.features.pvp, afk: !!full.features.afk, signs: !!full.features.signs }
    s.landmarks = [...full.landmarks]
    s.bigTrees = full.bigTrees
    s.terraces = full.terraces
    s.rocks = full.rocks
    s.warzone = full.warzone ? { on: true, width: full.warzone.width, moshpit: !!full.warzone.moshpit, koth: !!full.warzone.koth } : { ...s.warzone }
    s.sizeAuto = raw.size == null
    s.size = full.size
    s.seed = full.seed
    s.world = full.world
    s.originAuto = raw.origin == null
    s.origin = [...full.origin]
    return s
  }

  toBrief(s = this.s) {
    const b = { name: s.name.trim() || 'My SMP', type: s.type, theme: s.theme }
    if (s.setting) b.setting = s.setting
    if (s.accent) b.accent = s.accent
    b.npcs = [...s.npcs, ...s.custom]
    b.leaderboards = s.boards
    b.crates = s.crates
    if (s.top3) b.top3 = s.top3
    b.features = { ...s.features }
    if (s.landmarks.length) b.landmarks = [...s.landmarks]
    if (s.bigTrees) b.bigTrees = s.bigTrees
    if (s.terraces) b.terraces = s.terraces
    if (s.rocks) b.rocks = s.rocks
    if (s.warzone.on) b.warzone = { width: s.warzone.width, moshpit: s.warzone.moshpit, koth: s.warzone.koth }
    if (!s.sizeAuto) b.size = s.size
    b.seed = s.seed
    if (s.world && s.world !== 'world') b.world = s.world
    if (!s.originAuto) b.origin = [...s.origin]
    return b
  }

  set(state) {
    this.s = state
    this.render()
  }

  change(fn, { rerender = true } = {}) {
    fn(this.s)
    if (rerender) this.render()
    else this.syncJson()
    this.onChange(this.toBrief())
  }

  // ------------------------------------------------------------ static wiring
  build() {
    // type
    const type = $('f-type')
    for (const [key, info] of Object.entries(TYPE_INFO)) {
      const btn = el('button', { type: 'button', role: 'radio', 'data-type': key }, info.label)
      btn.addEventListener('click', () => {
        if (this.s.type === key) return
        const old = this.s
        const next = this.defaults(key, { name: old.name, theme: key === 'pvp' && old.type !== 'pvp' ? 'japanese' : old.theme, setting: old.setting, accent: old.accent, landmarks: old.landmarks, bigTrees: old.bigTrees, terraces: old.terraces, rocks: old.rocks, seed: old.seed, world: old.world })
        next.originAuto = old.originAuto
        next.origin = old.origin
        this.s = next
        this.render()
        this.onChange(this.toBrief())
      })
      type.append(btn)
    }
    // themes
    const themes = $('f-theme')
    for (const t of this.o.themes) {
      const strip = el('span', { class: 'strip', 'aria-hidden': 'true' }, ...t.swatch.filter(Boolean).map(c => el('i', { style: `background:${c}` })))
      const btn = el('button', { type: 'button', role: 'radio', class: 'theme', 'data-theme-key': t.key }, strip, el('b', {}, t.label), el('small', {}, `${words(t.trees ?? '')} trees · ${t.setting}`))
      btn.addEventListener('click', () => this.change(s => { s.theme = t.key }))
      themes.append(btn)
    }
    // setting
    const setting = $('f-setting')
    setting.addEventListener('change', () => this.change(s => { s.setting = setting.value }))
    // accent
    const accent = $('f-accent')
    const auto = el('button', { type: 'button', role: 'radio', class: 'swatch auto', 'data-accent': '' }, 'Theme')
    auto.addEventListener('click', () => this.change(s => { s.accent = '' }))
    accent.append(auto)
    for (const d of DYES) {
      const btn = el('button', { type: 'button', role: 'radio', class: 'swatch', 'data-accent': d, title: words(d), 'aria-label': words(d), style: `background:${this.dyeColors[d] ?? '#888'}` })
      btn.addEventListener('click', () => this.change(s => { s.accent = d }))
      accent.append(btn)
    }
    // name
    $('f-name').addEventListener('input', e => this.change(s => { s.name = e.target.value }, { rerender: false }))
    // custom NPCs
    const addNpc = () => {
      const input = $('f-npc-add')
      const label = input.value.trim()
      if (!label) return
      input.value = ''
      this.change(s => { if (!s.custom.includes(label)) s.custom.push(label) })
    }
    $('npc-add').addEventListener('click', addNpc)
    $('f-npc-add').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        addNpc()
      }
    })
    // leaderboards
    $('f-boards').addEventListener('input', e => this.change(s => { s.boards = e.target.value.split(',').map(x => x.trim()).filter(Boolean) }, { rerender: false }))
    // steppers
    stepper($('f-crates'), () => this.s.crates, v => this.change(s => { s.crates = v }))
    stepper($('f-top3'), () => this.s.top3, v => this.change(s => { s.top3 = v }))
    stepper($('f-trees'), () => this.s.bigTrees, v => this.change(s => { s.bigTrees = v }))
    stepper($('f-terraces'), () => this.s.terraces, v => this.change(s => { s.terraces = v }))
    // features
    for (const box of document.querySelectorAll('#f-features input')) {
      box.addEventListener('change', () => this.change(s => { s.features[box.dataset.feature] = box.checked }))
    }
    // landmarks
    const lm = $('f-landmarks')
    for (const k of this.o.landmarks) {
      const btn = el('button', { type: 'button', class: 'chip', 'data-landmark': k }, LANDMARK_LABELS[k] ?? k)
      btn.addEventListener('click', () => this.change(s => {
        s.landmarks = s.landmarks.includes(k) ? s.landmarks.filter(x => x !== k) : [...s.landmarks, k]
      }))
      lm.append(btn)
    }
    // rocks
    const rocks = $('f-rocks')
    for (const [n, label] of ROCKS) {
      const btn = el('button', { type: 'button', role: 'radio', 'data-rocks': String(n) }, label)
      btn.addEventListener('click', () => this.change(s => { s.rocks = n }))
      rocks.append(btn)
    }
    // warzone
    $('f-warzone').addEventListener('change', e => this.change(s => { s.warzone.on = e.target.checked }))
    $('f-wz-width').addEventListener('input', e => this.change(s => { s.warzone.width = Number(e.target.value) }, { rerender: false }))
    $('f-wz-width').addEventListener('change', () => this.render())
    $('f-moshpit').addEventListener('change', e => this.change(s => { s.warzone.moshpit = e.target.checked }))
    $('f-koth').addEventListener('change', e => this.change(s => { s.warzone.koth = e.target.checked }))
    // size and seed
    $('f-size-auto').addEventListener('change', e => this.change(s => {
      s.sizeAuto = e.target.checked
      if (!s.sizeAuto && this.recommended) s.size = this.recommended.size
    }))
    $('f-size').addEventListener('input', e => {
      this.s.size = Number(e.target.value)
      $('size-out').textContent = `${this.s.size} × ${this.s.size}`
      this.syncJson()
      this.onChange(this.toBrief())
    })
    $('f-seed').addEventListener('input', e => {
      const v = Math.max(0, Math.min(999999, Math.round(Number(e.target.value) || 0)))
      this.change(s => { s.seed = v }, { rerender: false })
    })
    $('new-seed').addEventListener('click', () => this.change(s => { s.seed = Math.floor(Math.random() * 100000) }))
    // placement
    $('f-world').addEventListener('input', e => this.change(s => { s.world = e.target.value.trim() || 'world' }, { rerender: false }))
    $('f-origin-auto').addEventListener('change', e => this.change(s => {
      s.originAuto = e.target.checked
      if (!s.originAuto && this.recommended) s.origin = [...this.recommended.origin]
    }))
    for (const [i, id] of ['f-ox', 'f-oy', 'f-oz'].entries()) {
      $(id).addEventListener('input', e => this.change(s => { s.origin[i] = Math.round(Number(e.target.value) || 0) }, { rerender: false }))
    }
  }

  // ------------------------------------------------------------ render the state
  render() {
    const s = this.s
    const T = this.o.types[s.type]
    if (document.activeElement !== $('f-name')) $('f-name').value = s.name
    for (const b of document.querySelectorAll('#f-type button')) b.setAttribute('aria-checked', String(b.dataset.type === s.type))
    $('type-hint').textContent = TYPE_INFO[s.type].hint
    for (const b of document.querySelectorAll('#f-theme .theme')) b.setAttribute('aria-checked', String(b.dataset.themeKey === s.theme))
    const theme = this.o.themes.find(t => t.key === s.theme)
    const setting = $('f-setting')
    setting.replaceChildren(
      el('option', { value: '' }, `Theme's choice (${SETTINGS[s.type === 'normal' ? 'plains' : theme?.setting] ?? theme?.setting})`),
      ...Object.entries(SETTINGS).map(([k, label]) => el('option', { value: k }, label)),
    )
    setting.value = s.setting
    for (const b of document.querySelectorAll('#f-accent .swatch')) b.setAttribute('aria-checked', String(b.dataset.accent === s.accent))
    const autoAccent = document.querySelector('#f-accent .swatch.auto')
    autoAccent.title = `The theme's colour: ${words(theme?.accent ?? '')}`

    // NPCs: the type's known ones as toggles, then the custom ones (click to remove)
    const npcBox = $('f-npcs')
    npcBox.replaceChildren(
      ...T.npcIds.map(id => {
        const on = s.npcs.includes(id)
        const chip = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(on) }, this.o.npcLabels[id] ?? id)
        chip.addEventListener('click', () => this.change(st => {
          st.npcs = on ? st.npcs.filter(x => x !== id) : T.npcIds.filter(x => x === id || st.npcs.includes(x))
        }))
        return chip
      }),
      ...s.custom.map(label => {
        const chip = el('button', { type: 'button', class: 'chip', 'aria-pressed': 'true', title: 'Remove' }, label, el('span', { class: 'x', 'aria-hidden': 'true' }, '×'))
        chip.setAttribute('aria-label', `Remove ${label}`)
        chip.addEventListener('click', () => this.change(st => { st.custom = st.custom.filter(x => x !== label) }))
        return chip
      }),
    )
    const n = s.npcs.length + s.custom.length
    $('npc-count').textContent = `${n} NPC${n === 1 ? '' : 's'}`
    if (document.activeElement !== $('f-boards')) $('f-boards').value = s.boards.join(', ')
    setStepper($('f-crates'), s.crates)
    setStepper($('f-top3'), s.top3)
    setStepper($('f-trees'), s.bigTrees)
    setStepper($('f-terraces'), s.terraces)
    for (const box of document.querySelectorAll('#f-features input')) box.checked = !!s.features[box.dataset.feature]
    for (const b of document.querySelectorAll('#f-landmarks .chip')) b.setAttribute('aria-pressed', String(s.landmarks.includes(b.dataset.landmark)))
    const rockKey = ROCKS.reduce((best, [v]) => (Math.abs(v - s.rocks) < Math.abs(best - s.rocks) ? v : best), 0)
    for (const b of document.querySelectorAll('#f-rocks button')) b.setAttribute('aria-checked', String(Number(b.dataset.rocks) === rockKey))
    $('f-warzone').checked = s.warzone.on
    $('warzone-opts').setAttribute('aria-disabled', String(!s.warzone.on))
    $('f-wz-width').value = s.warzone.width
    $('wz-width-out').textContent = `${s.warzone.width} blocks`
    $('f-moshpit').checked = s.warzone.moshpit
    $('f-koth').checked = s.warzone.koth
    $('f-size-auto').checked = s.sizeAuto
    const size = $('f-size')
    size.min = T.min
    size.max = T.max
    size.value = s.sizeAuto && this.recommended ? this.recommended.size : s.size
    $('size-row').setAttribute('aria-disabled', String(s.sizeAuto))
    $('size-out').textContent = `${size.value} × ${size.value}`
    if (document.activeElement !== $('f-seed')) $('f-seed').value = s.seed
    if (document.activeElement !== $('f-world')) $('f-world').value = s.world
    $('f-origin-auto').checked = s.originAuto
    $('origin-row').setAttribute('aria-disabled', String(s.originAuto))
    const origin = s.originAuto && this.recommended ? this.recommended.origin : s.origin
    ;['f-ox', 'f-oy', 'f-oz'].forEach((id, i) => {
      if (document.activeElement !== $(id)) $(id).value = origin[i]
    })
    this.syncJson()
  }

  // the size and paste corner the generator will use (from the worker's resolve)
  setRecommended(full) {
    this.recommended = { size: full.size, origin: full.origin, canvas: full.size + 2 * (full.warzone?.width ?? 0) }
    const r = this.recommended
    $('size-auto-label').textContent = `Pick the size for me (${r.size} × ${r.size}${r.canvas !== r.size ? `, ${r.canvas} with the warzone` : ''})`
    if (this.s.sizeAuto) {
      $('f-size').value = r.size
      $('size-out').textContent = `${r.size} × ${r.size}`
    }
    if (this.s.originAuto) ['f-ox', 'f-oy', 'f-oz'].forEach((id, i) => { $(id).value = r.origin[i] })
  }

  syncJson() {
    const box = $('f-json')
    if (document.activeElement !== box) box.value = JSON.stringify(this.toBrief(), null, 2)
  }
}

// ------------------------------------------------------------ small DOM helpers
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue
    node.setAttribute(k, v === true ? '' : String(v))
  }
  for (const c of children) node.append(c instanceof Node ? c : document.createTextNode(String(c)))
  return node
}

function stepper(root, get, set) {
  const min = Number(root.dataset.min)
  const max = Number(root.dataset.max)
  const label = root.getAttribute('aria-labelledby')
  const name = label ? document.getElementById(label)?.textContent : ''
  const dec = el('button', { type: 'button', 'aria-label': `Fewer ${name}` }, '−')
  const out = el('output', {})
  const inc = el('button', { type: 'button', 'aria-label': `More ${name}` }, '+')
  dec.addEventListener('click', () => set(Math.max(min, get() - 1)))
  inc.addEventListener('click', () => set(Math.min(max, get() + 1)))
  root.setAttribute('role', 'group')
  root.append(dec, out, inc)
}

function setStepper(root, value) {
  const [dec, out, inc] = root.children
  out.textContent = String(value)
  dec.disabled = value <= Number(root.dataset.min)
  inc.disabled = value >= Number(root.dataset.max)
}
