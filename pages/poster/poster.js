const db = wx.cloud.database()
const app = getApp()

Page({
  data: {
    posterImage: '', // 接收真实图片
    clothesImage: '' // 接收穿搭的原图
  },

  onLoad(options) {
    console.log('海报页加载，接收到的参数：', options)
    
    // 核心修复：接收上一个页面传过来的真实图片地址，告别假图
    if (options.image) {
      this.setData({
        posterImage: decodeURIComponent(options.image)
      })
    }
    
    if (options.clothes) {
      this.setData({
        clothesImage: decodeURIComponent(options.clothes)
      })
    }
  },

  onShow() {
    console.log('海报页显示')
  },

  // === 🌟 核心：支持云端/网络图片下载保存至相册 ===
  async downloadPoster() {
    if (!this.data.posterImage) return wx.showToast({ title: '暂无图片可保存', icon: 'none' })
    
    wx.showLoading({ title: '下载海报中...', mask: true })
    
    try {
      let finalPath = this.data.posterImage

      // 1. 如果是云存储图片 (cloud://)，先下载获取临时路径
      if (finalPath.startsWith('cloud://')) {
        const res = await wx.cloud.downloadFile({ fileID: finalPath })
        finalPath = res.tempFilePath
      } 
      // 2. 如果是普通网络图片 (http:// 或 https://)
      else if (finalPath.startsWith('http')) {
        const res = await new Promise((resolve, reject) => {
          wx.downloadFile({
            url: finalPath,
            success: resolve,
            fail: reject
          })
        })
        finalPath = res.tempFilePath
      }

      // 3. 将本地临时文件保存到相册
      wx.saveImageToPhotosAlbum({
        filePath: finalPath,
        success: () => {
          wx.hideLoading()
          wx.showToast({ title: '已保存到相册', icon: 'success' })
        },
        fail: (err) => {
          wx.hideLoading()
          if (err.errMsg.includes('fail auth')) {
            // 用户拒绝了授权，引导去设置页开启
            wx.showModal({
              title: '需要权限',
              content: '请开启保存相册的权限。',
              confirmText: '去设置',
              success: (modalRes) => {
                if (modalRes.confirm) wx.openSetting()
              }
            })
          } else {
            wx.showToast({ title: '保存取消或失败', icon: 'none' })
          }
        }
      })
    } catch (error) {
      wx.hideLoading()
      console.error('下载海报失败:', error)
      wx.showToast({ title: '下载失败', icon: 'none' })
    }
  },

  // 分享海报（跳转到发布社区页）
  sharePoster() {
    if (!this.data.posterImage) return
    wx.navigateTo({
      url: '/pages/postEdit/postEdit?image=' + encodeURIComponent(this.data.posterImage)
    })
  }
})