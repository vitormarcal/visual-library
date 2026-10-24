import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { semanticFingerprint } from '../runtime/similarity/semantic-features.mjs'
import { semanticFingerprint as experimentFingerprint } from '../tools/visual-similarity/semantic-ranking.mjs'

test('production content search keeps the evaluated model fingerprint', () => {
  assert.equal(semanticFingerprint, experimentFingerprint)
  assert.equal(semanticFingerprint, '239f34e0acef26f4464d7bd88f408dd67e1d4fdb2c78bca15af8abeee5a90468')
})
test('content search opt-in, HTTP validation, filters, lifecycle and worker IPC use an isolated library', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-library-content-http-'))
  try {
    const result = spawnSync(process.execPath, [new URL('./helpers/content-search-http.ts', import.meta.url).pathname], { cwd: directory, encoding: 'utf8', timeout: 30000 })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
