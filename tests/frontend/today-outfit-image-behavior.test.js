const assert = require('assert')
const fs = require('fs')
const path = require('path')

const storage = new Map()
const switchTabCalls = []
const previewCalls = []
let pageConfig

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
  switchTab(options) {
    switchTabCalls.push(options)
  },
  previewImage(options) {
    previewCalls.push(options)
    if (options.success) options.success({})
  },
  showToast() {}
}

require('../../pages/todayOutfit/todayOutfit')

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
  const page = createPage()
  const linked = {
    _id: 'today-1',
    outfitImageFileID: '/images/outfit.png',
    clothingIds: ['A', '', 'A', 'B']
  }
  await page.onOutfitImageTap({
    currentTarget: { dataset: { outfit: linked } }
  })

  assert.deepStrictEqual(switchTabCalls, [{ url: '/pages/tryon/tryon' }])
  assert.deepStrictEqual(
    storage.get('smartRecommendTryonEntry').selectedClothesIds,
    ['A', 'B']
  )
  assert.strictEqual(storage.get('smartRecommendTryonEntry').source, 'todayOutfit')
  assert.strictEqual(previewCalls.length, 0)

  await page.onOutfitImageTap({
    currentTarget: {
      dataset: {
        outfit: {
          _id: 'today-2',
          outfitImageFileID: '/images/product.png',
          clothingIds: []
        }
      }
    }
  })
  assert.strictEqual(switchTabCalls.length, 1)
  assert.strictEqual(previewCalls.length, 1)

  const wxml = fs.readFileSync(
    path.resolve(__dirname, '../../pages/todayOutfit/todayOutfit.wxml'),
    'utf8'
  )
  assert.match(wxml, /bindtap="onOutfitImageTap"/)
  assert.match(wxml, /catchtap="saveImage"/)
  assert.match(wxml, /catchtap="deleteOutfit"/)

  console.log('today-outfit-image-behavior.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
