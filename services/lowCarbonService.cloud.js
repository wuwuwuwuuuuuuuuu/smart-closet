function callLowCarbonFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success(res) {
        const result = res && res.result
        if (!result || typeof result !== 'object') {
          reject(new Error('云函数返回格式异常'))
          return
        }
        resolve({
          code: Number(result.code) || 500,
          message: result.message || '云函数调用失败',
          data: result.data || {}
        })
      },
      fail(error) {
        reject(new Error(
          error && error.errMsg
            ? `云函数调用失败：${error.errMsg}`
            : '云函数调用失败，请稍后重试'
        ))
      }
    })
  })
}

module.exports = {
  getLowCarbonSummary() {
    return callLowCarbonFunction('getLowCarbonSummary')
  },
  getIdleClothes() {
    return callLowCarbonFunction('getIdleClothes')
  },
  getLowCarbonPriority() {
    return callLowCarbonFunction('getLowCarbonPriority')
  },
  updateLowCarbonPriority(input) {
    const enabled = typeof input === 'boolean'
      ? input
      : input && input.enabled
    return callLowCarbonFunction('updateLowCarbonPriority', { enabled })
  },
  getRecommendationSignals() {
    return callLowCarbonFunction('getRecommendationSignals')
  },
  callLowCarbonFunction
}
