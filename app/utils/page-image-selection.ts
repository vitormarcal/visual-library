import { uploadError, type UploadResult } from './image-upload.ts'
export type PageCandidate = { id: string; url: string; width: number | null; height: number | null }
export type PageDiscovery = { pageUrl: string; candidates: PageCandidate[]; fallback: boolean }
export async function savePageImageBatch(
  items: PageCandidate[], save: (item: PageCandidate) => Promise<'saved' | 'duplicate'>,
  progress: (current: number, total: number) => void, complete: (item: PageCandidate) => void,
  previous?: UploadResult<PageCandidate>,
): Promise<UploadResult<PageCandidate>> {
  const result = { saved: previous?.saved ?? 0, duplicates: previous?.duplicates ?? 0,
    failures: previous?.failures.filter(f => !f.retryable) ?? [] }
  for (const [index, item] of items.entries()) {
    progress(index + 1, items.length)
    try {
      if (await save(item) === 'duplicate') result.duplicates++
      else result.saved++
      complete(item)
    } catch (error) { result.failures.push({ file: item, ...uploadError(error) }) }
  }
  return result
}

// A selection shares two download slots. Aborted cards never start queued work.
export function createPreviewQueue(limit = 2) {
  let active = 0
  const waiting: (() => void)[] = []
  return async function run<T>(signal: AbortSignal, task: () => Promise<T>): Promise<T> {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (active >= limit) await new Promise<void>((resolve, reject) => {
      const start = () => { signal.removeEventListener('abort', abort); resolve() }
      const abort = () => { const index = waiting.indexOf(start); if (index >= 0) waiting.splice(index, 1); reject(new DOMException('Aborted', 'AbortError')) }
      waiting.push(start); signal.addEventListener('abort', abort, { once: true })
    })
    // A released slot is reserved for the oldest waiter before new work enters.
    else active++
    try {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      return await task()
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }
}
