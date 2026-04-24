function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) {
    return []
  }

  return [...new Set(
    tags
      .filter(item => item !== undefined && item !== null)
      .map(item => String(item).trim())
      .filter(Boolean)
  )]
}

function splitSeasonText(seasonText) {
  const normalized = normalizeText(seasonText)
  if (!normalized) {
    return []
  }

  return [...new Set(
    normalized
      .split(/[\/,，、\s]+/)
      .map(item => item.trim())
      .filter(Boolean)
  )]
}

function hasSyncableImage(clothing = {}) {
  return Boolean(normalizeText(clothing.image))
}

function resolveKnowledgeSyncStatus(clothing = {}) {
  const explicitStatus = normalizeText(clothing.knowledge_sync_status)
  if (explicitStatus) {
    return explicitStatus
  }

  return hasSyncableImage(clothing) ? 'pending' : 'skipped_no_image'
}

function buildInferenceSourceText(payload = {}) {
  return [
    normalizeText(payload.name),
    normalizeText(payload.category),
    normalizeText(payload.season),
    normalizeText(payload.material),
    normalizeText(payload.brand),
    ...normalizeTagList(payload.tags)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function collectKeywordMatches(sourceText, rules = []) {
  if (!sourceText) {
    return []
  }

  return rules
    .filter(rule => Array.isArray(rule.keywords) && rule.keywords.some(keyword => sourceText.includes(keyword)))
    .map(rule => rule.label)
}

function buildInferredProfile(payload = {}) {
  const sourceText = buildInferenceSourceText(payload)

  const colorRules = [
    { label: 'white', keywords: ['white', 'ivory', 'cream', '白', '米白', '乳白'] },
    { label: 'black', keywords: ['black', '黑'] },
    { label: 'gray', keywords: ['gray', 'grey', '灰'] },
    { label: 'blue', keywords: ['blue', 'navy', '蓝', '藏蓝'] },
    { label: 'red', keywords: ['red', 'wine', 'burgundy', '红', '酒红'] },
    { label: 'pink', keywords: ['pink', '粉'] },
    { label: 'green', keywords: ['green', 'olive', '绿', '橄榄'] },
    { label: 'brown', keywords: ['brown', 'khaki', 'camel', '棕', '卡其', '驼'] },
    { label: 'beige', keywords: ['beige', 'apricot', '米', '杏'] }
  ]

  const styleRules = [
    { label: 'minimal', keywords: ['minimal', 'simple', '简约', '极简', '基础'] },
    { label: 'commute', keywords: ['commute', 'office', 'work', '通勤', '职场', '上班', '商务'] },
    { label: 'casual', keywords: ['casual', 'daily', '休闲', '日常'] },
    { label: 'sporty', keywords: ['sport', 'training', '运动', '跑步', '健身'] },
    { label: 'formal', keywords: ['formal', 'tailored', '正装', '正式', '西装'] },
    { label: 'elegant', keywords: ['elegant', '优雅', '气质'] },
    { label: 'retro', keywords: ['retro', 'vintage', '复古'] }
  ]

  const occasionRules = [
    { label: 'commute', keywords: ['commute', 'office', 'work', '通勤', '职场', '商务'] },
    { label: 'daily', keywords: ['daily', 'casual', '日常', '休闲'] },
    { label: 'sport', keywords: ['sport', 'training', '运动', '跑步', '健身'] },
    { label: 'date', keywords: ['date', 'dating', '约会'] },
    { label: 'travel', keywords: ['travel', 'trip', '旅行', '出游'] },
    { label: 'outdoor', keywords: ['outdoor', 'camp', 'hiking', '户外', '露营', '徒步'] }
  ]

  const fitRules = [
    { label: 'slim', keywords: ['slim', 'fitted', '修身'] },
    { label: 'loose', keywords: ['loose', 'oversize', 'oversized', '宽松', '廓形'] },
    { label: 'straight', keywords: ['straight', '直筒'] },
    { label: 'cropped', keywords: ['cropped', 'short length', '短款', '短版'] },
    { label: 'longline', keywords: ['longline', '长款', '长版'] },
    { label: 'high-waist', keywords: ['high waist', 'high-waist', '高腰'] },
    { label: 'a-line', keywords: ['a-line', 'a line', 'a字'] }
  ]

  const colors = collectKeywordMatches(sourceText, colorRules)
  const styleTags = collectKeywordMatches(sourceText, styleRules)
  const occasionTags = collectKeywordMatches(sourceText, occasionRules)
  const fitTags = collectKeywordMatches(sourceText, fitRules)

  if (sourceText.includes('hoodie') || sourceText.includes('卫衣')) {
    styleTags.push('casual')
  }
  if (sourceText.includes('blazer') || sourceText.includes('西装')) {
    styleTags.push('formal')
    occasionTags.push('commute')
  }
  if (sourceText.includes('knit') || sourceText.includes('针织')) {
    styleTags.push('minimal')
  }

  return {
    colors: [...new Set(colors)],
    styleTags: [...new Set(styleTags)],
    occasionTags: [...new Set(occasionTags)],
    fitTags: [...new Set(fitTags)]
  }
}

function buildMergedTags(payload = {}) {
  const inferredProfile = buildInferredProfile(payload)

  return [...new Set([
    normalizeText(payload.category),
    ...splitSeasonText(payload.season),
    ...normalizeTagList(payload.tags),
    ...inferredProfile.colors,
    ...inferredProfile.styleTags,
    ...inferredProfile.occasionTags,
    ...inferredProfile.fitTags,
    normalizeText(payload.material),
    normalizeText(payload.brand),
    normalizeText(payload.name)
  ].filter(Boolean))]
}

function buildRetrievalTags(payload = {}) {
  return buildMergedTags(payload)
}

function buildRetrievalText(payload = {}) {
  const userTags = normalizeTagList(payload.tags)
  const inferredProfile = buildInferredProfile(payload)
  const mergedTags = buildMergedTags(payload)

  return [
    `name: ${normalizeText(payload.name) || '未命名衣物'}`,
    `category: ${normalizeText(payload.category) || '其他'}`,
    `season: ${splitSeasonText(payload.season).join(', ') || '未知'}`,
    `material: ${normalizeText(payload.material) || '未知'}`,
    `brand: ${normalizeText(payload.brand) || '未知'}`,
    `user_tags: ${userTags.join(', ') || 'none'}`,
    `colors: ${inferredProfile.colors.join(', ') || 'unknown'}`,
    `style_tags: ${inferredProfile.styleTags.join(', ') || 'unknown'}`,
    `occasion_tags: ${inferredProfile.occasionTags.join(', ') || 'unknown'}`,
    `fit_tags: ${inferredProfile.fitTags.join(', ') || 'unknown'}`,
    `merged_tags: ${mergedTags.join(', ') || 'none'}`
  ].join('\n')
}

function buildLegacyKnowledgePatch(clothing = {}) {
  const userTags = normalizeTagList(clothing.tags)
  const inferredProfile = buildInferredProfile(clothing)
  const mergedTags = buildMergedTags(clothing)

  return {
    originalImage: normalizeText(clothing.originalImage),
    user_tags: userTags,
    inferred_profile: inferredProfile,
    merged_tags: mergedTags,
    retrieval_tags: mergedTags,
    retrieval_text: buildRetrievalText(clothing),
    bailian_file_id: normalizeText(clothing.bailian_file_id),
    bailian_doc_id: normalizeText(clothing.bailian_doc_id || clothing.knowledge_doc_id),
    knowledge_doc_id: normalizeText(clothing.knowledge_doc_id),
    knowledge_sync_provider: 'bailian',
    knowledge_sync_status: resolveKnowledgeSyncStatus(clothing),
    knowledge_sync_error: normalizeText(clothing.knowledge_sync_error),
    knowledge_last_sync_at: clothing.knowledge_last_sync_at || null,
    knowledge_sync_job_id: normalizeText(clothing.knowledge_sync_job_id),
    knowledge_sync_file_name: normalizeText(clothing.knowledge_sync_file_name)
  }
}

function getSyncDecision(clothing = {}, options = {}) {
  const forceResync = Boolean(options.forceResync)
  const image = normalizeText(clothing.image)
  const knowledgeDocId = normalizeText(clothing.bailian_doc_id || clothing.knowledge_doc_id)
  const syncStatus = resolveKnowledgeSyncStatus(clothing)
  const hasJob = Boolean(normalizeText(clothing.knowledge_sync_job_id))

  if (!image) {
    return {
      canSync: false,
      reason: 'missing_image',
      syncStatus,
      hasImage: false,
      hasKnowledgeDoc: Boolean(knowledgeDocId)
    }
  }

  if (forceResync) {
    return {
      canSync: true,
      reason: 'force_resync',
      syncStatus,
      hasImage: true,
      hasKnowledgeDoc: Boolean(knowledgeDocId)
    }
  }

  if (syncStatus === 'syncing' && hasJob) {
    return {
      canSync: false,
      reason: 'syncing',
      syncStatus,
      hasImage: true,
      hasKnowledgeDoc: Boolean(knowledgeDocId)
    }
  }

  if (!syncStatus || syncStatus === 'pending' || syncStatus === 'failed') {
    return {
      canSync: true,
      reason: syncStatus || 'pending',
      syncStatus: syncStatus || 'pending',
      hasImage: true,
      hasKnowledgeDoc: Boolean(knowledgeDocId)
    }
  }

  if (knowledgeDocId) {
    return {
      canSync: false,
      reason: 'already_synced',
      syncStatus,
      hasImage: true,
      hasKnowledgeDoc: true
    }
  }

  return {
    canSync: true,
    reason: 'pending',
    syncStatus,
    hasImage: true,
    hasKnowledgeDoc: Boolean(knowledgeDocId)
  }
}

function shouldSyncClothing(clothing = {}, options = {}) {
  return getSyncDecision(clothing, options).canSync
}

function summarizeRebuildResults(results = []) {
  const safeResults = Array.isArray(results) ? results : []

  return {
    total: safeResults.length,
    readyCount: safeResults.filter(item => item.status === 'ready').length,
    syncedCount: safeResults.filter(item => item.status === 'synced').length,
    syncingCount: safeResults.filter(item => item.status === 'syncing').length,
    queuedCount: safeResults.filter(item => item.status === 'queued').length,
    failedCount: safeResults.filter(item => item.status === 'failed').length,
    skippedCount: safeResults.filter(item => item.status === 'skipped').length
  }
}

function buildRebuildDiagnostics(clothesList = [], options = {}) {
  const safeList = Array.isArray(clothesList) ? clothesList : []
  const diagnostics = safeList.map(item => {
    const decision = getSyncDecision(item, options)
    const isReadyInKnowledge = Boolean(decision.hasImage && decision.hasKnowledgeDoc && decision.syncStatus === 'ready')
    return {
      clothingId: normalizeText(item && item._id),
      name: normalizeText(item && item.name) || '未命名衣物',
      hasImage: decision.hasImage,
      syncStatus: decision.syncStatus,
      knowledge_sync_error: normalizeText(item && item.knowledge_sync_error),
      hasKnowledgeDoc: decision.hasKnowledgeDoc,
      isReadyInKnowledge,
      reason: decision.reason,
      canSync: decision.canSync
    }
  })

  const skipReasonStats = diagnostics.reduce((accumulator, item) => {
    const key = item.reason || 'unknown'
    accumulator[key] = (accumulator[key] || 0) + 1
    return accumulator
  }, {})

  const totalWardrobeCount = diagnostics.length
  const syncableCount = diagnostics.filter(item => item.hasImage).length
  const readyInKnowledgeCount = diagnostics.filter(item => item.isReadyInKnowledge).length
  const missingKnowledgeCount = diagnostics.filter(item => item.hasImage && !item.isReadyInKnowledge).length
  const missingImageCount = diagnostics.filter(item => !item.hasImage).length

  return {
    diagnostics,
    skipReasonStats,
    inventorySummary: {
      totalWardrobeCount,
      syncableCount,
      readyInKnowledgeCount,
      missingKnowledgeCount,
      missingImageCount,
      pendingCount: diagnostics.filter(item => item.syncStatus === 'pending').length,
      syncingCount: diagnostics.filter(item => item.syncStatus === 'syncing').length,
      failedCount: diagnostics.filter(item => item.syncStatus === 'failed').length,
      skippedNoImageCount: diagnostics.filter(item => item.syncStatus === 'skipped_no_image').length
    },
    skippedCount: diagnostics.filter(item => !item.canSync).length
  }
}

module.exports = {
  normalizeText,
  normalizeTagList,
  splitSeasonText,
  hasSyncableImage,
  resolveKnowledgeSyncStatus,
  buildInferenceSourceText,
  buildInferredProfile,
  buildMergedTags,
  buildRetrievalTags,
  buildRetrievalText,
  buildLegacyKnowledgePatch,
  getSyncDecision,
  shouldSyncClothing,
  summarizeRebuildResults,
  buildRebuildDiagnostics
}
