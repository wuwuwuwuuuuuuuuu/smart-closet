const assert = require('assert')

const storage = new Map()
const pageStack = []
const pageConfigs = []
let todayPage = null
let todayLoadPromise = Promise.resolve()
let previewConfig
let todayConfig

global.getApp = () => ({ globalData: { currentUserId: 'user-1' } })
global.getCurrentPages = () => pageStack
global.Page = config => {
  pageConfigs.push(config)
}

function createPage(config, route) {
  return {
    ...config,
    route,
    data: JSON.parse(JSON.stringify(config.data)),
    setData(nextData) {
      Object.assign(this.data, nextData)
    }
  }
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
  getStorageSync(key) {
    return storage.get(key)
  },
  setStorageSync(key, value) {
    storage.set(key, value)
  },
  removeStorageSync(key) {
    storage.delete(key)
  },
  showToast() {},
  showLoading() {},
  hideLoading() {},
  showModal(options) {
    if (options.title === '今日穿搭已满') {
      options.success({ confirm: true, cancel: false })
      return
    }
    if (options.success) {
      options.success({ confirm: false, cancel: true })
    }
  },
  navigateTo(options) {
    const route = options.url.replace(/^\//, '')
    if (route !== 'pages/todayOutfit/todayOutfit') return
    todayPage = createPage(todayConfig, route)
    pageStack.push(todayPage)
    todayLoadPromise = Promise.resolve(todayPage.onShow())
  },
  navigateBack() {
    pageStack.pop()
    const current = pageStack[pageStack.length - 1]
    if (current && current.onShow) current.onShow()
  }
}

require('../../pages/preview/preview')
previewConfig = pageConfigs.pop()
require('../../pages/todayOutfit/todayOutfit')
todayConfig = pageConfigs.pop()

const contextUtils = require('../../utils/currentTryonContext')
const mockService = require('../../services/outfitService.mock')

function openPreview(index) {
  const image = `https://example.com/result-${index}.png`
  contextUtils.setCurrentTryonContext({
    clothingIds: [`clothing-${index}`],
    source: 'wardrobe',
    resultImage: image,
    createdAt: new Date().toISOString()
  })
  const page = createPage(previewConfig, 'pages/preview/preview')
  pageStack.push(page)
  page.onLoad({ img: encodeURIComponent(image) })
  page.onShow()
  return page
}

function closePreview(page) {
  assert.strictEqual(pageStack[pageStack.length - 1], page)
  if (page.onUnload) page.onUnload()
  pageStack.pop()
}

async function run() {
  storage.clear()
  pageStack.push({ route: 'pages/tryon/tryon' })

  const savedSessions = []
  for (let index = 1; index <= 3; index += 1) {
    const preview = openPreview(index)
    await preview.performSaveTodayOutfit()
    assert.strictEqual(preview.data.isOutfitSaved, true)
    savedSessions.push({
      requestId: preview.data.outfitRequestId,
      image: preview.data.displayImage
    })
    assert.strictEqual((await mockService.getTodayOutfits()).data.count, index)
    closePreview(preview)
  }

  assert.strictEqual(new Set(savedSessions.map(item => item.requestId)).size, 3)
  const firstThree = (await mockService.getTodayOutfits()).data.outfits
  assert.deepStrictEqual(firstThree.map(item => item.slot), [1, 2, 3])
  assert.strictEqual(new Set(firstThree.map(item => item.requestId)).size, 3)
  assert.strictEqual(new Set(firstThree.map(item => item._id)).size, 3)

  const fourthPreview = openPreview(4)
  const fourthRequestId = fourthPreview.data.outfitRequestId
  const fourthImage = fourthPreview.data.displayImage
  const fourthClothingIds = [...fourthPreview.data.tryonClothingIds]
  await fourthPreview.performSaveTodayOutfit()
  await todayLoadPromise

  assert.strictEqual(fourthPreview.data.isOutfitSaved, false)
  assert.strictEqual(fourthPreview.data.isOutfitSaving, false)
  assert.strictEqual(
    (await mockService.getTodayOutfits()).data.outfits.find(item => (
      item.requestId === fourthRequestId
    )),
    undefined
  )
  assert.deepStrictEqual(pageStack.map(page => page.route), [
    'pages/tryon/tryon',
    'pages/preview/preview',
    'pages/todayOutfit/todayOutfit'
  ])
  const slotTwo = todayPage.data.outfits.find(item => item.slot === 2)
  await todayPage.performDeleteOutfit(slotTwo)
  assert.strictEqual(todayPage.data.count, 2)
  assert.strictEqual(todayPage.data.remaining, 1)

  wx.navigateBack({ delta: 1 })
  assert.deepStrictEqual(pageStack.map(page => page.route), [
    'pages/tryon/tryon',
    'pages/preview/preview'
  ])
  assert.strictEqual(fourthPreview.data.displayImage, fourthImage)
  assert.deepStrictEqual(fourthPreview.data.tryonClothingIds, fourthClothingIds)
  assert.strictEqual(fourthPreview.data.outfitRequestId, fourthRequestId)
  assert.strictEqual(fourthPreview.data.isOutfitSaved, false)
  assert.strictEqual(fourthPreview.data.isOutfitSaving, false)

  await fourthPreview.performSaveTodayOutfit()
  const finalToday = await mockService.getTodayOutfits()
  assert.strictEqual(fourthPreview.data.isOutfitSaved, true)
  assert.strictEqual(finalToday.data.count, 3)
  assert.strictEqual(
    finalToday.data.outfits.find(item => item.requestId === fourthRequestId).slot,
    2
  )

  console.log('four preview lifecycle flow verified', {
    requestIds: savedSessions.map(item => item.requestId).concat(fourthRequestId),
    countsAfterEachSave: [1, 2, 3],
    fourthLimitCode: 409,
    stackInManager: [
      'pages/tryon/tryon',
      'pages/preview/preview',
      'pages/todayOutfit/todayOutfit'
    ],
    stackAfterReturn: pageStack.map(page => page.route),
    retrySlot: 2,
    finalCount: finalToday.data.count
  })
  console.log('outfit-four-preview-flow.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
