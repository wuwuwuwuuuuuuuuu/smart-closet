const { logError, logWarning } = require('./logger')
const {
  buildClothingKnowledgeMarkdown,
  buildKnowledgeFileName
} = require('./bailian-knowledge-provider')

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function pickPendingKnowledgeSyncClothes(clothesList = [], maxItems = 3) {
  if (!Array.isArray(clothesList)) {
    logWarning('knowledgeSyncService.pickPendingKnowledgeSyncClothes', 'invalid clothesList', {
      clothesListType: typeof clothesList
    })
    return []
  }

  return clothesList
    .filter(item => {
      const syncStatus = normalizeText(item && item.knowledge_sync_status)
      const knowledgeDocId = normalizeText(item && (item.bailian_doc_id || item.knowledge_doc_id))
      const image = normalizeText(item && item.image)

      return !knowledgeDocId
        && image
        && (!syncStatus || syncStatus === 'pending' || syncStatus === 'failed')
    })
    .slice(0, Math.max(0, maxItems))
}

function buildKnowledgeUploadDetail(item = {}) {
  const clothingId = normalizeText(item && item._id)
  if (!clothingId) {
    return null
  }

  const content = buildClothingKnowledgeMarkdown(item)
  return {
    fileId: normalizeText(item && item.image),
    fileName: buildKnowledgeFileName(item),
    clothingId,
    content
  }
}

async function updateClothingKnowledgeStatus({ db, clothingId, data }) {
  await db.collection('clothes').doc(clothingId).update({ data })
}

async function syncPendingClothesToKnowledge({
  db,
  knowledgeId,
  clothesList,
  provider,
  maxItems = 3
} = {}) {
  const pendingClothes = pickPendingKnowledgeSyncClothes(clothesList, maxItems)
  if (!pendingClothes.length) {
    return {
      total: 0,
      syncedCount: 0,
      failedCount: 0
    }
  }

  const results = []

  for (let index = 0; index < pendingClothes.length; index += 1) {
    const item = pendingClothes[index]
    const uploadDetail = buildKnowledgeUploadDetail(item)

    if (!uploadDetail) {
      logWarning('knowledgeSyncService.syncPendingClothesToKnowledge', 'missing clothingId for knowledge sync')
      continue
    }

    try {
      const uploadResult = await provider.uploadFileDocument({
        knowledgeId,
        clothing: item,
        fileBuffer: Buffer.from(uploadDetail.content, 'utf8'),
        fileName: uploadDetail.fileName
      })

      const documentId = normalizeText(uploadResult && uploadResult.documentId)
      const fileId = normalizeText(uploadResult && uploadResult.fileId)
      if (!documentId) {
        throw new Error(normalizeText(uploadResult && uploadResult.message) || 'empty documentId')
      }

      await updateClothingKnowledgeStatus({
        db,
        clothingId: item._id,
        data: {
          bailian_file_id: fileId,
          bailian_doc_id: documentId,
          knowledge_doc_id: documentId,
          knowledge_sync_provider: 'bailian',
          knowledge_sync_status: 'ready',
          knowledge_sync_error: '',
          knowledge_last_sync_at: db.serverDate(),
          updated_at: db.serverDate()
        }
      })

      item.bailian_file_id = fileId
      item.bailian_doc_id = documentId
      item.knowledge_doc_id = documentId
      item.knowledge_sync_status = 'ready'
      results.push({ clothingId: item._id, status: 'ready', documentId, fileId })
    } catch (error) {
      logError('knowledgeSyncService.syncPendingClothesToKnowledge', error, {
        clothingId: item && item._id,
        knowledgeId
      })

      await updateClothingKnowledgeStatus({
        db,
        clothingId: item._id,
        data: {
          bailian_file_id: '',
          bailian_doc_id: '',
          knowledge_doc_id: '',
          knowledge_sync_provider: 'bailian',
          knowledge_sync_status: 'failed',
          knowledge_sync_error: error.message,
          knowledge_sync_job_id: '',
          knowledge_sync_file_name: '',
          updated_at: db.serverDate()
        }
      })

      item.bailian_file_id = ''
      item.bailian_doc_id = ''
      item.knowledge_doc_id = ''
      item.knowledge_sync_job_id = ''
      item.knowledge_sync_file_name = ''
      item.knowledge_sync_status = 'failed'
      results.push({ clothingId: item._id, status: 'failed' })
    }
  }

  return {
    total: results.length,
    syncedCount: results.filter(item => item.status === 'ready').length,
    failedCount: results.filter(item => item.status === 'failed').length
  }
}

module.exports = {
  pickPendingKnowledgeSyncClothes,
  buildKnowledgeUploadDetail,
  syncPendingClothesToKnowledge
}
