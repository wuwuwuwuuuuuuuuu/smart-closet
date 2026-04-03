const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 1. 🌟 核心：直接拿微信环境里的 OPENID，不用传 Token
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    // 2. 🌟 核心：直接从 event 拿 id，不需要 event.body
    const { id } = event 
    
    if (!id) {
      return { code: 400, message: '缺少衣物ID' }
    }

    // 3. 查找用户（注意是 _openid 有下划线）
    const userInfo = await db.collection('users').where({ _openid: openid }).get()
    
    if (userInfo.data.length === 0) {
      return { code: 404, message: '用户不存在' }
    }
    
    const userId = userInfo.data[0]._id

    // 4. 验证并删除
    // 我们先查一下这件衣服存不存在，顺便拿到图片 ID 好一起删掉
    const clothing = await db.collection('clothes').doc(id).get()
    
    if (!clothing.data) {
      return { code: 404, message: '未找到该衣物' }
    }

    // 验证所有权（检查 user_id 是否匹配）
    if (clothing.data.user_id !== userId) {
      return { code: 403, message: '你没有权限删除这件衣物' }
    }

    // 5. 🌟 连环删除：先删图片，再删记录
    const fileID = clothing.data.image
    if (fileID && fileID.startsWith('cloud://')) {
      await cloud.deleteFile({
        fileList: [fileID]
      })
    }

    await db.collection('clothes').doc(id).remove()
    
    return {
      code: 200,
      message: '删除成功'
    }

  } catch (error) {
    console.error('删除异常：', error)
    return {
      code: 500,
      message: '删除失败',
      error: error.message
    }
  }
}