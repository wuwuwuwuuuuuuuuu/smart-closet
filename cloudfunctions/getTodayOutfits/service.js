const { toShanghaiDateKey } = require('./common/outfit-date-utils')

async function getTodayOutfits({ gateway, openid, now = new Date() }) {
  if (!openid) return { code: 401, message: '未获取到可信用户身份', data: {} }
  const user = await gateway.findUser(openid)
  if (!user) return { code: 404, message: '用户不存在', data: {} }
  const dateKey = toShanghaiDateKey(now)
  const outfits = await gateway.listToday(openid, dateKey)
  outfits.sort((a, b) => a.slot - b.slot)
  return {
    code: 200,
    message: '获取今日穿搭成功',
    data: {
      dateKey,
      count: outfits.length,
      remaining: Math.max(0, 3 - outfits.length),
      outfits: outfits.map(item => ({
        ...item,
        clothingIds: Array.isArray(item.clothingIds) ? item.clothingIds : []
      }))
    }
  }
}

module.exports = { getTodayOutfits }
