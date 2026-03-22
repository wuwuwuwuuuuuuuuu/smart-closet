/**
 * 我的衣橱页面逻辑
 * 功能：衣物分类管理、搜索筛选、添加衣物
 * 数据流向：本地存储 → 页面数据 → 筛选展示
 * 后端接口预留：衣物CRUD、图片上传、分类管理
 */
Page({
  data: {
    // 筛选条件
    currentSeason: 'all',      // 当前季节筛选：all|spring|summer|autumn|winter
    currentCategory: 'all',    // 当前分类筛选：all|top|pants|skirt|coat|hat|shoes|accessory
    searchKeyword: '',         // 搜索关键词
    
    // 展示数据
    clothesList: [],           // 筛选后的衣物列表（用于页面展示）
    
    // 原始数据（后端接口替换位置）
    allClothes: [
      // TODO: 替换为后端接口数据
      // 数据结构说明：
      // id: 唯一标识（后端生成）
      // name: 衣物名称
      // image: 图片URL（云存储路径）
      // season: 适用季节
      // category: 衣物分类
      // tags: 标签数组
      {
        id: 1,
        name: '白色T恤',
        image: 'cloud://cloudbase-2gvrvh4ve926f3d8.636c-cloudbase-2gvrvh4ve926f3d8-1411253050/clothing-images/images/img47.png',
        season: 'summer',
        category: 'top',
        tags: ['休闲', '百搭']
      },
      {
        id: 2,
        name: '牛仔裤',
        image: 'cloud://cloudbase-2gvrvh4ve926f3d8.636c-cloudbase-2gvrvh4ve926f3d8-1411253050/clothing-images/images/img48.png',
        season: 'all',
        category: 'pants',
        tags: ['休闲', '经典']
      },
      {
        id: 3,
        name: '连衣裙',
        image: 'cloud://cloudbase-2gvrvh4ve926f3d8.636c-cloudbase-2gvrvh4ve926f3d8-1411253050/clothing-images/images/img49.png',
        season: 'spring',
        category: 'skirt',
        tags: ['优雅', '约会']
      },
      {
        id: 4,
        name: '羽绒服',
        image: 'cloud://cloudbase-2gvrvh4ve926f3d8.636c-cloudbase-2gvrvh4ve926f3d8-1411253050/clothing-images/images/img50.png',
        season: 'winter',
        category: 'coat',
        tags: ['保暖', '冬季']
      }
    ]
  },

  onLoad(options) {
    console.log('我的衣橱页面加载')
    // 从本地存储加载衣物数据
    this.loadClothesData()
    // 初始化筛选
    this.filterClothes()
  },

  onShow() {
    // 页面显示时重新加载数据（可能从上传页面返回）
    this.loadClothesData()
    this.filterClothes()
  },

  // 从本地存储加载衣物数据
  loadClothesData() {
    const storedClothes = wx.getStorageSync('wardrobeClothes')
    if (storedClothes && storedClothes.length > 0) {
      this.setData({
        allClothes: storedClothes
      })
    }
  },

  // 显示搜索框
  showSearch() {
    wx.showModal({
      title: '搜索衣物',
      content: '请输入衣物名称关键词',
      editable: true,
      placeholderText: '例如：T恤、牛仔裤',
      confirmText: '搜索',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm && res.content) {
          this.setData({
            searchKeyword: res.content
          })
          this.filterClothes()
        }
      }
    })
  },

  // 选择季节
  selectSeason(e) {
    const season = e.currentTarget.dataset.season
    console.log('选择季节:', season)
    this.setData({
      currentSeason: season
    })
    this.filterClothes()
  },

  // 选择分类
  selectCategory(e) {
    const category = e.currentTarget.dataset.category
    console.log('选择分类:', category)
    this.setData({
      currentCategory: category
    })
    this.filterClothes()
  },

  // 筛选衣物
  filterClothes() {
    const { currentSeason, currentCategory, searchKeyword, allClothes } = this.data
    
    let filteredClothes = allClothes.filter(item => {
      // 季节筛选
      if (currentSeason !== 'all' && item.season !== 'all' && item.season !== currentSeason) {
        return false
      }
      
      // 分类筛选
      if (currentCategory !== 'all' && item.category !== currentCategory) {
        return false
      }
      
      // 关键词搜索
      if (searchKeyword && !item.name.includes(searchKeyword)) {
        return false
      }
      
      return true
    })
    
    this.setData({
      clothesList: filteredClothes
    })
    
    console.log('筛选结果:', filteredClothes.length, '件衣物')
  },

  // 跳转到上传页面
  goToUpload() {
    wx.navigateTo({
      url: '/pages/uploadClothes/uploadClothes'
    })
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      searchKeyword: ''
    })
    this.filterClothes()
  },

  // 衣物点击事件（可扩展为查看详情）
  onClothesTap(e) {
    const index = e.currentTarget.dataset.index
    const clothes = this.data.clothesList[index]
    console.log('点击衣物:', clothes.name)
    
    // 可以扩展为查看衣物详情
    wx.showToast({
      title: `查看${clothes.name}`,
      icon: 'none'
    })
  }
})