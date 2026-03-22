// 社区页面逻辑
Page({
  data: {
    postList: [],
    refreshing: false,
    loadingMore: false,
    noMoreData: false,
    page: 1,
    pageSize: 10
  },

  onLoad() {
    console.log('社区页加载')
    this.loadPosts()
  },

  onShow() {
    console.log('社区页显示')
  },

  // 加载帖子列表
  loadPosts(refresh = false) {
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

    // 模拟数据
    const mockPosts = this.generateMockPosts(this.data.page, this.data.pageSize)
    
    setTimeout(() => {
      if (refresh) {
        this.setData({
          postList: mockPosts,
          refreshing: false,
          noMoreData: false
        })
      } else {
        this.setData({
          postList: [...this.data.postList, ...mockPosts],
          loadingMore: false,
          noMoreData: mockPosts.length < this.data.pageSize
        })
      }
    }, 500)
  },

  // 生成模拟帖子数据
  generateMockPosts(page, pageSize) {
    const posts = []
    const startIndex = (page - 1) * pageSize + 1
    
    for (let i = 0; i < pageSize; i++) {
      posts.push({
        id: startIndex + i,
        image: `https://picsum.photos/400/600?random=${startIndex + i}`,
        title: `时尚穿搭 ${startIndex + i}`,
        author: `用户${startIndex + i}`,
        likes: Math.floor(Math.random() * 100),
        liked: Math.random() > 0.5
      })
    }
    
    return posts
  },

  // 下拉刷新
  onRefresh() {
    this.loadPosts(true)
  },

  // 上拉加载更多
  onLoadMore() {
    if (this.data.loadingMore || this.data.noMoreData) {
      return
    }
    
    this.setData({
      page: this.data.page + 1
    })
    this.loadPosts()
  },

  // 跳转到帖子详情
  goToPostDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/postDetail/postDetail?id=${id}`
    })
  },

  // 跳转到编辑帖子页
  goToPostEdit() {
    wx.navigateTo({
      url: '/pages/postEdit/postEdit'
    })
  }
})