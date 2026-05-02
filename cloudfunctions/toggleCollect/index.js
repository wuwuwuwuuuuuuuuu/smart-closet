const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { postId } = event

  const POSTS_COLLECTION = 'posts'
  const ACTION_COLLECTION = 'user_collections'

  try {

    const existRecord =
      await db.collection(ACTION_COLLECTION)
        .where({
          openid,
          postId
        })
        .get()

    let collected

    if (existRecord.data.length > 0) {

      // 取消收藏
      await db.collection(ACTION_COLLECTION)
        .doc(existRecord.data[0]._id)
        .remove()

      await db.collection(POSTS_COLLECTION)
        .doc(postId)
        .update({
          data: {
            collects: _.inc(-1)
          }
        })

      collected = false

    } else {

      // 添加收藏
      await db.collection(ACTION_COLLECTION)
        .add({
          data: {
            openid,
            postId,
            createTime: db.serverDate()
          }
        })

      await db.collection(POSTS_COLLECTION)
        .doc(postId)
        .update({
          data: {
            collects: _.inc(1)
          }
        })

      collected = true

    }

    // ⭐ 重新读取最新收藏数（关键）
    const postRes =
      await db.collection(POSTS_COLLECTION)
        .doc(postId)
        .get()

    return {

      code: 200,

      data: {

        collected,

        collects:
          postRes.data.collects || 0

      }

    }

  } catch (err) {

    console.error(err)

    return {
      code: 500,
      msg: '收藏失败'
    }

  }

}