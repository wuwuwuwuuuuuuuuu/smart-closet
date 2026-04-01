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
    
    const { id } = event.body
    
    // 查找用户
    const userInfo = await db.collection('users').where({ openid: token }).get()
    
    if (userInfo.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      }
    }
    
    const userId = userInfo.data[0]._id
    
    // 查找衣物并验证所有权
    const clothingInfo = await db.collection('clothes').where({ _id: id, user_id: userId }).get()
    
    if (clothingInfo.data.length === 0) {
      return {
        code: 404,
        message: '衣物不存在或无权限'
      }
    }
    
    // 删除衣物
    await db.collection('clothes').where({ _id: id }).remove()
    
    return {
      code: 200,
      message: '删除成功'
    }
  } catch (error) {
    return {
      code: 500,
      message: '删除衣物失败',
      error: error.message
    }
  }
}