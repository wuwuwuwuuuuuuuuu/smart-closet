const cloud = require('wx-server-sdk')
const { deleteTodayOutfit } = require('./service')
const { getDocumentOrNull } = require('./common/cloudbase-doc-utils')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function firstData(res) {
  return res && Array.isArray(res.data) ? res.data[0] : null
}

function createGateway() {
  const repository = transaction => ({
    findOutfit: id => getDocumentOrNull(transaction, 'outfitRecords', id),
    removeOutfit: id => transaction.collection('outfitRecords').doc(id).remove(),
    findUsage: id => getDocumentOrNull(transaction, 'clothingUsage', id),
    updateUsage: (id, data) => transaction.collection('clothingUsage').doc(id).update({ data }),
    removeUsage: id => transaction.collection('clothingUsage').doc(id).remove(),
    findClothing: id => getDocumentOrNull(transaction, 'clothes', id),
    updateClothing: (id, data) => transaction.collection('clothes').doc(id).update({ data })
  })
  return {
    async findUser(openid) {
      return firstData(await db.collection('users').where({ _openid: openid })
        .orderBy('createdAt', 'desc').limit(1).get())
    },
    findOutfit: id => getDocumentOrNull(db, 'outfitRecords', id),
    async findLatestUsageBefore(openid, clothingId, dateKey) {
      return firstData(await db.collection('clothingUsage').where({
        _openid: openid,
        clothingId,
        dateKey: _.lt(dateKey)
      }).orderBy('dateKey', 'desc').limit(1).get())
    },
    async runTransaction(callback) {
      let result
      await db.runTransaction(async transaction => {
        result = await callback(repository(transaction))
        return result
      }, 5)
      return result
    }
  }
}

exports.main = async event => {
  try {
    return await deleteTodayOutfit({
      gateway: createGateway(),
      openid: cloud.getWXContext().OPENID,
      event,
      now: new Date()
    })
  } catch (error) {
    console.error('deleteTodayOutfit failed', error)
    return { code: 500, message: '删除今日穿搭失败', data: {} }
  }
}

exports.createGateway = createGateway
