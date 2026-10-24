# Schematic Formats: Import, Export, and Getting Builds Into the Game

`scripts/convert.mjs` (CLI) and `scripts/lib/formats.mjs` (module) move builds between the formats
players use. Use them to:

- **Import** community schematics so you can study, render and remix them.
- **Export** recipe builds to the formats players paste in game.

Everything converts through a Lodestone `Structure`, so any input can be rendered with
`scripts/render.mjs` or previewed with `scripts/preview.mjs` once it is saved as `.nbt`.

## Supported Formats

| Extension | Format | Read | Write | Used by |
|---|---|---|---|---|
| `.nbt` | Vanilla structure (structure blocks, `/place template`, jigsaw pieces) | yes | yes | Vanilla, data packs |
| `.litematic` | Litematica schematic | yes (all regions merged) | yes (single region) | Litematica mod (Fabric/NeoForge) |
| `.schem` | Sponge Schematic v1, v2, v3 | yes | yes (v2) | WorldEdit, FAWE, Axiom, Amulet |
| `.schematic` | Legacy MCEdit/Schematica (pre-1.13 numeric ids) | yes (converted to modern names) | no | Old downloads (1.12 and earlier) |

The format is detected from the file's contents, not its extension. A `.schematic` that is really a
Sponge file still loads. Bedrock `.mcstructure` files are rejected.

## CLI

```bash
node scripts/convert.mjs <input> --info [--json]
node scripts/convert.mjs <input> --out <output.nbt|.schem|.litematic> [options]
```

| Option | Meaning |
|---|---|
| `--out <file>` | Write the converted build. The extension picks the output format. |
| `--info` | Print format, DataVersion, size, block/state/block-entity counts, top 20 blocks, regions, and notes. Combine with `--out` to do both. |
| `--data-version <n>` | DataVersion to write. Default: the input's own DataVersion (so the game upgrades it), or `3955` (1.21.1) when the input has none (legacy `.schematic`). For legacy input it also picks the block names to emit (for example `short_grass` vs `grass`). |
| `--name <name>` / `--author <name>` | Metadata stored in `.litematic` / `.schem`. The name defaults to the output file name. |
| `--palette <i>` | Vanilla structures with `palettes` (random variants, such as shipwrecks): pick the variant. Default `0`. |
| `--region <name>` | Litematic: load one region instead of merging all of them. |
| `--keep-air` | Keep explicit air blocks. Vanilla structures use air to clear terrain when placed. |
| `--compression gzip\|zlib\|none` | `.nbt` output compression. Default `gzip`. |
| `--json` | Machine-readable summary. |

After writing, the CLI reads its own output back and checks that every non-air block position,
block state and block-entity position matches. If anything differs it fails with
`convert: Output failed round-trip validation`.

### Typical Flows

Study and render a downloaded build:

```bash
node scripts/convert.mjs ~/Downloads/castle.litematic --info
node scripts/convert.mjs ~/Downloads/castle.litematic --out minecraft-builds/castle/castle.nbt
node scripts/render.mjs --nbt minecraft-builds/castle/castle.nbt
```

Export a recipe build for players:

```bash
node scripts/run-build.mjs recipe.mjs --out-dir minecraft-builds/tower
node scripts/convert.mjs minecraft-builds/tower/tower.nbt --out minecraft-builds/tower/tower.schem
node scripts/convert.mjs minecraft-builds/tower/tower.nbt --out minecraft-builds/tower/tower.litematic --author "Your Name"
```

### Remixing an Imported Build in a Recipe

```js
import fs from 'node:fs'
import { readAnyStructure } from '../scripts/lib/formats.mjs' // path relative to your recipe file

export default function build(api) {
  const file = 'downloads/cottage.schem'
  const { structure: cottage } = readAnyStructure(fs.readFileSync(file), file)
  const [w, h, l] = cottage.getSize()
  const out = api.createStructure([w + 10, h + 1, l + 10])
  api.fill(out, [0, 0, 0], [w + 9, 0, l + 9], 'minecraft:polished_andesite')
  for (const { pos: [x, y, z], state, nbt } of cottage.getBlocks()) {
    api.setBlock(out, [x + 5, y + 1, z + 5], state, undefined, nbt)
  }
  return { structure: out, metadata: { name: 'cottage-plaza' } }
}
```

To rotate a copy, transform the positions yourself and remap `facing`, `axis`, `rotation` and
fence/wall sides. Lodestone's `Structure.transform` only moves positions; it does not change states.

## Getting a Build Into the Game

### Vanilla Structure `.nbt` (No Mods)

