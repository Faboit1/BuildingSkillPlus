// Spawn and lobby kit: block-letter signage, NPC places, leaderboard walls, crate stations,
// portals, gameplay markers (world spawn, regions) and spawn-proofing. Every function takes the
// Builder first and is also installed as a Builder method (b.sign(...), b.npcSpot(...), ...).
//
// Components record what a server admin needs to finish the spawn in game: NPC spots, hologram
// anchors, crate blocks, portal triggers, regions and the world spawn. The records collect in
// b.placements; finish() exports them as metadata.placements (shifted like the structure when
// trim: true) and run-build.mjs writes <name>.placements.json and a <name>.setup.md sheet with
// ready-to-paste plugin commands.
//
// Conventions
//   facing  — the side the player stands on (the way an NPC looks, a sign reads, a crate opens).
//   Local frame per component: u = to the player's right (ccw(facing)), d = toward the player,
//             h = up from `pos`. Stairs facing = side of the tall back.
//   Lights  — every component lights itself with a fixture or a light behind glass, never a bare
//             light block in view; b.spawnProof fills what is left with invisible light blocks.

import { DIR, HORIZONTAL, ccw, cw, isFullSolid, opposite, parseBlock } from './blocks.mjs'
import { material } from './materials.mjs'

// ------------------------------------------------------------------ fonts

