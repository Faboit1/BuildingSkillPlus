// The spawn brief: everything the user told you in the interview, as one JSON object.
// normalizeBrief() fills defaults, clamps sizes and turns counts into named lists, so a brief can be
// as short as { "name": "CheeseSMP", "type": "normal" }. See references/spawns/README.md §1 and
// assets/spawn-briefs/*.json.

import { THEMES, THEME_ALIASES } from '../../../assets/spawn-parts/themes.mjs'

export const TYPES = {
  normal: { size: 200, min: 120, max: 320, height: 100 },
  plus: { size: 220, min: 160, max: 320, height: 110 },
  pvp: { size: 96, min: 60, max: 140, height: 90 },
}
const TYPE_ALIASES = {
  normal: 'normal', fresh: 'normal', freshsmp: 'normal', simple: 'normal', small: 'normal',
  plus: 'plus', 'spawn+': 'plus', 'spawnplus': 'plus', hub: 'plus', donut: 'plus', donutsmp: 'plus', big: 'plus',
  pvp: 'pvp', lobby: 'pvp', 'pvp-lobby': 'pvp', practice: 'pvp', arena: 'pvp',
}

// Default NPC programme in priority order: the first N are used when the brief gives a count.
const NPC_DEFAULTS = {
  normal: ['shop', 'auction', 'rtp', 'store', 'kits', 'quests', 'sell', 'warps', 'events', 'bounties', 'teams', 'tutorial', 'afk', 'vote'],
  plus: ['shop', 'auction', 'rtp', 'store', 'kits', 'quests', 'sell', 'warps', 'events', 'bounties', 'teams', 'tutorial', 'afk', 'vote', 'duels', 'enchanter'],
  pvp: ['unranked', 'ranked', 'ffa', 'kits', 'events', 'store', 'duels', 'bots'],
}
export const NPC_LABELS = {
  shop: 'Shop', auction: 'Auction House', rtp: 'Random TP', store: 'Store', kits: 'Kits', quests: 'Quests', sell: 'Sell',
  warps: 'Warps', events: 'Events', bounties: 'Bounties', teams: 'Teams', tutorial: 'Start Here', afk: 'AFK', vote: 'Vote',
  duels: 'Duels', enchanter: 'Enchanter', unranked: 'Unranked', ranked: 'Ranked', ffa: 'FFA', bots: 'Bot Duels',
}
const BOARD_DEFAULTS = { normal: ['Money', 'Kills', 'Playtime'], plus: ['Money', 'Kills', 'Playtime', 'Blocks Mined'], pvp: ['Elo', 'Wins', 'Streak'] }
const CRATE_DEFAULTS = [
  { id: 'vote', label: 'Vote', tier: 'vote' },
  { id: 'common', label: 'Common', tier: 'common' },
  { id: 'rare', label: 'Rare', tier: 'rare' },
  { id: 'epic', label: 'Epic', tier: 'epic' },
  { id: 'legendary', label: 'Legendary', tier: 'legendary' },
  { id: 'seasonal', label: 'Seasonal', tier: 'seasonal' },
]
const CRATE_ORDER = ['vote', 'common', 'rare', 'legendary', 'epic', 'seasonal']

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'spawn'
const idOf = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const KNOWN = ['name', 'slug', 'type', 'size', 'height', 'theme', 'setting', 'accent', 'facing', 'npcs', 'npc', 'leaderboards', 'boards', 'crates', 'top3', 'warzone', 'moshpit', 'koth', 'landmarks', 'bigTrees', 'terraces', 'rocks', 'surprise', 'features', 'seed', 'origin', 'world']
// big set pieces round the spawn (landmarks.mjs builds them)
export const LANDMARK_KINDS = ['volcano', 'lighthouse', 'ship', 'statue', 'giant-tree', 'giant-palm', 'rock-spires', 'rock-arch']
const LANDMARK_ALIASES = { tree: 'giant-tree', 'big-tree': 'giant-tree', palm: 'giant-palm', boat: 'ship', 'pirate-ship': 'ship', galleon: 'ship', spires: 'rock-spires', rocks: 'rock-spires', arch: 'rock-arch', tower: 'lighthouse', mountain: 'volcano' }
const TOP3_DEFAULTS = ['Top Spenders', 'Baltop', 'Top Killers', 'Top Voters']
const SETTINGS = ['island', 'plains', 'valley', 'mountain', 'coast']
const DYES = ['white', 'light_gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'light_blue', 'blue', 'purple', 'magenta', 'pink']
const near = (word, list) => list.find(k => k.startsWith(String(word).slice(0, 3)) || String(word).includes(k))

// "Surprise me": every field the brief leaves out is picked at random (from the seed, so the recipe
// rebuilds the same spawn). The name, and anything the user did choose, stay as given.
function surprise(raw, warnings) {
  const seed = Number.isFinite(Number(raw.seed)) && raw.seed !== undefined ? Number(raw.seed) : Math.floor(Math.random() * 1e6)
  let st = seed * 2654435761 % 4294967296 || 1
  const rnd = () => ((st = (st * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const pick = list => list[Math.floor(rnd() * list.length)]
  const out = { ...raw, seed }
  out.type ??= rnd() < 0.6 ? 'normal' : rnd() < 0.6 ? 'plus' : 'pvp'
  const themes = Object.keys(THEMES)
  out.theme ??= pick(themes)
  out.setting ??= pick(out.type === 'normal' ? ['plains', 'plains', 'island', 'valley', 'coast', 'mountain'] : ['island', 'plains', 'valley', 'coast', 'mountain'])
  if (rnd() < 0.4) out.accent ??= pick(['red', 'blue', 'orange', 'purple', 'cyan', 'lime', 'magenta', 'light_blue'])
  out.npcs ??= out.type === 'pvp' ? 4 + Math.floor(rnd() * 5) : 6 + Math.floor(rnd() * 9)
  out.top3 ??= Math.floor(rnd() * 3)
  const byTheme = { tropical: ['volcano', 'ship', 'lighthouse', 'giant-palm', 'rock-spires', 'statue'], winter: ['giant-tree', 'rock-spires', 'statue', 'lighthouse'], crimson: ['volcano', 'giant-tree', 'rock-spires', 'statue'] }
  const pool = byTheme[out.theme] ?? ['giant-tree', 'statue', 'rock-arch', 'lighthouse', 'rock-spires', 'ship']
  if (out.landmarks === undefined) {
    const n = Math.floor(rnd() * 3)
    out.landmarks = []
    while (out.landmarks.length < n) {
      const k = pick(pool)
      if (!out.landmarks.includes(k)) out.landmarks.push(k)
    }
  }
  out.bigTrees ??= Math.floor(rnd() * 3)
  out.terraces ??= rnd() < 0.7
  out.rocks ??= rnd() < 0.7
  if (out.warzone === undefined && out.type === 'normal' && rnd() < 0.25) out.warzone = { moshpit: rnd() < 0.7, koth: rnd() < 0.7 }
  out.features = { ...(out.features ?? {}) }
  out.features.signs ??= rnd() < 0.15
  out.features.pvp ??= out.type !== 'pvp' && rnd() < 0.8
  delete out.surprise
  warnings.push(`surprise me: type ${out.type}, theme ${out.theme}, setting ${out.setting}${out.accent ? `, accent ${out.accent}` : ''}, ${typeof out.npcs === 'number' ? out.npcs : out.npcs.length} NPCs, ${out.landmarks.length ? out.landmarks.join(' + ') : 'no landmarks'}, seed ${seed}`)
  return out
}

export function normalizeBrief(input = {}) {
  let raw = typeof input === 'string' ? JSON.parse(input) : { ...input }
  const warnings = []
  if (raw.surprise) raw = surprise(raw, warnings)
  for (const k of Object.keys(raw)) if (!KNOWN.includes(k)) warnings.push(`unknown field "${k}" ignored${near(k, KNOWN) ? ` (did you mean "${near(k, KNOWN)}"?)` : ''}`)
  if (raw.setting && !SETTINGS.includes(raw.setting)) {
    warnings.push(`unknown setting "${raw.setting}" (use ${SETTINGS.join(', ')}); using the theme's`)
    raw.setting = null
  }
  if (raw.accent) {
    raw.accent = String(raw.accent).toLowerCase().replace(/[\s-]+/g, '_')
    if (raw.accent === 'gold') raw.accent = 'yellow'
    if (!DYES.includes(raw.accent)) {
      warnings.push(`accent "${raw.accent}" is not a dye colour (use ${DYES.join(', ')}); using the theme's`)
      raw.accent = null
    }
  }
  const type = TYPE_ALIASES[String(raw.type ?? 'normal').toLowerCase()] ?? 'normal'
  if (raw.type && !TYPE_ALIASES[String(raw.type).toLowerCase()]) warnings.push(`unknown type "${raw.type}", using normal`)
  const T = TYPES[type]

  let size = Array.isArray(raw.size) ? Math.max(...raw.size) : Number(raw.size ?? T.size)
  if (!Number.isFinite(size)) size = T.size
  if (size < T.min || size > T.max) {
    warnings.push(`size ${size} is outside ${T.min}-${T.max} for a ${type} spawn; clamped`)
    size = Math.max(T.min, Math.min(T.max, size))
  }
  size = Math.round(size)

  // NPCs: a number, a list of ids/labels, or a list of { id, label, role }
  let npcs = raw.npcs ?? raw.npc ?? (type === 'pvp' ? 6 : type === 'plus' ? 12 : 7)
  if (typeof npcs === 'number') npcs = NPC_DEFAULTS[type].slice(0, Math.max(0, npcs)).concat(
    Array.from({ length: Math.max(0, npcs - NPC_DEFAULTS[type].length) }, (_, i) => `spare_${i + 1}`))
  npcs = npcs.map(n => {
    const o = typeof n === 'string' ? { id: idOf(n), label: NPC_LABELS[idOf(n)] ?? n } : { ...n }
    o.id = idOf(o.id ?? o.label ?? 'npc')
    o.label = o.label ?? NPC_LABELS[o.id] ?? o.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    o.role = o.role ?? o.id
    return o
  })
  const seen = new Set()
  npcs = npcs.map(n => { let id = n.id, k = 2; while (seen.has(id)) id = `${n.id}_${k++}`; seen.add(id); return { ...n, id } })

  // capacity: a normal spawn's NPC ring holds about 14; more needs a spawn+ layout
  const cap = { normal: 28, plus: 30, pvp: 10 }[type]
  if (npcs.length > cap) warnings.push(`${npcs.length} NPCs is a lot for a ${type} spawn (comfortable up to ${cap}); consider type "plus" or fewer NPCs`)

  let boards = raw.leaderboards ?? raw.boards ?? BOARD_DEFAULTS[type]
  if (typeof boards === 'number') boards = (BOARD_DEFAULTS.plus.concat(['Deaths', 'Votes', 'Mobs Killed'])).slice(0, boards)
  boards = boards.map(l => (typeof l === 'string' ? { id: idOf(l), label: l } : { id: idOf(l.id ?? l.label), label: l.label ?? l.id }))

  let crates = raw.crates ?? (type === 'pvp' ? 2 : 4)
  if (typeof crates === 'number') crates = CRATE_ORDER.slice(0, crates).map(id => CRATE_DEFAULTS.find(c => c.id === id))
  crates = crates.map(c => {
    const o = typeof c === 'string' ? { id: idOf(c), label: c } : { ...c }
    o.id = idOf(o.id ?? o.label)
    o.label = o.label ?? o.id
    o.tier = o.tier ?? (CRATE_DEFAULTS.find(d => d.id === o.id)?.tier ?? 'common')
    return o
  })

  let theme = String(raw.theme ?? (type === 'pvp' ? 'japanese' : 'medieval')).toLowerCase().replace(/[\s_]+/g, '-')
  if (!THEMES[theme] && !THEME_ALIASES[theme]) {
    warnings.push(`unknown theme "${theme}" (use ${Object.keys(THEMES).join(', ')}); using medieval`)
    theme = 'medieval'
  }
  theme = THEMES[theme] ? theme : THEME_ALIASES[theme]
  // the layouts always face the spawn north (rotate the paste if the world needs another way)
  if (raw.facing && raw.facing !== 'north') warnings.push(`facing "${raw.facing}" is not supported yet: players spawn facing north`)
  const facing = 'north'
  const features = {
    rtp: true,
    pvp: type !== 'pvp',          // a PvP zone (ruin arena) next to the plaza; the pvp type has its own arena
    afk: type === 'plus',
    signs: false,                 // block-letter section signs (CRATES, LEADERBOARDS...); rare on real spawns, so off
    ...(raw.features ?? {}),
  }
  // block-letter section signs (CRATES, LEADERBOARDS...): off unless asked; each choice may be 'auto'
  // (the generator picks for the theme). style: 'slim' (small quartz letters smoothed with stairs),
  // 'classic' (5-tall quartz), 'colorful' (concrete in the accent colour); outline / thick: true/false
  if (features.signs) {
    const sg = features.signs === true ? {} : features.signs
    features.signs = {
      style: ['slim', 'classic', 'colorful'].includes(sg.style) ? sg.style : 'auto',
      outline: typeof sg.outline === 'boolean' ? sg.outline : 'auto',
      thick: typeof sg.thick === 'boolean' ? sg.thick : 'auto',
    }
  } else features.signs = false

  // top-3 pillars (1st tallest in the middle, statues on top): a count or labels like "Baltop"
  let top3 = raw.top3 ?? []
  if (top3 === true) top3 = 1
  if (typeof top3 === 'number') top3 = TOP3_DEFAULTS.slice(0, Math.max(0, Math.min(4, top3)))
  top3 = (Array.isArray(top3) ? top3 : []).map(l => (typeof l === 'string' ? { id: idOf(l), label: l } : { id: idOf(l.id ?? l.label), label: l.label ?? l.id }))

  // the warzone: a PvP band round the spawn square (red concrete line at the border), with an optional
  // moshpit (sunken round pit) and KOTH (raised capture hill) inside it
  let warzone = raw.warzone ?? null
  if ((raw.moshpit || raw.koth) && !warzone) {
    warzone = true
    warnings.push('moshpit/koth sit in the warzone round the spawn: warzone turned on')
  }
  if (warzone) {
    const w = warzone === true ? {} : { ...warzone }
    warzone = {
      width: Math.max(40, Math.min(120, Math.round(Number(w.width ?? 64)))),
      moshpit: w.moshpit ?? raw.moshpit ?? true,
      koth: w.koth ?? raw.koth ?? true,
      label: w.label ?? 'Warzone',
    }
  } else warzone = null

  // set pieces: landmarks (a list of kinds), giant trees, raised areas, rocks
  let landmarks = raw.landmarks ?? []
  if (typeof landmarks === 'string') landmarks = [landmarks]
  if (typeof landmarks === 'number') landmarks = LANDMARK_KINDS.filter(k => k !== 'giant-tree' && k !== 'giant-palm').slice(0, landmarks)
  landmarks = landmarks.map(k => String(k).toLowerCase().replace(/[\s_]+/g, '-')).map(k => LANDMARK_ALIASES[k] ?? k)
  for (const k of landmarks) if (!LANDMARK_KINDS.includes(k)) warnings.push(`unknown landmark "${k}" (use ${LANDMARK_KINDS.join(', ')}); skipped`)
  landmarks = landmarks.filter(k => LANDMARK_KINDS.includes(k))
  const bigTrees = Math.max(0, Math.min(8, Math.round(Number(raw.bigTrees === true ? 2 : raw.bigTrees ?? 0) || 0)))
  const terraces = raw.terraces === true ? 4 : Math.max(0, Math.min(10, Math.round(Number(raw.terraces ?? 0) || 0)))
  const rocks = raw.rocks === true ? 8 : raw.rocks === 'many' ? 16 : raw.rocks === 'few' ? 4 : Math.max(0, Math.min(30, Math.round(Number(raw.rocks ?? 0) || 0)))

  const brief = {
    name: raw.name ?? 'Spawn',
    slug: slug(raw.slug ?? raw.name ?? 'spawn'),
    type,
    size,
    height: Number(raw.height ?? T.height),
    theme,
    setting: raw.setting ?? null,  // null = the theme's default setting
    accent: raw.accent ?? null,    // null = the theme's accent
    facing,                        // the way players look when they spawn
    npcs,
    leaderboards: boards,
    crates,
    top3,
    warzone,
    landmarks,
    bigTrees,
    terraces,
    rocks,
    features,
    seed: Number(raw.seed ?? 7),
    origin: raw.origin ?? [-Math.floor(size / 2) - (warzone?.width ?? 0), 64, -Math.floor(size / 2) - (warzone?.width ?? 0)],
    world: raw.world ?? 'world',
  }
  return { brief, warnings }
}
