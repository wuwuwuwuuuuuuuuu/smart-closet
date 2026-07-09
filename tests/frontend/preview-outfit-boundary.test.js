const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const previewJs = fs.readFileSync(
  path.join(root, 'pages/preview/preview.js'),
  'utf8'
)
const previewWxml = fs.readFileSync(
  path.join(root, 'pages/preview/preview.wxml'),
  'utf8'
)
const tryonJs = fs.readFileSync(
  path.join(root, 'pages/tryon/tryon.js'),
  'utf8'
)
const dailyJs = fs.readFileSync(
  path.join(root, 'pages/daily/daily.js'),
  'utf8'
)

assert.match(tryonJs, /buildTryonContextData/)
assert.match(tryonJs, /setCurrentTryonContext/)
assert.match(tryonJs, /resultImage:\s*finalImageUrl/)
assert.ok(
  tryonJs.indexOf('setCurrentTryonContext({')
  < tryonJs.indexOf("wx.navigateTo({\n          url: `/pages/preview/preview")
)

assert.match(previewJs, /outfitService\.saveOutfitRecord\(\{/)
assert.match(previewJs, /outfitImageFileID,\s*\n/)
assert.match(previewJs, /ensureOutfitImageFileID\(currentDisplayImage\)/)
assert.match(previewJs, /outfitService\.isUsingMock\(\)/)
assert.match(previewJs, /currentDisplayImage\s*=\s*this\.data\.displayImage/)
assert.match(previewJs, /DAILY_OUTFIT_LIMIT_REACHED/)
assert.match(previewJs, /\/pages\/todayOutfit\/todayOutfit/)
assert.match(previewJs, /content:\s*'已保存3套穿搭，是否前往删除一套后再保存？'/)
assert.match(previewJs, /confirmText:\s*'去删除'/)
assert.match(previewJs, /url:\s*'\/pages\/todayOutfit\/todayOutfit'/)
assert.match(previewJs, /当前穿搭未关联衣橱衣物/)
assert.match(previewJs, /确认保存当前穿搭吗？/)
assert.doesNotMatch(previewJs, /本次穿搭关联了.*件衣橱衣物/)
assert.doesNotMatch(previewJs, /mock_outfit_records_v1/)
assert.doesNotMatch(previewJs, /current_tryon_context_v1/)
assert.match(previewWxml, /保存今日穿搭/)
assert.match(previewWxml, /已保存今日穿搭/)

assert.match(dailyJs, /selectedClothesIds:\s*result\.selectedClothesIds/)

console.log('preview-outfit-boundary.test.js passed')
