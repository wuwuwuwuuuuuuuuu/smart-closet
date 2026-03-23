const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 从请求头获取token（openid）
    const token = event.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return {
        code: 401,
        message: '未授权'
      }
    }
    
    // 获取查询参数
    const { season, category, keyword, page = 1, limit = 20 } = event.queryStringParameters || {}
    
    // 查找用户
    const userInfo = await db.collection('users').where({ openid: token }).get()
    
    if (userInfo.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      }
    }
    
    const userId = userInfo.data[0]._id
    
    // 构建查询条件
    let query = db.collection('clothes').where({ user_id: userId })
    
    // 季节筛选
    if (season && season !== 'all') {
      query = query.where({ season })
    }
    
    // 分类筛选
    if (category && category !== 'all') {
      query = query.where({ category })
    }
    
    // 关键词搜索
    if (keyword) {
      query = query.where({
        name: db.RegExp({
          regexp: keyword,
          options: 'i'
        })
      })
    }
    
    // 获取总数
    const total = await query.count()
    
    // 分页查询
    const clothes = await query
      .skip((page - 1) * limit)
      .limit(limit)
      .orderBy('created_at', 'desc')
      .get()
    
    return {
      code: 200,
      data: {
        list: clothes.data,
        total: total.total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: '获取衣物列表失败',
      error: error.message
    }
  }
}