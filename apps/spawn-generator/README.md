# Spawn Generator (browser app)

The plugin's spawn generator (`scripts/lib/spawngen`, the spawn parts and the kit) as one HTML file:
fill in a brief, generate, look at the spawn in 3D, download it.

- **Use it:** open `dist/spawn-generator.html` in Chrome, Edge or Firefox. It works offline; nothing is uploaded.
- **Preview:** Overview, Top, Spawn point (what a player sees on joining) and Fly (drag to look, WASD,
  Space/Shift), day and night, screenshots.
- **Downloads:** a .zip with the `.schem` (WorldEdit/FAWE), `.litematic` (Litematica), `.nbt` (structure
  block), the setup sheet (NPC, hologram, crate and WorldGuard commands), `placements.json` and the brief.
  Opened as a file, each one can also be downloaded on its own.
- **With Claude:** "Copy brief for Claude" gives the brief JSON that `make_spawn` takes, and "Brief as JSON"
  loads one Claude wrote.

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
| `src/worker.js` | runs `generateSpawn`, the export passes and the setup sheet (`scripts/lib/pipeline.mjs`, shared with `run-build.mjs`), writes .nbt/.schem/.litematic and the zip on demand |
| `src/main.js` | boots the worker and the texture pack, generation, results, downloads |
| `src/form.js` | the brief form: state ⇄ brief JSON |
| `src/preview.js` | the 3D view: orbit and first-person cameras, the plugin viewer's lighting |
| `src/results.js` | numbers, warnings, the setup sheet rendered with copy buttons, saving files |
| `src/zip.js` | a small zip writer |

The briefs in `assets/spawn-briefs/` are the "Start from" list.
