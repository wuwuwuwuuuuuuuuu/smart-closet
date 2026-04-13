Page({
  data: {
    dateList: [], // 由代码自动生成真实的日期列表
    currentDate: '', 
    currentMonth: '',
    currentOotdContent: '正在为您拉取实时天气...',
    isAnimating: false,
    selectedPoster: null,

    currentCity: '定位中...',
    weatherInfo: {
      temp: '--',
      text: '获取中',
      icon: '⏳'
    },
    // 🔑 核心密钥：请在这里填入你的高德 Web 服务 Key
    amapKey: '请在这里填入你的高德Web服务Key' 
  },

  onLoad(options) {
    console.log('每日穿搭页加载', options)
    
    // 1. 初始化真实的日期日历（包含今天前后3天）
    this.initRealCalendar()
    
    // 2. 自动获取当前位置和实时天气
    this.getRealTimeWeather()

    // 3. 处理从其他页面传回来的参数（历史海报、相册图片、指定日期）
    this.handleOptions(options)
  },

  onShow() {
    console.log('每日穿搭页显示')
    const selectedPoster = wx.getStorageSync('selectedPoster')
    if (selectedPoster) {
      const dateKey = `daily_poster_${this.data.currentDate}`
      wx.setStorageSync(dateKey, selectedPoster)
      this.setData({ selectedPoster: selectedPoster })
      console.log('海报数据已保存到日期', this.data.currentDate)
      wx.removeStorageSync('selectedPoster')
    }
  },

  // 🌟 初始化真实日历
  initRealCalendar() {
    const today = new Date()
    const daysArr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    let realDateList = []

    for (let i = -3; i <= 3; i++) {
      let targetDate = new Date()
      targetDate.setDate(today.getDate() + i)
      
      realDateList.push({
        weekDay: i === 0 ? '今天' : daysArr[targetDate.getDay()],
        dateNum: targetDate.getDate().toString(),
        isToday: i === 0,
        ootdContent: i === 0 ? '正在分析今日穿搭...' : '点击查看其他日期穿搭记录',
        poster: null
      })
    }

    this.setData({
      dateList: realDateList,
      currentDate: today.getDate().toString(),
      currentMonth: today.getMonth() + 1 + '月'
    })
  },

  // 🌟 自动获取定位与天气
  getRealTimeWeather() {
    wx.showNavigationBarLoading()
    const that = this

    wx.getLocation({
      type: 'wgs84',
      success(res) {
        that.fetchWeatherFromAmap(res.longitude, res.latitude)
      },
      fail(err) {
        console.error('定位失败', err)
        wx.hideNavigationBarLoading()
        that.setData({
          currentCity: '未授权定位',
          'weatherInfo.text': '未知',
          'weatherInfo.temp': '--'
        })
      }
    })
  },

  // 🌟 调用高德 API 获取真实数据
  fetchWeatherFromAmap(lng, lat) {
    const that = this
    const key = this.data.amapKey

    if (key === '请在这里填入你的高德Web服务Key') {
      wx.hideNavigationBarLoading()
      return this.setData({
        currentCity: '北京市(未配Key)',
        weatherInfo: { temp: '25°C', text: '晴', icon: '☀️' }
      })
    }

    // 1. 经纬度转城市
    wx.request({
      url: `https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${key}`,
      success(res) {
        if (res.data.status === '1') {
          const adcode = res.data.regeocode.addressComponent.adcode
          let city = res.data.regeocode.addressComponent.city
          if (!city || city.length === 0) city = res.data.regeocode.addressComponent.province
          
          that.setData({ currentCity: city })

          // 2. 查天气
          wx.request({
            url: `https://restapi.amap.com/v3/weather/weatherInfo?city=${adcode}&key=${key}&extensions=base`,
            success(weatherRes) {
              if (weatherRes.data.status === '1' && weatherRes.data.lives.length > 0) {
                const weatherData = weatherRes.data.lives[0]
                const weatherText = weatherData.weather
                const temp = weatherData.temperature + '°C'
                
                let icon = '☁️'
                if (weatherText.includes('晴')) icon = '☀️'
                if (weatherText.includes('雨')) icon = '🌧️'
                if (weatherText.includes('云') || weatherText.includes('阴')) icon = '⛅'
                if (weatherText.includes('雪')) icon = '❄️'

                that.setData({
                  weatherInfo: { temp, text: weatherText, icon },
                  currentOotdContent: `今日${city}${weatherText}，气温${temp}，根据天气为您推荐舒适穿搭。`
                })
              }
              wx.hideNavigationBarLoading()
            }
          })
        }
      }
    })
  },

  // 🌟 手动切换城市查询天气
  selectCity() {
    const cities = ['北京市', '上海市', '广州市', '深圳市', '武汉市', '成都市']
    const that = this
    wx.showActionSheet({
      itemList: cities,
      success: (res) => {
        const selectedCity = cities[res.tapIndex]
        that.setData({ currentCity: selectedCity })
        wx.showNavigationBarLoading()
        
        const key = that.data.amapKey
        if (key === '请在这里填入你的高德Web服务Key') {
          wx.hideNavigationBarLoading()
          return wx.showToast({ title: '缺少高德Key', icon: 'none' })
        }

        // 按城市名直接查天气
        wx.request({
          url: `https://restapi.amap.com/v3/weather/weatherInfo?city=${encodeURIComponent(selectedCity)}&key=${key}&extensions=base`,
          success(weatherRes) {
            if (weatherRes.data.status === '1' && weatherRes.data.lives.length > 0) {
              const weatherData = weatherRes.data.lives[0]
              const temp = weatherData.temperature + '°C'
              that.setData({
                weatherInfo: { temp, text: weatherData.weather, icon: '⛅' },
                currentOotdContent: `${selectedCity}${weatherData.weather}，气温${temp}，已为您切换穿搭建议。`
              })
            }
            wx.hideNavigationBarLoading()
          }
        })
      }
    })
  },

  // 🌟 处理页面跳转传参
  handleOptions(options) {
    if (options.selectedDate) {
      const selectedDate = options.selectedDate
      const dateList = this.data.dateList.map(item => ({
        ...item,
        isToday: item.dateNum === selectedDate
      }))
      const selectedItem = dateList.find(item => item.dateNum === selectedDate)
      const newOotdContent = selectedItem ? selectedItem.ootdContent : '默认穿搭内容'
      const dateKey = `daily_poster_${selectedDate}`
      const savedPoster = wx.getStorageSync(dateKey)
      
      this.setData({
        dateList: dateList,
        currentDate: selectedDate,
        currentOotdContent: newOotdContent,
        selectedPoster: savedPoster || null
      })
    }
    
    if (options.posterData) {
      try {
        const posterData = JSON.parse(decodeURIComponent(options.posterData))
        this.setData({ selectedPoster: posterData })
      } catch (err) {
        console.error('解析海报数据失败:', err)
      }
    }
    
    if (options.selectedImage) {
      const selectedImage = decodeURIComponent(options.selectedImage)
      const todayOotd = {
        id: new Date().getTime(),
        image: selectedImage,
        date: new Date().toLocaleDateString(),
        title: '每日穿搭',
        description: '记录美好一天'
      }
      this.setData({ selectedPoster: todayOotd })
    }
  },

  // 🌟 日期点击切换
  selectDate(e) {
    if (this.data.isAnimating) return
    const selectedDate = e.currentTarget.dataset.date
    this.setData({ isAnimating: true })
    
    const dateList = this.data.dateList.map(item => ({
      ...item,
      isToday: item.dateNum === selectedDate
    }))
    const selectedItem = dateList.find(item => item.dateNum === selectedDate)
    
    // 如果切回今天，显示天气；如果是其他日子，显示默认文本
    const newOotdContent = selectedItem && selectedItem.weekDay === '今天' 
      ? this.data.currentOotdContent 
      : '点击下方按钮，记录或生成当天的穿搭海报。'

    const dateKey = `daily_poster_${selectedDate}`
    const savedPoster = wx.getStorageSync(dateKey)
    
    this.setData({
      dateList: dateList,
      currentDate: selectedDate,
      selectedPoster: savedPoster || null
    })
    
    // 只有非今天时，才替换 OOTD 文本（防止覆盖掉实时天气文本）
    if (selectedItem && selectedItem.weekDay !== '今天') {
      this.setData({ currentOotdContent: newOotdContent })
    }
    
    setTimeout(() => {
      this.setData({ isAnimating: false })
    }, 500)
  },

  goBack() {
    wx.navigateBack()
  },

  // 🌟 上传与海报选项
  showUploadOptions() {
    wx.showActionSheet({
      itemList: ['访问生成海报', '访问本地图片'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/history/history?from=daily' })
        } else if (res.tapIndex === 1) {
          this.chooseLocalImage()
        }
      }
    })
  },

  chooseLocalImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['album'],
      success: (res) => {
        wx.navigateTo({
          url: '/pages/daily/daily?selectedImage=' + encodeURIComponent(res.tempFilePaths[0]) + '&selectedDate=' + this.data.currentDate
        })
      }
    })
  },

  editPoster() {
    if (this.data.selectedPoster) {
      wx.navigateTo({ url: `/pages/poster/poster?posterId=${this.data.selectedPoster.id}` })
    }
  },

  sharePoster() {
    if (this.data.selectedPoster) {
      wx.showActionSheet({
        itemList: ['分享给好友', '保存到相册'],
        success: (res) => {
          if (res.tapIndex === 0) {
            wx.showToast({ title: '分享功能开发中', icon: 'none' })
          } else if (res.tapIndex === 1) {
            this.savePosterToAlbum()
          }
        }
      })
    }
  },

  savePosterToAlbum() {
    if (this.data.selectedPoster) {
      wx.saveImageToPhotosAlbum({
        filePath: this.data.selectedPoster.image,
        success: () => {
          wx.showToast({ title: '保存成功', icon: 'success' })
          const dateKey = `daily_poster_${this.data.currentDate}`
          wx.setStorageSync(dateKey, this.data.selectedPoster)
        },
        fail: () => {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      })
    }
  }
})