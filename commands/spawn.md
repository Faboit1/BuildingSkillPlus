---
description: Design and build a Minecraft server spawn, hub or PvP lobby by hand. Interview first, plan it, build every element yourself from the manual's do / don't chapters, look at screenshots, fix, then deliver the schematic and setup commands.
---

Make a Minecraft server spawn for this request: $ARGUMENTS

Follow the minecraft-builder skill's "Server spawns and lobbies: build them yourself" steps:

1. **Interview** the user with AskUserQuestion. Skip what the request above already answers. Every
   question has a "Let Claude decide" option, and round 1 has "Surprise me".
   - Round 1: type, size, NPC count, theme.
   - Round 2: server name, which NPCs, leaderboards, crates.
   - Round 3: top-3 pillars, warzone (moshpit, KOTH), big things (mountains, rivers and lakes with
     bridges, town walls, giant trees, landmarks), section signs.
   - Round 4: setting, accent, extras, paste corner.
2. **Plan.** Read the spawn manual `references/spawns/build-guide.md` (§1-§4 first). Write the plan
   into brief.md:
   - the answers and your decisions;
   - the canvas size (1000 by default: spawns are big, a compact centre in a town and a landscape);
   - the districts with their feature buildings, the hero, the land, the roads and bridges;
   - every place with its coordinates;
   - a sentence on the design of each element;
   - a top-view sketch.

   Then ask "Build this?".
3. **Scaffold.** After a yes, call `new_spawn` (this plugin's `minecraft` MCP server). It gives
   `spawn.mjs` = the skeleton: the frame and one empty section per element group.
4. **Build every element yourself, district by district, and cook until it is perfect** (manual
   §2.1-§2.2: take the builds and tokens it needs; do the most, not the least; never skip a check).
   1. Read the element's chapter in manual §5 and its do / don't picture.
   2. Read its worked example in `elements/`.
   3. Write this spawn's own version, designed from the plan and the theme, at the sizes of manual
      §1.2 (no two trees, rocks, NPC stands or buildings alike).
   4. Draft the district with `build_recipe`'s `focus`, look at the images, list every flaw, fix,
      repeat until a round finds nothing (3 rounds at least).
5. **Look and fix** (manual §9):
   - `screenshot` from the player's spots (positions from `<slug>.placements.json`);
   - `render_build` close-ups;
   - `inspect_build` (mode "checks");
   - each element compared with its chapter's picture.

   Run the `spawn-critic` agent after every district and at the end, until it finds nothing above
   minor; deliver only when the quality gate of manual §2.3 passes.
6. **Deliver** (manual §11): `build_recipe` with `export: true`, `origin` and `world`. Send the .schem
   and .litematic, setup.md, screenshots, the paste corner and the world spawn.

If the MCP tools are not available, use the scripts (`node "${CLAUDE_PLUGIN_ROOT}/scripts/new-spawn.mjs"`,
`run-build.mjs`, `screenshot.mjs`, `isorender.mjs`; see the skill).
