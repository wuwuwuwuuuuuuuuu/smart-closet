App({
  globalData: {
    userInfo: null,
    systemInfo: null
  },

  onLaunch() {
    console.log('App Launch')
    
    // 👇 核心修复：在这里启动云开发引擎！
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloudbase-2gvrvh4ve926f3d8', 
        traceUser: true, // 记录用户访问
      })
      console.log('☁️ 微信云开发引擎点火成功！')
    }

    this.getSystemInfo()
  },

  getSystemInfo() {
    const that = this
    wx.getSystemInfo({
      success(res) {
        that.globalData.systemInfo = res
      }
    })
  },

  onShow() {
    console.log('App Show')
  },

  onHide() {
    console.log('App Hide')
  }
})