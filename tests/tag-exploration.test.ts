import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { groupImagesByTag, automaticTagFolders } from '../app/utils/tag-exploration.ts'

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
  assert.deepEqual(groupImagesByTag(images, covers).map((group) => group.id), ['a', 'b', 'c'])
})

test('automatic folders are alphabetical, use unique visible members and preserve a stable main cover', () => {
  const a = { id: 'a', name: 'Árvore', normalizedName: 'árvore' }
  const b = { id: 'b', name: 'Books', normalizedName: 'books' }
  const c = { id: 'c', name: 'Hidden only', normalizedName: 'hidden only' }
  const images = [
    { id: '3', src: '/3', tags: [a, b, a], createdAt: '2026-03-01' },
    { id: '1', src: '/1', tags: [a], createdAt: '2026-01-01' },
    { id: '2', src: '/2', tags: [a, b], createdAt: '2026-02-01' },
    { id: '4', src: '/4', tags: [a], createdAt: '2026-04-01' },
    { id: '5', src: '/5', tags: [a, c], hiddenFromGallery: true },
    { id: '3', src: '/3', tags: [a, b] },
    { id: '6', src: '/6', tags: [] },
  ]
  const covers = [{ ...a, coverImageId: '3' }, { ...b, coverImageId: '2' }, { ...c, coverImageId: '5' }]
  const result = automaticTagFolders(images, covers)
  assert.deepEqual(result.map(group => group.id), ['a', 'b'])
  assert.equal(result[0]?.imageCount, 4)
  assert.equal(result[1]?.imageCount, 2)
  assert.deepEqual(result[0]?.previews.map(image => image.id), ['3', '1', '2'])
  assert.deepEqual(result[1]?.previews.map(image => image.id), ['2', '3'])
  assert.deepEqual(automaticTagFolders(images.slice(0, 5).reverse(), covers).map(group => group.previews.map(image => image.id)), result.map(group => group.previews.map(image => image.id)))
  assert.equal(automaticTagFolders(images, covers, ' ARVORE ')[0]?.id, 'a')
  assert.equal(automaticTagFolders(images, covers, '/3').length, 0)
  assert.equal(automaticTagFolders([...images, { id: '7', src: '/7', tags: [a], createdAt: '2026-05-01' }], covers)[0]?.previews[0]?.id, '3')
})

test('folders follow association/visibility changes without copying images or inventing preview slots', () => {
  const a = { id: 'a', name: 'A', normalizedName: 'a' }
  const b = { id: 'b', name: 'B', normalizedName: 'b' }
  const one = { id: 'one', src: '/one', tags: [a, b] }
  const two = { id: 'two', src: '/two', tags: [a] }
  assert.deepEqual(automaticTagFolders([one], [])[0]?.previews.map(image => image.id), ['one'])
  assert.equal(automaticTagFolders([one], []).length, 2)
  const withoutB = { ...one, tags: [a] }
  assert.deepEqual(automaticTagFolders([withoutB, two], []).map(group => group.id), ['a'])
  assert.equal(automaticTagFolders([{ ...withoutB, hiddenFromGallery: true }, two], [])[0]?.imageCount, 1)
  assert.deepEqual(automaticTagFolders([{ ...withoutB, tags: [] }], []), [])
  assert.equal(one.tags.length, 2, 'folder derivation must not mutate the source image')
  assert.equal(automaticTagFolders([one, two], [{ ...a, coverImageId: 'missing' }])[0]?.previews.length, 2)
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
      const { ensureDataStore, replaceImageTags, addTagsToImages, deleteImageRecord, listTagSummaries, findTag } = await import(${JSON.stringify(moduleUrl)});
      const db = await ensureDataStore();
      assert.ok(db.prepare('PRAGMA table_info(tags)').all().some(c => c.name === 'cover_image_id'));
      const insert = id => db.prepare('INSERT INTO images (id, filename, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?)').run(id, id + '.png', 'image/png', 1, id === 'old' ? '2000-01-01' : '2026-10-01');
      for (const id of ['first', 'second', 'old', 'full']) insert(id);
      replaceImageTags('first', ['Topic']);
      const topicId = listTagSummaries().find(t => t.name === 'Topic').id;
      assert.equal(findTag(topicId).imageCount, 1);
      assert.equal(findTag('missing'), null);
      const cover = () => listTagSummaries().find(t => t.name === 'Topic')?.coverImageId;
      assert.equal(cover(), 'first');
      addTagsToImages(['second', 'old'], ['Topic']);
      assert.equal(cover(), 'first');
      replaceImageTags('first', ['Topic', 'Another']);
      assert.equal(cover(), 'first');
      replaceImageTags('full', Array.from({length: 8}, (_, i) => 'tag' + i));
      const snapshot = () => JSON.stringify([db.prepare('SELECT * FROM tags ORDER BY id').all(), db.prepare('SELECT * FROM image_tags ORDER BY image_id, tag_id').all()]);
      addTagsToImages(['first', 'full'], ['beyond eight']);
      const before = snapshot();
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
      assert.equal(findTag(topicId).name, 'Topic');
      assert.equal(findTag(topicId).imageCount, 0);
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
