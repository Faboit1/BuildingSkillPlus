// node:url for the browser bundle. The build gives every module a file:///<path in the plugin>
// import.meta.url, so these turn it into the paths the fs shim knows.

export const fileURLToPath = u => decodeURIComponent((u instanceof URL ? u : new URL(String(u))).pathname)
export const pathToFileURL = p => new URL(`file://${String(p).startsWith('/') ? '' : '/'}${p}`)
const URLClass = globalThis.URL
export { URLClass as URL }
export default { fileURLToPath, pathToFileURL, URL: URLClass }
