const assert = require('assert')
const { normalizeInput } = require('../../pages/daily/daily.helpers')

assert.strictEqual(normalizeInput('  明天上班穿什么  '), '明天上班穿什么')
assert.strictEqual(normalizeInput(null), '')
