import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'
let origin = 'http://127.0.0.1', limit = 15728640
Object.assign(globalThis, { defineEventHandler, useRuntimeConfig: () => ({ ownerResetKey: '', libraryOrigin: origin, public: { maxImageSizeBytes: limit } }) })
const { ensureDataStore, getAssetReferences, getImageTags } = await import('../../server/db.ts')
const store = await import('../../server/access-store.ts')
const db = await ensureDataStore()
await store.initializeOwnerAccess({ resetKey: '12345678-1234-4123-8123-123456789012', origin })
const state = await store.ownerAccessState()
await store.defineOwnerPassword('test password for page capture', 'test password for page capture', state.generation)
const session = await store.createOwnerSession((await store.ownerPasswordHash())!)
const token = await store.createApplicationToken('page test')
const router = createRouter()
for (const [path,file] of [['/api/capture-url','capture-url.post.ts'],['/api/page-image-preview','page-image-preview.post.ts'],['/api/images','images.post.ts']]) router.post(path!, (await import(new URL('../../server/api/'+file,import.meta.url).href)).default)
const app=createApp({debug:false});app.use((await import('../../server/middleware/access.ts')).default);app.use(router)
const server=createServer(toNodeListener(app));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r))
origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`
const originalFetch=globalThis.fetch
const png=await readFile(new URL('../fixtures/images/tiny.png',import.meta.url)), jpg=await readFile(new URL('../fixtures/images/tiny.jpg',import.meta.url))
const html=await readFile(new URL('../fixtures/pages/pulp-black-cats.html',import.meta.url),'utf8')
let hits=0
// Only remote transport is replaced; requests into H3 and auth middleware use real HTTP.
globalThis.fetch=(async(input,options)=>{
 const url=new URL(String(input));if(url.origin===origin)return originalFetch(input,options)
 hits++
 if(url.pathname==='/redirect')return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})
 if(url.pathname==='/too-large')return new Response(new Uint8Array(2*1024*1024+1),{headers:{'content-type':'text/html'}})
 if(url.pathname==='/slow') { await new Promise((_,reject)=>options?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})); throw Error('unreachable') }
 if(url.pathname==='/svg')return new Response('<svg xmlns="http://www.w3.org/2000/svg"/>',{headers:{'content-type':'image/svg+xml'}})
 if(url.pathname==='/post')return new Response(html,{headers:{'content-type':'text/html;charset=utf-8'}})
 if(url.pathname==='/unavailable')return new Response('sign in',{status:403})
 return new Response(url.pathname.endsWith('.jpg')?jpg:png,{headers:{'content-type':'image/png'}})
}) as typeof fetch
const request=(path:string,body:unknown,headers:Record<string,string>={})=>originalFetch(origin+path,{method:'POST',headers:{origin,'x-library-request':'1','content-type':'application/json',cookie:`vl_owner_session=${session}`,...headers},body:JSON.stringify(body)})
try {
 for(const path of ['/api/capture-url','/api/page-image-preview']){
  assert.equal((await request(path,{url:'http://8.8.8.8/post'},{cookie:''})).status,401)
  assert.equal((await request(path,{url:'http://8.8.8.8/post'},{authorization:`Bearer ${token.token}`})).status,403)
  assert.equal((await request(path,{url:'http://8.8.8.8/post'},{origin:'https://evil.example'})).status,403)
  assert.equal((await request(path,{url:'http://8.8.8.8/post'},{'x-library-request':''})).status,403)
 }
 const discovered=await request('/api/capture-url',{url:'http://8.8.8.8/post',tags:['cats']});assert.equal(discovered.status,200)
 const page=await discovered.json();assert.equal(page.kind,'page');assert.equal(page.candidates.length,30)
 assert.equal(db.prepare('SELECT count(*) as n FROM images').get()!.n,0);assert.deepEqual(await readdir('data/images'),[])
 const preview=await request('/api/page-image-preview',{url:'http://8.8.8.8/a.png'});assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'image/png');assert.equal(preview.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await preview.arrayBuffer()),png)
 assert.equal(db.prepare('SELECT count(*) as n FROM images').get()!.n,0)
 const saved=await request('/api/images',{url:'http://8.8.8.8/a.png',pageUrl:page.pageUrl,tags:['cats']});assert.equal(saved.status,200)
 const image=await saved.json();assert.equal(getAssetReferences(image.id)[0]!.url,'http://8.8.8.8/post');assert.equal(getImageTags(image.id)[0]!.name,'cats')
 assert.equal(db.prepare('SELECT source_url FROM images WHERE id=?').get(image.id)!.source_url,'http://8.8.8.8/a.png')
 const duplicate=await request('/api/images',{url:'http://8.8.8.8/a.png',pageUrl:'http://8.8.8.8/another',tags:['changed']});assert.equal((await duplicate.json()).duplicate,true)
 assert.equal(getAssetReferences(image.id).length,1);assert.deepEqual(getImageTags(image.id).map(t=>t.name),['cats'])
 const before=hits;const direct=await request('/api/capture-url',{url:'http://8.8.8.8/a.jpg',tags:[]});assert.equal((await direct.json()).kind,'image');assert.equal(hits,before+1)
 for(const url of ['http://127.0.0.1/private','http://[::1]/private','http://user:password@8.8.8.8/a','file:///tmp/secret','http://8.8.8.8/redirect'])assert.ok((await request('/api/capture-url',{url})).status>=400,url)
 assert.equal((await request('/api/capture-url',{url:'http://8.8.8.8/too-large'})).status,413)
 assert.equal((await request('/api/capture-url',{url:'http://8.8.8.8/slow'})).status,408)
 assert.equal((await request('/api/capture-url',{url:'http://8.8.8.8/unavailable'})).status,502)
 for(const url of ['http://8.8.8.8/post','http://8.8.8.8/svg'])assert.equal((await request('/api/page-image-preview',{url})).status,415)
 limit=10;assert.equal((await request('/api/page-image-preview',{url:'http://8.8.8.8/a.png'})).status,413)
 console.log('Page discovery, private previews, provenance, duplicates, access and transport bounds passed')
}finally{globalThis.fetch=originalFetch;const {remoteImageDispatcher}=await import('../../server/image-url.ts');await remoteImageDispatcher.destroy();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));db.close()}
