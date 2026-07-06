const {
  toShanghaiDateKey,
  parseDateKey,
  naturalDayDifference
} = require('./common/outfit-date-utils')

function protectRecordDetails(record, todayDateKey) {
  const difference = naturalDayDifference(todayDateKey, record.dateKey)
  const hideDetails = record.detailsExpired === true
    || !Number.isInteger(difference)
    || difference >= 10
  return {
    ...record,
    clothingIds: hideDetails
      ? []
      : (Array.isArray(record.clothingIds) ? record.clothingIds : []),
    detailsExpired: hideDetails || record.detailsExpired === true
  }
}

async function getOutfitHistory({ gateway, openid, event = {}, now = new Date() }) {
  if (!openid) return { code: 401, message: '未获取到可信用户身份', data: {} }
  const user = await gateway.findUser(openid)
  if (!user) return { code: 404, message: '用户不存在', data: {} }

  const todayDateKey = toShanghaiDateKey(now)
  const selectedDate = typeof event.dateKey === 'string' && event.dateKey.trim()
    ? event.dateKey.trim()
    : todayDateKey
  if (!parseDateKey(selectedDate)) {
    return { code: 400, message: 'dateKey格式无效', data: {} }
  }
  if (selectedDate > todayDateKey) {
    return { code: 400, message: '不能查询未来日期', data: { reason: 'FUTURE_DATE_NOT_ALLOWED' } }
  }

  const records = await gateway.listByDate(openid, selectedDate)
  records.sort((a, b) => a.slot - b.slot)
  const allRecords = await gateway.listAllDateKeys(openid)
  const availableDates = [...new Set(allRecords
    .map(item => item && item.dateKey)
    .filter(Boolean))]
    .sort((a, b) => b.localeCompare(a))

  return {
    code: 200,
    message: '获取历史穿搭成功',
    data: {
      selectedDate,
      records: records.map(item => protectRecordDetails(item, todayDateKey)),
      availableDates
    }
  }
}

module.exports = { protectRecordDetails, getOutfitHistory }
