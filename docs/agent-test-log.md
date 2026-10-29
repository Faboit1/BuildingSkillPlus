# Agent test log: what the builders got wrong, and what changed in the plugin

How the plugin was tested: fresh agents (Haiku and Sonnet at high, xhigh and max effort), each
with a clean copy of the packaged plugin and a user's request with the interview already answered,
built whole spawns. A reviewer looked at every render like a demanding user, sent corrections, and
wrote down each correction here. Each correction became a rule, a check or a tool in the plugin, so
the next agent does not need it.

## Round 0: what the user saw (plugin 2.0.0)

| # | What was wrong | Correction | Fixed in the plugin by |
| --- | --- | --- | --- |
| U1 | The terrain looked fake: much worse than the manual's element pictures | "The land is a landscape, not a flat island with blobs on it" | `b.land`: a heightfield with landforms (ranges with spurs, peaks, valleys, pads), hydraulic and thermal erosion, a map preview, painting by slope, height and wetness; manual §5.1 rewritten around it, with a picture |
| U2 | Corners cut everywhere; the build did the least, not the most | "Every district gets its full element list; no section left as a stub" | (see the rounds below) |
| U3 | Bridges and other things straight and flat, "like a 5 year old built it" | "A bridge is arches on piers with a humped deck; roads and walls follow the land and curve" | (see the rounds below) |

## Round 1: first deliveries (plugin 2.0.0)

| Agent | Brief | Builds | Time | Review loop | Critic |
| --- | --- | --- | --- | --- | --- |
| Haiku, high | Driftwood: surprise me, coast with a harbour, 1100 | 4 | 25 min | none | not run |
| Haiku, high | Cheese SMP: normal, autumn valley, 10 NPCs, 1000 | 9 | 28 min | none | not run |

Both delivered a flat green disc with things set on it. What I had to correct (both agents unless noted):

| # | What was wrong | Correction sent |
| --- | --- | --- |
| C1 | Stopped after 4-9 builds, no district loop, no critic, though the skill asks for 40-100 builds and a critic pass | "Cook until perfect: focus drafts per district, 3+ look-and-fix rounds, the critic until nothing above minor; log each round in brief.md" |
| C2 | 70-80% of the island is bare flat lawn; mountains are separate blobs standing on the flat like islands | "A landscape: one range round the rim with foothills, rolling ground, woods over a third to half of the open land, meadows, rocks; no bare patch over 40 x 40" |
| C3 | Town = near-identical houses dropped on the grass, no streets | "Streets first (5-9 wide, curving), buildings shoulder to shoulder along them, 3+ feature buildings 25-50 long, yards and gardens" |
| C4 | Roads thin straight dirt lines; river a canal of one width ending in a round pond | "Roads 5-9 wide that curve and follow the land; river 8-20 wide with banks and plants; natural lake; arch bridges" |
| C5 | Plaza a flat grey/black square (magenta lines on Cheese SMP, whose accent is yellow) | "The grid plaza with borders, kerb, planters, lamps; the accent colour only" |
| C6 | Hero: a striped cylinder with a cone (Driftwood); a castle on a plain grey cube (Cheese SMP) | "A real keep 60-90 tall; a castle on a crag" |
| C7 | Town wall a perfect circle with ~80 identical cone towers (Cheese SMP) | "The wall follows the land; towers every 40-60 in 3-4 designs; designed gatehouses" |
| C8 | Warzone red lines ruled straight across the whole island (Driftwood) | "The PvP band in the outer ring only, its border following the land" |
| C9 | "Coast with a harbour" built as a round pond with three piers (Driftwood) | "A sea coast on one side, a bay, beaches and cliffs, quays, piers, boats, the lighthouse on a headland" |
| C10 | 10-12 NPCs on one ring, 13-17 apart | "Stands 6-8 apart: a tighter ring or two rings" |
| C11 | Autumn shown only by three giant trees (Cheese SMP) | "Autumn crowns on part of the forest, autumn ground, pumpkins and hay" |

Bugs and gaps the agents reported in the plugin:

| # | Problem | Fixed by |
| --- | --- | --- |
| B1 | The stone-brick material family builds `stone_bricks_stairs` (no such block): walls, gates, halls, houses and crates hit it by default | |
| B2 | `boardRecess` builds `chiseled_${stone}s`, invalid for `deepslate_brick` | |
| B3 | The giant-tree leaf palette adds `persistent` to non-leaf blocks, so autumn mixes fail | |
| B4 | The island example's default underside (0.75 x radius) runs below y 0 on a 200-high canvas | |
| B5 | The skeleton calls `b.spawnPoint` and the dais places the spawn too: a duplicate warning | |
| B6 | Problem messages do not say where the bad block is | |
| B7 | The `dark` theme alias in the parts library means crimson (nether) | |
| B8 | A river whose source is off the island clips silently | |
| B9 | Choosing screenshot spots is slow without a map with coordinates | |
| B10 | The MCP-first wording in the skill needs a clear fallback when the tools are missing | |