1. Copy the file to the world's generated-structures folder:
   - Singleplayer: `.minecraft/saves/<world>/generated/minecraft/structures/<name>.nbt`
   - Server: `<server>/<level-name>/generated/minecraft/structures/<name>.nbt`
   - In a data pack instead: `data/<namespace>/structure/<name>.nbt` (1.21+; before 1.21 the folder was `structures`).

   The generated folder is still plural `structures` in 1.21.1. That was checked in the 1.21.1 jar's
   `StructureTemplateManager`: generated templates resolve to `generated/<ns>/structures/`, while
   data-pack resources use `structure`.
2. Place it:
   - `/place template minecraft:<name> ~ ~ ~` (optional args: `[rotation] [mirror] [integrity] [seed]`, for example `/place template minecraft:tower ~ ~ ~ clockwise_90`). It works at any size, but the target area must be loaded.
   - Or use a structure block (`/give @s structure_block`) in **Load** mode. Enter `minecraft:<name>`, press LOAD once to preview the bounding box, then press it again to place.
3. Structure ids must be lowercase `a-z 0-9 _ - . /`. Rename `My Build.nbt` to `my_build.nbt`.
4. Templates are cached once loaded. If you replace the file while the world is running, run `/reload`, which clears the template cache, or rejoin.

### WorldEdit / FAWE `.schem`

1. Copy the file to the schematics folder:
   - Paper/Spigot/Bukkit: `plugins/WorldEdit/schematics/` (FAWE uses `plugins/FastAsyncWorldEdit/schematics/`)
   - Fabric/NeoForge: `config/worldedit/schematics/`
2. Run `//schem load <name>` (or `//schematic load <name>`), optionally `//rotate 90`, then `//paste`. Use `//paste -a` to skip air so the paste doesn't clear existing terrain.
3. Files from `convert.mjs` put the clipboard origin at the build's minimum corner. `//paste` places the build's lowest north-west corner at your feet and builds toward +X, +Y, +Z (east, up, south).

### Litematica `.litematic`

1. Copy the file to `.minecraft/schematics/`.
2. In game, press `M` (Litematica menu), choose *Load Schematics*, select the file, and load it. The placement appears as a hologram at your position. Move or rotate it from *Schematic Placements*.
3. Build it by hand with the hologram as a guide, use Easy Place, or in creative mode on a server that allows it, use Litematica's paste.

## Size Limits

| Method | Limit |
|---|---|
| Structure block (Save/Load) | 48 x 48 x 48 per block. In 1.21.1 the structure block clamps size and offset to 48. Split larger builds or use `/place template`. |
| `/place template` | No size limit, but the target chunks must be loaded. |
| Sponge `.schem` | 65,535 per axis (stored as unsigned shorts). |
| Litematica | No practical limit. |

When the output is `.nbt` and the build is larger than 48 on any axis, `convert.mjs` prints a note.

## DataVersions

Every format stores the Minecraft `DataVersion` it was saved in. The game, WorldEdit and Litematica
use it to run Mojang's DataFixer on older files, which renames blocks and upgrades block-entity
NBT. They never downgrade a newer file. Keep the original DataVersion when converting, which is
the CLI default. Relabelling old content with a newer DataVersion skips those fixes: for example,
1.20.1 `grass` would no longer become `short_grass` in 1.21. This tool does not upgrade or
downgrade block names itself.

| Release | DataVersion |
|---|---|
| 1.12.2 | 1343 |
| 1.13.2 | 1631 |
| 1.16.5 | 2586 |
| 1.17.1 | 2730 |
| 1.18.2 | 2975 |
| 1.19.4 | 3337 |
| 1.20.1 | 3465 |
| 1.20.4 | 3700 |
| 1.20.6 | 3839 |
| 1.21 | 3953 |
| 1.21.1 | **3955** (default) |
| 1.21.4 | 4189 |
| 1.21.5 | 4325 |
| 1.21.8 | 4440 |
| 1.21.10 | 4556 |
| 1.21.11 | 4671 |

The values are from minecraft.wiki (`Module:Protocol_version/Versions`). The full list is
`DATA_VERSIONS` in `scripts/lib/formats.mjs`. `scripts/run-build.mjs` writes `3465` (1.20.1) by
default. Pass `--data-version 3955` there if the build uses 1.21-only blocks.

## Format Details and Caveats

