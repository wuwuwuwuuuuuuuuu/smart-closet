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

    // ⭐⭐⭐ 并行查询（性能更好）
    const [
      likeCountRes,
      collectCountRes,
      likedRes,
      collectedRes
    ] = await Promise.all([

      // 点赞总数
      db.collection('likes')
        .where({
          postId: postId
        })
        .count(),

      // 收藏总数
      db.collection('collects')
        .where({
          postId: postId
        })
        .count(),

      // 当前用户是否点赞
      db.collection('likes')
        .where({
          postId: postId,
          openid: openid
        })
        .get(),

      // 当前用户是否收藏
      db.collection('collects')
        .where({
          postId: postId,
          openid: openid
        })
        .get()

    ])

    return {

      code: 200,

      data: {

        ...postData,

        // ⭐ 点赞数
        likes:
          likeCountRes.total || 0,

        // ⭐ 收藏数
        collects:
          collectCountRes.total || 0,

        // ⭐ 是否点赞
        liked:
          likedRes.data.length > 0,

        // ⭐ 是否收藏
        collected:
          collectedRes.data.length > 0,

        // ⭐ 是否作者
        isAuthor:
          postData.authorOpenid === openid

      },

      msg: '获取成功'

    }

  } catch (err) {

    console.error('getPostDetail错误:', err)

    return {

      code: 500,
      msg: '获取帖子详情失败',
      err: err

    }

  }

}