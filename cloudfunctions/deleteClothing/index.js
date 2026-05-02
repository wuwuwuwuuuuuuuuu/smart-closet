const cloud = require('wx-server-sdk')
const { normalizeText, collectCloudFileIds } = require('./utils/delete-helpers')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function logWarning(scope, message, extra = {}) {
  console.warn(`[DeleteClothing][${scope}] ${message}`, extra)
}

function logError(scope, error, extra = {}) {
  console.error(`[DeleteClothing][${scope}]`, {
    message: error && error.message ? error.message : String(error),
    ...extra
  })
}

async function getCurrentUser(openid) {
  const res = await db.collection('users')
    .where({ _openid: openid })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
  return res.data && res.data[0]
}

async function removeImageVectors({ clothingId, userId }) {
  try {
    const res = await db.collection('clothes_image_vectors').where({
      clothing_id: clothingId,
      user_id: userId
    }).remove()
    return res && res.stats ? Number(res.stats.removed) || 0 : 0
  } catch (error) {
    const message = error && error.message ? error.message : String(error)
    if (/collection not exists|Db or Table not exist|DATABASE_COLLECTION_NOT_EXIST|ResourceNotFound/i.test(message)) {
      return 0
    }
    logWarning('removeImageVectors', 'failed to remove image vectors', { clothingId, errMsg: message })
    return 0
  }
}

exports.main = async (event = {}) => {
  const id = normalizeText(event.id)
  const wxContext = cloud.getWXContext()
  const openid = normalizeText(wxContext.OPENID) || normalizeText(event.openid) || normalizeText(event.targetOpenid)

  if (!id) {
    return { code: 400, message: 'missing clothing id' }
  }

  if (!openid) {
    return { code: 401, message: 'unauthorized' }
  }

  try {
    const user = await getCurrentUser(openid)
    if (!user) {
      return { code: 404, message: 'user not found' }
    }

    const recordRes = await db.collection('clothes')
      .where({ _id: id, user_id: user._id })
      .limit(1)
      .get()

    const clothing = recordRes.data && recordRes.data[0]
    if (!clothing) {
      await removeImageVectors({ clothingId: id, userId: user._id })
      return { code: 404, message: 'clothing not found, stale vectors cleaned' }
    }

    const removedVectorCount = await removeImageVectors({ clothingId: id, userId: user._id })

    await db.collection('clothes').doc(id).remove()

    const fileList = collectCloudFileIds(clothing)
    if (fileList.length) {
      try {
        await cloud.deleteFile({ fileList })
      } catch (error) {
        logWarning('deleteFile', 'failed to delete cloud files', {
          clothingId: id,
          fileCount: fileList.length,
          errMsg: error && error.message ? error.message : String(error)
        })
      }
    }

    return {
      code: 200,
      message: '删除衣物成功',
      data: {
        id,
        removedVectorCount,
        removedFileCount: fileList.length
      }
    }
  } catch (error) {
    logError('main', error, { id })
    return {
      code: 500,
      message: '删除失败，服务器出错',
      error: error && error.message ? error.message : String(error)
    }
  }
}
