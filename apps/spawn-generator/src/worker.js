// The generator, in a Web Worker: the same code as scripts/make-spawn.mjs (spawngen + the spawn
// parts + the kit + Lodestone), so the page stays responsive while a spawn builds. Messages:
//   init     { files }            the data files the kit reads (see shims/fs.js)
//   options  {}                   what the brief form can offer: types, themes, NPCs, landmarks
//   resolve  { brief }            the brief with every default filled in (size, NPC list...)
//   generate { brief }            builds the spawn; replies with the preview blocks and the setup
//   export   { formats }          the .nbt/.schem/.litematic of the last spawn, and the zip

import { createApi, fillDefaultStates, setupSheet, summarize, updateStructureConnections, worldPlacements } from '../../../scripts/lib/pipeline.mjs'
import { generateSpawn, resolveBrief } from '../../../scripts/lib/spawngen/index.mjs'
import { TYPES, NPC_LABELS, LANDMARK_KINDS } from '../../../scripts/lib/spawngen/brief.mjs'
import { THEMES } from '../../../assets/spawn-parts/themes.mjs'
import { writeLitematic, writeSpongeSchem } from '../../../scripts/lib/formats.mjs'
import { colorOf } from '../../../scripts/lib/kit/colors.mjs'
import { material } from '../../../scripts/lib/kit/materials.mjs'
import { zip } from './zip.js'

globalThis.process ??= { env: {} }
globalThis.Buffer ??= { from: (b, o, l) => (b instanceof ArrayBuffer ? new Uint8Array(b, o, l) : new Uint8Array(b)) }

const DATA_VERSION = 3955 // Java 1.21.1, as run-build writes
let last = null

const post = (msg, transfer = []) => self.postMessage(msg, transfer)

self.onmessage = event => {
  const msg = event.data
  try {
    const out = HANDLERS[msg.type](msg)
    if (out) post({ id: msg.id, ok: true, ...out.msg }, out.transfer ?? [])
  } catch (err) {
    post({ id: msg.id, ok: false, error: err?.message ?? String(err), stack: err?.stack })
  }
}

const hexOf = id => {
  try {
    return colorOf(id)?.side ?? null
  } catch {
    return null
  }
}
const heaviest = weights => (typeof weights === 'string' ? weights : Object.entries(weights ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0])

