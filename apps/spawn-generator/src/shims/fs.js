// node:fs for the browser bundle: the generator only reads its data files (block states, colours,
// materials, the pack's block list). The page hands them to the worker as a path → text map
// (globalThis.__MCB_FILES), keyed by the file's path inside the plugin, e.g.
// /scripts/lib/data/block-states.json.

const table = () => globalThis.__MCB_FILES ?? {}

function keyOf(p) {
  if (p instanceof URL) return decodeURIComponent(p.pathname)
  const s = String(p)
  if (s.startsWith('file:')) return decodeURIComponent(new URL(s).pathname)
  return s.replace(/\/+/g, '/')
}

function missing(k) {
  const err = new Error(`ENOENT: no such file or directory, open '${k}'`)
  err.code = 'ENOENT'
  return err
}

export function readFileSync(p, options) {
  const k = keyOf(p)
  const value = table()[k]
  if (value === undefined) throw missing(k)
  const encoding = typeof options === 'string' ? options : options?.encoding
  if (encoding) return typeof value === 'string' ? value : new TextDecoder().decode(value)
  return typeof value === 'string' ? new TextEncoder().encode(value) : value
}

export function existsSync(p) {
  return keyOf(p) in table()
}

export function writeFileSync() {
  throw new Error('fs.writeFileSync is not available in the browser')
}

export const promises = {}
export default { readFileSync, existsSync, writeFileSync, promises }