- **Entities** (armor stands, item frames, paintings, mobs) are not supported. They are counted under `Entities` in `--info` and dropped.
- **Block entities** (chests, signs, banners, beds, skulls, spawners and so on) are kept across `.nbt`, `.schem` and `.litematic`. If a block's NBT has no `id`, the writers infer one: `*_sign` becomes `minecraft:sign`, `*_bed` becomes `minecraft:bed`, and other blocks use their own block name. Block-entity NBT is not data-fixed.
- **Air** is dropped on import by default, so renders and block counts show only real blocks. `structure_void` is always dropped, and so is `cave_air`/`void_air` unless you pass `--keep-air`. `.schem` and `.litematic` outputs store air in every empty position, and `//paste` pastes air unless you use `-a`.
- **Vanilla `palettes`**: some structures (shipwrecks, ruined portals, ...) store several random palettes. The first is used unless you pass `--palette <i>`.
- **Jigsaw blocks** are replaced by their `final_state` (often `minecraft:air` or `minecraft:structure_void`, which are then dropped), so jigsaw pieces look as they do after generation.
- **Litematica multi-region**: all regions are merged into one structure using each region's `Position`, including negative `Size` (the region then extends toward negative coordinates from `Position`). If regions overlap, later regions win and their air doesn't overwrite. Output is always one region. Lodestone's own `LitematicLoader` only reads the first region, ignores `Position` and tile entities, and keeps `cave_air`. `formats.mjs` uses its own decoder, which was cross-checked against `LitematicLoader` and a port of Litematica's `LitematicaBitArray`.
- **Litematica writing**: blocks are packed at `max(2, ceil(log2(paletteSize)))` bits per entry, continuously across 64-bit longs, in `y, z, x` order, with air at palette index 0. The file is written as `Version` 7 for DataVersion 3837 (1.20.5) and newer, matching Litematica for 1.20.5+/1.21.x, and as `Version` 6 for older DataVersions. Litematica for 1.20.4 and earlier rejects version 7. `SubVersion` is 1.
- **Sponge writing**: v2 with root tag `Schematic`, a varint `BlockData` in `x + z*W + y*W*L` order, `PaletteMax`, `BlockEntities` (`Id`, `Pos`, flattened data), `Offset [0,0,0]` and `Metadata.WEOffsetX/Y/Z = 0`. WorldEdit 7.x and FAWE read it. v3 files are read but not written.
- **Rotation/mirroring** is not applied during conversion. Use `/place template ... <rotation> <mirror>`, `//rotate`, Litematica's placement settings, or remap states in a recipe.
- **Legacy `.schematic` (MCEdit/Schematica)**:
  - A built-in table maps 1.12 ids 0-255 and their data values to 1.21 block states. That covers colors, wood types, stone variants, slabs (top/bottom/double), stairs facing/half, logs and pillars by axis, doors (both halves combined), beds, torches, rails, buttons, levers, glazed terracotta, shulker boxes and so on. Every emitted name was checked against the 1.21.1 block list.
  - `--info` reports coverage (the percentage of non-air blocks converted) and lists unknown ids, which are skipped. Modded ids are named from the file's `SchematicaMapping`/`BlockIDs` when present.
  - Fence and pane connections are recomputed with Lodestone `updateBlockStates()`. Stair `shape` stays `straight`, and wall connections and redstone wiring sides are not derived.
  - Leaves are imported as `persistent=true` so pasted trees don't decay.
  - Tile-entity contents (chest items, sign text, spawner data) are dropped. Tile entities are still used to choose bed and banner colors, skull types and potted plants.
- **Version mismatches**: a 1.21-only block (for example `minecraft:crafter`) cannot be loaded in an older game. Check the DataVersion in `--info` before targeting an older server.

## Module API (`scripts/lib/formats.mjs`)

```js
import {
  readAnyStructure, writeStructureNbt, writeSpongeSchem, writeLitematic, writeStructure,
  summarizeStructure, detectFormat, parseStateString, blockEntityIdFor,
  DATA_VERSIONS, DEFAULT_DATA_VERSION,
} from './lib/formats.mjs'
```

- `readAnyStructure(bytes, filename?, options?)` returns `{ structure, format, dataVersion, meta }`.
  - `format`: `'structure-nbt' | 'litematic' | 'sponge-v1' | 'sponge-v2' | 'sponge-v3' | 'mcedit'`.
  - `dataVersion`: the file's DataVersion. It is `undefined` for legacy `.schematic` and `1631` (assumed, as WorldEdit does) for Sponge v1.
  - `options`: `paletteIndex`, `keepAir`, `region` (litematic), and `targetDataVersion` (legacy name choice, default `3955`).
  - `meta`: `name`, `author`, `description`, `formatVersion`, `regions[]` (`{ name, origin, size, blocks }`), `blockEntities`, `entities` (count, not imported), `dropped` (`{ air, structureVoid }`), `palettes`, `jigsawsReplaced`, `legacy` (coverage report), `warnings[]`.
- `writeStructureNbt(structure, { dataVersion = 3955, compression = 'gzip' })` returns bytes. It wraps Lodestone's `writeNbt`.
- `writeSpongeSchem(structure, { dataVersion = 3955, name?, author? })` returns gzip bytes (Sponge v2).
- `writeLitematic(structure, { name, author, description?, dataVersion = 3955, regionName?, version? })` returns gzip bytes (one region at `Position 0,0,0`).
- `writeStructure(structure, 'nbt' | 'schem' | 'litematic', options)` dispatches by format.
- `summarizeStructure(structure, { top = 20 })` returns `{ size, blockCount, blockEntities, stateCount, blockIdCount, top: [{ name, count }] }`.
