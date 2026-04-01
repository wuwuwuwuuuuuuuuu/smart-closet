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
    
    const { post_id } = event.body
    
    // 查找用户
    const userInfo = await db.collection('users').where({ openid: token }).get()
    
    if (userInfo.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      }
    }
    
    const userId = userInfo.data[0]._id
    
    // 检查是否已经点赞
    const likeInfo = await db.collection('likes').where({ post_id, user_id: userId }).get()
    
    if (likeInfo.data.length > 0) {
      // 取消点赞
      await db.collection('likes').where({ post_id, user_id: userId }).remove()
      return {
        code: 200,
        message: '取消点赞成功'
      }
    } else {
      // 添加点赞
      await db.collection('likes').add({
        data: {
          post_id,
          user_id: userId,
          created_at: new Date()
        }
      })
      return {
        code: 200,
        message: '点赞成功'
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: '点赞操作失败',
      error: error.message
    }
  }
}