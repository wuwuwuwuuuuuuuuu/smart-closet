const assert = require('assert')
const {
  buildKnowledgeFailureResponse
} = require('../../cloudfunctions/smartRecommendPhoto/utils/knowledge-failure-response')

const response = buildKnowledgeFailureResponse({
  code: 422,
  message: '知识库检索没有命中结果',
  detail: '请换一句更明确的需求再试',
  knowledgeId: 'kb_001',
  syncSummary: {
    syncedCount: 3,
    failedCount: 1
  },
  phase: 'retrieval',
  retrievalHitCount: 2
})

assert.strictEqual(response.code, 422)
assert.strictEqual(response.message, '知识库检索没有命中结果')
assert.strictEqual(response.data.knowledgeId, 'kb_001')
assert.strictEqual(response.data.retrievalHitCount, 2)
assert.deepStrictEqual(response.data.tips, [
  '失败阶段：retrieval',
  '已同步 3 件，失败 1 件'
])
assert.deepStrictEqual(response.data.selectedClothesIds, [])

const responseWithoutPhase = buildKnowledgeFailureResponse({
  code: 500,
  message: '推荐失败'
})

assert.deepStrictEqual(responseWithoutPhase.data.tips, [])
assert.strictEqual(responseWithoutPhase.data.retrievalHitCount, 0)

const timeoutResponse = buildKnowledgeFailureResponse({
  code: 504,
  message: '阿里百炼知识库检索超时，请稍后重试或换一句更短、更明确的需求。',
  detail: '知识库检索等待超过 60 秒，当前请求已中止。你可以稍后重试，或先用更具体的场景和衣物需求缩小检索范围。',
  phase: 'retrieval'
})

assert.strictEqual(timeoutResponse.code, 504)
assert.strictEqual(timeoutResponse.data.summary, '阿里百炼知识库检索超时，请稍后重试或换一句更短、更明确的需求。')
assert.ok(timeoutResponse.data.replyText.includes('60 秒'))
assert.deepStrictEqual(timeoutResponse.data.tips, ['失败阶段：retrieval'])

console.log('knowledge-failure-response.test.js passed')
