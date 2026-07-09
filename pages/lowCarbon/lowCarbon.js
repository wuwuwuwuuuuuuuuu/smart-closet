const lowCarbonService = require('../../services/lowCarbonService')

Page({
  data: {
    loading: false,
    errorMessage: '',
    totalClothes: 0,
    activeClothes: 0,
    activityRate: 0,
    activityRateStyle: 'width: 0%;',
    idleCount: 0,
    suggestions: []
  },

  onLoad() {
    this.skipFirstOnShowLoad = true
    this.loadSummary()
  },

  onShow() {
    if (this.skipFirstOnShowLoad) {
      this.skipFirstOnShowLoad = false
      return
    }
    return this.loadSummary()
  },

  async loadSummary() {
    if (this.data.loading) return
    this.setData({ loading: true, errorMessage: '' })
    try {
      const result = await lowCarbonService.getLowCarbonSummary()
      if (!result || result.code !== 200 || !result.data) {
        throw new Error(result && result.message ? result.message : '数据加载失败')
      }
      const data = result.data
      const activityRate = Number(data.activityRate) || 0
      const safeActivityRate = Math.max(0, Math.min(100, activityRate))

      this.setData({
        loading: false,
        totalClothes: Number(data.totalClothes) || 0,
        activeClothes: Number(data.activeClothes) || 0,
        activityRate,
        activityRateStyle: `width: ${safeActivityRate}%;`,
        idleCount: Number(data.idleCount) || 0,
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : []
      })
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error && error.message ? error.message : '数据加载失败'
      })
    }
  },

  retryLoad() {
    this.loadSummary()
  },

  goToIdleClothes() {
    wx.navigateTo({ url: '/pages/idleClothes/idleClothes' })
  }
})
