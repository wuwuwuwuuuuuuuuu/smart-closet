const { logWarning, logError } = require('./logger')

function extractJsonObjectString(modelText) {
  if (typeof modelText !== 'string' || !modelText.trim()) {
    throw new Error('modelText 不能为空')
  }

  const startIndex = modelText.indexOf('{')
  const endIndex = modelText.lastIndexOf('}')
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('模型输出中未找到 JSON')
  }

  return modelText.slice(startIndex, endIndex + 1)
}

function parseStructuredRecommendation(modelText, wardrobePhotos = []) {
  try {
    const jsonText = extractJsonObjectString(modelText)
    const parsed = JSON.parse(jsonText)
    const validPhotoUrls = new Set(
      (Array.isArray(wardrobePhotos) ? wardrobePhotos : [])
        .map(item => item && item.photoUrl)
        .filter(Boolean)
    )

    const selectedPhotoUrls = Array.isArray(parsed.selectedPhotoUrls)
      ? [...new Set(parsed.selectedPhotoUrls.filter(Boolean))].filter(url => {
        const isValid = validPhotoUrls.has(url)
        if (!isValid) {
          logWarning('modelProvider.parseStructuredRecommendation', 'invalid selected photo url dropped', { url })
        }
        return isValid
      })
      : []

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
      replyText: typeof parsed.replyText === 'string' ? parsed.replyText.trim() : '',
      outfitLines: Array.isArray(parsed.outfitLines)
        ? parsed.outfitLines.filter(Boolean).map(item => String(item).trim()).filter(Boolean)
        : [],
      tips: Array.isArray(parsed.tips)
        ? parsed.tips.filter(Boolean).map(item => String(item).trim()).filter(Boolean)
        : [],
      selectedPhotoUrls
    }
  } catch (error) {
    logError('modelProvider.parseStructuredRecommendation', error)
    throw error
  }
}

module.exports = {
  extractJsonObjectString,
  parseStructuredRecommendation
}
