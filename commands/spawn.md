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
2. Read `references/spawns/build-guide.md` and the closest example in `assets/examples/spawns/`.
   Write the plan (answers, your decisions, canvas size, a top-view sketch with the main numbers)
   and ask "Build this?".
3. After a yes: `new_spawn` (this plugin's `minecraft` MCP server), then write `spawn.mjs` section
   by section, calling `build_recipe` after each and looking at the images it returns.
4. Look and fix: `screenshot` from the player's spots, `render_build` close-ups, `inspect_build`
   (mode "checks"); at least two rounds of fixes after it is "done". The `spawn-critic` agent can
   review it.
5. Deliver: `build_recipe` with `export: true`; the .schem and .litematic, setup.md, screenshots,
   the paste corner and the world spawn.

Only if the user asks for the quick generator: `make_spawn` with a brief (see the skill).
If the MCP tools are not available, use the scripts (`node "${CLAUDE_PLUGIN_ROOT}/scripts/new-spawn.mjs"`,
`run-build.mjs`, `screenshot.mjs`, `isorender.mjs`; see the skill).
