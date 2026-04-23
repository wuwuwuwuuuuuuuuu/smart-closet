// 编辑帖子页逻辑
Page({
  data: {
    postImage: '',
    postTitle: '',
    postContent: '',
    canPublish: false
  },

  onLoad(options) {
    console.log('编辑帖子页加载')
    
    // 如果有传入的图片参数（从海报分享过来）
    if (options.image) {
      this.setData({
        postImage: decodeURIComponent(options.image)
      })
      this.checkPublishStatus()
    }
  },

  onShow() {
    console.log('编辑帖子页显示')
  },

  onReady() {
    // 页面显示时检查是否可以发布
    this.checkPublishStatus()
  },

  // 检查发布状态
  checkPublishStatus() {
    const { postImage, postTitle } = this.data
    const canPublish = postImage && postTitle.trim().length > 0
    
    this.setData({
      canPublish: canPublish
    })
  },

  // 返回上一页
  onBack() {
    const { postImage, postTitle, postContent } = this.data
    
    // 如果有内容，提示是否放弃编辑
    if (postImage || postTitle || postContent) {
      wx.showModal({
        title: '确认放弃',
        content: '确定要放弃当前编辑的内容吗？',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack()
          }
        }
      })
    } else {
      wx.navigateBack()
    }
  },

  // 选择图片
  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        this.setData({
          postImage: res.tempFilePaths[0]
        })
        this.checkPublishStatus()
      },
      fail: (err) => {
        console.error('选择图片失败:', err)
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  },

  // 标题输入
  onTitleInput(e) {
    this.setData({
      postTitle: e.detail.value
    })
    this.checkPublishStatus()
  },

  // 内容输入
  onContentInput(e) {
    this.setData({
      postContent: e.detail.value
    })
  },

  // 发布帖子
  publishPost() {
    const { canPublish, postImage, postTitle, postContent } = this.data
    
    if (!canPublish) {
      wx.showToast({
        title: '请填写标题和图片',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '发布中...'
    })

    wx.cloud.uploadFile({
      cloudPath: `posts/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`,
      filePath: postImage
    }).then(uploadRes => {
      return wx.cloud.callFunction({
        name: 'addForumPost',
        data: {
          title: postTitle,
          content: postContent,
          image: uploadRes.fileID
        }
      })
    }).then(res => {
      wx.hideLoading()
      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '发布成功',
          icon: 'success'
        })

        setTimeout(() => {
          wx.switchTab({
            url: '/pages/forum/forum'
          })
        }, 1000)
      } else {
        wx.showToast({
          title: '发布失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('发布帖子失败:', err)
      wx.showToast({
        title: '发布失败',
        icon: 'none'
      })
    })
  }
})