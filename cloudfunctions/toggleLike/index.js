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

    const likeInfo = await db.collection('likes').where({
      post_id: postId,
      userOpenid: openid
    }).get()

    if (likeInfo.data.length > 0) {
      await db.collection('likes').where({
        post_id: postId,
        userOpenid: openid
      }).remove()

      const countRes = await db.collection('likes').where({ post_id: postId }).count()
      return {
        code: 200,
        data: { liked: false, likes: countRes.total },
        msg: '取消点赞成功'
      }
    } else {
      await db.collection('likes').add({
        data: {
          post_id: postId,
          userOpenid: openid,
          created_at: new Date()
        }
      })

      const countRes = await db.collection('likes').where({ post_id: postId }).count()
      return {
        code: 200,
        data: { liked: true, likes: countRes.total },
        msg: '点赞成功'
      }
    }
  } catch (err) {
    return {
      code: 500,
      msg: '点赞操作失败',
      err: err
    }
  }
}
