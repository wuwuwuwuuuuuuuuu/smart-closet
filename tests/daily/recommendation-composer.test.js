const assert = require('assert')
const {
  composeRecommendationResult,
  uniqueStringList,
  normalizeHitCount
} = require('../../cloudfunctions/smartRecommendPhoto/utils/recommendation-composer')

assert.deepStrictEqual(
  uniqueStringList(['a', ' a ', 'b', '', null, undefined, 'b']),
  ['a', 'b']
)

assert.strictEqual(normalizeHitCount(3), 3)
assert.strictEqual(normalizeHitCount(-1), 0)
assert.strictEqual(normalizeHitCount('3'), 0)

const result = composeRecommendationResult({
  requestId: ' rec_100 ',
  summary: ' 已完成推荐 ',
  replyText: ' 点箭头去试穿 ',
  selectedClothesIds: ['c1', ' c2 ', 'c1', '', null],
  selectedPhotoUrls: ['u1', ' u2 ', 'u1'],
  outfitLines: ['上装：白衬衫', '', '下装：黑长裤'],
  tips: ['适合通勤', null, '注意早晚温差'],
  wardrobeAnalysisSummary: ' 共命中 2 件 ',
  retrievalSource: 'bailian_knowledge',
  knowledgeId: ' kb_001 ',
  retrievalHitCount: 2
})

assert.strictEqual(result.requestId, 'rec_100')
assert.strictEqual(result.summary, '已完成推荐')
assert.strictEqual(result.replyText, '点箭头去试穿')
assert.deepStrictEqual(result.selectedClothesIds, ['c1', 'c2'])
assert.deepStrictEqual(result.selectedPhotoUrls, ['u1', 'u2'])
assert.deepStrictEqual(result.outfitLines, ['上装：白衬衫', '下装：黑长裤'])
assert.deepStrictEqual(result.tips, ['适合通勤', '注意早晚温差'])
assert.strictEqual(result.wardrobeAnalysisSummary, '共命中 2 件')
assert.strictEqual(result.ctaLabel, '去试穿页继续搭配')
assert.strictEqual(result.source, 'smartRecommend')
assert.strictEqual(result.retrievalSource, 'bailian_knowledge')
assert.strictEqual(result.knowledgeId, 'kb_001')
assert.strictEqual(result.retrievalHitCount, 2)

const originalWarn = console.warn
console.warn = () => {}
const fallbackResult = composeRecommendationResult({
  source: 'cloud-fallback',
  selectedClothesIds: 'bad-value',
  selectedPhotoUrls: null,
  retrievalHitCount: 'bad-value'
})
console.warn = originalWarn

assert.strictEqual(fallbackResult.source, 'cloud-fallback')
assert.deepStrictEqual(fallbackResult.selectedClothesIds, [])
assert.deepStrictEqual(fallbackResult.selectedPhotoUrls, [])
assert.strictEqual(fallbackResult.retrievalHitCount, 0)

console.log('recommendation-composer.test.js passed')
