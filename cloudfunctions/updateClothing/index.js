const cloud = require('wx-server-sdk')
const {
  normalizeText,
  normalizeTagList,
  hasVectorRelevantChanges,
  buildImageEmbeddingResetFields,
  triggerImageVectorSyncInBackground
} = require('./utils/image-vector-sync')
const { buildImageKnowledgeFields } = require('./common/clothing-image-fields')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function parseRequestBody(event = {}) {
  if (event.body && typeof event.body === 'object' && !Array.isArray(event.body)) {
    return event.body
  }

  if (typeof event.body === 'string' && event.body.trim()) {
    try {
      const parsed = JSON.parse(event.body)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
    } catch (error) {
      console.warn('updateClothing: failed to parse event.body JSON', error.message)
    }
  }

  return event
}

function resolveOpenid(event = {}) {
  const authorization = event.headers && typeof event.headers.authorization === 'string'
    ? event.headers.authorization
    : ''
  const token = normalizeText(authorization.replace(/^Bearer\s+/i, ''))
  if (token) {
    return token
  }

  const wxContext = typeof cloud.getWXContext === 'function' ? cloud.getWXContext() : {}
  return normalizeText(wxContext.OPENID)
    || normalizeText(event.openid)
    || normalizeText(event.targetOpenid)
}

exports.main = async (event = {}) => {
  try {
    const openid = resolveOpenid(event)
    if (!openid) {
      return {
        code: 401,
        message: 'unauthorized'
      }
    }

    const body = parseRequestBody(event)
    const id = normalizeText(body.id)
    if (!id) {
      return {
        code: 400,
        message: 'missing clothing id'
      }
    }

    const userInfoBySystem = await db.collection('users').where({ _openid: openid }).get()
    const userInfo = Array.isArray(userInfoBySystem.data) && userInfoBySystem.data.length
      ? userInfoBySystem
      : await db.collection('users').where({ openid }).get()

    if (!Array.isArray(userInfo.data) || userInfo.data.length === 0) {
      return {
        code: 404,
        message: 'user not found'
      }
    }

    const userId = userInfo.data[0]._id
    const clothingInfo = await db.collection('clothes').where({ _id: id, user_id: userId }).get()
    if (!Array.isArray(clothingInfo.data) || clothingInfo.data.length === 0) {
      return {
        code: 404,
        message: 'clothing not found'
      }
    }

    const current = clothingInfo.data[0]
    const imageFields = buildImageKnowledgeFields({
      image: normalizeText(body.image) || current.image,
      originalImage: normalizeText(body.originalImage) || current.originalImage,
      previousImage: current.image
    })
    const nextPayload = {
      name: normalizeText(body.name) || current.name,
      image: imageFields.primaryImage || current.image,
      season: normalizeText(body.season) || current.season,
      category: normalizeText(body.category) || current.category,
      tags: Array.isArray(body.tags) ? normalizeTagList(body.tags) : current.tags,
      material: normalizeText(body.material) || current.material,
      brand: normalizeText(body.brand) || current.brand,
      originalImage: imageFields.originalImage || current.originalImage || current.image
    }

    const vectorRelevantChanged = hasVectorRelevantChanges(current, nextPayload)
    const resetFields = vectorRelevantChanged ? buildImageEmbeddingResetFields(nextPayload) : null
    const updateData = {
      ...nextPayload,
      updated_at: db.serverDate()
    }

    if (resetFields) {
      Object.assign(updateData, resetFields)
    }

    await db.collection('clothes').where({ _id: id }).update({
      data: updateData
    })

    const shouldTriggerImageVectorSync = Boolean(vectorRelevantChanged && normalizeText(nextPayload.image))

    if (shouldTriggerImageVectorSync) {
      triggerImageVectorSyncInBackground({
        cloud,
        openid,
        clothingId: id,
        forceResync: true
      })
    }

    return {
      code: 200,
      message: 'ok',
      data: {
        imageEmbeddingStatus: vectorRelevantChanged
          ? resetFields.image_embedding_status
          : normalizeText(current.image_embedding_status) || 'pending',
        imageVectorSyncTriggered: shouldTriggerImageVectorSync
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: 'update failed',
      error: error.message
    }
  }
}
