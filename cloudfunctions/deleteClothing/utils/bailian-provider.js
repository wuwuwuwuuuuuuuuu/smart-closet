const axios = require('axios')
const crypto = require('crypto')
const BailianSdk = require('@alicloud/bailian20231229')
const BailianClient = BailianSdk.default
const { getBailianConfig, normalizeText } = require('./bailian-config')

let clientInstance = null

function createSdkRequest(ModelCtor, payload) {
  return new ModelCtor(payload)
}

function ensureConfig(config, fields) {
  const missing = fields.filter(field => !normalizeText(config[field]))
  if (missing.length) {
    throw new Error(`missing config: ${missing.join(', ')}`)
  }
}

function getClient(config = getBailianConfig()) {
  if (!clientInstance) {
    ensureConfig(config, ['accessKeyId', 'accessKeySecret'])
    clientInstance = new BailianClient({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      regionId: config.managementRegionId,
      endpoint: normalizeText(config.managementEndpoint) || undefined
    })
  }

  return clientInstance
}

function maskSecret(value, { prefix = 4, suffix = 4 } = {}) {
  const text = normalizeText(value)
  if (!text) {
    return ''
  }

  if (text.length <= prefix + suffix) {
    return `${'*'.repeat(Math.max(text.length - 2, 0))}${text.slice(-2)}`
  }

  return `${text.slice(0, prefix)}***${text.slice(-suffix)}`
}

function isSuccess(body = {}) {
  return body.success === true || body.success === 'true' || String(body.status || '') === '200'
}

function ensureSuccessBody(body = {}, scope) {
  if (!isSuccess(body)) {
    throw new Error(normalizeText(body.message) || normalizeText(body.code) || `${scope} failed`)
  }
  return body
}

function serializeProviderError(error) {
  const responseBody = error && error.response && error.response.body
  const responseData = error && error.response && error.response.data
  const data = responseBody || responseData || error.data || {}

  return {
    message: normalizeText(error && error.message) || 'unknown error',
    code: normalizeText(error && error.code) || normalizeText(data.code) || '',
    statusCode: error && error.statusCode ? String(error.statusCode) : '',
    requestId: normalizeText(data.requestId || data.RequestId) || '',
    recommend: normalizeText(data.recommend) || ''
  }
}

function isNotFoundLikeError(error) {
  const message = normalizeText(
    (error && error.message)
    || (error && error.data && error.data.message)
    || (error && error.response && error.response.body && error.response.body.message)
  ).toLowerCase()

  return message.includes('not exist')
    || message.includes('not found')
    || message.includes("can't find out file")
    || message.includes('cant find out file')
    || message.includes('cannot find file')
    || message.includes('file_id parameter')
}

function sanitizeKnowledgeTags(tags = []) {
  if (!Array.isArray(tags)) {
    return []
  }

  const result = []
  tags.forEach(item => {
    const raw = normalizeText(item)
    if (!raw) {
      return
    }

    raw
      .split(/[\s,，、/|;；]+/)
      .map(segment => normalizeText(segment).replace(/[^0-9a-zA-Z_\-\u4e00-\u9fa5]/g, ''))
      .filter(Boolean)
      .forEach(segment => {
        if (!result.includes(segment)) {
          result.push(segment)
        }
      })
  })

  return result.slice(0, 10)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function buildKnowledgeBaseName(user = {}) {
  const userId = normalizeText(user._id)
  const safeBase = (userId || 'user')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 17)

  return `sc_${safeBase || 'user'}`
}

function buildConfigDebugSnapshot(config = getBailianConfig()) {
  return {
    workspaceId: normalizeText(config.workspaceId),
    regionId: normalizeText(config.managementRegionId),
    endpoint: normalizeText(config.managementEndpoint),
    defaultCategoryId: normalizeText(config.defaultCategoryId),
    fileParser: normalizeText(config.fileParser),
    hasAccessKeyId: Boolean(normalizeText(config.accessKeyId)),
    hasAccessKeySecret: Boolean(normalizeText(config.accessKeySecret)),
    accessKeyIdMasked: maskSecret(config.accessKeyId),
    accessKeySecretMasked: maskSecret(config.accessKeySecret)
  }
}

