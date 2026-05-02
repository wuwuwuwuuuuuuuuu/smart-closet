const assert = require('assert')
const {
  normalizeRecommendationResult,
  buildMockRecommendationResult
} = require('../../pages/daily/daily.helpers')

const normalized = normalizeRecommendationResult({
  replyText: '\u63a8\u8350\u5b8c\u6210',
  selectedClothesIds: ['1', '2', '1', '', null],
  selectedPhotoUrls: ['u1', 'u2', 'u1', ''],
  outfitLines: ['\u4e0a\u88c5\uff1a\u886c\u886b', '', '\u4e0b\u88c5\uff1a\u957f\u88e4'],
  tips: ['\u6ce8\u610f\u4fdd\u6696', null],
  wardrobeAnalysisSummary: '\u5171\u5206\u6790 8 \u4ef6\u8863\u7269'
})

assert.deepStrictEqual(normalized.selectedClothesIds, ['1', '2'])
assert.deepStrictEqual(normalized.selectedPhotoUrls, ['u1', 'u2'])
assert.deepStrictEqual(normalized.outfitLines, ['\u4e0a\u88c5\uff1a\u886c\u886b', '\u4e0b\u88c5\uff1a\u957f\u88e4'])
assert.deepStrictEqual(normalized.tips, ['\u6ce8\u610f\u4fdd\u6696'])
assert.strictEqual(normalized.wardrobeAnalysisSummary, '\u5171\u5206\u6790 8 \u4ef6\u8863\u7269')

const mockResult = buildMockRecommendationResult({
  userQuery: '\u6211\u8981\u53bb\u6cf0\u56fd\u65c5\u6e38',
  city: '\u4e0a\u6d77',
  weatherSuggestion: '\u4e0a\u6d77\u6674\uff0c\u5f53\u524d\u7ea6 30\u00b0C\uff0c\u5efa\u8bae\u9009\u62e9\u8f7b\u8584\u900f\u6c14\u642d\u914d\u5e76\u51cf\u5c11\u53e0\u7a7f\u3002',
  weatherInfo: {
    text: '\u6674'
  },
  selectedPhotoUrls: ['u10']
})

assert.ok(mockResult.replyText.includes('\u51fa\u6e38') || mockResult.replyText.includes('\u8f7b\u4fbf'))
assert.strictEqual(mockResult.ctaLabel, '\u53bb\u8bd5\u7a7f\u9875\u7ee7\u7eed\u642d\u914d')
assert.deepStrictEqual(mockResult.selectedPhotoUrls, ['u10'])
assert.strictEqual(mockResult.source, 'fallback')

console.log('reminder-result.test.js passed')
