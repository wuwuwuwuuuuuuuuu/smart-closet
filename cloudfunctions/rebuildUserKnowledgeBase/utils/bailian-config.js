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

function getBailianConfig() {
  const managementRegionId = normalizeText(process.env.BAILIAN_REGION_ID || localConfig.BAILIAN_REGION_ID) || 'cn-beijing'

  return {
    accessKeyId: normalizeText(process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || localConfig.ALIBABA_CLOUD_ACCESS_KEY_ID),
    accessKeySecret: normalizeText(process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || localConfig.ALIBABA_CLOUD_ACCESS_KEY_SECRET),
    workspaceId: normalizeText(process.env.WORKSPACE_ID || localConfig.WORKSPACE_ID),
    managementRegionId,
    managementEndpoint: normalizeText(process.env.BAILIAN_MANAGEMENT_ENDPOINT || localConfig.BAILIAN_MANAGEMENT_ENDPOINT)
      || buildDefaultManagementEndpoint(managementRegionId),
    defaultCategoryId: normalizeText(process.env.BAILIAN_DEFAULT_CATEGORY_ID || localConfig.BAILIAN_DEFAULT_CATEGORY_ID)
      || 'default',
    fileParser: normalizeText(process.env.BAILIAN_FILE_PARSER || localConfig.BAILIAN_FILE_PARSER)
      || 'DASHSCOPE_DOCMIND',
    chunkSize: normalizeNumber(process.env.BAILIAN_CHUNK_SIZE || localConfig.BAILIAN_CHUNK_SIZE, 500),
    overlapSize: normalizeNumber(process.env.BAILIAN_OVERLAP_SIZE || localConfig.BAILIAN_OVERLAP_SIZE, 100),
    pollAttempts: normalizeNumber(process.env.BAILIAN_POLL_ATTEMPTS || localConfig.BAILIAN_POLL_ATTEMPTS, 8),
    pollDelayMs: normalizeNumber(process.env.BAILIAN_POLL_DELAY_MS || localConfig.BAILIAN_POLL_DELAY_MS, 1200)
  }
}

module.exports = {
  getBailianConfig,
  normalizeText,
  buildDefaultManagementEndpoint
}
