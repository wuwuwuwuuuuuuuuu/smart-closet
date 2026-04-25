App({
  globalData: {
    userInfo: null,
    systemInfo: null,
    currentUserId: null,  // 用来存放云数据库里 users 表的真实 ID
    currentUserInfo: null // 🌟 存放从数据库拉出来的真实用户档案（包含昵称、头像等）
  },

  onLaunch() {
    console.log('App Launch')
    
    // ☁️ 云开发引擎初始化
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        // 你的云开发环境 ID
        env: 'cloudbase-2gvrvh4ve926f3d8', 
        traceUser: true,
      })
      console.log('☁️ 微信云开发引擎点火成功！')
    }

    this.getSystemInfo()
    
    // 🌟 小程序启动时，自动呼叫后端云函数进行静默登录/注册
    this.fetchUserArchive()
  },

  // 🌟 核心升级：接入终极版 login 云函数，实现无感精准登录
  async fetchUserArchive() {
    if (!wx.cloud) return
    
    try {
      // 呼叫你的 login 云函数，拿到 100% 准确的真实身份和档案
      const res = await wx.cloud.callFunction({ name: 'login' })
      const result = res.result

      // 判断云函数是否成功返回了 200 (不管是老用户登录还是新用户注册)
      if (result && result.code === 200) {
        const userInfo = result.data.userInfo
        
        // 挂载到全局变量，全小程序各个页面都能直接读取
        this.globalData.currentUserInfo = userInfo
        // 兼容你原来的 _id 和 云函数返回的 id
        this.globalData.currentUserId = userInfo.id || userInfo._id 
        
        console.log(`✅ ${result.message}! 当前用户:`, this.globalData.currentUserInfo.nickname || '未命名')
      } else {
        console.error('⚠️ 登录接口返回异常:', result)
      }
    } catch (error) {
      console.error('❌ 身份识别流程崩溃:', error)
    }
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