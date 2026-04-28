const assert = require('assert')
const {
  normalizeFileNameToId,
  resolveMatchedClothesFromRetrieval
} = require('../../cloudfunctions/smartRecommendPhoto/utils/knowledge-result-mapper')

const clothesList = [
  { _id: 'c1', bailian_doc_id: 'doc_1', bailian_file_id: 'file_1' },
  { _id: 'c2', knowledge_doc_id: 'doc_2', bailian_file_id: 'file_2' },
  { _id: 'c3', bailian_doc_id: 'doc_3' }
]

assert.strictEqual(normalizeFileNameToId('c1.md'), 'c1')

const mappedByMixedSignals = resolveMatchedClothesFromRetrieval({
  clothesList,
  aiPayload: {
    selectedClothesIds: ['c1'],
    retrievalItems: [
      { docId: 'doc_2' },
      { fileId: 'file_1' },
      { clothesIdHint: 'c3' },
      { fileName: 'c2.md' },
      { docId: 'missing_doc' }
    ]
  }
})

assert.deepStrictEqual(
  mappedByMixedSignals.matchedClothes.map(item => item._id),
  ['c1', 'c2', 'c3']
)
assert.strictEqual(mappedByMixedSignals.unresolvedCount, 1)
assert.deepStrictEqual(mappedByMixedSignals.unresolvedHits[0], {
  reason: 'docId',
  value: 'missing_doc'
})

const partial = resolveMatchedClothesFromRetrieval({
  clothesList,
  aiPayload: {
    selectedClothesIds: ['missing_id'],
    retrievalItems: [
      { fileName: 'c1.md' },
      { fileId: 'missing_file' }
    ]
  }
})

assert.deepStrictEqual(partial.matchedClothes.map(item => item._id), ['c1'])
assert.strictEqual(partial.unresolvedCount, 2)

console.log('knowledge-result-mapping.test.js passed')
