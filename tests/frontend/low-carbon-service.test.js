const assert = require('assert')
const { getLocalDateKey, shiftDateKey } = require('../../utils/outfitDate')

const storage = new Map()
global.wx = {
  getStorageSync(key) {
    return storage.get(key)
  },
  setStorageSync(key, value) {
    storage.set(key, value)
  },
  removeStorageSync(key) {
    storage.delete(key)
  }
}

const service = require('../../services/lowCarbonService.mock')
const today = getLocalDateKey()
const createdAt = dateKey => `${dateKey}T12:00:00`

async function run() {
  service.resetMockLowCarbonData()
  storage.delete(service.OUTFIT_STORAGE_KEY)
  let summary = await service.getLowCarbonSummary({ todayDateKey: today })
  assert.strictEqual(summary.data.totalClothes, 0)
  assert.strictEqual(summary.data.activityRate, 0)
  assert.ok(Number.isFinite(summary.data.activityRate))

  service.seedMockClothes([
    { _id: 'day29', name: '29天衣物', image: '/images/img1.png', createdAt: createdAt(shiftDateKey(today, -60)) },
    { _id: 'day30', name: '30天衣物', image: '/images/img2.png', createdAt: createdAt(shiftDateKey(today, -60)) },
    { _id: 'never30', name: '未穿衣物', image: '/images/img3.png', createdAt: createdAt(shiftDateKey(today, -31)) },
    { _id: 'active', name: '活跃衣物', image: '/images/img4.png', createdAt: createdAt(shiftDateKey(today, -100)) }
  ])
  storage.set(service.OUTFIT_STORAGE_KEY, [
    { dateKey: shiftDateKey(today, -29), clothingIds: ['day29', 'day29', 'active'] },
    { dateKey: shiftDateKey(today, -30), clothingIds: ['day30', 'active'] },
    { dateKey: today, clothingIds: ['active', 'active', 'deleted'] }
  ])

  const idle = await service.getIdleClothes({ todayDateKey: today })
  assert.deepStrictEqual(idle.data.clothes.map(item => item._id), ['never30', 'day30'])
  assert.strictEqual(idle.data.clothes.find(item => item._id === 'day30').wearCount, 1)
  assert.strictEqual(idle.data.clothes.find(item => item._id === 'day30').lastWornAt, shiftDateKey(today, -30))
  assert.strictEqual(idle.data.clothes.find(item => item._id === 'never30').neverWorn, true)
  assert.ok(!idle.data.clothes.some(item => item._id === 'day29'))

  summary = await service.getLowCarbonSummary({ todayDateKey: today })
  assert.strictEqual(summary.data.totalClothes, 4)
  assert.strictEqual(summary.data.activeClothes, 2)
  assert.strictEqual(summary.data.activityRate, 50)
  assert.strictEqual(summary.data.idleCount, 2)
  assert.ok(summary.data.suggestions.length <= 3)
  assert.ok(!summary.data.suggestions.join('').includes('千克'))

  const usage = service.buildUsageByClothing([
    { dateKey: today, clothingIds: ['A', 'A', 'B'] },
    { dateKey: today, clothingIds: ['A'] }
  ])
  assert.strictEqual(usage.get('A').wearCount, 2)
  assert.strictEqual(usage.get('B').wearCount, 1)

  assert.strictEqual((await service.getLowCarbonPriority()).data.lowCarbonPriority, false)
  await service.updateLowCarbonPriority({ enabled: true })
  assert.strictEqual((await service.getLowCarbonPriority()).data.lowCarbonPriority, true)
  const signals = await service.getRecommendationSignals({ todayDateKey: today })
  assert.strictEqual(signals.data.enabled, true)
  assert.strictEqual(signals.data.signals.length, 4)
  assert.ok(!signals.data.signals.some(item => item.clothingId === 'deleted'))
  assert.strictEqual(
    signals.data.signals.find(item => item.clothingId === 'active').wearCount,
    3
  )

  console.log('low-carbon-service.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
