function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueStringList(list = []) {
  return [...new Set((Array.isArray(list) ? list : [])
    .map(item => normalizeText(item))
    .filter(Boolean))]
}

function collectCloudFileIds(clothing = {}) {
  return uniqueStringList([clothing.image, clothing.originalImage])
    .filter(fileId => /^cloud:\/\//i.test(fileId))
}

module.exports = {
  normalizeText,
  uniqueStringList,
  collectCloudFileIds
}
