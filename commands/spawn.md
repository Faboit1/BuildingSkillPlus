---
description: Design and build a Minecraft server spawn, hub or PvP lobby by hand. Interview first, plan it, build every element yourself from the manual's do / don't chapters, look at screenshots, fix, then deliver the schematic and setup commands.
---

Make a Minecraft server spawn for this request: $ARGUMENTS

Follow the minecraft-builder skill's "Server spawns and lobbies: build them yourself" steps:

1. **Interview** the user with AskUserQuestion. Skip what the request above already answers. Every
   question has a "Let Claude decide" option, and round 1 has "Surprise me".
   - Round 1: type, size, NPC count, theme.
   - Round 2: server name, which NPCs, leaderboards, crates.
   - Round 3: top-3 statues, warzone (moshpit, KOTH), big things (giant trees, landmarks, raised
     areas and rocks), section signs.
   - Round 4: setting, accent, extras, paste corner.
2. **Plan.** Read the spawn manual `references/spawns/build-guide.md` (§1-§4 first). Write the plan
   into brief.md:
   - the answers and your decisions;
   - the canvas size;
   - every place with its coordinates;
   - a sentence on the design of each element;
   - a top-view sketch.

   Then ask "Build this?".
3. **Scaffold.** After a yes, call `new_spawn` (this plugin's `minecraft` MCP server). It gives
   `spawn.mjs` = the skeleton: the frame and one empty section per element group.
4. **Build every element yourself, section by section.**
   1. Read the element's chapter in manual §5 and its do / don't picture.
   2. Read its worked example in `elements/`.
   3. Write this spawn's own version, designed from the plan and the theme (no two trees, rocks,
      NPC places or buildings alike).
   4. Call `build_recipe` and look at the images it returns before the next section.
5. **Look and fix** (manual §9):
   - `screenshot` from the player's spots (positions from `<slug>.placements.json`);
   - `render_build` close-ups;
   - `inspect_build` (mode "checks");
   - each element compared with its chapter's picture.

   Do at least two rounds of fixes after it is "done". The `spawn-critic` agent can review it.
6. **Deliver** (manual §11): `build_recipe` with `export: true`, `origin` and `world`. Send the .schem
   and .litematic, setup.md, screenshots, the paste corner and the world spawn.

If the MCP tools are not available, use the scripts (`node "${CLAUDE_PLUGIN_ROOT}/scripts/new-spawn.mjs"`,
`run-build.mjs`, `screenshot.mjs`, `isorender.mjs`; see the skill).
