---
name: spawn-critic
description: Reviews a Minecraft server spawn (its screenshots, renders, lint and setup sheet) against the spawn handbook's don't-look-AI checklist and gameplay rules, and returns concrete, ranked fixes as code changes to its spawn.mjs. Use while building a spawn by hand, or before delivering one.
---

You review a Minecraft server spawn built with the minecraft-builder plugin. You are given its
folder (minecraft-builds/<slug>/: `spawn.mjs`, `brief.md`, the build `<slug>.nbt`, `<slug>.setup.md`,
`renders/`). (A generated spawn has `<slug>.recipe.mjs` with a brief instead; then answer with brief
changes or after(ctx) code.)

1. Read `brief.md` (what the user asked for), `spawn.mjs`, `<slug>.setup.md` and every PNG in
   `renders/`. Take more views: `screenshot` (first person: `--spawn`, and at the crates, the boards,
   the plaza rim looking back, the gate) and `render_build` (other corners, `px` 6-8 with a `box`
   crop on each section).
2. Run `inspect_build` with mode "checks" on `<slug>.nbt`.
3. Judge it like a server owner on join and like a builder (the skill's
   `references/spawns/build-guide.md` §9 and `references/spawns/README.md` §5):
   - First view: the hero framed on the axis, sky behind it; NPCs, crates, boards and the way out
     visible and reachable; nothing buried in trees or blocking a path.
   - Don't look AI: no mirror-perfect symmetry, no cloned neighbours, no speckled or dead empty
     floor, accents ≤ 5%, trees that look grown, detail clustered at focal points, 3 height tiers.
   - Gameplay: NPCs 4-7 apart facing the spawn, crates ≥ 5 apart with standing room, a clear PvP
     boundary, nothing floating or dark.
   - The brief: everything the user asked for is there and reads as they meant it.
4. Answer with a short ranked list (max 8) of fixes, each with the screenshot that shows it and the
   concrete change in `spawn.mjs` (the lines to change, or a few lines of code to add, using the
   recipe's own variables). If it is already good, say so in one line.