function buildKnowledgeMarkdown(clothing = {}) {
  const tags = Array.isArray(clothing.retrieval_tags)
    ? clothing.retrieval_tags.map(item => normalizeText(item)).filter(Boolean)
    : []
  const userTags = Array.isArray(clothing.user_tags)
    ? clothing.user_tags.map(item => normalizeText(item)).filter(Boolean)
    : []
  const mergedTags = Array.isArray(clothing.merged_tags)
    ? clothing.merged_tags.map(item => normalizeText(item)).filter(Boolean)
    : tags
  const inferredProfile = clothing && typeof clothing.inferred_profile === 'object' && !Array.isArray(clothing.inferred_profile)
    ? clothing.inferred_profile
    : {}
  const colors = Array.isArray(inferredProfile.colors)
    ? inferredProfile.colors.map(item => normalizeText(item)).filter(Boolean)
    : []
  const styleTags = Array.isArray(inferredProfile.styleTags)
    ? inferredProfile.styleTags.map(item => normalizeText(item)).filter(Boolean)
    : []
  const occasionTags = Array.isArray(inferredProfile.occasionTags)
    ? inferredProfile.occasionTags.map(item => normalizeText(item)).filter(Boolean)
    : []
  const fitTags = Array.isArray(inferredProfile.fitTags)
    ? inferredProfile.fitTags.map(item => normalizeText(item)).filter(Boolean)
    : []

  return [
    '# Smart Closet Clothing Item',
    `clothes_id: ${normalizeText(clothing._id) || 'unknown'}`,
    `name: ${normalizeText(clothing.name) || 'unknown'}`,
    `category: ${normalizeText(clothing.category) || 'unknown'}`,
    `season: ${normalizeText(clothing.season) || 'unknown'}`,
    `material: ${normalizeText(clothing.material) || 'unknown'}`,
    `brand: ${normalizeText(clothing.brand) || 'unknown'}`,
    `user_tags: ${userTags.join(', ') || 'none'}`,
    `merged_tags: ${mergedTags.join(', ') || 'none'}`,
    `colors: ${colors.join(', ') || 'unknown'}`,
    `style_tags: ${styleTags.join(', ') || 'unknown'}`,
    `occasion_tags: ${occasionTags.join(', ') || 'unknown'}`,
    `fit_tags: ${fitTags.join(', ') || 'unknown'}`,
    `tags: ${tags.join(', ') || 'none'}`,
    `image_file_id: ${normalizeText(clothing.image) || 'unknown'}`,
    '',
    'retrieval_text:',
    normalizeText(clothing.retrieval_text) || 'none',
    ''
  ].join('\n')
}

async function knowledgeBaseExists(knowledgeId, overrides = {}) {
  const config = { ...getBailianConfig(), ...overrides }
  ensureConfig(config, ['accessKeyId', 'accessKeySecret', 'workspaceId'])
  const normalizedKnowledgeId = normalizeText(knowledgeId)
  if (!normalizedKnowledgeId) {
    return false
  }

  const client = getClient(config)
  const response = await client.listIndices(config.workspaceId, createSdkRequest(BailianSdk.ListIndicesRequest, {
    pageNumber: 1,
    pageSize: 100
  }))
  const body = ensureSuccessBody(response.body || {}, 'listIndices')
  const data = body.data || {}
  const indices = Array.isArray(data.indices) ? data.indices : []

  return indices.some(item => normalizeText(item.id) === normalizedKnowledgeId)
}

