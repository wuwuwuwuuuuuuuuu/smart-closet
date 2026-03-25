/**
 * 服饰上传页面逻辑
 * 功能：拍照/相册上传衣物图片，跳转到信息录入
 * 后端接口预留：图片上传、衣物信息保存
 */
Page({
  data: {
    // 上传状态
    uploading: false,           // 上传中状态
    uploadProgress: 0,          // 上传进度（0-100）
    uploadedImage: null,        // 已上传的图片临时路径
    
    // 引导文字配置
    currentGuide: {
      main: '尽可能正上方拍照',
      sub: '请平铺衣物，避免褶皱，完整展示服饰全貌'
    }
  },

  onLoad() {
    console.log('服饰上传页加载')
  },

  onShow() {
    console.log('服饰上传页显示')
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 选择拍照上传
  chooseCamera() {
    this.setData({
      currentGuide: {
        main: '请从正上方俯拍衣物',
        sub: '确保光线充足、无杂物遮挡'
      }
    })
    
    // 打开相机
    this.openCamera()
  },

  // 选择相册导入
  chooseAlbum() {
    this.setData({
      currentGuide: {
        main: '请选择已拍摄的衣物平铺正上方照片',
        sub: '避免模糊、倾斜'
      }
    })
    
    this.selectFromAlbum()
  },

  // 打开相机
  openCamera() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: 'back',
      success: (res) => {
        this.handleImageSelected(res.tempFiles[0].tempFilePath)
      },
      fail: (err) => {
        console.error('拍照失败:', err)
        wx.showToast({
          title: '拍照失败',
          icon: 'none'
        })
      }
    })
  },

  // 选择相册
  selectFromAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        this.handleImageSelected(res.tempFiles[0].tempFilePath)
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

 // 处理选中的图片
 handleImageSelected(tempFilePath) {
  this.setData({
    uploadedImage: tempFilePath,
    currentGuide: {
      main: '正在上传到云端...',
      sub: '请保持网络畅通'
    },
    uploading: true,
    uploadProgress: 0
  })
  
  this.uploadToCloud(tempFilePath)
},

// ☁️ 真实上传到云端的核心逻辑
uploadToCloud(tempFilePath) {
  const that = this
  // 1. 给图片起个永远不重复的名字 (时间戳+随机数)
  const cloudPath = `clothes_raw/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`

  // 2. 调用云开发上传 API
  const uploadTask = wx.cloud.uploadFile({
    cloudPath: cloudPath,
    filePath: tempFilePath,
    success: (res) => {
      // 上传成功，拿到云端的永久链接 (长这样：cloud://...)
      const fileID = res.fileID
      console.log('✅ 图片真实上传成功，云端文件ID:', fileID)

      that.setData({
        uploadProgress: 100,
        currentGuide: { main: '上传成功！', sub: '准备录入信息...' }
      })

      // 3. 短暂延迟后，带着真实的云端图片ID跳到下一页！
      setTimeout(() => {
        that.uploadComplete(fileID)
      }, 500)
    },
    fail: (err) => {
      console.error('❌ 图片上传失败:', err)
      wx.showToast({ title: '上传云端失败', icon: 'error' })
      that.setData({ uploading: false })
    }
  })

  // 4. 监听真实的上传进度，让页面的进度条跟着动！
  uploadTask.onProgressUpdate((res) => {
    that.setData({
      uploadProgress: res.progress
    })
  })
},

// 上传完成，跳转页面
uploadComplete(fileID) {
  // ⚠️ 注意：这里你兄弟预留了“后端扣图”的注释。
  // 目前我们先不接入复杂的 AI 扣图，直接把原图传给下一页。
  // 等基础流程跑通了，咱们再来加魔法！
  
  wx.navigateTo({
    // 把刚才拿到的 cloud:// 链接传给下一页
    url: `/pages/clothingInfo/clothingInfo?imagePath=${encodeURIComponent(fileID)}`
  })
}
})