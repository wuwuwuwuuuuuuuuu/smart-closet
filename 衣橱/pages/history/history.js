// 生成历史页面逻辑
Page({
  data: {
    historyList: [],
    refreshing: false,
    loadingMore: false,
    noMoreData: false,
    page: 1,
    pageSize: 10,
    isSelectionMode: false // 是否在选择模式下
  },

  onLoad(options) {
    console.log('生成历史页加载', options)
    
    // 检查是否从穿搭日记页面进入（选择模式）
    if (options.from === 'daily') {
      this.setData({
        isSelectionMode: true
      })
      console.log('进入选择模式')
    }
    
    this.loadHistory()
  },

  onShow() {
    console.log('生成历史页显示')
  },

  // 加载历史数据
  loadHistory(refresh = false) {
    if (refresh) {
      this.setData({
        refreshing: true,
        page: 1
      })
    } else {
      this.setData({
        loadingMore: true
      })
    }

    // 模拟历史数据
    const mockHistory = this.generateMockHistory(this.data.page, this.data.pageSize)
    
    setTimeout(() => {
      if (refresh) {
        this.setData({
          historyList: mockHistory,
          refreshing: false,
          noMoreData: false
        })
      } else {
        this.setData({
          historyList: [...this.data.historyList, ...mockHistory],
          loadingMore: false,
          noMoreData: mockHistory.length < this.data.pageSize
        })
      }
    }, 500)
  },

  // 生成模拟历史数据
  generateMockHistory(page, pageSize) {
    const history = []
    const startIndex = (page - 1) * pageSize + 1
    
    const dates = [
      '2024-03-17',
      '2024-03-16',
      '2024-03-15',
      '2024-03-14',
      '2024-03-13',
      '2024-03-12',
      '2024-03-11',
      '2024-03-10',
      '2024-03-09',
      '2024-03-08'
    ]
    
    for (let i = 0; i < pageSize; i++) {
      const dateIndex = (startIndex + i - 1) % dates.length
      history.push({
        id: startIndex + i,
        image: `https://picsum.photos/400/600?random=${startIndex + i + 60}`,
        date: dates[dateIndex],
        selected: false // 初始状态为未选择
      })
    }
    
    return history
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 下拉刷新
  onRefresh() {
    this.loadHistory(true)
  },

  // 上拉加载更多
  onLoadMore() {
    if (this.data.loadingMore || this.data.noMoreData) {
      return
    }
    
    this.setData({
      page: this.data.page + 1
    })
    this.loadHistory()
  },

  // 处理海报选择
  goToPoster(e) {
    const item = e.currentTarget.dataset.item
    
    if (this.data.isSelectionMode) {
      // 选择模式：选择海报并返回
      this.selectPoster(item)
    } else {
      // 普通模式：查看海报详情
      this.viewPoster(item)
    }
  },

  // 选择海报（选择模式）
  selectPoster(item) {
    // 更新选择状态
    const historyList = this.data.historyList.map(poster => ({
      ...poster,
      selected: poster.id === item.id
    }))
    
    this.setData({
      historyList: historyList
    })
    
    // 将选中的海报数据存储到本地
    wx.setStorageSync('selectedPoster', item)
    
    // 延迟返回，让用户看到选择效果
    setTimeout(() => {
      // 返回到每日穿搭页面
      wx.navigateBack({
        delta: 1
      })
      
      // 显示选择成功提示
      wx.showToast({
        title: '海报已选择',
        icon: 'success'
      })
    }, 300)
  },

  // 查看海报详情（普通模式）
  viewPoster(item) {
    wx.navigateTo({
      url: `/pages/poster/poster?image=${encodeURIComponent(item.image)}`
    })
  }
})