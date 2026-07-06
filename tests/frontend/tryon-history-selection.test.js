const assert = require('assert')

const storage = new Map()
const toastCalls = []
let pageConfig

global.getApp = () => ({ globalData: { currentUserId: 'user-1' } })
global.Page = config => {
  pageConfig = config
}
global.wx = {
  cloud: {
    database() {
      return {}
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
  }
}

const selectionEntry = require('../../utils/tryonSelectionEntry')
require('../../pages/tryon/tryon')

function createPage() {
  return {
    ...pageConfig,
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(nextData) {
      Object.assign(this.data, nextData)
    }
  }
}

const clothes = [
  { _id: 'A', image: '/images/a.png' },
  { _id: 'B', image: '/images/b.png' }
]

{
  const page = createPage()
  selectionEntry.setTryonSelectionEntry({
    clothingIds: ['A', 'missing', 'B'],
    source: 'outfitHistory'
  })
  page.pendingSmartRecommendEntry = page.consumePendingSmartRecommendEntry()
  assert.strictEqual(storage.get(selectionEntry.STORAGE_KEY).active, false)
  page.applySmartRecommendEntryIfNeeded(clothes)
  assert.deepStrictEqual(page.data.selectedClothes.map(item => item._id), ['A', 'B'])
  assert.strictEqual(
    toastCalls.pop().title,
    '部分历史衣物已不在衣橱中，已为你选择剩余衣物'
  )
  assert.strictEqual(page.consumePendingSmartRecommendEntry(), null)
}

{
  const page = createPage()
  selectionEntry.setTryonSelectionEntry({
    clothingIds: ['deleted'],
    source: 'outfitHistory'
  })
  page.pendingSmartRecommendEntry = page.consumePendingSmartRecommendEntry()
  page.applySmartRecommendEntryIfNeeded(clothes)
  assert.deepStrictEqual(page.data.selectedClothes, [])
  assert.strictEqual(
    toastCalls.pop().title,
    '这套历史穿搭中的衣物已不在当前衣橱中'
  )
}

{
  const page = createPage()
  selectionEntry.setTryonSelectionEntry({
    clothingIds: ['A'],
    source: 'smartRecommend'
  })
  const entry = storage.get(selectionEntry.STORAGE_KEY)
  entry.title = '智能推荐测试'
  storage.set(selectionEntry.STORAGE_KEY, entry)
  page.pendingSmartRecommendEntry = page.consumePendingSmartRecommendEntry()
  page.applySmartRecommendEntryIfNeeded(clothes)
  assert.deepStrictEqual(page.data.selectedClothes.map(item => item._id), ['A'])
  assert.strictEqual(page.data.smartRecommendEntry.source, 'smartRecommend')
}

{
  const page = createPage()
  selectionEntry.setTryonSelectionEntry({
    clothingIds: ['A', 'deleted'],
    source: 'todayOutfit'
  })
  page.pendingSmartRecommendEntry = page.consumePendingSmartRecommendEntry()
  page.applySmartRecommendEntryIfNeeded(clothes)
  assert.deepStrictEqual(page.data.selectedClothes.map(item => item._id), ['A'])
  assert.strictEqual(
    toastCalls.pop().title,
    '部分衣物已不在衣橱中，已为你选择剩余衣物'
  )
}

{
  const page = createPage()
  selectionEntry.setTryonSelectionEntry({
    clothingIds: ['deleted'],
    source: 'todayOutfit'
  })
  page.pendingSmartRecommendEntry = page.consumePendingSmartRecommendEntry()
  page.applySmartRecommendEntryIfNeeded(clothes)
  assert.deepStrictEqual(page.data.selectedClothes, [])
  assert.strictEqual(
    toastCalls.pop().title,
    '这套穿搭中的衣物已不在当前衣橱中'
  )
}

console.log('tryon-history-selection.test.js passed')
