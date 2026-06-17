function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function logWarning(scope, message, extra = {}) {
  console.warn(`[ImageVectorSyncTrigger][${scope}] ${message}`, extra)
}

function triggerImageVectorSyncInBackground({ cloud, openid, clothingId, forceResync = true } = {}) {
  const targetOpenid = normalizeText(openid)
  const targetClothingId = normalizeText(clothingId)

  if (!cloud || typeof cloud.callFunction !== 'function') {
    logWarning('trigger', 'cloud.callFunction unavailable')
    return
  }

  if (!targetOpenid || !targetClothingId) {
    logWarning('trigger', 'missing openid or clothingId', {
      hasOpenid: Boolean(targetOpenid),
      hasClothingId: Boolean(targetClothingId)
    })
    return
  }

  Promise.resolve()
    .then(() => cloud.callFunction({
      name: 'rebuildUserKnowledgeBase',
      data: {
        targetOpenid,
        clothingId: targetClothingId,
        limit: 1,
        forceResync,
        mode: 'image_vector'
      }
    }))
    .catch(error => {
      logWarning('trigger', 'image vector sync trigger failed', {
        clothingId: targetClothingId,
        errMsg: error && error.message ? error.message : String(error)
      })
    })
}

module.exports = { triggerImageVectorSyncInBackground }
