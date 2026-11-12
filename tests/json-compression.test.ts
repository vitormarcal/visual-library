import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { createApp, defineEventHandler, toNodeListener } from 'h3'
import { gunzipSync } from 'node:zlib'
import { request } from 'node:http'
import { compressLibraryJson } from '../server/json-compression.ts'

test('catalog compression negotiates gzip, preserves bytes, excludes credentials and existing encodings', async () => {
  const body = { images: Array.from({length:100},(_,n)=>({id:n,name:'reference image repeated'})) }
  const app = createApp({onBeforeResponse:compressLibraryJson})
  app.use(defineEventHandler(event=>{ event.context.accessIdentity='owner'; if(event.path==='/api/library/encoded')event.node.res.setHeader('Content-Encoding','br'); return body }))
  const server = createServer(toNodeListener(app)); await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  const port=(server.address() as {port:number}).port
  const call=(path:string,encoding:string)=>new Promise<{headers:Record<string,unknown>;bytes:Buffer}>(resolve=>{
    request({host:'127.0.0.1',port,path,headers:{'Accept-Encoding':encoding}},r=>{const chunks:Buffer[]=[];r.on('data',c=>chunks.push(c));r.on('end',()=>resolve({headers:r.headers,bytes:Buffer.concat(chunks)}))}).end()
  })
  try {
    const zipped=await call('/api/library/images','gzip')
    assert.equal(zipped.headers['content-encoding'],'gzip');assert.match(String(zipped.headers.vary),/Accept-Encoding/)
    assert.deepEqual(JSON.parse(gunzipSync(zipped.bytes).toString()),body)
    assert.ok(zipped.bytes.length<Buffer.byteLength(JSON.stringify(body))*.25)
    for(const encoding of ['identity','gzip;q=0','gzip;q=0, *;q=1'])assert.equal((await call('/api/library/images',encoding)).headers['content-encoding'],undefined)
    assert.equal((await call('/api/library/images','*;q=0.5')).headers['content-encoding'],'gzip')
    assert.equal((await call('/api/auth/session','gzip')).headers['content-encoding'],undefined)
    assert.equal((await call('/api/images/id/public-link','gzip')).headers['content-encoding'],undefined)
    assert.equal((await call('/api/library/encoded','gzip')).headers['content-encoding'],'br')
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())) }
})
