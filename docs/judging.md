# Judging a spawn

How the agent tests in `agent-test-log.md` are scored, so a Haiku build and a Sonnet build, an old
plugin and a new one, are compared on the same terms.

## The look

`node scripts/dev/judge.mjs <spawn folder> --out <dir> --label "<model> <effort> <round>"`.

It takes the same 11 shots of every spawn:
- two isometric overviews;
- the view on joining;
- four eye-level views from the spawn (north, east, south, west, at the in-game view distance);
- four high views from outside the edges.

It lays them out on `sheet.png` and measures the audit from the blocks themselves (bare land, flat
land, repeats, low decks, NPC spacing, falling blocks, cane, leaks), so it works on any `.nbt`.
Judge from the sheet and the single shots, and from the build's own close-ups where the sheet is
too small.

## The scale

Every category is scored 0-10 against these anchors:

| Score | Means |
| --- | --- |
| 10 | a professional build team's work: nothing to fix |
| 8 | a top server's spawn: a few small things |
| 6 | a good amateur spawn: it works, some parts plain or repeated |
| 4 | it has the parts, but they look generated: flat, repeated, thin, empty |
| 2 | barely there, or broken |
| 0 | missing |

## The categories

| # | Category | Weight | What is looked at |
| --- | --- | --- | --- |
| 1 | Land | 1.5 | landforms (ranges with spurs, foothills, a valley) vs a flat disc, noise or blobs; erosion; blocks by slope; the edge and the underside |
| 2 | Water | 0.75 | rivers in the low ground with varied width and banks, lakes in basins, waterfalls, everything held |
| 3 | Vegetation | 1 | big trees (thick, all-bark trunks, three sizes), woods in clumps with clearings, ground cover, the season |
| 4 | Town and buildings | 1.5 | streets lined with houses, density, every building its own, feature buildings 25-50, architecture quality |
| 5 | The spawn centre | 1.5 | the dais, the plaza paving, NPC stands 6-8 apart, boards and top-3 pillars, crates |
| 6 | Hero and landmarks | 1 | one landmark 60-120 tall that reads from the spawn, and its quality |
| 7 | Roads, bridges, walls | 0.75 | curving roads 5-9 wide, arched bridges on piers, walls that follow the land, gatehouses |
| 8 | Composition | 1 | the first view, the eye-level views in all four directions, the skyline, districts that each have a feature |
| 9 | Detail and life | 1 | props that tell a story, lamps, gardens, market stalls, nothing bare where people walk |
| 10 | Technical | 0.5 | the audit: 10 with nothing failing, 2 off per failing line (min 0) |
| 11 | The brief | 0.5 | everything the user asked for is there and reads as they meant it |

**The score:** Σ (weight × category) ÷ 11 × 10, out of 100.

Process notes (builds, time, critic runs) are recorded beside the score, not in it: the score is
the spawn, not the effort.
