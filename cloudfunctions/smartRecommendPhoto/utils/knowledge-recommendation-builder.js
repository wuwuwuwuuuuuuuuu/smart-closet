const { logWarning } = require('./logger')

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

function filterKnowledgeReadyClothes(clothesList = []) {
  if (!Array.isArray(clothesList)) {
    logWarning('knowledgeRecommendationBuilder.filterKnowledgeReadyClothes', 'invalid clothesList', {
      clothesListType: typeof clothesList
    })
    return []
  }

  return clothesList.filter(item => {
    const status = normalizeText(item && item.knowledge_sync_status)
    const docId = normalizeText(item && (item.bailian_doc_id || item.knowledge_doc_id))
    return status === 'ready' && Boolean(docId)
  })
}

function buildCategorySearchText(item = {}) {
  return [
    normalizeText(item.category),
    normalizeText(item.name),
    ...normalizeTagList(item.tags),
    ...normalizeTagList(item.merged_tags),
    ...normalizeTagList(item.retrieval_tags)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function containsAny(text, keywords = []) {
  return keywords.some(keyword => text.includes(keyword))
}

function resolveClothingSlot(item = {}) {
  const searchText = buildCategorySearchText(item)
  if (!searchText) {
    return 'other'
  }

  if (containsAny(searchText, [
    '连衣裙', '裙装', 'dress', 'jumpsuit', 'romper', '背带裙'
  ])) {
    return 'onepiece'
  }

  if (containsAny(searchText, [
    '外套', '大衣', '风衣', '夹克', '开衫', '羽绒', '西装外套', 'blazer', 'jacket', 'coat', 'cardigan'
  ])) {
    return 'outer'
  }

  if (containsAny(searchText, [
    '上衣', 't恤', 't-shirt', 'tee', 'shirt', 'blouse', 'top',
    '衬衫', '卫衣', '毛衣', '针织', '背心', 'hoodie', 'sweater', 'knit'
  ])) {
    return 'top'
  }

  if (containsAny(searchText, [
    '下装', '裤', '牛仔裤', '半裙', '半身裙', '短裤', '长裤',
    'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'bottom'
  ])) {
    return 'bottom'
  }

  if (containsAny(searchText, [
    '鞋', '靴', 'sneaker', 'loafer', 'heel', 'boot', 'shoe'
  ])) {
    return 'shoes'
  }

  return 'other'
}

function buildOutfitLine(item = {}) {
  const slot = resolveClothingSlot(item)
  const labelMap = {
    top: '上衣',
    bottom: '下装',
    outer: '外套',
    shoes: '鞋履',
    onepiece: '连衣裙/连体',
    other: normalizeText(item.category) || '单品'
  }

  return `${labelMap[slot] || '单品'}：${normalizeText(item.name) || normalizeText(item._id) || '未命名单品'}`
}

function filterStructuredOutfit(matchedClothes = []) {
  if (!Array.isArray(matchedClothes)) {
    logWarning('knowledgeRecommendationBuilder.filterStructuredOutfit', 'invalid matchedClothes', {
      matchedClothesType: typeof matchedClothes
    })
    return {
      clothes: [],
      removedCount: 0
    }
  }

  const selected = []
  const occupied = {
    top: false,
    bottom: false,
    outer: false,
    shoes: false,
    onepiece: false
  }

  matchedClothes.forEach(item => {
    const slot = resolveClothingSlot(item)

    if (slot === 'onepiece') {
      if (occupied.onepiece || occupied.top || occupied.bottom) {
        return
      }
      occupied.onepiece = true
      occupied.top = true
      occupied.bottom = true
      selected.push(item)
      return
    }

    if (slot === 'top') {
      if (occupied.top || occupied.onepiece) {
        return
      }
      occupied.top = true
      selected.push(item)
      return
    }

    if (slot === 'bottom') {
      if (occupied.bottom || occupied.onepiece) {
        return
      }
      occupied.bottom = true
      selected.push(item)
      return
    }

    if (slot === 'outer') {
      if (occupied.outer) {
        return
      }
      occupied.outer = true
      selected.push(item)
      return
    }

    if (slot === 'shoes') {
      if (occupied.shoes) {
        return
      }
      occupied.shoes = true
      selected.push(item)
      return
    }

    selected.push(item)
  })

  return {
    clothes: selected,
    removedCount: Math.max(0, matchedClothes.length - selected.length)
  }
}

function buildKnowledgeRecommendationDraft({
  event = {},
  matchedClothes = [],
  retrievalItems = [],
  knowledgeId = '',
  aiPayload = {}
} = {}) {
  const clothes = Array.isArray(matchedClothes) ? matchedClothes : []
  const hits = Array.isArray(retrievalItems) ? retrievalItems : []
  if (!Array.isArray(retrievalItems) && retrievalItems !== undefined) {
    logWarning('knowledgeRecommendationBuilder.buildKnowledgeRecommendationDraft', 'invalid retrievalItems', {
      retrievalItemsType: typeof retrievalItems
    })
  }

  const structuredOutfit = filterStructuredOutfit(clothes)
  const finalClothes = structuredOutfit.clothes
  const fallbackLines = finalClothes.map(buildOutfitLine)
  const selectedPhotoUrls = finalClothes
    .map(item => normalizeText(item && item.image) || normalizeText(item && item.originalImage))
    .filter(Boolean)

  if (finalClothes.length && !selectedPhotoUrls.length) {
    logWarning('knowledgeRecommendationBuilder.buildKnowledgeRecommendationDraft', 'matched clothes missing photo urls', {
      matchedCount: finalClothes.length
    })
  }

  return {
    summary: normalizeText(aiPayload.summary) || (finalClothes.length
      ? `已从你的衣橱知识库中筛出 ${finalClothes.length} 件更符合需求的衣物。`
      : '已完成知识库检索，但暂未匹配到可直接试穿的衣物。'),
    replyText: normalizeText(aiPayload.replyText) || (finalClothes.length
      ? '我已经根据你的需求选好了衣物，点击箭头即可前往试穿页查看。'
      : '我完成了知识库检索，但这次没有找到可直接进入试穿的衣物。'),
    outfitLines: fallbackLines,
    tips: [
      ...(Array.isArray(aiPayload.tips) ? aiPayload.tips : []),
      structuredOutfit.removedCount > 0 ? `已去除重复品类 ${structuredOutfit.removedCount} 件` : '',
      normalizeText(event.weatherSuggestion),
      normalizeText(event.occasion) ? `场景：${normalizeText(event.occasion)}` : '',
      hits.length ? `命中候选：${hits.length}` : ''
    ].filter(Boolean),
    selectedClothesIds: finalClothes
      .map(item => normalizeText(item && item._id))
      .filter(Boolean),
    selectedPhotoUrls,
    wardrobeAnalysisSummary: hits.length
      ? `知识库检索命中 ${hits.length} 条候选记录，最终匹配 ${finalClothes.length} 件本地衣物。`
      : (finalClothes.length ? `最终匹配 ${finalClothes.length} 件本地衣物。` : ''),
    retrievalSource: 'bailian_knowledge',
    knowledgeId: normalizeText(knowledgeId),
    retrievalHitCount: hits.length || Number(aiPayload.retrievalHitCount) || 0
  }
}

module.exports = {
  filterKnowledgeReadyClothes,
  resolveClothingSlot,
  filterStructuredOutfit,
  buildKnowledgeRecommendationDraft
}
