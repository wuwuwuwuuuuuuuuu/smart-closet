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
    
    // 2. 接收前端数据
    const { name, image, season, category, tags, material, brand } = event
    
    // 3. 🌟 修复1：使用带有下划线的 _openid 查找，并倒序拿最新的一条（防止旧测试数据干扰）
    const userInfo = await db.collection('users')
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc') 
      .get()
    
    if (userInfo.data.length === 0) {
      return { code: 404, message: '用户不存在，请先返回我的页面授权登录' }
    }
    
    const userId = userInfo.data[0]._id
    
    // 4. 🌟 修复2：存入衣物时，必须强行打上微信的 _openid 钢印！
    const result = await db.collection('clothes').add({
      data: {
        _openid: openid,  // 👈 绝对核心：打上官方防伪标签，彻底解决权限拦截问题！
        user_id: userId,  // 保持前端 user_id 查询的兼容
        name: name || '未命名衣物',
        image: image, 
        season: season || '未知',
        category: category || '其他',
        tags: tags || [],
        material: material || '',
        brand: brand || '',
        created_at: db.serverDate(),
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