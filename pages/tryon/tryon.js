const db = wx.cloud.database()
const app = getApp()
const { logError, logWarning } = require('../../utils/logger')
const {
  matchSelectedClothes,
  buildSuggestedPlacements,
  isValidSmartReminderEntry
} = require('./tryon.helpers')

Page({
  data: {
    sidebarVisible: true, // 默认打开侧边栏
    searchKeyword: '',
    currentSeason: '', 
    currentCategory: '', 
    seasons: ['春', '夏', '秋', '冬'],
    categories: ['上衣', '下装', '配饰', '鞋子', '外套', '连体衣'], 
    
    clothesList: [], 
    filteredClothes: [], 
    selectedClothes: [], // 可以存多件衣服，用于画板搭配
    
    personImage: '',
    isGenerating: false,
    smartReminderEntry: null,
    smartRecommendIcon: '/images/smart_recommend_robot_icon.png'
  },

  onLoad(options) {
    this.pendingReminderSource = options.source || ''
    this.hasAppliedSmartReminderEntry = false
  },

  onShow() {
    this.hasAppliedSmartReminderEntry = false
    const entry = this.consumePendingSmartReminderEntry()
    this.pendingReminderSource = entry ? 'smartReminder' : ''
    this.pendingSmartReminderEntry = entry
    if (!entry) {
      this.setData({ smartReminderEntry: null })
    }
    this.loadRealClothes()
  },

  // ☁️ 1. 从云数据库拉取“当前用户”的真实衣服
  async loadRealClothes() {
    wx.showLoading({ title: '加载私人衣橱...' })
    try {
      // 🌟 核心防御：获取当前登录用户的真实 ID
      const userId = app.globalData.currentUserId 
      
      if (!userId) {
        logWarning('tryon.loadRealClothes', 'missing current user id')
        this.setData({ clothesList: [], filteredClothes: [] })
        wx.hideLoading()
        return
      }

      // 🌟 终极修复：使用全小写的 user_id 进行严格的数据隔离
      const res = await db.collection('clothes')
        .where({ 
          user_id: userId // 👈 已经完美修正为小写！
        })
        .orderBy('created_at', 'desc')
        .get()
      
      const cleanData = res.data.map(item => ({
        ...item,
        image: item.image ? item.image.trim() : item.image
      }))

      this.setData({
        clothesList: cleanData
      })
      this.filterClothes()
      this.applySmartReminderEntryIfNeeded(cleanData)
      wx.hideLoading()
    } catch (err) {
      logError('tryon.loadRealClothes', err)
      wx.hideLoading()
    }
  },

  applySmartReminderEntryIfNeeded(clothesList) {
    if (this.pendingReminderSource !== 'smartReminder' || this.hasAppliedSmartReminderEntry) {
      return
    }

    try {
      const entry = this.pendingSmartReminderEntry
      if (!entry) {
        logWarning('tryon.applySmartReminderEntryIfNeeded', 'entry missing or expired')
        return
      }

      const matched = matchSelectedClothes(entry.selectedClothesIds || [], clothesList)
      const selectedClothes = buildSuggestedPlacements(matched)

      if ((entry.selectedClothesIds || []).length && !matched.length) {
        logWarning('tryon.applySmartReminderEntryIfNeeded', 'no matched clothes found', {
          selectedClothesIds: entry.selectedClothesIds
        })
      }

      this.setData({
        smartReminderEntry: entry,
        selectedClothes
      })
      this.hasAppliedSmartReminderEntry = true
    } catch (error) {
      logError('tryon.applySmartReminderEntryIfNeeded', error)
    }
  },

  getValidSmartReminderEntry() {
    const entry = wx.getStorageSync('smartReminderTryonEntry')
    if (!isValidSmartReminderEntry(entry)) {
      return null
    }
    return entry
  },

  consumePendingSmartReminderEntry() {
    const entry = this.getValidSmartReminderEntry()
    if (!entry || entry.active !== true) {
      return null
    }

    const consumedEntry = {
      ...entry,
      active: false
    }
    wx.setStorageSync('smartReminderTryonEntry', consumedEntry)
    return consumedEntry
  },

  // 🌟 侧边栏收缩/展开切换
  toggleSidebar() {
    this.setData({ sidebarVisible: !this.data.sidebarVisible })
  },

  addClothes() {
    wx.showToast({
      title: '请从左侧衣橱选择衣物',
      icon: 'none'
    })
  },

  goToSmartRecommend() {
    wx.navigateTo({
      url: '/pages/daily/daily'
    })
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
      logError('tryon.startAITryOn', err)
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
