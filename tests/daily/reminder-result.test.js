const assert = require('assert')
const {
  normalizeRecommendationResult,
  buildMockRecommendationResult
} = require('../../pages/daily/daily.helpers')

const normalized = normalizeRecommendationResult({
  replyText: '推荐完成',
  selectedClothesIds: ['1', '2', '1', '', null],
  outfitLines: ['上装：衬衫', '', '下装：长裤'],
  tips: ['注意保暖', null]
})

assert.deepStrictEqual(normalized.selectedClothesIds, ['1', '2'])
assert.deepStrictEqual(normalized.outfitLines, ['上装：衬衫', '下装：长裤'])
assert.deepStrictEqual(normalized.tips, ['注意保暖'])

const mockResult = buildMockRecommendationResult({
  userQuery: '上班怎么穿',
  city: '上海',
  weatherSuggestion: '上海晴，当前约 26°C，适合通勤或日常层次搭配。',
  weatherInfo: {
    text: '晴'
  }
})

assert.ok(mockResult.replyText.includes('通勤') || mockResult.replyText.includes('利落'))
assert.strictEqual(mockResult.ctaLabel, '去试穿页继续搭配')

console.log('reminder-result.test.js passed')
