// 阿里云DashScope图像分割工具类
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/vision/image-process/process'
const DASHSCOPE_API_KEY = 'sk-d1d0581fac7b42e985a7a677f8f790df'

class AliyunImageSegmentation {
  
  /**
   * 衣物图像分割
   * @param {string} imageUrl - 图像URL或Base64数据
   * @param {Array} clothesTypes - 衣物类型数组，如 ['upper', 'lower', 'dress']
   * @returns {Promise} 分割结果
   */
  static async segmentClothing(imageUrl, clothesTypes = ['upper']) {
    try {
      console.log('开始调用阿里云API，图片URL:', imageUrl)
      
      // 构建请求数据 - 根据阿里云官方文档格式
      const requestData = {
        model: 'aitryon-parsing-v1',
        input: {
          image_url: imageUrl
        },
        parameters: {
          clothes_type: clothesTypes
        }
      }

      console.log('请求数据:', JSON.stringify(requestData))

      // 调用阿里云DashScope API
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: DASHSCOPE_API_URL,
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
          },
          data: JSON.stringify(requestData),
          timeout: 60000, // 增加超时时间
          success: (res) => {
            console.log('API响应状态:', res.statusCode)
            console.log('API响应数据:', res.data)
            resolve(res)
          },
          fail: (err) => {
            console.error('API请求失败:', err)
            reject(err)
          }
        })
      })

      // 检查响应状态
      if (response.statusCode !== 200) {
        console.error('API调用失败详情:', response)
        throw new Error(`API调用失败: ${response.statusCode} - ${JSON.stringify(response.data)}`)
      }

      const result = response.data
      console.log('API调用成功，结果:', result)
      
      // 解析分割结果
      if (result && (result.output || result.data)) {
        const output = result.output || result.data
        
        // 处理返回的图片URL，确保使用HTTPS
        if (output.parsing_img_url && Array.isArray(output.parsing_img_url) && output.parsing_img_url.length > 0) {
          const parsingUrl = output.parsing_img_url[0]
          if (parsingUrl && parsingUrl !== 'null' && parsingUrl !== 'None') {
            // 强制将HTTP转为HTTPS，避免微信小程序拦截
            output.parsing_img_url[0] = parsingUrl.replace("http://", "https://")
            console.log('更新分割图片URL为HTTPS:', output.parsing_img_url[0])
          }
        }
        
        if (output.crop_img_url && Array.isArray(output.crop_img_url) && output.crop_img_url.length > 0) {
          const cropUrl = output.crop_img_url[0]
          if (cropUrl && cropUrl !== 'null' && cropUrl !== 'None') {
            // 强制将HTTP转为HTTPS，避免微信小程序拦截
            output.crop_img_url[0] = cropUrl.replace("http://", "https://")
            console.log('更新裁剪图片URL为HTTPS:', output.crop_img_url[0])
          }
        }
        
        return {
          success: true,
          data: output,
          message: '衣物分割成功'
        }
      } else {
        throw new Error('分割结果解析失败: ' + JSON.stringify(result))
      }

    } catch (error) {
      console.error('阿里云图像分割失败:', error)
      return {
        success: false,
        error: error.message,
        message: '衣物分割失败'
      }
    }
  }

  /**
   * 从本地文件路径进行衣物分割
   * @param {string} filePath - 本地文件路径
   * @param {Array} clothesTypes - 衣物类型
   * @returns {Promise} 分割结果
   */
  static async segmentClothingFromLocal(filePath, clothesTypes = ['upper']) {
    try {
      console.log('开始处理本地图片:', filePath)
      
      // 先将本地图片上传到云端获取URL
      const cloudFileID = await this.uploadImageToCloud(filePath)
      
      if (!cloudFileID) {
        throw new Error('图片上传到云端失败')
      }

      console.log('云端文件ID:', cloudFileID)
      
      // 构建可访问的图片URL
      const cloudUrl = await this.getImageUrlFromFileID(cloudFileID)
      
      if (!cloudUrl) {
        throw new Error('无法获取图片访问URL')
      }

      console.log('图片访问URL:', cloudUrl)

      // 使用云端URL进行分割
      return await this.segmentClothing(cloudUrl, clothesTypes)

    } catch (error) {
      console.error('本地图片分割失败:', error)
      return {
        success: false,
        error: error.message,
        message: '本地图片分割失败'
      }
    }
  }

  /**
   * 上传图片到云端存储
   * @param {string} filePath - 本地文件路径
   * @returns {Promise<string>} 云端文件ID
   */
  static async uploadImageToCloud(filePath) {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath: `clothing_images/${Date.now()}_${Math.random().toString(36).substring(2, 15)}.jpg`,
        filePath: filePath,
        success: res => {
          // 获取文件ID
          const fileID = res.fileID
          console.log('上传成功，文件ID:', fileID)
          resolve(fileID)
        },
        fail: err => {
          console.error('图片上传失败:', err)
          reject(err)
        }
      })
    })
  }

  /**
   * 从文件ID获取图片可访问URL
   * @param {string} fileID - 云端文件ID
   * @returns {Promise<string>} 图片URL
   */
  static async getImageUrlFromFileID(fileID) {
    return new Promise((resolve, reject) => {
      wx.cloud.getTempFileURL({
        fileList: [fileID],
        success: res => {
          if (res.fileList && res.fileList.length > 0 && res.fileList[0].tempFileURL) {
            const url = res.fileList[0].tempFileURL
            console.log('获取到临时文件URL:', url)
            resolve(url)
          } else {
            reject(new Error('无法获取临时文件URL'))
          }
        },
        fail: err => {
          console.error('获取临时文件URL失败:', err)
          reject(err)
        }
      })
    })
  }

  /**
   * 根据衣物类型推断衣物分类
   * @param {string} clothesType - 衣物类型
   * @returns {string} 衣物分类
   */
  static getClothingCategory(clothesType) {
    const categoryMap = {
      'upper': '上衣',
      'lower': '下装',
      'dress': '连衣裙',
      'outer': '外套',
      'shoes': '鞋子',
      'accessory': '配饰'
    }
    
    return categoryMap[clothesType] || '其他'
  }

  /**
   * 批量分割多种衣物类型
   * @param {string} imageUrl - 图像URL
   * @param {Array} clothesTypes - 衣物类型数组
   * @returns {Promise} 批量分割结果
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