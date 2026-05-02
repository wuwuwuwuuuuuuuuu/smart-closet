const assert = require('assert')
const {
  buildKnowledgeRecommendation
} = require('../../cloudfunctions/smartRecommendPhoto/utils/knowledge-recommendation-service')

const readyClothes = [
  {
    _id: 'c1',
    name: '白衬衫',
    category: '上衣',
    image: 'cloud://shirt.png',
    knowledge_sync_status: 'ready',
    bailian_doc_id: 'doc_1',
    bailian_file_id: 'file_1'
  }
]

async function run() {
  const originalWarn = console.warn
  console.warn = () => {}

  const missingKnowledge = await buildKnowledgeRecommendation({
    provider: {},
    binding: {},
    clothesList: readyClothes,
    event: {},
    userQuery: '明天通勤穿什么'
  })
  assert.strictEqual(missingKnowledge.success, false)
  assert.strictEqual(missingKnowledge.phase, 'binding')

  const noReady = await buildKnowledgeRecommendation({
    provider: {},
    binding: { knowledgeId: 'kb_001' },
    clothesList: [{ _id: 'c2', knowledge_sync_status: 'pending' }],
    event: {},
    userQuery: '明天通勤穿什么'
  })
  assert.strictEqual(noReady.success, false)
  assert.strictEqual(noReady.phase, 'sync')

  const emptyRetrieval = await buildKnowledgeRecommendation({
    provider: {
      retrieveFromKnowledge: async () => ({
        output_text: '请换一句更明确的需求再试'
      })
    },
    binding: { knowledgeId: 'kb_001' },
    clothesList: readyClothes,
    event: {},
    userQuery: '明天通勤穿什么'
  })
  assert.strictEqual(emptyRetrieval.success, false)
  assert.strictEqual(emptyRetrieval.phase, 'parse')

  const emptyMapping = await buildKnowledgeRecommendation({
    provider: {
      retrieveFromKnowledge: async () => ({
        output: [
          {
            type: 'file_search_call',
            results: [
              {
                docId: 'doc_missing',
                fileId: 'file_missing',
                fileName: 'missing.md',
                snippet: 'clothes_id: missing'
              }
            ]
          }
        ]
      })
    },
    binding: { knowledgeId: 'kb_001' },
    clothesList: readyClothes,
    event: {},
    userQuery: '明天通勤穿什么'
  })
  assert.strictEqual(emptyMapping.success, false)
  assert.strictEqual(emptyMapping.phase, 'parse')

  try {
    await buildKnowledgeRecommendation({
      provider: {
        retrieveFromKnowledge: async () => {
          throw new Error('network failed')
        }
      },
      binding: { knowledgeId: 'kb_001' },
      clothesList: readyClothes,
      event: {},
      userQuery: '明天通勤穿什么'
    })
    assert.fail('expected retrieval error')
  } catch (error) {
    assert.strictEqual(error.phase, 'retrieval')
  }

  try {
    await buildKnowledgeRecommendation({
      provider: {
        retrieveFromKnowledge: async () => ({
          output_text: '{"summary":"ok"'
        })
      },
      binding: { knowledgeId: 'kb_001' },
      clothesList: readyClothes,
      event: {},
      userQuery: '明天通勤穿什么'
    })
  } catch (error) {
    assert.fail(`unexpected parse error: ${error.message}`)
  }

  console.warn = originalWarn
  console.log('smart-recommend-phase-diagnosis.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
