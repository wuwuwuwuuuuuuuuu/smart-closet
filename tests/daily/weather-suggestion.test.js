const assert = require('assert')
const {
  buildWeatherSuggestion
} = require('../../pages/daily/daily.helpers')

assert.ok(buildWeatherSuggestion({
  temp: '9°C',
  text: '小雨',
  city: '武汉市'
}).includes('雨具'))

assert.ok(buildWeatherSuggestion({
  temp: '30°C',
  text: '晴',
  city: '深圳市'
}).includes('轻薄透气'))

assert.ok(buildWeatherSuggestion({
  temp: '5°C',
  text: '阴',
  city: '北京市'
}).includes('保暖'))

console.log('weather-suggestion.test.js passed')
