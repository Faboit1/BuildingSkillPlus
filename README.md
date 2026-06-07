# Minecraft Builder Skill

Reusable skill for programmatic Minecraft builds. Generate JavaScript recipes, export vanilla structure `.nbt` files, and preview builds in a clean Lodestone-powered viewer.

## Install

Requires Node.js 20.19 or newer.

Default install:

```bash
npx --yes github:mattzh72/minecraft-builder-skill
```

This installs to the default skills directory configured by your environment.

Custom skills directory:

```bash
npx --yes github:mattzh72/minecraft-builder-skill install --target /path/to/skills
```

That creates `/path/to/skills/minecraft-builder-skill`.

## Use

Use the installed skill in any compatible environment:

```text
Use minecraft-builder-skill to make a floating crystal observatory, export the .nbt file, and open a night-mode preview.
```

If direct skill mentions are supported, `$minecraft-builder-skill` works too.

## Try The Showcase

From the installed skill directory:

```bash
cd /path/to/skills/minecraft-builder-skill
node scripts/run-build.mjs assets/examples/celestial-observatory.mjs --out-dir minecraft-builds/celestial-observatory
node scripts/preview.mjs --nbt minecraft-builds/celestial-observatory/celestial-observatory.nbt --lighting night
```

Drag to orbit. Scroll to zoom. Use the lighting button to switch day/night.

## Make Your Own

Start from `assets/examples/watchtower.mjs` for a small recipe, or `assets/examples/celestial-observatory.mjs` for a full showcase.

```bash
node scripts/run-build.mjs path/to/recipe.mjs --out-dir minecraft-builds/my-build
node scripts/preview.mjs --nbt minecraft-builds/my-build/my-build.nbt
```

The runner validates bounds, writes gzip-compressed vanilla structure NBT, and updates Minecraft-style connections for panes, iron bars, and fences by default.
