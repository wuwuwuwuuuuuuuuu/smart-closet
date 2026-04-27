const db = wx.cloud.database()
const app = getApp()

Page({
  data: {
    searchKeyword: '',
    refreshing: false,
    collections: [],
    filteredCollections: []
  },

  onLoad() {
    this.loadCollections()
  },

  onShow() {
    // 每次进入收藏页都刷新一下，保证能看到刚刚收藏的图
    this.loadCollections()
  },

  // === 🌟 核心：专门去查 collections 收藏表 ===
  async loadCollections() {
    wx.showLoading({ title: '加载收藏夹...' })
    try {
      const userId = app.globalData.currentUserId || 'unknown_user'
      
      // 🌟 注意这里：改成了查 collections 表
      const res = await db.collection('collections')
        .where({ userId: userId }) 
        .orderBy('createTime', 'desc') 
        .get()

      const realData = res.data.map(item => {
        let dateStr = '最新'
        if (item.createTime) {
          const dateObj = new Date(item.createTime)
          dateStr = `${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}` 
        }

        const tags = [item.sceneUrl || '精选收藏', dateStr]

        return {
          id: item._id,
          image: item.finalImage,               // 融合大片
          clothesImage: item.originalTryonImage,// 穿的衣服原图
          scene: item.sceneUrl,
          tags: tags,
          date: dateStr,
          rawData: item
        }
      })

      this.setData({
        collections: realData,
        filteredCollections: realData 
      })

    } catch (error) {
      console.error('❌ 加载收藏失败:', error)
      wx.showToast({ title: '加载收藏失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  goBack() { wx.navigateBack() },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
    this.filterCollections()
  },

  filterCollections() {
    const { searchKeyword, collections } = this.data
    if (!searchKeyword.trim()) {
      return this.setData({ filteredCollections: collections })
    }
    const keyword = searchKeyword.trim().toLowerCase()
    const filtered = collections.filter(item => item.tags.some(tag => tag.toLowerCase().includes(keyword)))
    this.setData({ filteredCollections: filtered })
  },

  async onRefresh() {
    this.setData({ refreshing: true })
    await this.loadCollections()
    this.setData({ refreshing: false })
  },

  goToPoster(e) {
    const item = e.currentTarget.dataset.item
    wx.navigateTo({
      url: `/pages/poster/poster?image=${encodeURIComponent(item.image)}&clothes=${encodeURIComponent(item.clothesImage)}`
    })
  }
})