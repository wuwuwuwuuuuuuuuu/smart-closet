const assert = require('assert')
const {
  normalizeTagList,
  hasVectorRelevantChanges,
  buildImageEmbeddingResetFields,
  buildVectorMetadata
} = require('../../cloudfunctions/updateClothing/utils/image-vector-sync')

assert.deepStrictEqual(
  normalizeTagList(['commute', ' commute ', '', null, 'minimal']),
  ['commute', 'minimal']
)

assert.strictEqual(
  hasVectorRelevantChanges(
    {
      name: 'white shirt',
      image: 'cloud://1',
      originalImage: 'cloud://o1',
      season: 'spring',
      category: 'top',
      tags: ['commute'],
      material: 'cotton',
      brand: 'UNIQLO'
    },
    {
      name: 'white shirt',
      image: 'cloud://1',
      originalImage: 'cloud://o1',
      season: 'spring',
      category: 'top',
      tags: ['commute'],
      material: 'cotton',
      brand: 'UNIQLO'
    }
  ),
  false
)

assert.strictEqual(
  hasVectorRelevantChanges(
    { name: 'white shirt', image: 'cloud://1', tags: ['commute'] },
    { name: 'white shirt', image: 'cloud://2', tags: ['commute'] }
  ),
  true
)

const pendingReset = buildImageEmbeddingResetFields({ image: 'cloud://1' })
assert.strictEqual(pendingReset.image_embedding_status, 'pending')
assert.strictEqual(pendingReset.image_embedding_error, '')
assert.strictEqual(pendingReset.image_embedding_dim, 0)
assert(!Object.prototype.hasOwnProperty.call(pendingReset, 'knowledge_sync_status'))

const skippedReset = buildImageEmbeddingResetFields({ image: '' })
assert.strictEqual(skippedReset.image_embedding_status, 'skipped_no_image')

assert.deepStrictEqual(
  buildVectorMetadata({ category: 'top', season: 'spring autumn', tags: ['commute'], material: 'cotton', name: 'shirt' }),
  ['top', 'spring', 'autumn', 'commute', 'cotton', 'shirt']
)

console.log('update-knowledge-sync.test.js passed')
