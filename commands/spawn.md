---
description: Design and build a Minecraft server spawn, hub or PvP lobby by hand. Interview first, plan it, build it with the spawn parts, look at screenshots, fix, then deliver the schematic and setup commands.
---

Make a Minecraft server spawn for this request: $ARGUMENTS

Follow the minecraft-builder skill's "Server spawns and lobbies: build them yourself" steps:

1. Interview the user with AskUserQuestion (skip what the request above already answers). Every
   question has a "Let Claude decide" option; round 1 has "Surprise me". Round 1: type, size, NPC
   count, theme. Round 2: server name, which NPCs, leaderboards, crates. Round 3: top-3 pillars,
   warzone (moshpit, KOTH), big things (giant trees, landmarks, raised areas and rocks), section
   signs. Round 4: setting, accent, extras, paste corner, sign outline/thickness.
2. Read the spawn manual `references/spawns/build-guide.md` (§1-§4 first). Write the plan into
   brief.md (answers, your decisions, which BRIEF field or CUSTOM piece each answer becomes, canvas
   size, a top-view sketch with the main numbers) and ask "Build this?".
3. After a yes: `new_spawn` with the type (this plugin's `minecraft` MCP server) gives `spawn.mjs`
   = that type's template (a tested layout). Set its `BRIEF` block to the answers and
   `build_recipe` it: that is the base. Then make it theirs in its `CUSTOM`
   block (manual §4.3-§4.4, the cookbook §8), calling `build_recipe` after each change and looking at
   the images it returns.
4. Look and fix (manual §10): `screenshot` from the player's spots (positions from
   `<slug>.placements.json`), `render_build` close-ups, `inspect_build` (mode "checks"); at least two
   rounds of fixes after it is "done". The `spawn-critic` agent can review it.
5. Deliver (manual §12): `build_recipe` with `export: true`, `origin` and `world`; the .schem and
   .litematic, setup.md, screenshots, the paste corner and the world spawn.

If the MCP tools are not available, use the scripts (`node "${CLAUDE_PLUGIN_ROOT}/scripts/new-spawn.mjs"`,
`run-build.mjs`, `screenshot.mjs`, `isorender.mjs`; see the skill).
