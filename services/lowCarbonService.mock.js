const {
  getLocalDateKey,
  naturalDayDifference
} = require('../utils/outfitDate')

const CLOTHES_STORAGE_KEY = 'mock_low_carbon_clothes_v1'
const PRIORITY_STORAGE_KEY = 'mock_low_carbon_priority_v1'
const OUTFIT_STORAGE_KEY = 'mock_outfit_records_v1'
const IDLE_THRESHOLD_DAYS = 15

function getStoredArray(key) {
  const value = wx.getStorageSync(key)
  return Array.isArray(value) ? value : []
}

function uniqueIds(ids) {
  if (!Array.isArray(ids)) return []
  return [...new Set(
    ids
      .filter(id => typeof id === 'string')
      .map(id => id.trim())
      .filter(Boolean)
  )]
}

function createdAtDateKey(createdAt) {
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? '' : getLocalDateKey(date)
}

function buildUsageByClothing(records) {
  const usage = new Map()
  records.forEach(record => {
    if (!record || typeof record.dateKey !== 'string') return
    uniqueIds(record.clothingIds).forEach(clothingId => {
      const current = usage.get(clothingId) || {
        wearCount: 0,
        lastWornAt: null,
        usedDates: new Set()
      }
      current.wearCount += 1
      current.usedDates.add(record.dateKey)
      if (!current.lastWornAt || record.dateKey > current.lastWornAt) {
        current.lastWornAt = record.dateKey
      }
      usage.set(clothingId, current)
    })
  })
  return usage
}

function buildStatistics(todayDateKey = getLocalDateKey()) {
  const clothes = getStoredArray(CLOTHES_STORAGE_KEY)
  const outfitRecords = getStoredArray(OUTFIT_STORAGE_KEY)
  const usage = buildUsageByClothing(outfitRecords)
  const existingIds = new Set(clothes.map(item => item && item._id).filter(Boolean))
  const activeIds = new Set()
  const outfitRecordCount = outfitRecords.filter(record => (
    uniqueIds(record && record.clothingIds).some(id => existingIds.has(id))
  )).length

  usage.forEach((item, clothingId) => {
    if (!existingIds.has(clothingId)) return
    if ([...item.usedDates].some(dateKey => {
      const difference = naturalDayDifference(todayDateKey, dateKey)
      return Number.isInteger(difference) && difference >= 0 && difference <= 29
    })) {
      activeIds.add(clothingId)
    }
  })

  const enrichedClothes = clothes.map(clothing => {
    const itemUsage = usage.get(clothing._id)
    const wearCount = itemUsage ? itemUsage.wearCount : 0
    const lastWornAt = itemUsage ? itemUsage.lastWornAt : null
    const referenceDate = lastWornAt || createdAtDateKey(clothing.createdAt)
    const unusedDays = referenceDate
      ? naturalDayDifference(todayDateKey, referenceDate)
      : 0
    return {
      ...clothing,
      wearCount,
      lastWornAt,
      unusedDays: Number.isInteger(unusedDays) ? Math.max(0, unusedDays) : 0,
      neverWorn: wearCount === 0
    }
  })

  const idleClothes = enrichedClothes
    .filter(item => item.unusedDays >= IDLE_THRESHOLD_DAYS)
    .sort((a, b) => b.unusedDays - a.unusedDays)
  const totalClothes = clothes.length
  const activeClothes = activeIds.size
  const activityRate = totalClothes === 0
    ? 0
    : Math.round(activeClothes / totalClothes * 100)

  return {
    totalClothes,
    activeClothes,
    activityRate,
    enrichedClothes,
    idleClothes,
    outfitRecordCount
  }
}

function buildSuggestions(statistics) {
  const suggestions = []
  const { totalClothes, activityRate, idleClothes, outfitRecordCount } = statistics

  if (totalClothes === 0) {
    return ['\u8863\u6a71\u8fd8\u6ca1\u6709\u8863\u7269\uff0c\u5148\u6dfb\u52a0\u8863\u7269\u540e\u518d\u67e5\u770b\u4f7f\u7528\u60c5\u51b5\u3002']
  }
  if (outfitRecordCount === 0) {
    suggestions.push('\u8fd8\u6ca1\u6709\u7a7f\u642d\u8bb0\u5f55\uff0c\u53ef\u4ee5\u4ece\u8bb0\u5f55\u7b2c\u4e00\u5957\u4eca\u65e5\u7a7f\u642d\u5f00\u59cb\u3002')
  }
  if (idleClothes.length / totalClothes >= 0.3) {
    suggestions.push(`\u4f60\u6709${idleClothes.length}\u4ef6\u8863\u7269\u8f83\u957f\u65f6\u95f4\u672a\u4f7f\u7528\uff0c\u53ef\u4ee5\u5c1d\u8bd5\u91cd\u65b0\u642d\u914d\u3002`)
  }
  if (activityRate < 40) {
    suggestions.push('\u6700\u8fd1\u8863\u7269\u6d3b\u8dc3\u7387\u8f83\u4f4e\uff0c\u53ef\u4ee5\u4f18\u5148\u4f7f\u7528\u8f83\u5c11\u7a7f\u7740\u7684\u8863\u7269\u3002')
  }
  if (idleClothes.length > 0 && suggestions.length < 3) {
    const longestIdle = idleClothes[0]
    suggestions.push(`\u201c${longestIdle.name || '\u8fd9\u4ef6\u8863\u7269'}\u201d\u5df2\u8fde\u7eed${longestIdle.unusedDays}\u5929\u672a\u4f7f\u7528\uff0c\u53ef\u4ee5\u5c1d\u8bd5\u52a0\u5165\u4e0b\u4e00\u6b21\u642d\u914d\u3002`)
  }
  if (activityRate >= 70 && suggestions.length < 3) {
    suggestions.push('\u6700\u8fd1\u8863\u6a71\u4f7f\u7528\u8f83\u5747\u8861\uff0c\u7ee7\u7eed\u4fdd\u6301\u73b0\u6709\u8863\u7269\u7684\u91cd\u590d\u5229\u7528\u3002')
  }
  return suggestions.slice(0, 3)
}

