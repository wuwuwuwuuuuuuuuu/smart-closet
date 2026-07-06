const MAX_LOW_CARBON_BONUS = 0.08

function normalizeId(value) {
  return value === undefined || value === null ? '' : String(value).trim()
}

function finiteNonNegative(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function buildLowCarbonSignalMap(signals = []) {
  const map = new Map()
  if (!Array.isArray(signals)) return map

  signals.forEach(signal => {
    const clothingId = normalizeId(signal && signal.clothingId)
    if (!clothingId) return
    map.set(clothingId, {
      clothingId,
      wearCount: finiteNonNegative(signal.wearCount, 0),
      unusedDays: finiteNonNegative(signal.unusedDays, 0),
      neverWorn: signal.neverWorn === true
    })
  })
  return map
}

function calculateLowCarbonBonus(clothingId, signalMap) {
  const signal = signalMap instanceof Map
    ? signalMap.get(normalizeId(clothingId))
    : null
  if (!signal) return 0

  const wearBonus = 0.03 / (1 + signal.wearCount)
  const unusedBonus = Math.min(signal.unusedDays, 90) / 90 * 0.04
  const neverWornBonus = signal.neverWorn && signal.unusedDays > 0 ? 0.01 : 0
  return Math.min(
    MAX_LOW_CARBON_BONUS,
    wearBonus + unusedBonus + neverWornBonus
  )
}

function rerankEligibleCandidates(candidates = [], signalMap, options = {}) {
  const enabled = options.enabled === true
  const safeCandidates = Array.isArray(candidates) ? candidates : []
  if (!enabled || !(signalMap instanceof Map) || signalMap.size === 0) {
    return { candidates: [...safeCandidates], applied: false }
  }

  const ranked = safeCandidates.map((candidate, index) => {
    const clothingId = normalizeId(candidate && (candidate.id || candidate._id || candidate.clothingId))
    const baseScore = Number(candidate && candidate.score)
    const safeBaseScore = Number.isFinite(baseScore) ? baseScore : 0
    const lowCarbonBonus = calculateLowCarbonBonus(clothingId, signalMap)
    return {
      ...candidate,
      lowCarbonBonus,
      adjustedScore: safeBaseScore + lowCarbonBonus,
      originalIndex: index
    }
  }).sort((a, b) => (
    b.adjustedScore - a.adjustedScore
    || a.originalIndex - b.originalIndex
  ))

  const applied = ranked.some((candidate, index) => candidate.originalIndex !== index)
  return {
    candidates: ranked,
    applied
  }
}

module.exports = {
  MAX_LOW_CARBON_BONUS,
  buildLowCarbonSignalMap,
  calculateLowCarbonBonus,
  rerankEligibleCandidates
}
