// node:path (posix) for the browser bundle: the few calls the generator makes on its data paths.

export const sep = '/'

export function normalize(p) {
  const abs = p.startsWith('/')
  const out = []
  for (const part of p.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop()
      else if (!abs) out.push('..')
    } else out.push(part)
  }
  const s = (abs ? '/' : '') + out.join('/')
  return s || (abs ? '/' : '.')
}

export const join = (...parts) => normalize(parts.filter(Boolean).join('/'))
export const resolve = (...parts) => {
  let s = ''
  for (const p of parts) s = p.startsWith('/') ? p : `${s}/${p}`
  return normalize(s.startsWith('/') ? s : `/${s}`)
}
export function dirname(p) {
  const s = normalize(p)
  const i = s.lastIndexOf('/')
  return i <= 0 ? (s.startsWith('/') ? '/' : '.') : s.slice(0, i)
}
export function basename(p, ext) {
  const b = normalize(p).split('/').pop() ?? ''
  return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b
}
export function extname(p) {
  const b = basename(p)
  const i = b.lastIndexOf('.')
  return i <= 0 ? '' : b.slice(i)
}
export function relative(from, to) {
  const a = resolve(from).split('/').filter(Boolean)
  const b = resolve(to).split('/').filter(Boolean)
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/')
}
export const posix = { sep, normalize, join, resolve, dirname, basename, extname, relative }
export default posix
