import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { discoverPageImages } from '../server/page-images.ts'
import { createPreviewQueue, savePageImageBatch } from '../app/utils/page-image-selection.ts'
const page = 'https://pulpinternational.com/pulp/entry/photos-of-celebrities-with-black-cats/'
test('Pulp reference extracts 30 article photos once in order, at declared original resolution', () => {
  const result = discoverPageImages(readFileSync(new URL('./fixtures/pages/pulp-black-cats.html', import.meta.url), 'utf8'), page)
  assert.equal(result.fallback, false); assert.equal(result.candidates.length, 30)
  assert.deepEqual(result.candidates.map(c => new URL(c.url).pathname.split('/').pop()), Array.from({ length: 30 }, (_, i) => `meow-mix-${String(i + 1).padStart(2, '0')}.${i === 4 || i === 10 ? 'png' : 'jpg'}`))
})
test('relative/base URLs, entities, picture sizes and explicit linked originals preserve order', () => {
  const { candidates } = discoverPageImages(`<base href="https://cdn.example.org/art/"><main>
    <picture><source media="(max-width: 400px)" srcset="crop.jpg 400w"><source srcset="one.webp 600w, one-large.webp 1200w"><img src="one.jpg" width="600"></picture>
    <a href="two-original.jpg"><img data-src="two.jpg"></a><img src="three.jpg?a=1&amp;b=2">
    <img src="https://cdn.example.org/art/three.jpg?a=1&amp;b=2"><img src="data:image/svg+xml,no"><img src="" />
    <aside><img src="ad.jpg"></aside><img src="tiny.png" width="20" height="20"><img src="javascript:alert(1)"></main>`, page)
  assert.deepEqual(candidates.map(c => c.url), ['https://cdn.example.org/art/one-large.webp', 'https://cdn.example.org/art/two-original.jpg', 'https://cdn.example.org/art/three.jpg?a=1&b=2'])
})
test('fallback, noscript, malformed HTML, density descriptors and bounds are explicit', () => {
  assert.equal(discoverPageImages('<p>empty', page).candidates.length, 0)
  const result = discoverPageImages('<img src="a.jpg" srcset="a.jpg 1x, b.jpg 2x"><noscript><img src="b.jpg"></noscript>', page)
  assert.equal(result.fallback, true); assert.equal(result.candidates.length, 1); assert.ok(result.candidates[0]!.url.endsWith('/b.jpg'))
  assert.throws(() => discoverPageImages('<main>' + Array.from({length:201},(_,i)=>`<img src="/${i}.jpg">`).join(''), page), /too many images/)
})
test('URL batch preserves successes and permanent failures while retrying recoverable failures only', async () => {
  const items = ['a', 'b', 'c', 'd'].map(id => ({ id, url: `https://example.org/${id}.jpg`, width: null, height: null }))
  const calls: string[] = [], done: string[] = []
  const first = await savePageImageBatch(items, async item => { calls.push(item.id); if(item.id==='b') return 'duplicate'; if(item.id==='c') throw {statusCode:503}; if(item.id==='d') throw {statusCode:415}; return 'saved' },()=>{}, item=>done.push(item.id))
  assert.deepEqual(done,['a','b']); assert.equal(first.saved,1); assert.equal(first.duplicates,1)
  const retry = first.failures.filter(f=>f.retryable).map(f=>f.file)
  const result = await savePageImageBatch(retry,async item=>{calls.push(item.id);return 'saved'},()=>{},item=>done.push(item.id),first)
  assert.deepEqual(calls,['a','b','c','d','c']); assert.equal(result.saved,2); assert.equal(result.duplicates,1);assert.equal(result.failures[0]!.file.id,'d')
})
test('preview queue bounds concurrency, skips cancelled waiters and releases slots after failures', async () => {
  const queue = createPreviewQueue(2), signal = new AbortController().signal
  let active=0, max=0; const releases: (()=>void)[]=[]
  const task=()=>queue(signal,async()=>{ active++;max=Math.max(max,active); await new Promise<void>(r=>releases.push(r));active-- })
  const a=task(),b=task(); const abort=new AbortController()
  let cancelledStarted=false
  const cancelled=queue(abort.signal,async()=>{cancelledStarted=true}); const rejected=assert.rejects(cancelled,/Aborted/);abort.abort()
  const c=task();assert.equal(active,2);releases.shift()!();await a;await new Promise(r=>setTimeout(r,0));assert.equal(active,2)
  releases.shift()!();releases.shift()!();await Promise.all([b,c,rejected]);assert.equal(max,2);assert.equal(cancelledStarted,false)
  await assert.rejects(queue(signal,async()=>{throw Error('failure')}),/failure/)
  assert.equal(await queue(signal,async()=>42),42)
})
