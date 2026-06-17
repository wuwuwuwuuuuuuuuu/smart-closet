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
    heroImage: 'cloud://cloudbase-2gvrvh4ve926f3d8.636c-cloudbase-2gvrvh4ve926f3d8-1411253050/images/smart_recommend_hero_compressed.jpg',
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
    isLocating: false,
    amapKey: ''
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

  // === 🌟 修复了这里原本缺失的右侧大括号 ===
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

  runKnowledgeRebuild(forceResync = false) {
    if (this.data.isRebuildingKnowledge) {
      return
    }

    this.setData({
      isRebuildingKnowledge: true,
      knowledgeRebuildSummary: ''
    })

    wx.showLoading({
      title: forceResync ? '强制重建向量中...' : '向量补同步中...'
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

        console.log(forceResync ? '强制重建向量结果' : '向量补同步结果', result)
        if (Array.isArray(data.sampleFailures) && data.sampleFailures.length) {
          console.log('image vector sync failures', data.sampleFailures)
        }
        if (Array.isArray(data.sampleDiagnostics) && data.sampleDiagnostics.length) {
          console.log('image vector diagnostics', data.sampleDiagnostics.map(item => ({
            clothingId: normalizeInput(item && item.clothingId),
            name: normalizeInput(item && item.name),
            reason: normalizeInput(item && item.reason),
            syncStatus: normalizeInput(item && item.syncStatus),
            image_embedding_error: normalizeInput(item && item.image_embedding_error),
            hasImage: Boolean(item && item.hasImage),
            hasVector: Boolean(item && item.hasVector),
            isReadyVector: Boolean(item && item.isReadyVector),
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
          ? `${forceResync ? '强制重建向量' : '向量补同步'}已发起，但云函数执行较慢。请稍后再次点击按钮查看状态。`
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

        console.error(forceResync ? '强制重建向量失败' : '向量补同步失败', error)
        logError('daily.runKnowledgeRebuild', error, { forceResync })
        wx.showModal({
          title: forceResync ? '强制重建向量失败' : '向量补同步失败',
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
        name: 'smartRecommendPhoto',
        data: payload,
        success: res => {
          const result = res && res.result
          const normalizedResult = normalizeRecommendationResult(result && (result.data || result))
          if (buildRecommendationStatus(normalizedResult) !== 'invalid') {
            resolve(normalizedResult)
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
      wx.switchTab({ url: '/pages/tryon/tryon' })
    } catch (error) {
      logError('daily.goToTryOnFromRecommendation', error)
      wx.showToast({ title: '跳转失败', icon: 'none' })
    }
  }
})
