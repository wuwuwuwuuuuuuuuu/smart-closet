const { logError, logWarning } = require('../../utils/logger')
const {
  normalizeInput,
  buildDateLabel,
  buildWeatherSuggestion,
  normalizeRecommendationResult,
  buildRecommendationPayload,
  buildMockRecommendationResult
} = require('./daily.helpers')

Page({
  data: {
    heroImage: '/images/smart_recommend_hero_compressed.jpg',
    arrowIcon: '/images/67134f606087c7f32d75f9d9f47f5af.png',
    currentCity: '定位中...',
    currentDateLabel: '',
    weatherInfo: {
      temp: '--',
      text: '获取中',
      icon: '⏳'
    },
    weatherSuggestion: '正在为你整理今天天气提醒...',
    pendingUserInput: '',
    conversationList: [],
    recommendationResult: null,
    isRecommendationLoading: false,
    isLocating: false
  },

  onLoad() {
    if (!this.data.heroImage) {
      logWarning('daily.hero', 'hero image missing')
    }
    // 先用本地时间兜底显示，等高德接口回来后会覆盖它
    this.setData({
      currentDateLabel: buildDateLabel(new Date())
    })
    this.getRealTimeWeather()
  },

  getRealTimeWeather() {
    this.setData({ isLocating: true, currentCity: '定位中...' })
    wx.showNavigationBarLoading()

    wx.getLocation({
      type: 'wgs84',
      success: ({ longitude, latitude }) => {
        this.callWeatherCloudFunction({ longitude, latitude })
      },
      fail: error => {
        this.setData({ isLocating: false })
        wx.hideNavigationBarLoading()
        logWarning('daily.getRealTimeWeather', '定位失败，使用默认天气')
        this.applyFallbackWeather('未获取定位', {
          customSuggestion: '定位失败，请检查定位权限后点击“重新定位”，也可以手动切换城市。'
        })
      }
    })
  },

  requestWeatherByCity(city) {
    const safeCity = normalizeInput(city)
    if (!safeCity) return

    this.setData({ isLocating: true, currentCity: safeCity })
    wx.showNavigationBarLoading()

    this.callWeatherCloudFunction({ city: safeCity })
  },

  // 🌟 核心升级：一键直达云端，获取天气 + 精准日期
  async callWeatherCloudFunction(payload) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getWeather',
        data: payload
      })

      if (res.result && res.result.code === 200) {
        // 多解构出一个 reportTime
        const { city, temp, text, reportTime } = res.result.data
        
        // 解析高德的时间并格式化（把 - 替换为 / 是为了兼容 iOS）
        let dateLabel = this.data.currentDateLabel
        if (reportTime) {
          const dateObj = new Date(reportTime.replace(/-/g, '/'))
          dateLabel = buildDateLabel(dateObj)
        }

        this.applyWeatherInfo({
          city: normalizeInput(city),
          temp: `${temp}°C`,
          text: normalizeInput(text) || '未知',
          icon: this.mapWeatherIcon(text),
          dateLabel: dateLabel // 👈 把日期一并传下去
        })
      } else {
        throw new Error(res.result ? res.result.message : '云函数返回异常')
      }
    } catch (error) {
      logError('daily.callWeatherCloudFunction', error)
      this.applyFallbackWeather(payload.city || '当前位置', {
        customSuggestion: '云端天气获取失败，当前展示默认天气，可稍后重试。'
      })
    } finally {
      this.setData({ isLocating: false })
      wx.hideNavigationBarLoading()
    }
  },

  // 应用天气与日期信息到 UI
  applyWeatherInfo({ city, temp, text, icon, suggestion, dateLabel }) {
    const weatherInfo = {
      temp: temp || '--',
      text: text || '未知',
      icon: icon || '☁️'
    }
    const currentCity = city || '当前城市'

    // 准备要更新的 data 对象
    const updateData = {
      currentCity,
      weatherInfo,
      weatherSuggestion: suggestion || buildWeatherSuggestion({
        temp: weatherInfo.temp,
        text: weatherInfo.text,
        city: currentCity
      }),
      isLocating: false
    }

    // 如果接口传回了日期，一并更新到页面的 currentDateLabel
    if (dateLabel) {
      updateData.currentDateLabel = dateLabel
    }

    this.setData(updateData)
  },

  applyFallbackWeather(city = '当前位置', options = {}) {
    this.applyWeatherInfo({
      city,
      temp: '24°C',
      text: '多云',
      icon: '⛅',
      suggestion: options.customSuggestion || `${city}已定位成功，当前展示默认天气。`
    })
  },

  mapWeatherIcon(text) {
    const safeText = normalizeInput(text)
    if (safeText.includes('雨')) return '🌧️'
    if (safeText.includes('雪')) return '❄️'
    if (safeText.includes('晴')) return '☀️'
    if (safeText.includes('阴') || safeText.includes('云')) return '☁️'
    return '⛅'
  },

  refreshLocation() {
    if (this.data.isLocating) return
    this.getRealTimeWeather()
  },

  selectCity() {
    const cityOptions = ['北京', '上海', '广州', '深圳', '武汉', '成都', '杭州']
    wx.showActionSheet({
      itemList: cityOptions,
      success: res => {
        const selectedCity = cityOptions[res.tapIndex]
        this.requestWeatherByCity(selectedCity)
      }
    })
  },

  // ========= 以下为大模型推荐聊天逻辑 =========
  onRecommendationInput(event) {
    const value = event && event.detail ? event.detail.value : ''
    this.setData({ pendingUserInput: typeof value === 'string' ? value : '' })
  },

  appendConversationMessage(message) {
    const conversationItem = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ...message
    }
    this.setData({
      conversationList: this.data.conversationList.concat(conversationItem)
    })
  },

  submitRecommendationRequest() {
    const userQuery = normalizeInput(this.data.pendingUserInput)
    if (!userQuery) {
      return wx.showToast({ title: '请先输入需求', icon: 'none' })
    }

    this.appendConversationMessage({ role: 'user', type: 'text', text: userQuery })
    this.setData({ pendingUserInput: '', isRecommendationLoading: true })

    const payload = buildRecommendationPayload(userQuery, {
      city: this.data.currentCity,
      currentDateLabel: this.data.currentDateLabel,
      weatherSuggestion: this.data.weatherSuggestion,
      weatherInfo: this.data.weatherInfo
    })

    this.requestRecommendationWithFallback(payload)
      .then(result => {
        const normalizedResult = normalizeRecommendationResult(result)
        this.appendConversationMessage({
          role: 'assistant',
          type: 'result-card',
          data: normalizedResult
        })
        this.setData({ recommendationResult: normalizedResult })
      })
      .catch(error => {
        logError('daily.submitRecommendationRequest', error)
        wx.showToast({ title: '生成建议失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ isRecommendationLoading: false })
      })
  },

  requestRecommendationWithFallback(payload) {
    return new Promise(resolve => {
      if (!wx.cloud) {
        resolve(buildMockRecommendationResult(payload))
        return
      }
      wx.cloud.callFunction({
        name: 'smartRecommend',
        data: payload,
        success: res => {
          const result = res && res.result
          if (result && (result.data || result.replyText || result.summary)) {
            resolve(result.data || result)
            return
          }
          resolve(buildMockRecommendationResult(payload))
        },
        fail: error => {
          resolve(buildMockRecommendationResult(payload))
        }
      })
    })
  },

  goToTryOnFromRecommendation() {
    const result = this.data.recommendationResult
    if (!result) return wx.showToast({ title: '暂无可试穿建议', icon: 'none' })

    try {
      wx.setStorageSync('smartRecommendTryonEntry', {
        source: 'smartRecommend',
        requestId: result.requestId,
        title: result.summary,
        selectedClothesIds: result.selectedClothesIds,
        createdAt: Date.now(),
        active: true
      })
      wx.switchTab({ url: '/pages/tryon/tryon' })
    } catch (error) {
      logError('daily.goToTryOnFromRecommendation', error)
      wx.showToast({ title: '跳转失败', icon: 'none' })
    }
  }
})