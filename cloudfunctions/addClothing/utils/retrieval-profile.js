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

function buildKnowledgeSyncFields(payload = {}) {
  const image = normalizeText(payload.image)
  const userTags = normalizeTagList(payload.tags)
  const inferredProfile = buildInferredProfile(payload)
  const mergedTags = buildMergedTags(payload)

  return {
    originalImage: normalizeText(payload.originalImage),
    user_tags: userTags,
    inferred_profile: inferredProfile,
    merged_tags: mergedTags,
    retrieval_tags: mergedTags,
    retrieval_text: buildRetrievalText(payload),
    bailian_file_id: '',
    bailian_doc_id: '',
    knowledge_doc_id: '',
    knowledge_sync_provider: 'bailian',
    knowledge_sync_status: image ? 'pending' : 'skipped_no_image',
    knowledge_sync_error: '',
    knowledge_last_sync_at: null
  }
}

module.exports = {
  normalizeText,
  normalizeTagList,
  splitSeasonText,
  buildInferenceSourceText,
  buildInferredProfile,
  buildMergedTags,
  buildRetrievalTags,
  buildRetrievalText,
  buildKnowledgeSyncFields
}
