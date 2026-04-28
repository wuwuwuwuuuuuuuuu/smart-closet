const assert = require('assert')

process.env.ALIBABA_CLOUD_ACCESS_KEY_ID = 'ak-test'
process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET = 'sk-test'
process.env.WORKSPACE_ID = 'ws-test'
process.env.DASHSCOPE_API_KEY = 'dash-test'
process.env.BAILIAN_REGION_ID = 'cn-beijing'
process.env.DASHSCOPE_RESPONSE_MODEL = 'qwen3.5-flash'

const {
  getBailianConfig,
  getMissingConfigFields,
  hasValidBailianConfig,
  buildDefaultManagementEndpoint,
  supportsFileSearchModel
} = require('../../cloudfunctions/smartRecommendPhoto/utils/bailian-config')

const config = getBailianConfig()
assert.strictEqual(config.accessKeyId, 'ak-test')
assert.strictEqual(config.workspaceId, 'ws-test')
assert.strictEqual(config.responseModel, 'qwen3.5-flash')
assert.strictEqual(config.managementEndpoint, 'bailian.cn-beijing.aliyuncs.com')
assert.strictEqual(config.responseTimeoutMs, 60000)
assert.strictEqual(config.maxResults, 3)
assert.strictEqual(buildDefaultManagementEndpoint('ap-southeast-1'), 'bailian.ap-southeast-1.aliyuncs.com')
assert.strictEqual(supportsFileSearchModel('qwen3.6-plus'), true)
assert.strictEqual(supportsFileSearchModel('qwen3.5-flash'), true)
assert.strictEqual(supportsFileSearchModel('qwen-plus-latest'), false)
assert.deepStrictEqual(getMissingConfigFields(config), [])
assert.strictEqual(hasValidBailianConfig(config), true)

console.log('bailian-config.test.js passed')
