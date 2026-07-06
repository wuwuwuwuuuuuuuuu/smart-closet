const { logWarning } = require('../../utils/logger')

function matchSelectedClothes(ids = [], clothesList = []) {
  if (!Array.isArray(ids) || !Array.isArray(clothesList)) {
    logWarning('tryon.matchSelectedClothes', 'invalid input received', {
      idsType: Array.isArray(ids) ? 'array' : typeof ids,
      clothesListType: Array.isArray(clothesList) ? 'array' : typeof clothesList
    })
    return []
  }

  const clothesMap = new Map()
  clothesList.forEach(item => {
    if (item && item._id) {
      clothesMap.set(String(item._id), item)
    }
  })

  return [...new Set(ids.filter(Boolean).map(item => String(item)))]
    .map(id => clothesMap.get(id))
    .filter(Boolean)
}

function buildSuggestedPlacements(clothesList = []) {
  if (!Array.isArray(clothesList)) {
    logWarning('tryon.buildSuggestedPlacements', 'invalid clothesList', { clothesListType: typeof clothesList })
    return []
  }

  return clothesList.map((item, index) => {
    const column = index % 2
    const row = Math.floor(index / 2)

    return {
      ...item,
      x: 36 + column * 220,
      y: 80 + row * 240,
      scale: typeof item.scale === 'number' && Number.isFinite(item.scale) ? item.scale : 1
    }
  })
}

function isValidSmartRecommendEntry(entry, now = Date.now(), ttlMs = 30 * 60 * 1000) {
  if (!entry || typeof entry !== 'object') {
    return false
  }

  if (entry.source !== 'smartRecommend') {
    return false
  }

  if (typeof entry.createdAt !== 'number' || !Number.isFinite(entry.createdAt)) {
    return false
  }

  if (typeof ttlMs !== 'number' || ttlMs <= 0) {
    logWarning('tryon.isValidSmartRecommendEntry', 'invalid ttl value', { ttlMs })
    return false
  }

  return now >= entry.createdAt && now - entry.createdAt <= ttlMs
}

function isValidTryonSelectionEntry(entry, now = Date.now(), ttlMs = 30 * 60 * 1000) {
  if (!entry || !['smartRecommend', 'outfitHistory', 'todayOutfit'].includes(entry.source)) {
    return false
  }
  if (!Array.isArray(entry.selectedClothesIds) || entry.selectedClothesIds.length === 0) {
    return false
  }
  if (typeof entry.createdAt !== 'number' || !Number.isFinite(entry.createdAt)) {
    return false
  }
  return typeof ttlMs === 'number'
    && ttlMs > 0
    && now >= entry.createdAt
    && now - entry.createdAt <= ttlMs
}

function buildTryonContextData(selectedClothes = [], smartRecommendEntry = null) {
  const safeClothes = Array.isArray(selectedClothes) ? selectedClothes : []
  const hasProductItem = safeClothes.some(item => item && item.source === 'productTryon')
  const clothingIds = [...new Set(
    safeClothes
      .map(item => item && item._id)
      .filter(id => typeof id === 'string' && id.trim())
      .map(id => id.trim())
  )]

  if (hasProductItem && clothingIds.length === 0) {
    return { clothingIds: [], source: 'product' }
  }
  if (
    smartRecommendEntry
    && smartRecommendEntry.source === 'smartRecommend'
  ) {
    return { clothingIds, source: 'recommendation' }
  }
  if (clothingIds.length > 0) {
    return { clothingIds, source: 'wardrobe' }
  }
  return { clothingIds: [], source: 'unknown' }
}

module.exports = {
  matchSelectedClothes,
  buildSuggestedPlacements,
  isValidSmartRecommendEntry,
  isValidTryonSelectionEntry,
  buildTryonContextData
}
