#!/usr/bin/env node

// Block color reference generator.
//
//   node scripts/dev/gen-block-colors.mjs [--pack <default-pack dir>] [--check]
//
// Reads Lodestone's bundled default resource pack (assets.json + atlas.png + block-flags/),
// resolves every block's model through its blockstate (the variant a builder would place by
// default, or the multipart parts matching a default state), follows model parent chains to
// resolve texture variables (#all, #side, #end, ...), orthographically "renders" each of the six
// faces of the block onto a 64x64 grid (alpha-over compositing, nearer faces over farther ones,
// overlays over bases, the renderer's own BlockColors tints applied where a face has a tintindex)
// and averages the visible pixels, alpha-weighted. Blocks without model geometry (liquids, chests,
// beds, signs, banners, heads) use the texture Lodestone's SpecialRenderer draws them with.
//
// Writes:
//   scripts/lib/data/block-colors.json   one entry per block id (machine readable)
//   references/building/block-colors.md  tables, gradient ladders, flat-vs-textured lists
//
// Only Node built-ins are used (PNG decoding is done with node:zlib).
// --check regenerates in memory and exits 1 if the committed files are stale.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const argValue = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const LODESTONE_DIR = path.join(ROOT, 'node_modules/@mattzh72/lodestone')
const PACK_DIR = path.resolve(argValue('--pack') ?? path.join(LODESTONE_DIR, 'assets/default-pack'))
const OUT_JSON = path.join(ROOT, 'scripts/lib/data/block-colors.json')
const OUT_MD = path.join(ROOT, 'references/building/block-colors.md')
const CHECK = args.includes('--check')

// ---------------------------------------------------------------------------------------------
// PNG decoding (8-bit RGBA / RGB, non-interlaced) with node:zlib only.
// ---------------------------------------------------------------------------------------------

function decodePng(buf) {
  const SIG = '89504e470d0a1a0a'
  if (buf.subarray(0, 8).toString('hex') !== SIG) throw new Error('not a PNG')
  let pos = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    pos += 12 + len
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2) || interlace !== 0) {
    throw new Error(`unsupported PNG (bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace})`)
  }
  const bpp = colorType === 6 ? 4 : 3
  const stride = width * bpp
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const px = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const cur = y * stride
    const prev = (y - 1) * stride
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? px[cur + x - bpp] : 0
      const b = y > 0 ? px[prev + x] : 0
      const c = x >= bpp && y > 0 ? px[prev + x - bpp] : 0
      let v = raw[src + x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      px[cur + x] = v & 0xff
    }
  }
  if (bpp === 4) return { width, height, data: px }
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0, j = 0; i < px.length; i += 3, j += 4) {
    rgba[j] = px[i]
    rgba[j + 1] = px[i + 1]
    rgba[j + 2] = px[i + 2]
    rgba[j + 3] = 255
  }
  return { width, height, data: rgba }
}

// ---------------------------------------------------------------------------------------------
// Color math: sRGB <-> linear, CIELAB (D65), HSL, CIEDE2000.
// ---------------------------------------------------------------------------------------------

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function rgbToLab([r, g, b]) {
  const R = srgbToLinear(r / 255)
  const G = srgbToLinear(g / 255)
  const B = srgbToLinear(b / 255)
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B
  const Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const fx = f(X)
  const fy = f(Y)
  const fz = f(Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function rgbToHsl([r, g, b]) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cm = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const h1p = C1p === 0 ? 0 : (Math.atan2(b1, a1p) / rad + 360) % 360
  const h2p = C2p === 0 ? 0 : (Math.atan2(b2, a2p) / rad + 360) % 360
  const dLp = L2 - L1
  const dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad)
  const Lpm = (L1 + L2) / 2
  const Cpm = (C1p + C2p) / 2
  let hpm = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hpm = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2
    else hpm = (h1p + h2p) / 2
  }
  const T = 1 - 0.17 * Math.cos((hpm - 30) * rad) + 0.24 * Math.cos(2 * hpm * rad)
    + 0.32 * Math.cos((3 * hpm + 6) * rad) - 0.2 * Math.cos((4 * hpm - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2)
  const Sc = 1 + 0.045 * Cpm
  const Sh = 1 + 0.015 * Cpm * T
  const Rt = -Math.sin(2 * dTheta * rad) * Rc
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))
}

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d

// ---------------------------------------------------------------------------------------------
// Pack loading.
// ---------------------------------------------------------------------------------------------

const assets = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'assets.json'), 'utf8'))
const atlas = decodePng(fs.readFileSync(path.join(PACK_DIR, 'atlas.png')))
const readList = (file) => new Set(
  fs.readFileSync(path.join(PACK_DIR, 'block-flags', file), 'utf8')
    .split(/\s+/).filter(Boolean).map((t) => (t.includes(':') ? t : `minecraft:${t}`)),
)
const opaqueSet = readList('opaque.txt')
const transparentSet = readList('transparent.txt')
const emissiveMap = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'block-flags', 'emissive.json'), 'utf8'))
// Use the renderer's own tint functions so tinted faces match what Lodestone draws.
const { BlockColors } = await import(pathToFileURL(path.join(LODESTONE_DIR, 'lib/render/BlockColors.js')).href)

const stripNs = (id) => (id ?? '').replace(/^minecraft:/, '')

// Same rule as Lodestone's createResourcesFromPack: non-square block textures are animation
// strips; only the first (square) frame is shown.
function textureRegion(texId) {
  const r = assets.textures[texId]
  if (!r) return null
  const [x, y, w, h] = r
  return { x, y, w, h: w !== h && texId.startsWith('block/') ? w : h }
}

function resolveModel(modelId) {
  const textures = {}
  let elements = null
  let cur = stripNs(modelId)
  const seen = new Set()
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const m = assets.models[cur]
    if (!m) break
    for (const [k, v] of Object.entries(m.textures ?? {})) if (!(k in textures)) textures[k] = v
    if (!elements && m.elements) elements = m.elements
    cur = m.parent ? stripNs(m.parent) : null
  }
  return { textures, elements: elements ?? [] }
}

function resolveTexture(textures, ref) {
  let r = ref
  // A few pack models reference a variable without its '#' (e.g. heavy_core uses "all").
  if (r && !r.startsWith('#') && !r.includes('/') && textures[r]) r = `#${r}`
  for (let n = 0; r && r.startsWith('#') && n < 16; n += 1) r = textures[r.slice(1)]
  if (!r || r.startsWith('#')) return null
  return stripNs(r)
}

// Prefer the state a builder would place by default: vertical axis, unlit, unpowered, bottom
// half, no snow, front facing north (so the remaining three sides show the "side" texture).
const PREFERRED = {
  axis: 'y', snowy: 'false', lit: 'false', powered: 'false', open: 'false', half: 'bottom',
  type: 'bottom', facing: 'north', shape: 'straight', waterlogged: 'false', triggered: 'false',
  enabled: 'true', hinge: 'left', face: 'floor', attachment: 'floor', hanging: 'false',
  in_wall: 'false', occupied: 'false', part: 'foot', extended: 'false', mode: 'compare',
  orientation: 'north_up', crafting: 'false', bloom: 'false', vertical_direction: 'up',
  thickness: 'tip', tilt: 'none', sculk_sensor_phase: 'inactive', unstable: 'false',
  layers: '1', flower_amount: '4', segment_amount: '4',
}
// Multipart blocks: connection/face booleans on (mushroom blocks become full cubes, vines and
// lichen get faces, fences/panes get arms); other booleans off; other props preferred/first.
const MULTIPART_DIRS = new Set(['north', 'south', 'east', 'west', 'up', 'down'])

