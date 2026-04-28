const assert = require('assert')
const {
  normalizeRecommendationResult,
  hasTryOnSelection,
  buildRecommendationStatus
} = require('../../pages/daily/daily.helpers')

const ready = normalizeRecommendationResult({
  requestId: 'rec_ready',
  summary: '已命中',
  selectedClothesIds: ['c1', 'c2', 'c1'],
  selectedPhotoUrls: ['u1', 'u1', 'u2'],
  retrievalHitCount: 3
})

assert.deepStrictEqual(ready.selectedClothesIds, ['c1', 'c2'])
assert.deepStrictEqual(ready.selectedPhotoUrls, ['u1', 'u2'])
assert.strictEqual(ready.retrievalHitCount, 3)
assert.strictEqual(hasTryOnSelection(ready), true)
assert.strictEqual(buildRecommendationStatus(ready), 'ready')

const empty = normalizeRecommendationResult({
  summary: '知识库检索没有命中结果',
  replyText: '请换一句更明确的需求再试',
  tips: ['失败阶段：retrieval']
})

assert.strictEqual(hasTryOnSelection(empty), false)
assert.strictEqual(buildRecommendationStatus(empty), 'empty')

assert.strictEqual(buildRecommendationStatus({}), 'invalid')
assert.strictEqual(buildRecommendationStatus(null), 'invalid')

console.log('recommendation-rendering.test.js passed')
