const STORAGE_KEY = 'smartRecommendTryonEntry'

function uniqueClothingIds(clothingIds) {
  if (!Array.isArray(clothingIds)) return []
  return [...new Set(
    clothingIds
      .filter(id => typeof id === 'string')
      .map(id => id.trim())
      .filter(Boolean)
  )]
}

function setTryonSelectionEntry({ clothingIds, source, createdAt = Date.now() } = {}) {
  const selectedClothesIds = uniqueClothingIds(clothingIds)
  const entry = {
    source,
    selectedClothesIds,
    createdAt,
    active: true
  }
  wx.setStorageSync(STORAGE_KEY, entry)
  return entry
}

function openTryonWithClothingIds({ clothingIds, source } = {}) {
  const selectedClothesIds = uniqueClothingIds(clothingIds)
  if (selectedClothesIds.length === 0) return false

  setTryonSelectionEntry({
    clothingIds: selectedClothesIds,
    source,
    createdAt: Date.now()
  })
  wx.switchTab({ url: '/pages/tryon/tryon' })
  return true
}

function getTryonSelectionEntry() {
  return wx.getStorageSync(STORAGE_KEY)
}

function markTryonSelectionEntryConsumed(entry) {
  wx.setStorageSync(STORAGE_KEY, {
    ...entry,
    active: false
  })
}

module.exports = {
  STORAGE_KEY,
  uniqueClothingIds,
  setTryonSelectionEntry,
  openTryonWithClothingIds,
  getTryonSelectionEntry,
  markTryonSelectionEntryConsumed
}
