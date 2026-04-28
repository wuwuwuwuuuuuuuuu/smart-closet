const assert = require('assert')
const {
  buildWeatherSuggestion
} = require('../../pages/daily/daily.helpers')

assert.ok(buildWeatherSuggestion({
  temp: '9\u00b0C',
  text: '\u5c0f\u96e8',
  city: '\u6b66\u6c49\u5e02'
}).includes('\u96e8\u5177'))

assert.ok(buildWeatherSuggestion({
  temp: '30\u00b0C',
  text: '\u6674',
  city: '\u6df1\u5733\u5e02'
}).includes('\u8f7b\u8584\u900f\u6c14'))

assert.ok(buildWeatherSuggestion({
  temp: '5\u00b0C',
  text: '\u9634',
  city: '\u5317\u4eac\u5e02'
}).includes('\u4fdd\u6696'))

console.log('weather-suggestion.test.js passed')
