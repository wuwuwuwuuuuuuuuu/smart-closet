const assert = require('assert')
const { getLocalDateKey, shiftDateKey } = require('../../utils/outfitDate')

let pageConfig
const toastCalls = []
const storage = new Map()
const switchTabCalls = []
const previewCalls = []

global.Page = config => {
  pageConfig = config
}
global.wx = {
  cloud: {
    getTempFileURL() {
      return Promise.resolve({ fileList: [] })
    }
  },
  getStorageSync(key) {
    return storage.get(key)
  },
  setStorageSync(key, value) {
    storage.set(key, value)
  },
  showToast(options) {
    toastCalls.push(options)
  },
  showLoading() {},
  hideLoading() {},
  previewImage(options) {
    previewCalls.push(options)
    if (options.success) options.success({})
  },
  switchTab(options) {
    switchTabCalls.push(options)
  }
}

const outfitService = require('../../services/outfitService')
require('../../pages/outfitHistory/outfitHistory')

function createPage() {
  return {
    ...pageConfig,
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(nextData) {
      Object.assign(this.data, nextData)
    }
  }
}

async function run() {
  const today = getLocalDateKey()
  const dayMinus9 = shiftDateKey(today, -9)
  const dayMinus10 = shiftDateKey(today, -10)
  const expiredRecent = shiftDateKey(today, -1)

  outfitService.getOutfitHistory = async ({ dateKey }) => ({
    code: 200,
    message: '获取历史穿搭成功',
    data: {
      selectedDate: dateKey,
      availableDates: [today, expiredRecent, dayMinus9, dayMinus10],
      records: dateKey === today
        ? [{
          _id: 'today',
          dateKey: today,
          slot: 1,
          outfitImageFileID: '/images/img1.png',
          clothingIds: ['A', 'A', 'B'],
          detailsExpired: false
        }]
        : dateKey === dayMinus9
          ? [{
            _id: 'minus-9',
            dateKey: dayMinus9,
            slot: 1,
            outfitImageFileID: '/images/img9.png',
            clothingIds: ['A'],
            detailsExpired: false
          }]
          : dateKey === dayMinus10
            ? [{
              _id: 'minus-10',
              dateKey: dayMinus10,
              slot: 1,
              outfitImageFileID: '/images/img10.png',
              clothingIds: ['A'],
              detailsExpired: false
            }]
            : [{
              _id: 'expired',
              dateKey: expiredRecent,
              slot: 1,
              outfitImageFileID: '/images/expired.png',
              clothingIds: ['A'],
              detailsExpired: true
            }]
    }
  })

  const page = createPage()
  page.onLoad()
  assert.strictEqual(page.data.selectedDate, today)

  await page.loadHistory(today)
  await page.onOutfitImageTap({
    currentTarget: { dataset: { record: page.data.records[0] } }
  })
  assert.deepStrictEqual(switchTabCalls.pop(), { url: '/pages/tryon/tryon' })
  assert.deepStrictEqual(
    storage.get('smartRecommendTryonEntry').selectedClothesIds,
    ['A', 'B']
  )

  await page.loadHistory(dayMinus9)
  await page.onOutfitImageTap({
    currentTarget: { dataset: { record: page.data.records[0] } }
  })
  assert.deepStrictEqual(switchTabCalls.pop(), { url: '/pages/tryon/tryon' })

  await page.loadHistory(dayMinus10)
  await page.onOutfitImageTap({
    currentTarget: { dataset: { record: page.data.records[0] } }
  })
  assert.strictEqual(previewCalls.length, 1)

  await page.loadHistory(expiredRecent)
  await page.onOutfitImageTap({
    currentTarget: { dataset: { record: page.data.records[0] } }
  })
  assert.strictEqual(previewCalls.length, 2)

  await page.onOutfitImageTap({
    currentTarget: {
      dataset: {
        record: {
          _id: 'empty',
          dateKey: today,
          outfitImageFileID: '/images/empty.png',
          clothingIds: [],
          detailsExpired: false
        }
      }
    }
  })
  assert.strictEqual(previewCalls.length, 3)

  page.onDateChange({ detail: { value: shiftDateKey(today, 1) } })
  assert.strictEqual(toastCalls.pop().title, '不能选择未来日期')

  console.log('outfit-history-behavior.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
