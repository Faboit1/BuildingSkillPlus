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
if command -v claude >/dev/null 2>&1; then claude plugin validate "$plugin" >/dev/null; fi
rm -f "$out/minecraft-builder-plugin.zip"
(cd "$plugin" && zip -qr "$out/minecraft-builder-plugin.zip" .)
rm -rf "$work"
ls -la "$out/minecraft-builder-plugin.zip"
