const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { longitude, latitude, city } = event
  
  // 🌟 从云端环境变量安全读取高德 Key
  const AMAP_KEY = process.env.AMAP_KEY

  if (!AMAP_KEY) {
    return { code: 500, message: '未配置高德 AMAP_KEY 环境变量' }
  }

  try {
    let targetCity = city
    let targetAdcode = null

    // 1. 如果传了经纬度，先调用“逆地理编码”查出这是哪个城市 (adcode)
    if (longitude && latitude) {
      const regeoUrl = `https://restapi.amap.com/v3/geocode/regeo?location=${longitude},${latitude}&key=${AMAP_KEY}`
      const regeoRes = await axios.get(regeoUrl)
      
      if (regeoRes.data.status === '1') {
        const addressComponent = regeoRes.data.regeocode.addressComponent
        targetAdcode = addressComponent.adcode
        // 兼容直辖市的情况（直辖市的 city 可能是空的，需要取 province）
        targetCity = addressComponent.city || addressComponent.province
      } else {
        return { code: 400, message: '逆地理编码失败' }
      }
    }

    // 2. 根据 adcode 或 城市名 获取天气
    let weatherUrl = `https://restapi.amap.com/v3/weather/weatherInfo?key=${AMAP_KEY}&extensions=base`
    if (targetAdcode) {
      weatherUrl += `&city=${targetAdcode}`
    } else if (targetCity) {
      weatherUrl += `&city=${encodeURIComponent(targetCity)}`
    } else {
      return { code: 400, message: '缺少定位或城市参数' }
    }

    const weatherRes = await axios.get(weatherUrl)
    
    if (weatherRes.data.status === '1' && weatherRes.data.lives.length > 0) {
      const live = weatherRes.data.lives[0]
      return {
        code: 200,
        data: {
          city: targetCity || live.city, // 真实的城市名
          temp: live.temperature,        // 温度数字
          text: live.weather,            // 天气现象(晴、雨)
          reportTime: live.reporttime    // 🌟 核心新增：高德官方的数据发布时间 (例："2026-04-24 09:00:00")
        }
      }
    } else {
      return { code: 400, message: '高德天气数据获取失败' }
    }

  } catch (error) {
    console.error('天气获取异常:', error)
    return { code: 500, message: '服务器内部错误', error: error.message }
  }
}