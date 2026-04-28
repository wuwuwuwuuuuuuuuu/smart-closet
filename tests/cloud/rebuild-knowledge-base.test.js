const assert = require('assert')
const {
  buildLegacyKnowledgePatch,
  shouldSyncClothing,
  summarizeRebuildResults,
  buildRebuildDiagnostics,
  getSyncDecision
} = require('../../cloudfunctions/rebuildUserKnowledgeBase/utils/rebuild-helpers')
const {
  buildConfigDebugSnapshot,
  serializeProviderError,
  purgeExistingKnowledgeEntries,
  ensureKnowledgeBinding,
  sanitizeKnowledgeTags
} = require('../../cloudfunctions/rebuildUserKnowledgeBase/utils/bailian-provider')

const patch = buildLegacyKnowledgePatch({
  name: 'white shirt',
  category: 'top',
  season: 'spring/autumn',
  tags: ['commute', 'minimal'],
  material: 'cotton',
  brand: 'UNIQLO'
})

assert.strictEqual(patch.knowledge_sync_status, 'skipped_no_image')
assert.strictEqual(patch.knowledge_doc_id, '')
assert.strictEqual(patch.bailian_doc_id, '')
assert.strictEqual(patch.knowledge_sync_provider, 'bailian')
assert.ok(patch.retrieval_text.includes('name: white shirt'))
assert.deepStrictEqual(patch.user_tags, ['commute', 'minimal'])
assert.ok(patch.inferred_profile.colors.includes('white'))
assert.ok(patch.retrieval_tags.includes('top'))
assert.ok(patch.retrieval_tags.includes('spring'))
assert.ok(patch.retrieval_tags.includes('minimal'))
assert.ok(patch.retrieval_tags.includes('white shirt'))

assert.strictEqual(
  shouldSyncClothing({ image: 'cloud://a', knowledge_sync_status: 'pending' }),
  true
)
assert.strictEqual(
  shouldSyncClothing({ image: 'cloud://a', bailian_doc_id: 'doc_1', knowledge_sync_status: 'ready' }),
  false
)
assert.strictEqual(
  shouldSyncClothing({ image: 'cloud://a', bailian_doc_id: 'doc_1' }, { forceResync: true }),
  true
)
assert.deepStrictEqual(
  getSyncDecision({ knowledge_sync_status: 'skipped_no_image' }),
  {
    canSync: false,
    reason: 'missing_image',
    syncStatus: 'skipped_no_image',
    hasImage: false,
    hasKnowledgeDoc: false
  }
)

assert.deepStrictEqual(
  summarizeRebuildResults([
    { status: 'synced' },
    { status: 'failed' },
    { status: 'skipped' },
    { status: 'ready' },
    { status: 'syncing' },
    { status: 'queued' }
  ]),
  {
    total: 6,
    readyCount: 1,
    syncedCount: 1,
    syncingCount: 1,
    queuedCount: 1,
    failedCount: 1,
    skippedCount: 1
  }
)

const diagnostics = buildRebuildDiagnostics([
  { _id: 'c1', name: 'with image pending', image: 'cloud://1', knowledge_sync_status: 'pending' },
  { _id: 'c2', name: 'with image ready', image: 'cloud://2', knowledge_sync_status: 'ready', knowledge_doc_id: 'doc_2' },
  { _id: 'c3', name: 'no image item', knowledge_sync_status: 'skipped_no_image' },
  { _id: 'c4', name: 'with image failed', image: 'cloud://4', knowledge_sync_status: 'failed', knowledge_doc_id: 'doc_stale_4', knowledge_sync_error: 'import failed' },
  { _id: 'c5', name: 'syncing item', image: 'cloud://5', knowledge_sync_status: 'syncing', knowledge_sync_job_id: 'job_5' },
  { _id: 'c6', name: 'implicit pending', image: 'cloud://6' }
])

assert.deepStrictEqual(diagnostics.inventorySummary, {
  totalWardrobeCount: 6,
  syncableCount: 5,
  readyInKnowledgeCount: 1,
  missingKnowledgeCount: 4,
  missingImageCount: 1,
  pendingCount: 2,
  syncingCount: 1,
  failedCount: 1,
  skippedNoImageCount: 1
})
assert.strictEqual(diagnostics.skipReasonStats.missing_image, 1)
assert.strictEqual(diagnostics.skipReasonStats.already_synced, 1)
assert.strictEqual(diagnostics.skipReasonStats.syncing, 1)
assert.strictEqual(diagnostics.skipReasonStats.failed, 1)
assert.strictEqual(diagnostics.skippedCount, 3)
assert.strictEqual(diagnostics.diagnostics.find(item => item.clothingId === 'c4').isReadyInKnowledge, false)
assert.strictEqual(diagnostics.diagnostics.find(item => item.clothingId === 'c4').knowledge_sync_error, 'import failed')

const debugSnapshot = buildConfigDebugSnapshot({
  accessKeyId: 'LTAI1234567890',
  accessKeySecret: 'secret1234567890',
  workspaceId: 'ws-test',
  managementRegionId: 'cn-beijing',
  defaultCategoryId: 'default',
  fileParser: 'DASHSCOPE_DOCMIND'
})
assert.strictEqual(debugSnapshot.workspaceId, 'ws-test')
assert.strictEqual(debugSnapshot.regionId, 'cn-beijing')
assert.strictEqual(debugSnapshot.hasAccessKeyId, true)
assert.strictEqual(debugSnapshot.hasAccessKeySecret, true)
assert.ok(debugSnapshot.accessKeyIdMasked.includes('***'))

