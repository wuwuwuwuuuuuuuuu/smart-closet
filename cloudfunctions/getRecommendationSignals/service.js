const {
  getShanghaiDateKey,
  buildLowCarbonStatistics,
  listAllClothes
} = require('./common/low-carbon-core')

async function getRecommendationSignals({ gateway, openid, now = new Date() }) {
  if (!openid) return { code: 401, message: '未获取到可信用户身份', data: {} }
  const user = await gateway.findUser(openid)
  if (!user) return { code: 404, message: '用户不存在', data: {} }

  const enabled = user.lowCarbonPriority === true
  if (!enabled) {
    return {
      code: 200,
      message: '获取衣物使用信号成功',
      data: {
        enabled: false,
        signals: []
      }
    }
  }

  const todayDateKey = getShanghaiDateKey(now)
  const clothes = await listAllClothes(gateway, openid, user._id)
  const statistics = buildLowCarbonStatistics({
    clothes,
    user,
    openid,
    todayDateKey
  })

  return {
    code: 200,
    message: '获取衣物使用信号成功',
    data: {
      enabled: true,
      signals: statistics.enrichedClothes.map(item => ({
        clothingId: item._id,
        wearCount: item.wearCount,
        lastWornAt: item.lastWornAt,
        unusedDays: item.unusedDays,
        neverWorn: item.neverWorn,
        idle: item.idle
      }))
    }
  }
}

module.exports = { getRecommendationSignals }
