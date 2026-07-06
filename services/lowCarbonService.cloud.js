function unavailable() {
  return Promise.resolve({
    code: 501,
    message: '闲置预警云服务尚未启用',
    data: {
      reason: 'LOW_CARBON_CLOUD_SERVICE_DISABLED'
    }
  })
}

module.exports = {
  getLowCarbonSummary: unavailable,
  getIdleClothes: unavailable,
  getLowCarbonPriority: unavailable,
  updateLowCarbonPriority: unavailable,
  getRecommendationSignals: unavailable
}
