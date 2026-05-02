const bailianKnowledgeProvider = require('./bailian-knowledge-provider')

function getKnowledgeProvider(providerName = 'bailian') {
  const normalized = typeof providerName === 'string' ? providerName.trim().toLowerCase() : 'bailian'

  if (!normalized || normalized === 'bailian') {
    return bailianKnowledgeProvider
  }

  throw new Error(`unsupported knowledge provider: ${providerName}`)
}

module.exports = {
  getKnowledgeProvider
}
