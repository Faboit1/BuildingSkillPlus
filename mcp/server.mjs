#!/usr/bin/env node
// The plugin's MCP server (stdio, JSON-RPC 2.0, one message per line; no SDK needed). It gives the
// model real tools instead of shell commands:
//   new_spawn       start a hand-built spawn: a folder with its own parts, the examples, a skeleton
//   build_recipe    build any kit recipe (a spawn.mjs too) → .nbt (+ .schem/.litematic), renders
//   screenshot      what a player sees: first-person views (the spawn point or any camera), CPU only
//   render_build    an isometric render of any .nbt/.schem/.litematic, returned as an image
//   inspect_build   lint checks / human-build score / block info
//   convert_build   .nbt ⇄ .schem ⇄ .litematic
//   spawn_options / make_spawn / rebuild_spawn   the one-call spawn GENERATOR: only when the user
//                   asks for it ("use the generator", "a quick one"); spawns are hand-built by default
// Everything runs the skill's own scripts (../scripts) with the bundled dependency. Registered in
// .claude-plugin/plugin.json (mcpServers), not a root .mcp.json, so opening this repo as a project does
// not try to start it without a plugin root.

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
function run(script, args, { timeout = 600000, heap } = {}) {
  return new Promise(resolve => {
    // whole spawns hold millions of blocks: give those steps a bigger heap
    const flags = heap ? [`--max-old-space-size=${heap}`] : []
    const child = spawn(process.execPath, [...flags, path.join(scripts, script), ...args], { cwd: projectDir(), env: process.env })
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
    theme: { type: 'string', enum: ['autumn', 'medieval', 'white-town', 'japanese', 'winter', 'fantasy', 'crimson', 'tropical'] },
    setting: { type: 'string', enum: ['island', 'plains', 'valley', 'mountain', 'coast'], description: "Island terrain variant; leave out for the theme's" },
    accent: { type: 'string', enum: ['white', 'light_gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'light_blue', 'blue', 'purple', 'magenta', 'pink'] },
    leaderboards: { description: 'A count or labels, e.g. ["Money","Kills","Playtime"]', anyOf: [{ type: 'integer', minimum: 0, maximum: 6 }, { type: 'array', items: { type: 'string' } }] },
    crates: { description: 'A count, labels, or objects {id,label,tier}; tiers: common, uncommon, rare, epic, legendary, mythic, vote, seasonal', anyOf: [{ type: 'integer', minimum: 0, maximum: 8 }, { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, tier: { type: 'string' } } }] } }] },
    features: { type: 'object', properties: { rtp: { type: 'boolean' }, pvp: { type: 'boolean' }, afk: { type: 'boolean' }, signs: { description: 'false (default), true, or { style: slim|classic|colorful|auto, outline: true|false|auto, thick: true|false|auto }', anyOf: [{ type: 'boolean' }, { type: 'object', properties: { style: { type: 'string', enum: ['slim', 'classic', 'colorful', 'auto'] }, outline: { anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['auto'] }] }, thick: { anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['auto'] }] } } }] } }, description: 'RTP gate, PvP zone, AFK area; signs = block-letter section titles (CRATES, LEADERBOARDS...), off by default' },
    top3: { description: 'Top-3 pillar sets (statues of the top 3 players): a count or titles, e.g. ["Top Spenders","Baltop"]', anyOf: [{ type: 'integer', minimum: 0, maximum: 4 }, { type: 'array', items: { type: 'string' } }] },
    warzone: { description: 'A PvP band round the spawn behind a red concrete line: true or { width (40-120), moshpit, koth, label }', anyOf: [{ type: 'boolean' }, { type: 'object', properties: { width: { type: 'integer' }, moshpit: { type: 'boolean' }, koth: { type: 'boolean' }, label: { type: 'string' } } }] },
    landmarks: { type: 'array', items: { type: 'string', enum: ['volcano', 'lighthouse', 'ship', 'statue', 'giant-tree', 'giant-palm', 'rock-spires', 'rock-arch'] }, description: 'Big set pieces round the spawn' },
    bigTrees: { type: 'integer', minimum: 0, maximum: 8, description: 'Giant trees round the spawn' },
    terraces: { description: 'Raised areas (1-4 blocks, smooth): true or a count', anyOf: [{ type: 'boolean' }, { type: 'integer' }] },
    rocks: { description: 'Rock outcrops here and there: true, "few", "many" or a count', anyOf: [{ type: 'boolean' }, { type: 'integer' }, { type: 'string' }] },
    surprise: { type: 'boolean', description: 'Pick everything the brief leaves out at random' },
    seed: { type: 'integer', description: 'Another number = another variation of the same brief' },
    origin: { type: 'array', items: { type: 'integer' }, minItems: 3, maxItems: 3, description: 'World [x,y,z] of the paste corner; default centres the spawn on 0,0 at y 64' },
    world: { type: 'string', description: 'World name used in the setup commands' },
  },
  required: ['name', 'type'],
}