async function findKnowledgeBaseByName(name, overrides = {}) {
  const config = { ...getBailianConfig(), ...overrides }
  ensureConfig(config, ['accessKeyId', 'accessKeySecret', 'workspaceId'])
  const normalizedName = normalizeText(name)
  if (!normalizedName) {
    return null
  }

  const client = getClient(config)
  const response = await client.listIndices(config.workspaceId, createSdkRequest(BailianSdk.ListIndicesRequest, {
    pageNumber: 1,
    pageSize: 100
  }))
  const body = ensureSuccessBody(response.body || {}, 'listIndices')
  const data = body.data || {}
  const indices = Array.isArray(data.indices) ? data.indices : []
  const matched = indices.find(item => normalizeText(item.name) === normalizedName)
  if (!matched) {
    return null
  }

  return {
    id: normalizeText(matched.id),
    name: normalizeText(matched.name)
  }
}

async function uploadLeaseBinary({ url, method, headers, buffer }) {
  await axios({
    method: normalizeText(method).toLowerCase() || 'put',
    url,
    data: buffer,
    headers: headers || {},
    timeout: 30000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus(status) {
      return status >= 200 && status < 300
    }
  })
}

function buildFileNameCandidates(fileName) {
  const normalizedFileName = normalizeText(fileName)
  if (!normalizedFileName) {
    return []
  }

  const baseName = normalizedFileName.replace(/\.[^.]+$/, '')
  return [...new Set([normalizedFileName, baseName].filter(Boolean))]
}

function isSameFileName(name, candidates = []) {
  const normalizedName = normalizeText(name)
  return candidates.includes(normalizedName)
}

async function listKnowledgeDocumentsByName({ client, workspaceId, knowledgeId, fileName }) {
  const fileNameCandidates = buildFileNameCandidates(fileName)
  if (!fileNameCandidates.length) {
    return []
  }

  const response = await client.listIndexDocuments(workspaceId, createSdkRequest(BailianSdk.ListIndexDocumentsRequest, {
    indexId: knowledgeId,
    pageNumber: 1,
    pageSize: 100
  }))
  const body = ensureSuccessBody(response.body || {}, 'listIndexDocuments')
  const documents = body.data && Array.isArray(body.data.documents) ? body.data.documents : []

  return documents.filter(item => isSameFileName(item.name, fileNameCandidates))
}

async function listKnowledgeFilesByName({ client, workspaceId, categoryId, fileName }) {
  const fileNameCandidates = buildFileNameCandidates(fileName)
  if (!fileNameCandidates.length) {
    return []
  }

  const files = []
  for (const candidate of fileNameCandidates) {
    const response = await client.listFile(workspaceId, createSdkRequest(BailianSdk.ListFileRequest, {
      categoryId,
      fileName: candidate,
      maxResults: 100
    }))
    const body = ensureSuccessBody(response.body || {}, 'listFile')
    const fileList = body.data && Array.isArray(body.data.fileList) ? body.data.fileList : []
    fileList.forEach(item => {
      if (isSameFileName(item.fileName, fileNameCandidates)) {
        files.push(item)
      }
    })
  }

  return files
}

async function deleteKnowledgeDocument({ client, workspaceId, knowledgeId, documentId }) {
  const normalizedDocumentId = normalizeText(documentId)
  if (!normalizedDocumentId) {
    return false
  }

  try {
    const response = await client.deleteIndexDocument(workspaceId, createSdkRequest(BailianSdk.DeleteIndexDocumentRequest, {
      indexId: knowledgeId,
      documentIds: [normalizedDocumentId]
    }))
    ensureSuccessBody(response.body || {}, 'deleteIndexDocument')
    return true
  } catch (error) {
    if (isNotFoundLikeError(error)) {
      return false
    }
    throw error
  }
}

async function deleteKnowledgeFile({ client, workspaceId, fileId }) {
  const normalizedFileId = normalizeText(fileId)
  if (!normalizedFileId) {
    return false
  }

  try {
    const response = await client.deleteFile(normalizedFileId, workspaceId, createSdkRequest(BailianSdk.DeleteFileRequest, {}))
    ensureSuccessBody(response.body || {}, 'deleteFile')
    return true
  } catch (error) {
    if (isNotFoundLikeError(error)) {
      return false
    }
    throw error
  }
}

