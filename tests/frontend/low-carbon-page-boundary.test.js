const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const app = JSON.parse(read('app.json'))
const profileJs = read('pages/profile/profile.js')
const profileWxml = read('pages/profile/profile.wxml')
const lowJs = read('pages/lowCarbon/lowCarbon.js')
const lowWxml = read('pages/lowCarbon/lowCarbon.wxml')
const idleJs = read('pages/idleClothes/idleClothes.js')
const idleWxml = read('pages/idleClothes/idleClothes.wxml')
const homeWxml = read('pages/home/home.wxml')

assert.ok(app.pages.includes('pages/lowCarbon/lowCarbon'))
assert.ok(app.pages.includes('pages/idleClothes/idleClothes'))
assert.deepStrictEqual(app.tabBar.list.map(item => item.pagePath), [
  'pages/home/home',
  'pages/tryon/tryon',
  'pages/forum/forum',
  'pages/profile/profile'
])
assert.match(profileJs, /goToLowCarbon/)
assert.match(profileJs, /\/pages\/lowCarbon\/lowCarbon/)
assert.match(profileWxml, /闲置预警/)
assert.doesNotMatch(profileWxml, /低碳衣橱/)
assert.doesNotMatch(homeWxml, /闲置预警|低碳衣橱|闲置衣物|衣物活跃率/)
assert.strictEqual(JSON.parse(read('pages/lowCarbon/lowCarbon.json')).navigationBarTitleText, '闲置预警')
assert.match(lowWxml, /class="page-title">闲置预警</)
assert.doesNotMatch(lowWxml, /低碳衣橱/)

for (const source of [lowJs, idleJs]) {
  assert.doesNotMatch(source, /wx\.(get|set|remove)StorageSync/)
  assert.doesNotMatch(source, /wx\.cloud\.(database|callFunction)/)
}
assert.match(lowJs, /lowCarbonService\.getLowCarbonSummary/)
assert.match(lowJs, /lowCarbonService\.getLowCarbonPriority/)
assert.match(lowJs, /lowCarbonService\.updateLowCarbonPriority/)
assert.match(lowWxml, /闲置衣物/)
assert.match(lowWxml, /衣物活跃率/)
assert.match(lowWxml, /style="width: \{\{activityRate\}\}%/)
assert.match(lowWxml, /低碳穿搭建议/)
assert.match(lowWxml, /低碳优先推荐/)
assert.doesNotMatch(lowWxml + idleWxml, /碳排放|千克/)
assert.match(idleJs, /\/pages\/clothesDetail\/clothesDetail\?id=/)
assert.doesNotMatch(idleWxml, />删除</)
assert.match(idleWxml, /累计使用 \{\{item\.wearCount\}\} 次/)
assert.match(idleWxml, /最近使用：\{\{item\.lastWornAt\}\}/)
assert.match(idleWxml, /尚未使用/)

console.log('low-carbon-page-boundary.test.js passed')
