// 试穿主界面逻辑
Page({
  data: {
    sidebarVisible: false,
    searchKeyword: '',
    currentSeason: '春',
    currentCategory: 1,
    seasons: ['春', '夏', '秋', '冬'],
    categories: [
      { id: 1, name: '上衣' },
      { id: 2, name: '下装' },
      { id: 3, name: '配饰' },
      { id: 4, name: '鞋子' },
      { id: 5, name: '外套' }
    ],
    clothesList: [
      { id: 1, image: 'https://picsum.photos/200/200?random=1', season: '春', category: 1 },
      { id: 2, image: 'https://picsum.photos/200/200?random=2', season: '春', category: 1 },
      { id: 3, image: 'https://picsum.photos/200/200?random=3', season: '夏', category: 2 },
      { id: 4, image: 'https://picsum.photos/200/200?random=4', season: '夏', category: 2 },
      { id: 5, image: 'https://picsum.photos/200/200?random=5', season: '秋', category: 3 },
      { id: 6, image: 'https://picsum.photos/200/200?random=6', season: '秋', category: 3 }
    ],
    selectedClothes: []
  },

  onLoad() {
    console.log('试穿页加载')
    this.filterClothes()
  },

  onShow() {
    console.log('试穿页显示')
  },

  // 切换侧边栏
  toggleSidebar() {
    this.setData({
      sidebarVisible: !this.data.sidebarVisible
    })
  },

  // 添加衣物
  addClothes() {
    wx.navigateTo({
      url: '/pages/uploadClothes/uploadClothes'
    })
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
    this.filterClothes()
  },

  // 切换季节
  changeSeason(e) {
    const season = e.currentTarget.dataset.season
    this.setData({
      currentSeason: season
    })
    this.filterClothes()
  },

  // 切换分类
  changeCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      currentCategory: category
    })
    this.filterClothes()
  },

  // 过滤衣物列表
  filterClothes() {
    const { searchKeyword, currentSeason, currentCategory, clothesList } = this.data
    
    let filtered = clothesList.filter(item => {
      // 季节过滤
      if (currentSeason && item.season !== currentSeason) {
        return false
      }
      // 分类过滤
      if (currentCategory && item.category !== currentCategory) {
        return false
      }
      // 搜索过滤（这里简单实现，实际需要根据衣物名称搜索）
      if (searchKeyword) {
        // 模拟搜索逻辑
        return item.id.toString().includes(searchKeyword)
      }
      return true
    })

    this.setData({
      filteredClothes: filtered
    })
  },

  // 选择衣物
  selectClothes(e) {
    const item = e.currentTarget.dataset.item
    const newItem = {
      ...item,
      x: 100,
      y: 100
    }
    
    this.setData({
      selectedClothes: [...this.data.selectedClothes, newItem]
    })
  },

  // 移动衣物
  onMoveChange(e) {
    const index = e.currentTarget.dataset.index
    const { x, y } = e.detail
    
    const selectedClothes = [...this.data.selectedClothes]
    selectedClothes[index] = {
      ...selectedClothes[index],
      x: x,
      y: y
    }
    
    this.setData({
      selectedClothes: selectedClothes
    })
  },

  // 移除衣物
  removeClothes(e) {
    const index = e.currentTarget.dataset.index
    const selectedClothes = [...this.data.selectedClothes]
    selectedClothes.splice(index, 1)
    
    this.setData({
      selectedClothes: selectedClothes
    })
  },

  // 跳转到预览页
  goToPreview() {
    if (this.data.selectedClothes.length === 0) {
      wx.showToast({
        title: '请先选择衣物',
        icon: 'none'
      })
      return
    }
    
    wx.navigateTo({
      url: '/pages/preview/preview'
    })
  }
})