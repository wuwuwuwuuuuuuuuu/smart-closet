const { logWarning } = require('../../utils/logger')

function normalizeTemperature(tempText) {
  if (typeof tempText === 'number' && Number.isFinite(tempText)) {
    return tempText
  }

  if (!tempText) {
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
  const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekMap[date.getDay()]}`
}

function normalizeInput(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildWeatherSuggestion({ temp, text, city }) {
  const temperature = normalizeTemperature(temp)
  const weatherText = text || '未知天气'
  const cityText = city || '当前城市'

  if (temperature === null) {
    logWarning('daily.buildWeatherSuggestion', 'temperature unavailable', { temp, city: cityText })
    return `${cityText}${weatherText}，建议按体感温度灵活搭配。`
  }

  if (weatherText.includes('雨')) {
    return `${cityText}${weatherText}，当前约 ${temperature}°C，建议优先选择防水外套、长裤，并准备雨具。`
  }

  if (temperature <= 10) {
    return `${cityText}${weatherText}，当前约 ${temperature}°C，建议选择保暖内搭、外套和包脚鞋。`
  }

  if (temperature >= 28) {
    return `${cityText}${weatherText}，当前约 ${temperature}°C，建议选择轻薄透气搭配并减少叠穿。`
  }

  return `${cityText}${weatherText}，当前约 ${temperature}°C，适合做通勤或日常层次搭配。`
}

function normalizeReminderResult(raw = {}) {
  const selectedClothesIds = Array.isArray(raw.selectedClothesIds)
    ? [...new Set(raw.selectedClothesIds.filter(Boolean))]
    : []

  const outfitLines = Array.isArray(raw.outfitLines)
    ? raw.outfitLines.filter(Boolean)
    : []

  const tips = Array.isArray(raw.tips)
    ? raw.tips.filter(Boolean)
    : []

  return {
    requestId: raw.requestId || `mock_${Date.now()}`,
    summary: raw.summary || '已为你生成今日搭配建议。',
    replyText: raw.replyText || raw.summary || '',
    selectedClothesIds,
    outfitLines,
    tips,
    ctaLabel: raw.ctaLabel || '去试穿页继续搭配',
    raw
  }
}

function buildReminderPayload({ userQuery, weatherInfo = {}, city, source = 'daily-page' }) {
  const normalizedQuery = normalizeInput(userQuery)
  return {
    userQuery: normalizedQuery,
    weatherInfo: {
      temp: weatherInfo.temp || '--',
      text: weatherInfo.text || '未知',
      city: city || weatherInfo.city || '',
      temperature: normalizeTemperature(weatherInfo.temp)
    },
    source
  }
}

function buildMockReminderResult(payload = {}) {
  const query = payload.userQuery || ''
  const weatherText = payload.weatherInfo?.text || ''
  const city = payload.weatherInfo?.city || '当前城市'
  const isCommute = query.includes('上班') || query.includes('通勤')
  const isRainy = query.includes('雨') || weatherText.includes('雨')

  const outfitLines = isCommute
    ? ['上衣：浅色衬衫', '下装：直筒长裤', '外套：轻薄西装', '鞋子：低跟皮鞋']
    : ['上衣：基础针织', '下装：宽松长裤', '外套：轻薄开衫', '鞋子：休闲鞋']

  const tips = []
  if (isRainy) {
    tips.push('建议额外准备一把伞，并优先选择防滑鞋底。')
  }
  tips.push(`如果你愿意，我可以带你去试穿页继续搭配 ${city} 今天这套风格。`)

  return normalizeReminderResult({
    requestId: `mock_${Date.now()}`,
    summary: '已根据你的需求生成搭配建议。',
    replyText: isCommute
      ? '收到～今天给你一套偏通勤感的利落搭配，整体更适合工作场景。'
      : '收到～今天给你一套舒适又有层次感的日常搭配。',
    outfitLines,
    tips,
    selectedClothesIds: [],
    ctaLabel: '去试穿页继续搭配'
  })
}

function createMessageId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

module.exports = {
  normalizeTemperature,
  buildDateLabel,
  normalizeInput,
  buildWeatherSuggestion,
  normalizeReminderResult,
  buildReminderPayload,
  buildMockReminderResult,
  createMessageId
}
