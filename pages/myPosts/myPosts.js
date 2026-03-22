// 我的帖子页面逻辑
Page({
  data: {
    myPosts: [],
    refreshing: false,
    showOptionsModal: false,
    selectedPostIndex: -1
  },

  onLoad() {
    console.log('我的帖子页加载')
    this.loadMyPosts()
  },

  onShow() {
    console.log('我的帖子页显示')
  },

  // 加载我的帖子
  loadMyPosts() {
    // 模拟我的帖子数据
    const mockMyPosts = [
      {
        id: 1,
        image: 'https://picsum.photos/400/600?random=71',
        title: '春季休闲穿搭',
        time: '2024-03-17',
        likes: 15,
        liked: true
      },
      {
        id: 2,
        image: 'https://picsum.photos/400/600?random=72',
        title: '职场通勤搭配',
        time: '2024-03-16',
        likes: 8,
        liked: false
      },
      {
        id: 3,
        image: 'https://picsum.photos/400/600?random=73',
        title: '周末出游装扮',
        time: '2024-03-15',
        likes: 12,
        liked: true
      }
    ]

    this.setData({
      myPosts: mockMyPosts
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 下拉刷新
  onRefresh() {
    this.setData({
      refreshing: true
    })

    setTimeout(() => {
      this.loadMyPosts()
      this.setData({
        refreshing: false
      })
    }, 800)
  },

  // 跳转到帖子详情
  goToPostDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/postDetail/postDetail?id=${id}`
    })
  },

  // 显示帖子操作选项
  showPostOptions(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      showOptionsModal: true,
      selectedPostIndex: index
    })
  },

  // 隐藏操作弹窗
  hideOptionsModal() {
    this.setData({
      showOptionsModal: false,
      selectedPostIndex: -1
    })
  },

  // 编辑帖子
  editPost() {
    const { selectedPostIndex, myPosts } = this.data
    if (selectedPostIndex === -1) return

    const post = myPosts[selectedPostIndex]
    wx.showToast({
      title: '编辑帖子功能',
      icon: 'none'
    })
    
    this.hideOptionsModal()
  },

  // 删除帖子
  deletePost() {
    const { selectedPostIndex, myPosts } = this.data
    if (selectedPostIndex === -1) return

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条帖子吗？',
      success: (res) => {
        if (res.confirm) {
          this.confirmDelete()
        }
      }
    })
  },

  // 确认删除
  confirmDelete() {
    const { selectedPostIndex, myPosts } = this.data
    
    wx.showLoading({
      title: '删除中...'
    })

    setTimeout(() => {
      const newPosts = [...myPosts]
      newPosts.splice(selectedPostIndex, 1)
      
      this.setData({
        myPosts: newPosts
      })
      
      wx.hideLoading()
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })
      
      this.hideOptionsModal()
    }, 800)
  }
})