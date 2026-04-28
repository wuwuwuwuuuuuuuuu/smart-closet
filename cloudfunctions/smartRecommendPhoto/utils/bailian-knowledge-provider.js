const axios = require('axios')
const crypto = require('crypto')
const BailianSdk = require('@alicloud/bailian20231229')
const BailianClient = BailianSdk.default
const {
  getBailianConfig,
  normalizeText,
  supportsFileSearchModel
} = require('./bailian-config')
const { logError, logWarning } = require('./logger')

let clientInstance = null

function createSdkRequest(ModelCtor, payload) {
  return new ModelCtor(payload)
}

function ensureConfig(config = getBailianConfig(), fields = []) {
  const missing = fields.filter(field => !normalizeText(config[field]))
  if (missing.length) {
    throw new Error(`missing config: ${missing.join(', ')}`)
  }
}

function getProviderConfig() {
  return getBailianConfig()
}

function getClient(config = getProviderConfig()) {
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

function resetClientForTest() {
  clientInstance = null
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
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

function buildClothingKnowledgeMarkdown(clothing = {}) {
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

  const sections = [
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
    `original_image_file_id: ${normalizeText(clothing.originalImage) || 'unknown'}`,
    '',
    'retrieval_text:',
    normalizeText(clothing.retrieval_text) || 'none'
  ]

  return `${sections.join('\n')}\n`
}

function buildKnowledgeFileName(clothing = {}) {
  const safeId = normalizeText(clothing._id) || `cloth_${Date.now()}`
  return `${safeId}.md`
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
    categoryId: getProviderConfig().defaultCategoryId,
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

async function knowledgeBaseExists(knowledgeId, overrides = {}) {
  const config = { ...getProviderConfig(), ...overrides }
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
  const config = { ...getProviderConfig(), ...overrides }
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

async function createKnowledgeBase({ name, description } = {}, overrides = {}) {
  const config = { ...getProviderConfig(), ...overrides }
  ensureConfig(config, ['accessKeyId', 'accessKeySecret', 'workspaceId'])

  const client = getClient(config)
  const createResponse = await client.createIndex(config.workspaceId, createSdkRequest(BailianSdk.CreateIndexRequest, {
    name: normalizeText(name) || 'smart_closet_user',
    description: normalizeText(description),
    structureType: 'unstructured',
    sourceType: 'DATA_CENTER_CATEGORY',
    categoryIds: [config.defaultCategoryId],
    sinkType: 'BUILT_IN',
    chunkSize: config.chunkSize,
    overlapSize: config.overlapSize,
    enableRewrite: true
  }))

  const createBody = ensureSuccessBody(createResponse.body || {}, 'createIndex')
  const knowledgeId = normalizeText(createBody.data && createBody.data.id)
  if (!knowledgeId) {
    throw new Error('createIndex returned empty id')
  }

  const submitResponse = await client.submitIndexJob(config.workspaceId, createSdkRequest(BailianSdk.SubmitIndexJobRequest, {
    indexId: knowledgeId
  }))
  const submitBody = ensureSuccessBody(submitResponse.body || {}, 'submitIndexJob')
  const jobId = normalizeText(submitBody.data && submitBody.data.id)

  return {
    id: knowledgeId,
    knowledge_id: knowledgeId,
    jobId
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

async function waitForIndexDocumentReady({ workspaceId, knowledgeId, jobId, fileName, client, pollAttempts, pollDelayMs }) {
  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    const statusResponse = await client.getIndexJobStatus(workspaceId, createSdkRequest(BailianSdk.GetIndexJobStatusRequest, {
      indexId: knowledgeId,
      jobId
    }))
    const statusBody = ensureSuccessBody(statusResponse.body || {}, 'getIndexJobStatus')
    const jobData = statusBody.data || {}
    const documents = Array.isArray(jobData.documents) ? jobData.documents : []
    const finishedDoc = documents.find(item => normalizeText(item.status) === 'FINISH')
    const failedDoc = documents.find(item => normalizeText(item.status) === 'INSERT_ERROR')

    if (finishedDoc && normalizeText(finishedDoc.docId)) {
      return {
        documentId: normalizeText(finishedDoc.docId),
        jobStatus: normalizeText(jobData.status) || 'COMPLETED'
      }
    }

    if (failedDoc) {
      throw new Error(normalizeText(failedDoc.message) || normalizeText(failedDoc.code) || 'index document failed')
    }

    const jobStatus = normalizeText(jobData.status)
    if (jobStatus === 'FAILED') {
      throw new Error('index add document job failed')
    }

    if (jobStatus === 'COMPLETED' && !documents.length) {
      break
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
  if (matched && normalizeText(matched.id)) {
    return {
      documentId: normalizeText(matched.id),
      jobStatus: normalizeText(matched.status) || 'FINISH'
    }
  }

  throw new Error('index document not ready after polling')
}

async function uploadFileDocument({ knowledgeId, clothing, fileName, fileBuffer }, overrides = {}) {
  const config = { ...getProviderConfig(), ...overrides }
  ensureConfig(config, ['accessKeyId', 'accessKeySecret', 'workspaceId'])

  const client = getClient(config)
  const normalizedKnowledgeId = normalizeText(knowledgeId)
  if (!normalizedKnowledgeId) {
    throw new Error('knowledgeId is required')
  }

  const normalizedFileName = normalizeText(fileName) || buildKnowledgeFileName(clothing)
  const buffer = Buffer.isBuffer(fileBuffer)
    ? fileBuffer
    : Buffer.from(buildClothingKnowledgeMarkdown(clothing), 'utf8')

  await purgeExistingKnowledgeEntries({
    client,
    workspaceId: config.workspaceId,
    knowledgeId: normalizedKnowledgeId,
    clothing,
    fileName: normalizedFileName
  })

  const leaseResponse = await client.applyFileUploadLease(config.defaultCategoryId, config.workspaceId, createSdkRequest(BailianSdk.ApplyFileUploadLeaseRequest, {
    fileName: normalizedFileName,
    md5: crypto.createHash('md5').update(buffer).digest('hex'),
    sizeInBytes: String(buffer.length),
    categoryType: 'UNSTRUCTURED',
    useInternalEndpoint: false
  }))
  const leaseBody = ensureSuccessBody(leaseResponse.body || {}, 'applyFileUploadLease')
  const leaseData = leaseBody.data || {}
  const uploadParam = leaseData.param || {}
  const uploadUrl = normalizeText(uploadParam.url)
  const leaseId = normalizeText(leaseData.fileUploadLeaseId)

  if (!uploadUrl || !leaseId) {
    throw new Error('applyFileUploadLease returned empty upload url or lease id')
  }

  await uploadLeaseBinary({
    url: uploadUrl,
    method: uploadParam.method,
    headers: uploadParam.headers,
    buffer
  })

  const addFileResponse = await client.addFile(config.workspaceId, createSdkRequest(BailianSdk.AddFileRequest, {
    categoryId: config.defaultCategoryId,
    categoryType: 'UNSTRUCTURED',
    leaseId,
    parser: config.fileParser,
    tags: sanitizeKnowledgeTags(clothing && clothing.retrieval_tags)
  }))
  const addFileBody = ensureSuccessBody(addFileResponse.body || {}, 'addFile')
  const fileId = normalizeText(addFileBody.data && addFileBody.data.fileId)
  if (!fileId) {
    throw new Error('addFile returned empty fileId')
  }

  const jobResponse = await client.submitIndexAddDocumentsJob(config.workspaceId, createSdkRequest(BailianSdk.SubmitIndexAddDocumentsJobRequest, {
    indexId: normalizedKnowledgeId,
    sourceType: 'DATA_CENTER_FILE',
    documentIds: [fileId]
  }))
  const jobBody = ensureSuccessBody(jobResponse.body || {}, 'submitIndexAddDocumentsJob')
  const jobId = normalizeText(jobBody.data && jobBody.data.id)
  if (!jobId) {
    throw new Error('submitIndexAddDocumentsJob returned empty job id')
  }

  const readyResult = await waitForIndexDocumentReady({
    workspaceId: config.workspaceId,
    knowledgeId: normalizedKnowledgeId,
    jobId,
    fileName: normalizedFileName,
    client,
    pollAttempts: config.pollAttempts,
    pollDelayMs: config.pollDelayMs
  })

  return {
    fileId,
    documentId: readyResult.documentId,
    jobId,
    fileName: normalizedFileName
  }
}

function buildResponsesPrompt({ query }) {
  return [
    'You are a smart wardrobe recommendation assistant.',
    'Only use clothing items returned by file_search.',
    'Return JSON only.',
    'Fields: summary, replyText, outfitLines, tips, selectedClothesIds.',
    'selectedClothesIds must contain clothes_id values.',
    '',
    `User request: ${normalizeText(query)}`
  ].join('\n')
}

function buildResponsesRequestBody({ model, knowledgeId, prompt, maxResults }) {
  return {
    model,
    input: prompt,
    tools: [
      {
        type: 'file_search',
        vector_store_ids: [knowledgeId],
        max_num_results: maxResults
      }
    ]
  }
}

async function retrieveFromKnowledge({ knowledgeId, query, topN } = {}, overrides = {}) {
  const config = { ...getProviderConfig(), ...overrides }
  ensureConfig(config, ['dashscopeApiKey'])

  const normalizedKnowledgeId = normalizeText(knowledgeId)
  if (!normalizedKnowledgeId) {
    throw new Error('knowledgeId is required')
  }

  if (!supportsFileSearchModel(config.responseModel)) {
    logWarning('bailianKnowledgeProvider.retrieveFromKnowledge', 'response model may not support file_search', {
      responseModel: normalizeText(config.responseModel)
    })
  }

  const prompt = buildResponsesPrompt({ query })
  const requestBody = buildResponsesRequestBody({
    model: config.responseModel,
    knowledgeId: normalizedKnowledgeId,
    prompt,
    maxResults: typeof topN === 'number' && topN > 0 ? topN : config.maxResults
  })

  const response = await axios({
    method: 'post',
    url: `${config.dashscopeBaseUrl.replace(/\/$/, '')}/responses`,
    headers: {
      Authorization: `Bearer ${config.dashscopeApiKey}`,
      'Content-Type': 'application/json'
    },
    data: requestBody,
    timeout: config.responseTimeoutMs
  })

  return response && response.data ? response.data : {}
}

function isRateLimitError(error) {
  const status = error && error.response && error.response.status
  return status === 429
}

function isTimeoutError(error) {
  const code = normalizeText(error && error.code)
  const message = normalizeText(error && error.message).toLowerCase()
  return code === 'ECONNABORTED' || message.includes('timeout')
}

module.exports = {
  name: 'bailian',
  getProviderConfig,
  getClient,
  resetClientForTest,
  buildClothingKnowledgeMarkdown,
  buildKnowledgeFileName,
  buildResponsesPrompt,
  buildResponsesRequestBody,
  knowledgeBaseExists,
  findKnowledgeBaseByName,
  sanitizeKnowledgeTags,
  purgeExistingKnowledgeEntries,
  createKnowledgeBase,
  uploadFileDocument,
  retrieveFromKnowledge,
  isRateLimitError,
  isTimeoutError,
  logError,
  logWarning
}