async function purgeExistingKnowledgeEntries({ client, workspaceId, knowledgeId, clothing, fileName }) {
  const normalizedKnowledgeId = normalizeText(knowledgeId)
  if (!normalizedKnowledgeId) {
    throw new Error('knowledgeId is required')
  }

  const docIds = new Set()
  const fileIds = new Set()
  const normalizedDocumentId = normalizeText(clothing && (clothing.bailian_doc_id || clothing.knowledge_doc_id))
  const normalizedFileId = normalizeText(clothing && clothing.bailian_file_id)

  if (normalizedDocumentId) {
    docIds.add(normalizedDocumentId)
  }

  if (normalizedFileId) {
    fileIds.add(normalizedFileId)
  }

  const matchedDocuments = await listKnowledgeDocumentsByName({
    client,
    workspaceId,
    knowledgeId: normalizedKnowledgeId,
    fileName
  })
  matchedDocuments.forEach(item => {
    const matchedDocId = normalizeText(item.id)
    if (matchedDocId) {
      docIds.add(matchedDocId)
    }
  })

  const matchedFiles = await listKnowledgeFilesByName({
    client,
    workspaceId,
    categoryId: getBailianConfig().defaultCategoryId,
    fileName
  })
  matchedFiles.forEach(item => {
    const matchedFileId = normalizeText(item.fileId)
    if (matchedFileId) {
      fileIds.add(matchedFileId)
    }
  })

  for (const documentId of docIds) {
    await deleteKnowledgeDocument({
      client,
      workspaceId,
      knowledgeId: normalizedKnowledgeId,
      documentId
    })
  }

  for (const fileId of fileIds) {
    await deleteKnowledgeFile({
      client,
      workspaceId,
      fileId
    })
  }

  return {
    removedDocumentCount: docIds.size,
    removedFileCount: fileIds.size
  }
}

