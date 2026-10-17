import { fork, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'

let worker: ChildProcess | null = null
let rerun = false
let pausedUntil = 0
let unavailable = false
let stopped = false
export const similarityUnavailable = () => unavailable

export function prepareSimilarity(reference = '', retry = false) {
  if (stopped) return
  if (retry) { pausedUntil = 0; unavailable = false }
  if (worker) {
    rerun = true
    if (reference && worker.connected) worker.send({ reference }, () => {})
    return
  }
  if (Date.now() < pausedUntil) return
  unavailable = false
  const child = fork(join(process.cwd(), 'runtime/similarity/worker.mjs'), [
    '--data', join(process.cwd(), 'data'), '--reference', reference,
  ], { execArgv: ['--max-old-space-size=384'], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
  worker = child
  // Keep native errors/paths out of HTTP responses, while retaining useful server diagnostics.
  child.stderr?.on('data', () => {})
  child.on('message', (message: { error?: string }) => {
    if (message.error) { unavailable = true; console.warn('[similarity] Visual model unavailable; retry from the gallery.') }
  })
  child.on('error', () => { unavailable = true })
  child.on('exit', code => {
    if (worker !== child) return
    worker = null
    if (code !== 0) {
      unavailable = true
      pausedUntil = Date.now() + 60_000
      if (!stopped) console.warn('[similarity] Background preparation stopped. Retry from the gallery.')
    }
    const again = rerun && !unavailable
    rerun = false
    if (again && !stopped) prepareSimilarity()
  })
}

export function stopSimilarityPreparation() {
  stopped = true
  worker?.kill('SIGTERM')
}
