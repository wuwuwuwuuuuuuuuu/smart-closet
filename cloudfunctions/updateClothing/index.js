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
    
    const { id, name, image, season, category, tags, material, brand } = event.body
    
    // 查找用户
    const userInfo = await db.collection('users').where({ openid: token }).get()
    
    if (userInfo.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      }
    }
    
    const userId = userInfo.data[0]._id
    
    // 查找衣物并验证所有权
    const clothingInfo = await db.collection('clothes').where({ _id: id, user_id: userId }).get()
    
    if (clothingInfo.data.length === 0) {
      return {
        code: 404,
        message: '衣物不存在或无权限'
      }
    }
    
    // 更新衣物信息
    await db.collection('clothes').where({ _id: id }).update({
      data: {
        name: name || clothingInfo.data[0].name,
        image: image || clothingInfo.data[0].image,
        season: season || clothingInfo.data[0].season,
        category: category || clothingInfo.data[0].category,
        tags: tags || clothingInfo.data[0].tags,
        material: material || clothingInfo.data[0].material,
        brand: brand || clothingInfo.data[0].brand,
        updated_at: new Date()
      }
    })
    
    return {
      code: 200,
      message: '更新成功'
    }
  } catch (error) {
    return {
      code: 500,
      message: '更新衣物失败',
      error: error.message
    }
  }
}