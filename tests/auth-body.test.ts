import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
test('slow incomplete authentication bodies do not reserve derivation slots and body reads have a deadline', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'visual-library-auth-body-'))
  try {
    const result = spawnSync(process.execPath, [new URL('./helpers/auth-body-http.ts', import.meta.url).pathname], { cwd, encoding: 'utf8', timeout: 5000 })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  } finally { rmSync(cwd, { recursive: true, force: true }) }
})
