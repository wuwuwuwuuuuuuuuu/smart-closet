const { logWarning } = require('./logger')

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeFileNameToId(fileName = '') {
  return normalizeText(fileName).replace(/\.[^.]+$/, '')
}

function buildLookupMaps(clothesList = []) {
  const byId = new Map()
  const byDocId = new Map()
  const byFileId = new Map()

  if (!Array.isArray(clothesList)) {
    logWarning('knowledgeResultMapper.buildLookupMaps', 'invalid clothesList', {
      clothesListType: typeof clothesList
    })
    return { byId, byDocId, byFileId }
  }

  clothesList.forEach(item => {
    const id = normalizeText(item && item._id)
    const docId = normalizeText(item && (item.bailian_doc_id || item.knowledge_doc_id))
    const fileId = normalizeText(item && item.bailian_file_id)

    if (id) {
      byId.set(id, item)
    }
    if (docId) {
      byDocId.set(docId, item)
    }
    if (fileId) {
      byFileId.set(fileId, item)
    }
  })

  return { byId, byDocId, byFileId }
}

function resolveMatchedClothesFromRetrieval({ clothesList = [], aiPayload = {} } = {}) {
  const { byId, byDocId, byFileId } = buildLookupMaps(clothesList)
  const selectedClothesIds = Array.isArray(aiPayload && aiPayload.selectedClothesIds)
    ? aiPayload.selectedClothesIds
    : []
  const retrievalItems = Array.isArray(aiPayload && aiPayload.retrievalItems)
    ? aiPayload.retrievalItems
    : []

  if (aiPayload && aiPayload.retrievalItems !== undefined && !Array.isArray(aiPayload.retrievalItems)) {
    logWarning('knowledgeResultMapper.resolveMatchedClothesFromRetrieval', 'invalid retrievalItems', {
      retrievalItemsType: typeof aiPayload.retrievalItems
    })
  }

  const result = []
  const unresolvedHits = []

  function pushUnique(item, reason, value) {
    if (!item) {
      if (normalizeText(value)) {
        unresolvedHits.push({ reason, value: normalizeText(value) })
      }
      return
    }

    const itemId = normalizeText(item._id)
    if (!itemId) {
      return
    }

    if (!result.some(current => normalizeText(current && current._id) === itemId)) {
      result.push(item)
    }
  }

  selectedClothesIds.forEach(id => {
    pushUnique(byId.get(normalizeText(id)), 'selectedClothesIds', id)
  })

  retrievalItems.forEach(hit => {
    const docId = normalizeText(hit && hit.docId)
    const fileId = normalizeText(hit && hit.fileId)
    const clothesIdHint = normalizeText(hit && hit.clothesIdHint)
    const fileNameId = normalizeFileNameToId(hit && hit.fileName)

    if (docId) {
      pushUnique(byDocId.get(docId), 'docId', docId)
    }
    if (fileId) {
      pushUnique(byFileId.get(fileId), 'fileId', fileId)
    }
    if (clothesIdHint) {
      pushUnique(byId.get(clothesIdHint), 'clothesIdHint', clothesIdHint)
    }
    if (fileNameId) {
      pushUnique(byId.get(fileNameId), 'fileName', fileNameId)
    }
  })

  return {
    matchedClothes: result,
    unresolvedCount: unresolvedHits.length,
    unresolvedHits
  }
}

module.exports = {
  normalizeFileNameToId,
  resolveMatchedClothesFromRetrieval
}
