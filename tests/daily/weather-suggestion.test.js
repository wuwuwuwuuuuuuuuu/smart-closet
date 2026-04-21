const assert = require('assert')
const { buildWeatherSuggestion } = require('../../pages/daily/daily.helpers')

const rainy = buildWeatherSuggestion({ temp: '9°C', text: '小雨', city: '武汉市' })
assert.ok(rainy.includes('雨具'))

const hot = buildWeatherSuggestion({ temp: '30°C', text: '晴', city: '深圳市' })
assert.ok(hot.includes('轻薄透气'))