async function ensureKnowledgeBinding({ db, user, providerApi = {} }) {
  const currentKnowledgeId = normalizeText(user.bailian_knowledge_id || user.knowledge_id)
  const existingKnowledgeName = buildKnowledgeBaseName(user)
  const checkKnowledgeExists = typeof providerApi.knowledgeBaseExists === 'function'
    ? providerApi.knowledgeBaseExists
    : knowledgeBaseExists
  const findByName = typeof providerApi.findKnowledgeBaseByName === 'function'
    ? providerApi.findKnowledgeBaseByName
    : findKnowledgeBaseByName
  const createKnowledge = typeof providerApi.createKnowledgeBase === 'function'
    ? providerApi.createKnowledgeBase
    : null

  if (currentKnowledgeId) {
    try {
      if (await checkKnowledgeExists(currentKnowledgeId)) {
        await db.collection('users').doc(user._id).update({
          data: {
            bailian_knowledge_id: currentKnowledgeId,
            bailian_knowledge_status: 'ready',
            knowledge_id: currentKnowledgeId,
            knowledge_status: 'ready',
            knowledge_provider: 'bailian',
            updated_at: db.serverDate()
          }
        })
        return currentKnowledgeId
      }
    } catch (error) {
      throw error
    }

    await db.collection('users').doc(user._id).update({
      data: {
        bailian_knowledge_id: '',
        bailian_knowledge_status: 'unbound',
        knowledge_id: '',
        knowledge_status: 'unbound',
        knowledge_provider: 'bailian',
        updated_at: db.serverDate()
      }
    })
  }

  const reusedKnowledge = await findByName(existingKnowledgeName)
  const reusedKnowledgeId = normalizeText(reusedKnowledge && reusedKnowledge.id)
  if (reusedKnowledgeId) {
    const config = getBailianConfig()
    await db.collection('users').doc(user._id).update({
      data: {
        bailian_knowledge_id: reusedKnowledgeId,
        bailian_workspace_id: config.workspaceId,
        bailian_knowledge_status: 'ready',
        knowledge_id: reusedKnowledgeId,
        knowledge_status: 'ready',
        knowledge_provider: 'bailian',
        knowledge_bound_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    })

    return reusedKnowledgeId
  }

  const config = getBailianConfig()
  ensureConfig(config, ['accessKeyId', 'accessKeySecret', 'workspaceId'])
  let knowledgeId = ''

  if (createKnowledge) {
    const created = await createKnowledge({
      name: existingKnowledgeName,
      description: `smart-closet wardrobe knowledge for user ${normalizeText(user._id)}`
    })
    knowledgeId = normalizeText(created && (created.id || created.knowledge_id))
  } else {
    const client = getClient(config)
    const createResponse = await client.createIndex(config.workspaceId, createSdkRequest(BailianSdk.CreateIndexRequest, {
      name: existingKnowledgeName,
      description: `smart-closet wardrobe knowledge for user ${normalizeText(user._id)}`,
      structureType: 'unstructured',
      sourceType: 'DATA_CENTER_CATEGORY',
      categoryIds: [config.defaultCategoryId],
      sinkType: 'BUILT_IN',
      chunkSize: config.chunkSize,
      overlapSize: config.overlapSize,
      enableRewrite: true
    }))
    const createBody = ensureSuccessBody(createResponse.body || {}, 'createIndex')
    knowledgeId = normalizeText(createBody.data && createBody.data.id)
    if (!knowledgeId) {
      throw new Error('createIndex returned empty id')
    }

    await client.submitIndexJob(config.workspaceId, createSdkRequest(BailianSdk.SubmitIndexJobRequest, {
      indexId: knowledgeId
    }))
  }

  if (!knowledgeId) {
    throw new Error('createIndex returned empty id')
  }

  await db.collection('users').doc(user._id).update({
    data: {
      bailian_knowledge_id: knowledgeId,
      bailian_workspace_id: config.workspaceId,
      bailian_knowledge_status: 'ready',
      knowledge_id: knowledgeId,
      knowledge_status: 'ready',
      knowledge_provider: 'bailian',
      knowledge_bound_at: db.serverDate()
    }
  })

  return knowledgeId
}

async function waitForDocumentReady({ workspaceId, knowledgeId, jobId, fileName, client, pollAttempts, pollDelayMs }) {
  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    const statusResponse = await client.getIndexJobStatus(workspaceId, createSdkRequest(BailianSdk.GetIndexJobStatusRequest, {
      indexId: knowledgeId,
      jobId
    }))
    const statusBody = ensureSuccessBody(statusResponse.body || {}, 'getIndexJobStatus')
    const documents = statusBody.data && Array.isArray(statusBody.data.documents)
      ? statusBody.data.documents
      : []
    const finished = documents.find(item => normalizeText(item.status) === 'FINISH')
    const failed = documents.find(item => normalizeText(item.status) === 'INSERT_ERROR')

    if (finished && normalizeText(finished.docId)) {
      return normalizeText(finished.docId)
    }

    if (failed) {
      throw new Error(normalizeText(failed.message) || normalizeText(failed.code) || 'index document failed')
    }

    if (attempt < pollAttempts - 1) {
      await sleep(pollDelayMs)
    }
  }

  const listResponse = await client.listIndexDocuments(workspaceId, createSdkRequest(BailianSdk.ListIndexDocumentsRequest, {
    indexId: knowledgeId,
    pageNumber: 1,
    pageSize: 20
  }))
  const listBody = ensureSuccessBody(listResponse.body || {}, 'listIndexDocuments')
  const documents = listBody.data && Array.isArray(listBody.data.documents) ? listBody.data.documents : []
  const matched = documents.find(item => normalizeText(item.name) === normalizeText(fileName))
  return normalizeText(matched && matched.id)
}

