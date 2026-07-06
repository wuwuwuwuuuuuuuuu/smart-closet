const crypto = require('crypto')

function hashParts(parts) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(parts.map(String)), 'utf8')
    .digest('hex')
}

function buildUsageDocumentId(openid, clothingId, dateKey) {
  return `cu_${hashParts([openid, clothingId, dateKey])}`
}

module.exports = { buildUsageDocumentId }
