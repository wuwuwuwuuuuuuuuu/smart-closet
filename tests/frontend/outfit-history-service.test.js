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

const service = require('../../services/outfitService.mock')

async function run() {
  service.seedMockOutfits([
    {
      _id: 'older-1',
      dateKey: '2026-07-01',
      slot: 1,
      outfitImageFileID: '/images/img1.png',
      clothingIds: ['A'],
      detailsExpired: false
    },
    {
      _id: 'today-3',
      dateKey: '2026-07-06',
      slot: 3,
      outfitImageFileID: '/images/img3.png',
      clothingIds: ['C'],
      detailsExpired: false
    },
    {
      _id: 'today-1',
      dateKey: '2026-07-06',
      slot: 1,
      outfitImageFileID: '/images/img2.png',
      clothingIds: ['A', 'A', 'B'],
      detailsExpired: false
    },
    {
      _id: 'middle-1',
      dateKey: '2026-07-05',
      slot: 1,
      outfitImageFileID: '/images/img4.png',
      clothingIds: [],
      detailsExpired: true
    }
  ])

  const result = await service.getOutfitHistory({ dateKey: '2026-07-06' })
  assert.strictEqual(result.code, 200)
  assert.strictEqual(result.data.selectedDate, '2026-07-06')
  assert.deepStrictEqual(result.data.records.map(item => item.slot), [1, 3])
  assert.deepStrictEqual(result.data.records[0].clothingIds, ['A', 'B'])
  assert.deepStrictEqual(result.data.availableDates, [
    '2026-07-06',
    '2026-07-05',
    '2026-07-01'
  ])

  const empty = await service.getOutfitHistory({ dateKey: '2026-06-30' })
  assert.strictEqual(empty.code, 200)
  assert.deepStrictEqual(empty.data.records, [])

  console.log('outfit-history-service.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
