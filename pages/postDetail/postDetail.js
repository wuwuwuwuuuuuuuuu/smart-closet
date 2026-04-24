// 帖子详情页逻辑 - 简衣悦己终极版
const app = getApp()

Page({
  data: {
    post: {},
    comments: [],
    isAuthor: false,
    postId: '',
    currentOpenid: '',
    currentImageIndex: 0,
    
    inputText: '',
    replyTarget: null, 
    isInputFocused: false,
    hasScrolledToComments: false 
  },

  onLoad(options) {
    const postId = options.id
    this.setData({ postId })

    // 🌟 秒开逻辑：立刻使用传过来的缓存数据渲染
    if (options.postData) {
      try {
        const cacheData = JSON.parse(decodeURIComponent(options.postData))
        this.setData({ 
          post: cacheData,
          currentImageIndex: 0
        })
      } catch (e) {
        console.error('缓存解析失败:', e)
      }
    }

    // 静默更新后台数据
    this.loadPostDetail(postId)
    this.loadComments(postId)
  },

  onShow() {
    if (this.data.postId) {
      this.loadPostDetail(this.data.postId)
      this.loadComments(this.data.postId)
    }
  },
// 🌟 页面卸载（退出返回上一页）时触发
onUnload() {
  // 获取当前页面栈
  const pages = getCurrentPages()
  // 如果页面栈大于1，说明有上一页
  if (pages.length > 1) {
    // 获取上一页的实例（也就是首页 community）
    const prevPage = pages[pages.length - 2]
    
    // 判断上一页的数据里有没有 postList
    if (prevPage.data.postList) {
      // 找到我们刚刚在看的这条帖子在首页列表里的索引
      const index = prevPage.data.postList.findIndex(item => item.id === this.data.postId)
      
      if (index !== -1) {
        // 🚀 核心魔法：直接隔空局部修改首页的对应数据！绝对静默，极致顺滑
        prevPage.setData({
          [`postList[${index}].likes`]: this.data.post.likes,
          [`postList[${index}].liked`]: this.data.post.liked,
          [`postList[${index}].collects`]: this.data.post.collects,
          [`postList[${index}].collected`]: this.data.post.collected
        })
      }
    }
  }
},
  onSwiperChange(e) {
    this.setData({ currentImageIndex: e.detail.current })
  },

  // 🛡️ 加载帖子详情 (加入终极防覆盖装甲，绝不让 0 覆盖已有数据)
  loadPostDetail(postId) {
    wx.cloud.callFunction({
      name: 'getPostDetail',
      data: { postId }
    }).then(res => {
      if (res.result && res.result.code === 200) {
        const d = res.result.data
        
        let newLikes = this.data.post.likes;
        if (d.likes !== undefined && d.likes !== 0) newLikes = d.likes;
        else if (d.likeCount !== undefined && d.likeCount !== 0) newLikes = d.likeCount;

        let newCollects = this.data.post.collects;
        if (d.collects !== undefined && d.collects !== 0) newCollects = d.collects;
        else if (d.collectCount !== undefined && d.collectCount !== 0) newCollects = d.collectCount;

        let newLiked = (d.liked !== undefined && d.liked !== false) ? d.liked : this.data.post.liked;
        let newCollected = (d.collected !== undefined && d.collected !== false) ? d.collected : this.data.post.collected;

        this.setData({
          'post.title': d.title || this.data.post.title,
          'post.content': d.content || this.data.post.content,
          'post.image': d.image || this.data.post.image,
          'post.images': d.images || (d.image ? [d.image] : this.data.post.images),
          'post.author': d.author || this.data.post.author,
          'post.avatar': d.avatar || this.data.post.avatar,
          'post.time': d.formattedTime || this.data.post.time,
          
          'post.likes': Math.max(0, newLikes),
          'post.collects': Math.max(0, newCollects),
          'post.liked': newLiked,
          'post.collected': newCollected
        })
      }
    })
  },

  loadComments(postId) {
    wx.cloud.callFunction({
      name: 'getComments',
      data: { postId }
    }).then(res => {
      if (res.result && res.result.code === 200) {
        let newComments = res.result.data || []
        const oldComments = this.data.comments
        newComments = newComments.map(newC => {
          const oldC = oldComments.find(c => c.id === newC.id)
          newC.isExpanded = oldC ? oldC.isExpanded : false
          return newC
        })
        this.setData({ comments: newComments })
      }
    })
  },

  toggleExpand(e) {
    const index = e.currentTarget.dataset.index
    const key = `comments[${index}].isExpanded`
    this.setData({ [key]: !this.data.comments[index].isExpanded })
  },

  onInputChange(e) { this.setData({ inputText: e.detail.value }) },
  onInputFocus() { this.setData({ isInputFocused: true }) },
  onInputBlur() {
    setTimeout(() => {
      this.setData({ isInputFocused: false })
      if (!this.data.inputText.trim()) {
        this.setData({ replyTarget: null })
      }
    }, 150)
  },

  handleReply(e) {
    const comment = e.currentTarget.dataset.comment
    const rootId = e.currentTarget.dataset.rootid || comment.id
    
    this.setData({
      replyTarget: {
        id: rootId,          
        targetId: comment.id,
        userName: comment.author
      },
      isInputFocused: true
    })
  },

  sendCommentOrReply() {
    const { inputText, replyTarget, postId } = this.data
    if (!inputText.trim()) return

    wx.showLoading({ title: '发送中...', mask: true })
    const apiName = replyTarget ? 'addReply' : 'addComment'
    const apiData = { postId, content: inputText.trim() }

    if (replyTarget) {
      apiData.commentId = replyTarget.id
      if (replyTarget.targetId !== replyTarget.id) {
        apiData.replyTo = replyTarget.userName
      } else {
        apiData.replyTo = '' 
      }
    }

    wx.cloud.callFunction({
      name: apiName,
      data: apiData
    }).then(res => {
      wx.hideLoading()
      if (res.result && res.result.code === 200) {
        if (replyTarget) {
          const idx = this.data.comments.findIndex(c => c.id === replyTarget.id)
          if (idx !== -1) this.setData({ [`comments[${idx}].isExpanded`]: true })
        }
        wx.showToast({ title: '已发送', icon: 'success' })
        this.setData({ inputText: '', replyTarget: null, isInputFocused: false })
        this.scrollToComments(true)
        this.loadComments(postId)
      }
    }).catch(() => { wx.hideLoading(); wx.showToast({ title: '发送失败', icon: 'none' }) })
  },

  // 🌟 乐观更新：点赞帖子 (使用 Math.max 彻底杜绝负数)
  handleLikePost() {
    const postId = this.data.postId
    const curLiked = this.data.post.liked
    let curLikes = parseInt(this.data.post.likes) || 0

    this.setData({
      'post.liked': !curLiked,
      'post.likes': !curLiked ? curLikes + 1 : Math.max(0, curLikes - 1)
    })

    wx.cloud.callFunction({ name: 'toggleLike', data: { postId } }).then(res => {
      if (res.result && res.result.code === 200) {
        this.setData({ 'post.likes': Math.max(0, res.result.data.likes || res.result.data.likeCount || this.data.post.likes) })
      } else {
        this.setData({ 'post.liked': curLiked, 'post.likes': Math.max(0, curLikes) })
      }
    }).catch(() => { this.setData({ 'post.liked': curLiked, 'post.likes': Math.max(0, curLikes) }) })
  },

  // 🌟 乐观更新：收藏帖子 (使用 Math.max 彻底杜绝负数)
  handleCollectPost() {
    const postId = this.data.postId
    const curCollected = this.data.post.collected
    let curCollects = parseInt(this.data.post.collects) || 0

    this.setData({
      'post.collected': !curCollected,
      'post.collects': !curCollected ? curCollects + 1 : Math.max(0, curCollects - 1)
    })

    wx.cloud.callFunction({ name: 'toggleCollect', data: { postId } }).then(res => {
      if (res.result && res.result.code === 200) {
        this.setData({ 'post.collects': Math.max(0, res.result.data.collects || res.result.data.collectCount || this.data.post.collects) })
      } else {
        this.setData({ 'post.collected': curCollected, 'post.collects': Math.max(0, curCollects) })
      }
    }).catch(() => { this.setData({ 'post.collected': curCollected, 'post.collects': Math.max(0, curCollects) }) })
  },

  // 🌟 乐观更新：一级评论点赞
  toggleCommentLike(e) {
    const commentId = e.currentTarget.dataset.id
    const postId = this.data.postId
    const idx = this.data.comments.findIndex(c => c.id === commentId)
    if (idx === -1) return

    const item = this.data.comments[idx]
    const curLiked = item.liked
    let curLikes = parseInt(item.likes) || 0

    this.setData({
      [`comments[${idx}].liked`]: !curLiked,
      [`comments[${idx}].likes`]: !curLiked ? curLikes + 1 : Math.max(0, curLikes - 1)
    })

    wx.cloud.callFunction({ name: 'toggleCommentLike', data: { postId, commentId } }).catch(() => {
      this.setData({ [`comments[${idx}].liked`]: curLiked, [`comments[${idx}].likes`]: Math.max(0, curLikes) })
    })
  },

  // 🌟 乐观更新：二级回复点赞
  toggleReplyLike(e) {
    const { commentId, replyId } = e.currentTarget.dataset
    const cIdx = this.data.comments.findIndex(c => c.id === commentId)
    if (cIdx === -1) return
    const rIdx = this.data.comments[cIdx].replies.findIndex(r => r.id === replyId)
    if (rIdx === -1) return

    const reply = this.data.comments[cIdx].replies[rIdx]
    const curLiked = reply.liked
    let curLikes = parseInt(reply.likes) || 0

    this.setData({
      [`comments[${cIdx}].replies[${rIdx}].liked`]: !curLiked,
      [`comments[${cIdx}].replies[${rIdx}].likes`]: !curLiked ? curLikes + 1 : Math.max(0, curLikes - 1)
    })

    wx.cloud.callFunction({ name: 'toggleReplyLike', data: { postId: this.data.postId, commentId, replyId } }).catch(() => {
      this.setData({ [`comments[${cIdx}].replies[${rIdx}].liked`]: curLiked, [`comments[${cIdx}].replies[${rIdx}].likes`]: Math.max(0, curLikes) })
    })
  },

  scrollToComments(force = false) {
    if (!this.data.hasScrolledToComments || force === true) {
      wx.pageScrollTo({ selector: '#comment-section', duration: 300 })
      this.setData({ hasScrolledToComments: true })
    } else {
      this.setData({ isInputFocused: true })
    }
  },

  previewImage(e) {
    const { images, index } = e.currentTarget.dataset
    wx.previewImage({ urls: images, current: images[index] })
  },

  showDeleteConfirm() {
    wx.showModal({
      title: '确认删除', content: '确定要删除这条帖子吗？',
      success: (res) => { if (res.confirm) this.deletePost() }
    })
  },

  deletePost() {
    wx.showLoading({ title: '删除中...' })
    wx.cloud.callFunction({ name: 'deletePost', data: { postId: this.data.postId } }).then(res => {
      wx.hideLoading()
      if (res.result && res.result.code === 200) {
        wx.showToast({ title: '已删除' }); setTimeout(() => { wx.navigateBack() }, 1000)
      }
    })
  }
})