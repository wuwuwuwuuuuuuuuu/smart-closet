// 我的页面逻辑
Page({
  data: {
    userInfo: {
      name: 'XXX',
      desc: '时尚穿搭爱好者'
    }
  },

  onLoad() {
    console.log('我的页面加载')
  },

  onShow() {
    console.log('我的页面显示')
  },

  goToCollection() {
    wx.navigateTo({ url: '/pages/collection/collection' })
  },

  goToAvatar() {
    wx.navigateTo({ url: '/pages/avatar/avatar' })
  },

  goToWardrobe() {
    wx.navigateTo({ url: '/pages/wardrobe/wardrobe' })
  },

  goToMyPosts() {
    wx.navigateTo({ url: '/pages/myPosts/myPosts' })
  },

  goToHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  goToProfileSettings() {
    console.log('点击头像，准备跳转到个人信息设置页面')
    wx.navigateTo({
      url: '/pages/profileSettings/profileSettings',
      success: () => { console.log('跳转成功') },
      fail: (err) => {
        console.error('跳转失败:', err)
        wx.showToast({ title: '页面跳转失败', icon: 'none' })
      }
    })
  },

  contactUs() {
    wx.showModal({
      title: '联系我们',
      content: '客服电话：400-123-4567\n邮箱：service@wardrobe.com',
      showCancel: false
    })
  },

  goToFeedback() {
    wx.showToast({ title: '意见反馈功能', icon: 'none' })
  }
})