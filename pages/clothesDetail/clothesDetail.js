const db = wx.cloud.database()

Page({
  data: {
    id: '',
    info: null,
    
    // 标签编辑相关的状态变量
    isEditingTags: false, // 是否处于编辑模式
    editedTags: [],       // 正在编辑中的标签数组草稿
    newTagInput: ''       // 输入框的内容
  },

  onLoad(options) {
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
      
      if (rawData && rawData.image) {
        rawData.image = rawData.image.trim() 
      }

      this.setData({
        info: rawData
      })
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '获取详情失败', icon: 'none' })
    }
  },

  // ================= 🌟 标签编辑核心逻辑 =================

  // 开启/取消编辑模式
  toggleEditTags() {
    if (this.data.isEditingTags) {
      // 取消编辑，清空草稿
      this.setData({ isEditingTags: false, newTagInput: '' })
    } else {
      // 开启编辑，克隆原标签数组（兼容以前没填标签的情况）
      const currentTags = this.data.info.tags || []
      this.setData({
        isEditingTags: true,
        editedTags: [...currentTags],
        newTagInput: ''
      })
    }
  },

  // 监听标签输入
  onTagInput(e) {
    this.setData({ newTagInput: e.detail.value })
  },

  // 添加新标签
  addTag() {
    const tag = this.data.newTagInput.trim()
    if (!tag) {
      return wx.showToast({ title: '标签不能为空', icon: 'none' })
    }
    if (this.data.editedTags.includes(tag)) {
      return wx.showToast({ title: '该标签已存在', icon: 'none' })
    }
    
    // 追加到草稿并清空输入框
    this.setData({
      editedTags: [...this.data.editedTags, tag],
      newTagInput: '' 
    })
  },

  // 移除草稿中的某个标签
  removeEditedTag(e) {
    const index = e.currentTarget.dataset.index
    const newTags = [...this.data.editedTags]
    newTags.splice(index, 1)
    this.setData({ editedTags: newTags })
  },

  // ☁️ 保存标签到云数据库
  async saveTags() {
    wx.showLoading({ title: '保存中...' })
    try {
      await db.collection('clothes').doc(this.data.id).update({
        data: {
          tags: this.data.editedTags,
          updated_at: db.serverDate()
        }
      })
      
      // 更新页面数据并退出编辑模式
      this.setData({
        'info.tags': this.data.editedTags,
        isEditingTags: false
      })
      
      wx.hideLoading()
      wx.showToast({ title: '标签已更新', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('更新标签失败:', err)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  // ================= 🗑️ 移除逻辑 =================
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

  async executeDelete() {
    wx.showLoading({ title: '正在移除...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'deleteClothing',
        data: { id: this.data.id }
      })

      wx.hideLoading()
      if (res.result.code === 200) {
        wx.showToast({
          title: '已成功移除',
          icon: 'success',
          duration: 2000,
          success: () => {
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