App({
  globalData: {
    userInfo: null,
    systemInfo: null,
    
    // 👇 新增：你的 FastAPI 后端局域网地址 (务必确保你的电脑和运行小程序的手机/电脑连在同一个 Wi-Fi 下)
    baseUrl: "http://127.0.0.1:8000",
    
    // 👇 新增：用来全局存储当前登录用户的 ID。
    // 比如登录成功后存为 1，之后他传衣服、看衣橱时，直接从这里拿 ID 传给后端
    currentUserId: null 
  },

  onLaunch() {
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