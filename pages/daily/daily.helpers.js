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

function uniqueStringList(list = [], scope = 'daily.uniqueStringList') {
  if (!Array.isArray(list)) {
    logWarning(scope, 'invalid list received', { listType: typeof list })
    return []
  }

  return [...new Set(
    list
      .filter(item => item !== undefined && item !== null)
      .map(item => String(item).trim())
      .filter(Boolean)
  )]
}

function normalizePlainObject(value, scope) {
  if (value === undefined || value === null) {
    return {}
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  logWarning(scope, 'invalid object received', { valueType: typeof value })
  return {}
}

function normalizeHitCount(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }

  return 0
}

function buildDateLabel(date = new Date()) {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const weekdayMap = ['\u5468\u65e5', '\u5468\u4e00', '\u5468\u4e8c', '\u5468\u4e09', '\u5468\u56db', '\u5468\u4e94', '\u5468\u516d']
  return `${safeDate.getMonth() + 1}\u6708${safeDate.getDate()}\u65e5 ${weekdayMap[safeDate.getDay()]}`
}

function buildWeatherSuggestion({ temp, text, city } = {}) {
  const temperature = normalizeTemperature(temp)
  const weatherText = normalizeInput(text) || '\u5929\u6c14\u672a\u77e5'
  const cityText = normalizeInput(city) || '\u5f53\u524d\u57ce\u5e02'

  if (temperature === null) {
    return `${cityText}${weatherText}\uff0c\u5efa\u8bae\u6309\u4f53\u611f\u6e29\u5ea6\u7075\u6d3b\u589e\u51cf\u8863\u7269\u3002`
  }

  if (weatherText.includes('\u96e8')) {
    return `${cityText}${weatherText}\uff0c\u5f53\u524d\u7ea6 ${temperature}\u00b0C\uff0c\u5efa\u8bae\u4f18\u5148\u9009\u62e9\u9632\u6c34\u5916\u5957\u3001\u957f\u88e4\uff0c\u5e76\u51c6\u5907\u96e8\u5177\u3002`
  }

  if (weatherText.includes('\u96ea')) {
    return `${cityText}${weatherText}\uff0c\u5f53\u524d\u7ea6 ${temperature}\u00b0C\uff0c\u5efa\u8bae\u642d\u914d\u4fdd\u6696\u5185\u5c42\u3001\u539a\u5916\u5957\u548c\u9632\u6ed1\u978b\u3002`
  }

  if (temperature <= 10) {
    return `${cityText}${weatherText}\uff0c\u5f53\u524d\u7ea6 ${temperature}\u00b0C\uff0c\u5efa\u8bae\u9009\u62e9\u4fdd\u6696\u5185\u642d\u3001\u5916\u5957\u548c\u5305\u811a\u978b\u3002`
  }

  if (temperature >= 28) {
    return `${cityText}${weatherText}\uff0c\u5f53\u524d\u7ea6 ${temperature}\u00b0C\uff0c\u5efa\u8bae\u9009\u62e9\u8f7b\u8584\u900f\u6c14\u642d\u914d\u5e76\u51cf\u5c11\u53e0\u7a7f\u3002`
  }

  return `${cityText}${weatherText}\uff0c\u5f53\u524d\u7ea6 ${temperature}\u00b0C\uff0c\u9002\u5408\u901a\u52e4\u6216\u65e5\u5e38\u5c42\u6b21\u642d\u914d\u3002`
}

function inferOccasion(text = '') {
  const normalized = normalizeInput(text)
  if (!normalized) {
    logWarning('daily.inferOccasion', 'occasion fallback to default')
    return '\u65e5\u5e38'
  }

  if (/(\u4e0a\u73ed|\u901a\u52e4|\u5f00\u4f1a|\u9762\u8bd5|\u89c1\u5ba2\u6237)/.test(normalized)) {
    return '\u901a\u52e4'
  }
  if (/(\u7ea6\u4f1a|\u805a\u4f1a|\u770b\u7535\u5f71|\u665a\u9910)/.test(normalized)) {
    return '\u7ea6\u4f1a'
  }
  if (/(\u8fd0\u52a8|\u5065\u8eab|\u8dd1\u6b65|\u9a91\u884c)/.test(normalized)) {
    return '\u8fd0\u52a8'
  }
  if (/(\u65c5\u6e38|\u51fa\u6e38|\u6d77\u8fb9|\u6cf0\u56fd|\u5ea6\u5047|\u516c\u56ed)/.test(normalized)) {
    return '\u51fa\u6e38'
  }
  return '\u65e5\u5e38'
}

