// 我的形象页面逻辑
Page({
  data: {
    avatarImage: '',
    canCreate: false
  },

  onLoad() {
    console.log('我的形象页加载')
  },

  onShow() {
    console.log('我的形象页显示')
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 选择图片
  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        this.setData({
          avatarImage: res.tempFilePaths[0],
          canCreate: true
        })
      },
      fail: (err) => {
        console.error('选择图片失败:', err)
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  },

  // 创建形象
  createAvatar() {
    const { canCreate, avatarImage } = this.data
    
    if (!canCreate) {
      wx.showToast({
        title: '请先上传全身照',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '创建中...'
    })

    // 模拟创建过程
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '形象创建成功',
        icon: 'success'
      })

      // 返回我的页面
      setTimeout(() => {
        wx.navigateBack()
      }, 1000)
    }, 1500)
  }
})