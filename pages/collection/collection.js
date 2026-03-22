// 我的收藏页面逻辑
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
  },

  // 加载收藏数据
  loadCollections() {
    // 模拟收藏数据
    const mockCollections = [
      {
        id: 1,
        image: 'https://picsum.photos/400/600?random=51',
        tags: ['正式', '春']
      },
      {
        id: 2,
        image: 'https://picsum.photos/400/600?random=52',
        tags: ['休闲', '夏']
      },
      {
        id: 3,
        image: 'https://picsum.photos/400/600?random=53',
        tags: ['运动', '秋']
      },
      {
        id: 4,
        image: 'https://picsum.photos/400/600?random=54',
        tags: ['约会', '冬']
      },
      {
        id: 5,
        image: 'https://picsum.photos/400/600?random=55',
        tags: ['工作', '春']
      },
      {
        id: 6,
        image: 'https://picsum.photos/400/600?random=56',
        tags: ['日常', '夏']
      }
    ]

    this.setData({
      collections: mockCollections,
      filteredCollections: mockCollections
    })
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

  // 过滤收藏
  filterCollections() {
    const { searchKeyword, collections } = this.data
    
    if (!searchKeyword.trim()) {
      this.setData({
        filteredCollections: collections
      })
      return
    }

    const filtered = collections.filter(item => {
      return item.tags.some(tag => tag.includes(searchKeyword))
    })

    this.setData({
      filteredCollections: filtered
    })
  },

  // 下拉刷新
  onRefresh() {
    this.setData({
      refreshing: true
    })

    setTimeout(() => {
      this.loadCollections()
      this.setData({
        refreshing: false
      })
    }, 800)
  },

  // 跳转到海报页
  goToPoster(e) {
    const item = e.currentTarget.dataset.item
    wx.navigateTo({
      url: `/pages/poster/poster?image=${encodeURIComponent(item.image)}`
    })
  }
})