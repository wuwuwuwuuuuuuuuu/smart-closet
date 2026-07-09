const STORAGE_KEY = 'current_tryon_context_v1'
const CONTEXT_TTL_MS = 2 * 60 * 60 * 1000
const ALLOWED_SOURCES = ['wardrobe', 'recommendation', 'product', 'unknown']

function uniqueClothingIds(clothingIds) {
  if (!Array.isArray(clothingIds)) return []
  const seen = new Set()
  return clothingIds.reduce((result, value) => {
    if (typeof value !== 'string') return result
    const id = value.trim()
    if (id && !seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
    return result
  }, [])
}

function normalizeContext(context = {}) {
  const source = ALLOWED_SOURCES.includes(context.source) ? context.source : 'unknown'
  return {
    clothingIds: uniqueClothingIds(context.clothingIds),
    source,
    createdAt: typeof context.createdAt === 'string'
      ? context.createdAt
      : new Date().toISOString(),
    resultImage: typeof context.resultImage === 'string'
      ? context.resultImage.trim()
      : ''
  }
}

function setCurrentTryonContext(context) {
  const normalized = normalizeContext(context)
  wx.setStorageSync(STORAGE_KEY, normalized)
  return normalized
}

function getCurrentTryonContext(options = {}) {
  try {
    const context = wx.getStorageSync(STORAGE_KEY)
    if (!context || typeof context !== 'object') return null
    if (typeof context.createdAt !== 'string' || !context.createdAt) return null

    const normalized = normalizeContext(context)
    const createdAtMs = Date.parse(normalized.createdAt)
    const now = options.now instanceof Date ? options.now.getTime() : Date.now()
    const ttlMs = Number(options.ttlMs) > 0 ? Number(options.ttlMs) : CONTEXT_TTL_MS

    if (!Number.isFinite(createdAtMs) || createdAtMs > now || now - createdAtMs > ttlMs) {
      return null
    }
    return normalized
  } catch (error) {
    return null
  }
}

function clearCurrentTryonContext(expectedResultImage) {
  try {
    if (expectedResultImage) {
      const current = wx.getStorageSync(STORAGE_KEY)
      if (!current || current.resultImage !== expectedResultImage) return false
    }
    wx.removeStorageSync(STORAGE_KEY)
    return true
  } catch (error) {
    return false
  }
}

function isContextForResult(context, resultImage) {
  return Boolean(
    context
    && context.resultImage
    && resultImage
    && context.resultImage === resultImage
  )
}

function createTryonRequestId(resultImage, timestamp = Date.now(), randomValue = Math.random()) {
  const source = typeof resultImage === 'string' ? resultImage : ''
  let hash = 0
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0
  }
  const hashText = Math.abs(hash).toString(36)
  const randomText = Math.floor(Number(randomValue) * 0xFFFFFF)
    .toString(36)
    .padStart(5, '0')
  return `tryon_${timestamp}_${randomText}_${hashText || 'image'}`
}

module.exports = {
  STORAGE_KEY,
  CONTEXT_TTL_MS,
  uniqueClothingIds,
  setCurrentTryonContext,
  getCurrentTryonContext,
  clearCurrentTryonContext,
  isContextForResult,
  createTryonRequestId
}
