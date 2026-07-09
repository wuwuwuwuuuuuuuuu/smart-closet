const crypto = require('crypto')

function hashParts(parts) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(parts.map(String)), 'utf8')
    .digest('hex')
}

function buildOutfitDocumentId(openid, dateKey, slot) {
  return `or_${hashParts([openid, dateKey, slot])}`
}

function buildUsageDocumentId(openid, clothingId, dateKey) {
  return `cu_${hashParts([openid, clothingId, dateKey])}`
}

module.exports = { buildOutfitDocumentId, buildUsageDocumentId }
