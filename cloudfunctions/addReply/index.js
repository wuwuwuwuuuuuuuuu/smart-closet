// cloudfunctions/addReply/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { postId, commentId, content, replyTo } = event

    // 参数验证
    if (!postId || !commentId || !content) {
      return {
        code: 400,
        msg: '缺少必要参数：postId、commentId、content'
      }
    }

    // 获取用户信息
    const userRes = await db.collection('users').where({ _openid: openid }).get()
    const userInfo = userRes.data.length > 0 ? userRes.data[0] : {}
    const nickname = userInfo.nickname || '用户'
    const avatar = userInfo.avatar || ''

    const nowTime = new Date().getTime() // 🌟 获取当前 13 位绝对时间戳

    // 创建回复数据
    const replyData = {
      id: nowTime.toString(), // 生成唯一ID
      parentId: commentId,
      author: nickname,
      authorOpenid: openid,
      avatar: avatar,
      content: content,
      replyTo: replyTo || '', // 被回复人的昵称
      
      // 🌟 核心修复：直接存入时间戳，绝不存中文和本地格式化字符串！
      time: nowTime, 
      createTime: nowTime, // 增加备用字段，完美适配前端的 (reply.createTime || reply.time)
      
      likes: 0,
      liked: false
    }

    // 查找对应的评论 - 使用_id字段查询
    const commentRes = await db.collection('comments').where({
      _id: commentId
    }).get()

    if (commentRes.data.length === 0) {
      // 如果通过_id找不到，尝试通过id字段查找
      const commentResById = await db.collection('comments').where({
        id: commentId
      }).get()
      
      if (commentResById.data.length === 0) {
        return {
          code: 404,
          msg: '评论不存在'
        }
      }
      
      const comment = commentResById.data[0]
      
      // 更新评论的replies数组
      const replies = comment.replies || []
      replies.push(replyData)

      // 更新数据库 - 使用数据库的_id
      await db.collection('comments').doc(comment._id).update({
        data: {
          replies: replies,
          updated_at: db.serverDate() // 更新操作时间
        }
      })
    } else {
      const comment = commentRes.data[0]
      
      // 更新评论的replies数组
      const replies = comment.replies || []
      replies.push(replyData)

      // 更新数据库
      await db.collection('comments').doc(commentId).update({
        data: {
          replies: replies,
          updated_at: db.serverDate() // 更新操作时间
        }
      })
    }

    return {
      code: 200,
      data: {
        replyId: replyData.id,
        reply: replyData
      },
      msg: '回复成功'
    }

  } catch (err) {
    console.error('回复失败:', err)
    return {
      code: 500,
      msg: '回复失败',
      err: err.message
    }
  }
}