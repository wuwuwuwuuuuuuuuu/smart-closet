const assert = require('assert')

let pageConfig
const toastCalls = []
const navigateCalls = []
global.Page = config => {
  pageConfig = config
}
global.wx = {
  showToast(options) {
    toastCalls.push(options)
  },
  navigateTo(options) {
    navigateCalls.push(options)
  }
}

const service = require('../../services/lowCarbonService')
require('../../pages/lowCarbon/lowCarbon')

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
  service.getLowCarbonSummary = async () => ({
    code: 200,
    data: {
      totalClothes: 10,
      activeClothes: 5,
      activityRate: 50,
      idleCount: 3,
      suggestions: ['建议一'],
      lowCarbonPriority: false
    }
  })
  service.getLowCarbonPriority = async () => ({
    code: 200,
    data: { lowCarbonPriority: false }
  })

  const page = createPage()
  await page.loadSummary()
  assert.strictEqual(page.data.activityRate, 50)
  assert.strictEqual(page.data.idleCount, 3)

  page.goToIdleClothes()
  assert.deepStrictEqual(navigateCalls.pop(), {
    url: '/pages/idleClothes/idleClothes'
  })

  service.updateLowCarbonPriority = async () => {
    throw new Error('保存失败')
  }
  await page.onPriorityChange({ detail: { value: true } })
  assert.strictEqual(page.data.lowCarbonPriority, false)
  assert.strictEqual(page.data.updatingPriority, false)
  assert.strictEqual(toastCalls.pop().title, '保存失败')

  console.log('low-carbon-page-behavior.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
