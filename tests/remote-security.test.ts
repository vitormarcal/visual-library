import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
test('remote downloads reject DNS rebinding at connection time without reaching internal services', () => {
  const result = spawnSync(process.execPath, [new URL('./helpers/remote-security-http.ts', import.meta.url).pathname], { encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 0, result.stdout + result.stderr)
})
