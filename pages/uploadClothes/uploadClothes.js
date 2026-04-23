/**
 * 服饰上传页面逻辑
 * 功能：拍照/相册上传衣物图片，智能抠图，跳转到信息录入
 * 集成阿里云DashScope智能抠图API
 */
const aliyunImageSegmentation = require('../../utils/aliyun-image-segmentation')

Page({
  data: {
    // 上传状态
    uploading: false,           // 上传中状态
    uploadProgress: 0,          // 上传进度（0-100）
    uploadedImage: null,        // 已上传的图片临时路径
    isExtracting: false,        // 抠图中状态
    extractionProgress: 0,      // 抠图进度
    
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
        wx.showToast({ title: '拍照失败，请重试', icon: 'none' })
      }
    })
  },

  // 从相册选择
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
        wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
    })
  },

  // 处理选中的图片
  handleImageSelected(tempFilePath) {
    console.log('图片选择成功，临时路径:', tempFilePath)
    
    this.setData({
      uploading: true,
      uploadProgress: 0,
      uploadedImage: tempFilePath,
      currentGuide: {
        main: '正在上传图片...',
        sub: '请保持网络连接'
      }
    })
    
    // 开始上传到云端
    this.uploadToCloud(tempFilePath)
  },

  // ☁️ 真实上传到云端的核心逻辑
  uploadToCloud(tempFilePath) {
    const that = this
    
    console.log('开始上传图片到云端...')
    console.log('临时文件路径:', tempFilePath)
    
    // 1. 给图片起个永远不重复的名字 (时间戳+随机数)
    const cloudPath = `clothes_raw/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`
    console.log('云端路径:', cloudPath)

    // 2. 调用云开发上传 API
    const uploadTask = wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: tempFilePath,
      success: (res) => {
        console.log('✅ 图片上传成功，云端文件ID:', res.fileID)
        
        // 上传成功，开始智能抠图流程
        that.startImageExtraction(tempFilePath, res.fileID)
      },
      fail: (err) => {
        console.error('❌ 图片上传失败:', err)
        console.error('错误详情:', JSON.stringify(err))
        
        // 上传失败处理
        that.setData({
          uploading: false,
          uploadProgress: 0,
          currentGuide: {
            main: '上传失败',
            sub: '请检查网络连接后重试'
          }
        })
        
        wx.showToast({
          title: '上传失败，请重试',
          icon: 'none'
        })
      }
    })
    
    // 监听上传进度变化
    uploadTask.onProgressUpdate((res) => {
      console.log('上传进度:', res.progress + '%')
      that.setData({
        uploadProgress: res.progress
      })
    })
  },

  // 从阿里云分割结果中获取透明图片URL
  getTransparentImageFromResult(segmentationResult) {
    console.log('处理分割结果:', segmentationResult)
    
    if (!segmentationResult) {
      console.warn('分割结果为空，使用原图')
      return null
    }
    
    // 阿里云API返回的数据结构：{output: {...}, usage: {...}, request_id: "..."}
    const output = segmentationResult.output || segmentationResult
    
    console.log('分割结果output:', output)
    
    // 根据阿里云API文档，优先使用parsing_img_url（RGBA透明背景）
    if (output.parsing_img_url && Array.isArray(output.parsing_img_url) && output.parsing_img_url.length > 0) {
      const parsingUrl = output.parsing_img_url[0]
      if (parsingUrl && parsingUrl !== 'null' && parsingUrl !== 'None') {
        console.log('使用分割图片（RGBA透明背景）:', parsingUrl)
        return parsingUrl
      }
    }
    
    // 其次使用crop_img_url（RGB格式，用于AI试衣）
    if (output.crop_img_url && Array.isArray(output.crop_img_url) && output.crop_img_url.length > 0) {
      const cropUrl = output.crop_img_url[0]
      if (cropUrl && cropUrl !== 'null' && cropUrl !== 'None') {
        console.log('使用裁剪图片（RGB格式）:', cropUrl)
        return cropUrl
      }
    }
    
    console.warn('未找到有效的分割结果图片，检查数据结构:', output)
    return null
  },

  // 开始智能抠图流程
  startImageExtraction(tempFilePath, originalFileID) {
    const that = this
    
    that.setData({
      isExtracting: true,
      extractionProgress: 0,
      currentGuide: {
        main: '正在智能抠图中...',
        sub: 'AI正在识别衣物轮廓，请稍候'
      }
    })
    
    // 模拟进度更新
    const progressInterval = setInterval(() => {
      that.setData({
        extractionProgress: Math.min(that.data.extractionProgress + 5, 90)
      })
    }, 300)
    
    // 调用阿里云DashScope智能抠图
    aliyunImageSegmentation.segmentClothingFromLocal(tempFilePath, ['upper'])
      .then(result => {
        clearInterval(progressInterval)
        
        if (result.success) {
          that.setData({
            extractionProgress: 100,
            currentGuide: {
              main: '抠图完成！',
              sub: '衣物轮廓已成功提取'
            }
          })

          // 构建图像数据对象 - 使用阿里云返回的分割结果
          const imageData = {
            originalImage: originalFileID,
            transparentImage: this.getTransparentImageFromResult(result.data),
            segmentationResult: result.data
          }

          console.log('分割结果处理完成:', imageData)

          // 短暂延迟后跳转到信息录入页面
          setTimeout(() => {
            that.uploadComplete(imageData)
          }, 800)
        } else {
          throw new Error(result.error || '分割失败')
        }
      })
      .catch(error => {
        clearInterval(progressInterval)
        console.error('阿里云智能抠图失败:', error)
        
        // 抠图失败，使用原图继续流程
        wx.showModal({
          title: '抠图失败',
          content: 'AI抠图处理失败，是否使用原图继续？',
          confirmText: '使用原图',
          cancelText: '重新上传',
          success: (res) => {
            if (res.confirm) {
              that.uploadComplete({
                originalImage: originalFileID,
                transparentImage: originalFileID // 使用原图
              })
            } else {
              that.setData({
                uploading: false,
                isExtracting: false,
                uploadedImage: null
              })
            }
          }
        })
      })
  },

  // 上传完成，跳转页面
  uploadComplete(imageData) {
    // 将原图和抠图后的图片信息传递给下一页（兼容微信小程序环境）
    const params = `originalImage=${encodeURIComponent(imageData.originalImage)}&transparentImage=${encodeURIComponent(imageData.transparentImage)}`
    
    wx.navigateTo({
      url: `/pages/clothingInfo/clothingInfo?${params}`
    })
  }
})