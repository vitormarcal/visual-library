import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync, mkdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { duplicateComponents, duplicatePairs, duplicateVector, duplicateDigest } from '../runtime/similarity/duplicate-features.mjs'
import { duplicateResize } from '../runtime/similarity/duplicate-resize.mjs'
import { suggestedDuplicateKeeps } from '../app/utils/duplicate-review.ts'
import { libraryDestination, libraryDestinationUrl, parseLibraryDestination } from '../app/utils/library-navigation.ts'

test('RGB preprocessing matches independent Pillow 10.2 bicubic golden outputs for up/down/mixed/identity resizes', () => {
  // Golden SHA-256 values were generated with Pillow on Mordor, not this implementation.
  const cases = [
    [7,9,'268822700160abf195d27d06117ada1c22cd32c6a7b17fbb98cff5735ff9201b'],
    [480,640,'47e3c4e1b6664303bd9c7fbc3825b5e2d875f317b753ce33cbc545b68b675bf1'],
    [333,157,'4e15238aba472683aabd102c10919c6fca508b3772c20681a57f9bb295d4b1f4'],
    [224,224,'37bba63e7e10e1cd1e7fca65b38692e8f95e49691ca02e43360ff4845361de1e'],
  ] as const
  for (const [width,height,hash] of cases) {
    const input = Uint8Array.from({ length: width * height * 3 }, (_, i) => (i * 37 + Math.floor(i / 97) * 11) % 256)
    assert.equal(duplicateDigest(duplicateResize(input,width,height)),hash)
  }
})

test('duplicate vectors use cosine distance and components do not repeat images', () => {
  const vector = (x: number, y = 0) => [x, y, ...Array(766).fill(0)]
  const pairs = duplicatePairs([{ id: 'a', vector: vector(2) }, { id: 'b', vector: vector(3) }, { id: 'c', vector: vector(.95, .312) }])
  assert.deepEqual(duplicateComponents(pairs, .03), [['a', 'b']])
  assert.deepEqual(duplicateComponents(pairs, .1), [['a', 'b', 'c']])
  assert.throws(() => duplicateVector(Array(768).fill(0)))
  assert.throws(() => duplicateVector(Array(768).fill(true)))
  assert.throws(() => duplicateVector(Array(768).fill(NaN)))
})

test('suggestions keep technical ties, crops, missing dimensions and integration references', () => {
  const image = (id: string, width: number | null, height: number | null, sizeBytes = 100) => ({ id, width, height, sizeBytes, publicLinkCount: 0, integrationReferenceCount: 0 }) as any
  const high = image('high', 2000, 3000), low = image('low', 1000, 1500), crop = image('crop', 1600, 1600)
  assert.deepEqual(new Set(suggestedDuplicateKeeps([high, low, crop])), new Set(['high', 'crop']))
  assert.equal(suggestedDuplicateKeeps([high, { ...high, id: 'tie' }]).length, 2)
  assert.equal(suggestedDuplicateKeeps([high, { ...low, integrationReferenceCount: 1 }]).length, 2)
  assert.equal(suggestedDuplicateKeeps([high, low], true).length, 2)
  assert.equal(suggestedDuplicateKeeps([high, image('missing', null, null)]).length, 2)
})

test('duplicate group and mode round-trip through the existing navigation', () => {
  const destination = { ...libraryDestination('duplicates'), referenceId: 'a'.repeat(64), reviewMode: 'broad' as const }
  assert.deepEqual(parseLibraryDestination(new URL(libraryDestinationUrl(destination), 'http://library.local')), destination)
  for (const query of ['?view=duplicates&image=x', '?view=duplicates&tag=x', '?view=duplicates&q=x', '?view=duplicates&reference=', '?view=duplicates&reference=bad', '?view=library&review=broad', '?view=duplicates&review=other']) {
    assert.ok(parseLibraryDestination(new URL(query, 'http://library.local')).problem, query)
  }
})

test('duplicate HTTP review preserves tags, public URLs, rollback, revisions and deliberately kept variants', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visual-library-duplicates-http-'))
  try {
    mkdirSync(join(directory, 'runtime'))
    symlinkSync(new URL('../runtime/similarity', import.meta.url).pathname, join(directory, 'runtime/similarity'), 'dir')
    const result = spawnSync(process.execPath, [new URL('./helpers/duplicates-http.ts', import.meta.url).pathname], { cwd: directory, encoding: 'utf8', timeout: 30_000 })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    const reopened = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      const {ensureDataStore} = await import(${JSON.stringify(new URL('../server/db.ts', import.meta.url).href)});
      const {publicImageLinkCount, publicImageLink} = await import(${JSON.stringify(new URL('../server/access-store.ts', import.meta.url).href)});
      const db = await ensureDataStore();
      const destination = db.prepare('SELECT image_id FROM image_public_link_aliases LIMIT 1').get();
      assert.ok(destination);
      assert.ok(await publicImageLinkCount(destination.image_id) > 1);
      assert.ok(await publicImageLink(destination.image_id));
      assert.ok(db.prepare('SELECT 1 FROM duplicate_reviews').get());
      db.close();
    `], { cwd: directory, encoding: 'utf8', timeout: 5000 })
    assert.equal(reopened.status, 0, reopened.stdout + reopened.stderr)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
