const assert = require('assert')
const {
  extractClothesIdHint,
  normalizeKnowledgeRetrievalResponse,
  normalizeScore
} = require('../../cloudfunctions/smartRecommendPhoto/utils/bailian-retrieval-normalizer')

const originalWarn = console.warn
console.warn = () => {}

assert.strictEqual(
  extractClothesIdHint({
    fileName: 'fec246ca69e989df0039ed3b79557c71.md'
  }),
  'fec246ca69e989df0039ed3b79557c71'
)

assert.strictEqual(
  extractClothesIdHint({
    snippet: 'category: 上衣\nclothes_id: cloth_001\nname: 白衬衫'
  }),
  'cloth_001'
)

assert.strictEqual(normalizeScore('0.82'), 0.82)
assert.strictEqual(normalizeScore('bad-score'), 0)

const normalized = normalizeKnowledgeRetrievalResponse({
  output: [
    {
      type: 'file_search_call',
      results: [
        {
          docId: 'doc_1',
          fileId: 'file_1',
          fileName: 'c1.md',
          snippet: 'clothes_id: c1',
          score: '0.91'
        },
        {
          doc_id: 'doc_2',
          file_id: 'file_2',
          filename: 'c2.md',
          text: 'clothes_id: c2',
          score: 'not-a-number'
        }
      ]
    }
  ]
})
assert.strictEqual(normalized.toolType, 'file_search')
assert.strictEqual(normalized.hits.length, 2)
assert.deepStrictEqual(normalized.hits[0], {
  docId: 'doc_1',
  fileId: 'file_1',
  fileName: 'c1.md',
  title: '',
  snippet: 'clothes_id: c1',
  score: 0.91,
  clothesIdHint: 'c1'
})
assert.strictEqual(normalized.hits[1].score, 0)
assert.strictEqual(normalized.hits[1].clothesIdHint, 'c2')

const empty = normalizeKnowledgeRetrievalResponse({})
assert.deepStrictEqual(empty.hits, [])

console.warn = originalWarn

console.log('bailian-retrieval-normalizer.test.js passed')
