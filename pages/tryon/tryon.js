const db = wx.cloud.database()

Page({
  data: {
    sidebarVisible: true, // 🌟 默认打开侧边栏
    searchKeyword: '',
    currentSeason: '', 
    currentCategory: '', 
    seasons: ['春', '夏', '秋', '冬'],
    categories: ['上衣', '下装', '配饰', '鞋子', '外套', '连体衣'], 
    
    clothesList: [], 
    filteredClothes: [], 
    selectedClothes: [], // 🌟 现在可以存多件衣服了，用于画板搭配
    
    personImage: '', // 模特/自己的人物照片
    isGenerating: false 
  },

  onLoad() {
    this.loadRealClothes()
  },

  onShow() {
    this.loadRealClothes()
  },

  // ☁️ 加载衣服
  async loadRealClothes() {
    try {
      const res = await db.collection('clothes').orderBy('created_at', 'desc').get()
      const cleanData = res.data.map(item => {
        if (item.image) item.image = item.image.trim()
        return item
      })
      this.setData({ clothesList: cleanData })
      this.filterClothes() 
    } catch (err) {
      console.error('加载衣服失败:', err)
    }
  },

  // 🌟 侧边栏收缩/展开切换
  toggleSidebar() {
    this.setData({ sidebarVisible: !this.data.sidebarVisible })
  },

  // 📸 上传人像 (可作为搭配板的背景)
  uploadPersonImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        this.setData({ personImage: res.tempFiles[0].tempFilePath })
      }
    })
  },

  // 🌟 选择多件衣服放到搭配板
  selectClothes(e) {
    const item = e.currentTarget.dataset.item
    // 给新衣服一个初始随机位置，防止重叠
    const newItem = { 
      ...item, 
      x: 50 + Math.random() * 50, 
      y: 50 + Math.random() * 50 
    }
    this.setData({
      selectedClothes: [...this.data.selectedClothes, newItem] 
    })
  },

  // 🌟 记录衣服拖拽的最新位置
  onMoveChange(e) {
    const index = e.currentTarget.dataset.index
    const { x, y } = e.detail
    const selectedClothes = [...this.data.selectedClothes]
    selectedClothes[index].x = x
    selectedClothes[index].y = y
    this.setData({ selectedClothes })
  },

  // 🌟 从搭配板移除衣服
  removeClothes(e) {
    const index = e.currentTarget.dataset.index
    const selectedClothes = [...this.data.selectedClothes]
    selectedClothes.splice(index, 1)
    this.setData({ selectedClothes })
  },

  // 🤖 发起 AI 试穿
  async startAITryOn() {
    const { personImage, selectedClothes, isGenerating } = this.data

    if (isGenerating) return 
    if (!personImage) return wx.showToast({ title: 'AI换装需要先上传您的人像', icon: 'none' })
    if (selectedClothes.length === 0) return wx.showToast({ title: '画板上还没有衣服哦', icon: 'none' })

    // 🚨 注意：Fashn V1.6 API 标准一次只接受一件核心衣物（比如一件上衣）。
    // 这里我们默认取用户在画板上放的“第一件”衣服的图片去做 AI。
    // 如果后续你用了更高级的接口支持上下装混搭，可以修改这里。
    const garmentImageFileID = selectedClothes[0].image 

    this.setData({ isGenerating: true })
    wx.showLoading({ title: 'AI生成中...', mask: true }) 

    try {
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `tryon_persons/user_${Date.now()}.png`,
        filePath: personImage
      })
      const personImageFileID = uploadRes.fileID

      const aiRes = await wx.cloud.callFunction({
        name: 'aiTryOn',
        data: { personImageFileID, garmentImageFileID }
      })

      wx.hideLoading()
      this.setData({ isGenerating: false })

      if (aiRes.result.code === 200) {
        const finalImageUrl = aiRes.result.data.result_url
        wx.navigateTo({ url: `/pages/preview/preview?img=${encodeURIComponent(finalImageUrl)}` })
      } else {
        throw new Error(aiRes.result.message || 'AI 接口返回错误')
      }
    } catch (err) {
      wx.hideLoading()
      this.setData({ isGenerating: false })
      wx.showToast({ title: '换装失败，请重试', icon: 'none' })
    }
  },

  // 基础搜索与筛选
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
    this.filterClothes()
  },
  changeSeason(e) {
    const season = e.currentTarget.dataset.season
    this.setData({ currentSeason: this.data.currentSeason === season ? '' : season })
    this.filterClothes()
  },
  changeCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ currentCategory: this.data.currentCategory === category ? '' : category })
    this.filterClothes()
  },
  filterClothes() {
    const { searchKeyword, currentSeason, currentCategory, clothesList } = this.data
    let filtered = clothesList.filter(item => {
      if (currentSeason && item.season !== currentSeason) return false
      if (currentCategory && item.category !== currentCategory) return false
      if (searchKeyword && item.name && !item.name.includes(searchKeyword)) return false
      return true
    })
    this.setData({ filteredClothes: filtered })
  }
})