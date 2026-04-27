const app = getApp()

Page({
  data: {
    post: {},
    comments: [],
    commentText: '',
    replyTarget: null,
    isInputFocused: false,
    isAuthor: false,
    postId: '',
    currentOpenid: '',
    currentImageIndex: 0
  },

  onLoad(options) {
    const postId = options.id
    console.log('帖子详情页加载，ID:', postId)
    this.setData({ postId })

    if (options.postData) {
      try {
        const post = JSON.parse(decodeURIComponent(options.postData))
        this.setData({
          post: {
            ...post,
            images: this.normalizePostImages(post)
          },
          currentImageIndex: 0
        })
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
        const images = this.normalizePostImages(postData)
        this.setData({
          'post.title': postData.title,
          'post.content': postData.content,
          'post.image': postData.image,
          'post.images': images,
          'post.author': postData.author,
          'post.avatar': postData.avatar,
          'post.authorOpenid': postData.authorOpenid,
          'post.likes': postData.likes || 0,
          'post.liked': !!postData.liked,
          'post.collects': postData.collects || 0,
          'post.collected': !!postData.collected,
          'post.time': this.formatTime(postData.createTime),
          currentImageIndex: 0,
          isAuthor: postData.isAuthor
        })
      }
    }).catch(err => {
      console.error('获取帖子详情失败:', err)
    })
  },

  // 统一整理帖子图片数组，兼容单图 image 和多图 images 字段
  normalizePostImages(post = {}) {
    const images = Array.isArray(post.images)
      ? post.images.filter(Boolean)
      : []

    if (images.length > 0) {
      return images
    }

    if (post.image) {
      return [post.image]
    }

    console.warn('postDetail.normalizePostImages', '帖子缺少可展示图片', {
      postId: post._id || this.data.postId
    })
    return []
  },

  // 记录当前轮播图下标，用于展示 1/多张 的页码
  onSwiperChange(e) {
    this.setData({
      currentImageIndex: e.detail.current || 0
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
    return wx.cloud.callFunction({
      name: 'getComments',
      data: { postId }
    }).then(res => {
      console.log('获取评论成功:', res)
      if (res.result && res.result.code === 200) {
        const expandedMap = {}
        this.data.comments.forEach(item => {
          if (item.id && item.isExpanded) {
            expandedMap[item.id] = true
          }
        })
        const comments = (res.result.data || []).map(item => ({
          ...item,
          isExpanded: !!expandedMap[item.id]
        }))
        this.setData({
          comments
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

  // 点击评论或回复时，设置当前回复目标并唤起输入框
  handleReply(e) {
    const comment = e.currentTarget.dataset.comment
    const rootId = e.currentTarget.dataset.rootid

    if (!comment || !comment.id) {
      console.warn('postDetail.handleReply', '回复目标缺少评论ID', { comment, rootId })
      wx.showToast({ title: '无法回复该评论', icon: 'none' })
      return
    }

    this.setData({
      replyTarget: {
        commentId: rootId || comment.id,
        userName: comment.author || '用户'
      },
      isInputFocused: true
    })
  },

  // 记录评论输入框聚焦状态，用于控制底部操作区显隐
  onInputFocus() {
    this.setData({
      isInputFocused: true
    })
  },

  // 输入框失焦后，如果没有内容则恢复点赞收藏评论操作区
  onInputBlur() {
    this.setData({
      isInputFocused: false
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

  // 根据当前输入状态发送一级评论或楼中楼回复
  sendCommentOrReply() {
    if (this.data.replyTarget) {
      this.sendReply()
      return
    }

    this.sendComment()
  },

  // 发送楼中楼回复，成功后刷新评论列表并展开对应评论
  sendReply() {
    const { commentText, postId, replyTarget } = this.data

    if (!replyTarget || !replyTarget.commentId) {
      console.warn('postDetail.sendReply', '缺少回复目标，降级为普通评论')
      this.sendComment()
      return
    }

    if (!commentText.trim()) {
      wx.showToast({ title: '请输入回复内容', icon: 'none' })
      return
    }

    wx.showLoading({ title: '发送中...' })

    wx.cloud.callFunction({
      name: 'addReply',
      data: {
        postId,
        commentId: replyTarget.commentId,
        content: commentText.trim(),
        replyTo: replyTarget.userName
      }
    }).then(res => {
      wx.hideLoading()
      if (res.result && res.result.code === 200) {
        const replyCommentId = replyTarget.commentId
        this.setData({
          commentText: '',
          replyTarget: null,
          isInputFocused: false
        })
        wx.showToast({ title: '回复成功', icon: 'success' })
        this.loadComments(postId).then(() => {
          const comments = this.data.comments.map(item => {
            if (item.id === replyCommentId) {
              return { ...item, isExpanded: true }
            }
            return item
          })
          this.setData({ comments })
        })
      } else {
        wx.showToast({ title: res.result && res.result.msg ? res.result.msg : '回复失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('回复失败:', err)
      wx.showToast({ title: '回复失败', icon: 'none' })
    })
  },

  // 展开或收起指定评论下的楼中楼回复
  toggleExpand(e) {
    const index = e.currentTarget.dataset.index
    const comments = [...this.data.comments]

    if (typeof index !== 'number' || !comments[index]) {
      console.warn('postDetail.toggleExpand', '无效的评论下标', { index })
      return
    }

    comments[index] = {
      ...comments[index],
      isExpanded: !comments[index].isExpanded
    }
    this.setData({ comments })
  },

  // 切换帖子收藏状态，并同步底部收藏数量
  toggleCollect() {
    const postId = this.data.postId
    wx.cloud.callFunction({
      name: 'toggleCollect',
      data: { postId }
    }).then(res => {
      console.log('收藏操作结果:', res)
      if (res.result && res.result.code === 200) {
        this.setData({
          'post.collects': res.result.data.collects,
          'post.collected': res.result.data.collected
        })
      }
    }).catch(err => {
      console.error('收藏操作失败:', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  },

  // 点击评论图标时滚动到评论区
  scrollToComments() {
    wx.pageScrollTo({
      selector: '#comment-section',
      duration: 300,
      fail: (err) => {
        console.warn('postDetail.scrollToComments', '滚动到评论区失败', err)
      }
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

  // 切换楼中楼回复点赞状态
  toggleReplyLike(e) {
    const commentId = e.currentTarget.dataset.commentId
    const replyId = e.currentTarget.dataset.replyId

    if (!commentId || !replyId) {
      console.warn('postDetail.toggleReplyLike', '缺少回复点赞参数', { commentId, replyId })
      return
    }

    wx.cloud.callFunction({
      name: 'toggleCommentLike',
      data: {
        replyId,
        type: 'reply'
      }
    }).then(res => {
      console.log('回复点赞结果:', res)
      if (res.result && res.result.code === 200) {
        const comments = this.data.comments.map(item => {
          if (item.id !== commentId) {
            return item
          }

          const replies = (item.replies || []).map(reply => {
            if (reply.id === replyId) {
              return {
                ...reply,
                liked: res.result.data.liked,
                likes: res.result.data.likes
              }
            }
            return reply
          })

          return {
            ...item,
            replies
          }
        })
        this.setData({ comments })
      }
    }).catch(err => {
      console.error('回复点赞失败:', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  },

  // 预览当前帖子图片，多图时从当前滑动位置开始预览
  previewImage(e) {
    const images = this.normalizePostImages(this.data.post)
    if (images.length > 0) {
      const index = typeof e.currentTarget.dataset.index === 'number'
        ? e.currentTarget.dataset.index
        : this.data.currentImageIndex

      wx.previewImage({
        urls: images,
        current: images[index] || images[0]
      })
    }
  }
})