function scoreProps(props) {
  let score = 0
  for (const [k, v] of Object.entries(props)) {
    if (PREFERRED[k] === v) score += 2
    else if (k === 'age') score += Number(v) / 100 // mature crops/stems look like the plant
    else if (['level', 'power', 'stage', 'distance', 'bites', 'moisture', 'hatch', 'rotation', 'note', 'charges'].includes(k)) score += v === '0' ? 1 : 0
  }
  return score
}

function chooseVariant(variants) {
  let best = null
  let bestScore = -Infinity
  for (const key of Object.keys(variants)) {
    const props = Object.fromEntries(key.split(',').filter(Boolean).map((kv) => kv.split('=')))
    const score = scoreProps(props)
    if (score > bestScore) {
      bestScore = score
      best = key
    }
  }
  const v = variants[best]
  const props = Object.fromEntries(best.split(',').filter(Boolean).map((kv) => kv.split('=')))
  return { props, parts: [Array.isArray(v) ? v[0] : v] }
}

function whenMatches(when, state) {
  if (!when) return true
  if (when.OR) return when.OR.some((w) => whenMatches(w, state))
  if (when.AND) return when.AND.every((w) => whenMatches(w, state))
  return Object.entries(when).every(([k, v]) => String(v).split('|').includes(state[k]))
}

function chooseMultipart(multipart) {
  const seen = {}
  const visit = (w) => {
    if (!w) return
    if (w.OR) return w.OR.forEach(visit)
    if (w.AND) return w.AND.forEach(visit)
    for (const [k, v] of Object.entries(w)) for (const opt of String(v).split('|')) (seen[k] ??= new Set()).add(opt)
  }
  multipart.forEach((p) => visit(p.when))
  const state = {}
  for (const [k, values] of Object.entries(seen)) {
    const vals = [...values]
    if (vals.every((v) => v === 'true' || v === 'false')) state[k] = MULTIPART_DIRS.has(k) ? 'true' : (PREFERRED[k] ?? 'false')
    else state[k] = PREFERRED[k] ?? vals[0]
  }
  const pick = (apply) => (Array.isArray(apply) ? apply[0] : apply)
  const parts = multipart.filter((p) => whenMatches(p.when, state)).map((p) => pick(p.apply))
  return { props: state, parts: parts.length ? parts : [pick(multipart[0].apply)] }
}

function chooseParts(state) {
  if (state.variants) return chooseVariant(state.variants)
  if (state.multipart) return chooseMultipart(state.multipart)
  return { props: {}, parts: [] }
}

// ---------------------------------------------------------------------------------------------
// Orthographic face projection.
// ---------------------------------------------------------------------------------------------

const GRID = 64 // 4 samples per model pixel
const SCALE = GRID / 16
const DIRS = ['up', 'down', 'north', 'south', 'east', 'west']
const DIR_VEC = { up: [0, 1, 0], down: [0, -1, 0], north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0] }
const vecToDir = (v) => DIRS.find((d) => DIR_VEC[d].every((c, i) => c === Math.round(v[i])))
const BOUNDARY_DEPTH = { up: 16, south: 16, east: 16, down: 0, north: 0, west: 0 }

// Blockstate rotation: x first (north -> down for x=90), then y (north -> east for y=90).
function rotateVec([x, y, z], rx, ry) {
  for (let i = 0; i < ((rx / 90) % 4 + 4) % 4; i += 1) [y, z] = [z, -y]
  for (let i = 0; i < ((ry / 90) % 4 + 4) % 4; i += 1) [x, z] = [-z, x]
  return [x, y, z]
}
const rotatePoint = (p, rx, ry) => rotateVec([p[0] - 8, p[1] - 8, p[2] - 8], rx, ry).map((c) => c + 8)

// Face rectangle in view-plane coordinates (u right, v down, as seen from outside) and depth
// (larger = closer to the viewer). Also the vanilla default UV for an unrotated face.
function faceRect(dir, [x0, y0, z0], [x1, y1, z1]) {
  switch (dir) {
    case 'up': return { u0: x0, v0: z0, u1: x1, v1: z1, depth: y1 }
    case 'down': return { u0: x0, v0: 16 - z1, u1: x1, v1: 16 - z0, depth: -y0 }
    case 'south': return { u0: x0, v0: 16 - y1, u1: x1, v1: 16 - y0, depth: z1 }
    case 'north': return { u0: 16 - x1, v0: 16 - y1, u1: 16 - x0, v1: 16 - y0, depth: -z0 }
    case 'east': return { u0: 16 - z1, v0: 16 - y1, u1: 16 - z0, v1: 16 - y0, depth: x1 }
    case 'west': return { u0: z0, v0: 16 - y1, u1: z1, v1: 16 - y0, depth: -x0 }
    default: throw new Error(dir)
  }
}

function collectFaces(parts, tint) {
  const faces = Object.fromEntries(DIRS.map((d) => [d, []]))
  let order = 0
  for (const part of parts) {
    const { textures, elements } = resolveModel(part.model)
    const rx = part.x ?? 0
    const ry = part.y ?? 0
    for (const el of elements) {
      const a = rotatePoint(el.from, rx, ry)
      const b = rotatePoint(el.to, rx, ry)
      const from = [0, 1, 2].map((i) => Math.min(a[i], b[i]))
      const to = [0, 1, 2].map((i) => Math.max(a[i], b[i]))
      for (const [localDir, face] of Object.entries(el.faces ?? {})) {
        if (!face?.texture) continue
        const tex = resolveTexture(textures, face.texture)
        const region = tex && textureRegion(tex)
        if (!region) continue
        const worldDir = vecToDir(rotateVec(DIR_VEC[localDir], rx, ry))
        const rect = faceRect(worldDir, from, to)
        const local = faceRect(localDir, el.from, el.to)
        const uv = face.uv ?? [local.u0, local.v0, local.u1, local.v1]
        const t = face.tintindex !== undefined && face.tintindex >= 0 && tint ? tint : null
        faces[worldDir].push({ rect, uv, tex, region, tint: t, order: (order += 1) })
      }
    }
  }
  return faces
}

function uniformFaces(tex, tint, sub) {
  const region = textureRegion(tex)
  if (!region) return null
  const r = sub ? { ...region, x: region.x + sub[0], y: region.y + sub[1], w: sub[2], h: sub[3] } : region
  const faces = {}
  for (const d of DIRS) faces[d] = [{ rect: { u0: 0, v0: 0, u1: 16, v1: 16, depth: BOUNDARY_DEPTH[d] }, uv: [0, 0, 16, 16], tex, region: r, tint, order: 0 }]
  return faces
}

