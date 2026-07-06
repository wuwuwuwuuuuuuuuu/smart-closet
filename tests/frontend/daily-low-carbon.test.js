const assert = require('assert')

let pageConfig
global.Page = config => {
  pageConfig = config
}
global.wx = {
  showToast() {}
}

const lowCarbonService = require('../../services/lowCarbonService')
require('../../pages/daily/daily')

function createPage() {
  const page = {
    ...pageConfig,
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(nextData) {
      Object.assign(this.data, nextData)
    }
  }
  page.data.pendingUserInput = '夏季通勤'
  page.data.currentCity = '测试城市'
  page.data.currentDateLabel = '今天'
  page.data.weatherSuggestion = '天气炎热'
  page.data.weatherInfo = { temp: 30, text: '晴', icon: '☀️' }
  return page
}

function flushPromises() {
  return new Promise(resolve => setImmediate(resolve))
}

async function submitAndCapture(signalResult) {
  const page = createPage()
  let capturedPayload
  lowCarbonService.getRecommendationSignals = async () => signalResult
  page.requestRecommendationWithFallback = async payload => {
    capturedPayload = payload
    return {
      requestId: 'result-1',
      summary: '推荐',
      replyText: '推荐结果',
      selectedClothesIds: ['A'],
      lowCarbonApplied: payload.lowCarbonPriority === true,
      lowCarbonReason: payload.lowCarbonPriority
        ? '优先考虑了较少使用的合适衣物'
        : ''
    }
  }
  await page.submitRecommendationRequest()
  await flushPromises()
  return { page, capturedPayload }
}

async function run() {
  const disabled = await submitAndCapture({
    code: 200,
    data: { enabled: false, signals: [{ clothingId: 'A' }] }
  })
  assert.strictEqual('lowCarbonPriority' in disabled.capturedPayload, false)
  assert.strictEqual('lowCarbonSignals' in disabled.capturedPayload, false)
  assert.strictEqual('lowCarbonApplied' in disabled.page.data.recommendationResult, false)
  assert.strictEqual(disabled.page.data.lowCarbonReason, '')

  const enabled = await submitAndCapture({
    code: 200,
    data: {
      enabled: true,
      signals: [{ clothingId: 'A', wearCount: 1, unusedDays: 40 }]
    }
  })
  assert.strictEqual(enabled.capturedPayload.lowCarbonPriority, true)
  assert.strictEqual(enabled.capturedPayload.lowCarbonSignals.length, 1)
  assert.strictEqual(
    enabled.page.data.lowCarbonReason,
    '优先考虑了较少使用的合适衣物'
  )

  lowCarbonService.getRecommendationSignals = async () => {
    throw new Error('mock failure')
  }
  const failurePage = createPage()
  let fallbackPayload
  failurePage.requestRecommendationWithFallback = async payload => {
    fallbackPayload = payload
    return { selectedClothesIds: [], replyText: '原推荐继续执行' }
  }
  await failurePage.submitRecommendationRequest()
  await flushPromises()
  assert.strictEqual('lowCarbonPriority' in fallbackPayload, false)
  assert.strictEqual(failurePage.data.isRecommendationLoading, false)

  console.log('daily-low-carbon.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
