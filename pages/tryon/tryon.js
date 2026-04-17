const db = wx.cloud.database()
const app = getApp()

Page({
  data: {
    sidebarVisible: true,
    searchKeyword: '',
    currentSeason: '', 
    currentCategory: '', 
    seasons: ['春', '夏', '秋', '冬'],
    categories: ['上衣', '下装', '外套', '连衣裙', '配饰', '鞋包'], 
    clothesList: [], 
    filteredClothes: [], 
    selectedClothes: [], 
    isGenerating: false 
  },

  onLoad() { this.loadRealClothes() },
  onShow() { this.loadRealClothes() },

  async loadRealClothes() {
    wx.showLoading({ title: '加载私人衣橱...' })
    try {
      const userId = app.globalData.currentUserId 
      if (!userId) {
        this.setData({ clothesList: [], filteredClothes: [] })
        wx.hideLoading(); return
      }
      const res = await db.collection('clothes').where({ user_id: userId }).orderBy('created_at', 'desc').get()
      const cleanData = res.data.map(item => {
        if (item.image) item.image = item.image.trim()
        return item
      })
      this.setData({ clothesList: cleanData })
      this.filterClothes() 
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
    }
  },

  toggleSidebar() { this.setData({ sidebarVisible: !this.data.sidebarVisible }) },
  uploadPersonImage() { wx.navigateTo({ url: '/pages/avatar/avatar' }) },

  // 选择衣服
  selectClothes(e) {
    const item = e.currentTarget.dataset.item
    const newItem = { 
      ...item, 
      x: 30 + Math.random() * 30, 
      y: 50 + Math.random() * 50,
      scale: 1 
    }
    this.setData({
      selectedClothes: [...this.data.selectedClothes, newItem] 
    })
  },

  // 🌟 记录移动：直接修改数据引用，避免 setData 导致的跳动
  onMoveChange(e) {
    if (e.detail.source === 'touch') {
      const index = e.currentTarget.dataset.index
      const { x, y } = e.detail
      // 直接修改内存中的数据，不调用 setData 渲染，防止反馈环
      this.data.selectedClothes[index].x = x
      this.data.selectedClothes[index].y = y
    }
  },

  // 🌟 记录缩放：直接修改数据引用，不再更新 scale-value
  onScaleChange(e) {
    const index = e.currentTarget.dataset.index
    const { scale } = e.detail
    // 仅仅记录下缩放倍数，供 AI 试穿使用
    this.data.selectedClothes[index].scale = scale
  },

  removeClothes(e) {
    const index = e.currentTarget.dataset.index
    const selectedClothes = [...this.data.selectedClothes]
    selectedClothes.splice(index, 1)
    this.setData({ selectedClothes })
  },

  // 发起 AI 试穿
  async startAITryOn() {
    const { selectedClothes, isGenerating } = this.data
    if (isGenerating) return 
    if (selectedClothes.length === 0) return wx.showToast({ title: '画板上还没有衣服哦', icon: 'none' })

    this.setData({ isGenerating: true })
    wx.showLoading({ title: '正在召唤专属模特...', mask: true }) 

    try {
      const userId = app.globalData.currentUserId
      const userRes = await db.collection('users').doc(userId).get()
      const personImageFileID = userRes.data.avatarImage

      if (!personImageFileID) {
        this.setData({ isGenerating: false }); wx.hideLoading()
        return wx.showToast({ title: '请先点击换模特设置形象', icon: 'none' })
      }

      wx.showLoading({ title: 'AI 试穿中...', mask: true }) 
      // 此时获取到的就是最新的缩放和位置后的衣服（虽然我们没存 scale 到数据库，但这里能拿到当前内存的值）
      const garmentImageFileID = selectedClothes[0].image 

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
      wx.hideLoading(); this.setData({ isGenerating: false })
      wx.showToast({ title: '换装失败，请重试', icon: 'none' })
    }
  },

  // 基础搜索与筛选
  onSearchInput(e) { this.setData({ searchKeyword: e.detail.value }); this.filterClothes() },
  changeSeason(e) { 
    const season = e.currentTarget.dataset.season
    this.setData({ currentSeason: this.data.currentSeason === season ? '' : season }); this.filterClothes() 
  },
  changeCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ currentCategory: this.data.currentCategory === category ? '' : category }); this.filterClothes() 
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