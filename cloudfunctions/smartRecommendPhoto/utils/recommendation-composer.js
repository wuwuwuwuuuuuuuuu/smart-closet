const { logWarning } = require('./logger')

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueStringList(list = [], scope = 'recommendationComposer.uniqueStringList') {
  if (!Array.isArray(list)) {
    logWarning(scope, 'invalid list received', {
      listType: typeof list
    })
    return []
  }

  return [...new Set(
    list
      .filter(item => item !== undefined && item !== null)
      .map(item => String(item).trim())
      .filter(Boolean)
  )]
}

function normalizeStringArray(list = [], scope) {
  if (!Array.isArray(list)) {
    if (list !== undefined && list !== null) {
      logWarning(scope, 'invalid array received', {
        valueType: typeof list
      })
    }
    return []
  }

  return list
    .map(item => normalizeText(item))
    .filter(Boolean)
}

function normalizeHitCount(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }

  return 0
}

function composeRecommendationResult(raw = {}) {
  const safeRaw = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}

  return {
    requestId: normalizeText(safeRaw.requestId) || `rec_${Date.now()}`,
    summary: normalizeText(safeRaw.summary) || '已根据你的需求生成智能推荐。',
    replyText: normalizeText(safeRaw.replyText) || '我已经筛选出更适合你的衣物，点击箭头即可去试穿页查看。',
    selectedClothesIds: uniqueStringList(
      safeRaw.selectedClothesIds,
      'recommendationComposer.selectedClothesIds'
    ),
    selectedPhotoUrls: uniqueStringList(
      safeRaw.selectedPhotoUrls,
      'recommendationComposer.selectedPhotoUrls'
    ),
    outfitLines: normalizeStringArray(safeRaw.outfitLines, 'recommendationComposer.outfitLines'),
    tips: normalizeStringArray(safeRaw.tips, 'recommendationComposer.tips'),
    wardrobeAnalysisSummary: normalizeText(safeRaw.wardrobeAnalysisSummary),
    ctaLabel: normalizeText(safeRaw.ctaLabel) || '去试穿页继续搭配',
    source: normalizeText(safeRaw.source) || 'smartRecommend',
    retrievalSource: normalizeText(safeRaw.retrievalSource),
    knowledgeId: normalizeText(safeRaw.knowledgeId),
    retrievalHitCount: normalizeHitCount(safeRaw.retrievalHitCount)
  }
}

module.exports = {
  composeRecommendationResult,
  uniqueStringList,
  normalizeStringArray,
  normalizeHitCount
}
