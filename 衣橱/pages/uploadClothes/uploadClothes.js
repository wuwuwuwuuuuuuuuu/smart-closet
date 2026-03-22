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
        main: '正在上传...',
        sub: ''
      },
      uploading: true,
      uploadProgress: 0
    })
    
    // 模拟上传进度
    this.simulateUpload()
  },

  // 模拟上传进度
  simulateUpload() {
    const uploadInterval = setInterval(() => {
      const newProgress = this.data.uploadProgress + 10
      this.setData({
        uploadProgress: newProgress
      })
      
      if (newProgress >= 100) {
        clearInterval(uploadInterval)
        this.uploadComplete()
      }
    }, 200)
  },

  // 上传完成
  uploadComplete() {
    // 模拟后端扣图处理
    setTimeout(() => {
      // 这里应该调用后端API进行扣图处理
      // 暂时使用模拟的扣图后图片
      const processedImage = this.data.uploadedImage // 实际应该是后端返回的扣图后图片
      
      // 跳转到衣物信息录入页面
      wx.navigateTo({
        url: `/pages/clothingInfo/clothingInfo?imagePath=${encodeURIComponent(processedImage)}`
      })
    }, 500)
  }
})