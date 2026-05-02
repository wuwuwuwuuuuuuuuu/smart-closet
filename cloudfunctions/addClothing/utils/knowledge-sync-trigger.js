function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function triggerKnowledgeSyncInBackground({ cloud, openid, limit = 5 } = {}) {
  const targetOpenid = normalizeText(openid)
  if (!cloud || typeof cloud.callFunction !== 'function' || !targetOpenid) {
    return
  }

  Promise.resolve()
    .then(() => cloud.callFunction({
      name: 'rebuildUserKnowledgeBase',
      data: {
        targetOpenid,
        limit,
        forceResync: false,
        waitForReady: false
      }
    }))
    .catch(error => {
      console.warn('knowledge sync trigger failed', error && error.message ? error.message : error)
    })
}

module.exports = {
  triggerKnowledgeSyncInBackground
}
