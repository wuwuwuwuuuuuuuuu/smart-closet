const outfitService = require('../../services/outfitService')
const {
  previewOutfitImage,
  saveOutfitImageToAlbum
} = require('../../utils/outfitImage')
const {
  getLocalDateKey,
  isWithinRecent10Days,
  formatDateKey,
  formatShortDateKey
} = require('../../utils/outfitDate')
const {
  openTryonWithClothingIds,
  uniqueClothingIds
} = require('../../utils/tryonSelectionEntry')

Page({
  data: {
    loading: false,
    errorMessage: '',
    selectedDate: '',
    selectedDateLabel: '',
    records: [],
    availableDates: [],
    dateShortLabels: {},
    isToday: true,
    todayDateKey: '',
    savingId: ''
  },

  onLoad() {
    const todayDateKey = getLocalDateKey()
    this.setData({
      selectedDate: todayDateKey,
      selectedDateLabel: formatDateKey(todayDateKey),
      todayDateKey,
      isToday: true
    })
  },

  onShow() {
    return this.loadHistory(this.data.selectedDate || getLocalDateKey())
  },

  async loadHistory(dateKey) {
    const selectedDate = dateKey || getLocalDateKey()
    this.setData({ loading: true, errorMessage: '' })
    try {
      const result = await outfitService.getOutfitHistory({ dateKey: selectedDate })
      if (!result || result.code !== 200 || !result.data) {
        throw new Error(result && result.message ? result.message : '加载历史穿搭失败')
      }
      const todayDateKey = getLocalDateKey()
      const records = Array.isArray(result.data.records) ? result.data.records : []
      const availableDates = Array.isArray(result.data.availableDates)
        ? result.data.availableDates
        : []
      const dateShortLabels = availableDates.reduce((labels, key) => {
        labels[key] = formatShortDateKey(key)
        return labels
      }, {})

      this.setData({
        loading: false,
        selectedDate: result.data.selectedDate || selectedDate,
        selectedDateLabel: formatDateKey(result.data.selectedDate || selectedDate),
        records,
        availableDates,
        dateShortLabels,
        todayDateKey,
        isToday: (result.data.selectedDate || selectedDate) === todayDateKey
      })
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error && error.message ? error.message : '加载历史穿搭失败'
      })
    }
  },

  retryLoad() {
    this.loadHistory(this.data.selectedDate)
  },

  onDateChange(event) {
    const selectedDate = event.detail.value
    if (!selectedDate || selectedDate > this.data.todayDateKey) {
      wx.showToast({ title: '不能选择未来日期', icon: 'none' })
      return
    }
    this.loadHistory(selectedDate)
  },

  selectAvailableDate(event) {
    const dateKey = event.currentTarget.dataset.date
    if (dateKey) this.loadHistory(dateKey)
  },

  isRecentRecord(record) {
    return Boolean(
      record
      && record.detailsExpired !== true
      && isWithinRecent10Days(record.dateKey, this.data.todayDateKey)
    )
  },

  async onOutfitImageTap(event) {
    const record = event.currentTarget.dataset.record
    const clothingIds = uniqueClothingIds(record && record.clothingIds)
    if (this.isRecentRecord(record) && clothingIds.length > 0) {
      try {
        openTryonWithClothingIds({
          clothingIds,
          source: 'outfitHistory'
        })
      } catch (error) {
        wx.showToast({ title: '无法打开AI试穿页，请稍后重试', icon: 'none' })
      }
      return
    }

    try {
      await previewOutfitImage(record && record.outfitImageFileID)
    } catch (error) {
      wx.showToast({ title: error.message || '图片预览失败', icon: 'none' })
    }
  },

  async saveImage(event) {
    const record = event.currentTarget.dataset.record
    if (!record || this.data.savingId) return
    this.setData({ savingId: record._id })
    wx.showLoading({ title: '正在保存...', mask: true })
    try {
      await saveOutfitImageToAlbum(record.outfitImageFileID)
      wx.showToast({ title: '图片已保存', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '保存图片失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ savingId: '' })
    }
  },

  goToTryOn() {
    wx.switchTab({ url: '/pages/tryon/tryon' })
  }
})
