const assert = require('assert')

function loadImageUtils(wxMock) {
  global.wx = wxMock
  const modulePath = require.resolve('../../utils/outfitImage')
  delete require.cache[modulePath]
  return require(modulePath)
}

async function run() {
  {
    let previewOptions
    const utils = loadImageUtils({
      cloud: {
        async getTempFileURL() {
          return { fileList: [{ tempFileURL: 'https://example.com/cloud.png' }] }
        }
      },
      previewImage(options) {
        previewOptions = options
        options.success({})
      }
    })
    await utils.previewOutfitImage('cloud://env/file.png')
    assert.strictEqual(previewOptions.current, 'https://example.com/cloud.png')
    assert.deepStrictEqual(previewOptions.urls, ['https://example.com/cloud.png'])
  }

  {
    let savedPath = ''
    const utils = loadImageUtils({
      downloadFile(options) {
        options.success({ statusCode: 200, tempFilePath: 'wxfile://download.png' })
      },
      getSetting(options) {
        options.success({ authSetting: { 'scope.writePhotosAlbum': true } })
      },
      saveImageToPhotosAlbum(options) {
        savedPath = options.filePath
        options.success({})
      }
    })
    const path = await utils.saveOutfitImageToAlbum('https://example.com/outfit.png')
    assert.strictEqual(path, 'wxfile://download.png')
    assert.strictEqual(savedPath, 'wxfile://download.png')
  }

  {
    const utils = loadImageUtils({
      getImageInfo(options) {
        options.success({ path: 'wxfile://local-resource.png' })
      },
      getSetting(options) {
        options.success({ authSetting: {} })
      },
      authorize(options) {
        options.fail({ errMsg: 'authorize:fail auth deny' })
      },
      showModal(options) {
        options.success({ confirm: false, cancel: true })
      }
    })
    await assert.rejects(
      () => utils.saveOutfitImageToAlbum('/images/img1.png'),
      error => error.code === 'ALBUM_PERMISSION_DENIED'
    )
  }

  {
    let uploadCount = 0
    const utils = loadImageUtils({
      downloadFile(options) {
        options.success({ statusCode: 200, tempFilePath: 'wxfile://result.png' })
      },
      cloud: {
        uploadFile(options) {
          uploadCount += 1
          return Promise.resolve({ fileID: 'cloud://env/permanent.png' })
        }
      }
    })
    const first = await utils.ensureOutfitImageFileID('https://example.com/result.png')
    const second = await utils.ensureOutfitImageFileID('https://example.com/result.png')
    assert.strictEqual(first, 'cloud://env/permanent.png')
    assert.strictEqual(second, first)
    assert.strictEqual(uploadCount, 1)
    assert.strictEqual(
      await utils.ensureOutfitImageFileID('cloud://env/existing.png'),
      'cloud://env/existing.png'
    )
  }

  console.log('outfit-image.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
