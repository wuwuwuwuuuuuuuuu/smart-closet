const assert = require('assert')
const { normalizeRecommendationResult } = require('../../pages/daily/daily.helpers')

const result = normalizeRecommendationResult({
  selectedClothesIds: ['a', 'a', 'b'],
  retrievalSource: 'image_vector',
  retrievalHitCount: 5
})

assert.deepStrictEqual(result.selectedClothesIds, ['a', 'b'])
assert.strictEqual(result.retrievalSource, 'image_vector')
assert.strictEqual(result.retrievalHitCount, 5)

console.log('image-recommend-result.test.js passed')
