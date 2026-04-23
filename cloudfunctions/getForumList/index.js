// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数：获取社区帖子列表
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    console.log('开始获取论坛帖子列表');
    const res = await db.collection('posts').orderBy('createTime', 'desc').get()
    console.log('获取数据成功:', res.data);

    const posts = res.data

    const postsWithLikes = await Promise.all(posts.map(async (post) => {
      const likeCount = await db.collection('likes').where({ post_id: post._id }).count()
      const userLike = await db.collection('likes').where({
        post_id: post._id,
        userOpenid: openid
      }).get()

      let nickname = '用户'
      let avatar = ''
      if (post.authorOpenid) {
        const userRes = await db.collection('users').where({ _openid: post.authorOpenid }).get()
        if (userRes.data.length > 0) {
          nickname = userRes.data[0].nickname || '用户'
          avatar = userRes.data[0].avatar || ''
        }
      }

      return {
        ...post,
        author: nickname,
        avatar: avatar,
        likes: likeCount.total,
        liked: userLike.data.length > 0
      }
    }))

    return {
      code: 200,
      data: postsWithLikes,
      msg: '获取成功'
    }
  } catch (err) {
    console.error('获取帖子失败:', err);
    return {
      code: 500,
      msg: '获取失败',
      err: err.message || err
    }
  }
}