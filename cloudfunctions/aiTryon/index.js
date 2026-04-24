const cloud = require('wx-server-sdk')
const axios = require('axios')
const qs = require('querystring') // 引入 qs 处理百度请求的表单格式

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { personImageFileID, topGarmentFileID, bottomGarmentFileID } = event
  
  // 🔑 你的 API Keys
  const API_KEY = 'sk-8f25b1a3c5114bdf878e79d18f5cf264' // 阿里云百炼 Key
  
  // 👇 填入你在百度 AI 开放平台新建应用的 API Key 和 Secret Key
  const BAIDU_AK = '*******'
  const BAIDU_SK = '********'

  try {
    // === 1. 转换微信云存储链接为临时 HTTPS 链接 ===
    const fileList = [personImageFileID]
    if (topGarmentFileID) fileList.push(topGarmentFileID)
    if (bottomGarmentFileID) fileList.push(bottomGarmentFileID)

    const urlRes = await cloud.getTempFileURL({ fileList })
    const urlMap = {}
    urlRes.fileList.forEach(item => {
      urlMap[item.fileID] = item.tempFileURL
    })

    const personUrl = urlMap[personImageFileID]
    const topUrl = topGarmentFileID ? urlMap[topGarmentFileID] : undefined
    const bottomUrl = bottomGarmentFileID ? urlMap[bottomGarmentFileID] : undefined

    // === 2. 构建模型输入并提交阿里异步任务 ===
    const modelInput = { person_image_url: personUrl }
    if (topUrl) modelInput.top_garment_url = topUrl
    if (bottomUrl) modelInput.bottom_garment_url = bottomUrl

    const createRes = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis',
      {
        model: 'aitryon',
        input: modelInput
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
    if (!taskId) throw new Error('未能生成阿里任务ID')

    // === 3. 轮询阿里查询试穿结果 ===
    let isCompleted = false
    let finalImageUrl = ''
    
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const statusRes = await axios.get(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
      })

      const output = statusRes.data.output
      const taskStatus = output.task_status

      if (taskStatus === 'SUCCEEDED') {
        isCompleted = true
        // 强转 HTTPS 确保手机端预览成功
        let rawUrl = output.image_url
        if (rawUrl) {
          finalImageUrl = rawUrl.replace('http://', 'https://')
        }
        break
      } else if (taskStatus === 'FAILED' || taskStatus === 'UNKNOWN') {
        throw new Error(output.message || '模型渲染失败')
      }
    }

    if (!isCompleted) return { code: 408, message: 'AI试穿生成超时' }

    // === 🌟 4. 接力调用百度进行人像抠图 ===
    let transparentBase64 = null
    try {
      if (BAIDU_AK && !BAIDU_AK.includes('请替换')) {
        // 4.1 获取百度 Access Token
        const tokenRes = await axios.get(
          `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_AK}&client_secret=${BAIDU_SK}`
        )
        const baiduToken = tokenRes.data.access_token

        // 4.2 将阿里的图片 URL 传给百度进行抠图
        const segRes = await axios.post(
          `https://aip.baidubce.com/rest/2.0/image-classify/v1/body_seg?access_token=${baiduToken}`,
          qs.stringify({ url: finalImageUrl }), // 百度支持直接传 url 参数
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        )

        // 4.3 拿到透明人像 Base64 数据
        if (segRes.data && segRes.data.foreground) {
          transparentBase64 = 'data:image/png;base64,' + segRes.data.foreground
        }
      } else {
         console.log('⚠️ 尚未配置百度 Key，跳过抠图步骤')
      }
    } catch (segErr) {
      console.error('⚠️ 百度抠图失败，将仅返回原图:', segErr.response?.data || segErr.message)
    }

    // === 5. 返回最终结果 ===
    return {
      code: 200,
      data: { 
        result_url: finalImageUrl,             // 带有背景的原试穿图
        transparent_base64: transparentBase64  // 抠好的人像图 (可能为 null)
      }
    }

  } catch (error) {
    console.error('❌ 试穿逻辑异常:', error.response?.data || error)
    return { 
      code: 500, 
      message: 'AI 试穿服务异常',
      error: error.message 
    }
  }
}