async function checkDocumentSyncStatus({ knowledgeId, jobId, fileName } = {}) {
  const config = getBailianConfig()
  ensureConfig(config, ['accessKeyId', 'accessKeySecret', 'workspaceId'])
  const client = getClient(config)
  const normalizedKnowledgeId = normalizeText(knowledgeId)
  const normalizedJobId = normalizeText(jobId)
  const normalizedFileName = normalizeText(fileName)

  if (!normalizedKnowledgeId) {
    throw new Error('knowledgeId is required')
  }

  if (!normalizedJobId) {
    throw new Error('jobId is required')
  }

  const statusResponse = await client.getIndexJobStatus(config.workspaceId, createSdkRequest(BailianSdk.GetIndexJobStatusRequest, {
    indexId: normalizedKnowledgeId,
    jobId: normalizedJobId
  }))
  const statusBody = ensureSuccessBody(statusResponse.body || {}, 'getIndexJobStatus')
  const jobData = statusBody.data || {}
  const documents = Array.isArray(jobData.documents) ? jobData.documents : []
  const finished = documents.find(item => normalizeText(item.status) === 'FINISH')
  const failed = documents.find(item => normalizeText(item.status) === 'INSERT_ERROR')

  if (finished && normalizeText(finished.docId)) {
    return {
      ready: true,
      status: 'ready',
      documentId: normalizeText(finished.docId),
      fileId: normalizeText(finished.fileId),
      jobStatus: normalizeText(jobData.status) || 'COMPLETED'
    }
  }

  if (failed) {
    throw new Error(normalizeText(failed.message) || normalizeText(failed.code) || 'index document failed')
  }

  if (normalizeText(jobData.status) === 'FAILED') {
    throw new Error('index add document job failed')
  }

  if (normalizedFileName) {
    const listResponse = await client.listIndexDocuments(config.workspaceId, createSdkRequest(BailianSdk.ListIndexDocumentsRequest, {
      indexId: normalizedKnowledgeId,
      pageNumber: 1,
      pageSize: 20
    }))
    const listBody = ensureSuccessBody(listResponse.body || {}, 'listIndexDocuments')
    const listDocuments = listBody.data && Array.isArray(listBody.data.documents) ? listBody.data.documents : []
    const matched = listDocuments.find(item => normalizeText(item.name) === normalizedFileName)
    if (matched && normalizeText(matched.id)) {
      return {
        ready: true,
        status: 'ready',
        documentId: normalizeText(matched.id),
        fileId: normalizeText(matched.fileId),
        jobStatus: normalizeText(matched.status) || normalizeText(jobData.status) || 'FINISH'
      }
    }
  }

  return {
    ready: false,
    status: 'syncing',
    documentId: '',
    fileId: '',
    jobStatus: normalizeText(jobData.status) || 'RUNNING'
  }
}

