// cloudfunctions/aiSceneFusion/index.js
const cloud = require('wx-server-sdk')
const axios = require('axios')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  // 🌟 新增了 prompt 接收参数
  const { personFileID, backgroundUrl, prompt } = event
  const API_KEY = '***************' // ⚠️ 记得换回你的真实 Key！

  try {
    const urlRes = await cloud.getTempFileURL({ fileList: [personFileID] })
    const personUrl = urlRes.fileList[0].tempFileURL

    let realBgUrl = backgroundUrl
    if (backgroundUrl && backgroundUrl.startsWith('cloud://')) {
      const bgUrlRes = await cloud.getTempFileURL({ fileList: [backgroundUrl] })
      realBgUrl = bgUrlRes.fileList[0].tempFileURL
    }

    // 🌟 核心改造：动态构建请求包。有图就传图，有字就传字！
    const inputData = { base_image_url: personUrl }
    if (realBgUrl) inputData.ref_image_url = realBgUrl
    if (prompt) {
      const enhancedPrompt = `A high quality, hyper-realistic, detailed full scene background of ${prompt}, cinematic lighting, photorealistic composition.`;
      inputData.ref_prompt = enhancedPrompt;
      console.log('🔍 咒语自动增强:', enhancedPrompt);
    }

    const createRes = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/background-generation/generation/',
      {
        model: 'wanx-background-generation-v2',
        input: inputData, // 👈 动态传参
        parameters: { n: 1 }
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'X-DashScope-Async': 'enable',
          'Content-Type': 'application/json'
        }
      }
    )

    const taskId = createRes.data.output?.task_id
    if (!taskId) throw new Error('阿里任务创建失败')

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
        finalImageUrl = output.results[0].url.replace('http://', 'https://')
        break
      } else if (taskStatus === 'FAILED' || taskStatus === 'UNKNOWN') {
        throw new Error(output.message || '场景生成失败')
      }
    }

    if (!isCompleted) return { code: 408, message: 'AI 融合生成超时' }
    return { code: 200, data: { result_url: finalImageUrl } }

  } catch (error) {
    return { code: 500, message: 'AI 融合异常', error: error.message }
  }
}