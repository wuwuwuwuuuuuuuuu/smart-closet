const app = getApp()
const db = wx.cloud.database() 

Page({
  data: {
    currentSeason: 'all', 
    currentCategory: 'all',
    searchKeyword: '',
    
    clothesList: [],     // 页面展示用的列表
    allClothes: [],      // 等待云端数据填充
    isLoading: false     // 加载状态
  },

  onLoad() {
    console.log('我的衣橱页面加载')
  },

  onShow() {
    // 🌟 每次显示都重新拉取，确保刚上传的衣服能立刻看到
    this.loadClothesFromCloud()
  },

  // ☁️ 核心改造：完全对齐数据库里的 user_id 字段
  async loadClothesFromCloud() {
    const userId = app.globalData.currentUserId
    if (!userId) {
      console.warn('未获取到用户ID，无法加载私人衣橱')
      this.setData({ clothesList: [], allClothes: [] }) // 没登录就清空
      return
    }

    this.setData({ isLoading: true })
    wx.showLoading({ title: '正在打开私人衣橱...' })

    try {
      // 🌟 绝对安全的专属查询
      const res = await db.collection('clothes')
        .where({
          user_id: userId // 👈 完美对齐云端小写带下划线的字段
        })
        .orderBy('_id', 'desc') 
        .get()

      console.log('✅ 云端拉取成功，共', res.data.length, '件私人衣物')

      this.setData({
        allClothes: res.data,
        isLoading: false
      })
      wx.hideLoading()

      // 拉取完立刻执行一次筛选
      this.filterClothes()

    } catch (err) {
      this.setData({ isLoading: false })
      wx.hideLoading()
      console.error('❌ 拉取衣橱失败:', err)
      wx.showToast({ title: '加载失败，请检查网络', icon: 'error' })
    }
  },

  // 🔍 筛选逻辑（包含容错防御）
  filterClothes() {
    const { currentSeason, currentCategory, searchKeyword, allClothes } = this.data
    
    let filteredClothes = allClothes.filter(item => {
      // 1. 季节精准对齐
      const seasonMap = { 'all':'全部', 'spring':'春', 'summer':'夏', 'autumn':'秋', 'winter':'冬' }
      const targetSeason = seasonMap[currentSeason]
      // 加上 item.season 存在性校验，防止旧脏数据导致程序崩溃
      if (currentSeason !== 'all' && (!item.season || !item.season.includes(targetSeason))) {
        return false
      }
      
      // 2. 分类精准对齐
      const categoryMap = { 
        'all': '全部', 
        'top': '上衣', 
        'pants': '下装', 
        'skirt': '连衣裙', 
        'coat': '外套',
        'hat': '配饰',
        'shoes': '鞋包',
        'accessory': '配饰'
      }
      const targetCategory = categoryMap[currentCategory]
      if (currentCategory !== 'all' && item.category !== targetCategory) {
        return false
      }
      
      // 3. 关键词搜索
      if (searchKeyword && (!item.name || !item.name.includes(searchKeyword))) {
        return false
      }
      
      return true
    })
    
    this.setData({
      clothesList: filteredClothes
    })
  },

  // ================= UI 交互相关的函数 =================
  
  selectSeason(e) {
    this.setData({ currentSeason: e.currentTarget.dataset.season })
    this.filterClothes()
  },

  selectCategory(e) {
    this.setData({ currentCategory: e.currentTarget.dataset.category })
    this.filterClothes()
  },

  onClothesTap(e) {
    const index = e.currentTarget.dataset.index
    const clothes = this.data.clothesList[index]
    
    wx.navigateTo({
      url: `/pages/clothesDetail/clothesDetail?id=${clothes._id}`
    })
  },

  goToUpload() {
    wx.navigateTo({ url: '/pages/uploadClothes/uploadClothes' })
  },

  showSearch() {
    wx.showToast({ title: '搜索功能开发中', icon: 'none' })
  },

  clearSearch() {
    this.setData({ searchKeyword: '' })
    this.filterClothes()
  }
})