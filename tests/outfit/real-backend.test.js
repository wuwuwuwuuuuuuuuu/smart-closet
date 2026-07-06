const assert = require('assert')
const { saveOutfitRecord, MAX_CLOTHING_IDS } = require('../../cloudfunctions/saveOutfitRecord/service')
const { deleteTodayOutfit } = require('../../cloudfunctions/deleteTodayOutfit/service')
const { getTodayOutfits } = require('../../cloudfunctions/getTodayOutfits/service')
const {
  getOutfitHistory,
  protectRecordDetails
} = require('../../cloudfunctions/getOutfitHistory/service')
const { expireOutfitDetails } = require('../../cloudfunctions/expireOutfitDetails/service')
const {
  buildUsageDocumentId
} = require('../../cloudfunctions/saveOutfitRecord/common/outfit-document-id')

const OPENID = 'openid-1'
const USER_ID = 'user-1'
const NOW = new Date('2026-07-05T04:00:00.000Z')

function clone(value) {
  return structuredClone(value)
}

class Gateway {
  constructor() {
    this.users = [{ _id: USER_ID, _openid: OPENID }]
    this.clothes = [
      { _id: 'A', _openid: OPENID, user_id: USER_ID },
      { _id: 'B', _openid: OPENID, user_id: USER_ID }
    ]
    this.outfits = []
    this.usages = []
    this.operationCount = 0
    this.failUpdateClothing = false
  }

  serverDate() { return new Date(NOW) }
  async findUser(openid) { return this.users.find(item => item._openid === openid) }
  async findOutfitByRequest(openid, requestId) {
    return this.outfits.find(item => item._openid === openid && item.requestId === requestId)
  }
  async listToday(openid, dateKey) {
    return this.outfits.filter(item => item._openid === openid && item.dateKey === dateKey)
  }
  async findOutfit(id) { return this.outfits.find(item => item._id === id) }
  async findLatestUsageBefore(openid, clothingId, dateKey) {
    return this.usages.filter(item => (
      item._openid === openid && item.clothingId === clothingId && item.dateKey < dateKey
    )).sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0]
  }

  async runTransaction(callback) {
    const snapshot = clone({
      clothes: this.clothes,
      outfits: this.outfits,
      usages: this.usages
    })
    this.operationCount = 0
    try {
      const result = await callback(this.transaction())
      if (this.operationCount > 100) throw new Error('too many transaction operations')
      return result
    } catch (error) {
      this.clothes = snapshot.clothes
      this.outfits = snapshot.outfits
      this.usages = snapshot.usages
      throw error
    }
  }

  transaction() {
    const count = () => { this.operationCount += 1 }
    return {
      findClothing: async id => {
        count()
        return this.clothes.find(item => item._id === id)
      },
      findOutfit: async id => {
        count()
        return this.outfits.find(item => item._id === id)
      },
      setOutfit: async (id, data) => {
        count()
        const item = { _id: id, ...clone(data) }
        this.outfits.push(item)
        return item
      },
      findUsage: async id => {
        count()
        return this.usages.find(item => item._id === id)
      },
      setUsage: async (id, data) => {
        count()
        this.usages.push({ _id: id, ...clone(data) })
      },
      updateUsage: async (id, data) => {
        count()
        Object.assign(this.usages.find(item => item._id === id), clone(data))
      },
      removeUsage: async id => {
        count()
        this.usages = this.usages.filter(item => item._id !== id)
      },
      updateClothing: async (id, data) => {
        count()
        if (this.failUpdateClothing) throw new Error('injected transaction failure')
        Object.assign(this.clothes.find(item => item._id === id), clone(data))
      },
      removeOutfit: async id => {
        count()
        this.outfits = this.outfits.filter(item => item._id !== id)
      }
    }
  }
}

function save(gateway, requestId, clothingIds = ['A'], extra = {}) {
  return saveOutfitRecord({
    gateway,
    openid: OPENID,
    now: NOW,
    event: {
      outfitImageFileID: `cloud://env/${requestId}.png`,
      clothingIds,
      requestId,
      dateKey: 'untrusted',
      slot: 99,
      ...extra
    }
  })
}

