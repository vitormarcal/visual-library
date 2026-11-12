import assert from 'node:assert/strict'
import { ensureDataStore } from '../../server/db.ts'
import { browseCriteria, browseImages, browseIds, browseImage, browseNeighbors, librarySummary, libraryFolders, rediscoveryImages, relatedPage } from '../../server/library-browse.ts'
const db = await ensureDataStore()
const image = db.prepare(`INSERT INTO images (id,filename,original_name,mime_type,size_bytes,created_at,hidden_from_gallery,width,height,dimensions_checked)
  VALUES (?, ?, ?, 'image/png', 100, ?, ?, 100, 60, 1)`)
db.exec('BEGIN')
for (let n = 0; n < 3000; n++) {
  const id = String(n).padStart(5, '0')
  image.run(id, `${id}.png`, n === 9 ? 'ÉTÉ  bleu.png' : `fixture-${id}.png`, `2026-01-${String(1 + n % 20).padStart(2, '0')}T00:00:00.000Z`, Number(n >= 2990))
}
db.exec(`INSERT INTO tags (id, name, normalized_name, created_at, last_used_at, cover_image_id) VALUES
 ('a', 'Árvore   VERDE', 'árvore verde', '2026-01-01', '2026-01-01', '00009'),
 ('b', 'Books', 'books', '2026-01-01', '2026-01-01', NULL),
 ('hidden', 'Hidden only', 'hidden only', '2026-01-01', '2026-01-01', NULL)`)
for (let n = 0; n < 150; n++) db.prepare("INSERT INTO image_tags (image_id, tag_id, created_at) VALUES (?, 'a', '2026-01-01')").run(String(n).padStart(5, '0'))
db.exec("INSERT INTO image_tags VALUES ('00009', 'b', '2026-01-01', 1), ('02999', 'hidden', '2026-01-01', 1)")
db.exec('COMMIT')
const plain = browseCriteria({})
const first = await browseImages(plain)
assert.equal(first.images.length, 60); assert.equal(first.total, 2990); assert.ok(first.nextCursor)
const ids: string[] = []
let cursor: string | undefined
while (true) { const page = await browseImages(plain, cursor); ids.push(...page.images.map(i => i.id)); if (!page.nextCursor) break; cursor = page.nextCursor }
assert.equal(ids.length, 2990); assert.equal(new Set(ids).size, 2990)
assert.deepEqual(ids, await browseIds(plain))
assert.equal((await browseImages(browseCriteria({hidden:'1'}))).total, 10)
assert.equal((await browseImages(browseCriteria({q:'été VERDE'}))).total, 1, 'terms may match different fields with accent/case normalization')
assert.equal((await browseImages(browseCriteria({q:'  ARVORE    verde  '}))).total, 150)
assert.equal((await browseImages(browseCriteria({tag:['a','b']}))).total, 1)
assert.equal((await browseImages(browseCriteria({tag:'a'}))).subjectTotal, 150)
assert.equal((await browseIds(browseCriteria({tag:'a'}))).length, 150)
assert.equal((await browseImage('02999')).hiddenFromGallery, true)
await assert.rejects(browseImage('missing'), { statusCode: 404 })
await assert.rejects(browseImages(plain, 'invalid'), { statusCode: 400 })
await assert.rejects(browseImages(plain, undefined, 1000), { statusCode: 400 })
assert.throws(()=>browseCriteria({tag:['a','b','c','d']}), {statusCode:400})
const edge = first.images.at(-1)!, neighbors = await browseNeighbors(edge.id, plain)
assert.equal(neighbors.next?.id, ids[60]); assert.equal(neighbors.previous?.id, ids[58])
assert.deepEqual(await browseNeighbors('02999', plain), {previous:null,next:null})
assert.deepEqual(await librarySummary(), {images:3000,bytes:300000,visible:2990,tags:3})
const folders = await libraryFolders()
assert.equal(folders.length,2); assert.equal(folders[0]?.imageCount,150); assert.equal(folders[0]?.previews.length,3)
assert.equal(folders[0]?.previews[0]?.id,'00009'); assert.equal(folders[1]?.previews.length,1)
const selection = await rediscoveryImages([])
assert.equal(selection.images.length,8); assert.ok(selection.images.every(i=>!i.hiddenFromGallery))
const second = await rediscoveryImages(selection.ids)
assert.ok(second.ids.every(id=>!selection.ids.includes(id)))
const related = await relatedPage('00009')
assert.equal(related.images.length,6); assert.equal(related.nextOffset,6)
const extra = await relatedPage('00009', related.nextOffset!)
assert.equal(extra.images.length,24); assert.ok(extra.images.every(i=>!related.images.some(r=>r.id===i.id)))
const noTags = await relatedPage('02888'); assert.equal(noTags.images.length,0); assert.equal(noTags.nextOffset,0)
assert.equal((await relatedPage('02888',0)).images.length,24)
// A deletion between pages must not shift the cursor or duplicate the remaining records.
db.prepare('DELETE FROM images WHERE id = ?').run(first.images[0]!.id)
const afterDeletion = await browseImages(plain, first.nextCursor!)
assert.equal(afterDeletion.images[0]?.id,ids[60])
const plan = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM images WHERE hidden_from_gallery = 0 ORDER BY created_at DESC, id DESC LIMIT 61').all()
assert.ok(JSON.stringify(plan).includes('images_browse'))

// Queries and global selection reflect membership changes, including pages never fetched by the client.
db.prepare("DELETE FROM image_tags WHERE image_id = '00009' AND tag_id = 'b'").run()
assert.equal((await browseIds(browseCriteria({tag:['a','b']}))).length,0)
db.prepare("UPDATE images SET hidden_from_gallery = 1 WHERE id = '00000'").run()
assert.equal((await browseImages(browseCriteria({tag:'a'}))).total,149)
assert.ok(!(await browseIds(plain)).includes('00000'))
