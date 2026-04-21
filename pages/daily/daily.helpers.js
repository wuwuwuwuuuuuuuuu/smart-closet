const { logWarning } = require('../../utils/logger')

function normalizeInput(value) {
  if (typeof value !== 'string') {
    if (value !== undefined && value !== null) {
      logWarning('daily.normalizeInput', 'invalid input value', { valueType: typeof value })
    }
    return ''
  }

  return value.trim()
}

function normalizeTemperature(tempText) {
  if (typeof tempText === 'number' && Number.isFinite(tempText)) {
    return tempText
  }

  if (tempText === undefined || tempText === null || tempText === '') {
    return null
  }

  if (String(tempText).trim() === '--') {
    return null
  }

  const matched = String(tempText).match(/-?\d+(\.\d+)?/)
  if (!matched) {
    logWarning('daily.normalizeTemperature', 'invalid temperature text', { tempText })
    return null
  }

  return Number(matched[0])
}

function buildDateLabel(date = new Date()) {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const weekdayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${safeDate.getMonth() + 1}月${safeDate.getDate()}日 ${weekdayMap[safeDate.getDay()]}`
}

function buildWeatherSuggestion({ temp, text, city } = {}) {
  const temperature = normalizeTemperature(temp)
  const weatherText = normalizeInput(text) || '天气未知'
  const cityText = normalizeInput(city) || '当前城市'

  if (temperature === null) {
    return `${cityText}${weatherText}，建议按体感温度灵活增减衣物。`
  }

  if (weatherText.includes('雨')) {
    return `${cityText}${weatherText}，当前约 ${temperature}°C，建议优先选择防水外套、长裤，并准备雨具。`
  }

  if (weatherText.includes('雪')) {
    return `${cityText}${weatherText}，当前约 ${temperature}°C，建议搭配保暖内层、厚外套和防滑鞋。`
  }

  if (temperature <= 10) {
    return `${cityText}${weatherText}，当前约 ${temperature}°C，建议选择保暖内搭、外套和包脚鞋。`
  }

  if (temperature >= 28) {
    return `${cityText}${weatherText}，当前约 ${temperature}°C，建议选择轻薄透气搭配并减少叠穿。`
  }

  return `${cityText}${weatherText}，当前约 ${temperature}°C，适合通勤或日常层次搭配。`
}

function normalizeRecommendationResult(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    logWarning('daily.normalizeRecommendationResult', 'invalid recommendation result', { rawType: typeof raw })
    raw = {}
  }

  const selectedClothesIds = Array.isArray(raw.selectedClothesIds)
    ? [...new Set(raw.selectedClothesIds.filter(Boolean).map(item => String(item)))]
    : []

  return {
    requestId: raw.requestId || `mock_${Date.now()}`,
    summary: normalizeInput(raw.summary) || '已根据你的需求生成智能推荐。',
    replyText: normalizeInput(raw.replyText) || '我已经整理好推荐思路啦，点击下方按钮即可继续试穿。',
    selectedClothesIds,
    outfitLines: Array.isArray(raw.outfitLines)
      ? raw.outfitLines.map(normalizeInput).filter(Boolean)
      : [],
    tips: Array.isArray(raw.tips)
      ? raw.tips.map(normalizeInput).filter(Boolean)
      : [],
    ctaLabel: normalizeInput(raw.ctaLabel) || '去试穿页继续搭配'
  }
}

function buildRecommendationPayload(userQuery, options = {}) {
  const normalizedQuery = normalizeInput(userQuery)
  const weatherInfo = options.weatherInfo && typeof options.weatherInfo === 'object'
    ? options.weatherInfo
    : {}

  return {
    requestId: `local_${Date.now()}`,
    userQuery: normalizedQuery,
    city: normalizeInput(options.city),
    currentDateLabel: normalizeInput(options.currentDateLabel),
    weatherSuggestion: normalizeInput(options.weatherSuggestion),
    weatherInfo: {
      temp: weatherInfo.temp || '',
      text: weatherInfo.text || '',
      icon: weatherInfo.icon || ''
    },
    createdAt: Date.now()
  }
}

function buildMockRecommendationResult(payload = {}) {
  const userQuery = normalizeInput(payload.userQuery)
  const weatherSuggestion = normalizeInput(payload.weatherSuggestion)
  const weatherText = normalizeInput(payload.weatherInfo && payload.weatherInfo.text)
  const city = normalizeInput(payload.city) || '当前城市'

  const isCommute = userQuery.includes('通勤') || userQuery.includes('上班') || userQuery.includes('面试')
  const isDateScene = userQuery.includes('约会') || userQuery.includes('聚会')
  const isRainScene = weatherText.includes('雨') || weatherSuggestion.includes('雨具')

  let outfitLines = [
    '上装：基础款针织或衬衫',
    '下装：利落长裤',
    '鞋子：舒适百搭的平底鞋'
  ]
  let tips = [
    `${city}当前天气提示：${weatherSuggestion || '建议按照当天温度灵活搭配。'}`,
    '如果你愿意，我可以带你去试穿页继续搭配。'
  ]
  let replyText = '已结合你的描述生成一套稳妥又好搭的推荐。'

  if (isCommute) {
    outfitLines = [
      '上装：浅色衬衫或细针织',
      '下装：直筒西裤或高腰长裤',
      '外套：轻薄西装或短款风衣',
      '鞋子：低跟皮鞋或乐福鞋'
    ]
    replyText = '给你整理了一套偏通勤感的利落搭配，正式又不沉闷。'
  } else if (isDateScene) {
    outfitLines = [
      '上装：柔和色系上衣',
      '下装：半裙或垂坠长裤',
      '外套：短款开衫或轻薄外套',
      '鞋子：精致低跟鞋'
    ]
    replyText = '这套更偏轻盈精致，适合约会或聚会场景。'
  }

  if (isRainScene) {
    tips.unshift('今天有雨，优先搭配防泼水外套，避免拖地裤脚。')
  }

  return normalizeRecommendationResult({
    requestId: payload.requestId || `mock_${Date.now()}`,
    summary: '智能推荐已生成',
    replyText,
    selectedClothesIds: Array.isArray(payload.selectedClothesIds) ? payload.selectedClothesIds : [],
    outfitLines,
    tips,
    ctaLabel: '去试穿页继续搭配'
  })
}

module.exports = {
  normalizeInput,
  normalizeTemperature,
  buildDateLabel,
  buildWeatherSuggestion,
  normalizeRecommendationResult,
  buildRecommendationPayload,
  buildMockRecommendationResult
}
