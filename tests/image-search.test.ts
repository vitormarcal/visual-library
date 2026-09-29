import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesImageSearch } from '../app/utils/image-search.ts'

const image = { originalName: 'Retrato dourado.JPG', tags: [{ name: 'Ilustração' }, { name: 'Luz natural' }] }

test('search finds filenames and tags regardless of case, accents, or whitespace', () => {
  assert.equal(matchesImageSearch(image, '  ILUSTRACAO   dourado '), true)
  assert.equal(matchesImageSearch(image, 'luz natural'), true)
  assert.equal(matchesImageSearch(image, 'retrato noite'), false)
})

test('empty searches include untagged images with no original filename', () => {
  assert.equal(matchesImageSearch({ originalName: null, tags: [] }, '  '), true)
  assert.equal(matchesImageSearch({ originalName: null, tags: [] }, 'photo'), false)
  assert.equal(matchesImageSearch({ originalName: 'photo.png', tags: [] }, 'PHOTO'), true)
})
