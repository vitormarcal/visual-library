import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { colorFeatures, meanPatchEmbedding, visualSimilarity, validDescriptor } from '../runtime/similarity/features.mjs'
import { colorFeatures as experimentColors, meanPatchEmbedding as experimentMean, similarity } from '../tools/visual-similarity/ranking.mjs'

test('production descriptor and approved ranking match the full-image 20/65/15 experiment', () => {
  const a = Uint8Array.from({ length: 32 * 32 * 3 }, (_, i) => i % 251)
  const b = Uint8Array.from({ length: a.length }, (_, i) => (i * 7) % 251)
  assert.deepEqual(colorFeatures(a, 32, 32), experimentColors(a, 32, 32))
  const tensor = { dims: [1, 3, 384], data: Float32Array.from({ length: 3 * 384 }, (_, i) => i % 23) }
  assert.deepEqual(meanPatchEmbedding(tensor), experimentMean(tensor))
  const embedding = meanPatchEmbedding(tensor)
  const first = { embedding, ...colorFeatures(a, 32, 32) }, second = { embedding, ...colorFeatures(b, 32, 32) }
  assert.equal(visualSimilarity(first, second), similarity({ ...first, fullEmbedding: embedding }, { ...second, fullEmbedding: embedding }, 'colorFull'))
  assert.ok(validDescriptor(first)); assert.ok(!validDescriptor({ ...first, embedding: [NaN] }))
})

test('similarity HTTP, migration, snapshots, lifecycle and preparation states use an isolated library', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-library-similarity-'))
  try {
    const result = spawnSync(process.execPath, [new URL('./helpers/visual-similarity-http.ts', import.meta.url).pathname], {
      cwd: directory, encoding: 'utf8', timeout: 30000,
    })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
