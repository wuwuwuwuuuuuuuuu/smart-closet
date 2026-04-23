const app = getApp()

Page({
  data: {
    postList: [],
    refreshing: false,
    loadingMore: false,
    noMoreData: false
  },

  onLoad() {
    console.log('社区页加载')
    this.loadPosts()
  },

  onShow() {
    console.log('社区页显示')
    this.loadPosts()
  },

  loadPosts(refresh = false) {
    if (refresh) {
      this.setData({ refreshing: true })
    } else {
      this.setData({ loadingMore: true })
    }

    wx.cloud.callFunction({
      name: 'getForumList'
    }).then(res => {
      console.log('获取帖子列表成功:', res)
      if (res.result && res.result.code === 200) {
        const posts = res.result.data.map(item => ({
          id: item._id,
          image: item.image || '',
          title: item.title || '',
          content: item.content || '',
          author: item.author || '用户',
          avatar: item.avatar || '',
          likes: item.likes || 0,
          liked: item.liked || false,
          createTime: item.createTime
        }))

        this.setData({
          postList: posts,
          refreshing: false,
          loadingMore: false,
          noMoreData: true
        })
      } else {
        this.setData({ refreshing: false, loadingMore: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    }).catch(err => {
      console.error('获取帖子列表失败:', err)
      this.setData({ refreshing: false, loadingMore: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  onRefresh() {
    this.loadPosts(true)
  },

  onLoadMore() {
    // 暂无分页，数据已全部加载
  },

  goToPostDetail(e) {
    const id = e.currentTarget.dataset.id
    const post = this.data.postList.find(item => item.id === id)
    const postData = encodeURIComponent(JSON.stringify(post))
    wx.navigateTo({
      url: `/pages/postDetail/postDetail?id=${id}&postData=${postData}`
    })
  },

  goToPostEdit() {
    wx.navigateTo({
      url: '/pages/postEdit/postEdit'
    })
  }
})
