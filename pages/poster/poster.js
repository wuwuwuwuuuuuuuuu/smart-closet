// 海报操作页逻辑
Page({
  data: {
    posterImage: 'https://picsum.photos/750/1334?random=50',
    showCollectionModal: false,
    selectedTags: [],
    customTag: '',
    presetTags: ['正式', '休闲', '运动', '约会', '工作', '春', '夏', '秋', '冬']
  },

  onLoad() {
    console.log('海报页加载')
  },

  onShow() {
    console.log('海报页显示')
  },

  // 下载海报
  downloadPoster() {
    wx.showLoading({
      title: '下载中...'
    })
    
    // 模拟下载过程
    setTimeout(() => {
      wx.hideLoading()
      wx.saveImageToPhotosAlbum({
        filePath: this.data.posterImage,
        success: () => {
          wx.showToast({
            title: '已保存到本地',
            icon: 'success'
          })
        },
        fail: (err) => {
          console.error('保存失败:', err)
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          })
        }
      })
    }, 1000)
  },

  // 分享海报
  sharePoster() {
    wx.navigateTo({
      url: '/pages/postEdit/postEdit?image=' + encodeURIComponent(this.data.posterImage)
    })
  },

  // 显示收藏弹窗
  showCollectionModal() {
    this.setData({
      showCollectionModal: true
    })
  },

  // 隐藏收藏弹窗
  hideCollectionModal() {
    this.setData({
      showCollectionModal: false,
      selectedTags: [],
      customTag: ''
    })
  },

  // 切换标签选择
  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag
    const selectedTags = [...this.data.selectedTags]
    
    const index = selectedTags.indexOf(tag)
    if (index > -1) {
      selectedTags.splice(index, 1)
    } else {
      selectedTags.push(tag)
    }
    
    this.setData({
      selectedTags: selectedTags
    })
  },

  // 标签输入
  onTagInput(e) {
    this.setData({
      customTag: e.detail.value
    })
  },

  // 添加自定义标签
  addCustomTag() {
    const { customTag, selectedTags } = this.data
    
    if (!customTag.trim()) {
      wx.showToast({
        title: '请输入标签',
        icon: 'none'
      })
      return
    }
    
    if (selectedTags.includes(customTag)) {
      wx.showToast({
        title: '标签已存在',
        icon: 'none'
      })
      return
    }
    
    this.setData({
      selectedTags: [...selectedTags, customTag],
      customTag: ''
    })
  },

  // 确认收藏
  confirmCollection() {
    const { selectedTags } = this.data
    
    if (selectedTags.length === 0) {
      wx.showToast({
        title: '请选择标签',
        icon: 'none'
      })
      return
    }
    
    // 模拟收藏操作
    wx.showLoading({
      title: '收藏中...'
    })
    
    setTimeout(() => {
      wx.hideLoading()
      this.hideCollectionModal()
      wx.showToast({
        title: '已加入我的收藏',
        icon: 'success'
      })
    }, 800)
  }
})