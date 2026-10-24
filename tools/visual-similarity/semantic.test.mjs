import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, access, copyFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { digest, semanticFingerprint, semanticPolicy, normalizedVector, validSemanticCache, rankSemantic, rankLexical, retrievalQuality } from './semantic-ranking.mjs'
import { semanticReport } from './semantic-report.mjs'
const vector = index => Array.from({ length: 768 }, (_, i) => i === index ? 1 : 0)
const image = (id, v = vector(0), tags = []) => ({ id, sha256: 'a'.repeat(64), vector: v, tags: tags.map(name => ({ name })), originalName: null, createdAt: '2020-01-01', hiddenFromGallery: false })

test('semantic vectors and cache require aligned dimensions, finite normalized values, revision and source hash', () => {
  assert.deepEqual(normalizedVector(vector(0).map(v => v * 3)), vector(0))
  for (const bad of [Array(768).fill(0), [1], vector(0).map(() => NaN)]) assert.throws(() => normalizedVector(bad))
  const cached = { fingerprint: semanticFingerprint, sourceHash: 'source', vector: vector(0) }
  assert.ok(validSemanticCache(cached, 'source'))
  assert.ok(!validSemanticCache(cached, 'changed'))
  assert.ok(!validSemanticCache({ ...cached, fingerprint: 'old-model' }, 'source'))
  assert.ok(!validSemanticCache({ ...cached, vector: vector(0).map(v => v * 2) }, 'source'))
  assert.equal(digest(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('semantic filters apply before top K and lexical baseline keeps personal tag identity, AND and accent normalization', () => {
  const images = [image('z', vector(0), ['Água']), image('a', vector(0), ['pessoa']), image('other', vector(1), ['água']), { ...image('hidden', vector(0), ['água']), hiddenFromGallery: true }]
  assert.deepEqual(rankSemantic(vector(0), images).map(item => item.id), ['a', 'z', 'other'])
  assert.deepEqual(rankSemantic(vector(0), images, ['água']).map(item => item.id), ['z', 'other'])
  assert.deepEqual(rankSemantic(vector(0), images, ['agua']), [])
  assert.deepEqual(rankLexical('AGUA', images).map(item => item.id), ['other', 'z'])
  assert.deepEqual(rankLexical('agua pessoa', images), [])
  assert.deepEqual(rankLexical('sem correspondência', images), [])
})

test('quality requires full judgments and never turns missing labels or an empty positive set into approval', () => {
  const candidates = ['a', 'b', 'c'], ranking = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  assert.equal(retrievalQuality(ranking, candidates, { a: 2 }).status, 'incomplete')
  assert.equal(retrievalQuality(ranking, candidates, { a: 0, b: 0, c: 0 }).status, 'no-relevant-candidates')
  const perfect = retrievalQuality(ranking, candidates, { a: 2, b: 1, c: 0 })
  assert.equal(perfect.ndcg10, 1); assert.equal(perfect.recall10, 1); assert.equal(perfect.success5, true)
  const lexicalEmpty = retrievalQuality([], candidates, { a: 2, b: 1, c: 0 })
  assert.equal(lexicalEmpty.ndcg10, 0); assert.equal(lexicalEmpty.recall10, 0); assert.equal(lexicalEmpty.success5, false)
  assert.throws(() => retrievalQuality(ranking, candidates, { a: 3, b: 0, c: 0 }))
})

test('private report escapes query/image metadata and offers explicit unknown relevance, with no remote images', () => {
  const result = { fingerprint: semanticFingerprint, datasetHash: 'data', queriesHash: 'queries', images: [{ ...image('a'), originalName: '<img onerror=alert(1)>' }], queries: [{ id: 'q', text: '</script><script>alert(1)</script>', language: 'pt', source: 'user', candidates: ['a'], semantic: [{ id: 'a' }], lexical: [] }] }
  const html = semanticReport(result, { selectedImages: 1 })
  assert.ok(!html.includes('<script>alert(1)</script>'))
  assert.ok(html.includes('&lt;img onerror='))
  assert.ok(html.includes('Não avaliada'))
  assert.ok(html.includes('Exportar julgamentos JSON'))
  assert.ok(!html.includes('src="https://'))
})

test('offline cached evaluation validates frozen input, confines paths, preserves originals and rejects mismatched judgments', async () => {
  const root = await mkdtemp(join(tmpdir(), 'semantic-evaluation-test-'))
  try {
    const input = join(root, 'input'), out = join(root, 'out')
    await mkdir(input); await mkdir(join(out, 'vectors'), { recursive: true })
    const bytes = await readFile(new URL('../../tests/fixtures/images/tiny.png', import.meta.url))
    const hash = digest(bytes); await writeFile(join(input, 'image.png'), bytes)
    const dataset = { version: 1, images: [{ ...image('a'), file: 'image.png', sha256: hash }] }
    delete dataset.images[0].vector
    const queries = { version: 1, queries: [{ id: 'q', text: 'coruja', language: 'pt', source: 'test' }] }
    const datasetFile = join(input, 'dataset.json'), queryFile = join(root, 'queries.json')
    await writeFile(datasetFile, JSON.stringify(dataset)); await writeFile(queryFile, JSON.stringify(queries))
    for (const [kind, sourceHash] of [['image', hash], ['text', digest('coruja')]]) {
      await writeFile(join(out, 'vectors', `${kind}-${digest(semanticFingerprint + sourceHash)}.json`), JSON.stringify({ fingerprint: semanticFingerprint, sourceHash, vector: vector(0) }))
    }
    const run = (output = out, extra = []) => spawnSync(process.execPath, [new URL('./semantic-evaluate.mjs', import.meta.url).pathname, '--dataset', datasetFile, '--queries', queryFile, '--out', output, '--offline', ...extra], { encoding: 'utf8', timeout: 10000 })
    const result = run(); assert.equal(result.status, 0, result.stdout + result.stderr)
    const metrics = JSON.parse(await readFile(join(out, 'metrics.json'), 'utf8'))
    assert.equal(metrics.imageCacheHits, 1); assert.equal(metrics.textCacheHits, 1)
    assert.equal(metrics.visionLoadMs, 0); assert.equal(metrics.textLoadMs, 0)
    assert.deepEqual(await readFile(join(input, 'image.png')), bytes)
    // Full-corpus mode is explicit; default sampling retains its previous ceiling.
    const single = { ...dataset.images[0] }
    dataset.images = Array.from({ length: 101 }, (_, i) => ({ ...single, id: `image-${i}` }))
    dataset.selection = 'all visible images'; dataset.visibleCount = 101
    await writeFile(datasetFile, JSON.stringify(dataset))
    assert.equal(run(join(root, 'too-many')).status, 1)
    await assert.rejects(access(join(root, 'too-many')))
    const fullOut = join(root, 'full-out'); await mkdir(join(fullOut, 'vectors'), { recursive: true })
    for (const file of await readdir(join(out, 'vectors'))) await copyFile(join(out, 'vectors', file), join(fullOut, 'vectors', file))
    const full = run(fullOut, ['--all']); assert.equal(full.status, 0, full.stdout + full.stderr)
    assert.equal(JSON.parse(await readFile(join(fullOut, 'metrics.json'), 'utf8')).imageCacheHits, 101)
    dataset.visibleCount = 102; await writeFile(datasetFile, JSON.stringify(dataset))
    assert.equal(run(join(root, 'incomplete-full'), ['--all']).status, 1)
    await assert.rejects(access(join(root, 'incomplete-full')))
    dataset.images = [single]; delete dataset.selection; delete dataset.visibleCount
    await writeFile(datasetFile, JSON.stringify(dataset))
    assert.equal(run(input).status, 1)
    await writeFile(join(root, 'outside.png'), bytes); await symlink(join(root, 'outside.png'), join(input, 'escape.png'))
    dataset.images[0].file = 'escape.png'; await writeFile(datasetFile, JSON.stringify(dataset))
    assert.equal(run(join(root, 'escape-out')).status, 1)
    await assert.rejects(access(join(root, 'escape-out')))
    dataset.images[0].file = 'image.png'; dataset.images[0].sha256 = '0'.repeat(64); await writeFile(datasetFile, JSON.stringify(dataset))
    assert.equal(run(join(root, 'changed-out')).status, 1)
    await assert.rejects(access(join(root, 'changed-out')))
    const judgments = join(root, 'judgments.json'); await writeFile(judgments, JSON.stringify({ version: 1, fingerprint: 'different' }))
    const score = spawnSync(process.execPath, [new URL('./semantic-score.mjs', import.meta.url).pathname, '--results', join(out, 'results.json'), '--judgments', judgments, '--out', join(root, 'quality.json')], { encoding: 'utf8' })
    assert.equal(score.status, 1); assert.match(score.stderr, /another model/)
  } finally { await rm(root, { recursive: true, force: true }) }
})


test('sample exporter reads SQLite without mutation, excludes hidden rows and rejects changed originals', async () => {
  const root = await mkdtemp(join(tmpdir(), 'semantic-export-test-'))
  try {
    await mkdir(join(root, 'images'))
    const bytes = Buffer.from('original-bytes'), hash = digest(bytes)
    await writeFile(join(root, 'images', 'a.png'), bytes)
    const dbPath = join(root, 'library.sqlite'), db = new DatabaseSync(dbPath)
    db.exec(`CREATE TABLE images (id TEXT,filename TEXT,original_name TEXT,created_at TEXT,content_hash TEXT,hidden_from_gallery INTEGER);
      CREATE TABLE tags (id TEXT,name TEXT);
      CREATE TABLE image_tags (image_id TEXT,tag_id TEXT,created_at TEXT);`)
    db.prepare('INSERT INTO images VALUES (?,?,?,?,?,?)').run('a', 'a.png', 'Nome pessoal', '2020-01-01', hash, 0)
    db.prepare('INSERT INTO images VALUES (?,?,?,?,?,?)').run('hidden', 'missing.png', 'Hidden', '2021-01-01', 'x', 1)
    db.close()
    const before = await readFile(dbPath)
    const exported = spawnSync('python3', [new URL('./semantic-sample.py', import.meta.url).pathname, '--data', root], { maxBuffer: 1024 * 1024 })
    assert.equal(exported.status, 0, exported.stderr.toString())
    const archive = join(root, 'sample.tar'); await writeFile(archive, exported.stdout)
    const metadata = spawnSync('python3', ['-c', "import sys,tarfile; print(tarfile.open(sys.argv[1]).extractfile('dataset.json').read().decode())", archive], { encoding: 'utf8' })
    const dataset = JSON.parse(metadata.stdout)
    assert.equal(dataset.images.length, 1); assert.equal(dataset.images[0].id, 'a'); assert.equal(dataset.images[0].sha256, hash)
    assert.deepEqual(await readFile(dbPath), before)
    assert.deepEqual(await readFile(join(root, 'images', 'a.png')), bytes)
    const larger = new DatabaseSync(dbPath)
    for (let i = 0; i < 100; i++) larger.prepare('INSERT INTO images VALUES (?,?,?,?,?,?)').run(`extra-${i}`, 'a.png', 'Extra', '2020-01-01', hash, 0)
    larger.close()
    const frozen = await readFile(dbPath)
    const all = spawnSync('python3', [new URL('./semantic-sample.py', import.meta.url).pathname, '--data', root, '--all'], { maxBuffer: 1024 * 1024 })
    assert.equal(all.status, 0, all.stderr.toString()); await writeFile(archive, all.stdout)
    const fullMetadata = spawnSync('python3', ['-c', "import sys,tarfile; print(tarfile.open(sys.argv[1]).extractfile('dataset.json').read().decode())", archive], { encoding: 'utf8' })
    const full = JSON.parse(fullMetadata.stdout)
    assert.equal(full.images.length, 101); assert.equal(full.visibleCount, 101); assert.equal(full.selection, 'all visible images')
    assert.ok(full.images.every(image => image.id !== 'hidden'))
    assert.deepEqual(await readFile(dbPath), frozen)
    const mixed = spawnSync('python3', [new URL('./semantic-sample.py', import.meta.url).pathname, '--data', root, '--all', '--limit', '10'], { encoding: 'utf8' })
    assert.notEqual(mixed.status, 0)
    await writeFile(join(root, 'images', 'a.png'), 'changed')
    const changed = spawnSync('python3', [new URL('./semantic-sample.py', import.meta.url).pathname, '--data', root], { encoding: 'utf8' })
    assert.equal(changed.status, 1); assert.match(changed.stderr, /original changed/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('judgment migration preserves only matching image IDs/hashes under the same model and queries', async () => {
  const { migrateJudgments } = await import('./semantic-migrate.mjs')
  const previous = { fingerprint: 'model', datasetHash: 'old', queriesHash: 'queries', images: [{ id: 'a', sha256: 'hash-a' }, { id: 'b', sha256: 'hash-b' }], queries: [{ id: 'q', candidates: ['a', 'b'] }] }
  const current = { ...previous, datasetHash: 'full', images: [{ id: 'a', sha256: 'hash-a' }, { id: 'b', sha256: 'changed' }, { id: 'new', sha256: 'new' }], queries: [{ id: 'q', candidates: ['a', 'b', 'new'] }] }
  const judgments = { version: 1, fingerprint: 'model', datasetHash: 'old', queriesHash: 'queries', grades: { q: { a: 2, b: 0 } } }
  const migrated = migrateJudgments(previous, judgments, current)
  assert.equal(migrated.grades.q.a, 2)
  assert.ok(!Object.hasOwn(migrated.grades.q, 'b'))
  assert.ok(!Object.hasOwn(migrated.grades.q, 'new'))
  assert.equal(migrated.provenance.copied, 1); assert.equal(migrated.provenance.skipped, 1)
  assert.throws(() => migrateJudgments(previous, judgments, { ...current, fingerprint: 'other-model' }))
  assert.throws(() => migrateJudgments(previous, { ...judgments, datasetHash: 'wrong' }, current))
})

test('report presents one grading control per candidate and validates the seed experiment', () => {
  const results = { fingerprint: 'model', datasetHash: 'full', queriesHash: 'queries', images: [image('a'), image('b')], queries: [{ id: 'q', text: 'água', language: 'pt', source: 'user', candidates: ['a', 'b'], semantic: [{ id: 'a' }], lexical: [] }] }
  const seed = { fingerprint: 'model', datasetHash: 'full', queriesHash: 'queries', grades: { q: { a: 2 } } }
  const html = semanticReport(results, { allVisible: true }, seed)
  assert.equal((html.match(/<select data-query=/g) ?? []).length, 2)
  assert.ok(html.includes('<option value="2" selected>'))
  assert.ok(html.includes('Todas as imagens visíveis'))
  assert.ok(html.includes('Avaliar os demais 1 candidatos'))
  assert.throws(() => semanticReport(results, {}, { ...seed, datasetHash: 'other' }))
})
