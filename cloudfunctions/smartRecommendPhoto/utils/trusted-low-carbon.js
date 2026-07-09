const {
  rerankEligibleCandidates
} = require('./low-carbon-ranker')
const {
  getShanghaiDateKey,
  buildServerLowCarbonSignalMap
} = require('./low-carbon-signals')

function uniqueStringList(list = []) {
  const seen = new Set()
  const result = []
  list.forEach(item => {
    const value = typeof item === 'string' ? item.trim() : ''
    if (value && !seen.has(value)) {
      seen.add(value)
      result.push(value)
    }
  })
  return result
}

function normalizeInput(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildTrustedLowCarbonContext(user = {}, clothes = [], now = new Date(), options = {}) {
  if (!user || user.lowCarbonPriority !== true) {
    return { enabled: false, signalMap: new Map(), available: true }
  }

  try {
    const todayDateKey = getShanghaiDateKey(now)
    const signalMap = buildServerLowCarbonSignalMap(clothes, todayDateKey)
    return {
      enabled: true,
      signalMap,
      available: true
    }
  } catch (error) {
    if (typeof options.logWarning === 'function') {
      options.logWarning('recommend.lowCarbonSignals', 'trusted low carbon signal generation failed', {
        errMsg: error && error.message
      })
    }
    return { enabled: false, signalMap: new Map(), available: false }
  }
}

function applyLowCarbonRerank(recommendation = {}, eligibleHits = [], lowCarbonContext = {}) {
  if (
    !lowCarbonContext
    || lowCarbonContext.enabled !== true
    || !(lowCarbonContext.signalMap instanceof Map)
    || lowCarbonContext.signalMap.size === 0
  ) {
    return recommendation
  }

  const selectedSet = new Set(uniqueStringList(recommendation.selectedClothesIds))
  const selectedCandidates = eligibleHits
    .filter(item => selectedSet.has(String(item.id || item._id)))
    .sort((a, b) => {
      const aScore = Number(a.score)
      const bScore = Number(b.score)
      return (Number.isFinite(bScore) ? bScore : 0)
        - (Number.isFinite(aScore) ? aScore : 0)
    })

  // 只处理模型或fallback已经选出的合格集合，不会把其他衣物重新加入。
  const reranked = rerankEligibleCandidates(selectedCandidates, lowCarbonContext.signalMap, {
    enabled: true
  })
  if (!reranked.applied) return recommendation

  const selectedClothesIds = reranked.candidates
    .map(item => String(item.id || item._id))
    .filter(Boolean)
  const selectedPhotoUrls = reranked.candidates
    .map(item => normalizeInput(item.photoUrl))
    .filter(Boolean)
  return {
    ...recommendation,
    selectedClothesIds,
    selectedPhotoUrls,
    lowCarbonApplied: true,
    lowCarbonReason: '优先考虑了较少使用的合适衣物'
  }
}

module.exports = {
  buildTrustedLowCarbonContext,
  applyLowCarbonRerank
}
