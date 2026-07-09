const assert = require('assert')
const { getLowCarbonSummary } = require('../../cloudfunctions/getLowCarbonSummary/service')
const { getIdleClothes } = require('../../cloudfunctions/getIdleClothes/service')
const { getLowCarbonPriority } = require('../../cloudfunctions/getLowCarbonPriority/service')
const { updateLowCarbonPriority } = require('../../cloudfunctions/updateLowCarbonPriority/service')
const { getRecommendationSignals } = require('../../cloudfunctions/getRecommendationSignals/service')
const {
  naturalDayDifference,
  isWithinRecentDays,
  buildLowCarbonStatistics
} = require('../../cloudfunctions/getLowCarbonSummary/common/low-carbon-core')

const OPENID = 'openid-1'
const OTHER_OPENID = 'openid-2'
const USER_ID = 'user-1'
const OTHER_USER_ID = 'user-2'
const NOW = new Date('2026-07-07T04:00:00.000Z')

class Gateway {
  constructor({ users, clothes } = {}) {
    this.users = users || [{ _id: USER_ID, _openid: OPENID }]
    this.clothes = clothes || []
    this.updates = []
    this.pageCalls = []
  }

  async findUser(openid) {
    return this.users.find(item => item._openid === openid) || null
  }

  async listClothesPage(openid, userId, offset, limit) {
    this.pageCalls.push({ openid, userId, offset, limit })
    return this.clothes
      .filter(item => item.user_id === userId)
      .filter(item => !item._openid || item._openid === openid)
      .slice(offset, offset + limit)
  }

  async updateUser(userId, data) {
    const user = this.users.find(item => item._id === userId)
    Object.assign(user, data)
    this.updates.push({ userId, data })
    return { updated: 1 }
  }
}

function clothing(overrides) {
  return {
    _id: 'cloth-default',
    _openid: OPENID,
    user_id: USER_ID,
    name: 'default cloth',
    image: 'cloud://env/default.png',
    created_at: new Date('2026-06-01T00:00:00+08:00'),
    wearCount: 0,
    lastWornAt: null,
    ...overrides
  }
}

