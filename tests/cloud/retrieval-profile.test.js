const assert = require('assert')
const {
  normalizeTagList,
  splitSeasonText,
  buildInferredProfile,
  buildMergedTags,
  buildRetrievalTags,
  buildRetrievalText,
  buildKnowledgeSyncFields
} = require('../../cloudfunctions/addClothing/utils/retrieval-profile')

assert.deepStrictEqual(
  normalizeTagList(['commute', ' commute ', '', null, 'minimal']),
  ['commute', 'minimal']
)

assert.deepStrictEqual(
  splitSeasonText('spring/ autumn,winter'),
  ['spring', 'autumn', 'winter']
)

const inferredProfile = buildInferredProfile({
  name: 'white slim knit blazer',
  category: 'top',
  season: 'spring/autumn',
  tags: ['commute', 'minimal'],
  material: 'knit',
  brand: 'UNIQLO'
})

assert.ok(inferredProfile.colors.includes('white'))
assert.ok(inferredProfile.styleTags.includes('minimal'))
assert.ok(inferredProfile.styleTags.includes('formal'))
assert.ok(inferredProfile.occasionTags.includes('commute'))
assert.ok(inferredProfile.fitTags.includes('slim'))

assert.deepStrictEqual(
  buildRetrievalTags({
    category: 'top',
    season: 'spring/autumn',
    tags: ['commute', 'commute', ''],
    material: 'knit',
    brand: 'UNIQLO',
    name: 'white knit top'
  }).slice(0, 6),
  ['top', 'spring', 'autumn', 'commute', 'white', 'minimal']
)

const mergedTags = buildMergedTags({
  category: 'top',
  season: 'spring/autumn',
  tags: ['commute', 'minimal'],
  material: 'knit',
  brand: 'UNIQLO',
  name: 'white knit top'
})
assert.ok(mergedTags.includes('white'))
assert.ok(mergedTags.includes('commute'))
assert.ok(mergedTags.includes('white knit top'))

const retrievalText = buildRetrievalText({
  name: 'white knit top',
  category: 'top',
  season: 'spring/autumn',
  tags: ['commute', 'minimal'],
  material: 'knit',
  brand: 'UNIQLO'
})

assert.ok(retrievalText.includes('name: white knit top'))
assert.ok(retrievalText.includes('category: top'))
assert.ok(retrievalText.includes('user_tags: commute, minimal'))
assert.ok(retrievalText.includes('colors: white'))
assert.ok(retrievalText.includes('style_tags:'))
assert.ok(retrievalText.includes('merged_tags:'))

const pendingSyncFields = buildKnowledgeSyncFields({
  image: 'cloud://item-image',
  name: 'white knit top',
  category: 'top',
  season: 'spring/autumn',
  tags: ['commute'],
  originalImage: 'cloud://original-image'
})

assert.strictEqual(pendingSyncFields.originalImage, 'cloud://original-image')
assert.strictEqual(pendingSyncFields.knowledge_doc_id, '')
assert.strictEqual(pendingSyncFields.bailian_file_id, '')
assert.strictEqual(pendingSyncFields.bailian_doc_id, '')
assert.strictEqual(pendingSyncFields.knowledge_sync_provider, 'bailian')
assert.strictEqual(pendingSyncFields.knowledge_sync_status, 'pending')
assert.strictEqual(pendingSyncFields.knowledge_sync_error, '')
assert.strictEqual(pendingSyncFields.knowledge_last_sync_at, null)
assert.deepStrictEqual(pendingSyncFields.user_tags, ['commute'])
assert.ok(Array.isArray(pendingSyncFields.merged_tags))
assert.ok(pendingSyncFields.merged_tags.includes('commute'))
assert.ok(pendingSyncFields.retrieval_tags.includes('commute'))
assert.ok(pendingSyncFields.retrieval_text.includes('merged_tags:'))

const skippedSyncFields = buildKnowledgeSyncFields({
  name: 'no image item'
})
assert.strictEqual(skippedSyncFields.knowledge_sync_status, 'skipped_no_image')

console.log('retrieval-profile.test.js passed')