async function getLowCarbonPriority() {
  return {
    code: 200,
    message: '\u83b7\u53d6\u8bbe\u7f6e\u6210\u529f',
    data: {
      lowCarbonPriority: wx.getStorageSync(PRIORITY_STORAGE_KEY) === true
    }
  }
}

async function updateLowCarbonPriority(input) {
  const enabled = typeof input === 'boolean'
    ? input
    : Boolean(input && input.enabled)
  wx.setStorageSync(PRIORITY_STORAGE_KEY, enabled)
  return {
    code: 200,
    message: '\u8bbe\u7f6e\u5df2\u66f4\u65b0',
    data: {
      lowCarbonPriority: enabled
    }
  }
}

async function getLowCarbonSummary(options = {}) {
  const statistics = buildStatistics(options.todayDateKey || getLocalDateKey())
  const priority = await getLowCarbonPriority()
  return {
    code: 200,
    message: '\u83b7\u53d6\u95f2\u7f6e\u9884\u8b66\u6570\u636e\u6210\u529f',
    data: {
      totalClothes: statistics.totalClothes,
      activeClothes: statistics.activeClothes,
      activityRate: statistics.activityRate,
      idleCount: statistics.idleClothes.length,
      suggestions: buildSuggestions(statistics),
      lowCarbonPriority: priority.data.lowCarbonPriority
    }
  }
}

async function getIdleClothes(options = {}) {
  const statistics = buildStatistics(options.todayDateKey || getLocalDateKey())
  return {
    code: 200,
    message: '\u83b7\u53d6\u95f2\u7f6e\u8863\u7269\u6210\u529f',
    data: {
      count: statistics.idleClothes.length,
      clothes: statistics.idleClothes
    }
  }
}

async function getRecommendationSignals(options = {}) {
  const statistics = buildStatistics(options.todayDateKey || getLocalDateKey())
  const priority = await getLowCarbonPriority()
  return {
    code: 200,
    message: '\u83b7\u53d6\u8863\u7269\u4f7f\u7528\u4fe1\u53f7\u6210\u529f',
    data: {
      enabled: priority.data.lowCarbonPriority,
      signals: statistics.enrichedClothes.map(item => ({
        clothingId: item._id,
        wearCount: item.wearCount,
        lastWornAt: item.lastWornAt,
        unusedDays: item.unusedDays,
        neverWorn: item.neverWorn,
        idle: item.unusedDays >= IDLE_THRESHOLD_DAYS
      }))
    }
  }
}

function seedMockClothes(clothes = []) {
  const safeClothes = Array.isArray(clothes)
    ? clothes
      .filter(item => item && typeof item === 'object' && item._id)
      .map(item => ({
        _id: String(item._id),
        name: item.name || '\u672a\u547d\u540d\u8863\u7269',
        image: item.image || '/images/icons/wardrobe.png',
        createdAt: item.createdAt || new Date().toISOString()
      }))
    : []
  wx.setStorageSync(CLOTHES_STORAGE_KEY, safeClothes)
  return safeClothes
}

function resetMockLowCarbonData() {
  wx.removeStorageSync(CLOTHES_STORAGE_KEY)
  wx.removeStorageSync(PRIORITY_STORAGE_KEY)
}

module.exports = {
  CLOTHES_STORAGE_KEY,
  PRIORITY_STORAGE_KEY,
  OUTFIT_STORAGE_KEY,
  IDLE_THRESHOLD_DAYS,
  buildUsageByClothing,
  buildStatistics,
  buildSuggestions,
  getLowCarbonSummary,
  getIdleClothes,
  getLowCarbonPriority,
  updateLowCarbonPriority,
  getRecommendationSignals,
  resetMockLowCarbonData,
  seedMockClothes
}