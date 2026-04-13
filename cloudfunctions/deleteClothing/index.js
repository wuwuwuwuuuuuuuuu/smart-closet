const cloud = require('wx-server-sdk')
// 初始化云环境
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  // 接收前端传过来的衣服 ID
  const { id } = event 

  if (!id) {
    return { code: 400, message: '缺少要删除的衣服 ID' }
  }

  try {
    // 🌟 高级操作 1：先查询这条记录，拿到图片在云存储里的路径 (fileID)
    const record = await db.collection('clothes').doc(id).get()
    const imageFileID = record.data.image

    // 🌟 高级操作 2：从数据库把这条记录连根拔起
    await db.collection('clothes').doc(id).remove()

    // 🌟 高级操作 3：顺藤摸瓜，去云存储把真正的照片文件也删了，给你省空间！
    if (imageFileID && imageFileID.startsWith('cloud://')) {
      await cloud.deleteFile({
        fileList: [imageFileID]
      })
    }

    // 功成身退，给前端发个成功的信号
    return {
      code: 200,
      message: '彻底移除成功'
    }

  } catch (err) {
    console.error('执行删除操作失败：', err)
    return {
      code: 500,
      message: '删除失败，服务器出错了',
      error: err
    }
  }
}