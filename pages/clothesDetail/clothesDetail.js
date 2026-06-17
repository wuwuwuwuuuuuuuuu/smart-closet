const db = wx.cloud.database()

Page({
  data: {
    id: '',
    info: null,
    isEditingTags: false,
    editedTags: [],
    newTagInput: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id })
      this.getDetail()
    }
  },

  async getDetail() {
    wx.showLoading({ title: '加载衣物中...' })
    try {
      const res = await db.collection('clothes').doc(this.data.id).get()
      const rawData = res.data || null

      if (rawData && typeof rawData.image === 'string') {
        rawData.image = rawData.image.trim()
      }

      this.setData({
        info: rawData
      })
    } catch (err) {
      wx.showToast({ title: '获取详情失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  toggleEditTags() {
    if (this.data.isEditingTags) {
      this.setData({
        isEditingTags: false,
        newTagInput: ''
      })
      return
    }

    const currentTags = (this.data.info && this.data.info.tags) || []
    this.setData({
      isEditingTags: true,
      editedTags: [...currentTags],
      newTagInput: ''
    })
  },

  onTagInput(e) {
    this.setData({ newTagInput: e.detail.value })
  },

  // 添加标签到本地编辑列表，等待用户点击保存后再写入云端
  addTag() {
    const tag = (this.data.newTagInput || '').trim()
    if (!tag) {
      wx.showToast({ title: '标签不能为空', icon: 'none' })
      return
    }

    if (this.data.editedTags.includes(tag)) {
      wx.showToast({ title: '该标签已存在', icon: 'none' })
      return
    }

    this.setData({
      editedTags: [...this.data.editedTags, tag],
      newTagInput: ''
    })
  },

  // 从本地编辑列表移除指定标签，等待保存后同步到云端
  removeEditedTag(e) {
    const index = e.currentTarget.dataset.index
    const newTags = [...this.data.editedTags]
    newTags.splice(index, 1)
    this.setData({ editedTags: newTags })
  },

  // 保存标签到云端，成功后同步更新详情页展示数据
  async saveTags() {
    const tags = Array.isArray(this.data.editedTags) ? this.data.editedTags : []

    wx.showLoading({ title: '保存中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateClothing',
        data: {
          id: this.data.id,
          tags
        }
      })

      const result = (res && res.result) || {}
      if (result.code !== 200) {
        throw new Error(result.message || 'updateClothing failed')
      }

      this.setData({
        'info.tags': tags,
        'info.image_embedding_status': result.data && result.data.imageEmbeddingStatus
          ? result.data.imageEmbeddingStatus
          : (this.data.info && this.data.info.image_embedding_status) || '',
        isEditingTags: false
      })

      wx.showToast({ title: '标签已更新', icon: 'success' })
    } catch (err) {
      const message = err && (err.message || err.errMsg)
        ? (err.message || err.errMsg)
        : '未知错误'

      console.error('更新标签失败:', err)
      wx.showToast({
        title: message.includes('Cannot find module')
          ? '云函数依赖缺失，请重新部署'
          : '保存失败，请重试',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

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

      if (res.result.code !== 200) {
        throw new Error(res.result.message)
      }

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
    } catch (err) {
      console.error('删除失败', err)
      wx.showToast({ title: '删除失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
