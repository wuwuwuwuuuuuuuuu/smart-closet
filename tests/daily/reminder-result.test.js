const assert = require('assert')
const {
  normalizeReminderResult,
  buildReminderPayload
} = require('../../pages/daily/daily.helpers')

const result = normalizeReminderResult({
  replyText: '推荐完成',
  selectedClothesIds: ['1', '2', '1'],
  outfitLines: ['上衣：衬衫']
})

assert.strictEqual(result.replyText, '推荐完成')
assert.deepStrictEqual(result.selectedClothesIds, ['1', '2'])
assert.strictEqual(result.outfitLines.length, 1)

const payload = buildReminderPayload({
  userQuery: '  上班穿什么  ',
  weatherInfo: { temp: '20°C', text: '阴' },
  city: '上海市'
})
assert.strictEqual(payload.userQuery, '上班穿什么')
assert.strictEqual(payload.weatherInfo.temperature, 20)
assert.strictEqual(payload.weatherInfo.city, '上海市')
