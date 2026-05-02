const { logWarning } = require('./logger')
const { normalizeInput } = require('./fallback-recommendation')
const { composeRecommendationResult } = require('./recommendation-composer')
const {
  parseKnowledgeRecommendationResponse,
  buildKnowledgeQueryFromEvent
} = require('./knowledge-retrieval-parser')
const {
  filterKnowledgeReadyClothes,
  buildKnowledgeRecommendationDraft
} = require('./knowledge-recommendation-builder')
const { resolveMatchedClothesFromRetrieval } = require('./knowledge-result-mapper')

async function buildKnowledgeRecommendation({ provider, binding, clothesList, event, userQuery }) {
  const knowledgeId = normalizeInput(binding && binding.knowledgeId)
  const knowledgeReadyClothes = filterKnowledgeReadyClothes(clothesList)
  let currentPhase = 'precheck'

  try {
    if (!knowledgeId) {
      return {
        success: false,
        phase: 'binding',
        reason: 'missing_knowledge_id',
        message: '知识库尚未创建完成，请稍后重试。'
      }
    }

    if (!knowledgeReadyClothes.length) {
      return {
        success: false,
        phase: 'sync',
        reason: 'no_ready_clothes',
        message: '衣物还未同步到知识库，请稍后再试。'
      }
    }

    currentPhase = 'retrieval'
    const retrievalResponse = await provider.retrieveFromKnowledge({
      knowledgeId,
      query: buildKnowledgeQueryFromEvent({
        ...event,
        userQuery
      }),
      topN: 3
    })

    currentPhase = 'parse'
    const aiPayload = parseKnowledgeRecommendationResponse(retrievalResponse, clothesList)
    if (!aiPayload.selectedClothesIds.length) {
      return {
        success: false,
        phase: currentPhase,
        reason: 'empty_retrieval',
        retrievalHitCount: aiPayload.retrievalHitCount,
        message: aiPayload.replyText || '知识库检索没有命中结果，请换一句更明确的需求再试。'
      }
    }

    currentPhase = 'mapping'
    const mappingResult = resolveMatchedClothesFromRetrieval({
      clothesList,
      aiPayload
    })
    const matchedClothes = mappingResult.matchedClothes

    if (aiPayload.selectedClothesIds.length && !matchedClothes.length) {
      logWarning('knowledgeRecommendationService.buildKnowledgeRecommendation', 'knowledge result mapping failed', {
        knowledgeId,
        selectedClothesIds: aiPayload.selectedClothesIds,
        retrievalHitCount: aiPayload.retrievalHitCount
      })
    } else if (mappingResult.unresolvedCount > 0) {
      logWarning('knowledgeRecommendationService.buildKnowledgeRecommendation', 'partial retrieval mapping missed some hits', {
        knowledgeId,
        unresolvedCount: mappingResult.unresolvedCount
      })
    }

    if (!matchedClothes.length) {
      return {
        success: false,
        phase: currentPhase,
        reason: 'empty_mapping',
        retrievalHitCount: aiPayload.retrievalHitCount,
        message: '知识库已返回结果，但还没有成功映射回本地衣物。'
      }
    }

    currentPhase = 'compose'
    return {
      success: true,
      data: composeRecommendationResult(
        buildKnowledgeRecommendationDraft({
          event,
          matchedClothes,
          retrievalItems: aiPayload.retrievalItems,
          aiPayload,
          knowledgeId
        })
      )
    }
  } catch (error) {
    if (error && !error.phase) {
      error.phase = currentPhase
    }
    throw error
  }
}

module.exports = {
  buildKnowledgeRecommendation
}
