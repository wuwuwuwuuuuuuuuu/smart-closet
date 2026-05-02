const assert = require('assert')
const {
  isCloudFunctionTimeoutError,
  buildKnowledgeRebuildFeedback,
  buildInventorySummaryLine
} = require('../../pages/daily/daily.helpers')

assert.strictEqual(
  buildInventorySummaryLine({
    totalWardrobeCount: 6,
    syncableCount: 3,
    readyInKnowledgeCount: 3,
    missingKnowledgeCount: 3,
    missingImageCount: 3
  }),
  '\u8863\u6a71 6 \u4ef6 / \u53ef\u540c\u6b65 3 \u4ef6 / \u5df2\u5165\u5e93 3 \u4ef6 / \u7f3a\u5931 3 \u4ef6\uff08\u5176\u4e2d\u65e0\u56fe 3 \u4ef6\uff09'
)

const pendingFeedback = buildKnowledgeRebuildFeedback({
  code: 200,
  data: {
    knowledgeId: 'kb_123',
    requestMode: 'normal',
    inventorySummary: {
      totalWardrobeCount: 6,
      syncableCount: 3,
      readyInKnowledgeCount: 2,
      missingKnowledgeCount: 1,
      missingImageCount: 3
    },
    queuedCount: 1,
    syncingCount: 0,
    readyCount: 0,
    syncedCount: 0,
    failedCount: 0
  }
})

assert.strictEqual(pendingFeedback.status, 'pending')
assert.strictEqual(pendingFeedback.title, '\u8865\u540c\u6b65\u5df2\u53d1\u8d77')
assert.ok(pendingFeedback.summaryText.includes('kb_123'))
assert.ok(pendingFeedback.summaryText.includes('\u8863\u6a71 6 \u4ef6 / \u53ef\u540c\u6b65 3 \u4ef6 / \u5df2\u5165\u5e93 2 \u4ef6 / \u7f3a\u5931 1 \u4ef6\uff08\u5176\u4e2d\u65e0\u56fe 3 \u4ef6\uff09'))

const successFeedback = buildKnowledgeRebuildFeedback({
  code: 200,
  data: {
    knowledgeId: 'kb_456',
    requestMode: 'forceResync',
    inventorySummary: {
      totalWardrobeCount: 6,
      syncableCount: 3,
      readyInKnowledgeCount: 3,
      missingKnowledgeCount: 0,
      missingImageCount: 3
    },
    readyCount: 1,
    syncedCount: 2,
    failedCount: 1,
    skippedCount: 3
  }
})

assert.strictEqual(successFeedback.status, 'success')
assert.strictEqual(successFeedback.title, '\u5f3a\u5236\u91cd\u540c\u6b65\u5b8c\u6210')
assert.ok(successFeedback.summaryText.includes('\u672c\u6b21\u5b8c\u6210 3 \u4ef6'))
assert.ok(successFeedback.summaryText.includes('\u5931\u8d25 1 \u4ef6'))

const idleFeedback = buildKnowledgeRebuildFeedback({
  code: 200,
  data: {
    knowledgeId: 'kb_789',
    inventorySummary: {
      totalWardrobeCount: 6,
      syncableCount: 3,
      readyInKnowledgeCount: 3,
      missingKnowledgeCount: 0,
      missingImageCount: 3
    },
    skipReasonStats: {
      missing_image: 3,
      already_synced: 3
    },
    total: 0,
    skippedCount: 6
  }
})

assert.strictEqual(idleFeedback.status, 'idle')
assert.ok(idleFeedback.summaryText.includes('\u5176\u4e2d\u65e0\u56fe 3 \u4ef6'))

const failedFeedback = buildKnowledgeRebuildFeedback({
  code: 500,
  message: 'rebuild failed',
  error: 'bad request'
})

assert.strictEqual(failedFeedback.status, 'failed')
assert.ok(failedFeedback.summaryText.includes('bad request'))

assert.strictEqual(isCloudFunctionTimeoutError({
  errMsg: 'Error: errCode: -504003 | errMsg: Invoking task timed out after 3 seconds'
}), true)

assert.strictEqual(isCloudFunctionTimeoutError({
  errMsg: 'network error'
}), false)

console.log('knowledge-rebuild-feedback.test.js passed')
