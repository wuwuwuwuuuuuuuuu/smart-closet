/**
 * 百度AI智能抠图工具类
 * 用于衣物上传时的智能抠图功能
 */

const API_KEY = "Oraveml7k7QskcTldNf59BW3"
const SECRET_KEY = "Dkstom9Rwv1HLCr5eSLmMzmqWDvHTaQ1"
const SEGMENT_API_URL = "https://aip.baidubce.com/rest/2.0/image-process/v1/segment"

class BaiduImageSegmentation {
  constructor() {
    this.accessToken = null
    this.tokenExpireTime = null
  }

  /**
   * 获取访问令牌
   */
  async getAccessToken() {
    // 检查token是否有效（有效期通常为30天）
    if (this.accessToken && this.tokenExpireTime && Date.now() < this.tokenExpireTime) {
      return this.accessToken
    }

    try {
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`,
          method: 'GET',
          success: resolve,
          fail: reject
        })
      })

      if (response.statusCode === 200 && response.data.access_token) {
        this.accessToken = response.data.access_token
        // 设置token过期时间（提前5分钟刷新）
        this.tokenExpireTime = Date.now() + (response.data.expires_in - 300) * 1000
        return this.accessToken
      } else {
        throw new Error('获取access_token失败: ' + JSON.stringify(response.data))
      }
    } catch (error) {
      console.error('获取百度AI访问令牌失败:', error)
      throw error
    }
  }

  /**
   * 将图片转换为base64
   * @param {string} filePath 图片临时路径
   * @returns {Promise<string>} base64编码的图片数据
   */
  async imageToBase64(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath: filePath,
        encoding: 'base64',
        success: (res) => {
          resolve(res.data)
        },
        fail: (err) => {
          reject(new Error('图片读取失败: ' + err.errMsg))
        }
      })
    })
  }

  /**
   * 智能抠图 - 自动识别主体
   * @param {string} imagePath 图片临时路径
   * @param {Object} options 抠图选项
   * @returns {Promise<Object>} 抠图结果
   */
  async segmentClothing(imagePath, options = {}) {
    try {
      const accessToken = await this.getAccessToken()
      
      // 将图片转换为base64
      const imageBase64 = await this.imageToBase64(imagePath)
      
      // 构建请求参数 - 严格按照API文档格式
      const requestData = {
        image: imageBase64,
        method: 'auto',
        refine_mask: options.refineMask !== false ? 'true' : 'false',
        return_form: options.returnForm || 'rgba'
      }
      
      // 移除未使用的可选参数
      if (options.returnForm === 'mask') {
        requestData.return_form = 'mask'
      }

      // 调用百度AI智能抠图API - 使用x-www-form-urlencoded格式
      const response = await new Promise((resolve, reject) => {
        // 将JSON数据转换为URL编码格式
        const formData = Object.keys(requestData)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(requestData[key])}`)
          .join('&')
        
        wx.request({
          url: `${SEGMENT_API_URL}?access_token=${accessToken}`,
          method: 'POST',
          header: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': formData.length.toString()
          },
          data: formData,
          timeout: 30000, // 增加超时时间到30秒
          success: resolve,
          fail: reject
        })
      })

      if (response.statusCode === 200) {
        const result = response.data
        
        if (result.error_code) {
          throw new Error(`百度AI抠图API错误: ${result.error_msg} (错误码: ${result.error_code})`)
        }

        if (!result.image) {
          throw new Error('抠图API返回数据异常: 缺少image字段')
        }

        return {
          success: true,
          logId: result.log_id,
          imageBase64: result.image,
          imageType: 'png'
        }
      } else {
        throw new Error(`HTTP请求失败: ${response.statusCode}`)
      }
    } catch (error) {
      console.error('智能抠图失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 将base64图片保存到临时文件
   * @param {string} base64Data base64编码的图片数据
   * @param {string} fileType 文件类型，默认png
   * @returns {Promise<string>} 临时文件路径
   */
  async saveBase64ToTempFile(base64Data, fileType = 'png') {
    return new Promise((resolve, reject) => {
      const filePath = `${wx.env.USER_DATA_PATH}/temp_${Date.now()}.${fileType}`
      
      wx.getFileSystemManager().writeFile({
        filePath: filePath,
        data: base64Data,
        encoding: 'base64',
        success: () => {
          resolve(filePath)
        },
        fail: (err) => {
          reject(new Error('保存临时文件失败: ' + err.errMsg))
        }
      })
    })
  }

  /**
   * 完整的衣物抠图流程
   * @param {string} originalImagePath 原始图片路径
   * @returns {Promise<Object>} 包含抠图结果的完整信息
   */
  async extractClothing(originalImagePath) {
    try {
      // 1. 调用智能抠图API
      const segmentResult = await this.segmentClothing(originalImagePath, {
        refineMask: true,
        returnForm: 'rgba'
      })

      if (!segmentResult.success) {
        throw new Error(segmentResult.error)
      }

      // 2. 将抠图结果保存为临时文件
      const transparentImagePath = await this.saveBase64ToTempFile(
        segmentResult.imageBase64,
        segmentResult.imageType
      )

      // 3. 上传到云存储
      const cloudFile = await this.uploadToCloudStorage(transparentImagePath)

      return {
        success: true,
        logId: segmentResult.logId,
        originalImagePath: originalImagePath,
        transparentImagePath: transparentImagePath,
        cloudFileId: cloudFile.fileID,
        cloudUrl: cloudFile.tempFileURL
      }
    } catch (error) {
      console.error('衣物抠图流程失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 上传图片到微信云存储
   * @param {string} filePath 本地文件路径
   * @returns {Promise<Object>} 云存储文件信息
   */
  async uploadToCloudStorage(filePath) {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath: `clothing-images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`,
        filePath: filePath,
        success: resolve,
        fail: reject
      })
    })
  }

  /**
   * 批量抠图（适用于多张衣物图片）
   * @param {Array<string>} imagePaths 图片路径数组
   * @returns {Promise<Array<Object>>} 批量抠图结果
   */
  async batchExtractClothing(imagePaths) {
    const results = []
    
    for (let i = 0; i < imagePaths.length; i++) {
      try {
        const result = await this.extractClothing(imagePaths[i])
        results.push({
          index: i,
          ...result
        })
        
        // 显示进度
        wx.showLoading({
          title: `正在处理第${i + 1}/${imagePaths.length}张图片`,
          mask: true
        })
      } catch (error) {
        results.push({
          index: i,
          success: false,
          error: error.message
        })
      }
    }
    
    wx.hideLoading()
    return results
  }
}

// 创建单例实例
const baiduImageSegmentation = new BaiduImageSegmentation()

module.exports = baiduImageSegmentation