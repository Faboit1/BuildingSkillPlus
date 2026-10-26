#!/usr/bin/env node
// The plugin's MCP server (stdio, JSON-RPC 2.0, one message per line; no SDK needed). It gives the
// model real tools instead of shell commands:
//   spawn_options   themes, settings, types, NPC ids, crate tiers, recommended sizes (for the interview)
//   make_spawn      a brief → the finished spawn (.nbt/.schem/.litematic, setup sheet, renders shown inline)
//   rebuild_spawn   rebuild from an edited <slug>.recipe.mjs
//   build_recipe    any kit recipe → .nbt + an overview render
//   render_build    an isometric render of any .nbt/.schem/.litematic, returned as an image
//   inspect_build   lint checks / human-build score / block info
//   convert_build   .nbt ⇄ .schem ⇄ .litematic
// Everything runs the skill's own scripts (../scripts) with the bundled dependencies.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const scripts = path.join(root, 'scripts')
const VERSION = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8')).version ?? '1.0.0'
const SUPPORTED = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const projectDir = () => {
  const p = process.env.MC_PROJECT_DIR
  return p && !p.includes('${') && fs.existsSync(p) ? p : process.cwd()
}
const outPath = p => (p ? path.resolve(projectDir(), p) : null)
const log = (...a) => process.stderr.write(`[minecraft-builder] ${a.join(' ')}\n`)

// ---------------------------------------------------------------- running the scripts
function run(script, args, { timeout = 600000 } = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(scripts, script), ...args], { cwd: projectDir(), env: process.env })
    let out = ''
    let err = ''
    child.stdout.on('data', d => (out += d))
    child.stderr.on('data', d => (err += d))
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout)
    child.on('close', code => {
      clearTimeout(timer)
      resolve({ code, out, err })
    })
    child.on('error', e => resolve({ code: -1, out, err: String(e) }))
  })
}
const image = file => ({ type: 'image', data: fs.readFileSync(file).toString('base64'), mimeType: 'image/png' })
const text = t => ({ type: 'text', text: t })
const fail = msg => ({ content: [text(msg)], isError: true })

// make-spawn prints a report; keep it, add the renders as images the model can look at right away
async function spawnResult(args, { images = true } = {}) {
  const r = await run('make-spawn.mjs', args)
  if (r.code !== 0) return fail(`make_spawn failed:\n${(r.err || r.out).slice(-4000)}`)
  const report = r.out.slice(Math.max(0, r.out.indexOf(': done') - 200)).trim()
  const renders = [...r.out.matchAll(/render\s+(\S+\.png)/g)].map(m => path.resolve(projectDir(), m[1]))
  const content = [text(`${r.out.split('\n').filter(l => /^brief: /.test(l)).join('\n')}\n${report}`.trim())]
  if (images) {
    // the overview and (when Playwright is installed) the eye-level spawn view; the others by path
    for (const want of [/-spawn-view\.png$/, /-overview-se\.png$/]) {
      const f = renders.find(p => want.test(p))
      if (f && fs.existsSync(f)) content.push(text(path.basename(f)), image(f))
    }
  }
  return { content }
}

// ---------------------------------------------------------------- tools
const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Server name, built in block letters on the hero wall' },
    type: { type: 'string', enum: ['normal', 'plus', 'pvp'], description: 'normal = FreshSMP-like plaza with the NPCs in a ring; plus = DonutSMP-like town, every NPC its own building; pvp = PvP lobby' },
    size: { type: 'integer', minimum: 60, maximum: 320, description: 'Blocks across (square). Leave out for the recommended size for the NPC count' },
    npcs: { description: 'A count, or a list of NPC ids/labels (e.g. ["shop","auction","rtp"]) or objects {id,label,role}', anyOf: [{ type: 'integer', minimum: 0, maximum: 40 }, { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, role: { type: 'string' } } }] } }] },
    theme: { type: 'string', enum: ['autumn', 'medieval', 'white-town', 'japanese', 'winter', 'fantasy', 'crimson'] },
    setting: { type: 'string', enum: ['island', 'plains', 'valley', 'mountain', 'coast'], description: "Island terrain variant; leave out for the theme's" },
    accent: { type: 'string', enum: ['white', 'light_gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'light_blue', 'blue', 'purple', 'magenta', 'pink'] },
    leaderboards: { description: 'A count or labels, e.g. ["Money","Kills","Playtime"]', anyOf: [{ type: 'integer', minimum: 0, maximum: 6 }, { type: 'array', items: { type: 'string' } }] },
    crates: { description: 'A count, labels, or objects {id,label,tier}; tiers: common, uncommon, rare, epic, legendary, mythic, vote, seasonal', anyOf: [{ type: 'integer', minimum: 0, maximum: 8 }, { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, tier: { type: 'string' } } }] } }] },
    features: { type: 'object', properties: { rtp: { type: 'boolean' }, pvp: { type: 'boolean' }, afk: { type: 'boolean' }, signs: { type: 'boolean' } }, description: 'RTP gate, PvP zone, AFK area, block-letter name sign' },
    seed: { type: 'integer', description: 'Another number = another variation of the same brief' },
    origin: { type: 'array', items: { type: 'integer' }, minItems: 3, maxItems: 3, description: 'World [x,y,z] of the paste corner; default centres the spawn on 0,0 at y 64' },
    world: { type: 'string', description: 'World name used in the setup commands' },
  },
  required: ['name', 'type'],
}

