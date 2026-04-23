// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数：删除社区帖子
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { postId } = event;

    if (!postId) {
      return {
        code: 400,
        msg: '缺少帖子ID'
      }
    }

    const post = await db.collection('posts').doc(postId).get();

    if (!post.data) {
      return {
        code: 404,
        msg: '帖子不存在'
      }
    }

    if (post.data.authorOpenid !== openid) {
      return {
        code: 403,
        msg: '无权删除他人帖子'
      }
    }

    const res = await db.collection('posts').doc(postId).remove();

    return {
      code: 200,
      msg: '删除成功',
      data: res
    }
  } catch (err) {
    return {
      code: 500,
      msg: '删除失败',
      err: err
    }
  }
}
