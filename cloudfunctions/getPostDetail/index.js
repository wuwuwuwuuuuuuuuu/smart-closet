const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
// 判断指定集合是否存在任一匹配记录，避免用复杂组合查询触发不必要索引要求
async function hasAnyRecord(collectionName, queryList = []) {
  for (const query of queryList) {
    const res =
      await db.collection(collectionName)
        .where(query)
        .limit(1)
        .get()

    if (res.data.length > 0) {
      return true
    }
  }

  return false
}

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

    // ⭐ 获取帖子
    const postRes =
      await db.collection('posts')
        .doc(postId)
        .get()

    if (!postRes.data) {
      return {
        code: 404,
        msg: '帖子不存在'
      }
    }

    const postData = postRes.data

    const userRes =
      await db.collection('users')
        .where({
          _openid: openid
        })
        .limit(1)
        .get()

    const currentUserId = userRes.data[0] && userRes.data[0]._id

    // ⭐ 查询当前用户是否点赞，兼容新旧点赞字段
    const liked = await hasAnyRecord('likes', [
      { postId, openid },
      { post_id: postId, userOpenid: openid },
      { postId, _openid: openid },
      ...(currentUserId ? [{ post_id: postId, user_id: currentUserId }] : [])
    ])

    // ⭐ 查询当前用户是否收藏，兼容新旧收藏字段
    const collected = await hasAnyRecord('user_collections', [
      { postId, openid },
      { post_id: postId, userOpenid: openid },
      { postId, _openid: openid },
      ...(currentUserId ? [{ post_id: postId, user_id: currentUserId }] : [])
    ])

    return {

      code: 200,

      data: {

        ...postData,

        // ⭐ 直接用 posts 表里的数字
        likes: postData.likes || 0,

        collects: postData.collects || 0,

        // ⭐ 用户状态
        liked,

        collected,

        isAuthor:
          postData.authorOpenid === openid

      },

      msg: '获取成功'

    }

  } catch (err) {

    console.error(err)

    return {

      code: 500,
      msg: '获取帖子详情失败',
      err: err

    }

  }

}
