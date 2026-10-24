import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('persistent previews use real decoding, revocable HTTP cache, fallback and deletion in an isolated library', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-library-thumbnails-'))
  try {
    const result = spawnSync(process.execPath, [new URL('./helpers/thumbnails-http.ts', import.meta.url).pathname], {
      cwd: directory, encoding: 'utf8', timeout: 60000,
    })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    process.stdout.write(result.stdout)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
