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
    
    // 查询用户信息
    const userInfo = await db.collection('users').where({ openid: token }).get()
    
    if (userInfo.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      }
    }
    
    const user = userInfo.data[0]
    
    // 获取用户的衣橱数量
    const wardrobeCount = await db.collection('clothes').where({ user_id: user._id }).count()
    
    // 获取用户的帖子数量
    const postCount = await db.collection('posts').where({ author_id: user._id }).count()
    
    return {
      code: 200,
      data: {
        id: user._id,
        nickname: user.nickname,
        avatar: user.avatar,
        gender: user.gender,
        birthday: user.birthday || '',
        wardrobeCount: wardrobeCount.total,
        postCount: postCount.total
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: '获取用户信息失败',
      error: error.message
    }
  }
}