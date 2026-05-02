const { logWarning } = require('./logger')

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return []
  }

  return tags
    .filter(tag => tag !== undefined && tag !== null)
    .map(tag => String(tag).trim())
    .filter(Boolean)
}

function buildWardrobePhotoPayload(clothesList = []) {
  if (!Array.isArray(clothesList)) {
    logWarning('smartRecommendPhoto.buildWardrobePhotoPayload', 'invalid clothes list', {
      clothesListType: typeof clothesList
    })
    return []
  }

  const wardrobePhotos = clothesList.reduce((result, item, index) => {
    const clothesId = item && item._id ? String(item._id).trim() : ''
    const photoFileId = item && typeof item.image === 'string' ? item.image.trim() : ''

    if (!clothesId || !photoFileId) {
      logWarning('smartRecommendPhoto.buildWardrobePhotoPayload', 'invalid clothes item', {
        index,
        hasClothesId: Boolean(clothesId),
        hasPhotoFileId: Boolean(photoFileId)
      })
      return result
    }

    result.push({
      clothesId,
      photoFileId,
      name: normalizeText(item.name),
      category: normalizeText(item.category),
      season: normalizeText(item.season),
      tags: normalizeTags(item.tags)
    })

    return result
  }, [])

  if (!wardrobePhotos.length) {
    logWarning('smartRecommendPhoto.buildWardrobePhotoPayload', 'wardrobe photos empty')
  }

  return wardrobePhotos
}

function mapPhotoUrlsToClothesIds(selectedPhotoUrls = [], wardrobePhotos = []) {
  if (!Array.isArray(selectedPhotoUrls) || !Array.isArray(wardrobePhotos)) {
    logWarning('wardrobePhotoMapper.mapPhotoUrlsToClothesIds', 'invalid input received', {
      selectedPhotoUrlsType: Array.isArray(selectedPhotoUrls) ? 'array' : typeof selectedPhotoUrls,
      wardrobePhotosType: Array.isArray(wardrobePhotos) ? 'array' : typeof wardrobePhotos
    })
    return []
  }

  const urlToIdMap = new Map(
    wardrobePhotos
      .filter(item => item && item.photoUrl && item.clothesId)
      .map(item => [String(item.photoUrl).trim(), String(item.clothesId).trim()])
  )

  return [...new Set(selectedPhotoUrls.filter(Boolean).map(url => String(url).trim()).filter(Boolean))]
    .map(url => {
      const clothesId = urlToIdMap.get(url)
      if (!clothesId) {
        logWarning('wardrobePhotoMapper.mapPhotoUrlsToClothesIds', 'photo url not matched', { url })
      }
      return clothesId
    })
    .filter(Boolean)
}

module.exports = {
  buildWardrobePhotoPayload,
  mapPhotoUrlsToClothesIds
}
