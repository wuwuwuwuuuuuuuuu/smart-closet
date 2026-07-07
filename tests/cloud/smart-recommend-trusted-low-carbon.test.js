const assert = require('assert')
const {
  buildServerLowCarbonSignal,
  buildServerLowCarbonSignalMap
} = require('../../cloudfunctions/smartRecommendPhoto/utils/low-carbon-signals')
const {
  buildTrustedLowCarbonContext,
  applyLowCarbonRerank
} = require('../../cloudfunctions/smartRecommendPhoto/utils/trusted-low-carbon')

const todayDateKey = '2026-07-07'

function recommendation(ids) {
  return {
    requestId: 'r1',
    selectedClothesIds: ids,
    selectedPhotoUrls: ids.map(id => `cloud://${id}.png`)
  }
}

async function run() {
  const trustedSignals = buildServerLowCarbonSignalMap([
    {
      _id: 'A',
      wearCount: 10,
      lastWornAt: new Date('2026-07-06T00:00:00+08:00'),
      created_at: new Date('2026-01-01T00:00:00+08:00')
    },
    {
      _id: 'B',
      wearCount: 1,
      lastWornAt: new Date('2026-05-28T00:00:00+08:00'),
      created_at: new Date('2026-01-01T00:00:00+08:00')
    },
    {
      _id: 'C',
      wearCount: 0,
      created_at: null
    },
    {
      _id: 'D',
      wearCount: 5,
      lastWornAt: 'bad-date',
      created_at: new Date('2026-01-01T00:00:00+08:00')
    }
  ], todayDateKey)

  assert.strictEqual(trustedSignals.get('A').unusedDays, 1)
  assert.strictEqual(trustedSignals.get('B').unusedDays, 40)
  assert.strictEqual(trustedSignals.get('C').unusedDays, 0)
  assert.strictEqual(trustedSignals.get('C').idle, false)
  assert.strictEqual(trustedSignals.get('D').unusedDays, 0)
  assert.ok([...trustedSignals.values()].every(item => Number.isFinite(item.wearCount) && Number.isFinite(item.unusedDays)))

  const disabledByUser = buildTrustedLowCarbonContext({
    lowCarbonPriority: false
  }, [
    { _id: 'B', wearCount: 0, lastWornAt: new Date('2026-01-01T00:00:00+08:00') }
  ], new Date('2026-07-07T04:00:00.000Z'))
  const maliciousEvent = {
    lowCarbonPriority: true,
    lowCarbonSignals: [{ clothingId: 'B', wearCount: 0, unusedDays: 9999 }]
  }
  const disabledResult = applyLowCarbonRerank(
    recommendation(['A', 'B']),
    [
      { id: 'A', score: 0.8, photoUrl: 'cloud://A.png' },
      { id: 'B', score: 0.78, photoUrl: 'cloud://B.png' }
    ],
    disabledByUser,
    maliciousEvent
  )
  assert.deepStrictEqual(disabledResult.selectedClothesIds, ['A', 'B'])
  assert.strictEqual(disabledResult.lowCarbonApplied, undefined)

  let warningLogged = false
  const failedSignalContext = buildTrustedLowCarbonContext(
    { lowCarbonPriority: true },
    [],
    Symbol('bad-date'),
    {
      logWarning() {
        warningLogged = true
      }
    }
  )
  assert.strictEqual(failedSignalContext.enabled, false)
  assert.strictEqual(failedSignalContext.available, false)
  assert.strictEqual(warningLogged, true)

  const enabledContext = buildTrustedLowCarbonContext({
    lowCarbonPriority: true
  }, [
    { _id: 'A', wearCount: 10, lastWornAt: new Date('2026-07-06T00:00:00+08:00') },
    { _id: 'B', wearCount: 1, lastWornAt: new Date('2026-05-28T00:00:00+08:00') },
    { _id: 'C', wearCount: 0, lastWornAt: new Date('2026-01-01T00:00:00+08:00') }
  ], new Date('2026-07-07T04:00:00.000Z'))
  const enabledResult = applyLowCarbonRerank(
    recommendation(['A', 'B']),
    [
      { id: 'A', score: 0.8, photoUrl: 'cloud://A.png' },
      { id: 'B', score: 0.78, photoUrl: 'cloud://B.png' },
      { id: 'C', score: 0.99, photoUrl: 'cloud://C.png' }
    ],
    enabledContext
  )
  assert.deepStrictEqual(enabledResult.selectedClothesIds, ['B', 'A'])
  assert.strictEqual(enabledResult.lowCarbonApplied, true)
  assert.ok(!enabledResult.selectedClothesIds.includes('C'))

  const unchanged = applyLowCarbonRerank(
    recommendation(['A', 'B']),
    [
      { id: 'A', score: 0.95, photoUrl: 'cloud://A.png' },
      { id: 'B', score: 0.1, photoUrl: 'cloud://B.png' }
    ],
    enabledContext
  )
  assert.deepStrictEqual(unchanged.selectedClothesIds, ['A', 'B'])
  assert.strictEqual(unchanged.lowCarbonApplied, undefined)

  const fallback = applyLowCarbonRerank(
    recommendation(['A', 'B']),
    [
      { _id: 'A', id: 'A', score: 1, photoUrl: 'cloud://A.png', category: 'top' },
      { _id: 'B', id: 'B', score: 0.98, photoUrl: 'cloud://B.png', category: 'bottom' }
    ],
    enabledContext,
    { lowCarbonPriority: false, lowCarbonSignals: [{ clothingId: 'A', unusedDays: 9999 }] }
  )
  assert.strictEqual(fallback.lowCarbonApplied, true)

  const malformed = buildServerLowCarbonSignal({
    _id: 'bad',
    wearCount: -1,
    lastWornAt: 'not-date',
    created_at: null
  }, todayDateKey)
  assert.strictEqual(malformed.wearCount, 0)
  assert.strictEqual(malformed.unusedDays, 0)
  assert.strictEqual(malformed.idle, false)

  console.log('smart-recommend-trusted-low-carbon.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
