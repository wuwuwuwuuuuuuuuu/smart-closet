const {
  getLocalDateKey,
  naturalDayDifference
} = require('../utils/outfitDate')

const CLOTHES_STORAGE_KEY = 'mock_low_carbon_clothes_v1'
const PRIORITY_STORAGE_KEY = 'mock_low_carbon_priority_v1'
const OUTFIT_STORAGE_KEY = 'mock_outfit_records_v1'
const IDLE_DAYS = 30

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
    .filter(item => item.unusedDays >= IDLE_DAYS)
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
  const {
    totalClothes,
    activityRate,
    idleClothes,
    outfitRecordCount
  } = statistics

  if (totalClothes === 0) {
    return ['衣橱还没有衣物，先添加衣物后再查看使用情况。']
  }
  if (outfitRecordCount === 0) {
    suggestions.push('还没有穿搭记录，可以从记录第一套今日穿搭开始。')
  }
  if (idleClothes.length / totalClothes >= 0.3) {
    suggestions.push(`你有${idleClothes.length}件衣物较长时间未使用，可以尝试重新搭配。`)
  }
  if (activityRate < 40) {
    suggestions.push('最近衣物活跃率较低，可以优先使用较少穿着的衣物。')
  }
  if (idleClothes.length > 0 && suggestions.length < 3) {
    const longestIdle = idleClothes[0]
    suggestions.push(`“${longestIdle.name || '这件衣物'}”已连续${longestIdle.unusedDays}天未使用，可以尝试加入下一次搭配。`)
  }
  if (activityRate >= 70 && suggestions.length < 3) {
    suggestions.push('最近衣橱使用较均衡，继续保持现有衣物的重复利用。')
  }
  return suggestions.slice(0, 3)
}

async function getLowCarbonPriority() {
  return {
    code: 200,
    message: '获取设置成功',
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
    message: '设置已更新',
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
    message: '获取闲置预警数据成功',
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
    message: '获取闲置衣物成功',
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
    message: '获取衣物使用信号成功',
    data: {
      enabled: priority.data.lowCarbonPriority,
      signals: statistics.enrichedClothes.map(item => ({
        clothingId: item._id,
        wearCount: item.wearCount,
        lastWornAt: item.lastWornAt,
        unusedDays: item.unusedDays,
        neverWorn: item.neverWorn,
        idle: item.unusedDays >= IDLE_DAYS
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
        name: item.name || '未命名衣物',
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
  IDLE_DAYS,
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
