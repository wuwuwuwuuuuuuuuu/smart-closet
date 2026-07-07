function getErrorMessage(error) {
  return String(
    error && (error.errMsg || error.message || error.code)
      ? (error.errMsg || error.message || error.code)
      : ''
  )
}

function isDocumentDoesNotExistError(error) {
  const message = getErrorMessage(error)
  return (
    (
      message.includes('document.get:fail') &&
      message.includes('does not exist')
    ) ||
    message.includes('DOCUMENT_NOT_FOUND') ||
    message.includes('document not exists')
  )
}

async function getDocumentOrNull(source, collectionName, documentId) {
  try {
    const result = await source
      .collection(collectionName)
      .doc(documentId)
      .get()

    return result && result.data ? result.data : null
  } catch (error) {
    if (isDocumentDoesNotExistError(error)) {
      return null
    }

    throw error
  }
}

module.exports = {
  getDocumentOrNull,
  isDocumentDoesNotExistError
}
