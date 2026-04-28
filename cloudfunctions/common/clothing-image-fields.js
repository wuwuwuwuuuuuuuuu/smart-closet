function normalizeImageField(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildImageKnowledgeFields({ image, originalImage, previousImage } = {}) {
  const primaryImage = normalizeImageField(image) || normalizeImageField(originalImage)
  const normalizedOriginalImage = normalizeImageField(originalImage) || primaryImage
  const normalizedPreviousImage = normalizeImageField(previousImage)
  const imageChanged = Boolean(normalizedPreviousImage && primaryImage && normalizedPreviousImage !== primaryImage)

  return {
    primaryImage,
    originalImage: normalizedOriginalImage,
    imageChanged,
    status: primaryImage ? 'pending' : 'skipped_no_image'
  }
}

module.exports = { buildImageKnowledgeFields }
