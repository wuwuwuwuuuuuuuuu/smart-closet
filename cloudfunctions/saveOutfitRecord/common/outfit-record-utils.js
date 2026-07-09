const OUTFIT_SLOTS = Object.freeze([1, 2, 3])

function uniqueClothingIds(clothingIds = []) {
  if (!Array.isArray(clothingIds)) return []
  return [...new Set(clothingIds
    .filter(id => typeof id === 'string')
    .map(id => id.trim())
    .filter(Boolean))]
}

function allocateSmallestAvailableSlot(records = []) {
  const occupied = new Set(records.map(item => item && item.slot))
  return OUTFIT_SLOTS.find(slot => !occupied.has(slot)) || null
}

module.exports = { OUTFIT_SLOTS, uniqueClothingIds, allocateSmallestAvailableSlot }
