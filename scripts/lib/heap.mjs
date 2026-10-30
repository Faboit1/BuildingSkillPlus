// Big builds need more memory than Node gives a script by default (2-4 GB, whatever the machine
// has), and running out shows as "JavaScript heap out of memory". The heavy scripts call
// ensureHeap() first: without an explicit --max-old-space-size it runs the same script again, once,
// with three quarters of the machine's memory (at most 24 GB), and exits with its exit code.

import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import v8 from 'node:v8'

// the heap to ask for, in MB: 3/4 of the machine's memory, but no more than what is free now
// (other builds may be running: a heap the machine cannot give gets the process killed, silently),
// at least 2 GB, at most 24 GB
export function heapTargetMb() {
  const total = Math.floor(os.totalmem() / 2 ** 20)
  const free = Math.floor(os.freemem() / 2 ** 20)
  return Math.max(2048, Math.min(24576, Math.floor(total * 0.75), Math.floor(free * 0.85)))
}

export function ensureHeap() {
  if (process.env.MC_HEAP_SET) return
  if (process.execArgv.some(a => a.startsWith('--max-old-space-size')) || /--max-old-space-size/.test(process.env.NODE_OPTIONS ?? '')) return
  const target = heapTargetMb()
  const limit = v8.getHeapStatistics().heap_size_limit / 2 ** 20
  if (limit >= target * 0.9) return
  const r = spawnSync(process.execPath, [`--max-old-space-size=${target}`, ...process.execArgv, process.argv[1], ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, MC_HEAP_SET: '1' },
  })
  if (r.error) return // could not relaunch: carry on with the default heap
  if (r.signal) {
    console.error(`${path.basename(process.argv[1])}: killed by ${r.signal} (out of memory? ${target} MB heap asked, ${Math.floor(os.freemem() / 2 ** 20)} MB free now): close other big jobs, or give it --max-old-space-size explicitly`)
    process.exit(1)
  }
  process.exit(r.status ?? 1)
}
