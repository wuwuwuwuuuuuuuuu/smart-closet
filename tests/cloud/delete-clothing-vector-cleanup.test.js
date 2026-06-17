const assert = require('assert')
const { collectCloudFileIds } = require('../../cloudfunctions/deleteClothing/utils/delete-helpers')

assert.deepStrictEqual(
  collectCloudFileIds({ image: 'cloud://a', originalImage: 'cloud://a' }),
  ['cloud://a']
)

assert.deepStrictEqual(
  collectCloudFileIds({ image: 'https://example.com/a.jpg', originalImage: 'cloud://b' }),
  ['cloud://b']
)

assert.deepStrictEqual(collectCloudFileIds({}), [])

console.log('delete-clothing-vector-cleanup.test.js passed')
