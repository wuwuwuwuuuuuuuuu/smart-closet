const db = wx.cloud.database()
const app = getApp()

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

  // === 🌟 核心升级 1：真实加载我的帖子 ===
  async loadMyPosts() {
    wx.showLoading({ title: '加载中...' })
    try {
      // 假设全局变量里存了用户 ID
      const userId = app.globalData.currentUserId || 'unknown_user'
      
      const res = await db.collection('posts')
        .where({ 
          userId: userId // 仅查询当前用户自己发的帖子
        })
        .orderBy('createTime', 'desc') // 按发布时间倒序
        .get()

      // 数据清洗，适配前端展示格式
      const formattedPosts = res.data.map(item => {
        let dateStr = '刚刚'
        if (item.createTime) {
          const dateObj = new Date(item.createTime)
          const m = String(dateObj.getMonth() + 1).padStart(2, '0')
          const d = String(dateObj.getDate()).padStart(2, '0')
          dateStr = `${dateObj.getFullYear()}-${m}-${d}`
        }

        return {
          id: item._id, // 数据库自带的 _id
          // 🌟 核心修复：多重兼容。优先取 image/coverImage，如果没有则取 images 数组的第一张图
          image: item.image || item.coverImage || (item.images && item.images.length > 0 ? item.images[0] : ''),
          title: item.title || '分享穿搭',
          time: dateStr,
          // 🌟 优化：同时兼容不同的点赞字段名
          likes: item.likes || item.likeCount || 0,
          liked: item.liked || false
        }
      })

      this.setData({
        myPosts: formattedPosts
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
    this.loadMyPosts().then(() => {
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