// Medium (default): the house quartz lettering ported from the CheeseSMP spawn, 5 rows tall.
// Wide T and M/W/V/X/Y, square-bottom U, open counters.
const G5 = {
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  B: ['###.', '#..#', '###.', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  D: ['###.', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '###.', '#...', '####'],
  F: ['####', '#...', '###.', '#...', '#...'],
  G: ['.###', '#...', '#.##', '#..#', '.###'],
  H: ['#..#', '#..#', '####', '#..#', '#..#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..##', '...#', '...#', '#..#', '.##.'],
  K: ['#..#', '#.#.', '##..', '#.#.', '#..#'],
  L: ['#...', '#...', '#...', '#...', '####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  P: ['###.', '#..#', '###.', '#...', '#...'],
  Q: ['.##.', '#..#', '#..#', '#.##', '.###'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  S: ['.###', '#...', '.##.', '...#', '###.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  U: ['#..#', '#..#', '#..#', '#..#', '####'],
  V: ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
  Z: ['####', '...#', '.##.', '#...', '####'],
  0: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###.', '...#', '.##.', '#...', '####'],
  3: ['###.', '...#', '.##.', '...#', '###.'],
  4: ['#..#', '#..#', '####', '...#', '...#'],
  5: ['####', '#...', '###.', '...#', '###.'],
  6: ['.##.', '#...', '###.', '#..#', '.##.'],
  7: ['####', '...#', '..#.', '.#..', '.#..'],
  8: ['.##.', '#..#', '.##.', '#..#', '.##.'],
  9: ['.##.', '#..#', '.###', '...#', '.##.'],
  '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '!': ['#', '#', '#', '.', '#'],
  '.': ['.', '.', '.', '.', '#'],
  ':': ['.', '#', '.', '#', '.'],
  "'": ['#', '#', '.', '.', '.'],
  '?': ['###.', '...#', '.##.', '....', '.#..'],
  $: ['.###', '#.#.', '.##.', '.#.#', '###.'],
  '#': ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
  ' ': ['..', '..', '..', '..', '..'],
}

// Small: 3 wide x 5 tall, for short labels on booths, podiums and narrow boards.
const G3 = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '!': ['#', '#', '#', '.', '#'],
  '.': ['.', '.', '.', '.', '#'],
  ':': ['.', '#', '.', '#', '.'],
  "'": ['#', '#', '.', '.', '.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '#': ['#.#', '###', '#.#', '###', '#.#'],
  ' ': ['..', '..', '..', '..', '..'],
}

// Large: the 5x7 pixel font from the CheeseSMP decor module (7 rows), with the missing glyphs
// (Q, digits, punctuation) drawn in the same hand.
const G7 = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ':': ['.', '.', '#', '.', '#', '.', '.'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
}

export const SIGN_FONTS = {
  small: { glyphs: G3, height: 5, leading: 2 },
  medium: { glyphs: G5, height: 5, leading: 2 },
  large: { glyphs: G7, height: 7, leading: 3 },
}

const fontOf = name => {
  const font = SIGN_FONTS[name ?? 'medium']
  if (!font) throw new Error(`sign: unknown font "${name}" (small | medium | large)`)
  return font
}
const glyphOf = (font, ch) => font.glyphs[ch] ?? font.glyphs[' ']
const lineWidth = (line, font) => {
  let w = 0
  for (const ch of line) w += glyphOf(font, ch)[0].length + 1
  return Math.max(0, w - 1)
}

// Width in blocks of a sign's text (the widest line; lines split on '\n').
export function signWidth(text, font = 'medium') {
  const f = fontOf(font)
  return Math.max(0, ...String(text).toUpperCase().split('\n').map(line => lineWidth(line, f)))
}

// Height in blocks of a sign's text (all lines, with the font's leading between them).
export function signHeight(text, font = 'medium', leading) {
  const f = fontOf(font)
  const n = String(text).split('\n').length
  return n * f.height + (n - 1) * (leading ?? f.leading)
}

// ------------------------------------------------------------------ shared helpers

// Minecraft yaw for each facing (0 = looking south, 90 = west, 180 = north, -90 = east).
export const YAW = { south: 0, west: 90, north: 180, east: -90 }

// Tier → dye colour for crate stations (any dye colour name works as a tier too).
export const CRATE_TIERS = {
  common: 'light_gray',
  uncommon: 'lime',
  rare: 'light_blue',
  epic: 'purple',
  legendary: 'orange',
  mythic: 'red',
  vote: 'green',
  seasonal: 'pink',
}
const DYES = ['white', 'light_gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'light_blue', 'blue', 'purple', 'magenta', 'pink']
const PORTAL_COLOURS = { rtp: 'cyan', warp: 'purple', pvp: 'red', nether: 'purple' }

// Material family with the shapes the kit needs; a family without stairs/slab/wall borrows the
// closest substitute (copper_block → cut_copper_stairs).
function fam(name) {
  const m = material(name)
  const pick = kind => m[kind] ?? m.substitutes?.[kind]?.[0]
  return { block: parseBlock(m.block ?? m.planks).name, stairs: pick('stairs'), slab: pick('slab'), wall: pick('wall') }
}
const stair = (m, facing, half = 'bottom') => `${m.stairs}[facing=${facing},half=${half}]`
const slab = (m, type = 'bottom') => `${m.slab}[type=${type}]`
const dyeOf = name => DYES.find(c => String(name).replace(/^minecraft:/, '').startsWith(`${c}_`)) ?? null
const dyeColour = (tier, fallback = 'white') => {
  if (DYES.includes(tier)) return tier
  return CRATE_TIERS[tier] ?? fallback
}

// The component palette: field, frame and accent blocks plus the glow (light behind glass).
function palette(opts, defaults = {}) {
  const primary = opts.primary ?? defaults.primary ?? 'smooth_quartz'
  const trim = opts.trim ?? defaults.trim ?? 'polished_deepslate'
  const accent = opts.accent ?? defaults.accent ?? 'gold_block'
  const colour = opts.colour ?? defaults.colour ?? dyeOf(parseBlock(accent).name) ?? 'yellow'
  return {
    P: fam(primary),
    T: fam(trim),
    A: parseBlock(accent).name,
    colour,
    glass: opts.glass ?? defaults.glass ?? `${colour}_stained_glass`,
    light: opts.light ?? defaults.light ?? 'ochre_froglight',
  }
}

// Local frame: u to the player's right, d toward the player, h up.
function frame(pos, facing) {
  if (!HORIZONTAL.includes(facing)) throw new Error(`facing must be north | east | south | west (got ${facing})`)
  const F = DIR[facing]
  const R = DIR[ccw(facing)]
  const [px, py, pz] = pos.map(v => Math.round(v))
  return {
    facing,
    back: opposite(facing),
    right: ccw(facing),
    left: cw(facing),
    origin: [px, py, pz],
    at: (u, d, h) => [px + R[0] * u + F[0] * d, py + h, pz + R[2] * u + F[2] * d],
  }
}
const sideFacing = (L, u) => (u < 0 ? L.left : L.right)

function record(b, rec) {
  b.placements ??= []
  b.placements.push(rec)
  return rec
}

// Cells that must stay walkable (NPC head room, click stand-off, crate standing area): finish()
// warns when a later edit fills one.
function keepClear(b, label, cells) {
  for (const c of cells) b.set(c[0], c[1], c[2], 'minecraft:air')
  b.spawnClearance ??= []
  b.spawnClearance.push({ label, cells })
}
const CLEAR_OK = /^minecraft:(air|cave_air|light|short_grass|fern|.*_carpet|moss_carpet|pink_petals|dandelion|poppy|allium|azure_bluet|oxeye_daisy|cornflower|lily_of_the_valley|.*_tulip)$/

const r2 = v => Math.round(v * 100) / 100

// ------------------------------------------------------------------ b.sign

// Block-letter signage. `facing` is the side the reader stands on; `at` is the top-left letter
// cell as the reader sees it (top-centre with align: 'center', top-right with 'right').
//   b.sign('CRATES', [x, y, z], 'south', { align: 'center', board: 'polished_blackstone', boardEdge: 'polished_deepslate' })
// Options: font 'small' (3x5) | 'medium' (5 tall, default) | 'large' (5x7); block / stairs (face
// block and its stair family: quartz_block / quartz by default; any block with stairs works,
// smoothing is skipped without one); depth (letter layers toward the reader); board, boardEdge,
// pad (backing board one layer behind the letters); smooth (diagonal stair fills, default true);
// leading (blank rows between lines; '\n' starts a new line).
// Convex corners stay square, only diagonal steps get stair fills, and cells the outside cannot
// reach (the counters of O, A, B, D...) are never filled, so letters keep their holes.
// Returns { width, height, min, max } (min/max cover letters and board).
export function sign(b, text, at, facing = 'south', opts = {}) {
  const { font: fontName = 'medium', block = 'minecraft:quartz_block', stairs, board = null, boardEdge = null, pad = 1, depth = 1, align = 'left', smooth = true, leading } = opts
  const font = fontOf(fontName)
  const lines = String(text).toUpperCase().split('\n')
  const unknown = [...new Set([...lines.join('')].filter(ch => !font.glyphs[ch]))]
  if (unknown.length) b.warnings.push(`sign: no ${fontName} glyph for ${unknown.map(c => JSON.stringify(c)).join(' ')} (drawn as a space)`)
  const H = font.height
  const gap = leading ?? font.leading
  const totalH = lines.length * H + (lines.length - 1) * gap
  const W = Math.max(0, ...lines.map(line => lineWidth(line, font)))
  const bmp = Array.from({ length: totalH }, () => new Uint8Array(W + 1))
  lines.forEach((line, li) => {
    const lw = lineWidth(line, font)
    let col = align === 'center' ? Math.floor((W - lw) / 2) : align === 'right' ? W - lw : 0
    const top = li * (H + gap)
    for (const ch of line) {
      const g = glyphOf(font, ch)
      for (let r = 0; r < H; r += 1) for (let c = 0; c < g[r].length; c += 1) if (g[r][c] === '#') bmp[top + r][col + c] = 1
      col += g[0].length + 1
    }
  })
  const lit = (r, c) => (r >= 0 && r < totalH && c >= 0 && c <= W ? bmp[r][c] : 0)
  // cells reachable from outside the letters: stair fills only smooth the outer silhouette, so
  // letter counters stay open
  const outside = new Set()
  const stack = []
  for (let r = -1; r <= totalH; r += 1) for (const c of [-2, W + 1]) stack.push([r, c])
  for (let c = -2; c <= W + 1; c += 1) stack.push([-1, c], [totalH, c])
  while (stack.length) {
    const [r, c] = stack.pop()
    if (r < -1 || r > totalH || c < -2 || c > W + 1) continue
    const k = r * 4096 + c
    if (outside.has(k) || lit(r, c)) continue
    outside.add(k)
    stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1])
  }
  const n = DIR[facing]
  const dir = DIR[ccw(facing)]
  const shift = align === 'center' ? Math.floor(W / 2) : align === 'right' ? W - 1 : 0
  const x0 = Math.round(at[0]) - dir[0] * shift
  const y0 = Math.round(at[1])
  const z0 = Math.round(at[2]) - dir[2] * shift
  const R = ccw(facing)
  const Lf = cw(facing)
  let stairId = null
  if (smooth) {
    try {
      stairId = stairs ? (/_stairs$/.test(parseBlock(stairs).name) ? parseBlock(stairs).name : fam(stairs).stairs) : fam(parseBlock(block).name).stairs
    } catch {
      stairId = null
    }
  }
  const st = (f, half) => `${stairId}[facing=${f},half=${half}]`
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const put = (x, y, z, paint) => {
    b.set(x, y, z, paint)
    const p = [x, y, z]
    for (let i = 0; i < 3; i += 1) {
      min[i] = Math.min(min[i], p[i])
      max[i] = Math.max(max[i], p[i])
    }
  }
  if (board) {
    for (let r = -pad; r < totalH + pad; r += 1)
      for (let c = -pad; c < W + pad; c += 1) {
        const edge = boardEdge && (r === -pad || r === totalH + pad - 1 || c === -pad || c === W + pad - 1)
        put(x0 + dir[0] * c - n[0], y0 - r, z0 + dir[2] * c - n[2], edge ? boardEdge : board)
      }
  }
  for (let r = 0; r < totalH; r += 1)
    for (let c = -1; c <= W; c += 1) {
      const f = lit(r, c)
      const up = lit(r - 1, c)
      const dn = lit(r + 1, c)
      const lt = lit(r, c - 1)
      const rt = lit(r, c + 1)
      let p = null
      if (f) {
        // square corners stay square (D, E, B...); only diagonal steps get filled below
        p = block
      } else if (stairId && up + dn + lt + rt === 2 && outside.has(r * 4096 + c)) {
        if (up && lt && !lit(r - 1, c - 1)) p = st(Lf, 'top')
        else if (up && rt && !lit(r - 1, c + 1)) p = st(R, 'top')
        else if (dn && lt && !lit(r + 1, c - 1)) p = st(Lf, 'bottom')
        else if (dn && rt && !lit(r + 1, c + 1)) p = st(R, 'bottom')
      }
      if (!p) continue
      for (let e = 0; e < depth; e += 1) put(x0 + dir[0] * c + n[0] * e, y0 - r, z0 + dir[2] * c + n[2] * e, p)
    }
  return { width: W, height: totalH, min, max }
}

// ------------------------------------------------------------------ b.npcSpot

// A place for a server NPC (Citizens, FancyNpcs...). `pos` is the block the NPC stands on (its
// feet go at y + 1); `facing` is the way it looks, toward the players.
//   b.npcSpot([x, y, z], 'south', { id: 'shop', label: 'Shop', role: 'shop', style: 'alcove' })
// Styles:
//   'pedestal' — 3x3 plinth (shape: 'round' for a disc of radius 2.5), 1 tall, stair edges, the
//                NPC on a glass inset lit from below, a trim ring inlaid in the floor;
//   'alcove'   — arched niche cut into the wall behind the NPC (pos is 1 block in from the wall's
//                face): pilasters and entablature proud of the wall, a trim band in the wall
//                plane, a dark backdrop with a halo of glass lit from behind, a floor plate;
//   'booth'    — market stall: counter in front, corner posts, stock on the back wall, gabled
//                canopy with a lantern, a framed sign board on the ridge (recorded as `board`);
//   'kiosk'    — freestanding pavilion: deck, 4 posts, rails on three sides, pyramid roof,
//                finial, a lantern hanging from the apex;
//   'none'     — records the spot only.
// Materials: primary (field), trim (frame, needs stairs), accent, glass + light (the glow), roof
// (booth, kiosk), post, backdrop (alcove), inlay (pedestal floor ring).
// Keeps the NPC's 2 blocks + a nameplate block clear and a 2-deep click stand-off in front.
// Records { type: 'npc', id, label, role, style, pos: [x, y + 1, z], facing, yaw, hologram }.
export function npcSpot(b, pos, facing = 'south', opts = {}) {
  const { style = 'pedestal' } = opts
  b.spawnIds ??= {}
  const n = (b.spawnIds.npc = (b.spawnIds.npc ?? 0) + 1)
  const id = opts.id ?? `npc-${n}`
  const label = opts.label ?? id
  const role = opts.role ?? ''
  const L = frame(pos, facing)
  const M = palette(opts)
  const builders = { pedestal: npcPedestal, alcove: npcAlcove, booth: npcBooth, kiosk: npcKiosk, none: () => ({}) }
  const build = builders[style]
  if (!build) throw new Error(`npcSpot: unknown style "${style}" (${Object.keys(builders).join(' | ')})`)
  const extra = build(b, L, M, opts) ?? {}
  if (style !== 'none') {
    // head room (2 tall + nameplate) and the click stand-off in front (the booth's counter is
    // part of the design: its stand-off starts in front of it, with air above the counter)
    const cells = [L.at(0, 0, 1), L.at(0, 0, 2), L.at(0, 0, 3)]
    const d0 = style === 'booth' ? 2 : 1
    for (let d = d0; d <= d0 + 1; d += 1) for (const u of [-1, 0, 1]) for (const h of [1, 2]) cells.push(L.at(u, d, h))
    if (style === 'booth') for (const u of [-1, 0, 1]) cells.push(L.at(u, 1, 2), L.at(u, 1, 3))
    keepClear(b, `npcSpot "${id}"`, cells)
  }
  const [x, y, z] = L.origin
  return record(b, {
    type: 'npc',
    id,
    label,
    role,
    style,
    pos: [x, y + 1, z],
    facing,
    yaw: YAW[facing],
    hologram: [x + 0.5, r2(y + 1 + 2.4), z + 0.5],
    ...(extra.board ? { board: extra.board } : {}),
    ...(opts.rank ? { rank: opts.rank } : {}),
  })
}

// Pedestal: a 1-tall plinth with stair edges, the NPC on a glass inset lit from below, framed by
// a ring inlaid in the floor.
function npcPedestal(b, L, M, opts) {
  const round = opts.shape === 'round'
  const R = round ? (opts.radius ?? 2.5) : 1
  const ri = Math.floor(R)
  const inside = (u, d) => (round ? Math.hypot(u, d) <= R : Math.max(Math.abs(u), Math.abs(d)) <= 1)
  const inlay = parseBlock(opts.inlay ?? M.T.block).name
  for (let u = -ri; u <= ri; u += 1)
    for (let d = -ri; d <= ri; d += 1) {
      if (!inside(u, d)) continue
      const rim = !inside(u + 1, d) || !inside(u - 1, d) || !inside(u, d + 1) || !inside(u, d - 1)
      // footing under the plinth where the floor is missing
      b.set(...L.at(u, d, -1), M.T.block, { keep: true })
      if (u === 0 && d === 0) {
        b.set(...L.at(0, 0, 0), M.glass)
        b.set(...L.at(0, 0, -1), M.light)
      } else if (rim) {
        // stair edge stepping down outward: tall back toward the centre (finish() rounds the corners)
        const inward = Math.abs(u) >= Math.abs(d) ? (u > 0 ? L.left : L.right) : (d > 0 ? L.back : L.facing)
        b.set(...L.at(u, d, 0), stair(M.T, inward))
      } else {
        b.set(...L.at(u, d, 0), u === 0 || d === 0 ? M.P.block : M.A)
      }
    }
  // ring inlaid in the floor around the plinth (only where there is a floor)
  for (let u = -ri - 2; u <= ri + 2; u += 1)
    for (let d = -ri - 2; d <= ri + 2; d += 1) {
      const onRing = round ? Math.abs(Math.hypot(u, d) - (R + 1)) < 0.5 : Math.max(Math.abs(u), Math.abs(d)) === 2
      if (onRing) b.set(...L.at(u, d, -1), inlay, { only: blk => blk !== null })
    }
  return {}
}

// Alcove: an arched niche cut into the wall behind the NPC. Layers from the street inward:
// pilasters and entablature (proud, d = +2), trim band (wall face, d = +1), niche (d = 0..1),
// dark backdrop (d = -1) with a halo of glass lit from behind (d = -2).
function npcAlcove(b, L, M, opts) {
  const backdrop = parseBlock(opts.backdrop ?? M.T.block).name
  // the wall mass the niche is cut into (fills only empty cells, so an existing wall stays)
  b.box(L.at(-3, -3, 0), L.at(3, 1, 7), M.P.block, { keep: true })
  // niche: 3 wide, 3 tall plus an arched head
  for (let d = 0; d <= 1; d += 1) {
    for (let u = -1; u <= 1; u += 1) for (let h = 1; h <= 3; h += 1) b.set(...L.at(u, d, h), 'minecraft:air')
    b.set(...L.at(0, d, 4), 'minecraft:air')
    for (const u of [-1, 1]) b.set(...L.at(u, d, 4), stair(M.T, sideFacing(L, u), 'top'))
  }
  // floor plate: trim with the accent under the NPC
  for (let u = -1; u <= 1; u += 1) for (let d = 0; d <= 1; d += 1) b.set(...L.at(u, d, 0), u === 0 && d === 0 ? M.A : M.T.block)
  // backdrop with the halo: glass lit from a light set behind it
  for (let u = -1; u <= 1; u += 1) for (let h = 1; h <= 4; h += 1) b.set(...L.at(u, -1, h), backdrop)
  for (let h = 2; h <= 3; h += 1) {
    b.set(...L.at(0, -1, h), M.glass)
    b.set(...L.at(0, -2, h), M.light)
  }
  // trim band in the wall plane: jambs and arch band with the keystone
  for (let h = 1; h <= 5; h += 1) for (const u of [-2, 2]) b.set(...L.at(u, 1, h), M.T.block)
  for (let u = -1; u <= 1; u += 1) b.set(...L.at(u, 1, 5), u === 0 ? M.A : M.T.block)
  // pilasters proud of the wall: stair base, shaft, stair capital
  for (const u of [-3, 3]) {
    b.set(...L.at(u, 2, 1), stair(M.T, L.back))
    for (let h = 2; h <= 4; h += 1) b.set(...L.at(u, 2, h), M.P.block)
    b.set(...L.at(u, 2, 5), stair(M.T, L.back, 'top'))
  }
  // entablature, a projecting cornice returned at the ends, and a low stepped crest
  for (let u = -3; u <= 3; u += 1) b.set(...L.at(u, 2, 6), M.T.block)
  for (let u = -4; u <= 4; u += 1) b.set(...L.at(u, 3, 6), stair(M.T, L.back, 'top'))
  for (const u of [-4, 4]) b.set(...L.at(u, 2, 6), stair(M.T, sideFacing(L, -u), 'top'))
  for (let u = -3; u <= 3; u += 1) b.set(...L.at(u, 2, 7), Math.abs(u) === 3 ? slab(M.P) : M.P.block)
  for (let u = -2; u <= 2; u += 1) b.set(...L.at(u, 2, 8), Math.abs(u) === 2 ? stair(M.P, sideFacing(L, -u)) : u === 0 ? M.A : slab(M.P))
  return {}
}

// Booth: a market stall. Counter in front of the NPC, corner posts, stock on the back wall, a
// gabled canopy with a lantern, and a framed sign board standing on the ridge.
function npcBooth(b, L, M, opts) {
  const hu = Math.max(2, Math.floor((opts.width ?? 5) / 2))
  const roofMat = opts.roof ?? 'dark_oak'
  const post = opts.post ?? M.T.block
  const boardPaint = opts.board ?? 'minecraft:dark_oak_planks'
  const rail = M.T.wall ?? slab(M.T)
  // floor plate (with a footing where the floor is missing)
  for (let u = -hu; u <= hu; u += 1)
    for (let d = -1; d <= 1; d += 1) {
      b.set(...L.at(u, d, -1), M.T.block, { keep: true })
      b.set(...L.at(u, d, 0), u === 0 && d === 0 ? M.A : M.T.block)
    }
  // corner posts and the top plate
  for (const u of [-hu, hu]) for (const d of [-1, 1]) for (let h = 1; h <= 3; h += 1) b.set(...L.at(u, d, h), post)
  for (let u = -hu; u <= hu; u += 1) for (const d of [-1, 1]) b.set(...L.at(u, d, 4), M.T.block)
  for (const u of [-hu, hu]) b.set(...L.at(u, 0, 4), M.T.block)
  // back wall: barrels of stock under a shelf, panelling above
  for (let u = -hu + 1; u <= hu - 1; u += 1) {
    b.set(...L.at(u, -1, 1), `minecraft:barrel[facing=${L.facing},open=false]`)
    b.set(...L.at(u, -1, 2), slab(M.T, 'top'))
    b.set(...L.at(u, -1, 3), M.P.block)
  }
  // low side rails, the counter (upside-down stairs, lip toward the players), a candle on it
  for (const u of [-hu, hu]) b.set(...L.at(u, 0, 1), rail)
  for (let u = -hu + 1; u <= hu - 1; u += 1) b.set(...L.at(u, 1, 1), stair(M.T, L.back, 'top'))
  b.set(...L.at(-hu + 1, 1, 2), 'minecraft:candle[candles=3,lit=true]')
  // gabled canopy, ridge along the counter
  const [ax, , az] = L.at(-hu, -1, 0)
  const [cx, , cz] = L.at(hu, 1, 0)
  const alongX = L.right === 'east' || L.right === 'west'
  const roof = b.roof({
    x0: Math.min(ax, cx), z0: Math.min(az, cz), x1: Math.max(ax, cx), z1: Math.max(az, cz),
    y: L.origin[1] + 5, type: 'gable', axis: alongX ? 'x' : 'z', material: roofMat, overhang: 1, gableOverhang: 1, gable: M.P.block, eaveTrim: true,
  })
  // a lantern under the ridge lights the counter, high above the nameplate
  hangUnder(b, L, 0, 0, roof.topY - L.origin[1])
  // sign board standing on the ridge: a 3 x 2 panel between trim posts, capped
  const by = roof.topY - L.origin[1] + 1
  for (let u = -1; u <= 1; u += 1) for (let h = by; h <= by + 1; h += 1) b.set(...L.at(u, 0, h), boardPaint)
  for (const u of [-2, 2]) {
    b.set(...L.at(u, 0, by), M.T.block)
    b.set(...L.at(u, 0, by + 1), stair(M.T, sideFacing(L, -u)))
  }
  for (let u = -1; u <= 1; u += 1) b.set(...L.at(u, 0, by + 2), slab(M.T))
  const c = L.at(0, 0, by)
  return { board: { center: [c[0] + 0.5, c[1] + 1, c[2] + 0.5], facing: L.facing, size: [3, 2] } }
}

// Hangs a lantern from the lowest solid block above (u, d), searching down from `top`.
function hangUnder(b, L, u, d, top) {
  for (let h = top; h > 4; h -= 1) {
    const here = b.get(...L.at(u, d, h))
    const below = b.get(...L.at(u, d, h - 1))
    if (here && !below && /_(planks|tiles|bricks|block)$|^minecraft:(polished_|smooth_|deepslate|stone)/.test(here.name) && !/_stairs$|_slab$/.test(here.name)) {
      b.set(...L.at(u, d, h - 1), 'minecraft:chain[axis=y]')
      b.set(...L.at(u, d, h - 2), 'minecraft:lantern[hanging=true]')
      return true
    }
  }
  // no flat ceiling block: run a chain up from just above the nameplate
  b.hangingLantern(L.at(u, d, 5), 0)
  return false
}

// Kiosk: a small freestanding pavilion. Deck with a trim edge (stepped where it stands proud of
// the floor), 4 posts, rails on three sides, top plate, pyramid roof, finial, apex lantern.
function npcKiosk(b, L, M, opts) {
  const roofMat = opts.roof ?? 'deepslate_tile'
  const post = opts.post ?? M.P.block
  const rail = M.T.wall ?? slab(M.T)
  for (let u = -2; u <= 2; u += 1)
    for (let d = -2; d <= 2; d += 1) {
      const edge = Math.abs(u) === 2 || Math.abs(d) === 2
      b.set(...L.at(u, d, -1), M.T.block, { keep: true })
      b.set(...L.at(u, d, 0), u === 0 && d === 0 ? M.A : edge ? M.T.block : M.P.block)
    }
  // steps around the deck where it stands above the floor
  for (let u = -3; u <= 3; u += 1)
    for (let d = -3; d <= 3; d += 1) {
      if (Math.max(Math.abs(u), Math.abs(d)) !== 3) continue
      const p = L.at(u, d, 0)
      if (b.get(...p) || !b.get(p[0], p[1] - 1, p[2])) continue
      const inward = Math.abs(u) >= Math.abs(d) ? (u > 0 ? L.left : L.right) : (d > 0 ? L.back : L.facing)
      b.set(...p, stair(M.T, inward))
    }
  // posts on trim bases, rails on the back and sides (the front stays open), top plate
  for (const u of [-2, 2]) for (const d of [-2, 2]) {
    b.set(...L.at(u, d, 1), M.T.block)
    for (let h = 2; h <= 3; h += 1) b.set(...L.at(u, d, h), post)
  }
  for (let k = -1; k <= 1; k += 1) {
    b.set(...L.at(k, -2, 1), rail)
    b.set(...L.at(-2, k, 1), rail)
    b.set(...L.at(2, k, 1), rail)
  }
  for (let u = -2; u <= 2; u += 1) for (let d = -2; d <= 2; d += 1) if (Math.abs(u) === 2 || Math.abs(d) === 2) b.set(...L.at(u, d, 4), M.T.block)
  const [ax, , az] = L.at(-2, -2, 0)
  const [cx, , cz] = L.at(2, 2, 0)
  const roof = b.roof({ x0: Math.min(ax, cx), z0: Math.min(az, cz), x1: Math.max(ax, cx), z1: Math.max(az, cz), y: L.origin[1] + 5, type: 'pyramid', material: roofMat, overhang: 1, eaveTrim: true })
  const apex = roof.topY - L.origin[1]
  b.set(...L.at(0, 0, apex + 1), M.A)
  b.set(...L.at(0, 0, apex + 2), 'minecraft:lightning_rod[facing=up]')
  hangUnder(b, L, 0, 0, apex)
  return {}
}

// ------------------------------------------------------------------ b.leaderboards

// A wall (or a row of steles) of framed display recesses for hologram leaderboards.
//   b.leaderboards([x, y, z], 'south', { count: 3, width: 5, height: 6, gap: 3, ids: ['kills', 'money', 'playtime'], podium: true })
// `pos` is the floor block in the middle of the wall's face; `facing` is where the readers stand
// (the wall body lies 1-3 blocks behind pos). Each board: a dark backdrop 1 deep, a trim frame,
// a projecting sill hiding a footlight trough (the light shines up the recess, never seen), a
// cornice; piers with lanterns between the boards. The middle board of 3+ is the hero: raised in
// its own taller bay with a crest. podium: true adds 2nd / 1st / 3rd steps for top-3 statues in
// front of it (recorded as npc spots with role 'statue' and rank).
// style: 'wall' (default) | 'row' (freestanding steles). `height` 6 fits 10-12 hologram lines at
// 0.25-0.3 per line (about 3.5 blocks) with a margin. Materials: primary, trim, accent, backdrop
// (default black_concrete), footlight (default the palette light).
// Records { type: 'leaderboard', id, label, anchor } per board: the hologram's top line, centred
// on the board, 0.5 in front of the backdrop.
export function leaderboards(b, pos, facing = 'south', opts = {}) {
  const { count = 3, width = 5, height = 6, gap = 3, style = 'wall', podium = false, ids = [], labels = [] } = opts
  const L = frame(pos, facing)
  const M = palette(opts)
  const backdrop = parseBlock(opts.backdrop ?? 'black_concrete').name
  const light = parseBlock(opts.footlight ?? M.light).name
  const hero = count >= 3 ? Math.floor((count - 1) / 2) : -1
  const span = count * (width + 2) + (count - 1) * gap
  const u0 = -Math.floor(span / 2)
  const baseH0 = 3
  const units = []
  for (let i = 0; i < count; i += 1) {
    const cl = u0 + i * (width + 2 + gap) + 1 // first display column
    const h0 = baseH0 + (i === hero ? (podium ? 4 : 1) : 0)
    units.push({ i, cl, cr: cl + width - 1, h0, top: h0 + height - 1, hero: i === hero })
  }
  const crown = un => un.top + 3 // the row above the cornice
  const wallTop = baseH0 + height + 2
  // wall body, the hero's raised bay (or one stele per board): plinth course, top band, coping
  const segments = style === 'row'
    ? units.map(un => ({ ua: un.cl - 3, ub: un.cr + 3, top: Math.max(crown(un), wallTop), ends: true }))
    : [{ ua: u0 - 2, ub: u0 + span + 1, top: wallTop, ends: true }, ...units.filter(un => un.hero && crown(un) > wallTop).map(un => ({ ua: un.cl - 3, ub: un.cr + 3, top: crown(un), ends: false }))]
  for (const { ua, ub, top, ends } of segments) {
    for (let u = ua; u <= ub; u += 1) {
      for (let d = -2; d <= 0; d += 1) {
        b.set(...L.at(u, d, 0), M.T.block, { keep: true })
        for (let h = 1; h <= top; h += 1) b.set(...L.at(u, d, h), h <= 2 || h === top ? M.T.block : M.P.block)
        b.set(...L.at(u, d, top + 1), d === -1 ? M.T.block : slab(M.T))
      }
      b.set(...L.at(u, 1, 1), stair(M.T, L.back))
      b.set(...L.at(u, 1, top), stair(M.T, L.back, 'top'))
      if (style === 'row') {
        b.set(...L.at(u, -3, 1), stair(M.T, L.facing))
        b.set(...L.at(u, -3, top), stair(M.T, L.facing, 'top'))
      }
    }
    if (ends) for (const [u, s] of [[ua - 1, L.right], [ub + 1, L.left]]) for (let d = style === 'row' ? -3 : -2; d <= 1; d += 1) {
      b.set(...L.at(u, d, 1), stair(M.T, s))
      b.set(...L.at(u, d, top), stair(M.T, s, 'top'))
    }
  }
  // piers between and beside the boards, proud of the wall face, lanterns on top
  const piers = []
  if (style === 'wall') {
    piers.push(u0 - 1, u0 + span)
    for (let i = 0; i + 1 < count; i += 1) piers.push(units[i].cr + 2 + Math.ceil(gap / 2))
  }
  for (const u of piers) {
    b.set(...L.at(u, 1, 1), M.T.block)
    b.set(...L.at(u, 2, 1), stair(M.T, L.back))
    for (let h = 2; h < wallTop - 1; h += 1) b.set(...L.at(u, 1, h), M.P.block)
    b.set(...L.at(u, 1, wallTop - 1), stair(M.T, L.back, 'top'))
    b.set(...L.at(u, 1, wallTop), M.T.block)
    b.set(...L.at(u, 1, wallTop + 1), M.T.wall ?? slab(M.T))
    b.set(...L.at(u, 1, wallTop + 2), 'minecraft:lantern[hanging=false]')
  }
  const records = []
  for (const un of units) {
    const { cl, cr, h0, top } = un
    const mid = (cl + cr) / 2
    // recess: air 1 deep in front of the dark backdrop
    for (let u = cl; u <= cr; u += 1)
      for (let h = h0; h <= top; h += 1) {
        b.set(...L.at(u, 0, h), 'minecraft:air')
        b.set(...L.at(u, -1, h), backdrop)
      }
    // flush trim frame in the wall plane
    for (let h = h0 - 1; h <= top + 1; h += 1) for (const u of [cl - 1, cr + 1]) b.set(...L.at(u, 0, h), M.T.block)
    for (let u = cl - 1; u <= cr + 1; u += 1) b.set(...L.at(u, 0, top + 1), M.T.block)
    // footlight trough under the recess, hidden behind the projecting sill
    for (let u = cl; u <= cr; u += 1) {
      b.set(...L.at(u, 0, h0 - 1), (u - cl) % 2 === 0 ? light : M.T.block)
      b.set(...L.at(u, 1, h0 - 1), stair(M.T, L.back, 'top'))
    }
    for (const u of [cl - 1, cr + 1]) b.set(...L.at(u, 1, h0 - 1), M.T.block)
    for (const u of [cl - 2, cr + 2]) b.set(...L.at(u, 1, h0 - 1), stair(M.T, sideFacing(L, mid - u), 'top'))
    // a framed apron under the raised hero board
    for (let h = 3; h < h0 - 1; h += 1) for (let u = cl - 1; u <= cr + 1; u += 1) b.set(...L.at(u, 0, h), u === cl - 1 || u === cr + 1 || h === 3 ? M.T.block : M.P.block)
    // cornice over the frame
    for (let u = cl - 2; u <= cr + 2; u += 1) b.set(...L.at(u, 1, top + 2), stair(M.T, L.back, 'top'))
    for (let u = cl - 1; u <= cr + 1; u += 1) b.set(...L.at(u, 0, top + 2), M.T.block)
    if (un.hero) {
      // crest: a low stepped gable over the cornice with the accent at its peak
      const hw = Math.floor((cr - cl) / 2) + 2
      const um = Math.round(mid)
      for (let u = um - hw; u <= um + hw; u += 1) {
        const k = Math.abs(u - um)
        const peak = crown(un) + Math.floor((hw - k) / 2)
        const nextUp = k > 0 && crown(un) + Math.floor((hw - k + 1) / 2) > peak
        for (let h = crown(un); h < peak; h += 1) b.set(...L.at(u, 0, h), M.P.block)
        b.set(...L.at(u, 0, peak), k === 0 ? M.A : nextUp ? stair(M.T, sideFacing(L, um - u)) : M.T.block)
      }
    }
    const id = ids[un.i] ?? `board-${un.i + 1}`
    const label = labels[un.i] ?? id
    const cell = L.at(Math.floor(mid), 0, 0)
    const R = DIR[L.right]
    const frac = mid - Math.floor(mid)
    const anchorY = L.origin[1] + h0 + Math.min(height - 0.25, height / 2 + 1.75)
    const anchor = [r2(cell[0] + 0.5 + R[0] * frac), r2(anchorY), r2(cell[2] + 0.5 + R[2] * frac)]
    records.push(record(b, { type: 'leaderboard', id, label, anchor, facing, size: [width, height] }))
    if (podium && un.hero) leaderboardPodium(b, L, M, un, id, label, opts)
  }
  return records
}

// Podium steps for top-3 statues in front of the hero board: 2nd (left), 1st (middle), 3rd.
function leaderboardPodium(b, L, M, un, id, label, opts) {
  const mid = Math.round((un.cl + un.cr) / 2)
  const caps = (opts.podiumCaps ?? ['gold_block', 'iron_block', 'waxed_copper_block']).map(c => parseBlock(c).name)
  for (const [rank, uc, hgt] of [[2, mid - 3, 2], [1, mid, 3], [3, mid + 3, 1]]) {
    for (let u = uc - 1; u <= uc + 1; u += 1) {
      for (let d = 2; d <= 4; d += 1) {
        b.set(...L.at(u, d, 0), M.T.block, { keep: true })
        for (let h = 1; h < hgt; h += 1) b.set(...L.at(u, d, h), M.P.block)
        // top course: stair nosing at the front, the rank cap under the statue
        b.set(...L.at(u, d, hgt), u === uc && d === 3 ? caps[rank - 1] : d === 4 ? stair(M.T, L.back) : M.T.block)
      }
      if (hgt > 1) b.set(...L.at(u, 5, 1), stair(M.P, L.back))
    }
    npcSpot(b, L.at(uc, 3, hgt), L.facing, { style: 'none', id: `${id}-top${rank}`, label: `#${rank} ${label}`, role: 'statue', rank })
  }
}

// ------------------------------------------------------------------ b.crate / b.crateRow

// A crate station: the crate block on a stepped dais (stair ring, top tier, a slab collar with
// tier-coloured glass corners lit from below), an arch behind it whose back panel glows in the
// tier colour (glass with a light behind), and a clear 3x3 standing area in front.
//   b.crate([x, y, z], 'south', { id: 'vote', label: 'Vote Crate', tier: 'vote', block: 'ender_chest' })
// `pos` is the crate block; it sits on a 1-tall dais, so the floor block is at y - 2 (a footing
// fills down to the floor). block: 'ender_chest' | 'chest' | 'barrel' | 'shulker' | any id.
// tier: common | uncommon | rare | epic | legendary | mythic | vote | seasonal | a dye colour.
// hero: true gives a taller arch with a crest. Footprint: 5 wide, 3 in front to 5 behind the crate.
// Records { type: 'crate', id, label, tier, block, pos, facing, hologram }.
export function crate(b, pos, facing = 'south', opts = {}) {
  const { tier = 'common', block = 'chest', hero = false } = opts
  b.spawnIds ??= {}
  const n = (b.spawnIds.crate = (b.spawnIds.crate ?? 0) + 1)
  const id = opts.id ?? `crate-${n}`
  const label = opts.label ?? id
  const colour = dyeColour(tier, 'white')
  const L = frame(pos, facing)
  const M = palette({ ...opts, colour, glass: opts.glass ?? `${colour}_stained_glass` })
  const tierBlock = parseBlock(opts.tierBlock ?? `${colour}_concrete`).name
  const archTop = hero ? 5 : 4
  // footing down to the floor (at most 4 deep)
  for (let u = -2; u <= 2; u += 1)
    for (let d = -5; d <= 2; d += 1)
      for (let h = -2; h >= -5; h -= 1) {
        const p = L.at(u, d, h)
        if (b.get(...p)) break
        b.set(...p, M.T.block)
      }
  // dais: stair ring, top tier, slab collar with lit glass corners, the crate in the middle
  for (let u = -2; u <= 2; u += 1)
    for (let d = -1; d <= 2; d += 1) {
      if (Math.max(Math.abs(u), Math.abs(d)) === 2) {
        const inward = Math.abs(u) === 2 ? (u > 0 ? L.left : L.right) : L.back
        b.set(...L.at(u, d, -1), stair(M.T, inward))
        continue
      }
      b.set(...L.at(u, d, -1), u === 0 && d === 0 ? M.T.block : M.P.block)
      if (u === 0 && d === 0) continue
      if (Math.abs(u) === 1 && Math.abs(d) === 1) {
        b.set(...L.at(u, d, 0), M.glass)
        b.set(...L.at(u, d, -1), M.light)
      } else {
        b.set(...L.at(u, d, 0), slab(M.T))
      }
    }
  const kind = parseBlock(block).name.replace(/^minecraft:/, '')
  const crateState = kind === 'ender_chest' ? `minecraft:ender_chest[facing=${L.facing}]`
    : kind === 'chest' ? `minecraft:chest[facing=${L.facing},type=single]`
      : kind === 'barrel' ? `minecraft:barrel[facing=${L.facing},open=false]`
        : kind === 'shulker' ? `minecraft:${colour}_shulker_box[facing=up]`
          : block
  b.set(...L.at(0, 0, 0), crateState)
  // arch behind the dais: piers with capitals, shoulders, lintel with the tier keystone, cornice
  for (let u = -2; u <= 2; u += 1) {
    b.set(...L.at(u, -2, -1), Math.abs(u) === 2 ? M.T.block : M.P.block)
    b.set(...L.at(u, -3, -1), M.T.block)
  }
  for (const u of [-2, 2]) {
    for (let h = 0; h < archTop; h += 1) b.set(...L.at(u, -2, h), M.P.block)
    b.set(...L.at(u, -1, archTop - 1), stair(M.T, L.back, 'top'))
  }
  for (const u of [-1, 1]) b.set(...L.at(u, -2, archTop - 1), stair(M.T, sideFacing(L, u), 'top'))
  for (let u = -2; u <= 2; u += 1) {
    b.set(...L.at(u, -2, archTop), u === 0 ? tierBlock : M.T.block)
    b.set(...L.at(u, -1, archTop), stair(M.T, L.back, 'top'))
    b.set(...L.at(u, -2, archTop + 1), Math.abs(u) === 2 ? slab(M.T) : M.P.block)
  }
  // back panel in the tier colour with a glowing slot: glass, the light behind it, closed behind
  for (let u = -2; u <= 2; u += 1) for (let h = 0; h <= archTop + 1; h += 1) b.set(...L.at(u, -3, h), Math.abs(u) <= 1 && h < archTop ? tierBlock : M.P.block)
  for (let h = 1; h <= archTop - 2; h += 1) {
    b.set(...L.at(0, -3, h), M.glass)
    b.set(...L.at(0, -4, h), M.light)
  }
  for (let u = -1; u <= 1; u += 1) for (let h = -1; h <= archTop - 1; h += 1) b.set(...L.at(u, -4, h), M.P.block, { keep: true })
  for (let h = 0; h <= archTop - 1; h += 1) b.set(...L.at(0, -5, h), h === archTop - 1 ? slab(M.P) : M.P.block)
  if (hero) {
    for (let u = -1; u <= 1; u += 1) b.set(...L.at(u, -2, archTop + 2), u === 0 ? M.A : stair(M.T, sideFacing(L, -u)))
    b.set(...L.at(0, -3, archTop + 2), M.P.block)
  }
  // a clear 3x3 standing area in front of the dais
  const stand = []
  for (let u = -1; u <= 1; u += 1) for (let d = 3; d <= 5; d += 1) for (let h = -1; h <= 0; h += 1) stand.push(L.at(u, d, h))
  keepClear(b, `crate "${id}"`, stand)
  const [x, y, z] = L.origin
  return record(b, { type: 'crate', id, label, tier, block: kind, pos: [x, y, z], facing, hologram: [x + 0.5, r2(y + 1.6), z + 0.5] })
}

// A group of crate stations along the players' right from `start` (the first crate block).
//   b.crateRow([x, y, z], 'south', [{ id: 'common', tier: 'common' }, { id: 'rare', tier: 'rare' }, ...], { spacing: 5 })
// Shared options apply to every crate; each entry overrides them. Unless an entry sets hero, the
// highest tier of a row of 3+ (or the middle crate on a tie) becomes the hero station.
export function crateRow(b, start, facing = 'south', crates = [], { spacing = 5, ...shared } = {}) {
  const L = frame(start, facing)
  const order = Object.keys(CRATE_TIERS)
  let hero = crates.findIndex(c => c.hero)
  if (hero < 0 && crates.length >= 3) {
    const ranks = crates.map(c => order.indexOf(c.tier ?? shared.tier ?? 'common'))
    const best = Math.max(...ranks)
    hero = best >= 0 && ranks.filter(r => r === best).length === 1 ? ranks.indexOf(best) : Math.floor(crates.length / 2)
  }
  return crates.map((c, i) => crate(b, L.at(i * spacing, 0, 0), facing, { ...shared, ...c, hero: c.hero ?? i === hero }))
}

// ------------------------------------------------------------------ gameplay markers

// The world spawn: `pos` is the floor block (players appear at y + 1), facing the way they look.
// There is exactly one; a second call replaces the first and warns.
export function spawnPoint(b, pos, facing = 'south', { label = 'World spawn' } = {}) {
  const [x, y, z] = pos.map(v => Math.round(v))
  b.placements ??= []
  const old = b.placements.findIndex(p => p.type === 'spawn')
  if (old >= 0) {
    b.warnings.push(`spawnPoint called twice: the world spawn moves from ${b.placements[old].pos.join(',')} to ${x},${y + 1},${z}`)
    b.placements.splice(old, 1)
  }
  keepClear(b, 'spawnPoint', [[x, y + 1, z], [x, y + 2, z]])
  return record(b, { type: 'spawn', id: 'spawn', label, pos: [x, y + 1, z], facing, yaw: YAW[facing] })
}

// A WorldGuard-style region (inclusive block corners) with flags; `priority` is passed through.
//   b.region('spawn', [0, 0, 0], [63, 40, 63], { pvp: 'deny', 'mob-spawning': 'deny', priority: 10 })
export function region(b, id, min, max, flags = {}) {
  const lo = [0, 1, 2].map(i => Math.round(Math.min(min[i], max[i])))
  const hi = [0, 1, 2].map(i => Math.round(Math.max(min[i], max[i])))
  return record(b, { type: 'region', id, min: lo, max: hi, flags: { ...flags } })
}

// A portal frame around the opening a..c (inclusive corners of a 1-thick vertical opening).
//   b.portal([20, 5, 30], [22, 8, 30], { id: 'rtp', label: 'Random Teleport', kind: 'rtp' })
// Threshold with a glowing inset, 2-wide pilasters with lit glass slots on both faces, jambs, an
// arched fanlight of kind-coloured glass lit from inside (pointed on 'pvp'), keystones and a
// cornice. The opening stays air (a trigger for a portal / warp / RTP plugin) unless kind is
// 'nether' (obsidian frame, nether_portal fill). kind: 'rtp' | 'warp' | 'pvp' | 'nether';
// facing picks the front for asymmetric details (default south / east).
// Records { type: 'portal', id, label, kind, min, max, facing }: the opening as trigger region.
export function portal(b, a, c, opts = {}) {
  const { kind = 'warp' } = opts
  b.spawnIds ??= {}
  const n = (b.spawnIds.portal = (b.spawnIds.portal ?? 0) + 1)
  const id = opts.id ?? `portal-${n}`
  const label = opts.label ?? id
  const lo = [0, 1, 2].map(i => Math.round(Math.min(a[i], c[i])))
  const hi = [0, 1, 2].map(i => Math.round(Math.max(a[i], c[i])))
  const alongX = hi[2] === lo[2] ? true : hi[0] === lo[0] ? false : hi[0] - lo[0] >= hi[2] - lo[2]
  if (hi[0] !== lo[0] && hi[2] !== lo[2]) b.warnings.push(`portal "${id}": the opening is not 1 thick; framing it along ${alongX ? 'x' : 'z'}`)
  const facing = opts.facing ?? (alongX ? 'south' : 'east')
  const nether = kind === 'nether'
  const colour = opts.colour ?? PORTAL_COLOURS[kind] ?? 'purple'
  const M = palette({ ...opts, colour, glass: opts.glass ?? `${colour}_stained_glass` }, nether ? { primary: 'polished_blackstone_bricks', trim: 'polished_blackstone', accent: 'crying_obsidian' } : {})
  const keyBlock = nether ? M.A : parseBlock(`${colour}_concrete`).name
  // local frame on the opening: u along its width from the left jamb (seen from the front)
  const W = alongX ? hi[0] - lo[0] + 1 : hi[2] - lo[2] + 1
  const Ht = hi[1] - lo[1] + 1
  const front = alongX ? (facing === 'north' ? 'north' : 'south') : (facing === 'west' ? 'west' : 'east')
  const base = alongX ? [front === 'north' ? hi[0] : lo[0], lo[1], lo[2]] : [lo[0], lo[1], front === 'west' ? lo[2] : hi[2]]
  const L = frame(base, front)
  const core = nether ? 'minecraft:obsidian' : M.T.block
  const archTop = Ht + Math.ceil(W / 2) + 1
  // threshold: trim border, field, a glowing inset across the opening lit from below
  for (let u = -3; u <= W + 2; u += 1)
    for (let d = -2; d <= 2; d += 1) {
      const inset = !nether && u >= 0 && u < W && d === 0
      b.set(...L.at(u, d, -2), inset ? M.light : M.T.block, inset ? undefined : { keep: true })
      b.set(...L.at(u, d, -1), inset ? M.glass : Math.abs(d) === 2 || u < -1 || u > W ? M.T.block : nether && d === 0 && u >= 0 && u < W ? 'minecraft:obsidian' : M.P.block)
    }
  // jambs and the head, then the arch: kind-coloured fanlight glass inside a trim ring
  for (let d = -1; d <= 1; d += 1)
    for (let h = 0; h <= archTop; h += 1)
      for (let u = -1; u <= W; u += 1) if (u === -1 || u === W || h >= Ht) b.set(...L.at(u, d, h), core)
  const s0 = L.at(0, -1, Ht)
  const s1 = L.at(W - 1, -1, Ht)
  b.arch(s0, [s1[0], s0[1], s1[2]], core, { type: kind === 'pvp' ? 'pointed' : 'round', depth: 3, direction: L.facing, fill: nether ? 'minecraft:obsidian' : M.glass, spandrel: M.P.block, top: L.origin[1] + archTop })
  // light the fanlight from inside: glass on both faces, the light between them
  let crownH = Ht
  for (let u = 0; u < W; u += 1)
    for (let h = Ht; h <= archTop; h += 1) {
      if (b.get(...L.at(u, -1, h))?.name !== parseBlock(M.glass).name) continue
      if (!nether) b.set(...L.at(u, 0, h), M.light)
      crownH = Math.max(crownH, h)
    }
  // keystones over the crown on both faces
  const mid = (W - 1) / 2
  for (const d of [-1, 1]) for (let u = Math.floor(mid); u <= Math.ceil(mid); u += 1) if (crownH + 1 <= archTop) b.set(...L.at(u, d, crownH + 1), keyBlock)
  // the trigger opening itself stays clear
  for (let u = 0; u < W; u += 1) for (let h = 0; h < Ht; h += 1) for (let d = -1; d <= 1; d += 1) b.set(...L.at(u, d, h), 'minecraft:air')
  // pilasters, 2 wide: stair bases and capitals on both faces, a glass slot lit from inside
  for (const [ua, ub] of [[-3, -2], [W + 1, W + 2]]) {
    const slot = ua < 0 ? ub : ua // the column next to the jamb
    for (let u = ua; u <= ub; u += 1) {
      for (let d = -1; d <= 1; d += 1) for (let h = 0; h <= archTop; h += 1) b.set(...L.at(u, d, h), M.P.block)
      for (const d of [-2, 2]) {
        const back = d < 0 ? L.facing : L.back
        b.set(...L.at(u, d, 0), stair(M.T, back))
        for (let h = 1; h < archTop - 1; h += 1) b.set(...L.at(u, d, h), u === slot && h >= 1 && h < Ht ? M.glass : M.P.block)
        b.set(...L.at(u, d, archTop - 1), stair(M.T, back, 'top'))
        if (u === slot) for (let h = 1; h < Ht; h += 1) b.set(...L.at(u, Math.sign(d), h), M.light)
      }
    }
  }
  // cornice band over the whole frame, slab cap with the kind-coloured centre
  for (let u = -4; u <= W + 3; u += 1) {
    for (let d = -1; d <= 1; d += 1) b.set(...L.at(u, d, archTop + 1), u === -4 || u === W + 3 ? slab(M.T) : M.T.block)
    for (const d of [-2, 2]) if (u > -4 && u < W + 3) b.set(...L.at(u, d, archTop + 1), stair(M.T, d < 0 ? L.facing : L.back, 'top'))
    if (u >= -3 && u <= W + 2) b.set(...L.at(u, 0, archTop + 2), Math.abs(u - mid) < 1 ? keyBlock : slab(M.P))
  }
  if (nether) {
    const axis = alongX ? 'x' : 'z'
    for (let u = 0; u < W; u += 1) for (let h = 0; h < Ht; h += 1) b.set(...L.at(u, 0, h), `minecraft:nether_portal[axis=${axis}]`)
  }
  return record(b, { type: 'portal', id, label, kind, min: lo, max: hi, facing: front })
}

// ------------------------------------------------------------------ spawn-proofing

// Light model (vanilla block light, approximate): every emitter spreads -1 per block, opaque full
// blocks stop it, water and leaves cost 1 extra, and slabs / stairs / paths / snow block it
// through their full faces. A cell is mob-spawnable when its feet and head cells have no
// collision (air, light, plants...), the block below has a sturdy top that allows spawning (not
// glass, leaves, ice, bottom slabs, carpets, paths...), and its block light is 0.
const EMIT_15 = /^minecraft:(lantern|glowstone|sea_lantern|shroomlight|jack_o_lantern|beacon|conduit|lava|lava_cauldron|fire|end_portal|end_gateway|.*_froglight)$/
function emitOf(block) {
  const { name } = block
  const p = block.props ?? {}
  if (EMIT_15.test(name)) return 15
  if (name === 'minecraft:light') return Number(p.level ?? 15)
  if (name === 'minecraft:campfire') return p.lit === 'false' ? 0 : 15
  if (name === 'minecraft:soul_campfire') return p.lit === 'false' ? 0 : 10
  if (/^minecraft:(torch|wall_torch|end_rod)$/.test(name)) return 14
  if (/^minecraft:cave_vines(_plant)?$/.test(name)) return p.berries === 'true' ? 14 : 0
  if (/^minecraft:(soul_lantern|soul_torch|soul_wall_torch|soul_fire|crying_obsidian)$/.test(name)) return 10
  if (/^minecraft:(furnace|smoker|blast_furnace)$/.test(name)) return p.lit === 'true' ? 13 : 0
  if (name === 'minecraft:redstone_lamp') return p.lit === 'true' ? 15 : 0
  if (/copper_bulb$/.test(name)) return p.lit === 'true' ? (/oxidized/.test(name) ? 4 : /weathered/.test(name) ? 8 : /exposed/.test(name) ? 12 : 15) : 0
  if (name === 'minecraft:nether_portal') return 11
  if (name === 'minecraft:respawn_anchor') return [0, 3, 7, 11, 15][Number(p.charges ?? 0)] ?? 0
  if (name === 'minecraft:sea_pickle') return p.waterlogged === 'true' ? 3 * Number(p.pickles ?? 1) + 3 : 0
  if (/candle$/.test(name)) return p.lit === 'true' ? 3 * Number(p.candles ?? 1) : 0
  if (/candle_cake$/.test(name)) return p.lit === 'true' ? 3 : 0
  if (/^minecraft:redstone_(wall_)?torch$/.test(name)) return p.lit === 'false' ? 0 : 7
  if (/^minecraft:(glow_lichen|enchanting_table|ender_chest)$/.test(name)) return 7
  if (name === 'minecraft:sculk_catalyst') return 6
  if (name === 'minecraft:amethyst_cluster') return 5
  if (name === 'minecraft:large_amethyst_bud') return 4
  if (name === 'minecraft:magma_block') return 3
  if (name === 'minecraft:medium_amethyst_bud') return 2
  if (/^minecraft:(small_amethyst_bud|brewing_stand|brown_mushroom|dragon_egg|end_portal_frame|sculk_sensor|calibrated_sculk_sensor)$/.test(name)) return 1
  return 0
}

// cells mobs can stand in: no collision, not a signal source / rail / fluid / damaging block
const SPAWN_SPACE = /^minecraft:(light|short_grass|grass|fern|dead_bush|dandelion|poppy|blue_orchid|allium|azure_bluet|.*_tulip|oxeye_daisy|cornflower|lily_of_the_valley|torchflower|tall_grass|large_fern|sunflower|lilac|rose_bush|peony|pitcher_plant|vine|glow_lichen|pink_petals|.*_sapling|brown_mushroom|red_mushroom|hanging_roots|sculk_vein|structure_void|nether_sprouts|warped_roots|crimson_roots|spore_blossom|cave_vines|cave_vines_plant|twisting_vines|twisting_vines_plant|weeping_vines|weeping_vines_plant|.*_sign|.*_wall_sign|.*_banner|.*_wall_banner)$/
// full blocks mobs never spawn on
const NO_SPAWN_FLOOR = /[:_]glass$|_leaves$|^minecraft:(ice|packed_ice|blue_ice|frosted_ice|barrier|magma_block|beacon|light|scaffolding|mangrove_roots)$|_grate$/
// full blocks that let light through
const TRANSPARENT_FULL = /[:_]glass$|^minecraft:(ice|frosted_ice|barrier|beacon)$|_leaves$|_grate$/
const TALL_LOWER = /^minecraft:(tall_grass|large_fern|sunflower|lilac|rose_bush|peony|pitcher_plant|tall_seagrass|small_dripleaf)$|_door$/
const BIT = { east: 1, west: 2, up: 4, down: 8, south: 16, north: 32 }

const classCache = new WeakMap()
function classify(block) {
  let c = classCache.get(block)
  if (c) return c
  const { name } = block
  const p = block.props ?? {}
  const full = isFullSolid(name)
  c = {
    emit: emitOf(block),
    opaque: full && !TRANSPARENT_FULL.test(name) && name !== 'minecraft:tinted_glass' ? true : name === 'minecraft:tinted_glass',
    faces: 0,
    damp: name === 'minecraft:water' || /_leaves$/.test(name) || p.waterlogged === 'true',
    space: SPAWN_SPACE.test(name) || (name === 'minecraft:snow' && (p.layers ?? '1') === '1'),
    floor: false,
    grows: TALL_LOWER.test(name) && (p.half ?? 'lower') === 'lower',
  }
  if (/_slab$/.test(name)) {
    const type = p.type ?? 'bottom'
    if (type === 'double') c.opaque = true
    else c.faces = type === 'top' ? BIT.up : BIT.down
    c.floor = type !== 'bottom'
  } else if (/_stairs$/.test(name)) {
    const facing = p.facing ?? 'north'
    const shape = p.shape ?? 'straight'
    let side = shape.startsWith('outer') ? 0 : BIT[facing]
    if (shape === 'inner_left') side |= BIT[ccw(facing)]
    if (shape === 'inner_right') side |= BIT[cw(facing)]
    c.faces = side | ((p.half ?? 'bottom') === 'top' ? BIT.up : BIT.down)
    c.floor = (p.half ?? 'bottom') === 'top'
  } else if (/^minecraft:(dirt_path|farmland|snow)$/.test(name)) {
    c.faces = BIT.down
    if (name === 'minecraft:snow' && p.layers === '8') c.opaque = true
  } else if (full) {
    c.floor = !NO_SPAWN_FLOOR.test(name)
  }
  classCache.set(block, c)
  return c
}
const EMPTY_CLASS = { empty: true }

// Block light over a box (emitters up to 15 blocks outside it count) and the spawn flags per cell.
function lightGrid(b, min, max) {
  const lo = [0, 1, 2].map(i => Math.max(0, Math.min(min[i], max[i]) - 15))
  const hi = [0, 1, 2].map(i => Math.min(b.size[i] - 1, Math.max(min[i], max[i]) + 15))
  const W = hi[0] - lo[0] + 1
  const H = hi[1] - lo[1] + 1
  const D = hi[2] - lo[2] + 1
  const N = W * H * D
  const emit = new Uint8Array(N)
  const flags = new Uint8Array(N) // 1 opaque, 2 damp, 4 spawn space, 8 spawn floor, 16 empty, 32 grows up
  const faces = new Uint8Array(N)
  const idx = (x, y, z) => ((y - lo[1]) * D + (z - lo[2])) * W + (x - lo[0])
  for (let y = lo[1]; y <= hi[1]; y += 1)
    for (let z = lo[2]; z <= hi[2]; z += 1)
      for (let x = lo[0]; x <= hi[0]; x += 1) {
        const blk = b.blocks.get(b.key(x, y, z))
        const c = blk ? classify(blk) : EMPTY_CLASS
        const i = idx(x, y, z)
        if (c.empty) {
          flags[i] = 4 | 16
          continue
        }
        emit[i] = c.emit
        faces[i] = c.faces
        flags[i] = (c.opaque ? 1 : 0) | (c.damp ? 2 : 0) | (c.space ? 4 : 0) | (c.floor ? 8 : 0) | (c.grows ? 32 : 0)
      }
  const light = new Uint8Array(N)
  const steps = [[1, 0, 0, BIT.east, BIT.west], [-1, 0, 0, BIT.west, BIT.east], [0, 1, 0, BIT.up, BIT.down], [0, -1, 0, BIT.down, BIT.up], [0, 0, 1, BIT.south, BIT.north], [0, 0, -1, BIT.north, BIT.south]]
  const propagate = () => {
    light.fill(0)
    let q = new Int32Array(1 << 16)
    let qh = 0
    let qt = 0
    const push = i => {
      if (qt >= q.length) {
        const next = new Int32Array(Math.max(q.length, (qt - qh) * 2))
        next.set(q.subarray(qh, qt))
        qt -= qh
        qh = 0
        q = next
      }
      q[qt++] = i
    }
    for (let i = 0; i < N; i += 1) if (emit[i]) {
      light[i] = emit[i]
      push(i)
    }
    while (qh < qt) {
      const i = q[qh++]
      const l = light[i]
      if (l <= 1) continue
      const x = i % W
      const r = (i - x) / W
      const z = r % D
      const y = (r - z) / D
      for (const [dx, dy, dz, out, inn] of steps) {
        const nx = x + dx
        const ny = y + dy
        const nz = z + dz
        if (nx < 0 || ny < 0 || nz < 0 || nx >= W || ny >= H || nz >= D) continue
        const j = (ny * D + nz) * W + nx
        if (flags[j] & 1 || faces[i] & out || faces[j] & inn) continue
        const nl = l - 1 - (flags[j] & 2 ? 1 : 0)
        if (nl > light[j]) {
          light[j] = nl
          push(j)
        }
      }
    }
  }
  propagate()
  return { lo, hi, W, D, idx, emit, flags, light, propagate }
}

function darkCells(b, g, min, max, inside) {
  const out = []
  const layer = g.W * g.D
  const lo = [0, 1, 2].map(i => Math.max(i === 1 ? 1 : 0, Math.min(min[i], max[i])))
  const hi = [0, 1, 2].map(i => Math.min(b.size[i] - 1, Math.max(min[i], max[i])))
  for (let y = lo[1]; y <= hi[1]; y += 1)
    for (let z = lo[2]; z <= hi[2]; z += 1)
      for (let x = lo[0]; x <= hi[0]; x += 1) {
        const i = g.idx(x, y, z)
        if (g.light[i] || !(g.flags[i] & 4) || !(g.flags[i - layer] & 8)) continue
        if (y < g.hi[1] && !(g.flags[i + layer] & 4)) continue
        if (inside && !inside(x, z, y)) continue
        out.push([x, y, z])
      }
  return out
}

// Mob-spawnable cells (feet positions) inside min..max: 2 tall walkable space on a spawnable
// floor at block light 0. inside(x, z, y) limits the check.
//   const dark = b.darkSpots([0, 4, 0], [63, 30, 63])     // → [[x, y, z], ...]
export function darkSpots(b, min, max, { inside } = {}) {
  return darkCells(b, lightGrid(b, min, max), min, max, inside)
}

// Spawn-proofs a box (port of the CheeseSMP spawn's pass): propagates block light, then puts an
// invisible light[level=15] in dark walkable cells (at feet height, or head height over a plant),
// keeping lights placed in one round at least `maxStep` apart (Manhattan), and repeats, because a
// new light can be shadowed by walls: 2-3 rounds usually, up to `maxRounds`. Never replaces a
// block or takes the cell a door / tall plant grows into. inside(x, z, y) limits it to part of the
// box. Returns the number of lights placed (b.spawnProofReport keeps { placed, remaining }).
//   b.spawnProof([2, 4, 2], [61, 30, 61], { inside: (x, z) => !inWater(x, z) })
export function spawnProof(b, min, max, { inside, maxStep = 10, maxRounds = 8, level = 15 } = {}) {
  const g = lightGrid(b, min, max)
  const layer = g.W * g.D
  const state = `minecraft:light[level=${level},waterlogged=false]`
  let placed = 0
  let dark = darkCells(b, g, min, max, inside)
  for (let round = 0; round < maxRounds && dark.length; round += 1) {
    const lit = []
    for (const [x, y, z] of dark) {
      if (lit.some(p => Math.abs(p[0] - x) + Math.abs(p[1] - y) + Math.abs(p[2] - z) <= maxStep)) continue
      const i = g.idx(x, y, z)
      let cell = null
      if (g.flags[i] & 16 && !(g.flags[i - layer] & 32)) cell = [x, y, z, i]
      else if (y < g.hi[1] && g.flags[i + layer] & 16 && !(g.flags[i] & 32)) cell = [x, y + 1, z, i + layer]
      if (!cell) continue
      b.set(cell[0], cell[1], cell[2], state)
      g.emit[cell[3]] = level
      g.flags[cell[3]] = 4
      lit.push(cell)
    }
    if (!lit.length) break
    placed += lit.length
    g.propagate()
    dark = darkCells(b, g, min, max, inside)
  }
  b.spawnProofReport = { placed: (b.spawnProofReport?.placed ?? 0) + placed, remaining: dark.length }
  if (dark.length) b.warnings.push(`spawnProof: ${dark.length} dark walkable cell(s) left without a free cell for a light, e.g. ${dark[0].join(',')}`)
  return placed
}

// ------------------------------------------------------------------ finish() integration

const shift = (p, o) => (Array.isArray(p) ? p.map((v, i) => r2(v - o[i])) : p)

// Wraps Builder.prototype.finish (called once from index.mjs): optional spawn-proofing
// (finish({ spawnProof: [min, max] }), { min, max, inside, maxStep } or true for the whole
// canvas), warnings when an NPC stand-off, crate standing area or the spawn got filled, and
// metadata.placements in structure coordinates (shifted with trim: true).
export function installFinishHook(Builder) {
  const base = Builder.prototype.finish
  if (base.spawnHook) return
  function finish(opts = {}) {
    const { spawnProof: sp, ...rest } = opts
    if (sp) {
      const cfg = sp === true ? { min: [0, 0, 0], max: this.size.map(v => v - 1) } : Array.isArray(sp) ? { min: sp[0], max: sp[1] } : sp
      spawnProof(this, cfg.min, cfg.max, cfg)
    }
    for (const { label, cells } of this.spawnClearance ?? []) {
      const blocked = cells.filter(([x, y, z]) => {
        const blk = this.get(x, y, z)
        return blk && !CLEAR_OK.test(blk.name)
      })
      if (blocked.length) this.warnings.push(`${label}: ${blocked.length} cell(s) that must stay clear are filled, e.g. ${blocked[0].join(',')} (${this.nameAt(...blocked[0])})`)
    }
    const result = base.call(this, rest)
    const offset = rest.trim ? (this.bounds()?.min ?? [0, 0, 0]) : [0, 0, 0]
    const list = (this.placements ?? []).map(p => {
      const out = { ...p }
      for (const k of ['pos', 'hologram', 'anchor', 'min', 'max']) if (out[k]) out[k] = shift(out[k], offset)
      if (out.board) out.board = { ...out.board, center: shift(out.board.center, offset) }
      return out
    })
    if (list.length) result.metadata.placements = list
    if (this.spawnProofReport) result.metadata.builderReport.spawnProof = this.spawnProofReport
    return result
  }
  finish.spawnHook = true
  Builder.prototype.finish = finish
}

export const SPAWN_METHODS = {
  sign,
  npcSpot,
  leaderboards,
  crate,
  crateRow,
  spawnPoint,
  portal,
  region,
  darkSpots,
  spawnProof,
}
