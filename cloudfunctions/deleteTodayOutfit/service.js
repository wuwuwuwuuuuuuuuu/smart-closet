const { toShanghaiDateKey } = require('./common/outfit-date-utils')
const { uniqueClothingIds } = require('./common/outfit-record-utils')
const { buildUsageDocumentId } = require('./common/outfit-document-id')

const DELETE_BASE_TRANSACTION_OPERATIONS = 2
const DELETE_OPERATIONS_PER_CLOTHING = 4

function dateKeyToShanghaiDate(dateKey) {
  return new Date(`${dateKey}T00:00:00+08:00`)
}

async function deleteTodayOutfit({ gateway, openid, event = {}, now = new Date() }) {
  if (!openid) return { code: 401, message: '未获取到可信用户身份', data: {} }
  const outfitId = typeof event.outfitId === 'string' ? event.outfitId.trim() : ''
  if (!outfitId) return { code: 400, message: '缺少穿搭记录ID', data: {} }
  const user = await gateway.findUser(openid)
  if (!user) return { code: 404, message: '用户不存在', data: {} }

  const todayKey = toShanghaiDateKey(now)
  const preview = await gateway.findOutfit(outfitId)
  if (!preview) return { code: 404, message: '穿搭记录不存在', data: {} }
  if (preview._openid !== openid || preview.user_id !== user._id) {
    return { code: 403, message: '无权删除其他用户的穿搭记录', data: {} }
  }
  if (preview.dateKey !== todayKey) {
    return {
      code: 409,
      message: '历史穿搭已冻结，不能删除',
      data: { reason: 'HISTORICAL_OUTFIT_FROZEN' }
    }
  }

  const previousUsageDates = {}
  for (const clothingId of uniqueClothingIds(preview.clothingIds)) {
    const usage = await gateway.findLatestUsageBefore(openid, clothingId, todayKey)
    previousUsageDates[clothingId] = usage ? usage.dateKey : ''
  }

  let deleted
  try {
    await gateway.runTransaction(async tx => {
      const outfit = await tx.findOutfit(outfitId)
      if (!outfit) {
        const error = new Error('outfit not found')
        error.businessResponse = { code: 404, message: '穿搭记录不存在', data: {} }
        throw error
      }
      if (outfit._openid !== openid || outfit.user_id !== user._id) {
        const error = new Error('forbidden outfit')
        error.businessResponse = { code: 403, message: '无权删除其他用户的穿搭记录', data: {} }
        throw error
      }
      if (outfit.dateKey !== todayKey) {
        const error = new Error('historical outfit')
        error.businessResponse = {
          code: 409,
          message: '历史穿搭已冻结，不能删除',
          data: { reason: 'HISTORICAL_OUTFIT_FROZEN' }
        }
        throw error
      }

      const clothingIds = uniqueClothingIds(outfit.clothingIds)
      await tx.removeOutfit(outfit._id)
      for (const clothingId of clothingIds) {
        const usageId = buildUsageDocumentId(openid, clothingId, outfit.dateKey)
        const usage = await tx.findUsage(usageId)
        const currentCount = Math.max(0, Number(usage && usage.count) || 0)
        const nextCount = Math.max(0, currentCount - 1)
        if (usage) {
          if (nextCount === 0) await tx.removeUsage(usageId)
          else await tx.updateUsage(usageId, { count: nextCount })
        }

        const clothing = await tx.findClothing(clothingId)
        if (clothing && clothing._openid === openid && clothing.user_id === user._id) {
          const previousDate = previousUsageDates[clothingId]
          await tx.updateClothing(clothingId, {
            wearCount: Math.max(0, (Number(clothing.wearCount) || 0) - 1),
            lastWornAt: nextCount > 0
              ? now
              : (previousDate ? dateKeyToShanghaiDate(previousDate) : null)
          })
        }
      }
      deleted = { id: outfit._id, dateKey: outfit.dateKey, slot: outfit.slot }
    })
  } catch (error) {
    if (error.businessResponse) return error.businessResponse
    throw error
  }

  return { code: 200, message: '删除成功', data: deleted }
}

module.exports = {
  DELETE_BASE_TRANSACTION_OPERATIONS,
  DELETE_OPERATIONS_PER_CLOTHING,
  dateKeyToShanghaiDate,
  deleteTodayOutfit
}
