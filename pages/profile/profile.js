const app = getApp()
const db = wx.cloud.database() // 🌟 引入数据库，用于实时获取最新头像和背景

Page({
  data: {
    userInfo: {
      name: '加载中...',
      desc: '正在连接云端...',
      avatar: '',
      bgImage: '' // 🌟 新增：用于存放背景图链接
    },
    hasUserInfo: false
  },

  onLoad() {
    console.log('我的页面初次加载')
    // 第一次进来时，执行静默登录，拿取全局 ID
    this.cloudLogin()
  },

  // 🌟 核心修复：每次从“设置”页面回来，都会触发 onShow，拉取最新头像和背景
  onShow() {
    console.log('我的页面重新显示')
    // 如果全局已经有 userId，说明登录过了，直接去数据库拿最新资料
    if (app.globalData.currentUserId) {
      this.fetchRealUserProfile()
    }
  },

  // ☁️ 登录函数
  cloudLogin() {
    const that = this
    // wx.showLoading({ title: '安全登录中...' }) // 去掉 loading，避免每次回退页面都闪烁

    wx.cloud.callFunction({
      name: 'login',
      // 🌟 破案核心：直接传空数据！绝不把灰色的假头像传给云端去覆盖你的真头像！
      data: {}, 
      success: (res) => {
        console.log('🎉 云端登录成功:', res.result)
        if (res.result.code === 200) {
          // 拿到真实的全局 ID 并存起来 (兼容 id 或 _id 字段)
          app.globalData.currentUserId = res.result.data.userInfo._id || res.result.data.userInfo.id
          
          // 🌟 登录成功后，立刻去查真实的头像、昵称和背景图！
          that.fetchRealUserProfile()
        }
      },
      fail: (err) => {
        console.error('❌ 登录失败:', err)
        wx.showToast({ title: '连接云端失败', icon: 'error' })
      }
    })
  },

  // ☁️ 直接从数据库拉取真实用户信息
  async fetchRealUserProfile() {
    if (!app.globalData.currentUserId) return;
    
    try {
      const res = await db.collection('users').doc(app.globalData.currentUserId).get()
      const userData = res.data
      
      // 更新页面显示
      this.setData({
        userInfo: {
          name: userData.nickname || '衣橱新主人',
          desc: `云端 ID: ${app.globalData.currentUserId.substring(0, 8)}...`,
          // 如果数据库有真实头像就用真实的，没有就用默认灰头像
          avatar: userData.avatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
          // 🌟 顺带把云端保存的背景图也拉下来
          bgImage: userData.bgImage || '' 
        },
        hasUserInfo: true
      })
    } catch (err) {
      console.error('获取最新资料失败:', err)
    }
  },

  // 🌟 核心新增：点击背景图更换封面，并保存到云端数据库
  changeBackground() {
    const userId = app.globalData.currentUserId
    if (!userId) return wx.showToast({ title: '请先登录', icon: 'none' })

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: async (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '上传背景中...', mask: true })

        try {
          // 1. 上传到云存储
          const cloudPath = `user_bg/bg_${userId}_${Date.now()}.png`
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: tempPath
          })
          const bgFileID = uploadRes.fileID

          // 2. 更新到用户的数据库记录中
          await db.collection('users').doc(userId).update({
            data: { bgImage: bgFileID }
          })

          wx.hideLoading()
          wx.showToast({ title: '背景更新成功', icon: 'success' })
          
          // 3. 局部刷新页面数据，瞬间替换背景
          this.setData({
            'userInfo.bgImage': bgFileID
          })

        } catch (err) {
          wx.hideLoading()
          console.error('上传背景失败:', err)
          wx.showToast({ title: '上传失败', icon: 'error' })
        }
      }
    })
  },

  // ================= 下面是你原有的跳转函数 =================
  goToCollection() { wx.navigateTo({ url: '/pages/collection/collection' }) },
  goToAvatar() { wx.navigateTo({ url: '/pages/avatar/avatar' }) },
  goToWardrobe() { wx.navigateTo({ url: '/pages/wardrobe/wardrobe' }) },
  goToMyPosts() { wx.navigateTo({ url: '/pages/myPosts/myPosts' }) },
  goToHistory() { wx.navigateTo({ url: '/pages/history/history' }) },

  goToProfileSettings() {
    console.log('点击头像，跳转到个人信息设置页面')
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