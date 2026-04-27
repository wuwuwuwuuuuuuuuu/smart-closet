const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { postId, content } = event

    if (!postId || !content) {
      return {
        code: 400,
        msg: '缺少必要参数'
      }
    }

    const userRes = await db.collection('users').where({ _openid: openid }).get()
    const nickname = userRes.data.length > 0 ? userRes.data[0].nickname : '用户'

    const res = await db.collection('comments').add({
      data: {
        post_id: postId,
        author: nickname,
        authorOpenid: openid,
        content: content,
        created_at: new Date(),
        likes: 0
      }
    })

    return {
      code: 200,
      data: {
        id: res._id
      },
      msg: '评论成功'
    }
  } catch (err) {
    return {
      code: 500,
      msg: '评论失败',
      err: err
    }
  }
}
