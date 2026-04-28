const { logError, logWarning } = require('./logger')
const { getBailianConfig } = require('./bailian-config')

const ALLOWED_KNOWLEDGE_STATUS = ['unbound', 'creating', 'ready', 'failed']

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeKnowledgeStatus(status) {
  const normalized = normalizeText(status)
  return ALLOWED_KNOWLEDGE_STATUS.includes(normalized) ? normalized : 'unbound'
}

function buildKnowledgeBaseName(user = {}) {
  const userId = normalizeText(user._id)
  const nickname = normalizeText(user.nickName || user.nickname)
  const safeBase = (nickname || userId || 'user')
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '')
    .slice(0, 17)

  return `sc_${safeBase || 'user'}`
}

function extractKnowledgeBinding(user = {}) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    return {
      knowledgeId: '',
      knowledgeStatus: 'unbound',
      knowledgeProvider: '',
      hasReadyKnowledge: false
    }
  }

  const knowledgeId = normalizeText(user.bailian_knowledge_id || user.knowledge_id)
  const knowledgeStatus = normalizeKnowledgeStatus(user.bailian_knowledge_status || user.knowledge_status)
  const knowledgeProvider = normalizeText(user.knowledge_provider || 'bailian')

  return {
    knowledgeId,
    knowledgeStatus,
    knowledgeProvider,
    hasReadyKnowledge: Boolean(knowledgeId && knowledgeStatus === 'ready')
  }
}

async function findLatestUserByOpenid({ db, openid }) {
  const safeOpenid = normalizeText(openid)
  if (!db || !safeOpenid) {
    logWarning('knowledgeBinding.findLatestUserByOpenid', 'missing db or openid', {
      hasDb: Boolean(db),
      hasOpenid: Boolean(safeOpenid)
    })
    return null
  }

  const userRes = await db.collection('users')
    .where({ _openid: safeOpenid })
    .orderBy('createdAt', 'desc')
    .get()

  return Array.isArray(userRes.data) && userRes.data.length ? userRes.data[0] : null
}

async function updateUserKnowledgeBinding({ db, userId, data }) {
  if (!db || !normalizeText(userId) || !data || typeof data !== 'object' || Array.isArray(data)) {
    logWarning('knowledgeBinding.updateUserKnowledgeBinding', 'invalid update payload', {
      hasDb: Boolean(db),
      hasUserId: Boolean(normalizeText(userId)),
      dataType: typeof data
    })
    return false
  }

  await db.collection('users').doc(userId).update({ data })
  return true
}

async function restoreKnowledgeBindingByName({
  db,
  user,
  provider,
  currentBinding
}) {
  if (!db || !user || !provider || typeof provider.findKnowledgeBaseByName !== 'function') {
    return null
  }

  const knowledgeName = buildKnowledgeBaseName(user)
  if (!knowledgeName) {
    return null
  }

  const matchedKnowledge = await provider.findKnowledgeBaseByName(knowledgeName)
  const matchedKnowledgeId = normalizeText(matchedKnowledge && matchedKnowledge.id)
  if (!matchedKnowledgeId) {
    return null
  }

  const providerConfig = typeof provider.getProviderConfig === 'function'
    ? provider.getProviderConfig()
    : getBailianConfig()

  await updateUserKnowledgeBinding({
    db,
    userId: user._id,
    data: {
      bailian_knowledge_id: matchedKnowledgeId,
      bailian_workspace_id: normalizeText(providerConfig.workspaceId),
      bailian_knowledge_status: 'ready',
      knowledge_id: matchedKnowledgeId,
      knowledge_status: 'ready',
      knowledge_bound_at: db.serverDate(),
      knowledge_provider: normalizeText(provider.name) || 'bailian'
    }
  })

  if (currentBinding) {
    currentBinding.knowledgeId = matchedKnowledgeId
    currentBinding.knowledgeStatus = 'ready'
    currentBinding.knowledgeProvider = normalizeText(provider.name) || 'bailian'
    currentBinding.hasReadyKnowledge = true
  }

  return matchedKnowledgeId
}

