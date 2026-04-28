const assert = require('assert')
const {
  parseStructuredRecommendation
} = require('../../cloudfunctions/smartRecommendPhoto/utils/recommendation-parser')

const parsed = parseStructuredRecommendation(
  '以下是推荐结果：{"summary":"ok","replyText":"已完成","outfitLines":["上装：白衬衫"],"tips":["注意保暖"],"selectedPhotoUrls":["u1","u2","u1","u404"]}',
  [
    { photoUrl: 'u1' },
    { photoUrl: 'u2' }
  ]
)

assert.strictEqual(parsed.summary, 'ok')
assert.strictEqual(parsed.replyText, '已完成')
assert.deepStrictEqual(parsed.outfitLines, ['上装：白衬衫'])
assert.deepStrictEqual(parsed.tips, ['注意保暖'])
assert.deepStrictEqual(parsed.selectedPhotoUrls, ['u1', 'u2'])

assert.throws(() => parseStructuredRecommendation('无有效 JSON', [{ photoUrl: 'u1' }]), /JSON/)

console.log('recommendation-parser.test.js passed')
