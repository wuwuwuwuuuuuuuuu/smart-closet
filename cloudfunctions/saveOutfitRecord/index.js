const cloud = require('wx-server-sdk')
const { saveOutfitRecord } = require('./service')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function firstData(res) {
  return res && Array.isArray(res.data) ? res.data[0] : null
}

function isNotFound(error) {
  return /DOCUMENT_NOT_FOUND|document not exists|not found/i.test(
    `${error && error.code || ''} ${error && error.message || ''} ${error && error.errMsg || ''}`
  )
}

async function getDoc(transaction, collection, id) {
  try {
    const res = await transaction.collection(collection).doc(id).get()
    return res && res.data ? res.data : null
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

function createGateway() {
  const repository = transaction => ({
    findOutfit: id => getDoc(transaction, 'outfitRecords', id),
    findClothing: id => getDoc(transaction, 'clothes', id),
    findUsage: id => getDoc(transaction, 'clothingUsage', id),
    async setOutfit(id, data) {
      await transaction.collection('outfitRecords').doc(id).set({ data })
      return { _id: id, ...data }
    },
    updateUsage: (id, data) => transaction.collection('clothingUsage').doc(id).update({ data }),
    setUsage: (id, data) => transaction.collection('clothingUsage').doc(id).set({ data }),
    updateClothing: (id, data) => transaction.collection('clothes').doc(id).update({ data })
  })
  return {
    serverDate: () => db.serverDate(),
    async findUser(openid) {
      return firstData(await db.collection('users').where({ _openid: openid })
        .orderBy('createdAt', 'desc').limit(1).get())
    },
    async findOutfitByRequest(openid, requestId) {
      return firstData(await db.collection('outfitRecords')
        .where({ _openid: openid, requestId }).limit(1).get())
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
    return await saveOutfitRecord({
      gateway: createGateway(),
      openid: cloud.getWXContext().OPENID,
      event,
      now: new Date()
    })
  } catch (error) {
    console.error('saveOutfitRecord failed', error)
    return { code: 500, message: '保存今日穿搭失败', data: {} }
  }
}

exports.createGateway = createGateway
