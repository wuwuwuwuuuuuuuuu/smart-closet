function callOutfitFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success(res) {
        const result = res && res.result
        if (!result || typeof result !== 'object') {
          reject(new Error('云函数返回格式异常'))
          return
        }
        resolve({
          code: Number(result.code) || 500,
          message: result.message || '云函数调用失败',
          data: result.data || {}
        })
      },
      fail(error) {
        reject(new Error(
          error && error.errMsg
            ? `云函数调用失败：${error.errMsg}`
            : '云函数调用失败，请稍后重试'
        ))
      }
    })
  })
}

module.exports = {
  getTodayOutfits() {
    return callOutfitFunction('getTodayOutfits')
  },
  getOutfitHistory(options = {}) {
    return callOutfitFunction('getOutfitHistory', {
      dateKey: options.dateKey
    })
  },
  saveOutfitRecord(data = {}) {
    if (
      typeof data.outfitImageFileID !== 'string'
      || !data.outfitImageFileID.startsWith('cloud://')
    ) {
      return Promise.resolve({
        code: 400,
        message: '正式保存需要cloud://图片文件ID',
        data: { reason: 'CLOUD_FILE_ID_REQUIRED' }
      })
    }
    return callOutfitFunction('saveOutfitRecord', {
      outfitImageFileID: data.outfitImageFileID,
      clothingIds: data.clothingIds,
      requestId: data.requestId
    })
  },
  deleteTodayOutfit(outfitId) {
    return callOutfitFunction('deleteTodayOutfit', { outfitId })
  },
  callOutfitFunction
}
