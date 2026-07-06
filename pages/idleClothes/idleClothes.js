const lowCarbonService = require('../../services/lowCarbonService')

Page({
  data: {
    loading: false,
    errorMessage: '',
    clothes: [],
    count: 0
  },

  onShow() {
    return this.loadIdleClothes()
  },

  async loadIdleClothes() {
    if (this.data.loading) return
    this.setData({ loading: true, errorMessage: '' })
    try {
      const result = await lowCarbonService.getIdleClothes()
      if (!result || result.code !== 200 || !result.data) {
        throw new Error(result && result.message ? result.message : '加载闲置衣物失败')
      }
      this.setData({
        loading: false,
        count: Number(result.data.count) || 0,
        clothes: Array.isArray(result.data.clothes)
          ? result.data.clothes.map(item => ({ ...item, imageFailed: false }))
          : []
      })
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error && error.message ? error.message : '加载闲置衣物失败'
      })
    }
  },

  retryLoad() {
    this.loadIdleClothes()
  },

  onImageError(event) {
    const id = event.currentTarget.dataset.id
    this.setData({
      clothes: this.data.clothes.map(item => (
        item._id === id ? { ...item, imageFailed: true } : item
      ))
    })
  },

  openClothesDetail(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: `/pages/clothesDetail/clothesDetail?id=${encodeURIComponent(id)}`
    })
  }
})
