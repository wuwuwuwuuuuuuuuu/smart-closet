let localConfig = {}

try {
  localConfig = require('../config.local')
} catch (error) {
  localConfig = {}
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildDefaultManagementEndpoint(regionId) {
  const normalizedRegionId = normalizeText(regionId) || 'cn-beijing'
  return `bailian.${normalizedRegionId}.aliyuncs.com`
}

function supportsFileSearchModel(modelName) {
  const normalizedModelName = normalizeText(modelName).toLowerCase()
  return normalizedModelName.startsWith('qwen3')
}

function getBailianConfig() {
  const managementRegionId = normalizeText(process.env.BAILIAN_REGION_ID || localConfig.BAILIAN_REGION_ID) || 'cn-beijing'

  return {
    accessKeyId: normalizeText(process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || localConfig.ALIBABA_CLOUD_ACCESS_KEY_ID),
    accessKeySecret: normalizeText(process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || localConfig.ALIBABA_CLOUD_ACCESS_KEY_SECRET),
    workspaceId: normalizeText(process.env.WORKSPACE_ID || localConfig.WORKSPACE_ID),
    dashscopeApiKey: normalizeText(process.env.DASHSCOPE_API_KEY || localConfig.DASHSCOPE_API_KEY),
    managementRegionId,
    managementEndpoint: normalizeText(process.env.BAILIAN_MANAGEMENT_ENDPOINT || localConfig.BAILIAN_MANAGEMENT_ENDPOINT)
      || buildDefaultManagementEndpoint(managementRegionId),
    dashscopeBaseUrl: normalizeText(process.env.DASHSCOPE_BASE_URL || localConfig.DASHSCOPE_BASE_URL)
      || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    responseModel: normalizeText(process.env.DASHSCOPE_RESPONSE_MODEL || localConfig.DASHSCOPE_RESPONSE_MODEL)
      || 'qwen3.5-flash',
    defaultCategoryId: normalizeText(process.env.BAILIAN_DEFAULT_CATEGORY_ID || localConfig.BAILIAN_DEFAULT_CATEGORY_ID)
      || 'default',
    fileParser: normalizeText(process.env.BAILIAN_FILE_PARSER || localConfig.BAILIAN_FILE_PARSER)
      || 'DASHSCOPE_DOCMIND',
    chunkSize: normalizeNumber(process.env.BAILIAN_CHUNK_SIZE || localConfig.BAILIAN_CHUNK_SIZE, 500),
    overlapSize: normalizeNumber(process.env.BAILIAN_OVERLAP_SIZE || localConfig.BAILIAN_OVERLAP_SIZE, 100),
    pollAttempts: normalizeNumber(process.env.BAILIAN_POLL_ATTEMPTS || localConfig.BAILIAN_POLL_ATTEMPTS, 8),
    pollDelayMs: normalizeNumber(process.env.BAILIAN_POLL_DELAY_MS || localConfig.BAILIAN_POLL_DELAY_MS, 1200),
    maxResults: normalizeNumber(process.env.BAILIAN_MAX_RESULTS || localConfig.BAILIAN_MAX_RESULTS, 3),
    responseTimeoutMs: normalizeNumber(
      process.env.BAILIAN_RESPONSE_TIMEOUT_MS || localConfig.BAILIAN_RESPONSE_TIMEOUT_MS,
      60000
    )
  }
}

function getMissingConfigFields(config = getBailianConfig()) {
  const missing = []
  if (!normalizeText(config.accessKeyId)) {
    missing.push('ALIBABA_CLOUD_ACCESS_KEY_ID')
  }
  if (!normalizeText(config.accessKeySecret)) {
    missing.push('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
  }
  if (!normalizeText(config.workspaceId)) {
    missing.push('WORKSPACE_ID')
  }
  if (!normalizeText(config.dashscopeApiKey)) {
    missing.push('DASHSCOPE_API_KEY')
  }
  return missing
}

function hasValidBailianConfig(config = getBailianConfig()) {
  return getMissingConfigFields(config).length === 0
}

module.exports = {
  getBailianConfig,
  getMissingConfigFields,
  hasValidBailianConfig,
  normalizeText,
  normalizeNumber,
  buildDefaultManagementEndpoint,
  supportsFileSearchModel
}
