const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { postId } = event

  if (!postId) {
    return { code: 400, msg: '缺少 postId 参数' }
  }

  // ⚠️ 极其重要：请把 'forum' 改成你存帖子的真实集合(表)名！
  const POSTS_COLLECTION = 'posts' 
  const ACTION_COLLECTION = 'user_collections'

  try {
    // 检查是否已经收藏过
    const existRecord = await db.collection(ACTION_COLLECTION).where({
      openid: openid,
      postId: postId
    }).get()

    if (existRecord.data.length > 0) {
      // 场景 A：已经收藏过，执行【取消收藏】
      await db.collection(ACTION_COLLECTION).doc(existRecord.data[0]._id).remove()
      
      // 🌟 让主帖子表的收藏总数 -1 (同时兼容 collects 和 collectCount 字段)
      await db.collection(POSTS_COLLECTION).doc(postId).update({
        data: {
          collects: _.inc(-1),
          collectCount: _.inc(-1) 
        }
      })
      
      return { code: 200, data: { collected: false }, msg: '取消收藏成功' }
    } else {
      // 场景 B：尚未收藏，执行【添加收藏】
      await db.collection(ACTION_COLLECTION).add({
        data: {
          openid: openid,
          postId: postId,
          createTime: db.serverDate()
        }
      })
      
      // 🌟 让主帖子表的收藏总数 +1
      await db.collection(POSTS_COLLECTION).doc(postId).update({
        data: {
          collects: _.inc(1),
          collectCount: _.inc(1)
        }
      })

      return { code: 200, data: { collected: true }, msg: '收藏成功' }
    }
  } catch (err) {
    console.error('收藏操作数据库异常:', err)
    return { code: 500, msg: '数据库查询/更新失败', error: err }
  }
}