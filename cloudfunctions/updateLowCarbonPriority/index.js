const cloud = require('wx-server-sdk')
const { updateLowCarbonPriority } = require('./service')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function firstData(res) {
  return res && Array.isArray(res.data) ? res.data[0] : null
}

function createGateway() {
  return {
    serverDate: () => db.serverDate(),
    async findUser(openid) {
      return firstData(await db.collection('users').where({ _openid: openid })
        .orderBy('createdAt', 'desc').limit(1).get())
    },
    async updateUser(userId, data) {
      return db.collection('users').doc(userId).update({
        data: {
          ...data,
          updated_at: db.serverDate()
        }
      })
    }
  }
}

exports.main = async event => {
  try {
    return await updateLowCarbonPriority({
      gateway: createGateway(),
      openid: cloud.getWXContext().OPENID,
      event
    })
  } catch (error) {
    console.error('updateLowCarbonPriority failed', error)
    return { code: 500, message: '设置更新失败', data: {} }
  }
}

exports.createGateway = createGateway
