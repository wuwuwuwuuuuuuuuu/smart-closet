const assert = require('assert')
const {
  pickPendingKnowledgeSyncClothes,
  buildKnowledgeUploadDetail,
  syncPendingClothesToKnowledge
} = require('../../cloudfunctions/smartRecommendPhoto/utils/knowledge-sync-service')

assert.deepStrictEqual(
  pickPendingKnowledgeSyncClothes([
    { _id: 'c1', image: 'cloud://1', retrieval_text: 'white shirt', knowledge_sync_status: 'pending' },
    { _id: 'c2', image: 'cloud://2', knowledge_sync_status: 'ready', bailian_doc_id: 'doc_2' },
    { _id: 'c3', retrieval_text: 'black jeans', knowledge_sync_status: 'failed' },
    { _id: 'c4', image: 'cloud://4', knowledge_sync_status: 'failed' }
  ], 3).map(item => item._id),
  ['c1', 'c4']
)

const uploadDetail = buildKnowledgeUploadDetail({
  _id: 'c1',
  image: 'cloud://folder/item.png',
  name: 'white shirt',
  category: 'top',
  retrieval_text: 'white shirt for commute'
})
assert.strictEqual(uploadDetail.clothingId, 'c1')
assert.strictEqual(uploadDetail.fileName, 'c1.md')
assert.ok(uploadDetail.content.includes('clothes_id: c1'))

function createMockDb(initialClothes = []) {
  const clothes = initialClothes.map(item => ({ ...item }))

  return {
    serverDate() {
      return { $date: 'serverDate' }
    },
    collection(name) {
      if (name !== 'clothes') {
        throw new Error(`unsupported collection: ${name}`)
      }

      return {
        doc(id) {
          return {
            async update({ data }) {
              const target = clothes.find(item => item._id === id)
              Object.assign(target, data)
            }
          }
        }
      }
    },
    getClothes() {
      return clothes
    }
  }
}

;(async () => {
  const db = createMockDb([
    { _id: 'c1', image: 'cloud://1', knowledge_sync_status: 'pending', name: 'white shirt', retrieval_text: 'white shirt' },
    {
      _id: 'c2',
      image: 'cloud://2',
      knowledge_sync_status: 'pending',
      name: 'black pants',
      retrieval_text: 'black pants',
      bailian_file_id: 'file_old'
    }
  ])

  let uploadCount = 0
  const provider = {
    async uploadFileDocument({ knowledgeId, fileBuffer, fileName }) {
      uploadCount += 1
      assert.strictEqual(knowledgeId, 'kb_001')
      assert.ok(Buffer.isBuffer(fileBuffer))
      assert.ok(fileName.endsWith('.md'))

      if (uploadCount === 2) {
        throw new Error('upload failed')
      }

      return {
        fileId: `file_${uploadCount}`,
        documentId: `doc_${uploadCount}`
      }
    }
  }

  const originalError = console.error
  console.error = () => {}

  const summary = await syncPendingClothesToKnowledge({
    db,
    knowledgeId: 'kb_001',
    clothesList: db.getClothes(),
    provider,
    maxItems: 2
  })

  console.error = originalError

  assert.strictEqual(summary.total, 2)
  assert.strictEqual(summary.syncedCount, 1)
  assert.strictEqual(summary.failedCount, 1)
  assert.strictEqual(db.getClothes()[0].bailian_doc_id, 'doc_1')
  assert.strictEqual(db.getClothes()[0].bailian_file_id, 'file_1')
  assert.strictEqual(db.getClothes()[0].knowledge_sync_status, 'ready')
  assert.strictEqual(db.getClothes()[1].knowledge_sync_status, 'failed')
  assert.strictEqual(db.getClothes()[1].bailian_file_id, '')
  assert.strictEqual(db.getClothes()[1].bailian_doc_id || '', '')
  assert.strictEqual(db.getClothes()[1].knowledge_doc_id || '', '')

  console.log('knowledge-sync-service.test.js passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
