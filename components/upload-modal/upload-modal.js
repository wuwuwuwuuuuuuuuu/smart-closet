// 服饰上传弹窗组件逻辑
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },

  data: {
    // 上传状态
    uploading: false,
    uploadProgress: 0,
    uploadedImage: null,
    
    // 引导文字配置
    currentGuide: {
      main: '尽可能正上方拍照',
      sub: '请平铺衣物，避免褶皱，完整展示服饰全貌'
    },
    
    // 拍照相关
    showCountdown: false,
    countdown: 3,
    
    // 极速上传开关
    fastUpload: false
  },

  methods: {
    // 隐藏弹窗
    hideModal() {
      this.setData({
        show: false
      })
      this.triggerEvent('close')
    },

    // 切换极速上传
    toggleFastUpload(e) {
      this.setData({
        fastUpload: e.detail.value
      })
    },

    // 选择拍照上传
    chooseCamera() {
      this.setData({
        currentGuide: {
          main: '请从正上方俯拍衣物',
          sub: '确保光线充足、无杂物遮挡'
        }
      })
      
      // 开始倒计时
      this.startCountdown()
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

    // 开始倒计时
    startCountdown() {
      this.setData({
        showCountdown: true,
        countdown: 3
      })
      
      const countdownInterval = setInterval(() => {
        const newCountdown = this.data.countdown - 1
        this.setData({
          countdown: newCountdown
        })
        
        if (newCountdown <= 0) {
          clearInterval(countdownInterval)
          this.setData({
            showCountdown: false
          })
          this.openCamera()
        }
      }, 1000)
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
      setTimeout(() => {
        this.triggerEvent('uploadComplete', {
          imagePath: this.data.uploadedImage
        })
        
        this.setData({
          show: false,
          uploading: false,
          uploadProgress: 0
        })
      }, 500)
    }
  }
})