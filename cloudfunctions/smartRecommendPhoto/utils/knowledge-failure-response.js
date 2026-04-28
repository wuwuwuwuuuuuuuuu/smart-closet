const { composeRecommendationResult } = require('./recommendation-composer')

function buildKnowledgeFailureResponse({
  code,
  message,
  detail,
  knowledgeId,
  syncSummary,
  phase,
  retrievalHitCount
} = {}) {
  return {
    code,
    message,
    error: detail || '',
    data: composeRecommendationResult({
      summary: message,
      replyText: detail || message,
      outfitLines: [],
      tips: [
        phase ? `失败阶段：${phase}` : '',
        syncSummary && typeof syncSummary.syncedCount === 'number'
          ? `已同步 ${syncSummary.syncedCount} 件，失败 ${syncSummary.failedCount || 0} 件`
          : ''
      ].filter(Boolean),
      selectedClothesIds: [],
      selectedPhotoUrls: [],
      retrievalSource: 'bailian_knowledge',
      knowledgeId,
      retrievalHitCount: typeof retrievalHitCount === 'number' && retrievalHitCount >= 0
        ? retrievalHitCount
        : 0
    })
  }
}

module.exports = {
  buildKnowledgeFailureResponse
}
