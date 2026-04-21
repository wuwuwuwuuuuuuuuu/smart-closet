const assert = require('assert')
const {
  matchSelectedClothes,
  buildSuggestedPlacements,
  isValidSmartReminderEntry
} = require('../../pages/tryon/tryon.helpers')

const matched = matchSelectedClothes(
  ['1', '3'],
  [{ _id: '1', name: '衬衫' }, { _id: '2', name: '西裤' }]
)

assert.strictEqual(matched.length, 1)
assert.strictEqual(matched[0].name, '衬衫')

const placed = buildSuggestedPlacements([{ _id: '1' }, { _id: '2' }, { _id: '3' }])
assert.deepStrictEqual(placed.map(item => ({ x: item.x, y: item.y })), [
  { x: 30, y: 30 },
  { x: 150, y: 30 },
  { x: 30, y: 170 }
])

assert.strictEqual(isValidSmartReminderEntry({ source: 'smartReminder', createdAt: Date.now() }), true)
assert.strictEqual(isValidSmartReminderEntry({ source: 'smartReminder', createdAt: Date.now() - 31 * 60 * 1000 }), false)
