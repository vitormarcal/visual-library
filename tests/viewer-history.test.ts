import assert from 'node:assert/strict'
import test from 'node:test'
import { recordViewerVisit, popViewerVisit, type ViewerHistoryEntry } from '../app/utils/viewer-history.ts'

const position = (scrollTop: number, focus: string | null = null) => ({ scrollTop, focus })

test('an excursion starts at the related choice, after ordinary gallery browsing', () => {
  let history: ViewerHistoryEntry[] = []
  history = recordViewerVisit(history, 'a', 'd', position(0), false)
  assert.equal(history.length, 0)
  history = recordViewerVisit(history, 'd', 'b', position(900, 'related:b'), true)
  history = recordViewerVisit(history, 'b', 'c', position(0, 'next'), false)
  const back = popViewerVisit(history, new Set(['a', 'b', 'c', 'd']))
  assert.deepEqual(back.entry, { imageId: 'b', scrollTop: 0, focus: 'next' })
  const origin = popViewerVisit(back.history, new Set(['a', 'b', 'c', 'd']))
  assert.deepEqual(origin.entry, { imageId: 'd', scrollTop: 900, focus: 'related:b' })
  assert.deepEqual(origin.history, [])
})

test('revisits, branching after Back, and same-image choices preserve the actual path', () => {
  let history = recordViewerVisit([], 'a', 'b', position(850, 'related:b'), true)
  assert.equal(recordViewerVisit(history, 'b', 'b', position(0), true), history)
  history = recordViewerVisit(history, 'b', 'a', position(1000, 'related:a'), true)
  const back = popViewerVisit(history, new Set(['a', 'b', 'c']))
  assert.equal(back.entry?.imageId, 'b')
  history = recordViewerVisit(back.history, 'b', 'c', position(1100, 'related:c'), true)
  assert.deepEqual(history.map((entry) => entry.imageId), ['a', 'b'])
  assert.equal(popViewerVisit(history, new Set(['a', 'b', 'c'])).entry?.focus, 'related:c')
})

test('Back skips removed records without mutating history and handles an exhausted session', () => {
  const history = recordViewerVisit(
    recordViewerVisit([], 'a', 'b', position(800), true), 'b', 'c', position(900), true,
  )
  const back = popViewerVisit(history, new Set(['a', 'c']))
  assert.equal(back.entry?.imageId, 'a')
  assert.deepEqual(back.history, [])
  assert.equal(history.length, 2)
  assert.deepEqual(popViewerVisit(history, new Set()), { entry: null, history: [] })
  assert.deepEqual(popViewerVisit([], new Set(['a'])), { entry: null, history: [] })
})
