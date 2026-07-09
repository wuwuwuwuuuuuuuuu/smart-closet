const {
  toShanghaiDateKey,
  shiftDateKey
} = require('./common/outfit-date-utils')

async function expireOutfitDetails({ gateway, now = new Date() }) {
  const todayDateKey = toShanghaiDateKey(now)
  const earliestRecentDate = shiftDateKey(todayDateKey, -9)
  const records = await gateway.listOlderThan(earliestRecentDate)
  let updated = 0
  for (const record of records) {
    if (
      record
      && record._id
      && (record.detailsExpired !== true
        || (Array.isArray(record.clothingIds) && record.clothingIds.length > 0))
    ) {
      await gateway.expireRecord(record._id)
      updated += 1
    }
  }
  return {
    code: 200,
    message: '穿搭详情清理完成',
    data: {
      todayDateKey,
      earliestRecentDate,
      scanned: records.length,
      updated
    }
  }
}

module.exports = { expireOutfitDetails }
