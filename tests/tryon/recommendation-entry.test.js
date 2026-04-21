const assert = require('assert')
const {
  matchSelectedClothes,
  buildSuggestedPlacements,
  isValidSmartRecommendEntry
} = require('../../pages/tryon/tryon.helpers')

const matched = matchSelectedClothes(
  ['b', 'a', 'b'],
  [
    { _id: 'a', name: '白衬衫' },
    { _id: 'b', name: '黑长裤' }
  ]
)

assert.deepStrictEqual(matched.map(item => item._id), ['b', 'a'])

const placements = buildSuggestedPlacements(matched)
assert.strictEqual(placements.length, 2)
assert.ok(placements[0].x >= 0)
assert.ok(placements[1].y >= placements[0].y)

assert.strictEqual(isValidSmartRecommendEntry({
  source: 'smartRecommend',
  createdAt: Date.now() - 1000
}), true)

assert.strictEqual(isValidSmartRecommendEntry({
  source: 'smartRecommend',
  createdAt: Date.now() - 31 * 60 * 1000
}), false)

console.log('recommendation-entry.test.js passed')
