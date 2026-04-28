const assert = require('assert')
const { buildRebuildStatsSummary } = require('../../cloudfunctions/rebuildUserKnowledgeBase/rebuild.helpers')

const summary = buildRebuildStatsSummary({
  total: 3,
  readyCount: 2,
  failedCount: 1,
  skippedCount: 0
})

assert.strictEqual(summary.status, 'partial_success')
assert.ok(summary.text.includes('成功 2 件'))
assert.ok(summary.text.includes('失败 1 件'))

console.log('rebuild-summary.test.js passed')
