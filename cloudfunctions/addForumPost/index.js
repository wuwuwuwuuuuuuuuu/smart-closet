// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数：发布社区帖子
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { title, content, image } = event;

    const userRes = await db.collection('users').where({ _openid: openid }).get()
    const nickname = userRes.data.length > 0 ? userRes.data[0].nickname : '用户'
    const avatar = userRes.data.length > 0 ? userRes.data[0].avatar : ''

    const res = await db.collection('posts').add({
      data: {
        title: title,
        content: content || '',
        image: image,
        createTime: new Date(),
        likes: 0,
        comments: 0,
        author: nickname,
        authorOpenid: openid,
        avatar: avatar
      }
    })

    return {
      code: 200,
      msg: '发布成功',
      data: res
    }
  } catch (err) {
    return {
      code: 500,
      msg: '发布失败',
      err: err
    }
  }
}