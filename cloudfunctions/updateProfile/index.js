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
    
    const { nickname, avatar, gender, birthday } = event.body
    
    // 查找用户
    const userInfo = await db.collection('users').where({ openid: token }).get()
    
    if (userInfo.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      }
    }
    
    // 更新用户信息
    await db.collection('users').where({ openid: token }).update({
      data: {
        nickname: nickname || userInfo.data[0].nickname,
        avatar: avatar || userInfo.data[0].avatar,
        gender: gender || userInfo.data[0].gender,
        birthday: birthday || userInfo.data[0].birthday,
        updated_at: new Date()
      }
    })
    
    return {
      code: 200,
      message: '更新成功'
    }
  } catch (error) {
    return {
      code: 500,
      message: '更新失败',
      error: error.message
    }
  }
}