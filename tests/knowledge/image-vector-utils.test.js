const assert = require('assert')
const {
  cosineSimilarity,
  pickTopKBySimilarity,
  summarizeVectorDocs
} = require('../../cloudfunctions/common/image-vector-utils')

assert.strictEqual(cosineSimilarity([1, 0], [1, 0]), 1)
assert.strictEqual(cosineSimilarity([1, 0], [0, 1]), 0)

const top = pickTopKBySimilarity({
  queryVector: [1, 0],
  items: [
    { id: 'a', vector: [0, 1] },
    { id: 'b', vector: [1, 0] }
  ],
  topK: 1
})

assert.strictEqual(top[0].id, 'b')

assert.deepStrictEqual(
  summarizeVectorDocs([
    { vector: [1, 0] },
    { vector: [0, 1] },
    { vector: [1, 0, 0] }
  ], [1, 0]),
  { queryDim: 2, total: 3, sameDimCount: 2, skippedByDimCount: 1 }
)

assert.throws(() => cosineSimilarity([], [1]))
assert.throws(() => cosineSimilarity([0, 0], [1, 0]))

console.log('image-vector-utils.test.js passed')
