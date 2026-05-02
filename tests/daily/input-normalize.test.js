const assert = require('assert')
const {
  buildRecommendationPayload,
  inferOccasion,
  inferPreferredStyle,
  inferPreferredColor
} = require('../../pages/daily/daily.helpers')

const payload = buildRecommendationPayload('  \u7ea6\u4f1a\u7a7f\u642d  ', {
  city: '  \u4e0a\u6d77  ',
  currentDateLabel: '\u0034\u6708\u0031\u65e5 \u5468\u4e8c',
  weatherSuggestion: '\u4eca\u5929\u504f\u70ed',
  weatherInfo: {
    temp: '29\u00b0C',
    text: '\u6674',
    icon: '\u2600\ufe0f'
  }
})

assert.strictEqual(payload.userQuery, '\u7ea6\u4f1a\u7a7f\u642d')
assert.strictEqual(payload.city, '\u4e0a\u6d77')
assert.strictEqual(payload.weatherInfo.temp, '29\u00b0C')
assert.strictEqual(payload.weatherInfo.text, '\u6674')
assert.strictEqual(payload.occasion, '\u7ea6\u4f1a')
assert.ok(payload.requestId.startsWith('local_'))
assert.strictEqual(inferOccasion('\u660e\u5929\u4e0a\u73ed\u7a7f\u4ec0\u4e48'), '\u901a\u52e4')
assert.strictEqual(inferPreferredStyle('\u60f3\u8981\u7b80\u7ea6\u98ce'), '\u7b80\u7ea6')
assert.strictEqual(inferPreferredColor('\u6700\u597d\u7a7f\u767d\u8272'), '\u767d\u8272')

console.log('input-normalize.test.js passed')
