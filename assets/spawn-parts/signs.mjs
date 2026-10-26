// Block-letter titles (CRATES, LEADERBOARDS, the server name). Real spawns label almost everything
// with holograms, so letters are an option the user asks for, not a default: at most the server
// name and 2-3 titles, each where it reads from the plaza.
//
//   signStand(ctx, 'CRATES', [x, z], 'south', { style, outline, thick })   free-standing, on two posts
//   signStand(ctx, 'EMBER SMP', [x, z], 'south', { posts: false, y })     against a wall you built
//   signStyle(ctx, text, opts) → the b.sign options it resolves (to call b.sign yourself)
//
// Every choice can be 'auto' (the default), which picks for the theme:
//   style    'slim'     small 3x5 quartz letters smoothed with stairs: short and neat
//            'classic'  5-tall quartz letters with stair bevels on a dark board (reads from 60 blocks)
//            'colorful' concrete letters in the accent colour, outlined in terracotta, on a beam
//            auto → colorful for tropical / fantasy / autumn, classic otherwise
//   outline  true | false: a 1-block ring of a contrasting block round the letters. auto → on
//            unless slim
//   thick    true | false: every stroke one block wider (bold). auto → on for colorful
//   block / outlineBlock   override the letter block / the outline block (any full block)
//   board    true | false: the dark framed panel behind quartz letters. auto → on unless colorful
// `facing` is the side the reader stands on; [x, z] is the middle of the sign's front.

export function signStyle(ctx, text, { style = 'auto', outline = 'auto', thick = 'auto', block, outlineBlock, board = 'auto', maxWidth = 44 } = {}) {
  const { kit, theme } = ctx
  if (style === 'auto') style = ['tropical', 'fantasy', 'autumn'].includes(theme.key) ? 'colorful' : 'classic'
  const colorful = style === 'colorful'
  const bold0 = thick === 'auto' ? colorful : thick
  const outlineOn = outline === 'auto' ? style !== 'slim' : outline
  const dark = ['black', 'gray', 'brown'].includes(theme.accent)
  const letters = block ? ns(block) : colorful ? `minecraft:${theme.accent}_concrete` : 'minecraft:quartz_block'
  const ring = !outlineOn ? null : outlineBlock ? ns(outlineBlock) : colorful ? (dark ? 'minecraft:white_terracotta' : 'minecraft:black_terracotta') : 'minecraft:polished_deepslate'
  // bold strokes close the small font's counters, so thick text uses the 5-tall font
  let font = style === 'slim' && !bold0 ? 'small' : 'medium'
  if (kit.signWidth(text, font, { bold: bold0, outline: Boolean(ring) }) > maxWidth) font = 'small'
  const bold = bold0 && font !== 'small'
  const panel = board === 'auto' ? !colorful : board
  const boardBlock = !panel ? null : theme.key === 'white-town' ? 'minecraft:polished_deepslate' : theme.key === 'crimson' ? 'minecraft:polished_blackstone' : ns(kit.material(theme.wood).planks ?? 'dark_oak_planks')
  // quartz letters get stair bevels; other blocks stay square unless they have their own stairs
  const stairs = /quartz/.test(letters) ? 'quartz' : undefined
  return {
    style, font, bold, outline: ring, block: letters, stairs,
    board: boardBlock, frame: boardBlock ? undefined : false,
    width: kit.signWidth(text, font, { bold, outline: Boolean(ring) }),
    height: kit.signHeight(text, font),
  }
}

export function signStand(ctx, text, [x, z], facing, { y = ctx.FY, posts = true, ...opts } = {}) {
  const { b, theme } = ctx
  const st = signStyle(ctx, text, opts)
  const along = facing === 'north' || facing === 'south' ? [1, 0] : [0, 1]
  const top = y + st.height + (posts ? 4 : 1) // the text's top row; free-standing letters start 4 up
  b.sign(text, [x, top, z], facing, { font: st.font, align: 'center', board: st.board, block: st.block, stairs: st.stairs, bold: st.bold, outline: st.outline, frame: st.frame })
  if (!posts) return { ...st, top }
  const post = /log|stem/.test(theme.timber) ? `${ns(theme.timber)}` : 'minecraft:dark_oak_log'
  const half = Math.ceil(st.width / 2) + 2
  for (const s of [-1, 1]) {
    const px = x + along[0] * s * half
    const pz = z + along[1] * s * half
    for (let k = 1; k <= top - y + 3; k += 1) b.set(px, y + k, pz, `${post}[axis=y]`)
    b.set(px, top + 4, pz, 'minecraft:lantern[hanging=false]')
  }
  // letters without a board stand on a beam between the posts
  if (!st.board) {
    const axis = along[0] ? 'x' : 'z'
    for (let k = -half; k <= half; k += 1) b.set(x + along[0] * k, top - st.height - (st.outline ? 1 : 0), z + along[1] * k, `${post}[axis=${axis}]`)
  }
  return { ...st, top }
}

const ns = id => (String(id).includes(':') ? String(id) : `minecraft:${id}`)
