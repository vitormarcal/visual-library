import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createApp, createRouter, defineEventHandler, getRouterParam, toNodeListener, type H3Event } from 'h3'
import { ensureDataStore, deleteImageRecord, setImageVisibility, replaceImageTags } from '../../server/db.ts'
import { semanticFingerprint } from '../../runtime/similarity/semantic-features.mjs'
import { stopSemanticPreparation } from '../../server/semantic-preparation.ts'
import { semanticRows } from '../../server/semantic-store.ts'
Object.assign(globalThis, { defineEventHandler, getRouterParam, defineNitroPlugin: (fn: unknown) => fn, useRuntimeConfig: () => ({ public: { maxImageSizeBytes: 4096 } }) })
const db = await ensureDataStore()
await mkdir('runtime/similarity', { recursive: true })
const features = new URL('../../runtime/similarity/semantic-features.mjs', import.meta.url).href
await writeFile('runtime/similarity/semantic-worker.mjs', `
import {mkdir,writeFile,appendFile} from 'node:fs/promises';import {existsSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';import {semanticFingerprint,semanticPolicy} from ${JSON.stringify(features)};
const db=new DatabaseSync('data/library.sqlite');db.exec('PRAGMA busy_timeout=5000');let chain=Promise.resolve();
process.on('message',m=>{chain=chain.then(async()=>{
 await appendFile('worker-events.jsonl',JSON.stringify({type:m.type,text:m.text})+'\\n');
 if(m.type==='prepare'){
 const root='data/semantic/models/'+semanticPolicy.model+'/'+semanticPolicy.revision;await mkdir(root+'/onnx',{recursive:true});
 for(const name of ['config.json','preprocessor_config.json','tokenizer.json','tokenizer_config.json','onnx/vision_model_quantized.onnx','onnx/text_model_quantized.onnx'])await writeFile(root+'/'+name,'test stub');
 const rows=db.prepare('SELECT * FROM images WHERE hidden_from_gallery=0').all();
 for(const row of rows){const old=db.prepare('SELECT * FROM image_semantic_vectors WHERE image_id=? AND fingerprint=?').get(row.id,semanticFingerprint);if(old&&old.source_hash===row.content_hash)continue;
 const failed=row.id==='bad'&&!existsSync('repair-bad');const v=Array(768).fill(0);v[row.id==='blue'?1:0]=1;
 db.prepare('INSERT OR REPLACE INTO image_semantic_vectors VALUES (?,?,?,?,?)').run(row.id,semanticFingerprint,row.content_hash,failed?'failed':'ready',failed?null:JSON.stringify(v));}
 process.send({id:m.id,prepared:true});
 }else{await new Promise(r=>setTimeout(r,100));if(m.text==='fail-model'){process.send({id:m.id,error:'model-unavailable'});return}const v=Array(768).fill(0);v[m.text==='blue'?1:0]=1;process.send({id:m.id,vector:v});}
 }).catch(()=>process.exit(1))});process.on('SIGTERM',()=>{db.close();process.exit(0)});process.on('disconnect',()=>process.exit(0));
`)
const hooks = new Map<string, (event?: H3Event) => void>()
;(await import('../../server/plugins/semantic-search.ts')).default({ hooks: { hook: (name: string, fn: (event?: H3Event) => void) => hooks.set(name, fn) } })
const router = createRouter()
router.get('/api/search/content/status', (await import('../../server/api/search/content/status.get.ts')).default)
router.post('/api/search/content/prepare', (await import('../../server/api/search/content/prepare.post.ts')).default)
router.post('/api/search/content', (await import('../../server/api/search/content.post.ts')).default)
router.post('/api/images', (await import('../../server/api/images.post.ts')).default)
router.post('/share', (await import('../../server/routes/share.post.ts')).default)
const app = createApp({ debug: false, onAfterResponse: event => hooks.get('afterResponse')?.(event) }); app.use(router)
const server = createServer(toNodeListener(app))
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
const status = async () => (await fetch(base + '/api/search/content/status')).json()
const post = (path: string, body?: unknown) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
const search = (query = 'red', tagIds: string[] = []) => post('/api/search/content', { query, tagIds })
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const ready = async () => { for (let i = 0; i < 200; i++) { const s = await status(); if (s.state === 'ready') return s; await sleep(10) } throw new Error('Preparation timed out') }
const add = (id: string, hidden = 0) => db.prepare(`INSERT INTO images (id,filename,mime_type,size_bytes,created_at,content_hash,hidden_from_gallery) VALUES (?,?,'image/png',1,'2020-01-01',?,?)`).run(id,id+'.png',id,hidden)
try {
  for (let i = 0; i < 30; i++) add(`high-${String(i).padStart(2,'0')}`)
  add('blue'); add('bad'); add('hidden',1)
  replaceImageTags('blue',['Blue'])
  const blueTag = (db.prepare("SELECT id FROM tags WHERE name='Blue'").get() as { id: string }).id
  assert.equal((await status()).state,'inactive')
  assert.equal((await (await search()).json()).state,'inactive')
  await sleep(1600)
  assert.ok(!existsSync('worker-events.jsonl'),'startup and inactive search must not load a model')
  for (const body of [null,{}, {query:''},{query:'x'.repeat(501)},{query:'q',tagIds:['1','2','3','4']},{query:'q',tagIds:[1]}]) assert.equal((await post('/api/search/content',body)).status,400)
  assert.equal((await fetch(base+'/api/search/content',{method:'POST',body:'{'})).status,400)
  await post('/api/search/content/prepare')
  const progress = await ready(); assert.equal(progress.preparedCount,31); assert.equal(progress.failedCount,1)
  const all = await search(); assert.equal(all.headers.get('cache-control'),'no-store')
  const result = await all.json(); assert.equal(result.images.length,24); assert.ok(!JSON.stringify(result).includes('vector_json'))
  assert.ok(!result.images.some((i: {id:string})=>['hidden','bad','blue'].includes(i.id)))
  const filtered = await (await search('red',[blueTag])).json()
  assert.deepEqual(filtered.images.map((i: {id:string})=>i.id),['blue'],'filters must run before top 24')
  assert.deepEqual((await (await search('red',['missing-tag'])).json()).images,[])
  await Promise.all([search('same-text'),search('same-text')])
  const events = (await readFile('worker-events.jsonl','utf8')).trim().split('\n').map(line=>JSON.parse(line))
  assert.equal(events.filter(e=>e.type==='query'&&e.text==='same-text').length,1)
  const racing = search('visibility-race')
  await sleep(30);setImageVisibility('high-00',true);deleteImageRecord('high-01')
  const after = await (await racing).json()
  assert.ok(!after.images.some((i:{id:string})=>['high-00','high-01'].includes(i.id)))
  assert.equal(db.prepare('SELECT * FROM image_semantic_vectors WHERE image_id=?').get('high-01'),undefined)
  db.prepare('UPDATE images SET content_hash=? WHERE id=?').run('new-hash','high-02')
  assert.equal((await semanticRows()).find(row=>row.id==='high-02')!.vector_status,null)
  await ready()
  await writeFile('repair-bad','1');await post('/api/search/content/prepare');assert.equal((await ready()).failedCount,0)
  assert.equal((await (await search('fail-model')).json()).state,'unavailable')
  assert.equal((await status()).state,'unavailable')
  const capture = new FormData();capture.append('image',new Blob([await readFile(new URL('../fixtures/images/tiny.jpg',import.meta.url))]),'during-unavailable.jpg')
  assert.equal((await fetch(base+'/api/images',{method:'POST',body:capture})).status,200,'capture must survive model failure')
  assert.ok(db.prepare("SELECT id FROM images WHERE original_name='during-unavailable.jpg'").get())
  await post('/api/search/content/prepare');await ready()
  const share = new FormData();share.append('image',new Blob([await readFile(new URL('../fixtures/images/tiny.png',import.meta.url))]),'share.png')
  const shared = await fetch(base+'/share',{method:'POST',body:share,redirect:'manual'});assert.equal(shared.status,303);await shared.arrayBuffer()
  await ready()
  const latest = db.prepare("SELECT id FROM images WHERE original_name='share.png'").get() as {id:string}
  assert.equal(db.prepare('SELECT status FROM image_semantic_vectors WHERE image_id=?').get(latest.id)!.status,'ready')
  console.log('Content search HTTP and lifecycle passed')
} finally { hooks.get('close')?.(); stopSemanticPreparation(); await new Promise<void>(resolve=>server.close(()=>resolve())); db.close() }
