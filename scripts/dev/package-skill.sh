#!/usr/bin/env bash
# Package the skill as a self-contained .skill (a zip of the skill folder) with the minimal runtime
# dependencies bundled, so building, converting, isorender and make-spawn work without npm.
#   bash scripts/dev/package-skill.sh [OUT_DIR]        → OUT_DIR/minecraft-builder-skill.skill
# Needs a full `npm ci` checkout (it copies from node_modules) and zip.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="${1:-$root/dist}"
work="$(mktemp -d)"
skill="$work/minecraft-builder-skill"
mkdir -p "$skill" "$out"
# the committed tree, minus what a skill user never needs
git -C "$root" archive HEAD | tar -x -C "$skill"
rm -rf "$skill/docs/gallery" "$skill/agents" "$skill/.github"
# runtime deps: lodestone and its dependency tree; three is a peer dep, only its module build is used
nm="$skill/node_modules"
for m in @mattzh72/lodestone gl-matrix md5 charenc crypt is-buffer pako; do
  mkdir -p "$nm/$(dirname "$m")"
  cp -R "$root/node_modules/$m" "$nm/$m"
done
mkdir -p "$nm/three/build"
cp "$root/node_modules/three/package.json" "$root/node_modules/three/LICENSE" "$nm/three/"
cp "$root/node_modules/three/build/three.module.js" "$nm/three/build/"
# smoke check from the packaged copy
(cd "$skill" && node scripts/make-spawn.mjs --brief '{"name":"Pack Check","type":"pvp","npcs":3}' --out-dir "$work/check" --no-convert --no-spawn-view --quiet >/dev/null)
rm -rf "$skill/minecraft-builds"
rm -f "$out/minecraft-builder-skill.skill"
(cd "$work" && zip -qr "$out/minecraft-builder-skill.skill" minecraft-builder-skill)
rm -rf "$work"
ls -la "$out/minecraft-builder-skill.skill"
