const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const names = [
  'saveOutfitRecord',
  'getTodayOutfits',
  'deleteTodayOutfit',
  'getOutfitHistory',
  'expireOutfitDetails'
]

names.forEach(name => {
  const functionRoot = path.join(root, 'cloudfunctions', name)
  assert.ok(fs.existsSync(path.join(functionRoot, 'index.js')))
  assert.ok(fs.existsSync(path.join(functionRoot, 'package-lock.json')))
  const sdk = require(path.join(functionRoot, 'node_modules/wx-server-sdk/package.json'))
  const database = require(path.join(functionRoot, 'node_modules/@cloudbase/database/package.json'))
  assert.strictEqual(sdk.version, '2.6.3')
  assert.strictEqual(database.version, '1.4.1')
})

const sdkSource = fs.readFileSync(
  path.join(root, 'cloudfunctions/saveOutfitRecord/node_modules/wx-server-sdk/index.js'),
  'utf8'
)
assert.match(sdkSource, /async function runTransaction\(callback, times = 3\)/)

for (const name of ['saveOutfitRecord', 'deleteTodayOutfit']) {
  const source = fs.readFileSync(path.join(root, 'cloudfunctions', name, 'index.js'), 'utf8')
  source.split(/\r?\n/)
    .filter(line => line.includes('transaction.collection('))
    .forEach(line => assert.ok(line.includes('.doc('), line))
  assert.doesNotMatch(source, /transaction\.collection\([^)]*\)\s*\.(where|orderBy|skip|limit|count)\(/s)
  assert.match(source, /\}, 5\)/)
}

const expireSource = fs.readFileSync(
  path.join(root, 'cloudfunctions/expireOutfitDetails/index.js'),
  'utf8'
)
assert.doesNotMatch(expireSource, /clothingUsage|wearCount|lastWornAt|\.remove\(/)

console.log('cloudbase-sdk-layout.test.js passed')
