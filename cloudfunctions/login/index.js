const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { userInfo } = event
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    // 1. 查找用户
    const user = await db.collection('users').where({ openid }).get()
    
    if (user.data.length === 0) {
      // 🌟 核心修改：创建时手动加上 _openid，解决前端无法读取的问题
      await db.collection('users').add({
        data: {
          _openid: openid, // 👈 必须加这个！
          openid: openid,
          nickname: userInfo.nickName || '微信用户',
          avatar: userInfo.avatarUrl || '',
          gender: userInfo.gender || 0,
          created_at: db.serverDate(), // 使用服务端时间更稳
          updated_at: db.serverDate()
        }
      })
    } else {
      // 🌟 更新时也同步一下
      await db.collection('users').where({ openid }).update({
        data: {
          nickname: userInfo.nickName,
          avatar: userInfo.avatarUrl,
          gender: userInfo.gender,
          updated_at: db.serverDate()
        }
      })
    }
    
    // 2. 重新获取最新数据返回给前端
    const finalResult = await db.collection('users').where({ openid }).get()
    const userData = finalResult.data[0]
    
    return {
      code: 200,
      data: {
        token: openid,
        userInfo: {
          id: userData._id,
          nickname: userData.nickname,
          avatar: userData.avatar,
          gender: userData.gender
        }
      }
    }
  } catch (error) {
    return { code: 500, message: '登录失败', error: error.message }
  }
}