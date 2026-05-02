const assert = require('assert')
const { pickTopKBySimilarity } = require('../../cloudfunctions/common/image-vector-utils')

const hits = pickTopKBySimilarity({
  queryVector: [1, 0],
  items: [
    { id: 'coat', vector: [0.8, 0.2] },
    { id: 'shoe', vector: [0.1, 0.9] },
    { id: 'shirt', vector: [0.9, 0.1] }
  ],
  topK: 2
})

assert.deepStrictEqual(hits.map(item => item.id), ['shirt', 'coat'])

console.log('retrieval-ranking.test.js passed')
