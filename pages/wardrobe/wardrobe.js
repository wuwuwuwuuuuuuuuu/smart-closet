const app = getApp()
const db = wx.cloud.database() // 🌟 引入云数据库

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
    // 🌟 每次页面显示都重新拉取，确保刚上传的衣服能立刻看到
    this.loadClothesFromCloud()
  },

  // ☁️ 核心改造：完全对齐数据库里的 user_id 字段
  async loadClothesFromCloud() {
    const userId = app.globalData.currentUserId
    if (!userId) {
      console.warn('未获取到用户ID，无法加载衣橱')
      return
    }

    this.setData({ isLoading: true })
    wx.showLoading({ title: '正在打开衣橱...' })

    try {
      // 🌟 破案核心：按照你的数据库截图，用 user_id 来查！
      const res = await db.collection('clothes')
        .where({
          user_id: userId 
        })
        .orderBy('_id', 'desc') // 依然用 _id 倒序，防止没建索引报错
        .get()

      console.log('✅ 云端拉取成功，共', res.data.length, '件衣物')

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
  // 🔍 筛选逻辑（杀手3解决：完美适配云端的中文字符）
  filterClothes() {
    const { currentSeason, currentCategory, searchKeyword, allClothes } = this.data
    
    let filteredClothes = allClothes.filter(item => {
      // 1. 季节精准对齐：数据库存的是 '春'，不是 '春季'
      const seasonMap = { 'all':'全部', 'spring':'春', 'summer':'夏', 'autumn':'秋', 'winter':'冬' }
      const targetSeason = seasonMap[currentSeason]
      if (currentSeason !== 'all' && (!item.season || !item.season.includes(targetSeason))) {
        return false
      }
      
      // 2. 分类精准对齐：将侧边栏的词映射到数据库存的词（['上衣', '下装', '外套', '连衣裙', '配饰', '鞋包']）
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

  // ================= 以下是 UI 交互相关的函数 =================
  
  // 切换季节
  selectSeason(e) {
    this.setData({ currentSeason: e.currentTarget.dataset.season })
    this.filterClothes()
  },

  // 切换分类
  selectCategory(e) {
    this.setData({ currentCategory: e.currentTarget.dataset.category })
    this.filterClothes()
  },

  // 点击衣服查看详情（预留接口）
 onClothesTap(e) {
    const index = e.currentTarget.dataset.index
    const clothes = this.data.clothesList[index]
    
    // 🌟 核心：带着这件衣服在云数据库里的 _id 跳转
    wx.navigateTo({
      url: `/pages/clothesDetail/clothesDetail?id=${clothes._id}`
    })
  },

  // 跳转到上传页面
  goToUpload() {
    wx.navigateTo({ url: '/pages/uploadClothes/uploadClothes' })
  },

  // 搜索相关（防错处理）
  showSearch() {
    wx.showToast({ title: '搜索功能开发中', icon: 'none' })
  },
  clearSearch() {
    this.setData({ searchKeyword: '' })
    this.filterClothes()
  }
})