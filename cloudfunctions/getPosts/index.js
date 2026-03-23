const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 获取查询参数
    const { type, page = 1, limit = 10 } = event.queryStringParameters || {}
    
    // 构建查询条件
    let query = db.collection('posts')
    
    // 类型筛选
    if (type) {
      query = query.where({ type })
    }
    
    // 获取总数
    const total = await query.count()
    
    // 分页查询
    const posts = await query
      .skip((page - 1) * limit)
      .limit(limit)
      .orderBy('created_at', 'desc')
      .get()
    
    // 处理帖子数据，获取作者信息
    const processedPosts = await Promise.all(posts.data.map(async post => {
      // 获取作者信息
      const authorInfo = await db.collection('users').where({ _id: post.author_id }).get()
      const author = authorInfo.data[0] || {}
      
      // 获取点赞数
      const likeCount = await db.collection('likes').where({ post_id: post._id }).count()
      
      // 获取评论数
      const commentCount = await db.collection('comments').where({ post_id: post._id }).count()
      
      return {
        ...post,
        author: {
          id: author._id,
          nickname: author.nickname,
          avatar: author.avatar
        },
        likes: likeCount.total,
        comments: commentCount.total
      }
    }))
    
    return {
      code: 200,
      data: {
        list: processedPosts
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: '获取帖子列表失败',
      error: error.message
    }
  }
}