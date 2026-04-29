const assert = require('assert')
const fs = require('fs')
const path = require('path')

const entryFiles = [
  path.join(__dirname, '../../cloudfunctions/smartRecommendPhoto/index.js'),
  path.join(__dirname, '../../cloudfunctions/addClothing/index.js'),
  path.join(__dirname, '../../cloudfunctions/updateClothing/index.js')
]

for (const file of entryFiles) {
  const content = fs.readFileSync(file, 'utf8')
  assert(!content.includes('bailian-knowledge-provider'), `${file} should not reference external knowledge provider`)
  assert(!content.includes('knowledge-recommendation-service'), `${file} should not reference knowledge recommendation service`)
  assert(!content.includes('knowledge-sync-service'), `${file} should not reference knowledge sync service`)
  assert(!content.includes('knowledgeSyncStatus'), `${file} should not return legacy knowledge sync status`)
}

console.log('no-external-knowledge-reference.test.js passed')
