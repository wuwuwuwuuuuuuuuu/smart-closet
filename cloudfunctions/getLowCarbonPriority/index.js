const cloud = require('wx-server-sdk')
const { getLowCarbonPriority } = require('./service')

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
    }
  }
}

exports.main = async () => {
  try {
    return await getLowCarbonPriority({
      gateway: createGateway(),
      openid: cloud.getWXContext().OPENID
    })
  } catch (error) {
    console.error('getLowCarbonPriority failed', error)
    return { code: 500, message: '获取设置失败', data: {} }
  }
}

exports.createGateway = createGateway
