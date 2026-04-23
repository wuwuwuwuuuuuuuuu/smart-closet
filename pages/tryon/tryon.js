const db = wx.cloud.database()
const app = getApp()
const { logError, logWarning } = require('../../utils/logger')
const {
  matchSelectedClothes,
  buildSuggestedPlacements,
  isValidSmartRecommendEntry
} = require('./tryon.helpers')

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
    isGenerating: false,
    smartRecommendIcon: '/images/smart_recommend_robot_icon.png',
    smartRecommendEntry: null
  },

  onLoad() {
    this.pendingSmartRecommendEntry = null
  },

  onShow() {
    this.pendingSmartRecommendEntry = this.consumePendingSmartRecommendEntry()
    this.loadRealClothes()
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
      logError('tryon.loadRealClothes', error)
    }
  },

  consumePendingSmartRecommendEntry() {
    try {
      const entry = wx.getStorageSync('smartRecommendTryonEntry')
      if (!isValidSmartRecommendEntry(entry) || entry.active !== true) {
        if (entry && entry.active === true) {
          logWarning('tryon.consumePendingSmartRecommendEntry', 'invalid or expired entry ignored')
        }
        this.setData({ smartRecommendEntry: null })
        return null
      }

      const consumedEntry = {
        ...entry,
        active: false
      }
      wx.setStorageSync('smartRecommendTryonEntry', consumedEntry)
      return consumedEntry
    } catch (error) {
      logError('tryon.consumePendingSmartRecommendEntry', error)
      return null
    }
  },

  applySmartRecommendEntryIfNeeded(clothesList) {
    const entry = this.pendingSmartRecommendEntry
    if (!entry) {
      this.setData({ smartRecommendEntry: null })
      return
    }

    const matchedClothes = matchSelectedClothes(entry.selectedClothesIds || [], clothesList)
    const placedClothes = buildSuggestedPlacements(matchedClothes)

    if ((entry.selectedClothesIds || []).length > 0 && matchedClothes.length === 0) {
      logWarning('tryon.applySmartRecommendEntryIfNeeded', 'no recommended clothes matched current wardrobe', {
        selectedClothesIds: entry.selectedClothesIds
      })
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
    selectedClothes.splice(index, 1)
    this.setData({ selectedClothes })
  },

  async startAITryOn() {
    const { selectedClothes, isGenerating } = this.data
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

      // 🌟 核心升级：遍历画板上的衣服，智能区分上下装
      let topGarmentFileID = ''
      let bottomGarmentFileID = ''

      selectedClothes.forEach(item => {
        if (item.category === '下装') {
          bottomGarmentFileID = item.image
        } else {
          // 上衣、外套、连衣裙，或者没有录入分类的，默认按上装传给模型
          topGarmentFileID = item.image
        }
      })

      wx.showLoading({ title: 'AI 试穿中...', mask: true })

      // 🌟 将区分好的上下装同时发给云函数
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
        wx.navigateTo({
          url: `/pages/preview/preview?img=${encodeURIComponent(finalImageUrl)}`
        })
        return
      }

      throw new Error(aiRes.result.message || 'AI 接口返回错误')
    } catch (error) {
      wx.hideLoading()
      this.setData({ isGenerating: false })
      logError('tryon.startAITryOn', error)
      wx.showToast({ title: '换装失败，请重试', icon: 'none' })
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
  }
})
