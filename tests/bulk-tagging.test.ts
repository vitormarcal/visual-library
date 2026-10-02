import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('bulk additions preserve tags, deduplicate, and roll back the entire group', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-library-tags-'))
  try {
    // A separate process keeps the database singleton away from the real library.
    const moduleUrl = new URL('../server/db.ts', import.meta.url).href
    const script = `
      import assert from 'node:assert/strict';
      import { ensureDataStore, addTagsToImages, replaceImageTags, getImageTags } from ${JSON.stringify(moduleUrl)};
      const db = await ensureDataStore();
      for (const id of ['a', 'b', 'full']) {
        db.prepare('INSERT INTO images (id, filename, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?)').run(id, id + '.png', 'image/png', 1, '2026-10-01');
      }
      replaceImageTags('a', ['Personal', 'Playboy']);
      replaceImageTags('b', ['Other']);
      const original = db.prepare('SELECT * FROM image_tags WHERE image_id = ?').all('a');
      const result = addTagsToImages(['a', 'b', 'a'], [' playboy ', 'Mel   Lisboa', 'MEL LISBOA']);
      assert.equal(result.length, 2);
      assert.deepEqual(new Set(getImageTags('a').map(t => t.name)), new Set(['Personal', 'Playboy', 'Mel Lisboa']));
      assert.deepEqual(new Set(getImageTags('b').map(t => t.name)), new Set(['Other', 'Playboy', 'Mel Lisboa']));
      for (const association of original) assert.deepEqual(db.prepare('SELECT * FROM image_tags WHERE image_id = ? AND tag_id = ?').get('a', association.tag_id), association);
      const snapshot = () => JSON.stringify([db.prepare('SELECT * FROM tags ORDER BY id').all(), db.prepare('SELECT * FROM image_tags ORDER BY image_id, tag_id').all()]);
      const beforeNoop = snapshot();
      addTagsToImages(['a', 'b'], ['PLAYBOY', 'mel lisboa']);
      assert.equal(snapshot(), beforeNoop);
      replaceImageTags('full', Array.from({ length: 8 }, (_, i) => 'tag ' + i));
      const beforeFailures = snapshot();
      assert.throws(() => addTagsToImages(['a', 'full'], ['new']), /Too many tags/);
      assert.throws(() => addTagsToImages(['a', 'missing'], ['new']), /Image not found/);
      assert.throws(() => addTagsToImages(['a'], ['x'.repeat(49)]), /Tag is too long/);
      assert.throws(() => addTagsToImages(['a'], [' ']), /Select images/);
      assert.equal(snapshot(), beforeFailures);
      db.exec("CREATE TRIGGER fail_second BEFORE INSERT ON image_tags WHEN NEW.image_id = 'b' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
      assert.throws(() => addTagsToImages(['a', 'b'], ['rollback']), /test failure/);
      assert.equal(snapshot(), beforeFailures);
      db.close();
    `
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: directory, encoding: 'utf8',
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
