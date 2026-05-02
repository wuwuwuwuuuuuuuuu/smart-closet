// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 1. 去数据库里找，有没有这个人的记录
    const { data } = await db.collection('users').where({
      _openid: openid
    }).get()

    if (data.length === 0) {
      // 2. 🌟 破案核心：如果是新用户，新建档案时【必须】强行写入 _openid！
      const result = await db.collection('users').add({
        data: {
          _openid: openid, // 👈 就是这一行拯救了全剧！
          nickname: '衣橱新主人',
          avatar: '', // 留空，等用户自己传
          createdAt: db.serverDate()
        }
      })
      return { 
        code: 200, 
        message: '注册成功',
        data: { userInfo: { id: result._id, _openid: openid } } 
      }
    } else {
      // 3. 如果是老用户，直接返回资料
      return { 
        code: 200, 
        message: '登录成功',
        data: { userInfo: { id: data[0]._id, _openid: openid, ...data[0] } } 
      }
    }
  } catch (err) {
    console.error('云函数登录异常:', err)
    return { code: 500, message: '服务器异常', error: err }
  }
}