const HANDLERS = {
  init({ files }) {
    globalThis.__MCB_FILES = files
    return { msg: {} }
  },

  options() {
    const types = {}
    for (const [key, T] of Object.entries(TYPES)) {
      const full = resolveBrief({ type: key, npcs: 30 }).brief
      const base = resolveBrief({ type: key }).brief
      types[key] = {
        ...T,
        npcIds: full.npcs.filter(n => !n.id.startsWith('spare')).map(n => n.id),
        defaultNpcs: base.npcs.map(n => n.id),
        boards: base.leaderboards.map(b => b.label),
        crates: base.crates.length,
        features: base.features,
        recommended: Object.fromEntries([4, 6, 8, 10, 12, 14, 16, 20, 24, 30].map(n => [n, resolveBrief({ type: key, npcs: n }).brief.size])),
      }
    }
    const themes = Object.entries(THEMES).map(([key, t]) => {
      const roof = (() => {
        try {
          return material(t.roof)?.block ?? t.roof
        } catch {
          return t.roof
        }
      })()
      return {
        key,
        label: t.label,
        setting: t.setting,
        accent: t.accent,
        swatch: [heaviest(t.ground), heaviest(t.paving?.field), t.kit?.primary, roof, `${t.accent}_concrete`].map(id => (id ? hexOf(id) : null)),
        trees: t.trees?.feature,
      }
    })
    return { msg: { types, themes, npcLabels: NPC_LABELS, landmarks: LANDMARK_KINDS } }
  },

  resolve({ brief }) {
    const { brief: full, warnings } = resolveBrief(brief)
    return { msg: { brief: full, warnings } }
  },

  generate({ id, brief: raw }) {
    const t0 = performance.now()
    post({ id, progress: 'generate' })
    const result = generateSpawn(createApi(), raw)
    const t1 = performance.now()
    post({ id, progress: 'finish' })
    const structure = result.structure
    const metadata = result.metadata ?? {}
    fillDefaultStates(structure)
    if (metadata.blockStatesUpdated !== true) updateStructureConnections(structure)
    const brief = metadata.spawngen?.brief ?? resolveBrief(raw).brief
    const size = structure.getSize()
    const name = brief.slug
    const list = worldPlacements(Array.isArray(metadata.placements) ? metadata.placements : [], brief.origin)
    const setupMd = setupSheet({ name, origin: brief.origin, world: brief.world, size, placements: list, changeHint: 'the generator\'s *Paste corner* and *World* fields change both' })
    const placementsJson = `${JSON.stringify({
      name,
      size,
      origin: brief.origin,
      world: brief.world,
      note: 'local = structure coordinates (minimum corner 0,0,0); world = origin + local. npc pos = the block the feet are in; hologram/anchor = hologram location (top line); crate pos = the crate block; portal and region min/max = inclusive block corners.',
      placements: list,
    }, null, 2)}\n`
    const report = metadata.builderReport ?? {}
    const warnings = [
      ...(metadata.spawngen?.warnings ?? []),
      ...(report.problems ?? []).map(p => `invalid block: ${typeof p === 'string' ? p : JSON.stringify(p)}`),
    ]
    last = { structure, brief, setupMd, placementsJson }

    // the preview: the palette once, then three coordinates and a palette index per block
    const palette = structure.palette.map(s => ({ name: s.getName().toString(), props: s.getProperties() }))
    const blocks = structure.blocks
    const pos = new Uint16Array(blocks.length * 3)
    const state = new Uint16Array(blocks.length)
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      pos[i * 3] = b.pos[0]
      pos[i * 3 + 1] = b.pos[1]
      pos[i * 3 + 2] = b.pos[2]
      state[i] = b.state
    }
    const counts = {}
    for (const p of list) counts[p.type === 'npc' && p.role === 'statue' ? 'statue' : p.type] = (counts[p.type === 'npc' && p.role === 'statue' ? 'statue' : p.type] ?? 0) + 1
    const spawn = list.find(p => p.type === 'spawn') ?? null
    const stats = { ...summarize(structure), seconds: (t1 - t0) / 1000, counts, floorY: metadata.spawngen?.floorY ?? null }
    return {
      msg: { brief, warnings, stats, setupMd, placementsJson, spawn, preview: { size, palette, pos, state } },
      transfer: [pos.buffer, state.buffer],
    }
  },

  export({ id, formats = ['nbt', 'schem', 'litematic', 'zip'] }) {
    if (!last) throw new Error('Generate a spawn first')
    const { structure, brief, setupMd, placementsJson } = last
    const slug = brief.slug
    const out = {}
    if (formats.includes('nbt') || formats.includes('zip')) {
      post({ id, progress: 'nbt' })
      out.nbt = structure.writeNbt({ name: '', dataVersion: DATA_VERSION, compression: 'gzip' })
    }
    if (formats.includes('schem') || formats.includes('zip')) {
      post({ id, progress: 'schem' })
      out.schem = writeSpongeSchem(structure, { dataVersion: DATA_VERSION, name: brief.name })
    }
    if (formats.includes('litematic') || formats.includes('zip')) {
      post({ id, progress: 'litematic' })
      out.litematic = writeLitematic(structure, { dataVersion: DATA_VERSION, name: brief.name })
    }
    if (formats.includes('zip')) {
      post({ id, progress: 'zip' })
      const readme = readmeFor(brief, structure.getSize())
      out.zip = zip([
        { name: `${slug}/README.txt`, data: readme },
        { name: `${slug}/${slug}.schem`, data: out.schem, store: true },
        { name: `${slug}/${slug}.litematic`, data: out.litematic, store: true },
        { name: `${slug}/${slug}.nbt`, data: out.nbt, store: true },
        { name: `${slug}/${slug}.setup.md`, data: setupMd },
        { name: `${slug}/${slug}.placements.json`, data: placementsJson },
        { name: `${slug}/${slug}.brief.json`, data: `${JSON.stringify(briefForFile(brief), null, 2)}\n` },
      ])
    }
    const msg = {}
    const transfer = []
    for (const k of formats) {
      if (!out[k]) continue
      const copy = out[k].slice()
      msg[k] = copy
      transfer.push(copy.buffer)
    }
    return { msg, transfer }
  },
}

// the brief as a user would write it (what make_spawn and make-spawn.mjs take back)
function briefForFile(brief) {
  const { slug, ...rest } = brief
  return rest
}

function readmeFor(brief, size) {
  const [x, y, z] = size
  return `${brief.name}: a ${brief.type === 'plus' ? 'spawn+' : brief.type === 'pvp' ? 'PvP lobby' : 'spawn'} made with the minecraft-builder spawn generator.

Size: ${x} x ${y} x ${z} blocks. Minecraft Java 1.21.1 data (newer versions upgrade it on load).

Files
  ${brief.slug}.schem        WorldEdit / FAWE: put it in plugins/WorldEdit/schematics, run
                             //schem load ${brief.slug}, stand on the spot where the minimum
                             (north-west, bottom) corner goes and //paste   (//paste -a skips air)
  ${brief.slug}.litematic    Litematica (client mod): copy it into .minecraft/schematics
  ${brief.slug}.nbt          vanilla structure block / /place template (datapack: data/<ns>/structure/)
  ${brief.slug}.setup.md     every NPC, hologram, crate, portal and WorldGuard region, with the
                             plugin commands (Citizens, FancyNpcs, DecentHolograms, ExcellentCrates,
                             CrazyCrates, WorldEdit, WorldGuard) in world coordinates
  ${brief.slug}.placements.json   the same positions as data
  ${brief.slug}.brief.json   the brief: open it in the generator again, or give it to Claude
                             (minecraft-builder make_spawn) to rebuild or change this spawn

The setup sheet assumes the minimum corner is pasted at ${brief.origin.join(' ')} in world "${brief.world}".
Paste somewhere else? Change "Paste corner" in the generator (or the brief's origin) and download again.
`
}
