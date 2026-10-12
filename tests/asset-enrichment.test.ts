import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('upload enrichment is atomic, additive, supports shared references and preserves manual edits on retry', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-library-enrichment-'))
  try {
    const result = spawnSync(process.execPath, [new URL('./helpers/asset-enrichment-http.ts', import.meta.url).pathname], {
      cwd: directory, encoding: 'utf8', timeout: 30000,
    })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    const moduleUrl = new URL('../server/db.ts', import.meta.url).href
    const reopened = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      const { ensureDataStore, getAssetReferences } = await import(${JSON.stringify(moduleUrl)});
      const db = await ensureDataStore();
      assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'asset_references'").get().count, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM images WHERE id = ?').get('legacy').count, 1);
      const row = db.prepare("SELECT id FROM images WHERE source = 'media-pulse' LIMIT 1").get();
      assert.ok(getAssetReferences(row.id).length);
      db.close();
    `], {cwd:directory, encoding:'utf8', timeout:10000})
    assert.equal(reopened.status, 0, reopened.stdout + reopened.stderr)
  } finally { rmSync(directory, {recursive:true, force:true}) }
})
