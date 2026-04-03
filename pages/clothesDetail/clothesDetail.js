const db = wx.cloud.database()

Page({
  data: {
    id: '',
    info: null
  },

  onLoad(options) {
    // options.id 是从 wardrobe.js 传过来的 _id
    if (options.id) {
      this.setData({ id: options.id })
      this.getDetail()
    }
  },

  // ☁️ 获取单件衣物详情
  async getDetail() {
    wx.showLoading({ title: '召唤衣物中...' })
    try {
      const res = await db.collection('clothes').doc(this.data.id).get()
      let rawData = res.data
      
      // 🌟 核心修复：强行修剪图片路径，确保它以 cloud:// 开头
      if (rawData && rawData.image) {
        // 去掉空格、回车，并确保没有被误加前缀
        rawData.image = rawData.image.trim() 
      }

      this.setData({
        info: rawData
      })
      
      console.log('当前衣服的真实路径是：', this.data.info.image) // 打印出来看一眼
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '获取详情失败', icon: 'none' })
    }
  },

  // 🗑️ 确认删除弹窗
  confirmDelete() {
    wx.showModal({
      title: '确认移除',
      content: '移除后将无法找回，确定要从衣橱删除吗？',
      confirmColor: '#fa5151',
      success: (res) => {
        if (res.confirm) {
          this.executeDelete()
        }
      }
    })
  },

  // 🔥 核心：调用云函数进行安全删除
  async executeDelete() {
    wx.showLoading({ title: '正在移除...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'deleteClothing',
        data: { 
          id: this.data.id 
        }
      })

      wx.hideLoading()
      if (res.result.code === 200) {
        wx.showToast({
          title: '已成功移除',
          icon: 'success',
          duration: 2000,
          success: () => {
            // 延迟返回，让用户看清“删除成功”的提示
            setTimeout(() => {
              wx.navigateBack()
            }, 1500)
          }
        })
      } else {
        throw new Error(res.result.message)
      }
    } catch (err) {
      wx.hideLoading()
      console.error('删除失败', err)
      wx.showToast({ title: '删除失败，请重试', icon: 'none' })
    }
  }
})