---
name: minecraft-builder-skill
description: Programmatically generate Minecraft builds as vanilla structure NBT files and open Lodestone-powered previews. Use when Codex needs to create, export, inspect, or iterate on Minecraft structures, schematics, block palettes, or build recipes using JavaScript and .nbt output.
---

# Minecraft Builder Skill

## Overview

Create Minecraft builds by writing small JavaScript recipes that use Lodestone-backed helper functions. Export vanilla `.nbt` structure files, then open the included viewer so the user can inspect and iterate on the build.

## Workflow

1. Work from the installed skill directory. Do not rerun `npx` after installation; use this skill's local `scripts/` and `assets/`.
2. Write an ESM recipe file. Use `assets/examples/watchtower.mjs` as the compact pattern.
3. Generate NBT:

```bash
node scripts/run-build.mjs path/to/recipe.mjs --out-dir minecraft-builds/my-build
```

4. Open the preview:

```bash
node scripts/preview.mjs --nbt minecraft-builds/my-build/my-build.nbt
```

5. Iterate by editing the recipe, regenerating the `.nbt`, and reopening or refreshing the preview.

## Recipe Contract

Export a default function that receives `api` and returns either a Lodestone `Structure` or an object with `{ structure, metadata }`.

```js
export default function build(api) {
  const structure = api.createStructure([16, 12, 16])
  api.fill(structure, [0, 0, 0], [15, 0, 15], 'minecraft:stone_bricks')
  api.hollowBox(structure, [4, 1, 4], [11, 7, 11], 'minecraft:spruce_planks')
  return { structure, metadata: { name: 'example-build' } }
}
```

Available helpers include `createStructure`, `setBlock`, `fill`, `hollowBox`, `line`, `sphere`, `cylinder`, `normalizeBlock`, `createBlockNbt`, and Lodestone classes under `api.lodestone`.

## Build Guidance

- Keep all coordinates inside the structure size. The runner validates bounds and fails fast.
- Use vanilla block IDs with the `minecraft:` namespace. Block-state strings like `minecraft:oak_stairs[facing=east,half=bottom,shape=straight]` are supported.
- The runner enables Lodestone's Minecraft-like block state updates by default. Panes, iron bars, and fences get `north/east/south/west` states from neighboring compatible or solid blocks. Use `--no-block-state-updates` only when a recipe intentionally sets those states by hand.
- Prefer clear block palettes and readable geometry. The viewer uses Lodestone's bundled default resource pack, so highly unusual or custom blocks may not preview well.
- Include `metadata.name` to control the output filename. Names are slugified.
- Default output is gzip-compressed vanilla structure NBT with `DataVersion` set by the runner unless overridden.
- For block entities, pass a Lodestone `NbtCompound` as the last argument to `setBlock` or use `api.createBlockNbt({ id: 'minecraft:chest' })`.

## Preview

The preview script starts a minimal Vite server and opens the build automatically. It serves the target `.nbt` and Lodestone's default resource pack through local middleware, so recipes do not need to copy assets.

Use `--no-open` when running in a non-interactive environment:

```bash
node scripts/preview.mjs --nbt path/to/build.nbt --no-open
```
