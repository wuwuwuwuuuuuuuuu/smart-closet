const assert = require('assert')

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

const mockService = require('../../services/outfitService.mock')
const outfitService = require('../../services/outfitService')

async function run() {
  mockService.resetMockOutfits()
  const empty = await outfitService.getTodayOutfits()
  assert.strictEqual(empty.code, 200)
  assert.strictEqual(empty.data.count, 0)
  assert.strictEqual(empty.data.remaining, 3)
  assert.deepStrictEqual(empty.data.outfits, [])

  const dateKey = mockService.getShanghaiDateKey()
  mockService.seedMockOutfits([
    {
      _id: 'slot-3',
      dateKey,
      slot: 3,
      outfitImageFileID: '/images/img1.png',
      clothingIds: []
    },
    {
      _id: 'slot-1',
      dateKey,
      slot: 1,
      outfitImageFileID: '/images/img2.png',
      clothingIds: []
    }
  ])
  const sorted = await outfitService.getTodayOutfits()
  assert.strictEqual(sorted.data.count, 2)
  assert.strictEqual(sorted.data.remaining, 1)
  assert.deepStrictEqual(sorted.data.outfits.map(item => item.slot), [1, 3])

  mockService.resetMockOutfits()
  const first = await outfitService.saveOutfitRecord({
    outfitImageFileID: '/images/img1.png',
    clothingIds: ['A', ' A ', '', 'B'],
    requestId: 'request-1'
  })
  const duplicate = await outfitService.saveOutfitRecord({
    outfitImageFileID: '/images/img2.png',
    clothingIds: ['A'],
    requestId: 'request-1'
  })
  assert.strictEqual(first.data.slot, 1)
  assert.deepStrictEqual(first.data.clothingIds, ['A', 'B'])
  assert.strictEqual(duplicate.data.idempotent, true)
  assert.strictEqual((await outfitService.getTodayOutfits()).data.count, 1)

  const second = await outfitService.saveOutfitRecord({
    outfitImageFileID: '/images/img2.png',
    clothingIds: [],
    requestId: 'request-2'
  })
  const third = await outfitService.saveOutfitRecord({
    outfitImageFileID: '/images/img4.png',
    clothingIds: [],
    requestId: 'request-3'
  })
  const fourth = await outfitService.saveOutfitRecord({
    outfitImageFileID: '/images/img38.png',
    clothingIds: [],
    requestId: 'request-4'
  })
  assert.deepStrictEqual([second.data.slot, third.data.slot], [2, 3])
  assert.strictEqual(fourth.code, 409)
  assert.strictEqual(fourth.data.reason, 'DAILY_OUTFIT_LIMIT_REACHED')
  assert.strictEqual((await outfitService.getTodayOutfits()).data.count, 3)
  assert.strictEqual(
    (await outfitService.getTodayOutfits()).data.outfits.some(item => (
      item.requestId === 'request-4'
    )),
    false
  )

  const deleted = await outfitService.deleteTodayOutfit(second.data._id)
  assert.strictEqual(deleted.code, 200)
  const replacement = await outfitService.saveOutfitRecord({
    outfitImageFileID: '/images/img38.png',
    clothingIds: [],
    requestId: 'request-4'
  })
  assert.strictEqual(replacement.data.slot, 2)
  assert.strictEqual(replacement.requestId, undefined)
  assert.strictEqual(replacement.data.requestId, 'request-4')
  assert.strictEqual((await outfitService.getTodayOutfits()).data.count, 3)

  mockService.seedMockOutfits([1, 2, 3].map(index => ({
    _id: `malformed-slot-${index}`,
    dateKey,
    slot: '1',
    outfitImageFileID: '/images/img1.png',
    clothingIds: [],
    requestId: `malformed-request-${index}`
  })))
  const countLimited = await outfitService.saveOutfitRecord({
    outfitImageFileID: '/images/img2.png',
    clothingIds: [],
    requestId: 'count-limit-request'
  })
  assert.strictEqual(countLimited.code, 409)
  assert.strictEqual((await outfitService.getTodayOutfits()).data.count, 3)

  mockService.seedMockOutfits([{
    _id: 'historical',
    dateKey: '2000-01-01',
    slot: 1,
    outfitImageFileID: '/images/img1.png',
    clothingIds: []
  }])
  const frozen = await outfitService.deleteTodayOutfit('historical')
  assert.strictEqual(frozen.code, 409)
  assert.strictEqual(frozen.data.reason, 'HISTORICAL_OUTFIT_FROZEN')

  console.log('outfit-service.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
