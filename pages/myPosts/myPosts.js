const db = wx.cloud.database()

Page({
  data: {
    activeTab: 'posts',
    tabs: [
      { key: 'posts', label: '帖子' },
      { key: 'collections', label: '收藏' },
      { key: 'liked', label: '赞过' }
    ],
    myPosts: [],
    collectedPosts: [],
    likedPosts: [],
    currentPosts: [],
    emptyText: '暂无发布的帖子',
    emptyHint: '快去发布你的穿搭吧！',
    refreshing: false,
    showOptionsModal: false,
    selectedPostIndex: -1
  },

  onLoad() {
    console.log('我的帖子页加载')
    this.loadAllPostTabs()
  },

  onShow() {
    console.log('我的帖子页显示')
  },

  // 根据当前分栏刷新页面展示列表
  updateCurrentPosts() {
    const tabMap = {
      posts: {
        list: this.data.myPosts,
        emptyText: '暂无发布的帖子',
        emptyHint: '快去发布你的穿搭吧！'
      },
      collections: {
        list: this.data.collectedPosts,
        emptyText: '暂无收藏的帖子',
        emptyHint: '看到喜欢的穿搭可以先收藏起来'
      },
      liked: {
        list: this.data.likedPosts,
        emptyText: '暂无赞过的帖子',
        emptyHint: '给喜欢的内容点个赞吧'
      }
    }

    const current = tabMap[this.data.activeTab] || tabMap.posts
    this.setData({
      currentPosts: current.list,
      emptyText: current.emptyText,
      emptyHint: current.emptyHint
    })
  },

  // 切换帖子、收藏、赞过三个内容分栏
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (!tab || tab === this.data.activeTab) return

    this.setData({
      activeTab: tab,
      showOptionsModal: false,
      selectedPostIndex: -1
    }, () => {
      this.updateCurrentPosts()
    })
  },

  // 加载当前用户发布、收藏、赞过的全部帖子分栏数据
  async loadAllPostTabs() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMyPostTabs'
      })

      if (!res.result || res.result.code !== 200) {
        throw new Error((res.result && res.result.message) || '获取我的帖子分栏失败')
      }

      const data = res.result.data || {}
      ;(data.warnings || []).forEach(warning => {
        console.warn('myPosts.loadAllPostTabs', warning.type || 'warning', warning)
      })

      this.setData({
        myPosts: data.myPosts || [],
        collectedPosts: data.collectedPosts || [],
        likedPosts: data.likedPosts || []
      }, () => {
        this.updateCurrentPosts()
      })
      wx.hideLoading()

    } catch (error) {
      console.error('加载帖子失败:', error)
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 下拉刷新
  onRefresh() {
    this.setData({ refreshing: true })
    // 重新拉取数据
    this.loadAllPostTabs().then(() => {
      this.setData({ refreshing: false })
    })
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
    if (this.data.activeTab !== 'posts') {
      return
    }

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
    // 跳转到发布页，并带上帖子 id 进行回显
    wx.navigateTo({
      url: `/pages/publish/publish?editId=${post.id}`
    })
    
    this.hideOptionsModal()
  },

  // 删除帖子
  deletePost() {
    const { selectedPostIndex } = this.data
    if (selectedPostIndex === -1) return

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条帖子吗？',
      confirmColor: '#e64340', // 红色警告色
      success: (res) => {
        if (res.confirm) {
          this.confirmDelete()
        }
      }
    })
  },

  // === 🌟 核心升级 2：真实删除云端数据 ===
  async confirmDelete() {
    const { selectedPostIndex, myPosts } = this.data
    const postToDelete = myPosts[selectedPostIndex]
    
    wx.showLoading({ title: '删除中...', mask: true })

    try {
      // 1. 从云数据库中删除记录
      await db.collection('posts').doc(postToDelete.id).remove()

      // 2. 本地 UI 静默更新 (直接从数组里剔除，不用重新请求数据库，体验更丝滑)
      const newPosts = [...myPosts]
      newPosts.splice(selectedPostIndex, 1)
      
      this.setData({
        myPosts: newPosts
      })
      
      wx.hideLoading()
      wx.showToast({ title: '删除成功', icon: 'success' })
      this.hideOptionsModal()

    } catch (error) {
      console.error('删除帖子失败:', error)
      wx.hideLoading()
      wx.showToast({ title: '删除失败，请重试', icon: 'none' })
    }
  }
})
