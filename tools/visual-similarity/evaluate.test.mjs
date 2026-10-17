import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { spawnSync } from 'node:child_process'
import { createReport } from './report.mjs'

test('report escapes image names and uses local thumbnails without executable image metadata', () => {
  const image = { id: 'a', key: 'abc', name: '<script>alert("name")</script>', width: 100, height: 100 }
  const html = createReport([image], [{ id: 'a', rankings: { combined: [{ id: 'a', score: 1 }] } }], { visibleImages: 1 })
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('src="thumbs/abc.jpg"'))
  assert.ok(!html.includes('score:'))
})

test('variant report keeps palette visible, distinguishes extraction methods and exposes a labeled comparator', () => {
  const image = { id: 'a', key: 'abc', name: '<img onerror=alert(1)>', width: 100, height: 100 }
  const ranking = [{ id: 'a', score: 1 }]
  const html = createReport([image], [{ id: 'a', rankings: { palette: ranking, embedding: ranking, colorFull: ranking } }], { visibleImages: 1, variants: true })
  assert.ok(html.includes('label for="method"'))
  assert.ok(html.includes('data-method="embedding" hidden'))
  assert.ok(!html.includes('data-method="palette"'))
  assert.ok(html.includes('A esquerda mantém a paleta original'))
  assert.ok(!html.includes('<img onerror='))
})

test('evaluation excludes hidden rows, isolates invalid files and leaves SQLite and originals unchanged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'visual-similarity-test-'))
  try {
    const input = join(root, 'input'), output = join(root, 'output')
    await mkdir(join(input, 'images'), { recursive: true })
    const dbPath = join(input, 'library.sqlite')
    const db = new DatabaseSync(dbPath)
    db.exec('CREATE TABLE images (id TEXT, filename TEXT, original_name TEXT, hidden_from_gallery INTEGER, created_at TEXT)')
    const insert = db.prepare('INSERT INTO images VALUES (?, ?, ?, ?, ?)')
    insert.run('visible', 'broken.png', 'Broken', 0, '2026-01-01')
    insert.run('hidden', 'missing.png', 'Hidden', 1, '2026-01-02')
    insert.run('escape', '../outside.png', 'Outside', 0, '2026-01-03')
    db.close()
    await writeFile(join(input, 'images', 'broken.png'), 'not an image')
    const before = await readFile(dbPath)
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./evaluate.mjs', import.meta.url)), '--data', input, '--out', output], { encoding: 'utf8', timeout: 10000 })
    assert.equal(result.status, 1, result.stderr)
    const metrics = JSON.parse(await readFile(join(output, 'metrics.json'), 'utf8'))
    assert.equal(metrics.visibleImages, 2)
    assert.deepEqual(metrics.failedImages, [
      { id: 'visible', reason: 'decode-or-inference-failed' },
      { id: 'escape', reason: 'invalid-filename' },
    ])
    assert.deepEqual(await readFile(dbPath), before)
    assert.equal(await readFile(join(input, 'images', 'broken.png'), 'utf8'), 'not an image')
    assert.ok(!(await readFile(join(output, 'index.html'), 'utf8')).includes(root))
    const invalidOutput = spawnSync(process.execPath, [fileURLToPath(new URL('./evaluate.mjs', import.meta.url)), '--data', input, '--out', input], { encoding: 'utf8', timeout: 10000 })
    assert.equal(invalidOutput.status, 1)
    assert.match(invalidOutput.stderr, /separate directories/)
    const nested = join(input, 'must-not-be-created')
    const nestedOutput = spawnSync(process.execPath, [fileURLToPath(new URL('./evaluate.mjs', import.meta.url)), '--data', input, '--out', nested], { encoding: 'utf8', timeout: 10000 })
    assert.equal(nestedOutput.status, 1)
    await assert.rejects(access(nested), { code: 'ENOENT' })
    const baselinePath = join(root, 'baseline.json')
    await writeFile(baselinePath, JSON.stringify({ images: [{ id: 'hidden', key: 'anything' }], references: [{ id: 'hidden' }] }))
    const hiddenBaseline = spawnSync(process.execPath, [fileURLToPath(new URL('./evaluate.mjs', import.meta.url)), '--data', input, '--out', output, '--variants', '--baseline', baselinePath], { encoding: 'utf8', timeout: 10000 })
    assert.equal(hiddenBaseline.status, 1)
    assert.match(hiddenBaseline.stderr, /missing or hidden/)
    assert.deepEqual(await readFile(dbPath), before)
  } finally { await rm(root, { recursive: true, force: true }) }
})
