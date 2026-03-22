// 每日穿搭页逻辑 - 海报展示版
Page({
  data: {
    dateList: [
      { 
        weekDay: '周六', 
        dateNum: '14', 
        isToday: false, 
        ootdContent: '休闲周末穿搭：牛仔裤搭配卫衣，舒适又时尚',
        poster: null
      },
      { 
        weekDay: '周日', 
        dateNum: '15', 
        isToday: false, 
        ootdContent: '周日约会穿搭：连衣裙搭配小外套，甜美优雅',
        poster: null
      },
      { 
        weekDay: '周一', 
        dateNum: '16', 
        isToday: false, 
        ootdContent: '周一上班穿搭：西装外套搭配衬衫，专业干练',
        poster: null
      },
      { 
        weekDay: '今天', 
        dateNum: '17', 
        isToday: true, 
        ootdContent: '今日穿搭：根据天气选择合适搭配，舒适为主',
        poster: null
      },
      { 
        weekDay: '周三', 
        dateNum: '18', 
        isToday: false, 
        ootdContent: '周三休闲穿搭：运动装搭配运动鞋，活力满满',
        poster: null
      },
      { 
        weekDay: '周四', 
        dateNum: '19', 
        isToday: false, 
        ootdContent: '周四商务穿搭：针织衫搭配西裤，简约大方',
        poster: null
      },
      { 
        weekDay: '周五', 
        dateNum: '20', 
        isToday: false, 
        ootdContent: '周五派对穿搭：亮色单品搭配，时尚吸睛',
        poster: null
      }
    ],
    currentDate: '17',
    currentOotdContent: '今日穿搭：根据天气选择合适搭配，舒适为主',
    isAnimating: false,
    selectedPoster: null
  },

  onLoad(options) {
    console.log('每日穿搭页加载', options)
    
    // 检查是否有传递的日期参数
    if (options.selectedDate) {
      const selectedDate = options.selectedDate
      console.log('接收到日期参数:', selectedDate)
      
      // 更新日期列表的选中状态
      const dateList = this.data.dateList.map(item => ({
        ...item,
        isToday: item.dateNum === selectedDate
      }))
      
      // 获取对应日期的OOTD内容
      const selectedItem = dateList.find(item => item.dateNum === selectedDate)
      const newOotdContent = selectedItem ? selectedItem.ootdContent : '默认穿搭内容'
      
      // 检查该日期是否有已保存的海报数据
      const dateKey = `daily_poster_${selectedDate}`
      const savedPoster = wx.getStorageSync(dateKey)
      
      this.setData({
        dateList: dateList,
        currentDate: selectedDate,
        currentOotdContent: newOotdContent,
        selectedPoster: savedPoster || null
      })
      
      console.log('根据参数切换到日期', selectedDate, '的穿搭内容:', newOotdContent)
    }
    
    // 检查是否有从历史页面传递过来的海报数据
    if (options.posterData) {
      try {
        const posterData = JSON.parse(decodeURIComponent(options.posterData))
        this.setData({
          selectedPoster: posterData
        })
        console.log('接收到海报数据:', posterData)
      } catch (err) {
        console.error('解析海报数据失败:', err)
      }
    }
    
    // 检查是否有从本地相册选择的图片
    if (options.selectedImage) {
      const selectedImage = decodeURIComponent(options.selectedImage)
      console.log('接收到本地图片:', selectedImage)
      
      // 创建今日穿搭数据
      const todayOotd = {
        id: new Date().getTime(),
        image: selectedImage,
        date: new Date().toLocaleDateString(),
        title: '今日穿搭',
        description: '记录美好一天'
      }
      
      this.setData({
        selectedPoster: todayOotd
      })
      
      console.log('创建今日穿搭数据:', todayOotd)
    }
  },

  onShow() {
    console.log('每日穿搭页显示')
    
    // 检查本地存储中是否有海报数据
    const selectedPoster = wx.getStorageSync('selectedPoster')
    if (selectedPoster) {
      // 将海报数据与当前日期关联保存
      const dateKey = `daily_poster_${this.data.currentDate}`
      wx.setStorageSync(dateKey, selectedPoster)
      
      this.setData({
        selectedPoster: selectedPoster
      })
      
      console.log('海报数据已保存到日期', this.data.currentDate)
      
      // 清除存储，避免重复显示
      wx.removeStorageSync('selectedPoster')
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 选择日期（带平滑动画）
  selectDate(e) {
    if (this.data.isAnimating) return
    
    const selectedDate = e.currentTarget.dataset.date
    console.log('选择日期:', selectedDate)
    
    // 防止重复点击
    this.setData({ isAnimating: true })
    
    // 更新选中状态
    const dateList = this.data.dateList.map(item => ({
      ...item,
      isToday: item.dateNum === selectedDate
    }))
    
    // 获取对应日期的OOTD内容和海报数据
    const selectedItem = dateList.find(item => item.dateNum === selectedDate)
    const newOotdContent = selectedItem ? selectedItem.ootdContent : '默认穿搭内容'
    
    // 检查该日期是否有已保存的海报数据
    const dateKey = `daily_poster_${selectedDate}`
    const savedPoster = wx.getStorageSync(dateKey)
    
    // 先隐藏内容，然后更新数据，最后显示动画
    this.setData({
      dateList: dateList,
      currentDate: selectedDate,
      currentOotdContent: newOotdContent,
      selectedPoster: savedPoster || null
    })
    
    console.log('切换到日期', selectedDate, '的穿搭内容:', newOotdContent)
    if (savedPoster) {
      console.log('该日期有已保存的海报:', savedPoster)
    }
    
    // 动画完成后重置状态
    setTimeout(() => {
      this.setData({ isAnimating: false })
    }, 500)
  },

  // 选择城市
  selectCity() {
    wx.showActionSheet({
      itemList: ['北京市', '上海市', '广州市', '深圳市', '武汉市', '成都市'],
      success: (res) => {
        const cities = ['北京市', '上海市', '广州市', '深圳市', '武汉市', '成都市']
        const selectedCity = cities[res.tapIndex]
        console.log('选择城市:', selectedCity)
        
        wx.showToast({
          title: `已切换到${selectedCity}`,
          icon: 'success'
        })
      },
      fail: (err) => {
        console.error('选择城市失败:', err)
      }
    })
  },

  // 显示上传选项（修复版）
  showUploadOptions() {
    wx.showActionSheet({
      itemList: ['访问生成海报', '访问本地图片'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 访问生成海报 → 跳转到历史海报页面（选择模式）
          wx.navigateTo({
            url: '/pages/history/history?from=daily'
          })
        } else if (res.tapIndex === 1) {
          // 访问本地图片
          this.chooseLocalImage()
        }
      },
      fail: (err) => {
        console.error('选择上传方式失败:', err)
      }
    })
  },

  // 选择本地图片
  chooseLocalImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['album'],
      success: (res) => {
        console.log('选择图片成功:', res.tempFilePaths[0])
        // 跳转到今日穿搭页面，并传递选择的图片路径和当前日期
        wx.navigateTo({
          url: '/pages/daily/daily?selectedImage=' + encodeURIComponent(res.tempFilePaths[0]) + '&selectedDate=' + this.data.currentDate
        })
      },
      fail: (err) => {
        console.error('选择图片失败:', err)
      }
    })
  },

  // 编辑海报
  editPoster() {
    if (this.data.selectedPoster) {
      wx.navigateTo({
        url: `/pages/poster/poster?posterId=${this.data.selectedPoster.id}`
      })
    }
  },

  // 分享海报
  sharePoster() {
    if (this.data.selectedPoster) {
      wx.showActionSheet({
        itemList: ['分享给好友', '保存到相册'],
        success: (res) => {
          if (res.tapIndex === 0) {
            // 分享给好友
            wx.showToast({
              title: '分享功能开发中',
              icon: 'none'
            })
          } else if (res.tapIndex === 1) {
            // 保存到相册
            this.savePosterToAlbum()
          }
        }
      })
    }
  },

  // 保存海报到相册
  savePosterToAlbum() {
    if (this.data.selectedPoster) {
      wx.saveImageToPhotosAlbum({
        filePath: this.data.selectedPoster.image,
        success: () => {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          })
          
          // 将海报数据与当前日期关联保存
          const dateKey = `daily_poster_${this.data.currentDate}`
          wx.setStorageSync(dateKey, this.data.selectedPoster)
          console.log('海报数据已保存到日期', this.data.currentDate)
        },
        fail: (err) => {
          console.error('保存失败:', err)
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          })
        }
      })
    }
  }
})