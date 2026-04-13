const cloud = require('wx-server-sdk')
const axios = require('axios')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { personImageFileID, garmentImageFileID } = event
  
  // 🔑 核心密钥：请在这里填入你在 Fashn.ai 官网获取的 API KEY
  const API_KEY = 'YOUR_FASHN_API_KEY' 
  const BASE_URL = 'https://api.fashn.ai/v1'

  try {
    // 1. 把微信的 cloud:// 临时链接换成 Fashn 能看懂的 HTTPS 真实链接
    const fileList = [personImageFileID, garmentImageFileID]
    const result = await cloud.getTempFileURL({ fileList })
    const personImageUrl = result.fileList[0].tempFileURL
    const garmentImageUrl = result.fileList[1].tempFileURL

    // 2. 🚀 第一步：向 Fashn 发起生成请求 (使用它最新的 v1.6 模型)
    const runRes = await axios.post(`${BASE_URL}/run`, {
      model_name: 'tryon-v1.6', 
      inputs: {
        model_image: personImageUrl,
        garment_image: garmentImageUrl,
        category: 'auto' // 让 Fashn 自己判断是上衣、下装还是连体衣
      }
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    const predictionId = runRes.data.id
    
    // 3. ⏳ 第二步：轮询等待结果 (Fashn 生成通常需要 10-15 秒)
    let isCompleted = false
    let finalImageUrl = ''
    
    for (let i = 0; i < 15; i++) { // 最多循环 15 次，每次等 3 秒 = 最长等 45 秒
      // 暂停 3 秒再继续
      await new Promise(resolve => setTimeout(resolve, 3000)) 
      
      const statusRes = await axios.get(`${BASE_URL}/status/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
      })
      
      const statusData = statusRes.data
      
      if (statusData.status === 'completed') {
        isCompleted = true
        // Fashn 返回的 output 是一个包含生成图片链接的数组，我们取第一张
        finalImageUrl = statusData.output[0] 
        break
      } else if (statusData.status === 'failed') {
        throw new Error(statusData.error || 'Fashn 模型渲染报错')
      }
      // 如果状态是 starting/in_queue/processing，不执行任何操作，直接进入下一次循环等待
    }

    if (!isCompleted) {
      return { code: 408, message: 'AI 生成超时，请稍后再试' }
    }

    // 4. 🎉 成功！返回图片链接给前端
    return {
      code: 200,
      message: '试穿成功',
      data: { result_url: finalImageUrl }
    }

  } catch (error) {
    // 打印 Fashn 官方的详细报错，方便咱们在云函数日志里排查
    console.error('Fashn API 调用失败:', error.response?.data || error)
    return { 
      code: 500, 
      message: 'AI 试穿失败', 
      error: error.response?.data || error.message 
    }
  }
}