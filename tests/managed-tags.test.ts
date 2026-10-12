import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
test('managed classifications preserve personal/shared tags, reject stale revisions and roll back conflicts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-managed-tags-'))
  try {
    const result = spawnSync(process.execPath, [new URL('./helpers/managed-tags-http.ts', import.meta.url).pathname], {
      cwd: directory, encoding: 'utf8', timeout: 30000,
    })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
