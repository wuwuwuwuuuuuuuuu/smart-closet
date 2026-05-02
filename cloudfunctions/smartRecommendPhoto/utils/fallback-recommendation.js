function normalizeInput(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildCloudFallbackRecommendation(event = {}, wardrobePhotos = []) {
  const safeWardrobePhotos = Array.isArray(wardrobePhotos) ? wardrobePhotos : []
  const pickedItems = safeWardrobePhotos.slice(0, 3)
  const weatherSuggestion = normalizeInput(event.weatherSuggestion)

  return {
    requestId: normalizeInput(event.requestId) || `cloud_${Date.now()}`,
    summary: '智能推荐已生成',
    replyText: '已接收到你的需求，当前先返回云端结构化占位结果，后续将接入正式多模态推荐。',
    outfitLines: pickedItems.map(item => {
      const category = normalizeInput(item.category) || '单品'
      const name = normalizeInput(item.name) || item.clothesId
      return `${category}：${name}`
    }),
    tips: weatherSuggestion ? [weatherSuggestion] : [],
    selectedClothesIds: pickedItems.map(item => item.clothesId),
    selectedPhotoUrls: pickedItems.map(item => item.photoUrl),
    wardrobeAnalysisSummary: `已提取 ${safeWardrobePhotos.length} 件可分析衣物图片。`,
    ctaLabel: '去试穿页继续搭配',
    source: 'cloud-fallback'
  }
}

module.exports = {
  buildCloudFallbackRecommendation,
  normalizeInput
}
