// 个人信息设置页面逻辑
Page({
  data: {
    // 用户信息
    avatarUrl: 'cloud://cloudbase-2gvrvh4ve926f3d8.636c-cloudbase-2gvrvh4ve926f3d8-1411253050/clothing-images/images/img5.png',
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
    
    // 保存按钮状态
    canSave: false
  },

  onLoad(options) {
    console.log('个人信息设置页面加载')
    // 设置当前日期
    const today = new Date()
    const currentDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
    this.setData({
      currentDate: currentDate
    })
    // 从本地存储加载用户信息
    this.loadUserInfo()
  },

  onShow() {
    console.log('个人信息设置页面显示')
  },

  // 从本地存储加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    this.setData({
      avatarUrl: userInfo.avatarUrl || this.data.avatarUrl,
      nickname: userInfo.nickname || '',
      birthday: userInfo.birthday || '',
      gender: userInfo.gender || ''
    })
    this.checkSaveButton()
  },

  // 检查保存按钮状态
  checkSaveButton() {
    const { nickname, birthday, gender } = this.data
    const canSave = !!nickname.trim() // 昵称不能为空
    this.setData({ canSave })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 更换头像
  changeAvatar() {
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album']
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: sourceType,
          success: (res) => {
            // 这里应该上传图片到服务器并获取URL
            // 暂时使用本地临时路径
            this.setData({
              avatarUrl: res.tempFilePaths[0]
            })
            this.checkSaveButton()
            wx.showToast({
              title: '头像更新成功',
              icon: 'success'
            })
          },
          fail: (err) => {
            console.error('选择图片失败:', err)
            wx.showToast({
              title: '选择图片失败',
              icon: 'none'
            })
          }
        })
      },
      fail: (err) => {
        console.error('打开选择器失败:', err)
      }
    })
  },

  // 编辑昵称
  editNickname() {
    this.setData({
      showNicknameModal: true,
      tempNickname: this.data.nickname
    })
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      tempNickname: e.detail.value
    })
  },

  // 取消编辑昵称
  cancelEditNickname() {
    this.setData({
      showNicknameModal: false,
      tempNickname: ''
    })
  },

  // 确认编辑昵称
  confirmEditNickname() {
    const nickname = this.data.tempNickname.trim()
    if (!nickname) {
      wx.showToast({
        title: '昵称不能为空',
        icon: 'none'
      })
      return
    }
    
    this.setData({
      nickname: nickname,
      showNicknameModal: false,
      tempNickname: ''
    })
    this.checkSaveButton()
  },

  // 显示日期选择器
  showDatePicker() {
    console.log('显示日期选择器')
    this.setData({
      showDatePicker: true,
      tempBirthday: this.data.birthday || ''
    })
  },

  // 隐藏日期选择器
  hideDatePicker() {
    this.setData({
      showDatePicker: false,
      tempBirthday: ''
    })
  },

  // 日期选择变化
  onDateChange(e) {
    console.log('日期选择变化:', e.detail.value)
    this.setData({
      tempBirthday: e.detail.value
    })
  },

  // 确认日期选择
  confirmDate() {
    if (this.data.tempBirthday) {
      this.setData({
        birthday: this.data.tempBirthday,
        showDatePicker: false,
        tempBirthday: ''
      })
      this.checkSaveButton()
      wx.showToast({
        title: '生日设置成功',
        icon: 'success'
      })
    } else {
      wx.showToast({
        title: '请选择生日',
        icon: 'none'
      })
    }
  },

  // 选择性别
  selectGender() {
    console.log('点击性别选项，打开弹窗')
    this.setData({
      showGenderModal: true,
      tempGender: this.data.gender || '' // 确保有默认值
    })
    console.log('弹窗状态:', this.data.showGenderModal)
  },

  // 选择性别选项
  selectGenderOption(e) {
    console.log('点击性别选项按钮')
    const gender = e.currentTarget.dataset.gender
    console.log('选择的性别选项:', gender, '事件对象:', e)
    this.setData({
      tempGender: gender
    })
    console.log('临时性别已设置为:', this.data.tempGender)
  },

  // 确认选择性别
  confirmSelectGender() {
    if (!this.data.tempGender) {
      // 如果没有选择，提示用户必须选择
      wx.showToast({
        title: '请选择性别',
        icon: 'none'
      })
      return
    }
    
    this.setData({
      gender: this.data.tempGender,
      showGenderModal: false,
      tempGender: ''
    })
    this.checkSaveButton()
    console.log('最终选择的性别:', this.data.gender)
  },

  // 保存个人信息
  saveProfile() {
    if (!this.data.canSave) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    const userInfo = {
      avatarUrl: this.data.avatarUrl,
      nickname: this.data.nickname,
      birthday: this.data.birthday,
      gender: this.data.gender,
      updateTime: new Date().getTime()
    }

    // 保存到本地存储
    wx.setStorageSync('userInfo', userInfo)

    wx.showToast({
      title: '保存成功',
      icon: 'success',
      duration: 1500,
      success: () => {
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    })
  }
})