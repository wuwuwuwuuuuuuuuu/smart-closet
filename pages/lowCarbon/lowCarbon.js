const lowCarbonService = require('../../services/lowCarbonService')

Page({
  data: {
    loading: false,
    errorMessage: '',
    totalClothes: 0,
    activeClothes: 0,
    activityRate: 0,
    idleCount: 0,
    suggestions: [],
    lowCarbonPriority: false,
    updatingPriority: false
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
      const [result, priorityResult] = await Promise.all([
        lowCarbonService.getLowCarbonSummary(),
        lowCarbonService.getLowCarbonPriority()
      ])
      if (!result || result.code !== 200 || !result.data) {
        throw new Error(result && result.message ? result.message : '数据加载失败')
      }
      const data = result.data
      this.setData({
        loading: false,
        totalClothes: Number(data.totalClothes) || 0,
        activeClothes: Number(data.activeClothes) || 0,
        activityRate: Number(data.activityRate) || 0,
        idleCount: Number(data.idleCount) || 0,
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        lowCarbonPriority: Boolean(
          priorityResult
          && priorityResult.code === 200
          && priorityResult.data
          && priorityResult.data.lowCarbonPriority === true
        )
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
  },

  async onPriorityChange(event) {
    if (this.data.updatingPriority) return
    const previousValue = this.data.lowCarbonPriority
    const enabled = event.detail.value === true
    this.setData({
      lowCarbonPriority: enabled,
      updatingPriority: true
    })
    try {
      const result = await lowCarbonService.updateLowCarbonPriority({ enabled })
      if (!result || result.code !== 200 || !result.data) {
        throw new Error(result && result.message ? result.message : '设置更新失败')
      }
      this.setData({
        lowCarbonPriority: result.data.lowCarbonPriority === true
      })
    } catch (error) {
      this.setData({ lowCarbonPriority: previousValue })
      wx.showToast({
        title: error && error.message ? error.message : '设置更新失败',
        icon: 'none'
      })
    } finally {
      this.setData({ updatingPriority: false })
    }
  }
})
