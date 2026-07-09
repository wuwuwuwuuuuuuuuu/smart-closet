const assert = require('assert')
const {
  getLocalDateKey,
  shiftDateKey,
  naturalDayDifference,
  isWithinRecent10Days
} = require('../../utils/outfitDate')

const localDate = new Date(2026, 6, 10, 0, 30)
assert.strictEqual(getLocalDateKey(localDate), '2026-07-10')
assert.strictEqual(shiftDateKey('2026-07-10', -9), '2026-07-01')
assert.strictEqual(shiftDateKey('2026-07-10', -10), '2026-06-30')
assert.strictEqual(naturalDayDifference('2026-07-10', '2026-07-01'), 9)
assert.strictEqual(naturalDayDifference('2026-07-10', '2026-06-30'), 10)
assert.strictEqual(isWithinRecent10Days('2026-07-10', '2026-07-10'), true)
assert.strictEqual(isWithinRecent10Days('2026-07-01', '2026-07-10'), true)
assert.strictEqual(isWithinRecent10Days('2026-06-30', '2026-07-10'), false)
assert.strictEqual(isWithinRecent10Days('2026-07-11', '2026-07-10'), false)

console.log('outfit-date.test.js passed')
