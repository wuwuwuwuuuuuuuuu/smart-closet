App({
  globalData: {
    userInfo: null,
    systemInfo: null,
    currentUserId: null // 🌟 新增：用来存放云数据库里 users 表的真实 _id
  },

  onLaunch() {
    console.log('App Launch')
    
    // ☁️ 云开发引擎初始化
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        // ⚠️ 确认一下：这里的 ID 必须是你自己在云开发控制台看到的那个环境 ID
        env: 'cloudbase-2gvrvh4ve926f3d8', 
        traceUser: true,
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