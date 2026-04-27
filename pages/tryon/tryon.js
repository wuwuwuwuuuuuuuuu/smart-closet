const db = wx.cloud.database()
const app = getApp()
// 简化依赖，避免模块加载问题
// const { logError, logWarning } = require('../../utils/logger')
// const {
//   matchSelectedClothes,
//   buildSuggestedPlacements,
//   isValidSmartRecommendEntry
// } = require('./tryon.helpers')

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
    productTryonItem: null,
    isGenerating: false,
    smartRecommendIcon: '/images/smart_recommend_robot_icon.png',
    smartRecommendEntry: null
  },

  onLoad() {
    console.log('试穿页面onLoad被调用')
    try {
      this.pendingSmartRecommendEntry = null
      this.productTryonItemBackup = null
      
      // 延迟检查商品图片，确保本地存储已同步
      setTimeout(() => {
        try {
          this.autoAddProductImage()
        } catch (error) {
          console.error('autoAddProductImage错误:', error)
        }
      }, 300)
    } catch (error) {
      console.error('onLoad错误:', error)
    }
  },

  onShow() {
    console.log('试穿页面onShow被调用')
    try {
      this.pendingSmartRecommendEntry = this.consumePendingSmartRecommendEntry()
      
      // 每次进入试穿页都刷新衣橱，保证侧边栏有最新衣物
      this.loadRealClothes()
      
      // 延迟检查商品图片，确保本地存储已同步
      setTimeout(() => {
        try {
          this.autoAddProductImage()
        } catch (error) {
          console.error('autoAddProductImage错误:', error)
        }
      }, 500)
    } catch (error) {
      console.error('onShow错误:', error)
    }
  },

  async loadRealClothes() {
    wx.showLoading({ title: '加载私人衣橱...' })

    try {
      const userId = app.globalData.currentUserId
      if (!userId) {
        this.setData({
          clothesList: [],
          filteredClothes: []
        })
        this.applySmartRecommendEntryIfNeeded([])
        wx.hideLoading()
        return
      }

      const res = await db.collection('clothes')
        .where({ user_id: userId })
        .orderBy('created_at', 'desc')
        .get()

      const cleanData = (res.data || []).map(item => ({
        ...item,
        image: item.image ? item.image.trim() : item.image
      }))

      const filteredClothes = this.getFilteredClothes({
        clothesList: cleanData,
        searchKeyword: this.data.searchKeyword,
        currentSeason: this.data.currentSeason,
        currentCategory: this.data.currentCategory
      })

      this.setData({
        clothesList: cleanData,
        filteredClothes
      })

      this.applySmartRecommendEntryIfNeeded(cleanData)
      wx.hideLoading()
    } catch (error) {
      wx.hideLoading()
      console.error('tryon.loadRealClothes错误:', error)
      // logError('tryon.loadRealClothes', error)
    }
  },

  consumePendingSmartRecommendEntry() {
    try {
      const entry = wx.getStorageSync('smartRecommendTryonEntry')
      // if (!isValidSmartRecommendEntry(entry) || entry.active !== true) {
      if (!entry || entry.active !== true) {
        if (entry && entry.active === true) {
          console.warn('tryon.consumePendingSmartRecommendEntry', 'invalid or expired entry ignored')
          // logWarning('tryon.consumePendingSmartRecommendEntry', 'invalid or expired entry ignored')
        }
        this.setData({ smartRecommendEntry: null })
        return null
      }

      const consumedEntry = {
        ...entry,
        active: false
      }
      wx.setStorageSync('smartRecommendTryonEntry', consumedEntry)
      this.setData({ smartRecommendEntry: consumedEntry })

      return consumedEntry
    } catch (error) {
      console.error('tryon.consumePendingSmartRecommendEntry错误:', error)
      // logError('tryon.consumePendingSmartRecommendEntry', error)
      return null
    }
  },

  applySmartRecommendEntryIfNeeded(clothesList) {
    const entry = this.pendingSmartRecommendEntry
    if (!entry) {
      this.setData({ smartRecommendEntry: null })
      return
    }

    // const matchedClothes = matchSelectedClothes(entry.selectedClothesIds || [], clothesList)
    // const placedClothes = buildSuggestedPlacements(matchedClothes)
    const matchedClothes = []
    const placedClothes = []

    if ((entry.selectedClothesIds || []).length > 0 && matchedClothes.length === 0) {
      console.warn('tryon.applySmartRecommendEntryIfNeeded', 'no recommended clothes matched current wardrobe', {
        selectedClothesIds: entry.selectedClothesIds
      })
      // logWarning('tryon.applySmartRecommendEntryIfNeeded', 'no recommended clothes matched current wardrobe', {
      //   selectedClothesIds: entry.selectedClothesIds
      // })
    }

    this.setData({
      smartRecommendEntry: entry,
      selectedClothes: placedClothes
    })
    this.pendingSmartRecommendEntry = null
  },

  getFilteredClothes({
    clothesList = [],
    searchKeyword = '',
    currentSeason = '',
    currentCategory = ''
  } = {}) {
    return clothesList.filter(item => {
      if (currentSeason && item.season !== currentSeason) {
        return false
      }
      if (currentCategory && item.category !== currentCategory) {
        return false
      }
      if (searchKeyword && item.name && !item.name.includes(searchKeyword)) {
        return false
      }
      return true
    })
  },

  toggleSidebar() {
    this.setData({
      sidebarVisible: !this.data.sidebarVisible
    })
  },

  uploadPersonImage() {
    wx.navigateTo({
      url: '/pages/avatar/avatar'
    })
  },

  selectClothes(event) {
    const item = event.currentTarget.dataset.item
    
    // 🌟 核心修复：生成一个绝对唯一的画板内 ID
    const uniqueBoardId = 'board_' + Date.now() + '_' + Math.floor(Math.random() * 1000)

    const newItem = {
      ...item,
      x: 30 + Math.random() * 30,
      y: 50 + Math.random() * 50,
      scale: 1,
      boardId: uniqueBoardId // 👈 把这个唯一 ID 存进去
    }

    this.setData({
      selectedClothes: [...this.data.selectedClothes, newItem]
    })
  },
  
  onMoveChange(event) {
    if (event.detail.source === 'touch') {
      const index = event.currentTarget.dataset.index
      const { x, y } = event.detail
      this.data.selectedClothes[index].x = x
      this.data.selectedClothes[index].y = y
    }
  },

  onScaleChange(event) {
    const index = event.currentTarget.dataset.index
    const { scale } = event.detail
    this.data.selectedClothes[index].scale = scale
  },

  removeClothes(event) {
    const index = event.currentTarget.dataset.index
    const selectedClothes = [...this.data.selectedClothes]
    const removedItem = selectedClothes[index]
    selectedClothes.splice(index, 1)

    const nextData = { selectedClothes }
    if (removedItem && removedItem.source === 'productTryon') {
      nextData.productTryonItem = null
      this.productTryonItemBackup = null
      wx.removeStorageSync('activeProductTryonItem')
    }

    this.setData(nextData)
  },

  // 获取提交给试穿接口的衣物列表，商品试穿项异常丢失时给出 warning 并使用备份数据
  getSelectedTryonClothes() {
    if (Array.isArray(this.data.selectedClothes) && this.data.selectedClothes.length > 0) {
      return this.data.selectedClothes
    }

    if (this.data.productTryonItem) {
      console.warn('tryon.getSelectedTryonClothes', 'selectedClothes为空，使用商品试穿备份项继续提交', {
        productTryonItem: this.data.productTryonItem
      })
      return [this.data.productTryonItem]
    }

    if (this.productTryonItemBackup) {
      console.warn('tryon.getSelectedTryonClothes', 'selectedClothes和data备份为空，使用实例备份项继续提交', {
        productTryonItemBackup: this.productTryonItemBackup
      })
      return [this.productTryonItemBackup]
    }

    const activeProductTryonItem = wx.getStorageSync('activeProductTryonItem')
    if (activeProductTryonItem) {
      console.warn('tryon.getSelectedTryonClothes', '页面状态为空，使用本地缓存商品试穿项继续提交', {
        activeProductTryonItem
      })
      this.productTryonItemBackup = activeProductTryonItem
      this.setData({
        selectedClothes: [activeProductTryonItem],
        productTryonItem: activeProductTryonItem
      })
      return [activeProductTryonItem]
    }

    return []
  },

  async startAITryOn() {
    const { isGenerating } = this.data
    const selectedClothes = this.getSelectedTryonClothes()
    console.log('准备提交试穿衣物:', selectedClothes)
    if (isGenerating) return
    if (selectedClothes.length === 0) {
      return wx.showToast({ title: '画板上还没有衣服哦', icon: 'none' })
    }

    this.setData({ isGenerating: true })
    wx.showLoading({ title: '正在呼叫专属模特...', mask: true })

    try {
      const userId = app.globalData.currentUserId
      const userRes = await db.collection('users').doc(userId).get()
      const personImageFileID = userRes.data.avatarImage

      if (!personImageFileID) {
        this.setData({ isGenerating: false })
        wx.hideLoading()
        return wx.showToast({ title: '请先点击换模特设置形象', icon: 'none' })
      }

      // 智能区分上下装
      let topGarmentFileID = ''
      let bottomGarmentFileID = ''

      selectedClothes.forEach(item => {
        // 试穿接口必须使用 cloud:// 文件ID，画板展示图可能是 HTTPS 临时链接
        const garmentFileID = item.tryonImageFileID || item.image
        if (item.category === '下装') {
          bottomGarmentFileID = garmentFileID
        } else {
          topGarmentFileID = garmentFileID
        }
      })

      wx.showLoading({ title: 'AI 试穿与抠图中...', mask: true })

      // 呼叫云函数 (阿里试穿 + 百度抠图)
      const aiRes = await wx.cloud.callFunction({
        name: 'aiTryon',
        data: { 
          personImageFileID, 
          topGarmentFileID, 
          bottomGarmentFileID 
        }
      })

      wx.hideLoading()
      this.setData({ isGenerating: false })

      if (aiRes.result.code === 200) {
        const finalImageUrl = aiRes.result.data.result_url

        // 跳转到预览页
        wx.navigateTo({
          url: `/pages/preview/preview?img=${encodeURIComponent(finalImageUrl)}`
        })
        return
      }

      throw new Error(aiRes.result.error || aiRes.result.message || 'AI 接口返回错误')
    } catch (error) {
      wx.hideLoading()
      this.setData({ isGenerating: false })
      console.error('tryon.startAITryOn错误:', error)
      // logError('tryon.startAITryOn', error)
      wx.showToast({ title: error.message || '换装处理失败，请重试', icon: 'none' })
    }
  },

  onSearchInput(event) {
    this.setData({
      searchKeyword: event.detail.value
    })
    this.filterClothes()
  },

  changeSeason(event) {
    const season = event.currentTarget.dataset.season
    this.setData({
      currentSeason: this.data.currentSeason === season ? '' : season
    })
    this.filterClothes()
  },

  changeCategory(event) {
    const category = event.currentTarget.dataset.category
    this.setData({
      currentCategory: this.data.currentCategory === category ? '' : category
    })
    this.filterClothes()
  },

  filterClothes() {
    const filteredClothes = this.getFilteredClothes({
      clothesList: this.data.clothesList,
      searchKeyword: this.data.searchKeyword,
      currentSeason: this.data.currentSeason,
      currentCategory: this.data.currentCategory
    })

    this.setData({ filteredClothes })
  },

  goToSmartRecommend() {
    wx.navigateTo({
      url: '/pages/daily/daily'
    })
  },

  // 根据缓存内容创建商品试穿画板项，兼容历史字符串格式
  buildProductTryonItem(productPayload) {
    if (!productPayload) {
      return null
    }

    let displayImage = ''
    let tryonImageFileID = ''

    if (typeof productPayload === 'string') {
      displayImage = productPayload
      tryonImageFileID = productPayload
    } else if (typeof productPayload === 'object') {
      displayImage = productPayload.displayImage || productPayload.localImagePath || productPayload.cloudFileID || ''
      tryonImageFileID = productPayload.cloudFileID || displayImage
    }

    if (!displayImage) {
      console.warn('tryon.buildProductTryonItem', '商品试穿缓存缺少可展示图片', productPayload)
      return null
    }

    return {
      image: displayImage,
      tryonImageFileID,
      category: '上衣', // 商品试穿默认按上衣处理，后续可扩展商品分类选择
      source: 'productTryon',
      x: 260,
      y: 220,
      scale: 1,
      boardId: 'product_' + Date.now()
    }
  },

  // 自动添加商品图片到画板
  autoAddProductImage() {
    const productPayload = wx.getStorageSync('productImageForTryon')
    console.log('检测商品图片:', productPayload)
    
    const productItem = this.buildProductTryonItem(productPayload)
    if (!productItem) {
      console.log('未检测到商品图片')
      return
    }

    console.log('创建商品图片项:', productItem)
    this.productTryonItemBackup = productItem
    wx.setStorageSync('activeProductTryonItem', productItem)
    
    // 添加到画板
    this.setData({
      sidebarVisible: false,
      selectedClothes: [productItem],
      productTryonItem: productItem
    }, () => {
      console.log('画板数据已更新:', this.data.selectedClothes)
    })
    
    // 清除本地存储，避免重复添加
    wx.removeStorageSync('productImageForTryon')
    
    wx.showToast({
      title: '商品图片已添加到画板',
      icon: 'success',
      duration: 1500
    })
  }
})