// Paints one view direction: farther faces first, then nearer ones; same-depth faces in model
// order (so grass/overlay layers land on top of their base). Premultiplied alpha.
function renderDirection(dir, list) {
  const canvas = new Float64Array(GRID * GRID * 4)
  const boundary = new Float64Array(GRID * GRID) // alpha coverage from faces on the block boundary
  const geom = new Uint8Array(GRID * GRID) // pixels covered by boundary faces, ignoring alpha
  const sorted = [...list].sort((p, q) => p.rect.depth - q.rect.depth || p.order - q.order)
  const usage = new Map()
  let samples = 0
  let holes = 0
  for (const f of sorted) {
    const { u0, v0, u1, v1, depth } = f.rect
    if (u1 - u0 <= 0 || v1 - v0 <= 0) continue
    const onBoundary = depth >= BOUNDARY_DEPTH[dir] - 0.01
    const { x: tx, y: ty, w: tw, h: th } = f.region
    const [U0, V0, U1, V1] = f.uv
    const iu0 = Math.max(0, Math.ceil(u0 * SCALE - 0.5))
    const iu1 = Math.min(GRID - 1, Math.ceil(u1 * SCALE - 0.5) - 1)
    const iv0 = Math.max(0, Math.ceil(v0 * SCALE - 0.5))
    const iv1 = Math.min(GRID - 1, Math.ceil(v1 * SCALE - 0.5) - 1)
    const key = f.tex + (f.tint ? '*' : '')
    let painted = 0
    for (let iv = iv0; iv <= iv1; iv += 1) {
      const fv = ((iv + 0.5) / SCALE - v0) / (v1 - v0)
      const tvy = Math.min(th - 1, Math.max(0, Math.floor(((V0 + fv * (V1 - V0)) / 16) * th)))
      for (let iu = iu0; iu <= iu1; iu += 1) {
        const fu = ((iu + 0.5) / SCALE - u0) / (u1 - u0)
        const tux = Math.min(tw - 1, Math.max(0, Math.floor(((U0 + fu * (U1 - U0)) / 16) * tw)))
        const p = ((ty + tvy) * atlas.width + (tx + tux)) * 4
        const alpha = atlas.data[p + 3] / 255
        const i = iv * GRID + iu
        if (onBoundary) geom[i] = 1
        samples += 1
        if (alpha < 1) holes += 1
        if (alpha <= 0) continue
        let r = atlas.data[p]
        let g = atlas.data[p + 1]
        let b = atlas.data[p + 2]
        if (f.tint) {
          r *= f.tint[0]
          g *= f.tint[1]
          b *= f.tint[2]
        }
        const q = i * 4
        const k = 1 - alpha
        canvas[q] = r * alpha + canvas[q] * k
        canvas[q + 1] = g * alpha + canvas[q + 1] * k
        canvas[q + 2] = b * alpha + canvas[q + 2] * k
        canvas[q + 3] = alpha + canvas[q + 3] * k
        if (onBoundary) boundary[i] = alpha + boundary[i] * k
        painted += alpha
      }
    }
    if (painted > 0) usage.set(key, (usage.get(key) ?? 0) + painted)
  }
  let sr = 0
  let sg = 0
  let sb = 0
  let sa = 0
  let sbound = 0
  let sgeom = 0
  for (let i = 0; i < GRID * GRID; i += 1) {
    sgeom += geom[i]
    sr += canvas[i * 4]
    sg += canvas[i * 4 + 1]
    sb += canvas[i * 4 + 2]
    sa += canvas[i * 4 + 3]
    sbound += boundary[i]
  }
  if (sa <= 0) return null
  const signature = [...usage.entries()].sort((p, q) => q[1] - p[1]).map(([t]) => t).join('+')
  return {
    canvas,
    rgb: [sr / sa, sg / sa, sb / sa],
    sum: [sr, sg, sb, sa],
    cover: sa / (GRID * GRID),
    boundaryCover: sbound / (GRID * GRID),
    geomCover: sgeom / (GRID * GRID),
    holeFraction: samples ? holes / samples : 0,
    signature,
  }
}

// Texture busyness: alpha-weighted standard deviation of per-pixel L*/100 (0 = flat colour).
function busyness(res) {
  const { canvas } = res
  const vals = []
  let mean = 0
  let wsum = 0
  for (let q = 0; q < canvas.length; q += 4) {
    const a = canvas[q + 3]
    if (a <= 0) continue
    const L = rgbToLab([canvas[q] / a, canvas[q + 1] / a, canvas[q + 2] / a])[0] / 100
    vals.push(L, a)
    mean += L * a
    wsum += a
  }
  mean /= wsum
  let variance = 0
  for (let i = 0; i < vals.length; i += 2) variance += vals[i + 1] * (vals[i] - mean) ** 2
  return Math.sqrt(variance / wsum)
}

// ---------------------------------------------------------------------------------------------
// Blocks without model geometry (drawn by Lodestone's SpecialRenderer or as liquids).
// ---------------------------------------------------------------------------------------------

