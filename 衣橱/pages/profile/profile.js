const app = getApp() 

Page({
  data: {
    userInfo: {
      name: '点击登录获取真数据',
      desc: '尚未连接后端',
      avatar: '' 
    },
    baseUrl: '', 
    hasUserInfo: false
  },

  onLoad() {
    console.log('我的页面加载')
    this.setData({ baseUrl: app.globalData.baseUrl }) 
    this.testBackendConnection()
  },

  onShow() {
    console.log('我的页面显示')
  },

  // 1. 登录连接后端
  testBackendConnection() {
    const that = this
    wx.showLoading({ title: '连接后端中...' })

    wx.request({
      url: app.globalData.baseUrl + '/api/user/login', 
      method: 'POST',
      data: {
        openid: "wx_real_test_001", 
        nickname: "前端联调测试员"  
      },
      success: (res) => {
        wx.hideLoading()
        console.log("🎉 后端握手成功！", res.data)
        
        app.globalData.currentUserId = res.data.id

        that.setData({
          userInfo: {
            name: res.data.nickname,
            desc: `已连接数据库 (您的专属ID: ${res.data.id})`,
            // 如果后端本来就有头像，顺便拉下来
            avatar: res.data.avatar_url || ''
          },
          hasUserInfo: true
        })
      },
      fail: (err) => {
        wx.hideLoading()
        console.error("❌ 请求后端失败:", err)
      }
    })
  },

  // 2. 更换头像逻辑
  changeAvatar() {
    const that = this
    
    if (!app.globalData.currentUserId) {
      wx.showToast({ title: '请等待连接后端', icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: 1, 
      mediaType: ['image'],
      success(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '正在上传...' })

        wx.uploadFile({
          url: app.globalData.baseUrl + '/api/user/avatar',
          filePath: tempFilePath,
          name: 'file', 
          formData: {
            'user_id': app.globalData.currentUserId
          },
          success(uploadRes) {
            wx.hideLoading()
            const data = JSON.parse(uploadRes.data)
            console.log("头像上传成功：", data)

            that.setData({
              'userInfo.avatar': data.avatar_url
            })
            wx.showToast({ title: '更换成功！', icon: 'success' })
          },
          fail(err) {
            wx.hideLoading()
            console.error("上传失败：", err)
            wx.showToast({ title: '上传失败', icon: 'error' })
          }
        })
      }
    })
  },

  // ==========================================
  // 下面是页面跳转逻辑 (注意函数之间的逗号！)
  // ==========================================

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
    console.log('点击名字区域，准备跳转到个人信息设置页面')
    wx.navigateTo({
      url: '/pages/profileSettings/profileSettings',
      success: () => { console.log('跳转成功') },
      fail: (err) => {
        console.error('跳转失败:', err)
        wx.showToast({ title: '页面暂未开发', icon: 'none' })
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