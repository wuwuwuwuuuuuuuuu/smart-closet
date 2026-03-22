// 帖子详情页逻辑
Page({
  data: {
    post: {},
    comments: [],
    commentText: '',
    isAuthor: false
  },

  onLoad(options) {
    const id = options.id || 1
    console.log('帖子详情页加载，ID:', id)
    this.loadPostDetail(id)
    this.loadComments(id)
  },

  onShow() {
    console.log('帖子详情页显示')
  },

  // 加载帖子详情
  loadPostDetail(id) {
    // 模拟数据
    const mockPost = {
      id: id,
      image: `https://picsum.photos/750/1000?random=${id}`,
      title: `时尚穿搭 ${id}`,
      author: `用户${id}`,
      time: '2024-03-17 14:30',
      content: '这套穿搭非常适合春季出游，简约而不失时尚感。上衣选择了浅色系，搭配深色裤子，整体效果非常协调。',
      likes: Math.floor(Math.random() * 100),
      liked: Math.random() > 0.5
    }

    this.setData({
      post: mockPost,
      isAuthor: Math.random() > 0.7 // 模拟是否为作者
    })
  },

  // 加载评论
  loadComments(postId) {
    // 模拟评论数据
    const mockComments = [
      {
        id: 1,
        author: '用户A',
        content: '这套穿搭真好看！',
        time: '2024-03-17 15:00',
        likes: 5,
        liked: false
      },
      {
        id: 2,
        author: '用户B',
        content: '颜色搭配很协调',
        time: '2024-03-17 15:30',
        likes: 3,
        liked: true
      },
      {
        id: 3,
        author: '用户C',
        content: '适合什么场合穿呢？',
        time: '2024-03-17 16:00',
        likes: 2,
        liked: false
      }
    ]

    this.setData({
      comments: mockComments
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 显示删除确认
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

  // 删除帖子
  deletePost() {
    wx.showLoading({
      title: '删除中...'
    })

    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1000)
    }, 800)
  },

  // 切换点赞
  toggleLike() {
    const post = { ...this.data.post }
    post.liked = !post.liked
    post.likes += post.liked ? 1 : -1

    this.setData({
      post: post
    })
  },

  // 评论输入
  onCommentInput(e) {
    this.setData({
      commentText: e.detail.value
    })
  },

  // 发送评论
  sendComment() {
    const { commentText, comments } = this.data
    
    if (!commentText.trim()) {
      wx.showToast({
        title: '请输入评论内容',
        icon: 'none'
      })
      return
    }

    const newComment = {
      id: comments.length + 1,
      author: '当前用户',
      content: commentText,
      time: new Date().toLocaleString(),
      likes: 0,
      liked: false
    }

    this.setData({
      comments: [newComment, ...comments],
      commentText: ''
    })

    wx.showToast({
      title: '评论成功',
      icon: 'success'
    })
  },

  // 切换评论点赞
  toggleCommentLike(e) {
    const index = e.currentTarget.dataset.index
    const comments = [...this.data.comments]
    const comment = comments[index]
    
    comment.liked = !comment.liked
    comment.likes += comment.liked ? 1 : -1
    
    this.setData({
      comments: comments
    })
  }
})