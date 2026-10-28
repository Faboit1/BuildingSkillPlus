# Spawn Generator (browser app)

A one-click spawn generator as one HTML file: fill in a brief, generate, look at the spawn in 3D,
download it. Not part of the plugin (the plugin has no generator: Claude builds every spawn by hand);
its engine, `spawngen/`, runs on the plugin's spawn parts and kit.

- **Use it:** open `dist/spawn-generator.html` in Chrome, Edge or Firefox. It works offline; nothing is uploaded.
- **Preview:** Overview, Top, Spawn point (what a player sees on joining) and Fly (drag to look, WASD,
  Space/Shift), day and night, screenshots.
- **Downloads:** a .zip with the `.schem` (WorldEdit/FAWE), `.litematic` (Litematica), `.nbt` (structure
  block), the setup sheet (NPC, hologram, crate and WorldGuard commands), `placements.json` and the brief.
  Opened as a file, each one can also be downloaded on its own.
- **With Claude:** "Copy brief for Claude" gives the brief as JSON (paste it as the interview answers for a
  hand-built version), and "Brief as JSON" loads one.

## Build

```
node apps/spawn-generator/build.mjs
```

It writes `dist/spawn-generator.html`, a full page, and `dist/spawn-generator.artifact.html`, the same page
without the document skeleton for a claude.ai Artifact. The build makes two bundles with rolldown: the
worker, which is the generator, and the page, which holds the form, the Lodestone/three.js preview and the
downloads. The page carries the worker and the data files inline. Node built-ins resolve to the shims in
`src/shims`, and every module gets a `file:///<path in the plugin>` `import.meta.url`, so the kit's data
reads land on the embedded files.

| file | what it does |
| --- | --- |
| `spawngen/` | the generator: the brief, the three layouts (normal, spawn+, PvP), the warzone |
| `briefs/` | the "Start from" briefs |
| `test.mjs` | `npm run test:generator`: every type and theme builds, and the page builds |
| `src/worker.js` | runs `generateSpawn`, the export passes and the setup sheet (`scripts/lib/pipeline.mjs`, shared with `run-build.mjs`), writes .nbt/.schem/.litematic and the zip on demand |
| `src/main.js` | boots the worker and the texture pack, generation, results, downloads |
| `src/form.js` | the brief form: state ⇄ brief JSON |
| `src/preview.js` | the 3D view: orbit and first-person cameras, the plugin viewer's lighting |
| `src/results.js` | numbers, warnings, the setup sheet rendered with copy buttons, saving files |
| `src/zip.js` | a small zip writer |

