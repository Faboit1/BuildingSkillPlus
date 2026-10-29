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

## Round 2-3 (the same two Haiku agents, corrected)

Both got much better with the corrections (a ridge with foothills, woods, curving streets, a
coast), but kept two habits and made new mistakes:

| # | What was wrong | Correction sent |
| --- | --- | --- |
| C12 | Stopped after 6-10 builds each round to ask "should I carry on?" or with a list of open items | "Don't stop to ask; work the list until the gate passes" |
| C13 | Took player screenshots and did not look at them | "Read every PNG you take; one not looked at is not a check" |
| C14 | Ground speckled with single coarse-dirt dots and sand blobs far from water | "Plain grass with large soft patches; sand only at water" |
| C15 | Mountains rebuilt as two long straight walls with flat tops and striped slopes (Cheese SMP) | "Joined massifs along a curve, peaks and saddles, spurs, nothing straight for more than 7" |
| C16 | Woods overcorrected to 70% of the island in one uniform orange blanket | "35-45%, meadows and fields between, half the oaks green, birches yellow, spruces green" |
| C17 | Trees small with 1-wide trunks | "Feature trees 20-30 with 3-5 wide trunks of all-bark wood" (also the user's own request) |
| C18 | The harbour a straight canal; the sea a walled plate hanging off the island (Driftwood) | "A natural inlet; water held by the land's own rock; no straight walls" |
| C19 | Town still a handful of buildings round a lawn | "Fill the ring: 6-8 streets, 40+ buildings shoulder to shoulder" |

## What changed in the plugin because of rounds 0-3

| Correction | Now in the plugin |
| --- | --- |
| U1, C2, C14, C15 | `b.land` (landforms, erosion, map preview, painting by slope); manual §5.1 rewritten with research numbers (`terrain-research.md`); `elements/land.mjs` and its picture |
| U2, C1, C12 | The spawn audit in every build (`audit:` lines), the build log, and an export gate in `convert.mjs` and `build_recipe` (refuses while the audit fails or under 15 builds); §2.3 "don't stop to ask" |
| C13 | §2.3, SKILL.md and `/spawn`: "read every screenshot you take" |
| U3, C4 | SKILL.md and §5.5: bridges arched 6-10 above the water, never flat strips; the audit warns about low decks over water |
| C3, C19 | A town chapter (§5.22) with `elements/town.mjs` (`street`, `townHouse`, `townStreet`) and its picture; the audit fails 4+ buildings of one size and bare stretches over 48 |
| C10 | The audit fails NPC stands more than 12 apart |
| C11, C16 | §5.8: autumn crowns mixed 20-40% into part of the oaks only |
| C17 + the user's request | Big trees: `bigTree` (trunks 2-4 across), giant trees and all kit trees with thick limbs in all-bark wood, `b.forest` bigger by default (scale 1.6 from 400 wide), the cherry reshaped |
| B1, B2 | Element ids from `kit.material`; unknown ids reported with a count, a location and "did you mean" |
| B3-B6, B8 | Leaf states only on leaves; island underside capped; no duplicate spawn point in the skeleton; a river warns when its course leaves the land |
