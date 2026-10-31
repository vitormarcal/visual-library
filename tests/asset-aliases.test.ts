import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('consolidation preserves integration IDs, content, managed revisions, aliases and public links across restart', () => {
  const root = mkdtempSync(join(tmpdir(), 'visual-library-asset-aliases-'))
  try {
    mkdirSync(join(root, 'runtime'))
    symlinkSync(new URL('../runtime/similarity', import.meta.url).pathname, join(root, 'runtime/similarity'), 'dir')
    const run = spawnSync(process.execPath, [new URL('./helpers/asset-aliases-http.ts', import.meta.url).pathname], { cwd: root, encoding: 'utf8', timeout: 30_000 })
    assert.equal(run.status, 0, run.stdout + run.stderr)
    const reopen = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      const {ensureDataStore,findAssetImage,getAssetReferences,replaceAssetReferenceTagGroup}=await import(${JSON.stringify(new URL('../server/db.ts', import.meta.url).href)});
      const db=await ensureDataStore();
      const old='00000002-0000-4000-8000-000000000001',current='00000003-0000-4000-8000-000000000001';
      assert.equal(findAssetImage(old).id,current);
      assert.equal(getAssetReferences(current).length,3);
      const groups=db.prepare('SELECT revision FROM asset_reference_tag_groups WHERE asset_id=?').all(current);
      assert.ok(groups.every(group=>group.revision>=8));
      assert.ok(replaceAssetReferenceTagGroup(old,'media-pulse',{entityType:'book',entityId:'362'},'book-series',{tags:['Updated after restart'],revision:10}));
      assert.equal(db.prepare('SELECT image_id FROM asset_id_aliases WHERE alias_id=?').get(old).image_id,current);
      db.close();
    `], { cwd: root, encoding: 'utf8', timeout: 5000 })
    assert.equal(reopen.status, 0, reopen.stdout + reopen.stderr)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
