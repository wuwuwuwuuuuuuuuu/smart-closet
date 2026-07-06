function uniqueClothingIds(clothingIds = []) {
  if (!Array.isArray(clothingIds)) return []
  return [...new Set(clothingIds
    .filter(id => typeof id === 'string')
    .map(id => id.trim())
    .filter(Boolean))]
}

module.exports = { uniqueClothingIds }
