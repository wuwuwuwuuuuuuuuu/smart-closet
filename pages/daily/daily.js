const { logError, logWarning } = require('../../utils/logger')
const {
  normalizeInput,
  buildDateLabel,
  buildWeatherSuggestion,
  normalizeRecommendationResult,
  hasTryOnSelection,
  buildRecommendationStatus,
  buildRecommendationPayload,
  buildMockRecommendationResult,
  isCloudFunctionTimeoutError,
  buildKnowledgeRebuildFeedback,
  inferOccasion,
  inferPreferredStyle,
  inferPreferredColor
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
    isRebuildingKnowledge: false,
    knowledgeRebuildSummary: '',
    isLocating: false,
    amapKey: '请在这里填入你的高德Web服务Key'
  },

  onLoad() {
    if (!this.data.heroImage) {
      logWarning('daily.hero', 'hero image missing')
    }

    this.setData({
      currentDateLabel: buildDateLabel(new Date())
    })
    this.getRealTimeWeather()
  },

  getRealTimeWeather() {
    this.setData({
      isLocating: true,
      currentCity: '定位中...'
    })
    wx.showNavigationBarLoading()

    wx.getLocation({
      type: 'wgs84',
      success: ({ longitude, latitude }) => {
        this.fetchWeatherFromAmap(longitude, latitude, '当前位置')
      },
      fail: error => {
        wx.hideNavigationBarLoading()
        this.setData({
          isLocating: false
        })
        logWarning('daily.getRealTimeWeather', 'getLocation failed, using fallback weather', {
          errMsg: error && error.errMsg
        })
        this.applyFallbackWeather('未获取定位', {
          customSuggestion: '定位失败，请检查定位权限后点击“重新定位”，也可以手动切换城市。'
        })
      }
    })
  },

  fetchWeatherFromAmap(longitude, latitude, fallbackCity = '当前位置') {
    const { amapKey } = this.data
    if (!amapKey || amapKey === '请在这里填入你的高德Web服务Key') {
      wx.hideNavigationBarLoading()
      this.setData({
        isLocating: false
      })
      logWarning('daily.fetchWeatherFromAmap', 'amap key missing, using fallback weather')
      this.applyFallbackWeather(fallbackCity, {
        customSuggestion: '已获取当前位置，但天气服务未配置地图 Key，当前先展示默认天气。你可以点击“重新定位”或“切换城市”。'
      })
      return
    }

    wx.request({
      url: `https://restapi.amap.com/v3/geocode/regeo?location=${longitude},${latitude}&key=${amapKey}`,
      success: res => {
        const data = res.data || {}
        const component = data.regeocode && data.regeocode.addressComponent
        const adcode = component && component.adcode
        const city = normalizeInput(component && (component.city || component.province))

        if (data.status !== '1' || !adcode) {
          wx.hideNavigationBarLoading()
          this.setData({
            isLocating: false
          })
          logError('daily.fetchWeatherFromAmap', new Error('missing adcode from amap response'), {
            status: data.status
          })
          this.applyFallbackWeather(city || fallbackCity, {
            customSuggestion: '定位成功，但城市解析失败，当前先展示默认天气。你可以手动切换城市。'
          })
          return
        }

        this.requestWeatherByAdcode(adcode, city)
      },
      fail: error => {
        wx.hideNavigationBarLoading()
        this.setData({
          isLocating: false
        })
        logError('daily.fetchWeatherFromAmap', error)
        this.applyFallbackWeather(fallbackCity, {
          customSuggestion: '定位成功，但天气请求失败，当前先展示默认天气。你可以稍后重新定位。'
        })
      }
    })
  },

  requestWeatherByAdcode(adcode, city) {
    wx.request({
      url: `https://restapi.amap.com/v3/weather/weatherInfo?city=${adcode}&key=${this.data.amapKey}&extensions=base`,
      success: res => {
        const data = res.data || {}
        const live = data.lives && data.lives[0]

        if (data.status !== '1' || !live) {
          logWarning('daily.requestWeatherByAdcode', 'weather api returned empty result', {
            status: data.status,
            adcode
          })
          this.applyFallbackWeather(city || '当前位置', {
            customSuggestion: '已获取城市信息，但天气接口返回为空，当前先展示默认天气。'
          })
          return
        }

        this.applyWeatherInfo({
          city: city || normalizeInput(live.city),
          temp: `${live.temperature}°C`,
          text: normalizeInput(live.weather) || '未知',
          icon: this.mapWeatherIcon(live.weather)
        })
      },
      fail: error => {
        logError('daily.requestWeatherByAdcode', error, { adcode })
        this.applyFallbackWeather(city || '当前位置', {
          customSuggestion: '城市已获取，但天气请求失败，当前先展示默认天气。'
        })
      },
      complete: () => {
        this.setData({
          isLocating: false
        })
        wx.hideNavigationBarLoading()
      }
    })
  },

  requestWeatherByCity(city) {
    const safeCity = normalizeInput(city)
    if (!safeCity) {
      logWarning('daily.requestWeatherByCity', 'empty city received')
      return
    }

    const { amapKey } = this.data
    if (!amapKey || amapKey === '请在这里填入你的高德Web服务Key') {
      this.applyFallbackWeather(safeCity, {
        customSuggestion: `${safeCity}已切换成功，但天气服务未配置地图 Key，当前先展示默认天气。`
      })
      return
    }

    this.setData({
      isLocating: true,
      currentCity: safeCity
    })
    wx.showNavigationBarLoading()

    wx.request({
      url: `https://restapi.amap.com/v3/weather/weatherInfo?city=${encodeURIComponent(safeCity)}&key=${amapKey}&extensions=base`,
      success: res => {
        const data = res.data || {}
        const live = data.lives && data.lives[0]

        if (data.status !== '1' || !live) {
          logWarning('daily.requestWeatherByCity', 'weather api returned empty result', {
            status: data.status,
            city: safeCity
          })
          this.applyFallbackWeather(safeCity, {
            customSuggestion: `${safeCity}天气获取失败，当前先展示默认天气。`
          })
          return
        }

        this.applyWeatherInfo({
          city: safeCity,
          temp: `${live.temperature}°C`,
          text: normalizeInput(live.weather) || '未知',
          icon: this.mapWeatherIcon(live.weather)
        })
      },
      fail: error => {
        logError('daily.requestWeatherByCity', error, { city: safeCity })
        this.applyFallbackWeather(safeCity, {
          customSuggestion: `${safeCity}天气请求失败，当前先展示默认天气。`
        })
      },
      complete: () => {
        this.setData({
          isLocating: false
        })
        wx.hideNavigationBarLoading()
      }
    })
  },

  applyWeatherInfo({ city, temp, text, icon, suggestion }) {
    const weatherInfo = {
      temp: temp || '--',
      text: text || '未知',
      icon: icon || '☁️'
    }
    const currentCity = city || '当前城市'

    this.setData({
      currentCity,
      weatherInfo,
      weatherSuggestion: suggestion || buildWeatherSuggestion({
        temp: weatherInfo.temp,
        text: weatherInfo.text,
        city: currentCity
      }),
      isLocating: false
    })
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
    if (safeText.includes('雨')) {
      return '🌧️'
    }
    if (safeText.includes('雪')) {
      return '❄️'
    }
    if (safeText.includes('晴')) {
      return '☀️'
    }
    if (safeText.includes('阴') || safeText.includes('云')) {
      return '☁️'
    }
    return '⛅'
  },

  refreshLocation() {
    if (this.data.isLocating) {
      return
    }
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

  runKnowledgeRebuild(forceResync = false) {
    if (this.data.isRebuildingKnowledge) {
      return
    }

    this.setData({
      isRebuildingKnowledge: true,
      knowledgeRebuildSummary: ''
    })

    wx.showLoading({
      title: forceResync ? '强制重同步中...' : '补同步检查中...'
    })

    wx.cloud.callFunction({
      name: 'rebuildUserKnowledgeBase',
      data: {
        limit: 30,
        forceResync
      },
      success: (res) => {
        const result = res && res.result ? res.result : {}
        const data = result.data || {}
        const feedback = buildKnowledgeRebuildFeedback(result)

        this.setData({
          knowledgeRebuildSummary: feedback.summaryText
        })

        console.log(forceResync ? '强制重同步结果' : '补同步结果', result)
        if (Array.isArray(data.sampleFailures) && data.sampleFailures.length) {
          console.log('知识库同步失败样本', data.sampleFailures)
        }
        if (Array.isArray(data.sampleDiagnostics) && data.sampleDiagnostics.length) {
          console.log('知识库诊断样本', data.sampleDiagnostics.map(item => ({
            clothingId: normalizeInput(item && item.clothingId),
            name: normalizeInput(item && item.name),
            reason: normalizeInput(item && item.reason),
            syncStatus: normalizeInput(item && item.syncStatus),
            knowledge_sync_error: normalizeInput(item && item.knowledge_sync_error),
            hasImage: Boolean(item && item.hasImage),
            hasKnowledgeDoc: Boolean(item && item.hasKnowledgeDoc),
            isReadyInKnowledge: Boolean(item && item.isReadyInKnowledge),
            canSync: Boolean(item && item.canSync)
          })))
        }

        if (feedback.status === 'pending' || feedback.status === 'idle') {
          wx.showToast({
            title: feedback.status === 'pending' ? '已发起，请稍后查状态' : '当前没有待同步衣物',
            icon: 'none',
            duration: 2500
          })
          return
        }

        wx.showModal({
          title: feedback.title,
          content: feedback.summaryText,
          showCancel: false
        })
      },
      fail: (error) => {
        const timeoutPending = isCloudFunctionTimeoutError(error)
        const errMsg = timeoutPending
          ? `${forceResync ? '强制重同步' : '补同步'}已发起，但云函数执行较慢。请等待几秒后再次点击对应按钮查看状态。`
          : (error && error.errMsg ? error.errMsg : '调用云函数失败')

        this.setData({
          knowledgeRebuildSummary: errMsg
        })

        if (timeoutPending) {
          logWarning('daily.runKnowledgeRebuild', 'rebuild timeout treated as async pending', {
            errMsg: error && error.errMsg,
            forceResync
          })
          wx.showToast({
            title: '已发起，请稍后查状态',
            icon: 'none',
            duration: 2500
          })
          return
        }

        console.error(forceResync ? '强制重同步失败' : '补同步失败', error)
        logError('daily.runKnowledgeRebuild', error, { forceResync })
        wx.showModal({
          title: forceResync ? '强制重同步失败' : '补同步失败',
          content: errMsg,
          showCancel: false
        })
      },
      complete: () => {
        wx.hideLoading()
        this.setData({
          isRebuildingKnowledge: false
        })
      }
    })
  },

  triggerKnowledgeRebuild() {
    this.runKnowledgeRebuild(false)
  },

  triggerKnowledgeForceResync() {
    this.runKnowledgeRebuild(true)
  },

  onRecommendationInput(event) {
    const value = event && event.detail ? event.detail.value : ''
    if (value !== '' && typeof value !== 'string') {
      logWarning('daily.input', 'invalid input value', { valueType: typeof value })
    }

    this.setData({
      pendingUserInput: typeof value === 'string' ? value : ''
    })
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
      wx.showToast({
        title: '请先输入需求',
        icon: 'none'
      })
      return
    }

    this.appendConversationMessage({
      role: 'user',
      type: 'text',
      text: userQuery
    })

    this.setData({
      pendingUserInput: '',
      isRecommendationLoading: true
    })

    const payload = buildRecommendationPayload(userQuery, {
      city: this.data.currentCity,
      currentDateLabel: this.data.currentDateLabel,
      weatherSuggestion: this.data.weatherSuggestion,
      weatherInfo: this.data.weatherInfo,
      occasion: inferOccasion(userQuery),
      userPreferences: {
        preferredStyle: inferPreferredStyle(userQuery),
        preferredColor: inferPreferredColor(userQuery)
      }
    })

    this.requestRecommendationWithFallback(payload)
      .then(result => {
        const normalizedResult = normalizeRecommendationResult(result)
        this.appendConversationMessage({
          role: 'assistant',
          type: 'result-card',
          data: normalizedResult
        })
        this.setData({
          recommendationResult: normalizedResult
        })
      })
      .catch(error => {
        logError('daily.submitRecommendationRequest', error)
        wx.showToast({
          title: '生成建议失败',
          icon: 'none'
        })
      })
      .finally(() => {
        this.setData({
          isRecommendationLoading: false
        })
      })
  },

  requestRecommendationWithFallback(payload) {
    return new Promise(resolve => {
      if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
        logWarning('daily.requestRecommendation', 'cloud unavailable, using mock fallback')
        resolve(buildMockRecommendationResult(payload))
        return
      }

      wx.cloud.callFunction({
        name: 'smartRecommendPhoto',
        data: payload,
        success: res => {
          const result = res && res.result
          const normalizedResult = normalizeRecommendationResult(result && (result.data || result))
          if (buildRecommendationStatus(normalizedResult) !== 'invalid') {
            resolve(normalizedResult)
            return
          }

          logWarning('daily.requestRecommendation', 'cloud function returned empty result, using fallback')
          resolve(buildMockRecommendationResult(payload))
        },
        fail: error => {
          logWarning('daily.requestRecommendation', 'cloud function failed, using fallback', {
            errMsg: error && error.errMsg
          })
          resolve(buildMockRecommendationResult(payload))
        }
      })
    })
  },

  goToTryOnFromRecommendation() {
    const result = this.data.recommendationResult
    if (!result || !hasTryOnSelection(result)) {
      wx.showToast({
        title: result ? '当前结果没有可试穿衣物' : '暂无可试穿建议',
        icon: 'none'
      })
      return
    }

    try {
      wx.setStorageSync('smartRecommendTryonEntry', {
        source: 'smartRecommend',
        requestId: result.requestId,
        title: result.summary,
        selectedClothesIds: result.selectedClothesIds,
        createdAt: Date.now(),
        active: true
      })

      wx.switchTab({
        url: '/pages/tryon/tryon'
      })
    } catch (error) {
      logError('daily.goToTryOnFromRecommendation', error)
      wx.showToast({
        title: '跳转失败，请重试',
        icon: 'none'
      })
    }
  }
})
