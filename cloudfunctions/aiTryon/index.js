const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  // 🌟 1. 接收前端传来的三种图片 (上衣和下装可能为空)
  const { personImageFileID, topGarmentFileID, bottomGarmentFileID } = event
  const API_KEY = '***********' // 你的真实 Key

  try {
    // 🌟 2. 智能转换链接 (只转换非空的 ID)
    const fileList = [personImageFileID]
    if (topGarmentFileID) fileList.push(topGarmentFileID)
    if (bottomGarmentFileID) fileList.push(bottomGarmentFileID)

    const urlRes = await cloud.getTempFileURL({ fileList })
    
    // 建立一个 ID 到 URL 的映射表，方便取用
    const urlMap = {}
    urlRes.fileList.forEach(item => {
      urlMap[item.fileID] = item.tempFileURL
    })

    const personUrl = urlMap[personImageFileID]
    const topUrl = topGarmentFileID ? urlMap[topGarmentFileID] : undefined
    const bottomUrl = bottomGarmentFileID ? urlMap[bottomGarmentFileID] : undefined

    // 🌟 3. 动态组装阿里云的 input 参数
    const modelInput = { person_image_url: personUrl }
    if (topUrl) modelInput.top_garment_url = topUrl
    if (bottomUrl) modelInput.bottom_garment_url = bottomUrl

    // 4. 发起请求
    const createRes = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis',
      {
        model: 'aitryon',
        input: modelInput // 👈 把动态组装好的参数传进去
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'X-DashScope-Async': 'enable',
          'Content-Type': 'application/json'
        }
      }
    )

    const taskId = createRes.data.output.task_id
    if (!taskId) throw new Error('未获取到任务ID')

    // 5. 轮询等待
    let isCompleted = false
    let finalImageUrl = ''
    
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000))
      const statusRes = await axios.get(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
      })
      const taskStatus = statusRes.data.output.task_status
      
      if (taskStatus === 'SUCCEEDED') {
        isCompleted = true
        // 🌟 读取正确位置的图片链接
        finalImageUrl = statusRes.data.output.image_url 
        break
      } else if (taskStatus === 'FAILED' || taskStatus === 'UNKNOWN') {
        throw new Error(statusRes.data.output.message || '模型渲染报错')
      }
    }

    if (!isCompleted) return { code: 408, message: 'AI 生成超时' }

    return { code: 200, data: { result_url: finalImageUrl } }

  } catch (error) {
    console.error('❌ 阿里云调用失败:', error.response?.data || error)
    return { code: 500, message: 'AI 试穿失败' }
  }
}