async function run() {
  assert.strictEqual(naturalDayDifference('2026-07-07', '2026-06-23'), 14)
  assert.strictEqual(naturalDayDifference('2026-07-07', '2026-06-22'), 15)
  assert.strictEqual(naturalDayDifference('2026-07-07', '2026-06-08'), 29)
  assert.strictEqual(naturalDayDifference('2026-07-07', '2026-06-07'), 30)
  assert.strictEqual(isWithinRecentDays('2026-06-08', '2026-07-07', 30), true)
  assert.strictEqual(isWithinRecentDays('2026-06-07', '2026-07-07', 30), false)

  const emptySummary = await getLowCarbonSummary({ gateway: new Gateway(), openid: OPENID, now: NOW })
  assert.strictEqual(emptySummary.code, 200)
  assert.strictEqual(emptySummary.data.totalClothes, 0)
  assert.strictEqual(emptySummary.data.activityRate, 0)
  assert.deepStrictEqual(emptySummary.data.suggestions, ['衣橱还没有衣物，先添加衣物后再查看使用情况。'])

  const noUsageGateway = new Gateway({
    clothes: [
      clothing({ _id: 'new-14', name: 'new 14', created_at: new Date('2026-06-23T00:00:00+08:00') }),
      clothing({ _id: 'idle-15', name: 'idle 15', created_at: new Date('2026-06-22T00:00:00+08:00') }),
      clothing({ _id: 'age-missing', name: 'age missing', created_at: null, createdAt: null }),
      clothing({ _id: 'other-user', _openid: OTHER_OPENID, user_id: OTHER_USER_ID, name: 'other user cloth' })
    ]
  })
  const noUsageIdle = await getIdleClothes({ gateway: noUsageGateway, openid: OPENID, now: NOW })
  assert.deepStrictEqual(noUsageIdle.data.clothes.map(item => item._id), ['idle-15'])
  assert.strictEqual(noUsageIdle.data.clothes[0].neverWorn, true)
  assert.strictEqual(noUsageIdle.data.clothes[0].lastWornAt, null)
  assert.strictEqual(noUsageIdle.data.clothes[0].unusedDays, 15)

  const mixedGateway = new Gateway({
    users: [{ _id: USER_ID, _openid: OPENID, lowCarbonPriority: true, nickname: 'keep me' }],
    clothes: [
      clothing({ _id: 'active-29', name: 'active but idle by 15-day rule', wearCount: 3, lastWornAt: new Date('2026-06-08T00:00:00+08:00') }),
      clothing({ _id: 'idle-used-30', name: 'idle and inactive by 30-day active window', wearCount: 2, lastWornAt: new Date('2026-06-07T00:00:00+08:00') }),
      clothing({ _id: 'invalid-wear', name: 'invalid wear', wearCount: -5, created_at: new Date('2026-07-01T00:00:00+08:00') }),
      clothing({ _id: 'missing-worn', name: 'missing worn date', wearCount: 5, lastWornAt: 'bad-date', created_at: new Date('2026-05-01T00:00:00+08:00') }),
      clothing({ _id: 'never-old', name: 'never old', wearCount: 0, created_at: new Date('2026-05-01T00:00:00+08:00') })
    ]
  })
  const mixedSummary = await getLowCarbonSummary({ gateway: mixedGateway, openid: OPENID, now: NOW })
  assert.strictEqual(mixedSummary.data.totalClothes, 5)
  assert.strictEqual(mixedSummary.data.activeClothes, 1)
  assert.strictEqual(mixedSummary.data.activityRate, 20)
  assert.strictEqual(Number.isNaN(mixedSummary.data.activityRate), false)
  assert.strictEqual(mixedSummary.data.lowCarbonPriority, true)
  assert.ok(mixedSummary.data.suggestions.length <= 3)
  assert.ok(mixedSummary.data.suggestions.every(item => !item.includes('千克') && !item.includes('碳排放量')))

  const mixedIdle = await getIdleClothes({ gateway: mixedGateway, openid: OPENID, now: NOW })
  assert.deepStrictEqual(mixedIdle.data.clothes.map(item => item._id), ['never-old', 'idle-used-30', 'active-29'])
  assert.strictEqual(mixedIdle.data.clothes[0].unusedDays > mixedIdle.data.clothes[1].unusedDays, true)
  assert.strictEqual(mixedIdle.data.clothes[1].wearCount, 2)
  assert.strictEqual(mixedIdle.data.clothes[1].lastWornAt, '2026-06-07')

  const priorityMissing = await getLowCarbonPriority({ gateway: new Gateway(), openid: OPENID })
  assert.strictEqual(priorityMissing.data.lowCarbonPriority, false)

  const invalidUpdate = await updateLowCarbonPriority({ gateway: new Gateway(), openid: OPENID, event: { enabled: 'true' } })
  assert.strictEqual(invalidUpdate.code, 400)

  const missingUserUpdate = await updateLowCarbonPriority({ gateway: new Gateway({ users: [] }), openid: OPENID, event: { enabled: true } })
  assert.strictEqual(missingUserUpdate.code, 404)

  const updateGateway = new Gateway({ users: [{ _id: USER_ID, _openid: OPENID, nickname: 'do not overwrite', lowCarbonPriority: false }] })
  const updated = await updateLowCarbonPriority({ gateway: updateGateway, openid: OPENID, event: { enabled: true } })
  assert.strictEqual(updated.code, 200)
  assert.strictEqual(updateGateway.users[0].lowCarbonPriority, true)
  assert.strictEqual(updateGateway.users[0].nickname, 'do not overwrite')

  const signalsDisabled = await getRecommendationSignals({ gateway: new Gateway(), openid: OPENID, now: NOW })
  assert.strictEqual(signalsDisabled.data.enabled, false)
  assert.deepStrictEqual(signalsDisabled.data.signals, [])

  const signals = await getRecommendationSignals({ gateway: mixedGateway, openid: OPENID, now: NOW })
  assert.strictEqual(signals.data.enabled, true)
  assert.strictEqual(signals.data.signals.length, 5)
  assert.ok(signals.data.signals.every(item => item.clothingId && Number.isFinite(item.wearCount) && Number.isFinite(item.unusedDays)))

  const manyClothes = Array.from({ length: 205 }, (_, index) => clothing({
    _id: 'cloth-' + index,
    name: 'cloth ' + index,
    created_at: new Date('2026-07-01T00:00:00+08:00')
  }))
  const pageGateway = new Gateway({ clothes: manyClothes })
  const pagedSummary = await getLowCarbonSummary({ gateway: pageGateway, openid: OPENID, now: NOW })
  assert.strictEqual(pagedSummary.data.totalClothes, 205)
  assert.deepStrictEqual(pageGateway.pageCalls.map(item => item.offset), [0, 100, 200])
  assert.ok(pageGateway.pageCalls.every(item => item.userId === USER_ID && item.openid === OPENID))

  const directStats = buildLowCarbonStatistics({
    clothes: [
      clothing({ _id: 'own' }),
      clothing({ _id: 'other-openid', _openid: OTHER_OPENID }),
      clothing({ _id: 'other-user', user_id: OTHER_USER_ID })
    ],
    user: { _id: USER_ID },
    openid: OPENID,
    todayDateKey: '2026-07-07'
  })
  assert.strictEqual(directStats.totalClothes, 1)

  console.log('real-low-carbon-backend.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})