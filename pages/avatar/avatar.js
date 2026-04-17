const app = getApp()
const db = wx.cloud.database()
const _ = db.command 

Page({
  data: {
    avatarList: [], // 存储所有的云端形象链接
    currentAvatar: '' // 当前正在使用的形象
  },

  onShow() {
    this.loadAllAvatars()
  },

  // ☁️ 获取该用户所有的历史形象
  async loadAllAvatars() {
    const userId = app.globalData.currentUserId
    if (!userId) return

    wx.showLoading({ title: '加载图库中...' })
    try {
      const res = await db.collection('users').doc(userId).get()
      const userData = res.data
      
      this.setData({
        avatarList: userData.avatarList || [],
        currentAvatar: userData.avatarImage || ''
      })
      
      // 兼容历史脏数据
      if (userData.avatarImage && !this.data.avatarList.includes(userData.avatarImage)) {
        this.setData({ avatarList: [userData.avatarImage, ...this.data.avatarList] })
      }
      wx.hideLoading()
    } catch (err) {
      console.log('加载分身库失败或用户记录不存在')
      wx.hideLoading()
    }
  },

  // 🌟 点击某张照片：将其设为“当前试穿模特”
  async setDefaultAvatar(e) {
    const targetUrl = e.currentTarget.dataset.url
    const userId = app.globalData.currentUserId
    
    if (this.data.currentAvatar === targetUrl) return 

    wx.showLoading({ title: '切换中...' })
    try {
      await db.collection('users').doc(userId).update({
        data: { avatarImage: targetUrl }
      })
      
      this.setData({ currentAvatar: targetUrl })
      wx.hideLoading()
      wx.showToast({ title: '已设为试穿模特', icon: 'success' })
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1000)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '切换失败', icon: 'none' })
    }
  },

  // 📸 上传新形象（防覆盖版）
  uploadNewAvatar() {
    const userId = app.globalData.currentUserId
    if (!userId) return wx.showToast({ title: '请先登录', icon: 'none' })

    wx.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempPath = res.tempFilePaths[0]
        wx.showLoading({ title: '正在上传云端...', mask: true })

        try {
          const cloudPath = `avatars/user_${userId}_${Date.now()}.png`
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: tempPath
          })
          const cloudFileID = uploadRes.fileID

          const newAvatarList = [...this.data.avatarList, cloudFileID]

          await db.collection('users').doc(userId).update({
            data: {
              avatarList: newAvatarList, 
              avatarImage: cloudFileID,  
              updated_at: db.serverDate()
            }
          })

          wx.hideLoading()
          wx.showToast({ title: '添加成功！', icon: 'success' })
          this.loadAllAvatars()

        } catch (err) {
          wx.hideLoading()
          console.error('上传失败:', err)
          wx.showToast({ title: '上传失败', icon: 'error' })
        }
      }
    })
  },

  // 🗑️ 删除某张照片（防错版）
  deleteAvatar(e) {
    const targetUrl = e.currentTarget.dataset.url
    const userId = app.globalData.currentUserId

    wx.showModal({
      title: '确认删除',
      content: '删除后无法找回，确认要删掉这个形象吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          try {
            await wx.cloud.deleteFile({ fileList: [targetUrl] })

            const newAvatarList = this.data.avatarList.filter(url => url !== targetUrl)
            
            let updateData = {
              avatarList: newAvatarList 
            }
            
            if (this.data.currentAvatar === targetUrl) {
              updateData.avatarImage = ''
              this.setData({ currentAvatar: '' })
            }

            await db.collection('users').doc(userId).update({
              data: updateData
            })

            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadAllAvatars()

          } catch (err) {
            wx.hideLoading()
            console.error('删除失败:', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  } // 👈 刚才你漏掉的应该就是这里结尾的两个大括号
})