const TOOLS = [
  {
    name: 'spawn_options',
    description: 'Everything the spawn interview can offer: types, themes (with what they look like), island settings, accent colours, the NPC ids each type knows, crate tiers, and the recommended size for a number of NPCs. Call this before asking the user the interview questions.',
    inputSchema: { type: 'object', properties: { npcs: { type: 'integer', description: 'Optional: also return the recommended size for this many NPCs per type' } } },
    run: async ({ npcs } = {}) => {
      const { THEMES } = await import(pathToFileURL(path.join(scripts, 'lib/spawngen/themes.mjs')).href)
      const { TYPES, NPC_LABELS } = await import(pathToFileURL(path.join(scripts, 'lib/spawngen/brief.mjs')).href)
      const { resolveBrief } = await import(pathToFileURL(path.join(scripts, 'lib/spawngen/index.mjs')).href)
      const rec = n => Object.fromEntries(Object.keys(TYPES).map(t => [t, resolveBrief({ type: t, npcs: n }).brief.size]))
      const info = {
        types: { normal: 'Normal spawn (FreshSMP-like): one round plaza on good terrain, NPCs on plinths in a ring, leaderboards + name north, crates west, PvP ruin east, RTP gate south, cottages at the rim. Best for most SMPs.', plus: 'Spawn+ (DonutSMP-like): a town around a square hub, every NPC gets its own building; corner halls, gardens, stalls, PvP arena and AFK park outside.', pvp: 'PvP lobby: queue NPCs in an arc facing the spawn dais, leaderboards behind, an FFA arena, crates and a store pavilion.' },
        sizeRanges: TYPES,
        themes: Object.fromEntries(Object.entries(THEMES).map(([k, t]) => [k, `${t.label}: ${t.kit.primary.replace(/_/g, ' ')} walls, ${t.roof.replace(/_/g, ' ')} roofs, ${t.trees.feature.replace(/_/g, ' ')} trees, ${t.accent} accent, default setting ${t.setting}`])),
        settings: { island: 'gentle rolling floating island', plains: 'nearly flat', valley: 'hills rising round the rim', mountain: 'a rocky ridge behind the hero', coast: 'a lake cove with beaches' },
        accents: BRIEF_SCHEMA.properties.accent.enum,
        npcIds: { normal_and_plus: ['shop', 'auction', 'rtp', 'store', 'kits', 'quests', 'sell', 'warps', 'events', 'bounties', 'teams', 'tutorial', 'afk', 'vote', 'duels', 'enchanter'], pvp: ['unranked', 'ranked', 'ffa', 'kits', 'events', 'store', 'duels', 'bots'], labels: NPC_LABELS },
        leaderboardIdeas: ['Money', 'Kills', 'Playtime', 'Blocks Mined', 'Deaths', 'Votes', 'Elo', 'Wins', 'Streak'],
        crateTiers: ['vote', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'seasonal'],
        recommendedSize: Object.fromEntries([4, 6, 8, 10, 12, 16, 20, 24, 30].map(n => [n, rec(n)])),
        ...(npcs ? { recommendedForYourCount: rec(npcs) } : {}),
      }
      return { content: [text(JSON.stringify(info, null, 2))] }
    },
  },
  {
    name: 'make_spawn',
    description: 'Generate a whole Minecraft server spawn from the interview brief: island terrain, plaza, NPC places, leaderboards with the server name, crates, RTP gate, PvP zone, themed buildings, trees, lighting, spawn-proofing. Writes <slug>.nbt/.schem/.litematic, <slug>.setup.md (NPC/hologram/crate/WorldGuard commands), <slug>.placements.json, an editable <slug>.recipe.mjs and renders into minecraft-builds/<slug>/ in the project, and returns the report with the overview (and eye-level spawn view when available) as images. Takes 10-90 s.',
    inputSchema: { type: 'object', properties: { brief: BRIEF_SCHEMA, out_dir: { type: 'string', description: 'Output folder (default minecraft-builds/<slug> in the project)' }, renders: { type: 'boolean', description: 'Render images (default true)' } }, required: ['brief'] },
    run: async ({ brief, out_dir, renders = true }) => {
      if (!brief || typeof brief !== 'object') return fail('brief must be an object, e.g. {"name":"Crimson SMP","type":"normal","npcs":10,"theme":"crimson"}')
      const args = ['--brief', JSON.stringify(brief)]
      if (out_dir) args.push('--out-dir', outPath(out_dir))
      if (!renders) args.push('--no-render')
      return spawnResult(args, { images: renders })
    },
  },
  {
    name: 'rebuild_spawn',
    description: 'Rebuild a spawn from its edited recipe (minecraft-builds/<slug>/<slug>.recipe.mjs: change the brief in it, or add hand-made details in its after(ctx) hook). Returns the same report and images as make_spawn.',
    inputSchema: { type: 'object', properties: { recipe: { type: 'string', description: 'Path to <slug>.recipe.mjs' }, renders: { type: 'boolean' } }, required: ['recipe'] },
    run: async ({ recipe, renders = true }) => {
      const file = outPath(recipe)
      if (!fs.existsSync(file)) return fail(`no such recipe: ${file}`)
      return spawnResult(['--recipe', file, '--out-dir', path.dirname(file), ...(renders ? [] : ['--no-render'])], { images: renders })
    },
  },
  {
    name: 'build_recipe',
    description: 'Build any kit recipe (a .mjs exporting default (api) => b.finish(...), see the skill) into <name>.nbt and return the build summary plus an isometric overview image.',
    inputSchema: { type: 'object', properties: { recipe: { type: 'string' }, out_dir: { type: 'string' }, origin: { type: 'string', description: 'x,y,z paste corner for the placements/setup sheet' } }, required: ['recipe'] },
    run: async ({ recipe, out_dir, origin }) => {
      const file = outPath(recipe)
      if (!fs.existsSync(file)) return fail(`no such recipe: ${file}`)
      const dir = outPath(out_dir) ?? path.join(projectDir(), 'minecraft-builds', path.basename(file).replace(/\.m?js$/, ''))
      const r = await run('run-build.mjs', [file, '--out-dir', dir, '--json', ...(origin ? ['--origin', origin] : [])])
      if (r.code !== 0) return fail(`build failed:\n${(r.err || r.out).slice(-4000)}`)
      const summary = JSON.parse(r.out.slice(r.out.indexOf('{')))
      const warnings = r.err.split('\n').filter(l => /^builder: /.test(l))
      const content = [text(`built ${summary.nbtPath} (${summary.blockCount} blocks, ${summary.size.join('x')})\nproblems: ${JSON.stringify(summary.builder?.problems ?? [])}\nclipped: ${summary.builder?.clipped ?? 0}${warnings.length ? `\nwarnings:\n${warnings.join('\n')}` : ''}`)]
      const png = path.join(dir, 'renders', `${path.basename(summary.nbtPath, '.nbt')}-iso-se.png`)
      const rr = await run('isorender.mjs', [summary.nbtPath, '--out', png, '--px', summary.size[0] > 200 ? '2' : summary.size[0] > 100 ? '4' : '6'])
      if (rr.code === 0 && fs.existsSync(png)) content.push(text(png), image(png))
      return { content }
    },
  },
  {
    name: 'render_build',
    description: 'Render a .nbt/.schem/.litematic as an isometric image (any size, CPU only) and return it. Use from: se|sw|ne|nw for the camera corner, px for zoom (2 overview .. 8 close), box to crop columns, ymin to cut away everything below a level.',
    inputSchema: { type: 'object', properties: { file: { type: 'string' }, from: { type: 'string', enum: ['se', 'sw', 'ne', 'nw'] }, px: { type: 'integer', minimum: 1, maximum: 12 }, box: { type: 'string', description: 'x0,z0,x1,z1' }, ymin: { type: 'integer' } }, required: ['file'] },
    run: async ({ file, from = 'se', px, box, ymin }) => {
      const f = outPath(file)
      if (!fs.existsSync(f)) return fail(`no such file: ${f}`)
      const png = path.join(path.dirname(f), 'renders', `${path.basename(f).replace(/\.[^.]+$/, '')}-iso-${from}${box ? '-crop' : ''}.png`)
      const args = [f, '--out', png, '--from', from, ...(px ? ['--px', String(px)] : []), ...(box ? ['--box', box] : []), ...(ymin !== undefined ? ['--ymin', String(ymin)] : [])]
      const r = await run('isorender.mjs', args)
      if (r.code !== 0 || !fs.existsSync(png)) return fail(`render failed:\n${(r.err || r.out).slice(-3000)}`)
      return { content: [text(png), image(png)] }
    },
  },
  {
    name: 'inspect_build',
    description: 'Inspect a build: mode "checks" lints it (floating blocks, unsupported blocks, plants on stone, fluids, dark spots, flat walls...), "score" rates it 0-100 against 1,212 human builds with a fix per metric, "info" lists size and top blocks.',
    inputSchema: { type: 'object', properties: { file: { type: 'string' }, mode: { type: 'string', enum: ['checks', 'score', 'info'] } }, required: ['file'] },
    run: async ({ file, mode = 'checks' }) => {
      const f = outPath(file)
      if (!fs.existsSync(f)) return fail(`no such file: ${f}`)
      const r = await run('inspect.mjs', mode === 'info' ? [f] : [f, `--${mode}`])
      return { content: [text((r.out || r.err).slice(0, 20000))], isError: r.code !== 0 }
    },
  },
  {
    name: 'convert_build',
    description: 'Convert a build between .nbt, .schem (WorldEdit/FAWE) and .litematic (Litematica). Returns the written path.',
    inputSchema: { type: 'object', properties: { file: { type: 'string' }, to: { type: 'string', enum: ['schem', 'litematic', 'nbt'] }, out: { type: 'string' } }, required: ['file', 'to'] },
    run: async ({ file, to, out }) => {
      const f = outPath(file)
      if (!fs.existsSync(f)) return fail(`no such file: ${f}`)
      const target = outPath(out) ?? f.replace(/\.[^.]+$/, `.${to}`)
      const r = await run('convert.mjs', [f, '--out', target])
      return r.code === 0 ? { content: [text(`wrote ${target}`)] } : fail((r.err || r.out).slice(-3000))
    },
  },
]

