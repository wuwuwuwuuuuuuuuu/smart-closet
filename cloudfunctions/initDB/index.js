// 初始化数据库集合
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 创建用户集合
    await db.createCollection('users')
    // 创建衣物集合
    await db.createCollection('clothes')
    // 创建帖子集合
    await db.createCollection('posts')
    // 创建评论集合
    await db.createCollection('comments')
    // 创建点赞集合
    await db.createCollection('likes')
    // 创建试穿记录集合
    await db.createCollection('tryonRecords')
    
    return {
      code: 200,
      message: '数据库初始化成功'
    }
  } catch (error) {
    return {
      code: 500,
      message: '数据库初始化失败',
      error: error.message
    }
  }
}