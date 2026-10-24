import { fork, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { semanticPolicy, normalizedVector, semanticModelFiles } from '../runtime/similarity/semantic-features.mjs'
import { semanticProgress, resetFailedSemanticVectors } from './semantic-store.ts'
const root = join(process.cwd(), 'data/semantic')
const modelPath = join(root, 'models', semanticPolicy.model, semanticPolicy.revision)
export const semanticEnabled = () => existsSync(join(root, 'enabled'))
export const semanticModelsReady = () => semanticModelFiles.every(file => existsSync(join(modelPath, file)))
let child: ChildProcess | null = null, sequence = 0, stopped = false, preparing = false, rerun = false, pausedUntil = 0
let idle: ReturnType<typeof setTimeout> | undefined
const requests = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()
const textCache = new Map<string, number[]>()
const textPending = new Map<string, Promise<number[]>>()
export const semanticPreparing = () => preparing
export const semanticUnavailable = () => Date.now() < pausedUntil
function unavailable() { return new Error('Content search is unavailable. Try again.') }
function rejectRequests() {
  for (const entry of requests.values()) { clearTimeout(entry.timer); entry.reject(unavailable()) }
  requests.clear()
}
function scheduleIdle(worker: ChildProcess) {
  if (idle) clearTimeout(idle)
  if (requests.size) return
  idle = setTimeout(() => {
    if (child === worker && !requests.size) { child = null; worker.kill('SIGTERM') }
  }, 60_000)
  idle.unref()
}
function start() {
  if (child) return child
  const worker = fork(join(process.cwd(), 'runtime/similarity/semantic-worker.mjs'), ['--data', join(process.cwd(), 'data')], {
    execArgv: ['--max-old-space-size=384'], stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  })
  child = worker
  worker.stderr?.on('data', () => {})
  worker.on('message', (message: { id?: number; error?: string; vector?: number[]; prepared?: boolean }) => {
    if (typeof message.id !== 'number') return
    const entry = requests.get(message.id)
    if (!entry) return
    clearTimeout(entry.timer); requests.delete(message.id)
    if (message.error) { pausedUntil = Date.now() + 60_000; entry.reject(unavailable()) }
    else entry.resolve(message)
    scheduleIdle(worker)
  })
  worker.on('error', () => { pausedUntil = Date.now() + 60_000; rejectRequests() })
  worker.on('exit', code => {
    if (child !== worker) return
    child = null
    if (code !== 0 || requests.size) { pausedUntil = Date.now() + 60_000; rejectRequests() }
  })
  return worker
}
function request(type: 'prepare' | 'query', text?: string): Promise<{ vector?: number[]; prepared?: boolean }> {
  if (stopped || semanticUnavailable() || requests.size >= 4) return Promise.reject(unavailable())
  if (idle) clearTimeout(idle)
  const worker = start(), id = ++sequence
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pausedUntil = Date.now() + 60_000; rejectRequests(); worker.kill('SIGTERM')
    }, type === 'prepare' ? 20 * 60_000 : 30_000)
    requests.set(id, { resolve, reject, timer })
    worker.send({ id, type, text }, error => {
      if (!error) return
      const entry = requests.get(id)
      if (entry) { clearTimeout(entry.timer); requests.delete(id); entry.reject(unavailable()) }
    })
  })
}
export async function activateSemanticSearch() {
  await mkdir(root, { recursive: true }); await writeFile(join(root, 'enabled'), '1')
  await resetFailedSemanticVectors()
  pausedUntil = 0
  void prepareSemanticSearch()
}
export async function prepareSemanticSearch() {
  if (stopped || !semanticEnabled() || semanticUnavailable()) return
  if (preparing) { rerun = true; return }
  preparing = true
  try {
    const progress = await semanticProgress()
    if (!progress.totalCount || (!progress.pendingCount && semanticModelsReady())) return
    await request('prepare')
  } catch {
    pausedUntil = Date.now() + 60_000
    if (!stopped) console.warn('[content-search] Preparation unavailable. Retry from Library.')
  } finally {
    preparing = false
    const again = rerun; rerun = false
    if (again && !stopped && !semanticUnavailable()) void prepareSemanticSearch()
  }
}
export async function semanticTextVector(text: string) {
  if (stopped || !semanticEnabled() || semanticUnavailable()) throw unavailable()
  const cached = textCache.get(text)
  if (cached) return cached
  const existing = textPending.get(text)
  if (existing) return existing
  const pending = request('query', text).then(message => {
    const vector = normalizedVector(message.vector)
    if (textCache.size >= 32) textCache.delete(textCache.keys().next().value!)
    textCache.set(text, vector)
    return vector
  })
  textPending.set(text, pending)
  try { return await pending } finally { textPending.delete(text) }
}
export function stopSemanticPreparation() {
  stopped = true; if (idle) clearTimeout(idle); rejectRequests(); child?.kill('SIGTERM')
  textCache.clear(); textPending.clear()
}