async function ensureUserKnowledgeBinding({
  db,
  openid,
  provider,
  allowCreate = true
}) {
  const user = await findLatestUserByOpenid({ db, openid })
  if (!user) {
    logWarning('knowledgeBinding.ensureUserKnowledgeBinding', 'user not found', {
      openid: normalizeText(openid)
    })
    throw new Error('user not found')
  }

  const currentBinding = extractKnowledgeBinding(user)
  if (currentBinding.knowledgeId && provider && typeof provider.knowledgeBaseExists === 'function') {
    if (provider && typeof provider.knowledgeBaseExists === 'function') {
      try {
        const exists = await provider.knowledgeBaseExists(currentBinding.knowledgeId)
        if (exists) {
          currentBinding.knowledgeStatus = 'ready'
          currentBinding.hasReadyKnowledge = true
        } else {
          await updateUserKnowledgeBinding({
            db,
            userId: user._id,
            data: {
              bailian_knowledge_id: '',
              bailian_knowledge_status: 'unbound',
              knowledge_id: '',
              knowledge_status: 'unbound',
              knowledge_provider: normalizeText(provider.name) || 'bailian'
            }
          })
          currentBinding.knowledgeId = ''
          currentBinding.knowledgeStatus = 'unbound'
          currentBinding.hasReadyKnowledge = false
        }
      } catch (error) {
        logError('knowledgeBinding.ensureUserKnowledgeBinding', error, {
          userId: user._id,
          phase: 'knowledgeBaseExists'
        })
        throw error
      }
    }
  }

  if (currentBinding.hasReadyKnowledge) {
    return {
      user,
      knowledgeId: currentBinding.knowledgeId,
      knowledgeStatus: currentBinding.knowledgeStatus,
      knowledgeProvider: currentBinding.knowledgeProvider,
      created: false
    }
  }

  try {
    const restoredKnowledgeId = await restoreKnowledgeBindingByName({
      db,
      user,
      provider,
      currentBinding
    })

    if (restoredKnowledgeId) {
      return {
        user,
        knowledgeId: restoredKnowledgeId,
        knowledgeStatus: 'ready',
        knowledgeProvider: normalizeText(provider && provider.name) || 'bailian',
        created: false
      }
    }
  } catch (error) {
    logError('knowledgeBinding.ensureUserKnowledgeBinding', error, {
      userId: user._id,
      phase: 'restoreKnowledgeBindingByName'
    })
    throw error
  }

  if (!allowCreate) {
    return {
      user,
      knowledgeId: currentBinding.knowledgeId,
      knowledgeStatus: currentBinding.knowledgeStatus,
      knowledgeProvider: currentBinding.knowledgeProvider,
      created: false
    }
  }

  if (!provider || typeof provider.createKnowledgeBase !== 'function') {
    logWarning('knowledgeBinding.ensureUserKnowledgeBinding', 'provider unavailable for createKnowledgeBase')
    return {
      user,
      knowledgeId: currentBinding.knowledgeId,
      knowledgeStatus: currentBinding.knowledgeStatus,
      knowledgeProvider: currentBinding.knowledgeProvider,
      created: false
    }
  }

  await updateUserKnowledgeBinding({
    db,
    userId: user._id,
    data: {
      bailian_knowledge_status: 'creating',
      knowledge_status: 'creating',
      knowledge_provider: normalizeText(provider.name) || 'bailian'
    }
  })

  try {
    const created = await provider.createKnowledgeBase({
      name: buildKnowledgeBaseName(user),
      description: `smart-closet wardrobe knowledge for user ${user._id || ''}`.trim(),
      user
    })

    const knowledgeId = normalizeText(created && (created.id || created.knowledge_id))
    if (!knowledgeId) {
      throw new Error('knowledge create returned empty id')
    }

    const providerConfig = typeof provider.getProviderConfig === 'function'
      ? provider.getProviderConfig()
      : getBailianConfig()

    await updateUserKnowledgeBinding({
      db,
      userId: user._id,
      data: {
        bailian_knowledge_id: knowledgeId,
        bailian_workspace_id: normalizeText(providerConfig.workspaceId),
        bailian_knowledge_status: 'ready',
        knowledge_id: knowledgeId,
        knowledge_status: 'ready',
        knowledge_bound_at: db.serverDate(),
        knowledge_provider: normalizeText(provider.name) || 'bailian'
      }
    })

    return {
      user,
      knowledgeId,
      knowledgeStatus: 'ready',
      knowledgeProvider: normalizeText(provider.name) || 'bailian',
      created: true
    }
  } catch (error) {
    logError('knowledgeBinding.ensureUserKnowledgeBinding', error, {
      userId: user._id
    })

    await updateUserKnowledgeBinding({
      db,
      userId: user._id,
      data: {
        bailian_knowledge_status: 'failed',
        knowledge_status: 'failed',
        knowledge_provider: normalizeText(provider && provider.name) || 'bailian'
      }
    })

    throw error
  }
}

module.exports = {
  ALLOWED_KNOWLEDGE_STATUS,
  normalizeKnowledgeStatus,
  buildKnowledgeBaseName,
  extractKnowledgeBinding,
  findLatestUserByOpenid,
  updateUserKnowledgeBinding,
  ensureUserKnowledgeBinding
}
