#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'
import { startViewerServer } from './lib/viewer-server.mjs'

function usage() {
  return `Usage:
  node scripts/preview.mjs --nbt <path/to/build.nbt> [--host 127.0.0.1] [--port 5173] [--lighting day|night] [--open|--no-open]
`
}

function parseArgs(argv) {
  const options = {
    nbt: undefined,
    host: '127.0.0.1',
    port: 5173,
    lighting: 'day',
    open: true,
    help: false,
  }
  const readValue = (arg, index) => {
    const value = argv[index + 1]
    if (!value || value.startsWith('-')) throw new Error(`${arg} requires a value`)
    return value
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '-h' || arg === '--help') {
      options.help = true
    } else if (arg === '--nbt') {
      options.nbt = readValue(arg, index)
      index += 1
    } else if (arg.startsWith('--nbt=')) {
      options.nbt = arg.slice('--nbt='.length)
    } else if (arg === '--host') {
      options.host = readValue(arg, index)
      index += 1
    } else if (arg.startsWith('--host=')) {
      options.host = arg.slice('--host='.length)
    } else if (arg === '--port') {
      options.port = Number(readValue(arg, index))
      index += 1
    } else if (arg.startsWith('--port=')) {
      options.port = Number(arg.slice('--port='.length))
    } else if (arg === '--lighting') {
      options.lighting = readValue(arg, index)
      index += 1
    } else if (arg.startsWith('--lighting=')) {
      options.lighting = arg.slice('--lighting='.length)
    } else if (arg === '--open') {
      options.open = true
    } else if (arg === '--no-open') {
      options.open = false
    } else if (!options.nbt) {
      options.nbt = arg
    } else {
      throw new Error(`Unexpected argument: ${arg}`)
    }
  }
  if (!Number.isInteger(options.port) || options.port < 0) {
    throw new Error('--port must be a non-negative integer')
  }
  if (!['day', 'night'].includes(options.lighting)) {
    throw new Error('--lighting must be day or night')
  }
  return options
}

async function openUrl(url) {
  const command = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'cmd'
      : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  const child = spawn(command, args, {
    stdio: 'ignore',
    detached: true,
  })
  child.on('error', () => undefined)
  child.unref()
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  if (!options.nbt) {
    throw new Error(`Missing --nbt path.\n${usage()}`)
  }

  const nbtPath = path.resolve(options.nbt)
  const { server, url } = await startViewerServer({ nbtPath, host: options.host, port: options.port })
  if (options.lighting !== 'day') {
    url.searchParams.set('lighting', options.lighting)
  }

  console.log(`Minecraft build preview: ${url.toString()}`)
  if (options.open) {
    await openUrl(url.toString())
  }

  let closing = false
  const close = async () => {
    if (closing) return
    closing = true
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', close)
  process.on('SIGTERM', close)
}

main().catch(err => {
  console.error(`preview: ${err.message}`)
  process.exitCode = 1
})
