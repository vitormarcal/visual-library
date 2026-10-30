import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { createApp, createRouter, defineEventHandler, getRouterParam, toNodeListener } from 'h3'

// Simulate the already-shipped 014 schema; no reference table yet.
await mkdir('data')
const legacy = new DatabaseSync('data/library.sqlite')
legacy.exec(`CREATE TABLE images (
  id TEXT PRIMARY KEY, filename TEXT NOT NULL, original_name TEXT, mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL, source_url TEXT, content_hash TEXT,
  source TEXT NOT NULL DEFAULT 'visual-library', hidden_from_gallery INTEGER NOT NULL DEFAULT 0);
  INSERT INTO images (id, filename, mime_type, size_bytes, created_at) VALUES ('legacy','legacy.png','image/png',297,'2020-01-01')`)
legacy.close()
Object.assign(globalThis, { defineEventHandler, getRouterParam, useRuntimeConfig: () => ({ public: { maxImageSizeBytes: 1024 } }) })
const { ensureDataStore, getAssetReferences, getImageTags, replaceImageTags, deleteImageRecord, listTagSummaries, setImageVisibility } = await import('../../server/db.ts')
const db = await ensureDataStore()
assert.deepEqual(getAssetReferences('legacy'), [])
assert.equal(db.prepare('SELECT source FROM images WHERE id = ?').get('legacy')!.source, 'visual-library')
const router = createRouter()
router.post('/api/assets', (await import('../../server/api/assets.post.ts')).default)
router.get('/api/assets/:id', (await import('../../server/api/assets/[id].get.ts')).default)
router.get('/api/assets/:id/content', (await import('../../server/api/assets/[id]/content.get.ts')).default)
router.post('/api/images', (await import('../../server/api/images.post.ts')).default)
const app = createApp({debug:false}); app.use(router)
const server = createServer(toNodeListener(app))
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`
const fixture = (ext: string) => readFile(new URL(`../fixtures/images/tiny.${ext}`,import.meta.url))
const png = await fixture('png'), jpeg = await fixture('jpg'), gif = await fixture('gif'), webp = await fixture('webp'), avif = await fixture('avif')
const ref = {entityType:'album',entityId:'00123',url:'https://media-pulse.example/albums/00123'}
const send = (bytes: Buffer, tags?: unknown, reference?: unknown, fields: Record<string,string> = {}, route = '/api/assets') => {
  const form = new FormData()
  form.append('image',new Blob([bytes],{type:'image/png'}),'tiny.png')
  form.append('source', fields.source ?? 'media-pulse')
  if (tags !== undefined) form.append('tags',JSON.stringify(tags))
  if (reference !== undefined) form.append('sourceReference',JSON.stringify(reference))
  for(const [key,value] of Object.entries(fields)) if(key !== 'source') form.append(key,value)
  return fetch(base+route,{method:'POST',body:form})
}
const names = (id: string) => getImageTags(id).map(t=>t.name)
const snapshot = () => JSON.stringify(['images','tags','image_tags','asset_references'].map(table=>db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()))
try {
  const created = await send(png,[' Legião   Urbana ', 'DOIS', 'legião urbana', ''],ref)
  assert.equal(created.status,201)
  const asset = await created.json()
  assert.deepEqual(asset.tags.map((t: {name:string})=>t.name), ['Legião Urbana','DOIS'])
  assert.equal(asset.sourceReferences[0].entityId,'00123')
  assert.equal(asset.sourceReferences[0].application,'media-pulse')
  assert.equal(asset.sourceReferences[0].url,ref.url)
  assert.deepEqual(await (await fetch(`${base}/api/assets/${asset.id}`)).json(),asset)
  const original = await fetch(`${base}/api/assets/${asset.id}/content`)
  assert.deepEqual(Buffer.from(await original.arrayBuffer()),png)
  // Personal edit, removal, retry: no restoration or accidental update.
  replaceImageTags(asset.id,['DOIS','favoritos'])
  const beforeRetry = snapshot()
  const retry = await send(png,['Legião Urbana','new suggestion'],{...ref,url:'https://other.example/changed'})
  assert.equal(retry.status,200)
  const retried = await retry.json()
  assert.deepEqual(retried.tags.map((t: {name:string})=>t.name), ['DOIS','favoritos'])
  assert.equal(retried.sourceReferences[0].url,ref.url)
  assert.equal(retried.sourceReferences[0].createdAt,asset.sourceReferences[0].createdAt)
  assert.equal(snapshot(),beforeRetry)
  replaceImageTags(asset.id, Array.from({length:8},(_,i)=>'personal '+i))
  assert.equal((await send(png,['Legião Urbana'],ref)).status,200,'retry must not validate a union it will not apply')
  replaceImageTags(asset.id,['favoritos'])
  // Without a reference each submission deliberately adds its suggestions.
  assert.equal((await send(png,['Legião Urbana'])).status,200)
  assert.deepEqual(new Set(names(asset.id)),new Set(['favoritos','Legião Urbana']))
  replaceImageTags(asset.id,['favoritos'])
  assert.equal((await send(png,['Legião Urbana'])).status,200)
  assert.ok(names(asset.id).includes('Legião Urbana'))
  // Other references on the same asset are independent and can enrich it again.
  const other = {...ref,entityId:'other'}
  assert.equal((await send(png,['rock brasileiro'],other)).status,200)
  assert.equal(getAssetReferences(asset.id).length,2)
  assert.equal((await send(png,['other application'],ref,{source:'other-service',hiddenFromGallery:'true'})).status,200)
  assert.equal(getAssetReferences(asset.id).length,3)
  const unchanged = db.prepare('SELECT * FROM images WHERE id = ?').get(asset.id)!
  assert.equal(unchanged.source,'media-pulse');assert.equal(unchanged.hidden_from_gallery,0);assert.equal(unchanged.created_at,asset.createdAt)
  // Same entity, different image: append rather than replace.
  const coverBack = await send(jpeg,['contracapa'],ref)
  assert.equal(coverBack.status,201)
  const back = await coverBack.json()
  assert.notEqual(back.id,asset.id);assert.equal(getAssetReferences(back.id).length,1)
  assert.equal(getAssetReferences(asset.id).length,3)
  // Association without tags cannot be converted into an update on retry.
  const emptyRef = {entityType:'artwork',entityId:'empty'}
  const empty = await (await send(gif,[],emptyRef)).json()
  assert.deepEqual(empty.tags,[]);assert.equal(empty.sourceReferences[0].url,null)
  const noUpdate = await (await send(gif,['late tag'],{...emptyRef,url:'https://example.com/new'})).json()
  assert.deepEqual(noUpdate.tags,[]);assert.equal(noUpdate.sourceReferences[0].url,null)
  // Union above eight preserves every personal tag and the new reference.
  replaceImageTags(asset.id,Array.from({length:8},(_,i)=>'personal '+i))
  assert.equal((await send(png,['overflow'],{...ref,entityId:'overflow'})).status,200)
  assert.equal(names(asset.id).length,9)
  const beforeOverflow = snapshot(), filesBefore = await readdir('data/images')
  // Reject invalid inputs before storing bytes or references.
  for(const tags of [null,{},'tag',[1],['x'.repeat(49)]]) {
    assert.equal((await send(webp,tags)).status,400)
  }
  for(const reference of [null,[],{}, {entityType:'album',entityId:123}, {...ref,entityId:' 123'}, {...ref,entityId:'x\u0000y'}, {...ref,entityId:'x'.repeat(257)}, {...ref,entityType:'Album'}, {...ref,unexpected:true}, {...ref,url:'file:///tmp/test'}, {...ref,url:'https://user:password@example.com'}, {...ref,url:null}, {...ref,url:'https://example.com/'+'x'.repeat(2050)}]) {
    assert.equal((await send(webp,[],reference)).status,400)
  }
  for(const [field,value] of [['tags','{'],['sourceReference','{'],['tags',' '.repeat(4097)],['sourceReference',' '.repeat(8193)]]) {
    assert.equal((await send(webp,undefined,undefined,{[field]:value})).status,400)
  }
  const repeated = new FormData();repeated.append('image',new Blob([webp]),'a.webp');repeated.append('tags','[]');repeated.append('tags','[]')
  assert.equal((await fetch(base+'/api/assets',{method:'POST',body:repeated})).status,400)
  const fileField = new FormData();fileField.append('image',new Blob([webp]),'a.webp');fileField.append('tags',new Blob(['[]']),'tags.json')
  assert.equal((await fetch(base+'/api/assets',{method:'POST',body:fileField})).status,400)
  assert.equal(snapshot(),beforeOverflow);assert.deepEqual(await readdir('data/images'),filesBefore)
  // Tags/reference failure rolls back even tag creation and usage timestamps.
  for(const table of ['tags','asset_references']) {
    db.exec(`CREATE TRIGGER fail_enrichment BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'test enrichment failure'); END`)
    const before = snapshot(), files = await readdir('data/images')
    assert.equal((await send(webp,['new failure tag'],{entityType:'artwork',entityId:'failure'})).status,500)
    assert.equal(snapshot(),before);assert.deepEqual(await readdir('data/images'),files)
    replaceImageTags(asset.id,['favoritos'])
    const existingBefore = snapshot()
    assert.equal((await send(png,['new failure tag'],{...ref,entityId:'failure-existing'})).status,500)
    assert.equal(snapshot(),existingBefore)
    assert.deepEqual(await readFile(`data/images/${unchanged.filename}`),png)
    db.exec('DROP TRIGGER fail_enrichment')
  }
  // Force a genuine COMMIT failure using a deferred constraint on a test-only table.
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE commit_parent (id INTEGER PRIMARY KEY);
    CREATE TABLE commit_child (id INTEGER REFERENCES commit_parent(id) DEFERRABLE INITIALLY DEFERRED);
    CREATE TRIGGER fail_commit AFTER INSERT ON asset_references BEGIN INSERT INTO commit_child VALUES (1); END;`)
  const beforeCommit = snapshot(), commitFiles = await readdir('data/images')
  assert.equal((await send(webp,['commit tag'],{entityType:'artwork',entityId:'commit-failure'})).status,500)
  assert.equal(snapshot(),beforeCommit);assert.deepEqual(await readdir('data/images'),commitFiles)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM commit_child').get()!.n,0)
  db.exec('DROP TRIGGER fail_commit; DROP TABLE commit_child; DROP TABLE commit_parent; PRAGMA foreign_keys = OFF')
  // Race two identical uploads, then race independent references on another image.
  const race = await Promise.all([send(webp,['race'],ref),send(webp,['race'],ref)])
  assert.deepEqual(race.map(r=>r.status).sort(),[200,201])
  const raceAssets = await Promise.all(race.map(r=>r.json()))
  assert.equal(raceAssets[0].id,raceAssets[1].id);assert.equal(getAssetReferences(raceAssets[0].id).length,1)
  const independent = await Promise.all([send(avif,['one'],{entityType:'artwork',entityId:'one'}),send(avif,['two'],{entityType:'artwork',entityId:'two'})])
  assert.deepEqual(independent.map(r=>r.status).sort(),[200,201])
  const independentAssets = await Promise.all(independent.map(r=>r.json()))
  assert.equal(independentAssets[0].id,independentAssets[1].id)
  assert.equal(getAssetReferences(independentAssets[0].id).length,2)
  assert.deepEqual(new Set(names(independentAssets[0].id)),new Set(['one','two']))
  // Concurrent additions above the former limit preserve both references.
  replaceImageTags(independentAssets[0].id,Array.from({length:7},(_,i)=>'keep '+i))
  const nearLimit = await Promise.all([send(avif,['last-a'],{entityType:'artwork',entityId:'last-a'}),send(avif,['last-b'],{entityType:'artwork',entityId:'last-b'})])
  assert.deepEqual(nearLimit.map(r=>r.status).sort(),[200,200])
  assert.equal(names(independentAssets[0].id).length,9);assert.equal(getAssetReferences(independentAssets[0].id).length,4)
  assert.equal((await readdir('data/images')).length,Number(db.prepare('SELECT COUNT(*) AS n FROM images WHERE id != ?').get('legacy')!.n))
  // Hidden assets keep tags but don't become visible tag covers.
  setImageVisibility(asset.id,true)
  const hiddenOnly = await send(png,['hidden-only'],{...ref,entityId:'hidden-new'})
  assert.equal(hiddenOnly.status,200);assert.ok(!listTagSummaries().some(t=>t.name==='hidden-only'))
  setImageVisibility(asset.id,false)
  assert.ok(listTagSummaries().some(t=>t.name==='hidden-only'))
  // Deletion and failure rollback include references.
  db.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON images BEGIN SELECT RAISE(ABORT, 'test delete failure'); END")
  const beforeDelete = snapshot()
  assert.throws(()=>deleteImageRecord(back.id),/test delete failure/)
  assert.equal(snapshot(),beforeDelete)
  db.exec('DROP TRIGGER fail_delete')
  deleteImageRecord(back.id);assert.deepEqual(getAssetReferences(back.id),[])
  assert.equal(getAssetReferences(asset.id).length,5)
  // Old caller does not accept or persist external enrichment.
  const legacyResponse = await send(png,['ignored'],{entityType:'album',entityId:'ignored'},{},'/api/images')
  assert.deepEqual(await legacyResponse.json(),{duplicate:true,message:'Already saved.'})
  assert.ok(!names(asset.id).includes('ignored'))
  console.log('Enrichment HTTP, migration, rollback, races, hidden discovery and manual-edit assertions passed')
} finally {
  server.closeAllConnections()
  await new Promise<void>(resolve=>server.close(()=>resolve()))
  db.close()
}
