import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { createApp, createRouter, defineEventHandler, getRouterParam, toNodeListener } from 'h3'
let origin = 'http://127.0.0.1'
Object.assign(globalThis, { defineEventHandler, getRouterParam, useRuntimeConfig: () => ({ ownerResetKey: '', libraryOrigin: origin, public: { maxImageSizeBytes: 15728640 } }) })
const { ensureDataStore, hashImageBytes, replaceImageTags, getImageTags, setImageVisibility } = await import('../../server/db.ts')
const { duplicateFingerprint } = await import('../../runtime/similarity/duplicate-features.mjs')
const store = await import('../../server/access-store.ts')
const { duplicateGroups, duplicateReviewStatus } = await import('../../server/duplicates.ts')
const db = await ensureDataStore()
await store.initializeOwnerAccess({ origin, resetKey: '33333333-3333-4333-8333-333333333333' })
const state = await store.ownerAccessState()
await store.defineOwnerPassword('duplicate test password', 'duplicate test password', state.generation)
const ownerSession = await store.createOwnerSession((await store.ownerPasswordHash())!)
const cookie = `vl_owner_session=${ownerSession}`
const vector = (x: number, y = 0) => [x, y, ...Array(766).fill(0)]
const ids = ['a','b','c','hidden','other','e','f']
for (const [index, id] of ids.entries()) {
  const fixture = await readFile(new URL(`../fixtures/images/${index % 2 ? 'tiny.jpg' : 'tiny.png'}`, import.meta.url))
  const bytes = Buffer.concat([fixture,Buffer.from([index])])
  await writeFile(`data/images/${id}.png`, bytes)
  db.prepare('INSERT INTO images (id,filename,mime_type,size_bytes,created_at,content_hash,width,height,hidden_from_gallery) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, id+'.png','image/png',bytes.length,'2026-10-30',hashImageBytes(bytes),id==='a'?2000:1000,id==='a'?3000:1500,id==='hidden'?1:0)
  const values = id === 'other' ? vector(0,1) : id==='e' ? vector(0,0) : id==='f' ? vector(0,0) : vector(1)
  if (id==='e') { values[2]=1 }
  if (id==='f') { values[2]=.95; values[3]=.312 }
  db.prepare("INSERT INTO image_duplicate_vectors VALUES (?,?,?,'ready',?)").run(id,duplicateFingerprint,hashImageBytes(bytes),JSON.stringify(values))
}
assert.equal((await duplicateReviewStatus()).state,'inactive')
await mkdir('data/duplicates',{recursive:true});await writeFile('data/duplicates/enabled','1')
replaceImageTags('a',Array.from({length:12},(_,i)=>'original '+i))
replaceImageTags('b',Array.from({length:12},(_,i)=>'absorbed '+i))
replaceImageTags('c',['third','original 0'])
const links = new Map<string,string>()
for (const id of ['a','b','c']) links.set(id,(await store.publicImageLink(id,true))!)
const revoked = (await store.publicImageLink('other',true))!
await store.revokePublicImageLink('other')
const aliasToken = 'z'.repeat(43)
db.prepare('INSERT INTO image_public_link_aliases VALUES (?,?,?)').run(aliasToken,'c','2026-10-30')
const router = createRouter()
router.get('/api/duplicates',(await import('../../server/api/duplicates/index.get.ts')).default)
router.post('/api/duplicates/resolve',(await import('../../server/api/duplicates/resolve.post.ts')).default)
router.get('/shared-images/:token',(await import('../../server/routes/shared-images/[token].get.ts')).default)
router.head('/shared-images/:token',(await import('../../server/routes/shared-images/[token].get.ts')).default)
router.get('/api/images/:id/public-link',(await import('../../server/api/images/[id]/public-link.get.ts')).default)
router.post('/api/images/:id/public-link',(await import('../../server/api/images/[id]/public-link.post.ts')).default)
router.delete('/api/images/:id/public-link',(await import('../../server/api/images/[id]/public-link.delete.ts')).default)
const app = createApp({debug:false});app.use((await import('../../server/middleware/access.ts')).default);app.use(router)
const server = createServer(toNodeListener(app))
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`
const owner = (path: string, body?: unknown) => fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin,'x-library-request':'1','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})
const prepare = (group: any,keepIds=['a'],targetId: string|null='a',broad=false)=>({groupId:group.id,revision:group.revision,keepIds,targetId,broad})
try {
  assert.equal((await fetch(origin+'/api/duplicates')).status,401)
  const token = await store.createApplicationToken('integration')
  assert.equal((await fetch(origin+'/api/duplicates',{headers:{authorization:'Bearer '+token.token}})).status,403)
  const first=await owner('/api/duplicates');assert.equal(first.status,200)
  const initial=await first.json();assert.equal(initial.groups.length,1);assert.equal(initial.groups[0].images.length,3)
  assert.equal(initial.totalCount,6);assert.equal(initial.preparedCount,6)
  const broad=await (await owner('/api/duplicates?mode=broad')).json();assert.equal(broad.groups.length,2)
  const group=initial.groups[0]
  assert.equal(group.images.some((i:any)=>i.id==='hidden'),false)
  assert.equal(group.images.find((i:any)=>i.id==='c').publicLinkCount,2)
  assert.equal((await fetch(origin+'/api/duplicates/resolve',{method:'POST',headers:{cookie,origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify(prepare(group))})).status,403)
  assert.equal((await owner('/api/duplicates/resolve',{...prepare(group),keepIds:[]})).status,400)
  assert.equal((await owner('/api/duplicates/resolve',prepare(group,['other'],'other'))).status,400)
  assert.equal((await owner('/api/duplicates/resolve',prepare(group,['a','b'],null))).status,400)
  setImageVisibility('c',true)
  assert.equal((await owner('/api/duplicates/resolve',prepare(group))).status,409)
  setImageVisibility('c',false)
  let latest=(await duplicateGroups())[0]!
  db.prepare('INSERT INTO asset_references (asset_id,application,entity_type,entity_id,created_at) VALUES (?,?,?,?,?)').run('c','test','work','1','2026')
  latest=(await duplicateGroups())[0]!
  assert.equal((await owner('/api/duplicates/resolve',prepare(latest))).status,409)
  db.prepare('DELETE FROM asset_references WHERE asset_id=?').run('c')
  latest=(await duplicateGroups())[0]!
  replaceImageTags('c',['third','changed after opening'])
  assert.equal((await owner('/api/duplicates/resolve',prepare(latest))).status,409)
  latest=(await duplicateGroups())[0]!
  const before=JSON.stringify([db.prepare('SELECT * FROM images ORDER BY id').all(),db.prepare('SELECT * FROM image_tags ORDER BY image_id,tag_id').all(),db.prepare('SELECT * FROM image_public_links ORDER BY image_id').all(),db.prepare('SELECT * FROM image_public_link_aliases ORDER BY token').all()])
  db.exec("CREATE TRIGGER fail_removal BEFORE DELETE ON images WHEN OLD.id='c' BEGIN SELECT RAISE(ABORT,'test rollback'); END")
  assert.equal((await owner('/api/duplicates/resolve',prepare(latest))).status,500)
  assert.equal(JSON.stringify([db.prepare('SELECT * FROM images ORDER BY id').all(),db.prepare('SELECT * FROM image_tags ORDER BY image_id,tag_id').all(),db.prepare('SELECT * FROM image_public_links ORDER BY image_id').all(),db.prepare('SELECT * FROM image_public_link_aliases ORDER BY token').all()]),before)
  await access('data/images/b.png');await access('data/images/c.png')
  db.exec('DROP TRIGGER fail_removal')
  const beforeA=getImageTags('a')
  const oldC=await fetch(origin+links.get('c'));const oldEtag=oldC.headers.get('etag')
  // Keep two variants; only the selected destination receives the removed tags and URLs.
  const response=await owner('/api/duplicates/resolve',prepare(latest,['a','b'],'b'))
  assert.equal(response.status,200);assert.deepEqual((await response.json()).removedIds,['c'])
  assert.deepEqual(getImageTags('a'),beforeA)
  assert.equal(getImageTags('b').length,14)
  assert.equal(await store.publicImageLinkCount('b'),3)
  assert.equal(await store.publicImageLink('b'),links.get('b'))
  for (const path of [links.get('c')!, '/shared-images/'+aliasToken]) {
    const image=await fetch(origin+path,{headers:{'if-none-match':oldEtag!}})
    assert.equal(image.status,200);assert.notEqual(image.headers.get('etag'),oldEtag)
    assert.deepEqual(Buffer.from(await image.arrayBuffer()),await readFile('data/images/b.png'))
    assert.equal((await fetch(origin+path,{method:'HEAD'})).status,200)
  }
  assert.equal((await fetch(origin+revoked)).status,404)
  assert.equal((await duplicateGroups()).length,0,'deliberately kept variants must not immediately reappear')
  assert.equal((await owner('/api/duplicates/resolve',prepare(latest,['a','b'],'b'))).status,409)
  await assert.rejects(access('data/images/c.png'))
  // Revocation covers every absorbed token and does not affect a different kept image.
  const tokensBefore=db.prepare('SELECT token FROM image_public_link_aliases WHERE image_id=?').all('b')
  assert.equal(tokensBefore.length,2)
  await store.revokePublicImageLink('b')
  assert.equal((await fetch(origin+links.get('c'))).status,404)
  assert.equal((await fetch(origin+'/shared-images/'+aliasToken)).status,404)
  assert.equal((await fetch(origin+links.get('a'))).status,200)
  // Keep an alias + primary for restart assertions, using new tokens only.
  await store.publicImageLink('b',true)
  db.prepare('INSERT INTO image_public_link_aliases VALUES (?,?,?)').run('y'.repeat(43),'b','2026')
  // Reviewed groups reopen when a new copy joins, not merely when tags change.
  const newBytes=await readFile(new URL('../fixtures/images/tiny.gif',import.meta.url))
  await writeFile('data/images/new.png',newBytes)
  const newHash=hashImageBytes(newBytes)
  db.prepare('INSERT INTO images (id,filename,mime_type,size_bytes,created_at,content_hash,width,height) VALUES (?,?,?,?,?,?,?,?)').run('new','new.png','image/gif',newBytes.length,'2026',newHash,3000,4500)
  db.prepare("INSERT INTO image_duplicate_vectors VALUES (?,?,?,'ready',?)").run('new',duplicateFingerprint,newHash,JSON.stringify(vector(1)))
  assert.equal((await duplicateGroups()).length,1)
  // The better, previously unpublished image inherits the old URLs and a stable primary.
  const joined=(await duplicateGroups())[0]!
  const promoted=await owner('/api/duplicates/resolve',prepare(joined,['new'],null))
  assert.equal(promoted.status,200)
  assert.equal(await store.publicImageLink('new'),links.get('a'))
  assert.equal(await store.publicImageLinkCount('new'),3)
  assert.equal(getImageTags('new').length,26)
  assert.deepEqual(Buffer.from(await (await fetch(origin+links.get('a'))).arrayBuffer()),newBytes)
  assert.equal((await fetch(origin+links.get('c'))).status,404,'revoked links must never be revived by another consolidation')
  // No artificial destination choice when untagged, unpublished copies carry nothing to transfer.
  const emptyBytes=await readFile(new URL('../fixtures/images/tiny.webp',import.meta.url)),emptyHash=hashImageBytes(emptyBytes)
  await writeFile('data/images/g.webp',emptyBytes)
  db.prepare('INSERT INTO images(id,filename,mime_type,size_bytes,created_at,content_hash,width,height) VALUES(?,?,?,?,?,?,?,?)').run('g','g.webp','image/webp',emptyBytes.length,'2026',emptyHash,1000,1500)
  const emptyVector=Array(768).fill(0);emptyVector[2]=1
  db.prepare("INSERT INTO image_duplicate_vectors VALUES(?,?,?,'ready',?)").run('g',duplicateFingerprint,emptyHash,JSON.stringify(emptyVector))
  const untagged=(await duplicateGroups(true)).find(group=>group.images.some(image=>image.id==='g'))!
  assert.equal((await owner('/api/duplicates/resolve',prepare(untagged,['e','f'],null,true))).status,200)
  assert.deepEqual(getImageTags('e'),[]);assert.deepEqual(getImageTags('f'),[])
  console.log('Duplicate group, HTTP access, consolidation, aliases, stale revisions, rollback and keep-many assertions passed')
} finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));db.close()}
