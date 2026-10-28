#!/usr/bin/env node

// Start a hand-built spawn: a folder of its own with everything the recipe needs.
//
//   node scripts/new-spawn.mjs "Ember SMP"                      → minecraft-builds/ember-smp/ (normal template)
//   node scripts/new-spawn.mjs "Ember SMP" --type plus          start from the spawn+ template
//   node scripts/new-spawn.mjs "Ember SMP" --from pirate-isle   start from any example spawn
//   node scripts/new-spawn.mjs "Ember SMP" --from blank         an empty skeleton (a layout no template has)
//
// The templates are tested layouts written as recipes, driven by a BRIEF block at the top (name,
// theme, NPCs, boards, crates, top-3 sets, landmarks, warzone, signs...): set the brief, build it, and
// you have a good spawn; then make it the user's own in its CUSTOM block.
//   --type normal → ember-smp      (a big flat plaza, NPC rings, a ring of buildings)
//   --type plus   → oakhaven-hub   (a town, a building per NPC)
//   --type pvp    → kirin-practice (a PvP lobby)
//
// Writes:
//   spawn.mjs        the recipe (a copy of the template, its BRIEF named after the server)
//   parts/           your own copy of the spawn parts (assets/spawn-parts): edit them freely, e.g.
//                    snow on a roof style, another crate plinth; they belong to this spawn only
//   examples/        every example spawn, for reading (their imports point at ../parts)
//   brief.md         the interview answers and the plan (--brief "text" fills it)
// Then build it with run-build (or the plugin's build_recipe tool) and look at the renders.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const PARTS = path.join(root, 'assets/spawn-parts')
const EXAMPLES = path.join(root, 'assets/examples/spawns')

