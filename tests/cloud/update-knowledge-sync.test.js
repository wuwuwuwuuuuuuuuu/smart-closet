const assert = require('assert')
const {
  normalizeTagList,
  buildInferredProfile,
  hasKnowledgeRelevantChanges,
  buildKnowledgeSyncResetFields
} = require('../../cloudfunctions/updateClothing/utils/knowledge-sync')

assert.deepStrictEqual(
  normalizeTagList(['commute', ' commute ', '', null, 'minimal']),
  ['commute', 'minimal']
)

const inferredProfile = buildInferredProfile({
  name: 'black slim blazer',
  category: 'outer',
  tags: ['commute']
})
assert.ok(inferredProfile.colors.includes('black'))
assert.ok(inferredProfile.styleTags.includes('formal'))
assert.ok(inferredProfile.occasionTags.includes('commute'))
assert.ok(inferredProfile.fitTags.includes('slim'))

assert.strictEqual(
  hasKnowledgeRelevantChanges(
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
  hasKnowledgeRelevantChanges(
    {
      name: 'white shirt',
      image: 'cloud://1',
      tags: ['commute']
    },
    {
      name: 'white shirt',
      image: 'cloud://2',
      tags: ['commute']
    }
  ),
  true
)

const pendingReset = buildKnowledgeSyncResetFields({
  name: 'white shirt',
  image: 'cloud://1',
  category: 'top',
  tags: ['commute']
})
assert.strictEqual(pendingReset.knowledge_sync_status, 'pending')
assert.strictEqual(pendingReset.knowledge_doc_id, '')
assert.strictEqual(pendingReset.bailian_doc_id, '')
assert.strictEqual(pendingReset.knowledge_sync_job_id, '')
assert.deepStrictEqual(pendingReset.user_tags, ['commute'])
assert.ok(pendingReset.merged_tags.includes('commute'))
assert.ok(pendingReset.retrieval_text.includes('user_tags: commute'))

const skippedReset = buildKnowledgeSyncResetFields({
  name: 'no image item'
})
assert.strictEqual(skippedReset.knowledge_sync_status, 'skipped_no_image')

console.log('update-knowledge-sync.test.js passed')
