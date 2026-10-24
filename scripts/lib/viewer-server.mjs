import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const libDir = path.dirname(fileURLToPath(import.meta.url))
export const skillRoot = path.resolve(libDir, '..', '..')
const viewerRoot = path.join(skillRoot, 'assets', 'viewer')

function contentType(filePath) {
  if (filePath.endsWith('.json')) return 'application/json'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.txt')) return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

export async function resolveLodestoneRoot() {
  const indexUrl = await import.meta.resolve('@mattzh72/lodestone')
  const indexPath = fileURLToPath(indexUrl)
  return path.resolve(path.dirname(indexPath), '..')
}

function serveFile(response, filePath) {
  response.statusCode = 200
  response.setHeader('Content-Type', contentType(filePath))
  const stream = createReadStream(filePath)
  stream.on('error', error => {
    if (!response.headersSent) {
      response.statusCode = 500
      response.end('Failed to read file')
    } else {
      response.destroy(error)
    }
  })
  stream.pipe(response)
}

function createPreviewMiddlewarePlugin(nbtPath, defaultPackRoot) {
  return {
    name: 'minecraft-builder-preview-middleware',
    configureServer(server) {
      server.middlewares.use('/__minecraft_builder__/build.nbt', (_request, response) => {
        serveFile(response, nbtPath)
      })

      server.middlewares.use('/__minecraft_builder__/default-pack/', async (request, response) => {
        try {
          const requestUrl = new URL(request.url ?? '/', 'http://localhost')
          const relativePath = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, ''))
          const filePath = path.resolve(defaultPackRoot, relativePath)
          const allowedRoot = `${defaultPackRoot}${path.sep}`
          if (filePath !== defaultPackRoot && !filePath.startsWith(allowedRoot)) {
            response.statusCode = 403
            response.end('Forbidden')
            return
          }
          await fs.access(filePath)
          serveFile(response, filePath)
        } catch {
          response.statusCode = 404
          response.end('Not found')
        }
      })
    },
  }
}

// Starts the Vite viewer serving one .nbt file. Returns the server and the base viewer URL.
export async function startViewerServer({ nbtPath, host = '127.0.0.1', port = 5173, logLevel } = {}) {
  await fs.access(nbtPath)
  const lodestoneRoot = await resolveLodestoneRoot()
  const defaultPackRoot = path.join(lodestoneRoot, 'assets', 'default-pack')

  const server = await createServer({
    root: viewerRoot,
    appType: 'spa',
    clearScreen: false,
    logLevel,
    plugins: [createPreviewMiddlewarePlugin(nbtPath, defaultPackRoot)],
    server: {
      host,
      port,
      strictPort: false,
      open: false,
      fs: {
        strict: false,
      },
    },
  })

  await server.listen()
  const local = server.resolvedUrls?.local?.[0] ?? `http://${host}:${port}/`
  const url = new URL(local)
  url.searchParams.set('nbt', '/__minecraft_builder__/build.nbt')
  url.searchParams.set('name', path.basename(nbtPath))
  return { server, url }
}
