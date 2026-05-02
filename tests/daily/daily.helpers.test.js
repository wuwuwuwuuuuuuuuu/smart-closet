const assert = require('assert')
const {
  normalizeInput,
  normalizeTemperature,
  buildDateLabel,
  inferOccasion,
  inferPreferredStyle,
  inferPreferredColor
} = require('../../pages/daily/daily.helpers')

assert.strictEqual(normalizeInput('  \u4e0a\u73ed\u600e\u4e48\u7a7f? '), '\u4e0a\u73ed\u600e\u4e48\u7a7f?')
assert.strictEqual(normalizeInput(null), '')
assert.strictEqual(normalizeTemperature('25\u00b0C'), 25)
assert.strictEqual(normalizeTemperature('-3\u2103'), -3)
assert.strictEqual(normalizeTemperature('--'), null)
assert.strictEqual(buildDateLabel(new Date('2026-04-21T00:00:00+08:00')), '\u0034\u6708\u0032\u0031\u65e5 \u5468\u4e8c')
assert.strictEqual(inferOccasion('\u660e\u5929\u4e0a\u73ed\u7a7f\u4ec0\u4e48'), '\u901a\u52e4')
assert.strictEqual(inferOccasion('\u5468\u672b\u53bb\u6cf0\u56fd\u65c5\u6e38\u600e\u4e48\u7a7f'), '\u51fa\u6e38')
assert.strictEqual(inferPreferredStyle('\u6211\u60f3\u8981\u7b80\u7ea6\u4e00\u70b9'), '\u7b80\u7ea6')
assert.strictEqual(inferPreferredColor('\u60f3\u7a7f\u84dd\u8272\u7cfb'), '\u84dd\u8272')

console.log('daily.helpers.test.js passed')
