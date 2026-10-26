---
description: Build a Minecraft server spawn, hub or PvP lobby. Interview first, then generate it with one tool call and deliver the schematic and setup commands.
---

Make a Minecraft server spawn for this request: $ARGUMENTS

Follow the minecraft-builder skill's "Server spawns and lobbies" steps exactly:

1. Call the `spawn_options` tool (this plugin's `minecraft` MCP server) to get the themes, settings,
   NPC ids and recommended sizes.
2. Interview the user with AskUserQuestion in three rounds (round 1: type, size, NPC count, theme;
   round 2: server name, which NPCs, leaderboards, crates; round 3: setting, accent colour, extras,
   where it is pasted). Skip any question the request above already answers. Then show the brief as
   JSON and ask "Build this?".
3. After a yes, call `make_spawn` with the brief. Look at the images it returns.
4. If something looks wrong, change the brief (seed, theme, setting, accent, size) and call
   `make_spawn` again, or add details in the recipe's `after(ctx)` and call `rebuild_spawn`. Run
   `inspect_build` (mode "checks") on the .nbt; only flat-walls and palette-size notes are expected.
5. Deliver: the .schem and .litematic paths, the setup.md (world spawn, NPCs, holograms, crates,
   regions), the paste corner and the world spawn from the report, and the renders.

If the MCP tools are not available, run the same steps with the scripts:
`node "${CLAUDE_PLUGIN_ROOT}/scripts/make-spawn.mjs" brief.json` (see the skill).
