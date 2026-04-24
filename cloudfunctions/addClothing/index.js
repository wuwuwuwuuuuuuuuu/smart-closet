const cloud = require('wx-server-sdk')
const {
  normalizeText,
  normalizeTagList,
  buildKnowledgeSyncFields
} = require('./utils/retrieval-profile')
const { triggerKnowledgeSyncInBackground } = require('./utils/knowledge-sync-trigger')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event = {}) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    const userInfo = await db.collection('users')
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc')
      .get()

    if (!Array.isArray(userInfo.data) || !userInfo.data.length) {
      return {
        code: 404,
        message: '??????????????????'
      }
    }

    const userId = userInfo.data[0]._id
    const name = normalizeText(event.name) || '?????'
    const image = normalizeText(event.image)
    const originalImage = normalizeText(event.originalImage)
    const season = normalizeText(event.season) || '??'
    const category = normalizeText(event.category) || '??'
    const material = normalizeText(event.material)
    const brand = normalizeText(event.brand)
    const tags = normalizeTagList(event.tags)
    const knowledgeSyncFields = buildKnowledgeSyncFields({
      name,
      image,
      originalImage,
      season,
      category,
      tags,
      material,
      brand
    })

    const result = await db.collection('clothes').add({
      data: {
        _openid: openid,
        user_id: userId,
        name,
        image,
        season,
        category,
        tags,
        material,
        brand,
        ...knowledgeSyncFields,
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    })

    if (image) {
      triggerKnowledgeSyncInBackground({
        cloud,
        openid,
        limit: 5
      })
    }

    return {
      code: 200,
      message: '??????',
      data: {
        id: result._id,
        knowledgeSyncStatus: knowledgeSyncFields.knowledge_sync_status
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: '??????',
      error: error.message
    }
  }
}