const argv = process.argv.slice(2)
const opt = name => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}
const examples = fs.readdirSync(EXAMPLES).filter(f => f.endsWith('.mjs')).map(f => f.replace(/\.mjs$/, ''))
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log(`Usage: node scripts/new-spawn.mjs "<server name>" [--type normal|plus|pvp] [--from ${examples.join('|')}|blank] [--out-dir DIR] [--brief "text"] [--force]`)
  process.exit(argv.length ? 0 : 1)
}
const name = argv.find((a, i) => !a.startsWith('--') && !['--from', '--out-dir', '--brief', '--type'].includes(argv[i - 1])) ?? 'Spawn'
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'spawn'
const TEMPLATES = { normal: 'ember-smp', plus: 'oakhaven-hub', pvp: 'kirin-practice' }
const type = opt('--type')
if (type && !TEMPLATES[type]) {
  console.error(`new-spawn: --type is normal, plus or pvp (got "${type}")`)
  process.exit(1)
}
let from = opt('--from') ?? TEMPLATES[type ?? 'normal']
if (from === 'blank') from = null
if (from && !examples.includes(from)) {
  console.error(`new-spawn: no example "${from}" (examples: ${examples.join(', ')}, or blank)`)
  process.exit(1)
}
const dir = path.resolve(opt('--out-dir') ?? path.join(process.cwd(), 'minecraft-builds', slug))
const recipe = path.join(dir, 'spawn.mjs')
if (fs.existsSync(recipe) && !argv.includes('--force')) {
  console.error(`new-spawn: ${recipe} exists (an earlier spawn); edit it, or pass --force to start over (parts/ is refreshed too)`)
  process.exit(1)
}
fs.mkdirSync(path.join(dir, 'parts'), { recursive: true })
fs.mkdirSync(path.join(dir, 'examples'), { recursive: true })
for (const f of fs.readdirSync(PARTS).filter(f => f.endsWith('.mjs'))) fs.copyFileSync(path.join(PARTS, f), path.join(dir, 'parts', f))
// the examples import '../../spawn-parts/x.mjs'; in the spawn folder the parts sit at ../parts
const relink = (src, to) => src.replace(/(['"])(?:\.\.\/)+spawn-parts\//g, `$1${to}`)
for (const ex of examples) fs.writeFileSync(path.join(dir, 'examples', `${ex}.mjs`), relink(fs.readFileSync(path.join(EXAMPLES, `${ex}.mjs`), 'utf8'), '../parts/'))

if (from) {
  let src = relink(fs.readFileSync(path.join(EXAMPLES, `${from}.mjs`), 'utf8'), './parts/')
  // the template's brief carries the new server's name
  src = src.replace(/(const BRIEF = \{\s*\n\s*name: )'[^']*'/, `$1${JSON.stringify(name).replace(/^"|"$/g, "'")}`)
  const templ = Object.values(TEMPLATES).includes(from)
  src = `// ${name}: started from the ${templ ? 'template' : 'example'} ${from}.mjs. ${templ ? 'Set the BRIEF block to the interview answers and build: that is the\n// base. Then make it this server\'s own in the CUSTOM block' : 'Reshape every section to this server\'s brief'} (brief.md).\n\n${src}`
  fs.writeFileSync(recipe, src)
} else fs.writeFileSync(recipe, skeleton(name))
const briefFile = path.join(dir, 'brief.md')
if (!fs.existsSync(briefFile) || opt('--brief')) fs.writeFileSync(briefFile, `# ${name}: brief and plan\n\n${opt('--brief') ?? '(the interview answers, then the plan: a sketch with the main coordinates)'}\n\nBuild and look:\n\n    node "<skill>/scripts/run-build.mjs" ${path.relative(process.cwd(), recipe)} --out-dir ${path.relative(process.cwd(), dir)} --json\n`)

const rel = p => path.relative(process.cwd(), p) || '.'
console.log(`${name}: ${rel(dir)}/
  spawn.mjs   ${from ? `${from}.mjs: set its BRIEF, build, then make it yours` : 'the skeleton to write'}
  parts/      ${fs.readdirSync(path.join(dir, 'parts')).length} part files (yours to edit)
  examples/   ${examples.join(', ')}
  brief.md    the brief and the plan`)

function skeleton(title) {
  return `// ${title}: a hand-built server spawn. The brief and the plan are in brief.md.
// Read references/spawns/build-guide.md (how every piece is built, with the numbers) and the closest
// example in examples/ before writing each section. Build after each section and look at the renders.

import { startSpawn, finishSpawn, polar, facingToward, yawToward, findSpot } from './parts/spawn.mjs'
import { buildSite, paveRound, paveRect, pavePath } from './parts/site.mjs'
import { ringPoints, npcPlinth, grassBed } from './parts/plaza.mjs'
import { boardsPlaza, crateCourt, crateYard, top3Pillars } from './parts/features.mjs'
import { building, heroWall } from './parts/buildings.mjs'
import { featureTree, lamp, bench, bushAt, planter, hedge, stall, clutter, fountain, well, pvpArena, afkPark, rockOutcrop, landscapePass } from './parts/landscape.mjs'
import { landmark, palmTree } from './parts/landmarks.mjs'
import { warzoneBand, moshpit, koth } from './parts/warzone.mjs'
import { signStand } from './parts/signs.mjs'
import { snowfall, leafLitter } from './parts/seasons.mjs'

// ------------------------------------------------------------------ the brief, as answered
const NPCS = [
  // { id: 'shop', label: 'Shop' }, ...
]
const BOARDS = [
  // { id: 'money', label: 'Money' }, ...
]
const CRATES = [
  // { id: 'vote', label: 'Vote', tier: 'vote' }, ...
]

export default function build(api) {
  const ctx = startSpawn(api, { name: ${JSON.stringify(title)}, size: 200, height: 100, theme: 'medieval', accent: 'blue', setting: 'plains', seed: 7 })
  const { b, kit, theme, FY, C, S, grid, rng, M } = ctx
  const [cx, cz] = C

  // ================================================================ 1. plan (no blocks yet)
  // Decide every place: the plaza, the spawn point and its first view, the NPC places, the boards,
  // the crates, the gates, the buildings, the set pieces. Reserve each footprint on the grid and
  // collect a level pad for each.
  ctx.layout.plaza = { cx, cz, r: 40 }
  grid.reserveDisc(cx, cz, 41, 'plaza')
  const pads = []

  // ================================================================ 2. the site
  buildSite(ctx, { pads })

  // ================================================================ 3. the plaza and the spawn point
  paveRound(ctx, { cx, cz, r: 40, kerb: theme.paving.border })
  b.spawnPoint([cx, FY, cz], 'north')

  // ================================================================ 4. NPCs, boards, crates, gates

  // ================================================================ 5. buildings and walks

  // ================================================================ 6. set pieces, planting, life
  ctx.place(landscapePass)
  return finishSpawn(ctx)
}
`
}
