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
    
    // 弹窗状态
    showNicknameModal: false,
    showGenderModal: false,
    showDatePicker: false,
    
    // 临时数据
    tempNickname: '',
    tempGender: '',
    tempBirthday: '',
    
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
      this.setData({
        avatarUrl: user.avatar || this.data.avatarUrl,
        nickname: user.nickname || '',
        birthday: user.birthday || '',
        gender: user.gender || ''
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

  // 编辑昵称逻辑 (保持不变)
  editNickname() { this.setData({ showNicknameModal: true, tempNickname: this.data.nickname }) },
  onNicknameInput(e) { this.setData({ tempNickname: e.detail.value }) },
  cancelEditNickname() { this.setData({ showNicknameModal: false, tempNickname: '' }) },
  confirmEditNickname() {
    const nickname = this.data.tempNickname.trim()
    if (!nickname) return wx.showToast({ title: '昵称不能为空', icon: 'none' })
    this.setData({ nickname, showNicknameModal: false, tempNickname: '' })
    this.checkSaveButton()
  },

  // 日期/性别选择逻辑 (保持不变)
  showDatePicker() { this.setData({ showDatePicker: true, tempBirthday: this.data.birthday || '' }) },
  hideDatePicker() { this.setData({ showDatePicker: false, tempBirthday: '' }) },
  onDateChange(e) { this.setData({ tempBirthday: e.detail.value }) },
  confirmDate() {
    if (this.data.tempBirthday) {
      this.setData({ birthday: this.data.tempBirthday, showDatePicker: false, tempBirthday: '' })
      this.checkSaveButton()
    }
  },
  selectGender() { this.setData({ showGenderModal: true, tempGender: this.data.gender || '' }) },
  selectGenderOption(e) { this.setData({ tempGender: e.currentTarget.dataset.gender }) },
  confirmSelectGender() {
    if (!this.data.tempGender) return wx.showToast({ title: '请选择性别', icon: 'none' })
    this.setData({ gender: this.data.tempGender, showGenderModal: false, tempGender: '' })
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