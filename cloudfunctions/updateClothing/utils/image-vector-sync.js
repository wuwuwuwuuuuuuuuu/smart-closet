function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) {
    return []
  }

  return [...new Set(
    tags
      .filter(item => item !== undefined && item !== null)
      .map(item => String(item).trim())
      .filter(Boolean)
  )]
}

function splitSeasonText(seasonText) {
  const normalized = normalizeText(seasonText)
  if (!normalized) return []
  return [...new Set(normalized.split(/[\/,，、\s]+/).map(item => item.trim()).filter(Boolean))]
}

function isSameString(a, b) {
  return normalizeText(a) === normalizeText(b)
}

function isSameTagList(a, b) {
  const left = normalizeTagList(a)
  const right = normalizeTagList(b)
  return left.length === right.length && left.every((item, index) => item === right[index])
}

function hasVectorRelevantChanges(current = {}, nextPayload = {}) {
  return !isSameString(current.image, nextPayload.image)
    || !isSameString(current.originalImage, nextPayload.originalImage)
    || !isSameString(current.name, nextPayload.name)
    || !isSameString(current.season, nextPayload.season)
    || !isSameString(current.category, nextPayload.category)
    || !isSameTagList(current.tags, nextPayload.tags)
    || !isSameString(current.material, nextPayload.material)
    || !isSameString(current.brand, nextPayload.brand)
}

function buildImageEmbeddingResetFields(nextPayload = {}) {
  const hasImage = Boolean(normalizeText(nextPayload.image) || normalizeText(nextPayload.originalImage))
  return {
    image_embedding_status: hasImage ? 'pending' : 'skipped_no_image',
    image_embedding_error: '',
    image_embedding_updated_at: null,
    image_embedding_dim: 0
  }
}

function buildVectorMetadata(payload = {}) {
  return [...new Set([
    normalizeText(payload.category),
    ...splitSeasonText(payload.season),
    ...normalizeTagList(payload.tags),
    normalizeText(payload.material),
    normalizeText(payload.brand),
    normalizeText(payload.name)
  ].filter(Boolean))]
}

const { triggerImageVectorSyncInBackground } = require('./image-vector-sync-trigger')

module.exports = {
  normalizeText,
  normalizeTagList,
  splitSeasonText,
  hasVectorRelevantChanges,
  buildImageEmbeddingResetFields,
  buildVectorMetadata,
  triggerImageVectorSyncInBackground
}
