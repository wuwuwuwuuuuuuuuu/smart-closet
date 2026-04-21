const { logWarning } = require('../../utils/logger')

Page({
  data: {
    currentBackground: 'https://picsum.photos/750/1334?random=44',
    showBackgroundModal: false,
    tryonType: null,
    tryonImage: null,
    backgroundOptions: [
      { id: 1, name: '场景1', image: 'https://picsum.photos/200/200?random=13' },
      { id: 2, name: '场景2', image: 'https://picsum.photos/200/200?random=14' },
      { id: 3, name: '场景3', image: 'https://picsum.photos/200/200?random=18' },
      { id: 4, name: '场景4', image: 'https://picsum.photos/200/200?random=19' }
    ]
  },

  onLoad(options) {
    console.log('预览页加载', options)

    const imageParam = options.productImage || options.aiImage || options.img || ''
    if (!imageParam) {
      logWarning('preview.onLoad', 'missing preview image param')
      return
    }

    this.setData({
      tryonType: options.productImage ? 'product' : 'ai',
      tryonImage: decodeURIComponent(imageParam)
    })
  },

  onShow() {
    console.log('预览页显示')
  },

  goBack() {
    wx.navigateBack()
  },

  showBackgroundOptions() {
    this.setData({
      showBackgroundModal: true
    })
  },

  hideBackgroundModal() {
    this.setData({
      showBackgroundModal: false
    })
  },

  selectBackground(e) {
    const background = e.currentTarget.dataset.background
    this.setData({
      currentBackground: background
    })
  },

  chooseLocalBackground() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: res => {
        this.setData({
          currentBackground: res.tempFilePaths[0]
        })
        wx.showToast({
          title: '背景设置成功',
          icon: 'success'
        })
      },
      fail: err => {
        console.error('选择背景失败:', err)
        wx.showToast({
          title: '选择背景失败',
          icon: 'none'
        })
      }
    })
  },

  confirmBackground() {
    this.hideBackgroundModal()
    wx.showToast({
      title: '背景已更新',
      icon: 'success'
    })
  },

  generatePoster() {
    wx.navigateTo({
      url: '/pages/poster/poster'
    })
  }
})
