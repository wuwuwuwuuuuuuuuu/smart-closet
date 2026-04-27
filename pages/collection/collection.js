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
    console.log('我的收藏页加载')
    this.loadCollections()
  },

  onShow() {
    console.log('我的收藏页显示')
    // 如果你希望每次回到这个页面都刷新一下最新收藏，可以把下面这行解开注释
    // this.loadCollections()
  },

  // === 🌟 核心升级：从云数据库拉取历史融合记录 ===
  async loadCollections() {
    wx.showLoading({ title: '加载衣橱中...' })
    try {
      const userId = app.globalData.currentUserId || 'unknown_user'
      
      // 查询我们之前存大片的 tryon_history 集合
      const res = await db.collection('tryon_history')
        .where({ userId: userId }) // 确保和保存时的字段名一致
        .orderBy('createTime', 'desc') // 最新生成的排在最前面
        .get()

      // 清洗数据，适配你的前端 UI
      const realData = res.data.map(item => {
        // 格式化时间作为标签 (如: 2026-04-27)
        let dateStr = '最新'
        if (item.createTime) {
          const dateObj = new Date(item.createTime)
          const m = String(dateObj.getMonth() + 1).padStart(2, '0')
          const d = String(dateObj.getDate()).padStart(2, '0')
          dateStr = `${m}-${d}` // 简短日期
        }

        // 动态生成 tags 方便搜索
        const sceneTag = (item.sceneUrl && item.sceneUrl.includes('cloud://')) ? '自定义场景' : (item.sceneUrl || 'AI生成')
        const tags = [sceneTag, dateStr]

        return {
          id: item._id,
          image: item.finalImage,               // 🌟 最终的融合场景大片
          clothesImage: item.originalTryonImage,// 🌟 穿的衣服 (咱们之前保留的试穿原图)
          scene: item.sceneUrl,
          tags: tags,
          date: dateStr,
          rawData: item
        }
      })

      this.setData({
        collections: realData,
        filteredCollections: realData // 初始状态展示全部
      })

    } catch (error) {
      console.error('❌ 加载收藏失败:', error)
      wx.showToast({ title: '加载数据失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({
      searchKeyword: keyword
    })
    this.filterCollections()
  },

  // 过滤收藏 (支持按场景、日期等 tags 搜索)
  filterCollections() {
    const { searchKeyword, collections } = this.data
    
    if (!searchKeyword.trim()) {
      this.setData({
        filteredCollections: collections
      })
      return
    }

    const keyword = searchKeyword.trim().toLowerCase()
    const filtered = collections.filter(item => {
      return item.tags.some(tag => tag.toLowerCase().includes(keyword))
    })

    this.setData({
      filteredCollections: filtered
    })
  },

  // 下拉刷新 (改写为真正的异步刷新)
  async onRefresh() {
    this.setData({ refreshing: true })
    await this.loadCollections()
    this.setData({ refreshing: false })
  },

  // === 🌟 升级版：查看详情 ===
  goToPoster(e) {
    const item = e.currentTarget.dataset.item
    
    // 💡 方案 A：继续使用你的跳转逻辑。我把 clothesImage 也塞进了链接里，你在 poster 页面可以拿出来展示“穿的衣服”
    wx.navigateTo({
      url: `/pages/poster/poster?image=${encodeURIComponent(item.image)}&clothes=${encodeURIComponent(item.clothesImage)}`
    })

    /*
    // 💡 方案 B：直接呼出微信原生全屏预览（不需要写新页面了！）
    // 如果你用了方案 B，连带衣服和场景大片可以左右滑动查看，非常丝滑。需要的话解开注释并注释掉上面的方案 A。
    wx.previewImage({
      current: item.image, 
      urls: [item.image, item.clothesImage].filter(Boolean) // 把融合图和衣服图放进相册组，左右滑就能看
    })
    */
  }
})