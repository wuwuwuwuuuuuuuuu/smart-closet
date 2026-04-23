const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function formatTime(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}  ${hours}:${minutes}`
}

function formatTimeChina(date) {
  const d = new Date(date)
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000)
  const chinaDate = new Date(utc + (8 * 3600000))
  const year = chinaDate.getFullYear()
  const month = String(chinaDate.getMonth() + 1).padStart(2, '0')
  const day = String(chinaDate.getDate()).padStart(2, '0')
  const hours = String(chinaDate.getHours()).padStart(2, '0')
  const minutes = String(chinaDate.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}  ${hours}:${minutes}`
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

    const res = await db.collection('comments')
      .where({ post_id: postId })
      .orderBy('created_at', 'desc')
      .get()

    const comments = await Promise.all(res.data.map(async (item) => {
      const likeCount = await db.collection('likes').where({
        comment_id: item._id,
        type: 'comment'
      }).count()
      const userLike = await db.collection('likes').where({
        comment_id: item._id,
        userOpenid: openid,
        type: 'comment'
      }).get()

      let nickname = '用户'
      let avatar = ''
      if (item.authorOpenid) {
        const userRes = await db.collection('users').where({ _openid: item.authorOpenid }).get()
        if (userRes.data.length > 0) {
          nickname = userRes.data[0].nickname || '用户'
          avatar = userRes.data[0].avatar || ''
        }
      }

      return {
        id: item._id,
        author: nickname,
        avatar: avatar,
        content: item.content,
        time: item.created_at ? formatTimeChina(item.created_at) : '',
        likes: likeCount.total,
        liked: userLike.data.length > 0
      }
    }))

    return {
      code: 200,
      data: comments,
      msg: '获取成功'
    }
  } catch (err) {
    console.error('获取评论异常:', err)
    return {
      code: 500,
      msg: '获取评论失败',
      err: err.message || err
    }
  }
}