const GEN_NOTE = 'Spawn GENERATOR (one call, a fixed layout). Use it only when the user asks for the generator or a quick automatic spawn; by default build spawns by hand (new_spawn, then build_recipe). '

const TOOLS = [
  {
    name: 'spawn_options',
    description: GEN_NOTE + 'Everything the generator\'s brief can take: types, themes (with what they look like), island settings, accent colours, the NPC ids each type knows, crate tiers, and the recommended size for a number of NPCs. Call it before the generator\'s interview.',
    inputSchema: { type: 'object', properties: { npcs: { type: 'integer', description: 'Optional: also return the recommended size for this many NPCs per type' } } },
    run: async ({ npcs } = {}) => {
      const { THEMES } = await import(pathToFileURL(path.join(scripts, 'lib/spawngen/themes.mjs')).href)
      const { TYPES, NPC_LABELS } = await import(pathToFileURL(path.join(scripts, 'lib/spawngen/brief.mjs')).href)
      const { resolveBrief } = await import(pathToFileURL(path.join(scripts, 'lib/spawngen/index.mjs')).href)
      const rec = n => Object.fromEntries(Object.keys(TYPES).map(t => [t, resolveBrief({ type: t, npcs: n }).brief.size]))
      const info = {
        types: { normal: 'Normal spawn (FreshSMP-like): a big flat plaza (about 220 blocks across) with the NPCs on plinths in rings round the spawn, trees in grass beds, hologram leaderboards over plinths with a top-3 podium north, open-air crates west, a PvP ruin behind a red line east, the RTP gate south, and a ring of big buildings all round. No block-letter signs. Best for most SMPs.', plus: 'Spawn+ (DonutSMP-like): a town around a square hub, every NPC gets its own building; corner halls, gardens, stalls, PvP arena and AFK park outside.', pvp: 'PvP lobby: queue NPCs in an arc facing the spawn dais, leaderboards behind, an FFA arena, crates and a store pavilion.' },
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
    description: GEN_NOTE + 'Generate a whole Minecraft server spawn from a brief: island terrain, plaza, NPC places, leaderboards with the server name, crates, RTP gate, PvP zone, themed buildings, trees, lighting, spawn-proofing. Writes <slug>.nbt/.schem/.litematic, <slug>.setup.md (NPC/hologram/crate/WorldGuard commands), <slug>.placements.json, an editable <slug>.recipe.mjs and renders into minecraft-builds/<slug>/ in the project, and returns the report with the overview (and eye-level spawn view when available) as images. Takes 10-90 s.',
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
    description: GEN_NOTE + 'Rebuild a generated spawn from its edited recipe (minecraft-builds/<slug>/<slug>.recipe.mjs: change the brief in it, or add hand-made details in its after(ctx) hook). Returns the same report and images as make_spawn.',
    inputSchema: { type: 'object', properties: { recipe: { type: 'string', description: 'Path to <slug>.recipe.mjs' }, renders: { type: 'boolean' } }, required: ['recipe'] },
    run: async ({ recipe, renders = true }) => {
      const file = outPath(recipe)
      if (!fs.existsSync(file)) return fail(`no such recipe: ${file}`)
      return spawnResult(['--recipe', file, '--out-dir', path.dirname(file), ...(renders ? [] : ['--no-render'])], { images: renders })
    },
  },
  {
    name: 'new_spawn',
    description: 'Start a hand-built server spawn (the default way to make a spawn, after the interview): creates minecraft-builds/<slug>/ with spawn.mjs (a skeleton recipe to write, or a copy of an example with from), parts/ (your own editable copy of the spawn parts: terrain, plaza pieces, buildings, trees, crates, boards, warzone, landmarks, signs, seasons), examples/ (complete example spawns to read and copy from) and brief.md (write the interview answers and your plan there). Then write spawn.mjs section by section, building with build_recipe and looking at screenshot/render_build after each.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'The server name' }, from: { type: 'string', description: 'Optional: start from an example spawn (ember-smp, frost-smp, oakhaven-hub, kirin-practice, pirate-isle...) when the brief is close to it; otherwise leave out and write the layout yourself' }, brief: { type: 'string', description: 'The interview answers and the plan, saved as brief.md' }, out_dir: { type: 'string' }, force: { type: 'boolean', description: 'Overwrite an existing spawn.mjs' } }, required: ['name'] },
    run: async ({ name, from, brief, out_dir, force }) => {
      const args = [name, ...(from ? ['--from', from] : []), ...(brief ? ['--brief', brief] : []), ...(out_dir ? ['--out-dir', outPath(out_dir)] : []), ...(force ? ['--force'] : [])]
      const r = await run('new-spawn.mjs', args)
      if (r.code !== 0) return fail((r.err || r.out).slice(-3000))
      const guide = path.join(root, 'references/spawns/build-guide.md')
      return { content: [text(`${r.out.trim()}\n\nNext: read ${guide} (how every part is built, the numbers) and the closest file in examples/, write the plan in brief.md, then write spawn.mjs and build it with build_recipe after each section.`)] }
    },
  },
  {
    name: 'build_recipe',
    description: 'Build any kit recipe (a .mjs exporting default (api) => ... finish(), e.g. a spawn.mjs from new_spawn) into .nbt, .placements.json and .setup.md (NPC/hologram/crate/region commands) in the recipe folder, and return the summary (problems, warnings) plus an isometric overview and, for a spawn, the first-person view from the spawn point. export: true also writes .schem and .litematic (do it when delivering).',
    inputSchema: { type: 'object', properties: { recipe: { type: 'string' }, out_dir: { type: 'string', description: 'Default: the recipe\'s folder for spawn.mjs, else minecraft-builds/<name>' }, origin: { type: 'string', description: 'x,y,z paste corner for the world coordinates in setup.md' }, world: { type: 'string', description: 'World name for the setup commands' }, export: { type: 'boolean', description: 'Also write .schem and .litematic' }, images: { type: 'boolean', description: 'Return renders (default true)' } }, required: ['recipe'] },
    run: async ({ recipe, out_dir, origin, world, export: exp, images = true }) => {
      const file = outPath(recipe)
      if (!fs.existsSync(file)) return fail(`no such recipe: ${file}`)
      const base = path.basename(file).replace(/\.m?js$/, '')
      const dir = outPath(out_dir) ?? (base === 'spawn' ? path.dirname(file) : path.join(projectDir(), 'minecraft-builds', base))
      const r = await run('run-build.mjs', [file, '--out-dir', dir, '--json', ...(origin ? ['--origin', origin] : []), ...(world ? ['--world', world] : [])], { heap: 6144 })
      if (r.code !== 0) return fail(`build failed:\n${(r.err || r.out).slice(-4000)}`)
      const summary = JSON.parse(r.out.slice(r.out.indexOf('{')))
      const nbt = summary.nbtPath
      const warnings = r.err.split('\n').filter(l => /^builder: /.test(l))
      const lines = [`built ${nbt} (${summary.blockCount} blocks, ${summary.size.join('x')})`, `problems: ${JSON.stringify(summary.builder?.problems ?? [])}`, `clipped: ${summary.builder?.clipped ?? 0}`]
      if (warnings.length) lines.push(`warnings (fix these):\n${warnings.slice(0, 30).join('\n')}${warnings.length > 30 ? `\n... ${warnings.length - 30} more` : ''}`)
      const stem = nbt.replace(/\.nbt$/, '')
      for (const f of ['.placements.json', '.setup.md']) if (fs.existsSync(stem + f)) lines.push(`setup: ${stem + f}`)
      if (exp) {
        for (const ext of ['schem', 'litematic']) {
          const c = await run('convert.mjs', [nbt, '--out', `${stem}.${ext}`], { heap: 6144 })
          lines.push(c.code === 0 ? `export: ${stem}.${ext}` : `export .${ext} failed: ${(c.err || c.out).slice(-500)}`)
        }
      }
      const content = [text(lines.join('\n'))]
      if (!images) return { content }
      const rdir = path.join(dir, 'renders')
      fs.mkdirSync(rdir, { recursive: true })
      const name = path.basename(stem)
      const png = path.join(rdir, `${name}-iso-se.png`)
      const S = summary.size[0]
      const rr = await run('isorender.mjs', [nbt, '--out', png, '--px', S > 200 ? '2' : S > 130 ? '3' : S > 60 ? '4' : '6'], { heap: 6144 })
      if (rr.code === 0 && fs.existsSync(png)) content.push(text(png), image(png))
      // a spawn: what the player sees on joining
      if (fs.existsSync(path.join(scripts, 'screenshot.mjs')) && fs.existsSync(`${stem}.placements.json`) && fs.readFileSync(`${stem}.placements.json`, 'utf8').includes('"spawn"')) {
        const shot = path.join(rdir, `${name}-spawn-view.png`)
        const sr = await run('screenshot.mjs', [nbt, '--spawn', '--out', shot, '--width', '1280', '--height', '720'], { heap: 6144 })
        if (sr.code === 0 && fs.existsSync(shot)) content.push(text(shot), image(shot))
      }
      return { content }
    },
  },
  {
    name: 'screenshot',
    description: 'First-person screenshots of a build: what a player sees standing in it (CPU renderer, textured, shadows, fog; a few seconds per view). Use it after every build_recipe to check the spawn like a player: from the spawn point (spawn: true), in front of the crates, at the boards, at the plaza rim looking back, at the gate looking out, from high above. Positions are build coordinates (x east, y up, z south); pos [x, z] stands on the ground there. Yaw 0 looks south, 90 west, 180 north, -90 east; pitch > 0 looks down. Returns the images.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'The .nbt/.schem/.litematic (for spawn: true, its .placements.json must sit next to it, as build_recipe writes it)' },
        shots: {
          type: 'array', maxItems: 6,
          description: 'One entry per view, e.g. [{"name":"spawn","spawn":true},{"name":"crates","pos":[80,110],"lookAt":[70,36,110]},{"name":"above","eye":[110,80,190],"yaw":180,"pitch":35}]',
          items: { type: 'object', properties: { name: { type: 'string' }, spawn: { type: 'boolean' }, pos: { type: 'array', items: { type: 'number' }, description: '[x, z] (on the ground) or [x, y, z] (feet block)' }, eye: { type: 'array', items: { type: 'number' }, description: 'exact camera point [x, y, z]' }, lookAt: { type: 'array', items: { type: 'number' } }, yaw: { type: 'number' }, pitch: { type: 'number' }, fov: { type: 'number' } } },
        },
        width: { type: 'integer', description: 'Default 1280' },
        height: { type: 'integer', description: 'Default 720' },
      },
      required: ['file'],
    },
    run: async ({ file, shots, width, height }) => {
      const f = outPath(file)
      if (!fs.existsSync(f)) return fail(`no such file: ${f}`)
      const list = shots?.length ? shots : [{ name: 'spawn-view', spawn: true }]
      const r = await run('screenshot.mjs', [f, '--shots', JSON.stringify(list), ...(width ? ['--width', String(width)] : []), ...(height ? ['--height', String(height)] : [])], { heap: 6144 })
      if (r.code !== 0) return fail(`screenshot failed:\n${(r.err || r.out).slice(-3000)}`)
      const files = r.out.split('\n').map(l => l.split('  (')[0].trim()).filter(l => l.endsWith('.png'))
      const content = []
      for (const [i, png] of files.entries()) {
        const abs = path.resolve(projectDir(), png)
        if (fs.existsSync(abs)) content.push(text(`${r.out.split('\n')[i]}`), image(abs))
      }
      return content.length ? { content } : fail(`no image written:\n${r.out}\n${r.err}`)
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

const ORDER = ['new_spawn', 'build_recipe', 'screenshot', 'render_build', 'inspect_build', 'convert_build', 'spawn_options', 'make_spawn', 'rebuild_spawn']

// ---------------------------------------------------------------- JSON-RPC over stdio
const send = msg => process.stdout.write(`${JSON.stringify(msg)}\n`)
const serverInfo = { name: 'minecraft-builder', version: VERSION }
const INSTRUCTIONS = 'Minecraft builds and server spawns. For a spawn/lobby/hub follow the minecraft-builder skill: interview the user, then build the spawn yourself: new_spawn makes the folder, you write spawn.mjs with the parts and the build guide (references/spawns/build-guide.md), build_recipe builds it, screenshot and render_build show it, you fix and rebuild until it is great, inspect_build lints it, then deliver the .schem/.litematic + setup.md. make_spawn (the generator) only when the user asks for it.'

async function handle(msg) {
  const { id, method, params } = msg
  if (method === 'initialize') {
    const asked = params?.protocolVersion
    return { protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0], capabilities: { tools: { listChanged: false } }, serverInfo, instructions: INSTRUCTIONS }
  }
  if (method === 'server/discover') return { supportedVersions: SUPPORTED, capabilities: { tools: { listChanged: false } }, serverInfo, instructions: INSTRUCTIONS }
  if (method === 'ping') return {}
  // the hand-building tools first, the generator last (it is only for when the user asks for it)
  if (method === 'tools/list') return { tools: [...TOOLS].sort((p, q) => ORDER.indexOf(p.name) - ORDER.indexOf(q.name)).map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) }
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
// a client that closes stdin right after a call still gets the answer: exit once nothing is pending
let pending = 0
let closing = false
const done = () => { if (closing && pending === 0) process.exit(0) }
rl.on('line', async line => {
  if (!line.trim()) return
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })
    return
  }
  pending += 1
  try {
    const result = await handle(msg)
    if (msg.id !== undefined && result !== undefined) send({ jsonrpc: '2.0', id: msg.id, result })
  } catch (err) {
    if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: err.code ?? -32603, message: err.message } })
  } finally {
    pending -= 1
    done()
  }
})
rl.on('close', () => {
  closing = true
  done()
})
log(`ready (v${VERSION}, scripts at ${scripts})`)
