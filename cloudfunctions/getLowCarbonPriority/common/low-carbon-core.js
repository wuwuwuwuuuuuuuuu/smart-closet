const PAGE_SIZE = 100
const IDLE_DAYS = 30
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
    ? unusedDays >= IDLE_DAYS
    : (!ageUnknown && neverWorn && unusedDays >= IDLE_DAYS)
  const active = Boolean(lastWornAt && isWithinRecentDays(lastWornAt, todayDateKey, ACTIVE_DAYS))

  return {
    _id: clothing._id,
    name: normalizeText(clothing.name) || '未命名衣物',
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
    return ['衣橱还没有衣物，先添加衣物后再查看使用情况。']
  }
  if (activeClothes === 0) {
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
    suggestions.push(`“${longestIdle.name}”已连续${longestIdle.unusedDays}天未使用，可以尝试加入下一次搭配。`)
  }
  if (activityRate >= 70 && suggestions.length < 3) {
    suggestions.push('最近衣橱使用较均衡，继续保持现有衣物的重复利用。')
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
  IDLE_DAYS,
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
