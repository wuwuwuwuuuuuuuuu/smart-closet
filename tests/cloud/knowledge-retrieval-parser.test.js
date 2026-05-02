const assert = require('assert')
const {
  extractResponseOutputText,
  parseKnowledgeRecommendationResponse,
  buildKnowledgeQueryFromEvent
} = require('../../cloudfunctions/smartRecommendPhoto/utils/knowledge-retrieval-parser')

const outputText = extractResponseOutputText({
  output: [
    {
      content: [
        { type: 'output_text', text: '{"summary":"ok"}' }
      ]
    }
  ]
})
assert.strictEqual(outputText, '{"summary":"ok"}')

const query = buildKnowledgeQueryFromEvent({
  userQuery: '明天上课穿什么',
  occasion: '通勤',
  city: '上海',
  weatherSuggestion: '建议带薄外套',
  weatherInfo: { text: '多云', temp: 22 },
  userPreferences: { preferredStyle: '简约', preferredColor: '白色' }
})

assert.ok(query.includes('明天上课穿什么'))
assert.ok(query.includes('occasion: 通勤'))
assert.ok(query.includes('preference: 简约 / 白色'))

const originalWarn = console.warn
console.warn = () => {}

const parsed = parseKnowledgeRecommendationResponse({
  output_text: JSON.stringify({
    summary: '已找到合适搭配',
    replyText: '点击箭头查看试穿效果',
    outfitLines: ['上衣：白衬衫', '下装：黑色长裤'],
    tips: ['适合通勤'],
    selectedClothesIds: ['c1', 'c404'],
    retrievalHitCount: 4
  })
}, [
  { _id: 'c1' },
  { _id: 'c2' }
])

console.warn = originalWarn

assert.strictEqual(parsed.summary, '已找到合适搭配')
assert.strictEqual(parsed.replyText, '点击箭头查看试穿效果')
assert.deepStrictEqual(parsed.outfitLines, ['上衣：白衬衫', '下装：黑色长裤'])
assert.deepStrictEqual(parsed.selectedClothesIds, ['c1'])
assert.strictEqual(parsed.retrievalHitCount, 4)

console.log('knowledge-retrieval-parser.test.js passed')
