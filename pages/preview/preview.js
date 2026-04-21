// 试穿预览页逻辑
Page({
  data: {
    currentBackground: 'https://picsum.photos/750/1334?random=44',
    showBackgroundModal: false,
    tryonType: null, // 'product' 或 'ai'
    tryonImage: null, // 试穿后的照片
    backgroundOptions: [
      { id: 1, name: '场景1', image: 'https://picsum.photos/200/200?random=13' },
      { id: 2, name: '场景2', image: 'https://picsum.photos/200/200?random=14' },
      { id: 3, name: '场景3', image: 'https://picsum.photos/200/200?random=18' },
      { id: 4, name: '场景4', image: 'https://picsum.photos/200/200?random=19' }
    ]
  },

  onLoad(options) {
    const normalizedImage = options.aiImage || options.productImage || options.img || ''
    if (normalizedImage) {
      this.setData({
        tryonType: options.productImage ? 'product' : 'ai',
        tryonImage: decodeURIComponent(normalizedImage)
      })
    }
  },

  onShow() {},

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 显示背景选项
  showBackgroundOptions() {
    this.setData({
      showBackgroundModal: true
    })
  },

  // 隐藏背景弹窗
  hideBackgroundModal() {
    this.setData({
      showBackgroundModal: false
    })
  },

  // 选择背景
  selectBackground(e) {
    const background = e.currentTarget.dataset.background
    this.setData({
      currentBackground: background
    })
  },

  // 导入本地背景
  chooseLocalBackground() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        this.setData({
          currentBackground: res.tempFilePaths[0]
        })
        wx.showToast({
          title: '背景设置成功',
          icon: 'success'
        })
      },
      fail: () => {
        wx.showToast({
          title: '选择背景失败',
          icon: 'none'
        })
      }
    })
  },

  // 确认背景选择
  confirmBackground() {
    this.hideBackgroundModal()
    wx.showToast({
      title: '背景已更新',
      icon: 'success'
    })
  },

  // 生成海报
  generatePoster() {
    wx.navigateTo({
      url: '/pages/poster/poster'
    })
  }
})
