import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { groupImagesByTag } from '../app/utils/tag-exploration.ts'

test('visual subjects keep exact identities, count unique images, and search names independently', () => {
  const a = { id: 'a', name: 'Été', normalizedName: 'été' }
  const b = { id: 'b', name: 'Ete', normalizedName: 'ete' }
  const c = { id: 'c', name: 'Manara', normalizedName: 'manara' }
  const images = [
    { id: '1', src: '/1', tags: [a, a, b] },
    { id: '2', src: '/2', tags: [a, c] },
    { id: '1', src: '/1', tags: [a] },
    { id: '3', src: '/3', tags: [] },
  ]
  const covers = [{ ...a, coverImageId: '2' }, { ...b, coverImageId: 'missing' }]
  const result = groupImagesByTag(images, covers, ' ETE ')
  assert.equal(result.length, 2)
  assert.equal(result.find((group) => group.id === 'a')?.imageCount, 2)
  assert.equal(result.find((group) => group.id === 'a')?.cover?.id, '2')
  assert.equal(result.find((group) => group.id === 'b')?.cover, null)
  assert.equal(groupImagesByTag(images, covers, '/1').length, 0)
  assert.equal(groupImagesByTag(images, covers, 'MANARA')[0]?.id, 'c')
  assert.deepEqual(groupImagesByTag(images, covers).map((group) => group.id), ['b', 'a', 'c'])
})

test('tag covers migrate, persist, survive association replacement, and roll back with group changes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-library-covers-'))
  const moduleUrl = new URL('../server/db.ts', import.meta.url).href
  const run = (script: string) => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: directory, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr || result.stdout)
  }
  try {
    run(`
      import assert from 'node:assert/strict';
      import { mkdirSync } from 'node:fs';
      import { DatabaseSync } from 'node:sqlite';
      mkdirSync('data');
      const legacy = new DatabaseSync('data/library.sqlite');
      legacy.exec("CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, last_used_at TEXT NOT NULL)");
      legacy.close();
      const { ensureDataStore, replaceImageTags, addTagsToImages, deleteImageRecord, listTagSummaries } = await import(${JSON.stringify(moduleUrl)});
      const db = await ensureDataStore();
      assert.ok(db.prepare('PRAGMA table_info(tags)').all().some(c => c.name === 'cover_image_id'));
      const insert = id => db.prepare('INSERT INTO images (id, filename, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?)').run(id, id + '.png', 'image/png', 1, id === 'old' ? '2000-01-01' : '2026-10-01');
      for (const id of ['first', 'second', 'old', 'full']) insert(id);
      replaceImageTags('first', ['Topic']);
      const cover = () => listTagSummaries().find(t => t.name === 'Topic')?.coverImageId;
      assert.equal(cover(), 'first');
      addTagsToImages(['second', 'old'], ['Topic']);
      assert.equal(cover(), 'first');
      replaceImageTags('first', ['Topic', 'Another']);
      assert.equal(cover(), 'first');
      replaceImageTags('full', Array.from({length: 8}, (_, i) => 'tag' + i));
      const snapshot = () => JSON.stringify([db.prepare('SELECT * FROM tags ORDER BY id').all(), db.prepare('SELECT * FROM image_tags ORDER BY image_id, tag_id').all()]);
      const before = snapshot();
      assert.throws(() => addTagsToImages(['first', 'full'], ['rollback']), /Too many tags/);
      assert.equal(snapshot(), before);
      db.exec("CREATE TRIGGER fail_cover BEFORE UPDATE OF cover_image_id ON tags WHEN NEW.name = 'Failure' BEGIN SELECT RAISE(ABORT, 'cover failure'); END");
      assert.throws(() => replaceImageTags('first', ['Failure']), /cover failure/);
      assert.equal(snapshot(), before);
      assert.throws(() => addTagsToImages(['first', 'second'], ['Failure']), /cover failure/);
      assert.equal(snapshot(), before);
      db.exec('DROP TRIGGER fail_cover');
      replaceImageTags('first', ['Another']);
      assert.ok(['second', 'old'].includes(cover()));
      const nextCover = cover();
      deleteImageRecord(nextCover);
      assert.equal(cover(), nextCover === 'second' ? 'old' : 'second');
      deleteImageRecord(cover());
      assert.equal(cover(), undefined);
      assert.equal(db.prepare("SELECT cover_image_id FROM tags WHERE name = 'Topic'").get().cover_image_id, null);
      replaceImageTags('first', ['Topic']);
      assert.equal(cover(), 'first');
      db.close();
    `)
    run(`
      import assert from 'node:assert/strict';
      const { ensureDataStore, listTagSummaries } = await import(${JSON.stringify(moduleUrl)});
      const db = await ensureDataStore();
      assert.equal(listTagSummaries().find(t => t.name === 'Topic').coverImageId, 'first');
      db.close();
    `)
    // Simulate legacy data with associations but no cover column, then migrate again.
    run(`
      import { DatabaseSync } from 'node:sqlite';
      const db = new DatabaseSync('data/library.sqlite');
      db.exec('ALTER TABLE tags DROP COLUMN cover_image_id');
      db.close();
    `)
    run(`
      import assert from 'node:assert/strict';
      const { ensureDataStore, listTagSummaries } = await import(${JSON.stringify(moduleUrl)});
      const db = await ensureDataStore();
      assert.equal(listTagSummaries().find(t => t.name === 'Topic').coverImageId, 'first');
      db.close();
    `)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
