# minecraft-builder-skill

Install the Codex skill with:

```bash
npx --yes github:mattzh72/minecraft-builder-skill
```

The installer copies the skill into `$CODEX_HOME/skills/minecraft-builder-skill`, or `~/.codex/skills/minecraft-builder-skill` when `CODEX_HOME` is unset, then installs the Node dependencies used by the NBT generator and Lodestone preview.

After installation, invoke it in Codex with `$minecraft-builder-skill`.

## Examples

- `assets/examples/watchtower.mjs` - compact starter recipe.
- `assets/examples/celestial-observatory.mjs` - large showcase build for demos, README screenshots, and GIFs.

Generate and preview the showcase:

```bash
node scripts/run-build.mjs assets/examples/celestial-observatory.mjs --out-dir minecraft-builds/celestial-observatory
node scripts/preview.mjs --nbt minecraft-builds/celestial-observatory/celestial-observatory.nbt --lighting night
```
