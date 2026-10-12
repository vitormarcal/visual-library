import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('asset HTTP contracts, migration, compensation, visibility and legacy compatibility', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-library-assets-'))
  try {
    const result = spawnSync(process.execPath, [new URL('./helpers/assets-http.ts', import.meta.url).pathname], {
      cwd: directory, encoding: 'utf8', timeout: 30000,
    })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    const moduleUrl = new URL('../server/db.ts', import.meta.url).href
    const reopen = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      const {ensureDataStore} = await import(${JSON.stringify(moduleUrl)});
      const db = await ensureDataStore();
      assert.equal(db.prepare('SELECT source FROM images WHERE id = ?').get('legacy').source, 'visual-library');
      assert.equal(db.prepare('PRAGMA table_info(images)').all().filter(c => c.name === 'source').length, 1);
      assert.ok(db.prepare('SELECT id FROM images WHERE source = ? AND hidden_from_gallery = 1').get('media-pulse'));
      db.close();
    `], {cwd:directory, encoding:'utf8'});
    assert.equal(reopen.status,0,reopen.stderr || reopen.stdout)

  } finally { rmSync(directory, { recursive: true, force: true }) }
})
