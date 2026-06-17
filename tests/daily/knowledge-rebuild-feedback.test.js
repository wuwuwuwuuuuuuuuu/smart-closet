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
    readyVectorCount: 3,
    missingVectorCount: 3,
    missingImageCount: 3
  }),
  '衣橱 6 件 / 可同步 3 件 / 已有向量 3 件 / 缺失向量 3 件（其中无图 3 件）'
)

const pendingFeedback = buildKnowledgeRebuildFeedback({
  code: 200,
  data: {
    requestMode: 'normal',
    inventorySummary: {
      totalWardrobeCount: 6,
      syncableCount: 3,
      readyVectorCount: 2,
      missingVectorCount: 1,
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
assert.strictEqual(pendingFeedback.title, '向量补同步已发起')
assert.ok(!pendingFeedback.summaryText.includes('知识库'))
assert.ok(pendingFeedback.summaryText.includes('已有向量 2 件'))

const successFeedback = buildKnowledgeRebuildFeedback({
  code: 200,
  data: {
    requestMode: 'forceResync',
    inventorySummary: {
      totalWardrobeCount: 6,
      syncableCount: 3,
      readyVectorCount: 3,
      missingVectorCount: 0,
      missingImageCount: 3
    },
    readyCount: 1,
    syncedCount: 2,
    failedCount: 1,
    skippedCount: 3
  }
})

assert.strictEqual(successFeedback.status, 'success')
assert.strictEqual(successFeedback.title, '强制重建向量完成')
assert.ok(successFeedback.summaryText.includes('生成/更新向量 3 件'))
assert.ok(successFeedback.summaryText.includes('失败 1 件'))
assert.ok(!successFeedback.summaryText.includes('知识库'))

const idleFeedback = buildKnowledgeRebuildFeedback({
  code: 200,
  data: {
    inventorySummary: {
      totalWardrobeCount: 6,
      syncableCount: 3,
      readyVectorCount: 3,
      missingVectorCount: 0,
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
assert.ok(idleFeedback.summaryText.includes('无图 3 件'))
assert.ok(!idleFeedback.summaryText.includes('知识库'))

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
