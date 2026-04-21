const assert = require('assert')
const {
  buildRecommendationPayload
} = require('../../pages/daily/daily.helpers')

const payload = buildRecommendationPayload('  约会穿搭  ', {
  city: '  上海  ',
  currentDateLabel: '4月21日 周二',
  weatherSuggestion: '今天偏热',
  weatherInfo: {
    temp: '29°C',
    text: '晴',
    icon: '☀️'
  }
})

assert.strictEqual(payload.userQuery, '约会穿搭')
assert.strictEqual(payload.city, '上海')
assert.strictEqual(payload.weatherInfo.temp, '29°C')
assert.strictEqual(payload.weatherInfo.text, '晴')
assert.ok(payload.requestId.startsWith('local_'))

console.log('input-normalize.test.js passed')
