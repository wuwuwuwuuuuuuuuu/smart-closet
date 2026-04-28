const assert = require('assert')
const {
  filterKnowledgeReadyClothes,
  resolveClothingSlot,
  filterStructuredOutfit,
  buildKnowledgeRecommendationDraft
} = require('../../cloudfunctions/smartRecommendPhoto/utils/knowledge-recommendation-builder')

const readyClothes = filterKnowledgeReadyClothes([
  {
    _id: 'c1',
    knowledge_sync_status: 'ready',
    bailian_doc_id: 'doc_1',
    category: '上衣',
    name: '白衬衫',
    image: 'cloud://shirt.png'
  },
  { _id: 'c2', knowledge_sync_status: 'pending', bailian_doc_id: '' },
  {
    _id: 'c3',
    knowledge_sync_status: 'ready',
    bailian_doc_id: 'doc_3',
    category: '下装',
    name: '黑长裤',
    originalImage: 'cloud://pants.png'
  }
])

assert.deepStrictEqual(readyClothes.map(item => item._id), ['c1', 'c3'])
assert.strictEqual(resolveClothingSlot({ category: '上衣', name: '白衬衫' }), 'top')
assert.strictEqual(resolveClothingSlot({ category: '下装', name: '黑长裤' }), 'bottom')
assert.strictEqual(resolveClothingSlot({ category: '外套', name: '西装外套' }), 'outer')

const structured = filterStructuredOutfit([
  {
    _id: 'top_1',
    category: '上衣',
    name: '白衬衫',
    image: 'cloud://top-1.png'
  },
  {
    _id: 'bottom_1',
    category: '下装',
    name: '黑长裤',
    image: 'cloud://bottom-1.png'
  },
  {
    _id: 'top_2',
    category: '上衣',
    name: '针织上衣',
    image: 'cloud://top-2.png'
  },
  {
    _id: 'outer_1',
    category: '外套',
    name: '灰西装外套',
    image: 'cloud://outer-1.png'
  }
])

assert.deepStrictEqual(structured.clothes.map(item => item._id), ['top_1', 'bottom_1', 'outer_1'])
assert.strictEqual(structured.removedCount, 1)

const draft = buildKnowledgeRecommendationDraft({
  event: {
    weatherSuggestion: '建议带薄外套',
    occasion: '通勤'
  },
  matchedClothes: [
    {
      _id: 'c1',
      category: '上衣',
      name: '白衬衫',
      image: 'cloud://shirt.png'
    },
    {
      _id: 'c3',
      category: '下装',
      name: '黑长裤',
      originalImage: 'cloud://pants.png'
    },
    {
      _id: 'c4',
      category: '上衣',
      name: '春季针织上衣',
      image: 'cloud://knit-top.png'
    }
  ],
  retrievalItems: [{ docId: 'doc_1' }, { docId: 'doc_3' }, { docId: 'doc_4' }],
  knowledgeId: 'kb_001',
  aiPayload: {
    summary: '已找到合适搭配',
    replyText: '点击箭头查看试穿效果',
    tips: ['适合通勤'],
    retrievalHitCount: 3
  }
})

assert.strictEqual(draft.retrievalSource, 'bailian_knowledge')
assert.strictEqual(draft.knowledgeId, 'kb_001')
assert.strictEqual(draft.retrievalHitCount, 3)
assert.deepStrictEqual(draft.selectedClothesIds, ['c1', 'c3'])
assert.deepStrictEqual(draft.selectedPhotoUrls, ['cloud://shirt.png', 'cloud://pants.png'])
assert.strictEqual(draft.summary, '已找到合适搭配')
assert.strictEqual(draft.replyText, '点击箭头查看试穿效果')
assert.deepStrictEqual(draft.outfitLines, ['上衣：白衬衫', '下装：黑长裤'])
assert.ok(draft.tips.includes('已去除重复品类 1 件'))
assert.strictEqual(draft.wardrobeAnalysisSummary, '知识库检索命中 3 条候选记录，最终匹配 2 件本地衣物。')

const fallbackDraft = buildKnowledgeRecommendationDraft({
  matchedClothes: readyClothes.slice(0, 1),
  retrievalItems: [{ docId: 'doc_1' }],
  knowledgeId: 'kb_002',
  aiPayload: {}
})

assert.deepStrictEqual(fallbackDraft.outfitLines, ['上衣：白衬衫'])
assert.deepStrictEqual(fallbackDraft.selectedPhotoUrls, ['cloud://shirt.png'])
assert.strictEqual(fallbackDraft.retrievalHitCount, 1)

console.log('knowledge-recommendation-builder.test.js passed')
