#!/usr/bin/env bash
# Package the plugin as a zip for Claude Cowork / claude.ai (Customize > Plugins > Add > Upload plugin)
# or for sharing: .claude-plugin/plugin.json at the zip root, the bundled runtime dependency included,
# no install needed. Claude Code users install from the marketplace in this repo instead.
#   bash scripts/dev/package-plugin.sh [OUT_DIR]        → OUT_DIR/minecraft-builder-plugin.zip
# Packages the committed tree (HEAD); needs git, zip and node.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="$(mkdir -p "${1:-$root/dist}" && cd "${1:-$root/dist}" && pwd)"
work="$(mktemp -d)"
plugin="$work/minecraft-builder"
mkdir -p "$plugin"
git -C "$root" archive HEAD | tar -x -C "$plugin"
# what a plugin user never needs: the README gallery and the dev-only Codex metadata
rm -rf "$plugin/docs/gallery" "$plugin/.github"
# smoke check from the packaged copy (no root node_modules there: only the bundled one)
(cd "$work" && node "$plugin/scripts/make-spawn.mjs" --brief '{"name":"Pack Check","type":"pvp","npcs":3}' --out-dir "$work/check" --no-convert --no-render --quiet >/dev/null)
# and the hand-built path: a scaffolded spawn folder builds, and it can be photographed
(cd "$work" && node "$plugin/scripts/new-spawn.mjs" "Pack Hand" --out-dir "$work/hand" >/dev/null \
  && node --max-old-space-size=4096 "$plugin/scripts/run-build.mjs" "$work/hand/spawn.mjs" --out-dir "$work/hand" --json >/dev/null \
  && node "$plugin/scripts/screenshot.mjs" "$work/hand/pack-hand.nbt" --spawn --width 320 --height 180 --out "$work/hand/shot.png" >/dev/null 2>&1)
if command -v claude >/dev/null 2>&1; then claude plugin validate "$plugin" >/dev/null; fi
# plugin uploads reject paths with anything but letters, digits, dot, dash, underscore and slash
bad="$(cd "$plugin" && find . -mindepth 1 | sed 's|^\./||' | grep -E '[^A-Za-z0-9._/-]' || true)"
if [ -n "$bad" ]; then echo "package-plugin: paths with characters uploads reject:"; echo "$bad" | head; exit 1; fi
rm -f "$out/minecraft-builder-plugin.zip"
(cd "$plugin" && zip -qr "$out/minecraft-builder-plugin.zip" .)
rm -rf "$work"
ls -la "$out/minecraft-builder-plugin.zip"
