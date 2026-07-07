const assert = require('assert')

let pageConfig
global.Page = config => {
  pageConfig = config
}
global.wx = {
  showToast() {}
}

require('../../pages/daily/daily')

function createPage() {
  const page = {
    ...pageConfig,
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(nextData) {
      Object.assign(this.data, nextData)
    }
  }
  page.data.pendingUserInput = 'summer commute'
  page.data.currentCity = 'test city'
  page.data.currentDateLabel = 'today'
  page.data.weatherSuggestion = 'hot'
  page.data.weatherInfo = { temp: 30, text: 'sunny', icon: 'sun' }
  return page
}

function flushPromises() {
  return new Promise(resolve => setImmediate(resolve))
}

async function submitAndCapture(result = {}) {
  const page = createPage()
  let capturedPayload
  page.requestRecommendationWithFallback = async payload => {
    capturedPayload = payload
    return {
      requestId: 'result-1',
      summary: 'recommendation',
      replyText: 'recommendation result',
      selectedClothesIds: ['A'],
      ...result
    }
  }
  await page.submitRecommendationRequest()
  await flushPromises()
  return { page, capturedPayload }
}

async function run() {
  const base = await submitAndCapture()
  assert.strictEqual('lowCarbonPriority' in base.capturedPayload, false)
  assert.strictEqual('lowCarbonSignals' in base.capturedPayload, false)
  assert.strictEqual('lowCarbonApplied' in base.page.data.recommendationResult, false)
  assert.strictEqual(base.page.data.lowCarbonReason, '')

  const trustedReason = await submitAndCapture({
    lowCarbonApplied: true,
    lowCarbonReason: 'trusted server low carbon reason'
  })
  assert.strictEqual('lowCarbonPriority' in trustedReason.capturedPayload, false)
  assert.strictEqual('lowCarbonSignals' in trustedReason.capturedPayload, false)
  assert.strictEqual(
    trustedReason.page.data.lowCarbonReason,
    'trusted server low carbon reason'
  )

  const failurePage = createPage()
  let fallbackPayload
  failurePage.requestRecommendationWithFallback = async payload => {
    fallbackPayload = payload
    throw new Error('recommend failed')
  }
  await failurePage.submitRecommendationRequest()
  await flushPromises()
  assert.strictEqual('lowCarbonPriority' in fallbackPayload, false)
  assert.strictEqual('lowCarbonSignals' in fallbackPayload, false)
  assert.strictEqual(failurePage.data.isRecommendationLoading, false)

  console.log('daily-low-carbon.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
