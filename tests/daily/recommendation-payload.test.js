const assert = require('assert')
const {
  buildRecommendationPayload,
  normalizeRecommendationResult,
  hasTryOnSelection,
  buildRecommendationStatus
} = require('../../pages/daily/daily.helpers')

const payload = buildRecommendationPayload('  \u660e\u5929\u4e0a\u73ed\u7a7f\u4ec0\u4e48  ', {
  city: '  \u5317\u4eac  ',
  occasion: '  \u901a\u52e4  ',
  userPreferences: {
    preferredStyle: '\u7b80\u7ea6',
    preferredColor: '\u84dd\u8272'
  },
  weatherInfo: {
    temp: 0,
    text: '\u6674',
    icon: '\u2600\ufe0f'
  }
})

assert.strictEqual(payload.userQuery, '\u660e\u5929\u4e0a\u73ed\u7a7f\u4ec0\u4e48')
assert.strictEqual(payload.city, '\u5317\u4eac')
assert.strictEqual(payload.occasion, '\u901a\u52e4')
assert.deepStrictEqual(payload.userPreferences, {
  preferredStyle: '\u7b80\u7ea6',
  preferredColor: '\u84dd\u8272'
})
assert.strictEqual(payload.weatherInfo.temp, 0)

const inferredPayload = buildRecommendationPayload('  \u53bb\u6cf0\u56fd\u65c5\u6e38\u7a7f\u4ec0\u4e48\u6bd4\u8f83\u8f7b\u677e  ', {
  city: '  \u4e0a\u6d77  '
})
assert.strictEqual(inferredPayload.occasion, '\u51fa\u6e38')
assert.strictEqual(inferredPayload.userPreferences.preferredStyle, '\u5ea6\u5047')

const normalized = normalizeRecommendationResult({
  requestId: 'rec_1',
  selectedClothesIds: ['1', '2', '1', ' 2 '],
  selectedPhotoUrls: ['a', 'b', 'a', ' b '],
  wardrobeAnalysisSummary: '\u5171\u5206\u6790 12 \u4ef6\u8863\u7269',
  retrievalSource: 'bailian_knowledge',
  knowledgeId: 'kb_001',
  retrievalHitCount: 4
})

assert.deepStrictEqual(normalized.selectedClothesIds, ['1', '2'])
assert.deepStrictEqual(normalized.selectedPhotoUrls, ['a', 'b'])
assert.strictEqual(normalized.wardrobeAnalysisSummary, '\u5171\u5206\u6790 12 \u4ef6\u8863\u7269')
assert.strictEqual(normalized.requestId, 'rec_1')
assert.strictEqual(normalized.retrievalSource, 'bailian_knowledge')
assert.strictEqual(normalized.knowledgeId, 'kb_001')
assert.strictEqual(normalized.retrievalHitCount, 4)
assert.strictEqual(hasTryOnSelection(normalized), true)
assert.strictEqual(buildRecommendationStatus(normalized), 'ready')

console.log('recommendation-payload.test.js passed')
