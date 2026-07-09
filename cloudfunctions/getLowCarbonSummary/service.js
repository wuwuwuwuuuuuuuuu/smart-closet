const {
  getShanghaiDateKey,
  buildLowCarbonStatistics,
  buildSuggestions,
  listAllClothes
} = require('./common/low-carbon-core')

async function getLowCarbonSummary({ gateway, openid, now = new Date() }) {
  if (!openid) return { code: 401, message: '未获取到可信用户身份', data: {} }
  const user = await gateway.findUser(openid)
  if (!user) return { code: 404, message: '用户不存在', data: {} }

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
    message: '获取闲置预警数据成功',
    data: {
      totalClothes: statistics.totalClothes,
      activeClothes: statistics.activeClothes,
      activityRate: statistics.activityRate,
      idleCount: statistics.idleClothes.length,
      suggestions: buildSuggestions(statistics),
      lowCarbonPriority: user.lowCarbonPriority === true
    }
  }
}

module.exports = { getLowCarbonSummary }
