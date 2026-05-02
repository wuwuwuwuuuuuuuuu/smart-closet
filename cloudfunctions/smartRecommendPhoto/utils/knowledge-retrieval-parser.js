const { logWarning } = require('./logger')
const { extractJsonObjectString } = require('./recommendation-parser')
const {
  normalizeText,
  normalizeNumber,
  extractResponseOutputText,
  normalizeKnowledgeRetrievalResponse
} = require('./bailian-retrieval-normalizer')

function normalizeStringList(list = []) {
  if (!Array.isArray(list)) {
    return []
  }

  return list
    .map(item => normalizeText(item))
    .filter(Boolean)
}

function buildKnowledgeQueryFromEvent(event = {}) {
  const queryParts = [
    normalizeText(event.userQuery),
    normalizeText(event.occasion) ? `occasion: ${normalizeText(event.occasion)}` : '',
    normalizeText(event.city) ? `city: ${normalizeText(event.city)}` : '',
    normalizeText(event.weatherSuggestion) ? `weather suggestion: ${normalizeText(event.weatherSuggestion)}` : '',
    event.weatherInfo && typeof event.weatherInfo === 'object'
      ? `weather: ${[
        normalizeText(event.weatherInfo.text),
        normalizeText(String(event.weatherInfo.temp || ''))
      ].filter(Boolean).join(' ')}`.trim()
      : '',
    event.userPreferences && typeof event.userPreferences === 'object'
      ? `preference: ${[
        normalizeText(event.userPreferences.preferredStyle),
        normalizeText(event.userPreferences.preferredColor)
      ].filter(Boolean).join(' / ')}`
      : ''
  ].filter(Boolean)

  return queryParts.join('\n')
}

function buildClothesIdSet(clothesList = []) {
  const map = new Map()

  if (!Array.isArray(clothesList)) {
    return map
  }

  clothesList.forEach(item => {
    const id = normalizeText(item && item._id)
    if (id) {
      map.set(id, id)
    }
  })

  return map
}

function filterValidClothesIds(ids = [], validClothesIdSet = new Map(), scope = 'knowledgeRetrievalParser.filterValidClothesIds') {
  return normalizeStringList(ids).filter(id => {
    const isValid = validClothesIdSet.has(id)
    if (!isValid) {
      logWarning(scope, 'invalid clothes id dropped', {
        clothesId: id
      })
    }
    return isValid
  })
}

function safeParseRecommendationText(rawText = '') {
  const outputText = normalizeText(rawText)
  if (!outputText) {
    return {
      summary: '',
      replyText: '',
      outfitLines: [],
      tips: [],
      selectedClothesIds: []
    }
  }

  try {
    const parsed = JSON.parse(extractJsonObjectString(outputText))
    return {
      summary: normalizeText(parsed.summary),
      replyText: normalizeText(parsed.replyText),
      outfitLines: normalizeStringList(parsed.outfitLines),
      tips: normalizeStringList(parsed.tips),
      selectedClothesIds: normalizeStringList(parsed.selectedClothesIds),
      retrievalHitCount: normalizeNumber(parsed.retrievalHitCount, 0)
    }
  } catch (error) {
    logWarning('knowledgeRetrievalParser.safeParseRecommendationText', 'json parse failed', {
      message: error.message
    })
    return {
      summary: '',
      replyText: outputText,
      outfitLines: [],
      tips: [],
      selectedClothesIds: [],
      retrievalHitCount: 0
    }
  }
}

function parseKnowledgeRecommendationResponse(raw = {}, clothesList = []) {
  const normalizedResponse = normalizeKnowledgeRetrievalResponse(raw)
  const parsed = safeParseRecommendationText(normalizedResponse.rawText)
  const validClothesIdSet = buildClothesIdSet(clothesList)
  const selectedClothesIds = [...new Set([
    ...filterValidClothesIds(
      normalizedResponse.hits.map(hit => normalizeText(hit && hit.clothesIdHint)),
      validClothesIdSet,
      'knowledgeRetrievalParser.parseKnowledgeRecommendationResponse.retrievalIds'
    ),
    ...filterValidClothesIds(
      parsed.selectedClothesIds,
      validClothesIdSet,
      'knowledgeRetrievalParser.parseKnowledgeRecommendationResponse.jsonIds'
    )
  ])]

  return {
    summary: normalizeText(parsed.summary),
    replyText: normalizeText(parsed.replyText),
    outfitLines: normalizeStringList(parsed.outfitLines),
    tips: normalizeStringList(parsed.tips),
    selectedClothesIds,
    retrievalHitCount: normalizedResponse.hits.length || normalizeNumber(parsed.retrievalHitCount, selectedClothesIds.length),
    rawText: normalizedResponse.rawText,
    retrievalItems: normalizedResponse.hits
  }
}

module.exports = {
  extractResponseOutputText,
  safeParseRecommendationText,
  buildClothesIdSet,
  parseKnowledgeRecommendationResponse,
  buildKnowledgeQueryFromEvent,
  normalizeStringList
}
