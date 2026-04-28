const cloud = require('wx-server-sdk')
const {
  normalizeText,
  normalizeTagList,
  buildKnowledgeSyncFields
} = require('./utils/retrieval-profile')
const { triggerKnowledgeSyncInBackground } = require('./utils/knowledge-sync-trigger')
const { buildImageKnowledgeFields } = require('./common/clothing-image-fields')

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
        message: '用户不存在，请先返回我的页面授权登录'
      }
    }

    const userId = userInfo.data[0]._id
    const rawImage = normalizeText(event.image)
    const rawOriginalImage = normalizeText(event.originalImage)
    const imageFields = buildImageKnowledgeFields({
      image: rawImage,
      originalImage: rawOriginalImage
    })

    const name = normalizeText(event.name) || '未命名衣物'
    const image = imageFields.primaryImage
    const originalImage = imageFields.originalImage
    const season = normalizeText(event.season) || '未知'
    const category = normalizeText(event.category) || '其他'
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
        originalImage,
        season,
        category,
        tags,
        material,
        brand,
        ...knowledgeSyncFields,
        image_knowledge_status: imageFields.status,
        image_embedding_status: imageFields.status,
        image_embedding_error: '',
        image_embedding_updated_at: null,
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
      message: '添加衣物成功',
      data: {
        id: result._id,
        knowledgeSyncStatus: knowledgeSyncFields.knowledge_sync_status,
        imageEmbeddingStatus: imageFields.status
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: '添加衣物失败',
      error: error.message
    }
  }
}
