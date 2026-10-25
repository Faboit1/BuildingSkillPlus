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
// closest substitute (copper_block → cut_copper_stairs), then the fallback family's.
function fam(name, fallback = 'smooth_quartz') {
  const m = material(name)
  const pick = kind => m[kind] ?? m.substitutes?.[kind]?.[0]
  const f = pick('stairs') && pick('slab') ? null : material(fallback)
  return {
    block: parseBlock(m.block ?? m.planks).name,
    stairs: pick('stairs') ?? f.stairs,
    slab: pick('slab') ?? f.slab,
    wall: pick('wall'),
    fence: m.fence,
    log: m.stripped_log ?? m.log,
    trapdoor: m.trapdoor,
  }
}
const stair = (m, facing, half = 'bottom') => `${m.stairs}[facing=${facing},half=${half}]`
const slab = (m, type = 'bottom') => `${m.slab}[type=${type}]`
const log = (m, axis = 'y') => `${m.log ?? 'minecraft:stripped_dark_oak_log'}[axis=${axis}]`
const dyeOf = name => DYES.find(c => String(name).replace(/^minecraft:/, '').startsWith(`${c}_`)) ?? null
const dyeColour = (tier, fallback = 'white') => {
  if (DYES.includes(tier)) return tier
  return CRATE_TIERS[tier] ?? fallback
}

