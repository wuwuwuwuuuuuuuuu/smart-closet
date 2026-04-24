const { logWarning } = require('./logger')

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function normalizeScore(value) {
  const score = normalizeNumber(value, 0)
  return score >= 0 ? score : 0
}

function extractResponseOutputText(raw = {}) {
  if (normalizeText(raw.output_text)) {
    return normalizeText(raw.output_text)
  }

  const output = Array.isArray(raw.output) ? raw.output : []
  for (let index = 0; index < output.length; index += 1) {
    const item = output[index]
    const content = Array.isArray(item && item.content) ? item.content : []
    for (let contentIndex = 0; contentIndex < content.length; contentIndex += 1) {
      const block = content[contentIndex]
      if (normalizeText(block && block.text)) {
        return normalizeText(block.text)
      }
      if (normalizeText(block && block.output_text)) {
        return normalizeText(block.output_text)
      }
    }
  }

  return ''
}

function isRetrievalHitCandidate(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return false
  }

  const hasIdLikeField = [
    item.docId,
    item.doc_id,
    item.documentId,
    item.document_id,
    item.fileId,
    item.file_id,
    item.fileName,
    item.file_name,
    item.filename
  ].some(value => normalizeText(value))

  const hasSnippetLikeField = [
    item.snippet,
    item.chunk_text,
    item.chunkText,
    item.summary
  ].some(value => normalizeText(value))

  const hasScoredText = Boolean(normalizeText(item.text) && (normalizeText(item.fileName) || normalizeText(item.filename) || item.score !== undefined))

  return hasIdLikeField || hasSnippetLikeField || hasScoredText
}

function collectHitCandidates(node, bucket = [], seen = new Set(), depth = 0) {
  if (!node || depth > 8) {
    return bucket
  }

  if (typeof node !== 'object') {
    return bucket
  }

  if (seen.has(node)) {
    return bucket
  }
  seen.add(node)

  if (Array.isArray(node)) {
    if (node.some(isRetrievalHitCandidate)) {
      node.forEach(item => {
        if (isRetrievalHitCandidate(item)) {
          bucket.push(item)
        }
      })
      return bucket
    }

    node.forEach(item => collectHitCandidates(item, bucket, seen, depth + 1))
    return bucket
  }

  if (normalizeText(node.type) === 'file_search_call' && Array.isArray(node.results)) {
    node.results.forEach(item => {
      if (isRetrievalHitCandidate(item)) {
        bucket.push(item)
      }
    })
  }

  Object.keys(node).forEach(key => {
    collectHitCandidates(node[key], bucket, seen, depth + 1)
  })

  return bucket
}

function extractTextCandidate(hit = {}) {
  return [
    normalizeText(hit.snippet),
    normalizeText(hit.text),
    normalizeText(hit.content),
    normalizeText(hit.chunk_text),
    normalizeText(hit.chunkText),
    normalizeText(hit.summary)
  ].find(Boolean) || ''
}

function extractFileName(hit = {}) {
  return [
    normalizeText(hit.fileName),
    normalizeText(hit.file_name),
    normalizeText(hit.filename),
    normalizeText(hit.metadata && hit.metadata.fileName),
    normalizeText(hit.metadata && hit.metadata.file_name)
  ].find(Boolean) || ''
}

function extractTitle(hit = {}) {
  return [
    normalizeText(hit.title),
    normalizeText(hit.docName),
    normalizeText(hit.doc_name),
    normalizeText(hit.name)
  ].find(Boolean) || ''
}

function extractDocId(hit = {}) {
  return [
    normalizeText(hit.docId),
    normalizeText(hit.doc_id),
    normalizeText(hit.documentId),
    normalizeText(hit.document_id),
    normalizeText(hit.id)
  ].find(Boolean) || ''
}

function extractFileId(hit = {}) {
  return [
    normalizeText(hit.fileId),
    normalizeText(hit.file_id),
    normalizeText(hit.metadata && hit.metadata.fileId),
    normalizeText(hit.metadata && hit.metadata.file_id)
  ].find(Boolean) || ''
}

function matchClothesIdPattern(value = '') {
  const text = normalizeText(value)
  if (!text) {
    return ''
  }

  const exact = text.match(/^[a-zA-Z0-9_-]{2,64}$/)
  if (exact) {
    return exact[0]
  }

  const embedded = text.match(/\b([a-zA-Z0-9_-]{2,64})\b/)
  return embedded ? embedded[1] : ''
}

function extractClothesIdHint(hit = {}) {
  const metadata = hit.metadata && typeof hit.metadata === 'object' ? hit.metadata : {}
  const directMetadataId = [
    normalizeText(metadata.clothes_id),
    normalizeText(metadata.clothesId),
    normalizeText(metadata.source_id),
    normalizeText(metadata.sourceId)
  ].find(Boolean)
  if (directMetadataId) {
    return directMetadataId
  }

  const fileName = extractFileName(hit)
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const byFileName = matchClothesIdPattern(baseName)
  if (byFileName && byFileName === baseName) {
    return byFileName
  }

  const snippet = extractTextCandidate(hit)
  const snippetMatch = snippet.match(/clothes_id\s*:\s*([a-zA-Z0-9_-]+)/i)
  if (snippetMatch && snippetMatch[1]) {
    return normalizeText(snippetMatch[1])
  }

  const title = extractTitle(hit)
  const titleMatch = title.match(/\b([a-f0-9]{24,32})\b/i)
  if (titleMatch && titleMatch[1]) {
    return normalizeText(titleMatch[1])
  }

  return ''
}

function dedupeHits(hits = []) {
  const seen = new Set()
  return hits.filter(hit => {
    const signature = [
      normalizeText(hit.docId),
      normalizeText(hit.fileId),
      normalizeText(hit.fileName),
      normalizeText(hit.snippet)
    ].join('::')

    if (seen.has(signature)) {
      return false
    }
    seen.add(signature)
    return true
  })
}

function normalizeKnowledgeRetrievalResponse(raw = {}) {
  const hitCandidates = collectHitCandidates(raw)
  const hits = dedupeHits(hitCandidates.map(hit => ({
    docId: extractDocId(hit),
    fileId: extractFileId(hit),
    fileName: extractFileName(hit),
    title: extractTitle(hit),
    snippet: extractTextCandidate(hit),
    score: normalizeScore(
      hit.score
      || hit.relevanceScore
      || hit.relevance_score
      || (hit.metadata && hit.metadata.score)
    ),
    clothesIdHint: extractClothesIdHint(hit)
  })))

  if (!hits.length) {
    logWarning('bailianRetrievalNormalizer.normalizeKnowledgeRetrievalResponse', 'no retrieval hits extracted', {
      hasOutput: Boolean(raw && raw.output),
      hasOutputText: Boolean(normalizeText(raw && raw.output_text))
    })
  }

  return {
    rawResponse: raw,
    rawText: extractResponseOutputText(raw),
    toolType: 'file_search',
    hits
  }
}

module.exports = {
  normalizeText,
  normalizeNumber,
  normalizeScore,
  extractResponseOutputText,
  extractClothesIdHint,
  normalizeKnowledgeRetrievalResponse
}
