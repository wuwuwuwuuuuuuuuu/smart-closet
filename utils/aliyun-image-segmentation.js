// 闃块噷浜慏ashScope鍥惧儚鍒嗗壊宸ュ叿绫?
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/vision/image-process/process'
const DASHSCOPE_API_KEY = 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY'

class AliyunImageSegmentation {
  
  /**
   * 琛ｇ墿鍥惧儚鍒嗗壊
   * @param {string} imageUrl - 鍥惧儚URL鎴朆ase64鏁版嵁
   * @param {Array} clothesTypes - 琛ｇ墿绫诲瀷鏁扮粍锛屽 ['upper', 'lower', 'dress']
   * @returns {Promise} 鍒嗗壊缁撴灉
   */
  static async segmentClothing(imageUrl, clothesTypes = ['upper']) {
    try {
      console.log('寮€濮嬭皟鐢ㄩ樋閲屼簯API锛屽浘鐗嘦RL:', imageUrl)
      
      // 鏋勫缓璇锋眰鏁版嵁 - 鏍规嵁闃块噷浜戝畼鏂规枃妗ｆ牸寮?
      const requestData = {
        model: 'aitryon-parsing-v1',
        input: {
          image_url: imageUrl
        },
        parameters: {
          clothes_type: clothesTypes
        }
      }

      console.log('璇锋眰鏁版嵁:', JSON.stringify(requestData))

      // 璋冪敤闃块噷浜慏ashScope API
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: DASHSCOPE_API_URL,
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
          },
          data: JSON.stringify(requestData),
          timeout: 60000, // 澧炲姞瓒呮椂鏃堕棿
          success: (res) => {
            console.log('API鍝嶅簲鐘舵€?', res.statusCode)
            console.log('API鍝嶅簲鏁版嵁:', res.data)
            resolve(res)
          },
          fail: (err) => {
            console.error('API璇锋眰澶辫触:', err)
            reject(err)
          }
        })
      })

      // 妫€鏌ュ搷搴旂姸鎬?
      if (response.statusCode !== 200) {
        console.error('API璋冪敤澶辫触璇︽儏:', response)
        throw new Error(`API璋冪敤澶辫触: ${response.statusCode} - ${JSON.stringify(response.data)}`)
      }

      const result = response.data
      console.log('API璋冪敤鎴愬姛锛岀粨鏋?', result)
      
      // 瑙ｆ瀽鍒嗗壊缁撴灉
      if (result && (result.output || result.data)) {
        const output = result.output || result.data
        
        // 澶勭悊杩斿洖鐨勫浘鐗嘦RL锛岀‘淇濅娇鐢℉TTPS
        if (output.parsing_img_url && Array.isArray(output.parsing_img_url) && output.parsing_img_url.length > 0) {
          const parsingUrl = output.parsing_img_url[0]
          if (parsingUrl && parsingUrl !== 'null' && parsingUrl !== 'None') {
            // 寮哄埗灏咹TTP杞负HTTPS锛岄伩鍏嶅井淇″皬绋嬪簭鎷︽埅
            output.parsing_img_url[0] = parsingUrl.replace("http://", "https://")
            console.log('鏇存柊鍒嗗壊鍥剧墖URL涓篐TTPS:', output.parsing_img_url[0])
          }
        }
        
        if (output.crop_img_url && Array.isArray(output.crop_img_url) && output.crop_img_url.length > 0) {
          const cropUrl = output.crop_img_url[0]
          if (cropUrl && cropUrl !== 'null' && cropUrl !== 'None') {
            // 寮哄埗灏咹TTP杞负HTTPS锛岄伩鍏嶅井淇″皬绋嬪簭鎷︽埅
            output.crop_img_url[0] = cropUrl.replace("http://", "https://")
            console.log('鏇存柊瑁佸壀鍥剧墖URL涓篐TTPS:', output.crop_img_url[0])
          }
        }
        
        return {
          success: true,
          data: output,
          message: '琛ｇ墿鍒嗗壊鎴愬姛'
        }
      } else {
        throw new Error('鍒嗗壊缁撴灉瑙ｆ瀽澶辫触: ' + JSON.stringify(result))
      }

    } catch (error) {
      console.error('闃块噷浜戝浘鍍忓垎鍓插け璐?', error)
      return {
        success: false,
        error: error.message,
        message: '琛ｇ墿鍒嗗壊澶辫触'
      }
    }
  }

  /**
   * 浠庢湰鍦版枃浠惰矾寰勮繘琛岃。鐗╁垎鍓?
   * @param {string} filePath - 鏈湴鏂囦欢璺緞
   * @param {Array} clothesTypes - 琛ｇ墿绫诲瀷
   * @returns {Promise} 鍒嗗壊缁撴灉
   */
  static async segmentClothingFromLocal(filePath, clothesTypes = ['upper']) {
    try {
      console.log('寮€濮嬪鐞嗘湰鍦板浘鐗?', filePath)
      
      // 鍏堝皢鏈湴鍥剧墖涓婁紶鍒颁簯绔幏鍙朥RL
      const cloudFileID = await this.uploadImageToCloud(filePath)
      
      if (!cloudFileID) {
        throw new Error('鍥剧墖涓婁紶鍒颁簯绔け璐?)
      }

      console.log('浜戠鏂囦欢ID:', cloudFileID)
      
      // 鏋勫缓鍙闂殑鍥剧墖URL
      const cloudUrl = await this.getImageUrlFromFileID(cloudFileID)
      
      if (!cloudUrl) {
        throw new Error('鏃犳硶鑾峰彇鍥剧墖璁块棶URL')
      }

      console.log('鍥剧墖璁块棶URL:', cloudUrl)

      // 浣跨敤浜戠URL杩涜鍒嗗壊
      return await this.segmentClothing(cloudUrl, clothesTypes)

    } catch (error) {
      console.error('鏈湴鍥剧墖鍒嗗壊澶辫触:', error)
      return {
        success: false,
        error: error.message,
        message: '鏈湴鍥剧墖鍒嗗壊澶辫触'
      }
    }
  }

  /**
   * 涓婁紶鍥剧墖鍒颁簯绔瓨鍌?
   * @param {string} filePath - 鏈湴鏂囦欢璺緞
   * @returns {Promise<string>} 浜戠鏂囦欢ID
   */
  static async uploadImageToCloud(filePath) {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath: `clothing_images/${Date.now()}_${Math.random().toString(36).substring(2, 15)}.jpg`,
        filePath: filePath,
        success: res => {
          // 鑾峰彇鏂囦欢ID
          const fileID = res.fileID
          console.log('涓婁紶鎴愬姛锛屾枃浠禝D:', fileID)
          resolve(fileID)
        },
        fail: err => {
          console.error('鍥剧墖涓婁紶澶辫触:', err)
          reject(err)
        }
      })
    })
  }

  /**
   * 浠庢枃浠禝D鑾峰彇鍥剧墖鍙闂甎RL
   * @param {string} fileID - 浜戠鏂囦欢ID
   * @returns {Promise<string>} 鍥剧墖URL
   */
  static async getImageUrlFromFileID(fileID) {
    return new Promise((resolve, reject) => {
      wx.cloud.getTempFileURL({
        fileList: [fileID],
        success: res => {
          if (res.fileList && res.fileList.length > 0 && res.fileList[0].tempFileURL) {
            const url = res.fileList[0].tempFileURL
            console.log('鑾峰彇鍒颁复鏃舵枃浠禪RL:', url)
            resolve(url)
          } else {
            reject(new Error('鏃犳硶鑾峰彇涓存椂鏂囦欢URL'))
          }
        },
        fail: err => {
          console.error('鑾峰彇涓存椂鏂囦欢URL澶辫触:', err)
          reject(err)
        }
      })
    })
  }

  /**
   * 鏍规嵁琛ｇ墿绫诲瀷鎺ㄦ柇琛ｇ墿鍒嗙被
   * @param {string} clothesType - 琛ｇ墿绫诲瀷
   * @returns {string} 琛ｇ墿鍒嗙被
   */
  static getClothingCategory(clothesType) {
    const categoryMap = {
      'upper': '涓婅。',
      'lower': '涓嬭',
      'dress': '杩炶。瑁?,
      'outer': '澶栧',
      'shoes': '闉嬪瓙',
      'accessory': '閰嶉グ'
    }
    
    return categoryMap[clothesType] || '鍏朵粬'
  }

  /**
   * 鎵归噺鍒嗗壊澶氱琛ｇ墿绫诲瀷
   * @param {string} imageUrl - 鍥惧儚URL
   * @param {Array} clothesTypes - 琛ｇ墿绫诲瀷鏁扮粍
   * @returns {Promise} 鎵归噺鍒嗗壊缁撴灉
   */
  static async batchSegmentClothing(imageUrl, clothesTypes = ['upper', 'lower', 'dress']) {
    const results = {}
    
    for (const clothesType of clothesTypes) {
      try {
        const result = await this.segmentClothing(imageUrl, [clothesType])
        results[clothesType] = result
      } catch (error) {
        results[clothesType] = {
          success: false,
          error: error.message
        }
      }
    }
    
    return results
  }
}

module.exports = AliyunImageSegmentation
