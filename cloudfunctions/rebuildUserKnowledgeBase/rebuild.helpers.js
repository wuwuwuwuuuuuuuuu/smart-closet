function normalizeCount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeLimit(value, fallback = 30) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(100, Math.max(1, Math.floor(parsed)))
}

function buildVectorSyncStatsSummary(stats = {}) {
  const total = normalizeCount(stats.total)
  const readyCount = normalizeCount(stats.readyCount)
  const failedCount = normalizeCount(stats.failedCount)
  const skippedCount = normalizeCount(stats.skippedCount)

  let status = 'idle'
  if (readyCount > 0 && failedCount === 0) {
    status = 'success'
  } else if (readyCount > 0 && failedCount > 0) {
    status = 'partial_success'
  } else if (failedCount > 0) {
    status = 'failed'
  } else if (skippedCount > 0) {
    status = 'skipped'
  }

  return {
    status,
    text: `共处理 ${total} 件，成功生成向量 ${readyCount} 件，失败 ${failedCount} 件，跳过 ${skippedCount} 件。`
  }
}

function isValidVector(vector) {
  return Array.isArray(vector)
    && vector.length > 0
    && vector.every(item => typeof item === 'number' && Number.isFinite(item))
}

function buildVectorDoc({ openid, userId, clothing = {}, imageFileId, vector, syncSource } = {}) {
  if (!isValidVector(vector)) {
    throw new Error('invalid vector')
  }

  return {
    _openid: normalizeText(openid),
    user_id: normalizeText(userId),
    clothing_id: normalizeText(clothing._id),
    image_file_id: normalizeText(imageFileId),
    vector,
    vector_dim: vector.length,
    category: normalizeText(clothing.category),
    season: normalizeText(clothing.season),
    tags: Array.isArray(clothing.tags) ? clothing.tags : [],
    name: normalizeText(clothing.name),
    sync_source: normalizeText(syncSource) || 'manual_patch'
  }
}

module.exports = {
  normalizeLimit,
  buildVectorSyncStatsSummary,
  buildRebuildStatsSummary: buildVectorSyncStatsSummary,
  buildVectorDoc
}
