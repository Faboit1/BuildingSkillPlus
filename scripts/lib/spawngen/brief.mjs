// The spawn brief: everything the user told you in the interview, as one JSON object.
// normalizeBrief() fills defaults, clamps sizes and turns counts into named lists, so a brief can be
// as short as { "name": "CheeseSMP", "type": "normal" }. See references/spawns/README.md §1 and
// assets/spawn-briefs/*.json.

export const TYPES = {
  normal: { size: 120, min: 80, max: 180, height: 90 },
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
const FACINGS = ['north', 'east', 'south', 'west']

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'spawn'
const idOf = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export function normalizeBrief(input = {}) {
  const raw = typeof input === 'string' ? JSON.parse(input) : { ...input }
  const warnings = []
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
  const cap = { normal: 16, plus: 30, pvp: 10 }[type]
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

  const theme = String(raw.theme ?? (type === 'pvp' ? 'japanese' : 'medieval')).toLowerCase().replace(/[\s_]+/g, '-')
  const facing = FACINGS.includes(raw.facing) ? raw.facing : 'north'
  const features = {
    rtp: true,
    pvp: type !== 'pvp',          // a PvP zone (ruin arena) next to the plaza; the pvp type has its own arena
    afk: type === 'plus',
    signs: true,                  // block-letter name sign (and, in a spawn+, 3 district titles)
    ...(raw.features ?? {}),
  }

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
    features,
    seed: Number(raw.seed ?? 7),
    origin: raw.origin ?? [-Math.floor(size / 2), 64, -Math.floor(size / 2)],
    world: raw.world ?? 'world',
  }
  return { brief, warnings }
}
