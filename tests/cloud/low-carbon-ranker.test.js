const assert = require('assert')
const {
  MAX_LOW_CARBON_BONUS,
  buildLowCarbonSignalMap,
  calculateLowCarbonBonus,
  rerankEligibleCandidates
} = require('../../cloudfunctions/smartRecommendPhoto/utils/low-carbon-ranker')

const eligibleCandidates = [
  { id: 'A', score: 0.8, season: '夏', scene: '通勤' },
  { id: 'B', score: 0.78, season: '夏', scene: '通勤' }
]
const excludedCandidate = { id: 'C', score: 0.99, season: '冬', scene: '运动' }
const signalMap = buildLowCarbonSignalMap([
  { clothingId: 'A', wearCount: 10, unusedDays: 1, neverWorn: false },
  { clothingId: 'B', wearCount: 1, unusedDays: 40, neverWorn: false },
  { clothingId: 'C', wearCount: 0, unusedDays: 100, neverWorn: true },
  { clothingId: 'invalid', wearCount: 'bad', unusedDays: NaN }
])

const disabled = rerankEligibleCandidates(eligibleCandidates, signalMap, {
  enabled: false
})
assert.deepStrictEqual(disabled.candidates.map(item => item.id), ['A', 'B'])
assert.strictEqual(disabled.applied, false)

const enabled = rerankEligibleCandidates(eligibleCandidates, signalMap, {
  enabled: true
})
assert.deepStrictEqual(enabled.candidates.map(item => item.id), ['B', 'A'])
assert.strictEqual(enabled.applied, true)
assert.ok(!enabled.candidates.some(item => item.id === excludedCandidate.id))

assert.strictEqual(calculateLowCarbonBonus('missing', signalMap), 0)
assert.ok(calculateLowCarbonBonus('B', signalMap) <= MAX_LOW_CARBON_BONUS)
assert.ok(Number.isFinite(calculateLowCarbonBonus('invalid', signalMap)))
assert.ok(enabled.candidates.every(item => Number.isFinite(item.adjustedScore)))

console.log('low-carbon-ranker.test.js passed')