function inferPreferredStyle(text = '') {
  const normalized = normalizeInput(text)
  if (!normalized) {
    return ''
  }

  if (/(\u7b80\u7ea6|\u57fa\u7840|\u6781\u7b80)/.test(normalized)) {
    return '\u7b80\u7ea6'
  }
  if (/(\u751c\u7f8e|\u6e29\u67d4|\u53ef\u7231)/.test(normalized)) {
    return '\u751c\u7f8e'
  }
  if (/(\u5ea6\u5047|\u6d77\u8fb9|\u65c5\u6e38)/.test(normalized)) {
    return '\u5ea6\u5047'
  }
  if (/(\u4f11\u95f2|\u8f7b\u677e|\u968f\u610f)/.test(normalized)) {
    return '\u4f11\u95f2'
  }
  if (/(\u6b63\u5f0f|\u5e72\u7ec3|\u901a\u52e4)/.test(normalized)) {
    return '\u901a\u52e4'
  }
  return ''
}

function inferPreferredColor(text = '') {
  const normalized = normalizeInput(text)
  if (!normalized) {
    return ''
  }

  const colorMap = ['\u9ed1\u8272', '\u767d\u8272', '\u84dd\u8272', '\u7c89\u8272', '\u7eff\u8272', '\u7070\u8272', '\u7c73\u8272', '\u5361\u5176\u8272', '\u7ea2\u8272', '\u7d2b\u8272']
  return colorMap.find(color => normalized.includes(color)) || ''
}

function normalizeRecommendationResult(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    logWarning('daily.normalizeRecommendationResult', 'invalid recommendation result', { rawType: typeof raw })
    raw = {}
  }

  return {
    requestId: normalizeInput(raw.requestId) || `rec_${Date.now()}`,
    summary: normalizeInput(raw.summary) || '\u5df2\u6839\u636e\u4f60\u7684\u9700\u6c42\u751f\u6210\u667a\u80fd\u63a8\u8350\u3002',
    replyText: normalizeInput(raw.replyText) || '\u6211\u5df2\u7ecf\u6574\u7406\u597d\u63a8\u8350\u601d\u8def\u5566\uff0c\u70b9\u51fb\u4e0b\u65b9\u6309\u94ae\u5373\u53ef\u7ee7\u7eed\u8bd5\u7a7f\u3002',
    selectedClothesIds: uniqueStringList(raw.selectedClothesIds, 'daily.normalizeRecommendationResult.selectedClothesIds'),
    selectedPhotoUrls: uniqueStringList(raw.selectedPhotoUrls, 'daily.normalizeRecommendationResult.selectedPhotoUrls'),
    outfitLines: Array.isArray(raw.outfitLines)
      ? raw.outfitLines.map(normalizeInput).filter(Boolean)
      : [],
    tips: Array.isArray(raw.tips)
      ? raw.tips.map(normalizeInput).filter(Boolean)
      : [],
    wardrobeAnalysisSummary: normalizeInput(raw.wardrobeAnalysisSummary),
    ctaLabel: normalizeInput(raw.ctaLabel) || '\u53bb\u8bd5\u7a7f\u9875\u7ee7\u7eed\u642d\u914d',
    source: normalizeInput(raw.source),
    retrievalSource: normalizeInput(raw.retrievalSource),
    knowledgeId: normalizeInput(raw.knowledgeId),
    retrievalHitCount: normalizeHitCount(raw.retrievalHitCount)
  }
}

function hasTryOnSelection(result = {}) {
  return Array.isArray(result && result.selectedClothesIds) && result.selectedClothesIds.length > 0
}

function buildRecommendationStatus(result = {}) {
  if (hasTryOnSelection(result)) {
    return 'ready'
  }

  const safeResult = result && typeof result === 'object' && !Array.isArray(result) ? result : {}
  const hasNarrative = Boolean(
    normalizeInput(safeResult.summary)
    || normalizeInput(safeResult.replyText)
    || (Array.isArray(safeResult.tips) && safeResult.tips.length)
    || (Array.isArray(safeResult.outfitLines) && safeResult.outfitLines.length)
  )

  return hasNarrative ? 'empty' : 'invalid'
}

