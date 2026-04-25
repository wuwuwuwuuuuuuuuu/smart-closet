const cloud = require('wx-server-sdk')
// 引入刚刚导出的删除方法 (根据你实际的文件相对路径调整)
const { deleteFromBailian } = require('./utils/bailian-provider') 

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { id } = event 
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!id) {
    return { code: 400, message: '缺少要删除的衣服 ID' }
  }

  try {
    // 1. 获取衣服信息
    const recordRes = await db.collection('clothes').doc(id).get()
    const clothing = recordRes.data
    const imageFileID = clothing.image

    // 2. 🌟 补充获取该用户的百炼 knowledgeId（重要前提）
    const userRes = await db.collection('users').where({ _openid: openid }).get()
    // 兼容取值：如果是老数据可能是 knowledge_id，新数据是 bailian_knowledge_id
    const knowledgeId = userRes.data.length > 0 
      ? (userRes.data[0].bailian_knowledge_id || userRes.data[0].knowledge_id) 
      : ''

    // 3. 🌟 去百炼抹除记忆
    if (clothing.bailian_file_id || clothing.bailian_doc_id || clothing.knowledge_doc_id) {
      try {
        await deleteFromBailian({
          fileId: clothing.bailian_file_id,
          documentId: clothing.bailian_doc_id || clothing.knowledge_doc_id,
          knowledgeId: knowledgeId // 把刚刚查到的知识库 ID 传进去
        })
        console.log(`成功从百炼知识库抹除衣物档案: ${id}`)
      } catch (bailianErr) {
        // 允许失败，不阻断主流程
        console.error('百炼数据移除失败，继续执行本地删除:', bailianErr)
      }
    }

    // 4. 删除云数据库记录
    await db.collection('clothes').doc(id).remove()

    // 5. 删除云存储照片
    if (imageFileID && imageFileID.startsWith('cloud://')) {
      await cloud.deleteFile({ fileList: [imageFileID] })
    }

    return {
      code: 200,
      message: '彻底移除成功（包含 AI 记忆）'
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