const cloud = require('wx-server-sdk')
const { createTextEmbedding, requestCompatibleChat } = require('./common/dashscope-multimodal-provider')
const { pickTopKBySimilarity } = require('./common/image-vector-utils')

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
const _ = db.command

function logError(scope, error, extra = {}) {
  console.error(`[SmartRecommendPhoto][${scope}]`, {
    message: error && error.message ? error.message : String(error),
    ...extra
  })
}

function logWarning(scope, message, extra = {}) {
  console.warn(`[SmartRecommendPhoto][${scope}] ${message}`, extra)
}

function normalizeInput(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueStringList(list = []) {
  return [...new Set((Array.isArray(list) ? list : [])
    .map(item => normalizeInput(String(item || '')))
    .filter(Boolean))]
}

function getDashScopeApiKey() {
  return normalizeInput(process.env.DASHSCOPE_API_KEY || localConfig.DASHSCOPE_API_KEY)
}

async function getCurrentUser(openid) {
  const res = await db.collection('users')
    .where({ _openid: openid })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
  return res.data && res.data[0]
}

function buildRetrievalQuery(event = {}) {
  const parts = [
    normalizeInput(event.userQuery),
    normalizeInput(event.occasion),
    normalizeInput(event.city),
    normalizeInput(event.weatherSuggestion)
  ]
  const weatherInfo = event.weatherInfo || {}
  parts.push(normalizeInput(weatherInfo.text))
  parts.push(normalizeInput(String(weatherInfo.temp || '')))
  const preferences = event.userPreferences || {}
  parts.push(normalizeInput(preferences.preferredStyle))
  parts.push(normalizeInput(preferences.preferredColor))
  return parts.filter(Boolean).join('；')
}

async function loadUserImageVectors(userId) {
  try {
    const res = await db.collection('clothes_image_vectors')
      .where({ user_id: userId })
      .limit(100)
      .get()
    return (res.data || []).filter(item => Array.isArray(item.vector) && item.vector.length)
  } catch (error) {
    const message = error && error.message ? error.message : String(error)
    if (/collection not exists|Db or Table not exist|DATABASE_COLLECTION_NOT_EXIST|ResourceNotFound/i.test(message)) {
      logWarning('recommend.imageRetrieval', 'image vector collection not found')
      return []
    }
    throw error
  }
}

async function loadClothesByIds(ids = []) {
  const safeIds = uniqueStringList(ids)
  if (!safeIds.length) return []
  const res = await db.collection('clothes')
    .where({ _id: _.in(safeIds) })
    .limit(safeIds.length)
    .get()
  return res.data || []
}

async function loadFallbackClothes(userId, limit = 4) {
  const res = await db.collection('clothes')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get()
  return res.data || []
}

async function getTempUrl(fileId) {
  const normalizedFileId = normalizeInput(fileId)
  if (!normalizedFileId) return ''
  if (/^https?:\/\//i.test(normalizedFileId)) return normalizedFileId
  if (!normalizedFileId.startsWith('cloud://')) return normalizedFileId

  const res = await cloud.getTempFileURL({ fileList: [normalizedFileId] })
  const item = res.fileList && res.fileList[0]
  return normalizeInput(item && item.tempFileURL)
}

async function attachPhotoUrls(items = []) {
  const result = []
  for (const item of items) {
    const imageFileId = normalizeInput(item.image) || normalizeInput(item.originalImage) || normalizeInput(item.imageFileId)
    result.push({
      ...item,
      imageFileId,
      photoUrl: await getTempUrl(imageFileId).catch(() => '')
    })
  }
  return result
}

function mergeHitsWithClothes(topHits, clothes) {
  const clothesMap = new Map((clothes || []).map(item => [String(item._id), item]))
  return topHits.map(hit => {
    const clothing = clothesMap.get(String(hit.id)) || {}
    return {
      ...hit,
      ...clothing,
      id: String(hit.id),
      name: normalizeInput(clothing.name) || normalizeInput(hit.name) || '未命名衣物',
      category: normalizeInput(clothing.category) || normalizeInput(hit.category),
      season: normalizeInput(clothing.season) || normalizeInput(hit.season),
      tags: Array.isArray(clothing.tags) ? clothing.tags : (Array.isArray(hit.tags) ? hit.tags : []),
      imageFileId: normalizeInput(clothing.image) || normalizeInput(clothing.originalImage) || normalizeInput(hit.imageFileId)
    }
  })
}

function normalizeRecommendation(raw = {}, hits = [], meta = {}) {
  const hitIds = hits.map(item => String(item.id || item._id)).filter(Boolean)
  let selectedClothesIds = uniqueStringList(raw.selectedClothesIds).filter(id => hitIds.includes(id))
  selectedClothesIds = supplementSelectedClothesIds({
    selectedClothesIds,
    hits,
    minCount: hits.length >= 2 ? 2 : 1,
    maxCount: 4
  })
  selectedClothesIds = enforceOutfitSelectionRules({
    selectedClothesIds,
    hits,
    maxCount: 4
  })
  if (!selectedClothesIds.length) {
    selectedClothesIds = hitIds.slice(0, Math.min(4, hitIds.length))
  }

  const selectedSet = new Set(selectedClothesIds)
  const selectedHits = hits.filter(item => selectedSet.has(String(item.id || item._id)))
  const selectedPhotoUrls = uniqueStringList(raw.selectedPhotoUrls)
  selectedHits.forEach(item => {
    if (item.photoUrl) selectedPhotoUrls.push(item.photoUrl)
  })

  const shouldUseModelLines = shouldTrustModelOutfitText(raw, selectedHits)
  const outfitLines = shouldUseModelLines && Array.isArray(raw.outfitLines) && raw.outfitLines.length
    ? raw.outfitLines.map(normalizeInput).filter(Boolean)
    : buildDeterministicOutfitLines(selectedHits)

  const tips = Array.isArray(raw.tips) && raw.tips.length
    ? raw.tips.map(normalizeInput).filter(Boolean)
    : ['已优先根据你的衣橱图片相似度选择候选衣物。']
  const replyText = shouldUseModelLines
    ? normalizeInput(raw.replyText)
    : buildDeterministicReplyText(selectedHits)

  return {
    requestId: normalizeInput(meta.requestId) || `img_rec_${Date.now()}`,
    summary: normalizeInput(raw.summary) || '图片知识库推荐已生成',
    replyText: replyText || '我已根据你的需求和衣橱图片，挑选出更适合试穿的搭配。',
    selectedClothesIds,
    selectedPhotoUrls: uniqueStringList(selectedPhotoUrls),
    outfitLines,
    tips,
    ctaLabel: normalizeInput(raw.ctaLabel) || '去试穿页继续搭配',
    retrievalSource: normalizeInput(meta.retrievalSource) || 'image_vector',
    retrievalHitCount: Number(meta.retrievalHitCount) || hits.length,
    fallbackReason: normalizeInput(meta.fallbackReason)
  }
}

function buildDeterministicOutfitLines(selectedHits = []) {
  return selectedHits.map(item => {
    const category = normalizeCategory(item.category) || '衣物'
    return `${category}：${item.name || '未命名衣物'}`
  })
}

function buildDeterministicReplyText(selectedHits = []) {
  const categories = [...new Set(selectedHits.map(item => normalizeCategory(item.category)).filter(Boolean))]
  if (categories.includes('上衣') && !categories.includes('下装') && !categories.includes('连衣裙')) {
    return '已根据你的衣橱图片优先推荐这件上衣；当前候选中没有匹配到合适下装，因此不强行凑成不合理搭配。'
  }
  if (categories.includes('上衣') && categories.includes('下装')) {
    return '已根据你的衣橱图片推荐一套上衣 + 下装的完整搭配。'
  }
  if (categories.includes('连衣裙')) {
    return '已根据你的衣橱图片推荐以连衣裙为主体的搭配。'
  }
  return '已根据你的衣橱图片推荐当前最匹配的衣物。'
}

function shouldTrustModelOutfitText(raw = {}, selectedHits = []) {
  const selectedCategories = selectedHits.map(item => normalizeCategory(item.category)).filter(Boolean)
  const text = [
    normalizeInput(raw.replyText),
    ...(Array.isArray(raw.outfitLines) ? raw.outfitLines.map(normalizeInput) : [])
  ].join(' ')

  if (selectedCategories.includes('上衣') && !selectedCategories.includes('连衣裙') && /连衣裙|裙子|裙装|下装/.test(text)) {
    return false
  }

  if (selectedCategories.includes('连衣裙') && /(上衣.*下装|下装.*上衣)/.test(text)) {
    return false
  }

  return true
}

function supplementSelectedClothesIds({ selectedClothesIds = [], hits = [], minCount = 2, maxCount = 4 }) {
  const normalizedSelected = uniqueStringList(selectedClothesIds)
  const selectedSet = new Set(normalizedSelected)
  const result = [...normalizedSelected]
  const safeHits = Array.isArray(hits) ? hits : []

  if (result.length >= Math.min(minCount, safeHits.length)) {
    return result.slice(0, maxCount)
  }

  const selectedCategories = new Set(
    safeHits
      .filter(item => selectedSet.has(String(item.id || item._id)))
      .map(item => normalizeInput(item.category))
      .filter(Boolean)
  )

  const categoryPriority = ['上衣', '下装', '外套', '连衣裙', '鞋包', '配饰']
  const byCategoryPriority = [...safeHits].sort((a, b) => {
    const aIndex = categoryPriority.indexOf(normalizeInput(a.category))
    const bIndex = categoryPriority.indexOf(normalizeInput(b.category))
    const safeAIndex = aIndex === -1 ? 99 : aIndex
    const safeBIndex = bIndex === -1 ? 99 : bIndex
    if (safeAIndex !== safeBIndex) return safeAIndex - safeBIndex
    return Number(b.score || 0) - Number(a.score || 0)
  })

  for (const item of byCategoryPriority) {
    const id = String(item.id || item._id || '')
    const category = normalizeInput(item.category)
    if (!id || selectedSet.has(id) || selectedCategories.has(category)) continue
    result.push(id)
    selectedSet.add(id)
    if (category) selectedCategories.add(category)
    if (result.length >= minCount || result.length >= maxCount) {
      return result.slice(0, maxCount)
    }
  }

  for (const item of safeHits) {
    const id = String(item.id || item._id || '')
    if (!id || selectedSet.has(id)) continue
    result.push(id)
    selectedSet.add(id)
    if (result.length >= minCount || result.length >= maxCount) {
      break
    }
  }

  return result.slice(0, maxCount)
}

function normalizeCategory(category) {
  const text = normalizeInput(category)
  if (!text) return ''
  if (/上衣|衬衫|T恤|短袖|针织|毛衣|背心|吊带/.test(text)) return '上衣'
  if (/下装|裤|裙|短裤|长裤|半裙/.test(text) && !/连衣裙/.test(text)) return '下装'
  if (/连衣裙|裙装|套裙/.test(text)) return '连衣裙'
  if (/外套|大衣|风衣|西装|开衫|夹克/.test(text)) return '外套'
  if (/鞋|包/.test(text)) return '鞋包'
  if (/配饰|帽|围巾|腰带|项链|耳环/.test(text)) return '配饰'
  return text
}

function isAccessoryCategory(category) {
  return ['外套', '鞋包', '配饰'].includes(normalizeCategory(category))
}

function isPrimaryOutfitCategory(category) {
  return ['上衣', '下装', '连衣裙'].includes(normalizeCategory(category))
}

function isValidOutfitCategorySet(categories = []) {
  const normalizedList = categories.map(normalizeCategory).filter(Boolean)
  const normalized = [...new Set(normalizedList)]
  const hasDress = normalized.includes('连衣裙')
  const hasTop = normalized.includes('上衣')
  const hasBottom = normalized.includes('下装')
  const primaryList = normalizedList.filter(isPrimaryOutfitCategory)
  const hasDuplicatedPrimary = primaryList.length !== new Set(primaryList).size

  if (hasDuplicatedPrimary) {
    return false
  }

  if (hasDress && (hasTop || hasBottom)) {
    return false
  }

  if (hasDress) {
    return true
  }

  if (hasTop && hasBottom) {
    return true
  }

  const primaryCount = normalized.filter(isPrimaryOutfitCategory).length
  if (primaryCount === 0 && normalized.some(isAccessoryCategory)) {
    return false
  }

  return normalizedList.length <= 1
}

function enforceOutfitSelectionRules({ selectedClothesIds = [], hits = [], maxCount = 4 }) {
  const safeHits = Array.isArray(hits) ? hits : []
  const hitMap = new Map(safeHits.map(item => [String(item.id || item._id), item]))
  const selectedHits = uniqueStringList(selectedClothesIds)
    .map(id => hitMap.get(id))
    .filter(Boolean)

  if (!selectedHits.length) {
    return []
  }

  const selectedCategories = selectedHits.map(item => item.category)
  if (isValidOutfitCategorySet(selectedCategories)) {
    return selectedHits.map(item => String(item.id || item._id)).slice(0, maxCount)
  }

  const tops = safeHits.filter(item => normalizeCategory(item.category) === '上衣')
  const bottoms = safeHits.filter(item => normalizeCategory(item.category) === '下装')
  const dresses = safeHits.filter(item => normalizeCategory(item.category) === '连衣裙')
  const accessories = safeHits.filter(item => isAccessoryCategory(item.category))

  const bestTop = tops[0]
  const bestBottom = bottoms[0]
  if (bestTop && bestBottom) {
    return [bestTop, bestBottom]
      .concat(accessories.slice(0, Math.max(0, maxCount - 2)))
      .map(item => String(item.id || item._id))
      .slice(0, maxCount)
  }

  const bestDress = dresses[0]
  if (bestDress) {
    return [bestDress]
      .concat(accessories.slice(0, Math.max(0, maxCount - 1)))
      .map(item => String(item.id || item._id))
      .slice(0, maxCount)
  }

  const firstPrimary = safeHits.find(item => isPrimaryOutfitCategory(item.category)) || safeHits[0]
  return firstPrimary ? [String(firstPrimary.id || firstPrimary._id)] : []
}

function buildFallbackRecommendation(event = {}, reason = 'fallback', clothes = []) {
  const hits = clothes.map((item, index) => ({
    ...item,
    id: String(item._id),
    score: Math.max(0, 1 - index * 0.1),
    photoUrl: item.photoUrl || ''
  }))
  return {
    code: 200,
    data: normalizeRecommendation({
      summary: '智能推荐已生成',
      replyText: clothes.length
        ? '当前图片向量检索不可用，我先从你的衣橱中挑选了一组可继续试穿的衣物。'
        : '当前图片知识库还没有可用衣物，请先上传衣物并点击补同步。',
      tips: [
        reason === 'no_image_vector_hits' ? '图片知识库暂无命中，请先补同步或上传更多衣物。' : '已使用降级推荐，建议稍后重试图片知识库。'
      ]
    }, hits, {
      retrievalSource: 'fallback',
      retrievalHitCount: hits.length,
      fallbackReason: reason,
      requestId: event.requestId
    })
  }
}

function buildRecommendationPrompt({ userQuery, weatherInfo, city, hits }) {
  return [
    '你是智能衣橱穿搭助手。',
    `用户需求：${userQuery}`,
    `城市：${city || '未知'}`,
    `天气：${weatherInfo && weatherInfo.text || '未知'}，温度：${weatherInfo && weatherInfo.temp || '未知'}`,
    '请只从候选衣物中选择 2-4 件组成完整搭配；除非候选不足，否则不要只推荐 1 件。',
    '强约束：候选衣物的 category 字段是用户录入的权威分类，必须信任 category，不要根据图片外观把上衣改叫裙子/下装。',
    '强约束：输出文案里的衣物类别必须与候选 category 一致。',
    '强约束：上衣必须搭配下装；连衣裙不能再搭配上衣或下装，只能搭配外套/鞋包/配饰。',
    '强约束：不要把两件上衣、上衣+连衣裙、下装+连衣裙作为同一套搭配。',
    '如果候选中没有合法组合，宁可少选，也不要凑出不合理搭配。',
    '优先组合不同类别，例如上衣 + 下装，或连衣裙 + 外套/鞋包/配饰。',
    '必须返回 JSON，不要返回 Markdown。',
    'JSON 字段：summary, replyText, selectedClothesIds, outfitLines, tips。',
    `候选衣物：${JSON.stringify(hits.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      season: item.season,
      tags: item.tags,
      score: Number(item.score || 0).toFixed(4)
    })))}`
  ].join('\n')
}

function buildVisionMessages({ prompt, hits }) {
  const content = [{ type: 'text', text: prompt }]
  hits.slice(0, 6).forEach(item => {
    if (item.photoUrl) {
      content.push({ type: 'image_url', image_url: { url: item.photoUrl } })
    }
  })
  return [{ role: 'user', content }]
}

async function buildMultimodalRecommendation({ userQuery, weatherInfo, city, hits, requestId }) {
  const prompt = buildRecommendationPrompt({ userQuery, weatherInfo, city, hits })
  try {
    const raw = await requestCompatibleChat({
      apiKey: getDashScopeApiKey(),
      baseUrl: normalizeInput(localConfig.DASHSCOPE_BASE_URL) || undefined,
      model: normalizeInput(localConfig.DASHSCOPE_RESPONSE_MODEL) || 'qwen-vl-plus',
      timeoutMs: Number(localConfig.BAILIAN_RESPONSE_TIMEOUT_MS) || 60000,
      messages: buildVisionMessages({ prompt, hits })
    })
    return normalizeRecommendation(raw, hits, {
      requestId,
      retrievalSource: 'image_vector',
      retrievalHitCount: hits.length
    })
  } catch (error) {
    logWarning('recommend.modelJson', 'invalid model json or model request failed', {
      errMsg: error && error.message
    })
    return normalizeRecommendation({}, hits, {
      requestId,
      retrievalSource: 'image_vector',
      retrievalHitCount: hits.length,
      fallbackReason: 'model_fallback'
    })
  }
}

exports.main = async (event = {}) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const userQuery = normalizeInput(event.userQuery)
    if (!userQuery) {
      return { code: 400, message: 'userQuery is required' }
    }

    const user = await getCurrentUser(openid)
    if (!user) {
      return { code: 404, message: '用户不存在' }
    }

    let queryVector
    try {
      queryVector = await createTextEmbedding({
        text: buildRetrievalQuery(event),
        apiKey: getDashScopeApiKey(),
        model: normalizeInput(localConfig.DASHSCOPE_EMBEDDING_MODEL) || undefined,
        timeoutMs: Number(localConfig.BAILIAN_RESPONSE_TIMEOUT_MS) || 60000
      })
    } catch (error) {
      logWarning('recommend.imageRetrieval', 'text embedding failed, using fallback', {
        errMsg: error && error.message
      })
      const fallbackClothes = await attachPhotoUrls(await loadFallbackClothes(user._id, 4))
      return buildFallbackRecommendation(event, 'text_embedding_failed', fallbackClothes)
    }

    const vectorDocs = await loadUserImageVectors(user._id)
    if (!vectorDocs.length) {
      logWarning('recommend.imageRetrieval', 'no image vectors found', { userId: user._id })
      const fallbackClothes = await attachPhotoUrls(await loadFallbackClothes(user._id, 4))
      return buildFallbackRecommendation(event, 'no_image_vectors', fallbackClothes)
    }

    const topHits = pickTopKBySimilarity({
      queryVector,
      items: vectorDocs.map(doc => ({
        id: doc.clothing_id,
        vector: doc.vector,
        imageFileId: doc.image_file_id,
        category: doc.category,
        season: doc.season,
        tags: doc.tags,
        name: doc.name
      })),
      topK: Number(localConfig.BAILIAN_MAX_RESULTS) || 8
    })

    if (!topHits.length) {
      logWarning('recommend.imageRetrieval', 'no image vector hits after similarity ranking')
      const fallbackClothes = await attachPhotoUrls(await loadFallbackClothes(user._id, 4))
      return buildFallbackRecommendation(event, 'no_image_vector_hits', fallbackClothes)
    }

    const clothes = await loadClothesByIds(topHits.map(item => item.id))
    const mergedHits = await attachPhotoUrls(mergeHitsWithClothes(topHits, clothes))
    const recommendation = await buildMultimodalRecommendation({
      userQuery,
      weatherInfo: event.weatherInfo,
      city: event.city,
      hits: mergedHits,
      requestId: event.requestId
    })

    return {
      code: 200,
      data: recommendation
    }
  } catch (error) {
    logError('recommend.main', error)
    return {
      code: 500,
      message: '图片推荐失败',
      error: error && error.message ? error.message : String(error)

    }
  }
}

