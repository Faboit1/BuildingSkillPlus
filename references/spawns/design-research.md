# Spawn design research: real spawns, plugin facts, and why builds look AI-made

Research for the spawn handbook (`README.md` in this folder). It covers how popular SMP spawns,
PvP lobbies and network hubs are laid out; the exact plugin numbers and commands a builder needs to
leave the right space for NPCs, holograms and crates; what makes a build read as generated rather
than hand-built; and a checklist plus client questionnaire. Compiled 2026-10-25 for CheeseSMP
(DonutSMP-style economy SMP on Folia/Canvas 26.x with ExcellentCrates, AxAuctions, DonutShop).

**How to read the evidence tags**

| Tag | Meaning |
| --- | --- |
| **[src]** | Read from the plugin's source code or shipped config in this session (exact) |
| **[doc]** | Official documentation or the Minecraft Wiki |
| **[list]** | A seller's own listing (marketing claim). BuiltByBit and Fiverr block direct fetching (HTTP 403), so most [list] figures come from search-engine summaries of those pages; treat counts as approximate |
| **[fan]** | Community wiki, fan site or third-party article |
| **[calc]** | Derived here by calculation or inference from tagged facts; verify in game |
| **[?]** | Unverified or conflicting; do not rely on it |

Sources are linked inline and collected in §6.

---

## 0. The short version

1. **Spawns are programs first.** Every listing and wiki agrees on the same core: a spawn point,
   a shop, crates, an auction house (on economy SMPs), leaderboards and a way out to the wild
   (RTP). DonutSMP-style hubs add duels, an AFK area, a store and portals. Marketplace SMP spawns
   advertise a median of about **10-20 NPC spots, about 5 crate spots and 3-6 leaderboards** (§1.6).
2. **Two archetypes.** A *normal spawn* is 35-100 blocks across. Its NPCs are grouped around one
   plaza set into terrain. A *spawn+* is 150-300 blocks (lifesteal spawns with a warzone are 500). It gives each
   feature its own building or district around a central hub: Shop, AH, Duels, RTP zone, AFK,
   Store, Quests, Tops (§1.7).
3. **Text vanishes at distance, so the architecture must do the wayfinding.** Default visibility
   ranges are short. FancyNpcs and FancyHolograms show things only within **20 blocks**,
   ExcellentCrates crate holograms and particles within **24**, CrazyCrates' example crate
   hologram within **8**, and DecentHolograms within **48** [src]. Hologram text at scale 1 is
   only comfortably legible within about **10-15 blocks** on a 1080p screen [calc]. Beyond that,
   players navigate by silhouettes, landmarks and colour (§2.3).
4. **Leave exact space for plugins.**
   - **Crates:** an ExcellentCrates hologram starts 1.2 above the crate block's base and stacks
     upward 0.3 per line [src]. The default 3-line text is about 4.8 blocks wide, so crates need
     about 5 blocks centre to centre, or shorter lines [calc].
   - **Crate effects:** particle models reach a radius of 0.55-3.0 and heights of 2-4 above the
     crate; the beacon model is a column up to about 30 tall [src].
   - **Pushback:** knocks the player backwards about 1.25× [src], so the floor behind the user
     must be safe.
   - **Leaderboards:** a 12-line DecentHolograms board is 3.6 blocks tall (0.3 per line) [src].
5. **Command syntax was checked against source:**
   - Citizens: `/npc create <name> --at x:y:z:world[:yaw[:pitch]]`.
   - FancyNpcs: `/npc create <name> --location <x> <y> <z> --world <w>`. Its help text also says
     `--position`, but the code reads `--location`.
   - DecentHolograms: `/dh create <name> -l:<world>:<x>:<y>:<z> [--center] <text>`. The world
     comes **first**.
   - ExcellentCrates stores crate blocks as `Block.Positions: ["x,y,z,world"]` [src].
6. **26.x specifics:**
   - Spawn chunks no longer exist (removed in 1.21.9).
   - The spawn-scatter game rule is now `respawn_radius`, default 10. Set it to 0 for a designed
     spawn point.
   - `/setworldspawn` takes an angle and, since 1.21.9, a pitch [doc].
   - Official WorldGuard has no Folia build; only a community fork exists [fan].
7. **"Looks AI" is mostly the absence of decisions.** Builds read as generated when:
   - every choice is uniform (spacing, scale, edges, symmetry);
   - texture is random per block instead of caused by something;
   - nothing tells a story.
   The cure in every builder source is hierarchy, cause-and-effect weathering, clustered detail,
   broken lines and props with a purpose (§3).

---

## 1. Real spawns and lobbies

### 1.1 DonutSMP: the "spawn+" reference

**What is verifiable about the server**