async function uploadClothingToKnowledge({ clothing, knowledgeId, waitForReady = true }) {
  const config = getBailianConfig()
  ensureConfig(config, ['accessKeyId', 'accessKeySecret', 'workspaceId'])
  const client = getClient(config)

  const fileName = `${normalizeText(clothing._id) || `cloth_${Date.now()}`}.md`
  const buffer = Buffer.from(buildKnowledgeMarkdown(clothing), 'utf8')
  const md5 = crypto.createHash('md5').update(buffer).digest('hex')

  await purgeExistingKnowledgeEntries({
    client,
    workspaceId: config.workspaceId,
    knowledgeId,
    clothing,
    fileName
  })

  const leaseResponse = await client.applyFileUploadLease(config.defaultCategoryId, config.workspaceId, createSdkRequest(BailianSdk.ApplyFileUploadLeaseRequest, {
    fileName,
    md5,
    sizeInBytes: String(buffer.length),
    categoryType: 'UNSTRUCTURED',
    useInternalEndpoint: false
  }))
  const leaseBody = ensureSuccessBody(leaseResponse.body || {}, 'applyFileUploadLease')
  const leaseData = leaseBody.data || {}
  const uploadParam = leaseData.param || {}

  await uploadLeaseBinary({
    url: normalizeText(uploadParam.url),
    method: uploadParam.method,
    headers: uploadParam.headers,
    buffer
  })

  const addFileResponse = await client.addFile(config.workspaceId, createSdkRequest(BailianSdk.AddFileRequest, {
    categoryId: config.defaultCategoryId,
    categoryType: 'UNSTRUCTURED',
    leaseId: normalizeText(leaseData.fileUploadLeaseId),
    parser: config.fileParser,
    tags: sanitizeKnowledgeTags(clothing.retrieval_tags)
  }))
  const addFileBody = ensureSuccessBody(addFileResponse.body || {}, 'addFile')
  const fileId = normalizeText(addFileBody.data && addFileBody.data.fileId)
  if (!fileId) {
    throw new Error('addFile returned empty fileId')
  }

  const submitResponse = await client.submitIndexAddDocumentsJob(config.workspaceId, createSdkRequest(BailianSdk.SubmitIndexAddDocumentsJobRequest, {
    indexId: knowledgeId,
    sourceType: 'DATA_CENTER_FILE',
    documentIds: [fileId]
  }))
  const submitBody = ensureSuccessBody(submitResponse.body || {}, 'submitIndexAddDocumentsJob')
  const jobId = normalizeText(submitBody.data && submitBody.data.id)
  if (!jobId) {
    throw new Error('submitIndexAddDocumentsJob returned empty id')
  }

  if (!waitForReady) {
    return {
      fileId,
      documentId: '',
      jobId,
      fileName,
      status: 'syncing'
    }
  }

  const documentId = await waitForDocumentReady({
    workspaceId: config.workspaceId,
    knowledgeId,
    jobId,
    fileName,
    client,
    pollAttempts: config.pollAttempts,
    pollDelayMs: config.pollDelayMs
  })

  if (!documentId) {
    throw new Error('index document not ready after polling')
  }

  return {
    fileId,
    documentId,
    jobId,
    fileName,
    status: 'ready'
  }
}

async function probeKnowledgeAccess(overrides = {}) {
  const config = {
    ...getBailianConfig(),
    ...overrides
  }

  const snapshot = buildConfigDebugSnapshot(config)

  try {
    ensureConfig(config, ['accessKeyId', 'accessKeySecret', 'workspaceId'])
    const client = getClient(config)
    const response = await client.listIndices(config.workspaceId, createSdkRequest(BailianSdk.ListIndicesRequest, {
      pageNumber: 1,
      pageSize: 1
    }))
    const body = ensureSuccessBody(response.body || {}, 'listIndices')
    const data = body.data || {}

    return {
      ok: true,
      config: snapshot,
      status: normalizeText(body.status),
      requestId: normalizeText(body.requestId),
      totalCount: typeof data.totalCount === 'number' ? data.totalCount : 0
    }
  } catch (error) {
    return {
      ok: false,
      config: snapshot,
      error: serializeProviderError(error)
    }
  }

}

async function deleteFromBailian({ fileId, documentId, knowledgeId }) {
  const config = getBailianConfig()
  ensureConfig(config, ['accessKeyId', 'accessKeySecret', 'workspaceId'])
  const client = getClient(config)

  // 核心1：先从 AI 知识库的索引里把这件衣服抹除（这需要 knowledgeId）
  if (documentId && knowledgeId) {
    await deleteKnowledgeDocument({
      client,
      workspaceId: config.workspaceId,
      knowledgeId,
      documentId
    })
  }

  // 核心2：然后再把百炼空间里存的那份文本文件彻底删掉
  if (fileId) {
    await deleteKnowledgeFile({
      client,
      workspaceId: config.workspaceId,
      fileId
    })
  }
}

module.exports = {
  ensureKnowledgeBinding,
  uploadClothingToKnowledge,
  checkDocumentSyncStatus,
  knowledgeBaseExists,
  findKnowledgeBaseByName,
  sanitizeKnowledgeTags,
  purgeExistingKnowledgeEntries,
  buildConfigDebugSnapshot,
  serializeProviderError,
  probeKnowledgeAccess,
  deleteFromBailian
}
