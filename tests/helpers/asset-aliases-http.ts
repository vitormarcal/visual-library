import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { createApp, createRouter, defineEventHandler, getRouterParam, toNodeListener } from 'h3'
let origin = 'http://127.0.0.1'
Object.assign(globalThis, { defineEventHandler, getRouterParam, useRuntimeConfig: () => ({ ownerResetKey: '', libraryOrigin: origin, public: { maxImageSizeBytes: 15728640 } }) })
const storage = await import('../../server/db.ts')
const { ensureDataStore, enrichImageWithinTransaction, getImageTags, addTagsToImages, hashImageBytes, setImageVisibility, findAssetImage } = storage
const { duplicateFingerprint } = await import('../../runtime/similarity/duplicate-features.mjs')
const { duplicateGroups } = await import('../../server/duplicates.ts')
const store = await import('../../server/access-store.ts')
const db = await ensureDataStore()
await store.initializeOwnerAccess({ origin, resetKey: '77777777-7777-4777-8777-777777777777' })
const setup = await store.ownerAccessState()
await store.defineOwnerPassword('asset alias test password', 'asset alias test password', setup.generation)
const cookie = 'vl_owner_session=' + await store.createOwnerSession((await store.ownerPasswordHash())!)
const token = await store.createApplicationToken('Media Pulse'), publisher = await store.createApplicationToken('Blog publisher', true)
const id = (n: number) => String(n).padStart(8, '0') + '-0000-4000-8000-000000000001'
const [blog,mp,later,conflictA,conflictB,keepA,keepB,emptyRef] = [1,2,3,4,5,6,7,8].map(id) as string[]
const files = ['tiny.png','tiny.jpg','tiny.gif','tiny.webp','tiny.avif','animated.gif','animated.webp','animated.avif']
const originals = new Map<string,Buffer>()
for (let index=0;index<files.length;index++) {
  const assetId=id(index+1),file=files[index]!,bytes=await readFile(new URL('../fixtures/images/'+file,import.meta.url))
  originals.set(assetId,bytes);await writeFile(`data/images/${assetId}.image`,bytes)
  db.prepare('INSERT INTO images(id,filename,original_name,mime_type,size_bytes,created_at,content_hash,width,height,hidden_from_gallery) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(assetId,assetId+'.image',assetId===blog?'dragon-ball-vol-34-edicao-definitiva.jpg':'image','image/png',bytes.length,'2026',hashImageBytes(bytes),index===0?623:index===1?346:1200,index===0?900:index===1?500:1800,index===2?1:0)
  const vector=Array(768).fill(0);vector[index<3?0:index<5?1:2]=1
  db.prepare("INSERT INTO image_duplicate_vectors VALUES(?,?,?,'ready',?)").run(assetId,duplicateFingerprint,hashImageBytes(bytes),JSON.stringify(vector))
}
await mkdir('data/duplicates',{recursive:true});await writeFile('data/duplicates/enabled','1')
function enrich(assetId: string,application: string,entityType: string,entityId: string,tags: string[],groupTags?: string[],revision=7) {
  db.exec('BEGIN');try {
    enrichImageWithinTransaction(assetId,application,{tags,sourceReference:{entityType,entityId},managedTags:groupTags?{'book-series':{tags:groupTags,revision}}:undefined});db.exec('COMMIT')
  }catch(error){db.exec('ROLLBACK');throw error}
}
enrich(blog!,'marcal-blog','post','dragon-ball-vol-34-edicao-definitiva',['Resenha','Akira Toriyama'])
enrich(mp!,'media-pulse','book','362',['livro','Dragon Ball Vol 34'],['Old series'])
enrich(mp!,'media-pulse','book_edition','362',[],['Old series'])
addTagsToImages([mp!],['Favoritos'])
enrich(conflictA!,'media-pulse','book','999',['personal A'],['Classification A'],5)
enrich(conflictB!,'media-pulse','book','999',['personal B'],['Classification B'],5)
enrich(emptyRef!,'media-pulse','artwork','10',[])
const blogLink=(await store.publicImageLink(blog!,true))!,laterLink=(await store.publicImageLink(later!,true))!
const router=createRouter()
for(const [method,path,module] of [
  ['get','/api/duplicates','../../server/api/duplicates/index.get.ts'],
  ['post','/api/duplicates/resolve','../../server/api/duplicates/resolve.post.ts'],
  ['post','/api/assets','../../server/api/assets.post.ts'],
  ['get','/api/assets/:id','../../server/api/assets/[id].get.ts'],
  ['get','/api/assets/:id/content','../../server/api/assets/[id]/content.get.ts'],
  ['put','/api/assets/:id/references/tags','../../server/api/assets/[id]/references/tags.put.ts'],
  ['get','/api/images/:id/public-link','../../server/api/images/[id]/public-link.get.ts'],
  ['post','/api/images/:id/public-link','../../server/api/images/[id]/public-link.post.ts'],
  ['delete','/api/images/:id/public-link','../../server/api/images/[id]/public-link.delete.ts'],
  ['delete','/api/images/:id','../../server/api/images/[id].delete.ts'],
  ['get','/shared-images/:token','../../server/routes/shared-images/[token].get.ts'],
] as const) router[method](path,(await import(module)).default)
const app=createApp({debug:false});app.use((await import('../../server/middleware/access.ts')).default);app.use(router)
const server=createServer(toNodeListener(app));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`
const owner=(path:string,body?:unknown,method=body===undefined?'GET':'POST')=>fetch(origin+path,{method,headers:{cookie,origin,'x-library-request':'1','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})
const application=(path:string,body?:unknown,method=body===undefined?'GET':'PUT',publish=false)=>fetch(origin+path,{method,headers:{authorization:'Bearer '+(publish?publisher.token:token.token),'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})
const groupFor=async(assetId:string)=>(await duplicateGroups()).find(group=>group.images.some(image=>image.id===assetId))!
const resolve=(group:any,keepIds:string[],targetId:string|null=keepIds.length===1?keepIds[0]!:null)=>owner('/api/duplicates/resolve',{groupId:group.id,revision:group.revision,keepIds,targetId,broad:false})
const update=(assetId:string,entityType:string,entityId:string,tags:string[],revision:number)=>application(`/api/assets/${assetId}/references/tags`,{application:'media-pulse',entityType,entityId,group:'book-series',tags,revision})
const names=(assetId:string)=>getImageTags(assetId).map(tag=>tag.name)
const personal=(assetId:string,name:string)=>db.prepare('SELECT it.personal FROM image_tags it JOIN tags t ON t.id=it.tag_id WHERE it.image_id=? AND t.name=?').get(assetId,name)!.personal
const snapshot=()=>JSON.stringify(['images','image_tags','asset_references','asset_reference_tag_groups','asset_id_aliases','image_public_links','image_public_link_aliases','duplicate_reviews'].map(table=>db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()))
try {
  const oldResponse=await application(`/api/assets/${mp}/content`),oldEtag=oldResponse.headers.get('etag')!,oldModified=oldResponse.headers.get('last-modified')!
  assert.equal(oldResponse.status,200)
  assert.equal((await resolve(await groupFor(mp!),[blog!])).status,200)
  assert.equal(findAssetImage(mp!)!.id,blog)
  await assert.rejects(access(`data/images/${mp}.image`))
  assert.equal((await fetch(origin+`/api/assets/${mp}`)).status,401)
  const metadata=await(await application(`/api/assets/${mp}`)).json()
  assert.equal(metadata.id,mp);assert.equal(metadata.sizeBytes,originals.get(blog!)!.length)
  assert.equal(metadata.sourceReferences.length,3)
  assert.ok(names(blog!).includes('Favoritos'));assert.equal(personal(blog!,'Old series'),0)
  const inherited=await application(`/api/assets/${mp}/content`)
  assert.deepEqual(Buffer.from(await inherited.arrayBuffer()),originals.get(blog!))
  assert.notEqual(inherited.headers.get('etag'),oldEtag)
  assert.equal((await fetch(origin+`/api/assets/${mp}/content`,{headers:{authorization:'Bearer '+token.token,'if-none-match':oldEtag}})).status,200)
  assert.equal((await fetch(origin+`/api/assets/${mp}/content`,{headers:{authorization:'Bearer '+token.token,'if-none-match':inherited.headers.get('etag')!}})).status,304)
  assert.equal((await fetch(origin+`/api/assets/${mp}/content`,{headers:{authorization:'Bearer '+token.token,'if-modified-since':oldModified}})).status,200,'an old modification date must not mask the changed alias target')
  assert.equal((await update(mp!,'book','362',['New series'],8)).status,200)
  assert.ok(names(blog!).includes('Old series'),'edition contribution still owns this tag')
  assert.equal((await update(mp!,'book_edition','362',['New series'],8)).status,200)
  assert.ok(!names(blog!).includes('Old series'));assert.ok(names(blog!).includes('Favoritos'))
  assert.equal(personal(blog!,'New series'),0)
  const publish=await application(`/api/images/${mp}/public-link`,{},'POST',true)
  assert.equal(publish.status,200);assert.equal((await publish.json()).url,origin+blogLink)
  assert.equal((await application(`/api/images/${mp}/public-link`,{},'POST')).status,403)
  // A new consolidation retargets both the original ID and all older aliases directly.
  setImageVisibility(later!,false)
  let next=await groupFor(blog!)
  assert.equal((await update(mp!,'book','362',['New series'],9)).status,200)
  assert.equal((await resolve(next,[later!])).status,409,'a classification revision alone invalidates the open review')
  next=await groupFor(blog!)
  const before=snapshot()
  db.exec(`CREATE TRIGGER fail_alias_delete BEFORE DELETE ON images WHEN OLD.id='${blog}' BEGIN SELECT RAISE(ABORT,'alias rollback'); END`)
  assert.equal((await resolve(next,[later!])).status,500)
  assert.equal(snapshot(),before);assert.equal(findAssetImage(mp!)!.id,blog)
  assert.deepEqual(Buffer.from(await(await fetch(origin+blogLink)).arrayBuffer()),originals.get(blog!))
  db.exec('DROP TRIGGER fail_alias_delete')
  assert.equal((await resolve(next,[later!])).status,200)
  assert.equal(findAssetImage(mp!)!.id,later);assert.equal(findAssetImage(blog!)!.id,later)
  assert.ok(db.prepare('SELECT image_id FROM asset_id_aliases').all().every(row=>row.image_id===later))
  assert.deepEqual(Buffer.from(await(await application(`/api/assets/${mp}/content`)).arrayBuffer()),originals.get(later!))
  assert.deepEqual(Buffer.from(await(await fetch(origin+blogLink)).arrayBuffer()),originals.get(later!))
  assert.equal((await update(mp!,'book_edition','362',['New series'],9)).status,200)
  assert.equal((await(await application(`/api/assets/${blog}`)).json()).id,blog)
  const share=await(await owner(`/api/images/${mp}/public-link`)).json()
  assert.equal(share.url,origin+laterLink);assert.equal(share.count,2)
  assert.equal((await owner(`/api/images/${mp}/public-link`,undefined,'DELETE')).status,200)
  assert.equal((await fetch(origin+blogLink)).status,404);assert.equal((await fetch(origin+laterLink)).status,404)
  const newLink=(await(await application(`/api/images/${mp}/public-link`,{},'POST',true)).json()).url
  assert.notEqual(newLink,origin+blogLink);assert.notEqual(newLink,origin+laterLink)
  // Same revision, different classifications: no metadata or identity may be lost.
  let collision=await groupFor(conflictA!),collisionBefore=snapshot()
  const blocked=await resolve(collision,[conflictA!]);assert.equal(blocked.status,409)
  assert.equal((await blocked.json()).data.code,'REFERENCE_REVISION_CONFLICT')
  assert.equal(snapshot(),collisionBefore);assert.equal(findAssetImage(conflictB!)!.id,conflictB)
  assert.equal((await update(conflictB!,'book','999',['Classification B'],6)).status,200)
  collision=await groupFor(conflictA!)
  assert.equal((await resolve(collision,[conflictA!])).status,200)
  assert.equal(personal(conflictA!,'Classification A'),1,'obsolete displayed tags are absorbed as personal')
  assert.equal(personal(conflictA!,'Classification B'),0,'current classification keeps its provenance')
  assert.equal((await update(conflictB!,'book','999',['Classification B'],5)).status,409)
  const currentSnapshot=snapshot()
  assert.equal((await update(conflictB!,'book','999',['Classification B'],6)).status,200);assert.equal(snapshot(),currentSnapshot)
  assert.equal((await update(conflictB!,'book','999',['Different'],6)).status,409)
  assert.equal((await update(conflictB!,'book','999',['Next classification'],7)).status,200)
  assert.ok(!names(conflictA!).includes('Classification B'));assert.ok(names(conflictA!).includes('Classification A'))
  // References require an explicit destination when keeping several, even without tags/URLs.
  const many=await groupFor(emptyRef!)
  assert.equal((await resolve(many,[keepA!,keepB!],null)).status,400)
  assert.equal((await resolve(many,[keepA!,keepB!],keepB!)).status,200)
  assert.equal(findAssetImage(emptyRef!)!.id,keepB)
  assert.equal(storage.getAssetReferences(keepA!).length,0);assert.equal(storage.getAssetReferences(keepB!).length,1)
  // Reupload still honors exact-byte verification in Media Pulse's local migration.
  const form=new FormData();form.append('image',new Blob([originals.get(mp!)!]),'old.jpg');form.append('source','media-pulse');form.append('sourceReference',JSON.stringify({entityType:'book',entityId:'362'}))
  const reupload=await fetch(origin+'/api/assets',{method:'POST',headers:{authorization:'Bearer '+token.token},body:form})
  assert.equal(reupload.status,201);const recreated=await reupload.json();assert.notEqual(recreated.id,mp)
  assert.deepEqual(Buffer.from(await(await application(`/api/assets/${recreated.id}/content`)).arrayBuffer()),originals.get(mp!))
  // Normal deletion of a canonical asset invalidates its old IDs as well.
  assert.equal((await owner(`/api/images/${conflictA}`,undefined,'DELETE')).status,200)
  assert.equal((await application(`/api/assets/${conflictB}`)).status,404)
  assert.equal((await application(`/api/assets/${conflictB}/content`)).status,404)
  assert.equal((await update(conflictB!,'book','999',[],8)).status,404)
  assert.equal(db.prepare('SELECT 1 FROM asset_id_aliases WHERE alias_id=?').get(conflictB!),undefined)
  // Equivalent classifications at the same revision may differ in order/case.
  const sameA=id(9),sameB=id(10)
  for(const [assetId,bytes] of [[sameA,originals.get(conflictA!)!],[sameB,originals.get(conflictB!)!]] as const) {
    await writeFile(`data/images/${assetId}.image`,bytes)
    db.prepare('INSERT INTO images(id,filename,mime_type,size_bytes,created_at,content_hash,width,height) VALUES(?,?,?,?,?,?,?,?)').run(assetId,assetId+'.image','image/png',bytes.length,'2026',hashImageBytes(bytes),1000,1500)
    const values=Array(768).fill(0);values[3]=1
    db.prepare("INSERT INTO image_duplicate_vectors VALUES(?,?,?,'ready',?)").run(assetId,duplicateFingerprint,hashImageBytes(bytes),JSON.stringify(values))
  }
  enrich(sameA,'media-pulse','book','123',['personal same A'],['Series One','Series Two'],3)
  enrich(sameB,'media-pulse','book','123',['personal same B'],['series two','SERIES ONE'],3)
  assert.equal((await resolve(await groupFor(sameA),[sameA])).status,200)
  const sameMetadata=await(await application(`/api/assets/${sameB}`)).json()
  assert.deepEqual(sameMetadata.sourceReferences[0].managedTags['book-series'],{tags:['Series One','Series Two'],revision:3})
  const sameBefore=snapshot()
  assert.equal((await update(sameB,'book','123',['series two','SERIES ONE'],3)).status,200)
  assert.equal(snapshot(),sameBefore)
  console.log('Asset-ID alias HTTP, provenance, conflicts, retries, rollback, repeated consolidation and public link assertions passed')
} finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));db.close()}
