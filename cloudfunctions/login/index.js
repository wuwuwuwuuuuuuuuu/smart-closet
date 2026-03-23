const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { code, userInfo } = event
    
    // 调用微信登录接口获取openid
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    // 查找用户是否存在
    const user = await db.collection('users').where({ openid }).get()
    
    let userRecord
    if (user.data.length === 0) {
      // 创建新用户
      userRecord = await db.collection('users').add({
        data: {
          openid,
          nickname: userInfo.nickName,
          avatar: userInfo.avatarUrl,
          gender: userInfo.gender,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
    } else {
      // 更新现有用户信息
      userRecord = await db.collection('users').where({ openid }).update({
        data: {
          nickname: userInfo.nickName,
          avatar: userInfo.avatarUrl,
          gender: userInfo.gender,
          updated_at: new Date()
        }
      })
    }
    
    // 获取完整用户信息
    const userInfoResult = await db.collection('users').where({ openid }).get()
    const userData = userInfoResult.data[0]
    
    // 生成token（这里简化处理，实际项目中应该使用JWT）
    const token = openid
    
    return {
      code: 200,
      data: {
        token,
        userInfo: {
          id: userData._id,
          nickname: userData.nickname,
          avatar: userData.avatar,
          gender: userData.gender
        }
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: '登录失败',
      error: error.message
    }
  }
}