import assert from 'node:assert/strict'
import test from 'node:test'
import { filesFromTransfer, localImageError, maxImageSizeBytes, saveImageBatch, uploadError, uploadSummary } from '../app/utils/image-upload.ts'
import { maxImageSizeBytes as serverLimit } from '../server/image-url.ts'

const file = (name: string, type = 'image/png', size = 64) => ({ name, type, size })

test('a mixed batch saves sequentially, keeps partial successes, and classifies failures', async () => {
  const files = [file('first.png'), file('duplicate.png'), file('unsupported.svg', 'image/svg+xml'),
    file('large.png', 'image/png', maxImageSizeBytes + 1), file('empty.png', 'image/png', 0), file('network.png'), file('last.png')]
  const requested: string[] = []
  const progress: number[] = []
  let active = 0
  const result = await saveImageBatch(files, async (image) => {
    assert.equal(active++, 0, 'requests must never overlap')
    requested.push(image.name)
    await new Promise((resolve) => setTimeout(resolve, 1))
    active -= 1
    if (image.name === 'network.png') throw { statusCode: 503 }
    return image.name === 'duplicate.png' ? 'duplicate' : 'saved'
  }, (current, total) => { assert.equal(total, 7); progress.push(current) })
  assert.deepEqual(requested, ['first.png', 'duplicate.png', 'network.png', 'last.png'])
  assert.deepEqual(progress, [1, 2, 3, 4, 5, 6, 7])
  assert.equal(result.saved, 2)
  assert.equal(result.duplicates, 1)
  assert.deepEqual(result.failures.map((failure) => failure.retryable), [false, false, false, true])
})

test('retrying recoverable failures preserves aggregate counts and permanent failures', async () => {
  const initial = await saveImageBatch([file('saved.png'), file('duplicate.png'), file('bad.txt', 'text/plain'), file('retry.png')], async (image) => {
    if (image.name === 'retry.png') throw new Error('offline')
    return image.name === 'duplicate.png' ? 'duplicate' : 'saved'
  }, () => {})
  const retryFiles = initial.failures.filter((failure) => failure.retryable).map((failure) => failure.file)
  const stillFailed = await saveImageBatch(retryFiles, async () => { throw { statusCode: 429 } }, () => {}, initial)
  assert.equal(stillFailed.failures.length, 2)
  const retried = await saveImageBatch(retryFiles, async () => 'saved', () => {}, stillFailed)
  assert.equal(retried.saved, 2)
  assert.equal(retried.duplicates, 1)
  assert.deepEqual(retried.failures.map((failure) => failure.file.name), ['bad.txt'])
  assert.equal(initial.failures.length, 2, 'previous results are not mutated')
})

test('validation shares the server limit and accepts extension-only files without losing invalid entries', () => {
  assert.equal(maxImageSizeBytes, serverLimit)
  assert.equal(localImageError(file('scan.JPG', '', maxImageSizeBytes)), null)
  assert.match(localImageError(file('scan.png', 'image/png', maxImageSizeBytes + 1))!, /15 MB/)
  assert.match(localImageError(file('scan.png', 'image/png', 0))!, /empty/)
  for (const status of [400, 403, 404, 413, 415]) assert.equal(uploadError({ data: { statusCode: status } }).retryable, false)
  for (const status of [408, 429, 500, 503]) assert.equal(uploadError({ status }).retryable, true)
  assert.equal(uploadError(null).retryable, true)
})

test('drop transfer uses one representation without merging distinct same-name files', () => {
  const first = new File(['first'], 'same.png', { type: 'image/png' })
  const second = new File(['second'], 'same.png', { type: 'image/png' })
  const files = [first, second]
  const items = files.map((image) => ({ kind: 'file', getAsFile: () => image }))
  const transfer = { files, items } as unknown as DataTransfer
  assert.deepEqual(filesFromTransfer(transfer), files)
  assert.deepEqual(filesFromTransfer({ files: [], items } as unknown as DataTransfer), files)
  assert.deepEqual(filesFromTransfer(null), [])
})

test('summaries omit zero counts and keep successful and duplicate-only results neutral', () => {
  assert.equal(uploadSummary({ saved: 2, duplicates: 1, failures: [] }), '2 saved · 1 already saved')
  assert.equal(uploadSummary({ saved: 0, duplicates: 2, failures: [] }), '2 already saved')
  assert.equal(uploadSummary({ saved: 0, duplicates: 0, failures: [{ file: new File([], 'empty.png'), message: 'Empty', retryable: false }] }), '1 failed')
})
