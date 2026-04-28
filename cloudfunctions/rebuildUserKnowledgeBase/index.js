const cloud = require('wx-server-sdk')
const { createImageEmbedding } = require('./common/dashscope-multimodal-provider')
const { isValidVector } = require('./common/image-vector-utils')
const { normalizeLimit, buildRebuildStatsSummary } = require('./rebuild.helpers')

let localConfig = {}
try {
  localConfig = require('./config.local')
} catch (error) {
  localConfig = {}
}


cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()


function logError(scope, error, extra = {}) {
  console.error(`[ImageKnowledge][${scope}]`, {
    message: error && error.message ? error.message : String(error),
    ...extra
  })
}

function logWarning(scope, message, extra = {}) {
  console.warn(`[ImageKnowledge][${scope}] ${message}`, extra)
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getDashScopeApiKey() {
  return normalizeText(process.env.DASHSCOPE_API_KEY || localConfig.DASHSCOPE_API_KEY)
}

async function getCurrentUser(openid) {
  const res = await db.collection('users')
    .where({ _openid: openid })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
  return res.data && res.data[0]
}

function shouldSyncClothing(clothing, forceResync) {
  const imageFileId = normalizeText(clothing.image) || normalizeText(clothing.originalImage)
  if (!imageFileId) return false
  if (forceResync) return true
  const status = normalizeText(clothing.image_embedding_status)
  return !status || status === 'pending' || status === 'failed'
}

async function loadSyncableClothes({ userId, limit, forceResync }) {
  const res = await db.collection('clothes')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .limit(Math.min(100, Math.max(limit * 2, limit)))
    .get()

  return (res.data || [])
    .filter(item => shouldSyncClothing(item, forceResync))
    .slice(0, limit)
}

async function getTempUrl(fileId) {
  const normalizedFileId = normalizeText(fileId)
  if (!normalizedFileId) {
    throw new Error('image file id is required')
  }
  if (/^https?:\/\//i.test(normalizedFileId)) {
    return normalizedFileId
  }
  if (!normalizedFileId.startsWith('cloud://')) {
    throw new Error('unsupported image file id')
  }

  const res = await cloud.getTempFileURL({ fileList: [normalizedFileId] })
  const item = res.fileList && res.fileList[0]
  const tempUrl = normalizeText(item && item.tempFileURL)
  if (!tempUrl) {
    throw new Error(item && item.errMsg ? item.errMsg : 'getTempFileURL returned empty url')
  }
  return tempUrl
}

async function markClothingSkipped(clothingId, reason) {
  await db.collection('clothes').doc(clothingId).update({
    data: {
      image_knowledge_status: 'skipped_no_image',
      image_embedding_status: 'skipped_no_image',
      image_embedding_error: reason || '',
      image_embedding_updated_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  })
}

async function markClothingReady(clothingId, vectorDim) {
  await db.collection('clothes').doc(clothingId).update({
    data: {
      image_knowledge_status: 'ready',
      image_embedding_status: 'ready',
      image_embedding_error: '',
      image_embedding_dim: vectorDim,
      image_embedding_updated_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  })
}

async function markClothingFailed(clothingId, error) {
  await db.collection('clothes').doc(clothingId).update({
    data: {
      image_knowledge_status: 'failed',
      image_embedding_status: 'failed',
      image_embedding_error: error && error.message ? error.message : String(error),
      image_embedding_updated_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  })
}

async function removeExistingVector({ clothingId, userId }) {
  try {
    await db.collection('clothes_image_vectors').where({
      clothing_id: clothingId,
      user_id: userId
    }).remove()
  } catch (error) {
    logWarning('rebuild.removeExistingVector', 'remove old vector failed or empty', {
      clothingId,
      errMsg: error && error.message
    })
  }
}

async function ensureCollectionExists(collectionName) {
  try {
    await db.collection(collectionName).limit(1).get()
  } catch (error) {
    const message = error && error.message ? error.message : String(error)
    if (!/collection not exists|Db or Table not exist|DATABASE_COLLECTION_NOT_EXIST|ResourceNotFound/i.test(message)) {
      throw error
    }

    try {
      await db.createCollection(collectionName)
    } catch (createError) {
      const createMessage = createError && createError.message ? createError.message : String(createError)
      if (!/already exists|DATABASE_COLLECTION_ALREADY_EXISTS/i.test(createMessage)) {
        throw createError
      }
    }
  }
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const limit = normalizeLimit(event.limit, 30)
  const forceResync = event.forceResync === true

  try {
    const user = await getCurrentUser(openid)
    if (!user) {
      return { code: 404, message: '用户不存在' }
    }

    await ensureCollectionExists('clothes_image_vectors')

    const clothes = await loadSyncableClothes({
      userId: user._id,
      limit,
      forceResync
    })

    const stats = {
      total: clothes.length,
      readyCount: 0,
      failedCount: 0,
      skippedCount: 0,
      sampleFailures: [],
      requestMode: forceResync ? 'forceResync' : 'normal',
      inventorySummary: {
        totalWardrobeCount: clothes.length,
        syncableCount: clothes.length,
        readyInKnowledgeCount: 0,
        missingKnowledgeCount: 0,
        missingImageCount: 0
      }
    }

    for (const clothing of clothes) {
      try {
        const imageFileId = normalizeText(clothing.image) || normalizeText(clothing.originalImage)
        if (!imageFileId) {
          stats.skippedCount += 1
          stats.inventorySummary.missingImageCount += 1
          await markClothingSkipped(clothing._id, 'missing_image')
          continue
        }

        const imageUrl = await getTempUrl(imageFileId)
        const vector = await createImageEmbedding({
          imageUrl,
          apiKey: getDashScopeApiKey(),
          model: normalizeText(localConfig.DASHSCOPE_EMBEDDING_MODEL) || undefined,
          timeoutMs: Number(localConfig.BAILIAN_RESPONSE_TIMEOUT_MS) || 60000
        })

        if (!isValidVector(vector)) {
          throw new Error('invalid image embedding vector')
        }

        await removeExistingVector({ clothingId: clothing._id, userId: user._id })
        await db.collection('clothes_image_vectors').add({
          data: {
            _openid: openid,
            user_id: user._id,
            clothing_id: clothing._id,
            image_file_id: imageFileId,
            image_temp_url_sample: imageUrl,
            vector,
            vector_dim: vector.length,
            category: normalizeText(clothing.category),
            season: normalizeText(clothing.season),
            tags: Array.isArray(clothing.tags) ? clothing.tags : [],
            name: normalizeText(clothing.name),
            updated_at: db.serverDate()
          }
        })

        await markClothingReady(clothing._id, vector.length)
        stats.readyCount += 1
        stats.inventorySummary.readyInKnowledgeCount += 1
      } catch (error) {
        stats.failedCount += 1
        stats.inventorySummary.missingKnowledgeCount += 1
        if (stats.sampleFailures.length < 5) {
          stats.sampleFailures.push({
            clothingId: clothing._id,
            name: normalizeText(clothing.name),
            error: error && error.message ? error.message : String(error)
          })
        }
        logWarning('rebuild.imageEmbedding.itemFailed', 'image embedding failed', {
          clothingId: clothing._id,
          errMsg: error && error.message
        })
        await markClothingFailed(clothing._id, error)
      }
    }

    const summary = buildRebuildStatsSummary(stats)
    return {
      code: 200,
      message: '图片知识库重建完成',
      data: {
        ...stats,
        summary
      }
    }
  } catch (error) {
    logError('rebuild.imageEmbedding.main', error, { limit, forceResync })
    return {
      code: 500,
      message: '图片知识库重建失败',
      error: error && error.message ? error.message : String(error)

    }
  }
}

