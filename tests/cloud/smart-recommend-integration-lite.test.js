const assert = require('assert')
const {
  buildKnowledgeRecommendation
} = require('../../cloudfunctions/smartRecommendPhoto/utils/knowledge-recommendation-service')

async function run() {
  const clothesList = [
    {
      _id: 'c1',
      name: '白衬衫',
      category: '上衣',
      image: 'cloud://shirt.png',
      knowledge_sync_status: 'ready',
      bailian_doc_id: 'doc_1',
      bailian_file_id: 'file_1'
    },
    {
      _id: 'c2',
      name: '黑长裤',
      category: '下装',
      originalImage: 'cloud://pants.png',
      knowledge_sync_status: 'ready',
      bailian_doc_id: 'doc_2',
      bailian_file_id: 'file_2'
    }
  ]

  const result = await buildKnowledgeRecommendation({
    provider: {
      retrieveFromKnowledge: async ({ knowledgeId, query, topN }) => {
        assert.strictEqual(knowledgeId, 'kb_001')
        assert.strictEqual(topN, 3)
        assert.ok(query.includes('通勤'))
        return {
          output: [
            {
              type: 'file_search_call',
              results: [
                {
                  docId: 'doc_1',
                  fileId: 'file_1',
                  fileName: 'c1.md',
                  snippet: 'clothes_id: c1'
                },
                {
                  docId: 'doc_2',
                  fileId: 'file_2',
                  fileName: 'c2.md',
                  snippet: 'clothes_id: c2'
                }
              ]
            }
          ],
          output_text: JSON.stringify({
            summary: '已找到适合通勤的搭配',
            replyText: '点击箭头查看试穿效果',
            outfitLines: ['上衣：白衬衫', '下装：黑长裤'],
            tips: ['适合通勤'],
            selectedClothesIds: ['c1']
          })
        }
      }
    },
    binding: { knowledgeId: 'kb_001' },
    clothesList,
    event: {
      occasion: '通勤',
      weatherSuggestion: '建议带薄外套'
    },
    userQuery: '明天通勤穿什么'
  })

  assert.strictEqual(result.success, true)
  assert.deepStrictEqual(result.data.selectedClothesIds, ['c1', 'c2'])
  assert.deepStrictEqual(result.data.selectedPhotoUrls, ['cloud://shirt.png', 'cloud://pants.png'])
  assert.strictEqual(result.data.retrievalHitCount, 2)
  assert.strictEqual(result.data.retrievalSource, 'bailian_knowledge')
  assert.strictEqual(result.data.knowledgeId, 'kb_001')
  assert.strictEqual(result.data.summary, '已找到适合通勤的搭配')
  assert.strictEqual(result.data.outfitLines.length, 2)
  assert.ok(result.data.wardrobeAnalysisSummary.includes('命中 2 条候选记录'))

  console.log('smart-recommend-integration-lite.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
