// pages/community/community.js
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
    // 仅在数据为空时才重新加载，避免每次返回页面都产生视觉闪烁
    if (this.data.postList.length === 0) {
      this.loadPosts()
    }
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
          images: item.images || (item.image ? [item.image] : []),
          title: item.title || '',
          content: item.content || '',
          author: item.author || '用户',
          avatar: item.avatar || '',
          // 🌟 双保险兼容：同时兼容 likes/likeCount，避免前端拿不到数据变成 0
          likes: item.likes || item.likeCount || 0,
          collects: item.collects || item.collectCount || 0,
          liked: item.liked || false,
          collected: item.collected || false,
          formattedTime: item.formattedTime || '刚刚'
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
    if (!post) return
    
    // 🌟 将当前列表里的数据打包传递给详情页，实现秒开！
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