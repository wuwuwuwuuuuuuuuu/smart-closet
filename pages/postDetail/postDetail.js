const app = getApp()

Page({
  data: {
    post: {},
    comments: [],
    commentText: '',
    isAuthor: false,
    postId: '',
    currentOpenid: ''
  },

  onLoad(options) {
    const postId = options.id
    console.log('帖子详情页加载，ID:', postId)
    this.setData({ postId })

    if (options.postData) {
      try {
        const post = JSON.parse(decodeURIComponent(options.postData))
        this.setData({ post })
      } catch (e) {
        console.error('解析帖子数据失败:', e)
      }
    }

    this.loadPostDetail(postId)
    this.loadComments(postId)
  },

  onShow() {
    console.log('帖子详情页显示')
    if (this.data.postId) {
      this.loadPostDetail(this.data.postId)
      this.loadComments(this.data.postId)
    }
  },

  loadPostDetail(postId) {
    wx.cloud.callFunction({
      name: 'getPostDetail',
      data: { postId }
    }).then(res => {
      console.log('获取帖子详情成功:', res)
      if (res.result && res.result.code === 200) {
        const postData = res.result.data
        this.setData({
          'post.title': postData.title,
          'post.content': postData.content,
          'post.image': postData.image,
          'post.author': postData.author,
          'post.avatar': postData.avatar,
          'post.authorOpenid': postData.authorOpenid,
          'post.time': this.formatTime(postData.createTime),
          isAuthor: postData.isAuthor
        })
      }
    }).catch(err => {
      console.error('获取帖子详情失败:', err)
    })

    wx.cloud.callFunction({
      name: 'getLikeStatus',
      data: { postId }
    }).then(res => {
      console.log('获取点赞状态成功:', res)
      if (res.result && res.result.code === 200) {
        this.setData({
          'post.likes': res.result.data.likes,
          'post.liked': res.result.data.liked
        })
      }
    }).catch(err => {
      console.error('获取点赞状态失败:', err)
    })
  },

  formatTime(time) {
    if (!time) return ''
    const date = new Date(time)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  loadComments(postId) {
    wx.cloud.callFunction({
      name: 'getComments',
      data: { postId }
    }).then(res => {
      console.log('获取评论成功:', res)
      if (res.result && res.result.code === 200) {
        this.setData({
          comments: res.result.data
        })
      }
    }).catch(err => {
      console.error('获取评论失败:', err)
    })
  },

  goBack() {
    wx.navigateBack()
  },

  showDeleteConfirm() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条帖子吗？',
      success: (res) => {
        if (res.confirm) {
          this.deletePost()
        }
      }
    })
  },

  deletePost() {
    wx.showLoading({ title: '删除中...' })

    wx.cloud.callFunction({
      name: 'deletePost',
      data: { postId: this.data.postId }
    }).then(res => {
      wx.hideLoading()
      if (res.result && res.result.code === 200) {
        wx.showToast({ title: '删除成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1000)
      } else {
        wx.showToast({ title: '删除失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('删除帖子失败:', err)
      wx.showToast({ title: '删除失败', icon: 'none' })
    })
  },

  toggleLike() {
    const postId = this.data.postId
    wx.cloud.callFunction({
      name: 'toggleLike',
      data: { postId }
    }).then(res => {
      console.log('点赞操作结果:', res)
      if (res.result && res.result.code === 200) {
        this.setData({
          'post.likes': res.result.data.likes,
          'post.liked': res.result.data.liked
        })
      }
    }).catch(err => {
      console.error('点赞操作失败:', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  },

  onCommentInput(e) {
    this.setData({
      commentText: e.detail.value
    })
  },

  sendComment() {
    const { commentText, postId } = this.data

    if (!commentText.trim()) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }

    wx.showLoading({ title: '发送中...' })

    wx.cloud.callFunction({
      name: 'addComment',
      data: { postId, content: commentText.trim() }
    }).then(res => {
      wx.hideLoading()
      if (res.result && res.result.code === 200) {
        this.setData({ commentText: '' })
        wx.showToast({ title: '评论成功', icon: 'success' })
        this.loadComments(postId)
      } else {
        wx.showToast({ title: '评论失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('评论失败:', err)
      wx.showToast({ title: '评论失败', icon: 'none' })
    })
  },

  toggleCommentLike(e) {
    const commentId = e.currentTarget.dataset.id

    wx.cloud.callFunction({
      name: 'toggleCommentLike',
      data: { commentId }
    }).then(res => {
      console.log('评论点赞结果:', res)
      if (res.result && res.result.code === 200) {
        const comments = this.data.comments.map(item => {
          if (item.id === commentId) {
            return {
              ...item,
              liked: res.result.data.liked,
              likes: res.result.data.likes
            }
          }
          return item
        })
        this.setData({ comments })
      }
    }).catch(err => {
      console.error('评论点赞失败:', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  },

  previewImage() {
    if (this.data.post.image) {
      wx.previewImage({
        urls: [this.data.post.image],
        current: this.data.post.image
      })
    }
  }
})
