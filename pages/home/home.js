// 首页逻辑
Page({
  data: {},

  onLoad() {
    console.log('首页加载')
  },

  onShow() {
    console.log('首页显示')
  },

  // 跳转到每日穿搭页
  goToDaily() {
    wx.navigateTo({
      url: '/pages/daily/daily'
    })
  },

  // 服饰上传
  uploadClothes() {
    wx.navigateTo({
      url: '/pages/uploadClothes/uploadClothes'
    })
  },

  // AI试穿
  goToTryOn() {
    wx.switchTab({
      url: '/pages/tryon/tryon',
      fail: (err) => {
        console.error('跳转试穿页失败:', err)
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none'
        })
      }
    })
  },

  // 上传商品试穿图片到云存储，保证切换页面后仍能稳定展示和试穿
  uploadProductImageForTryon(tempFilePath) {
    const extMatch = tempFilePath.match(/\.[a-zA-Z0-9]+(?=($|\?))/)
    const ext = extMatch ? extMatch[0] : '.png'
    const cloudPath = `product_tryon/${Date.now()}-${Math.floor(Math.random() * 1000)}${ext}`

    return wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath
    })
  },

  // 根据云文件ID换取用于页面展示的 HTTPS 临时链接
  async getProductTryonDisplayImage(cloudFileID, localImagePath) {
    const urlRes = await wx.cloud.getTempFileURL({
      fileList: [cloudFileID]
    })
    const fileInfo = urlRes.fileList && urlRes.fileList[0]

    if (fileInfo && fileInfo.tempFileURL) {
      return fileInfo.tempFileURL
    }

    // 临时链接缺失时保留本地路径作为展示兜底，并输出 warning 方便排查
    console.warn('home.getProductTryonDisplayImage', '未获取到商品图 HTTPS 临时链接，将使用本地路径展示', {
      cloudFileID,
      urlRes
    })
    return localImagePath
  },

  // 选择商品图片 - 跳转到试穿页面进行AI试穿
  chooseProductImage() {
    console.log('商品试穿按钮被点击')
    
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: async (res) => {
        const localImagePath = res.tempFilePaths[0]
        console.log('选择商品图片成功:', localImagePath)

        wx.showLoading({ title: '正在准备商品图...', mask: true })

        try {
          const uploadRes = await this.uploadProductImageForTryon(localImagePath)
          if (!uploadRes || !uploadRes.fileID) {
            throw new Error('商品图片上传成功但未返回云文件ID')
          }

          const displayImage = await this.getProductTryonDisplayImage(uploadRes.fileID, localImagePath)

          const productTryonPayload = {
            source: 'productTryon',
            localImagePath,
            displayImage,
            cloudFileID: uploadRes.fileID,
            createdAt: Date.now()
          }

          // 使用结构化数据传递，既保留本地预览，也保留云端试穿文件
          wx.setStorageSync('productImageForTryon', productTryonPayload)
          console.log('商品试穿缓存已设置:', productTryonPayload)
          wx.hideLoading()
          
          // 跳转到试穿页面进行AI试穿
          console.log('开始跳转到试穿页面...')
          wx.switchTab({
            url: '/pages/tryon/tryon',
            success: () => {
              console.log('跳转成功')
            },
            fail: (err) => {
              console.error('跳转失败:', err)
              wx.showToast({
                title: '跳转失败，请重试',
                icon: 'none'
              })
            }
          })
        } catch (error) {
          wx.hideLoading()
          console.error('商品图片准备失败:', error)
          wx.showToast({
            title: '商品图片上传失败，请重试',
            icon: 'none'
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
  }
})
