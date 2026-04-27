const db = wx.cloud.database()
const { logWarning, logError } = require('../../utils/logger')
const app = getApp()

Page({
  data: {
    currentBackground: 'https://picsum.photos/750/1334?random=44',
    showBackgroundModal: false,
    tryonType: null,
    tryonImage: null,
    transparentImage: null, // 🌟 接收到的透明人像
    isSaving: false,        // 防止连击保存
    backgroundOptions: [
      { id: 1, name: '场景1', image: 'https://picsum.photos/200/200?random=13' },
      { id: 2, name: '场景2', image: 'https://picsum.photos/200/200?random=14' },
      { id: 3, name: '场景3', image: 'https://picsum.photos/200/200?random=18' },
      { id: 4, name: '场景4', image: 'https://picsum.photos/200/200?random=19' }
    ]
  },

  onLoad(options) {
    console.log('预览页加载', options)

    const imageParam = options.productImage || options.aiImage || options.img || ''
    if (!imageParam) {
      logWarning('preview.onLoad', 'missing preview image param')
      return
    }

    this.setData({
      tryonType: options.productImage ? 'product' : 'ai',
      tryonImage: decodeURIComponent(imageParam)
    })
  },

  onShow() {
    console.log('预览页显示')
  },

  goBack() {
    wx.navigateBack()
  },

  showBackgroundOptions() {
    this.setData({ showBackgroundModal: true })
  },

  hideBackgroundModal() {
    this.setData({ showBackgroundModal: false })
  },

  selectBackground(e) {
    const background = e.currentTarget.dataset.background
    this.setData({ currentBackground: background })
  },

  chooseLocalBackground() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: res => {
        this.setData({ currentBackground: res.tempFilePaths[0] })
        wx.showToast({ title: '背景设置成功', icon: 'success' })
      },
      fail: err => {
        console.error('选择背景失败:', err)
      }
    })
  },

  confirmBackground() {
    this.hideBackgroundModal()
    wx.showToast({ title: '背景已更新', icon: 'success' })
  },

  generatePoster() {
    wx.navigateTo({ url: '/pages/poster/poster' })
  },

  // === 🌟 核心引擎：合成并存入历史 ===
  async saveToHistory() {
    if (this.data.isSaving) return
    this.setData({ isSaving: true })

    wx.showLoading({ title: '正在合成并保存...', mask: true })

    try {
      // 1. 调用 Canvas 合成引擎，拿到最终图片的临时路径
      const tempFilePath = await this.synthesizeImage()

      // 2. 上传合成后的图片到云存储
      const cloudPath = `tryon_history/${Date.now()}_${Math.floor(Math.random() * 1000)}.png`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath
      })

      // 3. 将记录写入历史数据库
      const userId = app.globalData.currentUserId || 'unknown_user'
      await db.collection('tryon_history').add({
        data: {
          userId: userId,
          finalImage: uploadRes.fileID,          // 最终合成的图片ID
          originalTryonImage: this.data.tryonImage, // 原始带有背景的换装图
          sceneUrl: this.data.currentBackground, // 选择的背景
          createTime: db.serverDate()
        }
      })

      wx.hideLoading()
      wx.showToast({ title: '已存入历史记录', icon: 'success' })
      this.setData({ isSaving: false })

    } catch (error) {
      wx.hideLoading()
      this.setData({ isSaving: false })
      console.error('保存历史失败:', error)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

// === 🌟 Canvas 2D 离屏合成逻辑 (修复比例拉伸版) ===
synthesizeImage() {
  return new Promise((resolve, reject) => {
    const query = wx.createSelectorQuery()
    query.select('#compCanvas')
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res[0]) return reject(new Error('未找到 canvas 节点'))

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        
        // 设定合成的高清画板尺寸 (9:16)
        const width = 750
        const height = 1334
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

          // 1. 绘制背景 (模拟 aspectFill: 铺满全屏，裁剪多余部分)
          const bgInfo = await wx.getImageInfo({ src: this.data.currentBackground })
          const bgImg = await loadImg(bgInfo.path)
          
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

          // 2. 绘制人像 (模拟 aspectFit: 保持比例，底部对齐)
          const personSrc = this.data.transparentImage || this.data.tryonImage
          let personFinalSrc = personSrc
          if (!personSrc.startsWith('data:image') && !personSrc.startsWith('wxfile://')) {
             const personInfo = await wx.getImageInfo({ src: personSrc })
             personFinalSrc = personInfo.path
          }
          const personImg = await loadImg(personFinalSrc)

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

          // 3. 导出高清图片
          wx.canvasToTempFilePath({
            canvas,
            destWidth: width,
            destHeight: height,
            success: (resExport) => resolve(resExport.tempFilePath),
            fail: reject
          })
        } catch (e) {
          reject(e)
        }
      })
  })
}
})

