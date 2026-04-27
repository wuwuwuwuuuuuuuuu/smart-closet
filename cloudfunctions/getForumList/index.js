const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 从帖子和用户档案中整理作者信息，优先使用用户表最新资料
function buildAuthorInfo(post = {}, user = {}) {
  const nickname =
    user.nickname ||
    user.nickName ||
    post.author ||
    post.nickname ||
    '用户'

  const avatar =
    user.avatar ||
    user.avatarUrl ||
    post.avatar ||
    post.avatarUrl ||
    ''

  return {
    author: nickname,
    avatar: avatar
  }
}

// 根据帖子里的作者标识查找用户档案，兼容不同发帖入口写入的字段
async function findPostAuthor(post = {}) {
  if (post.authorOpenid) {
    const userRes =
      await db.collection('users')
        .where({
          _openid: post.authorOpenid
        })
        .get()

    return userRes.data[0] || null
  }

  const userId = post.userId || post.author_id
  if (userId && userId !== 'unknown_user') {
    try {
      const userRes =
        await db.collection('users')
          .doc(userId)
          .get()

      return userRes.data || null
    } catch (err) {
      console.warn('getForumList.findPostAuthor', '未通过用户ID找到作者档案', {
        postId: post._id,
        userId: userId,
        error: err.message
      })
    }
  }

  return null
}

exports.main = async (event, context) => {

  try {

    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    console.log('开始获取论坛帖子列表')

    // ⭐ 获取帖子
    const res =
      await db.collection('posts')
        .orderBy('createTime', 'desc')
        .get()

    const posts = res.data

    // ⭐ 获取当前用户点赞记录
    const userLikes =
      await db.collection('likes')
        .where({
          openid: openid
        })
        .get()

    const likedPostIds =
      userLikes.data.map(
        item => item.postId
      )

    // ⭐ 获取当前用户收藏记录
    const userCollects =
      await db.collection('user_collections')
        .where({
          openid: openid
        })
        .get()

    const collectedPostIds =
      userCollects.data.map(
        item => item.postId
      )

    // ⭐ 组装最终数据
    const result =
      await Promise.all(
        posts.map(async (post) => {

          const authorUser = await findPostAuthor(post)
          const authorInfo = buildAuthorInfo(post, authorUser || {})

          return {

            ...post,

            author: authorInfo.author,
            avatar: authorInfo.avatar,

            // ⭐ 数量
            likes: post.likes || 0,
            collects: post.collects || 0,

            // ⭐ 状态
            liked:
              likedPostIds.includes(post._id),

            collected:
              collectedPostIds.includes(post._id)

          }

        })
      )

    return {
      code: 200,
      data: result
    }

  } catch (err) {

    console.error(err)

    return {
      code: 500,
      msg: '获取帖子失败'
    }

  }

}
