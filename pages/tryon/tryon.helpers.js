function matchSelectedClothes(ids = [], clothesList = []) {
  const clothesMap = new Map(clothesList.map(item => [item._id, item]))
  return ids.map(id => clothesMap.get(id)).filter(Boolean)
}

function buildSuggestedPlacements(clothesList = []) {
  return clothesList.map((item, index) => ({
    ...item,
    x: 30 + (index % 2) * 120,
    y: 30 + Math.floor(index / 2) * 140
  }))
}

function isValidSmartReminderEntry(entry, now = Date.now(), ttlMs = 30 * 60 * 1000) {
  if (!entry || entry.source !== 'smartReminder') {
    return false
  }

  if (!entry.createdAt || typeof entry.createdAt !== 'number') {
    return false
  }

  return now - entry.createdAt <= ttlMs
}

module.exports = {
  matchSelectedClothes,
  buildSuggestedPlacements,
  isValidSmartReminderEntry
}
