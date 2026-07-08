const PAGE_SIZE = 100
const IDLE_THRESHOLD_DAYS = 15
const ACTIVE_DAYS = 30

function pad2(value) {
  return String(value).padStart(2, '0')
}

function getShanghaiParts(date = new Date()) {
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
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day)
  }
}

function getShanghaiDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const { year, month, day } = getShanghaiParts(date)
  return `${year}-${pad2(month)}-${pad2(day)}`
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
  return { year, month, day, date }
}

function toShanghaiDateKey(value) {
  if (!value) return ''
  if (typeof value === 'string' && parseDateKey(value)) return value
  if (value instanceof Date) return getShanghaiDateKey(value)
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return getShanghaiDateKey(value.toDate())
    if (typeof value.getTime === 'function') return getShanghaiDateKey(new Date(value.getTime()))
    if (typeof value.$date === 'string') return getShanghaiDateKey(value.$date)
  }
  return getShanghaiDateKey(value)
}

function naturalDayDifference(newerDateKey, olderDateKey) {
  const newer = parseDateKey(newerDateKey)
  const older = parseDateKey(olderDateKey)
  if (!newer || !older) return NaN
  return Math.round((newer.date.getTime() - older.date.getTime()) / 86400000)
}

function isWithinRecentDays(dateKey, todayDateKey, days) {
  const difference = naturalDayDifference(todayDateKey, dateKey)
  return Number.isInteger(difference) && difference >= 0 && difference < days
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeWearCount(value) {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

function normalizeClothingImage(clothing = {}) {
  const image = clothing.image
  if (typeof image === 'string') return image.trim()
  if (Array.isArray(image)) {
    return normalizeText(image.find(item => typeof item === 'string' && item.trim()))
  }
  if (typeof clothing.coverImage === 'string') return clothing.coverImage.trim()
  if (Array.isArray(clothing.coverImage)) {
    return normalizeText(clothing.coverImage.find(item => typeof item === 'string' && item.trim()))
  }
  return ''
}

function getCreatedDateKey(clothing = {}) {
  return toShanghaiDateKey(
    clothing.created_at
    || clothing.createdAt
    || clothing.createTime
    || clothing.created
  )
}

function enrichClothing(clothing = {}, todayDateKey) {
  const wearCount = normalizeWearCount(clothing.wearCount)
  const lastWornAt = toShanghaiDateKey(clothing.lastWornAt)
  const createdDateKey = getCreatedDateKey(clothing)
  const neverWorn = wearCount === 0
  const referenceDateKey = lastWornAt || (neverWorn ? createdDateKey : '')
  const rawUnusedDays = referenceDateKey
    ? naturalDayDifference(todayDateKey, referenceDateKey)
    : NaN
  const unusedDays = Number.isInteger(rawUnusedDays)
    ? Math.max(0, rawUnusedDays)
    : 0
  const ageUnknown = neverWorn && !createdDateKey
  const idle = lastWornAt
    ? unusedDays >= IDLE_THRESHOLD_DAYS
    : (!ageUnknown && neverWorn && unusedDays >= IDLE_THRESHOLD_DAYS)
  const active = Boolean(lastWornAt && isWithinRecentDays(lastWornAt, todayDateKey, ACTIVE_DAYS))

  return {
    _id: clothing._id,
    name: normalizeText(clothing.name) || '\u672a\u547d\u540d\u8863\u7269',
    image: normalizeClothingImage(clothing),
    wearCount,
    lastWornAt: lastWornAt || null,
    unusedDays,
    neverWorn,
    idle,
    active,
    ageUnknown
  }
}

function buildSuggestions(statistics) {
  const suggestions = []
  const { totalClothes, activityRate, idleClothes, activeClothes } = statistics

  if (totalClothes === 0) {
    return ['\u8863\u6a71\u8fd8\u6ca1\u6709\u8863\u7269\uff0c\u5148\u6dfb\u52a0\u8863\u7269\u540e\u518d\u67e5\u770b\u4f7f\u7528\u60c5\u51b5\u3002']
  }
  if (activeClothes === 0) {
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
    suggestions.push(`\u201c${longestIdle.name}\u201d\u5df2\u8fde\u7eed${longestIdle.unusedDays}\u5929\u672a\u4f7f\u7528\uff0c\u53ef\u4ee5\u5c1d\u8bd5\u52a0\u5165\u4e0b\u4e00\u6b21\u642d\u914d\u3002`)
  }
  if (activityRate >= 70 && suggestions.length < 3) {
    suggestions.push('\u6700\u8fd1\u8863\u6a71\u4f7f\u7528\u8f83\u5747\u8861\uff0c\u7ee7\u7eed\u4fdd\u6301\u73b0\u6709\u8863\u7269\u7684\u91cd\u590d\u5229\u7528\u3002')
  }
  return suggestions.slice(0, 3)
}

function buildLowCarbonStatistics({ clothes = [], user = {}, openid = '', todayDateKey = getShanghaiDateKey() } = {}) {
  const safeClothes = Array.isArray(clothes) ? clothes : []
  const userId = user && user._id
  const currentUserClothes = safeClothes.filter(clothing => (
    clothing
    && clothing._id
    && (!userId || clothing.user_id === userId)
    && (!clothing._openid || clothing._openid === openid)
  ))
  const enrichedClothes = currentUserClothes.map(clothing => enrichClothing(clothing, todayDateKey))
  const idleClothes = enrichedClothes
    .filter(item => item.idle)
    .sort((a, b) => b.unusedDays - a.unusedDays)
  const totalClothes = enrichedClothes.length
  const activeClothes = enrichedClothes.filter(item => item.active).length
  const activityRate = totalClothes === 0
    ? 0
    : Math.round(activeClothes / totalClothes * 100)

  return {
    totalClothes,
    activeClothes,
    activityRate: Number.isFinite(activityRate) ? activityRate : 0,
    idleClothes,
    enrichedClothes
  }
}

async function listAllClothes(gateway, openid, userId) {
  const result = []
  let offset = 0
  while (true) {
    const rows = await gateway.listClothesPage(openid, userId, offset, PAGE_SIZE)
    const page = Array.isArray(rows) ? rows : []
    result.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += page.length
  }
  return result
}

module.exports = {
  PAGE_SIZE,
  IDLE_THRESHOLD_DAYS,
  ACTIVE_DAYS,
  getShanghaiDateKey,
  toShanghaiDateKey,
  naturalDayDifference,
  isWithinRecentDays,
  normalizeWearCount,
  enrichClothing,
  buildSuggestions,
  buildLowCarbonStatistics,
  listAllClothes
}