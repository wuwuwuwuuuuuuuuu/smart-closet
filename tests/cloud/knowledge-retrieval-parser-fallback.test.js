const assert = require('assert')
const {
  parseKnowledgeRecommendationResponse,
  safeParseRecommendationText
} = require('../../cloudfunctions/smartRecommendPhoto/utils/knowledge-retrieval-parser')

const clothesList = [
  { _id: 'c1' },
  { _id: 'c2' },
  { _id: 'c3' }
]

const originalWarn = console.warn
console.warn = () => {}

const retrievalOnly = parseKnowledgeRecommendationResponse({
  output: [
    {
      type: 'file_search_call',
      results: [
        {
          docId: 'doc_1',
          fileId: 'file_1',
          fileName: 'c1.md',
          snippet: 'clothes_id: c1',
          score: 0.93
        }
      ]
    }
  ]
}, clothesList)

assert.deepStrictEqual(retrievalOnly.selectedClothesIds, ['c1'])
assert.strictEqual(retrievalOnly.retrievalHitCount, 1)
assert.strictEqual(retrievalOnly.replyText, '')
assert.strictEqual(retrievalOnly.retrievalItems.length, 1)

const jsonParseFallback = parseKnowledgeRecommendationResponse({
  output: [
    {
      type: 'file_search_call',
      results: [
        {
          fileName: 'c2.md',
          snippet: 'clothes_id: c2'
        }
      ]
    },
    {
      content: [
        {
          type: 'output_text',
          text: '这是普通文本，不是 JSON'
        }
      ]
    }
  ]
}, clothesList)

assert.deepStrictEqual(jsonParseFallback.selectedClothesIds, ['c2'])
assert.strictEqual(jsonParseFallback.replyText, '这是普通文本，不是 JSON')
assert.strictEqual(jsonParseFallback.retrievalHitCount, 1)

const merged = parseKnowledgeRecommendationResponse({
  output_text: JSON.stringify({
    summary: '已找到搭配',
    selectedClothesIds: ['c1', 'c3', 'missing_id'],
    retrievalHitCount: 99
  }),
  output: [
    {
      type: 'file_search_call',
      results: [
        {
          fileName: 'c1.md',
          snippet: 'clothes_id: c1'
        },
        {
          fileName: 'c2.md',
          snippet: 'clothes_id: c2'
        }
      ]
    }
  ]
}, clothesList)

assert.deepStrictEqual(merged.selectedClothesIds, ['c1', 'c2', 'c3'])
assert.strictEqual(merged.summary, '已找到搭配')
assert.strictEqual(merged.retrievalHitCount, 2)

const safeParsed = safeParseRecommendationText('没有 json 的普通说明')
assert.strictEqual(safeParsed.replyText, '没有 json 的普通说明')
assert.deepStrictEqual(safeParsed.selectedClothesIds, [])

console.warn = originalWarn

console.log('knowledge-retrieval-parser-fallback.test.js passed')
