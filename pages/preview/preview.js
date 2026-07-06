const db = wx.cloud.database()
const app = getApp()
const outfitService = require('../../services/outfitService')
const { ensureOutfitImageFileID } = require('../../utils/outfitImage')
const {
  getCurrentTryonContext,
  clearCurrentTryonContext,
  isContextForResult,
  createTryonRequestId
} = require('../../utils/currentTryonContext')

Page({
  data: {
    canvasWidth: 750,
    canvasHeight: 1334,

    currentBackground: '',
    tryonType: null,
    originalTryonImage: null, 
    displayImage: null,       
    transparentFileID: null, 

    localTransparentPath: null, 

    isSaving: false,
    isFusing: false,
    showPromptModal: false,
    promptText: '',
    
    isCollected: false, // 🌟 新增：追踪是否已收藏

    tryonClothingIds: [],
    tryonSource: 'unknown',
    outfitRequestId: '',
    isOutfitSaving: false,
    isOutfitSaved: false
  },

  onLoad(options) {
    const imageParam = options.productImage || options.aiImage || options.img || ''
    if (!imageParam) return
    const tryonImgUrl = decodeURIComponent(imageParam)
    this.setData({
      tryonType: options.productImage ? 'product' : 'ai',
      originalTryonImage: tryonImgUrl,
      displayImage: tryonImgUrl,
      outfitRequestId: createTryonRequestId(tryonImgUrl),
      isOutfitSaving: false,
      isOutfitSaved: false
    })
    this.initialTryonResultImage = tryonImgUrl
    this.loadTryonContext(tryonImgUrl)
    const transparentBase64 = wx.getStorageSync('currentTransparentImage')
    if (transparentBase64) {
      this.prepareTransparentImage(transparentBase64)
    }
  },

  onShow() {
    console.log('[OUTFIT_REAL_DEBUG] preview onShow after back', {
      requestId: this.data.outfitRequestId,
      displayImage: this.data.displayImage,
      clothingIds: this.data.tryonClothingIds,
      isOutfitSaved: this.data.isOutfitSaved,
      isOutfitSaving: this.data.isOutfitSaving
    })
  },

  loadTryonContext(initialResultImage) {
    const context = getCurrentTryonContext()
    if (isContextForResult(context, initialResultImage)) {
      this.setData({
        tryonClothingIds: context.clothingIds,
        tryonSource: context.source
      })
      return
    }

    this.setData({
      tryonClothingIds: [],
      tryonSource: 'unknown'
    })
    wx.showToast({
      title: '试穿信息已失效，本次将仅保存图片',
      icon: 'none'
    })
  },

  onUnload() {
    if (this.initialTryonResultImage) {
      clearCurrentTryonContext(this.initialTryonResultImage)
    }
  },

  async prepareTransparentImage(base64Data) {
    wx.showLoading({ title: '处理模特数据...' })
    try {
      const fs = wx.getFileSystemManager()
      const base64Raw = base64Data.replace(/^data:image\/\w+;base64,/, "")
      const tempFilePath = `${wx.env.USER_DATA_PATH}/tmp_person_${Date.now()}.png`
      fs.writeFileSync(tempFilePath, base64Raw, 'base64')
      
      this.setData({ localTransparentPath: tempFilePath })

      const cloudPath = `transparent_cache/${Date.now()}_${Math.floor(Math.random() * 1000)}.png`
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: tempFilePath })
      this.setData({ transparentFileID: uploadRes.fileID })
    } catch (err) {
      console.error('❌ 人像数据处理失败:', err)
    } finally {
      wx.hideLoading()
    }
  },

  chooseLocalBackground() {
    if (!this.data.localTransparentPath) {
      return wx.showToast({ title: '人像数据未就绪，请稍后', icon: 'none' })
    }
    
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: async (res) => {
        this.generateByLocalCanvas(res.tempFilePaths[0])
      }
    })
  },

  generateByLocalCanvas(bgLocalPath) {
    const that = this
    const personPath = this.data.localTransparentPath
    
    this.setData({ isFusing: true, isCollected: false }) // 换了新图，重置收藏状态
    wx.showLoading({ title: '合成海报中...', mask: true })

    const query = wx.createSelectorQuery()
    query.select('#compCanvas')
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res[0]) return that.handleFusionError(new Error('未找到 canvas 节点'))

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const { canvasWidth: width, canvasHeight: height } = that.data
        
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

          const personImg = await loadImg(personPath)
          const pRatio = personImg.width / personImg.height
          
          let renderPW = width
          let renderPH = renderPW / pRatio
          let renderPX = 0
          let renderPY = height - renderPH 

          if (renderPH > height) {
             renderPH = height
             renderPW = renderPH * pRatio
             renderPX = (width - renderPW) / 2
             renderPY = 0
          }
          
          ctx.drawImage(personImg, renderPX, renderPY, renderPW, renderPH)

          wx.canvasToTempFilePath({
            canvas,
            destWidth: width,
            destHeight: height,
            quality: 1.0,
            success: (resExport) => {
              wx.hideLoading()
              const localFinalUrl = resExport.tempFilePath
              
              that.setData({
                isFusing: false,
                currentBackground: '相册自定义',
                displayImage: localFinalUrl 
              })
              
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

  async callAiFusion(params) {
    if (!this.data.transparentFileID) {
      return wx.showToast({ title: 'AI 人像未就绪，请等2秒', icon: 'none' })
    }
    
    this.setData({ isFusing: true, isCollected: false }) // 换了新图，重置收藏状态
    wx.showLoading({ title: 'AI 场景融合中...', mask: true })

    try {
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

  async autoSaveToCloud(imgUrl) {
    try {
      let finalTempPath = imgUrl;

      if (imgUrl.startsWith('http')) {
          const downloadRes = await new Promise((resolve, reject) => {
            wx.downloadFile({ url: imgUrl, success: resolve, fail: reject })
          })
          finalTempPath = downloadRes.tempFilePath;
      }
      
      const cloudPath = `tryon_history/${Date.now()}_${Math.floor(Math.random() * 1000)}.png`
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: finalTempPath })
      
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
    } catch (error) {
      console.error('❌ 静默保存失败:', error)
    }
  },

  // === 🌟 新增：一键加入收藏夹 ===
  async addToCollection() {
    if (this.data.isCollected) {
      return wx.showToast({ title: '已经收藏过了', icon: 'none' })
    }

    wx.showLoading({ title: '收藏中...', mask: true })
    try {
      let finalTempPath = this.data.displayImage;

      // 如果当前图是网络图，先下载保底
      if (finalTempPath.startsWith('http')) {
          const downloadRes = await new Promise((resolve, reject) => {
            wx.downloadFile({ url: finalTempPath, success: resolve, fail: reject })
          })
          finalTempPath = downloadRes.tempFilePath;
      }
      
      // 独立上传一张到 collections_cache 文件夹
      const cloudPath = `collections_cache/${Date.now()}_${Math.floor(Math.random() * 1000)}.png`
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: finalTempPath })
      
      const userId = app.globalData.currentUserId || 'unknown_user'
      await db.collection('collections').add({
        data: {
          userId: userId,
          finalImage: uploadRes.fileID,      
          originalTryonImage: this.data.originalTryonImage, 
          sceneUrl: this.data.currentBackground || '基础试穿', 
          createTime: db.serverDate()
        }
      })
      
      this.setData({ isCollected: true })
      wx.hideLoading()
      wx.showToast({ title: '已加入收藏夹！', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '收藏失败', icon: 'none' })
      console.error(error)
    }
  },

  saveTodayOutfit() {
    console.log('[OUTFIT_REAL_DEBUG] preview save click', {
      displayImage: this.data.displayImage,
      clothingIds: this.data.tryonClothingIds,
      requestId: this.data.outfitRequestId,
      isOutfitSaved: this.data.isOutfitSaved,
      isOutfitSaving: this.data.isOutfitSaving
    })
    if (this.data.isOutfitSaving || this.data.isOutfitSaved) return
    if (!this.data.displayImage) {
      wx.showToast({ title: '当前没有可保存的穿搭图片', icon: 'none' })
      return
    }

    const hasLinkedClothing = this.data.tryonClothingIds.length > 0
    const content = hasLinkedClothing
      ? '确认保存当前穿搭吗？'
      : '当前穿搭未关联衣橱衣物，保存后不会参与衣物使用统计。'

    wx.showModal({
      title: '保存今日穿搭',
      content,
      cancelText: '取消',
      confirmText: '确认保存',
      success: result => {
        if (result.confirm) {
          this.performSaveTodayOutfit()
        }
      }
    })
  },

  async performSaveTodayOutfit() {
    if (this.data.isOutfitSaving || this.data.isOutfitSaved) return
    const currentDisplayImage = this.data.displayImage
    if (!currentDisplayImage) {
      wx.showToast({ title: '当前没有可保存的穿搭图片', icon: 'none' })
      return
    }

    this.setData({ isOutfitSaving: true })
    try {
      const outfitImageFileID = outfitService.isUsingMock()
        ? currentDisplayImage
        : await ensureOutfitImageFileID(currentDisplayImage)
      const result = await outfitService.saveOutfitRecord({
        outfitImageFileID,
        clothingIds: this.data.tryonClothingIds,
        requestId: this.data.outfitRequestId
      })
      console.log('[OUTFIT_REAL_DEBUG] preview save result', result)

      if (
        result
        && result.code === 409
        && result.data
        && result.data.reason === 'DAILY_OUTFIT_LIMIT_REACHED'
      ) {
        this.setData({
          isOutfitSaving: false,
          isOutfitSaved: false
        })
        this.showOutfitLimitDialog()
        return
      }

      if (!result || result.code !== 200 || !result.data) {
        throw new Error(result && result.message ? result.message : '服务返回格式异常')
      }

      this.setData({ isOutfitSaved: true })
      wx.showModal({
        title: '保存成功',
        content: '今日穿搭保存成功',
        cancelText: '知道了',
        confirmText: '查看今日穿搭',
        success: modalResult => {
          if (modalResult.confirm) {
            wx.navigateTo({ url: '/pages/todayOutfit/todayOutfit' })
          }
        }
      })
    } catch (error) {
      console.error('preview.performSaveTodayOutfit失败:', error)
      wx.showToast({
        title: error && error.message ? error.message : '保存失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ isOutfitSaving: false })
    }
  },

  showOutfitLimitDialog() {
    console.log('[OUTFIT_REAL_DEBUG] limit modal shown')
    wx.showModal({
      title: '今日穿搭已满',
      content: '已保存3套穿搭，是否前往删除一套后再保存？',
      cancelText: '取消',
      confirmText: '去删除',
      success: modalResult => {
        if (modalResult.confirm) {
          wx.navigateTo({
            url: '/pages/todayOutfit/todayOutfit'
          })
        }
      }
    })
  },

  saveToAlbum() {
    if (this.data.isSaving || !this.data.displayImage) return
    this.setData({ isSaving: true })
    
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