- It is "a public, semi-anarchy Minecraft server (Java + Bedrock)" founded by the streamer
  DrDonut. The fan wiki reports a peak of "around 60,000 concurrent players", many of them bot
  accounts [fan, [about](https://donutsmp.wiki/about-donutsmp)].
- **The economy is command- and GUI-first:**
  - `/ah` is the auction house; Quick Buy works on its live listings.
  - `/shop`, `/sell` and `/order` are the server shop, selling and buy orders. `/sell` routes
    items to the best-paying order.
  - Shards are a second currency, spent in a Shard Shop.
  - Teams, Duels and RTP Queue are mechanics.
  - Commands, and the NPCs that run them, are the real interface; the spawn buildings are their
    shop fronts [fan, [beginner guide](https://donutsmp.wiki/donutsmp-beginner-guide),
    [mechanics](https://donutsmp.wiki/category/mechanics), [economy](https://donutsmp.wiki/category/economy)].
- **Crates** came in 5 tiers: **Common, Prime, Gold, Amethyst, Crimson**.
  - Each opening lets you **choose 1 of 7 rewards**.
  - Players reached them with **`/warp crates`**, so they had a dedicated place.
  - Keys came from an hourly `keyall` or the store.
  - The wiki marks crates as "removed as part of a larger update" (2026) [fan, [crates](https://donutsmp.wiki/crates)].
    Techbullion lists the same five key names [fan, [techbullion](https://techbullion.com/what-new-players-should-know-before-purchasing-donutsmp-money/)].
- **AFK Zone (removed):** it paid 1 shard per minute while AFK; kills paid 10 shards. It was
  replaced by "1 shard every 10 minutes while playing" for everyone [fan, [AFK zone](https://donutsmp.wiki/afk-zone),
  [gameboost](https://gameboost.com/blog/how-to-get-shards-in-donut-smp)]. Its location and shape
  are not documented.
- **RTP:**
  - The RTP menu was removed on 15 June 2026 "to make random teleportation more direct" [fan,
    [RTP](https://donutsmp.wiki/random-teleportation), [June update](https://donutsmp.wiki/big-june-update)].
  - RTP Queue (beta from 29 June 2026) is a matchmaking 1v1, not a teleport [fan, [RTP queue](https://donutsmp.wiki/rtp-queue)].
- **[?] The current hub:** one third-party guide says "DonutSMP deleted that hub … The map is the
  lobby", describing a former "spawn plaza" or "spawn island" with a spawn shop, market and crystal
  pit [fan, [donutsmpexchange](https://donutsmpexchange.com/guides/donutsmp-spawn)]. This is an
  SEO-style site and no official announcement was found; treat it as unverified.
- **Not verified:** DonutSMP's actual spawn dimensions and building list. No official page,
  readable video description or transcript was reachable (YouTube and Fandom block fetching).

**What the market sells as "DonutSMP-style"** [list]. These remakes are the best available
evidence of what players and owners expect from the archetype:

| Listing | Size | Program |
| --- | --- | --- |
| "SMP - Spawn / Lobby" v1.2, $9.99 ([BBB 77504](https://builtbybit.com/resources/smp-spawn-lobby.77504/)) | not stated | "central circular spawn hub"; crates area, shop NPC, **AFK portal**, duel NPC, auction NPC, **RTP zone**, portals to Overworld/Nether/End, **biome-based RTP portals**. The builder's update notes "added auction house, rtp zone, a portal to afk" to match the original |
| "DonutSMP spawn" v1.0 ([BBB 112415](https://builtbybit.com/resources/donutsmp-spawn.112415/)) | lobby 150×150, 1.21 | fan-made, "not affiliated" |
| "SPACE STATION SPAWN", $8 ([BBB 113244](https://builtbybit.com/resources/space-station-spawn.113244/)) | not stated | **SPAWN (central hub), DUELS, AH, WORLD, RTP ZONE, AFK Zone**; one summary also lists SHOP, STORE, a quest area and TOP/LEADERBOARD [?] |
| "DonutSMP Style Spawn - Quantum City" v1.1 ([BBB 102400](https://builtbybit.com/resources/donutsmp-style-spawn-quantum-city.102400/)) | 1000×1000 incl. water | cyberpunk city, "main spawn point … easy navigation", shop area with NPC |
| "DonutSMP spawn map Better Made" ([BBB 43529](https://builtbybit.com/resources/donutsmp-spawn-map-better-made.43529/)) | "huge", modern | details not readable |

**Takeaway for spawn+:**

- Organise it as a **central hub with one named place per feature**: Shop, AH, Duels, Crates, Tops,
  Store, Quests, RTP zone, plus portals to the dimensions.
- The **RTP zone and the AFK portal are places, not just NPCs.**
- 150×150 is the most common size quoted for the remakes.

### 1.2 FreshSMP: the "normal spawn" reference

- **Verifiable:** a crossplay (Java + Bedrock) lifesteal/economy SMP at `play.freshsmp.fun`.
  - Listings show about **1,800-2,200 online of 5,000 slots** (checked 24 Oct 2026).
  - Supported versions run from 1.21 to 26.3.
  - MOTDs advertise "NEW LIFESTEAL SZN | CURSED CRATE" [fan, [minecraft.how](https://minecraft.how/server/freshsmp),
    [minelist](https://minelist.io/freshsmp)].
  - Its store and Discord are not fetchable.
- **Not verified:** the spawn layout itself. No public description, wiki or transcript was found.
  The "compact spawn in beautiful terrain" description comes from the user and is the working
  definition here.
- **Comparable compact listings** [list]:
  - [Free SMP Spawn](https://builtbybit.com/resources/free-smp-spawn.102520/): about a 50×50 spawn
    area with crates, ranking stands and a PvP area.
  - [Free SMP Spawn Nr 2](https://builtbybit.com/resources/free-smp-spawn-nr-2.102664/): about
    35×35, with KoTH spots, a moshpit and NPC stands.
  - [Simple SMP Spawn Building](https://www.mc-mod.net/?p=527386): 44×44 [fan].
  - [Mini Cozy Spawn](https://builtbybit.com/resources/mini-cozy-spawn-100x100.113498/): 100×100,
    with 20+ NPC spots, 8 crate places, 4 leaderboard places, 3 "top places", a crate section, a
    shop section, a main building with interior and a "red outline for a warzone".

### 1.3 Other SMP, Lifesteal and Box spawns

- **Lifesteal Network** [fan, [Spawn (S6)](https://lifestealnet.fandom.com/wiki/Spawn_(Season_6)),
  [Spawn](https://lifestealnet.fandom.com/wiki/Spawn)]:
  - Spawn is "the main safe zone for trade".
  - It holds a Hearts Collector shop, a **crate display**, the Auction House, a **Bounty Hunter**
    shop and a **Colosseum**.
  - Its NPCs include Hearts Collector and Arena Master.
  - **Barrier blocks surround spawn**; higher ranks can fly over them.
- **Netherite.gg Lifesteal** [fan, [spawn and AFK](https://netherite.gg/wiki/lifesteal/spawn-and-afk)]:
  - Spawn is described as "the middle section of the Overworld, a 10,000 by 10,000 block area".
  - `/spawn` is blocked while combat-tagged.
  - `/warps` has a 3 s warm-up and lists **AFK, Spawn, Shop, Crates, Enchanter, Leaderboards,
    Outpost, Citadel, PvP, Warzone, Siege**. The Crates warp holds "seasonal, vote, and event
    crates"; the Leaderboards warp tracks "top players, clans, and stats".
  - Idle players (5 min) are moved to the AFK area after a 10 s warning, with `/afkback`.
- **Torrent SMP** [fan, [crates](https://wiki.torrentsmp.com/lifesteal/crates)]:
  - **11 crates** sit "right in front of the world spawn point".
  - Store crates: Lycan (top, 3 rewards per key), Rare, Legendary, Spawner, Heart.
  - Earned crates: Vote (voteshop), AFK (from the AFK Pit) and KoTH (rotating, won at KoTH).
  - Limited seasonal "Mythical" crates: Dragonstone, Archangel, Nexus.
- **Lifesteal spawns with a warzone** [list]: "Every Lifesteal spawn build comes with a safe-zone
  centre and clear boundaries leading directly into a high-intensity PvP warzone" ([Origin
  Builds](https://origin-builds.com/collections/lifesteal)).
  - [Crimsonvale](https://store.abfielder.com/products/crimsonvale-lifesteal-warzone): 500×500,
    **20 NPC spots, 6 crate spots, 6 leaderboards**, outpost, KoTH, portal, "huge moshpit", £7.50.
  - [Christmas Lifesteal](https://mcmodels.net/products/15377/christmas-lifesteal-with-warzone):
    500×500, KoTH, crystal PvP areas, $7.99.
  - Typical warzone listings are 300×300-500×500.
- **BoxPvP** [list, [BBB BoxPvP](https://builtbybit.com/resources/minecraft/builds/boxpvp/)]:
  - Spawn hubs are 125×205 to 300×300, with **mines** (9-16 side mines plus a starter mine),
    shop kiosks (4), crate pedestals (3-5) and NPC slots (5 up to 60).
  - Combat is set apart: one map has "a portal and pvp line" and a "no elytra zone".

### 1.4 PvP and practice lobbies

- **Minemen Club** is "a multi-region pvp practice server" (Practice, UHC Meetup, UHC Games). Its
  practice mode has 1v1 duels in 30+ kits, ranked or casual, split into 1.8 and 1.21 combat, with
  ranked wins on leaderboards [fan, [minecraftservers.org](https://minecraftservers.org/server/591376)].
  **The lobby layout could not be verified** (no public description was reachable).
- **PvP Legacy** has custom kits and duels. Its KitPvP gamemode runs in a "KitPvP Lobby" with
  named arenas (Outpost, Pine Arena, Lava Pit, Sky Islands, Colosseum) [fan,
  [PvP Legacy wiki](https://pvplegacy.fandom.com/wiki/KitPvP) (search summary; page blocked)].
- **Navigation is by hotbar items, not NPCs.** Practice plugins put queues on items, e.g. Phoenix
  Practice's defaults "Iron Sword – Play Unranked" and "Diamond Sword – Play Ranked" [doc, search
  summary of the Phoenix wiki]. StrikePractice advertises "Customizable spawnitems (any item, any
  command)" and has addons for per-kit Elo leaderboards [list,
  [StrikePractice](https://builtbybit.com/threads/strikepractice-practice-pvp-plugin.208863/page-6)].
- **The lobby is a stage around the spawn point** [list]:
  - [Lobby - Practice PVP](https://builtbybit.com/resources/lobby-practice-pvp-100x100.54239/):
    100×100, "clearly marked zones for kits, leaderboards".
  - [Ultimate Hub](https://builtbybit.com/resources/ultimate-hub-a-premium-lobby-setup.50094/):
    "holographic leaderboards showing top hub PvP kills and parkour completions".
  - [Life Hub](https://builtbybit.com/resources/life-hub.124738/): 150×150, podiums for 1st-3rd
    place, a portal area.
  - Typical lobby listings run 80×80 to 180×180.
- **Takeaway:** a practice lobby needs these, compact (60-120):
  - a spawn point with a strong view;
  - Elo/wins boards per mode;
  - a few mode NPCs (Unranked, Ranked, FFA, Party/Events, Kit editor) for players who don't use
    the hotbar;
  - optional lobby PvP or FFA drop, parkour with a leaderboard, and a top-3 podium.

### 1.5 Network lobbies

**Hypixel Main Lobby** [fan, [Hypixel Wiki](https://hypixel.fandom.com/wiki/Main_Lobby) via
search summary; [minecraftiplist guide](https://www.minecraftiplist.com/blog/exploring-hypixels-main-lobby-zones-npcs-and-ultimate-guide/)]:
- It has "several NPCs to connect directly to a game/lobby" at spawn, and "a nether portal behind
  the player that opens the Game Menu".
- Since the revamp of 4 April 2022 it has **11 themed zones**: Spawn, Castle, Ruins, Village,
  Farm, Port, Ancient Statues, Labyrinth, Fishing Hut, Mines, Paintball Arena.
  - Each zone has a Lobby Explorer NPC; talking to one unlocks fast travel to that zone.
  - Relics are hidden around the lobby, and there is a parkour course.
  - The Spawn zone "offers a panoramic view of the vast lobby landscape".
- **Lesson:** the primary actions sit at the spawn point. Game NPCs face you, and the menu portal
  is one step behind you. Exploration is a reward layer, not a requirement.

**MCC Island** (Noxcrew) [fan/doc, [Island Entrance](https://mccisland.wiki/Island_Entrance),
[official](https://mcchampionship.com/island/), [guide](https://mcchampionship.com/threads/the-complete-guide-to-mcc-island.7280/)]:
- **Island Entrance** is where players appear (`/hub`, `/spawn`). It is the "main intersection for
  the majority of the island's useful points of interest".
- New players meet the **Faction Master** first. Choosing a faction "is required to access the rest
  of the Island"; returning players see a login-rewards menu.
- The **Seasonal Plaza** (battle pass area, Seasonal Shop and Seasonal Machine) is "immediately to
  the right of the server's spawn point" and is redecorated each season.
- **Game pipes:** players "head down the game pipes and emerge into unique lobbies for each MCC
  Island Game". The entrance to a game is a hole you drop into.
- There are also a **Market Square** for cosmetics, **hidden parkour**, a Scavenger's Hideout, and
  "9 Islands and 3 Grottos" for fishing. Event areas add limited-time NPCs and quest boards.
- The Navigator item teleports anywhere, so walking is optional.
- **Lesson:** one greeter, one seasonal set piece next to spawn, and exits that are physical
  gestures (dropping down a pipe).

### 1.6 Build-team and marketplace listings

**What listings advertise.** Counts per listing [list, except where noted]:

| Listing (marketplace) | Size | NPC spots | Crates | Leaderboards / tops | Other |
| --- | --- | --- | --- | --- | --- |
| Free SMP Spawn (BBB) | ~50×50 area | stands | yes | ranking stands | PvP area |
| Free SMP Spawn Nr 2 (BBB) | ~35×35 area | stands | – | – | KoTH spots, moshpit |
| Mini Cozy Spawn (BBB) | 100×100 | 20+ | 8 | 4 + 3 top places | shop section, main building interior, warzone outline |
| Compact & Cozy Spawn (BBB) | 150×150 | 25 | 7 | zone | 6 market zones, anvil, enchanting, "jump to" zone |
| Spawn - Tropical Island (BBB) | 150×150 | 6 | 5 | yes | market stalls, enchanting |
| ScOp_E Tropical Paradise (BBB) | 150×150 | 19 | 5 | stats + leaderboard area | – |
| Clanify Lifesteal + Warzone (BBB) | 150×150 | ~21 | ~5 | "many" | warzone |
| Atmospheric Survival/Lifesteal (MCModels) | 160×160, h 130 | 2 stalls | – | 2 player podiums | respawn point, Nether + End portals, 3 creative spots, $4.99 |
| Space Station Spawn (NeroCore, BBB) | ~200×200 | 8 NPC/holo places | 2 | 3 tops | PvP arena, Nether portal |
| Lifesteal Castle (MCModels) | 220×270 | 10 | 1 | – | portal, $16 |
| Medieval Server Spawn (MCModels) | 329×330 | 5 | 2 | – | 6 markets, enchanting, blacksmith, port, interiors, $10 |
| Desert Temple Spawn (MCModels) | 403×403 | 6 | 4 | – | 6 markets |
| Crimsonvale Lifesteal Warzone (abfielder) | 500×500 | 20 | 6 | 6 | outpost, KoTH, portal, moshpit |
| Cyberpunk City (MCModels) | 660×570 | 18 | area | holograms | shops |
| SkyWars Medieval lobby (BBB) | 300×330 | 9 | 2 | 4 | Nether portal |
| Bedwars/Skywars Lobby (MCModels) | – | 5 | 2 | 2 boards + top-3 | portal, $7.99 |
| Imperial Lobby (BBB) | ~80×80 | 11 stands | yes | hologram space | Japanese |

Sources: [BBB tag npc-area](https://builtbybit.com/tags/npc-area/), [Mini Cozy](https://builtbybit.com/resources/mini-cozy-spawn-100x100.113498/),
[Tropical 150](https://builtbybit.com/resources/spawn-tropical-island-150x150.23238/), [MCModels
Atmospheric](https://mcmodels.net/products/9026/atmospheric-survival-lifesteal-smp-spawn-160x160),
[Medieval](https://mcmodels.net/products/15416/medieval-server-spawn), [Lifesteal Castle](https://mcmodels.net/products/10259/lifesteal-castle-spawn),
[Desert Temple](https://mcmodels.net/products/9920/desert-temple-spawn), [Cyberpunk](https://mcmodels.net/products/16157/cyberpunk-city-spawn),
[BW/SW lobby](https://mcmodels.net/products/14927/bwsw-lobby), [SkyWars lobby](https://builtbybit.com/threads/lobby-skywars-medieval-300x330.704201/).

**Patterns:**

- **Sizes cluster at 100, 150, 200-330 and 500.**
  - 150×150 is the modal SMP spawn.
  - 500×500 is the modal lifesteal spawn with a warzone.
  - Most listings give only the footprint; one gives a height of 130 blocks.
- **Feature lists are counts of "spots"**: NPC spots, crate spots, leaderboard spots and
  "tops" (podiums for the top 1-3 players).
- **Medians across SMP spawn listings** [calc]: NPC spots ≈ 10-20, crate spots ≈ 5, leaderboards
  ≈ 3-6.
- **Other recurring items:** respawn point, Nether/End portals, a market of player stalls,
  enchanting/anvil/blacksmith corners, a PvP area or warzone outline, KoTH, moshpit, AFK zone.
- **Delivery:** `.schem` (WorldEdit/FAWE) plus a world download; often "pasted in creative" because
  of non-survival blocks; "no plugins needed" (the spots are empty and the owner places NPCs).
- **Prices:** a pre-made spawn costs $3-16 (£4.50-7.50).
- **Commissions:**
  - [TimeCube](https://www.timecubeproductions.com/commissions) [list] charges by footprint:
    ≤35×35 $30; to 100×100 $75; to 200×200 $175; to 350×350 $400; to 500×500 $750; to 1000×1000
    $1,350. It notes "The height and depth of the build weren't factored into the price".
  - Fiverr spawn/lobby gigs start at $10-125. Small tiers are quoted as 60×60 or 70×70 [list,
    [Fingertz](https://www.fiverr.com/fingertz/build-a-hub-or-lobby-for-a-minecraft-server),
    [Tinekrizaj](https://www.fiverr.com/tinekrizaj/build-you-a-minecraft-spawn-lobby-hub-house-and-more),
    [Joluks](https://www.fiverr.com/joluks/build-you-a-beautiful-minecraft-lobby-or-map)].

**What buyers expect** [calc, from the feature lists, forum threads and commission pages]:
- an exact count of spots for each plugin;
- space reserved for holograms;
- a single obvious spawn point;
- portals or an RTP place;
- a safe-zone/PvP boundary that can be seen;
- the theme matched to the server's name;
- the server name or logo somewhere prominent (often commissioned separately; logo art runs about
  $45 text-only to $250 illustrated [fan, [BBB thread](https://builtbybit.com/threads/server-logo.617863/)]);
- delivery as `.schem` plus a world.

### 1.7 The program, extracted

#### NPCs: which, how often, how many

| NPC / feature | Seen in | Normal spawn | Spawn+ |
| --- | --- | --- | --- |
| **Shop** (server shop, e.g. DonutShop `/shop`) | DonutSMP, remakes, most listings (market stalls, kiosks) | core | own building: market hall |
| **Crates** | every source | core (a crate row or alcove) | own building: crate vault or plaza |
| **Auction house** (AxAuctions `/ah`) | DonutSMP, remakes, Lifesteal Network | core on economy SMPs | own building: exchange |
| **RTP / wild** | DonutSMP, remakes ("RTP zone", biome portals) | core: a gate or portal on the main axis | own place: travel gate or portal hall |
| **Store / ranks** (webstore) | Space Station listing [?]; every server sells ranks and keys (DonutSMP, Torrent `/buy`) | common (1 NPC) | small kiosk near spawn |
| **Leaderboards / tops** | every source | core: one board wall | own place: hall of fame |
| **Duels / PvP** | DonutSMP remakes, lifesteal warzones, practice | optional | own place: arena entrance |
| **AFK** | DonutSMP (former), Torrent, netherite, BoxPvP | optional: pool or pit | own place, or a portal to an AFK area |
| **Sell / orders** | DonutSMP (`/sell`, `/order`) | optional | inside the market |
| **Warps** | netherite `/warps` | optional (the NPC opens the menu) | one per district gate |
| **Kits** | practice/KitPvP; SMP starter kits | optional | kiosk |
| **Quests / battle pass** | MCC seasonal plaza; Space Station "quest area" [?] | optional | seasonal plaza beside spawn |
| **Tutorial / rules / "Start Here"** | MCC Faction Master, Hypixel Lobby Explorer, [Fumora](https://www.fumora.net/lab/minecraft-server-new-player-retention) [fan] | recommended (1 NPC at spawn) | at the spawn point |
| **Events** (KoTH, envoys, stage) | lifesteal listings, netherite envoys | optional | event plaza |
| **Bounties** | Lifesteal Network Bounty Hunter | optional | – |
| **Teams/clans, enchanter, blacksmith, anvil** | netherite, medieval listings | optional | craft corner |

**Counts** [calc from §1.6]:

- **Normal spawn:** 5-10 NPCs (Shop, Crates, AH, RTP, Store, Start Here, plus 1-4 optional).
- **Spawn+:** 12-25 NPC slots, roughly half used at launch. Leave 3-6 spare dressed spots for
  seasons and events.
- **PvP lobby:** 4-8 (Unranked, Ranked, FFA, Kit editor, Events, Store, Leaderboards).

#### Leaderboards

- **Stats offered:**
  - A popular DecentHolograms config pack ships **5 boards: money, kills, deaths, playtime, blocks
    mined**, each with **top-10 for all-time, monthly, weekly and daily** [list,
    [summary](https://builtbybit.com/resources/premium-leaderboards-configuration.108993/)].
  - Top10Plugin adds shards [list].
  - Practice lobbies use Elo per kit, wins and kill streaks; hubs use lobby PvP kills and parkour
    times.
  - Lifesteal servers add hearts, clans and bounties.
- **How many:** 3-6 boards in listings ("4 leaderboard places", "6 leaderboards", "3 tops").
- **Presentation (three forms):**
  1. **Hologram boards.** DecentHolograms or FancyHolograms text fed by ajLeaderboards
     placeholders. Pages or timed types cycle all-time, monthly, weekly and daily.
  2. **"Tops" podiums.** Statues of the top 1-3 as player NPCs. ajLeaderboards documents a Citizens
     NPC named with `%ajlb_lb_<board>_1_alltime_name%` and skinned with `%ajlb_lb_<board>_1_alltime_skin%` [doc].
  3. **Signs with heads.** `/ajlb signs add <board> <position> <type>`, with a head placed above or in front [doc].
- **Placement:**
  - Group the boards in one place: a "Leaderboards" warp or zone (netherite, Compact & Cozy).
  - Keep that place within the first view or one turn from spawn.
  - Put the boards at reading distance from a standing area (§2.3).

#### Crates

- **Tiers seen:**
  - DonutSMP: Common, Prime, Gold, Amethyst, Crimson (choose 1 of 7).
  - Torrent: Vote, AFK, Rare, Legendary, Spawner, Heart, a premium "Lycan", KoTH and seasonal
    Mythicals.
  - Netherite: seasonal, vote and event crates.
- **Count:** 2-8 physical crates per spawn (median about 5). Plan 4 permanent crates (vote,
  common/basic, rare/epic, legendary/premium) plus 1-2 slots for seasonal or event crates.
- **Display:**
  - Crates sit **in a row or arc in a dedicated place**, with a hologram per crate.
  - Previews open by clicking: left click previews and right click opens in ExcellentCrates [src].
  - Placement varies: right in front of the spawn point (Torrent), a separate warp (DonutSMP
    `/warp crates`), or a "crate section" or "crate display" (listings, Lifesteal Network).
  - Hourly `keyall` events (DonutSMP) mean **the crate area must hold a crowd**.

#### The spawn point and the first view

- **Spawn facing the way on:**
  - Spawn facing the path, "not facing a wall".
  - Decoration (fountains, statues, trees) goes "behind the player's spawn point or to the sides,
    never blocking the forward view".
  - Show "something that tells them where to go" within 5 s.
  - Use one "Start Here" NPC, "Not five NPCs. One." [fan, [Fumora](https://www.fumora.net/lab/minecraft-server-new-player-retention).
    Its retention statistics (80% leave within 5 min, 5% vs 25%) are not sourced; ignore them].
- **Primary actions in front, the menu one step behind** (Hypixel). The greeter and a seasonal set
  piece stand right next to spawn (MCC).
- **Older forum consensus** [fan, [MCF thread 2012-16](https://www.minecraftforum.net/forums/minecraft-java-edition/creative-mode/363056-how-to-build-a-practical-good-looking-spawn)]:
  - "cramped spawns with dozens of signs really puts off a user";
  - raised platforms "so the user can see your cool landscape";
  - natural barriers (mountains, islands) beat invisible walls;
  - match the server's theme;
  - avoid "a boring, huge castle" or "a schematic-ed city".
- **Theme-park precedent:**
  - Disney's "weenie" is a landmark visible from the entrance that pulls visitors in (the castle
    at Magic Kingdom).
  - Hub-and-spoke layouts let guests see where they are and avoid "museum feet" [fan,
    [Touring Plans](https://touringplans.com/blog/an-urban-designer-looks-at-main-street/),
    [AllEars](https://allears.net/ae/issue764.htm)].
  - The handbook's `composition.md` §9 already encodes this: spawn 20-40 blocks from the landmark,
    on its axis.

#### Out-to-wild mechanics

| Mechanic | Evidence | Build need |
| --- | --- | --- |
| `/rtp` command (no menu) | DonutSMP since 15 June 2026 | an RTP NPC or sign anyway, for discovery |
| RTP NPC / "RTP zone" | DonutSMP remakes | a place with a sense of departure: gate, map table, compass rose |
| RTP portals, per biome or world | "biome-based RTP portals" (remake); justRTP RTPPortals `/rtp portal create <id> [design] [targetWorld]` with a two-corner wand; PerfTeleport auto-teleports on entering a WorldGuard region (Folia-ready) [list, [justRTP](https://builtbybit.com/resources/justrtp-randomtp-evolved.70322/update/260909/), [PerfTeleport](https://builtbybit.com/resources/perfteleport-cross-server-folia.95973/updates?page=2)] | a portal frame per destination (e.g. plains, desert, snow, jungle), each dressed in its biome; an air or portal-block volume for the trigger region |
| Dimension portals | Atmospheric 160×160, SMP Spawn/Lobby, Medieval | a Nether/End portal pair, usually as set pieces |
| Drop holes / pipes | MCC "game pipes" | a shaft with a soft landing or teleport region; a strong visual cue at the lip |
| Walk out through a gate | normal spawns in terrain; Lifesteal Network barrier ring | a gate in the safe-zone wall, a path into the wild, the boundary visible |
| Warp menu | netherite `/warps` | NPC or sign by the gate |

#### Safe zone, PvP boundary, AFK pool

- **Safe zone:**
  - The hub is a WorldGuard region with `pvp deny`, `mob-spawning deny` and the other protection
    flags (§2.6).
  - `/spawn` is blocked while combat-tagged (netherite; the Donut-style `/spawn` Skript also has
    countdown, cancel-on-move and combat checks [list, [Donut SMP - Spawn](https://builtbybit.com/resources/donut-smp-spawn.74964/)]).
- **PvP boundary:**
  - Make it visible: "red outline for a warzone" (Mini Cozy), "portal and pvp line" (BoxPvP),
    "clear boundaries" (Origin Builds).
  - Lifesteal Network uses barrier blocks.
  - Build the boundary as a material change in the ground, a low wall or line of posts, and
    warning banners. Raise a WorldGuard `greeting-title` on entry.
- **AFK:**
  - Usually a separate pool, pit or portal (DonutSMP AFK portal, Torrent AFK Pit), often fed by
    auto-move (netherite: 5 min idle).
  - Rewards come from a plugin such as AxAFKZone ("unlimited" zones; command or item rewards with
    chances; since v1.11.0 rewards can require a permission and a minimum/maximum time in zone;
    supports 1.20.2-26.2 [doc, [Hangar](https://hangar.papermc.io/Artillex-Studios/AxAFKZone/versions/1.11.0)]).
  - Folia: AFK players keep chunks loaded and ticking, so put the AFK area where its loaded area
    will not merge into the hub's region, ideally in another world [calc; see §2.7].

#### The two archetypes, specified [calc, from the evidence above]

| | Normal spawn (FreshSMP-like) | Spawn+ (DonutSMP-like) | PvP lobby |
| --- | --- | --- | --- |
| Footprint | 60-120 (built core 35-70) in sculpted terrain | 150-260 (220-300 with districts) | 60-120 |
| Structure | one plaza, NPC crescent or ring, crates niche, board wall, one gate out | central plaza and landmark plus 5-9 feature places on spokes or terraces | spawn island facing an arena or FFA drop |
| NPCs | 5-10 | 12-25 slots | 4-8 |
| Crates | 3-5 in one alcove | 4-6 in a vault, plus seasonal slots | 0-3 |
| Boards | 3-4 on one wall + top-3 | 4-6 in a hall of fame + top-3 statues | 3-6 Elo/wins + parkour |
| Spawn → core NPCs | ≤ 15-25 blocks (≈ 4-6 s walking at 4.317 b/s) | ≤ 25 to the plaza ring; ≤ 60-75 to the farthest district (≈ 11-13 s sprinting at 5.612 b/s) [doc speeds, [Sprinting](https://minecraft.wiki/w/Sprinting)] | ≤ 15 |
| Out | gate or RTP portal on the main axis, in the first view | RTP gate or portal hall; Nether/End portals | hotbar plus FFA drop |
| The look | terrain is the hero: cliffs, waterfall, trees frame the plaza | a skyline is the hero: one landmark 1.5-2× the ring buildings, each district with its own identity | the arena view is the hero |

---

## 2. Gameplay and plugin facts (exact numbers)

### 2.1 Player and NPC geometry (vanilla)

| Fact | Value | Source |
| --- | --- | --- |
| Player hitbox | 0.6 wide × 1.8 tall (sneaking 1.5) | [doc, [Player](https://minecraft.wiki/w/Player)] |
| Eye height | 1.62 standing, 1.27 sneaking | [doc] |
| Entity interaction range (clicking an NPC) | **3** blocks (`entity_interaction_range`) | [doc, [Attribute](https://minecraft.wiki/w/Attribute)] |
| Block interaction range (clicking a crate block) | **4.5** blocks | [doc] |
| `scale` attribute | 0.0625-16, default 1; FancyNpcs `/npc scale` needs 1.20.5+ | [doc], [src] |
| Name label height | about hitbox top + 0.5, so about 2.3 above a player NPC's feet | [calc, from vanilla client rendering; the wiki doesn't document it] |
| Vanilla name-label render limit | 64 blocks | [calc, vanilla client; unverified on the wiki] |
| Walk / sprint speed | 4.317 / 5.612 blocks per second | [doc] |
| Default FOV | 70 ("Normal"), vertical | general knowledge, not re-checked this session |

**Design consequences** [calc]:

- An NPC must stand where a player can get within 3 blocks of its hitbox. An NPC behind a
  counter is fine if the counter is at most 1-2 blocks deep. On a plinth, keep the plinth at most
  1-2 blocks high with an approach.
- Give each NPC a **3×3 standing apron** at minimum, and **5×5** for high-traffic ones (AH, shop,
  crates).
- Keep **≥ 3 blocks between NPC centres**, and ≥ 4 if they carry multi-line holograms. A name like
  "Auction House" (13 characters) is about 2 blocks wide at scale 1 (0.15 block per character, §2.3).

### 2.2 NPC plugins: commands and defaults

**Citizens** (`folia-supported: true`; its create command schedules the spawn on the region thread
via `runRegionTask`) [src, [Citizens2](https://github.com/CitizensDev/Citizens2),
[CitizensAPI CommandContext](https://github.com/CitizensDev/CitizensAPI)]:

```
/npc create <name> [--at x:y:z:world[:yaw[:pitch]]] [--type PLAYER] [--nameplate true|false|hover] [-c] [-p]
```

- `--at` takes 3-6 parts separated by `:` or `,`.
  - With 3 parts it uses the sender's world.
  - Console must give the world.
  - It also accepts `me`, `here`, `facing` or a player name.
- **`-c` centres on the block** (x+0.5, z+0.5) and lifts onto blocks less than 0.6 tall (slabs,
  carpets). Without it, integer coordinates put the NPC on the block corner.
- `-p` makes a packet-only NPC.
- Using `--at` needs `citizens.npc.admin`.
- Other commands:
  - `/npc moveto x:y:z:world`;
  - `/npc rotate --body <yaw> --head <yaw> --pitch <p>`;
  - `/npc lookclose` (default range **10**);
  - `/npc hologram add <text>` (line height default **0.4**, renderer default `display`);
  - `/npc command add <cmd> -p`. `-p` runs it as the player, `-l` sets left click; the default is
    right click.
  - `/npc skin <name>`;
  - `/npc name -h` (shows the name only on hover).

**FancyNpcs 2.12.1** (Paper/Folia only; packet-based) [src, [FancyPlugins](https://github.com/FancyInnovations/FancyPlugins);
[docs](https://fancyinnovations.com/docs/minecraft-plugins/fancynpcs/commands/npc)]:

```
/npc create <name> [--type <type>] [--location <x> <y> <z>] [--world <world>]
/npc move_to <npc> <x> <y> <z> [world] [--look-in-my-direction]
/npc rotate <npc> <yaw> <pitch>
/npc center <npc>
/npc displayname <npc> <@none|text>
/npc skin <npc> <@none|@mirror|name|url|file> [--slim]
/npc action <npc> <any_click|left_click|right_click> add <player_command|console_command|player_command_as_op|message|play_sound|wait|send_to_server|need_permission|...> [value]
/npc turn_to_player <npc> [true|false]
/npc visibility_distance <npc> <blocks|default|always_visible|not_visible>
```

- **The code reads `--location`** (both command frameworks). The docs and one syntax line in its
  language file say `--position`.
- The location parser takes `x y z` and accepts `~` relative coordinates.
- Console must give both location and world.
- Names allow only `A-Z a-z 0-9 _ - /`.
- **Defaults:** `visibility_distance: 20` and `turn_to_player_distance: 5`.
  - Raise visibility to 48-64 for hub NPCs so they don't pop in at 20 blocks.

**ZNPCsPlus** (`folia-supported: true`) [src, [ZNPCsPlus](https://github.com/Pyrbu/ZNPCsPlus)]:

- `/npc create <id> [<type>]` creates at the player's position.
- Then use `/npc setlocation <id> <x> <y> <z>` (accepts `~`), `/npc setrotation <id> <yaw> <pitch>`
  and `/npc center <id>`.

**Yaw convention** (Minecraft entity yaw): 0 = facing south (+Z), 90 = west, 180 = north,
-90/270 = east. To make an NPC face the spawn point, use yaw = atan2(-dx, dz) in degrees, where
(dx, dz) points from the NPC to the target [calc].

### 2.3 Hologram plugins and text maths

**DecentHolograms** (`folia-supported: true`; supports 26.1/26.2) [src, [DecentHolograms](https://github.com/DecentSoftware-eu/DecentHolograms)]:

- **Defaults:**
  - Line heights: text **0.3**, icon 0.6, head 0.75, smallhead 0.6.
  - `display-range` and `update-range`: **48**.
  - `update-interval`: 20 ticks.
- **Each text line is one packet armour stand**, i.e. a client-side entity, with no server entity.
- **Lines stack downward from the anchor**, so the anchor is the **top** line.
  `/dh hologram downorigin <h> true` makes the anchor the bottom.
- **Commands:**

```
/dh create <name> -l:<world>:<x>:<y>:<z> [--center] <first line>     (works from console with -l)
/dh line add <hologram> <page> <text>
/dh move <hologram> <x> <y> <z>          (accepts ~)
/dh line height <hologram> <page> <line> <height>
```

- **Limits:** classic DH text always faces the player and its size can't change. The newer
  display holograms (`/dh d create <type> <name>`) use text displays.

**FancyHolograms 2.x** (Paper/Folia) [src]:

- A text hologram is **one TextDisplay entity** holding all its lines.
- **Commands:**
  - `/hologram create <text|item|block> <name>` (player only, at the player's position);
  - `/hologram edit <name> moveTo <x> <y> <z> [yaw] [pitch]` (accepts `~`);
  - also `setLine`, `addLine`, `scale`, `billboard`, `background`, `textShadow` and
    `visibilityDistance`.
- **Default `visibility_distance`: 20.** Raise it for hub boards.

**Vanilla text displays** [doc, [Display](https://minecraft.wiki/w/Display)]:

- "each pixel of text is 1/40th of a meter wide".
- Multi-line text **extends upward** from the entity, so the anchor is at the bottom.
- `line_width` defaults to 200, the background to 0x40000000, and display entities have **no
  hitbox**.
- Paper tracks display entities to **128** blocks by default (`entity-tracking-range.display`,
  scaled by `entity-broadcast-range-percentage`) [doc, [Paper spigot.yml](https://docs.papermc.io/paper/reference/spigot-configuration)].

**Text size and legibility** [calc]. At default FOV 70 on a 1080p screen, one block at distance d
spans about 771/d pixels.

| Element | Size | Legible to | Note |
| --- | --- | --- | --- |
| Hologram or nametag text, scale 1 | cap height ≈ 7 px × 1/40 ≈ 0.18 block; ≈ 0.15 block per character | comfortable ≤ 10-15 blocks; unreadable beyond ≈ 20 | scale 2 doubles both |
| Text display line pitch | ≈ 0.25 block per line (≈ 10 font px) | – | measure in game |
| DH line pitch | 0.3 block [src] | – | – |

**Leaderboard board dimensions** [calc from [src]]. Take a 12-line board: title, period line and
10 entries like `#10 PlayerName - $1.2B`.

- **Size:**
  - DH: 12 × 0.3 = **3.6 tall**.
  - FancyHolograms text display: ≈ 3 tall.
  - Both are ≈ 3-4 wide at scale 1.
- **Anchor:**
  - DH: top line at **floor + 5.0**, so the bottom line is at ≈ floor + 1.7, about eye level.
  - Text display: anchor near **floor + 1.5**; it grows upward.
- **Backdrop:** a frame or panel **5-7 wide × 5-6 tall**, with a standing area **4-12 blocks in
  front**.
- **Spacing:** ≥ 2 blocks between boards; a 3-board wall is about 20 wide.
- **Readability at distance:** text is unreadable from more than about 15 blocks. Put a big
  block-built or banner title ("TOP MONEY") above each board.

**ajLeaderboards** (`folia-supported: true`) [src, [doc setup](https://wiki.ajg0702.us/ajleaderboards/setup/setup),
[doc placeholders](https://wiki.ajg0702.us/ajleaderboards/setup/placeholders)]:

- **Register a board:** `/ajlb add %placeholder%`. The placeholder must return a plain number.
  Examples: `%vault_eco_balance%`, `%statistic_player_kills%`, `%statistic_time_played%`.
- **Display placeholders:**
  - `%ajlb_lb_<board>_<n>_<type>_name%` and `_value`, plus `_value_formatted` (10k), `_prefix`,
    `_suffix` and `_color`;
  - viewer placeholders `%ajlb_position_<board>_<type>%` and `%ajlb_value_<board>_<type>%`.
- **Types:** `alltime`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`. Timed types suit only
  cumulative stats.
- **Defaults:** `stat-refresh: 1200` ticks (60 s) and `sign-update: 20`.
- **Signs:** `/ajlb signs add <board> <pos> <type>`.

### 2.4 Crate plugins

**ExcellentCrates 6.6.1** (public GitHub source) [src, [ExcellentCrates](https://github.com/nulli0n/ExcellentCrates-spigot)]:

- **Which blocks:** any non-air block. Air needs `Crate.Allow_Crates_In_Air_Blocks: true`.
- **Linking blocks:** use the editor's Link Tool, or write positions straight into the crate file
  as `Block.Positions: ["x,y,z,world"]` (integer block coordinates).
- **Hologram position:**
  - Line 0 sits at block base + 0.5 + (block bounding-box height / 2) + `Block.Hologram.Y_Offset`
    (default 0) + 0.2. That is **base + 1.2 for a full block** and base + ≈1.14 for a chest.
  - Further lines stack upward by `Crate.Holograms.LineGap` = **0.3**.
  - The default template has 3 lines (crate name, "You can open this crate N times.", a config
    hint), so it occupies about **1.2-1.8 above the block's base**.
  - Holograms are packet text displays: billboard VERTICAL, background ARGB 64,0,0,0, updated
    every 5 s. They need PacketEvents or ProtocolLib.
- **Visibility:** `Crate.Effects.Visibility_Distance: 24` for both particles and holograms.
- **Effect models and the space they use:**

  | Model | Radius | Height |
  | --- | --- | --- |
  | spiral | 1.0 | ≈ 1.9 |
  | helix | 0.75 | ≈ 2.4 |
  | sphere | 1.0 | about ±1 |
  | vortex | 1.5 | 3.5 |
  | tornado | ≈ 1.3 at the top | 3.15 |
  | pulsar | rings to **3.0** | ≈ 1 |
  | beacon | 0.55 | **a column up to ≈ 30** (40 steps × 0.75) |
  | heart | – | drawn ≈ 4 above the origin |

  Simple is the remaining model. All are client-side particles. Heights are relative to the
  effect origin at the crate.
- **Clicks:** left click previews and right click opens (`Crate.Reverse_Click_Actions: false`).
  `Crate.Preview_Cooldown` is 2500 ms; mass open (sneak) is limited to 30.
- **Pushback:**
  - Velocity = eye direction with Y = −0.4, × −1.25, so the player is thrown **backwards and up
    about 0.5**.
  - Leave 2-3 blocks of safe, flat floor behind the user position: no drop, no water edge, no
    other crate.
- **World opening** (simple roll) shows the reward at block top + Y_Offset and hides the hologram
  meanwhile.
- **Folia:** the public `plugin.yml` has **no `folia-supported` flag**. A competitor states there
  is "no Folia support" [list, [Phoenix comparison](https://www.phoenixplugins.com/comparisons/excellent-crates-alternative)].
  The user runs it on Canvas; check the exact build, since a newer or premium build may differ [?].

**CrazyCrates** (`folia-supported: true`) [src, [CrazyCrates](https://github.com/Crazy-Crew/CrazyCrates)]:

- **Example crate holograms:** `Height: 1.5` above the crate, `Range: 8`, background
  `transparent`.
- **QuadCrate** pastes a **5×3×5** schematic around the player: classic, nether, outdoors, sea,
  soul or wooden. It needs the player on a solid block and refuses to open if a blacklisted block
  is in the way ("need-more-room") or another player is opening nearby.
  - Keep a **flat, empty 5×5 (×3 high) pad** per QuadCrate, with no chests, signs or NPCs.
- The other types (CSGO, Wheel, Cosmic, Casino, Wonder) are GUI-based and need no world space.

**PhoenixCrates** [doc, [hologram](https://www.phoenixplugins.com/docs/phoenix-crates/main-features/crates/hologram)]:

- Any vanilla block can be the crate. Chests, ender chests, shulkers and trapped chests keep their
  lid animation, and heads are supported.
- A premium Model Engine mode uses animated models, which need space set aside for the model.
- Holograms are built in. Enabling "Preview Reward" **raises the hologram 0.75**; the default
  billboard is Center.

**Crate layout numbers** [calc from the above]:

- **Centre-to-centre spacing:**
  - **≥ 5 blocks** with default 3-line holograms. The longest default line, 32 characters, is
    ≈ 4.8 blocks wide.
  - Alternatively, shorten lines to ≤ 16 characters (≈ 2.4 wide) and space crates **≥ 3-4**.
  - **≥ 6-7** if the pulsar effect (3-block rings) is used.
- **Clearance above:**
  - ≥ 2.5 blocks clear above each crate block for hologram and roll display.
  - ≥ 4 for vortex or tornado effects; ≥ 5 for heart.
  - The beacon effect needs open sky; don't use it under a roof.
- **Standing area:** a user spot directly in front (within 4.5 reach). Size it by expected
  crowds: for a keyall, ≈ 3-4 blocks² per waiting player, so 60 players need a ~15×15 forecourt.

### 2.5 PlaceholderAPI and leaderboard sources

- Use any numeric placeholder: Vault balance, the `statistic_*` expansion, plugin stats (shards,
  kills, playtime).
- ajLeaderboards caches them; never feed it placeholders that are already top lists [doc].
- **Tops podiums:** create NPCs named and skinned with the `_name` and `_skin` placeholders.
  Citizens refreshes skin placeholders every `npc.skins.placeholder-update-frequency-ticks` (5 min
  default) [src].

### 2.6 Regions, spawn protection, the spawn point

**WorldGuard flags for a spawn hub** [doc, [flags](https://worldguard.enginehub.org/en/latest/regions/flags/)].
A starting template:

```
/rg define spawn                     (select the hub first: a polygon or cuboid, //expand vert for full height)
/rg setpriority spawn 10
/rg flag spawn pvp deny
/rg flag spawn mob-spawning deny
/rg flag spawn mob-damage deny
/rg flag spawn creeper-explosion deny
/rg flag spawn other-explosion deny
/rg flag spawn tnt deny
/rg flag spawn fire-spread deny      (and lava-fire deny; both need high-frequency flags enabled)
/rg flag spawn lightning deny
/rg flag spawn block-break deny
/rg flag spawn block-place deny
/rg flag spawn use deny              (then allow interact only where needed)
/rg flag spawn chest-access deny
/rg flag spawn item-frame-rotation deny
/rg flag spawn entity-item-frame-destroy deny
/rg flag spawn entity-painting-destroy deny
/rg flag spawn vehicle-place deny
/rg flag spawn leaf-decay deny       (plus ice-melt, snow-melt, snow-fall, grass-growth, vine-growth,
                                      crop-growth, coral-fade, sculk-growth deny to freeze the build)
/rg flag spawn fall-damage deny
/rg flag spawn natural-hunger-drain deny   (or the feed-* flags)
/rg flag spawn enderpearl deny       (chorus-fruit-teleport deny)
/rg flag spawn greeting-title "<Server>"   (and farewell-title on the warzone boundary)
/rg flag warzone pvp allow           (child or higher-priority region for the PvP area)
```

**Region rules:**

- `__global__` has the lowest priority, and higher priority wins.
- A child region inherits flags from its parent.
- At equal priority a state flag resolves to `deny` if any region denies it.
- Protection flags without a value follow `build`.
- Non-members are therefore already denied `use`, `interact` and `chest-access`; setting them
  explicitly just documents the intent.
- Crate clicks still work in ExcellentCrates: its `PlayerInteractEvent` handler runs at HIGH
  priority and does not skip cancelled events [src].
- Test every NPC and crate click with a non-op account after setting flags.

**Folia caveat:**

- Official WorldGuard does not ship Folia support.
- A community fork exists ([AllyncID/WorldGuard-Folia](https://github.com/AllyncID/WorldGuard-Folia),
  built for Folia 1.21.11).
- Commercial alternatives exist, e.g. SMP Regions [fan, [search summary](https://builtbybit.com/resources/smp-regions.104646/updates)].
- Check what the Canvas server actually uses before writing flags.

**Vanilla spawn protection and spawn point** [doc, [server.properties](https://minecraft.wiki/w/Server.properties),
[Spawn protection](https://minecraft.wiki/w/Spawn_protection), [Game rule](https://minecraft.wiki/w/Game_rule),
[setworldspawn](https://minecraft.wiki/w/Commands/setworldspawn), [Spawn chunk](https://minecraft.wiki/w/Spawn_chunk)]:

- **`spawn-protection`** (default 16): a (2x+1)² square centred on world spawn, i.e. 33×33.
  - It blocks non-ops from placing and breaking blocks, Overworld only.
  - It is disabled when there are no ops.
  - Set it to `0` when WorldGuard (or similar) handles protection, so it can't interfere.
- **Game rule `respawn_radius`**, renamed from `spawnRadius` in 25w44a/1.21.11: default **10**.
  Set it to **0** so every player appears on the designed spot.
  - Spawn plugins (`/setspawn`) usually teleport exactly anyway.
  - Other 26.x renames: `spawn_mobs`, `advance_time`, `advance_weather`, `mob_griefing`,
    `keep_inventory`. `doFireTick` was replaced by `fire_spread_radius_around_player` (128).
- **`/setworldspawn [<pos>] [<angle>]`**: the angle is the facing yaw (default 0.0 = south). Since
  1.21.9 it also takes an optional pitch and works in other dimensions.
- **Spawn chunks were removed in 1.21.9** (25w31a), together with the `spawnChunkRadius` game rule.
  - An empty spawn now unloads like any other area.
  - Use `/forceload` only if something must tick with nobody there.

### 2.7 Performance and Folia

**Entity budget** [src, [calc]]:

| Plugin | Entities | Server cost |
| --- | --- | --- |
| DecentHolograms | 1 packet entity per line; a 5-board hall of 12 lines each = 60 client entities | none as server entities; packet and placeholder work per viewer every `update-interval` (20 ticks) |
| FancyHolograms | 1 entity per board | – |
| ExcellentCrates | packet text displays | – |
| FancyNpcs, ZNPCsPlus | packet NPCs | – |
| Citizens | real server entities unless created with `-p` (packet) | ticked like players |
| Item frames, armour stands, paintings | real entities | ticked, so keep decoration with them low near the spawn point |

**Folia regions** [doc, [overview](https://docs.papermc.io/folia/reference/overview),
[region logic](https://docs.papermc.io/folia/reference/region-logic), [FAQ](https://docs.papermc.io/folia/faq)]:

- Chunks are split into independently ticking regions. Adjacent regions merge.
- Only the owning thread may touch a region's data, and global state (time, weather) runs in a
  20 TPS global task.
- Region section size and merge radius are configurable powers of two, with no fixed numbers in
  the docs.
- "Server types that naturally spread players out, like skyblock or SMP, will benefit the most".

**Consequences:**

- **A crowded spawn is effectively one region on one thread** [calc, inference from those rules].
- So the spawn must be cheap to tick:
  - no hoppers, redstone clocks, farms or mob spawning;
  - fluids static (no flowing water features that update);
  - fire spread off;
  - few real entities (prefer packet NPCs and holograms);
  - no villagers;
  - particles client-side.
- Put the AFK area and any arena with heavy entity load in another world, or far enough away that
  their loaded chunks don't merge with the hub [calc].
- Since there are no spawn chunks on 26.x, the hub loads on the first join after a restart. NPC
  plugins handle this; Citizens loads the chunk before spawning [src].

### 2.8 Size versus players and view distance

**No published formula exists** [?]. Evidence and derived rules:

- **Observed size tiers** (§1.6):
  - pre-made SMP spawns: 100-200, mostly 150×150;
  - lifesteal with warzone: 300-500;
  - showpiece cities: 600-1000;
  - pro commission tiers: ≤35, ≤100, ≤200, ≤350, ≤500, ≤1000.
- **The compact school** [fan]:
  - Fumora: "a 30x30 block plaza, not a 200x200 city", small enough to "see every exit from the
    center".
  - Forum: "Make it run aroundable".
- **View distance** [doc, calc]:
  - `view-distance` defaults to 10 chunks (≈ 160 blocks) and `simulation-distance` to 10.
  - From the centre of a 150×150 spawn the far corners are ≈ 106 blocks away, so the whole spawn
    is visible from the spawn point.
  - At 300×300 the corners are ≈ 212 blocks away, beyond default view.
  - On servers that lower view distance to 6-8 (96-128 blocks), keep the composed view within
    about 100 blocks of the spawn point.
- **Crowd capacity** [calc]:
  - Plan the spawn plaza for the number of players present at once (after restarts, keyall,
    events) at ≈ 3-4 blocks² each: 100 players ≈ a 20×20 open area.
  - Crowd hot spots are the crates and the AH.
  - Folia makes the crowd's region the bottleneck, so a bigger spawn does not help performance;
    a cheaper spawn does.
- **Recommendation** [calc]:
  - normal spawn: built core 35-70 inside 60-120 of shaped terrain;
  - spawn+: 150-260;
  - PvP lobby: 60-120.
  - Go bigger only to add districts that each have a purpose.

---

## 3. Human-made versus "AI/procedural-looking" builds

### 3.1 What the sources say

- **Kate Compton's "10,000 bowls of oatmeal"** ([post](https://galaxykate0.tumblr.com/post/139774965871/so-you-want-to-build-a-generator)):
  - Generated variety can be "mathematically unique" yet the viewer "will likely just see a lot
    of oatmeal". "Perceptual uniqueness is the real metric".
  - "Humans seem to like perceiving evidence of process and forces"; such "structurally-generated
    subtleties suggest … there is an alive world behind this object".
  - "Not everyone can be a main character": most pieces are background, a few are memorable.
- **GDMC judges** (handbook `procedural.md` §1, with sources there):
  - Points are lost for flattening and grid layouts, copies, floating foundations, empty
    interiors, generator traces and "too many of one thing".
  - Aesthetics is scored as consistency plus "no jarring artifacts a human would not make".
- **Gradient doctrine**:
  - Conquest Reforged ([gradients](https://www.conquestreforged.com/guides/gradients)):
    "Splattering … random placement of another block to create haphazard variation" is "a
    somewhat lazy way of adding detail, and rarely looks good". Transitions should step through
    the palette in order. Cluster sizes are varied "so as not to have repeating patterns", and
    weathering goes where water runs (below windows, rain-collecting roof areas).
  - WesterosCraft ([gradients](https://www.westeroscraft.com/docs/building/fundamentals/gradients),
    [exteriors](https://www.westeroscraft.com/docs/building/fundamentals/exteriors)): palettes run
    "from 3 elements or larger than 20". Wear goes "around windows, edges and eaves". The named
    failures are splattering, "smallpox" and "sandwiching". "Adding depth to a facade should serve
    the structure, not decorate it for its own sake"; avoid "long unbroken runs".
- **Minecraft.net landscaping tutorial** (citing BlueNerd; search summary, the page returned 503):
  "keeping straight runs under seven blocks helps builds look organic". Build terrain in at least
  two layers ([article](https://www.minecraft.net/en-us/article/tutorial--tips-for-landscaping-and-terraforming)).
  Raeyzeus (minecraft.net) warns that detail should support the structure, not cover it, and stay
  readable from a distance ([article](https://www.minecraft.net/en-us/article/raeyzeus-top-5-building-tips)).
- **Critiques of AI builds**:
  - "Detail without hierarchy, scale without purpose, or symmetry without character". It "can
    satisfy the visible nouns in a prompt" without convincing proportions, circulation or a
    findable entrance. "A spawn hub may fail to communicate direction" ([EasyClaw](https://easyclaw.com/blog/knowledge/minecraft-building-ai)).
  - Generators "prioritize visual complexity over function": "stairs that lead nowhere", "Doors
    missing", "AI rarely places torches or light sources correctly" ([BlockGPT](https://blockgpt.ai/blog/how-to-turn-ai-builds-into-usable-minecraft-worlds)).
  - Both are vendor blogs, but they agree with the GDMC findings.
- **Trees** (community tutorials; search summaries):
  - Never make branches identical or "branch out at the same height".
  - Leaves "primarily grow at the ends of branches … less directly on the trunk".
  - The trunk tapers.
  - Prune overlong branches and boxy bottoms.
  - Sources: [PMC trees](https://www.planetminecraft.com/blog/how-to-make-your-trees-better/),
    [cypress](https://www.planetminecraft.com/blog/how-to-build-custom-trees-cypress/),
    [Avomance companion](https://www.planetminecraft.com/blog/a-companion-guide-to-avomance-s-how-to-build-a-giant-custom-tree-freestyle-tutorial/).
  - The handbook's `nature.md` §1 has the measured version.

### 3.2 The tells and their replacements

Each row: the tell, why it reads as generated, the human technique that replaces it, and a check
the builder can run on its own output. The checks are [calc] heuristics.

**1. Repetition and uniform spacing.** Example: identical lamp posts every 4 blocks; 8 identical
NPC booths in a ring.
- *Why it reads as generated:* one rule applied without exceptions.
- *Human technique:*
  - **Varied rhythm**: A-B-A-C, or groups like 2-3-2.
  - Pair or cluster small elements, and use quotas.
  - Interrupt runs with a landmark, gate or bench.
  - Each booth gets its own roof form or material and props for its function.
- *Check:* no element repeats identically more than 3 times in one view. Exactly equal spacing is
  allowed only for structural columns.

**2. Perfect symmetry with no hierarchy.** Example: 4-way or 8-way radial hub, every spoke equal.
- *Why:* no decision about what matters.
- *Human technique:*
  - **Controlled asymmetry inside a symmetric frame.** Keep the main axis and gate symmetric;
    vary the districts.
  - **A hierarchy of masses**: one hero 1.5-2× the ring buildings, secondaries ⅓-½ of the hero.
  - Height steps of ≥ 2-6 between tiers.
- *Check:* ≥ 3 height tiers; no two spokes share footprint and roof; the hero is ≥ 25% taller than
  its neighbours (handbook law 3).

**3. Noise-speckled texture.** Example: per-block random mix of 5 stones.
- *Why:* randomness without cause.
- *Human technique:*
  - **Block gradients**: drip (vertical) or clustered (varied clumps), 3-7 blocks of one family
    ordered by value.
  - Wear goes where it is caused: ground contact, edges, eaves, under windows and spouts, along
    paths.
- *Check:* no isolated single blocks of an accent inside a field. Accent blocks touch their own
  kind or follow an edge (handbook `quality-and-critique.md` §2).

**4. Flat oversized floors.** Example: a 60×60 plaza of one block.
- *Why:* leftover space, not designed space.
- *Human technique:*
  - **Shaped negative space**: borders and inlays every 7-12 blocks.
  - Level changes of 1-3 steps, planters, benches.
  - Paving that changes at thresholds.
  - **Path wear**: darker or rougher lines along desire paths, to NPC aprons and gates.
- *Check:* the largest single-material floor patch is ≤ about 100 cells; ≥ 2 floor levels in the
  plaza; every crossing of the plaza leads to a destination.

**5. Lollipop or blob trees.** Example: a log column with a leaf sphere, copy-pasted.
- *Why:* a single primitive.
- *Human technique:*
  - **Hand-shaped trees with branch logic**: 3-5 primaries at staggered heights, leaf clusters at
    the branch tips, flat undersides.
  - A tapering trunk with a root flare.
  - 2-3 species and 3 size classes, planted in groups with clearings.
- *Check:* no two trees share seed and height; leaves sit ≤ 5 blocks from wood
  (`nature.md` §1.2).

**6. Terrain that looks like a noise heightmap.** Example: smooth random hills, the same slope
everywhere, grass on every face.
- *Why:* noise has no geology and no purpose.
- *Human technique:*
  - **Landforms with intent**: ridges framing the spawn view, terraces carrying the build, a
    valley as the axis.
  - **Layered strata and overhangs** on steep faces (1-3 block bands, darker toward the base).
  - Scree fans, water-cut channels.
  - Surface material by slope and wetness.
  - Straight terrain edges **< 7 blocks** (minecraft.net).
- *Check:* every cliff of ≥ 3 has strata; there are no 1-block spikes or pits; the terrain leads
  the eye to the hero (`nature.md` §2).

**7. Everything at the same scale.** Example: all buildings 8-10 tall; doors, booths and the
landmark at one scale.
- *Why:* no tiers.
- *Human technique:*
  - **Pick scale tiers on purpose**: human scale (1:1) at NPC booths and benches, showcase (~1.5×)
    for feature buildings, monumental (2-3×) only for the hero and the gate.
- *Check:* 3 tiers present; NPC fronts are at human scale (2-3 tall openings, 1-block steps).

**8. No set dressing or story.** Example: an NPC on a bare platform, crates on a slab.
- *Why:* function without fiction.
- *Human technique:* **props that tell a story** at each feature, with wear at the aprons:
  - AH: auction podium (lectern), bell, ledgers, roped-off lots, item frames of "lots";
  - Shop: barrels, produce, scales, awnings;
  - Crates: vault door, chains, coin heaps (gold blocks used sparingly), guarded lanterns;
  - RTP: map table, compass rose inlay, travel packs, signposts, a departure gate;
  - AFK: pool and loungers;
  - Duels: weapon racks, scoreboard, banners of past champions.
- *Check:* every NPC place has ≥ 3 props tied to its function, and the floor shows wear in front.

**9. Pixel-art text.** Example: wool or concrete letters 1 block deep spelling everything.
- *Why:* text rendered as a bitmap.
- *Human technique:* use holograms for information; reserve block letters for the server name or
  logo and a few big titles, built in 3D (depth 2-3, a stair/slab bevel, a material gradient) and
  attached to architecture (§3.4).
- *Check:* ≤ 1-2 block-letter signs per spawn; no block-letter text under about 5 tall.

**10. Over-saturation.** Example: primary-colour concrete and wool everywhere; rainbow district
colours on every surface.
- *Why:* colour used as decoration, not as information.
- *Human technique:*
  - A **value structure**: base, secondary and accent at about 60-30-10.
  - Saturated colour only on wayfinding (district banners, awnings, the brand accent at ≤ 10%).
  - Muted bases: stone, wood, terracotta, plaster.
- *Check:* the accent is ≤ 10% of visible surface; each district has one identifying colour; no
  saturated colour in large floor or wall fields.

**11. Every edge identical.** Example: the same trim on every roof, wall and plaza edge.
- *Why:* one detail module everywhere.
- *Human technique:*
  - An **edge hierarchy**: primary edges (eaves of the hero, the plaza rim) get the richest trim,
    secondary edges less, and some edges stay soft (planting spilling over, broken stone).
  - **Break long lines** with posts, bays and steps every 5-12 blocks.
- *Check:* ≥ 2 trim profiles; no straight wall run > 5 without an offset (handbook law 5); no path
  or edge straight for > 7 in organic areas.

**12. Grid lighting and dark corners.** Example: lanterns on a lattice; dark pockets.
- *Why:* light placed by rule, not by use.
- *Human technique:* light the routes and the hero hardest, hang lanterns, hide light under
  slabs, keep light level ≥ 1 everywhere (hostile mobs spawn at block light 0).
- *Check:* no light-0 cells inside the safe zone; light pools lead along the axes.

**13. Dropped-in buildings.** Example: buildings on a flat pad with vertical cut edges; floating
foundations.
- *Why:* no ground contact.
- *Human technique:* foundations step down the slope, with plinths, retaining walls and stairs;
  buildings are bedded into the terrain.
- *Check:* no exposed dirt under walls; ≤ 3-4 exposed foundation courses (`composition.md`).

**14. Detail spread evenly everywhere.** Example: uniform medium detail on every surface.
- *Why:* there is no focal point.
- *Human technique:*
  - **Detail clustered at focal points**: entrances, NPC fronts, the hero, gates.
  - Leave 30-50% of each wall calm (handbook law 9).
- *Check:* detail density near the 5 most important places is ≥ 2× the average.

### 3.3 Spawn-specific human moves

1. **The view is composed.** Use a frame (arch, trees, cliff edges) at the spawn point. The hero
   sits on the axis 20-40 blocks out. The RTP gate or main path is visible, and decoration sits
   to the sides (Fumora, Hypixel, `composition.md` §9).
2. **Each feature has a fiction.**
   - The crates are a vault or shrine; the AH is an exchange hall with a gallery; the shop is a
     market street; the RTP is a harbour, train station or ancient gate; the leaderboards are a
     hall of fame with statues.
   - Players remember the place, not the NPC.
3. **Wear marks the traffic.** Paths widen and darken where players queue: in front of the AH,
   the crates and the RTP. The rarely visited corners stay greener.
4. **History.** Show a few signs of age or construction: a scaffold on a "coming soon" district,
   an older ruined section, a statue of the server's first season champion. Server lore makes a
   spawn feel human.
5. **One season set piece.** A plaza beside spawn redecorated each season or event (MCC Seasonal
   Plaza). The rest stays stable, so returning players notice the change.
6. **The boundary is designed.** The safe-zone edge is a wall, a moat or a material change, with
   banners and a greeting title. It is never an invisible line (Lifesteal Network barrier ring,
   "red outline" listings).

### 3.4 Signage: holograms, block letters, banners, maps

The evidence on how professional spawn teams sign is thin, so the doctrine below is a [calc]
synthesis. Use each medium for what it does best:

- **Hologram text** is for information that changes or is small: NPC names, board contents, crate
  names and key counts.
  - It is readable only within ≈ 10-15 blocks at scale 1 (§2.3).
  - It is visible only within the plugin's range (20/24/48 by default).
  - Place it where players already stand, at 2-4 blocks above the floor.
- **Block letters** are for the server name or logo and, at most, a few district titles.
  - The market sells logo art separately and buyers praise sellers who add it.
  - **Sizing:**
    - **5 blocks tall is the floor** for a pixel font (3×5 glyphs). Legibility isn't the limit
      at hub distances; a 5-tall letter seen at 60 blocks still spans ≈ 64 px.
    - Use **7-9 tall** when stairs and slabs need room for bevels and serifs.
    - Use **10-15 tall** for a hero logo meant to be read from the spawn point across a
      spawn+ (40-100 blocks).
  - **Construction:** stroke 1 block up to 7 tall, 2 blocks above 9. Depth 2-3 with a contrasting
    rim, gaps of 1 block. Mount the letters on a gate, wall or cliff, angled to face the spawn
    point.
  - The README's "quartz lettering, 5 blocks tall" sits at the minimum of this range.
- **Banners** do district identity at distance: colour and emblem per district, legible far
  beyond text.
- **Maps in item frames** (ImageFrame plugin: "Load Images on Maps & Item Frames", GIFs, 26.2
  support; Folia confirmed only for older builds [list,
  [ImageFrame](https://speedgot.ajg0702.us/resources/106031/updates)]) are for logos, rules boards
  and menus at close range. Each map is 1×1 block at 128×128 px; a 4×3 frame wall is a readable
  poster within ≈ 10 blocks.
- **Text displays with scale 2-4** (FancyHolograms `scale`) are the modern middle ground for big
  titles without block letters. Keep them on a background panel or architectural frame so they
  don't float in a void.

---

## 4. Spawn design checklist and client questionnaire

### 4.1 Checklist (follow it in order)

**A. Brief and program**
1. Archetype chosen: normal (60-120), spawn+ (150-260) or PvP lobby (60-120).
2. Program sheet written: every NPC, board, crate and portal, with its place name, the plugin, the
   command it runs, and the expected crowd.
3. Spare slots: +20-30% NPC spots dressed as optional (spawn+); 1-2 seasonal crate pads.

**B. Site and layout**
4. Spawn point fixed: coordinates, yaw/pitch, `respawn_radius 0`.
   - The first view frames the hero on the axis at 20-40 blocks.
   - The way out (RTP gate or path) is visible within the first view.
   - Decoration stays to the sides or behind.
5. Core NPCs within ≈ 15-25 blocks of spawn (normal); the farthest district ≤ 60-75 (spawn+).
6. Hierarchy:
   - hero 1.5-2× the ring;
   - 3 scale tiers;
   - districts each with their own silhouette, material accent and banner colour;
   - controlled asymmetry inside the symmetric frame.
7. The safe-zone boundary and the PvP or warzone edge are built, not invisible. The AFK area is
   placed separately (another world or far off on Folia).

**C. Plugin space (reserve before detailing)**
8. NPC: a block-centred standing spot (`-c` / `center`), a 3×3 apron (5×5 for AH, shop and
   crates), ≥ 3 between NPCs, reachable within 3 blocks, facing the approach. Leave 2.3+ clear
   above the feet for the nametag.
9. Crates: ≥ 5 apart (or ≥ 3-4 with lines ≤ 16 characters). Leave 2.5-4 clear above, effect
   radius clear around, and 2-3 blocks of safe floor behind the user (pushback). QuadCrate gets a
   5×5×3 empty pad. Record `Block.Positions` as `x,y,z,world`.
10. Boards:
    - backdrop 5-7 × 5-6 per board, standing area 4-12 in front;
    - DH anchor at floor + 5.0 for 12 lines, text-display anchor at floor + 1.5;
    - a block or banner title above each board;
    - a top-3 podium with NPC statues.
11. Visibility ranges raised where the hub needs it: FancyNpcs and FancyHolograms 20 → 48-64;
    ExcellentCrates 24 if the crate hall is large; within Paper's tracking range.

**D. Making it human**
12. No uniform repetition (A-B-A-C), no per-block noise (gradients with causes), no flat
    oversized floors (borders, levels, wear), no lollipop trees, no heightmap terrain (strata,
    overhangs, intent).
13. Props that tell a story at every NPC place (≥ 3), wear at the aprons, one seasonal set piece,
    signs of history.
14. Signage: holograms for information; block letters only for the name or logo (≥ 5 tall,
    7-15 for the hero); banners for districts; maps for posters.
15. Light everything to level ≥ 1, light the routes and the hero most, no grid lattices.

**E. Performance and delivery**
16. Nothing ticks:
    - no hoppers, redstone, farms or flowing fluids;
    - mob spawning denied;
    - fire spread off;
    - few real entities (packet NPCs and holograms preferred; minimal item frames and armour
      stands).
17. WorldGuard (or the Folia-capable equivalent) region with the flag template (§2.6);
    `spawn-protection=0`.
18. A placement sheet delivered with the build:

```
SPAWN PLACEMENTS — <Server>  world=spawn  origin=<x,y,z>  facing=<yaw>
spawnpoint   x y z yaw pitch                   /setworldspawn x y z yaw pitch ; gamerule respawn_radius 0
npc shop     x+.5 y z+.5 yaw                   /npc create Shop --at x:y:z:spawn:yaw -c   (Citizens)
                                               /npc create shop --location x y z --world spawn ; /npc rotate shop yaw 0 (FancyNpcs)
board money  top-line x y z                    /dh create top_money -l:spawn:x:y:z --center &6&lTOP MONEY
crate vote   x,y,z,spawn                       crates/vote.yml -> Block.Positions: ["x,y,z,spawn"]
region spawn polygon pts / y range             /rg define spawn ... flags (template §2.6)
```

### 4.2 Client questionnaire

The first round decides the layout; the follow-up round perfects it after a block-out or sketch
is shown. It is synthesised from commission pages (TimeCube size tiers, MWT version and deadline
fields, PMC theme and price requests), marketplace feature lists and the plugin facts above.

**Round 1: before any block-out**

1. **Server:** name, game mode (economy SMP, lifesteal, box, practice), player peak and typical
   concurrent count, and how players usually leave spawn.
2. **Archetype:** normal spawn, spawn+, PvP lobby or other; reference servers they like or
   dislike.
3. **Size:** a footprint tier (≤100, 150, 200-260, 300+), the maximum height and depth, and the
   paste origin. Prices scale by footprint, and height costs extra.
4. **Theme and style:** setting (mountain valley, island, desert canyon, winter, void sky island),
   architecture (medieval, fantasy, modern/sci-fi, Japanese, nature), and time of day.
5. **Version and platform:** Minecraft version, server software (Folia/Canvas 26.x here), delivery
   format (`.schem` via FAWE, `.litematic`, region files at 0,0).
6. **NPC list:** shop, crates, AH, RTP, store/ranks, sell, orders, warps, kits, quests or battle
   pass, AFK, duels, bounties, teams, events, tutorial. Which ones get their own building, and the
   plugin per NPC.
7. **Leaderboards:** which stats (money, kills, deaths, playtime, blocks mined, shards, votes,
   KDR), how many, the periods (all-time, monthly, weekly, daily), and whether to build a top-3
   podium.
8. **Crates:** names and tiers, count now and later (seasonal), the plugin (ExcellentCrates here)
   and opening type (GUI, world roll, QuadCrate), the crate block, and the expected keyall crowd.
9. **Colours and branding:** server colours, logo or mascot, the exact name spelling and casing,
   accent colour limits, anything they hate.
10. **Spawn facing and first view:** which way players face, and what they must see first (logo,
    crates, the RTP gate, a vista).

**Round 2: follow-up**

1. **Out-to-wild:** an RTP NPC, biome RTP portals (which biomes), dimension portals, a drop hole,
   or a gate; the RTP plugin and whether it supports portal regions on Folia.
2. **Safe zone and PvP:** the warzone or arena location and size, how the boundary should look, the
   combat-tag rules, a KoTH or moshpit.
3. **AFK:** whether an AFK area is wanted, where (same world or another), and the reward plugin
   (e.g. AxAFKZone).
4. **Signage:** block-letter name (where, how tall), district titles, hologram style (colours,
   MiniMessage), maps or posters (rules, store, Discord).
5. **Story and extras:** server lore, staff or champion statues, a seasonal plaza, parkour, an
   event stage, player market stalls, Easter eggs.
6. **Plugins and limits:**
   - the NPC plugin (Citizens, FancyNpcs or ZNPCs);
   - the hologram plugin (DecentHolograms or FancyHolograms);
   - region protection on Folia;
   - view and simulation distance;
   - entity budget;
   - Bedrock (Geyser) players, since Bedrock renders some blocks and entities differently [?].
7. **Navigation:** expected flow for new versus returning players, a "Start Here" or tutorial NPC,
   whether a warp menu exists.
8. **Delivery and revisions:** deadline, budget range, number of revision rounds, renders or a
   video tour, the placement sheet (NPC, hologram and crate coordinates plus commands).

---

## 5. Known gaps

- DonutSMP's current spawn layout, size and building list; FreshSMP's spawn layout; and the
  Minemen Club and PvP Legacy lobby layouts. None had a reachable public description. YouTube,
  Fandom, BuiltByBit and Fiverr pages could not be fetched, so details come from search summaries.
- No published standard for block-letter height or spawn size per player count. The numbers in
  §2.8 and §3.4 are derived.
- Two values were not confirmed in the wiki: the exact text-display line pitch (≈ 0.25) and the
  name-label offset (hitbox + 0.5). Measure both in game.
- Whether the ExcellentCrates build the user runs supports Folia, and which region plugin the
  Canvas server uses.
- Paper docs list `entity-tracking-range` defaults of players 128, animals/monsters/misc 96,
  display 128, other 64. These were read twice from the docs page but differ from older Spigot
  defaults. Check the server's own `spigot.yml`.

---

## 6. Sources

**Server wikis and pages**
- DonutSMP Wiki (community): https://donutsmp.wiki/about-donutsmp , https://donutsmp.wiki/crates , https://donutsmp.wiki/afk-zone , https://donutsmp.wiki/random-teleportation , https://donutsmp.wiki/rtp-queue , https://donutsmp.wiki/big-june-update , https://donutsmp.wiki/donutsmp-beginner-guide , https://donutsmp.wiki/category/mechanics , https://donutsmp.wiki/category/economy , https://donutsmp.wiki/historical-features
- DonutSMP third-party: https://techbullion.com/what-new-players-should-know-before-purchasing-donutsmp-money/ , https://gameboost.com/blog/how-to-get-shards-in-donut-smp , https://donutsmpexchange.com/guides/donutsmp-spawn
- FreshSMP listings: https://minecraft.how/server/freshsmp , https://minelist.io/freshsmp
- Lifesteal Network: https://lifestealnet.fandom.com/wiki/Spawn_(Season_6) , https://lifestealnet.fandom.com/wiki/Spawn
- Netherite.gg: https://netherite.gg/wiki/lifesteal/spawn-and-afk
- Torrent SMP: https://wiki.torrentsmp.com/lifesteal/crates
- Minemen Club: https://minecraftservers.org/server/591376 ; PvP Legacy: https://pvplegacy.fandom.com/wiki/KitPvP
- Hypixel: https://hypixel.fandom.com/wiki/Main_Lobby , https://www.minecraftiplist.com/blog/exploring-hypixels-main-lobby-zones-npcs-and-ultimate-guide/
- MCC Island: https://mccisland.wiki/Island_Entrance , https://mccisland.wiki/Island_Locations , https://mcchampionship.com/island/ , https://mcchampionship.com/threads/the-complete-guide-to-mcc-island.7280/

**Marketplaces and build teams**
- BuiltByBit: https://builtbybit.com/resources/smp-spawn-lobby.77504/ , https://builtbybit.com/resources/donutsmp-spawn.112415/ , https://builtbybit.com/resources/space-station-spawn.113244/ , https://builtbybit.com/resources/donutsmp-style-spawn-quantum-city.102400/ , https://builtbybit.com/resources/donutsmp-spawn-map-better-made.43529/ , https://builtbybit.com/resources/free-smp-spawn.102520/ , https://builtbybit.com/resources/free-smp-spawn-nr-2.102664/ , https://builtbybit.com/resources/mini-cozy-spawn-100x100.113498/ , https://builtbybit.com/resources/spawn-tropical-island-150x150.23238/ , https://builtbybit.com/tags/npc-area/ , https://builtbybit.com/resources/lobby-practice-pvp-100x100.54239/ , https://builtbybit.com/resources/ultimate-hub-a-premium-lobby-setup.50094/ , https://builtbybit.com/resources/life-hub.124738/ , https://builtbybit.com/threads/lobby-skywars-medieval-300x330.704201/ , https://builtbybit.com/resources/minecraft/builds/boxpvp/ , https://builtbybit.com/resources/premium-leaderboards-configuration.108993/ , https://builtbybit.com/resources/donut-smp-spawn.74964/ , https://builtbybit.com/threads/server-logo.617863/ , https://builtbybit.com/resources/justrtp-randomtp-evolved.70322/update/260909/ , https://builtbybit.com/resources/perfteleport-cross-server-folia.95973/updates?page=2 , https://builtbybit.com/threads/strikepractice-practice-pvp-plugin.208863/page-6 , https://builtbybit.com/resources/smp-regions.104646/updates
- MCModels: https://mcmodels.net/products/9026/atmospheric-survival-lifesteal-smp-spawn-160x160 , https://mcmodels.net/products/15416/medieval-server-spawn , https://mcmodels.net/products/10259/lifesteal-castle-spawn , https://mcmodels.net/products/9920/desert-temple-spawn , https://mcmodels.net/products/16157/cyberpunk-city-spawn , https://mcmodels.net/products/14927/bwsw-lobby , https://mcmodels.net/products/15377/christmas-lifesteal-with-warzone
- Others: https://store.abfielder.com/products/crimsonvale-lifesteal-warzone , https://store.abfielder.com/products/summer-lifesteal-spawn-with-warzone , https://origin-builds.com/collections/lifesteal , https://www.mc-mod.net/?p=527386
- Commission pricing: https://www.timecubeproductions.com/commissions , https://www.fiverr.com/fingertz/build-a-hub-or-lobby-for-a-minecraft-server , https://www.fiverr.com/tinekrizaj/build-you-a-minecraft-spawn-lobby-hub-house-and-more , https://www.fiverr.com/joluks/build-you-a-beautiful-minecraft-lobby-or-map , https://www.mwtstudios.net/hire/ , https://www.planetminecraft.com/forums/pmc/workshop/requesting-building-commissions-201986

**Plugin source and docs (read this session)**
- Citizens: https://github.com/CitizensDev/Citizens2 , https://github.com/CitizensDev/CitizensAPI , https://wiki.citizensnpcs.co/Commands
- FancyNpcs and FancyHolograms: https://github.com/FancyInnovations/FancyPlugins , https://fancyinnovations.com/docs/minecraft-plugins/fancynpcs/commands/npc , https://docs.fancyinnovations.com/fancynpcs/commands/npc/
- ZNPCsPlus: https://github.com/Pyrbu/ZNPCsPlus
- DecentHolograms: https://github.com/DecentSoftware-eu/DecentHolograms
- ajLeaderboards: https://github.com/ajgeiss0702/ajLeaderboards , https://wiki.ajg0702.us/ajleaderboards/setup/setup , https://wiki.ajg0702.us/ajleaderboards/setup/placeholders
- ExcellentCrates: https://github.com/nulli0n/ExcellentCrates-spigot ; Phoenix comparison: https://www.phoenixplugins.com/comparisons/excellent-crates-alternative
- CrazyCrates: https://github.com/Crazy-Crew/CrazyCrates
- PhoenixCrates: https://www.phoenixplugins.com/docs/phoenix-crates/main-features/crates/hologram
- AxAFKZone: https://hangar.papermc.io/Artillex-Studios/AxAFKZone/versions/1.11.0
- ImageFrame: https://speedgot.ajg0702.us/resources/106031/updates
- WorldGuard: https://worldguard.enginehub.org/en/latest/regions/flags/ ; Folia fork: https://github.com/AllyncID/WorldGuard-Folia
- Folia: https://docs.papermc.io/folia/reference/overview , https://docs.papermc.io/folia/reference/region-logic , https://docs.papermc.io/folia/faq ; Paper spigot.yml: https://docs.papermc.io/paper/reference/spigot-configuration

**Minecraft Wiki**
- https://minecraft.wiki/w/Player , https://minecraft.wiki/w/Attribute , https://minecraft.wiki/w/Sprinting , https://minecraft.wiki/w/Display , https://minecraft.wiki/w/Name_Tag , https://minecraft.wiki/w/Server.properties , https://minecraft.wiki/w/Spawn_protection , https://minecraft.wiki/w/Game_rule , https://minecraft.wiki/w/Commands/setworldspawn , https://minecraft.wiki/w/Spawn_chunk

**Design and critique**
- Kate Compton: https://galaxykate0.tumblr.com/post/139774965871/so-you-want-to-build-a-generator
- Conquest Reforged gradients: https://www.conquestreforged.com/guides/gradients
- WesterosCraft: https://www.westeroscraft.com/docs/building/fundamentals/gradients , https://www.westeroscraft.com/docs/building/fundamentals/exteriors
- Minecraft.net: https://www.minecraft.net/en-us/article/tutorial--tips-for-landscaping-and-terraforming , https://www.minecraft.net/en-us/article/raeyzeus-top-5-building-tips , https://www.minecraft.net/en-us/article/how-do-mega-builds
- AI-build critiques: https://easyclaw.com/blog/knowledge/minecraft-building-ai , https://blockgpt.ai/blog/how-to-turn-ai-builds-into-usable-minecraft-worlds
- Spawn UX: https://www.fumora.net/lab/minecraft-server-new-player-retention , https://www.minecraftforum.net/forums/minecraft-java-edition/creative-mode/363056-how-to-build-a-practical-good-looking-spawn
- Theme-park layout: https://touringplans.com/blog/an-urban-designer-looks-at-main-street/ , https://allears.net/ae/issue764.htm
- Trees: https://www.planetminecraft.com/blog/how-to-make-your-trees-better/ , https://www.planetminecraft.com/blog/how-to-build-custom-trees-cypress/ , https://www.planetminecraft.com/blog/a-companion-guide-to-avomance-s-how-to-build-a-giant-custom-tree-freestyle-tutorial/
- Handbook chapters this builds on: `../building/composition.md` §9, `../building/procedural.md` §1, `../building/quality-and-critique.md` §2 and §5, `../building/nature.md` §1-2
