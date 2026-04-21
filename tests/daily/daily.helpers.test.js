const assert = require('assert')
const {
  normalizeTemperature,
  normalizeReminderResult
} = require('../../pages/daily/daily.helpers')

assert.strictEqual(normalizeTemperature('25°C'), 25)
assert.strictEqual(normalizeTemperature('9/11℃'), 9)
assert.strictEqual(normalizeTemperature('--'), null)

const result = normalizeReminderResult({
  selectedClothesIds: ['a', 'b', 'a', '', null]
})
assert.deepStrictEqual(result.selectedClothesIds, ['a', 'b'])
