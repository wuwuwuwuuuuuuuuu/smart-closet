const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

const appConfig = JSON.parse(read('app.json'))
assert.ok(appConfig.pages.includes('pages/todayOutfit/todayOutfit'))
assert.deepStrictEqual(appConfig.tabBar.list.map(item => item.pagePath), [
  'pages/home/home',
  'pages/tryon/tryon',
  'pages/forum/forum',
  'pages/profile/profile'
])

const homeJs = read('pages/home/home.js')
const homeWxml = read('pages/home/home.wxml')
assert.match(homeJs, /goToTodayOutfit/)
assert.match(homeJs, /\/pages\/todayOutfit\/todayOutfit/)
assert.match(homeJs, /goToDaily/)
assert.match(homeJs, /\/pages\/daily\/daily/)
assert.match(homeWxml, /今日穿搭/)
assert.match(homeWxml, /智能推荐/)
assert.match(homeWxml, /服饰上传/)
assert.match(homeWxml, /AI试穿/)

const pageJs = read('pages/todayOutfit/todayOutfit.js')
const pageWxml = read('pages/todayOutfit/todayOutfit.wxml')
const pageWxss = read('pages/todayOutfit/todayOutfit.wxss')
assert.match(pageJs, /outfitService\.getTodayOutfits\(\)/)
assert.match(pageJs, /outfitService\.deleteTodayOutfit\(outfit\._id\)/)
assert.match(pageJs, /wx\.showModal/)
assert.match(pageJs, /wx\.switchTab/)
assert.doesNotMatch(pageJs, /wx\.cloud\.database/)
assert.doesNotMatch(pageJs, /wx\.(get|set|remove)StorageSync/)
assert.match(pageWxml, /wx:for="\{\{outfits\}\}"/)
assert.match(pageWxml, /今日还没有记录穿搭/)
assert.match(pageWxml, /查看历史穿搭/)
assert.doesNotMatch(pageWxml, /位置\s*\{\{|slot\s*\{\{|第\s*\{\{/)
assert.doesNotMatch(pageWxml, /今日穿搭\{\{item\.slot\}\}/)
assert.doesNotMatch(pageWxml, /\{\{item\.dateKey\}\}/)
assert.match(pageWxml, /count-\{\{count\}\}/)
assert.doesNotMatch(pageWxml, /bindtap="returnToPreview"/)
assert.match(pageWxss, /\.outfit-list\.count-1 \.outfit-card/)
assert.match(pageWxss, /width:\s*88%/)
assert.match(pageWxss, /width:\s*calc\(50% - 10rpx\)/)

const serviceEntry = read('services/outfitService.js')
assert.match(serviceEntry, /const USE_MOCK_OUTFIT = true/)
assert.match(serviceEntry, /isUsingMock:\s*\(\)\s*=>\s*USE_MOCK_OUTFIT/)

console.log('outfit-page-boundary.test.js passed')
