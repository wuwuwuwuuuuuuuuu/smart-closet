const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 从请求头获取token（openid）
    const token = event.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return {
        code: 401,
        message: '未授权'
      }
    }
    
    // 获取上传的文件
    const file = event.media
    const type = event.type || 'wardrobe' // 上传类型：wardrobe/avatar/post
    
    // 生成文件路径
    const timestamp = Date.now()
    const filename = `${type}/${timestamp}_${Math.floor(Math.random() * 10000)}.jpg`
    
    // 上传文件到云存储
    const result = await cloud.uploadFile({
      cloudPath: filename,
      fileContent: Buffer.from(file)
    })
    
    return {
      code: 200,
      data: {
        url: result.fileID
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: '上传图片失败',
      error: error.message
    }
  }
}