assert.deepStrictEqual(
  serializeProviderError({
    message: 'API token invalid',
    code: 'InvalidApiKey',
    statusCode: 401,
    data: {
      requestId: 'req-1',
      recommend: 'check key'
    }
  }),
  {
    message: 'API token invalid',
    code: 'InvalidApiKey',
    statusCode: '401',
    requestId: 'req-1',
    recommend: 'check key'
  }
)
assert.deepStrictEqual(
  sanitizeKnowledgeTags(['休闲 甜美 清凉', '通勤,简约', 'v-neck#']),
  ['休闲', '甜美', '清凉', '通勤', '简约', 'v-neck']
)

function createMockUserDb(initialUsers = []) {
  const users = initialUsers.map(item => ({ ...item }))

  return {
    serverDate() {
      return { $date: 'serverDate' }
    },
    collection(name) {
      if (name !== 'users') {
        throw new Error(`unsupported collection: ${name}`)
      }

      return {
        doc(id) {
          return {
            async update({ data }) {
              const target = users.find(user => user._id === id)
              if (!target) {
                throw new Error('user not found')
              }
              Object.assign(target, data)
            }
          }
        }
      }
    },
    getUsers() {
      return users
    }
  }
}

;(async () => {
  const deletedDocs = []
  const deletedFiles = []
  const fakeClient = {
    async listIndexDocuments() {
      return {
        body: {
          success: true,
          status: '200',
          data: {
            documents: [
              { id: 'doc_by_name_1', name: 'c1.md' },
              { id: 'doc_other', name: 'other.md' }
            ]
          }
        }
      }
    },
    async listFile(workspaceId, request) {
      return {
        body: {
          success: true,
          status: '200',
          data: {
            fileList: request.fileName === 'c1.md'
              ? [{ fileId: 'file_by_name_1', fileName: 'c1.md' }]
              : [{ fileId: 'file_by_name_2', fileName: 'c1' }]
          }
        }
      }
    },
    async deleteIndexDocument(workspaceId, request) {
      deletedDocs.push({
        workspaceId,
        documentIds: request.documentIds,
        indexId: request.indexId
      })
      return { body: { success: true, status: '200' } }
    },
    async deleteFile(fileId) {
      if (fileId === 'file_saved_1') {
        throw new Error("Can't find out file for your file_id parameter.")
      }
      deletedFiles.push(fileId)
      return { body: { success: true, status: '200' } }
    }
  }

  const purgeResult = await purgeExistingKnowledgeEntries({
    client: fakeClient,
    workspaceId: 'ws_1',
    knowledgeId: 'kb_1',
    clothing: {
      bailian_doc_id: 'doc_saved_1',
      bailian_file_id: 'file_saved_1'
    },
    fileName: 'c1.md'
  })

  assert.strictEqual(purgeResult.removedDocumentCount, 2)
  assert.strictEqual(purgeResult.removedFileCount, 3)
  assert.strictEqual(deletedDocs.length, 2)
  assert.deepStrictEqual(
    deletedDocs.map(item => item.documentIds[0]).sort(),
    ['doc_by_name_1', 'doc_saved_1']
  )
  assert.deepStrictEqual(deletedFiles.sort(), ['file_by_name_1', 'file_by_name_2'])

  const restoreDb = createMockUserDb([
    {
      _id: 'user_1',
      bailian_knowledge_id: 'kb_missing',
      knowledge_id: 'kb_missing'
    }
  ])

  const restoredKnowledgeId = await ensureKnowledgeBinding({
    db: restoreDb,
    user: restoreDb.getUsers()[0],
    providerApi: {
      async knowledgeBaseExists() {
        return false
      },
      async findKnowledgeBaseByName(name) {
        assert.strictEqual(name, 'sc_user_1')
        return { id: 'kb_reused_1' }
      }
    }
  })

  assert.strictEqual(restoredKnowledgeId, 'kb_reused_1')
  assert.strictEqual(restoreDb.getUsers()[0].bailian_knowledge_id, 'kb_reused_1')
  assert.strictEqual(restoreDb.getUsers()[0].bailian_knowledge_status, 'ready')

  const createDb = createMockUserDb([
    {
      _id: 'user_2'
    }
  ])

  const createdKnowledgeId = await ensureKnowledgeBinding({
    db: createDb,
    user: createDb.getUsers()[0],
    providerApi: {
      async knowledgeBaseExists() {
        return false
      },
      async findKnowledgeBaseByName() {
        return null
      },
      async createKnowledgeBase(payload) {
        assert.strictEqual(payload.name, 'sc_user_2')
        return { id: 'kb_created_2' }
      }
    }
  })

  assert.strictEqual(createdKnowledgeId, 'kb_created_2')
  assert.strictEqual(createDb.getUsers()[0].bailian_knowledge_id, 'kb_created_2')

  console.log('rebuild-knowledge-base.test.js passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
