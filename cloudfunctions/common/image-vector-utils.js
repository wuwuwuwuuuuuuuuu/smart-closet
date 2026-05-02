function isValidVector(vector) {
  return Array.isArray(vector)
    && vector.length > 0
    && vector.every(item => typeof item === 'number' && Number.isFinite(item))
}

function cosineSimilarity(a, b) {
  if (!isValidVector(a) || !isValidVector(b)) {
    throw new Error('invalid vector for cosine similarity')
  }

  if (a.length !== b.length) {
    throw new Error('vector dimension mismatch')
  }

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) {
    throw new Error('zero norm vector')
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function normalizeTopK(topK, fallback = 8) {
  const parsed = Number(topK)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.floor(parsed)
}

function pickTopKBySimilarity({ queryVector, items = [], topK = 8 }) {
  if (!isValidVector(queryVector)) {
    throw new Error('invalid query vector')
  }

  const safeItems = Array.isArray(items) ? items : []
  const safeTopK = normalizeTopK(topK)

  return safeItems
    .filter(item => item && isValidVector(item.vector) && item.vector.length === queryVector.length)
    .map(item => ({
      ...item,
      score: cosineSimilarity(queryVector, item.vector)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, safeTopK)
}

function summarizeVectorDocs(vectorDocs = [], queryVector = []) {
  const docs = Array.isArray(vectorDocs) ? vectorDocs : []
  const queryDim = Array.isArray(queryVector) ? queryVector.length : 0
  const sameDimCount = docs.filter(doc => Array.isArray(doc && doc.vector) && doc.vector.length === queryDim).length
  return {
    queryDim,
    total: docs.length,
    sameDimCount,
    skippedByDimCount: Math.max(0, docs.length - sameDimCount)
  }
}

module.exports = {
  isValidVector,
  cosineSimilarity,
  pickTopKBySimilarity,
  summarizeVectorDocs
}
