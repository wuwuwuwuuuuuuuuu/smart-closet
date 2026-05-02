const assert = require('assert')
const {
  buildVectorSyncStatsSummary,
  buildRebuildStatsSummary,
  buildVectorDoc
} = require('../../cloudfunctions/rebuildUserKnowledgeBase/rebuild.helpers')

const summary = buildVectorSyncStatsSummary({
  total: 3,
  readyCount: 2,
  failedCount: 1,
  skippedCount: 0
})

assert.strictEqual(summary.status, 'partial_success')
assert.ok(summary.text.includes('成功生成向量 2 件'))
assert.ok(summary.text.includes('失败 1 件'))
assert.strictEqual(buildRebuildStatsSummary({ readyCount: 1 }).status, 'success')

const doc = buildVectorDoc({
  openid: 'o1',
  userId: 'u1',
  clothing: { _id: 'c1', category: '上衣', season: '春秋', tags: ['通勤'], name: '白衬衫' },
  imageFileId: 'cloud://img',
  vector: [0.1, 0.2, 0.3],
  syncSource: 'single_clothing_auto'
})
assert.strictEqual(doc.vector_dim, 3)
assert.strictEqual(doc.clothing_id, 'c1')
assert.strictEqual(doc.sync_source, 'single_clothing_auto')
assert.throws(() => buildVectorDoc({ vector: [0.1, NaN], clothing: {} }), /invalid vector/)

console.log('rebuild-summary.test.js passed')
