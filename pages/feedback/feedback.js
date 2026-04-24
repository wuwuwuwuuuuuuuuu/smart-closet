// pages/feedback/feedback.js
const app = getApp()

Page({
  data: {
    feedbackType: 'bug', // 默认选择问题反馈
    feedbackContent: '',
    contactInfo: '',
    canSubmit: false
  },

  onLoad(options) {
    // 页面加载时初始化
    this.checkSubmitButton()
  },

  // 选择反馈类型
  selectType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      feedbackType: type
    })
  },

  // 反馈内容输入
  onContentInput(e) {
    this.setData({
      feedbackContent: e.detail.value
    })
    this.checkSubmitButton()
  },

  // 联系方式输入
  onContactInput(e) {
    this.setData({
      contactInfo: e.detail.value
    })
  },

  // 检查是否可以提交
  checkSubmitButton() {
    const canSubmit = this.data.feedbackContent.trim().length > 0
    this.setData({
      canSubmit: canSubmit
    })
  },

  // 提交反馈
  async submitFeedback() {
    if (!this.data.canSubmit) return

    const { feedbackType, feedbackContent, contactInfo } = this.data
    const userId = app.globalData.currentUserId

    wx.showLoading({
      title: '提交中...',
      mask: true
    })

    try {
      // 获取当前时间
      const now = new Date()
      const timestamp = now.getTime()
      const formattedTime = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

      // 保存反馈到云数据库
      const db = wx.cloud.database()
      
      // 先尝试创建集合（如果不存在）
      try {
        // 尝试查询集合，如果不存在会抛出错误
        await db.collection('feedback').limit(1).get()
      } catch (error) {
        // 集合不存在，调用云函数初始化集合
        console.log('feedback集合不存在，正在初始化...')
        await wx.cloud.callFunction({
          name: 'initFeedback',
          data: {}
        })
      }
      
      // 添加反馈记录
      const result = await db.collection('feedback').add({
        data: {
          userId: userId,
          feedbackType: feedbackType,
          feedbackContent: feedbackContent.trim(),
          contactInfo: contactInfo.trim(),
          status: 'pending', // pending, resolved
          createTime: timestamp,
          formattedTime: formattedTime,
          userAgent: wx.getSystemInfoSync()
        }
      })

      wx.hideLoading()

      // 提交成功提示
      wx.showModal({
        title: '提交成功',
        content: '感谢您的反馈！我们会尽快处理您的问题。',
        showCancel: false,
        confirmText: '确定',
        success: (res) => {
          if (res.confirm) {
            // 返回上一页
            wx.navigateBack()
          }
        }
      })

    } catch (error) {
      wx.hideLoading()
      console.error('提交反馈失败:', error)
      
      wx.showModal({
        title: '提交失败',
        content: '网络异常，请稍后重试',
        showCancel: false,
        confirmText: '确定'
      })
    }
  },

  // 页面卸载时清理数据
  onUnload() {
    this.setData({
      feedbackContent: '',
      contactInfo: '',
      canSubmit: false
    })
  }
})