async function run() {
  const gateway = new Gateway()
  const first = await save(gateway, 'r1', ['A', 'A', '', 'B'])
  const second = await save(gateway, 'r2', ['A'])
  const third = await save(gateway, 'r3', [])
  assert.deepStrictEqual([first.data.slot, second.data.slot, third.data.slot], [1, 2, 3])
  assert.deepStrictEqual(first.data.clothingIds, ['A', 'B'])
  assert.strictEqual(gateway.usages.find(item => item.clothingId === 'A').count, 2)
  assert.strictEqual((await save(gateway, 'r4')).code, 409)

  const duplicate = await save(gateway, 'r1', ['A'])
  assert.strictEqual(duplicate.data.idempotent, true)
  assert.strictEqual(gateway.outfits.length, 3)

  const today = await getTodayOutfits({ gateway, openid: OPENID, now: NOW })
  assert.deepStrictEqual(today.data.outfits.map(item => item.slot), [1, 2, 3])

  const slotTwo = gateway.outfits.find(item => item.slot === 2)
  assert.strictEqual((await deleteTodayOutfit({
    gateway, openid: OPENID, event: { outfitId: slotTwo._id }, now: NOW
  })).code, 200)
  assert.strictEqual(gateway.clothes.find(item => item._id === 'A').wearCount, 1)
  assert.strictEqual((await save(gateway, 'r4')).data.slot, 2)

  const historical = { ...gateway.outfits[0], _id: 'old', dateKey: '2026-07-04' }
  gateway.outfits.push(historical)
  assert.strictEqual((await deleteTodayOutfit({
    gateway, openid: OPENID, event: { outfitId: 'old' }, now: NOW
  })).code, 409)

  const rollbackGateway = new Gateway()
  rollbackGateway.failUpdateClothing = true
  await assert.rejects(() => save(rollbackGateway, 'rollback'), /injected/)
  assert.strictEqual(rollbackGateway.outfits.length, 0)
  assert.strictEqual(rollbackGateway.usages.length, 0)

  const historyGateway = {
    findUser: async () => ({ _id: USER_ID }),
    listByDate: async () => [
      { _id: 's2', dateKey: '2026-06-25', slot: 2, clothingIds: ['A'] },
      { _id: 's1', dateKey: '2026-06-25', slot: 1, clothingIds: ['B'] }
    ],
    listAllDateKeys: async () => [
      { dateKey: '2026-06-25' },
      { dateKey: '2026-07-05' },
      { dateKey: '2026-06-25' }
    ]
  }
  const history = await getOutfitHistory({
    gateway: historyGateway,
    openid: OPENID,
    event: { dateKey: '2026-06-25' },
    now: NOW
  })
  assert.deepStrictEqual(history.data.records.map(item => item.slot), [1, 2])
  assert.ok(history.data.records.every(item => item.clothingIds.length === 0))
  assert.deepStrictEqual(history.data.availableDates, ['2026-07-05', '2026-06-25'])
  assert.deepStrictEqual(protectRecordDetails({
    dateKey: '2026-07-04',
    detailsExpired: true,
    clothingIds: ['A']
  }, '2026-07-05').clothingIds, [])
  assert.deepStrictEqual(protectRecordDetails({
    dateKey: '2026-06-26',
    detailsExpired: false,
    clothingIds: ['A']
  }, '2026-07-05').clothingIds, ['A'])

  const expiring = [
    { _id: 'old-1', clothingIds: ['A'], detailsExpired: false, outfitImageFileID: 'cloud://old.png' }
  ]
  const expireGateway = {
    listOlderThan: async () => expiring,
    expireRecord: async id => {
      const item = expiring.find(record => record._id === id)
      item.clothingIds = []
      item.detailsExpired = true
    }
  }
  const expiredFirst = await expireOutfitDetails({ gateway: expireGateway, now: NOW })
  const expiredSecond = await expireOutfitDetails({ gateway: expireGateway, now: NOW })
  assert.strictEqual(expiredFirst.data.updated, 1)
  assert.strictEqual(expiredSecond.data.updated, 0)
  assert.strictEqual(expiring[0].outfitImageFileID, 'cloud://old.png')

  const tooMany = Array.from({ length: MAX_CLOTHING_IDS + 1 }, (_, index) => `C${index}`)
  assert.strictEqual((await save(new Gateway(), 'too-many', tooMany)).code, 400)

  const maxGateway = new Gateway()
  maxGateway.clothes = Array.from({ length: MAX_CLOTHING_IDS }, (_, index) => ({
    _id: `C${index}`,
    _openid: OPENID,
    user_id: USER_ID
  }))
  assert.strictEqual((await save(
    maxGateway,
    'at-limit',
    maxGateway.clothes.map(item => item._id)
  )).code, 200)
  assert.strictEqual(maxGateway.operationCount, 100)

  console.log('real-backend.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
