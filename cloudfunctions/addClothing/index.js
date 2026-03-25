const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 1. 微信原生免鉴权：直接拿到极度安全的真实用户 openid
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    // 2. 直接从 event 里拿前端传过来的数据 (不需要 event.body)
    const { name, image, season, category, tags, material, brand } = event
    
    // 3. 查找用户真实 ID
    const userInfo = await db.collection('users').where({ openid: openid }).get()
    
    if (userInfo.data.length === 0) {
      return { code: 404, message: '用户不存在，请先返回我的页面授权登录' }
    }
    
    const userId = userInfo.data[0]._id
    
    // 4. 将衣物完整信息存入数据库
    const result = await db.collection('clothes').add({
      data: {
        user_id: userId,
        name: name || '未命名衣物',
        image: image, // 这里存的就是上一步生成的 cloud:// 链接
        season: season || '未知',
        category: category || '其他',
        tags: tags || [],
        material: material || '',
        brand: brand || '',
        created_at: db.serverDate(), // 用云端服务器时间更精准
        updated_at: db.serverDate()
      }
    })
    
    return {
      code: 200,
      message: '添加衣物成功',
      data: { id: result._id }
    }
  } catch (error) {
    return {
      code: 500,
      message: '添加衣物失败',
      error: error.message
    }
  }
}