import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { sharedCaptureMessage, sharedImageUrl } from '../app/utils/shared-capture.ts'

test('shared URLs accept Android text, prefer explicit URL, and reject credentials and non-HTTP data', () => {
  const form = new FormData()
  form.set('text', 'A reference\nhttps://example.com/image.png?size=large')
  assert.equal(sharedImageUrl(form), 'https://example.com/image.png?size=large')
  form.set('url', 'https://example.com/explicit.webp')
  assert.equal(sharedImageUrl(form), 'https://example.com/explicit.webp')
  form.delete('url')
  form.set('text', 'https://user:password@example.com/private.png')
  assert.equal(sharedImageUrl(form), null)
  form.set('text', 'file:///etc/passwd javascript:alert(1)')
  assert.equal(sharedImageUrl(form), null)
  form.set('text', 'x'.repeat(8193))
  assert.equal(sharedImageUrl(form), null)
})

test('shared capture feedback distinguishes duplicates, partial failures and rejected payloads', () => {
  assert.equal(sharedCaptureMessage(new URLSearchParams('shared=result&saved=2&duplicates=1&failed=0')), '2 saved · 1 already saved')
  assert.match(sharedCaptureMessage(new URLSearchParams('shared=result&saved=1&failed=1')), /^1 saved · 1 failed.*share again to retry/)
  assert.match(sharedCaptureMessage(new URLSearchParams('shared=too-large')), /fewer or smaller/)
  assert.equal(sharedCaptureMessage(new URLSearchParams('shared=other')), '')
  assert.equal(sharedCaptureMessage(new URLSearchParams('shared=result&saved=<script>')), '')
})

test('share HTTP capture validates bytes, handles partial batches and duplicates, and redirects safely', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-library-share-'))
  try {
    const result = spawnSync(process.execPath, [new URL('./helpers/share-http.ts', import.meta.url).pathname], {
      cwd: directory, encoding: 'utf8', timeout: 30000,
    })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