// ---------------------------------------------------------------- JSON-RPC over stdio
const send = msg => process.stdout.write(`${JSON.stringify(msg)}\n`)
const serverInfo = { name: 'minecraft-builder', version: VERSION }
const INSTRUCTIONS = 'Minecraft builds and server spawns. For a spawn/lobby/hub: run the interview from the minecraft-builder skill (call spawn_options first), then make_spawn with the brief, look at the returned images, fix with rebuild_spawn, lint with inspect_build, and deliver the .schem/.litematic + setup.md.'

async function handle(msg) {
  const { id, method, params } = msg
  if (method === 'initialize') {
    const asked = params?.protocolVersion
    return { protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0], capabilities: { tools: { listChanged: false } }, serverInfo, instructions: INSTRUCTIONS }
  }
  if (method === 'server/discover') return { supportedVersions: SUPPORTED, capabilities: { tools: { listChanged: false } }, serverInfo, instructions: INSTRUCTIONS }
  if (method === 'ping') return {}
  if (method === 'tools/list') return { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) }
  if (method === 'tools/call') {
    const tool = TOOLS.find(t => t.name === params?.name)
    if (!tool) throw Object.assign(new Error(`unknown tool ${params?.name}`), { code: -32602 })
    try {
      return await tool.run(params.arguments ?? {})
    } catch (err) {
      log(err.stack)
      return fail(`${tool.name} failed: ${err.message}`)
    }
  }
  if (method === 'resources/list') return { resources: [] }
  if (method === 'prompts/list') return { prompts: [] }
  if (id === undefined) return undefined // a notification
  throw Object.assign(new Error(`method not found: ${method}`), { code: -32601 })
}

const rl = readline.createInterface({ input: process.stdin })
rl.on('line', async line => {
  if (!line.trim()) return
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })
    return
  }
  try {
    const result = await handle(msg)
    if (msg.id !== undefined && result !== undefined) send({ jsonrpc: '2.0', id: msg.id, result })
  } catch (err) {
    if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: err.code ?? -32603, message: err.message } })
  }
})
rl.on('close', () => process.exit(0))
log(`ready (v${VERSION}, scripts at ${scripts})`)
