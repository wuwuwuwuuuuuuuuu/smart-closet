// 🌟 第一处修改：在最顶部引入全局 app 实例
const app = getApp()

Page({
  data: {
    uploadedImage: '', // 抠图后的透明背景图片 fileID
    originalImage: '', // 原始图片 fileID
    categoryOptions: ['上衣', '下装', '外套', '连衣裙', '配饰', '鞋包'],
    categoryIndex: -1,
    selectedMaterial: '',
    customMaterial: '',
    selectedSeasons: [],
    customTags: [],
    tagInput: '',
    canSave: false
  },

  // 🌟 核心杀毒补丁：将网络图片下载后，立刻转存到微信云存储！
  async downloadAndUploadToCloud(imageUrl) {
    try {
      // 1. 先下载到本地临时文件
      const downloadRes = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: imageUrl,
          success: resolve,
          fail: reject
        })
      })

      if (downloadRes.statusCode !== 200) throw new Error('下载图失败')
      const tempPath = downloadRes.tempFilePath

      // 2. 🌟 关键的一步：把临时文件上传到微信云存储，换取永久护身符！
      const cloudPath = `clothes_transparent/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempPath
      })

      console.log('✅ 成功将抠图转存至云端:', uploadRes.fileID)
      return uploadRes.fileID // 这才是真正的 cloud://...

    } catch (err) {
      console.error('❌ 转存云端失败:', err)
      return null
    }
  },

  onLoad(options) {
    console.log('衣物信息录入页加载', options)
    
    // 1. 获取上一页上传的图片信息
    if (options.originalImage && options.transparentImage) {
      const originalImage = decodeURIComponent(options.originalImage)
      const transparentImage = decodeURIComponent(options.transparentImage)
      
      console.log('原始图片:', originalImage)
      console.log('透明图片:', transparentImage)
      
      // 如果透明图片为空，使用原图
      if (!transparentImage || transparentImage === 'null') {
        console.log('透明图片为空，使用原图')
        this.setData({
          uploadedImage: originalImage,
          originalImage: originalImage
        })
      }
      // 🌟 修复处：检测到阿里云的 HTTP URL，开始下载并转存
      else if (transparentImage.startsWith('http')) {
        console.log('检测到HTTP URL，开始下载并转存到云端...')
        
        wx.showLoading({ title: '处理高清抠图中...' })
        
        this.downloadAndUploadToCloud(transparentImage).then(permanentFileID => {
          wx.hideLoading()
          if (permanentFileID) {
            this.setData({
              uploadedImage: permanentFileID, // 拿到完美的 cloud:// 链接
              originalImage: originalImage
            })
          } else {
            // 如果转存失败，保底使用原图
            this.setData({
              uploadedImage: originalImage,
              originalImage: originalImage
            })
          }
        })
      } else {
        // 直接使用已有的文件ID (cloud://)
        this.setData({
          uploadedImage: transparentImage,
          originalImage: originalImage
        })
      }
    } else if (options.imagePath) {
      // 兼容旧版本
      this.setData({
        uploadedImage: decodeURIComponent(options.imagePath),
        originalImage: decodeURIComponent(options.imagePath)
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

  saveClothing() {
    if (!this.data.canSave) {
      wx.showToast({ title: '请填写必填项', icon: 'none' })
      return
    }

    const userId = app.globalData.currentUserId
    if (!userId) {
      wx.showToast({ title: '尚未登录，无法保存', icon: 'none' })
      return
    }

    const categoryName = this.data.categoryOptions[this.data.categoryIndex]
    const material = this.data.customMaterial || this.data.selectedMaterial || ''
    
    const defaultName = (this.data.selectedSeasons[0] || '') + categoryName

    wx.showLoading({ title: '正在存入私人衣橱...' })

    wx.cloud.callFunction({
      name: 'addClothing',
      data: {
        userId: userId, 
        name: defaultName,
        image: this.data.uploadedImage, // 这次传过去的就是绝对安全的 cloud:// 啦！
        originalImage: this.data.originalImage, 
        category: categoryName,
        material: material,
        season: this.data.selectedSeasons.join('/'), 
        tags: this.data.customTags,
        brand: '' 
      },
      success: (res) => {
        wx.hideLoading()
        console.log('🎉 云端入库成功：', res.result)
        
        if (res.result.code === 200) {
          wx.showToast({ title: '添加成功！', icon: 'success' })
          setTimeout(() => {
            wx.navigateBack({ delta: 2 })
          }, 1500)
        } else {
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