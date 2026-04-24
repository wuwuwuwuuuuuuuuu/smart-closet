const cloud = require('wx-server-sdk')
const { logError, logWarning } = require('./utils/logger')
const { normalizeInput } = require('./utils/fallback-recommendation')
const { buildKnowledgeFailureResponse } = require('./utils/knowledge-failure-response')
const { ensureUserKnowledgeBinding } = require('./utils/knowledge-binding')
const { getKnowledgeProvider } = require('./utils/provider-registry')
const { syncPendingClothesToKnowledge } = require('./utils/knowledge-sync-service')
const { buildKnowledgeRecommendation } = require('./utils/knowledge-recommendation-service')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event = {}) => {
  try {
    let currentPhase = 'init'
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const userQuery = normalizeInput(event.userQuery)

    if (!userQuery) {
      logWarning('smartRecommendPhoto.main', 'missing userQuery')
      return {
        code: 400,
        message: 'userQuery 不能为空'
      }
    }

    const knowledgeProvider = getKnowledgeProvider('bailian')
    const knowledgeProviderConfig = knowledgeProvider.getProviderConfig
      ? knowledgeProvider.getProviderConfig()
      : {}

    if (
      !normalizeInput(knowledgeProviderConfig.accessKeyId)
      || !normalizeInput(knowledgeProviderConfig.accessKeySecret)
      || !normalizeInput(knowledgeProviderConfig.workspaceId)
      || !normalizeInput(knowledgeProviderConfig.dashscopeApiKey)
    ) {
      return {
        code: 500,
        message: '缺少阿里百炼 API 配置',
        error: 'missing bailian config'
      }
    }

    let binding
    try {
      currentPhase = 'binding'
      binding = await ensureUserKnowledgeBinding({
        db,
        openid,
        provider: knowledgeProvider,
        allowCreate: true
      })
    } catch (error) {
      logWarning('smartRecommendPhoto.main', 'user binding failed', {
        openid,
        message: error && error.message
      })
      return {
        code: 404,
        message: '用户不存在，请先登录',
        error: error.message
      }
    }

    currentPhase = 'load_clothes'
    const userId = binding.user && binding.user._id ? binding.user._id : ''
    const clothesRes = await db.collection('clothes')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .get()

    const clothesList = Array.isArray(clothesRes.data) ? clothesRes.data : []
    if (!clothesList.length) {
      logWarning('smartRecommendPhoto.main', 'wardrobe empty', { userId })
      return {
        code: 422,
        message: '衣橱为空，无法生成推荐'
      }
    }

    currentPhase = 'sync'
    const syncSummary = await syncPendingClothesToKnowledge({
      db,
      knowledgeId: binding.knowledgeId,
      clothesList,
      provider: knowledgeProvider,
      maxItems: 3
    })

    let recommendation
    try {
      currentPhase = 'retrieval'
      recommendation = await buildKnowledgeRecommendation({
        provider: knowledgeProvider,
        binding,
        clothesList,
        event,
        userQuery
      })
    } catch (error) {
      if (typeof knowledgeProvider.isTimeoutError === 'function' && knowledgeProvider.isTimeoutError(error)) {
        return buildKnowledgeFailureResponse({
          code: 504,
          message: '阿里百炼知识库检索超时，请稍后重试或换一句更短、更明确的需求。',
          detail: '知识库检索等待超过 60 秒，当前请求已中止。你可以稍后重试，或先用更具体的场景和衣物需求缩小检索范围。',
          knowledgeId: binding.knowledgeId,
          syncSummary,
          phase: error.phase || currentPhase
        })
      }

      if (typeof knowledgeProvider.isRateLimitError === 'function' && knowledgeProvider.isRateLimitError(error)) {
        return buildKnowledgeFailureResponse({
          code: 503,
          message: '阿里百炼服务当前限流，请稍后再试。',
          detail: 'provider rate limited',
          knowledgeId: binding.knowledgeId,
          syncSummary,
          phase: currentPhase
        })
      }

      currentPhase = error.phase || currentPhase
      logError('smartRecommendPhoto.main', error, {
        phase: currentPhase,
        knowledgeId: binding.knowledgeId
      })

      return buildKnowledgeFailureResponse({
        code: 500,
        message: '阿里百炼知识库推荐失败',
        detail: error.message,
        knowledgeId: binding.knowledgeId,
        syncSummary,
        phase: currentPhase
      })
    }

    if (!recommendation.success) {
      return buildKnowledgeFailureResponse({
        code: recommendation.reason === 'no_ready_clothes' ? 409 : 422,
        message: recommendation.message,
        detail: syncSummary.failedCount > 0
          ? `有 ${syncSummary.failedCount} 件衣物同步失败，请检查 clothes.knowledge_sync_error`
          : '',
        knowledgeId: binding.knowledgeId,
        syncSummary,
        phase: recommendation.phase,
        retrievalHitCount: recommendation.retrievalHitCount
      })
    }

    return {
      code: 200,
      message: 'ok',
      data: recommendation.data
    }
  } catch (error) {
    logError('smartRecommendPhoto.main', error)
    return {
      code: 500,
      message: '智能推荐生成失败',
      error: error.message
    }
  }
}
