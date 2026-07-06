const STORAGE_KEY = 'mock_outfit_records_v1'
const DAILY_LIMIT = 3
const { getLocalDateKey } = require('../utils/outfitDate')

function getShanghaiDateKey(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const year = shifted.getUTCFullYear()
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getRecords() {
  const records = wx.getStorageSync(STORAGE_KEY)
  return Array.isArray(records) ? records : []
}

function setRecords(records) {
  wx.setStorageSync(STORAGE_KEY, Array.isArray(records) ? records : [])
}

function uniqueClothingIds(clothingIds) {
  if (!Array.isArray(clothingIds)) return []
  const seen = new Set()
  return clothingIds.reduce((result, value) => {
    if (typeof value !== 'string') return result
    const id = value.trim()
    if (id && !seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
    return result
  }, [])
}

function getSmallestAvailableSlot(records) {
  const occupied = new Set(records.map(item => item.slot))
  return [1, 2, 3].find(slot => !occupied.has(slot)) || null
}

function buildTodayPayload(records, dateKey) {
  const outfits = records
    .filter(item => item.dateKey === dateKey)
    .sort((a, b) => a.slot - b.slot)

  return {
    code: 200,
    message: '获取今日穿搭成功',
    data: {
      dateKey,
      count: outfits.length,
      remaining: Math.max(0, DAILY_LIMIT - outfits.length),
      outfits
    }
  }
}

async function getTodayOutfits() {
  const dateKey = getShanghaiDateKey()
  return buildTodayPayload(getRecords(), dateKey)
}

async function getOutfitHistory(options = {}) {
  const selectedDate = typeof options.dateKey === 'string'
    ? options.dateKey.trim()
    : getLocalDateKey()
  const records = getRecords()
  const selectedRecords = records
    .filter(item => item.dateKey === selectedDate)
    .sort((a, b) => a.slot - b.slot)
  const availableDates = [...new Set(
    records
      .map(item => item && item.dateKey)
      .filter(Boolean)
  )].sort((a, b) => b.localeCompare(a))

  return {
    code: 200,
    message: '获取历史穿搭成功',
    data: {
      selectedDate,
      records: selectedRecords,
      availableDates
    }
  }
}

async function saveOutfitRecord(data = {}) {
  const outfitImageFileID = typeof data.outfitImageFileID === 'string'
    ? data.outfitImageFileID.trim()
    : ''
  const requestId = typeof data.requestId === 'string' ? data.requestId.trim() : ''

  if (!outfitImageFileID) {
    return { code: 400, message: '缺少穿搭图片' }
  }
  if (!requestId) {
    return { code: 400, message: '缺少requestId' }
  }

  const records = getRecords()
  const existing = records.find(item => item.requestId === requestId)
  if (existing) {
    const result = {
      code: 200,
      message: '该保存请求已处理',
      data: { ...existing, idempotent: true }
    }
    return result
  }

  const dateKey = getShanghaiDateKey()
  const todayRecords = records.filter(item => item.dateKey === dateKey)
  if (todayRecords.length >= DAILY_LIMIT) {
    const result = {
      code: 409,
      message: '今日穿搭数量已达上限',
      data: {
        reason: 'DAILY_OUTFIT_LIMIT_REACHED',
        canManage: true
      }
    }
    return result
  }

  const slot = getSmallestAvailableSlot(todayRecords)
  if (!slot) {
    return {
      code: 409,
      message: '今日穿搭数量已达上限',
      data: {
        reason: 'DAILY_OUTFIT_LIMIT_REACHED',
        canManage: true
      }
    }
  }

  const createdAt = new Date().toISOString()
  const record = {
    _id: `mock_outfit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    dateKey,
    slot,
    outfitImageFileID,
    clothingIds: uniqueClothingIds(data.clothingIds),
    requestId,
    detailsExpired: false,
    createdAt
  }
  setRecords([...records, record])

  const result = {
    code: 200,
    message: '保存今日穿搭成功',
    data: { ...record, idempotent: false }
  }
  console.log('[OUTFIT_REAL_DEBUG] storage after save', {
    records: wx.getStorageSync(STORAGE_KEY)
  })
  return result
}

async function deleteTodayOutfit(outfitId) {
  const records = getRecords()
  const index = records.findIndex(item => item._id === outfitId)
  if (index === -1) {
    return { code: 404, message: '穿搭记录不存在' }
  }

  const dateKey = getShanghaiDateKey()
  if (records[index].dateKey !== dateKey) {
    return {
      code: 409,
      message: '历史穿搭已冻结，不能删除',
      data: { reason: 'HISTORICAL_OUTFIT_FROZEN' }
    }
  }

  const deleted = records[index]
  const nextRecords = records.filter(item => item._id !== outfitId)
  setRecords(nextRecords)
  const recordsAfterDelete = getRecords()
  const result = {
    code: 200,
    message: '删除成功',
    data: {
      id: deleted._id,
      dateKey: deleted.dateKey,
      slot: deleted.slot
    }
  }
  console.log('[OUTFIT_REAL_DEBUG] storage after delete', {
    records: recordsAfterDelete
  })
  return result
}

function resetMockOutfits() {
  wx.removeStorageSync(STORAGE_KEY)
}

function seedMockOutfits(records = []) {
  const seedTimestamp = Date.now()
  const safeRecords = Array.isArray(records)
    ? records.map((item, index) => {
      const record = item && typeof item === 'object' ? item : {}
      return {
        ...record,
        _id: record._id || `mock_seed_outfit_${seedTimestamp}_${index}`,
        requestId: record.requestId || `mock_seed_request_${seedTimestamp}_${index}`,
        clothingIds: uniqueClothingIds(record.clothingIds),
        detailsExpired: record.detailsExpired === true,
        createdAt: record.createdAt || new Date(seedTimestamp + index).toISOString()
      }
    })
    : []
  setRecords(safeRecords)
  return safeRecords
}

module.exports = {
  STORAGE_KEY,
  getShanghaiDateKey,
  getTodayOutfits,
  getOutfitHistory,
  saveOutfitRecord,
  deleteTodayOutfit,
  resetMockOutfits,
  seedMockOutfits
}
