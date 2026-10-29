#!/usr/bin/env node

// Start a hand-built spawn: a folder of its own with the skeleton recipe and what you read while
// writing it.
//
//   node scripts/new-spawn.mjs "Ember SMP"                      → minecraft-builds/ember-smp/
//   node scripts/new-spawn.mjs "Ember SMP" --brief "plan text"  fills brief.md
//   node scripts/new-spawn.mjs "Ember SMP" --size 240           the canvas side (default 200)
//
// Writes:
//   spawn.mjs   the skeleton: the frame and one empty section per element group, each pointing at
//               its chapter of references/spawns/build-guide.md. Every element is yours to write.
//   frame/      the plumbing (canvas, grid, angles, the records for setup.md, spawn-proofing)
//   elements/   the manual's worked examples, one per element, with their do / don't rules
//   parts/      the library the reference spawns are built from (for reading)
//   examples/   whole reference spawns (for reading how a spawn fits together)
//   brief.md    the interview answers and the plan
// Then build it with run-build (or the plugin's build_recipe tool) and look at the renders.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const FRAME = path.join(root, 'assets/frame')
const ELEMENTS = path.join(root, 'references/spawns/elements')
const PARTS = path.join(root, 'assets/spawn-parts')
const EXAMPLES = path.join(root, 'assets/examples/spawns')

const argv = process.argv.slice(2)
const opt = name => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log('Usage: node scripts/new-spawn.mjs "<server name>" [--size N] [--out-dir DIR] [--brief "text"] [--force]')
  process.exit(argv.length ? 0 : 1)
}
if (argv.includes('--from') || argv.includes('--type')) {
  console.error('new-spawn: --from and --type are gone: every spawn starts from the skeleton and you build each element (references/spawns/build-guide.md)')
  process.exit(1)
}
const VALUED = ['--out-dir', '--brief', '--size']
const name = argv.find((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1])) ?? 'Spawn'
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'spawn'
const size = Number(opt('--size') ?? 200)
if (!Number.isInteger(size) || size < 48 || size > 512) {
  console.error(`new-spawn: --size is a whole number of blocks, 48-512 (got "${opt('--size')}")`)
  process.exit(1)
}
const dir = path.resolve(opt('--out-dir') ?? path.join(process.cwd(), 'minecraft-builds', slug))
const recipe = path.join(dir, 'spawn.mjs')
if (fs.existsSync(recipe) && !argv.includes('--force')) {
  console.error(`new-spawn: ${recipe} exists (an earlier spawn); edit it, or pass --force to start over (frame/, elements/, parts/ and examples/ are refreshed too)`)
  process.exit(1)
}

