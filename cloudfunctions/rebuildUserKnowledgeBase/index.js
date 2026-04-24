const cloud = require('wx-server-sdk')
const {
  buildLegacyKnowledgePatch,
  normalizeText,
  shouldSyncClothing,
  summarizeRebuildResults,
  buildRebuildDiagnostics
} = require('./utils/rebuild-helpers')
const {
  ensureKnowledgeBinding,
  uploadClothingToKnowledge,
  checkDocumentSyncStatus,
  serializeProviderError,
  probeKnowledgeAccess
} = require('./utils/bailian-provider')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function findUserByOpenid(openid) {
  const userRes = await db.collection('users')
    .where({ _openid: openid })
    .orderBy('createdAt', 'desc')
    .get()

  return Array.isArray(userRes.data) && userRes.data.length ? userRes.data[0] : null
}

async function patchLegacyClothes(clothesList = []) {
  for (const clothing of clothesList) {
    const patch = buildLegacyKnowledgePatch(clothing)
    const updateData = {
      user_tags: patch.user_tags,
      inferred_profile: patch.inferred_profile,
      merged_tags: patch.merged_tags,
      retrieval_tags: patch.retrieval_tags,
      retrieval_text: patch.retrieval_text,
      updated_at: db.serverDate()
    }

    if (!normalizeText(clothing.originalImage) && patch.originalImage) {
      updateData.originalImage = patch.originalImage
    }
    if (!normalizeText(clothing.bailian_file_id) && patch.bailian_file_id) {
      updateData.bailian_file_id = patch.bailian_file_id
    }
    if (!normalizeText(clothing.bailian_doc_id) && patch.bailian_doc_id) {
      updateData.bailian_doc_id = patch.bailian_doc_id
    }
    if (!normalizeText(clothing.knowledge_doc_id) && patch.knowledge_doc_id) {
      updateData.knowledge_doc_id = patch.knowledge_doc_id
    }
    if (!normalizeText(clothing.knowledge_sync_provider)) {
      updateData.knowledge_sync_provider = patch.knowledge_sync_provider
    }
    if (!normalizeText(clothing.knowledge_sync_status)) {
      updateData.knowledge_sync_status = patch.knowledge_sync_status
    }
    if (clothing.knowledge_sync_error === undefined) {
      updateData.knowledge_sync_error = patch.knowledge_sync_error
    }
    if (clothing.knowledge_last_sync_at === undefined) {
      updateData.knowledge_last_sync_at = patch.knowledge_last_sync_at
    }
    if (!normalizeText(clothing.knowledge_sync_job_id) && patch.knowledge_sync_job_id) {
      updateData.knowledge_sync_job_id = patch.knowledge_sync_job_id
    }
    if (!normalizeText(clothing.knowledge_sync_file_name) && patch.knowledge_sync_file_name) {
      updateData.knowledge_sync_file_name = patch.knowledge_sync_file_name
    }

    Object.assign(clothing, updateData)
    await db.collection('clothes').doc(clothing._id).update({ data: updateData })
  }
}

function pickSyncingClothes(clothesList = [], limit = 3) {
  return clothesList
    .filter(item => normalizeText(item && item.knowledge_sync_status) === 'syncing' && normalizeText(item && item.knowledge_sync_job_id))
    .slice(0, limit)
}

function buildResponseData({
  knowledgeId,
  mode,
  requestMode,
  summary,
  diagnostics,
  results,
  maxDiagnostics = 5
}) {
  const sampleFailures = results
    .filter(item => item.status === 'failed')
    .slice(0, 5)
  const sampleQueued = results
    .filter(item => item.status === 'queued' || item.status === 'syncing')
    .slice(0, 5)
  const sampleDiagnostics = diagnostics.diagnostics
    .filter(item => item.reason !== 'already_synced')
    .slice(0, maxDiagnostics)

  return {
    knowledgeId,
    mode,
    requestMode,
    ...summary,
    skippedCount: diagnostics.skippedCount,
    inventorySummary: diagnostics.inventorySummary,
    skipReasonStats: diagnostics.skipReasonStats,
    sampleFailures,
    sampleQueued,
    sampleDiagnostics
  }
}

