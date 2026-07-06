const USE_MOCK_LOW_CARBON = true

const implementation = USE_MOCK_LOW_CARBON
  ? require('./lowCarbonService.mock')
  : require('./lowCarbonService.cloud')

module.exports = {
  getLowCarbonSummary: implementation.getLowCarbonSummary,
  getIdleClothes: implementation.getIdleClothes,
  getLowCarbonPriority: implementation.getLowCarbonPriority,
  updateLowCarbonPriority: implementation.updateLowCarbonPriority,
  getRecommendationSignals: implementation.getRecommendationSignals
}
