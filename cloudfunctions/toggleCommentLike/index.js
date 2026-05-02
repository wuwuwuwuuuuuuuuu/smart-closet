const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { commentId, replyId, type } = event
    const isReplyLike = type === 'reply'
    const targetField = isReplyLike ? 'reply_id' : 'comment_id'
    const targetId = isReplyLike ? replyId : commentId

    if (!targetId) {
      return {
        code: 400,
        msg: isReplyLike ? '缺少回复ID' : '缺少评论ID'
      }
    }

    const likeInfo = await db.collection('likes').where({
      [targetField]: targetId,
      userOpenid: openid,
      type: isReplyLike ? 'reply' : 'comment'
    }).get()

    if (likeInfo.data.length > 0) {
      await db.collection('likes').where({
        [targetField]: targetId,
        userOpenid: openid,
        type: isReplyLike ? 'reply' : 'comment'
      }).remove()

      const countRes = await db.collection('likes').where({
        [targetField]: targetId,
        type: isReplyLike ? 'reply' : 'comment'
      }).count()

      return {
        code: 200,
        data: { liked: false, likes: countRes.total },
        msg: '取消点赞成功'
      }
    } else {
      await db.collection('likes').add({
        data: {
          [targetField]: targetId,
          userOpenid: openid,
          type: isReplyLike ? 'reply' : 'comment',
          created_at: new Date()
        }
      })

      const countRes = await db.collection('likes').where({
        [targetField]: targetId,
        type: isReplyLike ? 'reply' : 'comment'
      }).count()

      return {
        code: 200,
        data: { liked: true, likes: countRes.total },
        msg: '点赞成功'
      }
    }
  } catch (err) {
    console.error('评论点赞异常:', err)
    return {
      code: 500,
      msg: '评论点赞操作失败',
      err: err.message || err
    }
  }
}
