const cloud = require('wx-server-sdk')
const axios = require('axios')
const qs = require('querystring') // 引入 qs 处理百度请求的表单格式

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 检查是否为微信云存储文件ID，避免把本地路径误传给云函数
function validateCloudFileID(fileID, fieldName) {
  if (!fileID) {
    return
  }

  if (typeof fileID !== 'string' || !fileID.startsWith('cloud://')) {
    throw new Error(`${fieldName}必须是cloud://开头的微信云文件ID`)
  }
}

// 从云存储文件ID映射表中取出临时HTTPS链接，缺失时直接抛错


function uniqueStringArray(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean))]
}

async function getCurrentUserId(openid) {
  try {
    const res = await db.collection('users')
      .where({ _openid: openid })
      .limit(1)
      .get()
    return res && res.data && res.data[0] ? res.data[0]._id : ''
  } catch (error) {
    console.warn('[AI_TRYON_HISTORY] user lookup failed, continue with OPENID only')
    return ''
  }
}

async function saveTryonRecordSafely({
  openid,
  finalImageUrl,
  personImageFileID,
  topGarmentFileID,
  bottomGarmentFileID,
  clothingIds
}) {
  try {
    const userId = await getCurrentUserId(openid)
    const now = db.serverDate()
    await db.collection('tryonRecords').add({
      data: {
        _openid: openid,
        user_id: userId,
        resultImage: finalImageUrl,
        imageUrl: finalImageUrl,
        finalImage: finalImageUrl,
        personImage: personImageFileID,
        clothesImages: uniqueStringArray([topGarmentFileID, bottomGarmentFileID]),
        clothingIds: uniqueStringArray(clothingIds),
        status: 'success',
        source: 'aiTryon',
        createdAt: now,
        createTime: now
      }
    })
  } catch (error) {
    console.error('[AI_TRYON_HISTORY] save failed, return try-on result anyway', {
      message: error && error.message ? error.message : String(error)
    })
  }
}

function getRequiredTempURL(urlMap, fileID, fieldName) {
  const tempURL = urlMap[fileID]
  if (!tempURL) {
    throw new Error(`${fieldName}未获取到临时访问链接`)
  }
  return tempURL
}

exports.main = async (event, context) => {
  const { personImageFileID, topGarmentFileID, bottomGarmentFileID, clothingIds } = event
  
  // 🔑 你的 API Keys
  const API_KEY = '*******************' // 阿里云DashScope API Key
  
  // 👇 百度AI开放平台API配置 (用于人像抠图)
  const BAIDU_AK = '*************'
  const BAIDU_SK = '******************'

  try {
    validateCloudFileID(personImageFileID, 'personImageFileID')
    validateCloudFileID(topGarmentFileID, 'topGarmentFileID')
    validateCloudFileID(bottomGarmentFileID, 'bottomGarmentFileID')

    if (!personImageFileID) {
      throw new Error('缺少模特图片')
    }

    if (!topGarmentFileID && !bottomGarmentFileID) {
      throw new Error('至少需要一张衣物图片')
    }

    // === 1. 转换微信云存储链接为临时 HTTPS 链接 ===
    const fileList = [personImageFileID]
    if (topGarmentFileID) fileList.push(topGarmentFileID)
    if (bottomGarmentFileID) fileList.push(bottomGarmentFileID)

    const urlRes = await cloud.getTempFileURL({ fileList })
    const urlMap = {}
    urlRes.fileList.forEach(item => {
      urlMap[item.fileID] = item.tempFileURL
    })

    const personUrl = getRequiredTempURL(urlMap, personImageFileID, '模特图片')
    const topUrl = topGarmentFileID ? getRequiredTempURL(urlMap, topGarmentFileID, '上衣图片') : undefined
    const bottomUrl = bottomGarmentFileID ? getRequiredTempURL(urlMap, bottomGarmentFileID, '下装图片') : undefined

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

    // ==========================================
    // === 4. 调用百度接口进行人像抠图 ===
    // ==========================================
    let transparentBase64 = ''
    try {
      // 4.1 获取百度 Access Token
      const tokenRes = await axios.post(
        `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_AK}&client_secret=${BAIDU_SK}`
      )
      const accessToken = tokenRes.data.access_token

      // 4.2 将阿里生成的试穿图下载下来，转为 Base64 给百度
      const imageRes = await axios.get(finalImageUrl, { responseType: 'arraybuffer' })
      const imageBase64 = Buffer.from(imageRes.data, 'binary').toString('base64')

      // 4.3 呼叫百度人像分割 API (body_seg)
      const baiduRes = await axios.post(
        `https://aip.baidubce.com/rest/2.0/image-classify/v1/body_seg?access_token=${accessToken}`,
        qs.stringify({ image: imageBase64 }), 
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )

      if (baiduRes.data && baiduRes.data.foreground) {
        // 百度的 foreground 字段就是透明背景的人像 base64，加上前缀供前端使用
        transparentBase64 = 'data:image/png;base64,' + baiduRes.data.foreground
      } else {
        console.warn('⚠️ 百度抠图未返回 foreground:', baiduRes.data)
      }
    } catch (baiduErr) {
      console.error('❌ 百度抠图失败:', baiduErr.response?.data || baiduErr.message)
      // 抠图失败不中断流程，依然返回原图给前端兜底
    }

    const wxContext = cloud.getWXContext()
    await saveTryonRecordSafely({
      openid: wxContext.OPENID,
      finalImageUrl,
      personImageFileID,
      topGarmentFileID,
      bottomGarmentFileID,
      clothingIds
    })

    // === 5. 返回最终结果 ===
    return {
      code: 200,
      data: { 
        result_url: finalImageUrl,             // 带有背景的原试穿图
        transparentBase64: transparentBase64,  // 新增：百度返回的透明抠图结果
        message: '试穿生成成功'
      }
    }

  } catch (error) {
    console.error('❌ 试穿逻辑异常:', error.response?.data || error)
    return { 
      code: 500, 
      message: error.message || 'AI 试穿服务异常',
      error: error.message 
    }
  }
}