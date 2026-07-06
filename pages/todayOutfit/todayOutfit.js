const outfitService = require('../../services/outfitService')
const {
  previewOutfitImage,
  saveOutfitImageToAlbum
} = require('../../utils/outfitImage')
const {
  openTryonWithClothingIds,
  uniqueClothingIds
} = require('../../utils/tryonSelectionEntry')

Page({
  data: {
    loading: false,
    errorMessage: '',
    outfits: [],
    count: 0,
    remaining: 3,
    dateKey: '',
    deletingId: '',
    savingId: ''
  },

  onShow() {
    return this.loadTodayOutfits()
  },

  async loadTodayOutfits() {
    this.setData({
      loading: true,
      errorMessage: ''
    })

    try {
      const result = await outfitService.getTodayOutfits()
      if (!result || result.code !== 200) {
        throw new Error(result && result.message ? result.message : '加载今日穿搭失败')
      }

      const data = result.data || {}
      this.setData({
        outfits: Array.isArray(data.outfits) ? data.outfits : [],
        count: Number(data.count) || 0,
        remaining: Number.isFinite(data.remaining) ? data.remaining : 3,
        dateKey: data.dateKey || '',
        loading: false
      })
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '加载今日穿搭失败'
      })
    }
  },

  retryLoad() {
    this.loadTodayOutfits()
  },

  goToTryOn() {
    wx.switchTab({
      url: '/pages/tryon/tryon',
      fail: () => {
        wx.showToast({ title: '无法打开AI试穿页', icon: 'none' })
      }
    })
  },

  async onOutfitImageTap(event) {
    const outfit = event.currentTarget.dataset.outfit
    const clothingIds = uniqueClothingIds(outfit && outfit.clothingIds)
    if (clothingIds.length > 0) {
      try {
        openTryonWithClothingIds({
          clothingIds,
          source: 'todayOutfit'
        })
      } catch (error) {
        wx.showToast({ title: '无法打开AI试穿页，请稍后重试', icon: 'none' })
      }
      return
    }

    try {
      await previewOutfitImage(outfit && outfit.outfitImageFileID)
    } catch (error) {
      wx.showToast({ title: error.message || '图片预览失败', icon: 'none' })
    }
  },

  async saveImage(event) {
    const outfit = event.currentTarget.dataset.outfit
    if (!outfit || this.data.savingId) return

    this.setData({ savingId: outfit._id })
    wx.showLoading({ title: '正在保存...', mask: true })
    try {
      await saveOutfitImageToAlbum(outfit.outfitImageFileID)
      wx.showToast({ title: '图片已保存', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '保存图片失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ savingId: '' })
    }
  },

  deleteOutfit(event) {
    const outfit = event.currentTarget.dataset.outfit
    if (!outfit || this.data.deletingId) return

    wx.showModal({
      title: '确认删除这套今日穿搭吗？',
      content: '删除后，该位置可以重新保存新的穿搭。',
      confirmText: '确认删除',
      cancelText: '取消',
      success: async result => {
        if (!result.confirm) return
        this.performDeleteOutfit(outfit)
      }
    })
  },

  async performDeleteOutfit(outfit) {
    if (!outfit || this.data.deletingId) return
    this.setData({ deletingId: outfit._id })
    try {
      const response = await outfitService.deleteTodayOutfit(outfit._id)
      if (!response || response.code !== 200) {
        throw new Error(response && response.message ? response.message : '删除失败')
      }
      wx.showToast({ title: '删除成功', icon: 'success' })
      await this.loadTodayOutfits()
    } catch (error) {
      wx.showToast({ title: error.message || '删除失败', icon: 'none' })
    } finally {
      this.setData({ deletingId: '' })
    }
  },

  goToOutfitHistory() {
    wx.navigateTo({
      url: '/pages/outfitHistory/outfitHistory'
    })
  }
})
