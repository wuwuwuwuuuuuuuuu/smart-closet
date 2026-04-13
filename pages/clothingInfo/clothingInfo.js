// 🌟 第一处修改：在最顶部引入全局 app 实例
const app = getApp()

Page({
  data: {
    uploadedImage: '', // 云端图片 fileID
    categoryOptions: ['上衣', '下装', '外套', '连衣裙', '配饰', '鞋包'],
    categoryIndex: -1,
    selectedMaterial: '',
    customMaterial: '',
    selectedSeasons: [],
    customTags: [],
    tagInput: '',
    canSave: false
  },

  onLoad(options) {
    console.log('衣物信息录入页加载', options)
    
    // 1. 获取上一页上传成功的云端图片路径 (务必解码)
    if (options.imagePath) {
      this.setData({
        uploadedImage: decodeURIComponent(options.imagePath)
      })
    }
    this.checkSaveStatus()
  },

  goBack() {
    wx.showModal({
      title: '确认',
      content: '是否放弃当前录入？',
      confirmText: '放弃',
      cancelText: '继续编辑',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack()
        }
      }
    })
  },

  onCategoryChange(e) {
    const index = e.detail.value
    this.setData({ categoryIndex: index })
    this.checkSaveStatus()
  },

  selectMaterial(e) {
    const material = e.currentTarget.dataset.material
    this.setData({ selectedMaterial: material, customMaterial: '' })
  },

  onCustomMaterialInput(e) {
    this.setData({ customMaterial: e.detail.value, selectedMaterial: '' })
  },

  toggleSeason(e) {
    const season = e.currentTarget.dataset.season
    const selectedSeasons = [...this.data.selectedSeasons]
    if (selectedSeasons.includes(season)) {
      const index = selectedSeasons.indexOf(season)
      selectedSeasons.splice(index, 1)
    } else {
      selectedSeasons.push(season)
    }
    this.setData({ selectedSeasons: selectedSeasons })
    this.checkSaveStatus()
  },

  onTagInput(e) {
    this.setData({ tagInput: e.detail.value })
  },

  addTag() {
    const tag = this.data.tagInput.trim()
    if (tag && !this.data.customTags.includes(tag)) {
      const customTags = [...this.data.customTags, tag]
      this.setData({ customTags: customTags, tagInput: '' })
    }
  },

  removeTag(e) {
    const index = e.currentTarget.dataset.index
    const customTags = [...this.data.customTags]
    customTags.splice(index, 1)
    this.setData({ customTags: customTags })
  },

  checkSaveStatus() {
    const canSave = this.data.categoryIndex !== -1 && this.data.selectedSeasons.length > 0
    this.setData({ canSave: canSave })
  },

  // 🚀 核心改造：保存衣物信息到云数据库！
  saveClothing() {
    if (!this.data.canSave) {
      wx.showToast({ title: '请填写必填项', icon: 'none' })
      return
    }

    // 🌟 核心防御：获取当前登录用户的 ID
    const userId = app.globalData.currentUserId
    if (!userId) {
      wx.showToast({ title: '尚未登录，无法保存', icon: 'none' })
      return
    }

    const categoryName = this.data.categoryOptions[this.data.categoryIndex]
    const material = this.data.customMaterial || this.data.selectedMaterial || ''
    
    // 给衣服自动起个默认名字，比如 "冬季上衣"
    const defaultName = (this.data.selectedSeasons[0] || '') + categoryName

    wx.showLoading({ title: '正在存入私人衣橱...' })

    // 呼叫咱们刚写好的 addClothing 云函数！
    wx.cloud.callFunction({
      name: 'addClothing',
      data: {
        userId: userId, // 🌟 第二处修改：打上专属钢印！告诉云函数这衣服是谁的
        name: defaultName,
        image: this.data.uploadedImage, // 传递 cloud:// 链接
        category: categoryName,
        material: material,
        season: this.data.selectedSeasons.join('/'), // 比如 "春季/秋季"
        tags: this.data.customTags,
        brand: '' // 目前UI没有品牌输入框，暂传空字符串
      },
      success: (res) => {
        wx.hideLoading()
        console.log('🎉 云端入库成功：', res.result)
        
        if (res.result.code === 200) {
          wx.showToast({ title: '添加成功！', icon: 'success' })
          // 延迟 1.5 秒后，连退两步回到主页面
          setTimeout(() => {
            wx.navigateBack({ delta: 2 })
          }, 1500)
        } else {
          // 如果没登录（比如直接点进来测的），会提示用户不存在
          wx.showToast({ title: res.result.message, icon: 'none', duration: 3000 })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('❌ 保存衣物失败:', err)
        wx.showToast({ title: '网络异常，保存失败', icon: 'error' })
      }
    })
  }
})