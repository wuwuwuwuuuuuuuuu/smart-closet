const cloud = require('wx-server-sdk')
const { getLowCarbonSummary } = require('./service')

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
    async listClothesPage(openid, userId, offset, limit) {
      const res = await db.collection('clothes')
        .where({ user_id: userId })
        .skip(offset)
        .limit(limit)
        .get()
      return (res.data || []).filter(item => !item._openid || item._openid === openid)
    }
  }
}

exports.main = async () => {
  try {
    return await getLowCarbonSummary({
      gateway: createGateway(),
      openid: cloud.getWXContext().OPENID,
      now: new Date()
    })
  } catch (error) {
    console.error('getLowCarbonSummary failed', error)
    return { code: 500, message: '获取闲置预警数据失败', data: {} }
  }
}

exports.createGateway = createGateway
