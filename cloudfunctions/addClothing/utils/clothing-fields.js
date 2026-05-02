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

module.exports = {
  normalizeText,
  normalizeTagList
}