function buildRecommendationPayload(userQuery, options = {}) {
  const normalizedQuery = normalizeInput(userQuery)
  const weatherInfo = normalizePlainObject(options.weatherInfo, 'daily.buildRecommendationPayload.weatherInfo')
  const userPreferences = normalizePlainObject(options.userPreferences, 'daily.buildRecommendationPayload.userPreferences')

  if (!normalizedQuery) {
    logWarning('daily.buildRecommendationPayload', 'missing userQuery')
  }

  return {
    requestId: `local_${Date.now()}`,
    userQuery: normalizedQuery,
    city: normalizeInput(options.city),
    currentDateLabel: normalizeInput(options.currentDateLabel),
    weatherSuggestion: normalizeInput(options.weatherSuggestion),
    weatherInfo: {
      temp: weatherInfo.temp === undefined || weatherInfo.temp === null ? '' : weatherInfo.temp,
      text: weatherInfo.text === undefined || weatherInfo.text === null ? '' : weatherInfo.text,
      icon: weatherInfo.icon === undefined || weatherInfo.icon === null ? '' : weatherInfo.icon
    },
    occasion: normalizeInput(options.occasion) || inferOccasion(normalizedQuery),
    userPreferences: {
      ...userPreferences,
      preferredStyle: normalizeInput(userPreferences.preferredStyle) || inferPreferredStyle(normalizedQuery),
      preferredColor: normalizeInput(userPreferences.preferredColor) || inferPreferredColor(normalizedQuery)
    },
    createdAt: Date.now()
  }
}

function buildMockRecommendationResult(payload = {}) {
  const userQuery = normalizeInput(payload.userQuery)
  const weatherSuggestion = normalizeInput(payload.weatherSuggestion)
  const weatherText = normalizeInput(payload.weatherInfo && payload.weatherInfo.text)
  const city = normalizeInput(payload.city) || '\u5f53\u524d\u57ce\u5e02'

  const isCommute = /(\u901a\u52e4|\u4e0a\u73ed|\u9762\u8bd5)/.test(userQuery)
  const isDateScene = /(\u7ea6\u4f1a|\u805a\u4f1a)/.test(userQuery)
  const isRainScene = weatherText.includes('\u96e8') || weatherSuggestion.includes('\u96e8\u5177')
  const isTravelScene = /(\u65c5\u6e38|\u5ea6\u5047|\u6cf0\u56fd|\u6d77\u8fb9|\u516c\u56ed)/.test(userQuery)

  let outfitLines = [
    '\u4e0a\u88c5\uff1a\u57fa\u7840\u6b3e\u9488\u7ec7\u6216\u886c\u886b',
    '\u4e0b\u88c5\uff1a\u5229\u843d\u957f\u88e4',
    '\u978b\u5b50\uff1a\u8212\u9002\u767e\u642d\u7684\u5e73\u5e95\u978b'
  ]
  const tips = [
    `${city}\u5f53\u524d\u5929\u6c14\u63d0\u793a\uff1a${weatherSuggestion || '\u5efa\u8bae\u6309\u7167\u5f53\u5929\u6e29\u5ea6\u7075\u6d3b\u642d\u914d\u3002'}`,
    '\u5982\u679c\u4f60\u613f\u610f\uff0c\u6211\u53ef\u4ee5\u5e26\u4f60\u53bb\u8bd5\u7a7f\u9875\u7ee7\u7eed\u642d\u914d\u3002'
  ]
  let replyText = '\u5df2\u7ed3\u5408\u4f60\u7684\u63cf\u8ff0\u751f\u6210\u4e00\u5957\u7a33\u59a5\u53c8\u597d\u642d\u7684\u63a8\u8350\u3002'

  if (isCommute) {
    outfitLines = [
      '\u4e0a\u88c5\uff1a\u6d45\u8272\u886c\u886b\u6216\u7ec6\u9488\u7ec7',
      '\u4e0b\u88c5\uff1a\u76f4\u7b52\u897f\u88e4\u6216\u9ad8\u8170\u957f\u88e4',
      '\u5916\u5957\uff1a\u8f7b\u8584\u897f\u88c5\u6216\u77ed\u6b3e\u98ce\u8863',
      '\u978b\u5b50\uff1a\u4f4e\u8ddf\u76ae\u978b\u6216\u4e50\u798f\u978b'
    ]
    replyText = '\u7ed9\u4f60\u6574\u7406\u4e86\u4e00\u5957\u504f\u901a\u52e4\u611f\u7684\u5229\u843d\u642d\u914d\uff0c\u6b63\u5f0f\u53c8\u4e0d\u6c89\u95f7\u3002'
  } else if (isDateScene) {
    outfitLines = [
      '\u4e0a\u88c5\uff1a\u67d4\u548c\u8272\u7cfb\u4e0a\u8863',
      '\u4e0b\u88c5\uff1a\u534a\u88d9\u6216\u5782\u5760\u957f\u88e4',
      '\u5916\u5957\uff1a\u77ed\u6b3e\u5f00\u886b\u6216\u8f7b\u8584\u5916\u5957',
      '\u978b\u5b50\uff1a\u7cbe\u81f4\u4f4e\u8ddf\u978b'
    ]
    replyText = '\u8fd9\u5957\u66f4\u504f\u8f7b\u76c8\u7cbe\u81f4\uff0c\u9002\u5408\u7ea6\u4f1a\u6216\u805a\u4f1a\u573a\u666f\u3002'
  } else if (isTravelScene) {
    outfitLines = [
      '\u4e0a\u88c5\uff1a\u8f7b\u8584\u900f\u6c14\u7684\u77ed\u8896\u6216\u9632\u6652\u886c\u886b',
      '\u4e0b\u88c5\uff1a\u5bbd\u677e\u77ed\u88e4\u6216\u8f7b\u4fbf\u957f\u88d9',
      '\u978b\u5b50\uff1a\u65b9\u4fbf\u4e45\u8d70\u7684\u8fd0\u52a8\u978b\u6216\u51c9\u978b',
      '\u914d\u9970\uff1a\u906e\u9633\u5e3d\u548c\u8f7b\u4fbf\u659c\u6316\u5305'
    ]
    replyText = '\u8fd9\u6b21\u66f4\u9002\u5408\u505a\u4e00\u5957\u8f7b\u4fbf\u597d\u8d70\u3001\u9002\u5408\u51fa\u6e38\u62cd\u7167\u7684\u642d\u914d\u3002'
  }

  if (isRainScene) {
    tips.unshift('\u4eca\u5929\u6709\u96e8\uff0c\u4f18\u5148\u642d\u914d\u9632\u6cfc\u6c34\u5916\u5957\uff0c\u907f\u514d\u62d6\u5730\u88e4\u811a\u3002')
  }

  return normalizeRecommendationResult({
    requestId: normalizeInput(payload.requestId) || `mock_${Date.now()}`,
    summary: '\u667a\u80fd\u63a8\u8350\u5df2\u751f\u6210',
    replyText,
    selectedClothesIds: Array.isArray(payload.selectedClothesIds) ? payload.selectedClothesIds : [],
    selectedPhotoUrls: Array.isArray(payload.selectedPhotoUrls) ? payload.selectedPhotoUrls : [],
    outfitLines,
    tips,
    wardrobeAnalysisSummary: normalizeInput(payload.wardrobeAnalysisSummary),
    ctaLabel: '\u53bb\u8bd5\u7a7f\u9875\u7ee7\u7eed\u642d\u914d',
    source: 'fallback'
  })
}

