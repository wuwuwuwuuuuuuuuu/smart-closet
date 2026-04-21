/**
 * 服饰上传页面逻辑
 * 功能：拍照/相册上传衣物图片，智能抠图，跳转到信息录入
 * 集成百度AI智能抠图API
 */
const baiduImageSegmentation = require('../../utils/baidu-image-segmentation')

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
  
  // 先上传原图到云端，然后进行智能抠图
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
    success: (res) => {/**
    * 服饰上传页面逻辑
    * 功能：拍照/相册上传衣物图片，智能抠图，跳转到信息录入
    * 使用云函数调用百度AI智能抠图API
    */
   
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
     
     // 先上传原图到云端，然后进行智能抠图
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
   
         // 3. 开始智能抠图流程
         that.startImageExtraction(tempFilePath, fileID)
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
   
     // 将图片转换为base64
     that.imageToBase64(tempFilePath)
       .then(imageBase64 => {
         // 调用云函数进行智能抠图
         return wx.cloud.callFunction({
           name: 'imageSegmentation',
           data: {
             imageBase64: imageBase64,
             options: {
               refineMask: true,
               returnForm: 'rgba'
             }
           }
         })
       })
       .then(result => {
         clearInterval(progressInterval)
         
         if (result.result.success) {
           that.setData({
             extractionProgress: 100,
             currentGuide: {
               main: '抠图完成！',
               sub: '衣物轮廓已成功提取'
             }
           })
   
           // 短暂延迟后跳转到信息录入页面
           setTimeout(() => {
             that.uploadComplete({
               originalImage: originalFileID,
               transparentImage: result.result.data.transparentImage
             })
           }, 800)
         } else {
           throw new Error(result.result.message)
         }
       })
       .catch(error => {
         clearInterval(progressInterval)
         console.error('智能抠图失败:', error)
         
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
   
   // 将图片转换为base64
     imageToBase64(filePath) {
       return new Promise((resolve, reject) => {
         wx.getFileSystemManager().readFile({
           filePath: filePath,
           encoding: 'base64',
           success: (res) => {
             resolve(res.data)
           },
           fail: (err) => {
             reject(new Error('图片读取失败: ' + err.errMsg))
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
   
      // 上传成功，拿到云端的永久链接 (长这样：cloud://...)
      const fileID = res.fileID
      console.log('✅ 图片真实上传成功，云端文件ID:', fileID)

      that.setData({
        uploadProgress: 100,
        currentGuide: { main: '上传成功！', sub: '准备录入信息...' }
      })

      // 3. 开始智能抠图流程
      that.startImageExtraction(tempFilePath, fileID)
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

  // 调用百度AI智能抠图
  baiduImageSegmentation.extractClothing(tempFilePath)
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

        // 短暂延迟后跳转到信息录入页面
        setTimeout(() => {
          that.uploadComplete({
            originalImage: originalFileID,
            transparentImage: result.cloudFileId
          })
        }, 800)
      } else {
        throw new Error(result.error)
      }
    })
    .catch(error => {
      clearInterval(progressInterval)
      console.error('智能抠图失败:', error)
      
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