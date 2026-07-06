const { toShanghaiDateKey } = require('./common/outfit-date-utils')
const {
  uniqueClothingIds,
  allocateSmallestAvailableSlot
} = require('./common/outfit-record-utils')
const {
  buildOutfitDocumentId,
  buildUsageDocumentId
} = require('./common/outfit-document-id')

const LIMIT_MESSAGE = '已保存3套穿搭，是否前往删除一套后再保存？'
const MAX_CLOTHING_IDS = 24
const SAVE_BASE_TRANSACTION_OPERATIONS = 4
const SAVE_OPERATIONS_PER_CLOTHING = 4

function successData(outfit, idempotent = false) {
  return {
    code: 200,
    message: idempotent ? '该保存请求已处理' : '保存今日穿搭成功',
    data: {
      id: outfit._id,
      dateKey: outfit.dateKey,
      slot: outfit.slot,
      outfitImageFileID: outfit.outfitImageFileID,
      clothingIds: Array.isArray(outfit.clothingIds) ? outfit.clothingIds : [],
      requestId: outfit.requestId,
      idempotent
    }
  }
}

function validateInput(event = {}) {
  const outfitImageFileID = typeof event.outfitImageFileID === 'string'
    ? event.outfitImageFileID.trim()
    : ''
  const requestId = typeof event.requestId === 'string' ? event.requestId.trim() : ''
  if (!/^cloud:\/\/\S+$/.test(outfitImageFileID)) {
    return { error: { code: 400, message: 'outfitImageFileID必须是有效的cloud://文件ID' } }
  }
  if (!requestId || requestId.length > 128) {
    return { error: { code: 400, message: 'requestId不能为空且长度不能超过128个字符' } }
  }
  return {
    outfitImageFileID,
    requestId,
    clothingIds: uniqueClothingIds(event.clothingIds)
  }
}

async function saveOutfitRecord({ gateway, openid, event = {}, now = new Date() }) {
  if (!openid) return { code: 401, message: '未获取到可信用户身份' }
  const input = validateInput(event)
  if (input.error) return input.error
  if (input.clothingIds.length > MAX_CLOTHING_IDS) {
    return {
      code: 400,
      message: `每套穿搭最多关联${MAX_CLOTHING_IDS}件衣物`,
      data: { reason: 'TOO_MANY_CLOTHING_IDS', maxClothingIds: MAX_CLOTHING_IDS }
    }
  }

  const user = await gateway.findUser(openid)
  if (!user) return { code: 404, message: '用户不存在' }
  const existing = await gateway.findOutfitByRequest(openid, input.requestId)
  if (existing) return successData(existing, true)

  const dateKey = toShanghaiDateKey(now)
  let savedOutfit
  try {
    await gateway.runTransaction(async tx => {
      const clothes = []
      for (const clothingId of input.clothingIds) {
        const clothing = await tx.findClothing(clothingId)
        if (!clothing) {
          const error = new Error('clothing not found')
          error.businessResponse = { code: 404, message: '衣物不存在', data: { clothingId } }
          throw error
        }
        if (clothing._openid !== openid || clothing.user_id !== user._id) {
          const error = new Error('forbidden clothing')
          error.businessResponse = { code: 403, message: '无权使用其他用户的衣物' }
          throw error
        }
        clothes.push(clothing)
      }

      const todayOutfits = []
      for (const slot of [1, 2, 3]) {
        const outfit = await tx.findOutfit(buildOutfitDocumentId(openid, dateKey, slot))
        if (outfit) todayOutfits.push(outfit)
      }
      const slot = allocateSmallestAvailableSlot(todayOutfits)
      if (!slot) {
        const error = new Error('daily outfit limit reached')
        error.businessResponse = {
          code: 409,
          message: LIMIT_MESSAGE,
          data: { reason: 'DAILY_OUTFIT_LIMIT_REACHED', canManage: true }
        }
        throw error
      }

      savedOutfit = await tx.setOutfit(buildOutfitDocumentId(openid, dateKey, slot), {
        _openid: openid,
        user_id: user._id,
        dateKey,
        slot,
        outfitImageFileID: input.outfitImageFileID,
        clothingIds: input.clothingIds,
        requestId: input.requestId,
        detailsExpired: false,
        createdAt: gateway.serverDate()
      })

      for (const clothing of clothes) {
        const usageId = buildUsageDocumentId(openid, clothing._id, dateKey)
        const usage = await tx.findUsage(usageId)
        if (usage) {
          await tx.updateUsage(usageId, { count: (Number(usage.count) || 0) + 1 })
        } else {
          await tx.setUsage(usageId, {
            _openid: openid,
            user_id: user._id,
            clothingId: clothing._id,
            dateKey,
            count: 1
          })
        }
        await tx.updateClothing(clothing._id, {
          wearCount: (Number(clothing.wearCount) || 0) + 1,
          lastWornAt: now
        })
      }
    })
  } catch (error) {
    if (error.businessResponse) return error.businessResponse
    const duplicate = await gateway.findOutfitByRequest(openid, input.requestId)
    if (duplicate) return successData(duplicate, true)
    throw error
  }
  return successData(savedOutfit, false)
}

module.exports = {
  LIMIT_MESSAGE,
  MAX_CLOTHING_IDS,
  SAVE_BASE_TRANSACTION_OPERATIONS,
  SAVE_OPERATIONS_PER_CLOTHING,
  validateInput,
  saveOutfitRecord
}
