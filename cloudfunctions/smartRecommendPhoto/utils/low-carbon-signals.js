const IDLE_THRESHOLD_DAYS = 15

function pad2(value) {
  return String(value).padStart(2, '0')
}

function getShanghaiDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const map = parts.reduce((result, part) => {
    result[part.type] = part.value
    return result
  }, {})
  return `${map.year}-${map.month}-${map.day}`
}

function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string') return null
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim())
  if (!matched) return null
  const year = Number(matched[1])
  const month = Number(matched[2])
  const day = Number(matched[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null
  }
  return { date }
}

function normalizeDateKey(value) {
  if (!value) return ''
  if (typeof value === 'string' && parseDateKey(value)) return value.trim()
  if (value instanceof Date) return getShanghaiDateKey(value)
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return getShanghaiDateKey(value.toDate())
    if (typeof value.getTime === 'function') return getShanghaiDateKey(new Date(value.getTime()))
    if (typeof value.$date === 'string') return getShanghaiDateKey(value.$date)
  }
  return getShanghaiDateKey(value)
}

function normalizeWearCount(value) {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

function naturalDayDifference(newerDateKey, olderDateKey) {
  const newer = parseDateKey(newerDateKey)
  const older = parseDateKey(olderDateKey)
  if (!newer || !older) return NaN
  return Math.round((newer.date.getTime() - older.date.getTime()) / 86400000)
}

function calculateUnusedDays(clothing = {}, todayDateKey = getShanghaiDateKey()) {
  const wearCount = normalizeWearCount(clothing.wearCount)
  const lastWornAt = normalizeDateKey(clothing.lastWornAt)
  const createdAt = normalizeDateKey(
    clothing.created_at
    || clothing.createdAt
    || clothing.createTime
    || clothing.created
  )
  const referenceDate = lastWornAt || (wearCount === 0 ? createdAt : '')
  const difference = referenceDate ? naturalDayDifference(todayDateKey, referenceDate) : NaN
  return Number.isInteger(difference) ? Math.max(0, difference) : 0
}

function buildServerLowCarbonSignal(clothing = {}, todayDateKey = getShanghaiDateKey()) {
  const clothingId = String(clothing._id || clothing.id || clothing.clothingId || '').trim()
  if (!clothingId) return null

  const wearCount = normalizeWearCount(clothing.wearCount)
  const lastWornAt = normalizeDateKey(clothing.lastWornAt)
  const createdAt = normalizeDateKey(
    clothing.created_at
    || clothing.createdAt
    || clothing.createTime
    || clothing.created
  )
  const neverWorn = wearCount === 0
  const unusedDays = calculateUnusedDays(clothing, todayDateKey)
  const idle = lastWornAt
    ? unusedDays >= IDLE_THRESHOLD_DAYS
    : (neverWorn && Boolean(createdAt) && unusedDays >= IDLE_THRESHOLD_DAYS)

  return {
    clothingId,
    wearCount,
    lastWornAt: lastWornAt || null,
    unusedDays,
    neverWorn,
    idle
  }
}

function buildServerLowCarbonSignalMap(clothes = [], todayDateKey = getShanghaiDateKey()) {
  const map = new Map()
  if (!Array.isArray(clothes)) return map
  clothes.forEach(clothing => {
    const signal = buildServerLowCarbonSignal(clothing, todayDateKey)
    if (signal) map.set(signal.clothingId, signal)
  })
  return map
}

module.exports = {
  IDLE_THRESHOLD_DAYS,
  getShanghaiDateKey,
  normalizeWearCount,
  normalizeDateKey,
  naturalDayDifference,
  calculateUnusedDays,
  buildServerLowCarbonSignal,
  buildServerLowCarbonSignalMap
}
