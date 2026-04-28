const assert = require('assert')

process.env.ALIBABA_CLOUD_ACCESS_KEY_ID = 'ak-test'
process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET = 'sk-test'
process.env.WORKSPACE_ID = 'ws-test'
process.env.DASHSCOPE_API_KEY = 'dash-test'

const provider = require('../../cloudfunctions/smartRecommendPhoto/utils/bailian-knowledge-provider')

const markdown = provider.buildClothingKnowledgeMarkdown({
  _id: 'c1',
  name: '白衬衫',
  category: '上衣',
  season: '春季',
  user_tags: ['通勤'],
  merged_tags: ['上衣', '春季', '通勤', 'white'],
  retrieval_tags: ['通勤', '简约'],
  inferred_profile: {
    colors: ['white'],
    styleTags: ['minimal'],
    occasionTags: ['commute'],
    fitTags: ['slim']
  },
  retrieval_text: 'white shirt for commute'
})
assert.ok(markdown.includes('clothes_id: c1'))
assert.ok(markdown.includes('user_tags: 通勤'))
assert.ok(markdown.includes('merged_tags: 上衣, 春季, 通勤, white'))
assert.ok(markdown.includes('colors: white'))
assert.ok(markdown.includes('style_tags: minimal'))

assert.strictEqual(provider.buildKnowledgeFileName({ _id: 'c1' }), 'c1.md')
assert.deepStrictEqual(
  provider.sanitizeKnowledgeTags(['休闲 甜美 清凉', '通勤,简约', 'v-neck#', '', null]),
  ['休闲', '甜美', '清凉', '通勤', '简约', 'v-neck']
)

const prompt = provider.buildResponsesPrompt({ query: '明天通勤穿什么' })
assert.ok(prompt.includes('selectedClothesIds'))
assert.ok(prompt.includes('明天通勤穿什么'))
assert.ok(prompt.includes('Return JSON only'))

const body = provider.buildResponsesRequestBody({
  model: 'qwen3.5-flash',
  knowledgeId: 'kb_001',
  prompt,
  maxResults: 3
})
assert.strictEqual(body.model, 'qwen3.5-flash')
assert.strictEqual(body.tools[0].type, 'file_search')
assert.deepStrictEqual(body.tools[0].vector_store_ids, ['kb_001'])
assert.strictEqual(body.tools[0].max_num_results, 3)

assert.strictEqual(provider.isRateLimitError({ response: { status: 429 } }), true)
assert.strictEqual(provider.isRateLimitError({ response: { status: 500 } }), false)
assert.strictEqual(provider.isTimeoutError({ code: 'ECONNABORTED', message: 'timeout of 60000ms exceeded' }), true)
assert.strictEqual(provider.isTimeoutError({ message: 'network error' }), false)
assert.strictEqual(typeof provider.knowledgeBaseExists, 'function')
assert.strictEqual(typeof provider.findKnowledgeBaseByName, 'function')
assert.strictEqual(typeof provider.sanitizeKnowledgeTags, 'function')
assert.strictEqual(typeof provider.purgeExistingKnowledgeEntries, 'function')

console.log('bailian-knowledge-provider.test.js passed')
