import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('duplicate preparation is opt-in, coalesces jobs, retries failures and hooks only successful captures', () => {
  const root = mkdtempSync(join(tmpdir(), 'visual-library-duplicate-lifecycle-'))
  try {
    const script = `
      import assert from 'node:assert/strict';
      import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
      const {ensureDataStore}=await import(${JSON.stringify(new URL('../server/db.ts', import.meta.url).href)});
      const {duplicateFingerprint}=await import(${JSON.stringify(new URL('../runtime/similarity/duplicate-features.mjs', import.meta.url).href)});
      const preparation=await import(${JSON.stringify(new URL('../server/duplicate-preparation.ts', import.meta.url).href)});
      const db=await ensureDataStore();
      const add=id=>db.prepare('INSERT INTO images (id,filename,mime_type,size_bytes,created_at,content_hash) VALUES (?,?,?,?,?,?)').run(id,id+'.png','image/png',1,'2026',id);
      await mkdir('runtime/similarity',{recursive:true});
      add('a');add('b');
      assert.equal(preparation.duplicatesEnabled(),false);
      await preparation.prepareDuplicates();
      assert.equal(preparation.duplicatesPreparing(),false);
      await assert.rejects(access('data/duplicates/enabled'));
      const stub = (fail=false)=>writeFile('runtime/similarity/duplicate-worker.mjs',
        \`import {DatabaseSync} from 'node:sqlite';import{appendFileSync}from'node:fs';
        appendFileSync('runs','1\\\\n');
        await new Promise(r=>setTimeout(r,100));
        if(\${fail})process.exit(1);
        const db=new DatabaseSync('data/library.sqlite');
        for(const row of db.prepare('SELECT id,content_hash FROM images WHERE hidden_from_gallery=0').all())
          db.prepare('INSERT OR REPLACE INTO image_duplicate_vectors VALUES (?,?,?,?,?)').run(row.id,'\${duplicateFingerprint}',row.content_hash,row.id==='broken'?'failed':'ready',row.id==='broken'?null:JSON.stringify([1,...Array(767).fill(0)]));
        db.close();\`);
      const wait=async()=>{for(let i=0;i<300;i++){if(!preparation.duplicatesPreparing())return;await new Promise(r=>setTimeout(r,10))}throw Error('worker did not stop')};
      await stub();
      await Promise.all([preparation.activateDuplicates(),preparation.prepareDuplicates(),preparation.prepareDuplicates()]);
      await wait();
      assert.equal((await readFile('runs','utf8')).trim(),'1');
      assert.equal((await preparation.duplicateProgress()).preparedCount,2);
      add('broken');await preparation.prepareDuplicates();await wait();
      assert.equal((await preparation.duplicateProgress()).failedCount,1);
      const count=async()=>(await readFile('runs','utf8')).trim().split('\\n').length;
      const before=await count();await preparation.prepareDuplicates();await wait();assert.equal(await count(),before);
      await preparation.activateDuplicates();await wait();assert.equal(await count(),before+1);
      add('c');await stub(true);await preparation.prepareDuplicates();await wait();
      assert.equal(preparation.duplicatesUnavailable(),true);
      const paused=await count();await preparation.prepareDuplicates();assert.equal(await count(),paused);
      await stub();await preparation.activateDuplicates();await wait();
      assert.equal(preparation.duplicatesUnavailable(),false);
      assert.equal((await preparation.duplicateProgress()).pendingCount,0);
      let after;let close;
      globalThis.defineNitroPlugin=fn=>fn;
      const plugin=(await import(${JSON.stringify(new URL('../server/plugins/duplicates.ts', import.meta.url).href)})).default;
      plugin({hooks:{hook(name,callback){if(name==='afterResponse')after=callback;if(name==='close')close=callback}}});
      add('shared');
      const event=(path,created,status=303)=>({path,method:'POST',context:{sharedImagesCreated:created},node:{res:{statusCode:status}}});
      const calls=await count();after(event('/share',false));after(event('/share',true,500));
      await new Promise(r=>setTimeout(r,30));assert.equal(await count(),calls);
      after(event('/share',true));await new Promise(r=>setTimeout(r,30));await wait();
      assert.equal(await count(),calls+1);
      assert.equal((await preparation.duplicateProgress()).pendingCount,0);
      close();preparation.stopDuplicatePreparation();db.close();
    `
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8', timeout: 15_000 })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
