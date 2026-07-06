const cloud = require('wx-server-sdk')
const { getTodayOutfits } = require('./service')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function firstData(res) {
  return res && Array.isArray(res.data) ? res.data[0] : null
}

function createGateway() {
  return {
    async findUser(openid) {
      return firstData(await db.collection('users').where({ _openid: openid })
        .orderBy('createdAt', 'desc').limit(1).get())
    },
    async listToday(openid, dateKey) {
      const res = await db.collection('outfitRecords')
        .where({ _openid: openid, dateKey })
        .orderBy('slot', 'asc')
        .get()
      return res.data || []
    }
  }
}

exports.main = async () => {
  try {
    return await getTodayOutfits({
      gateway: createGateway(),
      openid: cloud.getWXContext().OPENID,
      now: new Date()
    })
  } catch (error) {
    console.error('getTodayOutfits failed', error)
    return { code: 500, message: '获取今日穿搭失败', data: {} }
  }
}

exports.createGateway = createGateway
