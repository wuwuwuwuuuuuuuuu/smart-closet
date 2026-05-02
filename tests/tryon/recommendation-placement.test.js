const assert = require('assert')
const {
  matchSelectedClothes,
  buildSuggestedPlacements
} = require('../../pages/tryon/tryon.helpers')

const clothes = [
  { _id: 'a', name: '白衬衫' },
  { _id: 'b', name: '牛仔裤' }
]

const matched = matchSelectedClothes(['b', 'a', 'b'], clothes)
assert.deepStrictEqual(matched.map(item => item._id), ['b', 'a'])

const placed = buildSuggestedPlacements(matched)
assert.strictEqual(typeof placed[0].x, 'number')
assert.strictEqual(typeof placed[0].y, 'number')

console.log('recommendation-placement.test.js passed')