function isCloudFunctionTimeoutError(error = {}) {
  const errMsg = normalizeInput(error && error.errMsg)
  return /-504003|TIME_LIMIT_EXCEEDED|timed out/i.test(errMsg)
}

function buildInventorySummaryLine(inventorySummary = {}) {
  const summary = normalizePlainObject(inventorySummary, 'daily.buildInventorySummaryLine.summary')
  const totalWardrobeCount = Number(summary.totalWardrobeCount) || 0
  const syncableCount = Number(summary.syncableCount) || 0
  const readyInKnowledgeCount = Number(summary.readyInKnowledgeCount) || 0
  const missingKnowledgeCount = Number(summary.missingKnowledgeCount) || 0
  const missingImageCount = Number(summary.missingImageCount) || 0

  if (!totalWardrobeCount && !syncableCount && !readyInKnowledgeCount) {
    return ''
  }

  let text = `\u8863\u6a71 ${totalWardrobeCount} \u4ef6 / \u53ef\u540c\u6b65 ${syncableCount} \u4ef6 / \u5df2\u5165\u5e93 ${readyInKnowledgeCount} \u4ef6 / \u7f3a\u5931 ${missingKnowledgeCount} \u4ef6`
  if (missingImageCount > 0) {
    text += `\uff08\u5176\u4e2d\u65e0\u56fe ${missingImageCount} \u4ef6\uff09`
  }
  return text
}

