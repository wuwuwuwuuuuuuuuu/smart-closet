const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 生成评论提醒数据，提醒帖子作者有人评论
function buildCommentNotification({
  post,
  postId,
  commentId,
  content,
  sender,
  senderOpenid,
  receiverOpenid
}) {
  return {
    type: 'comment',
    postId,
    postTitle: post.title || '分享穿搭',
    commentId,
    commentContent: content,
    senderOpenid,
    senderName: sender.nickname || sender.nickName || '用户',
    senderAvatar: sender.avatar || sender.avatarUrl || '',
    receiverOpenid,
    isRead: false,
    createTime: db.serverDate()
  }
}

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

    const postRes = await db.collection('posts').doc(postId).get()
    const post = postRes.data
    if (!post) {
      return {
        code: 404,
        msg: '帖子不存在，无法评论'
      }
    }

    const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
    const sender = userRes.data[0] || {}
    const nickname = sender.nickname || sender.nickName || '用户'

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

    const receiverOpenid = post.authorOpenid || post._openid || ''
    let notificationWarning = ''
    if (!receiverOpenid) {
      notificationWarning = '帖子缺少作者openid，已跳过评论提醒'
      console.warn('addComment', '帖子缺少作者openid，跳过评论提醒', {
        postId,
        commentId: res._id
      })
    } else if (receiverOpenid !== openid) {
      try {
        await db.collection('notifications').add({
          data: buildCommentNotification({
            post,
            postId,
            commentId: res._id,
            content,
            sender,
            senderOpenid: openid,
            receiverOpenid
          })
        })
      } catch (notificationError) {
        notificationWarning = '评论已成功，但提醒写入失败'
        console.warn('addComment', '评论提醒写入失败', {
          postId,
          commentId: res._id,
          error: notificationError.message || notificationError
        })
      }
    }

    return {
      code: 200,
      data: {
        id: res._id,
        notificationWarning
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
