const assert = require('assert')

global.wx = {
  cloud: {
    calls: [],
    callFunction(options) {
      this.calls.push({ name: options.name, data: options.data })
      if (options.name === 'broken') {
        options.fail({ errMsg: 'fail mock' })
        return
      }
      options.success({
        result: {
          code: options.name === 'updateLowCarbonPriority' ? 200 : 200,
          message: 'ok',
          data: { lowCarbonPriority: options.data && options.data.enabled }
        }
      })
    }
  }
}

delete require.cache[require.resolve('../../services/lowCarbonService.cloud')]
const service = require('../../services/lowCarbonService.cloud')

async function run() {
  const summary = await service.getLowCarbonSummary()
  assert.strictEqual(summary.code, 200)
  assert.deepStrictEqual(wx.cloud.calls[0], { name: 'getLowCarbonSummary', data: {} })

  await service.getIdleClothes()
  await service.getLowCarbonPriority()
  await service.updateLowCarbonPriority({ enabled: true })
  await service.getRecommendationSignals()

  assert.deepStrictEqual(wx.cloud.calls.map(item => item.name), [
    'getLowCarbonSummary',
    'getIdleClothes',
    'getLowCarbonPriority',
    'updateLowCarbonPriority',
    'getRecommendationSignals'
  ])
  assert.deepStrictEqual(wx.cloud.calls[3].data, { enabled: true })

  await service.updateLowCarbonPriority(false)
  assert.deepStrictEqual(wx.cloud.calls[5].data, { enabled: false })

  console.log('low-carbon-cloud-service.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
