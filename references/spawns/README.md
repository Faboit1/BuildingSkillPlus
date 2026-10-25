# The spawn handbook

How to build a server spawn or lobby that players remember: an SMP spawn with places for NPCs, a
leaderboard section and a crates section, a DonutSMP-style hub, or a PvP lobby. It sits on top of
the building handbook (`references/building/README.md`): every law there still applies; this file
adds the spawn program, the numbers and the workflow.

Companion files in this folder:

| File | What it holds |
| --- | --- |
| `corpus-study.md` | Real human-built spawns, lobbies and hubs, measured: sizes, layouts, set pieces, palettes, techniques |
| `design-research.md` | How popular servers lay out spawns, the plugin facts (NPC, hologram, crate, region), and why builds look AI vs human |
| `case-studies.md` | Critiques of earlier spawns made with this skill and the user's own spawns, with ranked lessons |

<!-- §2 onwards is filled from the research files; see the sections below. -->

## 1. The interview: ask before you build

A spawn is a client job. A build team never starts from "make me a spawn", and neither do you. Use
the `AskUserQuestion` tool (up to 4 questions per call, 2-4 options each; the user can always type
their own answer). Ask in rounds, and let each round's answers shape the next one.

### Round 1: type and frame

Ask all four together:

1. **Spawn type.**
   - *Normal spawn*: FreshSMP-style. One compact, beautiful spawn plaza with all NPCs, leaderboards
     and crates around it, set in great natural terrain. Easy to navigate, quick to the wild.
   - *Spawn+*: DonutSMP-style. A larger hub where each NPC or feature gets its own building or
     place (crates hall, auction house, shop, leaderboard hall, RTP portal...), joined by streets,
     terraces or a central plaza.
   - *PvP lobby*: a compact arena-focused lobby (kit/queue NPCs, leaderboards, a view of the action).
   - *Other*: minigame hub, network lobby...
2. **Size.** Small (about 80-120 blocks across), medium (about 150-220), large (about 250-400), or a
   size they give. Recommend from the type: normal 100-160, spawn+ 200-350, PvP lobby 60-120.
3. **Theme and style.** Offer 3-4 that fit the server name if known (medieval town, fantasy,
   modern/futuristic, Japanese, nature/organic, island/tropical, winter...) and accept their own.
4. **Version and platform.** Minecraft version and server software (Paper, Folia, Purpur...), and
   how it will be placed (WorldEdit/FAWE paste, Litematica, or region files for a fresh world).

### Round 2: the program

1. **Server name and branding.** Name, colours, logo or mascot, the text they want on signs.
2. **NPCs** (multi-select, then ask for any missing): shop, crates, auction house, RTP / wild,
   warps, kits, ranks / store, sell, quests / battle pass, AFK, bounties, teams/clans, events,
   tutorial / rules. One place per NPC: in a normal spawn a pedestal, alcove or booth around the
   plaza; in a spawn+ its own building or district.
3. **Leaderboards** (multi-select): money, kills, playtime, deaths, blocks mined, mobs killed,
   votes, KDR, streaks, team value... and how many boards (3-6 typical).
4. **Crates**: how many, their names and tiers (vote, common, rare, epic, legendary, seasonal), the
   plugin (ExcellentCrates, CrazyCrates, PhoenixCrates...) and the crate block if it is fixed.

### Round 3: follow-ups that perfect it

Ask what the first two rounds left open. Pick the 2-4 most important each time, and repeat the
round if answers open new questions. Typical follow-ups:

- **First view.** Which way players face on spawn, and what they should see first (the server
  logo/monument, the crates, a sweeping view of the hub).
- **Setting.** Mountains, forest valley, floating island, beach/lagoon, desert canyon, snow, void
  sky-island; day or night mood; where the wild/RTP exit is.
- **Signage.** Big block-letter signs (quartz lettering, 5 blocks tall) or holograms only. Which
  places get a sign.
- **Colours.** Main palette (light stone, dark stone, wood, terracotta...) and the single accent
  colour. Anything they hate (gold, neon, cyan...).
- **Extras.** AFK pool, PvP pit, parkour, map-art/info boards, event stage, statues of staff,
  shops of players, an arrival tunnel/portal.
- **Limits.** Maximum size, view distance, performance (entity counts), what must stay free for
  holograms and NPC plugins, and the paste coordinates.
- **Delivery.** `.schem`, `.litematic`, region files for a fresh world, a server upload.

### The brief

Write the answers back as a short brief and get a yes:

```
SPAWN BRIEF — <Server>
Type: spawn+ (DonutSMP-style), 260 x 260, Folia 1.21.x, region files at 0,0
Theme: white stone + dark oak + deep blue accent; nature setting: forested mountain valley
First view: facing south, the CRATES hall across a fountain plaza, mountains behind
NPCs (own place each): Shop (market hall), Auction (auction house), RTP (portal gate), Kits,
  Ranks/Store, Sell, Quests, AFK (garden pool)
Leaderboards: money, kills, playtime, blocks mined (4 boards + top-3 podium) in a leaderboard hall
Crates: vote, common, rare, legendary, seasonal (5, ExcellentCrates, ender chests)
Signage: block letters on the 4 main buildings, holograms elsewhere
Extras: PvP pit next to the arena entrance; night lighting warm
Delivery: .schem + region files + placements/setup commands
```

Only then build.
