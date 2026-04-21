const assert = require('assert')
const {
  normalizeInput,
  normalizeTemperature,
  buildDateLabel
} = require('../../pages/daily/daily.helpers')

assert.strictEqual(normalizeInput('  上班怎么穿  '), '上班怎么穿')
assert.strictEqual(normalizeInput(null), '')
assert.strictEqual(normalizeTemperature('25°C'), 25)
assert.strictEqual(normalizeTemperature('-3℃'), -3)
assert.strictEqual(normalizeTemperature('--'), null)
assert.strictEqual(buildDateLabel(new Date('2026-04-21T00:00:00+08:00')), '4月21日 周二')

console.log('daily.helpers.test.js passed')
