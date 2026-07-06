const assert = require('assert')

const storage = new Map()
global.wx = {
  setStorageSync(key, value) {
    storage.set(key, value)
  },
  getStorageSync(key) {
    return storage.get(key)
  },
  removeStorageSync(key) {
    storage.delete(key)
  }
}

const {
  STORAGE_KEY,
  setCurrentTryonContext,
  getCurrentTryonContext,
  clearCurrentTryonContext,
  isContextForResult,
  createTryonRequestId
} = require('../../utils/currentTryonContext')

const now = new Date('2026-07-06T04:00:00.000Z')
const context = setCurrentTryonContext({
  clothingIds: [' A ', '', 'A', 'B'],
  source: 'recommendation',
  createdAt: now.toISOString(),
  resultImage: 'https://example.com/result.png',
  ignoredFullObject: { name: '不应保存' }
})

assert.deepStrictEqual(context.clothingIds, ['A', 'B'])
assert.strictEqual(context.source, 'recommendation')
assert.strictEqual(storage.get(STORAGE_KEY).ignoredFullObject, undefined)

const loaded = getCurrentTryonContext({ now })
assert.deepStrictEqual(loaded, context)
assert.strictEqual(isContextForResult(loaded, 'https://example.com/result.png'), true)
assert.strictEqual(isContextForResult(loaded, 'https://example.com/new.png'), false)

assert.strictEqual(
  getCurrentTryonContext({
    now: new Date('2026-07-06T07:00:01.000Z'),
    ttlMs: 2 * 60 * 60 * 1000
  }),
  null
)

assert.strictEqual(clearCurrentTryonContext('https://example.com/other.png'), false)
assert.ok(storage.has(STORAGE_KEY))
assert.strictEqual(clearCurrentTryonContext('https://example.com/result.png'), true)
assert.strictEqual(storage.has(STORAGE_KEY), false)

const requestIdA = createTryonRequestId('image-a', 12345, 0.5)
const requestIdB = createTryonRequestId('image-a', 12345, 0.5)
const requestIdC = createTryonRequestId('image-b', 12345, 0.5)
assert.strictEqual(requestIdA, requestIdB)
assert.notStrictEqual(requestIdA, requestIdC)

console.log('current-tryon-context.test.js passed')
