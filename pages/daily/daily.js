const { logError, logWarning } = require('../../utils/logger')
const {
  buildDateLabel,
  buildWeatherSuggestion,
  normalizeReminderResult,
  buildReminderPayload,
  buildMockReminderResult,
  normalizeInput,
  createMessageId
} = require('./daily.helpers')

function buildAssistantTextMessage(text) {
  return {
    id: createMessageId(),
    role: 'assistant',
    type: 'text',
    text
  }
}

Page({
  data: {
    heroImage: '/images/smart_recommend_hero_compressed.jpg',
    tryOnArrowIcon: '/images/896368f1842e54992b5839f2877d838_transparent.png',
    currentCity: '定位中...',
    currentDateLabel: '',
    weatherInfo: {
      temp: '--',
      text: '获取中',
      icon: '⏳'
    },
    weatherSuggestion: '正在为你整理今日天气提醒...',
    pendingUserInput: '',
    conversationList: [],
    reminderResult: null,
    isReminderLoading: false,
    reminderRequestId: '',
    tryonEntryReady: false,
    amapKey: '请在这里填入你的高德Web服务Key'
  },

  onLoad() {
    this.setData({
      currentDateLabel: buildDateLabel(new Date()),
      conversationList: [
        buildAssistantTextMessage('你好呀，我是你的穿搭助手。告诉我今天的需求，我会结合天气给你建议。')
      ]
    })
    this.ensureVisualAssets()
    this.getRealTimeWeather()
  },

  ensureVisualAssets() {
    if (!this.data.heroImage) {
      logWarning('daily.hero', 'hero image missing')
    }
    if (!this.data.tryOnArrowIcon) {
      logWarning('daily.tryOnArrowIcon', 'try-on arrow icon missing')
    }
  },

  onReminderInput(e) {
    const value = typeof e.detail.value === 'string' ? e.detail.value : ''
    if (typeof e.detail.value !== 'string') {
      logWarning('daily.composer', 'invalid input value', { value: e.detail.value })
    }
    this.setData({ pendingUserInput: value })
  },

  appendConversationMessage(message) {
    this.setData({
      conversationList: this.data.conversationList.concat({
        id: createMessageId(),
        ...message
      })
    })
  },

  getRealTimeWeather() {
    wx.showNavigationBarLoading()
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        this.fetchWeatherFromAmap(res.longitude, res.latitude)
      },
      fail: (error) => {
        logWarning('daily.getRealTimeWeather', 'location failed', { message: error && error.errMsg })
        const weatherInfo = {
          temp: '--',
          text: '未知',
          icon: '⛅'
        }
        this.setData({
          currentCity: '未授权定位',
          weatherInfo,
          weatherSuggestion: buildWeatherSuggestion({
            ...weatherInfo,
            city: '当前城市'
          })
        })
        wx.hideNavigationBarLoading()
      }
    })
  },

  fetchWeatherFromAmap(lng, lat) {
    const key = this.data.amapKey

    if (key === '请在这里填入你的高德Web服务Key') {
      const fallbackWeather = { temp: '25°C', text: '晴', icon: '☀️' }
      this.setData({
        currentCity: '北京市(未配Key)',
        currentDateLabel: buildDateLabel(new Date()),
        weatherInfo: fallbackWeather,
        weatherSuggestion: buildWeatherSuggestion({
          ...fallbackWeather,
          city: '北京市'
        })
      })
      wx.hideNavigationBarLoading()
      return
    }

    wx.request({
      url: `https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${key}`,
      success: (res) => {
        try {
          const adcode = res.data?.regeocode?.addressComponent?.adcode
          let city = res.data?.regeocode?.addressComponent?.city
          if (!city || (Array.isArray(city) && city.length === 0)) {
            city = res.data?.regeocode?.addressComponent?.province || '当前城市'
            logWarning('daily.weather', 'empty city fallback used', { city })
          }
          if (Array.isArray(city)) {
            city = city[0] || '当前城市'
          }

          if (!adcode) {
            throw new Error('高德逆地理接口未返回 adcode')
          }

          this.setData({
            currentCity: city,
            currentDateLabel: buildDateLabel(new Date())
          })
          this.requestWeatherByAdcode(adcode, city)
        } catch (error) {
          logError('daily.fetchWeatherFromAmap', error)
          wx.hideNavigationBarLoading()
        }
      },
      fail: (error) => {
        logError('daily.fetchWeatherFromAmap.request', error)
        wx.hideNavigationBarLoading()
      }
    })
  },

  requestWeatherByAdcode(adcode, city) {
    wx.request({
      url: `https://restapi.amap.com/v3/weather/weatherInfo?city=${adcode}&key=${this.data.amapKey}&extensions=base`,
      success: (weatherRes) => {
        const live = weatherRes.data?.lives?.[0]
        if (!live) {
          logWarning('daily.requestWeatherByAdcode', 'empty weather response', { adcode, city })
          wx.hideNavigationBarLoading()
          return
        }

        const weatherInfo = {
          temp: `${live.temperature}°C`,
          text: live.weather,
          icon: this.mapWeatherIcon(live.weather)
        }

        this.setData({
          weatherInfo,
          weatherSuggestion: buildWeatherSuggestion({
            ...weatherInfo,
            city
          })
        })
        wx.hideNavigationBarLoading()
      },
      fail: (error) => {
        logError('daily.requestWeatherByAdcode', error, { adcode, city })
        wx.hideNavigationBarLoading()
      }
    })
  },

  mapWeatherIcon(weatherText = '') {
    if (weatherText.includes('晴')) return '☀️'
    if (weatherText.includes('雨')) return '🌧️'
    if (weatherText.includes('雪')) return '❄️'
    if (weatherText.includes('云') || weatherText.includes('阴')) return '⛅'
    return '☁️'
  },

  buildReminderPayload(userInput) {
    return buildReminderPayload({
      userQuery: userInput,
      weatherInfo: this.data.weatherInfo,
      city: this.data.currentCity,
      source: 'daily-page'
    })
  },

  async requestReminderWithFallback(payload) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'smartReminder',
        data: payload
      })

      if (res.result?.code !== 200) {
        throw new Error(res.result?.message || 'smartReminder failed')
      }

      return normalizeReminderResult(res.result.data)
    } catch (error) {
      logWarning('daily.requestReminderWithFallback', 'use mock reminder result', {
        message: error.message
      })
      return buildMockReminderResult(payload)
    }
  },

  async submitReminderRequest() {
    const userInput = normalizeInput(this.data.pendingUserInput)
    if (!userInput) {
      wx.showToast({ title: '请先输入需求', icon: 'none' })
      return
    }

    this.appendConversationMessage({
      role: 'user',
      type: 'text',
      text: userInput
    })

    this.setData({
      pendingUserInput: '',
      isReminderLoading: true,
      reminderResult: null,
      reminderRequestId: '',
      tryonEntryReady: false
    })

    try {
      const payload = this.buildReminderPayload(userInput)
      const reminderResult = await this.requestReminderWithFallback(payload)
      const normalized = normalizeReminderResult(reminderResult)

      this.appendConversationMessage({
        role: 'assistant',
        type: 'result-card',
        data: normalized
      })

      this.setData({
        reminderResult: normalized,
        reminderRequestId: normalized.requestId,
        tryonEntryReady: normalized.selectedClothesIds.length > 0
      })
    } catch (error) {
      logError('daily.submitReminderRequest', error)
      wx.showToast({ title: '生成建议失败', icon: 'none' })
    } finally {
      this.setData({ isReminderLoading: false })
    }
  },

  goToTryOnFromReminder() {
    const reminderResult = this.data.reminderResult
    if (!reminderResult) {
      wx.showToast({ title: '暂无可试穿建议', icon: 'none' })
      return
    }

    const entry = {
      source: 'smartReminder',
      requestId: reminderResult.requestId,
      title: reminderResult.summary,
      selectedClothesIds: reminderResult.selectedClothesIds,
      tips: reminderResult.tips,
      createdAt: Date.now(),
      active: true
    }

    try {
      wx.setStorageSync('smartReminderTryonEntry', entry)
      wx.switchTab({ url: '/pages/tryon/tryon' })
    } catch (error) {
      logError('daily.goToTryOnFromReminder', error)
      wx.showToast({ title: '跳转失败，请重试', icon: 'none' })
    }
  }
})
