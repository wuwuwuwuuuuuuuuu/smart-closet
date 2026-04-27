const db = wx.cloud.database()
const app = getApp()

Page({
  data: {
    // 🌟 画布合成尺寸 (9:16，适配衣橱历史保存)
    canvasWidth: 750,
    canvasHeight: 1334,

    currentBackground: '',
    tryonType: null,
    originalTryonImage: null, 
    displayImage: null,       
    transparentFileID: null,  // 用于AI文字生成

    localTransparentPath: null, // 🌟 用于本地 Canvas 合成

    isSaving: false,
    isFusing: false,
    showPromptModal: false,
    promptText: '',
  },

  onLoad(options) {
    const imageParam = options.productImage || options.aiImage || options.img || ''
    if (!imageParam) return
    const tryonImgUrl = decodeURIComponent(imageParam)
    this.setData({
      tryonType: options.productImage ? 'product' : 'ai',
      originalTryonImage: tryonImgUrl,
      displayImage: tryonImgUrl // 初始展示原图
    })

    const transparentBase64 = wx.getStorageSync('currentTransparentImage')
    if (transparentBase64) {
      this.prepareTransparentImage(transparentBase64)
      // wx.removeStorageSync('currentTransparentImage')调试期建议先不清理
    }
  },

  // 🌟 将 Base64 实体化：同时准备云端 ID 和本地路径
  async prepareTransparentImage(base64Data) {
    wx.showLoading({ title: '处理模特数据...' })
    try {
      const fs = wx.getFileSystemManager()
      const base64Raw = base64Data.replace(/^data:image\/\w+;base64,/, "")
      const tempFilePath = `${wx.env.USER_DATA_PATH}/tmp_person_${Date.now()}.png`
      fs.writeFileSync(tempFilePath, base64Raw, 'base64')
      
      // 🌟 1. 存入 data 供本地 Canvas 使用
      this.setData({ localTransparentPath: tempFilePath })
      console.log('✅ 本地人像文件就绪:', tempFilePath)

      // 🌟 2. 同时上传云存储，获取 ID (为AI文字生成预热)
      const cloudPath = `transparent_cache/${Date.now()}_${Math.floor(Math.random() * 1000)}.png`
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: tempFilePath })
      this.setData({ transparentFileID: uploadRes.fileID })
      console.log('✅ 云端人像 ID 就绪:', uploadRes.fileID)
    } catch (err) {
      console.error('❌ 人像数据处理失败:', err)
    } finally {
      wx.hideLoading()
    }
  },

  // === 🚀 [方案 A] 选择相册图片 -> 本地 Canvas 离屏合成 (Sticker Mode) ===
  chooseLocalBackground() {
    if (!this.data.localTransparentPath) {
      return wx.showToast({ title: '人像数据未就绪，请稍后', icon: 'none' })
    }
    
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: async (res) => {
        // 直接触发本地合成，不走 AI 云函数！
        this.generateByLocalCanvas(res.tempFilePaths[0])
      }
    })
  },

  // 🌟 精准无拉伸 Canvas 合成核心逻辑
  generateByLocalCanvas(bgLocalPath) {
    const that = this
    const personPath = this.data.localTransparentPath
    
    this.setData({ isFusing: true })
    wx.showLoading({ title: '合成海报中...', mask: true })

    const query = wx.createSelectorQuery()
    query.select('#compCanvas')
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res[0]) return that.handleFusionError(new Error('未找到 canvas 节点'))

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const { canvasWidth: width, canvasHeight: height } = that.data
        
        // 设置合成的画板尺寸 (9:16)
        canvas.width = width
        canvas.height = height

        try {
          const loadImg = (src) => {
            return new Promise((resImg, rejImg) => {
              const img = canvas.createImage()
              img.src = src
              img.onload = () => resImg(img)
              img.onerror = () => rejImg(new Error('图片加载失败: ' + src))
            })
          }

          // 1. 🌟 绘制背景 ( aspectFill 铺满，裁剪多余)
          const bgImg = await loadImg(bgLocalPath)
          const bgRatio = bgImg.width / bgImg.height
          const canvasRatio = width / height
          let renderBgW, renderBgH, renderBgX, renderBgY

          if (bgRatio > canvasRatio) {
            renderBgH = height
            renderBgW = bgImg.width * (height / bgImg.height)
            renderBgX = (width - renderBgW) / 2
            renderBgY = 0
          } else {
            renderBgW = width
            renderBgH = bgImg.height * (width / bgImg.width)
            renderBgX = 0
            renderBgY = (height - renderBgH) / 2
          }
          ctx.drawImage(bgImg, renderBgX, renderBgY, renderBgW, renderBgH)

          // 2. 🌟 绘制透明人像 ( aspectFit 保持比例，居中到底部)
          const personImg = await loadImg(personPath)
          const pRatio = personImg.width / personImg.height
          
          let renderPW = width
          let renderPH = renderPW / pRatio
          let renderPX = 0
          let renderPY = height - renderPH // 靠底部对齐

          // 如果人像过高，则以高度为基准缩放
          if (renderPH > height) {
             renderPH = height
             renderPW = renderPH * pRatio
             renderPX = (width - renderPW) / 2
             renderPY = 0
          }
          
          ctx.drawImage(personImg, renderPX, renderPY, renderPW, renderPH)

          // 3. 🌟 导出本地临时图片 (destWidth 设为合成宽度，保证高清)
          wx.canvasToTempFilePath({
            canvas,
            destWidth: width,
            destHeight: height,
            quality: 1.0,
            success: (resExport) => {
              wx.hideLoading()
              const localFinalUrl = resExport.tempFilePath
              
              // 1. 更新前端展示 (显示这个 wxfile:// 链接)
              that.setData({
                isFusing: false,
                currentBackground: '相册自定义',
                displayImage: localFinalUrl 
              })
              
              // 2. 🌟 核心：触发静默转存到云端 (为了衣橱历史)
              that.autoSaveToCloud(localFinalUrl)
              
              wx.showToast({ title: '贴合完毕！', icon: 'success' })
            },
            fail: (err) => that.handleFusionError(err)
          })
        } catch (e) {
          that.handleFusionError(e)
        }
      })
  },

  handleFusionError(err) {
    wx.hideLoading()
    this.setData({ isFusing: false })
    wx.showToast({ title: '合成失败', icon: 'none' })
    console.error('❌ Canvas 合成失败:', err)
  },

  // === ☁️ [方案 B] 文字出图 -> 呼叫云端 AI 接口 ( Wanx HighEnd Mode) ===
  async callAiFusion(params) {
    if (!this.data.transparentFileID) {
      return wx.showToast({ title: 'AI 人像未就绪，请等2秒', icon: 'none' })
    }
    
    this.setData({ isFusing: true })
    wx.showLoading({ title: 'AI 场景融合中...', mask: true })

    try {
      // 🌟 核心改变：只传 prompt，做纯文本场景生成！
      const aiRes = await wx.cloud.callFunction({
        name: 'aiSceneFusion',
        data: {
          personFileID: this.data.transparentFileID,
          prompt: params.prompt || null
        }
      })

      wx.hideLoading()
      this.setData({ isFusing: false, showPromptModal: false })

      if (aiRes.result && aiRes.result.code === 200) {
        const generatedImgUrl = aiRes.result.data.result_url
        
        this.setData({
          currentBackground: 'AI文字生成',
          displayImage: generatedImgUrl 
        })
        wx.showToast({ title: '大片生成完毕！', icon: 'success' })

        // 🌟 触发静默保存到云端历史
        this.autoSaveToCloud(generatedImgUrl)

      } else {
        throw new Error(aiRes.result ? aiRes.result.message : '生成失败')
      }
    } catch (err) {
      wx.hideLoading()
      this.setData({ isFusing: false, showPromptModal: false })
      wx.showToast({ title: '场景融合失败', icon: 'none' })
    }
  },

  openPromptModal() { this.setData({ showPromptModal: true }) },
  closePromptModal() { this.setData({ showPromptModal: false }) },
  onPromptInput(e) { this.setData({ promptText: e.detail.value }) },
  generateByPrompt() {
    if (!this.data.promptText.trim()) return wx.showToast({ title: '请输入描述', icon: 'none' })
    this.callAiFusion({ prompt: this.data.promptText.trim() })
  },

  // === 🤖 通用后台静默保存（修复兼容本地路径） ===
  async autoSaveToCloud(imgUrl) {
    try {
      console.log('🤖 后台静默保存启动，准备路径:', imgUrl)
      
      let finalTempPath = imgUrl;

      // 🌟 新增：如果传来的是 HTTPS 链接（大模型生成的），需要先下载；如果是本地链接（Canvas生成的），直接用。
      if (imgUrl.startsWith('http')) {
          console.log('正在下载网络图片...')
          const downloadRes = await new Promise((resolve, reject) => {
            wx.downloadFile({ url: imgUrl, success: resolve, fail: reject })
          })
          finalTempPath = downloadRes.tempFilePath;
      }
      
      console.log('正在上传至私人云存储...')
      // 存入云存储
      const cloudPath = `tryon_history/${Date.now()}_${Math.floor(Math.random() * 1000)}.png`
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: finalTempPath })
      
      console.log('正在写入衣橱历史数据库...')
      // 写入数据库
      const userId = app.globalData.currentUserId || 'unknown_user'
      await db.collection('tryon_history').add({
        data: {
          userId: userId, 
          finalImage: uploadRes.fileID,          
          originalTryonImage: this.data.originalTryonImage, 
          sceneUrl: this.data.currentBackground, 
          createTime: db.serverDate()
        }
      })
      console.log('✅ 后台静默保存成功！安全！')
    } catch (error) {
      console.error('❌ 静默保存失败详情:', error)
    }
  },

  // === 📸 手动保存至相册 ===
  saveToAlbum() {
    if (this.data.isSaving || !this.data.displayImage) return
    this.setData({ isSaving: true })
    
    // wx.downloadFile 如果是本地 wxfile:// 也会直接成功返回本地路径
    wx.showLoading({ title: '保存中...', mask: true })

    wx.downloadFile({
      url: this.data.displayImage,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading()
            wx.showToast({ title: '保存相册成功', icon: 'success' })
            this.setData({ isSaving: false })
          },
          fail: (err) => {
            wx.hideLoading()
            this.setData({ isSaving: false })
            if (err.errMsg.includes('fail auth')) {
              wx.showModal({
                title: '需要权限', content: '请开启保存相册的权限。', confirmText: '去设置',
                success: (modalRes) => { if (modalRes.confirm) wx.openSetting() }
              })
            } else {
              wx.showToast({ title: '相册保存失败', icon: 'none' })
            }
          }
        })
      },
      fail: () => {
        wx.hideLoading()
        this.setData({ isSaving: false })
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    })
  },

  goBack() { wx.navigateBack() }
})