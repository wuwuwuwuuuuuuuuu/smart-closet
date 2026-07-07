const {
  getShanghaiDateKey,
  buildLowCarbonStatistics,
  listAllClothes
} = require('./common/low-carbon-core')

async function getIdleClothes({ gateway, openid, now = new Date() }) {
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
    message: '获取闲置衣物成功',
    data: {
      count: statistics.idleClothes.length,
      clothes: statistics.idleClothes.map(item => ({
        _id: item._id,
        name: item.name,
        image: item.image,
        wearCount: item.wearCount,
        lastWornAt: item.lastWornAt,
        unusedDays: item.unusedDays,
        neverWorn: item.neverWorn
      }))
    }
  }
}

module.exports = { getIdleClothes }
