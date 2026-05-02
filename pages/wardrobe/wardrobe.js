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

// ☁️ 核心改造：完全对齐数据库，并解决电脑端图片空白 Bug
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
    // 1. 获取基础数据
    const res = await db.collection('clothes')
      .where({
        user_id: userId 
      })
      .orderBy('_id', 'desc') 
      .get()

    let rawData = res.data || []

    // 🌟 2. 第一道防线：数据格式清洗防崩溃
    rawData = rawData.map(item => {
      let finalImage = item.image
      if (Array.isArray(item.image) && item.image.length > 0) {
        finalImage = item.image[0]
      } else if (typeof item.image === 'string') {
        finalImage = item.image.trim()
      } else if (item.coverImage) {
        finalImage = Array.isArray(item.coverImage) ? item.coverImage[0] : item.coverImage
      }
      return { ...item, image: finalImage }
    })

    // 🌟 3. 第二道防线：解决电脑端不显示 cloud:// 图片的痛点
    // 提取所有 cloud:// 开头的图片地址
    const fileList = rawData
      .map(item => item.image)
      .filter(img => img && typeof img === 'string' && img.startsWith('cloud://'))

    if (fileList.length > 0) {
      // 批量换取真实的 https:// 临时链接
      const urlRes = await wx.cloud.getTempFileURL({ fileList })
      const urlMap = {}
      
      urlRes.fileList.forEach(file => {
        if (file.fileID && file.tempFileURL) {
          urlMap[file.fileID] = file.tempFileURL
        }
      })

      // 把 https:// 链接替换回数据里，电脑端就能完美识别了！
      rawData = rawData.map(item => ({
        ...item,
        image: urlMap[item.image] || item.image
      }))
    }

    console.log('✅ 云端拉取成功，共', rawData.length, '件私人衣物')

    this.setData({
      allClothes: rawData,
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

  // 标准化搜索文字，避免大小写和首尾空格影响标签匹配
  normalizeSearchText(value) {
    return value === undefined || value === null ? '' : String(value).trim().toLowerCase()
  },

  // 收集衣物可搜索标签，兼容自定义标签、知识库标签和基础分类信息
  collectSearchableTags(item = {}) {
    const tagFields = [
      item.tags,
      item.user_tags,
      item.merged_tags,
      item.retrieval_tags
    ]

    const tagList = tagFields.reduce((result, field) => {
      if (Array.isArray(field)) {
        return result.concat(field)
      }
      return result
    }, [])

    const seasonTags = typeof item.season === 'string'
      ? item.season.split(/[\/,，、\s]+/)
      : []

    return [
      ...tagList,
      item.category,
      ...seasonTags,
      item.material,
      item.brand
    ]
      .filter(tag => tag !== undefined && tag !== null)
      .map(tag => String(tag).trim())
      .filter(Boolean)
  },

  // 判断衣物标签是否命中搜索词，支持自定义标签的模糊匹配
  isTagMatched(item, keyword) {
    const normalizedKeyword = this.normalizeSearchText(keyword)
    if (!normalizedKeyword) {
      return true
    }

    return this.collectSearchableTags(item).some(tag => (
      this.normalizeSearchText(tag).includes(normalizedKeyword)
    ))
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
      
      // 3. 标签关键词搜索
      if (!this.isTagMatched(item, searchKeyword)) {
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

  // 监听搜索框输入，实时按标签刷新衣物列表
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
    this.filterClothes()
  },

  // 清空搜索词并恢复当前季节、分类下的衣物列表
  clearSearch() {
    this.setData({ searchKeyword: '' })
    this.filterClothes()
  }
})