// Dye colours used by the renderer for banners, parsed from SpecialRenderer.js to stay in sync.
const DYE = (() => {
  const src = fs.readFileSync(path.join(LODESTONE_DIR, 'lib/render/SpecialRenderer.js'), 'utf8')
  const block = src.slice(src.indexOf('const DyeColors'), src.indexOf('};', src.indexOf('const DyeColors')))
  const out = {}
  for (const m of block.matchAll(/(\w+): Color\.intToRgb\((\d+)\)/g)) {
    const n = Number(m[2])
    out[m[1]] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  return out
})()

function specialFaces(name, tint) {
  let m
  if (name === 'water' || name === 'bubble_column') return uniformFaces('block/water_still', BlockColors.water?.({}) ?? tint)
  if (name === 'lava') return uniformFaces('block/lava_still', null)
  // Sub-regions (pixels of the 64px entity textures): bed blanket top, chest lid top, sign board.
  if ((m = name.match(/^(.+)_bed$/)) && DYE[m[1]]) return uniformFaces(`entity/bed/${m[1]}`, null, [6, 28, 16, 16])
  if ((m = name.match(/^(.+?)_(wall_)?banner$/)) && DYE[m[1]]) return uniformFaces('entity/banner/base', DYE[m[1]])
  const chest = { chest: 'normal', trapped_chest: 'trapped', ender_chest: 'ender' }[name]
  if (chest) return uniformFaces(`entity/chest/${chest}`, null, [28, 0, 14, 14])
  if ((m = name.match(/^(.+?)_(wall_)?sign$/)) && !name.includes('hanging')) return uniformFaces(`entity/signs/${m[1]}`, null, [2, 2, 24, 12])
  if (name === 'decorated_pot') return uniformFaces('entity/decorated_pot/decorated_pot_side', null)
  if (name === 'conduit') return uniformFaces('entity/conduit/base', null)
  const head = {
    skeleton_skull: 'skeleton/skeleton', skeleton_wall_skull: 'skeleton/skeleton',
    wither_skeleton_skull: 'skeleton/wither_skeleton', wither_skeleton_wall_skull: 'skeleton/wither_skeleton',
    zombie_head: 'zombie/zombie', zombie_wall_head: 'zombie/zombie',
    creeper_head: 'creeper/creeper', creeper_wall_head: 'creeper/creeper',
    piglin_head: 'piglin/piglin', piglin_wall_head: 'piglin/piglin',
  }[name]
  if (head) return uniformFaces(`entity/${head}`, null, [0, 0, 32, 16]) // head region of the skin
  return null
}

// ---------------------------------------------------------------------------------------------
// Per-block computation.
// ---------------------------------------------------------------------------------------------

const AIR = new Set(['air', 'cave_air', 'void_air'])
const blocks = {}
const shapeInfo = {} // id -> { cube }: geometry fills the whole block (ignoring texture alpha)
const skipped = []
const approximated = []

for (const name of Object.keys(assets.blockstates).sort()) {
  if (AIR.has(name)) continue
  const id = `minecraft:${name}`
  const { parts, props } = chooseParts(assets.blockstates[name])
  const tint = BlockColors[name] ? BlockColors[name](props) : null
  let faces = collectFaces(parts, tint)
  let approx = false
  if (!DIRS.some((d) => faces[d].length)) {
    // Liquids and entity-rendered blocks (chests, beds, signs, banners, shulker boxes, skulls)
    // have no model elements in the pack: use the texture the renderer draws them with, or the
    // model's particle texture.
    faces = specialFaces(name, tint)
    if (!faces) {
      for (const part of parts) {
        const { textures } = resolveModel(part.model)
        const tex = resolveTexture(textures, textures.particle ?? '')
        if (tex && textureRegion(tex)) {
          faces = uniformFaces(tex, null)
          break
        }
      }
    }
    approx = true
  }
  const res = faces ? Object.fromEntries(DIRS.map((d) => [d, renderDirection(d, faces[d])])) : null
  if (!res || !DIRS.some((d) => res[d])) {
    skipped.push(id)
    continue
  }
  if (approx) approximated.push(id)

  // "side" = the most common appearance among the four horizontal faces (a furnace facing north
  // reports its plain side, not its front). Ties prefer south, east, west, north.
  const horiz = ['south', 'east', 'west', 'north'].filter((d) => res[d])
  const fallback = res.up ?? res.down
  let side = fallback
  if (horiz.length) {
    const counts = new Map()
    for (const d of horiz) counts.set(res[d].signature, (counts.get(res[d].signature) ?? 0) + 1)
    side = res[horiz.reduce((best, d) => (counts.get(res[d].signature) > counts.get(res[best].signature) ? d : best), horiz[0])]
  }
  const top = res.up ?? side
  const bottom = res.down ?? side
  let tot = [0, 0, 0, 0]
  for (const d of DIRS) if (res[d]) tot = tot.map((v, i) => v + res[d].sum[i])
  const avg = [tot[0] / tot[3], tot[1] / tot[3], tot[2] / tot[3]]

  const translucent = transparentSet.has(id)
  const solidCube = !approx && DIRS.every((d) => res[d] && res[d].boundaryCover > 0.999)
  shapeInfo[id] = { cube: !approx && DIRS.every((d) => res[d] && res[d].geomCover > 0.999) }
  const holes = DIRS.some((d) => res[d] && res[d].holeFraction > 0.01)
  const lab = rgbToLab(side.rgb)
  const [h, s, l] = rgbToHsl(side.rgb)
  const entry = {
    top: hex(top.rgb),
    side: hex(side.rgb),
    bottom: hex(bottom.rgb),
    avg: hex(avg),
    lab: lab.map((v) => round(v, 1)),
    hue: Math.round(h) % 360,
    sat: round(s, 3),
    light: round(l, 3),
    full: solidCube && !translucent,
    opaque: opaqueSet.has(id),
    transparent: translucent || holes,
    emissive: Boolean(emissiveMap[id]),
    noise: round(busyness(side), 3),
    cover: round(side.cover, 3),
    tex: side.signature.split('+')[0].replace(/^(block|entity)\//, '').replace(/\*$/, ''),
  }
  if (emissiveMap[id]?.conditional) entry.emissiveWhen = emissiveMap[id].conditional
  if (side.signature.includes('*') || top.signature.includes('*')) entry.tinted = true
  if (approx) entry.approx = true
  blocks[id] = entry
}

// ---------------------------------------------------------------------------------------------
// Markdown reference.
// ---------------------------------------------------------------------------------------------

const short = (id) => id.replace(/^minecraft:/, '')

function lch(e) {
  const [L, a, b] = e.lab
  return { L, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 }
}

const FAMILIES = [
  ['neutral', 'Whites, greys and blacks'],
  ['brown', 'Browns and woods'],
  ['red', 'Reds'],
  ['orange', 'Oranges'],
  ['yellow', 'Yellows, sands and creams'],
  ['green', 'Greens'],
  ['teal', 'Cyans and teals'],
  ['blue', 'Blues'],
  ['purple', 'Purples and magentas'],
  ['pink', 'Pinks'],
]

// Colour family from the side colour's CIELAB lightness/chroma/hue angle.
function family(e) {
  const { L, C, h } = lch(e)
  if (C < 10) return 'neutral'
  if (h >= 345 || h < 42) {
    if (L >= (h >= 345 ? 55 : 60)) return 'pink'
    return h >= 345 ? 'purple' : 'red'
  }
  if (h < 75) return L >= 66 ? 'yellow' : C >= 36 ? 'orange' : 'brown'
  if (h < 113) return C < 36 && L < 66 ? 'brown' : 'yellow'
  if (h < 160) return 'green'
  if (h < 225) return 'teal'
  if (h < 308) return 'blue'
  return 'purple'
}

const TECHNICAL = new Set(['command_block', 'chain_command_block', 'repeating_command_block', 'structure_block', 'jigsaw'])
const FEATURE = new Set([
  'crafting_table', 'furnace', 'blast_furnace', 'smoker', 'dispenser', 'dropper', 'observer', 'piston',
  'sticky_piston', 'note_block', 'jukebox', 'bookshelf', 'chiseled_bookshelf', 'barrel', 'loom',
  'cartography_table', 'fletching_table', 'smithing_table', 'crafter', 'tnt', 'target', 'beehive', 'bee_nest',
  'lodestone', 'respawn_anchor', 'sculk_catalyst', 'redstone_lamp', 'pumpkin', 'carved_pumpkin',
  'jack_o_lantern', 'melon', 'copper_bulb', 'exposed_copper_bulb', 'weathered_copper_bulb', 'oxidized_copper_bulb',
])
const CREATIVE = new Set(['bedrock', 'reinforced_deepslate', 'budding_amethyst'])
const TERRAIN_TOP = new Set(['grass_block', 'mycelium', 'podzol', 'crimson_nylium', 'warped_nylium'])
const isOre = (n) => /_ore$/.test(n)
const isAlias = (n) => /^(infested_|waxed_|suspicious_)/.test(n)
const isLiveCoral = (n) => /^(tube|brain|bubble|fire|horn)_coral_block$/.test(n)
const isGravity = (n) => n === 'sand' || n === 'red_sand' || n === 'gravel' || /_concrete_powder$/.test(n)
const isGlazed = (n) => /_glazed_terracotta$/.test(n)
const fmtL = (e) => e.lab[0].toFixed(0)
const busyLabel = (v) => (v < 0.03 ? 'smooth' : v < 0.08 ? 'subtle' : 'busy')
const code = (s) => `\`${s}\``
const dE = (a, b) => deltaE2000(a.lab ?? a, b.lab ?? b)
const topDiffers = (e) => deltaE2000(rgbToLab(hexToRgb(e.top)), e.lab) >= 5

function rowNotes(n, e, aliases, bark) {
  const out = []
  if (/_concrete$/.test(n)) out.push('flat, plastic-looking')
  else if (/(^|_)terracotta$/.test(n) && !isGlazed(n)) out.push('matte, near-flat')
  if (isGlazed(n)) out.push('bold rotating pattern')
  if (n === 'grass_block') out.push('top is grass-tinted; side is dirt with a green fringe')
  else if (e.tinted) out.push('tinted by renderer')
  if (/(_log|_stem)$/.test(n) && topDiffers(e)) out.push('bark sides, rings on top')
  else if (topDiffers(e)) out.push('distinct top texture')
  if (e.emissive) out.push('emits light')
  if (isGravity(n)) out.push('falls (gravity)')
  if (isLiveCoral(n)) out.push('turns grey without water')
  if (CREATIVE.has(n)) out.push('creative-only')
  if (n === 'powder_snow') out.push('looks like snow_block; entities sink')
  if (bark) out.push(`${code(bark)} has this side on all faces`)
  if (aliases.length) out.push(`same look: ${aliases.map(code).join(', ')}`)
  return out.join('; ')
}

// Rows of identical-looking blocks (same side and top colour) are merged; aliases (infested_,
// waxed_, suspicious_) never get their own row.
function groupRows(ids) {
  const groups = new Map()
  for (const id of ids) {
    const n = short(id)
    if (isAlias(n)) continue
    const e = blocks[id]
    const key = `${e.side}|${e.top}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(n)
  }
  const rows = [...groups.values()].map((names) => {
    names.sort((a, b) => a.length - b.length || a.localeCompare(b))
    return { n: names[0], e: blocks[`minecraft:${names[0]}`], aliases: names.slice(1), bark: null }
  })
  // `*_wood` / `*_hyphae` are the log's side texture on all six faces: fold them into the log row.
  const byName = new Map(rows.map((r) => [r.n, r]))
  return rows.filter((r) => {
    const log = byName.get(r.n.replace(/_wood$/, '_log').replace(/_hyphae$/, '_stem'))
    if (log && log !== r && log.e.side === r.e.side) {
      log.bark = r.n
      return false
    }
    return true
  })
}

function blockTable(rows) {
  const lines = ['| block | side | top | L* | busyness | notes |', '|---|---|---|---|---|---|']
  for (const { n, e, aliases, bark } of rows) {
    const top = topDiffers(e) ? code(e.top) : ''
    lines.push(`| ${code(n)} | ${code(e.side)} | ${top} | ${fmtL(e)} | ${busyLabel(e.noise)} ${e.noise.toFixed(3)} | ${rowNotes(n, e, aliases, bark)} |`)
  }
  return lines.join('\n')
}

// --- Gradient ladders --------------------------------------------------------------------------

const sub = (a, b) => a.map((v, i) => v - b[i])
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0)

// Finds the smoothest chain from `from` to `to` through the candidate pool: candidates are
// ordered by their projection onto the from->to line in CIELAB and must stay inside a corridor
// around it; a dynamic program picks, for each step count, the chain minimising the sum of
// CIEDE2000 steps to the 4th power (which strongly favours even spacing and punishes single big
// jumps) plus a small penalty for straying from the line. The step count kept is the one with the
// best evenness score (2 * largest step - smallest step), preferring more steps on near-ties.
// `via` adds waypoints: the ladder is solved segment by segment and concatenated.
function findSegment(fromName, toName, pool, spec, stepRange) {
  const A = blocks[`minecraft:${fromName}`]
  const B = blocks[`minecraft:${toName}`]
  if (!A || !B) throw new Error(`ladder endpoint missing: ${fromName} / ${toName}`)
  const ab = sub(B.lab, A.lab)
  const len2 = dot(ab, ab)
  const corridor = spec.corridor ?? Math.max(12, 0.3 * Math.sqrt(len2))
  const nodes = [{ n: fromName, e: A, t: 0, d: 0 }]
  for (const { n, e } of pool) {
    if (n === fromName || n === toName) continue
    const t = dot(sub(e.lab, A.lab), ab) / len2
    if (t <= 0.03 || t >= 0.97) continue
    const proj = A.lab.map((v, i) => v + ab[i] * t)
    const d = Math.sqrt(dot(sub(e.lab, proj), sub(e.lab, proj)))
    if (d > corridor) continue
    nodes.push({ n, e, t, d })
  }
  nodes.push({ n: toName, e: B, t: 1, d: 0 })
  nodes.sort((p, q) => p.t - q.t)
  const N = nodes.length
  const [minSteps, maxSteps] = stepRange
  const lambda = spec.lambda ?? 0.5
  const edge = (i, j) => dE(nodes[i].e, nodes[j].e) ** 4 + lambda * nodes[j].d ** 4 / 100
  // Value must move one way (light to dark or dark to light) unless the endpoints share a value.
  const dir = Math.sign(B.lab[0] - A.lab[0])
  const monotonic = Math.abs(B.lab[0] - A.lab[0]) >= 10
  const allowed = (i, j) => !monotonic || (nodes[j].e.lab[0] - nodes[i].e.lab[0]) * dir >= -1
  let prev = new Array(N).fill(Infinity)
  prev[0] = 0
  const back = []
  const results = []
  for (let k = 1; k <= maxSteps; k += 1) {
    const cur = new Array(N).fill(Infinity)
    const bk = new Array(N).fill(-1)
    for (let j = 1; j < N; j += 1) {
      for (let i = 0; i < j; i += 1) {
        if (prev[i] === Infinity || nodes[j].t <= nodes[i].t || !allowed(i, j)) continue
        const c = prev[i] + edge(i, j)
        if (c < cur[j]) {
          cur[j] = c
          bk[j] = i
        }
      }
    }
    back.push(bk)
    prev = cur
    if (k >= minSteps && cur[N - 1] < Infinity) {
      const path = [N - 1]
      for (let kk = k - 1; kk >= 0; kk -= 1) path.unshift(back[kk][path[0]])
      const chain = path.map((i) => nodes[i])
      const steps = chain.slice(1).map((c, i) => dE(chain[i].e, c.e))
      const min = Math.min(...steps)
      const max = Math.max(...steps)
      results.push({ k, chain, steps, min, max, score: 2 * max - min + (min < 3 ? 3 * (3 - min) + 4 : 0) })
    }
  }
  if (!results.length) return null
  const best = Math.min(...results.map((r) => r.score))
  return results.filter((r) => r.score <= best + 0.5).pop()
}

function findLadder(spec, pool) {
  const points = [spec.from, ...(spec.via ?? []), spec.to]
  const segs = points.length - 1
  const [lo, hi] = spec.steps ?? [5, 9]
  let chain = []
  for (let s = 0; s < segs; s += 1) {
    const range = segs === 1 ? [lo, hi] : [Math.max(1, Math.floor(lo / segs)), Math.ceil(hi / segs) + 1]
    const r = findSegment(points[s], points[s + 1], pool, spec, range)
    if (!r) return null
    chain = chain.concat(s === 0 ? r.chain : r.chain.slice(1))
  }
  const steps = chain.slice(1).map((c, i) => dE(chain[i].e, c.e))
  return { chain, steps, min: Math.min(...steps), max: Math.max(...steps) }
}

function ladderTable(chain) {
  const lines = ['| step | block | side | L* | ΔE00 from previous |', '|---|---|---|---|---|']
  chain.forEach((c, i) => {
    const step = i === 0 ? '' : dE(chain[i - 1].e, c.e).toFixed(1)
    lines.push(`| ${i + 1} | ${code(c.n)} | ${code(c.e.side)} | ${fmtL(c.e)} | ${step} |`)
  })
  return lines.join('\n')
}

// --- Document ----------------------------------------------------------------------------------

function renderMarkdown() {
  const all = Object.keys(blocks)
  const fullIds = all.filter((id) => blocks[id].full)
  const mainIds = fullIds.filter((id) => {
    const n = short(id)
    return !TECHNICAL.has(n) && !isOre(n) && !FEATURE.has(n)
  })
  const mainRows = groupRows(mainIds)
  const byFamily = Object.fromEntries(FAMILIES.map(([k]) => [k, []]))
  for (const r of mainRows) byFamily[family(r.e)].push(r)
  for (const k of Object.keys(byFamily)) byFamily[k].sort((p, q) => q.e.lab[0] - p.e.lab[0] || p.n.localeCompare(q.n))

  // Ladder pool: plain full building blocks (no patterns, faces, glow, gravity-free not required).
  const ladderPool = mainRows
    .filter(({ n, e }) => !isGlazed(n) && !isLiveCoral(n) && !CREATIVE.has(n) && !e.emissive && !e.tinted && !TERRAIN_TOP.has(n) && n !== 'powder_snow')
    .map((r) => ({ ...r, fam: family(r.e), ...lch(r.e) }))
  // Collapse near-identical colours (ΔE00 < 1) to one representative, preferring short names.
  const pool = []
  for (const r of [...ladderPool].sort((p, q) => p.n.length - q.n.length || p.n.localeCompare(q.n))) {
    if (!pool.some((p) => dE(p.e, r.e) < 1)) pool.push(r)
  }

  const out = []
  const p = (s = '') => out.push(s)
  p('# Block colour reference')
  p()
  p('<!-- Generated by `node scripts/dev/gen-block-colors.mjs`; do not edit by hand. -->')
  p()
  p('Average colours of every block, measured from the textures the renderer actually draws: Lodestone\'s')
  p('bundled default pack (vanilla 1.21.1 textures; its atlas matches the vanilla PNGs pixel for pixel).')
  p('Machine-readable data for every block id is in `scripts/lib/data/block-colors.json`.')
  p()
  p('## How to use this')
  p()
  p('- **Design by value first.** `L*` is perceptual lightness (0 black, 100 white). Wall vs. trim reads clearly at')
  p('  ΔL* ≥ 15; a two-tone wall that should read as one surface stays within ΔL* ≈ 8.')
  p('- **Gradients.** Use a ladder below or pick blocks whose `L*` steps evenly. ΔE00 (CIEDE2000 colour difference)')
  p('  of 3 to 7 between neighbours blends smoothly; 8 to 12 shows as distinct bands; over 15 is a hard edge. Dither')
  p('  (checkerboard or random mix) two neighbours to fake an in-between step.')
  p('- **Palettes.** A common split is roughly 60% base (smooth or subtle), 30% secondary (a ΔL* of 15 or more away),')
  p('  10% accent. Blocks from one material set (deepslate, sandstone, blackstone, quartz, a wood type) share texture')
  p('  style and mix cleanly.')
  p('- **Accents.** Pick an accent from a different family with similar `L*` for a quiet accent, or a large `L*` jump')
  p('  (≥ 25) for one that pops. Flat concrete accents on busy stone read as modern and plastic.')
  p('- **Texture busyness** is the standard deviation of per-pixel L*/100 inside the side texture: smooth < 0.03,')
  p('  subtle 0.03 to 0.08, busy ≥ 0.08. Large areas of busy blocks look noisy from a distance; mix a busy block with a')
  p('  smooth one of similar colour for depth without changing the hue.')
  p('- **Shading.** Hex values are unshaded texture colours. In renders and in game, top faces are brightest and')
  p('  sides darker, so a block reads lighter on a floor than on a wall. Judge contrast with `L*`, not the hex alone.')
  p('- **Partial blocks** (stairs, slabs, walls, fences, buttons, pressure plates) reuse their full block\'s texture,')
  p('  so they have that block\'s colour. Exceptions: bamboo stairs/slab use `bamboo_planks` (not `bamboo_block`),')
  p('  `smooth_stone_slab` has its own lighter side texture, `petrified_oak_slab` looks like `oak_planks`, and')
  p('  `smooth_*` stairs/slabs use the smooth block\'s texture on every face. Each partial block also has its own entry')
  p('  in the JSON.')
  p('- **Look-alikes.** `waxed_*` copper is identical to the unwaxed block, `infested_*` to its stone, and')
  p('  `suspicious_sand`/`suspicious_gravel` to sand/gravel; they are left out of the tables below.')
  p()
  p('Lookup from a recipe or script (run from the skill directory):')
  p()
  p('```js')
  p("import fs from 'node:fs'")
  p("const colors = JSON.parse(fs.readFileSync('scripts/lib/data/block-colors.json', 'utf8'))")
  p("colors['minecraft:stone'].side // '#7e7e7e'")
  p("const flatWhites = Object.entries(colors).filter(([, c]) => c.full && c.lab[0] > 85 && c.noise < 0.03)")
  p('```')
  p()
  p('## JSON fields')
  p()
  p('One entry per block id (`"minecraft:stone"`), one entry per line:')
  p()
  p('| field | meaning |')
  p('|---|---|')
  p('| `top`, `side`, `bottom` | Average colour of that face, as seen from outside (overlays composited, tint applied). `side` is the most common of the four horizontal faces, so a furnace reports its plain side, not its front. |')
  p('| `avg` | Average over all six faces. |')
  p('| `lab` | CIELAB `[L*, a*, b*]` of `side` (D65). |')
  p('| `hue`, `sat`, `light` | HSL of `side` (hue in degrees, sat and light 0 to 1). |')
  p('| `full` | Full cube whose six faces are completely opaque (and not drawn translucent). |')
  p('| `opaque` | Listed in the renderer\'s `block-flags/opaque.txt` (it culls faces hidden behind this block). |')
  p('| `transparent` | See-through: drawn translucent (`transparent.txt`) or the texture has holes (glass, leaves, plants). |')
  p('| `emissive` | Glows in the renderer (`emissive.json`); `emissiveWhen` names the state it needs, e.g. `lit`. |')
  p('| `noise` | Texture busyness of the side: std-dev of per-pixel L*/100. |')
  p('| `cover` | Fraction of the side view covered by the block (1 for full cubes, lower for slabs, panes, plants). |')
  p('| `tex` | Main texture on the side face. |')
  p('| `tinted` | A face is multiplied by the renderer\'s grass/foliage/water colour. |')
  p('| `approx` | No model geometry (liquids, chests, beds, signs, banners, heads, shulker boxes): colour taken from the texture the renderer draws them with. |')
  p()
  p('Colours are alpha-weighted sRGB means of the first animation frame; the block state used is the default a builder')
  p('would place (vertical axis, unlit, unpowered, bottom half, facing north, mature crops).')
  p()
  p(`## Full opaque building blocks by colour family`)
  p()
  p(`${mainIds.filter((id) => !isAlias(short(id))).length} full opaque cubes in ${mainRows.length} rows (\`*_wood\`/\`*_hyphae\` share their log's row), sorted light to dark`)
  p('within each family. `top` is shown only when it differs visibly from the side. Families come from the side colour,')
  p('so some names land elsewhere: `pink_terracotta` is a dusty red, `light_blue_terracotta` a grey lavender. Functional')
  p('blocks, ores, and technical blocks are listed separately further down.')
  for (const [k, title] of FAMILIES) {
    p()
    p(`### ${title}`)
    p()
    p(blockTable(byFamily[k]))
  }

  // Ladders.
  const fam = (...f) => (r) => f.includes(r.fam)
  const STONE = /^(stone|cobblestone|andesite|diorite|granite|tuff|deepslate|cobbled_deepslate|blackstone|basalt|smooth_basalt|calcite|gravel|smooth_stone|mossy_cobblestone|dripstone_block|obsidian|mud|packed_mud|clay|bone_block|snow_block)$/
  const REFINED = /^(polished_|smooth_|cut_|chiseled_|quartz|deepslate_(bricks|tiles)|stone_bricks|tuff_bricks|mud_bricks|end_stone_bricks|purpur|calcite|white_concrete|light_gray_concrete|gray_concrete)/
  const NETHER = /^(netherrack|nether_bricks|red_nether_bricks|chiseled_nether_bricks|cracked_nether_bricks|nether_wart_block|warped_wart_block|crimson_|warped_|stripped_crimson|stripped_warped|blackstone|polished_blackstone|chiseled_polished_blackstone|cracked_polished_blackstone|gilded_blackstone|basalt|polished_basalt|smooth_basalt|soul_sand|soul_soil|quartz|smooth_quartz|chiseled_quartz|ancient_debris|netherite_block|obsidian|magma_block)/
  const END = /^(end_stone|end_stone_bricks|purpur_block|purpur_pillar|obsidian|amethyst_block|purple_|magenta_|blue_terracotta|light_blue_terracotta)/
  const LADDERS = [
    { title: 'Neutral value ramp: white to black (any neutral block)', from: 'snow_block', to: 'black_concrete', pool: fam('neutral'), steps: [6, 10] },
    { title: 'Natural stone ramp: calcite to blackstone', from: 'calcite', to: 'blackstone', pool: (r) => STONE.test(r.n), steps: [5, 9], corridor: 18 },
    { title: 'Refined masonry: deepslate tiles to quartz', from: 'deepslate_tiles', to: 'quartz_block', pool: (r) => REFINED.test(r.n) && r.C < 14, steps: [5, 9] },
    { title: 'Sand to dark wood', from: 'sand', to: 'dark_oak_planks', pool: fam('yellow', 'brown', 'orange'), steps: [6, 10] },
    { title: 'Grass green to moss to dark', from: 'lime_wool', via: ['moss_block'], to: 'dried_kelp_block', pool: (r) => ['green', 'yellow', 'brown'].includes(r.fam) || (r.fam === 'neutral' && r.h > 90 && r.h < 200), steps: [6, 9], corridor: 20 },
    { title: 'Warm red brick ramp', from: 'white_terracotta', via: ['bricks'], to: 'nether_bricks', pool: (r) => r.C >= 12 && (r.h < 62 || r.h > 340), steps: [6, 10], corridor: 20 },
    { title: 'Cool blue ramp: snow to deep blue', from: 'snow_block', via: ['light_blue_concrete'], to: 'blue_concrete', pool: (r) => ['blue', 'teal'].includes(r.fam) || (r.fam === 'neutral' && r.h > 180 && r.h < 300), steps: [6, 9], corridor: 25 },
    { title: 'Nether ramp: crimson to nether brick', from: 'stripped_crimson_stem', to: 'nether_bricks', pool: (r) => NETHER.test(r.n), steps: [4, 7], corridor: 25 },
    { title: 'Nether stone ramp: basalt to blackstone', from: 'polished_basalt', to: 'polished_blackstone_bricks', pool: (r) => NETHER.test(r.n), steps: [3, 6], corridor: 15 },
    { title: 'End ramp: end stone to purpur to obsidian (a high-contrast set by nature)', from: 'end_stone', via: ['purpur_block'], to: 'obsidian', pool: (r) => END.test(r.n) || r.fam === 'neutral', steps: [6, 10], corridor: 25 },
  ]
  p()
  p('## Gradient ladders')
  p()
  p('Computed from the data: candidates are plain full opaque blocks (no glazed terracotta, ores, functional or')
  p('technical blocks, light sources, or live coral), ordered along the straight line between the two endpoints in')
  p('CIELAB, and the chain with the most even CIEDE2000 steps is chosen. Steps are side colours; ΔE00 between')
  p('neighbours is listed. Use them for walls fading upward, roof shading, terrain transitions, or weathering.')
  for (const spec of LADDERS) {
    const r = findLadder(spec, pool.filter(spec.pool))
    p()
    p(`### ${spec.title}`)
    p()
    if (!r) {
      p('No chain found.')
      continue
    }
    p(ladderTable(r.chain))
    p()
    p(`Chain: ${r.chain.map((c) => code(c.n)).join(' → ')} (ΔE00 steps ${r.min.toFixed(1)} to ${r.max.toFixed(1)}).`)
    const gaps = r.steps.map((v, i) => ({ v, a: r.chain[i].n, b: r.chain[i + 1].n })).filter((g) => g.v > 12)
    if (gaps.length) {
      const list = gaps.map((g) => `${code(g.a)} → ${code(g.b)} (${g.v.toFixed(1)})`).join(', ')
      p(`No full opaque block fills ${gaps.length === 1 ? 'the gap' : 'these gaps'} ${list}; dither ${gaps.length === 1 ? 'the two blocks' : 'each pair'} or change material there.`)
    }
  }

  // Fixed sequences.
  const seq = (names) => names.map((n) => ({ n, e: blocks[`minecraft:${n}`] }))
  p()
  p('### Copper oxidation (fixed sequence)')
  p()
  p(ladderTable(seq(['copper_block', 'exposed_copper', 'weathered_copper', 'oxidized_copper'])))
  p()
  p('Cut copper runs the same way: ' + seq(['cut_copper', 'exposed_cut_copper', 'weathered_cut_copper', 'oxidized_cut_copper']).map((c) => `${code(c.n)} ${code(c.e.side)}`).join(' → ') + '.')
  p('The big jump is exposed → weathered (brown to green); bridge it with a mixed band of both.')
  p()
  p('### Wood tones, light to dark')
  p()
  const planks = all.filter((id) => /_planks$/.test(id)).map((id) => ({ n: short(id), e: blocks[id] })).sort((a, b) => b.e.lab[0] - a.e.lab[0])
  p('| planks | colour | L* | log bark | stripped log |')
  p('|---|---|---|---|---|')
  for (const { n, e } of planks) {
    const wood = n.replace(/_planks$/, '')
    const bark = blocks[`minecraft:${wood}_log`] ?? blocks[`minecraft:${wood}_stem`] ?? blocks[`minecraft:${wood}_block`]
    const stripped = blocks[`minecraft:stripped_${wood}_log`] ?? blocks[`minecraft:stripped_${wood}_stem`] ?? blocks[`minecraft:stripped_${wood}_block`]
    p(`| ${code(n)} | ${code(e.side)} | ${fmtL(e)} | ${bark ? code(bark.side) : ''} | ${stripped ? code(stripped.side) : ''} |`)
  }

  // Flat vs textured.
  const plain = mainRows.filter(({ n }) => !isGlazed(n))
  const flat = [...plain].sort((a, b) => a.e.noise - b.e.noise).filter((r) => r.e.noise < 0.03)
  const range = (rows) => `${Math.min(...rows.map((r) => r.e.noise)).toFixed(3)} to ${Math.max(...rows.map((r) => r.e.noise)).toFixed(3)}`
  const concretes = flat.filter((r) => /_concrete$/.test(r.n))
  const terracottas = flat.filter((r) => /(^|_)terracotta$/.test(r.n))
  const otherFlat = flat.filter((r) => !concretes.includes(r) && !terracottas.includes(r))
  const busy = [...plain].sort((a, b) => b.e.noise - a.e.noise).filter((r) => r.e.noise >= 0.1)
  p()
  p('## Flat vs. textured blocks')
  p()
  p(`**Flat (busyness < 0.03, ${flat.length} looks)**: read as smooth, modern or plastic; good for large calm surfaces, signage, and`)
  p(`pixel art. All ${concretes.length} \`*_concrete\` (${range(concretes)}), all ${terracottas.length} terracottas including plain \`terracotta\``)
  p(`(${range(terracottas)}), and ` + otherFlat.map((r) => `${code(r.n)} ${r.e.noise.toFixed(3)}`).join(', ') + '.')
  p()
  p(`**Textured (busyness ≥ 0.10, ${busy.length} looks)**: strong pattern or contrast; good for rubble, rustic or aged surfaces and`)
  p('small accents, noisy on large flat walls. ' + busy.map((r) => `${code(r.n)} ${r.e.noise.toFixed(3)}`).join(', ') + '.')
  p()
  p('Glazed terracotta (busyness 0.07 to 0.23) is patterned rather than noisy and forms motifs when rotated.')

  // Dye sets.
  const DYES = ['white', 'light_gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'light_blue', 'blue', 'purple', 'magenta', 'pink']
  const cell = (id) => (blocks[id] ? `${code(blocks[id].side)} ${fmtL(blocks[id])}` : '')
  p()
  p('## Dye colour sets')
  p()
  p('Side colour and L* of the 16 dyed block families. Concrete is the most saturated and flattest, wool and concrete')
  p('powder are slightly lighter and softer, terracotta is muted and earthy; stained glass is translucent (colour of the')
  p('opaque pixels).')
  p()
  p('| dye | concrete | concrete_powder | wool | terracotta | stained_glass |')
  p('|---|---|---|---|---|---|')
  for (const d of DYES) {
    p(`| ${d} | ${cell(`minecraft:${d}_concrete`)} | ${cell(`minecraft:${d}_concrete_powder`)} | ${cell(`minecraft:${d}_wool`)} | ${cell(`minecraft:${d}_terracotta`)} | ${cell(`minecraft:${d}_stained_glass`)} |`)
  }
  p()
  p(`Plain \`terracotta\` is ${code(blocks['minecraft:terracotta'].side)} (L* ${fmtL(blocks['minecraft:terracotta'])}).`)

  // Translucent cubes.
  const clearIds = all.filter((id) => shapeInfo[id]?.cube && !blocks[id].full && blocks[id].transparent && !blocks[id].approx && !isAlias(short(id)))
  p()
  p('## Translucent and cutout cubes')
  p()
  p('Full-size cubes you can see through. The colour is the average of the visible (non-transparent) pixels; in a build')
  p('the background shows through, so their apparent colour shifts toward whatever is behind them. `opacity` is the')
  p('fraction of the face covered by non-transparent pixels.')
  p()
  p('| block | colour | L* | opacity | notes |')
  p('|---|---|---|---|---|')
  for (const id of clearIds.sort((a, b) => blocks[b].lab[0] - blocks[a].lab[0])) {
    const e = blocks[id]
    const notes = [transparentSet.has(id) ? 'drawn translucent' : 'cutout (hard holes)', e.tinted ? 'tinted by renderer' : ''].filter(Boolean).join('; ')
    p(`| ${code(short(id))} | ${code(e.side)} | ${fmtL(e)} | ${(e.cover * 100).toFixed(0)}% | ${notes} |`)
  }

  // Functional / feature blocks.
  const featureRows = groupRows(fullIds.filter((id) => FEATURE.has(short(id)))).sort((a, b) => b.e.lab[0] - a.e.lab[0])
  p()
  p('## Functional and feature blocks')
  p()
  p('Full cubes with a distinct front or detailed faces; `side` is the plain side, the front differs. Use sparingly as')
  p('detail, not as wall fill.')
  p()
  p(blockTable(featureRows))

  // Excluded.
  const ores = fullIds.map(short).filter(isOre)
  const tech = fullIds.map(short).filter((n) => TECHNICAL.has(n))
  p()
  p('## Left out of the tables above (still in the JSON)')
  p()
  p(`- Technical blocks: ${tech.map(code).join(', ')}.`)
  p(`- Ores: ${ores.map((n) => `${code(n)} ${code(blocks[`minecraft:${n}`].side)}`).join(', ')}.`)
  p('- Look-alike aliases: `infested_*`, `waxed_*`, `suspicious_sand`, `suspicious_gravel`.')
  p('- Non-cube blocks (stairs, slabs, plants, rails, redstone parts, entity-drawn blocks such as beds, chests, banners,')
  p('  signs, heads, shulker boxes, and liquids). Their colours are in the JSON; entity-drawn ones are marked `approx`.')
  p()
  return out.join('\n')
}

// ---------------------------------------------------------------------------------------------
// Output.
// ---------------------------------------------------------------------------------------------

function serializeJson(map) {
  const lines = Object.entries(map).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
  return `{\n${lines.join(',\n')}\n}\n`
}

const json = serializeJson(blocks)
const md = renderMarkdown()

if (CHECK) {
  const stale = [[OUT_JSON, json], [OUT_MD, md]].filter(([f, c]) => !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== c)
  if (stale.length) {
    console.error(`stale: ${stale.map(([f]) => path.relative(ROOT, f)).join(', ')} (run node scripts/dev/gen-block-colors.mjs)`)
    process.exit(1)
  }
  console.log('block colors up to date')
} else {
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true })
  fs.writeFileSync(OUT_JSON, json)
  fs.writeFileSync(OUT_MD, md)
  const full = Object.values(blocks).filter((b) => b.full).length
  console.log(`wrote ${path.relative(ROOT, OUT_JSON)} (${Object.keys(blocks).length} blocks, ${full} full opaque cubes)`)
  console.log(`wrote ${path.relative(ROOT, OUT_MD)}`)
  if (skipped.length) console.log(`skipped (no drawable texture): ${skipped.join(', ')}`)
  console.log(`approximated (entity-rendered / liquid / particle-only): ${approximated.length}`)
}

