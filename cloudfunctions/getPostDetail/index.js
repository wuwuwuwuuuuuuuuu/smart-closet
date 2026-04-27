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

    // ⭐ 查询当前用户是否点赞
    const likedRes =
      await db.collection('likes')
        .where({
          postId,
          openid
        })
        .get()

    // ⭐ 查询当前用户是否收藏
    const collectedRes =
      await db.collection('user_collections')
        .where({
          postId,
          openid
        })
        .get()

    return {

      code: 200,

      data: {

        ...postData,

        // ⭐ 直接用 posts 表里的数字
        likes: postData.likes || 0,

        collects: postData.collects || 0,

        // ⭐ 用户状态
        liked:
          likedRes.data.length > 0,

        collected:
          collectedRes.data.length > 0,

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