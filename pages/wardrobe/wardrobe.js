const app = getApp()
const db = wx.cloud.database() // 🌟 引入云数据库

Page({
  data: {
    currentSeason: 'all', 
    currentCategory: 'all',
    searchKeyword: '',
    
    clothesList: [],     // 页面展示用的列表
    allClothes: [],      // 🌟 初始化为空，等待云端数据填充
    isLoading: false     // 加载状态
  },

  onLoad() {
    console.log('我的衣橱页面加载')
  },

  onShow() {
    // 🌟 每次页面显示都重新拉取，确保刚上传的衣服能立刻看到
    this.loadClothesFromCloud()
  },

  // ☁️ 核心改造：从云端数据库抓取属于当前用户的衣服
  async loadClothesFromCloud() {
    const userId = app.globalData.currentUserId
    if (!userId) {
      console.warn('未获取到用户ID，无法加载衣橱')
      return
    }

    this.setData({ isLoading: true })
    wx.showLoading({ title: '正在整理衣橱...' })

    try {
      // 🌟 关键查询：只查 user_id 等于当前登录用户的数据
      const res = await db.collection('clothes')
        .where({ user_id: userId })
        .orderBy('created_at', 'desc') // 按时间倒序，新上传的在前面
        .get()

      console.log('✅ 云端拉取成功，共', res.data.length, '件衣物')

      this.setData({
        allClothes: res.data,
        isLoading: false
      })
      wx.hideLoading()

      // 拉取完立刻执行一次筛选（处理当前选中的季节/分类）
      this.filterClothes()

    } catch (err) {
      this.setData({ isLoading: false })
      wx.hideLoading()
      console.error('❌ 拉取衣橱失败:', err)
      wx.showToast({ title: '加载失败', icon: 'error' })
    }
  },

  // 🔍 筛选逻辑（适配云端的中文字符）
  filterClothes() {
    const { currentSeason, currentCategory, searchKeyword, allClothes } = this.data
    
    let filteredClothes = allClothes.filter(item => {
      // 1. 季节筛选 
      // ⚠️ 注意：你之前的 mock 数据是 'summer'，但 addClothing 存的是 '夏季'
      // 这里做了兼容处理
      const seasonMap = { 'all':'全部', 'spring':'春季', 'summer':'夏季', 'autumn':'秋季', 'winter':'冬季' }
      const targetSeason = seasonMap[currentSeason]
      if (currentSeason !== 'all' && !item.season.includes(targetSeason)) {
        return false
      }
      
      // 2. 分类筛选
      // ⚠️ 同理：'top' 对应 '上衣'
      const categoryMap = { 'all':'全部', 'top':'上衣', 'pants':'下装', 'skirt':'连衣裙', 'coat':'外套' }
      const targetCategory = categoryMap[currentCategory]
      if (currentCategory !== 'all' && item.category !== targetCategory) {
        return false
      }
      
      // 3. 关键词搜索
      if (searchKeyword && !item.name.includes(searchKeyword)) {
        return false
      }
      
      return true
    })
    
    this.setData({
      clothesList: filteredClothes
    })
  },

  // ... (保留你原来的 selectSeason, selectCategory, showSearch 等 UI 交互函数)

  // 跳转到上传页面
  goToUpload() {
    wx.navigateTo({ url: '/pages/uploadClothes/uploadClothes' })
  }
})