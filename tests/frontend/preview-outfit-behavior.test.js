const assert = require('assert')

let pageConfig
const modalCalls = []
const toastCalls = []
const navigateCalls = []
const storage = new Map()

global.getApp = () => ({ globalData: { currentUserId: 'user-1' } })
global.Page = config => {
  pageConfig = config
}
global.wx = {
  cloud: {
    database() {
      return {
        serverDate() {
          return new Date()
        },
        collection() {
          return {
            add() {
              return Promise.resolve({})
            }
          }
        }
      }
    }
  },
  showModal(options) {
    modalCalls.push(options)
  },
  showToast(options) {
    toastCalls.push(options)
  },
  navigateTo(options) {
    navigateCalls.push(options)
  },
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

const outfitService = require('../../services/outfitService')
const mockOutfitService = require('../../services/outfitService.mock')
require('../../pages/preview/preview')

function createPage(data = {}) {
  return {
    ...pageConfig,
    data: {
      ...pageConfig.data,
      ...data
    },
    setData(nextData) {
      Object.assign(this.data, nextData)
    }
  }
}

async function run() {
  {
    const page = createPage({
      displayImage: 'wxfile://fused-result.png',
      tryonClothingIds: ['A', 'B'],
      outfitRequestId: 'stable-request'
    })
    let calls = 0
    let submitted
    let resolveSave
    outfitService.saveOutfitRecord = payload => {
      calls += 1
      submitted = payload
      return new Promise(resolve => {
        resolveSave = resolve
      })
    }

    const first = page.performSaveTodayOutfit()
    const second = page.performSaveTodayOutfit()
    assert.strictEqual(calls, 1)
    resolveSave({
      code: 200,
      message: 'ok',
      data: { _id: 'saved-1' }
    })
    await Promise.all([first, second])

    assert.strictEqual(submitted.outfitImageFileID, 'wxfile://fused-result.png')
    assert.deepStrictEqual(submitted.clothingIds, ['A', 'B'])
    assert.strictEqual(submitted.requestId, 'stable-request')
    assert.strictEqual(page.data.isOutfitSaved, true)
    assert.strictEqual(page.data.isOutfitSaving, false)
    assert.ok(modalCalls.some(item => item.title === '保存成功'))
  }

  {
    modalCalls.length = 0
    navigateCalls.length = 0
    const page = createPage({
      displayImage: 'https://example.com/original.png',
      tryonClothingIds: [],
      outfitRequestId: 'limit-request'
    })
    outfitService.saveOutfitRecord = async () => ({
      code: 409,
      message: '今日穿搭数量已达上限',
      data: {
        reason: 'DAILY_OUTFIT_LIMIT_REACHED',
        canManage: true
      }
    })

    await page.performSaveTodayOutfit()
    assert.strictEqual(page.data.isOutfitSaved, false)
    assert.strictEqual(page.data.isOutfitSaving, false)
    const limitModal = modalCalls.find(item => item.title === '今日穿搭已满')
    assert.ok(limitModal)
    limitModal.success({ confirm: true })
    assert.deepStrictEqual(navigateCalls.pop(), {
      url: '/pages/todayOutfit/todayOutfit'
    })

    page.saveTodayOutfit()
    const confirmModal = modalCalls.find(item => item.title === '保存今日穿搭')
    assert.match(confirmModal.content, /不会参与衣物使用统计/)
  }

  {
    toastCalls.length = 0
    const page = createPage({
      displayImage: '',
      tryonClothingIds: [],
      outfitRequestId: 'empty-image'
    })
    page.saveTodayOutfit()
    assert.strictEqual(toastCalls.pop().title, '当前没有可保存的穿搭图片')
  }

  {
    toastCalls.length = 0
    const page = createPage({
      displayImage: 'https://example.com/retry.png',
      tryonClothingIds: [],
      outfitRequestId: 'retry-request'
    })
    outfitService.saveOutfitRecord = async () => {
      throw new Error('保存失败，请稍后重试')
    }
    await page.performSaveTodayOutfit()
    assert.strictEqual(page.data.isOutfitSaved, false)
    assert.strictEqual(page.data.isOutfitSaving, false)
    assert.strictEqual(toastCalls.pop().title, '保存失败，请稍后重试')
  }

  {
    storage.clear()
    modalCalls.length = 0
    const dateKey = mockOutfitService.getShanghaiDateKey()
    mockOutfitService.seedMockOutfits([1, 2, 3].map(slot => ({
      _id: `existing-${slot}`,
      dateKey,
      slot,
      outfitImageFileID: `/images/img${slot}.png`,
      clothingIds: [],
      requestId: `existing-request-${slot}`,
      detailsExpired: false,
      createdAt: new Date().toISOString()
    })))
    outfitService.saveOutfitRecord = mockOutfitService.saveOutfitRecord

    const page = createPage({
      displayImage: 'https://example.com/fourth.png',
      tryonClothingIds: ['A'],
      outfitRequestId: 'fourth-request'
    })
    await page.performSaveTodayOutfit()

    assert.strictEqual(page.data.isOutfitSaved, false)
    assert.strictEqual(page.data.isOutfitSaving, false)
    assert.strictEqual(page.data.displayImage, 'https://example.com/fourth.png')
    assert.strictEqual(page.data.outfitRequestId, 'fourth-request')
    assert.ok(modalCalls.some(item => item.title === '今日穿搭已满'))
    assert.strictEqual((await mockOutfitService.getTodayOutfits()).data.count, 3)

    await mockOutfitService.deleteTodayOutfit('existing-2')
    const afterDelete = await mockOutfitService.getTodayOutfits()
    assert.strictEqual(afterDelete.data.count, 2)
    assert.strictEqual(afterDelete.data.remaining, 1)

    await page.performSaveTodayOutfit()
    const afterRetry = await mockOutfitService.getTodayOutfits()
    assert.strictEqual(page.data.isOutfitSaved, true)
    assert.strictEqual(page.data.outfitRequestId, 'fourth-request')
    assert.strictEqual(afterRetry.data.count, 3)
    assert.strictEqual(
      afterRetry.data.outfits.find(item => item.requestId === 'fourth-request').slot,
      2
    )
  }

  console.log('preview-outfit-behavior.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
