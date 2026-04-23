const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { postId } = event

    if (!postId) {
      return {
        code: 400,
        msg: '缺少帖子ID'
      }
    }

    const postRes = await db.collection('posts').doc(postId).get()

    if (!postRes.data) {
      return {
        code: 404,
        msg: '帖子不存在'
      }
    }

    const postData = postRes.data

    return {
      code: 200,
      data: {
        ...postData,
        isAuthor: postData.authorOpenid === openid
      },
      msg: '获取成功'
    }
  } catch (err) {
    return {
      code: 500,
      msg: '获取帖子详情失败',
      err: err
    }
  }
}
