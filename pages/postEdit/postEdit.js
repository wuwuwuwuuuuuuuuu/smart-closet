// 发布穿搭页逻辑 - 小红书风格重构
Page({
  data: {
    imageList: [], // 九宫格图片数组
    postTitle: '',
    postContent: '',
    canPublish: false,
    maxImageCount: 9 // 最大上传张数
  },

  onLoad(options) {
    console.log('发布穿搭页加载')
    
    // 如果有传入的图片参数（从其他页面跳转过来）
    if (options.image) {
      const imageUrl = decodeURIComponent(options.image)
      this.setData({
        imageList: [imageUrl]
      })
      this.checkPublishStatus()
    }
  },

  onShow() {
    console.log('发布穿搭页显示')
    this.checkPublishStatus()
  },

  // 检查发布状态
  checkPublishStatus() {
    const { imageList, postTitle } = this.data
    const canPublish = imageList.length > 0 && postTitle.trim().length > 0
    
    this.setData({
      canPublish: canPublish
    })
  },

  // 选择图片 - 小红书标准九宫格
  chooseImages() {
    const { imageList, maxImageCount } = this.data
    const remainingCount = maxImageCount - imageList.length
    
    if (remainingCount <= 0) {
      wx.showToast({
        title: '最多只能上传9张图片',
        icon: 'none'
      })
      return
    }

    wx.chooseMedia({
      count: remainingCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      maxDuration: 30,
      camera: 'back',
      success: (res) => {
        console.log('选择图片成功:', res)
        
        if (res.tempFiles && res.tempFiles.length > 0) {
          // 使用 concat 拼接数组，禁止直接覆盖
          const newImages = res.tempFiles.map(file => file.tempFilePath)
          const updatedImageList = imageList.concat(newImages)
          
          this.setData({
            imageList: updatedImageList
          })
          
          this.checkPublishStatus()
          
          // 显示上传成功提示
          wx.showToast({
            title: `成功添加${newImages.length}张图片`,
            icon: 'success',
            duration: 1500
          })
        }
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

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const { imageList } = this.data
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张图片吗？',
      success: (res) => {
        if (res.confirm) {
          const newImageList = [...imageList]
          newImageList.splice(index, 1)
          
          this.setData({
            imageList: newImageList
          })
          
          this.checkPublishStatus()
          
          wx.showToast({
            title: '图片已删除',
            icon: 'success'
          })
        }
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

  // 标题输入框获得焦点
  onTitleFocus() {
    // 可以添加一些动画效果
  },

  // 标题输入框失去焦点
  onTitleBlur() {
    this.checkPublishStatus()
  },

  // 正文输入
  onContentInput(e) {
    this.setData({
      postContent: e.detail.value
    })
  },

  // 正文输入框获得焦点
  onContentFocus() {
    // 可以添加一些动画效果
  },

  // 正文输入框失去焦点
  onContentBlur() {
    // 可以添加一些动画效果
  },

  // 发布帖子
  async publishPost() {
    if (!this.data.canPublish) return
    
    const { imageList, postTitle, postContent } = this.data
    
    wx.showLoading({
      title: '发布中...',
      mask: true
    })

    try {
      // 1. 上传图片到云存储
      const uploadedImages = []
      for (const tempFilePath of imageList) {
        const uploadResult = await this.uploadImageToCloud(tempFilePath)
        if (uploadResult) {
          uploadedImages.push(uploadResult)
        }
      }

      // 2. 发布帖子到数据库
      const db = wx.cloud.database()
      const app = getApp()
      // 🌟 核心修复1：安全获取全局变量，加了 || {} 兜底，防止报错
      const currentUser = (app.globalData && app.globalData.currentUserInfo) || {}
      const currentUserId = (app.globalData && app.globalData.currentUserId) || 'unknown_user'
      
      const result = await db.collection('posts').add({
        data: {
          title: postTitle.trim(),
          content: postContent.trim(),
          images: uploadedImages,
          // 🌟 核心修复2：同时兼容 nickname 和 nickName 大小写写法
          author: currentUser.nickname || currentUser.nickName || '匿名用户',
          // 🌟 核心修复3：同理，兼容 avatar 和 avatarUrl
          avatar: currentUser.avatar || currentUser.avatarUrl || '',
          likes: 0,
          comments: 0,
          collected: 0,
          createTime: new Date(),
          formattedTime: new Date().toLocaleString('zh-CN'),
          userId: currentUserId
        }
      })

      wx.hideLoading()
      
      // 发布成功
      wx.showToast({
        title: '发布成功',
        icon: 'success',
        duration: 2000
      })

      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        wx.navigateBack()
      }, 2000)

    } catch (error) {
      wx.hideLoading()
      console.error('发布失败:', error)
      
      wx.showModal({
        title: '发布失败',
        content: '网络异常，请稍后重试',
        showCancel: false,
        confirmText: '确定'
      })
    }
  },

  // 上传图片到云存储
  uploadImageToCloud(tempFilePath) {
    return new Promise((resolve, reject) => {
      const cloudPath = `post-images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`
      
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempFilePath,
        success: (res) => {
          console.log('图片上传成功:', res)
          resolve(res.fileID)
        },
        fail: (err) => {
          console.error('图片上传失败:', err)
          reject(err)
        }
      })
    })
  },

  // 返回上一页
  onBack() {
    const { imageList, postTitle, postContent } = this.data
    
    // 如果有内容，提示是否放弃编辑
    if (imageList.length > 0 || postTitle || postContent) {
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
  }
})