const assert = require('assert')
const {
  buildCloudFallbackRecommendation
} = require('../../cloudfunctions/smartRecommendPhoto/utils/fallback-recommendation')

const recommendation = buildCloudFallbackRecommendation({
  requestId: 'local_1',
  weatherSuggestion: '今天有风，建议加一件薄外套。'
}, [
  {
    clothesId: 'c1',
    photoUrl: 'https://img/1',
    category: '上装',
    name: '白衬衫'
  },
  {
    clothesId: 'c2',
    photoUrl: 'https://img/2',
    category: '下装',
    name: '黑长裤'
  }
])

assert.strictEqual(recommendation.requestId, 'local_1')
assert.deepStrictEqual(recommendation.selectedClothesIds, ['c1', 'c2'])
assert.deepStrictEqual(recommendation.selectedPhotoUrls, ['https://img/1', 'https://img/2'])
assert.deepStrictEqual(recommendation.outfitLines, ['上装：白衬衫', '下装：黑长裤'])
assert.strictEqual(recommendation.wardrobeAnalysisSummary, '已提取 2 件可分析衣物图片。')
assert.strictEqual(recommendation.source, 'cloud-fallback')

console.log('cloud-fallback-recommendation.test.js passed')
