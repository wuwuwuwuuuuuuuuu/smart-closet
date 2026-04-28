const assert = require('assert')
const { buildImageKnowledgeFields } = require('../../cloudfunctions/common/clothing-image-fields')

let result = buildImageKnowledgeFields({ image: ' cloud://a ', originalImage: 'cloud://raw' })
assert.strictEqual(result.primaryImage, 'cloud://a')
assert.strictEqual(result.status, 'pending')

result = buildImageKnowledgeFields({})
assert.strictEqual(result.primaryImage, '')
assert.strictEqual(result.status, 'skipped_no_image')

result = buildImageKnowledgeFields({ image: 'cloud://b', previousImage: 'cloud://a' })
assert.strictEqual(result.imageChanged, true)

console.log('clothing-image-fields.test.js passed')
