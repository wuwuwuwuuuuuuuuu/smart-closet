const app = getApp()
const db = wx.cloud.database() // 🌟 获取云数据库引用

Page({
  data: {
    // 用户信息
    avatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
    nickname: '',
    birthday: '',
    gender: '',
    currentDate: '',
    genderRange: ['男', '女'],
    genderIndex: 0,
    
    canSave: false
  },

  onLoad(options) {
    console.log('个人信息设置页面加载')
    // 1. 设置当前日期限制
    const today = new Date()
    const currentDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
    this.setData({ currentDate })

    // 2. 🌟 核心：从云端拉取真实数据
    this.loadUserInfoFromCloud()
  },

  // ☁️ 从云数据库加载用户信息
  async loadUserInfoFromCloud() {
    const userId = app.globalData.currentUserId
    if (!userId) {
      wx.showToast({ title: '未登录', icon: 'none' })
      return
    }

    wx.showLoading({ title: '同步云端数据...' })
    try {
      const res = await db.collection('users').doc(userId).get()
      const user = res.data
      
      // 设置性别索引
      const genderIndex = user.gender === '女' ? 1 : 0
      
      this.setData({
        avatarUrl: user.avatar || this.data.avatarUrl,
        nickname: user.nickname || '',
        birthday: user.birthday || '',
        gender: user.gender || '',
        genderIndex: genderIndex
      })
      this.checkSaveButton()
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      console.error('拉取用户信息失败:', err)
    }
  },

  checkSaveButton() {
    const { nickname } = this.data
    const canSave = !!nickname.trim()
    this.setData({ canSave })
  },

  goBack() { wx.navigateBack() },

  // 📸 更换头像（增加云存储上传逻辑）
  changeAvatar() {
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album']
        wx.chooseMedia({ // 🌟 使用最新的 chooseMedia API
          count: 1,
          mediaType: ['image'],
          sourceType: sourceType,
          success: async (chooseRes) => {
            const tempFilePath = chooseRes.tempFiles[0].tempFilePath
            
            wx.showLoading({ title: '上传中...' })
            // 🌟 核心：将图片上传到云存储
            try {
              const cloudPath = `avatars/${app.globalData.currentUserId}-${Date.now()}.png`
              const uploadRes = await wx.cloud.uploadFile({
                cloudPath: cloudPath,
                filePath: tempFilePath
              })
              
              this.setData({
                avatarUrl: uploadRes.fileID // 存入云文件 ID
              })
              this.checkSaveButton()
              wx.hideLoading()
              wx.showToast({ title: '头像已就绪', icon: 'success' })
            } catch (err) {
              wx.hideLoading()
              wx.showToast({ title: '上传失败', icon: 'none' })
            }
          }
        })
      }
    })
  },

  // 昵称编辑逻辑 (直接输入)
  onNicknameInput(e) { 
    this.setData({ nickname: e.detail.value })
    this.checkSaveButton()
  },
  onNicknameFocus() {
    // 昵称输入框获得焦点时清空原内容
    if (this.data.nickname && this.data.nickname !== '') {
      this.setData({ nickname: '' })
    }
  },
  onNicknameBlur() {
    // 昵称输入框失去焦点时的处理
    this.checkSaveButton()
  },

  // 日期选择逻辑
  onBirthdayChange(e) {
    this.setData({ 
      birthday: e.detail.value
    })
    this.checkSaveButton()
  },

  // 性别选择逻辑
  onGenderChange(e) {
    const index = e.detail.value
    const gender = this.data.genderRange[index]
    this.setData({ 
      gender,
      genderIndex: index
    })
    this.checkSaveButton()
  },

  // 💾 核心改造：保存个人信息到云端数据库
  async saveProfile() {
    if (!this.data.canSave) return
    const userId = app.globalData.currentUserId

    wx.showLoading({ title: '正在保存...' })

    try {
      // 🌟 直接更新云数据库中的用户记录
      await db.collection('users').doc(userId).update({
        data: {
          avatar: this.data.avatarUrl,
          nickname: this.data.nickname,
          birthday: this.data.birthday,
          gender: this.data.gender,
          updated_at: db.serverDate() // 使用服务端时间
        }
      })

      wx.hideLoading()
      wx.showToast({
        title: '云端同步成功',
        icon: 'success',
        duration: 1500,
        success: () => {
          setTimeout(() => { wx.navigateBack() }, 1500)
        }
      })
    } catch (err) {
      wx.hideLoading()
      console.error('保存失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})