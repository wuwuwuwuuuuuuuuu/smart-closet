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
    
    const { title, content, images, tags } = event.body
    
    // 查找用户
    const userInfo = await db.collection('users').where({ openid: token }).get()
    
    if (userInfo.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      }
    }
    
    const userId = userInfo.data[0]._id
    
    // 创建帖子
    const result = await db.collection('posts').add({
      data: {
        author_id: userId,
        title,
        content,
        images: images || [],
        tags: tags || [],
        likes: 0,
        comments: 0,
        created_at: new Date(),
        updated_at: new Date()
      }
    })
    
    return {
      code: 200,
      data: {
        id: result._id
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: '创建帖子失败',
      error: error.message
    }
  }
}