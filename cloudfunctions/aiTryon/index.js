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
    
    const { userImage, clothingImage, type } = event.body
    
    // 查找用户
    const userInfo = await db.collection('users').where({ openid: token }).get()
    
    if (userInfo.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      }
    }
    
    const userId = userInfo.data[0]._id
    
    // 模拟AI试穿处理（实际项目中需要调用AI模型）
    // 这里简化处理，直接返回原图片
    const resultImage = userImage // 实际项目中应该是AI处理后的图片
    const processingTime = '0.5s' // 模拟处理时间
    
    // 保存试穿记录
    await db.collection('tryonRecords').add({
      data: {
        user_id: userId,
        user_image: userImage,
        clothing_image: clothingImage,
        result_image: resultImage,
        type,
        processing_time: processingTime,
        created_at: new Date()
      }
    })
    
    return {
      code: 200,
      data: {
        resultImage,
        processingTime
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: '试穿失败',
      error: error.message
    }
  }
}