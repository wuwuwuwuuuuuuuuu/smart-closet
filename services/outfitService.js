const USE_MOCK_OUTFIT = true

const implementation = USE_MOCK_OUTFIT
  ? require('./outfitService.mock')
  : require('./outfitService.cloud')

module.exports = {
  isUsingMock: () => USE_MOCK_OUTFIT,
  getTodayOutfits: implementation.getTodayOutfits,
  getOutfitHistory: implementation.getOutfitHistory,
  saveOutfitRecord: implementation.saveOutfitRecord,
  deleteTodayOutfit: implementation.deleteTodayOutfit
}
