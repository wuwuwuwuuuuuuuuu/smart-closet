const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { postId } = event

  const POSTS_COLLECTION = 'posts'
  const ACTION_COLLECTION = 'likes'

  try {

    const existRecord =
      await db.collection(ACTION_COLLECTION)
        .where({
          postId: postId,
          openid: openid
        })
        .get()

    let liked

    if (existRecord.data.length > 0) {

      await db.collection(ACTION_COLLECTION)
        .doc(existRecord.data[0]._id)
        .remove()

      await db.collection(POSTS_COLLECTION)
        .doc(postId)
        .update({
          data: {
            likes: _.inc(-1)
          }
        })

      liked = false

    } else {

      await db.collection(ACTION_COLLECTION)
        .add({
          data: {
            postId: postId,   // ⭐ 关键
            openid: openid,   // ⭐ 关键
            createTime: db.serverDate()
          }
        })

      await db.collection(POSTS_COLLECTION)
        .doc(postId)
        .update({
          data: {
            likes: _.inc(1)
          }
        })

      liked = true

    }

    const postRes =
      await db.collection(POSTS_COLLECTION)
        .doc(postId)
        .get()

    return {

      code: 200,

      data: {

        liked,
        likes: postRes.data.likes || 0

      }

    }

  } catch (err) {

    console.error(err)

    return {
      code: 500,
      msg: '点赞失败'
    }

  }

}