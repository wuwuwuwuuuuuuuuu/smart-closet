const cloud = require('wx-server-sdk')
const { deleteTodayOutfit } = require('./service')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function firstData(res) {
  return res && Array.isArray(res.data) ? res.data[0] : null
}

function isNotFound(error) {
  return /DOCUMENT_NOT_FOUND|document not exists|not found/i.test(
    `${error && error.code || ''} ${error && error.message || ''} ${error && error.errMsg || ''}`
  )
}

async function getDoc(source, collection, id) {
  try {
    const res = await source.collection(collection).doc(id).get()
    return res && res.data ? res.data : null
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

function createGateway() {
  const repository = transaction => ({
    findOutfit: id => getDoc(transaction, 'outfitRecords', id),
    removeOutfit: id => transaction.collection('outfitRecords').doc(id).remove(),
    findUsage: id => getDoc(transaction, 'clothingUsage', id),
    updateUsage: (id, data) => transaction.collection('clothingUsage').doc(id).update({ data }),
    removeUsage: id => transaction.collection('clothingUsage').doc(id).remove(),
    findClothing: id => getDoc(transaction, 'clothes', id),
    updateClothing: (id, data) => transaction.collection('clothes').doc(id).update({ data })
  })
  return {
    async findUser(openid) {
      return firstData(await db.collection('users').where({ _openid: openid })
        .orderBy('createdAt', 'desc').limit(1).get())
    },
    findOutfit: id => getDoc(db, 'outfitRecords', id),
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