async function markClothingSyncFailed({ clothing, providerError }) {
  const failedData = {
    bailian_file_id: '',
    bailian_doc_id: '',
    knowledge_doc_id: '',
    knowledge_sync_provider: 'bailian',
    knowledge_sync_status: 'failed',
    knowledge_sync_error: providerError.message,
    knowledge_sync_job_id: '',
    knowledge_sync_file_name: '',
    updated_at: db.serverDate()
  }

  await db.collection('clothes').doc(clothing._id).update({
    data: failedData
  })

  Object.assign(clothing, failedData)
}

async function updateSyncingClothing({ clothing, knowledgeId }) {
  const statusResult = await checkDocumentSyncStatus({
    knowledgeId,
    jobId: clothing.knowledge_sync_job_id,
    fileName: clothing.knowledge_sync_file_name
  })

  if (!statusResult.ready) {
    return {
      clothingId: clothing._id,
      status: 'syncing',
      jobId: clothing.knowledge_sync_job_id
    }
  }

  await db.collection('clothes').doc(clothing._id).update({
    data: {
      bailian_file_id: statusResult.fileId || clothing.bailian_file_id || '',
      bailian_doc_id: statusResult.documentId,
      knowledge_doc_id: statusResult.documentId,
      knowledge_sync_provider: 'bailian',
      knowledge_sync_status: 'ready',
      knowledge_sync_error: '',
      knowledge_sync_job_id: '',
      knowledge_sync_file_name: '',
      knowledge_last_sync_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  })
  Object.assign(clothing, {
    bailian_file_id: statusResult.fileId || clothing.bailian_file_id || '',
    bailian_doc_id: statusResult.documentId,
    knowledge_doc_id: statusResult.documentId,
    knowledge_sync_provider: 'bailian',
    knowledge_sync_status: 'ready',
    knowledge_sync_error: '',
    knowledge_sync_job_id: '',
    knowledge_sync_file_name: ''
  })

  return {
    clothingId: clothing._id,
    status: 'ready',
    documentId: statusResult.documentId,
    fileId: statusResult.fileId || ''
  }
}

async function queueClothingSync({ clothing, knowledgeId, waitForReady }) {
  const uploadResult = await uploadClothingToKnowledge({
    clothing,
    knowledgeId,
    waitForReady
  })

  if (uploadResult.documentId) {
    await db.collection('clothes').doc(clothing._id).update({
      data: {
        bailian_file_id: uploadResult.fileId,
        bailian_doc_id: uploadResult.documentId,
        knowledge_doc_id: uploadResult.documentId,
        knowledge_sync_provider: 'bailian',
        knowledge_sync_status: 'ready',
        knowledge_sync_error: '',
        knowledge_sync_job_id: '',
        knowledge_sync_file_name: '',
        knowledge_last_sync_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    })
    Object.assign(clothing, {
      bailian_file_id: uploadResult.fileId,
      bailian_doc_id: uploadResult.documentId,
      knowledge_doc_id: uploadResult.documentId,
      knowledge_sync_provider: 'bailian',
      knowledge_sync_status: 'ready',
      knowledge_sync_error: '',
      knowledge_sync_job_id: '',
      knowledge_sync_file_name: ''
    })

    return {
      clothingId: clothing._id,
      status: 'synced',
      documentId: uploadResult.documentId,
      fileId: uploadResult.fileId
    }
  }

  await db.collection('clothes').doc(clothing._id).update({
    data: {
      bailian_file_id: uploadResult.fileId,
      knowledge_sync_provider: 'bailian',
      knowledge_sync_status: 'syncing',
      knowledge_sync_error: '',
      knowledge_sync_job_id: uploadResult.jobId,
      knowledge_sync_file_name: uploadResult.fileName,
      updated_at: db.serverDate()
    }
  })
  Object.assign(clothing, {
    bailian_file_id: uploadResult.fileId,
    knowledge_sync_provider: 'bailian',
    knowledge_sync_status: 'syncing',
    knowledge_sync_error: '',
    knowledge_sync_job_id: uploadResult.jobId,
    knowledge_sync_file_name: uploadResult.fileName
  })

  return {
    clothingId: clothing._id,
    status: 'queued',
    fileId: uploadResult.fileId,
    jobId: uploadResult.jobId
  }
}

exports.main = async (event = {}) => {
  try {
    if (event.debugAuth) {
      return {
        code: 200,
        message: 'auth debug',
        data: await probeKnowledgeAccess()
      }
    }

    const wxContext = cloud.getWXContext()
    const openid = normalizeText(wxContext.OPENID) || normalizeText(event.targetOpenid)
    const user = await findUserByOpenid(openid)

    if (!user) {
      return {
        code: 404,
        message: 'user not found'
      }
    }

    const knowledgeId = await ensureKnowledgeBinding({ db, user })

    const clothesRes = await db.collection('clothes')
      .where({ user_id: user._id })
      .orderBy('created_at', 'desc')
      .get()

    const clothesList = Array.isArray(clothesRes.data) ? clothesRes.data : []
    if (!clothesList.length) {
      return {
        code: 422,
        message: 'wardrobe empty'
      }
    }

    await patchLegacyClothes(clothesList)

    const forceResync = Boolean(event.forceResync)
    const limit = typeof event.limit === 'number' && event.limit > 0 ? event.limit : 30
    const waitForReady = event.waitForReady === true
    const diagnoseOnly = event.diagnose === true || event.diagnosticOnly === true

    const diagnostics = buildRebuildDiagnostics(clothesList, { forceResync })
    if (diagnoseOnly) {
      return {
        code: 200,
        message: 'diagnose finished',
        data: buildResponseData({
          knowledgeId,
          mode: 'diagnose',
          requestMode: forceResync ? 'forceResync' : 'normal',
          summary: summarizeRebuildResults([]),
          diagnostics,
          results: [],
          maxDiagnostics: 10
        })
      }
    }

    const syncingItems = pickSyncingClothes(clothesList, limit)
    const syncingIdSet = new Set(syncingItems.map(item => item._id))
    const candidates = clothesList
      .filter(item => !syncingIdSet.has(item._id) && shouldSyncClothing(item, { forceResync }))
      .slice(0, limit)

    if (!syncingItems.length && !candidates.length) {
      return {
        code: 200,
        message: 'nothing to sync',
        data: buildResponseData({
          knowledgeId,
          mode: waitForReady ? 'waitForReady' : 'asyncQueue',
          requestMode: forceResync ? 'forceResync' : 'normal',
          summary: summarizeRebuildResults([]),
          diagnostics,
          results: []
        })
      }
    }

    const results = []

    for (const clothing of syncingItems) {
      try {
        results.push(await updateSyncingClothing({ clothing, knowledgeId }))
      } catch (error) {
        const providerError = serializeProviderError(error)
        await markClothingSyncFailed({ clothing, providerError })

        results.push({
          clothingId: clothing._id,
          status: 'failed',
          error: providerError.message,
          errorCode: providerError.code,
          statusCode: providerError.statusCode,
          requestId: providerError.requestId
        })
      }
    }

    for (const clothing of candidates) {
      try {
        results.push(await queueClothingSync({
          clothing,
          knowledgeId,
          waitForReady
        }))
      } catch (error) {
        const providerError = serializeProviderError(error)
        await markClothingSyncFailed({ clothing, providerError })

        results.push({
          clothingId: clothing._id,
          status: 'failed',
          error: providerError.message,
          errorCode: providerError.code,
          statusCode: providerError.statusCode,
          requestId: providerError.requestId
        })
      }
    }

    const summary = summarizeRebuildResults(results)
    const refreshedClothesRes = await db.collection('clothes')
      .where({ user_id: user._id })
      .orderBy('created_at', 'desc')
      .get()
    const freshClothesList = Array.isArray(refreshedClothesRes.data) ? refreshedClothesRes.data : clothesList
    const freshDiagnostics = buildRebuildDiagnostics(freshClothesList, { forceResync })

    return {
      code: 200,
      message: 'rebuild finished',
      data: buildResponseData({
        knowledgeId,
        mode: waitForReady ? 'waitForReady' : 'asyncQueue',
        requestMode: forceResync ? 'forceResync' : 'normal',
        summary,
        diagnostics: freshDiagnostics,
        results
      })
    }
  } catch (error) {
    return {
      code: 500,
      message: 'rebuild failed',
      error: error.message
    }
  }
}
