// 衣物信息录入页面逻辑
Page({
  data: {
    // 上传的图片
    uploadedImage: '',
    
    // 衣物分类
    categoryOptions: ['上衣', '下装', '外套', '连衣裙', '配饰', '鞋包'],
    categoryIndex: -1,
    
    // 材质
    selectedMaterial: '',
    customMaterial: '',
    
    // 适用季节
    selectedSeasons: [],
    
    // 自定义标签
    customTags: [],
    tagInput: '',
    
    // 保存状态
    canSave: false
  },

  onLoad(options) {
    console.log('衣物信息录入页加载', options)
    
    // 获取上传的图片路径
    if (options.imagePath) {
      this.setData({
        uploadedImage: options.imagePath
      })
    }
    
    // 检查必填项状态
    this.checkSaveStatus()
  },

  // 返回上一页
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

  // 衣物分类选择
  onCategoryChange(e) {
    const index = e.detail.value
    this.setData({
      categoryIndex: index
    })
    this.checkSaveStatus()
  },

  // 选择材质
  selectMaterial(e) {
    const material = e.currentTarget.dataset.material
    this.setData({
      selectedMaterial: material,
      customMaterial: ''
    })
  },

  // 自定义材质输入
  onCustomMaterialInput(e) {
    this.setData({
      customMaterial: e.detail.value,
      selectedMaterial: ''
    })
  },

  // 切换季节选择
  toggleSeason(e) {
    const season = e.currentTarget.dataset.season
    const selectedSeasons = [...this.data.selectedSeasons]
    
    if (selectedSeasons.includes(season)) {
      // 取消选择
      const index = selectedSeasons.indexOf(season)
      selectedSeasons.splice(index, 1)
    } else {
      // 选择
      selectedSeasons.push(season)
    }
    
    this.setData({
      selectedSeasons: selectedSeasons
    })
    this.checkSaveStatus()
  },

  // 标签输入
  onTagInput(e) {
    this.setData({
      tagInput: e.detail.value
    })
  },

  // 添加标签
  addTag() {
    const tag = this.data.tagInput.trim()
    if (tag && !this.data.customTags.includes(tag)) {
      const customTags = [...this.data.customTags, tag]
      this.setData({
        customTags: customTags,
        tagInput: ''
      })
    }
  },

  // 删除标签
  removeTag(e) {
    const index = e.currentTarget.dataset.index
    const customTags = [...this.data.customTags]
    customTags.splice(index, 1)
    this.setData({
      customTags: customTags
    })
  },

  // 检查保存状态
  checkSaveStatus() {
    const canSave = this.data.categoryIndex !== -1 && this.data.selectedSeasons.length > 0
    this.setData({
      canSave: canSave
    })
  },

  // 保存衣物信息
  saveClothing() {
    if (!this.data.canSave) {
      wx.showToast({
        title: '请填写必填项',
        icon: 'none'
      })
      return
    }

    // 确定材质（优先使用自定义材质）
    const material = this.data.customMaterial || this.data.selectedMaterial || ''

    // 构建衣物数据
    const clothingData = {
      id: Date.now(),
      image: this.data.uploadedImage,
      category: this.data.categoryOptions[this.data.categoryIndex],
      material: material,
      seasons: this.data.selectedSeasons,
      tags: this.data.customTags,
      createTime: new Date().toISOString()
    }

    // 保存到本地存储
    this.saveToStorage(clothingData)

    // 显示成功提示
    wx.showToast({
      title: '衣物添加成功！',
      icon: 'success',
      duration: 2000
    })

    // 延迟返回
    setTimeout(() => {
      wx.navigateBack({
        delta: 2 // 返回两级：信息录入页 → 上传弹窗 → 原页面
      })
    }, 1500)
  },

  // 保存到本地存储
  saveToStorage(clothingData) {
    // 获取现有的衣物列表
    let clothingList = wx.getStorageSync('clothingList') || []
    
    // 添加新衣物
    clothingList.unshift(clothingData)
    
    // 保存到本地存储
    wx.setStorageSync('clothingList', clothingList)
    
    console.log('衣物保存成功:', clothingData)
  }
})