// The component palette, by role: primary (field: light walls, shafts), trim (frames, cornices,
// reveals: needs stairs), base (plinths, skirts: darkest), wood (posts, timber, props), roof,
// accent (keystones, caps), and the glow: glass + light (a light set behind tinted glass).
// `field` may be any paint (a kit.palette) for the big surfaces.
function palette(opts, defaults = {}) {
  const get = (k, d) => opts[k] ?? defaults[k] ?? d
  const accent = parseBlock(get('accent', 'gold_block')).name
  const colour = get('colour', dyeOf(accent) ?? 'yellow')
  const P = fam(get('primary', 'smooth_quartz'))
  return {
    P,
    T: fam(get('trim', 'polished_deepslate')),
    B: fam(get('base', 'deepslate_tiles')),
    W: fam(get('wood', 'dark_oak')),
    field: get('field', P.block),
    roof: get('roof', 'deepslate_tile'),
    A: accent,
    colour,
    glass: get('glass', `${colour}_stained_glass`),
    light: get('light', 'ochre_froglight'),
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
//   b.sign('CRATES', [x, y, z], 'south', { align: 'center', board: 'polished_blackstone' })
// Options: font 'small' (3x5) | 'medium' (5 tall, default) | 'large' (5x7); block / stairs (face
// block and its stair family: quartz_block / quartz by default; any block with stairs works,
// smoothing is skipped without one); depth (letter layers toward the reader); smooth (diagonal
// stair fills, default true); leading (blank rows between lines; '\n' starts a new line).
// board: a framed panel behind the letters: the field (`board` paint, `pad` cells around the
// text, `boardDepth` layers deep, default 2) sits 1 behind the letters inside a frame ring flush
// with them (`frame`, default polished_deepslate; false for a bare board with an optional flat
// `boardEdge` ring), with a projecting stair cornice and sill, returned at the ends, and a slab cap.
// Convex corners stay square, only diagonal steps get stair fills, and cells the outside cannot
// reach (the counters of O, A, B, D...) are never filled, so letters keep their holes.
// Returns { width, height, min, max } (min/max cover letters and board).
export function sign(b, text, at, facing = 'south', opts = {}) {
  const { font: fontName = 'medium', block = 'minecraft:quartz_block', stairs, board = null, boardEdge = null, pad = 1, depth = 1, align = 'left', smooth = true, leading, boardDepth = 2, cap = true } = opts
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
  // sign-local placement: row r down from the top text row, column c along the reading direction,
  // layer e toward the reader (0 = the letters' plane, negative = behind them)
  const cell = (r, c, e) => [x0 + dir[0] * c + n[0] * e, y0 - r, z0 + dir[2] * c + n[2] * e]
  if (board) {
    const framePaint = opts.frame === false ? null : (opts.frame && opts.frame !== true ? opts.frame : 'minecraft:polished_deepslate')
    let F = null
    if (framePaint) {
      try {
        F = fam(parseBlock(framePaint).name)
      } catch {
        F = null
      }
    }
    const r0 = -pad
    const r1 = totalH + pad - 1
    const c0 = -pad
    const c1 = W + pad - 1
    for (let r = r0; r <= r1; r += 1)
      for (let c = c0; c <= c1; c += 1)
        for (let e = -boardDepth; e <= -1; e += 1) {
          const edge = !framePaint && boardEdge && (r === r0 || r === r1 || c === c0 || c === c1)
          put(...cell(r, c, e), edge ? boardEdge : board)
        }
    if (framePaint) {
      const back = opposite(facing)
      // the frame ring, flush with the letters and as deep as the board
      for (let r = r0 - 1; r <= r1 + 1; r += 1)
        for (let c = c0 - 1; c <= c1 + 1; c += 1) {
          if (r !== r0 - 1 && r !== r1 + 1 && c !== c0 - 1 && c !== c1 + 1) continue
          for (let e = -boardDepth; e <= 0; e += 1) put(...cell(r, c, e), framePaint)
        }
      if (F?.stairs) {
        // cornice over the top rail and sill under the bottom rail, projecting 1 and returned at the ends
        for (const r of [r0 - 1, r1 + 1]) {
          for (let c = c0 - 2; c <= c1 + 2; c += 1) put(...cell(r, c, 1), `${F.stairs}[facing=${back},half=top]`)
          for (let e = -boardDepth; e <= 0; e += 1) {
            put(...cell(r, c0 - 2, e), `${F.stairs}[facing=${R},half=top]`)
            put(...cell(r, c1 + 2, e), `${F.stairs}[facing=${Lf},half=top]`)
          }
        }
        if (cap) for (let c = c0 - 1; c <= c1 + 1; c += 1) for (let e = -boardDepth; e <= 0; e += 1) put(...cell(r0 - 2, c, e), `${F.slab}[type=bottom]`)
      }
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
      for (let e = 0; e < depth; e += 1) put(...cell(r, c, e), p)
    }
  return { width: W, height: totalH, min, max }
}

// ------------------------------------------------------------------ b.npcSpot

// A place for a server NPC (Citizens, FancyNpcs...). `pos` is the block the NPC stands on (its
// feet go at y + 1); `facing` is the way it looks, toward the players.
//   b.npcSpot([x, y, z], 'south', { id: 'shop', label: 'Shop', role: 'shop', style: 'alcove' })
// Styles:
//   'pedestal' — a 1-tall plinth (size 5, default, or 3; shape: 'round' for a disc of radius 2.5):
//                stair skirt, a contrasting inlay ring around the NPC, who stands on a glass inset
//                lit from below, corner blocks with lanterns (front) and potted plants (back), a
//                ring inlaid in the floor, and a backdrop screen behind (screen: false to omit)
//                with a halo of glass lit from behind;
//   'alcove'   — an arched niche cut into the wall behind the NPC (pos is 1 block in from the
//                wall's face): pilasters with stair bases and capitals, entablature, cornice and
//                crest proud of the wall, a trim reveal in the wall plane, a dark backdrop with a
//                glowing halo behind the NPC's head, a floor plate and lanterns on brackets;
//   'booth'    — a market stall: open counter in front (lip toward the players, props on top),
//                log posts, stock on the back wall, a striped awning sloping to the front with a
//                valance of upside-down stairs, lanterns under the eave, and a framed sign board
//                over the awning (recorded as `board`: the face to put a sign or item frame on);
//   'kiosk'    — a freestanding pavilion: deck with a stair skirt, log posts on bases, knee
//                braces, beams, rails and potted plants on three sides, an info lectern, a hipped
//                roof with eave lanterns and a finial, and a lantern hanging over the NPC;
//   'none'     — records the spot only.
// Materials: primary, trim, base, wood, roof, accent, glass + light (the glow), awning (booth:
// two stair families striped), backdrop (alcove), inlay (pedestal floor ring).
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
    // head room (2 tall + nameplate) and the click stand-off in front; the booth's counter is part
    // of the design, so its stand-off starts in front of it, with air above the counter's middle
    const cells = [L.at(0, 0, 1), L.at(0, 0, 2), L.at(0, 0, 3)]
    const d0 = style === 'booth' ? 2 : 1
    for (let d = d0; d <= d0 + 1; d += 1) for (const u of [-1, 0, 1]) for (const h of [1, 2]) cells.push(L.at(u, d, h))
    if (style === 'booth') cells.push(L.at(0, 1, 2), L.at(0, 1, 3))
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

const inwardOf = (L, u, d) => (Math.abs(u) >= Math.abs(d) ? (u > 0 ? L.left : L.right) : (d > 0 ? L.back : L.facing))
const POTS = ['minecraft:potted_azalea_bush', 'minecraft:potted_fern', 'minecraft:potted_flowering_azalea_bush', 'minecraft:potted_red_tulip']

// Pedestal: 1-tall plinth with a stair skirt, inlay ring, lit glass inset under the NPC, corner
// lanterns and plants, a floor ring and a backdrop screen.
function npcPedestal(b, L, M, opts) {
  const round = opts.shape === 'round'
  const R = round ? (opts.radius ?? 2.5) : (opts.size ?? 5) >= 5 ? 2 : 1
  const ri = Math.floor(R)
  const inside = (u, d) => (round ? Math.hypot(u, d) <= R : Math.max(Math.abs(u), Math.abs(d)) <= R)
  const rim = (u, d) => !inside(u + 1, d) || !inside(u - 1, d) || !inside(u, d + 1) || !inside(u, d - 1)
  const inlay = parseBlock(opts.inlay ?? M.T.block).name
  for (let u = -ri; u <= ri; u += 1)
    for (let d = -ri; d <= ri; d += 1) {
      if (!inside(u, d)) continue
      b.set(...L.at(u, d, -1), M.B.block, { keep: true }) // footing where the floor is missing
      const corner = !round && ri >= 2 && Math.abs(u) === ri && Math.abs(d) === ri
      if (u === 0 && d === 0) {
        b.set(...L.at(0, 0, 0), M.glass)
        b.set(...L.at(0, 0, -1), M.light)
      } else if (corner) {
        b.set(...L.at(u, d, 0), M.B.block)
        b.set(...L.at(u, d, 1), d > 0 ? 'minecraft:lantern[hanging=false]' : POTS[(u > 0 ? 1 : 0) + (opts.seedPot ?? 0) % 2 * 2])
      } else if (rim(u, d)) {
        b.set(...L.at(u, d, 0), stair(M.B, inwardOf(L, u, d)))
      } else {
        // the inlay ring around the NPC: the light field against the dark skirt
        b.set(...L.at(u, d, 0), M.P.block)
      }
    }
  // ring inlaid in the floor around the plinth (only where there is a floor)
  for (let u = -ri - 2; u <= ri + 2; u += 1)
    for (let d = -ri - 2; d <= ri + 2; d += 1) {
      const onRing = round ? Math.abs(Math.hypot(u, d) - (R + 1)) < 0.5 : Math.max(Math.abs(u), Math.abs(d)) === ri + 1
      if (onRing && !(opts.screen !== false && d < -ri)) b.set(...L.at(u, d, -1), inlay, { only: blk => blk !== null })
    }
  if (opts.screen !== false) screen(b, L, M, -ri - 1, Math.max(2, ri))
  return {}
}

// A backdrop screen behind an NPC at row d0 (2 deep): base, posts, a dark panel with a halo of
// glass lit from behind (the light sits in a third layer), a cornice, a slab cap with the accent,
// and lanterns on the posts.
function screen(b, L, M, d0, hw) {
  const halo = [[-1, 2], [0, 2], [1, 2], [-1, 3], [0, 3], [1, 3]]
  for (let u = -hw; u <= hw; u += 1)
    for (const d of [d0, d0 - 1]) {
      b.set(...L.at(u, d, -1), M.B.block, { keep: true })
      b.set(...L.at(u, d, 0), M.B.block)
      for (let h = 1; h <= 4; h += 1) b.set(...L.at(u, d, h), d === d0 && Math.abs(u) < hw ? M.T.block : M.P.block)
      b.set(...L.at(u, d, 5), Math.abs(u) === hw ? M.T.block : slab(M.P))
    }
  for (const [u, h] of halo) {
    b.set(...L.at(u, d0, h), M.glass)
    b.set(...L.at(u, d0 - 1, h), M.light)
    b.set(...L.at(u, d0 - 2, h), M.P.block)
  }
  for (let u = -1; u <= 1; u += 1) b.set(...L.at(u, d0 - 2, 4), u === 0 ? slab(M.P) : slab(M.P))
  b.set(...L.at(0, d0 - 2, 1), M.B.block)
  for (let u = -hw - 1; u <= hw + 1; u += 1) b.set(...L.at(u, d0 + 1, 4), stair(M.T, L.back, 'top'))
  for (const u of [-hw - 1, hw + 1]) b.set(...L.at(u, d0, 4), stair(M.T, sideFacing(L, -u), 'top'))
  for (const u of [-hw, hw]) {
    b.set(...L.at(u, d0 + 1, 0), stair(M.B, L.back))
    b.set(...L.at(u, d0, 6), 'minecraft:lantern[hanging=false]')
  }
  b.set(...L.at(0, d0, 5), M.A)
}

// Alcove: an arched niche cut into the wall behind the NPC. Layers from the street inward:
// pilasters, entablature and cornice (proud, d = +2..+3), a trim reveal (wall face, d = +1), the
// niche (d = 0..1), a dark backdrop (d = -1) with a halo of glass lit from behind (d = -2).
function npcAlcove(b, L, M, opts) {
  const backdrop = parseBlock(opts.backdrop ?? 'polished_blackstone_bricks').name
  // the wall mass the niche is cut into (fills only empty cells, so an existing wall stays)
  b.box(L.at(-4, -3, 0), L.at(4, 1, 8), M.field, { keep: true })
  // niche: 3 wide, 3 tall, a round head of stairs, 2 deep
  for (let d = 0; d <= 1; d += 1) {
    for (let u = -1; u <= 1; u += 1) for (let h = 1; h <= 3; h += 1) b.set(...L.at(u, d, h), 'minecraft:air')
    b.set(...L.at(0, d, 4), 'minecraft:air')
    for (const u of [-1, 1]) b.set(...L.at(u, d, 4), stair(M.T, sideFacing(L, u), 'top'))
    for (let u = -1; u <= 1; u += 1) b.set(...L.at(u, d, 5), M.T.block)
    for (const u of [-2, 2]) for (let h = 1; h <= 4; h += 1) b.set(...L.at(u, d, h), M.P.block)
  }
  // floor plate: trim with the accent under the NPC, a step down to the street
  for (let u = -1; u <= 1; u += 1) for (let d = 0; d <= 1; d += 1) b.set(...L.at(u, d, 0), u === 0 && d === 0 ? M.A : M.T.block)
  // backdrop with a halo behind the head: tinted glass with lights set behind it
  for (let u = -1; u <= 1; u += 1) for (let h = 1; h <= 4; h += 1) b.set(...L.at(u, -1, h), backdrop)
  for (const [u, h] of [[0, 2], [0, 3], [-1, 3], [1, 3], [0, 4]]) {
    b.set(...L.at(u, -1, h), M.glass)
    b.set(...L.at(u, -2, h), M.light)
  }
  // trim reveal in the wall plane: jambs and an arch band with the keystone
  for (let h = 0; h <= 4; h += 1) for (const u of [-2, 2]) b.set(...L.at(u, 1, h), M.T.block)
  for (let u = -2; u <= 2; u += 1) b.set(...L.at(u, 1, 5), u === 0 ? M.A : M.T.block)
  for (let u = -1; u <= 1; u += 1) b.set(...L.at(u, 1, 6), u === 0 ? stair(M.T, L.back) : M.T.block)
  // pilasters proud of the wall: base, shaft, capital
  for (const u of [-3, 3]) {
    b.set(...L.at(u, 2, 0), M.B.block, { keep: true })
    b.set(...L.at(u, 2, 1), M.B.block)
    b.set(...L.at(u, 3, 1), stair(M.B, L.back))
    for (let h = 2; h <= 5; h += 1) b.set(...L.at(u, 2, h), M.P.block)
    b.set(...L.at(u, 3, 5), stair(M.T, L.back, 'top'))
    // a lantern on a bracket over each pilaster
    b.set(...L.at(sideFacing(L, u) === L.right ? u + 1 : u - 1, 2, 4), stair(M.T, sideFacing(L, -u), 'top'))
    b.set(...L.at(sideFacing(L, u) === L.right ? u + 1 : u - 1, 2, 3), 'minecraft:lantern[hanging=true]')
  }
  // entablature, a projecting cornice returned at the ends, and a stepped crest with the accent
  for (let u = -3; u <= 3; u += 1) b.set(...L.at(u, 2, 6), M.T.block)
  for (let u = -4; u <= 4; u += 1) b.set(...L.at(u, 3, 6), stair(M.T, L.back, 'top'))
  for (const u of [-4, 4]) b.set(...L.at(u, 2, 6), stair(M.T, sideFacing(L, -u), 'top'))
  for (let u = -3; u <= 3; u += 1) b.set(...L.at(u, 2, 7), Math.abs(u) === 3 ? slab(M.T) : Math.abs(u) === 2 ? stair(M.P, sideFacing(L, -u)) : M.P.block)
  for (let u = -1; u <= 1; u += 1) b.set(...L.at(u, 2, 8), u === 0 ? M.A : stair(M.P, sideFacing(L, -u)))
  return {}
}

// Booth: a market stall. Counter, log posts, stock, a striped awning sloping to the front with a
// valance, eave lanterns, and a framed sign board over the awning.
function npcBooth(b, L, M, opts) {
  const hu = Math.max(2, Math.floor((opts.width ?? 5) / 2))
  const stripes = (opts.awning ?? ['mangrove', 'birch']).map(f => fam(f))
  const S = u => stripes[((u % stripes.length) + stripes.length) % stripes.length]
  const W = M.W
  const boardPaint = parseBlock(opts.board ?? 'minecraft:dark_oak_planks').name
  const along = L.right === 'east' || L.right === 'west' ? 'x' : 'z'
  const across = along === 'x' ? 'z' : 'x'
  // floor: planks with a base border, footing where the floor is missing
  for (let u = -hu; u <= hu; u += 1)
    for (let d = -1; d <= 1; d += 1) {
      b.set(...L.at(u, d, -1), M.B.block, { keep: true })
      b.set(...L.at(u, d, 0), Math.abs(u) === hu || d === -1 ? M.B.block : W.block)
    }
  // log posts, the header beam over the counter and the back beam
  for (const u of [-hu, hu]) for (const d of [-1, 1]) for (let h = 1; h <= 4; h += 1) b.set(...L.at(u, d, h), log(W))
  for (let u = -hu + 1; u <= hu - 1; u += 1) for (const d of [-1, 1]) b.set(...L.at(u, d, 4), log(W, along))
  for (const u of [-hu, hu]) b.set(...L.at(u, 0, 4), log(W, across))
  // back wall: barrels and a chest under a shelf with pots, panelling above
  for (let u = -hu + 1; u <= hu - 1; u += 1) {
    const k = u + hu
    b.set(...L.at(u, -1, 1), k % 3 === 1 ? `minecraft:chest[facing=${L.facing},type=single]` : `minecraft:barrel[facing=${k % 2 ? 'up' : L.facing},open=false]`)
    b.set(...L.at(u, -1, 2), slab(W, 'top'))
    b.set(...L.at(u, -1, 3), W.block)
    if (k % 2 === 0) b.set(...L.at(u, 0, 3), `${W.trapdoor}[facing=${L.facing},half=top,open=false]`)
  }
  for (let u = -hu + 1; u <= hu - 1; u += 2) b.set(...L.at(u, -1, 3), 'minecraft:chiseled_bookshelf[facing=' + L.facing + ']')
  // side rails between the posts, a lectern at one side
  for (const u of [-hu, hu]) b.set(...L.at(u, 0, 1), W.fence)
  b.set(...L.at(hu - 1, 0, 1), `minecraft:lectern[facing=${L.facing},has_book=true]`)
  // counter: upside-down stairs, the lip toward the players; a lit candle and a pot on it
  for (let u = -hu + 1; u <= hu - 1; u += 1) b.set(...L.at(u, 1, 1), stair(W, L.back, 'top'))
  b.set(...L.at(-hu + 1, 1, 2), 'minecraft:candle[candles=3,lit=true]')
  b.set(...L.at(hu - 1, 1, 2), 'minecraft:decorated_pot[facing=' + L.facing + ']')
  // the awning: striped stair courses sloping down to the front, a valance under the eave
  for (let u = -hu - 1; u <= hu + 1; u += 1) {
    const m = S(u)
    b.set(...L.at(u, 2, 4), stair(m, L.back))
    b.set(...L.at(u, 2, 3), stair(m, L.facing, 'top'))
    b.set(...L.at(u, 1, 5), stair(m, L.back))
    b.set(...L.at(u, 0, 5), m.block)
    b.set(...L.at(u, -1, 5), m.block)
    b.set(...L.at(u, -2, 5), stair(m, L.facing, 'top'))
    if (Math.abs(u) > hu) b.set(...L.at(u, 1, 4), stair(m, L.facing, 'top'))
  }
  // lanterns hanging under the eave at the front corners
  for (const u of [-hu - 1, hu + 1]) b.set(...L.at(u, 2, 2), 'minecraft:lantern[hanging=true]')
  // sign board standing on the awning: a 3 x 2 panel between log posts, capped
  const by = 6
  for (let u = -1; u <= 1; u += 1) {
    for (let h = by; h <= by + 1; h += 1) b.set(...L.at(u, -1, h), boardPaint)
    b.set(...L.at(u, -1, by + 2), stair(W, L.back, 'top'))
    b.set(...L.at(u, -1, by + 3), slab(W))
    b.set(...L.at(u, -2, by), stair(W, L.back, 'top'))
  }
  for (const u of [-2, 2]) {
    for (let h = by; h <= by + 2; h += 1) b.set(...L.at(u, -1, h), log(W))
    b.set(...L.at(u, -1, by + 3), 'minecraft:lantern[hanging=false]')
  }
  const c = L.at(0, -1, by)
  return { board: { center: [c[0] + 0.5, c[1] + 1, c[2] + 0.5], facing: L.facing, size: [3, 2] } }
}

// Kiosk: a freestanding pavilion. A 7x7 deck with a stair skirt, log posts on base blocks, knee
// braces under the beams, rails with potted plants on three sides, an info lectern, a hipped roof
// with lanterns at the eave corners and a finial, a lantern hanging over the NPC.
function npcKiosk(b, L, M, opts) {
  const W = M.W
  for (let u = -3; u <= 3; u += 1)
    for (let d = -3; d <= 3; d += 1) {
      b.set(...L.at(u, d, -1), M.B.block, { keep: true })
      const ring = Math.max(Math.abs(u), Math.abs(d))
      if (ring === 3) b.set(...L.at(u, d, 0), Math.abs(u) === 3 && Math.abs(d) === 3 ? M.B.block : stair(M.B, inwardOf(L, u, d)))
      else b.set(...L.at(u, d, 0), u === 0 && d === 0 ? M.A : ring === 2 ? M.T.block : W.block)
    }
  // posts on base blocks, beams, knee braces
  const along = L.right === 'east' || L.right === 'west' ? 'x' : 'z'
  const across = along === 'x' ? 'z' : 'x'
  for (const u of [-2, 2]) for (const d of [-2, 2]) {
    b.set(...L.at(u, d, 1), M.T.block)
    for (let h = 2; h <= 3; h += 1) b.set(...L.at(u, d, h), log(W))
    b.set(...L.at(u, d, 4), log(W))
  }
  for (let k = -1; k <= 1; k += 1) {
    for (const d of [-2, 2]) b.set(...L.at(k, d, 4), log(W, along))
    for (const u of [-2, 2]) b.set(...L.at(u, k, 4), log(W, across))
  }
  for (const s of [-1, 1]) {
    for (const d of [-2, 2]) b.set(...L.at(s, d, 3), stair(W, sideFacing(L, s), 'top'))
    for (const u of [-2, 2]) b.set(...L.at(u, s, 3), stair(W, s > 0 ? L.facing : L.back, 'top'))
  }
  // rails with potted plants on the back and the sides; the front stays open; an info lectern
  for (let k = -1; k <= 1; k += 1) {
    b.set(...L.at(k, -2, 1), W.fence)
    b.set(...L.at(-2, k, 1), W.fence)
    b.set(...L.at(2, k, 1), W.fence)
  }
  b.set(...L.at(-2, 0, 2), POTS[2])
  b.set(...L.at(2, 0, 2), POTS[0])
  b.set(...L.at(-1, -1, 1), `minecraft:lectern[facing=${L.facing},has_book=true]`)
  b.set(...L.at(1, -1, 1), `minecraft:barrel[facing=up,open=false]`)
  // hipped roof with a deep eave, lanterns at the eave corners, a finial
  const [ax, , az] = L.at(-2, -2, 0)
  const [cx, , cz] = L.at(2, 2, 0)
  const roof = b.roof({ x0: Math.min(ax, cx), z0: Math.min(az, cz), x1: Math.max(ax, cx), z1: Math.max(az, cz), y: L.origin[1] + 5, type: 'pyramid', material: M.roof, pitch: [1, 1, 2], overhang: 2, eaveTrim: true })
  for (const u of [-4, 4]) for (const d of [-4, 4]) {
    const top = b.topY(...[L.at(u, d, 0)].map(p => [p[0], p[2]])[0])
    if (top > 0) b.set(L.at(u, d, 0)[0], top - 1, L.at(u, d, 0)[2], 'minecraft:lantern[hanging=true]')
  }
  const apex = roof.topY - L.origin[1]
  b.set(...L.at(0, 0, apex + 1), M.A)
  b.set(...L.at(0, 0, apex + 2), 'minecraft:lightning_rod[facing=up]')
  hangUnder(b, L, 0, 0, apex)
  return {}
}

// Hangs a lantern on a chain from the lowest full block above (u, d) found searching down from
// `top`, keeping it above the NPC's nameplate.
function hangUnder(b, L, u, d, top) {
  for (let h = top; h >= 6; h -= 1) {
    const here = b.get(...L.at(u, d, h))
    if (!here || b.get(...L.at(u, d, h - 1)) || !isFullSolid(here.name)) continue
    b.set(...L.at(u, d, h - 1), 'minecraft:chain[axis=y]')
    b.set(...L.at(u, d, h - 2), 'minecraft:lantern[hanging=true]')
    return true
  }
  return false
}

// ------------------------------------------------------------------ b.leaderboards

// A wall (or a row of steles) of framed display recesses for hologram leaderboards.
//   b.leaderboards([x, y, z], 'south', { count: 3, width: 5, height: 6, gap: 3, ids: ['kills', 'money', 'playtime'], podium: true })
// `pos` is the floor block in the middle of the wall's face; `facing` is where the readers stand
// (the wall body lies 1-4 blocks behind pos). Each board, from the street in: stiles with stair
// bases and capitals, a projecting cornice and a sill over a plinth with a lit glass strip (d = +1);
// a stepped reveal (the opening at the wall face is 1 larger all round, with stair bevels top and
// bottom); the display 1 deeper with a dark backdrop (default polished_blackstone); a footlight
// trough hidden behind the bottom bevel. Piers with bracket lanterns between the boards. The
// middle board of 3+ is the hero: 2 wider, 1 taller, raised in its own taller bay with a crest.
// podium: true adds 2nd / 1st / 3rd steps for top-3 statues in front of it (recorded as npc spots
// with role 'statue' and rank). style: 'wall' (default) | 'row' (freestanding steles).
// `height` 6 fits 10-12 hologram lines at 0.25-0.3 per line (about 3.5 blocks) with a margin.
// Records { type: 'leaderboard', id, label, anchor } per board: the hologram's top line, centred
// on the board, 0.5 in front of the backdrop.
export function leaderboards(b, pos, facing = 'south', opts = {}) {
  const { count = 3, width = 5, height = 6, gap = 3, style = 'wall', podium = false, ids = [], labels = [] } = opts
  const L = frame(pos, facing)
  const M = palette(opts)
  const backdrop = parseBlock(opts.backdrop ?? 'polished_blackstone').name
  const light = parseBlock(opts.footlight ?? M.light).name
  const strip = parseBlock(opts.strip ?? M.glass).name
  const hero = count >= 3 ? Math.floor((count - 1) / 2) : -1
  const H0 = 4
  // lay the boards out left to right, then centre the row on pos
  const units = []
  let cursor = 0
  for (let i = 0; i < count; i += 1) {
    const isHero = i === hero
    const w = width + (isHero ? 2 : 0)
    const H = height + (isHero ? 1 : 0)
    units.push({ i, w, H, fl: cursor, h0: H0 + (isHero ? (podium ? 4 : 1) : 0), hero: isHero })
    cursor += w + 4 + gap
  }
  const span = cursor - gap
  const shiftU = -Math.floor(span / 2)
  for (const un of units) {
    un.fl += shiftU
    un.cl = un.fl + 2
    un.cr = un.cl + un.w - 1
    un.fr = un.cr + 2
    un.top = un.h0 + un.H - 1
  }
  const baseTop = H0 + height + 3
  const crown = un => un.top + 3
  const ua = units[0].fl - 2
  const ub = units[count - 1].fr + 2
  // wall body (4 deep), the hero's taller bay (or one stele per board): plinth, frieze, coping
  const segments = style === 'row'
    ? units.map(un => ({ a: un.fl - 1, z: un.fr + 1, top: crown(un) + 1, ends: true }))
    : [{ a: ua, z: ub, top: baseTop, ends: true }, ...units.filter(un => un.hero && crown(un) + 1 > baseTop).map(un => ({ a: un.fl - 1, z: un.fr + 1, top: crown(un) + 1, ends: false }))]
  for (const { a, z, top, ends } of segments) {
    for (let u = a; u <= z; u += 1) {
      for (let d = -3; d <= 0; d += 1) {
        b.set(...L.at(u, d, 0), M.B.block, { keep: true })
        for (let h = 1; h <= top; h += 1) b.set(...L.at(u, d, h), h <= 2 ? M.B.block : h === top ? M.T.block : M.field)
        b.set(...L.at(u, d, top + 1), d === 0 || d === -3 ? slab(M.T) : M.T.block)
      }
      b.set(...L.at(u, 1, 1), stair(M.B, L.back))
      b.set(...L.at(u, 1, top), stair(M.T, L.back, 'top'))
      if (style === 'row' || ends) {
        b.set(...L.at(u, -4, 1), stair(M.B, L.facing))
        b.set(...L.at(u, -4, top), stair(M.T, L.facing, 'top'))
      }
    }
    if (ends) for (const [u, s] of [[a - 1, L.right], [z + 1, L.left]]) for (let d = -4; d <= 1; d += 1) {
      b.set(...L.at(u, d, 1), stair(M.B, s))
      b.set(...L.at(u, d, top), stair(M.T, s, 'top'))
    }
  }
  // piers between and beside the boards: base, shaft, capital, a lantern on a bracket
  const piers = style === 'wall' ? [ua, ub, ...units.slice(0, -1).map(un => un.fr + 1 + Math.floor(gap / 2))] : []
  for (const u of piers) {
    b.set(...L.at(u, 1, 1), M.B.block)
    b.set(...L.at(u, 1, 2), M.B.block)
    b.set(...L.at(u, 2, 1), stair(M.B, L.back))
    for (let h = 3; h < baseTop - 1; h += 1) b.set(...L.at(u, 1, h), M.P.block)
    b.set(...L.at(u, 1, baseTop - 1), stair(M.T, L.back, 'top'))
    b.set(...L.at(u, 1, baseTop), M.T.block)
    b.set(...L.at(u, 1, baseTop + 1), M.T.wall ?? slab(M.T))
    b.set(...L.at(u, 1, baseTop + 2), 'minecraft:lantern[hanging=false]')
    if (u !== ua && u !== ub) {
      b.set(...L.at(u, 2, H0 + 3), stair(M.T, L.back, 'top'))
      b.set(...L.at(u, 2, H0 + 2), 'minecraft:lantern[hanging=true]')
    }
  }
  const records = []
  for (const un of units) {
    const { cl, cr, fl, fr, h0, top } = un
    const mid = (cl + cr) / 2
    // the reveal opening (wall face) and the display recess 1 deeper with its backdrop
    for (let u = cl - 1; u <= cr + 1; u += 1) for (let h = h0 - 1; h <= top + 1; h += 1) b.set(...L.at(u, 0, h), 'minecraft:air')
    for (let u = cl - 1; u <= cr + 1; u += 1)
      for (let h = h0 - 1; h <= top + 1; h += 1) {
        const inner = u >= cl && u <= cr && h >= h0 && h <= top
        b.set(...L.at(u, -1, h), inner ? 'minecraft:air' : M.T.block)
        if (inner) b.set(...L.at(u, -2, h), backdrop)
      }
    // bevels: an upside-down stair lintel and a stair sill in the reveal; the footlight trough
    // sits behind the sill, shining up the display
    for (let u = cl - 1; u <= cr + 1; u += 1) {
      b.set(...L.at(u, 0, top + 1), stair(M.T, L.back, 'top'))
      b.set(...L.at(u, 0, h0 - 1), stair(M.T, L.back))
    }
    for (let u = cl; u <= cr; u += 1) b.set(...L.at(u, -1, h0 - 1), (u - cl) % 2 === 0 ? light : M.T.block)
    // stiles proud of the wall: base, shaft, capital
    for (const u of [fl, fr]) {
      for (let h = h0 - 1; h <= top + 1; h += 1) b.set(...L.at(u, 0, h), M.T.block)
      b.set(...L.at(u, 1, h0 - 1), M.B.block)
      for (let h = h0; h <= top; h += 1) b.set(...L.at(u, 1, h), M.T.block)
      b.set(...L.at(u, 1, top + 1), stair(M.T, L.back, 'top'))
    }
    // cornice over the frame, returned at the ends
    for (let u = fl - 1; u <= fr + 1; u += 1) {
      b.set(...L.at(u, 0, top + 2), M.T.block)
      b.set(...L.at(u, 1, top + 2), stair(M.T, L.back, 'top'))
    }
    for (const [u, s] of [[fl - 1, L.right], [fr + 1, L.left]]) b.set(...L.at(u, 0, top + 2), stair(M.T, s, 'top'))
    // plinth under the board: a sill nosing over a lit glass strip, base below, skirt at the foot
    for (let u = fl; u <= fr; u += 1) {
      b.set(...L.at(u, 1, h0 - 1), u === fl || u === fr ? M.B.block : stair(M.T, L.back, 'top'))
      const glow = u > fl && u < fr
      b.set(...L.at(u, 1, h0 - 2), glow ? strip : M.B.block)
      if (glow) b.set(...L.at(u, 0, h0 - 2), light)
      for (let h = 1; h < h0 - 2; h += 1) b.set(...L.at(u, 1, h), M.B.block)
      b.set(...L.at(u, 2, 1), stair(M.B, L.back))
    }
    // a framed apron under a raised board
    for (let h = H0 - 1; h < h0 - 2; h += 1) for (let u = fl + 1; u < fr; u += 1) b.set(...L.at(u, 0, h), M.field)
    if (un.hero) {
      // crest: a stepped gable over the cornice with the accent at its peak
      const um = Math.round(mid)
      const hw = un.w / 2 + 2
      for (let u = fl; u <= fr; u += 1) {
        const k = Math.abs(u - um)
        const peak = crown(un) + Math.max(0, Math.floor((hw - k) / 2))
        const higher = k > 0 && crown(un) + Math.max(0, Math.floor((hw - k + 1) / 2)) > peak
        for (let h = crown(un); h < peak; h += 1) b.set(...L.at(u, 0, h), M.field)
        b.set(...L.at(u, 0, peak), k === 0 ? M.A : higher ? stair(M.T, sideFacing(L, um - u)) : slab(M.T))
        for (let d = -3; d < 0; d += 1) for (let h = crown(un); h < peak; h += 1) b.set(...L.at(u, d, h), M.field, { keep: true })
      }
    }
    const id = ids[un.i] ?? `board-${un.i + 1}`
    const label = labels[un.i] ?? id
    const cell = L.at(Math.floor(mid), -1, 0)
    const R = DIR[L.right]
    const frac = mid - Math.floor(mid)
    const anchorY = L.origin[1] + h0 + Math.min(un.H - 0.25, un.H / 2 + 1.75)
    const anchor = [r2(cell[0] + 0.5 + R[0] * frac), r2(anchorY), r2(cell[2] + 0.5 + R[2] * frac)]
    records.push(record(b, { type: 'leaderboard', id, label, anchor, facing, size: [un.w, un.H] }))
    if (podium && un.hero) leaderboardPodium(b, L, M, un, id, label, opts)
  }
  return records
}

// Podium steps for top-3 statues in front of the hero board: 2nd (left), 1st (middle), 3rd.
// Each step: a base course, a body, stair nosing on its open faces, the rank cap under the statue.
function leaderboardPodium(b, L, M, un, id, label, opts) {
  const mid = Math.round((un.cl + un.cr) / 2)
  const caps = (opts.podiumCaps ?? ['gold_block', 'iron_block', 'waxed_copper_block']).map(c => parseBlock(c).name)
  const steps = [[2, mid - 3, 2], [1, mid, 3], [3, mid + 3, 1]]
  const heightAt = u => steps.find(([, uc]) => Math.abs(u - uc) <= 1)?.[2] ?? 0
  for (const [rank, uc, hgt] of steps) {
    for (let u = uc - 1; u <= uc + 1; u += 1) {
      for (let d = 3; d <= 5; d += 1) {
        b.set(...L.at(u, d, 0), M.B.block, { keep: true })
        for (let h = 1; h < hgt; h += 1) b.set(...L.at(u, d, h), h === 1 ? M.B.block : M.field)
        // top course: nosing stairs on the front and on sides that drop to a lower step
        const lower = s => heightAt(u + s) < hgt && Math.abs(u + s - uc) > 1
        let top = M.T.block
        if (u === uc && d === 4) top = caps[rank - 1]
        else if (d === 5) top = stair(M.T, L.back)
        else if (u === uc - 1 && lower(-1)) top = stair(M.T, L.right)
        else if (u === uc + 1 && lower(1)) top = stair(M.T, L.left)
        b.set(...L.at(u, d, hgt), top)
      }
      if (hgt > 1) b.set(...L.at(u, 6, 1), stair(M.B, L.back))
    }
    npcSpot(b, L.at(uc, 4, hgt), L.facing, { style: 'none', id: `${id}-top${rank}`, label: `#${rank} ${label}`, role: 'statue', rank })
  }
  // potted plants at the podium's ends
  b.set(...L.at(mid - 5, 5, 1), POTS[0])
  b.set(...L.at(mid + 5, 5, 1), POTS[2])
}

// ------------------------------------------------------------------ b.crate / b.crateRow

// A crate station: the crate block on a stepped dais (stair skirt, top tier, a slab collar with
// tier-coloured glass corners lit from below and tier candles), an arch behind it (piers with
// stair bases and capitals, a stair arch ring with the tier keystone, cornice), whose reveal panel
// is stepped 1 deeper and glows in the tier colour (glass with a light behind), and a clear 3x3
// standing area in front.
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
  const panel = parseBlock(opts.panel ?? `${colour}_terracotta`).name
  const archTop = hero ? 6 : 5
  // footing down to the floor (at most 4 deep)
  for (let u = -2; u <= 2; u += 1)
    for (let d = -5; d <= 2; d += 1)
      for (let h = -2; h >= -5; h -= 1) {
        const p = L.at(u, d, h)
        if (b.get(...p)) break
        b.set(...p, M.B.block)
      }
  // dais: stair skirt, top tier, slab collar with lit glass corners and candles, the crate
  for (let u = -2; u <= 2; u += 1)
    for (let d = -1; d <= 2; d += 1) {
      if (Math.max(Math.abs(u), Math.abs(d)) === 2) {
        b.set(...L.at(u, d, -1), Math.abs(u) === 2 && d === 2 ? M.B.block : stair(M.B, Math.abs(u) === 2 ? (u > 0 ? L.left : L.right) : L.back))
        continue
      }
      b.set(...L.at(u, d, -1), u === 0 && d === 0 ? M.T.block : M.P.block)
      if (u === 0 && d === 0) continue
      if (Math.abs(u) === 1 && Math.abs(d) === 1) {
        b.set(...L.at(u, d, 0), M.glass)
        b.set(...L.at(u, d, -1), M.light)
        if (d > 0) b.set(...L.at(u, d, 1), `minecraft:${colour}_candle[candles=${u > 0 ? 3 : 2},lit=true]`)
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
  // the arch: piers on stair bases, capitals, a stair arch ring with the tier keystone
  for (let u = -2; u <= 2; u += 1) {
    b.set(...L.at(u, -2, -1), M.B.block)
    b.set(...L.at(u, -3, -1), M.B.block)
  }
  for (const u of [-2, 2]) {
    b.set(...L.at(u, -1, 0), stair(M.B, L.back))
    for (let h = 0; h < archTop - 1; h += 1) b.set(...L.at(u, -2, h), M.P.block)
    b.set(...L.at(u, -2, archTop - 1), M.T.block)
    b.set(...L.at(u, -1, archTop - 1), stair(M.T, L.back, 'top'))
  }
  for (let u = -1; u <= 1; u += 1) for (let h = 0; h < archTop - 1; h += 1) b.set(...L.at(u, -2, h), 'minecraft:air')
  for (const u of [-1, 1]) {
    b.set(...L.at(u, -2, archTop - 2), stair(M.T, sideFacing(L, u), 'top'))
    b.set(...L.at(u, -2, archTop - 1), M.T.block)
  }
  b.set(...L.at(0, -2, archTop - 1), tierBlock)
  for (let u = -2; u <= 2; u += 1) {
    b.set(...L.at(u, -2, archTop), M.T.block)
    b.set(...L.at(u, -1, archTop), stair(M.T, L.back, 'top'))
    b.set(...L.at(u, -2, archTop + 1), Math.abs(u) === 2 ? slab(M.T) : u === 0 && !hero ? M.A : slab(M.P))
  }
  // the reveal panel 1 deeper in the tier colour, a glowing slot with the light behind it
  for (let u = -2; u <= 2; u += 1) for (let h = 0; h <= archTop; h += 1) b.set(...L.at(u, -3, h), Math.abs(u) <= 1 && h < archTop - 1 ? panel : M.field)
  for (let h = 1; h <= archTop - 3; h += 1) {
    b.set(...L.at(0, -3, h), M.glass)
    b.set(...L.at(0, -4, h), M.light)
  }
  for (let u = -2; u <= 2; u += 1) for (let h = -1; h <= archTop; h += 1) b.set(...L.at(u, -4, h), M.field, { keep: true })
  for (let h = 1; h <= archTop - 3; h += 1) b.set(...L.at(0, -5, h), M.field)
  if (hero) {
    for (let u = -1; u <= 1; u += 1) b.set(...L.at(u, -2, archTop + 1), u === 0 ? M.P.block : stair(M.P, sideFacing(L, -u)))
    b.set(...L.at(0, -2, archTop + 2), M.A)
    b.set(...L.at(0, -3, archTop + 1), M.field)
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

// A portal gate around the opening a..c (inclusive corners of a 1-thick vertical opening).
//   b.portal([20, 5, 30], [22, 8, 30], { id: 'rtp', label: 'Random Teleport', kind: 'rtp' })
// A layered arch, the same on both faces: a plinth, pilasters with stair bases and capitals, an
// outer arch ring of stairs (1 wider than the opening, round; pointed on 'pvp') with a keystone in
// the kind colour, an inner reveal stepped 1 deeper whose jambs carry glass strips lit from inside
// (the reveal glows, not the surface), an entablature with a cornice and a cap, and a threshold
// with a glowing inset. The opening stays air (the trigger for a portal / warp / RTP plugin) unless
// kind is 'nether' (obsidian core and nether_portal fill). kind: 'rtp' | 'warp' | 'pvp' | 'nether';
// facing picks the front (default south / east). Footprint: width + 6 by 7 deep.
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
  const M = palette({ ...opts, colour, glass: opts.glass ?? `${colour}_stained_glass` }, nether ? { primary: 'polished_blackstone_bricks', trim: 'polished_blackstone', base: 'blackstone', accent: 'crying_obsidian' } : {})
  const keyBlock = nether ? M.A : parseBlock(`${colour}_glazed_terracotta`).name
  // local frame on the opening: u along its width from the left jamb (seen from the front)
  const W = alongX ? hi[0] - lo[0] + 1 : hi[2] - lo[2] + 1
  const Ht = hi[1] - lo[1] + 1
  const front = alongX ? (facing === 'north' ? 'north' : 'south') : (facing === 'west' ? 'west' : 'east')
  const base = alongX ? [front === 'north' ? hi[0] : lo[0], lo[1], lo[2]] : [lo[0], lo[1], front === 'west' ? lo[2] : hi[2]]
  const L = frame(base, front)
  const core = nether ? 'minecraft:obsidian' : M.T.block
  const mid = (W - 1) / 2
  const outerRise = Math.ceil((W + 2) / 2)
  const archTop = Ht + outerRise + 1
  // the mass of the gate: core (d -1..1) and the outer faces (d = +-2), pilasters at the ends
  for (let u = -3; u <= W + 2; u += 1)
    for (let d = -2; d <= 2; d += 1)
      for (let h = 0; h <= archTop; h += 1) {
        const opening = u >= 0 && u < W && h < Ht
        const step = Math.abs(d) === 2 && (u === -1 || u === W) && h < Ht
        if (opening || step) continue
        b.set(...L.at(u, d, h), Math.abs(d) <= 1 && (u === -1 || u === W) ? core : h <= 1 ? M.B.block : M.field)
      }
  // arches: the inner one over the opening (core, 3 deep), the outer one a step wider on each face
  const s = (u, d, h) => L.at(u, d, h)
  const archOpts = { type: kind === 'pvp' ? 'pointed' : 'round', fill: 'minecraft:air', top: L.origin[1] + archTop - 1 }
  b.arch(s(0, -1, Ht), [s(W - 1, -1, Ht)[0], s(0, -1, Ht)[1], s(W - 1, -1, Ht)[2]], core, { ...archOpts, depth: 3, direction: L.facing, spandrel: M.field })
  for (const d of [-2, 2]) b.arch(s(-1, d, Ht), [s(W, d, Ht)[0], s(0, d, Ht)[1], s(W, d, Ht)[2]], M.T.block, { ...archOpts, depth: 1, direction: L.facing, spandrel: M.field })
  // keystones at the crown of the outer rings
  for (const d of [-2, 2]) {
    let crownH = Ht
    for (let h = Ht; h <= archTop; h += 1) if (!b.get(...L.at(Math.floor(mid), d, h))) crownH = h
    for (let u = Math.floor(mid); u <= Math.ceil(mid); u += 1) b.set(...L.at(u, d, crownH + 1), keyBlock)
  }
  // the reveal: glass strips on the stepped jambs, lit from inside the core
  for (const [ju, lu] of [[-1, -2], [W, W + 1]])
    for (const d of [-1, 1])
      for (let h = 1; h < Ht - 1; h += 1) {
        b.set(...L.at(ju, d, h), nether ? core : M.glass)
        if (!nether) b.set(...L.at(lu, d, h), M.light)
      }
  // the trigger opening itself stays clear (the arches may round its top corners)
  for (let u = 0; u < W; u += 1) for (let h = 0; h < Ht; h += 1) for (let d = -2; d <= 2; d += 1) b.set(...L.at(u, d, h), 'minecraft:air')
  // pilasters on both faces: stair base, shaft, capital
  for (const u of [-3, -2, W + 1, W + 2])
    for (const d of [-3, 3]) {
      const back = d < 0 ? L.facing : L.back
      b.set(...L.at(u, d, 0), stair(M.B, back))
      if (u === -3 || u === W + 2) {
        for (let h = 1; h < archTop - 1; h += 1) b.set(...L.at(u, d, h), M.P.block)
        b.set(...L.at(u, d, archTop - 1), stair(M.T, back, 'top'))
      }
    }
  // threshold with a glowing inset across the opening
  for (let u = -4; u <= W + 3; u += 1)
    for (let d = -3; d <= 3; d += 1) {
      const inset = !nether && u >= 0 && u < W && d === 0
      b.set(...L.at(u, d, -2), inset ? M.light : M.B.block, inset ? undefined : { keep: true })
      if (Math.abs(d) <= 2 || (u >= 0 && u < W)) b.set(...L.at(u, d, -1), inset ? M.glass : nether && d === 0 && u >= 0 && u < W ? 'minecraft:obsidian' : u >= -1 && u <= W && Math.abs(d) <= 2 ? M.T.block : M.B.block)
    }
  // entablature with a projecting cornice, returned at the ends, and a cap with the keystone colour
  for (let u = -4; u <= W + 3; u += 1) {
    for (let d = -2; d <= 2; d += 1) b.set(...L.at(u, d, archTop), M.T.block)
    for (const d of [-3, 3]) b.set(...L.at(u, d, archTop), stair(M.T, d < 0 ? L.facing : L.back, 'top'))
    for (let d = -2; d <= 2; d += 1) b.set(...L.at(u, d, archTop + 1), Math.abs(u - mid) < 1 && d === 0 ? keyBlock : Math.abs(d) === 2 || u === -4 || u === W + 3 ? slab(M.T) : M.field)
  }
  for (const [u, sf] of [[-4, L.right], [W + 3, L.left]]) for (let d = -2; d <= 2; d += 1) b.set(...L.at(u, d, archTop), stair(M.T, sf, 'top'))
  if (nether) {
    const axis = alongX ? 'x' : 'z'
    for (let u = -1; u <= W; u += 1) {
      b.set(...L.at(u, 0, -1), 'minecraft:obsidian')
      b.set(...L.at(u, 0, Ht), 'minecraft:obsidian')
    }
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
