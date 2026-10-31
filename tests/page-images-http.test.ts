import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
test('page capture HTTP preserves private access, storage boundaries, provenance and remote safety',()=>{
 const root=mkdtempSync(join(tmpdir(),'visual-library-page-http-'))
 try { const run=spawnSync(process.execPath,[new URL('./helpers/page-images-http.ts',import.meta.url).pathname],{cwd:root,encoding:'utf8',timeout:20000});assert.equal(run.status,0,run.stdout+run.stderr) }
 finally {rmSync(root,{recursive:true,force:true})}
})
