const app = getApp() // 🌟 别忘了获取 app 实例，用于存储全局 ID

Page({
  data: {
    userInfo: {
      name: '加载中...',
      desc: '正在连接云端...',
      avatar: '' 
    },
    hasUserInfo: false
  },

  onLoad() {
    console.log('我的页面加载')
    // 🌟 核心：页面一加载，立马去“敲门”登录
    this.cloudLogin()
  },

  // ☁️ 调用你刚写的 login 云函数
  cloudLogin() {
    const that = this
    wx.showLoading({ title: '安全登录中...' })

    wx.cloud.callFunction({
      name: 'login', // 👈 确保这里和你云函数的文件夹名一致
      data: {
        // 传递一些基础信息给云函数进行注册/更新
        userInfo: {
          nickName: '穿搭达人', 
          avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
          gender: 0
        }
      },
      success: (res) => {
        wx.hideLoading()
        console.log('🎉 云端登录成功:', res.result)
        
        if (res.result.code === 200) {
          const userData = res.result.data.userInfo
          
          // 1. 把 ID 存入全局，这样 addClothing 才能在数据库里找到你
          app.globalData.currentUserId = userData.id
          
          // 2. 更新页面上的文字
          that.setData({
            userInfo: {
              name: userData.nickname,
              desc: `云端 ID: ${userData.id.substring(0, 8)}...`, // 展示前几位 ID 增加专业感
              avatar: userData.avatar
            },
            hasUserInfo: true
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('❌ 登录失败:', err)
        wx.showToast({ title: '连接云端失败', icon: 'error' })
      }
    })
  },


  goToCollection() { wx.navigateTo({ url: '/pages/collection/collection' }) },
  goToAvatar() { wx.navigateTo({ url: '/pages/avatar/avatar' }) },
  goToWardrobe() { wx.navigateTo({ url: '/pages/wardrobe/wardrobe' }) },
  goToMyPosts() { wx.navigateTo({ url: '/pages/myPosts/myPosts' }) },
  goToHistory() { wx.navigateTo({ url: '/pages/history/history' }) },

  goToProfileSettings() {
    console.log('点击头像，准备跳转到个人信息设置页面')
    wx.navigateTo({
      url: '/pages/profileSettings/profileSettings',
      fail: (err) => {
        console.error('跳转失败:', err)
        wx.showToast({ title: '设置页面开发中', icon: 'none' })
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