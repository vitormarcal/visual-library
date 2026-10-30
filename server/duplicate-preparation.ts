import { fork, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ensureDataStore } from './db.ts'
import { duplicateFingerprint } from '../runtime/similarity/duplicate-features.mjs'
const root = join(process.cwd(), 'data/duplicates')
let child: ChildProcess | null = null, stopped = false, pausedUntil = 0
export const duplicatesEnabled = () => existsSync(join(root, 'enabled'))
export const duplicatesPreparing = () => Boolean(child)
export const duplicatesUnavailable = () => Date.now() < pausedUntil
export async function duplicateProgress() {
  const db = await ensureDataStore()
  const row = db.prepare(`SELECT count(*) AS totalCount,
    sum(CASE WHEN v.status='ready' THEN 1 ELSE 0 END) AS preparedCount,
    sum(CASE WHEN v.status='failed' THEN 1 ELSE 0 END) AS failedCount FROM images i
    LEFT JOIN image_duplicate_vectors v ON v.image_id=i.id AND v.fingerprint=? AND v.source_hash IS i.content_hash
    WHERE i.hidden_from_gallery=0`).get(duplicateFingerprint) as { totalCount: number; preparedCount: number | null; failedCount: number | null }
  const preparedCount = row.preparedCount ?? 0, failedCount = row.failedCount ?? 0
  return { totalCount: row.totalCount, preparedCount, failedCount, pendingCount: row.totalCount - preparedCount - failedCount }
}
export async function prepareDuplicates() {
  if (stopped || child || !duplicatesEnabled() || duplicatesUnavailable()) return
  const progress = await duplicateProgress()
  if (stopped || child || !progress.pendingCount) return
  const worker = fork(join(process.cwd(), 'runtime/similarity/duplicate-worker.mjs'), ['--data', join(process.cwd(), 'data')], {
    execArgv: ['--max-old-space-size=384'], stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  })
  child = worker
  const timeout = setTimeout(() => { pausedUntil = Date.now() + 60_000; worker.kill('SIGTERM') }, 20 * 60_000)
  timeout.unref()
  worker.on('error', () => { pausedUntil = Date.now() + 60_000 })
  worker.on('exit', code => {
    clearTimeout(timeout)
    if (child !== worker) return
    child = null
    if (code !== 0) pausedUntil = Date.now() + 60_000
    else if (!stopped) void prepareDuplicates()
  })
}
export async function activateDuplicates() {
  await mkdir(root, { recursive: true }); await writeFile(join(root, 'enabled'), '1')
  if (!child) {
    const db = await ensureDataStore()
    db.prepare("DELETE FROM image_duplicate_vectors WHERE status='failed' OR fingerprint<>?").run(duplicateFingerprint)
    pausedUntil = 0
  }
  await prepareDuplicates()
}
export function stopDuplicatePreparation() { stopped = true; child?.kill('SIGTERM') }