function buildKnowledgeRebuildFeedback(result = {}) {
  const code = result && result.code
  const data = normalizePlainObject(result && result.data, 'daily.buildKnowledgeRebuildFeedback.data')
  const sampleFailures = Array.isArray(data.sampleFailures) ? data.sampleFailures : []
  const skipReasonStats = normalizePlainObject(data.skipReasonStats, 'daily.buildKnowledgeRebuildFeedback.skipReasonStats')

  const total = Number(data.total) || 0
  const readyCount = Number(data.readyCount) || 0
  const syncedCount = Number(data.syncedCount) || 0
  const syncingCount = Number(data.syncingCount) || 0
  const queuedCount = Number(data.queuedCount) || 0
  const failedCount = Number(data.failedCount) || 0
  const skippedCount = Number(data.skippedCount) || 0
  const knowledgeId = normalizeInput(data.knowledgeId) || '\u672a\u8fd4\u56de'
  const completedCount = readyCount + syncedCount
  const pendingCount = syncingCount + queuedCount
  const firstFailure = normalizeInput(sampleFailures[0] && sampleFailures[0].error)
  const inventoryLine = buildInventorySummaryLine(data.inventorySummary)
  const missingImageCount = Number(skipReasonStats.missing_image) || Number(data.inventorySummary && data.inventorySummary.missingImageCount) || 0
  const requestMode = normalizeInput(data.requestMode) || 'normal'
  const modeLabel = requestMode === 'forceResync' ? '\u5f3a\u5236\u91cd\u540c\u6b65' : '\u8865\u540c\u6b65'

  if (code !== 200) {
    return {
      status: 'failed',
      title: `${modeLabel}\u5931\u8d25`,
      summaryText: `${normalizeInput(result && result.message) || `${modeLabel}\u5931\u8d25`}${normalizeInput(result && result.error) ? `\uff1a${normalizeInput(result.error)}` : ''}`
    }
  }

  if (pendingCount > 0) {
    return {
      status: 'pending',
      title: `${modeLabel}\u5df2\u53d1\u8d77`,
      summaryText: [
        inventoryLine || `\u77e5\u8bc6\u5e93\uff1a${knowledgeId}`,
        `\u77e5\u8bc6\u5e93\uff1a${knowledgeId}\uff1b\u540c\u6b65\u4e2d ${pendingCount} \u4ef6\uff0c\u5df2\u5b8c\u6210 ${completedCount} \u4ef6\uff0c\u5931\u8d25 ${failedCount} \u4ef6\u3002\u8bf7\u7a0d\u540e\u518d\u6b21\u68c0\u67e5\u72b6\u6001\u3002`
      ].filter(Boolean).join('\uff1b')
    }
  }

  if (completedCount > 0) {
    return {
      status: 'success',
      title: `${modeLabel}\u5b8c\u6210`,
      summaryText: [
        inventoryLine,
        `\u77e5\u8bc6\u5e93\uff1a${knowledgeId}\uff1b\u672c\u6b21\u5b8c\u6210 ${completedCount} \u4ef6\uff0c\u5931\u8d25 ${failedCount} \u4ef6\uff0c\u8df3\u8fc7 ${skippedCount} \u4ef6\u3002`
      ].filter(Boolean).join('\uff1b')
    }
  }

  if (failedCount > 0) {
    return {
      status: 'failed',
      title: `${modeLabel}\u5931\u8d25`,
      summaryText: [
        inventoryLine,
        `\u77e5\u8bc6\u5e93\uff1a${knowledgeId}\uff1b\u5171\u5904\u7406 ${total} \u4ef6\uff0c\u5931\u8d25 ${failedCount} \u4ef6${firstFailure ? `\u3002\u9996\u4e2a\u9519\u8bef\uff1a${firstFailure}` : '\u3002'}`
      ].filter(Boolean).join('\uff1b')
    }
  }

  return {
    status: 'idle',
    title: '\u65e0\u9700\u8865\u540c\u6b65',
    summaryText: [
      inventoryLine,
      `\u77e5\u8bc6\u5e93\uff1a${knowledgeId}\uff1b\u5f53\u524d\u6ca1\u6709\u5f85\u540c\u6b65\u8863\u7269${missingImageCount > 0 ? `\uff0c\u5176\u4e2d\u65e0\u56fe ${missingImageCount} \u4ef6` : ''}\u3002`
    ].filter(Boolean).join('\uff1b')
  }
}

module.exports = {
  normalizeInput,
  normalizeTemperature,
  uniqueStringList,
  buildDateLabel,
  buildWeatherSuggestion,
  inferOccasion,
  inferPreferredStyle,
  inferPreferredColor,
  normalizeRecommendationResult,
  hasTryOnSelection,
  buildRecommendationStatus,
  buildRecommendationPayload,
  buildMockRecommendationResult,
  isCloudFunctionTimeoutError,
  buildKnowledgeRebuildFeedback,
  buildInventorySummaryLine
}