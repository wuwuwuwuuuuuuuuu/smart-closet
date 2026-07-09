class OutfitImageError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'OutfitImageError'
    this.code = code
  }
}

const cloudUploadCache = new Map()

function callWx(method, options = {}) {
  return new Promise((resolve, reject) => {
    wx[method]({
      ...options,
      success: resolve,
      fail: reject
    })
  })
}

async function resolveDisplayImage(source) {
  if (!source || typeof source !== 'string') {
    throw new OutfitImageError('穿搭图片地址无效', 'INVALID_IMAGE_SOURCE')
  }
  if (!source.startsWith('cloud://')) return source

  try {
    const result = await wx.cloud.getTempFileURL({ fileList: [source] })
    const file = result.fileList && result.fileList[0]
    if (!file || !file.tempFileURL) throw new Error(file && file.errMsg)
    return file.tempFileURL
  } catch (error) {
    throw new OutfitImageError('云端图片加载失败，请稍后重试', 'CLOUD_IMAGE_FAILED')
  }
}

async function getSavableLocalPath(source) {
  const displaySource = await resolveDisplayImage(source)

  if (/^https?:\/\//i.test(displaySource)) {
    try {
      const result = await callWx('downloadFile', { url: displaySource })
      if (result.statusCode && result.statusCode !== 200) {
        throw new Error(`HTTP ${result.statusCode}`)
      }
      return result.tempFilePath
    } catch (error) {
      throw new OutfitImageError('图片下载失败，请检查网络后重试', 'DOWNLOAD_FAILED')
    }
  }

  try {
    const result = await callWx('getImageInfo', { src: displaySource })
    return result.path || displaySource
  } catch (error) {
    if (/^(wxfile|file):\/\//i.test(displaySource)) return displaySource
    throw new OutfitImageError('图片读取失败，请稍后重试', 'LOCAL_IMAGE_FAILED')
  }
}

async function ensureAlbumPermission() {
  const setting = await callWx('getSetting')
  if (setting.authSetting && setting.authSetting['scope.writePhotosAlbum'] === true) {
    return true
  }

  try {
    await callWx('authorize', { scope: 'scope.writePhotosAlbum' })
    return true
  } catch (error) {
    const modal = await callWx('showModal', {
      title: '需要相册权限',
      content: '请在设置中允许保存到相册，授权后即可保存穿搭图片。',
      confirmText: '去设置',
      cancelText: '暂不'
    })
    if (!modal.confirm) {
      throw new OutfitImageError('未获得相册权限，无法保存图片', 'ALBUM_PERMISSION_DENIED')
    }

    const opened = await callWx('openSetting')
    if (!opened.authSetting || opened.authSetting['scope.writePhotosAlbum'] !== true) {
      throw new OutfitImageError('相册权限仍未开启', 'ALBUM_PERMISSION_DENIED')
    }
    return true
  }
}

async function previewOutfitImage(source) {
  const displaySource = await resolveDisplayImage(source)
  await callWx('previewImage', {
    current: displaySource,
    urls: [displaySource]
  })
}

async function saveOutfitImageToAlbum(source) {
  const localPath = await getSavableLocalPath(source)
  await ensureAlbumPermission()
  try {
    await callWx('saveImageToPhotosAlbum', { filePath: localPath })
  } catch (error) {
    throw new OutfitImageError('保存图片失败，请稍后重试', 'SAVE_ALBUM_FAILED')
  }
  return localPath
}

async function ensureOutfitImageFileID(source) {
  if (typeof source !== 'string' || !source.trim()) {
    throw new OutfitImageError('当前没有可保存的穿搭图片', 'INVALID_IMAGE_SOURCE')
  }
  const normalized = source.trim()
  if (normalized.startsWith('cloud://')) return normalized
  if (cloudUploadCache.has(normalized)) return cloudUploadCache.get(normalized)

  const uploadPromise = (async () => {
    const filePath = await getSavableLocalPath(normalized)
    const extensionMatch = filePath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'png'
    try {
      const result = await wx.cloud.uploadFile({
        cloudPath: `outfit_records/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension}`,
        filePath
      })
      if (!result || typeof result.fileID !== 'string' || !result.fileID.startsWith('cloud://')) {
        throw new Error('missing cloud fileID')
      }
      return result.fileID
    } catch (error) {
      throw new OutfitImageError('穿搭图片上传失败，请稍后重试', 'CLOUD_UPLOAD_FAILED')
    }
  })()

  cloudUploadCache.set(normalized, uploadPromise)
  try {
    return await uploadPromise
  } catch (error) {
    cloudUploadCache.delete(normalized)
    throw error
  }
}

module.exports = {
  OutfitImageError,
  resolveDisplayImage,
  getSavableLocalPath,
  ensureAlbumPermission,
  previewOutfitImage,
  saveOutfitImageToAlbum,
  ensureOutfitImageFileID
}