const mjs = d => fs.readdirSync(d).filter(f => f.endsWith('.mjs'))
const copyDir = (from, to, relink = s => s) => {
  fs.mkdirSync(to, { recursive: true })
  for (const f of mjs(from)) fs.writeFileSync(path.join(to, f), relink(fs.readFileSync(path.join(from, f), 'utf8')))
}
copyDir(FRAME, path.join(dir, 'frame'))
// the elements import '../../../assets/frame/frame.mjs'; in the spawn folder the frame is ../frame
copyDir(ELEMENTS, path.join(dir, 'elements'), s => s.replace(/(['"])(?:\.\.\/)+assets\/frame\//g, '$1../frame/'))
// parts/spawn.mjs imports '../frame/frame.mjs', which resolves the same in the spawn folder
copyDir(PARTS, path.join(dir, 'parts'))
// the examples import '../../spawn-parts/x.mjs'; in the spawn folder the parts sit at ../parts
copyDir(EXAMPLES, path.join(dir, 'examples'), s => s.replace(/(['"])(?:\.\.\/)+spawn-parts\//g, '$1../parts/'))

fs.writeFileSync(recipe, skeleton(name, size))
const briefFile = path.join(dir, 'brief.md')
if (!fs.existsSync(briefFile) || opt('--brief')) fs.writeFileSync(briefFile, `# ${name}: brief and plan\n\n${opt('--brief') ?? '(the interview answers, then the plan: every place with its coordinates, a sentence on the design of each element, a top-view sketch)'}\n\nBuild and look:\n\n    node "<skill>/scripts/run-build.mjs" ${path.relative(process.cwd(), recipe)} --out-dir ${path.relative(process.cwd(), dir)} --json\n`)

const rel = p => path.relative(process.cwd(), p) || '.'
console.log(`${name}: ${rel(dir)}/
  spawn.mjs   the skeleton (${size} x ${size}): write every element, section by section
  frame/      the plumbing
  elements/   ${mjs(ELEMENTS).filter(f => !f.startsWith('_')).map(f => f.replace(/\.mjs$/, '')).join(', ')} (worked examples)
  parts/      ${mjs(PARTS).length} reference part files (for reading)
  examples/   ${mjs(EXAMPLES).map(f => f.replace(/\.mjs$/, '')).join(', ')} (reference spawns)
  brief.md    the brief and the plan`)

function skeleton(title, S) {
  return `// ${title}: a server spawn, every block of it written by hand. The brief and the plan: brief.md.
//
// How to work (references/spawns/build-guide.md, "the manual"):
// - Each section below is one step of the plan. Before you write an element, read its chapter in
//   the manual's §5 and look at its do / don't picture; elements/<name>.mjs is its worked example.
// - Write each element as a function below build(), designed for this spawn from the brief and the
//   theme: its own shapes, sizes and materials, and every repeat of it varied.
// - Build after every section (build_recipe) and look at the views before you start the next.
//
// The frame is plumbing only (manual §3-§4): startSpawn, finishSpawn, polar, facingToward,
// yawToward, findSpot, local. The marks place no blocks; they record what the server admin needs
// (setup.md) and keep the cells a place needs clear: b.spawnPoint, b.markNpc, b.markCrate,
// b.markBoard, b.markPortal, ctx.hologram, b.region.

import { startSpawn, finishSpawn, polar, facingToward, yawToward, findSpot, local } from './frame/frame.mjs'

// ------------------------------------------------------------------ the brief, as answered
const NPCS = [
  // { id: 'shop', label: 'Shop' },
]
const BOARDS = [
  // { id: 'money', label: 'Top balance' },
]
const CRATES = [
  // { id: 'vote', label: 'Vote Crate', tier: 'vote', colour: 'lime' },
]

export default function build(api) {
  const ctx = startSpawn(api, { name: ${JSON.stringify(title)}, size: ${S}, height: 90, seed: 7 })
  const { b, kit, FY, C, S, grid, rng } = ctx
  const [cx, cz] = C

  // ================================================================ 1. PLAN (no blocks yet)
  // Every place with its coordinates (manual §6): the plaza, the spawn point and its first view,
  // each NPC place, the boards, the crates, the gates, the buildings, the hero. Keep the plan in
  // ctx.layout and reserve every footprint on the grid, so nothing you place later grows into it.
  ctx.layout.plaza = { cx, cz, r: 34 }
  grid.reserveDisc(cx, cz, 35, 'plaza')

  // ================================================================ 2. THE LAND (§5.1)
  // Your island: its outline, the flat ground where people walk, the roll further out, the shore
  // and the underside. Keep a groundY(x, z) for everything off the plaza.

  // ================================================================ 3. THE FLOOR (§5.2, §5.3)
  // The plaza's paving (field, borders, inlay, the rose), the ground's mix, the walks.

  // ================================================================ 4. THE SPAWN POINT
  // Facing the first view (§1.2, rule 1).
  b.spawnPoint([cx, FY, cz], 'north')

  // ================================================================ 5. THE PLACES (§5.6-§5.9)
  // Every NPC place (b.markNpc), the boards and the podium (b.markBoard, statues with b.markNpc),
  // the crates (b.markCrate), the gates (b.markPortal).

  // ================================================================ 6. BUILDINGS AND THE HERO (§5.10, §5.16)
  // Each building designed for its job, neighbours as siblings, not clones; the hero on the axis.

  // ================================================================ 7. LIFE (§5.4, §5.5, §5.11-§5.13)
  // Rocks in groups, trees and bushes in three sizes, flower drifts, lamps along the walks, props
  // that tell a story, water.

  // ================================================================ 8. TEXT AND RULES (§5.14, §5.15)
  // Holograms (ctx.hologram), the PvP line and its region (b.region).

  return finishSpawn(ctx) // with your island: finishSpawn(ctx, { land: (x, z) => groundY(x, z) >= 0 })
}

// ------------------------------------------------------------------ this spawn's elements
// One function per element, written for this spawn, e.g.
//   function island(ctx, { cx, cz, r }) { ...; return groundY }
//   function npcPlace(ctx, pos, facing, npc) { ...; return ctx.b.markNpc(local(pos, facing).at(0, 0, 1), facing, npc) }
`
}
