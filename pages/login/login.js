const app = getApp()

Page({
  data: {
    isLoggingIn: false
  },

  onLoad() {
    console.log('欢迎来到登录页')
  },

  // 🌟 点击按钮触发一键登录
  handleLogin() {
    if (this.data.isLoggingIn) return // 防止连点
    this.setData({ isLoggingIn: true })

    wx.showLoading({ title: '安全连接中...', mask: true })

    // 调用咱们之前修好的完美版 login 云函数
    wx.cloud.callFunction({
      name: 'login',
      data: {}, 
      success: (res) => {
        wx.hideLoading()
        this.setData({ isLoggingIn: false })
        
        console.log('🎉 登录成功:', res.result)
        
        if (res.result.code === 200) {
          // 1. 将拿到的真实用户 ID 存入全局变量
          app.globalData.currentUserId = res.result.data.userInfo._id || res.result.data.userInfo.id
          
          wx.showToast({
            title: '登录成功',
            icon: 'success',
            duration: 1500,
            success: () => {
              // 2. 延迟跳转到主页面 
              // 🌟 核心修改：目标改成主界面，且因为是底部 Tab 页，必须使用 wx.switchTab
              setTimeout(() => {
                wx.switchTab({
                  url: '/pages/home/home' 
                })
              }, 1500)
            }
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        this.setData({ isLoggingIn: false })
        console.error('❌ 登录失败:', err)
        wx.showToast({ title: '网络开小差了', icon: 'error' })
      }
    })
  }
})