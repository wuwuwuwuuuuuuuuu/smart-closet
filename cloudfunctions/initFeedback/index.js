// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const db = cloud.database()
    
    // 尝试创建一条测试记录来初始化集合
    const result = await db.collection('feedback').add({
      data: {
        userId: 'system_init',
        feedbackType: 'system',
        feedbackContent: '系统初始化反馈集合',
        contactInfo: '',
        status: 'resolved',
        createTime: Date.now(),
        formattedTime: new Date().toLocaleString('zh-CN'),
        userAgent: 'system'
      }
    })
    
    return {
      success: true,
      message: 'feedback集合初始化成功',
      data: result
    }
  } catch (error) {
    console.error('初始化feedback集合失败:', error)
    return {
      success: false,
      message: '初始化失败: ' + error.message,
      error: error
    }
  }
}